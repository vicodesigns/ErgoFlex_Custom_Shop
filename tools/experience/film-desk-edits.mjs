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
}
// CLIPS HOOK (DeskChoreo): edit.clips sampled at the chapter time (desk-choreo.mjs createDeskChoreo, in installDeskEdits)
// -> the desk's rig, held to its size's lift / tilt limits. Nothing per desk is left to do here.
export function frameDesk(ctx, entry, seconds) {}

export function installDeskEdits(list, api) {
  const desks = api.sceneDesks, ctx = { api, desks }, entries = [], missing = [], choreo = createDeskChoreo(api);
  for (const edit of list || []) {
    const r = desks?.records?.get(edit.desk);
    if (!r || r.id === desks.selected || r.product) { missing.push(edit.desk); continue; }
    if (!r.rig) desks.ensureRig(r);
    // What puts it back: the whole state (with its other-size setups) and the pose; a resized desk is rebuilt from it.
    const was = { state: clone(r.state), size: r.state.size };
    const entry = { edit, record: r, was };
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
        const r = e.record; if (desks.records.get(r.id) !== r) continue;
        if (e.edit.build) import('../../experience/desk-build.mjs').then(m => m.restoreBuild(api, r.id));   // before a size rebuild: the room's own style / accessories back
        const prior = clone(e.was.state);
        if (r.state.size !== e.was.size) rebuildRecord(desks, r, prior);
        else { r.state.pose = prior.pose; desks.place(r); setRecordPose(desks, r, prior.height, prior.tilt); }
      }
    },
  };
}
