// Writes the two export-doc patches the Director importer reads (build-round8-director.py <cut> --import <doc>):
//   seated:   Vico's own export of the rise chapter (exports/vico-edits/export-03037b996341-...json on cut/vicos-3rd-rise-vico-edits-20261120)
//             with only people.cast[maya-stand].postures["people-maya-sit-type"].poseKeys replaced
//   standing: the Director form of the standing cut's chapter (director-bridge.py link --json) + its peopleEdits (the chapter's people, v2)
//             with only postures["people-maya-stand-type-41"].poseKeys replaced
//   node docs/rise-pull/make-docs.mjs <patch.json> <vico seated export.json> <standing link base.json> <standing director-camera-rise.json> <outdir>
import fs from 'node:fs';
const [patchF, seatedF, standLinkF, standCamF, outDir] = process.argv.slice(2);
const patch = JSON.parse(fs.readFileSync(patchF, 'utf8')), rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const setKeys = (people, posture, keys) => { people.cast.find(c => c.key === 'maya-stand').postures[posture].poseKeys = keys; };
// seated
const seated = rd(seatedF);
if (patch['people-maya-sit-type']) setKeys(seated.shots[0].peopleEdits, 'people-maya-sit-type', patch['people-maya-sit-type']);
fs.writeFileSync(outDir + '/rise-pull-seated-export.json', JSON.stringify(seated, null, 2));
// standing
const stand = rd(standLinkF), cam = rd(standCamF), people = JSON.parse(JSON.stringify(cam.people));
if (patch['people-maya-stand-type-41']) setKeys(people, 'people-maya-stand-type-41', patch['people-maya-stand-type-41']);
stand.id = 'film-vicos-3rd-cut-standing-rise'; stand.client = 'Vicos 3rd cut, standing stretch'; stand.volume = 0.32; stand.shots[0].peopleEdits = people;
fs.writeFileSync(outDir + '/rise-pull-standing-export.json', JSON.stringify(stand, null, 2));
console.log('ok');
