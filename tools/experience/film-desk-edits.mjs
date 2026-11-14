// Film effects layer: Director desk edits (experience/desk-edits.mjs) on the room's other ErgoFlex desks.
// film-fx installs it for shot.sceneDeskEdits (after sceneDeskPoses), samples it per frame, and restores it on
// teardown. It runs in the presentation stage page, on the app's own api.sceneDesks records.
//
// Extension points (the DeskChoreo and DeskBuild engineers fill these in; keep them small and additive):
//   applyDesk(ctx, entry)   one desk's static setup, in order: size -> pose -> initial -> build   (DeskBuild: BUILD HOOK)
//   frameDesk(ctx, entry, seconds)   per-frame update by chapter time                              (DeskChoreo: CLIPS HOOK)
//   entry = {edit, record, was}   edit = the cleaned deskEdits entry; record = the api.sceneDesks record; was = restore data
import {seedSceneDeskSize} from '../../scene-desk-data.mjs';
import {clampStartPose} from '../../experience/start-pose.mjs';
import {createDeskChoreo} from '../../experience/desk-choreo.mjs';
const clone = v => JSON.parse(JSON.stringify(v));

// Rebuild a (not featured) record with another saved state: the model of its size, its dressing carried over.
// The same steps as SceneDesks.setSize, which only works on the featured desk.
export function rebuildRecord(desks, r, next) {
  const ctx = desks.ctx;
  desks.objects.stow.restore(r);
  r.peripherals?.dispose(); r.peripherals = null; r.peripheralConfig = null;
  r.resizeDress = {};
  for (const [role, mount] of Object.entries(r.rig?.mounts || {})) r.resizeDress[role] = [...mount.children].filter(child => {
    const item = r.objects?.get(child.userData.deskObject?.id);
    if (item?.saved.added && (!next.objects?.[item.id]?.added || next.objects?.[item.id]?.removed)) { ctx.disposeObject?.(child); return false; }
    return true;
  });
  r.state = next; r.objects = null; r.poseAt = null;
  ctx.unregisterBody?.(r.group); r.rig?.dispose(); r.rig = null; r.group = null;
  desks.ensureRig(r);
  r.rig.setBodyVisible(r.id !== desks.selected);
  return r;
}
// The state this record has at another size (its own earlier setup for that size, else seeded from this one).
export function stateAtSize(desks, r, size) {
  const { name, added, sizeSetups = {}, ...outgoing } = clone(r.state);
  const kept = { ...sizeSetups, [outgoing.size]: clone(outgoing) };
  const next = kept[size] || desks.ctx.seedDeskSize?.(r, outgoing, size) || seedSceneDeskSize(outgoing, size);
  if (!next) return null;
  delete kept[size];
  return { ...clone(next), name, added, sizeSetups: kept };
}
export function setRecordPose(desks, r, height, tilt) {
  r.state.height = height; r.state.tilt = tilt;
  r.rig.updatePose(height, tilt); r.poseAt = `${height}:${tilt}`; desks.objects?.stow?.update(r);
}
export function applyDesk(ctx, entry) {
  const { desks } = ctx, { edit, record: r } = entry;
  if (edit.size && edit.size !== r.state.size) {
    const next = stateAtSize(desks, r, edit.size);
    if (next) rebuildRecord(desks, r, next); else console.warn('[film-fx] sceneDeskEdits: ' + r.id + ' has no ' + edit.size + ' model');
  }
  if (!r.rig) desks.ensureRig(r);
  if (edit.pose) { r.state.pose = { ...edit.pose }; desks.place(r); }
  if (edit.initial) { const p = clampStartPose(edit.initial, r.state.size); setRecordPose(desks, r, p.height, p.tilt); }
  // BUILD HOOK (DeskBuild): edit.build -> wood / base / trim / accessories on this desk (experience/desk-build.mjs). The
  // accessories load a moment later: entry.pending settles when they are in (installDeskEdits().ready).
  if (edit.build) entry.pending = import('../../experience/desk-build.mjs').then(m => m.applyBuild(ctx.api, r.id, edit.build)).catch(e => console.warn('[film-fx] desk build ' + r.id, e));
  if (edit.hide === true) hideDesk(entry);   // last: after a size rebuild (frameDesk keeps it hidden after a build rebuild)
}
// CLIPS HOOK (DeskChoreo): edit.clips sampled at the chapter time (desk-choreo.mjs createDeskChoreo, in installDeskEdits)
// -> the desk's rig, held to its size's lift / tilt limits. Only a hidden desk needs anything per frame (below).
export function frameDesk(ctx, entry, seconds) { if (entry.edit.hide === true) hideDesk(entry); }
// HIDE (Layers, a chapter's accepted desk hide): the desk's group is not drawn; its screens, accessories and objects ride
// the group. Sticky (the app sets `visible` back each frame), put back on restore. A rebuilt group (a size or build
// change) is hidden again on the next frame. Its user leaves through the chapter's cast, its chair and props through
// ordinary prop hide edits (the Director writes both with it). An edit without `hide` never comes here.
export function hideDesk(entry) {
  const g = entry.record?.group; if (!g || entry.hidden?.group === g) return false;
  unhideDesk(entry);
  const own = Object.getOwnPropertyDescriptor(g, 'visible'); let raw = g.visible;
  Object.defineProperty(g, 'visible', { configurable: true, enumerable: true, get: () => false, set: v => { raw = v; own?.set?.call(g, v); } });
  entry.hidden = { group: g, restore: () => { delete g.visible; if (own && (own.get || own.set)) Object.defineProperty(g, 'visible', own); else g.visible = raw; } };
  return true;
}
export function unhideDesk(entry) { const h = entry.hidden; if (!h) return false; entry.hidden = null; try { h.restore(); } catch (error) { console.warn('[film-fx] desk unhide', error); } return true; }

export function installDeskEdits(list, api) {
  const desks = api.sceneDesks, ctx = { api, desks }, entries = [], missing = [], choreo = createDeskChoreo(api);
  for (const edit of list || []) {
    const r = desks?.records?.get(edit.desk);
    if (!r || r.id === desks.selected || r.product) { missing.push(edit.desk); continue; }
    if (!r.rig) desks.ensureRig(r);
    // What puts it back: the whole state (with its other-size setups) and the pose; a resized desk is rebuilt from it.
    const was = { state: clone(r.state), size: r.state.size };
    const entry = { edit, record: r, was };
    r.deskEditWas = was;   // the Director's panel reads the film's own size from here
    try { applyDesk(ctx, entry); entries.push(entry); } catch (error) { console.warn('[film-fx] sceneDeskEdits ' + edit.desk, error); entries.push(entry); }
  }
  if (missing.length) console.warn('[film-fx] sceneDeskEdits: no other room desk ' + missing.join(', '));
  choreo.set(entries.map(e => e.edit));
  return {
    desks: entries.map(e => e.record.id), missing,
    ready: Promise.all(entries.map(e => e.pending).filter(Boolean)),
    frame(seconds) { for (const e of entries) frameDesk(ctx, e, seconds); choreo.apply(seconds); },
    restore() {
      choreo.restore();   // each desk back to its start pose first, then the rest of the edit below
      for (const e of entries.reverse()) {
        if (e.hidden) unhideDesk(e);   // (only a hidden desk has this)
        const r = e.record; delete r.deskEditWas; if (desks.records.get(r.id) !== r) continue;
        if (e.edit.build) import('../../experience/desk-build.mjs').then(m => m.restoreBuild(api, r.id));   // before a size rebuild: the room's own style / accessories back
        const prior = clone(e.was.state);
        if (r.state.size !== e.was.size) rebuildRecord(desks, r, prior);
        else { r.state.pose = prior.pose; desks.place(r); setRecordPose(desks, r, prior.height, prior.tilt); }
      }
    },
  };
}
