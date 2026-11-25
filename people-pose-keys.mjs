// Pose keys: a person's fine-tuned joints along a film chapter's time (S31, 2026-11-15).
//
// A cast entry (room-people.mjs) may carry, next to its static `pose`:
//   poseKeys: [ { t: seconds, pose: { '<bone>': [x, y, z, w], ... }, ease?: 'smooth' | 'linear' | 'hold' }, ... ]
// t is in chapter seconds (the clock of `when` and state.time). A turn is what `pose` holds: a quaternion in the bone's
// own frame, on top of the posture as the motion solves it that frame (drawPose's last argument).
//
// Every bone is a channel of its own, as in an animation package: a key constrains only the bones it names. At time T
// a bone takes the turn between the nearest key before T that names it and the nearest after (slerp); before its first
// key and after its last it holds that key. A bone no key names takes the static `pose` turn, if any. A keyed turn
// replaces the static one for that bone. The identity [0, 0, 0, 1] is a real key ("as programmed here"): a correction
// is made local with a neutral key before it and one after.
// `ease` belongs to the key a stretch leaves: smooth (smoothstep, the default), linear, or hold (stays until the next).
//
// Pure: no three.js, so the Director's panels, the stage and the tests share it.
export const EASES = ['smooth', 'linear', 'hold'];
export const KEY_SNAP = 1 / 60;        // two keys nearer than this are one key
export const MAX_KEYS = 200;
const BONE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/, finite = v => typeof v === 'number' && Number.isFinite(v);
const r4 = v => Math.round(v * 10000) / 10000, r3 = v => Math.round(v * 1000) / 1000;

// A unit quaternion with w >= 0, 4 decimals; null when it is not one.
export function cleanTurn(q) {
    if (!Array.isArray(q) || q.length !== 4 || !q.every(finite)) return null;
    const n = Math.hypot(q[0], q[1], q[2], q[3]); if (n < 1e-6) return null;
    const s = q[3] < 0 ? -1 / n : 1 / n, u = q.map(c => r4(c * s) + 0);   // (+ 0: no minus zero in the file)
    if (Math.hypot(u[0], u[1], u[2]) < 1e-4) return [0, 0, 0, 1];
    return u;
}
// A key's pose: every named bone kept, the identity included.
function cleanKeyPose(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const out = {};
    for (const [name, q] of Object.entries(v).slice(0, 80)) { if (!BONE.test(name)) continue; const u = cleanTurn(q); if (u) out[name] = u; }
    return Object.keys(out).length ? out : null;
}
// The keys as they are stored: sorted, keys closer than KEY_SNAP merged (the later one's bones win), at most MAX_KEYS.
export function cleanPoseKeys(v) {
    if (!Array.isArray(v)) return null;
    const keys = [];
    for (const raw of v) {
        if (!raw || typeof raw !== 'object' || !finite(raw.t) || raw.t < 0 || raw.t > 36000) continue;
        const pose = cleanKeyPose(raw.pose); if (!pose) continue;
        const key = { t: r3(raw.t), pose }; if (EASES.includes(raw.ease) && raw.ease !== 'smooth') key.ease = raw.ease;
        keys.push(key);
    }
    keys.sort((a, b) => a.t - b.t);
    const out = [];
    for (const key of keys) {
        const last = out[out.length - 1];
        if (last && key.t - last.t < KEY_SNAP - 1e-9) { Object.assign(last.pose, key.pose); if (key.ease) last.ease = key.ease; else delete last.ease; }
        else out.push(key);
    }
    return out.length ? out.slice(0, MAX_KEYS) : null;
}
export const keyTimes = entry => (Array.isArray(entry?.poseKeys) ? entry.poseKeys : []).map(k => k.t).sort((a,b)=>a-b);
// The bones any key names.
export function keyedBones(entry) { const out = new Set(); for (const k of entry?.poseKeys || []) for (const name of Object.keys(k.pose || {})) out.add(name); return [...out]; }

function slerp(a, b, k) {
    let [bx, by, bz, bw] = b, dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot; }
    let s0, s1;
    if (dot > .9995) { s0 = 1 - k; s1 = k; }
    else { const th = Math.acos(Math.min(1, dot)), sn = Math.sin(th); s0 = Math.sin((1 - k) * th) / sn; s1 = Math.sin(k * th) / sn; }
    const out = [a[0] * s0 + bx * s1, a[1] * s0 + by * s1, a[2] * s0 + bz * s1, a[3] * s0 + bw * s1], n = Math.hypot(...out) || 1;
    return out.map(c => c / n);
}
// The turns of two poses blended (k 0 = a, 1 = b) for the bones `names` only: a bone one of them leaves out is the identity there. A change of
// posture (room-people.mjs) eases the arms' fine tuning in with the arms, not in one frame where the model is swapped.
export function blendPoses(a, b, k, names) {
    const out = {}, same = [0, 0, 0, 1];
    for (const name of names) { const x = a?.[name], y = b?.[name]; if (!x && !y) continue; out[name] = k <= 0 && x ? x : k >= 1 && y ? y : slerp(x || same, y || same, k); }
    return out;
}
const eased = (k, ease) => ease === 'hold' ? 0 : ease === 'linear' ? k : k * k * (3 - 2 * k);

// The pose a person has at `time`: { '<bone>': [x, y, z, w] } or null. Without a time (the Studio, a still with no
// clock) or without keys it is the static `pose`. The result is a fresh object; `into` (an object) is reused if given,
// so a stage can call this every frame without garbage.
export function poseAt(entry, time, into = null) {
    const keys = entry?.poseKeys, base = entry?.pose && typeof entry.pose === 'object' ? entry.pose : null;
    if (!Array.isArray(keys) || !keys.length || !finite(time)) return base;
    const out = into || {}; if (into) for (const name of Object.keys(into)) delete into[name];
    if (base) for (const [name, q] of Object.entries(base)) out[name] = q;
    // per bone: the last key at or before `time` that names it, and the first after
    const before = new Map(), after = new Map();
    for (const key of keys) {
        const late = key.t > time + 1e-9;
        for (const name of Object.keys(key.pose)) {
            // Archives retain their original key order. Find temporal neighbours
            // without sorting or rewriting that data (sorted input is identical).
            if (!late) { if (!before.has(name) || key.t >= before.get(name).t) before.set(name, key); }
            else if (!after.has(name) || key.t < after.get(name).t) after.set(name, key);
        }
    }
    for (const name of new Set([...before.keys(), ...after.keys()])) {
        const a = before.get(name), b = after.get(name);
        if (!a) out[name] = b.pose[name];
        else if (!b) out[name] = a.pose[name];
        else { const span = b.t - a.t, k = span > 1e-9 ? Math.min(1, Math.max(0, (time - a.t) / span)) : 1; out[name] = k <= 0 || a.ease === 'hold' ? a.pose[name] : slerp(a.pose[name], b.pose[name], eased(k, a.ease)); }
    }
    return Object.keys(out).length ? out : null;
}

// ---- editing (each returns a new entry; the one given is not changed) ----------------------------------------------
const withKeys = (entry, keys) => { const out = { ...entry }, clean = cleanPoseKeys(keys); if (clean) out.poseKeys = clean; else delete out.poseKeys; return out; };
const copyKeys = entry => (Array.isArray(entry?.poseKeys) ? entry.poseKeys : []).map(k => ({ ...k, pose: { ...k.pose } }));
const near = (keys, t) => keys.find(k => Math.abs(k.t - t) < KEY_SNAP - 1e-9) || null;
// Adds a bone's turn at t, or changes it in the key that is already there. `bones` may also be given as one object
// { '<bone>': quat, ... } in place of (bone, quat) to key several at once ("key this limb", "key all").
export function setPoseKey(entry, t, bone, quat, { ease } = {}) {
    if (!finite(t) || t < 0) return entry;
    const turns = typeof bone === 'string' ? { [bone]: quat } : bone, pose = cleanKeyPose(turns); if (!pose) return entry;
    const keys = copyKeys(entry), at = near(keys, t);
    if (at) { Object.assign(at.pose, pose); if (ease !== undefined) { if (EASES.includes(ease) && ease !== 'smooth') at.ease = ease; else delete at.ease; } }
    else keys.push({ t, pose, ...(EASES.includes(ease) && ease !== 'smooth' ? { ease } : {}) });
    return withKeys(entry, keys);
}
// Takes a bone out of the key at t, or the whole key (no bone given). A key with no bone left is gone.
export function removePoseKey(entry, t, bone = null) {
    const keys = copyKeys(entry), at = near(keys, t); if (!at) return entry;
    if (bone) delete at.pose[bone];
    return withKeys(entry, bone && Object.keys(at.pose).length ? keys : keys.filter(k => k !== at));
}
// Retimes the key at tFrom to tTo (it merges with a key that is already there; the moved key's bones win).
export function moveKey(entry, tFrom, tTo) {
    if (!finite(tTo) || tTo < 0) return entry;
    const keys = copyKeys(entry), at = near(keys, tFrom); if (!at) return entry;
    const rest = keys.filter(k => k !== at), there = near(rest, tTo);
    if (there) { Object.assign(there.pose, at.pose); if (at.ease) there.ease = at.ease; else delete there.ease; return withKeys(entry, rest); }
    at.t = tTo; return withKeys(entry, keys);
}
// The ease of the stretch that leaves the key at t.
export function setKeyEase(entry, t, ease) {
    const keys = copyKeys(entry), at = near(keys, t); if (!at || !EASES.includes(ease)) return entry;
    if (ease === 'smooth') delete at.ease; else at.ease = ease;
    return withKeys(entry, keys);
}
// A copy of the key at t (for paste): { pose, ease? } or null;  pasteKey puts it at another time.
export function copyKey(entry, t) { const at = near(copyKeys(entry), t); return at ? { pose: at.pose, ...(at.ease ? { ease: at.ease } : {}) } : null; }
export function pasteKey(entry, t, copied) { return copied?.pose ? setPoseKey(entry, t, copied.pose, undefined, { ease: copied.ease ?? 'smooth' }) : entry; }
