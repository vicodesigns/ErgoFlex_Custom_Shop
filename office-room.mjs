import * as THREE from 'three';

// Shared offices are intentionally larger than home rooms: each station has a
// real ErgoFlex desk, a chair, and an aisle. Architecture is in millimetres.
const sizes = [
    ['apartment', 'Two-person office', 4200, 4800, 2800, 2],
    ['house', 'Small team studio', 5800, 6000, 2900, 3],
    ['spacious', 'Design team office', 7000, 7200, 3000, 4],
    ['premium', 'Collaborative office', 8600, 8800, 3200, 5],
    ['executive', 'Flagship design studio', 10500, 10000, 3400, 6]
];
const roles = {
    drafter: { id: 'drafter', name: 'Drafting', height: 43.5, tilt: 39, plan: true,
        desktop: [{ id: 'metal-ruler', at: [-390, 1, 80], turn: 90 }, { id: 'ruler-set-square', at: [285, 1, 55] }, { id: 'apple-pencil', at: [100, 1, 240], turn: 80 }],
        shelf: [{ id: 'sketchbook', at: [-320, 0, 0] }, { id: 'paper-stand', at: [300, 0, 0] }] },
    designer: { id: 'designer', name: 'Digital design', height: 28, tilt: 0,
        desktop: [{ id: 'drawing-tablet', at: [-260, 0, 90] }, { id: 'apple-pencil', at: [-75, 0, 90], turn: 15 }, { id: 'office-keyboard', at: [190, 0, -170] }, { id: 'painted-mug', at: [440, 0, 160] }],
        shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }] },
    prototype: { id: 'prototype', name: 'Prototyping', height: 43.5, tilt: -5,
        desktop: [{ id: 'printer-3d', at: [-190, 0, -30] }, { id: 'sketchbook', at: [265, 0, 100], turn: -12 }],
        shelf: [{ id: 'kenney-furniture-books', at: [-290, 0, 0] }, { id: 'paper-holder', at: [260, 0, 0] }] },
    architect: { id: 'architect', name: 'Architecture', height: 43.5, tilt: 25, plan: true,
        desktop: [{ id: 'clipboard', at: [-330, 1, 65], turn: 12 }, { id: 'metal-ruler', at: [370, 1, -50], turn: 5 }],
        shelf: [{ id: 'paper-stand', at: [-300, 0, 0] }, { id: 'kenney-furniture-books', at: [280, 0, 0] }] },
    analyst: { id: 'analyst', name: 'Planning & research', height: 28, tilt: 0,
        desktop: [{ id: 'kenney-furniture-laptop', at: [-140, 0, -30] }, { id: 'papers', at: [320, 0, 100], turn: -12 }, { id: 'glasses', at: [305, 0, -170] }],
        shelf: [{ id: 'paper-holder', at: [-325, 0, 0] }, { id: 'office-phone', at: [300, 0, 0] }] }
};
export const OFFICE_LAYOUTS = Object.fromEntries(sizes.map(([id, name, width, depth, height, count], index) => {
    const back = -depth / 3, front = back + depth;
    const spread = index === 0 ? 1050 : index === 1 ? 1650 : index === 2 ? 1900 : index === 3 ? 2300 : 2700;
    const desk = [-spread, back + (index === 0 ? 1160 : 1000)];
    const positions = index === 4
        ? [[0, back + 1000], [spread, back + 1000], [-spread, back + 4000], [0, back + 4000], [spread, back + 4000]]
        : [[spread, back + (index === 0 ? 1160 : 1000)], [spread, back + 3800], [-spread, back + 3800], [spread, back + 6500]];
    const stations = Object.values(roles).slice(0, count - 1).map((role, i) => ({ ...role, at: positions[i] }));
    const props = [{ id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 1030], turn: 180 }];
    for (const station of stations) props.push({ id: 'steelcase-leap-v2', at: [station.at[0], 0, station.at[1] + 1050], turn: 180 });
    props.push({ id: 'monstera', at: [width / 2 - 510, 0, front - 550] });
    const lounge = index > 0 ? [-width / 2 + 1650, front - 550] : [0, front - 500];
    if (index === 0) {
        props.push({ id: 'armchair-leather', at: [-700, 0, front - 650], turn: 15 }, { id: 'coffee-table-2', at: [0, 0, front - 420] }, { id: 'journal', at: [-45, 700, front - 420] });
    } else {
        props.push({ id: 'kenney-furniture-lounge-sofa', at: [lounge[0], 0, lounge[1]] },
            { id: 'coffee-table', at: [lounge[0], 0, lounge[1] - 950] }, { id: 'journal', at: [lounge[0] - 270, 391.2, lounge[1] - 980] },
            { id: 'tea-cup', at: [lounge[0] + 290, 391.2, lounge[1] - 920] });
    }
    if (index === 4) for (const x of [900, 1800, 2700]) {
        props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, front - 2700], turn: 180 },
            { id: 'kenney-furniture-chair-modern-cushion', at: [x, 0, front - 900] });
    }
    props.push({ id: 'kenney-furniture-kitchen-coffee-machine', at: [0, 900, back + 250] });
    // Larger offices finish the lounge with one statement tree beside the sofa.
    if (index > 1) props.push({ id: 'potted-tree', at: [lounge[0] + 1530, 0, lounge[1]] });
    return [id, { id, name, width, depth, height, back, desk, stations, props, index, daylight: [-width / 2 + 100, back + depth * .45] }];
}));
export const officeLayoutById = id => OFFICE_LAYOUTS[id] || OFFICE_LAYOUTS.apartment;
export const officeLayoutForSize = size => OFFICE_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
// `lamp` drives decor lamps and LED strips, `strip` their colour and `city`
// the share of lit windows in the skyline outside.
export const OFFICE_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing focus', key: '#ffe9cc', fill: '#d9e9f3', accent: '#b4cebc', power: 1.7, ambient: .46, bounce: .66, exposure: 1.08, sky: ['#8fc1de', '#f7e6cc'], practical: .22, wash: .18, colors: ['#ecdab8', '#91beb1'], lamp: 0, strip: '#ffe7c4', city: 0, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Teamwork in daylight · seated work', key: '#fff3e2', fill: '#d7e7ed', accent: '#b6d7cb', power: 1.35, ambient: .46, bounce: .64, exposure: 1.08, sky: ['#9ccbe2', '#eef0e0'], practical: .4, wash: .35, colors: ['#efdbba', '#9bbfb2'], lamp: .08, strip: '#fff0d8', city: 0, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm task lights · review and sketching', key: '#f7bb88', fill: '#bccde2', accent: '#d2ab7e', power: .66, ambient: .29, bounce: .36, exposure: 1.13, sky: ['#6d7ea6', '#efae7f'], practical: .95, wash: .7, colors: ['#f1caa0', '#a3c4b8'], lamp: 1, strip: '#ffc786', city: .45, height: 43.5, tilt: 18, offset: [0, 100], yaw: 0, leds: true, color: '#ffdfa6' },
    night: { label: 'Night', description: 'Quiet focus · low ambient and task lighting', key: '#b3c7e0', fill: '#a8b8cf', accent: '#e7c193', power: .17, ambient: .16, bounce: .2, exposure: 1.16, sky: ['#0f2034', '#2f4864'], practical: 1.2, wash: .55, colors: ['#ecc79a', '#94bcb5'], lamp: 1.2, strip: '#ffcf92', city: 1, height: 28, tilt: 0, offset: [0, 120], yaw: 0, leds: true, color: '#ffe4b2' },
    party: { label: 'Team social', description: 'After hours · turn the main desk toward the team', key: '#d9cfc6', fill: '#b3c6e2', accent: '#71c6b5', power: .45, ambient: .27, bounce: .34, exposure: 1.12, sky: ['#2c3d62', '#9a7690'], practical: .65, wash: 1, colors: ['#8dd5bc', '#b2a2f2'], lamp: .85, strip: '#42d89c', city: .8, height: 43.5, tilt: -5, offset: [120, 300], yaw: -12, leds: true, color: '#42d89c' }
};
function canvasMap(draw, w = 512, h = 512) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
// Deterministic jitter keeps procedural dressing identical across rebuilds.
const jitter = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const BOOKS = ['#3f5f5a', '#b5835a', '#d9ccb2', '#5d6f86', '#8b4f45', '#c9a961', '#2f3b3d', '#7f9a87', '#e6dfd0'];
const GREENS = ['#4b7050', '#5b8156', '#3f6347', '#6c8b58', '#557a62'];
export function buildOfficeRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, index } = layout, front = bz + d;
    const plaster = material('#dfdcd2', { roughness: .94 }), teal = material('#466b67', { roughness: .8 });
    const oak = material('#a8895f', { roughness: .68 }), dark = material('#263b3d', { roughness: .55 }), bronze = material('#a39672', { metalness: .6, roughness: .36 });
    const linen = material('#e4ddcd', { roughness: 1, side: THREE.DoubleSide }), ceramic = material('#ece6da', { roughness: .4 }), sage = material('#8ea493', { roughness: .78 });
    const tint = material('#ffffff', { roughness: .82 }), glaze = material('#ffffff', { roughness: .38 }), leafy = material('#ffffff', { roughness: .7, side: THREE.DoubleSide }), soil = material('#3a3129', { roughness: 1 });
    const register = (obj, id, name) => { obj.userData.propId = id; obj.userData.sceneAssetName = name; markSceneAsset(obj, { key: `office:${layout.id}:fixture:${id}` }); };
    const group = (parent, name, at = [0, 0, 0], turn = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g); return g; };
    const noShadow = obj => { obj.castShadow = false; return obj; };
    // Repeated dressing (slats, books, mugs, leaves, notes) is instanced: one
    // draw call per batch, with per-instance colour on a white base material.
    const unit = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 18), pot = new THREE.CylinderGeometry(1, .76, 1, 20), leaf = new THREE.SphereGeometry(1, 10, 6);
    const euler = new THREE.Euler(0, 0, 0, 'YXZ'), quat = new THREE.Quaternion(), matrix = new THREE.Matrix4(), at = new THREE.Vector3(), size = new THREE.Vector3(), colour = new THREE.Color();
    // The batch sits at its instances' centroid so tools that only read the
    // base geometry bounds (Groove obstacles) still see it in the right place.
    const instanced = (parent, geometry, mat, items, shadow = true) => {
        const obj = new THREE.InstancedMesh(geometry, mat, items.length);
        items.forEach(item => obj.position.add(at.set(...item.at))); obj.position.divideScalar(items.length);
        items.forEach((item, i) => {
            euler.set(...(item.rot || [0, 0, 0])); matrix.compose(at.set(...item.at).sub(obj.position), quat.setFromEuler(euler), size.set(...(item.size || [1, 1, 1])));
            obj.setMatrixAt(i, matrix); if (item.color) obj.setColorAt(i, colour.set(item.color));
        });
        obj.instanceMatrix.needsUpdate = true; if (obj.instanceColor) obj.instanceColor.needsUpdate = true;
        obj.castShadow = shadow; obj.receiveShadow = true; obj.computeBoundingBox(); obj.computeBoundingSphere(); parent.add(obj); return obj;
    };
    // Leaves radiate from a stem top; each is a thin ellipsoid facing upward.
    const foliage = (items, base, count, { size: [lw, length] = [30, 180], spread = 1, seed = 0 } = {}) => {
        for (let i = 0; i < count; i++) {
            const az = i * 2.399 + seed, tilt = (.2 + .95 * i / count) * spread, l = length * (.75 + .45 * jitter(seed + i)) / 2;
            items.push({ at: [base[0] - Math.sin(tilt) * Math.cos(az) * l, base[1] + Math.cos(tilt) * l, base[2] + Math.sin(tilt) * Math.sin(az) * l],
                rot: [0, az, tilt], size: [5, l, lw * (.8 + .4 * jitter(seed + i + 9))], color: GREENS[(i + Math.round(seed)) % GREENS.length] });
        }
    };
    const plants = (parent, specs) => {
        const pots = [], tops = [], leaves = [];
        specs.forEach((p, n) => {
            const [r, ph] = p.pot, [x, y, z] = p.at;
            pots.push({ at: [x, y + ph / 2, z], size: [r, ph, r], color: p.color || '#ebe5d9' });
            tops.push({ at: [x, y + ph - 8, z], size: [r * .92, 6, r * .92] });
            foliage(leaves, [x, y + ph - 12, z], p.leaves || 10, { size: p.leaf, spread: p.spread, seed: n * 3.7 + x * .01 });
        });
        instanced(parent, pot, glaze, pots); instanced(parent, cyl, soil, tops, false); instanced(parent, leaf, leafy, leaves);
    };
    // Books stand along local x on a shelf at y, spines toward +z.
    const books = (items, x0, x1, y, z, depth, seed) => {
        let x = x0, i = 0;
        while (x < x1 - 18) {
            if (i % 8 === 5 && x + 240 < x1) {
                for (let k = 0; k < 3; k++) items.push({ at: [x + 112, y + 13 + k * 26, z], size: [215 - k * 16, 24, depth - k * 12], color: BOOKS[(i + k + seed) % BOOKS.length] });
                x += 250; i++; continue;
            }
            const t = 18 + jitter(seed * 7 + i) * 26, bh = 175 + jitter(seed * 7 + i + 40) * 85;
            if (x + t > x1) break;
            items.push({ at: [x + t / 2, y + bh / 2, z], size: [t, bh, depth - jitter(i + seed) * 30], color: BOOKS[(i * 5 + seed) % BOOKS.length] });
            x += t + 1.5 + (i % 13 === 12 ? 90 : 0); i++;
        }
    };
    const lamps = [], strips = [], glow = [];
    const lampMat = () => { const mat = material('#efe4cf', { emissive: '#ffd9a3', emissiveIntensity: 0, roughness: .95, side: THREE.DoubleSide }); lamps.push(mat); return mat; };
    const stripMat = () => { const mat = material('#fff0d8', { emissive: '#fff0d8', emissiveIntensity: 0 }); strips.push(mat); return mat; };

    // Wide oak boards with staggered joints; refinement adds wood relief.
    const floorMap = canvasMap((c, tw, th) => {
        c.fillStyle = '#c2a983'; c.fillRect(0, 0, tw, th);
        const boards = 8, bw = tw / boards, tones = ['#c4ae8e', '#bda784', '#c9b393', '#b8a281', '#c6b08f', '#c0aa88'];
        for (let i = 0; i < boards; i++) {
            let y = -jitter(i) * th, k = 0;
            while (y < th) {
                const len = th * (.42 + jitter(i * 13 + k) * .4), x = i * bw;
                for (const wrap of [0, th]) {
                    const top = y + wrap; if (top > th || top + len < 0) continue;
                    c.fillStyle = tones[(i * 3 + k) % tones.length]; c.fillRect(x + 1, top + 1, bw - 2, len - 2);
                    c.strokeStyle = 'rgba(112, 86, 52, .16)'; c.lineWidth = .8;
                    for (let g = 0; g < 9; g++) {
                        const gx = x + 6 + g * (bw - 12) / 8 + jitter(i + g * 5 + k) * 6;
                        c.beginPath(); c.moveTo(gx, top + 2); c.bezierCurveTo(gx + 5, top + len * .3, gx - 5, top + len * .7, gx + 2, top + len - 2); c.stroke();
                    }
                    if (jitter(i * 31 + k) > .55) { c.fillStyle = 'rgba(120, 88, 50, .18)'; c.beginPath(); c.ellipse(x + bw * (.3 + jitter(k + i) * .4), top + len * .5, 4, 9, 0, 0, Math.PI * 2); c.fill(); }
                    c.fillStyle = 'rgba(78, 60, 38, .55)'; c.fillRect(x, top, bw, 2);
                }
                y += len; k++;
            }
            c.fillStyle = 'rgba(78, 60, 38, .5)'; c.fillRect(i * bw, 0, 1.5, th);
        }
    }, 1024, 1024); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 1440, d / 1440); floorMap.anisotropy = 4;
    const floor = material('#ffffff', { map: floorMap, roughness: .6 });
    box(root, [w, 30, d], [0, -15, bz + d / 2], floor);
    // Wool rugs: the main desk gets a deep teal rug, team stations oatmeal.
    const rugMap = (base, edge, line) => canvasMap((c, tw, th) => {
        c.fillStyle = base; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 2600; i++) { c.fillStyle = jitter(i) > .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; c.fillRect(jitter(i + 3) * tw, jitter(i + 7) * th, 2, 2); }
        c.strokeStyle = edge; c.lineWidth = 18; c.strokeRect(30, 30, tw - 60, th - 60);
        c.strokeStyle = line; c.lineWidth = 3; c.strokeRect(58, 58, tw - 116, th - 116);
        c.setLineDash([10, 9]); c.strokeRect(70, 70, tw - 140, th - 140);
    });
    const mainRug = material('#ffffff', { map: rugMap('#3f6a63', '#2b4b46', '#c7d6c9'), roughness: 1 }), carpet = material('#ffffff', { map: rugMap('#b8b4a4', '#8e8a7b', '#6a7470'), roughness: 1 });
    for (const [i, spot] of [layout.desk, ...layout.stations.map(s => s.at)].entries()) {
        // Each rug and its floor plaque form one registered, movable furnishing.
        const rug = group(root, i === 0 ? 'Office main desk rug' : 'Office station rug', [spot[0], 0, spot[1] + 430]);
        register(rug, i === 0 ? 'office-rug-main' : `office-rug-${layout.stations[i - 1].id}`, i === 0 ? 'Main desk wool rug' : layout.stations[i - 1].name + ' rug');
        box(rug, [1800, 4, 1850], [0, 2, 0], i === 0 ? mainRug : carpet, 6);
        const labelMap = canvasMap(c => {
            c.fillStyle = i === 0 ? '#244942' : '#eef0e6'; c.fillRect(0, 0, 512, 128);
            c.fillStyle = i === 0 ? '#ffffff' : '#344c49'; c.font = 'bold 25px sans-serif'; c.textAlign = 'center';
            c.fillText(i === 0 ? 'MAIN · YOUR ERGOFLEX' : layout.stations[i - 1].name.toUpperCase(), 256, 78);
        }, 512, 128);
        const plaque = mesh(rug, new THREE.PlaneGeometry(650, 160), material('#ffffff', { map: labelMap, roughness: 1 }), [0, 5, 910]); plaque.rotation.x = -Math.PI / 2; plaque.castShadow = false;
    }

    // Presentation wall: teal wainscot, oak slats and cap rail, studio sign.
    const back = new THREE.Group(); back.name = 'Office presentation wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], plaster);
    box(back, [w, 1120, 34], [0, 560, bz + 17], teal);
    const slats = []; for (let x = -w / 2 + 60; x < w / 2; x += 120) slats.push({ at: [x, 550, bz + 40], size: [22, 1100, 12] });
    instanced(back, unit, oak, slats);
    box(back, [w, 28, 58], [0, 1134, bz + 29], oak, 3);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const brandMap = canvasMap(c => {
        c.fillStyle = '#466b67'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#f3f0e4'; c.font = 'bold 88px sans-serif'; c.fillText('MAKE / TOGETHER', 65, 124);
        c.font = '24px sans-serif'; c.fillText('DESIGN   ·   DRAFT   ·   BUILD   ·   CONNECT', 70, 189);
    }, 1024, 256);
    const signWidth = index === 0 ? 2200 : 2800;
    const brand = new THREE.Group(); brand.name = 'Office studio wall sign'; brand.position.set(0, 2250, bz + 42); back.add(brand);
    box(brand, [signWidth, 660, 30], [0, 0, 0], oak, 5);
    box(brand, [signWidth - 60, 600, 8], [0, 0, 20], material('#ffffff', { map: brandMap })); register(brand, 'office-sign', 'Make Together wall sign');
    // A brass picture light washes the sign after hours.
    for (const x of [-signWidth * .2, signWidth * .2]) noShadow(rod(brand, [x, 300, -10], [x, 395, 95], 6, bronze));
    noShadow(mesh(brand, new THREE.CylinderGeometry(22, 22, signWidth * .55, 16), bronze, [0, 400, 100])).rotation.z = Math.PI / 2;
    noShadow(box(brand, [signWidth * .53, 6, 22], [0, 380, 100], stripMat()));
    // Coffee bar: zellige-style tiles, an open oak shelf and a lit underside.
    const tileMap = canvasMap((c, tw, th) => {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const n = jitter(x * 17 + y * 5), shade = 228 - Math.round(n * 26);
            c.fillStyle = `rgb(${shade - 26}, ${shade - 6}, ${shade - 16})`; c.fillRect(x * 64 + 2, y * 32 + 2, 60, 28);
            c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x * 64 + 6, y * 32 + 5, 22 + n * 20, 4);
        }
    }, 512, 256); tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping; tileMap.repeat.set(1000 / 640, 560 / 320);
    const bar = group(back, 'Office coffee bar shelf', [0, 900, bz]); register(bar, 'office-coffee-shelf', 'Coffee bar tiles & open shelf');
    box(bar, [1000, 560, 10], [0, 280, 63], material('#ffffff', { map: tileMap, roughness: .28 }));
    box(bar, [1040, 30, 240], [0, 660, 188], oak, 4);
    noShadow(box(bar, [980, 5, 14], [0, 642, 290], stripMat()));
    instanced(bar, cyl, glaze, [[-455, 721], [-370, 721], [-412, 814]].map(([x, y], i) => ({ at: [x, y, 160], size: [38, 92, 38], color: ['#e9e3d6', '#466b67', '#d7b48c'][i] })));
    const jars = [[10, 170], [105, 130], [200, 190]];
    instanced(bar, cyl, material('#5a4232', { roughness: .9 }), jars.map(([x, jh]) => ({ at: [x, 675 + jh * .3, 170], size: [48, jh * .6, 48] })), false);
    instanced(bar, cyl, material('#dfe9e4', { roughness: .08, transparent: true, opacity: .35, depthWrite: false }), jars.map(([x, jh]) => ({ at: [x, 675 + jh / 2, 170], size: [54, jh, 54] })), false);
    instanced(bar, cyl, bronze, jars.map(([x, jh]) => ({ at: [x, 684 + jh, 170], size: [56, 18, 56] })));
    plants(bar, [{ at: [390, 675, 200], pot: [62, 120], leaves: 11, leaf: [30, 150], spread: 1.1, color: '#b57a5a' }]);
    const menu = canvasMap((c, tw, th) => {
        c.fillStyle = '#26383a'; c.fillRect(0, 0, tw, th); c.fillStyle = '#f0ead9'; c.textAlign = 'center';
        c.font = 'bold 34px sans-serif'; c.fillText('BREW BAR', tw / 2, 58); c.font = '19px sans-serif';
        ['flat white  ·  oat', 'pour over  ·  tea', 'refill & reset'].forEach((t, i) => c.fillText(t, tw / 2, 106 + i * 34));
    }, 256, 220);
    box(bar, [220, 190, 10], [-205, 772, 112], material('#ffffff', { map: menu, roughness: .9 })).rotation.x = -.14;
    // Wall clock and a pair of framed architectural prints balance the sign.
    const clockX = (signWidth / 2 + w / 2) / 2;
    const clock = group(back, 'Office wall clock', [clockX, 2150, bz]); register(clock, 'office-clock', 'Studio wall clock');
    const faceMap = canvasMap((c, tw) => {
        c.fillStyle = '#f2eee4'; c.fillRect(0, 0, tw, tw); c.translate(tw / 2, tw / 2);
        for (let i = 0; i < 60; i++) { c.fillStyle = '#2b3b3c'; c.fillRect(-(i % 5 ? 1.5 : 4), -tw * .44, i % 5 ? 3 : 8, i % 5 ? 12 : 30); c.rotate(Math.PI / 30); }
        c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('ERGOFLEX', 0, 70);
    }, 256, 256);
    noShadow(mesh(clock, new THREE.CylinderGeometry(185, 185, 30, 48), material('#ffffff', { map: faceMap, roughness: .6 }), [0, 0, 15])).rotation.x = Math.PI / 2;
    mesh(clock, new THREE.TorusGeometry(190, 14, 10, 48), dark, [0, 0, 32]);
    for (const [len, turn, width, z] of [[110, -1.05, 10, 34], [160, 2.2, 6, 37]]) { const hand = noShadow(box(clock, [width, len, 3], [Math.sin(-turn) * len / 2, Math.cos(turn) * len / 2, z], dark)); hand.rotation.z = turn; }
    noShadow(mesh(clock, new THREE.CylinderGeometry(12, 12, 10, 16), bronze, [0, 0, 40])).rotation.x = Math.PI / 2;
    const printMap = (seed, tone) => canvasMap((c, tw, th) => {
        c.fillStyle = '#f1ece0'; c.fillRect(0, 0, tw, th); c.strokeStyle = tone; c.fillStyle = tone;
        c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(tw / 2, th * .62, 40 + i * 26, Math.PI, Math.PI * 2); c.stroke(); }
        c.globalAlpha = .85; c.fillRect(tw * .18, th * .62, tw * .64, 10 + seed * 6); c.globalAlpha = 1;
        c.lineWidth = 1.5; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(tw * .18 + i * tw * .08, th * .62); c.lineTo(tw / 2, th * (.25 - seed * .04)); c.stroke(); }
        c.font = 'bold 15px sans-serif'; c.fillText(seed ? 'STUDY 02 · STRUCTURE' : 'STUDY 01 · ARCH', tw * .18, th * .9);
    }, 256, 320);
    const prints = group(back, 'Office framed prints', [-clockX, 2120, bz]); register(prints, 'office-prints', 'Framed architecture prints');
    for (const [i, x] of [-215, 215].entries()) {
        box(prints, [390, 490, 30], [x, 0, 15], i ? oak : dark, 3);
        box(prints, [330, 430, 6], [x, 0, 32], material('#ffffff', { map: printMap(i, i ? '#466b67' : '#b57a5a'), roughness: .9 }));
    }

    // Ideas wall: project pinboard with notes, floating library shelves.
    const side = new THREE.Group(); side.name = 'Office ideas wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], plaster); box(side, [22, 90, d], [w / 2 - 11, 45, bz + d / 2], oak);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    const boardZ = bz + d * .52;
    const board = new THREE.Group(); board.name = 'Office project pinboard'; board.position.set(w / 2 - 32, 1760, boardZ); board.rotation.y = -Math.PI / 2; side.add(board);
    box(board, [1900, 1080, 35], [0, 0, 0], oak, 4); box(board, [1840, 1020, 15], [0, 0, 24], material('#9b9f88', { roughness: 1 }));
    for (let i = 0; i < 6; i++) {
        const sheet = canvasMap(c => {
            c.fillStyle = '#f2ead7'; c.fillRect(0, 0, 512, 512); c.strokeStyle = ['#477b72', '#b79261', '#627e97'][i % 3]; c.lineWidth = 6;
            for (let k = 0; k < 4; k++) { c.strokeRect(55 + k * 80, 70 + k % 2 * 60, 65, 190 + k * 15); }
            c.fillStyle = '#385753'; c.font = 'bold 23px sans-serif'; c.fillText(['CONCEPT', 'MATERIALS', 'PLAN', 'DETAIL', 'STUDY', 'NEXT'][i], 55, 410);
        });
        box(board, [420, 360, 3], [-620 + i % 3 * 615, 240 - Math.floor(i / 3) * 475, 35], material('#ffffff', { map: sheet }));
    }
    const notes = [], pins = [];
    for (let i = 0; i < 18; i++) {
        const column = [-312, 302, -860, 860][i % 4], y = 380 - Math.floor(i / 4) * 175 + jitter(i) * 40;
        if (Math.abs(column) > 800 && Math.abs(y) > 300) continue;
        notes.push({ at: [column + (jitter(i + 4) - .5) * 60, y, 39], rot: [0, 0, (jitter(i + 9) - .5) * .25], size: [78, 78, 1.5], color: ['#f2d36b', '#f0a58a', '#a8dbc9', '#c9bdf0'][i % 4] });
    }
    for (let i = 0; i < 6; i++) pins.push({ at: [-620 + i % 3 * 615, 400 - Math.floor(i / 3) * 475, 42], size: [9, 9, 9], color: ['#c4523f', '#2f6f66', '#d8a23a'][i % 3] });
    instanced(board, unit, tint, notes, false); instanced(board, leaf, glaze, pins, false);
    register(board, 'office-pinboard', 'Team project pinboard');
    // Festoon string above the ideas wall: clear glass by day, warm after
    // hours and multicoloured for the team social. Unlit bulbs, no lights.
    const cable = [], sockets = [], bulbs = [], z0 = bz + 250, z1 = front - 250, swags = Math.max(2, Math.round((z1 - z0) / 1500)), span = (z1 - z0) / swags;
    const festoon = group(side, 'Office festoon string', [0, h - 220, 0]); register(festoon, 'office-festoon', 'Festoon string lights');
    const cableY = z => { const t = ((z - z0) % span) / span; return -160 * 4 * t * (1 - t); };
    for (let z = z0; z < z1 - 1; z += span / 10) {
        const za = z, zb = Math.min(z1, z + span / 10), ya = cableY(za), yb = zb >= z1 - 1 ? 0 : cableY(zb), len = Math.hypot(zb - za, yb - ya);
        cable.push({ at: [w / 2 - 40, (ya + yb) / 2, (za + zb) / 2], rot: [Math.atan2(zb - za, yb - ya), 0, 0], size: [3, len, 3] });
    }
    for (let z = z0 + 110; z < z1 - 60; z += 230) {
        const y = cableY(z); sockets.push({ at: [w / 2 - 40, y - 16, z], size: [9, 26, 9] }); bulbs.push({ at: [w / 2 - 40, y - 48, z], size: [24, 32, 24], color: '#ffffff' });
    }
    instanced(festoon, cyl, dark, cable, false); instanced(festoon, cyl, dark, sockets, false);
    const bulbMesh = instanced(festoon, leaf, new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs, false);
    const rear = Math.max(0, boardZ - 950 - bz), shelfLength = Math.min(1100, rear - 300);
    if (shelfLength > 600) {
        const shelf = group(side, 'Office floating library shelves', [w / 2, 1480, bz + rear / 2], -Math.PI / 2); register(shelf, 'office-bookshelf', 'Floating library shelves');
        const shelved = [], brackets = [];
        for (const [tier, y] of [0, 340].entries()) {
            box(shelf, [shelfLength, 28, 230], [0, y, 115], oak, 3);
            for (const x of [-shelfLength / 2 + 90, shelfLength / 2 - 90]) brackets.push({ at: [x, y - 60, 70], size: [10, 100, 130] });
            books(shelved, -shelfLength / 2 + 20, shelfLength / 2 - (tier ? 230 : 60), y + 14, 118, 190, tier * 4 + index);
        }
        instanced(shelf, unit, tint, shelved); instanced(shelf, unit, dark, brackets, false);
        plants(shelf, [{ at: [shelfLength / 2 - 120, 354, 170], pot: [60, 120], leaves: 16, leaf: [28, 130], spread: 1.9, color: '#e7e1d4' }]);
    }

    // Window wall: dark steel glazing, linen curtains and a sill of herbs.
    const windowWall = new THREE.Group(); windowWall.name = 'Office daylight wall'; root.add(windowWall);
    const wz = bz + d * .45, ww = index === 0 ? 2200 : Math.min(4200, d * .56), low = 850, wh = 1600, a = wz - ww / 2, b = wz + ww / 2;
    box(windowWall, [80, h, a - bz], [-w / 2 - 40, h / 2, (a + bz) / 2], plaster);
    box(windowWall, [80, h, front - b], [-w / 2 - 40, h / 2, (front + b) / 2], plaster);
    box(windowWall, [80, low, ww], [-w / 2 - 40, low / 2, wz], plaster);
    box(windowWall, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], plaster);
    const skyMap = canvasMap(() => {}); const skyCanvas = skyMap.image;
    const pane = mesh(windowWall, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (let z = a; z <= b + 1; z += ww / 3) box(windowWall, [60, wh + 35, 30], [-w / 2 + 15, low + wh / 2, z], dark);
    for (const y of [low, low + wh]) box(windowWall, [60, 35, ww + 45], [-w / 2 + 15, y, wz], dark);
    noShadow(box(windowWall, [24, 22, ww], [-w / 2 + 10, low + wh * .62, wz], dark));
    box(windowWall, [140, 32, ww + 90], [-w / 2 + 45, low - 16, wz], oak, 3);
    box(windowWall, [22, 90, d], [-w / 2 + 11, 45, bz + d / 2], oak);
    const drapes = group(windowWall, 'Office window curtains'), top = Math.min(h - 70, low + wh + 170);
    rod(drapes, [-w / 2 + 95, top, a - 560], [-w / 2 + 95, top, b + 560], 13, dark).castShadow = false;
    for (const [i, z] of [a - 300, b + 300].entries()) {
        const geometry = new THREE.PlaneGeometry(470, top - 50, 30, 1), p = geometry.attributes.position;
        for (let v = 0; v < p.count; v++) p.setZ(v, Math.sin((p.getX(v) / 470 + .5) * Math.PI * 7 + i) * 24);
        geometry.computeVertexNormals();
        const panel = mesh(drapes, geometry, linen, [-w / 2 + 100, (top + 30) / 2 + 10, z]); panel.rotation.y = Math.PI / 2;
    }
    const sill = group(windowWall, 'Office window sill herbs');
    plants(sill, [-.3, .05, .34].map((t, i) => ({ at: [-w / 2 + 72, low, wz + t * ww], pot: [44, 95], leaves: 9, leaf: [22, 170], spread: 1.1, color: ['#b57a5a', '#e7e1d4', '#466b67'][i] })));
    room.walls.push({ obj: windowWall, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    // Shared coffee cabinet with a tray of cups and a fruit bowl.
    const coffee = new THREE.Group(); coffee.name = 'Office coffee cabinet'; root.add(coffee); register(coffee, 'office-coffee-bar', 'Shared coffee cabinet');
    box(coffee, [1000, 865, 500], [0, 432.5, bz + 250], teal, 5); box(coffee, [1050, 35, 530], [0, 882.5, bz + 265], oak, 5);
    for (const x of [-245, 245]) { box(coffee, [460, 775, 18], [x, 440, bz + 510], dark, 3); rod(coffee, [x, 710, bz + 528], [x, 760, bz + 528], 7, bronze); }
    box(coffee, [300, 14, 190], [-330, 907, bz + 330], oak, 4);
    instanced(coffee, cyl, glaze, [[-385, '#e9e3d6'], [-275, '#466b67']].map(([x, c]) => ({ at: [x, 948, bz + 330], size: [36, 68, 36], color: c })));
    mesh(coffee, new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), material('#e8e0d0', { roughness: .4, side: THREE.DoubleSide }), [330, 980, bz + 300]).scale.set(150, 80, 150);
    instanced(coffee, leaf, glaze, [[-50, 0, '#e9a13b'], [45, 30, '#e3962f'], [0, -55, '#9cbf4a'], [60, -40, '#e9a13b'], [-40, 55, '#d8c04a']].map(([x, z, c], i) => ({ at: [330 + x, 950 + (i > 2 ? 30 : 0), bz + 300 + z], size: [42, 40, 42], color: c })));

    // Low credenza along the ideas wall wherever the stations leave room.
    const busy = [layout.desk, ...layout.stations.map(s => s.at)].filter(([x]) => x + 800 > w / 2 - 450).map(([, z]) => [z - 650, z + 1450]);
    busy.push([front - 1000, front]);
    const free = []; let cursor = bz + 100;
    for (const [s, e] of busy.sort((p, q) => p[0] - q[0])) { if (s > cursor) free.push([cursor, s]); cursor = Math.max(cursor, e); }
    if (front - 100 > cursor) free.push([cursor, front - 100]);
    const gap = free.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
    if (gap && gap[1] - gap[0] >= 950) {
        const length = Math.min(1500, gap[1] - gap[0] - 150);
        const credenza = group(root, 'Office low credenza', [w / 2 - 215, 0, (gap[0] + gap[1]) / 2], -Math.PI / 2); register(credenza, 'office-credenza', 'Oak & sage storage credenza');
        const fluted = canvasMap((c, tw, th) => {
            c.fillStyle = '#93a897'; c.fillRect(0, 0, tw, th);
            for (let x = 0; x < tw; x += 16) { const g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, 'rgba(0,0,0,.14)'); g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); c.fillStyle = g; c.fillRect(x, 0, 16, th); }
        }, 256, 64); fluted.wrapS = THREE.RepeatWrapping; fluted.repeat.set(length / 400, 1);
        for (const x of [-length / 2 + 60, length / 2 - 60]) for (const z of [-140, 140]) rod(credenza, [x, 0, z], [x, 140, z], 14, dark);
        box(credenza, [length, 460, 400], [0, 370, 0], oak, 6);
        box(credenza, [length - 30, 420, 8], [0, 370, 202], material('#ffffff', { map: fluted, roughness: .8 }));
        const doors = Math.max(2, Math.round(length / 450));
        for (let i = 1; i < doors; i++) noShadow(box(credenza, [4, 420, 4], [-length / 2 + 15 + i * (length - 30) / doors, 370, 207], dark));
        box(credenza, [length + 20, 24, 420], [0, 612, 0], oak, 4);
        instanced(credenza, unit, tint, [0, 1, 2].map(k => ({ at: [-length / 2 + 200, 637 + k * 26, 20], rot: [0, (k - 1) * .12, 0], size: [230 - k * 18, 24, 170 - k * 10], color: BOOKS[k * 3 % BOOKS.length] })));
        mesh(credenza, new THREE.CylinderGeometry(55, 80, 140, 20), ceramic, [length / 2 - 140, 694, 10]);
        instanced(credenza, unit, sage, [0, 1, 2, 3, 4, 5, 6].map(i => ({ at: [length / 2 - 140 + (i - 3) * 14, 900, 10 + (i % 2) * 14], rot: [0, 0, (i - 3) * .09], size: [5, 380, 5] })), false);
        const lamp = group(credenza, 'Credenza table lamp', [length / 2 - 380, 624, 30]);
        mesh(lamp, new THREE.SphereGeometry(80, 20, 14), ceramic, [0, 80, 0]).scale.y = 1.05;
        noShadow(rod(lamp, [0, 160, 0], [0, 260, 0], 7, bronze));
        noShadow(mesh(lamp, new THREE.CylinderGeometry(105, 135, 180, 28, 1, true), lampMat(), [0, 320, 0]));
    }

    // Lounge: patterned rug and a reading floor lamp beside the seating.
    const loungeAt = index ? [-w / 2 + 1650, front - 550] : [-350, front - 500];
    const lounge = group(root, 'Office lounge rug'); register(lounge, 'office-lounge-rug', 'Lounge wool rug');
    const loungeMap = canvasMap((c, tw, th) => {
        c.fillStyle = '#e6dfcf'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 2600; i++) { c.fillStyle = jitter(i) > .5 ? 'rgba(255,255,255,.08)' : 'rgba(80,60,40,.06)'; c.fillRect(jitter(i + 3) * tw, jitter(i + 7) * th, 2, 2); }
        c.strokeStyle = '#466b67'; c.lineWidth = 26; c.strokeRect(34, 34, tw - 68, th - 68);
        c.strokeStyle = '#c38a62'; c.lineWidth = 4; c.strokeRect(62, 62, tw - 124, th - 124);
        c.fillStyle = 'rgba(70,107,103,.18)'; for (let x = 90; x < tw - 90; x += 36) c.fillRect(x, 90, 12, th - 180);
    }, 512, 384);
    const [rugW, rugD] = index ? [2600, 1900] : [1800, 1150], rugZ = index ? front - 1150 : front - 640;
    box(lounge, [rugW, 4, rugD], [loungeAt[0] - (index ? 0 : 100), 2, rugZ], material('#ffffff', { map: loungeMap, roughness: 1 }), 6);
    const lampAt = index ? [loungeAt[0] - 1260, front - 520] : [-1750, front - 250];
    const floorLamp = group(root, 'Office floor lamp', [lampAt[0], 0, lampAt[1]]); register(floorLamp, 'office-floor-lamp', 'Linen floor lamp');
    mesh(floorLamp, new THREE.CylinderGeometry(150, 160, 20, 32), dark, [0, 10, 0]);
    rod(floorLamp, [0, 20, 0], [0, 1420, 0], 11, bronze);
    noShadow(mesh(floorLamp, new THREE.CylinderGeometry(180, 215, 290, 32, 1, true), lampMat(), [0, 1490, 0]));
    noShadow(mesh(floorLamp, new THREE.CylinderGeometry(150, 150, 4, 24), lampMat(), [0, 1350, 0]));

    if (index >= 2) {
        const divider = new THREE.Group(); divider.name = 'Office acoustic planter divider'; divider.position.set(0, 0, bz + 2600); root.add(divider); register(divider, 'office-divider', 'Acoustic divider & planter');
        for (const x of [-600, 600]) { box(divider, [220, 30, 440], [x, 15, 0], dark, 3); box(divider, [35, 60, 35], [x, 30, 0], dark, 2); }
        box(divider, [1480, 1050, 70], [0, 585, 0], material('#89978c', { roughness: 1 }), 8);
        box(divider, [1550, 200, 260], [0, 1190, 0], oak, 6); box(divider, [1470, 8, 210], [0, 1294, 0], material('#423c32'));
        const leaves = [], stems = [];
        for (let x = -630; x <= 630; x += 105) for (let j = 0; j < 3; j++) {
            const tip = [x + (j - 1) * 22, 1450 + j * 38, 0], dx = tip[0] - x, dy = tip[1] - 1298, len = Math.hypot(dx, dy);
            stems.push({ at: [x + dx / 2, 1298 + dy / 2, 0], rot: [0, 0, -Math.atan2(dx, dy)], size: [3, len, 3] });
            leaves.push({ at: [x + (j - 1) * 25, 1440 + j * 38, j % 2 * 15], rot: [0, 0, (j - 1) * .5], size: [28, 70, 10], color: GREENS[(x / 105 + j + 7) % GREENS.length | 0] });
        }
        instanced(divider, cyl, teal, stems, false); instanced(divider, leaf, leafy, leaves);
    }
    if (index === 4) {
        const meeting = new THREE.Group(); meeting.name = 'Office team review table'; meeting.position.set(1800, 0, front - 1800); root.add(meeting); register(meeting, 'office-review-table', 'Six-person team review table');
        box(meeting, [2600, 40, 1100], [0, 720, 0], oak, 12);
        for (const x of [-1000, 1000]) { box(meeting, [80, 700, 650], [x, 350, 0], dark, 4); box(meeting, [650, 35, 780], [x, 17.5, 0], dark, 4); }
        box(meeting, [1800, 3, 360], [0, 741.5, 0], material('#e7e5d8'), 2);
        for (const x of [-660, 0, 660]) box(meeting, [240, 4, 170], [x, 745, 0], teal, 2);
        plants(meeting, [-330, 330].map(x => ({ at: [x, 743, 0], pot: [60, 110], leaves: 10, leaf: [26, 200], spread: 1.1 })));
    }
    const ceiling = new THREE.Group(); ceiling.name = 'Office linear pendant lights'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const spot of [layout.desk, ...layout.stations.map(s => s.at)]) {
        const [x, z] = spot;
        for (const xx of [x - 440, x + 440]) rod(ceiling, [xx, h, z], [xx, h - 420, z], 3, bronze);
        box(ceiling, [1300, 70, 135], [x, h - 440, z], dark, 5);
        const mat = material('#f1dfbc', { emissive: '#f1dfbc', emissiveIntensity: .3 }); glow.push(mat);
        box(ceiling, [1240, 8, 100], [x, h - 480, z], mat, 3).castShadow = false;
    }
    const lights = [
        { at: [layout.desk[0], 2050, layout.desk[1] + 180], task: true, power: 4, range: 3800 },
        { at: [layout.stations[0].at[0], 2050, layout.stations[0].at[1] + 180], task: true, power: 4, range: 3800 },
        { at: [0, 2200, bz + d * .56], task: false, power: 5.5, range: d * .85 },
        { at: [lampAt[0] + 300, 1450, lampAt[1] - 250], task: false, lamp: true, power: 4, range: 4200 }
    ].map(spec => { const light = new THREE.PointLight('#efd8b5', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.decorateStation = (mount, spec) => {
        const plan = canvasMap(c => {
            c.fillStyle = '#eee9d6'; c.fillRect(0, 0, 1024, 640); c.strokeStyle = '#839c9a'; c.lineWidth = .6;
            for (let x = 0; x < 1024; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 640); c.stroke(); }
            for (let y = 0; y < 640; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(1024, y); c.stroke(); }
            c.strokeStyle = '#315e69'; c.lineWidth = 5;
            c.strokeRect(170, 110, 620, 365); c.strokeRect(190, 130, 200, 175); c.strokeRect(410, 130, 360, 175); c.strokeRect(190, 330, 580, 125);
            c.lineWidth = 2; c.strokeRect(130, 70, 700, 450);
            c.fillStyle = '#315e69'; c.font = 'bold 28px sans-serif'; c.fillText(spec.id === 'drafter' ? '01 / WORKSPACE PLAN' : '02 / ARCHITECTURAL STUDY', 150, 580);
        }, 1024, 640);
        const sheet = mesh(mount, new THREE.PlaneGeometry(600, 375), material('#ffffff', { map: plan, roughness: 1, side: THREE.DoubleSide }), [0, 1, 40]); sheet.rotation.x = -Math.PI / 2; sheet.castShadow = false;
    };
    // The view outside follows the daypart: sun or moon, clouds or stars, and
    // a two-layer skyline whose windows light up after hours.
    const drawSky = (modeId, mode) => {
        const c = skyCanvas.getContext('2d'), dark = mode.city > .7, gradient = c.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        const [sx, sy, tone] = { morning: [110, 290, '255,244,214'], evening: [330, 330, '255,196,140'], night: [400, 95, '232,238,247'], party: [110, 100, '238,226,255'] }[modeId] || [400, 80, '255,253,242'];
        const halo = c.createRadialGradient(sx, sy, 0, sx, sy, dark ? 70 : 230); halo.addColorStop(0, `rgba(${tone},1)`); halo.addColorStop(dark ? .2 : .1, `rgba(${tone},.85)`); halo.addColorStop(1, `rgba(${tone},0)`);
        c.fillStyle = halo; c.fillRect(0, 0, 512, 512);
        if (dark) for (let i = 0; i < 46; i++) { c.fillStyle = `rgba(255,255,255,${.25 + jitter(i) * .55})`; c.fillRect(jitter(i + 7) * 512, jitter(i + 19) * 250, 1.6, 1.6); }
        else for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(255,255,255,${modeId === 'evening' ? .18 : .4})`; c.beginPath(); c.ellipse(jitter(i + 2) * 560 - 20, 50 + jitter(i + 5) * 170, 50 + jitter(i) * 70, 11 + jitter(i + 1) * 9, 0, 0, Math.PI * 2); c.fill(); }
        const layers = dark ? ['#24364b', '#162433'] : modeId === 'evening' ? ['#8a87a0', '#5f5b70'] : ['#a9bec3', '#8aa1a6'];
        layers.forEach((fill, layer) => {
            let x = -8, i = layer * 50;
            while (x < 512) {
                const bw = 28 + jitter(i) * 46, bh = (layer ? 95 : 150) + jitter(i + 3) * (layer ? 120 : 170), y = 512 - bh;
                c.fillStyle = fill; c.fillRect(x, y, bw, bh);
                for (let wy = y + 8; wy < 500; wy += 13) for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
                    const n = jitter(wx * 3.1 + wy * 7.7 + layer);
                    if (n < mode.city * .55) c.fillStyle = modeId === 'party' && n < .08 ? '#9be7cf' : `rgba(255,${200 + Math.round(n * 60)},140,${.55 + n * .45})`;
                    else c.fillStyle = dark ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.16)';
                    c.fillRect(wx, wy, 4, 6);
                }
                x += bw + 3 + jitter(i + 8) * 10; i++;
            }
        });
        c.fillStyle = dark ? '#132019' : modeId === 'evening' ? '#46523f' : '#6c8a62';
        for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(i * 31 + jitter(i) * 12, 505 - jitter(i + 4) * 18, 22 + jitter(i + 6) * 16, 0, Math.PI * 2); c.fill(); }
        skyMap.needsUpdate = true;
    };
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = OFFICE_MODES[modeId] || OFFICE_MODES.afternoon, lampLevel = mode.lamp ?? mode.practical;
        drawSky(modeId, mode);
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .15 + mode.practical * accent; });
        lamps.forEach(mat => { mat.emissiveIntensity = lampLevel * 1.1 * accent; });
        strips.forEach(mat => { mat.color.set(mode.strip); mat.emissive.set(mode.strip); mat.emissiveIntensity = .05 + lampLevel * 1.6 * accent; });
        const party = ['#42d89c', '#ff8fc8', '#ffd27a', '#8fb4ff'], warm = colour.set('#ffd49a').multiplyScalar(Math.min(1, .45 + lampLevel * .5 * accent)).getHex();
        for (let i = 0; i < bulbMesh.count; i++) bulbMesh.setColorAt(i, colour.set(lampLevel < .3 ? '#d9d4c8' : modeId === 'party' ? party[i % 4] : warm));
        bulbMesh.instanceColor.needsUpdate = true;
        lights.forEach(spec => {
            spec.light.color.set(spec.task ? '#efd8b5' : spec.lamp ? (lampLevel > .3 ? '#ffd3a0' : mode.colors[1]) : mode.colors[1]);
            spec.light.intensity = spec.power * (spec.task ? mode.practical : spec.lamp ? Math.max(mode.wash * .55, lampLevel * .8) : mode.wash) * accent;
        });
        root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[plaster, 'plaster'], [teal, 'powder'], [oak, 'wood'], [dark, 'powder'], [bronze, 'metal'], [carpet, 'fabric'], [mainRug, 'fabric'], [floor, 'wood'], [linen, 'fabric'], [sage, 'powder']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
