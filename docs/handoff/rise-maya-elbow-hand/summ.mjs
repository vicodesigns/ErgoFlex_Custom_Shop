import fs from 'node:fs';
const [f, t0 = '14', t1 = '23.3'] = process.argv.slice(2); const R = JSON.parse(fs.readFileSync(f, 'utf8')).filter(r => r.t >= +t0 - 1e-9 && r.t <= +t1 + 1e-9);
for (const s of ['l', 'r']) { let w = { d: 0 }, wj = { d: 0 }; const bad = [];
  for (const r of R) { const x = r[s]; if (x.skin.d > w.d) w = { ...x.skin, t: r.t }; if (x.joint.d > wj.d) wj = { ...x.joint, t: r.t }; if (x.skin.d > .002) bad.push(r.t); }
  console.log(`${f} ${t0}-${t1} hand_${s}: skin ${(w.d * 1000).toFixed(1)}mm ${w.b}>${w.into} @${w.t?.toFixed(3)} | joint ${(wj.d * 1000).toFixed(1)}mm ${wj.b}>${wj.into} @${wj.t?.toFixed(3)} | frames>2mm ${bad.length}${bad.length ? ' ' + bad[0].toFixed(3) + '..' + bad.at(-1).toFixed(3) : ''}`); }
