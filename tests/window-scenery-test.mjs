// window-scenery.mjs: the modelled places outside the Studio's windows (no browser).
//   node tests/window-scenery-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachScenery, windowView, HOURS, LEVEL, SCENES, DEFAULT_VIEW, hourOf, ORDER } from '../window-scenery.mjs';
import { sharedTextures } from '../window-scenery-kit.mjs?v=polish-20261113b';   // (the stamp the scenery module imports it with: one instance)

// ---- which view a window shows: the 3D scenery unless asked otherwise, the default in one place
assert.equal(windowView('home'), 'scenery', 'the default view is the 3D scenery'); assert.equal(windowView(), 'scenery');
globalThis.__efWindowView = 'photo'; assert.equal(windowView('gym'), 'photo');
globalThis.__efWindowView = 'painted'; assert.equal(windowView('gym'), 'painted');
globalThis.__efWindowView = 'hologram'; assert.equal(windowView('gym'), 'scenery', 'an unknown view is the default');
delete globalThis.__efWindowView;
DEFAULT_VIEW.music = 'photo'; assert.equal(windowView('music'), 'photo', 'a room can have its own default'); assert.equal(windowView('gym'), 'scenery');
DEFAULT_VIEW['*'] = 'photo'; assert.equal(windowView('gym'), 'photo', 'one line makes the photograph every room\'s default');
globalThis.__efWindowView = 'scenery'; assert.equal(windowView('music'), 'scenery', 'asking for the scenery still works when the photograph is the default');
delete globalThis.__efWindowView; delete DEFAULT_VIEW.music; DEFAULT_VIEW['*'] = 'scenery';

const paneIn = (parent, w, h, at, turn = 0, geometry = 'plane') => {
    const pane = new THREE.Mesh(geometry === 'box' ? new THREE.BoxGeometry(w, h, 8) : new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial());
    pane.position.set(...at); pane.rotation.y = turn; parent.add(pane); return pane;
};
const uniformKinds = m => Object.entries(m.uniforms).every(([, x]) => typeof x.value === 'number' || (x.value.isTexture && x.value.userData.sharedScenery) || x.value.isColor || x.value.isVector3 || x.value.isVector2 || x.value.isMatrix4 || (Array.isArray(x.value) && x.value.every(v => v.isVector3 || v.isVector2)));
const nearestZ = mesh => { const p = mesh.geometry.attributes.position; let nearest = -Infinity; for (let i = 0; i < p.count; i++) nearest = Math.max(nearest, p.getZ(i)); return Math.round(nearest); };

// ---- every scene: built, outside the wall, at a cost a room can carry, its own light, every hour
for (const name of Object.keys(SCENES)) {
    const root = new THREE.Group(), wall = new THREE.Group(); root.add(wall); root.scale.setScalar(.001);
    const pane = paneIn(wall, 1700, 1400, [-670, 1550, -1865]);
    const view = attachScenery(pane, name, { floor: -1550, hour: 'morning' });
    assert.ok(view.group.parent === wall && view.group.position.equals(pane.position), name + ': the scenery stands at the pane, in the wall\'s group');
    const [land, lights, halos] = view.group.children;
    for (const mesh of [land, lights]) {
        const p = mesh.geometry.attributes.position, t = mesh.geometry.attributes.tone;
        assert.ok(p.count > 0 && p.count === t.count && p.count % 3 === 0, name + ' ' + mesh.name + ': a colour for every vertex');
        assert.ok(!mesh.castShadow && !mesh.receiveShadow && mesh.material.isShaderMaterial, mesh.name + ': its own light, no shadows');
        const nearest = nearestZ(mesh); assert.ok(nearest < -40, name + ' ' + mesh.name + ': everything is outside the wall (nearest ' + nearest + ' mm)');
        for (let i = 0; i < t.count * 3; i++) assert.ok(Number.isFinite(t.array[i]) && t.array[i] >= 0 && t.array[i] < 1.6, name + ' ' + mesh.name + ': sane colours');
    }
    assert.ok(halos.material.transparent && halos.material.blending === THREE.AdditiveBlending && halos.geometry.attributes.corner, name + ': soft halos round the lamps');
    assert.ok(lights.geometry.attributes.position.count > 0 && halos.geometry.attributes.position.count > 0, name + ': something lights up after dark');
    const glow = land.geometry.attributes.glow; let lit = 0; for (let i = 0; i < glow.count; i++) if (glow.getX(i) + glow.getY(i) + glow.getZ(i) > .05) lit++;
    assert.ok(lit > 50, name + ': the lamps throw light on the land after dark (' + lit + ' vertices)');
    const triangles = view.triangles;
    assert.ok(triangles > 15000 && triangles < 150000, name + ': a place, at a cost a room can carry (' + triangles + ' triangles)');
    // near things and far things: that is the depth a photograph cannot have
    { const p = land.geometry.attributes.position; let near = 0, far = 0;
      for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > -4000) near++; if (z < -20000) far++; }
      assert.ok(near > 500 && far > 300, name + ': things right outside the glass and things far off (' + near + ' near, ' + far + ' far vertices)'); }
    // seen only through the opening: every shader tests the sight line against the window's rectangle
    for (const m of [land.material, lights.material, halos.material]) assert.ok(/!throughWindow\(vWorld\)\) discard/.test(m.fragmentShader) && m.defines.OPENINGS === 1 && m.uniforms.openHalf.value[0].equals(new THREE.Vector2(850, 700)), name + ': kept only where the sight line crosses the opening');
    assert.ok(/discard;\s+\/\/ from outside the wall/.test(view.sky.fragmentShader), name + ': the sky is not drawn from outside the wall');
    assert.ok(land.material.uniforms === lights.material.uniforms && land.material.uniforms === halos.material.uniforms, name + ': one set of values for the land, its lights and halos');
    // the coast's scenes look out to the sea: a plane of its own (the sky in it, the sun's glitter), more of it in the sky to the horizon
    if (/socal|beach/.test(name)) { const sea = view.group.children.find(o => o.name === 'Window scenery sea');
        assert.ok(sea && /!throughWindow\(vWorld\)\) discard/.test(sea.material.fragmentShader) && view.sky.uniforms.sea.value === 1 && view.materials.includes(sea.material), name + ': the Pacific beyond the land, seen only through the opening'); }
    else assert.equal(view.sky.uniforms.sea.value, 0, name + ': no sea');
    // the pane is the sky: drawn first, without depth, so the land shows in front of it
    assert.ok(pane.material === view.sky && !view.sky.depthWrite && pane.renderOrder < land.renderOrder, name + ': the pane carries the sky');
    // the hours: numbers, colours and vectors that the film's time-of-day blend (film-tod) can carry from one to the next
    const u = land.material.uniforms, s = view.sky.uniforms, snap = () => view.materials.flatMap(m => Object.entries(m.uniforms).map(([k, x]) => [m.name + '.' + k, typeof x.value === 'number' ? x.value : x.value.clone?.()]));
    view.setHour('morning'); const morning = snap();
    assert.equal(u.lamp.value, 0, name + ': no lights in the morning'); assert.equal(u.level.value, LEVEL);
    view.setHour('night'); const night = snap();
    assert.ok(u.lamp.value === 1 && u.tint.value.x < .3 && s.zenith.value.r < .1, name + ': at night the land and the sky go dark and the lights come on');
    morning.forEach(([k, a], i) => { const b = night[i][1]; if (typeof a === 'number' ? a === b : a?.equals?.(b) ?? true) return;
        assert.ok(typeof a === 'number' || a.isColor || a.isVector3, name + ': ' + k + ' changes with the hour and is a number, colour or Vector3 (film-tod blends those)'); });
    for (const id of Object.keys(HOURS)) { view.setHour(id); const h = hourOf(name, id);
        assert.ok(Math.max(...h.tint) <= 1.02 && h.haze > 0 && h.haze < 1, name + ' ' + id + ': a tint that does not brighten the land, some haze');
        const sun = new THREE.Vector3().copy(s.sunLocal.value); assert.ok(Math.abs(sun.length() - 1) < 1e-6 && sun.y > 0 && sun.z > 0, name + ' ' + id + ': the sun (or the moon) is up, outside the window'); }
    for (const m of view.materials) assert.ok(uniformKinds(m), name + ': every uniform is a number, a colour, a vector, the window\'s matrix, the openings or a shared generated texture');
    // the frame follows the window: straight out of this one is -Z
    pane.onBeforeRender(); assert.ok(s.wOut.value.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6, name + ': straight out of the window');
    // built once: the same room built again takes the same geometry
    const again = attachScenery(paneIn(new THREE.Group(), 1700, 1400, [-670, 1550, -1865]), name, { floor: -1550 });
    assert.equal(again.group.children[0].geometry, land.geometry, name + ': built once, reused when the room is rebuilt'); again.dispose();
    view.dispose();
    assert.ok(pane.material.isMeshBasicMaterial && !view.group.parent && pane.renderOrder === 0 && !pane.userData.windowScenery, name + ': disposed, the pane has its own material again');
}

// ---- the rooms' own versions of a place (variant, storey, seed as the rooms pass them): built, outside the wall, affordable,
// and no two the same
{ const rooms = [['back-garden', 'bedroom', 3000, 2101], ['back-garden', 'kitchen', 0, 2202], ['back-garden', 'kids', 0, 2303],
    ['campus', 'quad', 0, 5101], ['campus', 'court', 4000, 5202], ['campus', 'green', 0, 5303], ['campus', 'quad', 8000, 5404],
    ['schoolyard', 'kinder', 0, 6101], ['schoolyard', 'elementary', 0, 6202], ['schoolyard', 'middle', 4000, 6303],
    ['city', 'ledge', 22000, 3101], ['city', 'planters', 9000, 3202], ['city', 'open', 0, 3303], ['city', 'balcony', 15000, 3404], ['city', 'glass', 30000, 3505],
    ['city', 'hospital', 12000, 4101], ['city', 'louvres', 7500, 4202], ['city', 'dock', 1200, 4303], ['city', 'civic+flowerbox', 6000, 4404], ['city', 'bars', 3600, 4505], ['city', 'ledge', 38000, 4606]];
  const seen = new Set();
  for (const [name, variant, storey, seed] of rooms) { if (!SCENES[name]) continue;   // (a scene not built yet)
      const pane = paneIn(new THREE.Group(), 1600, 1450, [0, 1575, -1800]), view = attachScenery(pane, name, { floor: -1575, variant, storey, seed });
      const land = view.group.children[0], nearest = nearestZ(land), key = land.geometry.attributes.position.count + ':' + land.geometry.attributes.position.getX(1000);
      assert.ok(nearest < -40 && view.triangles > 8000 && view.triangles < 150000, `${name} ${variant} ${storey}: outside the wall (${nearest}), ${view.triangles} triangles`);
      assert.ok(!seen.has(key), `${name} ${variant} ${storey}: not the same view as another room's`); seen.add(key); view.dispose();
  } }

// ---- the home room's pane (a thin box) and an opening size given by the room
{ const wall = new THREE.Group(), painted = new THREE.MeshBasicMaterial(), pane = paneIn(wall, 1700, 1400, [-670, 1550, -1865], 0, 'box'); pane.material = painted;
  const view = attachScenery(pane, 'garden', { width: 1700, height: 1400, floor: -1550 });
  assert.ok(pane.userData.paintedMaterial === painted && view.group.children[0].material.uniforms.openHalf.value[0].equals(new THREE.Vector2(850, 700)), 'a box pane: the opening from its face');
  view.dispose(); assert.equal(pane.material, painted); }

// ---- several windows in one wall: one world, every window an opening into it, lined up
{ const wall = new THREE.Group(), a = paneIn(wall, 1200, 1400, [-1500, 1550, -2000]), b = paneIn(wall, 1800, 1400, [1400, 1550, -2000]), c = paneIn(wall, 900, 2100, [3600, 1050, -1700]);
  const view = attachScenery([a, b, c], 'garden', { floor: -1550 });
  assert.equal(view.groups.length, 1, 'three windows in one wall look out on one world');
  const u = view.group.children[0].material.uniforms;
  assert.equal(view.group.children[0].material.defines.OPENINGS, 3);
  assert.ok(u.openAt.value[0].length() < 1e-6 && u.openAt.value[1].distanceTo(new THREE.Vector3(2900, 0, 0)) < 1e-6 && u.openAt.value[2].distanceTo(new THREE.Vector3(5100, -500, 300)) < 1e-6, 'each opening where its window is, in the first one\'s frame (a door set 300 into the room)');
  assert.ok(u.openHalf.value[2].equals(new THREE.Vector2(450, 1050)), 'each opening its own size');
  assert.ok(a.material === b.material && b.material === c.material && a.material === view.sky, 'one sky for the wall');
  b.position.x = 1500; b.updateMatrixWorld(); a.onBeforeRender(); assert.ok(u.openAt.value[1].distanceTo(new THREE.Vector3(3000, 0, 0)) < 1e-6, 'an opening follows its window');
  view.dispose(); assert.ok([a, b, c].every(p => p.material.isMeshBasicMaterial)); }

// ---- windows on two walls (a corner room, a glazed door opposite): a world for each way they face
{ const room = new THREE.Group(), back = new THREE.Group(), side = new THREE.Group(); room.add(back, side);
  const a = paneIn(back, 1500, 1400, [0, 1550, -2000]), b = paneIn(side, 1500, 1400, [2500, 1550, 0], -Math.PI / 2), c = paneIn(side, 1500, 1400, [2500, 1550, 1800], -Math.PI / 2);
  const view = attachScenery([a, b, c], 'garden', { floor: -1550 });
  assert.equal(view.groups.length, 2, 'two walls, two worlds');
  assert.ok(view.groups[0].parent === back && view.groups[1].parent === side, 'each world in its wall\'s group (it goes when the cutaway takes the wall)');
  assert.notEqual(view.groups[0].children[0].geometry, view.groups[1].children[0].geometry, 'each wall looks out on its own part of the place');
  assert.equal(view.groups[1].children[0].material.defines.OPENINGS, 2);
  view.setHour('night'); assert.ok(view.materials.filter(m => m.uniforms.lamp).every(m => m.uniforms.lamp.value === 1), 'one hour for all of it');
  view.dispose(); }

// ---- the opening test, mirrored here: the sight line through an opening, from inside only
{ const through = (p, o, openings) => openings.some(([x, y, z, hx, hy]) => { if (p.z >= z || o.z <= z) return false; const t = (o.z - z) / (o.z - p.z), hit = [o.x + (p.x - o.x) * t, o.y + (p.y - o.y) * t]; return Math.abs(hit[0] - x) <= hx && Math.abs(hit[1] - y) <= hy; });
  const openings = [[0, 0, 0, 850, 700], [2900, 0, 0, 600, 700]], V = (x, y, z) => ({ x, y, z });
  assert.ok(through(V(0, 0, -5000), V(0, 0, 3000), openings), 'straight out through the first window');
  assert.ok(through(V(2900 * 8 / 3, 0, -5000), V(0, 0, 3000), openings), 'the same world through the second window');
  assert.ok(!through(V(1500 * 8 / 3, 0, -5000), V(0, 0, 3000), openings), 'not through the wall between them');
  assert.ok(!through(V(0, 6000, -5000), V(0, 0, 3000), openings), 'not above the window');
  assert.ok(!through(V(0, 0, -5000), V(0, 0, -8000), openings), 'nothing from outside the wall'); }

// ---- the November 13 review's checks: draw order, sharing, the light agreeing with the sun, compositions, the coast
{ const pane = paneIn(new THREE.Group(), 1700, 1400, [0, 1550, -1800]), view = attachScenery(pane, 'garden', { floor: -1550 }), meshes = view.group.children;
  assert.ok(ORDER.pane < 0 && meshes.every(m => m.renderOrder > 0), 'the land is drawn after the room\'s opaques (the walls reject it first), the sky pane first');
  assert.ok(meshes.every(m => m.userData.sharedProp && m.ownedMaterials?.[0] === m.material), 'the room frees the materials, not the kept geometry');
  assert.ok(pane.replacedMaterials?.length === 1, 'the pane\'s own material is freed with the room');
  const leaves = meshes.find(m => m.name === 'Window scenery leaves'); assert.ok(leaves && leaves.geometry.attributes.uv && /LEAVES/.test(Object.keys(leaves.material.defines).join()), 'foliage is cards cut out of the leaf texture');
  const { leaves: atlas, noise } = sharedTextures(); assert.ok(leaves.material.uniforms.leafMap.value === atlas && view.sky.uniforms.noiseMap.value === noise && atlas.image.width === 512 && noise.image.width === 128, 'two small generated textures, shared');
  const land = meshes[0], n = land.geometry.attributes.normal; assert.ok(n && n.normalized && n.array instanceof Int8Array, 'the land carries its normals (lit in the shader)');
  for (const id of Object.keys(HOURS)) { view.setHour(id); const s = view.sky.uniforms.sunLocal.value, f = land.material.uniforms.sunDirF.value;
      assert.ok(Math.abs(f.x - s.x) < 1e-9 && Math.abs(f.y - s.y) < 1e-9 && Math.abs(f.z + s.z) < 1e-9, id + ': the land is lit from where the sun is in the sky'); }
  view.setHour('party'); const z = view.sky.uniforms.zenith.value, hsl = {}; z.getHSL(hsl, THREE.SRGBColorSpace); assert.ok(hsl.s < .6 && hsl.l < .1 && hsl.h > .55 && hsl.h < .7, 'party outside is a navy late evening, not violet');
  const g = land.geometry.attributes.glow, lg = leaves.geometry.attributes.glow; let wall = 0, leaf = 0; for (let i = 0; i < g.count; i++) wall = Math.max(wall, g.getX(i)); for (let i = 0; i < lg.count; i++) leaf = Math.max(leaf, lg.getX(i));
  assert.ok(leaf < wall * .5, 'leaves take a fraction of a lamp\'s light (no paper lanterns)');
  view.dispose(); }
// the film's three city chapters see three different compositions; from high up the sky has the upper part of the window
{ const eyeAbove = (name, variant, storey, seed, within) => { const pane = paneIn(new THREE.Group(), 1600, 1450, [0, 1575, -1800]), view = attachScenery(pane, name, { floor: -1575, variant, storey, seed });
      const p = view.group.children[0].geometry.attributes.position; let worst = -90;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - 25, z = p.getZ(i); if (Math.abs(x) < 6000 && z < -8000 && z > -within) worst = Math.max(worst, Math.atan2(y, -z) * 180 / Math.PI); }
      const key = p.count; view.dispose(); return { worst, key }; };
  const gym = eyeAbove('city', 'square', 600, 4401, 150000), music = eyeAbove('city', 'low', 3400, 6203, 150000), gaming = eyeAbove('city-neon', 'corner', 3400, 9077, 150000);
  assert.ok(new Set([gym.key, music.key, gaming.key]).size === 3, 'the gym, the gaming room and the music room do not share a street');
  assert.ok(music.worst < 10, 'the music room (the film\'s night chapter) sees sky over the roofs across (' + music.worst.toFixed(1) + ' deg)');
  for (const [variant, storey, seed] of [['ledge', 22000, 3101], ['glass', 30000, 3505], ['ledge', 38000, 4606]]) { const { worst } = eyeAbove('city', variant, storey, seed, 150000);
      assert.ok(worst < 4, `from ${storey / 1000} m up the roofs within 150 m stay below the eye (${worst.toFixed(1)} deg)`); } }
// the coast: the sea a band six to twelve degrees deep below the horizon from the rooms' storeys
for (const [name, storey] of [['beach-school', 4000], ['socal-campus', 8400]]) { const pane = paneIn(new THREE.Group(), 1600, 1450, [0, 1575, -1800]), view = attachScenery(pane, name, { floor: -1575, storey });
    const sea = view.group.children.find(o => o.name === 'Window scenery sea'); sea.geometry.computeBoundingBox(); const b = sea.geometry.boundingBox, deg = Math.atan2(25 - b.max.y, -b.max.z) * 180 / Math.PI;
    assert.ok(deg > 6 && deg < 12, name + ': the sea from the horizon down to ' + deg.toFixed(1) + ' degrees'); view.dispose(); }

assert.throws(() => attachScenery(new THREE.Mesh(), 'moon-base', { width: 1, height: 1 }), /No window scenery/);
console.log('PASS window scenery: the view switch and its default, ' + Object.keys(SCENES).length + ' scenes (built, outside the wall, cost, lights after dark, depth, hours, reuse), several openings in one wall, walls facing different ways, the opening test, dispose, draw order and sharing, light from the sky\'s sun, navy party, leaves under lamps, three city compositions, sky from high floors, the sea in view');
