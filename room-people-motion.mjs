// How the people move (room-people.mjs draws them).
//
// The models are still: one mesh per posture, baked, with the posture as the skeleton's rest pose. A person who moves
// is one skinned model whose bones are turned to another posture of the same character; the bone data of every
// posture comes from assets/props/people-rigs/<character>.json (tools/people/export-rigs.mjs).
//
// The person at the featured desk (DeskActor):
//   seated, hands on the keyboard  <->  hands off, chair pushed back, feet under, up  <->  standing, arms loose  <->
//   standing, hands on the keyboard
// Two numbers describe where in that they are: `tau` (seconds into standing up, 0 seated .. STAND_UP standing) and
// `k` (hands, 0 off the keys .. 1 on them). The pose is a pure function of (tau, k, desk height, time, seed):
// solve(). What moves tau and k is the desk: its height and where it is going (stepDesk). A person takes about
// three seconds to stand up and the desk ten to rise, so the body is not tied to the height: it starts when the desk
// sets off for a standing height, finishes on its own, waits, and the hands come back as the desk arrives. If the
// desk stops half way the person is simply standing by; if it turns back before they are up, so do they.
//   Studio: stepDesk() once per frame with the live height, the height the desk is travelling to and the frame's dt.
//   Film and Director: simulateDesk() runs the same steps over the chapter's desk track from its first second, so
//   the state at any second depends on nothing else and scrubbing gives the same frames as playing.
// Everything else (breathing, the head, weight shifts, typing fingers) is layered on from time and a seed.
import * as THREE from 'three';

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

export const STAND_UP = 2.6;           // seconds from seated to standing
export const INCH_KEYS = .0269;        // metres the keyboard rises per inch of desk height (tools/people/cast.py keys_at)
export const HANDS_FIT = 1.4;          // inches below a built desk height the hands still reach the keys
const SIT_REACH_UP = 2;                // a seated typist's forearms follow the keys this far above the built height, then they stand
const STAND_REACH_DOWN = 6.5;          // a standing typist follows the keys this far below the built height (arms nearly straight)
const TILT_FLAT = 4;                   // degrees of desktop tilt beyond which the hands leave the keys (drafting)
const LEAD = 3.2;                      // sitting down starts when a lowering desk is this far above sitting height
const NEAR = 1.3;                      // the hands go back to the keys when the desk is this close to where it stops
const ROLL = .265;                     // metres the chair rolls back before its user stands (their feet end under them)
const SWAP = 1.45;                     // seconds into standing up at which the standing model takes over from the seated one
const SCOOT = .09;                     // they slide to the front of the seat as they lean in (the chair's base clears their heels)
const NUDGE = .15;                     // and how much further the calves push it as the knees straighten

// ---- driver --------------------------------------------------------------------------------------------------
// desc: { sit: { lo, hi } | null, stand: { lo, hi } | null }: the desk heights (inches) at which the seated and
// the standing posture reach the keys. With both, the person changes between them; with one they keep it.
export function deskDescription(sitHeights, standHeights, lowStand = false) {
    const range = (list, down, up) => list.length ? { lo: Math.min(...list) - down, hi: Math.max(...list) + up } : null;
    return { sit: range(sitHeights, HANDS_FIT, SIT_REACH_UP), stand: range(standHeights, lowStand ? HANDS_FIT : STAND_REACH_DOWN, HANDS_FIT) };
}
const within = (h, r) => !!r && h >= r.lo - 1e-6 && h <= r.hi + 1e-6;
// What the person wants at this height, with the desk travelling to `dest` (inches; null or the height itself when it
// is not moving or nobody knows).
export function deskWants(desc, state, height, dest, tilt = 0) {
    const goal = Number.isFinite(dest) ? dest : height, lowering = goal < height - .02;
    let stand = !desc.sit;
    if (desc.sit && desc.stand) stand = goal > desc.sit.hi || height > desc.sit.hi + (lowering ? LEAD : 0);
    const settled = stand ? state.tau >= STAND_UP - 1e-6 : state.tau <= 1e-6, reach = stand ? desc.stand : desc.sit;
    const hands = settled && Math.abs(tilt || 0) <= TILT_FLAT && within(height, reach) && within(goal, reach) && (!!state.on || Math.abs(goal - height) <= NEAR);
    return { stand, hands };
}
export function settleDesk(desc, height, tilt = 0) {
    const state = { tau: 0, k: 0, on: false }, first = deskWants(desc, state, height, height, tilt);
    state.tau = first.stand ? STAND_UP : 0;
    state.on = deskWants(desc, state, height, height, tilt).hands; state.k = state.on ? 1 : 0;
    return state;
}
// One step of `dt` seconds. The hands leave the keys before the body moves and return once it has arrived.
export function stepDesk(desc, state, height, dest, dt, tilt = 0) {
    const want = deskWants(desc, state, height, dest, tilt);
    state.on = want.hands;
    state.k = want.hands ? Math.min(1, state.k + dt / .75) : Math.max(0, state.k - dt / .5);
    if (state.k < .35) state.tau = want.stand ? Math.min(STAND_UP, state.tau + dt) : Math.max(0, state.tau - dt * .92);
    return state;
}
// The whole chapter: heightAt(seconds) (inches) and tiltAt(seconds) (degrees, optional) are the desk's track.
// Returns at(seconds) -> { tau, k }.
export function simulateDesk(desc, heightAt, seconds, hz = 60, tiltAt = null) {
    const n = Math.max(2, Math.ceil(Math.max(0, seconds) * hz) + 1), H = new Float32Array(n), dest = new Float32Array(n), tau = new Float32Array(n), k = new Float32Array(n);
    for (let i = 0; i < n; i++) H[i] = heightAt(i / hz);
    // where the desk is going: the height at which the run it is in now ends
    dest[n - 1] = H[n - 1];
    for (let i = n - 2; i >= 0; i--) {
        const d = H[i + 1] - H[i], next = i + 2 < n ? H[i + 2] - H[i + 1] : 0;
        dest[i] = Math.abs(d) <= 1e-6 ? H[i] : Math.abs(next) > 1e-6 && Math.sign(next) === Math.sign(d) ? dest[i + 1] : H[i + 1];
    }
    const state = settleDesk(desc, H[0], tiltAt ? tiltAt(0) : 0); tau[0] = state.tau; k[0] = state.k;
    for (let i = 1; i < n; i++) { stepDesk(desc, state, H[i], dest[i], 1 / hz, tiltAt ? tiltAt(i / hz) : 0); tau[i] = state.tau; k[i] = state.k; }
    return {
        seconds, hz, tau, k,
        at(t) { const x = Math.min(n - 1, Math.max(0, (Number.isFinite(t) ? t : 0) * hz)), i = Math.min(n - 2, Math.floor(x)), f = x - i; return { tau: lerp(tau[i], tau[i + 1], f), k: lerp(k[i], k[i + 1], f) }; }
    };
}

// ---- skeleton -------------------------------------------------------------------------------------------------
// A solver skeleton: local turns and places of the bones, and where that puts them (metres, the model's own frame:
// y up, facing +z, the person's left is +x). Not drawn; DeskActor copies the turns onto the drawn model's bones.
export class PersonRig {
    constructor(data) {
        this.names = data.bones; this.parents = data.parents; this.n = this.names.length; this.postures = data.postures; this.character = data.character;
        this.index = new Map(this.names.map((name, i) => [name, i]));
        this.offset = this.names.map((_, i) => new THREE.Vector3().fromArray(data.offsets, i * 3));
        this.lq = this.names.map(Q); this.lp = this.offset.map(v => v.clone()); this.wq = this.names.map(Q); this.wp = this.names.map(V);
        this.keys = new Map();
        const b = name => this.index.get(name);
        this.b = Object.fromEntries(['Root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head'].map(n => [n, b(n)]));
        this.side = Object.fromEntries(['l', 'r'].map(s => [s, {
            arm: ['clavicle_', 'upperarm_', 'lowerarm_', 'hand_'].map(n => b(n + s)), leg: ['thigh_', 'calf_', 'foot_', 'ball_'].map(n => b(n + s)),
            fingers: this.names.map((n, i) => /^(thumb|index|middle|ring|pinky)_0\d_/.test(n) && n.endsWith('_' + s) ? i : -1).filter(i => i >= 0)
        }]));
        this.core = [this.b.pelvis, this.b.spine_01, this.b.spine_02, this.b.spine_03, this.b.neck_01, this.b.head];
    }
    has(id) { return !!this.postures[id]; }
    // A posture as built, shifted `dz` metres along the way the person faces (two postures built for different
    // distances from the desk, in one frame).
    key(id, dz = 0) {
        const tag = id + '|' + dz; if (this.keys.has(tag)) return this.keys.get(tag);
        const p = this.postures[id]; if (!p) return null;
        const key = { id, pose: p.pose, deskHeight: p.deskHeight ?? null, q: this.names.map((_, i) => new THREE.Quaternion().fromArray(p.q, i * 4).normalize()), root: new THREE.Vector3(p.root[0], p.root[1], p.root[2] + dz), pelvis: new THREE.Vector3().fromArray(p.pelvis), dz };
        this.load(key); this.fk(); key.wp = this.wp.map(v => v.clone()); key.wq = this.wq.map(q => q.clone());
        this.keys.set(tag, key); return key;
    }
    load(key) { for (let i = 0; i < this.n; i++) this.lq[i].copy(key.q[i]); this.lp[this.b.Root].copy(key.root); this.lp[this.b.pelvis].copy(key.pelvis); }
    fk() {
        for (let i = 0; i < this.n; i++) {
            const p = this.parents[i];
            if (p < 0) { this.wq[i].copy(this.lq[i]); this.wp[i].copy(this.lp[i]); }
            else { this.wq[i].multiplyQuaternions(this.wq[p], this.lq[i]); this.wp[i].copy(this.lp[i]).applyQuaternion(this.wq[p]).add(this.wp[p]); }
        }
    }
    // Turns bone i so that it faces `world` (its parent as fk() left it).
    setWorld(i, world) { this.lq[i].copy(this.wq[this.parents[i]]).invert().multiply(world).normalize(); }
    // Turns bone i by `turn`, a rotation in the model's frame, about its own head.
    turnWorld(i, turn) { const pw = this.wq[this.parents[i]]; tw.multiplyQuaternions(pw, this.lq[i]).premultiply(turn); this.lq[i].copy(pw).invert().multiply(tw).normalize(); }
    // Puts the pelvis at a place in the model's frame.
    placePelvis(at) { const r = this.b.Root; this.lp[this.b.pelvis].copy(at).sub(this.lp[r]).applyQuaternion(tq.copy(this.lq[r]).invert()); }
    // Two-bone IK (the same construction as the Director's pose mode): bones a and b turn so that c reaches `target`;
    // the bend stays in the plane it is in. fk() must be current; it is run again afterwards.
    reach(a, b, c, target) {
        if (this.wp[c].distanceToSquared(target) < 1e-12) return;       // already there (a limb as built, however straight)
        const pa = this.wp[a], pb = this.wp[b], pc = this.wp[c], eps = 1e-6, acos = x => Math.acos(THREE.MathUtils.clamp(x, -1, 1));
        const lab = pb.distanceTo(pa), lcb = pb.distanceTo(pc), lat = THREE.MathUtils.clamp(target.distanceTo(pa), eps, lab + lcb - eps);
        const ac = v1.copy(pc).sub(pa).normalize(), ab = v2.copy(pb).sub(pa).normalize(), ba = v3.copy(pa).sub(pb).normalize(), bc = v4.copy(pc).sub(pb).normalize(), at = v5.copy(target).sub(pa).normalize();
        const acab0 = acos(ac.dot(ab)), babc0 = acos(ba.dot(bc)), acat0 = acos(ac.dot(at));
        const acab1 = acos((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat)), babc1 = acos((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb));
        const ai = q1.copy(this.wq[a]).invert(), bi = q2.copy(this.wq[b]).invert();
        const axis0 = v6.copy(ac).cross(ab); if (axis0.lengthSq() < 1e-10) axis0.set(1, 0, 0).applyQuaternion(this.wq[b]); axis0.normalize();
        const axis1 = v7.copy(ac).cross(at), turn = axis1.lengthSq() > 1e-12;
        const r0 = q3.setFromAxisAngle(v8.copy(axis0).applyQuaternion(ai), acab1 - acab0), r1 = q4.setFromAxisAngle(v8.copy(axis0).applyQuaternion(bi), babc1 - babc0);
        if (turn) r0.multiply(q5.setFromAxisAngle(axis1.normalize().applyQuaternion(ai), acat0));
        this.lq[a].multiply(r0).normalize(); this.lq[b].multiply(r1).normalize(); this.fk();
    }
}
const tv = V(), tq = Q(), tw = Q(), q1 = Q(), q2 = Q(), q3 = Q(), q4 = Q(), q5 = Q(), v1 = V(), v2 = V(), v3 = V(), v4 = V(), v5 = V(), v6 = V(), v7 = V(), v8 = V();

// ---- small deterministic noise ----------------------------------------------------------------------------------
const hash = (n, seed) => { let x = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9E3779B1), 0x85EBCA6B); x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
// Smooth value noise, -1..1, about one wiggle per unit of x.
const noise = (x, seed) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1; };
export const seedOf = text => { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// ---- the person at the desk -----------------------------------------------------------------------------------------
// keys: { sit: [key, ...], stand: [key, ...] (hands on the keyboard, built for key.deskHeight, lowest first; either may
// be empty), wait: key | null (standing, arms loose) }.
// input: { tau, k, height (inches), time (seconds, for the life in the pose; null = none), seed, life: 0..1 }
// Leaves the pose in rig.lq / rig.lp (fk() current) and returns { stance: 'sit' | 'stand', chair: { back, turn } }
// (metres the chair has rolled back from under the seated person, degrees it has turned).
const turn = Q(), turn2 = Q(), handQ = Q(), footQ = Q(), spot = V(), dir = V(), up = V(), hip = V(), keysAt = V(), awayAt = V();
const away = { l: [Q(), Q(), Q(), Q()], r: [Q(), Q(), Q(), Q()] }, onKeys = { l: [Q(), Q(), Q(), Q()], r: [Q(), Q(), Q(), Q()] };
// Two postures of one stance blended by desk height: which two, how much of the second, and how far the keys are
// above the height the blend is built for (metres).
function byHeight(list, height) {
    if (!list.length) return null;
    let a = list[0], b = list[0];
    for (let i = 0; i < list.length - 1; i++) if (height >= list[i].deskHeight) { a = list[i]; b = list[i + 1]; }
    if (height >= list[list.length - 1].deskHeight) a = b = list[list.length - 1];
    const w = a === b ? 0 : clamp01((height - a.deskHeight) / (b.deskHeight - a.deskHeight)), built = a === b ? a.deskHeight : lerp(a.deskHeight, b.deskHeight, w);
    return { a, b, w, lift: (height - (built ?? height)) * INCH_KEYS };
}
const blendQ = (out, pair, i) => pair.w > 0 ? out.slerpQuaternions(pair.a.q[i], pair.b.q[i], pair.w) : out.copy(pair.a.q[i]);
const blendV = (out, pair, i) => pair.w > 0 ? out.lerpVectors(pair.a.wp[i], pair.b.wp[i], pair.w) : out.copy(pair.a.wp[i]);
const blendW = (out, pair, i) => pair.w > 0 ? out.slerpQuaternions(pair.a.wq[i], pair.b.wq[i], pair.w) : out.copy(pair.a.wq[i]);

// Typing: in bursts with pauses, one finger of each hand at a time dips onto a key (the two hands half a beat apart).
function tapKeys(rig, s, time, seed, life) {
    const { fingers, arm } = rig.side[s], busy = ss(-.15, .1, noise(time * .31 + (s === 'l' ? 0 : .4), seed + 21)) * life, beat = time * (6.1 + hash(3, seed) * 1.6) + (s === 'l' ? 0 : .5), n = Math.floor(beat), x = beat - n;
    const which = Math.floor(hash(n, seed + (s === 'l' ? 40 : 41)) * 5.99) % 5, tap = Math.sin(Math.PI * x) ** 2 * busy * (hash(n, seed + 50) < .82 ? 1 : 0);
    if (tap <= 0) return;
    fingers.forEach((i, at) => {
        const finger = Math.floor(at / 3), joint = at % 3; if (finger !== which) return;
        rig.lq[i].multiply(turn.setFromAxisAngle(X, tap * (joint === 0 ? .2 : joint === 1 ? .1 : .05) * (rig.names[i].startsWith('thumb') ? .5 : 1)));
    });
    rig.lq[arm[3]].multiply(turn.setFromAxisAngle(X, tap * .012));
}

export function solveDesk(rig, keys, input) {
    const mobile = keys.sit.length > 0 && keys.stand.length > 0, tau = mobile ? input.tau : keys.sit.length ? 0 : STAND_UP;
    const k = clamp01(input.k), ke = k * k * (3 - 2 * k), height = input.height, time = input.time, life = time === null || time === undefined ? 0 : input.life ?? 1, seed = input.seed | 0;
    const sit = byHeight(keys.sit, height), type = byHeight(keys.stand, height), wait = keys.wait || type?.a;
    const b = rig.b, standing = tau >= STAND_UP / 2;
    // how far along each part of standing up is
    const roll = ss(.05, .85, tau), rise = clamp01((tau - .95) / 1.4), core = sit ? ss(1.05, 2.4, tau) : 1, legs = sit ? ss(.95, 2.3, tau) : 1;
    const lean = THREE.MathUtils.degToRad(36) * ss(.5, 1.28, tau) * (1 - ss(1.32, 2.25, tau));
    // ---- core: pelvis, spine, neck and head turn from the seated posture to the standing one
    const standQ = (out, i) => type && wait ? out.slerpQuaternions(wait.q[i], tq.copy(type.w > 0 ? tw.slerpQuaternions(type.a.q[i], type.b.q[i], type.w) : type.a.q[i]), ke) : out.copy((wait || type.a).q[i]);
    for (let i = 0; i < rig.n; i++) {
        if (sit && core < 1) { blendQ(rig.lq[i], sit, i); if (core > 0 && (type || wait)) rig.lq[i].slerp(standQ(turn, i), rig.core.includes(i) ? core : legs); }
        else standQ(rig.lq[i], i);
    }
    // where the standing posture puts a bone: the standing-by model, or by `ke` the typing one (they can differ by millimetres)
    const standV = (out, i) => type && wait && ke > 0 ? out.lerpVectors(wait.wp[i], blendV(v8, type, i), ke) : out.copy((wait || type.a).wp[i]);
    const standW = (out, i) => type && wait && ke > 0 ? out.slerpQuaternions(wait.wq[i], blendW(tw, type, i), ke) : out.copy((wait || type.a).wq[i]);
    if (type || wait) { rig.lp[b.Root].copy((wait || type.a).root); if (type && wait && ke > 0) rig.lp[b.Root].lerp(type.a.root, ke); }
    if (sit) { if (type || wait) rig.lp[b.Root].lerpVectors(sit.a.root, tv.copy(rig.lp[b.Root]), core); else rig.lp[b.Root].copy(sit.a.root); }
    // ---- pelvis: back with the chair, then forward over the feet and up
    const seat = sit ? blendV(V(), sit, b.pelvis) : null, feet = type || wait ? standV(V(), b.pelvis) : null;
    const pelvis = spot;
    if (seat && feet) pelvis.set(lerp(seat.x, feet.x, ss(0, 1, rise)), lerp(seat.y, feet.y, ss(.1, 1, rise)), lerp(seat.z - ROLL * roll, feet.z, ss(0, .86, rise)));
    else pelvis.copy(seat || feet);
    // life: a slow shift of weight from foot to foot while standing, a small settling in the seat
    const upright = seat && feet ? ss(.8, 1, rise) : feet ? 1 : 0;
    let sway = 0, breath = 0;
    if (life > 0) {
        sway = noise(time * .11 + 7.3, seed) * .016 * upright * life;
        breath = Math.sin(time * Math.PI * 2 / (3.7 + hash(1, seed) * 1.2) + hash(2, seed) * 6.28) * life;
        pelvis.x += sway; pelvis.y -= (.005 + Math.abs(sway) * .2) * upright * life;      // knees a little soft, so the hip over the standing leg can rise
    }
    rig.placePelvis(pelvis); rig.fk();
    // the trunk leans in over the feet to stand up (hips most, then the spine), and the head stays up
    if (lean > 1e-4) {
        for (const [bone, share] of [[b.pelvis, .52], [b.spine_01, .2], [b.spine_02, .16], [b.spine_03, .12], [b.neck_01, -.34], [b.head, -.5]]) { rig.turnWorld(bone, turn.setFromAxisAngle(X, lean * share)); rig.fk(); }
    }
    if (life > 0) {
        // breathing lifts the chest; the hips roll into the standing leg; the head drifts and now and then looks down at
        // the hands or across the room
        rig.turnWorld(b.spine_02, turn.setFromAxisAngle(X, -.008 * breath)); rig.fk(); rig.turnWorld(b.spine_03, turn.setFromAxisAngle(X, -.011 * breath)); rig.fk();
        if (upright > 0) { rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Z, sway * 1.3)); rig.fk(); rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Z, -sway * 1.1)); rig.fk(); }
        const glance = ss(.62, .8, noise(time * .16 + 31, seed)), yaw = (noise(time * .19, seed + 5) * .07 + noise(time * .053 + 3, seed + 6) * .09) * life, nod = (noise(time * .23 + 11, seed + 7) * .03 + glance * .2 * (1 - ke * .35)) * life;
        rig.turnWorld(b.neck_01, turn.setFromAxisAngle(Y, yaw * .4).multiply(turn2.setFromAxisAngle(X, nod * .4 + .004 * breath))); rig.fk();
        rig.turnWorld(b.head, turn.setFromAxisAngle(Y, yaw * .6).multiply(turn2.setFromAxisAngle(X, nod * .6))); rig.fk();
    }
    // ---- legs: the feet step back under the knees one after the other while the chair rolls, then stay planted
    for (const s of ['l', 'r']) {
        const [thigh, calf, foot] = rig.side[s].leg, from = sit ? blendV(v1, sit, foot).clone() : null, to = feet ? standV(V(), foot) : null;
        const step = !from ? 1 : !to ? 0 : s === 'l' ? ss(.2, .64, tau) : ss(.5, .94, tau);
        if (from && to) { spot.lerpVectors(from, to, step); spot.y += .032 * Math.sin(Math.PI * step); footQ.slerpQuaternions(blendW(tq, sit, foot), standW(turn, foot), step); }
        else { spot.copy(from || to); if (from) blendW(footQ, sit, foot); else standW(footQ, foot); }
        rig.reach(thigh, calf, foot, spot); rig.reach(thigh, calf, foot, spot); rig.setWorld(foot, footQ);
    }
    rig.fk();
    // ---- arms
    const lift = (standing ? type : sit)?.lift ?? 0, keyed = standing ? type : sit, armsDown = !sit ? 1 : !wait ? 0 : ss(1.45, 2.5, tau);
    for (const s of ['l', 'r']) {
        const arm = rig.side[s].arm, [clavicle, upper, lower, hand] = arm, [thigh, calf] = rig.side[s].leg, fingers = rig.side[s].fingers;
        // away from the keys: seated and getting up, a hand on each thigh; standing, the arms hang
        if (armsDown < 1) {
            for (const i of arm) blendQ(rig.lq[i], sit, i);
            rig.fk();
            hip.copy(rig.wp[thigh]); dir.copy(rig.wp[calf]).sub(hip); const length = dir.length(); dir.normalize();
            up.copy(Y).addScaledVector(dir, -dir.y).normalize();
            spot.copy(hip).addScaledVector(dir, length * .6).addScaledVector(up, .088); spot.x += (s === 'l' ? 1 : -1) * .012;
            handQ.setFromAxisAngle(X, Math.atan2(-dir.y, Math.hypot(dir.z, dir.x)) * .9 + .12).multiply(blendW(tq, sit, hand));
            rig.reach(upper, lower, hand, spot); rig.setWorld(hand, handQ);
            arm.forEach((i, n) => away[s][n].copy(rig.lq[i]));
        }
        if (armsDown > 0) arm.forEach((i, n) => armsDown < 1 ? away[s][n].slerp(wait.q[i], armsDown) : away[s][n].copy(wait.q[i]));
        // on the keys: the posture as built, the wrists following the keyboard as the desk moves a little
        if (ke > 0 && keyed) {
            for (const i of arm) blendQ(rig.lq[i], keyed, i);
            rig.fk();
            if (Math.abs(lift) > 1e-5 || life > 0) {
                blendV(spot, keyed, hand); spot.y += lift; blendW(handQ, keyed, hand);
                rig.reach(upper, lower, hand, spot); rig.setWorld(hand, handQ);
            }
            arm.forEach((i, n) => onKeys[s][n].copy(rig.lq[i])); keysAt.copy(rig.wp[hand]);
        }
        const between = ke > 0 && ke < 1 && keyed;
        if (between) { arm.forEach((i, n) => rig.lq[i].copy(away[s][n])); rig.fk(); awayAt.copy(rig.wp[hand]); }
        arm.forEach((i, n) => { rig.lq[i].copy(away[s][n]); if (ke > 0 && keyed) rig.lq[i].slerp(onKeys[s][n], ke); });
        rig.fk();
        // between the two the wrist comes up and over the desk's edge: on the way to the keys it rises first and then
        // goes forward, on the way off it draws back before it drops
        if (between) {
            const upFirst = 1 - (1 - ke) ** 1.8, thenIn = ke ** 1.25;   // forward as it rises: a wrist lifted at the hip first throws the elbow out behind
            spot.set(lerp(awayAt.x, keysAt.x, ke), lerp(awayAt.y, keysAt.y, upFirst) + .03 * Math.sin(Math.PI * ke), lerp(awayAt.z, keysAt.z, thenIn));
            handQ.copy(rig.wq[hand]); rig.reach(upper, lower, hand, spot); rig.reach(upper, lower, hand, spot); rig.setWorld(hand, handQ);
        }
        // fingers: curled for the keys, looser away from them; typing taps them in bursts
        const loose = wait || keyed.a;
        for (const i of fingers) { rig.lq[i].copy(loose.q[i]); if (ke > 0 && keyed) rig.lq[i].slerp(blendQ(tq, keyed, i), ke); }
        if (life > 0 && ke > .98 && keyed && input.taps !== false) tapKeys(rig, s, time, seed, life);
    }
    rig.fk();
    return { stance: standing ? 'stand' : 'sit', chair: { back: ROLL * roll + SCOOT * ss(.55, 1.1, tau) + NUDGE * ss(1.15, 2.05, tau), turn: 0 }, lean };
}

// ---- one person at the featured desk, over one or more of their models ---------------------------------------------
// members: [{ id, role: 'sit' | 'wheel' | 'stand', object (the skinned model, userData.personRig), behind (mm from
// the keys to where that model stands), scale (mm per model metre) }]. Seated and standing models of one character
// make one person who gets up and sits down; one stance alone keeps it and only takes the hands off the keys.
export class DeskActor {
    constructor(rig) { this.rig = rig; this.character = rig.character; this.seed = seedOf(rig.character); this.members = []; this.state = null; this.sim = null; this.life = hash(9, this.seed) * 60; this.out = null; this.shown = null; this.height = null; this.swapAt = SWAP; }
    configure(members) {
        const seat = members.find(m => m.role !== 'stand')?.role || null;
        // someone in a wheelchair stays in it: their standing model, if the cast has one, is another person
        this.members = members.filter(m => this.rig.has(m.id) && (m.role === 'stand' ? seat !== 'wheel' : m.role === seat));
        const anchor = (this.members.find(m => m.role !== 'stand') || this.members[0])?.behind ?? 0;
        const key = m => { m.dz = (anchor - m.behind) / m.scale; m.key = this.rig.key(m.id, m.dz); return m.key; }, byHeight = (a, b) => (a.deskHeight ?? 0) - (b.deskHeight ?? 0);
        const sit = this.members.filter(m => m.role !== 'stand').map(key).sort(byHeight), stand = this.members.filter(m => m.role === 'stand').map(key).sort(byHeight);
        const up = this.members.find(m => m.role === 'stand');
        this.keys = { sit, stand, wait: this.rig.key(`people-${this.character}-stand-wait`, up ? up.dz : 0) };
        this.desc = deskDescription(sit.map(k => k.deskHeight), stand.map(k => k.deskHeight), stand.some(k => k.pose === 'stand-type-low'));
        // the same models as before (a film re-placing someone else): the person carries on from where they are
        const sign = this.members.map(m => m.id + ':' + m.role).join();
        if (sign !== this.sign) { this.sign = sign; this.sim = null; this.state = null; this.height = null; }
        return this.members;
    }
    get mobile() { return this.keys.sit.length > 0 && this.keys.stand.length > 0; }
    // Still getting up, sitting down or moving the hands (the Studio keeps drawing until this is over).
    get moving() { const s = this.state; return !!s && this.members.length > 0 && ((s.tau > 1e-4 && s.tau < STAND_UP - 1e-4) || (s.k > 1e-4 && s.k < 1 - 1e-4)); }
    // Where the person is now. input: { height, target (inches the desk is travelling to, Studio), time (film seconds
    // or null), track: { seconds, heightAt(seconds), tiltAt(seconds) } (film), tilt (degrees now), dt (Studio, seconds
    // since the last call) }
    drive(input) {
        const { height } = input, tilt = input.tilt || 0; let state;
        if (Number.isFinite(input.time)) {
            // (a desk held somewhere the track does not have it, a pose being previewed in the Director, is taken as it stands)
            if (input.track && Math.abs(input.track.heightAt(input.time) - height) < .6) { if (!this.sim || this.sim.track !== input.track) { this.sim = simulateDesk(this.desc, input.track.heightAt, input.track.seconds, 60, input.track.tiltAt || null); this.sim.track = input.track; } state = this.sim.at(input.time); }
            else state = settleDesk(this.desc, height, tilt);    // a time without the desk's track: no history to stand up from
            this.state = state; this.clock = input.time;
        } else {
            const dt = Math.min(.1, Math.max(0, input.dt || 0));
            // a desk that jumps (a preset applied, another room) is simply found the way it now stands
            if (!this.state || this.height === null || Math.abs(height - this.height) > 3) this.state = settleDesk(this.desc, height, tilt);
            else stepDesk(this.desc, this.state, height, input.target, dt, tilt);
            this.life += dt; this.clock = this.life; state = this.state;
        }
        this.height = height;
        this.out = solveDesk(this.rig, this.keys, { tau: state.tau, k: state.k, height, time: input.life === false ? null : this.clock, seed: this.seed, taps: input.taps });
        // the model that is drawn: the one built for this stance, nearest this desk height
        const stance = !this.mobile ? this.out.stance : state.tau >= this.swapAt ? 'stand' : 'sit', of = this.members.filter(m => (m.role === 'stand') === (stance === 'stand'));
        this.shown = of.sort((a, b) => Math.abs((a.key.deskHeight ?? height) - height) - Math.abs((b.key.deskHeight ?? height) - height))[0] || null;
        return this.out;
    }
    // The solved pose on the drawn model's bones. A person's own fine tuning (`pose`, the Director's pose mode) turns
    // each bone from where the motion has it; `rest` is kept at the motion's pose so the editor measures from it.
    apply(member, pose = null, hold = false) { drawPose(this.rig, member.object.userData.personRig, member.dz, pose, hold); }
}
// A solved pose (rig.lq, rig.lp) on a drawn model's bones (drawn: { bones, rest }, room-people.mjs rig()); dz: metres
// the model's own frame is ahead of the solver's. `pose`: the person's own fine tuning, a turn per bone from where
// the motion has it. `hold`: leave the bones alone (someone is dragging one in the Director).
export function drawPose(rig, drawn, dz = 0, pose = null, hold = false) {
    if (!drawn) return;
    for (let i = 0; i < rig.n; i++) {
        const name = rig.names[i], bone = drawn.bones.get(name); if (!bone || name === 'still') continue;
        if (hold) continue;   // (the pose editor measures its turns from `rest`: it stays with the bones while one is dragged)
        const rest = drawn.rest.get(name); rest.copy(rig.lq[i]);
        bone.quaternion.copy(rest); const d = pose?.[name]; if (Array.isArray(d) && d.length === 4) bone.quaternion.multiply(tq.fromArray(d)).normalize();
        if (name === 'Root') { bone.position.copy(rig.lp[i]); bone.position.z -= dz; } else if (name === 'pelvis') bone.position.copy(rig.lp[i]);
    }
}

// ---- someone who stays where they are -----------------------------------------------------------------------------
// The posture as built with life in it: breathing, a head that drifts, a shift of weight for those on their feet
// (feet pinned), typing fingers, a page turned by a reader. Hands that rest on something (keys, a table, a bench, a
// stick) stay exactly where they are. key: rig.key(id). input: { time, seed, life: 0..1 }. Pure.
const RESTING = { 'sit-type': 'lr', 'stand-type': 'lr', 'stand-type-low': 'lr', 'wheel-type': 'lr', 'sit-laptop': 'lr', 'sit-write': 'lr', 'sit-listen': 'lr', 'sit-raise': 'l', 'stand-work': 'lr', 'cane-stand': 'r', 'wheel-roll': 'lr', 'wheel-watch': 'lr' };
const TYPES = new Set(['sit-type', 'stand-type', 'stand-type-low', 'wheel-type', 'sit-laptop']);
const ON_FEET = new Set(['stand-type', 'stand-type-low', 'stand-wait', 'stand-phone', 'stand-present', 'stand-work', 'stand-paint', 'cane-stand']);
const INTENT = new Set(['sit-read', 'sit-phone', 'stand-phone', 'sit-write', 'stand-work', 'stand-paint', 'sit-controller']);      // eyes on what the hands hold
export const livelyPose = pose => pose !== 'walk' && pose !== 'white-cane';
export function solveStill(rig, key, input) {
    const time = input.time ?? 0, seed = input.seed | 0, life = input.life ?? 1, b = rig.b, pose = key.pose;
    rig.load(key);
    if (!(life > 0)) { rig.fk(); return; }
    const standing = ON_FEET.has(pose), sway = standing ? noise(time * .11 + 7.3, seed) * .014 * life : 0;
    const breath = Math.sin(time * Math.PI * 2 / (3.7 + hash(1, seed) * 1.2) + hash(2, seed) * 6.28) * life;
    if (standing) { spot.copy(key.wp[b.pelvis]); spot.x += sway; spot.y -= (.005 + Math.abs(sway) * .2) * life; rig.placePelvis(spot); }
    rig.fk();
    if (standing) { rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Z, sway * 1.3)); rig.fk(); rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Z, -sway * 1.1)); rig.fk(); }
    rig.turnWorld(b.spine_02, turn.setFromAxisAngle(X, -.008 * breath)); rig.fk(); rig.turnWorld(b.spine_03, turn.setFromAxisAngle(X, -.011 * breath)); rig.fk();
    const fixed = INTENT.has(pose) ? .35 : 1, glance = INTENT.has(pose) ? 0 : ss(.62, .8, noise(time * .16 + 31, seed));
    const yaw = (noise(time * .19, seed + 5) * .07 + noise(time * .053 + 3, seed + 6) * .09) * life * fixed, nod = (noise(time * .23 + 11, seed + 7) * .03 * fixed + glance * .14) * life;
    rig.turnWorld(b.neck_01, turn.setFromAxisAngle(Y, yaw * .4).multiply(turn2.setFromAxisAngle(X, nod * .4 + .004 * breath))); rig.fk();
    rig.turnWorld(b.head, turn.setFromAxisAngle(Y, yaw * .6).multiply(turn2.setFromAxisAngle(X, nod * .6))); rig.fk();
    if (standing) for (const s of ['l', 'r']) { const [thigh, calf, foot] = rig.side[s].leg; rig.reach(thigh, calf, foot, key.wp[foot]); rig.reach(thigh, calf, foot, key.wp[foot]); rig.setWorld(foot, key.wq[foot]); }
    const resting = RESTING[pose] || '';
    for (const s of ['l', 'r']) {
        const [, upper, lower, hand] = rig.side[s].arm;
        if (resting.includes(s)) { rig.reach(upper, lower, hand, key.wp[hand]); rig.reach(upper, lower, hand, key.wp[hand]); rig.setWorld(hand, key.wq[hand]); }
        if (TYPES.has(pose) && input.taps !== false) tapKeys(rig, s, time, seed, life);
    }
    // a reader turns a page now and then: the right hand lets go, crosses the page and comes back
    if (pose === 'sit-read') {
        const period = 17 + hash(4, seed) * 12, n = Math.floor(time / period), at = (n + .15 + hash(n, seed + 60) * .6) * period, u = (time - at) / 2.3;
        if (u > 0 && u < 1) {
            const [, upper, lower, hand] = rig.side.r.arm, other = rig.wp[rig.side.l.arm[3]], over = Math.sin(Math.PI * u) ** 2 * life;
            rig.fk(); handQ.copy(rig.wq[hand]); spot.copy(rig.wp[hand]).lerp(other, .5 * over); spot.addScaledVector(Y, .025 * Math.sin(Math.PI * u) * life);
            rig.reach(upper, lower, hand, spot); rig.setWorld(hand, handQ);
        }
    }
    rig.fk();
}

// ---- someone who changes posture where they are ------------------------------------------------------------------------
// From one built posture of a character to another at the same spot (a film's two `when` windows back to back, a
// room's change of daypart): the bones turn from `from` to `to` as w goes 0..1. The hips lead, the spine and head
// follow, the arms come last; where the hips rise or sink (sitting down, getting up) the trunk leans in on the way;
// feet that end somewhere else step there one after the other, and feet that stay are pinned. Exactly `from` at 0
// and `to` at 1. Pure. Returns { model: 'from' | 'to' } (which of the two built models to draw: they bend alike).
export function solveChange(rig, from, to, w) {
    const b = rig.b, t = clamp01(w), hips = ss(0, .72, t), spine = ss(.08, .82, t), head = ss(.15, .92, t), arms = ss(.22, 1, t);
    if (t <= 0 || t >= 1) { rig.load(t <= 0 ? from : to); rig.fk(); return { model: t <= 0 ? 'from' : 'to' }; }
    const part = new Float32Array(rig.n).fill(hips);
    for (const i of [b.spine_01, b.spine_02, b.spine_03]) part[i] = spine;
    part[b.neck_01] = part[b.head] = head;
    for (const s of ['l', 'r']) { for (const i of rig.side[s].arm) part[i] = arms; for (const i of rig.side[s].fingers) part[i] = arms; }
    for (let i = 0; i < rig.n; i++) rig.lq[i].slerpQuaternions(from.q[i], to.q[i], part[i]);
    rig.lp[b.Root].lerpVectors(from.root, to.root, hips);
    const a = from.wp[b.pelvis], z = to.wp[b.pelvis], travel = z.y - a.y, rising = travel > 0;
    // getting up the hips go forward before they go up; sitting down they come down before they go back
    const along = rising ? ss(0, .8, hips) : ss(.2, 1, hips), high = rising ? ss(.15, 1, hips) : ss(0, .85, hips);
    spot.set(lerp(a.x, z.x, along), lerp(a.y, z.y, high), lerp(a.z, z.z, along)); rig.placePelvis(spot); rig.fk();
    const lean = THREE.MathUtils.degToRad(32) * clamp01(Math.abs(travel) / .3) * Math.sin(Math.PI * hips) ** 1.5;
    if (lean > 1e-4) for (const [bone, share] of [[b.pelvis, .52], [b.spine_01, .2], [b.spine_02, .16], [b.spine_03, .12], [b.neck_01, -.34], [b.head, -.5]]) { rig.turnWorld(bone, turn.setFromAxisAngle(X, lean * share)); rig.fk(); }
    for (const s of ['l', 'r']) {
        const [thigh, calf, foot] = rig.side[s].leg, far = from.wp[foot].distanceTo(to.wp[foot]);
        // the feet move while the weight is in the seat: before getting up, after sitting down
        const window = rising ? (s === 'l' ? [.02, .3] : [.2, .48]) : (s === 'l' ? [.52, .8] : [.7, .98]), step = far < .004 ? hips : ss(window[0], window[1], t);
        awayAt.lerpVectors(from.wp[foot], to.wp[foot], step); awayAt.y += Math.min(.035, far * .3) * Math.sin(Math.PI * step);
        footQ.slerpQuaternions(from.wq[foot], to.wq[foot], step);
        rig.reach(thigh, calf, foot, awayAt); rig.reach(thigh, calf, foot, awayAt); rig.setWorld(foot, footQ);
    }
    rig.fk();
    return { model: t < .5 ? 'from' : 'to' };
}

// ---- walking from one spot to another ------------------------------------------------------------------------------
// A walk is planned once (walkPlan) and then posed at any second (solveWalk): pure, so a film frame depends only on
// its time. Footprints are laid along the path first; a foot on the floor stays on its footprint (the hips travel,
// the legs follow by IK), so feet cannot slide. From standing (posture `from`) to standing (`to`; the same posture
// when not given), facing along the path at both ends.
//   path: [[x, z], ...] metres in the room's floor plane (two points or more; corners are walked as given)
//   options: { step: metres (default from the leg length), pace: steps a second (default 1.8) }
// Returns { length, seconds, prints, at(seconds) -> g } where g counts steps (the gait clock).
const hermite = (p0, p1, m0, m1, t) => { const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1; };
export function walkPlan(rig, from, to, path, options = {}) {
    to ||= from;
    const points = path.map(([x, z]) => new THREE.Vector2(x, z)), legs = [], L = rig.side.l, R = rig.side.r;
    let length = 0; for (let i = 1; i < points.length; i++) { const d = points[i].distanceTo(points[i - 1]); legs.push({ a: points[i - 1], b: points[i], s0: length, d }); length += d; }
    // where the path is and which way it heads at a distance along it (yaw about y: 0 faces +z)
    const along = s => { const leg = legs.find(l => s <= l.s0 + l.d) || legs[legs.length - 1], t = leg.d > 0 ? clamp01((s - leg.s0) / leg.d) : 0; return { x: lerp(leg.a.x, leg.b.x, t), z: lerp(leg.a.y, leg.b.y, t), yaw: Math.atan2(leg.b.x - leg.a.x, leg.b.y - leg.a.y) }; };
    // the heading turns over 0.35 m either side of a corner, not at once
    const heading = s => { const a = along(Math.max(0, s - .35)), b = along(Math.min(length, s + .35)); return Math.hypot(b.x - a.x, b.z - a.z) > 1e-6 ? Math.atan2(b.x - a.x, b.z - a.z) : a.yaw; };
    const leg = rig.offset[L.leg[1]].length() + rig.offset[L.leg[2]].length(), want = options.step || leg * .64, strides = Math.max(1, Math.round(length / want)), step = length / strides;
    // footprints: where each ankle is while that foot is on the floor. Both feet start in `from` and end in `to`.
    const place = (key, foot, s) => { const at = along(s), yaw = heading(s), p = key.wp[foot], c = Math.cos(yaw), sn = Math.sin(yaw); return { x: at.x + p.x * c + p.z * sn, z: at.z - p.x * sn + p.z * c, y: p.y, yaw, s }; };
    const side = (foot, s) => { const at = along(s), yaw = heading(s), w = (from.wp[foot].x + to.wp[foot].x) / 2 * .8, c = Math.cos(yaw), sn = Math.sin(yaw); return { x: at.x + w * c, z: at.z - w * sn, y: Math.min(from.wp[foot].y, to.wp[foot].y), yaw, s }; };
    const feet = [L.leg[2], R.leg[2]], prints = [[place(from, feet[0], 0)], [place(from, feet[1], 0)]], steps = [], knots = [[0, 0]];
    // step j (from 1) lands half a step, then whole steps further on; the last two bring both feet to the end
    for (let j = 1; j <= strides + 2; j++) {
        const which = (j + 1) % 2, list = prints[which], s = j <= strides ? (j - .5) * step : length;
        const print = j <= strides ? side(feet[which], s) : place(to, feet[which], length);
        // the hips: over (a little ahead of) the standing foot in the middle of each step
        const stance = prints[1 - which][prints[1 - which].length - 1]; knots.push([j - .5, Math.min(length, Math.max(0, stance.s + step * .12))]);
        steps.push({ which, from: list[list.length - 1], to: print, g0: j - 1 + .12, g1: j - .12 }); list.push(print);
    }
    knots.push([steps.length, length]);
    for (let i = 1; i < knots.length; i++) knots[i][1] = Math.max(knots[i][1], knots[i - 1][1]);
    const slope = i => i <= 0 || i >= knots.length - 1 ? 0 : (knots[i + 1][1] - knots[i - 1][1]) / (knots[i + 1][0] - knots[i - 1][0]);
    const travel = g => { g = Math.min(steps.length, Math.max(0, g)); let i = 1; while (i < knots.length - 1 && g > knots[i][0]) i++; const [g0, s0] = knots[i - 1], [g1, s1] = knots[i], h = g1 - g0; return Math.min(s1, Math.max(s0, hermite(s0, s1, slope(i - 1) * h, slope(i) * h, (g - g0) / h))); };
    const pace = options.pace || 1.8;
    return { length, step, steps, prints, along, heading, travel, from, to, pace, seconds: steps.length / pace, at: seconds => clamp01(seconds * pace / steps.length) * steps.length };
}
// The pose at gait clock g (plan.at(seconds)): rig.lq / rig.lp in the model's frame. Returns where the model stands:
// { x, z, yaw } (metres, radians; the room's frame).
const printAt = V(), pivot = V(), rootAt = { x: 0, z: 0, yaw: 0 };
export function solveWalk(rig, plan, g) {
    const { steps, from, to } = plan, b = rig.b, total = steps.length, s = plan.travel(g), at = plan.along(s), yaw = plan.heading(s), c = Math.cos(yaw), sn = Math.sin(yaw);
    const blend = ss(0, 1, g / total), walking = ss(0, .8, g) * (1 - ss(total - .9, total, g));      // how much of the walk's own carriage is in the pose
    for (let i = 0; i < rig.n; i++) rig.lq[i].slerpQuaternions(from.q[i], to.q[i], blend);
    rig.lp[b.Root].lerpVectors(from.root, to.root, blend);
    // which foot is in the air, and how far through its step
    let swing = null; for (const st of steps) if (g > st.g0 && g < st.g1) swing = st;
    const u = swing ? (g - swing.g0) / (swing.g1 - swing.g0) : 0, phase = g - Math.floor(g), odd = Math.floor(g) % 2 === 0 ? 1 : -1;      // odd: +1 while the left foot steps
    // hips: lowest with both feet down, highest over the standing leg; a little to the side of it; turned with the stride
    const bob = -.03 * walking - .014 * walking * Math.cos(phase * Math.PI * 2), lateral = -.018 * walking * odd * Math.sin(phase * Math.PI);
    spot.lerpVectors(from.wp[b.pelvis], to.wp[b.pelvis], blend); spot.x += lateral; spot.y += bob; spot.z += .01 * walking;
    rig.placePelvis(spot); rig.fk();
    const stride = Math.sin(phase * Math.PI) * odd * walking;      // + while the left leg swings forward
    rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Y, .07 * Math.cos(phase * Math.PI) * odd * walking).multiply(turn2.setFromAxisAngle(Z, -.035 * stride))); rig.fk();
    rig.turnWorld(b.spine_01, turn.setFromAxisAngle(X, .035 * walking)); rig.fk();
    rig.turnWorld(b.spine_03, turn.setFromAxisAngle(Y, -.11 * Math.cos(phase * Math.PI) * odd * walking).multiply(turn2.setFromAxisAngle(Z, .03 * stride))); rig.fk();
    rig.turnWorld(b.head, turn.setFromAxisAngle(Y, .04 * Math.cos(phase * Math.PI) * odd * walking)); rig.fk();
    // legs: a foot on the floor stays on its footprint; the other goes heel-off, through, heel-first to the next
    for (const [which, s2] of [[0, 'l'], [1, 'r']]) {
        const [thigh, calf, foot, ball] = rig.side[s2].leg, list = plan.prints[which];
        let print = list[0], next = null, air = 0; for (const st of steps) { if (st.which !== which) continue; if (g >= st.g1) print = st.to; else if (g > st.g0) { print = st.from; next = st.to; air = (g - st.g0) / (st.g1 - st.g0); } }
        // heel-off before the foot leaves: the ankle rises over the ball of the foot while the hips go on ahead
        const coming = steps.find(st => st.which === which && st.g0 >= g), lift = coming && coming.from === print ? ss(coming.g0 - .5, coming.g0, g) * walking : 0;
        let x = print.x, z = print.z, y = print.y, face = print.yaw, pitch = lift * .62;
        if (next) {
            const e = air * air * (3 - 2 * air), far = Math.hypot(next.x - print.x, next.z - print.z);
            x = lerp(print.x, next.x, e); z = lerp(print.z, next.z, e); y = lerp(print.y, next.y, e) + Math.min(.04, .015 + far * .05) * Math.sin(Math.PI * Math.min(1, air * 1.15)) ** 1.3;
            face = print.yaw + (THREE.MathUtils.euclideanModulo(next.yaw - print.yaw + Math.PI, Math.PI * 2) - Math.PI) * e;
            pitch = lerp(.62 * walking, -.2 * walking * clamp01(far / .3), ss(.1, .8, air));
        } else { const landed = steps.filter(st => st.which === which && st.to === print).pop(); if (landed) pitch += -.2 * walking * (1 - ss(landed.g1, landed.g1 + .16, g)) * clamp01(Math.hypot(landed.to.x - landed.from.x, landed.to.z - landed.from.z) / .3); }
        // pitched about the ball (heel up) or the heel (toes up): the ankle moves with it, the ball or the heel stays
        if (Math.abs(pitch) > 1e-5) {
            if (pitch > 0) pivot.copy(from.wp[foot]).sub(from.wp[ball]); else pivot.set(0, from.wp[foot].y, .05);
            v1.copy(pivot).applyQuaternion(turn.setFromAxisAngle(X, pitch)).sub(pivot).applyQuaternion(turn2.setFromAxisAngle(Y, face));
            x += v1.x; y += v1.y; z += v1.z;
        }
        // into the model's frame (it stands at the hips' place on the path, facing along it)
        const dx = x - at.x, dz = z - at.z; printAt.set(dx * c - dz * sn, y, dx * sn + dz * c);
        rig.reach(thigh, calf, foot, printAt); rig.reach(thigh, calf, foot, printAt);
        footQ.slerpQuaternions(from.wq[foot], to.wq[foot], blend); rig.setWorld(foot, turn.setFromAxisAngle(Y, face - yaw).multiply(turn2.setFromAxisAngle(X, pitch)).multiply(footQ));
    }
    rig.fk();
    // arms swing against the legs from the shoulder, the elbow giving a little on the way forward
    for (const s2 of ['l', 'r']) {
        const [, upper, lower] = rig.side[s2].arm, forward = (s2 === 'l' ? 1 : -1) * Math.cos(phase * Math.PI) * odd * walking;
        rig.turnWorld(upper, turn.setFromAxisAngle(X, -.26 * forward)); rig.fk();
        rig.turnWorld(lower, turn.setFromAxisAngle(X, -(.1 + .14 * Math.max(0, forward)) * walking)); rig.fk();
    }
    rig.fk();
    rootAt.x = at.x; rootAt.z = at.z; rootAt.yaw = yaw; return rootAt;
}
