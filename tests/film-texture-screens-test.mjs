// Texture screens (tools/experience/film-texture-screens.mjs, film-fx.mjs): a screens entry {target:'texture'} paints a clip
// into an existing material's own picture: the phone in a person's hand (storage, Andre) and the drafting board's paper
// (create). Checked without a browser: inert when a shot has no such entry; only the named person's matching material
// is swapped (colour and emissive maps, the original's UV settings); a posture rigged later in the shot is picked up;
// stills are drawn once; video time follows offset/rate/loop like the monitors; restore() puts every map back.
//   node tests/film-texture-screens-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { isTextureTarget, installTextureScreens, matches, RESCAN } from '../tools/experience/film-texture-screens.mjs';

let draws = 0;
const makeCanvas = (width, height) => ({ width, height, getContext: () => ({ setTransform() {}, drawImage() { draws++; } }) });
const tex = (w, h, flipY) => { const t = new THREE.Texture({ width: w, height: h }); t.flipY = flipY; t.repeat.set(1, -1); t.offset.set(0, 1); return t; };

const scene = new THREE.Scene();
function person(id) {
  const g = new THREE.Group(); g.name = id; g.userData.person = { id, key: id };
  const body = new THREE.MeshStandardMaterial({ name: 'Held.phone' });
  const pic = tex(270, 580, false), screen = new THREE.MeshStandardMaterial({ name: 'Held.phone screen pressed', map: pic, emissiveMap: pic });
  const m = new THREE.Mesh(new THREE.BufferGeometry(), [body, screen]); m.name = 'base.001';
  const inner = new THREE.Group(); inner.add(m); g.add(inner); scene.add(g);
  return { g, body, screen, pic };
}
const andre = person('people-andre-stand-phone-press'), jo = person('people-jo-stand-work');
const sheetMap = tex(1600, 1000, true), sheetMat = new THREE.MeshStandardMaterial({ name: '', map: sheetMap });
const sheet = new THREE.Mesh(new THREE.BufferGeometry(), sheetMat); sheet.name = 'Architect floor plan'; scene.add(sheet);
const monitorMat = new THREE.MeshBasicMaterial({ name: 'Monitor screen' }), monitor = new THREE.Mesh(new THREE.BufferGeometry(), monitorMat); scene.add(monitor);

// 1. Inert: no texture entries -> nothing installed, nothing touched.
assert.equal(installTextureScreens(scene, [], []), null);
assert.equal(installTextureScreens(scene, undefined, []), null);
assert.equal(isTextureTarget({ target: 'main-landscape' }), false);
assert.equal(isTextureTarget({ target: 'texture' }), true);
assert.deepEqual(matches(scene, { target: 'texture' }), [], 'an entry naming neither a mesh nor a material matches nothing');

// 2. The phone in Andre's hand: only his screen material, colour + emissive, UV settings copied.
const phone = { target: 'texture', material: '^Held\\.phone screen', person: 'andre', src: 'p.mp4', offset: -8, loop: false };
const plan = { target: 'texture', mesh: '^Architect floor plan$', src: 'plan.png' };
let released = 0;
const video = { duration: 26, videoWidth: 540, videoHeight: 1160, removeAttribute() { released++; }, load() {} }, image = { naturalWidth: 1600, naturalHeight: 1000 };
const seeks = [], warnings = [];
// a second drafting kit elsewhere in the room: within:'desk' keeps its sheet
const deskGroup = new THREE.Group(); scene.add(deskGroup); scene.remove(sheet); deskGroup.add(sheet);
const otherMat = new THREE.MeshStandardMaterial({ map: tex(1600, 1000, true) }), other = new THREE.Mesh(new THREE.BufferGeometry(), otherMat); other.name = 'Architect floor plan'; scene.add(other);
const otherMap = otherMat.map;
const ghost = { target: 'texture', material: '^Nothing here$', src: 'x.png' };
const fx = installTextureScreens(scene, [phone, { ...plan, within: 'desk' }, ghost], [video, image, image], { makeCanvas, desk: deskGroup, warn: m => warnings.push(m) });
await fx.frame(10, async (v, t) => seeks.push([v, t]));
const T = fx.items[0].texture;
assert(T && andre.screen.map === T && andre.screen.emissiveMap === T, 'Andre\'s phone shows the clip, lit');
assert.equal(andre.body.map, null, 'the phone body is untouched');
assert(jo.screen.map === jo.pic && jo.screen.emissiveMap === jo.pic, 'another person\'s phone is untouched');
assert.equal(monitorMat.map, null, 'other screens are untouched');
assert.equal(T.flipY, false, 'the GLB texture\'s flipY is kept'); assert.deepEqual(T.repeat.toArray(), [1, -1]); assert.deepEqual(T.offset.toArray(), [0, 1]);
assert.equal(T.colorSpace, THREE.SRGBColorSpace);
const c = fx.items[0].canvas; assert(Math.abs(c.width / c.height - 270 / 580) < .01, 'the canvas takes the original picture\'s aspect');
assert.equal(seeks.length, 1); assert.equal(seeks[0][0], video); assert(Math.abs(seeks[0][1] - 2.0015) < 1e-9, 'clip time = t + offset (+1.5 ms into the frame)');
// before the clip starts (loop:false): held on its first frame
await fx.frame(3, async (v, t) => seeks.push([v, t])); assert(Math.abs(seeks.at(-1)[1] - .0015) < 1e-9);

// 3. The drafting paper: a still, drawn once; the CanvasTexture's own flipY is kept.
const P = fx.items[1].texture;
assert(P && sheetMat.map === P && sheetMat.emissiveMap === null, 'the paper shows the plan, not made emissive');
assert.equal(P.flipY, true); const pc = fx.items[1].canvas; assert(Math.abs(pc.width / pc.height - 1.6) < .01);
const before = draws; await fx.frame(5, async () => {}); assert.equal(draws - before, 1, 'only the video is redrawn per frame');

// within:'desk': the other kit's sheet is untouched; a spec matching nothing warns once
assert.equal(otherMat.map, otherMap, 'another drafting kit keeps its own sheet');
assert.equal(warnings.length, 1); assert.match(warnings[0], /matches nothing/); assert.equal(fx.items[2].matched, 0);
assert.equal(fx.items[0].matched, 1, 'the phone spec matched one material');

// 4. A posture rigged later in the shot (its own GLB, its own material) is picked up at the next look-up.
const later = person('people-andre-stand-phone-watch');
for (let i = 0; i < RESCAN; i++) await fx.frame(13 + i / 30, async () => {});
assert(later.screen.map === T && later.screen.emissiveMap === T, 'the later posture\'s phone shows the clip too');

// 5. restore(): every map back as it was.
fx.restore();
for (const p of [andre, later]) assert(p.screen.map === p.pic && p.screen.emissiveMap === p.pic, 'phone restored');
assert.equal(sheetMat.map, sheetMap); assert.equal(sheetMat.emissiveMap, null);
assert(jo.screen.map === jo.pic && monitorMat.map === null);
assert.equal(released, 1, 'the clip (video) is released, the stills are not touched');

// 6. film-fx: texture entries skip the glass fitting and only install when the shot has one.
const src = fs.readFileSync(new URL('../tools/experience/film-fx.mjs', import.meta.url), 'utf8');
assert.match(src, /if \(isTextureTarget\(spec\)\) continue;/, 'installScreens skips texture entries');
assert.match(src, /if \(texSpecs\.length\) active\.texScreens = installTextureScreens\(/, 'installed only when the shot names one');
assert.match(src, /filter\(isTextureTarget\)\.map\(sc => \{   \/\/ texture targets: what each one matches here/, 'listed by --list-screens');
assert.match(src, /if \(active\.texScreens && screens\) \{ await active\.texScreens\.frame\(chapterSeconds, seek\)/, 'updated per frame');
assert.match(src, /active\.texScreens\?\.restore\(\);/, 'restored on clear');
// 5. flipX / flipY / rotate:180 turn the picture on the canvas (S11: the storage insert's camera reads the phone from the far side).
{
  const calls = [], mk = (w, h) => ({ width: w, height: h, getContext: () => ({ setTransform: (...a) => calls.push(a), drawImage() {} }) });
  const run = async extra => {
    calls.length = 0; const x = person('people-andre-flip-' + Math.random());
    const f = installTextureScreens(scene, [{ ...phone, ...extra }], [video], { makeCanvas: mk, warn() {} });
    await f.frame(10, async () => {}); const w = f.items[0].canvas.width, h = f.items[0].canvas.height; f.restore(); scene.remove(x.g);
    return { calls: calls.map(a => a.join(',')), w, h };
  };
  const none = await run({}), fx1 = await run({ flipX: true }), fy1 = await run({ flipY: true }), r180 = await run({ rotate: 180 });
  assert(!none.calls.some(c => /^-1|^1,0,0,-1/.test(c)), 'no flip: the canvas is drawn as it is');
  assert(fx1.calls.includes(`-1,0,0,1,${fx1.w},0`), 'flipX mirrors across the canvas');
  assert(fy1.calls.includes(`1,0,0,-1,0,${fy1.h}`), 'flipY mirrors up/down');
  assert(r180.calls.includes(`-1,0,0,-1,${r180.w},${r180.h}`), 'rotate:180 turns it half a turn');
}
// Graphics timeline windows restore the original picture outside the clip and seek from its start.
{
  const {screenTiming}=await import('../tools/experience/screen-timing.mjs');
  assert.deepEqual(screenTiming({offset:3,rate:2},4),{visible:true,seconds:11});
  assert.deepEqual(screenTiming({start:5,end:10,offset:3,rate:2},6),{visible:true,seconds:5});
  assert.equal(screenTiming({start:5,end:10},10).visible,false);
  const rig=person('people-andre-timeline'),seeks=[];
  const timed=installTextureScreens(scene,[{...phone,start:5,end:10,offset:3,rate:2}],[video],{makeCanvas,warn(){}});
  await timed.frame(2,t=>seeks.push(t));assert.equal(rig.screen.map,rig.pic,'original before the clip');
  await timed.frame(6,async(v,t)=>seeks.push(t));assert.notEqual(rig.screen.map,rig.pic,'graphic appears at the clip start');
  assert.ok(Math.abs(seeks.at(-1)-5.0015)<.00001,'source time is relative to clip start');
  await timed.frame(10,async()=>{});assert.equal(rig.screen.map,rig.pic,'original returns at the out point');
  await timed.frame(7,async()=>{});assert.notEqual(rig.screen.map,rig.pic,'scrubbing back reactivates the graphic');
  timed.restore();scene.remove(rig.g);
}
// Two cut pieces on one material must switch cleanly when scrubbing in either direction.
{
  const rig=person('people-andre-split');
  const cut=installTextureScreens(scene,[{...phone,start:0,end:5},{...phone,start:5,end:10,offset:2}],[video,video],{makeCanvas,warn(){}});
  await cut.frame(2,async()=>{});const left=rig.screen.map;
  await cut.frame(6,async()=>{});const right=rig.screen.map;assert.notEqual(left,right);
  await cut.frame(2,async()=>{});assert.equal(rig.screen.map,left,'backward cut selects the left picture');
  await cut.frame(6,async()=>{});assert.equal(rig.screen.map,right,'forward cut selects the right picture');
  cut.restore();assert.equal(rig.screen.map,rig.pic);scene.remove(rig.g);
}
console.log('film texture screens: inert unless named, person and desk scoped, warns when unmatched, later postures, stills once, restore + release: OK');
