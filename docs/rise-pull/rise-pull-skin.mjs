// Linear-blend skinning of Maya's seated mesh (assets/props/people-maya-sit-type.glb, meshopt-compressed) onto the rig's FK, so
// clearances are measured on the real surface (head, ponytail, arms) and not on points. Mesh and rig share the model frame.
import fs from 'node:fs';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { rig } from './rise-pull-lib.mjs';
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const COMP = { 5126: Float32Array, 5123: Uint16Array, 5122: Int16Array, 5125: Uint32Array, 5121: Uint8Array, 5120: Int8Array };
const NORM = { 5122: 32767, 5120: 127, 5121: 255, 5123: 65535 };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
await MeshoptDecoder.ready;
export function loadMesh(file) {
    const b = fs.readFileSync(file), jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString());
    const bin = new Uint8Array(b.buffer, b.byteOffset + 20 + jl + 8, b.length - 28 - jl);
    const views = json.bufferViews.map(v => {
        const e = v.extensions?.EXT_meshopt_compression;
        if (!e) return new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0), v.byteLength).slice();
        const out = new Uint8Array(e.count * e.byteStride);
        MeshoptDecoder.decodeGltfBuffer(out, e.count, e.byteStride, bin.subarray(e.byteOffset, e.byteOffset + e.byteLength), e.mode, e.filter || 'NONE');
        return out;
    });
    const acc = i => { const a = json.accessors[i], n = NCOMP[a.type], T = COMP[a.componentType], view = views[a.bufferView], stride = json.bufferViews[a.bufferView].byteStride || n * T.BYTES_PER_ELEMENT;
        const data = new Float32Array(a.count * n), raw = new T(view.buffer, view.byteOffset, view.byteLength / T.BYTES_PER_ELEMENT), per = stride / T.BYTES_PER_ELEMENT;
        for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { let x = raw[k * per + c + (a.byteOffset || 0) / T.BYTES_PER_ELEMENT]; if (a.normalized) x = Math.max(-1, x / NORM[a.componentType]); data[k * n + c] = x; }
        return { data, n, count: a.count }; };
    const skin = json.skins[0], jointNames = skin.joints.map(j => json.nodes[j].name), ibm = acc(skin.inverseBindMatrices);
    const prims = json.meshes[0].primitives.map(p => ({ name: json.materials[p.material].name, pos: acc(p.attributes.POSITION), joints: acc(p.attributes.JOINTS_0), weights: acc(p.attributes.WEIGHTS_0) }));
    return { json, jointNames, ibm, prims };
}
export let mesh = loadMesh(here + '../../assets/props/people-maya-sit-type.glb');
// the mesh of another posture (standing: people-maya-stand-type-41)
export function useMesh(posture) { mesh = loadMesh(here + '../../assets/props/' + posture + '.glb'); return mesh; }
export function dominant(prim, i, jointNames) {
    let best = -1, bw = -1; for (let k = 0; k < 4; k++) { const w = prim.weights.data[i * 4 + k]; if (w > bw) { bw = w; best = prim.joints.data[i * 4 + k]; } }
    return jointNames[best];
}
// Skinned vertices: v' = sum w * (Wcur_j * ibm_j) v   (Wcur = the rig's FK now; in the posture as built this is the mesh as exported)
export function skinned(filter = () => true) {
    const M = mesh.jointNames.map((n, j) => { const i = rig.index.get(n); const c = new THREE.Matrix4().compose(rig.wp[i], rig.wq[i], new THREE.Vector3(1, 1, 1)); return c.multiply(new THREE.Matrix4().fromArray(mesh.ibm.data, j * 16)); });
    const out = [], v = new THREE.Vector3(), acc = new THREE.Vector3();
    for (const prim of mesh.prims) for (let i = 0; i < prim.pos.count; i++) {
        const part = dominant(prim, i, mesh.jointNames); if (!filter(part, prim.name)) continue;
        acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = prim.weights.data[i * 4 + k]; if (!w) continue; v.fromArray(prim.pos.data, i * 3).applyMatrix4(M[prim.joints.data[i * 4 + k]]); acc.addScaledVector(v, w); }
        out.push({ p: acc.clone(), part, mat: prim.name });
    }
    return out;
}
