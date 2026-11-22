// Send to desk (tools/director-inbox.mjs, POST /__director/inbox): the real server on a free port over a scratch tree
// (exports/<cut>/cut.json + review-cut.json) and a fake HOME/Downloads. No browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allowedAddress, inboxDir, target } from '../tools/director-inbox.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ---- units
assert.ok(allowedAddress('127.0.0.1') && allowedAddress('::1') && allowedAddress('::ffff:127.0.0.1'), 'loopback');
assert.ok(allowedAddress('100.64.0.1') && allowedAddress('100.101.102.103') && allowedAddress('100.127.255.254') && allowedAddress('fd7a:115c:a1e0::1'), 'tailnet');
for (const a of ['100.63.0.1', '100.128.0.1', '192.168.1.5', '10.0.0.2', '8.8.8.8', '2001:db8::1', '', undefined]) assert.ok(!allowedAddress(a), 'refused ' + a);
assert.equal(inboxDir({ DIRECTOR_INBOX_DIR: '/x/in' }, '/h'), '/x/in');
assert.equal(inboxDir({ DIRECTOR_IMPORT_DIRS: ['/a', '/b'].join(path.delimiter) }, '/h'), '/a');
assert.equal(inboxDir({}, '/h'), path.join('/h', 'Downloads'), 'the importer\'s default: ~/Downloads');

// ---- the scratch tree
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'director-inbox-'));
const root = path.join(tmp, 'tree'), downloads = path.join(tmp, 'home', 'Downloads');
fs.mkdirSync(path.join(root, 'exports/cut-a'), { recursive: true });
fs.writeFileSync(path.join(root, 'exports/cut-a/cut.json'), JSON.stringify({ id: 'my-cut' }));
fs.writeFileSync(path.join(root, 'exports/cut-a/review-cut.json'), '{}');
fs.mkdirSync(path.join(root, 'exports/cut-nobuild'), { recursive: true });
fs.writeFileSync(path.join(root, 'exports/cut-nobuild/cut.json'), JSON.stringify({ id: 'no-build' }));
fs.mkdirSync(path.join(root, 'exports/master'), { recursive: true });
fs.writeFileSync(path.join(root, 'exports/master/review-cut.json'), '{}');
fs.mkdirSync(downloads, { recursive: true });
const state = path.join(tmp, 'studio-state.json');

const exp = (over = {}) => ({ schema: 'ergoflex.client-cut', version: 1, id: 'film-my-cut-awareness', name: 'Film chapter: awareness', shots: [{ id: 'awareness', seconds: 12 }], ...over });
assert.deepEqual(target(exp(), root), { folder: 'exports/cut-a', chapter: 'awareness', cutId: 'my-cut' });
assert.equal(target(exp({ id: 'film-awareness' }), root, 'exports/master').folder, 'exports/master', 'no cut part: the master');
assert.throws(() => target(exp({ id: 'film-other-awareness' }), root), /No film cut/);
assert.throws(() => target(exp({ id: 'film-no-build-awareness' }), root), /review-cut/);

const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const server = spawn(process.execPath, [path.join(repo, 'tools/studio-server.mjs'), '--port', String(port), '--host', '127.0.0.1', '--root', root, '--state', state, '--no-watch'],
  { cwd: repo, env: { ...process.env, HOME: path.join(tmp, 'home'), DIRECTOR_INBOX_DIR: downloads, DIRECTOR_IMPORT_DIRS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', d => { log += d; }); server.stderr.on('data', d => { log += d; });
try {
  await new Promise((ok, fail) => { const t = setTimeout(() => fail(Error('server did not start: ' + log)), 15000); server.stdout.on('data', d => { if (/studio server/.test(d)) { clearTimeout(t); ok(); } }); server.once('exit', c => fail(Error('server exited ' + c + log))); });
  const base = `http://127.0.0.1:${port}`, H = { 'content-type': 'application/json', 'x-director-inbox': '1' };
  const post = (body, headers = H) => fetch(base + '/__director/inbox', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const files = () => fs.readdirSync(downloads).sort();

  // refusals first: nothing may be written
  let r = await post(exp({ schema: 'ergoflex.something' })); assert.equal(r.status, 400, 'wrong schema'); assert.match((await r.json()).error, /schema/);
  r = await post(exp({ id: 'film-ghost-awareness' })); assert.equal(r.status, 400, 'unknown cut'); assert.match((await r.json()).error, /No film cut/);
  r = await post(exp({ id: 'film-no-build-awareness' })); assert.equal(r.status, 400, 'a cut folder without review-cut.json');
  r = await post(exp({ shots: [{ id: 'awareness' }, { id: 'x' }] })); assert.equal(r.status, 400, 'two chapters');
  r = await post(exp({ id: 'film-my-cut-other' })); assert.equal(r.status, 400, 'id does not end with its chapter');
  r = await post(exp({ id: 'film-my-cut-../../x', shots: [{ id: '../../x' }] })); assert.equal(r.status, 400, 'path-like chapter id');
  r = await post(exp(), { ...H, 'x-director-cut': 'exports/some-other-cut' }); assert.equal(r.status, 400, 'the page names another cut'); assert.match((await r.json()).error, /belongs to exports\/cut-a/);
  r = await post('not json {'); assert.equal(r.status, 400, 'not JSON');
  r = await post(exp({ pad: 'x'.repeat(5 * 1024 * 1024) })); assert.equal(r.status, 413, 'oversized'); await r.text().catch(() => {});
  r = await post(exp(), { 'content-type': 'application/json' }); assert.equal(r.status, 400, 'no Director header');
  r = await post(exp(), { 'content-type': 'text/plain', 'x-director-inbox': '1' }); assert.equal(r.status, 400, 'not JSON content type');
  r = await post(exp(), { ...H, origin: 'https://evil.example' }); assert.equal(r.status, 403, 'another origin');
  r = await fetch(base + '/__director/inbox', { headers: H }); assert.equal(r.status, 405, 'GET');
  assert.deepEqual(files(), [], 'nothing written on any refusal');

  // accepted
  const good = exp({ shots: [{ id: 'awareness', seconds: 12, filmTitles: [{ id: 't1', title: 'It sees what\'s in its way.' }] }] }), text = JSON.stringify(good, null, 2);
  r = await post(text, { ...H, 'x-director-cut': 'exports/cut-a' }); const ok = await r.json(); assert.equal(r.status, 200, JSON.stringify(ok));
  assert.match(ok.file, /^Film-chapter-awareness-\d{8}-\d{6}\.json$/, 'the importer\'s pattern: Film-chapter-<chapter>-<YYYYMMDD-HHMMSS>.json');
  assert.equal(ok.cut, 'exports/cut-a'); assert.equal(ok.chapter, 'awareness');
  assert.deepEqual(files(), [ok.file], 'one file, no leftover part file');
  assert.equal(fs.readFileSync(path.join(downloads, ok.file), 'utf8'), text, 'the content as sent');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(downloads, ok.file), 'utf8')), good);
  // the same second again: a new name, the first kept
  r = await post(text); const again = await r.json(); assert.equal(r.status, 200); assert.notEqual(again.file, ok.file); assert.match(again.file, /^Film-chapter-awareness-\d{8}-\d{6}(-\d+)?\.json$/); assert.equal(files().length, 2);
  // the importer would take both: its glob
  assert.ok(files().every(f => /^Film-chapter-.*\.json$/.test(f)));
  // a hostile chapter id never reaches the file name
  console.log('director-inbox-test ok');
} finally { server.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
