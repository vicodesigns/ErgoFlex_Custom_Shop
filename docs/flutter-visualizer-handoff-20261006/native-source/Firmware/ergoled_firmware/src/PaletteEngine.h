/**
 * PaletteEngine.h - ErgoLED RGBW Palette System
 *
 * 22 palettes: 20 fixed RGBW 16-stop gradients + 2 dynamic user gradients.
 * Integer-only interpolation (lerp8by8) — no floats in hot path.
 *
 * Palette data: 4 bytes/stop × 16 stops × 20 palettes = 1,280 bytes PROGMEM.
 *
 * Blend modes:
 *   pblend=0 (smooth): linear interpolation between bracketing stops
 *   pblend=1 (stepped): snap to nearest stop = (position + 8) >> 4
 *
 * PAL 22-29: user palette slots (Palette Studio, src/palette/UserPalette.hpp). Each carries its
 * own stops and its own blend, so seg.pblend does not apply to them. An empty slot renders
 * exactly as PAL 0.
 */

#pragma once
#include <Arduino.h>
#include "config.h"
#include "state/GlobalState.hpp"
#include "palette/UserPalette.hpp"

// The user slots start immediately after the built-ins, and the host learns their ids from the
// hello's "upal" block. NUM_PALETTES lives in config.h, which carries each desk's uncommitted
// network settings, so it cannot move with this code: a built-in added there without moving the
// slots would silently collide with slot 22.
static_assert(NUM_PALETTES == UserPalette::kFirstId,
              "user palette slots must start right after the built-in palettes");

class PaletteEngine {
public:
    // Every palette id seg.pal may hold: 0-21 built-in, 22-29 user slots.
    static constexpr uint8_t kPalIdLimit = UserPalette::kFirstId + UserPalette::kSlots;

    static inline bool isUserPalette(uint8_t palId) { return UserPalette::isUserId(palId); }

    // The renderer's private copy of the user slots, refreshed from gState under the state lock
    // whenever gState.upalGen moves (EffectEngine::renderFromState). colorFromPalette reads only
    // this copy, and only the render loop calls it, so a palette write landing mid-frame cannot
    // tear a strip: the frame either sees the old slots throughout or the new ones.
    static void loadUserSlots(const UserPalette::Slot* slots) {
        memcpy(s_userSlots, slots, sizeof(s_userSlots));
    }

    // Where pixel p of a len-pixel strip samples the palette in a MUSIC effect.
    //
    // For a built-in palette (0-21) this returns palPos UNCHANGED, so every built-in renders
    // exactly as it always did. For a user slot (22-29) it adds the strip's own position — the
    // same centre-of-band map Solid uses (UserPalette::pixelPosition) — so the effect lays the
    // WHOLE palette along the strip instead of a slice or a single colour, and at colour phase 0
    // looks exactly as Solid and the Studio's preview draw it. The effect's own term (band, layer,
    // fill, colour phase) still moves the palette, so the music behaviour is unchanged; only which
    // colours appear is.
    //
    // Used by FX 29 Pulse, 31 Strobe, 37 Tower, 38 Ripple, 39 Bass Sky and 40 Drop (build and
    // idle). Spectrum, Comet, Wave and Drop's wash already spread; Drop's slam is a deliberate
    // full-field white flash on every palette; Fire maps heat, not position.
    static inline uint8_t musicPalPos(uint8_t palId, uint8_t palPos, uint16_t p, uint16_t len) {
        return isUserPalette(palId) ? (uint8_t)(palPos + UserPalette::pixelPosition(p, len)) : palPos;
    }

    // What a strip's crossfade trigger compares for a user palette: which stops the slot holds
    // now. 0 for a built-in id, so the trigger's new term can never fire for pal 0-21.
    static uint64_t userSlotIdentity(uint8_t palId) {
        if (!isUserPalette(palId)) return 0;
        const UserPalette::Slot& s = s_userSlots[palId - UserPalette::kFirstId];
        return s.n == 0 ? 0 : (((uint64_t)s.n << 32) | s.crc);
    }
    /**
     * Look up RGBW color from palette at given position (0-255).
     *
     * @param palId    Palette ID (0-21 built-in, 22-29 user slots)
     * @param position Position along gradient (0=start, 255=end)
     * @param seg      Segment state (for user gradients: col[0..2], pblend)
     * @param r,g,b,w  Output color channels
     */
    static void colorFromPalette(uint8_t palId, uint8_t position,
                                  const SegmentState& seg,
                                  uint8_t& r, uint8_t& g, uint8_t& b, uint8_t& w) {
        // PAL 0: Default — pass-through seg.col[0]
        if (palId == 0) {
            r = seg.col[0][0];
            g = seg.col[0][1];
            b = seg.col[0][2];
            w = seg.col[0][3];
            return;
        }

        // PAL 20: User Gradient 2 — lerp col[0] → col[1]
        if (palId == 20) {
            r = lerp8by8(seg.col[0][0], seg.col[1][0], position);
            g = lerp8by8(seg.col[0][1], seg.col[1][1], position);
            b = lerp8by8(seg.col[0][2], seg.col[1][2], position);
            w = lerp8by8(seg.col[0][3], seg.col[1][3], position);
            return;
        }

        // PAL 21: User Gradient 3 — col[0] → col[1] → col[2]
        if (palId == 21) {
            if (position < 128) {
                uint8_t t = position * 2;
                r = lerp8by8(seg.col[0][0], seg.col[1][0], t);
                g = lerp8by8(seg.col[0][1], seg.col[1][1], t);
                b = lerp8by8(seg.col[0][2], seg.col[1][2], t);
                w = lerp8by8(seg.col[0][3], seg.col[1][3], t);
            } else {
                uint8_t t = (position - 128) * 2;
                r = lerp8by8(seg.col[1][0], seg.col[2][0], t);
                g = lerp8by8(seg.col[1][1], seg.col[2][1], t);
                b = lerp8by8(seg.col[1][2], seg.col[2][2], t);
                w = lerp8by8(seg.col[1][3], seg.col[2][3], t);
            }
            return;
        }

        // PAL 22-29: user palette slots. Checked before the out-of-range fallback below, which
        // is where these ids used to land.
        if (isUserPalette(palId)) {
            const UserPalette::Slot& s = s_userSlots[palId - UserPalette::kFirstId];
            if (s.n == 0) {
                r = seg.col[0][0]; g = seg.col[0][1];
                b = seg.col[0][2]; w = seg.col[0][3];
            } else {
                UserPalette::sample(s, position, r, g, b, w);
            }
            return;
        }

        // Fixed palettes (1-19): 16-stop RGBW lookup
        if (palId > 19) {
            // Out of range — fallback to seg color
            r = seg.col[0][0]; g = seg.col[0][1];
            b = seg.col[0][2]; w = seg.col[0][3];
            return;
        }

        const uint8_t* pal = PALETTES[palId - 1]; // palettes array is 0-indexed for PAL 1-19

        if (seg.pblend == 1) {
            // Stepped mode: snap to nearest stop (not floor)
            uint8_t stop = (position + 8) >> 4; // 0..15, rounds to nearest
            if (stop > 15) stop = 15;
            uint16_t idx = stop * 4;
            r = pgm_read_byte(&pal[idx]);
            g = pgm_read_byte(&pal[idx + 1]);
            b = pgm_read_byte(&pal[idx + 2]);
            w = pgm_read_byte(&pal[idx + 3]);
        } else {
            // Smooth mode: lerp between bracketing stops
            uint8_t stopLo = position >> 4;        // 0..15
            uint8_t stopHi = stopLo + 1;
            if (stopHi > 15) stopHi = 15;
            uint8_t frac = (position & 0x0F) << 4; // scale 0-15 to 0-240

            uint16_t idxLo = stopLo * 4;
            uint16_t idxHi = stopHi * 4;

            r = lerp8by8(pgm_read_byte(&pal[idxLo]),     pgm_read_byte(&pal[idxHi]),     frac);
            g = lerp8by8(pgm_read_byte(&pal[idxLo + 1]), pgm_read_byte(&pal[idxHi + 1]), frac);
            b = lerp8by8(pgm_read_byte(&pal[idxLo + 2]), pgm_read_byte(&pal[idxHi + 2]), frac);
            w = lerp8by8(pgm_read_byte(&pal[idxLo + 3]), pgm_read_byte(&pal[idxHi + 3]), frac);
        }
    }

private:
    static UserPalette::Slot s_userSlots[UserPalette::kSlots];

    /**
     * Integer-only linear interpolation: a + (((b - a) * frac) >> 8)
     * frac: 0=all a, 255=all b
     */
    static inline uint8_t lerp8by8(uint8_t a, uint8_t b, uint8_t frac) {
        return a + (((int16_t)(b - a) * frac) >> 8);
    }

    // ═══════════════════════════════════════════════════════
    // 19 Fixed RGBW Palettes (PAL 1-19), 16 stops × 4 bytes each
    // Format per stop: {R, G, B, W}
    // ═══════════════════════════════════════════════════════

    // PAL 1: Rainbow
    static constexpr uint8_t PAL_RAINBOW[] PROGMEM = {
        255,   0,   0,   0,  // 0  Red
        255,  64,   0,   0,  // 1  Red-Orange
        255, 128,   0,   0,  // 2  Orange
        255, 200,   0,   0,  // 3  Yellow-Orange
        255, 255,   0,   0,  // 4  Yellow
        128, 255,   0,   0,  // 5  Yellow-Green
          0, 255,   0,   0,  // 6  Green
          0, 255, 128,   0,  // 7  Green-Cyan
          0, 255, 255,   0,  // 8  Cyan
          0, 128, 255,   0,  // 9  Cyan-Blue
          0,   0, 255,   0,  // 10 Blue
         64,   0, 255,   0,  // 11 Blue-Indigo
        128,   0, 255,   0,  // 12 Indigo
        200,   0, 255,   0,  // 13 Violet
        255,   0, 200,   0,  // 14 Magenta
        255,   0, 100,   0,  // 15 Rose
    };

    // PAL 2: Party
    static constexpr uint8_t PAL_PARTY[] PROGMEM = {
        255,   0, 128,   0,  // Hot pink
        255,   0, 255,   0,  // Magenta
        128,   0, 255,   0,  // Purple
          0,   0, 255,   0,  // Blue
          0, 128, 255,   0,  // Sky
          0, 255, 255,   0,  // Cyan
          0, 255, 128,   0,  // Mint
          0, 255,   0,   0,  // Green
        128, 255,   0,   0,  // Lime
        255, 255,   0,   0,  // Yellow
        255, 200,   0,   0,  // Gold
        255, 128,   0,   0,  // Orange
        255,  64,   0,   0,  // Deep Orange
        255,   0,   0,   0,  // Red
        255,   0,  64,   0,  // Crimson
        255,   0, 128,   0,  // Hot pink (wrap)
    };

    // PAL 3: Ocean
    static constexpr uint8_t PAL_OCEAN[] PROGMEM = {
          0,   0,  32,   0,  // Deep navy
          0,   0,  64,   0,  // Dark blue
          0,   0, 128,   0,  // Medium blue
          0,  32, 160,   0,  // Blue
          0,  64, 192,   0,  // Ocean blue
          0, 100, 200,   0,  // Light blue
          0, 128, 220,   0,  // Sky blue
          0, 160, 200,   0,  // Teal-blue
          0, 180, 180,   0,  // Teal
          0, 200, 160,   0,  // Sea green
          0, 180, 128,   0,  // Ocean green
          0, 160, 100,   0,  // Deep green
          0, 128,  80,   0,  // Forest-sea
          0,  80,  64,   0,  // Dark teal
          0,  40,  48,   0,  // Abyssal
          0,   0,  32,   0,  // Deep navy (wrap)
    };

    // PAL 4: Forest
    static constexpr uint8_t PAL_FOREST[] PROGMEM = {
          0,  32,   0,   0,  // Dark green
          0,  64,   0,   0,  // Forest green
          0, 100,  16,   0,  // Green
         16, 128,   0,   0,  // Bright green
         32, 160,   0,   0,  // Lime green
         64, 140,   0,   0,  // Olive green
         80, 120,  16,   0,  // Olive
        100, 100,  32,   0,  // Earth green
        120,  80,  32,   0,  // Brown-green
        100,  60,  20,   0,  // Earth
         80,  40,  10,   0,  // Dark earth
         40,  60,   0,   0,  // Dark olive
          0,  80,   0,   0,  // Medium green
          0, 100,  32,   0,  // Green-teal
          0,  64,  16,   0,  // Dark teal-green
          0,  32,   0,   0,  // Dark green (wrap)
    };

    // PAL 5: Lava (warm W channel)
    static constexpr uint8_t PAL_LAVA[] PROGMEM = {
          0,   0,   0,   0,  // Black
         32,   0,   0,   0,  // Very dark red
         64,   0,   0,   0,  // Dark red
        128,   0,   0,   0,  // Red
        180,  16,   0,   0,  // Red-orange
        220,  40,   0,   8,  // Orange (hint W)
        255,  80,   0,  16,  // Bright orange
        255, 120,   0,  32,  // Gold
        255, 160,   0,  48,  // Yellow-gold
        255, 200,   0,  64,  // Yellow
        255, 220,  32,  96,  // Light yellow
        255, 240,  64, 128,  // Pale yellow
        255, 250, 100, 160,  // Near white
        255, 255, 160, 200,  // Warm white
        255, 255, 200, 240,  // Hot white
        255, 255, 220, 255,  // Full warm white
    };

    // PAL 6: Fire (warm W)
    static constexpr uint8_t PAL_FIRE[] PROGMEM = {
          0,   0,   0,   0,  // Black
         32,   0,   0,   0,  // Ember
         64,   0,   0,   0,  // Dark red
        128,   0,   0,   0,  // Red
        180,   0,   0,   0,  // Bright red
        220,  32,   0,   0,  // Red-orange
        255,  64,   0,   8,  // Orange
        255, 100,   0,  16,  // Bright orange
        255, 140,   0,  24,  // Gold
        255, 180,   0,  32,  // Yellow-orange
        255, 220,   0,  48,  // Yellow
        255, 240,  32,  64,  // Light yellow
        255, 220,   0,  48,  // Yellow (dim back)
        255, 160,   0,  24,  // Orange
        200,  80,   0,   8,  // Dark orange
        128,  32,   0,   0,  // Ember (wrap)
    };

    // PAL 7: Sunset (warm W)
    static constexpr uint8_t PAL_SUNSET[] PROGMEM = {
          0,   0,  80,   0,  // Deep blue
         16,   0, 120,   0,  // Navy
         48,   0, 160,   0,  // Blue
         80,   0, 180,   0,  // Blue-purple
        120,   0, 200,   0,  // Purple
        180,   0, 180,   0,  // Magenta
        220,   0, 120,   8,  // Red-magenta
        255,  32,  64,  16,  // Red
        255,  80,  16,  24,  // Red-orange
        255, 120,   0,  40,  // Orange
        255, 160,   0,  56,  // Gold
        255, 200,  32,  72,  // Yellow
        255, 220,  64,  96,  // Warm yellow
        255, 240, 100, 128,  // Pale gold
        255, 220,  80,  64,  // Gold (dim)
        255, 180,  32,  32,  // Deep gold
    };

    // PAL 8: Cloud (full W channel)
    static constexpr uint8_t PAL_CLOUD[] PROGMEM = {
        200, 220, 255, 200,  // White-blue
        180, 200, 255, 220,  // Light blue
        160, 180, 255, 240,  // Sky
        180, 200, 255, 255,  // Bright sky
        200, 220, 255, 255,  // Near white
        220, 240, 255, 255,  // White
        240, 250, 255, 255,  // Bright white
        255, 255, 255, 255,  // Pure white
        240, 250, 255, 255,  // Bright white
        220, 240, 255, 255,  // White
        200, 220, 255, 240,  // Near white
        180, 200, 240, 220,  // Light blue
        160, 180, 230, 200,  // Sky
        140, 160, 220, 180,  // Blue-grey
        160, 180, 240, 200,  // Light grey-blue
        200, 220, 255, 200,  // White-blue (wrap)
    };

    // PAL 9: Pastel (partial W)
    static constexpr uint8_t PAL_PASTEL[] PROGMEM = {
        255, 180, 200,  40,  // Pink
        255, 200, 180,  40,  // Peach
        255, 220, 160,  40,  // Pale orange
        255, 240, 180,  40,  // Cream
        220, 255, 180,  40,  // Pale green
        180, 255, 200,  40,  // Mint
        180, 240, 255,  40,  // Pale cyan
        180, 220, 255,  40,  // Pale blue
        200, 200, 255,  40,  // Lavender
        220, 180, 255,  40,  // Pale purple
        255, 180, 255,  40,  // Pale magenta
        255, 180, 220,  40,  // Pale rose
        255, 200, 200,  40,  // Pale salmon
        255, 220, 200,  40,  // Pale peach
        255, 200, 220,  40,  // Pink
        255, 180, 200,  40,  // Pink (wrap)
    };

    // PAL 10: Icefire
    static constexpr uint8_t PAL_ICEFIRE[] PROGMEM = {
          0, 255, 255,   0,  // Cyan
          0, 200, 255,   0,  // Light cyan
          0, 128, 255,   0,  // Blue-cyan
          0,  64, 255,   0,  // Blue
          0,   0, 200,   0,  // Dark blue
          0,   0, 100,   0,  // Navy
          0,   0,  32,   0,  // Near black
          0,   0,   0,   0,  // Black
         32,   0,   0,   0,  // Near black (warm)
        100,   0,   0,   0,  // Dark red
        180,   0,   0,   0,  // Red
        255,  32,   0,   0,  // Red-orange
        255,  80,   0,   0,  // Orange
        255, 160,   0,   0,  // Yellow-orange
        255, 255,   0,   0,  // Yellow
        128, 255, 128,   0,  // Pale yellow-green
    };

    // PAL 11: Aurora
    static constexpr uint8_t PAL_AURORA[] PROGMEM = {
          0, 128,   0,   0,  // Green
          0, 180,  32,   0,  // Bright green
          0, 220,  64,   0,  // Green-cyan
          0, 255, 100,   0,  // Cyan-green
          0, 240, 140,   0,  // Teal
          0, 200, 180,   0,  // Teal-blue
          0, 160, 220,   0,  // Blue-teal
          0, 100, 255,   0,  // Blue
         32,  64, 255,   0,  // Indigo
         80,  32, 255,   0,  // Blue-purple
        128,   0, 255,   0,  // Purple
        160,   0, 220,   0,  // Dark purple
        128,   0, 180,   0,  // Deep purple
         80,  32, 160,   0,  // Purple-blue
         32,  80, 128,   0,  // Blue-green
          0, 128,  64,   0,  // Green (wrap)
    };

    // PAL 12: Sakura (W at white stops)
    static constexpr uint8_t PAL_SAKURA[] PROGMEM = {
        255, 180, 200,  40,  // Pale pink
        255, 140, 180,  20,  // Pink
        255, 100, 150,   0,  // Deep pink
        255,  80, 120,   0,  // Rose
        255, 100, 140,   0,  // Medium pink
        255, 140, 160,  20,  // Soft pink
        255, 180, 190,  60,  // Light pink
        255, 220, 230, 100,  // Near white
        255, 240, 245, 140,  // White-pink
        255, 220, 230, 100,  // Near white
        255, 180, 200,  60,  // Pale pink
        255, 140, 170,  20,  // Pink
        255, 100, 140,   0,  // Medium pink
        255, 120, 150,   0,  // Soft rose
        255, 150, 170,  20,  // Light rose
        255, 180, 200,  40,  // Pale pink (wrap)
    };

    // PAL 13: Cyane (W at center)
    static constexpr uint8_t PAL_CYANE[] PROGMEM = {
          0,  80, 128,   0,  // Dark cyan
          0, 120, 160,   0,  // Medium cyan
          0, 160, 200,   0,  // Cyan
          0, 200, 220,  16,  // Bright cyan
          0, 220, 240,  32,  // Light cyan
          0, 240, 255,  64,  // Pale cyan
         40, 255, 255, 100,  // White-cyan
        100, 255, 255, 160,  // Near white
        100, 255, 255, 160,  // Near white
         40, 255, 255, 100,  // White-cyan
          0, 240, 255,  64,  // Pale cyan
          0, 220, 240,  32,  // Light cyan
          0, 200, 220,  16,  // Bright cyan
          0, 160, 200,   0,  // Cyan
          0, 120, 160,   0,  // Medium cyan
          0,  80, 128,   0,  // Dark cyan (wrap)
    };

    // PAL 14: Temperature (W at center)
    static constexpr uint8_t PAL_TEMPERATURE[] PROGMEM = {
          0,   0, 255,   0,  // Cold blue
          0,  40, 255,   0,  // Blue
          0,  80, 255,  16,  // Light blue
          0, 128, 255,  32,  // Sky
          0, 180, 255,  64,  // Pale blue
         64, 220, 255, 100,  // Cool white
        140, 240, 255, 160,  // Near white (cool)
        200, 255, 255, 220,  // White
        255, 255, 200, 220,  // White (warm)
        255, 240, 140, 160,  // Near white (warm)
        255, 200,  64, 100,  // Pale yellow
        255, 160,   0,  64,  // Yellow
        255, 120,   0,  32,  // Orange
        255,  80,   0,  16,  // Dark orange
        255,  40,   0,   0,  // Red-orange
        255,   0,   0,   0,  // Hot red
    };

    // PAL 15: Orange & Teal (cinematic)
    static constexpr uint8_t PAL_ORANGE_TEAL[] PROGMEM = {
        255, 140,  40,   0,  // Orange
        255, 160,  60,   0,  // Light orange
        255, 180,  80,   0,  // Pale orange
        255, 160,  60,   0,  // Light orange
        255, 140,  40,   0,  // Orange
        200, 100,  20,   0,  // Dark orange
        128,  60,  10,   0,  // Deep orange
         64,  80,  80,   0,  // Transition
          0, 100, 120,   0,  // Dark teal
          0, 140, 160,   0,  // Teal
          0, 180, 200,   0,  // Bright teal
          0, 200, 220,   0,  // Light teal
          0, 180, 200,   0,  // Bright teal
          0, 140, 160,   0,  // Teal
          0, 100, 120,   0,  // Dark teal
        128, 100,  60,   0,  // Transition (wrap)
    };

    // PAL 16: Gaming (neon RGB)
    static constexpr uint8_t PAL_GAMING[] PROGMEM = {
        255,   0,   0,   0,  // Red
        255,   0,  64,   0,  // Red-pink
        255,   0, 128,   0,  // Pink
        255,   0, 255,   0,  // Magenta
        128,   0, 255,   0,  // Purple
          0,   0, 255,   0,  // Blue
          0, 128, 255,   0,  // Cyan-blue
          0, 255, 255,   0,  // Cyan
          0, 255, 128,   0,  // Cyan-green
          0, 255,   0,   0,  // Green
        128, 255,   0,   0,  // Lime
        255, 255,   0,   0,  // Yellow
        255, 128,   0,   0,  // Orange
        255,  64,   0,   0,  // Deep orange
        255,   0,   0,   0,  // Red
        255,   0,  32,   0,  // Red (wrap)
    };

    // PAL 17: Focus (W at end — productivity blue)
    static constexpr uint8_t PAL_FOCUS[] PROGMEM = {
          0,   0,  64,   0,  // Dark blue
          0,   0, 100,   0,  // Navy
          0,  16, 140,   0,  // Blue
          0,  32, 180,   0,  // Medium blue
          0,  48, 200,   8,  // Bright blue
          0,  64, 220,  16,  // Light blue
          0,  80, 240,  32,  // Sky blue
         16, 100, 255,  48,  // Pale blue
         32, 120, 255,  64,  // Lighter blue
         48, 140, 255,  80,  // Near white blue
         64, 160, 255, 100,  // Very light blue
         80, 180, 255, 120,  // Pale sky
        100, 200, 255, 140,  // Near white
        120, 220, 255, 180,  // Cool white
        140, 240, 255, 220,  // White
        160, 255, 255, 255,  // Full white
    };

    // PAL 18: Warm Office (heavy W — designed for RGBW strips)
    static constexpr uint8_t PAL_WARM_OFFICE[] PROGMEM = {
        200, 140,  60, 180,  // Warm amber
        210, 150,  70, 190,  // Light amber
        220, 160,  80, 200,  // Medium warm
        230, 170,  90, 210,  // Warm
        240, 180, 100, 220,  // Bright warm
        245, 190, 110, 230,  // Light warm
        250, 200, 120, 240,  // Near white warm
        255, 210, 140, 255,  // Full warm white
        255, 210, 140, 255,  // Full warm white
        250, 200, 120, 240,  // Near white warm
        245, 190, 110, 230,  // Light warm
        240, 180, 100, 220,  // Bright warm
        230, 170,  90, 210,  // Warm
        220, 160,  80, 200,  // Medium warm
        210, 150,  70, 190,  // Light amber
        200, 140,  60, 180,  // Warm amber (wrap)
    };

    // PAL 19: Night Mode (deep calming purples, no W)
    static constexpr uint8_t PAL_NIGHT_MODE[] PROGMEM = {
         16,   0,  32,   0,  // Very dark purple
         24,   0,  48,   0,  // Dark purple
         40,   0,  80,   0,  // Purple
         56,   0, 100,   0,  // Medium purple
         72,   0, 120,   0,  // Bright purple
         56,   0, 140,   0,  // Blue-purple
         40,   0, 160,   0,  // Indigo
         24,   0, 140,   0,  // Dark indigo
         16,   0, 120,   0,  // Deep blue-purple
         24,   0, 100,   0,  // Blue-purple
         40,   0,  80,   0,  // Purple
         56,   0,  64,   0,  // Dark magenta
         40,   0,  48,   0,  // Deep purple
         24,   0,  40,   0,  // Very dark
         16,   0,  32,   0,  // Near black
         16,   0,  32,   0,  // Very dark purple (wrap)
    };

    // Master palette table: array of pointers to each fixed palette (PAL 1-19)
    static constexpr const uint8_t* PALETTES[] = {
        PAL_RAINBOW,        // index 0 → PAL 1
        PAL_PARTY,          // index 1 → PAL 2
        PAL_OCEAN,          // index 2 → PAL 3
        PAL_FOREST,         // index 3 → PAL 4
        PAL_LAVA,           // index 4 → PAL 5
        PAL_FIRE,           // index 5 → PAL 6
        PAL_SUNSET,         // index 6 → PAL 7
        PAL_CLOUD,          // index 7 → PAL 8
        PAL_PASTEL,         // index 8 → PAL 9
        PAL_ICEFIRE,        // index 9 → PAL 10
        PAL_AURORA,         // index 10 → PAL 11
        PAL_SAKURA,         // index 11 → PAL 12
        PAL_CYANE,          // index 12 → PAL 13
        PAL_TEMPERATURE,    // index 13 → PAL 14
        PAL_ORANGE_TEAL,    // index 14 → PAL 15
        PAL_GAMING,         // index 15 → PAL 16
        PAL_FOCUS,          // index 16 → PAL 17
        PAL_WARM_OFFICE,    // index 17 → PAL 18
        PAL_NIGHT_MODE,     // index 18 → PAL 19
    };
};

// Static constexpr definitions (required for linkage in C++14)
constexpr uint8_t PaletteEngine::PAL_RAINBOW[];
constexpr uint8_t PaletteEngine::PAL_PARTY[];
constexpr uint8_t PaletteEngine::PAL_OCEAN[];
constexpr uint8_t PaletteEngine::PAL_FOREST[];
constexpr uint8_t PaletteEngine::PAL_LAVA[];
constexpr uint8_t PaletteEngine::PAL_FIRE[];
constexpr uint8_t PaletteEngine::PAL_SUNSET[];
constexpr uint8_t PaletteEngine::PAL_CLOUD[];
constexpr uint8_t PaletteEngine::PAL_PASTEL[];
constexpr uint8_t PaletteEngine::PAL_ICEFIRE[];
constexpr uint8_t PaletteEngine::PAL_AURORA[];
constexpr uint8_t PaletteEngine::PAL_SAKURA[];
constexpr uint8_t PaletteEngine::PAL_CYANE[];
constexpr uint8_t PaletteEngine::PAL_TEMPERATURE[];
constexpr uint8_t PaletteEngine::PAL_ORANGE_TEAL[];
constexpr uint8_t PaletteEngine::PAL_GAMING[];
constexpr uint8_t PaletteEngine::PAL_FOCUS[];
constexpr uint8_t PaletteEngine::PAL_WARM_OFFICE[];
constexpr uint8_t PaletteEngine::PAL_NIGHT_MODE[];
constexpr const uint8_t* PaletteEngine::PALETTES[];
UserPalette::Slot PaletteEngine::s_userSlots[UserPalette::kSlots];
