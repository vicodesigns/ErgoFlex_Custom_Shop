// usage: node verify-import.mjs <plan.json> <base cut dir> <imported cut dir>
// After build-round8-director.py --import <doc> and the pass ran on a scratch copy: shows that the imported data equals the patch.
//  1. director-camera-create.json keys == the plan's keys (every number, cut flags, labels)
//  2. review-cut.json create.cameraPlan.keys == the plan's keys, and create.camera == an independent bake of the plan (repo camera-spline.mjs)
//  3. nothing else moved: every other field of the create shot, every other shot, titles-src.json, the other director-camera files
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SPLINE = fileURLToPath(new URL('../../../tools/experience/camera-spline.mjs', import.meta.url));      // the repo's own bake
const [planF, baseD, impD] = process.argv.slice(2);
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const plan = rd(planF), want = [...plan.cameraPlan.keys].sort((a, b) => a.at - b.at);
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keyEq = (a, b) => a.length === b.length && a.every((k, i) => Math.abs(k.at - b[i].at) < 1e-9 && same(k.position, b[i].position) && same(k.target, b[i].target) && k.fov === b[i].fov && (k.label || '') === (b[i].label || '') && !!k.cut === !!b[i].cut && same(k.transition, b[i].transition) && k.hold === b[i].hold);
// 1
const dc = rd(path.join(impD, 'director-camera-create.json')), dc0 = rd(path.join(baseD, 'director-camera-create.json'));
ok(keyEq(dc.keys, want), `director-camera-create.json: ${dc.keys.length} keys equal the patch's ${want.length} keys`);
ok(dc.seconds === plan.seconds, `director-camera-create.json seconds ${dc.seconds}`);
for (const k of Object.keys({ ...dc, ...dc0 })) if (!['keys', 'source'].includes(k)) ok(same(dc[k], dc0[k]), `director-camera-create.json .${k} unchanged`);
// 2
const cut = rd(path.join(impD, 'review-cut.json')), cut0 = rd(path.join(baseD, 'review-cut.json'));
const s = cut.shots.find(x => x.id === 'create'), s0 = cut0.shots.find(x => x.id === 'create');
ok(keyEq(s.cameraPlan.keys, want), 'review-cut.json create.cameraPlan.keys equal the patch');
const tmp = path.join(os.tmpdir(), 'fixB-v-' + process.pid + '.json');
fs.writeFileSync(tmp, JSON.stringify({ seconds: s0.seconds, cameraPlan: { ...s0.cameraPlan, keys: want } }));
execFileSync('node', [SPLINE, tmp], { stdio: 'ignore' });
const baked = rd(tmp).camera; fs.unlinkSync(tmp);
ok(same(s.camera, baked), `review-cut.json create.camera (${s.camera.keys.length} baked keys) equals an independent bake of the patch`);
// 3
for (const k of Object.keys({ ...s, ...s0 })) if (!['camera', 'cameraPlan', 'directorEdited'].includes(k)) ok(same(s[k], s0[k]), `create.${k} unchanged`);
ok(same({ ...s.cameraPlan, keys: 0 }, { ...s0.cameraPlan, keys: 0 }), 'create.cameraPlan other fields (easeIn / easeOut) unchanged: ' + JSON.stringify({ ...s.cameraPlan, keys: undefined }));
console.log('     create.directorEdited: ' + JSON.stringify(s0.directorEdited) + ' -> ' + JSON.stringify(s.directorEdited));
ok(cut.shots.length === cut0.shots.length && cut.shots.every((x, i) => x.id === 'create' || same(x, cut0.shots[i])), 'review-cut.json: the other ' + (cut.shots.length - 1) + ' chapters unchanged');
for (const f of fs.readdirSync(baseD)) {
  if (!f.endsWith('.json') || ['review-cut.json', 'director-camera-create.json'].includes(f)) continue;
  ok(fs.existsSync(path.join(impD, f)) && fs.readFileSync(path.join(baseD, f)).equals(fs.readFileSync(path.join(impD, f))), f + ' byte-identical');
}
const extra = fs.readdirSync(impD).filter(f => !fs.existsSync(path.join(baseD, f)));
console.log('     new files in the imported dir: ' + (extra.join(', ') || 'none'));
console.log(bad ? `${bad} FAILED` : 'ALL OK');
process.exit(bad ? 1 : 0);
