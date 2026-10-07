import * as THREE from 'three';
import { HOME_LAYOUTS } from './home-office.mjs?v=room-furnishings-20261006';

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
        { id: 'quaternius-guitar', at: [width / 2 - 100, 1120, back + 500], turn: -90, on: 'wall' },
        { id: 'kenney-furniture-potted-plant', at: [-width / 2 + 260, 0, back + 1500] },
        { id: 'kenney-furniture-lamp-round-floor', at: [-width / 2 + 175, 0, front - 270] }
    ];
    if (!compact) props.push({ id: 'sheet-music', at: [piano[0] - 65, 843, piano[1]], turn: 90 });
    // Headphones rest on the combo amp below the hanging guitar.
    if (!large) props.push({ id: 'headphones', at: [width / 2 - 165, 462, back + 690], turn: -100 });
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
    morning: { label: 'Morning', description: 'Fresh daylight · standing warm-up and composing', key: '#fff1dc', fill: '#dceaf4', accent: '#f7d3a0', power: 1.75, ambient: .52, bounce: .7, exposure: 1.1, sky: ['#9dc3d6', '#f4e3c4'], practical: .24, wash: .14, colors: ['#f7c992', '#b7c9c0'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Clear, balanced light · seated editing and mixing', key: '#fff0dc', fill: '#d6e5ed', accent: '#f6cb99', power: 1.36, ambient: .46, bounce: .66, exposure: 1.1, sky: ['#93bcd2', '#ece6d5'], practical: .42, wash: .3, colors: ['#efbb82', '#a6c2bb'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm session · desk tilted for lyrics and scores', key: '#ffcf9c', fill: '#cdd6dc', accent: '#ffad70', power: .78, ambient: .34, bounce: .46, exposure: 1.14, sky: ['#7d7fa6', '#f0b487'], practical: 1, wash: .9, colors: ['#ffb46a', '#d6a8c9'], height: 28, tilt: 10, offset: [0, 60], yaw: 0, leds: true, color: '#ffba73' },
    night: { label: 'Night', description: 'Quiet late-night mix · soft amber and lavender', key: '#c5d0ea', fill: '#bccadc', accent: '#c8a9f0', power: .28, ambient: .24, bounce: .3, exposure: 1.2, sky: ['#121f33', '#334766'], practical: .62, wash: .78, colors: ['#eda262', '#a993ec'], height: 28, tilt: 0, offset: [0, 80], yaw: 0, leds: true, color: '#bfa0ff' },
    party: { label: 'Performance', description: 'Live session · standing desk turned toward the room', key: '#e2d4ee', fill: '#ccd6e6', accent: '#f094b4', power: .42, ambient: .3, bounce: .4, exposure: 1.16, sky: ['#221d3f', '#6c4673'], practical: .74, wash: 1.35, colors: ['#ff935e', '#c483ef'], height: 43.5, tilt: -5, offset: [80, 300], yaw: -14, leds: true, color: '#ff8c8a' }
};

// Deterministic noise keeps procedural textures identical on every rebuild.
const seeded = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}

// Repeats inside movable props are merged rather than instanced, so each
// prop's geometry bounds match what is drawn (editor, collision and tests).
function mergeParts(parts) {
    const out = new THREE.BufferGeometry(), data = { position: [], normal: [], uv: [], color: [] }, index = [];
    let offset = 0;
    for (const { geometry, matrix, color } of parts) {
        const g = geometry.clone().applyMatrix4(matrix);
        for (const key of ['position', 'normal', 'uv']) data[key].push(...g.attributes[key].array);
        if (color) for (let i = 0; i < g.attributes.position.count; i++) data.color.push(color.r, color.g, color.b);
        for (const i of g.index.array) index.push(i + offset);
        offset += g.attributes.position.count; g.dispose();
    }
    for (const [key, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) if (data[key].length) out.setAttribute(key, new THREE.Float32BufferAttribute(data[key], size));
    out.setIndex(index); parts.forEach(part => part.geometry.dispose()); return out;
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
    const cream = material('#252b32', { roughness: .88 }), wood = material('#80634e', { roughness: .75 });
    // Library lamp shades glow with the session; copies follow the current mode.
    const shades = [], session = { mode: 'afternoon', accent: 1 };
    const shadeGlow = mat => { const mode = MUSIC_MODES[session.mode]; mat.emissiveIntensity = (.03 + Math.max(0, mode.practical - .3) * 1.4) * session.accent; };
    room.decorateProp = (object, placement) => {
        if (placement.id === 'kenney-furniture-lamp-round-floor') {
            object.traverse(mesh => {
                if (!mesh.isMesh || mesh.material?.name !== 'lamp') return;
                const mat = mesh.material.clone(); mat.color.set('#f4dfb8'); mat.emissive.set('#ffbf73'); mat.userData.sharedTextures = true;
                shadeGlow(mat); shades.push(mat); room.ownedMaterials.add(mat); mesh.material = mat;
            });
            return;
        }
        // Each speaker instance owns these copies; the prop library stays reusable.
        if (!/speaker/.test(placement.id)) return;
        const copies = new Map();
        object.traverse(mesh => {
            if (!mesh.isMesh) return;
            const darken = source => {
                if (copies.has(source)) return copies.get(source);
                const mat = source.clone(), silver = /metal/i.test(source.name);
                mat.color.set(silver ? '#c4cbd2' : '#14191f');
                mat.metalness = silver ? .8 : .12; mat.roughness = silver ? .27 : .62;
                mat.userData.sharedTextures = true;
                copies.set(source, mat); room.ownedMaterials.add(mat); return mat;
            };
            mesh.material = Array.isArray(mesh.material) ? mesh.material.map(darken) : darken(mesh.material);
        });
    };
    const instrument = (group, id, name) => {
        group.userData.propId = id; group.userData.sceneAssetName = name;
        markSceneAsset(group, { key: `music:${layout.id}:instrument:${id}` });
    };
    const trim = material('#303d3c'), metal = material('#293136', { metalness: .5, roughness: .45 });
    const fabricMap = texture((c, tw, th) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#68746d2b'; c.lineWidth = 1;
        for (let n = 0; n < tw; n += 4) { c.beginPath(); c.moveTo(n, 0); c.lineTo(n, th); c.moveTo(0, n); c.lineTo(tw, n); c.stroke(); }
    }); fabricMap.repeat.set(2, 4);
    const moss = material('#596e62', { map: fabricMap, roughness: 1 }), clay = material('#b27a55', { map: fabricMap, roughness: 1 });
    const walnut = material('#5a3b27', { roughness: .58 }), felt = material('#17191b', { map: fabricMap, roughness: 1 });
    const brass = material('#c0904f', { metalness: .78, roughness: .32 }), cable = material('#111315', { roughness: .5 });
    // Long rift-sawn oak boards with staggered joints, grain, knots and fine gaps.
    const floorMap = texture((c, tw, th) => {
        const rnd = seeded(23), pw = tw / 6;
        c.fillStyle = '#6b513b'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 6; i++) {
            const offset = (i * .37 % 1) * th, tone = ['#a98665', '#a4825f', '#ad8a69', '#a68363', '#a07e5e'][Math.floor(rnd() * 5)];
            for (let k = -1; k < 1; k++) {
                const y0 = offset + k * th;
                const x0 = i * pw + 1, y = y0 + 1, bw = pw - 2, bh = th - 2;
                c.fillStyle = tone; c.fillRect(x0, y, bw, bh); c.lineWidth = 1;
                for (let j = 0; j < 46; j++) {
                    const x = x0 + 2 + rnd() * (bw - 4), wave = 2 + rnd() * 5;
                    c.strokeStyle = rnd() > .45 ? '#5e3f2830' : '#d5b48a26'; c.beginPath(); c.moveTo(x, y);
                    c.bezierCurveTo(x - wave, y + bh * .3, x + wave, y + bh * .7, x + (rnd() - .5) * 4, y + bh); c.stroke();
                }
                for (let n = 0; n < 2; n++) if (rnd() > .5) { const kx = x0 + 10 + rnd() * (bw - 20), ky = y + 60 + rnd() * (bh - 120); c.fillStyle = '#5a3b2650'; c.beginPath(); c.ellipse(kx, ky, 3, 8, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#6a493036'; c.beginPath(); c.ellipse(kx, ky, 6, 17, 0, 0, Math.PI * 2); c.stroke(); }
                c.fillStyle = '#4a36268a'; c.fillRect(x0 - 1, y0 - 1, bw + 2, 2);
            }
        }
    }, 512, 1024); floorMap.repeat.set(w / 1100, d / 1900);
    const floor = material('#ffffff', { map: floorMap, roughness: .62 });
    box(root, [w, 30, d], [0, -15, bz + d / 2], floor);
    // Vintage Persian rug: madder field, indigo border and an ivory medallion.
    const rugMap = texture((c, tw, th) => {
        const rnd = seeded(5), cx = tw / 2, cy = th / 2;
        c.fillStyle = '#74291f'; c.fillRect(0, 0, tw, th);
        const band = (inset, size, color) => { c.strokeStyle = color; c.lineWidth = size; c.strokeRect(inset + size / 2, inset + size / 2, tw - 2 * inset - size, th - 2 * inset - size); };
        band(0, 18, '#2b2230'); band(18, 8, '#d9ab62'); band(26, 74, '#22304a'); band(100, 8, '#d9ab62'); band(108, 14, '#5a1d18'); band(122, 4, '#e6d3ae');
        const rosette = (x, y, r, a, b) => { c.fillStyle = a; c.beginPath(); for (let n = 0; n < 16; n++) { const t = n / 16 * Math.PI * 2, rr = n % 2 ? r * .55 : r; c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } c.fill(); c.fillStyle = b; c.beginPath(); c.arc(x, y, r * .3, 0, Math.PI * 2); c.fill(); };
        for (let t = 80; t < tw - 60; t += 58) { rosette(t, 63, 22, '#d9ab62', '#7d3024'); rosette(t, th - 63, 22, '#d9ab62', '#7d3024'); rosette(63, t, 22, '#c97c45', '#22304a'); rosette(tw - 63, t, 22, '#c97c45', '#22304a'); }
        // Field lattice of small guls between the border and the medallion.
        for (let y = 170; y < th - 140; y += 64) for (let x = 170; x < tw - 140; x += 64) {
            const odd = ((x + y) / 64) % 2; c.fillStyle = odd ? '#5e2219' : '#9a4a30';
            c.beginPath(); c.moveTo(x, y - 16); c.lineTo(x + 16, y); c.lineTo(x, y + 16); c.lineTo(x - 16, y); c.fill();
            c.fillStyle = odd ? '#c98e4e' : '#2b3b55'; c.fillRect(x - 3, y - 3, 6, 6);
        }
        const lozenge = (rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.moveTo(cx, cy - ry); c.quadraticCurveTo(cx + rx * .55, cy - ry * .55, cx + rx, cy); c.quadraticCurveTo(cx + rx * .55, cy + ry * .55, cx, cy + ry); c.quadraticCurveTo(cx - rx * .55, cy + ry * .55, cx - rx, cy); c.quadraticCurveTo(cx - rx * .55, cy - ry * .55, cx, cy - ry); c.fill(); };
        lozenge(300, 230, '#22304a'); lozenge(270, 205, '#d9ab62'); lozenge(250, 188, '#e9dcc0'); lozenge(205, 152, '#7d3024'); lozenge(150, 112, '#22304a'); lozenge(110, 82, '#c97c45');
        rosette(cx, cy, 56, '#e9dcc0', '#22304a');
        // Quarter-medallion spandrels sit inside the field corners.
        c.save(); c.beginPath(); c.rect(126, 126, tw - 252, th - 252); c.clip();
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const x = cx + sx * (tw / 2 - 126), y = cy + sy * (th / 2 - 126);
            c.fillStyle = '#22304a'; c.beginPath(); c.ellipse(x, y, 170, 128, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#d9ab62'; c.beginPath(); c.ellipse(x, y, 150, 110, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#9a5a33'; c.beginPath(); c.ellipse(x, y, 140, 100, 0, 0, Math.PI * 2); c.fill();
            rosette(x - sx * 62, y - sy * 46, 22, '#e0cfa9', '#22304a');
        }
        c.restore();
        // Gentle abrash, worn pile and the weave.
        for (let n = 0; n < 2600; n++) { c.fillStyle = rnd() > .5 ? '#f3e2c414' : '#1a0d0a1c'; c.fillRect(rnd() * tw, rnd() * th, 2 + rnd() * 10, 1 + rnd() * 3); }
        c.strokeStyle = '#00000014'; c.lineWidth = 1;
        for (let y = 0; y < th; y += 3) { c.beginPath(); c.moveTo(0, y); c.lineTo(tw, y); c.stroke(); }
    }, 1024, 1024);
    const rug = material('#ffffff', { map: rugMap, roughness: 1 }), fringe = material('#e4d6bb', { map: fabricMap, roughness: 1 });
    const rugGroup = new THREE.Group(); rugGroup.name = 'Persian studio rug'; root.add(rugGroup);
    const rugW = layout.compact ? 2200 : 2600;
    box(rugGroup, [rugW, 5, 1850], [layout.desk[0], 2.5, layout.desk[1] + 580], rug, 4);
    for (const sign of [-1, 1]) box(rugGroup, [rugW - 80, 2, 36], [layout.desk[0], 1, layout.desk[1] + 580 + sign * 943], fringe).castShadow = false;

    const back = new THREE.Group(); back.name = 'Music control-room acoustic wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], cream);
    box(back, [w, 85, 24], [0, 42.5, bz + 12], wood);
    const count = layout.compact ? 3 : 5, panelW = layout.compact ? 490 : 425;
    for (let i = 0; i < count; i++) {
        const x = layout.desk[0] + (i - (count - 1) / 2) * (panelW + 35);
        const panel=new THREE.Group();panel.name=`Acoustic wall panel ${i+1}`;back.add(panel);
        box(panel, [panelW, 1260, 65], [x, 1790, bz + 40], wood, 12);
        box(panel, [panelW - 25, 1235, 30], [x, 1790, bz + 87], i % 2 ? clay : moss, 12);
    }
    // A walnut 2D skyline diffuser above the control desk: one instanced batch.
    const cols = layout.compact ? 22 : 30, rows = 5, blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(44, 46, 1), wood, cols * rows);
    const place = new THREE.Object3D(), tint = new THREE.Color(), dx0 = layout.desk[0] - (cols - 1) * 25;
    box(back, [cols * 50 + 46, rows * 52 + 46, 18], [layout.desk[0], 850, bz + 9], walnut, 4);
    for (let i = 0, n = 0; i < cols; i++) for (let r = 0; r < rows; r++, n++) {
        const depth = 26 + ((i * i + r * r * 3) % 7) * 15;
        place.position.set(dx0 + i * 50, 850 + (r - 2) * 52, bz + 18 + depth / 2); place.scale.set(1, 1, depth); place.updateMatrix();
        blocks.setMatrixAt(n, place.matrix); blocks.setColorAt(n, tint.set((i + r) % 3 ? '#ffffff' : '#c9a98a'));
    }
    blocks.castShadow = blocks.receiveShadow = true; blocks.computeBoundingBox(); back.add(blocks);
    // Felt-backed walnut slat panels fill the wall either side of the panel set.
    const span = count * panelW + (count - 1) * 35, slatH = h - 290, zones = [[-w / 2 + 30, layout.desk[0] - span / 2 - 45], [layout.desk[0] + span / 2 + 45, w / 2 - 30]].filter(([a, b]) => b - a > 200);
    const slatCount = zones.reduce((sum, [a, b]) => sum + Math.floor((b - a - 32) / 55) + 1, 0);
    const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(32, slatH, 22), walnut, slatCount);
    let slat = 0;
    for (const [a, b] of zones) {
        const n = Math.floor((b - a - 32) / 55) + 1, used = (n - 1) * 55 + 32, start = (a + b) / 2 - used / 2 + 16;
        box(back, [used + 20, slatH + 10, 12], [(a + b) / 2, 125 + slatH / 2, bz + 6], felt).castShadow = false;
        for (let i = 0; i < n; i++) { place.position.set(start + i * 55, 125 + slatH / 2, bz + 23); place.scale.set(1, 1, 1); place.updateMatrix(); slats.setMatrixAt(slat++, place.matrix); }
    }
    slats.castShadow = slats.receiveShadow = true; slats.computeBoundingBox(); back.add(slats);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });

    const side = new THREE.Group(); side.name = 'Music instrument and rack wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], cream);
    box(side, [24, 85, d], [w / 2 - 12, 42.5, bz + d / 2], wood);
    room.propSupports=[];
    for (const z of [bz + 500]) {
        const hanger=new THREE.Group();hanger.name='Guitar and wall hanger';side.add(hanger);
        box(hanger, [55, 1280, 510], [w / 2 - 30, 1640, z], moss, 10);
        rod(hanger, [w / 2 - 120, 2110, z - 45], [w / 2 - 120, 2110, z + 45], 9, metal);
        room.propSupports.push({obj:hanger,id:'quaternius-guitar',at:[w/2-100,1120,z]});
    }
    // Framed record sleeves between the guitar and the shelves: one instanced
    // frame batch and one merged quad batch for the sleeve artwork.
    const sleeveMap = texture((c, tw) => {
        const s = tw / 2, rnd = seeded(41);
        const sunset = c.createLinearGradient(0, 0, 0, s); sunset.addColorStop(0, '#f6c35f'); sunset.addColorStop(.55, '#e0743a'); sunset.addColorStop(1, '#6b1f2a');
        c.fillStyle = sunset; c.fillRect(0, 0, s, s); c.fillStyle = '#ffe2a1'; c.beginPath(); c.arc(s / 2, s * .56, s * .24, Math.PI, 0); c.fill();
        c.fillStyle = '#6b1f2a'; for (let i = 0; i < 6; i++) c.fillRect(0, s * .58 + i * 13, s, 3 + i);
        c.fillStyle = '#2a1416'; c.font = 'bold 22px sans-serif'; c.fillText('AMBER HOURS', 16, 30);
        c.fillStyle = '#121212'; c.fillRect(s, 0, s, s);
        for (let r = 104; r > 30; r -= 3) { c.strokeStyle = r % 2 ? '#2b2b2b' : '#1b1b1b'; c.lineWidth = 2; c.beginPath(); c.arc(s * 1.5, s / 2, r, 0, Math.PI * 2); c.stroke(); }
        c.fillStyle = '#e39a3b'; c.beginPath(); c.arc(s * 1.5, s / 2, 34, 0, Math.PI * 2); c.fill(); c.fillStyle = '#121212'; c.beginPath(); c.arc(s * 1.5, s / 2, 4, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e8dcc4'; c.font = '15px sans-serif'; c.fillText('SIDE A · 33⅓', s + 14, s - 14);
        c.fillStyle = '#1d3b4a'; c.fillRect(0, s, s, s);
        c.fillStyle = '#e8b04b'; c.fillRect(20, s + 26, s * .42, s * .42); c.fillStyle = '#d4553d'; c.beginPath(); c.arc(s * .66, s * 1.62, s * .2, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#e8dcc4'; c.lineWidth = 4; c.beginPath(); c.moveTo(18, s * 1.86); c.lineTo(s - 18, s * 1.86); c.stroke();
        c.fillStyle = '#e8dcc4'; c.font = 'bold 26px sans-serif'; c.fillText('LATE TAKES', 18, s * 1.96);
        c.fillStyle = '#eadfc8'; c.fillRect(s, s, s, s); c.fillStyle = '#1b1b1b';
        for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) { const r = 1 + 6 * Math.abs(Math.sin(x * .45 + y * .3)) * (y / 14); c.beginPath(); c.arc(s + 12 + x * 17.5, s + 12 + y * 13, r, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#b8462f'; c.font = 'bold 44px serif'; c.fillText('B-SIDES', s + 18, s * 2 - 24);
        for (let n = 0; n < 900; n++) { c.fillStyle = rnd() > .5 ? '#ffffff12' : '#00000014'; c.fillRect(rnd() * tw, rnd() * tw, 2, 2); }
    }, 512, 512);
    const records = new THREE.Group(); records.name = 'Framed record wall'; records.position.set(w / 2 - 16, 0, bz + 1125); records.rotation.y = -Math.PI / 2; side.add(records);
    const tile = 320, frameParts = [], sleeves = [];
    for (let i = 0; i < 4; i++) {
        const x = (i % 2 - .5) * (tile + 25), y = 1420 + Math.floor(i / 2) * (tile + 25);
        frameParts.push({ geometry: new THREE.BoxGeometry(tile, tile, 26), matrix: new THREE.Matrix4().makeTranslation(x, y, 0) });
        sleeves.push({ x, y, size: tile - 34, u: (i % 2) * .5, v: Math.floor(i / 2) ? 0 : .5 });
    }
    mesh(records, mergeParts(frameParts), walnut);
    const quad = new THREE.BufferGeometry(), qp = [], qn = [], qu = [], qi = [];
    sleeves.forEach(({ x, y, size, u, v }, i) => {
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { qp.push(x + sx * size / 2, y + sy * size / 2, 14); qn.push(0, 0, 1); qu.push(u + (sx + 1) / 4, v + (sy + 1) / 4); }
        qi.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    quad.setAttribute('position', new THREE.Float32BufferAttribute(qp, 3)); quad.setAttribute('normal', new THREE.Float32BufferAttribute(qn, 3)); quad.setAttribute('uv', new THREE.Float32BufferAttribute(qu, 2)); quad.setIndex(qi);
    mesh(records, quad, material('#ffffff', { map: sleeveMap, roughness: .45 })).castShadow = false;
    // Larger studios hang coiled instrument and XLR cables near the live area.
    if (!layout.compact) {
        const hanger = new THREE.Group(); hanger.name = 'Studio cable hanger'; hanger.position.set(w / 2 - 14, 1700, (layout.performance[1] + 550 + front) / 2); hanger.rotation.y = -Math.PI / 2; side.add(hanger);
        box(hanger, [380, 70, 24], [0, 0, 0], walnut, 4);
        [['#111315', 1.25], ['#c98a3a', 1.05], ['#9e3a2c', 1.35], ['#2f5d68', 1.15]].forEach(([color, stretch], i) => {
            const x = -135 + i * 90;
            rod(hanger, [x, 0, 12], [x, 6, 62], 6, brass);
            const coil = mesh(hanger, new THREE.TorusGeometry(58, 6, 6, 24), material(color, { roughness: .5 }), [x, -58 * stretch + 8, 46]); coil.scale.y = stretch; coil.castShadow = false;
        });
    }
    // On-air light above the records; it brightens for sessions and shows.
    const onAirMap = texture((c, tw, th) => {
        c.fillStyle = '#2a0b0a'; c.fillRect(0, 0, tw, th);
        c.strokeStyle = '#ff5a43'; c.lineWidth = 5; c.strokeRect(10, 10, tw - 20, th - 20);
        c.fillStyle = '#ff6a4f'; c.font = 'bold 66px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ON AIR', tw / 2, th / 2 + 3);
    }, 512, 160);
    const onAir = new THREE.Group(); onAir.name = 'On-air recording light'; onAir.position.set(w / 2 - 22, h - 330, bz + 1125); onAir.rotation.y = -Math.PI / 2; side.add(onAir);
    box(onAir, [470, 160, 40], [0, 0, 0], metal, 8);
    const onAirLamp = material('#ffffff', { map: onAirMap, emissive: '#ffffff', emissiveMap: onAirMap, emissiveIntensity: .3, roughness: .3 });
    mesh(onAir, new THREE.PlaneGeometry(430, 125), onAirLamp, [0, 0, 21]).castShadow = false;
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
    instrument(rack, 'music-equipment-cabinet', 'Recording equipment cabinet');
    box(rack, [690, 745, 680], [rx, 407.5, rz], trim, 8);
    box(rack, [710, 20, 700], [rx, 790, rz], wood, 4);
    for (const x of [rx - 260, rx + 260]) for (const z of [rz - 250, rz + 250]) rod(rack, [x, 0, z], [x, 35, z], 14, metal);
    // Rack gear is painted once: tube compressor, interface and patch bay.
    // The paired glow map lights only the meters, LEDs and display.
    const rackGlow = document.createElement('canvas'); rackGlow.width = 512; rackGlow.height = 448;
    const rackFace = texture((c, tw, th) => {
        const g = rackGlow.getContext('2d'); g.fillStyle = '#000000'; g.fillRect(0, 0, tw, th);
        const both = (fill, draw) => { for (const ctx of [c, g]) { ctx.fillStyle = fill; draw(ctx); } };
        c.fillStyle = '#121416'; c.fillRect(0, 0, tw, th);
        const unit = (y, height, face) => {
            c.fillStyle = face; c.fillRect(4, y + 3, tw - 8, height - 6);
            c.fillStyle = '#ffffff10'; c.fillRect(4, y + 3, tw - 8, 3);
            for (const x of [14, tw - 14]) for (const sy of [y + 16, y + height - 16]) { c.fillStyle = '#8b8f92'; c.beginPath(); c.arc(x, sy, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2c2f31'; c.fillRect(x - 4, sy - 1, 8, 2); }
        };
        const knob = (x, y, r, skirt = '#d9cdb3') => { c.fillStyle = '#0b0c0d'; c.beginPath(); c.arc(x, y + 2, r + 2, 0, Math.PI * 2); c.fill(); c.fillStyle = skirt; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(x, y, r * .62, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#efe6d2'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + r * .55, y - r * .55); c.stroke(); };
        // Tube compressor with twin backlit VU meters.
        unit(0, 150, '#5b4a3a');
        for (const x of [38, 168]) {
            both('#f7d58a', ctx => ctx.fillRect(x, 26, 112, 86));
            c.strokeStyle = '#2b2018'; c.lineWidth = 2; c.beginPath(); c.arc(x + 56, 118, 70, Math.PI * 1.22, Math.PI * 1.78); c.stroke();
            c.strokeStyle = '#b4321f'; c.beginPath(); c.arc(x + 56, 118, 70, Math.PI * 1.62, Math.PI * 1.78); c.stroke();
            c.strokeStyle = '#1b1410'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + 56, 112); c.lineTo(x + 40 + (x > 100 ? 28 : 0), 50); c.stroke();
            c.fillStyle = '#2b2018'; c.font = '10px sans-serif'; c.fillText('VU', x + 49, 100);
        }
        for (let i = 0; i < 4; i++) knob(330 + i * 44, 60, 15);
        for (let i = 0; i < 4; i++) knob(330 + i * 44, 112, 9, '#a9a49a');
        both('#ff8a2a', ctx => { ctx.beginPath(); ctx.arc(486, 40, 6, 0, Math.PI * 2); ctx.fill(); });
        c.fillStyle = '#e8d9b8'; c.font = 'bold 12px sans-serif'; c.fillText('AMBER  TUBE  COMP', 330, 140);
        // Audio interface: channel meters, gain knobs and a status display.
        unit(150, 150, '#1d2023');
        for (let ch = 0; ch < 8; ch++) {
            const x = 30 + ch * 26, lit = 5 + (ch * 7 % 9);
            for (let seg = 0; seg < 14; seg++) both(seg >= lit ? '#20262a' : seg > 11 ? '#ff4a2e' : seg > 8 ? '#ffb02e' : '#58e08a', ctx => ctx.fillRect(x, 278 - seg * 8, 14, 5));
            if (lit < 14) { g.fillStyle = '#000000'; for (let seg = lit; seg < 14; seg++) g.fillRect(x, 278 - seg * 8, 14, 5); }
        }
        for (let i = 0; i < 6; i++) knob(260 + i * 40, 196, 12, '#3b4247');
        for (let i = 0; i < 6; i++) { c.fillStyle = '#0c0d0e'; c.beginPath(); c.arc(260 + i * 40, 260, 11, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5e6468'; c.beginPath(); c.arc(260 + i * 40, 260, 5, 0, Math.PI * 2); c.fill(); }
        both('#ffb347', ctx => ctx.fillRect(250, 166, 120, 10));
        c.fillStyle = '#d8dde0'; c.font = '11px sans-serif'; c.fillText('48V   INST   HI-Z', 382, 176);
        // Patch bay with label strips and a few patch cords.
        unit(300, 148, '#232628');
        for (const row of [0, 1]) {
            c.fillStyle = '#e9e1cd'; c.fillRect(24, 318 + row * 60, tw - 48, 10);
            for (let i = 0; i < 16; i++) { const x = 36 + i * 28.5, y = 348 + row * 60; c.fillStyle = '#060707'; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = '#4d5357'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
        }
        for (const [a, b, color] of [[2, 9, '#e0a136'], [5, 12, '#c8452f'], [7, 3, '#3f8f9c'], [11, 14, '#e0a136']]) {
            const x0 = 36 + a * 28.5, x1 = 36 + b * 28.5; c.strokeStyle = color; c.lineWidth = 5; c.lineCap = 'round';
            c.beginPath(); c.moveTo(x0, 348); c.bezierCurveTo(x0, 440, x1, 440, x1, 408); c.stroke();
        }
        both('#58e08a', ctx => { ctx.beginPath(); ctx.arc(486, 318, 4, 0, Math.PI * 2); ctx.fill(); });
    }, 512, 448);
    const rackGlowMap = new THREE.CanvasTexture(rackGlow); rackGlowMap.colorSpace = THREE.SRGBColorSpace;
    const rackLamp = material('#ffffff', { map: rackFace, emissive: '#ffffff', emissiveMap: rackGlowMap, emissiveIntensity: .4, metalness: .35, roughness: .45 });
    mesh(rack, new THREE.PlaneGeometry(644, 563), rackLamp, [rx, 455, rz + 342]).castShadow = false;
    for (const x of [rx - 334, rx + 334]) box(rack, [16, 600, 10], [x, 455, rz + 343], metal, 2);
    for (const y of [1490, 1860]) {
        const shelf=new THREE.Group();shelf.name=y===1490?'Wall shelf and books':'Wall shelf and plant';side.add(shelf);
        box(shelf, [300, 28, 570], [w / 2 - 160, y, rz], wood, 3);
        room.propSupports.push(y===1490?{obj:shelf,id:'kenney-furniture-books',at:[w/2-160,1504,rz-120]}:{obj:shelf,id:'kenney-furniture-plant-small2',at:[w/2-165,1874,rz+60]});
    }
    for (const sign of [-1, 1]) {
        const x = layout.desk[0] + sign * layout.speakers, z = layout.desk[1] - 260;
        const stand = new THREE.Group(); stand.name = sign < 0 ? 'Left monitor speaker and stand' : 'Right monitor speaker and stand';stand.position.set(x,0,z);root.add(stand);
        instrument(stand, `music-speaker-stand-${sign}`, stand.name);
        box(stand, [360,22,330], [0,11,0], metal,8);
        rod(stand, [0,22,0], [0,734,0],28,metal);
        box(stand,[326,16,295],[0,742,0],wood,4);
        rod(stand, [0, 734, -46], [0, 30, -46], 5, cable); rod(stand, [0, 30, -46], [sign * 30, 25, -158], 5, cable);
        room.propSupports.push({obj:stand,at:[x,750,z],id:'kenney-furniture-speaker-small'});
    }

    if (!layout.compact) {
        const [x, z] = layout.piano;
        const piano = new THREE.Group(); piano.name = 'Keyboard composing area'; piano.position.set(x, 0, z); piano.rotation.y = Math.PI / 2; root.add(piano);
        instrument(piano, 'music-stage-piano', 'Stage piano');
        const keys = createMusicKeyboard(true); keys.position.y = 740; piano.add(keys);
        box(piano, [420, 6, 200], [0, 840, -65], metal, 3);
        for (const sx of [-150, 150]) rod(piano, [sx, 800, -90], [sx, 837, -65], 5, metal);
        for (const sx of [-410, 410]) rod(piano, [sx, 22, -90], [-sx, 732, 80], 17, metal);
        for (const sx of [-410, 410]) rod(piano, [sx, 18, -155], [sx, 18, 155], 18, metal);
        const bench = new THREE.Group(); bench.name = 'Piano bench'; bench.position.set(0, 0, 630); piano.add(bench);
        box(bench, [650, 90, 370], [0, 475, 0], moss, 12);
        for (const sx of [-240, 240]) for (const sz of [-120, 120]) rod(bench, [sx, 0, sz], [sx, 430, sz], 18, wood);
        root.updateMatrixWorld(true);root.attach(bench);instrument(bench, 'music-piano-bench', 'Piano bench');
    }
    // Small spaces use one vocal stand; larger studios get a defined live area.
    const [mx, mz] = layout.performance;
    // Round flat-weave rug marks the live area in the larger studios.
    if (!layout.compact) {
        const kilimMap = texture((c, tw) => {
            const rnd = seeded(9), cx = tw / 2;
            c.fillStyle = '#d9c6a4'; c.fillRect(0, 0, tw, tw);
            const rings = [[250, '#3a3f4a'], [236, '#d9c6a4'], [222, '#b5643b'], [190, '#e2d2b2'], [176, '#3a3f4a'], [160, '#c98f45'], [118, '#e2d2b2'], [104, '#8c3a2a'], [60, '#d9a95a'], [26, '#3a3f4a']];
            for (const [r, color] of rings) { c.fillStyle = color; c.beginPath(); c.arc(cx, cx, r, 0, Math.PI * 2); c.fill(); }
            for (const [r, size, color] of [[206, 9, '#3a3f4a'], [139, 8, '#8c3a2a'], [82, 6, '#e2d2b2']]) for (let n = 0; n < Math.round(r / 3.4); n++) {
                const t = n / Math.round(r / 3.4) * Math.PI * 2; c.save(); c.translate(cx + Math.cos(t) * r, cx + Math.sin(t) * r); c.rotate(t + Math.PI / 4); c.fillStyle = color; c.fillRect(-size / 2, -size / 2, size, size); c.restore();
            }
            for (let n = 0; n < 1400; n++) { c.fillStyle = rnd() > .5 ? '#ffffff12' : '#0000001a'; c.fillRect(rnd() * tw, rnd() * tw, 1 + rnd() * 6, 1); }
        });
        const liveRug = mesh(root, new THREE.CylinderGeometry(650, 650, 5, 64), material('#ffffff', { map: kilimMap, roughness: 1 }), [mx, 2.5, mz]); liveRug.name = 'Live-room round rug';
        liveRug.material.userData.roomSurface = 'fabric';
    }
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
    // Large-diaphragm condenser detail: shock mount, grille band and XLR run.
    const shock = mesh(mic, new THREE.TorusGeometry(40, 4, 8, 28), metal, [-245, 1535, -30]); shock.rotation.set(Math.PI / 2, 0, -.25);
    const grille = mesh(mic, new THREE.CylinderGeometry(25.5, 25.5, 46, 16), material('#3d4447', { metalness: .6, roughness: .5 }), [-235, 1574, -30]); grille.rotation.z = -.25;
    sphere(mic, [5, 5, 3], [-251, 1545, -6], brass);
    rod(mic, [-262, 1470, -30], [-30, 1400, 12], 5, cable); rod(mic, [-30, 1400, 12], [18, 1350, 14], 5, cable);
    rod(mic, [18, 1350, 14], [18, 80, 14], 5, cable); rod(mic, [18, 80, 14], [95, 12, 70], 5, cable);
    for (const [r, y] of [[78, 7], [70, 16]]) { const coil = mesh(mic, new THREE.TorusGeometry(r, 6, 6, 28), cable, [120, y, 95]); coil.rotation.x = Math.PI / 2; coil.castShadow = false; }

    // Tweed-era combo amp under the hanging guitar in the smaller studios.
    const jewel = material('#ff5a3c', { emissive: '#ff5a3c', emissiveIntensity: .6 });
    if (!layout.large) {
        const amp = new THREE.Group(); amp.name = 'Guitar combo amp'; amp.position.set(w / 2 - 160, 0, bz + 500); amp.rotation.y = -Math.PI / 2; root.add(amp);
        instrument(amp, 'music-guitar-amp', 'Guitar combo amp');
        const tolex = material('#1f1b18', { roughness: .82 }), grilleCloth = material('#b59d76', { map: fabricMap, roughness: 1 }), plate = material('#d2c8b3', { metalness: .65, roughness: .36 });
        tolex.userData.roomSurface = 'rubber'; grilleCloth.userData.roomSurface = 'fabric';
        box(amp, [520, 22, 220], [0, 11, 0], cable, 4);
        box(amp, [560, 440, 260], [0, 242, 0], tolex, 14);
        box(amp, [512, 272, 6], [0, 190, 129], grilleCloth, 3);
        box(amp, [524, 62, 6], [0, 404, 129], plate, 3);
        box(amp, [112, 24, 4], [-175, 292, 133], brass, 2);
        const turn = new THREE.Matrix4().makeRotationX(Math.PI / 2);
        mesh(amp, mergeParts(Array.from({ length: 7 }, (_, i) => ({ geometry: new THREE.CylinderGeometry(11, 12, 16, 16), matrix: new THREE.Matrix4().makeTranslation(-180 + i * 48, 404, 140).multiply(turn) }))), material('#efe3cb', { roughness: .4 }));
        sphere(amp, [9, 9, 6], [222, 404, 134], jewel);
        box(amp, [160, 18, 36], [0, 471, 0], cable, 8);
        // Low walnut credenza of LPs with a turntable, under the record wall.
        const vinyl = new THREE.Group(); vinyl.name = 'Vinyl credenza and turntable'; vinyl.position.set(w / 2 - 185, 0, bz + 1110); vinyl.rotation.y = -Math.PI / 2; root.add(vinyl);
        instrument(vinyl, 'music-vinyl-credenza', 'Vinyl credenza and turntable');
        for (const sx of [-230, 230]) for (const sz of [-135, 135]) rod(vinyl, [sx * 1.02, 0, sz * 1.03], [sx, 92, sz], 9, brass);
        box(vinyl, [520, 340, 340], [0, 260, 0], walnut, 6);
        box(vinyl, [540, 20, 352], [0, 440, 0], wood, 4);
        box(vinyl, [492, 300, 4], [0, 260, 169], felt);
        box(vinyl, [16, 304, 8], [0, 260, 171], walnut, 2);
        const palette = ['#151515', '#e6dcc6', '#b5512f', '#d9a44a', '#2f5d68', '#1f1f24', '#8a3b2c', '#c9c0ad'];
        const spines = Array.from({ length: 50 }, (_, i) => {
            const half = i < 25 ? -1 : 1, k = i % 25, tall = 262 + (i * 37 % 11) * 2;
            const matrix = new THREE.Matrix4().makeTranslation(half * (18 + k * 9.2), 112 + tall / 2, 172).multiply(new THREE.Matrix4().makeRotationZ((k === 24 ? .12 : 0) * half));
            return { geometry: new THREE.BoxGeometry(6.5, tall, 14), matrix, color: new THREE.Color(palette[(i * 5 + (i >> 2)) % palette.length]) };
        });
        mesh(vinyl, mergeParts(spines), material('#ffffff', { roughness: .5, vertexColors: true }));
        box(vinyl, [410, 70, 330], [0, 485, 0], wood, 8);
        mesh(vinyl, new THREE.CylinderGeometry(140, 140, 14, 40), metal, [-40, 527, 0]);
        mesh(vinyl, new THREE.CylinderGeometry(146, 146, 3, 40), material('#0e0e10', { roughness: .32, metalness: .2 }), [-40, 535, 0]);
        mesh(vinyl, new THREE.CylinderGeometry(42, 42, 2, 24), material('#d98a3a', { roughness: .6 }), [-40, 537, 0]);
        mesh(vinyl, new THREE.CylinderGeometry(18, 20, 28, 16), metal, [150, 534, -115]);
        rod(vinyl, [150, 548, -115], [70, 545, 72], 4, brass); box(vinyl, [22, 10, 34], [64, 542, 82], metal, 2);
        sphere(vinyl, [7, 7, 4], [170, 521, 150], jewel);
    }
    if (layout.large) {
        box(root, [2500, 5, 2200], [-400, 2.5, front - 1280], material('#cbc1ab', { map: rugMap, roughness: 1 }), 8);
        const coffeeCabinet=new THREE.Group();coffeeCabinet.name='Studio coffee cabinet';root.add(coffeeCabinet);
        box(coffeeCabinet,[560,25,510],[-w/2+370,12.5,bz+360],metal,3);
        box(coffeeCabinet, [650, 735, 600], [-w / 2 + 370, 392.5, bz + 360], trim, 8);
        box(coffeeCabinet, [680, 30, 630], [-w / 2 + 370, 775, bz + 360], wood, 4);
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
    instrument(art, 'music-waveform-art', 'Framed waveform artwork');
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
    // Brass picture light washes the waveform print.
    const artW = layout.compact ? 540 : 820;
    rod(art, [0, 300, 10], [0, 372, 78], 6, brass);
    const hood = mesh(art, new THREE.CylinderGeometry(22, 22, artW * .62, 20), brass, [0, 384, 92]); hood.rotation.set(0, 0, Math.PI / 2);
    strip(art, [artW * .58, 4, 22], [0, 366, 92]);
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
    // City view through the window: sun or moon, two skyline layers, lit
    // windows after dark and a tree line. Redrawn only when the mode changes.
    const drawSky = (modeId, mode) => {
        const c = skyCanvas.getContext('2d'), rnd = seeded(77), dark = modeId === 'night' || modeId === 'party', dusk = modeId === 'evening';
        const gradient = c.createLinearGradient(0, 0, 0, 512); gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        if (dark) {
            for (let n = 0; n < 70; n++) { c.fillStyle = `rgba(255,255,240,${.25 + rnd() * .6})`; c.fillRect(rnd() * 512, rnd() * 300, 1.5, 1.5); }
            c.fillStyle = '#f2ecd8'; c.beginPath(); c.arc(390, 96, 24, 0, Math.PI * 2); c.fill(); c.fillStyle = mode.sky[0]; c.beginPath(); c.arc(400, 88, 21, 0, Math.PI * 2); c.fill();
        } else {
            const [sx, sy, r] = modeId === 'morning' ? [120, 250, 34] : dusk ? [300, 370, 46] : [420, 70, 28];
            const sun = c.createRadialGradient(sx, sy, 0, sx, sy, r * 4); sun.addColorStop(0, dusk ? '#ffe0a8' : '#fffbe8'); sun.addColorStop(.25, dusk ? '#ffc078aa' : '#fff3d066'); sun.addColorStop(1, '#ffffff00');
            c.fillStyle = sun; c.fillRect(0, 0, 512, 512); c.fillStyle = dusk ? '#ffe2b0' : '#fffdf2'; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
        }
        const tones = { morning: ['#aebfc6', '#7d8f90'], afternoon: ['#a5b7c0', '#788a8c'], evening: ['#8c7c92', '#584a5e'], night: ['#24314a', '#141c2c'], party: ['#382b52', '#221a36'] }[modeId] || ['#a5b7c0', '#788a8c'];
        for (const [layer, color] of tones.entries()) {
            for (let x = -10; x < 512;) {
                const bw = 24 + rnd() * 42, bh = (layer ? 50 : 90) + rnd() * (layer ? 120 : 150), top = (layer ? 500 : 455) - bh;
                c.fillStyle = color; c.fillRect(x, top, bw, 520 - top);
                if (dark || dusk) for (let wy = top + 8; wy < 500; wy += 11) for (let wx = x + 5; wx < x + bw - 6; wx += 9) if (rnd() < (dark ? .32 : .14) / (layer ? 1 : 1.6)) { c.fillStyle = rnd() > .2 ? '#ffcf7a' : '#cfe3ff'; c.fillRect(wx, wy, 4, 5); }
                x += bw + 2 + rnd() * 8;
            }
        }
        c.fillStyle = dark ? '#0d1410' : dusk ? '#33362c' : '#5f7362';
        for (let x = 0; x < 540; x += 26) { c.beginPath(); c.arc(x, 512, 24 + (x * 7 % 13), Math.PI, 0); c.fill(); }
        skyMap.needsUpdate = true;
    };
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = MUSIC_MODES[modeId] || MUSIC_MODES.afternoon;
        session.mode = modeId in MUSIC_MODES ? modeId : 'afternoon'; session.accent = accent;
        drawSky(modeId, mode);
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .06 + mode.wash * accent * 1.25; });
        lights.forEach(spec => { if (spec.wash) spec.light.color.set(mode.colors[spec.channel]); spec.light.intensity = spec.power * (spec.wash ? mode.wash : mode.practical) * accent; });
        diffuser.emissiveIntensity = .2 + mode.practical * .65;
        onAirLamp.emissiveIntensity = .12 + mode.wash * .95 * accent;
        rackLamp.emissiveIntensity = .22 + mode.practical * .9 * accent;
        jewel.emissiveIntensity = .4 + mode.practical * 1.4 * accent;
        shades.forEach(shadeGlow);
        root.userData.atmosphere = modeId;
    };
    room.roomAtmosphere('afternoon');
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [wood, 'wood'], [metal, 'metal'], [moss, 'fabric'], [clay, 'fabric'], [curtain, 'fabric'],
        [walnut, 'wood'], [felt, 'fabric'], [brass, 'metal'], [cable, 'rubber'], [floor, 'wood'], [rug, 'fabric'], [fringe, 'fabric']]) mat.userData.roomSurface = surface;
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
