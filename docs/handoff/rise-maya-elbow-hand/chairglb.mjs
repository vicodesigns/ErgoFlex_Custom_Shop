// The task chair GLB's triangles in its own frame (= Maya's model frame during 15.5-23.3 s, per chairhl.mjs), as a probe-like file.
import fs from 'node:fs';
const W = 'file:///C:/Users/Vico/polish-wt/rise-maya-elbow-hand/';
const THREE = await import(W + 'node_modules/three/build/three.module.js');
const { NodeIO } = await import(W + 'node_modules/@gltf-transform/core/dist/index.js');
const { ALL_EXTENSIONS } = await import(W + 'node_modules/@gltf-transform/extensions/dist/index.js');
const { MeshoptDecoder } = await import(W + 'node_modules/meshoptimizer/index.js');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('C:/Users/Vico/polish-wt/rise-maya-elbow-hand/assets/props/steelcase-leap-v2.glb');
const parts = []; const v = new THREE.Vector3();
for (const node of doc.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const M = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const prim of mesh.listPrimitives()) { const P = prim.getAttribute('POSITION'), I = prim.getIndices(), n = I ? I.getCount() : P.getCount(), tris = [];
    for (let k = 0; k < n; k++) { v.fromArray(P.getElement(I ? I.getScalar(k) : k, [])).applyMatrix4(M); tris.push(+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)); }
    const bb = [0, 1, 2].map(c => Math.min(...tris.filter((_, i) => i % 3 === c))).concat([0, 1, 2].map(c => Math.max(...tris.filter((_, i) => i % 3 === c))));
    parts.push({ name: 'chair:' + node.getName(), mat: prim.getMaterial()?.getName() || '', n: n / 3, bb: bb.map(x => +x.toFixed(3)), tris }); } }
fs.writeFileSync(process.argv[2], JSON.stringify({ parts }));
for (const p of parts) console.log(p.name, p.mat, p.n, p.bb.join(','));
