// The Director's autosaves on disk (17 Nov 2026, Vico: "I've been kind of just losing work… adding an autosave").
//   exports/director-autosaves/<cut>/<chapter>/<YYYYMMDD-HHMMSS>-<reason>.json.gz   one version: the Director project
//   exports/director-autosaves/<cut>/<chapter>/index.json                           [{file, at, reason, groups, bytes, hash}]
// <cut> is the film cut's folder name (exports/<cut>), or 'library-<project id>' for a cut that is not a film's.
// exports/ is not watched by the studio server and not in git; nothing here ever writes into a cut's own folder.
// History per chapter: the newest KEEP_NEWEST, then the newest of each hour for HOURLY_DAYS days, then one a day.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { editsOf } from '../../experience/edits-count.mjs';

export const KEEP_NEWEST = 30, HOURLY_DAYS = 14;
export const REASONS = ['edit', 'chapter', 'close', 'export', 'replace', 'restore', 'reopen', 'aside'];
export { editsOf };
// A quiet save (edit, tab closed, chapter switch) that holds less than half the edits of the one before, within a
// minute: the one before is kept for good (protected, with a note) whatever the pruning does (19 Nov 2026: Vico's gym
// draft went empty at 19:44:30 and the newest autosave was the empty one).
export const SHRINK = .5, SHRINK_WINDOW = 60e3, QUIET_REASONS = ['edit', 'close', 'chapter'];
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,90}$/, FILE = /^\d{8}-\d{6}(?:-\d{1,3})?-[a-z]{1,12}\.json\.gz$/;
export const safeName = s => typeof s === 'string' && NAME.test(s) && !s.includes('..');
export const dirOf = (root, cut, chapter) => {
  if (!safeName(cut) || !safeName(chapter)) throw Error('Bad cut or chapter name.');
  return path.join(root, 'exports', 'director-autosaves', cut, chapter);
};
const stampOf = d => d.toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..*$/, '');
export function readIndex(dir) {
  try { const v = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); return Array.isArray(v) ? v.filter(e => e && FILE.test(e.file)) : []; } catch { return []; }
}
function writeAtomic(file, data) { const tmp = file + '.tmp-' + process.pid; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); }
// Which entries to keep (newest first in, newest first out).
export function keepOf(entries, now = Date.now()) {
  const sorted = [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), keep = new Set(), hours = new Set(), days = new Set();
  sorted.forEach((e, i) => {
    const t = Date.parse(e.at), age = now - t, hour = Math.floor(t / 3600e3), day = Math.floor(t / 86400e3);
    if (e.protected) { keep.add(e); return; }      // (kept before a big drop, or a set-aside draft)
    if (i < KEEP_NEWEST) { keep.add(e); hours.add(hour); days.add(day); return; }
    if (age <= HOURLY_DAYS * 86400e3) { if (!hours.has(hour)) { hours.add(hour); days.add(day); keep.add(e); } return; }
    if (!days.has(day)) { days.add(day); keep.add(e); }
  });
  return sorted.filter(e => keep.has(e));
}
// Writes one version unless it is the same as the newest. -> {file, at, skipped?, kept, pruned}
export function writeAutosave(root, { cut, chapter, reason = 'edit', groups = [], project, note = '' }, now = new Date()) {
  if (!project || typeof project !== 'object' || !Array.isArray(project.shots)) throw Error('No Director project.');
  if (!REASONS.includes(reason)) reason = 'edit';
  const dir = dirOf(root, cut, chapter), text = JSON.stringify(project), hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  fs.mkdirSync(dir, { recursive: true });
  const index = readIndex(dir), newest = index[0];
  if (newest && newest.hash === hash && reason !== 'restore' && reason !== 'aside') return { file: newest.file, at: newest.at, skipped: true, kept: index.length, pruned: 0 };   // (a set-aside draft is always its own named entry)
  let file = `${stampOf(now)}-${reason}.json.gz`;
  for (let n = 1; index.some(e => e.file === file) || fs.existsSync(path.join(dir, file)); n++) file = `${stampOf(now)}-${n}-${reason}.json.gz`;
  const gz = zlib.gzipSync(Buffer.from(text, 'utf8'));
  writeAtomic(path.join(dir, file), gz);
  const edits = editsOf(project), entry = { file, at: now.toISOString(), reason, groups: (Array.isArray(groups) ? groups : []).filter(g => typeof g === 'string').slice(0, 20).map(g => g.slice(0, 30)), bytes: gz.length, hash, edits,
    ...(typeof note === 'string' && note.trim() ? { note: note.trim().slice(0, 80) } : {}), ...(reason === 'aside' ? { protected: true } : {}) };
  if (newest && QUIET_REASONS.includes(reason) && now.getTime() - Date.parse(newest.at) < SHRINK_WINDOW && Number.isFinite(newest.edits) && newest.edits >= 2 && edits < newest.edits * SHRINK) {
    newest.protected = true; newest.note ||= `kept: the next autosave had ${edits} of its ${newest.edits} edits`;
  }
  const all = [entry, ...index], kept = keepOf(all, now.getTime()), gone = all.filter(e => !kept.includes(e));
  for (const e of gone) try { fs.unlinkSync(path.join(dir, e.file)); } catch {}
  writeAtomic(path.join(dir, 'index.json'), JSON.stringify(kept, null, 1) + '\n');
  return { file, at: entry.at, kept: kept.length, pruned: gone.length };
}
// Every chapter's autosaves of a cut: [{chapter, ...entry}] newest first (or one chapter's).
export function listAutosaves(root, cut, chapter = null) {
  if (!safeName(cut)) throw Error('Bad cut name.');
  const base = path.join(root, 'exports', 'director-autosaves', cut);let chapters = [];
  try { chapters = chapter ? [chapter] : fs.readdirSync(base).filter(safeName); } catch { return []; }
  return chapters.flatMap(ch => { try { return readIndex(dirOf(root, cut, ch)).map(e => ({ chapter: ch, ...e })); } catch { return []; } })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
export function readAutosave(root, cut, chapter, file) {
  if (!FILE.test(String(file))) throw Error('Bad autosave file.');
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dirOf(root, cut, chapter), file))).toString('utf8'));
}
