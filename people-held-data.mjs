// The stored shape of a posture's held offsets (people-held.mjs), with no three.js: the Director page and node read it.
const BONE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const fin = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
// The stored shape, numbers kept exactly (an import boundary: people-postures.mjs validateArchivedKeys).
export function archivedHeld(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const out = {};
    for (const [bone, h] of Object.entries(value)) {
        if (!BONE.test(bone) || !h || typeof h !== 'object' || Array.isArray(h)) continue;
        const one = {};
        if (Array.isArray(h.at) && h.at.length === 3 && h.at.every(v => fin(v, -2, 2))) one.at = [...h.at];
        if (Array.isArray(h.turn) && h.turn.length === 3 && h.turn.every(v => fin(v, -360, 360))) one.turn = [...h.turn];
        if (fin(h.scale, .1, 10)) one.scale = h.scale;
        if (!isIdentity(one)) out[bone] = one;
    }
    return Object.keys(out).length ? out : undefined;
}
export const isIdentity = h => !h || (!h.at || h.at.every(v => Math.abs(v) < 1e-9)) && (!h.turn || h.turn.every(v => Math.abs(v) < 1e-9)) && (h.scale === undefined || Math.abs(h.scale - 1) < 1e-9);


// ---- what a stage model holds (no three.js needed: the Director's pose panel reads the stage's objects)
const isHeld = m => /^Held\./.test(m?.name || '');
export const partsOf = object => { const out = []; object.traverse(o => { if (o.isSkinnedMesh && [].concat(o.material).some(isHeld)) out.push(o); }); return out; };
// the bone a held part hangs on (all of a held thing's vertices hang on one bone, weight 1: build_people.py)
export const boneOf = mesh => { const si = mesh.geometry.getAttribute('skinIndex'); const j = si ? si.getComponent(0, 0) : -1; return (mesh.userData.heldOriginal || mesh.skeleton).bones[j]?.name || null; };
const nameOf = mesh => [].concat(mesh.material).filter(isHeld).map(m => m.name.slice(5).replace(/\s+\d+$/, '').replace(/ (on|off)$/, '')).find(Boolean) || 'held thing';
// What a model holds: [{ bone, label }] (one per bone, the names of its things joined).
export function heldItems(object) {
    const by = new Map();
    for (const m of partsOf(object)) { const b = boneOf(m); if (!b) continue; if (!by.has(b)) by.set(b, new Set()); by.get(b).add(nameOf(m)); }
    return [...by].map(([bone, names]) => ({ bone, label: [...names].join(', ') }));
}

