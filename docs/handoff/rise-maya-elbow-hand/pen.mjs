// node pen.mjs dump.json [every] [out.json]: per frame, each hand's skinned vertices (+ finger joints) vs the rest of Maya's
// skinned skin (all triangles not on that hand / its forearm), signed depth by the nearest triangle (LBS, as drawn).
import fs from 'node:fs';
import { loadModel, skinMats, skinVerts, targetTris, signedDist, HANDRE } from './lib.mjs';
const [file, everyA = '24', outF] = process.argv.slice(2), every = +everyA;
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const model = await loadModel('people-maya-sit-type');
const res = [];
const FJ = /^(thumb|index|middle|ring|pinky)_0[123]_([lr])$/;
for (const r of d.rows) {
  if (!r.bones) continue;
  const S = skinMats(model, r.bones), X = skinVerts(model, S), row = { t: r.t };
  for (const s of ['l', 'r']) {
    const re = HANDRE(s), probes = [];
    model.dom.forEach((b, i) => { if (re.test(b)) probes.push([X[i * 6], X[i * 6 + 1], X[i * 6 + 2], b]); });
    for (const n of Object.keys(r.bones)) { const m = FJ.exec(n); if (m && m[2] === s) probes.push([...r.bones[n].slice(0, 3), 'J:' + n]); }
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of probes) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[c]); hi[c] = Math.max(hi[c], p[c]); }
    const tg = targetTris(model, X, v => !re.test(model.dom[v]) && model.dom[v] !== 'lowerarm_' + s, lo, hi);
    let worst = { d: 0 }, worstJ = { d: 0 }, n2 = 0, near = 1e9;
    for (const p of probes) { const q = signedDist(tg, p); if (!q) continue; if (q.d > 0) near = Math.min(near, q.d);
      const dep = -q.d; if (p[3].startsWith('J:')) { if (dep > worstJ.d) worstJ = { d: dep, b: p[3], into: q.dom }; } else { if (dep > .002) n2++; if (dep > worst.d) worst = { d: dep, b: p[3], into: q.dom, mat: q.mat }; } }
    row[s] = { skin: worst, joint: worstJ, n2, near };
  }
  res.push(row);
}
const f = x => (x * 1000).toFixed(1);
for (const s of ['l', 'r']) { let w = { d: 0 }, wj = { d: 0 }, fr = 0; for (const r of res) { if (r[s].skin.d > w.d) w = { ...r[s].skin, t: r.t }; if (r[s].joint.d > wj.d) wj = { ...r[s].joint, t: r.t }; if (r[s].skin.d > .002) fr++; }
  console.log(`hand_${s}: skin worst ${f(w.d)} mm (${w.b} into ${w.into} ${w.mat}) @${w.t?.toFixed(3)}; joints worst ${f(wj.d)} mm (${wj.b} into ${wj.into}) @${wj.t?.toFixed(3)}; frames skin>2mm ${fr}/${res.length}`); }
for (const r of res.filter((_, i) => i % every === 0)) console.log(r.t.toFixed(3), ['l', 'r'].map(s => `${s}: ${f(r[s].skin.d)} ${r[s].skin.b || ''}>${r[s].skin.into || ''} n${r[s].n2} c${f(r[s].near)} J${f(r[s].joint.d)}`).join(' | '));
if (outF) fs.writeFileSync(outF, JSON.stringify(res));
