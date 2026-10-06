// services/music_auto_dj.go
// Auto DJ — Phase 3 of Music Mode 2.0. A conductor goroutine inside the music
// session that changes visualization/palette on MUSICAL boundaries (phrases,
// drops, quiet passages) instead of leaving one static effect running all
// night. It never streams pixels: one applyConfigPartial every dozens of
// seconds (700ms crossfades via smooth transitions), far inside the measured
// ~34 req/s HTTP budget.
//
// Split for testability: djDecide() is a PURE function over (program, state,
// metrics, now) — the goroutine only snapshots inputs and applies actions.

package services

import (
	"context"
	"fmt"
	"log"
	"time"
)

// DJLook is one rotation entry: an effect plus an optional variant. The same
// effect with a different ix is a genuinely different look on the desk
// (Ripple per-beat vs per-bar, Spectrum mirrored vs top-down, Tower inverted),
// so the pools rotate LOOKS, not just effect IDs.
type DJLook struct {
	Viz int  // visualization index 0-9 (musicFxMap)
	Ix  *int // nil = the effect's default intensity/variant
}

func ixv(v int) *int { return &v }

// AutoDJProgram is a curated show: which looks to rotate through, on what
// cadence, how to react to drops and quiet passages, and which firmware
// overlays (Color Bursts / Beat Randomize) the program turns on while it
// conducts. Visualization values are the API's 0-9 indices, NOT firmware FX IDs.
type AutoDJProgram struct {
	Key          string
	Looks        []DJLook // rotation pool (must be non-empty)
	Palettes     []int    // rotated alongside; empty = keep the user's palette. Selector programs: BUILTIN picks only (see rotate)
	SwitchBars   int      // rotate every N bars while tempo-locked
	MinSwitchSec int      // rotation fallback cadence without a tempo lock (also locked upper bound)
	DropViz      int      // visualization to slam on a drop; -1 = ignore drops
	DropHoldSec  int      // how long to stay on DropViz after a drop
	QuietViz     int      // visualization for sustained quiet; -1 = ignore quiet
	// Overlay moves while conducting (restored when the DJ hands control back
	// unless the user changed them mid-show — see conductor overlay logic).
	BurstsOn    bool // Color Bursts overlay
	RandomizeOn bool // beat-randomized reverse/mirror

	// Selector, when non-nil, replaces the classic round-robin over Looks
	// with a weighted deck ("custom" program, or a built-in under Flash
	// Comfort Reduced/Minimal). nil = the untouched classic path.
	Selector djSelector
	// DropEverySecond accepts only every second armed drop slam (Flash
	// Comfort Reduced) — deterministic, and skipped drops still re-arm so
	// the slam cadence halves without drifting.
	DropEverySecond bool
	// BeatAlign makes a PHRASE rotation wait for the next beat instead of firing
	// on whichever 500ms tick noticed the bar count was reached. Phrase only:
	// drops and quiet transitions are REACTIVE, and delaying a slam by up to a
	// beat (~666ms at 90 BPM) outlives the analyzer's own 0.6s drop latch.
	//
	// Set after the custom/built-in branch in SetAutoDJ and reconfigureActiveDJ,
	// never inside resolveDJSettings — built-ins never go through that.
	BeatAlign bool

	// WritesSegmentOverrides is true when the show generates per-segment
	// overrides of its own. Only then may the conductor write SegmentConfigs
	// (generate + baseline restore), and only then does the resume snapshot
	// mask the live overrides back to the DJ-start baseline. Built-in
	// programs generate none, keeping them behavior-identical to before.
	//
	// Deliberately NOT "paints colors": this gates the segment-override
	// CHANNEL, not one payload field. Every field the DJ generates into a
	// segment travels on it and needs the same restore bookkeeping, so a
	// color-only reading would silently under-restore anything else.
	WritesSegmentOverrides bool
}

// autoDJPrograms is the built-in program registry. Keys are the API surface
// (POST /led/music-mode/auto-dj {"program": "party"}) and are mirrored by the
// Flutter/React program chips. Between the three programs every music effect
// is in play: The Drop is reserved for drop moments by design (a moment-maker,
// not wallpaper) and appears via DropViz.
var autoDJPrograms = map[string]AutoDJProgram{
	"chill": {
		Key: "chill",
		Looks: []DJLook{
			{Viz: 5},               // Wave — gentle sine
			{Viz: 4},               // Fire — cozy fireplace (cooling adapts to energy)
			{Viz: 2},               // Comet
			{Viz: 8},               // Bass Sky — starfield over a soft floor
			{Viz: 5, Ix: ixv(200)}, // Wave (compound) — layered slow interference
		},
		Palettes:     nil, // keep the user's palette choice
		SwitchBars:   16,
		MinSwitchSec: 45,
		DropViz:      -1, // no slams in chill
		QuietViz:     5,
	},
	"party": {
		Key: "party",
		Looks: []DJLook{
			{Viz: 0, Ix: ixv(128)}, // Spectrum — mirrored both halves
			{Viz: 6},               // Tower — bass at the feet
			{Viz: 7},               // Ripple — one wave per beat
			{Viz: 1},               // Pulse — center-out beat ripple
			{Viz: 8},               // Bass Sky
			{Viz: 5},               // Wave
			{Viz: 2},               // Comet
			{Viz: 7, Ix: ixv(200)}, // Ripple (per-bar) — the grand sweep
		},
		Palettes:     []int{2, 1, 15, 16, 12}, // Party, Rainbow, Orange & Teal, Gaming, Sakura
		SwitchBars:   8,
		MinSwitchSec: 30,
		DropViz:      9, // The Drop
		DropHoldSec:  6,
		QuietViz:     5,
		BurstsOn:     true, // vivid HSV washes over whatever is playing
	},
	"rave": {
		Key: "rave",
		Looks: []DJLook{
			{Viz: 6},               // Tower
			{Viz: 7},               // Ripple per-beat
			{Viz: 0, Ix: ixv(220)}, // Spectrum — top-down, bass slams the shelf
			{Viz: 3},               // Strobe (comfort floor still governs)
			{Viz: 4},               // Fire — energy-fed inferno
			{Viz: 1},               // Pulse
			{Viz: 6, Ix: ixv(200)}, // Tower inverted — bass at the head
		},
		Palettes:     []int{1, 2, 10, 5, 6}, // Rainbow, Party, Icefire, Lava, Fire
		SwitchBars:   4,
		MinSwitchSec: 20,
		DropViz:      9,
		DropHoldSec:  8,
		QuietViz:     8, // Bass Sky as the moody breakdown look
		BurstsOn:     true,
		RandomizeOn:  true, // beat-randomized reverse/mirror — full LED-DJing
	},
}

// AutoDJProgramKeys returns the available program keys (stable order for the
// API). "custom" is always listed — whether the user's custom pool actually
// resolves is validated at ENABLE time, not listing time.
func AutoDJProgramKeys() []string {
	return []string{"chill", "party", "rave", "custom"}
}

// IsKnownAutoDJProgramName reports whether name is a syntactically valid
// program key (coach tools use this; "custom" without saved settings fails
// later inside SetAutoDJ with a friendly message, not as a bad program).
func IsKnownAutoDJProgramName(name string) bool {
	if name == "custom" {
		return true
	}
	_, ok := autoDJPrograms[name]
	return ok
}

// filtered returns a copy of the program usable on the current firmware: when
// layer FX (viz 6-9 / FX 37-40) are unsupported they are dropped from every
// slot so an old-firmware desk still gets a working show from the classic six.
func (p AutoDJProgram) filtered(layerFxSupported bool) AutoDJProgram {
	if layerFxSupported {
		return p
	}
	keep := make([]DJLook, 0, len(p.Looks))
	for _, l := range p.Looks {
		if l.Viz <= 5 {
			keep = append(keep, l)
		}
	}
	if len(keep) == 0 {
		keep = []DJLook{{Viz: 0}, {Viz: 1}, {Viz: 2}, {Viz: 5}}
	}
	p.Looks = keep
	if p.DropViz > 5 {
		p.DropViz = 3 // classic Strobe stands in for The Drop
	}
	if p.QuietViz > 5 {
		p.QuietViz = 5 // Wave stands in for Bass Sky
	}
	return p
}

// Conductor timing rules.
const (
	djTickInterval = 500 * time.Millisecond
	djHardFloorSec = 8  // absolute minimum between any two switches
	djDropRearmSec = 10 // minimum spacing between drop slams
	// djTempoConfMin is the smoothed tempo confidence below which the bar
	// counter is not trusted to set the cadence. DERIVED FROM MEASUREMENT, not
	// from the analyzer's own lock threshold — that was the first guess and it
	// was wrong. Sampled 2026-08-22 against tracks whose lock quality had
	// already been measured as modal-BPM share:
	//
	//     Losing It      88% share   tcf median 128   (125 BPM, correct)
	//     Espresso       87%                     63   (104 BPM, correct)
	//     HUMBLE.        96%                     53   (150 BPM, correct)
	//     ---------------------------------------------------------------
	//     Clair de Lune  12%                     41   (167 BPM on rubato piano)
	//     Schism         18%                     36
	//     Bulls On Parade 8%                     32   (159 BPM on a 103 BPM song)
	//     Górecki         5%                     31   (150 BPM on no pulse at all)
	//
	// The analyzer's own lock threshold is 2.2 (tcf 22) and admits every row
	// above, including 193 BPM on Debussy — it is confidently wrong, so
	// deferring to it gated nothing. 45 splits the two clusters.
	djTempoConfMin = 45
	// djTempoConfAlpha smooths tcf over roughly ten seconds at djTickInterval.
	//
	// 0.1 was the first value and its own test killed it: from a Górecki-like
	// 32, ONE frame at 200 pulls the average to 48.8 and opens the gate. 0.05
	// leaves that single frame at 40.4 and still reaches the threshold within
	// ~4s of genuinely confident audio, which is well inside a phrase.
	// The medians separate cleanly but the INSTANTANEOUS samples overlap hard
	// (Espresso p10 27 against Clair de Lune p90 54), so a per-tick comparison
	// would fire at random. The cadence question is "is this track's tempo
	// trustworthy", which is a property of the last few seconds, not this frame.
	djTempoConfAlpha = 0.05
	// djPhraseFallbackNum/Den is how far past the target the timer waits before
	// firing without a bar boundary: 3/2, i.e. one and a half times.
	//
	// Written as a fraction because the obvious spelling is a trap — a Go
	// untyped constant `3 / 2` is integer division and silently evaluates to
	// 1, which would have made the fallback identical to the target and this
	// comment a lie. Applied as target*Num/Den so the arithmetic stays in
	// time.Duration and cannot round early.
	//
	// Above 1 so a confidently-locked track gets a real chance to land on its
	// grid — at 174 BPM the nearest boundary can sit 2.7s past target — while
	// a track with no usable grid still rotates near the pace asked for.
	djPhraseFallbackNum = 3
	djPhraseFallbackDen = 2
	djQuietAfterSec     = 3 // sustained quiet before switching to QuietViz
)

// autoDJState is the conductor's mutable memory between ticks.
type autoDJState struct {
	// tempoConf is the smoothed analyzer tempo confidence (tcf), not the raw
	// per-frame value. See djTempoConfMin for the measurement it is compared
	// against and why the raw value cannot be used.
	tempoConf float64

	lastSwitch  time.Time
	lastDrop    time.Time
	dropUntil   time.Time // holding on DropViz until this passes
	quietSince  time.Time // zero = not currently quiet
	inQuietMode bool
	lastBarPos  int // -1 = no bar reference yet
	barCount    int
	vizIdx      int
	palIdx      int
	dropCounter int // armed drops seen; DropEverySecond accepts the odd ones

	// lastDropLanded is when the drop look last reached the strip, by any route (noteLanded).
	lastDropLanded time.Time

	// segOverridesLive: DJ-generated segment overrides are on the strip, so
	// the next action that generates none must repaint the baseline canvas
	// or the previous look bleeds through. Any generated segment field
	// counts, not colors alone — see WritesSegmentOverrides.
	segOverridesLive bool
	// blocked holds a decided action the write gate refused, for replay on a
	// later tick. Empty by default: every tick POPS it, and putting it back is a
	// deliberate act, so no exit path can leave an obsolete action behind by
	// omission. See music_auto_dj_deferral.go.
	blocked *blockedSwitch
	// beatArmed holds a decided PHRASE rotation waiting for its beat instant.
	// Deliberately a SECOND slot rather than sharing `blocked` — see armedSwitch.
	beatArmed *armedSwitch
}

// armedChan is the select arm for a waiting beat. A nil channel blocks forever,
// so an unarmed conductor simply never takes that branch.
func (st *autoDJState) armedChan() <-chan time.Time {
	if st.beatArmed == nil {
		return nil
	}
	return st.beatArmed.timer.C
}

func newAutoDJState(now time.Time) *autoDJState {
	// tempoConf starts at the -1 sentinel so the FIRST sample seeds the
	// average rather than being averaged against zero. Fed a constant 45, an
	// EMA from zero reads 25.2 after the 16 ticks a phrase allows, and only
	// converges within float precision after ~1000s — so the gate stays shut
	// through the entire window that matters.
	return &autoDJState{lastSwitch: now, lastBarPos: -1, tempoConf: -1}
}

// djAction is what the conductor should do this tick (nil = nothing).
type djAction struct {
	viz    int
	ix     *int // look variant; nil = the effect's default intensity
	setPal bool
	pal    int
	// upal is the look's user palette when it sets the palette: a favourite's or preset's
	// own, the user's for a builtin look, "" for the program's rotated built-ins. nil =
	// leave the music-wide user palette as it is.
	upal   *string
	speed  *int   // preset looks carry their stored speed; nil = leave as-is
	reason string // "drop" | "resume" | "quiet" | "phrase"
	// WS/telemetry identity — populated for every action (drop and quiet
	// included), so the "now playing" push always has a name.
	lookKind string // "builtin" | "music_favorite" | "custom_preset"
	label    string
	refID    string
	// baseRefID names the POOL entry behind refID. Equal to refID for every
	// ordinary action; for a remix, refID carries a "@viz<N>" suffix while
	// this stays the source preset. Play counts key on THIS, because the
	// settings sheet looks them up by the pool card's own id.
	baseRefID string
	// Segment-override handoff: segs carries what the DJ generated for this
	// look (a preset's colours, a recipe's per-tier effects, or both merged);
	// restoreSegs asks the conductor to repaint the baseline canvas because
	// the previous look's overrides are still on the strip. Mutually
	// exclusive.
	segs        []MusicSegmentConfig
	restoreSegs bool
	// tiers is the composition plan behind segs, kept for telemetry and
	// classification. nil for an uncomposed action; the RESOLVED five-tier
	// form is derived with djResolvedPlanOf, never stored here, because a
	// recipe plan may contain djTierInherit and a resolved one may not.
	tiers      *djTierVizPlan
	recipeID   string
	recipeName string
	// planVerified is the layer-FX capability state when this action was
	// decided. Stamped by the conductor from the runtime snapshot, because a
	// plan recorded while capability was unknown may describe a look the desk
	// never rendered.
	planVerified bool
	// Which variation recipe each family contributed to this look, "" when the
	// family wrote nothing. Filled at DIFFERENT times: sliderID travels with
	// the pick and is known when the action is built, while the two overlay
	// families are applied AFTER a successful switch and stamp themselves
	// then — so a look that never landed reports no tuning it never sent.
	// sliderID is the BASE look's slider draw — the one governing whatever
	// tiers inherit. tierSliderIDs carries what each REPLACED tier drew, which
	// is a different question with a different answer per tier.
	sliderID          string
	tierSliderIDs     [djNumTiers]string
	burstRecipeID     string
	randomizeRecipeID string
	physicsRecipeID   string
}

// stampSegRestore marks an action that generates no segment overrides to
// restore the baseline segment canvas when DJ-generated overrides are still
// live. Every action that doesn't carry its own segs goes through here (drop
// slams and quiet fallbacks included) so a builtin look never wears the
// previous look's overrides.
func (st *autoDJState) stampSegRestore(a *djAction) *djAction {
	if st.segOverridesLive {
		a.restoreSegs = true
		st.segOverridesLive = false
	}
	return a
}

// djRecordPlay credits a successfully applied action to its pool entry.
//
// This is a named function rather than four inline lines inside runAutoDJ so it
// is reachable from a test. Both rules it encodes fail SILENTLY when broken —
// no error, no log, just an empty count column in the settings sheet — and the
// conductor loop itself is not unit-drivable, so inlining it would leave both
// rules permanently unguarded:
//
//   - Ask for the djPlayRecorder INTERFACE, never the concrete *djDeck. A
//     decorated selector (remix) must still record.
//   - Key on baseRefID, never refID. A remix's refID carries a "@viz<N>"
//     suffix, and the settings sheet looks counts up by the pool card's own
//     un-suffixed id — so recording the suffixed form files every play under a
//     key nothing ever reads.
func djRecordPlay(sel djSelector, act *djAction) {
	rec, ok := sel.(djPlayRecorder)
	if !ok || act == nil || act.baseRefID == "" {
		return
	}
	rec.recordPlayed(act.baseRefID)
}

// builtinActionIdentity stamps the builtin identity onto direct (non-rotate)
// actions like drop slams and quiet fallbacks.
func builtinActionIdentity(a *djAction) *djAction {
	a.lookKind = DJLookKindBuiltin
	if a.viz >= 0 && a.viz < len(musicVizNames) {
		a.label = musicVizNames[a.viz]
	}
	a.refID = fmt.Sprintf("builtin:%d", a.viz)
	a.baseRefID = a.refID
	return a
}

// djDecide advances the state machine one tick and returns the action to
// apply, if any. Pure: no locks, no I/O, injected clock — the whole show
// logic is table-testable.
//
// Priority: drop slam > drop hold > post-drop resume > quiet mode > phrase
// rotation (bar-counted when tempo-locked, timer fallback otherwise, always
// behind an 8s hard floor).
func djDecide(prog *AutoDJProgram, st *autoDJState, met AudioMetrics, now time.Time, cur djLookIdentity) *djAction {
	// Bar tracking — only meaningful while the analyzer holds a tempo lock.
	//
	// barBoundary is the signal the rotation below actually rotates ON. Three
	// clocks used to run here with nothing aligning them: the music's own
	// phrase structure, the analyzer's free-running bar_in_phrase (which
	// resets to 0 whenever the tempo unlocks, so its zero is wherever the lock
	// landed), and this counter, whose zero was the last switch. A fixed
	// "switch every N bars" therefore drifted against the music continuously,
	// and lost a step outright whenever a pace change re-locked the analyzer
	// and reset its counter underneath a tally that carried straight on.
	barBoundary := false
	if met.Bpm > 0 {
		bar := int(met.BarPos & 0x3F)
		if st.lastBarPos < 0 {
			st.lastBarPos = bar
		} else if bar != st.lastBarPos {
			st.barCount++
			st.lastBarPos = bar
			// A 4-bar grid, not the analyzer's full 8-bar phrase: 8 bars at
			// 70 BPM is 27s, which overshoots any sane pace, while 4 bars is
			// 13.7s. Four is the finest musically meaningful unit here.
			barBoundary = bar%4 == 0
		}
	} else {
		st.lastBarPos = -1
	}

	// Smooth the tempo confidence before anything reads it. Updated here so
	// every caller of djDecide feeds it, including the ticks that decide
	// nothing — a gate that only saw the frames where a switch was already
	// due would be sampling exactly once per phrase.
	// SEEDED, not started from zero. An EMA initialised at 0 approaches its
	// input asymptotically and never reaches it, so a stream of frames at
	// exactly the threshold leaves the gate shut forever — a legacy test fed
	// tcf=djTempoConfMin and the show never rotated. The first sample IS the
	// average; smoothing starts from the second.
	if st.tempoConf < 0 {
		st.tempoConf = float64(met.TempoConf)
	} else {
		st.tempoConf += djTempoConfAlpha * (float64(met.TempoConf) - st.tempoConf)
	}

	// Quiet tracking (flags bit2).
	quiet := met.Flags&0x04 != 0
	if quiet {
		if st.quietSince.IsZero() {
			st.quietSince = now
		}
	} else {
		st.quietSince = time.Time{}
	}

	// 1. Drop slam (flags bit1), re-arm limited.
	if prog.DropViz >= 0 && met.Flags&0x02 != 0 &&
		now.Sub(st.lastDrop) >= djDropRearmSec*time.Second && cur.viz != prog.DropViz &&
		!st.dropCooling(prog, now) {
		if prog.DropEverySecond {
			st.dropCounter++
			if st.dropCounter%2 == 0 {
				// Flash Comfort Reduced: skip alternate slams. The skipped
				// drop still consumes the re-arm window so the accepted-slam
				// cadence halves deterministically instead of drifting.
				st.lastDrop = now
				return nil
			}
		}
		st.lastDrop = now
		st.dropUntil = now.Add(time.Duration(prog.DropHoldSec) * time.Second)
		st.lastSwitch = now
		st.barCount = 0
		st.inQuietMode = false
		return st.stampSegRestore(builtinActionIdentity(&djAction{viz: prog.DropViz, reason: "drop"}))
	}

	// 2. Hold the drop moment.
	if now.Before(st.dropUntil) {
		return nil
	}

	// 3. Resume rotation after the drop hold expires.
	if prog.DropViz >= 0 && cur.viz == prog.DropViz && !st.dropUntil.IsZero() {
		st.dropUntil = time.Time{}
		st.lastSwitch = now
		st.barCount = 0
		return st.rotateAt(prog, cur, "resume", now)
	}

	// 4. Quiet mode: calm look during sustained silence, rotate back on sound.
	if prog.QuietViz >= 0 {
		if !st.inQuietMode && !st.quietSince.IsZero() &&
			now.Sub(st.quietSince) >= djQuietAfterSec*time.Second && cur.viz != prog.QuietViz {
			st.inQuietMode = true
			st.lastSwitch = now
			st.barCount = 0
			return st.stampSegRestore(builtinActionIdentity(&djAction{viz: prog.QuietViz, reason: "quiet"}))
		}
		if st.inQuietMode {
			if quiet {
				return nil // stay calm while it's still silent
			}
			st.inQuietMode = false
			st.lastSwitch = now
			st.barCount = 0
			return st.rotateAt(prog, cur, "resume", now)
		}
	}

	// 5. Phrase rotation.
	if now.Sub(st.lastSwitch) < djHardFloorSec*time.Second {
		return nil
	}
	// Bar-driven rotation requires a tempo the analyzer is actually confident
	// in, not merely a non-zero one.
	//
	// The bar counter converts an estimate into a cadence, so a phantom tempo
	// does not just fail to help — it accelerates the show. Measured on
	// 2026-08-22: Debussy's Clair de Lune rotated at 5.28 switches/min against
	// Fisher's 125 BPM house at 4.48, because the analyzer reported a modal
	// 146 BPM on solo rubato piano and this line believed it. Górecki, whose
	// estimate was so unstable it never drove anything, sat correctly on the
	// MinSwitchSec fallback at 3.92.
	//
	// Deliberately NOT applied to beat-align arming, where the same reasoning
	// inverts: refusing to arm does not delay a switch to a better moment, it
	// fires immediately at whatever phase it lands on. Measured on Schism,
	// arming against a WRONG tempo still landed within 24ms on average, while
	// an unaligned switch averages a quarter-beat — about 140ms at 107 BPM.
	// Bad alignment beats none; a bad cadence does not beat the fallback.
	// ADAPTIVE PHRASE LENGTH. The bar count is no longer a setting the show
	// tries to hold; it is whatever multiple of 4 bars lands nearest the
	// target pace at the CURRENT tempo. One setting cannot serve both ends of
	// the range — 8 bars is 27s at 70 BPM and 11s at 174 — and a song that
	// changes pace mid-way invalidates whichever value was chosen.
	//
	// Rounds to nearest rather than waiting for the first boundary at or after
	// the target: at 70 BPM "at or after 16s" would wait a full 27s, where
	// nearest picks the 13.7s boundary. The show lands on the analyzer's bar
	// grid either way, which is the part that stops it drifting.
	elapsed := now.Sub(st.lastSwitch)
	// The pace target comes from SwitchBars, NOT from MinSwitchSec.
	//
	// They are different things and conflating them silently slowed every
	// built-in program by 2-3x: rave is SwitchBars 4 with MinSwitchSec 20, so
	// it rotated every 4 bars (7.5s at 128 BPM) with 20s as a CEILING for when
	// the tempo was lost. Reading 20 as the target made it rotate every 20s
	// and changed the program's character entirely. Its own legacy test caught
	// it. fallbackSwitchSecForBars is the existing bars-to-seconds mapping.
	target := time.Duration(fallbackSwitchSecForBars(prog.SwitchBars)) * time.Second
	due := false
	if met.Bpm > 0 && st.tempoConf >= djTempoConfMin && barBoundary {
		unit := time.Duration(4*4*60/float64(met.Bpm)*1000) * time.Millisecond
		due = elapsed+unit/2 >= target
	}
	// Two different ceilings, because the grace only makes sense when there is
	// a grid to reach. With a confident tempo, wait up to 1.5x target for the
	// nearest boundary; without one there is nothing to land on, so the timer
	// fires at MinSwitchSec exactly, as it always did.
	ceiling := time.Duration(prog.MinSwitchSec) * time.Second
	if met.Bpm > 0 && st.tempoConf >= djTempoConfMin {
		if grace := target * djPhraseFallbackNum / djPhraseFallbackDen; grace > ceiling {
			ceiling = grace
		}
	}
	if elapsed >= ceiling {
		due = true
	}
	if !due {
		return nil
	}
	st.lastSwitch = now
	st.barCount = 0
	return st.rotateAt(prog, cur, "phrase", now)
}

// rotate advances to the next LOOK — via the weighted deck when the program
// carries a Selector, else the classic round-robin (skipping looks on the
// current visualization so a "switch" always visibly switches) — and steps
// the palette alongside.
func (st *autoDJState) rotate(prog *AutoDJProgram, cur djLookIdentity, reason string) *djAction {
	return st.rotateAt(prog, cur, reason, time.Time{})
}

// rotateAt is rotate at a known instant, so a rotation inside the drop cooldown can skip drop
// looks (djDropCooldownSec).
func (st *autoDJState) rotateAt(prog *AutoDJProgram, cur djLookIdentity, reason string, now time.Time) *djAction {
	cooling := st.dropCooling(prog, now)
	if prog.Selector != nil {
		pick := prog.Selector.next(cur)
		for i := 1; cooling && djPickShowsViz(pick, prog.DropViz); i++ {
			if i >= djDropRedraws {
				return nil // every draw was a drop look: switch nothing this time
			}
			pick = prog.Selector.next(cur)
		}
		if pick.look.Viz < 0 {
			return nil // empty-pool zero value; construction should prevent this
		}
		a := &djAction{
			viz:       pick.look.Viz,
			ix:        pick.look.Ix,
			speed:     pick.speed,
			reason:    reason,
			lookKind:  pick.kind,
			label:     pick.label,
			refID:     pick.refID,
			baseRefID: pick.baseRefID,
		}
		// A pick that names no pool entry falls back to its own identity.
		//
		// baseRefID differs from refID ONLY for a remix; for every other pick
		// the two are the same value, so a selector that forgets to set it is
		// making a mistake with no visible symptom at the point of the error.
		// It costs the look its play count (djRecordPlay ignores an empty
		// base) and its "playing now" border (the client keeps the empty
		// string rather than falling back) — two silent losses, in the UI,
		// far from the constructor that caused them. Repairing it at the one
		// funnel every selector pick passes through is cheaper than trusting
		// each future selector to remember.
		if a.baseRefID == "" {
			a.baseRefID = a.refID
		}
		// A builtin pick carries no color identity of its own — its pal is
		// either nil (comfortVariant decks) or a baseline fallback (custom) —
		// so a program with its own pool is free to rotate it, which is what
		// keeps the show dynamic instead of parked on one palette all session.
		// Favorite/preset picks take the else-branch and keep the palette that
		// IS their identity: never rotated, never nil (djPick's non-bleed rule).
		if pick.kind == DJLookKindBuiltin && len(prog.Palettes) > 0 {
			st.palIdx = (st.palIdx + 1) % len(prog.Palettes)
			a.setPal = true
			a.pal = prog.Palettes[st.palIdx]
			a.upal = djNoUserPalette()
		} else if pick.pal != nil {
			a.setPal = true
			a.pal = *pick.pal
			a.upal = pick.upal
		}
		// Composition and a preset's colours travel on the SAME channel and
		// merge into one slice: makeSegmentPayloads keys overrides by segment
		// id, so a preset's colour and a recipe's effect on the same strip
		// have to arrive as one entry or the second silently loses.
		a.segs = djComposeSegs(pick.segs, pick.tiers, pick.tierParams)
		a.tiers = pick.tiers
		a.recipeID, a.recipeName = pick.recipeID, pick.recipeName
		a.sliderID = pick.sliderID
		if pick.tierParams != nil {
			a.tierSliderIDs = pick.tierParams.sliderIDs()
		}
		if len(a.segs) > 0 {
			st.segOverridesLive = true
			return a
		}
		return st.stampSegRestore(a)
	}

	n := len(prog.Looks)
	for i := 0; i < n; i++ {
		st.vizIdx = (st.vizIdx + 1) % n
		if prog.Looks[st.vizIdx].Viz != cur.viz && !(cooling && prog.Looks[st.vizIdx].Viz == prog.DropViz) {
			break
		}
	}
	look := prog.Looks[st.vizIdx]
	a := builtinActionIdentity(&djAction{viz: look.Viz, ix: look.Ix, reason: reason})
	if len(prog.Palettes) > 0 {
		st.palIdx = (st.palIdx + 1) % len(prog.Palettes)
		a.setPal = true
		a.pal = prog.Palettes[st.palIdx]
		a.upal = djNoUserPalette()
	}
	// Classic programs never paint segments, so this is a no-op there; it
	// guards the invariant if a classic rotation ever follows a painted look.
	return st.stampSegRestore(a)
}

// ═══════════════════════════════════════════════════════════════════
// Conductor lifecycle (methods on MusicModeService)
// ═══════════════════════════════════════════════════════════════════

// stopAutoDJ tears the conductor down and puts the desk back the way the user
// left it.
//
// Its own method because it owns a lock discipline the enable path cannot: it
// holds djApplyMu across the whole teardown (lock order: djApplyMu → mu), so a
// look that is mid-apply cannot commit AFTER the restore and put the DJ's
// generated segments straight back. The enable path resolves against the
// database with no locks held and re-takes djApplyMu later, so it must not
// hold it here.
func (m *MusicModeService) stopAutoDJ(userID int) error {
	m.djApplyMu.Lock()
	m.mu.Lock()
	if !m.active || m.userID != userID {
		uid := m.userID
		m.mu.Unlock()
		m.djApplyMu.Unlock()
		if uid != 0 && uid != userID {
			return fmt.Errorf("%w: active for user %d", ErrMusicModeConflict, uid)
		}
		return fmt.Errorf("music mode not active")
	}
	cancel := m.djCancel
	m.djCancel = nil
	m.djEnabled = false
	m.djProgram = ""
	m.djRequestGen++ // kills pending resolves
	m.djGen++        // kills the running conductor
	// Captured BEFORE the runtime is dropped: it is the only record of the
	// user's own canvas, and of whether the DJ ever painted over it.
	var restore *djBaseline
	if m.djRuntime != nil && m.djRuntime.program.WritesSegmentOverrides {
		b := m.djRuntime.baseline
		restore = &b
	}
	m.djRuntime = nil
	m.djNowPlaying = nil
	// A stopped show has no "previous look" any more — the next enable
	// starts a fresh attribution history, and carrying this one forward
	// would let a rating on a LATER, unrelated show cite a look from this
	// one as prevLook.
	m.djPrevLook = nil
	m.djRecentLooks = nil
	m.mu.Unlock()
	if cancel != nil {
		cancel()
		log.Printf("[MUSIC-DJ] Conductor stopped for user %d", userID)
	}
	// Drop the ENTIRE DJ overlay (bursts/randomize + Color Story moods):
	// the wire reverts to exactly the user's canonical tuning.
	m.dropDJTuningOverlay(userID)
	// TUNING is not the whole story. Stopping the conductor stops it WRITING
	// segments; it does not remove the ones already written. applyConfigPartial
	// keeps the last supplied slice in m.segmentConfigs and reuses it for every
	// later update that supplies none, so a composed effect or a preset's
	// colours would survive into the next manual visualization change — a look
	// the user chose, wearing something the DJ left behind.
	var restoreErr error
	if restore != nil {
		// No viz override and no since to guard: stopping already cleared
		// djNowPlaying above, so there is no published look left to correct.
		restoreErr = m.restoreDJSegmentCanvas(userID, *restore, -1, time.Time{}, "the DJ was stopped")
	}
	m.djApplyMu.Unlock()
	m.persistResumeIntent(userID)
	// The DJ IS stopped either way — the conductor is cancelled and the overlay
	// dropped — but a failed repaint means the desk still wears what it
	// generated, and saying "stopped" without saying that would be a lie by
	// omission. armPendingSegRestore has left the canvas queued for the next
	// config write, so this is recoverable, not lost.
	return restoreErr
}

// SetAutoDJ enables/disables the Auto DJ conductor for the session owner.
// Enabling is a THREE-PHASE atomic swap (reserve → resolve without locks →
// install): the running conductor keeps playing until its replacement is
// fully resolved, and a failed or superseded resolve leaves it untouched —
// never silence. Sentinel-wrapped errors map to 400/409 like the other
// music handlers.
func (m *MusicModeService) SetAutoDJ(userID int, enabled bool, program string) error {
	if !enabled {
		return m.stopAutoDJ(userID)
	}

	m.mu.Lock()
	if !m.active || m.userID != userID {
		uid := m.userID
		m.mu.Unlock()
		if uid != 0 && uid != userID {
			return fmt.Errorf("%w: active for user %d", ErrMusicModeConflict, uid)
		}
		return fmt.Errorf("music mode not active")
	}

	if program != "custom" {
		if _, ok := autoDJPrograms[program]; !ok {
			m.mu.Unlock()
			return fmt.Errorf("%w: unknown auto-dj program %q (chill|party|rave|custom)", ErrMusicModeValidation, program)
		}
	}

	// Phase 1: reserve a request generation. The running conductor (if any)
	// is deliberately untouched while we resolve.
	m.djRequestGen++
	requestGen := m.djRequestGen
	layerFx := m.fwLayerFxSupported
	baseline := djBaseline{visualMode: m.visualMode, paletteID: m.paletteID, upalRef: m.upalRef, speed: m.speed,
		intensity: m.intensity, segs: cloneMusicSegmentConfigs(m.segmentConfigs)}
	if m.djRuntime != nil {
		// The DJ is already conducting (any program): the live look is
		// DJ-authored, not the user's — carry the ORIGINAL baseline forward
		// so resume masking and custom-pick materialization stay anchored
		// to what the user actually had.
		baseline = m.djRuntime.baseline
	}
	m.mu.Unlock()

	// Phase 2: resolve with no locks held (DB + preset resolution).
	// ONE read for every preference. A failure is non-fatal for a BUILT-IN
	// program — loadFlashComfort's long-standing contract is that an unreadable
	// preference defaults to standard rather than refusing to start a show — but
	// a custom program cannot proceed without its pool, so that branch returns.
	stored, storedErr := m.loadDJStored(userID)
	if storedErr != nil {
		log.Printf("[MUSIC-DJ] Preference load failed (comfort=standard, beat-align=off): %v", storedErr)
	}
	comfort := FlashComfortFromInt(stored.FlashComfort)
	caps := m.DJCapabilities()
	var prog AutoDJProgram
	var settings *DJSettings
	if program == "custom" {
		if storedErr != nil {
			// A read that failed while a NEWER enable overtook us is not this
			// caller's problem — the newest request owns the outcome, which is
			// what the Phase 3 check below already encodes.
			//
			// This has to be EXPLICIT now. Before the two store reads were
			// consolidated into one, a custom enable read twice, and the second
			// read carried a fresh deadline; that accidental retry is what used
			// to absorb a timeout here. One read means one deadline, so the
			// supersede rule needs stating rather than emerging.
			m.mu.RLock()
			superseded := requestGen != m.djRequestGen
			m.mu.RUnlock()
			if superseded {
				log.Printf("[MUSIC-DJ] Enable of %q superseded during resolve — dropped", program)
				return nil
			}
			return storedErr
		}
		loaded, err := djSettingsFromStored(stored)
		if err != nil {
			return err
		}
		resolved, err := m.resolveDJSettings(userID, loaded, caps, comfort, baseline, false, time.Now().UnixNano())
		if err != nil {
			return err
		}
		prog = resolved
		settings = &loaded
	} else {
		base := autoDJPrograms[program]
		if comfort == FlashComfortOff {
			prog = base.filtered(layerFx) // classic path — behavior-identical to before
		} else {
			prog = base.comfortVariant(caps.LayerFxUsable(false), comfort, time.Now().UnixNano())
		}
	}
	// AFTER the branch, deliberately: built-ins are constructed by
	// filtered()/comfortVariant() and never pass through resolveDJSettings, so
	// assigning this inside the resolver would leave Chill/Party/Rave untouched.
	prog.BeatAlign = stored.BeatAlign

	// Phase 3: install atomically. Only now does the old conductor die —
	// and only if this request is still the newest and the session unchanged.
	m.djApplyMu.Lock()
	m.mu.Lock()
	if requestGen != m.djRequestGen || !m.active || m.userID != userID {
		m.mu.Unlock()
		m.djApplyMu.Unlock()
		log.Printf("[MUSIC-DJ] Enable of %q superseded during resolve — dropped", program)
		return nil
	}
	oldCancel := m.djCancel
	ctx, cancel := context.WithCancel(context.Background())
	m.djCancel = cancel
	m.djEnabled = true
	m.djProgram = program
	m.djGen++
	gen := m.djGen
	m.djRuntime = &djRuntimeConfig{
		programKey:   program,
		program:      prog,
		flashComfort: comfort,
		settings:     settings,
		baseline:     baseline,
		planVerified: caps.LayerFxKnown && caps.LayerFxSupported,
	}
	m.djRuntimeRev++
	m.djNowPlaying = nil
	// A newly (re)installed conductor — even a program change on an
	// already-running DJ — starts its own attribution history; the look
	// last published by whatever was running before is not "the previous
	// look" of this one.
	m.djPrevLook = nil
	m.djRecentLooks = nil
	m.djTuningUserLocked = nil // fresh session — fresh claims allowed
	m.mu.Unlock()
	m.djApplyMu.Unlock()
	if oldCancel != nil {
		oldCancel() // replacement is installed — retire the old loop
	}

	// Drop any overlay left by a previous program (old Color Story moods,
	// old program's bursts) so the new program starts from the user's
	// canonical tuning, then apply the new program's overlay moves before
	// the conductor starts — the first look already carries its feel.
	m.dropDJTuningOverlay(userID)
	m.reconcileDJOverlay(userID, prog.BurstsOn, prog.RandomizeOn)

	go m.runAutoDJ(ctx, gen, userID)
	log.Printf("[MUSIC-DJ] Conductor started for user %d (program=%s, comfort=%s, layerFx=%v)", userID, program, comfort, layerFx)
	m.persistResumeIntent(userID)
	return nil
}

// reconcileDJOverlay drives the Color Bursts / Beat Randomize overlays toward
// the program's wishes THROUGH THE DJ TUNING OVERLAY — the user's canonical
// tuning is never mutated:
//   - the program wants an overlay the user has OFF (and hasn't user-locked
//     this session) → the DJ overlays it on (owns it);
//   - the user already has it ON canonically → the DJ never touches it;
//   - the program doesn't want it → any DJ overlay for it is dropped, which
//     reverts the wire value to exactly the user's canonical state;
//   - a user flip mid-show arrives via UpdateFirmwareConfig, which releases
//     the field and user-locks it before transmission.
//
// Must NOT be called while holding m.mu.
func (m *MusicModeService) reconcileDJOverlay(userID int, burstsOn, randomizeOn bool) {
	m.mu.Lock()
	if !m.active || m.userID != userID {
		m.mu.Unlock()
		return
	}
	changed := false
	want := []struct {
		key string
		on  bool
	}{
		{"burstEnable", burstsOn},
		{"randomizeFlip", randomizeOn},
	}
	for _, w := range want {
		canonicalOn := (w.key == "burstEnable" && m.activeConfig.BurstEnable != 0) ||
			(w.key == "randomizeFlip" && m.activeConfig.RandomizeFlip != 0)
		_, overlaid := m.djTuningOverlay[w.key]
		switch {
		case w.on && !canonicalOn && !overlaid && !m.djTuningUserLocked[w.key]:
			if m.djTuningOverlay == nil {
				m.djTuningOverlay = map[string]djOverlayValue{}
			}
			m.djTuningOverlay[w.key] = djU8(1)
			changed = true
		case !w.on && overlaid:
			delete(m.djTuningOverlay, w.key)
			changed = true
		}
	}
	var cfg FirmwareMusicConfig
	supported := m.fwConfigSupported
	if changed {
		cfg = m.composeEffectiveConfigLocked()
	}
	m.mu.Unlock()

	if changed && supported {
		m.enqueueConfig(cfg)
		log.Printf("[MUSIC-DJ] Overlays reconciled: bursts=%v randomize=%v", burstsOn, randomizeOn)
	}
}

// AutoDJStatus returns (enabled, program) for status payloads.
func (m *MusicModeService) AutoDJStatus() (bool, string) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.djEnabled, m.djProgram
}

// stopAutoDJInternal tears the conductor down without touching the session.
// Called from every deactivation/cleanup path (mirror of closeUDPSender).
// Must NOT be called while holding m.mu.
func (m *MusicModeService) stopAutoDJInternal() {
	m.mu.Lock()
	cancel := m.djCancel
	uid := m.userID
	m.djCancel = nil
	m.djEnabled = false
	m.djProgram = ""
	m.djRequestGen++ // pending resolves must not resurrect a torn-down DJ
	m.djGen++
	m.djRuntime = nil
	m.djNowPlaying = nil
	// See stopAutoDJ: a torn-down session's "previous look" belongs to a
	// show that no longer exists.
	m.djPrevLook = nil
	m.djRecentLooks = nil
	m.mu.Unlock()
	if cancel != nil {
		cancel()
		log.Printf("[MUSIC-DJ] Conductor stopped (session teardown)")
	}
	// Drop the whole DJ overlay. Canonical tuning was never dirtied, so on a
	// still-live session this synchronously restores the user's own state;
	// on a torn-down session there is simply nothing to restore.
	m.dropDJTuningOverlay(uid)
}

// runAutoDJ is the conductor loop. Each tick snapshots the SHARED runtime
// under RLock (so reconfigures — Flash Comfort, settings hot-reloads — are
// visible on the very next tick without a goroutine restart), decides via the
// pure djDecide, then re-checks (djGen, djRuntimeRev) under djApplyMu before
// applying — a tick that straddles a runtime swap discards its stale action.
// Switches go through applyConfigPartial — the same code path as a user
// config change, so write-gate/session re-checks all still apply.
func (m *MusicModeService) runAutoDJ(ctx context.Context, gen uint64, userID int) {
	st := newAutoDJState(time.Now().Add(-m.djTestStartBackdate))
	// Open — or CONTINUE — the recording for this show. Deliberately not cleared
	// on exit: the recording is almost always asked for after the music stops,
	// and a conductor restart mid-listening (auto-resume, a coach program change,
	// an app toggle) is a seam in one show, not the start of another.
	m.djRec.start(userID, time.Now(), m.currentDJProgramKey())
	storyIdx := 0                  // Color Story mood cursor (persists across runtime swaps)
	varState := djVariationState{} // burst-shape and physics cursors, likewise
	ticker := time.NewTicker(djTickInterval)
	defer ticker.Stop()

	// A held action must never vanish uncounted. The loop has two exits — ctx
	// cancellation and the !alive check — and the counters are process-wide, so a
	// switch deferred by one conductor and dropped on its way out would leave
	// switches_deferred permanently unmatched by either of its outcomes.
	//
	// A defer rather than a line at each return, for the same reason the slot is
	// popped rather than cleared in branches: it cannot be missed, including by
	// an exit added later.
	defer func() {
		if st.blocked != nil {
			m.noteDJAbandoned(time.Now(), st.blocked, "conductor stopped")
			st.blocked = nil
		}
		// The armed slot needs the same treatment, and for the same reason: a
		// switch counted into switches_armed must reach a terminal outcome, or
		// the beat-align ledger never balances either.
		m.cancelArmed(st, "conductor stopped")
	}()

	for {
		// Two wake sources, ONE body. A fired beat and an ordinary tick differ only
		// in whether the action is already decided, so branching inside the body
		// keeps the (gen, rev) recheck and the apply ladder in a single place —
		// duplicating them per case is how the two paths drift apart.
		var now time.Time
		var fired *armedSwitch
		select {
		case <-ctx.Done():
			return
		case now = <-ticker.C:
		case now = <-st.armedChan():
			fired, st.beatArmed = st.beatArmed, nil
		}

		m.mu.RLock()
		alive := m.active && m.userID == userID && m.djEnabled && m.djGen == gen && m.djRuntime != nil
		var prog AutoDJProgram
		var rev uint64
		var programKey string
		var baseline djBaseline
		var planVerified bool
		if alive {
			prog = m.djRuntime.program
			programKey = m.djRuntime.programKey
			rev = m.djRuntimeRev
			baseline = m.djRuntime.baseline
			planVerified = m.djRuntime.planVerified
		}
		met := m.metrics
		// What the strip is showing, read under the SAME lock as the metrics.
		// djNowPlaying is written at apply time and gen-checked, so an action
		// that was decided but never landed does not advance the identity —
		// which is what keeps a blocked-then-retried switch from being treated
		// as a repeat of itself.
		cur := djLookIdentity{viz: m.visualMode}
		if m.djNowPlaying != nil {
			cur.refID = m.djNowPlaying.RefID
			cur.baseRefID = m.djNowPlaying.BaseRefID
		}
		m.mu.RUnlock()
		if !alive {
			return
		}

		// Sample the music UNCONDITIONALLY, before deciding. The gaps are the
		// point: "the analyzer raised eleven drops and the DJ slammed on three"
		// is a finding about the ticks where nothing happened, and it is
		// unreachable from a record that only has rows where switches are.
		m.djRec.addSample(now, met)

		// retried is non-nil only when this tick is REPLAYING a held action; fired
		// is non-nil when an armed beat arrived. Both separate "a rescued switch
		// landed" from "a fresh decision landed" on every outcome below.
		var act *djAction
		var retried *blockedSwitch
		applyRev, applyBaseline := rev, baseline

		if fired != nil {
			// The armed beat arrived. djDecide is NOT consulted: this action was
			// decided when it was armed, and deciding again would advance the deck
			// cursor and mutate st as though the switch had happened twice.
			act = fired.act
			applyRev, applyBaseline = fired.rev, fired.baseline
		} else {
			act = djDecide(&prog, st, met, now, cur)
			if act != nil {
				m.djSwitchesDecided.Add(1)
				// A fresh decision always supersedes a waiting beat. A drop or a
				// quiet transition is REACTIVE and must not sit behind a phrase
				// rotation's timer — and its repaint merges forward for exactly the
				// reason the blocked path does: stampSegRestore already consumed
				// segOverridesLive when the armed action was decided.
				if st.beatArmed != nil {
					act.restoreSegs = act.restoreSegs || st.beatArmed.act.restoreSegs
					m.cancelArmed(st, "a newer decision arrived")
				}
			}

			// POP the held action. The slot is empty by default, so no path below
			// can leak an obsolete action forward by omission — putting it back is
			// a deliberate act, made in exactly one place.
			pending := st.blocked
			st.blocked = nil

			arb := arbitrateSwitch(act, pending, now)
			if arb.rearmSegs {
				st.segOverridesLive = true
			}
			if arb.abandoned != nil {
				m.noteDJAbandoned(now, arb.abandoned, arb.why)
			}
			act, retried = arb.act, arb.retried
			if act == nil {
				continue
			}
			// Stamped from the runtime snapshot read at the top of this tick,
			// so every recorded event carries the capability state that was
			// true when the action was decided — not whatever it is by the
			// time the recorder runs.
			act.planVerified = planVerified
			if retried != nil {
				applyRev, applyBaseline = retried.rev, retried.baseline
			}

			// Hold a phrase rotation for its beat.
			//
			// NOT a replay: a switch that already waited out a movement indicator
			// is late enough, and adding up to another beat compounds the delay it
			// was just rescued from.
			if prog.BeatAlign && act.reason == "phrase" && retried == nil {
				m.mu.RLock()
				age := now.Sub(m.metricsUpdated)
				m.mu.RUnlock()
				if wait, ok := msUntilAlignedFire(met, age, djBeatAlignLeadMs); ok {
					st.beatArmed = &armedSwitch{
						act: act, rev: applyRev, baseline: applyBaseline,
						programKey: programKey, timer: time.NewTimer(wait),
						armedAt: now, scheduledWait: wait,
						sampleAgeMs: age.Milliseconds(),
						armedPhase:  met.BeatPhase, bpm: met.Bpm,
					}
					m.djSwitchesArmed.Add(1)
					m.recArmed(now, act, programKey, wait)
					continue
				}
			}
		}

		// Serialize with runtime swaps: the (gen, rev) recheck + apply +
		// count/broadcast happen under djApplyMu so a swap waits out an
		// in-flight application and no stale action lands after it.
		//
		// applyRev is the STORED revision when replaying. Re-reading it and
		// comparing it to itself would be vacuous — it could never detect a
		// swap between the original decide and this retry.
		m.djApplyMu.Lock()
		m.mu.RLock()
		still := m.djGen == gen && m.djRuntimeRev == applyRev && m.active && m.userID == userID
		m.mu.RUnlock()
		if !still {
			m.djApplyMu.Unlock()
			// Runtime swapped mid-tick — the action is stale. Discard it
			// outright rather than leaving it held: an action decided against
			// a retired runtime must never survive to a later tick.
			if act.restoreSegs {
				st.segOverridesLive = true
			}
			if retried != nil {
				m.noteDJAbandoned(now, retried, "runtime swapped")
			}
			if fired != nil {
				m.djArmedDropped.Add(1)
			}
			continue
		}

		// act.ix carries the look variant; nil lets applyConfigPartial
		// reset to the effect's default intensity on the viz change.
		update := MusicConfigUpdate{Visualization: &act.viz, Intensity: act.ix}
		if act.setPal {
			update.PaletteID = &act.pal
		}
		if act.upal != nil {
			update.UpalRef = act.upal
		}
		if act.speed != nil {
			update.Speed = act.speed
		}
		if len(act.segs) > 0 {
			update.SegmentConfigs = act.segs
		} else if act.restoreSegs {
			update.SegmentConfigs = baselineSegCanvas(applyBaseline, m.hasSceneColors())
		}
		// This write belongs to the look about to be published, not to the one still installed.
		m.beginDJSwitchRender()
		if err := m.applyConfigPartial(userID, update); err != nil {
			m.endDJSwitchRender()
			m.djApplyMu.Unlock()
			if IsWriteBlocked(err) {
				// Something more important owns the strip — a movement
				// indicator at PriorityStatusOverride. HOLD the exact action
				// and replay it: re-deciding would draw a different deck card
				// and mutate st as though this switch had happened twice.
				if retried != nil {
					// MUTATE the popped value. Constructing a fresh one here
					// would refresh decidedAt on every attempt, so the
					// staleness bound could never fire and a blocked action
					// would live indefinitely.
					retried.attempts++
					st.blocked = retried
				} else {
					st.blocked = &blockedSwitch{
						act:       act,
						rev:       applyRev,
						baseline:  applyBaseline,
						decidedAt: now,
						attempts:  1,
					}
					// Counted once per UNIQUE action, on the empty ->
					// occupied transition, not once per retry.
					m.djSwitchesDeferred.Add(1)
					m.noteDJBlocked(act, err)
					m.recDeferred(now, act, programKey, err)
					if fired != nil {
						// The beat arrived and the strip was busy. Terminal for
						// the ARMED ledger — this action can no longer land on a
						// beat — while the blocked ledger takes over its landing.
						// Without this the armed ledger never balances again.
						m.djArmedDeferred.Add(1)
					}
				}
				continue
			}
			// Non-fatal: session may be mid-teardown; the alive check
			// on the next tick exits cleanly.
			log.Printf("[MUSIC-DJ] Switch failed (non-fatal): %v", err)
			m.recFailed(now, act, programKey, err)
			if act.restoreSegs {
				// The baseline repaint never landed — the previous
				// look's colors are still live; try again next look.
				st.segOverridesLive = true
			}
			if retried != nil {
				m.noteDJAbandoned(now, retried, "apply failed")
			}
			if fired != nil {
				m.djArmedDropped.Add(1)
			}
			continue
		}
		// It landed: only a look that reached the strip starts the drop cooldown.
		st.noteLanded(&prog, act, now)
		var commitMet AudioMetrics
		if fired != nil {
			m.djArmedFired.Add(1)
			// Re-read the phase AFTER the write. `met` is the fire-time snapshot
			// taken at the top of this tick, and reporting it as "commit" would
			// measure the instant the timer fired rather than the instant the
			// pixels changed — which is the only thing the alignment claim is
			// about, and the difference is the entire write latency.
			m.mu.RLock()
			commitMet = m.metrics
			m.mu.RUnlock()
			m.noteBeatAlignCommit(fired, met, commitMet, time.Now())
		}
		if retried != nil {
			held := now.Sub(retried.decidedAt)
			m.djSwitchesAppliedLate.Add(1)
			m.noteDJDeferMs(held)
			log.Printf("[MUSIC-DJ] Deferred %s → %s landed after %v (%d attempt(s))",
				act.reason, act.label, held.Round(time.Millisecond), retried.attempts)
		}

		// The look's identity timestamp, truncated to MILLISECONDS.
		//
		// This value leaves the process and has to come back byte-identical:
		// the rating endpoint compares a client's echoed `since` against it
		// with time.Equal, and stores the result as `agreed`. time.Now() has
		// NANOSECOND precision, which no mainstream client can hold — Dart's
		// DateTime tops out at microseconds and JavaScript's Date at
		// milliseconds — so a nanosecond stamp is silently truncated on the
		// way through and can never compare equal on the way back.
		//
		// Measured live 2026-08-23: with the frame carrying
		// "…T14:16:20.354353386-07:00", a Flutter client that echoed the
		// server's own value verbatim still recorded agreed=false, because it
		// could only return .354353000. Milliseconds is the floor across
		// clients and is ample here — looks are ≥8s apart (djHardFloorSec), so
		// no two can share a millisecond.
		//
		// Deliberately NOT applied to `now` itself: `now` also drives cadence
		// and beat-alignment arithmetic, where the measured error budget is
		// tens of milliseconds and rounding the clock would be a real
		// perturbation for no benefit. Only the published identity is coarsened.
		sinceStamp := djPublishedSince(now)

		// PUBLISH THE APPLY-TIME IDENTITY BEFORE RELEASING djApplyMu.
		//
		// Safety reconciliation reads djNowPlaying.RecipeID to decide whether a
		// live composition is still permitted, and it serialises against this
		// apply on djApplyMu. So a recipe that has reached the strip has to be
		// NAMED before that lock becomes available — otherwise a reconfigure
		// slipping in between judges the previous look, finds it harmless, and
		// leaves an outlawed composition running.
		//
		// The variation ids are decoration and are patched in below; the fields
		// that gate a safety decision are all known right here.
		m.installDJNowPlaying(gen, &DJNowPlaying{
			Viz:           act.viz,
			RefID:         act.refID,
			BaseRefID:     act.baseRefID,
			Label:         act.label,
			LookKind:      act.lookKind,
			Program:       programKey,
			Reason:        act.reason,
			TierPlan:      [djNumTiers]int(djResolvedPlanOf(act.tiers, act.viz)),
			RecipeID:      act.recipeID,
			RecipeName:    act.recipeName,
			SliderID:      act.sliderID,
			TierSliderIDs: act.tierSliderIDs,
			PlanVerified:  act.planVerified,
			Since:         sinceStamp,
		})

		djRecordPlay(prog.Selector, act)
		m.djApplyMu.Unlock()

		// The overlay families run AFTER the apply lock is released — both take
		// m.mu to recompose and enqueue — and stamp their recipe ids onto the
		// action as they go.
		m.maybeAdvanceColorStory(userID, gen, act, &storyIdx)
		m.maybeAdvanceVariations(userID, gen, act, &varState)

		// Patch those ids into the snapshot published above, so the settings
		// sheet's bootstrap and the WS frame describe the look identically.
		// Matched on Since as well as gen: a newer look may already have
		// replaced the snapshot, and decorating it with THIS look's tuning
		// would be a lie about both.
		m.mu.Lock()
		if m.djGen == gen && m.djNowPlaying != nil && m.djNowPlaying.Since.Equal(sinceStamp) {
			m.djNowPlaying.BurstRecipeID = act.burstRecipeID
			m.djNowPlaying.RandomizeRecipeID = act.randomizeRecipeID
			m.djNowPlaying.PhysicsRecipeID = act.physicsRecipeID
		}
		m.mu.Unlock()

		m.broadcastDJLook(userID, act, programKey, sinceStamp)
		if act.setPal {
			log.Printf("[MUSIC-DJ] %s → %s viz=%d pal=%d (bpm=%d)", act.reason, act.label, act.viz, act.pal, met.Bpm)
		} else {
			log.Printf("[MUSIC-DJ] %s → %s viz=%d (bpm=%d)", act.reason, act.label, act.viz, met.Bpm)
		}
		// ONE event per landing, decorated with the rescue/alignment facts rather
		// than emitting a second event for them — so filtering kind=="applied"
		// yields the complete playlist with nothing double-counted.
		m.recApplied(now, act, programKey, retried, fired, commitMet)
	}
}
