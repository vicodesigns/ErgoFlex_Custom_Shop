#!/usr/bin/env node
// Puts a chapter patch (tools/studio-state/shot-patch.mjs; docs/music-kai-walk/patch.json) into a Director autosave as a
// NEW 'restore' entry, so the Director's File > Autosaves... can bring it back. Existing entries are never changed.
//
//   node tools/studio-state/autosave-patch.mjs --autosave <exports/director-autosaves/<cut>/<chapter>> --patch <patch.json>
//        [--film <film shot or cut json>] [--dry-run] [--allow-prune]
//     1. reads the folder's index.json and its NEWEST entry (autosave-store.mjs readAutosave)
//     2. copies the whole folder to a sibling '<chapter>-backup-<YYYYMMDD-HHMMSS>' first (refuses if that exists)
//     3. applies the patch to a copy of that entry's project (its chapter: peopleEdits, camera keys, set fields)
//     4. writes it with writeAutosave(root, {cut, chapter, reason: 'restore', groups}) as a new '...-restore.json.gz'
//        entry. writeAutosave prunes old entries beyond its history rule (KEEP_NEWEST, then hourly / daily): this script
//        refuses when the new entry would prune any (the backup has them anyway) unless --allow-prune.
//     --film: the film's shot of the chapter (exports/<cut>/director-film/<chapter>.json, or review-cut.json), for the
//        plan-NN camera keys' holds and cuts as the film reads them; by default <root>/exports/<cut>/director-film/<chapter>.json
//        when it exists. --dry-run: only says what it would do (no backup, no write).
//
//   node tools/studio-state/autosave-patch.mjs --film-cut <cut.json | shot.json> --patch <patch.json> --out <file>
//     the same patch on a film cut's chapter (people, cameraPlan + its bake, set fields), written to --out (a copy:
//     never the input file).
import fs from 'node:fs';
import path from 'node:path';
import { readIndex, readAutosave, writeAutosave, keepOf } from './autosave-store.mjs';
import { patchProject, patchFilmShot } from './shot-patch.mjs';

const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i < 0 ? null : (args[i + 1] ?? ''); }, flag = n => args.includes('--' + n);
const die = m => { console.error('autosave-patch: ' + m); process.exit(1); };
const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..*$/, '');
const patchFile = opt('patch'); if (!patchFile) die('--patch <patch.json> is required.');
const patch = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
if (patch.v !== 1 || typeof patch.chapter !== 'string') die('Not a chapter patch (v 1, chapter).');

function filmCut(input, out) {
  if (path.resolve(input) === path.resolve(out)) die('--out must be a new file, not the cut itself.');
  const data = JSON.parse(fs.readFileSync(input, 'utf8')), shots = Array.isArray(data.shots) ? data.shots : [data];
  const i = shots.findIndex(s => s.id === patch.chapter); if (i < 0) die(`No chapter '${patch.chapter}' in ${input}.`);
  const r = patchFilmShot(shots[i], patch); shots[i] = r.shot;
  fs.writeFileSync(out, JSON.stringify(Array.isArray(data.shots) ? data : shots[0], null, 1) + '\n');
  console.log(`${patch.chapter}: patched -> ${out}${r.notes.length ? '\n  ' + r.notes.join('\n  ') : ''}`);
}

function autosave(dir, { film, dry, allowPrune }) {
  dir = path.resolve(dir);
  const chapter = path.basename(dir), cut = path.basename(path.dirname(dir)), base = path.dirname(path.dirname(dir));
  if (path.basename(base) !== 'director-autosaves' || path.basename(path.dirname(base)) !== 'exports') die(`${dir} is not exports/director-autosaves/<cut>/<chapter>.`);
  const root = path.dirname(path.dirname(base));
  if (chapter !== patch.chapter) die(`The folder is chapter '${chapter}', the patch is for '${patch.chapter}'.`);
  const index = readIndex(dir); if (!index.length) die(`No autosaves in ${dir} (index.json).`);
  const newest = [...index].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const project = readAutosave(root, cut, chapter, newest.file);
  const filmPath = film || path.join(root, 'exports', cut, 'director-film', chapter + '.json');
  let filmPlan = null;
  if (fs.existsSync(filmPath)) { const d = JSON.parse(fs.readFileSync(filmPath, 'utf8')), s = Array.isArray(d.shots) ? d.shots.find(x => x.id === chapter) : d; filmPlan = s?.cameraPlan || null; }
  else if (film) die(`--film ${film} does not exist.`);
  const { project: next, notes } = patchProject(project, patch, { filmPlan });
  console.log(`newest autosave: ${newest.file} (${newest.at}, ${newest.reason})${filmPlan ? `\nfilm plan: ${filmPath}` : '\nfilm plan: none found (holds / cuts read from the keys)'}`);
  for (const n of notes) console.log('  ' + n);
  // what writeAutosave would prune with the new entry first (its own rule, keepOf)
  const now = new Date(), gone = index.filter(e => !keepOf([{ file: 'new', at: now.toISOString() }, ...index], now.getTime()).includes(e));
  if (gone.length && !allowPrune) die(`Writing a new entry would prune ${gone.length} old autosave(s) (${gone.map(e => e.file).join(', ')}): run with --allow-prune (the backup keeps them).`);
  if (dry) { console.log('dry run: no backup, nothing written.'); return null; }
  const backup = path.join(path.dirname(dir), `${chapter}-backup-${stamp(now)}`);
  if (fs.existsSync(backup)) die(`${backup} exists already.`);
  fs.cpSync(dir, backup, { recursive: true, errorOnExist: true, force: false });
  console.log(`backup: ${backup} (${fs.readdirSync(backup).length} files)`);
  const r = writeAutosave(root, { cut, chapter, reason: 'restore', groups: patch.groups || [], project: next }, now);
  console.log(`new autosave: ${r.file} (kept ${r.kept}, pruned ${r.pruned})`);
  return { backup, ...r };
}

if (opt('film-cut') !== null) { const out = opt('out'); if (!out) die('--out <file> is required with --film-cut.'); filmCut(opt('film-cut'), out); }
else if (opt('autosave') !== null) autosave(opt('autosave'), { film: opt('film'), dry: flag('dry-run'), allowPrune: flag('allow-prune') });
else die('Give --autosave <folder> or --film-cut <cut.json> --out <file>.');
