// The export doc the Director importer reads (tools/experience/build-round8-director.py <cut> --import <doc>).
// There is no raw Coast export of Vico's in this cut (director-exports/ holds none for coast: the chapter came over
// unchanged from the 2nd cut), so the doc is the cut's own Coast page doc (director-import/ErgoFlex-film-ch05-coast-
// director.json: what the Director opens and exports, camera keys and clips as the film has them) with the Director's
// people field added: peopleEdits = {v: 2, ...people} (v2: the film's whole `people` object, imported verbatim).
//   node make-doc.mjs <page doc> <people.json (director-film/coast.json .people, or the fixed one)> <out doc>
import fs from 'node:fs';
const [pageF, peopleF, outF] = process.argv.slice(2);
const doc = JSON.parse(fs.readFileSync(pageF, 'utf8')), src = JSON.parse(fs.readFileSync(peopleF, 'utf8')), people = src.people || src;
const shot = doc.shots[0]; if (shot.id !== 'coast') throw new Error('not the coast chapter');
if ('peopleEdits' in shot) throw new Error('the page doc already has peopleEdits');
shot.peopleEdits = { v: 2, ...structuredClone(people) };
fs.writeFileSync(outF, JSON.stringify(doc, null, 2) + '\n');
console.log(outF, 'cast', people.cast.length);
