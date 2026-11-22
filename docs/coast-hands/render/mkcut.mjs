// A one-chapter render cut of coast from a review-cut.json, for render-cut.cjs / probe-bones.cjs.
//   node mkcut.mjs <review-cut.json> <out.json> [cam "px,py,pz,tx,ty,tz,fov" | -] [range "t0,t1" | -] [people.json | -]
// cam: a fixed review camera for the whole chapter (re-baked with camera-spline.mjs); range: shot.renderRange (chapter
// seconds); people.json: a replacement for shot.people (the fix under test).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [rc, out, cam, range, people] = process.argv.slice(2);
const REPO = 'F:/eng-coast';
const s = JSON.parse(fs.readFileSync(rc, 'utf8')).shots.find(x => x.id === 'coast');
if (cam && cam !== '-') {
    const v = cam.split(',').map(Number), tmp = out + '.plan.json';
    s.cameraPlan = { easeIn: false, easeOut: false, keys: [{ at: 0, position: v.slice(0, 3), target: v.slice(3, 6), fov: v[6] }, { at: s.seconds, position: v.slice(0, 3), target: v.slice(3, 6), fov: v[6] }] };
    fs.writeFileSync(tmp, JSON.stringify({ seconds: s.seconds, cameraPlan: s.cameraPlan }));
    execFileSync('node', [REPO + '/tools/experience/camera-spline.mjs', tmp]);
    s.camera = JSON.parse(fs.readFileSync(tmp, 'utf8')).camera; fs.unlinkSync(tmp);
}
if (range && range !== '-') s.renderRange = range.split(',').map(Number);
if (people && people !== '-') s.people = JSON.parse(fs.readFileSync(people, 'utf8'));
fs.writeFileSync(out, JSON.stringify({ name: 'coast2', shots: [s] }));
console.log('ok', out, s.seconds, s.renderRange || '');
