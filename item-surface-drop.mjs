import * as THREE from 'three';

const belongs = (obj, roots) => { for (let p = obj; p; p = p.parent) if (roots.includes(p)) return true; return false; };
const usable = obj => {
    for (let p = obj; p; p = p.parent) if (!p.visible || p.userData.presentationOnly || p.userData.dropSurface === false) return false;
    return ![].concat(obj.material || []).every(m => m?.isShaderMaterial);
};

// Cast against real upward-facing geometry, including holes and sloped tops.
// The selected object's lowest point is preserved; linked contents are excluded.
export function surfaceDrop(objects, scene) {
    const roots = objects.filter(o => o.parent), selected = roots[0];
    if (!selected || !scene) return null;
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(selected), center = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
    if (b.isEmpty()) return null;
    const epsilon = Math.max(1e-7, Math.max(size.x, size.y, size.z) * 1e-6);
    const meshes = [];
    scene.traverse(o => { if (o.isMesh && !belongs(o, roots) && usable(o)) meshes.push(o); });
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let highest = -Infinity;
    // A footprint grid catches supports away from the center, while raycasting
    // through a hole finds the shelf or floor below instead of an empty AABB.
    for (const u of [-.5, 0, .5]) for (const v of [-.5, 0, .5]) {
        ray.set(new THREE.Vector3(center.x + size.x * u, b.min.y + epsilon, center.z + size.z * v), down);
        for (const hit of ray.intersectObjects(meshes, false)) {
            const matrix = hit.object.matrixWorld.clone();
            if (hit.instanceId !== undefined) { const instance = new THREE.Matrix4(); hit.object.getMatrixAt(hit.instanceId, instance); matrix.multiply(instance); }
            const normal = hit.face?.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));
            if (!normal || normal.y < .25 || hit.point.y > b.min.y + epsilon) continue;
            highest = Math.max(highest, hit.point.y); break;
        }
    }
    return Number.isFinite(highest) ? { delta: highest - b.min.y, height: highest, epsilon } : null;
}
