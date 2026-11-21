// Entry vs exit, joint by joint, against progress (FK on Maya's rig, film poseAt; posture as built).
// progress u: 0 = hands on the keys, 1 = in the stretch. Entry time = TE0 + u * D; exit time = XE - u * (XE - XS) (backwards).
// The exit's left arm is compared with the entry's right arm and vice versa (the stretch at the exit is hold 1's mirror image).
// Per side: elbow flexion (deg), wrist bend (deg), forearm twist (deg, sign-mirrored), upper-arm elevation (deg from straight
// down), the wrist position mirrored (x -> -x) against the exit's (cm); and the local turn of every arm bone: angle between the
// exit's and the mirrored entry's (deg). Then peak angular speeds and the 30 fps velocity reversals of each window.
//   node compare-angles.mjs <doc> <XS> <XE> <label> [out.csv]   (entry fixed: 13.1 .. 15.267)
import fs from 'node:fs';
import { keysOf, THREE, poseAt, fkAt, POST, angDeg, R2D } from './kin-lib.mjs';
const [f, xs, xe, label, csvF] = process.argv.slice(2), K = keysOf(f), TE0 = 13.1, TE1 = 15.267, XS = +xs, XE = +xe;
const Q = a => new THREE.Quaternion().fromArray(a || [0, 0, 0, 1]).normalize(), mir = q => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
const other = s => s === 'l' ? 'r' : 'l';
const geo = t => {
    const d = poseAt({ poseKeys: K }, t), fk = fkAt(POST, d, 'rest'), o = { d };
    for (const s of ['l', 'r']) {
        const dir = (a, b) => fk.P(b).sub(fk.P(a)).normalize(), up = dir('upperarm_' + s, 'lowerarm_' + s), fo = dir('lowerarm_' + s, 'hand_' + s), ha = dir('hand_' + s, 'middle_01_' + s);
        const hx = new THREE.Vector3(1, 0, 0).applyQuaternion(fk.Q('hand_' + s)), lx = new THREE.Vector3(1, 0, 0).applyQuaternion(fk.Q('lowerarm_' + s));
        hx.addScaledVector(fo, -hx.dot(fo)).normalize(); lx.addScaledVector(fo, -lx.dot(fo)).normalize();
        o[s] = { elbow: Math.acos(THREE.MathUtils.clamp(up.dot(fo), -1, 1)) * R2D, wrist: Math.acos(THREE.MathUtils.clamp(fo.dot(ha), -1, 1)) * R2D,
            twist: Math.atan2(lx.clone().cross(hx).dot(fo), lx.dot(hx)) * R2D * (s === 'l' ? 1 : -1), elev: Math.acos(THREE.MathUtils.clamp(-up.y, -1, 1)) * R2D, wp: fk.P('hand_' + s) };
    }
    return o;
};
const rows = [], csv = ['u,t_entry,t_exit,' + ['l', 'r'].flatMap(s => ['elbow', 'wrist', 'twist', 'elev'].flatMap(k => [`entry_${k}_${s}`, `exit_${k}_${s}`])).join(',') + ',dwrist_l_cm,dwrist_r_cm,dturn_upperarm_l,dturn_lowerarm_l,dturn_hand_l,dturn_upperarm_r,dturn_lowerarm_r,dturn_hand_r,dturn_fingers_max'];
console.log(`${label}: exit ${XS}..${XE} vs entry ${TE0}..${TE1} (mirrored, reversed). exit side X = entry side X' (L<->R)`);
console.log('u     |  elbow L  ex/en    R ex/en |  wrist L ex/en     R ex/en |  twist L ex/en     R ex/en |  elev L ex/en      R ex/en | wrist pos d L/R cm | turn d upL loL haL upR loR haR fing');
for (let i = 0; i <= 20; i++) {
    const u = i / 20, te = TE0 + u * (TE1 - TE0), tx = XE - u * (XE - XS), E = geo(te), X = geo(tx);
    const cmp = (k, s) => [X[s][k], E[other(s)][k]];
    const dw = s => { const p = E[other(s)].wp.clone(); p.x = -p.x; return X[s].wp.distanceTo(p) * 100; };
    const dt = b => angDeg(Q(X.d[b]), mir(Q(E.d[b.replace(/_([lr])$/, (_, s) => '_' + other(s))])));
    const fingers = Object.keys(X.d).filter(b => /_0\d_/.test(b)), fmax = Math.max(...fingers.map(dt));
    const line = (k) => ['l', 'r'].map(s => cmp(k, s).map(x => x.toFixed(0).padStart(5)).join('/')).join('  ');
    console.log(u.toFixed(2) + '  | ' + ['elbow', 'wrist', 'twist', 'elev'].map(line).join(' | ') + ' | ' + dw('l').toFixed(1).padStart(6) + dw('r').toFixed(1).padStart(6) + '       | ' + ['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'].map(b => dt(b).toFixed(0).padStart(4)).join('') + fmax.toFixed(0).padStart(5));
    csv.push([u, te.toFixed(3), tx.toFixed(3), ...['l', 'r'].flatMap(s => ['elbow', 'wrist', 'twist', 'elev'].flatMap(k => cmp(k, s).map(x => x.toFixed(1)))), dw('l').toFixed(2), dw('r').toFixed(2), ...['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'].map(b => dt(b).toFixed(1)), fmax.toFixed(1)].join(','));
}
// peak angular speeds (30 fps) and velocity reversals, per bone: entry window vs exit window
const speeds = (t0, t1, b) => { const v = []; let p = null; for (let i = Math.round(t0 * 30) - 3; i <= Math.round(t1 * 30) + 3; i++) { const t = i / 30, q = Q(poseAt({ poseKeys: K }, t)[b]); if (p) { const r = q.clone().multiply(p.clone().invert()); if (r.w < 0) r.set(-r.x, -r.y, -r.z, -r.w); const s = Math.hypot(r.x, r.y, r.z); v.push(new THREE.Vector3(r.x, r.y, r.z).multiplyScalar(s > 1e-12 ? 2 * Math.atan2(s, r.w) / s * 30 * R2D : 0)); } p = q; } return v; };
console.log('\npeak angular speed deg/s (30 fps) | velocity reversals (both frames > 5 deg/s): entry (that side) -> exit (mirrored side)');
for (const b of ['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'index_01_l', 'index_01_r', 'thumb_01_l', 'thumb_01_r']) {
    const eb = b.replace(/_([lr])$/, (_, s) => '_' + other(s)), ve = speeds(TE0, TE1, eb), vx = speeds(XS, XE, b);
    const rev = v => v.filter((w, i) => i && w.length() > 5 && v[i - 1].length() > 5 && w.dot(v[i - 1]) < 0).length, pk = v => Math.max(...v.map(w => w.length()));
    console.log(`  exit ${b.padEnd(11)} ${pk(vx).toFixed(0).padStart(6)} | rev ${String(rev(vx)).padStart(2)}    entry ${eb.padEnd(11)} ${pk(ve).toFixed(0).padStart(6)} | rev ${String(rev(ve)).padStart(2)}`);
}
if (csvF) fs.writeFileSync(csvF, csv.join('\n') + '\n');
