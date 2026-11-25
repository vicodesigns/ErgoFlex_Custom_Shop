// The drawn body of a person, as points on the bones (tests only): every vertex of a built model's skin goes to the bone
// that moves it most, in that bone's own frame, so a solved pose (rig.wp / rig.wq of a PersonRig) puts the points where the
// drawn model has them. Enough to ask whether a hand, a forearm or an elbow is inside a thigh, a knee or the trunk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const HELD = /^Held\./;          // (the wheelchair is not the body)
// { bone name: [[x, y, z, material], ...] } the points in the bone's frame.
export async function bodyPoints(modelId) {
    const doc = await io.read(path.join(ROOT, 'assets/props', modelId + '.glb')), root = doc.getRoot(), skin = root.listSkins()[0];
    const joints = skin.listJoints(), names = joints.map(j => decodeURIComponent(j.getName())), ibm = skin.getInverseBindMatrices().getArray();
    const mats = names.map((_, i) => new THREE.Matrix4().fromArray(ibm, i * 16)), normals = mats.map(m => new THREE.Matrix3().getNormalMatrix(m)), out = {}, v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial()?.getName() || ''; if (HELD.test(mat)) continue;
        const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'); if (!J || !W) continue;
        for (let i = 0; i < P.getCount(); i++) {
            const j = J.getElement(i, []), w = W.getElement(i, []); let b = 0; for (let k = 1; k < 4; k++) if (w[k] > w[b]) b = k;
            const name = names[j[b]]; v.fromArray(P.getElement(i, [])).applyMatrix4(mats[j[b]]);
            const n = N ? nv.fromArray(N.getElement(i, [])).applyMatrix3(normals[j[b]]).normalize() : nv.set(0, 0, 0);
            (out[name] ||= []).push([v.x, v.y, v.z, mat, n.x, n.y, n.z]);
        }
    }
    return out;
}
// The points of the given bones posed on the rig now (rig.fk() current): [[x, y, z, bone, material, nx, ny, nz], ...] in the rig's frame
// (the skin's normal with each).
export function posed(rig, points, bones) {
    const out = [], v = new THREE.Vector3(), n = new THREE.Vector3();
    for (const name of bones) {
        const i = rig.index.get(name); if (i === undefined) continue;
        for (const [x, y, z, mat, nx, ny, nz] of points[name] || []) { v.set(x, y, z).applyQuaternion(rig.wq[i]).add(rig.wp[i]); n.set(nx, ny, nz).applyQuaternion(rig.wq[i]); out.push([v.x, v.y, v.z, name, mat, n.x, n.y, n.z]); }
    }
    return out;
}

// How deep points are inside a limb or the trunk: the limb's skin points are sorted by where they lie along its axis (a to b
// joints) and the angle round it; a point is inside when it is nearer the axis than the skin there. `skin` and `probe` are
// [[x, y, z], ...]. Returns { depth, at } in metres: the deepest point and where it was.
const AX = new THREE.Vector3(), D = new THREE.Vector3(), U1 = new THREE.Vector3(), U2 = new THREE.Vector3(), PT = new THREE.Vector3();
export function insideDepth(a, b, skin, probe, { along = .14, round = .5, from = -.05, to = 1.05 } = {}) {
    AX.copy(b).sub(a); const len = AX.length(); AX.divideScalar(len);
    U1.set(0, 1, 0); if (Math.abs(U1.dot(AX)) > .9) U1.set(1, 0, 0); U1.addScaledVector(AX, -U1.dot(AX)).normalize(); U2.crossVectors(AX, U1);
    const frame = p => { D.set(p[0], p[1], p[2]).sub(a); const s = D.dot(AX) / len; const x = D.dot(U1), y = D.dot(U2); return [s, Math.hypot(x, y), Math.atan2(y, x)]; };
    const cloud = skin.map(frame);
    let depth = 0, at = null;
    for (const p of probe) {
        const [s, r, th] = frame(p); if (s < from || s > to) continue;
        let surface = 0;
        for (const [s2, r2, th2] of cloud) { if (Math.abs(s2 - s) > along) continue; let d = Math.abs(th2 - th); if (d > Math.PI) d = 2 * Math.PI - d; if (d > round) continue; if (r2 > surface) surface = r2; }
        const inside = surface - r; if (inside > depth) { depth = inside; at = p; }
    }
    return { depth, at };
}

// How deep points are in the skin of a body, by the skin's own normals: a point is inside when the nearest skin point has it behind
// its normal, within `reach` of it. `skin`: posed() points with normals; `probe`: [[x, y, z], ...]. Returns { depth, at } in metres.
export function intoSkin(skin, probe, { reach = .06, cell = .04, near = .012 } = {}) {
    const grid = new Map(), key = (x, y, z) => Math.floor(x / cell) + ',' + Math.floor(y / cell) + ',' + Math.floor(z / cell);
    for (const p of skin) { const k = key(p[0], p[1], p[2]); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
    let depth = 0, at = null;
    for (const p of probe) {
        const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell), around = []; let bd = reach * reach;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) for (const q of grid.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)) || []) {
            const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < reach * reach) { around.push([d, q]); if (d < bd) bd = d; }
        }
        if (!around.length) continue;
        // (inside only when every bit of skin about as near as the nearest has the point behind it: a point beside a fold, or between
        // two layers of cloth, is not in the body; and a point has to be among the skin, three bits of it, not near a stray one)
        const limit = (Math.sqrt(bd) + near) ** 2; let into = Infinity, count = 0;
        for (const [d, q] of around) if (d <= limit) { count++; into = Math.min(into, -((p[0] - q[0]) * q[5] + (p[1] - q[1]) * q[6] + (p[2] - q[2]) * q[7])); }
        if (count >= 3 && into > depth) { depth = into; at = p; }
    }
    return { depth, at };
}

// The nearest the probe comes to the skin, metres (skin points only: a few millimetres of slack for the space between them).
export function nearest(skin, probe) {
    let best = Infinity;
    for (const p of probe) for (const q of skin) { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < best) best = d; }
    return Math.sqrt(best);
}

// How far above the skin the probe's lowest point rests, metres, by the skin's normals (nearest skin point, within reach): { clear, at }.
export function resting(skin, probe, { reach = .08, cell = .04 } = {}) {
    const grid = new Map(), key = (x, y, z) => Math.floor(x / cell) + ',' + Math.floor(y / cell) + ',' + Math.floor(z / cell);
    for (const p of skin) { const k = key(p[0], p[1], p[2]); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
    let clear = Infinity, at = null;
    for (const p of probe) {
        const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell); let best = null, bd = reach * reach;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) for (const q of grid.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)) || []) { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < bd) { bd = d; best = q; } }
        if (!best) continue;
        const out = (p[0] - best[0]) * best[5] + (p[1] - best[1]) * best[6] + (p[2] - best[2]) * best[7];
        if (out > 0 && out < clear) { clear = out; at = p; }
    }
    return { clear, at };
}
