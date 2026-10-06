/**
 * MusicConfig.hpp - Runtime Music Effect Tuning Configuration
 * Singleton following GlobalState.hpp pattern.
 *
 * Holds tunable parameters for music FX 28-33 (Spectrum, Pulse, Comet, Strobe, Fire, Wave).
 * Compile-time defaults from config.h are used as struct initializers.
 * Runtime updates via POST /json/music-config from Go API.
 *
 * Thread safety: FreeRTOS mutex guards all reads and writes.
 * ~44 byte struct copy under lock is fast enough for render rate.
 */

#pragma once
#include <Arduino.h>
#include <freertos/semphr.h>
#include "config.h"

struct MusicConfig {
    // Shared (readSmoothedAudio — affects all FX 28-33)
    float attackAlpha       = MUSIC_ATTACK_ALPHA;  // EMA fast attack (0.0-1.0)
    float decayAlpha        = MUSIC_DECAY_ALPHA;   // EMA slow decay (0.0-1.0)
    uint16_t stalenessMs    = 500;                 // Audio data staleness timeout
    uint8_t noiseFloor      = 8;                   // Below this band energy = zero

    // FX 28: Spectrum
    uint8_t spectrumBeatBoost = 60;    // Brightness boost on bass beat
    float   spectrumGamma     = 0.5f;  // Gamma curve for band energy (sqrtf equivalent)

    // FX 29: Pulse
    uint8_t pulseAmbientDiv    = 6;                    // Volume divisor for ambient glow
    uint8_t pulseRippleDelays[8] = {4,2,2,0,0,0,2,4}; // Per-segment ripple delay frames
    uint8_t pulseColorShiftDiv = 50;                   // Color shift speed divisor
    uint8_t pulseMinFlash      = 128;                  // Minimum flash intensity on beat

    // Color dynamics (shared across FX 28-33 except Fire). All default 0 = classic
    // look: the render path's off-gate returns a 0 palette offset until one is set,
    // so behavior is byte-identical to before this feature until enabled.
    uint8_t colorMotionSpeed = 0;  // Palette drift speed (0=off). Q8.8 advance, clamped <1 unit/frame.
    uint8_t colorSpread      = 0;  // Per-strip palette offset spread (strip0=0 .. strip7=colorSpread)
    uint8_t energyToMotion   = 0;  // 0/255: audio energy adds to drift speed when on
    uint8_t beatHueStep      = 0;  // Palette-units to jump on each beat rising edge (0=off)
    uint8_t peakBandToHue    = 0;  // 0/32: dominant band -> hue. Replaces built-in peak term when >0.

    // Color bursts overlay (vivid HSV wash, FX-agnostic) + beat-randomized reverse/mirror.
    // burstEnable/randomizeFlip default 0 (off) so the classic look is byte-identical until set.
    uint8_t burstEnable   = 0;    // 0/1: master gate for the burst overlay
    uint8_t burstRate     = 0;    // Free-running burst frequency (0=beat-only); higher=more often
    uint8_t burstSpectrum = 0;    // Color character: low=3 clustered primaries, high=wide rainbow march
    uint8_t burstZone     = 128;  // Spatial: 0=bottom-weighted, 128=whole even, 255=top-weighted
    // Burst shaping. Defaults reproduce the classic look (full-depth wash, ~0.27s half-life, no sections).
    uint8_t burstDepth     = 255; // Wash strength: 255=near-total replacement (classic), low=subtle tint
    uint8_t burstTail      = 128; // Decay: 128=classic (~4%/frame); lower=snappier, higher=longer glow
    uint8_t burstSection   = 0;   // Calm/hype sections: 0=off (always hype); higher=longer calm stretches
    uint8_t burstDropAware = 0;   // 0/1: hold bursts during a build, hit one at the drop (v2 analyzer flags)
    uint8_t randomizeFlip = 0;    // 0/1: beat-synced random reverse/mirror cycling all 4 looks
    uint8_t randomizeRate = 255;  // How often randomizeFlip re-rolls the look: 255=every beat
                                  // (350ms anti-strobe floor = legacy behavior), lower=sparser
                                  // (min spacing grows to ~3s at 0). Only used when randomizeFlip=1.

    // Music Mode 2.0. driftBeatSync: color drift advances per-beat (needs a v2
    // tempo lock; without one it silently stays per-ms). comfortMode is the ONE
    // key that defaults ON: a 350ms full-field flash floor across the strobe FX,
    // burst overlay, and drop slam (photosensitivity guard) — 0 = full send.
    // comfortMode is also the Go capability-probe marker for layer FX support.
    uint8_t driftBeatSync = 0;    // 0/1: colorMotionSpeed steps per beat instead of per-ms
    uint8_t comfortMode   = 1;    // 0/1: 350ms anti-strobe floor on full-field flashes
};

class MusicConfigManager {
public:
    static MusicConfigManager& instance() {
        static MusicConfigManager inst;
        return inst;
    }

    void init() {
        _mutex = xSemaphoreCreateMutex();
    }

    MusicConfig getConfig() {
        MusicConfig copy;
        if (_mutex && xSemaphoreTake(_mutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            copy = _config;
            xSemaphoreGive(_mutex);
        }
        return copy;
    }

    void updateConfig(const MusicConfig& cfg) {
        if (_mutex && xSemaphoreTake(_mutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            _config = cfg;
            xSemaphoreGive(_mutex);
        }
    }

    // The same, but they SAY when the 10 ms lock timed out. getConfig() returns a default-constructed
    // struct then, and a read-modify-write built on it writes defaults over every field it did not
    // mean to touch; updateConfig() drops the write silently. MusicConfigApply uses these.
    bool tryGet(MusicConfig& out) {
        if (_mutex && xSemaphoreTake(_mutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            out = _config;
            xSemaphoreGive(_mutex);
            return true;
        }
        return false;
    }
    bool tryUpdate(const MusicConfig& cfg) {
        if (_mutex && xSemaphoreTake(_mutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            _config = cfg;
            xSemaphoreGive(_mutex);
            return true;
        }
        return false;
    }
    void reset() {
        MusicConfig defaults;
        updateConfig(defaults);
    }

private:
    MusicConfigManager() = default;
    MusicConfig _config;
    SemaphoreHandle_t _mutex = nullptr;
};

#define gMusicConfig MusicConfigManager::instance()
