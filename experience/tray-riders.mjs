// The keyboard and mouse on the desk: ON the desktop / keyboard tray, or put away on the desk's shelf unit (desk-auto-stow.mjs), and the
// short carry between the two (docs/keyboard-tray/SPEC.md 0.3). Pure: no three.js, no DOM; the stage, film-fx, the Director's Tray panel
// and the node tests share it.
//
// WHERE the riders are is decided by the DESK'S TILT ONLY, never by the tray's pose (Vico, 25 Nov 2026: "When the keyboard isn't on the
// tray, I should be able to do whatever I want with the tray, and the keyboard and mouse must STAY up on the shelf unit"):
//   they go to the shelf when the desk tilts past LEAVE_DEG (9 deg, the desk's own stow angle, desk-auto-stow.mjs STOW_ANGLE), and come
//   back once it is down to RETURN_DEG (7 deg): a little hysteresis, so a desk that hovers about 9 deg does not send them back and forth.
// The decision is walked along the chapter's desk-tilt timeline (tiltAt(seconds)), so it is the same at every second however the film is
// scrubbed or rendered (frames out of order included).
//
// HOW they move: not a pop (Vico: "it disappears and appears over there ... make it a quick but smooth transition, not too slow, not too
// fast, snappy"): a carry of HANDOFF_S seconds, eased in and out, along a small lift-and-travel arc that rises clear of the desktop first
// and slides into the shelf level, so nothing passes through the desk (carryPath).
export const LEAVE_DEG = 9;        // = desk-auto-stow.mjs STOW_ANGLE (tests/tray-riders-test.mjs keeps them equal)
export const RETURN_DEG = 7;
export const HANDOFF_S = 0.4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// in-out cubic: a quick start and a soft landing in 0.4 s reads as "snappy" without a pop
export const carryEase = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };

// The hand-offs of a chapter: { start: 'tray' | 'shelf', events: [{ t, to }] }, t = the chapter second the tilt crosses the threshold
// (to 1 ms). tiltAt: chapter seconds -> desk tilt in degrees.
export function riderTimeline(tiltAt, seconds, { step = 1 / 120 } = {}) {
    const T = Number.isFinite(seconds) && seconds > 0 ? seconds : 0, tilt = s => { const v = Number(tiltAt(s)); return Number.isFinite(v) ? v : 0; };
    const out = { start: tilt(0) > LEAVE_DEG ? 'shelf' : 'tray', events: [], seconds: T };
    let shelf = out.start === 'shelf', prev = 0;
    const n = Math.ceil(T / step);
    for (let i = 1; i <= n; i++) {
        const t = Math.min(T, i * step), v = tilt(t);
        const crossed = shelf ? v < RETURN_DEG : v > LEAVE_DEG;
        if (crossed) {
            // the first moment of the crossing, by bisection between the two samples
            const test = x => shelf ? tilt(x) < RETURN_DEG : tilt(x) > LEAVE_DEG;
            let lo = prev, hi = t; for (let k = 0; k < 20; k++) { const mid = (lo + hi) / 2; if (test(mid)) hi = mid; else lo = mid; }
            shelf = !shelf; out.events.push({ t: Math.round(hi * 1000) / 1000, to: shelf ? 'shelf' : 'tray' });
        }
        prev = t;
    }
    return out;
}
// How far the riders are from the tray at chapter second s: 0 = on the desk / tray, 1 = on the shelf, between = being carried (eased).
// A hand-off that starts before the last one finished starts from where that one was.
export function riderAway(timeline, s, handoff = HANDOFF_S) {
    if (!timeline) return 0;
    let away = timeline.start === 'shelf' ? 1 : 0;
    for (const e of timeline.events) {
        if (e.t > s) break;
        const next = timeline.events[timeline.events.indexOf(e) + 1], until = next && next.t <= s ? next.t : s;
        const to = e.to === 'shelf' ? 1 : 0, u = handoff > 0 ? (until - e.t) / handoff : 1;
        away = away + (to - away) * carryEase(u);
    }
    return clamp(away, 0, 1);
}
// The state in words for the panel and the tests: { where: 'tray' | 'shelf' | 'to shelf' | 'to tray', away }.
export function riderState(timeline, s, handoff = HANDOFF_S) {
    const away = riderAway(timeline, s, handoff);
    if (away <= 0) return { where: 'tray', away: 0 };
    if (away >= 1) return { where: 'shelf', away: 1 };
    const last = [...(timeline?.events || [])].reverse().find(e => e.t <= s);
    return { where: last?.to === 'tray' ? 'to tray' : 'to shelf', away };
}
// The riders are on the shelf (or on their way) at second s: the tray's clearance limits do not apply (tray-pose.mjs riderAway).
export const ridersOff = (timeline, s) => riderAway(timeline, s) > 0;

// ---- the carry path ---------------------------------------------------------------------------------------------------------------
// In the desktop's own frame, millimetres (the desk's 'desktop' mount: y up from the desktop top, z toward the user, origin at the
// desktop's centre). from = the rider's centre on the desk / tray, to = its centre on the shelf; up = the world's up in this frame (the
// desktop tilts, the lift is straight up in the room). A cubic curve: it leaves `from` straight up, and arrives at `to` level, from the
// user's side (into the shelf, not down through the shelf above it). The lift is the least that keeps the rider clear of the desktop
// (its centre `half` mm above the top plus CLEAR_MM wherever it is over the desktop's footprint), and never less than MIN_LIFT_MM, so it
// always reads as a lift-and-travel. desk = { width, depth } of the desktop, mm; half = the rider's half height, mm.
export const MIN_LIFT_MM = 60, CLEAR_MM = 15, APPROACH_MM = 160;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
function bezier(p0, c1, c2, p1, u) {
    const v = 1 - u, a = v * v * v, b = 3 * u * v * v, c = 3 * u * u * v, d = u * u * u;
    return [0, 1, 2].map(i => a * p0[i] + b * c1[i] + c * c2[i] + d * p1[i]);
}
export function carryPath(from, to, { up = [0, 1, 0], desk = { width: 1219, depth: 762 }, half = 25 } = {}) {
    const ux = up[0], uy = up[1], uz = up[2], ul = Math.hypot(ux, uy, uz) || 1, U = [ux / ul, uy / ul, uz / ul];
    // arrive from the user's side of the shelf place (its +z in the desk frame), level with it
    const c2 = add(to, [0, 0, 1], APPROACH_MM);
    const at = (lift, u) => bezier(from, add(from, U, lift), c2, to, u);
    const over = p => Math.abs(p[0]) < desk.width / 2 + 20 && p[2] < desk.depth / 2 - 10;
    // the least lift that clears the desktop: the height above the top grows linearly with the lift at each u (only c1 carries it)
    // (the lift also moves the curve a little across the footprint when the desktop is tilted: three passes settle which samples are over it)
    let lift = MIN_LIFT_MM;
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < 40; i++) {
        const u = i / 40, w = 3 * u * (1 - u) * (1 - u); if (w < 0.05) continue;
        if (!over(at(lift, u))) continue;
        const need = half + CLEAR_MM - at(0, u)[1], gain = w * U[1];
        if (need > 0 && gain > 1e-6) lift = Math.max(lift, need / gain);
    }
    return { lift, at: u => at(lift, clamp(u, 0, 1)) };
}
