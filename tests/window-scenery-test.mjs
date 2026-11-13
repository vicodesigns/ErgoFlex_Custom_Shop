// window-scenery.mjs: the modelled garden outside a window (no browser).
//   node tests/window-scenery-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachScenery, windowView, HOURS, LEVEL, SCENES } from '../window-scenery.mjs';

// ---- which view a window shows: the photograph unless asked otherwise
assert.equal(windowView(), 'photo', 'the default view is the photograph');
globalThis.__efWindowView = 'scenery'; assert.equal(windowView(), 'scenery');
globalThis.__efWindowView = 'painted'; assert.equal(windowView(), 'painted');
globalThis.__efWindowView = 'hologram'; assert.equal(windowView(), 'photo', 'an unknown view is the photograph');
delete globalThis.__efWindowView;

// ---- a window: a pane in a wall group, the room on its +Z
const wall = new THREE.Group(), painted = new THREE.MeshBasicMaterial();
const pane = new THREE.Mesh(new THREE.BoxGeometry(1700, 1400, 8), painted); pane.position.set(-670, 1550, -1865); wall.add(pane);
const view = attachScenery(pane, 'garden', { width: 1700, height: 1400, floor: -1550, hour: 'morning' });
assert.ok(SCENES.garden && view.group.parent === wall && view.group.position.equals(pane.position), 'the scenery stands at the pane, in the wall\'s group');
const [land, glow] = view.group.children;
for (const mesh of [land, glow]) {
    const p = mesh.geometry.attributes.position, t = mesh.geometry.attributes.tone;
    assert.ok(p.count > 0 && p.count === t.count && p.count % 3 === 0, mesh.name + ': a colour for every vertex');
    assert.ok(!mesh.castShadow && !mesh.receiveShadow && mesh.material.isShaderMaterial, mesh.name + ': its own light, no shadows');
    let nearest = -Infinity; for (let i = 0; i < p.count; i++) nearest = Math.max(nearest, p.getZ(i));
    assert.ok(nearest < -40, mesh.name + ': everything is outside the wall (nearest ' + Math.round(nearest) + ' mm)');
    for (let i = 0; i < t.count * 3; i++) assert.ok(Number.isFinite(t.array[i]) && t.array[i] >= 0 && t.array[i] < 1.6, mesh.name + ': sane colours');
}
const triangles = land.geometry.attributes.position.count / 3;
assert.ok(triangles > 20000 && triangles < 250000, 'a garden, at a cost a room can carry (' + triangles + ' triangles)');
// near things and far things: that is the depth a photograph cannot have
{ const p = land.geometry.attributes.position; let near = 0, far = 0;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); if (z > -1500 && y > -900) near++; if (z < -25000) far++; }
  assert.ok(near > 500 && far > 500, 'planting right outside the glass and things beyond the fence (' + near + ' near, ' + far + ' far vertices)'); }
// seen only through the opening: both shaders test the sight line against the window's rectangle
for (const m of [land.material, glow.material]) assert.ok(/throughWindow\(vWorld\)\) discard/.test(m.fragmentShader) && m.uniforms.portalHalf.value.equals(new THREE.Vector2(850, 700)), 'kept only where the sight line crosses the opening');
assert.equal(land.material.uniforms, glow.material.uniforms, 'one set of values for the garden and its lights');

// ---- the pane is the sky: drawn first, without depth, so the garden shows in front of it
assert.ok(pane.material === view.sky && !view.sky.depthWrite && pane.renderOrder < land.renderOrder && pane.userData.paintedMaterial === painted, 'the pane carries the sky and keeps its painted material aside');

// ---- the hour: a tint, the sky, lights after dark; numbers and colours only (the film's time-of-day blend reads them)
const u = land.material.uniforms, s = view.sky.uniforms;
assert.equal(u.lamp.value, 0, 'no lights in the morning'); assert.equal(u.level.value, LEVEL);
const morning = { tint: u.tint.value.clone(), zenith: s.zenith.value.clone() };
view.setHour('night');
assert.equal(u.lamp.value, 1, 'lit windows and garden lights at night');
assert.ok(u.tint.value.x < morning.tint.x * .3 && s.zenith.value.r < morning.zenith.r * .3, 'the garden and the sky go dark');
for (const [id, h] of Object.entries(HOURS)) { view.setHour(id);
    assert.ok(Math.max(...h.tint) <= 1.02 && h.haze > 0 && h.haze < 1, id + ': a tint that does not brighten the garden, some haze');
    assert.ok(Math.abs(s.sunDir.value.length() - 1) < 1e-6 && s.sunDir.value.y > 0, id + ': the sun (or the moon) is above the horizon'); }
for (const m of view.materials) for (const [k, x] of Object.entries(m.uniforms)) assert.ok(typeof x.value === 'number' || x.value.isColor || x.value.isVector3 || x.value.isVector2 || x.value.isMatrix4, 'uniform ' + k + ' is a number, a colour, a vector or the window\'s matrix');
// the sun turns with the window: straight out of this one is -Z
view.setHour('afternoon'); pane.onBeforeRender();
assert.ok(s.wOut.value.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6 && s.sunDir.value.z < 0, 'the afternoon sun stands outside the window');

// ---- taking it away puts the pane back
view.dispose();
assert.ok(pane.material === painted && !view.group.parent && pane.renderOrder === 0 && !pane.userData.windowScenery, 'disposed: the pane has its own material again');
assert.throws(() => attachScenery(pane, 'moon-base', { width: 1, height: 1 }), /No window scenery/);
console.log('PASS window scenery: the view switch, the garden (depth, cost, outside the wall), the opening test, the sky on the pane, the hours, dispose');
