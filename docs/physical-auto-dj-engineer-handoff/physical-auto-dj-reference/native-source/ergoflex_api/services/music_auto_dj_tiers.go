// services/music_auto_dj_tiers.go
// The five physical tiers, written down once.

package services

// djNumTiers is the number of physical LED tiers the desk has.
const djNumTiers = 5

// djSegmentTier maps each strip to the physical tier it washes. It mirrors
// firmware EffectEngine.h:
//
//	static constexpr uint8_t STRIP_LAYER[NUM_SEGMENTS] = {0, 1, 1, 2, 3, 3, 3, 4};
//
// The index is the firmware LAYER: 0 is The Head, 4 is The Feet. This is
// HARDWARE geometry — eight strips washing five surfaces, per the patent's
// 822a-822h indicators — and it is neither wiring order nor the Tower band
// index L. L is DISTANCE FROM THE BASS END and is derived from the layer
// (`L = (seg.ix >= 128) ? layer : NUM_LAYERS-1-layer`), so the two are equal
// for only one of the two directions. Reading L as a tier number is the
// mistake this comment exists to prevent.
var djSegmentTier = [8]int{0, 1, 1, 2, 3, 3, 3, 4}

// djTierSegments is the inverse: which strips share each tier. Tiers are NOT
// equal width — tier 0 and tier 4 are one strip each, tier 3 is three — which
// is why anything reasoning about "how much of the desk is doing X" must count
// strips rather than tiers.
var djTierSegments = [djNumTiers][]int{
	0: {0},
	1: {1, 2},
	2: {3},
	3: {4, 5, 6},
	4: {7},
}

// djIsTierShaped reports whether a per-strip array is constant within every
// tier — the shape any DJ-authored per-strip value must have.
//
// Without this a per-strip firmware field varies inside a single shelf: strips
// 4, 5 and 6 are one physical surface, so giving them three different ripple
// delays makes that shelf disagree with itself. It matters most for values
// delivered through the GLOBAL tuning overlay rather than through segment
// overrides, because no per-segment test observes them — a "strips sharing a
// tier carry identical FX/IX" assertion passes while the shelf is incoherent.
func djIsTierShaped(v [8]uint8) bool {
	for _, segs := range djTierSegments {
		for _, si := range segs[1:] {
			if v[si] != v[segs[0]] {
				return false
			}
		}
	}
	return true
}
