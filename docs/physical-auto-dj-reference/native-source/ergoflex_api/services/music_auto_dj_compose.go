// services/music_auto_dj_compose.go
// Tier composition — different effects on different shelves at the same time.
//
// Until now the show always ran ONE effect across all eight strips. The desk is
// five physical surfaces (music_auto_dj_tiers.go), and the firmware renders
// switch (seg.fx) INSIDE a per-segment loop, so it has always been able to run
// a different effect per strip. A recipe is a curated way of using that.
//
// HOW A COMPOSED LOOK REACHES THE STRIP, and why the clearing rules below are
// what they are. makeSegmentPayloads rebuilds all eight segments on EVERY
// transmission, writing the global visualization's fx as the floor and layering
// per-segment overrides on top. Two consequences:
//
//   - An inherited tier needs no override at all. It receives the base fx and
//     the action's own intensity, which is exactly what "inherit" means — and
//     is why a neutral plan is byte-identical to composition being off.
//   - A composed override does NOT clear itself. applyConfigPartial keeps the
//     supplied slice in m.segmentConfigs and reuses it whenever a later update
//     supplies none, so a composed look rides along until something replaces
//     it. The existing baseline-restore path (segOverridesLive → restoreSegs →
//     baselineSegCanvas) is what replaces it, and because makeSegmentPayloads
//     rebuilds all eight segments from the global viz, that restore clears
//     every composed strip whether or not the user's own canvas mentions it.
//
// So composition needs no new teardown machinery: it needs to mark the same
// "generated segment overrides are live" flag that a preset's colours do.

package services

import (
	"fmt"
	"math/rand"
)

// djTierVizPlan is what each tier renders, as Auto DJ VISUALIZATION ids
// (0-9) — not firmware FX ids. The index is the firmware layer: 0 is The
// Head, 4 is The Feet. djTierInherit means "leave this tier on the base look".
//
// Visualization ids rather than fx ids because everything upstream — the pool,
// capability filtering, comfort classification, the recipe catalogue, the
// settings sheet — speaks visualizations. Converting to fx happens once, at
// the moment segment overrides are emitted, so there is exactly one place the
// two numbering schemes meet.
type djTierVizPlan [djNumTiers]int

// djTierInherit marks a tier the recipe does not replace.
const djTierInherit = -1

// djNeutralTierPlan replaces nothing.
var djNeutralTierPlan = djTierVizPlan{
	djTierInherit, djTierInherit, djTierInherit, djTierInherit, djTierInherit,
}

// composes reports whether the plan replaces any tier.
func (p djTierVizPlan) composes() bool {
	for _, v := range p {
		if v != djTierInherit {
			return true
		}
	}
	return false
}

// resolvedAgainst returns the plan with every inherited tier filled in from
// the base visualization — five concrete ids, which is what telemetry and
// classification consume.
//
// Deliberately a DIFFERENT value from the recipe's own plan, and deliberately
// not a type alias for it: a recipe plan may contain djTierInherit and a
// resolved plan may not, and one being silently passed where the other is
// expected is the kind of thing a shared type would hide.
func (p djTierVizPlan) resolvedAgainst(baseViz int) djTierVizPlan {
	out := p
	for i, v := range out {
		if v == djTierInherit {
			out[i] = baseViz
		}
	}
	return out
}

// djNeutralSx is the speed a replaced tier renders at when slider variation
// is off.
//
// 128 is not a guess: every effect maps sx linearly, and 128 lands in the
// middle of each one's own range — Spectrum and Tower reach gamma exponent
// 1.0 (of 0.4-1.6), Ripple wave width 0.18 (of 0.06-0.30), Bass Sky decay 24
// (of 8-39), The Drop brightness floor 16 (of 0-31). One constant, five
// effects, each at its own midpoint.
const djNeutralSx = 128

// djTierParams is what one tier actually renders: its effect, and the two
// per-effect knobs resolved FOR THAT EFFECT.
//
// It exists because sx is a single global value that firmware applies to every
// segment, so before this a recipe replacing a tier left that tier running a
// speed chosen for a completely different effect. The two are not the same
// quantity — sx is contrast for Spectrum, wave width for Ripple, decay for
// Bass Sky, and a BRIGHTNESS FLOOR for The Drop — so the number does not
// carry across, and "curated per effect" was not true for a composed tier.
type djTierParams struct {
	sx int // -1 = emit nothing; the action's own speed applies
	ix int // -1 = emit nothing; the action's own intensity applies
	// sliderID names the recipe this tier drew, "" when it took the neutral
	// or inherited the base look. Recorded per TIER because composition draws
	// independently for each replaced effect: a Comet base reports no slider
	// of its own while its Ripple and Bass Sky tiers are each varied, and a
	// single top-level id could only ever describe one of them.
	sliderID string
}

// djTierPlanParams is the per-tier resolution accompanying a plan.
//
// Inherited tiers carry -1/-1. That is a SAFE DEFAULT rather than a guard, and
// no test can kill it: djComposeSegs decides what to emit from the plan and
// skips inherited tiers before ever reading their params. It is written this
// way so that a future reader who does consult params directly gets an
// obviously-absent -1 instead of a plausible 0 — which is a real speed.
type djTierPlanParams [djNumTiers]djTierParams

// djTierRecipe is one curated arrangement across the five tiers.
type djTierRecipe struct {
	id     string
	name   string
	plan   djTierVizPlan
	weight int
}

// djTierRecipes is the catalogue. Weights are a starting point, not a
// measurement; neutral is weighted highest so uncomposed looks stay the
// common case and composition reads as an event rather than as the norm.
var djTierRecipes = []djTierRecipe{
	{id: "neutral", name: "Base", weight: 5, plan: djNeutralTierPlan},
	// One tier each, so the arrangement reads rather than competing with
	// itself: Bass Sky on the footrest only, Ripple on the one upward-facing
	// strip.
	{id: "bass_anchor", name: "Bass Anchor", weight: 3,
		plan: djTierVizPlan{djTierInherit, djTierInherit, djTierInherit, djTierInherit, 8}},
	{id: "head_shimmer", name: "Head Shimmer", weight: 3,
		plan: djTierVizPlan{7, djTierInherit, djTierInherit, djTierInherit, djTierInherit}},
	// Full arrangements. Neither contains a flash-heavy tier, so both survive
	// every comfort setting.
	{id: "rising_floor", name: "Rising Floor", weight: 2,
		plan: djTierVizPlan{7, 7, 6, 8, 8}},
	// One effect everywhere is NOT the same as neutral: it overrides the base
	// look on every tier, so a Spectrum draw plays as Tower.
	{id: "tower_stack", name: "Tower Stack", weight: 2,
		plan: djTierVizPlan{6, 6, 6, 6, 6}},
	// The only flash-heavy recipe: Minimal rejects it, Reduced halves it.
	// Weight 1 deliberately — see djRecipeComfortWeight for what the halving
	// does and does not measure.
	{id: "split_desk", name: "Split Desk", weight: 1,
		plan: djTierVizPlan{8, 8, 0, 9, 9}},
	// The two below exist because the first catalogue drew every replacement
	// from {0,6,7,8,9} — five of the ten effects, and the same five that
	// already dominated. Measured over 330 switches on 2026-08-22: composition
	// cut Spectrum's share from 35.8% to 19.4% and nearly quadrupled Tower,
	// but the top-five share barely moved (80.7% -> 85.4%), leaving Bars,
	// Comet, Fire and Wave at roughly a sixth of screen time whether
	// composition was on or off. These reach for that half.
	//
	// Neither contains a flash-heavy effect and neither uses viz 6-9, so
	// unlike every other arrangement here they survive BOTH Minimal and a desk
	// without layer-FX support — where the catalogue otherwise collapses to
	// neutral alone.
	//
	// Ember is centre-out rather than top-down: the warm core spreads to the
	// two extremes, which is a structure none of the others has.
	{id: "ember", name: "Ember", weight: 2,
		plan: djTierVizPlan{2, 4, 4, 4, 2}},
	// Tideline is one contrasting band against a uniform field — the level
	// meter reads as a seam across the core rather than as a fifth gradient.
	{id: "tideline", name: "Tideline", weight: 2,
		plan: djTierVizPlan{5, 5, 1, 5, 5}},
}

// djRecipeByID indexes the catalogue; built once, never mutated.
var djRecipeByID = func() map[string]*djTierRecipe {
	m := make(map[string]*djTierRecipe, len(djTierRecipes))
	for i := range djTierRecipes {
		r := &djTierRecipes[i]
		if _, dup := m[r.id]; dup {
			panic("dj tier recipes: duplicate id " + r.id)
		}
		m[r.id] = r
	}
	return m
}()

// djRecipeIntroducesFlash reports whether a recipe REPLACES a tier with a
// flash-heavy effect.
//
// Only replacements count. A flash-heavy base look was already weighted down
// by applyFlashComfortToPool when the pool was built, and penalising the
// recipe for inheriting it would charge the same look twice.
func djRecipeIntroducesFlash(r djTierRecipe) bool {
	for _, v := range r.plan {
		if v != djTierInherit && djFlashHeavyViz[v] {
			return true
		}
	}
	return false
}

// djRecipeUsable reports whether a recipe may be drawn at all under the
// current capabilities and comfort setting.
//
// The same consent rule the drop slam uses: a recipe may only put an effect on
// screen that the desk can render and the user's comfort setting permits.
func djRecipeUsable(r djTierRecipe, layerFxUsable bool, comfort FlashComfortMode) bool {
	for _, v := range r.plan {
		if v == djTierInherit {
			continue
		}
		if !layerFxUsable && v > 5 {
			return false
		}
		if comfort == FlashComfortMinimal && djFlashHeavyViz[v] {
			return false
		}
	}
	return true
}

// djRecipeComfortWeight is a recipe's draw weight under a comfort mode.
//
// Reduced halves ONCE for a recipe that introduces flash, regardless of how
// many tiers flash. That is deliberately imprecise and worth naming: the
// halving is strip-BLIND, while applyFlashComfortToPool's equivalent is
// effectively strip-aware because a source look covers the whole desk. Tiers
// are not equal width — tier 0 is one strip, tier 3 is three — so
// split_desk's viz 9 on tiers 3 and 4 is four strips, half the desk, at merely
// halved weight.
//
// Accepted because split_desk carries weight 1 in a catalogue that is
// explicitly a starting point, NOT because the catalogue keeps flash away from
// wide tiers. It does not. If it reads heavy on hardware the fix is to narrow
// the recipe (tier 3 back to inherit), not to add a second approximation here.
func djRecipeComfortWeight(r djTierRecipe, comfort FlashComfortMode) int {
	if comfort != FlashComfortReduced || !djRecipeIntroducesFlash(r) {
		return r.weight
	}
	if w := r.weight / 2; w >= 1 {
		return w
	}
	return 1
}

// djUsableRecipes returns the catalogue filtered and re-weighted for the
// current capabilities and comfort.
func djUsableRecipes(layerFxUsable bool, comfort FlashComfortMode) []djTierRecipe {
	out := make([]djTierRecipe, 0, len(djTierRecipes))
	for _, r := range djTierRecipes {
		if !djRecipeUsable(r, layerFxUsable, comfort) {
			continue
		}
		r.weight = djRecipeComfortWeight(r, comfort)
		out = append(out, r)
	}
	return out
}

// ═══════════════════════════════════════════════════════════════════════════
// Selection
// ═══════════════════════════════════════════════════════════════════════════

// djComposeSeedSalt keeps the recipe stream from marching in lockstep with the
// deck's or the remix's when a caller seeds them all identically.
const djComposeSeedSalt int64 = 0x434F_4D50_4F00 // "COMPO"

// djComposeSelector decorates a selector by giving each drawn look a tier
// plan. It wraps rather than replaces for the same reason the remix selector
// does: the source deck keeps owning weights, no-repeat and play counts, and
// turning composition off must leave that sequence bit-for-bit unchanged.
type djComposeSelector struct {
	inner   djSelector
	recipes []djTierRecipe
	total   int
	rng     *rand.Rand
	// sliders mirrors the remix_sliders control. When on, each REPLACED tier
	// draws from its OWN effect's curated table, so composition delivers "each
	// effective effect's own two knobs" rather than the base effect's.
	sliders bool
}

// newDJComposeSelector returns the bare deck when composition can add nothing
// — no recipe survives filtering, or only neutral does — so an off toggle and
// a degenerate deck both cost exactly nothing on the hot path.
//
// The short-circuit is not only an optimisation. Under Minimal plus a
// restrictive capability profile every non-neutral recipe can be rejected, and
// a weighted bag with nothing but zero-weight entries has no valid draw.
func newDJComposeSelector(inner djSelector, layerFxUsable bool, comfort FlashComfortMode, sliders bool, seed int64) djSelector {
	recipes := djUsableRecipes(layerFxUsable, comfort)
	total := 0
	composing := 0
	for _, r := range recipes {
		total += r.weight
		if r.plan.composes() {
			composing++
		}
	}
	if composing == 0 || total <= 0 {
		return inner
	}
	return &djComposeSelector{
		inner:   inner,
		recipes: recipes,
		total:   total,
		rng:     rand.New(rand.NewSource(seed ^ djComposeSeedSalt)),
		sliders: sliders,
	}
}

// djComposeVisibleTries bounds the redraw below. Small on purpose: this is a
// nudge away from an invisible draw, not a search. Falling through to neutral
// is a correct outcome, and looping harder to avoid it would bias the deck
// away from its configured weights for no visible gain.
const djComposeVisibleTries = 3

// djRecipeVisibleOver reports whether a recipe would put anything on the
// strips that the base look does not already have there.
//
// bass_anchor over a Bass Sky draw, or tower_stack over a Tower draw, replaces
// each tier with the effect already on it: telemetry says "composed", the
// strips look exactly as they would have uncomposed. Measured at 15 of 257
// composed draws on 2026-08-22 — about 6%, all of them bass_anchor or
// head_shimmer landing on a base that already matched.
func djRecipeVisibleOver(r djTierRecipe, baseViz int) bool {
	for _, v := range r.plan {
		if v != djTierInherit && v != baseViz {
			return true
		}
	}
	return false
}

func (c *djComposeSelector) next(cur djLookIdentity) djPick {
	pick := c.inner.next(cur)
	r := c.draw()
	// Redraw past a composition this particular base look would render
	// identically. Only c.rng is consumed, never the inner deck's, so the
	// source pool's order for a fixed seed is unchanged.
	for try := 0; try < djComposeVisibleTries &&
		r.plan.composes() && !djRecipeVisibleOver(r, pick.look.Viz); try++ {
		r = c.draw()
	}
	if r.plan.composes() && !djRecipeVisibleOver(r, pick.look.Viz) {
		return pick // neutral beats an arrangement nobody can see
	}
	// A neutral plan is left NIL rather than stored, so "composed" is one
	// question with one answer everywhere downstream.
	if r.plan.composes() {
		plan := r.plan
		params := c.resolveParams(plan)
		pick.tiers = &plan
		pick.tierParams = &params
		pick.recipeID = r.id
		pick.recipeName = r.name
	}
	return pick
}

// resolveParams gives every REPLACED tier the two knobs its own effect wants.
// Inherited tiers get -1/-1 and are left entirely alone.
func (c *djComposeSelector) resolveParams(plan djTierVizPlan) djTierPlanParams {
	var out djTierPlanParams
	for i, viz := range plan {
		if viz == djTierInherit {
			out[i] = djTierParams{sx: -1, ix: -1}
			continue
		}
		sx, ix, id := djNeutralSx, defaultIx[viz], ""
		if c.sliders {
			if recipes := djSliderRecipes[viz]; len(recipes) > 0 {
				r := recipes[c.rng.Intn(len(recipes))]
				if r.sx != nil {
					sx = *r.sx
				}
				if r.ix != nil {
					ix = *r.ix
				}
				// The resting member leaves both nil and is deliberately not
				// reported: it varied nothing.
				if r.sx != nil || r.ix != nil {
					id = r.id
				}
			}
		}
		out[i] = djTierParams{sx: sx, ix: ix, sliderID: id}
	}
	return out
}

// draw picks a recipe by weight.
func (c *djComposeSelector) draw() djTierRecipe {
	n := c.rng.Intn(c.total)
	for _, r := range c.recipes {
		n -= r.weight
		if n < 0 {
			return r
		}
	}
	return c.recipes[len(c.recipes)-1] // unreachable: weights sum to total
}

// recordPlayed / snapshot delegate. A decorator that reimplemented them would
// silently empty the settings sheet's play counts — the failure djPlayRecorder
// exists to prevent.
func (c *djComposeSelector) recordPlayed(refID string) {
	if rec, ok := c.inner.(djPlayRecorder); ok {
		rec.recordPlayed(refID)
	}
}

func (c *djComposeSelector) snapshot() map[string]int {
	if rec, ok := c.inner.(djPlayRecorder); ok {
		return rec.snapshot()
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════
// Emission
// ═══════════════════════════════════════════════════════════════════════════

// djComposeSegs merges a look's own segment overrides with a tier plan.
//
// The merge contract:
//
//	Col, Pal              the source look (sanitization already left only these)
//	FX, IX, SX            the tier plan, for REPLACED tiers only
//	On, Reverse, Mirror   never emitted: nil pointer, key absent
//
// SX is emitted for a replaced tier because sx is otherwise a single global
// value meaning different things to different effects, so a replaced tier
// would render at a speed chosen for the effect it replaced.
//
// Inherited tiers get no entry of their own, which is what makes a neutral
// plan indistinguishable from composition being off: makeSegmentPayloads
// writes the base fx and the action's intensity to every segment first, and an
// absent override leaves both alone. Emitting defaultIx[baseViz] for inherited
// tiers instead would quietly discard a preset's stored intensity.
//
// Never emitting On is the reason a stored on:false is neither honoured nor
// inverted: MusicSegmentConfig's fields are pointers with omitempty, so nil
// means the key does not reach the firmware at all.
func djComposeSegs(src []MusicSegmentConfig, plan *djTierVizPlan, params *djTierPlanParams) []MusicSegmentConfig {
	if plan == nil || !plan.composes() {
		return src
	}
	out := cloneMusicSegmentConfigs(src)
	bySeg := make(map[int]int, len(out))
	for i, s := range out {
		bySeg[s.ID] = i
	}
	for tier, viz := range plan {
		if viz == djTierInherit {
			continue
		}
		fx, ok := musicFxMap[viz]
		if !ok {
			// Unreachable: TestEveryRecipeVizHasAFirmwareEffect asserts the
			// catalogue only names mapped visualizations. Skipping beats
			// falling back to fx 28, which would put Spectrum on the tier and
			// then report the plan as if it had rendered.
			continue
		}
		ix, sx := defaultIx[viz], -1
		if params != nil {
			if p := params[tier]; p.ix >= 0 {
				ix = p.ix
			}
			sx = params[tier].sx
		}
		for _, si := range djTierSegments[tier] {
			f, x := fx, ix
			var sp *int
			if sx >= 0 {
				v := sx
				sp = &v
			}
			if i, exists := bySeg[si]; exists {
				out[i].FX, out[i].IX, out[i].SX = &f, &x, sp
				continue
			}
			out = append(out, MusicSegmentConfig{ID: si, FX: &f, IX: &x, SX: sp})
			bySeg[si] = len(out) - 1
		}
	}
	return out
}

// djResolvedPlanOf returns the five concrete visualizations an action puts on
// the desk, for telemetry and classification. Every action has one, composed
// or not.
func djResolvedPlanOf(plan *djTierVizPlan, baseViz int) djTierVizPlan {
	if plan == nil {
		return djNeutralTierPlan.resolvedAgainst(baseViz)
	}
	return plan.resolvedAgainst(baseViz)
}

// djPlanIsFlashHeavy reports whether ANY tier of a resolved plan flashes —
// the any-segment semantics the firmware itself uses for musicFxActive and
// anyDrop.
func djPlanIsFlashHeavy(resolved djTierVizPlan) bool {
	for _, v := range resolved {
		if djFlashHeavyViz[v] {
			return true
		}
	}
	return false
}

// sliderIDs flattens the per-tier slider recipe ids for telemetry.
func (p djTierPlanParams) sliderIDs() [djNumTiers]string {
	var out [djNumTiers]string
	for i, t := range p {
		out[i] = t.sliderID
	}
	return out
}

func (p djTierVizPlan) String() string {
	return fmt.Sprintf("%v", [djNumTiers]int(p))
}
