// Before / after measurements of the Rise jitter and landing fix (seated cut, people-maya-sit-type; FK on Maya's rig, posture as built).
//   node docs/rise-jitter-landing/measure.mjs <before keys file> <after keys file> [out prefix]
// 1. jitter of every arm / hand / finger channel (both sides) per window: residual to a 0.1 s gaussian low-pass (deg, max),
//    RMS angular acceleration and jerk at 30 fps (deg/s^2, deg/s^3), reversals of the angular velocity at 30 fps (both > 5 deg/s)
// 2. the same for world points: elbows, wrists, palms, knuckles, finger tips (cm, m/s^2, m/s^3, reversals of velocity > 2 cm/s)
// 3. the holds: where the points are after vs before at every frame (max / RMS cm), vs the before's own low-pass, the palm to
//    the held elbow (contact) before / after
// 4. the landing: the wrists / palms against the typing pose (the 13.0 s key) from 21.5 s to the chapter's end (28.5 s)
import fs from 'node:fs';
import { keysOf, ARM_BONES, track, jitter, jitterP, range, pointsAt, THREE } from './kin-lib.mjs';
const [bf, af, prefix] = process.argv.slice(2), B = keysOf(bf), A = keysOf(af), HZ = 120, out = [];
const log = s => { out.push(s); console.log(s); };
const WIN = [['raise', 13.433, 15.1], ['hold1 (L palm on R elbow)', 15.1, 17.5], ['switch', 17.5, 19.1], ['hold2 (R palm on L elbow)', 19.1, 21.5], ['release', 21.5, 22.1]];   // holds: the palm within 6 cm of the other elbow
const csv = ['window,bone,resid_before,resid_after,acc_before,acc_after,jerk_before,jerk_after,flips_before,flips_after'];
log('== 1. channels (local turns): per window, worst / sum over the channels of a group; before -> after');
log('window                       group          max resid deg      RMS accel deg/s2 (max)   RMS jerk deg/s3 (max)    vel reversals (sum)');
const groups = { 'upper+lower arm': b => /arm_/.test(b), hand: b => /^hand_/.test(b), fingers: b => /_0\d_/.test(b) };
for (const [name, t0, t1] of WIN) {
    const ts = range(t0 - 0.25, t1 + 0.25, HZ), cut = q => q.slice(Math.round(0.25 * HZ), q.length - Math.round(0.25 * HZ));
    const J = {}; for (const b of ARM_BONES) { const jb = jitter(cut(track(B, b, ts)), HZ), ja = jitter(cut(track(A, b, ts)), HZ); J[b] = [jb, ja]; csv.push([name.split(' ')[0], b, jb.resid, ja.resid, jb.accRms, ja.accRms, jb.jerkRms, ja.jerkRms, jb.flips, ja.flips].map(x => typeof x === 'number' ? +x.toFixed(2) : x).join(',')); }
    for (const [g, f] of Object.entries(groups)) {
        const bs = ARM_BONES.filter(f), mx = (k, i) => Math.max(...bs.map(b => J[b][i][k])), sm = (k, i) => bs.reduce((s, b) => s + J[b][i][k], 0);
        log(name.padEnd(28) + ' ' + g.padEnd(15) + `${mx('resid', 0).toFixed(1)} -> ${mx('resid', 1).toFixed(1)}`.padEnd(19) + `${mx('accRms', 0).toFixed(0)} -> ${mx('accRms', 1).toFixed(0)}`.padEnd(25) + `${mx('jerkRms', 0).toFixed(0)} -> ${mx('jerkRms', 1).toFixed(0)}`.padEnd(25) + `${sm('flips', 0)} -> ${sm('flips', 1)}`);
    }
}
log('\n== 2. world points: per window; before -> after');
const PTS = ['lowerarm_l', 'hand_l', 'palm_l', 'middle_01_l', 'middle_03_l', 'index_03_l', 'thumb_03_l', 'lowerarm_r', 'hand_r', 'palm_r', 'middle_01_r', 'middle_03_r', 'index_03_r', 'thumb_03_r'];
const NICE = { lowerarm: 'elbow', hand: 'wrist', palm: 'palm', middle_01: 'knuckle', middle_03: 'mid tip', index_03: 'index tip', thumb_03: 'thumb tip' };
const nice = p => NICE[p.slice(0, -2)] + ' ' + p.slice(-1).toUpperCase();
log('window                       point          resid cm        RMS accel m/s2     RMS jerk m/s3       vel reversals');
const series = {};
for (const [name, t0, t1] of WIN) {
    const ts = range(t0 - 0.25, t1 + 0.25, HZ), pb = ts.map(t => pointsAt(B, t)), pa = ts.map(t => pointsAt(A, t)), c = Math.round(0.25 * HZ);
    series[name] = { ts, pb, pa };
    for (const p of PTS) {
        const jb = jitterP(pb.slice(c, -c).map(o => o[p]), HZ), ja = jitterP(pa.slice(c, -c).map(o => o[p]), HZ);
        log(name.padEnd(28) + ' ' + nice(p).padEnd(15) + `${jb.resid.toFixed(2)} -> ${ja.resid.toFixed(2)}`.padEnd(16) + `${jb.accRms.toFixed(2)} -> ${ja.accRms.toFixed(2)}`.padEnd(19) + `${jb.jerkRms.toFixed(0)} -> ${ja.jerkRms.toFixed(0)}`.padEnd(20) + `${jb.flips} -> ${ja.flips}`);
    }
}
log('\n== 3. positions, after vs before, at every 1/120 s in each window (cm): max | RMS | max vs the before low-passed (0.1 s gaussian on the positions)');
const lpP = (ps, i, s = 0.1 * HZ) => { const r = Math.ceil(3 * s), v = new THREE.Vector3(); let sw = 0; for (let k = -r; k <= r; k++) { const j = Math.min(ps.length - 1, Math.max(0, i + k)), w = Math.exp(-k * k / (2 * s * s)); v.addScaledVector(ps[j], w); sw += w; } return v.multiplyScalar(1 / sw); };
const worst = {};
for (const [name, t0, t1] of WIN) {
    const { ts, pb, pa } = series[name], c = Math.round(0.25 * HZ), rows = [];
    for (const p of PTS) {
        let mx = 0, sq = 0, n = 0, mxl = 0; const bp = pb.map(o => o[p]);
        for (let i = c; i < ts.length - c; i++) { const d = pa[i][p].distanceTo(pb[i][p]) * 100; mx = Math.max(mx, d); sq += d * d; n++; mxl = Math.max(mxl, pa[i][p].distanceTo(lpP(bp, i)) * 100); }
        rows.push(`${nice(p)} ${mx.toFixed(2)}|${Math.sqrt(sq / n).toFixed(2)}|${mxl.toFixed(2)}`); worst[name + ' ' + p] = mx;
    }
    log(name.padEnd(28) + ' ' + rows.slice(0, 7).join('  ')); log(''.padEnd(29) + rows.slice(7).join('  '));
}
for (const [name, side, elbow] of [['hold1 (L palm on R elbow)', 'l', 'lowerarm_r'], ['hold2 (R palm on L elbow)', 'r', 'lowerarm_l']]) {
    const { ts, pb, pa } = series[name], c = Math.round(0.25 * HZ); let bmin = 1e9, bmax = 0, amin = 1e9, amax = 0;
    for (let i = c; i < ts.length - c; i++) { const db = pb[i]['palm_' + side].distanceTo(pb[i][elbow]) * 100, da = pa[i]['palm_' + side].distanceTo(pa[i][elbow]) * 100; bmin = Math.min(bmin, db); bmax = Math.max(bmax, db); amin = Math.min(amin, da); amax = Math.max(amax, da); }
    log(`${name}: palm to the held elbow (joint centre) before ${bmin.toFixed(1)}..${bmax.toFixed(1)} cm, after ${amin.toFixed(1)}..${amax.toFixed(1)} cm`);
}
log('\n== 4. landing: wrists / palms against the typing pose (the 13.0 s key), cm; and the hands\' height (y, cm)');
const typ = pointsAt(B, 13.0);
log('t       before: wristL wristR palmL palmR (cm off typing)  yWristL yWristR | after: wristL wristR palmL palmR  yWristL yWristR');
for (const t of [21.5, 21.8, 21.967, 22.2, 22.4, 22.6, 22.8, 23.0, 23.2, 23.4, 23.5, 23.7, 24.0, 25.0, 26.0, 27.0, 28.0, 28.5]) {
    const b = pointsAt(B, t), a = pointsAt(A, t), off = o => ['hand_l', 'hand_r', 'palm_l', 'palm_r'].map(p => (o[p].distanceTo(typ[p]) * 100).toFixed(1).padStart(6)).join('');
    log(String(t).padEnd(8) + off(b) + '              ' + (b.hand_l.y * 100).toFixed(1).padStart(7) + (b.hand_r.y * 100).toFixed(1).padStart(8) + ' |       ' + off(a) + (a.hand_l.y * 100).toFixed(1).padStart(9) + (a.hand_r.y * 100).toFixed(1).padStart(8));
}
log(`\nkeys: before ${B.length} (${B[0].t}..${B[B.length - 1].t}), after ${A.length} (${A[0].t}..${A[A.length - 1].t})`);
if (prefix) { fs.writeFileSync(prefix + '.txt', out.join('\n') + '\n'); fs.writeFileSync(prefix + '-channels.csv', csv.join('\n') + '\n'); }
