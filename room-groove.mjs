// Physical, oriented desk routing in room-local millimetres. No Three.js,
// renderer, timers or DOM dependencies: the Studio owns the actual motion.
const TAU = Math.PI * 2;
export const angleDelta = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;

export function grooveDestination(id, l, phase) {
    const small = ['apartment', 'house'].includes(l.id), [x, z] = l.desk;
    const towardWindow = l.daylight?.[0] > x ? 1 : -1;
    const destinations = {
        morning: { x: x + towardWindow * (small ? 300 : 550), z: z + 160, yaw: towardWindow * -.12 },
        afternoon: { x, z, yaw: 0 },
        evening: { x: small ? x + 350 : l.width * .05, z: l.back + l.depth * (small ? .44 : .48), yaw: .22 },
        night: { x: x + 200, z: z + 340, yaw: .08 },
        party: { x: small ? l.width * .05 : 0, z: l.back + l.depth * .58, yaw: -.3 }
    };
    if (id === 'music' && phase === 'party') destinations.party.x = l.width * .08;
    if (id === 'gym' && phase === 'party') destinations.party.z = l.back + l.depth * .4;
    if (id === 'workshop' && phase === 'afternoon') destinations.afternoon.z += 220;
    if (id === 'library' && phase === 'evening') destinations.evening.x = -l.width * .14;
    if (id === 'scifi' && phase === 'party') destinations.party.z = l.back + l.depth * .42;
    return destinations[phase] || destinations.afternoon;
}

export function poseIsClear(p, bounds, obstacles, footprint) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), margin = footprint.margin ?? 60;
    const hw = footprint.halfWidth + margin, hd = footprint.halfDepth + margin;
    const x = p.x + c * (footprint.offsetX || 0) + s * (footprint.offsetZ || 0);
    const z = p.z - s * (footprint.offsetX || 0) + c * (footprint.offsetZ || 0);
    const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    if (x - ex < bounds.minX || x + ex > bounds.maxX || z - ez < bounds.minZ || z + ez > bounds.maxZ) return false;
    for (const o of obstacles) {
        const ox = (o.minX + o.maxX) / 2, oz = (o.minZ + o.maxZ) / 2, ow = (o.maxX - o.minX) / 2, od = (o.maxZ - o.minZ) / 2;
        const dx = ox - x, dz = oz - z;
        // Separating-axis test: room axes plus both rotated desk axes.
        if (Math.abs(dx) >= ex + ow || Math.abs(dz) >= ez + od) continue;
        if (Math.abs(c * dx - s * dz) >= hw + Math.abs(c) * ow + Math.abs(s) * od) continue;
        if (Math.abs(s * dx + c * dz) >= hd + Math.abs(s) * ow + Math.abs(c) * od) continue;
        return false;
    }
    return true;
}
export function segmentIsClear(a, b, bounds, obstacles, footprint) {
    const turn = angleDelta(a.yaw, b.yaw);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 55), Math.ceil(Math.abs(turn) / (Math.PI / 40)));
    for (let n = 0; n <= steps; n++) {
        const t = n / steps;
        if (!poseIsClear({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: a.yaw + turn * t }, bounds, obstacles, footprint)) return false;
    }
    return true;
}
class Heap {
    values = [];
    push(item) { const v = this.values; v.push(item); let n = v.length - 1; while (n) { const p = (n - 1) >> 1; if (v[p].f <= item.f) break; v[n] = v[p]; n = p; } v[n] = item; }
    pop() { const v = this.values, first = v[0], last = v.pop(); if (v.length) { let n = 0; while (2 * n + 1 < v.length) { let child = 2 * n + 1; if (child + 1 < v.length && v[child + 1].f < v[child].f) child++; if (v[child].f >= last.f) break; v[n] = v[child]; n = child; } v[n] = last; } return first; }
}

export function planGroove({ start, desired, bounds, obstacles, footprint, exact = false, maxNodes = 18000 }) {
    if (!poseIsClear(start, bounds, obstacles, footprint)) return { ok: false, reason: 'The desk needs more clearance from nearby furniture before this routine can start.' };
    if (exact && !poseIsClear(desired, bounds, obstacles, footprint)) return { ok: false, reason: 'The saved Groove position is blocked. Move nearby furniture or save a new position.' };
    if (segmentIsClear(start, desired, bounds, obstacles, footprint)) return { ok: true, route: [start, desired], destination: desired, adjusted: false, visited: 0 };
    const step = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) > 10000 ? 160 : 120, heads = 16, turn = TAU / heads;
    const pose = n => ({ x: start.x + n.x * step, z: start.z + n.z * step, yaw: start.yaw + n.h * turn });
    const key = n => `${n.x},${n.z},${n.h}`;
    const heading = ((Math.round(angleDelta(start.yaw, desired.yaw) / turn) % heads) + heads) % heads;
    const goals = new Map();
    // If the ideal spot is occupied, choose a nearby free spot. Reachability
    // still decides the result; no target can teleport across a bookshelf.
    for (const radius of [0, 120, 240, 360, 480, 720, 960, 1200]) for (let n = 0; n < (radius ? 12 : 1); n++) {
        const angle = n * TAU / 12;
        for (const h of [...new Set([heading, 0, (heading + 4) % heads, (heading + 12) % heads])]) {
            const goal = { x: Math.round((desired.x + radius * Math.cos(angle) - start.x) / step), z: Math.round((desired.z + radius * Math.sin(angle) - start.z) / step), h };
            const p = pose(goal), distance = Math.hypot(p.x - desired.x, p.z - desired.z);
            // Avoid presenting the current position as a new daily destination.
            if (Math.hypot(p.x - start.x, p.z - start.z) < 75 || !poseIsClear(p, bounds, obstacles, footprint) || (exact && !segmentIsClear(p, desired, bounds, obstacles, footprint))) continue;
            goals.set(key(goal), { ...goal, penalty: distance * 2.5 + Math.abs(angleDelta(p.yaw, desired.yaw)) * 180 });
        }
    }
    // A compact room may not permit crossing to its social zone. Include
    // reachable adjustments near the current desk, with a higher cost so a
    // useful destination nearer the intended activity wins when available.
    for (const radius of exact ? [] : [120, 240, 360, 600]) for (let n = 0; n < 12; n++) {
        for (const h of [...new Set([0, heading])]) {
            const a = n * TAU / 12, g = { x: Math.round(radius * Math.cos(a) / step), z: Math.round(radius * Math.sin(a) / step), h };
            const p = pose(g), k = key(g);
            if (goals.has(k) || Math.hypot(p.x-start.x,p.z-start.z) < 75 || !poseIsClear(p,bounds,obstacles,footprint)) continue;
            goals.set(k, {...g, penalty: 2500 + Math.hypot(p.x-desired.x,p.z-desired.z)*2.5});
        }
    }
    if (!goals.size) return { ok: false, reason: 'There is no clear destination for this setup. Try another time or give the desk more room.' };
    const goalList = [...goals.values()], heuristic = n => {
        let best = Infinity;
        for (const g of goalList) best = Math.min(best, Math.hypot(n.x-g.x,n.z-g.z)*step + g.penalty);
        return best;
    };
    const heap = new Heap(), initial = { x: 0, z: 0, h: 0, g: 0, parent: null }, best = new Map(), clear = new Map();
    initial.f = heuristic(initial); heap.push(initial); best.set(key(initial), 0);
    let visited = 0, winner = null, winnerCost = Infinity;
    while (heap.values.length && visited++ < maxNodes) {
        const node = heap.pop(), nodeKey = key(node);
        if (node.g !== best.get(nodeKey)) continue;
        if (winner && node.f >= winnerCost) break;
        if (goals.has(nodeKey)) { const cost = node.g + goals.get(nodeKey).penalty; if (cost < winnerCost) { winner = node; winnerCost = cost; } }
        const neighbours = [];
        for (const [x, z] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) neighbours.push({ x: node.x + x, z: node.z + z, h: node.h, cost: step * Math.hypot(x, z) });
        for (const sign of [-1, 1]) neighbours.push({ x: node.x, z: node.z, h: (node.h + sign + heads) % heads, cost: turn * (footprint.halfWidth + footprint.halfDepth) * .45 });
        for (const next of neighbours) {
            const k = key(next), g = node.g + next.cost;
            if (g >= (best.get(k) ?? Infinity)) continue;
            if (!clear.has(k)) clear.set(k, poseIsClear(pose(next), bounds, obstacles, footprint));
            if (!clear.get(k) || !segmentIsClear(pose(node), pose(next), bounds, obstacles, footprint)) continue;
            const item = { ...next, g, f: g + heuristic(next), parent: node }; best.set(k, g); heap.push(item);
        }
    }
    if (!winner) return { ok: false, reason: 'There is no clear route through the current furniture arrangement. Try another setup or move a nearby item.' };
    const raw = []; for (let n = winner; n; n = n.parent) raw.unshift(pose(n));
    if (exact) raw.push(desired);
    const route = [raw[0]];
    // Smooth away unnecessary grid stops, but validate the complete swept
    // footprint of every shortcut, including rotation and diagonal motion.
    for (let i = 0; i < raw.length - 1;) {
        let next = i + 1;
        for (let j = i + 2; j < raw.length; j++) if (segmentIsClear(raw[i], raw[j], bounds, obstacles, footprint)) next = j;
        route.push(raw[next]); i = next;
    }
    return { ok: true, route, destination: route.at(-1), adjusted: Math.hypot(route.at(-1).x - desired.x, route.at(-1).z - desired.z) > step, visited };
}
