// Shared studio state: per-key last-writer-wins, and finer merges for the big
// multi-entry records so two browsers editing different rooms never clobber
// each other. Pure functions; tools/studio-server.mjs owns the file and HTTP.
//
// A write carries the new raw localStorage string and its `base`, the raw
// string that browser last loaded or wrote. Only what changed between base and
// value is applied over the stored record: an entry the writer did not touch
// keeps whatever another browser saved since.
import { decodeStoredJSON, encodeStoredJSON } from '../../browser-design-storage.mjs';

// containers: paths whose children are separate entries (object keys, or array
// items by .id). ring: an array of snapshots merged as a union by `id`.
// codec 'pool' = the app's browser-design-storage encoding, 'plain' = JSON.
export const SPECS = {
  'ergoflex.sceneAssets.v1': { codec: 'plain', containers: [[]] },                 // per room:size
  'ergoflex.sceneDesksBySizeV2': { codec: 'pool', containers: [['rooms']] },        // per room/size
  'ergoflex.sceneDesksV1': { codec: 'pool', containers: [['rooms']] },
  'ergoflex.buildPresetsV1': { codec: 'pool', containers: [['entries']] },          // per preset
  'ergoflex.clientCuts.v1': { codec: 'plain', containers: [['cuts'], ['drafts']] }, // per cut / draft id
  // studio.js writeAutosave: newest first, PROJECT_AUTOSAVE_SLOTS 5, PROJECT_AUTOSAVE_BUDGET 4 MiB
  ergoflexProjectAutosaveV1: { codec: 'pool', ring: { id: 'savedAt', slots: 5, budget: 4 * 1024 * 1024 } },
};
export const SHARED_KEY = /^ergoflex/;   // never flutter.* (login/CSRF) or anything else on the origin

const decode = (spec, raw) => raw == null ? null : spec.codec === 'pool' ? decodeStoredJSON(raw) : JSON.parse(raw);
const encode = (spec, value) => spec.codec === 'pool' ? encodeStoredJSON(value) : JSON.stringify(value);
const get = (node, path) => path.reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), node);

// value -> { rest, entries: Map(id -> json string), order: {container -> [id]} }
function flatten(spec, value) {
  const entries = new Map(), order = {};
  const rest = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
  for (const path of spec.containers) {
    const c = path.join('/'), node = get(value, path), slot = path.length ? get(rest, path.slice(0, -1)) : null;
    if (!node || typeof node !== 'object') continue;
    const arrayById = Array.isArray(node) && node.every(x => x && typeof x.id === 'string');
    if (Array.isArray(node) && !arrayById) continue;   // no stable ids: the container stays in `rest`
    order[c] = [];
    for (const [k, v] of Array.isArray(node) ? node.map(x => [x.id, x]) : Object.entries(node)) {
      const id = c + '|' + k; entries.set(id, JSON.stringify(v)); order[c].push(id);
    }
    if (!path.length) { for (const k of Object.keys(rest)) delete rest[k]; }
    else slot[path.at(-1)] = Array.isArray(node) ? [] : {};
  }
  return { rest: JSON.stringify(rest), entries, order };
}
function assemble(spec, rest, entries, order) {
  const value = JSON.parse(rest);
  for (const path of spec.containers) {
    const c = path.join('/'), ids = order[c]; if (!ids) continue;
    const items = ids.filter(id => entries.has(id)).map(id => [id.slice(c.length + 1), JSON.parse(entries.get(id))]);
    if (!path.length) { for (const [k, v] of items) value[k] = v; continue; }
    const parent = get(value, path.slice(0, -1)), arr = Array.isArray(parent[path.at(-1)]);
    parent[path.at(-1)] = arr ? items.map(([, v]) => v) : Object.fromEntries(items);
  }
  return value;
}
const mergeOrder = (mine, theirs, has) => { const out = mine.filter(has); for (const id of theirs) if (has(id) && !out.includes(id)) out.push(id); return out; };

// Returns { value: raw string to store, changed: [entry ids written], removed: [entry ids], merged: bool }.
// merged = the stored record had edits from someone else that were kept.
export function mergeWrite(key, stored, value, base) {
  const spec = SPECS[key];
  if (!spec || stored == null || stored === base) return { value, changed: spec ? null : [], removed: [], merged: false };
  try {
    if (spec.ring) {
      const { id, slots, budget } = spec.ring, s = decode(spec, stored) || [], v = decode(spec, value) || [];
      if (!Array.isArray(s) || !Array.isArray(v)) throw Error('ring is not an array');
      const byId = new Map(s.map(x => [x[id], x])); for (const x of v) byId.set(x[id], x);
      let ring = [...byId.values()].sort((a, b) => String(b[id]).localeCompare(String(a[id]))).slice(0, slots), raw;
      while (ring.length && (raw = encode(spec, ring)).length > budget) ring.pop();
      return { value: raw, changed: [], removed: [], merged: true };
    }
    const S = flatten(spec, decode(spec, stored)), V = flatten(spec, decode(spec, value)), B = base == null ? null : flatten(spec, decode(spec, base));
    const changed = [], removed = [], entries = new Map(S.entries);
    for (const [id, v] of V.entries) if (!B || B.entries.get(id) !== v) { entries.set(id, v); changed.push(id); }
    if (B) for (const id of B.entries.keys()) if (!V.entries.has(id) && entries.has(id)) { entries.delete(id); removed.push(id); }
    const rest = B && B.rest === V.rest ? S.rest : V.rest;
    const order = {}; for (const c of new Set([...Object.keys(S.order), ...Object.keys(V.order)])) order[c] = mergeOrder(V.order[c] || [], S.order[c] || [], id => entries.has(id));
    return { value: encode(spec, assemble(spec, rest, entries, order)), changed, removed, merged: true };
  } catch (error) {
    // An unreadable record falls back to whole-key last-writer-wins.
    return { value, changed: null, removed: [], merged: false, error: String(error.message || error) };
  }
}

// What a write changed relative to its base, for the per-entry timestamps
// (mergeWrite's fast path, where nobody else wrote in between). Ring entries
// need none: each one's id is its own savedAt timestamp.
export function changedEntries(key, base, value) {
  const spec = SPECS[key]; if (!spec || spec.ring) return { changed: [], removed: [] };
  try {
    const V = flatten(spec, decode(spec, value)), B = base == null ? null : flatten(spec, decode(spec, base));
    return { changed: [...V.entries].filter(([id, v]) => !B || B.entries.get(id) !== v).map(([id]) => id),
             removed: B ? [...B.entries.keys()].filter(id => !V.entries.has(id)) : [] };
  } catch { return { changed: [], removed: [] }; }
}
export const entryIds = (key, raw) => changedEntries(key, null, raw).changed;
