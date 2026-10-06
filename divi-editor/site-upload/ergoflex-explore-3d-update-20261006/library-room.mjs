import * as THREE from 'three';

// Campus-library concepts, not a survey of the Humboldt pilot site.
// Architecture and furniture coordinates are millimetres.
const sizes = [
    ['apartment', 'Student pilot study nook', 5400, 6600, 3000],
    ['house', 'Campus reading room', 7200, 9000, 3100],
    ['spacious', 'Learning commons', 10000, 12000, 3400],
    ['premium', 'University study hall', 13000, 16000, 3800],
    ['executive', 'Flagship library commons', 18000, 20000, 4400]
];
export const LIBRARY_LAYOUTS = Object.fromEntries(sizes.map(([id, name, width, depth, height], index) => {
    const back = -depth / 3, front = back + depth, desk = [-width / 2 + 1100, back + 1600];
    const reading = index === 0 ? [[width / 2 - 1300, front - 2200]] : index < 3 ? [[width / 2 - 1600, front - 2300]] : [[0, front - 2400], [width / 2 - 1800, front - 2400]];
    const stacks = [];
    // Rear stacks and freestanding double-sided shelves with clear aisles.
    const rearCount = index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 3 : index === 3 ? 4 : 6;
    for (let i = 0; i < rearCount; i++) stacks.push({ id: `rear-${i}`, at: [(i - (rearCount - 1) / 2) * 2000, back + 330], double: false });
    const columns = index === 1 ? [width / 2 - 1600] : index === 2 ? [0, 2600] : index === 3 ? [-1000, 2000, 5000] : [-2000, 1100, 4200, 7300];
    const rows = index === 1 ? [3000, 5000] : index === 2 ? [3000, 5400] : index === 3 ? [3000, 5400, 7800] : [3200, 5600, 8000, 10400];
    if (index) for (const [ci, x] of columns.entries()) for (const [ri, z] of rows.entries()) stacks.push({ id: `stack-${ci}-${ri}`, at: [x, back + z], double: true });
    const lounge = [-width / 2 + (index ? 1450 : 700), front - (index ? 650 : 900)];
    const carrels = index >= 2 ? [front - 4000, front - 5800].map((z, i) => ({ id: `carrel-${i}`, at: [-width / 2 + 420, z] })) : [];
    const props = [{ id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 1050], turn: 180 }, { id: 'monstera', at: [-width / 2 + 450, 0, back + 430] }];
    for (const [i, at] of reading.entries()) {
        const seats = index === 0 ? [-500, 500] : [-650, 650];
        for (const x of seats) for (const z of [-850, 850]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [at[0] + x, 0, at[1] + z], turn: z > 0 ? 180 : 0 });
        props.push({ id: 'kenney-furniture-laptop', at: [at[0] - 430, 740, at[1] - 260] }, { id: 'journal', at: [at[0] + 480, 740, at[1] + 260], turn: 12 },
            { id: 'kenney-furniture-books', at: [at[0] + 30, 740, at[1] + 250] });
    }
    if (index === 0) props.push({ id: 'kenney-furniture-lounge-chair', at: [lounge[0], 0, lounge[1]] });
    else props.push({ id: 'kenney-furniture-lounge-sofa', at: [lounge[0], 0, lounge[1]] }, { id: 'coffee-table', at: [lounge[0], 0, lounge[1] - 980] },
        { id: 'journal', at: [lounge[0] - 180, 391.2, lounge[1] - 980] });
    for (const carrel of carrels) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [carrel.at[0] + 800, 0, carrel.at[1]], turn: 90 },
        { id: 'journal', at: [carrel.at[0] + 60, 740, carrel.at[1]], turn: 90 });
    props.push({ id: 'monstera', at: [width / 2 - 480, 0, front - 550] });
    return [id, { id, name, width, depth, height, back, index, desk, reading, stacks, lounge, carrels, props, daylight: [-width / 2 + 100, back + depth * .4] }];
}));
export const libraryLayoutById = id => LIBRARY_LAYOUTS[id] || LIBRARY_LAYOUTS.apartment;
export const libraryLayoutForSize = size => LIBRARY_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const LIBRARY_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing study', key: '#fff0d7', fill: '#dcecf0', accent: '#c0d7be', power: 1.45, ambient: .46, bounce: .65, exposure: 1.07, sky: ['#8ebdce', '#e8ecdd'], practical: .25, wash: .18, colors: ['#f8dfb6', '#afd0ba'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Read & research · seated focus', key: '#fff3e2', fill: '#d9e8ee', accent: '#b9d1c4', power: 1.18, ambient: .46, bounce: .63, exposure: 1.07, sky: ['#b3d0dc', '#f0edde'], practical: .4, wash: .3, colors: ['#f3deb7', '#c0cebe'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm reading lights · angled notes and sketches', key: '#f2cba3', fill: '#becddb', accent: '#cfb58e', power: .62, ambient: .32, bounce: .43, exposure: 1.11, sky: ['#8096ad', '#d8b188'], practical: .85, wash: .6, colors: ['#f5d2a0', '#bac6b9'], height: 28, tilt: 12, offset: [0, 80], yaw: 0, leds: true, color: '#ffe1ad' },
    night: { label: 'Late study', description: 'Quiet late study · low ambient and task lights', key: '#b6c9df', fill: '#a6b8ce', accent: '#e0bd91', power: .22, ambient: .22, bounce: .28, exposure: 1.14, sky: ['#1b3048', '#4a657a'], practical: 1, wash: .42, colors: ['#ecc697', '#9fb7b2'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffdfaa' },
    party: { label: 'Study group', description: 'Share ideas · turn toward collaborative study', key: '#e8ddc8', fill: '#c2d9df', accent: '#a8c5a2', power: .8, ambient: .4, bounce: .53, exposure: 1.1, sky: ['#a5bbca', '#e3d5b9'], practical: .65, wash: .82, colors: ['#eed3ad', '#a4c9b2'], height: 43.5, tilt: -5, offset: [120, 250], yaw: -12, leds: true, color: '#c5edbd' }
};
function canvasMap(draw, w = 512, h = 512) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
export function buildLibraryRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, index } = layout, front = bz + d;
    const chalk = material('#e5e1d3', { roughness: .94 }), green = material('#436c58', { roughness: .86 }), dark = material('#344941'), brass = material('#b5a06b', { metalness: .55, roughness: .4 });
    const oakMap = canvasMap(c => { c.fillStyle = '#ac8960'; c.fillRect(0, 0, 512, 512); for (let x = 0; x < 512; x += 5) { c.strokeStyle = x % 3 ? '#684a2b25' : '#e2c48b35'; c.lineWidth = .8; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 8, 150, x - 12, 350, x + 2, 512); c.stroke(); } });
    const oak = material('#ffffff', { map: oakMap, roughness: .77 });
    const register = (obj, id, name) => { obj.userData.propId = id; obj.userData.sceneAssetName = name; markSceneAsset(obj, { key: `library:${layout.id}:fixture:${id}` }); };
    const group = (id, name, at = [0, 0, 0], parent = root) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g); register(g, id, name); return g; };
    const floorMap = canvasMap(c => { c.fillStyle = '#a2a796'; c.fillRect(0, 0, 512, 512); for (let y = 0; y < 512; y += 5) { c.strokeStyle = y % 3 ? '#e4e7d629' : '#464f4225'; c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); } c.strokeStyle = '#57624a20'; c.strokeRect(0, 0, 512, 512); });
    floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 600, d / 600);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: 1 }));
    box(root, [1900, 4, 2400], [layout.desk[0], 2, layout.desk[1] + 500], material('#c1c8b2', { roughness: 1 }), 8);
    const back = new THREE.Group(); back.name = 'Library commons wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], chalk); box(back, [w, 100, 25], [0, 50, bz + 12.5], oak);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const right = new THREE.Group(); right.name = 'Library study wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], chalk); box(right, [25, 100, d], [w / 2 - 12.5, 50, bz + d / 2], oak);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    const sign = group('commons-sign', 'Library commons identity', [0, 2460, bz + 35], back);
    const signMap = canvasMap(c => { c.fillStyle = '#436c58'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#efe8d2'; c.font = 'bold 73px sans-serif'; c.fillText('LIBRARY / COMMONS', 35, 115); c.font = '23px sans-serif'; c.fillText('READ   •   DISCOVER   •   STUDY   •   SHARE', 48, 188); }, 1024, 256);
    box(sign, [index ? 3100 : 2600, 500, 30], [0, 0, 0], material('#ffffff', { map: signMap }), 7);
    const window = new THREE.Group(); window.name = 'Library daylight and redwood view'; root.add(window);
    const ww = Math.min(6500, d * .6), wz = bz + d * .4, low = 820, wh = Math.min(2400, h - 1100), a = wz - ww / 2, b = wz + ww / 2;
    for (const [length, z] of [[a - bz, (a + bz) / 2], [front - b, (front + b) / 2]]) box(window, [80, h, length], [-w / 2 - 40, h / 2, z], chalk);
    box(window, [80, low, ww], [-w / 2 - 40, low / 2, wz], chalk); box(window, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], chalk);
    const skyMap = canvasMap(() => {}), sky = skyMap.image;
    const pane = mesh(window, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (let z = a; z <= b + 1; z += ww / 4) box(window, [60, wh + 35, 32], [-w / 2 + 16, low + wh / 2, z], dark);
    for (const y of [low, low + wh]) box(window, [60, 35, ww + 40], [-w / 2 + 16, y, wz], dark);
    box(window, [160, 30, ww + 70], [-w / 2 + 40, low - 15, wz], oak, 4);
    room.walls.push({ obj: window, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    const bookMats = ['#597b69', '#b29861', '#6f8490', '#a96955', '#d8c59a', '#515c66'].map(color => material(color, { roughness: .9 }));
    const bookGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const [si, spec] of layout.stacks.entries()) {
        const shelf = group(spec.id, spec.double ? 'Double-sided library book stack' : 'Library wall bookshelf', [spec.at[0], 0, spec.at[1]]);
        shelf.userData.libraryStack = { double: spec.double, width: 1800, depth: 560, height: 2000 };
        const dep = spec.double ? 560 : 500;
        for (const x of [-875, 875]) box(shelf, [50, 2000, dep], [x, 1000, 0], oak, 3);
        box(shelf, [1750, 80, dep], [0, 40, 0], oak); box(shelf, [1750, 40, dep], [0, 1980, 0], oak);
        box(shelf, [1750, 1920, 18], [0, 1000, spec.double ? 0 : -dep / 2 + 9], green);
        for (const y of [320, 710, 1100, 1490, 1880]) box(shelf, [1750, 22, dep], [0, y - 11, 0], oak);
        // Batch hundreds of book spines by colour rather than creating one
        // draw call per book. Bounds still participate in scene editing.
        const matrices = bookMats.map(() => []), temp = new THREE.Object3D();
        for (let level = 0; level < 4; level++) for (let k = 0; k < 22; k++) for (const side of spec.double ? [-1, 1] : [1]) {
            const height = 210 + (k * 47 + level * 31 + si * 19) % 105, width = 35 + k % 3 * 8;
            temp.position.set(-815 + k * 75, [320, 710, 1100, 1490][level] + height / 2, side * (spec.double ? 135 : 12));
            temp.scale.set(width, height, spec.double ? 235 : 260); temp.updateMatrix(); matrices[(k + level + si) % bookMats.length].push(temp.matrix.clone());
        }
        matrices.forEach((items, i) => { const books = new THREE.InstancedMesh(bookGeo, bookMats[i], items.length); items.forEach((m, j) => books.setMatrixAt(j, m)); books.castShadow = books.receiveShadow = true; books.computeBoundingBox(); shelf.add(books); });
        const labelMap = canvasMap(c => { c.fillStyle = '#436c58'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#ece4cc'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText(['ART / DESIGN', 'SCIENCE / NATURE', 'LITERATURE', 'HISTORY / CULTURE', 'TECHNOLOGY', 'REFERENCE'][si % 6], 256, 80); }, 512, 128);
        box(shelf, [1600, 120, 16], [0, 1900, dep / 2 + 8], material('#ffffff', { map: labelMap }));
    }
    for (const [i, at] of layout.reading.entries()) {
        const table = group(`reading-table-${i}`, 'Shared student study table', [at[0], 0, at[1]]), length = index ? 2400 : 1800;
        box(table, [length, 40, 950], [0, 720, 0], oak, 12);
        for (const x of [-length / 2 + 220, length / 2 - 220]) { box(table, [75, 700, 600], [x, 350, 0], green, 4); box(table, [600, 30, 710], [x, 15, 0], dark, 4); }
        box(table, [length - 260, 90, 120], [0, 785, 0], green, 5);
        for (const x of [-360, 360]) { box(table, [240, 5, 80], [x, 835, 0], dark, 3); for (const dx of [-45, 45]) box(table, [10, 2, 22], [x + dx, 838, 0], material('#c4c7b7')); }
    }
    for (const carrel of layout.carrels) {
        const g = group(carrel.id, 'Quiet window study carrel', [carrel.at[0], 0, carrel.at[1]]); g.rotation.y = Math.PI / 2;
        box(g, [1200, 35, 650], [0, 722.5, 0], oak, 8);
        for (const x of [-575, 575]) box(g, [50, 1250, 650], [x, 625, 0], green, 4);
        box(g, [1100, 400, 22], [0, 950, -315], material('#a3ac98', { roughness: 1 }), 4);
    }
    if (index) box(root, [2850, 4, 2200], [layout.lounge[0], 2, layout.lounge[1] - 650], material('#c4b591', { roughness: 1 }), 12);
    const pilot = group('pilot-information', 'ErgoFlex student pilot information', [layout.desk[0], 6, layout.desk[1] + 1800]);
    const pilotMap = canvasMap(c => { c.fillStyle = '#304f45'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#eee7d0'; c.font = 'bold 48px sans-serif'; c.textAlign = 'center'; c.fillText('ERGOFLEX / STUDENT PILOT', 512, 100); c.font = '28px sans-serif'; c.fillText('Choose your height • Find your angle • Make yourself at work', 512, 170); }, 1024, 256);
    const plaque = mesh(pilot, new THREE.PlaneGeometry(1500, 280), material('#ffffff', { map: pilotMap, roughness: 1 }), [0, 0, 0]); plaque.rotation.x = -Math.PI / 2; plaque.castShadow = false;
    const board = group('student-board', 'Student study and community board', [w / 2 - 35, 1760, bz + 1000], right); board.rotation.y = -Math.PI / 2;
    box(board, [1550, 1050, 30], [0, 0, 0], oak, 6); box(board, [1490, 990, 12], [0, 0, 22], material('#aeaa8d'));
    const infoMap = canvasMap(c => { c.fillStyle = '#eae6d5'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#436c58'; c.font = 'bold 40px sans-serif'; c.fillText('MAKE ROOM', 40, 90); c.font = '24px sans-serif'; ['FOR YOUR IDEAS', 'Quiet study', 'Shared learning', 'A desk that moves with you'].forEach((s, i) => c.fillText(s, 40, 150 + i * 75)); });
    box(board, [960, 840, 4], [0, 0, 31], material('#ffffff', { map: infoMap }));
    const glow = [], ceiling = new THREE.Group(); ceiling.name = 'Library suspended task lights'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const at of [layout.desk, ...layout.reading]) {
        for (const dx of [-480, 480]) rod(ceiling, [at[0] + dx, h, at[1]], [at[0] + dx, h - 420, at[1]], 3, brass);
        box(ceiling, [1400, 70, 130], [at[0], h - 450, at[1]], green, 5);
        const mat = material('#f2d6a8', { emissive: '#f2d6a8', emissiveIntensity: .3 }); glow.push(mat); box(ceiling, [1340, 8, 95], [at[0], h - 490, at[1]], mat, 3).castShadow = false;
    }
    // A genuine floor reading lamp keeps its base on the floor and its glowing
    // shade visible in the camera cutaway.
    const lamp = group('reading-lamp', 'Warm lounge reading lamp', [-w / 2 + 280, 0, front - 1950]);
    mesh(lamp, new THREE.CylinderGeometry(180, 180, 24, 24), brass, [0, 12, 0]); rod(lamp, [0, 20, 0], [0, 1750, 0], 14, brass);
    mesh(lamp, new THREE.CylinderGeometry(170, 230, 330, 28, 1, true), material('#d9c89f', { side: THREE.DoubleSide }), [0, 1580, 0]);
    const lampGlow = material('#f2d6a8', { emissive: '#f2d6a8', emissiveIntensity: .3 }); glow.push(lampGlow); mesh(lamp, new THREE.CylinderGeometry(222, 222, 8, 28), lampGlow, [0, 1420, 0]).castShadow = false;
    const lights = [
        { at: [layout.desk[0], 2100, layout.desk[1]], task: true, power: 4, range: 4300 },
        { at: [layout.reading[0][0], 2200, layout.reading[0][1]], task: true, power: 5, range: 5000 },
        { at: [0, 2450, bz + d * .43], task: false, power: 6, range: d * .8 },
        { at: [-w / 2 + 550, 1600, front - 1850], task: false, power: 3, range: 3700 }
    ].map(spec => { const light = new THREE.PointLight('#efd8b5', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = LIBRARY_MODES[modeId] || LIBRARY_MODES.morning, c = sky.getContext('2d');
        const gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        c.fillStyle = modeId === 'night' ? '#243e3d' : '#759d84'; c.beginPath(); c.moveTo(0, 430); c.bezierCurveTo(130, 270, 330, 380, 512, 310); c.lineTo(512, 512); c.lineTo(0, 512); c.fill();
        c.fillStyle = modeId === 'night' ? '#1f3635' : '#416e58';
        for (let i = 0; i < 14; i++) { const x = i * 41, y = 160 + i * 29 % 170; c.fillRect(x - 3, y, 6, 352); for (let j = 0; j < 5; j++) { const top = y + j * 40, size = 25 + j * 7; c.beginPath(); c.moveTo(x, top); c.lineTo(x - size, top + 75); c.lineTo(x + size, top + 75); c.fill(); } }
        skyMap.needsUpdate = true;
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .12 + mode.practical * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? mode.colors[0] : mode.colors[1]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; }); root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[chalk, 'plaster'], [green, 'powder'], [dark, 'powder'], [brass, 'metal'], [oak, 'wood']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
