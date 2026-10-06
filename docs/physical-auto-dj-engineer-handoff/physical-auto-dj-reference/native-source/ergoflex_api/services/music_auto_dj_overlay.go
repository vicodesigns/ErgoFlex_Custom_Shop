// services/music_auto_dj_overlay.go
// The DJ tuning overlay — canonical vs. effective.
//
// desiredConfig (and its session mirror activeConfig) stay CANONICAL: the
// user's own tuning, the only thing ever persisted or resumed. Everything the
// DJ temporarily plays lives in ONE overlay map applied at compose time:
//
//	effective = activeConfig ⊕ djTuningOverlay
//
// Ownership rules:
//   - a field is DJ-owned iff its key is in the overlay map;
//   - a user write to a DJ-eligible field (tuning PATCH, reset, favorite or
//     preset apply — everything funnels through UpdateFirmwareConfig /
//     ResetFirmwareConfig) releases that key BEFORE transmission and
//     user-locks it for the rest of the DJ session (djTuningUserLocked), so
//     a concurrent phrase change can never reclaim it;
//   - stop/teardown drops the whole overlay — "restore" is free because
//     canonical was never dirtied;
//   - a canceled conductor generation can never write (gen check).

package services

import (
	"fmt"
	"log"
	"math"
)

// ---------------------------------------------------------------------------
// Value type
// ---------------------------------------------------------------------------

// djOverlayKind is the wire type of one DJ-ownable firmware field.
type djOverlayKind uint8

const (
	djOverlayU8 djOverlayKind = iota
	djOverlayF32
	djOverlayDelays // [8]uint8, one per strip
)

func (k djOverlayKind) String() string {
	switch k {
	case djOverlayF32:
		return "float32"
	case djOverlayDelays:
		return "[8]uint8"
	default:
		return "uint8"
	}
}

// djOverlayValue is one DJ-owned field's value.
//
// The overlay was map[string]uint8, which is why "just add the key to the
// eligible list" could never have widened it: FirmwareMusicConfig's tunable
// fields are uint8, float32 AND [8]uint8, so three of the fields the DJ most
// wants (spectrumGamma, attackAlpha, decayAlpha) cannot be represented at all
// and a fourth (pulseRippleDelays) is per-strip. kind says which arm is live;
// the zero value is a valid uint8 0.
type djOverlayValue struct {
	kind   djOverlayKind
	u8     uint8
	f32    float32
	delays [8]uint8
}

func djU8(v uint8) djOverlayValue    { return djOverlayValue{kind: djOverlayU8, u8: v} }
func djF32(v float32) djOverlayValue { return djOverlayValue{kind: djOverlayF32, f32: v} }
func djDelays(v [8]uint8) djOverlayValue {
	return djOverlayValue{kind: djOverlayDelays, delays: v}
}

// equal reports whether two values are the same field value. Used to skip
// no-op overlay writes, so it compares the LIVE arm only — comparing whole
// structs would work today but would silently start reporting "changed" the
// moment a new arm is added.
func (a djOverlayValue) equal(b djOverlayValue) bool {
	if a.kind != b.kind {
		return false
	}
	switch a.kind {
	case djOverlayF32:
		return a.f32 == b.f32
	case djOverlayDelays:
		return a.delays == b.delays
	default:
		return a.u8 == b.u8
	}
}

func (a djOverlayValue) String() string {
	switch a.kind {
	case djOverlayF32:
		return fmt.Sprintf("%g", a.f32)
	case djOverlayDelays:
		return fmt.Sprintf("%v", a.delays)
	default:
		return fmt.Sprintf("%d", a.u8)
	}
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

// Every admitted field belongs to exactly one family, and every family is
// owned by exactly one control in the DJ settings sheet. That is what lets a
// control be disabled mid-show and release precisely its own fields.
//
// The burst keys are split across THREE families rather than sitting in one,
// because three different controls already own pieces of them and a shared
// family would mean two producers of the same key — the failure dynamics_mode
// exists to avoid:
//
//	burstEnable    bursts_on      the user's own toggle, via reconcileDJOverlay
//	randomizeFlip  randomize_on   likewise, and comfort treats it differently:
//	                              Reduced kills bursts but KEEPS randomize,
//	                              because flipping geometry is not brightness
//	burst shaping  remix_bursts   rate/spectrum/zone — the parameters, which
//	                              do nothing while their enable is off, so the
//	                              DJ shapes what the user switched on rather
//	                              than switching it on
//	randomize rate remix_bursts   randomizeRate, SEPARATELY
//
// The last two share an owning control but are separate families, because they
// follow different enables and comfort treats those enables differently:
// Reduced clears bursts_on and KEEPS randomize_on. Folding randomizeRate in
// with the burst parameters gated it on bursts_on, so Reduced silently took
// away the randomize-cadence variation it was meant to keep.
const (
	djFamilyDynamics       = "dynamics"
	djFamilyBurstEnable    = "burst_enable"
	djFamilyRandomize      = "randomize"
	djFamilyBurstShape     = "burst_shape"
	djFamilyRandomizeShape = "randomize_shape"
	djFamilyPhysics        = "physics"
)

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// djOverlayField describes one firmware field the DJ may own.
type djOverlayField struct {
	key    string
	family string
	kind   djOverlayKind
	// apply writes the value into a config copy.
	apply func(*FirmwareMusicConfig, djOverlayValue)
	// inPatch reports whether a USER patch supplies this field. It must
	// recognise an EXPLICITLY SUPPLIED ZERO — every scalar in
	// FirmwareMusicConfigPatch is a pointer precisely so that "set it to 0"
	// and "don't touch it" are different requests, and a != 0 test would
	// silently let the DJ keep a field the user just zeroed.
	inPatch func(FirmwareMusicConfigPatch) bool
	// setPatch writes this value into a patch, so registry validation can run
	// the value through FirmwareMusicConfigPatch.validate — the SAME bounds a
	// user write must satisfy. Without it the registry had only a finiteness
	// check, and a recipe could author a value the API would reject from a
	// human: spectrumGamma 2.4 shipped that way, stored as 2.4 while the
	// firmware clamped it to 2.0, so server state and hardware disagreed.
	setPatch func(*FirmwareMusicConfigPatch, djOverlayValue)
	// validate adds DJ-ONLY rules on top of the shared bounds (currently the
	// tier-shape constraint). nil means the shared rules are sufficient.
	validate func(djOverlayValue) error
}

// djOverlayRegistry is the SINGLE source of truth for DJ-ownable fields:
// eligibility, value type, apply, patch detection and family all come from
// here, so the eligible list, the apply path and the release path cannot drift
// apart the way three hand-maintained switch statements did.
//
// DELIBERATELY ABSENT, each for its own reason — TestRefusedKeysAreNotEligible
// asserts they stay absent:
//
//   - comfortMode   — the photosensitivity guard (350ms full-field flash floor
//     across the strobe, burst and drop paths) and the one key that defaults
//     ON. Never DJ-owned, at any comfort setting.
//   - noiseFloor    — detection plumbing, not aesthetics. Modulating it changes
//     what COUNTS as a beat, corrupting the analyzer's own output rather than
//     restyling its result.
//   - stalenessMs   — same: it decides when audio is considered gone.
//   - pulseMinFlash — sets the MINIMUM beat-flash brightness, so it touches the
//     same photosensitivity surface comfortMode guards. Pending a safety
//     review; absent until then rather than absent by oversight.
//
// Registering a field declares it DJ-ELIGIBLE. It does not mean a DJ producer
// writes it: the release-on-user-write path is live for every row here, while
// the variation families that actually author physics and burst values arrive
// with their own toggles.
var djOverlayRegistry = []djOverlayField{
	// -- Color Dynamics -----------------------------------------------------
	{key: "colorMotionSpeed", family: djFamilyDynamics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.ColorMotionSpeed = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.ColorMotionSpeed != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.ColorMotionSpeed = &v.u8 }},
	{key: "colorSpread", family: djFamilyDynamics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.ColorSpread = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.ColorSpread != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.ColorSpread = &v.u8 }},
	{key: "energyToMotion", family: djFamilyDynamics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.EnergyToMotion = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.EnergyToMotion != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.EnergyToMotion = &v.u8 }},
	{key: "beatHueStep", family: djFamilyDynamics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BeatHueStep = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BeatHueStep != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BeatHueStep = &v.u8 }},
	{key: "peakBandToHue", family: djFamilyDynamics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.PeakBandToHue = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.PeakBandToHue != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.PeakBandToHue = &v.u8 }},

	// -- Color Bursts + beat-randomized flip (three owners, see above) ------
	{key: "burstEnable", family: djFamilyBurstEnable, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstEnable = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstEnable != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstEnable = &v.u8 }},
	{key: "burstRate", family: djFamilyBurstShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstRate = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstRate != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstRate = &v.u8 }},
	{key: "burstSpectrum", family: djFamilyBurstShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstSpectrum = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstSpectrum != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstSpectrum = &v.u8 }},
	{key: "burstZone", family: djFamilyBurstShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstZone = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstZone != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstZone = &v.u8 }},
	{key: "burstDepth", family: djFamilyBurstShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstDepth = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstDepth != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstDepth = &v.u8 }},
	{key: "burstTail", family: djFamilyBurstShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstTail = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstTail != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstTail = &v.u8 }},
	{key: "burstSection", family: djFamilyBurstShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstSection = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstSection != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstSection = &v.u8 }},
	{key: "burstDropAware", family: djFamilyBurstShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.BurstDropAware = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.BurstDropAware != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.BurstDropAware = &v.u8 }},
	{key: "randomizeFlip", family: djFamilyRandomize, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.RandomizeFlip = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.RandomizeFlip != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.RandomizeFlip = &v.u8 }},
	{key: "randomizeRate", family: djFamilyRandomizeShape, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.RandomizeRate = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.RandomizeRate != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.RandomizeRate = &v.u8 }},

	// -- Global Physics -----------------------------------------------------
	{key: "spectrumGamma", family: djFamilyPhysics, kind: djOverlayF32,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.SpectrumGamma = v.f32 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.SpectrumGamma != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.SpectrumGamma = &v.f32 }},
	{key: "attackAlpha", family: djFamilyPhysics, kind: djOverlayF32,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.AttackAlpha = v.f32 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.AttackAlpha != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.AttackAlpha = &v.f32 }},
	{key: "decayAlpha", family: djFamilyPhysics, kind: djOverlayF32,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.DecayAlpha = v.f32 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.DecayAlpha != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.DecayAlpha = &v.f32 }},
	{key: "spectrumBeatBoost", family: djFamilyPhysics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.SpectrumBeatBoost = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.SpectrumBeatBoost != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.SpectrumBeatBoost = &v.u8 }},
	{key: "pulseAmbientDiv", family: djFamilyPhysics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.PulseAmbientDiv = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.PulseAmbientDiv != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.PulseAmbientDiv = &v.u8 }},
	{key: "pulseColorShiftDiv", family: djFamilyPhysics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.PulseColorShiftDiv = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.PulseColorShiftDiv != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.PulseColorShiftDiv = &v.u8 }},
	{key: "driftBeatSync", family: djFamilyPhysics, kind: djOverlayU8,
		apply:    func(c *FirmwareMusicConfig, v djOverlayValue) { c.DriftBeatSync = v.u8 },
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return p.DriftBeatSync != nil },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.DriftBeatSync = &v.u8 }},
	{key: "pulseRippleDelays", family: djFamilyPhysics, kind: djOverlayDelays,
		apply: func(c *FirmwareMusicConfig, v djOverlayValue) { c.PulseRippleDelays = v.delays },
		// A patch supplies this as a positional slice, so an explicitly
		// supplied EMPTY array is indistinguishable from an absent key and
		// reads as absent. It is the one field where the pointer trick does
		// not apply, and it is harmless: an empty array asks for no change,
		// which is exactly what absent already means.
		inPatch:  func(p FirmwareMusicConfigPatch) bool { return len(p.PulseRippleDelays) > 0 },
		setPatch: func(p *FirmwareMusicConfigPatch, v djOverlayValue) { p.PulseRippleDelays = v.delays[:] },
		validate: djValidateTierShapedDelays},
}

func djValidateFinite(v djOverlayValue) error {
	f := float64(v.f32)
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return fmt.Errorf("value must be finite, got %v", v.f32)
	}
	return nil
}

// djValidateTierShapedDelays rejects a DJ-authored per-strip ripple delay
// array that varies WITHIN a tier.
//
// fxMusicPulse reads cfg.pulseRippleDelays[si] indexed by SEGMENT, so the
// array is genuinely per-strip. And it travels on the GLOBAL overlay rather
// than through segment overrides, which is what makes it dangerous: a
// "strips sharing a tier carry identical FX/IX" assertion passes vacuously
// while this value pulls the same shelf apart underneath it.
//
// NOTE, because the obvious argument for this rule is wrong: the FACTORY
// DEFAULT is not tier-shaped either. Firmware MusicConfig.hpp ships
// {4,2,2,0,0,0,2,4}, whose tier 3 (strips 4,5,6) is {0,0,2}. So "a shelf must
// never flash out of step with itself" cannot be the reason — the desk does
// that out of the box and it looks fine.
//
// The actual reason is that the default is a WHOLE-DESK cascade: one effect
// across all eight strips, with the flash arriving later at the ends than the
// middle, which reads as a wave. Tier composition removes that premise. Once
// tier 3 runs a different effect from tier 2, a cascade computed for a unified
// field is no longer a wave across anything — it is per-strip jitter inside a
// surface that is supposed to read as one. So the constraint is on what the DJ
// AUTHORS, and it is deliberately stricter than the canonical value it
// temporarily replaces. Restoring the default needs no exemption: the overlay
// is dropped, never overwritten with canonical.
func djValidateTierShapedDelays(v djOverlayValue) error {
	if !djIsTierShaped(v.delays) {
		return fmt.Errorf("pulseRippleDelays must be constant within each tier %v, got %v",
			djTierSegments, v.delays)
	}
	return nil
}

// djOverlayByKey indexes the registry. Built once at init; never mutated.
var djOverlayByKey = func() map[string]*djOverlayField {
	m := make(map[string]*djOverlayField, len(djOverlayRegistry))
	for i := range djOverlayRegistry {
		f := &djOverlayRegistry[i]
		if _, dup := m[f.key]; dup {
			panic("dj overlay registry: duplicate key " + f.key)
		}
		m[f.key] = f
	}
	return m
}()

// djOverlayEligibleKeys — the only firmware fields the DJ may ever overlay.
// DERIVED from the registry, in registry order, so it cannot drift from the
// apply and release paths.
var djOverlayEligibleKeys = func() []string {
	keys := make([]string, 0, len(djOverlayRegistry))
	for _, f := range djOverlayRegistry {
		keys = append(keys, f.key)
	}
	return keys
}()

// djOverlayFamilyKeys returns one family's keys in registry order.
func djOverlayFamilyKeys(family string) []string {
	keys := make([]string, 0, 8)
	for _, f := range djOverlayRegistry {
		if f.family == family {
			keys = append(keys, f.key)
		}
	}
	return keys
}

// djValidateOverlayValue checks a value against its registered field.
func djValidateOverlayValue(key string, v djOverlayValue) error {
	f, ok := djOverlayByKey[key]
	if !ok {
		return fmt.Errorf("%q is not a DJ-eligible field", key)
	}
	if v.kind != f.kind {
		return fmt.Errorf("%s expects %s, got %s", key, f.kind, v.kind)
	}
	// The SAME bounds a user write must satisfy, run through the same
	// function, so a recipe can never author a value the API would refuse from
	// a person. Deriving beats restating: a copied bound is one that drifts.
	var patch FirmwareMusicConfigPatch
	f.setPatch(&patch, v)
	if err := patch.validate(); err != nil {
		return fmt.Errorf("%s: %w", key, err)
	}
	// Bounds checks compare against limits, and NaN compares false to every
	// limit — so it passes them all. Finiteness has to be its own rule.
	if v.kind == djOverlayF32 {
		if err := djValidateFinite(v); err != nil {
			return fmt.Errorf("%s: %w", key, err)
		}
	}
	if f.validate != nil {
		return f.validate(v)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Color Story
// ---------------------------------------------------------------------------

// djColorStoryKeys — the Color Story subset of the overlay, derived from the
// registry so a new dynamics field cannot be added without Color Story's
// release path learning about it.
var djColorStoryKeys = djOverlayFamilyKeys(djFamilyDynamics)

// djDynamicsClassicReset is the neutral member every mood list ends on, so
// the sequence breathes back to the canonical look instead of wandering.
var djDynamicsClassicReset = map[string]djOverlayValue{
	"colorMotionSpeed": djU8(0), "colorSpread": djU8(0), "energyToMotion": djU8(0),
	"beatHueStep": djU8(0), "peakBandToHue": djU8(0),
}

// djDynamicsStoryMoods are the curated Color Dynamics moods the DJ cycles
// through on phrase switches onto smooth looks. UNCHANGED — this is exactly
// what color_story: true has always played, and widening is a separate mode
// rather than a redefinition of this one.
var djDynamicsStoryMoods = []map[string]djOverlayValue{
	{"colorMotionSpeed": djU8(40), "colorSpread": djU8(32), "energyToMotion": djU8(1), "beatHueStep": djU8(0), "peakBandToHue": djU8(0)},   // gentle drift
	{"colorMotionSpeed": djU8(80), "colorSpread": djU8(48), "energyToMotion": djU8(0), "beatHueStep": djU8(20), "peakBandToHue": djU8(0)},  // beat-stepped hues
	{"colorMotionSpeed": djU8(20), "colorSpread": djU8(24), "energyToMotion": djU8(1), "beatHueStep": djU8(10), "peakBandToHue": djU8(32)}, // frequency-painted
	djDynamicsClassicReset,
}

// djDynamicsWideMoods range the SAME five fields further. Still a curated
// list with a resting state, deliberately not per-key randomisation: Color
// Story works because it is a few chosen moods, and a random walk over five
// axes reads as a malfunction rather than as taste.
//
// energyToMotion is 255 here, not 1. Firmware computes the energy
// contribution as ((uint16_t)rEnergy * energyToMotion) >> 8 with rEnergy a
// uint8 — so at 1 the term is 0 for every possible energy, and only 255 gives
// the "audio energy adds to drift speed" the field is named for. The story
// moods above keep their 1 because changing them would change a look that is
// on the desk today; see the note in the commit that introduced these.
var djDynamicsWideMoods = []map[string]djOverlayValue{
	djDynamicsStoryMoods[0],
	djDynamicsStoryMoods[1],
	djDynamicsStoryMoods[2],
	{"colorMotionSpeed": djU8(160), "colorSpread": djU8(96), "energyToMotion": djU8(0), "beatHueStep": djU8(0), "peakBandToHue": djU8(0)},    // wide sweep
	{"colorMotionSpeed": djU8(24), "colorSpread": djU8(40), "energyToMotion": djU8(255), "beatHueStep": djU8(0), "peakBandToHue": djU8(0)},   // energy-driven drift
	{"colorMotionSpeed": djU8(8), "colorSpread": djU8(16), "energyToMotion": djU8(0), "beatHueStep": djU8(48), "peakBandToHue": djU8(32)},    // hue slam on the beat
	{"colorMotionSpeed": djU8(96), "colorSpread": djU8(224), "energyToMotion": djU8(255), "beatHueStep": djU8(6), "peakBandToHue": djU8(32)}, // full-desk wash
	djDynamicsClassicReset,
}

// djDynamicsMoodsFor returns the mood list for a mode; nil when the mode
// writes nothing.
func djDynamicsMoodsFor(mode string) []map[string]djOverlayValue {
	switch mode {
	case DJDynamicsStory:
		return djDynamicsStoryMoods
	case DJDynamicsWide:
		return djDynamicsWideMoods
	default:
		return nil
	}
}

// ---------------------------------------------------------------------------
// Apply / release
// ---------------------------------------------------------------------------

// applyDJOverlayField writes one overlay value into a config copy.
func applyDJOverlayField(cfg *FirmwareMusicConfig, key string, v djOverlayValue) {
	f, ok := djOverlayByKey[key]
	if !ok || v.kind != f.kind {
		return
	}
	f.apply(cfg, v)
}

// djOverlayKeysInPatch lists the DJ-eligible fields a user patch touches.
func djOverlayKeysInPatch(p FirmwareMusicConfigPatch) []string {
	keys := make([]string, 0, 4)
	for _, f := range djOverlayRegistry {
		if f.inPatch(p) {
			keys = append(keys, f.key)
		}
	}
	return keys
}

// composeEffectiveConfigLocked returns activeConfig with the DJ overlay
// applied. Caller holds m.mu.
//
// Map iteration order is random, which is safe ONLY because every key writes a
// distinct field — no two overlay entries can contend for the same byte.
// TestOverlayApplyIsDeterministic pins that property rather than the order.
func (m *MusicModeService) composeEffectiveConfigLocked() FirmwareMusicConfig {
	cfg := m.activeConfig
	for k, v := range m.djTuningOverlay {
		applyDJOverlayField(&cfg, k, v)
	}
	return cfg
}

// releaseDJOverlayForPatchLocked releases DJ ownership of every DJ-eligible
// field a USER patch touches — before transmission — and user-locks it for
// the rest of the DJ session. Caller holds m.mu.
func (m *MusicModeService) releaseDJOverlayForPatchLocked(p FirmwareMusicConfigPatch) {
	keys := djOverlayKeysInPatch(p)
	if len(keys) == 0 {
		return
	}
	for _, k := range keys {
		delete(m.djTuningOverlay, k)
		if m.djEnabled {
			if m.djTuningUserLocked == nil {
				m.djTuningUserLocked = map[string]bool{}
			}
			m.djTuningUserLocked[k] = true
		}
	}
}

// applyDJTuningOverlay is the DJ's ONLY tuning write path. It updates the
// overlay for still-unlocked fields under the conductor's generation and
// pushes the recomposed effective config — canonical and the DB are never
// touched. A canceled/superseded conductor (gen mismatch) writes nothing.
//
// A value that fails registry validation is DROPPED with a log, never clamped:
// the DJ authors these itself, so an invalid one is a bug in a recipe rather
// than untrusted input to be repaired, and substituting a nearby value would
// hide it.
//
// REPORTS whether the WHOLE patch was accepted, which is what a recipe id
// means. Three distinctions matter here and each cost a review round:
//
//   - PARTIAL IS NOT APPLIED. If any field is user-locked or rejected, the
//     recipe as authored is not what is playing, so reporting its id would
//     describe a configuration that never existed. All-or-nothing.
//   - ALREADY-HELD COUNTS AS APPLIED. A field the overlay already carries at
//     this value is in effect; only a field that could not be taken is not.
//   - ACCEPTED IS NOT DELIVERED. The recomposed config is ENQUEUED, and the
//     coalescer may supersede it and does not report the firmware's answer. So
//     true means "this is what the DJ asked the desk for", never "the desk
//     confirmed it" — the same gap plan_verified names for composition, and
//     the reason no consumer should treat a recipe id as proof of render.
func (m *MusicModeService) applyDJTuningOverlay(userID int, gen uint64, patch map[string]djOverlayValue) bool {
	m.mu.Lock()
	if m.djGen != gen || !m.djEnabled || !m.active || m.userID != userID {
		m.mu.Unlock()
		return false
	}
	changed, complete := false, true
	for k, v := range patch {
		if m.djTuningUserLocked[k] {
			complete = false // the user took this field back — theirs for the session
			continue
		}
		if err := djValidateOverlayValue(k, v); err != nil {
			log.Printf("[MUSIC-DJ] Overlay write rejected: %v", err)
			complete = false
			continue
		}
		if cur, ok := m.djTuningOverlay[k]; ok && cur.equal(v) {
			continue // already in effect: accepted, just not a change
		}
		if m.djTuningOverlay == nil {
			m.djTuningOverlay = map[string]djOverlayValue{}
		}
		m.djTuningOverlay[k] = v
		changed = true
	}
	var cfg FirmwareMusicConfig
	supported := m.fwConfigSupported
	if changed {
		cfg = m.composeEffectiveConfigLocked()
	}
	m.mu.Unlock()
	if changed && supported {
		m.enqueueConfig(cfg)
	}
	// "supported" gates transmission, so an unsupported desk changed the map
	// but not the strip.
	return complete && supported
}

// dropDJTuningOverlay clears the whole overlay (and the session's user
// locks) and, when a live session had overlay values on the wire, SENDS the
// pure canonical config synchronously — teardown is not a hot path, and a
// synchronous send survives the shutdown ordering (the coalescer may stop
// right after DJ teardown; an enqueued restore would be dropped unsent).
func (m *MusicModeService) dropDJTuningOverlay(userID int) {
	m.mu.Lock()
	had := len(m.djTuningOverlay) > 0
	m.djTuningOverlay = nil
	m.djTuningUserLocked = nil
	live := m.active && m.userID == userID
	supported := m.fwConfigSupported
	cfg := m.activeConfig
	m.mu.Unlock()
	if !had || !live || !supported {
		return // canonical was never dirtied — an inactive session has nothing to restore
	}
	if _, err := m.sendFirmwareConfig(cfg); err != nil {
		log.Printf("[MUSIC-DJ] Canonical tuning restore failed (non-fatal): %v", err)
	}
}

// releaseDJOverlayFamily drops one family's fields from the overlay and
// restores their canonical values — the shape a tuning control's disable takes
// when what it changes is a background property rather than the look on screen.
func (m *MusicModeService) releaseDJOverlayFamily(userID int, family string) {
	m.mu.Lock()
	changed := false
	for _, k := range djOverlayFamilyKeys(family) {
		if _, ok := m.djTuningOverlay[k]; ok {
			delete(m.djTuningOverlay, k)
			changed = true
		}
	}
	var cfg FirmwareMusicConfig
	live := m.active && m.userID == userID
	supported := m.fwConfigSupported
	if changed {
		cfg = m.composeEffectiveConfigLocked()
	}
	m.mu.Unlock()
	if changed && live && supported {
		m.enqueueConfig(cfg)
	}
}

// releaseDJStoryOverlay drops only the Color Story fields (Color Story
// toggled off during a reconfigure) and restores their canonical values.
func (m *MusicModeService) releaseDJStoryOverlay(userID int) {
	m.releaseDJOverlayFamily(userID, djFamilyDynamics)
}

// maybeAdvanceColorStory applies the next curated Color Dynamics mood after a
// successful rotation onto a smooth look — only when the custom program's
// Color Story is on and the firmware is known to support color dynamics.
func (m *MusicModeService) maybeAdvanceColorStory(userID int, gen uint64, act *djAction, storyIdx *int) {
	if act.reason != "phrase" && act.reason != "resume" {
		return
	}
	// Classify the APPLIED ACTION, not its base visualization. Once a recipe
	// can put The Drop on two tiers of an otherwise smooth look, "is this
	// smooth?" stops being a property of act.viz — the same any-segment
	// semantics the firmware uses for musicFxActive and anyDrop.
	if djPlanIsFlashHeavy(djResolvedPlanOf(act.tiers, act.viz)) {
		return
	}
	m.mu.RLock()
	mode := ""
	if m.djRuntime != nil && m.djRuntime.settings != nil {
		mode = m.djRuntime.settings.DynamicsMode
	}
	supported := m.fwColorDynamicsSupported
	m.mu.RUnlock()
	moods := djDynamicsMoodsFor(mode)
	if !supported || len(moods) == 0 {
		return
	}
	idx := *storyIdx % len(moods)
	*storyIdx++
	m.applyDJTuningOverlay(userID, gen, moods[idx])
	// Name the mood on the look it was layered onto, for the ratings (music_dj_tuning.go).
	m.mu.Lock()
	if m.djGen == gen && m.djNowPlaying != nil {
		mood := idx
		m.djNowPlaying.DynamicsMood = &mood
	}
	m.mu.Unlock()
	log.Printf("[MUSIC-DJ] Dynamics (%s) mood %d on %s", mode, idx, act.label)
}

// djTuningOverlaySnapshot exposes a copy of the overlay for tests and status.
//
// Unexported: it has no caller outside this package, and an exported method
// returning a map of an unexported value type would be unusable from one.
func (m *MusicModeService) djTuningOverlaySnapshot() map[string]djOverlayValue {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if len(m.djTuningOverlay) == 0 {
		return nil
	}
	out := make(map[string]djOverlayValue, len(m.djTuningOverlay))
	for k, v := range m.djTuningOverlay {
		out[k] = v
	}
	return out
}
