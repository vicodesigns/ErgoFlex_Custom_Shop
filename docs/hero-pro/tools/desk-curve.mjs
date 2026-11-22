// usage: node desk-curve.mjs <shot.json> <out.csv> [fps=30]
// The desk's height (in) and tilt (deg) over chapter time with the app's own clip evaluator (experience/desk-clips.mjs
// sampleClipMotion, what the render and the Director use), and their speeds (in/s, deg/s) and accelerations.
import fs from 'node:fs';
import { sampleClipMotion } from '../../../experience/desk-clips.mjs';
const [f, out, fpsS] = process.argv.slice(2), fps = Number(fpsS || 30);
let shot = JSON.parse(fs.readFileSync(f, 'utf8')); if (shot.shots) shot = shot.shots[0];
const T = shot.seconds, N = Math.round(T * fps), rows = [];
for (let n = 0; n <= N; n++) { const t = n / fps, p = sampleClipMotion(shot.motion, t); rows.push({ t, h: p.height, tilt: p.tilt }); }
for (let n = 1; n <= N; n++) { rows[n].vh = (rows[n].h - rows[n - 1].h) * fps; rows[n].vt = (rows[n].tilt - rows[n - 1].tilt) * fps; }
rows[0].vh = rows[0].vt = 0;
for (let n = 1; n <= N; n++) { rows[n].ah = (rows[n].vh - rows[n - 1].vh) * fps; rows[n].at = (rows[n].vt - rows[n - 1].vt) * fps; }
rows[0].ah = rows[0].at = 0;
fs.writeFileSync(out, 't,height,tilt,vh,vt,ah,at\n' + rows.map(r => [r.t.toFixed(4), r.h.toFixed(4), r.tilt.toFixed(4), r.vh.toFixed(4), r.vt.toFixed(4), r.ah.toFixed(3), r.at.toFixed(3)].join(',')).join('\n') + '\n');
const pk = k => rows.reduce((a, r) => Math.abs(r[k]) > Math.abs(a[k]) ? r : a);
const moving = rows.filter(r => Math.abs(r.vh) > 0.05 || Math.abs(r.vt) > 0.2).map(r => r.t);
console.log(JSON.stringify({ seconds: T, end: { height: rows.at(-1).h, tilt: rows.at(-1).tilt }, peakLift_inps: [+pk('vh').vh.toFixed(2), +pk('vh').t.toFixed(2)], peakTilt_degps: [+pk('vt').vt.toFixed(2), +pk('vt').t.toFixed(2)],
  peakLiftAccel: [+pk('ah').ah.toFixed(1), +pk('ah').t.toFixed(2)], peakTiltAccel: [+pk('at').at.toFixed(1), +pk('at').t.toFixed(2)], lastMovement_s: moving.length ? +moving.at(-1).toFixed(2) : null }));
