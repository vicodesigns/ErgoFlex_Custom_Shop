// The keyboard tray rig glb (assets/props/ergoflex-keyboard-tray-rig.glb, docs/keyboard-tray/SPEC.md section 3): named pivot nodes at the
// hinge points of experience/tray-limits.mjs, the CAD's skew carried by the nodes, the rest pose identical to the rigid glb, the slide
// travel the track really allows. Pure node, no browser.   node tests/tray-rig-asset-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as L from '../experience/tray-limits.mjs';
import { filterEntries } from '../experience/prop-library.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const rig = await io.read(path.join(root, 'assets/props/ergoflex-keyboard-tray-rig.glb')), rigid = await io.read(path.join(root, 'assets/props/ergoflex-keyboard-tray.glb'));
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b} (+-${eps})`);
const mm = v => v.map(c => c * 1000);
const byName = new Map(rig.getRoot().listNodes().map(n => [n.getName(), n]));
const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
// world-space vertices of a node's mesh, mm
function worldVertices(node) {
    const W = node.getWorldMatrix(), out = [], t = [0, 0, 0];
    for (const prim of node.getMesh().listPrimitives()) { const a = prim.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, t); out.push(mm(mul(W, t))); } }
    return out;
}
const bounds = vs => [0, 1, 2].map(i => [Math.min(...vs.map(v => v[i])), Math.max(...vs.map(v => v[i]))]);
const triCount = doc => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);

{   // node names and the hierarchy: Tray > Drop > (Track, Slide > (Carriage, Swing > (Links, Tilt > (Forks, Crossbar, Plate, Screw))))
    const wanted = [...L.TRAY_PIVOTS.map(p => p.name), ...Object.keys(L.TRAY_PARTS)];
    assert.deepEqual([...byName.keys()].sort(), wanted.sort(), 'exactly the named nodes, no strays');
    const scene = rig.getRoot().listScenes()[0]; assert.deepEqual(scene.listChildren().map(n => n.getName()), ['Tray'], 'one root, Tray');
    for (const p of L.TRAY_PIVOTS) { const parent = byName.get(p.name).getParentNode(); assert.equal(parent?.getName() ?? null, p.parent, p.name + ' parent'); assert.ok(!byName.get(p.name).getMesh(), p.name + ' is a pure pivot'); }
    for (const [part, pivot] of Object.entries(L.TRAY_PARTS)) { const n = byName.get(part); assert.equal(n.getParentNode().getName(), pivot, part + ' parent'); assert.ok(n.getMesh() && n.listChildren().length === 0, part + ' is a mesh leaf'); }
    // the pivots carry no scale (the quantisation scale sits on the mesh nodes only), so a joint can be set from plain numbers
    for (const p of L.TRAY_PIVOTS) near(Math.hypot(...byName.get(p.name).getScale()), Math.sqrt(3), 1e-9, p.name + ' scale');
    assert.deepEqual(byName.get('Tray').getTranslation(), [0, 0, 0]); assert.deepEqual(byName.get('Tray').getRotation(), [0, 0, 0, 1]);
}
{   // pivot positions (world, rest pose, mm) against the joint table in tray-limits.mjs; axes: the skew lives in Tray_Slide only
    for (const p of L.TRAY_PIVOTS) { const w = mm(byName.get(p.name).getWorldTranslation()); for (let i = 0; i < 3; i++) near(w[i], p.at[i], 0.5, `${p.name} world ${'xyz'[i]}`); }
    const s = Math.sin(L.TRAY_SKEW_DEG * Math.PI / 180), c = Math.cos(L.TRAY_SKEW_DEG * Math.PI / 180);
    for (const p of L.TRAY_PIVOTS) {
        const n = byName.get(p.name), W = n.getWorldMatrix(), skewed = ['Tray_Slide', 'Tray_Swing', 'Tray_Tilt'].includes(p.name);
        const xAxis = [W[0], W[1], W[2]], yAxis = [W[4], W[5], W[6]], zAxis = [W[8], W[9], W[10]];
        near(yAxis[1], 1, 1e-6, p.name + ' Y is vertical'); near(Math.hypot(...xAxis), 1, 1e-6, p.name + ' no scale');
        const [ex, ez] = skewed ? [c, s] : [1, 0];      // local X (the tilt / pin axis) is the skewed glTF x; local Z (the track axis) is x turned a quarter
        near(xAxis[0], ex, 1e-4, p.name + ' X.x'); near(xAxis[2], ez, 1e-4, p.name + ' X.z'); near(zAxis[0], skewed ? -s : 0, 1e-4, p.name + ' Z.x'); near(zAxis[2], skewed ? c : 1, 1e-4, p.name + ' Z.z');
        if (!['Tray', 'Tray_Drop', 'Tray_Slide'].includes(p.name)) assert.deepEqual(n.getRotation(), [0, 0, 0, 1], p.name + ' has no rotation of its own (the skew is Tray_Slide\'s)');
    }
    // the skew really is the geometry's: the track plate's long axis and the rod's axis, measured on the vertices (PCA in the xz plane)
    const yaw = vs => { const n = vs.length, mx = vs.reduce((a, v) => a + v[0], 0) / n, mz = vs.reduce((a, v) => a + v[2], 0) / n; let sxx = 0, szz = 0, sxz = 0; for (const v of vs) { const x = v[0] - mx, z = v[2] - mz; sxx += x * x; szz += z * z; sxz += x * z; } return 0.5 * Math.atan2(2 * sxz, sxx - szz) * 180 / Math.PI; };   // angle of the major axis from +x toward +z
    const trackYaw = yaw(worldVertices(byName.get('Tray_Track'))), barYaw = yaw(worldVertices(byName.get('Tray_Crossbar')));
    near(Math.abs(trackYaw) - 90, -L.TRAY_SKEW_DEG, 0.6, 'track long axis vs the skew (' + trackYaw.toFixed(2) + ')'); near(barYaw, L.TRAY_SKEW_DEG, 0.6, 'cross-bar / rod axis vs the skew (' + barYaw.toFixed(2) + ')');
}
{   // the pivots sit on the parts they hinge: the tilt axis is the rod, the swing pivot is inside the carriage's footprint, the slide origin is on the track
    const s = Math.sin(L.TRAY_SKEW_DEG * Math.PI / 180), c = Math.cos(L.TRAY_SKEW_DEG * Math.PI / 180), tilt = L.TRAY_PIVOTS.find(p => p.name === 'Tray_Tilt').at;
    const rod = worldVertices(byName.get('Tray_Crossbar')).filter(v => Math.abs((v[0] - tilt[0]) * c + (v[2] - tilt[2]) * s) < 25);      // the rod within 25 mm of the pivot along the axis
    assert.ok(rod.length > 30, 'rod vertices found');
    const ys = rod.map(v => v[1]), perp = rod.map(v => (v[0] - tilt[0]) * -s + (v[2] - tilt[2]) * c);
    near((Math.min(...ys) + Math.max(...ys)) / 2, tilt[1], 1, 'rod centre height = tilt pivot y'); near((Math.min(...perp) + Math.max(...perp)) / 2, 0, 1, 'rod centre fore-aft = tilt pivot');
    const car = bounds(worldVertices(byName.get('Tray_Carriage'))), swing = L.TRAY_PIVOTS.find(p => p.name === 'Tray_Swing').at, slide = L.TRAY_PIVOTS.find(p => p.name === 'Tray_Slide').at;
    for (const at of [swing, slide]) { assert.ok(at[0] > car[0][0] && at[0] < car[0][1] && at[2] > car[2][0] && at[2] < car[2][1] && at[1] > car[1][0] && at[1] < car[1][1], 'pivot inside the carriage box'); }
    const trk = bounds(worldVertices(byName.get('Tray_Track'))); near(L.TRAY_PIVOTS.find(p => p.name === 'Tray_Drop').at[1], trk[1][1], 0.2, 'the mount is the track top (the desktop underside)');
}
{   // the slide: the carriage's rear meets the track's rear end after SLIDE_TRAVEL_MM along the track axis; out, it stops at the front end
    const s = Math.sin(L.TRAY_SKEW_DEG * Math.PI / 180), c = Math.cos(L.TRAY_SKEW_DEG * Math.PI / 180), proj = vs => { const p = vs.map(v => -v[0] * s + v[2] * c); return [Math.min(...p), Math.max(...p)]; };
    const track = proj(worldVertices(byName.get('Tray_Track'))), carriage = proj(worldVertices(byName.get('Tray_Carriage')));
    const travel = carriage[0] - track[0];
    near(travel, L.SLIDE_TRAVEL_MM, 0.6, 'slide travel along the track axis'); assert.ok(L.SLIDE_TRAVEL_MM <= travel + 1e-9, 'never more than the track allows: the carriage stays on the track');
    assert.ok(carriage[1] <= track[1] + 0.5 && track[1] - carriage[1] < 6, 'authored (slide 0) = out at the front stop, ' + (track[1] - carriage[1]).toFixed(1) + ' mm short of the front end');
    assert.ok(L.SLIDE_TRAVEL_MM > 230 && L.SLIDE_TRAVEL_MM < 254, 'between the CAD z-arithmetic 239.5 and the product 254 it is neither: ' + L.SLIDE_TRAVEL_MM);
}
{   // REST POSE = THE RIGID GLB: same bounding box (0.5 mm), same triangles, one material, same size as indexed
    const rigVs = [...byName].filter(([n]) => L.TRAY_PARTS[n]).flatMap(([, n]) => worldVertices(n));
    const rigidVs = rigid.getRoot().listNodes().filter(n => n.getMesh()).flatMap(n => worldVertices(n));
    const a = bounds(rigVs), b = bounds(rigidVs);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) near(a[i][k], b[i][k], 0.5, `rest-pose bounding box ${'xyz'[i]} ${k ? 'max' : 'min'} (rig ${a[i][k].toFixed(2)}, rigid ${b[i][k].toFixed(2)})`);
    assert.equal(triCount(rig), triCount(rigid), 'same triangles'); assert.equal(triCount(rig), 11121);
    assert.equal(rig.getRoot().listMaterials().length, 1, 'one material (finishes are applied by role, workspace-3d.mjs)'); assert.equal(rig.getRoot().listMaterials()[0].getName(), rigid.getRoot().listMaterials()[0].getName());
    // the plate, which stays the riders' frame, is where the rigid one has it
    const plate = bounds(worldVertices(byName.get('Tray_Plate'))), rigidPlate = bounds(worldVertices(rigid.getRoot().listNodes().find(n => n.getName() === 'Mesh_3')));
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) near(plate[i][k], rigidPlate[i][k], 0.5, 'plate bounds');
    near(plate[1][1], -19.7, 0.2, 'plate top is 19.7 mm under the track top (surface.top)');
    // the index entry says the same, and is hidden from the Add prop grid
    const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8')).props, entry = index.find(p => p.id === 'ergoflex-keyboard-tray-rig'), old = index.find(p => p.id === 'ergoflex-keyboard-tray');
    assert.ok(entry && old); assert.deepEqual(entry.size, old.size); assert.deepEqual(entry.min, old.min); assert.deepEqual(entry.max, old.max); assert.equal(entry.tris, old.tris); assert.equal(entry.anchor, old.anchor); assert.equal(entry.hidden, true); assert.ok(!old.hidden);
    assert.deepEqual(filterEntries([entry, old], {}).map(e => e.id), ['ergoflex-keyboard-tray'], 'the rig is not offered in + Add prop');
}
{   // the build: the manifest keeps the hierarchy for the rig only; the rigid asset's entry is as it was
    const man = JSON.parse(fs.readFileSync(path.join(root, 'tools/props/manifest.json'), 'utf8')).props, r = man.find(p => p.id === 'ergoflex-keyboard-tray-rig'), o = man.find(p => p.id === 'ergoflex-keyboard-tray');
    assert.equal(r.rig, 'keyboard-tray'); assert.equal(r.keepHierarchy, true); assert.ok(!o.rig && !o.keepHierarchy, 'the rigid asset is built exactly as before');
    for (const k of ['source', 'rotateY', 'anchor', 'fit', 'budget', 'material', 'repair']) assert.deepEqual(r[k], o[k], k + ' is the rigid entry\'s, so the geometry is the same');
}
console.log('tray-rig-asset-test: ok (named nodes, pivots at the joint table, skew in Tray_Slide, slide travel ' + L.SLIDE_TRAVEL_MM + ' mm, rest pose = rigid glb within 0.5 mm, 11121 tris)');
