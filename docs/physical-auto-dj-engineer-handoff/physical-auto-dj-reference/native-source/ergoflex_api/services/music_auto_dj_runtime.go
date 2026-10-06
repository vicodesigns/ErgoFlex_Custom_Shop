// services/music_auto_dj_runtime.go
// The Auto DJ runtime model: the shared, replaceable configuration the
// conductor plays from, the dual-generation lifecycle that makes program
// switches atomic (the old show survives slow/failed resolves), and the
// batch resolution of "You Are The DJ" settings into a weighted deck.
//
// Concurrency contract (lock order: djApplyMu → mu):
//   - djRequestGen orders competing async resolves; djGen changes only on a
//     successful install or a disable. A resolve that loses the generation
//     race aborts silently — the newest request wins, and a failed or slow
//     program change leaves the current conductor running (never silence).
//   - djRuntime is replaced, never mutated; djRuntimeRev bumps on every swap
//     so a conductor tick that straddles a swap discards its stale action.
//   - djApplyMu serializes runtime swaps with look application — the revision
//     recheck alone is not enough because applyConfigPartial unlocks mu
//     during ErgoLED I/O.

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"ergoflex_api/models"
	"ergoflex_api/ws_clients"
)

// DJSettingsStore persists the custom program + flash comfort
// (user_settings.music_auto_dj_settings / music_flash_comfort, migration 194).
type DJSettingsStore interface {
	// GetMusicAutoDJSettings returns every Auto DJ preference in one read.
	// The DTO lives in models because services imports database, so a type
	// declared here and named in a database signature would be a cycle.
	GetMusicAutoDJSettings(ctx context.Context, userID int) (models.MusicAutoDJStored, error)
	SaveMusicAutoDJSettings(ctx context.Context, userID int, settings json.RawMessage) error
	SaveFlashComfort(ctx context.Context, userID int, mode int) error
	SaveMusicBeatAlign(ctx context.Context, userID int, on bool) error
}

// MusicFavoritesSource / CustomPresetSource are the narrow, user-scoped batch
// loaders the resolver needs — interfaces (not concrete repos) so tests inject
// fakes, mirroring SettingsGetter. Both queries are scoped to userID, which is
// why an unknown ref (deleted vs foreign — indistinguishable) is always just a
// stale tombstone, never an ownership probe.
type MusicFavoritesSource interface {
	GetAll(ctx context.Context, userID int) ([]models.MusicModeFavorite, error)
}
type CustomPresetSource interface {
	GetByUserID(ctx context.Context, userID int) ([]models.CustomPreset, error)
}

// SetDJSettingsStore wires the settings persistence (main.go).
func (m *MusicModeService) SetDJSettingsStore(s DJSettingsStore) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.djSettingsStore = s
}

// SetMusicFavoritesSource wires the favorites batch loader (main.go).
func (m *MusicModeService) SetMusicFavoritesSource(s MusicFavoritesSource) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.djFavSource = s
}

// SetCustomPresetSource wires the custom-preset batch loader (main.go).
func (m *MusicModeService) SetCustomPresetSource(s CustomPresetSource) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.djPresetSource = s
}

// djBaseline is the user's own base look, captured the moment the DJ takes
// over (any program) and preserved across program switches, reconfigures and
// re-enables — a re-snapshot mid-show would capture a DJ-authored live state
// as "the user's own". Two jobs:
//   - custom picks materialize their palette/speed from the preset's stored
//     values or this baseline — never nil — so a preset's palette can't bleed
//     into the next builtin look;
//   - resume snapshots use it to mask the transient DJ look back to what the
//     user actually chose (GetResumeConfig).
type djBaseline struct {
	visualMode int
	paletteID  int
	upalRef    string // the user's music-wide user palette at DJ start ("" = none)
	speed      int
	intensity  int
	// segs is the user's own per-segment override canvas at DJ start. A look
	// that generates its own segment overrides writes over it; the next look
	// that generates none restores it (or a neutral all-clear when the user
	// had none) so DJ-generated overrides never bleed into a later look.
	// Resume snapshots use it the same way viz/palette are masked.
	segs []MusicSegmentConfig
}

// djRuntimeConfig is the single source of truth for what the conductor is
// playing. Guarded by m.mu; replaced (never mutated in place) on reconfigure.
type djRuntimeConfig struct {
	programKey   string
	program      AutoDJProgram
	flashComfort FlashComfortMode
	settings     *DJSettings // custom only; canonical source
	baseline     djBaseline  // custom only
	// planVerified records whether layer-FX capability was KNOWN AND
	// SUPPORTED when this runtime was built.
	//
	// It exists because permissive rendering is fine and permissive
	// MEASUREMENT is not. While the capability is unknown the desk may ignore
	// per-segment effects, so a recorded five-tier plan can describe something
	// that never reached the strip — exactly the kind of confident, wrong
	// number this work is trying not to produce. The audit script excludes
	// unverified dwell from composition-active time rather than counting it.
	planVerified bool
}

// DJNowPlaying is the current look snapshot for status payloads and the
// settings sheet — stored on the service so opening the sheet never waits for
// the next WS event.
type DJNowPlaying struct {
	Viz   int    `json:"viz"`
	RefID string `json:"ref_id"`
	// BaseRefID is the pool entry behind RefID — the same value for an
	// ordinary look, the source preset for a remix (whose RefID carries a
	// "@viz<N>" suffix). The settings sheet matches its "playing now" border
	// on THIS, so a remix still lights up the card it came from.
	BaseRefID string `json:"base_ref_id"`
	Label     string `json:"label"`
	LookKind  string `json:"look_kind"`
	Program   string `json:"program"`
	Reason    string `json:"reason"`
	// TierPlan is the RESOLVED plan: five concrete visualizations, one per
	// physical tier, with nothing left to infer. An uncomposed look is the
	// base visualization five times rather than an absent field, so the sheet
	// bootstrap and the live WS frame describe a look the same way.
	TierPlan   [djNumTiers]int `json:"tier_plan"`
	RecipeID   string          `json:"recipe_id,omitempty"`
	RecipeName string          `json:"recipe_name,omitempty"`
	// Which variation recipe each family contributed, "" when it contributed
	// nothing — including the sliders' resting member, which by design leaves
	// the look's own values alone and so is not a variation to report.
	// SliderID is the BASE look's slider draw, governing the tiers that
	// inherit it. TierSliderIDs is what each REPLACED tier drew for its own
	// effect — a different question, and one a single id cannot answer for a
	// mixed composition.
	SliderID      string             `json:"slider_id,omitempty"`
	TierSliderIDs [djNumTiers]string `json:"tier_slider_ids"`
	BurstRecipeID string             `json:"burst_recipe_id,omitempty"`
	// Separate from BurstRecipeID because it follows a different enable:
	// Reduced clears bursts but deliberately keeps randomize.
	RandomizeRecipeID string `json:"randomize_recipe_id,omitempty"`
	PhysicsRecipeID   string `json:"physics_recipe_id,omitempty"`
	// PlanVerified is false while layer-FX capability is unknown, meaning the
	// desk may not have rendered TierPlan as described. See
	// djRuntimeConfig.planVerified.
	PlanVerified bool      `json:"plan_verified"`
	Since        time.Time `json:"since"`
	// RenderSent is the last music write SENT while this look was on the strips (see
	// music_dj_render.go). For a look that has left, it is that look's final render.
	RenderSent *DJRenderSent `json:"render_sent,omitempty"`
	// Tuning is the last music TUNING call (physics, dynamics, bursts) while this look was up,
	// with whether it was delivered (music_dj_tuning.go). A look that has left keeps its final one.
	Tuning *DJTuningRecord `json:"tuning,omitempty"`
	// DynamicsMood is the colour-dynamics mood the DJ layered on this look (index into the mode's
	// mood list), nil when none was applied.
	DynamicsMood *int `json:"dynamics_mood,omitempty"`
}

// DJNowPlayingSnapshot returns a copy of the current look (nil when the DJ is
// off or hasn't switched yet).
func (m *MusicModeService) DJNowPlayingSnapshot() *DJNowPlaying {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.djNowPlaying == nil {
		return nil
	}
	cp := *m.djNowPlaying
	return &cp
}

// installDJNowPlaying publishes a freshly landed look and retires the one it
// replaces into djPrevLook, in the SAME lock hold. Reports whether the
// publish landed — false when a newer generation superseded gen, mirroring
// the `m.djGen == gen` guard every other apply-time write already uses; the
// caller silently drops its update either way, exactly as the inline form
// did before this was extracted.
//
// The retiring step exists for the rating endpoint (migration 246,
// services/music_dj_rating.go): a tap shortly after a switch is plausibly
// about the look that JUST left the strip, and prev_look is how that
// ambiguity is recorded instead of guessed away. Capturing it anywhere but
// HERE — inside the same critical section that overwrites djNowPlaying —
// would race the very switch it is supposed to describe: a reader that
// snapshots djNowPlaying and djPrevLook as two separate lock holds can have
// this swap land in between, pairing the NEW look with an already-stale
// djPrevLook (or the OLD look with a djPrevLook this swap hasn't written
// yet) — a "look, prev_look" pair that never coexisted on the desk.
func (m *MusicModeService) installDJNowPlaying(gen uint64, np *DJNowPlaying) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Whatever happens to this install, the switch's write is no longer in flight.
	m.djSwitchRendering = false
	if m.djGen != gen {
		return false
	}
	if m.djNowPlaying != nil {
		m.retireDJLookLocked(*m.djNowPlaying)
	}
	// The newest write is what the strips show as this look arrives: on a switch, its own write.
	if np.RenderSent == nil {
		np.RenderSent = m.lastRenderSent
	}
	if np.Tuning == nil {
		np.Tuning = m.lastTuning
	}
	m.djNowPlaying = np
	return true
}

// djRecentLooksMax bounds the session-scope window. Eight looks is roughly
// two to four minutes at the phrase cadence (djHardFloorSec plus rotation) —
// long enough to describe "this stretch" as a person would mean it, short
// enough that the window is not quietly summarising a whole different piece
// of music than the one they are reacting to.
const djRecentLooksMax = 8

// retireDJLookLocked records a look that is leaving the strip: as djPrevLook
// (the attribution pair a look-scope rating needs) and as the newest entry in
// the session-scope window. Caller MUST hold m.mu for writing.
//
// One helper rather than two assignments at each site, because the two
// structures answer the same question at different lengths and a site that
// updated only one would silently make session-scope ratings describe a
// window with holes in it.
func (m *MusicModeService) retireDJLookLocked(prev DJNowPlaying) {
	cp := prev
	m.djPrevLook = &cp
	m.djRecentLooks = append(m.djRecentLooks, prev)
	if len(m.djRecentLooks) > djRecentLooksMax {
		// Copy forward rather than reslicing off the front: reslicing keeps
		// the retired entries alive behind the window and grows the backing
		// array without bound over a long show.
		m.djRecentLooks = append(m.djRecentLooks[:0], m.djRecentLooks[len(m.djRecentLooks)-djRecentLooksMax:]...)
	}
}

// DJPlayCounts returns this session's per-look play counts when a deck-backed
// program is running (nil otherwise).
func (m *MusicModeService) DJPlayCounts() map[string]int {
	m.mu.RLock()
	runtime := m.djRuntime
	m.mu.RUnlock()
	if runtime == nil {
		return nil
	}
	// Interface, not *djDeck: a decorated selector (remix) must still report
	// counts, and a concrete assertion would return nil for it in silence.
	if rec, ok := runtime.program.Selector.(djPlayRecorder); ok {
		return rec.snapshot()
	}
	return nil
}

// djStoreCtx is the timeout for DJ settings DB round-trips (resolution runs
// outside every lock, so a slow DB delays only the requested change — the
// running show is untouched).
func djStoreCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 5*time.Second)
}

// loadFlashComfort reads the persisted comfort mode; failures degrade to
// Standard with a log line (comfort must never block enabling a show).
// loadDJStored is the ONE read of the Auto DJ side table.
//
// Every preference arrives together — custom program, Flash Comfort, beat align
// — because an enable needs all three and the custom path used to hit the table
// twice for a single call.
func (m *MusicModeService) loadDJStored(userID int) (models.MusicAutoDJStored, error) {
	m.mu.RLock()
	store := m.djSettingsStore
	m.mu.RUnlock()
	if store == nil {
		return models.MusicAutoDJStored{}, fmt.Errorf("%w: custom Auto DJ settings storage is not available", ErrMusicModeValidation)
	}
	ctx, cancel := djStoreCtx()
	defer cancel()
	stored, err := store.GetMusicAutoDJSettings(ctx, userID)
	if err != nil {
		return models.MusicAutoDJStored{}, fmt.Errorf("loading custom Auto DJ settings: %w", err)
	}
	return stored, nil
}

// loadFlashComfort keeps its old defaulting contract for the GET route: a read
// failure is standard comfort, never a refusal.
func (m *MusicModeService) loadFlashComfort(userID int) FlashComfortMode {
	stored, err := m.loadDJStored(userID)
	if err != nil {
		log.Printf("[MUSIC-DJ] Flash comfort load failed (defaulting to standard): %v", err)
		return FlashComfortOff
	}
	return FlashComfortFromInt(stored.FlashComfort)
}

// loadBeatAlign mirrors loadFlashComfort for the GET route: an unreadable
// preference is OFF, which is the byte-identical-to-before behaviour.
func (m *MusicModeService) loadBeatAlign(userID int) bool {
	stored, err := m.loadDJStored(userID)
	if err != nil {
		log.Printf("[MUSIC-DJ] Beat align load failed (defaulting to off): %v", err)
		return false
	}
	return stored.BeatAlign
}

// djSettingsFromStored normalizes + validates the persisted custom program.
func djSettingsFromStored(stored models.MusicAutoDJStored) (DJSettings, error) {
	if len(stored.Settings) == 0 {
		return DJSettings{}, fmt.Errorf("%w: no custom Auto DJ settings saved yet — configure your pool first", ErrMusicModeValidation)
	}
	var s DJSettings
	if err := json.Unmarshal(stored.Settings, &s); err != nil {
		return DJSettings{}, fmt.Errorf("%w: saved custom Auto DJ settings are unreadable", ErrMusicModeValidation)
	}
	// normalizedForRead, not Normalized: a dynamics_mode this build does not
	// recognise must degrade to the legacy derivation rather than make the
	// settings sheet unloadable. Validate still rejects it on the way IN.
	n := s.normalizedForRead()
	if err := n.Validate(); err != nil {
		return DJSettings{}, err
	}
	return n, nil
}

// loadDJSettings reads + normalizes + validates the persisted custom program.
func (m *MusicModeService) loadDJSettings(userID int) (DJSettings, error) {
	stored, err := m.loadDJStored(userID)
	if err != nil {
		return DJSettings{}, err
	}
	return djSettingsFromStored(stored)
}

// djLookFromMusicConfig converts a stored music config (a favorite payload or
// a preset's "music" sub-object) into (look, palette, speed). Stored JSON is
// NOT trusted: every field runs through the same bounds as live config
// updates, and any violation rejects the look (ok=false → skipped).
// Palette/speed materialize from the baseline when the config omits them.
func djLookFromMusicConfig(upd MusicConfigUpdate, baseline djBaseline) (look DJLook, pal, speed *int, ok bool) {
	if upd.Visualization == nil || *upd.Visualization < 0 || *upd.Visualization > 9 {
		return DJLook{}, nil, nil, false
	}
	look = DJLook{Viz: *upd.Visualization}
	if upd.Intensity != nil {
		if *upd.Intensity < 0 || *upd.Intensity > 255 {
			return DJLook{}, nil, nil, false
		}
		look.Ix = upd.Intensity
	}
	p := baseline.paletteID
	if upd.PaletteID != nil {
		if *upd.PaletteID < 0 || *upd.PaletteID > 21 {
			return DJLook{}, nil, nil, false
		}
		p = *upd.PaletteID
	}
	s := baseline.speed
	if upd.Speed != nil {
		if *upd.Speed < 0 || *upd.Speed > 255 {
			return DJLook{}, nil, nil, false
		}
		s = *upd.Speed
	}
	return look, &p, &s, true
}

// hasColorIdentity reports whether a look carries colours OF ITS OWN — the
// precondition for remixing it onto a different effect.
//
// Two tempting shortcuts are both wrong, and wrong in opposite directions:
//
//   - `len(segs) > 0` over-reports. User 26's six music favourites each store
//     eight segment configs of the form {"id":0,"on":true} — a non-empty slice
//     carrying no paint whatsoever. Remixing one would move nothing.
//   - `kind != builtin` over-reports too: a favourite with neither segment
//     colours nor an explicit palette inherits the session baseline, so there
//     is nothing of its own to travel.
//
// A segment `pal` counts because sanitizeRemixSegs deliberately preserves it as
// part of the painting; leaving it out here would sanitize a palette-only
// segment painting correctly and then never let it remix.
func hasColorIdentity(segs []MusicSegmentConfig, globalPal *int, baseline djBaseline) bool {
	for _, s := range segs {
		if s.Col != nil || s.Pal != nil {
			return true
		}
	}
	// An explicit palette is identity only when it differs from what the look
	// would have inherited anyway.
	return globalPal != nil && *globalPal != baseline.paletteID
}

// djSanitizeStoredSegs keeps ID, Col and Pal from a stored look's segment
// overrides and drops everything else. Auto DJ effects originate ONLY from the
// resolved base visualization and the tier recipe; a stored payload contributes
// colour and nothing more.
//
// SAFETY is the first reason. A stored segment may carry FX, and
// validateMusicSegmentConfigs admits 0-33. FX 22 is the STATIC Strobe:
// fxStrobe contains no comfortMode reference at all, so it free-runs with none
// of the 350ms full-field flash floor that guards the music strobe, the burst
// path and the drop. Classification cannot close that hole —
// applyFlashComfortToPool handles Reduced and Minimal and returns the pool
// untouched under Standard, which is the default.
//
// HONESTY is the second, and it bites even for a perfectly valid stored MUSIC
// fx. Segments 1 and 2 share physical tier 1, so a preset could store Tower on
// one and Ripple on the other — both legal — and any five-tier plan the DJ
// reports would then be a fiction about a shelf that is actually running two
// effects. Stripping unconditionally is what makes the reported plan true.
//
// On/Reverse/Mirror go too, which is a deliberate semantic call rather than
// caution: the DJ does not own whether a segment is lit. A stored look that
// dark-shelves a tier is neither honoured nor inverted — the key is simply
// never emitted, and MusicSegmentConfig's pointer+omitempty fields make
// "absent" distinguishable from "present at false" on the wire.
//
// Scope is the Auto DJ pool alone. Applying a preset outside the DJ still
// honours everything it stored (see [MusicSegsFromWledPayload] and the manual
// apply path). The input is never mutated — cloneMusicSegmentConfigs deep-copies
// every pointer first.
// A segment left with nothing but an ID is DROPPED, and an all-paintless
// slice becomes nil rather than an empty-but-non-nil one. That is not tidiness
// — two call sites branch on nil-ness and both get the wrong answer otherwise:
//
//   - resolveDJSettings only falls back to a preset's ErgoLED colours when its
//     music sub-object yielded nil, so a preset storing eight {"id":n,"on":true}
//     segments (the exact shape user 26's favourites carry) would suppress its
//     own colours and play as a same-palette twin;
//   - rotate() treats a non-empty slice as "this look paints", skipping
//     stampSegRestore — so the PREVIOUS look's colours stay on the strip.
//
// sanitizeRemixSegs already encoded this rule for the remix path. Rather than
// keep two copies of one rule, that function is now the single implementation
// and this one delegates.
func djSanitizeStoredSegs(in []MusicSegmentConfig) []MusicSegmentConfig {
	return sanitizeRemixSegs(in)
}

// djSegsFromMusicConfig returns a validated, SANITIZED copy of a stored
// payload's explicit segment overrides (nil when absent or malformed).
//
// Sanitized, not merely copied: see [djSanitizeStoredSegs]. Both Auto DJ pool
// sources funnel through here, so the invariant holds for favourites and
// presets alike; TestDJPoolPicksCarryOnlyColour asserts it at the pool.
func djSegsFromMusicConfig(upd MusicConfigUpdate) []MusicSegmentConfig {
	if len(upd.SegmentConfigs) == 0 {
		return nil
	}
	if err := validateMusicSegmentConfigs(upd.SegmentConfigs); err != nil {
		return nil
	}
	return djSanitizeStoredSegs(upd.SegmentConfigs)
}

// MusicSegsFromWledPayload is the exported form of [djSegsFromWledPayload], for
// callers outside this package that apply a stored music preset.
//
// It exists because the Auto DJ and the manual "tap a preset" route disagreed
// about where a music preset's colors live, and only the DJ was right. The
// route read colors solely from the music sub-object's segment_configs — a key
// that NO stored preset actually carries (0 of 23 for user 26 on 2026-08-21) —
// so tapping from one preset to the next changed speed, intensity and
// sensitivity while every color stayed put. Since every one of those presets is
// also visualization 0 / palette 0, the strip had nothing left to change, and
// the selection read as "not taking".
//
// The DJ never had the bug because it already falls back to the ErgoLED body. This
// makes the same fallback reachable from the route rather than growing a second
// copy of the extraction rules.
func MusicSegsFromWledPayload(wledRaw json.RawMessage) []MusicSegmentConfig {
	return djSegsFromWledPayload(wledRaw)
}

// djSegsFromWledPayload extracts per-segment colors from a music preset's
// stored ErgoLED body ({"seg":[{"id":0,"col":[[r,g,b,w]×3]},…]}). A music
// preset's viz/palette/speed live in its music sub-object, but its COLOR
// identity (typically pal 0 + hand-picked colors) lives only here. Malformed
// entries are skipped; nil when nothing usable remains.
func djSegsFromWledPayload(wledRaw json.RawMessage) []MusicSegmentConfig {
	if len(wledRaw) == 0 {
		return nil
	}
	var body struct {
		Seg []struct {
			ID  *int            `json:"id"`
			Col json.RawMessage `json:"col"`
		} `json:"seg"`
	}
	if err := json.Unmarshal(wledRaw, &body); err != nil {
		return nil
	}
	segs := make([]MusicSegmentConfig, 0, 8)
	for i, s := range body.Seg {
		id := i
		if s.ID != nil {
			id = *s.ID
		}
		if id < 0 || id > 7 || len(s.Col) == 0 {
			continue
		}
		var col RGBWStops
		if err := json.Unmarshal(s.Col, &col); err != nil {
			continue
		}
		c := col
		segs = append(segs, MusicSegmentConfig{ID: id, Col: &c})
	}
	if len(segs) == 0 {
		return nil
	}
	return segs
}

// djNeutralRestoreCol is asserted on every segment when a colorless pick
// restores the canvas and there is no pre-music scene snapshot to fall back on.
// It exists purely so the payload ACTIVELY overwrites the firmware's persistent
// per-segment col: JsonHelpers.hpp parses "col" behind a containsKey() guard, so
// an OMITTED key keeps whatever was last written — a preset's colors would stay
// live on every subsequent builtin look.
//
// White, not black: with djCustomBuiltinPalettes in play this value is
// unrenderable (PaletteEngine::colorFromPalette only reads seg.col for pal
// 0/20/21), so on the rare path where it does surface it should fail visible
// rather than dark. This is a light show.
var djNeutralRestoreCol = RGBWStops{{255, 255, 255, 0}, {255, 255, 255, 0}, {255, 255, 255, 0}}

// baselineSegCanvas is what a look that generates no segment overrides writes
// over the previous look's: the user's own overrides from DJ start, else a
// neutral all-segments canvas (applyConfigPartial replaces the stored
// overrides wholesale).
//
// sceneColors reports whether the pre-music scene snapshot covers every segment.
// When it does, the neutral canvas stays colorless and makeSegmentPayloads
// re-injects that scene — restoring what the user actually had before music mode.
// When it does not, the canvas must assert a color itself, or no "col" key
// reaches the firmware at all and the preset's colors never get cleared.
//
// The user's own baseline overrides are returned untouched either way: forcing a
// color onto segments they deliberately left alone would be a worse violation
// than the bleed being fixed.
func baselineSegCanvas(b djBaseline, sceneColors bool) []MusicSegmentConfig {
	if len(b.segs) > 0 {
		return cloneMusicSegmentConfigs(b.segs)
	}
	neutral := make([]MusicSegmentConfig, 8)
	for i := range neutral {
		neutral[i] = MusicSegmentConfig{ID: i}
		if !sceneColors {
			col := djNeutralRestoreCol // fresh copy per segment — never alias
			neutral[i].Col = &col
		}
	}
	return neutral
}

// hasSceneColors reports whether the pre-music scene snapshot carries a usable
// "col" for all eight segments — exactly the condition under which
// makeSegmentPayloads emits a col for every segment.
//
// Partial coverage counts as ABSENT: a canvas that clears only some segments
// would leave the rest still wearing the previous look's colors, which is the
// bleed this whole path exists to prevent.
func (m *MusicModeService) hasSceneColors() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if len(m.segmentColors) < 8 {
		return false
	}
	for i := 0; i < 8; i++ {
		if len(m.segmentColors[i]) == 0 {
			return false
		}
	}
	return true
}

// djCustomBuiltinPalettes is the palette rotation pool for BUILTIN picks in the
// custom program ("You Are The DJ") — the same curated set Party rotates, kept
// as an independent literal so re-tuning Party's show can never silently reshape
// custom's. Preset and favorite picks keep their own stored palette (see
// rotate()'s pick.kind gate); only builtins rotate.
//
// Every entry MUST stay outside {0, 20, 21}. Those are the only palettes
// PaletteEngine::colorFromPalette reads seg.col for (pal 0 passes col[0]
// through; 20/21 lerp col[0..2]), and a builtin look must never render a
// preset's leftover colors. TestDJCustomBuiltinPalettesNeverReadSegCol guards it.
var djCustomBuiltinPalettes = []int{2, 1, 15, 16, 12} // Party, Rainbow, Orange & Teal, Gaming, Sakura

// resolveDJSettings turns validated settings into a playable custom program.
// Favorites and presets are batch-loaded ONCE via the user-scoped sources;
// unknown/malformed refs are skipped with a log (stale tombstones — the UI
// shows them as unavailable), never fatal. permissiveUnknown selects the
// capability stance: true for configuration/preflight (unknown keeps layer
// FX), false for enable (sticky probed flag — filtered()'s semantics).
func (m *MusicModeService) resolveDJSettings(userID int, s DJSettings, caps djCapabilities,
	comfort FlashComfortMode, baseline djBaseline, permissiveUnknown bool, seed int64) (AutoDJProgram, error) {

	m.mu.RLock()
	favSource := m.djFavSource
	presetSource := m.djPresetSource
	m.mu.RUnlock()

	needFavs, needPresets := false, false
	for _, ref := range s.Looks {
		switch ref.Kind {
		case DJLookKindMusicFavorite:
			needFavs = true
		case DJLookKindCustomPreset:
			needPresets = true
		}
	}

	favs := map[int]models.MusicModeFavorite{}
	if needFavs && favSource != nil {
		ctx, cancel := djStoreCtx()
		all, err := favSource.GetAll(ctx, userID)
		cancel()
		if err != nil {
			log.Printf("[MUSIC-DJ] Favorites batch load failed (favorite looks skipped): %v", err)
		} else {
			for _, f := range all {
				favs[f.ID] = f
			}
		}
	}
	presets := map[string]models.CustomPreset{}
	if needPresets && presetSource != nil {
		ctx, cancel := djStoreCtx()
		all, err := presetSource.GetByUserID(ctx, userID)
		cancel()
		if err != nil {
			log.Printf("[MUSIC-DJ] Preset batch load failed (preset looks skipped): %v", err)
		} else {
			for _, p := range all {
				presets[p.ID] = p
			}
		}
	}

	pool := make([]djWeightedLook, 0, len(s.Looks))
	for _, ref := range s.Looks {
		switch ref.Kind {
		case DJLookKindBuiltin:
			viz := *ref.Viz // validated
			pal, speed := baseline.paletteID, baseline.speed
			upal := baseline.upalRef // a builtin look plays the user's own palette
			pool = append(pool, djWeightedLook{
				pick: djPick{
					look:      DJLook{Viz: viz, Ix: ref.Ix},
					pal:       &pal,
					upal:      &upal,
					speed:     &speed,
					kind:      DJLookKindBuiltin,
					label:     musicVizNames[viz],
					refID:     ref.stableID(),
					baseRefID: ref.stableID(),
				},
				weight: ref.Weight,
			})

		case DJLookKindMusicFavorite:
			favID, _ := strconv.Atoi(ref.RefID) // validated numeric
			fav, found := favs[favID]
			if !found {
				log.Printf("[MUSIC-DJ] Favorite %s unavailable (deleted?) — skipped", ref.RefID)
				continue
			}
			var upd MusicConfigUpdate
			if err := json.Unmarshal(fav.Payload, &upd); err != nil {
				log.Printf("[MUSIC-DJ] Favorite %d payload unreadable — skipped: %v", favID, err)
				continue
			}
			look, pal, speed, ok := djLookFromMusicConfig(upd, baseline)
			if !ok {
				log.Printf("[MUSIC-DJ] Favorite %d has no usable visualization — skipped", favID)
				continue
			}
			pool = append(pool, djWeightedLook{
				pick: djPick{look: look, pal: pal, upal: djUpalFor(upd, baseline), speed: speed, kind: DJLookKindMusicFavorite,
					label: fav.Name, refID: ref.stableID(), baseRefID: ref.stableID(),
					segs:      djSegsFromMusicConfig(upd),
					remixable: hasColorIdentity(djSegsFromMusicConfig(upd), upd.PaletteID, baseline)},
				weight: ref.Weight,
			})

		case DJLookKindCustomPreset:
			preset, found := presets[ref.RefID]
			if !found {
				log.Printf("[MUSIC-DJ] Preset %s unavailable (deleted?) — skipped", ref.RefID)
				continue
			}
			mode, wledRaw, musicRaw, err := SplitCustomPresetPayload(preset.Payload)
			if err != nil || mode != "music" || musicRaw == nil {
				log.Printf("[MUSIC-DJ] Preset %s is not a music-mode preset — skipped", ref.RefID)
				continue
			}
			var upd MusicConfigUpdate
			if err := json.Unmarshal(musicRaw, &upd); err != nil {
				log.Printf("[MUSIC-DJ] Preset %s music payload unreadable — skipped: %v", ref.RefID, err)
				continue
			}
			look, pal, speed, ok := djLookFromMusicConfig(upd, baseline)
			if !ok {
				log.Printf("[MUSIC-DJ] Preset %s has no usable visualization — skipped", ref.RefID)
				continue
			}
			// A preset's colors: explicit segment overrides when its music
			// sub-object stored them, else the colors captured in its ErgoLED
			// body — the part that makes "Sick" look like Sick.
			segs := djSegsFromMusicConfig(upd)
			if segs == nil {
				segs = djSegsFromWledPayload(wledRaw)
			}
			pool = append(pool, djWeightedLook{
				pick: djPick{look: look, pal: pal, upal: djUpalFor(upd, baseline), speed: speed, kind: DJLookKindCustomPreset,
					label: preset.Name, refID: ref.stableID(), baseRefID: ref.stableID(),
					segs:      segs,
					remixable: hasColorIdentity(segs, upd.PaletteID, baseline)},
				weight: ref.Weight,
			})
		}
	}

	pool = capabilityFilterPool(pool, caps.LayerFxUsable(permissiveUnknown))
	pool = applyFlashComfortToPool(pool, comfort)
	if len(pool) == 0 {
		return AutoDJProgram{}, fmt.Errorf("%w: no effects remain in your custom pool after filtering — check your ratings and Flash Comfort", ErrMusicModeValidation)
	}

	burstsOn, randomizeOn := comfortOverlayFlags(s.BurstsOn, s.RandomizeOn, comfort)
	// TWO sources of generated segment overrides, not one. A pool pick's stored
	// colours are the original; tier composition is the second, and it needs no
	// pool entry to carry anything — a colourless builtin pool with
	// compose_tiers on writes an override to every replaced tier.
	//
	// Missing that made GetResumeConfig snapshot the LIVE composed segments as
	// though they were the user's own canvas, so a restart could promote a
	// transient recipe into the persisted baseline.
	writesOverrides := s.ComposeTiers
	for _, wl := range pool {
		if len(wl.pick.segs) > 0 {
			writesOverrides = true
			break
		}
	}
	// A rating above Off IS the permission the old DropViz = -1 stood in for.
	// Before this, a custom show was phrase rotation and nothing else: measured
	// over one hour on 2026-08-20, 17 drop onsets produced 0 slams while The
	// Drop sat in the pool at weight 1 and played 13 times as an ordinary
	// rotation card — firing its Feet→Head build at moments the music had not
	// asked for. Choosing only from the user's own filtered pool keeps the rule
	// the -1 protected ("never an effect the user didn't enable") while letting
	// the show react. -1 still results when nothing flash-heavy is rated, or
	// when capability/comfort filtering already removed it.
	dropViz := djCustomDropViz(pool)
	dropHold := 0
	if dropViz >= 0 {
		dropHold = djCustomDropHoldSec
	}
	// QuietViz stays -1 deliberately: "highest-rated flash-heavy" is the wrong
	// selector for a calm look, and picking one badly is worse than not having
	// one. Wants its own rule before it is turned on.
	return AutoDJProgram{
		Key:             "custom",
		SwitchBars:      s.SwitchBars,
		MinSwitchSec:    fallbackSwitchSecForBars(s.SwitchBars),
		DropViz:         dropViz,
		DropHoldSec:     dropHold,
		DropEverySecond: comfort == FlashComfortReduced && dropViz >= 0 && djFlashHeavyViz[dropViz],
		QuietViz:        -1,
		BurstsOn:        burstsOn,
		RandomizeOn:     randomizeOn,
		// Builtin picks rotate this pool so the custom show is as dynamic as
		// Party's; presets/favorites keep the palette that IS their identity.
		Palettes: djCustomBuiltinPalettes,
		// Remix wraps the deck only when the user asked for it AND the
		// filtered pool actually yields targets; newDJRemixSelector returns
		// the bare deck otherwise, so an off toggle costs nothing on the
		// hot path and existing shows are bit-for-bit unchanged.
		// Decorator ORDER is load-bearing. Remix wraps the deck and rewrites
		// the look's effect; composition wraps whatever it is given and adds a
		// tier plan on top of the effect that survived. Composing first would
		// have remix replace an effect the plan was already written against.
		//
		// Each decorator returns the thing it was given when it can add
		// nothing, so an off toggle costs nothing on the hot path and existing
		// shows stay bit-for-bit unchanged.
		Selector: func() djSelector {
			var sel djSelector = newDJDeck(pool, seed)
			if s.RemixOn {
				sel = newDJRemixSelector(sel, djRemixEffects(pool), baseline.speed, seed)
			}
			if s.RemixSliders {
				// After remix, before composition. Remix decides WHICH effect
				// plays, and the sliders are per-effect — running them first
				// would set knobs for an effect that is about to be replaced.
				sel = newDJSliderSelector(sel, seed)
			}
			if s.ComposeTiers {
				sel = newDJComposeSelector(sel, caps.LayerFxUsable(permissiveUnknown), comfort, s.RemixSliders, seed)
			}
			return sel
		}(),
		WritesSegmentOverrides: writesOverrides,
	}, nil
}

// SaveDJSettings validates, PREFLIGHTS, persists, and hot-reloads the custom
// program. Order matters: a candidate that resolves to an empty pool (or any
// validation failure) returns 400 BEFORE persistence — the stored last-good
// settings and the running show are both untouched. Returns the normalized
// settings the caller should echo.
// resolveDynamicsModeForSave decides the stored dynamics mode for an incoming
// save, and is the ONE place the legacy boolean is translated on the way in.
//
// The discriminator is the PRESENCE of dynamics_mode (a string with omitempty,
// so absent unmarshals to ""), never the value of color_story — color_story is
// a plain bool, so absent and false are indistinguishable once decoded and it
// could not carry the distinction even in principle.
//
//   - dynamics_mode supplied: it wins, and an unknown value is a 400.
//   - otherwise a legacy client: color_story false means off, so an old client
//     CAN still turn dynamics off, including off a stored "wide".
//   - otherwise color_story true means story — UNLESS the stored mode is
//     already wide. An old client saving an unrelated setting sends the whole
//     blob with color_story: true, and silently demoting wide to story on
//     every such save is the kind of downgrade nobody would think to look for.
func (m *MusicModeService) resolveDynamicsModeForSave(userID int, in DJSettings) (string, error) {
	if in.DynamicsMode != "" {
		if !djIsKnownDynamicsMode(in.DynamicsMode) {
			return "", fmt.Errorf("%w: dynamics_mode %q must be %q, %q or %q",
				ErrMusicModeValidation, in.DynamicsMode, DJDynamicsOff, DJDynamicsStory, DJDynamicsWide)
		}
		return in.DynamicsMode, nil
	}
	if !in.ColorStory {
		return DJDynamicsOff, nil
	}
	// A missing or unreadable stored blob is not an error here: there is
	// nothing to preserve, and story is what color_story: true has always
	// meant.
	if cur, err := m.loadDJSettings(userID); err == nil && cur.DynamicsMode == DJDynamicsWide {
		return DJDynamicsWide, nil
	}
	return DJDynamicsStory, nil
}

func (m *MusicModeService) SaveDJSettings(userID int, s DJSettings) (DJSettings, error) {
	n := s.Normalized()
	mode, err := m.resolveDynamicsModeForSave(userID, s)
	if err != nil {
		return n, err
	}
	n.DynamicsMode = mode
	// Keep the legacy mirror written, so an older client reads "wide" as
	// dynamics-enabled rather than as off.
	n.ColorStory = mode != DJDynamicsOff
	if err := n.Validate(); err != nil {
		return n, err
	}

	m.mu.RLock()
	store := m.djSettingsStore
	baseline := djBaseline{visualMode: m.visualMode, paletteID: m.paletteID, upalRef: m.upalRef, speed: m.speed, intensity: m.intensity}
	sessionActive := m.active && m.userID == userID
	if m.djRuntime != nil {
		baseline = m.djRuntime.baseline
	}
	m.mu.RUnlock()
	if store == nil {
		return n, fmt.Errorf("custom Auto DJ settings storage is not available")
	}
	if !sessionActive {
		baseline = djBaseline{paletteID: 0, speed: 128} // neutral preview baseline
	}

	// Preflight: resolve against current capabilities (permissive on unknown —
	// configuring before the first activation must not false-reject layer FX)
	// and the persisted comfort mode.
	comfort := m.loadFlashComfort(userID)
	if _, err := m.resolveDJSettings(userID, n, m.DJCapabilities(), comfort, baseline, true, 1); err != nil {
		return n, err
	}

	raw, err := json.Marshal(n)
	if err != nil {
		return n, fmt.Errorf("encoding custom Auto DJ settings: %w", err)
	}
	ctx, cancel := djStoreCtx()
	defer cancel()
	if err := store.SaveMusicAutoDJSettings(ctx, userID, raw); err != nil {
		return n, fmt.Errorf("saving custom Auto DJ settings: %w", err)
	}

	// Hot reload only when this user's custom show is live. An invalid live
	// reload cannot happen (preflight above used permissive capabilities; the
	// reload uses enable-stance capabilities and CAN legitimately fail on an
	// old-firmware desk — reconfigure aborts and keeps the old runtime).
	m.mu.RLock()
	runningCustom := m.active && m.userID == userID && m.djEnabled && m.djRuntime != nil && m.djRuntime.programKey == "custom"
	m.mu.RUnlock()
	if runningCustom {
		if err := m.reconfigureActiveDJ(userID); err != nil {
			log.Printf("[MUSIC-DJ] Hot reload after settings save failed (show continues on previous settings): %v", err)
		}
	}
	return n, nil
}

// SetFlashComfort preflights (a comfort change that would empty the caller's
// RUNNING custom pool is a 400, nothing persisted), persists the caller's
// preference, and reconfigures only the caller's own running show. Another
// user's PUT can never touch the session owner's runtime.
func (m *MusicModeService) SetFlashComfort(userID int, mode FlashComfortMode) error {
	m.mu.RLock()
	store := m.djSettingsStore
	runningAny := m.active && m.userID == userID && m.djEnabled && m.djRuntime != nil
	runningCustom := runningAny && m.djRuntime.programKey == "custom"
	var baseline djBaseline
	if runningCustom {
		baseline = m.djRuntime.baseline
	}
	m.mu.RUnlock()
	if store == nil {
		return fmt.Errorf("custom Auto DJ settings storage is not available")
	}

	if runningCustom {
		if settings, err := m.loadDJSettings(userID); err == nil {
			if _, err := m.resolveDJSettings(userID, settings, m.DJCapabilities(), mode, baseline, false, 1); err != nil {
				return err
			}
		}
	}

	ctx, cancel := djStoreCtx()
	defer cancel()
	if err := store.SaveFlashComfort(ctx, userID, int(mode)); err != nil {
		return fmt.Errorf("saving flash comfort: %w", err)
	}
	if runningAny {
		if err := m.reconfigureActiveDJ(userID); err != nil {
			log.Printf("[MUSIC-DJ] Comfort reconfigure failed (show continues): %v", err)
		}
	}
	return nil
}

// GetBeatAlign exposes the persisted preference for the GET route.
func (m *MusicModeService) GetBeatAlign(userID int) bool { return m.loadBeatAlign(userID) }

// SetBeatAlign persists the preference and hot-reloads a running show.
//
// No preflight, unlike SetFlashComfort: comfort can empty a look pool and has to
// be resolved before it is saved, whereas a bool cannot invalidate anything. The
// reconfigure is still the same one, so a running conductor picks the change up
// on its next tick without the goroutine restarting.
func (m *MusicModeService) SetBeatAlign(userID int, on bool) error {
	m.mu.RLock()
	store := m.djSettingsStore
	runningAny := m.active && m.userID == userID && m.djEnabled && m.djRuntime != nil
	m.mu.RUnlock()
	if store == nil {
		return fmt.Errorf("custom Auto DJ settings storage is not available")
	}

	ctx, cancel := djStoreCtx()
	defer cancel()
	if err := store.SaveMusicBeatAlign(ctx, userID, on); err != nil {
		return fmt.Errorf("saving beat align: %w", err)
	}
	if runningAny {
		if err := m.reconfigureActiveDJ(userID); err != nil {
			log.Printf("[MUSIC-DJ] Beat-align reconfigure failed (show continues): %v", err)
		}
	}
	return nil
}

// reconfigureActiveDJ hot-reloads the running conductor's runtime from fresh
// DB state WITHOUT restarting the goroutine and WITHOUT touching Color Story
// state (a SetAutoDJ(true) here would re-snapshot the user baseline from a
// possibly DJ-colored live state — the exact tuning-drift bug this design
// exists to prevent). Aborts silently if an enable/disable supersedes it.
func (m *MusicModeService) reconfigureActiveDJ(userID int) error {
	m.mu.Lock()
	if !m.active || m.userID != userID || !m.djEnabled || m.djRuntime == nil {
		m.mu.Unlock()
		return nil // nothing running — nothing to reload
	}
	m.djRequestGen++
	requestGen := m.djRequestGen
	genAtStart := m.djGen
	programKey := m.djRuntime.programKey
	baseline := m.djRuntime.baseline
	layerFx := m.fwLayerFxSupported
	m.mu.Unlock()

	stored, storedErr := m.loadDJStored(userID)
	if storedErr != nil {
		log.Printf("[MUSIC-DJ] Preference reload failed (comfort=standard, beat-align=off): %v", storedErr)
	}
	comfort := FlashComfortFromInt(stored.FlashComfort)
	caps := m.DJCapabilities()

	var prog AutoDJProgram
	var settings *DJSettings
	if programKey == "custom" {
		if storedErr != nil {
			return storedErr
		}
		loaded, err := djSettingsFromStored(stored)
		if err != nil {
			return err
		}
		prog, err = m.resolveDJSettings(userID, loaded, caps, comfort, baseline, false, time.Now().UnixNano())
		if err != nil {
			return err
		}
		settings = &loaded
	} else {
		base, ok := autoDJPrograms[programKey]
		if !ok {
			return fmt.Errorf("unknown running program %q", programKey)
		}
		if comfort == FlashComfortOff {
			prog = base.filtered(layerFx)
		} else {
			prog = base.comfortVariant(caps.LayerFxUsable(false), comfort, time.Now().UnixNano())
		}
	}
	prog.BeatAlign = stored.BeatAlign // after the branch — see SetAutoDJ

	m.djApplyMu.Lock()
	m.mu.Lock()
	if requestGen != m.djRequestGen || genAtStart != m.djGen ||
		!m.active || m.userID != userID || !m.djEnabled || m.djRuntime == nil {
		m.mu.Unlock()
		m.djApplyMu.Unlock()
		return nil // superseded by a newer request or an enable/disable — that op owns the outcome
	}
	// Dynamics transitions on reconfigure. Releasing on ANY mode change, not
	// only on "turned off": story→wide and wide→story swap the mood list, so
	// whatever the previous list left on the wire is no longer a member of
	// the new one. Restoring canonical and letting the next phrase author a
	// fresh mood is the only transition that cannot strand a value from a
	// list nobody is cycling any more. off→anything starts fresh on the next
	// phrase; same→same never re-snapshots, because the overlay model has no
	// snapshot to corrupt.
	oldMode := DJDynamicsOff
	if m.djRuntime.settings != nil {
		oldMode = m.djRuntime.settings.DynamicsMode
	}
	newMode := DJDynamicsOff
	if settings != nil {
		newMode = settings.DynamicsMode
	}
	// Which overlay families were active BEFORE this reconfigure, so a family
	// whose owning control just turned off can be released immediately rather
	// than waiting for a switch that may be a phrase away.
	//
	// Immediate for these, because what they change is a background property
	// the user is looking at RIGHT NOW — an analyzer curve or a burst cadence
	// they just switched off. Contrast the sliders and composition, which
	// describe the LOOK on screen: repainting those mid-look would be a switch
	// the user did not ask for, so they clear on the next one.
	//
	// Comfort and capability are read from the freshly loaded values on both
	// sides, so "Standard → Minimal" releases a family the same way "toggle
	// off" does. That is the reconciliation that stops something already on
	// the wire from outliving the setting that permitted it.
	wasActive := djVariationFamilyActive(m.djRuntime.settings, m.djRuntime.flashComfort, caps)
	nowActive := djVariationFamilyActive(settings, comfort, caps)
	// Captured under the same lock as the runtime swap, so the recipe judged
	// below is the one that was on the desk when this reconfigure decided.
	liveRecipe := ""
	liveViz := -1
	var liveSince time.Time
	if m.djNowPlaying != nil {
		liveRecipe = m.djNowPlaying.RecipeID
		liveViz = m.djNowPlaying.Viz
		liveSince = m.djNowPlaying.Since
	}
	m.djRuntime = &djRuntimeConfig{
		programKey:   programKey,
		program:      prog,
		flashComfort: comfort,
		settings:     settings,
		baseline:     baseline,
		planVerified: caps.LayerFxKnown && caps.LayerFxSupported,
	}
	m.djRuntimeRev++
	m.mu.Unlock()
	m.djApplyMu.Unlock()

	if oldMode != newMode && oldMode != DJDynamicsOff {
		m.releaseDJStoryOverlay(userID)
	}
	for _, family := range []string{djFamilyBurstShape, djFamilyRandomizeShape, djFamilyPhysics} {
		if wasActive[family] && !nowActive[family] {
			m.releaseDJOverlayFamily(userID, family)
		}
	}

	// A composition ALREADY ON THE DESK that the new settings would no longer
	// draw has to come off now, not at the next switch.
	//
	// Suppressing future recipes is not enough and the gap is a safety one:
	// switching to Minimal while split_desk is live leaves The Drop slamming on
	// four strips until a phrase boundary that can be tens of seconds away —
	// which is precisely the wait the user changed the setting to end.
	//
	// Judged on the LIVE recipe, from djNowPlaying (written at apply time, so
	// it describes the strip rather than an intention), against the NEW comfort
	// and capability. Turning composition off entirely counts too.
	// ONE decision, one write. A live look can be disallowed by its recipe, by
	// its base visualization, or by both; each needs the same repaint, and
	// deciding separately would write the desk twice for a single setting change.
	why := ""
	if liveRecipe != "" {
		r, known := djRecipeByID[liveRecipe]
		composeOff := settings == nil || !settings.ComposeTiers
		if composeOff || !known || !djRecipeUsable(*r, caps.LayerFxUsable(false), comfort) {
			why = "a live recipe is no longer permitted"
		}
	}
	safeViz, vizUnsafe := djComfortSafeViz(liveViz, caps.LayerFxUsable(false), comfort)
	if vizUnsafe {
		if why == "" {
			why = "a live visualization is no longer permitted"
		} else {
			why += " and neither is its visualization"
		}
	}
	if why != "" {
		override := -1
		if vizUnsafe {
			override = safeViz
		}
		if err := m.restoreDJSegmentCanvas(userID, baseline, override, liveSince, why); err != nil {
			// The runtime IS reconfigured, so future draws are already
			// safe — but this one is still on the strip, and a caller that
			// changed Flash Comfort for safety reasons has to hear that.
			return err
		}
	}

	// Overlays follow the reconfigured program (ownership-aware; a user-owned
	// overlay is never touched).
	m.reconcileDJOverlay(userID, prog.BurstsOn, prog.RandomizeOn)
	log.Printf("[MUSIC-DJ] Runtime reconfigured (program=%s, comfort=%s)", programKey, comfort)
	return nil
}

// restoreDJSegmentCanvas repaints the user's own segment canvas, clearing
// whatever the DJ generated on top of it.
//
// This exists because "the DJ stopped writing" is not the same as "what the DJ
// wrote is gone". applyConfigPartial keeps the last supplied slice in
// m.segmentConfigs and reuses it for any later update that supplies none, so a
// composed effect or a preset's colours ride along until something explicitly
// replaces them — through a manual visualization change, through a restart's
// resume, through anything.
//
// Sends synchronously and off m.mu: teardown and safety reconciliation are not
// hot paths, and an enqueued repaint can be dropped if the coalescer stops
// first.
//
// RETURNS THE ERROR, and does two things before it does:
//
//   - ARMS A PENDING RESTORE. Reporting a failure is necessary but not
//     sufficient, because the stale slice is still what the next config write
//     will inherit. The queued canvas makes the very next write use the user's
//     canvas instead, so a transient ErgoLED failure self-heals rather than
//     leaving the desk wearing a composition until someone notices.
//   - Never claims success it did not have. The earlier version logged and
//     returned nothing, so "stop the DJ" and "switch to Minimal" both reported
//     success while a flash-heavy composition was still on the strip.
func (m *MusicModeService) restoreDJSegmentCanvas(userID int, baseline djBaseline, vizOverride int, since time.Time, why string) error {
	m.mu.RLock()
	live := m.active && m.userID == userID
	viz := m.visualMode
	m.mu.RUnlock()
	if !live {
		return nil // nothing on the strip belongs to this user any more
	}
	// A visualization the new settings no longer permit is replaced in the SAME
	// write as the canvas. Two writes would put a permitted effect on the
	// stale composed canvas, or the base effect on a canvas that is about to
	// change — a visibly wrong intermediate frame either way.
	if vizOverride >= 0 {
		viz = vizOverride
	}
	segs := baselineSegCanvas(baseline, m.hasSceneColors())
	if len(segs) == 0 {
		return nil
	}
	m.armPendingSegRestore(segs)
	if err := m.applyConfigPartial(userID, MusicConfigUpdate{
		Visualization:  &viz,
		SegmentConfigs: segs,
	}); err != nil {
		log.Printf("[MUSIC-DJ] Segment canvas restore after %s FAILED — the desk still "+
			"carries DJ-generated segments; queued for the next config write: %v", why, err)
		return fmt.Errorf("restoring the segment canvas after %s: %w", why, err)
	}
	m.markNowPlayingRestored(viz, since)
	log.Printf("[MUSIC-DJ] Segment canvas restored after %s (viz=%d)", why, viz)
	return nil
}

// markNowPlayingRestored drags the published look back to what the strip is
// actually showing after a safety repaint.
//
// Without it the repaint is invisible to every consumer: the desk goes uniform
// while now_playing still advertises recipe "split_desk" and plan [8,8,0,9,9],
// and the recorder attributes the dwell to a composition that stopped painting
// — the "permissive measurement" this work exists to avoid. Observed on
// hardware 2026-08-22 immediately after Minimal cleared a live split_desk.
//
// Guarded on Since, captured when the repaint was decided: if the conductor
// landed a new look in the meantime, that look owns the telemetry and this
// must not clobber it.
func (m *MusicModeService) markNowPlayingRestored(viz int, since time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.djNowPlaying == nil || !m.djNowPlaying.Since.Equal(since) {
		return
	}
	// The pre-repaint identity (recipe, tier plan) is about to be flattened
	// in place below. A rating tapped moments after a Flash Comfort change is
	// plausibly about what was JUST on the strip — the same attribution
	// problem installDJNowPlaying exists for — so it has to survive as
	// djPrevLook rather than being silently erased by the in-place field
	// mutation that follows. This is the "safety-repaint correction path":
	// the only djNowPlaying write site that mutates fields instead of
	// replacing the pointer, so it needs its own capture rather than getting
	// one for free from installDJNowPlaying.
	m.retireDJLookLocked(*m.djNowPlaying)
	m.djNowPlaying.Viz = viz
	for i := range m.djNowPlaying.TierPlan {
		m.djNowPlaying.TierPlan[i] = viz
	}
	m.djNowPlaying.RecipeID = ""
	m.djNowPlaying.RecipeName = ""
	for i := range m.djNowPlaying.TierSliderIDs {
		m.djNowPlaying.TierSliderIDs[i] = ""
	}
}

// armPendingSegRestore queues the user's canvas for the next config write that
// supplies no segments of its own. Armed BEFORE the attempt, and cleared where
// a write commits — so a send that fails leaves it queued, which is the only
// case it exists for.
func (m *MusicModeService) armPendingSegRestore(segs []MusicSegmentConfig) {
	m.mu.Lock()
	m.pendingSegRestore = cloneMusicSegmentConfigs(segs)
	m.mu.Unlock()
}

// broadcastDJLook pushes the tiny music_dj_look frame after a successful
// switch. Switches are already ≥8s apart (djHardFloorSec) — no throttling.
//
// `since` is the SAME instant stamped into djNowPlaying.Since by the caller,
// passed in rather than re-read, so the frame and the server's own snapshot
// cannot describe the switch as two different moments.
//
// It has to be here, and its absence was a real defect. The rating endpoint
// compares the client's `since` claim against its authoritative look and
// records the result as `agreed` — but with no `since` on the wire the client
// had nothing to echo and substituted "when I saw the frame"
// (DJNowPlaying.fromLookEvent), a value that can never equal the server's.
// Every app-originated rating therefore stored agreed=false: 6 of the first 7
// real ratings, which dj_rating_report.py then reported as "the clearest cases
// of a tap crossing a switch". It was measuring network latency, not
// attribution. Echoing a real value makes agreed=false mean what it claims —
// the phone's picture was genuinely stale.
func (m *MusicModeService) broadcastDJLook(userID int, act *djAction, program string, since time.Time) {
	message := map[string]interface{}{
		"type": "music_dj_look",
		"data": djLookFramePayload(act, program, since),
	}
	if b, err := json.Marshal(message); err == nil {
		ws_clients.BroadcastToUserBestEffort(userID, b)
	}
}

// djLookFramePayload builds the `data` object of the music_dj_look frame.
//
// Extracted so a test can exercise the REAL payload rather than a parallel map
// written out by hand beside it — the shape a client depends on should not be
// asserted against a second copy that can drift from this one silently.
// djPublishedSince coarsens a look's timestamp to what every client can hold.
// See the sinceStamp comment in music_auto_dj.go for why milliseconds.
func djPublishedSince(t time.Time) time.Time { return t.Truncate(time.Millisecond) }

func djLookFramePayload(act *djAction, program string, since time.Time) map[string]interface{} {
	return map[string]interface{}{
		"since":       since,
		"viz":         act.viz,
		"reason":      act.reason,
		"look_kind":   act.lookKind,
		"ref_id":      act.refID,
		"base_ref_id": act.baseRefID,
		"label":       act.label,
		"program":     program,
		// The RESOLVED plan — five concrete visualizations, never
		// djTierInherit — so a consumer never has to know the base look to
		// read what is on each tier. Present for every action, composed or
		// not, so an uncomposed look is [base]x5 rather than an absent key
		// the client has to special-case.
		"tier_plan":           [djNumTiers]int(djResolvedPlanOf(act.tiers, act.viz)),
		"recipe_id":           act.recipeID,
		"recipe_name":         act.recipeName,
		"slider_id":           act.sliderID,
		"tier_slider_ids":     act.tierSliderIDs,
		"burst_recipe_id":     act.burstRecipeID,
		"randomize_recipe_id": act.randomizeRecipeID,
		"physics_recipe_id":   act.physicsRecipeID,
		"plan_verified":       act.planVerified,
	}
}

// djNoUserPalette is the upal of a look that plays one of the program's own built-in
// palettes: the user's music-wide user palette steps aside for it.
func djNoUserPalette() *string {
	none := ""
	return &none
}

// djUpalFor is the user palette a favourite's or preset's look plays: its own when it stored
// one; the user's when its palette came from the baseline (it stored none); else none.
func djUpalFor(upd MusicConfigUpdate, baseline djBaseline) *string {
	if upd.UpalRef != nil {
		v := *upd.UpalRef
		return &v
	}
	if upd.PaletteID == nil {
		v := baseline.upalRef
		return &v
	}
	return djNoUserPalette()
}
