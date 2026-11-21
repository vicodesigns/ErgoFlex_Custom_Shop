// The export doc the Director importer reads (tools/experience/build-round8-director.py <cut> --import <doc>):
// Vico's latest raw export of the chapter (export-a8fc6cd8ebda, imported 12:12 Nov 21) with one thing replaced:
// shots[0].peopleEdits.cast[maya-stand].postures["people-maya-sit-type"].poseKeys = the patch (build-fix.mjs).
// Everything else - camera keys, clips, titles, props, desks, the other posture, when, chair, skin relief - is his export's, byte for byte.
//   node docs/rise-jitter-landing/make-doc.mjs <Vico's export> <patch.json> <out doc>
import fs from 'node:fs';
const [baseF, patchF, outF] = process.argv.slice(2);
const raw = fs.readFileSync(baseF, 'utf8'), doc = JSON.parse(raw), keys = JSON.parse(fs.readFileSync(patchF, 'utf8'))['people-maya-sit-type'];
const shot = doc.shots[0]; if (shot.id !== 'rise') throw new Error('not the rise chapter');
const post = shot.peopleEdits.cast.find(c => c.key === 'maya-stand').postures['people-maya-sit-type'];
post.poseKeys = keys;
// the base's own layout (Director exports: 2-space JSON); a check that nothing else moved
const out = JSON.stringify(doc, null, raw.includes('\n  "') ? 2 : 1);
const a = JSON.parse(raw), b = JSON.parse(out);
a.shots[0].peopleEdits.cast.find(c => c.key === 'maya-stand').postures['people-maya-sit-type'].poseKeys = null;
b.shots[0].peopleEdits.cast.find(c => c.key === 'maya-stand').postures['people-maya-sit-type'].poseKeys = null;
if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('something else changed');
fs.writeFileSync(outF, out);
console.log(`${outF}: ${keys.length} pose keys (was ${JSON.parse(raw).shots[0].peopleEdits.cast.find(c => c.key === 'maya-stand').postures['people-maya-sit-type'].poseKeys.length}); the rest of the doc is ${baseF.split('/').pop()}`);
