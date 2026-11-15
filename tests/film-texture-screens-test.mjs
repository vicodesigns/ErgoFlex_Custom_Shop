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
console.log('film texture screens: inert unless named, person and desk scoped, warns when unmatched, later postures, stills once, restore + release: OK');
