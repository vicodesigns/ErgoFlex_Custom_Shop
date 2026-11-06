// Floor reflections per LED source (sceneGlobals.ledFloorSources): cleaning, defaults, the export -> import fields,
// and the bounce shader's two variants (the plain one is the approved look's text, unchanged). Node only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window = globalThis.window || {};
const { cleanFloorSources, floorSourceAt, FLOOR_SOURCES, FLOOR_SOURCE_FIELDS, cleanLighting, describeFloorSource } = await import('../experience/film-lighting.mjs');

assert.deepEqual(FLOOR_SOURCES.map(s => s[0]), ['foot', 'center', 'left', 'right']);
assert.deepEqual(Object.keys(FLOOR_SOURCE_FIELDS), ['on', 'x', 'z', 'spread', 'length', 'edge', 'brightness', 'saturation']);
// Defaults are dropped, ranges clamped, unknown sources / fields ignored, nothing left -> null.
assert.equal(cleanFloorSources({ foot: { on: true, x: 0, spread: 1 } }), null);
assert.deepEqual(cleanFloorSources({ foot: { x: 12.3456, spread: 9, junk: 1 }, center: { on: false }, attic: { x: 3 } }), { foot: { x: 12.346, spread: 4 }, center: { on: false } });
assert.deepEqual(floorSourceAt({ left: { z: -20 } }, 'left'), { on: true, x: 0, z: -20, spread: 1, length: 1, edge: 1, brightness: 1, saturation: 1 });
assert.deepEqual(floorSourceAt(null, 'foot').brightness, 1);
assert.deepEqual(cleanLighting({ sceneGlobals: { ledFloorSources: { right: { brightness: 2 } } } }).sceneGlobals, { ledFloorSources: { right: { brightness: 2 } } });
assert.equal(describeFloorSource({ on: false, x: 4 }), 'off');
assert.equal(describeFloorSource({ z: -12, length: 1.5 }), 'moved -12 cm front/back · length ×1.5');
// Export cut -> --import -> the film: the field rides with the other Room globals.
assert.match(fs.readFileSync(new URL('../tools/experience/build-round8-director.py', import.meta.url), 'utf8'), /GLOBAL_FIELDS = \([^)]*'ledFloorSources'\)/);
// The bounce shader: 'plain' (no ledFloorSources) keeps the approved text; 'param' adds the per-source controls.
const viewer = fs.readFileSync(new URL('../tools/experience/film-viewer-leds.mjs', import.meta.url), 'utf8');
assert.ok(viewer.includes("const fragment = (param) => samplingGLSL"), 'one shader text, two variants');
for (const bit of ['v.xz *= srcShape[', 'srcSat[', 'srcShape[${i}].y != 1.0']) assert.ok(viewer.includes(bit), bit);
const { hueText } = await import('../tools/experience/film-viewer-leds.mjs');
assert.equal(hueText(hueText('a\n#include <tonemapping_fragment>\n')), hueText('a\n#include <tonemapping_fragment>\n'), 'hue patch once');
// Render still / the film: the cut's field merges over the film shot's other globals.
const { filmRenderShot } = await import('../experience/film-render.mjs');
const film = { id: 'rise', room: 'home', kind: 'lift', seconds: 16, sceneGlobals: { roomLight: .55, ledRoomSpill: .15 } };
assert.deepEqual(filmRenderShot(film, { id: 'rise', room: 'home', kind: 'lift', seconds: 16, sceneGlobals: { ledFloorSources: { foot: { x: 10 } } } }, []).sceneGlobals,
  { roomLight: .55, ledRoomSpill: .15, ledFloorSources: { foot: { x: 10 } } });
console.log('cinematic-floor-sources-test ok');
