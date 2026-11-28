// Linear-blend skinned body of a people model (as the renderer draws it), plus signed point-vs-skin depth by the nearest triangle.
const W = 'file:///C:/Users/Vico/polish-wt/rise-maya-elbow-hand/';
export const THREE = await import(W + 'node_modules/three/build/three.module.js');
const { NodeIO } = await import(W + 'node_modules/@gltf-transform/core/dist/index.js');
const { ALL_EXTENSIONS } = await import(W + 'node_modules/@gltf-transform/extensions/dist/index.js');
const { MeshoptDecoder } = await import(W + 'node_modules/meshoptimizer/index.js');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
export const HANDRE = s => new RegExp(`^(hand|thumb_0\\d|index_0\\d|middle_0\\d|ring_0\\d|pinky_0\\d)_${s}$`);

export async function loadModel(id) {
  const doc = await io.read(`C:/Users/Vico/polish-wt/rise-maya-elbow-hand/assets/props/${id}.glb`), root = doc.getRoot(), skin = root.listSkins()[0];
  const names = skin.listJoints().map(j => decodeURIComponent(j.getName())), ibm = skin.getInverseBindMatrices().getArray();
  const ibms = names.map((_, i) => new THREE.Matrix4().fromArray(ibm, i * 16));
  const pos = [], nrm = [], jw = [], dom = [], mat = [], tris = [];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const m = prim.getMaterial()?.getName() || ''; if (/^Held\./.test(m)) continue;
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), J = prim.getAttribute('JOINTS_0'), Wt = prim.getAttribute('WEIGHTS_0'), I = prim.getIndices(); if (!J || !Wt) continue;
    const base = pos.length;
    for (let i = 0; i < P.getCount(); i++) {
      pos.push(P.getElement(i, [])); nrm.push(N ? N.getElement(i, []) : [0, 0, 0]);
      const j = J.getElement(i, []), w = Wt.getElement(i, []); jw.push([j, w]); let b = 0; for (let k = 1; k < 4; k++) if (w[k] > w[b]) b = k; dom.push(names[j[b]]); mat.push(m);
    }
    const n = I ? I.getCount() : P.getCount(); for (let k = 0; k + 2 < n; k += 3) tris.push([0, 1, 2].map(q => base + (I ? I.getScalar(k + q) : k + q)));
  }
  return { names, ibms, pos, nrm, jw, dom, mat, tris };
}
// bones: { name: [x,y,z,qx,qy,qz,qw] } (model frame) -> skinning matrices per joint
export function skinMats(model, bones) {
  const S = [], M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < model.names.length; i++) { const b = bones[model.names[i]]; if (!b) { S.push(null); continue; } M.compose(p.fromArray(b), q.fromArray(b, 3), one); S.push(M.clone().multiply(model.ibms[i])); }
  return S;
}
// skinned positions + normals of vertex list idx (default all): Float64Array 6 per vertex
export function skinVerts(model, S, idx = null) {
  const list = idx || model.pos.map((_, i) => i), out = new Float64Array(list.length * 6), v = new THREE.Vector3(), n = new THREE.Vector3(), a = new THREE.Vector3(), an = new THREE.Vector3();
  list.forEach((vi, k) => {
    const [j, w] = model.jw[vi]; a.set(0, 0, 0); an.set(0, 0, 0);
    for (let c = 0; c < 4; c++) { if (!w[c]) continue; const m = S[j[c]]; if (!m) continue; v.fromArray(model.pos[vi]).applyMatrix4(m); a.addScaledVector(v, w[c]); n.fromArray(model.nrm[vi]).transformDirection(m); an.addScaledVector(n, w[c]); }
    an.normalize(); out[k * 6] = a.x; out[k * 6 + 1] = a.y; out[k * 6 + 2] = a.z; out[k * 6 + 3] = an.x; out[k * 6 + 4] = an.y; out[k * 6 + 5] = an.z;
  });
  return out;
}
// target: triangles (vertex index triples whose 3 vertices are all in `keep`) of the full skinned array X, near box [lo, hi]
export function targetTris(model, X, keep, lo, hi, pad = .05) {
  const T = [], cell = .015, grid = new Map();
  for (const t of model.tris) {
    if (!keep(t[0]) || !keep(t[1]) || !keep(t[2])) continue;
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const v of t) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], X[v * 6 + c]); mx[c] = Math.max(mx[c], X[v * 6 + c]); }
    if (mx[0] < lo[0] - pad || mn[0] > hi[0] + pad || mx[1] < lo[1] - pad || mn[1] > hi[1] + pad || mx[2] < lo[2] - pad || mn[2] > hi[2] + pad) continue;
    const k = T.length; T.push({ a: t.map(v => [X[v * 6], X[v * 6 + 1], X[v * 6 + 2]]), dom: model.dom[t[0]], mat: model.mat[t[0]] });
    for (let x = Math.floor(mn[0] / cell); x <= Math.floor(mx[0] / cell); x++) for (let y = Math.floor(mn[1] / cell); y <= Math.floor(mx[1] / cell); y++) for (let z = Math.floor(mn[2] / cell); z <= Math.floor(mx[2] / cell); z++) { const key = x + ',' + y + ',' + z; (grid.get(key) || grid.set(key, []).get(key)).push(k); }
  }
  for (const t of T) { const [a, b, c] = t.a, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; t.n = n.map(x => x / l); }
  return { T, grid, cell };
}
function closest(p, [a, b, c]) {  // closest point on triangle (Ericson)
  const sub = (x, y) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]], dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
// signed distance of p to the target skin: nearest triangle within `reach`; <0 inside (behind the face). null when none near.
// (the sign is taken from the faces whose closest point is within 0.5 mm of the nearest: inside only if all of them have p behind)
export function signedDist(tg, p, reach = .03) {
  const { T, grid, cell } = tg, r = Math.ceil(reach / cell), cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
  const seen = new Set(), cand = [];
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) for (const t of grid.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)) || []) { if (seen.has(t)) continue; seen.add(t); const q = closest(p, T[t].a); const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (d < reach) cand.push([d, t, q]); }
  if (!cand.length) return null;
  cand.sort((x, y) => x[0] - y[0]); const d0 = cand[0][0]; let inside = true, n = 0;
  for (const [d, t, q] of cand) { if (d > d0 + .0005) break; n++; const nn = T[t].n; if ((p[0] - q[0]) * nn[0] + (p[1] - q[1]) * nn[1] + (p[2] - q[2]) * nn[2] > 0) inside = false; }
  return { d: inside ? -d0 : d0, dom: T[cand[0][1]].dom, mat: T[cand[0][1]].mat };
}
