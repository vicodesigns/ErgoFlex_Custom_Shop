// usage: node mkcut.mjs <review-cut.json> <out.json> [patch.json (by-key)|-] [cam: "px,py,pz,tx,ty,tz,fov" | -]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [rc, out, pk, cam] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(rc, 'utf8')).shots.find(s => s.id === 'rise');
if (pk && pk !== '-') {
    const P = JSON.parse(fs.readFileSync(pk, 'utf8')); const cast = s.people.cast.find(c => c.key === 'maya-stand');
    for (const [post, keys] of Object.entries(P)) cast.postures[post].poseKeys = keys;
}
if (cam && cam !== '-') {
    const v = cam.split(',').map(Number);
    s.cameraPlan = { easeIn: false, easeOut: false, keys: [{ at: 0, position: v.slice(0, 3), target: v.slice(3, 6), fov: v[6] }, { at: s.seconds, position: v.slice(0, 3), target: v.slice(3, 6), fov: v[6] }] };
    fs.writeFileSync('C:/work/rise-pull/_plan.json', JSON.stringify({ seconds: s.seconds, cameraPlan: s.cameraPlan }));
    execFileSync('node', ['F:/eng-pull/tools/experience/camera-spline.mjs', 'C:/work/rise-pull/_plan.json']);
    s.camera = JSON.parse(fs.readFileSync('C:/work/rise-pull/_plan.json', 'utf8')).camera;
}
fs.writeFileSync(out, JSON.stringify({ name: 'x', shots: [s] }));
console.log('ok', s.seconds);
