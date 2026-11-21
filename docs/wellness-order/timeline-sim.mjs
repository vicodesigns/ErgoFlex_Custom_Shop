// The desk user's simulated state over a wellness timeline (the same code the stage runs: room-people-motion.mjs
// simulateDesk, deskDescription; experience/desk-clips.mjs sampleClipMotion), for choosing the clip times.
//   node docs/wellness-order/timeline-sim.mjs <cut or export json> [sitHeights=28] [standHeights=41]
// Prints: the desk height, tau (0 seated .. 2.6 standing), k (hands on the keys 0..1), the chair's park fraction
// (room-people.mjs chairOf: smoothstep(tau, 1.75, 2.6)) every 0.25 s, and the moments each changes.
import fs from 'node:fs';
import { simulateDesk, deskDescription, STAND_UP } from '../../room-people-motion.mjs';
import { sampleClipMotion } from '../../experience/desk-clips.mjs';
const [file, sitArg = '28', standArg = '41'] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(file, 'utf8')), s = d.shots ? d.shots.find(x => x.id === 'wellness') || d.shots[0] : d;
const motion = { ...s.motion, initial: { x: 0, z: 0, yaw: 0, ...s.motion.initial } };
const desc = deskDescription(sitArg.split(',').map(Number), standArg.split(',').map(Number));
const heightAt = t => sampleClipMotion(motion, t).height;
const sim = simulateDesk(desc, heightAt, s.seconds, 60);
const ss = (x, a, b) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const row = t => { const st = sim.at(t); return { t: +t.toFixed(3), h: +heightAt(t).toFixed(2), tau: +st.tau.toFixed(3), k: +st.k.toFixed(3), park: +ss(st.tau, 1.75, 2.6).toFixed(3) }; };
console.log('desc', JSON.stringify(desc), 'seconds', s.seconds, 'clips', JSON.stringify(motion.clips.map(c => [c.id, c.start, c.duration, c.target])));
const events = []; let prev = row(0);
for (let i = 1; i <= s.seconds * 60; i++) {
    const r = row(i / 60);
    const cross = (f, v, name) => { if ((prev[f] < v) !== (r[f] < v)) events.push(`${r.t.toFixed(2)} s  ${name}${r[f] > prev[f] ? ' (up)' : ' (down)'}`); };
    cross('k', .999, 'hands fully on keys'); cross('k', .001, 'hands touching / leaving keys'); cross('tau', .001, 'tau leaves/reaches seated'); cross('tau', STAND_UP - .001, 'tau reaches/leaves standing');
    cross('park', .001, 'chair starts parking / is home'); cross('park', .999, 'chair parked / leaves park');
    const moving = Math.abs(r.h - prev.h) > 1e-4, was = events.movingWas; if (moving !== was) { events.push(`${r.t.toFixed(2)} s  desk ${moving ? 'starts moving' : 'stops'} at ${r.h} in`); events.movingWas = moving; }
    prev = r;
}
console.log(events.join('\n'));
if (process.argv.includes('--table')) for (let t = 0; t <= s.seconds + 1e-9; t += .25) console.log(JSON.stringify(row(t)));
