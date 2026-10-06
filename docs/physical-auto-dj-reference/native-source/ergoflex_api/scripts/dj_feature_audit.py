#!/usr/bin/env python3
"""Audit an Auto DJ show against every feature the lighting engine offers.

Companion to dj_show_report.py. That report answers "what did the DJ do, and
did it land on the beat". This one answers a different question: of everything
the desk can do, how much did the show actually reach?

    python3 scripts/dj_feature_audit.py show.json --settings settings.json

The organising idea is the desk's five-layer geometry (EffectEngine.h:43-58).
Eight physical strips are grouped into five anatomical layers, and only some
effects know that. An effect that treats the desk as eight independent bars is
using the hardware; an effect that gives the five layers ROLES is using the
design. The audit separates the two and never conflates them.

WHAT THIS AUDIT WILL AND WILL NOT CLAIM. Share-of-show is reported as dwell
time, not switch count, because a look held for 40s and a look held for 8s are
not the same contribution. Expected-vs-observed deck shares are printed with
their n, and no fairness verdict is offered on counts too small to carry one.
Where the recording cannot answer something, the audit says so instead of
substituting a default.
"""

import argparse
import json
import sys
from collections import Counter, defaultdict

# ── The desk, physically ─────────────────────────────────────────
# Eight strips, five tiers. Three sources agree on this and are cross-checked
# here rather than assumed:
#   firmware  EffectEngine.h:44-54  LAYER_STRIPS / STRIP_LAYER = {0}{1,2}{3}{4,5,6}{7}
#   app       desk_segment_layout.dart:9-31  names + pixel counts, from
#             WledApiHandler.hpp:170-178
#   patent    CIP FIGS. 24-26, indicators 822a-822h; the tier order is stated
#             outright in the FIG. 26J lift sequence: 822h -> 822e-g -> 822d ->
#             822b-c -> 822a, "illumination appears to ascend the desk".
#
# The optical facts matter more than the strip count. Every indicator except
# 822a faces DOWNWARD onto a surface, so the user sees bounced light on five
# surfaces at five heights, not eight visible strips. Two tiers are lit by more
# than one strip, and light landing on one surface MIXES whatever those strips
# are each showing.
#
# fields: (tier, name, [(seg, app name, patent id, pixels, axis)], bounce target)
TIERS = [
    (0, "The Head", [
        (0, "Top Shelf Top", "822a", 14, "left-right"),
     ], "upward-facing — the ONLY directly visible strip"),
    (1, "Upper Body", [
        (1, "Top Shelf Bottom Back", "822b", 14, "left-right"),
        (2, "Top Shelf Bottom Front", "822c", 15, "left-right"),
     ], "down onto the desktop — TWO strips, one surface"),
    (2, "The Core", [
        (3, "Second Shelf", "822d", 14, "left-right"),
     ], "down onto the desktop / mid volume"),
    (3, "Lower Body", [
        (4, "Desk Top Center", "822f", 14, "left-right"),
        (5, "Desktop Left", "822e", 10, "front-back"),
        (6, "Desktop Right", "822g", 11, "front-back"),
     ], "down into the knee space and floor — THREE strips on TWO axes"),
    (4, "The Feet", [
        (7, "Foot Rest", "822h", 13, "left-right"),
     ], "down onto the floor around the wheels"),
]

# seg index -> tier, the same partition STRIP_LAYER encodes.
SEG_TIER = {s: t for t, _, segs, _ in TIERS for (s, _, _, _, _) in segs}

# The eight analyzer bands, named for what a listener would call them.
BAND_NAMES = ["sub-bass", "bass", "low-mid", "mid", "upper-mid",
              "presence", "brilliance", "air"]


def spectrum_band_for_seg(seg, ix):
    """Which analyzer band FX 28 puts on a given strip, for a given ix.

    Mirrors fxMusicSpectrum (EffectEngine.h:1306-1314) exactly:
      ix <  85        bottom-up   band = 7 - si   (bass at the footrest)
      85 <= ix < 171  mirrored    band = si if si < 4 else 7 - si
      ix >= 171       top-down    band = si       (bass at the top shelf)
    """
    if 85 <= ix < 171:
        return seg if seg < 4 else 7 - seg
    return (7 - seg) if ix < 85 else seg


def spectrum_map_mode(ix):
    return "bottom-up" if ix < 85 else ("mirrored" if ix < 171 else "top-down")


# FX 37 Tower's band grouping, EffectEngine.h:1656-1657. L is distance from the
# bass end, so the tier it lands on depends on ix, but the GROUPING is fixed and
# each tier gets exactly one value — which is the property FX 28 lacks.
TOWER_BLO = [0, 2, 3, 5, 6]
TOWER_BHI = [1, 2, 4, 5, 7]


def tower_band_range_for_tier(tier, ix):
    """Which analyzer bands FX 37 Tower drives a given tier with.

    L is the DISTANCE FROM THE BASS END, not the tier number: the firmware
    computes `L = (ix >= 128) ? layer : NUM_LAYERS-1-layer` (EffectEngine.h:1655)
    and then indexes the band table by L. Indexing it by tier instead puts the
    bass on the Head and is wrong in a way that reads as plausible everywhere
    else, so this is the one place the conversion lives.
    """
    L = tier if ix >= 128 else (len(TIERS) - 1 - tier)
    return TOWER_BLO[L], TOWER_BHI[L]

# ── The effect catalogue ─────────────────────────────────────────────────────
# viz is the API's 0-9 index (services/music_mode_service.go:513 musicFxMap);
# fx is the firmware id. family is the distinction this audit exists to draw:
#
#   "tier"    — the effect reads STRIP_LAYER and drives each of the five
#               SURFACES as one unit, so a surface shows one value.
#   "wiring"  — the effect indexes the 8 strips directly. Vertical, but blind
#               to which strips share a surface, so a surface lit by two or
#               three strips shows two or three different values at once.
#
# axis names the directional/dimensional control that effect exposes, so a gap
# in coverage can be described as a missing DIMENSION rather than a missing id.
FX = {
    0: dict(fx=28, name="Spectrum",  family="wiring",
            axis="band map (ix): bottom-up / mirrored / top-down"),
    1: dict(fx=29, name="Pulse",     family="wiring",
            axis="per-strip ripple delays from the beat"),
    2: dict(fx=30, name="Comet",     family="wiring",
            axis="chase along each strip, speed from energy"),
    3: dict(fx=31, name="Strobe",    family="wiring",
            axis="whole-desk flash, decay"),
    4: dict(fx=32, name="Fire",      family="wiring",
            axis="per-strip heat, audio-driven sparking"),
    5: dict(fx=33, name="Wave",      family="wiring",
            axis="sinusoid along each strip"),
    6: dict(fx=37, name="Tower",     family="tier",
            axis="vertical EQ over 5 layers; ix<128 bass at Feet, >=128 at Head"),
    7: dict(fx=38, name="Ripple",    family="tier",
            axis="wavefront across 5 layers; ix<128 per beat, >=128 per bar; rev flips direction"),
    8: dict(fx=39, name="Bass Sky",  family="tier",
            axis="layer ROLES: Feet+Lower=bass, Head+Upper=treble, Core blends; ix=balance"),
    9: dict(fx=40, name="The Drop",  family="tier",
            axis="build climbs Feet->Head, full-desk slam, decaying wash"),
}
TIER_VIZ = {v for v, d in FX.items() if d["family"] == "tier"}

FLAG_BUILD, FLAG_DROP, FLAG_QUIET = 0x01, 0x02, 0x04

# Below this many flagged ticks the layer-share comparison is noise, so the
# audit prints the raw counts and REFUSES the verdict rather than rendering a
# ratio over n=5 in the same typeface as one over n=344.
MIN_TICKS_FOR_VERDICT = 20


def fmt_ms(ms):
    ms = int(ms)
    s, m = ms // 1000, ms // 60000
    return "%d:%04.1f" % (m, (ms - m * 60000) / 1000.0) if m else "%.1fs" % (s + (ms % 1000) / 1000.0)


def pct(n, d):
    return "n/a" if not d else "%.1f%%" % (100.0 * n / d)


def bar(frac, width=32):
    filled = int(round(frac * width))
    return "#" * filled + "." * (width - filled)


def drop_viz_available(settings):
    """Name the effect a custom show would slam with, or None.

    Mirrors djCustomDropViz (music_auto_dj_settings.go): among the eligible
    pool, BUILTIN entries only, rated above Off, flash-heavy only, highest viz
    wins (The Drop outranks Strobe). Reported so "no slams" can be read as
    "nothing was rated" or "no drop was detected" rather than guessed at.
    """
    # Flash Comfort Minimal REMOVES every flash-heavy look from the pool
    # (applyFlashComfortToPool), so there is nothing left to slam with. Reading
    # ratings alone would report a Minimal show as armed for The Drop.
    if (settings.get("flash_comfort") or "").lower() == "minimal":
        return None

    # Firmware without layer FX drops viz 6-9 (capabilityFilterPool), taking
    # The Drop with it and leaving Strobe as the only candidate.
    #
    # ENABLE-time semantics, not configuration-time. The tri-state is read
    # PERMISSIVELY when the sheet is being configured, but a running show is
    # resolved with permissiveUnknown=false (music_auto_dj.go, SetAutoDJ), and
    # LayerFxUsable(false) returns LayerFxSupported — so an UNPROBED capability
    # excludes viz 6-9 from the show that actually played. A recording is of a
    # show that ran, so reporting the permissive stance here would claim the
    # desk was armed for The Drop when the resolver had already removed it.
    layer_fx = (settings.get("capabilities") or {}).get("layer_fx")
    layer_fx_usable = layer_fx is True

    best = None
    for e in settings.get("eligible_pool") or []:
        if e.get("kind") != "builtin":
            continue
        if not e.get("current_weight"):
            continue
        if not e.get("flash_heavy"):
            continue
        viz = e.get("viz")
        if viz is None:
            continue
        if viz >= 6 and not layer_fx_usable:
            continue
        if best is None or viz > best:
            best = viz
    if best is None:
        return None
    return (FX.get(best) or {}).get("name") or ("viz %d" % best)


def base_id(ev):
    """The POOL entry behind an event, for per-preset totals.

    A remix plays a preset's colours under a different effect, so its "id"
    carries a "@viz<N>" suffix while "bid" still names the preset. Counting on
    "id" splits one preset across every effect it was remixed onto and makes
    every per-preset total wrong; counting on this keeps them whole.

    Falls back to "id" for recordings made before remix existed, where the two
    are always equal anyway.
    """
    return ev.get("bid") or ev.get("id") or ""


def is_remix(ev):
    """True when this event is a remix rather than a look as it was saved.

    Reads the two identity fields against each other rather than looking for
    the "@viz" suffix, so the suffix format stays private to the Go side.
    """
    bid = ev.get("bid") or ""
    return bool(bid) and bid != (ev.get("id") or "")


def resolved_plan(ev, pool):
    """The five visualizations an event put on the desk, one per tier.

    Recordings made before tier composition carry no "tp" at all, and an old
    recording is not a broken one — it is a show that ran ONE effect across
    every tier. So an absent plan resolves to [base] * 5 and stays directly
    comparable with a composed one. Returns None only when the base itself
    cannot be resolved.

    "tp" is a POINTER field on the Go side for the same reason "v" is: the zero
    plan [0,0,0,0,0] is a real look (Spectrum everywhere), so an absent key has
    to mean "this build recorded no plan", never "Spectrum".
    """
    plan = ev.get("tp")
    if isinstance(plan, list) and len(plan) == len(TIERS):
        return plan
    v = viz_of(ev, pool)
    if v is None:
        return None
    return [v] * len(TIERS)


def plan_verified(ev):
    """Whether the desk is known to have rendered this event's plan.

    False while layer-FX capability was unknown: the firmware may ignore
    per-segment effects, so the recorded plan can describe a look that never
    reached the strip. Permissive RENDERING is fine; permissive MEASUREMENT is
    not, so unverified dwell is excluded from composition-active time rather
    than counted into it.

    Absent means an old recording, which predates composition entirely — there
    is no composed dwell in it to over-claim.
    """
    return bool(ev.get("pv"))


def tier_aware_tier_fraction(plan):
    """What fraction of the five surfaces were driven AS surfaces.

    The blunt per-look measure ("was this look tier-coherent?") stops meaning
    anything once one look can be Ripple on the head and Spectrum everywhere
    else. Counting tiers rather than looks is the measure that survives
    composition, and it degrades to exactly the old answer (0 or 1) for an
    uncomposed look.
    """
    if not plan:
        return 0.0
    return sum(1 for v in plan if v in TIER_VIZ) / float(len(plan))


def viz_of(ev, pool):
    """Resolve an event's visualization index.

    Three sources, in order of trust:
      1. the event's own "v" — authoritative, but ABSENT when viz is 0, because
         DJShowEvent.Viz carries `json:"v,omitempty"` and 0 (Spectrum) is a
         real value. So a missing "v" is not a missing look.
      2. a builtin's RefID, which encodes it: "builtin:7".
      3. the eligible pool, for favourites and presets, keyed by the same
         stableID the event carries.
    Returns None only when none of the three can answer.
    """
    if "v" in ev:
        return ev["v"]
    rid = ev.get("id") or ""
    if rid.startswith("builtin:"):
        try:
            return int(rid.split(":", 1)[1])
        except ValueError:
            return None
    if rid in pool:
        return pool[rid].get("viz")
    return None


def load_pool(settings):
    """stableID -> pool entry, from GET .../auto-dj/settings eligible_pool."""
    out = {}
    for e in settings.get("eligible_pool") or []:
        kind = e.get("kind")
        sid = "builtin:%s" % e.get("viz") if kind == "builtin" else "%s:%s" % (kind, e.get("ref_id"))
        out[sid] = e
    return out


def dwell(applied, end_ms):
    """(event, dwell_ms) pairs. A look is on screen until the next one lands."""
    out = []
    for i, e in enumerate(applied):
        nxt = applied[i + 1]["t"] if i + 1 < len(applied) else end_ms
        out.append((e, max(0, nxt - e["t"])))
    return out


def h(title):
    print("\n" + "=" * 74)
    print(title)
    print("=" * 74)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("recording")
    ap.add_argument("--settings", help="GET /auto-dj/settings JSON; without it "
                                       "the deck-weight and capability sections are skipped")
    ap.add_argument("--looks-detail", help="stableID -> {fx,ix,sx,name} from "
                                           "scripts/dj_pool_detail.sh; without it the "
                                           "surface-mapping section is skipped")
    args = ap.parse_args()

    doc = json.load(open(args.recording))
    settings = json.load(open(args.settings)) if args.settings else {}
    pool = load_pool(settings)
    detail = json.load(open(args.looks_detail)) if args.looks_detail else {}

    events = doc.get("events") or []
    samples = doc.get("samples") or []
    fields = doc.get("sample_fields") or []
    idx = {n: i for i, n in enumerate(fields)}
    end_ms = samples[-1][idx["t"]] if samples else doc.get("duration_ms", 0)

    applied = [e for e in events if e.get("k") == "applied"]
    if not applied:
        print("No applied switches in this recording — nothing to audit.")
        return 0

    pairs = dwell(applied, end_ms)
    total_dwell = sum(d for _, d in pairs) or 1
    # Per POOL ENTRY, so a preset's remixes count toward the preset rather
    # than fragmenting it across one pseudo-entry per effect.
    played = Counter(base_id(e) or "?" for e in applied)
    # Kept separately: the combination-level view a remix makes possible.
    played_combo = Counter((e.get("id") or "?") for e in applied)
    remix_plays = sum(1 for e in applied if is_remix(e))

    # ── 1. the geometry ──────────────────────────────────────────────────────
    h("THE DESK — eight strips, five lit surfaces")
    print("Patent FIGS. 24-26 (indicators 822a-822h); firmware EffectEngine.h:44;")
    print("app desk_segment_layout.dart:9. Top tier first.\n")
    for n, name, segs, bounce in TIERS:
        ids = "+".join(s[2] for s in segs)
        px = sum(s[3] for s in segs)
        axes = set(s[4] for s in segs)
        print("  tier %d  %-11s %-14s seg %-9s %3d px  %s" % (
            n, name, ids, ",".join(str(s[0]) for s in segs), px,
            "/".join(sorted(axes))))
        print("          %s" % bounce)
    print("\n  Only 822a is seen directly. The other four tiers are read off the")
    print("  surfaces they wash, so what carries is a tier's LEVEL, not the")
    print("  detail inside any one strip.")
    print("\n  Tier-coherent  : %s" % ", ".join(
        "%s (FX %d)" % (FX[v]["name"], FX[v]["fx"]) for v in sorted(TIER_VIZ)))
    print("  Wiring-order   : %s" % ", ".join(
        "%s (FX %d)" % (FX[v]["name"], FX[v]["fx"]) for v in sorted(FX) if v not in TIER_VIZ))

    # ── 2. engagement ────────────────────────────────────────────────────────
    h("TIER COHERENCE — how much of the show drove the five surfaces as surfaces")
    fam_dwell, fam_count, unknown = Counter(), Counter(), 0
    for e, d in pairs:
        v = viz_of(e, pool)
        if v is None or v not in FX:
            unknown += 1
            fam_dwell["unresolved"] += d
            fam_count["unresolved"] += 1
            continue
        f = FX[v]["family"]
        fam_dwell[f] += d
        fam_count[f] += 1
    print("show length %s, %d switches\n" % (fmt_ms(end_ms), len(applied)))
    for fam, label in (("tier", "tier-coherent"), ("wiring", "wiring-order"), ("unresolved", "unresolved")):
        if not fam_count[fam]:
            continue
        frac = fam_dwell[fam] / total_dwell
        print("  %-14s %s %6s of screen time   (%d switches, %s)" % (
            label, bar(frac), pct(fam_dwell[fam], total_dwell), fam_count[fam], fmt_ms(fam_dwell[fam])))
    if unknown:
        print("\n  %d switch(es) could not be resolved to an effect — pass --settings "
              "so favourites and presets can be looked up." % unknown)

    # ── 2b. composition ──────────────────────────────────────────────────────
    h("TIER COMPOSITION — how much of the show ran more than one effect at once")
    tier_time, composed_dwell, unverified_dwell = 0.0, 0, 0
    per_tier = [Counter() for _ in TIERS]
    recipes = Counter()
    recipe_dwell = Counter()
    for e, d in pairs:
        plan = resolved_plan(e, pool)
        if plan is None:
            continue
        tier_time += d * tier_aware_tier_fraction(plan)
        for tier, v in enumerate(plan):
            per_tier[tier][v] += d
        # "Composed" is >= 2 DISTINCT effects on the desk at once, which is the
        # thing the eye can actually see. A recipe that replaces every tier
        # with the same effect (tower_stack) is a different LOOK but not a
        # composition, and counting it as one would inflate the number with
        # something indistinguishable from an ordinary switch.
        if len(set(plan)) < 2:
            continue
        if not plan_verified(e):
            unverified_dwell += d
            continue
        composed_dwell += d
        rid = e.get("rc") or "?"
        recipes[rid] += 1
        recipe_dwell[rid] += d

    print("  tier-aware TIER-time      %s %6s" % (
        bar(tier_time / total_dwell), pct(int(tier_time), total_dwell)))
    print("      Sum(dwell x tier-aware tiers / 5) / total dwell. Counts SURFACES, not")
    print("      looks, so a look that is Ripple on one tier and Spectrum on four")
    print("      scores 0.2 rather than 0 or 1. Degrades to the old per-look answer")
    print("      for an uncomposed show.")
    print("\n  composition-active        %s %6s   (%s)" % (
        bar(composed_dwell / total_dwell), pct(composed_dwell, total_dwell),
        fmt_ms(composed_dwell)))
    print("      Dwell with >=2 distinct effects on the desk at once. VERIFIED only.")
    if unverified_dwell:
        print("\n  EXCLUDED, unverified      %s   %d ms of composed-looking dwell was" % (
            fmt_ms(unverified_dwell), unverified_dwell))
        print("      recorded while layer-FX capability was UNKNOWN, so the desk may not")
        print("      have rendered those plans. Not counted above.")
    if recipes:
        print("\n  recipe            plays   screen time   share")
        print("  " + "-" * 48)
        for rid, n in recipes.most_common():
            print("  %-16s %5d   %10s  %6s" % (
                rid, n, fmt_ms(recipe_dwell[rid]), pct(recipe_dwell[rid], total_dwell)))
    else:
        print("\n  No composed dwell in this recording.")

    print("\n  per-tier effect time")
    for tier, name, _, _ in TIERS:
        top = per_tier[tier].most_common(4)
        if not top:
            continue
        parts = ["%s %s" % (FX[v]["name"] if v in FX else "viz %s" % v, pct(d, total_dwell))
                 for v, d in top]
        print("    %-12s %s" % (name, ", ".join(parts)))

    # ── 3. inventory ─────────────────────────────────────────────────────────
    h("EFFECT INVENTORY — every effect the show reached")
    by_viz_dwell, by_viz_count = Counter(), Counter()
    label_of = defaultdict(Counter)
    for e, d in pairs:
        v = viz_of(e, pool)
        if v is None:
            continue
        by_viz_dwell[v] += d
        by_viz_count[v] += 1
        label_of[v][e.get("l") or "?"] += 1
    print("  FX  effect      kind    plays   screen time   share   axis exercised")
    print("  " + "-" * 70)
    for v in sorted(by_viz_dwell, key=lambda k: -by_viz_dwell[k]):
        d = FX.get(v)
        if not d:
            continue
        print("  %2d  %-11s %-6s  %5d   %10s  %6s" % (
            d["fx"], d["name"], d["family"], by_viz_count[v], fmt_ms(by_viz_dwell[v]),
            pct(by_viz_dwell[v], total_dwell)))
        print("      %s" % d["axis"])
        names = [n for n, _ in label_of[v].most_common() if n != d["name"]]
        if names:
            print("      via: %s" % ", ".join(names[:8]) + (" ..." if len(names) > 8 else ""))
    missing = [v for v in sorted(FX) if v not in by_viz_dwell]
    if missing:
        print("\n  never played: %s" % ", ".join(
            "%s (FX %d, %s)" % (FX[v]["name"], FX[v]["fx"], FX[v]["family"]) for v in missing))

    # ── 4. deck ──────────────────────────────────────────────────────────────
    if pool:
        h("THE DECK — what you weighted vs what played")
        total_w = sum(e.get("current_weight", 0) for e in pool.values())
        layer_w = sum(e.get("current_weight", 0) for sid, e in pool.items()
                      if e.get("viz") in TIER_VIZ)
        n = len(applied)
        print("pool of %d entries, total weight %d, n=%d switches\n" % (len(pool), total_w, n))
        print("  entry                          kind            w   expect  played")
        print("  " + "-" * 68)
        for sid, e in sorted(pool.items(), key=lambda kv: -kv[1].get("current_weight", 0)):
            w = e.get("current_weight", 0)
            if w == 0 and played[sid] == 0:
                continue
            exp = (w / total_w * n) if total_w else 0
            flag = ""
            if w > 0 and played[sid] == 0:
                flag = "  <- never played"
            elif w == 0 and played[sid] > 0:
                flag = "  <- rated Off but played"
            print("  %-30s %-14s %2d %7.1f %7d%s" % (
                (e.get("label") or sid)[:30], e.get("kind", "?"), w, exp, played[sid], flag))
        print("\n  deck weight reaching a tier-coherent effect: %d of %d = %s" % (
            layer_w, total_w, pct(layer_w, total_w)))
        print("  (counts this small carry no fairness verdict; they are printed to be checked)")

        # Remix breakdown. Printed unconditionally, WITH its denominator: a
        # silent absence here is indistinguishable from "the field was never
        # recorded", which is the failure mode this report exists to avoid.
        print("\n  remixes (a preset's colours under another effect): %d of %d = %s" % (
            remix_plays, n, pct(remix_plays, n)))
        if remix_plays:
            print("  per combination:")
            for cid, c in sorted(played_combo.items(), key=lambda kv: -kv[1]):
                if "@viz" not in cid:
                    continue
                src, _, tail = cid.partition("@viz")
                try:
                    tv = int(tail)
                except ValueError:
                    tv = None
                label = (pool.get(src) or {}).get("label") or src
                target = (FX.get(tv) or {}).get("name") or tail
                print("    %-30s -> %-10s %4d" % (label[:30], target, c))
        else:
            print("  (none — remix is off, or no colour-carrying look was drawn)")

        h("DIRECTIONAL COVERAGE — which axes the show actually swept")
        for v in sorted(TIER_VIZ):
            reached = by_viz_count.get(v, 0)
            print("  %-9s %s" % (FX[v]["name"], "reached (%d plays)" % reached if reached else "NOT REACHED"))
            print("            %s" % FX[v]["axis"])

    # ── 4b. what each look puts on each surface ─────────────────────────────
    if detail:
        h("SURFACE MAPPING — which band each look lands on each tier")
        print("For FX 28 the band map is a property of the LOOK (its ix), not of the")
        print("DJ. A tier lit by more than one strip shows every band those strips")
        print("carry at once, mixed on the one surface it washes.\n")
        modes = Counter()
        collide_rows = []
        for sid, meta in sorted(detail.items(), key=lambda kv: kv[1].get("name") or ""):
            if meta.get("fx") != 28:
                continue
            ix = meta.get("ix")
            if ix is None:
                continue
            mode = spectrum_map_mode(ix)
            modes[mode] += 1
            per_tier = defaultdict(list)
            for seg in range(8):
                per_tier[SEG_TIER[seg]].append(spectrum_band_for_seg(seg, ix))
            mixed = {t: bs for t, bs in per_tier.items() if len(set(bs)) > 1}
            bass_tiers = sorted(t for t, bs in per_tier.items() if min(bs) <= 1)
            collide_rows.append((meta.get("name") or sid, ix, mode, per_tier, mixed, bass_tiers, played.get(sid, 0)))
        if not collide_rows:
            print("  no FX 28 looks in the pool detail")
        else:
            print("  look                      ix  band map   tier bands (Head..Feet)  plays  mixed")
            print("  " + "-" * 79)
            for name, ix, mode, per_tier, mixed, bass_tiers, plays in collide_rows:
                bands = " ".join("".join(str(b) for b in sorted(set(per_tier[t]))) for t in range(5))
                print("  %-24s %4d  %-9s  %-21s %5s  %s" % (
                    name[:24], ix, mode, bands, plays if plays else "-",
                    ",".join("tier %d" % t for t in sorted(mixed)) or "-"))
            print("\n  band map modes in the pool: %s" % ", ".join(
                "%s x%d" % (m, c) for m, c in modes.most_common()))
            n_mixed = sum(1 for r in collide_rows if r[4])
            print("  looks whose light mixes bands on a shared surface: %d of %d" % (
                n_mixed, len(collide_rows)))
            splits = Counter(tuple(r[5]) for r in collide_rows)
            print("\n  where the bass (bands 0-1) lands:")
            for tiers, c in splits.most_common():
                names = ", ".join(TIERS[t][1] for t in tiers)
                print("    %-38s %d look(s)  [%d of 5 tiers]" % (names, c, len(tiers)))
            worst = max(splits, key=lambda t: (len(t), splits[t]))
            if len(worst) >= 4:
                print("\n  %d look(s) put bass on %d of the 5 surfaces at once. The beat boost"
                      % (splits[worst], len(worst)))
                print("  fires on the same bands (spectrumBeatBoost, bandIdx <= 1), so a kick")
                print("  lights most of the desk rather than a located part of it.")
            print("\n  For comparison, FX 37 Tower groups the bands so each tier gets")
            print("  exactly one value, bass at the Feet (its default ix=1 < 128):")
            for i in range(5):
                lo, hi = tower_band_range_for_tier(i, 1)   # ix=1 = the Tower default
                band = BAND_NAMES[lo] if lo == hi else "%s + %s" % (BAND_NAMES[lo], BAND_NAMES[hi])
                print("    tier %d  %-11s  %s" % (i, TIERS[i][1], band))
            print("  ix >= 128 inverts it, putting the bass at the Head.")

    # ── 5. settings ──────────────────────────────────────────────────────────
    if settings:
        h("SETTINGS IN EFFECT")
        s = settings.get("settings") or {}
        caps = settings.get("capabilities") or {}
        sess = settings.get("session") or {}
        print("  program          %s" % sess.get("program"))
        print("  switch_bars      %s   (rotate every N bars while tempo-locked)" % s.get("switch_bars"))
        print("  color_story      %s" % s.get("color_story"))
        print("  bursts_on        %s   (Color Bursts overlay)" % s.get("bursts_on"))
        print("  randomize_on     %s   (beat-randomized reverse/mirror)" % s.get("randomize_on"))
        print("  flash_comfort    %s" % settings.get("flash_comfort"))
        print("  beat_align       %s   (phrase switches wait for the next beat)" % settings.get("beat_align"))
        print("  capabilities     %s" % ", ".join("%s=%s" % kv for kv in sorted(caps.items())))
        if settings.get("flash_comfort") == "reduced":
            print("\n  Flash Comfort 'reduced' is doing two things to this show: it forces")
            print("  the weighted deck instead of round-robin, and it accepts only every")
            print("  SECOND armed drop slam (DropEverySecond).")

    # ── 6. did the right effect meet the right moment ────────────────────────
    h("REACTIVITY — which effects met the loud moments")
    if samples and "flags" in idx:
        def flagged(bit):
            return {s[idx["t"]] for s in samples if s[idx["flags"]] & bit}
        drop_t, build_t, quiet_t = flagged(FLAG_DROP), flagged(FLAG_BUILD), flagged(FLAG_QUIET)

        def share_during(times):
            """Layer-aware share of dwell restricted to ticks with a flag set."""
            lay = tot = 0
            for e, d in pairs:
                v = viz_of(e, pool)
                if v is None or v not in FX:
                    continue
                hits = sum(1 for t in times if e["t"] <= t < e["t"] + d)
                if not hits:
                    continue
                tot += hits
                if FX[v]["family"] == "tier":
                    lay += hits
            return lay, tot
        verdicts = 0
        for name, times in (("drop", drop_t), ("build", build_t), ("quiet", quiet_t)):
            lay, tot = share_during(times)
            if not tot:
                print("  during %-6s ticks: none in this recording" % name)
            elif tot < MIN_TICKS_FOR_VERDICT:
                print("  during %-6s ticks: %d of %d tier-coherent -- n too small to read "
                      "(need %d)" % (name, lay, tot, MIN_TICKS_FOR_VERDICT))
            else:
                verdicts += 1
                print("  during %-6s ticks: tier-coherent effects held %s  (%d of %d ticks)" % (
                    name, pct(lay, tot), lay, tot))
        print("\n  overall tier-coherent share for comparison: %s" % pct(fam_dwell["tier"], total_dwell))
        if verdicts:
            print("  A drop/build share ABOVE the overall share means the DJ is steering")
            print("  the layer effects toward the big moments; at or below it means the")
            print("  layer effects are arriving by rotation, not by intent.")
    else:
        print("  no samples with flags in this recording")

    # ── 7. reasons ───────────────────────────────────────────────────────────
    h("WHY SWITCHES HAPPENED")
    reasons = Counter(e.get("r") or "?" for e in applied)
    for r, c in reasons.most_common():
        print("  %-8s %4d  %s" % (r, c, pct(c, len(applied))))
    prog = ((settings.get("session") or {}).get("program")
            or (applied[0].get("pg") if applied else None))
    if prog == "custom" and not reasons["drop"]:
        # This used to state flatly that a custom show CANNOT slam, because
        # resolveDJSettings hardcoded DropViz = -1. That stopped being true on
        # 2026-08-21: a custom program now picks its slam from the user's own
        # rated, capability- and comfort-filtered pool. A confident diagnosis
        # built on a rule that has since changed is worse than none, so the
        # three genuinely different causes are now separated rather than
        # collapsed into one verdict.
        rated_drop = drop_viz_available(settings)
        if rated_drop is None:
            print("\n  No drop slams, and none were possible: nothing flash-heavy")
            print("  (Strobe or The Drop) survives your ratings, capability and Flash")
            print("  Comfort, so djCustomDropViz resolved to -1. Rate one above Off to")
            print("  let the show react to a drop.")
        else:
            print("\n  No drop slams, but the show was ARMED for one: %s is rated and"
                  % rated_drop)
            print("  survives filtering, so DropViz resolved to it. The analyzer simply")
            print("  raised no accepted drop in this recording -- check the structure-flag")
            print("  timeline before concluding anything about the conductor.")
    if prog == "custom" and not reasons["quiet"]:
        print("\n  No quiet-mode switches: QuietViz is still -1 by construction for")
        print("  custom programs (music_auto_dj_runtime.go) -- 'highest-rated")
        print("  flash-heavy' is the wrong selector for a calm look, so it is left off")
        print("  until it has a rule of its own.")
    defer = doc.get("counters_cumulative_deferral") or {}
    align = doc.get("counters_cumulative_beat_align") or {}
    if defer:
        print("\n  deferral (cumulative since API start): %s" % json.dumps(defer))
    if align:
        print("  beat align (cumulative since API start): %s" % json.dumps(align))
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
