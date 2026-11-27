import fs from 'node:fs';
import { filmFrames, shot } from './rigtools.mjs';
const [kf, t0, t1, fps] = [process.argv[2], +process.argv[3], +process.argv[4], +(process.argv[5] || 60)];
const K = kf ? JSON.parse(fs.readFileSync(kf, 'utf8')) : null;
const edit = f => { if (K) for (const e of f.cast) if (K[e.key]) { e.postures ||= {}; e.postures[K[e.key].id] = { ...(e.postures[K[e.key].id] || {}), poseKeys: K[e.key].poseKeys }; } return f; };
const times = []; for (let f = Math.round(t0 * fps); f <= Math.round(t1 * fps); f++) times.push(f / fps);
const rows = await filmFrames({ shot, key: /^kai/, times, edit });
const mm = a => a.slice(0, 3).map(v => (v * 1000).toFixed(0).padStart(4)).join(',');
for (const r of rows) { const b = r.bones, m3 = b.middle_03_l, m2 = b.middle_02_l; console.log(r.t.toFixed(3), r.shown[0].split(':')[0].padEnd(9), 'Lwr', mm(b.hand_l), 'Ltip', mm([0, 1, 2].map(i => 2 * m3[i] - m2[i])), 'Lelb', mm(b.lowerarm_l), '| Rwr', mm(b.hand_r), 'Relb', mm(b.lowerarm_r)); }
