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
    return [id, { id, name: names[index], width, depth, height, back, desk, props, compact, large, cabinetX, cabinetZ, loungeZ,
        daylight: [-width / 2 + 100, 450] }];
}));
export const gamingLayoutById = id => GAMING_LAYOUTS[id] || GAMING_LAYOUTS.apartment;
export const gamingLayoutForSize = size => GAMING_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

export const GAMING_MODES = {
    morning: { label: 'Morning', description: 'Daylight reset · standing stretch and setup', key: '#ffe9cb', fill: '#d5ebff', accent: '#80dce1', power: 1.8, ambient: .48, bounce: .65, exposure: 1.08, sky: ['#89bbd6', '#e8e1cb'], practical: .25, rgb: .16, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false, colors: ['#63d8ef', '#a39ff0'] },
    afternoon: { label: 'Afternoon', description: 'Balanced daylight · seated play and streaming', key: '#f6eedf', fill: '#d8e6f7', accent: '#99d5e6', power: 1.35, ambient: .42, bounce: .6, exposure: 1.08, sky: ['#a6c5db', '#e9e4d6'], practical: .4, rgb: .3, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false, colors: ['#5be3ec', '#a092ef'] },
    evening: { label: 'Evening', description: 'Golden-hour window · cyan and violet game lighting', key: '#ffcb94', fill: '#bdc8ef', accent: '#b192f0', power: .78, ambient: .3, bounce: .42, exposure: 1.15, sky: ['#8c85ac', '#dfac89'], practical: .8, rgb: 1, height: 28, tilt: 0, offset: [0, 80], yaw: 0, leds: true, color: '#40eaff', colors: ['#40d8ed', '#a27aff'] },
    night: { label: 'Night', description: 'Low-glare bias lighting · late-night immersion', key: '#bbc9f4', fill: '#bdc8ec', accent: '#af91ed', power: .25, ambient: .24, bounce: .32, exposure: 1.2, sky: ['#17263f', '#344b6b'], practical: .55, rgb: 1.15, height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#8b6cff', colors: ['#49dce5', '#9675ff'] },
    party: { label: 'Party', description: 'Social play · desk turned toward the lounge', key: '#c7d1f7', fill: '#c7b6ee', accent: '#eea0d5', power: .42, ambient: .3, bounce: .38, exposure: 1.16, sky: ['#20283f', '#575076'], practical: .8, rgb: 1.3, height: 43.5, tilt: -5, offset: [60, 300], yaw: -12, leds: true, color: '#ff75cf', colors: ['#61deed', '#ff78cb'] }
};

function canvasTexture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; return map;
}

export function buildGamingRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod } = helpers;
    const { width: w, depth: d, height: h, back: bz, cabinetX: cx, cabinetZ: cz, loungeZ } = layout;
    const front = bz + d;
    const wall = material('#444c60', { roughness: .95 }), trim = material('#252c3b'), walnut = material('#79644f');
    const black = material('#252c37', { roughness: .8 }), felt = material('#394354', { roughness: 1 });
    const floorMap = canvasTexture((c, tw, th) => {
        c.fillStyle = '#7b695a'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 6; i++) {
            c.fillStyle = ['#897565', '#807061', '#746252'][i % 3]; c.fillRect(i * tw / 6, 0, tw / 6 - 2, th);
            c.strokeStyle = '#4a3c2d28'; c.lineWidth = 1;
            for (let j = 0; j < 20; j++) {
                const x = i * tw / 6 + 4 + j * 3.8; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 3, th / 3, x - 2, th * .7, x, th); c.stroke();
            }
            c.fillStyle = '#40352850'; c.fillRect(i * tw / 6, (i % 3 + 1) * th / 4, tw / 6, 1);
        }
    }, 512, 1024); floorMap.repeat.set(w / 1000, d / 1800);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .78 }));
    const rugMap = canvasTexture((c, tw, th) => {
        c.fillStyle = '#434956'; c.fillRect(0, 0, tw, th);
        c.strokeStyle = '#89949c23'; c.lineWidth = 1;
        for (let n = 0; n < tw; n += 5) { c.beginPath(); c.moveTo(n, 0); c.lineTo(n, th); c.stroke(); }
        c.strokeStyle = '#788697'; c.lineWidth = 5; c.strokeRect(16, 16, tw - 32, th - 32);
    }); rugMap.repeat.set(2, 2);
    box(root, [layout.compact ? 1850 : 2350, 5, 1850], [layout.desk[0], 2.5, layout.desk[1] + 650], material('#ffffff', { map: rugMap, roughness: 1 }), 6);

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
    box(entry, [28, 2010, 770], [-w / 2 + 32, 1005, doorZ], material('#65707d'), 4);
    rod(entry, [-w / 2 + 52, 1000, doorZ - 285], [-w / 2 + 52, 1000, doorZ - 210], 8, material('#aab6c3', { metalness: .8 }));
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    // PC plinth and display shelves have real support heights matching the props.
    const cabinet = new THREE.Group(); cabinet.name = 'PC display cabinet'; back.add(cabinet);
    box(cabinet, [620, 560, 550], [cx, 300, cz], black, 6);
    box(cabinet, [650, 30, 570], [cx, 595, cz], walnut, 4);
    for (const x of [cx - 230, cx + 230]) for (const z of [cz - 205, cz + 205]) rod(cabinet, [x, 0, z], [x, 40, z], 12, black);
    for (const y of [190, 400]) {
        box(cabinet, [595, 190, 18], [cx, y, cz + 278], black, 3);
        rod(cabinet, [cx - 75, y + 50, cz + 293], [cx + 75, y + 50, cz + 293], 4, trim);
    }
    for (const y of [1590, 1920]) box(back, [650, 28, 270], [cx, y, bz + 145], walnut, 3);

    const strips = [];
    const strip = (parent, size, position, channel = 0) => {
        const mat = material(channel ? '#ad84ea' : '#74dce5', { emissive: channel ? '#ab78ff' : '#52e0f0', emissiveIntensity: 1.1 });
        const obj = box(parent, size, position, mat, 2); obj.castShadow = false; strips.push({ mat, channel }); return obj;
    };
    strip(back, [featureW + 50, 15, 15], [featureX, h - 150, bz + 60]);
    strip(back, [15, h - 320, 15], [featureX - featureW / 2 - 25, h / 2 + 20, bz + 60]);
    strip(back, [15, h - 320, 15], [featureX + featureW / 2 + 25, h / 2 + 20, bz + 60], 1);
    strip(back, [w - 100, 12, 15], [0, 95, bz + 23], 1);
    for (const y of [1590, 1920]) strip(back, [600, 8, 10], [cx, y - 15, bz + 273], 1);

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
    room.decorateProp = (object, placement) => {
        if (placement.id !== 'samsung-neo-tv') return;
        const bezel = mesh(object, new THREE.PlaneGeometry(1.117, .638), new THREE.MeshBasicMaterial({ color: '#101820' }), [0, .3521, .010]);
        const display = mesh(object, new THREE.PlaneGeometry(1.094, .615), new THREE.MeshBasicMaterial({ map: displayMap, toneMapped: false }), [0, .3521, .0108]);
        bezel.name = 'Gaming TV bezel'; display.name = 'Gaming TV display';
        bezel.castShadow = bezel.receiveShadow = display.castShadow = display.receiveShadow = false;
    };

    if (!layout.compact) {
        box(root, [2400, 5, Math.min(2400, (front - loungeZ - 60) * 2)], [-w / 2 + 1400, 2.5, loungeZ], felt, 12);
        // TV and console joinery lives along the side; lounge faces across it.
        box(side, [300, 730, 1450], [w / 2 - 160, 390, loungeZ], black, 6);
        box(side, [325, 25, 1475], [w / 2 - 160, 767.5, loungeZ], walnut, 3);
        for (const z of [loungeZ - 470, loungeZ, loungeZ + 470]) box(side, [16, 650, 450], [w / 2 - 318, 385, z], black, 3);
        strip(side, [15, 12, 1400], [w / 2 - 325, 65, loungeZ]);
        strip(side, [15, 12, 1420], [w / 2 - 330, 790, loungeZ], 1);
        // Flush geometric acoustic panels behind the TV, clear of the floor.
        for (let i = 0; i < 5; i++) box(side, [40, 600 + (i % 2) * 170, 210], [w / 2 - 20, 1790, loungeZ - 520 + i * 260], i % 2 ? black : felt, 12);
    }
    if (layout.large) {
        const bar = new THREE.Group(); bar.name = 'Refreshment corner'; back.add(bar);
        box(bar, [630, 740, 600], [-w / 2 + 370, 390, bz + 360], black, 6);
        box(bar, [660, 30, 630], [-w / 2 + 370, 775, bz + 360], walnut, 4);
        strip(bar, [590, 10, 12], [-w / 2 + 370, 90, bz + 665], 1);
        // Large rooms gain a second display wall, rather than oversized props.
        for (const y of [1400, 1830]) {
            box(back, [760, 28, 230], [-w / 2 + 430, y, bz + 130], walnut, 3);
            for (let i = 0; i < 6; i++) box(back, [42, 180 + i % 3 * 15, 90], [-w / 2 + 150 + i * 65, y + 110, bz + 120], material(['#597689', '#9c86a9', '#b9a684'][i % 3]), 2);
        }
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
    room.roomAtmosphere = (modeId, accent = 1) => {
        const mode = GAMING_MODES[modeId] || GAMING_MODES.evening;
        const c = skyCanvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        c.fillStyle = '#536674'; for (let i = 0; i < 12; i++) c.fillRect(i * 45, 475 - i % 3 * 20, 35, 80);
        skyMap.needsUpdate = true;
        strips.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .08 + mode.rgb * accent * 1.35; });
        lights.forEach(spec => { if (spec.rgb) spec.light.color.set(mode.colors[spec.channel]); spec.light.intensity = spec.power * (spec.rgb ? mode.rgb : mode.practical) * accent; });
        diffuser.emissiveIntensity = .2 + mode.practical * .7;
        root.userData.atmosphere = modeId;
    };
    room.roomAtmosphere('evening');
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[wall, 'plaster'], [trim, 'powder'], [walnut, 'wood'], [black, 'powder'], [felt, 'fabric']]) mat.userData.roomSurface = surface;
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
