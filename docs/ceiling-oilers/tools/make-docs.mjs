// Writes the Oilers export docs the Director importer reads (build-round8-director.py <cut dir> --import <doc>):
//   Vico's latest Oilers export of each cut, kept as it is, with only the cast entries named in the patch changed
//   (shots[0].peopleEdits.cast[key=...] fields, by key) and `updated` stamped.
//   node docs/ceiling-oilers/tools/make-docs.mjs <oilers-patch.json> <base export> <out doc> [note]
// The patch's `set` list: { cast: '<key>', path: 'at' | 'walk.path[2]' | 'act.by' | 'colors.hair' ..., from, to }.
// `from` is checked against the base (a base that does not hold it is refused), unless from is absent.
import fs from 'node:fs';
const [patchF, baseF, outF, note] = process.argv.slice(2);
const patch = JSON.parse(fs.readFileSync(patchF, 'utf8')), doc = JSON.parse(fs.readFileSync(baseF, 'utf8'));
const shot = doc.shots[0];
if (shot.id !== 'oilers') throw Error('not an oilers export: ' + shot.id);
const cast = shot.peopleEdits?.cast; if (!Array.isArray(cast)) throw Error('export has no peopleEdits.cast');
const steps = p => p.replace(/\[(\d+)\]/g, '.$1').split('.');
for (const s of patch.set) {
  const entry = cast.find(c => c.key === s.cast); if (!entry) throw Error('no cast entry ' + s.cast);
  const keys = steps(s.path); let o = entry;
  for (const k of keys.slice(0, -1)) { if (o[k] === undefined) o[k] = {}; o = o[k]; }
  const last = keys.at(-1);
  if ('from' in s && JSON.stringify(o[last]) !== JSON.stringify(s.from)) throw Error(`${s.cast}.${s.path}: base has ${JSON.stringify(o[last])}, patch expects ${JSON.stringify(s.from)}`);
  o[last] = JSON.parse(JSON.stringify(s.to));
}
doc.updated = new Date().toISOString();
if (note) doc.note = note;
fs.writeFileSync(outF, JSON.stringify(doc, null, 2));
console.log('wrote', outF, doc.id, patch.set.length, 'fields');
