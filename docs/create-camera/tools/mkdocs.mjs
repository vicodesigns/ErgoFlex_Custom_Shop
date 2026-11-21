// Writes the Director importer docs for the Create camera re-key (build-round8-director.py <cut dir> --import <doc>).
//   node mkdocs.mjs <plan.json (seconds + cameraPlan.keys)> <base export doc (Vico's latest create export of that cut)> <out doc> [note]
// The base export is kept as it is; only shots[0].camera.keys is replaced by the plan's story keys in the Director's own key
// form (director-bridge.py link): id plan-NN, time = at / seconds (6 decimals), label (60 characters), easing, transition
// (null, or {type: 'cut'} for a cut key), view {position, target, fov, aspect 16:9}. `updated` is stamped, nothing else changes.
import fs from 'node:fs';
const [planF, baseF, outF, note] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planF, 'utf8')), doc = JSON.parse(fs.readFileSync(baseF, 'utf8'));
const shot = doc.shots[0], T = Number(shot.seconds);
if (shot.id !== 'create') throw Error('not a create export');
if (Math.abs(T - plan.seconds) > 1e-9) throw Error(`base export is ${T} s, the plan ${plan.seconds} s`);
const keys = [...plan.cameraPlan.keys].sort((a, b) => a.at - b.at);
shot.camera = {
  keys: keys.map((k, i) => {
    if ((k.label || '').length > 60) throw Error('label over 60 characters: ' + k.label);
    return { id: 'plan-' + String(i).padStart(2, '0'), time: Math.round(k.at / T * 1e6) / 1e6, label: k.label, easing: i === 0 || i === keys.length - 1 ? 'smooth' : 'linear',
      transition: k.cut ? { type: 'cut' } : null, view: { position: [...k.position], target: [...k.target], fov: k.fov, aspect: 16 / 9 } };
  })
};
doc.updated = new Date().toISOString();
if (note) doc.note = note;
fs.writeFileSync(outF, JSON.stringify(doc, null, 2));
console.log('wrote', outF, doc.id, keys.length, 'keys');
