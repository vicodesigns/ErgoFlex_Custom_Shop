import * as THREE from 'three';
import { HOME_LAYOUTS } from './home-office.mjs?v=asset-packs-20261001';

// The same measured room tiers as Home Office, with independent furnishings
// and saved edits. All dimensions are millimetres; props retain their size.
const names = ['Apartment gaming nook', 'Dedicated gaming room', 'Gaming & streaming room', 'Gaming lounge', 'Entertainment suite'];
export const GAMING_LAYOUTS = Object.fromEntries(Object.values(HOME_LAYOUTS).map((home, index) => {
    const { id, width, depth, height, back } = home;
    const compact = id === 'apartment', large = index >= 3;
    const desk = compact ? [-120, -250] : [-180 - index * 65, back + 900];
    const cabinetX = width / 2 - 370, cabinetZ = back + 320;
    const loungeZ = back + depth - (large ? 1500 : 1150);
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 980], turn: 180 },
        { id: 'gaming-pc', at: [cabinetX, 610, cabinetZ], turn: 0 },
        { id: 'kenney-furniture-books', at: [cabinetX - 95, 1604, back + 145] },
        { id: 'kenney-furniture-plant-small2', at: [cabinetX + 120, 1934, back + 140] },
        { id: 'kenney-furniture-potted-plant', at: [-width / 2 + 270, 0, large ? back + 1500 : back + 320] },
        { id: 'kenney-furniture-lamp-square-floor', at: [-width / 2 + 160, 0, back + depth - 280] }
    ];
    if (compact) props.push(
        { id: 'kenney-furniture-lounge-sofa-ottoman', at: [800, 0, loungeZ + 100] },
        { id: 'handheld-console', at: [800, 460, loungeZ + 100], turn: -12 }
    );
    else props.push(
        { id: 'kenney-furniture-lounge-sofa', at: [-width / 2 + 510, 0, loungeZ], turn: 90 },
        { id: 'coffee-table', at: [-width / 2 + 1370, 0, loungeZ], turn: 90 },
        { id: 'game-controller', at: [-width / 2 + 1330, 391.2, loungeZ - 140], turn: 90 },
        { id: 'handheld-console', at: [-width / 2 + 1430, 391.2, loungeZ + 160], turn: 75 },
        { id: 'samsung-neo-tv', at: [width / 2 - 160, 780, loungeZ], turn: -90 },
        { id: 'headphones', at: [cabinetX - 190, 610, cabinetZ + 60], turn: -20 }
    );
    if (large) props.push(
        { id: 'kenney-furniture-kitchen-coffee-machine', at: [-width / 2 + 370, 790, back + 360], turn: 90 },
        { id: 'monstera', at: [width / 2 - 500, 0, loungeZ - 1050] },
        { id: 'kenney-furniture-lounge-chair', at: [width / 2 - 720, 0, loungeZ + 820], turn: -110 }
    );
    // Keep the apartment nook clear; larger rooms gain a real-size retro lane.
    if (index >= 1) props.push({ id: 'arcade-orbit-runner', at: [width / 2 - 520, 0, back + 1350], turn: -90 });
    if (index >= 2) props.push({ id: 'arcade-pixel-garden', at: [width / 2 - 520, 0, back + 2350], turn: -90 });
    if (index === 4) props.push({ id: 'arcade-night-drive', at: [width / 2 - 560, 0, back + 3350], turn: -90 });
    // Later dressing is appended, so earlier placements keep their saved-edit keys.
    props.push({ id: 'lava-lamp', at: [cabinetX + 215, 610, cabinetZ + 150] });
    return [id, { id, name: names[index], width, depth, height, back, desk, props, compact, large, cabinetX, cabinetZ, loungeZ,
        daylight: [-width / 2 + 100, 450] }];
}));
export const gamingLayoutById = id => GAMING_LAYOUTS[id] || GAMING_LAYOUTS.apartment;
export const gamingLayoutForSize = size => GAMING_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

// `live` lights the on-air box, `stream` the wall key light, `balance` weights the
// cyan/violet room lights; RGB channel 2 (hex panels) uses the mode accent.
export const GAMING_MODES = {
    morning: { label: 'Morning', description: 'Daylight reset · standing stretch and setup', key: '#ffe9cb', fill: '#d5ebff', accent: '#80dce1', power: 1.8, ambient: .6, bounce: .85, exposure: 1.1, sky: ['#89bbd6', '#e8e1cb'], practical: .45, rgb: .16, live: 0, stream: .12, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false, colors: ['#63d8ef', '#a39ff0'] },
    afternoon: { label: 'Afternoon', description: 'Balanced daylight · seated play and streaming', key: '#f6eedf', fill: '#d8e6f7', accent: '#99d5e6', power: 1.35, ambient: .52, bounce: .78, exposure: 1.08, sky: ['#a6c5db', '#e9e4d6'], practical: .5, rgb: .3, live: .55, stream: .7, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false, colors: ['#5be3ec', '#a092ef'] },
    evening: { label: 'Evening', description: 'Golden-hour window · cyan and violet game lighting', key: '#ffcb94', fill: '#bdc8ef', accent: '#b192f0', power: .78, ambient: .3, bounce: .42, exposure: 1.15, sky: ['#8c85ac', '#dfac89'], practical: .8, rgb: 1, balance: [.72, 1.15], live: 1, stream: .85, height: 28, tilt: 0, offset: [0, 80], yaw: 0, leds: true, color: '#40eaff', colors: ['#40d8ed', '#a27aff'] },
    night: { label: 'Night', description: 'Low-glare bias lighting · late-night immersion', key: '#bbc9f4', fill: '#bdc8ec', accent: '#af91ed', power: .25, ambient: .24, bounce: .32, exposure: 1.2, sky: ['#17263f', '#344b6b'], practical: .55, rgb: 1.15, balance: [.8, 1.1], live: .35, stream: .18, height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#8b6cff', colors: ['#49dce5', '#9675ff'] },
    party: { label: 'Party', description: 'Social play · desk turned toward the lounge', key: '#c7d1f7', fill: '#c7b6ee', accent: '#eea0d5', power: .42, ambient: .3, bounce: .38, exposure: 1.16, sky: ['#20283f', '#575076'], practical: .8, rgb: 1.3, live: 1, stream: .45, height: 43.5, tilt: -5, offset: [60, 300], yaw: -12, leds: true, color: '#ff75cf', colors: ['#61deed', '#ff78cb'] }
};

function canvasTexture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}

// Rich set dressing stays cheap: a finished decoration bakes its pieces into
// one mesh per material, so detail costs a draw call per finish, not per piece.
function bake(group, shadows = false) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), byMaterial = new Map();
    group.traverse(obj => {
        if (!obj.isMesh || obj.isInstancedMesh || obj.userData.unbaked) return;
        if (!byMaterial.has(obj.material)) byMaterial.set(obj.material, []);
        byMaterial.get(obj.material).push(obj);
    });
    for (const [mat, meshes] of byMaterial) {
        const pieces = meshes.map(m => (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(inverse.clone().multiply(m.matrixWorld)));
        const geometry = new THREE.BufferGeometry();
        for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
            if (pieces.some(g => !g.attributes[name])) continue;
            const data = new Float32Array(pieces.reduce((n, g) => n + g.attributes[name].array.length, 0));
            let offset = 0;
            for (const g of pieces) { data.set(g.attributes[name].array, offset); offset += g.attributes[name].array.length; }
            geometry.setAttribute(name, new THREE.BufferAttribute(data, size));
        }
        pieces.forEach(g => g.dispose());
        meshes.forEach(m => { m.geometry.dispose(); m.removeFromParent(); });
        const merged = new THREE.Mesh(geometry, mat); merged.name = `${group.name} · ${mat.name || 'finish'}`;
        merged.castShadow = shadows; merged.receiveShadow = true; group.add(merged);
    }
    return group;
}

export function buildGamingRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere } = helpers;
    const { width: w, depth: d, height: h, back: bz, cabinetX: cx, cabinetZ: cz, loungeZ } = layout;
    const front = bz + d;
    const wall = material('#625f7a', { roughness: .93 }), trim = material('#20242f', { roughness: .5 }), walnut = material('#6f523c', { roughness: .58 });
    const black = material('#1d212b', { roughness: .48, metalness: .12 }), felt = material('#2b2f3f', { roughness: 1 });
    const alu = material('#a4acb8', { roughness: .3, metalness: .85 }), ink = material('#141821', { roughness: .4 });
    // Smoked-oak planks with staggered butt joints and individual board tones.
    const floorMap = canvasTexture((c, tw, th) => {
        c.fillStyle = '#5a4738'; c.fillRect(0, 0, tw, th);
        const tones = ['#6b5544', '#5f4b3c', '#735b48', '#574436', '#664f3f'];
        for (let i = 0; i < 6; i++) {
            const x0 = i * tw / 6, joints = [0, (.18 + i * .29) % 1, (.63 + i * .21) % 1, 1].sort((a, b) => a - b);
            for (let j = 0; j < joints.length - 1; j++) {
                const y0 = joints[j] * th, y1 = joints[j + 1] * th;
                c.fillStyle = tones[(i * 2 + j) % tones.length]; c.fillRect(x0, y0, tw / 6 - 2, y1 - y0 - 2);
                c.strokeStyle = '#3a2c2124'; c.lineWidth = 1;
                for (let k = 0; k < 18; k++) {
                    const x = x0 + 4 + k * 4.4 + Math.sin(i * 7 + j * 3 + k) * 1.5;
                    c.beginPath(); c.moveTo(x, y0); c.bezierCurveTo(x + 3, y0 + (y1 - y0) / 3, x - 2, y0 + (y1 - y0) * .7, x + 1, y1); c.stroke();
                }
                c.fillStyle = '#ffffff0c'; c.fillRect(x0 + 10 + (j * 23) % 50, y0 + 6, 16, y1 - y0 - 12);
            }
            c.fillStyle = '#2a1f1650'; c.fillRect(x0 + tw / 6 - 2, 0, 2, th);
        }
    }, 512, 1024); floorMap.repeat.set(w / 1000, d / 1800);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .5 }));
    // Low-pile rugs: a framed geometric border and soft tufted texture.
    const rugTexture = (base, lineA, lineB) => canvasTexture((c, tw, th) => {
        c.fillStyle = base; c.fillRect(0, 0, tw, th);
        for (let n = 0; n < 2600; n++) {
            const x = (n * 197) % tw, y = (n * 331 + (n >> 4) * 7) % th;
            c.fillStyle = n % 3 ? '#ffffff08' : '#00000014'; c.fillRect(x, y, 3, 2);
        }
        c.strokeStyle = lineA; c.lineWidth = 7; c.strokeRect(22, 22, tw - 44, th - 44);
        c.strokeStyle = lineB; c.lineWidth = 2; c.strokeRect(40, 40, tw - 80, th - 80);
        c.strokeStyle = lineB + '55'; c.lineWidth = 2;
        for (let x = 70; x < tw - 60; x += 46) for (let y = 70; y < th - 60; y += 46) {
            if ((x + y) % 92) continue;
            c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y); c.closePath(); c.stroke();
        }
    });
    const rugMap = rugTexture('#2c2f3f', '#5fc9d4', '#9d86e6');
    box(root, [layout.compact ? 1850 : 2350, 8, 1850], [layout.desk[0], 4, layout.desk[1] + 650], material('#ffffff', { map: rugMap, roughness: 1 }), 3);

    // Shared glow cards stand in for light spill without adding real lights.
    const glowMap = canvasTexture((c, tw, th) => {
        const g = c.createRadialGradient(tw / 2, th / 2, 0, tw / 2, th / 2, tw / 2);
        g.addColorStop(0, '#ffffffcc'); g.addColorStop(.4, '#ffffff4a'); g.addColorStop(1, '#ffffff00');
        c.fillStyle = g; c.fillRect(0, 0, tw, th);
    }, 128, 128);
    const washMap = canvasTexture((c, tw, th) => {
        const g = c.createLinearGradient(0, 0, 0, th);
        g.addColorStop(0, '#ffffff99'); g.addColorStop(.25, '#ffffff33'); g.addColorStop(1, '#ffffff00');
        c.fillStyle = g; c.fillRect(0, 0, tw, th);
    }, 8, 128);
    // Clamp, so a filtered edge never picks up the opposite (bright) border.
    for (const map of [glowMap, washMap]) map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const glows = [];
    const glow = (parent, size, position, channel, map = glowMap, strength = 1) => {
        const mat = new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const obj = mesh(parent, new THREE.PlaneGeometry(...size), mat, position);
        obj.castShadow = obj.receiveShadow = false; obj.renderOrder = 2; obj.raycast = () => {}; obj.userData.unbaked = true;
        glows.push({ mat, channel, strength }); return obj;
    };
    const flat = obj => { obj.castShadow = false; return obj; };

    // A slatted feature wall behind the monitor gives RGB light a surface to wash.
    const back = new THREE.Group(); back.name = 'Gaming acoustic feature wall'; root.add(back);
    box(back, [w, h, 80], [0, h / 2, bz - 40], wall);
    box(back, [w, 80, 20], [0, 40, bz + 10], trim);
    const featureW = layout.compact ? 1650 : Math.min(2800, w - 1100), featureX = layout.desk[0];
    box(back, [featureW, h - 320, 22], [featureX, h / 2 + 20, bz + 12], felt);
    for (let x = featureX - featureW / 2 + 25; x < featureX + featureW / 2; x += 68)
        box(back, [29, h - 360, 30], [x, h / 2 + 20, bz + 38], walnut, 2);
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });

    const side = new THREE.Group(); side.name = 'Console and display wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], wall);
    box(side, [20, 80, d], [w / 2 - 10, 40, bz + d / 2], trim);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });

    // Daylight opening on the opposite wall. The actual opening is never covered
    // by opaque geometry, and the walls disappear individually for cutaway views.
    const entry = new THREE.Group(); entry.name = 'Gaming daylight and entry wall'; root.add(entry);
    const wz = 450, ww = layout.compact ? 1150 : 1700, low = 850, wh = 1400;
    const rearEnd = wz - ww / 2, forwardEnd = wz + ww / 2;
    box(entry, [80, h, rearEnd - bz], [-w / 2 - 40, h / 2, (bz + rearEnd) / 2], wall);
    box(entry, [80, h, front - forwardEnd], [-w / 2 - 40, h / 2, (front + forwardEnd) / 2], wall);
    box(entry, [80, low, ww], [-w / 2 - 40, low / 2, wz], wall);
    box(entry, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], wall);
    box(entry, [20, 80, d], [-w / 2 + 10, 40, bz + d / 2], trim);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(entry, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyMap }), [-w / 2 - 55, low + wh / 2, wz]);
    pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    for (const z of [rearEnd, wz, forwardEnd]) box(entry, [70, wh + 50, 35], [-w / 2 + 5, low + wh / 2, z], trim);
    for (const y of [low, low + wh]) box(entry, [70, 35, ww + 50], [-w / 2 + 5, y, wz], trim);
    box(entry, [180, 35, ww + 90], [-w / 2 + 50, low - 25, wz], walnut, 3);
    // A slim door near the open front keeps circulation visually understandable.
    const doorZ = front - 520;
    box(entry, [26, 2110, 850], [-w / 2 + 15, 1055, doorZ], trim, 3);
    box(entry, [28, 2010, 770], [-w / 2 + 32, 1005, doorZ], material('#59606f', { roughness: .55 }), 4);
    rod(entry, [-w / 2 + 52, 1000, doorZ - 285], [-w / 2 + 52, 1000, doorZ - 210], 8, alu);
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    // PC plinth and display shelves have real support heights matching the props.
    const cabinet = new THREE.Group(); cabinet.name = 'PC display cabinet'; back.add(cabinet);
    box(cabinet, [620, 560, 550], [cx, 300, cz], black, 6);
    box(cabinet, [650, 30, 570], [cx, 595, cz], walnut, 4);
    for (const x of [cx - 230, cx + 230]) for (const z of [cz - 205, cz + 205]) rod(cabinet, [x, 0, z], [x, 40, z], 12, alu);
    for (const y of [190, 400]) {
        box(cabinet, [595, 190, 18], [cx, y, cz + 278], black, 3);
        rod(cabinet, [cx - 75, y + 50, cz + 293], [cx + 75, y + 50, cz + 293], 4, alu);
    }
    for (const y of [1590, 1920]) box(back, [650, 28, 270], [cx, y, bz + 145], walnut, 3);

    const strips = [];
    let atmosphere = ['evening', 1];
    const tone = (mode, channel) => mode.colors[channel] || mode.accent;
    const paint = ({ mat, channel, scale = 1, base }) => {
        const [id, accent] = atmosphere, mode = GAMING_MODES[id] || GAMING_MODES.evening;
        mat.color.set(base || tone(mode, channel)); mat.emissive.set(tone(mode, channel));
        mat.emissiveIntensity = (.08 + mode.rgb * accent * 1.35) * scale;
    };
    const strip = (parent, size, position, channel = 0) => {
        const mat = material(channel ? '#ad84ea' : '#74dce5', { emissive: channel ? '#ab78ff' : '#52e0f0', emissiveIntensity: 1.1 });
        const obj = box(parent, size, position, mat, 2); obj.castShadow = false; strips.push({ mat, channel }); return obj;
    };
    strip(back, [featureW + 50, 15, 15], [featureX, h - 150, bz + 60]);
    strip(back, [15, h - 320, 15], [featureX - featureW / 2 - 25, h / 2 + 20, bz + 60]);
    strip(back, [15, h - 320, 15], [featureX + featureW / 2 + 25, h / 2 + 20, bz + 60], 1);
    strip(back, [w - 100, 12, 15], [0, 95, bz + 23], 1);
    for (const y of [1590, 1920]) strip(back, [600, 8, 10], [cx, y - 15, bz + 273], 1);
    // Under-plinth glow pools on the floor in front of the PC cabinet.
    strip(cabinet, [560, 8, 10], [cx, 26, cz + 268], 0);
    glow(back, [800, 520], [cx, 9, cz + 330], 0, glowMap, .55).rotation.x = -Math.PI / 2;
    // Perimeter cove lines wash the upper walls in the two game channels.
    strip(back, [w - 120, 12, 12], [0, h - 70, bz + 18], 1);
    glow(back, [w - 120, 620], [0, h - 380, bz + 4], 1, washMap, .7);
    strip(side, [12, 12, d - 120], [w / 2 - 18, h - 70, bz + d / 2], 0);
    glow(side, [d - 120, 620], [w / 2 - 4, h - 380, bz + d / 2], 0, washMap, .7).rotation.y = -Math.PI / 2;

    // An original abstract game-world artwork, rather than a brand or game ad.
    const artMap = canvasTexture((c, tw, th) => {
        c.fillStyle = '#172237'; c.fillRect(0, 0, tw, th);
        const g = c.createLinearGradient(0, 0, tw, th); g.addColorStop(0, '#4acee2'); g.addColorStop(1, '#ad79ef');
        c.strokeStyle = g; c.lineWidth = 7;
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(tw * .15, th * (.16 + i * .11)); c.lineTo(tw * .46, th * (.34 + i * .06)); c.lineTo(tw * .85, th * (.13 + i * .1)); c.stroke(); }
        c.fillStyle = '#d5e5e8'; c.beginPath(); c.arc(tw * .76, th * .2, 18, 0, Math.PI * 2); c.fill();
    });
    const art = new THREE.Group(); art.name = 'Abstract gaming artwork'; art.position.set(w / 2 - 24, 1750, layout.compact ? 700 : 350); art.rotation.y = -Math.PI / 2; side.add(art);
    box(art, [layout.compact ? 650 : 900, 700, 28], [0, 0, 0], trim, 3);
    box(art, [layout.compact ? 610 : 860, 660, 4], [0, 0, 17], material('#ffffff', { map: artMap, roughness: .8 }));

    // The library TV's converted panel has no display texture. Give this room
    // instance original game-world artwork, keeping cached prop materials intact.
    const displayMap = !layout.compact ? canvasTexture((c, tw, th) => {
        const sky = c.createLinearGradient(0, 0, 0, th);
        sky.addColorStop(0, '#15243d'); sky.addColorStop(1, '#485b83');
        c.fillStyle = sky; c.fillRect(0, 0, tw, th);
        c.fillStyle = '#b9dce6'; c.beginPath(); c.arc(tw * .72, th * .24, th * .09, 0, Math.PI * 2); c.fill();
        for (let layer = 0; layer < 3; layer++) {
            c.fillStyle = ['#4c6782', '#29435f', '#162c48'][layer];
            c.beginPath(); c.moveTo(0, th);
            for (let i = 0; i <= 8; i++) c.lineTo(i * tw / 8, th * (.45 + layer * .12 - (i % 3) * .08));
            c.lineTo(tw, th); c.fill();
        }
        c.strokeStyle = '#55d7e4'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(tw * .49, th); c.lineTo(tw * .62, th * .69); c.lineTo(tw * .56, th * .57); c.stroke();
        c.fillStyle = '#d6eaf2'; c.font = '20px sans-serif'; c.fillText('NEXT WORLD', 32, 42);
    }, 1024, 576) : null;
    // Library furniture is re-upholstered per instance to the room's palette;
    // the floor lamp's shade becomes an RGB light column on channel two.
    const finishes = { carpet: ['#3a3650', .95, 0], wood: ['#3b2f27', .55, 0], woodDark: ['#262a33', .6, 0], metal: ['#1c2028', .35, .65] };
    room.decorateProp = (object, placement) => {
        if (placement.id === 'samsung-neo-tv') {
            const bezel = mesh(object, new THREE.PlaneGeometry(1.117, .638), new THREE.MeshBasicMaterial({ color: '#101820' }), [0, .3521, .010]);
            const display = mesh(object, new THREE.PlaneGeometry(1.094, .615), new THREE.MeshBasicMaterial({ map: displayMap, toneMapped: false }), [0, .3521, .0108]);
            bezel.name = 'Gaming TV bezel'; display.name = 'Gaming TV display';
            bezel.castShadow = bezel.receiveShadow = display.castShadow = display.receiveShadow = false;
            return;
        }
        if (placement.id === 'kenney-furniture-lamp-square-floor') {
            // Same footprint and identity, shown as a slim RGB light bar (prop units are metres).
            object.traverse(part => { if (part.isMesh) part.visible = false; });
            const bar = material('#3d3848', { emissive: '#a27aff', roughness: .35 }), entry = { mat: bar, channel: 1, scale: .75, base: '#3d3848' };
            strips.push(entry); paint(entry);
            flat(rod(object, [0, 0, 0], [0, .022, 0], .12, ink)); flat(rod(object, [0, .022, 0], [0, .08, 0], .02, ink));
            flat(rod(object, [0, .08, 0], [0, 1.62, 0], .026, bar)); flat(sphere(object, [.03, .02, .03], [0, 1.62, 0], ink));
            return;
        }
        if (!/^kenney-furniture-(lounge|potted-plant)/.test(placement.id)) return;
        const copies = new Map();
        object.traverse(part => {
            if (!part.isMesh) return;
            const source = part.material, finish = finishes[source.name];
            if (!finish) return;
            if (!copies.has(source)) {
                const mat = source.clone(); mat.userData.sharedTextures = true; room.ownedMaterials.add(mat);
                mat.color.set(finish[0]); mat.roughness = finish[1]; mat.metalness = finish[2]; copies.set(source, mat);
            }
            part.material = copies.get(source);
        });
    };

    if (!layout.compact) {
        box(root, [2400, 8, Math.min(2400, (front - loungeZ - 60) * 2)], [-w / 2 + 1400, 4, loungeZ], material('#ffffff', { map: rugTexture('#33304a', '#a58ae8', '#5fc9d4'), roughness: 1 }), 3);
        // TV and console joinery lives along the side; lounge faces across it.
        box(side, [300, 730, 1450], [w / 2 - 160, 390, loungeZ], black, 6);
        box(side, [325, 25, 1475], [w / 2 - 160, 767.5, loungeZ], walnut, 3);
        for (const z of [loungeZ - 470, loungeZ, loungeZ + 470]) box(side, [16, 650, 450], [w / 2 - 318, 385, z], black, 3);
        strip(side, [15, 12, 1400], [w / 2 - 325, 65, loungeZ]);
        strip(side, [15, 12, 1420], [w / 2 - 330, 790, loungeZ], 1);
        glow(side, [1700, 700], [w / 2 - 320, 2, loungeZ], 0, glowMap, .5).rotation.x = -Math.PI / 2;
        // Flush geometric acoustic panels behind the TV, clear of the floor.
        for (let i = 0; i < 5; i++) box(side, [40, 600 + (i % 2) * 170, 210], [w / 2 - 20, 1790, loungeZ - 520 + i * 260], i % 2 ? black : felt, 12);
    }
    if (layout.large) {
        const bar = new THREE.Group(); bar.name = 'Refreshment corner'; back.add(bar);
        box(bar, [630, 740, 600], [-w / 2 + 370, 390, bz + 360], black, 6);
        box(bar, [580, 24, 540], [-w / 2 + 370, 12, bz + 350], ink);
        box(bar, [660, 30, 630], [-w / 2 + 370, 775, bz + 360], walnut, 4);
        strip(bar, [590, 10, 12], [-w / 2 + 370, 90, bz + 665], 1);
        // Large rooms gain a second display wall, rather than oversized props.
        for (const y of [1400, 1830]) {
            box(back, [760, 28, 230], [-w / 2 + 430, y, bz + 130], walnut, 3);
            for (let i = 0; i < 6; i++) box(back, [42, 180 + i % 3 * 15, 90], [-w / 2 + 150 + i * 65, y + 110, bz + 120], material(['#597689', '#9c86a9', '#b9a684'][i % 3]), 2);
        }
    }

    // ---- Set dressing: streaming gear, neon and collectibles ----------------
    // "GG" neon on a clear standoff panel, between the PC tower and the shelves.
    const neon = new THREE.Group(); neon.name = 'GG neon sign'; neon.position.set(cx, 1330, bz); back.add(neon);
    const neonMats = [0, 1].map(channel => { const mat = material('#ffffff', { emissive: '#ffffff', roughness: .3 }); strips.push({ mat, channel, scale: .8, base: '#4a4558' }); return mat; });
    const tube = (points, radius, mat, closed = false) => flat(mesh(neon, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(12, points.length * 3), radius, 8, closed), mat));
    for (const x0 of [-118, 118]) {
        const arc = [];
        for (let i = 0; i <= 28; i++) { const a = Math.PI * (.24 + i / 28 * 1.68); arc.push(new THREE.Vector3(x0 + 92 * Math.cos(a), 25 + 108 * Math.sin(a), 42)); }
        tube(arc, 10, neonMats[1]);
        tube([new THREE.Vector3(x0 + 89, -3, 42), new THREE.Vector3(x0 + 90, 22, 42), new THREE.Vector3(x0 + 62, 25, 42), new THREE.Vector3(x0 + 30, 25, 42)], 10, neonMats[1]);
    }
    const wave = [];
    for (let i = 0; i <= 24; i++) wave.push(new THREE.Vector3(-235 + i * 470 / 24, -130 + 16 * Math.sin(i * Math.PI / 4), 42));
    tube(wave, 7, neonMats[0]);
    box(neon, [580, 330, 6], [0, -10, 24], material('#c8d4e6', { transparent: true, opacity: .1, roughness: .08 }));
    for (const x of [-265, 265]) for (const y of [-150, 130]) rod(neon, [x, y, 0], [x, y, 28], 6, alu);
    bake(neon);
    glow(neon, [720, 560], [0, -10, 6], 1, glowMap, 1.2);

    // On-air light box above the shelves: lit while streaming in the evening.
    const onAirMap = canvasTexture((c, tw, th) => {
        c.fillStyle = '#1d0f15'; c.fillRect(0, 0, tw, th);
        c.strokeStyle = '#ff5d5d'; c.lineWidth = 6; c.strokeRect(16, 16, tw - 32, th - 32);
        c.font = 'bold 82px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = '#ff2d3c'; c.shadowBlur = 20; c.fillStyle = '#ff6a6a'; c.fillText('ON AIR', tw / 2, th / 2 + 4);
    }, 512, 160);
    const live = new THREE.Group(); live.name = 'On-air light box'; live.position.set(cx, h - 300, bz); back.add(live);
    flat(box(live, [400, 130, 50], [0, 0, 25], black, 8));
    const liveMat = material('#ffffff', { map: onAirMap, emissive: '#ffffff', emissiveMap: onAirMap, roughness: .35 });
    flat(mesh(live, new THREE.PlaneGeometry(372, 114), liveMat, [0, 0, 51]));
    glow(live, [700, 300], [0, 0, 4], 'live', glowMap, .7);

    // Wall-arm key light for streaming, aimed at the chair from beside the slats.
    const keyX = layout.large ? featureX + featureW / 2 + 260 : Math.max(featureX - featureW / 2 - 260, -w / 2 + 260);
    const keyLight = new THREE.Group(); keyLight.name = 'Streaming key light'; keyLight.position.set(keyX, 1990, bz); back.add(keyLight);
    box(keyLight, [70, 90, 14], [0, 0, 7], black, 3);
    rod(keyLight, [0, 0, 10], [0, -20, 190], 9, alu);
    const head = new THREE.Group(); head.position.set(0, -30, 205); head.rotation.order = 'YXZ';
    head.rotation.set(.32, Math.atan2(layout.desk[0] - keyX, layout.desk[1] + 980 - bz) * .7, 0); keyLight.add(head);
    box(head, [340, 220, 34], [0, 0, 0], black, 8);
    const streamMat = material('#fff6ea', { emissive: '#fff0dc', roughness: .4 });
    mesh(head, new THREE.PlaneGeometry(316, 196), streamMat, [0, 0, 17.5]);
    bake(keyLight);

    // Collectibles: game cases beside the books, vinyl figures under the plant.
    const shelfDecor = new THREE.Group(); shelfDecor.name = 'Collectible shelf display'; shelfDecor.position.set(cx, 1604, bz + 150); back.add(shelfDecor);
    const caseColors = ['#3e7f9a', '#7b5bd0', '#d8dde6', '#2e3442', '#c45a8f', '#4fb7a6', '#e0a24f', '#5a6bd8', '#2a2e38'];
    const cases = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 190, 135), material('#ffffff', { roughness: .35 }), 10);
    const pose = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < 10; i++) {
        const lean = i === 9;
        pose.position.set(i * 16 + (lean ? 14 : 0), lean ? -2 : 0, 0);
        pose.rotation.set(0, 0, lean ? -.24 : 0); pose.updateMatrix(); cases.setMatrixAt(i, pose.matrix);
        cases.setColorAt(i, color.set(caseColors[i % caseColors.length]));
    }
    cases.position.set(98, 95, 0); cases.name = 'Game case row'; cases.castShadow = false; cases.receiveShadow = true;
    cases.computeBoundingBox(); cases.computeBoundingSphere(); shelfDecor.add(cases);
    box(shelfDecor, [26, 150, 120], [300, 75, 0], ink, 3);
    const vinyl = ['#ece9f2', '#45bccb', '#7c5ad8'].map(c => material(c, { roughness: .42 }));
    [[-262, 0, 0], [-165, 1, 2], [-68, 2, 0]].forEach(([x, suit, helmet], i) => {
        const y = 330, z = (i % 2) * 22;
        rod(shelfDecor, [x, y, z], [x, y + 10, z], 36, ink);
        box(shelfDecor, [56, 70, 40], [x, y + 46, z], vinyl[suit], 10);
        for (const s of [-1, 1]) sphere(shelfDecor, [12, 28, 12], [x + s * 36, y + 52, z], vinyl[suit]);
        box(shelfDecor, [88, 82, 76], [x, y + 122, z], vinyl[helmet], 26);
        box(shelfDecor, [62, 30, 8], [x, y + 124, z + 37], ink, 3);
        sphere(shelfDecor, [6, 6, 3], [x - 14, y + 126, z + 41], alu); sphere(shelfDecor, [6, 6, 3], [x + 14, y + 126, z + 41], alu);
    });
    bake(shelfDecor);

    // A hexagonal RGB light-panel cluster, flush to the console wall.
    const hexCells = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, -1], [2, -1], [-1, 2]], hexChannels = [0, 1, 2, 1, 0, 2, 1];
    const hexR = 105, hexStep = hexR + 7;
    const hexes = new THREE.InstancedMesh(new THREE.CylinderGeometry(hexR, hexR, 22, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ toneMapped: false }), hexCells.length);
    const hexCenter = hexCells.reduce((s, [q, r]) => [s[0] + (q + r / 2) / hexCells.length, s[1] + r / hexCells.length], [0, 0]);
    hexCells.forEach(([q, r], i) => {
        pose.position.set(Math.sqrt(3) * hexStep * (q + r / 2 - hexCenter[0]), -1.5 * hexStep * (r - hexCenter[1]), 0);
        pose.rotation.set(0, 0, 0); pose.updateMatrix(); hexes.setMatrixAt(i, pose.matrix); hexes.setColorAt(i, color.set('#ffffff'));
    });
    const hexPanel = new THREE.Group(); hexPanel.name = 'Hexagon light panels';
    hexPanel.position.set(w / 2, layout.compact ? 1700 : h - 520, bz + 690); hexPanel.rotation.y = -Math.PI / 2; side.add(hexPanel);
    hexes.position.z = 12; hexes.name = 'Hex light tiles'; hexes.castShadow = false; hexes.computeBoundingBox(); hexes.computeBoundingSphere(); hexPanel.add(hexes);
    glow(hexPanel, [1100, 950], [-50, 0, 3], 0, glowMap, .75);
    glow(hexPanel, [800, 700], [120, -70, 4], 1, glowMap, .6);

    if (layout.compact) {
        // Controller display ledge under the artwork, with a headset on a hook.
        const ledge = new THREE.Group(); ledge.name = 'Controller display ledge';
        ledge.position.set(w / 2, 1150, 700); ledge.rotation.y = -Math.PI / 2; side.add(ledge);
        box(ledge, [740, 22, 120], [0, 0, 60], walnut, 4);
        rod(ledge, [-300, -11, 4], [-300, -11, 110], 7, alu); rod(ledge, [300, -11, 4], [300, -11, 110], 7, alu);
        const shells = ['#e8e6ef', '#2b2f3a', '#6a50c8'].map(c => material(c, { roughness: .45 }));
        const keys = material('#5fe0ea', { emissive: '#3fd6e6', emissiveIntensity: .6 });
        shells.forEach((shell, i) => {
            const pad = new THREE.Group(); pad.position.set(-235 + i * 200, 11 + 76, 48); pad.rotation.set(-.2, (i - 1) * .12, 0); ledge.add(pad);
            box(pad, [150, 90, 30], [0, 0, 0], shell, 12);
            for (const s of [-1, 1]) sphere(pad, [30, 42, 15], [s * 52, -36, 0], shell);
            rod(pad, [-46, 10, 14], [-46, 10, 24], 11, ink); rod(pad, [26, -18, 14], [26, -18, 24], 11, ink);
            box(pad, [30, 9, 6], [-24, -18, 16], ink, 2); box(pad, [9, 30, 6], [-24, -18, 16], ink, 2);
            for (const [bx, by] of [[50, 22], [62, 10], [38, 10], [50, -2]]) sphere(pad, [6, 6, 4], [bx, by, 15], keys);
        });
        rod(ledge, [440, 12, 4], [440, 12, 78], 6, alu);
        mesh(ledge, new THREE.TorusGeometry(77, 9, 8, 20, Math.PI), ink, [440, -60, 62]);
        for (const s of [-1, 1]) rod(ledge, [440 + s * 64, -100, 62], [440 + s * 90, -100, 62], 46, ink);
        bake(ledge);
        // An original retro-horizon print toward the room's open front.
        const posterMap = canvasTexture((c, tw, th) => {
            const sky = c.createLinearGradient(0, 0, 0, th * .62);
            sky.addColorStop(0, '#1a1438'); sky.addColorStop(.6, '#6b3a8f'); sky.addColorStop(1, '#f07aa6');
            c.fillStyle = sky; c.fillRect(0, 0, tw, th);
            const sun = c.createLinearGradient(0, th * .22, 0, th * .58); sun.addColorStop(0, '#ffd27a'); sun.addColorStop(1, '#ff5f9e');
            c.fillStyle = sun; c.beginPath(); c.arc(tw / 2, th * .45, tw * .26, Math.PI, 0); c.fill();
            c.fillStyle = '#6b3a8f'; for (let i = 0; i < 5; i++) c.fillRect(0, th * (.37 + i * .045), tw, 4 + i * 2);
            c.fillStyle = '#120f26'; c.fillRect(0, th * .58, tw, th * .42);
            c.strokeStyle = '#4fe0ee'; c.lineWidth = 2;
            for (let i = 0; i < 9; i++) { const y = th * .58 + (i * i) * th * .0062; c.beginPath(); c.moveTo(0, y); c.lineTo(tw, y); c.stroke(); }
            for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(tw / 2 + i * 14, th * .58); c.lineTo(tw / 2 + i * 70, th); c.stroke(); }
            c.fillStyle = '#e8ddff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('LEVEL 99', tw / 2, th * .12);
        }, 512, 704);
        const poster = new THREE.Group(); poster.name = 'Retro horizon print'; poster.position.set(w / 2 - 14, 1640, 1640); poster.rotation.y = -Math.PI / 2; side.add(poster);
        flat(box(poster, [470, 640, 24], [0, 0, 0], trim, 3));
        flat(box(poster, [430, 600, 4], [0, 0, 13], material('#ffffff', { map: posterMap, roughness: .7 })));
    }

    // Low fixture geometry remains readable from a human-height camera, with
    // only four practical lights and no extra shadow maps for the RGB channels.
    const ceiling = new THREE.Group(); ceiling.name = 'Gaming ceiling light'; root.add(ceiling); room.ceilingFixture = ceiling;
    box(ceiling, [750, 35, 420], [0, h - 25, 500], black, 10);
    const diffuser = material('#dce4ed', { emissive: '#dce4ed', emissiveIntensity: .4 });
    const fixture = box(ceiling, [700, 8, 370], [0, h - 47, 500], diffuser, 10); fixture.castShadow = false;
    const lights = [
        { at: [layout.desk[0] - 650, 1750, bz + 340], color: '#52dbe9', power: 3.2, range: 3300, rgb: true, channel: 0 },
        { at: [cx, 1430, bz + 380], color: '#aa80ef', power: 2.8, range: 3100, rgb: true, channel: 1 },
        { at: [w / 2 - 450, 1180, layout.compact ? 750 : loungeZ], color: '#aa80ef', power: 3.6, range: 3300, rgb: true, channel: 1 },
        { at: [0, h - 170, 550], color: '#dce5f3', power: 3.5, range: 4800, rgb: false }
    ].map(spec => {
        const light = new THREE.PointLight(spec.color, 0, spec.range * root.scale.x, 2); light.position.set(...spec.at); root.add(light);
        return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 };
    });
    const tile = new THREE.Color(), frost = new THREE.Color('#c7cad6');
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = GAMING_MODES[modeId] || GAMING_MODES.evening, dark = mode.power < .5;
        atmosphere = [modeId, accent];
        // Window: sky gradient, sun or moon, and a skyline that lights up after dark.
        const c = skyCanvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        if (dark) { c.fillStyle = '#ffffffb0'; for (let i = 0; i < 70; i++) c.fillRect((i * 97) % 512, (i * 57) % 300, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5); }
        const [sx, sy, sr, sc] = modeId === 'evening' ? [150, 360, 46, '#ffd9a0'] : dark ? [395, 95, 22, '#e6ecf7'] : [400, 150, 30, '#fff7e2'];
        const halo = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 4); halo.addColorStop(0, sc); halo.addColorStop(.25, sc + '88'); halo.addColorStop(1, sc + '00');
        c.fillStyle = halo; c.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 14; i++) {
            const bx = i * 38 - 6, top = 330 + ((i * 53) % 110), bw = 30 + (i % 3) * 8;
            c.fillStyle = dark ? '#151b2b' : modeId === 'evening' ? '#4b4660' : '#5f7282'; c.fillRect(bx, top, bw, 512 - top);
            if (modeId === 'morning' || modeId === 'afternoon') continue;
            for (let y = top + 10; y < 500; y += 16) for (let x = bx + 5; x < bx + bw - 5; x += 9)
                if ((x * 7 + y * 3 + i) % 5 < 2) { c.fillStyle = (x + y) % 3 ? '#ffd58a' : '#7fe3f0'; c.fillRect(x, y, 4, 6); }
        }
        skyMap.needsUpdate = true;
        strips.forEach(paint);
        const lit = Math.min(1.25, mode.rgb * accent), unlit = .12 + .4 * Math.max(0, 1 - lit);
        hexChannels.forEach((channel, i) => hexes.setColorAt(i, tile.set(tone(mode, channel)).multiplyScalar(lit * 1.05).add(color.copy(frost).multiplyScalar(unlit))));
        hexes.instanceColor.needsUpdate = true;
        glows.forEach(({ mat, channel, strength }) => {
            const level = channel === 'live' ? mode.live : mode.rgb * accent * .55;
            mat.color.set(channel === 'live' ? '#ff3346' : tone(mode, channel)).multiplyScalar(level * strength);
        });
        liveMat.emissiveIntensity = .05 + mode.live * 1.6;
        streamMat.emissiveIntensity = mode.stream * 1.3;
        lights.forEach(spec => { if (spec.rgb) spec.light.color.set(mode.colors[spec.channel]); spec.light.intensity = spec.power * (spec.rgb ? mode.rgb * (mode.balance?.[spec.channel] ?? 1) : mode.practical) * accent; });
        diffuser.emissiveIntensity = .2 + mode.practical * .7;
        root.userData.atmosphere = modeId;
    };
    room.roomAtmosphere('evening');
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[wall, 'plaster'], [trim, 'powder'], [walnut, 'wood'], [black, 'powder'], [felt, 'fabric'], [alu, 'metal']]) mat.userData.roomSurface = surface;
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
