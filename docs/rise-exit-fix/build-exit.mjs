// Rise (ch 2, seated cut, posture people-maya-sit-type): the exit from the overhead triceps stretch, rebuilt from the
// entry played backwards. Output: a by-key patch { "people-maya-sit-type": [keys] } (all keys of the posture).
//   node build-exit.mjs <Vico's export> <out patch.json> [params.json]
//
// The entry (keyboard -> stretch, Vico's keys 13.1 .. 15.267, left untouched) ends in hold 1: RIGHT arm folded overhead,
// left palm on the right elbow. His stretch ends in hold 2, the mirror image: LEFT arm folded overhead, right palm on the
// left elbow. So the exit is the entry reversed in time AND mirrored left <-> right: the exit's left arm turns through the
// entry's right arm's angles backwards, the exit's right arm through the entry's left arm's. Maya's rig is mirror-symmetric
// with identity bind frames (rig-sym.mjs), so the mirror of a bone's turn is (x, -y, -z, w) on the other side's bone.
//   raw(t)  = mirror(entry(TE1 - p * D)),  p = (t - S) / D,  D = TE1 - TE0 (same duration and timing shape as the entry)
//   exit(t) = raw(t) * slerp(1, c0, 1 - ss(p / fadeOut)) * slerp(1, c1, ss((p - 1 + fadeIn) / fadeIn)),
//             c0 = raw(S)^-1 * vico(S),  c1 = raw(S + D)^-1 * typing   (ss = smoothstep)
// so it starts exactly on Vico's pose at S (the end of his hold 2) and lands exactly on his typing pose (his own last key,
// the same pose as his 13.0 key), every arm / hand / finger bone of both sides.
// Keys: the exit sampled at 120 Hz, then put back as few linear keys as fit (per-bone tolerance), every bone in every key.
// Keys at or before S are Vico's own, byte for byte; his keys after S are replaced.
import fs from 'node:fs';
import { THREE, poseAt, keysOf, ARM_BONES, angDeg } from './kin-lib.mjs';
import { cleanTurn, cleanPoseKeys, MAX_KEYS } from '../../people-pose-keys.mjs';
const [baseF, outF, paramsF] = process.argv.slice(2);
const P = Object.assign({
    TE0: 13.1, TE1: 15.267,          // the entry: from the last typing key to the settled hold-1 key
    S: 21.133,                       // the exit starts here: the end of hold 2 (Vico's last key before his exit)
    tol: { upperarm: 0.3, lowerarm: 0.3, hand: 0.5, finger: 1.0 },
    fadeOut: 0.6, fadeIn: 0.6,       // fractions of the exit over which the start / end corrections fade
    maxSpan: 0.25, HZ: 120, keyCap: 170,
}, paramsF ? JSON.parse(fs.readFileSync(paramsF, 'utf8')) : {});
const V = keysOf(baseF), D = P.TE1 - P.TE0, E = P.S + D;
const Q = a => new THREE.Quaternion().fromArray(a).normalize();
const mirror = q => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
const other = b => b.replace(/_([lr])$/, (_, s) => '_' + (s === 'l' ? 'r' : 'l'));
const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const at = (keys, t) => poseAt({ poseKeys: keys }, t) || {};
const bones = ARM_BONES;
// typing: what Vico's posture ends on (poseAt at the chapter's end, 28.5 s)
const typing = at(V, 28.5), start = at(V, P.S);
for (const b of bones) if (!typing[b] || !start[b]) throw new Error('bone not keyed: ' + b);
const raw = (b, t) => { const p = Math.min(1, Math.max(0, (t - P.S) / D)); return mirror(Q(at(V, P.TE1 - p * D)[other(b)])); };
const c0 = {}, c1 = {}, short = q => q.w < 0 ? q.set(-q.x, -q.y, -q.z, -q.w) : q;
for (const b of bones) { c0[b] = short(raw(b, P.S).invert().multiply(Q(start[b]))); c1[b] = short(raw(b, E).invert().multiply(Q(typing[b]))); }
// the end corrections fade: c0 out over the first fadeOut of the exit, c1 in over the last fadeIn (in between: the mirrored entry itself)
const I = new THREE.Quaternion();
const exitAt = (b, t) => {
    const p = Math.min(1, Math.max(0, (t - P.S) / D)), w0 = 1 - ss(p / P.fadeOut), w1 = ss((p - (1 - P.fadeIn)) / P.fadeIn);
    return raw(b, t).multiply(I.clone().slerp(c0[b], w0)).multiply(I.clone().slerp(c1[b], w1)).normalize();
};
// the target on a 120 Hz grid, sign-continuous
const n0 = Math.round(P.S * P.HZ), n1 = Math.round(E * P.HZ), ts = []; for (let i = n0; i <= n1; i++) ts.push(i / P.HZ);
const target = {}; for (const b of bones) { target[b] = []; for (const t of ts) { const q = exitAt(b, t), pr = target[b][target[b].length - 1]; if (pr && pr.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); target[b].push(q); } }
const idx = t => Math.round(t * P.HZ) - n0;
const tolOf = b => /^upperarm/.test(b) ? P.tol.upperarm : /^lowerarm/.test(b) ? P.tol.lowerarm : /^hand/.test(b) ? P.tol.hand : P.tol.finger;
const r3 = x => Math.round(x * 1000) / 1000;
const frames = []; for (let k = Math.ceil(P.S * 30 - 1e-6); k <= Math.floor(E * 30 + 1e-6); k++) frames.push(r3(k / 30));
if (Math.abs(frames[0] - P.S) > 1e-6) frames.unshift(P.S); if (Math.abs(frames[frames.length - 1] - r3(E)) > 1e-6) frames.push(r3(E));
function fits(ta, tb) {
    const ia = idx(ta), ib = idx(tb);
    for (const b of bones) { const qa = target[b][ia], qb = target[b][ib], tol = tolOf(b); for (let i = ia + 1; i < ib; i++) if (angDeg(qa.clone().slerp(qb, (i - ia) / (ib - ia)), target[b][i]) > tol) return false; }
    return true;
}
const picked = [frames[0]]; let a = 0;
while (a < frames.length - 1) { let best = a + 1; for (let j = a + 2; j < frames.length; j++) { if (frames[j] - frames[a] > P.maxSpan + 1e-9) break; if (fits(frames[a], frames[j])) best = j; } picked.push(frames[best]); a = best; }
const turn = q => { let x = cleanTurn([q.x, q.y, q.z, q.w]); for (let i = 0; i < 5; i++) { const y = cleanTurn(x); if (JSON.stringify(y) === JSON.stringify(x)) break; x = y; } return x; };
const newKeys = picked.slice(1).map((t, i, arr) => {
    const pose = {}; const last = i === arr.length - 1;
    for (const b of bones) pose[b] = last ? typing[b].slice() : turn(target[b][idx(t)]);
    return last ? { t, pose } : { t, ease: 'linear', pose };
});
const before = V.filter(k => k.t <= P.S + 1e-6).map(k => JSON.parse(JSON.stringify(k)));
if (Math.abs(before[before.length - 1].t - P.S) > 1e-6 || before[before.length - 1].ease !== 'linear') throw new Error('S must be one of Vico\'s linear keys');
const keys = [...before, ...newKeys];
const canon = k => JSON.stringify({ t: k.t, ease: k.ease || 'smooth', pose: Object.fromEntries(Object.entries(k.pose).sort()) });
const clean = cleanPoseKeys(keys), bad = keys.filter((k, i) => !clean[i] || canon(clean[i]) !== canon(k)).map(k => k.t);
if (clean.length !== keys.length || bad.length) { console.error('cleanPoseKeys would change the keys:', clean.length, keys.length, bad.slice(0, 10)); process.exit(1); }
if (keys.length > P.keyCap || keys.length > MAX_KEYS) { console.error('too many keys', keys.length); process.exit(1); }
fs.writeFileSync(outF, JSON.stringify({ 'people-maya-sit-type': keys }, null, 1));
// report: the end corrections (how far the mirrored reversed entry is from his poses at the two ends)
const cAng = c => 2 * Math.acos(Math.min(1, Math.abs(c.w))) * 180 / Math.PI;
console.log(`exit ${P.S} -> ${r3(E)} s (entry ${P.TE0} -> ${P.TE1} reversed, mirrored); Vico's keys kept ${before.length}, his keys replaced ${V.length - before.length}, new ${newKeys.length}: ${keys.length} keys (cap ${MAX_KEYS})`);
console.log('end corrections (deg): bone  start(c0)  end(c1)');
for (const b of bones) if (!/_0[23]_/.test(b)) console.log('  ' + b.padEnd(12) + cAng(c0[b]).toFixed(1).padStart(7) + cAng(c1[b]).toFixed(1).padStart(8));
const sp = newKeys.map((k, i) => k.t - (i ? newKeys[i - 1].t : P.S));
console.log(`key spacing ${Math.min(...sp).toFixed(3)}..${Math.max(...sp).toFixed(3)} s`);
