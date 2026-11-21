// Rise (ch 2, seated cut): the jitter and landing fix, as a by-key patch { "people-maya-sit-type": [keys] }.
//   node docs/rise-jitter-landing/build-fix.mjs <Vico's latest export> <Vico's earlier export with the ending> <out patch.json> [params.json]
//
// LANDING. Vico's latest export (a8fc6cd8ebda, imported 12:12 Nov 21) holds exactly 200 keys, the Director's cap
// (people-pose-keys.mjs MAX_KEYS: cleanPoseKeys sorts, then keeps the first 200). His new per-frame keys pushed the count past
// it, so the last keys - the arms coming down from 22.033 s to the typing pose at 23.5 / 23.7 s - were dropped: every bone
// then holds its 21.967 s key (arms up) to the chapter's end. The ending is taken back from his own previous export
// (0db929432d2f, 11:59, 168 keys), where it is the same as agent A's merged Rise (6a1156eb0e49 / 94773f6a).
//
// JITTER. In the stretch (both elbow holds and the moves between) the arm / hand / finger channels carry a key every frame
// (1/30 s): his hand-posed keys between the earlier 1/15 s linear keys, each a little off its neighbours, most with the default
// smoothstep ease (the turn stops at every key). Each channel is resampled from its own curve: the curve the keys give (poseAt,
// the film's code) at 120 Hz, low-passed with a gaussian (sigma 0.05 s in the moves, 0.12 s in the two holds: a hold is still,
// any wobble there is shake), cross-faded back into the original curve at both ends of the span, then put back as a few keys
// with linear ease, every bone in every key, as far apart as the curve allows within a per-bone tolerance.
// Outside the span (13.433 s and before, 22.1 s and after) the keys are Vico's / the ending's own, byte for byte.
import fs from 'node:fs';
import { THREE, poseAt, keysOf, ARM_BONES, smoothQ, angDeg, R2D } from './kin-lib.mjs';
import { cleanTurn, cleanPoseKeys } from '../../people-pose-keys.mjs';
const [baseF, endF, outF, paramsF] = process.argv.slice(2);
const P = Object.assign({
    S0: 13.433, S1: 22.1,                 // the span that is resampled (both are original 36-bone linear keys, kept as they are)
    fade: 0.15,                           // cross-fade from / to the original curve at the span's ends (s)
    sigmaMove: 0.05, sigmaHold: 0.12,     // gaussian low-pass (s)
    sigmaMoveHand: 0.05,                  // the same in the moves for the hands and fingers (their turns move no other joint)
    holds: [[15.1, 17.3], [19.2, 21.3]],  // the two elbow holds (sigmaHold inside, a 0.15 s blend at their edges)
    tol: { upperarm: 0.25, lowerarm: 0.25, hand: 0.5, finger: 1.0 },  // max angle between the new keys' curve and the low-passed curve (deg)
    maxSpan: 0.5,                         // the most time between two new keys (s)
    HZ: 120,
}, paramsF ? JSON.parse(fs.readFileSync(paramsF, 'utf8')) : {});
const base = keysOf(baseF), ending = keysOf(endF);
const lastBase = Math.max(...base.map(k => k.t));
const tail = ending.filter(k => k.t > lastBase + 1e-6);
const combined = [...base, ...tail].map(k => JSON.parse(JSON.stringify(k))).sort((a, b) => a.t - b.t);
// bones the stretch keys name
const bones = [...new Set(combined.filter(k => k.t > P.S0 - 1e-6 && k.t < P.S1 + 1e-6).flatMap(k => Object.keys(k.pose)))].sort();
const unknown = bones.filter(b => !ARM_BONES.includes(b)); if (unknown.length) console.error('note: non-arm bones keyed in the span:', unknown.join(' '));
// sample the original curve on a 120 Hz grid that is padded on both sides (for the low-pass) and contains every frame time
const pad = 0.6, n0 = Math.round((P.S0 - pad) * P.HZ), n1 = Math.round((P.S1 + pad) * P.HZ);
const ts = []; for (let i = n0; i <= n1; i++) ts.push(i / P.HZ);
const curve = {}; for (const b of bones) curve[b] = [];
for (const t of ts) { const d = poseAt({ poseKeys: combined }, t); for (const b of bones) { const q = new THREE.Quaternion().fromArray(d?.[b] || [0, 0, 0, 1]).normalize(); const prev = curve[b][curve[b].length - 1]; if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); curve[b].push(q); } }
// sigma(t): sigmaHold in a hold, sigmaMove elsewhere, smoothstep between over 0.15 s
const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const inHold = t => Math.max(0, ...P.holds.map(([a, b]) => Math.min(ss((t - a) / 0.15 + 0.5), ss((b - t) / 0.15 + 0.5))));
const sigmaAt = (t, mv) => (mv + (P.sigmaHold - mv) * inHold(t)) * P.HZ;
function lowpass(qs, mv) {
    return qs.map((_, i) => {
        const s = sigmaAt(ts[i], mv), r = Math.ceil(3 * s); let x = 0, y = 0, z = 0, w = 0, sw = 0;
        for (let k = -r; k <= r; k++) { const j = Math.min(qs.length - 1, Math.max(0, i + k)), q = qs[j], c = Math.exp(-k * k / (2 * s * s)); x += q.x * c; y += q.y * c; z += q.z * c; w += q.w * c; sw += c; }
        return new THREE.Quaternion(x, y, z, w).normalize();
    });
}
// the target: the low-passed curve inside the span, cross-faded into the original at both ends
const fadeW = t => Math.min(ss((t - P.S0) / P.fade), ss((P.S1 - t) / P.fade));
const target = {};
for (const b of bones) { const lp = lowpass(curve[b], /arm_/.test(b) ? P.sigmaMove : P.sigmaMoveHand); target[b] = curve[b].map((q, i) => q.clone().slerp(lp[i], fadeW(ts[i]))); }
const idx = t => Math.round(t * P.HZ) - n0;
const tolOf = b => /^upperarm/.test(b) ? P.tol.upperarm : /^lowerarm/.test(b) ? P.tol.lowerarm : /^hand/.test(b) ? P.tol.hand : P.tol.finger;
// greedy key placement on the frame grid (1/30 s), times as the Director stores them (3 decimals)
const r3 = x => Math.round(x * 1000) / 1000;
const frames = []; for (let k = Math.round(P.S0 * 30); k <= Math.round(P.S1 * 30); k++) frames.push(r3(k / 30));
frames[0] = P.S0; frames[frames.length - 1] = P.S1;
const qAt = (b, t) => target[b][idx(t)];
function fits(ta, tb) {
    const ia = idx(ta), ib = idx(tb);
    for (const b of bones) {
        const qa = target[b][ia], qb = target[b][ib], tol = tolOf(b);
        for (let i = ia + 1; i < ib; i++) if (angDeg(qa.clone().slerp(qb, (i - ia) / (ib - ia)), target[b][i]) > tol) return false;
    }
    return true;
}
const picked = [P.S0]; let a = 0;
while (a < frames.length - 1) {
    let best = a + 1;
    for (let j = a + 2; j < frames.length; j++) { if (frames[j] - frames[a] > P.maxSpan + 1e-9) break; if (fits(frames[a], frames[j])) best = j; }
    picked.push(frames[best]); a = best;
}
// the new keys (strictly inside the span), every bone, linear ease; the original keys outside
const turn = q => { let a = cleanTurn([q.x, q.y, q.z, q.w]); for (let i = 0; i < 5; i++) { const b = cleanTurn(a); if (JSON.stringify(b) === JSON.stringify(a)) break; a = b; } return a; };   // (a fixed point of the Director's rounding)
const mid = picked.slice(1, -1).map(t => { const pose = {}; for (const b of bones) pose[b] = turn(qAt(b, t)); return { t, ease: 'linear', pose }; });
const before = combined.filter(k => k.t <= P.S0 + 1e-6), after = combined.filter(k => k.t >= P.S1 - 1e-6);
const keys = [...before, ...mid, ...after];
// the Director's own cleaning must leave them as they are (no merge, no cap)
const canon = k => JSON.stringify({ t: k.t, ease: k.ease || 'smooth', pose: Object.fromEntries(Object.entries(k.pose).sort()) });
const clean = cleanPoseKeys(keys);
const bad = keys.map((k, i) => clean[i] && canon(clean[i]) === canon(k) ? null : k.t).filter(x => x !== null);
if (clean.length !== keys.length || bad.length) { console.error('cleanPoseKeys would change the keys:', clean.length, keys.length, 'at', bad.slice(0, 10).join(' ')); if (!process.env.NOCHECK) process.exit(1); }
fs.writeFileSync(outF, JSON.stringify({ 'people-maya-sit-type': keys }, null, 1));
if (process.env.WHY) {   // which bone keeps two keys close
    for (let i = 0; i < picked.length - 1; i++) {
        const ta = picked[i], tb = picked[i + 1], j = frames.indexOf(tb); if (tb - ta > 0.1 || j + 1 >= frames.length) continue;
        const tc = frames[j + 1], ia = idx(ta), ic = idx(tc); let worst = ['', 0];
        for (const b of bones) for (let k = ia + 1; k < ic; k++) { const e = angDeg(target[b][ia].clone().slerp(target[b][ic], (k - ia) / (ic - ia)), target[b][k]) / tolOf(b); if (e > worst[1]) worst = [b, e]; }
        console.log(ta.toFixed(3), '->', tb.toFixed(3), 'limit', worst[0], worst[1].toFixed(2) + 'x tol');
    }
}
const spans = mid.map((k, i) => (i ? k.t - mid[i - 1].t : k.t - P.S0));
console.log(`base ${base.length} keys (last ${lastBase}), ending +${tail.length} keys (${tail[0]?.t}..${tail[tail.length - 1]?.t}); bones in the span ${bones.length}`);
console.log(`kept before ${before.length}, new ${mid.length} (spacing ${Math.min(...spans).toFixed(3)}..${Math.max(...spans).toFixed(3)} s), kept after ${after.length}: ${keys.length} keys (cap 200)`);
