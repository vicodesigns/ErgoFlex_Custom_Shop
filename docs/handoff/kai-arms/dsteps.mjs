import fs from 'node:fs';
import { THREE, filmFrames, shot } from './rigtools.mjs';
const K = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), fps = +(process.argv[3] || 60);
const edit = f => { for (const e of f.cast) if (K[e.key]) { e.postures ||= {}; e.postures[K[e.key].id] = { ...(e.postures[K[e.key].id] || {}), poseKeys: K[e.key].poseKeys }; } return f; };
const times = []; for (let f = Math.round(12.3 * fps); f <= Math.round(13.6 * fps); f++) times.push(f / fps);
const rows = await filmFrames({ shot, key: /^kai/, times, edit });
const pts = r => ['l', 'r'].flatMap(s => { const b = r.bones, v = n => new THREE.Vector3(...b[n].slice(0, 3)); const m3 = v('middle_03_' + s), m2 = v('middle_02_' + s); return [v('hand_' + s), m3.clone().multiplyScalar(2).sub(m2), v('lowerarm_' + s)]; });
const P = rows.map(pts); const line = [];
for (let i = 2; i < P.length; i++) { let w = 0; for (let j = 0; j < P[i].length; j++) { const a = P[i][j].clone().sub(P[i - 1][j]), b = P[i - 1][j].clone().sub(P[i - 2][j]); w = Math.max(w, a.sub(b).length() * 1000); } line.push([rows[i - 1].t, w]); }
console.log(line.filter(([, w]) => w > 2).map(([t, w]) => t.toFixed(3) + ':' + w.toFixed(1)).join(' '));
