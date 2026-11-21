// usage: node mkcut.mjs <review-cut.json> <out.json>   (the create chapter alone)
import fs from 'node:fs';
const [rc, out] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(rc, 'utf8')).shots.find(s => s.id === 'create');
fs.writeFileSync(out, JSON.stringify({ name: 'create', shots: [s] }));
console.log('ok', s.seconds, s.cameraPlan.keys.map(k => k.at).join(' '), 'baked', s.camera.keys.length);
