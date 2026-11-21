// usage: node mkafter.mjs <base cut json (create shot)> <plan.json from design.mjs> <out cut json>
// the base chapter with the plan's cameraPlan, camera baked by the repo's camera-spline.mjs (what build-round8-director.py's pass does)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SPLINE = fileURLToPath(new URL('../../../tools/experience/camera-spline.mjs', import.meta.url));      // the repo's own bake
const [baseF, planF, outF] = process.argv.slice(2);
const cut = JSON.parse(fs.readFileSync(baseF, 'utf8')), s = cut.shots.find(x => x.id === 'create');
const plan = JSON.parse(fs.readFileSync(planF, 'utf8'));
s.cameraPlan = { ...s.cameraPlan, keys: plan.cameraPlan.keys };
const tmp = path.join(os.tmpdir(), 'fixB-m-' + process.pid + '.json');
fs.writeFileSync(tmp, JSON.stringify({ seconds: s.seconds, cameraPlan: s.cameraPlan }));
execFileSync('node', [SPLINE, tmp], { stdio: 'ignore' });
s.camera = JSON.parse(fs.readFileSync(tmp, 'utf8')).camera; fs.unlinkSync(tmp);
fs.writeFileSync(outF, JSON.stringify({ name: 'create', shots: [s] }));
console.log('ok', s.seconds, 'story keys', s.cameraPlan.keys.length, 'baked', s.camera.keys.length);
