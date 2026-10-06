#pragma once

// User palette slots — Palette Studio's device side.
//
// THE CONTRACT is docs/led/PALETTE_STUDIO_PROTOCOL.md (agreed by Firmware and leds, 2026-09-23).
// Everything here implements a line of it; a change here is a change to that agreement, so it
// goes back through that file rather than being made here alone.
//
//   - 8 slots, ids 22..29. Eight is NUM_SEGMENTS: every strip can show a different user palette
//     at once, so the host never has to evict a slot that is on screen.
//   - A slot holds 2..16 stops, each (pos, r, g, b, w), positions strictly ascending.
//   - On the wire a slot's stops are ONE lowercase hex string, 10 characters per stop. Not nested
//     arrays: a 16-stop palette as arrays costs ~1.6 KB of parseStateRequest's document, so only
//     one fits beside a full 8-segment restore; as hex it costs ~200 bytes and all eight fit in
//     one commit alongside the full state.
//   - RAM ONLY. The board resets on every API port open, and the host carries a slot's
//     definition in every commit that uses it — so nothing here is persisted, and there is no
//     re-push trigger to get wrong.
//   - The host proves a palette APPLIED by the CRC-32 this file computes, echoed in every state
//     reply. CRC-32/IEEE over [b] followed by the decoded stop bytes: Go's crc32.ChecksumIEEE
//     over the same bytes must agree, and the test pins a known vector to prove it does.
//
// PURE BY DESIGN: no Arduino, no ArduinoJson, no FreeRTOS. The JSON walk lives in JsonHelpers;
// everything that decides what a palette MEANS lives here, where the native tests in
// test/native_user_palette can drive it without a board.

#include <stdint.h>
#include <stddef.h>
#include <stdio.h>

namespace UserPalette {

constexpr uint8_t kFormatVersion = 1;   // hello "upal.v"
constexpr uint8_t kFirstId = 22;        // immediately after the 22 built-ins (NUM_PALETTES)
constexpr uint8_t kSlots = 8;
constexpr uint8_t kMinStops = 2;
constexpr uint8_t kMaxStops = 16;
constexpr uint8_t kHexPerStop = 10;     // pos r g b w, two hex digits each
constexpr uint8_t kStopBytes = 5;

// Rejection reasons fit ErgoLEDTxn's Outcome.reason (char[24]) with the terminator, so a
// replayed rejection repeats the reason the first reply gave rather than a truncation of it.
constexpr size_t kReasonLen = 24;

struct Slot {
    uint8_t n = 0;          // stop count; 0 = empty slot
    uint8_t blend = 0;      // 0 smooth, 1 hard
    uint8_t stops[kMaxStops][kStopBytes] = {};
    uint32_t crc = 0;       // meaningful only when n > 0
};

inline bool isUserId(int id) {
    return id >= kFirstId && id < kFirstId + kSlots;
}

// ---------------------------------------------------------------------------
// CRC-32/IEEE — identical to ErgoLEDTxn::crc32 (reflected 0xEDB88320, init and final xor
// 0xFFFFFFFF). Duplicated rather than shared because that one lives in a header that pulls in
// the Arduino runtime; the native test pins both to the standard check value so they cannot drift.
// ---------------------------------------------------------------------------

inline uint32_t crcUpdate(uint32_t crc, uint8_t byte) {
    crc ^= byte;
    for (uint8_t b = 0; b < 8; b++) {
        crc = (crc >> 1) ^ (0xEDB88320u & (uint32_t)(-(int32_t)(crc & 1)));
    }
    return crc;
}

inline uint32_t crc32(const uint8_t* data, size_t len) {
    uint32_t crc = 0xFFFFFFFFu;
    for (size_t i = 0; i < len; i++) crc = crcUpdate(crc, data[i]);
    return ~crc;
}

// The palette's identity: CRC over [blend] + each stop's five bytes, in order.
inline uint32_t slotCrc(const Slot& s) {
    uint32_t crc = crcUpdate(0xFFFFFFFFu, s.blend);
    for (uint8_t i = 0; i < s.n; i++) {
        for (uint8_t k = 0; k < kStopBytes; k++) crc = crcUpdate(crc, s.stops[i][k]);
    }
    return ~crc;
}

// Eight lowercase hex digits, zero-padded — the echo's form, and the txn "crc" field's.
inline void crcHex(uint32_t crc, char out[9]) {
    static const char kDigits[] = "0123456789abcdef";
    for (int i = 7; i >= 0; i--) {
        out[i] = kDigits[crc & 0x0F];
        crc >>= 4;
    }
    out[8] = '\0';
}

// ---------------------------------------------------------------------------
// Decoding and validation
// ---------------------------------------------------------------------------

enum Error : uint8_t {
    OK = 0,
    BAD_BLEND,    // b is not 0 or 1
    BAD_STOPS,    // not a string, length not a multiple of 10, or not lowercase hex
    STOP_COUNT,   // fewer than 2 or more than 16 stops
    UNSORTED,     // positions not strictly ascending
};

// LOWERCASE ONLY. A fixed shape is one less thing for two implementations to disagree on — the
// same rule ErgoLEDTxn applies to transaction ids — and Go's hex.EncodeToString emits lowercase.
inline int hexNibble(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
}

// Decodes one slot. `hex` may be null (the key was absent or not a string). `out` may be null to
// validate without storing — JsonHelpers validates EVERY entry before it takes the state lock,
// then decodes again under it, so a bad palette leaves nothing half-written.
//
// Precedence, when more than one thing is wrong: blend, then the string's shape (length a
// multiple of 10), then the stop count, then the hex digits, then the ordering. Length and count
// come before the digit scan so an absurdly long string is refused without reading it.
inline Error decode(int blend, const char* hex, size_t len, Slot* out) {
    if (blend != 0 && blend != 1) return BAD_BLEND;
    if (hex == nullptr || len % kHexPerStop != 0) return BAD_STOPS;
    const size_t n = len / kHexPerStop;
    if (n < kMinStops || n > kMaxStops) return STOP_COUNT;

    Slot tmp;
    tmp.blend = (uint8_t)blend;
    tmp.n = (uint8_t)n;
    for (size_t i = 0; i < n; i++) {
        for (uint8_t k = 0; k < kStopBytes; k++) {
            const int hi = hexNibble(hex[i * kHexPerStop + k * 2]);
            const int lo = hexNibble(hex[i * kHexPerStop + k * 2 + 1]);
            if (hi < 0 || lo < 0) return BAD_STOPS;
            tmp.stops[i][k] = (uint8_t)((hi << 4) | lo);
        }
        if (i > 0 && tmp.stops[i][0] <= tmp.stops[i - 1][0]) return UNSORTED;
    }
    tmp.crc = slotCrc(tmp);
    if (out != nullptr) *out = tmp;
    return OK;
}

// The protocol's reason strings, verbatim. Every one is at most 23 characters.
inline void reasonFor(Error e, int id, char out[kReasonLen]) {
    const char* what = "invalid";
    switch (e) {
        case BAD_BLEND:  what = "bad blend";  break;
        case BAD_STOPS:  what = "bad stops";  break;
        case STOP_COUNT: what = "stop count"; break;
        case UNSORTED:   what = "unsorted";   break;
        default: break;
    }
    snprintf(out, kReasonLen, "upal %d: %s", id, what);
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

// Same arithmetic as PaletteEngine::lerp8by8, so a user palette blends exactly as the built-ins do.
inline uint8_t lerp8(uint8_t a, uint8_t b, uint8_t frac) {
    return a + (((int16_t)(b - a) * frac) >> 8);
}

// Colour at position x (0..255).
//
//   hard (b=1):   the LOWER stop's colour holds from its position up to the next stop's.
//   smooth (b=0): blend between the two stops either side of x.
//   before the first stop / after the last: that end stop's colour.
//
// A mixed edge is a smooth palette with two stops one position apart: a pixel is at least 17
// positions wide on the longest strip, so that edge is hard at pixel resolution.
inline void sample(const Slot& s, uint8_t x, uint8_t& r, uint8_t& g, uint8_t& b, uint8_t& w) {
    // TOTAL, even though PaletteEngine never calls it with an empty slot. Without this, an empty
    // slot reaches the span division below with span == 0 — an integer divide by zero, which on
    // the ESP32 is a CPU exception and a reboot, from inside the render loop. Found by mutation:
    // removing PaletteEngine's empty-slot check crashed the native suite with SIGFPE.
    if (s.n == 0) {
        r = g = b = w = 0;
        return;
    }
    // The last stop at or before x; -1 when x precedes the first stop.
    int lo = -1;
    for (uint8_t i = 0; i < s.n; i++) {
        if (s.stops[i][0] <= x) lo = i;
        else break;  // ascending, so no later stop can qualify
    }
    if (lo < 0) lo = 0;  // before the first stop: hold it

    const uint8_t* a = s.stops[lo];
    if (s.blend == 1 || lo == s.n - 1 || x < a[0]) {
        r = a[1]; g = a[2]; b = a[3]; w = a[4];
        return;
    }
    const uint8_t* c = s.stops[lo + 1];
    // a[0] <= x < c[0], so span >= 1 and frac stays within 0..255.
    const uint16_t span = (uint16_t)(c[0] - a[0]);
    const uint8_t frac = (uint8_t)(((uint16_t)(x - a[0]) << 8) / span);
    r = lerp8(a[1], c[1], frac);
    g = lerp8(a[2], c[2], frac);
    b = lerp8(a[3], c[3], frac);
    w = lerp8(a[4], c[4], frac);
}

// The position pixel i of an n-pixel strip samples when Solid paints a user palette along it:
// the centre of an equal 256/n band. The app's "On your desk" preview uses exactly this formula,
// so a change here moves every preview off the board. A stop at P lights pixel i when
// P <= pixelPosition(i, n); a section that must start exactly at pixel k goes at (256*k)/n.
inline uint8_t pixelPosition(uint16_t i, uint16_t n) {
    if (n == 0) return 0;
    return (uint8_t)((256u * i + 128u) / n);
}

}  // namespace UserPalette
