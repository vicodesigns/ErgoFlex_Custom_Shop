// window-scenery.mjs: the modelled places outside the Studio's windows (no browser).
//   node tests/window-scenery-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachScenery, windowView, HOURS, LEVEL, SCENES, DEFAULT_VIEW, hourOf, ORDER, RIG_SUN } from '../window-scenery.mjs';
import { Builder, Leaves, LEAF, KIND, house, redwood, rand, sharedTextures } from '../window-scenery-kit.mjs?v=polish-20261113b';   // (the stamp the scenery module imports it with: one instance)

// Texture rows follow DataTexture storage. A needle card grows away from the stem
// at row 238 of the upper-right tile.
for (const cell of Object.values(LEAF)) {
    const leaves = new Leaves(new Builder());
    leaves.card(new THREE.Vector3(), 100, new THREE.Vector3(0, 0, 1), 0, cell, new THREE.Color());
    const u = (cell % 2) / 2, v = Math.floor(cell / 2) / 2;
    assert.deepEqual(leaves.uv.slice(0, 6), [u, v + .5, u + .5, v + .5, u + .5, v]);
}

// From either side of a window edge there should be one surface at the
// facade. A second frame or wall behind the glass competes in distant views.
{
    const land = new Builder();
    house({ land, lights: new Builder() }, () => .5, 0, 0, 0, { porch: false, lit: [] });
    const geo = land.geometry(), mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, 6600);
    for (const x of [-2880, -2240, -2140, 0]) { // glass, trim, plaster, door
        ray.ray.origin.set(x, 1545, 10000);
        const hits = ray.intersectObject(mesh);
        assert.deepEqual(hits.map(h => h.distance), [6500], 'single front surface at ' + x);
    }
    geo.dispose(); mesh.material.dispose();
}

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
    if (name === 'garden') {
        const canopy = land.geometry.getAttribute('canopy');
        assert.ok(canopy.normalized && canopy.count === land.geometry.attributes.position.count);
        assert.ok(canopy.array.some(value => value > 0), 'nearby crowns cast shade');
        assert.ok(u.shadeHour.value.x > 0 && u.shadeHour.value.y === 0);
        view.setHour('afternoon');
        assert.ok(u.shadeHour.value.x === 0 && u.shadeHour.value.y > 0);
        view.setHour('morning');
    }
    assert.equal(u.lamp.value, 0, name + ': no lights in the morning'); assert.equal(u.level.value, LEVEL);
    view.setHour('night'); const night = snap();
    assert.equal(u.shadeHour.value.lengthSq(), 0, 'no sunlight shadows at night');
    assert.ok(u.lamp.value === 1 && u.tint.value.x < .3 && s.zenith.value.r < .1, name + ': at night the land and the sky go dark and the lights come on');
    morning.forEach(([k, a], i) => { const b = night[i][1]; if (typeof a === 'number' ? a === b : a?.equals?.(b) ?? true) return;
        assert.ok(typeof a === 'number' || a.isColor || a.isVector3, name + ': ' + k + ' changes with the hour and is a number, colour or Vector3 (film-tod blends those)'); });
    for (const id of Object.keys(HOURS)) { view.setHour(id); const h = hourOf(name, id);
        assert.ok(Math.max(...h.tint) <= 1.02 && h.haze > 0 && h.haze < 1, name + ' ' + id + ': a tint that does not brighten the land, some haze');
        const sun = new THREE.Vector3().copy(s.sunLocal.value); assert.ok(Math.abs(sun.length() - 1) < 1e-6 && sun.y > 0 && sun.z > 0, name + ' ' + id + ': the sun (or the moon) is up, outside the window'); }
    for (const m of view.materials) assert.ok(uniformKinds(m), name + ': every uniform is a number, a colour, a vector, the window\'s matrix, the openings or a shared generated texture');
    // the frame follows the window: straight out of this one is -Z
    pane.onBeforeRender(); assert.ok(s.wOut.value.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6, name + ': straight out of the window');
    if (name === 'garden') {
        const renderAt = seconds => {
            pane.onBeforeRender(null, { userData: { windowSkySeconds: seconds } });
            return s.weatherSeconds.value;
        };
        const first = renderAt(0), later = renderAt(9);
        assert.ok(later > first, 'the cloud bank moves while the film plays');
        assert.equal(renderAt(0), first, 'scrubbing back restores the sky');
        assert.equal(renderAt(9), later, 'exporting the same frame restores the same clouds');
    }
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
    assert.equal(sea.material.uniforms.weatherSeconds, view.sky.uniforms.weatherSeconds, name + ': clouds and swells use the same playback clock');
    assert.ok(Math.abs(sea.material.uniforms.shoreZ.value - b.max.z) < 1, name + ': shallows follow the near edge of the sea');
    assert.ok(deg > 6 && deg < 12, name + ': the sea from the horizon down to ' + deg.toFixed(1) + ' degrees'); view.dispose(); }

// ---- the outdoor pass of November 25: the sun where the room's key light says, what surfaces are made of, the bole
{ // RIG_SUN is room-refinement.mjs DAY_ANGLES (the window's outward plus `sweep` along the wall, `elevation` up) in the
  // sky's terms; every scene's daytime sun stands there unless its room has its own angles (the workshop's yard)
  const DAY_ANGLES = { morning: [.62, -.36], afternoon: [1.45, .12], evening: [.32, .48] }, deg = 180 / Math.PI;
  for (const [id, [elevation, sweep]] of Object.entries(DAY_ANGLES)) {
      assert.ok(Math.abs(RIG_SUN[id][0] - Math.atan(sweep) * deg) < .1 && Math.abs(RIG_SUN[id][1] - Math.atan(elevation / Math.hypot(1, sweep)) * deg) < .1, id + ': the sun is where the room\'s key light comes from');
      for (const name of Object.keys(SCENES)) assert.deepEqual(hourOf(name, id).sun.slice(0, 2), SCENES[name].rig?.[id] || RIG_SUN[id], name + ' ' + id + ': no scene keeps a sun of its own by day'); }
  assert.ok(Math.abs(SCENES.yard.rig.morning[0] - Math.atan(-.22) * deg) < .1 && Math.abs(SCENES.yard.rig.morning[1] - Math.atan(.95 / Math.hypot(1, .22)) * deg) < .1, 'the yard has the workshop\'s broad day angle');
  for (const id of ['night', 'party']) assert.deepEqual(hourOf('garden', id).sun, HOURS[id].sun, id + ': the moon stays the hour\'s own');
  // in a built room the rig's very direction is taken (root.userData.lighting): a turned and scaled room with windows
  // on its back wall (the daylight wall) and its right wall
  const root = new THREE.Group(), back = new THREE.Group(), side = new THREE.Group(); root.add(back, side); root.rotation.y = .8; root.scale.setScalar(.001); root.position.set(3, 0, -2);
  const a = paneIn(back, 1500, 1400, [0, 1550, -2000]), b = paneIn(side, 1500, 1400, [2500, 1550, 0], -Math.PI / 2); root.updateWorldMatrix(true, true);
  const view = attachScenery([a, b], 'garden', { floor: -1550 }), [front, right] = view.worlds.map(w => w.sky.uniforms.sunLocal.value);
  const direction = new THREE.Vector3(-.36, .62, -1).normalize();   // morning through the back wall (outward -z, along +x)
  view.setHour('morning'); assert.ok(Math.abs(front.x - right.x) < 1e-9 && Math.abs(front.z - right.z) < 1e-9, 'without a rig every wall has the hour\'s sun before it');
  root.userData.lighting = { mode: 'morning', source: 'window-daylight', direction: direction.toArray() };
  view.setHour('morning');
  assert.ok(Math.abs(front.x - direction.x) < 1e-6 && Math.abs(front.y - direction.y) < 1e-6 && Math.abs(front.z + direction.z) < 1e-6, 'the daylight wall: the sun in its sky is the key light\'s direction');
  const s = hourOf('garden', 'morning').sun, az = s[0] / deg, el = s[1] / deg;
  assert.ok(Math.abs(front.x - Math.sin(az) * Math.cos(el)) < 2e-3 && Math.abs(front.y - Math.sin(el)) < 2e-3, 'which is the hour\'s sun (RIG_SUN) for a room with the common angles');
  assert.ok(Math.abs(right.x - direction.z) < 1e-6 && Math.abs(right.z - direction.x) < 1e-6 && right.x < 0 && right.z < 0, 'the right wall: the same sun, off to its left and behind the building');
  for (const w of view.worlds) { const f = w.materials[0].uniforms.sunDirF.value, sky = w.sky.uniforms.sunLocal.value; assert.ok(Math.abs(f.x - sky.x) < 1e-9 && Math.abs(f.z + sky.z) < 1e-9, 'the land is lit from there'); }
  root.userData.lighting = { mode: 'afternoon', source: 'window-daylight', direction: direction.toArray() };
  view.setHour('morning'); assert.ok(Math.abs(front.x - right.x) < 1e-9, 'a rig that ran for another hour is not this hour\'s sun');
  root.userData.lighting = { mode: 'night', source: 'ceiling-wash', direction: [0, 1, 0] };
  view.setHour('night'); assert.ok(front.z > 0 && Math.abs(front.y - Math.sin(HOURS.night.sun[1] / deg)) < 1e-6, 'after dark the rig is a ceiling wash: the moon is the hour\'s');
  view.dispose(); }
{ // what a surface is made of: four bytes a vertex; facades carry their block's own make, a redwood's bole is bark
  const kinds = (name, options) => { const view = attachScenery(paneIn(new THREE.Group(), 1700, 1400, [0, 1550, -1800]), name, { floor: -1550, ...options }), k = view.group.children[0].geometry.attributes.kind, seen = new Map();
      assert.ok(k && k.itemSize === 4 && k.normalized && k.count === view.group.children[0].geometry.attributes.position.count, name + ': a kind for every vertex');
      for (let i = 0; i < k.count; i++) { const id = k.array[i * 4]; if (!seen.has(id)) seen.set(id, new Set()); seen.get(id).add(k.array[i * 4 + 1] + ':' + k.array[i * 4 + 2] + ':' + k.array[i * 4 + 3]); }
      view.dispose(); return seen; };
  const city = kinds('city', { variant: 'square', storey: 13000, seed: 4401 });
  assert.ok(city.get(KIND.facade)?.size > 12, 'the roofscape and skyline: many makes of facade (' + city.get(KIND.facade)?.size + '), not one grid');
  assert.ok([...city.get(KIND.facade)].every(v => +v.split(':')[2] > 0), 'every tagged block has its own number (0 is the plain grid of an untagged facade)');
  assert.ok(kinds('humboldt', { seed: 7130 }).has(KIND.bark) && kinds('studio-garden', { seed: 1302 }).has(KIND.brick) && kinds('garden', {}).has(KIND.tiles), 'bark in the grove, brick in the studio garden\'s wall, tiles on the neighbours\' roofs');
  // the bole is modelled from where the tree stands, not from the scene's random stream: a tree just inside 34 m (modelled) and
  // one just beyond it (a plain column) draw the same numbers, so the Commons' trees keep
  // their film marks whatever the bole's detail
  const grow = z => { let n = 0; const r = rand(77), land = new Builder(); land.leaves = new Leaves(land); redwood(land, () => { n++; return r(); }, 0, 0, z, { height: 46000, girth: 1.4, size: 2200 }); return [n, land]; };
  const [n, land] = grow(-33990), [far] = grow(-34010), geo = land.geometry(), p = geo.attributes.position; let foot = 0, waist = 0;
  assert.equal(n, far, 'the bole draws nothing from the stream');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), rr = Math.hypot(p.getX(i), p.getZ(i) + 33990); if (y < 100) foot = Math.max(foot, rr); if (y > 6000 && y < 9000) waist = Math.max(waist, rr); }
  assert.ok(foot > waist * 1.6 && foot < waist * 4, 'a redwood near the glass flares into buttresses at its foot (' + Math.round(foot) + ' against ' + Math.round(waist) + ' mm at 6 to 9 m)');
  assert.ok(geo.attributes.position.count / 3 > 1500, 'and is modelled finely enough to hold its bark ridges');
  geo.dispose(); }

assert.throws(() => attachScenery(new THREE.Mesh(), 'moon-base', { width: 1, height: 1 }), /No window scenery/);
console.log('PASS window scenery: the view switch and its default, ' + Object.keys(SCENES).length + ' scenes (built, outside the wall, cost, lights after dark, depth, hours, reuse), several openings in one wall, walls facing different ways, the opening test, dispose, draw order and sharing, light from the sky\'s sun, navy party, leaves under lamps, three city compositions, sky from high floors, the sea in view, the sun where the room\'s key light says, material kinds, the redwood bole');
