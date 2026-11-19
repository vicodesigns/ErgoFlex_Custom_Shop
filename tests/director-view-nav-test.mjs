// The Director's 3D view navigation is reliable (19 Nov 2026, Vico: "when I select an object and I click the centre
// wheel it is just not consistent... sometimes it doesn't go anywhere"). experience/view-nav.mjs, driven here with a
// fake OrbitControls and a fake canvas (the real three.js Vector3 / Box3 / Mesh underneath):
//   1. a wheel click centres the selection's bounding box (hidden parts and gizmos do not count), the ease ends exactly
//      there, with the stage iframe's frame clock on a different origin from this page's performance.now()
//   2. the ease still lands when the iframe never draws a frame (timer), and any input stops it where it is
//   3. a middle drag pans and is not a click (even one that comes back to where it began); nothing to centre on says so
//   4. a lost release (pointercancel, blur, a wheel / move with no button down, a second press) leaves nothing stuck,
//      OrbitControls included (it ignores the wheel while it thinks a button is down)
//   5. setActive(false) puts the Studio's controls back; refresh() hooks a new canvas after the stage reloads
//   node tests/director-view-nav-test.mjs
import assert from 'node:assert/strict';
import * as THREE from '../node_modules/three/build/three.module.js';
import {createViewNav} from '../experience/view-nav.mjs';

// ---- fakes -------------------------------------------------------------------------------------------------------
function pointer(type, init = {}) {
  const ev = new Event(type, {bubbles: true, cancelable: true});
  Object.assign(ev, {button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0, ctrlKey: false, shiftKey: false, metaKey: false}, init);
  return ev;
}
function makeStage(clockOffset = 30000) {
  const win = new EventTarget();
  win.PointerEvent = class extends Event { constructor(type, init = {}) { super(type, {bubbles: init.bubbles}); const {bubbles, ...rest} = init; Object.assign(this, rest); } };
  win.__queue = []; win.__nextId = 1;
  // the stage iframe's frame clock is on its own origin: here 30 s behind this page's performance.now()
  win.__clock = () => performance.now() - clockOffset;
  win.requestAnimationFrame = fn => { const id = win.__nextId++; win.__queue.push({id, fn}); return id; };
  win.cancelAnimationFrame = id => { win.__queue = win.__queue.filter(q => q.id !== id); };
  // run one frame at `elapsed` ms after the clock's origin of this test
  win.frame = ts => { const q = win.__queue; win.__queue = []; for (const j of q) j.fn(ts); return q.length; };
  const dom = new EventTarget();
  const doc = {defaultView: win, body: {append() {}}, createElement: () => ({style: {}, remove() {}})};
  Object.assign(dom, {ownerDocument: doc, setPointerCapture() {}, releasePointerCapture() {}, getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600})});
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 800 / 600, .01, 1000);
  camera.position.set(0, 2, 8); camera.lookAt(0, 0, 0);
  const controls = {target: new THREE.Vector3(), mouseButtons: {LEFT: 0, MIDDLE: 1, RIGHT: 2}, zoomToCursor: false, screenSpacePanning: false, enableDamping: true,
    enabled: true, minDistance: .01, maxDistance: Infinity, updates: 0, update() { this.updates++; }};
  return {win, dom, doc, scene, camera, controls, three: {scene, camera, controls, renderer: {domElement: dom}}};
}
// a stand-in for OrbitControls' own pointer bookkeeping (registered AFTER the nav's hooks, like the real one runs after
// our capture listeners): it ignores a press whose pointer it still tracks, and ignores the wheel while one is down
function fakeOrbit(stage) {
  const o = {pointers: new Set(), ignoredPress: 0, ignoredWheel: 0, wheels: 0};
  stage.dom.addEventListener('pointerdown', ev => { if (o.pointers.has(ev.pointerId)) { o.ignoredPress++; return; } o.pointers.add(ev.pointerId); });
  stage.dom.addEventListener('pointerup', ev => o.pointers.delete(ev.pointerId));
  stage.dom.addEventListener('pointercancel', ev => o.pointers.delete(ev.pointerId));
  stage.dom.addEventListener('wheel', () => { if (o.pointers.size) o.ignoredWheel++; else o.wheels++; });
  return o;
}
// a desk with a prop in it: the prop's mesh is a 2 x 1 x 1 box at (4, 1.5, -2); a hidden mesh and a gizmo far away must not count
function addProp(scene) {
  const desk = new THREE.Group(); desk.position.set(3, 0, -1); scene.add(desk);
  const prop = new THREE.Group(); prop.position.set(1, 1, -1); desk.add(prop);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1)); body.position.set(0, .5, 0); prop.add(body);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); hidden.position.set(80, 0, 0); hidden.visible = false; prop.add(hidden);
  const hiddenParent = new THREE.Group(); hiddenParent.visible = false; const inside = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); inside.position.set(0, 90, 0); hiddenParent.add(inside); prop.add(hiddenParent);
  const gizmo = new THREE.Group(); gizmo.userData.directorTools = true; const arrow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); arrow.position.set(0, 0, 70); gizmo.add(arrow); prop.add(gizmo);
  return {prop, centre: new THREE.Vector3(4, 1.5, -2)};
}
function setup({selection = 'prop'} = {}) {
  const st = makeStage(), {prop, centre} = addProp(st.scene), logs = [], wakes = [];
  const holder = {sel: selection === 'prop' ? prop : null, stage: st};
  const nav = createViewNav({three: () => holder.stage.three, selectionObject: () => holder.sel, status: m => logs.push(m), wake: () => wakes.push(1)});
  nav.setActive(true);
  const orbit = fakeOrbit(st);
  return {...st, nav, prop, centre, logs, wakes, orbit, holder};
}
const near = (a, b, why) => assert.ok(a.distanceTo(b) < 1e-9, `${why}: ${a.toArray()} vs ${b.toArray()}`);
const middleClick = (s, x = 100, y = 100) => { s.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4, clientX: x, clientY: y})); s.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0, clientX: x, clientY: y})); };
// play the stage's frames: the clock starts at its own origin (30 s behind this page), then 0, 100, 200, 250, 300 ms
const play = (s, upTo = 300) => { const base = s.win.__clock(); for (const ms of [0, 16, 100, 200, 250, 300]) { if (ms > upTo) break; s.win.frame(base + ms); } };

// ---- 1. the wheel click centres the selection --------------------------------------------------------------------
{
  const s = setup(), startDist = s.camera.position.distanceTo(s.controls.target), dir = s.camera.position.clone().sub(s.controls.target).normalize();
  middleClick(s);
  assert.ok(s.logs.at(-1).startsWith('Centred on the selection'), 'the click says what it did: ' + s.logs.at(-1));
  assert.equal(s.win.__queue.length, 1, 'one ease is running');
  play(s, 100);
  assert.ok(s.controls.target.distanceTo(s.centre) > 1e-3, 'mid-way, not there yet (the first frame starts the clock, not the page clock)');
  play(s, 300);
  near(s.controls.target, s.centre, 'the ease ends exactly on the bounding-box centre (hidden parts and the gizmo do not count)');
  near(s.camera.position.clone().sub(s.controls.target).normalize(), dir, 'the view direction is kept');
  assert.ok(Math.abs(s.camera.position.distanceTo(s.controls.target) - startDist) < 1e-9, 'the zoom distance stays');
  assert.equal(s.win.__queue.length, 0, 'the ease is over');
  assert.ok(s.controls.updates > 2 && s.wakes.length > 2, 'controls.update() and wake() run every step');
  assert.ok(globalThis.__directorNavTrace.length > 0 && globalThis.__directorNavTrace.length <= 16, 'the read-only trace is there, 16 steps at most');
  assert.ok(globalThis.__directorNavTrace.some(e => e.kind === 'centre' && e.result === 'selection'));
  // a double click: the second ease replaces the first, and ends in the same place
  middleClick(s); middleClick(s); assert.equal(s.win.__queue.length, 1, 'a double wheel click runs one ease');
  play(s); near(s.controls.target, s.centre, 'a double click lands on the same centre');
}
// a selection too big for the view makes the camera back off to fit it; a small one leaves the distance alone
{
  const s = setup(); const big = new THREE.Mesh(new THREE.BoxGeometry(60, 20, 60)); big.position.set(0, 10, 0); s.scene.add(big); s.holder.sel = big;
  middleClick(s); play(s);
  assert.ok(s.camera.position.distanceTo(s.controls.target) > 60, 'a 60 m selection is fitted, not sat inside: ' + s.camera.position.distanceTo(s.controls.target));
}
// the camera sitting exactly on its pivot does not freeze the ease (zero-length offset)
{
  const s = setup(); s.camera.position.copy(s.controls.target); middleClick(s); play(s);
  near(s.controls.target, s.centre, 'camera on its pivot: still centred');
  assert.ok(Number.isFinite(s.camera.position.x + s.camera.position.y + s.camera.position.z) && s.camera.position.distanceTo(s.controls.target) > 0, 'and the camera is off the pivot, finite');
}

// ---- 2. the ease lands without frames; input stops it where it is ------------------------------------------------
{
  const s = setup(); middleClick(s);                                   // the iframe never draws a frame (hidden / throttled)
  await new Promise(r => setTimeout(r, 650));
  near(s.controls.target, s.centre, 'with no frames the timer lands the camera on the centre');
  assert.equal(s.win.__queue.length, 0);
}
{
  const s = setup(); middleClick(s); play(s, 100);
  const mid = s.controls.target.clone(); assert.ok(mid.distanceTo(s.centre) > 1e-3);
  s.dom.dispatchEvent(Object.assign(new Event('wheel', {bubbles: true, cancelable: true}), {deltaY: -100, clientX: 400, clientY: 300, buttons: 0}));
  assert.equal(s.win.__queue.length, 0, 'a wheel cancels the ease');
  play(s); near(s.controls.target, mid, 'and the camera stays where the wheel found it (the ease no longer fights the zoom)');
  assert.equal(s.orbit.wheels, 1, 'OrbitControls took the wheel');
  await new Promise(r => setTimeout(r, 650));
  near(s.controls.target, mid, 'the snap timer was cancelled too');
}
{
  const s = setup(); middleClick(s); play(s, 100); const mid = s.controls.target.clone();
  s.dom.dispatchEvent(pointer('pointerdown', {button: 0, buttons: 1}));
  assert.equal(s.win.__queue.length, 0, 'any press, even the left one, stops the ease');
  s.dom.dispatchEvent(pointer('pointerup', {button: 0, buttons: 0})); play(s); near(s.controls.target, mid, 'and it stays stopped');
}

// ---- 3. a drag is not a click; nothing to centre on says so ------------------------------------------------------
{
  const s = setup(), before = s.controls.target.clone();
  s.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4, clientX: 100, clientY: 100}));
  s.dom.dispatchEvent(pointer('pointermove', {buttons: 4, clientX: 140, clientY: 110}));
  s.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0, clientX: 141, clientY: 110}));
  assert.equal(s.win.__queue.length, 0, 'a middle drag (a pan) does not centre');
  assert.equal(s.logs.length, 0); near(s.controls.target, before, 'and OrbitControls alone moves the target');
  // a pan that comes back to where it began is still a pan
  s.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4, clientX: 100, clientY: 100}));
  s.dom.dispatchEvent(pointer('pointermove', {buttons: 4, clientX: 220, clientY: 180}));
  s.dom.dispatchEvent(pointer('pointermove', {buttons: 4, clientX: 101, clientY: 100}));
  s.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0, clientX: 101, clientY: 100}));
  assert.equal(s.win.__queue.length, 0, 'a long pan that ends near its start is not a click');
  // a click with a 2 px wobble is
  s.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4, clientX: 100, clientY: 100}));
  s.dom.dispatchEvent(pointer('pointermove', {buttons: 4, clientX: 102, clientY: 101}));
  s.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0, clientX: 102, clientY: 101}));
  assert.equal(s.win.__queue.length, 1, 'a 2 px wobble is a click');
}
{
  const s = setup({selection: null}), before = s.controls.target.clone(), cam = s.camera.position.clone();
  middleClick(s);
  assert.equal(s.win.__queue.length, 0, 'nothing selected: no ease');
  assert.match(s.logs.at(-1), /Select something to centre on/, 'and it says why: ' + s.logs.at(-1));
  play(s); near(s.controls.target, before, 'the target did not move'); near(s.camera.position, cam, 'nor the camera');
}
{
  const s = setup(); s.prop.removeFromParent(); middleClick(s);             // a leftover from a scene the stage replaced
  assert.equal(s.win.__queue.length, 0, 'a selection that is not in the stage scene is no selection');
  assert.match(s.logs.at(-1), /Select something/);
}
{
  const s = setup(); const empty = new THREE.Group(); empty.position.set(7, 0, 1); s.scene.add(empty); s.holder.sel = empty;   // no geometry yet
  middleClick(s); play(s); near(s.controls.target, new THREE.Vector3(7, 0, 1), 'an object with no geometry yet: its own position');
}

// ---- 4. lost pointers leave nothing stuck ------------------------------------------------------------------------
{
  const s = setup();
  s.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4, clientX: 100, clientY: 100}));
  s.dom.dispatchEvent(pointer('pointercancel', {}));
  s.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0, clientX: 100, clientY: 100}));
  assert.equal(s.win.__queue.length, 0, 'pointercancel ends the middle press: a later stray release is not a click');
  assert.equal(s.orbit.pointers.size, 0);
}
{
  const s = setup();                                                    // the release never came (blur in the middle of a drag)
  s.dom.dispatchEvent(pointer('pointerdown', {button: 2, buttons: 2, ctrlKey: false}));
  assert.equal(s.orbit.pointers.size, 1);
  s.win.dispatchEvent(new Event('blur'));
  assert.equal(s.orbit.pointers.size, 0, 'blur tells OrbitControls the pointer is gone');
  const w = s.orbit.wheels;
  s.dom.dispatchEvent(Object.assign(new Event('wheel', {cancelable: true}), {deltaY: 100, buttons: 0})); assert.equal(s.orbit.wheels, w + 1, 'the wheel works again');
}
{
  const s = setup();                                                    // the release went to another element: the next wheel heals it
  s.dom.dispatchEvent(pointer('pointerdown', {button: 2, buttons: 2}));
  s.dom.dispatchEvent(Object.assign(new Event('wheel', {cancelable: true}), {deltaY: 100, buttons: 0}));
  assert.equal(s.orbit.ignoredWheel, 0, 'a wheel with no button down is not dropped by a stuck OrbitControls');
  assert.equal(s.orbit.wheels, 1);
  assert.ok(globalThis.__directorNavTrace.some(e => e.kind === 'heal'), 'the heal is on the trace');
}
{
  const s = setup();                                                    // ...or the next pointer move
  s.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4}));
  s.dom.dispatchEvent(pointer('pointermove', {buttons: 0, clientX: 300, clientY: 300}));
  assert.equal(s.orbit.pointers.size, 0, 'a move with no button down heals it');
  s.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0, clientX: 100, clientY: 100}));
  assert.equal(s.win.__queue.length, 0, 'and that stray release is not a click');
}
{
  const s = setup();                                                    // a press whose release never came, then the next press
  s.dom.dispatchEvent(pointer('pointerdown', {button: 2, buttons: 2}));
  s.dom.dispatchEvent(pointer('pointerdown', {button: 2, buttons: 2}));
  assert.equal(s.orbit.ignoredPress, 0, 'the new press is not swallowed by OrbitControls');
}
{
  const s = setup();                                                    // Ctrl+right-drag zooms, and a blur ends it
  const d0 = s.camera.position.distanceTo(s.controls.target);
  s.dom.dispatchEvent(pointer('pointerdown', {button: 2, buttons: 2, ctrlKey: true, clientX: 50, clientY: 50}));
  s.dom.dispatchEvent(pointer('pointermove', {buttons: 2, ctrlKey: true, clientX: 50, clientY: 90}));
  assert.ok(s.camera.position.distanceTo(s.controls.target) > d0, 'Ctrl+right-drag down zooms out');
  s.win.dispatchEvent(new Event('blur'));
  const d1 = s.camera.position.distanceTo(s.controls.target);
  s.dom.dispatchEvent(pointer('pointermove', {buttons: 0, clientX: 50, clientY: 200}));
  assert.equal(s.camera.position.distanceTo(s.controls.target), d1, 'after blur the zoom drag is over');
}
{
  let picks = 0;                                                        // a box drag cancelled by blur never picks
  const s2 = makeStage(), nav2 = createViewNav({three: () => s2.three, boxPick: () => ++picks, status: () => {}}); nav2.setActive(true);
  s2.dom.dispatchEvent(pointer('pointerdown', {button: 0, buttons: 1, clientX: 10, clientY: 10}));
  s2.dom.dispatchEvent(pointer('pointermove', {buttons: 1, clientX: 90, clientY: 90}));
  s2.win.dispatchEvent(new Event('blur'));
  s2.dom.dispatchEvent(pointer('pointerup', {button: 0, buttons: 0, clientX: 90, clientY: 90}));
  assert.equal(picks, 0, 'a box drag ended by blur does not pick');
}
{
  const s = setup();                                                    // controls disabled by something else: it says so (once)
  s.controls.enabled = false; s.dom.dispatchEvent(pointer('pointerdown', {button: 2, buttons: 2})); s.dom.dispatchEvent(pointer('pointerup', {button: 2, buttons: 0}));
  assert.ok(s.logs.some(m => /not taking camera input/.test(m)), 'a locked view is explained');
  const n = s.logs.length; s.dom.dispatchEvent(pointer('pointerdown', {button: 2, buttons: 2})); s.dom.dispatchEvent(pointer('pointerup', {button: 2, buttons: 0}));
  assert.equal(s.logs.length, n, 'and not repeated');
}

// ---- 5. the Studio's controls are put back; a reloaded stage is hooked again -------------------------------------
{
  const s = setup();
  assert.deepEqual(s.controls.mouseButtons, {LEFT: -1, MIDDLE: 2, RIGHT: 0}, 'Director mapping: left selects, middle pans, right orbits');
  assert.equal(s.controls.zoomToCursor, true); assert.equal(s.controls.screenSpacePanning, true); assert.equal(s.controls.enableDamping, false, 'no damping while the Director is open (the stage stops drawing 800 ms after input)');
  middleClick(s); s.nav.setActive(false);
  assert.equal(s.win.__queue.length, 0, 'closing the Director stops an ease');
  assert.deepEqual(s.controls.mouseButtons, {LEFT: 0, MIDDLE: 1, RIGHT: 2}, 'mouse buttons restored');
  assert.equal(s.controls.zoomToCursor, false); assert.equal(s.controls.screenSpacePanning, false); assert.equal(s.controls.enableDamping, true, 'damping restored');
  middleClick(s); assert.equal(s.win.__queue.length, 0, 'inactive: a wheel click does nothing');
  s.nav.setActive(true); s.nav.setActive(true); s.nav.setActive(false);
  assert.deepEqual(s.controls.mouseButtons, {LEFT: 0, MIDDLE: 1, RIGHT: 2}, 'on-off-on-off still ends at the originals');
}
{
  const s = setup(), second = makeStage(), added = addProp(second.scene);
  s.holder.stage = second; s.holder.sel = added.prop;
  second.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4})); second.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0}));
  assert.equal(second.win.__queue.length, 0, 'before refresh() the new canvas is not hooked');
  s.nav.refresh();
  assert.deepEqual(second.controls.mouseButtons, {LEFT: -1, MIDDLE: 2, RIGHT: 0}, 'refresh() maps the new stage controls');
  second.dom.dispatchEvent(pointer('pointerdown', {button: 1, buttons: 4, clientX: 5, clientY: 5})); second.dom.dispatchEvent(pointer('pointerup', {button: 1, buttons: 0, clientX: 5, clientY: 5}));
  assert.equal(second.win.__queue.length, 1, 'refresh() hooked the new canvas');
  play(second); near(second.controls.target, added.centre, 'and it centres there');
  s.nav.setActive(false);
  assert.deepEqual(second.controls.mouseButtons, {LEFT: 0, MIDDLE: 1, RIGHT: 2}, 'the new stage controls get their own defaults back');
}
// named views and F go through the same ease
{
  const s = setup(), d = s.camera.position.distanceTo(s.controls.target);
  assert.ok(s.nav.setView('top')); play(s); assert.ok(s.camera.position.y > d * .99, 'top view: straight above, distance kept'); assert.ok(Math.abs(s.camera.position.distanceTo(s.controls.target) - d) < 1e-6);
  assert.ok(s.nav.frame()); play(s); near(s.controls.target, s.centre, 'F frames the selection');
  assert.equal(createViewNav({three: () => null}).frame(), false);
}
console.log('director-view-nav-test: ok (wheel click centres the box exactly on the stage clock, input stops the ease, drags are not clicks, lost pointers heal, controls restored, reloads re-hooked)');
