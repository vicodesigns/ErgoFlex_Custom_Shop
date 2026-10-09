import * as THREE from 'three';
import { INSTITUTIONAL_ROOMS } from './institutional-scenes.mjs?v=institutional-atmosphere-20261008';

// Authored art, imported GLBs and user transforms are left in their own systems.
// These finishes apply only to the builders' explicitly tagged room materials.
export const ROOM_FINISHES = {
    ...Object.fromEntries(Object.entries(INSTITUTIONAL_ROOMS).map(([id, p]) => [id, { name: p.name + (['lab','hospital'].includes(p.kind) ? ' · terrazzo & satin enamel' : ['operations','police','government','it'].includes(p.kind) ? ' · woven carpet & acoustic felt' : ' · natural oak & learning textiles'), ground: ['lab','hospital'].includes(p.kind) ? '#809c95' : ['operations','police','government','it'].includes(p.kind) ? '#626f76' : '#9b8768', wood: .53, metal: .31, stone: ['lab','hospital'].includes(p.kind) ? .43 : .6, night: .92, partyDay: true }])),
    home:      { name: 'Warm oak & linen',       ground: '#85745e', wood: .52, metal: .32, stone: .65, night: .95 },
    gaming:    { backdrops: { morning: ['#dfe6f0','#a7b8cf'], afternoon: ['#cfdeed','#91a6bf'], evening: ['#9cacc9','#4e6081'] }, name: 'Graphite & violet',      ground: '#41445a', wood: .49, metal: .30, stone: .61, night: .80 },
    music:     { backdrops: { morning: ['#e9dfd1','#b5b4b0'], afternoon: ['#d2d9df','#8e9da9'], evening: ['#c4aa9c','#6e7787'] }, name: 'Walnut & acoustic felt', ground: '#635042', wood: .48, metal: .29, stone: .64, night: .82 },
    creative:  { name: 'Chalk & natural oak',    ground: '#9a8871', wood: .58, metal: .38, stone: .76, night: .98 },
    study:     { name: 'Sage & aged brass',      ground: '#7a735c', wood: .54, metal: .32, stone: .68, night: .96 },
    office:    { name: 'Teal & bronze',          ground: '#77776b', wood: .50, metal: .33, stone: .62, night: .94 },
    gym:       { backdrops: { morning: ['#d5ddda','#859794'], afternoon: ['#c8d5d9','#7b9498'], evening: ['#899fa3','#42595f'] }, name: 'Rubber & brushed steel', ground: '#454e4c', wood: .59, metal: .35, stone: .78, night: .90 },
    kitchen:   { name: 'Jade & honed stone',     ground: '#8a8270', wood: .51, metal: .28, stone: .46, night: .98 },
    lounge:    { name: 'Walnut & soft textiles', ground: '#80715f', wood: .49, metal: .30, stone: .64, night: .92 },
    workshop:  { name: 'Plywood & enamel',       ground: '#767e7a', wood: .64, metal: .38, stone: .80, night: .98 },
    bedroom:   { partyDay: true, name: 'Linen & pale oak',       ground: '#8c816f', wood: .57, metal: .34, stone: .67, night: .90 },
    gallery:   { name: 'Ivory & honed marble',   ground: '#8b8580', wood: .53, metal: .28, stone: .48, night: 1.02 },
    scifi:     { backdrops: { morning: ['#708f9f','#2c455e'], afternoon: ['#537286','#233c55'], evening: ['#3a517a','#152947'], night: ['#162d47','#071425'], party: ['#384065','#111d39'] }, name: 'Satin hull & titanium',  ground: '#26384b', wood: .55, metal: .37, stone: .62, night: .78 },
    coworking: { name: 'Clay & natural oak',     ground: '#8b7c69', wood: .55, metal: .34, stone: .61, night: .96 },
    library:   { partyDay: true, name: 'Forest green & brass',   ground: '#7d765d', wood: .51, metal: .30, stone: .67, night: .96 }
};
const PHASE_LIGHT = {
    morning:   { fill: .90, rim: .62, ambient: 1.00, bounce: 1.00, contact: .22 },
    afternoon: { fill: .94, rim: .72, ambient: .98, bounce: 1.00, contact: .20 },
    evening:   { fill: .78, rim: .47, ambient: .94, bounce: .94, contact: .25 },
    night:     { fill: .68, rim: .22, ambient: .90, bounce: .86, contact: .29 },
    party:     { fill: .75, rim: .38, ambient: .94, bounce: .92, contact: .25 }
};
export function roomPolishLighting(room, lights, mode) {
    const finish = ROOM_FINISHES[room.id], phase = PHASE_LIGHT[mode] || PHASE_LIGHT.afternoon;
    if (!finish) return;
    lights.fill.intensity *= phase.fill;
    lights.rim.intensity *= phase.rim * (mode === 'night' ? finish.night : 1);
    lights.hemi.intensity *= phase.ambient;
    lights.hemi.groundColor.set(finish.ground);
    room.scene.environmentIntensity *= phase.bounce;
    room.grounding?.setMode(mode);
    const backdropPhase = mode === 'party' && finish.partyDay ? 'afternoon' : mode;
    const backdrop = finish.backdrops?.[backdropPhase] || {
        morning: ['#f4ebda', '#c7cbbf'], afternoon: ['#e5edec', '#b8c7c8'],
        evening: ['#d4c0ad', '#8c9396'], night: ['#34455b', '#111c2c'], party: ['#4b4767', '#202d42']
    }[backdropPhase] || ['#e5edec', '#b8c7c8'];
    const tint = new THREE.Color(finish.ground);
    const halo = '#' + new THREE.Color(backdrop[0]).lerp(tint, .12).getHexString();
    const edge = '#' + new THREE.Color(backdrop[1]).lerp(tint, .10).getHexString();
    const dark = backdropPhase === 'night' || backdropPhase === 'party';
    room.root.userData.polish = { halo, edge, dark, finish: finish.name, mode, ...phase, contactCount: room.grounding?.entries.length || 0 };
    return { halo, edge, dark };
}
export function roomSurfaceFinish(room, mat, kind) {
    const finish = ROOM_FINISHES[room.id]; if (!finish) return;
    // Preserve lower authored roughness on polished stone and existing metalness.
    const roughness = { plaster: .88, fabric: .93, rubber: .91, powder: .59, wood: finish.wood, metal: finish.metal, stone: finish.stone }[kind];
    if (roughness !== undefined) mat.roughness = kind === 'stone' || kind === 'metal' ? Math.min(mat.roughness, roughness) : roughness;
}
const visible = obj => { for (let p = obj; p; p = p.parent) if (!p.visible) return false; return true; };

// One instanced, analytic contact pass for all floor furnishings. It complements
// the room's directional shadows where the unshadowed practical lamps are used.
// It has no extra shadow map, texture allocation, collider, or editor identity.
export class RoomGrounding {
    constructor(room, entries) {
        this.room = room; this.entries = []; this.mode = room.root.userData.lighting?.mode || 'morning';
        room.root.updateWorldMatrix(true, true);
        const inverse = room.root.matrixWorld.clone().invert();
        for (const entry of entries.filter(e => e.surface === 'floor' && e.collider)) {
            const obj = entry.obj, box = new THREE.Box3().setFromObject(obj);
            if (box.isEmpty()) continue;
            const localBox = box.clone().applyMatrix4(inverse), size = localBox.getSize(new THREE.Vector3()), center = localBox.getCenter(new THREE.Vector3());
            const mat = new THREE.Matrix4().compose(new THREE.Vector3(center.x, 1.5, center.z),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
                new THREE.Vector3(size.x * 1.16 + 50, size.z * 1.16 + 50, 1));
            const local = obj.matrixWorld.clone().invert().multiply(room.root.matrixWorld).multiply(mat);
            this.entries.push({ obj, local, round: /chair|stool|plant|lamp|potted/i.test(entry.name) ? 2 : 4 });
        }
        if (!this.entries.length) return;
        const geometry = new THREE.PlaneGeometry(1, 1);
        geometry.setAttribute('contactRound', new THREE.InstancedBufferAttribute(new Float32Array(this.entries.map(e => e.round)), 1));
        this.material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
            uniforms: { strength: { value: PHASE_LIGHT[this.mode]?.contact || .22 } },
            vertexShader: `attribute float contactRound; varying vec2 contactUv; varying float roundness;
                void main(){ contactUv=uv*2.0-1.0; roundness=contactRound; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
            fragmentShader: `uniform float strength; varying vec2 contactUv; varying float roundness;
                void main(){ vec2 d=abs(contactUv); float edge=1.0-smoothstep(.60,1.0,max(d.x,d.y));
                float pool=exp(-2.7*(pow(d.x,roundness)+pow(d.y,roundness)))*edge;
                gl_FragColor=vec4(0.025,0.03,0.04,pool*strength); }`
        });
        this.mesh = new THREE.InstancedMesh(geometry, this.material, this.entries.length);
        this.mesh.name = 'Daylight contact shading'; this.mesh.userData.presentationOnly = true;
        this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.raycast = () => {};
        room.root.add(this.mesh); this.seams = [];
        // Narrow occlusion at architectural joins; children of their cutaway wall,
        // so a removed wall never leaves a dark stripe across the exposed floor.
        const l = room.roomLayout, s = room.root.scale.x;
        for (const wall of room.walls) {
            const rear = wall.axis === 'x', x = rear ? 0 : -wall.limit / s, side = Math.sign(x);
            const geometry = new THREE.PlaneGeometry(rear ? l.width : 160, rear ? 160 : l.depth);
            const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
                uniforms: { seam: { value: rear ? new THREE.Vector2(0, 1) : new THREE.Vector2(side, 0) } },
                vertexShader: `varying vec2 seamUv; void main(){seamUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
                fragmentShader: `uniform vec2 seam; varying vec2 seamUv; void main(){
                    float d=seam.y>0.5?1.0-seamUv.y:(seam.x>0.0?1.0-seamUv.x:seamUv.x);
                    float along=seam.y>0.5?seamUv.x:seamUv.y;
                    float ends=smoothstep(0.0,.025,along)*(1.0-smoothstep(.975,1.0,along));
                    gl_FragColor=vec4(.025,.03,.04,.16*pow(1.0-d,3.0)*ends); }`
            });
            const plane = new THREE.Mesh(geometry, material); plane.name = 'Daylight architectural contact';
            plane.userData.presentationOnly = true; plane.raycast = () => {}; plane.renderOrder = 1;
            const position = new THREE.Vector3(x - side * 80, 1, rear ? l.back + 80 : l.back + l.depth / 2);
            const transform = new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI/2), new THREE.Vector3(1,1,1));
            wall.obj.updateWorldMatrix(true, false); plane.matrixAutoUpdate = false;
            plane.matrix.copy(wall.obj.matrixWorld).invert().multiply(room.root.matrixWorld).multiply(transform);
            wall.obj.add(plane); this.seams.push(plane);
        }
        if (room.root.userData.polish) room.root.userData.polish.contactCount = this.entries.length;
        this.update();
    }
    setMode(mode) { this.mode = mode; if (this.material) this.material.uniforms.strength.value = (PHASE_LIGHT[mode] || PHASE_LIGHT.afternoon).contact; }
    update() {
        if (!this.mesh) return;
        const root = this.room.root; root.updateWorldMatrix(true, false);
        const inverse = root.matrixWorld.clone().invert(), matrix = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < this.entries.length; i++) {
            const e = this.entries[i]; e.obj.updateWorldMatrix(true, false);
            matrix.copy(inverse).multiply(e.obj.matrixWorld).multiply(e.local);
            // Furniture can be lifted through Studio: only ground-level objects cast
            // this pass, and they do not drag a floating shadow into the air.
            const y = matrix.elements[13];
            this.mesh.setMatrixAt(i, e.obj.parent && visible(e.obj) && y >= -4 && y <= 40 ? matrix : hidden);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
    dispose() { for (const seam of this.seams || []) { seam.removeFromParent(); seam.geometry.dispose(); seam.material.dispose(); } this.seams = []; if (!this.mesh) return; this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); this.mesh = null; }
}
