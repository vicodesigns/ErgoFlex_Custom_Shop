// The keyboard tray rig on the stage (experience/tray-rig.mjs, docs/keyboard-tray/SPEC.md 3 and 7.1), the film plumbing around it
// (stage.mjs, film-fx.mjs, player.mjs, film-chapters.mjs, film-render.mjs) and the rule that a chapter without tray keys is the
// chapter it always was: no rig loaded, nothing in the scene touched, no new field in any film shot. Pure node: a real GLTFLoader on
// the real glbs, a fake room (api) with the tray, a keyboard and a mouse on a desktop mount.   node tests/tray-rig-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createTrayRig } from '../experience/tray-rig.mjs';
import { activeTrayEdit, cleanTrayEdit, sampleTray, effectiveTrayEdits, mergeTrayEdits, filmTrayEdits, riderThicknessMm } from '../experience/tray-pose.mjs';
import { SLIDE_TRAVEL_MM, TRAY_SKEW_DEG } from '../experience/tray-limits.mjs';
import { filmRenderShot } from '../experience/film-render.mjs';
import { liveFilmShot } from '../experience/film-chapters.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b} (+-${eps})`);
const load = async id => {
    const buf = fs.readFileSync(path.join(root, 'assets/props', id + '.glb')), loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    return (await new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej))).scene;
};
const sources = { 'ergoflex-keyboard-tray': await load('ergoflex-keyboard-tray'), 'ergoflex-keyboard-tray-rig': await load('ergoflex-keyboard-tray-rig') };
let loads = 0;
const instance = id => { loads++; const c = sources[id].clone(true); c.name = 'Prop:' + id; c.userData.propId = id; c.scale.setScalar(1000); return c; };

// A fake room: a desktop mount at the origin; the tray (yawed like the presets', 7.4 degrees), an ergo keyboard and a gaming mouse on its plate.
function room({ stowed = false, onShelf = false } = {}) {
    const scene = new THREE.Group(), mount = new THREE.Group(); mount.name = 'desktop mount'; scene.add(mount);
    const tray = new THREE.Group(); tray.userData.accessoryId = 'keyboard-tray'; tray.position.set(15.9, -28, 202.1); tray.rotation.y = 0.0741 * 2; tray.add(instance('ergoflex-keyboard-tray'));
    mount.add(tray); mount.updateMatrixWorld(true);
    const plate = tray.getObjectByName('Prop:ergoflex-keyboard-tray').getObjectByName('Mesh_3') || null;
    const box = (name, id, w, h, d, at) => {
        const g = new THREE.Group(); g.name = name; g.userData.accessoryId = id; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); g.add(m); m.position.y = h / 2;
        g.position.copy(tray.localToWorld(at.clone())); g.rotation.y = tray.rotation.y; mount.add(g); return g;
    };
    const keyboard = box('keyboard', 'ergo-keyboard', 440, 45, 160, new THREE.Vector3(-37, -19.7, 212)), mouse = box('mouse', 'logitech-mx-master', 70, 47.2, 120, new THREE.Vector3(140, -19.7, 250));
    const far = box('lamp', 'task-light', 60, 300, 60, new THREE.Vector3(0, 400, 0)); far.position.set(900, 0, -300);     // not a rider: not on the plate
    if (stowed) mouse.userData.stowHidden = true;
    mount.updateMatrixWorld(true);
    const objects = new Map([['accessory-keyboard-tray', { obj: tray, saved: {} }], ['accessory-ergo-keyboard', { obj: keyboard, saved: {} }], ['accessory-gaming-mouse', { obj: mouse, saved: {} }], ['accessory-task-light', { obj: far, saved: {} }]]);
    // onShelf: the desk's auto-stow has put the keyboard and mouse on the shelf (desk tilted past 9 deg), as desk-auto-stow.mjs does it:
    // item.autoStow = { parent, transform (their own place), role }, the object re-parented under the shelf mount
    const shelf = new THREE.Group(); shelf.name = 'shelf mount'; shelf.position.set(0, 600, -300); scene.add(shelf);
    if (onShelf) for (const [id, x] of [['accessory-ergo-keyboard', -90], ['accessory-gaming-mouse', 260]]) {
        const item = objects.get(id), o = item.obj, t = { p: { ...o.position }, q: { x: o.quaternion.x, y: o.quaternion.y, z: o.quaternion.z, w: o.quaternion.w }, s: { ...o.scale } };
        item.autoStow = { parent: o.parent, transform: t, role: 'lower-shelf' }; shelf.add(o); o.position.set(x, 0, 0); o.quaternion.identity();
    }
    scene.updateMatrixWorld(true);
    const api = { sceneDesks: { active: { objects } }, workspaceAccessories: { ready: Promise.resolve() }, loadProp: async id => instance(id), disposeObject: () => {} };
    return { scene, mount, tray, keyboard, mouse, api, plate, shelf, objects };
}
const snapshot = scene => { scene.updateMatrixWorld(true); const out = []; scene.traverse(o => out.push([o.name, o.visible, ...o.matrixWorld.elements.map(v => Math.round(v * 1e6) / 1e6), o.parent?.name ?? ''])); return JSON.stringify(out); };
const worldBox = o => new THREE.Box3().setFromObject(o, true);
const named = (o, n) => o.getObjectByName(n);
const worldOf = (o, n) => named(o, n).getWorldPosition(new THREE.Vector3());

{   // NO TRAY KEYS = NOTHING HAPPENS: no rig module work, no glb load, the scene is bit for bit what it was
    const r = room(), before = snapshot(r.scene), n = loads;
    for (const edits of [undefined, null, [], [{}], [{ keys: [] }], [{ initial: { tilt: 0 } }], [{ desk: 'office', keys: [{ t: 1, pose: { tilt: 3 } }] }]]) {
        assert.equal(activeTrayEdit(edits, 'gaming'), null, JSON.stringify(edits));      // (the desk-specific one belongs to the office desk, not the gaming one)
    }
    const rig = createTrayRig(r.api);
    assert.equal(await rig.set(null), false); assert.equal(await rig.set(undefined), false); assert.equal(rig.count(), 0); assert.equal(rig.apply(3), null); rig.restore();
    assert.equal(loads, n, 'the rig glb is never loaded'); assert.equal(snapshot(r.scene), before, 'the scene is untouched');
    // a rig asked for a room with no tray changes nothing either
    const empty = room(); empty.api.sceneDesks.active.objects.delete('accessory-keyboard-tray'); const b2 = snapshot(empty.scene), rig2 = createTrayRig(empty.api);
    assert.equal(await rig2.set(cleanTrayEdit({ keys: [{ t: 1, pose: { tilt: 5 } }] })), false); assert.equal(snapshot(empty.scene), b2); assert.equal(rig2.count(), 0);
}
{   // the entry points load tray-rig.mjs only for a chapter with tray keys (dynamic import behind activeTrayEdit), never at module load
    for (const f of ['experience/stage.mjs', 'tools/experience/film-fx.mjs']) {
        const s = fs.readFileSync(path.join(root, f), 'utf8');
        assert.ok(!/^\s*import[^\n]*tray-rig\.mjs/m.test(s), f + ' must not import tray-rig.mjs statically');
        const at = s.indexOf("import('./tray-rig.mjs')") >= 0 ? s.indexOf("import('./tray-rig.mjs')") : s.indexOf("import('../../experience/tray-rig.mjs')"); assert.ok(at > 0, f + ' imports it dynamically');
        assert.ok(s.slice(Math.max(0, at - 260), at).includes('activeTrayEdit(') || s.slice(Math.max(0, at - 260), at).includes('trayEdit'), f + ': only behind the active-edit check');
    }
    const fx = fs.readFileSync(path.join(root, 'tools/experience/film-fx.mjs'), 'utf8');
    assert.ok(/shot\.sceneTray\?\.length/.test(fx), 'film-fx wants gate includes sceneTray'); assert.ok(!/LIVE_FIELDS = \[[^\]]*sceneTray/.test(fx), 'a changed sceneTray re-installs the film layers (not a live field)');
    for (const f of ['tools/experience/render-cut.cjs', 'tools/experience/render-still.cjs']) assert.ok(/FX_FIELDS=\[[^\]]*'sceneTray'/.test(fs.readFileSync(path.join(root, f), 'utf8')), f + ' passes sceneTray to film-fx');
}
{   // the film shot: no tray keys, no new field, anywhere (every tracked film shot, live and render versions)
    const cuts = ['exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json', 'exports/cinematic-intro-cut-cine/review-cut.json'].filter(f => fs.existsSync(path.join(root, f)));
    let n = 0;
    for (const f of cuts) for (const film of JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).shots) {
        const base = { id: film.id, room: film.room, seconds: film.seconds, kind: film.kind }, a = filmRenderShot(film, base, null), b = liveFilmShot(film, base);
        for (const o of [a, b]) { assert.ok(!('sceneTray' in o) && !('trayEdits' in o), film.id + ' gains no tray field'); }
        assert.deepEqual(mergeTrayEdits(film, base), {}); assert.deepEqual(effectiveTrayEdits(film, base), []); n++;
    }
    assert.ok(n >= 12, 'film shots checked: ' + n);
    // with keys: the Director's replace the film's; the live stage plays them (liveFilmShot drops sceneTray: not played twice), the still / 4K film layer carries them
    const film = { id: 'awareness', room: 'product', seconds: 12, kind: 'proximity', preset: 'gaming', sceneTray: [{ keys: [{ id: 'k1', t: 2, pose: { swing: 90 } }] }], cameraPlan: { keys: [] }, camera: { keys: [] } };
    const base = { id: 'awareness', room: 'product', seconds: 12, kind: 'proximity' }, mine = [{ keys: [{ t: 3, pose: { tilt: -10 } }] }];
    assert.deepEqual(filmRenderShot(film, base, null).sceneTray, film.sceneTray, 'no Director keys: the film\'s own');
    assert.deepEqual(filmRenderShot(film, { ...base, trayEdits: mine }, null).sceneTray, mine, 'Director keys replace them in the still');
    assert.deepEqual(filmRenderShot(film, { ...base, trayEdits: [] }, null).sceneTray, [], 'a present empty list replaces them with none');
    assert.ok(!('sceneTray' in liveFilmShot(film, base)) && !('sceneTray' in liveFilmShot(film, { ...base, trayEdits: mine })), 'the live film layer never plays the tray (the stage does)');
    assert.deepEqual(effectiveTrayEdits(film, base).map(e => e.keys.map(k => k.t)), [[2]], 'the live stage gets the film\'s keys when the Director has none');
    assert.deepEqual(effectiveTrayEdits(film, { ...base, trayEdits: mine }), mine); assert.deepEqual(effectiveTrayEdits(film, { ...base, trayEdits: [] }), []);
    assert.equal(filmTrayEdits({ sceneTray: 'x' }).length, 0);
    assert.ok(activeTrayEdit(effectiveTrayEdits(film, base), 'gaming'), 'and that is an active edit'); assert.equal(activeTrayEdit(effectiveTrayEdits(film, { ...base, trayEdits: [] }), 'gaming'), null);
}

// a route the keyboard and mouse allow while they are on the plate (swing <= 20, slide <= 0.45): nothing is clamped
const edit = cleanTrayEdit({ keys: [{ t: 2, pose: { swing: 20, slide: 0.2 }, ease: 'linear' }, { t: 4, pose: { tilt: 10, swing: 0, slide: 0 }, ease: 'linear' }, { t: 6, pose: { slide: 0.45, tilt: 0 } }] });
// a route that goes further (swing 40, slide in): held to the clearance while the riders are on the plate, free when they are on the shelf
const plain = cleanTrayEdit({ keys: [{ t: 2, pose: { swing: 40, slide: 0.2 }, ease: 'linear' }, { t: 4, pose: { tilt: 10, swing: 0, slide: 0 }, ease: 'linear' }, { t: 6, pose: { slide: 1, tilt: 0 } }] });
// an old edit (before 25 Nov 2026) with the mount bracket and a keyed drop
const old = { bracket: true, keys: [{ t: 2, pose: { swing: 40, slide: 0.2, drop: 31 }, ease: 'linear' }, { t: 4, pose: { tilt: 10, swing: 0, slide: 0, drop: 31 }, ease: 'linear' }, { t: 6, pose: { slide: 1, tilt: 0, drop: 31 } }] };
{   // THE RIG: swapped in for the rigid model, rest pose = the rigid tray, joints move the right parts the right way
    const r = room(), rig = createTrayRig(r.api);
    const rigidBox = worldBox(r.tray), rigidPlate = named(r.tray, 'Mesh_3');
    const mouseOwn = r.mouse.position.clone(), kbOwn = r.keyboard.position.clone(), kbQ = r.keyboard.quaternion.clone();
    assert.equal(await rig.set(edit), true); assert.equal(rig.count(), 1); assert.equal(loads > 0, true);
    assert.ok(!r.tray.getObjectByName('Prop:ergoflex-keyboard-tray') && r.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'), 'the rigid model is out, the rig in');
    assert.deepEqual(rig.riders().map(o => o.name).sort(), ['keyboard', 'mouse'], 'the keyboard and the mouse on the plate are riders, the lamp is not');
    const model = r.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'), rest = snapshot(r.scene);
    // rest pose: the rigid tray's bounding box, riders exactly where they were
    const partsBox = new THREE.Box3(); model.traverse(o => { if (o.isMesh) partsBox.union(new THREE.Box3().setFromObject(o, true)); });
    for (const k of ['min', 'max']) for (const a of 'xyz') near(partsBox[k][a], rigidBox[k][a], 0.5, 'rest bounding box ' + k + a);
    rig.apply(0); r.scene.updateMatrixWorld(true);
    assert.ok(r.mouse.position.equals(mouseOwn) && r.keyboard.position.equals(kbOwn) && r.keyboard.quaternion.equals(kbQ), 'riders exactly as they were at rest');
    const p0 = rig.pose(); assert.deepEqual(p0, { slide: 0, swing: 0, tilt: 0 });
    // helpers: where a point of the rig is
    const plate = () => named(model, 'Tray_Plate'), plateCentre = () => new THREE.Box3().setFromObject(plate(), true).getCenter(new THREE.Vector3());
    const restCentre = plateCentre(), pivotSwing = worldOf(model, 'Tray_Swing'), pivotTilt = worldOf(model, 'Tray_Tilt');
    // swing +20: rotation about the vertical through the swing pivot, the plate's front moves to +x (the user's right) in the tray's frame
    rig.apply(2); r.scene.updateMatrixWorld(true);
    const posed = plateCentre(), moved = rig.pose(); near(moved.swing, 20, 1e-9, 'swing'); near(moved.slide, 0.2, 1e-9, 'slide');
    // the slide has moved the pivots along the track too (0.2 of the travel): take it out
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(named(model, 'Tray_Slide').getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(-0.2 * SLIDE_TRAVEL_MM);
    // slide is applied along the skewed track axis in the Drop frame: the swing pivot is now at rest + axis, the plate turned about it
    const slid = worldOf(model, 'Tray_Swing').sub(pivotSwing); assert.ok(!('drop' in moved), 'no drop joint'); near(slid.y, 0, 1e-6, 'the tray is never lowered');
    const flat = slid.clone().setY(0); near(flat.length(), 0.2 * SLIDE_TRAVEL_MM, 0.01, 'the swing pivot slid 0.2 of the travel'); near(flat.dot(axis) / axis.length(), 0.2 * SLIDE_TRAVEL_MM, 0.01, 'along the track axis, toward the back');
    const exp2 = restCentre.clone().sub(pivotSwing).applyAxisAngle(new THREE.Vector3(0, 1, 0), 20 * Math.PI / 180).add(pivotSwing).add(slid);
    for (const a of 'xyz') near(posed[a], exp2[a], 0.1, 'plate centre after swing 20 + slide 0.2 (' + a + ')');
    // the plate's front goes to the user's right: in the tray's frame the plate centre (in front of the pivot) gains +x
    { const swingOnly = createTrayRig(room().api); const rr = room(), sw = createTrayRig(rr.api); await sw.set(cleanTrayEdit({ keys: [{ t: 1, pose: { swing: 40 } }] })); const m = rr.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'), c0 = new THREE.Box3().setFromObject(named(m, 'Tray_Plate'), true).getCenter(new THREE.Vector3()); sw.apply(1); rr.scene.updateMatrixWorld(true); const c1 = new THREE.Box3().setFromObject(named(m, 'Tray_Plate'), true).getCenter(new THREE.Vector3()); const d = rr.tray.worldToLocal(c1.clone()).sub(rr.tray.worldToLocal(c0.clone())); assert.ok(d.x > 50, 'swing +40: the plate centre moves to +x in the tray frame, ' + d.x.toFixed(1)); assert.ok(swingOnly); }
    // tilt +10 (front edge up): about the rod axis. Check the sign on a pure tilt: apply at 3 s of a one-key edit
    const tiltOnly = cleanTrayEdit({ keys: [{ t: 1, pose: { tilt: 10 } }] }); rig.restore(); assert.equal(rig.count(), 0);
    assert.ok(r.tray.getObjectByName('Prop:ergoflex-keyboard-tray') && !r.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'), 'restore: the rigid model is back');
    assert.ok(r.mouse.position.equals(mouseOwn) && r.keyboard.position.equals(kbOwn), 'restore: the riders\' own transforms');
    const bBox = worldBox(r.tray); for (const k of ['min', 'max']) for (const a of 'xyz') near(bBox[k][a], rigidBox[k][a], 1e-6, 'restore: the tray is the rigid tray ' + k + a);
    await rig.set(tiltOnly); const m2 = r.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'); rig.apply(0);
    const front0 = new THREE.Box3().setFromObject(named(m2, 'Tray_Plate'), true), restTop = front0.max.y; rig.apply(1); r.scene.updateMatrixWorld(true);
    const tilted = new THREE.Box3().setFromObject(named(m2, 'Tray_Plate'), true);
    assert.ok(tilted.max.y > restTop + 20, 'tilt +10: the front edge rises (' + (tilted.max.y - restTop).toFixed(1) + ' mm)');
    // pure tilt: the plate turns about the rod axis (through the tilt pivot); the pivot itself does not move
    near(worldOf(m2, 'Tray_Tilt').distanceTo(pivotTilt), 0, 1e-6, 'the tilt pivot stays');
    // the rider rides the plate: the keyboard keeps its place in the plate's frame
    const inPlate = o => plate_of(m2).worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    function plate_of(m) { return named(m, 'Tray_Plate'); }
    rig.apply(0); const kbRest = inPlate(r.keyboard); rig.apply(1); const kbTilt = inPlate(r.keyboard);
    for (const a of 'xyz') near(kbTilt[a], kbRest[a], 1e-3, 'the keyboard keeps its place on the plate while it tilts (' + a + ')');
    assert.ok(r.keyboard.getWorldPosition(new THREE.Vector3()).y > r.keyboard.parent.localToWorld(kbOwn.clone()).y + 10, 'and has gone up with the front edge');
    // the whole route: out, swung, tilted, slid in as far as the riders allow; the keyboard stays on the plate at every second
    await rig.set(edit);
    for (let t = 0; t <= 7; t += 0.25) {
        const p = rig.apply(t); r.scene.updateMatrixWorld(true);
        const m = r.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'), k = plate_of(m).worldToLocal(r.keyboard.getWorldPosition(new THREE.Vector3()));
        rig.apply(0); const k0 = plate_of(m).worldToLocal(r.keyboard.getWorldPosition(new THREE.Vector3())); rig.apply(t);
        for (const a of 'xyz') near(k[a], k0[a], 1e-2, `keyboard on the plate at ${t} s (${a})`);
        assert.ok(!('drop' in p));
    }
    const end = rig.apply(7); near(end.slide, 0.45, 1e-9, 'slide'); r.scene.updateMatrixWorld(true);
    // restore again: bit for bit the rigid scene
    rig.restore(); const after = worldBox(r.tray); for (const k of ['min', 'max']) for (const a of 'xyz') near(after[k][a], rigidBox[k][a], 1e-6, 'restored ' + k + a);
    assert.ok(r.keyboard.position.equals(kbOwn) && r.mouse.position.equals(mouseOwn) && r.keyboard.quaternion.equals(kbQ));
    // a hidden rider is left where the desk's stow has it; a rig for a rebuilt room is dropped, not drawn
    const s = room({ stowed: true }), rs = createTrayRig(s.api); await rs.set(edit); assert.deepEqual(rs.riders().map(o => o.name), ['keyboard'], 'the stowed mouse is not carried');
    s.tray.parent.remove(s.tray); const gone = room(); s.api.sceneDesks.active.objects.get('accessory-keyboard-tray').obj = gone.tray; assert.equal(rs.apply(3), null, 'the tray was replaced under the rig: it is dropped');
}
{   // NO BRACKET, NO DROP (25 Nov 2026): the original model only, an old edit with the bracket and drop keys loads and they are ignored
    const r = room(), rig = createTrayRig(r.api), n = loads; await rig.set(cleanTrayEdit(old));
    const model = r.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'), meshes = []; model.traverse(o => { if (o.isMesh) meshes.push(o); });
    assert.deepEqual(meshes.map(m => m.name).sort(), ['Tray_Carriage', 'Tray_Crossbar', 'Tray_Forks', 'Tray_Links', 'Tray_Plate', 'Tray_Screw', 'Tray_Track'], 'seven CAD parts, nothing added');
    assert.equal(meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0), 14214, 'the original vertex count'); assert.equal(meshes.reduce((s, m) => s + m.geometry.index.count / 3, 0), 11121, 'the original triangle count');
    const sourceGeometries = new Set(); sources['ergoflex-keyboard-tray-rig'].traverse(o => { if (o.isMesh) sourceGeometries.add(o.geometry); });
    assert.ok(meshes.every(m => sourceGeometries.has(m.geometry)), 'every mesh draws the glb\'s own geometry: nothing generated');
    const mount0 = worldOf(model, 'Tray_Drop').clone();
    for (const t of [0, 2, 4, 7]) { const p = rig.apply(t); assert.ok(!('drop' in p)); r.scene.updateMatrixWorld(true); near(worldOf(model, 'Tray_Drop').distanceTo(mount0), 0, 1e-9, 'the mount never moves at ' + t); }
    let found = null; r.scene.traverse(o => { if (/MountBracket/.test(o.name)) found = o; }); assert.equal(found, null, 'no bracket anywhere in the scene');
    // the raw old edit (never cleaned) too
    assert.equal(await rig.set(old), true); assert.equal(loads, n + 1, 'the rig glb was loaded once'); assert.ok(!('drop' in rig.apply(3)));
    // the keyboard and mouse on the plate keep it out from under the desk (slide <= 0.45, swing <= 20 degrees)
    for (const [t, want] of [[2, { swing: 20, slide: 0.2 }], [4, { swing: 0, slide: 0 }], [7, { slide: 0.45 }]]) { const p = rig.apply(t); for (const [k, v] of Object.entries(want)) near(p[k], v, 1e-9, `old edit at ${t} s: ${k}`); }
    rig.restore();
    const m0 = loads; assert.equal(await createTrayRig(r.api).set(activeTrayEdit([{ bracket: true }], 'gaming')), false, 'a bracket-only edit is nothing'); assert.equal(loads, m0);
}
{   // K3 (25 Nov 2026): the keyboard and mouse on the desk's SHELF (the desk tilted past 9 deg) are not the tray's: the tray may do anything,
    // they stay up on the shelf, and the rig finds them as riders anyway (their own place on the desk is on the plate), even when it loads
    // with the desk already tilted.
    const r = room({ onShelf: true }), rig = createTrayRig(r.api); await rig.set(plain);
    assert.deepEqual(rig.riders().map(o => o.name).sort(), ['keyboard', 'mouse'], 'riders found from their own place on the desk, not where the stow has them');
    const kb0 = r.keyboard.matrixWorld.clone(), ms0 = r.mouse.matrixWorld.clone();
    assert.equal(rig.awayAt(3), 1, 'they are off the tray');
    for (const t of [0, 2, 3, 4, 5, 6, 7]) {
        const p = rig.apply(t); r.scene.updateMatrixWorld(true);
        assert.deepEqual(r.keyboard.matrixWorld.elements, kb0.elements, 'the keyboard stays on the shelf at ' + t); assert.deepEqual(r.mouse.matrixWorld.elements, ms0.elements, 'the mouse too');
        assert.equal(r.keyboard.parent, r.shelf);
        assert.deepEqual(p, sampleTray(plain, t), 'the tray takes its keys with no rider limit at ' + t);
    }
    near(rig.apply(7).slide, 1, 1e-9, 'slid all the way in'); near(rig.apply(2).swing, 40, 1e-9, 'swung past 20');
    rig.restore(); assert.equal(r.keyboard.parent, r.shelf, 'restore leaves the stow\'s own placement alone'); assert.deepEqual(r.keyboard.matrixWorld.elements, kb0.elements);
    // with the hand-off layer (the stage / film), the rig asks it where the riders are and lets it place them
    const h = room({ onShelf: true }); let tray = null; h.api.riderHandoff = { setTray: f => { tray = f; }, awayAt: s => s < 3 ? 0 : 1 };
    const hr = createTrayRig(h.api); await hr.set(plain); assert.equal(typeof tray, 'function', 'the rig hands the layer its riders\' plate poses');
    near(hr.apply(7).slide, 1, 1e-9, 'away: free'); near(hr.apply(2).swing, 20, 1e-9, 'on the tray (the timeline says so at 2 s): held');
    hr.apply(5); assert.ok(tray(h.keyboard) instanceof THREE.Matrix4, 'the keyboard on the plate as posed'); assert.equal(tray(h.tray), null, 'the tray itself is no rider');
    hr.restore(); assert.equal(tray, null, 'restore unregisters');
}
{   // a second set() while a load is in flight and restore() cancel it cleanly; set twice with the same edit loads once
    const r = room(), rig = createTrayRig(r.api), n = loads;
    const first = rig.set(edit), second = rig.set(edit); await Promise.all([first, second]); assert.equal(loads - n, 1, 'one load'); assert.equal(rig.count(), 1);
    const pending = rig.set(edit); rig.restore(); await pending.catch(() => {}); assert.equal(rig.count(), 0); assert.ok(r.tray.getObjectByName('Prop:ergoflex-keyboard-tray'), 'restore after a set: rigid back');
    const again = createTrayRig(r.api); const cancelled = again.set(edit); again.restore(); await cancelled; assert.equal(again.count(), 0); assert.ok(!r.tray.getObjectByName('Prop:ergoflex-keyboard-tray-rig'), 'a cancelled load leaves no rig behind');
}
{   // film-fx and the stage sample the same function: the pose of the rig at a second is tray-pose's, with the riders' thickness
    const r = room(), rig = createTrayRig(r.api); await rig.set(edit);
    const ids = rig.riders().map(o => o.userData.accessoryId), mm = riderThicknessMm(['ergoflex-ergo-keyboard', 'ergoflex-mx-master-mouse']); near(mm, 47.2, 1e-9, 'thickest rider'); assert.deepEqual(ids.sort(), ['ergo-keyboard', 'logitech-mx-master']);
    for (const t of [0, 1.3, 2, 3.7, 5, 6, 9]) assert.deepEqual(rig.apply(t), sampleTray(edit, t, { riderMm: mm }), 'second ' + t);
}
{   // REGRESSION (24 Nov 2026, "the tray never moves"): the real window.ErgoFlex has no loadProp / disposeObject of its own, they are on sceneDesks.ctx.
    // The rig used api.loadProp, threw on the real page and never loaded. Hand it an api shaped like the real one.
    const r = room(), real = { sceneDesks: { active: r.api.sceneDesks.active, ctx: { loadProp: r.api.loadProp, disposeObject: r.api.disposeObject } }, workspaceAccessories: r.api.workspaceAccessories };
    assert.equal(real.loadProp, undefined);
    const rig = createTrayRig(real); assert.equal(await rig.set(edit), true, 'the rig installs with the real api shape'); assert.equal(rig.count(), 1);
    assert.notDeepEqual(rig.apply(3), null); rig.restore(); assert.equal(rig.count(), 0);
}
console.log('tray-rig-test: ok (no keys: nothing loaded or touched, no new film field; rig swap, rest pose = rigid, joint signs and axes, riders on the plate, riders on the shelf left alone and the tray free, no bracket / drop (old data ignored), restore, cancel, the film plumbing)');
