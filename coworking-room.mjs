import * as THREE from 'three';

// Measured shared spaces. Millimetres throughout, with usable aisles and
// native-size library furniture. The active ErgoFlex is the rear-left station.
const sizes = [
    ['apartment', 'Neighbourhood work lounge', 5400, 6800, 3000, 2],
    ['house', 'Community workspace', 7200, 8200, 3100, 3],
    ['spacious', 'Co-working hub', 9000, 10000, 3300, 4],
    ['premium', 'Members club workspace', 11000, 12000, 3600, 5],
    ['executive', 'Flagship co-working floor', 14000, 15000, 4200, 6]
];
const roles = [
    { id: 'digital', name: 'Digital creator', height: 28, tilt: 0,
        desktop: [{ id: 'drawing-tablet', at: [-240, 0, 90] }, { id: 'apple-pencil', at: [-40, 0, 90], turn: 15 }, { id: 'office-keyboard', at: [240, 0, -155] }], shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }] },
    { id: 'remote', name: 'Remote collaborator', height: 43.5, tilt: -5,
        desktop: [{ id: 'kenney-furniture-laptop', at: [-150, 0, 0] }, { id: 'glasses', at: [260, 0, 110] }], shelf: [{ id: 'kenney-furniture-books', at: [-300, 0, 0] }] },
    { id: 'illustrator', name: 'Illustrator', height: 43.5, tilt: 25, plan: true,
        desktop: [{ id: 'metal-ruler', at: [-350, 1, 70], turn: 90 }, { id: 'apple-pencil', at: [280, 1, 140], turn: 70 }], shelf: [{ id: 'paper-stand', at: [300, 0, 0] }] },
    { id: 'research', name: 'Research & writing', height: 28, tilt: 0,
        desktop: [{ id: 'kenney-furniture-laptop', at: [-120, 0, 0] }, { id: 'journal', at: [300, 0, 150] }], shelf: [{ id: 'paper-holder', at: [-300, 0, 0] }] },
    { id: 'founder', name: 'Founder', height: 43.5, tilt: -5,
        desktop: [{ id: 'office-keyboard', at: [-100, 0, 90] }, { id: 'magic-mouse', at: [340, 0, 80] }], shelf: [{ id: 'curved-monitor', at: [0, 0, 0] }] }
];
export const COWORKING_LAYOUTS = Object.fromEntries(sizes.map(([id, name, width, depth, height, count], index) => {
    const back = -depth / 3, front = back + depth, left = -width / 2 + 1200, right = -left;
    const desk = [left, back + 1100];
    const positions = [[right, back + 1100], [left, back + 3900], [right, back + 3900], [0, back + 1100], [0, back + 3900]];
    const stations = roles.slice(0, count - 1).map((role, i) => ({ ...role, at: positions[i] }));
    const lounge = [-width / 2 + (index === 0 ? 700 : 1450), front - (index === 0 ? 850 : 650)];
    const meeting = index > 0 ? [width / 2 - 2000, front - 2300] : [width / 2 - 950, front - 1200];
    // The premium call booth stands beside the café rather than inside it.
    const cafe = [width / 2 - 350, back + (index === 3 ? 5600 : index > 1 ? 6600 : 3450)];
    const focus = index >= 2 ? [-width / 2 + 850, front - 3300] : null;
    const call = index >= 3 ? [width / 2 - 800, front - (index === 3 ? 4300 : 5100)] : null;
    const props = [{ id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 1050], turn: 180 }];
    for (const s of stations) props.push({ id: 'steelcase-leap-v2', at: [s.at[0], 0, s.at[1] + 1050], turn: 180 });
    if (index === 0) props.push({ id: 'kenney-furniture-lounge-chair', at: [lounge[0], 0, lounge[1]] });
    else props.push({ id: 'kenney-furniture-lounge-sofa', at: [lounge[0], 0, lounge[1]] },
        { id: 'coffee-table', at: [lounge[0], 0, lounge[1] - 980] },
        { id: 'journal', at: [lounge[0] - 270, 391.2, lounge[1] - 1000] }, { id: 'tea-cup', at: [lounge[0] + 290, 391.2, lounge[1] - 950] });
    if (index === 0) for (const dx of [-600, 600]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [meeting[0] + dx, 0, meeting[1]], turn: dx < 0 ? 90 : -90 });
    else for (const dx of [-650, 650]) for (const dz of [-900, 900]) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [meeting[0] + dx, 0, meeting[1] + dz], turn: dz > 0 ? 180 : 0 });
    props.push({ id: 'kenney-furniture-kitchen-coffee-machine', at: [cafe[0], 900, cafe[1] - 550], turn: -90 },
        { id: 'tea-cup', at: [cafe[0] - 60, 900, cafe[1] + 50] }, { id: 'decor-plant1', at: [cafe[0], 900, cafe[1] + 750] },
        { id: 'monstera', at: [width / 2 - 530, 0, front - 550] });
    if (focus) props.push({ id: 'kenney-furniture-chair-modern-cushion', at: [focus[0], 0, focus[1] + 280], turn: 180 },
        { id: 'kenney-furniture-laptop', at: [focus[0], 740, focus[1] - 480] });
    return [id, { id, name, width, depth, height, back, index, desk, stations, lounge, meeting, cafe, focus, call, props, daylight: [-width / 2 + 100, back + depth * .4] }];
}));
export const coworkingLayoutById = id => COWORKING_LAYOUTS[id] || COWORKING_LAYOUTS.apartment;
export const coworkingLayoutForSize = size => COWORKING_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
// sun: [elevation, sweep, strength] of the window light on the floor (matches
// the shared daylight rig); festoon/pools drive the string lights and light
// pools; blinds is how far the window roller blinds are drawn.
export const COWORKING_MODES = {
    morning: { label: 'Morning', description: 'Arrive & focus · daylight and standing work', key: '#ffe8c6', fill: '#d4e5ee', accent: '#c0d6c5', power: 1.6, ambient: .44, bounce: .62, exposure: 1.06, sky: ['#7db3d6', '#fbe2bd'], practical: .18, wash: .2, colors: ['#ffe4b5', '#96c7b5'], sun: [.62, -.36, .17], festoon: .1, pools: 0, blinds: .22, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Shared ideas · seated work and collaboration', key: '#fff5e6', fill: '#dcecf3', accent: '#c6dccc', power: 1.4, ambient: .5, bounce: .7, exposure: 1.06, sky: ['#9cc8e0', '#f1eedf'], practical: .3, wash: .3, colors: ['#f5e2bc', '#aecac4'], sun: [1.45, .12, .12], festoon: .06, pools: 0, blinds: .42, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden hour · warm pendants and creative work', key: '#ffbe82', fill: '#adbfd6', accent: '#e2a46f', power: .92, ambient: .3, bounce: .42, exposure: 1.12, sky: ['#59789f', '#f4a468'], practical: .9, wash: .7, colors: ['#ffc98c', '#a3c5ba'], sun: [.32, .48, .24], festoon: .9, pools: .55, blinds: .1, height: 43.5, tilt: 18, offset: [0, 100], yaw: 0, leds: true, color: '#ffdfa6' },
    night: { label: 'Night', description: 'Quiet hours · task lighting and low ambient', key: '#a3b8d8', fill: '#8496b8', accent: '#e2b78b', power: .2, ambient: .14, bounce: .2, exposure: 1.2, sky: ['#0b1729', '#2b4561'], practical: 1.15, wash: .5, colors: ['#f2c08c', '#a6b7c4'], sun: [1.8, -.1, 0], festoon: .95, pools: 1, blinds: .62, height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#ffe2b0' },
    party: { label: 'Community social', description: 'Meet & connect · café lighting and an open desk', key: '#ecc9ae', fill: '#aab5d8', accent: '#d98a92', power: .4, ambient: .27, bounce: .36, exposure: 1.15, sky: ['#3b4c7a', '#cf8e83'], practical: .65, wash: 1.05, colors: ['#ffb67c', '#e59aa8'], sun: [1.35, .25, 0], festoon: 1.5, pools: .8, blinds: .35, height: 43.5, tilt: -5, offset: [150, 320], yaw: -14, leds: true, color: '#ffab74' }
};
// Window skyline tones per daypart: far haze, near towers, street trees.
const SKYLINE = {
    morning: ['#a9bccb', '#8196a5', '#5f7d5c'], afternoon: ['#b6c8d1', '#8ea3ad', '#68875c'],
    evening: ['#a4889a', '#5c5468', '#3b4638'], night: ['#1d2d43', '#121f2c', '#0b141c'], party: ['#5f5c80', '#383852', '#262e2a']
};
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function canvasMap(draw, w = 512, h = 512) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}
export function buildCoworkingRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, index, cafe, meeting, lounge, focus, call } = layout, front = bz + d;
    const chalk = material('#e6e1d6', { roughness: .92 }), sage = material('#6d8781', { roughness: .9 }), ink = material('#263d46', { roughness: .55 });
    const oak = material('#b49166', { roughness: .72 }), clay = material('#b87962', { roughness: .88 }), brass = material('#b39a6c', { metalness: .65, roughness: .32 });
    const ceramic = material('#ece6da', { roughness: .38 }), soil = material('#3d342b', { roughness: 1 }), bark = material('#6b5844', { roughness: .9 });
    // White bases: repeated dressing takes its colour per instance.
    const tinted = material('#ffffff', { roughness: .7 }), felt = material('#ffffff', { roughness: 1 }), foliage = material('#ffffff', { roughness: .6 });
    const register = (obj, id, name) => { obj.userData.propId = id; obj.userData.sceneAssetName = name; markSceneAsset(obj, { key: `coworking:${layout.id}:fixture:${id}` }); };
    const group = (id, name, at = [0, 0, 0], parent = root) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g); register(g, id, name); return g; };
    const noShadow = obj => { obj.castShadow = false; return obj; };
    // Repeated items (battens, leaves, jars, cups, felt, bulbs) are instanced:
    // one draw call per batch. The batch sits at its instances' centroid so
    // tools that read base geometry bounds still find it in the right place.
    const unit = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 18), potGeo = new THREE.CylinderGeometry(1, .78, 1, 20), ball = new THREE.SphereGeometry(1, 10, 7);
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(0, 0, 0, 'YXZ'), vec = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    const batch = (parent, geometry, mat, items, shadow = false) => {
        if (!items.length) return null;
        const obj = new THREE.InstancedMesh(geometry, mat, items.length), coloured = items.some(item => item.color);
        items.forEach(item => obj.position.add(vec.set(...item.at))); obj.position.divideScalar(items.length);
        items.forEach((item, i) => {
            if (item.dir) quat.setFromUnitVectors(up, vec.set(...item.dir).normalize()); else quat.setFromEuler(euler.set(...(item.rot || [0, 0, 0])));
            m4.compose(vec.set(...item.at).sub(obj.position), quat, scl.set(...(item.size || [1, 1, 1]))); obj.setMatrixAt(i, m4);
            if (coloured) obj.setColorAt(i, tint.set(item.color || '#ffffff'));
        });
        obj.instanceMatrix.needsUpdate = true; if (obj.instanceColor) obj.instanceColor.needsUpdate = true;
        obj.castShadow = shadow; obj.receiveShadow = true; obj.computeBoundingBox(); obj.computeBoundingSphere(); parent.add(obj); return obj;
    };
    // Leaves radiate from a stem point; each is a thin ellipsoid along its direction.
    const greens = ['#4f7761', '#5f8a63', '#3f6650', '#6f9868', '#557f5a'];
    // face: [axis, sign] keeps leaves on the room side of a wall or window.
    const leafSpray = (items, [x, y, z], count, { size: [lw, len] = [40, 150], spread = 1, seed = 0, droop = 0, face = null } = {}) => {
        for (let i = 0; i < count; i++) {
            const az = i * 2.399 + seed, tilt = Math.min(2.7, (.25 + .95 * i / count) * spread + droop * hash(seed + i)), l = len * (.75 + .5 * hash(seed * 7 + i)) / 2;
            const dir = [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
            if (face) dir[face[0]] = Math.abs(dir[face[0]]) * face[1];
            items.push({ at: [x + dir[0] * l, y + dir[1] * l, z + dir[2] * l], dir, size: [lw, l, lw * .22], color: greens[Math.abs(Math.round(i + seed)) % greens.length] });
        }
    };
    // Additive light pools fake the falloff of lamps on walls and floor; they
    // are lit by the mode (pools) and never cast or receive shadows.
    const poolMap = canvasMap((c, tw, th) => { const g = c.createRadialGradient(tw / 2, th / 2, 0, tw / 2, th / 2, tw / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#ffffff88'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, tw, th); }, 128, 128);
    const pools = [], poolGeo = new THREE.PlaneGeometry(1, 1);
    const pool = (parent, at, size, strength = 1, rotation = [0, 0, 0]) => {
        const mat = new THREE.MeshBasicMaterial({ map: poolMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#000000' });
        const obj = noShadow(mesh(parent, poolGeo, mat, at)); obj.receiveShadow = false; obj.scale.set(size[0], size[1], 1); obj.rotation.set(...rotation); obj.renderOrder = 2;
        pools.push({ obj, strength }); return obj;
    };
    const glow = [], shades = [];
    const glowMat = (color = '#ffdfb0') => { const mat = material(color, { emissive: color, emissiveIntensity: .3 }); glow.push(mat); return mat; };

    // Polished concrete: soft trowel clouds, aggregate and saw-cut joints every 1.2 m.
    const floorMap = canvasMap((c, tw, th) => {
        c.fillStyle = '#ccc6ba'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 60; i++) {
            const x = hash(i) * tw, y = hash(i + 99) * th, r = 70 + hash(i + 7) * 190, col = ['#e3ded3', '#b3ac9e', '#d6cebe', '#c1bbaf'][i % 4];
            for (const ox of [-tw, 0, tw]) for (const oy of [-th, 0, th]) { if (x + ox + r < 0 || x + ox - r > tw || y + oy + r < 0 || y + oy - r > th) continue; const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00'); c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
        }
        for (let i = 0; i < 4200; i++) { c.fillStyle = ['#f3efe666', '#6c675d44', '#a98f7333', '#8a8a8044'][i % 4]; c.fillRect(hash(i * 3.1) * tw, hash(i * 1.7 + 5) * th, 1 + i % 3, 1 + i % 2); }
        c.strokeStyle = '#7d776b48'; c.lineWidth = 3; for (const p of [1.5, tw / 2]) { c.beginPath(); c.moveTo(p, 0); c.lineTo(p, th); c.moveTo(0, p); c.lineTo(tw, p); c.stroke(); }
    }, 1024, 1024); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 2400, d / 2400); floorMap.anisotropy = 4;
    const floor = material('#ffffff', { map: floorMap, roughness: .56 });
    box(root, [w, 30, d], [0, -15, bz + d / 2], floor);
    const weave = (base, line, border, stripe) => canvasMap(c => {
        c.fillStyle = base; c.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 4) { c.fillStyle = line + (y % 8 ? '26' : '14'); c.fillRect(0, y, 512, 2); }
        for (let x = 0; x < 512; x += 6) { c.fillStyle = '#00000012'; c.fillRect(x, 0, 2, 512); }
        c.strokeStyle = border; c.lineWidth = 22; c.strokeRect(26, 26, 460, 460); c.strokeStyle = stripe; c.lineWidth = 5; c.strokeRect(54, 54, 404, 404);
    });
    const rug = material('#ffffff', { map: weave('#6f8984', '#e4e6da', '#e2d9c3', '#c0846a'), roughness: 1 });
    const rugAlt = material('#ffffff', { map: weave('#8f918a', '#ece9df', '#b9b3a6', '#6d8781'), roughness: 1 });
    for (const [i, at] of [layout.desk, ...layout.stations.map(s => s.at)].entries()) {
        box(root, [1850, 4, 2000], [at[0], 2, at[1] + 450], i ? rugAlt : rug, 8);
    }
    const kilim = material('#ffffff', { roughness: 1, map: canvasMap(c => {
        c.fillStyle = '#c4a98a'; c.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 64) for (let x = 0; x < 512; x += 64) { c.fillStyle = (x + y) % 128 ? '#b0785e' : '#5f7b75'; c.beginPath(); c.moveTo(x + 32, y + 8); c.lineTo(x + 56, y + 32); c.lineTo(x + 32, y + 56); c.lineTo(x + 8, y + 32); c.fill(); c.fillStyle = '#efe4cf'; c.fillRect(x + 28, y + 28, 8, 8); }
        for (let y = 0; y < 512; y += 3) { c.fillStyle = '#ffffff10'; c.fillRect(0, y, 512, 1); }
        c.strokeStyle = '#7a4d3c'; c.lineWidth = 26; c.strokeRect(13, 13, 486, 486); c.strokeStyle = '#efe4cf'; c.lineWidth = 6; c.strokeRect(34, 34, 444, 444);
    }) });

    const back = new THREE.Group(); back.name = 'Co-working community wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], chalk); box(back, [w, 1050, 40], [0, 525, bz + 20], sage);
    box(back, [w, 28, 72], [0, 1064, bz + 36], oak, 4);
    const battens = []; for (let x = -w / 2 + 90; x < w / 2; x += 180) battens.push({ at: [x, 510, bz + 49], size: [32, 1020, 18] });
    batch(back, unit, oak, battens, true).name = 'Oak wainscot battens';
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });
    const brand = group('community-sign', 'COMMON / GROUND community sign', [0, 2300, bz + 60], back);
    const brandMap = canvasMap(c => {
        c.fillStyle = '#ece6d7'; c.fillRect(0, 0, 1024, 256);
        c.lineWidth = 10; c.strokeStyle = '#304f52'; c.beginPath(); c.arc(112, 128, 60, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#c0846a'; c.beginPath(); c.arc(168, 128, 60, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#304f52'; c.font = 'bold 72px sans-serif'; c.fillText('COMMON / GROUND', 262, 132);
        c.fillStyle = '#9a6a52'; c.font = '25px sans-serif'; c.fillText('FIND YOUR PEOPLE  •  MAKE ROOM FOR YOUR IDEAS', 266, 184);
    }, 1024, 256);
    box(brand, [index ? 2900 : 2200, 600, 35], [0, 0, 0], oak, 8); box(brand, [index ? 2840 : 2140, 540, 8], [0, 0, 23], material('#ffffff', { map: brandMap, roughness: .8 }));
    pool(back, [0, 2300, bz + 3], [(index ? 2900 : 2200) * 1.45, 1250], .55);
    // Acoustic felt compositions above the back-row desks, clear of the sign.
    const backRow = [layout.desk, ...layout.stations.map(s => s.at)].filter(at => at[1] === layout.desk[1]).map(at => at[0]).sort((p, q) => p - q);
    const feltItems = [], feltTones = ['#c98d6a', '#8fa79a', '#e0c08a', '#5f7b75', '#d8cbb3'];
    for (const x of backRow) {
        // Nudge each cluster outward until it clears the sign; skip the centre desk.
        const cx = x + Math.sign(x) * Math.max(0, (index ? 1450 : 1100) + 650 - Math.abs(x));
        if (!x || Math.abs(cx) + 700 > w / 2) continue;
        [[-420, 2220, 360, 740], [-20, 2390, 380, 420], [-20, 2025, 380, 250], [390, 2180, 380, 640]].forEach(([dx, y, fw, fh], k) =>
            feltItems.push({ at: [cx + dx * Math.sign(x), y, bz + 20], size: [fw, fh, 40], color: feltTones[Math.abs(k + Math.round(x / 900)) % feltTones.length] }));
    }
    if (feltItems.length) batch(back, unit, felt, feltItems).name = 'Acoustic felt panels';
    // Whiteboards between back-row desks: "make room for your ideas".
    const ideaMap = canvasMap(c => {
        c.fillStyle = '#f7f6f1'; c.fillRect(0, 0, 1024, 640);
        const sheen = c.createLinearGradient(0, 0, 1024, 640); sheen.addColorStop(0, '#ffffff00'); sheen.addColorStop(.45, '#ffffffaa'); sheen.addColorStop(.6, '#ffffff00'); c.fillStyle = sheen; c.fillRect(0, 0, 1024, 640);
        c.fillStyle = '#2f5d8a'; c.font = 'bold 46px sans-serif'; c.fillText('MAKE ROOM FOR YOUR IDEAS', 46, 80);
        c.strokeStyle = '#2f5d8a'; c.lineWidth = 4; c.beginPath(); c.moveTo(46, 98); c.quadraticCurveTo(360, 88, 690, 100); c.stroke();
        c.strokeStyle = '#3b3f45'; c.lineWidth = 4; c.font = '26px sans-serif'; c.fillStyle = '#3b3f45';
        [['IDEA', 60, 170], ['TEST', 290, 170], ['SHIP', 520, 170], ['LEARN', 290, 330]].forEach(([t, x, y]) => { c.strokeRect(x, y, 170, 86); c.fillText(t, x + 40, y + 52); });
        c.beginPath(); for (const [x0, y0, x1, y1] of [[230, 213, 290, 213], [460, 213, 520, 213], [605, 256, 460, 360], [290, 380, 145, 256]]) { c.moveTo(x0, y0); c.lineTo(x1, y1); } c.stroke();
        ['#f6d66b', '#f4a7a0', '#9fd3c7', '#f6d66b', '#b7c8f0', '#f4a7a0', '#9fd3c7', '#f6d66b', '#b7c8f0'].forEach((col, i) => {
            c.save(); c.translate(790 + (i % 3) * 82, 180 + Math.floor(i / 3) * 92); c.rotate((hash(i) - .5) * .2);
            c.fillStyle = '#00000018'; c.fillRect(-32, -30, 72, 72); c.fillStyle = col; c.fillRect(-36, -36, 72, 72);
            c.strokeStyle = '#44444477'; c.lineWidth = 2; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-26, -16 + k * 14); c.lineTo(-20 + hash(i * 5 + k) * 40, -16 + k * 14); c.stroke(); }
            c.restore();
        });
        c.fillStyle = '#c0504d'; c.font = '28px sans-serif'; c.fillText('Thu · demo day!', 60, 520); c.fillStyle = '#3b3f45'; c.font = '24px sans-serif'; c.fillText('lunch club → 12:30', 60, 568);
        [70, 120, 95, 150, 130].forEach((bh, k) => { c.fillStyle = ['#2f5d8a', '#c0504d', '#4c8a6a'][k % 3]; c.fillRect(560 + k * 46, 590 - bh, 30, bh); });
        c.strokeStyle = '#3b3f45'; c.lineWidth = 3; c.beginPath(); c.moveTo(548, 592); c.lineTo(800, 592); c.stroke();
    }, 1024, 640);
    const ideaMat = material('#ffffff', { map: ideaMap, roughness: .25 });
    for (let i = 1; i < backRow.length; i++) {
        const board = group(`ideas-wall-${i}`, 'Ideas whiteboard', [(backRow[i - 1] + backRow[i]) / 2, 1560, bz + 28], back);
        box(board, [1300, 820, 24], [0, 0, 0], ink, 6); noShadow(box(board, [1260, 780, 6], [0, 0, 14], ideaMat));
        box(board, [1200, 20, 64], [0, -425, 30], brass, 3);
        batch(board, cyl, tinted, ['#2f5d8a', '#c0504d', '#3b3f45', '#4c8a6a'].map((color, k) => ({ at: [-420 + k * 70, -405, 34], rot: [0, 0, Math.PI / 2], size: [9, 120, 9], color })));
    }
    // Festoon string lights along the top of the community wall.
    const festoonMat = material('#fff1d6', { emissive: '#ffd79a', emissiveIntensity: .2, roughness: .3 });
    const hookY = Math.min(h - 90, 3300), spans = Math.max(2, Math.round((w - 400) / 1800)), span = (w - 400) / spans, cable = [], bulbs = [];
    for (let i = 0; i <= spans * 24; i++) {
        const f = (i % 24) / 24, x = -w / 2 + 200 + i / 24 * span, y = hookY - 140 * Math.sin(Math.PI * f);
        cable.push(new THREE.Vector3(x, y, bz + 75)); if (i % 6 === 3) bulbs.push({ at: [x, y - 52, bz + 75], size: [30, 40, 30] });
    }
    // Plain meshes on the wall (not a group), so the string is architecture, not a movable fixture.
    noShadow(mesh(back, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cable), cable.length * 2, 4, 5), ink)).name = 'Festoon cable';
    batch(back, ball, festoonMat, bulbs).name = 'Festoon string lights';

    const right = new THREE.Group(); right.name = 'Co-working café wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], chalk); box(right, [20, 85, d], [w / 2 - 10, 42.5, bz + d / 2], oak);
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    const window = new THREE.Group(); window.name = 'Co-working city windows'; root.add(window);
    const ww = Math.min(5600, d * .58), wz = bz + d * .4, low = 780, wh = Math.min(2150, h - 1050), a = wz - ww / 2, b = wz + ww / 2;
    for (const [length, z] of [[a - bz, (a + bz) / 2], [front - b, (front + b) / 2]]) box(window, [80, h, length], [-w / 2 - 40, h / 2, z], chalk);
    box(window, [80, low, ww], [-w / 2 - 40, low / 2, wz], chalk); box(window, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], chalk);
    box(window, [20, 85, d], [-w / 2 + 10, 42.5, bz + d / 2], oak);
    const skyMap = canvasMap(() => {}, 1024, 512), sky = skyMap.image;
    const pane = mesh(window, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (let z = a; z <= b + 1; z += ww / 4) box(window, [55, wh + 35, 32], [-w / 2 + 16, low + wh / 2, z], ink);
    for (const y of [low, low + wh]) box(window, [55, 35, ww + 40], [-w / 2 + 16, y, wz], ink);
    box(window, [230, 28, ww + 140], [-w / 2 + 112, low + 2, wz], oak, 4);
    box(window, [90, 90, ww + 60], [-w / 2 + 62, low + wh + 72, wz], ink, 6);
    const blinds = batch(window, unit, material('#efe7d6', { roughness: 1, transparent: true, opacity: .9, side: THREE.DoubleSide }), [0, 1, 2, 3].map(k => ({ at: [-w / 2 + 60, low + wh, a + (k + .5) * ww / 4] })));
    blinds.name = 'Window roller blinds'; blinds.receiveShadow = false;
    const setBlinds = f => {
        for (let k = 0; k < 4; k++) {
            const length = Math.max(20, wh * f * (k % 2 ? 1 : .86));
            m4.compose(vec.set(-w / 2 + 60, low + wh + 20 - length / 2, a + (k + .5) * ww / 4).sub(blinds.position), quat.identity(), scl.set(5, length, ww / 4 - 46)); blinds.setMatrixAt(k, m4);
        }
        blinds.instanceMatrix.needsUpdate = true; blinds.computeBoundingBox(); blinds.computeBoundingSphere();
    };
    const sillLeaves = [], sillPots = [];
    for (const [k, z] of [wz - ww * .36, wz + ww * .06, wz + ww * .4].entries()) {
        sillPots.push({ at: [-w / 2 + 120, low + 82, z], size: [72, 130, 72], color: ['#ece6da', '#b87962', '#5f7b75'][k] });
        leafSpray(sillLeaves, [-w / 2 + 120, low + 140, z], 14, { size: [26, k === 1 ? 260 : 170], spread: k === 1 ? 1.6 : 1.1, seed: k * 5, droop: k === 1 ? 1 : 0, face: [0, 1] });
    }
    batch(window, potGeo, tinted, sillPots, true); batch(window, ball, foliage, sillLeaves, true);
    room.walls.push({ obj: window, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    // Window light on the floor: the glazing projected along the daylight rig's
    // sun direction, faded where it would leave the room.
    const sunMap = canvasMap((c, tw, th) => {
        c.fillStyle = '#000000'; c.fillRect(0, 0, tw, th); c.filter = 'blur(5px)'; c.fillStyle = '#ffffff';
        const bar = 32 / ww * tw; for (let k = 0; k < 4; k++) c.fillRect(k * tw / 4 + bar, 10, tw / 4 - bar * 2, th - 20);
        c.fillStyle = '#000000b0'; for (let i = 0; i < 26; i++) { c.beginPath(); c.ellipse(hash(i) * tw, th - 8 - hash(i + 3) * 46, 8 + hash(i + 5) * 16, 5 + hash(i + 9) * 10, hash(i + 1) * 3, 0, Math.PI * 2); c.fill(); }
        c.filter = 'none';
    }, 512, 256);
    const sunGeo = new THREE.PlaneGeometry(1, 1, 12, 12); sunGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sunGeo.attributes.position.count * 3), 3));
    const daylight = new THREE.Group(); daylight.name = 'Window daylight and lamp light pools'; root.add(daylight);
    const sun = mesh(daylight, sunGeo, new THREE.MeshBasicMaterial({ map: sunMap, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    sun.castShadow = sun.receiveShadow = false; sun.renderOrder = 2; sun.name = 'Window daylight patch';
    const placeSun = ([elevation, sweep, strength], key, accent) => {
        sun.visible = strength > 0; if (!sun.visible) return;
        const pos = sunGeo.attributes.position, uv = sunGeo.attributes.uv, col = sunGeo.attributes.color;
        for (let i = 0; i < pos.count; i++) {
            const y = low + uv.getY(i) * wh, z = a + uv.getX(i) * ww, t = y / elevation, x = -w / 2 + 40 + t, zz = z + sweep * t;
            const inside = x < w / 2 - 60 && zz > bz + 40 && zz < front - 40 ? 1 : 0;
            pos.setXYZ(i, Math.min(x, w / 2 - 60), 7, THREE.MathUtils.clamp(zz, bz + 40, front - 40)); col.setXYZ(i, inside, inside, inside);
        }
        pos.needsUpdate = col.needsUpdate = true; sunGeo.computeBoundingBox(); sunGeo.computeBoundingSphere();
        sun.material.color.set(key).multiplyScalar(strength * Math.min(accent, 1.4));
    };

    const coffee = group('cafe-counter', 'Community café counter', [cafe[0], 0, cafe[1]]); coffee.rotation.y = -Math.PI / 2;
    const terrazzoMap = canvasMap(c => {
        c.fillStyle = '#e9e2d5'; c.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 1100; i++) { c.fillStyle = ['#b87962', '#6d8781', '#d9c59a', '#8c8a84', '#f7f3ea'][i % 5]; const r = 1.5 + hash(i * 3.7) * 5; c.beginPath(); c.ellipse(hash(i * 1.1) * 512, hash(i * 2.3 + .5) * 512, r, r * (.5 + hash(i) * .6), hash(i * 5) * 3, 0, Math.PI * 2); c.fill(); }
    }); terrazzoMap.wrapS = terrazzoMap.wrapT = THREE.RepeatWrapping; terrazzoMap.repeat.set(3.5, 1);
    const flutedMap = canvasMap((c, tw, th) => { for (let x = 0; x < tw; x += 16) { const g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#1f373c'); g.addColorStop(.45, '#3b5e62'); g.addColorStop(1, '#22393e'); c.fillStyle = g; c.fillRect(x, 0, 16, th); } }, 256, 256);
    box(coffee, [2200, 800, 560], [0, 460, -10], clay, 8); box(coffee, [2140, 60, 500], [0, 30, -30], ink, 3);
    box(coffee, [2250, 40, 640], [0, 880, 0], material('#ffffff', { map: terrazzoMap, roughness: .35 }), 6);
    const fluted = material('#ffffff', { map: flutedMap, roughness: .6 });
    for (const x of [-720, 0, 720]) { box(coffee, [660, 740, 20], [x, 450, 279], fluted, 3); rod(coffee, [x - 75, 660, 300], [x + 75, 660, 300], 6, brass); }
    // Counter dressing: covered cake stand, cup stacks and a carafe.
    mesh(coffee, cyl, ceramic, [380, 945, 60]).scale.set(38, 90, 38); mesh(coffee, cyl, ceramic, [380, 996, 60]).scale.set(150, 12, 150);
    noShadow(mesh(coffee, cyl, material('#c8925e', { roughness: .8 }), [380, 1042, 60])).scale.set(108, 80, 108);
    noShadow(mesh(coffee, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), material('#dfeeee', { transparent: true, opacity: .2, roughness: .05, depthWrite: false }), [380, 1002, 60])).scale.set(160, 190, 160);
    const cups = []; for (let s = 0; s < 3; s++) for (let k = 0; k < 4 - s % 2; k++) cups.push({ at: [-260 + s * 100, 931 + k * 58, -150], size: [40, 56, 40], color: ['#f3eee4', '#5f7b75', '#f3eee4'][s] });
    cups.push({ at: [-860, 990, -120], size: [55, 180, 55], color: '#cfe0dc' }, { at: [-760, 960, -130], size: [36, 120, 36], color: '#cfe0dc' });
    batch(coffee, cyl, tinted, cups, true);
    // Open shelving, glazed tile splashback and an under-shelf LED glow.
    const shelves = group('cafe-shelves', 'Open café shelving', [w / 2, 1160, cafe[1]], right); shelves.rotation.y = -Math.PI / 2;
    const tileMap = canvasMap((c, tw, th) => {
        c.fillStyle = '#d3ccbf'; c.fillRect(0, 0, tw, th);
        for (let r = 0; r < 8; r++) for (let k = -1; k < 17; k++) { const x = k * 64 + (r % 2) * 32, y = r * 32; c.fillStyle = ['#f2ede3', '#eee8dc', '#f5f1e9'][(k + r * 3) % 3]; c.fillRect(x + 2, y + 2, 60, 28); c.fillStyle = '#ffffff70'; c.fillRect(x + 4, y + 4, 56, 4); }
    }, 1024, 256);
    noShadow(box(shelves, [2240, 520, 12], [0, 0, 6], material('#ffffff', { map: tileMap, roughness: .22 })));
    const ledMat = glowMat('#ffe2b8'), boards = [], strips = [], wares = [], shelfPots = [], shelfLeaves = [];
    for (const side of [-1, 1]) for (const [row, y] of [400, 740].entries()) { // heights relative to the 1160 mm splashback centre
        const x = side * 820; boards.push({ at: [x, y, 110], size: [560, 32, 220] }); strips.push({ at: [x, y - 20, 196], size: [520, 8, 14] });
        if (row === 0) pool(shelves, [x, y - 280, 14], [820, 560], .75);
        for (let k = 0; k < 4; k++) {
            const px = x - 210 + k * 130, top = y + 16, seed = side * 10 + row * 4 + k;
            if ((k + row + (side > 0)) % 3 === 1) { shelfPots.push({ at: [px, top + 50, 100], size: [55, 100, 55], color: ['#ece6da', '#b87962'][k % 2] }); leafSpray(shelfLeaves, [px, top + 95, 100], 10, { size: [22, 170], spread: 1.4, seed, droop: 1.3, face: [2, 1] }); }
            else if (row === 0) for (let j = 0; j < 2; j++) wares.push({ at: [px - 25 + j * 50, top + 80, 90], size: [40, 160, 40], color: ['#d7b07a', '#e9e2d5', '#8a6a4e', '#cfe0dc'][(k + j) % 4], geo: 'cyl' });
            else wares.push({ at: [px, top + 95, 100], size: [110, 190, 70], color: ['#b88c5a', '#6d8781', '#c9b79a'][k % 3] });
        }
    }
    batch(shelves, unit, oak, boards, true); batch(shelves, unit, ledMat, strips);
    batch(shelves, cyl, tinted, wares.filter(o => o.geo)); batch(shelves, unit, tinted, wares.filter(o => !o.geo), true);
    batch(shelves, potGeo, tinted, shelfPots, true); batch(shelves, ball, foliage, shelfLeaves);
    const menu = group('cafe-menu', 'Coffee & community menu', [w / 2 - 30, 1950, cafe[1]], right); menu.rotation.y = -Math.PI / 2;
    const menuMap = canvasMap(c => {
        c.fillStyle = '#2d4247'; c.fillRect(0, 0, 512, 512); c.strokeStyle = '#b99570'; c.lineWidth = 3; c.strokeRect(20, 20, 472, 472);
        c.fillStyle = '#eee6d2'; c.font = 'bold 44px sans-serif'; c.fillText('TAKE A BREAK', 42, 86);
        c.font = '25px sans-serif'; [['ESPRESSO', '2.5'], ['FLAT WHITE', '3.4'], ['OAT LATTE', '3.6'], ['FRESH TEA', '2.8'], ['BANANA BREAD', '3.0']].forEach(([item, price], i) => { c.fillStyle = '#eee6d2'; c.fillText(item, 42, 160 + i * 52); c.fillStyle = '#e2b77d'; c.fillText(price, 410, 160 + i * 52); });
        c.fillStyle = '#9fc7b7'; c.font = 'italic 24px sans-serif'; c.fillText('good conversation · new ideas welcome', 42, 456);
    });
    const menuMat = material('#ffffff', { map: menuMap, emissive: '#ffffff', emissiveMap: menuMap, emissiveIntensity: .08 });
    box(menu, [950, 1000, 25], [0, 0, 0], menuMat);
    const notice = group('community-board', 'Community events & ideas board', [w / 2 - 40, 1700, bz + 1100], right); notice.rotation.y = -Math.PI / 2;
    const boardMap = canvasMap(c => {
        c.fillStyle = '#a88f68'; c.fillRect(0, 0, 1024, 640);
        for (let i = 0; i < 3200; i++) { c.fillStyle = ['#8e7652aa', '#c1a87daa', '#7a6445aa'][i % 3]; c.fillRect(hash(i * 1.3) * 1024, hash(i * 2.9 + 1) * 640, 2 + i % 3, 2); }
        [['IDEA LAB', '#ead8b4', 'Thursday 6pm'], ['LUNCH CLUB', '#bad0c5', 'Daily 12:30'], ['DEMO DAY', '#ddb09c', 'Friday 4pm'], ['DESIGN TALK', '#d9d3ea', 'Wednesday 5pm'], ['FOCUS HOUR', '#f0e1a8', '9–10 every day'], ['SAY HELLO', '#f2c6b8', 'New members']].forEach(([title, col, sub], i) => {
            const pw = 270, ph = 252; c.save(); c.translate(56 + (i % 3) * 330 + pw / 2 + hash(i) * 20, 38 + Math.floor(i / 3) * 300 + ph / 2 + hash(i + 4) * 14); c.rotate((hash(i + 9) - .5) * .07);
            c.fillStyle = '#00000030'; c.fillRect(-pw / 2 + 6, -ph / 2 + 8, pw, ph); c.fillStyle = col; c.fillRect(-pw / 2, -ph / 2, pw, ph);
            c.fillStyle = '#355253'; c.font = 'bold 30px sans-serif'; c.fillText(title, -pw / 2 + 18, -ph / 2 + 56);
            c.fillStyle = '#ffffff99'; c.beginPath(); c.arc(-20, 10, 54, 0, Math.PI * 2); c.fill(); c.fillStyle = ['#c0846a', '#5f7b75', '#e0b13c'][i % 3]; c.fillRect(20, -10, 70, 70);
            c.fillStyle = '#5b4a3c'; c.font = '21px sans-serif'; c.fillText(sub, -pw / 2 + 18, ph / 2 - 22);
            c.fillStyle = ['#c0504d', '#2f5d8a', '#e0b13c'][i % 3]; c.beginPath(); c.arc(0, -ph / 2 + 14, 9, 0, Math.PI * 2); c.fill(); c.restore();
        });
    }, 1024, 640);
    box(notice, [1700, 1050, 35], [0, 0, 0], oak, 8); noShadow(box(notice, [1640, 990, 8], [0, 0, 22], material('#ffffff', { map: boardMap, roughness: .95 })));
    // Brass picture light: its glow washes the posters after dark.
    box(notice, [900, 38, 60], [0, 600, 120], brass, 8); for (const x of [-300, 300]) rod(notice, [x, 560, 18], [x, 596, 100], 7, brass);
    noShadow(box(notice, [860, 8, 34], [0, 578, 122], glowMat())); pool(notice, [0, 260, 30], [1500, 860], .7);

    const meet = group('meeting-table', index ? 'Four-person collaboration table' : 'Two-person conversation table', [meeting[0], 0, meeting[1]]);
    if (index) {
        box(meet, [2200, 40, 1000], [0, 720, 0], oak, 18);
        for (const x of [-780, 780]) { box(meet, [70, 700, 550], [x, 350, 0], ink, 4); box(meet, [650, 30, 700], [x, 15, 0], ink, 4); }
        box(meet, [1300, 4, 250], [0, 742, 0], sage, 4);
    } else {
        mesh(meet, new THREE.CylinderGeometry(400, 400, 35, 32), oak, [0, 722.5, 0]);
        mesh(meet, new THREE.CylinderGeometry(70, 100, 700, 24), ink, [0, 350, 0]); mesh(meet, new THREE.CylinderGeometry(260, 260, 30, 24), ink, [0, 15, 0]);
    }
    // A rolling whiteboard closes the meeting zone where the café leaves room.
    if (index && Math.abs(meeting[1] - 250 - cafe[1]) > 1100 + 700) {
        const easel = group('mobile-whiteboard', 'Mobile ideas whiteboard', [w / 2 - 520, 0, meeting[1] - 250]); easel.rotation.y = -Math.PI / 2;
        box(easel, [1040, 740, 26], [0, 1330, 0], ink, 6); noShadow(box(easel, [1000, 700, 6], [0, 1330, 15], ideaMat));
        for (const x of [-535, 535]) { rod(easel, [x, 70, 0], [x, 1720, 0], 16, brass); box(easel, [60, 30, 480], [x, 55, 0], ink, 4); }
        batch(easel, cyl, tinted, [-535, 535].flatMap(x => [-200, 200].map(z => ({ at: [x, 20, z], rot: [0, 0, Math.PI / 2], size: [20, 34, 20], color: '#2b2b2b' }))));
    }
    if (index) box(root, [2900, 4, 2300], [lounge[0], 2, lounge[1] - 650], kilim, 15);
    else box(root, [1600, 4, 1400], [lounge[0] + 250, 2, lounge[1] - 200], kilim, 12);
    const makeBooth = (at, id, label, enclosed) => {
        const booth = group(id, label, [at[0], 0, at[1]]);
        box(booth, [1560, 4, 1600], [0, 2, 0], material('#858b83', { roughness: 1 }), 8);
        box(booth, [1560, 2120, 60], [0, 1060, -770], sage, 9);
        for (const x of [-750, 750]) box(booth, [60, 2120, 1540], [x, 1060, 0], oak, 8);
        box(booth, [1420, 1500, 20], [0, 1200, -728], material('#8f9a91', { roughness: 1 }), 5);
        const slats = []; for (let x = -670; x < 690; x += 70) slats.push({ at: [x, 1200, -713], size: [20, 1500, 8] });
        batch(booth, unit, sage, slats);
        box(booth, [1350, 35, 520], [0, 722.5, -485], oak, 9);
        if (enclosed) {
            box(booth, [1560, 60, 1600], [0, 2150, 0], ink, 8);
            box(booth, [35, 2100, 35], [0, 1050, 780], ink, 3);
            const glass = material('#bcd9d6', { transparent: true, opacity: .18, roughness: .15, depthWrite: false });
            box(booth, [690, 2000, 8], [-360, 1080, 785], glass); box(booth, [690, 2000, 8], [360, 1080, 785], glass);
            rod(booth, [120, 920, 800], [120, 1230, 800], 9, brass);
            noShadow(box(booth, [900, 12, 120], [0, 2112, -620], glowMat('#ffe6c0')));
        }
        const labelMap = canvasMap(c => { c.fillStyle = '#304c50'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#e8e3cf'; c.font = 'bold 38px sans-serif'; c.textAlign = 'center'; c.fillText(label.toUpperCase(), 256, 80); }, 512, 128);
        box(booth, [1000, 200, 20], [0, 1940, -700], material('#ffffff', { map: labelMap }));
        return booth;
    };
    if (focus) makeBooth(focus, 'quiet-booth', 'Quiet focus', false);
    if (call) makeBooth(call, 'call-booth', 'Private calls', true);
    const planter = (at, id, length) => {
        const p = group(id, 'Acoustic planter divider', [at[0], 0, at[1]]);
        box(p, [length, 580, 300], [0, 290, 0], clay, 8); box(p, [length - 60, 8, 250], [0, 584, 0], soil);
        const stems = [], leaves = [];
        for (let x = -length / 2 + 110; x < length / 2 - 70; x += 170) for (let j = 0; j < 3; j++) {
            const top = [x + (j - 1) * 35, 950 + j * 55, (hash(x + j) - .5) * 80];
            stems.push({ at: [(x + top[0]) / 2, (588 + top[1]) / 2, top[2] / 2], dir: [top[0] - x, top[1] - 588, top[2]], size: [4, Math.hypot(top[0] - x, top[1] - 588, top[2]), 4], color: '#6d8781' });
            leaves.push({ at: [x + (j - 1) * 40, 930 + j * 55, 20 + top[2] / 2], rot: [0, hash(x * 3 + j) * .6, (j - 1) * .5], size: [45, 120, 13], color: greens[(j + Math.round(x / 170)) % greens.length] });
            leafSpray(leaves, [x, 600, 0], 3, { size: [30, 200], spread: 1.3, seed: x + j });
        }
        batch(p, cyl, tinted, stems); batch(p, ball, foliage, leaves, true);
    };
    if (index >= 1) planter([0, bz + (index > 1 ? 5500 : 3200)], 'living-divider', index > 1 ? 2200 : 1400);
    // Fiddle-leaf figs: planted pots that can be nudged like any floor plant.
    const fig = (id, at, tall = 1650) => {
        const p = group(id, 'Potted fiddle-leaf fig', [at[0], 0, at[1]]);
        mesh(p, potGeo, ceramic, [0, 200, 0]).scale.set(205, 400, 205); noShadow(mesh(p, cyl, soil, [0, 396, 0])).scale.set(182, 10, 182);
        rod(p, [0, 395, 0], [30, tall * .7, 10], 17, bark); rod(p, [24, tall * .5, 8], [-110, tall * .82, -40], 10, bark);
        const leaves = [];
        for (let i = 0; i < 30; i++) {
            const az = i * 2.399 + at[0], y = tall * (.48 + .5 * hash(i + at[1])), r = 30 + hash(i * 3) * 60, l = 95 + hash(i * 7) * 35;
            const dir = [Math.cos(az) * .7, .45 + hash(i * 11) * .55, Math.sin(az) * .7], n = Math.hypot(...dir);
            leaves.push({ at: [Math.cos(az) * r + dir[0] / n * l, y + dir[1] / n * l, Math.sin(az) * r + dir[2] / n * l], dir, size: [62, l, 14], color: greens[i % greens.length] });
        }
        batch(p, ball, foliage, leaves, true);
        return p;
    };
    if (index !== 3) fig('potted-fig-cafe', [w / 2 - 380, cafe[1] + 1400], 1550);
    fig('potted-fig-lounge', index ? [lounge[0] + 1300, lounge[1] + 50] : [-w / 2 + 370, lounge[1] - 1030], 1700);
    // Linen floor lamp beside the lounge, with a warm pool on the floor.
    const lampAt = index ? [lounge[0] - 1180, lounge[1] + 150] : [-w / 2 + 260, lounge[1] + 600];
    const lamp = group('lounge-floor-lamp', 'Linen floor lamp', [lampAt[0], 0, lampAt[1]]);
    mesh(lamp, cyl, ink, [0, 12, 0]).scale.set(160, 24, 160); rod(lamp, [0, 24, 0], [0, 1400, 0], 11, brass);
    const shadeMat = material('#efe4cf', { side: THREE.DoubleSide, emissive: '#ffd9a0', emissiveIntensity: 0, roughness: .95 }); shades.push(shadeMat);
    mesh(lamp, new THREE.CylinderGeometry(185, 225, 300, 28, 1, true), shadeMat, [0, 1460, 0]);
    noShadow(mesh(lamp, cyl, glowMat(), [0, 1325, 0])).scale.set(200, 6, 200);
    // The pool stays on the floor slab: its quad is kept inside the walls.
    pool(daylight, [THREE.MathUtils.clamp(lampAt[0], -w / 2 + 560, w / 2 - 560), 8, Math.min(lampAt[1], front - 560)], [1100, 1100], 1.1, [-Math.PI / 2, 0, 0]);
    // A cushioned window bench gives the glazing a place to sit and read.
    const benchStart = (index ? bz + 3900 : bz + 1100) + 1900, benchEnd = Math.min(b, benchStart + 2000, focus ? focus[1] - 950 : Infinity);
    if (benchEnd - benchStart > 1200) {
        const length = benchEnd - benchStart, bench = group('window-bench', 'Window bench & cushions', [-w / 2 + 210, 0, (benchStart + benchEnd) / 2]);
        box(bench, [380, 400, length], [0, 200, 0], oak, 10); box(bench, [340, 30, length - 60], [0, 15, 0], ink, 4);
        box(bench, [360, 80, length - 30], [0, 440, 0], material('#7f958f', { roughness: 1 }), 30);
        batch(bench, unit, tinted, [
            { at: [-55, 590, length / 2 - 250], rot: [0, -.25, .28], size: [100, 300, 340], color: '#c98d6a' },
            { at: [-55, 580, length / 2 - 540], rot: [0, .2, .24], size: [95, 270, 300], color: '#e0c08a' },
            ...[0, 1, 2].map(k => ({ at: [20, 492 + k * 32, -length / 2 + 260], rot: [0, (hash(k) - .5) * .5, 0], size: [230 - k * 20, 30, 300 - k * 30], color: ['#5f7b75', '#d8cbb3', '#b0785e'][k] }))
        ], true);
        noShadow(mesh(bench, cyl, ceramic, [30, 515, -length / 2 + 520])).scale.set(40, 70, 40);
    }
    // Long communal worktable for the largest floors.
    if (index >= 3) {
        const tz = bz + d * .62, table = group('communal-table', 'Communal worktable', [0, 0, tz]);
        box(table, [3600, 45, 1000], [0, 718, 0], oak, 12);
        for (const x of [-1450, 0, 1450]) { box(table, [80, 690, 700], [x, 350, 0], ink, 4); box(table, [120, 30, 820], [x, 15, 0], ink, 4); }
        box(table, [3000, 6, 260], [0, 743, 0], sage, 3);
        const seats = [], legs = [], dressing = [], leaves = [];
        for (const x of [-1200, -400, 400, 1200]) for (const side of [-1, 1]) {
            seats.push({ at: [x, 470, side * 700], size: [200, 40, 200], color: ['#c98d6a', '#5f7b75', '#e0c08a'][(x / 400 + side + 6) % 3 | 0] });
            for (const [lx, lz] of [[-130, -130], [130, -130], [-130, 130], [130, 130]]) legs.push({ at: [x + lx * .9, 232, side * 700 + lz * .9], dir: [-lx * .12, 1, -lz * .12], size: [11, 450, 11] });
        }
        for (const x of [-900, 900]) { dressing.push({ at: [x, 810, 0], size: [70, 130, 70], color: '#ece6da' }); leafSpray(leaves, [x, 860, 0], 12, { size: [28, 200], spread: 1.2, seed: x }); }
        batch(table, cyl, tinted, seats, true); batch(table, cyl, brass, legs); batch(table, potGeo, tinted, dressing); batch(table, ball, foliage, leaves);
        for (const side of [-1, 1]) fig(`potted-fig-table-${side < 0 ? 'left' : 'right'}`, [side * 2300, tz + side * 200], 1800);
    }

    const ceiling = new THREE.Group(); ceiling.name = 'Co-working suspended lights'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const at of [layout.desk, ...layout.stations.map(s => s.at)]) {
        const [x, z] = at; for (const dx of [-450, 450]) rod(ceiling, [x + dx, h, z], [x + dx, h - 420, z], 3, brass);
        box(ceiling, [1300, 70, 140], [x, h - 440, z], ink, 5);
        box(ceiling, [1250, 8, 100], [x, h - 480, z], glowMat(), 3).castShadow = false;
    }
    const pendants = [[meeting[0], meeting[1]], [cafe[0] - 250, cafe[1]], ...(index >= 3 ? [[-900, bz + d * .62], [900, bz + d * .62]] : [])];
    for (const [x, z] of pendants) {
        rod(ceiling, [x, h, z], [x, h - 700, z], 4, brass);
        mesh(ceiling, new THREE.ConeGeometry(260, 260, 32, 1, true), clay, [x, h - 830, z]);
        mesh(ceiling, new THREE.CylinderGeometry(235, 235, 10, 32), glowMat(), [x, h - 960, z]).castShadow = false;
    }
    // Felt baffles soften the open ceiling (hidden with the ceiling in plan views).
    const baffles = []; for (let z = bz + 650, k = 0; z < front - 400; z += 900, k++) baffles.push({ at: [0, h - 190, z], size: [w - 600, 240, 45], color: ['#e3dccd', '#c3cbbf', '#e3dccd', '#d6c3ae'][k % 4] });
    batch(ceiling, unit, felt, baffles).name = 'Acoustic ceiling baffles';
    const lights = [
        { at: [layout.desk[0], 2100, layout.desk[1]], task: true, power: 4, range: 4400 },
        { at: [0, 2400, bz + d * .4], task: true, power: 5, range: d * .7 },
        { at: [cafe[0] - 600, 2000, cafe[1]], task: false, power: 4.5, range: 4300 },
        { at: [meeting[0], 2200, meeting[1]], task: false, power: 4, range: 4800 }
    ].map(spec => { const light = new THREE.PointLight('#efd8b5', 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    room.decorateStation = mount => {
        const map = canvasMap(c => { c.fillStyle = '#ede3ca'; c.fillRect(0, 0, 512, 512); c.strokeStyle = '#567875'; c.lineWidth = 4; for (let i = 0; i < 5; i++) { c.strokeRect(65 + i * 50, 65 + i * 30, 245, 180); } c.fillStyle = '#486b68'; c.font = 'bold 25px sans-serif'; c.fillText('SHARE / YOUR IDEAS', 80, 425); });
        const sheet = mesh(mount, new THREE.PlaneGeometry(520, 380), material('#ffffff', { map, side: THREE.DoubleSide, roughness: 1 }), [0, 1, 40]); sheet.rotation.x = -Math.PI / 2; sheet.castShadow = false;
    };
    // The city view: graded sky, sun or moon glow, hazy and near towers, trees.
    const drawSky = (modeId, mode) => {
        const c = sky.getContext('2d'), W = sky.width, H = sky.height, night = modeId === 'night', [far, near, trees] = SKYLINE[modeId] || SKYLINE.morning;
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mode.sky[0]); g.addColorStop(1, mode.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
        const [sx, sy, r] = { morning: [.2, .42, 300], afternoon: [.62, .1, 340], evening: [.78, .6, 380], night: [.3, .18, 70], party: [.7, .66, 260] }[modeId] || [.5, .3, 300];
        const sun = c.createRadialGradient(sx * W, sy * H, 0, sx * W, sy * H, r); sun.addColorStop(0, night ? '#f5f2e4' : '#fff8e2'); sun.addColorStop(night ? .3 : .1, night ? '#f5f2e4bb' : '#fff3d6cc'); sun.addColorStop(1, '#ffffff00'); c.fillStyle = sun; c.fillRect(0, 0, W, H);
        if (night) for (let i = 0; i < 60; i++) { c.fillStyle = '#ffffff' + (40 + (i * 37) % 160).toString(16).padStart(2, '0'); c.fillRect(hash(i) * W, hash(i + 40) * H * .45, 2, 2); }
        else for (let i = 0; i < 9; i++) { c.fillStyle = modeId === 'evening' || modeId === 'party' ? '#f6c9a440' : '#ffffff55'; const x = hash(i + 2) * W, y = 40 + hash(i + 6) * 150; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + k * 34, y - (k % 2) * 12, 60, 18, 0, 0, Math.PI * 2); c.fill(); } }
        for (let i = 0; i < 30; i++) { c.fillStyle = far; const top = H * .46 + hash(i + 70) * 110; c.fillRect(i * 36 - 10, top, 30 + hash(i + 3) * 26, H - top); }
        for (let i = 0; i < 15; i++) {
            const x = i * 72 - 20 + hash(i) * 20, bw = 56 + hash(i + 11) * 40, top = H * .4 + hash(i + 21) * 160; c.fillStyle = near; c.fillRect(x, top, bw, H - top);
            for (let y = top + 14; y < H - 40; y += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
                const lit = hash(wx * .37 + y * 1.3); c.fillStyle = night || modeId === 'party' ? (lit > .55 ? '#ffd79a' : '#1a2a38') : modeId === 'evening' ? (lit > .8 ? '#ffd59a' : '#7a6d7a') : (lit > .5 ? '#d5e2e6' : '#9fb1bb'); c.fillRect(wx, y, 7, 11);
            }
        }
        c.fillStyle = trees; for (let i = 0; i < 34; i++) { c.beginPath(); c.arc(i * 32 + hash(i) * 12, H - 18 - hash(i + 5) * 26, 26 + hash(i + 9) * 16, 0, Math.PI * 2); c.fill(); }
        skyMap.needsUpdate = true;
    };
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = COWORKING_MODES[modeId] || COWORKING_MODES.morning;
        drawSky(modeId, mode); placeSun(mode.sun, mode.key, accent); setBlinds(mode.blinds);
        glow.forEach(mat => { mat.color.set(mode.colors[0]); mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .12 + mode.practical * accent; });
        shades.forEach(mat => { mat.emissive.set(mode.colors[0]); mat.emissiveIntensity = .45 * mode.practical * accent; });
        festoonMat.emissiveIntensity = mode.festoon * accent; festoonMat.color.set(mode.festoon > .3 ? '#fff4dc' : '#ebe5d8');
        pools.forEach(({ obj, strength }) => { obj.material.color.set(mode.colors[0]).multiplyScalar(mode.pools * strength * accent); obj.visible = mode.pools * accent > .01; });
        menuMat.emissiveIntensity = .06 + .32 * mode.pools * accent;
        lights.forEach(spec => { spec.light.color.set(spec.task ? mode.colors[0] : mode.colors[1]); spec.light.intensity = spec.power * (spec.task ? mode.practical : mode.wash) * accent; });
        root.userData.atmosphere = modeId;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[chalk, 'plaster'], [sage, 'powder'], [ink, 'powder'], [oak, 'wood'], [clay, 'plaster'], [brass, 'metal'], [rug, 'fabric'], [rugAlt, 'fabric'], [kilim, 'fabric'], [floor, 'stone'], [bark, 'wood'], [fluted, 'powder']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
