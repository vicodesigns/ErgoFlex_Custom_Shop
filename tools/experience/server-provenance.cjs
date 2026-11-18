// Which checkout the render server serves (18 Nov 2026). render-still.cjs / render-cut.cjs load the stage from --server
// (default :3017), and render-server.cjs serves the directory it was started from, whatever checkout the render script runs
// from, while the script's "[provenance] git" line names its own. A server left running from another checkout (main) once
// made a branch's Commons Classic look come out as no look at all. This compares a few files the stage runs, as the
// server sends them, with this checkout's (line ends dropped on both sides: a Windows checkout with core.autocrlf has CRLF
// files) and prints one [provenance] line. It never stops a render.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
// the room / stage / film code a render draws with (each one a file a branch is likely to touch)
const FILES = ['room-looks.mjs', 'studio.js', 'workspace-3d.mjs', 'experience/stage.mjs', 'tools/experience/film-fx.mjs', 'tools/experience/film-edits.mjs', 'tools/experience/film-quality.mjs'];
const digest = text => crypto.createHash('sha1').update(text.replace(/\r/g, '')).digest('hex');
const fetchText = url => new Promise((resolve, reject) => {
  const req = http.get(url, { headers: { 'cache-control': 'no-cache' } }, res => { let body = ''; res.setEncoding('utf8'); res.on('data', d => body += d); res.on('end', () => resolve({ status: res.statusCode, body })); });
  req.on('error', reject); req.setTimeout(10000, () => req.destroy(Error('timed out')));
});
// { checked, differ: [files whose text differs or the server lacks], skipped: [files this checkout lacks] }
async function checkServer(server, root, { files = FILES } = {}) {
  const out = { checked: 0, differ: [], skipped: [] };
  for (const f of files) {
    let local; try { local = fs.readFileSync(path.join(root, f), 'utf8'); } catch { out.skipped.push(f); continue; }
    const got = await fetchText(server.replace(/\/+$/, '') + '/' + f); out.checked++;
    if (got.status !== 200 || digest(got.body) !== digest(local)) out.differ.push(f + (got.status !== 200 ? ` (HTTP ${got.status})` : ''));
  }
  return out;
}
function describe(result, server, root) {
  if (!result.checked) return `[provenance] server ${server}: nothing to compare`;
  if (!result.differ.length) return `[provenance] server ${server} serves this checkout (${result.checked} files match)`;
  return `[provenance] WARNING: server ${server} serves a different checkout: ${result.differ.join(', ')} differ from ${root}. Start render-server.cjs from this checkout (or pass --server for one that is).`;
}
// for the render scripts: one line, never throws
async function report(server, root, log = console.log) {
  try { const r = await checkServer(server, root); log(describe(r, server, root)); return r; }
  catch (error) { log(`[provenance] server ${server}: could not compare (${error.message})`); return null; }
}
module.exports = { FILES, checkServer, describe, report };
