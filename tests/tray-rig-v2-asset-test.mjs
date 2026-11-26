// The keyboard tray rig v2 (assets/props/ergoflex-keyboard-tray-rig-v2.glb, tools/props/tray-rig-v2.mjs, docs/keyboard-tray/SPEC.md 0.5):
// Vico's real unit (option B+): the arm 75 mm bolt to bolt, the forks' pin 27 mm higher, the rear bracket's bolts 38.1 mm forward, and
// NOTHING ELSE of the supplied model changed. Checked against the v1 rig (the supplied model only split), vertex by vertex. Pure node.
//   node tests/tray-rig-v2-asset-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as L from '../experience/tray-limits.mjs';
import { filterEntries } from '../experience/prop-library.mjs';
import * as B from '../tools/props/tray-rig-v2.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const v1 = await io.read(path.join(root, 'assets/props/ergoflex-keyboard-tray-rig.glb')), v2 = await io.read(path.join(root, 'assets/props/ergoflex-keyboard-tray-rig-v2.glb'));
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b} (+-${eps})`);
const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const node = (doc, n) => doc.getRoot().listNodes().find(x => x.getName() === n);
const sk = L.TRAY_SKEW_DEG * Math.PI / 180, toTrack = p => [p[0] * Math.cos(sk) + p[2] * Math.sin(sk), p[1], -p[0] * Math.sin(sk) + p[2] * Math.cos(sk)];
function verts(doc, n) {     // track frame mm
    const nd = node(doc, n), W = nd.getWorldMatrix(), out = [], t = [0, 0, 0];
    for (const prim of nd.getMesh().listPrimitives()) { const pa = prim.getAttribute('POSITION'); for (let i = 0; i < pa.getCount(); i++) { pa.getElement(i, t); out.push(toTrack(mul(W, t).map(v => v * 1000))); } }
    return out;
}
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

{   // the numbers, and the tables that use them
    assert.equal(B.ARM_MM, 75); assert.equal(B.PIN_UP_MM, 27); near(B.BOLTS_FWD_MM, 38.11, 0.01, 'bolts forward'); near(B.ARM_REST_DEG, 14.56, 0.01, 'arm at rest');
    // (tray-limits BASE_TILT_AT / SURFACE_TILT_AT are rig v3's since 26 Nov 2026; v2's bolts are its own REAR_BOLT_V2 / FRONT_BOLT)
    assert.deepEqual(B.REAR_BOLT_V2.map(v => +v.toFixed(2)), [-10, -23.85, 46.86]); assert.deepEqual(B.FRONT_BOLT, [-10, -42.7, 119.45]);
    near(Math.hypot(B.FRONT_BOLT[1] - B.REAR_BOLT_V2[1], B.FRONT_BOLT[2] - B.REAR_BOLT_V2[2]), 75, 1e-6, 'bolt to bolt');
}
{   // the same nodes, pivots, triangles, material as v1
    assert.deepEqual(v2.getRoot().listNodes().map(n => n.getName()).sort(), v1.getRoot().listNodes().map(n => n.getName()).sort());
    for (const p of L.TRAY_PIVOTS) { const a = node(v1, p.name).getWorldMatrix(), b = node(v2, p.name).getWorldMatrix(); a.forEach((v, i) => near(b[i], v, 1e-12, p.name)); }
    for (const m of v2.getRoot().listMeshes()) { const a = v1.getRoot().listMeshes().find(x => x.getName() === m.getName()); assert.deepEqual(Array.from(m.listPrimitives()[0].getIndices().getArray()), Array.from(a.listPrimitives()[0].getIndices().getArray()), m.getName() + ' triangles'); }
    assert.equal(v2.getRoot().listMaterials().length, 1); assert.equal(v2.getRoot().listMaterials()[0].getName(), v1.getRoot().listMaterials()[0].getName());
}
{   // UNCHANGED: track, cross-bar (rod + knob), screw, plate
    for (const n of ['Tray_Track', 'Tray_Crossbar', 'Tray_Screw', 'Tray_Plate']) { const a = verts(v1, n), b = verts(v2, n); assert.equal(a.length, b.length); let w = 0; a.forEach((p, i) => { w = Math.max(w, d(p, b[i])); }); assert.ok(w < 1e-3, `${n} moved ${w} mm`); }
    near(Math.max(...verts(v2, 'Tray_Plate').map(p => p[1])), -19.7, 0.2, 'the plate top is 19.7 mm under the desktop at rest, as ever');
}
{   // FORKS: only the pin piece and its rod, exactly PIN_UP_MM up
    const a = verts(v1, 'Tray_Forks'), b = verts(v2, 'Tray_Forks'); let moved = 0;
    a.forEach((p, i) => { const q = b[i], dy = q[1] - p[1]; near(q[0], p[0], 1e-3, 'u'); near(q[2], p[2], 1e-3, 'w');
        if (Math.abs(dy) > 1e-3) { near(dy, B.PIN_UP_MM, 1e-3, 'the pin goes up 27 mm'); moved++; assert.ok(p[1] > -77 && p[1] < -62 && p[2] > 111 && p[2] < 127, 'only round the pin'); } });
    assert.ok(moved > 700 && moved < 1000, 'the pin piece and its rod moved: ' + moved);
}
{   // CARRIAGE: only forward (w), never across or up/down; the slide block and guide rails untouched; the bolts exactly BOLTS_FWD_MM
    const a = verts(v1, 'Tray_Carriage'), b = verts(v2, 'Tray_Carriage'); let full = 0;
    a.forEach((p, i) => { const q = b[i], dw = q[2] - p[2]; near(q[0], p[0], 1e-3, 'u'); near(q[1], p[1], 1e-3, 'y'); assert.ok(dw > -1e-3 && dw < B.BOLTS_FWD_MM + 1e-3, 'w only forward');
        if (p[1] >= -12) near(dw, 0, 1e-3, 'above the hanging plates nothing moves'); if (Math.abs(dw - B.BOLTS_FWD_MM) < 1e-3) full++; });
    // the bolt centres (pins at u -56.45 / 36.45) moved by exactly BOLTS_FWD_MM
    const pin = (vs, u, y, w) => { const sel = vs.filter(p => Math.abs(p[0] - u) < 4 && Math.abs(p[1] - y) < 7.5 && Math.abs(p[2] - w) < 7.5); return [0, 1, 2].map(k => sel.reduce((s, p) => s + p[k], 0) / sel.length); };
    for (const u of [-56.45, 36.45]) for (const [y, w] of [[-23.85, 8.75], [-44.6, -1.6]]) { const c1 = pin(a, u, y, w), c2 = pin(b, u, y, w + B.BOLTS_FWD_MM); near(c2[2] - c1[2], B.BOLTS_FWD_MM, 0.05, 'bolt ' + [u, y]); near(c2[1], c1[1], 0.05, 'bolt height'); }
    assert.ok(full > 1500, 'the bolts and the front of the bracket moved whole: ' + full);
}
{   // ARM: 75 mm between its eyes; each half the same shape as before (a rigid move), the rear eye on the new rear bolt, the front on the new pin
    const a = verts(v1, 'Tray_Links'), b = verts(v2, 'Tray_Links'), R = B.REAR_BOLT, F = B.FORK_PIN, Ln = Math.hypot(F[1] - R[1], F[2] - R[2]);
    const half = p => ((p[1] - R[1]) * (F[1] - R[1]) + (p[2] - R[2]) * (F[2] - R[2])) / Ln > Ln / 2;
    const rear = a.map((p, i) => i).filter(i => !half(a[i])), front = a.map((p, i) => i).filter(i => half(a[i]));
    for (const set of [rear, front]) for (let k = 0; k < 300; k++) { const i = set[(k * 7919) % set.length], j = set[(k * 104729 + 7) % set.length]; near(d(b[i], b[j]), d(a[i], a[j]), 1e-3, 'rigid half'); }
    const axisD = (p, c) => Math.hypot(p[1] - c[1], p[2] - c[2]);
    for (const i of rear) near(axisD(b[i], B.REAR_BOLT_V2), axisD(a[i], R), 1e-3, 'the rear eye turns about the rear bolt');
    for (const i of front) near(axisD(b[i], B.FRONT_BOLT), axisD(a[i], F), 1e-3, 'the front eye sits on the front bolt');
}
{   // the build is reproducible, and indexed (hidden), v1 kept (the stage loads v3 since 26 Nov 2026; v2 stays as a fallback)
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tray-v2-')), 'v2.glb'); await B.build({ out: tmp });
    assert.ok(fs.readFileSync(tmp).equals(fs.readFileSync(path.join(root, 'assets/props/ergoflex-keyboard-tray-rig-v2.glb'))), 'tools/props/tray-rig-v2.mjs makes exactly the committed file');
    const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')).props, e = index.find(p => p.id === 'ergoflex-keyboard-tray-rig-v2'), one = index.find(p => p.id === 'ergoflex-keyboard-tray-rig');
    assert.ok(e && one); assert.equal(e.hidden, true); assert.equal(e.tris, 11121); assert.equal(e.bytes, fs.statSync(path.join(root, e.file)).size); assert.deepEqual(filterEntries([e], {}), []); assert.ok(fs.existsSync(path.join(root, one.file)), 'v1 kept');
}
console.log('tray-rig-v2-asset-test: ok (arm 75 mm bolt to bolt, forks pin +27 mm, rear bolts +38.1 mm forward; track, rod, knob, screw, plate untouched; same nodes, triangles, material; reproducible build; indexed, v1 kept)');
