// services/music_auto_dj_deck.go
// Weighted look selection for the Auto DJ "custom" program ("You Are The DJ").
//
// The deck is a weighted shuffle bag: every pool entry appears `weight` times
// in a shuffled draw order, consumed front-to-back and reshuffled when
// exhausted. That gives deterministic proportions (a weight-4 look gets 4x the
// airtime of a weight-1 look over any full cycle), never starves a weight-1
// look, and never repeats the on-screen visualization unless it is the only
// playable one — matching rotate()'s viz-only equality semantics.

package services

import (
	"fmt"
	"math/rand"
	"sync"
)

// djPick is one fully-resolved, playable pool entry the selector can hand the
// conductor. look.Ix carries the stored intensity (a preset/favorite's
// explicit intensity, or nil for the effect default). pal/speed are ALWAYS
// materialized for custom picks — a preset's own values when stored, else the
// session Baseline captured at DJ start — so a preset's palette/speed can
// never bleed into the next builtin look.
//
// Scope note: rotate() may override a BUILTIN pick's materialized pal with the
// program's own Palettes pool (that is what makes the custom show dynamic).
// A preset/favorite pick's pal is never overridden — it is that look's identity.
type djPick struct {
	look  DJLook
	pal   *int
	upal  *string // the look's user palette; see djAction.upal
	speed *int
	kind  string // "builtin" | "music_favorite" | "custom_preset"
	label string // display name for WS/telemetry ("Wave", "Sunday Chill")
	refID string // stable identity: "builtin:<viz>" | "music_favorite:<id>" | "custom_preset:<uuid>"
	// baseRefID is the POOL entry this pick came from. It equals refID for
	// every ordinary pick and differs only for a remix, whose refID carries a
	// "@viz<N>" suffix so its identity is distinct while baseRefID still names
	// the preset the colours belong to.
	//
	// It is a real field rather than something decoded out of refID because two
	// consumers need the pool entry and must not learn the suffix format: the
	// deck's no-repeat delegation, and play counts (which the settings sheet
	// looks up by the pool card's own id).
	baseRefID string
	// segs carries the look's own per-segment overrides — a preset's stored
	// segment colors (most user presets are pal-0 + hand-picked colors, so
	// without these every preset plays as a same-palette twin). nil = the
	// look has no colors of its own; the conductor restores the baseline
	// canvas when the previous look painted one.
	segs []MusicSegmentConfig
	// remixable reports whether this look has COLOUR IDENTITY of its own —
	// worth carrying onto another effect. Resolved when the pool is built,
	// because the answer depends on the session baseline palette, which the
	// selector does not have.
	//
	// It is NOT `len(segs) > 0`: user 26's music favourites each store eight
	// segments of the form {"id":0,"on":true}, which is a non-empty slice
	// carrying no paint. Nor is it `kind != builtin`: a favourite with neither
	// segment colours nor an explicit palette simply inherits the baseline and
	// has nothing of its own to travel.
	remixable bool
	// tiers is the composition plan for this look: which of the five physical
	// tiers render something other than the base visualization. nil is the
	// uncomposed case and is what every selector produces when composition is
	// off, so an off toggle is not merely equivalent to neutral — it is the
	// same nil.
	tiers *djTierVizPlan
	// tierParams resolves each REPLACED tier's own two knobs. Separate from
	// tiers because the plan is what telemetry reports and the params are what
	// the wire needs — and because a plan is a curated constant while its
	// params are drawn per switch.
	tierParams *djTierPlanParams
	recipeID   string // "" when uncomposed
	recipeName string
	// sliderID names the per-effect slider setting applied to this look, or
	// "" when the look kept its own. The resting member leaves this empty
	// deliberately: "base" would report a variation that did nothing.
	sliderID string
}

// djLookIdentity is what is currently ON THE STRIP, as the selector needs to
// see it to avoid an invisible "switch".
//
// viz is the live visualization (m.visualMode). refID is the stable identity of
// the look the DJ last successfully APPLIED — apply-time and gen-checked, so it
// describes the strip rather than the state machine's intentions. It is empty
// before the first switch of a show, and repeats() falls back to viz there so
// the opening switch still visibly changes whatever was on screen.
type djLookIdentity struct {
	viz   int
	refID string
	// baseRefID is the pool entry behind refID — equal to it for ordinary
	// looks, the un-suffixed source for a remix. The remix selector delegates
	// on THIS so the inner deck compares against pool identities it can
	// actually match; see djRemixSelector.next.
	baseRefID string
}

// repeats reports whether picking p would leave the strip looking the same.
//
// Identity is the refID, NOT the visualization. The viz-only rule this replaces
// was written when every look was a colourless builtin, where viz + palette WAS
// the look. Once "You Are The DJ" let a pick carry its own per-segment colors,
// two entries on the same viz became two different paintings — and a pool built
// mostly from music favourites and presets resolves overwhelmingly to viz 0, so
// viz-only equality collapsed them into one card and forced the show to
// alternate. Measured on a 2026-08-20 hour: 0 same-viz transitions in 470, where
// the configured weights called for ~188.
//
// Builtin behaviour is unchanged: their refIDs are "builtin:<viz>", so two
// builtin entries on one viz still compare equal.
func (c djLookIdentity) repeats(p djPick) bool {
	if c.refID != "" {
		return p.refID == c.refID
	}
	return p.look.Viz == c.viz
}

// djSelector abstracts "what look comes next" so weighted/preset-aware
// programs plug into the same drop/quiet/phrase state machine without
// djDecide knowing about weights or presets. nil on AutoDJProgram preserves
// the classic round-robin for chill/party/rave exactly as today.
type djSelector interface {
	next(cur djLookIdentity) djPick
}

// djPlayRecorder is the per-session play-count surface a selector may expose.
//
// It exists because the conductor and the settings endpoint used to reach the
// deck by concrete type (`prog.Selector.(*djDeck)`). The moment any decorator
// wraps the deck those assertions stop matching — silently: the show keeps
// selecting correctly while every play count disappears from the settings
// sheet, with no error anywhere. Both call sites now ask for this interface,
// and every selector that wraps another must delegate rather than reimplement.
//
// snapshot returns map[string]int because that is the existing contract, all
// the way out to MusicModeService.DJPlayCounts.
type djPlayRecorder interface {
	recordPlayed(refID string)
	snapshot() map[string]int
}

// djWeightedLook pairs a pick with its user-assigned weight (1-4; weight-0
// "Off" entries never reach a pool).
type djWeightedLook struct {
	pick   djPick
	weight int
}

// djDeck implements djSelector. Guarded by its own mutex: the conductor
// goroutine calls next()/recordPlayed(); status/settings HTTP handlers read
// snapshot() concurrently.
type djDeck struct {
	mu        sync.Mutex
	pool      []djWeightedLook
	order     []int // shuffled indices into pool; consumed front-to-back
	pos       int
	rng       *rand.Rand
	playCount map[string]int // refID -> successful applies this DJ session
}

// newDJDeck builds a deck over a non-empty resolved pool. The seed is
// injected so tests are deterministic; production callers pass
// time.Now().UnixNano().
func newDJDeck(pool []djWeightedLook, seed int64) *djDeck {
	return &djDeck{
		pool:      pool,
		rng:       rand.New(rand.NewSource(seed)),
		playCount: make(map[string]int, len(pool)),
	}
}

// reshuffle rebuilds the draw order from the pool weights. Caller holds d.mu.
func (d *djDeck) reshuffle() {
	d.order = d.order[:0]
	for i, wl := range d.pool {
		for k := 0; k < wl.weight; k++ {
			d.order = append(d.order, i)
		}
	}
	d.rng.Shuffle(len(d.order), func(i, j int) { d.order[i], d.order[j] = d.order[j], d.order[i] })
	d.pos = 0
}

// next draws the upcoming look. It scans forward for the first card that would
// not repeat the on-screen look (see djLookIdentity.repeats) and swaps it to
// the front.
//
// The no-repeat rule OUTRANKS exact proportions: a repeat is an invisible
// non-switch (a dead phrase), so when the remaining tail of a cycle is
// uniformly the on-screen look it is discarded and the deck reshuffled.
// Consequences, by design:
//   - pools with 3+ distinct entries track their weights closely (uniform
//     tails are rare) — which is now every non-trivial pool, since identity is
//     per-entry rather than per-visualization;
//   - a 2-entry pool degrades toward alternation no matter how skewed its
//     weights (playing Comet 4x more than Wave back-to-back is impossible
//     without repeats);
//   - a single-entry pool accepts the repeat rather than looping forever.
func (d *djDeck) next(cur djLookIdentity) djPick {
	d.mu.Lock()
	defer d.mu.Unlock()
	if len(d.pool) == 0 {
		// Construction guarantees a non-empty pool (resolveDJSettings errors
		// on empty); this is a belt-and-braces zero value, not a real path.
		return djPick{look: DJLook{Viz: -1}}
	}
	if d.pos >= len(d.order) {
		d.reshuffle()
	}
	if !d.swapNonRepeatToFront(cur) {
		d.reshuffle()               // discard the unplayable uniform tail
		d.swapNonRepeatToFront(cur) // single-entry pool: accept the repeat
	}
	picked := d.pool[d.order[d.pos]].pick
	d.pos++
	return picked
}

// swapNonRepeatToFront moves the first remaining card that would not repeat the
// on-screen look to position pos, reporting whether one existed. Caller holds
// d.mu.
func (d *djDeck) swapNonRepeatToFront(cur djLookIdentity) bool {
	for i := d.pos; i < len(d.order); i++ {
		if !cur.repeats(d.pool[d.order[i]].pick) {
			d.order[d.pos], d.order[i] = d.order[i], d.order[d.pos]
			return true
		}
	}
	return false
}

// recordPlayed bumps a look's play count. Called by the conductor only AFTER
// the switch was successfully applied to the desk — a failed apply is not a
// play (and never after a runtime swap invalidated the action).
func (d *djDeck) recordPlayed(refID string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.playCount[refID]++
}

// snapshot returns a copy of the play counts for status/settings payloads.
func (d *djDeck) snapshot() map[string]int {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make(map[string]int, len(d.playCount))
	for k, v := range d.playCount {
		out[k] = v
	}
	return out
}

// ═══════════════════════════════════════════════════════════════════════════
// Remix — a preset's colours under a different effect
// ═══════════════════════════════════════════════════════════════════════════

// djRemixRate: one in N remixable draws is remixed. Only draws that are BOTH
// colour-carrying AND have at least one alternate effect advance the counter,
// so a run of builtins can neither starve the cadence nor make it bunch up.
const djRemixRate = 3

// djRemixSeedSalt derives the remixer's RNG stream from the resolver's seed.
//
// A distinct salt is required, not decoration: two *rand.Rand built from the
// same seed emit identical sequences. A separate generator (rather than
// borrowing the deck's) is required too — sharing one would make every remix
// decision consume shuffle entropy, so turning the toggle on would change which
// cards the deck draws, not merely how they are painted.
const djRemixSeedSalt int64 = 0x5245_4D49_5800 // "REMIX"

// djRemixSelector wraps a selector and sometimes replays the drawn look's
// COLOURS under a different effect, so a user's hand-painted presets reach the
// tier-aware effects (Tower/Ripple/Bass Sky/Drop) without one saved preset per
// combination.
//
// It deliberately decorates rather than expanding the pool: enumerating
// colour x effect into the pool would multiply it, swamp the builtins, and
// silently change what every user-assigned weight means.
type djRemixSelector struct {
	inner djSelector
	// effects are the remix targets: rated BUILTIN visualizations from the
	// capability- and comfort-filtered pool, each listed djRemixWeight times
	// (classics 2, tier-aware 4, The Drop 1), so a uniform draw is weighted.
	effects       []int
	baselineSpeed int
	rng           *rand.Rand
	draws         int
}

// newDJRemixSelector returns inner unchanged when there is nothing to remix
// with, so an empty effect set can never cost a wrapper on the hot path.
func newDJRemixSelector(inner djSelector, effects []int, baselineSpeed int, seed int64) djSelector {
	if len(effects) == 0 {
		return inner
	}
	return &djRemixSelector{
		inner:         inner,
		effects:       effects,
		baselineSpeed: baselineSpeed,
		rng:           rand.New(rand.NewSource(seed ^ djRemixSeedSalt)),
	}
}

// recordPlayed / snapshot delegate so wrapping the deck cannot lose telemetry.
//
// recordPlayed receives the BASE id from the conductor, so a remix increments
// the count on the preset it came from — which is the id the settings sheet's
// pool cards look their counts up by.
func (r *djRemixSelector) recordPlayed(refID string) {
	if rec, ok := r.inner.(djPlayRecorder); ok {
		rec.recordPlayed(refID)
	}
}

func (r *djRemixSelector) snapshot() map[string]int {
	if rec, ok := r.inner.(djPlayRecorder); ok {
		return rec.snapshot()
	}
	return nil
}

// next draws from the inner selector and may remix the result.
//
// The delegated identity is the BASE, never the suffixed one. The inner deck
// compares against pool refIDs, which are always un-suffixed; hand it
// "custom_preset:X@viz6" and it can match nothing, concludes no card would
// repeat, and is free to redraw the very preset already on screen — which this
// function might then remix onto the same effect again. Delegating the base
// guarantees a different SOURCE, and therefore a different final identity
// whichever effect is chosen, with no second check needed here.
func (r *djRemixSelector) next(cur djLookIdentity) djPick {
	base := cur
	base.refID = cur.baseRefID
	if base.refID == "" {
		base.refID = cur.refID // pre-remix sessions, and the opening switch
	}
	pick := r.inner.next(base)

	if !pick.remixable {
		return pick
	}
	targets := r.targetsFor(pick.look.Viz)
	if len(targets) == 0 {
		return pick
	}
	// Only genuinely remixable draws advance the cadence.
	r.draws++
	if r.draws%djRemixRate != 0 {
		return pick
	}
	return r.remix(pick, targets[r.rng.Intn(len(targets))])
}

// targetsFor filters the effect list against the source visualization.
//
// Filtering up front rather than re-rolling matters: `effects` can be non-empty
// while every entry equals the source (only Spectrum rated, preset saved on
// Spectrum), and rejection sampling there would spin forever. Remixing a look
// onto its own effect is also just an invisible non-switch.
func (r *djRemixSelector) targetsFor(srcViz int) []int {
	out := make([]int, 0, len(r.effects))
	for _, v := range r.effects {
		if v != srcViz {
			out = append(out, v)
		}
	}
	return out
}

// remix rebuilds a pick as "this look's colours, that effect".
//
// Colours travel; effect parameters do not. sx and ix mean something different
// under every effect — Spectrum's ix is a band map, Tower's is bass direction,
// Ripple's is beat-vs-bar cadence (see defaultIx) — so carrying a preset's
// stored 178 from Spectrum to Tower would silently move the bass to the head.
func (r *djRemixSelector) remix(pick djPick, viz int) djPick {
	ix := defaultIx[viz]
	speed := r.baselineSpeed
	out := pick
	out.look = DJLook{Viz: viz, Ix: &ix}
	out.speed = &speed
	out.segs = sanitizeRemixSegs(pick.segs)
	out.refID = fmt.Sprintf("%s@viz%d", pick.baseRefID, viz)
	out.baseRefID = pick.baseRefID
	out.label = fmt.Sprintf("%s · %s", pick.label, musicVizNames[viz])
	return out
}

// sanitizeRemixSegs keeps ONLY what paints, and returns nil when nothing does.
//
// MusicSegmentConfig is not a colour struct: it also carries FX, SX, IX, On,
// Reverse and Mirror. Copying a source's segments wholesale would let a stored
// per-segment FX override the very effect this remix exists to apply, defeating
// the feature while looking like it worked.
//
// The nil-when-empty rule is equally load-bearing. Stripping the forbidden
// fields from a segment like {"id":0,"on":true} leaves {"id":0} — no paint, but
// still a non-empty slice — and rotate() branches on LENGTH: a non-empty segs
// marks the canvas dirty and returns before stampSegRestore, so the previous
// preset's colour slots would survive underneath a palette-only remix.
func sanitizeRemixSegs(in []MusicSegmentConfig) []MusicSegmentConfig {
	if len(in) == 0 {
		return nil
	}
	out := make([]MusicSegmentConfig, 0, len(in))
	for _, s := range in {
		if s.Col == nil && s.Pal == nil {
			continue
		}
		clean := MusicSegmentConfig{ID: s.ID}
		if s.Col != nil {
			c := *s.Col
			clean.Col = &c
		}
		if s.Pal != nil {
			p := *s.Pal
			clean.Pal = &p
		}
		out = append(out, clean)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
