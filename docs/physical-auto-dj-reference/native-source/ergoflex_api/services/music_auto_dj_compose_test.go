package services

// Tier composition: different effects on different physical shelves at once.
//
// The load-bearing property throughout is that composition CHANGES NOTHING
// unless a recipe replaces a tier — not "changes something harmless", but
// produces the identical action. Every "neutral" assertion here is really an
// assertion that the feature is invisible when it should be.

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

func planOf(v ...int) *djTierVizPlan {
	var p djTierVizPlan
	copy(p[:], v)
	return &p
}

func segByID(segs []MusicSegmentConfig, id int) *MusicSegmentConfig {
	for i := range segs {
		if segs[i].ID == id {
			return &segs[i]
		}
	}
	return nil
}

// A preset with a non-default intensity, under a NEUTRAL plan, must emit the
// same action as with composition off.
//
// This is the guard against neutral quietly ceasing to be neutral. The
// tempting implementation fills every tier in — inherited ones with
// defaultIx[baseViz] — which looks harmless and silently discards the
// intensity the user stored on their preset.
func TestInheritedTiersKeepTheResolvedSourceIntensity(t *testing.T) {
	col := RGBWStops{{255, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}}
	src := []MusicSegmentConfig{{ID: 0, Col: &col}}

	off := djComposeSegs(src, nil, nil)
	neutral := djComposeSegs(src, &djNeutralTierPlan, nil)
	if !reflect.DeepEqual(off, neutral) {
		t.Fatalf("a neutral plan is not identical to composition off:\n off=%+v\n neu=%+v", off, neutral)
	}
	for _, s := range neutral {
		if s.IX != nil {
			t.Fatalf("segment %d carries ix %d — an inherited tier must emit NO intensity, "+
				"so the action's own (a preset's stored one) survives", s.ID, *s.IX)
		}
		if s.FX != nil {
			t.Fatalf("segment %d carries fx %d — an inherited tier must emit no effect", s.ID, *s.FX)
		}
	}

	// And a PARTIAL plan leaves the inherited tiers just as untouched: only
	// tier 4 (strip 7) may carry anything.
	partial := djComposeSegs(src, planOf(djTierInherit, djTierInherit, djTierInherit, djTierInherit, 8), nil)
	for _, s := range partial {
		if s.ID == 7 {
			continue
		}
		if s.FX != nil || s.IX != nil {
			t.Fatalf("segment %d was touched by a plan that only replaces tier 4: %+v", s.ID, s)
		}
	}
	if got := segByID(partial, 7); got == nil || got.FX == nil || *got.FX != musicFxMap[8] {
		t.Fatalf("tier 4 did not receive Bass Sky: %+v", got)
	}
}

func TestComposedSegsMergeColourAndEffectOnOneStrip(t *testing.T) {
	col := RGBWStops{{9, 8, 7, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}}
	pal := 6
	// Strip 7 is tier 4 and carries the preset's colour AND palette.
	src := []MusicSegmentConfig{{ID: 7, Col: &col, Pal: &pal}}

	out := djComposeSegs(src, planOf(djTierInherit, djTierInherit, djTierInherit, djTierInherit, 8), nil)
	got := segByID(out, 7)
	if got == nil {
		t.Fatal("strip 7 vanished from the merge")
	}
	// One entry, not two: makeSegmentPayloads keys overrides by segment id, so
	// a second entry for the same strip is silently the only one that counts.
	n := 0
	for _, s := range out {
		if s.ID == 7 {
			n++
		}
	}
	if n != 1 {
		t.Fatalf("strip 7 appears %d times — one of them would be discarded", n)
	}
	if got.Col == nil || (*got.Col)[0] != [4]int{9, 8, 7, 0} {
		t.Errorf("the preset's colour was lost: %+v", got)
	}
	if got.Pal == nil || *got.Pal != 6 {
		t.Errorf("the preset's palette was lost: %+v", got)
	}
	if got.FX == nil || *got.FX != musicFxMap[8] {
		t.Errorf("the recipe's effect was lost: %+v", got)
	}
	if got.IX == nil || *got.IX != defaultIx[8] {
		t.Errorf("a replaced tier must carry its effect's default intensity: %+v", got)
	}
}

// Every strip of a replaced tier gets IDENTICAL effect and intensity — the
// tier is one physical surface, and three strips of one shelf disagreeing is
// the thing composition must never produce.
func TestReplacedTierIsCoherentAcrossItsStrips(t *testing.T) {
	out := djComposeSegs(nil, planOf(djTierInherit, djTierInherit, djTierInherit, 6, djTierInherit), nil)
	for _, si := range djTierSegments[3] { // strips 4, 5, 6
		s := segByID(out, si)
		if s == nil || s.FX == nil || s.IX == nil {
			t.Fatalf("strip %d missing from a replaced tier: %+v", si, s)
		}
		if *s.FX != musicFxMap[6] || *s.IX != defaultIx[6] {
			t.Fatalf("strip %d disagrees with its shelf: fx=%d ix=%d", si, *s.FX, *s.IX)
		}
	}
	// …and no strip outside the tier was touched.
	for _, si := range []int{0, 1, 2, 3, 7} {
		if s := segByID(out, si); s != nil && (s.FX != nil || s.IX != nil) {
			t.Fatalf("strip %d is outside tier 3 but was composed: %+v", si, s)
		}
	}
}

// on/reverse/mirror are never emitted by composition either — the composed
// path must not reintroduce what sanitization removed.
func TestComposedSegsNeverEmitOnReverseOrMirror(t *testing.T) {
	out := djComposeSegs(nil, planOf(7, 7, 6, 8, 8), nil)
	for _, s := range out {
		if s.On != nil || s.Reverse != nil || s.Mirror != nil {
			t.Fatalf("strip %d: composition emitted a field it does not own: %+v", s.ID, s)
		}
		blob, err := json.Marshal(s)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		var keys map[string]json.RawMessage
		if err := json.Unmarshal(blob, &keys); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		for _, k := range []string{"on", "reverse", "mirror"} {
			if _, present := keys[k]; present {
				t.Fatalf("strip %d emitted %q: %s", s.ID, k, blob)
			}
		}
	}
}

func TestEveryRecipeIsWellFormed(t *testing.T) {
	seen := map[string]bool{}
	neutrals := 0
	for _, r := range djTierRecipes {
		if r.id == "" || r.name == "" {
			t.Errorf("%+v: incomplete recipe", r)
		}
		if seen[r.id] {
			t.Errorf("%s: duplicate recipe id", r.id)
		}
		seen[r.id] = true
		if r.weight < 1 {
			t.Errorf("%s: weight %d — a zero-weight recipe can never be drawn", r.id, r.weight)
		}
		if !r.plan.composes() {
			neutrals++
		}
		for tier, viz := range r.plan {
			if viz == djTierInherit {
				continue
			}
			if viz < 0 || viz > 9 {
				t.Errorf("%s tier %d: viz %d out of range", r.id, tier, viz)
			}
			// A viz with no firmware effect would fall back to fx 28 in
			// makeSegmentPayloads — Spectrum on the tier, while the reported
			// plan claims something else. A typo must fail here, not render.
			if _, ok := musicFxMap[viz]; !ok {
				t.Errorf("%s tier %d: viz %d has no musicFxMap entry", r.id, tier, viz)
			}
			if _, ok := defaultIx[viz]; !ok {
				t.Errorf("%s tier %d: viz %d has no defaultIx entry", r.id, tier, viz)
			}
		}
	}
	if neutrals != 1 {
		t.Errorf("want exactly one neutral recipe (the resting state), got %d", neutrals)
	}
}

// Comfort has to reach the RECIPE, not only the source pool. A pool filter
// runs when the pool is built; a recipe is chosen per draw and does not exist
// yet at that point.
func TestComfortReachesRecipes(t *testing.T) {
	split := *djRecipeByID["split_desk"]
	rising := *djRecipeByID["rising_floor"]

	if !djRecipeIntroducesFlash(split) {
		t.Fatal("split_desk puts The Drop on two tiers — it introduces flash")
	}
	if djRecipeIntroducesFlash(rising) {
		t.Fatal("rising_floor has no flash-heavy tier")
	}

	if djRecipeUsable(split, true, FlashComfortMinimal) {
		t.Error("Minimal must reject a recipe with a flash-heavy tier")
	}
	if !djRecipeUsable(rising, true, FlashComfortMinimal) {
		t.Error("Minimal must keep a recipe with no flash-heavy tier")
	}
	if djRecipeUsable(rising, false, FlashComfortOff) {
		t.Error("a recipe naming viz 6-9 must be rejected when layer FX are unusable")
	}

	// Reduced halves ONCE, and only for what the recipe REPLACES — an
	// inherited flash-heavy base was already weighted down when the pool was
	// built, and charging it again would penalise the same look twice.
	if got := djRecipeComfortWeight(rising, FlashComfortReduced); got != rising.weight {
		t.Errorf("a non-flash recipe was re-weighted: %d → %d", rising.weight, got)
	}
	heavy := djTierRecipe{id: "x", plan: djTierVizPlan{9, 9, 9, 9, 9}, weight: 4}
	if got := djRecipeComfortWeight(heavy, FlashComfortReduced); got != 2 {
		t.Errorf("Reduced halved 4 to %d, want 2 (once, not per flashing tier)", got)
	}
	if got := djRecipeComfortWeight(split, FlashComfortReduced); got != 1 {
		t.Errorf("weight 1 must floor at 1 under Reduced, got %d", got)
	}
	if got := djRecipeComfortWeight(heavy, FlashComfortOff); got != 4 {
		t.Errorf("Standard must not re-weight: got %d", got)
	}
}

// Minimal on a desk without layer FX used to leave NOTHING drawable — every
// arrangement in the catalogue named a viz 6-9 effect or a flash-heavy one, so
// composition collapsed to neutral exactly where the show was already most
// constrained. Ember and Tideline are built from viz 1/2/4/5 precisely so that
// stops being true, and this asserts the new floor rather than the old one.
func TestMinimalWithoutLayerFxStillComposes(t *testing.T) {
	inner := newDJDeck([]djWeightedLook{{pick: djPick{look: DJLook{Viz: 0}, refID: "builtin:0"}, weight: 1}}, 1)
	sel := newDJComposeSelector(inner, false, FlashComfortMinimal, false, 7)
	if sel == djSelector(inner) {
		t.Fatal("composition short-circuited under Minimal without layer FX — the " +
			"low-viz arrangements exist so that case still gets an arrangement")
	}
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		if p := sel.next(djLookIdentity{}); p.recipeID != "" {
			seen[p.recipeID] = true
		}
	}
	for _, want := range []string{"ember", "tideline"} {
		if !seen[want] {
			t.Errorf("%q never drawn under Minimal without layer FX; drawn: %v", want, seen)
		}
	}
	for id := range seen {
		r, ok := djRecipeByID[id]
		if !ok {
			t.Fatalf("unknown recipe %q", id)
		}
		if !djRecipeUsable(*r, false, FlashComfortMinimal) {
			t.Errorf("drew %q, which is not usable under Minimal without layer FX", id)
		}
	}
}

// The zero-weight bag is still a hazard even though comfort and capability can
// no longer produce one: building a weighted deck with nothing in it is how
// rng.Intn(0) panics. Comfort filtering stopped being able to reach this path
// when Ember and Tideline landed, which is exactly why the guard needs its own
// test rather than inheriting one from a scenario that no longer occurs.
func TestEmptyRecipeCatalogueShortCircuitsRatherThanPanicking(t *testing.T) {
	saved := djTierRecipes
	djTierRecipes = []djTierRecipe{{id: "neutral", name: "Base", weight: 5, plan: djNeutralTierPlan}}
	defer func() { djTierRecipes = saved }()

	inner := newDJDeck([]djWeightedLook{{pick: djPick{look: DJLook{Viz: 0}, refID: "builtin:0"}, weight: 1}}, 1)
	sel := newDJComposeSelector(inner, true, FlashComfortOff, false, 7)
	if sel != djSelector(inner) {
		t.Fatalf("want the bare deck back when nothing can compose, got %T", sel)
	}
	if got := sel.next(djLookIdentity{}); got.tiers != nil {
		t.Fatalf("a short-circuited selector produced a plan: %v", got.tiers)
	}
}

func TestComposeSelectorDrawsRecipesWithoutPerturbingTheDeck(t *testing.T) {
	pool := []djWeightedLook{
		{pick: djPick{look: DJLook{Viz: 0}, refID: "builtin:0", baseRefID: "builtin:0"}, weight: 2},
		{pick: djPick{look: DJLook{Viz: 5}, refID: "builtin:5", baseRefID: "builtin:5"}, weight: 2},
		{pick: djPick{look: DJLook{Viz: 2}, refID: "builtin:2", baseRefID: "builtin:2"}, weight: 1},
	}

	// The SOURCE sequence must be identical with and without composition: the
	// decorator adds a plan, it does not touch weights or no-repeat.
	bare := newDJDeck(pool, 99)
	var want []string
	cur := djLookIdentity{}
	for i := 0; i < 60; i++ {
		p := bare.next(cur)
		want = append(want, p.refID)
		cur = djLookIdentity{viz: p.look.Viz, refID: p.refID, baseRefID: p.baseRefID}
	}

	composed := newDJComposeSelector(newDJDeck(pool, 99), true, FlashComfortOff, false, 99)
	var got []string
	composedCount, recipes := 0, map[string]int{}
	cur = djLookIdentity{}
	for i := 0; i < 60; i++ {
		p := composed.next(cur)
		got = append(got, p.refID)
		if p.tiers != nil {
			composedCount++
			recipes[p.recipeID]++
			if p.recipeName == "" {
				t.Fatalf("draw %d composed with no recipe name", i)
			}
			if !p.tiers.composes() {
				t.Fatalf("draw %d stored a neutral plan — nil is the uncomposed form", i)
			}
		} else if p.recipeID != "" {
			t.Fatalf("draw %d carries recipe %q with no plan", i, p.recipeID)
		}
		cur = djLookIdentity{viz: p.look.Viz, refID: p.refID, baseRefID: p.baseRefID}
	}
	if !reflect.DeepEqual(want, got) {
		t.Fatalf("composition perturbed the source deck order:\n want=%v\n got =%v", want, got)
	}
	if composedCount == 0 {
		t.Fatal("composition never fired in 60 draws")
	}
	if composedCount == 60 {
		t.Fatal("composition fired on every draw — neutral is weighted highest and must show up")
	}
	if len(recipes) < 2 {
		t.Fatalf("only %d distinct recipe(s) drawn in 60: %v", len(recipes), recipes)
	}
	if _, neutral := recipes["neutral"]; neutral {
		t.Fatal("the neutral recipe must not be recorded as a composition")
	}
}

func TestResolvedPlanAlwaysNamesFiveConcreteVisualizations(t *testing.T) {
	// Uncomposed: the base look on every tier, so a consumer never needs to
	// special-case an absent plan.
	if got := djResolvedPlanOf(nil, 5); got != (djTierVizPlan{5, 5, 5, 5, 5}) {
		t.Fatalf("uncomposed resolved to %v", got)
	}
	got := djResolvedPlanOf(planOf(djTierInherit, djTierInherit, djTierInherit, djTierInherit, 8), 0)
	if got != (djTierVizPlan{0, 0, 0, 0, 8}) {
		t.Fatalf("resolved to %v", got)
	}
	for tier, v := range got {
		if v == djTierInherit {
			t.Fatalf("tier %d is still djTierInherit after resolution", tier)
		}
	}

	// Classification follows the RESOLVED plan with any-segment semantics: one
	// flash-heavy tier makes the look flash-heavy, even on a smooth base.
	if !djPlanIsFlashHeavy(djResolvedPlanOf(planOf(djTierInherit, djTierInherit, djTierInherit, 9, djTierInherit), 5)) {
		t.Error("a smooth base with The Drop on one tier must classify as flash-heavy")
	}
	if djPlanIsFlashHeavy(djResolvedPlanOf(planOf(7, 7, 6, 8, 8), 5)) {
		t.Error("a plan with no flash-heavy tier must not classify as flash-heavy")
	}
	// A flash-heavy BASE still classifies through inherited tiers.
	if !djPlanIsFlashHeavy(djResolvedPlanOf(nil, 3)) {
		t.Error("an uncomposed Strobe must still classify as flash-heavy")
	}
}

// Composition is CLEARED by the same machinery a preset's colours are, and
// the clearing works for a reason worth pinning down.
//
// It is NOT firmware _segPrevFx persistence — makeSegmentPayloads rebuilds all
// eight segments on every transmission with the global visualization's fx as
// the floor, so an omitted override cannot strand an effect on a strip. What
// DOES persist is API-side: applyConfigPartial keeps the supplied slice in
// m.segmentConfigs and reuses it whenever a later update supplies none. So a
// composed look rides along until an action explicitly replaces the slice,
// which is exactly what restoreSegs does.
func TestComposedLookIsClearedByTheBaselineRestore(t *testing.T) {
	composed := djComposeSegs(nil, planOf(djTierInherit, djTierInherit, djTierInherit, 9, djTierInherit), nil)

	// While composed: tier 3's strips carry The Drop, everything else the base.
	segs := makeSegmentPayloads(0 /* Spectrum */, 0, 128, 0, false, false, composed, nil)
	if len(segs) != 8 {
		t.Fatalf("want 8 segments on every transmission, got %d", len(segs))
	}
	for _, si := range djTierSegments[3] {
		if segs[si]["fx"] != musicFxMap[9] {
			t.Fatalf("strip %d should be composed to The Drop, got fx %v", si, segs[si]["fx"])
		}
	}
	if segs[0]["fx"] != musicFxMap[0] {
		t.Fatalf("an inherited strip must carry the base effect, got fx %v", segs[0]["fx"])
	}

	// The restore: a baseline canvas that says nothing about effects at all.
	baseline := baselineSegCanvas(djBaseline{}, false)
	restored := makeSegmentPayloads(0, 0, 128, 0, false, false, baseline, nil)
	for si := 0; si < 8; si++ {
		if restored[si]["fx"] != musicFxMap[0] {
			t.Fatalf("strip %d kept a composed effect through the restore: fx %v",
				si, restored[si]["fx"])
		}
	}

	// The same is true when the user HAS their own baseline overrides that
	// mention only some strips — the ones they never touched still reset,
	// because every segment is rebuilt from the global viz.
	col := RGBWStops{{1, 2, 3, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}}
	partial := baselineSegCanvas(djBaseline{segs: []MusicSegmentConfig{{ID: 1, Col: &col}}}, false)
	restored = makeSegmentPayloads(0, 0, 128, 0, false, false, partial, nil)
	for si := 0; si < 8; si++ {
		if restored[si]["fx"] != musicFxMap[0] {
			t.Fatalf("strip %d kept a composed effect through a partial baseline: fx %v",
				si, restored[si]["fx"])
		}
	}
}

// rotate() must mark generated overrides live for a COMPOSED look exactly as
// it does for a coloured one, or the next uncomposed look never asks for the
// restore above and the composition stays on the desk.
func TestRotateArmsTheRestoreAfterAComposedLook(t *testing.T) {
	plan := djTierVizPlan{djTierInherit, djTierInherit, djTierInherit, djTierInherit, 8}
	composed := djPick{look: DJLook{Viz: 0}, pal: vizp(0), speed: vizp(200),
		kind: DJLookKindBuiltin, label: "Spectrum", refID: "builtin:0", tiers: &plan,
		recipeID: "bass_anchor", recipeName: "Bass Anchor"}
	plain := djPick{look: DJLook{Viz: 5}, pal: vizp(7), speed: vizp(128),
		kind: DJLookKindBuiltin, label: "Wave", refID: "builtin:5"}

	prog := AutoDJProgram{
		Key:                    "custom",
		Selector:               newDJDeck([]djWeightedLook{{pick: composed, weight: 1}, {pick: plain, weight: 1}}, 1),
		WritesSegmentOverrides: true,
		DropViz:                -1,
		QuietViz:               -1,
	}
	st := newAutoDJState(time.Now())

	a := st.rotate(&prog, onViz(5), "phrase") // no-repeat forces the composed pick
	if a == nil {
		t.Fatal("no action")
	}
	if a.tiers == nil || a.recipeID != "bass_anchor" {
		t.Fatalf("the plan did not reach the action: %+v", a)
	}
	if len(a.segs) == 0 {
		t.Fatal("a composed action carried no segment overrides")
	}
	if a.restoreSegs {
		t.Fatal("a composed action must paint, not restore")
	}
	if !st.segOverridesLive {
		t.Fatal("a composed look did not arm the restore — it would stay on the desk")
	}

	b := st.rotate(&prog, onViz(0), "phrase") // the uncomposed pick
	if b == nil {
		t.Fatal("no second action")
	}
	if b.tiers != nil {
		t.Fatalf("the second look is composed: %v", b.tiers)
	}
	if !b.restoreSegs {
		t.Fatal("the uncomposed look must restore the baseline canvas")
	}
	if st.segOverridesLive {
		t.Fatal("the restore did not consume the live flag")
	}
}

// The settings-sheet bootstrap and the live WS frame must describe a look the
// same way, or the sheet shows one thing until the next switch and another
// after it.
func TestBootstrapAndLiveTelemetryAgreeOnThePlan(t *testing.T) {
	plan := djTierVizPlan{7, djTierInherit, djTierInherit, djTierInherit, djTierInherit}
	act := &djAction{
		viz: 0, reason: "phrase", label: "Spectrum", refID: "builtin:0", baseRefID: "builtin:0",
		lookKind: DJLookKindBuiltin, tiers: &plan, recipeID: "head_shimmer",
		recipeName: "Head Shimmer", planVerified: true,
		sliderID: "spectrum_up", burstRecipeID: "burst_dense",
		randomizeRecipeID: "randomize_half", physicsRecipeID: "physics_snappy",
	}
	wantPlan := [djNumTiers]int{7, 0, 0, 0, 0}

	// Bootstrap shape.
	np := DJNowPlaying{
		Viz: act.viz, RefID: act.refID, BaseRefID: act.baseRefID, Label: act.label,
		LookKind: act.lookKind, Reason: act.reason,
		TierPlan:          [djNumTiers]int(djResolvedPlanOf(act.tiers, act.viz)),
		RecipeID:          act.recipeID,
		RecipeName:        act.recipeName,
		SliderID:          act.sliderID,
		BurstRecipeID:     act.burstRecipeID,
		RandomizeRecipeID: act.randomizeRecipeID,
		PhysicsRecipeID:   act.physicsRecipeID,
		PlanVerified:      act.planVerified,
	}
	if np.TierPlan != wantPlan {
		t.Fatalf("bootstrap plan %v, want %v", np.TierPlan, wantPlan)
	}

	// Live frame shape — the same fields under the same json names.
	bootstrap, err := json.Marshal(np)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var boot map[string]json.RawMessage
	if err := json.Unmarshal(bootstrap, &boot); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	live := map[string]interface{}{
		"tier_plan":           [djNumTiers]int(djResolvedPlanOf(act.tiers, act.viz)),
		"recipe_id":           act.recipeID,
		"recipe_name":         act.recipeName,
		"slider_id":           act.sliderID,
		"burst_recipe_id":     act.burstRecipeID,
		"randomize_recipe_id": act.randomizeRecipeID,
		"physics_recipe_id":   act.physicsRecipeID,
		"plan_verified":       act.planVerified,
	}
	liveBlob, err := json.Marshal(live)
	if err != nil {
		t.Fatalf("marshal live: %v", err)
	}
	var wire map[string]json.RawMessage
	if err := json.Unmarshal(liveBlob, &wire); err != nil {
		t.Fatalf("unmarshal live: %v", err)
	}
	for _, k := range []string{
		"tier_plan", "recipe_id", "recipe_name", "slider_id",
		"burst_recipe_id", "randomize_recipe_id", "physics_recipe_id", "plan_verified",
	} {
		b, okB := boot[k]
		w, okW := wire[k]
		if !okB {
			t.Errorf("the sheet bootstrap omits %q", k)
			continue
		}
		if !okW {
			t.Errorf("the live frame omits %q", k)
			continue
		}
		if string(b) != string(w) {
			t.Errorf("%q disagrees: bootstrap %s, live %s", k, b, w)
		}
	}
}

// Color Story's "is this look smooth?" question has to be asked of the APPLIED
// ACTION, not of its base visualization.
//
// Once a recipe can put The Drop on two tiers of an otherwise smooth look, a
// djFlashHeavyViz[act.viz] test says "smooth" about a desk that is slamming —
// and Color Story then advances a mood on top of it. The pure-function test
// above cannot catch that: it proves djPlanIsFlashHeavy computes the right
// answer, and says nothing about which value gets passed to it.
func TestColorStorySkipsALookMadeFlashHeavyByItsRecipe(t *testing.T) {
	store := &fakeDJStore{}
	svc, cleanup := newDJTestService(t, store)
	defer cleanup()

	settings := DJSettings{
		Version:      DJSettingsVersion,
		Looks:        []DJLookRef{{Kind: DJLookKindBuiltin, Viz: vizp(5), Weight: 2}},
		SwitchBars:   8,
		DynamicsMode: DJDynamicsStory,
	}
	if _, err := svc.SaveDJSettings(1, settings); err != nil {
		t.Fatalf("save: %v", err)
	}
	svc.mu.Lock()
	svc.fwColorDynamicsSupported = true
	svc.mu.Unlock()
	if err := svc.SetAutoDJ(1, true, "custom"); err != nil {
		t.Fatalf("enable: %v", err)
	}
	gen := djGenOf(svc)

	// CONTROL first: a smooth look with no recipe DOES advance a mood, so a
	// mutant that simply never advances cannot pass this test.
	idx := 0
	smooth := &djAction{viz: 5, reason: "phrase", label: "Wave"}
	svc.maybeAdvanceColorStory(1, gen, smooth, &idx)
	if svc.djTuningOverlaySnapshot() == nil {
		t.Fatal("a smooth uncomposed look must advance Color Story")
	}
	if idx != 1 {
		t.Fatalf("mood index is %d, want 1", idx)
	}

	// Now the case: same smooth base, but the recipe puts The Drop on tier 3.
	// Nothing new may be written, and the mood cursor may not advance.
	before := svc.djTuningOverlaySnapshot()
	beforeIdx := idx
	plan := djTierVizPlan{djTierInherit, djTierInherit, djTierInherit, 9, djTierInherit}
	composed := &djAction{viz: 5, reason: "phrase", label: "Wave", tiers: &plan, recipeID: "x"}
	svc.maybeAdvanceColorStory(1, gen, composed, &idx)
	if idx != beforeIdx {
		t.Fatalf("Color Story advanced on a look whose recipe flashes: %d → %d", beforeIdx, idx)
	}
	if got := svc.djTuningOverlaySnapshot(); !reflect.DeepEqual(got, before) {
		t.Fatalf("Color Story wrote on a flash-heavy composed look:\n before=%v\n after =%v", before, got)
	}
}

// A replaced tier must render at a speed chosen for ITS OWN effect, never the
// one the base look was tuned with.
//
// sx is a single global value that firmware writes to every segment, and it is
// not the same quantity in each effect: contrast for Spectrum and Tower, wave
// width for Ripple, decay for Bass Sky, and a BRIGHTNESS FLOOR for The Drop.
// Observed on hardware before this fix — split_desk running with sx 193 chosen
// for Bass Sky gave its Drop tiers a floor of 24 where the Drop table intends
// 5-17.
func TestReplacedTiersDoNotInheritTheBaseEffectsSpeed(t *testing.T) {
	// Slider variation OFF: every replaced tier still gets the neutral speed
	// rather than whatever the look was carrying.
	sel := newDJComposeSelector(
		newDJDeck([]djWeightedLook{{pick: djPick{
			look: DJLook{Viz: 8}, refID: "builtin:8", speed: vizp(193)}, weight: 1}}, 3),
		true, FlashComfortOff, false, 3)

	sawComposed := false
	for i := 0; i < 40; i++ {
		p := sel.next(djLookIdentity{})
		if p.tiers == nil {
			continue
		}
		sawComposed = true
		if p.tierParams == nil {
			t.Fatalf("draw %d composed without resolving its tiers' parameters", i)
		}
		segs := djComposeSegs(p.segs, p.tiers, p.tierParams)
		for tier, viz := range p.tiers {
			for _, si := range djTierSegments[tier] {
				seg := segByID(segs, si)
				if viz == djTierInherit {
					if seg != nil && seg.SX != nil {
						t.Fatalf("inherited tier %d emitted a speed: %+v", tier, seg)
					}
					continue
				}
				if seg == nil || seg.SX == nil {
					t.Fatalf("replaced tier %d strip %d emitted no speed, so it would "+
						"render at the base look's: %+v", tier, si, seg)
				}
				if *seg.SX == 193 {
					t.Fatalf("replaced tier %d inherited the base look's speed 193", tier)
				}
				if *seg.SX != djNeutralSx {
					t.Fatalf("with sliders off a replaced tier wants the neutral speed, got %d", *seg.SX)
				}
			}
		}
	}
	if !sawComposed {
		t.Fatal("no composed draw in 40")
	}
}

// With slider variation ON, each replaced tier draws from ITS OWN effect's
// curated table — the "each effective effect's own two knobs" the base-effect
// slider could never deliver.
func TestReplacedTiersDrawTheirOwnEffectsSliders(t *testing.T) {
	sel := newDJComposeSelector(
		newDJDeck([]djWeightedLook{{pick: djPick{
			look: DJLook{Viz: 0}, refID: "builtin:0", speed: vizp(128)}, weight: 1}}, 11),
		true, FlashComfortOff, true, 11)

	varied := map[int]map[int]bool{} // viz -> distinct sx seen
	for i := 0; i < 300; i++ {
		p := sel.next(djLookIdentity{})
		if p.tiers == nil {
			continue
		}
		for tier, viz := range p.tiers {
			if viz == djTierInherit {
				continue
			}
			got := p.tierParams[tier]
			if varied[viz] == nil {
				varied[viz] = map[int]bool{}
			}
			varied[viz][got.sx] = true

			// Whatever is drawn must be a value that effect's own table names
			// (or the neutral, for its resting member).
			ok := got.sx == djNeutralSx
			for _, r := range djSliderRecipes[viz] {
				if r.sx != nil && *r.sx == got.sx {
					ok = true
				}
			}
			if !ok {
				t.Fatalf("tier %d (viz %d) drew sx %d, which is not in its own table",
					tier, viz, got.sx)
			}
		}
	}
	// At least one tabled effect must actually have varied, or the feature is
	// inert and every assertion above is trivially satisfied.
	spread := 0
	for viz, vals := range varied {
		if len(djSliderRecipes[viz]) > 0 && len(vals) > 1 {
			spread++
		}
	}
	if spread == 0 {
		t.Fatalf("no replaced tier varied its own speed across 300 draws: %v", varied)
	}
}
