// End-to-end: the real studio page on a test port with a scratch state file
// (never :3000 or the committed studio-state.json). Two separate browser
// profiles edit different rooms; both edits must survive, the other profile
// must be told, and a reload must bring them in.
//   node tests/studio-state-browser-test.mjs [dump.json] [--port 3100]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dumpFile = process.argv.find(a => a.endsWith('.json')) || '/home/ergo/codex_localstorage.json';
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 3100;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-e2e-')), stateFile = path.join(tmp, 'studio-state.json');
execFileSync('node', [path.join(repo, 'tools/studio-state/import.mjs'), dumpFile, stateFile, '--by', 'Codex'], { stdio: 'inherit' });
const dump = JSON.parse(fs.readFileSync(dumpFile, 'utf8')), shared = Object.keys(dump).filter(k => /^ergoflex/.test(k));
const server = spawn('node', [path.join(repo, 'tools/studio-server.mjs'), '--port', String(port), '--host', '127.0.0.1', '--state', stateFile], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => server.stdout.once('data', r));
const url = `http://127.0.0.1:${port}/`, api = () => fetch(url + 'api/studio-state').then(r => r.json());
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan', '--mute-audio'] });
let n = 0; const ok = s => { n++; console.log('ok', s); };
try {
  const open = async () => {
    const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e.message))); page.on('console', m => { if (/studio-state/.test(m.text())) errors.push(m.text()); });
    const t0 = Date.now(); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.ErgoFlex?.loadedModel || window.__studioState, { timeout: 120000 });
    return { page, errors, boot: Date.now() - t0 };
  };
  const A = await open(), B = await open(); let C = { errors: [] };
  for (const P of [A, B]) {
    const got = await P.page.evaluate(keys => keys.filter(k => localStorage.getItem(k) !== null).length, shared);
    assert.equal(got, shared.length);
  }
  const same = await A.page.evaluate((k, v) => localStorage.getItem(k) === v, 'ergoflex.sceneAssets.v1', dump['ergoflex.sceneAssets.v1']);
  ok(`both profiles boot with all ${shared.length} shared keys (DOM ready in ${A.boot} / ${B.boot} ms); sceneAssets byte-identical: ${same}`);
  await new Promise(r => setTimeout(r, 4000));   // let the app's own boot writes settle and flush
  const editRoom = (page, room, mark) => page.evaluate((room, mark) => {
    const v = JSON.parse(localStorage.getItem('ergoflex.sceneAssets.v1')); v[room] = { ...v[room], __test: mark };
    localStorage.setItem('ergoflex.sceneAssets.v1', JSON.stringify(v)); localStorage.setItem('flutter.testToken', 'secret');
    return window.__studioState.flush();
  }, room, mark);
  await editRoom(A.page, 'home:apartment', 'A'); await editRoom(B.page, 'gaming:executive', 'B');   // B's copy predates A's edit
  const s = await api(), rooms = JSON.parse(s.values['ergoflex.sceneAssets.v1']);
  assert.equal(rooms['home:apartment'].__test, 'A'); assert.equal(rooms['gaming:executive'].__test, 'B');
  assert.ok(!Object.keys(s.values).some(k => k.startsWith('flutter')));
  ok('A edits home, B (stale) edits gaming: the server keeps both; flutter.* never leaves the browser');
  await A.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /shared edit/.test(b.textContent)), { timeout: 12000 });
  const badge = await A.page.evaluate(() => [...document.querySelectorAll('button')].find(b => /shared edit/.test(b.textContent)).textContent);
  ok('A is told: "' + badge + '"');
  // A fresh profile (as after "Reload") boots with both edits. (Reloading A itself would let the
  // app re-save its in-memory copy of the room this test edited behind its back.)
  C = await open();
  const after = await C.page.evaluate(() => { const v = JSON.parse(localStorage.getItem('ergoflex.sceneAssets.v1')); return [v['home:apartment'].__test, v['gaming:executive'].__test]; });
  assert.deepEqual(after, ['A', 'B']); ok('a fresh profile boots with both edits');
  const errs = [...A.errors, ...B.errors, ...C.errors].filter(e => /studio-state|__studio/.test(e));
  assert.deepEqual(errs, []); ok('no studio-state errors in the pages (other page errors: ' + [...new Set([...A.errors, ...B.errors, ...C.errors])].length + ')');
  const boots = await api(); console.log('keys the app itself rewrote at boot:', Object.entries(JSON.parse(fs.readFileSync(stateFile, 'utf8')).keys).filter(([, r]) => r.client !== 'import').map(([k]) => k).join(', ') || 'none', '| rev', boots.rev);
} finally { await browser.close(); server.kill('SIGTERM'); await new Promise(r => setTimeout(r, 400)); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`${n} checks passed`);
