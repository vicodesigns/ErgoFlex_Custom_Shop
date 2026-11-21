// Shared measurement lib for the rise elbow pull: Maya's rig, her posture, the pose keys at a time (FK in the model frame:
// metres, y up, facing +z, her left is +x). The same maths as drawPose (bone.quaternion = rest * delta).
import fs from 'node:fs';
import * as THREE from 'three';
import { PersonRig, solveStill } from '../../room-people-motion.mjs';
import { poseAt } from '../../people-pose-keys.mjs';
export { THREE, poseAt };
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export const rig = new PersonRig(JSON.parse(fs.readFileSync(here + '../../assets/props/people-rigs/maya.json', 'utf8')));
export const BONES = ['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'];
const dq = new THREE.Quaternion();
// posture id, deltas {bone: [x,y,z,w]} (null = none), mode 'rest' (the posture as built) or 'solved' (solveStill, as the film does it)
export function fkAt(posture, deltas, mode = 'rest', time = 0) {
    const key = rig.key(posture);
    if (mode === 'solved') solveStill(rig, key, { time, seed: 1, life: 1 }); else { rig.load(key); rig.fk(); }
    if (deltas) {
        for (const [name, d] of Object.entries(deltas)) { const i = rig.index.get(name); rig.lq[i].multiply(dq.fromArray(d)).normalize(); }
        rig.fk();
    }
    const P = n => rig.wp[rig.index.get(n)].clone();
    return { P, Q: n => rig.wq[rig.index.get(n)].clone() };
}
export const cm = v => v.toArray().map(x => Math.round(x * 1000) / 10);
// distance from point p to segment a-b
export function segDist(p, a, b) {
    const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
    return p.distanceTo(a.clone().addScaledVector(ab, t));
}
export function segSeg(a, b, c, d) {   // min distance between two segments (sampled; fine at cm scale)
    let m = 1e9; for (let i = 0; i <= 40; i++) { const p = a.clone().lerp(b, i / 40); m = Math.min(m, segDist(p, c, d)); } return m;
}
