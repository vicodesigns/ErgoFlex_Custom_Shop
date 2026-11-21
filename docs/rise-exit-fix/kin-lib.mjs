// Shared kinematics for the Rise jitter / landing fix (seated cut, posture people-maya-sit-type).
// Pose keys are evaluated with the film's own people-pose-keys.mjs poseAt; FK on Maya's rig with rise-pull-lib.mjs fkAt
// (bone.quaternion = rest * delta, the same maths as room-people-motion.mjs drawPose), posture as built ('rest' mode:
// the procedural life layer - breathing, typing fingers - is left out so before/after compare the keys alone).
import fs from 'node:fs';
import { fkAt, poseAt, THREE } from './rise-pull-lib.mjs';
export { fkAt, poseAt, THREE };
export const POST = 'people-maya-sit-type';
export const R2D = 180 / Math.PI;
export function keysOf(file) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')); if (doc[POST]) return doc[POST];
    if (Array.isArray(doc)) return doc;
    const sh = doc.shots ? (doc.shots.find(s => s.id === 'rise') || doc.shots[0]) : doc; const ppl = sh.peopleEdits || sh.people;
    return ppl.cast.find(c => c.key === 'maya-stand').postures[POST].poseKeys;
}
const SIDES = ['l', 'r'];
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const ARM_BONES = SIDES.flatMap(s => ['upperarm_' + s, 'lowerarm_' + s, 'hand_' + s, ...FINGERS.flatMap(f => [1, 2, 3].map(i => `${f}_0${i}_${s}`))]);
// world points (model frame, metres): elbow = lowerarm origin, wrist = hand origin, knuckle = middle_01 origin, fingertip-ish = middle_03 origin,
// palm = the middle of wrist and knuckle (where the supporting hand touches the elbow)
export const POINTS = ['lowerarm_l', 'hand_l', 'middle_01_l', 'middle_03_l', 'index_03_l', 'thumb_03_l', 'lowerarm_r', 'hand_r', 'middle_01_r', 'middle_03_r', 'index_03_r', 'thumb_03_r'];
export function pointsAt(keys, t) {
    const fk = fkAt(POST, poseAt({ poseKeys: keys }, t), 'rest'), o = {};
    for (const n of POINTS) o[n] = fk.P(n);
    o.palm_l = o.hand_l.clone().lerp(o.middle_01_l, 0.5); o.palm_r = o.hand_r.clone().lerp(o.middle_01_r, 0.5);
    return o;
}
// local delta track of a bone (unit quats, sign-continuous)
export function track(keys, bone, ts) {
    const out = []; let prev = null;
    for (const t of ts) {
        const d = poseAt({ poseKeys: keys }, t), a = d && d[bone] ? d[bone] : [0, 0, 0, 1];
        const q = new THREE.Quaternion().fromArray(a).normalize();
        if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        out.push(q); prev = q;
    }
    return out;
}
// rotation vector (radians) of b * a^-1
export function rotvec(a, b) {
    const d = b.clone().multiply(a.clone().invert()); if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
    const s = Math.hypot(d.x, d.y, d.z); if (s < 1e-12) return new THREE.Vector3();
    const ang = 2 * Math.atan2(s, d.w); return new THREE.Vector3(d.x, d.y, d.z).multiplyScalar(ang / s);
}
export const angDeg = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * R2D;
export const range = (t0, t1, hz) => { const n = Math.round((t1 - t0) * hz), o = []; for (let i = 0; i <= n; i++) o.push(Math.round((t0 + i / hz) * 1e6) / 1e6); return o; };
// gaussian-smoothed copy of a quaternion track (sign-continuous input), sigma in samples
export function smoothQ(qs, sigma) {
    const r = Math.ceil(3 * sigma), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-k * k / (2 * sigma * sigma)));
    return qs.map((_, i) => {
        let x = 0, y = 0, z = 0, ww = 0, sw = 0;
        for (let k = -r; k <= r; k++) { const j = Math.min(qs.length - 1, Math.max(0, i + k)), q = qs[j], c = w[k + r]; x += q.x * c; y += q.y * c; z += q.z * c; ww += q.w * c; sw += c; }
        return new THREE.Quaternion(x / sw, y / sw, z / sw, ww / sw).normalize();
    });
}
// Jitter metrics of one bone over a window, from a track sampled at hz:
//   resid: deg, max angle between the track and its gaussian low-pass (sigma 0.1 s) = the high-frequency shake
//   accRms: RMS angular acceleration (deg/s^2) at 30 fps (the render rate)
//   jerkRms: RMS angular jerk (deg/s^3) at 30 fps
//   flips: reversals of the angular velocity at 30 fps (consecutive frame velocities with a negative dot product, both above 5 deg/s)
export function jitter(qs, hz) {
    const lp = smoothQ(qs, 0.1 * hz); let resid = 0, residSq = 0;
    qs.forEach((q, i) => { const a = angDeg(q, lp[i]); resid = Math.max(resid, a); residSq += a * a; });
    const step = Math.max(1, Math.round(hz / 30)), f = qs.filter((_, i) => i % step === 0), fps = hz / step;
    const w = []; for (let i = 1; i < f.length; i++) w.push(rotvec(f[i - 1], f[i]).multiplyScalar(fps * R2D));
    const a = []; for (let i = 1; i < w.length; i++) a.push(w[i].clone().sub(w[i - 1]).multiplyScalar(fps));
    const j = []; for (let i = 1; i < a.length; i++) j.push(a[i].clone().sub(a[i - 1]).multiplyScalar(fps));
    let flips = 0; for (let i = 1; i < w.length; i++) if (w[i].length() > 5 && w[i - 1].length() > 5 && w[i].dot(w[i - 1]) < 0) flips++;
    const rms = v => v.length ? Math.sqrt(v.reduce((s, x) => s + x.lengthSq(), 0) / v.length) : 0;
    return { resid, residRms: Math.sqrt(residSq / qs.length), accRms: rms(a), jerkRms: rms(j), flips, peakW: Math.max(0, ...w.map(x => x.length())) };
}
// the same for a world point track (metres): residual (cm) to its low-pass, RMS accel (m/s^2) and jerk at 30 fps, velocity reversals (> 2 cm/s)
export function jitterP(ps, hz) {
    const sigma = 0.1 * hz, r = Math.ceil(3 * sigma), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-k * k / (2 * sigma * sigma)));
    let resid = 0; ps.forEach((p, i) => { const s = new THREE.Vector3(); let sw = 0; for (let k = -r; k <= r; k++) { const j = Math.min(ps.length - 1, Math.max(0, i + k)); s.addScaledVector(ps[j], w[k + r]); sw += w[k + r]; } resid = Math.max(resid, p.distanceTo(s.multiplyScalar(1 / sw)) * 100); });
    const step = Math.max(1, Math.round(hz / 30)), f = ps.filter((_, i) => i % step === 0), fps = hz / step;
    const v = []; for (let i = 1; i < f.length; i++) v.push(f[i].clone().sub(f[i - 1]).multiplyScalar(fps));
    const a = []; for (let i = 1; i < v.length; i++) a.push(v[i].clone().sub(v[i - 1]).multiplyScalar(fps));
    const j = []; for (let i = 1; i < a.length; i++) j.push(a[i].clone().sub(a[i - 1]).multiplyScalar(fps));
    let flips = 0; for (let i = 1; i < v.length; i++) if (v[i].length() > 0.02 && v[i - 1].length() > 0.02 && v[i].dot(v[i - 1]) < 0) flips++;
    const rms = x => x.length ? Math.sqrt(x.reduce((s, y) => s + y.lengthSq(), 0) / x.length) : 0;
    return { resid, accRms: rms(a), jerkRms: rms(j), flips };
}
