// add keys where the drawn wrist / hand strays most from the planned path, until it is within tolerance
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
import { THREE, filmFrames, shot } from './rigtools.mjs';
const base = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), maxKeys = +(process.argv[3] || 10), tolMm = +(process.argv[4] || 3);
let docksT = [...base.docksTimes], kaiT = [...base.kaiTimes];
for (let it = 0; it < 20; it++) {
  const P = { ...base, docksTimes: docksT, kaiTimes: kaiT, out: 'keys-g.json', grid: it === 0 ? 'targets.json' : undefined };
  fs.writeFileSync('plan-g.json', JSON.stringify(P)); execFileSync('node', ['design2.mjs', 'plan-g.json']);
  const T = JSON.parse(fs.readFileSync('targets.json', 'utf8')), K = JSON.parse(fs.readFileSync('keys-g.json', 'utf8'));
  const edit = f => { for (const e of f.cast) if (K[e.key]) { e.postures ||= {}; e.postures[K[e.key].id] = { ...(e.postures[K[e.key].id] || {}), poseKeys: K[e.key].poseKeys }; } return f; };
  const rows = await filmFrames({ shot, key: /^kai/, times: Object.keys(T).map(Number), edit });
  let worst = { e: 0 };
  for (const r of rows) { const tg = T[r.t.toFixed(4)]; let e = 0; for (const s of ['l', 'r']) { const b = r.bones['hand_' + s]; const d = new THREE.Vector3(...b.slice(0, 3)).distanceTo(new THREE.Vector3(...tg[s].w)) * 1000; const a = new THREE.Quaternion(...b.slice(3)).angleTo(new THREE.Quaternion(...tg[s].q)) * 180 / Math.PI; e = Math.max(e, d + a * 0.6); } if (e > worst.e) worst = { e, t: r.t }; }
  const n = docksT.length + kaiT.length;
  console.log('iter', it, 'keys', n, 'worst', worst.e.toFixed(2), 'at', worst.t?.toFixed(3), '| docks', docksT.join(' '), '| kai', kaiT.join(' '));
  if (worst.e < tolMm || n >= maxKeys) break;
  const t = Math.round(worst.t * 60) / 60, r3 = +t.toFixed(3);
  if ([...docksT, ...kaiT].some(x => Math.abs(x - r3) < .03)) { console.log('too near an existing key'); break; }
  if (r3 < base.swap) docksT = [...docksT, r3].sort((a, b) => a - b); else kaiT = [...kaiT, r3].sort((a, b) => a - b);
}
fs.copyFileSync('keys-g.json', 'keys-greedy.json');
