// On a user palette, every music effect that CAN lay a palette along a strip does — the Palette
// Studio request (Vico, 2026-09-24): "all the music modes, or at least the ones that can work with
// my palettes". Driven through the REAL EffectEngine::renderFromState with a scripted audio feed.
//
// Two properties, per music FX, over 240 frames on the 4-section palette (palette4.h):
//   A  some strip, in some frame, shows all 4 sections at once;
//   B  every strip-frame in which every pixel is lit shows all 4 — a lit strip is never a slice.
//   Drop's slam — a full-field white flash on every palette, by design — is excluded from B and
//   checked instead to occur (so the exclusion is not vacuous), and no other effect may paint it.
// FX 32 Fire is excluded on purpose: it maps heat to the palette, not position, and stays so.
#include "render_harness.h"
#include "palette4.h"
#include <cstdio>
#include <set>

static int g_fail = 0, g_pass = 0;
#define CHECK(cond, ...)                                                                      \
    do {                                                                                      \
        if (cond) { g_pass++; }                                                               \
        else { g_fail++; printf("  FAIL %s:%d  ", __func__, __LINE__); printf(__VA_ARGS__); printf("\n"); } \
    } while (0)

struct Seen { int maxSections = 0; int litFrames = 0; int litFramesShort = 0; int whiteFrames = 0; };

static Seen run(uint8_t fx, uint8_t sx = 128, uint8_t ix = 128, uint8_t fromStrip = 0, uint8_t toStrip = NUM_SEGMENTS) {
    R::setAll(fx, 22, sx, ix);
    Seen s;
    for (uint32_t f = 0; f < 240; f++) {
        R::frame(f);
        for (uint8_t i = fromStrip; i < toStrip; i++) {
            std::set<int> sections;
            bool allLit = true, white = false;
            for (uint16_t p = 0; p < STRIP_LENGTHS[i]; p++) {
                const int k = P4::section(R::strips[i]->GetPixelColor(p));
                if (k == -2) white = true;
                if (k < 0) allLit = false; else sections.insert(k);
            }
            if (white) { s.whiteFrames++; continue; }  // not a palette frame: judged separately below
            if ((int)sections.size() > s.maxSections) s.maxSections = (int)sections.size();
            if (allLit) { s.litFrames++; if (sections.size() < 4) s.litFramesShort++; }
        }
    }
    return s;
}

// The helper itself: built-ins pass through untouched, and a user slot adds EXACTLY Solid's pixel
// map — so at colour phase 0 a music FX lays the palette out as Solid and the Studio preview do.
static void test_music_pal_pos_is_solids_map_for_user_slots_only() {
    for (uint16_t n : {10, 11, 13, 14, 15})
        for (uint16_t p = 0; p < n; p++) {
            for (int pal = 0; pal < 22; pal++)
                CHECK(PaletteEngine::musicPalPos((uint8_t)pal, 77, p, n) == 77, "built-in pal %d moved at p=%u", pal, p);
            for (int pal = 22; pal < 30; pal++)
                CHECK(PaletteEngine::musicPalPos((uint8_t)pal, 0, p, n) == UserPalette::pixelPosition(p, n),
                      "user pal %d, p=%u of %u: %u, Solid samples %u", pal, p, n,
                      PaletteEngine::musicPalPos((uint8_t)pal, 0, p, n), UserPalette::pixelPosition(p, n));
        }
}

int main() {
    test_music_pal_pos_is_solids_map_for_user_slots_only();
    R::init();
    P4::load(gState.upal[0]);
    gState.upalGen++;
    const struct { uint8_t fx; const char* name; } music[] = {
        {28, "Spectrum"}, {29, "Pulse"}, {30, "Comet"}, {31, "Strobe"}, {33, "Wave"},
        {37, "Tower"}, {38, "Ripple"}, {39, "Bass Sky"}, {40, "Drop"},
    };
    for (auto& m : music) {
        const Seen s = run(m.fx);
        printf("  FX %d %-9s max sections in one strip-frame %d; fully lit strip-frames %d, of them short of 4: %d;"
               " white-flash strip-frames %d\n", m.fx, m.name, s.maxSections, s.litFrames, s.litFramesShort, s.whiteFrames);
        CHECK(s.maxSections == 4, "FX %d %s never shows the whole palette on a strip (max %d of 4)", m.fx, m.name, s.maxSections);
        CHECK(s.litFramesShort == 0, "FX %d %s: %d fully lit strip-frames show only part of the palette", m.fx, m.name, s.litFramesShort);
        // Only Drop paints non-palette white (its slam), and the script must actually reach it —
        // otherwise excluding white frames would be excluding nothing, and proving nothing.
        if (m.fx == 40) CHECK(s.whiteFrames > 0, "Drop's slam never happened: the script does not reach it");
        else CHECK(s.whiteFrames == 0, "FX %d %s painted %d non-palette strip-frames", m.fx, m.name, s.whiteFrames);
    }
    // Two states the busy script never shows fully lit, each driven on purpose so its own palette
    // call site is exercised (ab.sh proves each is load-bearing):
    //  - Drop held IDLE (no build, no drop flags) at the highest idle floor;
    {
        R::forceFlags = 0;
        const Seen s = run(40, 255, 128);
        R::forceFlags = -1;
        printf("  FX 40 Drop, held idle: fully lit strip-frames %d, short of 4: %d\n", s.litFrames, s.litFramesShort);
        CHECK(s.litFrames > 0, "Drop idle never lit a whole strip: this check would pass on nothing");
        CHECK(s.litFramesShort == 0, "Drop idle: %d fully lit strip-frames show only part of the palette", s.litFramesShort);
    }
    //  - Bass Sky's TWINKLE strips (layers 0-1: strips 0-2), slowest fade, all sky. Twinkles are
    //    sparse, so these strips are never fully lit and B cannot apply; A can, restricted to
    //    them: the lit twinkles in one frame must reach all 4 sections. Without the spread this
    //    site's colours span ~32 palette units (200 + fade/8), at most 2 sections.
    {
        const Seen s = run(39, 0, 255, 0, 3);
        printf("  FX 39 Bass Sky, twinkle strips: max sections among lit twinkles %d\n", s.maxSections);
        CHECK(s.maxSections == 4, "Bass Sky twinkles show at most %d of 4 sections", s.maxSections);
    }
    printf("music_spread: %d passed, %d failed\n", g_pass, g_fail);
    return g_fail == 0 ? 0 : 1;
}
