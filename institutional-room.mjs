import * as THREE from 'three';
import { institutionalOak, drawInstitutionalCampus, enrichInstitutionalRoom, detailKit } from './institutional-detail.mjs?v=scene-desk-styling-20261010';
import { INSTITUTIONAL_ROOMS, institutionalModule } from './institutional-scenes.mjs?v=env-living-20261111';
import { addCampusLife } from './campus-lived-in.mjs?v=env-living-20261111';
import { attachVista } from './window-vista.mjs?v=window-vista-20261110b';
import { createPoolLayer } from './room-light-pools.mjs?v=environment-expert-20261014';

// Shared architectural kit. The shell (floor, walls, daylight window, door,
// sign, planning board, ceiling lights) and the common furniture helpers live
// here; every setting's own furnishings, displays and decor are built by its
// group module (institutional-government/-education/-healthcare/-it.mjs)
// through the `kit` object passed to the hooks below. Floor furnishings are
// separate stable assets so rearranging and collision detection use the same
// objects that the visitor sees.
//
// Group module hooks, in call order (all optional except furnish):
//   options(spec)            shell knobs (see defaultOptions)
//   floor(spec, w, d)        -> { map, roughness, surface }
//   drawBoard(c, W, H, spec, variant) / drawScreen(c, W, H, spec, variant, phase)
//   furnish(kit)             main furnishings
//   dressProp(id, k, g, kit) batched detail per furnishing (institutional-detail.mjs)
//   decorate(kit)            perimeter features
//   finishDecor(kit), activityMaterials(k, phase, y, kit), extraLamps(kit)
//   atmosphere(phase, gain, kit)  per-phase updates
const defaultOptions = spec => ({
    trimColor: '#c4c2b6', acousticName: 'Wall acoustic panels', signLabel: 'CONNECTED WORKSPACE', rugColor: '#889b85', planter: true,
    boardOnSideWall: false, boardName: 'Wall teaching and planning board', boardFooter: '#f1f0e7',
    storage: { height: 1200, open: false }, chairDetailHeight: 480, nightBackground: .55,
    lampSupport: null
});
// What each setting looks out on (window-vista.mjs). Huntington Beach and Costa Mesa are on the coast.
const WINDOW_VISTAS = {
    highschool: 'coast', occmedialab: 'coast', kindergarten: 'garden', elementary: 'garden',
    hospital: 'city', laboratory: 'city', mobileit: 'city', government: 'city', police: 'city', security: 'city'
};

// Suspended acoustic ceiling where a room asks for one: 610 × 1220 mm (2 × 4 ft)
// fissured mineral tiles in a white T-bar grid, with square supply diffusers,
// slot return grilles, sprinkler heads, a smoke detector and an occupancy
// sensor laid on the grid. It dresses the Studio's ceiling surface, which is
// built after the room, so it hides with the camera cutaway like the plane.
const TILE_CEILINGS = new Set(['highschool', 'occmedialab']);
let tileMap = null;
function acousticTileMap() {
    if (tileMap) return tileMap;
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
    const r = n => { const x = Math.sin(n * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };
    g.fillStyle = '#e7e5de'; g.fillRect(0, 0, 256, 512);
    // Fissures and pin pits of a mineral-fibre tile, about 2.4 mm per pixel.
    for (let n = 0; n < 1400; n++) { g.fillStyle = n % 3 ? '#cfccc3' : '#d9d6ce'; const x = r(n) * 256, y = r(n + 5000) * 512; if (n % 4) g.fillRect(x, y, 1.2, 1.2); else { g.save(); g.translate(x, y); g.rotate(r(n + 9000) * Math.PI); g.fillRect(0, 0, 3 + r(n + 7) * 6, 1); g.restore(); } }
    // Bevelled tile edge, then the 24 mm T-bar face shared by neighbouring tiles.
    g.fillStyle = '#c9c6bd'; g.fillRect(5, 5, 246, 2); g.fillRect(5, 5, 2, 502);
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, 256, 5); g.fillRect(0, 507, 256, 5); g.fillRect(0, 0, 5, 512); g.fillRect(251, 0, 5, 512);
    tileMap = new THREE.CanvasTexture(c); tileMap.colorSpace = THREE.SRGBColorSpace; tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping; tileMap.anisotropy = 8;
    return tileMap;
}
function dressTileCeiling(room, layout) {
    const group = room.ceilingSurface, plane = group?.children.find(o => o.isMesh);
    if (!plane || group.userData.tileCeiling) return; group.userData.tileCeiling = true;
    const { width: w, depth: d, height, back: bz } = layout, mid = bz + d / 2;
    const map = acousticTileMap().clone(); map.needsUpdate = true; map.repeat.set(w / 610, d / 1220);
    // A T-bar line runs through the room centre both ways.
    map.offset.set(-((w / 2 / 610) % 1), -((d / 2 / 1220) % 1));
    const tile = new THREE.MeshStandardMaterial({ name: 'Acoustic ceiling tile', color: '#ffffff', map, bumpMap: map, bumpScale: .6, roughness: .96 });
    tile.userData.roomSurface = 'ceiling-tile'; tile.userData.roomFinishLocked = tile.userData.roomPaletteLocked = true; room.ownedMaterials?.add(tile);
    plane.material = tile;
    const k = detailKit(), y = height - 2, WHITE = '#f1f0eb', GREY = '#9ea2a3';
    const xs = [-1, 1].map(s => s * (Math.round(w * .24 / 610) * 610 + 305)), zs = [-1, 1].map(s => mid + s * (Math.round(d * .22 / 1220) * 1220 + 305));
    for (const x of xs) for (const z of zs) {
        // Square supply diffuser: stepped cones in a 595 mm panel.
        k.box([595, 8, 595], [x, y - 4, z], WHITE, null, 'powder');
        for (const [n, s] of [[1, 470], [2, 350], [3, 230]]) k.box([s, 8, s], [x, y - 4 - n * 9, z], n % 2 ? '#e3e2dc' : WHITE, null, 'powder');
        k.box([120, 6, 120], [x, y - 40, z], '#d6d5cf', null, 'powder');
    }
    for (const z of [mid - 610, mid + 1830]) {
        // Return grille seen from below: an off-white frame, a shaded plenum
        // behind and off-white louvre blades, so it reads grey, not as a hole.
        k.box([595, 6, 595], [0, y - 3, z - 305], WHITE, null, 'powder');
        k.box([530, 4, 530], [0, y - 7, z - 305], '#a9a8a2', null, 'powder');
        for (let n = 0; n < 11; n++) k.box([520, 14, 30], [0, y - 14, z - 305 - 250 + n * 50], '#e6e5df', [.5, 0, 0], 'powder');
    }
    // Pendent sprinklers on a ~3 m grid, a smoke detector and an occupancy sensor.
    for (let x = -w / 2 + 1500; x < w / 2 - 600; x += 3000) for (let z = bz + 1500; z < bz + d - 600; z += 3000) {
        k.cyl(38, 38, 4, [x, y - 2, z], WHITE, 'metal'); k.cyl(9, 12, 34, [x, y - 21, z], '#c9a64c', 'metal'); k.cyl(20, 20, 3, [x, y - 39, z], '#c9a64c', 'metal');
    }
    k.cyl(65, 70, 42, [w * .1, y - 21, mid - 300], WHITE, 'powder'); k.cyl(14, 14, 4, [w * .1 + 30, y - 44, mid - 300], '#bf3a30');
    k.cyl(45, 50, 30, [-w * .1, y - 15, mid + 900], WHITE, 'powder'); k.ball(28, [-w * .1, y - 30, mid + 900], '#ececea', [1, .6, 1]);
    k.build(group, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 }));
    group.children.at(-1).name = 'Ceiling services · diffusers, returns, sprinklers, detectors';
    group.children.at(-1).castShadow = false;
}

// Reversible daypart moves for furnishings that room-life does not stage
// (student tables, review chairs). Each move is a root-space matrix stored as
// userData.dailyDelta, the same convention room-life uses, so saved Studio
// transforms stay the owner's base arrangement. A move can carry what stands
// on a support: props resting inside [x, z, halfX, halfZ] of its base
// footprint at 250-1000 mm are adopted, including props that load later.
function phaseMover(root, room) {
    const entries = [], I = new THREE.Matrix4();
    let last = 0, seen = null;
    const api = {
        add(objects, carry, target) { entries.push({ objects, carry, target, D: new THREE.Matrix4(), carried: new Set() }); return api; },
        apply(i) {
            last = i;
            for (const e of entries) {
                const objects = (typeof e.objects === 'function' ? e.objects() : e.objects).filter(Boolean);
                // carry: one box [x, z, halfX, halfZ] (things on the top) or a list of
                // [x, z, halfX, halfZ, yMin, yMax, idPattern] boxes (e.g. bags at the chairs).
                for (const box of e.carry ? (Array.isArray(e.carry[0]) ? e.carry : [e.carry]) : []) {
                    const [x, z, hx, hz, y0 = 250, y1 = 1000, only = null] = box;
                    for (const o of root.children) {
                        if (e.carried.has(o) || objects.includes(o) || o.userData.phaseCarried || !o.userData.propId || (only && !only.test(o.userData.propId))) continue;
                        const p = o.position;
                        if (p.y > y0 && p.y < y1 && Math.abs(p.x - x) < hx && Math.abs(p.z - z) < hz) { o.updateMatrix(); e.D.clone().multiply(o.matrix).decompose(o.position, o.quaternion, o.scale); o.userData.phaseCarried = true; e.carried.add(o); }
                    }
                }
                const T = e.target(i) || I, change = T.clone().multiply(e.D.clone().invert()), still = T.equals(I);
                for (const o of [...objects, ...e.carried]) {
                    o.updateMatrix(); change.clone().multiply(o.matrix).decompose(o.position, o.quaternion, o.scale);
                    if (still) delete o.userData.dailyDelta; else o.userData.dailyDelta = T.toArray();
                    o.updateMatrixWorld(true);
                }
                if (objects.length || !e.objects.call) e.D.copy(T); else e.D.copy(I);
            }
            // Props arrive after the shell: stage them once they have loaded.
            if (room.ready && room.ready !== seen) { seen = room.ready; room.ready.then(() => api.apply(last)).catch(() => {}); }
            return api;
        }
    };
    return api;
}
// Pivot a furnishing group: move its centre [x, z] by [dx, dz] and turn it by `turn` radians.
export const pivotMove = (x, z, dx, dz, turn = 0) => new THREE.Matrix4().makeTranslation(x + dx, 0, z + dz).multiply(new THREE.Matrix4().makeRotationY(turn)).multiply(new THREE.Matrix4().makeTranslation(-x, 0, -z));

// Power where powered desks stand: duplex sockets at 400 mm along the back
// and side walls (and a switch bank by the door), flush floor boxes under each
// free-standing ErgoFlex station and table group. One merged mesh per wall,
// so cutaway walls take their sockets with them.
function addPower(kit, floorAt) {
    const { w, d, bz, front, back, right, left } = kit, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 });
    const socket = (k, place, y = 400) => { k.box(...place([80, 120, 8], y, 0), '#ecebe6', null, 'powder'); for (const o of [-26, 26]) k.box(...place([30, 4, 3], y + o, 5), '#3b3d40'); };
    const wb = detailKit();
    for (let x = -w / 2 + 900; x < w / 2 - 600; x += 2400) socket(wb, (size, y, dz) => [size, [x, y, bz + 4 + dz]]);
    wb.build(back, mat);
    const rb = detailKit(), doorZ = front - 1600;
    for (let z = bz + 1200; z < front - 600; z += 2400) if (Math.abs(z - doorZ) > 900) socket(rb, (size, y, dz) => [[size[2], size[1], size[0]], [w / 2 - 4 - dz, y, z]]);
    // Light switches and the occupancy-sensor dimmer beside the door, at 1100 mm.
    for (const o of [0, 1]) { rb.box([10, 120, 75], [w / 2 - 5, 1100, doorZ - 700 - o * 85], '#ecebe6', null, 'powder'); rb.box([12, 40, 22], [w / 2 - 9, 1100, doorZ - 700 - o * 85], '#d9d8d2', null, 'powder'); }
    rb.build(right, mat);
    const lb = detailKit();
    for (const z of [bz + 900, front - 900]) socket(lb, (size, y, dz) => [[size[2], size[1], size[0]], [-w / 2 + 4 + dz, y, z]]);
    lb.build(left, mat);
    const fb = detailKit();
    for (const [x, z] of floorAt) { fb.box([170, 4, 170], [x, 2, z], '#8d8a80', null, 'metal'); fb.box([120, 5, 60], [x, 3, z - 25], '#3b3d40', null, 'rubber'); fb.box([60, 5, 30], [x + 40, 3, z + 40], '#b59a5a', null, 'metal'); }
    const floorGroup = new THREE.Group(); floorGroup.name = 'Floor power boxes'; floorGroup.userData.grooveMarker = true; kit.root.add(floorGroup); fb.build(floorGroup, mat);
    floorGroup.traverse(o => { if (o.isMesh) { o.castShadow = false; o.raycast = () => {}; } });
}

export function buildInstitutionalRoom(room, root, layout, h) {
    const spec = INSTITUTIONAL_ROOMS[room.id], group = institutionalModule(room.id), { box, mesh, rod, sphere, material, markSceneAsset } = h;
    const options = { ...defaultOptions(spec), ...group.options?.(spec) };
    const { width: w, depth: d, height: ceiling, back: bz, index } = layout, front = bz + d;
    const mat = (color, surface, extra = {}) => { const m = material(color, extra); if (surface) m.userData.roomSurface = surface; return m; };
    const wall = mat(spec.wall, 'plaster'), trim = mat('#f3f1e9', 'powder'), accent = mat(spec.accent, 'powder');
    const metal = mat('#74808a', 'metal', { metalness: .65, roughness: .32 }), ink = mat('#25333d', 'powder');
    const oak = mat('#ffffff', 'wood', { map: institutionalOak(), roughness: .55 }), paper = mat('#eeeadc', 'plaster'), seat = mat(spec.accent, 'fabric');
    const floorFinish = group.floor(spec, w, d);
    const floor = mat('#ffffff', floorFinish.surface, { map: floorFinish.map, roughness: floorFinish.roughness });
    const glow = material('#ecf6ff', { emissive: '#d9efff', emissiveIntensity: .6, roughness: .5 });
    const taskSeat = mat('#384c57', 'fabric');
    const screenMats = [];
    let screenPhase;
    const drawScreen = (c, W, H, variant = 0, phase = 'morning') => group.drawScreen(c, W, H, spec, variant, phase);
    const drawBoard = (c, W, H, variant = 0) => group.drawBoard(c, W, H, spec, variant);
    // Every furnishing that should be saved/rearranged is created with asset():
    // its key is `${scene}:${layout}:fixture:${id}` and must stay stable.
    const asset = (id, name, at = [0, 0, 0], parent = root) => {
        const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g);
        g.userData.propId = id; g.userData.sceneAssetName = name;
        markSceneAsset(g, { key: `${room.id}:${layout.id}:fixture:${id}` }); return g;
    };
    const canvasMat = (draw, width = 768, height = 384) => {
        const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
        const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
        return material('#ffffff', { map, roughness: .85 });
    };
    const label = (parent, text, size, at, background = spec.accent) => {
        const m = canvasMat((c, W, H) => { c.fillStyle = background; c.fillRect(0, 0, W, H); c.fillStyle = '#f3f5f0'; c.font = '600 42px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2, W - 50); }, 1024, 160);
        const p = mesh(parent, new THREE.PlaneGeometry(...size), m, at); p.castShadow = false; return p;
    };
    const chair = (id, at, height = 450, turn = 0) => {
        const g = asset(id, height < 400 ? 'Classroom child chair' : 'Task chair', at); g.rotation.y = turn;
        const wide = height < 400 ? 310 : 420, deep = wide * .9;
        const upholstery = /operator|mobile-desk/.test(id) ? taskSeat : seat;
        box(g, [wide, 60, deep], [0, height, 0], upholstery, 22);
        box(g, [wide, height * .55, 36], [0, height * 1.37, deep * .46], upholstery, 18);
        if (/operator|mobile-desk/.test(id)) {
            rod(g, [0, 90, 0], [0, height - 25, 0], 30, metal);
            for (let n = 0; n < 5; n++) {
                const a = n * Math.PI * 2 / 5, x = Math.cos(a) * 245, z = Math.sin(a) * 245;
                rod(g, [0, 105, 0], [x, 65, z], 18, metal);
                const wheel = mesh(g, new THREE.CylinderGeometry(34, 34, 25, 12), ink, [x, 34, z]); wheel.rotation.z = Math.PI / 2;
            }
            for (const x of [-wide / 2 - 20, wide / 2 + 20]) { rod(g, [x, height, 70], [x, height + 180, 70], 14, metal); box(g, [55, 30, 240], [x, height + 180, 0], ink, 12); }
        } else for (const x of [-wide * .39, wide * .39]) for (const z of [-deep * .37, deep * .37]) rod(g, [x, 0, z], [x, height - 20, z], 15, metal);
        return g;
    };
    const table = (id, name, at, width = 1200, depth = 680, height = 740, top = oak) => {
        const g = asset(id, name, at);
        box(g, [width, 35, depth], [0, height - 17.5, 0], top, 12);
        for (const x of [-width / 2 + 65, width / 2 - 65]) for (const z of [-depth / 2 + 65, depth / 2 - 65]) box(g, [35, height - 35, 35], [x, (height - 35) / 2, z], metal, 5);
        return g;
    };
    const monitor = (parent, at, width = 540, variant = 0, mounted = false) => {
        const m = canvasMat((c, W, H) => drawScreen(c, W, H, variant));
        m.emissive.set('#b2d9df'); m.emissiveMap = m.map; m.emissiveIntensity = .18; m.userData.screenVariant = variant; screenMats.push(m);
        const g = new THREE.Group(); g.position.set(...at); parent.add(g);
        box(g, [width, width * .6, 28], [0, 200, 0], ink, 8);
        mesh(g, new THREE.PlaneGeometry(width - 25, width * .6 - 24), m, [0, 200, 15]);
        if (!mounted) { box(g, [28, 110, 28], [0, 65, -10], metal, 3); box(g, [200, 14, 140], [0, 7, 0], metal, 6); }
        else box(g, [100, 80, 25], [0, 200, -25], metal, 4);
        return g;
    };
    const cabinet = (id, at, width = 1100, height = 1000, open = false) => {
        const g = asset(id, open ? 'Learning cubby shelving' : 'Storage cabinet', at), depth = 420;
        box(g, [width, 45, depth], [0, 22.5, 0], oak, 5); box(g, [width, 30, depth], [0, height - 15, 0], oak, 5);
        for (const x of [-width / 2 + 15, width / 2 - 15]) box(g, [30, height, depth], [x, height / 2, 0], oak);
        box(g, [width, height - 40, 18], [0, height / 2, -depth / 2 + 9], accent);
        if (open) for (let row = 0; row < 3; row++) {
            box(g, [width - 60, 22, depth - 20], [0, 80 + row * 275, 0], oak);
            for (let col = 0; col < 3; col++) {
                box(g, [22, height - 40, depth - 20], [-width / 2 + (col + 1) * width / 3, height / 2, 0], oak);
                if (col < 2 || row < 2) box(g, [width / 3 - 80, 170, 260], [-width / 3 + col * width / 3, 178 + row * 275, 10], mat(['#b68c66', '#6e9c96', '#cebb74'][(row + col) % 3], 'fabric'), 8);
            }
        } else for (const side of [-1, 1]) {
            box(g, [width / 2 - 30, height - 90, 22], [side * width / 4, height / 2, depth / 2], trim, 4);
            box(g, [12, 110, 25], [side * 35, height / 2, depth / 2 + 20], metal, 4);
        }
        return g;
    };
    const cart = (id, at, type = 'it') => {
        const g = asset(id, type === 'hospital' ? 'Mobile clinical tool-cart' : 'Mobile IT tool-cart', at);
        for (const x of [-260, 260]) for (const z of [-180, 180]) {
            const wheel = mesh(g, new THREE.CylinderGeometry(46, 46, 28, 12), ink, [x, 46, z]); wheel.rotation.z = Math.PI / 2;
            rod(g, [x, 72, z], [x, 910, z], 16, metal);
        }
        for (const y of [145, 510, 900]) box(g, [620, 26, 460], [0, y, 0], trim, 12);
        rod(g, [-290, 980, -210], [290, 980, -210], 15, metal);
        if (type === 'it') {
            monitor(g, [0, 913, -100], 420, 2); box(g, [360, 110, 250], [0, 580, 0], ink, 7);
            for (let i = 0; i < 4; i++) box(g, [100, 20, 260], [-190 + i * 125, 172, 0], accent, 4);
        } else {
            for (let i = 0; i < 3; i++) box(g, [140, 90, 260], [-175 + i * 175, 570, 0], accent, 6);
            box(g, [330, 30, 230], [0, 930, 0], paper, 8);
        }
        return g;
    };
    const byId = id => { let found; root.traverse(g => { if (g.userData.propId === id) found = g; }); return found; };

    box(root, [w, 30, d], [0, -15, bz + d / 2], floor);
    const back = new THREE.Group(); back.name = `${spec.name} back wall`; root.add(back);
    box(back, [w, ceiling, 80], [0, ceiling / 2, bz - 40], wall);
    box(back, [w, 650, 18], [0, 325, bz + 9], accent);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const right = new THREE.Group(); right.name = `${spec.name} side wall`; root.add(right);
    box(right, [80, ceiling, d], [w / 2 + 40, ceiling / 2, bz + d / 2], wall);
    box(right, [18, 110, d], [w / 2 - 9, 55, bz + d / 2], metal);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    // Left-side daylight is a framed opening; the front stays open for access.
    const left = new THREE.Group(); left.name = `${spec.name} window wall`; root.add(left);
    const windowCenter = bz + d * .54, opening = d * .48;
    box(left, [80, 800, d], [-w / 2 - 40, 400, bz + d / 2], wall);
    box(left, [80, ceiling - 2600, d], [-w / 2 - 40, (ceiling + 2600) / 2, bz + d / 2], wall);
    const rearEnd = windowCenter - opening / 2, frontStart = windowCenter + opening / 2;
    box(left, [80, 1800, rearEnd - bz], [-w / 2 - 40, 1700, (bz + rearEnd) / 2], wall);
    box(left, [80, 1800, front - frontStart], [-w / 2 - 40, 1700, (front + frontStart) / 2], wall);
    room.walls.push({ obj: left, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    const window = new THREE.Group(); window.name = 'Daylight window'; window.position.set(-w / 2 + 15, 1700, bz + d * .54); window.rotation.y = Math.PI / 2; left.add(window);
    const sky = canvasMat(() => {}, 512, 512);
    const skyPane = mesh(window, new THREE.PlaneGeometry(d * .48, 1750), sky);
    for (const x of [-d * .24, 0, d * .24]) box(window, [45, 1840, 80], [x, 0, 5], trim, 3);
    for (const y of [-900, 900]) box(window, [d * .48 + 80, 50, 140], [0, y, 10], trim, 3);
    const door = new THREE.Group(); door.name = 'Room entry door'; right.add(door); door.position.set(w / 2 - 18, 0, front - 1600); door.rotation.y = -Math.PI / 2;
    box(door, [1020, 2240, 35], [0, 1120, 0], metal, 5);
    box(door, [930, 2150, 38], [0, 1075, 22], oak, 5);
    const visionPanel = mat('#9eb9bd', 'powder', { emissive: '#fff1d6', emissiveIntensity: 0 });
    box(door, [200, 780, 10], [0, 1560, 47], visionPanel, 5);
    rod(door, [310, 1040, 55], [310, 1190, 55], 12, metal);
    // After hours the corridor stays lit: its light comes through the door's
    // vision panel and lands as a soft patch on the floor inside the door.
    const corridor = TILE_CEILINGS.has(spec.id) ? createPoolLayer(root, 'Corridor light through the door') : null;
    corridor?.add(root, [w / 2 - 700, 3, front - 1500], [560, 1700], '#ffe9c8', [0, 0, .03, .15, .05]);   // a long narrow wedge, as a slit of glass throws
    if (TILE_CEILINGS.has(spec.id)) {
        // Illuminated exit sign over the entry door: stays lit after hours.
        const exitCanvas = document.createElement('canvas'); exitCanvas.width = 256; exitCanvas.height = 128; const ec = exitCanvas.getContext('2d');
        ec.fillStyle = '#f4f3ee'; ec.fillRect(0, 0, 256, 128); ec.fillStyle = '#d8231c'; ec.font = 'bold 74px "Arial Narrow", Arial, sans-serif'; ec.textAlign = 'center'; ec.textBaseline = 'middle'; ec.fillText('EXIT', 128, 62);
        ec.beginPath(); ec.moveTo(218, 64); ec.lineTo(200, 48); ec.lineTo(200, 80); ec.closePath(); ec.fill();
        const exitMap = new THREE.CanvasTexture(exitCanvas); exitMap.colorSpace = THREE.SRGBColorSpace;
        box(door, [330, 170, 56], [0, 2420, 28], mat('#f1f0eb', 'powder'), 6);
        const face = mesh(door, new THREE.PlaneGeometry(310, 155), new THREE.MeshStandardMaterial({ map: exitMap, emissive: '#ffffff', emissiveMap: exitMap, emissiveIntensity: .9, roughness: .4 }), [0, 2420, 57]);
        face.name = 'Exit sign'; face.castShadow = false;
    }
    const sign = asset('room-sign', 'Wall room identity', [0, 2520, bz + 50], back);
    label(sign, spec.name.toUpperCase(), [Math.min(w - 500, 2700), 340], [0, 0, 0]);
    const board = asset('planning-board', options.boardName, [w * .17, 1640, bz + 65], back);
    box(board, [2200, 1000, 40], [0, 0, 0], metal, 8);
    const boardMap = canvasMat((c, W, H) => drawBoard(c, W, H));
    mesh(board, new THREE.PlaneGeometry(2140, 940), boardMap, [0, 0, 22]);
    // A real low support anchors all five daily activity kits.
    table('activity-table', 'Daily planning table', [layout.activity[0], 0, layout.activity[1]], 1300, 650, 740);
    cabinet('storage', [w / 2 - 760, 0, bz + 430], 1250, options.storage.height, options.storage.open);
    chair('mobile-desk-chair', [layout.desk[0], 0, layout.desk[1] + 1050], 450, Math.PI / 5);

    const kit = {
        THREE, room, root, layout, spec, h, group, options, box, mesh, rod, sphere, material, mat,
        w, d, ceiling, bz, front, index,
        wall, trim, accent, metal, ink, oak, paper, seat, glow, taskSeat, floor,
        asset, canvasMat, label, chair, table, monitor, cabinet, cart, byId, drawBoard, drawScreen,
        phaseMover: () => phaseMover(root, room), pivotMove,
        back, right, left, window, door, board, sky, screenMats
    };
    group.furnish(kit);
    if (TILE_CEILINGS.has(spec.id)) {
        // Floor boxes under the stations (towards the back edge of each desk) and the student tables.
        const at = [...(layout.stations || []).map(st => { const a = (st.turn || 0) * Math.PI / 180; return [st.at[0] - Math.sin(a) * 250, st.at[1] - Math.cos(a) * 250]; }),
            ...root.children.filter(o => /^student-table-/.test(o.userData.propId || '')).map(o => [o.position.x, o.position.z])];
        addPower(kit, at);
    }
    const dressAtmosphere = enrichInstitutionalRoom(kit);
    // Library props may belong to some dayparts only (placement.phases, as on
    // desks): a calculator left at first bell, the takeout boxes at the wrap.
    const decorate = room.decorateProp;
    room.decorateProp = (object, placement) => { if (placement.phases) object.userData.propPhases = placement.phases; decorate?.(object, placement); };
    // The photographed outlook takes over the daylight pane once it has loaded, whichever material a group module left on it.
    const windowVista = attachVista(skyPane, WINDOW_VISTAS[spec.id] || 'campus'); room.windowViewReady = Promise.all([room.windowViewReady, windowVista.ready]);
    const campusLife = addCampusLife({ room, root, layout, asset, byId });
    // Slim linear ceiling fixtures disappear with the camera cutaway.
    const ceilingGroup = new THREE.Group(); ceilingGroup.name = 'Ceiling lighting'; root.add(ceilingGroup); room.ceilingFixture = ceilingGroup;
    for (let n = 0; n < 3; n++) {
        const z = bz + d * (.2 + n * .29);
        box(ceilingGroup, [w * .68, 50, 150], [0, ceiling - 100, z], metal, 10);
        box(ceilingGroup, [w * .66, 8, 115], [0, ceiling - 129, z], glow, 6);
    }
    const lights = kit.lights = [[layout.desk[0], 2100, layout.desk[1]], [w * .2, 2200, bz + d * .46], [0, 2300, front - 1300]].map(at => {
        const light = new THREE.PointLight('#e7f3ff', 0, 5500 * root.scale.x, 2); light.position.set(...at); root.add(light); return light;
    });
    room.roomAtmosphere = (phase, gain = 1) => {
        const mode = spec.modes[phase] || spec.modes.morning;
        drawInstitutionalCampus(sky.map.image.getContext('2d'), 512, 512, phase, mode.sky, spec); sky.map.needsUpdate = true;
        windowVista.setPhase(phase);
        glow.emissiveIntensity = .15 + mode.practical * gain;
        screenMats.forEach(m => {
            // Screens stay readable without lighting the whole watch room.
            m.emissiveIntensity = phase === 'night' ? .19 : .14;
            if (screenPhase !== phase) {
                drawScreen(m.map.image.getContext('2d'), m.map.image.width, m.map.image.height, m.userData.screenVariant, phase);
                m.map.needsUpdate = true;
            }
        });
        screenPhase = phase;
        lights.forEach((l, n) => {
            l.color.set(n === 2 ? mode.colors[1] : mode.colors[0]);
            const night = phase === 'night';
            const background = night ? options.nightBackground : 1;
            const power = n === 0 ? 4 * mode.practical : (n === 1 ? 5 * mode.practical : 2 * mode.practical + 2 * mode.wash) * background;
            l.intensity = (root.scale.x * 1000) ** 2 * power * gain;
        });
        if (TILE_CEILINGS.has(spec.id)) dressTileCeiling(room, layout);
        visionPanel.emissiveIntensity = TILE_CEILINGS.has(spec.id) ? [0, 0, .1, .36, .18][Math.max(0, ['morning', 'afternoon', 'evening', 'night', 'party'].indexOf(phase))] : 0;
        corridor?.apply(phase, gain);
        for (const o of root.children) if (o.userData.propPhases) o.visible = o.userData.propPhases.includes(phase);
        root.traverse(o => { if (o.userData.propPhases && o.parent !== root) o.visible = o.userData.propPhases.includes(phase); });
        dressAtmosphere(phase, gain);
        campusLife.apply(phase, gain);
        root.userData.atmosphere = phase;
    };
    root.userData.dimensionsMm = { width: w, depth: d, height: ceiling };
    root.userData.environmentCategory = spec.category;
    room.roomAtmosphere('morning');
}
