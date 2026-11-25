// Hands and forearms never go into the person's own lap (S34, 24 Nov 2026: Omar in the media film let go of the wheels and
// brought his hands up to his knees through his thighs).
//
// A person in a wheelchair rests the hands on the thighs, and between the rims and the lap the arms cross the thighs. The
// built postures put the wrists in the thighs (the thigh's skin stands above the bone, the posture was built to the bone), and
// a hand fine-tuned by pose keys, or an arm blended from the rim pose to the lap pose, ends up wherever the sum of the turns
// leaves it. So the last word is the body: after the pose, the turns of the pose keys and the blend, this keeps the hand
// (palm, fingers) and the forearm out of the thigh and the knee, by the same two-bone solution the hands use everywhere
// (rig.reach): a hand in the skin is moved out along the way the skin faces, the hand keeping its own turn. A hand that is
// clear of the thigh is not touched at all (the pose is exactly the pose), one that rests on it rests ON it.
//   lapClear(rig)        the arms of the rig (fk() current) out of the thighs. Returns how far a wrist had to go.
//   lapPose(rig, pose)   the same as a turn per arm bone on top of the pose the rig has (the pose keys' turns come
//                             first): { bone: [x, y, z, w] } for drawPose; `pose` itself when nothing had to move.
// The thighs' skin: assets/props/people-rigs + tools/people/measure-lap.mjs -> people-lap-data.mjs (a table of how far the
// skin is from the thigh bone, by place along it and the angle round it, in the thigh bone's own frame).
import * as THREE from 'three';
import LAP from './people-lap-data.mjs';
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
const tableOf = (character, side) => (LAP.characters[character] || LAP.characters.default)[side];
const armOf = (character, side) => (LAP.characters[character] || LAP.characters.default).arm[side];
const foreOf = (character, side) => (LAP.characters[character] || LAP.characters.default).fore[side];
const FORE_BINS = 12;      // points round the forearm at each station (tools/people/measure-lap.mjs)
const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), out = new THREE.Vector3(), a = new THREE.Vector3(), wrist = new THREE.Vector3();
const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), qh = new THREE.Quaternion(), frames = new Map(), points = new Map();
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SKIN = .004;       // metres of cloth a hand lies on without going into it

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
    if (r < 1e-5) into.copy(u1); else into.set(0, 0, 0).addScaledVector(u1, x / r).addScaledVector(u2, y / r);
    return skin - r + radius;
}

// The hand's and the forearm's points (world), measured off the skin (tools/people/measure-lap.mjs) and posed on the rig now, with
// where each is along the arm (a hand's point 1, the forearm's from its elbow to its wrist).
function samples(rig, side, character, list) {
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
const list = [], UP = new THREE.Vector3(0, 1, 0), probe = new THREE.Vector3();
// How far straight up a sample has to go to leave the thigh (and the air over it): the hand comes over the thigh from above, never
// out through its side or its underside. 0 for a sample that is clear.
function exitUp(rig, side, table, s) {
    if (inside(rig, side, table, s.p, SKIN, v3) <= 0) return 0;
    for (let h = .004; h < MOST; h += .004) if (inside(rig, side, table, probe.copy(s.p).addScaledVector(UP, h), SKIN, v3) <= 0) return h;
    return 0;       // (never out of it: not a hand in a thigh but a pose the table does not know, left as it is)
}
export function lapClear(rig, { character = rig.character } = {}) {
    rig.fk(); let moved = 0;
    for (const side of ['l', 'r']) {
        const table = tableOf(character, side), [, upper, lowerI, hand] = rig.side[side].arm;
        qh.copy(rig.wq[hand]); a.copy(rig.wp[hand]);
        for (let pass = 0; pass < 4; pass++) {
            let worst = 0;
            for (const s of samples(rig, side, character, list)) { const h = exitUp(rig, side, table, s) / Math.max(.45, s.t); if (h > worst) worst = h; }
            if (worst < 2e-4) break;
            wrist.copy(rig.wp[hand]).addScaledVector(UP, worst + 3e-4);
            rig.reach(upper, lowerI, hand, wrist); rig.reach(upper, lowerI, hand, wrist); rig.setWorld(hand, qh); rig.fk();
        }
        moved = Math.max(moved, rig.wp[hand].distanceTo(a));
    }
    return moved;
}

// The turns on top of the rig's pose (`pose`: a turn per bone, drawPose's) that keep the arms out of the thighs.
const arm = rig => ['l', 'r'].flatMap(s => rig.side[s].arm.slice(1));
export function lapPose(rig, pose) {
    const saved = rig.lq.map(q => q.clone());
    rig.fk();
    if (pose) for (const [name, d] of Object.entries(pose)) { const i = rig.index.get(name); if (i !== undefined && Array.isArray(d) && d.length === 4) rig.lq[i].multiply(q0.fromArray(d)).normalize(); }
    rig.fk();
    const moved = lapClear(rig);
    let result = pose;
    if (moved > 1e-6) {
        result = { ...(pose || {}) };
        // (the turn each arm bone has to be given on top of the pose as solved, so that the pose keys' turn and the move out come to the same: drawPose multiplies the turn on)
        arm(rig).forEach((i, n) => { q1.copy(saved[i]).invert().multiply(rig.lq[i]).normalize(); result[rig.names[i]] = q1.toArray(); });
    }
    for (let i = 0; i < rig.n; i++) rig.lq[i].copy(saved[i]);
    rig.fk();
    return result;
}
