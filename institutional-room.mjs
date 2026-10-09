import * as THREE from 'three';
import { institutionalOak, drawInstitutionalCampus, enrichInstitutionalRoom } from './institutional-detail.mjs?v=institutional-sweep-20261009';
import { INSTITUTIONAL_ROOMS, institutionalModule } from './institutional-scenes.mjs?v=institutional-sweep-20261009';

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
    mesh(window, new THREE.PlaneGeometry(d * .48, 1750), sky);
    for (const x of [-d * .24, 0, d * .24]) box(window, [45, 1840, 80], [x, 0, 5], trim, 3);
    for (const y of [-900, 900]) box(window, [d * .48 + 80, 50, 140], [0, y, 10], trim, 3);
    const door = new THREE.Group(); door.name = 'Room entry door'; right.add(door); door.position.set(w / 2 - 18, 0, front - 1600); door.rotation.y = -Math.PI / 2;
    box(door, [1020, 2240, 35], [0, 1120, 0], metal, 5);
    box(door, [930, 2150, 38], [0, 1075, 22], oak, 5);
    box(door, [200, 780, 10], [0, 1560, 47], mat('#9eb9bd', 'powder'), 5);
    rod(door, [310, 1040, 55], [310, 1190, 55], 12, metal);
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
        back, right, left, window, door, board, sky, screenMats
    };
    group.furnish(kit);
    const dressAtmosphere = enrichInstitutionalRoom(kit);
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
        dressAtmosphere(phase, gain);
        root.userData.atmosphere = phase;
    };
    root.userData.dimensionsMm = { width: w, depth: d, height: ceiling };
    root.userData.environmentCategory = spec.category;
    room.roomAtmosphere('morning');
}
