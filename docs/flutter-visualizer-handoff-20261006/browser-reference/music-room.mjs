import * as THREE from 'three';
import { HOME_LAYOUTS } from './home-office.mjs?v=desktop-tilt-reach-20261006';

const names = ['Apartment recording nook', 'Home production studio', 'Writing & recording room', 'Producer studio & lounge', 'Production & performance suite'];
export const MUSIC_LAYOUTS = Object.fromEntries(Object.values(HOME_LAYOUTS).map((home, index) => {
    const { id, width, depth, height, back } = home;
    const compact = index === 0, large = index >= 3, front = back + depth;
    const desk = [compact ? 0 : -120, back + 850];
    const speakers = compact ? 900 : 1040;
    const rack = [width / 2 - 390, desk[1] + 930];
    const piano = [-width / 2 + 260, front - (large ? 2100 : 950)];
    const performance = [width / 2 - 720, front - (compact ? 440 : 1050)];
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 980], turn: 180 },
        ...[-1, 1].map(sign => ({ id: 'kenney-furniture-speaker-small', at: [desk[0] + sign * speakers, 750, desk[1] - 260], turn: -sign * 10 })),
        { id: 'studio-recorder', at: [rack[0], 800, rack[1]], turn: 0 },
        { id: 'kenney-furniture-books', at: [width / 2 - 160, 1504, rack[1] - 120], turn: -90 },
        { id: 'kenney-furniture-plant-small2', at: [width / 2 - 165, 1874, rack[1] + 60] },
        { id: 'quaternius-guitar', at: [width / 2 - 100, 1120, back + 500], turn: -90 },
        { id: 'kenney-furniture-potted-plant', at: [-width / 2 + 260, 0, back + 1500] },
        { id: 'kenney-furniture-lamp-round-floor', at: [-width / 2 + 175, 0, front - 270] }
    ];
    if (!compact) props.push({ id: 'sheet-music', at: [piano[0] - 65, 843, piano[1]], turn: 90 });
    if (index === 2) props.push({ id: 'armchair-poppi', at: [150, 0, front - 500] });
    if (large) props.push(
        { id: 'kenney-furniture-lounge-sofa', at: [-400, 0, front - 650] },
        { id: 'coffee-table', at: [-400, 0, front - 1600] },
        { id: 'journal', at: [-590, 391.2, front - 1650], turn: -12 },
        { id: 'strat-guitar', at: [width / 2 - 540, 0, front - 1800], turn: -35 },
        { id: 'kenney-furniture-kitchen-coffee-machine', at: [-width / 2 + 370, 790, back + 360], turn: 0 },
        { id: 'music-award', at: [-width / 2 + 320, 1554, back + 150] },
        { id: 'monstera', at: [width / 2 - 610, 0, back + 600] }
    );
    return [id, { id, name: names[index], width, depth, height, back, desk, speakers, rack, piano, performance, compact, large, drums: index === 4, props,
        daylight: [-width / 2 + 100, 450] }];
}));
export const musicLayoutById = id => MUSIC_LAYOUTS[id] || MUSIC_LAYOUTS.apartment;
export const musicLayoutForSize = size => MUSIC_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

export const MUSIC_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing warm-up and composing', key: '#fff0da', fill: '#dceaf4', accent: '#f5cf98', power: 1.65, ambient: .48, bounce: .65, exposure: 1.08, sky: ['#a0c2d0', '#eee5cb'], practical: .22, wash: .12, colors: ['#f5c796', '#b7c7c0'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Clear, balanced light · seated editing and mixing', key: '#fff0dc', fill: '#d6e5ed', accent: '#f6cb99', power: 1.28, ambient: .43, bounce: .62, exposure: 1.08, sky: ['#9ebfcf', '#ece6d5'], practical: .38, wash: .3, colors: ['#edbd89', '#a6c2bb'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm session · desk tilted for lyrics and scores', key: '#ffd6a9', fill: '#c7d8de', accent: '#ffb782', power: .8, ambient: .33, bounce: .45, exposure: 1.12, sky: ['#928ca5', '#e4bda0'], practical: .9, wash: .85, colors: ['#ffc082', '#cbb7d8'], height: 28, tilt: 10, offset: [0, 60], yaw: 0, leds: true, color: '#ffba73' },
    night: { label: 'Night', description: 'Quiet late-night mix · soft amber and lavender', key: '#d1d9ed', fill: '#c4d1df', accent: '#cfb1ef', power: .3, ambient: .25, bounce: .32, exposure: 1.18, sky: ['#1f3046', '#405472'], practical: .5, wash: .75, colors: ['#e7ac7c', '#bd9ce5'], height: 28, tilt: 0, offset: [0, 80], yaw: 0, leds: true, color: '#bfa0ff' },
    party: { label: 'Performance', description: 'Live session · standing desk turned toward the room', key: '#e2d7ec', fill: '#ccd9e4', accent: '#efa1b2', power: .45, ambient: .31, bounce: .4, exposure: 1.15, sky: ['#29324b', '#645274'], practical: .7, wash: 1.25, colors: ['#ffa581', '#c898e7'], height: 43.5, tilt: -5, offset: [80, 300], yaw: -14, leds: true, color: '#ff8c8a' }
};

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}

// Original 49-key MIDI controller for the desktop, or an 88-key instrument
// for the room's stand. Millimetres, floor origin; owned geometry is disposable.
export function createMusicKeyboard(wide = false) {
    const group = new THREE.Group(); group.name = wide ? '88-key stage piano' : '49-key MIDI controller';
    group.userData.propId = 'music-midi-keyboard';
    group.userData.sceneAssetName = group.name;
    const black = new THREE.MeshStandardMaterial({ color: '#263036', roughness: .65 });
    const white = new THREE.MeshStandardMaterial({ color: '#eee9dc', roughness: .4 });
    const rubber = new THREE.MeshStandardMaterial({ color: '#10181d', roughness: .8 });
    const add = (size, at, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); m.position.set(...at); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
    const width = wide ? 1350 : 860, whites = wide ? 52 : 29, spacing = 23;
    const blackAfter = wide ? [0, 2, 3, 5, 6] : [0, 1, 3, 4, 5]; // A-to-C (88), C-to-C (49)
    add([width, 32, 300], [0, 16, 0], black);
    add([width - 10, 28, 100], [0, 46, -95], black);
    const start = -(whites - 1) * spacing / 2;
    for (let i = 0; i < whites; i++) {
        add([22, 14, 174], [start + i * spacing, 39, 54], white);
        if (i < whites - 1 && blackAfter.includes(i % 7)) add([13, 19, 103], [start + (i + .5) * spacing, 53, 18], rubber);
    }
    const display = new THREE.MeshStandardMaterial({ color: '#477c88', emissive: '#467f90', emissiveIntensity: .35, roughness: .3 });
    add([108, 2, 32], [0, 61, -96], display);
    const pad = new THREE.MeshStandardMaterial({ color: '#c3b69c', roughness: .7 });
    for (let i = 0; i < 8; i++) add([22, 3, 22], [-210 + i % 4 * 30, 62, -115 + Math.floor(i / 4) * 30], pad);
    for (let i = 0; i < 5; i++) {
        add([3, 2, 45], [120 + i * 35, 61, -96], rubber);
        add([19, 6, 8], [120 + i * 35, 65, -97 + i % 3 * 10], white);
    }
    group.userData.dimensionsMm = { width, depth: 300, height: 70 };
    return group;
}

export function buildMusicRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, rack: [rx, rz] } = layout, front = bz + d;
    const cream = material('#cbc8b9', { roughness: .96 }), wood = material('#80634e', { roughness: .75 });
    const instrument = (group, id, name) => {
        group.userData.propId = id; group.userData.sceneAssetName = name;
        markSceneAsset(group, { key: `music:${layout.id}:instrument:${id}` });
    };
    const trim = material('#303d3c'), metal = material('#293136', { metalness: .5, roughness: .45 });
    const fabricMap = texture((c, tw, th) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#68746d2b'; c.lineWidth = 1;
        for (let n = 0; n < tw; n += 4) { c.beginPath(); c.moveTo(n, 0); c.lineTo(n, th); c.moveTo(0, n); c.lineTo(tw, n); c.stroke(); }
    }); fabricMap.repeat.set(2, 4);
    const moss = material('#596e62', { map: fabricMap, roughness: 1 }), clay = material('#b18369', { map: fabricMap, roughness: 1 });
    const floorMap = texture((c, tw, th) => {
        c.fillStyle = '#a48667'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 5; i++) {
            c.fillStyle = ['#af9276', '#9c8068', '#b2997a'][i % 3]; c.fillRect(i * tw / 5, 0, tw / 5 - 2, th);
            c.strokeStyle = '#67493430'; c.lineWidth = 1;
            for (let j = 0; j < 20; j++) { const x = i * tw / 5 + j * 4.5; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x - 3, th / 3, x + 3, th * .7, x, th); c.stroke(); }
            c.fillStyle = '#5c463338'; c.fillRect(i * tw / 5, (i % 3 + 1) * th / 4, tw / 5, 2);
        }
    }, 512, 1024); floorMap.repeat.set(w / 1100, d / 1900);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .8 }));
    const rugMap = texture((c, tw, th) => {
        c.fillStyle = '#a3a496'; c.fillRect(0, 0, tw, th);
        c.strokeStyle = '#e1dbcb'; c.lineWidth = 5;
        for (let i = 0; i < 5; i++) c.strokeRect(18 + i * 12, 18 + i * 12, tw - 36 - i * 24, th - 36 - i * 24);
        c.strokeStyle = '#757e7433'; c.lineWidth = 1;
        for (let y = 0; y < th; y += 5) { c.beginPath(); c.moveTo(0, y); c.lineTo(tw, y); c.stroke(); }
    });
    box(root, [layout.compact ? 2200 : 2600, 5, 1850], [layout.desk[0], 2.5, layout.desk[1] + 580], material('#ffffff', { map: rugMap, roughness: 1 }), 4);

    const back = new THREE.Group(); back.name = 'Music control-room acoustic wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], cream);
    box(back, [w, 85, 24], [0, 42.5, bz + 12], wood);
    const count = layout.compact ? 3 : 5, panelW = layout.compact ? 490 : 425;
    for (let i = 0; i < count; i++) {
        const x = layout.desk[0] + (i - (count - 1) / 2) * (panelW + 35);
        box(back, [panelW, 1260, 65], [x, 1790, bz + 40], wood, 12);
        box(back, [panelW - 25, 1235, 30], [x, 1790, bz + 87], i % 2 ? clay : moss, 12);
    }
    // Walnut diffuser blocks add depth above the control desk.
    for (let i = 0; i < (layout.compact ? 22 : 30); i++) {
        const depth = 35 + (i * i % 7) * 13;
        box(back, [42, 260, depth], [layout.desk[0] - (layout.compact ? 550 : 750) + i * 50, 850, bz + depth / 2], wood, 2);
    }
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });

    const side = new THREE.Group(); side.name = 'Music instrument and rack wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], cream);
    box(side, [24, 85, d], [w / 2 - 12, 42.5, bz + d / 2], wood);
    for (const z of [bz + 500]) {
        box(side, [55, 1280, 510], [w / 2 - 30, 1640, z], moss, 10);
        rod(side, [w / 2 - 120, 2110, z - 45], [w / 2 - 120, 2110, z + 45], 9, metal);
    }
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });

    const entry = new THREE.Group(); entry.name = 'Music daylight wall'; root.add(entry);
    const wz = 450, ww = layout.compact ? 1200 : 1700, low = 850, wh = 1400;
    const a = wz - ww / 2, b = wz + ww / 2;
    box(entry, [80, h, a - bz], [-w / 2 - 40, h / 2, (a + bz) / 2], cream);
    box(entry, [80, h, front - b], [-w / 2 - 40, h / 2, (front + b) / 2], cream);
    box(entry, [80, low, ww], [-w / 2 - 40, low / 2, wz], cream);
    box(entry, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], cream);
    box(entry, [24, 85, d], [-w / 2 + 12, 42.5, bz + d / 2], wood);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(entry, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]);
    pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [a, wz, b]) box(entry, [65, wh + 50, 35], [-w / 2 + 8, low + wh / 2, z], trim);
    for (const y of [low, low + wh]) box(entry, [70, 35, ww + 50], [-w / 2 + 8, y, wz], trim);
    box(entry, [180, 35, ww + 80], [-w / 2 + 50, low - 20, wz], wood, 3);
    const curtain = material('#c6bca8', { map: fabricMap, roughness: 1 });
    for (const z of [a - 90, b + 90]) for (let i = 0; i < 5; i++) {
        const fold = mesh(entry, new THREE.CylinderGeometry(24, 24, 2080, 10), curtain, [-w / 2 + 75, 1230, z - 80 + i * 36]); fold.castShadow = false;
    }
    rod(entry, [-w / 2 + 90, 2305, a - 180], [-w / 2 + 90, 2305, b + 180], 12, metal);
    const doorZ = front - 490;
    box(entry, [24, 2110, 800], [-w / 2 + 20, 1055, doorZ], wood, 4);
    box(entry, [18, 1980, 730], [-w / 2 + 42, 990, doorZ], moss, 4);
    rod(entry, [-w / 2 + 58, 1000, doorZ - 265], [-w / 2 + 58, 1000, doorZ - 185], 8, metal);
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    // Real support heights match the recorder, monitor speakers, and shelves.
    const rack = new THREE.Group(); rack.name = 'Recording equipment cabinet'; root.add(rack);
    box(rack, [690, 745, 680], [rx, 407.5, rz], trim, 8);
    box(rack, [710, 20, 700], [rx, 790, rz], wood, 4);
    for (const x of [rx - 260, rx + 260]) for (const z of [rz - 250, rz + 250]) rod(rack, [x, 0, z], [x, 35, z], 14, metal);
    for (let y = 270; y <= 650; y += 190) {
        box(rack, [644, 156, 12], [rx, y, rz + 346], metal, 4);
        for (let i = 0; i < 7; i++) rod(rack, [rx - 250 + i * 70, y - 18, rz + 353], [rx - 250 + i * 70, y + 18, rz + 353], 3, trim);
    }
    for (const y of [1490, 1860]) box(side, [300, 28, 570], [w / 2 - 160, y, rz], wood, 3);
    for (const sign of [-1, 1]) {
        const x = layout.desk[0] + sign * layout.speakers, z = layout.desk[1] - 260;
        box(root, [360, 22, 330], [x, 11, z], metal, 8);
        rod(root, [x, 22, z], [x, 734, z], 28, metal);
        box(root, [326, 16, 295], [x, 742, z], wood, 4);
    }

    if (!layout.compact) {
        const [x, z] = layout.piano;
        const piano = new THREE.Group(); piano.name = 'Keyboard composing area'; piano.position.set(x, 0, z); piano.rotation.y = Math.PI / 2; root.add(piano);
        instrument(piano, 'music-stage-piano', 'Stage piano and bench');
        const keys = createMusicKeyboard(true); keys.position.y = 740; piano.add(keys);
        box(piano, [420, 6, 200], [0, 840, -65], metal, 3);
        for (const sx of [-150, 150]) rod(piano, [sx, 800, -90], [sx, 837, -65], 5, metal);
        for (const sx of [-410, 410]) rod(piano, [sx, 22, -90], [-sx, 732, 80], 17, metal);
        for (const sx of [-410, 410]) rod(piano, [sx, 18, -155], [sx, 18, 155], 18, metal);
        const bench = new THREE.Group(); bench.name = 'Piano bench'; bench.position.set(0, 0, 630); piano.add(bench);
        box(bench, [650, 90, 370], [0, 475, 0], moss, 12);
        for (const sx of [-240, 240]) for (const sz of [-120, 120]) rod(bench, [sx, 0, sz], [sx, 430, sz], 18, wood);
    }
    // Small spaces use one vocal stand; larger studios get a defined live area.
    const [mx, mz] = layout.performance;
    if (!layout.compact) box(root, [1300, 5, 1350], [mx, 2.5, mz], material('#8b796a', { map: fabricMap, roughness: 1 }), 5);
    const mic = new THREE.Group(); mic.name = 'Vocal recording microphone'; mic.position.set(mx, 0, mz); root.add(mic);
    instrument(mic, 'music-vocal-mic', 'Vocal microphone and pop filter');
    for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
        const x = Math.sin(angle) * 210, z = Math.cos(angle) * 210;
        rod(mic, [0, 70, 0], [x, 24, z], 12, metal);
        sphere(mic, [18, 12, 24], [x, 12, z], metal);
    }
    rod(mic, [0, 70, 0], [0, 1450, 0], 13, metal);
    rod(mic, [0, 1420, 0], [-240, 1510, -30], 10, metal);
    const capsule = mesh(mic, new THREE.CylinderGeometry(24, 24, 130, 16), material('#9eaaac', { metalness: .75, roughness: .4 }), [-245, 1535, -30]); capsule.rotation.z = -.25;
    const filter = mesh(mic, new THREE.CylinderGeometry(68, 68, 8, 24), material('#323a3e', { roughness: 1 }), [-245, 1520, 80]); filter.rotation.x = Math.PI / 2;
    rod(mic, [-180, 1420, 0], [-245, 1520, 75], 4, metal);

    if (layout.large) {
        box(root, [2500, 5, 2200], [-400, 2.5, front - 1280], material('#cbc1ab', { map: rugMap, roughness: 1 }), 8);
        box(root, [650, 735, 600], [-w / 2 + 370, 392.5, bz + 360], trim, 8);
        box(root, [680, 30, 630], [-w / 2 + 370, 775, bz + 360], wood, 4);
        box(back, [670, 28, 270], [-w / 2 + 370, 1540, bz + 150], wood, 3);
    }
    if (layout.drums) {
        const kit = new THREE.Group(); kit.name = 'Acoustic drum kit'; kit.position.set(w / 2 - 1250, 0, front - 2700); kit.rotation.y = -.18; root.add(kit);
        instrument(kit, 'music-drum-kit', 'Acoustic drum kit');
        box(kit, [1450, 5, 1500], [0, 2.5, 0], moss, 5);
        const shell = material('#965f43', { roughness: .35 }), skin = material('#d7d2c6', { roughness: .9 }), chrome = material('#a8b1b4', { metalness: .8, roughness: .3 });
        const drum = (radius, depth, at, bass = false) => {
            const group = new THREE.Group(); group.position.set(...at); if (bass) group.rotation.x = Math.PI / 2; kit.add(group);
            mesh(group, new THREE.CylinderGeometry(radius, radius, depth, 24), shell);
            for (const sign of [-1, 1]) { mesh(group, new THREE.CylinderGeometry(radius + 4, radius + 4, 9, 24), chrome, [0, sign * depth / 2, 0]); mesh(group, new THREE.CylinderGeometry(radius - 8, radius - 8, 4, 24), skin, [0, sign * (depth / 2 + 6), 0]); }
        };
        drum(270, 430, [0, 295, 0], true);
        drum(150, 230, [-170, 780, -80]); drum(175, 260, [175, 780, -80]); drum(215, 330, [410, 515, 220]); drum(180, 130, [-350, 660, 220]);
        for (const [x, z, y, radius] of [[-550, -270, 1140, 250], [530, -260, 1160, 260], [-550, 320, 890, 180]]) {
            rod(kit, [x, 25, z], [x, y, z], 10, chrome);
            for (const dz of [-100, 100]) rod(kit, [x, 110, z], [x + dz, 12, z + 80], 9, chrome);
            const cymbal = mesh(kit, new THREE.ConeGeometry(radius, 22, 32), material('#c2a36c', { metalness: .7, roughness: .35 }), [x, y, z]); cymbal.rotation.z = x > 0 ? -.1 : .1;
        }
        box(kit, [330, 80, 300], [0, 500, 580], metal, 10); rod(kit, [0, 0, 580], [0, 460, 580], 28, metal);
        for (const x of [-300, 300]) { rod(kit, [x, 14, 60], [x * .72, 310, 0], 12, chrome); box(kit, [28, 12, 32], [x, 6, 60], metal, 3); }
    }

    const artwork = texture((c, tw, th) => {
        c.fillStyle = '#efe2ca'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 64; i++) { const height = 40 + Math.abs(Math.sin(i * .42) * Math.cos(i * .19)) * 270; c.fillStyle = i < 33 ? '#617567' : '#b47d63'; c.fillRect(35 + i * 7, (th - height) / 2, 4, height); }
        c.fillStyle = '#344b43'; c.font = '22px sans-serif'; c.fillText('CREATE · LISTEN · REPEAT', 36, 455);
    });
    const art = new THREE.Group(); art.name = 'Original waveform artwork'; art.position.set(w / 2 - 25, 1760, layout.compact ? front - 440 : front - 1050); art.rotation.y = -Math.PI / 2; side.add(art);
    box(art, [layout.compact ? 540 : 820, 640, 28], [0, 0, 0], wood, 3);
    box(art, [layout.compact ? 510 : 790, 610, 4], [0, 0, 17], material('#ffffff', { map: artwork, roughness: .9 }));

    const glow = [];
    const strip = (parent, size, at, channel = 0) => {
        const mat = material('#eac6a0', { emissive: '#eac6a0', emissiveIntensity: .5 });
        const obj = box(parent, size, at, mat, 2); obj.castShadow = false; glow.push({ mat, channel });
    };
    strip(back, [layout.compact ? 1820 : 2420, 12, 16], [layout.desk[0], 2480, bz + 100]);
    strip(back, [w - 80, 12, 18], [0, 100, bz + 24], 1);
    for (const y of [1490, 1860]) strip(side, [12, 8, 500], [w / 2 - 305, y - 15, rz]);
    if (!layout.compact) strip(side, [15, 1400, 15], [w / 2 - 35, 1350, layout.performance[1] + 550], 1);
    const ceiling = new THREE.Group(); ceiling.name = 'Music ceiling cloud'; root.add(ceiling); room.ceilingFixture = ceiling;
    box(ceiling, [1650, 65, 1100], [layout.desk[0], h - 60, layout.desk[1] + 450], moss, 18);
    const diffuser = material('#efe0c7', { emissive: '#efe0c7', emissiveIntensity: .3 });
    const lightPanel = box(ceiling, [850, 8, 260], [layout.desk[0], h - 98, layout.desk[1] + 450], diffuser, 6); lightPanel.castShadow = false;
    const lights = [
        { at: [layout.desk[0], 1700, bz + 450], color: '#f4c493', power: 3.1, range: 3500, wash: true, channel: 0 },
        { at: [rx - 80, 1570, rz + 250], color: '#f4c493', power: 2.2, range: 2600, wash: false },
        { at: [layout.performance[0] - 180, 1750, layout.performance[1]], color: '#c1a5dd', power: 3.3, range: 3800, wash: true, channel: 1 },
        { at: [0, h - 180, 600], color: '#f1ddc7', power: 3.4, range: 5000, wash: false }
    ].map(spec => { const light = new THREE.PointLight(spec.color, 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = MUSIC_MODES[modeId] || MUSIC_MODES.afternoon;
        const c = skyCanvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        c.fillStyle = '#708373'; for (let i = 0; i < 12; i++) c.fillRect(i * 47, 470 - i % 3 * 18, 34, 70); skyMap.needsUpdate = true;
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .06 + mode.wash * accent * 1.25; });
        lights.forEach(spec => { if (spec.wash) spec.light.color.set(mode.colors[spec.channel]); spec.light.intensity = spec.power * (spec.wash ? mode.wash : mode.practical) * accent; });
        diffuser.emissiveIntensity = .2 + mode.practical * .65;
        root.userData.atmosphere = modeId;
    };
    room.roomAtmosphere('afternoon');
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [wood, 'wood'], [metal, 'metal'], [moss, 'fabric'], [clay, 'fabric'], [curtain, 'fabric']]) mat.userData.roomSurface = surface;
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
