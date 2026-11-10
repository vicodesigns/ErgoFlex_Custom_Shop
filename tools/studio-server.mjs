#!/usr/bin/env node
// Custom Shop dev server with one shared studio state for every browser.
// Replaces live-server: same static files, same live reload, plus
//   GET  /api/studio-state            {rev, values:{key: raw localStorage string}}
//   GET  /api/studio-state/changes?since=REV&client=ID   keys others changed since REV
//   POST /api/studio-state            {client, by, changes:[{key, value, base} | {key, deleted:true}]}
// backed by studio-state.json (committed, so agents see each other's edits).
// Pages get /__studio/sync.js injected first in <head> (pulls the state into
// localStorage before the app reads it, pushes ergoflex* writes back) and the
// reload client before </body>.
//
//   node tools/studio-server.mjs [--port 3000] [--host ::] [--state studio-state.json] [--root DIR]
//
// Reload ignores (absolute paths): exports/, node_modules/, .git/, assets/props/,
// models/, scene-shots/ and the state file, so renders and saves never reload pages.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import send from 'send';
import { execFile } from 'node:child_process';
import chokidar from 'chokidar';
import { SPECS, SHARED_KEY, mergeWrite, changedEntries } from './studio-state/merge.mjs';
import { load, write } from './studio-state/file.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const root = path.resolve(arg('root', path.join(here, '..')));   // --root: tests serve a scratch tree
const port = Number(arg('port', 3000)), host = arg('host', '::');
const stateFile = path.resolve(root, arg('state', 'studio-state.json'));

// ---------- state ----------
const state = load(stateFile);
let saveTimer = null;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = null; write(stateFile, state); }, 300); };
const flushSave = () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; write(stateFile, state); } };
process.on('SIGINT', () => { flushSave(); process.exit(0); });
process.on('SIGTERM', () => { flushSave(); process.exit(0); });

function applyChange(change, client, by) {
  const { key } = change;
  if (typeof key !== 'string' || !SHARED_KEY.test(key)) return { key, skipped: 'not an ergoflex key' };
  const now = Date.now(), rec = state.keys[key];
  state.rev++;
  if (change.deleted) { state.keys[key] = { rev: state.rev, ts: now, by, client, deleted: true }; return { key }; }
  if (typeof change.value !== 'string') return { key, skipped: 'value must be a string' };
  const stored = rec && !rec.deleted ? rec.value : null, base = typeof change.base === 'string' ? change.base : null;
  const m = mergeWrite(key, stored, change.value, base);
  const next = { rev: state.rev, ts: now, by, client, value: m.value };
  if (SPECS[key] && !SPECS[key].ring) {
    const entries = { ...(rec?.entries || {}) };
    const diff = m.changed === null ? changedEntries(key, base ?? stored, change.value) : { changed: m.changed, removed: m.removed };
    for (const id of diff.changed) entries[id] = { rev: state.rev, ts: now, by };
    for (const id of diff.removed) delete entries[id];
    next.entries = entries;
  }
  state.keys[key] = next;
  return { key, merged: m.merged, error: m.error };
}

// ---------- HTTP ----------
const json = (res, code, body) => { const s = JSON.stringify(body); res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(s); };
const readBody = (req, limit = 64 << 20) => new Promise((ok, fail) => {
  const parts = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > limit) { fail(Error('body too large')); req.destroy(); } else parts.push(c); });
  req.on('end', () => ok(Buffer.concat(parts).toString('utf8'))); req.on('error', fail);
});
const clients = new Set(), peopleBuilds = new Map();
const CLIENT_JS = fs.readFileSync(path.join(here, 'studio-state/sync.js'), 'utf8');
const RELOAD_JS = `(()=>{const es=new EventSource('/__studio/events');es.onmessage=e=>{if(e.data==='css'){for(const l of document.querySelectorAll('link[rel=stylesheet]')){const u=new URL(l.href);u.searchParams.set('_r',Date.now());l.href=u.href;}}else if(e.data==='reload')location.reload();};})();`;

async function handle(req, res) {
  const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
  if (p === '/api/studio-state' && req.method === 'GET') {
    const values = {}; for (const [k, r] of Object.entries(state.keys)) if (!r.deleted) values[k] = r.value;
    const deleted = Object.entries(state.keys).filter(([, r]) => r.deleted).map(([k]) => k);
    return json(res, 200, { rev: state.rev, values, deleted });
  }
  if (p === '/api/studio-state/changes' && req.method === 'GET') {
    const since = Number(url.searchParams.get('since')) || 0, me = url.searchParams.get('client');
    const keys = Object.entries(state.keys).filter(([, r]) => r.rev > since && r.client !== me).map(([key, r]) => ({ key, rev: r.rev, ts: r.ts, by: r.by }));
    return json(res, 200, { rev: state.rev, keys });
  }
  if (p === '/api/studio-state' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { error: String(e.message) }); }
    const by = String(body.by || 'unknown').slice(0, 40), client = String(body.client || '').slice(0, 64);
    const results = (Array.isArray(body.changes) ? body.changes : []).map(c => applyChange(c, client, by));
    save();
    return json(res, 200, { rev: state.rev, results });
  }
  // People built on request (the Director's People tab): a character in a posture nobody has built yet.
  //   POST /__people/build?id=people-<character>-<posture>   -> { id, built }   (tools/people/build.py, then a thumbnail)
  // Only from this machine, only ids the cast knows; one build at a time per id. Writes assets/props only (not watched).
  if (p === '/__people/build' && req.method === 'POST') {
    const id = url.searchParams.get('id') || '', local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (!local) return json(res, 403, { error: 'People are built from the desk machine only.' });
    if (!/^people-[a-z]{2,20}-[a-z][a-z0-9_.-]{1,50}$/.test(id)) return json(res, 400, { error: 'Not a people model id.' });
    const glb = path.join(root, 'assets/props', id + '.glb'), had = fs.existsSync(glb);
    if (!had) {
      if (!peopleBuilds.has(id)) peopleBuilds.set(id, new Promise((ok, fail) => execFile('python3', [path.join(root, 'tools/people/build.py'), id, '--jobs', '1', '--no-manifest'], { cwd: root, timeout: 180000, maxBuffer: 8 << 20 },
        (error, out, err) => error ? fail(Error((out + err).split('\n').filter(Boolean).slice(-3).join(' ') || error.message)) : ok()))
        .then(() => new Promise(ok => execFile('node', [path.join(root, 'tools/props/thumbnails.mjs'), '--only', id], { cwd: root, timeout: 120000 }, () => ok())))
        .finally(() => peopleBuilds.delete(id)));
      try { await peopleBuilds.get(id); } catch (e) { return json(res, 500, { error: String(e.message).slice(0, 400) }); }
    }
    return json(res, 200, { id, built: !had });
  }
  if (p === '/__studio/sync.js') { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); return res.end(CLIENT_JS); }
  if (p === '/__studio/reload.js') { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); return res.end(RELOAD_JS); }
  if (p === '/__studio/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' }); res.write(': hi\n\n');
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  // HTML pages get the sync and reload scripts; everything else is plain static (with Range).
  let file = path.join(root, p);
  if (!file.startsWith(root + path.sep) && file !== root) { res.statusCode = 403; return res.end(); }
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  if (file.endsWith('.html') && fs.existsSync(file) && fs.statSync(file).isFile()) {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/<head[^>]*>/i, m => m + '\n<script src="/__studio/sync.js"></script>');
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, '<script src="/__studio/reload.js"></script>\n</body>') : html + '<script src="/__studio/reload.js"></script>';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(html);
  }
  if (/\.(m?js|cjs|json|css)$/i.test(p)) res.setHeader('cache-control', 'no-store');
  send(req, p, { root, index: ['index.html'], dotfiles: 'deny' })
    .on('error', e => { res.statusCode = e.status || 500; res.end(); })
    .on('directory', () => { res.statusCode = 301; res.setHeader('location', p + '/'); res.end(); })
    .pipe(res);
}

// ---------- live reload ----------
const IGNORED = ['exports', 'node_modules', '.git', 'assets/props', 'models', 'scene-shots'].map(d => path.join(root, d));
const ignored = f => { const a = path.resolve(f); return a === stateFile || a === stateFile + '.tmp' || IGNORED.some(d => a === d || a.startsWith(d + path.sep)); };
let reloadTimer = null, pendingCss = true;
// --no-watch: no live reload (tests: each watching server takes thousands of the machine's file watches, and a
// server that cannot get one dies with ENOSPC).
if (!process.argv.includes('--no-watch')) chokidar.watch(root, { ignored, ignoreInitial: true }).on('error', e => console.error('[studio server] live reload is off:', e.message)).on('all', (event, f) => {
  if (ignored(f)) return;
  pendingCss = pendingCss && f.endsWith('.css');
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { const msg = pendingCss ? 'css' : 'reload'; pendingCss = true; for (const c of clients) c.write(`data: ${msg}\n\n`); }, 500);
});

http.createServer((req, res) => handle(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, 500, { error: String(e.message) }); }))
  .listen(port, host, () => console.log(`studio server http://localhost:${port} → ${root} (state ${path.relative(root, stateFile)}, rev ${state.rev})`));
