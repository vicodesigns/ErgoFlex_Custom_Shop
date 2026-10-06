// services/music_mode_service.go
// Music-Reactive LED Mode Service
// Manages Python audio analysis subprocess and ErgoLED integration

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"ergoflex_api/commands"
	"ergoflex_api/ws_clients"

	"ergoflex_api/ergoled"
)

// Sentinel errors for HTTP status mapping in route handlers
var ErrMusicModeConflict = errors.New("music mode conflict")
var ErrMusicModeValidation = errors.New("music mode validation")

// Global music mode service reference for cross-service queries (e.g., WLED sync save guard).
// Uses atomic.Pointer for concurrency safety across async exit goroutines, tests, and main setup.
var globalMusicModeService atomic.Pointer[MusicModeService]

// SetGlobalMusicModeService sets the global music mode service reference.
// Must be called immediately after NewMusicModeService(), before WLED sync listener startup.
func SetGlobalMusicModeService(svc *MusicModeService) {
	globalMusicModeService.Store(svc)
}

// IsMusicModeActiveForUser checks if music mode is active for a specific user.
// Used by wled_sync_service save guard to prevent persisting transient FX 28/29 state.
func IsMusicModeActiveForUser(userID int) bool {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return false
	}
	return svc.IsActiveForUser(userID)
}

// MusicModeSourceForUser returns the active audio source for a user ("mic"/"system"),
// or "" if music mode is not active. Used by the LED transition recovery broadcast.
func MusicModeSourceForUser(userID int) string {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return ""
	}
	return svc.SourceForUser(userID)
}

// musicLowLatencyEnabled reports whether the Step-6 low-latency analyzer path is
// enabled. Default ON; disabled only when MUSIC_ANALYZER_LOW_LATENCY_V2 is set to a
// falsey value ("false"/"0"/"off"/"no") so rollback to the legacy analyzer is trivial.
func musicLowLatencyEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("MUSIC_ANALYZER_LOW_LATENCY_V2"))) {
	case "false", "0", "off", "no":
		return false
	default:
		return true
	}
}

// musicGridSnapEnabled reports whether the analyzer's beat grid-snapping is on
// (suppress off-grid beat flashes / synthesize missed ones while tempo-locked;
// 2026-07-12 latency-probe remediation). Default ON; MUSIC_BEAT_GRID_SNAP set
// to a falsey value passes --no-grid-snap for a trivial rollback.
func musicGridSnapEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("MUSIC_BEAT_GRID_SNAP"))) {
	case "false", "0", "off", "no":
		return false
	default:
		return true
	}
}

// IsMusicModeSessionOwner checks if the user owns the music mode session
// (active OR still in the activation window between Steps 2-5).
// Used ONLY by wled_sync_service DB-save suppression to close the race
// between ErgoLED payload send (Step 3) and m.active = true (Step 5).
func IsMusicModeSessionOwner(userID int) bool {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return false
	}
	return svc.OwnsMusicSession(userID)
}

// ResendMusicModePayloadForUser re-sends the current music FX payload to firmware.
// Used after an elevator animation overwrites the firmware's FX state.
func ResendMusicModePayloadForUser(userID int, transition int) error {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return fmt.Errorf("music mode service not available")
	}
	return svc.ResendPayload(userID, transition)
}

// SetMusicModeBrightness forwards a brightness change at PriorityMusic so it passes the write gate.
// Used by the brightness route handler when music mode is active.
func SetMusicModeBrightness(userID int, bri int) error {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return fmt.Errorf("music mode service not available")
	}
	return svc.SetBrightness(userID, bri)
}

// GetMusicModeResumeConfig returns the active music mode config for logout resume.
func GetMusicModeResumeConfig(userID int) *MusicModeResumeConfig {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return nil
	}
	return svc.GetResumeConfig(userID)
}

// EndMusicResumeIntent ends the durable music-resume intent for a user (bumps the
// intent generation and clears the persisted config, serialized against saves).
// Routes call this AFTER a successful explicit non-music replacement action
// (explicit deactivate, manual color/effect/preset/scene, timeline start, master
// toggle off). Idempotent and safe when no service / no intent exists.
func EndMusicResumeIntent(userID int) {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return
	}
	svc.EndResumeIntent(userID)
}

// ActivateMusicModeForUser activates music mode for the specified user.
func ActivateMusicModeForUser(userID int, source string, sensitivity float64, visualMode int, paletteID int, opts ActivateOpts) error {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return fmt.Errorf("music mode service not initialized")
	}
	return svc.Activate(userID, source, sensitivity, visualMode, paletteID, opts)
}

// DeactivateMusicModeForUser deactivates music mode if active for the given user.
// Blocks until Python process is stopped and WriteGate is cleared.
// Used by logout handlers to prevent orphaned music sessions.
// Returns nil if music mode was not active for this user.
func DeactivateMusicModeForUser(userID int) error {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return nil
	}
	if !svc.IsActiveForUser(userID) {
		return nil
	}
	return svc.Deactivate(userID)
}

// DeactivateMusicModeForPowerCycle deactivates without restoring LED state to
// ErgoLED hardware, but persists the pre-music state to DB. Used by the power-OFF
// handler when music resume config was successfully saved.
func DeactivateMusicModeForPowerCycle(userID int) error {
	svc := globalMusicModeService.Load()
	if svc == nil {
		return nil
	}
	if !svc.IsActiveForUser(userID) {
		return nil
	}
	return svc.DeactivateForPowerCycle(userID)
}

// AudioMetrics represents real-time audio analysis data from Python subprocess.
// The v2 fields (bpm..sc) are produced by the analyzer's MusicBrain (Music Mode
// 2.0); a legacy analyzer simply never sets them, which zero-values match.
type AudioMetrics struct {
	Bands     [8]uint8 `json:"b"`   // 8-band frequency spectrum (0-255)
	Volume    uint8    `json:"v"`   // Overall volume level (0-255)
	Energy    uint8    `json:"e"`   // Total audio energy (0-255)
	Beat      uint8    `json:"bt"`  // Beat detection (0-255)
	BassBeat  uint8    `json:"bb"`  // Bass beat detection (0-255)
	PeakBand  uint8    `json:"pk"`  // Index of peak frequency band (0-7)
	Bpm       uint8    `json:"bpm"` // Locked tempo estimate (0 = no lock)
	BeatPhase uint8    `json:"bph"` // Position through current beat (0-255)
	BarPos    uint8    `json:"bar"` // bits6-7 beat-in-bar (0-3), bits0-5 bar-in-phrase (0-7)
	Envelope  uint8    `json:"env"` // Slow loudness envelope vs AGC reference (0-255)
	Flags     uint8    `json:"fl"`  // bit0 build, bit1 drop, bit2 quiet
	Centroid  uint8    `json:"sc"`  // Spectral centroid, band-weighted (0-255)
	// TempoConf is the analyzer's peak/mean autocorrelation ratio x10, the
	// same number its own lock hysteresis uses (lock at 22). It was computed
	// per estimate and discarded, so downstream could not tell a firm lock
	// from a marginal one — a 2026-08-22 walk found Clair de Lune rotating
	// FASTER than 125 BPM house because a phantom 146 BPM drove the bar count
	// and nothing could see that it was phantom. 0 means no estimate.
	TempoConf uint8 `json:"tcf"`
	// Flux is frame-to-frame spectral movement at the analyzer's ~100 Hz.
	// How much the strip moves BETWEEN switches is what a viewer judges, and
	// it is invisible to anything sampling at djTickInterval's 2 Hz.
	Flux      uint8 `json:"flx"`
	Timestamp int64 `json:"ts,omitempty"` // Python-side epoch ms (same-host clock for latency diagnostics)
}

// LedPayloadSaver is called by Deactivate to persist the restored LED state to the DB.
// This closes the gap where savedLedState goes to ErgoLED hardware but never reaches led_last_payload.
type LedPayloadSaver func(userID int, payload json.RawMessage) error

// ResumeConfigSaver persists the music-mode resume config (durable "active intent")
// so an abrupt API restart can re-activate music on the next login / power-on.
type ResumeConfigSaver func(userID int, payload json.RawMessage) error

// ResumeConfigClearer clears the persisted music-mode resume config.
type ResumeConfigClearer func(userID int) error

// resumeIntentToken is captured at the start of a resume-intent save and
// re-validated before the DB write, so a stale saver loses to a newer activation
// (sessionGen) or to an explicit EndResumeIntent (intentGen).
type resumeIntentToken struct {
	sessionGen uint64
	intentGen  uint64
}

// SettingsGetter interface for dependency injection (satisfied by UserSettingsRepository)
type SettingsGetter interface {
	GetSettings(ctx context.Context, userID int) (interface{}, error)
}

// MusicModeService manages music-reactive LED mode state and Python subprocess
type MusicModeService struct {
	mu                sync.RWMutex
	metricsTap        atomic.Pointer[func(AudioMetrics)] // Game mode's analyser tap: sees every ingress frame, music active or not
	active            bool
	activating        bool // activation in flight (claims the slot across Activate's unlock-around-I/O windows)
	userID            int
	source            string                // "mic" or "system"
	sensitivity       float64               // 0.5-2.0 audio sensitivity multiplier
	visualMode        int                   // 0=spectrum, 1=pulse, 2=comet, 3=strobe, 4=fire, 5=wave
	paletteID         int                   // ErgoLED palette ID
	upalRef           string                // a user palette (Palette Studio) for every strip without its own; "" = paletteID
	speed             int                   // sx parameter (0-255, default 128)
	intensity         int                   // ix parameter (0-255, default varies by effect)
	reverse           bool                  // Reverse direction per segment
	mirror            bool                  // Mirror effect per segment
	smoothTransitions bool                  // Enable smooth transitions between config changes
	metrics           AudioMetrics          // Latest audio metrics from Python
	metricsUpdated    time.Time             // Timestamp of last metrics update
	pythonCmd         *exec.Cmd             // Python subprocess command
	pythonCancel      context.CancelFunc    // Context cancel for subprocess
	pythonDone        chan struct{}         // Closed by watcher goroutine when cmd.Wait() returns
	pythonStdin       io.WriteCloser        // Retained to prevent GC closing the death-pact pipe
	stopping          bool                  // true = intentional stop in progress; watcher skips crash-cleanup
	savedLedState     json.RawMessage       // LED state before music mode (for restore)
	metricsCount      uint64                // Counter for UpdateMetrics calls (diagnostic logging)
	writeGate         *LEDWriteGate         // Write gate for priority management
	ergoLEDClient        *ErgoLEDClient           // ErgoLED HTTP client
	settingsRepo      SettingsGetter        // User settings repository
	scriptPath        string                // Path to Python audio analysis script
	automationService *LEDAutomationService // For fallback restore on deactivation
	udpConn           *net.UDPConn          // UDP push connection to firmware (nil = HTTP fallback)
	firmwareAddr      *net.UDPAddr          // Resolved firmware UDP address
	udpSeq            uint8                 // Packet sequence number (wraps at 255)
	udpEnabled        bool                  // True when UDP sender is active

	// A0 write-gate counters. Atomics, not mu-guarded fields: they are touched on
	// every metrics frame (50-100Hz) and read from the status path, and none of
	// them participates in an invariant with the state under mu.
	// See music_mode_write_gate.go for why music needs an explicit gate at all.
	udpFramesSent       atomic.Uint64
	udpFramesSuppressed atomic.Uint64
	httpPollsSuppressed atomic.Uint64
	// udpRateCapped is the UDP counterpart to musicSerial.rateCapped. It exists because the pace
	// gate is now shared across both transports: without a per-transport counter, hoisting the
	// gate would have made musicSerial.rateCapped count UDP frames too, and that counter feeds
	// the canary report Gate 2 reads. "A frame offered to serial and a frame offered to UDP are
	// different facts and averaging them describes neither" — musicSerialCounters says so itself.
	udpRateCapped atomic.Uint64
	// Auto DJ deferral counters. Same reasoning as the block above, plus one that
	// is specific to them: autoDJState lives inside the runAutoDJ goroutine and is
	// invisible to every HTTP handler, so these cannot live on it. Process-wide
	// and cumulative — see DJDeferralStats in music_auto_dj_deferral.go.
	djSwitchesDecided     atomic.Uint64
	djSwitchesDeferred    atomic.Uint64
	djSwitchesAppliedLate atomic.Uint64
	djSwitchesAbandoned   atomic.Uint64
	djMaxDeferMs          atomic.Uint64
	djSwitchesArmed       atomic.Uint64
	djArmedFired          atomic.Uint64
	djArmedDeferred       atomic.Uint64
	djArmedDropped        atomic.Uint64
	// djRec is the per-show flight recorder — the counters above answer "since
	// API start", which is the wrong framing for "how was that show".
	// See music_auto_dj_recorder.go.
	djRec           *djRecorder
	segmentConfigs  []MusicSegmentConfig // Per-segment overrides (nil = all global)
	brightness      int                  // Global brightness for music mode (default 255)
	segmentColors   []json.RawMessage    // Per-segment "col" arrays from pre-music ErgoLED state
	// lastRenderSent is the most recent successful music write, as sent (music_dj_render.go).
	lastRenderSent *DJRenderSent
	// lastTuning is the most recent sendFirmwareConfig outcome (music_dj_tuning.go).
	lastTuning *DJTuningRecord
	// lastDeliveredTuning is the last tuning this process actually delivered, if any.
	lastDeliveredTuning *FirmwareMusicConfig
	// Serial tuning bookkeeping (music_dj_tuning.go): the capability epoch (fresh hellos) the board
	// last verified a tuning at, and the config it verified; when a failed re-send may try again and
	// when the next read-back is due; which epoch was already told "no capability" in the log.
	tuningVerifiedEpoch      uint64
	tuningVerifiedEpochValid bool
	tuningVerifiedIntended   FirmwareMusicConfig
	tuningVerifiedClean      bool // that verify matched every field (the success line was due)
	tuningResendAfter        time.Time
	tuningResendBackoff      time.Duration
	tuningReadBackAt         time.Time
	tuningNoCapLoggedEpoch   uint64
	tuningNoCapLogged        bool
	// tuningBoardLoggedEpoch is the hello epoch whose board tuning was already read and logged.
	tuningBoardLoggedEpoch uint64
	tuningBoardLogged      bool
	// djSwitchRendering is true while a DJ switch's write is in flight and its new look not yet
	// published: that write belongs to the incoming look, not to djNowPlaying (still the old one).
	djSwitchRendering bool
	ledPayloadSaver LedPayloadSaver      // Callback to persist restored LED state to DB

	// Live telemetry (music_metrics WS broadcast to the session owner, ~12Hz).
	// Beat/flag bits are OR-aggregated between throttled sends so a 20ms beat
	// pulse can't fall between two broadcast frames.
	wsLastMetricsBroadcast time.Time
	// deviceTransients and devicePace pace the DEVICE, whichever transport reaches it. They were
	// serialTransients/serialPace and lived inside pushMetricsSerial, which left the UDP path —
	// the DEFAULT, since MusicTransportUDP is the iota zero value — entirely uncapped. Now hoisted
	// into sendMetricsSelected above the transport switch, so there is ONE instance and ONE call
	// site rather than two agreeing by convention.
	//
	// Still separate from the WS accumulator: that one is bounded by an 80ms wall-clock throttle,
	// this one by audio-time staleness, and sharing them would tie two different bounds together.
	deviceTransients  transientAccumulator
	devicePace        paceGate
	wsPendingBeat     uint8
	wsPendingBassBeat uint8
	wsPendingFlags    uint8

	// Auto DJ conductor (music_auto_dj.go / music_auto_dj_runtime.go).
	// Dual generations: djRequestGen orders competing async resolves;
	// djGen (the running-conductor generation) changes ONLY on a successful
	// install or a disable, so a slow/failed program change leaves the
	// current show playing. djRuntime is the shared, replaceable config the
	// conductor snapshots each tick; djRuntimeRev bumps on every swap so a
	// tick straddling a reconfigure discards its stale action; djApplyMu
	// (lock order: djApplyMu → mu) serializes swaps with look application
	// because applyConfigPartial unlocks mu during ErgoLED I/O.
	djEnabled    bool
	djProgram    string
	djCancel     context.CancelFunc
	djGen        uint64
	djRequestGen uint64
	djRuntime    *djRuntimeConfig
	djRuntimeRev uint64

	// djTestStartBackdate backdates the conductor's first lastSwitch, so a test
	// can start a show whose phrase rotation is ALREADY due instead of waiting the
	// phrase target out in real time (16s x 1.5 grace at 8 bars). Zero in
	// production; set only by the beat-align test rig, before runAutoDJ starts.
	djTestStartBackdate time.Duration

	djApplyMu    sync.Mutex
	djNowPlaying *DJNowPlaying
	// djPrevLook is the look djNowPlaying replaced, kept for the rating
	// endpoint's attribution problem (services/music_dj_rating.go): a tap
	// shortly after a switch is plausibly about the look that JUST left the
	// strip, not the one currently on it, and the route must not guess which.
	// Updated at every site that changes what djNowPlaying describes —
	// including the safety-repaint correction path
	// (markNowPlayingRestored) — and reset to nil wherever djNowPlaying is
	// cleared, so a stale look from a DIFFERENT show can never surface as
	// "the previous one" for this show.
	djPrevLook *DJNowPlaying
	// djRecentLooks is the ordered window of looks this show has published,
	// newest LAST, bounded to djRecentLooksMax. It is what a SESSION-scope
	// rating is about (migration 247): a long-press says "the DJ is nailing
	// it / losing it right now", and that verdict names a stretch of the show
	// rather than the one look djNowPlaying happens to hold.
	//
	// Maintained in the SAME lock holds as djPrevLook and cleared wherever
	// djPrevLook is, for the same reason: a look from a DIFFERENT show must
	// never appear in this show's window.
	djRecentLooks []DJNowPlaying
	// DJ settings persistence + user-scoped batch loaders (wired in main.go).
	djSettingsStore DJSettingsStore
	djFavSource     MusicFavoritesSource
	djPresetSource  CustomPresetSource
	// djRatingsStore persists real-time ratings (migration 246). Nil-checked
	// at the call site rather than defaulting silently — a rating that
	// "succeeds" without landing anywhere would be a worse lie than a 500.
	djRatingsStore DJRatingsStore
	// DJ tuning overlay (music_auto_dj_overlay.go): effective firmware
	// config = activeConfig ⊕ djTuningOverlay. A field is DJ-owned iff its
	// key is in the overlay; a user write releases + locks it for the
	// session (djTuningUserLocked). Canonical desired/activeConfig are
	// NEVER mutated by the DJ — restore/resume/crash-recovery follow from
	// canonical being the only persisted thing.
	djTuningOverlay map[string]djOverlayValue
	// pendingSegRestore is the user's own segment canvas, queued because a
	// repaint that was supposed to remove DJ-generated segments failed.
	//
	// Reporting that failure is necessary but not sufficient: the stale slice
	// is still what the next config write inherits. Consuming this on the next
	// write that supplies no segments of its own turns a transient ErgoLED
	// failure into a self-healing one, instead of leaving the desk wearing a
	// composition nobody asked for until someone notices.
	pendingSegRestore  []MusicSegmentConfig
	djTuningUserLocked map[string]bool

	// Light-to-sound sync offset. Bluetooth speakers play ~150-250ms behind
	// the digital stream the analyzer taps, so the lights lead the ears; this
	// delays every relayed metrics frame (UDP push, HTTP fallback, WS
	// telemetry, Auto DJ inputs) by syncOffsetMs so the show aligns with the
	// SPEAKER. 0 (default) = no delay, byte-identical to before. The queue
	// drains on each ingress frame — the analyzer streams ~100Hz even during
	// silence, so residual quantization is ≤ one frame.
	syncOffsetMs    int
	syncQ           []delayedMetrics
	syncOffsetStore SyncOffsetStore // per-user persistence (mig 195); nil in tests

	// Workstream B — durable music intent.
	//   sessionGen  — bumped on every Activate; lets a save tell one activation from
	//                 a later deactivate→reactivate by the same user (active+userID
	//                 alone cannot).
	//   intentGen   — bumped by EndResumeIntent BEFORE clearing; a save holding an
	//                 older intentGen loses to an explicit clear.
	//   resumeConfig{Saver,Clearer} — DB persistence callbacks (wired in main.go).
	//   resumeIntentMu — serializes resume-intent save vs clear.
	sessionGen          uint64
	intentGen           uint64
	resumeConfigSaver   ResumeConfigSaver
	resumeConfigClearer ResumeConfigClearer
	resumeIntentMu      sync.Mutex

	// Firmware music config tuning
	desiredConfig            FirmwareMusicConfig // Persistent shared desired state
	activeConfig             FirmwareMusicConfig // Frozen copy for current session
	fwConfigSupported        bool                // Firmware supports /json/music-config
	fwColorDynamicsSupported bool                // Firmware echoes the color-dynamics keys (GET /json/music-config)
	fwColorBurstsSupported   bool                // Firmware echoes the color-burst keys (burstRate) — newer than color-dynamics
	fwLayerFxSupported       bool                // Firmware echoes the Music Mode 2.0 keys (comfortMode) — layer FX 37-40 usable
	fwColorDynamicsProbed    bool                // Whether we've probed for color-dynamics support yet
	fwCapRetrying            bool                // A background capability-probe retry is already in flight
	fwCapsFromSerial         bool                // The latched capability answer came from the serial hello, not HTTP
	fwCapSerialUpgrading     bool                // A background serial-upgrade poll is already in flight
	// Redundant-config accounting. MEASUREMENT ONLY — nothing is suppressed on
	// the strength of these; see logConfigRedundancy for why not yet.
	fwSentConfig      FirmwareMusicConfig
	fwSentConfigValid bool
	fwSentConfigGen   uint64    // port generation the belief was formed under
	fwSentConfigAt    time.Time // when the desk last actually received a config
	fwConfigSends     int
	fwConfigSkipped   int
	configCh          chan FirmwareMusicConfig // Coalescer channel (capacity 1)
	configCtx         context.Context          // Coalescer lifecycle
	configCancel      context.CancelFunc       // For clean shutdown
	configWg          sync.WaitGroup           // Wait for coalescer goroutine
}

// RGBWStops is a per-segment color override: exactly 3 color stops × 4 channels (RGBW).
// A custom UnmarshalJSON enforces the exact shape and 0-255 bounds — a bare [3][4]int
// would silently zero-fill / truncate a malformed array, defeating validation.
type RGBWStops [3][4]int

// UnmarshalJSON requires exactly 3 stops of exactly 4 channels, each value 0-255.
func (s *RGBWStops) UnmarshalJSON(data []byte) error {
	var raw [][]int
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("%w: col must be an array of [r,g,b,w] stops: %v", ErrMusicModeValidation, err)
	}
	if len(raw) != 3 {
		return fmt.Errorf("%w: col must have exactly 3 stops, got %d", ErrMusicModeValidation, len(raw))
	}
	var out RGBWStops
	for i, stop := range raw {
		if len(stop) != 4 {
			return fmt.Errorf("%w: col stop %d must have exactly 4 channels (RGBW), got %d", ErrMusicModeValidation, i, len(stop))
		}
		for j, v := range stop {
			if v < 0 || v > 255 {
				return fmt.Errorf("%w: col[%d][%d] = %d out of range (0-255)", ErrMusicModeValidation, i, j, v)
			}
			out[i][j] = v
		}
	}
	*s = out
	return nil
}

// MusicSegmentConfig holds per-segment overrides for music mode.
// Pointer fields are nil when not overridden (inherits global).
type MusicSegmentConfig struct {
	ID      int        `json:"id"`
	On      *bool      `json:"on,omitempty"`
	FX      *int       `json:"fx,omitempty"`
	SX      *int       `json:"sx,omitempty"`
	IX      *int       `json:"ix,omitempty"`
	Pal     *int       `json:"pal,omitempty"`
	Reverse *bool      `json:"reverse,omitempty"`
	Mirror  *bool      `json:"mirror,omitempty"`
	Col     *RGBWStops `json:"col,omitempty"`
	// UpalRef names one of the user's own palettes (Palette Studio) — a reference, never a board
	// slot. The segment is written with it beside pal 0; ergoled's resolver turns it into the
	// slot and its definition (docs/led/PALETTE_STUDIO_API.md §1–2). It wins over a DJ look's
	// palette on that strip, as the user's own tuning does.
	UpalRef *string `json:"upal_ref,omitempty"`
}

// MusicConfigUpdate holds optional fields for partial config updates.
// All pointer fields — nil means "don't change".
//
// UpalRef is the music-wide user palette: a Palette Studio id sets it, "" clears it back to
// PaletteID, nil leaves it. A PaletteID alone does NOT clear it — Auto DJ's built-in looks
// re-send the user's PaletteID and must keep their palette; the app clears explicitly when
// the user picks a built-in one.
type MusicConfigUpdate struct {
	Source            *string              `json:"source,omitempty"`
	Sensitivity       *float64             `json:"sensitivity,omitempty"`
	Visualization     *int                 `json:"visualization,omitempty"`
	PaletteID         *int                 `json:"palette_id,omitempty"`
	UpalRef           *string              `json:"upal_ref,omitempty"` // music-wide user palette (see above)
	Speed             *int                 `json:"speed,omitempty"`
	Intensity         *int                 `json:"intensity,omitempty"`
	Reverse           *bool                `json:"reverse,omitempty"`
	Mirror            *bool                `json:"mirror,omitempty"`
	SmoothTransitions *bool                `json:"smooth_transitions,omitempty"`
	SegmentConfigs    []MusicSegmentConfig `json:"segment_configs,omitempty"`
}

// MusicModeResumeConfig stores session config for auto-restart after re-login.
type MusicModeResumeConfig struct {
	Source            string               `json:"source"`
	Sensitivity       float64              `json:"sensitivity"`
	VisualMode        int                  `json:"visual_mode"`
	PaletteID         int                  `json:"palette_id"`
	UpalRef           string               `json:"upal_ref,omitempty"` // music-wide user palette
	Speed             int                  `json:"speed"`
	Intensity         int                  `json:"intensity"`
	Reverse           bool                 `json:"reverse"`
	Mirror            bool                 `json:"mirror"`
	SmoothTransitions bool                 `json:"smooth_transitions"`
	Brightness        int                  `json:"brightness"`
	SegmentConfigs    []MusicSegmentConfig `json:"segment_configs,omitempty"`
	SavedLedState     json.RawMessage      `json:"saved_led_state,omitempty"`
	// #15: the full firmware tuning (spectrum tuning + color dynamics + color
	// bursts) so a power-cycle/login resume restores ALL of it, not just the
	// top-level palette/speed/brightness/segment fields. Nil on legacy persisted
	// configs (pre-#15) → resume keeps the factory default, backward-compatible.
	FirmwareTuning *FirmwareMusicConfig `json:"firmware_tuning,omitempty"`
	// Auto DJ program key when the conductor was running at snapshot time
	// ("" = off). A resume re-starts the conductor after activation readiness.
	AutoDJProgram string `json:"auto_dj_program,omitempty"`
}

func cloneMusicSegmentConfigs(in []MusicSegmentConfig) []MusicSegmentConfig {
	if len(in) == 0 {
		return nil
	}
	out := make([]MusicSegmentConfig, len(in))
	for i, seg := range in {
		c := MusicSegmentConfig{ID: seg.ID}
		if seg.On != nil {
			v := *seg.On
			c.On = &v
		}
		if seg.FX != nil {
			v := *seg.FX
			c.FX = &v
		}
		if seg.SX != nil {
			v := *seg.SX
			c.SX = &v
		}
		if seg.IX != nil {
			v := *seg.IX
			c.IX = &v
		}
		if seg.Pal != nil {
			v := *seg.Pal
			c.Pal = &v
		}
		if seg.Reverse != nil {
			v := *seg.Reverse
			c.Reverse = &v
		}
		if seg.Mirror != nil {
			v := *seg.Mirror
			c.Mirror = &v
		}
		if seg.Col != nil {
			v := *seg.Col // array copy (RGBWStops is [3][4]int by value)
			c.Col = &v
		}
		if seg.UpalRef != nil {
			v := *seg.UpalRef
			c.UpalRef = &v
		}
		out[i] = c
	}
	return out
}

// musicFxMap maps visualMode (0-9) to firmware FX IDs.
// 0-5 → FX 28-33 (classic music FX); 6-9 → FX 37-40 (Music Mode 2.0 layer FX:
// Tower, Ripple, Bass Sky, The Drop). 34-36 are movement-indicator FX and are
// deliberately NOT in this map.
var musicFxMap = map[int]int{0: 28, 1: 29, 2: 30, 3: 31, 4: 32, 5: 33, 6: 37, 7: 38, 8: 39, 9: 40}

// IsMusicFxID reports whether a firmware FX ID is a music-reactive effect.
//
// Delegates to ergoled.IsMusicFX, which is the SINGLE definition. This was a byte-identical twin
// of services.isMusicFX in the same package, under a comment claiming they were one predicate so
// host and device could not drift — two copies of a rule whose whole purpose was to have one copy.
func IsMusicFxID(fx int) bool {
	return ergoled.IsMusicFX(fx)
}

// IsAmbientFxID reports whether a firmware FX ID is Game mode's ambient effect (FX 41). Delegates to
// ergoled.IsAmbientFX, the single definition; NOT a music FX (the device's isMusicFx excludes it on purpose).
func IsAmbientFxID(fx int) bool {
	return ergoled.IsAmbientFX(fx)
}

// defaultIx provides per-effect default ix values.
// Spectrum (0) defaults to 128 = mirrored "both sides" band map so the whole
// desk lights up symmetrically out of the box (firmware fxMusicSpectrum: ix
// 85-170 = mirrored, <85 = bottom-up single side, >=171 = top-down single side).
// Layer FX (6-9): Tower ix<128 = bass at feet; Ripple ix<128 = one sweep per
// beat, >=128 per bar; Bass Sky ix = bass↔sky balance; Drop ix = slam ceiling.
var defaultIx = map[int]int{0: 128, 1: 128, 2: 0, 3: 0, 4: 200, 5: 128, 6: 1, 7: 1, 8: 128, 9: 200}

// FirmwareMusicConfig holds the full firmware tuning config (used for storage and firmware send).
type FirmwareMusicConfig struct {
	AttackAlpha        float32  `json:"attackAlpha"`
	DecayAlpha         float32  `json:"decayAlpha"`
	StalenessMs        uint16   `json:"stalenessMs"`
	NoiseFloor         uint8    `json:"noiseFloor"`
	SpectrumBeatBoost  uint8    `json:"spectrumBeatBoost"`
	SpectrumGamma      float32  `json:"spectrumGamma"`
	PulseAmbientDiv    uint8    `json:"pulseAmbientDiv"`
	PulseRippleDelays  [8]uint8 `json:"pulseRippleDelays"`
	PulseColorShiftDiv uint8    `json:"pulseColorShiftDiv"`
	PulseMinFlash      uint8    `json:"pulseMinFlash"`
	// Color dynamics (all default 0 = classic look, byte-identical until enabled)
	ColorMotionSpeed uint8 `json:"colorMotionSpeed"`
	ColorSpread      uint8 `json:"colorSpread"`
	EnergyToMotion   uint8 `json:"energyToMotion"`
	BeatHueStep      uint8 `json:"beatHueStep"`
	PeakBandToHue    uint8 `json:"peakBandToHue"`
	// Color bursts overlay + beat-randomized reverse/mirror (burstZone default 128 = whole desk)
	BurstEnable   uint8 `json:"burstEnable"`
	BurstRate     uint8 `json:"burstRate"`
	BurstSpectrum uint8 `json:"burstSpectrum"`
	BurstZone     uint8 `json:"burstZone"`
	// Burst shaping: depth 255 / tail 128 / section 0 / dropAware 0 reproduce the classic look.
	// section is calm/hype (0=off, higher=longer calm); dropAware holds bursts through a build and
	// fires one on the drop.
	BurstDepth     uint8 `json:"burstDepth"`
	BurstTail      uint8 `json:"burstTail"`
	BurstSection   uint8 `json:"burstSection"`
	BurstDropAware uint8 `json:"burstDropAware"`
	RandomizeFlip  uint8 `json:"randomizeFlip"`
	RandomizeRate  uint8 `json:"randomizeRate"` // how often randomizeFlip re-rolls; 255=every beat (default)
	// Music Mode 2.0 (layer FX firmware). driftBeatSync: color drift steps per
	// beat instead of per-ms (needs a tempo lock; falls back to per-ms without
	// one). comfortMode: 350ms full-field flash floor across strobe/burst/drop
	// paths (photosensitivity guard) — the one key that defaults ON.
	DriftBeatSync uint8 `json:"driftBeatSync"`
	ComfortMode   uint8 `json:"comfortMode"`
}

// UnmarshalJSON keeps the classic look for a config saved BEFORE burstDepth/burstTail existed (the
// music resume config persists the whole struct): an absent key would otherwise decode to 0, and
// depth 0 makes every burst invisible. Only these two need it; section and dropAware default to 0.
func (c *FirmwareMusicConfig) UnmarshalJSON(b []byte) error {
	type plain FirmwareMusicConfig
	if err := json.Unmarshal(b, (*plain)(c)); err != nil {
		return err
	}
	var probe struct {
		Depth *uint8 `json:"burstDepth"`
		Tail  *uint8 `json:"burstTail"`
	}
	if err := json.Unmarshal(b, &probe); err != nil {
		return err
	}
	if probe.Depth == nil {
		c.BurstDepth = 255
	}
	if probe.Tail == nil {
		c.BurstTail = 128
	}
	return nil
}

// FirmwareMusicConfigPatch holds PATCH semantics — pointer fields for partial updates.
type FirmwareMusicConfigPatch struct {
	AttackAlpha        *float32 `json:"attackAlpha,omitempty"`
	DecayAlpha         *float32 `json:"decayAlpha,omitempty"`
	StalenessMs        *uint16  `json:"stalenessMs,omitempty"`
	NoiseFloor         *uint8   `json:"noiseFloor,omitempty"`
	SpectrumBeatBoost  *uint8   `json:"spectrumBeatBoost,omitempty"`
	SpectrumGamma      *float32 `json:"spectrumGamma,omitempty"`
	PulseAmbientDiv    *uint8   `json:"pulseAmbientDiv,omitempty"`
	PulseRippleDelays  []uint8  `json:"pulseRippleDelays,omitempty"` // len <= 8, positional
	PulseColorShiftDiv *uint8   `json:"pulseColorShiftDiv,omitempty"`
	PulseMinFlash      *uint8   `json:"pulseMinFlash,omitempty"`
	// Color dynamics
	ColorMotionSpeed *uint8 `json:"colorMotionSpeed,omitempty"`
	ColorSpread      *uint8 `json:"colorSpread,omitempty"`
	EnergyToMotion   *uint8 `json:"energyToMotion,omitempty"`
	BeatHueStep      *uint8 `json:"beatHueStep,omitempty"`
	PeakBandToHue    *uint8 `json:"peakBandToHue,omitempty"`
	// Color bursts overlay + beat-randomized reverse/mirror
	BurstEnable   *uint8 `json:"burstEnable,omitempty"`
	BurstRate     *uint8 `json:"burstRate,omitempty"`
	BurstSpectrum *uint8 `json:"burstSpectrum,omitempty"`
	BurstZone     *uint8 `json:"burstZone,omitempty"`
	BurstDepth     *uint8 `json:"burstDepth,omitempty"`
	BurstTail      *uint8 `json:"burstTail,omitempty"`
	BurstSection   *uint8 `json:"burstSection,omitempty"`
	BurstDropAware *uint8 `json:"burstDropAware,omitempty"`
	RandomizeFlip *uint8 `json:"randomizeFlip,omitempty"`
	RandomizeRate *uint8 `json:"randomizeRate,omitempty"`
	// Music Mode 2.0
	DriftBeatSync *uint8 `json:"driftBeatSync,omitempty"`
	ComfortMode   *uint8 `json:"comfortMode,omitempty"`
}

// TuningUpdateResult is the response for tuning PATCH/reset endpoints.
type TuningUpdateResult struct {
	Applied          bool                `json:"applied"`
	QueuedToFirmware bool                `json:"queuedToFirmware"`
	Reason           string              `json:"reason,omitempty"`
	Config           FirmwareMusicConfig `json:"config"`
}

// defaultFirmwareMusicConfig returns factory defaults matching firmware hardcodes.
func defaultFirmwareMusicConfig() FirmwareMusicConfig {
	return FirmwareMusicConfig{
		AttackAlpha:        0.7,
		DecayAlpha:         0.25,
		StalenessMs:        500,
		NoiseFloor:         8,
		SpectrumBeatBoost:  60,
		SpectrumGamma:      0.5,
		PulseAmbientDiv:    6,
		PulseRippleDelays:  [8]uint8{4, 2, 2, 0, 0, 0, 2, 4},
		PulseColorShiftDiv: 50,
		PulseMinFlash:      128,
		// Burst overlay: burstZone defaults to 128 (whole desk even) and randomizeRate to 255
		// (every beat = legacy flip cadence); burstEnable/randomizeFlip default 0 keep the
		// classic look until enabled. randomizeRate only takes effect once randomizeFlip is on.
		BurstZone:     128,
		BurstDepth:    255,
		BurstTail:     128,
		RandomizeRate: 255,
		// Music Mode 2.0: comfort flash floor ships ON (photosensitivity default);
		// driftBeatSync stays 0 (classic per-ms drift) until the user opts in.
		ComfortMode: 1,
	}
}

// applyPatch merges non-nil fields from patch into config.
func (c *FirmwareMusicConfig) applyPatch(p FirmwareMusicConfigPatch) {
	if p.AttackAlpha != nil {
		c.AttackAlpha = *p.AttackAlpha
	}
	if p.DecayAlpha != nil {
		c.DecayAlpha = *p.DecayAlpha
	}
	if p.StalenessMs != nil {
		c.StalenessMs = *p.StalenessMs
	}
	if p.NoiseFloor != nil {
		c.NoiseFloor = *p.NoiseFloor
	}
	if p.SpectrumBeatBoost != nil {
		c.SpectrumBeatBoost = *p.SpectrumBeatBoost
	}
	if p.SpectrumGamma != nil {
		c.SpectrumGamma = *p.SpectrumGamma
	}
	if p.PulseAmbientDiv != nil {
		c.PulseAmbientDiv = *p.PulseAmbientDiv
	}
	if len(p.PulseRippleDelays) > 0 {
		n := len(p.PulseRippleDelays)
		if n > 8 {
			n = 8
		}
		for i := 0; i < n; i++ {
			c.PulseRippleDelays[i] = p.PulseRippleDelays[i]
		}
	}
	if p.PulseColorShiftDiv != nil {
		c.PulseColorShiftDiv = *p.PulseColorShiftDiv
	}
	if p.PulseMinFlash != nil {
		c.PulseMinFlash = *p.PulseMinFlash
	}
	if p.ColorMotionSpeed != nil {
		c.ColorMotionSpeed = *p.ColorMotionSpeed
	}
	if p.ColorSpread != nil {
		c.ColorSpread = *p.ColorSpread
	}
	if p.EnergyToMotion != nil {
		c.EnergyToMotion = *p.EnergyToMotion
	}
	if p.BeatHueStep != nil {
		c.BeatHueStep = *p.BeatHueStep
	}
	if p.PeakBandToHue != nil {
		c.PeakBandToHue = *p.PeakBandToHue
	}
	if p.BurstEnable != nil {
		c.BurstEnable = *p.BurstEnable
	}
	if p.BurstRate != nil {
		c.BurstRate = *p.BurstRate
	}
	if p.BurstSpectrum != nil {
		c.BurstSpectrum = *p.BurstSpectrum
	}
	if p.BurstZone != nil {
		c.BurstZone = *p.BurstZone
	}
	if p.BurstDepth != nil {
		c.BurstDepth = *p.BurstDepth
	}
	if p.BurstTail != nil {
		c.BurstTail = *p.BurstTail
	}
	if p.BurstSection != nil {
		c.BurstSection = *p.BurstSection
	}
	if p.BurstDropAware != nil {
		c.BurstDropAware = *p.BurstDropAware
	}
	if p.RandomizeFlip != nil {
		c.RandomizeFlip = *p.RandomizeFlip
	}
	if p.RandomizeRate != nil {
		c.RandomizeRate = *p.RandomizeRate
	}
	if p.DriftBeatSync != nil {
		c.DriftBeatSync = *p.DriftBeatSync
	}
	if p.ComfortMode != nil {
		c.ComfortMode = *p.ComfortMode
	}
}

// validate rejects out-of-bounds values with descriptive error.
func (p FirmwareMusicConfigPatch) validate() error {
	if p.AttackAlpha != nil && (*p.AttackAlpha < 0.0 || *p.AttackAlpha > 1.0) {
		return fmt.Errorf("%w: attackAlpha %.2f out of range (0.0-1.0)", ErrMusicModeValidation, *p.AttackAlpha)
	}
	if p.DecayAlpha != nil && (*p.DecayAlpha < 0.0 || *p.DecayAlpha > 1.0) {
		return fmt.Errorf("%w: decayAlpha %.2f out of range (0.0-1.0)", ErrMusicModeValidation, *p.DecayAlpha)
	}
	if p.StalenessMs != nil && (*p.StalenessMs < 100 || *p.StalenessMs > 5000) {
		return fmt.Errorf("%w: stalenessMs %d out of range (100-5000)", ErrMusicModeValidation, *p.StalenessMs)
	}
	if p.NoiseFloor != nil && *p.NoiseFloor > 50 {
		return fmt.Errorf("%w: noiseFloor %d out of range (0-50)", ErrMusicModeValidation, *p.NoiseFloor)
	}
	if p.SpectrumBeatBoost != nil && *p.SpectrumBeatBoost > 128 {
		return fmt.Errorf("%w: spectrumBeatBoost %d out of range (0-128)", ErrMusicModeValidation, *p.SpectrumBeatBoost)
	}
	if p.SpectrumGamma != nil && (*p.SpectrumGamma < 0.1 || *p.SpectrumGamma > 2.0) {
		return fmt.Errorf("%w: spectrumGamma %.2f out of range (0.1-2.0)", ErrMusicModeValidation, *p.SpectrumGamma)
	}
	if p.PulseAmbientDiv != nil && (*p.PulseAmbientDiv < 1 || *p.PulseAmbientDiv > 20) {
		return fmt.Errorf("%w: pulseAmbientDiv %d out of range (1-20)", ErrMusicModeValidation, *p.PulseAmbientDiv)
	}
	if len(p.PulseRippleDelays) > 8 {
		return fmt.Errorf("%w: pulseRippleDelays has %d elements (max 8)", ErrMusicModeValidation, len(p.PulseRippleDelays))
	}
	for i, v := range p.PulseRippleDelays {
		if v > 10 {
			return fmt.Errorf("%w: pulseRippleDelays[%d] = %d out of range (0-10)", ErrMusicModeValidation, i, v)
		}
	}
	if p.PulseColorShiftDiv != nil && *p.PulseColorShiftDiv < 1 {
		return fmt.Errorf("%w: pulseColorShiftDiv %d out of range (1-255)", ErrMusicModeValidation, *p.PulseColorShiftDiv)
	}
	// Color bursts / randomize: burstRate/Spectrum/Zone are full uint8 (0-255, type-bounded);
	// burstEnable and randomizeFlip are booleans encoded as 0/1.
	if p.BurstEnable != nil && *p.BurstEnable > 1 {
		return fmt.Errorf("%w: burstEnable %d out of range (0-1)", ErrMusicModeValidation, *p.BurstEnable)
	}
	if p.BurstDropAware != nil && *p.BurstDropAware > 1 {
		return fmt.Errorf("%w: burstDropAware %d out of range (0-1)", ErrMusicModeValidation, *p.BurstDropAware)
	}
	if p.RandomizeFlip != nil && *p.RandomizeFlip > 1 {
		return fmt.Errorf("%w: randomizeFlip %d out of range (0-1)", ErrMusicModeValidation, *p.RandomizeFlip)
	}
	if p.DriftBeatSync != nil && *p.DriftBeatSync > 1 {
		return fmt.Errorf("%w: driftBeatSync %d out of range (0-1)", ErrMusicModeValidation, *p.DriftBeatSync)
	}
	if p.ComfortMode != nil && *p.ComfortMode > 1 {
		return fmt.Errorf("%w: comfortMode %d out of range (0-1)", ErrMusicModeValidation, *p.ComfortMode)
	}
	return nil
}

// NewMusicModeService creates a new music mode service instance
func NewMusicModeService(writeGate *LEDWriteGate, ergoLEDClient *ErgoLEDClient, settingsRepo SettingsGetter, scriptPath string) *MusicModeService {
	ctx, cancel := context.WithCancel(context.Background())
	m := &MusicModeService{
		writeGate:         writeGate,
		ergoLEDClient:        ergoLEDClient,
		settingsRepo:      settingsRepo,
		scriptPath:        scriptPath,
		sensitivity:       1.0,
		speed:             128,
		intensity:         0, // Per-effect default applied in makeSegmentPayloads
		brightness:        255,
		desiredConfig:     defaultFirmwareMusicConfig(),
		activeConfig:      defaultFirmwareMusicConfig(),
		fwConfigSupported: true,
		configCh:          make(chan FirmwareMusicConfig, 1),
		configCtx:         ctx,
		configCancel:      cancel,
		djRec:             newDJRecorder(),
	}

	// Start coalescing sender goroutine
	m.configWg.Add(1)
	go m.configCoalescer()

	return m
}

// SetAutomationService injects the automation service reference (avoids circular init).
func (m *MusicModeService) SetAutomationService(as *LEDAutomationService) {
	m.automationService = as
}

// SetLedPayloadSaver sets the callback for persisting LED payload to the database.
func (m *MusicModeService) SetLedPayloadSaver(saver LedPayloadSaver) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ledPayloadSaver = saver
}

// SetResumeConfigSaver / SetResumeConfigClearer wire the durable music-intent
// persistence callbacks (from main.go, over the user settings repo).
func (m *MusicModeService) SetResumeConfigSaver(saver ResumeConfigSaver) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resumeConfigSaver = saver
}

func (m *MusicModeService) SetResumeConfigClearer(clearer ResumeConfigClearer) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resumeConfigClearer = clearer
}

// captureResumeIntentToken snapshots the current {sessionGen,intentGen} at the
// start of a save operation.
func (m *MusicModeService) captureResumeIntentToken() resumeIntentToken {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return resumeIntentToken{sessionGen: m.sessionGen, intentGen: m.intentGen}
}

// saveResumeIntent persists the durable music intent, serialized against
// EndResumeIntent and gated on the captured token still being current. Non-fatal.
func (m *MusicModeService) saveResumeIntent(userID int, payload json.RawMessage, tok resumeIntentToken) {
	if userID <= 0 || len(payload) == 0 {
		return
	}
	m.resumeIntentMu.Lock()
	defer m.resumeIntentMu.Unlock()
	m.mu.RLock()
	stale := m.sessionGen != tok.sessionGen || m.intentGen != tok.intentGen
	saver := m.resumeConfigSaver
	m.mu.RUnlock()
	if stale || saver == nil {
		return
	}
	if err := saver(userID, payload); err != nil {
		log.Printf("[MUSIC-MODE] resume-intent save failed (non-fatal): %v", err)
	}
}

// EndResumeIntent bumps the intent generation (so any in-flight save holding an
// older token loses) and clears the persisted resume config. Serialized against
// saves via resumeIntentMu. Called by routes after a successful manual/static
// replacement action (explicit deactivate, manual color/effect/preset, timeline,
// master-toggle disable). Idempotent.
func (m *MusicModeService) EndResumeIntent(userID int) {
	if userID <= 0 {
		return
	}
	m.resumeIntentMu.Lock()
	defer m.resumeIntentMu.Unlock()
	m.mu.Lock()
	m.intentGen++
	clearer := m.resumeConfigClearer
	m.mu.Unlock()
	if clearer != nil {
		if err := clearer(userID); err != nil {
			log.Printf("[MUSIC-MODE] resume-intent clear failed (non-fatal): %v", err)
		}
	}
}

// persistResumeIntent snapshots the current active config and durably persists it
// as the music resume intent. The session re-check is GetResumeConfig (nil if the
// session was deactivated/replaced), and the captured token gates the write so a
// reactivation or an explicit EndResumeIntent supersedes it. Must be called with
// m.mu NOT held (it acquires locks internally). Non-fatal.
func (m *MusicModeService) persistResumeIntent(userID int) {
	tok := m.captureResumeIntentToken()
	cfg := m.GetResumeConfig(userID) // re-check: nil if no longer the active owner
	if cfg == nil {
		return
	}
	payload, err := json.Marshal(cfg)
	if err != nil {
		log.Printf("[MUSIC-MODE] resume-intent marshal failed (non-fatal): %v", err)
		return
	}
	m.saveResumeIntent(userID, payload, tok)
}

// persistRestoredPayload writes the pre-music LED state back to led_last_payload in the DB.
// Called synchronously after SendRaw restores state to ErgoLED hardware, outside the mutex.
// Must be called AFTER the mutex is released (network + DB I/O).
func (m *MusicModeService) persistRestoredPayload(userID int, payload json.RawMessage) {
	m.mu.RLock()
	saver := m.ledPayloadSaver
	m.mu.RUnlock()

	if saver == nil || len(payload) == 0 || userID <= 0 {
		return
	}
	if err := saver(userID, payload); err != nil {
		log.Printf("[MUSIC-MODE] Failed to persist restored LED state to DB: %v", err)
	} else {
		log.Printf("[MUSIC-MODE] Persisted restored LED state to DB (%d bytes) for user %d", len(payload), userID)
	}
}

// SanitizeMusicFXPayload strips music-reactive FX (28-33, 37-40) from a ErgoLED JSON
// payload, replacing them with FX 0 (solid). Handles both per-segment seg[].fx and
// top-level fx keys. Returns the sanitized payload, or the original on parse/marshal error.
func SanitizeMusicFXPayload(payload json.RawMessage) json.RawMessage {
	if len(payload) == 0 {
		return payload
	}
	var m map[string]interface{}
	if err := json.Unmarshal(payload, &m); err != nil {
		return payload
	}
	modified := false
	// Sanitize top-level fx key (mixed payload shapes)
	if fx, ok := m["fx"].(float64); ok {
		if IsMusicFxID(int(fx)) {
			m["fx"] = float64(0)
			modified = true
		}
	}
	// Sanitize per-segment fx keys
	if segs, ok := m["seg"].([]interface{}); ok {
		for _, seg := range segs {
			if segMap, ok := seg.(map[string]interface{}); ok {
				if fx, ok := segMap["fx"].(float64); ok {
					if IsMusicFxID(int(fx)) {
						segMap["fx"] = float64(0)
						modified = true
					}
				}
			}
		}
	}
	if !modified {
		return payload
	}
	result, err := json.Marshal(m)
	if err != nil {
		return payload
	}
	return result
}

// MusicLookUpalRef is the music-wide user palette a whole look names — a preset's music
// section, a favourite. A look that names none has none ("", which clears one that is
// running), because applying a look replaces the palette with the look's.
func MusicLookUpalRef(musicConfig map[string]interface{}) *string {
	v, _ := musicConfig["upal_ref"].(string)
	return &v
}

// ActivateOpts holds optional parameters for Activate (backward compatible).
type ActivateOpts struct {
	// UpalRef is the music-wide user palette (see MusicConfigUpdate.UpalRef). Activation
	// paths that describe a whole look — a preset, a resume — pass it, "" included.
	UpalRef           *string
	Speed             *int
	Intensity         *int
	Reverse           *bool
	Mirror            *bool
	SmoothTransitions *bool
	SegmentConfigs    []MusicSegmentConfig
	Transition        *int            // ErgoLED transition in 100ms units; nil = instant (0)
	SavedLedState     json.RawMessage // Pre-music state override (skips FetchState); used by power-cycle resume
	// #15: full firmware tuning to restore on a power-cycle/login resume (spectrum
	// tuning + color dynamics + color bursts). nil = keep the current/default
	// desiredConfig. Applied before Step 3b so it ships with the activation.
	FirmwareTuning *FirmwareMusicConfig
	// Auto DJ program to start once activation passes the readiness guard
	// ("" = off). Used by the login/power-on resume paths.
	AutoDJProgram string

	// SystemInitiated marks a re-activation the SYSTEM performed — a login
	// restore, a power-on resume — as opposed to a person choosing a look.
	//
	// It matters because Activate on an already-active session routes into
	// UpdateConfigPartial, whose whole contract is "a manual visualization or
	// palette choice while Auto DJ is conducting takes the wheel back". A resume
	// always carries the saved VisualMode and PaletteID, so every restore looked
	// exactly like a manual pick and silently disabled the running show — while
	// the app went on displaying Auto DJ as ON, because nothing told it otherwise.
	// Observed live: a login at 22:01:03 and "Conductor stopped for user 26" in
	// the same second, after which the looks never rotated again.
	//
	// Restoring the state a user already had is the OPPOSITE of overriding it.
	SystemInitiated bool
}

// Activate starts music mode for the specified user.
// opts may be nil for backward compatibility (uses defaults).
func (m *MusicModeService) Activate(userID int, source string, sensitivity float64, visualMode int, paletteID int, opts ...ActivateOpts) error {
	// Restore this user's persisted light-to-sound sync offset BEFORE any
	// locking (DB round-trip); its internal ownership guard makes it a no-op
	// when someone else's session is running.
	m.restoreSyncOffsetForUser(userID)

	m.mu.Lock()
	// NO defer m.mu.Unlock() — lock managed explicitly for I/O-outside-lock paths

	if m.active || m.activating {
		if m.active && m.userID == userID {
			// Same user — apply parameters via UpdateConfig (idempotent)
			log.Printf("[MUSIC-MODE] Already active for user %d, updating config", userID)
			m.mu.Unlock()
			update := MusicConfigUpdate{
				Source:        &source,
				Sensitivity:   &sensitivity,
				Visualization: &visualMode,
				PaletteID:     &paletteID,
			}
			if len(opts) > 0 {
				update.UpalRef = opts[0].UpalRef
				update.Speed = opts[0].Speed
				update.Intensity = opts[0].Intensity
				update.Reverse = opts[0].Reverse
				update.Mirror = opts[0].Mirror
				update.SmoothTransitions = opts[0].SmoothTransitions
				update.SegmentConfigs = opts[0].SegmentConfigs
			}
			// A system resume re-applies what was already running, so it must NOT be
			// read as the user taking the wheel back from Auto DJ. applyConfigPartial is
			// the same write without the manual-override check — it is what the Auto DJ
			// conductor itself uses, for exactly this reason.
			systemInitiated := len(opts) > 0 && opts[0].SystemInitiated
			apply := m.UpdateConfigPartial
			if systemInitiated {
				apply = m.applyConfigPartial
			}
			if err := apply(userID, update); err != nil {
				return fmt.Errorf("failed to update active session: %w", err)
			}
			return nil
		}
		// Either another user owns the session, or an activation is mid-flight
		// (activating=true): a second Activate must conflict, not interleave
		// with the half-claimed state in the unlock-around-I/O windows below.
		uid := m.userID
		m.mu.Unlock()
		return fmt.Errorf("%w: active for user %d", ErrMusicModeConflict, uid)
	}

	// Validate parameters (sentinel-wrapped for 400 mapping).
	//
	// Delegated to ValidateMusicConfig so a caller can run the SAME rules before it writes
	// anything. The preset route needs exactly that: its fresh-activation path sends a generic
	// ErgoLED payload to seed FetchState before Activate runs, so validating only here meant an
	// invalid preset repainted the strip and only then failed.
	if err := ValidateMusicConfig(source, sensitivity, visualMode, paletteID); err != nil {
		m.mu.Unlock()
		return err
	}
	if len(opts) > 0 {
		if err := validateMusicSegmentConfigs(opts[0].SegmentConfigs); err != nil {
			m.mu.Unlock()
			return err
		}
	}

	// Apply optional fields from opts
	speed := 128
	intensity := defaultIx[visualMode]
	reverse := false
	mirror := false
	smoothTransitions := true
	resumeDJProgram := ""
	upalRef := ""
	var segConfigs []MusicSegmentConfig
	if len(opts) > 0 {
		resumeDJProgram = opts[0].AutoDJProgram
		if opts[0].UpalRef != nil {
			upalRef = *opts[0].UpalRef
		}
		if opts[0].Speed != nil {
			speed = *opts[0].Speed
		}
		if opts[0].Intensity != nil {
			intensity = *opts[0].Intensity
		}
		if opts[0].Reverse != nil {
			reverse = *opts[0].Reverse
		}
		if opts[0].Mirror != nil {
			mirror = *opts[0].Mirror
		}
		if opts[0].SmoothTransitions != nil {
			smoothTransitions = *opts[0].SmoothTransitions
		}
		segConfigs = opts[0].SegmentConfigs
		// #15: restore the full firmware tuning (spectrum tuning / color dynamics /
		// color bursts) captured at logout. Set under the held m.mu and BEFORE
		// Step 3b's sendActiveConfigSnapshot (which freezes desiredConfig→active and
		// ships it), so the resumed session comes up with the user's tuning instead
		// of the factory default. nil (legacy configs / non-resume activations) is a
		// no-op, preserving current behavior.
		if opts[0].FirmwareTuning != nil {
			m.desiredConfig = *opts[0].FirmwareTuning
		}
	}

	log.Printf("[MUSIC-MODE] Activating for user %d (source=%s, sensitivity=%.2f, mode=%d, palette=%d, speed=%d, intensity=%d)",
		userID, source, sensitivity, visualMode, paletteID, speed, intensity)

	// Claim the activation slot for the unlock-around-I/O windows below: the
	// top-of-function guard treats activating like active, so no sibling
	// Activate can interleave with the half-claimed state (gate entered,
	// userID set, active still false). Cleared on every exit path via defer —
	// safe because every return below releases m.mu first.
	m.activating = true
	defer func() {
		m.mu.Lock()
		m.activating = false
		m.mu.Unlock()
	}()

	// Step 1: Save current ErgoLED state for restore on deactivation
	log.Printf("[MUSIC-MODE] Step 1: Saving current ErgoLED state...")

	// Reset brightness/colors to defaults BEFORE parsing — prevents stale
	// prior-session data leaking through when FetchState() fails (activation
	// continues after fetch failure).
	m.brightness = 255
	m.segmentColors = nil

	var savedState json.RawMessage
	if len(opts) > 0 && len(opts[0].SavedLedState) > 0 {
		// Caller provided pre-music state (power-cycle resume path) — safe copy
		savedState = append(json.RawMessage(nil), opts[0].SavedLedState...)
		log.Printf("[MUSIC-MODE] Using provided pre-music state (%d bytes)", len(savedState))
	} else {
		// FetchState is a ErgoLED HTTP GET (1s timeout) and touches no m fields —
		// run it off the lock so GetMetrics (firmware 20Hz poll), GetStatus and
		// Deactivate aren't stalled behind a slow/unreachable device. The
		// activating flag keeps sibling Activates out of this window.
		m.mu.Unlock()
		fetched, err := m.ergoLEDClient.FetchState()
		m.mu.Lock()
		if err != nil {
			log.Printf("[MUSIC-MODE] Failed to save current LED state: %v", err)
			// Continue anyway - restore will be skipped on deactivation
		}
		savedState = fetched
	}
	if len(savedState) > 0 {
		m.savedLedState = append(json.RawMessage(nil), savedState...) // safe copy
		log.Printf("[MUSIC-MODE] Saved LED state (%d bytes) for restore", len(savedState))

		// Extract brightness and per-segment colors from the saved state
		var parsed struct {
			Bri *int `json:"bri"` // pointer: bri=0 is valid (LEDs off)
			Seg []struct {
				Col json.RawMessage `json:"col"`
			} `json:"seg"`
		}
		if parseErr := json.Unmarshal(savedState, &parsed); parseErr == nil {
			if parsed.Bri != nil {
				m.brightness = *parsed.Bri
			}
			if len(parsed.Seg) > 0 {
				m.segmentColors = make([]json.RawMessage, len(parsed.Seg))
				for i, seg := range parsed.Seg {
					m.segmentColors[i] = seg.Col
				}
				log.Printf("[MUSIC-MODE] Extracted bri=%d, %d segment colors from saved state", m.brightness, len(parsed.Seg))
			}
		}
	}

	// Step 2: Enter write gate with music priority
	log.Printf("[MUSIC-MODE] Step 2: Entering write gate...")
	if !m.writeGate.EnterMode(userID, PriorityMusic, "music_mode") {
		m.mu.Unlock()
		return fmt.Errorf("failed to enter music mode (write gate rejected)")
	}
	m.userID = userID // Set IMMEDIATELY — watcher needs this even before active=true

	// Step 3: Send ErgoLED payload to activate music visualization FIRST
	log.Printf("[MUSIC-MODE] Step 3: Sending ErgoLED music payload...")
	activateTransition := 0
	if len(opts) > 0 && opts[0].Transition != nil {
		activateTransition = *opts[0].Transition
		if activateTransition < 0 {
			activateTransition = 0
		}
		if activateTransition > 255 {
			activateTransition = 255
		}
	}
	// ErgoLED HTTP POST off the lock (activating flag keeps sibling Activates
	// out; Deactivate no-ops while active is still false). sendMusicPayload
	// touches the immutable m.ergoLEDClient, and after a successful send takes
	// m.mu briefly to note the render, so it must be called with m.mu released.
	briSnap := m.brightness
	colSnap := m.segmentColors
	m.mu.Unlock()
	sendErr := m.sendMusicPayload(userID, visualMode, paletteID, upalRef, speed, intensity, reverse, mirror, activateTransition, segConfigs, briSnap, colSnap)
	m.mu.Lock()
	if sendErr != nil {
		m.userID = 0
		m.brightness = 255
		m.segmentColors = nil
		m.writeGate.ExitMode(userID, "music_mode")
		m.mu.Unlock()
		return fmt.Errorf("failed to activate ErgoLED music mode: %w", sendErr)
	}

	// Step 3b: Freeze desired config → active, re-probe firmware support, send (non-fatal)
	log.Printf("[MUSIC-MODE] Step 3b: Sending firmware tuning config...")
	if sent, _ := m.sendActiveConfigSnapshot(); !sent {
		log.Printf("[MUSIC-MODE] Firmware config not sent (endpoint unsupported or error)")
	}

	// Step 4: Start Python audio analysis subprocess AFTER ErgoLED is configured
	log.Printf("[MUSIC-MODE] Step 4: Starting Python subprocess...")
	if err := m.startPythonProcess(source, sensitivity); err != nil {
		// ROLLBACK: ErgoLED already switched to music FX — must restore
		rollbackState := m.savedLedState
		m.savedLedState = nil
		m.userID = 0
		m.brightness = 255
		m.segmentColors = nil
		m.writeGate.ExitMode(userID, "music_mode")
		m.mu.Unlock()

		// Network I/O outside lock
		restored := false
		if len(rollbackState) > 0 {
			log.Printf("[MUSIC-MODE] Rolling back ErgoLED state after Python start failure...")
			if _, restoreErr := m.ergoLEDClient.SendRaw(json.RawMessage(commands.MarkPersonLook(rollbackState)), userID, PriorityMusic); restoreErr != nil {
				log.Printf("[MUSIC-MODE] Rollback restore failed: %v", restoreErr)
			} else {
				restored = true
				m.persistRestoredPayload(userID, rollbackState)
			}
		}
		// Automation fallback if restore absent or failed
		if !restored && m.automationService != nil {
			go func() {
				time.Sleep(100 * time.Millisecond)
				m.automationService.ReapplyCurrentState(userID)
			}()
		}

		return fmt.Errorf("failed to start audio analysis: %w", err)
	}

	// Verify process didn't die instantly (watcher may have already cleaned up)
	if m.pythonCmd == nil {
		// Watcher already cleaned up: gate released, LEDs restored, userID zeroed
		m.mu.Unlock()
		return fmt.Errorf("Python process exited immediately after start")
	}

	// Step 4b: Initialize UDP sender for low-latency firmware push (non-fatal)
	if err := m.initUDPSender(); err != nil {
		log.Printf("[MUSIC-MODE-UDP] Init failed (HTTP fallback active): %v", err)
	}

	// Step 5: Update remaining state
	m.active = true
	m.sessionGen++ // Workstream B: new activation generation (durable-intent staleness)
	m.source = source
	m.sensitivity = sensitivity
	m.visualMode = visualMode
	m.paletteID = paletteID
	m.upalRef = upalRef
	m.speed = speed
	m.intensity = intensity
	m.reverse = reverse
	m.mirror = mirror
	m.smoothTransitions = smoothTransitions
	m.segmentConfigs = segConfigs

	// Capture under lock for readiness guard
	done := m.pythonDone
	baseline := m.metricsCount // cumulative — not reset on deactivate

	log.Printf("[MUSIC-MODE] Step 5: Activation complete for user %d, waiting for readiness...", userID)
	m.mu.Unlock()

	// Step 6: Readiness guard — confirm Python is alive and posting metrics
	readinessDeadline := time.After(3 * time.Second)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			// Python died during startup — watcher goroutine handles cleanup
			log.Printf("[MUSIC-MODE] Python exited during readiness check")
			return fmt.Errorf("audio analysis process exited during startup")
		case <-readinessDeadline:
			// Timeout — Python alive but no metrics. Fail activation and rollback.
			log.Printf("[MUSIC-MODE] Readiness timeout: no metrics in 3s, deactivating")
			if deactErr := m.Deactivate(userID); deactErr != nil {
				log.Printf("[MUSIC-MODE] Rollback deactivation error: %v", deactErr)
				return fmt.Errorf("audio analysis: no metrics within readiness window (rollback failed: %w)", deactErr)
			}
			return fmt.Errorf("audio analysis: no metrics received within readiness window")
		case <-ticker.C:
			m.mu.RLock()
			count := m.metricsCount
			m.mu.RUnlock()
			if count > baseline {
				log.Printf("[MUSIC-MODE] Step 6: Readiness confirmed (first metrics received)")
				m.mu.RLock()
				log.Printf("[MUSIC-MODE] Firmware will see: bands=%v vol=%d energy=%d beat=%d",
					m.metrics.Bands, m.metrics.Volume, m.metrics.Energy, m.metrics.Beat)
				m.mu.RUnlock()
				// Auto DJ resume: the conductor only starts once the session is
				// provably alive (readiness passed). Non-fatal — a failed start
				// leaves a normal manual music session.
				if resumeDJProgram != "" {
					if djErr := m.SetAutoDJ(userID, true, resumeDJProgram); djErr != nil {
						log.Printf("[MUSIC-DJ] Resume start failed (non-fatal): %v", djErr)
					}
				}
				// Workstream B: activation fully passed the readiness guard — persist
				// the durable resume intent so an abrupt restart can re-activate. A
				// concurrent deactivate makes GetResumeConfig nil → skip.
				m.persistResumeIntent(userID)
				return nil
			}
		}
	}
}

// Deactivate stops music mode and restores previous LED state
func (m *MusicModeService) Deactivate(userID int) error {
	m.mu.Lock()

	if !m.active {
		m.mu.Unlock()
		log.Printf("[MUSIC-MODE] Deactivate called but not active (idempotent no-op)")
		return nil
	}
	if m.userID != userID {
		m.mu.Unlock()
		return fmt.Errorf("%w: active for user %d, requested by %d", ErrMusicModeConflict, m.userID, userID)
	}

	log.Printf("[MUSIC-MODE] Deactivating for user %d", userID)

	// Set stopping flag so watcher skips crash-cleanup
	m.stopping = true
	// Snapshot fields needed after unlock
	savedState := m.savedLedState
	done := m.pythonDone

	m.mu.Unlock() // RELEASE BEFORE blocking on process stop

	// Close UDP sender before stopping Python (no more metrics to push)
	m.stopAutoDJInternal()
	m.closeUDPSender()

	// Stop Python process (signals + waits on done channel, NO lock held)
	m.stopPythonProcess(done)

	// Restore saved LED state (primary path — always attempt exact restore).
	// ErgoLED HTTP runs in this already-unlocked window: while the device is
	// slow/unreachable (1s timeout) the firmware's 20Hz GetMetrics poll and
	// GetStatus must not stall behind the restore. The write gate is still
	// entered, so the PriorityMusic send passes CanSend.
	restored := false
	if len(savedState) > 0 {
		_, err := m.ergoLEDClient.SendRaw(json.RawMessage(commands.MarkPersonLook(savedState)), userID, PriorityMusic)
		if err != nil {
			log.Printf("[MUSIC-MODE] Failed to restore LED state: %v", err)
		} else {
			log.Printf("[MUSIC-MODE] Restored LED state (%d bytes)", len(savedState))
			restored = true
		}
	}

	// Re-acquire lock for state cleanup
	m.mu.Lock()

	// Exit write gate BEFORE automation fallback (so automation can send)
	m.writeGate.ExitMode(userID, "music_mode")

	// Clear state
	m.active = false
	m.userID = 0
	m.stopping = false
	m.savedLedState = nil
	m.pythonCmd = nil
	m.pythonCancel = nil
	m.pythonDone = nil
	m.pythonStdin = nil
	m.metrics = AudioMetrics{}
	m.segmentConfigs = nil
	m.brightness = 255
	m.segmentColors = nil

	m.mu.Unlock()

	// Persist restored payload synchronously — blocks until DB write completes.
	// Must complete before Deactivate() returns to prevent race with fast re-login.
	if restored {
		m.persistRestoredPayload(userID, savedState)
	}

	// Fallback: automation reapply if restore was absent or failed (outside lock)
	if !restored && m.automationService != nil {
		go func() {
			time.Sleep(100 * time.Millisecond)
			m.automationService.ReapplyCurrentState(userID)
		}()
	}

	log.Printf("[MUSIC-MODE] Deactivated for user %d", userID)
	return nil
}

// DeactivateWithoutRestore stops music mode without restoring the saved LED state.
// Used by LED automation when a new preset is about to be applied immediately
// after deactivation — the restore would cause a brief visible flash.
func (m *MusicModeService) DeactivateWithoutRestore(userID int) error {
	m.mu.Lock()

	if !m.active {
		m.mu.Unlock()
		return nil
	}
	if m.userID != userID {
		m.mu.Unlock()
		return fmt.Errorf("%w: active for user %d, requested by %d", ErrMusicModeConflict, m.userID, userID)
	}

	log.Printf("[MUSIC-MODE] Deactivating (suppress restore) for user %d", userID)

	m.stopping = true
	done := m.pythonDone

	m.mu.Unlock()

	m.stopAutoDJInternal()
	m.closeUDPSender()
	m.stopPythonProcess(done)

	m.mu.Lock()
	// No SendRaw(savedState) — caller sends new payload immediately
	m.writeGate.ExitMode(userID, "music_mode")
	// Clear state (same as Deactivate)
	m.active = false
	m.userID = 0
	m.stopping = false
	m.savedLedState = nil
	m.pythonCmd = nil
	m.pythonCancel = nil
	m.pythonDone = nil
	m.pythonStdin = nil
	m.metrics = AudioMetrics{}
	m.segmentConfigs = nil
	m.brightness = 255
	m.segmentColors = nil
	m.mu.Unlock()

	// No automation fallback — caller applies preset
	log.Printf("[MUSIC-MODE] Deactivated (no restore) for user %d", userID)
	return nil
}

// DeactivateForPowerCycle stops music mode without restoring LED state to ErgoLED
// hardware, but persists the pre-music state to the DB. Used by the power-OFF
// handler when music resume is planned: ErgoLED keeps the music FX in memory so
// the next power-ON shows music FX immediately (no flash).
// No automation fallback — power-OFF path is "stop + persist only".
func (m *MusicModeService) DeactivateForPowerCycle(userID int) error {
	m.mu.Lock()
	if !m.active {
		m.mu.Unlock()
		return nil
	}
	if m.userID != userID {
		m.mu.Unlock()
		return fmt.Errorf("%w: active for user %d, requested by %d", ErrMusicModeConflict, m.userID, userID)
	}

	log.Printf("[MUSIC-MODE] Deactivating for power-cycle (suppress ErgoLED restore) for user %d", userID)

	m.stopping = true
	savedState := append(json.RawMessage(nil), m.savedLedState...) // safe copy
	done := m.pythonDone

	m.mu.Unlock()

	m.stopAutoDJInternal()
	m.closeUDPSender()
	m.stopPythonProcess(done)

	m.mu.Lock()
	// No SendRaw(savedState) — ErgoLED keeps music FX in memory
	m.writeGate.ExitMode(userID, "music_mode")
	m.active = false
	m.userID = 0
	m.stopping = false
	m.savedLedState = nil
	m.pythonCmd = nil
	m.pythonCancel = nil
	m.pythonDone = nil
	m.pythonStdin = nil
	m.metrics = AudioMetrics{}
	m.segmentConfigs = nil
	m.brightness = 255
	m.segmentColors = nil
	m.mu.Unlock()

	// Persist pre-music state to DB (needed by resume goroutine's SavedLedState)
	// No automation fallback (power-OFF = stop + persist only)
	if len(savedState) > 0 {
		m.persistRestoredPayload(userID, savedState)
	}

	log.Printf("[MUSIC-MODE] Deactivated for power-cycle (no ErgoLED restore) for user %d", userID)
	return nil
}

// UpdateConfig updates music mode configuration parameters (legacy signature for backward compat).
func (m *MusicModeService) UpdateConfig(userID int, source string, sensitivity float64, visualMode int, paletteID int) error {
	return m.UpdateConfigPartial(userID, MusicConfigUpdate{
		Source:        &source,
		Sensitivity:   &sensitivity,
		Visualization: &visualMode,
		PaletteID:     &paletteID,
	})
}

// UpdateConfigPartial applies a USER-initiated partial config update. A manual
// visualization/palette choice while Auto DJ is conducting takes the wheel
// back: the conductor is disabled first, then the change applies. The Auto DJ
// loop itself calls applyConfigPartial directly (no self-disable).
func (m *MusicModeService) UpdateConfigPartial(userID int, update MusicConfigUpdate) error {
	if update.Visualization != nil || update.PaletteID != nil {
		m.mu.RLock()
		manualOverride := m.djEnabled && m.active && m.userID == userID
		m.mu.RUnlock()
		if manualOverride {
			log.Printf("[MUSIC-DJ] Manual effect/palette change — user %d takes the wheel back", userID)
			if err := m.SetAutoDJ(userID, false, ""); err != nil {
				log.Printf("[MUSIC-DJ] Disable on manual override failed (non-fatal): %v", err)
			}
		}
	}
	return m.applyConfigPartial(userID, update)
}

// applyConfigPartial updates music mode with partial config (only non-nil fields change).
// Uses explicit lock management (no defer) to release before blocking I/O.
func (m *MusicModeService) applyConfigPartial(userID int, update MusicConfigUpdate) error {
	m.mu.Lock()
	// NO defer — explicit lock management

	if !m.active {
		m.mu.Unlock()
		return fmt.Errorf("music mode not active")
	}
	if m.userID != userID {
		m.mu.Unlock()
		return fmt.Errorf("%w: active for user %d", ErrMusicModeConflict, m.userID)
	}
	if err := validateMusicSegmentConfigs(update.SegmentConfigs); err != nil {
		m.mu.Unlock()
		return err
	}

	// Check if update is completely empty
	if update.Source == nil && update.Sensitivity == nil && update.Visualization == nil &&
		update.PaletteID == nil && update.UpalRef == nil && update.Speed == nil && update.Intensity == nil &&
		update.Reverse == nil && update.Mirror == nil && update.SmoothTransitions == nil &&
		len(update.SegmentConfigs) == 0 {
		m.mu.Unlock()
		return fmt.Errorf("%w: no configuration fields provided", ErrMusicModeValidation)
	}

	// Merge: start with current state, override with non-nil fields
	source := m.source
	sensitivity := m.sensitivity
	visualMode := m.visualMode
	paletteID := m.paletteID
	upalRef := m.upalRef
	speed := m.speed
	intensity := m.intensity
	reverse := m.reverse
	mirror := m.mirror
	smoothTransitions := m.smoothTransitions
	segConfigs := m.segmentConfigs
	briSnap := m.brightness
	colSnap := append([]json.RawMessage(nil), m.segmentColors...) // defensive copy

	if update.Source != nil {
		source = *update.Source
	}
	if update.Sensitivity != nil {
		sensitivity = *update.Sensitivity
	}
	if update.Visualization != nil {
		visualMode = *update.Visualization
	}
	if update.PaletteID != nil {
		paletteID = *update.PaletteID
	}
	if update.UpalRef != nil {
		upalRef = *update.UpalRef
	}
	if update.Speed != nil {
		speed = *update.Speed
	}
	if update.Intensity != nil {
		intensity = *update.Intensity
	}
	if update.Reverse != nil {
		reverse = *update.Reverse
	}
	if update.Mirror != nil {
		mirror = *update.Mirror
	}
	if update.SmoothTransitions != nil {
		smoothTransitions = *update.SmoothTransitions
	}
	if len(update.SegmentConfigs) > 0 {
		segConfigs = update.SegmentConfigs
	} else if len(m.pendingSegRestore) > 0 {
		// A DJ canvas restore that failed to land is still owed. Use the
		// user's canvas rather than m.segmentConfigs, which still holds what
		// the DJ generated.
		//
		// NOT cleared here: it is cleared where the write COMMITS, below. An
		// earlier version cleared it at this point and so discarded the queue
		// on exactly the path it exists for — a send that then fails.
		segConfigs = m.pendingSegRestore
	}

	// Parameter validation (sentinel-wrapped for 400 mapping)
	if source != "mic" && source != "system" && source != "both" {
		m.mu.Unlock()
		return fmt.Errorf("%w: invalid audio source: %s (must be 'mic', 'system', or 'both')", ErrMusicModeValidation, source)
	}
	if sensitivity < 0.5 || sensitivity > 2.0 {
		m.mu.Unlock()
		return fmt.Errorf("%w: sensitivity %.2f out of range (0.5-2.0)", ErrMusicModeValidation, sensitivity)
	}
	if visualMode < 0 || visualMode > 9 {
		m.mu.Unlock()
		return fmt.Errorf("%w: invalid visual mode: %d (must be 0-9)", ErrMusicModeValidation, visualMode)
	}
	if paletteID < 0 || paletteID > 21 {
		m.mu.Unlock()
		return fmt.Errorf("%w: palette %d out of range (0-21)", ErrMusicModeValidation, paletteID)
	}
	if speed < 0 || speed > 255 {
		m.mu.Unlock()
		return fmt.Errorf("%w: speed %d out of range (0-255)", ErrMusicModeValidation, speed)
	}
	if intensity < 0 || intensity > 255 {
		m.mu.Unlock()
		return fmt.Errorf("%w: intensity %d out of range (0-255)", ErrMusicModeValidation, intensity)
	}

	log.Printf("[MUSIC-MODE] Updating config (source=%s, sensitivity=%.2f, mode=%d, palette=%d, speed=%d, intensity=%d, rev=%v, mi=%v)",
		source, sensitivity, visualMode, paletteID, speed, intensity, reverse, mirror)

	// Restart the Python analyzer if the audio source OR the sensitivity changed.
	// Sensitivity is a spawn-time CLI arg (--sensitivity, applied pre-FFT in
	// music_analyzer.py for both band amplitude AND the beat-detection threshold),
	// so a live change only takes effect by re-spawning. Master Volume Control
	// (mig 184) note: a post-FFT Go gain was considered to avoid the brief restart
	// gap, but the analyzer already scales bands by sensitivity pre-FFT, so a Go
	// gain would double-count — restart is the correct, single-source fix. Callers
	// must debounce sensitivity changes (the Python restart carries a ~1s readiness
	// gap), which the music-mode UI already does.
	if source != m.source || sensitivity != m.sensitivity {
		if source != m.source {
			log.Printf("[MUSIC-MODE] Audio source changed: %s -> %s (restarting Python)", m.source, source)
		} else {
			log.Printf("[MUSIC-MODE] Sensitivity changed: %.2f -> %.2f (restarting Python)", m.sensitivity, sensitivity)
		}

		// Set stopping so old watcher skips crash-cleanup
		m.stopping = true
		done := m.pythonDone
		m.mu.Unlock()

		m.stopPythonProcess(done)

		m.mu.Lock()
		m.stopping = false

		// Re-check: concurrent Deactivate() may have completed during unlock window
		if !m.active || m.userID != userID {
			m.mu.Unlock()
			log.Printf("[MUSIC-MODE] Session ended during config update, aborting restart")
			return fmt.Errorf("music mode session ended during config update")
		}

		if err := m.startPythonProcess(source, sensitivity); err != nil {
			// Deterministic rollback: clear session, exit gate, restore LEDs
			log.Printf("[MUSIC-MODE] Python restart failed: %v — rolling back session", err)
			savedState := m.savedLedState
			m.writeGate.ExitMode(userID, "music_mode")
			m.active = false
			m.userID = 0
			m.savedLedState = nil
			m.pythonCmd = nil
			m.pythonCancel = nil
			m.pythonDone = nil
			m.pythonStdin = nil
			m.metrics = AudioMetrics{}
			m.segmentConfigs = nil
			m.brightness = 255
			m.segmentColors = nil
			m.mu.Unlock()

			// Session is gone — the Auto DJ conductor must not outlive it.
			m.stopAutoDJInternal()

			restored := false
			if len(savedState) > 0 {
				if _, restoreErr := m.ergoLEDClient.SendRaw(json.RawMessage(commands.MarkPersonLook(savedState)), userID, PriorityMusic); restoreErr != nil {
					log.Printf("[MUSIC-MODE] Restart rollback restore failed: %v", restoreErr)
				} else {
					restored = true
					m.persistRestoredPayload(userID, savedState)
				}
			}
			if !restored && m.automationService != nil {
				go func() {
					time.Sleep(100 * time.Millisecond)
					m.automationService.ReapplyCurrentState(userID)
				}()
			}
			return fmt.Errorf("failed to restart audio analysis (session rolled back): %w", err)
		}
		// COMMIT BOTH SPAWN-TIME VALUES HERE, not just source.
		//
		// m.source was already committed at this point and m.sensitivity was not — it was
		// assigned only at the very end of the function. Every early return in between (readiness
		// timeout, restarted-Python-exited, session-ended-during-readiness) therefore left
		// m.sensitivity holding the OLD value while a process was already running with the new
		// one. Since a sensitivity mismatch is precisely what triggers a restart, the next
		// identical request restarted again, and again: a failed restart preserved the condition
		// that caused it, which is a livelock, not a retry.
		//
		// Observed on the desk 2026-08-16 as 25 analyzer restarts logging the same
		// "Sensitivity changed: 1.80 -> 1.70" over and over, with 19 readiness failures among
		// them. It only became reachable when the preset route stopped tearing the session down
		// and started routing reapplies through here.
		//
		// The process IS running with these values, so recording them is the truth whether or not
		// readiness later confirms metrics.
		m.source = source
		m.sensitivity = sensitivity

		// Restart readiness — confirm new process is alive and posting metrics
		restartDone := m.pythonDone
		restartBaseline := m.metricsCount
		m.mu.Unlock()

		readinessDl := time.After(3 * time.Second)
		readinessTk := time.NewTicker(100 * time.Millisecond)
	restartReady:
		for {
			select {
			case <-restartDone:
				readinessTk.Stop()
				log.Printf("[MUSIC-MODE] Restarted Python exited during readiness check")
				return fmt.Errorf("restarted audio analysis process exited during readiness check")
			case <-readinessDl:
				readinessTk.Stop()
				log.Printf("[MUSIC-MODE] Restart readiness timeout, deactivating")
				if deactErr := m.Deactivate(userID); deactErr != nil {
					log.Printf("[MUSIC-MODE] Restart rollback deactivation error: %v", deactErr)
					return fmt.Errorf("restarted audio analysis: no metrics within readiness window (rollback failed: %w)", deactErr)
				}
				return fmt.Errorf("restarted audio analysis: no metrics within readiness window")
			case <-readinessTk.C:
				m.mu.RLock()
				count := m.metricsCount
				m.mu.RUnlock()
				if count > restartBaseline {
					readinessTk.Stop()
					log.Printf("[MUSIC-MODE] Restart readiness confirmed")
					break restartReady
				}
			}
		}

		m.mu.Lock()
		// Re-check session after readiness unlock window
		if !m.active || m.userID != userID {
			m.mu.Unlock()
			return fmt.Errorf("session ended during restart readiness check")
		}
	}

	// Reset intensity to per-effect default when visualization changes and
	// intensity wasn't explicitly set. Resolved BEFORE the ErgoLED send so the
	// payload carries the new effect's default — previously this ran after
	// sendMusicPayload, so the firmware briefly rendered the new effect with
	// the old effect's intensity while the service recorded the default.
	if visualMode != m.visualMode && update.Intensity == nil {
		intensity = defaultIx[visualMode]
	}

	// Determine transition value for ErgoLED payload
	needsErgoLEDUpdate := visualMode != m.visualMode || paletteID != m.paletteID || upalRef != m.upalRef ||
		speed != m.speed || intensity != m.intensity ||
		reverse != m.reverse || mirror != m.mirror ||
		len(update.SegmentConfigs) > 0

	if needsErgoLEDUpdate {
		// Choose transition based on change type
		transition := 0
		if smoothTransitions {
			if visualMode != m.visualMode {
				transition = 7 // 700ms crossfade for FX change
			} else {
				transition = 3 // 300ms blend for param-only change
			}
		}

		log.Printf("[MUSIC-MODE] Visual config changed (mode=%d, palette=%d, transition=%d)", visualMode, paletteID, transition)
		// ErgoLED HTTP off the lock (mirrors the restart-readiness window above):
		// the tuning-slider path must not freeze GetMetrics/GetStatus for the
		// 1s HTTP timeout when the device is slow. Session ownership is
		// re-checked after relocking, before the merged fields are committed.
		sendUserID := m.userID
		m.mu.Unlock()
		sendErr := m.sendMusicPayload(sendUserID, visualMode, paletteID, upalRef, speed, intensity, reverse, mirror, transition, segConfigs, briSnap, colSnap)
		m.mu.Lock()
		if sendErr != nil {
			m.mu.Unlock()
			return fmt.Errorf("failed to update ErgoLED: %w", sendErr)
		}
		if !m.active || m.userID != userID {
			m.mu.Unlock()
			return fmt.Errorf("music mode session ended during config update")
		}
	}

	m.visualMode = visualMode
	m.paletteID = paletteID
	m.upalRef = upalRef
	m.speed = speed
	m.intensity = intensity
	m.reverse = reverse
	m.mirror = mirror
	m.smoothTransitions = smoothTransitions
	m.segmentConfigs = segConfigs
	// The write landed, so whatever repaint was owed is now paid — by this
	// write if it consumed the queue, or superseded by it if it supplied its
	// own segments.
	m.pendingSegRestore = nil
	m.sensitivity = sensitivity
	log.Printf("[MUSIC-MODE] Config updated")
	m.mu.Unlock()

	// Workstream B2: keep the durable resume intent fresh so a restart restores the
	// updated viz/speed/palette — not a stale snapshot. The persist re-checks the
	// session (GetResumeConfig) so a deactivate during the send can't resurrect it.
	m.persistResumeIntent(userID)
	return nil
}

// musicMetricsInterval is the minimum spacing between music_metrics WS frames
// (~12Hz — enough for a live equalizer without flooding phone connections).
const musicMetricsInterval = 80 * time.Millisecond

// maxSyncOffsetMs bounds the light-to-sound sync delay (Bluetooth SBC worst
// case ~350ms; 500 leaves margin without letting a typo park the show seconds
// behind the music).
const maxSyncOffsetMs = 500

// delayedMetrics is one queued frame in the sync-offset delay line.
type delayedMetrics struct {
	m       AudioMetrics
	release time.Time
}

// SetMetricsTap registers (nil clears) a callback that receives EVERY analyzer frame as it arrives, before the sync-offset
// delay line and whether or not music mode is active. Game mode uses it to fold the game's audio into its frames while
// re-using the one analyser ingress (the same script, the same internal route); it changes nothing for music mode.
func (m *MusicModeService) SetMetricsTap(f func(AudioMetrics)) {
	if f == nil {
		m.metricsTap.Store(nil)
		return
	}
	m.metricsTap.Store(&f)
}

// UpdateMetrics is the analyzer-ingress entry point (called by the HTTP
// handler at ~100Hz). With no sync offset it processes the frame immediately;
// with one, frames queue and every ingress drains the due ones — the LEDs,
// telemetry and Auto DJ all see a timeline uniformly shifted to match the
// speaker's real-world delay.
func (m *MusicModeService) UpdateMetrics(metrics AudioMetrics) {
	if tap := m.metricsTap.Load(); tap != nil {
		(*tap)(metrics)
	}
	now := time.Now()
	m.mu.Lock()
	offset := m.syncOffsetMs
	if offset <= 0 && len(m.syncQ) == 0 {
		m.mu.Unlock() // fast path: no delay line active
		m.processMetrics(metrics, now)
		return
	}
	if offset > 0 {
		m.syncQ = append(m.syncQ, delayedMetrics{m: metrics, release: now.Add(time.Duration(offset) * time.Millisecond)})
	} else {
		// Offset was just zeroed — flush whatever is left immediately.
		m.syncQ = append(m.syncQ, delayedMetrics{m: metrics, release: now})
	}
	var due []AudioMetrics
	// offset <= 0 flushes the whole queue (the knob was just zeroed);
	// otherwise only frames whose release time has arrived.
	for len(m.syncQ) > 0 && (offset <= 0 || !now.Before(m.syncQ[0].release)) {
		due = append(due, m.syncQ[0].m)
		m.syncQ = m.syncQ[1:]
	}
	if len(m.syncQ) == 0 {
		m.syncQ = nil // release the drifting backing array
	}
	m.mu.Unlock()
	for _, d := range due {
		m.processMetrics(d, now)
	}
}

// SyncOffsetStore persists the per-user light-to-sound sync offset
// (user_settings.music_sync_offset_ms, migration 195). The offset is a
// GO-side delay line — not a firmware key — so without this it silently
// reset to 0 on every API restart.
type SyncOffsetStore interface {
	GetMusicSyncOffset(ctx context.Context, userID int) (int, error)
	SaveMusicSyncOffset(ctx context.Context, userID int, ms int) error
}

// SetSyncOffsetStore wires the sync-offset persistence (main.go).
func (m *MusicModeService) SetSyncOffsetStore(s SyncOffsetStore) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.syncOffsetStore = s
}

// SetSyncOffset sets the LIVE light-to-sound sync delay in milliseconds
// (0-500). In-memory only — user-facing writes go through
// SetSyncOffsetForUser so the preference survives restarts.
func (m *MusicModeService) SetSyncOffset(ms int) error {
	if ms < 0 || ms > maxSyncOffsetMs {
		return fmt.Errorf("%w: sync_offset_ms %d out of range (0-%d)", ErrMusicModeValidation, ms, maxSyncOffsetMs)
	}
	m.mu.Lock()
	prev := m.syncOffsetMs
	m.syncOffsetMs = ms
	m.mu.Unlock()
	if prev != ms {
		log.Printf("[MUSIC-MODE] Light-to-sound sync offset: %dms → %dms", prev, ms)
	}
	return nil
}

// SetSyncOffsetForUser validates, PERSISTS the caller's sync offset, and
// applies it to the live delay line — unless another user currently owns the
// running session, in which case the caller's preference is saved but the
// owner's live delay stays untouched (mirrors the flash-comfort rule).
func (m *MusicModeService) SetSyncOffsetForUser(userID int, ms int) error {
	if ms < 0 || ms > maxSyncOffsetMs {
		return fmt.Errorf("%w: sync_offset_ms %d out of range (0-%d)", ErrMusicModeValidation, ms, maxSyncOffsetMs)
	}
	m.mu.RLock()
	store := m.syncOffsetStore
	ownedByOther := m.active && m.userID != userID
	m.mu.RUnlock()

	if store != nil {
		ctx, cancel := djStoreCtx()
		defer cancel()
		if err := store.SaveMusicSyncOffset(ctx, userID, ms); err != nil {
			return fmt.Errorf("saving sync offset: %w", err)
		}
	}
	if ownedByOther {
		return nil
	}
	return m.SetSyncOffset(ms)
}

// restoreSyncOffsetForUser loads the caller's persisted sync offset into the
// live delay line. Called at the top of Activate (outside every lock) so a
// restart → login → activate round-trip brings the speaker delay back. The
// ownership guard means a CONFLICTING activation attempt can never clobber
// the current owner's live delay.
func (m *MusicModeService) restoreSyncOffsetForUser(userID int) {
	m.mu.RLock()
	store := m.syncOffsetStore
	m.mu.RUnlock()
	if store == nil {
		return
	}
	ctx, cancel := djStoreCtx()
	defer cancel()
	ms, err := store.GetMusicSyncOffset(ctx, userID)
	if err != nil {
		log.Printf("[MUSIC-MODE] Sync offset restore failed (keeping current): %v", err)
		return
	}
	if ms < 0 || ms > maxSyncOffsetMs {
		ms = 0 // defensive: DB CHECK should make this unreachable
	}
	m.mu.Lock()
	if m.active && m.userID != userID {
		m.mu.Unlock()
		return
	}
	prev := m.syncOffsetMs
	m.syncOffsetMs = ms
	m.mu.Unlock()
	if prev != ms {
		log.Printf("[MUSIC-MODE] Light-to-sound sync offset restored: %dms (user %d)", ms, userID)
	}
}

// SyncOffsetMs returns the current light-to-sound sync delay.
func (m *MusicModeService) SyncOffsetMs() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.syncOffsetMs
}

// processMetrics applies one (possibly delayed) metrics frame: store, UDP push,
// WS telemetry, diagnostics. UDP/WS I/O runs OUTSIDE the lock.
func (m *MusicModeService) processMetrics(metrics AudioMetrics, now time.Time) {
	m.mu.Lock()
	m.metrics = metrics
	m.metricsUpdated = now
	m.metricsCount++
	count := m.metricsCount
	ts := metrics.Timestamp
	// Snapshot UDP state under lock
	doUDP := m.udpEnabled

	// Live telemetry: OR-aggregate transient bits between throttled sends so a
	// single-frame beat/drop can't fall between two WS frames, then snapshot.
	m.wsPendingBeat |= metrics.Beat & 1
	m.wsPendingBassBeat |= metrics.BassBeat & 1
	m.wsPendingFlags |= metrics.Flags
	broadcastUserID := 0
	var wsBeat, wsBassBeat, wsFlags uint8
	if m.active && m.userID > 0 && now.Sub(m.wsLastMetricsBroadcast) >= musicMetricsInterval {
		broadcastUserID = m.userID
		wsBeat, wsBassBeat, wsFlags = m.wsPendingBeat, m.wsPendingBassBeat, m.wsPendingFlags
		m.wsPendingBeat, m.wsPendingBassBeat, m.wsPendingFlags = 0, 0, 0
		m.wsLastMetricsBroadcast = now
	}
	m.mu.Unlock()

	// THE SELECTOR (A5). One branch, so "never both" is a property of this site rather than an
	// agreement between two that could drift. Default is udp, which is byte-for-byte the previous
	// behaviour: DecideMusicTransport returns SendUDP immediately for mode=udp without consulting
	// capability, the port, or anything else.
	if doUDP {
		m.sendMetricsSelected(metrics)
	}

	// WS telemetry OUTSIDE lock (best-effort, throttled)
	if broadcastUserID > 0 {
		m.broadcastMusicMetrics(broadcastUserID, metrics, wsBeat, wsBassBeat, wsFlags)
	}

	// Diagnostic logging (every ~2s at 50Hz)
	if count%100 == 1 {
		pythonAge := ""
		if ts > 0 {
			age := time.Now().UnixMilli() - ts
			if age < 0 {
				age = 0 // Clamp: clock adjustments can briefly go negative
			}
			pythonAge = fmt.Sprintf(" python_age=%dms", age)
		}
		log.Printf("[MUSIC-MODE] Metrics #%d: bands=%v vol=%d beat=%d%s",
			count, metrics.Bands, metrics.Volume, metrics.Beat, pythonAge)
	}
}

// musicMetricsFrame builds the music_metrics WS payload. bands MUST be the
// [8]uint8 ARRAY (marshals as a JSON number array) — slicing it to []uint8
// makes encoding/json base64-encode the bytes ("bands":"//90QiUZDQM="),
// which every client parser reads as no-bands and the live equalizer shows
// "waiting for the live audio feed" forever.
func musicMetricsFrame(metrics AudioMetrics, beat, bassBeat, flags uint8) map[string]interface{} {
	return map[string]interface{}{
		"type": "music_metrics",
		"data": map[string]interface{}{
			"bands":      metrics.Bands,
			"volume":     metrics.Volume,
			"energy":     metrics.Energy,
			"beat":       beat != 0,
			"bass_beat":  bassBeat != 0,
			"peak_band":  metrics.PeakBand,
			"bpm":        metrics.Bpm,
			"beat_phase": metrics.BeatPhase,
			"envelope":   metrics.Envelope,
			"build":      flags&0x01 != 0,
			"drop":       flags&0x02 != 0,
			"quiet":      flags&0x04 != 0,
		},
	}
}

// broadcastMusicMetrics pushes a music_metrics frame to the session owner's
// WebSocket connections. Best-effort and throttled by the caller — the live
// equalizer in the apps is decorative telemetry, never load-bearing state.
// beat/bassBeat/flags are the OR-aggregate since the previous frame (transient
// bits survive the throttle window); levels are the newest sample.
func (m *MusicModeService) broadcastMusicMetrics(userID int, metrics AudioMetrics, beat, bassBeat, flags uint8) {
	jsonData, err := json.Marshal(musicMetricsFrame(metrics, beat, bassBeat, flags))
	if err != nil {
		return
	}
	ws_clients.BroadcastToUserBestEffort(userID, jsonData)
}

// GetMetrics returns current audio metrics (called by firmware polling endpoint)
func (m *MusicModeService) GetMetrics() AudioMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.metrics
}

// GetStatus returns current music mode status and configuration
func (m *MusicModeService) GetStatus() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status := map[string]interface{}{
		"active": m.active,
	}

	if m.active {
		status["user_id"] = m.userID
		status["source"] = m.source
		status["sensitivity"] = m.sensitivity
		status["visual_mode"] = m.visualMode
		status["palette_id"] = m.paletteID
		if m.upalRef != "" {
			status["upal_ref"] = m.upalRef
		}
		status["speed"] = m.speed
		status["intensity"] = m.intensity
		status["reverse"] = m.reverse
		status["mirror"] = m.mirror
		status["smooth_transitions"] = m.smoothTransitions
		status["brightness"] = m.brightness
		status["metrics"] = m.metrics
		status["metrics_updated"] = m.metricsUpdated
		status["process_running"] = (m.pythonCmd != nil && m.pythonCmd.Process != nil)
		status["auto_dj"] = m.autoDJStatusLocked()
		if len(m.segmentConfigs) > 0 {
			status["segment_configs"] = m.segmentConfigs
		}
	}

	return status
}

// autoDJStatusLocked builds the auto_dj status object (incl. the current
// now-playing look so clients don't wait for the next WS event). Caller
// holds m.mu (read or write) — no re-locking here.
func (m *MusicModeService) autoDJStatusLocked() map[string]interface{} {
	out := map[string]interface{}{
		"enabled": m.djEnabled,
		"program": m.djProgram,
	}
	if m.djEnabled && m.djNowPlaying != nil {
		np := *m.djNowPlaying
		out["now_playing"] = np
	}
	return out
}

// GetStatusForUser returns music mode status with per-user ownership flag.
// The entire map is built in one lock scope to avoid TOCTOU races.
func (m *MusicModeService) GetStatusForUser(requestingUserID int) map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status := map[string]interface{}{
		"active": m.active,
	}

	if m.active {
		status["user_id"] = m.userID
		status["owned_by_current_user"] = (m.userID == requestingUserID)
		status["source"] = m.source
		status["sensitivity"] = m.sensitivity
		status["visual_mode"] = m.visualMode
		status["palette_id"] = m.paletteID
		if m.upalRef != "" {
			status["upal_ref"] = m.upalRef
		}
		status["speed"] = m.speed
		status["intensity"] = m.intensity
		status["reverse"] = m.reverse
		status["mirror"] = m.mirror
		status["smooth_transitions"] = m.smoothTransitions
		status["brightness"] = m.brightness
		status["metrics"] = m.metrics
		status["metrics_updated"] = m.metricsUpdated
		status["process_running"] = (m.pythonCmd != nil && m.pythonCmd.Process != nil)
		status["auto_dj"] = m.autoDJStatusLocked()
		if len(m.segmentConfigs) > 0 {
			status["segment_configs"] = m.segmentConfigs
		}
	}

	return status
}

// IsActiveForUser checks if music mode is active for a specific user
func (m *MusicModeService) IsActiveForUser(userID int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.active && m.userID == userID
}

// ValidateMusicConfig checks the four parameters every music activation shares.
//
// Exported so a caller can validate BEFORE it spends anything. The preset route's fresh path
// writes a generic ErgoLED payload to seed the hardware before Activate reads it back; with the rules
// living only inside Activate, an invalid preset repainted the strip and then failed. Same rules,
// one definition — TestMusicConfigValidation_AgreesWithActivate pins them together so the copy in
// the route can never drift from the copy that decides.
func ValidateMusicConfig(source string, sensitivity float64, visualMode, paletteID int) error {
	if source != "mic" && source != "system" && source != "both" {
		return fmt.Errorf("%w: invalid audio source: %s (must be 'mic', 'system', or 'both')", ErrMusicModeValidation, source)
	}
	if sensitivity < 0.5 || sensitivity > 2.0 {
		return fmt.Errorf("%w: sensitivity %.2f out of range (0.5-2.0)", ErrMusicModeValidation, sensitivity)
	}
	if visualMode < 0 || visualMode > 9 {
		return fmt.Errorf("%w: invalid visual mode: %d (must be 0-9)", ErrMusicModeValidation, visualMode)
	}
	if paletteID < 0 || paletteID > 21 {
		return fmt.Errorf("%w: palette %d out of range (0-21)", ErrMusicModeValidation, paletteID)
	}
	return nil
}

// ActivationInFlight reports whether an Activate is mid-flight, and for whom.
//
// The `activating` flag claims the session slot across Activate's unlock-around-I/O windows, so
// there is a real window — roughly a second when the controller's HTTP is slow — in which
// `active` is still false, `userID` is already set, and a Python process is starting. During that
// window IsActiveForUser answers false, which is TRUE but useless to a caller deciding whether to
// start a competing activation: it reads as "nothing is running" when in fact something is
// half-started.
//
// That gap is what turned a preset reapply into a restart storm on 2026-08-16. The reapply saw
// "not active", took the fresh path, tore the session down and respawned the analyzer — landing
// inside an auto-resume's readiness check and producing "Python exited during readiness check".
//
// Exposing it lets a caller refuse BEFORE writing anything, which is the only place a refusal is
// free.
func (m *MusicModeService) ActivationInFlight() (inFlight bool, userID int) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.activating {
		return false, 0
	}
	return true, m.userID
}

// SourceForUser returns the active audio source ("mic"/"system") for the user,
// or "" if music mode is not active for them. Used by the LED transition
// recovery-status broadcast (Step 4) to label the degraded/recovered event.
func (m *MusicModeService) SourceForUser(userID int) string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.active || m.userID != userID {
		return ""
	}
	return m.source
}

// GetResumeConfig returns a copy of current music mode config for logout auto-resume.
func (m *MusicModeService) GetResumeConfig(userID int) *MusicModeResumeConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.active || m.userID != userID {
		return nil
	}
	var savedCopy json.RawMessage
	if len(m.savedLedState) > 0 {
		savedCopy = append(json.RawMessage(nil), m.savedLedState...)
	}
	// #15: snapshot the full firmware tuning so logout→login restores spectrum
	// tuning / color dynamics / color bursts, not just the top-level fields.
	// desiredConfig is a value type (incl. the [8]uint8 ripple array) → this copy
	// is independent of the live config. desiredConfig is CANONICAL — the DJ's
	// temporary tuning overlay never touches it, so nothing needs masking here.
	fwTuning := m.desiredConfig
	djProgram := ""
	if m.djEnabled {
		djProgram = m.djProgram
	}
	// While the DJ conducts, the LIVE look (viz/palette/speed/intensity) is
	// DJ-authored — a preset look's palette, a rotated effect. The resume
	// blob must capture the USER's own base look (the DJ-start baseline),
	// never a transient DJ look, or disabling the DJ after a resume would
	// strand the user on something they never chose.
	visualMode, paletteID, speed, intensity := m.visualMode, m.paletteID, m.speed, m.intensity
	upalRef := m.upalRef
	segSnapshot := m.segmentConfigs
	if m.djEnabled && m.djRuntime != nil {
		b := m.djRuntime.baseline
		visualMode, paletteID, speed, intensity = b.visualMode, b.paletteID, b.speed, b.intensity
		upalRef = b.upalRef
		if m.djRuntime.program.WritesSegmentOverrides {
			// A deck look may have generated segment overrides over the
			// user's canvas — snapshot the user's own overrides, not the DJ's.
			segSnapshot = b.segs
		}
	}
	return &MusicModeResumeConfig{
		Source:            m.source,
		Sensitivity:       m.sensitivity,
		VisualMode:        visualMode,
		PaletteID:         paletteID,
		UpalRef:           upalRef,
		Speed:             speed,
		Intensity:         intensity,
		Reverse:           m.reverse,
		Mirror:            m.mirror,
		SmoothTransitions: m.smoothTransitions,
		Brightness:        m.brightness,
		SegmentConfigs:    cloneMusicSegmentConfigs(segSnapshot),
		SavedLedState:     savedCopy,
		FirmwareTuning:    &fwTuning,
		AutoDJProgram:     djProgram,
	}
}

// OwnsMusicSession returns true if this user owns the music mode session,
// whether fully active or still in the activation window (Steps 2-5).
// Used ONLY by wled_sync_service DB-save suppression to close the race
// between ErgoLED payload send (Step 3) and m.active = true (Step 5).
func (m *MusicModeService) OwnsMusicSession(userID int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.userID == userID && m.userID != 0
}

// ResendPayload re-sends the current music mode FX payload to the firmware.
// Used after an elevator animation overwrites the firmware's FX state.
func (m *MusicModeService) ResendPayload(userID int, transition int) error {
	m.mu.RLock()
	if !m.active || m.userID != userID {
		m.mu.RUnlock()
		return fmt.Errorf("music mode not active for user %d", userID)
	}
	visualMode := m.visualMode
	paletteID := m.paletteID
	upalRef := m.upalRef
	speed := m.speed
	intensity := m.intensity
	reverse := m.reverse
	mirror := m.mirror
	segConfigs := m.segmentConfigs
	bri := m.brightness
	segColors := append([]json.RawMessage(nil), m.segmentColors...) // defensive copy
	m.mu.RUnlock()

	log.Printf("[MUSIC-MODE] Re-sending FX payload (mode=%d, palette=%d, bri=%d, transition=%d) for user %d", visualMode, paletteID, bri, transition, userID)
	return m.sendMusicPayload(userID, visualMode, paletteID, upalRef, speed, intensity, reverse, mirror, transition, segConfigs, bri, segColors)
}

// SetBrightness sends a brightness-only payload at PriorityMusic so it passes the write gate
// while music mode holds it. Validates that music mode is active for the requesting user.
func (m *MusicModeService) SetBrightness(userID int, bri int) error {
	if bri < 0 || bri > 255 {
		return fmt.Errorf("%w: brightness %d out of range (0-255)", ErrMusicModeValidation, bri)
	}

	m.mu.RLock()
	if !m.active {
		m.mu.RUnlock()
		return fmt.Errorf("music mode not active")
	}
	if m.userID != userID {
		m.mu.RUnlock()
		return fmt.Errorf("%w: active for user %d", ErrMusicModeConflict, m.userID)
	}
	m.mu.RUnlock()

	payload := map[string]interface{}{"bri": ScaleBriByCap(bri, MusicModeCapPct(userID))}
	_, err := m.ergoLEDClient.SendJSON(personLook(payload), userID, PriorityMusic)
	if err != nil {
		return fmt.Errorf("failed to send brightness to ErgoLED: %w", err)
	}

	// Store brightness for ResendPayload (separate lock acquisition after I/O)
	m.mu.Lock()
	m.brightness = bri
	m.mu.Unlock()

	// Workstream B2: refresh the durable resume intent with the new brightness
	// (session-re-checked inside persistResumeIntent).
	m.persistResumeIntent(userID)
	log.Printf("[MUSIC-MODE] Brightness set to %d for user %d", bri, userID)
	return nil
}

// Shutdown performs cleanup on API shutdown.
// Order matters: the Auto DJ teardown runs BEFORE the config coalescer stops —
// dropping the DJ tuning overlay restores the user's canonical tuning to the
// firmware, and that restore must still be deliverable (the drop sends
// synchronously, but the ordering keeps any trailing coalesced writes sane too).
func (m *MusicModeService) Shutdown() {
	m.mu.Lock()
	active := m.active
	var uid int
	var done chan struct{}
	if active {
		log.Printf("[MUSIC-MODE] Shutdown: Stopping Python process for user %d", m.userID)
		m.stopping = true
		uid = m.userID
		done = m.pythonDone
	}
	m.mu.Unlock()

	if active {
		m.stopAutoDJInternal() // overlay dropped + canonical restore sent while transport still up
	}

	// Stop coalescer goroutine
	if m.configCancel != nil {
		m.configCancel()
	}
	m.configWg.Wait()

	if !active {
		return
	}
	m.closeUDPSender()
	m.stopPythonProcess(done)

	m.mu.Lock()
	m.writeGate.ExitMode(uid, "music_mode")
	m.active = false
	m.pythonStdin = nil
	m.stopping = false
	m.mu.Unlock()
}

// initUDPSender initializes the UDP connection for pushing audio metrics to firmware.
// Parses the firmware IP from the ErgoLED base URL. Non-fatal: caller falls back to HTTP polling.
// Must be called while m.mu is held (reads ergoLEDClient).
func (m *MusicModeService) initUDPSender() error {
	baseURL := m.ergoLEDClient.GetBaseURL()
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return fmt.Errorf("parse ErgoLED URL %q: %w", baseURL, err)
	}
	host := parsed.Hostname()
	if host == "" {
		return fmt.Errorf("no host in ErgoLED URL %q", baseURL)
	}

	addr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("%s:%d", host, 21325))
	if err != nil {
		return fmt.Errorf("resolve UDP addr: %w", err)
	}

	conn, err := net.DialUDP("udp4", nil, addr)
	if err != nil {
		return fmt.Errorf("dial UDP: %w", err)
	}

	m.udpConn = conn
	m.firmwareAddr = addr
	m.udpSeq = 0
	m.udpEnabled = true
	log.Printf("[MUSIC-MODE-UDP] Sender initialized -> %s", addr.String())
	return nil
}

// closeUDPSender closes the UDP connection and resets sender state.
// Safe to call multiple times. Does NOT require m.mu to be held.
func (m *MusicModeService) closeUDPSender() {
	m.mu.Lock()
	conn := m.udpConn
	wasEnabled := m.udpEnabled
	m.udpConn = nil
	m.firmwareAddr = nil
	m.udpEnabled = false
	m.mu.Unlock()

	if conn != nil {
		conn.Close()
	}
	if wasEnabled {
		log.Printf("[MUSIC-MODE-UDP] Sender closed")
	}
}

// pushMetricsUDP sends a compact 22-byte binary packet to firmware via UDP.
// Fire-and-forget: errors are silently ignored (HTTP fallback handles reliability).
// Must NOT be called while holding m.mu (syscall I/O would block other goroutines).
//
// Packet format (v0x02, 22 bytes — bytes 0-14 are layout-identical to v0x01 so
// the firmware dispatches on the version byte and v1-only firmware simply
// rejects the longer packet and falls back to HTTP polling):
//
//	[0]:    0xAD magic
//	[1]:    0x02 version
//	[2]:    sequence (uint8, wraps)
//	[3-10]: bands[0-7]
//	[11]:   volume
//	[12]:   energy
//	[13]:   beat(bit0) | bassBeat(bit1)
//	[14]:   peakBand
//	[15]:   bpm (0 = no tempo lock)
//	[16]:   beatPhase (0-255 through the current beat)
//	[17]:   barPos: bits6-7 beat-in-bar (0-3), bits0-5 bar-in-phrase (0-7)
//	[18]:   loudness envelope (vs slow AGC reference)
//	[19]:   flags: bit0 build, bit1 drop, bit2 quiet
//	[20]:   spectral centroid
//	[21]:   reserved (0)
//
// beat/bassBeat/flags are the ACCUMULATED transients from sendMetricsSelected, not the raw fields
// of this frame — they may carry pulses folded forward from frames the pace gate skipped.
//
// A0 IS NOT CHECKED HERE ANY MORE. The write gate moved up into sendMetricsSelected when the pace
// gate was hoisted, because a suppression has to clear the shared transient accumulator and note
// the transport that was actually suppressed — neither of which this function can see. The
// ordering it used to enforce is unchanged and still load-bearing: gate first, sequence second, so
// a frame that is never transmitted never burns a sequence number the firmware would read as
// packet loss. Do not call this directly; go through sendMetricsSelected.
// Returns whether the packet was handed to the socket. That is the strongest signal UDP has —
// conn.Write is fire-and-forget with the error discarded — so it means "left the host", not
// "arrived". A nil conn returns false, and the caller then keeps the transients rather than
// committing them to a frame that never went anywhere.
func (m *MusicModeService) pushMetricsUDP(metrics AudioMetrics, beat, bassBeat, flags uint8) bool {
	// Backstop for effectiveMusicTransport: in serial_only no audio frame goes to the
	// controller's UDP port, whatever decided to send one.
	if !ergoled.WiFiControlPermitted() {
		return false
	}
	m.mu.Lock()
	conn := m.udpConn
	if conn == nil {
		// Re-checked here even though udpConnReady() already gated on it: that check happens
		// before the pace gate to avoid burning it, this one is the actual safety, and the conn
		// can be swapped between the two.
		m.mu.Unlock()
		return false
	}
	seq := m.udpSeq
	m.udpSeq++
	m.mu.Unlock()

	var pkt [22]byte
	pkt[0] = 0xAD // Magic
	pkt[1] = 0x02 // Version (Music Mode 2.0)
	pkt[2] = seq
	copy(pkt[3:11], metrics.Bands[:])
	pkt[11] = metrics.Volume
	pkt[12] = metrics.Energy
	pkt[13] = (beat & 1) | ((bassBeat & 1) << 1)
	pkt[14] = metrics.PeakBand
	pkt[15] = metrics.Bpm
	pkt[16] = metrics.BeatPhase
	pkt[17] = metrics.BarPos
	pkt[18] = metrics.Envelope
	pkt[19] = flags
	pkt[20] = metrics.Centroid
	pkt[21] = 0 // reserved

	conn.Write(pkt[:]) // Fire-and-forget
	m.udpFramesSent.Add(1)
	return true
}

// DeviceTransientStats exposes the transient accumulator's carried/dropped counters.
//
// It exists because transientAccumulator.Stats() had NO PRODUCTION CONSUMER — grep found it only in
// tests — so the counters pre-registered as the deferral-carry success signals were write-only and
// could not be read on a running system. Same defect class as NoteCommittedSegmentFX: built,
// tested, never wired. The canary report is the intended consumer.
//
// Read them against a denominator, not bare: Add early-returns when beat, bassBeat and flags are
// all zero, so both counters are gated by transient PRESENCE. A bare count cannot distinguish "no
// carries happened" from "no transient was ever pending".
func (m *MusicModeService) DeviceTransientStats() (carried, dropped uint64) {
	if m == nil {
		return 0, 0
	}
	return m.deviceTransients.Stats()
}

// udpConnReady reports whether the UDP socket exists, WITHOUT consuming anything.
//
// It exists so sendMetricsSelected can bail before the pace gate. Running Add/Allow/Take for a
// frame that has nowhere to go would advance lastSentAtMs and destroy the accumulated transients —
// the same class of defect as burning a sequence number on an untransmitted frame, which is why
// the conn check has always preceded the sequence consume in pushMetricsUDP.
func (m *MusicModeService) udpConnReady() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.udpConn != nil
}

// startPythonProcess starts the Python audio analysis subprocess with death-pact pattern
func (m *MusicModeService) startPythonProcess(source string, sensitivity float64) error {
	ctx, cancel := context.WithCancel(context.Background())
	m.pythonCancel = cancel

	// Build command with audio source and sensitivity
	apiURL := "http://localhost:5000"
	pyArgs := []string{
		m.scriptPath,
		"--source", source,
		"--sensitivity", fmt.Sprintf("%.2f", sensitivity),
		"--api-url", apiURL,
	}
	// Step 6 feature flag (MUSIC_ANALYZER_LOW_LATENCY_V2): decoupled capture/send +
	// PULSE_LATENCY_MSEC + single-stage (firmware) smoothing. Default ON; set the env
	// to "false"/"0" to fall back to the legacy single-threaded analyzer.
	if musicLowLatencyEnabled() {
		pyArgs = append(pyArgs, "--low-latency")
		log.Printf("[MUSIC-MODE] Low-latency analyzer enabled (MUSIC_ANALYZER_LOW_LATENCY_V2)")
	}
	if !musicGridSnapEnabled() {
		pyArgs = append(pyArgs, "--no-grid-snap")
		log.Printf("[MUSIC-MODE] Beat grid-snap DISABLED (MUSIC_BEAT_GRID_SNAP rollback)")
	}
	cmd := exec.CommandContext(ctx, "python3", pyArgs...)

	// Set process group for clean termination
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	// DEATH PACT: Create stdin pipe - when Go dies, OS closes pipe and Python exits
	stdin, err := cmd.StdinPipe()
	if err != nil {
		log.Printf("[MUSIC-MODE] Failed to create stdin pipe (death pact disabled): %v", err)
	} else {
		m.pythonStdin = stdin
	}

	// Capture stdout/stderr for debugging
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	// Start process
	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("failed to start Python process: %w", err)
	}

	m.pythonCmd = cmd
	m.pythonDone = make(chan struct{})
	localDone := m.pythonDone
	localCmd := cmd

	log.Printf("[MUSIC-MODE] Started Python process (PID=%d, source=%s)", cmd.Process.Pid, source)

	// Background goroutine to monitor process death and log output
	go func() {
		// Log stdout in background
		if stdout != nil {
			go func() {
				buf := make([]byte, 1024)
				for {
					n, err := stdout.Read(buf)
					if n > 0 {
						log.Printf("[MUSIC-MODE-PYTHON-STDOUT] %s", string(buf[:n]))
					}
					if err != nil {
						if err != io.EOF {
							log.Printf("[MUSIC-MODE] Python stdout error: %v", err)
						}
						break
					}
				}
			}()
		}

		// Log stderr in background
		if stderr != nil {
			go func() {
				buf := make([]byte, 1024)
				for {
					n, err := stderr.Read(buf)
					if n > 0 {
						log.Printf("[MUSIC-MODE-PYTHON-STDERR] %s", string(buf[:n]))
					}
					if err != nil {
						if err != io.EOF {
							log.Printf("[MUSIC-MODE] Python stderr error: %v", err)
						}
						break
					}
				}
			}()
		}

		// SOLE OWNER of cmd.Wait()
		waitErr := localCmd.Wait()

		// Signal done BEFORE taking lock (prevents deadlock with Deactivate)
		close(localDone)

		// Check if this was a crash (not intentional stop)
		m.mu.Lock()
		if m.stopping {
			// Intentional stop — Deactivate()/Shutdown() handles cleanup
			m.mu.Unlock()
			return
		}
		// Match on cmd identity — covers both "active" and "activating" states
		if m.pythonCmd == localCmd {
			// Exit-code logging
			exitCode := -1
			if localCmd.ProcessState != nil {
				exitCode = localCmd.ProcessState.ExitCode()
			}
			if exitCode == 1 {
				log.Printf("[MUSIC-MODE] Python self-exited (exit=1, likely POST failures), cleaning up")
			} else {
				log.Printf("[MUSIC-MODE] Python crashed (err=%v, exit=%d), cleaning up", waitErr, exitCode)
			}

			// Snapshot under lock
			uid := m.userID
			savedState := m.savedLedState

			// Clear state under lock (before network I/O)
			m.writeGate.ExitMode(uid, "music_mode")
			m.active = false
			m.userID = 0
			m.pythonCmd = nil
			m.pythonCancel = nil
			m.pythonDone = nil
			m.pythonStdin = nil
			m.savedLedState = nil
			m.metrics = AudioMetrics{}
			m.segmentConfigs = nil
			m.brightness = 255
			m.segmentColors = nil
			m.udpEnabled = false // Disable UDP before closing outside lock
			m.mu.Unlock()

			// Close UDP sender outside lock
			m.stopAutoDJInternal()
			m.closeUDPSender()

			// Network I/O outside lock — restore LEDs
			restored := false
			if len(savedState) > 0 {
				if _, err := m.ergoLEDClient.SendRaw(json.RawMessage(commands.MarkPersonLook(savedState)), uid, PriorityMusic); err != nil {
					log.Printf("[MUSIC-MODE] Crash restore failed: %v", err)
				} else {
					log.Printf("[MUSIC-MODE] Restored LED state after crash (%d bytes)", len(savedState))
					restored = true
					m.persistRestoredPayload(uid, savedState)
				}
			}

			// Automation fallback if restore absent or failed
			if !restored && m.automationService != nil {
				go func() {
					time.Sleep(100 * time.Millisecond)
					m.automationService.ReapplyCurrentState(uid)
				}()
			}
			return
		}
		m.mu.Unlock()
	}()

	return nil
}

// stopPythonProcess gracefully stops the Python subprocess (SIGTERM -> SIGKILL fallback)
// Takes done channel as parameter to avoid reading field after unlock.
func (m *MusicModeService) stopPythonProcess(done <-chan struct{}) {
	// Read cmd under lock (but do NOT hold lock during wait)
	m.mu.Lock()
	cmd := m.pythonCmd
	cancel := m.pythonCancel
	stdinPipe := m.pythonStdin
	m.pythonStdin = nil
	m.mu.Unlock()

	if stdinPipe != nil {
		stdinPipe.Close()
	}

	if cmd == nil || cmd.Process == nil {
		return
	}

	pid := cmd.Process.Pid
	log.Printf("[MUSIC-MODE] Stopping Python process (PID=%d)", pid)

	if cancel != nil {
		cancel()
	}

	// Send SIGTERM to process group
	if err := syscall.Kill(-pid, syscall.SIGTERM); err != nil {
		log.Printf("[MUSIC-MODE] Failed to send SIGTERM to -%d: %v, sending SIGKILL", pid, err)
		cmd.Process.Kill()
	}

	// Wait on done channel (watcher goroutine closes it after cmd.Wait())
	if done != nil {
		select {
		case <-done:
			log.Printf("[MUSIC-MODE] Python process terminated")
		case <-time.After(2 * time.Second):
			log.Printf("[MUSIC-MODE] SIGTERM timeout, sending SIGKILL to -%d", pid)
			syscall.Kill(-pid, syscall.SIGKILL)
			<-done
		}
	}
}

// sendMusicPayload sends ErgoLED configuration for music visualization.
// transition: ErgoLED transition value (0=instant, 7=700ms crossfade, etc.)
func (m *MusicModeService) sendMusicPayload(userID int, visualMode int, paletteID int, upalRef string, speed int, intensity int, reverse bool, mirror bool, transition int, segConfigs []MusicSegmentConfig, brightness int, segColors []json.RawMessage) error {
	segments := makeSegmentPayloads(visualMode, paletteID, speed, intensity, reverse, mirror, segConfigs, segColors)
	applyMusicUserPalette(segments, upalRef, segConfigs)
	payload := map[string]interface{}{
		"on":         true,
		"bri":        ScaleBriByCap(brightness, MusicModeCapPct(userID)), // the person's ceiling (migration 299). Explicit — prevents firmware DEFAULT_BRIGHTNESS=128 injection
		"transition": transition, // Always explicit — prevents stale transition inheritance
		"seg":        segments,
	}

	payloadJSON, _ := json.Marshal(payload)
	log.Printf("[MUSIC-MODE] ErgoLED payload: %s", string(payloadJSON))

	_, err := m.ergoLEDClient.SendJSON(personLook(payload), userID, PriorityMusic)
	if err != nil {
		return fmt.Errorf("failed to send ErgoLED payload: %w", err)
	}

	log.Printf("[MUSIC-MODE] Sent ErgoLED payload (mode=%d, palette=%d, segments=%d, transition=%d)",
		visualMode, paletteID, len(segments), transition)
	// What the strips were sent, for the Auto DJ ratings (music_dj_render.go). Takes m.mu
	// briefly, so every caller sends with m.mu released (all three do).
	m.noteRenderSent(payloadJSON)
	return nil
}

// applyMusicUserPalette puts the music-wide user palette (upalRef) on every strip that does
// not choose its own: a strip whose override sets a palette (built-in or user) keeps it, and a
// fixed strip (fx 0, the user's solid colour) keeps its colour — Solid on a user palette would
// paint the palette over it. The reference rides beside a safe pal 0, as a per-strip one does,
// and the Writer's resolver puts the palette on the board.
func applyMusicUserPalette(segments []map[string]interface{}, upalRef string, segConfigs []MusicSegmentConfig) {
	if upalRef == "" {
		return
	}
	own := make(map[int]bool, len(segConfigs))
	for _, sc := range segConfigs {
		if sc.Pal != nil || (sc.UpalRef != nil && *sc.UpalRef != "") || (sc.FX != nil && *sc.FX == 0) {
			own[sc.ID] = true
		}
	}
	for i, seg := range segments {
		if own[i] {
			continue
		}
		seg[ergoled.PaletteRefKey] = upalRef
		seg["pal"] = 0
	}
}

// makeSegmentPayloads creates ErgoLED segment configurations for music mode.
// Per-segment overrides in segConfigs are merged on top of global values.
// segColors provides per-segment "col" arrays from the pre-music ErgoLED state.
func makeSegmentPayloads(visualMode int, paletteID int, speed int, intensity int, reverse bool, mirror bool, segConfigs []MusicSegmentConfig, segColors []json.RawMessage) []map[string]interface{} {
	fxID, ok := musicFxMap[visualMode]
	if !ok {
		fxID = 28 // Fallback to spectrum
	}

	// Use provided intensity, or per-effect default if 0 and not explicitly set
	ixValue := intensity
	if ixValue == 0 {
		if def, ok := defaultIx[visualMode]; ok {
			ixValue = def
		}
	}

	// Build per-segment override lookup
	segOverrides := make(map[int]MusicSegmentConfig)
	for _, sc := range segConfigs {
		segOverrides[sc.ID] = sc
	}

	segments := make([]map[string]interface{}, 8)
	for i := 0; i < 8; i++ {
		seg := map[string]interface{}{
			"id":  i,
			"on":  true,
			"bri": 255, // Full per-segment brightness (prevents inheriting low bri from previous effect)
			"fx":  fxID,
			"pal": paletteID,
			"sx":  speed,
			"ix":  ixValue,
			"rev": reverse,
			"mi":  mirror,
		}

		// Apply stored per-segment colors (preserves user's pre-music-mode scene
		// across status indicator animations that overwrite all segments)
		if i < len(segColors) && len(segColors[i]) > 0 {
			var col interface{}
			if json.Unmarshal(segColors[i], &col) == nil {
				seg["col"] = col
			}
		}

		// Apply per-segment overrides
		if ov, ok := segOverrides[i]; ok {
			if ov.On != nil {
				seg["on"] = *ov.On
			}
			if ov.FX != nil {
				seg["fx"] = *ov.FX
			}
			if ov.SX != nil {
				seg["sx"] = *ov.SX
			}
			if ov.IX != nil {
				seg["ix"] = *ov.IX
			}
			if ov.Pal != nil {
				seg["pal"] = *ov.Pal
			}
			if ov.Reverse != nil {
				seg["rev"] = *ov.Reverse
			}
			if ov.Mirror != nil {
				seg["mi"] = *ov.Mirror
			}
			// Col override runs after the pre-music snapshot-color injection, so it wins.
			if ov.Col != nil {
				seg["col"] = (*ov.Col)[:]
			}
			// A user palette: the reference rides beside a safe pal 0 (fix's contract: the
			// unresolved payload renders the fallback), and the Writer's resolver sets the slot.
			if ov.UpalRef != nil && *ov.UpalRef != "" {
				seg[ergoled.PaletteRefKey] = *ov.UpalRef
				seg["pal"] = 0
			}
		}

		segments[i] = seg
	}

	return segments
}

// validateMusicSegmentConfigs rejects malformed per-segment overrides before they
// reach the firmware. col shape/bounds are already enforced by RGBWStops.UnmarshalJSON.
func validateMusicSegmentConfigs(segs []MusicSegmentConfig) error {
	for _, sc := range segs {
		if sc.ID < 0 || sc.ID > 7 {
			return fmt.Errorf("%w: segment id %d out of range (0-7)", ErrMusicModeValidation, sc.ID)
		}
		// 0-33 = user effects (solid..classic music FX); 37-40 = layer music FX.
		// 34-36 (movement indicators) stay client-unreachable by design.
		if sc.FX != nil && !((*sc.FX >= 0 && *sc.FX <= 33) || IsMusicFxID(*sc.FX)) {
			return fmt.Errorf("%w: segment %d fx %d out of range (0-33, 37-40)", ErrMusicModeValidation, sc.ID, *sc.FX)
		}
		if sc.Pal != nil && (*sc.Pal < 0 || *sc.Pal > 21) {
			return fmt.Errorf("%w: segment %d pal %d out of range (0-21)", ErrMusicModeValidation, sc.ID, *sc.Pal)
		}
		if sc.SX != nil && (*sc.SX < 0 || *sc.SX > 255) {
			return fmt.Errorf("%w: segment %d sx %d out of range (0-255)", ErrMusicModeValidation, sc.ID, *sc.SX)
		}
		if sc.IX != nil && (*sc.IX < 0 || *sc.IX > 255) {
			return fmt.Errorf("%w: segment %d ix %d out of range (0-255)", ErrMusicModeValidation, sc.ID, *sc.IX)
		}
	}
	return nil
}

// ValidateMusicFavoritePayload validates the segment_configs embedded in a favorite
// payload before it is persisted as JSONB (col shape via RGBWStops.UnmarshalJSON,
// plus id/fx/pal ranges). Empty payloads pass.
func ValidateMusicFavoritePayload(payload json.RawMessage) error {
	if len(payload) == 0 {
		return nil
	}
	var wrapper struct {
		SegmentConfigs []MusicSegmentConfig `json:"segment_configs"`
	}
	if err := json.Unmarshal(payload, &wrapper); err != nil {
		return fmt.Errorf("%w: invalid payload segment_configs: %v", ErrMusicModeValidation, err)
	}
	return validateMusicSegmentConfigs(wrapper.SegmentConfigs)
}

// ═══════════════════════════════════════════════════════════════════
// Firmware Music Config Tuning
// ═══════════════════════════════════════════════════════════════════

// sendFirmwareConfig POSTs the config directly to firmware (bypasses write gate).
// Returns (sentOK, error). On 404: sets fwConfigSupported=false.
func (m *MusicModeService) sendFirmwareConfig(cfg FirmwareMusicConfig) (bool, error) {
	body, err := json.Marshal(cfg)
	if err != nil {
		return false, fmt.Errorf("marshal firmware config: %w", err)
	}

	// SERIAL FIRST (Vico, 2026-09-26: "SERIAL is the way"). A serial transport whose board speaks
	// {MUSICCFG} gets the tuning over serial, verified against the board's echo
	// (music_dj_tuning.go). HTTP is the fallback only where Wi-Fi control is permitted; under
	// serial_only a board without the command is refused, recorded, and logged once per port
	// generation.
	if ergoled.ActiveMode().UsesSerial() && ergoled.MusicConfigSerialCapable() {
		return m.sendFirmwareConfigSerial(cfg, body)
	}
	if !ergoled.WiFiControlPermitted() {
		m.noteTuning(tuningOutcome{cfg: cfg, delivered: DJTuningRefusedNoCapability,
			reason: "the board did not advertise music_config_serial, and serial_only reserves its Wi-Fi for OTA"})
		m.logNoTuningCapabilityOnce(ergoled.CapabilityEpoch())
		return false, nil
	}
	client := ergoled.GuardDeviceClient(&http.Client{Timeout: 1 * time.Second})
	url := m.ergoLEDClient.GetBaseURL() + "/json/music-config"

	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		m.noteTuning(tuningOutcome{cfg: cfg, delivered: DJTuningFailed, reason: err.Error()})
		log.Printf("[MUSIC-MODE-CONFIG] POST %s failed: %v", url, err)
		return false, nil
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body) // drain

	if resp.StatusCode == 404 {
		m.mu.Lock()
		m.fwConfigSupported = false
		m.mu.Unlock()
		log.Printf("[MUSIC-MODE-CONFIG] Firmware does not support /json/music-config (older version)")
		m.noteTuning(tuningOutcome{cfg: cfg, delivered: DJTuningUnsupported404, httpStatus: 404})
		return false, nil
	}

	if resp.StatusCode != 200 {
		m.noteTuning(tuningOutcome{cfg: cfg, delivered: DJTuningFailed, httpStatus: resp.StatusCode})
		log.Printf("[MUSIC-MODE-CONFIG] POST %s returned %d", url, resp.StatusCode)
		return false, nil
	}

	log.Printf("[MUSIC-MODE-CONFIG] Sent config to firmware (%d bytes)", len(body))
	m.noteTuning(tuningOutcome{cfg: cfg, delivered: DJTuningSent, httpStatus: 200})
	return true, nil
}

// sendActiveConfigSnapshot freezes desiredConfig into activeConfig, sends outside lock.
// Caller MUST hold m.mu on entry and exit.
func (m *MusicModeService) sendActiveConfigSnapshot() (bool, error) {
	m.fwConfigSupported = true      // re-probe on every activation
	m.fwColorDynamicsProbed = false // re-probe color-dynamics support too
	m.invalidateConfigBelief()      // the desk may have power-cycled since last session
	m.activeConfig = m.desiredConfig
	cfg := m.activeConfig
	m.mu.Unlock()

	sent, err := m.sendFirmwareConfig(cfg)
	// Probe regardless of whether the POST landed. The probe is an independent
	// GET that already treats unreachable as "keep last-known", so a POST that
	// timed out says nothing about whether the desk can answer a capability
	// question. Gating on `sent` meant one dropped activation packet left
	// capabilities unknown for the WHOLE session, which fails composition
	// closed and stamps every look plan_verified=false — measured live on
	// 2026-08-22 against firmware that answers the probe in 25ms.
	if !m.probeColorDynamicsSupport() {
		// No answer. Retry in the background rather than leaving the session
		// to run blind until config traffic happens to trigger the self-heal.
		m.retryCapabilityProbeAsync()
	}

	m.mu.Lock() // guaranteed re-acquire before return
	return sent, err
}

// probeColorDynamicsSupport does a one-time GET /json/music-config and sets the capability
// flags from what the firmware echoes: color-dynamics (colorMotionSpeed) and the newer color
// bursts (burstRate). Older firmware that has POST /json/music-config but lacks the keys (or
// has no GET) reports false, so the app can hide the corresponding controls.
//
// Reachability vs. support are distinct: a transport error/timeout (common on a wifi desk)
// means the desk is *unreachable*, NOT downgraded — we leave both flags at their last-known
// value (sticky) so a transient drop doesn't grey out working controls mid-session. Once the
// desk *answers*, its response is authoritative: a 200 missing the keys, or a 404 (endpoint
// gone), is a genuine downgrade and drives support back to false.
//
// An answer that arrives AFTER the conductor started is propagated to it (see
// the reconcile below): SetAutoDJ samples m.fwLayerFxSupported once and freezes
// it into the deck, so without that a late answer settles the flags while the
// running show keeps the degraded deck it was built with.
//
// Timeout is 2.5s, from measurement rather than taste. Sampled 2026-08-23
// against the live desk while a show was rendering, 12 probes at 1/s:
//
//	answered:   0.058 0.075 0.077 0.141 0.608 0.662 1.417 s   (8/12)
//	no answer:  4 of 12, three of them still dead at a 6s ceiling
//
// The SHAPE is what sizes the timeout: bimodal. A request either comes back
// inside ~1.5s or does not come back at all, because the failures are Wi-Fi
// delivery gaps (MISSING_ACKS), not slow replies. 1s was cutting off a real
// success at 1.417s; going past ~2.5s buys nothing.
//
// The RATE in that sample is NOT the operating rate and must not be quoted as
// one — 1/s hammering of an ESP32 that is also rendering inflates it. The
// honest figure is this API's own HTTP record over the two boots that day:
// 12 of 137 requests to this endpoint failed, about 9%. The activation probe
// specifically missed 1 of 4. Small — but a miss is not a small EVENT: it
// costs the whole session its layer FX, which is why the retry and the
// reconcile below both exist rather than either alone.
func (m *MusicModeService) probeColorDynamicsSupport() bool {
	// SERIAL FIRST. The link that carries the writes is the one that should
	// answer for them: it stays up through the Wi-Fi delivery gaps that made
	// the HTTP probe miss, and its answer is DECLARED by the firmware rather
	// than inferred from which config keys happen to serialize.
	if a, ok := probeMusicCapsSerial(); ok {
		m.applyCapabilityAnswer(a.ColorDynamics, a.ColorBursts, a.LayerFx, "serial")
		return true
	}

	// serial_only never falls back to HTTP: the controller's Wi-Fi is reserved for OTA. Without a
	// serial answer the flags stay as they are, the same outcome as an unreachable HTTP probe.
	if !ergoled.WiFiControlPermitted() {
		return false
	}

	// HTTP FALLBACK — for firmware predating the hello's music_* keys, and for
	// a host not running the serial transport at all. Kept, not replaced: an
	// older desk must keep working exactly as it did.
	client := ergoled.GuardDeviceClient(&http.Client{Timeout: 2500 * time.Millisecond})
	url := m.ergoLEDClient.GetBaseURL() + "/json/music-config"

	resp, err := client.Get(url)
	if err != nil {
		log.Printf("[MUSIC-MODE-CONFIG] Capability probe unreachable (%v); keeping last-known flags", err)
		return false // sticky: leave fwColorDynamicsSupported / fwColorBurstsSupported unchanged
	}
	defer resp.Body.Close()

	dynSupported := false
	burstsSupported := false
	layerFxSupported := false
	if resp.StatusCode == 200 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		var probe map[string]json.RawMessage
		if json.Unmarshal(body, &probe) == nil {
			_, dynSupported = probe["colorMotionSpeed"]
			_, burstsSupported = probe["burstRate"]
			_, layerFxSupported = probe["comfortMode"] // Music Mode 2.0 marker key
		}
	} else {
		io.Copy(io.Discard, resp.Body)
	}

	m.applyCapabilityAnswer(dynSupported, burstsSupported, layerFxSupported, "http")
	return true
}

// applyCapabilityAnswer latches one authoritative capability answer, from
// EITHER transport, and reconciles a running conductor if it changed anything.
//
// Shared so the serial and HTTP paths cannot drift: the reconcile below is the
// part that makes a late answer actually reach the show, and a second copy of
// it would be a second thing to forget.
func (m *MusicModeService) applyCapabilityAnswer(dynSupported, burstsSupported, layerFxSupported bool, source string) {
	m.mu.Lock()
	// Compare against the PREVIOUS state under the same lock as the write, so
	// "did this answer change anything?" cannot race another probe.
	changed := !m.fwColorDynamicsProbed ||
		m.fwColorDynamicsSupported != dynSupported ||
		m.fwColorBurstsSupported != burstsSupported ||
		m.fwLayerFxSupported != layerFxSupported
	m.fwColorDynamicsSupported = dynSupported
	m.fwColorBurstsSupported = burstsSupported
	m.fwLayerFxSupported = layerFxSupported
	m.fwColorDynamicsProbed = true
	m.fwCapsFromSerial = source == "serial"
	djRunning := m.active && m.djEnabled && m.djRuntime != nil
	userID := m.userID
	m.mu.Unlock()
	log.Printf("[MUSIC-MODE-CONFIG] Firmware support via %s: color-dynamics=%v bursts=%v layer-fx=%v",
		source, dynSupported, burstsSupported, layerFxSupported)

	// A capability answer that lands mid-show has to reach the running
	// conductor, in BOTH directions.
	//
	// Gaining: SetAutoDJ reads m.fwLayerFxSupported once and bakes it into the
	// deck via filtered(), and stores planVerified in djRuntime. When the
	// activation probe misses (a third of the time here) the conductor is built
	// with layerFx=false, so Tower/Ripple/Bass Sky/The Drop are dropped from
	// every slot, the drop slam degrades to classic Strobe, and every look is
	// stamped plan_verified=false. The self-heal then settles the flags a minute
	// later and NOTHING re-read them: measured live 2026-08-23, the probe
	// succeeded at 12:42:37 and a look decided at 12:43:25 still carried
	// plan_verified=false with no layer-FX viz drawn in five minutes of show.
	//
	// Losing: the same reconcile is what releases DJ-owned fields whose
	// capability just went away, which until now happened only on a settings
	// save.
	//
	// Asynchronous on purpose. This runs on the config-coalescer goroutine as
	// well as the activation path, and reconfigureActiveDJ can push a config of
	// its own when it releases an overlay family — doing that inline would have
	// the coalescer waiting on a channel only it drains. The generation guards
	// inside reconfigureActiveDJ make a late or superseded run a no-op, which is
	// exactly what makes deferring it safe.
	if changed && djRunning {
		go func() {
			if err := m.reconfigureActiveDJ(userID); err != nil {
				log.Printf("[MUSIC-DJ] Capability reconcile failed (show continues): %v", err)
			}
		}()
	}
	if source != "serial" {
		m.upgradeCapabilityToSerialAsync()
	}
}

// upgradeCapabilityToSerialAsync keeps asking SERIAL after an HTTP answer has
// already latched, until the hello lands or the horizon expires.
//
// WHY IT IS NEEDED, measured live 2026-08-23 on the first flash carrying the
// music_* hello keys. The capability probe runs at ACTIVATION; the serial
// transaction hello landed 32 SECONDS later:
//
//	15:05:34  probe -> serial unanswered, HTTP answered      (correct fallback)
//	15:06:06  [MUSIC-TRANSPORT] udp -> serial (capability confirmed)
//
// The fallback did the right thing, but fwColorDynamicsProbed then latched and
// nothing asked serial again — so a desk with the new firmware kept sourcing
// its capability from the wifi endpoint the flash existed to stop depending on.
//
// SERIAL ONLY. It must not re-run the HTTP probe: that answer is already in
// hand, and polling this for a minute would put ~20 needless requests on the
// exact link being retired. Once the hello has landed, txnCapability answers
// from its port-generation cache, so these are nearly free.
//
// A serial answer SUPERSEDES the HTTP one even when the flags are identical —
// applyCapabilityAnswer records the source, and "the same verdict, now from the
// transport that carries the writes" is a different and better-founded state.
// capabilityAnswerIsFinal reports whether the latched capability came from the
// authoritative source. An HTTP answer is a working fallback, never the end of
// the question while the serial transport is in use.
func (m *MusicModeService) capabilityAnswerIsFinal() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.fwColorDynamicsProbed && m.fwCapsFromSerial
}

func (m *MusicModeService) upgradeCapabilityToSerialAsync() {
	if !ergoled.ActiveMode().UsesSerial() {
		return // HTTP is the correct source for this configuration, not a shortfall
	}
	m.mu.Lock()
	if m.fwCapSerialUpgrading || m.fwCapsFromSerial || !m.active {
		m.mu.Unlock()
		return
	}
	m.fwCapSerialUpgrading = true
	m.mu.Unlock()

	go func() {
		defer func() {
			m.mu.Lock()
			m.fwCapSerialUpgrading = false
			m.mu.Unlock()
		}()
		deadline := time.Now().Add(capabilitySerialUpgradeHorizon)
		for time.Now().Before(deadline) {
			time.Sleep(capabilitySerialUpgradeInterval)
			m.mu.RLock()
			stop := !m.active || m.fwCapsFromSerial
			m.mu.RUnlock()
			if stop {
				return
			}
			if a, ok := probeMusicCapsSerial(); ok {
				m.applyCapabilityAnswer(a.ColorDynamics, a.ColorBursts, a.LayerFx, "serial")
				return
			}
		}
		log.Printf("[MUSIC-MODE-CONFIG] Serial capability never answered within %v; "+
			"staying on the HTTP answer (firmware may predate the music_* hello keys)",
			capabilitySerialUpgradeHorizon)
	}()
}

// capabilityProbeRetries / capabilityProbeBackoff bound the background retry
// started when the activation probe gets no answer.
//
// Sized from the same 2026-08-23 measurement as the timeout. Per-request
// failure on this desk runs about 9% (12 of 137 logged HTTP requests to this
// endpoint), and a miss costs the WHOLE session its layer FX — a lopsided
// enough cost to be worth three cheap extra attempts even at that rate. It
// stops early the moment one answers.
//
// The alternative was to lean on the coalescer self-heal alone, which retries
// on the next successful config send. That works — measured healing at 12:42:37
// after a 12:41:01 miss — but it is 96 seconds of degraded deck, and it is only
// as frequent as config traffic, which a show with every variation family off
// barely generates.
const (
	capabilityProbeRetries = 3
	capabilityProbeBackoff = 3 * time.Second

	// The serial hello landed 32s after activation on the measured boot, so the
	// horizon is generous next to that; the interval is loose because after the
	// hello lands the probe is a cache hit and before it lands nothing is
	// gained by asking faster.
	capabilitySerialUpgradeInterval = 5 * time.Second
	capabilitySerialUpgradeHorizon  = 3 * time.Minute

	// configBeliefTTL bounds how long "the desk already has this" is trusted
	// without corroboration. Port generation catches a severed handle, but a
	// brown-out that leaves the port open, or the HTTP path where there is no
	// generation at all, would be invisible — so the belief expires and the
	// desk gets an unconditional refresh.
	//
	// Two minutes against a phrase cadence of 15-30s: most repeats inside a
	// phrase run are still suppressed, and a desk that silently lost its tuning
	// is corrected within one refresh rather than never.
	configBeliefTTL = 2 * time.Minute
)

// retryCapabilityProbeAsync re-probes in the background after an unanswered
// activation probe. At most one runs at a time (fwCapRetrying), so repeated
// activations cannot stack goroutines all asking the same question.
//
// Deliberately does NOT hold the answer up: probeColorDynamicsSupport reconciles
// the running conductor itself when it finally lands, so a late success repairs
// the deck rather than merely recording a flag nobody re-reads.
func (m *MusicModeService) retryCapabilityProbeAsync() {
	m.mu.Lock()
	if m.fwCapRetrying || m.fwColorDynamicsProbed || !m.active {
		m.mu.Unlock()
		return
	}
	m.fwCapRetrying = true
	m.mu.Unlock()

	go func() {
		defer func() {
			m.mu.Lock()
			m.fwCapRetrying = false
			m.mu.Unlock()
		}()
		for attempt := 1; attempt <= capabilityProbeRetries; attempt++ {
			time.Sleep(capabilityProbeBackoff)
			m.mu.RLock()
			// Stop if music mode ended, or if the coalescer self-heal
			// beat us to it — either way there is nothing left to ask.
			giveUp := !m.active || m.fwColorDynamicsProbed
			m.mu.RUnlock()
			if giveUp {
				return
			}
			if m.probeColorDynamicsSupport() {
				log.Printf("[MUSIC-MODE-CONFIG] Capability settled on retry %d/%d", attempt, capabilityProbeRetries)
				return
			}
		}
		log.Printf("[MUSIC-MODE-CONFIG] Capability still unknown after %d retries; the coalescer self-heal remains the fallback", capabilityProbeRetries)
	}()
}

// ColorDynamicsSupported reports whether the firmware echoes the color-dynamics keys.
func (m *MusicModeService) ColorDynamicsSupported() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.fwColorDynamicsSupported
}

// ColorBurstsSupported reports whether the firmware echoes the color-burst keys (burstRate).
func (m *MusicModeService) ColorBurstsSupported() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.fwColorBurstsSupported
}

// LayerFxSupported reports whether the firmware echoes the Music Mode 2.0 keys
// (comfortMode) — i.e. layer FX 37-40 and the v2 audio packet are available.
func (m *MusicModeService) LayerFxSupported() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.fwLayerFxSupported
}

// enqueueConfig sends a config to the coalescer (non-blocking, latest-wins).
func (m *MusicModeService) enqueueConfig(cfg FirmwareMusicConfig) {
	select {
	case m.configCh <- cfg:
		return
	default:
	}
	// Channel full — drain and retry
	select {
	case <-m.configCh:
	default:
	}
	select {
	case m.configCh <- cfg:
	default:
	}
}

// configCoalescer is the background goroutine that coalesces rapid config updates.
// Drains configCh, waits 100ms for more updates, then sends latest to firmware.
func (m *MusicModeService) configCoalescer() {
	defer m.configWg.Done()

	for {
		select {
		case <-m.configCtx.Done():
			return
		case latestCfg := <-m.configCh:
			// Got first config — start coalescing window
			timer := time.NewTimer(100 * time.Millisecond)
		drain:
			for {
				select {
				case <-m.configCtx.Done():
					timer.Stop()
					return
				case cfg := <-m.configCh:
					latestCfg = cfg // latest-wins
				case <-timer.C:
					break drain
				}
			}

			// Check if we should send
			m.mu.RLock()
			shouldSend := m.active && m.fwConfigSupported
			m.mu.RUnlock()

			if shouldSend && m.skipRedundantConfig(latestCfg) {
				shouldSend = false
			}
			if shouldSend {
				if ok, _ := m.sendFirmwareConfig(latestCfg); ok {
					m.noteConfigLanded(latestCfg)
					// Self-heal: the activation probe is one shot, and on a lossy
					// wifi desk it can miss. Retry while still unknown so the first
					// reachable moment settles capabilities, instead of the session
					// running blind until the next activation.
					m.mu.RLock()
					probed := m.fwColorDynamicsProbed
					m.mu.RUnlock()
					if !probed {
						m.probeColorDynamicsSupport()
					}
				}
			}
		}
	}
}

// noteConfigRedundancy counts how many tuning writes carry a config the
// firmware already has. IT SUPPRESSES NOTHING.
//
// WHY MEASURE BEFORE DEDUPING. ~111 config POSTs land per session and none of
// them is compared against what the desk already holds, so an unknown fraction
// are pure repeats — they cost a request each on the wifi endpoint that drops
// about 9% of them, and they would cost a 250ms-paced logical write each if the
// channel moves to serial. Skipping them looks like free money.
//
// It is not free, and the hazard is why this only counts. A dedup cache is a
// claim about what the DEVICE holds, and the device can lose that claim without
// telling the host: an ESP32 that browns out and reboots mid-session comes back
// with compile-time defaults, and a host that believes it already sent the
// config would never resend it. The desk would run the whole session on stale
// tuning with every host counter reading healthy — the same shape as the
// capability bug that started tonight, where a provisional belief was latched
// as fact.
//
// Doing it safely needs an invalidation signal for "the device may have
// restarted" — port generation for serial, and something else for HTTP — which
// is a design, not a one-liner. So: learn the redundancy RATE first. If it is
// small, the whole idea is not worth the hazard.
func (m *MusicModeService) skipRedundantConfig(cfg FirmwareMusicConfig) bool {
	gen := ergoled.CachedCapability().Generation

	m.mu.Lock()
	defer m.mu.Unlock()
	m.fwConfigSends++

	// Comparable struct (all scalars plus [8]uint8), so == is the whole check.
	// A NaN float compares unequal to itself and therefore always SENDS, which
	// is the safe direction; validate() rejects NaN anyway.
	same := m.fwSentConfigValid && cfg == m.fwSentConfig
	// The belief is about a DEVICE. A new port generation means the handle was
	// replaced — a reopen, or an ESP32 that rebooted — and whatever that device
	// holds, it is not what we sent the last one.
	sameDevice := gen == m.fwSentConfigGen
	// Backstop for every signal we do not have. HTTP has no generation to
	// watch, and a brown-out that does not sever the port would be invisible,
	// so the belief expires on its own and the desk is refreshed unconditionally.
	fresh := time.Since(m.fwSentConfigAt) < configBeliefTTL

	if !(same && sameDevice && fresh) {
		return false
	}
	m.fwConfigSkipped++
	if m.fwConfigSkipped%10 == 0 {
		log.Printf("[MUSIC-MODE-CONFIG] Suppressed %d of %d tuning writes the desk already had",
			m.fwConfigSkipped, m.fwConfigSends)
	}
	return true
}

// noteConfigLanded records what the desk received, and under which handle.
// Called ONLY after a successful transmission: a send that failed says nothing
// about what the device holds, so the belief must not advance and the next
// write goes out unconditionally.
func (m *MusicModeService) noteConfigLanded(cfg FirmwareMusicConfig) {
	gen := ergoled.CachedCapability().Generation
	m.mu.Lock()
	m.fwSentConfig = cfg
	m.fwSentConfigValid = true
	m.fwSentConfigGen = gen
	m.fwSentConfigAt = time.Now()
	m.mu.Unlock()
}

// invalidateConfigBelief forgets what the desk is thought to hold, so the next
// write is unconditional. Called at activation, where the firmware may have
// been power-cycled since the last session and its state is simply unknown.
func (m *MusicModeService) invalidateConfigBelief() {
	m.fwSentConfigValid = false // caller holds m.mu
}

// UpdateFirmwareConfig applies a partial tuning config update.
func (m *MusicModeService) UpdateFirmwareConfig(userID int, patch FirmwareMusicConfigPatch) (TuningUpdateResult, error) {
	if err := patch.validate(); err != nil {
		return TuningUpdateResult{}, err
	}

	var cfgSnap FirmwareMusicConfig
	var cfgOut FirmwareMusicConfig
	var isActive, isOwner, supported bool

	m.mu.Lock()
	m.desiredConfig.applyPatch(patch)
	cfgOut = m.desiredConfig
	isActive = m.active
	isOwner = m.active && m.userID == userID
	supported = m.fwConfigSupported
	if isOwner {
		m.activeConfig.applyPatch(patch)
		// A user write releases DJ ownership of every touched field (and
		// user-locks it for the session) BEFORE transmission, so a
		// concurrent DJ phrase change can never reclaim/overwrite it.
		m.releaseDJOverlayForPatchLocked(patch)
		cfgSnap = m.composeEffectiveConfigLocked()
	}
	m.mu.Unlock()

	result := TuningUpdateResult{
		Applied: true,
		Config:  cfgOut,
	}

	switch {
	case !isActive:
		result.Reason = "deferred_until_activation"
	case isActive && !isOwner:
		result.Reason = "deferred_other_user_active"
	case isOwner && !supported:
		result.Reason = "unsupported_firmware"
	case isOwner && supported:
		m.enqueueConfig(cfgSnap)
		result.QueuedToFirmware = true
	}

	return result, nil
}

// ResetFirmwareConfig resets tuning config to factory defaults.
func (m *MusicModeService) ResetFirmwareConfig(userID int) (TuningUpdateResult, error) {
	var cfgSnap FirmwareMusicConfig
	var cfgOut FirmwareMusicConfig
	var isActive, isOwner, supported bool

	m.mu.Lock()
	m.desiredConfig = defaultFirmwareMusicConfig()
	cfgOut = m.desiredConfig
	isActive = m.active
	isOwner = m.active && m.userID == userID
	supported = m.fwConfigSupported
	if isOwner {
		m.activeConfig = m.desiredConfig
		// Reset relinquishes EVERY DJ-owned field: the user explicitly went
		// back to factory tuning, so the DJ may not repaint any of it this
		// session.
		//
		// UNCONDITIONAL while the DJ is enabled — deliberately not gated on
		// the overlay being non-empty. An empty overlay does not mean the DJ
		// owns nothing; it means the DJ happens to be playing something that
		// writes no tuning right now — the built-in "chill" program never
		// touches the overlay at all. Reset during such a phrase used to lock
		// nothing, and the DJ reclaimed every field on the next switch, which
		// is the opposite of what "back to factory tuning" asked for.
		if m.djEnabled {
			if m.djTuningUserLocked == nil {
				m.djTuningUserLocked = map[string]bool{}
			}
			for _, k := range djOverlayEligibleKeys {
				m.djTuningUserLocked[k] = true
			}
		}
		m.djTuningOverlay = nil
		cfgSnap = m.activeConfig
	}
	m.mu.Unlock()

	result := TuningUpdateResult{
		Applied: true,
		Config:  cfgOut,
	}

	switch {
	case !isActive:
		result.Reason = "deferred_until_activation"
	case isActive && !isOwner:
		result.Reason = "deferred_other_user_active"
	case isOwner && !supported:
		result.Reason = "unsupported_firmware"
	case isOwner && supported:
		m.enqueueConfig(cfgSnap)
		result.QueuedToFirmware = true
	}

	return result, nil
}

// GetFirmwareConfig returns the current shared desired config.
func (m *MusicModeService) GetFirmwareConfig() FirmwareMusicConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.desiredConfig
}
