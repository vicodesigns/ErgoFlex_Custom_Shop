import * as THREE from 'three';

// Resolve authored tabletop contact once, before Studio applies saved edits.
// Imported tables can have an inset surface below their advertised full height.
export function settleActivitySupports(life) {
    const { room, anchor, activity, shared } = life, root = room.root;
    root.updateWorldMatrix(true, true);
    const table = root.children.find(o => anchor.support && (o.userData.propId === anchor.support || o.name === anchor.support));
    const meshes = [];
    (table || root).traverseVisible(o => {
        if (!o.isMesh || o.userData.presentationOnly) return;
        for (let p = o; p; p = p.parent) if (p === activity || p === shared) return;
        meshes.push(o);
    });
    const down = new THREE.Vector3(0, -1, 0).transformDirection(root.matrixWorld);
    const contacts = [];
    for (const item of [activity, shared].filter(Boolean)) {
        const origin = item.position.clone(); origin.y += 160;
        const ray = new THREE.Raycaster(root.localToWorld(origin), down, 0, 360 * root.scale.x);
        const hits = ray.intersectObjects(meshes, false).filter(hit =>
            hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(down) < -.95);
        // Choose the nearby horizontal support. Never drop an unresolved kit
        // onto the floor, or search for a different piece of furniture.
        // A thin runner or mat is the contact surface, even when the bare
        // table underneath is numerically nearer the authored height.
        const hit = hits.find(h => h.distance / root.scale.x >= 125);
        if (!hit) { contacts.push({ name: item.name, resolved: false }); continue; }
        const top = root.worldToLocal(hit.point.clone()).y;
        const correction = top + 1 - item.position.y;
        item.position.y += correction; item.updateMatrixWorld(true);
        contacts.push({ name: item.name, resolved: true, correction, height: top });
    }
    root.userData.activitySupports = contacts;
    // Existing loose journals/cups must use the same imported surface as the
    // daily kit. Work only on the builders' initial, root-level prop placements.
    const tables = root.children.filter(o => /^(coffee-table(-2)?|ergoflex-coffee-table|ergoflex-triangle-table)$/.test(o.userData.propId || ''));
    const corrected = [];
    for (const support of tables) {
        const b = new THREE.Box3().setFromObject(support).applyMatrix4(root.matrixWorld.clone().invert());
        const surfaces = []; support.traverseVisible(o => { if (o.isMesh && !o.userData.presentationOnly) surfaces.push(o); });
        for (const item of root.children) {
            if (item === support || !item.userData.propId || item === activity || item === shared || item.position.y < 250) continue;
            const p = item.position;
            if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z || p.y > b.max.y + 160) continue;
            const ray = new THREE.Raycaster(root.localToWorld(new THREE.Vector3(p.x, p.y + 160, p.z)), down, 0, 320 * root.scale.x);
            const hit = ray.intersectObjects(surfaces, false).find(h => h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(down) < -.95);
            if (!hit) continue;
            const correction = root.worldToLocal(hit.point.clone()).y + 1 - p.y;
            if (Math.abs(correction) <= 2) continue;
            p.y += correction; item.updateMatrixWorld(true);
            corrected.push({ prop: item.userData.propId, correction });
        }
    }
    root.userData.activityLooseSupports = corrected;
}

// Seat directions come from the actual supporting table, including end seats.
// All measurements are base-layout millimetres; the routine remains reversible.
export function bindMeetingSeats(entries) {
    const tables = entries.filter(e => e.role === 'table');
    for (const seat of entries.filter(e => e.role === 'meeting-chair')) {
        const candidates = tables.map(table => {
            const b = table.footprint, p = seat.pivot;
            const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
            const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
            return { table, distance: Math.hypot(dx, dz) };
        }).filter(c => c.distance < 850).sort((a, b) => a.distance - b.distance);
        if (!candidates.length) continue;
        const table = candidates[0].table, b = table.footprint, center = b.getCenter(new THREE.Vector3());
        const dx = seat.pivot.x - center.x, dz = seat.pivot.z - center.z;
        const alongX = Math.abs(dx) / Math.max(1, b.max.x - b.min.x) > Math.abs(dz) / Math.max(1, b.max.z - b.min.z);
        seat.tableSeat = { table, normal: alongX ? [Math.sign(dx), 0] : [0, Math.sign(dz)] };
    }
}

export function meetingSeatPose(life, entry, phase) {
    if (!entry.tableSeat) return null;
    const { table, normal: [nx, nz] } = entry.tableSeat, p = entry.pivot;
    const seed = Math.sin(p.x * .017 + p.z * .031) * .5 + .5;
    const factor = Math.min(1.1, life.factor);
    const pull = [25, 100, 65, -30, 140][phase] * factor * (.8 + seed * .4);
    const yaw = [0.02, .05, .10, 0, .16][phase] * (seed - .5);
    const pose = new THREE.Matrix4().makeTranslation(p.x + nx * pull, 0, p.z + nz * pull)
        .multiply(new THREE.Matrix4().makeRotationY(yaw))
        .multiply(new THREE.Matrix4().makeTranslation(-p.x, 0, -p.z));
    // The seats follow the table's modest daypart adjustment as one seating
    // area, then pull outward. Keep the authored room perimeter clear.
    pose.premultiply(life.authoredPose(table, phase));
    const b = entry.footprint.clone().applyMatrix4(pose), l = life.room.roomLayout;
    const left = l.left ?? -l.width / 2;
    const dx = Math.max(0, left + 20 - b.min.x) - Math.max(0, b.max.x - (left + l.width - 20));
    const dz = Math.max(0, l.back + 20 - b.min.z) - Math.max(0, b.max.z - (l.back + l.depth - 20));
    return new THREE.Matrix4().makeTranslation(dx, 0, dz).multiply(pose);
}
