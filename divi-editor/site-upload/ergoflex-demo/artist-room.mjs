import * as THREE from 'three';
import { HOME_LAYOUTS } from './home-office.mjs?v=remote-header-wrap-20261006';

// Interior dimensions in millimetres. Room choice and desk size are independent.
const names = ['Apartment art nook', 'Home artist studio', 'Drawing & painting studio', 'Artist atelier & lounge', 'Fine art & making suite'];
export const ARTIST_LAYOUTS = Object.fromEntries(Object.values(HOME_LAYOUTS).map((home, index) => {
    const { id, width, depth, height, back } = home, front = back + depth;
    const compact = index === 0, large = index >= 3;
    const desk = [compact ? -80 : -200, back + 850];
    const cabinet = [width / 2 - 310, back + 1430];
    const easel = [-width / 2 + 670, front - (large ? 2100 : 740)];
    const table = [-width / 2 + 770, front - 880];
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 980], turn: 180 },
        { id: 'paper-bin', at: [width / 2 - 250, 0, back + 2360] },
        { id: 'kenney-furniture-potted-plant', at: [-width / 2 + 250, 0, back + 290] },
        { id: 'kenney-furniture-books', at: [width / 2 - 165, 1524, back + 1190], turn: -90 },
        { id: 'kenney-furniture-plant-small1', at: [width / 2 - 160, 1524, back + 1770] }
    ];
    if (!compact) props.push({ id: 'printer-3d', at: [cabinet[0], 900, cabinet[1] + 180], turn: -90 });
    if (index === 2) props.push(
        { id: 'armchair-poppi', at: [width / 2 - 650, 0, front - 590], turn: -15 },
        { id: 'coffee-table-2', at: [width / 2 - 650, 0, front - 1360] },
        { id: 'tea-cup', at: [width / 2 - 650, 700, front - 1360] }
    );
    if (large) props.push(
        { id: 'kenney-furniture-lounge-sofa', at: [650, 0, front - 490] },
        { id: 'coffee-table', at: [650, 0, front - 1490] },
        { id: 'sketchbook', at: [470, 391.2, front - 1510], turn: -8 },
        { id: 'antique-vase', at: [970, 391.2, front - 1480] },
        { id: 'papers', at: [table[0], 910, table[1] - 330], turn: 90 },
        { id: 'ruler-set-square', at: [table[0] + 160, 910, table[1] + 170], turn: 90 },
        { id: 'long-scissors', at: [table[0] - 150, 910, table[1] + 190], turn: 20 },
        { id: 'monstera', at: [width / 2 - 480, 0, back + 460] }
    );
    return [id, { id, name: names[index], width, depth, height, back, desk, cabinet, easel, table,
        compact, large, sculpture: index === 4, props, daylight: [-width / 2 + 100, 400] }];
}));
export const artistLayoutById = id => ARTIST_LAYOUTS[id] || ARTIST_LAYOUTS.apartment;
export const artistLayoutForSize = size => ARTIST_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

export const ARTIST_MODES = {
    morning: { label: 'Morning', description: 'Soft window light · standing sketch warm-up', key: '#fff2db', fill: '#e2edf5', accent: '#eed4af', power: 1.6, ambient: .5, bounce: .7, exposure: 1.06, sky: ['#b1d0d9', '#eee8d8'], practical: .2, wash: .1, colors: ['#f2d3aa', '#c4d8d0'], height: 43.5, tilt: 12, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Balanced daylight · seated drawing and color studies', key: '#fff7e9', fill: '#e3edf4', accent: '#e7cfaa', power: 1.25, ambient: .48, bounce: .68, exposure: 1.06, sky: ['#a8c6d7', '#eee9db'], practical: .4, wash: .2, colors: ['#eed2ac', '#c3d2d0'], height: 28, tilt: 18, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden-hour painting · standing drawing angle', key: '#ffd5ad', fill: '#d3dfeb', accent: '#ffc492', power: .8, ambient: .36, bounce: .48, exposure: 1.1, sky: ['#9c9db6', '#e8bc9b'], practical: .9, wash: .6, colors: ['#ffd09d', '#c9becf'], height: 43.5, tilt: 30, offset: [0, 80], yaw: -4, leds: true, color: '#ffe1b0' },
    night: { label: 'Night', description: 'Quiet making · neutral task light with gentle accents', key: '#dce5f1', fill: '#cbd9e9', accent: '#f1d1a9', power: .3, ambient: .27, bounce: .36, exposure: 1.14, sky: ['#25364d', '#52617a'], practical: 1, wash: .45, colors: ['#eedbc0', '#bdccdd'], height: 28, tilt: 12, offset: [0, 80], yaw: 0, leds: true, color: '#fff1d5' },
    party: { label: 'Open studio', description: 'Share your work · standing desk turned toward visitors', key: '#efdfd2', fill: '#dde2e9', accent: '#e7b89c', power: .65, ambient: .38, bounce: .48, exposure: 1.12, sky: ['#65677e', '#b6a092'], practical: .8, wash: .95, colors: ['#ffcaa4', '#b5d7d3'], height: 43.5, tilt: 0, offset: [80, 230], yaw: -12, leds: true, color: '#ffcfac' }
};

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}

// Original paintings, generated once per scene; no remote image requests.
function painting(seed = 0) {
    return texture((c, w, h) => {
        c.fillStyle = '#eee7d7'; c.fillRect(0, 0, w, h);
        const colors = ['#b56f52', '#819992', '#d0b278', '#394d5a', '#e3d3b5'];
        c.save(); c.translate(w / 2, h / 2); c.rotate((seed - 1) * .18);
        colors.forEach((color, i) => {
            c.fillStyle = colors[(i + seed) % colors.length];
            c.beginPath(); c.ellipse((i % 3 - 1) * 85, (i % 2 ? 1 : -1) * 70, 95 + i * 8, 165 - i * 17, i * .44, 0, Math.PI * 2); c.fill();
        }); c.restore();
        c.strokeStyle = '#f5eddf'; c.lineWidth = 3;
        for (let i = 0; i < 32; i++) { c.beginPath(); c.moveTo(40, 70 + i * 11); c.bezierCurveTo(180, i * 12, 300, 210 + i * 6, 465, 140 + i * 10); c.stroke(); }
        // Subtle canvas weave, not a glossy screen.
        c.strokeStyle = '#4d433818'; c.lineWidth = .6;
        for (let i = 0; i < w; i += 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
    }, 512, 640);
}

export function buildArtistRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, cabinet: [cx, cz] } = layout, front = bz + d;
    const oak = material('#b69a73', { roughness: .8 }), chalk = material('#e9e4d8', { roughness: .95 });
    const clay = material('#a77461', { roughness: .85 }), blue = material('#5f7b81', { roughness: .85 });
    const metal = material('#4a5150', { metalness: .45, roughness: .55 });
    const register = (group, id, name) => {
        group.userData.propId = id; group.userData.sceneAssetName = name;
        markSceneAsset(group, { key: `creative:${layout.id}:fixture:${id}` });
    };
    const plaster = texture((c, tw, th) => {
        c.fillStyle = '#eee9df'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 2000; i++) { c.fillStyle = i % 2 ? '#8f806609' : '#ffffff22'; c.fillRect(i * 73 % tw, i * 119 % th, 2, 2); }
    }); plaster.repeat.set(3, 2);
    const wallMat = material('#ffffff', { map: plaster, roughness: 1 });
    const floorMap = texture((c, tw, th) => {
        c.fillStyle = '#c5ac88'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 6; i++) {
            c.fillStyle = ['#c6ad89', '#bca380', '#d0b895'][i % 3]; c.fillRect(i * tw / 6, 0, tw / 6 - 2, th);
            c.strokeStyle = '#72523526'; c.lineWidth = .7;
            for (let j = 0; j < 17; j++) { const x = i * tw / 6 + j * 4.8; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 4, th * .3, x - 4, th * .65, x, th); c.stroke(); }
            c.fillStyle = '#75644a30'; c.fillRect(i * tw / 6, (i % 3 + 1) * th / 4, tw / 6, 2);
        }
    }, 512, 1024); floorMap.repeat.set(w / 1300, d / 2000);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .85 }));
    const rugMap = texture((c, tw, th) => {
        c.fillStyle = '#d9cdb2'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#9b9d9030'; c.lineWidth = 1;
        for (let y = 0; y < th; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(tw, y); c.stroke(); }
        c.strokeStyle = '#a8775f'; c.lineWidth = 9; c.strokeRect(24, 24, tw - 48, th - 48);
    });
    box(root, [layout.compact ? 2000 : 2300, 4, 1700], [layout.desk[0], 2, layout.desk[1] + 500], material('#ffffff', { map: rugMap, roughness: 1 }), 4);

    const back = new THREE.Group(); back.name = 'Artist gallery wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], wallMat);
    box(back, [w, 90, 20], [0, 45, bz + 10], chalk);
    const frame = (parent, width, height, at, seed, label) => {
        const art = new THREE.Group(); art.name = label; art.position.set(...at); parent.add(art);
        box(art, [width, height, 32], [0, 0, 0], oak, 3);
        box(art, [width - 34, height - 34, 8], [0, 0, 20], material('#ffffff', { map: painting(seed), roughness: .96 }));
        return art;
    };
    for (let i = 0; i < 3; i++) {
        const art = frame(back, layout.compact ? 450 : 550, 690, [layout.desk[0] + (i - 1) * (layout.compact ? 520 : 640), 2080, bz + 35], i, 'Original color study ' + (i + 1));
        register(art, 'artist-study-' + i, 'Framed color study ' + (i + 1));
    }
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const side = new THREE.Group(); side.name = 'Artist materials wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], wallMat);
    box(side, [20, 90, d], [w / 2 - 10, 45, bz + d / 2], chalk);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    const entry = new THREE.Group(); entry.name = 'Artist daylight wall'; root.add(entry);
    const wz = 400, ww = layout.compact ? 1400 : 2000, low = 820, wh = 1530, a = wz - ww / 2, b = wz + ww / 2;
    box(entry, [80, h, a - bz], [-w / 2 - 40, h / 2, (a + bz) / 2], wallMat);
    box(entry, [80, h, front - b], [-w / 2 - 40, h / 2, (front + b) / 2], wallMat);
    box(entry, [80, low, ww], [-w / 2 - 40, low / 2, wz], wallMat);
    box(entry, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], wallMat);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(entry, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]);
    pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [a, wz, b]) box(entry, [55, wh + 50, 24], [-w / 2 + 8, low + wh / 2, z], chalk);
    for (const y of [low, low + wh]) box(entry, [70, 28, ww + 50], [-w / 2 + 8, y, wz], chalk);
    box(entry, [180, 30, ww + 80], [-w / 2 + 50, low - 15, wz], oak, 3);
    const blind = material('#d0bfa3');
    for (let i = 0; i < 8; i++) box(entry, [44, 14, ww + 70], [-w / 2 + 45, 2315 - i * 24, wz], blind);
    const doorZ = front - 480;
    box(entry, [28, 2100, 800], [-w / 2 + 20, 1050, doorZ], oak, 4);
    box(entry, [18, 1970, 720], [-w / 2 + 43, 985, doorZ], chalk, 4);
    rod(entry, [-w / 2 + 65, 1000, doorZ - 270], [-w / 2 + 65, 1000, doorZ - 180], 8, metal);
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    const storage = new THREE.Group(); storage.name = 'Art materials cabinet'; root.add(storage);
    box(storage, [550, 780, 1100], [cx, 460, cz], clay, 6);
    box(storage, [570, 50, 1120], [cx, 875, cz], oak, 3); // top exactly 900 mm
    for (const z of [cz - 440, cz + 440]) for (const x of [cx - 200, cx + 200]) box(storage, [40, 70, 40], [x, 35, z], oak);
    for (let i = 0; i < 4; i++) {
        box(storage, [10, 157, 1040], [cx - 280, 210 + i * 185, cz], clay, 3);
        rod(storage, [cx - 289, 220 + i * 185, cz - 60], [cx - 289, 220 + i * 185, cz + 60], 5, metal);
    }
    box(side, [300, 24, 1080], [w / 2 - 165, 1512, cz], oak, 2);
    // Pinned sketches and swatches face into the room above the cabinet.
    const board = new THREE.Group(); board.position.set(w / 2 - 40, 2010, cz); board.rotation.y = -Math.PI / 2; side.add(board);
    box(board, [1040, 720, 30], [0, 0, 0], oak, 3);
    box(board, [1000, 680, 10], [0, 0, 22], material('#b8a98b'));
    for (let i = 0; i < 5; i++) {
        const sheet = box(board, [155, 220, 3], [-360 + i * 175, i % 2 ? -90 : 80, 32], material('#ffffff', { map: painting(i % 3), roughness: 1 })); sheet.rotation.z = (i % 3 - 1) * .07;
        sphere(board, [5, 5, 4], [-360 + i * 175, (i % 2 ? -90 : 80) + 100, 38], metal);
    }
    const brushCup = (parent, at) => {
        const cup = new THREE.Group(); cup.position.set(...at); parent.add(cup);
        mesh(cup, new THREE.CylinderGeometry(47, 38, 90, 20), blue, [0, 45, 0]);
        for (let i = 0; i < 7; i++) {
            const x = (i % 3 - 1) * 18, z = (Math.floor(i / 3) - 1) * 19, top = 205 + i % 3 * 16;
            rod(cup, [x, 60, z], [x + i % 2 * 10, top, z], 4, oak);
            box(cup, [12, 25, 7], [x + i % 2 * 10, top + 12, z], i % 2 ? clay : blue, 2);
        }
        return cup;
    };
    brushCup(storage, [cx, 900, cz - 350]);
    for (let i = 0; i < 4; i++) {
        const paint = material(['#b95d46', '#d9bb63', '#628b89', '#536780'][i]);
        mesh(storage, new THREE.CylinderGeometry(23, 23, 65, 16), paint, [cx + (i - 1.5) * 55, 932.5, cz - 100]);
        mesh(storage, new THREE.CylinderGeometry(24, 24, 7, 16), chalk, [cx + (i - 1.5) * 55, 968.5, cz - 100]);
    }

    if (!layout.compact) {
        const easel = new THREE.Group(); easel.name = 'Artist painting easel'; easel.position.set(layout.easel[0], 0, layout.easel[1]); easel.rotation.y = .22; root.add(easel);
        register(easel, 'artist-easel', 'Painting easel and canvas');
        for (const x of [-310, 310]) { box(easel, [65, 30, 650], [x, 15, 0], oak, 3); rod(easel, [x, 40, -170], [x * .85, 1830, -170], 23, oak); }
        box(easel, [740, 60, 90], [0, 770, -120], oak, 4);
        box(easel, [540, 40, 50], [0, 1770, -150], oak, 3);
        const art = frame(easel, 660, 850, [0, 1220, -140], 2, 'Painting in progress');
        art.rotation.x = -.025;
        rod(easel, [0, 1700, -170], [0, 40, 285], 21, oak);
        box(easel, [80, 30, 90], [0, 15, 285], oak, 3);
        brushCup(easel, [270, 800, -75]);
    }
    if (layout.large) {
        const table = new THREE.Group(); table.name = 'Artist materials worktable'; table.position.set(layout.table[0], 0, layout.table[1]); root.add(table);
        register(table, 'artist-worktable', 'Materials and paper worktable');
        box(table, [800, 45, 1500], [0, 887.5, 0], oak, 5);
        for (const x of [-315, 315]) for (const z of [-660, 660]) box(table, [50, 865, 50], [x, 432.5, z], blue, 2);
        box(table, [670, 22, 1330], [0, 310, 0], oak, 3);
        for (let i = 0; i < 4; i++) box(table, [590, 70, 180], [0, 356 + i % 2 * 80, -460 + Math.floor(i / 2) * 860], material(i % 2 ? '#c8b69c' : '#e4dfd1'), 3);
        brushCup(table, [-240, 910, -610]);
        box(root, [2400, 4, 1950], [650, 2, front - 990], material('#d2c2ae', { map: rugMap, roughness: 1 }), 8);
        const art = frame(side, 1100, 850, [w / 2 - 30, 1850, front - 1400], 1, 'Original atelier painting'); art.rotation.y = -Math.PI / 2;
    }
    if (layout.sculpture) {
        const sculpture = new THREE.Group(); sculpture.name = 'Artist sculpture station'; sculpture.position.set(w / 2 - 680, 0, front - 2750); root.add(sculpture);
        register(sculpture, 'artist-sculpture', 'Sculpture study and plinth');
        box(sculpture, [620, 900, 620], [0, 450, 0], chalk, 4);
        const ceramic = material('#c09b80', { roughness: .75 });
        sphere(sculpture, [150, 90, 140], [0, 990, 0], ceramic);
        const loop = mesh(sculpture, new THREE.TorusGeometry(135, 45, 12, 36), ceramic, [0, 1200, 0]); loop.rotation.y = .35;
        sphere(sculpture, [65, 85, 65], [95, 1320, 0], ceramic);
        box(root, [1500, 5, 1500], [w / 2 - 680, 2.5, front - 2750], material('#bca185', { roughness: .95 }), 8);
    }

    const glow = [];
    const strip = (parent, size, at, channel = 0) => {
        const mat = material('#efd7b9', { emissive: '#efd7b9', emissiveIntensity: .4 });
        const obj = box(parent, size, at, mat, 2); obj.castShadow = false; glow.push({ mat, channel });
    };
    strip(back, [w - 200, 12, 20], [0, h - 180, bz + 20]);
    strip(side, [12, 8, 1000], [w / 2 - 308, 1494, cz], 1);
    const ceiling = new THREE.Group(); ceiling.name = 'Artist gallery lighting track'; root.add(ceiling); room.ceilingFixture = ceiling;
    box(ceiling, [w - 580, 25, 35], [0, h - 80, layout.desk[1] + 280], metal, 3);
    const lamp = material('#f2eee2', { emissive: '#f2eee2', emissiveIntensity: .4 });
    for (const x of [-w / 2 + 440, 0, w / 2 - 440]) {
        rod(ceiling, [x, h - 80, layout.desk[1] + 280], [x, h - 180, layout.desk[1] + 280], 8, metal);
        box(ceiling, [95, 85, 120], [x, h - 215, layout.desk[1] + 280], chalk, 6);
        box(ceiling, [70, 4, 95], [x, h - 260, layout.desk[1] + 280], lamp, 3);
    }
    const lights = [
        { at: [layout.desk[0], 2000, layout.desk[1]], power: 3.4, range: 3500, task: true },
        { at: [cx - 100, 1450, cz], power: 1.8, range: 2500, channel: 1 },
        { at: [layout.easel[0] + 150, 2200, layout.easel[1] + 150], power: 3.1, range: 3500, task: true },
        { at: [450, 2200, front - 1350], power: 3.2, range: 4600, channel: 0 }
    ].map(spec => {
        const light = new THREE.PointLight('#f1e7d8', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light);
        return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 };
    });
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = ARTIST_MODES[modeId] || ARTIST_MODES.afternoon;
        const c = skyCanvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        c.fillStyle = '#8b9b87'; for (let i = 0; i < 11; i++) c.fillRect(i * 51, 470 - i % 4 * 15, 40, 75); skyMap.needsUpdate = true;
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .08 + mode.wash * accent; });
        lights.forEach(spec => { spec.light.color.set(spec.task ? '#fff4e3' : mode.colors[spec.channel]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        lamp.emissiveIntensity = .15 + mode.practical * .7;
        root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[oak, 'wood'], [wallMat, 'plaster'], [clay, 'plaster'], [blue, 'powder'], [metal, 'metal']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
