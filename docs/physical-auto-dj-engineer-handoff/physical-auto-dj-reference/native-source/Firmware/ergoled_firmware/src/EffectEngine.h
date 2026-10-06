/**
 * EffectEngine.h - ErgoLED Animation System
 *
 * 30 contiguous effects (FX 0-29) + 22 palette support + transition crossfade.
 * Per-segment rendering: each of 8 strips independently renders its own effect.
 *
 * Frame pipeline (called from main.cpp):
 *   1. renderFromState()  — render + transition blend (NO Show)
 *   2. PowerLimiter::apply()  — scale if over budget
 *   3. savePrevFrame()  — copy final pixels for next frame's transition
 *   4. showAll()  — call Show() on all strips
 *
 * Reverse + Mirror precedence:
 *   1. Apply reverse to logical pixel index
 *   2. Mirror on the resulting buffer
 * Mirror math: half = (len + 1) / 2, render 0..half-1, copy p -> len-1-p
 *
 * KEYBOARD COMPOSITES (Phase 3, preserved):
 *   CometChase, BreatheStrips, WheelsRight/Left, RotateRight/Left,
 *   WheelsForward/Backward, ElevatorScanner/Animated, Breathe
 *   These have their own Show() calls and are NOT part of the API pipeline.
 */

#ifndef EFFECT_ENGINE_H
#define EFFECT_ENGINE_H

#include <NeoPixelBus.h>
#include "output/ErgoStripMethod.hpp"  // in-spec WS2814 bit timing for every strip
#include <math.h>
#include "config.h"
#include "ambient/Ambient.hpp"   // FX 41 AMBIENT: frame state and render stages
#include "PowerLimiter.h"        // effectiveLimitMA() for the ambient power stage
// Fade frame rate (see fadeFastActive). A desk opts in from its config.h; the source default keeps 30 fps fades.
#ifndef ERGOLED_FADE_60FPS
#define ERGOLED_FADE_60FPS 0
#endif
// Render frames per 100 ms transition unit: 3 at the 33 ms interval, 6 at 16 ms.
#define ERGOLED_FADE_FRAMES_PER_UNIT (ERGOLED_FADE_60FPS ? 6 : 3)
// Breathe waveform: 0 = sine (default), 1 = V-bottom (sin(a/2)), opted into from a desk config.h.
#ifndef ERGOLED_BREATHE_SHAPE
#define ERGOLED_BREATHE_SHAPE 0
#endif
#include "state/GlobalState.hpp"
#include "state/MusicConfig.hpp"
#include "PaletteEngine.h"
// HueTrim: the per-hue correction on the gamma'd path (setPixelRGBW, s_applyTrim).
#include "color/HueTrim.hpp"

#include "output/ShowMode.hpp"
#include "output/Decimate.hpp"
// noteBriInit(): the brightness-transition count that replaced an unconditional UART print in
// the render path below.
#include "diag/SerialDiag.hpp"

class EffectEngine {
private:
    // ═══════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════

    static const int NUM_LAYERS = 5;
    static constexpr int LAYER_STRIPS[5][3] = {
        {0, -1, -1},      // Layer 0: Strip 1 - "The Head"
        {1, 2, -1},       // Layer 1: Strips 2&3 - "Upper Body"
        {3, -1, -1},      // Layer 2: Strip 4 - "The Core"
        {4, 5, 6},        // Layer 3: Strips 5,6,7 - "Lower Body"
        {7, -1, -1}       // Layer 4: Strip 8 - "The Feet"
    };

    // Strip → layer lookup (inverse of LAYER_STRIPS; 0=Head/top .. 4=Feet/bottom).
    // Lets the layer music FX (37-40) resolve a segment's vertical position in O(1).
    static constexpr uint8_t STRIP_LAYER[NUM_SEGMENTS] = {0, 1, 1, 2, 3, 3, 3, 4};

    // Vertical position of a layer's center on a 0.0(top)..1.0(bottom) axis.
    static inline float layerCenter01(uint8_t layer) {
        return (float)layer / (float)(NUM_LAYERS - 1);
    }

    static constexpr uint8_t COMET_TAIL_LUT[MAX_PIXELS_PER_STRIP] = {
        255, 215, 175, 128, 81, 53, 23, 15, 10, 7, 5, 3, 1, 0, 0, 0
    };

    // ═══════════════════════════════════════════════════════
    // Per-Segment State (API-driven effects)
    // ═══════════════════════════════════════════════════════

    // Phase tracking
    static float _segPhase[NUM_SEGMENTS];            // Generic phase (Scanner, Larson, etc.)
    static float _segBreatheAngle[NUM_SEGMENTS];     // Breathe sine angle
    static float _segCometPos[NUM_SEGMENTS];         // Chase/Meteor position
    static float _segMeteorPos[NUM_SEGMENTS];        // Meteor head position

    // Per-pixel state arrays
    static uint8_t _segFireHeat[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP];
    static uint8_t _segTwinkleState[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP];
    static uint8_t _segTwinkleFade[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP];

    // Per-segment PRNG
    static uint16_t _segRandom[NUM_SEGMENTS];

    // Shared desk effects
    static float _segElevatorPhase;
    static float _segCascadeLayer;

    // Transition crossfade
    static RgbwColor _prevFrame[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP];
    static uint8_t _segPrevFx[NUM_SEGMENTS];
    static uint8_t _segTransAlpha[NUM_SEGMENTS];
    // Per-segment decay step, LATCHED when the fade is armed. Without this, step was
    // recomputed from the live global gState.transition every frame, so a write landing
    // mid-fade silently re-timed a fade already in flight.
    static uint8_t _segTransStep[NUM_SEGMENTS];

    // Color/palette/power change tracking for crossfade triggers
    static uint8_t _segPrevCol[NUM_SEGMENTS][3][4];  // Previous segment colors
    static uint8_t _segPrevPal[NUM_SEGMENTS];         // Previous palette ID
    static uint64_t _segPrevUpal[NUM_SEGMENTS];       // Previous user-slot identity (0 = built-in/empty)
    static uint32_t _upalGenSeen;                     // gState.upalGen last copied into PaletteEngine
    static bool    _segPrevOn[NUM_SEGMENTS];           // Previous on/off state

    // Brightness transition state (parallel to effect transition)
    static uint8_t _segPrevEffBri[NUM_SEGMENTS];   // previous effective brightness
    static uint8_t _segTargetEffBri[NUM_SEGMENTS];  // target effective brightness
    static uint8_t _segBriAlpha[NUM_SEGMENTS];      // >0 = transition active (boolean flag)

    // Linear brightness interpolation state (replaces alpha-lerp8 approach)
    static float _segBriFloat[NUM_SEGMENTS];    // current interpolated bri (float)
    static float _segBriStep[NUM_SEGMENTS];     // constant per-frame step

    // Keyboard composite state (preserved from Phase 3)
    static float _cometPos[NUM_SEGMENTS];
    static unsigned long _lastCometUpdate;

    // ═══════════════════════════════════════════════════════
    // Utility Functions
    // ═══════════════════════════════════════════════════════

    // F3: real ease (was a `return t;` identity stub). Smooth accel/decel for the
    // keyboard-composite comet effects that route through easedT.
    static float easeInOutSine(float t) { return 0.5f * (1.0f - cosf(t * (float)M_PI)); }

    static int calculateLayerBrightness(float phase, int layerIndex) {
        float distance = abs((float)layerIndex - phase);
        if (distance < 1.25f) {
            return (int)(255.0f * 0.5f * (1.0f + cos(distance * M_PI / 1.25f)));
        }
        return 0;
    }

    static uint16_t xorshift16(uint16_t& state) {
        if (state == 0) state = 1;
        state ^= state << 7;
        state ^= state >> 9;
        state ^= state << 8;
        return state;
    }

    static inline uint8_t lerp8(uint8_t a, uint8_t b, uint8_t frac) {
        return a + (((int16_t)(b - a) * frac) >> 8);
    }

public:
    // Music-FX ID check — the range is NON-contiguous: classic 28-33 + layer
    // 37-40, with movement FX 34-36 in the gap (must never match). Mirrors Go
    // services.IsMusicFxID; keep the two in lockstep.
    static inline bool isMusicFx(uint8_t fx) {
        return (fx >= 28 && fx <= 33) || (fx >= FX_MUSIC_TOWER && fx <= FX_MUSIC_DROP);
    }

    // FX 41 AMBIENT. DELIBERATELY NOT isMusicFx(): a music FX sets musicFxActive, which lets beat-randomised reverse/mirror
    // override the segment's own and runs the HSV colour-burst wash over the final buffer; both would corrupt a
    // picture-faithful render. It takes only the 16 ms render gate, explicitly (ambientFxActive, read by main.cpp).
    // Mirrors Go services.IsAmbientFX / ergoled.IsAmbientFX.
    static inline bool isAmbientFx(uint8_t fx) { return fx == FX_AMBIENT; }
    // ambient/Ambient.hpp keeps its own copy of STRIP_LAYER. One return expression: the firmware builds as C++11.
    static constexpr bool ambientLayersMatch() {
        return Ambient::kLayer[0] == STRIP_LAYER[0] && Ambient::kLayer[1] == STRIP_LAYER[1] &&
               Ambient::kLayer[2] == STRIP_LAYER[2] && Ambient::kLayer[3] == STRIP_LAYER[3] &&
               Ambient::kLayer[4] == STRIP_LAYER[4] && Ambient::kLayer[5] == STRIP_LAYER[5] &&
               Ambient::kLayer[6] == STRIP_LAYER[6] && Ambient::kLayer[7] == STRIP_LAYER[7];
    }
    static volatile bool ambientFxActive;       // FX 41 live on any segment (set under the snapshot in renderFromState)
    static volatile uint32_t ambientDeficitMA;  // current the ambient power gain removed this frame (PowerLimiter::apply)

    // True while any segment is rendering a MUSIC FX (isMusicFx). Set under the
    // gState lock during renderFromState(); read by main.cpp to gate the 60 fps
    // render cadence (movement FX 34-36 must NOT inherit the music 60 fps rate).
    static volatile bool musicFxActive;
    static volatile bool breatheFxActive;   // FX 2 (breathe) live on any segment
    static volatile uint8_t renderIntervalMs; // set by main.cpp each frame; frame-stepped effects scale by it

    // Gate-2 feel: set true ONLY around the music-FX (28-33) render (see
    // renderFromState) so gamma correction applies to music dynamics but never to
    // status/safety/movement/solid effects — those stay linear, so safety-indicator
    // brightness is provably unaffected.
    static bool s_applyGamma;

    // True while the FX render of a strip that HueTrim covers runs: the gamma'd path AND a
    // non-identity table AND the strip's bit in the A/B mask (color/HueTrim.hpp). Set and cleared
    // with s_applyGamma, so indicators, safety cues, crossfades and overlays are never trimmed.
    static bool s_applyTrim;

    /**
     * setPixelRGBW - Abstracted pixel color setter using RGBW_ARG_INDEX_* macros.
     * All API-driven effects MUST use this instead of SetPixelColor directly.
     * Applies brightness scaling inline. Public for safety override rendering.
     */
    // Gate-2 feel: gamma 2.2 LUT, built once. On ESP32 flash is memory-mapped so a
    // plain static table needs no PROGMEM/pgm_read. Only consulted when s_applyGamma
    // is set (music FX), so it can never dim a status/safety indicator.
    static inline uint8_t gamma8(uint8_t v) {
        static uint8_t lut[256];
        static bool ready = false;
        if (!ready) {
            for (int i = 0; i < 256; i++) lut[i] = (uint8_t)(powf((float)i / 255.0f, 2.2f) * 255.0f + 0.5f);
            ready = true;
        }
        return lut[v];
    }

    static inline void setPixelRGBW(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
        uint16_t pixel, uint8_t r, uint8_t g, uint8_t b, uint8_t w, uint8_t bri
    ) {
        if (s_applyTrim) HueTrim::apply(r, g, b);  // on the picked colour, before bri and gamma
        uint8_t cr = ((uint16_t)r * bri) >> 8;
        uint8_t cg = ((uint16_t)g * bri) >> 8;
        uint8_t cb = ((uint16_t)b * bri) >> 8;
        uint8_t cw = ((uint16_t)w * bri) >> 8;
        if (s_applyGamma) { cr = gamma8(cr); cg = gamma8(cg); cb = gamma8(cb); cw = gamma8(cw); }
        uint8_t ch[4];
        ch[RGBW_ARG_INDEX_R] = cr;
        ch[RGBW_ARG_INDEX_G] = cg;
        ch[RGBW_ARG_INDEX_B] = cb;
        ch[RGBW_ARG_INDEX_W] = cw;
        strip->SetPixelColor(pixel, RgbwColor(ch[0], ch[1], ch[2], ch[3]));
    }

    // The music colour-burst wash of one pixel: each logical channel eases toward (br,bg,bb) by amt
    // and white eases to 0 so the colour reads. RgbwColor's fields are in WIRE order (config.h
    // RGBW_ARG_INDEX_*: its .G holds white, .B green, .W blue on the WS2814), so the channels are
    // reached through the macros. The earlier inline version wrote c.R/.G/.B/.W by name: the burst
    // tinted the white die with the burst's green, the green die with its blue, and dropped BLUE.
    static inline RgbwColor burstWash(RgbwColor c, uint8_t br, uint8_t bg, uint8_t bb, uint8_t amt) {
        uint8_t ch[4] = {c.R, c.G, c.B, c.W};
        ch[RGBW_ARG_INDEX_R] = lerp8(ch[RGBW_ARG_INDEX_R], br, amt);
        ch[RGBW_ARG_INDEX_G] = lerp8(ch[RGBW_ARG_INDEX_G], bg, amt);
        ch[RGBW_ARG_INDEX_B] = lerp8(ch[RGBW_ARG_INDEX_B], bb, amt);
        ch[RGBW_ARG_INDEX_W] = lerp8(ch[RGBW_ARG_INDEX_W], 0, amt);
        return RgbwColor(ch[0], ch[1], ch[2], ch[3]);
    }

    static inline void setPixelBlack(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
        uint16_t pixel
    ) {
        strip->SetPixelColor(pixel, RgbwColor(0, 0, 0, 0));
    }

    // Public so the host tests (test/native_height_sync) can check it for every length.
    // Where pixel p sits in the Height Sync fill, 0..1: it is lit when this is <= the fill.
    //   bottom-up (ix < 128): pixel 0 first, the last pixel only at 100%.
    //   "center-out" (ix >= 128): despite the name, BOTH ENDS first, then inward to the middle
    //   (ends 0, middle 1). The middle is (len - 1) / 2, halfway between the first and last PIXEL,
    //   so p and len-1-p get bit-identical values (p - c and (len-1-p) - c are exact negatives).
    //   It was len / 2, half a pixel to the right, which lit the left end first and the right end
    //   only at ~14% on a 14-pixel strip (2026-09-25, Vico: "one side is dark").
    //   Both ends are 0, so at the lowest height both end pixels show (symmetric).
    static float heightSyncPixPct(uint16_t p, uint16_t len, bool centerOut) {
        if (!centerOut) {
            return (float)(p + 1) / (float)len;
        }
        if (len <= 1) {
            return 0.0f;  // a single pixel is both ends; avoids 0/0
        }
        const float center = (len - 1) / 2.0f;
        return 1.0f - fabs((float)p - center) / center;
    }

private:
    /**
     * Get effective pixel count for a strip (clamped to MAX_PIXELS_PER_STRIP).
     */
    static inline uint16_t getLen(uint8_t segIdx) {
        return min((uint16_t)STRIP_LENGTHS[segIdx], (uint16_t)MAX_PIXELS_PER_STRIP);
    }

    // ═══════════════════════════════════════════════════════
    // Post-Processing: Reverse + Mirror
    // ═══════════════════════════════════════════════════════

    static void applyReverse(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip, uint16_t len) {
        for (uint16_t i = 0; i < len / 2; i++) {
            RgbwColor a = strip->GetPixelColor(i);
            RgbwColor b = strip->GetPixelColor(len - 1 - i);
            strip->SetPixelColor(i, b);
            strip->SetPixelColor(len - 1 - i, a);
        }
    }

    static void applyMirror(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip, uint16_t len) {
        uint16_t half = (len + 1) / 2;
        for (uint16_t p = 0; p < half; p++) {
            uint16_t mirrorP = len - 1 - p;
            if (mirrorP != p) {
                strip->SetPixelColor(mirrorP, strip->GetPixelColor(p));
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 0: Solid — Palette color applied uniformly
    // ═══════════════════════════════════════════════════════
    static void fxSolid(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                         uint8_t si, const SegmentState& seg, uint8_t bri) {
        // A USER palette (22-29) is painted ALONG the strip: pixel p samples the centre of its
        // equal share of the palette, UserPalette::pixelPosition. That is how a designed palette
        // becomes sections on the desk, and the app's preview is pinned to the same formula.
        // Built-in palettes keep Solid's one colour, sampled at position 0, below — unchanged.
        if (PaletteEngine::isUserPalette(seg.pal)) {
            uint16_t len = getLen(si);
            for (uint16_t p = 0; p < len; p++) {
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, UserPalette::pixelPosition(p, len), seg,
                                                r, g, b, w);
                setPixelRGBW(strip, p, r, g, b, w, bri);
            }
            return;
        }
        uint8_t r, g, b, w;
        PaletteEngine::colorFromPalette(seg.pal, 0, seg, r, g, b, w);
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) {
            setPixelRGBW(strip, p, r, g, b, w, bri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 1: Blink — On/off cycling
    // sx=rate (higher=faster), ix=duty cycle (higher=more on-time)
    // ═══════════════════════════════════════════════════════
    static void fxBlink(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                         uint8_t si, const SegmentState& seg, uint8_t bri) {
        float rate = 0.01f + (seg.sx / 255.0f) * 0.09f;
        _segPhase[si] += rate;
        if (_segPhase[si] > 1.0f) _segPhase[si] -= 1.0f;

        float duty = seg.ix / 255.0f;
        bool on = (_segPhase[si] < duty);
        uint16_t len = getLen(si);

        if (on) {
            uint8_t r = seg.col[0][0], g = seg.col[0][1], b = seg.col[0][2], w = seg.col[0][3];
            for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, bri);
        } else {
            for (uint16_t p = 0; p < len; p++) setPixelBlack(strip, p);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 2: Breathe — Sine-wave pulse with palette
    // sx=speed, ix=floor brightness
    // ═══════════════════════════════════════════════════════
    static void fxBreathe(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                           uint8_t si, const SegmentState& seg, uint8_t bri) {
        float speedF = 0.02f + (seg.sx / 255.0f) * 0.08f;
        speedF *= (float)renderIntervalMs / 33.0f;   // breathe is frame-stepped: same speed at 16 ms as at 33 ms
#if ERGOLED_BREATHE_SHAPE == 1
        // V at the bottom, round at the top (Vico 2026-10-01, "option 2"): a sine lingers at its dimmest
        // point, where 8-bit + gamma leave only a few real levels, so the steps show. sin(a/2) over the
        // same 0..2pi angle keeps the period and the depth but crosses the dim levels quickly, as a fade does.
        float pulse = sinf(_segBreatheAngle[si] * 0.5f);
#else
        float pulse = (sin(_segBreatheAngle[si]) + 1.0f) / 2.0f;
#endif
        uint8_t floor = seg.ix / 4; // 0-63
        uint8_t pulseBri = floor + (uint8_t)(pulse * (bri - floor));
        if (pulseBri > bri) pulseBri = bri;

        uint8_t r, g, b, w;
        PaletteEngine::colorFromPalette(seg.pal, 128, seg, r, g, b, w);
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, pulseBri);

        _segBreatheAngle[si] += speedF;
        if (_segBreatheAngle[si] > 6.28318f) _segBreatheAngle[si] -= 6.28318f;
    }

    // ═══════════════════════════════════════════════════════
    // FX 3: Fade — Crossfade between seg.col[0] and seg.col[1]
    // sx=speed
    // ═══════════════════════════════════════════════════════
    static void fxFade(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                        uint8_t si, const SegmentState& seg, uint8_t bri) {
        float speedF = 0.01f + (seg.sx / 255.0f) * 0.06f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 6.28318f) _segPhase[si] -= 6.28318f;

        uint8_t frac = (uint8_t)(((sin(_segPhase[si]) + 1.0f) / 2.0f) * 255);
        uint8_t r = lerp8(seg.col[0][0], seg.col[1][0], frac);
        uint8_t g = lerp8(seg.col[0][1], seg.col[1][1], frac);
        uint8_t b = lerp8(seg.col[0][2], seg.col[1][2], frac);
        uint8_t w = lerp8(seg.col[0][3], seg.col[1][3], frac);

        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, bri);
    }

    // ═══════════════════════════════════════════════════════
    // FX 4: Chase — Comet with exponential tail + palette
    // sx=speed, ix=tail length
    // ═══════════════════════════════════════════════════════
    static void fxChase(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                         uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.1f + (seg.sx / 255.0f) * 0.5f;
        speedF *= (float)renderIntervalMs / 33.0f;   // chase is frame-stepped: same speed at 16 ms as at 33 ms
        int maxTail = 2 + (seg.ix * (min((int)len, 14) - 2)) / 255;

        float pos = _segCometPos[si];
        int headPos = (int)(pos * len) % len;

        for (uint16_t p = 0; p < len; p++) {
            int tailDist = (headPos - (int)p + len) % len;
            if (tailDist < maxTail && tailDist < MAX_PIXELS_PER_STRIP) {
                uint8_t brightness = COMET_TAIL_LUT[tailDist];
                uint8_t palPos = (uint8_t)((p * 255) / len);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                uint8_t pixBri = ((uint16_t)brightness * bri) >> 8;
                setPixelRGBW(strip, p, r, g, b, w, pixBri);
            } else {
                setPixelBlack(strip, p);
            }
        }

        _segCometPos[si] += speedF / (float)len;
        if (_segCometPos[si] >= 1.0f) _segCometPos[si] -= 1.0f;
    }

    // ═══════════════════════════════════════════════════════
    // FX 5: Scanner — Back-and-forth sweeping point
    // sx=speed, ix=trail width
    // ═══════════════════════════════════════════════════════
    static void fxScanner(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                           uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.02f + (seg.sx / 255.0f) * 0.08f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 6.28318f) _segPhase[si] -= 6.28318f;

        float scanPos = ((sin(_segPhase[si]) + 1.0f) / 2.0f) * (len - 1);
        int trail = 1 + (seg.ix * 4) / 255;

        for (uint16_t p = 0; p < len; p++) {
            float dist = fabs((float)p - scanPos);
            if (dist < trail) {
                uint8_t fade = 255 - (uint8_t)(dist * 255 / trail);
                uint8_t palPos = (uint8_t)((p * 255) / len);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                uint8_t pixBri = ((uint16_t)fade * bri) >> 8;
                setPixelRGBW(strip, p, r, g, b, w, pixBri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 6: Meteor — Falling with random sparkle decay
    // sx=speed, ix=decay rate
    // ═══════════════════════════════════════════════════════
    static void fxMeteor(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                          uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.15f + (seg.sx / 255.0f) * 0.6f;
        uint8_t decay = 40 + (seg.ix * 180) / 255;

        // Random decay on existing pixels
        for (uint16_t p = 0; p < len; p++) {
            if ((xorshift16(_segRandom[si]) & 0x03) < 2) { // ~50% chance
                RgbwColor c = strip->GetPixelColor(p);
                c.R = (c.R > decay) ? c.R - decay : 0;
                c.G = (c.G > decay) ? c.G - decay : 0;
                c.B = (c.B > decay) ? c.B - decay : 0;
                c.W = (c.W > decay) ? c.W - decay : 0;
                strip->SetPixelColor(p, c);
            }
        }

        // Draw meteor head
        int headPos = (int)(_segMeteorPos[si] * len) % len;
        int meteorSize = 3;
        for (int j = 0; j < meteorSize; j++) {
            int pixel = headPos - j;
            if (pixel >= 0 && pixel < (int)len) {
                uint8_t palPos = (uint8_t)((pixel * 255) / len);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                setPixelRGBW(strip, pixel, r, g, b, w, bri);
            }
        }

        _segMeteorPos[si] += speedF / (float)len;
        if (_segMeteorPos[si] >= 1.0f) _segMeteorPos[si] -= 1.0f;
    }

    // ═══════════════════════════════════════════════════════
    // FX 7: Meteor Smooth — Linear decay tail (no random)
    // sx=speed, ix=smoothing factor
    // ═══════════════════════════════════════════════════════
    static void fxMeteorSmooth(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                                uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.1f + (seg.sx / 255.0f) * 0.5f;
        int tailLen = 3 + (seg.ix * (len - 3)) / 255;
        if (tailLen > (int)len) tailLen = len;

        int headPos = (int)(_segMeteorPos[si] * len) % len;

        for (uint16_t p = 0; p < len; p++) {
            int dist = ((int)headPos - (int)p + len) % len;
            if (dist < tailLen) {
                uint8_t fade = 255 - (uint8_t)((dist * 255) / tailLen);
                uint8_t palPos = (uint8_t)((p * 255) / len);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                uint8_t pixBri = ((uint16_t)fade * bri) >> 8;
                setPixelRGBW(strip, p, r, g, b, w, pixBri);
            } else {
                setPixelBlack(strip, p);
            }
        }

        _segMeteorPos[si] += speedF / (float)len;
        if (_segMeteorPos[si] >= 1.0f) _segMeteorPos[si] -= 1.0f;
    }

    // ═══════════════════════════════════════════════════════
    // FX 8: Running — Moving blocks of palette color
    // sx=speed, ix=block width
    // ═══════════════════════════════════════════════════════
    static void fxRunning(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                           uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.02f + (seg.sx / 255.0f) * 0.08f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 256.0f) _segPhase[si] -= 256.0f;

        int width = 2 + (seg.ix * 6) / 255;

        for (uint16_t p = 0; p < len; p++) {
            int offset = ((int)(p + _segPhase[si]) / width) % 2;
            if (offset == 0) {
                uint8_t palPos = (uint8_t)(((int)(p + _segPhase[si]) * 16) % 256);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                setPixelRGBW(strip, p, r, g, b, w, bri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 9: Larson — Smooth scanner with bloom/tail
    // sx=speed, ix=bloom width
    // ═══════════════════════════════════════════════════════
    static void fxLarson(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                          uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.015f + (seg.sx / 255.0f) * 0.06f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 6.28318f) _segPhase[si] -= 6.28318f;

        float scanPos = ((sin(_segPhase[si]) + 1.0f) / 2.0f) * (len - 1);
        float bloom = 0.5f + (seg.ix / 255.0f) * 3.5f;

        for (uint16_t p = 0; p < len; p++) {
            float dist = fabs((float)p - scanPos);
            if (dist < bloom + 1.0f) {
                float intensity;
                if (dist <= 0.5f) {
                    intensity = 1.0f;
                } else {
                    intensity = max(0.0f, 1.0f - ((dist - 0.5f) / bloom));
                    intensity = intensity * intensity; // Quadratic falloff
                }
                uint8_t palPos = (uint8_t)((p * 255) / len);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                uint8_t pixBri = (uint8_t)(intensity * bri);
                setPixelRGBW(strip, p, r, g, b, w, pixBri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 10: Twinkle — Random pixels flash then fade
    // sx=flash rate, ix=count
    // ═══════════════════════════════════════════════════════
    static void fxTwinkle(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                           uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        uint8_t spawnRate = 1 + seg.sx / 64;  // 1-4 spawns per frame
        uint8_t fadeSpeed = 4 + (255 - seg.ix) / 8;

        // Fade existing twinkles
        for (uint16_t p = 0; p < len; p++) {
            if (_segTwinkleState[si][p] > fadeSpeed) {
                _segTwinkleState[si][p] -= fadeSpeed;
            } else {
                _segTwinkleState[si][p] = 0;
            }
        }

        // Spawn new twinkles
        for (uint8_t s = 0; s < spawnRate; s++) {
            uint16_t pos = xorshift16(_segRandom[si]) % len;
            _segTwinkleState[si][pos] = 255;
        }

        // Render
        for (uint16_t p = 0; p < len; p++) {
            if (_segTwinkleState[si][p] > 0) {
                uint8_t palPos = (uint8_t)((p * 255) / len);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                uint8_t pixBri = ((uint16_t)_segTwinkleState[si][p] * bri) >> 8;
                setPixelRGBW(strip, p, r, g, b, w, pixBri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 11: Color Twinkles — Palette-colored random flash
    // sx=fade speed, ix=density
    // ═══════════════════════════════════════════════════════
    static void fxColorTwinkles(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                                 uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        uint8_t fadeSpeed = 2 + seg.sx / 16;
        uint8_t density = 1 + seg.ix / 64;

        // Fade
        for (uint16_t p = 0; p < len; p++) {
            if (_segTwinkleState[si][p] > fadeSpeed) {
                _segTwinkleState[si][p] -= fadeSpeed;
            } else {
                _segTwinkleState[si][p] = 0;
            }
        }

        // Spawn with random palette position
        for (uint8_t s = 0; s < density; s++) {
            uint16_t pos = xorshift16(_segRandom[si]) % len;
            if (_segTwinkleState[si][pos] == 0) {
                _segTwinkleState[si][pos] = 255;
                _segTwinkleFade[si][pos] = xorshift16(_segRandom[si]) & 0xFF; // Random palette pos
            }
        }

        for (uint16_t p = 0; p < len; p++) {
            if (_segTwinkleState[si][p] > 0) {
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, _segTwinkleFade[si][p], seg, r, g, b, w);
                uint8_t pixBri = ((uint16_t)_segTwinkleState[si][p] * bri) >> 8;
                setPixelRGBW(strip, p, r, g, b, w, pixBri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 12: Sparkle — Random single bright pixel overlay
    // sx=rate
    // ═══════════════════════════════════════════════════════
    static void fxSparkle(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                           uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);

        // Base: dim solid color
        uint8_t baseBri = bri / 4;
        for (uint16_t p = 0; p < len; p++) {
            setPixelRGBW(strip, p, seg.col[0][0], seg.col[0][1],
                         seg.col[0][2], seg.col[0][3], baseBri);
        }

        // Sparkle: random pixel at full brightness
        uint8_t numSparks = 1 + seg.sx / 128;
        for (uint8_t s = 0; s < numSparks; s++) {
            uint16_t pos = xorshift16(_segRandom[si]) % len;
            setPixelRGBW(strip, pos, 255, 255, 255, 255, bri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 13: Twinklefox — Multiple concurrent smooth twinkles
    // sx=speed, ix=density
    // ═══════════════════════════════════════════════════════
    static void fxTwinklefox(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                              uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 1.0f + (seg.sx / 255.0f) * 4.0f;
        uint8_t density = 1 + seg.ix / 32;

        _segPhase[si] += speedF * 0.01f;

        for (uint16_t p = 0; p < len; p++) {
            // Pseudo-random per-pixel phase based on position
            float pixPhase = _segPhase[si] + (float)(p * 7 + si * 13) * 0.73f;
            float twinkle = (sin(pixPhase) + 1.0f) / 2.0f;
            twinkle = twinkle * twinkle * twinkle; // Sharp peaks

            if (twinkle > (1.0f - density * 0.1f)) {
                float normalized = (twinkle - (1.0f - density * 0.1f)) / (density * 0.1f);
                uint8_t palPos = (uint8_t)((p * 255) / len);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                uint8_t pixBri = (uint8_t)(normalized * bri);
                setPixelRGBW(strip, p, r, g, b, w, pixBri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 14: Colorloop — Hue cycling (own hue, no palette)
    // sx=speed, ix=saturation
    // ═══════════════════════════════════════════════════════
    static void fxColorloop(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                             uint8_t si, const SegmentState& seg, uint8_t bri) {
        float speedF = 0.2f + (seg.sx / 255.0f) * 2.0f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 360.0f) _segPhase[si] -= 360.0f;

        float hue = _segPhase[si];
        float sat = 0.5f + (seg.ix / 255.0f) * 0.5f;

        // HSV to RGB
        float c = sat;
        float x = c * (1.0f - fabs(fmod(hue / 60.0f, 2.0f) - 1.0f));
        float r1, g1, b1;
        if (hue < 60)       { r1 = c; g1 = x; b1 = 0; }
        else if (hue < 120) { r1 = x; g1 = c; b1 = 0; }
        else if (hue < 180) { r1 = 0; g1 = c; b1 = x; }
        else if (hue < 240) { r1 = 0; g1 = x; b1 = c; }
        else if (hue < 300) { r1 = x; g1 = 0; b1 = c; }
        else                { r1 = c; g1 = 0; b1 = x; }

        uint8_t r = (uint8_t)(r1 * 255), g = (uint8_t)(g1 * 255), b = (uint8_t)(b1 * 255);
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, 0, bri);
    }

    // ═══════════════════════════════════════════════════════
    // FX 15: Rainbow — Moving rainbow across strip
    // sx=speed, ix=spread
    // ═══════════════════════════════════════════════════════
    static void fxRainbow(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                           uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.5f + (seg.sx / 255.0f) * 3.0f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 360.0f) _segPhase[si] -= 360.0f;

        float spread = 1.0f + (seg.ix / 255.0f) * 3.0f;

        for (uint16_t p = 0; p < len; p++) {
            float hue = fmod(_segPhase[si] + (float)p * spread * 360.0f / len, 360.0f);
            float c = 1.0f;
            float x = c * (1.0f - fabs(fmod(hue / 60.0f, 2.0f) - 1.0f));
            float r1, g1, b1;
            if (hue < 60)       { r1 = c; g1 = x; b1 = 0; }
            else if (hue < 120) { r1 = x; g1 = c; b1 = 0; }
            else if (hue < 180) { r1 = 0; g1 = c; b1 = x; }
            else if (hue < 240) { r1 = 0; g1 = x; b1 = c; }
            else if (hue < 300) { r1 = x; g1 = 0; b1 = c; }
            else                { r1 = c; g1 = 0; b1 = x; }

            setPixelRGBW(strip, p, (uint8_t)(r1 * 255), (uint8_t)(g1 * 255),
                         (uint8_t)(b1 * 255), 0, bri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 16: Palette Run — Scroll palette across strip
    // sx=speed, ix=scale
    // ═══════════════════════════════════════════════════════
    static void fxPaletteRun(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                              uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.5f + (seg.sx / 255.0f) * 4.0f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 256.0f) _segPhase[si] -= 256.0f;

        float scale = 0.5f + (seg.ix / 255.0f) * 3.0f;

        for (uint16_t p = 0; p < len; p++) {
            uint8_t palPos = (uint8_t)(fmod(_segPhase[si] + p * scale * 256.0f / len, 256.0f));
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
            setPixelRGBW(strip, p, r, g, b, w, bri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 17: Gradient — Smooth blend between seg colors
    // sx=speed (animation), ix=spread
    // ═══════════════════════════════════════════════════════
    static void fxGradient(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                            uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.01f + (seg.sx / 255.0f) * 0.04f;
        _segPhase[si] += speedF;
        if (_segPhase[si] > 1.0f) _segPhase[si] -= 1.0f;

        for (uint16_t p = 0; p < len; p++) {
            float t = (float)p / (float)(len - 1);
            t = fmod(t + _segPhase[si], 1.0f);
            uint8_t frac = (uint8_t)(t * 255);
            uint8_t r = lerp8(seg.col[0][0], seg.col[1][0], frac);
            uint8_t g = lerp8(seg.col[0][1], seg.col[1][1], frac);
            uint8_t b = lerp8(seg.col[0][2], seg.col[1][2], frac);
            uint8_t w = lerp8(seg.col[0][3], seg.col[1][3], frac);
            setPixelRGBW(strip, p, r, g, b, w, bri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 18: Fire 2012 — Heat simulation
    // sx=cooling, ix=sparking
    // ═══════════════════════════════════════════════════════
    static void fxFire(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                        uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        uint8_t cooling = 20 + (seg.sx * 40) / 255;
        uint8_t sparking = 50 + (seg.ix * 150) / 255;

        // Cool down
        for (uint16_t p = 0; p < len; p++) {
            uint8_t cooldown = (xorshift16(_segRandom[si]) % (cooling * 10 / len + 2));
            _segFireHeat[si][p] = (_segFireHeat[si][p] > cooldown) ?
                                   _segFireHeat[si][p] - cooldown : 0;
        }

        // Heat drift upward
        for (int p = len - 1; p >= 2; p--) {
            _segFireHeat[si][p] = (_segFireHeat[si][p - 1] +
                                    _segFireHeat[si][p - 2] +
                                    _segFireHeat[si][p - 2]) / 3;
        }

        // Ignite sparks
        if ((xorshift16(_segRandom[si]) & 0xFF) < sparking) {
            uint16_t y = xorshift16(_segRandom[si]) % min((uint16_t)3, len);
            uint8_t newHeat = _segFireHeat[si][y] + 160 + (xorshift16(_segRandom[si]) & 0x3F);
            if (newHeat > 255) newHeat = 255;
            _segFireHeat[si][y] = newHeat;
        }

        // Render heat to color via palette
        for (uint16_t p = 0; p < len; p++) {
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, _segFireHeat[si][p], seg, r, g, b, w);
            uint8_t pixBri = ((uint16_t)_segFireHeat[si][p] * bri) >> 8;
            setPixelRGBW(strip, p, r, g, b, w, pixBri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 19: Aurora — Drifting colored bands
    // sx=drift speed, ix=band width
    // ═══════════════════════════════════════════════════════
    static void fxAurora(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                          uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float driftSpeed = 0.005f + (seg.sx / 255.0f) * 0.03f;
        float bandWidth = 2.0f + (seg.ix / 255.0f) * 6.0f;
        _segPhase[si] += driftSpeed;

        for (uint16_t p = 0; p < len; p++) {
            float pos = (float)p / len;
            float wave1 = sin((pos * 4.0f + _segPhase[si]) * 6.28318f) * 0.5f + 0.5f;
            float wave2 = sin((pos * 2.7f + _segPhase[si] * 1.3f) * 6.28318f) * 0.5f + 0.5f;
            float combined = (wave1 + wave2) / 2.0f;
            combined = combined * combined; // Sharpen

            uint8_t palPos = (uint8_t)(fmod(pos * bandWidth + _segPhase[si] * 2, 1.0f) * 255);
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
            uint8_t pixBri = (uint8_t)(combined * bri);
            setPixelRGBW(strip, p, r, g, b, w, pixBri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 20: Pacifica — Ocean wave simulation
    // sx=speed, ix=turbulence
    // ═══════════════════════════════════════════════════════
    static void fxPacifica(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                            uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedF = 0.003f + (seg.sx / 255.0f) * 0.015f;
        float turbulence = 0.5f + (seg.ix / 255.0f) * 2.5f;
        _segPhase[si] += speedF;

        for (uint16_t p = 0; p < len; p++) {
            float pos = (float)p / len;
            float wave1 = sin((pos * 3.0f + _segPhase[si]) * 6.28318f);
            float wave2 = sin((pos * 5.0f - _segPhase[si] * 1.5f) * 6.28318f);
            float wave3 = sin((pos * 7.0f + _segPhase[si] * 0.7f) * 6.28318f * turbulence);
            float combined = (wave1 + wave2 * 0.5f + wave3 * 0.3f) / 1.8f;
            combined = (combined + 1.0f) / 2.0f;

            uint8_t palPos = (uint8_t)(combined * 255);
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
            uint8_t pixBri = (uint8_t)(combined * bri * 0.7f + bri * 0.3f);
            setPixelRGBW(strip, p, r, g, b, w, pixBri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 21: Candle — Flickering flame
    // sx=flicker speed, ix=range
    // ═══════════════════════════════════════════════════════
    static void fxCandle(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                          uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        uint8_t range = 40 + (seg.ix * 160) / 255;

        for (uint16_t p = 0; p < len; p++) {
            // Per-pixel target and current for smooth flicker
            uint8_t target = bri - (xorshift16(_segRandom[si]) % range);
            // Smooth toward target
            uint8_t current = _segTwinkleState[si][p];
            if (current < target) {
                current += min((uint8_t)8, (uint8_t)(target - current));
            } else if (current > target) {
                current -= min((uint8_t)4, (uint8_t)(current - target));
            }
            _segTwinkleState[si][p] = current;

            uint8_t palPos = (uint8_t)((p * 128) / len + 64);
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
            setPixelRGBW(strip, p, r, g, b, w, current);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 22: Strobe — Rapid on/off
    // sx=rate, ix=gap duration
    // ═══════════════════════════════════════════════════════
    static void fxStrobe(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                          uint8_t si, const SegmentState& seg, uint8_t bri) {
        float rate = 0.03f + (seg.sx / 255.0f) * 0.15f;
        _segPhase[si] += rate;
        if (_segPhase[si] > 1.0f) _segPhase[si] -= 1.0f;

        float onDuration = 0.05f + (1.0f - seg.ix / 255.0f) * 0.2f;
        bool on = (_segPhase[si] < onDuration);
        uint16_t len = getLen(si);

        if (on) {
            for (uint16_t p = 0; p < len; p++) {
                setPixelRGBW(strip, p, seg.col[0][0], seg.col[0][1],
                             seg.col[0][2], seg.col[0][3], bri);
            }
        } else {
            for (uint16_t p = 0; p < len; p++) setPixelBlack(strip, p);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 23: Heartbeat — Double-bump pattern
    // sx=BPM, ix=intensity
    // ═══════════════════════════════════════════════════════
    static void fxHeartbeat(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                             uint8_t si, const SegmentState& seg, uint8_t bri) {
        float bpm = 40.0f + (seg.sx / 255.0f) * 120.0f; // 40-160 BPM
        float rate = bpm / 60.0f / 30.0f; // per frame at 30 FPS
        _segPhase[si] += rate;
        if (_segPhase[si] > 1.0f) _segPhase[si] -= 1.0f;

        float t = _segPhase[si];
        float pulse = 0;
        // First bump at t=0.0-0.15
        if (t < 0.15f) pulse = sin(t / 0.15f * 3.14159f);
        // Second bump at t=0.2-0.35
        else if (t > 0.2f && t < 0.35f) pulse = sin((t - 0.2f) / 0.15f * 3.14159f) * 0.6f;

        float intensity = seg.ix / 255.0f;
        uint8_t pulseBri = (uint8_t)(pulse * intensity * bri);
        uint8_t baseBri = bri / 8;
        uint8_t finalBri = max(baseBri, pulseBri);

        uint8_t r, g, b, w;
        PaletteEngine::colorFromPalette(seg.pal, 128, seg, r, g, b, w);
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, finalBri);
    }

    // ═══════════════════════════════════════════════════════
    // FX 24: Fireworks — Random bursts
    // sx=frequency, ix=radius
    // ═══════════════════════════════════════════════════════
    static void fxFireworks(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                             uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        uint8_t fadeSpeed = 20;

        // Fade existing
        for (uint16_t p = 0; p < len; p++) {
            RgbwColor c = strip->GetPixelColor(p);
            c.R = (c.R > fadeSpeed) ? c.R - fadeSpeed : 0;
            c.G = (c.G > fadeSpeed) ? c.G - fadeSpeed : 0;
            c.B = (c.B > fadeSpeed) ? c.B - fadeSpeed : 0;
            c.W = (c.W > fadeSpeed) ? c.W - fadeSpeed : 0;
            strip->SetPixelColor(p, c);
        }

        // Spawn burst
        uint8_t spawnChance = 10 + seg.sx / 8;
        if ((xorshift16(_segRandom[si]) & 0xFF) < spawnChance) {
            uint16_t center = xorshift16(_segRandom[si]) % len;
            int radius = 1 + (seg.ix * 3) / 255;
            uint8_t palPos = xorshift16(_segRandom[si]) & 0xFF;
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);

            for (int j = -radius; j <= radius; j++) {
                int pixel = (int)center + j;
                if (pixel >= 0 && pixel < (int)len) {
                    uint8_t fade = 255 - (uint8_t)(abs(j) * 255 / (radius + 1));
                    uint8_t pixBri = ((uint16_t)fade * bri) >> 8;
                    setPixelRGBW(strip, pixel, r, g, b, w, pixBri);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 25: Elevator — Non-blocking 5-layer scanner
    // sx=speed, ix=beam width
    // ═══════════════════════════════════════════════════════
    static void fxElevator(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                            uint8_t si, const SegmentState& seg, uint8_t bri) {
        // Uses shared phase across all segments for coordinated layer scanning
        float speedF = 0.01f + (seg.sx / 255.0f) * 0.04f;
        _segElevatorPhase += speedF;
        if (_segElevatorPhase > 6.28318f) _segElevatorPhase -= 6.28318f;

        float scanPos = ((sin(_segElevatorPhase) + 1.0f) / 2.0f) * (NUM_LAYERS - 1);
        float beamWidth = 0.5f + (seg.ix / 255.0f) * 1.5f;

        // Find which layer this strip belongs to
        int myLayer = -1;
        for (int layer = 0; layer < NUM_LAYERS; layer++) {
            for (int j = 0; j < 3; j++) {
                if (LAYER_STRIPS[layer][j] == (int)si) {
                    myLayer = layer;
                    break;
                }
            }
            if (myLayer >= 0) break;
        }

        uint8_t layerBri = 0;
        if (myLayer >= 0) {
            float distance = fabs((float)myLayer - scanPos);
            if (distance < beamWidth) {
                float intensity = 0.5f * (1.0f + cos(distance * M_PI / beamWidth));
                layerBri = (uint8_t)(intensity * bri);
            }
        }

        uint8_t r, g, b, w;
        PaletteEngine::colorFromPalette(seg.pal, 128, seg, r, g, b, w);
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, layerBri);
    }

    // ═══════════════════════════════════════════════════════
    // FX 26: Cascade — Layer-by-layer fill
    // sx=speed, ix=hold time
    // ═══════════════════════════════════════════════════════
    static void fxCascade(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                           uint8_t si, const SegmentState& seg, uint8_t bri) {
        float speedF = 0.005f + (seg.sx / 255.0f) * 0.02f;
        _segCascadeLayer += speedF;
        float totalCycle = NUM_LAYERS * 2.0f; // Fill + empty
        if (_segCascadeLayer > totalCycle) _segCascadeLayer -= totalCycle;

        int myLayer = -1;
        for (int layer = 0; layer < NUM_LAYERS; layer++) {
            for (int j = 0; j < 3; j++) {
                if (LAYER_STRIPS[layer][j] == (int)si) {
                    myLayer = layer;
                    break;
                }
            }
            if (myLayer >= 0) break;
        }

        bool lit = false;
        if (myLayer >= 0) {
            float phase = _segCascadeLayer;
            if (phase < NUM_LAYERS) {
                lit = (myLayer <= (int)phase);
            } else {
                int emptyLayer = (int)(phase - NUM_LAYERS);
                lit = (myLayer > emptyLayer);
            }
        }

        uint16_t len = getLen(si);
        if (lit) {
            uint8_t palPos = (uint8_t)((myLayer * 255) / NUM_LAYERS);
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
            for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, bri);
        } else {
            for (uint16_t p = 0; p < len; p++) setPixelBlack(strip, p);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 27: Height Sync — Fill based on lift position
    // ix=fill style (0-127 = bottom-up, 128-255 = center-out)
    // ═══════════════════════════════════════════════════════
    static void fxHeightSync(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                              uint8_t si, const SegmentState& seg, uint8_t bri) {
        // Use actual lift position from Go API safety polling
        extern volatile uint8_t safetyLiftPct;
        uint8_t position = (safetyLiftPct * 255) / 100;
        uint16_t len = getLen(si);
        bool centerOut = (seg.ix >= 128);

        float fillPct = position / 255.0f;

        for (uint16_t p = 0; p < len; p++) {
            float pixPct = heightSyncPixPct(p, len, centerOut);

            if (pixPct <= fillPct) {
                uint8_t palPos = (uint8_t)(pixPct * 255);
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                setPixelRGBW(strip, p, r, g, b, w, bri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // Music Mode Audio Metrics Reader
    // Reads primitive volatile externs (same pattern as safetyLiftPct)
    // ═══════════════════════════════════════════════════════
    static float _smoothBands[8];

    // Color dynamics phase accumulator (Q8.8 — high byte = palette position 0-255),
    // advanced once per frame in renderFromState(); _prevBeat for beat rising-edge detect.
    static uint16_t _colorPhaseAccumQ;
    static bool     _prevBeat;

    // Color bursts overlay + beat-randomized reverse/mirror state (advanced once per frame
    // in renderFromState(); applied per-segment in the loop). All gated by burstEnable /
    // randomizeFlip so the classic look is untouched when both are 0.
    static uint8_t  _burstEnv;        // 0-255 envelope, decays each frame (the "pulse")
    static uint8_t  _burstHue;        // current burst hue (HSV 0-255)
    static uint8_t  _burstStep;       // 0..2 primary-cycle index
    static unsigned long _lastBurstMs;
    // Calm/hype sections (burstSection) + build/drop awareness (burstDropAware).
    static bool          _burstHype;      // true = bursts allowed; false = calm stretch
    static uint8_t       _burstGain;      // 0-255 slewed section gain (calm fades out/in, no pop)
    static unsigned long _burstSectMs;    // when the current section started
    static bool          _burstPrevDrop;  // drop flag edge detector
    static bool     _randRev, _randMi;   // current randomized reverse/mirror state
    static bool     _randFlipValid;      // false until the first beat-selected flip exists
    static unsigned long _lastFlipMs;

    // Music Mode 2.0 (layer FX) state — advanced once per frame in renderFromState.
    static unsigned long _lastStrobeFlashMs[NUM_SEGMENTS]; // comfortMode floor for FX 31
    static unsigned long _lastBeatMs;    // last raw beat rising edge (ripple fallback sweep)
    static bool     _prevBeatClock;      // independent edge tracker (never touches _prevBeat)
    static uint8_t  _dropState;          // FX 40: 0 idle, 1 building, 2 slam, 3 wash
    static unsigned long _dropSlamMs;    // last slam time (comfort floor + slam hold)
    static uint8_t  _dropWash;           // FX 40 wash level, decays after the slam

    // Snapshot the v2 (Music Mode 2.0) tempo/structure globals. Zeroed when the
    // feed is stale — a dead analyzer must not leave a stale tempo lock driving
    // phase-locked FX. packetVer survives staleness (it describes the source).
    static void readAudioExtras(uint8_t& bpm, uint8_t& beatPhase, uint8_t& barPos,
                                uint8_t& envelope, uint8_t& flags, uint8_t& packetVer) {
        MusicConfig cfg = gMusicConfig.getConfig();
        extern volatile uint8_t audioBpm, audioBeatPhase, audioBarPos,
                                audioEnvelope, audioFlags, audioPacketVer;
        extern volatile bool audioActive;
        extern volatile unsigned long audioLastUpdate;
        extern portMUX_TYPE audioMetricsMux;
        bool active;
        unsigned long last;
        portENTER_CRITICAL(&audioMetricsMux);
        bpm = audioBpm; beatPhase = audioBeatPhase; barPos = audioBarPos;
        envelope = audioEnvelope; flags = audioFlags; packetVer = audioPacketVer;
        active = audioActive; last = audioLastUpdate;
        portEXIT_CRITICAL(&audioMetricsMux);
        if (!active || (millis() - last > cfg.stalenessMs)) {
            bpm = 0; beatPhase = 0; barPos = 0; envelope = 0; flags = 0;
        }
    }

    // FX 40 shared state machine — advanced ONCE per frame (renderFromState music
    // block), rendered per-segment by fxMusicDrop. On v1 sources (no structure
    // flags) a hard bass slam at high energy stands in for the drop, sparsely
    // re-armed, so the effect still performs without the v2 analyzer.
    static void advanceDropState(const MusicConfig& cfg, uint8_t energy, bool bassBeat,
                                 uint8_t flags, uint8_t envelope, uint8_t packetVer) {
        unsigned long now = millis();
        bool dropFlag  = (flags & 0x02) != 0;
        bool buildFlag = (flags & 0x01) != 0;
        if (packetVer < 2 && bassBeat && energy > 200 && (now - _dropSlamMs) > 8000) {
            dropFlag = true;
        }
        // comfortMode: 350ms full-field flash floor (same as strobe/burst/randomize)
        uint16_t slamFloorMs = cfg.comfortMode ? 350 : 120;

        if (_dropState == 2) {
            if (now - _dropSlamMs >= 220) _dropState = 3;  // slam holds ~220ms → wash
        } else if (dropFlag && (now - _dropSlamMs) >= slamFloorMs) {
            _dropState = 2;
            _dropSlamMs = now;
            _dropWash = 255;
        } else if (buildFlag) {
            _dropState = 1;
        } else if (_dropState == 1) {
            _dropState = (_dropWash > 8) ? 3 : 0;          // build fizzled → wash or idle
        }

        if (_dropState == 3) {
            // Wash decay follows the loudness envelope: loud passages hold the wash,
            // fading music lets it die (~1-4s tail at 60fps).
            uint8_t decay = 2 + (uint8_t)((255 - envelope) >> 5);  // 2..9 per frame
            _dropWash = (_dropWash > decay) ? (uint8_t)(_dropWash - decay) : 0;
            if (_dropWash == 0) _dropState = 0;
        }
    }

    // musicColorPhase returns the per-strip palette-position offset added to a music
    // FX's palPos. Off-gate (all five color-dynamics knobs 0) returns 0 so the look is
    // byte-identical to before the feature. peakBand replaces the FX's built-in band
    // term (caller zeroes that when peakBandToHue>0). si clamped to 0-7.
    static uint8_t musicColorPhase(uint8_t si, const MusicConfig& cfg, uint8_t peakBand) {
        if (cfg.colorMotionSpeed == 0 && cfg.colorSpread == 0 && cfg.energyToMotion == 0 &&
            cfg.beatHueStep == 0 && cfg.peakBandToHue == 0) {
            return 0;
        }
        uint8_t s = si > 7 ? 7 : si;
        uint16_t v = (uint16_t)(_colorPhaseAccumQ >> 8)
                   + (uint16_t)(((uint16_t)s * cfg.colorSpread) / 7)
                   + (cfg.peakBandToHue ? (uint16_t)peakBand * cfg.peakBandToHue : 0);
        return (uint8_t)v; // defined unsigned-truncation wrap
    }

    // Integer HSV->RGB (classic 6-sector). Used by the burst overlay for vivid, palette-
    // independent flash colors (s=v=255 in practice). h/s/v are 0-255.
    static void hsvToRgb(uint8_t h, uint8_t s, uint8_t v, uint8_t& r, uint8_t& g, uint8_t& b) {
        if (s == 0) { r = g = b = v; return; }
        uint8_t region = h / 43;                 // 0..5
        uint8_t rem    = (uint8_t)((h - region * 43) * 6);  // 0..255 within sector
        uint8_t p = (uint8_t)((uint16_t)v * (255 - s) / 255);
        uint8_t q = (uint8_t)((uint16_t)v * (255 - ((uint16_t)s * rem) / 255) / 255);
        uint8_t t = (uint8_t)((uint16_t)v * (255 - ((uint16_t)s * (255 - rem)) / 255) / 255);
        switch (region) {
            case 0:  r = v; g = t; b = p; break;
            case 1:  r = q; g = v; b = p; break;
            case 2:  r = p; g = v; b = t; break;
            case 3:  r = p; g = q; b = v; break;
            case 4:  r = t; g = p; b = v; break;
            default: r = v; g = p; b = q; break;
        }
    }

    // Per-strip burst weight 0-255 from burstZone. 128=whole desk even; >128 emphasizes the
    // top (strips with low vertical position), <128 the bottom. A nonzero floor (minWeight)
    // keeps the opposite half alive at the extremes — top/bottom-weighted, not top/bottom-only.
    static uint8_t burstStripWeight(uint8_t si, uint8_t zone) {
        static const uint8_t STRIP_VPOS[8] = {0, 40, 40, 100, 170, 170, 170, 255}; // 0=top..255=bottom
        uint8_t v = STRIP_VPOS[si & 7];
        if (zone == 128) return 255;
        const uint8_t minWeight = 48;
        if (zone > 128) {                                   // emphasize top (low vpos)
            uint16_t strength = (uint16_t)(zone - 128) * 2; // 0..254
            uint16_t falloff  = ((uint16_t)v * strength) >> 8;
            uint16_t w = (falloff >= 255) ? 0 : (255 - falloff);
            return w < minWeight ? minWeight : (uint8_t)w;
        } else {                                            // emphasize bottom (high vpos)
            uint16_t strength = (uint16_t)(128 - zone) * 2; // 0..256
            uint16_t falloff  = ((uint16_t)(255 - v) * strength) >> 8;
            uint16_t w = (falloff >= 255) ? 0 : (255 - falloff);
            return w < minWeight ? minWeight : (uint8_t)w;
        }
    }

    // Advance the burst hue on each burst trigger. spectrum<128: cycle 3 primaries around a
    // dominant region (region base shifts with the slider) for the psychedelic "3 colors
    // pulse"; spectrum>=128: wide rainbow march. _burstStep uses %3 (no uint8-wrap double-fire).
    // Continuous across 127->128: the march starts at the primaries' own spacing (85) and gets
    // finer (24) as the slider rises, so the character no longer jumps between two modes.
    static void advanceBurstHue(uint8_t spectrum) {
        if (spectrum < 128) {
            uint8_t base = (uint8_t)(((uint16_t)spectrum * 170) / 127);  // dominant region 0..170
            _burstHue   = (uint8_t)(base + (uint16_t)_burstStep * 85);   // 3 primaries spaced 85
            _burstStep  = (uint8_t)((_burstStep + 1) % 3);
        } else {
            uint8_t step = (uint8_t)(85 - (((uint16_t)(spectrum - 128) * 61) / 127)); // 85..24
            _burstHue += step;                                          // wide march (uint8 wrap)
        }
    }

    // Burst period for burstRate (0 = beat-only is handled by the caller). Linear from 1500ms at
    // rate 1 down to the active floor at 255, so with comfortMode the whole slider is live
    // (the floor is 350ms, the same anti-flash floor the trigger enforces).
    static uint16_t burstPeriodMs(uint8_t rate, bool comfort) {
        const uint16_t minP = comfort ? 350 : 120;
        return (uint16_t)(1500 - (((uint32_t)(rate - 1) * (1500 - minP)) / 254));
    }

    // Per-frame multiplier for the burst wash from calm/hype sections, 0-255. burstSection==0
    // and burstDropAware==0 -> constant 255 (classic). Sections: hype for kHypeMs, then calm for
    // 2s..~43s (grows with burstSection); the gain slews ~1s so calm fades in/out. With
    // burstDropAware a build holds the bursts back (tension) and a drop snaps to hype for 12s.
    // Returns via *dropHit whether this frame is a drop rising edge (caller fires a full burst).
    static uint8_t advanceBurstSection(const MusicConfig& cfg, unsigned long now, uint8_t flags,
                                       bool* dropHit) {
        const unsigned long kHypeMs = 30000UL;
        const bool dropFlag  = (flags & 0x02) != 0;
        const bool buildFlag = (flags & 0x01) != 0;
        *dropHit = false;
        if (dropFlag && !_burstPrevDrop && cfg.burstDropAware) *dropHit = true;
        _burstPrevDrop = dropFlag;
        if (cfg.burstSection == 0 && !cfg.burstDropAware) {
            _burstHype = true; _burstGain = 255; _burstSectMs = now;
            return 255;
        }
        if (cfg.burstSection != 0) {
            unsigned long calmMs = 2000UL + (unsigned long)cfg.burstSection * 160UL;
            unsigned long span = now - _burstSectMs;
            if (_burstHype && span >= kHypeMs)      { _burstHype = false; _burstSectMs = now; }
            else if (!_burstHype && span >= calmMs) { _burstHype = true;  _burstSectMs = now; }
        }
        bool target = _burstHype;
        if (cfg.burstDropAware) {
            if (*dropHit) { _burstHype = true; _burstSectMs = now - (kHypeMs - 12000UL); }
            if (buildFlag) target = false;                         // hold back through a build
            if (*dropHit) target = true;
        }
        if (target) _burstGain = (_burstGain > 251) ? 255 : (uint8_t)(_burstGain + 4);
        else        _burstGain = (_burstGain < 4)   ? 0   : (uint8_t)(_burstGain - 4);
        return _burstGain;
    }

    static void readSmoothedAudio(uint8_t bands[8], uint8_t& vol, uint8_t& energy,
                                   bool& beat, bool& bassBeat, uint8_t& peak) {
        MusicConfig cfg = gMusicConfig.getConfig();

        extern volatile uint8_t audioBands[8];
        extern volatile uint8_t audioVolume, audioEnergy, audioBeat, audioBassBeat, audioPeakBand;
        extern volatile bool audioActive;
        extern volatile unsigned long audioLastUpdate;
        extern portMUX_TYPE audioMetricsMux;

        uint8_t snapBands[8];
        uint8_t snapVol, snapEnergy, snapBeat, snapBassBeat, snapPeak;
        bool snapActive;
        unsigned long snapLastUpdate;

        portENTER_CRITICAL(&audioMetricsMux);
        memcpy(snapBands, (const void*)audioBands, 8);
        snapVol = audioVolume; snapEnergy = audioEnergy;
        snapBeat = audioBeat; snapBassBeat = audioBassBeat;
        snapPeak = audioPeakBand;
        snapActive = audioActive; snapLastUpdate = audioLastUpdate;
        portEXIT_CRITICAL(&audioMetricsMux);

        if (!snapActive || (millis() - snapLastUpdate > cfg.stalenessMs)) {
            // FLICKER FIX (the real one — evidence: GET /json/blanklog captured fx=28,
            // no-transition, full-black frames). On a momentary audio-metrics gap >
            // stalenessMs, hard-zeroing the bands rendered an INSTANT all-black frame —
            // the Music Spectrum bar fill collapses to 0 px on every segment → the
            // "random blank" blink. Instead, RAMP the last smoothed bands down (~0.5s at
            // 60fps) so a brief transport stall dims smoothly and recovers when audio
            // resumes; only SUSTAINED silence fades fully dark. Shared by all 6 music FX
            // through readSmoothedAudio, so this one change fixes the blink everywhere.
            for (int i = 0; i < 8; i++) {
                _smoothBands[i] *= 0.90f;
                if (_smoothBands[i] < 1.0f) _smoothBands[i] = 0.0f;
                bands[i] = (uint8_t)_smoothBands[i];
            }
            vol = energy = peak = 0;
            beat = bassBeat = false;
            return;
        }
        for (int i = 0; i < 8; i++) {
            float alpha = (snapBands[i] > _smoothBands[i]) ? cfg.attackAlpha : cfg.decayAlpha;
            _smoothBands[i] = _smoothBands[i] * (1.0f - alpha) + (float)snapBands[i] * alpha;
            bands[i] = (uint8_t)_smoothBands[i];
        }
        vol = snapVol; energy = snapEnergy;
        beat = snapBeat; bassBeat = snapBassBeat;
        peak = snapPeak;
    }

    // ═══════════════════════════════════════════════════════
    // FX 28: Music Spectrum — Each segment brightness = frequency band energy
    // Pixels fill like a bar graph. Palette colors.
    // sx=reactivity: controls perceptual fill curve exponent
    //   Low sx (0): exponent=1.6, compressed response (gentle)
    //   High sx (255): exponent=0.4, punchy response (reactive)
    //   sx~191 reproduces prior hardcoded sqrtf behavior (exp≈0.5)
    // ix selects the band-map mode (driven by the app's "Band map" control):
    //   ix < 85         → bottom-up single side (band = 7-si, bass at footrest)
    //   85 <= ix < 171  → MIRRORED "both sides" — the SAME single-side band map
    //                      reflected across the desk center: top half (si 0-3) shows
    //                      bands 0-3, bottom half (si 4-7) mirrors it, so both halves
    //                      light up identically. Per-band bar dynamic is unchanged.
    //   ix >= 171       → top-down single side  (band = si, bass at shelf)
    // ═══════════════════════════════════════════════════════
    static void fxMusicSpectrum(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                                 uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();

        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);
        // Map segment index to frequency band. The mirrored mode reflects the same
        // band map onto both desk halves so the whole strip lights up symmetrically
        // (fixes "only one half illuminates"). Same per-band read as single-side —
        // just a folded segment index, so the dynamic/feel is identical.
        uint8_t bandIdx;
        if (seg.ix >= 85 && seg.ix < 171) {
            // Fold so the bottom half (si 4-7) mirrors the top half (si 0-3):
            // bandIdx = 0,1,2,3,3,2,1,0. Each half = bands 0-3, same as one side.
            bandIdx = (si < 4) ? si : (uint8_t)(7 - si);
        } else {
            // Single-side: bottom-up (bass at footrest) or top-down (bass at shelf).
            bandIdx = (seg.ix < 85) ? (uint8_t)(7 - si) : si;
        }
        if (bandIdx > 7) bandIdx = 7;
        uint8_t bandEnergy = bands[bandIdx];

        // sx controls reactivity exponent: range 1.6 (sx=0, compressed) to 0.4 (sx=255, punchy)
        // Low sx: exponent >1 compresses low energy → gentler response
        // High sx: exponent <1 expands low energy → punchier, more reactive to quiet audio
        // spectrumGamma scales the curve: default 0.5 → *2.0 = 1.0x (no change)
        //   gamma 1.0 → *2.0 = 2.0x exponent (gentler), gamma 0.25 → *2.0 = 0.5x (punchier)
        float exp = (1.6f - 1.2f * (seg.sx / 255.0f)) * (cfg.spectrumGamma * 2.0f);

        // Noise floor: ignore ALSA/ADC noise but react to any real audio
        uint16_t fillPixels;
        if (bandEnergy < cfg.noiseFloor) {
            fillPixels = 0;
        } else {
            float normalized = (float)bandEnergy / 255.0f;
            fillPixels = (uint16_t)(powf(normalized, exp) * (float)len);
            if (fillPixels == 0) fillPixels = 1;  // At least 1 pixel above noise floor
            if (fillPixels > len) fillPixels = len; // Safety clamp
        }

        for (uint16_t p = 0; p < len; p++) {
            if (p < fillPixels) {
                uint8_t palPos = (uint8_t)((p * 255) / max((uint16_t)1, len) + musicColorPhase(si, cfg, peak));
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                // Beat flash: boost brightness on bass bands during beats
                uint8_t effectBri = bri;
                if (bassBeat && bandIdx <= 1) {
                    effectBri = min(255, (int)bri + cfg.spectrumBeatBoost);
                }
                setPixelRGBW(strip, p, r, g, b, w, effectBri);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 29: Music Pulse — All segments pulse on beat with ripple
    // sx=decay rate, ix=beat flash intensity (128-255)
    // Color shifts with dominant frequency band
    // ═══════════════════════════════════════════════════════
    static uint8_t _pulseDecay[NUM_SEGMENTS];
    static uint8_t _rippleDelay[NUM_SEGMENTS];
    static uint8_t _pendingFlash[NUM_SEGMENTS]; // Stores per-beat ix for delayed segments

    static void fxMusicPulse(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                              uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();

        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);
        uint8_t decayRate = max((uint8_t)1, (uint8_t)(seg.sx / 16));  // Higher sx = faster decay

        // On beat, capture flash intensity and set ripple delay
        if (beat) {
            _pendingFlash[si] = max(cfg.pulseMinFlash, seg.ix);  // Capture ix NOW
            if (_rippleDelay[si] == 0) {
                _rippleDelay[si] = cfg.pulseRippleDelays[si];
            }
        }

        // Count down ripple delay
        if (_rippleDelay[si] > 0) {
            _rippleDelay[si]--;
            if (_rippleDelay[si] == 0) {
                _pulseDecay[si] = _pendingFlash[si];  // Use captured intensity
            }
        }

        // Decay
        if (_pulseDecay[si] > decayRate) {
            _pulseDecay[si] -= decayRate;
        } else {
            _pulseDecay[si] = 0;
        }

        // Ambient glow from overall volume (between beats)
        uint8_t ambient = vol / cfg.pulseAmbientDiv;
        uint8_t brightness = max(_pulseDecay[si], ambient);

        // Color from palette, position shifts with peak frequency band.
        // peakBandToHue>0 replaces the built-in peak*32 with the tunable band->hue term.
        uint8_t bandTerm = cfg.peakBandToHue ? 0 : (peak * 32);
        uint8_t palPos = bandTerm + (uint8_t)(millis() / cfg.pulseColorShiftDiv) + musicColorPhase(si, cfg, peak);

        for (uint16_t p = 0; p < len; p++) {
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
            uint8_t effectBri = ((uint16_t)bri * brightness) / 255;
            setPixelRGBW(strip, p, r, g, b, w, effectBri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 30: Music Comet — Beat-driven chase with energy-modulated speed
    // sx=tail length (1-16 pixels), ix=floor brightness
    // ═══════════════════════════════════════════════════════
    static float _cometMusicPos[NUM_SEGMENTS];
    static unsigned long _lastCometMusicUpdate;

    static void fxMusicComet(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                              uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);
        uint8_t tailLen = max((uint8_t)1, (uint8_t)(seg.sx / 16));  // 1-16 pixels
        uint8_t floorBri = seg.ix;  // Floor brightness for non-comet pixels

        // Speed modulated by energy (higher energy = faster)
        float speed = 0.02f + (energy / 255.0f) * 0.15f;

        // Beat-triggered direction changes on bass beats
        static bool _cometForward[NUM_SEGMENTS];
        if (bassBeat) _cometForward[si] = !_cometForward[si];

        // Advance position
        if (_cometForward[si]) {
            _cometMusicPos[si] += speed;
            if (_cometMusicPos[si] >= 1.0f) _cometMusicPos[si] -= 1.0f;
        } else {
            _cometMusicPos[si] -= speed;
            if (_cometMusicPos[si] < 0.0f) _cometMusicPos[si] += 1.0f;
        }

        int headPos = (int)(_cometMusicPos[si] * len) % len;

        for (uint16_t p = 0; p < len; p++) {
            int dist = (p - headPos + len) % len;
            if (!_cometForward[si]) dist = (headPos - p + len) % len;

            uint8_t r, g, b, w;
            uint8_t palPos = (uint8_t)((p * 255) / max((uint16_t)1, len) + musicColorPhase(si, cfg, peak));
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);

            if (dist < tailLen) {
                // Comet body: brightness fades along tail
                uint8_t fade = 255 - (dist * 255 / tailLen);
                uint8_t effectBri = ((uint16_t)bri * fade) / 255;
                setPixelRGBW(strip, p, r, g, b, w, effectBri);
            } else {
                // Floor glow
                uint8_t effectBri = ((uint16_t)bri * floorBri) / 255;
                setPixelRGBW(strip, p, r, g, b, w, effectBri);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 31: Music Strobe — Beat-synced flash with configurable decay
    // sx=decay rate, ix=floor brightness
    // ═══════════════════════════════════════════════════════
    static uint8_t _strobeDecay[NUM_SEGMENTS];

    static void fxMusicStrobe(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                               uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);
        uint8_t decayRate = max((uint8_t)2, (uint8_t)(seg.sx / 8));  // Higher sx = faster decay
        uint8_t floorBri = seg.ix;

        // Flash on beat. comfortMode enforces a 350ms re-flash floor per segment
        // (keeps the effective full-field flash rate under ~3Hz — the same
        // photosensitivity floor the randomize/burst paths use).
        if (beat) {
            unsigned long now = millis();
            if (!cfg.comfortMode || (now - _lastStrobeFlashMs[si]) >= 350) {
                _strobeDecay[si] = 255;
                _lastStrobeFlashMs[si] = now;
            }
        }

        // Decay
        if (_strobeDecay[si] > decayRate) {
            _strobeDecay[si] -= decayRate;
        } else {
            _strobeDecay[si] = 0;
        }

        uint8_t brightness = max(_strobeDecay[si], floorBri);

        // Color from palette based on peak band.
        // peakBandToHue>0 replaces the built-in peak*32 with the tunable band->hue term.
        uint8_t bandTerm = cfg.peakBandToHue ? 0 : (peak * 32);
        uint8_t palPos = bandTerm + musicColorPhase(si, cfg, peak);
        for (uint16_t p = 0; p < len; p++) {
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
            uint8_t effectBri = ((uint16_t)bri * brightness) / 255;
            setPixelRGBW(strip, p, r, g, b, w, effectBri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 32: Music Fire — Fire2012 with audio-driven sparking/cooling
    // sx=cooling scale factor, ix=spark sensitivity threshold
    // ═══════════════════════════════════════════════════════
    static uint8_t _fireHeat[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP];

    static void fxMusicFire(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                             uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);
        if (len > MAX_PIXELS_PER_STRIP) len = MAX_PIXELS_PER_STRIP;

        // sx controls cooling: higher sx = more cooling = calmer fire
        uint8_t cooling = 20 + (seg.sx / 4);  // 20-83 range
        // Audio modulates cooling: high energy reduces cooling (hotter fire)
        cooling = (uint8_t)max(10, (int)cooling - (energy / 5));

        // Higher ix = lower threshold = MORE sparks (matches "Sparks" slider label)
        uint8_t sparkThreshold = 255 - seg.ix;

        // Step 1: Cool down every cell
        for (uint16_t p = 0; p < len; p++) {
            uint8_t cooldown = random(0, ((cooling * 10) / len) + 2);
            if (cooldown > _fireHeat[si][p]) _fireHeat[si][p] = 0;
            else _fireHeat[si][p] -= cooldown;
        }

        // Step 2: Heat diffusion (drift up)
        for (uint16_t p = len - 1; p >= 2; p--) {
            _fireHeat[si][p] = (_fireHeat[si][p - 1] + _fireHeat[si][p - 2] + _fireHeat[si][p - 2]) / 3;
        }

        // Step 3: Audio-driven sparking
        if (energy > sparkThreshold) {
            int sparkMax = (len < 7) ? (int)len : 7;
            uint8_t sparkPixel = (uint8_t)random(0, sparkMax);
            int newHeat = (int)_fireHeat[si][sparkPixel] + (int)random(160, 255);
            _fireHeat[si][sparkPixel] = (newHeat > 255) ? 255 : (uint8_t)newHeat;
        }
        // Extra sparks on beats
        if (beat && len > 2) {
            _fireHeat[si][(uint8_t)random(0, 3)] = 255;
        }

        // Step 4: Map heat to palette colors
        for (uint16_t p = 0; p < len; p++) {
            uint8_t r, g, b, w;
            // Heat maps to palette position (0=cool, 255=hot).
            // INTENTIONALLY EXCLUDED from color-dynamics (musicColorPhase): the position
            // here is a heat->color mapping, not a hue index — drift would corrupt the fire look.
            PaletteEngine::colorFromPalette(seg.pal, _fireHeat[si][p], seg, r, g, b, w);
            uint8_t heatBri = (_fireHeat[si][p] > 0) ? max((uint8_t)30, _fireHeat[si][p]) : 0;
            uint8_t effectBri = ((uint16_t)bri * heatBri) / 255;
            setPixelRGBW(strip, p, r, g, b, w, effectBri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 33: Music Wave — Sinusoidal wave tracking audio
    // sx=wave speed, ix=mode (0-127: sine, 128-255: compound)
    // ═══════════════════════════════════════════════════════
    static float _wavePhase[NUM_SEGMENTS];

    static void fxMusicWave(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                             uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);

        // Find max band energy for amplitude modulation (vol/energy are too low: 0-40)
        uint8_t maxBand = 0;
        for (int b = 0; b < 8; b++) {
            if (bands[b] > maxBand) maxBand = bands[b];
        }

        // sx controls base wave speed
        float waveSpeed = 0.02f + (seg.sx / 255.0f) * 0.15f;
        // Audio modulates speed via maxBand (energy was 3-20, negligible)
        waveSpeed += (maxBand / 255.0f) * 0.08f;

        _wavePhase[si] += waveSpeed;
        if (_wavePhase[si] > TWO_PI) _wavePhase[si] -= TWO_PI;

        bool compound = (seg.ix >= 128);  // ix selects wave mode

        // Amplitude: generous floor (35%) + audio modulation via maxBand up to 100%
        float ampMod = 0.35f + 0.65f * (maxBand / 255.0f);

        for (uint16_t p = 0; p < len; p++) {
            float pos = (float)p / max((uint16_t)1, (uint16_t)(len - 1));
            float wave;
            if (compound) {
                wave = sinf(_wavePhase[si] + pos * TWO_PI) * 0.5f +
                       sinf(_wavePhase[si] * 2.0f + pos * TWO_PI * 3.0f) * 0.3f +
                       sinf(_wavePhase[si] * 0.5f + pos * TWO_PI * 0.5f) * 0.2f;
            } else {
                wave = sinf(_wavePhase[si] + pos * TWO_PI);
            }

            // Map -1..1 to 0..1, then apply audio-modulated amplitude
            float normalized = (wave + 1.0f) * 0.5f;
            uint8_t waveBri = (uint8_t)(normalized * ampMod * 255.0f);

            // peakBandToHue>0 replaces the built-in peak*32 with the tunable band->hue term.
            uint8_t bandTerm = cfg.peakBandToHue ? 0 : (peak * 32);
            uint8_t palPos = (uint8_t)(pos * 255.0f + bandTerm + musicColorPhase(si, cfg, peak));
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
            uint8_t effectBri = ((uint16_t)bri * waveBri) / 255;
            setPixelRGBW(strip, p, r, g, b, w, effectBri);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 37: Music Tower — the 5 desk layers become a vertical equalizer.
    // Bass drives The Feet, mids The Core, treble The Head; ix>=128 inverts
    // (bass at the head). sx = reactivity curve (same family as Music Spectrum).
    // The palette spreads up the tower so the stack reads as one instrument.
    // ═══════════════════════════════════════════════════════
    static void fxMusicTower(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                              uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);
        uint8_t layer = STRIP_LAYER[si];
        // L = distance from the bass end (0 = bass layer). Default: bass at feet.
        uint8_t L = (seg.ix >= 128) ? layer : (uint8_t)(NUM_LAYERS - 1 - layer);

        // 5 layers ← 8 bands: {sub-bass,bass} {low-mid} {mid,upper-mid} {presence} {brilliance,air}
        static const uint8_t BLO[5] = {0, 2, 3, 5, 6};
        static const uint8_t BHI[5] = {1, 2, 4, 5, 7};
        uint8_t e = 0;
        for (uint8_t b = BLO[L]; b <= BHI[L]; b++) {
            if (bands[b] > e) e = bands[b];
        }
        if (e < cfg.noiseFloor) e = 0;

        // Reactivity: sx 0 → gentle (exp 1.6), sx 255 → punchy (exp 0.4)
        float exponent = 1.6f - (seg.sx / 255.0f) * 1.2f;
        float levelF = powf((float)e / 255.0f, exponent);
        // Bass-layer beat kick (same knob as Spectrum's bass boost)
        if (L == 0 && bassBeat) {
            levelF += (float)cfg.spectrumBeatBoost / 255.0f;
            if (levelF > 1.0f) levelF = 1.0f;
        }
        uint8_t level = (uint8_t)(levelF * 255.0f);

        // Tower palette gradient: each layer sits 40 palette-units apart
        // (peakBandToHue replaces the layer term, matching the other music FX).
        uint8_t layerTerm = cfg.peakBandToHue ? 0 : (uint8_t)(L * 40);
        float center = (len > 1) ? (float)(len - 1) * 0.5f : 1.0f;
        for (uint16_t p = 0; p < len; p++) {
            // Soft center-out shaping so each shelf reads as a lit bar, not a slab
            float shape = 1.0f - 0.25f * fabsf((float)p - center) / (center > 0.0f ? center : 1.0f);
            uint8_t palPos = (uint8_t)(layerTerm + (uint8_t)((p * 24) / (len ? len : 1))
                                        + musicColorPhase(si, cfg, peak));
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
            uint8_t shaped = (uint8_t)((float)level * shape);
            setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(((uint16_t)bri * shaped) / 255));
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 38: Music Ripple — a wavefront travels the 5 layers exactly once per
    // beat, phase-locked to the analyzer's beat phase (v2). Without a tempo lock
    // each detected beat launches one ~600ms sweep. sx = wave width;
    // ix < 128 = per-beat cadence, >= 128 = per-bar (one sweep per 4 beats).
    // seg.rev flips the vertical direction (default head→feet).
    // ═══════════════════════════════════════════════════════
    static void fxMusicRipple(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                               uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);
        uint8_t bpm, bph, bar, env, flags, ver;
        readAudioExtras(bpm, bph, bar, env, flags, ver);

        uint16_t len = getLen(si);

        float pos;  // 0..1 sweep position through the current beat/bar
        if (bpm > 0) {
            if (seg.ix >= 128) {
                uint8_t beatInBar = (bar >> 6) & 0x03;
                pos = ((float)beatInBar + (float)bph / 256.0f) / 4.0f;
            } else {
                pos = (float)bph / 256.0f;
            }
        } else {
            // v1 / no lock: one sweep per detected beat, parked at the end until
            // the next beat re-launches it.
            unsigned long since = millis() - _lastBeatMs;
            pos = (since >= 600) ? 1.0f : (float)since / 600.0f;
        }
        // Vertical direction: rev flips the axis. (The caller's pixel-reverse
        // pass is a near-no-op on this layer-uniform effect.)
        float wavePos = seg.rev ? 1.0f - pos : pos;

        float axis = layerCenter01(STRIP_LAYER[si]);
        float d = fabsf(axis - wavePos);
        float sigma = 0.06f + (seg.sx / 255.0f) * 0.24f;   // wave width
        float w01 = expf(-(d * d) / (2.0f * sigma * sigma));

        // Amplitude breathes with the loudness envelope (band-max fallback on v1)
        uint8_t amp = env;
        if (amp == 0) {
            for (int b = 0; b < 8; b++) {
                if (bands[b] > amp) amp = bands[b];
            }
        }
        float ampF = 0.30f + 0.70f * ((float)amp / 255.0f);
        uint8_t waveBri = (uint8_t)(w01 * ampF * 255.0f);

        uint8_t bandTerm = cfg.peakBandToHue ? 0 : (uint8_t)(peak * 32);
        uint8_t palPos = (uint8_t)((uint8_t)(pos * 255.0f) + bandTerm + musicColorPhase(si, cfg, peak));
        for (uint16_t p = 0; p < len; p++) {
            uint8_t r, g, b, w;
            PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
            setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(((uint16_t)bri * waveBri) / 255));
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 39: Music Bass Sky — layer ROLES, not layer sweep: Lower Body + Feet
    // glow with the bass, Head + Upper Body run treble-driven twinkles, and
    // The Core blends both. sx = twinkle fade speed; ix = balance
    // (0 = all floor, 128 = even, 255 = all sky).
    // Reuses _segTwinkleFade[si] — safe: one FX owns a segment at a time.
    // ═══════════════════════════════════════════════════════
    static void fxMusicBassSky(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                                uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);

        uint16_t len = getLen(si);
        if (len > MAX_PIXELS_PER_STRIP) len = MAX_PIXELS_PER_STRIP;
        uint8_t layer = STRIP_LAYER[si];

        uint8_t bassE = max(bands[0], bands[1]);
        uint8_t highE = 0;
        for (int b = 5; b < 8; b++) {
            if (bands[b] > highE) highE = bands[b];
        }

        // Balance: shrink one role's gain as ix leaves the 128 midpoint
        float floorGain = (seg.ix <= 128) ? 1.0f : 1.0f - ((seg.ix - 128) / 127.0f) * 0.85f;
        float skyGain   = (seg.ix >= 128) ? 1.0f : 1.0f - ((128 - seg.ix) / 128.0f) * 0.85f;

        if (layer >= 3) {
            // ── Floor: bass glow, beat-pulsed ──
            float lv = powf((float)bassE / 255.0f, 0.8f) * floorGain;
            if (bassBeat) lv += (float)cfg.spectrumBeatBoost / 640.0f;  // gentle kick
            if (lv > 1.0f) lv = 1.0f;
            uint8_t level = (uint8_t)(lv * 255.0f);
            for (uint16_t p = 0; p < len; p++) {
                uint8_t palPos = (uint8_t)((p * 48) / (len ? len : 1) + musicColorPhase(si, cfg, peak));
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
                setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(((uint16_t)bri * level) / 255));
            }
        } else if (layer <= 1) {
            // ── Sky: treble twinkles ──
            uint8_t fade = 8 + (seg.sx >> 3);  // 8..39 decay per frame
            for (uint16_t p = 0; p < len; p++) {
                uint8_t v = _segTwinkleFade[si][p];
                _segTwinkleFade[si][p] = (v > fade) ? (uint8_t)(v - fade) : 0;
            }
            // Spawn probability follows treble energy; a beat guarantees sparkles
            uint8_t spawnP = highE >> 1;
            if ((uint8_t)(xorshift16(_segRandom[si]) & 0xFF) < spawnP) {
                _segTwinkleFade[si][xorshift16(_segRandom[si]) % len] =
                    (uint8_t)(255.0f * skyGain);
            }
            if (beat && len > 1) {
                _segTwinkleFade[si][xorshift16(_segRandom[si]) % len] =
                    (uint8_t)(255.0f * skyGain);
            }
            for (uint16_t p = 0; p < len; p++) {
                uint8_t v = _segTwinkleFade[si][p];
                if (v == 0) {
                    setPixelBlack(strip, p);
                    continue;
                }
                uint8_t palPos = (uint8_t)(200 + (v >> 3) + musicColorPhase(si, cfg, peak));
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
                // White-channel sparkle so the "sky" glints over the palette color
                setPixelRGBW(strip, p, r, g, b, (uint8_t)(v >> 2), (uint8_t)(((uint16_t)bri * v) / 255));
            }
        } else {
            // ── Core: gentle blend of both roles ──
            uint16_t mix = (uint16_t)((float)bassE * floorGain + (float)highE * skyGain) / 2;
            uint8_t level = (uint8_t)(((mix > 255 ? 255 : mix) * 3) / 5);  // ×0.6 — the calm middle
            for (uint16_t p = 0; p < len; p++) {
                uint8_t palPos = (uint8_t)(100 + (p * 40) / (len ? len : 1) + musicColorPhase(si, cfg, peak));
                uint8_t r, g, b, w;
                PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
                setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(((uint16_t)bri * level) / 255));
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 40: Music Drop — build → slam → wash, driven by the analyzer's
    // structure flags (advanceDropState, once per frame). Idle: dim ambient
    // pulse. Build: a fill climbs Feet→Head with the loudness envelope,
    // shimmering at its edge. Drop: full-desk slam (comfort-floored) decaying
    // into a moving palette wash. sx = ambient idle level; ix = slam power.
    // ═══════════════════════════════════════════════════════
    // FX 41: write this strip's stage-7 output (Ambient::emit) into the buffer. Stages 1-6 already ran for every ambient
    // strip together in renderFromState (the flash guard and the power gain are global, so they cannot run per strip).
    static void fxAmbient(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip, uint8_t si, uint8_t bri) {
        uint8_t px[MAX_PIXELS_PER_STRIP][4];
        Ambient::emit(si, bri, px);
        const uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len && p < MAX_PIXELS_PER_STRIP; p++) {
            uint8_t ch[4];
            ch[RGBW_ARG_INDEX_R] = px[p][0];
            ch[RGBW_ARG_INDEX_G] = px[p][1];
            ch[RGBW_ARG_INDEX_B] = px[p][2];
            ch[RGBW_ARG_INDEX_W] = px[p][3];
            strip->SetPixelColor(p, RgbwColor(ch[0], ch[1], ch[2], ch[3]));
        }
    }

    static void fxMusicDrop(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                             uint8_t si, const SegmentState& seg, uint8_t bri) {
        MusicConfig cfg = gMusicConfig.getConfig();
        uint8_t bands[8], vol, energy, peak;
        bool beat, bassBeat;
        readSmoothedAudio(bands, vol, energy, beat, bassBeat, peak);
        uint8_t bpm, bph, bar, env, flags, ver;
        readAudioExtras(bpm, bph, bar, env, flags, ver);

        uint16_t len = getLen(si);
        if (len > MAX_PIXELS_PER_STRIP) len = MAX_PIXELS_PER_STRIP;
        uint8_t layer = STRIP_LAYER[si];

        switch (_dropState) {
            case 1: {  // ── Build: fill climbs feet→head with the envelope ──
                float fill = (float)env / 255.0f;
                float myHeight = 1.0f - layerCenter01(layer);  // feet=0 → head=1
                uint8_t level;
                if (myHeight <= fill) {
                    level = 200;
                } else if (myHeight - fill < 0.25f) {
                    // Shimmering edge just above the fill line
                    level = (uint8_t)(90 + (xorshift16(_segRandom[si]) & 0x5F));
                } else {
                    level = 0;
                }
                uint8_t palPos = (uint8_t)((uint8_t)(fill * 128.0f) + musicColorPhase(si, cfg, peak));
                for (uint16_t p = 0; p < len; p++) {
                    uint8_t r, g, b, w;
                    PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
                    setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(((uint16_t)bri * level) / 255));
                }
                break;
            }
            case 2: {  // ── Slam: full-field white-boosted flash at ix ceiling ──
                uint8_t slam = seg.ix ? seg.ix : 200;
                for (uint16_t p = 0; p < len; p++) {
                    setPixelRGBW(strip, p, 255, 255, 255, 180, (uint8_t)(((uint16_t)bri * slam) / 255));
                }
                break;
            }
            case 3: {  // ── Wash: moving palette wave at the decaying wash level ──
                uint8_t washLv = _dropWash;
                uint8_t drift = (uint8_t)(millis() / 20);  // slow constant motion
                for (uint16_t p = 0; p < len; p++) {
                    uint8_t palPos = (uint8_t)((p * 255) / (len ? len : 1) + drift
                                                + musicColorPhase(si, cfg, peak));
                    uint8_t r, g, b, w;
                    PaletteEngine::colorFromPalette(seg.pal, palPos, seg, r, g, b, w);
                    setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(((uint16_t)bri * washLv) / 255));
                }
                break;
            }
            default: {  // ── Idle: dim ambient pulse breathing with the music ──
                uint8_t base = (uint8_t)((seg.sx >> 3) + (energy >> 3));  // sx sets the floor
                if (base > 96) base = 96;                                  // idle stays dim
                uint8_t palPos = (uint8_t)(layer * 24 + musicColorPhase(si, cfg, peak));
                for (uint16_t p = 0; p < len; p++) {
                    uint8_t r, g, b, w;
                    PaletteEngine::colorFromPalette(seg.pal, PaletteEngine::musicPalPos(seg.pal, palPos, p, len), seg, r, g, b, w);
                    setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(((uint16_t)bri * base) / 255));
                }
                break;
            }
        }
    }
    // MOTION PHASE (FX 34-36). These used to compute position as frac(millis() x speed), which is a
    // position in ABSOLUTE time: change the speed (sx) and every frame of uptime is re-scaled, so the
    // beam lands somewhere new on the very next frame. After ~12 h of uptime an sx change moved the
    // phase by thousands of cycles, i.e. to a random spot, and an sx change is not a crossfade trigger,
    // so it was a hard cut. The API's cue exit sends sx:0 (a WLED "freeze") at full brightness, which
    // made a random layer snap on at every lift/tilt cue exit.
    // Advancing by (elapsed x speed) instead makes a speed change bend the motion, never jump it.
    // ONE phase per FX, shared by all segments, because the lift beam is one wavefront across the
    // layers and tilt adds its per-segment offset on top: per-segment phases would drift apart.
    struct MotionPhase {
        float phase;
        uint32_t lastMs;
        bool started;
    };
    static MotionPhase _liftPhase, _tiltPhase, _wheelsCometPhase;

    static float advancePhase(MotionPhase& m, float speedHz) {
        const uint32_t now = millis();
        if (!m.started) {
            m.started = true;
            m.phase = 0.0f;
        } else {
            m.phase = fmodf(m.phase + (float)(uint32_t)(now - m.lastMs) / 1000.0f * speedHz, 1.0f);
        }
        m.lastMs = now;
        return m.phase;
    }


    // ═══════════════════════════════════════════════════════
    // FX 34: Lift Motion — vertical wavefront sweep across the 5 layers.
    // Movement indicator driven by ONE Go command (no per-frame HTTP). Color is
    // taken from seg.col[0] (Go is the color source); sx=speed; ix<128=up
    // (raise: light rises bottom→top), ix>=128=down (lower: top→bottom).
    // ALL timing is millis()-based so motion is identical at 30 vs 60 fps and is
    // independent of the per-segment call order (the fn runs once per segment).
    // ═══════════════════════════════════════════════════════
    static void fxLift(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                       uint8_t si, const SegmentState& seg, uint8_t bri) {
        float speedHz = 0.12f + (seg.sx / 255.0f) * 0.28f;      // cycles / second (slowed ~20% more for a calmer sweep)
        const float C = (float)(NUM_LAYERS - 1) + 1.0f; float t = advancePhase(_liftPhase, speedHz); float travel = t * C; // C=5: 4 layer-spans + 1.0 wrap gap
        // Layers: 0=TOP (Head) … 4=BOTTOM (Feet). Beam runs a circular track so it
        // wraps seamlessly. up: 4→3→2→1→0→seam→4 (feet→head); down: 0→…→4→seam→0.
        bool goingUp = (seg.ix < 128);
        float wavefront = goingUp ? fmodf(4.0f - travel + C, C) : travel;

        int myLayer = -1;
        for (int layer = 0; layer < NUM_LAYERS; layer++) {
            for (int j = 0; j < 3; j++) {
                if (LAYER_STRIPS[layer][j] == (int)si) { myLayer = layer; break; }
            }
            if (myLayer >= 0) break;
        }

        const float beamWidth = 1.0f;
        uint8_t layerBri = 0;  // segments OFF except the active layer (no ambient floor)
        if (myLayer >= 0) {
            float raw = fabs((float)myLayer - wavefront); float distance = fminf(raw, C - raw); // circular → seamless wrap
            if (distance < beamWidth) {
                float intensity = 0.5f * (1.0f + cos(distance * M_PI / beamWidth));
                layerBri = (uint8_t)(intensity * bri);  // full bri at beam center, smooth cosine ramp
                // out-of-beam layers stay black (set above)
            }
        }

        uint8_t r = seg.col[0][0], g = seg.col[0][1], b = seg.col[0][2], w = seg.col[0][3];
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) {
            // Subtle ≤15% intra-strip depth gradient for dimensionality.
            float depth = 1.0f - 0.15f * ((float)p / (float)(len > 1 ? len - 1 : 1));
            setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(layerBri * depth));
        }
    }

    // ═══════════════════════════════════════════════════════
    // FX 35: Tilt Motion — lateral sway along each strip's length, with a
    // per-segment phase offset so the bright spot reads as a diagonal rock across
    // the whole desk (distinct axis from Lift's vertical sweep). col[0]=color,
    // sx=speed, ix<128=extend / ix>=128=retract (flips sweep direction).
    // ═══════════════════════════════════════════════════════
    static void fxTilt(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                       uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float speedHz = 0.25f + (seg.sx / 255.0f) * 0.75f;
        float phase = advancePhase(_tiltPhase, speedHz);            // bound before sin
        float angle = phase * 6.28318f + (float)si * (M_PI_2 / 7.0f);
        float norm = (sin(angle) + 1.0f) / 2.0f;                   // 0..1
        if (seg.ix >= 128) norm = 1.0f - norm;                     // retract = reverse
        float scanPos = norm * (len - 1);

        const float bloom = 1.5f;
        uint8_t r = seg.col[0][0], g = seg.col[0][1], b = seg.col[0][2], w = seg.col[0][3];
        for (uint16_t p = 0; p < len; p++) {
            float dist = fabs((float)p - scanPos);
            if (dist < bloom + 1.0f) {
                float intensity;
                if (dist <= 0.5f) intensity = 1.0f;
                else {
                    intensity = max(0.0f, 1.0f - ((dist - 0.5f) / bloom));
                    intensity = intensity * intensity;            // quadratic falloff
                }
                setPixelRGBW(strip, p, r, g, b, w, (uint8_t)(intensity * bri));
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    // wheelsComet/wheelsBreathe — building blocks for fxWheels (FX 36). millis()-based.
    static void wheelsComet(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                            uint8_t si, const SegmentState& seg, uint8_t bri, bool reversed) {
        uint16_t len = getLen(si);
        float speedHz = 0.4f + (seg.sx / 255.0f) * 1.1f;
        int phase = (int)(advancePhase(_wheelsCometPhase, speedHz) * len) % len; int headPos = reversed ? (len - 1 - phase) : phase; // reversed flips actual travel dir, not just tail side
        int tailLen = min((int)len, 8);
        uint8_t r = seg.col[0][0], g = seg.col[0][1], b = seg.col[0][2], w = seg.col[0][3];
        for (uint16_t p = 0; p < len; p++) {
            // Tail trails opposite the travel direction.
            int dist = reversed ? (((int)p - headPos + len) % len)
                                : ((headPos - (int)p + len) % len);
            if (dist < tailLen && dist < MAX_PIXELS_PER_STRIP) {
                uint8_t fade = COMET_TAIL_LUT[dist];
                setPixelRGBW(strip, p, r, g, b, w, ((uint16_t)fade * bri) >> 8);
            } else {
                setPixelBlack(strip, p);
            }
        }
    }

    static void wheelsBreathe(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                              uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint16_t len = getLen(si);
        float pulse = (sin(fmodf(millis() / 1000.0f * 0.5f, 1.0f) * 6.28318f) + 1.0f) / 2.0f;
        uint8_t pulseBri = (uint8_t)(pulse * bri * 0.6f);          // ambient ≤60%
        uint8_t r = seg.col[1][0], g = seg.col[1][1], b = seg.col[1][2], w = seg.col[1][3];
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, pulseBri);
    }

    // wheelsWarnPulse — caution pulse for the strips pulled OUT of the directional
    // choreography during strafe. See wheelsStrafeWarnStrip for the set.
    //
    // Wall-clock timed like wheelsComet/wheelsBreathe, NOT per-frame like fxBreathe, so
    // the cadence holds regardless of render rate. It also takes no per-strip phase
    // offset, which is deliberate: every warn strip pulses in lockstep so the four read
    // as ONE caution cue rather than four independent blinkers.
    //
    // Full 0..bri sweep with no ambient-style 60% cap: this is a caution marker, not a
    // background wash.
    static void wheelsWarnPulse(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                                uint8_t si, const SegmentState& seg, uint8_t bri) {
        constexpr float PULSE_HZ = 1.1f;   // ~0.9 s per pulse. THE tuning knob.
        uint16_t len = getLen(si);
        float pulse = (sin(fmodf(millis() / 1000.0f * PULSE_HZ, 1.0f) * 6.28318f) + 1.0f) / 2.0f;
        uint8_t pulseBri = (uint8_t)(pulse * bri);
        // col[2] carries the warning colour. An API predating that field sends {0,0,0,0};
        // fall back to the comet colour so an un-updated host pulses VISIBLY rather than
        // pulsing black — a strip that goes dark during motion reads as a hardware fault.
        uint8_t r = seg.col[2][0], g = seg.col[2][1], b = seg.col[2][2], w = seg.col[2][3];
        if ((r | g | b | w) == 0) {
            r = seg.col[0][0]; g = seg.col[0][1]; b = seg.col[0][2]; w = seg.col[0][3];
        }
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, r, g, b, w, pulseBri);
    }

    // The strafe caution set — which strips pulse (wheelsWarnPulse) instead of taking part
    // in the directional choreography. Strafe/diagonal only; every other drive mode leaves
    // these strips alone.
    //
    //   si1 = 822c (Top Shelf Bottom Back)    si4 = 822f (Desk Top Center)
    //   si5 = 822e (Desktop Left, vertical)   si6 = 822g (Desktop Right, vertical)
    //
    // LABEL WARNING: si1 is 822c and si2 is 822b — Vico identified them on the desk
    // 2026-08-25, and that is the REVERSE of the tier table used elsewhere, which assumes
    // the patent labels ascend with wiring order. si1 and si2 are the two strips of the
    // same shelf, so the pair is easy to transpose on paper and unambiguous in person.
    // Do not "correct" this back without identifying the strips on hardware again.
    //
    // This is a DESIGN choice, not a workaround — the four together frame the desk with a
    // steady caution cue while 822a/822b/822d/822h carry the travel direction. Note si5/si6
    // were the blue ambient breathe before, so during strafe nothing breathes ambient now.
    //
    // si4 carries an extra reason on top: it is wired opposite the other left-right strips,
    // so a comet that agrees with its neighbours visibly travels the wrong way on it. The
    // legacy Go renderer compensated with a per-segment rev flag and this FX never did.
    // Taking it out of the choreography leaves that inversion with nothing to act on — so
    // if si4 is ever returned to the comet group it needs a direction flip that does not
    // exist here yet. Do not simply fold it back into the si<=3 test.
    static inline bool wheelsStrafeWarnStrip(uint8_t si) {
        return si == 1 || si == 4 || si == 5 || si == 6;
    }

    // wheelsAlternatingPulse — the caution pulse for FORWARD/BACKWARD, where the colour
    // swaps between travel red (col[0]) and caution amber (col[2]) on every pulse.
    //
    // Forward and backward are the one case where the left-right strips have nothing
    // truthful to say about direction: only the perpendicular wings can show fore/aft, so
    // the other six strips carry a cue rather than a vector. Alternating the two colours is
    // what keeps that cue from reading as a plain caution — it says "moving" and "mind
    // yourself" in turn.
    //
    // Uses (1-cos)/2 rather than wheelsWarnPulse's (sin+1)/2, and that is load-bearing here:
    // it puts the brightness MINIMUM exactly on the cycle boundary, so the colour changes
    // while the strip is dark. With the sine form the boundary lands at mid-brightness and
    // the swap reads as a hard colour jump.
    // Half the caution pulse's 1.1 Hz, chosen on the desk 2026-08-26. Rate is per PULSE, so
    // each colour holds ~1.8 s and a full red+amber pair takes ~3.6 s. Deliberately slower
    // than wheelsWarnPulse: a caution cue wants urgency, but this one ALTERNATES, and at
    // 1.1 Hz the colour change was arriving faster than it reads as a change.
    //
    // Shared by both linear pulses so the steady-red strips stay in lockstep with the
    // alternating ones — their red pulses land together, which is what makes the pair read
    // as one cue rather than two clocks.
    static constexpr float WHEELS_LINEAR_PULSE_HZ = 0.55f;

    // Brightness ramp shared by the two linear-move pulses. (1-cos)/2 puts the MINIMUM on
    // the cycle boundary, so an alternating caller changes colour while the strip is dark.
    // `cycle` is handed back so that caller can alternate on it.
    static inline uint8_t wheelsLinearPulseBri(uint8_t bri, uint32_t& cycle) {
        float t = millis() / 1000.0f * WHEELS_LINEAR_PULSE_HZ;
        cycle = (uint32_t)t;
        float phase = t - (float)cycle;
        return (uint8_t)(((1.0f - cos(phase * 6.28318f)) / 2.0f) * bri);
    }

    static void wheelsAlternatingPulse(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                                       uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint32_t cycle;
        uint8_t pulseBri = wheelsLinearPulseBri(bri, cycle);
        const uint8_t* c = (cycle & 1u) ? seg.col[2] : seg.col[0];
        // Same guard as wheelsWarnPulse: a host predating col[2] sends {0,0,0,0}, and every
        // second pulse would otherwise be black — reading as a strip that flickers out.
        if ((c[0] | c[1] | c[2] | c[3]) == 0) c = seg.col[0];
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, c[0], c[1], c[2], c[3], pulseBri);
    }

    // wheelsRedPulse — the same ramp, travel red only, never alternating. 822a (si0) and
    // 822h (si7) hold it during forward/backward: they are the desk's top and bottom, and
    // keeping them a steady red frames the four alternating strips between them instead of
    // every horizontal surface changing colour at once.
    static void wheelsRedPulse(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                               uint8_t si, const SegmentState& seg, uint8_t bri) {
        uint32_t cycle;
        uint8_t pulseBri = wheelsLinearPulseBri(bri, cycle);
        const uint8_t* c = seg.col[0];
        uint16_t len = getLen(si);
        for (uint16_t p = 0; p < len; p++) setPixelRGBW(strip, p, c[0], c[1], c[2], c[3], pulseBri);
    }

    // The INNER caution pair — 822c (si1) and 822f (si4). Used by every mode that needs
    // its wings for something other than a caution cue:
    //
    //   DIAGONAL — the wings carry fore/aft while the L-R strips carry left/right, so a
    //              diagonal reads on both of its axes at once.
    //   ROTATE   — the wings carry the spin, opposing each other; a rotation has no
    //              lateral or fore/aft component for them to show.
    //
    // A pure strafe has neither, so there the wings join the caution set instead
    // (wheelsStrafeWarnStrip).
    static inline bool wheelsInnerCautionStrip(uint8_t si) {
        return si == 1 || si == 4;
    }

    // ═══════════════════════════════════════════════════════
    // FX 36: Wheels Motion — directional comet choreography. ix=driveMode
    // (1=strafeL 2=strafeR 3=fwd 4=back 5=rotCW 6=rotCCW,
    //  7=diagLeftFwd 8=diagLeftBack 9=diagRightFwd 10=diagRightBack). Segment roles:
    // front si0-3, side-left si5, side-right si6, bottom si7. Choreography lives here
    // (single source); col[0]=comet color, col[1]=ambient breathe color, col[2]=warning
    // pulse color.
    //
    // Three modes share one vocabulary — travelling red for direction, pulsing amber for
    // caution — and differ only in what they can spare the wings (si5/si6) for:
    //
    //   STRAFE   (ix 1/2)  wings have no second axis to show, so they join the caution
    //                      set: 822c/822f/822e/822g pulse, 822a/822b/822d/822h travel.
    //   DIAGONAL (ix 7-10) wings carry fore/aft, L-R strips carry left/right; caution
    //                      narrows to 822c/822f.
    //   ROTATE   (ix 5/6)  wings oppose each other to spin; caution is 822c/822f and every
    //                      other strip travels.
    //   FWD/BACK (ix 3/4)  only the wings can show fore/aft, so they travel. 822a and 822h
    //                      hold a steady red pulse and the four strips between them
    //                      ALTERNATE red/amber — all on one clock.
    //
    // col[1] (ambient) is now unread by every one of the ten drive modes — nothing breathes.
    // It is still sent, and wheelsBreathe still exists, so an unknown ix has somewhere safe
    // to land.
    // ═══════════════════════════════════════════════════════
    static void fxWheels(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
                         uint8_t si, const SegmentState& seg, uint8_t bri) {
        bool comet = false, reversed = false, warn = false, altPulse = false, redPulse = false;
        switch (seg.ix) {
            case 1: if (wheelsStrafeWarnStrip(si)) { warn = true; }                     // strafe L
                    else if (si <= 3 || si == 7) { comet = true; reversed = false; } break;
            case 2: if (wheelsStrafeWarnStrip(si)) { warn = true; }                     // strafe R
                    else if (si <= 3 || si == 7) { comet = true; reversed = true; }  break;
            // FORWARD / BACKWARD. Only the wings can show fore/aft, so they travel red and
            // every other strip — all six left-right ones, 822h included — carries the
            // alternating red/amber pulse instead. This is the last mode family that used to
            // breathe ambient blue; col[1] is now unread everywhere.
            case 3: if (si == 5 || si == 6) { comet = true; reversed = false; }  // forward
                    else if (si == 0 || si == 7) { redPulse = true; }            // 822a/822h
                    else { altPulse = true; } break;
            case 4: if (si == 5 || si == 6) { comet = true; reversed = true; }   // backward
                    else if (si == 0 || si == 7) { redPulse = true; }            // 822a/822h
                    else { altPulse = true; } break;
            // ROTATE. The five strips that used to breathe ambient blue here now follow the
            // strafe vocabulary instead: 822c/822f pulse the caution colour and the
            // remaining L-R strips (822a/822b/822d, joining 822h) travel red. Nothing
            // breathes ambient in a rotation any more.
            //
            // The wings oppose each other — that IS the rotation — and both were running
            // the wrong way round; si5/si6 are swapped from what this case used to say.
            case 5: // rotate CW
                if (wheelsInnerCautionStrip(si)) { warn = true; }
                else if (si == 5) { comet = true; reversed = true; }   // wings oppose;
                else if (si == 6) { comet = true; reversed = false; }  // both flipped
                else             { comet = true; reversed = false; }   // si0/2/3 + si7 sweep together
                break;
            case 6: // rotate CCW — every direction mirrored from case 5
                if (wheelsInnerCautionStrip(si)) { warn = true; }
                else if (si == 5) { comet = true; reversed = false; }
                else if (si == 6) { comet = true; reversed = true; }
                else             { comet = true; reversed = true; }
                break;
            // DIAGONALS (7-10). A diagonal used to be indistinguishable from a strafe —
            // the host collapsed all four into ix 1/2 and the fore/aft half was thrown
            // away before this switch ever saw it. These four modes keep both halves:
            //   L-R strips (si0/2/3/7) → lateral, same direction as the matching strafe
            //   wings     (si5/si6)    → fore/aft, same direction as modes 3/4
            //   si1/si4                → caution pulse, as in strafe
            case 7:  // left-forward
            case 8:  // left-backward
            case 9:  // right-forward
            case 10: // right-backward
            {
                const bool rightward = (seg.ix == 9 || seg.ix == 10); // matches strafe R (case 2)
                const bool backward  = (seg.ix == 8 || seg.ix == 10); // matches backward (case 4)
                if (wheelsInnerCautionStrip(si))  { warn = true; }
                else if (si == 5 || si == 6)      { comet = true; reversed = backward; }
                else if (si <= 3 || si == 7)      { comet = true; reversed = rightward; }
                break;
            }
            default: break;
        }
        if (altPulse)      wheelsAlternatingPulse(strip, si, seg, bri);
        else if (redPulse) wheelsRedPulse(strip, si, seg, bri);
        else if (warn)  wheelsWarnPulse(strip, si, seg, bri);
        else if (comet) wheelsComet(strip, si, seg, bri, reversed);
        else            wheelsBreathe(strip, si, seg, bri);  // no drive mode reaches this now
    }

public:
    // ═══════════════════════════════════════════════════════
    // Keyboard Composite Effects (Phase 3 - Preserved)
    // These have their own Show() calls, bypass the API pipeline.
    // ═══════════════════════════════════════════════════════

    static void resetCometState() {
        for (int i = 0; i < NUM_SEGMENTS; i++) _cometPos[i] = 0.0f;
        _lastCometUpdate = 0;
    }

    static void CometChase(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
        uint8_t r, uint8_t g, uint8_t b,
        const bool active[], const bool reversed[], float speed = 0.5
    ) {
        float easedT = easeInOutSine(_cometPos[0]);
        for (int i = 0; i < NUM_SEGMENTS; i++) {
            if (!active[i] || strips[i] == nullptr) continue;
            uint16_t numPixels = STRIP_LENGTHS[i];
            int headPos;
            if (reversed[i]) headPos = (int)((1.0f - easedT) * numPixels) % numPixels;
            else headPos = (int)(easedT * numPixels) % numPixels;
            for (uint16_t p = 0; p < numPixels; p++) {
                int tailDist;
                if (reversed[i]) tailDist = (p - headPos + numPixels) % numPixels;
                else tailDist = (headPos - p + numPixels) % numPixels;
                int maxTail = min(16, numPixels - 2);
                uint8_t brightness = (tailDist < maxTail) ? COMET_TAIL_LUT[tailDist] : 0;
                if (brightness > 0) {
                    uint8_t outR = (r * brightness) / 255;
                    uint8_t outG = (g * brightness) / 255;
                    uint8_t outB = (b * brightness) / 255;
                    strips[i]->SetPixelColor(p, RgbwColor(outR, 0, outG, outB));
                } else {
                    strips[i]->SetPixelColor(p, RgbwColor(0, 0, 0, 0));
                }
            }
            strips[i]->Show();
        }
        _cometPos[0] += speed / 14.0f;
        if (_cometPos[0] >= 1.0f) _cometPos[0] -= 1.0f;
    }

    static void BreatheStrips(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
        uint8_t r, uint8_t g, uint8_t b,
        const bool active[], float speed = 0.05
    ) {
        static float localAngle = 0;
        float pulse = (sin(localAngle) + 1.0) / 2.0;
        uint8_t masterBri = 25 + (uint8_t)(pulse * 190.0);
        for (int i = 0; i < NUM_SEGMENTS; i++) {
            if (!active[i] || strips[i] == nullptr) continue;
            uint8_t outR = (r * masterBri) / 255;
            uint8_t outG = (g * masterBri) / 255;
            uint8_t outB = (b * masterBri) / 255;
            strips[i]->ClearTo(RgbwColor(outR, 0, outG, outB));
            strips[i]->Show();
        }
        localAngle += speed;
        if (localAngle > 6.28318) localAngle = 0;
    }

    static void WheelsRight(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
                              uint8_t r, uint8_t g, uint8_t b, float cometSpeed = 0.5) {
        bool chaseActive[8]  = {true, true, true, true, true, false, false, true};
        bool chaseReversed[8] = {true, true, true, true, false, false, false, true};
        bool breatheActive[8] = {false, false, false, false, false, true, true, false};
        CometChase(strips, r, g, b, chaseActive, chaseReversed, cometSpeed);
        BreatheStrips(strips, r, g, b, breatheActive, 0.05);
    }

    static void WheelsLeft(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
                             uint8_t r, uint8_t g, uint8_t b, float cometSpeed = 0.5) {
        bool chaseActive[8]  = {true, true, true, true, true, false, false, true};
        bool chaseReversed[8] = {false, false, false, false, true, false, false, false};
        bool breatheActive[8] = {false, false, false, false, false, true, true, false};
        CometChase(strips, r, g, b, chaseActive, chaseReversed, cometSpeed);
        BreatheStrips(strips, r, g, b, breatheActive, 0.05);
    }

    static void RotateRight(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
                              float cometSpeed = 0.33) {
        bool chaseActive[8]  = {false, false, false, false, false, true, true, true};
        bool chaseReversed[8] = {false, false, false, false, false, false, true, true};
        bool breatheActive[8] = {true, true, true, true, true, false, false, false};
        CometChase(strips, 255, 0, 0, chaseActive, chaseReversed, cometSpeed);
        BreatheStrips(strips, 0, 140, 255, breatheActive, 0.05);
    }

    static void RotateLeft(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
                             float cometSpeed = 0.33) {
        bool chaseActive[8]  = {false, false, false, false, false, true, true, true};
        bool chaseReversed[8] = {false, false, false, false, false, true, false, false};
        bool breatheActive[8] = {true, true, true, true, true, false, false, false};
        CometChase(strips, 255, 0, 0, chaseActive, chaseReversed, cometSpeed);
        BreatheStrips(strips, 0, 140, 255, breatheActive, 0.05);
    }

    static void WheelsForward(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
                                uint8_t r, uint8_t g, uint8_t b, float cometSpeed = 0.5) {
        bool chaseActive[8]  = {false, false, false, false, false, true, true, false};
        bool chaseReversed[8] = {false, false, false, false, false, false, false, false};
        bool breatheCyanActive[8] = {true, true, true, true, true, false, false, false};
        bool breatheRedActive[8] = {false, false, false, false, false, false, false, true};
        CometChase(strips, r, g, b, chaseActive, chaseReversed, cometSpeed);
        BreatheStrips(strips, 0, 140, 255, breatheCyanActive, 0.025);
        BreatheStrips(strips, 255, 0, 0, breatheRedActive, 0.025);
    }

    static void WheelsBackward(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
                                 uint8_t r, uint8_t g, uint8_t b, float cometSpeed = 0.5) {
        bool chaseActive[8]  = {false, false, false, false, false, true, true, false};
        bool chaseReversed[8] = {false, false, false, false, false, true, true, false};
        bool breatheCyanActive[8] = {true, true, true, true, true, false, false, false};
        bool breatheGreenActive[8] = {false, false, false, false, false, false, false, true};
        CometChase(strips, r, g, b, chaseActive, chaseReversed, cometSpeed);
        BreatheStrips(strips, 0, 140, 255, breatheCyanActive, 0.025);
        BreatheStrips(strips, 0, 255, 0, breatheGreenActive, 0.025);
    }

    static void ElevatorScanner(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
        float phase, uint8_t r, uint8_t g, uint8_t b
    ) {
        int layerBrightness[NUM_LAYERS];
        for (int i = 0; i < NUM_LAYERS; i++) layerBrightness[i] = calculateLayerBrightness(phase, i);
        for (int stripIdx = 0; stripIdx < NUM_SEGMENTS; stripIdx++) {
            if (strips[stripIdx] == nullptr) continue;
            int stripBrightness = 0;
            for (int layer = 0; layer < NUM_LAYERS; layer++) {
                for (int j = 0; j < 3; j++) {
                    if (LAYER_STRIPS[layer][j] == stripIdx) { stripBrightness = layerBrightness[layer]; break; }
                }
                if (stripBrightness > 0) break;
            }
            if (stripBrightness > 0) {
                uint8_t outR = (r * stripBrightness) / 255;
                uint8_t outG = (g * stripBrightness) / 255;
                uint8_t outB = (b * stripBrightness) / 255;
                RgbwColor pixelColor(outR, 0, outG, outB);
                for (uint16_t p = 0; p < STRIP_LENGTHS[stripIdx]; p++) strips[stripIdx]->SetPixelColor(p, pixelColor);
            } else {
                strips[stripIdx]->ClearTo(RgbwColor(0, 0, 0, 0));
            }
            strips[stripIdx]->Show();
        }
    }

    static void ElevatorAnimated(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
        bool upward, uint8_t r, uint8_t g, uint8_t b, int durationMs = 2000
    ) {
        const int frameDelayMs = 30;
        int totalFrames = durationMs / frameDelayMs;
        float startPhase = upward ? 5.0 : -1.0;
        float endPhase = upward ? -1.0 : 5.0;
        float phaseStep = (endPhase - startPhase) / (float)totalFrames;
        for (int frame = 0; frame <= totalFrames; frame++) {
            ElevatorScanner(strips, startPhase + phaseStep * frame, r, g, b);
            delay(frameDelayMs);
        }
    }

    static void Breathe(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips,
        uint8_t r, uint8_t g, uint8_t b, float speed = 0.05
    ) {
        static float angle = 0;
        float pulse = (sin(angle) + 1.0) / 2.0;
        uint8_t masterBri = 25 + (uint8_t)(pulse * 190.0);
        for (int stripIdx = 0; stripIdx < NUM_SEGMENTS; stripIdx++) {
            if (strips[stripIdx] == nullptr) continue;
            uint8_t outR = (r * masterBri) / 255;
            uint8_t outG = (g * masterBri) / 255;
            uint8_t outB = (b * masterBri) / 255;
            RgbwColor pixelColor;
            if (r == g && g == b) pixelColor = RgbwColor(outR, outR, outR, outR);
            else pixelColor = RgbwColor(outR, 0, outG, outB);
            for (uint16_t p = 0; p < STRIP_LENGTHS[stripIdx]; p++) strips[stripIdx]->SetPixelColor(p, pixelColor);
            strips[stripIdx]->Show();
        }
        angle += speed;
        if (angle > 6.28318) angle = 0;
    }

    // FADE AT 60 FPS (Vico 2026-10-01: "premier smoothness" for fades). While any crossfade or brightness
    // transition is running, main.cpp renders on the 16 ms music interval instead of 33 ms, and fades
    // are armed with twice the frames so their DURATION is unchanged. Effects, cues and rainbow stay
    // at 30 fps: several of them are timed by frame count. Default 0 = the old 30 fps fades.
    // The 8-bit crossfade alpha caps a crossfade at 255 frames: ~4.1 s at 60 fps (was ~8.4 s).
    static bool fadeFastActive() {
#if ERGOLED_FADE_60FPS
        return isBriTransitioning() || isEffectTransitioning() || breatheFxActive;
#else
        return false;
#endif
    }

    static bool isBriTransitioning() {
        for (uint8_t i = 0; i < NUM_SEGMENTS; i++) {
            if (_segBriAlpha[i] > 0) return true;
        }
        return false;
    }

    static bool isEffectTransitioning() {
        for (uint8_t i = 0; i < NUM_SEGMENTS; i++) {
            if (_segTransAlpha[i] > 0) return true;
        }
        return false;
    }

    // Debug accessors for transition state
    static uint8_t getTransAlpha(uint8_t seg) {
        return (seg < NUM_SEGMENTS) ? _segTransAlpha[seg] : 0;
    }
    static uint8_t getBriAlpha(uint8_t seg) { return _segBriAlpha[seg]; }
    static uint8_t getTargetEffBri(uint8_t seg) { return _segTargetEffBri[seg]; }
    static uint8_t getPrevEffBri(uint8_t seg) { return _segPrevEffBri[seg]; }

    // ═══════════════════════════════════════════════════════
    // Crossfade Helper — blends _prevFrame into current strip buffer
    // Used by both power off fade and normal effect transitions.
    // ═══════════════════════════════════════════════════════

    // Single entry point for arming a crossfade. Every trigger goes through here, and the
    // arm-vs-cancel decision lives here rather than at the call sites.
    //
    // snapTransition == 0 CANCELS any fade in flight. Without that, a zero-transition visual
    // change landing mid-fade would leave the previous fade running and blend the NEW state in
    // over the OLD duration, which is not a snap. The callers must therefore NOT wrap this in
    // their own `snapTransition > 0` guard: three of them used to, which is exactly what made
    // the cancel path unreachable.
    static void startSegmentCrossfade(uint8_t segIdx, uint8_t snapTransition) {
        if (snapTransition == 0) {          // cancel any fade in flight
            _segTransAlpha[segIdx] = 0;
            _segTransStep[segIdx]  = 0;     // reset, so a stale step can never be reused
            return;
        }
        int frames = (int)snapTransition * ERGOLED_FADE_FRAMES_PER_UNIT;
        if (frames < 1)   frames = 1;
        if (frames > 255) frames = 255;     // 8-bit alpha cannot express a longer fade
        int stepI = 255 / frames;
        if (stepI < 1) stepI = 1;
        _segTransStep[segIdx]  = (uint8_t)stepI;
        _segTransAlpha[segIdx] = 255;
    }

    static void applySegmentCrossfade(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>* strip,
        uint8_t segIdx, uint16_t len
    ) {
        if (_segTransAlpha[segIdx] == 0) return;

        // ADVANCE BEFORE BLENDING.
        //
        // alpha weights the OLD frame, so at alpha==255 the blend output IS _prevFrame exactly:
        // one whole render tick (~33ms) that re-displays the OUTGOING effect and discards the
        // frame just rendered. On segment 5 (Desktop Left, 10px) the outgoing frame is an
        // 8-pixel comet head at full brightness -- the fixed min(len,8) tail covers 80% of that
        // short strip -- or an uncapped wheelsWarnPulse sample at a free-running phase. Frozen
        // for a tick and then hard-cut to white, that reads as a flash.
        //
        // Stepping first makes the first DISPLAYED frame already a blend, and makes a
        // step==255 fade resolve to 100% NEW content instead of 100% stale content.
        //
        // Arithmetic widened to int. The old expression narrowed (snapTransition * 3) to
        // uint8_t, so transition>=86 wrapped: 86 -> 258 -> 2, giving a 3-frame fade, and
        // 171 -> 513 -> 1, giving a ONE-frame fade. JsonHelpers clamps transition to 0..255,
        // so both were reachable. alpha is 8-bit and step >= 1, so a fade cannot exceed 255
        // decrements (~8.4s) however large transition is; the clamp says so explicitly rather
        // than relying on the division to saturate.
        // Step was LATCHED at arm time by startSegmentCrossfade, so a write landing
        // mid-fade can no longer change this fade's velocity in flight.
        uint8_t step = _segTransStep[segIdx];
        if (step < 1) step = 1;   // defensive: a fade armed before this field existed

        if (_segTransAlpha[segIdx] > step) _segTransAlpha[segIdx] -= step;
        else                               _segTransAlpha[segIdx] = 0;

        const uint8_t alpha = _segTransAlpha[segIdx];
        if (alpha == 0) return;   // buffer already holds 100% new content
        const uint8_t invAlpha = 255 - alpha;

        for (uint16_t p = 0; p < len; p++) {
            RgbwColor newC = strip->GetPixelColor(p);
            RgbwColor oldC = _prevFrame[segIdx][p];
            strip->SetPixelColor(p, RgbwColor(
                ((uint16_t)oldC.R * alpha + (uint16_t)newC.R * invAlpha) >> 8,
                ((uint16_t)oldC.G * alpha + (uint16_t)newC.G * invAlpha) >> 8,
                ((uint16_t)oldC.B * alpha + (uint16_t)newC.B * invAlpha) >> 8,
                ((uint16_t)oldC.W * alpha + (uint16_t)newC.W * invAlpha) >> 8
            ));
        }
    }

    // ═══════════════════════════════════════════════════════
    // API-Driven Renderer (Phase 5)
    // Renders all segments, applies transition blend + reverse + mirror.
    // Does NOT call Show() — caller handles PowerLimiter + Show.
    // ═══════════════════════════════════════════════════════

    // F1: returns true when a frame was rendered into the strip buffers, false
    // when it skipped on a gState.lock() timeout (buffers left untouched). The
    // caller gates the rest of the pipeline (PowerLimiter/Show/clearDirty) on this
    // so a skipped frame can't be re-power-limited (the flicker root cause).
    static bool renderFromState(
        NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips
    ) {
        // Snapshot global+segment state under lock to prevent torn reads
        bool snapOn;
        uint8_t snapBri, snapTransition;
        SegmentState snapSeg[NUM_SEGMENTS];

        if (gState.lock(pdMS_TO_TICKS(5))) {
            snapOn = gState.on;
            snapBri = gState.bri;
            snapTransition = gState.transition;
            memcpy(snapSeg, gState.segments, sizeof(snapSeg));
            // User palette slots ride the same snapshot as the segments that point at them, so a
            // commit that defines a palette and assigns it lands in one frame. Copied only when a
            // write has moved the generation: a desk that never uses a user palette pays this
            // compare and nothing else.
            if (gState.upalGen != _upalGenSeen) {
                PaletteEngine::loadUserSlots(gState.upal);
                _upalGenSeen = gState.upalGen;
            }
            gState.unlock();
        } else {
            return false;  // F1: skip frame on contention — buffers untouched; the
                           // caller holds the last shown frame and skips the pipeline.
        }

        // 60 fps render gate (read by main.cpp): true iff a MUSIC FX (28-33 or
        // 37-40) is live. Computed here from the locked snapshot — no extra lock
        // in the loop. anyDrop additionally gates the FX 40 state machine.
        bool anyBreathe = false;   // FX 2 on any segment: renders at 60 fps when ERGOLED_FADE_60FPS (see fadeFastActive)
        bool anyMusic = false;
        bool anyDrop = false;
        for (uint8_t i = 0; i < NUM_SEGMENTS; i++) {
            // 60 fps set (ERGOLED_FADE_60FPS): breathe (2, frame-scaled), the legacy wheels chase (4, frame-scaled)
            // and the movement cues 34/35/36 (wall-clock driven, so 60 fps only smooths them).
            if (snapSeg[i].fx == 2 || snapSeg[i].fx == 4 || snapSeg[i].fx == FX_LIFT ||
                snapSeg[i].fx == FX_TILT || snapSeg[i].fx == FX_WHEELS) anyBreathe = true;
            if (isMusicFx(snapSeg[i].fx)) {
                anyMusic = true;
                if (snapSeg[i].fx == FX_MUSIC_DROP) anyDrop = true;
            }
        }
        musicFxActive = anyMusic;
        breatheFxActive = anyBreathe;

        // FX 41: stages 1-6 once for all ambient strips (the flash guard and power gain are global). Not a music FX, so
        // none of the music state below (randomised flip, burst wash) is touched on its account.
        uint8_t ambientMask = 0;
        for (uint8_t i = 0; i < NUM_SEGMENTS; i++)
            if (isAmbientFx(snapSeg[i].fx) && snapSeg[i].on && snapOn) ambientMask |= (uint8_t)(1u << i);
        ambientFxActive = ambientMask != 0;
        if (ambientMask != 0) {
            const uint32_t t0 = micros();
            Ambient::step(millis(), ambientMask, PowerLimiter::effectiveLimitMA());
            ambientDeficitMA = Ambient::st().powerDeficitMA;
            AmbientDiag::noteRenderUs((uint32_t)(micros() - t0));
        } else {
            ambientDeficitMA = 0;
            Ambient::st().lastStepMs = 0;   // the next run of ambient frames re-enters softly
        }

        // Shared music config snapshot for the once-per-frame advance below AND the per-segment
        // burst/randomize overlay in the loop. Default-constructed when music is off (the loop's
        // overlay guards short-circuit on !anyMusic, so its fields are never read in that case).
        // NOTE: this only shares config across the overlay paths — the per-FX gMusicConfig
        // .getConfig() calls and readSmoothedAudio()'s own snapshot are unchanged, so the frame
        // is NOT unified onto one config (no claim of removing the per-FX one-frame skew).
        MusicConfig musicCfg;

        // ── Color-dynamics + burst/randomize advance (once per frame, before the loop) ──
        // Reads RAW cached audio directly (NOT readSmoothedAudio, which would double-step the
        // per-band EMA). musicColorPhase() reads _colorPhaseAccumQ per FX.
        if (anyMusic) {
            musicCfg = gMusicConfig.getConfig();

            extern volatile uint8_t audioEnergy, audioBeat, audioBassBeat;
            extern volatile uint8_t audioBpm, audioFlags, audioEnvelope, audioPacketVer;
            extern volatile bool audioActive;
            extern volatile unsigned long audioLastUpdate;
            extern portMUX_TYPE audioMetricsMux;

            uint8_t rEnergy, rBpm, rFlags, rEnvelope, rPacketVer;
            bool rBeat, rBassBeat, rActive;
            unsigned long rLast;
            portENTER_CRITICAL(&audioMetricsMux);
            rEnergy = audioEnergy; rBeat = (audioBeat != 0); rBassBeat = (audioBassBeat != 0);
            rBpm = audioBpm; rFlags = audioFlags; rEnvelope = audioEnvelope;
            rPacketVer = audioPacketVer;
            rActive = audioActive; rLast = audioLastUpdate;
            portEXIT_CRITICAL(&audioMetricsMux);
            bool stale = (!rActive || (millis() - rLast > musicCfg.stalenessMs));
            if (stale) {
                rEnergy = 0; rBeat = false; rBassBeat = false;
                rBpm = 0; rFlags = 0; rEnvelope = 0;
            }

            // Independent beat-edge clock for the layer FX (ripple fallback sweep).
            // Separate tracker so it can never disturb the shared _prevBeat edge.
            if (rBeat && !_prevBeatClock) _lastBeatMs = millis();
            _prevBeatClock = rBeat;

            // FX 40 shared state machine (only advanced while a Drop segment renders)
            if (anyDrop) {
                advanceDropState(musicCfg, rEnergy, rBassBeat, rFlags, rEnvelope, rPacketVer);
            } else if (_dropState != 0) {
                _dropState = 0;
                _dropWash = 0;
            }

            bool dynOff = (musicCfg.colorMotionSpeed == 0 && musicCfg.colorSpread == 0 &&
                           musicCfg.energyToMotion == 0 && musicCfg.beatHueStep == 0 &&
                           musicCfg.peakBandToHue == 0);
            bool advanceOff = (musicCfg.colorMotionSpeed == 0 && musicCfg.energyToMotion == 0 &&
                               musicCfg.beatHueStep == 0);

            // Single beat rising edge owned by ALL beat consumers (drift advance, bursts,
            // randomize). The drift path consumes beats only when it advances (!advanceOff).
            // Without shared ownership, a held audioBeat would fake a rising edge every frame
            // when bursts/randomize run while color-dynamics is off.
            bool beatConsumer = musicCfg.burstEnable || musicCfg.randomizeFlip || !advanceOff;
            bool beatRising = false;
            if (beatConsumer) { beatRising = (rBeat && !_prevBeat); _prevBeat = rBeat; }
            else              { _prevBeat = false; }

            // Drift accumulator — exact prior semantics; _prevBeat writes moved out (above).
            if (dynOff) {
                // accumulator untouched — off-gate makes its value irrelevant
            } else if (advanceOff) {
                _colorPhaseAccumQ = 0;                      // spread/freq-only → deterministic base
            } else {
                uint16_t inc;
                if (musicCfg.driftBeatSync && rBpm > 0) {
                    // Beat-synced drift (Music Mode 2.0): colorMotionSpeed palette-units
                    // PER BEAT, spread evenly across frames. Q8.8 per-frame increment =
                    // speed*256 * (bpm/60) / 60fps = speed*256*bpm/3600. Clamped to 4
                    // palette-units/frame. Falls through to per-ms when no tempo lock.
                    uint32_t q = (((uint32_t)musicCfg.colorMotionSpeed << 8) * rBpm) / 3600u;
                    if (musicCfg.energyToMotion) {
                        q += ((uint16_t)rEnergy * musicCfg.energyToMotion) >> 8;
                    }
                    inc = (q > 1024) ? 1024 : (uint16_t)q;
                } else {
                    inc = musicCfg.colorMotionSpeed +
                          (musicCfg.energyToMotion ? (((uint16_t)rEnergy * musicCfg.energyToMotion) >> 8) : 0);
                    if (inc > 255) inc = 255;              // ≤<1 palette-unit/frame → ~0.25 cycle/s @60fps
                }
                _colorPhaseAccumQ += inc;                   // wraps at 0x10000 = 256 palette units
                if (beatRising) _colorPhaseAccumQ += ((uint16_t)musicCfg.beatHueStep << 8);
            }

            // Burst overlay advance: beat-triggered, or free-running by burstRate. Bursts require
            // real audio energy — NOT just fresh packets. `stale` only catches "no data arriving";
            // with System Audio the analyzer keeps streaming e=0 frames during silence
            // (fresh-but-silent), so without an energy gate the free-running timer "heartbeats"
            // with no music playing. Envelope decays for the "pulse in and out" feel.
            if (musicCfg.burstEnable) {
                unsigned long now = millis();
                // Normalized energy (0-255) below this counts as silence → no bursts. Digital
                // silence (paused System Audio) reads e=0; the small floor also rejects faint
                // mic/line noise so the desk stays dark until there's actual sound.
                const uint8_t kBurstSilenceFloor = 6;
                bool soundPresent = !stale && (rEnergy >= kBurstSilenceFloor);
                bool dropHit = false;
                uint8_t gain = advanceBurstSection(musicCfg, now, rFlags, &dropHit);
                bool trigger = soundPresent && (beatRising || dropHit);
                if (!trigger && soundPresent && musicCfg.burstRate > 0) {
                    if (now - _lastBurstMs >= burstPeriodMs(musicCfg.burstRate, musicCfg.comfortMode)) trigger = true;
                }
                if (gain < 8 && !dropHit) trigger = false;   // calm / build hold: no new bursts
                // comfortMode: 350ms full-field flash floor — resolves the deferred
                // "burst path has no strobe floor" hardware-comfort decision. Beat-
                // and timer-triggered bursts both respect it; 0 = full send.
                if (trigger && musicCfg.comfortMode && (now - _lastBurstMs) < 350) {
                    trigger = false;
                }
                if (trigger) {
                    _lastBurstMs = now;
                    uint16_t env = 140u + rEnergy;          // energy-reactive amplitude
                    if (dropHit) env = 255;                 // the drop gets the full-strength hit
                    _burstEnv = env > 255 ? 255 : (uint8_t)env;  // explicit saturate, no wrap
                    advanceBurstHue(musicCfg.burstSpectrum);
                }
                if (_burstEnv > 0) {                         // decay (~250-350 ms tail @60fps)
                    // Gate-2 feel: exponential decay (~4%/frame) — a natural
                    // flash-then-glow tail instead of a linear ramp-down.
                    // burstTail 128 = 245/256 (classic); 0..255 -> 238..252 (snappier..longer glow)
                    int16_t df = 245 + (((int16_t)musicCfg.burstTail - 128) * 7) / 127;
                    _burstEnv = (uint8_t)(((uint16_t)_burstEnv * (uint16_t)df) >> 8);
                }
            } else {
                _burstEnv = 0; _burstGain = 255; _burstHype = true;   // re-enable starts in hype
            }

            // Beat-randomized reverse/mirror: pick a new combo on a beat, anti-strobe guarded.
            // _randFlipValid stays false until the first beat so manual rev/mi hold until then;
            // disabling resets it so re-enabling also waits for a fresh beat (no stale snap).
            if (musicCfg.randomizeFlip) {
                unsigned long now = millis();
                // randomizeRate -> minimum spacing between flips. 255 = every beat (350ms
                // anti-strobe floor = legacy behavior); lower spaces flips out, up to ~3s at 0.
                // Result is always >= 350ms so the strobe floor is never breached.
                uint16_t minFlipMs =
                    (uint16_t)(350 + (((uint32_t)(255 - musicCfg.randomizeRate) * (3000 - 350)) / 255));
                if (beatRising && (now - _lastFlipMs >= minFlipMs)) {
                    uint8_t c = (uint8_t)random(4);         // 0..3 (Arduino PRNG, as in fxMusicFire)
                    _randRev = (c & 0x01) != 0;
                    _randMi  = (c & 0x02) != 0;
                    _randFlipValid = true;
                    _lastFlipMs = now;
                }
            } else {
                _randFlipValid = false;
            }
        } else {
            _prevBeat = false;            // music off → no stale rising edge on resume
            _burstEnv = 0; _burstGain = 255; _burstHype = true;
            _randRev = _randMi = false;
            _randFlipValid = false;
        }

        for (uint8_t i = 0; i < NUM_SEGMENTS; i++) {
            if (!strips[i]) continue;
            const SegmentState& seg = snapSeg[i];
            uint16_t len = getLen(i);

            bool segOff = !seg.on || !snapOn;

            if (segOff) {
                // Detect on→off transition → trigger fade-to-black
                if (_segPrevOn[i]) {
                    startSegmentCrossfade(i, snapTransition);
                }
                _segPrevOn[i] = false;

                // Render black as the "new" frame
                strips[i]->ClearTo(RgbwColor(0, 0, 0, 0));

                // If crossfade active, blend _prevFrame (old lit state) → black
                if (_segTransAlpha[i] > 0) {
                    applySegmentCrossfade(strips[i], i, len);
                }
                continue;  // Skip effect rendering
            }

            // Detect off→on transition → trigger fade-from-black
            if (!_segPrevOn[i]) {
                _segPrevOn[i] = true;
                startSegmentCrossfade(i, snapTransition);
            }

            // Detect FX change → start transition
            if (seg.fx != _segPrevFx[i]) {
                startSegmentCrossfade(i, snapTransition);
                _segPrevFx[i] = seg.fx;   // latches unconditionally, or the trigger re-fires
            }

            // Detect color or palette change → start crossfade.
            //
            // The third term catches a user palette whose CONTENTS changed while seg.pal stayed
            // put (the same slot redefined), which is a colour change to anyone watching. It is
            // 0 == 0 for every built-in id (userSlotIdentity returns 0 for 0-21), so it cannot
            // fire for them and their crossfades are exactly as before.
            const uint64_t upalIdentity = PaletteEngine::userSlotIdentity(seg.pal);
            if (memcmp(seg.col, _segPrevCol[i], sizeof(seg.col)) != 0 || seg.pal != _segPrevPal[i] ||
                upalIdentity != _segPrevUpal[i]) {
                startSegmentCrossfade(i, snapTransition);
                memcpy(_segPrevCol[i], seg.col, sizeof(seg.col));
                _segPrevPal[i] = seg.pal;
                _segPrevUpal[i] = upalIdentity;
            }

            // Calculate target effective brightness
            uint8_t targetBri = ((uint16_t)snapBri * seg.bri) / 255;

            // Detect brightness change → start linear transition
            if (targetBri != _segTargetEffBri[i]) {
                // Capture current position as start of new transition
                _segPrevEffBri[i] = (_segBriAlpha[i] > 0)
                    ? (uint8_t)_segBriFloat[i]   // mid-transition: use float position
                    : _segTargetEffBri[i];        // at rest: use last target
                _segTargetEffBri[i] = targetBri;

                if (snapTransition > 0) {
                    // Calculate frames for this transition (snapTransition * 3 ≈ frames at ~30fps)
                    int frames = (int)snapTransition * ERGOLED_FADE_FRAMES_PER_UNIT;
                    if (frames < 1) frames = 1;
                    // Constant-velocity step (linear ramp, not asymptotic)
                    _segBriStep[i] = (float)(targetBri - _segPrevEffBri[i]) / (float)frames;
                    _segBriFloat[i] = (float)_segPrevEffBri[i];
                    _segBriAlpha[i] = 1;  // Mark transition active
                } else {
                    _segBriAlpha[i] = 0;  // Instant
                }
                if (i == 0) {
                    // COUNTED ALWAYS, PRINTED ONLY UNDER DEBUG.
                    //
                    // This was an unconditional production printf in the render path, while its
                    // siblings BRI-DONE and BRI-TICK below were correctly behind
                    // ERGOLED_DEBUG_BRI — it was simply missed. On 2026-08-13 the host's
                    // pre-drain caught 128 identical BRI-INIT lines in a single window, which
                    // is a protocol channel carrying render-loop chatter.
                    //
                    // The count stays because the frequency question is still open: whether
                    // transitions initialise far more often than the host issues writes is not
                    // yet settled, and `bri.inits` answers it from {DIAG} without putting a
                    // single byte on the wire.
                    SerialDiag::noteBriInit(_segPrevEffBri[0], targetBri);
#ifdef ERGOLED_DEBUG_BRI
                    Serial.printf("[FX] BRI-INIT seg0 prev=%u tgt=%u step=%.3f frames=%d trans=%u\n",
                        _segPrevEffBri[0], targetBri,
                        _segBriStep[0], (snapTransition > 0) ? (int)snapTransition * 3 : 0,
                        snapTransition);
#endif
                }
            }

            // Interpolate brightness using constant-velocity linear ramp
            uint8_t effectiveBri;
            if (_segBriAlpha[i] > 0 && snapTransition > 0) {
                _segBriFloat[i] += _segBriStep[i];
                // Clamp to target to prevent overshoot
                if ((_segBriStep[i] > 0 && _segBriFloat[i] >= (float)targetBri) ||
                    (_segBriStep[i] < 0 && _segBriFloat[i] <= (float)targetBri) ||
                    _segBriStep[i] == 0.0f) {
                    _segBriFloat[i] = (float)targetBri;
                    _segBriAlpha[i] = 0;  // Transition complete
#ifdef ERGOLED_DEBUG_BRI
                    if (i == 0) {
                        Serial.printf("[FX] BRI-DONE seg0 final=%u target=%u\n",
                            (uint8_t)_segBriFloat[0], targetBri);
                    }
#endif
                }
                effectiveBri = (uint8_t)max(0.0f, min(255.0f, _segBriFloat[i]));
            } else {
                effectiveBri = targetBri;
                _segBriAlpha[i] = 0;
            }

#ifdef ERGOLED_DEBUG_BRI
            // [TRACE] Periodic brightness state for seg 0 (debug builds only — F5:
            // was unconditional ~1 Hz serial spam in the production esp32dev build).
            static uint16_t _fxTraceCount = 0;
            if (i == 0 && (++_fxTraceCount % 30 == 0)) {
                Serial.printf("[FX] BRI-TICK seg0 eff=%u tgt=%u float=%.1f step=%.3f alpha=%u snapBri=%u segBri=%u trans=%u\n",
                    effectiveBri, targetBri, _segBriFloat[0], _segBriStep[0],
                    _segBriAlpha[0], snapBri, seg.bri, snapTransition);
            }
#endif

            // Render new effect into strip buffer. Gate-2 feel: gamma-correct ONLY
            // the music effects (28-33, 37-40); status/safety/movement/solid stay
            // LINEAR so safety-indicator brightness is provably unaffected.
            // Per-strip "gc" (a person-picked colour) joins them: an OR, so a music strip with gc is
            // still gamma'd exactly ONCE. Indicators never send gc, so they stay linear.
            s_applyGamma = isMusicFx(seg.fx) || seg.gc;
            s_applyTrim = s_applyGamma && HueTrim::enabledFor((uint8_t)i);
            switch (seg.fx) {
                case 0:  fxSolid(strips[i], i, seg, effectiveBri); break;
                case 1:  fxBlink(strips[i], i, seg, effectiveBri); break;
                case 2:  fxBreathe(strips[i], i, seg, effectiveBri); break;
                case 3:  fxFade(strips[i], i, seg, effectiveBri); break;
                case 4:  fxChase(strips[i], i, seg, effectiveBri); break;
                case 5:  fxScanner(strips[i], i, seg, effectiveBri); break;
                case 6:  fxMeteor(strips[i], i, seg, effectiveBri); break;
                case 7:  fxMeteorSmooth(strips[i], i, seg, effectiveBri); break;
                case 8:  fxRunning(strips[i], i, seg, effectiveBri); break;
                case 9:  fxLarson(strips[i], i, seg, effectiveBri); break;
                case 10: fxTwinkle(strips[i], i, seg, effectiveBri); break;
                case 11: fxColorTwinkles(strips[i], i, seg, effectiveBri); break;
                case 12: fxSparkle(strips[i], i, seg, effectiveBri); break;
                case 13: fxTwinklefox(strips[i], i, seg, effectiveBri); break;
                case 14: fxColorloop(strips[i], i, seg, effectiveBri); break;
                case 15: fxRainbow(strips[i], i, seg, effectiveBri); break;
                case 16: fxPaletteRun(strips[i], i, seg, effectiveBri); break;
                case 17: fxGradient(strips[i], i, seg, effectiveBri); break;
                case 18: fxFire(strips[i], i, seg, effectiveBri); break;
                case 19: fxAurora(strips[i], i, seg, effectiveBri); break;
                case 20: fxPacifica(strips[i], i, seg, effectiveBri); break;
                case 21: fxCandle(strips[i], i, seg, effectiveBri); break;
                case 22: fxStrobe(strips[i], i, seg, effectiveBri); break;
                case 23: fxHeartbeat(strips[i], i, seg, effectiveBri); break;
                case 24: fxFireworks(strips[i], i, seg, effectiveBri); break;
                case 25: fxElevator(strips[i], i, seg, effectiveBri); break;
                case 26: fxCascade(strips[i], i, seg, effectiveBri); break;
                case 27: fxHeightSync(strips[i], i, seg, effectiveBri); break;
                case 28: fxMusicSpectrum(strips[i], i, seg, effectiveBri); break;
                case 29: fxMusicPulse(strips[i], i, seg, effectiveBri); break;
                case 30: fxMusicComet(strips[i], i, seg, effectiveBri); break;
                case 31: fxMusicStrobe(strips[i], i, seg, effectiveBri); break;
                case 32: fxMusicFire(strips[i], i, seg, effectiveBri); break;
                case 33: fxMusicWave(strips[i], i, seg, effectiveBri); break;
                case 34: fxLift(strips[i], i, seg, effectiveBri); break;    // Movement: lift
                case 35: fxTilt(strips[i], i, seg, effectiveBri); break;    // Movement: tilt
                case 36: fxWheels(strips[i], i, seg, effectiveBri); break;  // Movement: wheels
                case 37: fxMusicTower(strips[i], i, seg, effectiveBri); break;   // Layer music
                case 38: fxMusicRipple(strips[i], i, seg, effectiveBri); break;  // Layer music
                case 39: fxMusicBassSky(strips[i], i, seg, effectiveBri); break; // Layer music
                case 40: fxMusicDrop(strips[i], i, seg, effectiveBri); break;    // Layer music
                case FX_AMBIENT: fxAmbient(strips[i], i, effectiveBri); break;   // AMBIENT_V1 picture
                default: fxSolid(strips[i], i, seg, effectiveBri); break;
            }
            s_applyGamma = false;  // gamma wraps ONLY the FX render; crossfade/overlay stay linear
            s_applyTrim = false;   // and so does the hue trim

            // Reverse/Mirror — beat-randomized when randomizeFlip is on (music only) AND a beat
            // has been seen (_randFlipValid); otherwise the manual per-segment rev/mi. The guard
            // means turning Beat Randomize on never snaps direction until the first real beat.
            bool useRev = seg.rev, useMi = seg.mi;
            if (anyMusic && musicCfg.randomizeFlip && _randFlipValid) {
                useRev = _randRev; useMi = _randMi;
            }
            if (useRev) applyReverse(strips[i], len);   // logical pixel index inversion
            if (useMi)  applyMirror(strips[i], len);    // mirror the resulting buffer

            // Transition crossfade blend with previous frame
            applySegmentCrossfade(strips[i], i, len);

            // Color-burst overlay: vivid HSV wash blended over the FINAL buffer (after crossfade
            // so the pulse stays crisp), per-strip weighted by burstZone. FX- and palette-
            // agnostic; gated by burstEnable so the classic look is untouched when off.
            if (anyMusic && musicCfg.burstEnable && _burstEnv > 0) {
                uint8_t w   = burstStripWeight(i, musicCfg.burstZone);
                uint8_t amt = (uint8_t)(((uint16_t)_burstEnv * w) >> 8);
                amt = (uint8_t)(((uint16_t)amt * ((uint16_t)musicCfg.burstDepth + 1)) >> 8);  // depth 255 = exact
                if (_burstGain != 255) amt = (uint8_t)(((uint16_t)amt * ((uint16_t)_burstGain + 1)) >> 8);
                if (amt) {
                    uint8_t br, bg, bb;
                    hsvToRgb(_burstHue, 255, 255, br, bg, bb);
                    for (uint16_t p = 0; p < len; p++) {
                        strips[i]->SetPixelColor(p, burstWash(strips[i]->GetPixelColor(p), br, bg, bb, amt));
                    }
                }
            }

        }
        return true;  // F1: frame rendered — caller commits the pipeline.
    }

    /**
     * Save current strip pixels to _prevFrame.
     * Call AFTER PowerLimiter::apply() so _prevFrame matches what was actually shown.
     */
    static void savePrevFrame(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips) {
        for (uint8_t i = 0; i < NUM_SEGMENTS; i++) {
            if (!strips[i]) continue;
            uint16_t len = getLen(i);
            for (uint16_t p = 0; p < len; p++) {
                _prevFrame[i][p] = strips[i]->GetPixelColor(p);
            }
        }
    }

    /**
     * Call Show() on all strips. Final step in frame pipeline.
     */
    // SERIAL SHOW ({SHOWMODE 1}, output/ShowMode.hpp; the default since ota8). Each strip is an RMT channel refilled by ONE
    // interrupt about every 40us, and starting all 8 back to back puts up to 8 refills due at once: a
    // late one sends stale bits, which is one wrong frame on one strip. Sending one strip and waiting
    // for it to finish before the next keeps at most one channel refilling. Cost: about 0.6ms per
    // 15-pixel strip, ~5ms of a 33ms frame. The wait is bounded (kShowWaitUs per strip) so a channel
    // that never reports done can delay a frame but never hang the loop; those are counted.
    // {DIAG} show.* reports the mode and timing (SerialDiag::noteShow).
    static const uint32_t kShowWaitUs = 3000;
    // ERGOLED_STRIP_GAP_US: a settle gap after each strip in serial show, in case one line's switching
    // disturbs the next through the shared ground. Compiled in, 0 (off) by default; {DIAG} show.gap_us.
#ifndef ERGOLED_STRIP_GAP_US
#define ERGOLED_STRIP_GAP_US 0
#endif
    static const uint32_t kStripGapUs = ERGOLED_STRIP_GAP_US;

    // FRAME DECIMATION (ota10). Desktop Left (strip 5) flashes on a marginal line, a few per 10 minutes of
    // continuous animation even with in-spec timing, max drive and serial show, and the flashes scale with
    // the frames sent on that line. Strips in kDecimateMask are sent only every kDecimateN-th showAll() while
    // things change; the buffer is still rendered every frame (effects, crossfade and power limiting are
    // untouched), only the transmission is skipped. showAll(strips, true) sends every strip: main.cpp passes
    // it on the settle re-sends (output/SettleRefresh.hpp), so the finished frame always reaches a decimated
    // strip within 100 ms of the last change, and again at +500 ms. {DIAG} show.decim_*.
    // ota12: TIME-based and TRANSITIONS ONLY (output/Decimate.hpp): a masked strip is throttled only while
    // its own crossfade or brightness transition runs, to one send per Decimate::intervalMs() (55 ms,
    // ~18 fps, {DECIMMS n}); running effects, music and rainbow are sent every frame.
    // ota13: with Decimate::kScopeAlways (ERGOLED_DECIMATE_SCOPE_ALWAYS) a masked strip is throttled on every
    // frame, effects included.
    static const uint8_t kDecimateMask = Decimate::kMask;
    static uint32_t _decimLastSentMs[NUM_SEGMENTS];

    static bool segTransitioning(uint8_t i) { return _segTransAlpha[i] > 0 || _segBriAlpha[i] > 0; }

    static void showAll(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips, bool forceAll = false) {
        const uint32_t t0 = micros();
        const int rx0 = Serial.available();
        uint32_t timeouts = 0;
        const uint32_t nowMs = millis();
        const uint16_t decimMs = Decimate::intervalMs();
        for (uint8_t i = 0; i < NUM_SEGMENTS; i++) {
            if (!strips[i]) continue;
            if (!forceAll && decimMs > 0 && i < 8 && ((kDecimateMask >> i) & 1u) &&
                (Decimate::kScopeAlways || segTransitioning(i)) &&
                (uint32_t)(nowMs - _decimLastSentMs[i]) < decimMs) {
                SerialDiag::decimSkipped++;
                continue;
            }
            _decimLastSentMs[i] = nowMs;
            strips[i]->Show();
            if (!ShowMode::serial()) continue;
            const uint32_t w0 = micros();
            while (!strips[i]->CanShow()) {
                if ((uint32_t)(micros() - w0) > kShowWaitUs) {
                    timeouts++;
                    break;
                }
            }
            if (kStripGapUs > 0) delayMicroseconds(kStripGapUs);  // settle between lines (off by default)
        }
        SerialDiag::stripGapUs = kStripGapUs;
        SerialDiag::decimMask = kDecimateMask;
        SerialDiag::decimMs = decimMs;
        SerialDiag::decimScope = Decimate::scopeName();
        SerialDiag::noteShow(ShowMode::serial(), (uint32_t)(micros() - t0), Serial.available() > rx0,
                             timeouts);
    }
};

// ═══════════════════════════════════════════════════════
// Static Member Definitions
// ═══════════════════════════════════════════════════════
constexpr int EffectEngine::LAYER_STRIPS[5][3];
constexpr uint8_t EffectEngine::COMET_TAIL_LUT[MAX_PIXELS_PER_STRIP];

// Keyboard composite state
float EffectEngine::_cometPos[NUM_SEGMENTS] = {0};
unsigned long EffectEngine::_lastCometUpdate = 0;

// API-driven per-segment state
float EffectEngine::_segPhase[NUM_SEGMENTS] = {0};
float EffectEngine::_segBreatheAngle[NUM_SEGMENTS] = {0};
float EffectEngine::_segCometPos[NUM_SEGMENTS] = {0};
float EffectEngine::_segMeteorPos[NUM_SEGMENTS] = {0};
uint8_t EffectEngine::_segFireHeat[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP] = {{0}};
uint8_t EffectEngine::_segTwinkleState[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP] = {{0}};
uint8_t EffectEngine::_segTwinkleFade[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP] = {{0}};
uint16_t EffectEngine::_segRandom[NUM_SEGMENTS] = {1, 3, 7, 13, 31, 61, 127, 251};
float EffectEngine::_segElevatorPhase = 0;
float EffectEngine::_segCascadeLayer = 0;

// Movement FX 34-36 (Lift/Tilt/Wheels) are millis()-based and hold no per-segment
// state. This flag is the only state they need (60 fps gate, see main.cpp).
volatile bool EffectEngine::musicFxActive = false;
volatile bool EffectEngine::ambientFxActive = false;
volatile uint32_t EffectEngine::ambientDeficitMA = 0;
volatile bool EffectEngine::breatheFxActive = false;
volatile uint8_t EffectEngine::renderIntervalMs = 33;
EffectEngine::MotionPhase EffectEngine::_liftPhase = {0.0f, 0, false};
EffectEngine::MotionPhase EffectEngine::_tiltPhase = {0.0f, 0, false};
EffectEngine::MotionPhase EffectEngine::_wheelsCometPhase = {0.0f, 0, false};
// Compile-time guard: movement FX 34-36 + layer music FX 37-40 require
// NUM_EFFECTS=41 AND matching entries in all 3 JSON name surfaces
// (fxNames[], /json/eff, /json/fxdata).
static_assert(NUM_EFFECTS == 42, "FX 34-41 require NUM_EFFECTS==42 + 42 aligned JSON effect names");
constexpr uint8_t EffectEngine::STRIP_LAYER[NUM_SEGMENTS];
static_assert(Ambient::kStrips == NUM_SEGMENTS, "ambient/Ambient.hpp sizes its tables by NUM_SEGMENTS");
static_assert(EffectEngine::ambientLayersMatch(), "Ambient::kLayer must equal EffectEngine::STRIP_LAYER");

// Transition state
RgbwColor EffectEngine::_prevFrame[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP] = {{{0}}};
uint32_t EffectEngine::_decimLastSentMs[NUM_SEGMENTS] = {0};
uint8_t EffectEngine::_segPrevFx[NUM_SEGMENTS] = {255, 255, 255, 255, 255, 255, 255, 255};
uint8_t EffectEngine::_segTransAlpha[NUM_SEGMENTS] = {0};
uint8_t EffectEngine::_segTransStep[NUM_SEGMENTS] = {0};

// Color/palette/power change tracking
uint8_t EffectEngine::_segPrevCol[NUM_SEGMENTS][3][4] = {{{0}}};
uint8_t EffectEngine::_segPrevPal[NUM_SEGMENTS] = {0};
uint64_t EffectEngine::_segPrevUpal[NUM_SEGMENTS] = {0};
uint32_t EffectEngine::_upalGenSeen = 0;
bool    EffectEngine::_segPrevOn[NUM_SEGMENTS] = {true, true, true, true, true, true, true, true};

// Brightness transition state
uint8_t EffectEngine::_segPrevEffBri[NUM_SEGMENTS] = {0};
uint8_t EffectEngine::_segTargetEffBri[NUM_SEGMENTS] = {0};
uint8_t EffectEngine::_segBriAlpha[NUM_SEGMENTS] = {0};
float EffectEngine::_segBriFloat[NUM_SEGMENTS] = {0};
float EffectEngine::_segBriStep[NUM_SEGMENTS] = {0};

// Music mode static initializers
float EffectEngine::_smoothBands[8] = {0};
uint16_t EffectEngine::_colorPhaseAccumQ = 0; // color-dynamics phase (Q8.8)
bool EffectEngine::_prevBeat = false;          // shared beat rising-edge tracker
// Color bursts overlay + beat-randomized reverse/mirror
uint8_t EffectEngine::_burstEnv = 0;
bool EffectEngine::s_applyGamma = false;
bool EffectEngine::s_applyTrim = false;
uint8_t EffectEngine::_burstHue = 0;
uint8_t EffectEngine::_burstStep = 0;
unsigned long EffectEngine::_lastBurstMs = 0;
bool EffectEngine::_burstHype = true;
uint8_t EffectEngine::_burstGain = 255;
unsigned long EffectEngine::_burstSectMs = 0;
bool EffectEngine::_burstPrevDrop = false;
bool EffectEngine::_randRev = false;
bool EffectEngine::_randMi = false;
bool EffectEngine::_randFlipValid = false;
unsigned long EffectEngine::_lastFlipMs = 0;
// Music Mode 2.0 layer-FX state
unsigned long EffectEngine::_lastStrobeFlashMs[NUM_SEGMENTS] = {0};
unsigned long EffectEngine::_lastBeatMs = 0;
bool EffectEngine::_prevBeatClock = false;
uint8_t EffectEngine::_dropState = 0;
unsigned long EffectEngine::_dropSlamMs = 0;
uint8_t EffectEngine::_dropWash = 0;
uint8_t EffectEngine::_pulseDecay[NUM_SEGMENTS] = {0};
uint8_t EffectEngine::_rippleDelay[NUM_SEGMENTS] = {0};
uint8_t EffectEngine::_pendingFlash[NUM_SEGMENTS] = {0};

// FX 30 Music Comet
float EffectEngine::_cometMusicPos[NUM_SEGMENTS] = {0};
unsigned long EffectEngine::_lastCometMusicUpdate = 0;

// FX 31 Music Strobe
uint8_t EffectEngine::_strobeDecay[NUM_SEGMENTS] = {0};

// FX 32 Music Fire
uint8_t EffectEngine::_fireHeat[NUM_SEGMENTS][MAX_PIXELS_PER_STRIP] = {{0}};

// FX 33 Music Wave
float EffectEngine::_wavePhase[NUM_SEGMENTS] = {0};

#endif  // EFFECT_ENGINE_H
