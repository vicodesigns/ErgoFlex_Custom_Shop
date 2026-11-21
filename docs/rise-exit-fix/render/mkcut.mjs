// A one-chapter render cut of rise from a review-cut.json, for render-cut.cjs / render-still.cjs.
//   node docs/rise-exit-fix/render/mkcut.mjs <review-cut.json> <out.json> [cam "px,py,pz,tx,ty,tz,fov" | -] [range "t0,t1" | -]
// cam: a fixed review camera for the whole chapter (re-baked with camera-spline.mjs); range: shot.renderRange (chapter seconds).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [rc, out, cam, range] = process.argv.slice(2);
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const s = JSON.parse(fs.readFileSync(rc, 'utf8')).shots.find(x => x.id === 'rise');
if (cam && cam !== '-') {
    const v = cam.split(',').map(Number), tmp = out + '.plan.json';
    s.cameraPlan = { easeIn: false, easeOut: false, keys: [{ at: 0, position: v.slice(0, 3), target: v.slice(3, 6), fov: v[6] }, { at: s.seconds, position: v.slice(0, 3), target: v.slice(3, 6), fov: v[6] }] };
    fs.writeFileSync(tmp, JSON.stringify({ seconds: s.seconds, cameraPlan: s.cameraPlan }));
    execFileSync('node', [path.join(REPO, 'tools/experience/camera-spline.mjs'), tmp]);
    s.camera = JSON.parse(fs.readFileSync(tmp, 'utf8')).camera; fs.unlinkSync(tmp);
}
if (range && range !== '-') s.renderRange = range.split(',').map(Number);
fs.writeFileSync(out, JSON.stringify({ name: 'rise3', shots: [s] }));
console.log('ok', out, s.seconds, s.renderRange || '');
