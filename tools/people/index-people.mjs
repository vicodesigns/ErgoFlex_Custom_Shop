#!/usr/bin/env node
// Enter built people in tools/props/manifest.json and assets/props/index.json (called by build.py).
//   node tools/people/index-people.mjs <results.json>   [{ manifest: {...}, index: {...} }, ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const results = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const manifestFile = join(root, 'tools/props/manifest.json'), indexFile = join(root, 'assets/props/index.json');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')), index = JSON.parse(readFileSync(indexFile, 'utf8'));
// Existing entries keep their place; new ones go to the end.
const upsert = (list, entry) => { const i = list.findIndex(p => p.id === entry.id); if (i < 0) list.push(entry); else list[i] = entry; };
for (const r of results) { upsert(manifest.props, r.manifest); upsert(index.props, r.index); }
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
writeFileSync(indexFile, JSON.stringify(index, null, 1) + '\n');
console.log(`${results.length} people indexed`);
