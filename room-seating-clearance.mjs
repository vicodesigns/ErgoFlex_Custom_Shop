import * as THREE from 'three';

const overlap = (a, b, gap = 0) => a.min.y < b.max.y && a.max.y > b.min.y &&
    a.max.x + gap > b.min.x && a.min.x - gap < b.max.x && a.max.z + gap > b.min.z && a.min.z - gap < b.max.z;
const moved = (box, x, z) => box.clone().translate(new THREE.Vector3(x, 0, z));
const area = (a, b) => a.max.y <= b.min.y || a.min.y >= b.max.y ? 0 :
    Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x)) * Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));

// Plan from the immutable authored footprints, never from the previous phase.
// This protects automatic routines without constraining free item rearranging.
export function clearLoungeSeating(life, poses) {
    const entries = life.entries, l = life.room.roomLayout, left = l.left ?? -l.width / 2;
    const tableEntries = entries.filter(e => e.role === 'table');
    const bounds = e => e.footprint.clone().applyMatrix4(poses.get(e));
    const reports = [];
    for (const seat of entries.filter(e => e.role === 'reading-chair')) {
        const initial = bounds(seat), tables = tableEntries.map(bounds);
        if (!tables.some(b => overlap(initial, b, 65))) continue;
        // Tables need hand/arm clearance. Other seats and fixed furnishings
        // are obstacles as well, so separating one pair cannot create another.
        const obstacles = [
            ...entries.filter(e => e !== seat).map(e => ({ box: bounds(e), gap: e.role === 'table' ? 65 : 25 })),
            ...(life.seatingObstacles || []).map(box => ({ box, gap: 25 }))
        ];
        const inside = b => b.min.x >= left + 25 && b.max.x <= left + l.width - 25 && b.min.z >= l.back + 25 && b.max.z <= l.back + l.depth - 25;
        const valid = (x, z) => {
            const b = moved(initial, x, z);
            return inside(b) && !obstacles.some(o => overlap(b, o.box, o.gap - .01) &&
                (o.gap === 65 || area(initial, o.box) < .01 || area(b, o.box) > area(initial, o.box) + .01));
        };
        // Search nearby offsets in order of distance. Include exact separating
        // offsets for a snug side table and a coarse grid for crowded corners.
        const candidates = [];
        for (const { box: b, gap } of obstacles) if (overlap(initial, b, gap)) {
            for (const x of [b.min.x - initial.max.x - gap, b.max.x - initial.min.x + gap]) candidates.push([x, 0]);
            for (const z of [b.min.z - initial.max.z - gap, b.max.z - initial.min.z + gap]) candidates.push([0, z]);
        }
        for (let x = -650; x <= 650; x += 50) for (let z = -650; z <= 650; z += 50) candidates.push([x, z]);
        candidates.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
        const choice = candidates.find(([x, z]) => Math.hypot(x, z) <= 700 && valid(x, z));
        if (choice) poses.set(seat, new THREE.Matrix4().makeTranslation(choice[0], 0, choice[1]).multiply(poses.get(seat)));
        else {
            // A recliner against a wall may have no space to move. Reposition
            // only its small side table; its tray, journal and cup share this
            // rigid transform. Full dining/work tables never use this fallback.
            for (const table of tableEntries.filter(e => overlap(initial, bounds(e), 65))) {
                const b = bounds(table), size = b.getSize(new THREE.Vector3());
                if (Math.max(size.x, size.z) > 1500) continue;
                const others = [...entries.filter(e => e !== table).map(bounds), ...(life.seatingObstacles || [])];
                const options = [];
                for (let x = -1000; x <= 1000; x += 50) for (let z = -1000; z <= 1000; z += 50) if (Math.hypot(x, z) <= 1000) options.push([x, z]);
                options.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
                const offset = options.find(([x, z]) => { const next = moved(b, x, z); return inside(next) && !others.some(o => overlap(next, o, 65)); });
                if (offset) poses.set(table, new THREE.Matrix4().makeTranslation(offset[0], 0, offset[1]).multiply(poses.get(table)));
            }
        }
        const resolved = !tableEntries.some(e => overlap(bounds(seat), bounds(e), 64.9));
        reports.push({ chair: seat.objects[0].userData.propId || seat.objects[0].name, resolved, offset: choice || [0, 0], movedTable: !choice && resolved });
    }
    return reports;
}
