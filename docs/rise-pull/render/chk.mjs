import fs from 'node:fs';
const [dir, post, patchF] = process.argv.slice(2);
const patch = JSON.parse(fs.readFileSync(patchF, 'utf8'))[post];
for (const f of ['director-camera-rise.json', 'review-cut.json', 'director-film/rise.json']) {
  const j = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')); const sh = j.shots ? j.shots.find(s => s.id === 'rise') : j;
  const ppl = sh.people; const keys = ppl.cast.find(c => c.key === 'maya-stand').postures[post].poseKeys;
  console.log(f, JSON.stringify(keys) === JSON.stringify(patch) ? 'keys == patch (' + keys.length + ' keys)' : 'DIFFERENT');
}
