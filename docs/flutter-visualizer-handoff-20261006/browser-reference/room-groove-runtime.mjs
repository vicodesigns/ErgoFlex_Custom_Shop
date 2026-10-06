import * as THREE from 'three';
import { angleDelta, grooveDestination, planGroove, segmentIsClear, poseIsClear } from './room-groove.mjs?v=desktop-tilt-reach-20261006';

// Cutaway visibility is a camera choice. Hidden walls and furnishings still
// occupy physical space; architecture is handled by the room bounds.
export function grooveObstacles(room) {
    const root = room.root, walls = new Set(room.walls.map(w => w.obj));
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), obstacles = [];
    const candidates = [];
    for (const child of root.children) {
        if (walls.has(child)) {
            child.traverse(o => { if (o !== child && o.userData.sceneAsset) candidates.push(o); });
        } else candidates.push(child);
    }
    for (const obj of candidates) {
        if (obj.userData.grooveMarker || obj.isLight) continue;
        // Compute in room coordinates, without first rotating a world AABB.
        const box = new THREE.Box3();
        obj.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            box.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));
        });
        const size = box.getSize(new THREE.Vector3());
        if (box.isEmpty() || box.min.y > 240 || size.y < 80 || size.x < 100 || size.z < 100) continue;
        // Floor slabs, rugs and architectural shells are not furniture.
        if (size.x >= room.roomLayout.width * .95 || size.z >= room.roomLayout.depth * .95) continue;
        obstacles.push({ id: obj.uuid, name: obj.name || obj.userData.propId || 'Furniture', minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    }
    return obstacles;
}

export class RoomGroove {
    constructor(ctx) { this.ctx = ctx; this.prepared = null; this.run = null; this.marker = null; this.token = 0; this.message = 'Choose a time, then tap the desk to start its Groove.'; }
    get state() { return { status: this.run ? this.run.stage : this.prepared?.plan?.ok ? 'ready' : this.prepared ? 'blocked' : 'idle', scene: this.prepared?.scene, phase: this.prepared?.phase, message: this.message, plan: this.prepared?.plan }; }
    announce(message) { this.message = message; this.ctx.sync(this.state); }
    reset() { this.token++; this.run = null; this.prepared = null; this.removeMarker(); this.announce('Choose a time, then tap the desk to start its Groove.'); }
    cancel() {
        this.run = null; this.ctx.stopPose();
        if (this.prepared) this.announce('Groove stopped. Tap the desk or Start Groove to resume from here.');
    }
    snapshot() {
        const room = this.ctx.room, l = room.roomLayout;
        return { start: this.ctx.pose(), desired: grooveDestination(this.prepared.scene, l, this.prepared.phase),
            bounds: { minX: -l.width / 2 + 20, maxX: l.width / 2 - 20, minZ: l.back + 20, maxZ: l.back + l.depth - 20 },
            obstacles: grooveObstacles(room), footprint: this.ctx.footprint() };
    }
    async prepare(scene, phase) {
        this.cancel(); const token = ++this.token;
        this.prepared = { scene, phase }; this.removeMarker(); this.announce('Preparing a clear route…');
        await this.ctx.room.ready;
        if (token !== this.token || this.ctx.sceneId !== scene) return;
        this.clearStartingArea();
        this.replan();
    }
    clearStartingArea() {
        // Time changes stage movable furniture first. Keep that new staging
        // out of the desk's current position, without moving fixed fixtures or
        // dropping collision checks. All linked tabletop objects share a delta.
        const data = this.snapshot(), room = this.ctx.room;
        for (const entry of room.life?.entries || []) {
            const ids = new Set(entry.objects.map(o => o.uuid));
            const occupied = data.obstacles.filter(o => ids.has(o.id));
            if (!occupied.length || occupied.every(o => poseIsClear(data.start, data.bounds, [o], data.footprint))) continue;
            const union = { minX: Math.min(...occupied.map(o=>o.minX)), maxX: Math.max(...occupied.map(o=>o.maxX)), minZ: Math.min(...occupied.map(o=>o.minZ)), maxZ: Math.max(...occupied.map(o=>o.maxZ)) };
            let shift = null;
            for (const radius of [80,160,240,320,480,640,960]) {
                for (let n=0; n<16; n++) {
                    const angle=n*Math.PI/8, dx=radius*Math.cos(angle), dz=radius*Math.sin(angle);
                    const candidate={minX:union.minX+dx,maxX:union.maxX+dx,minZ:union.minZ+dz,maxZ:union.maxZ+dz};
                    if (candidate.minX<data.bounds.minX || candidate.maxX>data.bounds.maxX || candidate.minZ<data.bounds.minZ || candidate.maxZ>data.bounds.maxZ) continue;
                    if (!poseIsClear(data.start,data.bounds,[candidate],data.footprint)) continue;
                    const touches=data.obstacles.some(o=>!ids.has(o.id) && candidate.minX<o.maxX+20 && candidate.maxX>o.minX-20 && candidate.minZ<o.maxZ+20 && candidate.maxZ>o.minZ-20);
                    if (!touches) {shift={dx,dz};break;}
                }
                if (shift) break;
            }
            if (!shift) continue;
            const next=new THREE.Matrix4().makeTranslation(shift.dx,0,shift.dz).multiply(entry.delta), inverse=entry.delta.clone().invert();
            for (const obj of entry.objects) {
                if (!obj.parent) continue;
                obj.updateMatrix(); const base=inverse.clone().multiply(obj.matrix);
                next.clone().multiply(base).decompose(obj.position,obj.quaternion,obj.scale);
                obj.userData.dailyDelta=next.toArray();obj.updateMatrixWorld(true);
            }
            entry.delta.copy(next);
            for (const o of occupied) {o.minX+=shift.dx;o.maxX+=shift.dx;o.minZ+=shift.dz;o.maxZ+=shift.dz;}
        }
    }
    replan() {
        const data = this.snapshot(), plan = planGroove(data); this.prepared.plan = plan; this.prepared.data = data;
        this.drawMarker(plan, data.footprint);
        const label = this.ctx.mode(this.prepared.phase).label;
        this.announce(plan.ok ? `${label} Groove ready${plan.adjusted ? ' · using a nearby clear spot' : ''}. Tap the desk or Start Groove.` : plan.reason);
        return plan;
    }
    start() {
        if (!this.prepared || this.run || !this.ctx.canMove()) return false;
        const plan = this.replan(); if (!plan.ok) return false;
        this.ctx.halt();
        const mode = this.ctx.mode(this.prepared.phase);
        this.run = { stage: 'clearance', segment: 1, elapsed: 0, route: plan.route, mode };
        this.ctx.goPose(Math.max(36, mode.height), 0);
        this.announce(`${mode.label} Groove · leveling the desktop before driving`);
        return true;
    }
    update(dt) {
        const run = this.run; if (!run) return;
        if (this.ctx.manual()) { this.cancel(); return; }
        dt = Math.min(.05, Math.max(0, dt));
        if (run.stage === 'clearance') {
            if (Math.abs(this.ctx.tilt()) > .2 || this.ctx.height() < 35.9) return;
            run.stage = 'driving';
            this.ctx.goPose(Math.max(36, run.mode.height), 0);
            this.announce(`${run.mode.label} Groove · driving to the new setup`);
        }
        if (run.stage === 'driving') {
            const a = run.route[run.segment - 1], b = run.route[run.segment];
            if (!run.elapsed) {
                const data = this.snapshot();
                if (!segmentIsClear(a, b, data.bounds, data.obstacles, data.footprint)) {
                    this.cancel(); this.announce('Groove stopped because the route changed. Prepare it again after moving the nearby item.'); return;
                }
            }
            const turn = angleDelta(a.yaw, b.yaw), duration = Math.max(.25, Math.hypot(b.x - a.x, b.z - a.z) / 420, Math.abs(turn) / .4);
            run.elapsed += dt; const t = Math.min(1, run.elapsed / duration), s = t * t * (3 - 2 * t);
            this.ctx.move({ x: a.x + (b.x - a.x) * s, z: a.z + (b.z - a.z) * s, yaw: a.yaw + turn * s });
            if (t === 1) {
                run.segment++; run.elapsed = 0;
                if (run.segment === run.route.length) {
                    run.stage = 'posture'; this.ctx.goPose(run.mode.height, run.mode.tilt);
                    this.ctx.dress(this.prepared.phase, run.mode);
                    this.announce(`${run.mode.label} Groove · adjusting height and tilt`);
                }
            }
        }
        if (run.stage === 'posture') {
            const safeHeight = this.ctx.safeHeight(run.mode.height, run.mode.tilt);
            if (Math.abs(this.ctx.height() - safeHeight) < .04 && Math.abs(this.ctx.tilt() - run.mode.tilt) < .05) {
                this.run = null; this.removeMarker(); this.prepared = null;
                this.announce(`${run.mode.label} setup · ready`);
            }
        }
    }
    removeMarker() {
        if (!this.marker) return;
        this.marker.removeFromParent(); this.marker.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); this.marker = null;
    }
    drawMarker(plan, f) {
        this.removeMarker(); if (!plan.ok) return;
        const group = new THREE.Group(); group.name = 'Groove route and destination'; group.userData.grooveMarker = true;
        const material = () => new THREE.LineDashedMaterial({ color: '#317c91', dashSize: 100, gapSize: 65, transparent: true, opacity: .8 });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(plan.route.map(p => new THREE.Vector3(p.x, 10, p.z))), material()); line.computeLineDistances(); group.add(line);
        const p = plan.destination, points = [[-f.halfWidth,-f.halfDepth],[f.halfWidth,-f.halfDepth],[f.halfWidth,f.halfDepth],[-f.halfWidth,f.halfDepth],[-f.halfWidth,-f.halfDepth]].map(([x,z]) => new THREE.Vector3(x + f.offsetX, 12, z + f.offsetZ).applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw).add(new THREE.Vector3(p.x,0,p.z)));
        const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material()); outline.computeLineDistances(); group.add(outline);
        this.ctx.room.root.add(group); this.marker = group;
    }
}
