// The daylight a window lays on the floor (room-window-sun.mjs): there by day, gone after dark, inside the room, slanting
// with the sun, mirrored for a window in the other wall.   node tests/room-window-sun-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
const ctx = new Proxy({}, { get: (t, k) => k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : typeof k === 'string' && /^(fillRect)$/.test(k) ? () => {} : t[k], set: (t, k, v) => { t[k] = v; return true; } });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const { windowSun, WINDOW_SUN } = await import('../room-window-sun.mjs');
const root = new THREE.Group(), w = 5800, sun = windowSun(root, { x: -w / 2, from: 0, to: 3000, panes: 3, span: w });
const box = () => { sun.mesh.geometry.computeBoundingBox(); return sun.mesh.geometry.boundingBox; };
const zAt = far => { const p = sun.mesh.geometry.attributes.position, uv = sun.mesh.geometry.attributes.uv; let n = 0, z = 0; for (let i = 0; i < p.count; i++) if ((uv.getY(i) > .5) === far) { z += p.getZ(i); n++; } return z / n; };
for (const hour of ['morning', 'afternoon', 'evening']) {
    sun.set(hour); const b = box();
    assert.ok(sun.mesh.visible && sun.mesh.material.color.r > 0, hour + ': the window lights the floor');
    assert.ok(b.min.x > -w / 2 + 100 && b.max.x < w / 2 - 399, hour + ': inside the room, short of the far wall');
    assert.ok(Math.abs(b.min.y - 14) < 1e-6 && Math.abs(b.max.y - 14) < 1e-6, hour + ': flat on the floor');
}
sun.set('morning'); assert.ok(zAt(true) < zAt(false) - 300, 'the morning sun slants it towards the back of the room');
sun.set('evening'); assert.ok(zAt(true) > zAt(false) + 300, 'the evening sun towards the front');
const evening = box().max.x - box().min.x; sun.set('morning'); const morning = box().max.x - box().min.x; sun.set('afternoon'); const midday = box().max.x - box().min.x;
assert.ok(midday < morning && midday < evening, 'short at midday, long in the morning and the evening');
for (const hour of ['night', 'party']) { sun.set(hour); assert.ok(!sun.mesh.visible, hour + ': no daylight on the floor'); }
sun.set('evening', .5); const half = sun.mesh.material.color.r; sun.set('evening', 1); assert.ok(Math.abs(sun.mesh.material.color.r - half * 2) < 1e-6, 'it dims with the room (accent)');
// a narrow room cuts the reach short; a room too narrow has no patch
const narrow = windowSun(root, { x: -1500, from: 0, to: 1400, span: 3000 }); narrow.set('evening'); narrow.mesh.geometry.computeBoundingBox();
assert.ok(narrow.mesh.visible && narrow.mesh.geometry.boundingBox.max.x <= 1500 - 400 + 1e-6, 'a narrow room: the evening light stops short of the far wall');
const closet = windowSun(root, { x: -900, from: 0, to: 1000, span: 1800 }); closet.set('evening'); assert.ok(!closet.mesh.visible, 'no room for a patch: none');
// a window in the right-hand wall: the same light, mirrored
const right = windowSun(root, { x: w / 2, inward: -1, from: 0, to: 3000, span: w }); right.set('morning'); right.mesh.geometry.computeBoundingBox();
assert.ok(right.mesh.geometry.boundingBox.max.x < w / 2 - 100 && right.mesh.geometry.boundingBox.min.x > -w / 2 + 399, 'a right-hand window lights the floor to its left');
const zOf = (patch, far) => { const p = patch.mesh.geometry.attributes.position, uv = patch.mesh.geometry.attributes.uv; let n = 0, z = 0; for (let i = 0; i < p.count; i++) if ((uv.getY(i) > .5) === far) { z += p.getZ(i); n++; } return z / n; };
assert.ok(zOf(right, true) > zOf(right, false) + 300, 'and its slant is the mirror image: the same morning sun falls towards the front from a window in the other wall');
right.set('evening'); assert.ok(zOf(right, true) < zOf(right, false) - 300, 'the evening sun towards the back');
// a room's own hours (a daytime party)
const weekend = windowSun(root, { x: -w / 2, from: 0, to: 3000, span: w, hours: { ...WINDOW_SUN, party: WINDOW_SUN.morning } }); weekend.set('party'); assert.ok(weekend.mesh.visible, 'a room can give its own hours');
console.log('PASS window sun: by day and not by night, inside the room, slant, reach, accent, mirrored, a room\'s own hours.');
