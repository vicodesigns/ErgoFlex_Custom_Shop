// Interior pass (interior-cinema.mjs, interior-cinema-rooms.mjs): light shaping for the film's rooms.
//   1. film and Director only, never a Classic look, one switch
//   2. every room the film's cut uses has a recipe (the product stage has none)
//   3. what it builds is presentation only: no collider, no ray target, no depth write, hung on the cutaway walls
//   4. draw order: the shade before every additive overlay, so the desk's LED floor light lands on top of it untouched
//   5. wall quads run from `from` to `to` whichever way the wall faces (windows and corners land where the recipe says)
//   6. dayparts: night switches the daylight washes off, the room's own atmosphere call still runs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {applyInteriorPass, finishInteriorPass, interiorPassOn, INTERIOR_LAYERS, DEFAULT_ON} = await import('../interior-cinema.mjs');
const {INTERIOR_RECIPES} = await import('../interior-cinema-rooms.mjs?v=interior-20261125a');

// A room as WorkspaceRoom leaves it for the pass: root turned a quarter and scaled to metres, three cutaway walls.
const S = .001509;
function fakeRoom(id, layout, look = null) {
  const scene = new THREE.Scene(), rootGroup = new THREE.Group(); rootGroup.name = 'Room:' + id; rootGroup.rotation.y = Math.PI / 2; rootGroup.scale.setScalar(S); scene.add(rootGroup);
  const x0 = layout.left ?? -layout.width / 2, x1 = x0 + layout.width, walls = [];
  const wall = (name, axis, limit, sign) => { const obj = new THREE.Group(); obj.name = name; rootGroup.add(obj); walls.push({obj, axis, limit, ...(sign ? {sign} : {})}); return obj; };
  wall('back wall', 'x', layout.back * S); wall('right wall', 'z', -x1 * S); wall('left wall', 'z', -x0 * S, -1);
  scene.updateMatrixWorld(true);
  const calls = [];
  return {id, look, roomLayout: layout, root: rootGroup, walls, roomAtmosphere: (mode, accent) => { calls.push([mode, accent]); return 'own'; }, calls};
}
const HOME = {id: 'house', width: 3600, depth: 4200, height: 2700, back: -1450};
const passMeshes = room => { const out = []; room.root.traverse(o => { if (o.isMesh && o.userData.interiorPass) out.push(o); }); return out; };

// ---- 1. where it runs
delete globalThis.__ERGO_PRESENTATION__;
{ const room = fakeRoom('home', HOME);
  assert.equal(interiorPassOn(room), false, 'the Studio (no presentation flag) gets no pass');
  assert.equal(applyInteriorPass(room, {}), null); assert.equal(passMeshes(room).length, 0, 'nothing is added to a Studio room');
  assert.equal(room.roomAtmosphere('morning', 1), 'own', 'the Studio room keeps its own atmosphere call'); }
globalThis.__ERGO_PRESENTATION__ = true;
// off unless asked for (the recipes are not yet approved from stills): ?interior=1 switches it on
assert.equal(DEFAULT_ON, false, 'the pass is opt-in until its stills are approved');
assert.equal(interiorPassOn(fakeRoom('home', HOME)), false, 'no address switch: no pass');
{ const room = fakeRoom('home', HOME); assert.equal(applyInteriorPass(room, {}), null); assert.equal(passMeshes(room).length, 0, 'default: nothing is added to a film room either'); }
globalThis.location = {search: '?view=product&presentation=1&interior=1'};
{ assert.equal(interiorPassOn(fakeRoom('home', HOME)), true);
  assert.equal(interiorPassOn(fakeRoom('creative', {id: 'premium', width: 5200, depth: 5800, height: 3000, back: -1850}, 'classic')), false, 'a Classic look is frozen: no pass');
  assert.equal(interiorPassOn(fakeRoom('home', {...HOME, id: 'apartment'})), false, 'a layout the film does not use has no recipe');
  assert.equal(interiorPassOn({id: 'product'}), false, 'the product stage is not a room'); }
// the switch on the address
{ const was = globalThis.location; globalThis.location = {search: '?view=product&presentation=1&interior=0'};
  try { assert.equal(interiorPassOn(fakeRoom('home', HOME)), false, '?interior=0 switches the pass off'); }
  finally { globalThis.location = was; }
  globalThis.location = {search: '?interior=1,-washes'};
  try { const room = fakeRoom('home', HOME); applyInteriorPass(room, {});
    assert(!passMeshes(room).some(m => /wall wash/.test(m.name)), '?interior=1,-washes drops the washes');
    assert(passMeshes(room).some(m => /wall shade/.test(m.name)), '… and keeps the envelope');
    assert.deepEqual(room.root.userData.interiorPass.layers, INTERIOR_LAYERS.filter(l => l !== 'washes')); }
  finally { globalThis.location = was; } }

// ---- 2. the film's rooms
const cutFile = path.join(root, 'exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json');
if (fs.existsSync(cutFile)) {
  for (const shot of JSON.parse(fs.readFileSync(cutFile, 'utf8')).shots) {
    if (shot.room === 'product') continue;
    assert(INTERIOR_RECIPES[shot.room + '/' + shot.layout], `chapter ${shot.id}: a recipe for ${shot.room}/${shot.layout}`);
  }
}
for (const [key, recipe] of Object.entries(INTERIOR_RECIPES)) {
  assert(/^[a-z]+\/[a-z0-9-]+$/.test(key), key + ': recipes are keyed room/layout (another layout of the room is another room)');
  assert(typeof recipe.shell === 'function' && recipe.steps?.length, key + ': a shell step and its description');
}

// ---- 3. presentation only
const room = fakeRoom('home', HOME), pass = applyInteriorPass(room, {});
assert(pass, 'the home office gets its pass'); finishInteriorPass(room);
const meshes = passMeshes(room);
assert(meshes.length >= 6, 'three wall shades, the floor falloff and two washes: ' + meshes.map(m => m.name).join(', '));
const hits = []; new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)).intersectObjects(meshes, true, hits);
assert.equal(hits.length, 0, 'no overlay is a ray target (drop-to-surface, picking)');
for (const m of meshes) {
  assert(m.material.transparent && m.material.depthWrite === false, m.name + ': transparent, no depth write (film-quality.mjs keeps such overlays out of the ambient occlusion pass)');
  assert(m.userData.presentationOnly && !m.castShadow && !m.receiveShadow, m.name + ': presentation only, no shadows');
  assert(!m.userData.sceneAssetKey && !m.userData.propId, m.name + ': not a scene asset');
  assert(m.name.startsWith('Interior pass: '), 'named: ' + m.name);
}
const group = room.root.children.find(c => c.name === 'Interior pass');
assert(group?.userData.grooveMarker && group.userData.presentationOnly, 'the pass group is no Groove obstacle');
// hung on the cutaway walls: hide a wall and its overlays go with it
for (const side of ['back', 'left', 'right']) {
  const wall = room.walls.find(w => w.obj.name === side + ' wall').obj;
  assert(wall.children.some(c => c.name === `Interior pass: wall shade (${side})`), side + ' wall carries its shade');
}
assert(!room.root.children.some(c => c.isLight) && !meshes.some(m => m.isLight), 'no real lights');
let lights = 0; room.root.traverse(o => { if (o.isLight) lights++; }); assert.equal(lights, 0, 'the pass adds no light to the room');

// ---- 4. draw order
for (const m of meshes) {
  if (/shade|falloff/.test(m.name)) { assert(m.renderOrder < 1, m.name + ': drawn before contact shading (1), sun patch and lamp pools (2) and the desk LED floor light (3)'); assert.equal(m.material.blending, THREE.NormalBlending); }
  else { assert.equal(m.renderOrder, 2); assert.equal(m.material.blending, THREE.AdditiveBlending, m.name + ': light is additive'); }
}

// ---- 5. wall quads: u = 0 at `from`
room.root.updateMatrixWorld(true);
const inverse = room.root.matrixWorld.clone().invert();
const ends = mesh => { const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv, at = {};
  for (let i = 0; i < pos.count; i++) { const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse); at[uv.getX(i) < .5 ? 'from' : 'to'] = p; }
  return at; };
{ const left = meshes.find(m => m.name === 'Interior pass: wall shade (left)'), right = meshes.find(m => m.name === 'Interior pass: wall shade (right)'), back = meshes.find(m => m.name === 'Interior pass: wall shade (back)');
  assert(Math.abs(ends(left).from.z - HOME.back) < 1 && Math.abs(ends(left).to.z - (HOME.back + HOME.depth)) < 1, 'left wall: back to front');
  assert(Math.abs(ends(right).from.z - (HOME.back + HOME.depth)) < 1 && Math.abs(ends(right).to.z - HOME.back) < 1, 'right wall: front to back');
  assert(Math.abs(ends(back).from.x + 1800) < 1 && Math.abs(ends(back).to.x - 1800) < 1, 'back wall: left to right');
  assert(ends(left).from.x > -1800 && ends(left).from.x < -1700, 'the left shade stands just inside its wall');
  assert(ends(right).from.x < 1800 && ends(right).from.x > 1700 && ends(back).from.z > HOME.back && ends(back).from.z < HOME.back + 100);
  // it faces into the room
  const normal = m => new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld).transformDirection(inverse);
  assert(normal(left).x > .99 && normal(right).x < -.99 && normal(back).z > .99, 'wall overlays face into the room');
  // the window: the back wall's shade leaves the opening clear (u from the left wall, v from the floor)
  const hole = back.material.uniforms.uHole.value[0];
  assert(Math.abs(hole.x - (-1565 + 1800) / 3600) < 1e-6 && Math.abs(hole.z - (225 + 1800) / 3600) < 1e-6 && Math.abs(hole.y - 805 / 2700) < 1e-6, 'the window opening is cut from the shade');
  for (const wash of meshes.filter(m => /window light along/.test(m.name))) assert(Math.abs(ends(wash).from.z - HOME.back) < 1, wash.name + ': enters at the window end'); }

// ---- 6. dayparts and the room's own call
const strength = m => m.material.uniforms ? m.material.uniforms.uStrength.value : m.material.color.r + m.material.color.g + m.material.color.b;
room.roomAtmosphere('morning', 1);
assert.deepEqual(room.calls.at(-1), ['morning', 1], 'the room\'s own atmosphere call still runs');
const wash = meshes.find(m => /window light along/.test(m.name)), shade = meshes.find(m => /wall shade \(right\)/.test(m.name));
assert(wash.visible && strength(wash) > 0 && shade.visible && strength(shade) > 0);
const morning = strength(wash);
room.roomAtmosphere('evening', 1); assert(strength(wash) > morning, 'low evening sun rakes further');
room.roomAtmosphere('night', 1); assert(!wash.visible && strength(wash) === 0, 'no window light at night'); assert(shade.visible, 'the envelope stays');
room.roomAtmosphere('morning', .5); assert(Math.abs(strength(wash) - morning * .5) < 1e-6, 'the Accent light dial scales the washes');
// a second build on the same room object replaces the first
applyInteriorPass(room, {}); assert.equal(passMeshes(room).length, meshes.length, 'rebuilding replaces the pass, it does not stack');

console.log('interior pass: ' + Object.keys(INTERIOR_RECIPES).length + ' room recipes, ' + meshes.length + ' overlays in the home office');
