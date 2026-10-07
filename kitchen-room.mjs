import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const tiers = [
    ['apartment', 'Apartment kitchen & breakfast nook', 3600, 4200, 2600],
    ['house', 'Home kitchen & coffee corner', 4400, 5200, 2800],
    ['spacious', 'Island kitchen & dining room', 5600, 6200, 3000],
    ['premium', 'Entertaining kitchen & dining', 6800, 7600, 3200],
    ['executive', 'Chef’s kitchen & gathering suite', 8200, 9000, 3400]
];
export const KITCHEN_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -2000, front = back + depth;
    const runStart = -width / 2 + 60, runWidth = width - 1150, bays = Math.max(4, Math.ceil(runWidth / 700)), bay = runWidth / bays;
    const desk = [tier >= 2 ? -width / 2 + 900 : tier ? -420 : 420, back + (tier ? 2200 : 1950)];
    const coffee = tier ? [width / 2 - 320, back + 1750] : [runStart + bay / 2, back + 330];
    const island = tier >= 2 ? [width / 2 - 1600, back + 2350] : null;
    const dining = [tier ? 0 : -width / 2 + 880, front - (tier >= 2 ? 1300 : tier ? 1050 : 850)];
    const tableWidth = tier >= 3 ? (tier === 4 ? 2800 : 2200) : 1800;
    const tableHeight = tier ? 750 : 730;
    const props = [
        { id: 'kenney-furniture-kitchen-fridge', at: [width / 2 - 510, 0, back + 355] },
        { id: 'kenney-furniture-kitchen-coffee-machine', at: [coffee[0], 900, coffee[1]], turn: tier ? -90 : 0 },
        { id: 'kenney-furniture-toaster', at: [tier ? runStart + bay / 2 : runStart + runWidth - bay / 2 - 110, 900, back + 480] },
        { id: 'knife-set', at: [runStart + runWidth - bay / 2, 900, back + 210] },
        { id: 'kenney-furniture-plant-small2', at: [runStart + runWidth - bay / 2 + 180, 900, back + 370] },
        { id: 'decor-plant2', at: [width / 2 - 260, 0, front - 420] },
        { id: 'tea-cup', at: [dining[0] - 130, tableHeight, dining[1] + 60] },
        { id: 'fruitcake-tin', at: [dining[0] + 70, tableHeight, dining[1] - 20] }
    ];
    // Counter appliances keep their library scale and rest at the 900 mm worktop.
    if (!tier) props[1].at[2] = back + 190;
    if (tier) {
        props.push({ id: 'kenney-furniture-kitchen-blender', at: [runStart + bay / 2, 900, back + 200] });
        const seats = tier >= 2 ? (tier >= 3 ? 6 : 4) : 4;
        const xs = seats === 6 ? [-tableWidth / 2 + 400, 0, tableWidth / 2 - 400] : [-480, 480];
        for (const x of xs) for (const s of [-1, 1]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [dining[0] + x, 0, dining[1] + s * 750], turn: s < 0 ? 0 : 180 });
    } else props.push({ id: 'kenney-furniture-chair-rounded', at: [dining[0] + 670, 0, dining[1]], turn: -90 });
    if (island) {
        for (const x of [-480, 480]) props.push({ id: 'bar-stool-brass', at: [island[0] + x, 0, island[1] + 850], turn: 180 });
        props.push({ id: 'cutting-board', at: [island[0] - 430, 930, island[1]] }, { id: 'apple', at: [island[0] - 460, 984.8, island[1]] });
    }
    return [id, { id, name, width, depth, height, back, tier, desk, coffee, island, dining, tableWidth, tableHeight, runStart, runWidth, bay, bays, props,
        daylight: [-width / 2 + 100, back + 2250] }];
}));
export const kitchenLayoutById = id => KITCHEN_LAYOUTS[id] || KITCHEN_LAYOUTS.apartment;
export const kitchenLayoutForSize = size => KITCHEN_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
// practical drives task/pendant lamps and light pools, wash the cabinet and
// shelf glow, lamps scales the ceiling point lights, candles the table
// candles; clock is the wall clock's time.
export const KITCHEN_MODES = {
    morning: { label: 'Morning', description: 'Breakfast & coffee · desk at prep height', key: '#ffe2b8', fill: '#d9ebf4', accent: '#f6cf9c', power: 1.85, ambient: .5, bounce: .72, exposure: 1.05, sky: ['#8fc3e0', '#fbe6bd'], practical: .2, wash: .16, lamps: .5, candles: 0, clock: [7, 40], colors: ['#ffdfac', '#afdbcc'], height: 36, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft daylight · seated recipes and planning', key: '#fff7ea', fill: '#dce9f0', accent: '#e9d8b8', power: 1.45, ambient: .52, bounce: .72, exposure: 1.04, sky: ['#86b8dc', '#e8eee4'], practical: .3, wash: .24, lamps: .55, candles: 0, clock: [1, 15], colors: ['#f4dcb9', '#b6d6c7'], height: 28, tilt: 0, offset: [0, 40], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Dinner prep · warm pendants and counter lighting', key: '#ffbd80', fill: '#b9c7dc', accent: '#f0b47a', power: .8, ambient: .22, bounce: .3, exposure: 1.02, sky: ['#6b78a6', '#f4a46a'], practical: .95, wash: .75, lamps: .95, candles: .45, clock: [6, 35], colors: ['#ffcf94', '#bdd9c7'], height: 36, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffdda3' },
    night: { label: 'Night', description: 'Quiet late-night tea · soft cabinet and shelf lights', key: '#9fb6d8', fill: '#93a7c4', accent: '#f1bc88', power: .12, ambient: .08, bounce: .1, exposure: .9, sky: ['#0c1729', '#2a425d'], practical: .62, wash: .95, lamps: .42, candles: .7, clock: [11, 20], colors: ['#ffc98e', '#87bfb8'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffe2b8' },
    party: { label: 'Dinner party', description: 'Gather & share · desk turned into a serving station', key: '#f2c7a2', fill: '#b3bcd9', accent: '#efb27c', power: .36, ambient: .21, bounce: .27, exposure: 1.04, sky: ['#2d3a60', '#c2877a'], practical: 1.05, wash: 1, lamps: .9, candles: 1, clock: [8, 45], colors: ['#ffd29c', '#a2d4c4'], height: 38, tilt: 0, offset: [60, 230], yaw: -12, leds: true, color: '#ffd5a1' }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function buildKitchenRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier, runStart, runWidth, bay, bays } = layout, front = bz + d, mm = root.scale.x;
    const cream = material('#e8e2d5', { roughness: .9 }), jade = material('#54766c', { roughness: .75 });
    const dark = material('#293f3d', { roughness: .7 }), brass = material('#b89958', { metalness: .72, roughness: .32 });
    const steel = material('#aebaba', { metalness: .7, roughness: .28 }), glass = material('#253638', { metalness: .4, roughness: .2 });
    // Rift-sawn oak: long wavering grain, soft colour bands and the odd pin knot.
    const woodMap = texture((c, tw, th) => {
        c.fillStyle = '#ad8d66'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 9; i++) { c.fillStyle = ['#b8986f30', '#94744f26', '#c4a47a2a'][i % 3]; c.fillRect(hash(i) * tw, 0, 20 + hash(i + 3) * 70, th); }
        for (let i = 0; i < 170; i++) {
            const x = i * 3.05 + hash(i) * 3, wave = 4 + hash(i + 9) * 10;
            c.strokeStyle = i % 7 ? `rgba(84,60,36,${.1 + hash(i + 5) * .16})` : 'rgba(226,196,150,.22)'; c.lineWidth = .6 + hash(i + 2) * 1.4;
            c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + wave, th * .3, x - wave * .7, th * .65, x + hash(i + 4) * 6, th); c.stroke();
        }
        for (let i = 0; i < 3; i++) { const x = 60 + hash(i + 40) * (tw - 120), y = 60 + hash(i + 50) * (th - 120); c.strokeStyle = '#5a3f2650'; c.lineWidth = 1.2; for (let r = 3; r < 15; r += 3) { c.beginPath(); c.ellipse(x, y, r * .55, r * 1.8, 0, 0, Math.PI * 2); c.stroke(); } }
    });
    const oak = material('#ffffff', { map: woodMap, roughness: .7 });
    // Honed quartz worktop: cloudy ground with fine grey-gold veins.
    const stoneMap = texture((c, tw, th) => {
        c.fillStyle = '#e5dccb'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 40; i++) { const x = hash(i) * tw, y = hash(i + 70) * th, r = 40 + hash(i + 3) * 120, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, i % 2 ? '#f4eee330' : '#d6cab51e'); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
        for (let i = 0; i < 16; i++) {
            c.strokeStyle = i % 4 ? 'rgba(150,134,108,.18)' : 'rgba(176,146,90,.32)'; c.lineWidth = .7 + hash(i + 8) * 1.8;
            let x = hash(i + 20) * tw, y = 0; c.beginPath(); c.moveTo(x, y);
            for (let s = 0; s < 8; s++) { x += (hash(i * 9 + s) - .3) * 90; y += th / 8; c.lineTo(x, y); } c.stroke();
        }
    });
    const stone = material('#ffffff', { map: stoneMap, roughness: .42 });
    const glow = [], pools = [], flames = [], displays = [];
    const strip = (parent, size, at, channel = 0) => { const mat = material('#ffe0ac', { emissive: '#ffe0ac', emissiveIntensity: .3 }); const o = box(parent, size, at, mat, 2); o.castShadow = false; glow.push({ mat, channel }); return o; };
    const group = (id, name, at = [0, 0, 0], turn = 0, parent = root) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g); g.userData.propId = id; g.userData.sceneAssetName = name; markSceneAsset(g, { key: `kitchen:${layout.id}:fixture:${id}` }); return g; };
    const noShadow = obj => { obj.castShadow = false; return obj; };

    // Set dressing is batched: one merged mesh per material, or one instanced
    // mesh for repeated pieces with per-item colour. Items are {at, size, rot|dir, geo, color}.
    const unit = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 20), ball = new THREE.SphereGeometry(1, 14, 10), soft = new RoundedBoxGeometry(1, 1, 1, 2, .2);
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(0, 0, 0, 'YXZ'), vec = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    const place = (item, origin) => {
        if (item.dir) quat.setFromUnitVectors(up, vec.set(...item.dir).normalize()); else quat.setFromEuler(euler.set(...(item.rot || [0, 0, 0])));
        vec.set(...item.at); if (origin) vec.sub(origin);
        return m4.compose(vec, quat, scl.set(...(item.size || [1, 1, 1])));
    };
    const merged = (parent, mat, parts, shadow = false) => {
        if (!parts.length) return null;
        const geos = parts.map(p => (p.geo || unit).clone().applyMatrix4(place(p)));
        const obj = mesh(parent, mergeGeometries(geos), mat); geos.forEach(g => g.dispose()); obj.castShadow = shadow; return obj;
    };
    const batch = (parent, geometry, mat, items, shadow = false) => {
        if (!items.length) return null;
        const obj = new THREE.InstancedMesh(geometry, mat, items.length), coloured = items.some(item => item.color);
        items.forEach(item => obj.position.add(vec.set(...item.at))); obj.position.divideScalar(items.length);
        const origin = obj.position.clone();
        items.forEach((item, i) => { obj.setMatrixAt(i, place(item, origin)); if (coloured) obj.setColorAt(i, tint.set(item.color || '#ffffff')); });
        obj.instanceMatrix.needsUpdate = true; if (obj.instanceColor) obj.instanceColor.needsUpdate = true;
        obj.castShadow = shadow; obj.receiveShadow = true; obj.computeBoundingBox(); obj.computeBoundingSphere(); parent.add(obj); return obj;
    };
    const lathe = (profile, segments = 24) => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments);
    // Additive pools fake lamp falloff on worktops and tables; lit by the mode.
    const poolMap = texture((c, tw, th) => { const g = c.createRadialGradient(tw / 2, th / 2, 0, tw / 2, th / 2, tw / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(.4, '#ffffff80'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, tw, th); }, 128, 128);
    const bandMap = texture((c, tw, th) => { const g = c.createLinearGradient(0, 0, 0, th); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#ffffff70'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, tw, th); const e = c.createLinearGradient(0, 0, tw, 0); e.addColorStop(0, '#000000ff'); e.addColorStop(.04, '#00000000'); e.addColorStop(.96, '#00000000'); e.addColorStop(1, '#000000ff'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = e; c.fillRect(0, 0, tw, th); }, 256, 64);
    const poolGeo = new THREE.PlaneGeometry(1, 1);
    const pool = (parent, at, size, { strength = 1, map = poolMap, rotation = [-Math.PI / 2, 0, 0], source = 'practical' } = {}) => {
        const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#000000' });
        const obj = noShadow(mesh(parent, poolGeo, mat, at)); obj.receiveShadow = false; obj.scale.set(size[0], size[1], 1); obj.rotation.set(...rotation); obj.renderOrder = 2;
        pools.push({ obj, strength, source }); return obj;
    };

    // Honed limestone floor: 600 mm tiles, each with its own tone, fossil clouds and grout.
    const tileMap = texture((c, tw, th) => {
        const n = 2, s = tw / n;
        for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
            const k = tx + ty * n, x0 = tx * s, y0 = ty * s;
            c.fillStyle = ['#e7dccb', '#e2d5c1', '#ebe2d3', '#ded1bc'][k]; c.fillRect(x0, y0, s, s);
            c.save(); c.beginPath(); c.rect(x0, y0, s, s); c.clip();
            for (let i = 0; i < 26; i++) { const x = x0 + hash(k * 50 + i) * s, y = y0 + hash(k * 50 + i + 17) * s, r = 30 + hash(k * 50 + i + 5) * 110, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, i % 3 ? '#f8f2e826' : '#d9c8ab1c'); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
            for (let i = 0; i < 900; i++) { c.fillStyle = i % 3 ? '#9c8c721a' : '#ffffff30'; c.fillRect(x0 + hash(k * 999 + i) * s, y0 + hash(k * 777 + i * 1.3) * s, 1 + i % 2, 1 + i % 2); }
            c.restore();
            c.strokeStyle = '#b3a58e'; c.lineWidth = 4; c.strokeRect(x0 + 2, y0 + 2, s - 4, s - 4);
            c.strokeStyle = '#f7f1e655'; c.lineWidth = 2; c.strokeRect(x0 + 6, y0 + 6, s - 12, s - 12);
        }
    }, 1024, 1024); tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping; tileMap.repeat.set(w / 1200, d / 1200);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: tileMap, roughness: .72 }));
    const back = new THREE.Group(); back.name = 'Kitchen tiled cabinet wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], cream);
    // Handmade zellige: square glazed tiles, each pooling darker at its edges.
    const zellige = (c, tw, th, height) => {
        const n = 8, s = tw / n;
        c.fillStyle = height ? '#303030' : '#c9c4b4'; c.fillRect(0, 0, tw, th);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const k = x * 13 + y * 7, x0 = x * s + 3, y0 = y * s + 3, t = s - 6;
            if (height) { const g = c.createRadialGradient(x0 + t / 2, y0 + t / 2, t * .2, x0 + t / 2, y0 + t / 2, t * .75); g.addColorStop(0, '#f2f2f2'); g.addColorStop(1, '#bdbdbd'); c.fillStyle = g; c.fillRect(x0, y0, t, t); continue; }
            c.fillStyle = ['#a9c0b0', '#9cb6a6', '#b6cabb', '#90ad9d', '#a2bbaa', '#bcd0c0'][Math.floor(hash(k) * 6)]; c.fillRect(x0, y0, t, t);
            const g = c.createRadialGradient(x0 + t * (.3 + hash(k + 1) * .4), y0 + t * (.3 + hash(k + 2) * .4), 2, x0 + t / 2, y0 + t / 2, t * .75);
            g.addColorStop(0, '#ffffff38'); g.addColorStop(.6, '#ffffff00'); g.addColorStop(1, '#2f4a3e40'); c.fillStyle = g; c.fillRect(x0, y0, t, t);
        }
    };
    const splashMap = texture((c, tw, th) => zellige(c, tw, th, false), 512, 512), splashBump = texture((c, tw, th) => zellige(c, tw, th, true), 512, 512);
    splashBump.colorSpace = THREE.NoColorSpace;
    for (const map of [splashMap, splashBump]) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(runWidth / 800, 850 / 800); }
    box(back, [runWidth, 850, 12], [runStart + runWidth / 2, 1325, bz + 6], material('#ffffff', { map: splashMap, bumpMap: splashBump, bumpScale: 2.5 * mm, roughness: .22 }));
    pool(back, [runStart + runWidth / 2, 1200, bz + 13.5], [runWidth, 600], { strength: .55, map: bandMap, rotation: [0, 0, 0], source: 'wash' });
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const right = new THREE.Group(); right.name = 'Kitchen pantry and coffee wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], cream); box(right, [20, 90, d], [w / 2 - 10, 45, bz + d / 2], oak);
    // Sage beadboard wainscot and an oak chair rail on the open dining wall.
    const beadMap = texture((c, tw, th) => { c.fillStyle = '#b7c6b8'; c.fillRect(0, 0, tw, th); for (let x = 0; x < tw; x += tw / 4) { const g = c.createLinearGradient(x, 0, x + 14, 0); g.addColorStop(0, '#6f86764a'); g.addColorStop(.3, '#ffffff40'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(x, 0, 14, th); c.fillStyle = '#5f75664a'; c.fillRect(x, 0, 2, th); } }, 256, 64);
    beadMap.wrapS = THREE.RepeatWrapping; const wainZ = bz + 700, wainLen = front - wainZ; beadMap.repeat.set(wainLen / 400, 1);
    const sage = material('#ffffff', { map: beadMap, roughness: .55 });
    box(right, [14, 1000, wainLen], [w / 2 - 7, 500, wainZ + wainLen / 2], sage); box(right, [34, 36, wainLen], [w / 2 - 17, 1010, wainZ + wainLen / 2], oak);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    const left = new THREE.Group(); left.name = 'Kitchen daylight and breakfast wall'; root.add(left);
    const wz = bz + 2200, ww = tier ? 2000 : 1400, low = 1050, wh = 1250, a = wz - ww / 2, b = wz + ww / 2;
    box(left, [80, h, a - bz], [-w / 2 - 40, h / 2, (bz + a) / 2], cream); box(left, [80, h, front - b], [-w / 2 - 40, h / 2, (b + front) / 2], cream);
    box(left, [80, low, ww], [-w / 2 - 40, low / 2, wz], cream); box(left, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], cream);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512; const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(left, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 53, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [a, wz, b]) box(left, [65, wh + 45, 30], [-w / 2 + 10, low + wh / 2, z], oak);
    for (const y of [low, low + wh]) box(left, [65, 30, ww + 50], [-w / 2 + 10, y, wz], oak);
    // Slim glazing bars divide each sash into café-style panes.
    merged(left, oak, [a, wz].flatMap(z0 => [{ at: [-w / 2 + 2, low + wh * .58, (z0 + z0 + ww / 2) / 2], size: [22, 18, ww / 2] }, { at: [-w / 2 + 2, low + wh / 2, z0 + ww / 4], size: [22, wh, 18] }]));
    box(left, [200, 30, ww + 80], [-w / 2 + 60, low - 15, wz], stone, 3);
    // Linen café curtains on a brass rod, and a row of kitchen herbs on the sill.
    const linenMap = texture((c, tw, th) => { c.fillStyle = '#efe7d6'; c.fillRect(0, 0, tw, th); for (let x = 0; x < tw; x += 2) { c.fillStyle = `rgba(150,130,100,${.03 + hash(x) * .06})`; c.fillRect(x, 0, 1, th); } for (let i = 0; i < 6; i++) { const x = (i + .5) * tw / 6, g = c.createLinearGradient(x - tw / 12, 0, x + tw / 12, 0); g.addColorStop(0, '#00000000'); g.addColorStop(.5, '#7a634426'); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.fillRect(x - tw / 12, 0, tw / 6, th); } c.fillStyle = '#c9a26a'; c.fillRect(0, th - 22, tw, 6); }, 256, 256);
    const linen = material('#ffffff', { map: linenMap, roughness: .95 });
    rod(left, [-w / 2 + 60, low + wh + 110, a - 160], [-w / 2 + 60, low + wh + 110, b + 160], 10, brass);
    for (const z of [a - 175, b + 175]) sphere(left, [24, 24, 24], [-w / 2 + 60, low + wh + 110, z], brass);
    merged(left, linen, [a - 20, b + 20].map((z, i) => ({ at: [-w / 2 + 75, low + wh / 2 + 55, z + (i ? -1 : 1) * 70], size: [10, wh + 110, 320] })));
    const herbs = [], herbPots = [];
    for (let i = 0; i < 3; i++) {
        const z = wz + (i - 1) * Math.min(420, ww * .28), x = -w / 2 + 95, y = low;
        herbPots.push({ at: [x, y + 55, z], size: [62, 110, 62], color: '#b8694a' }, { at: [x, y + 112, z], size: [66, 10, 66], color: '#a85e42' });
        for (let j = 0; j < 14; j++) { const t = j * 2.4 + i, r = 18 + hash(i * 30 + j) * 34; herbs.push({ at: [x + Math.cos(t) * r * .7, y + 135 + hash(j + i * 7) * 120, z + Math.sin(t) * r], size: [22 + hash(j) * 12, 16, 22 + hash(j + 3) * 12], rot: [t, hash(j) * 2, 0], color: ['#5f8a4f', '#76a05c', '#4e7a45', '#88ad62'][j % 4] }); }
    }
    const clay = material('#ffffff', { roughness: .85 }), leafMat = material('#ffffff', { roughness: .7 });
    batch(left, cyl, clay, herbPots); batch(left, ball, leafMat, herbs);
    const doorZ = tier ? front - 500 : bz + 480;
    if (tier) { box(left, [25, 2100, 820], [-w / 2 + 15, 1050, doorZ], oak, 4); rod(left, [-w / 2 + 42, 1000, doorZ - 250], [-w / 2 + 42, 1000, doorZ - 160], 8, brass); }
    room.walls.push({ obj: left, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    const handle = (g, x, y, z, horizontal = true) => rod(g, [x - (horizontal ? 65 : 0), y - (horizontal ? 0 : 60), z], [x + (horizontal ? 65 : 0), y + (horizontal ? 0 : 60), z], 5, brass);
    // Shaker doors: a raised stile-and-rail frame around a recessed centre panel.
    const shaker = (c, tw, th, height) => {
        const f = tw * .14;
        c.fillStyle = height ? '#ffffff' : '#f4f6f4'; c.fillRect(0, 0, tw, th);
        c.fillStyle = height ? '#8a8a8a' : '#dfe5e1'; c.fillRect(f, f, tw - f * 2, th - f * 2);
        c.fillStyle = height ? '#b0b0b0' : '#9fb0a6'; c.fillRect(f, f, tw - f * 2, 7); c.fillRect(f, f, 7, th - f * 2);
        c.fillStyle = height ? '#c8c8c8' : '#ffffff'; c.fillRect(f, th - f - 6, tw - f * 2, 6); c.fillRect(tw - f - 6, f, 6, th - f * 2);
        if (!height) { c.strokeStyle = '#b8c6bd'; c.lineWidth = 4; c.strokeRect(2, 2, tw - 4, th - 4); }
    };
    const doorMap = texture((c, tw, th) => shaker(c, tw, th, false), 256, 256), doorBump = texture((c, tw, th) => shaker(c, tw, th, true), 256, 256); doorBump.colorSpace = THREE.NoColorSpace;
    const jadeDoor = material('#5a7c72', { map: doorMap, bumpMap: doorBump, bumpScale: 4 * mm, roughness: .62 });
    const ceramic = material('#ffffff', { roughness: .32 }), clearGlass = material('#dfeee9', { roughness: .08, metalness: .1, transparent: true, opacity: .28 });
    const towelMap = texture((c, tw, th) => { c.fillStyle = '#efe8da'; c.fillRect(0, 0, tw, th); for (const [y, col, s] of [[30, '#c4683f', 14], [56, '#c4683f', 5], [th - 70, '#3f6757', 14], [th - 44, '#3f6757', 5]]) { c.fillStyle = col; c.fillRect(0, y, tw, s); } for (let x = 0; x < tw; x += 3) { c.fillStyle = '#7d6a4f14'; c.fillRect(x, 0, 1, th); } }, 128, 256);
    // Counter vignettes: crock and oils, fruit and cookbook, canisters, bread board.
    const vignette = (g, kind, x0) => {
        const pot = [], wood = [], items = [], metal = [];
        if (kind === 'crock') {
            pot.push({ geo: lathe([[0, 0], [58, 0], [62, 20], [56, 150], [60, 160], [52, 160], [48, 12], [0, 12]]), at: [x0, 900, -220] });
            for (let i = 0; i < 4; i++) { const t = i * 1.7; wood.push({ geo: cyl, at: [x0 + Math.cos(t) * 18, 1070, -220 + Math.sin(t) * 16], size: [6, 260, 6], dir: [Math.cos(t) * .2, 1, Math.sin(t) * .18] }); wood.push({ geo: ball, at: [x0 + Math.cos(t) * 44, 1205, -220 + Math.sin(t) * 40], size: [26, 34, 10], rot: [0, t, 0] }); }
            items.push({ geo: cyl, at: [x0 + 125, 1015, -235], size: [32, 230, 32], color: '#6f7a33' }, { geo: cyl, at: [x0 + 125, 1158, -235], size: [12, 56, 12], color: '#6f7a33' }, { geo: cyl, at: [x0 + 200, 995, -250], size: [30, 190, 30], color: '#6b2e2a' }, { geo: cyl, at: [x0 + 200, 1115, -250], size: [11, 50, 11], color: '#6b2e2a' });
            wood.push({ geo: cyl, at: [x0 + 125, 1196, -235], size: [10, 20, 10] }, { geo: cyl, at: [x0 + 200, 1148, -250], size: [9, 18, 9] });
            metal.push({ geo: cyl, at: [x0 - 110, 950, -250], size: [24, 100, 24] }, { geo: ball, at: [x0 - 110, 1010, -250], size: [22, 18, 22] });
        } else if (kind === 'fruit' || kind === 'bowl') {
            const z0 = kind === 'bowl' ? 140 : 70;
            pot.push({ geo: lathe([[0, 0], [70, 0], [150, 60], [158, 72], [148, 72], [66, 10], [0, 10]], 28), at: [x0, 900, z0] });
            for (let i = 0; i < 8; i++) { const t = i * 2.3, r = i ? 70 : 0; items.push({ geo: ball, at: [x0 + Math.cos(t) * r, 958 + (i ? 0 : 22) + (i % 3) * 6, z0 + Math.sin(t) * r * .8], size: [38, 34, 34], rot: [0, t, .3], color: ['#e9c544', '#ef8f2e', '#a9c255', '#e3b93c'][i % 4] }); }
            if (kind === 'fruit') wood.push({ at: [x0 - 10, 905, -190], size: [260, 10, 150], rot: [0, .12, 0] }, { at: [x0 - 10, 1040, -232], size: [240, 300, 26], rot: [-.32, .12, 0] });
            if (kind === 'fruit') items.push({ geo: unit, at: [x0 - 10, 1043, -217], size: [222, 282, 6], rot: [-.32, .12, 0], color: '#c4683f' });
        } else if (kind === 'canisters') {
            [[200, -150], [160, -10], [120, 125]].forEach(([ch, dx]) => { pot.push({ geo: cyl, at: [x0 + dx, 900 + ch / 2, -225], size: [66, ch, 66] }); wood.push({ geo: cyl, at: [x0 + dx, 900 + ch + 11, -225], size: [69, 22, 69] }); metal.push({ geo: ball, at: [x0 + dx, 900 + ch + 30, -225], size: [15, 12, 15] }); });
        } else if (kind === 'bread') {
            wood.push({ at: [x0, 911, 30], size: [420, 22, 250], rot: [0, -.18, 0] }, { geo: cyl, at: [x0 + 245, 911, 75], size: [14, 22, 14], rot: [Math.PI / 2, 0, 0] });
            items.push({ geo: ball, at: [x0 - 30, 952, 35], size: [140, 62, 82], rot: [0, -.18, 0], color: '#b8783e' }, { geo: ball, at: [x0 - 30, 975, 35], size: [110, 30, 60], rot: [0, -.18, 0], color: '#cf9554' });
            for (let i = 0; i < 3; i++) items.push({ geo: cyl, at: [x0 + 110 + i * 22, 933, 25], size: [42, 12, 34], rot: [0, 0, Math.PI / 2 - .2], color: '#e8d1a6' });
        }
        merged(g, ceramic, pot); merged(g, oak, wood); merged(g, brass, metal);
        // Different primitives cannot share one InstancedMesh; group by geometry.
        for (const shape of new Set(items.map(i => i.geo))) batch(g, shape, ceramic, items.filter(i => i.geo === shape));
    };
    const dressed = tier ? { 3: 'crock', 4: 'fruit', 5: 'canisters', 6: 'bread', 7: 'fruit', 8: 'canisters', 9: 'bread' } : { 0: 'bowl' };
    const displayBays = tier >= 2 ? [3, bays - 2] : [3];
    for (let i = 0; i < bays; i++) {
        const g = group('cabinet-' + i, i === 1 ? 'Sink cabinet and brass faucet' : i === 2 ? 'Induction range and oven' : 'Oak and jade storage cabinet', [runStart + bay * (i + .5), 0, bz + 320]);
        box(g, [bay - 10, 780, 580], [0, 490, 0], oak, 3);
        box(g, [bay - 50, 100, 500], [0, 50, 0], dark);
        box(g, [bay, 40, 640], [0, 880, 0], stone, 4);
        if (i === 2) {
            box(g, [bay - 50, 640, 18], [0, 510, 299], dark, 4); box(g, [bay - 120, 385, 8], [0, 450, 314], glass, 5); handle(g, 0, 735, 326);
            box(g, [Math.min(bay - 25, 580), 8, 460], [0, 904, 0], glass, 6);
            for (const x of [-145, 145]) for (const z of [-110, 110]) { const ring = mesh(g, new THREE.TorusGeometry(72, 2, 6, 24), steel, [x, 909, z]); ring.rotation.x = Math.PI / 2; }
            for (const x of [-120, -40, 40, 120]) sphere(g, [12, 12, 5], [x, 802, 316], steel);
            const hood = group('range-hood', 'Brass range hood', [0, 1770, -100], 0, g);
            box(hood, [Math.min(bay - 20, 720), 170, 430], [0, 0, 0], brass, 5); box(hood, [300, 500, 220], [0, 310, -100], brass, 4); strip(hood, [380, 6, 100], [0, -89, 100]);
            pool(g, [0, 909.5, 0], [Math.min(bay - 25, 560), 440], { strength: .5 });
            // Enamel kettle on the back burner, a saucepan in front, a striped towel on the oven rail.
            merged(g, steel, [
                { geo: lathe([[0, 0], [92, 0], [104, 50], [96, 120], [64, 175], [36, 190], [0, 190]], 28), at: [-145, 909, -110] },
                { geo: cyl, at: [-55, 1010, -110], size: [12, 120, 12], rot: [0, 0, -.85] },
                { geo: lathe([[0, 0], [96, 0], [96, 95], [100, 100], [92, 100], [92, 6], [0, 6]], 28), at: [145, 909, 110] },
                { geo: cyl, at: [145, 1004, 110], size: [92, 6, 92] }
            ], true);
            merged(g, dark, [
                { geo: new THREE.TorusGeometry(62, 9, 8, 20, Math.PI), at: [-145, 1090, -110], rot: [0, 0, 0] },
                { geo: ball, at: [-145, 1105, -110], size: [16, 12, 16] },
                { geo: cyl, at: [145, 1004, 270], size: [11, 200, 11], rot: [Math.PI / 2 - .12, 0, 0] },
                { geo: ball, at: [145, 1018, 110], size: [14, 12, 14] }
            ]);
            noShadow(box(g, [150, 300, 6], [40, 600, 334], material('#ffffff', { map: towelMap, roughness: .95 })));
        } else {
            for (const x of [-bay / 4, bay / 4]) { box(g, [bay / 2 - 20, 745, 16], [x, 490, 299], jadeDoor, 4); handle(g, x, 770, 315); }
            if (i === 1) {
                // Thin rim and inset basin preserve an actual-looking opening.
                box(g, [470, 8, 390], [0, 904, 0], steel, 5); box(g, [425, 5, 345], [0, 909, 0], dark, 10);
                box(g, [360, 2, 285], [0, 912, 0], material('#718580', { metalness: .6, roughness: .3 }), 8);
                rod(g, [0, 910, -210], [0, 1190, -210], 13, brass); rod(g, [0, 1190, -210], [0, 1190, -40], 13, brass); rod(g, [0, 1190, -40], [0, 1140, -40], 13, brass);
                // Soap pump and a little brush beside the tap.
                batch(g, cyl, ceramic, [{ at: [190, 975, -240], size: [30, 150, 30], color: '#e9e3d6' }, { at: [190, 1062, -240], size: [8, 26, 8], color: '#b89958' }, { at: [-200, 930, -245], size: [22, 60, 22], color: '#b89a6e' }, { at: [-200, 970, -245], size: [30, 24, 30], color: '#e7d7a8' }]);
            }
            const display = displayBays.includes(i);
            const upper = group('upper-cabinet-' + i, display ? 'Glass-front display cabinet' : 'Jade upper cabinet', [0, 1810, -145], 0, g);
            if (display) {
                // A hollow carcass with glazed doors, a lit interior and stacked crockery.
                const wide = bay - 12, inner = wide - 40;
                merged(upper, jade, [{ at: [0, 300, 0], size: [wide, 20, 300] }, { at: [0, -300, 0], size: [wide, 20, 300] }, { at: [-wide / 2 + 10, 0, 0], size: [20, 620, 300] }, { at: [wide / 2 - 10, 0, 0], size: [20, 620, 300] }, { at: [0, 0, -140], size: [wide, 620, 20] }], true);
                const backMat = material('#efe6d3', { emissive: '#ffe0ac', emissiveIntensity: .1, roughness: .8 }); displays.push(backMat);
                noShadow(box(upper, [inner, 580, 4], [0, 0, -128], backMat));
                noShadow(box(upper, [inner, 12, 240], [0, 10, -5], clearGlass));
                const frames = [];
                for (const x of [-bay / 4, bay / 4]) { const dw = bay / 2 - 20; frames.push({ at: [x - dw / 2 + 25, 0, 155], size: [50, 588, 18] }, { at: [x + dw / 2 - 25, 0, 155], size: [50, 588, 18] }, { at: [x, 269, 155], size: [dw - 100, 50, 18] }, { at: [x, -269, 155], size: [dw - 100, 50, 18] }); }
                merged(upper, jade, frames);
                merged(upper, clearGlass, [-bay / 4, bay / 4].map(x => ({ at: [x, 0, 152], size: [bay / 2 - 120, 490, 4] })));
                for (const x of [-bay / 4, bay / 4]) handle(upper, x + (x > 0 ? -bay / 5 : bay / 5), -210, 168, false);
                strip(upper, [inner - 20, 6, 12], [0, 284, 60]);
                const ware = [], glassware = [];
                for (let k = 0; k < 6; k++) ware.push({ at: [-inner / 4, -282 + k * 12, -10], size: [100, 10, 100], color: k % 2 ? '#f3efe4' : '#e9e2d2' });
                for (let k = 0; k < 3; k++) ware.push({ at: [inner / 4 - 10, -275 + k * 32, -20], size: [72, 30, 72], color: '#7fa293' });
                for (let k = 0; k < 4; k++) glassware.push({ at: [-inner / 2 + 60 + k * 70, 71, -40 + (k % 2) * 70], size: [30, 110, 30], color: '#e8f2ee' });
                for (let k = 0; k < 3; k++) ware.push({ at: [inner / 2 - 70 - k * 85, 16 + (120 - k * 15) / 2, -60], size: [38, 120 - k * 15, 38], color: ['#d9b98a', '#e9e2d2', '#7fa293'][k] });
                batch(upper, cyl, ceramic, ware); batch(upper, cyl, clearGlass, glassware);
            } else {
                box(upper, [bay - 12, 620, 300], [0, 0, 0], jade, 4);
                for (const x of [-bay / 4, bay / 4]) { box(upper, [bay / 2 - 20, 588, 10], [x, 0, 155], jadeDoor, 3); handle(upper, x + (x > 0 ? -bay / 5 : bay / 5), -210, 168, false); }
            }
            strip(upper, [bay - 50, 8, 15], [0, -317, 130]);
            if (dressed[i] && i !== bays - 1) vignette(g, dressed[i], tier ? 0 : -140);
        }
    }
    const pantry = group('pantry-surround', 'Oak refrigerator pantry surround', [w / 2 - 510, 0, bz + 350]);
    for (const x of [-465, 465]) box(pantry, [25, 2320, 680], [x, 1160, 0], oak);
    box(pantry, [955, 460, 680], [0, 2090, 0], oak, 3); box(pantry, [900, 400, 12], [0, 2090, 346], jadeDoor, 3); handle(pantry, 0, 1970, 358);

    const coffee = tier ? group('coffee-bar', 'Coffee bar and open oak shelves', [layout.coffee[0], 0, layout.coffee[1]], -Math.PI / 2) : null;
    if (coffee) {
        box(coffee, [1300, 760, 510], [0, 490, 0], jade, 4); box(coffee, [1210, 110, 460], [0, 55, 0], dark); box(coffee, [1340, 40, 590], [0, 880, 0], stone, 5);
        for (const x of [-320, 320]) { box(coffee, [625, 730, 15], [x, 490, 264], oak, 4); handle(coffee, x, 750, 279); }
        for (const y of [1470, 1870]) { box(coffee, [1320, 35, 275], [0, y, -100], oak, 3); strip(coffee, [1220, 7, 12], [0, y - 22, 31]); }
        for (let i = 0; i < 4; i++) { mesh(coffee, new THREE.CylinderGeometry(34, 36, 100 + i % 2 * 30, 16), cream, [-400 + i * 130, 1487.5 + (100 + i % 2 * 30) / 2, -80]); }
        // Mugs on the lower shelf, a stack of bowls and a row of coffee tins above.
        const shelfware = [];
        for (let i = 0; i < 4; i++) shelfware.push({ at: [120 + i * 95, 1535, -90], size: [38, 95, 38], color: ['#f1ebdf', '#c4683f', '#7fa293', '#e9c98f'][i] });
        for (let i = 0; i < 4; i++) shelfware.push({ at: [-420 + i * 4, 1910 + i * 24, -100], size: [90 - i * 6, 22, 90 - i * 6], color: '#efe8db' });
        for (let i = 0; i < 3; i++) shelfware.push({ at: [-220 + i * 110, 1960, -110], size: [44, 145, 44], color: ['#3f6757', '#b89958', '#c4683f'][i] });
        batch(coffee, cyl, ceramic, shelfware);
        pool(coffee, [0, 901, 40], [1150, 480], { strength: .55, source: 'wash' });
        const printMap = texture((c, tw, th) => { c.fillStyle = '#e7dcc5'; c.fillRect(0, 0, tw, th); c.fillStyle = '#3f6757'; c.font = 'bold 60px serif'; c.textAlign = 'center'; c.fillText('SLOW', tw / 2, 200); c.fillText('MORNINGS', tw / 2, 280); c.strokeStyle = '#b39059'; c.lineWidth = 12; c.strokeRect(40, 40, tw - 80, th - 80); });
        box(coffee, [410, 490, 20], [270, 2160, -158], oak, 3); box(coffee, [375, 455, 4], [270, 2160, -145], material('#ffffff', { map: printMap, roughness: .9 }));
    }
    if (layout.island) {
        const island = group('stone-island', 'Waterfall stone island with oak storage', [layout.island[0], 0, layout.island[1]]);
        box(island, [1680, 860, 800], [0, 430, -50], oak, 4);
        box(island, [1900, 50, 1000], [0, 905, 0], stone, 4);
        for (const x of [-925, 925]) box(island, [50, 880, 1000], [x, 440, 0], stone, 3);
        for (let x = -730; x <= 730; x += 55) box(island, [20, 760, 12], [x, 460, 357], oak, 2);
        strip(island, [1550, 8, 8], [0, 85, 365], 1);
        for (const x of [-480, 0, 480]) { box(island, [460, 355, 14], [x, 625, -457], jadeDoor, 3); handle(island, x, 740, -468); }
        const top = new THREE.Group(); top.position.y = 30; island.add(top); vignette(top, 'fruit', 330);
        pool(island, [0, 931, 0], [1800, 900], { strength: .7 });
    }
    // Flowers: thin stems and soft blooms share one instanced batch.
    const bouquet = (parent, [x, y, z], count, palette, spread = 1) => {
        const stems = [], blooms = [];
        for (let i = 0; i < count; i++) {
            const t = i * 2.4, lean = (.12 + hash(i + x) * .28) * spread, len = 230 + hash(i * 3 + z) * 140, dir = [Math.sin(lean) * Math.cos(t), 1, Math.sin(lean) * Math.sin(t)];
            stems.push({ at: [x + dir[0] * len / 2, y + len / 2, z + dir[2] * len / 2], size: [3.5, len, 3.5], dir, color: '#5f7d4c' });
            blooms.push({ at: [x + dir[0] * len, y + len, z + dir[2] * len], size: [30, 22, 30], rot: [hash(i) * .6, t, 0], color: palette[i % palette.length] });
            if (i % 2) stems.push({ at: [x + dir[0] * len * .55 + 12, y + len * .55, z + dir[2] * len * .55], size: [16, 34, 5], rot: [0, t, .9], color: '#6f9460' });
        }
        batch(parent, cyl, leafMat, stems); batch(parent, ball, leafMat, blooms);
    };
    const flameMat = material('#ffd59a', { emissive: '#ffb45e', emissiveIntensity: 0, roughness: 1 }); flames.push(flameMat);
    const candles = (g, spots, y) => {
        merged(g, ceramic, spots.map(([x, z, ch]) => ({ geo: cyl, at: [x, y + ch / 2, z], size: [14, ch, 14] })));
        const flame = merged(g, flameMat, spots.map(([x, z, ch]) => ({ geo: ball, at: [x, y + ch + 16, z], size: [7, 16, 7] }))); flame.receiveShadow = false; flame.userData.candleFlame = true; flames.push(flame);
    };
    const rugMat = (base, border, accent) => material('#ffffff', { map: texture((c, tw, th) => {
        c.fillStyle = base; c.fillRect(0, 0, tw, th);
        for (let y = 0; y < th; y += 3) { c.fillStyle = `rgba(90,70,45,${.04 + hash(y) * .05})`; c.fillRect(0, y, tw, 1); }
        c.strokeStyle = border; c.lineWidth = 26; c.strokeRect(30, 30, tw - 60, th - 60);
        c.strokeStyle = accent; c.lineWidth = 6; c.strokeRect(62, 62, tw - 124, th - 124);
        c.fillStyle = accent; for (let x = 100; x < tw - 90; x += 46) for (const y of [th / 2 - 40, th / 2 + 40]) { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-7, -7, 14, 14); c.restore(); }
    }, 512, 512), roughness: 1 });
    const dining = group('dining-table', tier ? 'Oak dining table and tableware' : 'Round breakfast table and banquette', [layout.dining[0], 0, layout.dining[1]]);
    if (tier) {
        box(dining, [layout.tableWidth, 50, 980], [0, 725, 0], oak, 10);
        for (const x of [-layout.tableWidth / 2 + 160, layout.tableWidth / 2 - 160]) for (const z of [-340, 340]) box(dining, [65, 700, 65], [x, 350, z], oak, 4);
        for (const x of tier >= 3 ? [-650, 0, 650] : [-480, 480]) for (const z of [-300, 300]) {
            for (const obj of [
                mesh(dining, new THREE.CylinderGeometry(112, 112, 9, 24), cream, [x, 754.5, z]),
                mesh(dining, new THREE.CylinderGeometry(85, 102, 7, 24), stone, [x, 762.5, z]),
                box(dining, [75, 5, 135], [x + 170, 752.5, z], jade, 3)
            ]) obj.userData.mealSetting = [x, z];
        }
        mesh(dining, new THREE.CylinderGeometry(75, 100, 240, 24), jade, [0, 870, 0]);
        for (let i = 0; i < 7; i++) { const angle = i * .9; rod(dining, [0, 990, 0], [Math.cos(angle) * 100, 1210 - i % 3 * 40, Math.sin(angle) * 70], 3, dark); sphere(dining, [40, 15, 65], [Math.cos(angle) * 100, 1210 - i % 3 * 40, Math.sin(angle) * 70], jade); }
        // Linen runner, brass candlesticks and a bread basket for sharing.
        noShadow(box(dining, [layout.tableWidth - 260, 3, 330], [0, 751.5, 0], material('#ffffff', { map: linenMap, roughness: .95 })));
        const sticks = [-1, 1].map(s => [s * Math.min(520, layout.tableWidth / 2 - 420), 0]);
        merged(dining, brass, sticks.flatMap(([x, z]) => [{ geo: cyl, at: [x, 760, z], size: [45, 14, 45] }, { geo: cyl, at: [x, 810, z], size: [11, 100, 11] }, { geo: cyl, at: [x, 862, z], size: [24, 8, 24] }]), true);
        candles(dining, sticks.map(([x, z]) => [x, z, 210]), 866);
        if (tier >= 2) { batch(dining, ball, ceramic, [0, 1, 2, 3, 4].map(i => ({ at: [-260 + (i % 3) * 50 - 20, 790 + (i > 2 ? 26 : 0), (i % 2 ? 30 : -30)], size: [70, 34, 40], rot: [0, i, 0], color: i % 2 ? '#c98a4b' : '#b8783e' }))); merged(dining, oak, [{ geo: lathe([[0, 0], [120, 0], [150, 55], [140, 55], [112, 8], [0, 8]], 24), at: [-240, 753, 0] }]); }
        pool(dining, [0, 752, 0], [Math.min(1800, layout.tableWidth - 120), 900], { strength: .75 });
    } else {
        mesh(dining, new THREE.CylinderGeometry(440, 440, 45, 40), stone, [0, 707.5, 0]);
        mesh(dining, new THREE.CylinderGeometry(130, 230, 685, 32), oak, [0, 342.5, 0]);
        merged(dining, ceramic, [{ geo: lathe([[0, 0], [42, 0], [50, 40], [30, 120], [22, 150], [28, 158], [0, 158]], 20), at: [150, 730, 160] }]);
        bouquet(dining, [150, 870, 160], 7, ['#f2c14e', '#f6efe1', '#e9a36a']);
        merged(dining, clearGlass, [{ geo: cyl, at: [-60, 775, 190], size: [42, 90, 42] }]); candles(dining, [[-60, 190, 60]], 735);
        pool(dining, [0, 731, 0], [880, 880], { strength: .8 });
        const seat = group('breakfast-banquette', 'Upholstered oak breakfast bench', [-layout.width / 2 + 250, 0, front - 850], Math.PI / 2);
        box(seat, [1250, 390, 410], [0, 195, 0], oak, 4); box(seat, [1240, 65, 410], [0, 422.5, 0], jade, 20); box(seat, [1240, 390, 60], [0, 650, -195], jade, 15);
        // Scatter cushions leaning on the back rest.
        batch(seat, soft, material('#ffffff', { roughness: .95 }), [[-400, '#c4683f', .12], [-30, '#e9c98f', -.08], [360, '#efe7d6', .1]].map(([x, color, r]) => ({ at: [x, 610, -120], size: [380, 340, 120], rot: [-.22, r, r * .6], color })), true);
    }
    if (tier >= 3) {
        const wine = group('wine-alcove', 'Display pantry and bottle rack', [w / 2 - 275, 0, front - 2500], -Math.PI / 2);
        box(wine, [1460, 2200, 25], [0, 1100, -222.5], oak, 3);
        for (const x of [-717.5, 717.5]) box(wine, [25, 2200, 470], [x, 1100, 0], oak, 3);
        box(wine, [1410, 790, 430], [0, 395, 0], oak, 3);
        box(wine, [1400, 720, 16], [0, 430, 243], jadeDoor, 3); handle(wine, 0, 700, 258);
        for (const y of [850, 1230, 1630, 2110]) { box(wine, [1380, 25, 430], [0, y, 5], oak); strip(wine, [1320, 8, 8], [0, y - 20, 225]); }
        // Bottles, brass-capped necks, storage crocks, glassware and a cookbook row: one batch each.
        batch(wine, cyl, ceramic, Array.from({ length: 10 }, (_, i) => ({ at: [-590 + i * 130, 975, 20], size: [36, 240, 36], rot: [.15, 0, 0], color: i % 2 ? '#405752' : '#8f7754' })), true);
        batch(wine, cyl, brass, Array.from({ length: 10 }, (_, i) => ({ at: [-590 + i * 130, 1130, 0], size: [15, 75, 15] })));
        batch(wine, cyl, cream, Array.from({ length: 6 }, (_, i) => ({ at: [-480 + i * 185, 1687.5, 40], size: [50, 90, 50] })));
        batch(wine, cyl, clearGlass, Array.from({ length: 6 }, (_, i) => ({ at: [-560 + i * 75, 1300, 30 + (i % 2) * 70], size: [34, 115, 34], color: '#e8f2ee' })));
        batch(wine, unit, ceramic, Array.from({ length: 9 }, (_, i) => ({ at: [120 + i * 52 + (i > 6 ? 30 : 0), 1242.5 + (250 - i % 3 * 30) / 2, 20], size: [38 + i % 2 * 10, 250 - i % 3 * 30, 210], rot: i === 8 ? [0, 0, -.25] : [0, 0, 0], color: ['#3f6757', '#c4683f', '#e9c98f', '#7d6a4f', '#efe7d6'][i % 5] })));
        pool(wine, [0, 811, 60], [1300, 380], { strength: .5, source: 'wash' });
    }
    // Flat-weave rugs ground the breakfast table and the cooking run.
    if (tier) {
        const rd = Math.min(2500, 2 * (front - layout.dining[1]) - 260), rw = Math.min(layout.tableWidth + 1100, w - 1400);
        const rug = group('dining-rug', 'Woven dining rug', [layout.dining[0], 0, layout.dining[1]]); noShadow(box(rug, [rw, 8, rd], [0, 4, 0], rugMat('#d9c6a6', '#9a5a3c', '#3f6757')));
    } else {
        const rug = group('dining-rug', 'Round jute rug', [layout.dining[0], 0, layout.dining[1]]); noShadow(mesh(rug, new THREE.CylinderGeometry(760, 760, 8, 48), material('#ffffff', { map: texture((c, tw) => { c.fillStyle = '#cdb48b'; c.fillRect(0, 0, tw, tw); for (let r = 20; r < tw / 2; r += 9) { c.strokeStyle = r % 2 ? '#a88d6233' : '#efdcb633'; c.lineWidth = 5; c.beginPath(); c.arc(tw / 2, tw / 2, r, 0, Math.PI * 2); c.stroke(); } c.strokeStyle = '#3f6757aa'; c.lineWidth = 10; c.beginPath(); c.arc(tw / 2, tw / 2, tw / 2 - 30, 0, Math.PI * 2); c.stroke(); }, 512, 512), roughness: 1 }), [0, 4, 0]));
    }
    const runner = group('kitchen-runner', 'Striped kitchen runner', [runStart + bay * 1.6, 0, bz + 1010]);
    noShadow(box(runner, [Math.min(2000, runWidth * .55), 6, 640], [0, 3, 0], rugMat('#e6dcc8', '#c4683f', '#3f6757')));
    // Open dining wall: wall clock, a gallery around a chalkboard menu, plate shelf.
    const wallStart = (tier ? 420 : bz + 690) + 140, wallEnd = tier >= 3 ? front - 2500 - 735 - 140 : front - 420 - 162 - 120;
    const clockCanvas = document.createElement('canvas'); clockCanvas.width = clockCanvas.height = 256; const clockMap = new THREE.CanvasTexture(clockCanvas); clockMap.colorSpace = THREE.SRGBColorSpace;
    const drawClock = ([hr, min]) => {
        const c = clockCanvas.getContext('2d'), r = 128; c.fillStyle = '#f4eee2'; c.fillRect(0, 0, 256, 256);
        c.strokeStyle = '#3f6757'; c.lineWidth = 4; c.beginPath(); c.arc(r, r, 112, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 60; i++) { const t = i / 60 * Math.PI * 2, l = i % 5 ? 6 : 16; c.strokeStyle = i % 5 ? '#6a7a72' : '#25332f'; c.lineWidth = i % 5 ? 2 : 5; c.beginPath(); c.moveTo(r + Math.sin(t) * (104 - l), r - Math.cos(t) * (104 - l)); c.lineTo(r + Math.sin(t) * 104, r - Math.cos(t) * 104); c.stroke(); }
        c.fillStyle = '#3f6757'; c.font = 'bold 20px serif'; c.textAlign = 'center'; c.fillText('ERGOFLEX', r, 92); c.font = '13px serif'; c.fillText('KITCHEN', r, 176);
        const hand = (t, len, width, col) => { c.strokeStyle = col; c.lineWidth = width; c.lineCap = 'round'; c.beginPath(); c.moveTo(r - Math.sin(t) * 14, r + Math.cos(t) * 14); c.lineTo(r + Math.sin(t) * len, r - Math.cos(t) * len); c.stroke(); };
        hand(((hr % 12) + min / 60) / 12 * Math.PI * 2, 58, 8, '#25332f'); hand(min / 60 * Math.PI * 2, 86, 5, '#25332f');
        c.fillStyle = '#b89958'; c.beginPath(); c.arc(r, r, 8, 0, Math.PI * 2); c.fill(); clockMap.needsUpdate = true;
    };
    const clock = group('wall-clock', 'Brass kitchen wall clock', [w / 2, tier ? 1880 : 1950, tier ? wallStart + 220 : wallEnd - 180], -Math.PI / 2, right);
    mesh(clock, new THREE.TorusGeometry(176, 16, 12, 48), brass, [0, 0, 34]);
    noShadow(mesh(clock, new THREE.CylinderGeometry(172, 172, 30, 40), cream, [0, 0, 15])).rotation.x = Math.PI / 2;
    noShadow(mesh(clock, new THREE.CircleGeometry(168, 48), material('#ffffff', { map: clockMap, roughness: .6 }), [0, 0, 31]));
    // Gallery: one canvas atlas holds the chalkboard and two prints (one draw call).
    // Atlas regions (px): chalkboard 0,0 560x820; lemon print 600,0 392x512; olive print 600,512 392x512.
    const atlas = texture((c) => {
        c.fillStyle = '#d8cdb6'; c.fillRect(0, 0, 1024, 1024);
        c.fillStyle = '#27312e'; c.fillRect(0, 0, 560, 820);
        for (let i = 0; i < 420; i++) { c.fillStyle = `rgba(255,255,255,${hash(i) * .05})`; c.fillRect(hash(i + 3) * 540, hash(i + 9) * 800, 34, 2); }
        c.fillStyle = '#f1ece0'; c.textAlign = 'center'; c.font = 'italic 64px serif'; c.fillText('Today', 280, 120);
        c.strokeStyle = '#e9c98f'; c.lineWidth = 3; c.beginPath(); c.moveTo(160, 150); c.lineTo(400, 150); c.stroke();
        c.font = '38px serif'; ['Shakshuka', 'Sourdough & butter', 'Citrus salad', 'Fresh mint tea', 'Lemon olive-oil cake'].forEach((t, i) => c.fillText(t, 280, 240 + i * 92));
        c.fillStyle = '#e9c98f'; c.font = 'italic 36px serif'; c.fillText('Good morning!', 280, 760);
        for (const [y0, kind] of [[0, 0], [512, 1]]) {
            const x0 = 600, cx = x0 + 196;
            c.fillStyle = '#f0e8d5'; c.fillRect(x0, y0, 392, 512);
            c.strokeStyle = '#c9b892'; c.lineWidth = 2; c.strokeRect(x0 + 22, y0 + 22, 348, 468);
            if (kind) {
                c.strokeStyle = '#6a5a3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(x0 + 80, y0 + 360); c.quadraticCurveTo(x0 + 190, y0 + 220, x0 + 310, y0 + 70); c.stroke();
                for (let i = 0; i < 12; i++) { const t = i / 12, x = x0 + 80 + t * 230, y = y0 + 360 - t * 290; c.fillStyle = i % 2 ? '#7d9468' : '#91a67b'; c.save(); c.translate(x, y); c.rotate(i % 2 ? 1 : -.8); c.beginPath(); c.ellipse(0, -26, 9, 34, 0, 0, Math.PI * 2); c.fill(); c.restore(); if (i % 3 === 1) { c.fillStyle = '#3c4a32'; c.beginPath(); c.ellipse(x + 16, y + 12, 12, 16, 0, 0, Math.PI * 2); c.fill(); } }
            } else {
                c.fillStyle = '#5f8a4f'; for (const [x, y, r] of [[120, 120, .6], [270, 140, -.7], [190, 210, .2]]) { c.save(); c.translate(x0 + x, y0 + y); c.rotate(r); c.beginPath(); c.ellipse(0, 0, 30, 66, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
                c.fillStyle = '#e8c33d'; for (const [x, y] of [[150, 320], [250, 290]]) { c.beginPath(); c.ellipse(x0 + x, y0 + y, 64, 48, .3, 0, Math.PI * 2); c.fill(); }
                c.fillStyle = '#fff3b0'; c.beginPath(); c.ellipse(x0 + 130, y0 + 302, 16, 9, .3, 0, Math.PI * 2); c.fill();
            }
            c.fillStyle = '#3f6757'; c.font = 'bold 38px serif'; c.fillText(kind ? 'OLIVE' : 'LEMON', cx, y0 + 430);
            c.font = 'italic 20px serif'; c.fillText(kind ? 'Olea europaea' : 'Citrus limon', cx, y0 + 462);
            c.fillStyle = '#c4683f'; c.fillRect(cx - 50, y0 + 395, 100, 3);
        }
    }, 1024, 1024);
    const gs = tier ? (tier === 3 ? .85 : 1) : .82, galleryZ = tier ? (wallStart + 440 + wallEnd) / 2 : (wallStart + 980 + wallEnd - 380) / 2;
    const gallery = group('wall-gallery', 'Chalkboard menu and botanical prints', [w / 2, 1560, galleryZ], -Math.PI / 2, right);
    const pieces = [[-500 * gs, 60, 360 * gs, 470 * gs, [0.5859, 0.9688, 0.5000, 1.0000]], [0, 0, 520 * gs, 760 * gs, [0.0000, 0.5469, 0.1992, 1.0000]], [500 * gs, 60, 360 * gs, 470 * gs, [0.5859, 0.9688, 0.0000, 0.5000]]];
    const artGeos = pieces.map(([x, y, pw, ph, [u0, u1, v0, v1]]) => {
        const g = new THREE.PlaneGeometry(pw, ph), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
        g.translate(x, y, 22); return g;
    });
    noShadow(mesh(gallery, mergeGeometries(artGeos), material('#ffffff', { map: atlas, roughness: .9 }))); artGeos.forEach(g => g.dispose());
    merged(gallery, oak, pieces.flatMap(([x, y, pw, ph], i) => { const f = i === 1 ? 42 : 30; return [{ at: [x, y + ph / 2 + f / 2, 18], size: [pw + f * 2, f, 36] }, { at: [x, y - ph / 2 - f / 2, 18], size: [pw + f * 2, f, 36] }, { at: [x - pw / 2 - f / 2, y, 18], size: [f, ph, 36] }, { at: [x + pw / 2 + f / 2, y, 18], size: [f, ph, 36] }]; }), true);
    noShadow(box(gallery, [440 * gs, 30, 60], [0, -380 * gs - 55, 40], oak)); batch(gallery, cyl, ceramic, [[-120, '#f1ece0'], [-20, '#e9c98f']].map(([x, color], i) => ({ at: [x * gs, -380 * gs - 34, 40 + i * 12], size: [6, 80, 6], rot: [0, i * .3, Math.PI / 2], color })));
    if (!tier) {
        // A compact plate shelf takes the place of the larger rooms' coffee bar.
        const shelf = group('plate-shelf', 'Oak plate shelf with jars', [w / 2, 1450, wallStart + 520], -Math.PI / 2, right);
        box(shelf, [900, 32, 220], [0, 0, 110], oak, 3);
        merged(shelf, brass, [-330, 330].flatMap(x => [{ geo: cyl, at: [x, -70, 10], size: [8, 140, 8] }, { geo: cyl, at: [x, -50, 70], size: [7, 150, 7], rot: [Math.PI / 4, 0, 0] }]).concat([{ geo: cyl, at: [0, 70, 190], size: [6, 880, 6], rot: [0, 0, Math.PI / 2] }]));
        batch(shelf, cyl, ceramic, [-300, -170, -40, 90].map((x, i) => ({ at: [x, 140, 70], size: [112, 12, 112], rot: [Math.PI / 2 - .16, 0, 0], color: ['#f3efe4', '#7fa293', '#e9c98f', '#f3efe4'][i] })).concat([220, 300, 370].map((x, i) => ({ at: [x, 16 + (90 - i * 15) / 2, 120], size: [34, 90 - i * 15, 34], color: ['#c4683f', '#e9e3d6', '#3f6757'][i] }))));
        strip(shelf, [820, 6, 10], [0, -20, 200]);
    } else if (tier <= 2) {
        // Serving sideboard below the gallery: the dinner-party buffet.
        const sb = group('serving-sideboard', 'Oak serving sideboard', [w / 2 - 255, 0, galleryZ], -Math.PI / 2);
        box(sb, [1500, 760, 440], [0, 460, 0], oak, 4); box(sb, [1420, 80, 380], [0, 40, 0], dark); box(sb, [1540, 34, 466], [0, 857, 0], stone, 4);
        for (const x of [-540, -180, 180, 540]) { box(sb, [340, 680, 14], [x, 460, 226], jadeDoor, 3); handle(sb, x + (x < 0 ? 130 : -130), 470, 240, false); }
        merged(sb, ceramic, [{ geo: lathe([[0, 0], [60, 0], [70, 60], [40, 200], [26, 260], [34, 270], [0, 270]], 20), at: [-470, 874, -40] }, { geo: lathe([[0, 0], [120, 0], [165, 70], [155, 74], [110, 8], [0, 8]], 28), at: [380, 874, 0] }]);
        bouquet(sb, [-470, 1120, -40], 9, ['#f6efe1', '#e9a36a', '#f2c14e', '#d97b6b']);
        candles(sb, [[-150, -60, 140], [-80, -40, 190], [-10, -70, 110]], 874);
        pool(sb, [0, 875, 0], [1400, 440], { strength: .45 });
    }
    // Ceiling: brass and opal pendants.
    const ceiling = new THREE.Group(); ceiling.name = 'Kitchen brass and opal pendants'; root.add(ceiling); room.ceilingFixture = ceiling;
    const pendants = layout.island ? [[layout.island[0] - 510, layout.island[1]], [layout.island[0] + 510, layout.island[1]], [layout.dining[0], layout.dining[1]]] : [[layout.desk[0], layout.desk[1]], [layout.dining[0], layout.dining[1]]];
    pendants.forEach(([x, z]) => { rod(ceiling, [x, h, z], [x, h - 650, z], 5, brass); sphere(ceiling, [170, 115, 170], [x, h - 690, z], brass); const diffuser = mesh(ceiling, new THREE.CylinderGeometry(152, 152, 10, 32), cream, [x, h - 765, z]); diffuser.castShadow = false; strip(ceiling, [120, 5, 120], [x, h - 772, z]); });
    merged(ceiling, brass, pendants.map(([x, z]) => ({ geo: cyl, at: [x, h - 8, z], size: [55, 16, 55] })));
    const lights = [
        { at: [runStart + runWidth / 2, 1480, bz + 780], power: 3.3, task: true },
        { at: [layout.desk[0], h - 500, layout.desk[1]], power: 3.5, task: true },
        { at: [layout.dining[0], h - 700, layout.dining[1]], power: 3.4 },
        { at: [w / 2 - 1150, h - 350, bz + d * .5], power: 2.6, channel: 1 }
    ].map(spec => { const light = new THREE.PointLight('#ffdeb0', 0, 4500 * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    // Window view: sky, sun or moon, a garden hedge and the neighbours' roofs.
    const drawSky = (id, mode) => {
        const c = skyCanvas.getContext('2d'), grad = c.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, mode.sky[0]); grad.addColorStop(1, mode.sky[1]); c.fillStyle = grad; c.fillRect(0, 0, 512, 512);
        const dim = id === 'night' || id === 'party', sun = { morning: [140, 300, '#fff4d6', 34], afternoon: [330, 90, '#fffdf2', 30], evening: [400, 330, '#ffd08a', 40], night: [380, 110, '#f4f1e6', 20], party: [90, 140, '#f4ecdc', 16] }[id];
        if (dim) for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${.25 + hash(i) * .6})`; c.fillRect(hash(i + 1) * 512, hash(i + 2) * 300, 1.5, 1.5); }
        const halo = c.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], sun[3] * 5); halo.addColorStop(0, sun[2] + (dim ? '55' : 'aa')); halo.addColorStop(1, sun[2] + '00'); c.fillStyle = halo; c.fillRect(0, 0, 512, 512);
        c.fillStyle = sun[2]; c.beginPath(); c.arc(sun[0], sun[1], sun[3], 0, Math.PI * 2); c.fill();
        if (!dim) for (let i = 0; i < 4; i++) { c.fillStyle = id === 'evening' ? '#ffd3b04d' : '#ffffff70'; const x = hash(i + 30) * 512, y = 60 + hash(i + 40) * 160; for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(x + k * 26, y + (k % 2) * 6, 34, 14, 0, 0, Math.PI * 2); c.fill(); } }
        const roofs = dim ? '#1c2533' : id === 'evening' ? '#6e5a63' : '#9aa7a6';
        c.fillStyle = roofs; for (let i = 0; i < 6; i++) { const x = i * 95 - 20, top = 330 + hash(i + 60) * 40; c.beginPath(); c.moveTo(x, 430); c.lineTo(x, top + 30); c.lineTo(x + 45, top); c.lineTo(x + 95, top + 30); c.lineTo(x + 95, 430); c.fill(); if (id !== 'morning' && id !== 'afternoon') { c.fillStyle = '#ffd38a'; c.fillRect(x + 30, top + 50, 12, 14); if (i % 2) c.fillRect(x + 58, top + 52, 12, 14); c.fillStyle = roofs; } }
        c.fillStyle = dim ? '#1d2d27' : id === 'evening' ? '#4c5c45' : '#7f9a6f'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(i * 40, 470 + hash(i) * 14, 44 + i % 3 * 12, 0, Math.PI * 2); c.fill(); }
        skyMap.needsUpdate = true;
    };
    room.roomAtmosphere = (id, accent = 1) => {
        const mode = KITCHEN_MODES[id] || KITCHEN_MODES.morning;
        drawSky(id, mode); drawClock(mode.clock);
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .12 + mode.wash * accent; });
        displays.forEach(mat => { mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .03 + .32 * mode.wash * accent; });
        pools.forEach(({ obj, strength, source }) => { const k = (source === 'wash' ? mode.wash : mode.practical) * strength * accent; obj.material.color.set(mode.colors[0]).multiplyScalar(k * .55); obj.visible = k > .02; });
        flames.forEach(f => { if (f.isMaterial) f.emissiveIntensity = 2.4 * mode.candles * accent; else f.visible = mode.candles > 0; });
        lights.forEach(spec => {
            spec.light.color.set(spec.task ? '#ffe0b7' : mode.colors[0]); if (spec.channel) spec.light.color.lerp(tint.set(mode.colors[1]), .3);
            spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * mode.lamps * accent;
        });
        root.userData.atmosphere = id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [jade, 'powder'], [dark, 'powder'], [brass, 'metal'], [steel, 'metal'], [oak, 'wood'], [stone, 'stone'], [linen, 'fabric']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
