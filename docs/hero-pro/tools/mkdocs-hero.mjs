// Writes the Director importer doc for the hero pass (build-round8-director.py <cut dir> --import <doc>).
//   node mkdocs-hero.mjs <plan.json> <base export (Vico's latest hero export)> <lights.json> <motion.json> <out doc>
// The base export is kept as it is; changed: shots[0].seconds (the plan's), shots[0].camera.keys (the plan's story keys in
// the Director's own key form: id plan-NN, time = at / seconds, label <= 60 chars, easing, transition null, view with aspect
// 16:9), shots[0].deskVersions (the last version runs to the new length; the others as they are), shots[0].motion.clips
// (only clips whose fields differ in motion.json; here g-tilt's stale path), shots[0].lights (the keyed light rig), `updated`.
import fs from 'node:fs';
const [planF, baseF, lightsF, motionF, outF] = process.argv.slice(2);
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const plan = rd(planF), doc = rd(baseF), lights = rd(lightsF), motion = rd(motionF);
const shot = doc.shots[0], T = plan.seconds;
if (shot.id !== 'hero') throw Error('not a hero export');
shot.seconds = T;
const keys = [...plan.cameraPlan.keys].sort((a, b) => a.at - b.at);
shot.camera = { ...shot.camera, keys: keys.map((k, i) => {
  if ((k.label || '').length > 60) throw Error('label over 60 characters: ' + k.label);
  return { id: 'plan-' + String(i).padStart(2, '0'), time: Math.round(k.at / T * 1e6) / 1e6, label: k.label, easing: i === 0 || i === keys.length - 1 ? 'smooth' : 'linear',
    transition: null, view: { position: [...k.position], target: [...k.target], fov: k.fov, aspect: 16 / 9 } };
}) };
const dv = shot.deskVersions, last = dv.reduce((a, b) => b.end > a.end ? b : a);
last.end = T;
const byId = Object.fromEntries(motion.clips.map(c => [c.id, c]));
shot.motion.clips = shot.motion.clips.map(c => { const m = byId[c.id]; return m && JSON.stringify(m.path) !== JSON.stringify(c.path) ? { ...c, path: m.path } : c; });
shot.lights = lights;
doc.updated = new Date().toISOString();
fs.writeFileSync(outF, JSON.stringify(doc, null, 2));
console.log('wrote', outF, doc.id, T, 's,', keys.length, 'keys, versions', dv.map(v => `${v.n}=${v.preset} ${v.start}-${v.end}`).join(' '));
