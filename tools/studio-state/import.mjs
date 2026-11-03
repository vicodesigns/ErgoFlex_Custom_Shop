#!/usr/bin/env node
// Seed a studio state file from a browser's localStorage dump ({key: raw string}).
//   node tools/studio-state/import.mjs /home/ergo/codex_localstorage.json studio-state.json [--by Codex]
// Only ergoflex* keys are taken. Every imported key is stamped now (newest), so it
// wins over anything already in the file.
import { SPECS, SHARED_KEY, entryIds } from './merge.mjs';
import { load, write } from './file.mjs';
import fs from 'node:fs';
const [src, dst] = process.argv.slice(2), i = process.argv.indexOf('--by'), by = i > 0 ? process.argv[i + 1] : 'import';
if (!src || !dst) { console.error('Usage: import.mjs dump.json studio-state.json [--by NAME]'); process.exit(2); }
const dump = JSON.parse(fs.readFileSync(src, 'utf8')), state = load(dst), now = Date.now();
let n = 0, skipped = [];
for (const [key, value] of Object.entries(dump)) {
  if (!SHARED_KEY.test(key) || typeof value !== 'string') { skipped.push(key); continue; }
  state.rev++; n++;
  const rec = { rev: state.rev, ts: now, by, client: 'import', value };
  if (SPECS[key] && !SPECS[key].ring) rec.entries = Object.fromEntries(entryIds(key, value).map(id => [id, { rev: state.rev, ts: now, by }]));
  state.keys[key] = rec;
}
write(dst, state);
console.log(`${dst}: ${n} keys from ${src} (rev ${state.rev})` + (skipped.length ? `, skipped ${skipped.length}: ${skipped.slice(0, 5).join(', ')}` : ''));
