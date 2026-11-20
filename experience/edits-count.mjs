// How much work a Director project holds (19 Nov 2026): prop edits, people (cast entries), pose keys and corrections, and
// camera keys of its chapters. The autosave store's shrink guard (tools/studio-state/autosave-store.mjs) and the film
// banner's "your draft has N more edits" (film-fresh.mjs) count the same way. Pure.
export function editsOf(project) {
  let n = 0;
  for (const s of project?.shots || []) {
    n += (Array.isArray(s.propEdits) ? s.propEdits.length : 0) + (Array.isArray(s.camera?.keys) ? s.camera.keys.length : 0);
    for (const e of s.peopleEdits?.cast || []) { n += 1; for (const r of Object.values(e.postures || {})) n += (r?.poseKeys?.length || 0) + (r?.pose ? 1 : 0); n += e.poseKeys?.length || 0; }
  }
  return n;
}
