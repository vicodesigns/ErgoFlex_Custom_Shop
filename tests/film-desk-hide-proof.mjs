// The "nothing changes without a hide" proof for desk hides in films (Layers phase 3, set B): what the four review cuts
// produce for the film's desk edits and people, through the Director's own functions. Shared by the snapshot writer and
// tests/film-desk-hide-test.mjs (which compares the code now with the snapshot written before desk hides existed).
//   node tests/film-desk-hide-proof.mjs --write    (only to refresh the snapshot, with the code BEFORE a desk-hide change)
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cleanDeskEdits,mergeDeskEdits,filmDeskEdits} from '../experience/desk-edits.mjs';
import {mergePeople,peopleFilter} from '../experience/people-edits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CUTS = ['cinematic-intro-20261110-people', 'cinematic-intro-cut-cine', 'cinematic-intro-20261104-hq14', 'cinematic-intro-20261110-alt'];
export const SNAPSHOT = path.join(ROOT, 'tests', 'fixtures', 'film-desk-hide-before.json');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
// Every shot of a cut that can carry desk edits or people: review-cut.json, shots/*.json and director-camera-*.json.
function shotsOf(dir) {
  const files = ['review-cut.json', ...(fs.existsSync(path.join(dir, 'shots')) ? fs.readdirSync(path.join(dir, 'shots')).filter(f => f.endsWith('.json')).map(f => 'shots/' + f) : []),
    ...fs.readdirSync(dir).filter(f => /^director-camera-.*\.json$/.test(f))].sort();
  const out = [];
  for (const f of files) {
    const v = read(path.join(dir, f)); if (!v || typeof v !== 'object') continue;
    const shots = Array.isArray(v.shots) ? v.shots : [v];
    shots.forEach((s, i) => { if (s && typeof s === 'object') out.push({ at: `${f}#${s.id || i}`, s }); });
  }
  return out;
}
// What the film gets for one shot: its desk edits cleaned, the Director's merge over it (as the cut shot), and its people.
export function produce() {
  const out = {};
  for (const cut of CUTS) {
    const dir = path.join(ROOT, 'exports', cut); if (!fs.existsSync(dir)) { out[cut] = null; continue; }
    const rows = {};
    for (const { at, s } of shotsOf(dir)) {
      const deskEdits = Array.isArray(s.deskEdits) ? s.deskEdits : Array.isArray(s.desks) ? s.desks : null;
      rows[at] = {
        film: filmDeskEdits(s),
        clean: cleanDeskEdits({ deskEdits: deskEdits || s.sceneDeskEdits || [] }),
        merge: mergeDeskEdits(s, deskEdits ? { deskEdits } : s),
        people: s.peopleEdits ? peopleFilter(s.peopleEdits) : null,
        mergePeople: mergePeople(s, s),
        filmPeople: s.people ?? null
      };
    }
    out[cut] = rows;
  }
  return out;
}
if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify(produce(), null, 1) + '\n');
  console.log('wrote', SNAPSHOT);
}
