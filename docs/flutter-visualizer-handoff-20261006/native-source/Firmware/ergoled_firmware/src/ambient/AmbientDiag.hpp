#pragma once
// {DIAG} counters for the AMBIENT_V1 path (ambient/Ambient.hpp, audio/AudioSerialFrame.hpp). A plain header with no
// dependencies, so SerialDiag can report it without including the engine. The host proves "applied", never "sent":
// every number here is counted on the board, after the CRC and sequence checks.
//
// Window figures (rx_peak, the percentiles, power_gain_min) restart with {DIAGRESET}'s window (resetWindow()); the
// rest are totals since boot.

#include <stdint.h>

namespace AmbientDiag {

inline uint32_t framesApplied = 0;
inline uint32_t rejBadLen = 0, rejBadCrc = 0, rejBadType = 0, rejBadK = 0, rejOldSeq = 0, rejDupSeq = 0;
inline uint32_t parseResync = 0;          // an ambient-capable frame abandoned: '{' mid-frame, a new SOF, a timeout
inline uint32_t leaseMs[4] = {0, 0, 0, 0};  // time spent LIVE, HOLD, FADE, LOST (render-clock milliseconds)
inline bool lost = false;                 // LOST right now
inline uint32_t guardClampedFrames = 0;   // rendered frames on which the flash guard reduced something
inline uint8_t guardClampedStripsMask = 0;  // strips it has ever clamped since boot (bit n = strip n)
inline uint32_t powerGainMinPermille = 1000;  // lowest smoothed power gain in the window, x1000
inline uint16_t rxPeak = 0;               // most bytes waiting in the UART ring when a frame was read (ring: 1024)

static constexpr uint8_t kRing = 64;
inline uint8_t gapRing[kRing] = {0};      // ms between valid frames, newest overwrites oldest
inline uint8_t gapHead = 0, gapCount = 0;
inline uint16_t renderRing[kRing] = {0};  // ambient render stage, microseconds / 10 (saturates at 655 ms)
inline uint8_t renderHead = 0, renderCount = 0;

inline void noteGap(uint32_t ms) {
    gapRing[gapHead] = (uint8_t)(ms > 255 ? 255 : ms);
    gapHead = (uint8_t)((gapHead + 1) % kRing);
    if (gapCount < kRing) gapCount++;
}
inline void noteRenderUs(uint32_t us) {
    const uint32_t v = us / 10;
    renderRing[renderHead] = (uint16_t)(v > 65535 ? 65535 : v);
    renderHead = (uint8_t)((renderHead + 1) % kRing);
    if (renderCount < kRing) renderCount++;
}
inline void noteRx(int waiting) {
    if (waiting > 0 && (uint16_t)waiting > rxPeak) rxPeak = (uint16_t)waiting;
}
inline void noteGain(float g) {
    const uint32_t pm = (uint32_t)(g * 1000.0f + 0.5f);
    if (pm < powerGainMinPermille) powerGainMinPermille = pm;
}

// Nearest-rank percentile (pct 0..100) of the first n entries. 0 when empty.
template <class T>
inline uint32_t percentile(const T* a, uint8_t n, uint8_t pct) {
    if (n == 0) return 0;
    T s[kRing];
    for (uint8_t i = 0; i < n; i++) {                 // insertion sort: 64 entries, diag path only
        T v = a[i];
        uint8_t j = i;
        while (j > 0 && s[j - 1] > v) { s[j] = s[j - 1]; j--; }
        s[j] = v;
    }
    uint8_t idx = (uint8_t)(((uint16_t)pct * (n - 1) + 50) / 100);
    return (uint32_t)s[idx];
}

inline void resetWindow() {
    rxPeak = 0;
    powerGainMinPermille = 1000;
    gapCount = gapHead = 0;
    renderCount = renderHead = 0;
}

}  // namespace AmbientDiag
