// Pure (no three.js): shared by the film (room-people-motion.mjs, room-people.mjs) and the Director's People tab.
// A desk user's distance from the desk (mm, the placement's `reach`) at film second `time`. reachKeys: [{ at, dur, to,
// ease }] roll the chair in or out during the shot: from `at`, over `dur` seconds, to `to` mm (ease: 'smooth', the
// default, or 'linear'); before the first key it is `reach`. No keys or no time (the Studio): `reach` itself.
export function reachAt(reach, keys, time) {
    if (!Array.isArray(keys) || !keys.length || !Number.isFinite(time)) return reach;
    let v = reach;
    for (const k of [...keys].filter(k => k && Number.isFinite(k.at) && Number.isFinite(k.to)).sort((a, b) => a.at - b.at)) {
        if (time <= k.at) break;
        const dur = Math.max(0, Number.isFinite(k.dur) ? k.dur : 1.5), u = dur > 0 ? Math.min(1, (time - k.at) / dur) : 1, e = k.ease === 'linear' ? u : u * u * (3 - 2 * u);
        v = v + (k.to - v) * e; if (u < 1) break;
    }
    return v;
}
