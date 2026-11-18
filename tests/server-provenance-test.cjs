// tools/experience/server-provenance.cjs (18 Nov 2026): render-still.cjs / render-cut.cjs say when the render server serves
// another checkout than theirs. No browser:
//   1. render-server.cjs started from this checkout: "serves this checkout"
//   2. a server of a copy with CRLF line ends (a Windows core.autocrlf checkout): still this checkout (no false alarm)
//   3. a copy where one file differs and one is missing: "serves a different checkout", naming both
//   4. no server: one line, no throw; both render scripts call it and never stop on it
//   node tests/server-provenance-test.cjs
const assert = require('assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), net = require('net'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const { FILES, checkServer, describe, report } = require('../tools/experience/server-provenance.cjs');
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
// a plain static server of a directory
const serve = dir => new Promise(r => { const s = http.createServer((req, res) => { const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)); fs.readFile(f, (e, b) => { if (e) { res.statusCode = 404; res.end(); } else res.end(b); }); }).listen(0, '127.0.0.1', () => r(s)); });
(async () => {
  for (const f of FILES) assert(fs.existsSync(path.join(root, f)), 'this checkout has ' + f);
  // 1. the real render server from this checkout
  const port = await freePort(), server = spawn(process.execPath, [path.join(root, 'tools/experience/render-server.cjs'), String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { const t = setTimeout(() => reject(Error('render server did not start')), 20000); server.stdout.on('data', d => { if (/render server/.test(d)) { clearTimeout(t); resolve(); } }); server.once('exit', c => reject(Error('exited ' + c))); });
    const base = `http://127.0.0.1:${port}`, r = await checkServer(base, root);
    assert.deepEqual(r.differ, [], 'render-server.cjs from this checkout serves it');
    assert.equal(r.checked, FILES.length);
    assert.match(describe(r, base, root), /serves this checkout \(\d+ files match\)/);
  } finally { server.kill(); }
  // copies of the compared files
  const copy = edit => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'server-provenance-')); for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), edit(f, fs.readFileSync(path.join(root, f), 'utf8'))); } return d; };
  const dirs = [];
  try {
    // 2. CRLF: the same checkout
    const crlf = copy((f, t) => t.replace(/\r?\n/g, '\r\n')); dirs.push(crlf);
    let s = await serve(crlf); try { const r = await checkServer(`http://127.0.0.1:${s.address().port}`, root); assert.deepEqual(r.differ, [], 'CRLF vs LF is the same checkout'); } finally { s.close(); }
    // ... and the other way round (this checkout's files read as CRLF, the server's LF)
    const crlfRoot = copy((f, t) => t.replace(/\r?\n/g, '\r\n')), lf = copy((f, t) => t.replace(/\r/g, '')); dirs.push(crlfRoot, lf);
    s = await serve(lf); try { const r = await checkServer(`http://127.0.0.1:${s.address().port}`, crlfRoot); assert.deepEqual(r.differ, []); } finally { s.close(); }
    // 3. another checkout: room-looks.mjs without the Commons looks, film-quality.mjs not there
    const other = copy((f, t) => f === 'room-looks.mjs' ? t.replace(/'library\/humboldt'|creative:/, 'other:') : t); dirs.push(other); fs.rmSync(path.join(other, 'tools/experience/film-quality.mjs'));
    s = await serve(other);
    try {
      const base = `http://127.0.0.1:${s.address().port}`, r = await checkServer(base, root);
      assert.deepEqual(r.differ, ['room-looks.mjs', 'tools/experience/film-quality.mjs (HTTP 404)']);
      const line = describe(r, base, root);
      assert.match(line, /^\[provenance\] WARNING: server http:\/\/127\.0\.0\.1:\d+ serves a different checkout: room-looks\.mjs, tools\/experience\/film-quality\.mjs \(HTTP 404\) differ from /);
      const lines = []; await report(base, root, l => lines.push(l)); assert.equal(lines.length, 1); assert.equal(lines[0], line);
    } finally { s.close(); }
    // a file this checkout lacks is skipped, not reported
    const r = await checkServer('http://127.0.0.1:1', root, { files: ['no-such-file.mjs'] }); assert.deepEqual(r, { checked: 0, differ: [], skipped: ['no-such-file.mjs'] });
  } finally { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); }
  // 4. no server: one line, no throw
  const lines = []; const r = await report(`http://127.0.0.1:${await freePort()}`, root, l => lines.push(l));
  assert.equal(r, null); assert.equal(lines.length, 1); assert.match(lines[0], /could not compare/);
  for (const f of ['render-still.cjs', 'render-cut.cjs']) {
    const src = fs.readFileSync(path.join(root, 'tools/experience', f), 'utf8');
    assert.match(src, /try\{await require\('\.\/server-provenance\.cjs'\)\.report\(opts\.server,path\.resolve\(__dirname,'\.\.','\.\.'\)\);\}catch\(error\)\{console\.log\('\[provenance\] server check skipped: '\+error\.message\);\}/, f + ' reports the server and never stops on it');
  }
  console.log('server-provenance-test: ok (this checkout\'s render server matches, CRLF is no alarm, another checkout is named file by file, no server is one line)');
})().catch(e => { console.error(e); process.exit(1); });
