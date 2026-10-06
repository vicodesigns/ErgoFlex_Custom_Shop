#pragma once
// AMBIENT_V1: the combined colour + audio frame, its lease, and the board-side render stages of FX 41 (AMBIENT).
// Spec: docs/game_mode/GAME_MODE_WIRE_SPEC.md (leds lane, 2026-10-01). Everything here is pure computation over
// bytes and an explicit clock, so the whole path runs on the host (test/native_ambient). It owns no hardware: the
// frame parser (audio/AudioSerialFrame.hpp) hands it a destuffed payload, EffectEngine::renderFromState calls
// step() once per rendered frame and emit() once per ambient strip.
//
// FRAME (little endian, after unstuffing; type 0x10 under the 0xAD sentinel):
//   0 0xAD | 1 0x10 | 2 seq | 3 flags | 4 S | 5 nudge | 6.. per strip: K, K x (R,G,B sRGB8) | audio block if flags.b0
//   (19 B = bytes 3..21 of the audio v2 packet, then energyL, energyR) | CRC-16/CCITT-FALSE over bytes 1..end-3, LE.
//   flags: b0 audio, b1 hold request, b2 scene cut, b4-5 mode (0 Calm, 1 Normal, 2 Intense).
//
// RENDER STAGES, in this order (reviews 3-8 of the game-mode design; the wire spec's section 7):
//   1 decode sRGB8 -> linear, interpolate K keys across the strip in linear light      (install())
//   2 temporal one-pole toward the newest target, time constant ~0.5 x the measured frame gap, clamped 8..33 ms
//   3 audio fusion (only while the audio block is fresh): layer-travelling bass, energy gain, highs sparkle in the
//     pixel's own hue, stereo L/R on Desktop Left/Right, depth by mode
//   4 RGBW: a continuous, hysteretic white crossfade (pastels keep their colour, near-white moves to the W die)
//   5 power gain: the estimated current against the limit, smoothed (attack 200 ms, release 1 s)
//   6 flash guard, LAST of the dynamics: WCAG 2.3.1-style swing counting in linear light, per strip plus a global
//     sum, the saturated-red rule; it only ever ATTENUATES a rising swing
//   7 output (emit): brightness, 16-bit-precision temporal dither and a hysteretic minimum-on floor
// The sRGB decode of stage 1 IS the gamma: the LED's light is linear in its PWM value, so a linear-light value maps
// straight to a drive value, and the precision that the old 8-bit bri-then-gamma path threw away is kept until the
// last step.

#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <math.h>
#include <new>

#include "../config.h"
#include "AmbientDiag.hpp"

namespace Ambient {

static constexpr uint8_t kMagic = 0xAD;
static constexpr uint8_t kType = 0x10;
static constexpr size_t kMaxPayload = 192;          // largest destuffed AMBIENT_V1 frame the board accepts
static constexpr uint8_t kKMin = 2, kKMax = 8;
static constexpr uint8_t kAudioBlockLen = 21;       // 19 B audio v2 bytes 3..21, energyL, energyR
static constexpr uint8_t kStrips = NUM_SEGMENTS;
static constexpr uint8_t kMaxPx = MAX_PIXELS_PER_STRIP;
static constexpr uint8_t kFlagAudio = 0x01, kFlagHold = 0x02, kFlagSceneCut = 0x04;

// Strip -> layer, the same table as EffectEngine::STRIP_LAYER (EffectEngine.h static_asserts they match).
static constexpr uint8_t kLayer[8] = {0, 1, 1, 2, 3, 3, 3, 4};

// Lease (wire spec section 6).
static constexpr uint32_t kLiveMs = 150;            // = kAudioLeaseMs
static constexpr uint32_t kFadeStartMs = 600;
static constexpr uint32_t kFadeMs = 1500;
static constexpr uint32_t kLostMs = kFadeStartMs + kFadeMs;  // 2100
static constexpr float kHoldLevel = 0.25f;
static constexpr uint32_t kHoldReqMaxMs = 10000;    // a host hold request (flags.b1) is honoured this long
enum LeaseState : uint8_t { LEASE_LIVE = 0, LEASE_HOLD = 1, LEASE_FADE = 2, LEASE_LOST = 3, LEASE_NONE = 4 };

enum Verdict : uint8_t { V_OK = 0, V_BAD_LEN, V_BAD_CRC, V_BAD_K, V_OLD_SEQ, V_DUP_SEQ };

struct Frame {
    uint8_t seq, flags, S;
    uint8_t K[kStrips];
    uint8_t keys[kStrips][kKMax][3];
    bool hasAudio;
    uint8_t audio[19];
    uint8_t energyL, energyR;
};

inline uint16_t crc16(const uint8_t* p, size_t n) {   // CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF
    uint16_t c = 0xFFFF;
    for (size_t i = 0; i < n; i++) {
        c ^= (uint16_t)p[i] << 8;
        for (uint8_t b = 0; b < 8; b++) c = (c & 0x8000) ? (uint16_t)((c << 1) ^ 0x1021) : (uint16_t)(c << 1);
    }
    return c;
}

// Structure, then CRC. The structural walk reads K per strip as the frame says, so a corrupted K byte is a bad_k or
// bad_len, not a bad_crc; a flipped colour byte is a bad_crc.
inline Verdict decode(const uint8_t* p, size_t n, Frame& f) {
    if (n < 8 || n > kMaxPayload || p[0] != kMagic || p[1] != kType) return V_BAD_LEN;
    const uint8_t S = p[4];
    if (S == 0 || S > kStrips) return V_BAD_LEN;
    const bool audio = (p[3] & kFlagAudio) != 0;
    size_t pos = 6;
    for (uint8_t s = 0; s < S; s++) {
        if (pos + 1 > n - 2) return V_BAD_LEN;
        const uint8_t K = p[pos];
        if (K < kKMin || K > kKMax) return V_BAD_K;
        pos += 1 + 3u * K;
        if (pos > n) return V_BAD_LEN;
    }
    if (pos + (audio ? kAudioBlockLen : 0) + 2 != n) return V_BAD_LEN;
    const uint16_t want = (uint16_t)(p[n - 2] | ((uint16_t)p[n - 1] << 8));
    if (crc16(p + 1, n - 3) != want) return V_BAD_CRC;

    memset(&f, 0, sizeof(f));
    f.seq = p[2];
    f.flags = p[3];
    f.S = S;
    pos = 6;
    for (uint8_t s = 0; s < S; s++) {
        const uint8_t K = p[pos++];
        f.K[s] = K;
        for (uint8_t k = 0; k < K; k++, pos += 3) memcpy(f.keys[s][k], p + pos, 3);
    }
    if (audio) {
        f.hasAudio = true;
        memcpy(f.audio, p + pos, 19);
        f.energyL = p[pos + 19];
        f.energyR = p[pos + 20];
    }
    return V_OK;
}

// ---------------------------------------------------------------------------------------------------------------
// State. One instance, written and read from the loop that owns the serial parser and the render (no locking).
// ---------------------------------------------------------------------------------------------------------------
struct GuardSig {
    bool init = false;
    int8_t dir = 0;        // direction of the last counted swing: +1 rising, -1 falling, 0 none yet
    float peak = 0;        // the extreme of the current swing (max while rising, min while falling)
    uint32_t tx[8] = {0};  // times of the counted reversals still inside the 1 s window
    uint8_t ntx = 0;
};

struct Audio {
    bool present = false;
    uint32_t atMs = 0;
    uint8_t bands[8] = {0};
    uint8_t energy = 0, bassBeat = 0, energyL = 0, energyR = 0;
    bool prevBass = false;
    uint32_t pulseAt[2] = {0, 0};   // the two most recent bass beats (newest in [0])
    float pulseStrength[2] = {0, 0};
};

struct State {
    bool haveFrame = false;
    uint8_t lastSeq = 0;
    uint32_t lastValidMs = 0;
    bool holdReq = false;
    uint8_t mode = 1;               // 0 Calm, 1 Normal, 2 Intense
    uint8_t S = 0;
    float gapEmaMs = 33.0f;         // measured frame gap (valid frames), for stage 2
    uint32_t frameCtr = 0;
    bool sceneCut = false;          // consumed by the next step()
    Audio audio;

    float T[kStrips][kMaxPx][3];    // stage 1 target, linear
    float P[kStrips][kMaxPx][3];    // stage 2 state, linear
    float wAmt[kStrips][kMaxPx];    // stage 4 white amount, hysteretic
    float L[kStrips][kMaxPx][4];    // after stage 6, linear R,G,B,W (logical order)
    float derr[kStrips][kMaxPx][4]; // stage 7 dither residue
    uint8_t chOn[kStrips][kMaxPx];  // stage 7 floor state, bit c = channel c lit

    uint32_t lastStepMs = 0;
    uint32_t entryMs = 0;           // ms since this run of ambient rendering began
    float leaseGain = 1.0f;
    uint8_t leaseState = LEASE_NONE;
    float powerGain = 1.0f;
    uint32_t powerDeficitMA = 0;
    GuardSig guardStrip[kStrips];
    GuardSig guardGlobal;
    bool guardClampedThisFrame = false;
};

inline State& st() { static State s; return s; }

// Placement-new, not `st() = State()`: the temporary would put ~9 KB on the loop task's stack.
inline void reset() { new (&st()) State(); }

// sRGB8 -> linear light, 256 entries, built once.
inline float srgbToLin(uint8_t v) {
    static float lut[256];
    static bool ready = false;
    if (!ready) {
        for (int i = 0; i < 256; i++) {
            const float c = (float)i / 255.0f;
            lut[i] = c <= 0.04045f ? c / 12.92f : powf((c + 0.055f) / 1.055f, 2.4f);
        }
        ready = true;
    }
    return lut[v];
}

inline uint8_t stripLen(uint8_t s) {
    const uint16_t n = STRIP_LENGTHS[s];
    return (uint8_t)(n > kMaxPx ? kMaxPx : n);
}

// Stage 1: keys -> one linear colour per pixel, evenly spaced from the strip's first LED to its last. The host
// samples its picture per LED and has already repeated the neighbour's colour into a sacrificial pixel, so the board
// needs no per-strip knowledge of where that pixel is: it interpolates across every pixel the strip has.
inline void interpolateKeys(State& e, const Frame& f) {
    memset(e.T, 0, sizeof(e.T));
    for (uint8_t s = 0; s < f.S && s < kStrips; s++) {
        const uint8_t len = stripLen(s), K = f.K[s];
        float key[kKMax][3];
        for (uint8_t k = 0; k < K; k++)
            for (uint8_t c = 0; c < 3; c++) key[k][c] = srgbToLin(f.keys[s][k][c]);
        for (uint8_t p = 0; p < len; p++) {
            const float pos = len > 1 ? (float)p * (float)(K - 1) / (float)(len - 1) : 0.0f;
            uint8_t i0 = (uint8_t)pos;
            if (i0 >= K - 1) i0 = K - 2;
            const float fr = pos - (float)i0;
            for (uint8_t c = 0; c < 3; c++) e.T[s][p][c] = key[i0][c] + (key[i0 + 1][c] - key[i0][c]) * fr;
        }
    }
}

inline float lum(float r, float g, float b) { return 0.2126f * r + 0.7152f * g + 0.0722f * b; }

inline void noteAudio(State& e, const Frame& f, uint32_t now) {
    Audio& a = e.audio;
    if (!f.hasAudio) { a.present = false; a.prevBass = false; return; }
    a.present = true;
    a.atMs = now;
    memcpy(a.bands, f.audio, 8);
    a.energy = f.audio[9];
    a.bassBeat = (f.audio[10] >> 1) & 1;
    a.energyL = f.energyL;
    a.energyR = f.energyR;
    if (a.bassBeat && !a.prevBass) {   // rising edge: a new bass pulse starts at the Feet
        a.pulseAt[1] = a.pulseAt[0];
        a.pulseStrength[1] = a.pulseStrength[0];
        a.pulseAt[0] = now;
        a.pulseStrength[0] = 0.5f + 0.5f * ((float)(a.bands[0] + a.bands[1]) / 510.0f);
    }
    a.prevBass = a.bassBeat != 0;
}

// Validate, order-check and install one destuffed payload. Counts every outcome; applies only a valid, newer frame.
inline Verdict accept(const uint8_t* p, size_t n, uint32_t now) {
    State& e = st();
    Frame f;
    Verdict v = decode(p, n, f);
    if (v == V_OK && e.haveFrame && (uint32_t)(now - e.lastValidMs) < kLostMs) {
        const uint8_t d = (uint8_t)(f.seq - e.lastSeq);
        if (d == 0) v = V_DUP_SEQ;
        else if (d >= 128) v = V_OLD_SEQ;
    }
    switch (v) {
        case V_OK: break;
        case V_BAD_LEN: AmbientDiag::rejBadLen++; return v;
        case V_BAD_CRC: AmbientDiag::rejBadCrc++; return v;
        case V_BAD_K: AmbientDiag::rejBadK++; return v;
        case V_OLD_SEQ: AmbientDiag::rejOldSeq++; return v;
        case V_DUP_SEQ: AmbientDiag::rejDupSeq++; return v;
    }
    if (e.haveFrame) {
        const uint32_t gap = (uint32_t)(now - e.lastValidMs);
        if (gap < 250) {   // a stall is not a frame gap; it must not stretch the interpolation constant
            AmbientDiag::noteGap(gap);
            e.gapEmaMs += ((float)gap - e.gapEmaMs) * 0.2f;
        }
    }
    e.haveFrame = true;
    e.lastSeq = f.seq;
    e.lastValidMs = now;
    e.holdReq = (f.flags & kFlagHold) != 0;
    e.mode = (uint8_t)((f.flags >> 4) & 3);
    if (e.mode > 2) e.mode = 1;
    AmbientDiag::framesApplied++;
    if (!e.holdReq) {   // a hold request renews the lease and keeps the picture it already shows
        interpolateKeys(e, f);
        e.S = f.S;
        noteAudio(e, f, now);
        if (f.flags & kFlagSceneCut) e.sceneCut = true;
    }
    return v;
}

// ---------------------------------------------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------------------------------------------
inline float smoothstep(float a, float b, float x) {
    float t = (x - a) / (b - a);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3.0f - 2.0f * t);
}
inline float onePole(float dtMs, float tauMs) { return 1.0f - expf(-dtMs / tauMs); }

// Lease state and the gain it asks for, from the age of the last VALID frame.
inline uint8_t leaseOf(const State& e, uint32_t now, float& gain) {
    gain = 1.0f;
    if (!e.haveFrame) return LEASE_NONE;
    uint32_t age = (uint32_t)(now - e.lastValidMs);
    if (e.holdReq) {
        if (age <= kHoldReqMaxMs) return LEASE_HOLD;   // the host paused the stream for a cue: hold, no fade
        age = age - kHoldReqMaxMs + kFadeStartMs;      // then the ordinary fade starts
    }
    if (age < kLiveMs) return LEASE_LIVE;
    if (age < kFadeStartMs) return LEASE_HOLD;
    if (age < kLostMs) {
        gain = 1.0f - (1.0f - kHoldLevel) * smoothstep(0.0f, 1.0f, (float)(age - kFadeStartMs) / (float)kFadeMs);
        return LEASE_FADE;
    }
    gain = kHoldLevel;
    return LEASE_LOST;
}

// Flash guard for one signal (a strip's mean luminance, or the global sum). A swing is a monotone movement of the
// luminance; a REVERSAL of at least `thr` (10% of full range, 2.5% for saturated red) is one transition, and at most
// six may fall in any second (three flashes). Falling reversals are never blocked (that only dims); a RISING reversal
// is clamped to `thr` above the trough once five are already in the window, so the guard attenuates and never has
// to light a dark pixel. Returns the luminance to show; the caller scales the pixels by returned / candidate.
inline float guardApply(GuardSig& g, float Yc, bool red, uint32_t now, bool& clamped) {
    static constexpr float kThr = 0.10f, kThrRed = 0.025f;
    static constexpr uint8_t kBlockAt = 5;
    const float thr = red ? kThrRed : kThr;
    uint8_t k = 0;   // forget transitions older than 1 s
    for (uint8_t i = 0; i < g.ntx; i++)
        if ((uint32_t)(now - g.tx[i]) < 1000) g.tx[k++] = g.tx[i];
    g.ntx = k;
    if (!g.init) { g.init = true; g.peak = Yc; g.dir = 0; return Yc; }
    float Yo = Yc;
    if (g.dir >= 0) {
        if (Yc > g.peak) g.peak = Yc;
        else if (g.peak - Yc >= thr) {
            if (g.ntx < 8) g.tx[g.ntx++] = now;
            g.dir = -1;
            g.peak = Yc;
        }
    } else {
        if (Yc < g.peak) g.peak = Yc;
        else if (Yc - g.peak >= thr) {
            if (g.ntx >= kBlockAt) {
                Yo = g.peak + thr * 0.95f;
                clamped = true;
            } else {
                if (g.ntx < 8) g.tx[g.ntx++] = now;
                g.dir = 1;
                g.peak = Yc;
            }
        }
    }
    return Yo;
}

// One rendered frame: stages 2-6 for every strip in `mask` (bit n = strip n is rendering FX 41). limitMA is the
// current effective power ceiling (PowerLimiter::effectiveLimitMA(): thermal duty included).
inline void step(uint32_t now, uint8_t mask, uint32_t limitMA) {
    State& e = st();
    float dt = e.lastStepMs == 0 ? 16.0f : (float)(uint32_t)(now - e.lastStepMs);
    const bool reentry = e.lastStepMs == 0 || dt > 250.0f;
    if (reentry) {
        e.entryMs = 0;
        e.guardGlobal = GuardSig();
        for (uint8_t s = 0; s < kStrips; s++) e.guardStrip[s] = GuardSig();
        dt = 16.0f;
    }
    if (dt < 1.0f) dt = 1.0f;
    if (dt > 100.0f) dt = 100.0f;
    e.lastStepMs = now;
    e.entryMs += (uint32_t)dt;
    e.frameCtr++;
    e.guardClampedThisFrame = false;

    // Lease.
    float leaseTarget;
    e.leaseState = leaseOf(e, now, leaseTarget);
    if (e.leaseState <= LEASE_LOST) AmbientDiag::leaseMs[e.leaseState] += (uint32_t)dt;
    AmbientDiag::lost = (e.leaseState == LEASE_LOST);
    if (leaseTarget > e.leaseGain) e.leaseGain += (leaseTarget - e.leaseGain) * onePole(dt, 150.0f);  // recover softly
    else e.leaseGain = leaseTarget;
    float master = e.leaseGain;
    if (e.entryMs < 300) master *= smoothstep(0.0f, 1.0f, (float)e.entryMs / 300.0f);   // soft entry from the old look
    if (e.leaseState == LEASE_NONE) master = 0.0f;                                       // nothing received yet: dark

    // Stage 2: temporal one-pole, constant ~0.5 x the measured frame gap.
    float tau = 0.5f * e.gapEmaMs;
    tau = tau < 8.0f ? 8.0f : (tau > 33.0f ? 33.0f : tau);
    const float alpha = onePole(dt, tau);
    if (e.sceneCut) {   // a scene cut snaps the HUE only: the target takes the pixel's present luminance
        e.sceneCut = false;
        for (uint8_t s = 0; s < kStrips; s++)
            for (uint8_t p = 0; p < stripLen(s); p++) {
                const float yp = lum(e.P[s][p][0], e.P[s][p][1], e.P[s][p][2]);
                const float yt = lum(e.T[s][p][0], e.T[s][p][1], e.T[s][p][2]);
                if (yt > 1e-5f)
                    for (uint8_t c = 0; c < 3; c++) e.P[s][p][c] = e.T[s][p][c] * (yp / yt);
            }
    }
    for (uint8_t s = 0; s < kStrips; s++)
        for (uint8_t p = 0; p < stripLen(s); p++)
            for (uint8_t c = 0; c < 3; c++) e.P[s][p][c] += (e.T[s][p][c] - e.P[s][p][c]) * alpha;

    // Stage 3 inputs: audio freshness, depth, bass pulses.
    const Audio& a = e.audio;
    const bool fuse = a.present && (uint32_t)(now - a.atMs) < kLiveMs && e.leaseState == LEASE_LIVE;
    static const float kDepth[3] = {0.10f, 0.25f, 0.50f};
    const float depth = kDepth[e.mode > 2 ? 1 : e.mode];
    const float energyN = fuse ? (float)a.energy / 255.0f : 0.0f;
    const float highN = fuse ? (float)(a.bands[6] + a.bands[7]) / 510.0f : 0.0f;

    float est = 0.0f;   // estimated current of the ambient strips, mA, before the power gain
    float gs[kStrips];
    for (uint8_t s = 0; s < kStrips; s++) {
        gs[s] = 1.0f;
        if (!((mask >> s) & 1u)) continue;
        if (fuse) {
            const uint8_t layer = kLayer[s];
            float bass = 0.0f;
            for (uint8_t k = 0; k < 2; k++) {   // feet first, one layer per ~40 ms toward the head
                if (a.pulseAt[k] == 0) continue;
                const float t = (float)(int32_t)(now - a.pulseAt[k]) - (float)(4 - layer) * 40.0f;
                if (t >= 0.0f) bass += a.pulseStrength[k] * expf(-t / 90.0f);
            }
            if (bass > 1.0f) bass = 1.0f;
            float en = energyN;
            if (s == 5) en = (float)a.energyL / 255.0f;       // stereo: Desktop Left / Right
            else if (s == 6) en = (float)a.energyR / 255.0f;
            gs[s] = 1.0f + depth * (2.0f * bass + (en - 0.35f));
            if (gs[s] < 0.4f) gs[s] = 0.4f;
        }
    }

    // Stages 3 (apply) and 4 (RGBW), per pixel.
    const float aW = onePole(dt, 80.0f);
    for (uint8_t s = 0; s < kStrips; s++) {
        if (!((mask >> s) & 1u)) continue;
        const uint8_t len = stripLen(s);
        for (uint8_t p = 0; p < len; p++) {
            float g = gs[s] * master;
            if (fuse && kLayer[s] <= 1 && highN > 0.02f) {   // highs sparkle on Head / Upper Body, in its OWN colour
                uint32_t h = (uint32_t)s * 2654435761u ^ (uint32_t)p * 40503u ^ e.frameCtr * 2246822519u;
                h ^= h >> 15; h *= 2246822519u; h ^= h >> 13;
                if ((float)(h & 0xFFFF) / 65535.0f < highN * 0.5f) g *= 1.0f + depth * highN * 3.0f;
            }
            float r = e.P[s][p][0] * g, gg = e.P[s][p][1] * g, b = e.P[s][p][2] * g;
            const float mx = fmaxf(r, fmaxf(gg, b)), mn = fminf(r, fminf(gg, b));
            const float tw = mx > 1e-4f ? smoothstep(0.55f, 0.85f, mn / mx) : 0.0f;
            if (fabsf(tw - e.wAmt[s][p]) > 0.03f) e.wAmt[s][p] += (tw - e.wAmt[s][p]) * aW;   // hysteresis band 3%
            const float w = mn * e.wAmt[s][p];
            e.L[s][p][0] = r - w; e.L[s][p][1] = gg - w; e.L[s][p][2] = b - w; e.L[s][p][3] = w;
            est += ((e.L[s][p][0] + e.L[s][p][1] + e.L[s][p][2]) * (float)MA_PER_PIXEL_RGB +
                    e.L[s][p][3] * (float)MA_PER_PIXEL_W * 3.0f) / 3.0f;
        }
    }

    // Stage 5: power gain, smoothed. 97% of the ceiling, so the hard backstop in PowerLimiter::apply stays a backstop.
    const float target = est > 1.0f ? fminf(1.0f, 0.97f * (float)limitMA / est) : 1.0f;
    if (target < e.powerGain) e.powerGain += (target - e.powerGain) * onePole(dt, 200.0f);
    else e.powerGain += (target - e.powerGain) * onePole(dt, 1000.0f);
    if (e.powerGain > 1.0f) e.powerGain = 1.0f;
    AmbientDiag::noteGain(e.powerGain);
    e.powerDeficitMA = (uint32_t)(est * (1.0f - e.powerGain) + 0.5f);

    // Stage 6: the flash guard, per strip and then globally.
    uint32_t pxTotal = 0;
    float Ysum = 0.0f;
    for (uint8_t s = 0; s < kStrips; s++) {
        if (!((mask >> s) & 1u)) continue;
        const uint8_t len = stripLen(s);
        float y = 0.0f, rs = 0.0f, gsum = 0.0f, bs = 0.0f;
        for (uint8_t p = 0; p < len; p++) {
            for (uint8_t c = 0; c < 4; c++) e.L[s][p][c] *= e.powerGain;
            y += lum(e.L[s][p][0], e.L[s][p][1], e.L[s][p][2]) + e.L[s][p][3];
            rs += e.L[s][p][0]; gsum += e.L[s][p][1]; bs += e.L[s][p][2];
        }
        y /= (float)len;
        const float tot = rs + gsum + bs;
        const bool red = tot > 1e-4f && rs / tot >= 0.8f;
        bool clamped = false;
        const float yo = guardApply(e.guardStrip[s], y, red, now, clamped);
        if (clamped && y > 1e-6f) {
            const float gk = yo / y;
            for (uint8_t p = 0; p < len; p++)
                for (uint8_t c = 0; c < 4; c++) e.L[s][p][c] *= gk;
            y = yo;
            e.guardClampedThisFrame = true;
            AmbientDiag::guardClampedStripsMask |= (uint8_t)(1u << s);
        }
        Ysum += y * (float)len;
        pxTotal += len;
    }
    if (pxTotal > 0) {
        const float yg = Ysum / (float)pxTotal;
        // The red rule on the global signal looks at the whole picture's colour.
        float rs = 0, gsum = 0, bs = 0;
        for (uint8_t s = 0; s < kStrips; s++)
            if ((mask >> s) & 1u)
                for (uint8_t p = 0; p < stripLen(s); p++) { rs += e.L[s][p][0]; gsum += e.L[s][p][1]; bs += e.L[s][p][2]; }
        const float tot = rs + gsum + bs;
        const bool red = tot > 1e-4f && rs / tot >= 0.8f;
        bool clamped = false;
        const float yo = guardApply(e.guardGlobal, yg, red, now, clamped);
        if (clamped && yg > 1e-6f) {
            const float gk = yo / yg;
            for (uint8_t s = 0; s < kStrips; s++)
                if ((mask >> s) & 1u)
                    for (uint8_t p = 0; p < stripLen(s); p++)
                        for (uint8_t c = 0; c < 4; c++) e.L[s][p][c] *= gk;
            e.guardClampedThisFrame = true;
            AmbientDiag::guardClampedStripsMask |= mask;
        }
    }
    if (e.guardClampedThisFrame) AmbientDiag::guardClampedFrames++;
}

// Stage 7 for one strip: brightness (0..255, the segment's effective brightness), 16-bit-precision temporal dither and
// a hysteretic minimum-on floor. out[p] = {R, G, B, W} logical drive values 0..255 (the caller maps them to the wire
// order with RGBW_ARG_INDEX_*).
inline void emit(uint8_t s, uint8_t bri, uint8_t out[][4]) {
    State& e = st();
    const uint8_t len = stripLen(s);
    const float b = (float)bri / 255.0f;
    static constexpr float kOn = 0.6f, kOff = 0.25f;   // drive-count thresholds of the floor's hysteresis
    for (uint8_t p = 0; p < len; p++) {
        float v[4];
        float mx = 0.0f;
        for (uint8_t c = 0; c < 4; c++) { v[c] = e.L[s][p][c] * b * 255.0f; if (v[c] > mx) mx = v[c]; }
        if (mx > 255.0f) for (uint8_t c = 0; c < 4; c++) v[c] *= 255.0f / mx;   // keep the hue: scale, never clip one channel
        for (uint8_t c = 0; c < 4; c++) {
            bool on = (e.chOn[s][p] >> c) & 1u;
            if (!on && v[c] >= kOn) on = true;
            else if (on && v[c] < kOff) on = false;
            float q = 0.0f;
            if (on) {
                const float t = v[c] + e.derr[s][p][c];
                q = floorf(t + 0.5f);
                if (q < 1.0f) q = 1.0f;                        // the floor: a lit channel shows at least one count
                if (q > 255.0f) q = 255.0f;
                float err = t - q;
                e.derr[s][p][c] = err < -0.5f ? -0.5f : (err > 0.5f ? 0.5f : err);
            } else {
                e.derr[s][p][c] = 0.0f;
            }
            out[p][c] = (uint8_t)q;
            e.chOn[s][p] = (uint8_t)(on ? (e.chOn[s][p] | (1u << c)) : (e.chOn[s][p] & ~(1u << c)));
        }
    }
}

}  // namespace Ambient
