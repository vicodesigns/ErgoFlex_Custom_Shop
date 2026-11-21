// usage: node mkclipcut.mjs <review-cut.json> <out.json> <patch.json|-> <camkeys.json|->   camkeys: [{at, position, target, fov}] replaces the plan keys from the first key on (earlier plan keys kept)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [rc, out, pk, camf] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(rc, 'utf8')).shots.find(s => s.id === 'rise');
if (pk && pk !== '-') { const P = JSON.parse(fs.readFileSync(pk, 'utf8')); const cast = s.people.cast.find(c => c.key === 'maya-stand'); for (const [post, keys] of Object.entries(P)) cast.postures[post].poseKeys = keys; }
if (camf && camf !== '-') {
    const ck = JSON.parse(fs.readFileSync(camf, 'utf8')), first = ck[0].at;
    const keep = s.cameraPlan.keys.filter(k => k.at < first - 0.3), tail = s.cameraPlan.keys.filter(k => k.at > ck[ck.length - 1].at + 0.3);
    s.cameraPlan.keys = [...keep, ...ck, ...tail];
    fs.writeFileSync('C:/work/rise-pull/_plan2.json', JSON.stringify({ seconds: s.seconds, cameraPlan: s.cameraPlan }));
    execFileSync('node', ['F:/eng-pull/tools/experience/camera-spline.mjs', 'C:/work/rise-pull/_plan2.json']);
    s.camera = JSON.parse(fs.readFileSync('C:/work/rise-pull/_plan2.json', 'utf8')).camera;
}
fs.writeFileSync(out, JSON.stringify({ name: 'x', shots: [s] }));
console.log('ok', s.seconds, s.cameraPlan.keys.map(k => k.at).join(' '));
