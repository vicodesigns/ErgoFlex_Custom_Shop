// The shortcut panel (press ?, F1 or Ctrl+Alt+K): every key and mouse gesture of the Director, generated from the
// action table (director-actions.mjs), docked as a drawer on the right so it can stay open while you work.
//   "Active now" at the top follows the selection (and pose mode, the still view…); a search filters by name or key;
// clicking a row runs it; a key you press flashes its row. The first time it opens after the 17 Nov 2026 change it
// starts with "Keys that changed".
import {ACTIONS, CHANGED, SECTIONS, ALWAYS, LIVE_PHASES, capsOf, keyText} from './director-actions.mjs';
const STORE = 'ergoflex.director.ui.v1';
export const loadUi = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } };
export const saveUi = patch => { try { localStorage.setItem(STORE, JSON.stringify({ ...loadUi(), ...patch })); } catch {} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const caps = spec => `<span class="kp-combo">${capsOf(spec).map(c => `<kbd>${esc(c)}</kbd>`).join('<i>+</i>')}</span>`;
const TITLE = Object.fromEntries(SECTIONS);

export function createKeysPanel({ run, active = () => new Set(), why = () => null }) {
  const el = document.createElement('aside');
  el.id = 'director-keys'; el.className = 'keys-panel'; el.hidden = true; el.setAttribute('aria-label', 'Keyboard and mouse shortcuts');
  el.innerHTML = `<header><b>Keys &amp; mouse</b><input type="search" placeholder="Find an action or a key" aria-label="Find an action or a key" data-kp-find><button type="button" data-kp-close title="Close (Esc)" aria-label="Close">×</button></header><div class="kp-body" data-kp-body></div><footer>Adobe keys on the timeline · Rhino in the 3D view · Ctrl also means Cmd</footer>`;
  document.body.append(el);
  const body = el.querySelector('[data-kp-body]'), find = el.querySelector('[data-kp-find]');
  let query = '';

  function rowHtml(r, live) {
    const keys = r.owner === 'gesture' ? `<span class="kp-gesture">${esc(r.gesture)}</span>` : r.keys.map(caps).join('<em>or</em>');
    const runnable = r.owner === 'director' && live, reason = live ? null : r.owner === 'gesture' ? null : 'Select ' + (TITLE[r.ctx] || r.ctx).toLowerCase() + ' first';
    const tag = r.origin && r.origin !== 'Director' ? `<small class="kp-origin" title="Same as ${esc(r.origin)}">${esc(r.origin)}</small>` : '';
    const attrs = `class="kp-row${live ? ' kp-live' : ''}" data-kp-row="${esc(r.id)}" data-kp-ctx="${esc(r.ctx)}"${reason ? ` title="${esc(reason)}"` : ''}`;
    return runnable ? `<button type="button" ${attrs}><span class="kp-keys">${keys}</span><span class="kp-label">${esc(r.label)}</span>${tag}</button>`
      : `<div ${attrs}><span class="kp-keys">${keys}</span><span class="kp-label">${esc(r.label)}</span>${tag}</div>`;
  }
  const matches = r => !query || (r.label + ' ' + (r.gesture || '') + ' ' + r.keys.map(keyText).join(' ') + ' ' + (r.origin || '')).toLowerCase().includes(query);
  function section(id, title, live, cls = '') {
    const rows = ACTIONS.filter(r => r.ctx === id && LIVE_PHASES.has(r.phase) && matches(r));
    return rows.length ? `<section class="kp-sec ${cls}" data-kp-sec="${id}"><h4>${live && !ALWAYS.has(id) ? '● ' : ''}${esc(title)}</h4>${rows.map(r => rowHtml(r, live)).join('')}</section>` : '';
  }
  function changedHtml(open) {
    const rows = CHANGED.filter(c => !query || (c.now + c.was + (c.spec || c.gesture)).toLowerCase().includes(query));
    if (!rows.length) return '';
    return `<details class="kp-sec kp-changed" ${open ? 'open' : ''}><summary>Keys that changed (17 Nov 2026)</summary>${rows.map(c => `<div class="kp-row"><span class="kp-keys">${c.spec ? caps(c.spec) : `<span class="kp-gesture">${esc(c.gesture)}</span>`}</span><span class="kp-label">${esc(c.now)}<small> Was: ${esc(c.was)}</small></span></div>`).join('')}</details>`;
  }
  function render() {
    const live = active(), ui = loadUi(), first = !ui.keysChangedSeen;
    const items = SECTIONS.filter(([id]) => !ALWAYS.has(id) && live.has(id)), rest = SECTIONS.filter(([id]) => !ALWAYS.has(id) && !live.has(id) && id !== 'keys-panel');
    body.innerHTML = changedHtml(first)
      + (items.length ? `<p class="kp-note">Active now: the keys for what you have selected.</p>` + items.map(([id, t]) => section(id, t, true, 'kp-active')).join('') : `<p class="kp-note">Select something (a view, a move, a title, a prop, a person…) and its own keys show up here first.</p>`)
      + SECTIONS.filter(([id]) => ALWAYS.has(id)).map(([id, t]) => section(id, t, true)).join('')
      + `<p class="kp-note">Keys for items: they work once the item is selected.</p>` + rest.map(([id, t]) => section(id, t, false, 'kp-idle')).join('');
    if (first) saveUi({ keysChangedSeen: new Date().toISOString().slice(0, 10) });
  }
  function open() { if (!el.hidden) return; render(); el.hidden = false; document.body.classList.add('keys-open'); }
  function close() { el.hidden = true; document.body.classList.remove('keys-open'); }
  function toggle() { if (el.hidden) open(); else close(); }
  el.addEventListener('click', ev => {
    if (ev.target.closest('[data-kp-close]')) { close(); return; }
    const b = ev.target.closest('button[data-kp-row]'); if (!b) return;
    run(b.dataset.kpRow, b.dataset.kpCtx); b.blur();
  });
  find.addEventListener('input', () => { query = find.value.trim().toLowerCase(); render(); });
  find.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); if (find.value) { find.value = ''; query = ''; render(); } else close(); } });
  // a key that ran something: light up its row for a moment
  function flash(id) {
    if (el.hidden) return;
    for (const r of el.querySelectorAll(`[data-kp-row="${CSS.escape(id)}"]`)) { r.classList.remove('kp-flash'); void r.offsetWidth; r.classList.add('kp-flash'); }
  }
  // the selection changed while it is open: redraw "Active now"
  let last = '';
  function refresh() { if (el.hidden) return; const sig = [...active()].sort().join(','); if (sig !== last) { last = sig; render(); } }
  return { open, close, toggle, flash, refresh, isOpen: () => !el.hidden, element: el };
}
