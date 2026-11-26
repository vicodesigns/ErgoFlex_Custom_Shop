// The keyboard tray rig v3 (assets/props/ergoflex-keyboard-tray-rig-v3.glb, tools/props/tray-rig-v3.mjs, docs/keyboard-tray/SPEC.md 0.6):
// Vico's own model of his real tray, his pose "pulled out" split at his 18 parts and nothing else. Pure node.
//   node tests/tray-rig-v3-asset-test.mjs          (with his model at docs/reference/keyboard-tray-real-20261125/vico-model/Keyboard_Tray.glb,
//                                                   or TRAY_V3_SOURCE=<path>, it also rebuilds the glb and checks every vertex against his file)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as L from '../experience/tray-limits.mjs';
import { filterEntries } from '../experience/prop-library.mjs';
import * as B from '../tools/props/tray-rig-v3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, B.OUT), doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b} (+-${eps})`);
const nodes = new Map(doc.getRoot().listNodes().map(n => [n.getName(), n]));
const sk = L.TRAY_SKEW_DEG * Math.PI / 180, toTrack = p => [p[0] * Math.cos(sk) + p[2] * Math.sin(sk), p[1], -p[0] * Math.sin(sk) + p[2] * Math.cos(sk)];
const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const at = name => toTrack(nodes.get(name).getWorldTranslation().map(v => v * 1000));
function verts(name) { const n = nodes.get(name), W = n.getWorldMatrix(), a = n.getMesh().listPrimitives()[0].getAttribute('POSITION'), t = [0, 0, 0], out = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, t); out.push(toTrack(mul(W, t).map(v => v * 1000))); } return out; }
const box = vs => [0, 1, 2].map(k => [Math.min(...vs.map(p => p[k])), Math.max(...vs.map(p => p[k]))]);

{   // the hierarchy: root > mount (the skew) > slide > swing > base tilt > surface tilt; his 18 parts under the pivot tray-limits names
    const chain = { Tray_Mount: 'Tray', Tray_Slide: 'Tray_Mount', Tray_Swing: 'Tray_Slide', Tray_BaseTilt: 'Tray_Swing', Tray_SurfaceTilt: 'Tray_BaseTilt' };
    for (const [n, p] of Object.entries(chain)) assert.equal(nodes.get(n).getParentNode()?.getName(), p, n);
    for (const [part, pivot] of Object.entries(L.TRAY_V3_PARTS)) { const n = nodes.get(part); assert.ok(n?.getMesh(), part); assert.equal(n.getParentNode().getName(), pivot, part); assert.deepEqual([...n.getTranslation(), ...n.getRotation(), ...n.getScale()], [0, 0, 0, 0, 0, 0, 1, 1, 1, 1], part + ': identity'); }
    assert.equal(doc.getRoot().listMeshes().length, 18); assert.equal(Object.keys(L.TRAY_V3_PARTS).length, 18); assert.deepEqual(B.PARTS.map(p => p.name).sort(), Object.keys(L.TRAY_V3_PARTS).sort());
    const q = nodes.get('Tray_Mount').getRotation(); near(2 * Math.asin(-q[1]) * 180 / Math.PI, L.TRAY_SKEW_DEG, 1e-9, 'the mount carries the supplied tray\'s skew');
    for (const n of Object.keys(chain).slice(1)) assert.deepEqual(nodes.get(n).getRotation(), [0, 0, 0, 1], n + ' has no rotation of its own (local X = the bolts)');
    let v = 0, t = 0; for (const m of doc.getRoot().listMeshes()) { const p = m.listPrimitives()[0]; v += p.getAttribute('POSITION').getCount(); t += p.getIndices().getCount() / 3; }
    assert.equal(v, 5703, 'his P0 vertices'); assert.equal(t, 5978, 'his P0 triangles'); assert.equal(doc.getRoot().listMaterials().length, 1);
}
{   // the pivots on his bolts = tray-limits; the platform where the supplied tray's plate is; his top plate 7.23 mm under the desktop
    const p = (n, want) => { const a = at(n); for (let k = 0; k < 3; k++) near(a[k], want[k], 1e-6, n + ' ' + k); };
    p('Tray_BaseTilt', L.BASE_TILT_AT); p('Tray_SurfaceTilt', L.SURFACE_TILT_AT); p('Tray_Swing', L.SWING_AT); p('Tray_Slide', L.SWING_AT);
    for (const [n, want] of Object.entries(B.PIVOTS)) p(n, want);
    const plate = box(verts('Tray_Plate')); near(plate[1][1], B.OLD_PLATE.top, 0.01, 'platform top = the supplied plate top'); near((plate[0][0] + plate[0][1]) / 2, B.OLD_PLATE.u, 0.01, 'u'); near((plate[2][0] + plate[2][1]) / 2, B.OLD_PLATE.w, 0.01, 'w');
    near(plate[0][1] - plate[0][0], 469.9, 0.2, 'his platform 18.5 in wide'); near(plate[2][1] - plate[2][0], 215.9, 0.2, '8.5 in deep');
    const mount = box(verts('Tray_MountPlate')); near(-mount[1][1], L.MOUNT_GAP_MM, 0.01, 'his top plate under the desktop'); near(L.MOUNT_GAP_MM, B.MOUNT_GAP_MM, 0.005, 'the build says the same');
    near(L.PLATE_BELOW_TRACK_MM, -B.OLD_PLATE.top, 1e-9, 'the platform depth the limits use');
    // the arm's bolts as tray-limits' ARM_BOLTS (the platform depth under the desk as the arm goes down)
    near(L.SURFACE_TILT_AT[2] - L.BASE_TILT_AT[2], L.ARM_BOLTS.dw, 0.01, 'dw'); near(L.SURFACE_TILT_AT[1] - L.BASE_TILT_AT[1], L.ARM_BOLTS.dy, 0.01, 'dy');
    // the bolts' meshes are round the pivots (their centre lines)
    for (const [mesh, pivot] of [['Tray_Bolt_RearUpper', L.BASE_TILT_AT], ['Tray_Bolt_FrontUpper', L.SURFACE_TILT_AT]]) { const b = box(verts(mesh)); near((b[1][0] + b[1][1]) / 2, pivot[1], 0.01, mesh + ' y'); near((b[2][0] + b[2][1]) / 2, pivot[2], 0.01, mesh + ' w'); }
}
{   // the slide: 140.1 mm back (his P2) keeps the rear bracket on his top plate
    const plate = box(verts('Tray_MountPlate')), bracket = box([...verts('Tray_Bracket_L'), ...verts('Tray_Bracket_R')]);
    assert.ok(bracket[2][0] - L.SLIDE_TRAVEL_MM > plate[2][0], 'pulled in, the bracket is still on the plate'); assert.ok(bracket[2][1] <= plate[2][1] + 1e-6, 'out, it is not past the plate\'s front');
}
{   // reproducible from his file, vertex by vertex his P0 parts (only with his model at hand)
    const src = [process.env.TRAY_V3_SOURCE, path.join(root, B.SOURCE)].find(f => f && fs.existsSync(f));
    if (src) {
        const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tray-v3-')), 'v3.glb'); await B.build({ source: src, out: tmp });
        assert.ok(fs.readFileSync(tmp).equals(fs.readFileSync(file)), 'tools/props/tray-rig-v3.mjs makes exactly the committed file');
        const his = await B.readSource(src);
        for (const part of B.PARTS) {
            const mine = verts(part.name), h = his[part.node]; assert.equal(mine.length, h.P.length / 3, part.name);
            let worst = 0; mine.forEach((p, i) => { const q = B.toTrack([h.P[i * 3], h.P[i * 3 + 1], h.P[i * 3 + 2]]); worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); });
            assert.ok(worst < 1e-3, `${part.name}: ${worst} mm from his vertices`);
            assert.deepEqual(Array.from(doc.getRoot().listMeshes().find(m => m.getName() === part.name).listPrimitives()[0].getIndices().getArray()), h.T, part.name + ' triangles');
        }
    } else console.log('(his model is not in this checkout: the rebuild and vertex check were skipped; TRAY_V3_SOURCE=<Keyboard_Tray.glb> runs them)');
}
{   // indexed (hidden), v1 and v2 kept, the stage loads v3
    const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')).props, e = index.find(p => p.id === 'ergoflex-keyboard-tray-rig-v3');
    assert.ok(e); assert.equal(e.hidden, true); assert.equal(e.tris, 5978); assert.equal(e.bytes, fs.statSync(file).size); assert.deepEqual(filterEntries([e], {}), []);
    for (const id of ['ergoflex-keyboard-tray-rig', 'ergoflex-keyboard-tray-rig-v2']) assert.ok(fs.existsSync(path.join(root, index.find(p => p.id === id).file)), id + ' kept');
    assert.match(fs.readFileSync(path.join(root, 'experience/tray-rig.mjs'), 'utf8'), /RIG_ID = 'ergoflex-keyboard-tray-rig-v3'/, 'the stage loads v3');
}
console.log('tray-rig-v3-asset-test: ok (his 18 parts, 5703 vertices, 5978 triangles, nothing added; pivots on his bolts = tray-limits; platform on the supplied plate, his top plate 7.23 mm under the desktop; slide stays on the plate; indexed, v1 and v2 kept)');
