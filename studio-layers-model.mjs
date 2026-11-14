// Studio Layers panel, phase 2: everything the panel decides, as pure functions (no DOM, no three.js). The panel
// (studio-layers-panel.mjs) and studio.js's small hooks only call these. Data model: scene-layers.mjs. Design:
// DESIGN.md sections 2, 3.3, 3.5-3.7. Phase 2 covers Studio scene assets only: room props, fixtures, wall pieces, lamps,
// desk dressing and added items. Desks and people are phase 4 (they are not listed here, and never hidden by this code).
import { LAYERS_KEY, PHASES, SIZES, cellOf, scopeCell, hiddenAt, hiddenAnywhere, hiddenCells, cleanLayers, setCell, entryKey, splitKey,
  roomEntries, labelOfId, propIdOf, resolveAlias, indexKeyed, validRoom, validItem } from './scene-layers.mjs';

export { LAYERS_KEY };
export const UI_SWITCH_KEY = 'ergoflex.layers.ui';
// The switch: ?layers=0 or localStorage['ergoflex.layers.ui'] === '0' turns the panel and the hide behaviour off (the
// Studio is then exactly as before phase 2); ?layers=1 turns it on whatever is stored. Default on.
export function layersSwitch(search, stored) {
  let q = null; try { q = new URLSearchParams(search || '').get('layers'); } catch { q = null; }
  if (q === '0' || q === 'off') return false;
  if (q === '1' || q === 'on') return true;
  return String(stored ?? '').trim() !== '0';
}

// ---- kinds and groups
export const GROUPS = [
  { id: 'furniture', title: 'Furniture' },
  { id: 'wall', title: 'Wall pieces' },
  { id: 'fixture', title: 'Fixtures' },
  { id: 'light', title: 'Lights' },
  { id: 'desk-item', title: 'Desk dressing' },
  { id: 'added', title: 'Added' },
  { id: 'missing', title: 'Missing (the room changed)' }
];
const LIGHT = /(^|[^a-z])(lamp|light|sconce|pendant|chandelier|lantern)/i;
// d: {id, name, propId, role, category, anchor, onWall, custom, person}
export function kindOf(d) {
  if (!d) return 'furniture';
  if (d.custom || /:(custom|copy):/.test(d.id || '')) return 'added';
  if (d.role && d.role !== 'room') return 'desk-item';
  if (d.category === 'lighting' || LIGHT.test(`${d.propId || ''} ${d.name || ''}`)) return 'light';
  if (d.onWall || ['wall', 'ceiling', 'wall-floor'].includes(d.anchor)) return 'wall';
  if (/:fixture:/.test(d.id || '')) return 'fixture';
  return 'furniture';
}
// The kind a layers entry keeps (scene-layers.mjs KINDS).
export const entryKind = group => ({ furniture: 'prop', 'desk-item': 'prop', wall: 'wall', fixture: 'fixture', light: 'light', added: 'added' }[group] || 'prop');
const groupOfEntry = e => ({ wall: 'wall', fixture: 'fixture', light: 'light', added: 'added' }[e?.kind] || 'furniture');
// Things phase 2 lists: Studio scene assets, never people (phase 4).
export const listable = d => !!d && validItem(d.id) && d.id.startsWith('scene:') && !d.person && !/:person:/.test(d.id) && !/:station:[^:]+$/.test(d.id);

// ---- the header
const SIZE_LABEL = { '48x30': '48 in', '60x30': '60 in' };
export const sizeLabel = size => SIZE_LABEL[size] || 'any size';
export function settingLine(phaseLabel, phase, size) {
  const time = PHASES.includes(phase) ? (phaseLabel || phase[0].toUpperCase() + phase.slice(1)) : '';
  return [time, SIZES.includes(size) ? sizeLabel(size) : ''].filter(Boolean).join(' · ') || 'This room';
}
// The scope chip's choices for the current setting; a room without dayparts has only the size and everywhere ones.
export function scopeChoices(phase, size, phaseLabel = '') {
  const t = PHASES.includes(phase) ? (phaseLabel || phase) : '', s = sizeLabel(size), out = [];
  if (t) out.push({ scope: 'cell', label: `This time & size (${t} · ${s})` }, { scope: 'time', label: `This time, both sizes (${t})` });
  out.push({ scope: 'size', label: t ? `Every time, this size (${s})` : `This size (${s})` }, { scope: 'all', label: 'Everywhere' });
  return out;
}
// The scope a session starts with (the eye's default: this time and size; without dayparts, this size).
export const defaultScope = phase => PHASES.includes(phase) ? 'cell' : 'size';
// The cell a scope writes now (a room without dayparts writes '*' for the time).
export const cellFor = (scope, phase, size) => scopeCell(scope, PHASES.includes(phase) ? phase : '*', SIZES.includes(size) ? size : '*');

// ---- rows
// The chip a row shows: '' when its state is only this cell; otherwise where else it is hidden.
export function chipOf(entry, phase, size) {
  if (!entry) return '';
  const cells = hiddenCells(entry), here = hiddenAt(entry, phase, size), old = entry.legacy === 'removed' ? 'old delete' : '';
  if (!cells.length) return old && 'shown · old delete';
  const all = PHASES.length * SIZES.length;
  let where;
  if (cells.length === all) where = 'everywhere';
  else if (SIZES.includes(size) && PHASES.every(p => cells.includes(`${p}/${size}`)) && cells.length === PHASES.length) where = 'all times';
  else if (PHASES.includes(phase) && SIZES.every(s => cells.includes(`${phase}/${s}`)) && cells.length === SIZES.length) where = 'both sizes';
  else if (here && cells.length === 1) where = '';
  else where = here ? 'here and elsewhere' : 'hidden elsewhere';
  return [where, old].filter(Boolean).join(' · ');
}
// "Hidden at: First bell 60 in, Wave lab 60 in" (labels: {phase: label})
export function hiddenAtText(entry, labels = {}) {
  const cells = hiddenCells(entry);
  if (!cells.length) return 'Shown at every time and size.';
  if (cells.length === PHASES.length * SIZES.length) return 'Hidden everywhere.';
  return 'Hidden at: ' + cells.map(c => { const [p, s] = c.split('/'); return `${labels[p] || p} ${sizeLabel(s)}`; }).join(', ');
}
// items: [{id, name, propId, role, category, anchor, onWall, custom, person, at}] (the room's scene assets as built);
// layers: the whole layers value; room: the layers room key. Returns {rows, aliases: Map(entry id -> item id)}.
// A row: {id, entryId, name, group, kind, hidden, anywhere, chip, legacy, custom, secondary, missing?}
export function buildRows({ room, items = [], layers = {}, phase, size }) {
  const entries = validRoom(room) ? roomEntries(layers, room) : new Map(), byId = new Map(), aliases = new Map(), rows = [];
  const list = items.filter(listable);
  for (const d of list) byId.set(d.id, d);
  const candidates = list.filter(d => indexKeyed(d.id)).map(d => ({ id: d.id, propId: d.propId || propIdOf(d.id), at: d.at }));
  // Each entry names a live item: itself, or (index-keyed ids whose index moved) the item its fingerprint finds
  // (scene-layers.mjs resolveAlias); else it is missing. An item's own entry wins over an alias to it.
  const target = new Map();
  for (const [id, e] of entries) {
    if (!id.startsWith('scene:')) continue;
    const r = indexKeyed(id) ? resolveAlias(id, e, candidates) : byId.has(id) ? { id, alias: false } : null;
    target.set(id, r ? r.id : null);
  }
  const entryOf = new Map();
  for (const [id, to] of target) if (to === id) entryOf.set(id, { id, e: entries.get(id) });
  for (const [id, to] of target) {
    if (to && to !== id && !entryOf.has(to)) { entryOf.set(to, { id, e: entries.get(id) }); aliases.set(id, to); }
    else if (to !== id) aliases.set(id, null);
  }
  for (const d of list) {
    const hit = entryOf.get(d.id), e = hit?.e || null, group = kindOf(d);
    rows.push({ id: d.id, entryId: hit?.id || d.id, name: d.name || labelOfId(d.id), group, kind: entryKind(group), hidden: hiddenAt(e, phase, size), anywhere: hiddenAnywhere(e),
      chip: chipOf(e, phase, size), legacy: e?.legacy || null, custom: group === 'added', secondary: secondaryOf(d, e, hit && hit.id !== d.id) });
  }
  for (const [id, e] of entries) {
    if (!id.startsWith('scene:') || (aliases.has(id) ? aliases.get(id) : byId.has(id) ? id : null)) continue;
    if (/:person:|:station:[^:]+$/.test(id)) continue;
    rows.push({ id, entryId: id, name: e.label || labelOfId(id), group: 'missing', kind: e.kind, hidden: hiddenAt(e, phase, size), anywhere: hiddenAnywhere(e), chip: chipOf(e, phase, size),
      legacy: e.legacy || null, custom: false, missing: true, secondary: 'Not in this room any more: its entry is kept. ' + (groupOfEntry(e) === 'fixture' ? 'A fixture.' : '') });
  }
  return { rows, aliases };
}
function secondaryOf(d, e, aliased) {
  const parts = [];
  if (d.role && d.role !== 'room') parts.push('on the desk');
  if (d.onWall) parts.push('on a wall');
  if (e?.legacy === 'removed') parts.push('deleted before Layers existed; the films still leave it out');
  if (aliased) parts.push('found again after the room\'s list changed');
  return parts.join(' · ');
}
// ---- search and filters
// filter: 'all' | 'hidden'; anywhere: with 'hidden', rows hidden in any time or size (not only here).
export function filterRows(rows, { query = '', filter = 'all', anywhere = false } = {}) {
  const q = String(query || '').trim().toLowerCase(), title = id => GROUPS.find(g => g.id === id)?.title.toLowerCase() || '';
  return rows.filter(r => (!q || r.name.toLowerCase().includes(q) || title(r.group).includes(q) || (r.secondary || '').toLowerCase().includes(q))
    && (filter !== 'hidden' || (anywhere ? r.anywhere : r.hidden)));
}
export function groupRows(rows) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  return GROUPS.map(g => { const list = rows.filter(r => r.group === g.id).sort(byName); return { ...g, rows: list, count: list.length, hidden: list.filter(r => r.hidden).length }; }).filter(g => g.count);
}
export const hiddenCount = rows => rows.filter(r => r.hidden && !r.missing).length;

// ---- changes (one undo step each): {type:'layers', room, before:{key: entry|null}, after:{key: entry|null}}
// ids: row ids (live item ids) or entry ids; entryIds: Map(row id -> entry id) for aliased rows (the edit moves the
// entry to the live id). meta(id): {kind, label, propId, at} for new entries.
export function changeFor(layers, room, ids, cell, hidden, { entryIds = new Map(), meta = () => ({}), by = 'Studio', t } = {}) {
  if (!validRoom(room)) return null;
  const before = {}, after = {};
  for (const id of new Set(ids)) {
    if (!validItem(id)) continue;
    const from = entryIds.get(id) || id, oldKey = entryKey(room, from), key = entryKey(room, id), was = layers[oldKey] || null;
    const next = setCell(was, cell, hidden, { id, ...meta(id), by, t });
    if (JSON.stringify(next) === JSON.stringify(was) && oldKey === key) continue;
    if (!(oldKey in before)) before[oldKey] = was;
    if (oldKey !== key) { if (!(key in before)) before[key] = layers[key] || null; after[oldKey] = null; }
    after[key] = next;
  }
  return Object.keys(after).length ? { type: 'layers', room, before, after } : null;
}
// The layers value with one side of a change written (undo applies `before`, redo `after`).
export function applySide(layers, side) {
  const out = { ...layers };
  for (const [key, e] of Object.entries(side || {})) { if (e) out[key] = e; else delete out[key]; }
  return cleanLayers(out);
}
export const invertChange = c => c && { ...c, before: c.after, after: c.before };
// Show every row hidden here, in the given scope (one change); {change, count}
export function showAllChange(layers, room, rows, cell, opts) {
  const ids = rows.filter(r => r.hidden && !r.missing).map(r => r.id);
  return { count: ids.length, change: ids.length ? changeFor(layers, room, ids, cell, false, opts) : null };
}
export const SHOW_ALL_CONFIRM = 10;
export const showAllConfirmText = n => `Show all ${n} hidden items in this setting? One Undo hides them again.`;

// ---- Delete in Rearrange: a stock item is hidden everywhere; only added items (library adds, pastes) are deleted.
// entries: [{id, custom, person}] -> {hide: [ids], remove: [entries]}
export function deletePlan(entries) {
  const hide = [], remove = [];
  for (const e of entries || []) {
    if (!e) continue;
    if (e.custom || e.person || /:(custom|copy):/.test(e.id || '') || !listable(e)) remove.push(e); else hide.push(e.id);
  }
  return { hide, remove };
}
export const DELETE_TOAST = 'Hidden everywhere. Layers -> eye brings it back. Ctrl+Z undoes.';
export const deleteToast = (hidden, deleted) => [hidden ? (hidden === 1 ? DELETE_TOAST : `${hidden} items hidden everywhere. Layers -> eye brings them back. Ctrl+Z undoes.`) : '',
  deleted ? `${deleted} added item${deleted === 1 ? '' : 's'} deleted.` : ''].filter(Boolean).join(' ');

// ---- what the scene should show: Map(item id -> hidden) for the room's listable items at (phase, size)
export function visibilityOf({ room, items = [], layers = {}, phase, size }) {
  const { rows } = buildRows({ room, items, layers, phase, size }), out = new Map();
  for (const r of rows) if (!r.missing) out.set(r.id, r.hidden);
  return out;
}
// A short status line for the badge / tooltip.
export const badgeText = n => n ? `${n} hidden` : '';
export { cellOf, hiddenAt, hiddenAtText as hiddenAtLine, splitKey };
