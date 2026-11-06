// HQ37: the phone on the desk's charger opening chapter 2 (rise). Static checks: the chapter override adds the phone and
// its screen next to the film's own props and monitor clips (build-round8-cameras.py accessoriesAdd / screensAdd, re-runs
// safe), the clip is in the manifest with its scene loaded by the capture page, and film-fx knows the phone's glass.
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {execFileSync} from 'child_process';
import {fileURLToPath} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXP = path.join(ROOT, 'tools/experience');

// 1. The override: absolute, appended, idempotent.
const rise = JSON.parse(fs.readFileSync(path.join(EXP, 'film-cameras/rise.json'), 'utf8'));
const phone = rise.accessoriesAdd.find(a => a.id === 'ergoflex-phone');
assert(phone, 'rise adds the phone');
for (const k of ['x', 'y', 'z', 'rotation', 'scale']) assert(Number.isFinite(phone[k]), 'phone ' + k);
assert.equal(phone.scale, 100, 'the phone at its real size');
const screen = rise.screensAdd.find(s => s.target === 'phone');
assert(screen && /screens\/02-phone\.mp4$/.test(screen.src) && screen.blend === 'add' && screen.loop === false, 'the phone screen clip');
assert(screen.brightness.every(([t, v], i, a) => Number.isFinite(t) && v > 0 && (!i || t > a[i - 1][0])), 'the phone stays lit, keys in order');

// The builder's own apply() on a rise-like shot, twice (python: the override file as Vico's build runs it).
const PY = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('cams', sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
o, shot = json.load(open(sys.argv[2])), json.loads(sys.argv[3])
once = m.apply(json.loads(json.dumps(shot)), o); twice = m.apply(json.loads(json.dumps(once)), o)
print(json.dumps([once, twice]))`;
const shot = {id: 'rise', seconds: 16, accessories: {add: [{id: 'ergoflex-thermal-cup', x: -255, z: 115}]},
  screens: [{target: 'main-landscape', src: 'a.mp4'}, {target: 'main-portrait', src: 'b.mp4'}], sceneEdits: [{match: 'x', hide: true, director: true}]};
const [once, twice] = JSON.parse(execFileSync('python3', ['-c', PY, path.join(EXP, 'build-round8-cameras.py'), path.join(EXP, 'film-cameras/rise.json'), JSON.stringify(shot)], {encoding: 'utf8'}));
assert.deepEqual(once.accessories.add.map(a => a.id), ['ergoflex-thermal-cup', 'ergoflex-phone'], 'the cup stays, the phone joins');
assert.deepEqual(once.screens.map(s => s.target), ['main-landscape', 'main-portrait', 'phone'], 'monitor clips stay, the phone joins');
assert.deepEqual(twice.accessories, once.accessories, 're-runs do not duplicate the phone');
assert.deepEqual(twice.screens, once.screens, 're-runs do not duplicate its screen');
assert.deepEqual(once.sceneEdits, shot.sceneEdits, 'the film and Director prop edits are untouched');
assert(once.camera?.keys?.length, 'the chapter camera still bakes');

// 2. The clip: manifest entry, scene file registered on the capture page, portrait at the glass's aspect.
const {CLIPS} = await import(path.join(EXP, 'screens/clips.mjs'));
const clip = CLIPS.find(c => c.id === '02-phone');
assert(clip && clip.target === 'phone' && clip.chapter === 2, 'clip 02-phone');
assert(clip.h > clip.w && Math.abs(clip.w / clip.h - .475) < .01, 'portrait, the phone glass aspect (.475)');
const page = fs.readFileSync(path.join(EXP, 'screens/page.html'), 'utf8');
assert(page.includes('scenes/ch02ph.js'), 'capture page loads the phone scene');
const scene = fs.readFileSync(path.join(EXP, 'screens/scenes/ch02ph.js'), 'utf8');
assert(/SCENES\.ch02ph\s*=/.test(scene), 'scene ch02ph defined');
assert(!/Date\.now|Math\.random|performance\.now/.test(scene), 'the scene is a pure function of t');

// 3. film-fx: the phone's glass target and the additive screen blend.
const fx = fs.readFileSync(path.join(EXP, 'film-fx.mjs'), 'utf8');
assert(/'ergoflex-phone':\s*\{[^}]*alias:\s*'phone'/.test(fx), 'PROP_SCREENS phone');
assert(/spec\.blend === 'add'/.test(fx), 'screens blend add');
console.log('Phone on the charger (rise): override appended and idempotent, clip 02-phone registered, film-fx phone glass + additive screen passed.');
