// The screen light (experience/screen-light.mjs, film-fx.mjs; 21 Nov 2026, docs/screen-reflection/CONTRACT.md), without a
// browser: the media chapters' screen-coloured LED light on the desk, floor and walls.
//   1. the fields: defaults are today's; the cleaner keeps only what differs, clamped; {} = today's; null = not an object
//   2. today's: no transform at all (film-fx keeps its old arithmetic: same pixels)
//   3. the maths: gain scales, saturation 0 is white light at the same luminance, >1 richer; contrast is a power around
//      .18; tint keeps luminance; keepHue keeps the colour where the gain clips (today's per-channel clip whitens it)
//   4. film-fx and the Director data path: the sampled pixels go through it only when the chapter has one, a Director edit
//      updates it in place, cleanLighting carries it (and {} for a reset), the importer has it in GLOBAL_FIELDS
//   node tests/screen-light-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELDS, KEYS, cleanScreenLight, isToday, lightFor, screenLightTransform, applyPixel, applyHex} from '../experience/screen-light.mjs';

// 1
assert.deepEqual(lightFor(undefined), {gain: 1, saturation: 1, contrast: 1, tint: '#ffffff', keepHue: false});
assert.deepEqual(cleanScreenLight({gain: 1, saturation: 1, contrast: 1, tint: '#FFFFFF', keepHue: false}), {});
assert.deepEqual(cleanScreenLight({gain: 9, saturation: -2, contrast: .1, tint: '#FFAA00', keepHue: true, other: 3}), {gain: 3, saturation: 0, contrast: .5, tint: '#ffaa00', keepHue: true});
assert.deepEqual(cleanScreenLight({gain: '0.5', tint: 'red', keepHue: 1}), {});
assert.equal(cleanScreenLight(null), null); assert.equal(cleanScreenLight([]), null);
assert.ok(KEYS.every(k => 'def' in FIELDS[k]));
// 2
for (const v of [undefined, null, {}, {gain: 1}, {tint: '#ffffff'}]) { assert.ok(isToday(v)); assert.equal(screenLightTransform(v), null); }
// 3
const px = (light, rgb, ledGain = 1) => { const t = screenLightTransform(light), dst = new Float32Array(4); applyPixel(t, Uint8Array.from([...rgb, 0]), dst, 0, ledGain); return [...dst.slice(0, 3)].map(Math.round); };
assert.deepEqual(px({gain: .5}, [200, 100, 40]), [100, 50, 20]);
const grey = px({saturation: 0}, [200, 100, 40]), y = .2126 * 200 + .7152 * 100 + .0722 * 40;
assert.ok(grey.every(c => Math.abs(c - y) <= 1), 'saturation 0: white light at the same luminance ' + grey);
const rich = px({saturation: 1.5}, [200, 100, 40]); assert.ok(rich[0] > 200 && rich[2] < 40);
assert.deepEqual(px({contrast: 2}, [46, 46, 46]), [46, 46, 46], '.18 linear is the pivot');
assert.ok(px({contrast: 2}, [20, 20, 20])[0] < 20 && px({contrast: 2}, [120, 120, 120])[0] > 120);
const tinted = px({tint: '#ffd0a0'}, [100, 100, 100]); assert.ok(tinted[0] > 100 && tinted[2] < 100 && Math.abs(.2126 * tinted[0] + .7152 * tinted[1] + .0722 * tinted[2] - 100) < 1.5);
// The washed-out case: an orange sample at ch 10's ledGain 3.15. Today's per-channel clip: green rises toward red.
const orange = [200, 80, 20], today = orange.map(c => Math.min(255, c * 3.15));
const keep = px({keepHue: true, gain: 1.0001}, orange, 3.15);
assert.ok(today[1] / today[0] > .95 && keep[1] / keep[0] < .45, 'keepHue keeps the ratio ' + today + ' / ' + keep);
assert.equal(applyHex(screenLightTransform({gain: 1, saturation: 0.5}), '#ffffff'), '#ffffff');
assert.equal(applyHex(screenLightTransform({gain: .5}), '#808080').length, 7);
// 4
const fx = readFileSync(new URL('../tools/experience/film-fx.mjs', import.meta.url), 'utf8');
assert.match(fx, /screenLightTransform\(shot\.sceneGlobals\?\.screenLight\)/);
assert.match(fx, /if \(!led\.light\)[^\n]*Math\.min\(255, led\.target\[j\]\[i\] \* gain\)/, "today's arithmetic kept as it was");
assert.match(fx, /gChanged\('screenLight'\)/);
const {cleanLighting} = await import('../experience/film-lighting.mjs');
assert.deepEqual(cleanLighting({sceneGlobals: {screenLight: {gain: .7, saturation: 1.3, contrast: 1}}}).sceneGlobals, {screenLight: {gain: .7, saturation: 1.3}});
assert.deepEqual(cleanLighting({sceneGlobals: {screenLight: {}}}).sceneGlobals, {screenLight: {}}, 'a reset is carried');
assert.equal(cleanLighting({sceneGlobals: {}}).sceneGlobals, undefined);
assert.match(readFileSync(new URL('../tools/experience/build-round8-director.py', import.meta.url), 'utf8'), /GLOBAL_FIELDS = \([^)]*'screenLight'\)/);
console.log('screen-light-test: ok');
