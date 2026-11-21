// What breaks Maya's arms in the exit of the Rise stretch (Vico's export 15035291e783, people-maya-sit-type).
//   node diagnose.mjs <doc> [t0] [t1]
// 1. per arm bone: every key in [t0, t1] that names it, the rotation from that bone's previous key (deg), the raw quaternion
//    dot with the previous key (negative = stored on the other hemisphere: poseAt's slerp flips it and goes the short way),
//    the angular speed that span implies (deg/s, linear ease; smooth ease peaks at 1.5x), and the ease.
// 2. per 1/30 s frame: angular speed of every arm bone (deg/s) from the film's own poseAt; elbow flexion (angle between the
//    upper-arm and forearm directions, world), wrist bend (forearm vs hand), elbow / wrist positions; the frames whose speed
//    is far above its neighbours (reversals / spikes).
import { keysOf, THREE, poseAt, fkAt, POST, angDeg, R2D } from './kin-lib.mjs';
const [f, a0, a1] = process.argv.slice(2), K = keysOf(f), T0 = +(a0 ?? 21.4), T1 = +(a1 ?? 23.8);
const q = a => new THREE.Quaternion().fromArray(a).normalize();
const ARMS = ['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'];
console.log(`== 1. keys per bone in ${T0}..${T1}`);
for (const b of ARMS) {
    const ks = K.filter(k => k.pose[b]); let prev = null; const rows = [];
    for (const k of ks) {
        if (k.t >= T0 - 0.3 && k.t <= T1 && prev) {
            const qa = q(prev.pose[b]), qb = q(k.pose[b]), dot = qa.dot(qb), ang = angDeg(qa, qb), dt = k.t - prev.t;
            rows.push(`${prev.t.toFixed(3)}->${k.t.toFixed(3)} ${ang.toFixed(1).padStart(6)}deg dot ${dot.toFixed(3).padStart(6)} ${(ang / dt).toFixed(0).padStart(5)}deg/s ${(prev.ease || 'smooth')}`);
        }
        prev = k;
    }
    console.log(b); rows.forEach(r => console.log('   ' + r));
}
console.log(`\n== 2. per frame (30 fps): angular speed deg/s per bone; elbow flexion / wrist bend (deg); wrist height (cm)`);
const dirOf = (fk, a, b) => fk.P(b).sub(fk.P(a)).normalize();
const frame = t => {
    const d = poseAt({ poseKeys: K }, t), fk = fkAt(POST, d, 'rest'), o = { d };
    for (const s of ['l', 'r']) {
        const up = dirOf(fk, 'upperarm_' + s, 'lowerarm_' + s), fo = dirOf(fk, 'lowerarm_' + s, 'hand_' + s), ha = dirOf(fk, 'hand_' + s, 'middle_01_' + s);
        o['elb' + s] = Math.acos(Math.max(-1, Math.min(1, up.dot(fo)))) * R2D; o['wr' + s] = Math.acos(Math.max(-1, Math.min(1, fo.dot(ha)))) * R2D;
        o['wy' + s] = fk.P('hand_' + s).y * 100;
        // forearm twist: hand's world x-axis projected off the forearm, angle relative to the lowerarm's
        const hx = new THREE.Vector3(1, 0, 0).applyQuaternion(fk.Q('hand_' + s)), lx = new THREE.Vector3(1, 0, 0).applyQuaternion(fk.Q('lowerarm_' + s));
        hx.addScaledVector(fo, -hx.dot(fo)).normalize(); lx.addScaledVector(fo, -lx.dot(fo)).normalize();
        o['tw' + s] = Math.atan2(lx.clone().cross(hx).dot(fo), lx.dot(hx)) * R2D;
    }
    return o;
};
let prev = null;
console.log('t       ' + ARMS.map(b => b.padStart(11)).join('') + '  elbL  elbR   wrL   wrR  twL   twR  wyL  wyR');
for (let i = Math.round(T0 * 30); i <= Math.round(T1 * 30); i++) {
    const t = i / 30, o = frame(t);
    const sp = ARMS.map(b => prev ? angDeg(q(prev.d?.[b] || [0, 0, 0, 1]), q(o.d?.[b] || [0, 0, 0, 1])) * 30 : 0);
    console.log(t.toFixed(3).padEnd(8) + sp.map(x => x.toFixed(0).padStart(11)).join('') + [o.elbl, o.elbr, o.wrl, o.wrr, o.twl, o.twr, o.wyl, o.wyr].map(x => x.toFixed(0).padStart(6)).join(''));
    prev = o;
}
