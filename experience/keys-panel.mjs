// The shortcut panel (press ?, F1 or Ctrl+Alt+K): every key and mouse gesture of the Director, generated from the
// action table (director-actions.mjs), docked as a drawer on the right so it can stay open while you work.
//   List: "Active now" at the top follows the selection (and pose mode, the still view…); a search filters by name
// or key; clicking a row runs it; a key you press flashes its row. The first time it opens after the 17 Nov 2026
// change it starts with "Keys that changed".
//   Keyboard (Premiere's keyboard view): the keyboard drawn, each key showing what it does right now; hold Shift,
// Ctrl or Alt (or click them) to see those layers; click a key to run it.
//   Edit keys: click an action's key, press the new one (a key the browser keeps, or one already taken, is refused and
// says by what); ↺ puts one back, Reset all puts every key back. Kept in this browser (ui store `keys`).
import {ACTIONS,CHANGED,SECTIONS,ALWAYS,LIVE_PHASES,capsOf,keyText,specOf,rebind} from './director-actions.mjs';
const STORE = 'ergoflex.director.ui.v1';
export const loadUi = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } };
export const saveUi = patch => { try { localStorage.setItem(STORE, JSON.stringify({ ...loadUi(), ...patch })); } catch {} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const caps = spec => `<span class="kp-combo">${capsOf(spec).map(c => `<kbd>${esc(c)}</kbd>`).join('<i>+</i>')}</span>`;
const TITLE = Object.fromEntries(SECTIONS);
// A US keyboard: [code, label, key, shifted key, width]
const KB = [
  [['Escape', 'Esc', 'Escape'], ['F1', 'F1', 'F1'], ['F2', 'F2', 'F2'], ['F3', 'F3', 'F3'], ['F4', 'F4', 'F4'], ['F5', 'F5', 'F5'], ['F6', 'F6', 'F6'], ['F7', 'F7', 'F7'], ['F8', 'F8', 'F8'], ['F9', 'F9', 'F9'], ['F10', 'F10', 'F10'], ['F11', 'F11', 'F11'], ['F12', 'F12', 'F12']],
  [['Backquote', '`', '`', '~'], ...'1234567890'.split('').map((d, i) => ['Digit' + d, d, d, '!@#$%^&*()'[i]]), ['Minus', '-', '-', '_'], ['Equal', '=', '=', '+'], ['Backspace', '⌫', 'Backspace', null, 1.6]],
  [['Tab', 'Tab', 'Tab', null, 1.4], ...'QWERTYUIOP'.split('').map(l => ['Key' + l, l, l.toLowerCase(), l]), ['BracketLeft', '[', '[', '{'], ['BracketRight', ']', ']', '}'], ['Backslash', '\\', '\\', '|', 1.2]],
  [['CapsLock', 'Caps', null, null, 1.7], ...'ASDFGHJKL'.split('').map(l => ['Key' + l, l, l.toLowerCase(), l]), ['Semicolon', ';', ';', ':'], ['Quote', "'", "'", '"'], ['Enter', 'Enter', 'Enter', null, 1.9]],
  [['ShiftLeft', 'Shift', null, null, 2.2], ...'ZXCVBNM'.split('').map(l => ['Key' + l, l, l.toLowerCase(), l]), ['Comma', ',', ',', '<'], ['Period', '.', '.', '>'], ['Slash', '/', '/', '?'], ['ArrowUp', '↑', 'ArrowUp'], ['Delete', 'Del', 'Delete']],
  [['ControlLeft', 'Ctrl', null, null, 1.5], ['AltLeft', 'Alt', null, null, 1.3], ['Space', 'Space', ' ', ' ', 6], ['Home', 'Home', 'Home'], ['End', 'End', 'End'], ['PageUp', 'PgUp', 'PageUp'], ['PageDown', 'PgDn', 'PageDown'], ['ArrowLeft', '←', 'ArrowLeft'], ['ArrowDown', '↓', 'ArrowDown'], ['ArrowRight', '→', 'ArrowRight']],
];
const MODS = { ShiftLeft: 'shift', ControlLeft: 'ctrl', AltLeft: 'alt' };

export function createKeysPanel({ run, active = () => new Set(), table = () => ACTIONS, bindings = () => ({}), setBindings = () => {}, resolveAt = () => null }) {
  const el = document.createElement('aside');
  el.id = 'director-keys'; el.className = 'keys-panel'; el.hidden = true; el.setAttribute('aria-label', 'Keyboard and mouse shortcuts');
  el.innerHTML = `<header><b>Keys &amp; mouse</b><span class="kp-tabs" role="tablist"><button type="button" role="tab" data-kp-tab="list" aria-selected="true">List</button><button type="button" role="tab" data-kp-tab="keyboard" aria-selected="false">Keyboard</button></span><input type="search" placeholder="Find an action or a key" aria-label="Find an action or a key" data-kp-find><button type="button" data-kp-edit aria-pressed="false" title="Change keys: click an action's key, then press the new one">Edit keys</button><button type="button" data-kp-close title="Close (Esc)" aria-label="Close">×</button></header><div class="kp-body" data-kp-body></div><footer>Adobe keys on the timeline · Rhino in the 3D view · Ctrl also means Cmd · Ctrl+P: command search</footer>`;
  document.body.append(el);
  const body = el.querySelector('[data-kp-body]'), find = el.querySelector('[data-kp-find]');
  let query = '', tab = 'list', editing = false, capture = null, note = '', mods = { shift: false, ctrl: false, alt: false }, latched = { shift: false, ctrl: false, alt: false };

  function keysHtml(r) {
    if (r.owner === 'gesture') return `<span class="kp-gesture">${esc(r.gesture)}</span>`;
    if (editing && r.owner === 'director') {
      if (capture === r.id) return `<span class="kp-capture">Press a key… <small>Esc cancels · ⌫ clears</small></span>`;
      return `<button type="button" class="kp-bind" data-kp-bind="${esc(r.id)}" title="Click, then press the new key">${r.keys.length ? r.keys.map(caps).join('<em>or</em>') : '<em>no key</em>'}</button>${r.rebound ? `<button type="button" class="kp-unbind" data-kp-reset="${esc(r.id)}" title="Back to ${esc(ACTIONS.find(a => a.id === r.id)?.keys.map(keyText).join(' / ') || 'no key')}">↺</button>` : ''}`;
    }
    return r.keys.length ? r.keys.map(caps).join('<em>or</em>') : `<span class="kp-gesture">Ctrl+P: ${esc((r.aliases || []).slice(0, 2).join(', '))}</span>`;
  }
  function rowHtml(r, live) {
    const runnable = r.owner === 'director' && live && !editing, reason = live ? null : r.owner === 'gesture' ? null : 'Select ' + (TITLE[r.ctx] || r.ctx).toLowerCase() + ' first';
    const tag = r.origin && r.origin !== 'Director' ? `<small class="kp-origin" title="Same as ${esc(r.origin)}">${esc(r.origin)}</small>` : '';
    const attrs = `class="kp-row${live ? ' kp-live' : ''}${r.rebound ? ' kp-rebound' : ''}" data-kp-row="${esc(r.id)}" data-kp-ctx="${esc(r.ctx)}"${reason ? ` title="${esc(reason)}"` : ''}`;
    return runnable ? `<button type="button" ${attrs}><span class="kp-keys">${keysHtml(r)}</span><span class="kp-label">${esc(r.label)}</span>${tag}</button>`
      : `<div ${attrs}><span class="kp-keys">${keysHtml(r)}</span><span class="kp-label">${esc(r.label)}</span>${tag}</div>`;
  }
  const matches = r => !query || (r.label + ' ' + (r.gesture || '') + ' ' + r.keys.map(keyText).join(' ') + ' ' + (r.origin || '') + ' ' + (r.aliases || []).join(' ')).toLowerCase().includes(query);
  function section(id, title, live, cls = '') {
    const rows = table().filter(r => r.ctx === id && LIVE_PHASES.has(r.phase) && matches(r));
    return rows.length ? `<section class="kp-sec ${cls}" data-kp-sec="${id}"><h4>${live && !ALWAYS.has(id) ? '● ' : ''}${esc(title)}</h4>${rows.map(r => rowHtml(r, live)).join('')}</section>` : '';
  }
  function changedHtml(open) {
    const rows = CHANGED.filter(c => !query || (c.now + c.was + (c.spec || c.gesture)).toLowerCase().includes(query));
    if (!rows.length) return '';
    return `<details class="kp-sec kp-changed" ${open ? 'open' : ''}><summary>Keys that changed (17 Nov 2026)</summary>${rows.map(c => `<div class="kp-row"><span class="kp-keys">${c.spec ? caps(c.spec) : `<span class="kp-gesture">${esc(c.gesture)}</span>`}</span><span class="kp-label">${esc(c.now)}<small> Was: ${esc(c.was)}</small></span></div>`).join('')}</details>`;
  }
  function listHtml() {
    const live = active(), ui = loadUi(), first = !ui.keysChangedSeen;
    const items = SECTIONS.filter(([id]) => !ALWAYS.has(id) && live.has(id)), rest = SECTIONS.filter(([id]) => !ALWAYS.has(id) && !live.has(id) && id !== 'keys-panel');
    const own = Object.keys(bindings() || {}).length;
    const out = (editing ? `<p class="kp-note kp-edit-note">${note ? `<b>${esc(note)}</b> ` : ''}Click an action's key, then press the new one.${own ? ` <button type="button" data-kp-reset-all>Reset all ${own} to the defaults</button>` : ''}</p>` : changedHtml(first))
      + (items.length ? `<p class="kp-note">Active now: the keys for what you have selected.</p>` + items.map(([id, t]) => section(id, t, true, 'kp-active')).join('') : `<p class="kp-note">Select something (a view, a move, a title, a prop, a person…) and its own keys show up here first.</p>`)
      + SECTIONS.filter(([id]) => ALWAYS.has(id)).map(([id, t]) => section(id, t, true)).join('')
      + `<p class="kp-note">Keys for items: they work once the item is selected.</p>` + rest.map(([id, t]) => section(id, t, false, 'kp-idle')).join('');
    if (first && !editing) saveUi({ keysChangedSeen: new Date().toISOString().slice(0, 10) });
    return out;
  }
  // ---- the keyboard view: each key's row now, with the modifiers held or latched
  function keyboardHtml() {
    const m = { shift: mods.shift || latched.shift, ctrl: mods.ctrl || latched.ctrl, alt: mods.alt || latched.alt };
    const capHtml = ([code, label, key, shifted, w = 1]) => {
      const mod = MODS[code];
      if (mod) return `<button type="button" class="kb-key kb-mod" data-kb-mod="${mod}" aria-pressed="${m[mod]}" style="flex:${w}">${esc(label)}</button>`;
      if (!key) return `<span class="kb-key kb-none" style="flex:${w}">${esc(label)}</span>`;
      const ev = { code, key: m.shift && shifted ? shifted : key, shiftKey: m.shift, ctrlKey: m.ctrl, altKey: m.alt, metaKey: false };
      let row = null; try { row = resolveAt(ev); } catch {}
      const mine = row && row.owner === 'director', hit = row && (!query || matches(row));
      return `<button type="button" class="kb-key${row ? ' kb-' + row.ctx.replace(/[^a-z-]/g, '') : ''}${mine ? ' kb-run' : ''}${row && !hit ? ' kb-dim' : ''}" style="flex:${w}" ${mine ? `data-kb-run="${esc(row.id)}" data-kp-ctx="${esc(row.ctx)}"` : ''} title="${esc(row ? row.label + (row.owner === 'editor' ? ' (the editor handles it)' : '') : 'Nothing here now')}"><b>${esc(m.shift && shifted && shifted !== key && !/^Key/.test(code) ? shifted : label)}</b><small>${esc(row ? row.label.replace(/\s*\(.*$/, '') : '')}</small></button>`;
    };
    return `<p class="kp-note">What each key does now${m.shift || m.ctrl || m.alt ? ` with ${['ctrl', 'alt', 'shift'].filter(k => m[k]).map(k => k[0].toUpperCase() + k.slice(1)).join('+')}` : ''}, for what is selected. Hold Shift, Ctrl or Alt (or click them) for those layers; click a key to run it.</p>
      <div class="kb">${KB.map(r => `<div class="kb-row">${r.map(capHtml).join('')}</div>`).join('')}</div>
      <p class="kp-note kb-legend"><span class="kb-key kb-global">Everywhere</span><span class="kb-key kb-timeline">Timeline</span><span class="kb-key kb-view">3D view</span><span class="kb-key kb-item">Selected item / tool</span></p>`;
  }
  function render() {
    for (const b of el.querySelectorAll('[data-kp-tab]')) b.setAttribute('aria-selected', String(b.dataset.kpTab === tab));
    el.querySelector('[data-kp-edit]').setAttribute('aria-pressed', String(editing)); el.querySelector('[data-kp-edit]').hidden = tab !== 'list';
    el.classList.toggle('kp-keyboard', tab === 'keyboard');
    body.innerHTML = tab === 'keyboard' ? keyboardHtml() : listHtml();
  }
  function open() { if (!el.hidden) return; render(); el.hidden = false; document.body.classList.add('keys-open'); }
  function close() { el.hidden = true; editing = false; capture = null; note = ''; latched = { shift: false, ctrl: false, alt: false }; document.body.classList.remove('keys-open'); }
  function toggle() { if (el.hidden) open(); else close(); }
  el.addEventListener('click', ev => {
    if (ev.target.closest('[data-kp-close]')) { close(); return; }
    const t = ev.target.closest('[data-kp-tab]'); if (t) { tab = t.dataset.kpTab; capture = null; render(); return; }
    if (ev.target.closest('[data-kp-edit]')) { editing = !editing; capture = null; note = ''; render(); return; }
    const bind = ev.target.closest('[data-kp-bind]'); if (bind) { capture = bind.dataset.kpBind; note = ''; render(); return; }
    const reset = ev.target.closest('[data-kp-reset]'); if (reset) { setBindings(rebind(bindings(), reset.dataset.kpReset, null)); note = 'Put back.'; render(); return; }
    if (ev.target.closest('[data-kp-reset-all]')) { setBindings({}); note = 'Every key is back to the default.'; render(); return; }
    const mod = ev.target.closest('[data-kb-mod]'); if (mod) { latched[mod.dataset.kbMod] = !latched[mod.dataset.kbMod]; render(); return; }
    const kb = ev.target.closest('[data-kb-run]'); if (kb) { run(kb.dataset.kbRun, kb.dataset.kpCtx); kb.blur(); return; }
    const b = ev.target.closest('button[data-kp-row]'); if (!b) return;
    run(b.dataset.kpRow, b.dataset.kpCtx); b.blur();
  });
  find.addEventListener('input', () => { query = find.value.trim().toLowerCase(); render(); });
  find.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); if (find.value) { find.value = ''; query = ''; render(); } else close(); } });
  // a new key for the action being edited: taken here, before the Director's own keys (window, capture phase)
  addEventListener('keydown', ev => {
    if (el.hidden) return;
    if (capture) {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const id = capture, label = ACTIONS.find(a => a.id === id)?.label || id;
      if (ev.key === 'Escape') { capture = null; note = ''; render(); return; }
      if (ev.key === 'Backspace' && !ev.ctrlKey && !ev.altKey && !ev.shiftKey) { setBindings({ ...bindings(), [id]: [] }); capture = null; note = `“${label}” has no key now.`; render(); return; }
      const spec = specOf(ev); if (!spec) return;
      try { setBindings(rebind(bindings(), id, spec)); capture = null; note = `${keyText(spec)}: ${label}.`; } catch (e) { note = e.message + ' Press another key, or Esc.'; }
      render(); return;
    }
    if (tab === 'keyboard') { const m = { Shift: 'shift', Control: 'ctrl', Alt: 'alt', Meta: 'ctrl' }[ev.key]; if (m && !mods[m]) { mods[m] = true; render(); } }
  }, true);
  addEventListener('keyup', ev => { if (el.hidden || tab !== 'keyboard') return; const m = { Shift: 'shift', Control: 'ctrl', Alt: 'alt', Meta: 'ctrl' }[ev.key]; if (m && mods[m]) { mods[m] = false; render(); } }, true);
  addEventListener('blur', () => { if (mods.shift || mods.ctrl || mods.alt) { mods = { shift: false, ctrl: false, alt: false }; if (!el.hidden && tab === 'keyboard') render(); } });
  // a key that ran something: light up its row for a moment
  function flash(id) {
    if (el.hidden) return;
    for (const r of el.querySelectorAll(`[data-kp-row="${CSS.escape(id)}"],[data-kb-run="${CSS.escape(id)}"]`)) { r.classList.remove('kp-flash'); void r.offsetWidth; r.classList.add('kp-flash'); }
  }
  // the selection changed while it is open: redraw "Active now"
  let last = '';
  function refresh() { if (el.hidden || capture) return; const sig = [...active()].sort().join(',') + JSON.stringify(bindings()); if (sig !== last) { last = sig; render(); } }
  return { open, close, toggle, flash, refresh, isOpen: () => !el.hidden, editing: () => !!capture, element: el };
}
