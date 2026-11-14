// Show / hide ("Layers"), phase 1: the data model, pure functions only (no DOM, no three.js, nothing reads or
// writes storage here). Nothing in the app imports this module yet: the Studio, the Director and the film behave
// exactly as before. Design: C:\work\people-review\ui-design\DESIGN.md (sections 3 and 4).
//
// Shared key 'ergoflex.sceneLayers.v1' (tools/studio-state/merge.mjs: plain JSON, one merge entry per item):
//   { '<room>[:<layout>]|<item id>': entry, ... }
//   item id   'scene:<sceneAssetKey>'   a Studio scene asset (room prop, fixture, wall piece, lamp, added item, copy)
//             'desk:<record id>'        an ErgoFlex desk of the room: desk:main, desk:station-<id>, desk:added-<uuid>
//             'person:<cast key>'       a person of the room's cast (the key films use in only / except / cast[].key)
//   entry     { kind: 'desk'|'person'|'prop'|'fixture'|'wall'|'light'|'added', label?, propId?, at?: [x, z] (layout mm,
//               the item's designed place: a fingerprint for index-keyed ids), model?, legacy?: 'removed'|'deleted',
//               cells: { '<phase|*>/<size|*>': true (hidden) | false (shown: an exception to a wider hide) }, by?, t? }
// A cell is the room's daypart (morning … party, the Studio's "First bell", "Wave lab" …) and the room's desk-size
// setting (48x30 / 60x30), with '*' for every one. The most specific cell decides: phase/size, then phase/*, then
// */size, then */*; no cell at all = shown. An entry hidden nowhere is dropped, except a migrated legacy one, which is
// kept (shown) so a later migration does not hide it again.
export const LAYERS_KEY = 'ergoflex.sceneLayers.v1';
export const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
export const SIZES = ['48x30', '60x30'];
export const KINDS = ['desk', 'person', 'prop', 'fixture', 'wall', 'light', 'added'];
// Scope of a hide (the panel's chip): this time & size, this time (both sizes), this size (every time), everywhere.
export const SCOPES = ['cell', 'time', 'size', 'all'];
// The distance (mm) within which an index-keyed prop is still "the same prop" when its index moved (resolveAlias).
export const ALIAS_MM = 300;

const finite = v => typeof v === 'number' && Number.isFinite(v);
const CELL = new RegExp(`^(${PHASES.join('|')}|\\*)/(${SIZES.join('|')}|\\*)$`);
const ROOM = /^[a-z][a-z0-9]{0,40}(:[a-z0-9-]{1,40})?$/;
// (scene asset keys may hold spaces: '<room>:<layout>:placement:93:0:Wainscot cap rail'; never '|' or a line break)
const ITEM = /^(scene:[^|\r\n\t]{1,300}|desk:[a-z][a-z0-9-]{0,79}|person:[a-z0-9][a-z0-9_-]{0,47})$/i;
const ASSET = /^[a-z0-9@][a-z0-9._@-]{0,119}$/i;
const LEGACY = ['removed', 'deleted'];
const MAX_ENTRIES = 5000;
const text = (v, n) => typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined;
const parse = raw => { if (raw && typeof raw === 'object') return raw; try { const v = raw ? JSON.parse(raw) : {}; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };

// ---- keys
export const entryKey = (room, id) => `${room}|${id}`;
export function splitKey(key) { const i = String(key).indexOf('|'); return i < 0 ? null : { room: key.slice(0, i), id: key.slice(i + 1) }; }
export const validRoom = room => typeof room === 'string' && ROOM.test(room);
export const validItem = id => typeof id === 'string' && ITEM.test(id);
// Studio desk rooms are '<room>/<layout>' (scene-desk-data.mjs), scene assets '<room>:<layout>' (studio.js sceneAssetState).
export const deskRoomKey = room => String(room).replace(':', '/');
export const assetRoomKey = deskRoom => String(deskRoom).replace('/', ':');

// ---- cells
export function cellOf(phase, size) {
  const p = phase == null || phase === '*' ? '*' : phase, s = size == null || size === '*' ? '*' : size;
  const cell = `${p}/${s}`; if (!CELL.test(cell)) throw Error(`Not a layers cell: ${cell}`); return cell;
}
const parts = cell => { const [phase, size] = cell.split('/'); return { phase, size }; };
// The cell a hide writes for a scope, at the current time and size.
export function scopeCell(scope, phase, size) {
  if (scope === 'cell') return cellOf(phase, size);
  if (scope === 'time') return cellOf(phase, '*');
  if (scope === 'size') return cellOf('*', size);
  if (scope === 'all') return '*/*';
  throw Error(`Not a layers scope: ${scope}`);
}
// a covers b: a is b or wider (every (phase, size) b names, a names too)
export function covers(a, b) { const A = parts(a), B = parts(b); return (A.phase === '*' || A.phase === B.phase) && (A.size === '*' || A.size === B.size); }
// The cells that decide (phase, size), most specific first.
const lookups = (phase, size) => [`${phase}/${size}`, `${phase}/*`, `*/${size}`, '*/*'];
function resolve(cells, phase, size) {
  for (const c of lookups(phase || '*', size || '*')) if (cells && typeof cells[c] === 'boolean') return cells[c];
  return false;
}
// Is the item hidden at this time and size? (entry null or absent = shown)
export const hiddenAt = (entry, phase, size) => !!entry && resolve(entry.cells, phase, size);
// Is it hidden anywhere at all (any phase and size, '*' included)? For the panel's "hidden anywhere" filter.
export function hiddenAnywhere(entry) {
  if (!entry?.cells) return false;
  for (const p of PHASES) for (const s of SIZES) if (resolve(entry.cells, p, s)) return true;
  return false;
}
// Where it is hidden: the concrete (phase, size) pairs, for the scope sheet's "Hidden at: …".
export function hiddenCells(entry) {
  const out = []; if (!entry?.cells) return out;
  for (const p of PHASES) for (const s of SIZES) if (resolve(entry.cells, p, s)) out.push(`${p}/${s}`);
  return out;
}
// Drop cells that change nothing: a cell goes when the answer at every (phase, size), the '*' ones included (rooms
// without dayparts), is the same without it. Narrowest first, so an exception is weighed against its wider rule.
const ALL_PAIRS = [...PHASES, '*'].flatMap(p => [...SIZES, '*'].map(s => [p, s]));
const answers = cells => ALL_PAIRS.map(([p, s]) => resolve(cells, p, s)).join();
function prune(cells) {
  const out = { ...cells }, want = answers(out);
  for (const c of Object.keys(out).sort((a, b) => specificity(b) - specificity(a))) {
    const v = out[c]; delete out[c];
    if (answers(out) !== want) out[c] = v;
  }
  return out;
}
const specificity = cell => { const { phase, size } = parts(cell); return (phase !== '*' ? 2 : 0) + (size !== '*' ? 1 : 0); };

// ---- entries
export function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !KINDS.includes(e.kind)) return null;
  const cells = {};
  for (const [c, v] of Object.entries(e.cells && typeof e.cells === 'object' ? e.cells : {}).slice(0, 40)) if (CELL.test(c) && typeof v === 'boolean') cells[c] = v;
  const out = { kind: e.kind }, label = text(e.label, 120), by = text(e.by, 40);
  if (label) out.label = label;
  if (typeof e.propId === 'string' && ASSET.test(e.propId)) out.propId = e.propId;
  if (Array.isArray(e.at) && e.at.length === 2 && e.at.every(n => finite(n) && Math.abs(n) < 1e6)) out.at = e.at.map(n => Math.round(n / 10) * 10);
  if (typeof e.model === 'string' && /^people-[a-z0-9][a-z0-9._-]{0,90}$/i.test(e.model)) out.model = e.model;
  if (LEGACY.includes(e.legacy)) out.legacy = e.legacy;
  const kept = prune(cells);
  if (!Object.values(kept).some(Boolean)) {
    if (!out.legacy) return null;   // shown everywhere: no entry
    out.cells = { '*/*': false };   // a migrated item shown again stays recorded, so migration does not hide it again
  } else out.cells = kept;
  if (by) out.by = by;
  if (finite(e.t) && e.t > 0) out.t = Math.round(e.t);
  return out;
}
export function cleanLayers(v) {
  const all = parse(v), out = {};
  for (const [key, e] of Object.entries(all)) {
    if (Object.keys(out).length >= MAX_ENTRIES) break;
    const k = splitKey(key); if (!k || !validRoom(k.room) || !validItem(k.id)) continue;
    const c = cleanEntry(e); if (c) out[key] = c;
  }
  return out;
}
// The entry with `cell` set to hidden (true) or shown (false). Narrower cells inside it are cleared (the new
// rule decides all of them); a show inside a wider hide is kept as an exception. meta: {kind, label, propId, at,
// model, by, t} for a new entry (and refreshed on an existing one). Returns the new entry, or null (shown everywhere).
export function setCell(entry, cell, hidden, meta = {}) {
  if (!CELL.test(cell)) throw Error(`Not a layers cell: ${cell}`);
  const base = entry ? structuredClone(entry) : {};
  const cells = Object.fromEntries(Object.entries(base.cells || {}).filter(([c]) => !(c !== cell && covers(cell, c))));
  cells[cell] = !!hidden;
  const next = { ...base, ...Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)), cells };
  if (!next.kind) next.kind = kindOfId(meta.id || '');
  delete next.id;
  return cleanEntry(next);
}
// The whole layers value with one item set (null entry = removed). Pure: returns a new object.
export function withEntry(layers, room, id, entry) {
  const out = { ...layers }, key = entryKey(room, id);
  if (entry) out[key] = entry; else delete out[key];
  return out;
}
// The entries of one room: Map(item id -> entry).
export function roomEntries(layers, room) {
  const out = new Map();
  for (const [key, e] of Object.entries(layers || {})) { const k = splitKey(key); if (k?.room === room) out.set(k.id, e); }
  return out;
}

// ---- kinds and names from ids
export function kindOfId(id) {
  const s = String(id);
  if (s.startsWith('desk:') || /:station:[^:]+$/.test(s)) return 'desk';
  if (s.startsWith('person:') || /:person:/.test(s)) return 'person';
  if (/:fixture:/.test(s)) return 'fixture';
  if (/:(custom|copy):/.test(s)) return 'added';
  return 'prop';
}
// The library prop id at the end of an index-keyed room prop id ('…:room:24:ergoflex-small-bookshelf'), else null.
export function propIdOf(id) { const m = /:room:\d+:([^:]+)$/.exec(String(id)) || /:custom:[^:]+:([^:]+)$/.exec(String(id)); return m ? m[1] : null; }
export const indexKeyed = id => /:room:\d+:[^:]+$/.test(String(id));
// A readable name from an id when the room has none to give: 'ergoflex-small-bookshelf' -> 'Small bookshelf'.
export function labelOfId(id) {
  const last = String(id).replace(/^(scene|desk|person):/, '').split(':').pop() || 'Item';
  const n = last.replace(/^(station-)/, '').replace(/^(kenney-furniture-|ergoflex-|quaternius-|kenney-|atelier-|people-)/, '').replace(/[-_]+/g, ' ').trim();
  return n ? n[0].toUpperCase() + n.slice(1) : 'Item';
}

// ---- migration of the old delete lists (read only: neither list is changed)
// room: '<room>[:<layout>]' (the scene-asset key). assets: that room's 'ergoflex.sceneAssets.v1' value ({removed, …}).
// desks: that room's 'ergoflex.sceneDesksBySizeV2' room ({desks, deleted, …}). layers: the whole layers value.
// placements: optional Map(item id -> {label, propId, at:[x, z], kind}) from the built room (labels, fingerprints).
// Every id in removed / deleted that has no entry yet becomes one, hidden everywhere, legacy 'removed' / 'deleted'.
// An existing entry always wins (also a shown one). Idempotent. Returns {layers, added: [entry keys]}.
export function migrateRoom({ room, assets = null, desks = null, layers = {}, placements = null, by = 'migration', t = undefined }) {
  if (!validRoom(room)) throw Error(`Not a room key: ${room}`);
  const out = { ...cleanLayers(layers) }, added = [];
  const add = (id, legacy, kind) => {
    if (!validItem(id)) return;
    const key = entryKey(room, id); if (out[key]) return;
    const p = placements?.get?.(id) || {};
    const e = cleanEntry({ kind: p.kind || kind, label: p.label || labelOfId(id), propId: p.propId || propIdOf(id) || undefined, at: p.at, legacy, cells: { '*/*': true }, by, t });
    if (e) { out[key] = e; added.push(key); }
  };
  for (const id of Array.isArray(assets?.removed) ? assets.removed : []) add(id, 'removed', kindOfId(id));
  for (const id of Array.isArray(desks?.deleted) ? desks.deleted : []) add('desk:' + id, 'deleted', 'desk');
  return { layers: out, added };
}

// ---- index-keyed ids: find the prop an entry means when the room's list moved its index
// id: the entry's item id; entry: its entry (propId, at); candidates: [{id, propId, at:[x, z]}] the room's props as
// built now. Returns {id, alias:false} (the same id still means it), {id:'<other id>', alias:true}, or null (missing).
export function resolveAlias(id, entry, candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const want = entry?.propId || propIdOf(id), at = entry?.at;
  const dist = c => at && Array.isArray(c.at) ? Math.hypot(c.at[0] - at[0], c.at[1] - at[1]) : null;
  const same = list.find(c => c.id === id);
  if (!indexKeyed(id)) return same ? { id, alias: false } : null;
  if (same && (!want || same.propId === want) && (dist(same) === null || dist(same) <= ALIAS_MM)) return { id, alias: false };
  const pool = list.filter(c => want && c.propId === want);
  if (at) {
    const best = pool.map(c => ({ c, d: dist(c) })).filter(x => x.d !== null && x.d <= ALIAS_MM).sort((a, b) => a.d - b.d)[0];
    return best ? { id: best.c.id, alias: best.c.id !== id } : null;
  }
  return pool.length === 1 ? { id: pool[0].id, alias: pool[0].id !== id } : null;
}

// ---- Studio -> Director: what the Studio hid or showed at a chapter's time and size
// before / after: two values of the layers key (raw strings or objects); room: the chapter's room key; phase, size:
// the chapter's (shot.mode, shot.size). Returns [{id, kind, label, change:'hidden'|'shown'}], by item id.
export function diffLayers(before, after, room, phase, size) {
  const b = roomEntries(cleanLayers(before), room), a = roomEntries(cleanLayers(after), room), out = [];
  for (const id of [...new Set([...b.keys(), ...a.keys()])].sort()) {
    const was = hiddenAt(b.get(id), phase, size), now = hiddenAt(a.get(id), phase, size);
    if (was === now) continue;
    const e = a.get(id) || b.get(id);
    out.push({ id, kind: e.kind, label: e.label || labelOfId(id), change: now ? 'hidden' : 'shown' });
  }
  return out;
}
// The time and size cell of a film chapter (cut shot fields mode, size).
export const chapterCell = shot => cellOf(PHASES.includes(shot?.mode) ? shot.mode : '*', SIZES.includes(shot?.size) ? shot.size : '*');

// ---- the chapter edits that carry a Studio hide into a chapter (adopted in the Director)
// rows: diffLayers rows; names: Map(item id -> the object's name on the stage) for scene assets (the film's edits
// match by name, experience/prop-edits.mjs); featured: the chapter's featured desk record id (never hidden).
// Returns [{id, kind, ok, why?, prop?: propEdit, desk?: deskEdit, person?: {key, hide}}]; hide:false shows again.
const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
// targets: Map(item id -> the Director's own film target for that object ({match, asset?, path?, near?, label}),
// scene-prop-editor.mjs targetFor); preferred over names, which only give '^name$' (not unique when twins share a name).
export function toChapterEdits(rows, { names = new Map(), targets = new Map(), featured = 'main' } = {}) {
  return (rows || []).map(r => {
    const hide = r.change === 'hidden', id = r.id;
    if (id.startsWith('desk:')) {
      const desk = id.slice(5);
      if (desk === featured || desk === 'main') return { id, kind: 'desk', ok: false, why: 'The featured desk is the chapter\'s subject: it stays visible in the film.' };
      return { id, kind: 'desk', ok: true, desk: { desk, hide } };
    }
    if (id.startsWith('person:')) return { id, kind: 'person', ok: true, person: { key: id.slice(7), hide } };
    const asset = id.replace(/^scene:/, ''), target = targets.get?.(id), name = names.get?.(id);
    if (target && typeof target.match === 'string') return { id, kind: r.kind, ok: true, prop: { ...target, hide } };
    if (!name) return { id, kind: r.kind, ok: false, why: 'Not on the stage in this chapter, so the film has nothing to hide.' };
    return { id, kind: r.kind, ok: true, prop: { match: '^' + escapeRegex(name) + '$', asset, label: name, hide } };
  });
}
// ---- Director -> Studio: the hides a chapter makes (Make permanent in Studio)
// shot: the cut shot (propEdits, deskEdits, peopleEdits). Returns [{id, hidden}] for edits that hide or show one item
// Studio knows: props with a Studio asset key, room desks, people of the cast. (Added props are not Studio items.)
export function fromChapterEdits(shot) {
  const out = [];
  for (const e of Array.isArray(shot?.propEdits) ? shot.propEdits : []) if (typeof e?.hide === 'boolean' && typeof e.asset === 'string' && !e.add) out.push({ id: 'scene:' + e.asset, hidden: e.hide, label: e.label });
  for (const e of Array.isArray(shot?.deskEdits) ? shot.deskEdits : []) if (e?.hide === true && typeof e.desk === 'string') out.push({ id: 'desk:' + e.desk, hidden: true, label: e.name });
  for (const p of Array.isArray(shot?.peopleEdits?.cast) ? shot.peopleEdits.cast : []) if (p?.hide === true && typeof p.key === 'string') out.push({ id: 'person:' + p.key, hidden: true, model: p.id });
  return out.filter(r => validItem(r.id));
}
// Studio's layers value with chapter hides written at `cell` (the chapter's, or wider if Vico chose): raw string in,
// raw string out (as prop-edits.mjs writeSceneAssets does for the props key).
export function writeSceneLayers(raw, room, rows, cell, { by = 'Director', t = undefined } = {}) {
  if (!validRoom(room)) throw Error('This room is not a Studio room.');
  let layers = cleanLayers(raw);
  for (const r of rows || []) {
    if (!validItem(r.id)) continue;
    const key = entryKey(room, r.id);
    const next = setCell(layers[key] || null, cell, r.hidden, { id: r.id, kind: layers[key]?.kind || kindOfId(r.id), label: r.label || layers[key]?.label || labelOfId(r.id), model: r.model, propId: layers[key]?.propId || propIdOf(r.id) || undefined, by, t });
    layers = withEntry(layers, room, r.id, next);
  }
  return JSON.stringify(layers);
}

// ---- people at hidden desks (for phase 4; pure)
// Which cast keys are out at this time and size: their own entry, or the desk they work at is hidden.
// cast: [{key, station?, desk?}] (station: the room desk's station id; desk without station: the featured desk's user).
export function hiddenPeople(layers, room, cast, phase, size) {
  const entries = roomEntries(layers, room), out = new Set();
  for (const p of cast || []) {
    if (hiddenAt(entries.get('person:' + p.key), phase, size)) { out.add(p.key); continue; }
    const desk = p.station ? 'desk:station-' + p.station : p.desk ? 'desk:main' : null;
    if (desk && hiddenAt(entries.get(desk), phase, size)) out.add(p.key);
  }
  return out;
}
