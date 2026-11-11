// Shared studio state, browser side. tools/studio-server.mjs injects this as
// the first script in <head>, so it runs before the app reads localStorage:
//  1. pull: the shared state replaces this browser's ergoflex* keys (a
//     synchronous request on purpose: studio.js reads storage at import);
//  2. push: every ergoflex* setItem/removeItem goes to the server, debounced,
//     with the value this page had before (its base) so the server applies
//     only what this page changed;
//  3. other browsers' saves show a small "reload to see them" badge; the open
//     scene is never swapped underneath you.
// Only ergoflex* keys are shared (never flutter.* login/CSRF tokens).
(() => {
  const query = new URLSearchParams(location.search);
  if (query.get('presentation') === '1' && parent !== window) return;   // the stage keeps its writes in memory (session.js)
  const SHARED = /^ergoflex/, ls = window.localStorage, proto = Storage.prototype;
  const setItem = proto.setItem, removeItem = proto.removeItem, getItem = proto.getItem;
  let client = sessionStorage.getItem('__studioClient');
  if (!client) { client = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('__studioClient', client); }
  const ua = navigator.userAgent, by = /CodexBrowser/.test(ua) ? 'Codex' : /HeadlessChrome/.test(ua) ? 'agent browser' : /Chrome/.test(ua) ? 'Chrome' : 'browser';
  const base = new Map(), pending = new Map();
  let rev = 0, timer = null, inflight = Promise.resolve(), online = false;

  const schedule = (ms = 800) => { clearTimeout(timer); timer = setTimeout(flush, ms); };
  const queue = (key, value, before) => { const p = pending.get(key); pending.set(key, { key, value, base: p && 'base' in p ? p.base : before }); schedule(); };
  function flush() {
    clearTimeout(timer); if (!pending.size || !online) return inflight;
    const changes = [...pending.values()]; pending.clear();
    return inflight = inflight.then(() => fetch('/api/studio-state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client, by, changes }) }))
      .then(r => { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); })
      .catch(error => { console.warn('[studio-state] save failed, retrying in 5 s', error); for (const c of changes) if (!pending.has(c.key)) pending.set(c.key, c); schedule(5000); });
  }

  // 1. pull
  try {
    const x = new XMLHttpRequest(); x.open('GET', '/api/studio-state', false); x.send();
    if (x.status !== 200) throw Error('HTTP ' + x.status);
    const s = JSON.parse(x.responseText), gone = new Set(s.deleted || []);
    rev = s.rev; online = true;
    for (const [k, v] of Object.entries(s.values)) {
      if (getItem.call(ls, k) !== v) { try { setItem.call(ls, k, v); } catch (e) { console.warn('[studio-state] could not store', k, e); } }
      base.set(k, v);
    }
    for (const k of gone) removeItem.call(ls, k);
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (SHARED.test(k) && !base.has(k) && !gone.has(k)) { const v = getItem.call(ls, k); base.set(k, v); queue(k, v, null); } }
  } catch (error) { console.warn("[studio-state] shared state unavailable, using this browser's storage", error); }

  // 2. push
  proto.setItem = function (key, value) {
    setItem.call(this, key, value);
    if (this !== ls || !SHARED.test(key = String(key))) return;
    const v = String(value); if (base.get(key) === v) return;
    queue(key, v, base.has(key) ? base.get(key) : null); base.set(key, v);
  };
  proto.removeItem = function (key) {
    removeItem.call(this, key);
    if (this !== ls || !SHARED.test(key = String(key)) || !base.has(key)) return;
    base.delete(key); pending.set(key, { key, deleted: true }); schedule();
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);

  // 3. others' saves
  let badge = null;
  const show = keys => {
    if (!document.body) return;
    if (!badge) {
      badge = document.createElement('button'); badge.type = 'button';
      badge.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;font:13px/1.3 system-ui;padding:8px 12px;border-radius:8px;border:1px solid #63d8f5;background:#0c2230;color:#e6f1fa;cursor:pointer;box-shadow:0 4px 16px #0006';
      badge.onclick = () => flush().then(() => location.reload());
      document.body.append(badge);
    }
    const who = [...new Set(keys.map(k => k.by))].join(', ');
    badge.textContent = `${keys.length} shared edit${keys.length === 1 ? '' : 's'} from ${who} · Reload to see`;
  };
  // A page that can take others' saves without a reload (the Director: "Refresh from Studio") watches for them:
  // watch(fn) hands every poll's keys to fn, which returns the ones it did NOT take; only those get the reload badge.
  let watcher = null;
  if (online) setInterval(() => fetch(`/api/studio-state/changes?since=${rev}&client=${client}`).then(r => r.json()).then(r => {
    let keys = r.keys; if (watcher) { try { keys = watcher(keys) || []; } catch (e) { console.warn('[studio-state] watcher', e); } }
    if (keys.length) show(keys); else if (badge) { badge.remove(); badge = null; }
  }).catch(() => {}), 5000);
  // pull(only): read the shared state again into this page's storage, for the keys `only(key)` accepts. Nothing is
  // pushed back (the pulled value becomes the key's base). A key with an unsent local write is left alone.
  // -> { rev, changed: [{ key, before, after }] }   (after null: deleted for everyone)
  // It reuses the page's ordinary fetch: no extra connection is held open.
  async function pull(only = () => true) {
    await flush();
    const r = await fetch('/api/studio-state', { cache: 'no-store' }); if (!r.ok) throw Error('HTTP ' + r.status);
    const s = await r.json(), changed = [];
    for (const [k, v] of Object.entries(s.values)) {
      if (!SHARED.test(k) || !only(k) || pending.has(k)) continue;
      // Storage is shared by this browser's tabs: a value this page did not put there is another tab's newer save
      // (that tab sends it itself), so it is never replaced by the server's older one.
      const before = getItem.call(ls, k), mine = before === (base.has(k) ? base.get(k) : null);
      if (before !== v && mine) { try { setItem.call(ls, k, v); } catch (e) { console.warn('[studio-state] could not store', k, e); continue; } changed.push({ key: k, before, after: v }); }
      base.set(k, v);
    }
    for (const k of s.deleted || []) {
      if (!SHARED.test(k) || !only(k) || pending.has(k) || !base.has(k)) continue;
      const before = getItem.call(ls, k); removeItem.call(ls, k); base.delete(k); if (before !== null) changed.push({ key: k, before, after: null });
    }
    return { rev: s.rev, changed };
  }
  window.__studioState = { client, by, flush, pending, base, pull, watch(fn) { watcher = typeof fn === 'function' ? fn : null; }, get rev() { return rev; } };
})();
