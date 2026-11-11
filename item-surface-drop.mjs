import * as THREE from 'three';

const belongs = (obj, roots) => { for (let p = obj; p; p = p.parent) if (roots.includes(p)) return true; return false; };
export const usable = obj => {
    for (let p = obj; p; p = p.parent) if (!p.visible || p.userData.presentationOnly || p.userData.dropSurface === false) return false;
    return ![].concat(obj.material || []).every(m => m?.isShaderMaterial);
};

// A mesh no thicker than 12 mm that lies within 15 mm of another support is a decal, not a surface. Studio items are
// authored in millimetres inside a scaled root, so one millimetre in world units is the item's parent world scale.
export const mmOf = obj => { const s = obj?.parent ? obj.parent.getWorldScale(new THREE.Vector3()).x : 1; return Number.isFinite(s) && s > 0 ? s : 1; };
const isThin = (obj, mm) => { const b = new THREE.Box3().setFromObject(obj); return !b.isEmpty() && b.max.y - b.min.y <= 12 * mm; };

// Cast against real upward-facing geometry, including holes and sloped tops.
// The selected object's lowest point is preserved; linked contents are excluded.
export function surfaceDrop(objects, scene) {
    const roots = objects.filter(o => o.parent), selected = roots[0];
    if (!selected || !scene) return null;
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(selected), center = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
    if (b.isEmpty()) return null;
    const mm = mmOf(selected), epsilon = Math.max(1e-7, Math.max(size.x, size.y, size.z) * 1e-6);
    const meshes = [];
    scene.traverse(o => { if (o.isMesh && !belongs(o, roots) && usable(o)) meshes.push(o); });
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let highest = -Infinity;
    // A footprint grid catches supports away from the center, while raycasting
    // through a hole finds the shelf or floor below instead of an empty AABB.
    for (const u of [-.5, 0, .5]) for (const v of [-.5, 0, .5]) {
        ray.set(new THREE.Vector3(center.x + size.x * u, b.min.y + epsilon, center.z + size.z * v), down);
        const supports = ray.intersectObjects(meshes, false).filter(hit => {
            const matrix = hit.object.matrixWorld.clone();
            if (hit.instanceId !== undefined) { const instance = new THREE.Matrix4(); hit.object.getMatrixAt(hit.instanceId, instance); matrix.multiply(instance); }
            const normal = hit.face?.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));
            return normal && normal.y >= .25 && hit.point.y <= b.min.y + epsilon;
        });
        let pick = supports[0];
        // A thin sheet lying on something (a floor sign, a sticker) is not a surface: rest on what it lies on.
        while (pick && isThin(pick.object, mm)) {
            const next = supports.slice(supports.indexOf(pick) + 1).find(h => h.object !== pick.object);
            if (!next || pick.point.y - next.point.y > 15 * mm) break;
            pick = next;
        }
        if (pick) highest = Math.max(highest, pick.point.y);
    }
    return Number.isFinite(highest) ? { delta: highest - b.min.y, height: highest, epsilon } : null;
}
