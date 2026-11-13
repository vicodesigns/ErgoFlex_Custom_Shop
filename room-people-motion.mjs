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
const DRAW_TILT = 12;                  // … and beyond which a child drawing on the top takes their hands off it
const LEAD = 3.2;                      // sitting down starts when a lowering desk is this far above sitting height
const NEAR = 1.3;                      // the hands go back to the keys when the desk is this close to where it stops
const ROLL = .265;                     // metres the chair rolls back before its user stands (their feet end under them)
const SWAP = 1.45;                     // seconds into standing up at which the standing model takes over from the seated one
const SCOOT = .09;                     // they slide to the front of the seat as they lean in (the chair's base clears their heels)
const NUDGE = .15;                     // and how much further the calves push it as the knees straighten
const SIT_UPRIGHT = 7;                 // degrees the back comes up from the built seated postures while they sit at the keys (life on)

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


// ---- where someone looks ------------------------------------------------------------------------------------------
// The face's own forward, as a direction in the head bone's frame: in the character's standing-by posture the eyes are
// on the desktop, FACE_DOWN degrees below the model's forward (+z; pose_lib stand_wait: spine 1+2+2, neck 7, head 8).
// (Asked before a pose is solved: reading a posture loads it into the rig.)
const FACE_DOWN = 20;
const faceQ = Q(), gazeV = V(), lookV = V(), lookAxis = V(), lookTurn = Q();
function faceOf(rig) {
    if (rig.face) return rig.face;
    const ids = Object.keys(rig.postures), id = ids.find(i => /stand-wait$/.test(i)) || ids.find(i => /stand/.test(i)) || ids[0], key = rig.key(id);
    const down = THREE.MathUtils.degToRad(FACE_DOWN);
    return rig.face = new THREE.Vector3(0, -Math.sin(down), Math.cos(down)).applyQuaternion(faceQ.copy(key.wq[rig.b.head]).invert()).normalize();
}
export const LOOK_YAW = .7, LOOK_PITCH = .42;      // radians the neck and head together turn toward a target, at most (40 and 24 degrees)
// Turns the neck (.4) and the head (.6) so that the face points `amount` of the way to `target` (a point in the
// model's frame), within LOOK_YAW / LOOK_PITCH of where the posture has it looking: small turns, never a broken neck.
// fk() must be current; it is current afterwards.
export function lookToward(rig, target, amount) {
    if (!target || !(amount > 0)) return;
    const b = rig.b, face = faceOf(rig), from = v7.copy(rig.wp[b.head]); from.y += .07;      // (the eyes: a little above the head bone)
    gazeV.copy(face).applyQuaternion(rig.wq[b.head]); lookV.copy(target).sub(from); if (lookV.lengthSq() < 1e-6) return; lookV.normalize();
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = THREE.MathUtils.clamp;
    const yaw = clamp(wrap(Math.atan2(lookV.x, lookV.z) - Math.atan2(gazeV.x, gazeV.z)), -LOOK_YAW, LOOK_YAW) * amount;
    const pitch = clamp(Math.asin(clamp(lookV.y, -1, 1)) - Math.asin(clamp(gazeV.y, -1, 1)), -LOOK_PITCH, LOOK_PITCH) * amount;
    for (const [bone, share] of [[b.neck_01, .4], [b.head, .6]]) {
        rig.turnWorld(bone, lookTurn.setFromAxisAngle(Y, yaw * share)); rig.fk();
        gazeV.copy(face).applyQuaternion(rig.wq[b.head]); lookAxis.crossVectors(gazeV, Y);
        if (lookAxis.lengthSq() > 1e-8) { rig.turnWorld(bone, lookTurn.setFromAxisAngle(lookAxis.normalize(), pitch * share)); rig.fk(); }
    }
}
// Where a typist looks: the screen above and beyond the hands on the keys (a laptop's, just beyond them).
function screenFrom(rig, l, r, lift, laptop, out) {
    out.copy(l).add(r).multiplyScalar(.5); out.y += lift + (laptop ? .1 : .36); out.z += laptop ? .14 : .3; return out;
}
const screenAt = V();

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
    const b = rig.b, standing = tau >= STAND_UP / 2; if (life > 0) faceOf(rig);
    // how far along each part of standing up is
    const roll = ss(.05, .85, tau), rise = clamp01((tau - .95) / 1.4), core = sit ? ss(1.05, 2.4, tau) : 1, legs = sit ? ss(.95, 2.3, tau) : 1;
    // (the lean comes late enough that someone who has just sat down is upright again soon, not hunched at the keys)
    const lean = THREE.MathUtils.degToRad(36) * ss(.7, 1.25, tau) * (1 - ss(1.32, 2.25, tau));
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
    // (up off the seat first, then forward over the feet: the hips leave the seat upward, never forward past its edge
    // while still low; sitting down it is the other way round, back over the seat first and then down onto it)
    if (seat && feet) pelvis.set(lerp(seat.x, feet.x, ss(0, 1, rise)), lerp(seat.y, feet.y, ss(0, .8, rise)), lerp(seat.z - ROLL * roll, feet.z, ss(.12, .9, rise)));
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
        // seated, the built typing postures sit 8 to 11 degrees forward of upright (a hunch at the keys): the back comes up
        // over the hips while they sit (not while they lean in to stand), the head keeps most of its line to the screen and
        // the hands stay on the keys (the arms reach for them below); the pelvis stays on the seat
        const seated = sit ? 1 - ss(.35, .75, tau) : 0;      // (whole whenever there is life: the posture, not the breathing)
        if (seated > 0) {
            const back = -THREE.MathUtils.degToRad(SIT_UPRIGHT) * seated;
            for (const [bone, share] of [[b.spine_01, .35], [b.spine_02, .35], [b.spine_03, .3], [b.neck_01, -.3], [b.head, -.4]]) { rig.turnWorld(bone, turn.setFromAxisAngle(X, back * share)); rig.fk(); }
        }
        if (upright > 0) { rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Z, sway * 1.3)); rig.fk(); rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Z, -sway * 1.1)); rig.fk(); }
        // eyes on the screen: on the keys, standing by while the desk moves (the screen goes up and down with it), less
        // while they lean in to get up; the drift and the glances down below come on top of it
        const screenPair = standing ? type : sit;
        if (screenPair) {
            const L = rig.side.l.arm[3], R = rig.side.r.arm[3];
            screenFrom(rig, blendV(v5, screenPair, L), blendV(v6, screenPair, R), screenPair.lift, false, screenAt);
            lookToward(rig, screenAt, .85 * (1 - lean / THREE.MathUtils.degToRad(36)));
        }
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
    const lift = (standing ? type : sit)?.lift ?? 0, keyed = standing ? type : sit, armsDown = !sit ? 1 : !wait ? 0 : ss(1.7, 2.5, tau);   // (the hands push on the thighs until the legs have taken the weight)
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
    return { stance: standing ? 'stand' : 'sit', chair: { back: ROLL * roll + SCOOT * ss(.55, 1.1, tau) + NUDGE * ss(1.4, 2.3, tau), turn: 0 }, lean };
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
        this.keys = { sit, stand, wait: this.rig.key(`people-${this.character}-stand-wait`, up ? up.dz : 0) || this.rig.key(`people-${this.character}-kid-stand-wait`, up ? up.dz : 0) };   // (children have their own standing-by posture)
        this.desc = deskDescription(sit.map(k => k.deskHeight), stand.map(k => k.deskHeight), stand.some(k => k.pose === 'stand-type-low'));
        // the same models as before (a film re-placing someone else): the person carries on from where they are
        this.draws = this.members.length > 0 && this.members.every(m => /-kid-(stand|sit)-desk/.test(m.id));
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
        // a child drawing at the desk works on the tilted top (up to DRAW_TILT): the hands stay on it
        const { height } = input, tilt = this.draws && Math.abs(input.tilt || 0) <= DRAW_TILT ? 0 : input.tilt || 0; let state;
        if (Number.isFinite(input.time)) {
            // (a desk held somewhere the track does not have it, a pose being previewed in the Director, is taken as it stands)
            if (input.track && Math.abs(input.track.heightAt(input.time) - height) < .6) { if (!this.sim || this.sim.track !== input.track) { this.sim = simulateDesk(this.desc, input.track.heightAt, input.track.seconds, 60, this.draws && input.track.tiltAt ? t => { const a = input.track.tiltAt(t); return Math.abs(a || 0) <= DRAW_TILT ? 0 : a; } : input.track.tiltAt || null); this.sim.track = input.track; } state = this.sim.at(input.time); }
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
const RESTING = { 'sit-type': 'lr', 'stand-type': 'lr', 'stand-mid': 'lr', 'stand-type-low': 'lr', 'stand-counter': 'lr', 'sit-microscope': 'lr', 'lie-bed': 'lr', 'wheel-type': 'lr', 'sit-laptop': 'lr', 'sit-write': 'lr', 'sit-listen': 'lr', 'sit-raise': 'l', 'stand-work': 'lr', 'cane-stand': 'r', 'wheel-roll': 'lr', 'wheel-watch': 'lr',
    'kid-stand-desk': 'lr', 'kid-sit-desk': 'lr', 'kid-sit-k': 'lr', 'kid-sit-e': 'lr', 'kid-kneel-craft': 'lr', 'kid-play-floor': 'lr' };
const TYPES = new Set(['sit-type', 'stand-type', 'stand-mid', 'stand-type-low', 'wheel-type', 'sit-laptop']);
const ON_FEET = new Set(['stand-type', 'stand-mid', 'stand-type-low', 'stand-brief', 'stand-radio', 'stand-chart', 'stand-counter', 'stand-wait', 'stand-phone', 'stand-present', 'stand-work', 'stand-paint', 'cane-stand', 'kid-stand', 'kid-stand-wait', 'kid-stand-desk']);
const INTENT = new Set(['stand-chart', 'sit-microscope', 'stand-radio', 'sit-read', 'sit-phone', 'stand-phone', 'sit-write', 'stand-work', 'stand-paint', 'sit-controller', 'kid-read-floor', 'kid-sit-desk', 'kid-stand-desk', 'kid-sit-k', 'kid-sit-e', 'kid-kneel-craft', 'kid-play-floor']);      // eyes on what the hands hold
export const livelyPose = pose => pose !== 'walk' && pose !== 'white-cane' && pose !== 'push-cart';
export const WORKOUTS = new Set(['gym-cycle', 'gym-pullup', 'gym-press', 'gym-curl', 'gym-box', 'sit-pottery']);      // postures that work a machine: solveWorkout
export function solveStill(rig, key, input) {
    const time = input.time ?? 0, seed = input.seed | 0, life = input.life ?? 1, b = rig.b, pose = key.pose;
    if (WORKOUTS.has(pose)) return solveWorkout(rig, key, input);
    if (life > 0) faceOf(rig);
    rig.load(key);
    if (!(life > 0)) { rig.fk(); return; }
    const standing = ON_FEET.has(pose), sway = standing ? noise(time * .11 + 7.3, seed) * .014 * life : 0;
    const breath = Math.sin(time * Math.PI * 2 / (3.7 + hash(1, seed) * 1.2) + hash(2, seed) * 6.28) * life;
    if (standing) { spot.copy(key.wp[b.pelvis]); spot.x += sway; spot.y -= (.005 + Math.abs(sway) * .2) * life; rig.placePelvis(spot); }
    rig.fk();
    if (standing) { rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Z, sway * 1.3)); rig.fk(); rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Z, -sway * 1.1)); rig.fk(); }
    rig.turnWorld(b.spine_02, turn.setFromAxisAngle(X, -.008 * breath)); rig.fk(); rig.turnWorld(b.spine_03, turn.setFromAxisAngle(X, -.011 * breath)); rig.fk();
    // where they look: a typist at the screen (or the laptop), anyone else where the room asks (input.look: someone they
    // talk to, the desk that moves; a point in the model's frame, input.lookAmount of the way); someone with nothing
    // to look at lets the eyes wander further than someone at work
    let target = input.look || null, amount = input.lookAmount ?? .75;
    if (!target && TYPES.has(pose)) { target = screenFrom(rig, key.wp[rig.side.l.arm[3]], key.wp[rig.side.r.arm[3]], 0, pose === 'sit-laptop', screenAt); amount = .8; }
    if (target) lookToward(rig, target, amount * life);
    const idle = !target && !INTENT.has(pose) ? 2.2 : 1;
    const fixed = INTENT.has(pose) ? .35 : target ? .6 : 1, glance = INTENT.has(pose) ? 0 : ss(.62, .8, noise(time * .16 + 31, seed));
    const yaw = (noise(time * .19, seed + 5) * .07 + noise(time * .053 + 3, seed + 6) * .09) * life * fixed * idle, nod = (noise(time * .23 + 11, seed + 7) * .03 * fixed + glance * .14) * life;
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
    if (ACTS[pose]) { ACTS[pose](rig, key, time, seed, life); rig.fk(); }
}

// ---- what people do where they are --------------------------------------------------------------------------------
// On top of the life above, a posture that is an activity shows it: the pen writes, the brush paints, a drink is
// sipped, a hand that is up stretches and waves, a talker's hand talks. Each is worked out from the posture as built
// (the hand's own place and turn), small enough that hands stay on the table, the canvas or the controller, and
// seeded per person so a class does not move as one. Pure. (rig.fk() is current on entry and brought up to date on return.)
const armTo = (rig, s, at, q = null) => { const [, upper, lower, hand] = rig.side[s].arm; rig.reach(upper, lower, hand, at); rig.reach(upper, lower, hand, at); if (q) rig.setWorld(hand, q); rig.fk(); };
// 0 except for `length` seconds once every `period` (the moment is the person's own): rises, holds, falls
const moment = (time, seed, n, period, length, edge = .28) => { const p = period * (1 + .5 * hash(n, seed)), u = (time + hash(n + 1, seed) * p) % p; return u < length ? ss(0, edge, u / length) * (1 - ss(1 - edge, 1, u / length)) : 0; };
function write(rig, key, time, seed, life, size = 1) {
    // a line of writing: the pen goes along the line (the writer's left to right), trembling with the letters, comes back, and rests now and then
    const hand = rig.side.r.arm[3], pause = moment(time, seed, 71, 13, 3), line = ((time * (.13 + hash(72, seed) * .05) + hash(73, seed)) % 1), go = (1 - pause) * life;
    const along = line < .86 ? line / .86 : 1 - ss(.86, 1, line);
    handAt.copy(key.wp[hand]); handAt.x += (.032 - .064 * along) * size * go;
    handAt.x += Math.sin(time * 11.3 + seed) * .0035 * size * go; handAt.z += Math.sin(time * 8.1 + seed * 1.7) * .005 * size * go;
    armTo(rig, 'r', handAt, key.wq[hand]);
    if (pause > 0) { rig.turnWorld(rig.b.head, turn.setFromAxisAngle(X, -.16 * pause * life)); rig.fk(); }      // looks up to think
}
function sip(rig, key, time, seed, life) {
    // the cup comes up to the mouth, tips, and goes back to where it is held
    const hand = rig.side.r.arm[3], w = moment(time, seed, 81, 17, 2.9, .34) * life; if (!(w > 0)) return;
    handAt.copy(rig.wp[rig.b.head]); handAt.x -= .055; handAt.y -= .075; handAt.z += .15; handAt.lerpVectors(key.wp[hand], handAt, w);
    handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(X, -.3 * ss(.6, 1, w)));
    armTo(rig, 'r', handAt, handQ);
    rig.turnWorld(rig.b.head, turn.setFromAxisAngle(X, -.07 * ss(.6, 1, w))); rig.fk();
}
const bend = (rig, axis, angle) => { for (const [bone, share] of [[rig.b.spine_01, .3], [rig.b.spine_02, .4], [rig.b.spine_03, .3]]) { rig.turnWorld(bone, turn.setFromAxisAngle(axis, angle * share)); rig.fk(); } };
const feetStay = (rig, key) => { for (const s of ['l', 'r']) { const [thigh, calf, foot] = rig.side[s].leg; rig.reach(thigh, calf, foot, key.wp[foot]); rig.reach(thigh, calf, foot, key.wp[foot]); rig.setWorld(foot, key.wq[foot]); } rig.fk(); };
const ACTS = {
    'sit-write': write, 'kid-sit-k': (rig, key, time, seed, life) => write(rig, key, time, seed, life, 1.5), 'kid-sit-e': (rig, key, time, seed, life) => write(rig, key, time, seed, life, 1.5), 'kid-kneel-craft': (rig, key, time, seed, life) => write(rig, key, time, seed, life, 1.6),
    'stand-mug': sip, 'stand-drink': sip, 'sit-mug': sip, 'sit-chat': sip,
    // a hand up in class: it stretches higher, sinks a little when the arm tires, and waves for attention
    'sit-raise'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], tired = (.5 + .5 * noise(time * .09 + 3, seed + 90)) * life, wave = moment(time, seed, 91, 9, 1.6) * life;
        handAt.copy(key.wp[hand]); handAt.y += .025 - .13 * tired; handAt.z += .05 * tired; handAt.x += Math.sin(time * 9.5) * .035 * wave;
        armTo(rig, 'r', handAt, key.wq[hand]);
    },
    // at the easel: strokes on the canvas, a dab now and then, the brush back to the palette to load
    'stand-paint'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], other = rig.wp[rig.side.l.arm[3]], load = moment(time, seed, 101, 11, 2.4, .36) * life;
        handAt.copy(key.wp[hand]); handAt.x += noise(time * .55, seed + 102) * .07 * life; handAt.y += (noise(time * .41 + 5, seed + 103) * .09 + Math.sin(time * 5.2) * .012) * life;
        if (load > 0) { spot.copy(other); spot.y += .06; spot.z += .03; spot.x -= .05; handAt.lerp(spot, load); }
        armTo(rig, 'r', handAt, key.wq[hand]);
    },
    // presenting: the arm toward the board moves over what is shown, the head goes between the board and the room
    'stand-present'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3];
        handAt.copy(key.wp[hand]); handAt.x += noise(time * .37, seed + 111) * .05 * life; handAt.y += noise(time * .31 + 2, seed + 112) * .07 * life;
        armTo(rig, 'r', handAt, key.wq[hand]);
        rig.turnWorld(rig.b.head, turn.setFromAxisAngle(Y, noise(time * .13 + 9, seed + 113) * .32 * life)); rig.fk();
    },
    // explaining: the open hand moves with the words, the head nods along
    'stand-talk'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], said = (.35 + .65 * ss(-.2, .3, noise(time * .21, seed + 120))) * life;
        handAt.copy(key.wp[hand]); handAt.x += noise(time * .9, seed + 121) * .045 * said; handAt.y += (noise(time * 1.1 + 3, seed + 122) * .05 + .02) * said; handAt.z += noise(time * .7 + 7, seed + 123) * .035 * said;
        armTo(rig, 'r', handAt, key.wq[hand]);
        rig.turnWorld(rig.b.head, turn.setFromAxisAngle(X, Math.max(0, Math.sin(time * 2.1 + seed)) * .035 * said)); rig.fk();
    },
    // on the sofa with a controller: the body leans with the game, both hands (and the pad in them) with it
    'sit-controller'(rig, key, time, seed, life) {
        const lean = noise(time * .45, seed + 130) * .07 * life, jolt = moment(time, seed, 131, 6, .7) * life;
        bend(rig, Z, lean); bend(rig, X, .05 * jolt);
        for (const s of ['l', 'r']) {
            const hand = rig.side[s].arm[3];
            handAt.copy(key.wp[hand]); handAt.x += -lean * .35 + noise(time * 1.9, seed + 132) * .008 * life; handAt.y += (noise(time * 2.3 + 4, seed + 133) * .008 + .025 * jolt) * life; handAt.z += .03 * jolt;
            armTo(rig, s, handAt, handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(Z, lean * .8)));
        }
    },
    // at a bench: the tool hand works to and fro in bursts, the other steadies the piece
    'stand-work'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], busy = (1 - moment(time, seed, 141, 8, 2.2)) * life;
        handAt.copy(key.wp[hand]); handAt.x += Math.sin(time * 7.4 + seed) * .036 * busy; handAt.z += Math.sin(time * 3.7 + seed) * .008 * busy;
        armTo(rig, 'r', handAt, key.wq[hand]);
    },
    // a standing stretch: a slow bend from side to side, arms overhead
    'stretch'(rig, key, time, seed, life) { bend(rig, Z, Math.sin(time * Math.PI * 2 / (7.5 + hash(151, seed) * 2) + hash(152, seed) * 6.28) * .2 * life); feetStay(rig, key); },
    // hands behind the head: the chest opens, the trunk turns slowly one way and the other
    'stretch-open'(rig, key, time, seed, life) { const u = time * Math.PI * 2 / (6.5 + hash(161, seed) * 2) + hash(162, seed) * 6.28; bend(rig, Y, Math.sin(u) * .3 * life); bend(rig, X, -.04 * (1 + Math.sin(u * 2)) * life); feetStay(rig, key); },
    // on the mat: reaching forward and easing off, slowly
    'floor-stretch'(rig, key, time, seed, life) { bend(rig, X, (.5 + .5 * Math.sin(time * Math.PI * 2 / (6 + hash(171, seed) * 2) + hash(172, seed) * 6.28)) * .1 * life); },
    // a child building on the floor: one hand sets a piece down, lifts, sets down
    'kid-play-floor'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], u = time * (.5 + hash(181, seed) * .2) + hash(182, seed), n = Math.floor(u), x = u - n;
        handAt.copy(key.wp[hand]); handAt.y += Math.sin(Math.PI * x) * .07 * life; handAt.x += (hash(n, seed + 183) - .5) * .12 * ss(0, .5, x) * life + (hash(n - 1, seed + 183) - .5) * .12 * (1 - ss(0, .5, x)) * life;
        armTo(rig, 'r', handAt, key.wq[hand]);
    }
};

// ---- someone training on the gym's equipment ------------------------------------------------------------------------
// The posture as built (tools/people/cast.py gym_*) is one moment of the exercise; the rest of it is worked out from
// that moment, so hands and feet stay on the machine they were built on. Pure: the same second is always the same
// pose. Returns what the machine has to show: { crank: radians } for the bike (its pedals turn with the feet).
//   gym-cycle   the ankles go round the crank (they were built on its pedals, one down, one up), hands on the bar
//   gym-pullup  the body rises and sinks under the bar, hands where they are
//   gym-press   the dumbbells come down beside the chest and go up again
//   gym-curl    one forearm comes up as the other goes down
//   gym-box     two jabs and a breath: the left glove goes out to the bag (as built) and comes back to the guard
//   sit-pottery the hands ride up and down the clay on a turning wheel: { wheel: radians }
const centre = V(), handAt = V(), elbowAxis = V();
export function solveWorkout(rig, key, input) {
    const time = input.time ?? 0, seed = input.seed | 0, life = input.life ?? 1, b = rig.b, pose = key.pose, out = {};
    rig.load(key); rig.fk();
    if (!(life > 0)) return out;
    const L = rig.side.l, R = rig.side.r, begin = hash(3, seed);
    const pin = s => { const [, upper, lower, hand] = rig.side[s].arm; rig.reach(upper, lower, hand, key.wp[hand]); rig.reach(upper, lower, hand, key.wp[hand]); rig.setWorld(hand, key.wq[hand]); };
    const look = amount => {      // a head that is not quite still
        const yaw = noise(time * .17, seed + 5) * .05 * amount, nod = noise(time * .21 + 11, seed + 7) * .03 * amount;
        rig.turnWorld(b.neck_01, turn.setFromAxisAngle(Y, yaw * .4).multiply(turn2.setFromAxisAngle(X, nod * .4))); rig.fk();
        rig.turnWorld(b.head, turn.setFromAxisAngle(Y, yaw * .6).multiply(turn2.setFromAxisAngle(X, nod * .6))); rig.fk();
    };
    if (pose === 'gym-cycle') {
        // a little over one turn of the crank a second; the hips rock toward the leg that pushes down
        const a = time * Math.PI * 2 * (1.05 + hash(1, seed) * .2), fl = L.leg[2], fr = R.leg[2];
        centre.addVectors(key.wp[fl], key.wp[fr]).multiplyScalar(.5); const r = Math.hypot(key.wp[fl].y - key.wp[fr].y, key.wp[fl].z - key.wp[fr].z) / 2;
        spot.copy(key.wp[b.pelvis]); spot.x += .006 * Math.cos(a); rig.placePelvis(spot); rig.fk();
        rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Z, .02 * Math.cos(a))); rig.fk(); rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Z, -.02 * Math.cos(a))); rig.fk();
        look(1);
        for (const [s, at0] of [['l', -Math.PI / 2], ['r', Math.PI / 2]]) {      // (built: the left pedal down, the right one up; the top goes forward)
            const [thigh, calf, foot] = rig.side[s].leg, at = at0 - a;
            spot.set(key.wp[foot].x, centre.y + r * Math.sin(at), centre.z + r * Math.cos(at));
            rig.reach(thigh, calf, foot, spot); rig.reach(thigh, calf, foot, spot);
            // the heel drops a little as the foot pushes over the top and lifts as it comes round behind
            rig.setWorld(foot, turn.setFromAxisAngle(X, .12 * Math.cos(at + .6)).multiply(footQ.copy(key.wq[foot])));
        }
        rig.fk(); pin('l'); pin('r'); rig.fk(); out.crank = a;
        return out;
    }
    if (pose === 'gym-pullup') {
        // up in a second, a moment at the top, down slower, a breath hanging: w is 0 at the bottom, 1 at the top
        const period = 3.6 + hash(1, seed) * .8, u = (time / period + begin) % 1, w = u < .3 ? ss(0, .3, u) : u < .4 ? 1 : u < .8 ? 1 - ss(.4, .8, u) : 0;
        const [, upper, lower, hand] = L.arm, arm = rig.offset[lower].length() + rig.offset[hand].length(), sh = key.wp[upper], h = key.wp[hand];
        const flat = Math.hypot(h.x - sh.x, h.z - sh.z), over = h.y - sh.y, low = Math.sqrt(Math.max(0, (arm * .985) ** 2 - flat * flat)) - over, high = Math.max(0, Math.min(over - .1, h.y - key.wp[b.head].y));      // (down to nearly straight arms, up until the chin is at the bar)
        spot.copy(key.wp[b.pelvis]); spot.y += lerp(-Math.max(0, low), high, w); spot.z += .025 * (1 - w); rig.placePelvis(spot); rig.fk();
        rig.turnWorld(b.pelvis, turn.setFromAxisAngle(X, .07 * (1 - w) - .03)); rig.fk();      // the legs hang back a little at the bottom
        rig.turnWorld(b.head, turn.setFromAxisAngle(X, -.12 * w)); rig.fk();                    // the chin goes over the bar
        pin('l'); pin('r'); rig.fk();
        return out;
    }
    if (pose === 'gym-press') {
        const period = 3.1 + hash(1, seed) * .7, u = (time / period + begin) % 1, w = u < .45 ? ss(0, .45, u) : u < .5 ? 1 : u < .9 ? 1 - ss(.5, .9, u) : 0;      // 1: the weights are down
        look(.5);
        for (const s of ['l', 'r']) {
            const [, upper, lower, hand] = rig.side[s].arm, reach = rig.offset[lower].length() + rig.offset[hand].length();
            handAt.copy(key.wp[hand]); handAt.y -= reach * .52 * w; handAt.x += (s === 'l' ? 1 : -1) * .07 * w;
            rig.reach(upper, lower, hand, handAt); rig.reach(upper, lower, hand, handAt); rig.setWorld(hand, key.wq[hand]);
        }
        rig.fk();
        return out;
    }
    if (pose === 'gym-curl') {
        // built with the left weight up and the right one down; each forearm turns at the elbow, one after the other
        const period = 3.4 + hash(1, seed) * .8, w = .5 + .5 * Math.cos((time / period + begin) * Math.PI * 2), sway = noise(time * .11 + 7.3, seed) * .01;      // w: how far up the left one is
        spot.copy(key.wp[b.pelvis]); spot.x += sway; rig.placePelvis(spot); rig.fk(); look(.6);
        for (const s of ['l', 'r']) { const [thigh, calf, foot] = rig.side[s].leg; rig.reach(thigh, calf, foot, key.wp[foot]); rig.reach(thigh, calf, foot, key.wp[foot]); rig.setWorld(foot, key.wq[foot]); }
        rig.fk();
        const fold = 1.95;      // radians between the hanging forearm and the one at the shoulder
        for (const [s, down] of [['l', 1 - w], ['r', -w]]) {
            const [, upper, lower] = rig.side[s].arm; if (Math.abs(down) < 1e-4) continue;
            rig.turnWorld(lower, turn.setFromAxisAngle(X, fold * down)); rig.fk();
            rig.turnWorld(upper, turn.setFromAxisAngle(X, -.1 * down)); rig.fk();      // the elbow gives a little
        }
        return out;
    }
    if (pose === 'sit-pottery') {
        // throwing a pot: the wheel turns, the hands ride up the clay and come down again, the body leans in with them
        const u = time / (5.5 + hash(1, seed) * 2) + begin, w = .5 - .5 * Math.cos(u * Math.PI * 2), squeeze = .5 + .5 * Math.sin(u * Math.PI * 4);
        for (const [bone, share] of [[b.spine_01, .4], [b.spine_02, .6]]) { rig.turnWorld(bone, turn.setFromAxisAngle(X, .035 * w * share)); rig.fk(); }
        look(.35);
        for (const s of ['l', 'r']) {
            const [, upper, lower, hand] = rig.side[s].arm, out2 = s === 'l' ? 1 : -1;
            handAt.copy(key.wp[hand]); handAt.y += -.035 + .075 * w; handAt.x += out2 * (.012 - .02 * squeeze * w);
            rig.reach(upper, lower, hand, handAt); rig.reach(upper, lower, hand, handAt); rig.setWorld(hand, key.wq[hand]);
        }
        rig.fk(); out.wheel = time * Math.PI * 2 * 1.6;
        return out;
    }
    // gym-box
    const period = 2.9 + hash(1, seed) * .6, u = ((time / period + begin) % 1) * period, jab = t0 => { const x = (u - t0) / .5; return x > 0 && x < 1 ? Math.sin(Math.PI * x) ** 1.5 : 0; };
    const w = Math.max(jab(.1), jab(.75)), bounce = Math.abs(Math.sin(time * Math.PI * 2 / .62 + begin * 6.28)) * .012;
    spot.copy(key.wp[b.pelvis]); spot.y -= bounce; spot.z -= .03 * (1 - w); rig.placePelvis(spot); rig.fk();
    rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Y, .16 * (1 - w))); rig.fk();      // the shoulder comes back with the glove
    for (const s of ['l', 'r']) { const [thigh, calf, foot] = rig.side[s].leg; rig.reach(thigh, calf, foot, key.wp[foot]); rig.reach(thigh, calf, foot, key.wp[foot]); rig.setWorld(foot, key.wq[foot]); }
    rig.fk();
    {   // the left glove: on the bag at w = 1, back at the guard (across from the right one, a little lower) at 0
        const [, upper, lower, hand] = L.arm, guard = key.wp[R.arm[3]];
        handAt.set(-guard.x + .02, guard.y - .04, guard.z + .05).lerp(key.wp[hand], w);
        rig.reach(upper, lower, hand, handAt); rig.reach(upper, lower, hand, handAt); rig.setWorld(hand, key.wq[hand]);
    }
    rig.fk();
    return out;
}

// In place of a walk along a path: the same stride with the body where it is (on a treadmill's belt). `plan` is a
// straight walkPlan long enough to have a steady middle; the pose there repeats every two steps.
export function solveTread(rig, plan, time, begin = 0) {
    const g = 8 + ((time * plan.pace + begin * 2) % 2);
    solveWalk(rig, plan, g);
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
