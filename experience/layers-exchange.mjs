// Layers, phase 3 (the Director side): what the Director shows and writes about the Studio's show / hide, as pure
// functions. The Studio's hides live in 'ergoflex.sceneLayers.v1' (scene-layers.mjs) and NEVER reach a film by
// themselves: the stage (a presentation frame) does not apply them, and a chapter takes one only as its own prop edit
// when Vico accepts it ("Hide here too" in the Layers tab, or the Refresh dialog). The other way, "Make permanent in
// Studio" writes a chapter's hide as a Studio hide at the chapter's time and size instead of deleting the prop from
// every chapter of the room (Studio's old `removed`). Desks and people are phase 4: their rows say so.
// Switch: ?layers=0 or localStorage['ergoflex.layers.ui'] = '0' turns all of this off (the Director as before).
import { LAYERS_KEY, cleanLayers, roomEntries, hiddenAt, chapterCell, toChapterEdits, entryKey, setCell, withEntry, kindOfId, labelOfId, propIdOf, validRoom } from '../scene-layers.mjs';
import { layersSwitch, UI_SWITCH_KEY, sizeLabel } from '../studio-layers-model.mjs';
import { propKey, cleanPropEdit, studioSceneIds } from './prop-edits.mjs';
import { cleanDeskEdit } from './desk-edits.mjs';

export { LAYERS_KEY };
export function layersOn(search = globalThis.location?.search, stored) {
  try { return layersSwitch(search, stored === undefined ? globalThis.localStorage?.getItem(UI_SWITCH_KEY) : stored); } catch { return false; }
}
// The Studio room keys of a chapter: '<room>:<layout>' (and the layout the stage built, for a shot without one).
export function chapterRooms(shot, stageLayout = null) {
  const ids = studioSceneIds(shot); if (!shot?.layout && stageLayout && shot?.room) ids.unshift(`${shot.room}:${stageLayout}`);
  return [...new Set(ids)].filter(validRoom);
}
// "First bell · 60 in" for a chapter (labels: {phase: label}).
export function chapterSetting(shot, labels = {}) {
  const p = shot?.mode, s = shot?.size;
  return [p ? labels[p] || p : '', s ? sizeLabel(s) : ''].filter(Boolean).join(' · ') || 'every time and size';
}
// Stage items (scene-prop-editor.mjs items(): {key, target, obj, name}) by Studio item id ('scene:' + sceneAssetKey).
export function stageTargets(items) {
  const out = new Map();
  for (const i of items || []) {
    const k = i?.obj?.userData?.sceneAssetKey; if (typeof k !== 'string' || !i.target) continue;
    const id = 'scene:' + k; if (!out.has(id)) out.set(id, { key: i.key, target: i.target, name: i.name || i.target.label || labelOfId(id) });
  }
  return out;
}
// What the Studio hides at this chapter's time and size, for the Layers tab's chips: Map(prop edit key -> {id})
export function studioHiddenHere(layersRaw, shot, rooms, items) {
  const layers = cleanLayers(layersRaw), out = new Map(), mode = shot?.mode || '*', size = shot?.size || '*';
  const targets = stageTargets(items);
  for (const room of rooms || []) for (const [id, e] of roomEntries(layers, room)) {
    if (!hiddenAt(e, mode, size)) continue;
    const t = targets.get(id); if (t) out.set(t.key, { id, room });
  }
  return out;
}
// A row's eye in the Layers tab: room desks (stations) wait for phase 4 (their user would stay at nothing).
// A room desk (a station): its eye hides the desk with its chair, its props and its user (deskHidePlan); the featured
// desk is the chapter's subject and stays visible. featured: the stage's selected desk record id ('main' or 'station-…').
export function stationOfItem(item) {
  const u = item?.obj?.userData || {}, k = u.sceneAssetKey || item?.target?.asset || '';
  const m = /:station:([^:]+)$/.exec(k) || /^station-(.+)$/.exec(u.sceneDeskId || '');
  return m ? m[1] : null;
}
export function rowEye(item, { featured = 'main' } = {}) {
  const st = stationOfItem(item);
  if (st || /· ErgoFlex desk$/.test(item?.name || '')) {
    if (!st) return { can: false, why: 'A desk the film builds with the room: it cannot be hidden on its own.' };
    if ('station-' + st === featured) return { can: false, why: 'The featured desk is the chapter\'s subject: it stays visible in the film.' };
    return { can: true, why: '', desk: st };
  }
  return { can: true, why: '' };
}
// Hidden-only filter and Show all in this chapter (the keys to show).
export const hiddenOnly = (items, on) => on ? (items || []).filter(i => i.hidden) : (items || []);
export const showAllKeys = items => (items || []).filter(i => i.hidden && rowEye(i).can && !stationOfItem(i)).map(i => i.key);   // (desks: their own eye, with their user)

// ---- Studio -> Director: the Refresh dialog's layer rows
// changes: diffSceneLayers rows ({id, kind, label, change, room}); targets: stageTargets(); propEdits: the chapter's.
// Returns adopt rows {kind:'layer', id, key, name, conflict, studio, chapter, take, edit} (take '' = can't: why in chapter).
export function layerAdoptRows(changes, { targets = new Map(), propEdits = [], featured = 'main', setting = '', items = [], cast = [] } = {}) {
  const tmap = new Map([...targets].map(([id, t]) => [id, t.target]));
  const edits = toChapterEdits(changes, { targets: tmap, featured });
  return edits.map((e, i) => {
    const c = changes[i], hide = c.change === 'hidden', name = targets.get(c.id)?.name || c.label || labelOfId(c.id);
    const studio = `Studio ${hide ? 'hid' : 'showed'} it${setting ? ` (${setting})` : ''}`;
    // a room desk: one row = the desk edit + its chair and props as prop hide edits + its user out of the cast
    if (e.ok && e.kind === 'desk' && e.desk) {
      const st = e.desk.desk.replace(/^station-/, ''), deskItem = (items || []).find(x => stationOfItem(x) === st);
      if (e.desk.desk === featured) return { kind: 'layer', id: c.id, key: null, name, conflict: false, studio, chapter: 'The featured desk is the chapter\'s subject: it stays visible in the film.', take: '' };
      if (!deskItem) return { kind: 'layer', id: c.id, key: null, name, conflict: false, studio, chapter: 'Not on the stage in this chapter, so the film has nothing to hide.', take: '' };
      const with_ = deskWith({ stationId: st, items, cast });
      const deskName = String(deskItem.name || name).replace(/ · ErgoFlex desk$/, '');
      return { kind: 'layer', id: c.id, key: null, name: deskName, conflict: false, studio, chapter: 'as the film has it',
        take: `${hide ? 'Hide' : 'Show'} ${deskName}${with_ ? ' with ' + with_ : ''} in this chapter too`, desk: { stationId: st, hide } };
    }
    if (!e.ok || !e.prop) return { kind: 'layer', id: c.id, key: null, name, conflict: false, studio, chapter: e.why || (e.kind === 'desk' || e.kind === 'person' ? 'Desks and people: the next step.' : 'nothing to change'), take: '' };
    const key = propKey(e.prop), mine = propEdits.find(p => propKey(p) === key) || null, now = mine?.hide === true;
    return { kind: 'layer', id: c.id, key, name, conflict: !!mine && (mine.hide === true) !== hide, studio,
      chapter: mine ? (now ? 'hidden in this chapter' : mine.hide === false ? 'shown in this chapter' : 'moved in this chapter') : 'as the film has it',
      take: hide ? 'Hide it in this chapter too' : 'Show it in this chapter too', edit: e.prop };
  });
}
// The chapter's prop edits with the taken layer rows applied (one undo step in the caller). A hide is the ordinary
// chapter hide edit; a show drops the chapter's hide (its move stays), or writes hide:false over a film's own hide.
export function applyLayerRows(propEdits, rows, { filmHides = new Set() } = {}) {
  let list = (propEdits || []).map(e => ({ ...e }));
  for (const r of rows || []) {
    if (r?.kind !== 'layer' || !r.edit) continue;
    const key = propKey(r.edit), at = list.findIndex(e => propKey(e) === key), mine = at >= 0 ? list[at] : null, hide = r.edit.hide === true;
    let next = { ...(mine || r.edit), ...(mine ? {} : {}) };
    if (hide) next.hide = true; else if (filmHides.has(key)) next.hide = false; else delete next.hide;
    const clean = cleanPropEdit(next);
    if (at >= 0) { if (clean) list[at] = clean; else list.splice(at, 1); } else if (clean) list.push(clean);
  }
  return list;
}

// ---- a room desk hidden or shown in a chapter: the desk edit, its chair and props as ordinary prop hide edits (what its
// placement says belongs to it: userData.layersStation), and its user out of (or back in) the chapter's cast. Pure:
// returns the three new lists; the caller commits them as one undo step.
//   items: the stage's items (scene-prop-editor.mjs items()); cast: the chapter's peopleEdits cast (seeded as the People
//   tab does); deskEdits / propEdits: the chapter's effective lists. -> {ok, why?, deskEdits, propEdits, cast, unnamed}
export const belongingsOf = (items, stationId) => (items || []).filter(x => x?.obj?.userData?.layersStation === stationId && !stationOfItem(x));
export function deskWith({ stationId, items = [], cast = [] }) {
  const things = belongingsOf(items, stationId).map(x => x.name.replace(/^Prop:/, '').replace(/^ergoflex-/, '').replace(/-/g, ' '));
  const people = (cast || []).filter(p => p?.station === stationId).map(p => String(p.key || '').split('-')[0]).filter(Boolean).map(k => k[0].toUpperCase() + k.slice(1));
  const all = [...new Set([...things, ...people])];
  return all.length > 1 ? all.slice(0, -1).join(', ') + ' and ' + all.at(-1) : all[0] || '';
}
export function deskHidePlan({ stationId, hide, featured = 'main', items = [], deskEdits = [], propEdits = [], cast = [] }) {
  const desk = 'station-' + stationId;
  if (!stationId || desk === featured) return { ok: false, why: 'The featured desk is the chapter\'s subject: it stays visible in the film.' };
  let desks = (deskEdits || []).map(e => ({ ...e }));
  const at = desks.findIndex(e => e.desk === desk), next = { ...(at >= 0 ? desks[at] : { desk }) };
  if (hide) next.hide = true; else delete next.hide;
  const clean = cleanDeskEdit(next);
  if (at >= 0) { if (clean) desks[at] = clean; else desks.splice(at, 1); } else if (clean) desks.push(clean);
  const mine = belongingsOf(items, stationId), unnamed = mine.filter(x => !x.target?.match).map(x => x.name);
  const props = applyLayerRows(propEdits, mine.filter(x => x.target?.match).map(x => ({ kind: 'layer', edit: { ...x.target, hide } })));
  const people = (cast || []).map(p => p?.station === stationId ? (hide ? { ...p, hide: true } : (({ hide: _, ...rest }) => rest)(p)) : p);
  return { ok: true, deskEdits: desks, propEdits: props, cast: people, unnamed, belongings: mine.map(x => x.name), users: people.filter(p => p?.station === stationId).map(p => p.key) };
}
// Make permanent of a chapter that hides room desks: their chair / prop hide edits fold back into ONE desk entry each
// (the Studio derives those items from the desk). rows: splitPermanent(...).layers; deskEdits: the chapter's.
export function foldDeskHides(rows, deskEdits) {
  const hidden = new Set((deskEdits || []).filter(e => e?.hide === true && /^station-/.test(e.desk || '')).map(e => e.desk.slice(8)));
  const kept = (rows || []).filter(r => !hidden.has(r?.obj?.userData?.layersStation));
  return [...kept, ...[...hidden].map(st => ({ editorId: 'desk:station-' + st, name: (deskEdits.find(e => e.desk === 'station-' + st)?.name) || undefined, desk: true }))];
}
// ---- Director -> Studio: Make permanent of a chapter hide = a Studio hide at the chapter's cell (never `removed`)
// The cells the dialog offers, the chapter's first (its time and size), then everywhere.
export function permanentCells(shot, labels = {}) {
  const here = chapterCell(shot);
  return [{ cell: here, label: `Hidden in Studio for ${chapterSetting(shot, labels)}` }, ...(here === '*/*' ? [] : [{ cell: '*/*', label: 'Hidden in Studio everywhere' }])];
}
// plan rows (scene-prop-editor.mjs plan(): {editorId, remove, ...}); added: the Studio room's added ids (Set).
// Returns {layers: rows that become Studio hides, assets: rows that stay sceneAssets writes}.
export function splitPermanent(rows, added = new Set()) {
  const layers = [], assets = [];
  for (const r of rows || []) (r?.remove && typeof r.editorId === 'string' && !added.has(r.editorId) ? layers : assets).push(r);
  return { layers, assets };
}
// Studio's layers value with those hides written at `cell` (raw in, raw out).
export function writePermanentLayers(raw, room, rows, cell, { t } = {}) {
  if (!validRoom(room)) throw Error('This room is not a Studio room.');
  let layers = cleanLayers(raw);
  for (const r of rows || []) {
    const id = r.editorId, key = entryKey(room, id);
    layers = withEntry(layers, room, id, setCell(layers[key] || null, cell, true, { id, kind: layers[key]?.kind || kindOfId(id), label: r.name || layers[key]?.label || labelOfId(id), propId: layers[key]?.propId || propIdOf(id) || undefined, by: 'Director', t }));
  }
  return JSON.stringify(layers);
}
