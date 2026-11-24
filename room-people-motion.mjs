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
const TILT_FLAT = 9;                   // degrees of desktop tilt beyond which the hands leave the keys (drafting): the desk keeps the keyboard in place up to this (desk-auto-stow.mjs STOW_ANGLE), so a typist keeps typing on a slight ergonomic tilt
const DRAW_TILT = 12;                  // … and beyond which a child drawing on the top takes their hands off it
const LEAD = 3.2;                      // sitting down starts when a lowering desk is this far above sitting height
const NEAR = 1.3;                      // the hands go back to the keys when the desk is this close to where it stops
const ROLL = .265;                     // metres the chair rolls back before its user stands (their feet end under them)
//   (a person's own chairRoll / chairScoot, in mm on the placement, replace ROLL and SCOOT: DeskActor.chairRoll, metres)
const SWAP = 1.45;                     // seconds into standing up at which the standing model takes over from the seated one
const SCOOT = .09;                     // they slide to the front of the seat as they lean in (the chair's base clears their heels)
const NUDGE = .15;                     // and how much further the calves push it as the knees straighten
const SIT_UPRIGHT = 7;                 // degrees the back comes up from the built seated postures while they sit at the keys (life on)

export { reachAt } from './people-reach.mjs';   // (a desk user's distance from the desk over time: reachKeys)

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
// Carrying something held in another posture (room-people.mjs `carry`): the arms, collarbones to fingertips, as that
// posture's key has them, the rest of the body as solved, so the hands stay on it (Kai's controller as he gets up,
// walks and stands, 19 Nov 2026). Relative to the chest, so they go where the body goes. fk() after.
export function holdArms(rig, key) {
    if (!key) return;
    for (const s of ['l', 'r']) for (const i of [...rig.side[s].arm, ...rig.side[s].fingers]) if (i >= 0 && key.q[i]) rig.lq[i].copy(key.q[i]);
    rig.fk();
}
export function lookToward(rig, target, amount, pitchOnly = false) {
    if (!target || !(amount > 0)) return;
    const b = rig.b, face = faceOf(rig), from = v7.copy(rig.wp[b.head]); from.y += .07;      // (the eyes: a little above the head bone)
    gazeV.copy(face).applyQuaternion(rig.wq[b.head]); lookV.copy(target).sub(from); if (lookV.lengthSq() < 1e-6) return; lookV.normalize();
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = THREE.MathUtils.clamp;
    const yaw = pitchOnly ? 0 : clamp(wrap(Math.atan2(lookV.x, lookV.z) - Math.atan2(gazeV.x, gazeV.z)), -LOOK_YAW, LOOK_YAW) * amount;
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
// The media lab's editor (rig.editorCast) scans the timeline on the screen. In actor space so the timeline and keyboard stay in the right place as the
// editor stands or the desk rises. A laptop has a shorter scan distance.
function followEditTimeline(target,time,seed,amount) {
    target.x += .14 * noise(time * .28, seed + 76) * amount;
    target.y -= .13 * moment(time, seed, 77, 10, 1.35) * amount;
}

// ---- the person at the desk -----------------------------------------------------------------------------------------
// keys: { sit: [key, ...], stand: [key, ...] (hands on the keyboard, built for key.deskHeight, lowest first; either may
// be empty), wait: key | null (standing, arms loose) }.
// input: { tau, k, height (inches), time (seconds, for the life in the pose; null = none), seed, life: 0..1,
//         upright (seated: the back up over the hips, SIT_UPRIGHT; default: whenever there is life) }
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

const POSE_FINGER_PREFIX = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const quatAngle = q => Array.isArray(q) && q.length === 4 ? 2 * Math.acos(Math.min(1, Math.abs(q[3]))) : 0;
// Suppress automatic keyboard typing on a hand whenever Director pose/poseKeys lift that arm away from the keys
// (>26 deg upperarm turn) or explicitly key any finger bone on that hand (e.g. overhead tricep stretches, gestures).
export function poseTapWeight(pose, s) {
    if (!pose || typeof pose !== 'object') return 1;
    const armW = 1 - ss(.45, .80, quatAngle(pose['upperarm_' + s]));
    let maxF = 0;
    for (const f of POSE_FINGER_PREFIX) for (let j = 1; j <= 3; j++) {
        const a = quatAngle(pose[`${f}_0${j}_${s}`]);
        if (a > maxF) maxF = a;
    }
    return armW * (1 - ss(.015, .08, maxF));
}

// Natural rhythmic touch-typing: realistic ~65-80 WPM bursts interspersed with genuine reading/thinking pauses
// where hands rest calmly on the home row, plus subtle grounded wrist poise. `typing` (0..2, default 1) lets
// each Director chapter dial typing from Off (0) to Light (0.5), Natural (1), or Brisk (1.5).
function tapKeys(rig, s, time, seed, life, typing = 1) {
    const amount = Math.max(0, Math.min(2, Number.isFinite(typing) ? typing : 1));
    if (!(life > 0) || !(amount > 0)) return;
    const { fingers, arm } = rig.side[s];
    if (!fingers.length) return;
    const handOffset = s === 'l' ? 0 : 13;
    // Shared phrase burst-and-pause cadence per character (tiny 0.07s L/R lead/lag so both hands pause & resume together)
    const tHand = time + (s === 'l' ? 0 : .07);
    const phrasePeriod = 5.4 + hash(101, seed) * 1.8;
    const phrasePhase = tHand / phrasePeriod + hash(102, seed);
    const phraseIdx = Math.floor(phrasePhase), u = phrasePhase - phraseIdx;
    const duty = Math.min(.94, (.44 + hash(phraseIdx, seed + 103) * .18) * (.45 + .55 * amount));
    const burstStart = .06, burstEnd = Math.min(.96, burstStart + duty);
    const inPhrase = ss(burstStart, burstStart + .07, u) * (1 - ss(burstEnd - .08, burstEnd, u));
    // Gentle mid-phrase word-space breath
    const wordBreath = 1 - .55 * moment(tHand, seed, 104, 2.6, .28);
    const intensity = Math.min(1.35, .58 + .42 * amount);
    const busy = inPhrase * wordBreath * life * intensity;
    if (busy < 1e-4) return;
    const rate = (3.1 + hash(3, seed) * .85) * (.76 + .24 * amount);
    const beat = time * rate + (s === 'l' ? 0 : .47), n = Math.floor(beat), x = beat - n;
    const sideSign = s === 'l' ? 1 : -1;
    // Finger group count (usually 5: thumb, index, middle, ring, pinky; 3 joints each)
    const nFingers = Math.max(1, Math.floor(fingers.length / 3));
    const pickFinger = k => {
        const h = hash(k, seed + (s === 'l' ? 40 : 41));
        // Spacebar / thumb ~12% of strokes, remaining 88% across the 4 main typing digits
        if (nFingers >= 5) return h < .12 ? 0 : 1 + Math.floor(((h - .12) / .88) * 3.999);
        return Math.floor(h * (nFingers - .001));
    };
    const which = pickFinger(n), prevWhich = pickFinger(n - 1), nextWhich = pickFinger(n + 1);
    const beatProb = Math.min(.94, .62 + .15 * amount);
    const activeBeat = hash(n, seed + 50 + handOffset) < beatProb ? 1 : .16;
    // Smooth, rhythmic downward keystroke strike + relaxed rebound
    const strike = Math.sin(Math.PI * clamp01((x - .08) / .78)) ** 1.35;
    const tap = strike * busy * activeBeat;
    const prevRelease = x < .30 ? (1 - x / .30) ** 2 * .26 * busy : 0;
    const nextPrep = x > .56 ? ((x - .56) / .44) * busy : 0;
    // Key row (-1 bottom, 0 home, +1 top) & column reach smoothly tracking from previous key to current key
    const rowOf = k => (hash(k, seed + 61 + handOffset) - .5) * 2;
    const colOf = f => (f / Math.max(1, nFingers - 1) - .5) * 2;
    const blend = ss(0, .38, x);
    const row = lerp(rowOf(n - 1), rowOf(n), blend);
    const col = lerp(colOf(prevWhich), colOf(which), blend);
    fingers.forEach((i, at) => {
        const finger = Math.floor(at / 3), joint = at % 3;
        const thumb = rig.names[i].startsWith('thumb');
        const scale = thumb ? .54 : 1;
        if (finger === which) {
            // Proximal joint leads softly, fingertip presses keycap then eases back up
            const travel = Math.sin(Math.PI * clamp01((x - .07 - joint * .05) / Math.max(.22, .78 - joint * .05))) ** 1.35;
            const preLift = x < .16 && joint === 0 ? -Math.sin(Math.PI * (x / .16)) * .038 * busy : 0;
            const amp = (rig.castDetail ? [.23, .15, .08] : [.21, .13, .07])[joint];
            rig.lq[i].multiply(turn.setFromAxisAngle(X, (travel * busy * activeBeat * amp + preLift) * scale));
            return;
        }
        if (finger === prevWhich && prevRelease > 0) {
            rig.lq[i].multiply(turn.setFromAxisAngle(X, prevRelease * [.16, .10, .055][joint] * scale));
            return;
        }
        if (finger === nextWhich && joint === 0 && nextPrep > 0) {
            // Next finger pre-lifts subtly in anticipation of its upcoming keystroke
            rig.lq[i].multiply(turn.setFromAxisAngle(X, -.042 * nextPrep * scale));
            return;
        }
        if (finger === (which + 1) % nFingers && joint === 0) {
            // Neighboring digit counter-lifts subtly as the typing finger loads the key
            rig.lq[i].multiply(turn.setFromAxisAngle(X, -.028 * tap));
        }
    });
    // Calm, grounded wrist poise synced softly to row/column travel (wrist pivot stays anchored)
    const wristPitch = tap * .024 + row * .014 * busy;
    const wristRoll = sideSign * col * .015 * busy;
    const wristYaw = sideSign * col * .018 * busy;
    rig.lq[arm[3]].multiply(turn.setFromAxisAngle(X, wristPitch));
    rig.lq[arm[3]].multiply(turn.setFromAxisAngle(Y, wristRoll));
    rig.lq[arm[3]].multiply(turn.setFromAxisAngle(Z, wristYaw));
}

const CUP_HAND = { 'sit-coffee': 'r', 'stand-coffee': 'r' };      // desk postures with a drink in one hand (tools/people/cast.py)
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
    if (seat && feet) pelvis.set(lerp(seat.x, feet.x, ss(0, 1, rise)), lerp(seat.y, feet.y, ss(0, .8, rise)), lerp(seat.z - (input.chairRoll ?? ROLL) * roll, feet.z, ss(.12, .9, rise)));
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
    // (the coffee postures are built sitting back already, the cup hand off the keys: the upright correction would pull
    // the typing hand, at full stretch to the keys, off them)
    const sitsUp = input.upright ?? (life > 0 && !(sit && CUP_HAND[sit.a.pose])), sitUpright = () => {
        const seated = sit ? 1 - ss(.35, .75, tau) : 0;      // (whole whenever it is on: the posture, not the breathing)
        if (seated > 0) {
            const back = -THREE.MathUtils.degToRad(SIT_UPRIGHT) * seated;
            for (const [bone, share] of [[b.spine_01, .35], [b.spine_02, .35], [b.spine_03, .3], [b.neck_01, -.3], [b.head, -.4]]) { rig.turnWorld(bone, turn.setFromAxisAngle(X, back * share)); rig.fk(); }
        }
    };
    if (!(life > 0) && sitsUp) sitUpright();
    if (life > 0) {
        // breathing lifts the chest; the hips roll into the standing leg; the head drifts and now and then looks down at
        // the hands or across the room
        rig.turnWorld(b.spine_02, turn.setFromAxisAngle(X, -.008 * breath)); rig.fk(); rig.turnWorld(b.spine_03, turn.setFromAxisAngle(X, -.011 * breath)); rig.fk();
        // seated, the built typing postures sit 8 to 11 degrees forward of upright (a hunch at the keys): the back comes up
        // over the hips while they sit (not while they lean in to stand), the head keeps most of its line to the screen and
        // the hands stay on the keys (the arms reach for them below); the pelvis stays on the seat
        if (sitsUp) sitUpright();
        if (upright > 0) { rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Z, sway * 1.3)); rig.fk(); rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Z, -sway * 1.1)); rig.fk(); }
        // eyes on the screen: on the keys, standing by while the desk moves (the screen goes up and down with it), less
        // while they lean in to get up; the drift and the glances down below come on top of it
        const screenPair = standing ? type : sit;
        if (screenPair) {
            const L = rig.side.l.arm[3], R = rig.side.r.arm[3];
            screenFrom(rig, blendV(v5, screenPair, L), blendV(v6, screenPair, R), screenPair.lift, false, screenAt);
            if (rig.editorCast) followEditTimeline(screenAt, time, seed, life);
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
    // a drink at the desk (sit-coffee, stand-coffee): one hand holds it and does not type
    const mixing = rig.mediaLab && keyed?.a.id.includes('-sit-mix');
    const cup = keyed ? CUP_HAND[(keyed.w > .5 ? keyed.b : keyed.a).pose] || null : null;
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
        // fingers: curled for the keys, looser away from them; active typing eases in as hands reach the keyboard
        const loose = wait || keyed.a, tapW = ss(.82, .98, ke) * poseTapWeight(input.pose, s);
        for (const i of fingers) { rig.lq[i].copy(loose.q[i]); if (ke > 0 && keyed) rig.lq[i].slerp(blendQ(tq, keyed, i), ke); }
        if (life > 0 && tapW > 0 && keyed && !mixing && input.taps !== false && s !== cup) tapKeys(rig, s, time, seed, life * tapW, input.typing);
    }
    rig.fk();
    if (mixing && life > 0 && ke > .9) rideFader(rig,time,seed,life*ss(.9,1,ke));
    // the drink: held where the posture holds it (it follows the keyboard's height with the other hand), and every 8 to
    // 14 seconds brought to the mouth, tipped and put back (sip), while the other hand types on
    if (cup && life > 0 && ke > .9) {
        const hand = rig.side[cup].arm[3], w = ep(time, seed, 81, 10, 2.8, .34) * life * ss(.9, 1, ke);      // (eased off as the hands leave the keys)
        if (w > 0) {
            handAt.copy(rig.wp[hand]); spot.copy(rig.wp[b.head]); spot.x += cup === 'r' ? -.055 : .055; spot.y -= .075; spot.z += .15; handAt.lerp(spot, w);
            handQ.copy(rig.wq[hand]).premultiply(turn.setFromAxisAngle(X, -.3 * ss(.6, 1, w)));
            armTo(rig, cup, handAt, handQ);
            rig.turnWorld(b.head, turn.setFromAxisAngle(X, -.07 * ss(.6, 1, w))); rig.fk();
        }
    }
    return { stance: standing ? 'stand' : 'sit', chair: { back: (input.chairRoll ?? ROLL) * roll + (input.chairScoot ?? SCOOT) * ss(.55, 1.1, tau) + NUDGE * ss(1.4, 2.3, tau), turn: 0 }, lean };
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
        const pose = typeof input.pose === 'function' ? input.pose(state.tau) : input.pose;
        this.out = solveDesk(this.rig, this.keys, { tau: state.tau, k: state.k, height, time: input.life === false ? null : this.clock, seed: this.seed, taps: input.taps, typing: input.typing, pose, chairRoll: this.chairRoll, chairScoot: this.chairScoot });
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
const RESTING = { 'sit-type': 'lr', 'stand-type': 'lr', 'stand-mid': 'lr', 'stand-type-low': 'lr', 'stand-counter': 'lr', 'sit-microscope': 'lr', 'lie-bed': 'lr', 'wheel-type': 'lr', 'power-type': 'lr', 'sit-laptop': 'lr', 'sit-coffee': 'l', 'stand-coffee': 'l', 'sit-write': 'lr', 'sit-listen': 'lr', 'sit-raise': 'l', 'stand-work': 'lr', 'cane-stand': 'r', 'wheel-roll': 'lr', 'wheel-watch': 'lr',
    'kid-stand-desk': 'lr', 'kid-sit-desk': 'lr', 'kid-sit-k': 'lr', 'kid-sit-e': 'lr', 'kid-kneel-craft': 'lr', 'kid-play-floor': 'lr',
    // (the workshop film: a hand that holds the robot where it sits, both hands at the phone so the finger stays on its button)
    'stand-robot-work': 'r', 'stand-robot-shelf': 'lr', 'stand-phone-up': 'lr', 'stand-phone-press': 'lr',
    // (the high school film: the hand on the desk's touchscreen, its edge or its glass)
    'stand-screen-pull': 'r', 'stand-screen-tap': 'r', 'stand-screen-press': 'r' };
const TYPES = new Set(['sit-type', 'stand-type', 'stand-mid', 'stand-type-low', 'wheel-type', 'power-type', 'sit-laptop', 'sit-coffee', 'stand-coffee']);
const ON_FEET = new Set(['stand-type', 'stand-mid', 'stand-type-low', 'stand-brief', 'stand-radio', 'stand-chart', 'stand-counter', 'stand-wait', 'stand-phone', 'stand-present', 'stand-present-left', 'stand-work', 'stand-paint', 'cane-stand', 'kid-stand', 'kid-stand-wait', 'kid-stand-desk', 'stand-robot-work', 'stand-robot-lift', 'stand-robot-shelf', 'stand-phone-pull', 'stand-phone-up', 'stand-phone-press', 'stand-phone-watch', 'stand-screen-pull', 'stand-screen-tap', 'stand-screen-press']);
const INTENT = new Set(['stand-chart', 'sit-microscope', 'stand-radio', 'sit-read', 'sit-phone', 'power-phone', 'stand-phone', 'sit-write', 'stand-work', 'stand-paint', 'sit-controller', 'kid-read-floor', 'kid-sit-desk', 'kid-stand-desk', 'kid-sit-k', 'kid-sit-e', 'kid-kneel-craft', 'kid-play-floor', 'stand-robot-work', 'stand-robot-lift', 'stand-robot-shelf', 'stand-phone-up', 'stand-phone-press', 'stand-screen-pull', 'stand-screen-tap', 'stand-screen-press']);      // eyes on what the hands hold
export const livelyPose = pose => pose !== 'walk' && pose !== 'white-cane' && pose !== 'push-cart';
export const WORKOUTS = new Set(['gym-cycle', 'gym-pullup', 'gym-press', 'gym-curl', 'gym-box', 'sit-pottery']);      // postures that work a machine: solveWorkout
export function solveStill(rig, key, input) {
    const time = input.time ?? 0, seed = input.seed | 0, life = input.life ?? 1, b = rig.b, pose = key.pose;
    if (WORKOUTS.has(pose)) return solveWorkout(rig, key, input);
    if (life > 0) faceOf(rig);
    rig.load(key);
    // (input.actLife: how much of a film's action (act, roll) there is, when it is not the life's amount: the life fades
    // round a change of posture, the action the film times does not)
    const actLife = input.actLife ?? life;
    if (!(life > 0) && !((input.act || input.roll) && actLife > 0)) { rig.fk(); return; }
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
    let reading = 0;
    if (!target && TYPES.has(pose)) {
        const laptop = pose === 'sit-laptop';
        target = screenFrom(rig, key.wp[rig.side.l.arm[3]], key.wp[rig.side.r.arm[3]], 0, laptop, screenAt);
        if (rig.editorCast) followEditTimeline(target, time, seed, laptop ? .55 : 1);
        if (key.id === 'people-sofia-sit-laptop') {
            // Finish a phrase, read across the line, then lower the gaze to type.
            const cycle = time / (7.5 + 2 * hash(121, seed)) + hash(122, seed);
            const phase = cycle - Math.floor(cycle);
            reading = ss(.30, .42, phase) * (1 - ss(.67, .78, phase));
            target.x += lerp(-.070, .070, ss(.42, .67, phase)) * reading;
            target.y += .050 * reading;
        }
        amount = .8;
    }
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
        const poseW = poseTapWeight(input.pose, s);
        if (TYPES.has(pose) && s !== CUP_HAND[pose] && !(rig.mediaLab && key.id.includes('-sit-mix')) && input.taps !== false && poseW > 0) tapKeys(rig, s, time, seed, life * (1 - reading) * poseW, input.typing);
    }
    // (a reader turning a page, and every other activity: ACTS below)
    rig.fk();
    // (along a film's path someone in a wheelchair pushes the rims in time with the wheels: input.roll, pushRims)
    if (pose === 'wheel-roll' && input.roll) { pushRims(rig, key, input.roll, actLife); rig.fk(); }
    // (an action at a moment of the film: input.act, SCREEN_ACTS)
    else if (input.act?.squat && ON_FEET.has(pose)) { squatAct(rig, key, input.act, actLife); rig.fk(); }
    else if (input.act && SCREEN_ACTS[pose]) { SCREEN_ACTS[pose](rig, key, input.act, actLife); rig.fk(); }
    else if (rig.mediaLab && key.id.includes('-sit-mix')) rideFader(rig,time,seed,life);
    else if (ACTS[pose]) { ACTS[pose](rig, key, time, seed, life); rig.fk(); }
    if (rig.castDetail && !input.look && !input.act && (pose === 'wheel-watch' || pose === 'sit-listen')) {
        // Audience members follow the same movement on the projection, with a
        // small individual reaction delay, then settle on the screen again.
        const glance = held(time - .28 * hash(104,seed), 41, 105, 4.8);
        headTurn(rig, .095 * glance * life, -.045 * life);
    }
}

// ---- what people do where they are --------------------------------------------------------------------------------
// On top of the life above, a posture that is an activity shows it: the pen writes, the brush paints, a drink is
// sipped, a hand that is up stretches and waves, a talker's hand talks. Each is worked out from the posture as built
// (the hand's own place and turn), small enough that hands stay on the table, the canvas or the controller, and
// seeded per person so a class does not move as one. Pure. (rig.fk() is current on entry and brought up to date on return.)
const armTo = (rig, s, at, q = null) => { const [, upper, lower, hand] = rig.side[s].arm; rig.reach(upper, lower, hand, at); rig.reach(upper, lower, hand, at); if (q) rig.setWorld(hand, q); rig.fk(); };
// 0 except for `length` seconds once every `period` (the moment is the person's own): rises, holds, falls
const moment = (time, seed, n, period, length, edge = .28) => { const p = period * (1 + .5 * hash(n, seed)), u = (time + hash(n + 1, seed) * p) % p; return u < length ? ss(0, edge, u / length) * (1 - ss(1 - edge, 1, u / length)) : 0; };
// An action now and then, at irregular moments of the person's own: time runs in stretches of about `period` seconds
// (longer by up to a third for some people), each with one action of `length` seconds somewhere in its middle half, so
// two actions are at least half a stretch apart (a pause) and at most one and a half stretches. 0 outside, rises,
// holds, falls. epSide: -1 or 1 for the action that is on now (which way it goes).
const stretchOf = (time, seed, id, period) => { const P = period * (1 + .33 * hash(id, seed)), n = Math.floor(time / P); return { P, n }; };
const ep = (time, seed, id, period, length, edge = .25) => {
    const { P, n } = stretchOf(time, seed, id, period), gap = .25 * P, at = n * P + gap + hash(n, seed + id) * Math.max(0, P - length - 2 * gap), u = (time - at) / length;
    return u > 0 && u < 1 ? ss(0, edge, u) * (1 - ss(1 - edge, 1, u)) : 0;
};
const epSide = (time, seed, id, period) => hash(stretchOf(time, seed, id, period).n, seed + id + 1) < .5 ? -1 : 1;
// A value -1..1 that holds for about `step` seconds and then moves to the next one (in the last quarter of the step).
const held = (time, seed, id, step) => { const x = time / (step * (1 + .3 * hash(id, seed))) + hash(id + 1, seed) * 7, n = Math.floor(x); return lerp(hash(n, seed + id), hash(n + 1, seed + id), ss(.72, 1, x - n)) * 2 - 1; };
// The neck (.4) and the head (.6) turn by yaw (+: to the person's left) and pitch (+: down).
const headTurn = (rig, yaw, pitch) => { for (const [bone, share] of [[rig.b.neck_01, .4], [rig.b.head, .6]]) { rig.turnWorld(bone, turn.setFromAxisAngle(Y, yaw * share).multiply(turn2.setFromAxisAngle(X, pitch * share))); rig.fk(); } };
// Whether a posture has an arm at (nearly) full stretch to where its hand rests (then the shoulders may only come toward it).
const armsStraight = (rig, key) => key.straight ??= ['l', 'r'].some(s => { const [, upper, lower, hand] = rig.side[s].arm; return key.wp[hand].distanceTo(key.wp[upper]) > .98 * (rig.offset[lower].length() + rig.offset[hand].length()); });
// Hands that rest on something go back onto it after the body has moved.
const pinHands = (rig, key, sides) => { for (const s of sides) { const h = rig.side[s].arm[3]; armTo(rig, s, key.wp[h], key.wq[h]); } };
// A hand that rests on the body (thumbs at the belt) follows the bone it rests on.
const bodyQ = Q(), bodyQ2 = Q(), bodyAt = V();
const onBone = (rig, key, s, bone) => {
    const h = rig.side[s].arm[3]; bodyQ.copy(rig.wq[bone]).multiply(bodyQ2.copy(key.wq[bone]).invert());
    bodyAt.copy(key.wp[h]).sub(key.wp[bone]).applyQuaternion(bodyQ).add(rig.wp[bone]); armTo(rig, s, bodyAt, bodyQ2.copy(bodyQ).multiply(key.wq[h]));
};
// Standing: the weight goes onto one foot (dx metres toward it, + the person's left): the hip over it rises, the
// shoulders stay level, the knees give a little; the feet stay where they are.
const shiftWeight = (rig, key, dx, dip = 0) => {
    spot.copy(rig.wp[rig.b.pelvis]); spot.x += dx; spot.y -= Math.abs(dx) * .25 + dip; rig.placePelvis(spot); rig.fk();
    rig.turnWorld(rig.b.pelvis, turn.setFromAxisAngle(Z, dx * 2)); rig.fk(); rig.turnWorld(rig.b.spine_02, turn.setFromAxisAngle(Z, -dx * 1.6)); rig.fk();
    feetStay(rig, key);
};
// Small signed travel along the fader from the wrist's solved contact point.
function rideFader(rig, time, seed, weight) {
    const listen = moment(time, seed, 103, 9, 2.8) * weight;
    const hand = rig.side.r.arm[3];
    handAt.copy(rig.wp[hand]);
    handAt.z += noise(time*.38,seed+51)*.021*(weight-listen);
    handQ.copy(rig.wq[hand]);
    armTo(rig,'r',handAt,handQ);
    headTurn(rig,.14*listen,-.07*listen);
}
function write(rig, key, time, seed, life, size = 1) {
    // a line of writing: the pen goes along the line (the writer's left to right), trembling with the letters, lifts and
    // comes back to the start of the next line, and rests now and then; the head follows the pen along the line
    const hand = rig.side.r.arm[3], pause = moment(time, seed, 71, 13, 3), line = ((time * (.13 + hash(72, seed) * .05) + hash(73, seed)) % 1), go = (1 - pause) * life;
    const back = ss(.86, 1, line), along = line < .86 ? line / .86 : 1 - back;
    handAt.copy(key.wp[hand]); handAt.x += (.045 - .09 * along) * size * go;
    handAt.x += Math.sin(time * 11.3 + seed) * .0035 * size * go * (1 - back); handAt.z += Math.sin(time * 8.1 + seed * 1.7) * .005 * size * go * (1 - back);
    handAt.y += Math.sin(Math.PI * back) * .009 * size * go;      // (the pen off the page on its way back)
    armTo(rig, 'r', handAt, key.wq[hand]);
    headTurn(rig, (.5 - along) * .08 * go, 0);
    if (pause > 0) { rig.turnWorld(rig.b.head, turn.setFromAxisAngle(X, -.16 * pause * life)); rig.fk(); }      // looks up to think
}
function sip(rig, key, time, seed, life, chat = 0) {
    // the cup comes up to the mouth, tips, and goes back to where it is held (every 8 to 14 seconds, with pauses); someone
    // chatting with a drink moves it a little with the words in between
    const hand = rig.side.r.arm[3], w = ep(time, seed, 81, 10, 2.8, .34) * life;
    if (!(w > 0) && !(chat > 0)) return;
    handAt.copy(key.wp[hand]);
    if (chat > 0) { const said = ss(-.2, .3, noise(time * .23, seed + 84)) * chat * life * (1 - w); handAt.x += noise(time * .8, seed + 85) * .025 * said; handAt.y += (noise(time * .9 + 3, seed + 86) * .025 + .01) * said; }
    spot.copy(rig.wp[rig.b.head]); spot.x -= .055; spot.y -= .075; spot.z += .15; handAt.lerp(spot, w);
    handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(X, -.3 * ss(.6, 1, w)));
    armTo(rig, 'r', handAt, handQ);
    rig.turnWorld(rig.b.head, turn.setFromAxisAngle(X, -.07 * ss(.6, 1, w))); rig.fk();
}
// A reader's eyes go along the lines and down the page (the head carries them: no eye bones); now and then the right
// hand lets go, crosses the page and turns it.
function read(rig, key, time, seed, life, period = 10) {
    const P = period * (1 + .8 * hash(4, seed)), n = Math.floor(time / P), at = (n + .15 + hash(n, seed + 60) * .6) * P, u = (time - at) / 2.3, turning = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
    const line = time / (2.4 + hash(61, seed) * .8) + hash(62, seed) * 9, x = line % 1, page = (line / 9) % 1;
    const across = x < .85 ? x / .85 : 1 - ss(.85, 1, x);
    headTurn(rig, (.045 - .09 * across) * (1 - turning) * life, (-.03 + .07 * page) * (1 - turning) * life);
    if (turning > 0 && rig.classicMotion) {
        // (Create's Classic look, room-looks.mjs: the page turn as it was before the Nov 17 pass)
        const [, upper, lower, hand] = rig.side.r.arm, other = rig.wp[rig.side.l.arm[3]], over = turning ** 2 * life;
        handQ.copy(rig.wq[hand]); spot.copy(rig.wp[hand]).lerp(other, .5 * over); spot.addScaledVector(Y, .035 * turning * life);
        rig.reach(upper, lower, hand, spot); rig.setWorld(hand, handQ);
    } else if (turning > 0) {
        const [, upper, lower, hand] = rig.side.r.arm, other = rig.wp[rig.side.l.arm[3]];
        // Lift the corner first, carry it across the spine, then release the page.
        const carry = ss(0,.58,u) * (1-ss(.58,1,u)) * life;
        handQ.copy(rig.wq[hand]).premultiply(turn.setFromAxisAngle(Z, .16 * carry));
        spot.copy(rig.wp[hand]).lerp(other, .53 * carry);
        spot.addScaledVector(Y, (.026 * turning + .017 * Math.sin(Math.PI * Math.min(1,u*1.6))) * life);
        rig.reach(upper, lower, hand, spot); rig.setWorld(hand, handQ);
    }
}
// On a phone: the thumb scrolls in bursts (a quick flick up the screen, slower back), the phone tilts with it, now and
// then it comes closer to read, and every so often the head comes up from it and looks about.
function phone(rig, key, time, seed, life) {
    const hand = rig.side.r.arm[3], up = ep(time, seed, 221, 10, 2.4, .3) * life, near = (.5 + .5 * held(time, seed, 222, 7)) * life;
    const busy = ss(-.25, .15, noise(time * .33, seed + 223)) * (1 - up) * life, x = (time * (1.2 + hash(224, seed) * .6)) % 1, flick = x < .25 ? ss(0, .25, x) : 1 - ss(.25, 1, x);
    handAt.copy(rig.wp[hand]); handAt.y += .02 * near - .025 * up; handAt.z += .015 * near - .01 * up;
    handQ.copy(rig.wq[hand]).premultiply(turn.setFromAxisAngle(X, .05 * (flick - .5) * busy));
    armTo(rig, 'r', handAt, handQ);
    const t1 = rig.index.get('thumb_01_r'), t2 = rig.index.get('thumb_02_r');
    if (t1 !== undefined) rig.lq[t1].multiply(turn.setFromAxisAngle(X, (flick - .5) * .4 * busy));      // (thumb_01 about x: the tip goes across the palm, over the screen)
    if (t2 !== undefined) rig.lq[t2].multiply(turn.setFromAxisAngle(Z, -.18 * (x < .25 ? 0 : Math.sin(Math.PI * (x - .25) / .75)) * busy));      // (lifted on the way back)
    rig.fk();
    headTurn(rig, .14 * up * epSide(time, seed, 221, 10), -.3 * up);
}
// Sitting on the floor: a slow rock from side to side, leaning in now and then, looking about; the hands stay on the knees.
function floorSit(rig, key, time, seed, life, size) {
    const rock = Math.sin(time * Math.PI * 2 / (4.5 + hash(231, seed) * 2) + hash(232, seed) * 6.28) * (.6 + .4 * held(time, seed, 233, 6)), lean = ep(time, seed, 234, 9, 3, .3);
    bend(rig, Z, .05 * size * rock * life); bend(rig, X, .07 * size * lean * life);
    headTurn(rig, .3 * held(time, seed, 235, 3.2) * life, (.06 * held(time, seed, 236, 4.5) - .05 * lean) * life);
    pinHands(rig, key, 'lr');
}
// Standing by: the weight from one foot to the other and back (holding on each), the head and shoulders turn to look about.
function waitAbout(rig, key, time, seed, life, quick = 1) {
    shiftWeight(rig, key, .02 * held(time, seed, 211, 7 / quick) * life);
    const look = held(time, seed, 212, 3.5 / quick);
    rig.turnWorld(rig.b.spine_03, turn.setFromAxisAngle(Y, .08 * look * life)); rig.fk();
    headTurn(rig, .3 * look * life, .07 * held(time, seed, 213, 5 / quick) * life);
}
const bend = (rig, axis, angle) => { for (const [bone, share] of [[rig.b.spine_01, .3], [rig.b.spine_02, .4], [rig.b.spine_03, .3]]) { rig.turnWorld(bone, turn.setFromAxisAngle(axis, angle * share)); rig.fk(); } };
const feetStay = (rig, key) => { for (const s of ['l', 'r']) { const [thigh, calf, foot] = rig.side[s].leg; rig.reach(thigh, calf, foot, key.wp[foot]); rig.reach(thigh, calf, foot, key.wp[foot]); rig.setWorld(foot, key.wq[foot]); } rig.fk(); };
// Desk Squats (the app's exercise desk_squats_01), timed by the film: a placement of a STANDING posture with
// act: { kind: 'squat', at: chapter seconds of the first descent, dur: seconds for all the reps, reps: 3 }. The feet stay planted
// where the posture has them (shoulder-width), the pelvis sinks and goes back (the legs fold by themselves under the planted feet),
// the trunk leans forward and the arms reach forward for balance; between reps she is upright, at the end she is back as built.
// Pure: the same second is always the same pose. SQUAT: how far the hips go (m) and the trunk's lean (rad) at the bottom.
export const SQUAT = { down: .34, back: .17, lean: .5, reach: .52, hang: .56, swing: .8 };
export const squatDepth = (since, dur, reps) => since <= 0 || since >= dur ? 0 : (1 - Math.cos(Math.PI * 2 * reps * since / dur)) / 2;
// How far the arms are up (0 by her sides, 1 level in front of her): they swing up as she goes down into the first rep, stay up for
// the reps and swing down as she comes up from the last one (SQUAT.swing seconds each, eased; never longer than half a rep).
export const squatArmsUp = (since, dur, reps) => { const w = Math.min(SQUAT.swing, dur / (2 * reps)); return ss(0, w, since) * (1 - ss(dur - w, dur, since)); };
// The arms of the squat: each hand on an arc about its shoulder, from hanging by her side (up 0) to level in front of her (up 1),
// the arm straight all the way (a swing, not a reach) and the hand in line with the forearm.
function squatArms(rig, up) {
    const a0 = Math.atan2(.02, SQUAT.hang), a1 = Math.atan2(SQUAT.reach, .03), a = lerp(a0, a1, up), r = lerp(Math.hypot(.02, SQUAT.hang), Math.hypot(SQUAT.reach, .03), up);
    for (const s of ['l', 'r']) {
        const [, upper, lower, hand] = rig.side[s].arm; handAt.copy(rig.wp[upper]); handAt.y -= r * Math.cos(a); handAt.z += r * Math.sin(a);
        armTo(rig, s, handAt); rig.setWorld(hand, rig.wq[lower]); rig.fk();
    }
}
function squatAct(rig, key, act, life) {
    const reps = Math.max(1, act.squat.reps | 0), d = squatDepth(act.since, act.dur, reps) * life;
    spot.copy(key.wp[rig.b.pelvis]); spot.y -= SQUAT.down * d; spot.z -= SQUAT.back * d; rig.placePelvis(spot); rig.fk();
    bend(rig, X, SQUAT.lean * d); feetStay(rig, key);
    // (the arms: by her sides while she is away from the desk, squatKey: the step out brings them there from the keys and the step
    // back in takes them to the keys again; up in front of her for the reps, squatArmsUp)
    if (life > 0) squatArms(rig, squatArmsUp(act.since, act.dur, reps) * life);
}
// The posture a squat starts from and ends in, as a key: the posture as built with the arms hanging by her sides. A step out from
// the desk into the squats ends in it and the step back in starts from it (room-people.mjs stepOuts), so the hands leave the keys
// and come down while she steps back, and go up to the keys again while she steps in: no jump at either end of the reps.
export function squatKey(rig, key) {
    rig.load(key); rig.fk(); squatArms(rig, 0); rig.fk();
    return { ...key, id: key.id + '|squat', q: rig.lq.map(q => q.clone()), root: rig.lp[rig.b.Root].clone(), pelvis: rig.lp[rig.b.pelvis].clone(), wp: rig.wp.map(v => v.clone()), wq: rig.wq.map(q => q.clone()) };
}
// Actions timed by the film (the high school chapter: Noah and the desk's touchscreen). input.act: { since: seconds
// since the action's moment (negative before it), dur: seconds, by: a Vector3 in the model's frame (metres),
// press: the key of the pressed posture or null } (room-people.mjs actOf, from the placement's `act`).
//   stand-screen-pull   built with the right hand at the edge of the stowed screen: from the moment on, the hand
//                       draws the screen out along its rails, `by` over `dur` (smooth), and stays there
//   stand-screen-tap    built with the index finger over a button on the glass (hover): at the moment the finger is
//                       on it, as in the pressed posture (stand-screen-press: the same, the finger on the glass); down
//                       over 0.15 s, held 0.3 s, up over 0.15 s. Without a pressed posture it goes `by` (default 25 mm
//                       ahead) instead.
const SCREEN_ACTS = {
    'stand-screen-pull'(rig, key, act, life) {
        const hand = rig.side.r.arm[3], w = act.dur > 0 ? ss(0, act.dur, act.since) : act.since >= 0 ? 1 : 0;
        if (!act.by) return;
        handAt.copy(key.wp[hand]).addScaledVector(act.by, w * life); armTo(rig, 'r', handAt, key.wq[hand]);
    },
    'stand-screen-tap'(rig, key, act, life) {
        const down = ss(-.15, 0, act.since) * (1 - ss(.3, .45, act.since)) * life; if (!(down > 0)) return;
        const hand = rig.side.r.arm[3], press = act.press;
        if (press) {
            handAt.lerpVectors(key.wp[hand], press.wp[hand], down); handQ.slerpQuaternions(key.wq[hand], press.wq[hand], down);
            armTo(rig, 'r', handAt, handQ);
            for (const i of rig.side.r.fingers) rig.lq[i].slerpQuaternions(key.q[i], press.q[i], down);
        } else { handAt.copy(key.wp[hand]); if (act.by) handAt.addScaledVector(act.by, down); else handAt.z += .025 * down; armTo(rig, 'r', handAt, key.wq[hand]); }
    }
};
// A posture as its action leaves it (the pull: the hand where the screen was drawn to), as a key: a change of
// posture that follows the action starts from there, not from the posture as built (room-people.mjs readyChange).
export function actedKey(rig, key, act) {
    if (!act || !SCREEN_ACTS[key.pose]) return key;
    rig.load(key); rig.fk(); SCREEN_ACTS[key.pose](rig, key, act, 1); rig.fk();
    return { ...key, id: key.id + '|acted', q: rig.lq.map(q => q.clone()), root: rig.lp[rig.b.Root].clone(), pelvis: rig.lp[rig.b.pelvis].clone(), wp: rig.wp.map(v => v.clone()), wq: rig.wq.map(q => q.clone()) };
}
const ACTS = {
    'sit-write': write, 'kid-sit-k': (rig, key, time, seed, life) => write(rig, key, time, seed, life, 1.1), 'kid-sit-e': (rig, key, time, seed, life) => write(rig, key, time, seed, life, 1.1), 'kid-kneel-craft': (rig, key, time, seed, life) => write(rig, key, time, seed, life, 1.15),
    'stand-mug': sip, 'sit-mug': sip, 'stand-drink': (rig, key, time, seed, life) => sip(rig, key, time, seed, life, 1), 'sit-chat'(rig, key, time, seed, life) {
        // chatting on the sofa: the head nods along with the talk as well
        sip(rig, key, time, seed, life, 1);
        headTurn(rig, 0, Math.max(0, Math.sin(time * 2.3 + seed)) * .045 * ss(-.2, .3, noise(time * .23, seed + 84)) * life);
    },
    'sit-read': (rig, key, time, seed, life) => read(rig, key, time, seed, life, 10),
    'kid-read-floor': (rig, key, time, seed, life) => read(rig, key, time, seed, life, 8),
    // listening in a class or a meeting: nods now and then (two or three), settles back or forward in the seat and leans
    // a little to one side, glances aside; the hands stay where they rest and the hips on the seat
    'sit-listen'(rig, key, time, seed, life) {
        // (someone built with the arms at full stretch to the table, Rosa, only leans toward it: leaning back or aside would
        // pull the hands off it)
        const straight = armsStraight(rig, key), nods = ep(time, seed, 201, 7, 2.2, .2), nod = Math.sin(Math.PI * time * (1.6 + hash(202, seed) * .5)) ** 2 * nods, settle = straight ? .5 + .5 * held(time, seed, 203, 9) : held(time, seed, 203, 9);
        bend(rig, X, .035 * settle * life); if (!straight) bend(rig, Z, .02 * held(time, seed, 204, 13) * life);
        const glance = ep(time, seed, 205, 11, 2.4, .3) * epSide(time, seed, 205, 11);
        headTurn(rig, .28 * glance * life, (.075 * nod - .03 * settle) * life);
        pinHands(rig, key, 'lr');
    },
    'stand-wait': waitAbout, 'kid-stand-wait': (rig, key, time, seed, life) => waitAbout(rig, key, time, seed, life, 1.6),
    'stand-phone': phone, 'sit-phone': phone,
    'power-phone'(rig, key, time, seed, life) {
        // The handset rests between both hands. Keep the supporting wrist in
        // its authored position relative to the moving handset as the thumb scrolls.
        phone(rig, key, time, seed, life);
        const right = rig.side.r.arm[3], left = rig.side.l.arm[3];
        bodyQ.copy(rig.wq[right]).multiply(bodyQ2.copy(key.wq[right]).invert());
        bodyAt.copy(key.wp[left]).sub(key.wp[right]).applyQuaternion(bodyQ).add(rig.wp[right]);
        armTo(rig, 'l', bodyAt, bodyQ2.copy(bodyQ).multiply(key.wq[left]));
    },
    'kid-sit-floor': (rig, key, time, seed, life) => floorSit(rig, key, time, seed, life, 1), 'sit-floor': (rig, key, time, seed, life) => floorSit(rig, key, time, seed, life, .6),
    // a child showing something: the hand with it lifts and turns it, a little bounce at the knees, the head goes from the
    // thing to the one it is shown to
    'kid-stand'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], show = held(time, seed, 241, 2.4), bounce = ep(time, seed, 242, 6, 1.5, .2) * Math.abs(Math.sin(Math.PI * time * 2.6));
        shiftWeight(rig, key, .012 * held(time, seed, 243, 4) * life, .014 * bounce * life);
        handAt.copy(rig.wp[hand]); handAt.y += .035 * show * life; handAt.z += .02 * (.5 + .5 * show) * life;
        armTo(rig, 'r', handAt, handQ.copy(rig.wq[hand]).premultiply(turn.setFromAxisAngle(Y, .35 * held(time, seed, 244, 1.8) * life)));
        headTurn(rig, .15 * held(time, seed, 245, 3) * life, .12 * show * life);
    },
    // in a wheelchair, watching: leans in and sits back, nods now and then, one hand at a time lets go to adjust
    // something and comes back to where it rests; the hips stay in the seat
    'wheel-watch'(rig, key, time, seed, life) {
        bend(rig, X, .04 * held(time, seed, 251, 8) * life);
        const nods = ep(time, seed, 252, 9, 2, .2) * Math.sin(Math.PI * time * 1.7) ** 2;
        headTurn(rig, 0, .06 * nods * life);
        pinHands(rig, key, 'lr');
        const fidget = ep(time, seed, 253, 10, 2.4, .3) * life, s = epSide(time, seed, 253, 10) < 0 ? 'r' : 'l', hand = rig.side[s].arm[3];
        if (fidget > 0) { handAt.copy(key.wp[hand]); handAt.y += .035 * fidget; handAt.x += (s === 'l' ? -1 : 1) * .03 * fidget; handAt.z += .02 * fidget; armTo(rig, s, handAt, handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(Z, (s === 'l' ? 1 : -1) * .3 * fidget))); }
    },
    // standing with a walking stick (right hand): the weight goes onto the stick and back, the trunk with it; the free
    // hand moves a little now and then; the hand stays on the stick and the feet where they are
    'cane-stand'(rig, key, time, seed, life) {
        const lean = (.5 + .5 * held(time, seed, 261, 6)) * life;
        shiftWeight(rig, key, -.012 * lean, .003 * lean); bend(rig, Z, .03 * lean);
        const free = rig.side.l.arm[3], lift = ep(time, seed, 262, 9, 2.2, .3) * life;
        if (lift > 0) { handAt.copy(rig.wp[free]); handAt.z += .07 * lift; handAt.y += .05 * lift; handAt.x -= .02 * lift; armTo(rig, 'l', handAt, rig.wq[free].clone()); }
        headTurn(rig, .22 * held(time, seed, 263, 4) * life, 0);
        pinHands(rig, key, 'r');
    },
    // carrying a box: it is hitched up now and then (both hands together, the trunk leaning back with it), the weight
    // shifts; the box is on the right hand and the left keeps its place against it
    'carry-box'(rig, key, time, seed, life) {
        const w = held(time, seed, 271, 6) * life, hitch = ep(time, seed, 272, 6, 1.1, .35) * life;
        shiftWeight(rig, key, .015 * w);
        bend(rig, X, -.035 * hitch);
        spot.set(.008 * w, .035 * hitch, .01 * hitch);
        for (const s of ['l', 'r']) { const hand = rig.side[s].arm[3]; handAt.copy(key.wp[hand]).add(spot); armTo(rig, s, handAt, key.wq[hand]); }
        headTurn(rig, .15 * held(time, seed, 273, 4) * life, 0);
    },
    // a clipboard (left hand) and a pen (right): writes on the chart in short lines, looks up now and then
    'stand-chart'(rig, key, time, seed, life) {
        pinHands(rig, key, 'l');
        write(rig, key, time, seed, life, .75);
    },
    // kneeling at a low shelf: the hand goes along the shelf, now and then draws something out a little and puts it back;
    // the head follows the hand; the other hand stays on the knee
    'kneel-shelf'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], along = held(time, seed, 281, 3) * life, pull = ep(time, seed, 282, 7, 1.8, .3) * life;
        bend(rig, Y, -.05 * along);
        handAt.copy(key.wp[hand]); handAt.x += .07 * along; handAt.z -= .035 * pull; handAt.y += .01 * pull;
        armTo(rig, 'r', handAt, key.wq[hand]);
        pinHands(rig, key, 'l');
        headTurn(rig, .25 * along, 0);
    },
    // at ease, thumbs at the belt: the weight from foot to foot, a slow look over the room; the hands stay on the belt
    'stand-brief'(rig, key, time, seed, life) {
        shiftWeight(rig, key, .016 * held(time, seed, 291, 8) * life);
        const look = held(time, seed, 292, 4.5);
        rig.turnWorld(rig.b.spine_03, turn.setFromAxisAngle(Y, .06 * look * life)); rig.fk();
        headTurn(rig, .32 * look * life, .05 * held(time, seed, 293, 6) * life);
        onBone(rig, key, 'l', rig.b.pelvis); onBone(rig, key, 'r', rig.b.pelvis);
    },
    // on the radio (left hand at the shoulder): now and then the radio comes to the mouth and they speak, the head tipped
    // to it, the free hand moving a little; in between they look about
    'stand-radio'(rig, key, time, seed, life) {
        const radio = rig.side.l.arm[3], talk = ep(time, seed, 301, 8, 2.6, .25) * life;
        if (talk > 0) {
            spot.copy(rig.wp[rig.b.head]); spot.x += .05; spot.y -= .08; spot.z += .1;
            handAt.copy(rig.wp[radio]).lerp(spot, .35 * talk); armTo(rig, 'l', handAt, rig.wq[radio].clone());
            const free = rig.side.r.arm[3]; handAt.copy(rig.wp[free]); handAt.z += .05 * talk; handAt.y += .03 * talk; armTo(rig, 'r', handAt, rig.wq[free].clone());
        }
        headTurn(rig, .12 * talk + .25 * held(time, seed, 302, 4) * (1 - talk) * life, .05 * talk);
    },
    // at the microscope: the hands turn the focus a little, now and then the head comes up from the eyepieces to think
    'sit-microscope'(rig, key, time, seed, life) {
        const lift = ep(time, seed, 311, 16, 2.4, .3) * life, focus = Math.sin(time * 1.3 + seed) * ss(-.2, .2, noise(time * .2, seed + 312)) * (1 - lift) * life;
        bend(rig, X, -.03 * lift); headTurn(rig, 0, -.18 * lift);
        for (const s of ['l', 'r']) {
            const hand = rig.side[s].arm[3], lower = rig.side[s].arm[2]; dir.copy(key.wp[hand]).sub(key.wp[lower]).normalize();
            armTo(rig, s, key.wp[hand], handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(dir, (s === 'l' ? 1 : -1) * .18 * focus)));
        }
    },
    // a hand up in class: it stretches higher, sinks a little when the arm tires, and waves for attention
    'sit-raise'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], tired = (.5 + .5 * noise(time * .09 + 3, seed + 90)) * life, wave = moment(time, seed, 91, 9, 1.6) * life;
        handAt.copy(key.wp[hand]); handAt.y += .025 - .13 * tired; handAt.z += .05 * tired; handAt.x += Math.sin(time * 9.5) * .035 * wave;
        armTo(rig, 'r', handAt, key.wq[hand]);
    },
    // at the easel: strokes on the canvas, a dab now and then, the brush back to the palette to load
    'stand-paint'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], other = rig.wp[rig.side.l.arm[3]], load = moment(time, seed, 101, 11, 2.4, .36) * life;
        if (rig.classicMotion) {   // (Create's Classic look, room-looks.mjs: the strokes as they were before the Nov 17 pass)
            handAt.copy(key.wp[hand]); handAt.x += noise(time * .55, seed + 102) * .07 * life; handAt.y += (noise(time * .41 + 5, seed + 103) * .09 + Math.sin(time * 5.2) * .012) * life;
            if (load > 0) { spot.copy(other); spot.y += .06; spot.z += .03; spot.x -= .05; handAt.lerp(spot, load); }
            armTo(rig, 'r', handAt, key.wq[hand]); return;
        }
        const phase = (time * (.72 + .22 * hash(102, seed)) + hash(103, seed)) % 1;
        const stroke = ss(.04, .6, phase) - ss(.68, .99, phase);
        const lift = Math.sin(Math.PI * ss(.62, 1, phase));
        handAt.copy(key.wp[hand]);
        handAt.x += (noise(time * .34, seed + 102) * .05 + .032 * stroke) * life;
        handAt.y += (noise(time * .28, seed + 103) * .065 + .021 * stroke) * life;
        handAt.z -= .018 * lift * life;
        if (load > 0) { spot.copy(other); spot.y += .06; spot.z += .03; spot.x -= .05; handAt.lerp(spot, load); }
        handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(Z, (.07 * stroke + .09 * lift) * (1 - load) * life));
        armTo(rig, 'r', handAt, handQ);
    },
    // presenting: the arm toward the board moves over what is shown, the head goes between the board and the room
    // (every 7 to 12 seconds the arm reaches further out and up to point, and holds it: the shoulders and the head turn to
    // the board with it, then back to the room)
    'stand-present'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], shoulder = rig.side.r.arm[1], point = ep(time, seed, 114, 8, 2.8, .22) * life, board = Math.sign(key.wp[hand].x) || -1;
        rig.turnWorld(rig.b.spine_03, turn.setFromAxisAngle(Y, .09 * board * point)); rig.fk();
        handAt.copy(key.wp[hand]); handAt.x += noise(time * .37, seed + 111) * .05 * life * (1 - point); handAt.y += noise(time * .31 + 2, seed + 112) * .07 * life * (1 - point);
        dir.copy(key.wp[hand]).sub(key.wp[shoulder]).normalize(); handAt.addScaledVector(dir, .08 * point); handAt.y += .05 * point;
        armTo(rig, 'r', handAt, key.wq[hand]);
        headTurn(rig, (.45 * board * point + noise(time * .13 + 9, seed + 113) * .3 * (1 - point)) * life, 0);
    },
    // presenting from the left of the board (stand-present-left): the left arm is out at the board and keeps the point
    // the posture was built with, so it is right wherever the room turns him toward the board. Every 7 to 9 seconds the
    // point is re-aimed 2 to 3 degrees (rises, holds, falls back) with a tiny retarget in the hold, and it drifts under a
    // degree between: the whole arm turns about the shoulder (the reach stays the same, the hand and the extended finger
    // turn with it). The tablet hand on the right shifts a few mm and stays level. The head goes between the class and
    // the board (turns relative to the built head, which already looks a little toward the board).
    'stand-present-left'(rig, key, time, seed, life) {
        const upper = rig.side.l?.arm[1], hand = rig.side.l?.arm[3], tablet = rig.side.r?.arm[3];
        if (upper === undefined || hand === undefined || !key.wp[hand] || !key.wp[upper]) return;
        const aim = ep(time, seed, 151, 7, 3.2, .3) * life, way = epSide(time, seed, 151, 7), n = stretchOf(time, seed, 151, 7).n;
        const yaw = (noise(time * .21, seed + 152) * .012 + way * (.035 + .015 * hash(n, seed + 153)) * aim + noise(time * .9 + 4, seed + 154) * .006 * aim) * life;
        const pitch = (noise(time * .17 + 3, seed + 155) * .01 + (hash(n, seed + 156) - .5) * .04 * aim) * life;
        rig.turnWorld(rig.b.spine_03, turn.setFromAxisAngle(Y, .035 * aim)); rig.fk();      // (the shoulders a little toward the board with the point)
        dir.copy(key.wp[hand]).sub(key.wp[upper]);
        up.crossVectors(dir, Y); if (up.lengthSq() < 1e-8) up.set(0, 0, 1); up.normalize();
        handQ.setFromAxisAngle(Y, yaw).multiply(turn2.setFromAxisAngle(up, pitch));
        handAt.copy(dir).applyQuaternion(handQ).add(rig.wp[upper]);
        armTo(rig, 'l', handAt, turn.copy(handQ).multiply(key.wq[hand]));
        if (tablet !== undefined && key.wp[tablet]) {
            handAt.copy(key.wp[tablet]); handAt.x += noise(time * .29 + 7, seed + 157) * .006 * life; handAt.y += noise(time * .23 + 1, seed + 158) * .008 * life; handAt.z += noise(time * .19 + 5, seed + 159) * .006 * life;
            armTo(rig, 'r', handAt, key.wq[tablet]);
        }
        const toBoard = Math.max(aim, ep(time, seed, 160, 6, 2.4, .3) * life), toClass = ep(time, seed, 161, 9, 3, .3) * life * (1 - toBoard);
        headTurn(rig, .28 * toBoard - .22 * toClass, 0);
    },
    // explaining: the open hand moves with the words in beats, phrases with pauses between them, the other hand joins for
    // the important bits; the head nods along and the shoulders turn a little with the phrase
    'stand-talk'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], said = (.15 + .85 * ss(-.2, .3, noise(time * .21, seed + 120))) * life, beat = Math.max(0, Math.sin(time * (4.2 + hash(125, seed) * 1.4) + seed)) ** 2 * said;
        rig.turnWorld(rig.b.spine_03, turn.setFromAxisAngle(Y, noise(time * .3 + 5, seed + 126) * .06 * said)); rig.fk();
        handAt.copy(key.wp[hand]); handAt.x += noise(time * .9, seed + 121) * .07 * said; handAt.y += (noise(time * 1.1 + 3, seed + 122) * .07 + .03) * said + .025 * beat; handAt.z += noise(time * .7 + 7, seed + 123) * .05 * said;
        armTo(rig, 'r', handAt, key.wq[hand]);
        const both = ep(time, seed, 124, 8, 2.2, .3) * said, other = rig.side.l.arm[3];
        if (both > 0) { handAt.copy(key.wp[other]); handAt.x -= .05 * both; handAt.y += (.16 + .02 * beat) * both; handAt.z += .17 * both; armTo(rig, 'l', handAt, key.wq[other]); }
        headTurn(rig, 0, Math.max(0, Math.sin(time * 2.1 + seed)) * .06 * said);
    },
    // on the sofa with a controller: the body leans with the game, both hands (and the pad in them) with it
    'sit-controller'(rig, key, time, seed, life) {
        const lean = noise(time * .45, seed + 130) * .07 * life, jolt = moment(time, seed, 131, 6, .7) * life;
        bend(rig, Z, lean); bend(rig, X, .05 * jolt);
        for (const s of ['l', 'r']) {
            const hand = rig.side[s].arm[3];
            handAt.copy(key.wp[hand]); handAt.x += -lean * .35 + noise(time * 1.9, seed + 132) * .008 * life; handAt.y += (noise(time * 2.3 + 4, seed + 133) * .008 + .025 * jolt) * life; handAt.z += .03 * jolt;
            armTo(rig, s, handAt, handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(Z, lean * .8)));
            // the thumbs work the sticks and buttons (thumb_01 about x: the tip goes over the pad), each in its own rhythm
            const thumb = rig.index.get('thumb_01_' + s);
            if (thumb !== undefined) { rig.lq[thumb].multiply(turn.setFromAxisAngle(X, (noise(time * (2.6 + (s === 'l' ? 0 : .9)), seed + (s === 'l' ? 134 : 135)) * .22 + .12 * jolt) * life)); rig.fk(); }
        }
    },
    // at a bench: the tool hand works to and fro in bursts, the other steadies the piece
    'stand-work'(rig, key, time, seed, life) {
        const hand = rig.side.r.arm[3], busy = (1 - moment(time, seed, 141, 8, 2.2)) * life;
        // (the shoulders turn a little with each stroke and the body leans into the work; the other hand stays on the piece)
        bend(rig, Y, Math.sin(time * 7.4 + seed) * .035 * busy); bend(rig, X, (.02 + .012 * Math.sin(time * 3.7 + seed)) * busy);
        const other = rig.side.l.arm[3]; armTo(rig, 'l', key.wp[other], key.wq[other]);
        handAt.copy(key.wp[hand]); handAt.x += Math.sin(time * 7.4 + seed) * .036 * busy; handAt.z += Math.sin(time * 3.7 + seed) * .008 * busy;
        armTo(rig, 'r', handAt, handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(Y, Math.sin(time * 7.4 + seed + .6) * .12 * busy)));
    },
    // at the desk with the robot (the workshop film): the right hand holds it where it sits (RESTING), the left works at
    // its open chest in short bursts (a few millimetres to and fro, the wrist turning), now and then it stops while he
    // looks; the head goes with the work
    'stand-robot-work'(rig, key, time, seed, life) {
        // Seat the thumb and index finger, turn the part, then ease the wrist
        // back out. The eyes follow the working hand just before the turn.
        const phase = (time / 2.35 + hash(321, seed)) % 1;
        const grip = (ss(.05, .23, phase) - ss(.62, .85, phase)) * life;
        const twist = (ss(.23, .53, phase) - ss(.68, .94, phase)) * life;
        const hand = rig.side.l.arm[3];
        handAt.copy(key.wp[hand]); handAt.x -= .009 * grip; handAt.y += .004 * twist;
        armTo(rig, 'l', handAt, handQ.copy(key.wq[hand]).premultiply(turn.setFromAxisAngle(Z, .18 * twist)));
        for (const [bone, radians] of [['index_02_l', .14], ['thumb_02_l', .09]]) {
            const joint = rig.index.get(bone);
            if (joint !== undefined) rig.lq[joint].multiply(turn.setFromAxisAngle(X, radians * grip));
        }
        headTurn(rig, .042 * grip, .025 * twist);
    },
    'stand-robot-lift'(rig, key, time, seed, life) {
        // Support the load over the planted foot. Re-solve both grips after
        // the shoulder adjustment so the robot keeps its authored shelf path.
        shiftWeight(rig, key, .012 * life, .004 * life);
        bend(rig, X, -.018 * life);
        pinHands(rig, key, 'lr');
        headTurn(rig, .015 * life, -.046 * life);
    },
    // phone lowered, watching the desk go (its head follows the desk: RoomPeople.gazeOf): the weight settles from foot to foot
    'stand-phone-watch'(rig, key, time, seed, life) { shiftWeight(rig, key, .014 * held(time, seed, 331, 6) * life); },
    // a standing stretch: a slow bend from side to side, arms overhead
    // (the hips go the other way, and on each breath in the hands reach a little higher)
    'stretch'(rig, key, time, seed, life) {
        const side = Math.sin(time * Math.PI * 2 / (7.5 + hash(151, seed) * 2) + hash(152, seed) * 6.28) * life, reach = (.5 + .5 * Math.sin(time * Math.PI * 2 / 3.9 + hash(153, seed) * 6.28)) * life;
        spot.copy(rig.wp[rig.b.pelvis]); spot.x -= .025 * side; rig.placePelvis(spot); rig.fk();
        bend(rig, Z, side * .24); feetStay(rig, key);
        for (const s of ['l', 'r']) { const hand = rig.side[s].arm[3]; handAt.copy(rig.wp[hand]); handAt.y += .035 * reach; handAt.x += (s === 'l' ? -1 : 1) * .012 * reach; armTo(rig, s, handAt, rig.wq[hand].clone()); }
    },
    // in a wheelchair, rolling: the hands push on the rims and come back, the trunk leans into each push (on the spot, in
    // a rhythm of the person's own; along a film's path the pushes are the wheels' own: pushRims, from solveStill)
    'wheel-roll'(rig, key, time, seed, life) {
        const u = time * Math.PI * 2 / (2.6 + hash(191, seed) * .8) + hash(192, seed) * 6.28, push = (.5 + .5 * Math.sin(u)) * life;
        bend(rig, X, .06 * push);
        for (const s of ['l', 'r']) { const hand = rig.side[s].arm[3]; handAt.copy(key.wp[hand]); handAt.z += .05 * push - .015 * life; handAt.y -= .03 * push; armTo(rig, s, handAt, key.wq[hand]); }
    },
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
const centre = V(), handAt = V(), elbowAxis = V(), hang = V();
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
        // (and the body rides with them: the hips dip with each stroke, the trunk leans in a little and nods with it, the
        // shoulders roll against the hips; the arms are nearly straight as built, so the shoulders only ever come toward
        // the bars, never away: the hands stay on them, below)
        spot.copy(key.wp[b.pelvis]); spot.x += .008 * Math.cos(a); spot.y -= .006 * (.5 + .5 * Math.cos(2 * a)); rig.placePelvis(spot); rig.fk();
        rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Z, .035 * Math.cos(a))); rig.fk(); rig.turnWorld(b.spine_02, turn.setFromAxisAngle(Z, -.03 * Math.cos(a))); rig.fk();
        bend(rig, X, .035 + .025 * (.5 + .5 * Math.cos(2 * a))); rig.turnWorld(b.spine_03, turn.setFromAxisAngle(Y, .02 * Math.cos(a))); rig.fk();
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
        if (rig.classicMotion) {   // (Create's Classic look, room-looks.mjs: the throw as it was before the Nov 17 pass)
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
        const phase = (time / (6.4 + hash(1, seed) * 1.3) + begin) % 1;
        // A long pull, a pause at the rim, then a quicker return to the foot.
        const pull = ss(.08, .67, phase) * (1 - ss(.75, .97, phase));
        const lean = .036 * pull * life;
        for (const [bone, share] of [[b.spine_01, .4], [b.spine_02, .6]]) { rig.turnWorld(bone, turn.setFromAxisAngle(X, lean * share)); rig.fk(); }
        look(.3 * life);
        for (const s of ['l', 'r']) {
            const hand = rig.side[s].arm[3], side = s === 'l' ? 1 : -1;
            handAt.copy(key.wp[hand]);
            handAt.y += (-.031 + (s === 'l' ? .064 : .079) * pull) * life;
            handAt.x += side * (.008 - .014 * pull) * life;
            const wrist = turn.setFromAxisAngle(Z, side * .065 * pull * life).multiply(key.wq[hand]);
            armTo(rig, s, handAt, wrist);
        }
        out.wheel = time * Math.PI * 2 * 1.25 + .32 * Math.sin(phase * Math.PI * 2);
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
// `arms`: the part of the change (0..1) in which the arms go from the one posture to the other, [.22, 1] when not given
// (the workshop film: hands off a shelf before he turns away, a placement's `change.arms`, room-people.mjs).
// `shift`: { x, z, yaw, e } when the model itself moves and turns during the change (metres in the first spot's frame,
// from the first spot to the second, the turn between them in radians, and the share of both done now): each foot stays
// on the floor where it was and then steps (lifted, turned with the step) to where it goes, first the foot on the side
// it turns to (the left when it does not turn: a step back from a desk), instead of sliding or spinning with the model;
// a turn over STEP_TURN in two steps each (or more), round the turn.
// `line`: the hands go straight from where they were to where they go (two-bone reach along the line, the elbows as the
// turns put them), not along the arc the turned shoulders and elbows draw: hands that leave a shelf over a desk come back
// over it instead of swinging down through it (the workshop film, `change.hands: 'line'`).
// (a turn of more than STEP_TURN is stepped in more steps, the feet taking turns, each about STEP_TURN at most)
export const STEP_TURN = THREE.MathUtils.degToRad(60);
const stepsFor = yaw => Math.max(1, Math.ceil(Math.abs(yaw) / STEP_TURN - 1e-9));
export function solveChange(rig, from, to, w, arms0 = null, shift = null, line = false) {
    const b = rig.b, t = clamp01(w), hips = ss(0, .72, t), spine = ss(.08, .82, t), head = ss(.15, .92, t), arms = arms0 ? ss(arms0[0], arms0[1], t) : ss(.22, 1, t);
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
        if (shift) {
            const yaw = shift.yaw || 0, first = yaw >= 0 ? 'l' : 'r', e = shift.e, n = stepsFor(yaw);
            // where it is and where it goes, in the first spot's frame (the second spot's footprint turned and moved there)
            v1.copy(to.wp[foot]).applyAxisAngle(Y, yaw); v1.x += shift.x; v1.z += shift.z;
            if (n === 1) {
                const step = ss(...(s === first ? [.04, .42] : [.36, .76]), t), reach = Math.hypot(v1.x - from.wp[foot].x, v1.z - from.wp[foot].z);
                awayAt.lerpVectors(from.wp[foot], v1, step); awayAt.y += Math.min(.035, reach * .3) * Math.sin(Math.PI * step);
                footQ.slerpQuaternions(from.wq[foot], turn.setFromAxisAngle(Y, yaw).multiply(to.wq[foot]), step);
            } else {
                // a bigger turn (over STEP_TURN) in more steps, the feet taking turns: each step goes to where the foot
                // stands that much further round the turn (the footprint on the arc from the first spot to the second),
                // so a foot is never turned much further than the body above it (storage's turn away from the desk,
                // 108 deg: one step each left the first foot 70-80 deg out from the body)
                const d = .72 / (2 * n), k = s === first ? 0 : 1, at = q => { v2.copy(from.wp[foot]).lerp(to.wp[foot], q).applyAxisAngle(Y, yaw * q); v2.x += shift.x * q; v2.z += shift.z * q; return v2; };
                let done = 0, part = 0;
                for (let i = 0; i < n; i++) { const a = .04 + (2 * i + k) * d, b = a + d * 1.15; if (t >= b) done = i + 1; else if (t > a) { done = i; part = ss(a, b, t); break; } else break; }
                const q0 = done / n, q1 = Math.min(1, (done + 1) / n);
                v3.copy(at(q0)); const there = at(part > 0 ? q1 : q0), reach = Math.hypot(there.x - v3.x, there.z - v3.z);
                awayAt.lerpVectors(v3, there, part); awayAt.y += Math.min(.035, reach * .3) * Math.sin(Math.PI * part);
                const end = turn.setFromAxisAngle(Y, yaw).multiply(to.wq[foot]);
                footQ.slerpQuaternions(from.wq[foot], end, q0); q2.slerpQuaternions(from.wq[foot], end, q1); footQ.slerp(q2, part);
            }
            // into the model's frame now (it has moved e of the way and turned e of the turn)
            awayAt.x -= shift.x * e; awayAt.z -= shift.z * e; awayAt.applyAxisAngle(Y, -yaw * e);
            footQ.premultiply(turn2.setFromAxisAngle(Y, -yaw * e));
            rig.reach(thigh, calf, foot, awayAt); rig.reach(thigh, calf, foot, awayAt); rig.setWorld(foot, footQ);
            continue;
        }
        const window = rising ? (s === 'l' ? [.02, .3] : [.2, .48]) : (s === 'l' ? [.52, .8] : [.7, .98]), step = far < .004 ? hips : ss(window[0], window[1], t);
        awayAt.lerpVectors(from.wp[foot], to.wp[foot], step); awayAt.y += Math.min(.035, far * .3) * Math.sin(Math.PI * step);
        footQ.slerpQuaternions(from.wq[foot], to.wq[foot], step);
        rig.reach(thigh, calf, foot, awayAt); rig.reach(thigh, calf, foot, awayAt); rig.setWorld(foot, footQ);
    }
    rig.fk();
    if (line) {
        const a = arms0 ? ss(arms0[0], arms0[1], t) : ss(.22, 1, t), yaw = shift?.yaw || 0, e = shift?.e || 0;
        for (const s of ['l', 'r']) {
            const [, upper, lower, hand] = rig.side[s].arm;
            // (where it was, carried with the body as it steps; where it goes, in the model's frame now)
            const goes = to.wp[hand].clone(); if (shift) { goes.applyAxisAngle(Y, yaw); goes.x += shift.x * (1 - e); goes.z += shift.z * (1 - e); goes.applyAxisAngle(Y, -yaw * e); }
            const at = from.wp[hand].clone().lerp(goes, a), q = rig.wq[hand].clone();
            rig.reach(upper, lower, hand, at); rig.reach(upper, lower, hand, at); rig.setWorld(hand, q); rig.fk();
        }
    }
    return { model: t < .5 ? 'from' : 'to' };
}

// ---- walking from one spot to another ------------------------------------------------------------------------------
// A walk is planned once (walkPlan) and then posed at any second (solveWalk): pure, so a film frame depends only on
// its time. Footprints are laid along the path first; a foot on the floor stays on its footprint (the hips travel,
// the legs follow by IK), so feet cannot slide. From standing (posture `from`) to standing (`to`; the same posture
// when not given), facing along the path at both ends.
//   path: [[x, z], ...] metres in the room's floor plane (two points or more; corners are walked as given)
//   options: { step: metres (default from the leg length), pace: steps a second (default 1.8), toes: 'bend' (the
//              default: the toes stay flat on the floor while the heel is up) | 'stiff' (the foot pitches whole),
//              sole: [left, right] (metres the drawn soles stand above the floor in the posture: below),
//              heels: [[y, z], [y, z]] (the drawn heels' first contact from the ankles), tilt: [left, right] (radians
//              the drawn soles are toes-down: the landing lifts the toes as much more), land: [left, right] (metres
//              the drawn heels stand off the floor as a foot lands: below), swing: 'path' (solveWalk: the swinging
//              foot follows the path on its own side, not the straight line between footprints; each footprint faces
//              the way the body does while the foot is on it, and the foot pivots on its ball as the heel comes up
//              before it leaves on a turn), startYaw / endYaw
//              (radians, about y, 0 facing +z: the way they face where the walk starts and ends; along the first and
//              last leg when not given) }
// Returns { length, seconds, prints, at(seconds) -> g } where g counts steps (the gait clock).
// A walk starts and ends standing: a built walking posture (`walk`, mid-stride, feet pitched, hips low: the film's
// walkers are cast in it for its model, a backpack on some) is taken as the character's standing-by posture
// (walkStance), so the gait is laid out from feet flat on the floor (S19, Nov 14: walks from the mid-stride posture
// sank the front foot 30-69 mm into the floor, floated the back one, crouched and marched).
const WALKING = new Set(['walk']);
export const TURN_RATE = 115;      // degrees a second a walker's body turns at most (chingon: 120 near the lens)
export function walkStance(rig, key) {
    if (!key || !WALKING.has(key.pose)) return key;
    const id = [`people-${rig.character}-stand-wait`, `people-${rig.character}-kid-stand-wait`].find(i => rig.has(i));
    return id ? rig.key(id, key.dz || 0) : key;
}
// The drawn shoes, from points of the skinned model in the model's frame with the rig posed as the walk starts (solveWalk
// at 0): points [[x, y, z, side 0 left | 1 right], ...] (room-people.mjs walkAlong; the tests from the GLBs). Returns
// walkPlan's options: sole (how far each sole stands above the floor), tilt (how far the sole is toes-down, radians)
// and heels (the point behind the ankle that meets the floor first as that foot lands, toes up GAIT.land + tilt).
export function shoeFit(rig, points) {
    const sole = [Infinity, Infinity], heels = [null, null], tilt = [0, 0], ankles = ['l', 'r'].map(s => rig.wp[rig.side[s].leg[2]]);
    const heel = [null, null], toe = [null, null];
    for (const [x, y, z, k] of points) {
        if (!(k === 0 || k === 1) || y > .12) continue; const dz = z - ankles[k].z;
        if (y < sole[k]) sole[k] = y;
        if (dz < -.02 && (!heel[k] || y < heel[k][0])) heel[k] = [y, dz];
        if (dz > .04 && (!toe[k] || y < toe[k][0])) toe[k] = [y, dz];
    }
    for (const k of [0, 1]) {
        if (heel[k] && toe[k]) tilt[k] = THREE.MathUtils.clamp(Math.atan2(heel[k][0] - toe[k][0], toe[k][1] - heel[k][1]), 0, .35);
        const a = ankles[k], c = Math.cos(GAIT.land + tilt[k]), s = Math.sin(GAIT.land + tilt[k]); let best = Infinity;
        for (const [x, y, z, side] of points) {
            if (side !== k || y > .12) continue; const dy = y - a.y, dz = z - a.z; if (dz >= 0) continue;      // (behind the ankle: a heel)
            const up = dy * c + dz * s; if (up < best) { best = up; heels[k] = [dy, dz]; }
        }
    }
    return { sole: sole.map(v => Number.isFinite(v) ? v : 0), tilt, heels };
}
const hermite = (p0, p1, m0, m1, t) => { const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1; };
export function walkPlan(rig, from, to, path, options = {}) {
    const shoulderStrap = from.id === 'people-yara-walk';
    from = walkStance(rig, from); to = walkStance(rig, to || from);
    const points = path.map(([x, z]) => new THREE.Vector2(x, z)), legs = [], L = rig.side.l, R = rig.side.r;
    let length = 0; for (let i = 1; i < points.length; i++) { const d = points[i].distanceTo(points[i - 1]); legs.push({ a: points[i - 1], b: points[i], s0: length, d }); length += d; }
    // where the path is and which way it heads at a distance along it (yaw about y: 0 faces +z)
    const along = s => { const leg = legs.find(l => s <= l.s0 + l.d) || legs[legs.length - 1], t = leg.d > 0 ? clamp01((s - leg.s0) / leg.d) : 0; return { x: lerp(leg.a.x, leg.b.x, t), z: lerp(leg.a.y, leg.b.y, t), yaw: Math.atan2(leg.b.x - leg.a.x, leg.b.y - leg.a.y) }; };
    // the heading turns over 0.35 m either side of a corner, not at once
    const curve = s => { const a = along(Math.max(0, s - .35)), b = along(Math.min(length, s + .35)); return Math.hypot(b.x - a.x, b.z - a.z) > 1e-6 ? Math.atan2(b.x - a.x, b.z - a.z) : a.yaw; };
    // (at the two ends exactly the way asked: options.startYaw / endYaw, radians, or along the first and the last leg,
    // reached over up to 0.6 m (half the path at most): a short last leg, or a placement that stands turned from the
    // path, is faced in full when the walk ends, not snapped to at the next change)
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), yawOf = l => l ? Math.atan2(l.b.x - l.a.x, l.b.y - l.a.y) : 0;
    const startYaw = Number.isFinite(options.startYaw) ? options.startYaw : yawOf(legs.find(l => l.d > 1e-6)), endYaw = Number.isFinite(options.endYaw) ? options.endYaw : yawOf([...legs].reverse().find(l => l.d > 1e-6)), span = Math.max(1e-3, Math.min(.6, length / 2));
    const heading = options.gradualTurn
        ? s => startYaw + wrap(endYaw - startYaw) * ss(0, Math.max(1e-3, length), s)
        : s => { let h = curve(s); h += wrap(endYaw - h) * ss(length - span, length, s); h += wrap(startYaw - h) * (1 - ss(0, span, s)); return h; };
    const leg = rig.offset[L.leg[1]].length() + rig.offset[L.leg[2]].length(), want = options.step || leg * .64, strides = Math.max(1, Math.round(length / want)), step = length / strides;
    // footprints: where each ankle is while that foot is on the floor. Both feet start in `from` and end in `to`.
    // (options.sole: [left, right] metres the drawn model's soles are above the floor with the feet flat where the
    // posture puts the ankles: the model of another posture, skinned to this one, room-people.mjs walkAlong; the
    // footprints are that much lower, so the shoes stand on the floor, not a few millimetres over it)
    const sole = Array.isArray(options.sole) ? options.sole.map(v => Number.isFinite(v) ? THREE.MathUtils.clamp(v, -.03, .03) : 0) : [0, 0], drop = foot => foot === L.leg[2] ? sole[0] : sole[1];
    const place = (key, foot, s) => { const at = along(s), yaw = heading(s), p = key.wp[foot], c = Math.cos(yaw), sn = Math.sin(yaw); return { x: at.x + p.x * c + p.z * sn, z: at.z - p.x * sn + p.z * c, y: p.y - drop(foot), yaw, s }; };
    // (walking, the feet go nearer the line of travel than they stand: a step width of about the hip joints' spacing
    // times 0.6, 0.10-0.12 m between the ankles, not the stance's 0.23 m, which waddles)
    const hipX = (Math.abs(from.wp[L.leg[0]].x) + Math.abs(from.wp[R.leg[0]].x)) / 2;
    const side = (foot, s) => { const at = along(s), yaw = heading(s), mid = (from.wp[foot].x + to.wp[foot].x) / 2, w = Math.sign(mid) * Math.min(Math.abs(mid) * .8, hipX * .6), c = Math.cos(yaw), sn = Math.sin(yaw); return { x: at.x + w * c, z: at.z - w * sn, y: Math.min(from.wp[foot].y, to.wp[foot].y) - drop(foot), yaw, s }; };
    const feet = [L.leg[2], R.leg[2]], prints = [[place(from, feet[0], 0)], [place(from, feet[1], 0)]], steps = [], knots = [[0, 0]];
    // step j (from 1) lands half a step, then whole steps further on; the last two bring both feet to the end
    for (let j = 1; j <= strides + 2; j++) {
        const which = (j + 1) % 2, list = prints[which], s = j <= strides ? (j - .5) * step : length;
        const print = j <= strides ? side(feet[which], s) : place(to, feet[which], length);
        // the hips: over (a little ahead of) the standing foot in the middle of each step
        const stance = prints[1 - which][prints[1 - which].length - 1]; knots.push([j - .5, Math.min(length, Math.max(0, stance.s + step * .12))]);
        steps.push({ which, from: list[list.length - 1], to: print, g0: j - 1 + .1, g1: j - .1 }); list.push(print);
    }
    knots.push([steps.length, length]);
    for (let i = 1; i < knots.length; i++) knots[i][1] = Math.max(knots[i][1], knots[i - 1][1]);
    const slope = i => i <= 0 || i >= knots.length - 1 ? 0 : (knots[i + 1][1] - knots[i - 1][1]) / (knots[i + 1][0] - knots[i - 1][0]);
    const travel = g => { g = Math.min(steps.length, Math.max(0, g)); let i = 1; while (i < knots.length - 1 && g > knots[i][0]) i++; const [g0, s0] = knots[i - 1], [g1, s1] = knots[i], h = g1 - g0; return Math.min(s1, Math.max(s0, hermite(s0, s1, slope(i - 1) * h, slope(i) * h, (g - g0) / h))); };
    const pace = options.pace || 1.8;
    // (options.heels: [[y, z], [y, z]] metres from each ankle to the point of the drawn shoe's heel that meets the floor
    // first when the toes are up, as room-people.mjs measures it; without: the floor 5 cm behind the ankle)
    const heels = [0, 1].map(i => { const h = options.heels?.[i]; return Array.isArray(h) && h.length === 2 && h.every(Number.isFinite) ? new THREE.Vector3(0, h[0], h[1]) : new THREE.Vector3(0, -from.wp[i ? R.leg[2] : L.leg[2]].y, -.05); });
    // (options.land: [left, right] metres the drawn heel still stands above the floor as the foot lands, the toes up
    // GAIT.land: the shoe's heel is skinned partly to the shin, so it does not turn with the foot; measured by
    // room-people.mjs as well, and taken off the ankle's height in proportion as the toes are up)
    const land = [0, 1].map(i => Number.isFinite(options.land?.[i]) ? THREE.MathUtils.clamp(options.land[i], -.03, .04) : 0);
    // (options.tilt: [left, right] radians the drawn sole is toes-down with the foot as the posture has it, shoeFit)
    const tilt = [0, 1].map(i => Number.isFinite(options.tilt?.[i]) ? THREE.MathUtils.clamp(options.tilt[i], 0, .35) : 0);
    // (the way the body faces, by the clock: the path's heading where the walker is, turning at most TURN_RATE degrees a
    // second, chingon's rule for people near the lens (the two-tap shutter doubles a fast turn); the two ends kept
    // exactly. A walk too short for its turn at that rate turns as fast as it must: plan.turnRate says how fast.)
    const total = steps.length, n = Math.max(2, Math.ceil(total / pace * 60) + 1), dt = total / pace / (n - 1), raw = new Float64Array(n);      // (about 60 a second, the last at the end)
    for (let i = 0; i < n; i++) { const h = heading(travel(Math.min(total, i * dt * pace))); raw[i] = i ? raw[i - 1] + wrap(h - raw[i - 1]) : h; }
    const most = THREE.MathUtils.degToRad(TURN_RATE) * dt, fastest = a => { let m = 0; for (let i = 1; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - a[i - 1])); return m; };
    // (no faster than `most` a frame both ways round, which keeps the two ends; then softened, which keeps the limit)
    // (both ends exact: when the turn does not fit at that rate, the cap rises until it does, and turnRate says so)
    const body = Float64Array.from(raw);
    for (let cap = most * .9; ; cap *= 1.1) {
        const step1 = (x, to) => x + THREE.MathUtils.clamp(to - x, -cap, cap);
        body[0] = raw[0]; for (let i = 1; i < n; i++) body[i] = step1(body[i - 1], raw[i]);
        body[n - 1] = raw[n - 1]; for (let i = n - 2; i >= 0; i--) body[i] = step1(body[i + 1], body[i]);
        if (Math.abs(body[0] - raw[0]) < 1e-6 || cap > Math.PI) break;
    }
    for (let pass = 0; pass < 6; pass++) { const prev = Float64Array.from(body); for (let i = 1; i < n - 1; i++) { const r = Math.min(3, i, n - 1 - i); let sum = 0; for (let k = -r; k <= r; k++) sum += prev[i + k]; body[i] = sum / (2 * r + 1); } }
    const bodyYaw = g => { const x = Math.min(n - 1, Math.max(0, g / pace / dt)), i = Math.min(n - 2, Math.floor(x)); return lerp(body[i], body[i + 1], x - i); };
    // (options.swing === 'path': each footprint also as where it stands from the path, { s, f: metres ahead, w: metres to
    // the left, at heading(s) }: solveWalk carries a swinging foot along the path that way, see there)
    const swing = options.swing === 'path';
    if (swing) for (const list of prints) for (const p of list) { const at = along(p.s), h = heading(p.s), dx = p.x - at.x, dz = p.z - at.z; p.f = dx * Math.sin(h) + dz * Math.cos(h); p.w = dx * Math.cos(h) - dz * Math.sin(h); }
    // (and, with it, each footprint of the stride faces the way the body faces, on average, while that foot is on it:
    // from its landing to the next lift. Laid along the path's heading instead, on a turn a footprint faces where the
    // path goes half a stride on, while the body, turning at most TURN_RATE, has not got round yet: storage's Andre
    // planted feet up to 80 deg out from his body. The two footprints of each end stay as the postures there have them.)
    if (swing) for (let i = 0; i < strides; i++) {
        const st = steps[i], lift = steps.find(x => x.which === st.which && x.g0 >= st.g1), g0 = st.g1, g1 = lift ? lift.g0 : steps.length;
        let sx = 0, sz = 0; for (let k = 0; k <= 8; k++) { const y = bodyYaw(g0 + (g1 - g0) * k / 8); sx += Math.sin(y); sz += Math.cos(y); }
        const y = Math.atan2(sx, sz); st.to.yaw = st.to.yaw + wrap(y - st.to.yaw);
    }
    return { length, step, steps, prints, along, heading, travel, bodyYaw, shoulderStrap, turnRate: THREE.MathUtils.radToDeg(fastest(body) / dt), from, to, pace, heels, land, tilt, toes: options.toes !== 'stiff', swing, seconds: steps.length / pace, at: seconds => clamp01(seconds * pace / steps.length) * steps.length };
}
// The pose at gait clock g (plan.at(seconds)): rig.lq / rig.lp in the model's frame. Returns where the model stands:
// { x, z, yaw } (metres, radians; the room's frame).
// The gait (S19, Nov 14, measured against people walking at 0.8-1.4 m/s): the hips as high as the legs on the floor let
// them be with the knee GAIT.knee degrees bent (about 10 at mid-stance; lower with both feet down, the bob of 20-40 mm
// coming from the step itself), never so high that a planted leg cannot reach its footprint; the heel comes up GAIT.heel
// radians over the ball before the foot leaves, the toes flat on the floor (plan.toes); the swinging foot clears the
// floor by GAIT.clear metres at heel and ball; the trunk GAIT.trunk degrees forward of upright; the eyes on the floor
// a few metres ahead.
const PIVOT = .6;      // (plan.swing: how far round a foot pivots on its ball before it leaves the floor)
const GAIT = { knee: 10, hard: 1, heel: .7, land: .2, clear: .024, swing: .05, trunk: 3, arm: 2, elbow: 22 };
const pivot = V(), rootAt = { x: 0, z: 0, yaw: 0 }, aims = [V(), V()], aimQ = [Q(), Q()], offA = V(), offB = V(), lookAt = V();
const bends = [0, 0], contacts = [0, 0], faces = [0, 0];
const kneeSpan = (a, b, deg) => Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(THREE.MathUtils.degToRad(deg)));      // hip to ankle with the knee bent so
const smin = (a, b, k) => { if (k <= 1e-6) return Math.min(a, b); const h = clamp01(.5 + .5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
const softPos = (x, k = .22) => .5 * (x + Math.sqrt(x * x + k * k));
export function solveWalk(rig, plan, g) {
    const { steps, from, to } = plan, b = rig.b, total = steps.length, s = plan.travel(g), at = plan.along(s), yaw = plan.bodyYaw ? plan.bodyYaw(g) : plan.heading(s), c = Math.cos(yaw), sn = Math.sin(yaw);
    const blend = ss(0, 1, g / total), walking = ss(0, .8, g) * (1 - ss(total - .9, total, g));      // how much of the walk's own carriage is in the pose
    faceOf(rig);      // (before the pose: reading a posture loads it; a walker who looks at someone, room-people.mjs, needs it after)
    for (let i = 0; i < rig.n; i++) rig.lq[i].slerpQuaternions(from.q[i], to.q[i], blend);
    rig.lp[b.Root].lerpVectors(from.root, to.root, blend);
    const phase = g - Math.floor(g), odd = Math.floor(g) % 2 === 0 ? 1 : -1;      // odd: +1 while the left foot steps
    // ---- the feet first (they do not depend on the hips): a foot on the floor stays on its footprint; the other goes
    // heel-off, through, heel-first to the next
    for (const [which, s2] of [[0, 'l'], [1, 'r']]) {
        const [, , foot, ball] = rig.side[s2].leg, list = plan.prints[which];
        let print = list[0], next = null, air = 0, swing = null; for (const st of steps) { if (st.which !== which) continue; if (g >= st.g1) print = st.to; else if (g > st.g0) { print = st.from; next = st.to; air = (g - st.g0) / (st.g1 - st.g0); swing = st; } }
        // heel-off before the foot leaves: the ankle rises over the ball of the foot while the hips go on ahead
        const coming = steps.find(st => st.which === which && st.g0 >= g), lift = coming && coming.from === print ? ss(coming.g0 - .62, coming.g0, g) * walking : 0;
        // (the toes up as the foot lands: GAIT.land, more for a shoe the posture has toes-down, plan.tilt, so it lands on the heel)
        const landing = GAIT.land + (plan.tilt?.[which] || 0);
        let x = print.x, z = print.z, y = print.y, face = print.yaw, pitch = lift * GAIT.heel, floor = print.y;
        // (plan.swing: on a turn the foot pivots on its ball as the heel comes up, PIVOT of the way round to where the body
        // faces as it leaves the floor, and sets off from there: the foot on the floor not left behind the turning body)
        const pivotBy = st => plan.swing && st ? PIVOT * wrapAngle(plan.bodyYaw(st.g0) - print.yaw) * ss(0, .8, st.g0) * (1 - ss(total - .9, total, st.g0)) : 0;
        const pivotAt = d => { offA.copy(from.wp[foot]).sub(from.wp[ball]); offA.y = 0; v2.copy(offA).applyAxisAngle(Y, print.yaw + d).sub(offA.applyAxisAngle(Y, print.yaw)); return v2; };
        if (!next && lift > 0 && plan.swing) { const d = pivotBy(coming) * ss(coming.g0 - .62, coming.g0, g); if (Math.abs(d) > 1e-6) { const o = pivotAt(d); x += o.x; z += o.z; face += d; } }
        if (next) {
            // Cosine ease: lower peak acceleration than cubic/quintic, smooth liftoff and landing without mid-swing whip
            const e = .5 - .5 * Math.cos(Math.PI * air), far = Math.hypot(next.x - print.x, next.z - print.z);
            x = lerp(print.x, next.x, e); z = lerp(print.z, next.z, e); floor = lerp(print.y, next.y, e); y = floor + .006 * Math.sin(Math.PI * air);
            // (plan.swing, walk `swing: 'path'`: the foot goes along the path on its own side of it, as far ahead and to the
            // side of where the path is then as it stood at both footprints, not on the straight line between them: on a
            // tight turn the straight line runs inside the other foot and the legs cross (storage's Andre, Nov 17). The
            // same at both footprints and on a straight path.)
            if (plan.swing && Number.isFinite(print.f) && Number.isFinite(next.f)) {
                const ps = lerp(print.s, next.s, e), on = plan.along(ps), h = plan.heading(ps), f = lerp(print.f, next.f, e), w = lerp(print.w, next.w, e);
                x = on.x + f * Math.sin(h) + w * Math.cos(h); z = on.z + f * Math.cos(h) - w * Math.sin(h);
            }
            // Smooth skewed swing arch across [0, 1] (no hard slope break at air = 0.6): early knee fold (~55-62 deg), gentle descent
            y += GAIT.swing * walking * clamp01(far / .6) * Math.sin(Math.PI * Math.pow(air, .75)) ** 1.4;
            face = print.yaw + (THREE.MathUtils.euclideanModulo(next.yaw - print.yaw + Math.PI, Math.PI * 2) - Math.PI) * e;
            const d0 = pivotBy(swing); if (Math.abs(d0) > 1e-6) { const o = pivotAt(d0); x += o.x * (1 - e); z += o.z * (1 - e); face = print.yaw + d0 + wrapAngle(next.yaw - print.yaw - d0) * e; }
            pitch = lerp(GAIT.heel * walking, -landing * walking * clamp01(far / .3), ss(.08, .88, air));
        } else { const landed = steps.filter(st => st.which === which && st.to === print).pop(); if (landed) pitch += -landing * walking * (1 - ss(landed.g1, landed.g1 + .18, g)) * clamp01(Math.hypot(landed.to.x - landed.from.x, landed.to.z - landed.from.z) / .3); }
        // pitched about the ball (heel up) or the heel (toes up): on the floor the contact point stays put;
        // in the air blend smoothly from the ball-pivot at toe-off to the heel-pivot at landing so there is no mid-swing lever flip
        const heelOff = offB.copy(plan.heels?.[which] || offB.set(0, -from.wp[foot].y, -.05));      // (the heel's floor point from the ankle)
        if (Math.abs(pitch) > 1e-5) {
            const addPivot = (pv, w) => { if (w <= 1e-6) return; v1.copy(pv).applyQuaternion(turn.setFromAxisAngle(X, pitch)).sub(pv).applyQuaternion(turn2.setFromAxisAngle(Y, face)); x += v1.x * w; y += v1.y * w; z += v1.z * w; };
            if (!next) {
                if (pitch > 0) addPivot(pivot.copy(from.wp[foot]).sub(from.wp[ball]), 1);
                else addPivot(pivot.copy(heelOff).negate(), 1);
            } else {
                if (pitch > 0) addPivot(pivot.copy(from.wp[foot]).sub(from.wp[ball]), 1 - ss(0, .55, air));
                else addPivot(pivot.copy(heelOff).negate(), ss(.45, 1, air));
            }
        }
        if (pitch < 0 && plan.land) y -= plan.land[which] * clamp01(-pitch / landing);
        // in the air the heel and the ball (the toes, flat with it) keep clear of the floor smoothly
        if (next) {
            const want = GAIT.clear * walking * ss(.06, .3, air) * (1 - ss(.72, .97, air)), r = turn.setFromAxisAngle(X, pitch);
            offA.copy(from.wp[ball]).sub(from.wp[foot]);
            const ballUp = y + v2.copy(offA).applyQuaternion(r).y - (floor + offA.y), heelUp = y + v2.copy(heelOff).applyQuaternion(r).y - (floor + heelOff.y);
            y += smax(0, want - smin(ballUp, heelUp, .006), .006);
        }
        // into the model's frame (it stands at the hips' place on the path, facing along it)
        const dx = x - at.x, dz = z - at.z; aims[which].set(dx * c - dz * sn, y, dx * sn + dz * c);
        footQ.slerpQuaternions(from.wq[foot], to.wq[foot], blend); aimQ[which].copy(turn.setFromAxisAngle(Y, face - yaw)).multiply(turn2.setFromAxisAngle(X, pitch)).multiply(footQ);
        faces[which] = face - yaw;
        bends[which] = plan.toes && pitch > 0 ? (next ? 1 - ss(.15, .5, air) : 1) : 0;
        contacts[which] = next ? ss(.35, 1, air) : 1 - .45 * lift;      // (smooth weight acceptance without a mid-stance pop)
    }
    // ---- hips: natural inverted-pendulum bob + lateral weight shift over the standing leg, turned with the stride
    const lateral = -.022 * walking * odd * Math.sin(phase * Math.PI), thighA = rig.offset[rig.side.l.leg[1]].length(), shinA = rig.offset[rig.side.l.leg[2]].length();
    spot.lerpVectors(from.wp[b.pelvis], to.wp[b.pelvis], blend); spot.x += lateral; spot.z += .01 * walking;
    rig.placePelvis(spot); rig.fk();
    const stride = Math.sin(phase * Math.PI) * odd * walking;      // + while the left leg swings forward
    rig.turnWorld(b.pelvis, turn.setFromAxisAngle(Y, .08 * Math.cos(phase * Math.PI) * odd * walking).multiply(turn2.setFromAxisAngle(Z, -.038 * stride))); rig.fk();
    // smooth inverted-pendulum target bob (lowest at double-support phase ~ 0/1, highest at mid-stance phase ~ 0.5),
    // smoothly blended with knee-bend and reach constraints so the pelvis never drops or bounces in a single frame
    let soft = -.012 - .010 * Math.cos(2 * Math.PI * phase), hard = Infinity;
    for (const [which, s2] of [[0, 'l'], [1, 'r']]) {
        const hip = rig.wp[rig.side[s2].leg[0]], A = aims[which], h2 = (A.x - hip.x) ** 2 + (A.z - hip.z) ** 2, rise = deg => A.y + Math.sqrt(Math.max(0, kneeSpan(thighA, shinA, deg) ** 2 - h2)) - hip.y;
        soft = smin(soft, rise(GAIT.knee) + (1 - contacts[which]) * .12, .016); hard = Math.min(hard, rise(GAIT.hard * walking));      // (straight as built where the walk has not begun)
    }
    const lift = smin(walking * soft, hard, .006 * walking);
    if (Math.abs(lift) > 1e-7) { spot.y += lift; rig.placePelvis(spot); rig.fk(); }
    rig.turnWorld(b.spine_03, turn.setFromAxisAngle(Y, -.12 * Math.cos(phase * Math.PI) * odd * walking).multiply(turn2.setFromAxisAngle(Z, .034 * stride))); rig.fk();
    if (walking > 0) {
        // the trunk upright over the hips (GAIT.trunk forward), whatever the postures at the ends lean
        const tr = v4.copy(rig.wp[b.neck_01]).sub(rig.wp[b.pelvis]), lean = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(GAIT.trunk) - Math.atan2(tr.z, tr.y), -.2, .2) * walking;
        for (const [bone, share] of [[b.spine_01, .5], [b.spine_02, .5]]) { rig.turnWorld(bone, turn.setFromAxisAngle(X, lean * share)); rig.fk(); }
        // and the eyes ahead, on the floor three metres on (not on a desktop, as someone standing by has them)
        lookAt.copy(rig.wp[b.head]); lookAt.y -= .45; lookAt.z += 3; lookToward(rig, lookAt, .8 * walking, true);      // (up or down only: a turn of the head as the walk ends would be a fast one)
    }
    rig.turnWorld(b.head, turn.setFromAxisAngle(Y, .04 * Math.cos(phase * Math.PI) * odd * walking)); rig.fk();
    // ---- legs to the feet
    for (const [which, s2] of [[0, 'l'], [1, 'r']]) {
        const [thigh, calf, foot, ball] = rig.side[s2].leg;
        rig.reach(thigh, calf, foot, aims[which]); rig.reach(thigh, calf, foot, aims[which]); rig.setWorld(foot, aimQ[which]);
        // (plan.toes: the toes bend at the ball while the heel is up, flat on the floor instead of through it, until the
        // foot is well off the floor)
        if (bends[which] > 0) { rig.fk(); footQ.slerpQuaternions(from.wq[ball], to.wq[ball], blend).premultiply(turn.setFromAxisAngle(Y, faces[which])); rig.setWorld(ball, tq.slerpQuaternions(rig.wq[ball], footQ, bends[which])); }
    }
    rig.fk();
    // arms swing against the legs from the shoulder, the elbow giving smoothly with a slight pendulum lag on the way
    // forward (C-infinity softplus instead of hard max(0, forward), eliminating half-stride elbow kinks)
    for (const s2 of ['l', 'r']) {
        const [, upper, lower] = rig.side[s2].arm, sign = s2 === 'l' ? 1 : -1;
        const forward = sign * Math.cos(g * Math.PI) * walking, lag = sign * Math.cos((g - .06) * Math.PI) * walking;
        const d = v4.copy(rig.wp[lower]).sub(rig.wp[upper]), hang = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(GAIT.arm) - Math.atan2(d.z, -d.y), -.4, .4) * walking;
        // (behind the hips the arm swings a little less and a little out, past the hip and a backpack's strap)
        const ak = .22 * walking, fwd = softPos(forward, ak), back = softPos(-forward, ak);
        rig.turnWorld(upper, turn.setFromAxisAngle(X, -.26 * fwd + .2 * back - hang).premultiply(turn2.setFromAxisAngle(Z, sign * .06 * back))); rig.fk();
        // the elbow loose: about GAIT.elbow degrees, more on the way forward with gentle pendulum follow-through
        const hand = rig.side[s2].arm[3], bend = v4.copy(rig.wp[lower]).sub(rig.wp[upper]).angleTo(v5.copy(rig.wp[hand]).sub(rig.wp[lower]));
        rig.turnWorld(lower, turn.setFromAxisAngle(X, -(THREE.MathUtils.degToRad(GAIT.elbow + 16 * softPos(lag, ak)) - bend) * walking)); rig.fk();
    }
    if (plan.shoulderStrap) {
        // As she sets off, she lifts her right hand toward the shoulder strap,
        // settles the load, then lets both arms swing freely for the walk.
        const gather = ss(.02, .82, g) * (1 - ss(1.12, 1.98, g)) * walking;
        if (gather > 0) {
            const shoulder = rig.side.r.arm[1], hand = rig.side.r.arm[3];
            const across = v4.copy(rig.wp[rig.side.l.arm[1]]).sub(rig.wp[shoulder]).normalize();
            const up = v5.copy(rig.wp[b.neck_01]).sub(rig.wp[b.spine_02]).normalize();
            const front = v6.crossVectors(across, up).normalize();
            bodyAt.copy(rig.wp[shoulder]).addScaledVector(across, .025).addScaledVector(up, -.15).addScaledVector(front, .16);
            handAt.copy(rig.wp[hand]).lerp(bodyAt, gather);
            // Keep the elbow on the outside of the sweater. IK from the relaxed
            // walking arm alone can fold the elbow through the ribs on the turn.
            const elbowPole = dir.copy(across).negate().addScaledVector(up, -2.4);
            const alongStrap = awayAt.copy(up).addScaledVector(front, -.21).addScaledVector(across, .10).normalize();
            armTo(rig, 'r', handAt);
            const axis = v1.copy(rig.wp[hand]).sub(rig.wp[shoulder]).normalize();
            const elbow = rig.side.r.arm[2];
            const bend = v2.copy(rig.wp[elbow]).sub(rig.wp[shoulder]).projectOnPlane(axis).normalize();
            elbowPole.projectOnPlane(axis).normalize();
            const swivel = Math.atan2(axis.dot(v3.crossVectors(bend, elbowPole)), bend.dot(elbowPole));
            rig.turnWorld(shoulder, turn.setFromAxisAngle(axis, swivel * gather)); rig.fk();
            // The fingers lie along the webbing as the hand arrives.
            const knuckle = rig.index.get('middle_01_r');
            const fingers = v1.copy(rig.wp[knuckle]).sub(rig.wp[hand]).normalize();
            turn.setFromUnitVectors(fingers, alongStrap);
            rig.turnWorld(hand, turn2.identity().slerp(turn, gather)); rig.fk();
        }
    }
    rig.fk();
    rootAt.x = at.x; rootAt.z = at.z; rootAt.yaw = yaw; return rootAt;
}

// ---- rolling in a wheelchair along a path --------------------------------------------------------------------------
// A roll is planned once (rollPlan) and then read at any second: pure, so a film frame depends only on its time. The
// chair glides along the path with its corners rounded (arcs of up to `radius` metres, smaller where the legs are
// short), sets off and comes to rest smoothly (its speed eases up and down over `ease` seconds), and faces along the
// path at every point, so it ends facing along the last leg. The rear wheels turn with the distance each of them rolls
// (the outer one further in a turn), and each comes to rest on a whole number of eighths of a turn: the spokes (16,
// laced in pairs: tools/people/held.py wheelchair) then stand as in a model built at rest, so a still model of the
// same chair can take over without the wheels jumping. The hands push on the handrims in time with the wheels: a push
// every `stroke` metres, the hand moving with the rim while it grips it (pushRims).
//   path: [[x, z], ...] metres in the room's floor plane, two points or more
//   options: { speed: m/s (default .8), ease: seconds to set off and to stop (1.2), radius: corner radius m (.45),
//              wheel: rear wheel radius m (.3), track: m from the chair's middle to each rear wheel (.27),
//              stroke: m rolled per push (.75), coast: m rolled at the end without a new push (.6) }
// Returns { length, seconds, end: { x, z, yaw }, at(seconds) -> { x, z, yaw, s, v, wheel: { l, r } (radians each has
// turned, + rolling forward), push: { l: { turn, lift }, r, grip, bend } } } (yaw about y: 0 faces +z, as walkPlan;
// grip: the hands are on the rims; bend: radians the trunk leans forward).
export const WHEEL_AXLE = { y: .3, z: -.07, x: .27 };      // the rear axle in the model's frame (held.py wheelchair: r .3, axle .07 behind the pelvis)
// The push: radians about the axle from the built grip (it takes hold PUSH_FROM behind it and lets go PUSH_ARC
// further on), metres off the rim on the way back. The built postures have the arms nearly straight down to the rims,
// so the trunk leans in with the hands (LEAN + LEAN_TURN per radian forward, while the chair is under way): measured on
// Kai, the wrist then stays within its reach from 0.2 rad behind the grip to 0.4 ahead of it.
const PUSH_FROM = -.2, PUSH_ARC = .6, PUSH_LIFT = .04, PUSH_OUT = .025, LEAN = .25, LEAN_TURN = .4, LEAN_MAX = .45;
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export function rollPlan(path, options = {}) {
    const speed0 = options.speed ?? .8, ease = Math.max(.05, options.ease ?? 1.2), R = options.radius ?? .45, wheelR = options.wheel ?? .3, track = options.track ?? WHEEL_AXLE.x;
    const stroke = options.stroke ?? .75, coast = options.coast ?? .6;
    const P = path.map(([x, z]) => ({ x, z })).filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 1e-6);
    if (P.length < 2) { const p = P[0] || { x: 0, z: 0 }; P.push({ x: p.x, z: p.z + 1e-6 }); }
    // the path as a dense polyline: straight runs, and circular arcs where it turns (tangent lengths at most half of
    // either leg, so neighbouring corners never overlap)
    const tight = [], dense = [P[0]], seg = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .01)); for (let i = 1; i <= n; i++) dense.push({ x: lerp(a.x, b.x, i / n), z: lerp(a.z, b.z, i / n) }); };
    let from = P[0];
    for (let i = 1; i < P.length - 1; i++) {
        const a = P[i - 1], c = P[i], b = P[i + 1], l1 = Math.hypot(c.x - a.x, c.z - a.z), l2 = Math.hypot(b.x - c.x, b.z - c.z);
        const d1 = { x: (c.x - a.x) / l1, z: (c.z - a.z) / l1 }, d2 = { x: (b.x - c.x) / l2, z: (b.z - c.z) / l2 }, cross = d1.x * d2.z - d1.z * d2.x, turn = Math.acos(THREE.MathUtils.clamp(d1.x * d2.x + d1.z * d2.z, -1, 1));
        if (turn < 1e-4 || turn > Math.PI - 1e-3) { seg(from, c); from = c; continue; }
        const tl = Math.min(R * Math.tan(turn / 2), l1 / 2, l2 / 2), r = tl / Math.tan(turn / 2), sign = cross < 0 ? -1 : 1;
        if (r < R * .9) tight.push({ corner: i, radius: R, fits: r });      // (a leg too short for the radius asked: the turn is tighter; plan.tight)
        // (the centre is on the inside of the turn, r from where the arc leaves the first leg)
        const A = { x: c.x - d1.x * tl, z: c.z - d1.z * tl }, B = { x: c.x + d2.x * tl, z: c.z + d2.z * tl }, n = { x: -sign * d1.z, z: sign * d1.x }, C = { x: A.x + n.x * r, z: A.z + n.z * r };
        seg(from, A);
        const a0 = Math.atan2(A.z - C.z, A.x - C.x), da = wrapAngle(Math.atan2(B.z - C.z, B.x - C.x) - a0), steps = Math.max(2, Math.ceil(Math.abs(da) * r / .01));
        for (let k = 1; k <= steps; k++) { const ang = a0 + da * k / steps; dense.push({ x: C.x + r * Math.cos(ang), z: C.z + r * Math.sin(ang) }); }
        from = B;
    }
    seg(from, P[P.length - 1]);
    // distance along it and the heading, unwrapped (a left turn adds: yaw grows as the way ahead swings to the left)
    const S = new Float64Array(dense.length), H = new Float64Array(dense.length);
    for (let i = 1; i < dense.length; i++) S[i] = S[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z);
    for (let i = 0; i < dense.length; i++) { const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)], h = Math.atan2(b.x - a.x, b.z - a.z); H[i] = i ? H[i - 1] + wrapAngle(h - H[i - 1]) : h; }
    const length = S[S.length - 1];
    const along = s => {
        s = Math.min(length, Math.max(0, s)); let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
        const f = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0; return { x: lerp(dense[lo].x, dense[hi].x, f), z: lerp(dense[lo].z, dense[hi].z, f), heading: lerp(H[lo], H[hi], f) };
    };
    // the speed: up over `ease` seconds (smoothstep), steady, down over `ease` seconds; a short path never reaches `speed0`
    const v = Math.min(speed0, length / ease), seconds = length / v + ease;
    const ramp = u => u * u * u - u * u * u * u / 2;      // (the integral of smoothstep from 0 to u)
    const travel = t => { t = Math.min(seconds, Math.max(0, t)); if (t < ease) return v * ease * ramp(t / ease); if (t > seconds - ease) return length - v * ease * ramp((seconds - t) / ease); return v * ease / 2 + v * (t - ease); };
    const speedAt = t => t <= 0 || t >= seconds ? 0 : v * Math.min(ss(0, 1, t / ease), ss(0, 1, (seconds - t) / ease));
    // the wheels: the distance each rolls, scaled (by under 2 % on a path of a few metres) so each ends on an eighth of a turn
    const turned = (s, side) => { const d = along(s).heading - H[0]; return (s - (side === 'l' ? 1 : -1) * track * d) / wheelR; };
    // (a wheel that would turn less than half an eighth comes to rest where it was: it does not turn, rather than spin)
    const eighth = Math.PI / 4, fit = side => { const end = turned(length, side); return Math.abs(end) > 1e-6 ? Math.round(Math.abs(end) / eighth) * eighth / Math.abs(end) : 1; };
    const k = { l: fit('l'), r: fit('r') }, wheelAt = s => ({ l: turned(s, 'l') * k.l, r: turned(s, 'r') * k.r });
    // the pushes: push n starts at n * stroke (none after length - coast); while gripping, the hand turns about the axle
    // exactly as its wheel does (from where it took hold: the built grip for the first push, PUSH_FROM after); then it
    // lets go and comes back over the rim to take hold again, or, after the last push, to the built grip
    // (the first push takes hold at the built grip, 0, and lets go where the others do, PUSH_FROM + PUSH_ARC: the wrist
    // stays within its reach; a path too short for a push, under a stroke's grip, has none: the hands stay on the rims)
    const grip = Math.min(.95, PUSH_ARC * wheelR / stroke), grip0 = grip * (PUSH_FROM + PUSH_ARC) / PUSH_ARC;
    const pushes = length < grip0 * stroke + .05 ? 0 : Math.max(1, Math.floor(Math.max(0, length - coast) / stroke) + 1);
    const under = t => Math.min(1, speedAt(t) / Math.max(1e-6, v * .5));      // (how much the trunk takes part: none at rest)
    const lean = (out, t) => { out.bend = under(t) * THREE.MathUtils.clamp(LEAN + LEAN_TURN * (out.l.turn + out.r.turn) / 2, 0, LEAN_MAX); return out; };
    const pushAt = (s, t) => {
        if (!pushes) return lean({ l: { turn: 0, lift: 0 }, r: { turn: 0, lift: 0 }, grip: false }, t);
        const n = Math.min(pushes - 1, Math.floor(s / stroke)), s0 = n * stroke, u = (s - s0) / stroke, w0 = wheelAt(s0), start = n === 0 ? 0 : PUSH_FROM, g = n === 0 ? grip0 : grip, out = {};
        // (in a turn the outer wheel runs ahead of the other: its hand lets the rim run on at the end of its reach)
        const most = PUSH_FROM + PUSH_ARC;
        if (u <= g) { const w = wheelAt(s); for (const side of ['l', 'r']) out[side] = { turn: Math.min(most, start + w[side] - w0[side]), lift: 0 }; out.grip = true; return lean(out, t); }
        const w1 = wheelAt(s0 + g * stroke), last = n === pushes - 1, back = last ? ss(0, 1, (s - s0 - g * stroke) / Math.max(.05, length - s0 - g * stroke - .05)) : ss(0, 1, (u - g) / (1 - g));
        for (const side of ['l', 'r']) { const end = Math.min(most, start + w1[side] - w0[side]), to = last ? 0 : PUSH_FROM; out[side] = { turn: lerp(end, to, back), lift: back < 1 ? Math.sin(Math.PI * back) : 0 }; }
        out.grip = false; return lean(out, t);
    };
    const e = along(length);
    return {
        length, seconds, speed: v, pushes, along, tight,
        end: { x: e.x, z: e.z, yaw: wrapAngle(e.heading) },
        at(t) { const s = travel(t), p = along(s); return { x: p.x, z: p.z, yaw: p.heading, s, v: speedAt(t), wheel: wheelAt(s), push: pushAt(s, t) }; }
    };
}
// The hands on the handrims along a roll (input.roll of solveStill: a rollPlan(...).at() result): each wrist turns
// about the rear axle by its push's angle from where the posture was built (on the rim), lifted off the rim on the way
// back; the trunk leans into each push.
const axleAt = V(), rimTurn = Q(), rimOut = V();
function pushRims(rig, key, roll, life) {
    const push = roll.push; if (!push) return;
    bend(rig, X, push.bend * life);
    for (const s of ['l', 'r']) {
        const hand = rig.side[s].arm[3], p = push[s]; if (!p) continue;
        axleAt.set(key.wp[hand].x, WHEEL_AXLE.y, WHEEL_AXLE.z);
        rimTurn.setFromAxisAngle(X, p.turn * life);
        handAt.copy(key.wp[hand]).sub(axleAt); rimOut.copy(handAt).normalize();
        handAt.applyQuaternion(rimTurn).addScaledVector(rimOut.applyQuaternion(rimTurn), PUSH_LIFT * p.lift * life).add(axleAt);
        handAt.x += (s === 'l' ? 1 : -1) * PUSH_OUT * p.lift * life;
        armTo(rig, s, handAt, handQ.copy(rimTurn).multiply(key.wq[hand]));
    }
}
