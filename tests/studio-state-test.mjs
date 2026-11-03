// Shared studio state: merges (on a real localStorage dump when present) and the
// server's HTTP API and reload rules, on a scratch tree and port.
//   node tests/studio-state-test.mjs [dump.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mergeWrite, changedEntries, SPECS } from '../tools/studio-state/merge.mjs';
import { decodeStoredJSON, encodeStoredJSON } from '../browser-design-storage.mjs';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dumpFile = process.argv[2] || '/home/ergo/codex_localstorage.json';
const dump = fs.existsSync(dumpFile) ? JSON.parse(fs.readFileSync(dumpFile, 'utf8')) : null;
const edit = (raw, codec, fn) => { const v = codec === 'pool' ? decodeStoredJSON(raw) : JSON.parse(raw); fn(v); return codec === 'pool' ? encodeStoredJSON(v) : JSON.stringify(v); };
const read = (raw, codec) => codec === 'pool' ? decodeStoredJSON(raw) : JSON.parse(raw);
let n = 0; const ok = name => { n++; console.log('ok', name); };

// ---- merges ----
{
  // Small synthetic sceneAssets: two browsers edit different rooms from the same base.
  const base = JSON.stringify({ 'home:apartment': { transforms: { a: 1 } }, 'gaming:executive': { transforms: { b: 1 } }, 'office:house': { x: 1 } });
  const A = edit(base, 'plain', v => { v['home:apartment'].transforms.a = 2; });
  const B = edit(base, 'plain', v => { v['gaming:executive'].transforms.b = 3; delete v['office:house']; });
  let stored = mergeWrite('ergoflex.sceneAssets.v1', base, A, base).value;          // fast path
  const m = mergeWrite('ergoflex.sceneAssets.v1', stored, B, base);                     // B's base is stale
  const out = JSON.parse(m.value);
  assert.equal(out['home:apartment'].transforms.a, 2); assert.equal(out['gaming:executive'].transforms.b, 3); assert.ok(!('office:house' in out));
  assert.ok(m.merged); assert.deepEqual(m.changed, ['|gaming:executive']); assert.deepEqual(m.removed, ['|office:house']);
  // A stale writer that did not touch a room never resurrects or reverts it.
  const C = edit(base, 'plain', v => { v['home:apartment'].note = 'c'; });
  const out2 = JSON.parse(mergeWrite('ergoflex.sceneAssets.v1', m.value, C, base).value);
  assert.equal(out2['gaming:executive'].transforms.b, 3); assert.ok(!('office:house' in out2)); assert.equal(out2['home:apartment'].note, 'c'); assert.equal(out2['home:apartment'].transforms.a, 1, 'C rewrote its own room from its stale copy: last writer wins per room');
  ok('sceneAssets: per room, stale writers keep others\' rooms');
}
{
  const ids = changedEntries('ergoflex.clientCuts.v1', JSON.stringify({ version: 1, cuts: [{ id: 'x', a: 1 }], drafts: { d: 1 }, active: 'x' }), JSON.stringify({ version: 1, cuts: [{ id: 'x', a: 2 }, { id: 'y' }], drafts: { d: 1 }, active: 'y' }));
  assert.deepEqual(ids, { changed: ['cuts|x', 'cuts|y'], removed: [] });
  const base = JSON.stringify({ version: 1, cuts: [{ id: 'x', a: 1 }, { id: 'y', a: 1 }], drafts: { p: 1 }, active: 'x' });
  const A = JSON.stringify({ version: 1, cuts: [{ id: 'x', a: 9 }, { id: 'y', a: 1 }], drafts: { p: 1 }, active: 'x' });
  const B = JSON.stringify({ version: 1, cuts: [{ id: 'x', a: 1 }, { id: 'y', a: 1 }], drafts: { p: 1, q: 2 }, active: 'y' });
  const out = JSON.parse(mergeWrite('ergoflex.clientCuts.v1', A, B, base).value);
  assert.deepEqual(out.cuts.map(c => c.a), [9, 1]); assert.deepEqual(out.drafts, { p: 1, q: 2 }); assert.equal(out.active, 'y');
  ok('clientCuts: cuts by id, drafts by key, the rest last-writer-wins');
}
if (dump) {
  for (const key of ['ergoflex.sceneDesksBySizeV2', 'ergoflex.sceneAssets.v1', 'ergoflex.buildPresetsV1', 'ergoflex.sceneDesksV1']) {
    const { codec, containers } = SPECS[key], base = dump[key], c = containers[0];
    const pick = v => c.length ? c.reduce((n, k) => n[k], v) : v;
    const names = Object.keys(pick(read(base, codec)));
    const [r1, r2] = [names[0], names[names.length - 1]];
    const A = edit(base, codec, v => { pick(v)[r1] = { ...pick(v)[r1], __editA: 1 }; });
    const B = edit(base, codec, v => { pick(v)[r2] = { ...pick(v)[r2], __editB: 2 }; });
    const m = mergeWrite(key, A, B, base), out = read(m.value, codec);
    assert.equal(pick(out)[r1].__editA, 1, key + ' kept A'); assert.equal(pick(out)[r2].__editB, 2, key + ' kept B');
    assert.equal(Object.keys(pick(out)).length, names.length);
    assert.deepEqual(Object.keys(pick(out)), names, key + ' order kept');
    if (codec === 'pool') assert.ok(m.value.length < JSON.stringify(out).length, key + ' re-encoded with the image/object pool');
    ok(`${key}: real data, ${names.length} entries, A edits ${r1}, B edits ${r2}`);
  }
  {
    const key = 'ergoflexProjectAutosaveV1', base = dump[key], ring = decodeStoredJSON(base);
    const snap = (at, label) => ({ ...ring[0], savedAt: at, label });
    const A = encodeStoredJSON([snap('2026-11-03T20:00:00.000Z', 'A'), ...ring].slice(0, 5));
    const B = encodeStoredJSON([snap('2026-11-03T20:00:05.000Z', 'B'), ...ring].slice(0, 5));
    const m = mergeWrite(key, A, B, base), out = decodeStoredJSON(m.value);
    assert.deepEqual(out.map(x => x.label).slice(0, 2), ['B', 'A']); assert.equal(out.length, 5);
    assert.ok(m.value.length <= SPECS[key].ring.budget);
    ok(`autosave ring: union by savedAt, newest 5, ${(m.value.length / 1e6).toFixed(2)} MB <= 4 MiB`);
  }
  assert.equal(mergeWrite('ergoflex.ledEffectV1', 'a', 'b', 'c').value, 'b'); ok('plain keys: last writer wins');
}

// ---- server on a scratch tree ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-state-'));
fs.mkdirSync(path.join(tmp, 'exports')); fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><html><head><title>t</title></head><body>hi</body></html>');
fs.writeFileSync(path.join(tmp, 'a.css'), 'a{}'); fs.writeFileSync(path.join(tmp, 'a.js'), '1');
const stateFile = path.join(tmp, 'studio-state.json'), port = 3100 + Math.floor(Math.random() * 50) + 50;
if (dump) await new Promise((res, rej) => spawn('node', [path.join(repo, 'tools/studio-state/import.mjs'), dumpFile, stateFile, '--by', 'Codex'], { stdio: 'inherit' }).on('close', c => c ? rej(Error('import ' + c)) : res()));
const server = spawn('node', [path.join(repo, 'tools/studio-server.mjs'), '--root', tmp, '--port', String(port), '--host', '127.0.0.1', '--state', stateFile], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => server.stdout.once('data', r));
const base = `http://127.0.0.1:${port}`;
try {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<head><script src="\/__studio\/sync.js"><\/script>|<head>\n<script src="\/__studio\/sync.js"><\/script>/); assert.match(html, /__studio\/reload.js"><\/script>\n<\/body>/);
  ok('pages get sync.js first in <head> and the reload client');
  let s = await (await fetch(base + '/api/studio-state')).json();
  if (dump) { const want = Object.keys(dump).filter(k => /^ergoflex/.test(k)); assert.equal(Object.keys(s.values).length, want.length); for (const k of want) assert.equal(s.values[k], dump[k], k); ok(`import: ${want.length} keys, byte-identical`); }
  const post = body => fetch(base + '/api/studio-state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const r = await post({ client: 'c1', by: 'test', changes: [{ key: 'ergoflex.testKey', value: 'v1', base: null }, { key: 'flutter.token', value: 'secret' }] });
  assert.equal(r.results[1].skipped, 'not an ergoflex key');
  s = await (await fetch(base + '/api/studio-state')).json(); assert.equal(s.values['ergoflex.testKey'], 'v1'); assert.ok(!('flutter.token' in s.values));
  const ch = await (await fetch(`${base}/api/studio-state/changes?since=${s.rev - 1}&client=c2`)).json(); assert.deepEqual(ch.keys.map(k => k.key), ['ergoflex.testKey']);
  const mine = await (await fetch(`${base}/api/studio-state/changes?since=${s.rev - 1}&client=c1`)).json(); assert.equal(mine.keys.length, 0);
  ok('POST stores ergoflex keys only; changes feed excludes the writer');
  await new Promise(r => setTimeout(r, 600));
  const file = fs.readFileSync(stateFile, 'utf8'); assert.match(file, /"ergoflex.testKey": \{/); assert.ok(!file.includes('flutter.token'));
  ok('state file written, one key per line, no flutter keys');
  // reload rules
  const events = []; const ctrl = new AbortController();
  fetch(base + '/__studio/events', { signal: ctrl.signal }).then(async res => { const rd = res.body.getReader(), dec = new TextDecoder(); for (;;) { const { value, done } = await rd.read(); if (done) break; for (const m of dec.decode(value).matchAll(/data: (\w+)/g)) events.push(m[1]); } }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));   // chokidar ready
  const settle = () => new Promise(r => setTimeout(r, 1300));
  fs.writeFileSync(path.join(tmp, 'exports', 'render.mkv'), 'x'); fs.mkdirSync(path.join(tmp, 'exports', 'hq9', 'final'), { recursive: true }); fs.writeFileSync(path.join(tmp, 'exports', 'hq9', 'final', 'a.json'), '{}');
  await post({ client: 'c1', by: 'test', changes: [{ key: 'ergoflex.testKey', value: 'v2', base: 'v1' }] }); await settle();
  assert.deepEqual(events, [], 'exports/ writes and state saves must not reload');
  fs.writeFileSync(path.join(tmp, 'a.css'), 'a{color:red}'); await settle(); assert.deepEqual(events, ['css']);
  fs.writeFileSync(path.join(tmp, 'a.js'), '2'); await settle(); assert.deepEqual(events, ['css', 'reload']);
  ctrl.abort();
  ok('reload: none for exports/ or the state file, css swap for .css, reload for code');
} finally { server.kill('SIGTERM'); await new Promise(r => setTimeout(r, 300)); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`${n} checks passed`);
