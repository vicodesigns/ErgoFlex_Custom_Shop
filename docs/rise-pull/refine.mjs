// local refinement of a parameter vector: node refine.mjs "<json params>" iterations seed [posture]
import { evaluate } from './solve-pull.mjs';
const p0 = JSON.parse(process.argv[2]), ITER = +process.argv[3] || 800, POST = process.env.POSTURE || 'people-maya-sit-type';
let rs = (+process.argv[4] || 1) * 7919 + 13; const rnd = () => (rs = (rs * 9301 + 49297) % 233280) / 233280, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd());
let p = p0.slice(), c = evaluate(p, POST), step = 5;
for (let it = 0; it < ITER; it++) { const q = p.map(v => v + gauss() * step * (rnd() < 0.35 ? 1 : 0)); const cq = evaluate(q, POST); if (cq < c) { p = q; c = cq; } if (it % 300 === 299) step = Math.max(0.8, step * 0.6); }
const d = evaluate(p, POST, true); delete d.deltas; console.log(JSON.stringify(d)); console.log('BEST', JSON.stringify(p.map(v => Math.round(v * 10) / 10)));
