// Arm IK from directions, pose-key deltas and mesh clearances for Maya's seated / standing posture (model frame, cm in the
// numbers, metres in the rig). Used by solve-pull.mjs (the optimiser) and measure-pull.mjs (the verification).
import * as THREE from 'three';
import { rig, fkAt } from './rise-pull-lib.mjs';
import { mesh, skinned, dominant } from './rise-pull-skin.mjs';
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Qn = () => new THREE.Quaternion();
export const arcQ = (a, b) => Qn().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
export const SIDES = { l: 1, r: -1 };
const finger = s => 'middle_01_' + s;
// partition of the mesh vertices by what bone they follow
export const partOf = (part, mat) => {
    if (/^(upperarm|lowerarm|hand)_([lr])$/.test(part)) return part.slice(-1) === 'l' ? 'armL' : 'armR';
    if (/^(index|middle|ring|pinky|thumb)_0\d_([lr])$/.test(part)) return part.slice(-1) === 'l' ? 'handL' : 'handR';
    return null;
};
// IK pose of one arm from world directions. Returns the quaternion deltas {upperarm_s, lowerarm_s, hand_s} relative to the posture's local rotations.
// d1: upper arm direction (shoulder -> elbow), d2: forearm direction (elbow -> wrist), d3: hand direction (wrist -> knuckles), roll: degrees about d3.
export function armDeltas(posture, s, d1, d2, d3, roll = 0, preDeltas = null) {
    fkAt(posture, preDeltas, 'rest');
    const I = n => rig.index.get(n), up = I('upperarm_' + s), lo = I('lowerarm_' + s), ha = I('hand_' + s), cl = I('clavicle_' + s), fi = I(finger(s));
    const S = rig.wp[up].clone(), E0 = rig.wp[lo].clone(), W0 = rig.wp[ha].clone(), F0 = rig.wp[fi].clone();
    const wU0 = rig.wq[up].clone(), wL0 = rig.wq[lo].clone(), wH0 = rig.wq[ha].clone(), wC = rig.wq[cl].clone();
    const lU0 = rig.lq[up].clone(), lL0 = rig.lq[lo].clone(), lH0 = rig.lq[ha].clone();
    const q1 = arcQ(E0.clone().sub(S), d1), wU = q1.clone().multiply(wU0);
    const q2 = arcQ(W0.clone().sub(E0).applyQuaternion(q1), d2), wL = q2.clone().multiply(q1).multiply(wL0);
    const q3 = arcQ(F0.clone().sub(W0).applyQuaternion(q2.clone().multiply(q1)), d3), wH0b = q2.clone().multiply(q1).multiply(wH0);
    const q4 = Qn().setFromAxisAngle(d3.clone().normalize(), roll * Math.PI / 180), wH = q4.multiply(q3).multiply(wH0b);
    const lU = wC.clone().invert().multiply(wU), lL = wU.clone().invert().multiply(wL), lH = wL.clone().invert().multiply(wH);
    const dl = (a, b) => { const q = a.clone().invert().multiply(b).normalize(); if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w); return q.toArray().map(v => Math.round(v * 1e4) / 1e4 + 0); };
    return { ['upperarm_' + s]: dl(lU0, lU), ['lowerarm_' + s]: dl(lL0, lL), ['hand_' + s]: dl(lH0, lH) };
}
export const dirFrom = (theta, phi) => V3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));   // theta from +y, phi from +z toward +x
// ---- mesh groups -------------------------------------------------------------------------------------------------------
// static parts (head, neck, ponytail, torso) from the posture as it is in the rig now; arms re-skinned per evaluation
export function buildGroups(posture) {
    fkAt(posture, null, 'rest');
    const all = skinned(), grp = { head: [], neck: [], pony: [], torso: [] };
    for (const v of all) {
        if (v.mat === 'Human.ponytail01') grp.pony.push(v.p);
        else if (v.part === 'head') grp.head.push(v.p);
        else if (v.part === 'neck_01') grp.neck.push(v.p);
        else if (/^(spine|clavicle|pelvis)/.test(v.part) && v.mat !== 'Human.ponytail01') grp.torso.push(v.p);
    }
    return grp;
}
// arm vertex lists (indexes into prims) for skinning per evaluation
export function armVerts(step = 1) {
    const lists = { armL: [], armR: [], handL: [], handR: [] }, jn = mesh.jointNames;
    mesh.prims.forEach((prim, pi) => {
        if (prim.name === 'Human.teeth_base') return;
        for (let i = 0; i < prim.pos.count; i += step) { const part = dominant(prim, i, jn), g = partOf(part, prim.name); if (g) lists[g].push({ pi, i, bone: part }); }
    });
    return lists;
}
export function skinList(list) {
    const jn = mesh.jointNames, M = jn.map((n, j) => new THREE.Matrix4().compose(rig.wp[rig.index.get(n)], rig.wq[rig.index.get(n)], V3(1, 1, 1)).multiply(new THREE.Matrix4().fromArray(mesh.ibm.data, j * 16)));
    const out = new Array(list.length), v = V3();
    list.forEach((e, k) => { const prim = mesh.prims[e.pi], acc = V3(); for (let c = 0; c < 4; c++) { const w = prim.weights.data[e.i * 4 + c]; if (!w) continue; v.fromArray(prim.pos.data, e.i * 3).applyMatrix4(M[prim.joints.data[e.i * 4 + c]]); acc.addScaledVector(v, w); } out[k] = acc; });
    return out;
}
// spatial hash for nearest distance
export class Grid {
    constructor(pts, cell = 0.015) { this.cell = cell; this.m = new Map(); this.pts = pts; for (const p of pts) { const k = this.key(p); (this.m.get(k) || this.m.set(k, []).get(k)).push(p); } }
    key(p) { return Math.floor(p.x / this.cell) + ',' + Math.floor(p.y / this.cell) + ',' + Math.floor(p.z / this.cell); }
    // distance to the nearest point, capped at `cap` (cells searched: cap / cell)
    near(p, cap = 0.03) {
        const r = Math.ceil(cap / this.cell), cx = Math.floor(p.x / this.cell), cy = Math.floor(p.y / this.cell), cz = Math.floor(p.z / this.cell); let best = cap * cap;
        for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) { const a = this.m.get(x + ',' + y + ',' + z); if (a) for (const q of a) { const d = p.distanceToSquared(q); if (d < best) best = d; } }
        return Math.sqrt(best);
    }
}
export const cmv = v => v.toArray().map(x => Math.round(x * 1000) / 10);
