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
  { id: 'desk', title: 'Desks' },
  { id: 'person', title: 'People' },
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
// desks: [{id:'desk:<record id>', name, featured}] (the room's ErgoFlex desks); people: [{id:'person:<key>', name, desk:
// 'desk:<record id>' | null}] (the room's cast at this hour; a desk user follows its desk). Phase 4.
export function buildRows({ room, items = [], layers = {}, phase, size, desks = [], people = [] }) {
  const entries = validRoom(room) ? roomEntries(layers, room) : new Map(), byId = new Map(), aliases = new Map(), rows = [];
  rows.push(...deskRows({ entries, desks, people, phase, size }));
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
  const deskIds = new Map(desks.map(d => [d.id, d.name]));
  for (const d of list) {
    const hit = entryOf.get(d.id), e = hit?.e || null, group = kindOf(d), own = hiddenAt(e, phase, size);
    // A seat or prop that belongs to a desk (its placement names the station: deskOfItem) goes and comes back with
    // the desk's eye, with no entry of its own; its own hide still holds when the desk is shown.
    const desk = deskOfItem(d), nestedIn = desk && deskIds.has(desk) ? desk : null, byDesk = !!nestedIn && hiddenAt(entries.get(nestedIn) || null, phase, size);
    rows.push({ id: d.id, entryId: hit?.id || d.id, name: d.name || labelOfId(d.id), group, kind: entryKind(group), hidden: own || byDesk, own, byDesk, ...(nestedIn ? { nestedIn } : {}), anywhere: hiddenAnywhere(e),
      chip: chipOf(e, phase, size), legacy: e?.legacy || null, custom: group === 'added',
      secondary: [nestedIn ? `belongs to ${deskIds.get(nestedIn) || labelOfId(nestedIn)}${byDesk ? ' · hidden with it' : ''}` : '', secondaryOf(d, e, hit && hit.id !== d.id)].filter(Boolean).join(' · ') });
  }
  for (const [id, e] of entries) {
    if (!id.startsWith('scene:') || (aliases.has(id) ? aliases.get(id) : byId.has(id) ? id : null)) continue;
    if (/:person:|:station:[^:]+$/.test(id)) continue;
    rows.push({ id, entryId: id, name: e.label || labelOfId(id), group: 'missing', kind: e.kind, hidden: hiddenAt(e, phase, size), anywhere: hiddenAnywhere(e), chip: chipOf(e, phase, size),
      legacy: e.legacy || null, custom: false, missing: true, secondary: 'Not in this room any more: its entry is kept. ' + (groupOfEntry(e) === 'fixture' ? 'A fixture.' : '') });
  }
  return { rows, aliases };
}
// ---- what belongs to a desk: ONLY an explicit relation, never a distance. The room's placement names the station
// (`station: '<id>'`, carried to the object as userData.layersStation by workspace-3d.mjs): the chair every station
// gets from its layout (institutional-scenes.mjs stationChair, office-room.mjs, coworking-room.mjs) and props the room
// assigns by hand (the high school's drafting chair at the design review desk, the media desk's PC tower).
// -> 'desk:station-<id>' or null. (The featured desk's chair is a fixture of the room and stays.)
export const deskOfItem = d => typeof d?.station === 'string' && /^[a-z0-9][a-z0-9_-]{0,60}$/i.test(d.station) ? 'desk:station-' + d.station : null;
// ---- desks and people (phase 4)
const SAFE_KEY = /[^a-z0-9_-]+/g;
// The layers key of a person of the cast: their placement key (a posture variant is the same person).
export function personLayerKey(spec) {
  const k = String(spec?.variant || spec?.key || spec?.id || '').toLowerCase().replace(/^people-/, '').replace(SAFE_KEY, '-').replace(/^[^a-z0-9]+/, '').slice(0, 48);
  return k || null;
}
// "Mia (sit type)"
export function personName(key) {
  const [first, ...rest] = String(key || '').split('-').filter(Boolean);
  if (!first) return 'Person';
  return first[0].toUpperCase() + first.slice(1) + (rest.length ? ` (${rest.join(' ')})` : '');
}
// The desk a person follows: a station's user its station desk; the featured desk's user desk:main.
export const personDesk = spec => spec?.station ? 'desk:station-' + spec.station : spec?.desk ? 'desk:main' : null;
function deskRows({ entries, desks, people, phase, size }) {
  const out = [], deskName = new Map(desks.map(d => [d.id, d.name]));
  for (const d of desks) {
    if (!validItem(d.id)) continue;
    const e = entries.get(d.id) || null, users = people.filter(p => p.desk === d.id).map(p => p.name);
    out.push({ id: d.id, entryId: d.id, name: d.name || labelOfId(d.id), group: 'desk', kind: 'desk', hidden: hiddenAt(e, phase, size), anywhere: hiddenAnywhere(e),
      chip: chipOf(e, phase, size), legacy: e?.legacy || null, custom: false, featured: !!d.featured,
      secondary: [d.featured ? 'the featured desk' : '', users.length ? `${users.join(', ')} ${users.length === 1 ? 'works' : 'work'} here` : ''].filter(Boolean).join(' · ') });
  }
  for (const p of people) {
    if (!validItem(p.id)) continue;
    const e = entries.get(p.id) || null, own = hiddenAt(e, phase, size), desk = p.desk && deskName.has(p.desk) ? p.desk : null;
    const byDesk = !!desk && hiddenAt(entries.get(desk) || null, phase, size);
    out.push({ id: p.id, entryId: p.id, name: p.name || personName(p.id.slice(7)), group: 'person', kind: 'person', hidden: own || byDesk, own, byDesk, nestedIn: desk,
      anywhere: hiddenAnywhere(e), chip: chipOf(e, phase, size), legacy: null, custom: false,
      secondary: desk ? `at ${deskName.get(desk) || labelOfId(desk)}${byDesk ? ' · hidden with its desk' : ' · follows its desk'}` : '' });
  }
  return out;
}
// Which desks are hidden now: Map('desk:<id>' -> true/false)
export function deskVisibility({ room, desks = [], layers = {}, phase, size }) {
  const entries = validRoom(room) ? roomEntries(layers, room) : new Map(), out = new Map();
  for (const d of desks) out.set(d.id, hiddenAt(entries.get(d.id) || null, phase, size));
  return out;
}
// Whether a person of the cast is out now (their own hide, or their desk's). For RoomPeople in the Studio only.
export function personOut({ room, layers = {}, phase, size }) {
  const entries = validRoom(room) ? roomEntries(layers, room) : new Map();
  return spec => {
    const key = personLayerKey(spec); if (key && hiddenAt(entries.get('person:' + key) || null, phase, size)) return true;
    const desk = personDesk(spec); return !!desk && hiddenAt(entries.get(desk) || null, phase, size);
  };
}
// A signature of what personOut answers for a cast (to re-place people only when it changes).
export const peopleOutSignature = (cast, out) => (cast || []).map(s => (out(s) ? '1' : '0')).join('');

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
  const byName = (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.name.localeCompare(b.name);
  // What belongs to a desk (its user, its chair, its props) is nested under the desk row (desk.nested), not listed again.
  const groups = GROUPS.map(g => { const list = rows.filter(r => r.group === g.id && !(g.id !== 'desk' && r.nestedIn)).sort(byName); return { ...g, rows: list, count: list.length, hidden: list.filter(r => r.hidden).length }; });
  const desk = groups.find(g => g.id === 'desk');
  if (desk) desk.rows = desk.rows.map(d => ({ ...d, nested: rows.filter(r => r.nestedIn === d.id).sort(byName) }));
  return groups.filter(g => g.count);
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
export function visibilityOf({ room, items = [], layers = {}, phase, size, desks = [] }) {
  const { rows } = buildRows({ room, items, layers, phase, size, desks }), out = new Map();
  for (const r of rows) if (!r.missing) out.set(r.id, r.hidden);
  return out;
}
// A short status line for the badge / tooltip.
export const badgeText = n => n ? `${n} hidden` : '';

// ---- the Delete toast: shown after everything the delete itself does (a deferred toast is the last one), and long
// enough to read. (Seen on the desk: the hide happened but no toast was noticed; the Studio's toast lasts 4.5 s.)
export const TOAST_MS = 7000;
export const deleteToastPlan = (hidden, deleted) => ({ text: deleteToast(hidden, deleted), ms: TOAST_MS, defer: true });

// ---- framing a row's item: from further back and above, looking down at it with its surroundings in view, never
// outside the room's walls or above its ceiling. World units; unit = world units per metre.
//   center, size: the item's box centre and size; from: the camera's position now (keeps the side the viewer is on);
//   room: {min:[x, z], max:[x, z], floor, ceiling} or null; fov: vertical degrees; aspect.
// Returns {position:[x, y, z], target:[x, y, z], distance}.
export function frameView({ center, size = [0, 0, 0], from = null, room = null, fov = 35, aspect = 16 / 9, unit = 1 }) {
  const u = unit > 0 ? unit : 1, [cx, cy, cz] = center, r = .5 * Math.hypot(...size);
  let R = Math.max(r * 2.5, 1.2 * u);                                              // the item and about a metre around it
  if (room) R = Math.min(R, Math.max(r * 1.2, .5 * Math.hypot(room.max[0] - room.min[0], room.max[1] - room.min[1])));
  const half = Math.min(fov, 2 * Math.atan(Math.tan(fov * Math.PI / 360) * aspect) * 180 / Math.PI) * Math.PI / 360;
  const distance = R / Math.sin(half), el = 40 * Math.PI / 180;                     // 40 degrees down onto the item
  let hx = from ? from[0] - cx : 0, hz = from ? from[2] - cz : 1; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
  if (!from || Math.hypot(from[0] - cx, from[2] - cz) < 1e-6) { hx = 0; hz = 1; }
  let x = cx + hx * distance * Math.cos(el), y = cy + distance * Math.sin(el), z = cz + hz * distance * Math.cos(el);
  if (room) {
    const floor = room.floor ?? 0, eye = floor + 2.0 * u;                           // above a standing person's eyes
    const top = room.ceiling != null ? room.ceiling - .15 * u : Infinity, m = .25 * u;
    y = Math.max(y, Math.min(eye, top)); y = Math.min(y, top);
    const clamp = (v, a, b) => a > b ? (a + b) / 2 : Math.min(Math.max(v, a), b);
    x = clamp(x, room.min[0] + m, room.max[0] - m); z = clamp(z, room.min[1] + m, room.max[1] - m);
  }
  return { position: [x, y, z], target: [cx, cy, cz], distance: Math.hypot(x - cx, y - cy, z - cz) };
}

// ---- the phone sheet and the dock: {open, peek} after an event. phone: the bottom sheet (<= 760 px).
//   'button' (the tools-row Layers button: toggles), 'close', 'handle' (phone: peek <-> half), 'row' (a row tapped:
//   on a phone the sheet drops to a peek so the framed item can be seen), 'restore' (a stored open on a desktop)
export function sheetNext(state, event, { phone = false } = {}) {
  const s = { open: !!state?.open, peek: !!state?.peek };
  if (event === 'button') return s.open ? { open: false, peek: false } : { open: true, peek: false };
  if (event === 'close') return { open: false, peek: false };
  if (event === 'restore') return phone ? s : { open: true, peek: false };
  if (event === 'handle') return phone && s.open ? { open: true, peek: !s.peek } : s;
  if (event === 'row') return phone && s.open ? { open: true, peek: true } : s;
  return s;
}
// ---- long-press (touch): held LONG_PRESS_MS without moving more than LONG_PRESS_SLOP px opens the scope sheet; the
// click that follows a long-press is swallowed (it must not toggle the eye or select the row).
export const LONG_PRESS_MS = 500, LONG_PRESS_SLOP = 10;
export function createPress({ delay = LONG_PRESS_MS, slop = LONG_PRESS_SLOP } = {}) {
  let p = null, swallow = false;
  return {
    down(x, y, t, id) { p = { x, y, t, id, fired: false }; swallow = false; },
    move(x, y) { if (p && !p.fired && Math.hypot(x - p.x, y - p.y) >= slop) p = null; return p ? 'held' : 'cancelled'; },
    // at time t: 'long' once (open the sheet for p.id), else null
    tick(t) { if (p && !p.fired && t - p.t >= delay) { p.fired = true; swallow = true; return 'long'; } return null; },
    up(t) { const was = p; p = null; if (!was) return null; if (was.fired) return 'long-done'; return t - was.t >= delay ? 'long-late' : 'tap'; },
    cancel() { p = null; },
    // the click after a long-press: true once (swallow it)
    swallowClick() { const s = swallow; swallow = false; return s; },
    get id() { return p?.id ?? null; }
  };
}
// ---- the scope sheet of one row: its title, the "Hidden at ..." line and its buttons
export function scopeSheetModel({ row, entry = null, phase, size, labels = {} }) {
  if (!row) return null;
  const choices = scopeChoices(phase, size, labels[phase]);
  return { id: row.id, title: `${row.hidden ? 'Show or hide' : 'Hide'} ${row.name}`, line: hiddenAtText(entry, labels),
    buttons: [...choices.map(c => ({ kind: 'hide', scope: c.scope, label: `Hide: ${c.label}`, cell: cellFor(c.scope, phase, size) })),
      { kind: 'show', where: 'here', label: `Show here (${settingLine(labels[phase], phase, size)})`, cell: cellFor('cell', phase, size) },
      { kind: 'show', where: 'all', label: 'Show everywhere', cell: '*/*' }] };
}
// ---- a row tapped or clicked: what happens (a shown item is selected and framed; a hidden one gets the outline)
// A person hidden only because their desk is (byDesk, not own): the eye is the desk's.
export const eyeLocked = row => !!row?.byDesk && !row?.own;
export function rowTapPlan(row, { phone = false } = {}) {
  if (!row || row.missing) return { select: false, ghost: false, frame: false, peek: false, toast: row?.missing ? `${row.name} is not in the room any more.` : '' };
  return { select: !row.hidden, ghost: row.hidden, frame: true, peek: phone, toast: row.hidden ? `${row.name} is hidden here: the outline shows where it is.` : '' };
}

// ---- Save / Load project (Vico's decision 8: projects carry the hides)
// What a project stores: the cleaned layers value (every room), from the stored raw string.
export const projectLayers = raw => cleanLayers(raw);
// What a project load writes back: the raw string to store, or null to leave the stored hides as they are (a project
// saved before Layers has no field: it loads unchanged). The same cleaning as everything else that reads the key.
export function projectLayersRestore(saved) {
  if (saved === undefined || saved === null) return null;
  return JSON.stringify(cleanLayers(saved));
}
export { cellOf, hiddenAt, hiddenAtText as hiddenAtLine, splitKey };
