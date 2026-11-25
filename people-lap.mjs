// Hands and forearms never go into the person's own lap (S34, 24 Nov 2026: Omar in the media film let go of the wheels and
// brought his hands up to his knees through his thighs; second pass the same night: with the first fix his hands JUMPED onto
// his thighs at 4.2 s, 143 mm in one 1/60 s frame, and his fingers still went through them).
//
// A person in a wheelchair rests the hands on the thighs, and between the rims and the lap the arms cross the thighs. The
// built postures put the wrists in the thighs (the thigh's skin stands above the bone, the posture was built to the bone), and
// a hand fine-tuned by pose keys, or an arm blended from the rim pose to the lap pose, ends up wherever the sum of the turns
// leaves it. So the last word is the body: after the pose, the turns of the pose keys and the blend, the wrist is lifted
// straight up (the same two-bone solution the hands use everywhere, rig.reach; the hand keeps its own turn) until the hand,
// the fingers and the forearm are out of the thighs and the knee caps.
//
// How far to lift is never a jump:
//  - at rest (a posture, with its life) the lift is a smooth function of how deep the hand would be: nothing for a hand that
//    is clear (the pose is exactly the pose), easing in over the first SOFT millimetres of contact (C1: no kick when a finger
//    touches the cloth), then all of it. A hand that rests on the thigh rests ON it.
//  - through a change of posture (the rims to the lap) the depth itself jumps: a hand coming in low from the rim meets the
//    side of the thigh, and the way out over it is the whole height of the thigh above it. So a change is planned as one
//    move (lapPlan): the lift each wrist needs is measured at every 1/PLAN_STEPS of the change, and the lift drawn is a smooth
//    envelope over it: it rises (smoothstep) while the hand is still clear of the rims, holds over the thigh, comes down as
//    the hand gets there and settles (smoothstep, no speed at the end) exactly on what the posture at rest is given.
//    Continuous and with a continuous speed in the change's own time, so in every frame rate.
//   lapLifts(rig)                 { l, r }: metres each wrist is lifted, at rest (rig: the pose, fk() current)
//   lapPose(rig, pose, lifts)     the turn per arm bone on top of the pose the rig has (the pose keys' turns come first) that
//                                 lifts the wrists by `lifts` (or by lapLifts): { bone: [x, y, z, w] } for drawPose; `pose`
//                                 itself when nothing moves
//   lapPlan(rig, poseAt, opts)    a change: poseAt(w) leaves the rig in the change's pose at w (0..1) and returns the turns on
//                                 top; -> { at(w) -> { l, r }, need: { l, r } (the measured lifts) } or null (no lift anywhere)
//   lapRest(pose)                 whether a model at rest has its hands lifted out of its lap (a watcher's: they rest on the thighs)
//   lapModel(id, pose)            whether a change to or from a model is planned so (wheel-watch; the typing postures measured to
//                                 have them in the thighs as built, people-lap-data.mjs `typing`)
// The thighs' skin: assets/props/people-rigs + tools/people/measure-lap.mjs -> people-lap-data.mjs (a table of how far the
// skin is from the thigh bone, by place along it and the angle round it, in the thigh bone's own frame; the hand's points,
// fingers included, and the forearm's rings).
import * as THREE from 'three';
import LAP from './people-lap-data.mjs?v=people-lap-20261124b';
import { LAP_STATIONS, LAP_BINS, LAP_FROM, LAP_TO, thighFrame } from './people-lap-frame.mjs';

export { LAP_STATIONS, LAP_BINS, thighFrame };
// The skin's distance from the axis at s (0 the hip joint .. 1 the knee) and angle th, from a table (LAP_STATIONS x LAP_BINS, metres).
export function skinAt(table, s, th) {
    const f = Math.min(LAP_STATIONS - 1, Math.max(0, (s - LAP_FROM) / (LAP_TO - LAP_FROM) * LAP_STATIONS - .5)), k0 = Math.floor(f), k1 = Math.min(LAP_STATIONS - 1, k0 + 1), kf = f - k0;
    const g = (th + Math.PI) / (2 * Math.PI) * LAP_BINS - .5, j0 = Math.floor(g), jf = g - j0, a = ((j0 % LAP_BINS) + LAP_BINS) % LAP_BINS, b = (a + 1) % LAP_BINS;
    const row = k => table[k * LAP_BINS + a] * (1 - jf) + table[k * LAP_BINS + b] * jf;
    return row(k0) * (1 - kf) + row(k1) * kf;
}

// The names of the bones of the arms and hands of a rig (the pose keys' turns that a change of posture blends).
export const armBones = rig => ['l', 'r'].flatMap(s => [...rig.side[s].arm.slice(1), ...rig.side[s].fingers]).map(i => rig.names[i]);
export const lapRest = pose => pose === 'wheel-watch';
export const lapModel = (id, pose) => lapRest(pose) || !!LAP.typing?.[id];
const tableOf = (character, side) => (LAP.characters[character] || LAP.characters.default)[side];
const armOf = (character, side) => (LAP.characters[character] || LAP.characters.default).arm[side];
const foreOf = (character, side) => (LAP.characters[character] || LAP.characters.default).fore[side];
const FORE_BINS = 12;      // points round the forearm at each station (tools/people/measure-lap.mjs)
const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), wrist = new THREE.Vector3(), base = new THREE.Vector3();
const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), qh = new THREE.Quaternion(), frames = new Map(), points = new Map();
const smoothstep = (a, b, x) => { if (b <= a) return x >= b ? 1 : 0; const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, smooth = smoothstep;
const SKIN = .004;       // metres of cloth a hand lies on without going into it
const SOFT = .004;       // metres over which a lift at rest eases in (it leaves at most SOFT / 2 of the cloth's SKIN pressed)
const PLAN_STEPS = 120;  // a change measured at this many steps (every ~12 ms of a 1.4 s change)
const RISE = .45;        // the part of a change (0..1) over which the hands lift clear before they first meet a thigh
const MARGIN = .0015;    // metres a change's lift is kept over what was measured (for what a hand needs between two of the steps)
const END_EASE = .25;    // (lapPlan)
const SETTLE = .1;       // the end of a change, where the hand settles onto the thigh, over which that margin goes

// Where the thigh's skin is for a point (world): how far inside it is (+ inside, metres; the sample's own radius counted),
// and the way out (unit, into `into`). Only the part of the leg from the hip to a little past the knee counts.
function inside(rig, side, table, p, radius, into) {
    const [thigh, calf] = rig.side[side].leg;
    let fr = frames.get(rig); if (!fr) frames.set(rig, fr = {});
    const f = fr[side] ||= thighFrame(rig.offset[calf]);
    const axis = v0.copy(f.axis).applyQuaternion(rig.wq[thigh]), u1 = v1.copy(f.u1).applyQuaternion(rig.wq[thigh]), u2 = v2.copy(f.u2).applyQuaternion(rig.wq[thigh]);
    const len = rig.offset[calf].length(), d = v3.copy(p).sub(rig.wp[thigh]), s = d.dot(axis) / len;
    if (s < LAP_FROM - .08 || s > LAP_TO + .08) return -1;
    const x = d.dot(u1), y = d.dot(u2), r = Math.hypot(x, y); let skin = skinAt(table, s, Math.atan2(y, x));
    if (s > LAP_TO) skin *= Math.max(0, 1 - (s - LAP_TO) / .08);       // (past the knee cap: the skin closes)
    if (s < LAP_FROM) skin *= Math.max(0, 1 + (s - LAP_FROM) / .08);
    if (into) { if (r < 1e-5) into.copy(u1); else into.set(0, 0, 0).addScaledVector(u1, x / r).addScaledVector(u2, y / r); }
    return skin - r + radius;
}

// The hand's and the forearm's points (world), measured off the skin (tools/people/measure-lap.mjs) and posed on the rig now, with
// where each is along the arm (a hand's or a finger's point 1, the forearm's from its elbow to its wrist).
function samples(rig, side, character) {
    const key = side + '|' + character; let all = points.get(rig); if (!all) points.set(rig, all = new Map());
    let cache = all.get(key);
    if (!cache) {
        const wristAt = rig.offset[rig.side[side].arm[3]], reach = wristAt.length();
        cache = armOf(character, side).map(([name, x, y, z]) => ({ i: rig.index.get(name), local: new THREE.Vector3(x, y, z).divideScalar(1000), t: 1, p: new THREE.Vector3() })).filter(c => c.i !== undefined);
        // (the forearm: rings of points on its skin, from the elbow to the wrist, t along the arm)
        const lower = rig.side[side].arm[2], radii = foreOf(character, side), { axis, u1, u2 } = thighFrame(wristAt);
        for (let n = 0; n < radii.length / FORE_BINS; n++) { const t = (n + .5) / (radii.length / FORE_BINS); for (let j = 0; j < FORE_BINS; j++) { const ang = (j + .5) / FORE_BINS * 2 * Math.PI - Math.PI, mm = radii[n * FORE_BINS + j]; cache.push({ i: lower, local: axis.clone().multiplyScalar(t * reach).addScaledVector(u1, Math.cos(ang) * mm / 1000).addScaledVector(u2, Math.sin(ang) * mm / 1000), t, p: new THREE.Vector3() }); } }
        all.set(key, cache);
    }
    for (const c of cache) c.p.copy(c.local).applyQuaternion(rig.wq[c.i]).add(rig.wp[c.i]);
    return cache;
}
const MOST = .12;       // the most a point is taken out of the thigh: more is a mistake of the table, not a hand in a leg
const UP = new THREE.Vector3(0, 1, 0), probe = new THREE.Vector3();
// How far straight up a sample has to go to leave the thigh (and the air over it), to a quarter of a millimetre: the hand comes
// over the thigh from above, never out through its side or its underside. 0 for a sample that is clear.
function exitUp(rig, side, table, p) {
    if (inside(rig, side, table, p, SKIN) <= 0) return 0;
    for (let h = .004; h < MOST; h += .004) if (inside(rig, side, table, probe.copy(p).addScaledVector(UP, h), SKIN) <= 0) {
        let lo = h - .004, hi = h;
        for (let k = 0; k < 4; k++) { const m = (lo + hi) / 2; if (inside(rig, side, table, probe.copy(p).addScaledVector(UP, m), SKIN) <= 0) hi = m; else lo = m; }
        return hi;
    }
    return 0;       // (never out of it: not a hand in a thigh but a pose the table does not know, left as it is)
}
// The wrist of one side `h` metres above `at` (its place in the pose), the hand keeping the turn `q` (world): fk() after.
function lift(rig, side, at, q, h) {
    const [, upper, lower, hand] = rig.side[side].arm;
    wrist.copy(at).addScaledVector(UP, h);
    rig.reach(upper, lower, hand, wrist); rig.reach(upper, lower, hand, wrist); rig.setWorld(hand, q); rig.fk();
}
// How far one wrist has to go straight up for its hand and forearm to be out of the thighs (metres, the rig's pose as it is; left so).
function need(rig, side, character) {
    const table = tableOf(character, side), [, upper, lower, hand] = rig.side[side].arm, keep = [upper, lower, hand].map(i => rig.lq[i].clone());
    base.copy(rig.wp[hand]); qh.copy(rig.wq[hand]);
    let h = 0;
    for (let pass = 0; pass < 6; pass++) {
        let worst = 0;
        for (const s of samples(rig, side, character)) { const e = exitUp(rig, side, table, s.p) / Math.max(.45, s.t); if (e > worst) worst = e; }
        if (worst < 1e-4) break;
        h += worst + 1e-4; lift(rig, side, base, qh, h);
    }
    if (h > 0) { [upper, lower, hand].forEach((i, k) => rig.lq[i].copy(keep[k])); rig.fk(); }
    return h;
}
// The lift at rest for a depth h: none for a hand that is clear, eased in over SOFT (h^2 / 2 SOFT), then the depth less SOFT / 2.
export const softLift = h => h <= 0 ? 0 : h < SOFT ? h * h / (2 * SOFT) : h - SOFT / 2;
// { l, r }: how far each wrist is lifted at rest (metres), for the rig's pose (fk() current).
export function lapLifts(rig, { character = rig.character } = {}) {
    rig.fk();
    return { l: softLift(need(rig, 'l', character)), r: softLift(need(rig, 'r', character)) };
}

// The turns on top of the rig's pose (`pose`: a turn per bone, drawPose's) that lift the wrists by `lifts` ({ l, r } metres; by
// lapLifts when not given) and so keep the arms out of the thighs. `pose` itself when nothing moves.
const arm = rig => ['l', 'r'].flatMap(s => rig.side[s].arm.slice(1));
export function lapPose(rig, pose, lifts = null) {
    const saved = rig.lq.map(q => q.clone());
    rig.fk();
    if (pose) for (const [name, d] of Object.entries(pose)) { const i = rig.index.get(name); if (i !== undefined && Array.isArray(d) && d.length === 4) rig.lq[i].multiply(q0.fromArray(d)).normalize(); }
    rig.fk();
    const up = lifts || lapLifts(rig);
    let result = pose;
    if (up.l > 1e-7 || up.r > 1e-7) {
        for (const side of ['l', 'r']) if (up[side] > 1e-7) { const hand = rig.side[side].arm[3]; lift(rig, side, v0.copy(rig.wp[hand]), q1.copy(rig.wq[hand]), up[side]); }
        result = { ...(pose || {}) };
        // (the turn each arm bone has to be given on top of the pose as solved, so that the pose keys' turn and the lift come to the same: drawPose multiplies the turn on)
        arm(rig).forEach(i => { q1.copy(saved[i]).invert().multiply(rig.lq[i]).normalize(); result[rig.names[i]] = q1.toArray(); });
    }
    for (let i = 0; i < rig.n; i++) rig.lq[i].copy(saved[i]);
    rig.fk();
    return result;
}

// ---- a change of posture as one move ------------------------------------------------------------------------------
// The hands turn to how they rest on the knees early in a change, while they lift off the rims (over the first HAND_TURN of the arms'
// part of the change), not with the arms all the way: fingers still curled down round the rims had to be lifted the height of the
// thigh over it. handsAt(rig, pose): the hands' turns (world) in the rig's pose with the turns `pose` on it; turnHands(rig, pose,
// names, to, k): the turns on top of the rig's pose (`pose`, those of the bones `names` made again) that turn each hand k of the way
// to its turn in `to` ({ l, r }, world).
export const HAND_TURN = .6;
export const handTurnAt = (w, arms = null) => { const [a, b] = arms || [.22, 1]; return smoothstep(a, a + (b - a) * HAND_TURN, w); };
function turned(rig, pose) { if (pose) for (const [name, d] of Object.entries(pose)) { const i = rig.index.get(name); if (i !== undefined && Array.isArray(d) && d.length === 4) rig.lq[i].multiply(q0.fromArray(d)).normalize(); } rig.fk(); }
export function handsAt(rig, pose) {
    const solved = rig.lq.map(q => q.clone()); turned(rig, pose);
    const out = { l: rig.wq[rig.side.l.arm[3]].clone(), r: rig.wq[rig.side.r.arm[3]].clone() };
    for (let i = 0; i < rig.n; i++) rig.lq[i].copy(solved[i]); rig.fk();
    return out;
}
export function turnHands(rig, pose, names, to, k) {
    if (!to || !(k > 0)) return pose;
    const solved = rig.lq.map(q => q.clone()), out = { ...(pose || {}) }; turned(rig, pose);
    for (const s of ['l', 'r']) { const hand = rig.side[s].arm[3]; rig.setWorld(hand, q1.copy(rig.wq[hand]).slerp(to[s], k)); rig.fk(); }
    for (const name of names) { const i = rig.index.get(name); out[name] = q1.copy(solved[i]).invert().multiply(rig.lq[i]).normalize().toArray(); }
    for (let i = 0; i < rig.n; i++) rig.lq[i].copy(solved[i]); rig.fk();
    return out;
}

// The lift drawn through a change for one wrist, from the lifts it needs at w = k / n (need[0..n]; need[0] and need[n] what the postures
// at rest either side are given): one smooth move: it rises over RISE of the change to the most it will need (smoothstep), and comes
// down to what the posture at rest is given (smoothstep, so with no speed left at the end, where the posture at rest takes over),
// starting down as late as it must and no later: never under what it needs at the steps measured (MARGIN over, but at the very
// start and end, where the hand leaves and settles). C1 in w, and exactly need[0] at 0 and need[n] at 1.
function envelope(need) {
    const n = need.length - 1, start = need[0], rest = need[n];
    const margin = k => need[k] > 1e-5 ? MARGIN * Math.min(1, Math.max(0, (n - k) / (SETTLE * n)), k / (SETTLE * n)) : 0;
    let first = -1; for (let k = 1; k <= n; k++) if (need[k] > start + 1e-5) { first = k; break; }
    if (first < 0 && start < 1e-5 && rest < 1e-5) return null;
    let most = Math.max(start, rest); for (let k = 0; k <= n; k++) most = Math.max(most, need[k] + margin(k));
    const top = first > 0 ? (first - 1) / n : 0, from = Math.max(0, top - RISE);
    const shape = (a, w) => start + (rest + (most - rest) * (1 - smooth(a, 1, w)) - start) * smooth(from, top, w);
    // (the latest start of the way down that keeps it over what is needed: a whole smoothstep from there to the end)
    const over = a => { for (let k = 1; k < n; k++) if (shape(a, k / n) < need[k] + margin(k) - 1e-7) return false; return true; };
    let lo = top, hi = 1 - .5 / n;
    if (!over(lo)) for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (over(m)) hi = m; else lo = m; }
    const down = over(lo) ? lo : hi;
    const at = w => w <= 0 ? start : w >= 1 ? rest : shape(down, w);
    return { at, from, top, down, most, start, rest };
}
// A change from one posture to another, planned (see the top): poseAt(w) puts the rig in the change's pose at w and returns the turns
// on top of it (the pose keys'); ends: { from, to } whether the posture at rest before (and after) has its hands lifted out of the lap
// (lapRest: a watcher's; a typist's hands stay on the keys, its lift at rest is none) -> { at(w) -> { l, r }, need: { l: [...], r: [...] },
// shape: { l, r } } or null when no lift is needed anywhere.
export function lapPlan(rig, poseAt, { steps = PLAN_STEPS, character = rig.character, ends = { from: true, to: true } } = {}) {
    const needs = { l: [], r: [] }, fixed = k => (k === 0 && !ends.from) || (k === steps && !ends.to);
    for (let k = 0; k <= steps; k++) {
        const pose = poseAt(k / steps), saved = rig.lq.map(q => q.clone());
        turned(rig, pose);
        // (a posture at rest whose hands are not lifted (a typist's) is come to, or left, over END_EASE of the change: what the table
        // reads as needed there goes, so that the lift comes down to none with no step; the hands are where its keys put them)
        const ease = (ends.from ? 1 : smoothstep(0, END_EASE, k / steps)) * (ends.to ? 1 : 1 - smoothstep(1 - END_EASE, 1, k / steps));
        const up = fixed(k) ? { l: 0, r: 0 } : lapLifts(rig, { character }); needs.l.push(up.l * ease); needs.r.push(up.r * ease);
        for (let i = 0; i < rig.n; i++) rig.lq[i].copy(saved[i]); rig.fk();
    }
    const shape = { l: envelope(needs.l), r: envelope(needs.r) };
    if (!shape.l && !shape.r) return null;
    return { need: needs, shape, at: w => ({ l: shape.l ? Math.max(0, shape.l.at(w)) : 0, r: shape.r ? Math.max(0, shape.r.at(w)) : 0 }) };
}
