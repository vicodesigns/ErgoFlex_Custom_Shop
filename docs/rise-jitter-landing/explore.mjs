// Where is the shake? Per 0.5 s window: the worst bone's residual to its low-pass and its 30 fps velocity reversals; plus a
// 10 Hz table of the wrists / elbows and the supporting hand's distance to the other elbow.
//   node docs/rise-jitter-landing/explore.mjs <keys file> [from=13] [to=24]
import { keysOf, ARM_BONES, track, jitter, range, pointsAt } from './kin-lib.mjs';
const [file, a = '13', b = '24'] = process.argv.slice(2), keys = keysOf(file), t0 = +a, t1 = +b, HZ = 120;
const ts = range(t0, t1, HZ), tr = {}; for (const bn of ARM_BONES) tr[bn] = track(keys, bn, ts);
console.log('window      worst bones (resid deg / flips)');
for (let w = t0; w < t1 - 1e-9; w += 0.5) {
    const i0 = Math.round((w - t0) * HZ), i1 = Math.round((w + 0.5 - t0) * HZ);
    const rows = ARM_BONES.map(bn => { const pad = 24, s = Math.max(0, i0 - pad), e = Math.min(ts.length, i1 + pad); const j = jitter(tr[bn].slice(s, e), HZ); return [bn, j]; })
        .filter(([, j]) => j.resid > 0.5 || j.flips > 0).sort((x, y) => y[1].resid - x[1].resid).slice(0, 6);
    console.log(w.toFixed(1).padEnd(6), rows.map(([bn, j]) => `${bn} ${j.resid.toFixed(1)}/${j.flips}`).join('  '));
}
const f = v => v.toArray().map(x => (x * 100).toFixed(1).padStart(6)).join('');
console.log('t      | elbowL               wristL               palmL                | elbowR               wristR               palmR               | palmL-elbR palmR-elbL');
for (const t of range(t0, t1, 10)) { const p = pointsAt(keys, t); console.log(t.toFixed(2).padEnd(6), '|', f(p.lowerarm_l), f(p.hand_l), f(p.palm_l), '|', f(p.lowerarm_r), f(p.hand_r), f(p.palm_r), '|', (p.palm_l.distanceTo(p.lowerarm_r) * 100).toFixed(1).padStart(6), (p.palm_r.distanceTo(p.lowerarm_l) * 100).toFixed(1).padStart(6)); }
