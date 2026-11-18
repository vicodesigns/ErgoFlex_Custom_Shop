// Preview hides: the 👁 in a lane's label (After Effects' video switch). A hidden layer is left out of the Director's
// live 3D preview only: nothing is deleted or moved, the film, the export and the cut never see it (the film's own
// show/hide is the Layers tab). Hidden objects keep their place in the scene but are not drawn, cast no shadow and can't
// be picked: their three.js layer mask goes to 0 (as stage.mjs hides a showcase's monitors) and comes back exactly.
//
// createPreviewHides({ targets, paused, wake, every })
//   targets(id)  the objects of hide id `id` now ('people', 'props', 'graphics', 'p:<person key>'), [] when none
//   paused()     true while the stage must show everything (a bake records the live canvas)
//   wake()       asks the stage for a frame after a change
// The objects are looked up again every `every` ms while something is hidden: people, props and screens are rebuilt
// as the chapter changes, and whatever comes in is hidden too.
export const HIDE_LABELS = { titles: 'Titles', graphics: 'Graphics', people: 'People', props: 'Props' };

export function createPreviewHides({ targets, paused = () => false, wake = () => {}, every = 250, setInterval: si = globalThis.setInterval, clearInterval: ci = globalThis.clearInterval } = {}) {
  const on = new Set(), masks = new Map();
  let timer = 0;
  function restoreAll() { if (!masks.size) return false; for (const [o, m] of masks) o.layers.mask = m; masks.clear(); return true; }
  function apply() {
    if (paused()) { if (restoreAll()) wake(); return; }
    const want = new Set();
    for (const id of on) for (const root of targets(id) || []) root?.traverse?.(o => { if (o.layers) want.add(o); });
    let changed = false;
    for (const [o, m] of masks) if (!want.has(o)) { o.layers.mask = m; masks.delete(o); changed = true; }
    for (const o of want) {
      if (!masks.has(o)) { masks.set(o, o.layers.mask); changed = true; }
      if (o.layers.mask !== 0) { o.layers.mask = 0; changed = true; }
    }
    if (changed) wake();
  }
  function schedule() {
    if (on.size && !timer) timer = si(apply, every);
    else if (!on.size && timer) { ci(timer); timer = 0; }
  }
  return {
    has: id => on.has(id),
    list: () => [...on],
    set(id, hidden) { if (hidden) on.add(id); else on.delete(id); apply(); schedule(); return hidden; },
    toggle(id) { return this.set(id, !on.has(id)); },
    load(ids) { on.clear(); for (const id of ids || []) if (typeof id === 'string') on.add(id); apply(); schedule(); },
    clear() { on.clear(); apply(); schedule(); },
    // show everything now (before a bake starts); the hides come back on the next pass once paused() is false
    suspend() { if (restoreAll()) wake(); },
    apply,
  };
}
