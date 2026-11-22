// Keyed ledFloorSources fields (foot / centre / wing brightness, spread, saturation as [[seconds, value], ...]): opt-in.
// Plain numbers behave exactly as before (cleaning, resolving), keyed ones clean, sort, clamp and interpolate. Node only.
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
const { cleanFloorSources, describeFloorSource, cleanLighting } = await import('../experience/film-lighting.mjs');
const { resolveFloorFields } = await import('../tools/experience/film-viewer-leds.mjs');
// Default = identical: numeric data cleans and resolves to what it did before (same object, same numbers).
const plain = { foot: { x: 12.3456, spread: 9, brightness: 2 }, center: { on: false } };
assert.deepEqual(cleanFloorSources(plain), { foot: { x: 12.346, spread: 4, brightness: 2 }, center: { on: false } });
assert.deepEqual(resolveFloorFields({ on: true, x: 3, brightness: 2, saturation: 1 }, 7), { on: true, x: 3, brightness: 2, saturation: 1 });
assert.deepEqual(resolveFloorFields(undefined, 7), {});
assert.equal(cleanFloorSources({ foot: { brightness: 1 } }), null);
// Keyed: sorted, clamped to the field's range, rounded; all-default keys are dropped.
const k = cleanFloorSources({ foot: { brightness: [[9.5, 1], [7.5, 1], [8.5, 9]], saturation: [[0, 1], [5, 1]], x: [[0, 5]] } });
assert.deepEqual(k, { foot: { brightness: [[7.5, 1], [8.5, 4], [9.5, 1]] } });
assert.equal(cleanFloorSources({ foot: { brightness: [[0, 1], [3, 1]] } }), null);
assert.deepEqual(cleanLighting({ sceneGlobals: { ledFloorSources: { foot: { saturation: [[7, 1], [8.5, 2]] } } } }).sceneGlobals, { ledFloorSources: { foot: { saturation: [[7, 1], [8.5, 2]] } } });
assert.equal(describeFloorSource({ saturation: [[7, 1], [8.5, 2]] }), 'saturation keyed (2)');
// Resolved in time: held before the first and after the last key, linear between; unkeyed fields untouched.
const f = { brightness: [[7.5, 1], [8.5, 3], [9.5, 1]], x: 4 };
assert.deepEqual([6, 7.5, 8, 8.5, 9, 9.5, 12].map(s => resolveFloorFields(f, s).brightness), [1, 1, 2, 3, 2, 1, 1]);
assert.equal(resolveFloorFields(f, 8).x, 4);
// Edge softness keys too; the foot tint (hex + amount, amount keyable) is cleaned and optional.
assert.deepEqual(cleanFloorSources({ foot: { edge: [[7.5, 1], [8.5, 1.5]] } }), { foot: { edge: [[7.5, 1], [8.5, 1.5]] } });
assert.deepEqual(cleanFloorSources({ foot: { tint: '#2F6BFF', tintAmount: [[9.5, 0], [8, .8], [7.5, 0]] } }), { foot: { tint: '#2f6bff', tintAmount: [[7.5, 0], [8, .8], [9.5, 0]] } });
assert.deepEqual(cleanFloorSources({ foot: { tint: '#2f6bff', tintAmount: 2 } }), { foot: { tint: '#2f6bff', tintAmount: 1 } });
assert.equal(cleanFloorSources({ foot: { tint: '#2f6bff' } }), null, 'a tint without an amount is the film look');
assert.equal(cleanFloorSources({ foot: { tint: 'blue', tintAmount: .5 } }), null);
assert.equal(describeFloorSource({ tint: '#2f6bff', tintAmount: .5 }), 'tint #2f6bff ×0.5');
console.log('cinematic-floor-keyed-test ok');
