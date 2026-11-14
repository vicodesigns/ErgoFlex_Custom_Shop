// Studio Layers panel (show / hide), phase 2: the DOM and the scene side. Every decision is in studio-layers-model.mjs
// (pure, tested in node); the data model is scene-layers.mjs. studio.js creates this once (initStudioLayers, inside a
// try/catch) with a context of small getters, and calls it from four guarded hooks: hydration (keeps / hydrated),
// Delete (hideForDelete), undo (applyUndo) and the tools-row button. Never in a presentation frame (the Director stage,
// film renders): studio.js does not create it there, so the film sees exactly what it saw before.
// This module imports no three.js (ctx.THREE) and touches no DOM until mount(), so node can import it.
import { LAYERS_KEY, GROUPS, buildRows, filterRows, groupRows, hiddenCount, scopeChoices, defaultScope, cellFor, settingLine, changeFor, applySide,
  showAllChange, SHOW_ALL_CONFIRM, showAllConfirmText, deletePlan, deleteToastPlan, visibilityOf, entryKind, kindOf, listable,
  sheetNext, createPress, scopeSheetModel, rowTapPlan, deskVisibility, personOut, eyeLocked } from './studio-layers-model.mjs';
import { cleanLayers, migrateRoom, entryKey, validRoom } from './scene-layers.mjs';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = { desk: '▬', person: '☺', furniture: '▣', wall: '▤', fixture: '◫', light: '✦', 'desk-item': '▭', added: '＋', missing: '?' };
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2.4"/></svg>';
const PHONE = '(max-width: 760px)';

// ---- the sticky hide: room life, day kits and people set `visible` back every frame; while hidden the getter says
// false and the setter only remembers what they asked for (the trick tools/experience/film-edits.mjs uses).
const restore = new WeakMap();
export function setLayersHidden(obj, on) {
  if (!obj) return false;
  const now = restore.has(obj);
  if (!!on === now) return false;
  if (on) {
    const own = Object.getOwnPropertyDescriptor(obj, 'visible'); let raw = obj.visible;
    Object.defineProperty(obj, 'visible', { configurable: true, enumerable: true, get: () => false, set: v => { raw = v; own?.set?.call(obj, v); } });
    restore.set(obj, () => { delete obj.visible; if (own && (own.get || own.set)) Object.defineProperty(obj, 'visible', own); else obj.visible = raw; });
    if (obj.userData) obj.userData.layersHidden = true;
  } else {
    restore.get(obj)(); restore.delete(obj);
    if (obj.userData) delete obj.userData.layersHidden;
  }
  return true;
}
export const isLayersHidden = obj => restore.has(obj);

// ctx: {THREE, scene(), roomKey(), phase(), size(), phaseLabels(), items(), assetState(), readRaw(key), writeRaw(key, v),
//       transaction(entry), notify(text), selectObject(obj), frame(obj), afterVisibility(), selectedIds(), deleteAdded(id),
//       setPickable(obj, on), signature(), prefs(), savePrefs(v)}
export function createStudioLayers(ctx) {
  let layers = {}, scope = null, scopeFor = null, query = '', filter = 'all', anywhere = false, open = false, root = null, button = null, sheet = null;
  let sheetModel = null, aliases = new Map(), lastSig = '', timer = null, closed = new Set(), ui = { open: false, peek: false };
  const isPhone = () => { try { return matchMedia(PHONE).matches; } catch { return false; } };
  const say = (t, opts) => { try { ctx.notify?.(t, opts); } catch {} };
  const room = () => { try { return ctx.roomKey?.() || null; } catch { return null; } };
  const phase = () => { try { return ctx.phase?.() || '*'; } catch { return '*'; } };
  const size = () => { try { return ctx.size?.() || '*'; } catch { return '*'; } };
  const labels = () => { try { return ctx.phaseLabels?.() || {}; } catch { return {}; } };
  const items = () => { try { return (ctx.items?.() || []).filter(listable); } catch (error) { console.warn('[layers] items', error); return []; } };
  // phase 4: the room's ErgoFlex desks and its cast at this hour (studio.js layersDesks / layersPeople)
  const desks = () => { try { return ctx.desks?.() || []; } catch (error) { console.warn('[layers] desks', error); return []; } };
  const people = () => { try { return ctx.people?.() || []; } catch (error) { console.warn('[layers] people', error); return []; } };
  const read = () => { try { return cleanLayers(ctx.readRaw?.(LAYERS_KEY)); } catch { return {}; } };
  // The stored layers with the current room's old deletes migrated in (memory only until an edit writes them).
  function fresh() {
    let v = read(); const r = room();
    if (r) try {
      const st = ctx.assetState?.(), list = items(), placements = new Map(list.map(d => [d.id, { label: d.name, propId: d.propId, at: d.at, kind: entryKind(kindOf(d)) }]));
      v = migrateRoom({ room: r, assets: { removed: st?.removed ? [...st.removed] : [] }, desks: null, layers: v, placements }).layers;
    } catch (error) { console.warn('[layers] migration', error); }
    return v;
  }
  function currentScope() { const p = phase(); if (scopeFor !== room() + '|' + p) { scope = defaultScope(p); scopeFor = room() + '|' + p; } return scope; }
  function model() {
    const r = room(), built = buildRows({ room: r, items: items(), layers, phase: phase(), size: size(), desks: desks(), people: people() });
    aliases = built.aliases; return built.rows;
  }
  // ---- the scene: hide / show every listed item for the current time and size
  // force: after a room load (old deletes were hidden during hydration; the room's picking and people follow now).
  function apply(force = false) {
    const r = room(); if (!r) { try { ctx.applyDesks?.(new Map()); } catch {} return; }
    const list = items(), vis = visibilityOf({ room: r, items: list, layers, phase: phase(), size: size() });
    let changed = force && list.some(d => vis.get(d.id) === true);
    for (const d of list) {
      const hide = vis.get(d.id) === true, flipped = setLayersHidden(d.obj, hide);
      if (flipped) changed = true;
      if (flipped || hide) try { ctx.setPickable?.(d.obj, !hide); } catch {}
    }
    // desks (with what rides on them) and the people at them: studio.js does the scene side
    try { if (ctx.applyDesks?.(deskVisibility({ room: r, desks: desks(), layers, phase: phase(), size: size() }))) changed = true; } catch (error) { console.warn('[layers] desks', error); }
    try { if (ctx.applyPeople?.(personOut({ room: r, layers, phase: phase(), size: size() }))) changed = true; } catch (error) { console.warn('[layers] people', error); }
    if (changed) try { ctx.afterVisibility?.(); } catch (error) { console.warn('[layers] after', error); }
    paintBadge(list);
  }
  function write(next) { layers = next; try { ctx.writeRaw?.(LAYERS_KEY, JSON.stringify(next)); } catch (error) { console.warn('[layers] save', error); say('Could not save the hide: browser storage is unavailable.'); } }
  // One change = one undo step.
  function commit(change, text) {
    if (!change) return false;
    const base = fresh(); write(applySide(base, change.after)); apply(); render();
    try { ctx.transaction?.(change); } catch (error) { console.warn('[layers] undo', error); }
    if (text) say(text);
    return true;
  }
  const metaOf = id => {
    if (id.startsWith('desk:')) { const d = desks().find(x => x.id === id); return { kind: 'desk', label: d?.name }; }
    if (id.startsWith('person:')) { const p = people().find(x => x.id === id); return { kind: 'person', label: p?.name, model: p?.model }; }
    const d = items().find(x => x.id === id); return d ? { kind: entryKind(kindOf(d)), label: d.name, propId: d.propId || undefined, at: d.at } : {};
  };
  const entryIds = () => { const m = new Map(); for (const [from, to] of aliases) if (to) m.set(to, from); return m; };
  function setHidden(ids, hidden, cell = cellFor(currentScope(), phase(), size()), text = null) {
    layers = fresh(); model();
    const change = changeFor(layers, room(), ids, cell, hidden, { entryIds: entryIds(), meta: metaOf, t: Date.now() });
    if (!change) { if (text) say(text); return false; }
    return commit(change, text);
  }
  // ---- hooks for studio.js
  const api = {
    enabled: true,
    // hydration: keep an old-deleted object in the scene (it becomes a hidden row). People are phase 4.
    keeps: obj => !!obj && !obj.userData?.person,
    hydrated() { try { layers = fresh(); apply(true); render(); lastSig = sig(); } catch (error) { console.warn('[layers] hydrate', error); } },
    apply() { try { apply(); } catch (error) { console.warn('[layers] apply', error); } },
    // Delete in Rearrange: stock items are hidden everywhere; returns the entries still to delete (added ones), or true.
    hideForDelete(entries) {
      try {
        const plan = deletePlan((entries || []).map(e => ({ id: e?.editorId, custom: !!e?.isCustom, person: !!e?.obj?.userData?.person, entry: e })));
        if (!plan.hide.length || !validRoom(room())) return null;   // no room key: the old delete, never a silent no-op
        setHidden(plan.hide, true, '*/*');
        const toast = deleteToastPlan(plan.hide.length, plan.remove.length); say(toast.text, { ms: toast.ms, defer: toast.defer });   // deferred: the last toast, 7 s
        return plan.remove.length ? plan.remove.map(x => x.entry) : true;
      } catch (error) { console.warn('[layers] delete', error); return null; }
    },
    applyUndo(entry) {
      try {
        const base = fresh(); write(applySide(base, entry?.before)); apply(); render();
        if (entry?.room && entry.room !== room()) say(`Undid a show / hide in another room (${entry.room}).`);
      }
      catch (error) { console.warn('[layers] undo', error); }
    },
    mount,
    // For tests (an agent's browser check: tests/studio-layers-desks-e2e.cjs, through window.ErgoFlex.layers): the rows,
    // and hide / show one item in a scope ('cell' | 'time' | 'size' | 'all'). Same paths as the eye (one undo step each).
    test: {
      rows: () => model().map(r => ({ id: r.id, name: r.name, group: r.group, hidden: r.hidden, chip: r.chip, nestedIn: r.nestedIn || null })),
      hide: (id, scope = 'cell') => setHidden([id], true, cellFor(scope, phase(), size())),
      show: (id, scope = 'cell') => setHidden([id], false, cellFor(scope, phase(), size())),
      apply: () => apply(), stored: () => read()
    },
    get open() { return open; },
    toggle: show => setOpen(show ?? !open),
    get ui() { return { ...ui }; }
  };
  const sig = () => { try { return ctx.signature?.() || ''; } catch { return ''; } };
  // A new time of day, desk size, room or a later-loaded item: show the right things (cheap check, twice a second).
  function watch() { clearInterval(timer); timer = setInterval(() => { const s = sig(); if (s !== lastSig) { lastSig = s; layers = fresh(); apply(); render(); } }, 500); }

  // ---- DOM
  function mount(beforeEl) {
    try {
      button = document.createElement('button'); button.type = 'button'; button.id = 'layers-open'; button.className = 'layers-open';
      button.setAttribute('aria-controls', 'layers-panel'); button.setAttribute('aria-expanded', 'false');
      button.title = 'Layers: everything in this room, with an eye to hide or show it (H hides the selection, Alt+H shows all)';
      button.innerHTML = '<span>Layers</span><b class="layers-badge" hidden></b>';
      button.onclick = () => uiEvent('button');
      if (beforeEl?.parentNode) beforeEl.before(button); else document.getElementById('scene-controls')?.append(button);
      root = document.createElement('aside'); root.id = 'layers-panel'; root.className = 'layers-dock'; root.hidden = true; root.setAttribute('aria-label', 'Layers');
      const pref = (() => { try { return ctx.prefs?.() || {}; } catch { return {}; } })();
      if (Number.isFinite(pref.width)) { const w = Math.max(260, Math.min(620, pref.width)) + 'px'; root.style.setProperty('--layers-width', w); document.documentElement.style.setProperty('--layers-width', w); }   // (on <html> too: the 3D view makes room by it)
      document.body.append(root);
      sheet = document.createElement('dialog'); sheet.id = 'layers-scope-sheet'; sheet.className = 'layers-sheet'; document.body.append(sheet);
      wire(); watch();
      if (pref.open === true) uiEvent('restore', false);
    } catch (error) { console.warn('[layers] the panel could not be built; the Studio works without it', error); }
    return api;
  }
  // The dock / phone sheet state is studio-layers-model.mjs sheetNext; this only paints it.
  function uiEvent(event, remember = true) {
    const was = ui.open; ui = sheetNext(ui, event, { phone: isPhone() }); open = ui.open; if (!root) return;
    root.hidden = !open; root.classList.toggle('peek', ui.peek); button?.setAttribute('aria-expanded', String(open)); button?.classList.toggle('active', open);
    document.documentElement.classList.toggle('layers-docked', open && !isPhone());
    if (open && !was) { layers = fresh(); render(); }
    if (remember && was !== open) try { ctx.savePrefs?.({ ...(ctx.prefs?.() || {}), open }); } catch {}
  }
  function setOpen(show, remember = true) { if (!!show !== ui.open) uiEvent(show ? 'button' : 'close', remember); }
  function paintBadge(list) {
    if (!button) return;
    const n = hiddenCount(buildRows({ room: room(), items: list || items(), layers, phase: phase(), size: size(), desks: desks(), people: people() }).rows), b = button.querySelector('.layers-badge');
    if (b) { b.hidden = !n; b.textContent = String(n); }
    button.setAttribute('aria-label', n ? `Layers, ${n} hidden in this setting` : 'Layers');
  }
  function rowHtml(r) {
    const name = esc(r.name), locked = eyeLocked(r);
    const eyeTitle = locked ? `${name} is hidden with its desk: show the desk to bring them back` : r.kind === 'desk' ? `${r.hidden ? 'Show' : 'Hide'} ${name}, what is on it and the person at it (right-click or long-press: where)` : r.hidden ? `Show ${name} (right-click or long-press: where)` : `Hide ${name} (right-click or long-press: where)`;
    const nested = (r.nested || []).map(rowHtml).join('');
    return `<li class="layers-row${r.hidden ? ' is-hidden' : ''}${r.missing ? ' is-missing' : ''}${r.nestedIn ? ' is-nested' : ''}" data-ly-id="${esc(r.id)}">
      <button type="button" class="layers-main" data-ly-select title="${r.missing ? 'Not in the room' : r.hidden ? 'Hidden: click to see where it is' : 'Select and show it'}">
        <span class="layers-kind" aria-hidden="true">${ICON[r.group] || '•'}</span>
        <span class="layers-text"><span class="layers-name">${name}</span>${r.chip ? `<span class="layers-chip">${esc(r.chip)}</span>` : ''}${r.secondary ? `<small>${esc(r.secondary)}</small>` : ''}</span>
      </button>
      ${r.custom ? `<button type="button" class="layers-trash" data-ly-trash title="Delete ${name} (it was added; Ctrl+Z brings it back)" aria-label="Delete ${name}">🗑</button>` : ''}
      <button type="button" class="layers-eye" data-ly-eye aria-pressed="${!r.hidden}" ${locked ? 'aria-disabled="true"' : ''} title="${eyeTitle}" aria-label="${r.hidden ? 'Show' : 'Hide'} ${name}">${r.hidden ? EYE_OFF : EYE}</button></li>${nested ? `<li class="layers-nest"><ul>${nested}</ul></li>` : ''}`;
  }
  function render() {
    if (!root || !open) { paintBadge(); return; }
    const rows = model(), p = phase(), s = size(), shown = filterRows(rows, { query, filter, anywhere }), groups = groupRows(shown), sc = currentScope();
    const focus = document.activeElement?.closest?.('#layers-panel') ? document.activeElement.name || null : null;
    root.innerHTML = `<div class="layers-handle" data-ly-handle title="Drag to resize" aria-hidden="true"></div>
      <header class="layers-head"><div><h2>Layers</h2><p class="layers-setting">${esc(settingLine(labels()[p], p, s))}</p></div><button type="button" class="layers-close" data-ly-close aria-label="Close Layers">×</button></header>
      <label class="layers-scope">Hide in <select name="ly-scope">${scopeChoices(p, s, labels()[p]).map(c => `<option value="${c.scope}" ${c.scope === sc ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
      <input type="search" name="ly-search" class="layers-search" placeholder="Search layers" value="${esc(query)}" aria-label="Search layers">
      <div class="layers-filters" role="group" aria-label="Filter"><button type="button" data-ly-filter="all" aria-pressed="${filter === 'all'}">All</button><button type="button" data-ly-filter="hidden" aria-pressed="${filter === 'hidden'}">Hidden</button>
        <label class="layers-anywhere"><input type="checkbox" name="ly-anywhere" ${anywhere ? 'checked' : ''} ${filter === 'hidden' ? '' : 'disabled'}> anywhere</label>
        <button type="button" data-ly-showall ${hiddenCount(rows) ? '' : 'disabled'}>Show all hidden</button></div>
      <div class="layers-list">${groups.length ? groups.map(g => `<details class="layers-group" data-ly-group="${g.id}" ${closed.has(g.id) ? '' : 'open'}><summary><span>${esc(g.title)} <small>${g.count}${g.hidden ? ` · ${g.hidden} hidden` : ''}</small></span>${g.id === 'missing' ? '' : `<button type="button" class="layers-eye" data-ly-group-eye="${g.id}" aria-pressed="${g.hidden < g.count}" title="${g.hidden === g.count ? 'Show' : 'Hide'} every ${esc(g.title.toLowerCase())} in this list" aria-label="${g.hidden === g.count ? 'Show' : 'Hide'} all ${esc(g.title)}">${g.hidden === g.count ? EYE_OFF : EYE}</button>`}</summary><ul>${g.rows.map(rowHtml).join('')}</ul></details>`).join('')
        : `<p class="layers-empty">${rows.length ? 'Nothing matches.' : 'This room has no items to list yet.'}</p>`}</div>
      <p class="layers-foot">A desk's eye hides the desk, what is on it and the person at it. H hides the selection here; Alt+H shows all hidden here.</p>`;
    if (focus) { const el = root.querySelector(`[name="${focus}"]`); el?.focus({ preventScroll: true }); if (el?.type === 'search') el.setSelectionRange(el.value.length, el.value.length); }
  }
  const rowOf = id => model().find(r => r.id === id);
  const objOf = id => { if (/^(desk|person):/.test(id)) { try { return ctx.objectOf?.(id) || null; } catch { return null; } } return items().find(d => d.id === id)?.obj || null; };
  function toggleRow(id) {
    const r = rowOf(id); if (!r) return;
    if (eyeLocked(r)) { say(`${r.name} is hidden with ${r.secondary.replace(/^at /, '').replace(/ · .*$/, '')}: show the desk to bring them back.`); return; }
    setHidden([r.id], !r.hidden, cellFor(currentScope(), phase(), size()), `${r.hidden ? 'Showing' : 'Hid'} ${r.name}${r.hidden ? '' : ` (${scopeLabel()})`}. Ctrl+Z undoes.`);
  }
  const scopeLabel = () => scopeChoices(phase(), size(), labels()[phase()]).find(c => c.scope === currentScope())?.label.toLowerCase() || '';
  function selectRow(id) {
    const r = rowOf(id), obj = objOf(id), plan = rowTapPlan(r, { phone: isPhone() });
    if (plan.toast) say(plan.toast);
    if (!obj) return;
    if (plan.ghost) ghost(obj);
    try { if (plan.select) ctx.selectObject?.(obj); if (plan.frame) ctx.frame?.(obj); } catch (error) { console.warn('[layers] select', error); }
    if (plan.peek) uiEvent('row', false);
  }
  // 1.5 s outline of a hidden item (a box: its own meshes stay hidden).
  function ghost(obj) {
    try {
      const T = ctx.THREE, scene = ctx.scene?.(); if (!T || !scene) return;
      const helper = new T.BoxHelper(obj, 0x45cfac); helper.name = 'Layers ghost'; helper.userData.presentationOnly = true; scene.add(helper);
      setTimeout(() => { helper.removeFromParent(); helper.geometry?.dispose(); helper.material?.dispose(); }, 1500);
    } catch (error) { console.warn('[layers] ghost', error); }
  }
  function showAll() {
    layers = fresh(); const rows = model(), { count, change } = showAllChange(layers, room(), rows, cellFor(currentScope(), phase(), size()), { entryIds: entryIds(), meta: metaOf, t: Date.now() });
    if (!count) return;
    if (count > SHOW_ALL_CONFIRM && !confirm(showAllConfirmText(count))) return;
    commit(change, `${count} item${count === 1 ? '' : 's'} shown. Ctrl+Z hides them again.`);
  }
  function groupEye(id) {
    const rows = filterRows(model(), { query, filter, anywhere }).filter(r => r.group === id && !r.missing); if (!rows.length) return;
    const hide = rows.some(r => !r.hidden);
    setHidden(rows.filter(r => r.hidden !== hide).map(r => r.id), hide, cellFor(currentScope(), phase(), size()), `${hide ? 'Hid' : 'Showed'} ${rows.length} ${GROUPS.find(g => g.id === id)?.title.toLowerCase() || 'items'}. Ctrl+Z undoes.`);
  }
  // The per-row scope sheet (right-click / long-press on the eye or the row).
  function openSheet(id) {
    const r = rowOf(id); if (!r || !sheet) return;
    const m = scopeSheetModel({ row: r, entry: layers[entryKey(room(), r.entryId)] || null, phase: phase(), size: size(), labels: labels() });
    sheet.innerHTML = `<form method="dialog"><h3>${esc(m.title)}</h3><p>${esc(m.line)}</p>
      ${m.buttons.map((x, i) => `<button type="button" data-ly-sheet="${i}">${esc(x.label)}</button>`).join('')}
      <button value="close" class="layers-sheet-close">Close</button></form>`;
    sheet.dataset.id = id; sheetModel = m;
    try { sheet.showModal(); } catch { sheet.setAttribute('open', ''); }
  }
  function wire() {
    // long-press (touch): studio-layers-model.mjs createPress decides; a timer asks it once the delay is over
    const press = createPress(); let pressTimer = null;
    root.addEventListener('click', event => {
      const t = event.target;
      if (press.swallowClick() && t.closest('[data-ly-id]')) { event.preventDefault(); return; }
      if (t.closest('[data-ly-close]')) { uiEvent('close'); return; }
      if (t.closest('[data-ly-handle]') && isPhone()) { uiEvent('handle', false); return; }
      const f = t.closest('[data-ly-filter]'); if (f) { filter = f.dataset.lyFilter; render(); return; }
      if (t.closest('[data-ly-showall]')) { showAll(); return; }
      const ge = t.closest('[data-ly-group-eye]'); if (ge) { event.preventDefault(); groupEye(ge.dataset.lyGroupEye); return; }
      const row = t.closest('[data-ly-id]'); if (!row) return;
      const id = row.dataset.lyId;
      if (t.closest('[data-ly-eye]')) { toggleRow(id); return; }
      if (t.closest('[data-ly-trash]')) { try { ctx.deleteAdded?.(id); } catch (error) { console.warn('[layers] delete', error); } layers = fresh(); render(); return; }
      if (t.closest('[data-ly-select]')) selectRow(id);
    });
    root.addEventListener('contextmenu', event => { const row = event.target.closest('[data-ly-id]'); if (!row) return; event.preventDefault(); openSheet(row.dataset.lyId); });
    root.addEventListener('pointerdown', event => {
      const row = event.target.closest('[data-ly-id]'); if (!row || event.pointerType === 'mouse') return;
      press.down(event.clientX, event.clientY, performance.now(), row.dataset.lyId); clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { const id = press.id; if (press.tick(performance.now()) === 'long' && id) openSheet(id); }, 520);
    });
    root.addEventListener('pointermove', event => { if (press.move(event.clientX, event.clientY) === 'cancelled') clearTimeout(pressTimer); });
    root.addEventListener('pointerup', () => { clearTimeout(pressTimer); press.up(performance.now()); });
    root.addEventListener('pointercancel', () => { clearTimeout(pressTimer); press.cancel(); });
    root.addEventListener('input', event => {
      if (event.target.name === 'ly-search') { query = event.target.value; render(); }
    });
    root.addEventListener('change', event => {
      if (event.target.name === 'ly-scope') { scope = event.target.value; scopeFor = room() + '|' + phase(); render(); }
      if (event.target.name === 'ly-anywhere') { anywhere = event.target.checked; render(); }
    });
    root.addEventListener('toggle', event => { const d = event.target.closest?.('[data-ly-group]'); if (!d) return; if (d.open) closed.delete(d.dataset.lyGroup); else closed.add(d.dataset.lyGroup); }, true);
    // desktop: drag the left edge to resize (remembered)
    root.addEventListener('pointerdown', event => {
      if (!event.target.closest('[data-ly-handle]') || matchMedia(PHONE).matches) return;
      event.preventDefault(); const start = event.clientX, w = root.getBoundingClientRect().width;
      const move = e => { const px = Math.max(260, Math.min(620, w + start - e.clientX)) + 'px'; root.style.setProperty('--layers-width', px); document.documentElement.style.setProperty('--layers-width', px); };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); try { ctx.savePrefs?.({ ...(ctx.prefs?.() || {}), width: Math.round(root.getBoundingClientRect().width) }); } catch {} };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
    sheet.addEventListener('click', event => {
      const el = event.target.closest('[data-ly-sheet]'); if (!el || !sheetModel) return;
      const b = sheetModel.buttons[Number(el.dataset.lySheet)], r = rowOf(sheet.dataset.id); sheet.close?.(); sheet.removeAttribute('open'); if (!b || !r) return;
      setHidden([r.id], b.kind === 'hide', b.cell, `${b.kind === 'hide' ? 'Hid' : 'Showing'} ${r.name}. Ctrl+Z undoes.`);
    });
    // H hides the selection in the current scope; Alt+H shows all hidden here.
    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.code !== 'KeyH' || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target.closest?.('input, select, textarea, [contenteditable], #glide-pad, dialog')) return;
      if (event.altKey) { event.preventDefault(); showAll(); return; }
      let ids = []; try { ids = (ctx.selectedIds?.() || []).filter(id => items().some(d => d.id === id)); } catch {}
      if (!ids.length) return;
      event.preventDefault(); setHidden(ids, true, cellFor(currentScope(), phase(), size()), `Hid ${ids.length === 1 ? rowOf(ids[0])?.name || 'it' : ids.length + ' items'} (${scopeLabel()}). Layers -> eye brings it back.`);
    });
  }
  return api;
}
