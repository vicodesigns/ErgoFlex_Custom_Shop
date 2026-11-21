// The noticing beat: pose keys for the desk user's standing posture (people-maya-stand-type-41) that turn her head to the
// tablet on the desk (the reminder chimes there) with a small nod, and back to the monitor. Each key is a turn per bone in
// the bone's own frame on top of the solved posture (people-pose-keys.mjs), the same maths as drawPose (bone = rest * delta).
// The world turn (yaw to her left about the vertical, then pitch down about her turned left-right axis) is spread over
// spine_03 / neck_01 / head; every delta is found on the posture as built (FK of the rig).
//   node docs/wellness-order/notice-keys.mjs <start s> [yaw deg=50] [pitch deg=15] [> keys.json]
// Keys: start (neutral), +0.25 glance, +0.45 glance + nod, +0.65 glance, +1.0 neutral (back on the monitor).
import fs from 'node:fs';
import * as THREE from 'three';
import { PersonRig } from '../../room-people-motion.mjs';
const [startA, yawA = '50', pitchA = '15'] = process.argv.slice(2), t0 = +startA;
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const rig = new PersonRig(JSON.parse(fs.readFileSync(here + '../../assets/props/people-rigs/maya.json', 'utf8')));
const POST = 'people-maya-stand-type-41', SPLIT = [['spine_03', .15], ['neck_01', .35], ['head', .5]];
const r4 = x => Math.round(x * 10000) / 10000;
function deltas(yaw, pitch) {
    rig.load(rig.key(POST)); rig.fk();
    const out = {};
    for (const [name, share] of SPLIT) {
        const i = rig.index.get(name), W = rig.wq[i].clone();
        const R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yaw * share))
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(pitch * share)));
        const d = W.clone().invert().multiply(R).multiply(W).normalize();   // W * d = R * W
        rig.lq[i].multiply(d).normalize(); rig.fk();
        out[name] = (d.w < 0 ? [-d.x, -d.y, -d.z, -d.w] : [d.x, d.y, d.z, d.w]).map(r4);
    }
    return out;
}
const Y = +yawA, P = +pitchA, ID = { spine_03: [0, 0, 0, 1], neck_01: [0, 0, 0, 1], head: [0, 0, 0, 1] };
const keys = [{ t: t0, pose: ID }, { t: t0 + .25, pose: deltas(Y, P) }, { t: t0 + .45, pose: deltas(Y, P + 10) }, { t: t0 + .65, pose: deltas(Y, P) }, { t: t0 + 1, pose: ID }].map(k => ({ ...k, t: Math.round(k.t * 1000) / 1000 }));
// check: where the face points at the glance (FK, model frame: +z ahead, +x her left)
rig.load(rig.key(POST)); rig.fk(); const hi = rig.index.get('head'), f0 = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.wq[hi]);
deltas(Y, P); const f1 = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.wq[hi]);
console.error('head forward axis before', f0.toArray().map(r4), 'at the glance', f1.toArray().map(r4), 'turned', r4(THREE.MathUtils.radToDeg(f0.angleTo(f1))), 'deg');
console.log(JSON.stringify(keys));
