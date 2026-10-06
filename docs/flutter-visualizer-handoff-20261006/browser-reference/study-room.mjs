import * as THREE from 'three';
import { HOME_LAYOUTS } from './home-office.mjs?v=desktop-tilt-reach-20261006';

const names = ['Apartment writing nook', 'Home study & reading room', 'Writer’s study & library', 'Private library & lounge', 'Library & conversation suite'];
export const STUDY_LAYOUTS = Object.fromEntries(Object.values(HOME_LAYOUTS).map((home, index) => {
    const { id, width, depth, height, back } = home, front = back + depth;
    const compact = index === 0, large = index >= 3;
    const desk = [compact ? -240 : -200, back + 850];
    const reading = [large ? -width / 2 + 680 : width / 2 - 700, front - 600];
    const table = [reading[0] + (large ? 820 : -830), front - 310];
    const console = [-width / 2 + 340, back + 650];
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 960], turn: 180 },
        { id: 'armchair-leather', at: [reading[0], 0, reading[1]], turn: large ? 10 : -10 },
        { id: 'coffee-table-2', at: [table[0], 0, table[1]] },
        { id: 'journal', at: [table[0] - 70, 700, table[1]], turn: -12 },
        { id: 'tea-cup', at: [table[0] + 115, 700, table[1] + 35] }
    ];
    if (!compact) props.push(
        { id: 'globe', at: [console[0], 740, console[1]] },
        { id: 'ink-quill', at: [console[0], 740, console[1] + 250] }
    );
    if (index === 2) props.push({ id: 'kenney-furniture-potted-plant', at: [-width / 2 + 280, 0, front - 450] });
    if (large) props.push(
        { id: 'sofa-leather-wood', at: [650, 0, front - 550] },
        { id: 'coffee-table', at: [650, 0, front - 1510] },
        { id: 'gramophone', at: [900, 391.2, front - 1510], turn: -12 },
        { id: 'journal', at: [290, 391.2, front - 1540] },
        { id: 'monstera', at: [width / 2 - 490, 0, front - 620] }
    );
    if (index === 4) props.push({ id: 'bookwheel', at: [-width / 2 + 950, 0, back + 2130], turn: 90 });
    return [id, { id, name: names[index], width, depth, height, back, desk, reading, table, console,
        compact, large, chess: index === 4, bays: compact ? 1 : large ? index : 2, props, daylight: [-width / 2 + 100, 450] }];
}));
export const studyLayoutById = id => STUDY_LAYOUTS[id] || STUDY_LAYOUTS.apartment;
export const studyLayoutForSize = size => STUDY_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

export const STUDY_MODES = {
    morning: { label: 'Morning', description: 'Fresh window light · standing planning and notes', key: '#fff0d5', fill: '#dce9ef', accent: '#dfc094', power: 1.55, ambient: .48, bounce: .65, exposure: 1.07, sky: ['#a7c5d4', '#eae4ce'], practical: .2, wash: .15, colors: ['#ebc895', '#bdd1c5'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft daylight · seated writing and research', key: '#fff2df', fill: '#e0e9ef', accent: '#edc497', power: 1.22, ambient: .45, bounce: .6, exposure: 1.08, sky: ['#a8c1d2', '#eee5d4'], practical: .35, wash: .3, colors: ['#e8c397', '#bbcdbf'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm lamps · desk angled for reading', key: '#f8d4ae', fill: '#c9d8e6', accent: '#f6bf83', power: .7, ambient: .32, bounce: .42, exposure: 1.12, sky: ['#9099b0', '#dbb397'], practical: .9, wash: .75, colors: ['#f3c48d', '#c2cbbb'], height: 28, tilt: 12, offset: [0, 65], yaw: 0, leds: true, color: '#ffdea6' },
    night: { label: 'Night', description: 'Quiet late reading · warm desk and shelf lights', key: '#c5d6e9', fill: '#c4d1df', accent: '#eab67c', power: .25, ambient: .25, bounce: .3, exposure: 1.16, sky: ['#20344a', '#4c5e75'], practical: 1, wash: .9, colors: ['#edc18a', '#9fafab'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffe6b9' },
    party: { label: 'Conversation', description: 'Books and conversation · desk turned toward the room', key: '#e4d6c4', fill: '#cedce6', accent: '#e6b789', power: .55, ambient: .34, bounce: .42, exposure: 1.12, sky: ['#566a81', '#a69991'], practical: .75, wash: .85, colors: ['#f1cda1', '#b9cbbf'], height: 43.5, tilt: 0, offset: [60, 250], yaw: -12, leds: true, color: '#f5d8ac' }
};

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height); const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}

export function buildStudyRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz } = layout, front = bz + d;
    const oak = material('#80664a', { roughness: .78 }), sage = material('#829087', { roughness: .95 });
    const cream = material('#ddd5c5', { roughness: .95 }), dark = material('#303c3d', { roughness: .75 });
    const brass = material('#b89b64', { metalness: .62, roughness: .4 });
    const register = (object, id, name) => {
        object.userData.propId = id; object.userData.sceneAssetName = name;
        markSceneAsset(object, { key: `study:${layout.id}:fixture:${id}` });
    };
    const woodMap = texture((c, tw, th) => {
        c.fillStyle = '#a28a67'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 6; i++) {
            c.fillStyle = ['#ae9471', '#9b815f', '#b49b77'][i % 3]; c.fillRect(i * tw / 6, 0, tw / 6 - 2, th);
            c.strokeStyle = '#51392428'; c.lineWidth = 1;
            for (let j = 0; j < 18; j++) { const x = i * tw / 6 + j * 4.3; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x - 4, th / 3, x + 3, th * .7, x, th); c.stroke(); }
            c.fillStyle = '#4b38232d'; c.fillRect(i * tw / 6, (i % 3 + 1) * th / 4, tw / 6, 2);
        }
    }, 512, 1024); woodMap.repeat.set(w / 1300, d / 2000);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: woodMap, roughness: .8 }));
    const rugMap = texture((c, tw, th) => {
        c.fillStyle = '#988d74'; c.fillRect(0, 0, tw, th);
        const borders = ['#c6b691', '#465b58', '#d1b58d', '#605a47'];
        borders.forEach((color, i) => { c.strokeStyle = color; c.lineWidth = 8; c.strokeRect(16 + i * 15, 16 + i * 15, tw - 32 - i * 30, th - 32 - i * 30); });
        c.fillStyle = '#d1b58d';
        for (let x = 110; x < 440; x += 52) for (let y = 110; y < 440; y += 52) { c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 7, y); c.lineTo(x, y + 9); c.lineTo(x - 7, y); c.fill(); }
        c.strokeStyle = '#b6b5a52d'; c.lineWidth = .7; for (let y = 0; y < th; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(tw, y); c.stroke(); }
    });
    box(root, [layout.compact ? 1950 : 2250, 4, 1750], [layout.desk[0], 2, layout.desk[1] + 540], material('#ffffff', { map: rugMap, roughness: 1 }), 4);
    const back = new THREE.Group(); back.name = 'Study paneled writing wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], sage);
    box(back, [w, 740, 35], [0, 370, bz + 18], oak);
    box(back, [w, 35, 55], [0, 760, bz + 28], oak, 3);
    for (let i = 0; i < Math.floor(w / 500); i++) box(back, [22, 600, 15], [-w / 2 + 250 + i * 500, 360, bz + 43], cream, 2);
    const map = texture((c, tw, th) => {
        c.fillStyle = '#ded2b4'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#94734f'; c.lineWidth = 2;
        for (let i = 0; i < 18; i++) { c.beginPath(); for (let x = 0; x <= tw; x += 8) { const y = 50 + i * 25 + Math.sin(x * .025 + i * .35) * 19 + Math.sin(x * .011) * 22; if (!x) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
        c.strokeStyle = '#677d76'; c.lineWidth = 6; c.beginPath(); c.moveTo(410, 20); c.bezierCurveTo(250, 160, 370, 290, 110, 490); c.stroke();
        c.fillStyle = '#655b44'; c.font = '18px serif'; c.fillText('THE QUIET LANDSCAPE', 34, 475);
    });
    const art = new THREE.Group(); art.name = 'Original contour landscape'; art.position.set(layout.desk[0], 2070, bz + 36); back.add(art);
    box(art, [layout.compact ? 1070 : 1420, 620, 35], [0, 0, 0], oak, 3);
    box(art, [layout.compact ? 1030 : 1380, 580, 6], [0, 0, 23], material('#ffffff', { map, roughness: .95 }));
    register(art, 'study-landscape', 'Framed contour landscape');
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const side = new THREE.Group(); side.name = 'Study library wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], cream);
    box(side, [24, 90, d], [w / 2 - 12, 45, bz + d / 2], oak);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    const entry = new THREE.Group(); entry.name = 'Study window and entry wall'; root.add(entry);
    const wz = 450, ww = layout.compact ? 1250 : 1750, low = 850, wh = 1400, a = wz - ww / 2, b = wz + ww / 2;
    box(entry, [80, h, a - bz], [-w / 2 - 40, h / 2, (a + bz) / 2], cream);
    box(entry, [80, h, front - b], [-w / 2 - 40, h / 2, (front + b) / 2], cream);
    box(entry, [80, low, ww], [-w / 2 - 40, low / 2, wz], cream);
    box(entry, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], cream);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(entry, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [a, wz, b]) box(entry, [65, wh + 45, 28], [-w / 2 + 8, low + wh / 2, z], oak);
    for (const y of [low, low + wh]) box(entry, [65, 28, ww + 50], [-w / 2 + 8, y, wz], oak);
    box(entry, [180, 30, ww + 80], [-w / 2 + 50, low - 15, wz], oak, 3);
    for (const z of [a - 100, b + 100]) for (let i = 0; i < 5; i++) { const fold = mesh(entry, new THREE.CylinderGeometry(25, 25, 2070, 10), material('#b4ae97'), [-w / 2 + 72, 1220, z - 72 + i * 35]); fold.castShadow = false; }
    rod(entry, [-w / 2 + 90, 2290, a - 190], [-w / 2 + 90, 2290, b + 190], 11, brass);
    const doorZ = front - 470;
    box(entry, [25, 2100, 800], [-w / 2 + 20, 1050, doorZ], oak, 4);
    box(entry, [18, 1950, 710], [-w / 2 + 43, 975, doorZ], sage, 3);
    rod(entry, [-w / 2 + 63, 1000, doorZ - 265], [-w / 2 + 63, 1000, doorZ - 185], 8, brass);
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    const glow = [];
    const strip = (parent, size, at) => {
        const mat = material('#e8ca9e', { emissive: '#e8ca9e', emissiveIntensity: .3 });
        const obj = box(parent, size, at, mat, 2); obj.castShadow = false; glow.push(mat);
    };
    // Each library bay remains an editable group. Books use instanced geometry
    // so a large library does not add hundreds of individual draw calls.
    const bookColors = ['#5b7269', '#83594b', '#aa8a58', '#405768', '#b4aa91', '#625568'];
    for (let bay = 0; bay < layout.bays; bay++) {
        const cabinet = new THREE.Group(); cabinet.name = 'Study bookcase bay ' + (bay + 1); cabinet.position.set(w / 2 - 195, 0, bz + 640 + bay * 1100); cabinet.rotation.y = -Math.PI / 2; root.add(cabinet);
        register(cabinet, 'study-bookcase-' + bay, 'Oak library bay ' + (bay + 1));
        box(cabinet, [940, 2270, 24], [0, 1135, -157], oak);
        for (const x of [-458, 458]) box(cabinet, [24, 2300, 350], [x, 1150, 0], oak);
        box(cabinet, [940, 24, 350], [0, 2288, 0], oak);
        box(cabinet, [900, 350, 340], [0, 175, 0], oak, 2);
        for (const x of [-215, 215]) { box(cabinet, [414, 290, 12], [x, 180, 176], dark, 2); rod(cabinet, [x, 165, 187], [x, 220, 187], 5, brass); }
        const slots = Array.from({ length: 6 }, () => []);
        for (let shelf = 0; shelf < 6; shelf++) {
            const y = 380 + shelf * 320;
            box(cabinet, [900, 20, 350], [0, y, 0], oak);
            strip(cabinet, [850, 7, 8], [0, y + 304, 160]);
            let x = -417;
            for (let i = 0; i < 22; i++) {
                const width = 19 + (i * 13 + shelf * 7) % 18, height = 217 + (i * 19 + bay * 11) % 76;
                if (x + width > 417) break;
                slots[(i + shelf + bay) % 6].push({ size: [width, height, 180 + i % 3 * 10], at: [x + width / 2, y + 10 + height / 2, 22] }); x += width + 3;
            }
        }
        slots.forEach((books, i) => {
            const obj = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material(bookColors[i], { roughness: .9 }), books.length); obj.castShadow = obj.receiveShadow = true;
            const matrix = new THREE.Matrix4();
            books.forEach((b, n) => { matrix.makeScale(...b.size); matrix.setPosition(...b.at); obj.setMatrixAt(n, matrix); }); obj.instanceMatrix.needsUpdate = true; obj.computeBoundingBox(); cabinet.add(obj);
            const bands = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), brass, books.length * 2);
            books.forEach((b, n) => { for (let k = 0; k < 2; k++) { matrix.makeScale(b.size[0] - 4, 3, 2); matrix.setPosition(b.at[0], b.at[1] + (k ? 1 : -1) * (b.size[1] / 2 - 26), b.at[2] + b.size[2] / 2 + 1); bands.setMatrixAt(n * 2 + k, matrix); } }); bands.instanceMatrix.needsUpdate = true; bands.computeBoundingBox(); cabinet.add(bands);
        });
    }
    if (!layout.compact) {
        const [x, z] = layout.console;
        box(root, [620, 650, 740], [x, 385, z + 110], oak, 5);
        box(root, [650, 30, 760], [x, 725, z + 110], oak, 3);
        for (const sx of [-220, 220]) for (const sz of [-240, 450]) box(root, [40, 60, 40], [x + sx, 30, z + sz], dark, 2);
    }
    // A small reading lamp puts a warm pool beside the chair in every tier.
    const lampGroup = new THREE.Group(); lampGroup.name = 'Study reading lamp'; lampGroup.position.set(layout.reading[0] + (layout.large ? -420 : -680), 0, layout.reading[1] - (layout.large ? 760 : 130)); root.add(lampGroup);
    register(lampGroup, 'study-reading-lamp', 'Brass reading lamp');
    mesh(lampGroup, new THREE.CylinderGeometry(115, 125, 20, 24), brass, [0, 10, 0]);
    rod(lampGroup, [0, 20, 0], [0, 1330, 0], 12, brass);
    const shade = mesh(lampGroup, new THREE.ConeGeometry(135, 200, 24, 1, true), material('#d1c5a4', { side: THREE.DoubleSide, roughness: .9 }), [0, 1410, 0]); shade.rotation.z = -.12;
    const bulbMat = material('#f2d3a2', { emissive: '#f2d3a2', emissiveIntensity: .4 }); sphere(lampGroup, [32, 32, 32], [0, 1350, 0], bulbMat);
    if (layout.large) box(root, [2700, 4, 2060], [650, 2, front - 1050], material('#ffffff', { map: rugMap, roughness: 1 }), 6);
    if (layout.chess) {
        const chess = new THREE.Group(); chess.name = 'Study chess table'; chess.position.set(350, 0, front - 2580); root.add(chess); register(chess, 'study-chess', 'Chess table and stools');
        box(chess, [1050, 40, 900], [0, 730, 0], oak, 5);
        for (const x of [-410, 410]) for (const z of [-340, 340]) box(chess, [55, 710, 55], [x, 355, z], oak, 3);
        const board = texture((c, tw, th) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { c.fillStyle = (x + y) % 2 ? '#596861' : '#d5c5a2'; c.fillRect(x * tw / 8, y * th / 8, tw / 8, th / 8); } });
        box(chess, [540, 12, 540], [0, 756, 0], material('#ffffff', { map: board, roughness: .75 }));
        for (const side of [-1, 1]) for (let row = 0; row < 2; row++) for (let col = 0; col < 8; col++) {
            const x = (col - 3.5) * 67.5, z = side * (3.5 - row) * 67.5, mat = side < 0 ? cream : dark;
            mesh(chess, new THREE.CylinderGeometry(16, 21, 11, 16), mat, [x, 767.5, z]);
            const height = row ? 27 : 40 + (col === 3 || col === 4 ? 14 : 0);
            mesh(chess, new THREE.CylinderGeometry(8, 14, height, 12), mat, [x, 773 + height / 2, z]); sphere(chess, [12, 13, 12], [x, 773 + height, z], mat);
        }
        for (const sign of [-1, 1]) {
            box(chess, [470, 60, 400], [0, 430, sign * 840], dark, 12);
            for (const x of [-175, 175]) for (const z of [-135, 135]) box(chess, [35, 400, 35], [x, 200, sign * 840 + z], oak, 2);
        }
    }
    const ceiling = new THREE.Group(); ceiling.name = 'Study suspended reading light'; root.add(ceiling); room.ceilingFixture = ceiling;
    rod(ceiling, [layout.desk[0], h, layout.desk[1] + 300], [layout.desk[0], h - 340, layout.desk[1] + 300], 5, brass);
    mesh(ceiling, new THREE.CylinderGeometry(190, 270, 140, 24), material('#cbbf9b'), [layout.desk[0], h - 400, layout.desk[1] + 300]);
    const diffuser = mesh(ceiling, new THREE.CylinderGeometry(255, 255, 3, 24), bulbMat, [layout.desk[0], h - 471, layout.desk[1] + 300]); diffuser.castShadow = false;
    const lights = [
        { at: [layout.desk[0] + 360, 1350, layout.desk[1] - 160], power: 2.7, range: 3000, task: true },
        { at: [w / 2 - 500, 1900, bz + 1180], power: 2.8, range: 3500 },
        { at: [lampGroup.position.x, 1340, lampGroup.position.z], power: 2.4, range: 3000, task: true },
        { at: [650, 1900, front - 1250], power: 3.1, range: 4500 }
    ].map(spec => { const light = new THREE.PointLight('#f2d4ad', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = STUDY_MODES[modeId] || STUDY_MODES.afternoon;
        const c = skyCanvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        c.fillStyle = '#82917c'; for (let i = 0; i < 12; i++) c.fillRect(i * 45, 468 - i % 3 * 18, 34, 70); skyMap.needsUpdate = true;
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .08 + mode.wash * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? '#f8dbac' : mode.colors[0]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        bulbMat.emissiveIntensity = .15 + mode.practical * .7; root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[oak, 'wood'], [sage, 'plaster'], [cream, 'plaster'], [dark, 'powder'], [brass, 'metal']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
