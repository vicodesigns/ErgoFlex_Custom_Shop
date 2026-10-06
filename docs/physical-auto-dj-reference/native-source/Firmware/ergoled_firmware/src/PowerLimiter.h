/**
 * PowerLimiter.h - ErgoLED Global Power Budget Enforcer
 *
 * Runs after all segments render, before Show().
 * Estimates total mA from pixel RGBW values, scales all pixels
 * proportionally if total exceeds POWER_LIMIT_MA.
 *
 * Frame pipeline position:
 *   1. Render new frame (including transition blend)
 *   2. Apply PowerLimiter scaling  <-- THIS
 *   3. Copy final scaled output → _prevFrame
 *   4. Show()
 *
 * Safety overrides (collision strobe, e-stop red) ALSO run through
 * this limiter — never bypass it.
 */

#pragma once
#include <NeoPixelBus.h>
#include "output/ErgoStripMethod.hpp"  // in-spec WS2814 bit timing for every strip
#include "config.h"

class PowerLimiter {
public:
    /**
     * Estimate total mA and scale pixels if over budget.
     * Call once per frame, after all strips are rendered, before Show().
     *
     * @param strips     Array of NeoPixelBus strip pointers (NUM_SEGMENTS)
     * @param ambientActive  FX 41 is rendering. Its own stage (ambient/Ambient.hpp, stage 5) already holds the demand to
     *                   the EFFECTIVE limit with a smoothed gain, so the thermal cap must not ALSO step the frame here:
     *                   the 4.5 A trip -> 3 A cap was a ~33% instant dim. With this set, the scaling below uses the
     *                   hard ceiling only (the backstop), while the thermal state machine keeps running.
     * @param ambientDeficitMA  current the ambient gain removed before this point. The thermal state machine tracks
     *                   DEMAND, so it must see what the picture asked for, not what the smoothed gain let through;
     *                   otherwise a held cap would "cool" itself and release while the demand was still there.
     * @return           true if limiting engaged (for diagnostics)
     */
    static bool apply(NeoPixelBus<NeoGrbwFeature, ErgoStripMethod>** strips, bool ambientActive = false,
                      uint32_t ambientDeficitMA = 0) {
#if !POWER_LIMIT_ENABLED
        return false;
#endif

        uint32_t totalMA = 0;

        // Sum estimated mA across all pixels on all strips
        for (uint8_t s = 0; s < NUM_SEGMENTS; s++) {
            if (!strips[s]) continue;
            uint16_t numPixels = min((uint16_t)STRIP_LENGTHS[s], (uint16_t)MAX_PIXELS_PER_STRIP);

            for (uint16_t p = 0; p < numPixels; p++) {
                RgbwColor c = strips[s]->GetPixelColor(p);
                // Separate RGB and W current estimation
                // Constructor order depends on strip, but GetPixelColor returns
                // the NeoPixelBus internal representation. For mA estimation
                // we sum all channels — the arg order doesn't matter for power.
                uint16_t rgb = (uint16_t)c.R + c.G + c.B;
                uint16_t w = c.W;
                totalMA += ((uint32_t)rgb * MA_PER_PIXEL_RGB + (uint32_t)w * MA_PER_PIXEL_W * 3) / (255 * 3);
            }
        }

        // ── Thermal duty-cycle guard (Music Mode 2.0 / PHASE3 doc item) ──
        // Docs: 75-100% brightness is "burst only, <30s". Track sustained DEMAND
        // (pre-scaling estimate) above THERMAL_DUTY_TRIP_MA; after TRIP_MS engage
        // a cap at THERMAL_DUTY_RELEASE_MA (the ~50% "unlimited safe" level).
        // Release only after demand itself stays below RELEASE_MA for RELEASE_MS —
        // i.e. the user/effect actually backed off, not just the capped output.
#if THERMAL_DUTY_ENABLED
        {
            unsigned long now = millis();
            const uint32_t demandMA = totalMA + ambientDeficitMA;
            if (demandMA > (uint32_t)THERMAL_DUTY_TRIP_MA) {
                _coolSinceMs = 0;
                if (_hotSinceMs == 0) _hotSinceMs = now;
                if (!_thermalDuty && (now - _hotSinceMs) >= (unsigned long)THERMAL_DUTY_TRIP_MS) {
                    _thermalDuty = true;
                    ERGOLED_UART_PRINTF("[PowerLimiter] THERMAL DUTY engaged: %lumA demand sustained >%ds — capping at %dmA\n",
                                  totalMA, THERMAL_DUTY_TRIP_MS / 1000, THERMAL_DUTY_RELEASE_MA);
                }
            } else {
                _hotSinceMs = 0;
                if (_thermalDuty && demandMA < (uint32_t)THERMAL_DUTY_RELEASE_MA) {
                    if (_coolSinceMs == 0) _coolSinceMs = now;
                    if ((now - _coolSinceMs) >= (unsigned long)THERMAL_DUTY_RELEASE_MS) {
                        _thermalDuty = false;
                        _coolSinceMs = 0;
                        ERGOLED_UART_PRINTLN("[PowerLimiter] THERMAL DUTY released (demand cooled)");
                    }
                } else if (_thermalDuty) {
                    _coolSinceMs = 0; // between RELEASE and TRIP: hold the cap, don't count as cooling
                }
            }
        }
#endif

        // Effective limit: the global ceiling, tightened while thermal duty is engaged.
        uint32_t limitMA = (uint32_t)POWER_LIMIT_MA;
#if THERMAL_DUTY_ENABLED
        if (!ambientActive && _thermalDuty && (uint32_t)THERMAL_DUTY_RELEASE_MA < limitMA) {
            limitMA = (uint32_t)THERMAL_DUTY_RELEASE_MA;
        }
#endif

        if (totalMA <= limitMA) {
            if (_wasLimiting) {
                ERGOLED_UART_PRINTLN("[PowerLimiter] Disengaged");
                _wasLimiting = false;
            }
            return false;
        }

        // Scale factor: limitMA / totalMA (as 0-255 fixed-point)
        uint8_t scale = (uint16_t)(limitMA * 255 / totalMA);
        if (scale > 254) scale = 254; // Ensure at least slight reduction

        // Apply scaling to all pixels
        for (uint8_t s = 0; s < NUM_SEGMENTS; s++) {
            if (!strips[s]) continue;
            uint16_t numPixels = min((uint16_t)STRIP_LENGTHS[s], (uint16_t)MAX_PIXELS_PER_STRIP);

            for (uint16_t p = 0; p < numPixels; p++) {
                RgbwColor c = strips[s]->GetPixelColor(p);
                c.R = ((uint16_t)c.R * scale) >> 8;
                c.G = ((uint16_t)c.G * scale) >> 8;
                c.B = ((uint16_t)c.B * scale) >> 8;
                c.W = ((uint16_t)c.W * scale) >> 8;
                strips[s]->SetPixelColor(p, c);
            }
        }

        // Log once per engagement, not per frame
        if (!_wasLimiting) {
            ERGOLED_UART_PRINTF("[PowerLimiter] Engaged: %lumA estimated, scaled to %d/255\n",
                          totalMA, scale);
            _wasLimiting = true;
        }

        return true;
    }

    // The ceiling in force right now: the thermal cap while thermal duty is engaged, else the global one. The ambient
    // power stage smooths toward this instead of letting apply() step to it.
    static uint32_t effectiveLimitMA() {
#if THERMAL_DUTY_ENABLED
        if (_thermalDuty && (uint32_t)THERMAL_DUTY_RELEASE_MA < (uint32_t)POWER_LIMIT_MA) return (uint32_t)THERMAL_DUTY_RELEASE_MA;
#endif
        return (uint32_t)POWER_LIMIT_MA;
    }

    static bool wasLimiting() { return _wasLimiting; }
    static bool thermalDutyActive() { return _thermalDuty; }

private:
    static bool _wasLimiting;
    static bool _thermalDuty;
    static unsigned long _hotSinceMs;
    static unsigned long _coolSinceMs;
};

bool PowerLimiter::_wasLimiting = false;
bool PowerLimiter::_thermalDuty = false;
unsigned long PowerLimiter::_hotSinceMs = 0;
unsigned long PowerLimiter::_coolSinceMs = 0;
