import fs from 'node:fs';
const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sh = doc.shots ? doc.shots[0] : doc; const ppl = sh.peopleEdits || sh.people;
const c = ppl.cast.find(c => c.key === 'maya-stand');
console.log('shot', sh.id, 'postures', Object.keys(c.postures));
const ks = c.postures['people-maya-sit-type'].poseKeys;
console.log('n', ks.length);
for (const k of ks) console.log(k.t.toFixed(3), (k.ease||'smooth').padEnd(7), Object.keys(k.pose).length, Object.keys(k.pose).filter(b=>!/_0\d_/.test(b)).join(' '));
