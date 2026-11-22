// Send to desk: the Director's Export cut, from a phone, into the folder the desk's importer watches.
//   POST /__director/inbox   body: the Export cut JSON (schema 'ergoflex.client-cut', one film chapter)
//   headers: content-type: application/json, x-director-inbox: 1   (a custom header: a web page of another origin cannot
//   send it without a CORS preflight, which this server never answers, so only the Director's own page can post)
//   -> { file, cut, chapter, bytes }   the file is Film-chapter-<chapter id>-<YYYYMMDD-HHMMSS>.json in the importer's folder
// tools/experience/director-import-watch.py then imports it exactly as if Export cut had downloaded it there.
// Checks, in this order, nothing is written when one fails: the caller's address (this machine or the tailnet), the
// headers, the size (5 MB), the JSON, the schema and the one-chapter shape the importer needs, the cut id inside names a
// real cut (exports/<dir>/cut.json id, or the master $HQ), a rate limit.
//
// THE TOKEN (Vico, 22 Nov 2026: yes to a shared code): every send carries x-director-token, compared in constant time with
// the desk's token: $DIRECTOR_INBOX_TOKEN, else the file $DIRECTOR_INBOX_TOKEN_FILE, else ~/.config/ergoflex/director-inbox-token
// (outside git; read on every send, so a new token needs no restart). No token on the desk: every send is refused
// (503, fail closed). Make one on the desk:  node tools/director-inbox.mjs --new-token   (prints it, writes the file, mode 600)
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MAX_BYTES = 5 * 1024 * 1024;
export const SCHEMA = 'ergoflex.client-cut';
const PER_MINUTE = 20;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

// Loopback (a tailscale serve proxy arrives from here too), the tailnet's CGNAT range 100.64.0.0/10 and its IPv6 ULA fd7a:115c:a1e0::/48.
export function allowedAddress(addr) {
  const a = String(addr || '').replace(/^::ffff:/i, '').toLowerCase();
  if (a === '127.0.0.1' || a === '::1') return true;
  const m = a.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) return Number(m[1]) === 100 && Number(m[2]) >= 64 && Number(m[2]) <= 127;
  return a.startsWith('fd7a:115c:a1e0:');
}
// The importer's folder (director-import-watch.py DIRS[0]): $DIRECTOR_INBOX_DIR (tests), then the importer's own
// DIRECTOR_IMPORT_DIRS (first entry), then ~/Downloads of the user this server runs as.
export function inboxDir(env = process.env, home = os.homedir()) {
  const pick = env.DIRECTOR_INBOX_DIR || String(env.DIRECTOR_IMPORT_DIRS || '').split(path.delimiter).filter(Boolean)[0] || path.join(home, 'Downloads');
  return pick.startsWith('~') ? path.join(home, pick.slice(1)) : path.resolve(pick);
}
const pad = n => String(n).padStart(2, '0');
export const stamp = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// {cut folder (relative), chapter} for a parsed export, or throws Error(reason). Same rules as the importer's target().
export function target(d, root, hq = process.env.HQ || 'exports/cinematic-intro-20261104-hq14') {
  if (!d || typeof d !== 'object' || d.schema !== SCHEMA) throw Error('Not a Director cut export (schema ' + SCHEMA + ').');
  if (!Array.isArray(d.shots) || d.shots.length !== 1) throw Error('Send one film chapter at a time.');
  const chapter = d.shots[0]?.id, full = String(d.id || '');
  if (typeof chapter !== 'string' || !ID.test(chapter)) throw Error('The chapter has no usable id.');
  if (!/^film-[a-z0-9][a-z0-9-]*$/.test(full) || !full.endsWith('-' + chapter)) throw Error('Not a film chapter export (id ' + JSON.stringify(full.slice(0, 80)) + ').');
  const cutId = full.slice('film-'.length, -chapter.length - 1) || null;
  let folder = null;
  if (cutId === null) folder = hq;
  else {
    let names = []; try { names = fs.readdirSync(path.join(root, 'exports')); } catch { /* no exports */ }
    for (const n of names.sort()) {
      try { if (JSON.parse(fs.readFileSync(path.join(root, 'exports', n, 'cut.json'), 'utf8')).id === cutId) { folder = 'exports/' + n; break; } } catch { /* not a cut */ }
    }
  }
  if (!folder) throw Error('No film cut has the id ' + JSON.stringify(cutId) + '.');
  if (!fs.existsSync(path.join(root, folder, 'review-cut.json'))) throw Error('That cut has no review-cut.json.');
  return { folder, chapter, cutId };
}

// ---- the token
export const tokenFile = (env = process.env, home = os.homedir()) => env.DIRECTOR_INBOX_TOKEN_FILE || path.join(home, '.config', 'ergoflex', 'director-inbox-token');
export function deskToken(env = process.env, home = os.homedir()) {
  if (env.DIRECTOR_INBOX_TOKEN) return String(env.DIRECTOR_INBOX_TOKEN).trim() || null;
  try { return fs.readFileSync(tokenFile(env, home), 'utf8').trim() || null; } catch { return null; }
}
// A code a person types once on a phone: case, spaces and dashes do not matter. Constant time whatever the lengths: both
// sides hashed to 32 bytes first.
export const normToken = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function sameToken(given, want) {
  const a = normToken(given), b = normToken(want);
  if (!a || !b) return false;
  const h = v => crypto.createHash('sha256').update(v, 'utf8').digest();
  return crypto.timingSafeEqual(h(a), h(b));
}
// 16 characters from 31 that cannot be mistaken for each other (no 0 o 1 l i), about 79 bits, in groups of four
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const newToken = () => { const out = []; while (out.length < 16) { const b = crypto.randomBytes(1)[0]; if (b < 248) out.push(ALPHABET[b % 31]); } return out.join('').match(/.{4}/g).join('-'); };
export function writeToken(env = process.env, home = os.homedir()) {
  const file = tokenFile(env, home), token = newToken();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); fs.writeFileSync(file, token + '\n', { mode: 0o600 }); fs.chmodSync(file, 0o600);
  return { file, token };
}

const sent = [];   // times of accepted sends (the rate limit)
export function createInbox({ root, env = process.env }) {
  return async function handle(req, res, json) {
    const refuse = (code, error) => { json(res, code, { error }); return true; };
    if (req.method !== 'POST') return refuse(405, 'POST only.');
    if (!allowedAddress(req.socket.remoteAddress)) return refuse(403, 'Send to desk works from this machine or the tailnet only.');
    if (req.headers['x-director-inbox'] !== '1' || !/^application\/json\b/i.test(req.headers['content-type'] || '')) return refuse(400, 'Not from the Director (header).');
    const origin = req.headers.origin;
    if (origin) { let h = ''; try { h = new URL(origin).host; } catch { /* below */ } if (h !== req.headers.host) return refuse(403, 'Another origin.'); }
    const want = deskToken(env);
    if (!want) return refuse(503, 'Send to desk is not set up on the desk yet (no token there): run node tools/director-inbox.mjs --new-token on the desk.');
    if (!sameToken(String(req.headers['x-director-token'] || ''), want)) return refuse(401, 'Wrong or missing desk code.');
    const declared = Number(req.headers['content-length']);
    if (declared > MAX_BYTES) { res.setHeader('connection', 'close'); return refuse(413, 'Too large (5 MB at most).'); }
    let text;
    try {
      text = await new Promise((ok, fail) => {
        const parts = []; let n = 0, over = false;
        req.on('data', c => { n += c.length; if (n > MAX_BYTES) over = true; else if (!over) parts.push(c); });
        req.on('end', () => over ? fail(Object.assign(Error('Too large (5 MB at most).'), { code: 413 })) : ok(Buffer.concat(parts).toString('utf8')));
        req.on('error', fail);
      });
    } catch (e) { if (e.code === 413) { res.setHeader('connection', 'close'); return refuse(413, e.message); } return refuse(400, 'Could not read the body.'); }
    let data; try { data = JSON.parse(text); } catch { return refuse(400, 'Not JSON.'); }
    let t; try { t = target(data, root, env.HQ || undefined); } catch (e) { return refuse(400, e.message); }
    const named = req.headers['x-director-cut'];   // the cut folder the Director page names: the export must belong to it
    if (named && named !== t.folder) return refuse(400, 'That chapter belongs to ' + t.folder + ', not to ' + String(named).slice(0, 80) + '.');
    const now = Date.now(); while (sent.length && now - sent[0] > 60000) sent.shift();
    if (sent.length >= PER_MINUTE) return refuse(429, 'Too many sends: wait a minute.');
    const dir = inboxDir(env), base = `Film-chapter-${t.chapter.replace(/[^A-Za-z0-9_-]/g, '')}-${stamp()}`;
    let name = base + '.json';
    try {
      fs.mkdirSync(dir, { recursive: true });
      for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${base}-${i}.json`;
      const part = path.join(dir, '.' + name + '.part');   // (a leading dot: the importer's Film-chapter-*.json never sees it half written)
      fs.writeFileSync(part, text); fs.renameSync(part, path.join(dir, name));
    } catch (e) { return refuse(500, 'Could not write to the desk\'s folder: ' + String(e.message).slice(0, 120)); }
    sent.push(now);
    console.log('[studio server] Send to desk:', name, '->', dir, '(cut ' + t.folder + ', ' + Buffer.byteLength(text) + ' bytes)');
    json(res, 200, { file: name, cut: t.folder, chapter: t.chapter, bytes: Buffer.byteLength(text) });
    return true;
  };
}

// node tools/director-inbox.mjs --new-token   (on the desk: a new code for Send to desk; the old one stops working)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname) && process.argv[2] === '--new-token') {
  const { file, token } = writeToken();
  console.log(`Send to desk code: ${token}\n(written to ${file}; type it on the phone the first time you press Send to desk)`);
}
