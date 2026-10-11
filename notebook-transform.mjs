// The old journal GLB used metres with a 1000× instance scale. Its authored
// replacement has millimetre geometry. Saved placements retain that old
// scale; convert only replacement notebooks, leaving uploaded GLBs alone.
export function notebookTransform(obj, transform) {
    if (!transform || !obj.userData?.authoredDeskNotebook) return transform;
    const scale = transform.s;
    // The object editor allows 1–500%. Old journal instances therefore have
    // scales of 10–5000, while the replacement uses .01–5.
    if (!scale || Math.max(...['x', 'y', 'z'].map(axis => Math.abs(scale[axis]))) < 10) return transform;
    return { ...transform, s: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, scale[axis] / 1000])) };
}
