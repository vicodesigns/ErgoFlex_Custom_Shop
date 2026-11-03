import * as THREE from 'three';

// Framing is based on architecture, not invisible light pools, backdrops or
// stored activity variants. Explicitly moved furnishings can extend the frame.
export function roomViewBounds(room) {
    const bounds = new THREE.Box3(), l = room.roomLayout, root = room.root;
    if (!root || !l) return bounds;
    root.updateWorldMatrix(true, true);
    const left = l.left ?? -l.width / 2;
    for (const x of [left - 80, left + l.width + 80]) for (const y of [-40, l.height + 80]) for (const z of [l.back - 80, l.back + l.depth + 80]) {
        bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld));
    }
    const visited = new Set();
    const add = o => {
        if (visited.has(o)) return; visited.add(o);
        if (!o.visible || o.userData.presentationOnly || o.userData.grooveMarker || o.userData.lightPool) return;
        if (o.isMesh && o.geometry) {
            if (o.isInstancedMesh) o.computeBoundingBox();
            else o.geometry.computeBoundingBox();
            const box = (o.isInstancedMesh ? o.boundingBox : o.geometry.boundingBox)?.clone().applyMatrix4(o.matrixWorld);
            if (box && [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) bounds.union(box);
        }
        for (const child of o.children) add(child);
    };
    // Only actual editable furnishings; the measured shell already covers
    // walls, windows and ceilings, including currently cutaway walls.
    for (const asset of room.assets()) {
        let shown = true; for (let p = asset; p && p !== root; p = p.parent) if (!p.visible || p.userData.presentationOnly || p.userData.grooveMarker) shown = false;
        if (shown) add(asset);
    }
    return bounds;
}
