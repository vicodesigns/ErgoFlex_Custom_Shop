import * as THREE from 'three';

// Architectural dimensions and prop positions are millimetres, never resized
// to make the larger desk fit. The open front is a viewing cutaway.
export const HOME_LAYOUTS = {
    apartment: { id: 'apartment', name: 'Apartment office', width: 2800, depth: 3200, height: 2600, back: -1050, desk: [0, -310],
        props: [
            { id: 'steelcase-leap-v2', at: [0, 0, 680], turn: 180 },
            { id: 'armchair-poppi', at: [690, 0, 1450], turn: -140 },
            { id: 'journal', at: [80, 451, 1870], turn: 15 },
            { id: 'ficus', at: [-1110, 0, -710] },
            { id: 'modern-lamp', at: [990, 741, -850] }
        ] },
    house: { id: 'house', name: 'Dedicated home office', width: 3600, depth: 4200, height: 2700, back: -1450, desk: [-160, -540],
        props: [
            { id: 'steelcase-leap-v2', at: [-160, 0, 460], turn: 180 },
            { id: 'armchair-poppi', at: [-1150, 0, 1820], turn: 145 },
            { id: 'journal', at: [-475, 451, 2100], turn: -12 },
            { id: 'monstera', at: [1300, 0, 2090] },
            { id: 'ficus', at: [-1470, 0, -1090] },
            { id: 'modern-lamp', at: [1260, 741, -1250] }
        ] }
};
// Room choice is independent of desktop size. Furnishings keep their real size.
Object.assign(HOME_LAYOUTS, {
    spacious: { id: 'spacious', name: 'Spacious home office', width: 4200, depth: 4800, height: 2800, back: -1600, desk: [-300, -600], table: [-650, 2260],
        props: [
            { id: 'steelcase-leap-v2', at: [-300, 0, 450], turn: 180 },
            { id: 'armchair-poppi', at: [-1420, 0, 1970], turn: 145 },
            { id: 'journal', at: [-650, 451, 2260], turn: -12 },
            { id: 'monstera', at: [1600, 0, 2560] },
            { id: 'ficus', at: [-1750, 0, -1210] },
            { id: 'modern-lamp', at: [1560, 741, -1400] }
        ] },
    premium: { id: 'premium', name: 'Premium home office', width: 5200, depth: 5800, height: 3000, back: -1850, desk: [-450, -700], table: [-1100, 2550],
        props: [
            { id: 'steelcase-leap-v2', at: [-450, 0, 350], turn: 180 },
            { id: 'armchair-poppi', at: [-1900, 0, 2190], turn: 145 },
            { id: 'journal', at: [-1100, 451, 2550], turn: -12 },
            { id: 'sofa-fabric', at: [650, 0, 3130], turn: 180 },
            { id: 'monstera', at: [2070, 0, 3100] },
            { id: 'ficus', at: [-2160, 0, -1450] },
            { id: 'modern-lamp', at: [2060, 741, -1650] }
        ] },
    executive: { id: 'executive', name: 'Executive office suite', width: 6500, depth: 7000, height: 3200, back: -2200, desk: [-650, -850], table: [-1630, 3000],
        props: [
            { id: 'steelcase-leap-v2', at: [-650, 0, 250], turn: 180 },
            { id: 'armchair-poppi', at: [-2460, 0, 2590], turn: 145 },
            { id: 'armchair-poppi', at: [-2410, 0, 3880], turn: 35 },
            { id: 'journal', at: [-1630, 451, 3000], turn: -12 },
            { id: 'sofa-fabric', at: [850, 0, 3820], turn: 180 },
            { id: 'monstera', at: [2630, 0, 3980] },
            { id: 'ficus', at: [-2720, 0, -1750] },
            { id: 'modern-lamp', at: [2650, 741, -2000] }
        ] }
});
// New library accents keep their physical dimensions in every room. Append
// defaults so existing scene-asset keys and saved edits keep their identities.
for (const layout of Object.values(HOME_LAYOUTS)) {
    const apartment = layout.id === 'apartment';
    const cx = apartment ? 995 : layout.width / 2 - 570;
    const chair = layout.props.find(p => p.id === 'armchair-poppi');
    layout.readingLight = apartment ? [-430, 1870] : [-layout.width / 2 + 220, chair.at[2] + 680];
    layout.props.push(
        { id: 'kenney-furniture-books', at: [cx - 80, 1384, layout.back + 110] },
        { id: 'kenney-furniture-plant-small1', at: [cx + 40, 1784, layout.back + 110] },
        { id: 'kenney-furniture-lamp-round-floor', at: [layout.readingLight[0], 0, layout.readingLight[1]] }
    );
    if (!apartment) {
        layout.props.find(p => p.id === 'modern-lamp').at[0] = cx + 200;
        layout.props.push(
            { id: 'kenney-furniture-kitchen-coffee-machine', at: [cx - 220, 741, layout.back + 190] },
            { id: 'quaternius-guitar', at: [-layout.width / 2 + 85, 650, 150], turn: 90 }
        );
    }
}
export const homeLayoutForSize = size => HOME_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const homeLayoutById = id => HOME_LAYOUTS[id] || HOME_LAYOUTS.apartment;

export const HOME_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing work', key: '#fff0d2', fill: '#deebff', accent: '#ffd59c', power: 1.8, ambient: .4, bounce: .65, exposure: 1.05, sky: ['#84b7d5', '#eee2c8'], practical: .15, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft daylight · seated focus', key: '#fff3dd', fill: '#e4edf6', accent: '#ffd1a1', power: 1.35, ambient: .42, bounce: .65, exposure: 1.08, sky: ['#9ec2d4', '#f7eddc'], practical: .3, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden hour · reading and planning', key: '#ffb878', fill: '#c3cce8', accent: '#ffc48b', power: .8, ambient: .25, bounce: .4, exposure: 1.1, sky: ['#767fa6', '#efae80'], practical: 1, height: 28, tilt: 12, offset: [0, 80], yaw: -4, leds: true, color: '#ffd29b' },
    night: { label: 'Night', description: 'Warm task lamps · quiet late work', key: '#b4c9ef', fill: '#a8bce1', accent: '#ffcb87', power: .18, ambient: .16, bounce: .22, exposure: 1.15, sky: ['#18243f', '#3d5274'], practical: 1.3, height: 28, tilt: 0, offset: [0, 120], yaw: 0, leds: true, color: '#ffe1ad' },
    party: { label: 'Party', description: 'Color accents · desk turned toward the room', key: '#b7caff', fill: '#afa3ef', accent: '#ef92ca', power: .3, ambient: .18, bounce: .25, exposure: 1.1, sky: ['#1d2546', '#4b4b73'], practical: .7, height: 43.5, tilt: 0, offset: [50, 200], yaw: -12, leds: true, color: '#bb70ff' }
};

// Deterministic original surface patterns: stable across room switches and
// downloadable projects, with no network textures or additional asset loads.
function texture(draw, width = 512, height = 512) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function random(seed = 19) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function oakTexture() {
    return texture((ctx, w, h) => {
        const r = random();
        for (let p = 0; p < 4; p++) {
            const x = p * w / 4;
            ctx.fillStyle = ['#bd9a72', '#c7a580', '#bfa07b', '#c9ab87'][p]; ctx.fillRect(x, 0, w / 4, h);
            for (let n = 0; n < 150; n++) {
                const gx = x + r() * w / 4;
                ctx.strokeStyle = `rgba(76,48,25,${.015 + r() * .065})`; ctx.lineWidth = .5 + r(); ctx.beginPath();
                ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + 6, h / 3, gx - 9, h * .7, gx + 3, h); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(61,44,27,.18)'; ctx.fillRect(x, 0, 1, h);
            ctx.fillRect(x, p % 2 ? h * .3 : h * .7, w / 4, 1);
        }
    }, 512, 1024);
}
function artTexture() {
    return texture((c, w, h) => {
        c.fillStyle = '#eee6d8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#b47d5f'; c.beginPath(); c.arc(w * .65, h * .35, w * .22, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#607768'; c.beginPath(); c.moveTo(0, h * .63); c.bezierCurveTo(w * .45, h * .25, w * .6, h * .92, w, h * .53); c.lineTo(w, h); c.lineTo(0, h); c.fill();
        c.strokeStyle = '#dbcaaf'; c.lineWidth = 6;
        for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(w * .34, h * .82, 80 + i * 18, Math.PI, Math.PI * 2); c.stroke(); }
    }, 512, 640);
}

export function buildHomeOffice(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere } = helpers;
    const { width: w, depth: d, height: h, back: bz } = layout;
    const front = bz + d, house = layout.id !== 'apartment', premium = ['premium', 'executive'].includes(layout.id);
    const wallMat = material('#d9d9c8', { roughness: .95 }), trim = material('#e9e5da'), oakMap = oakTexture();
    oakMap.repeat.set(w / 800, d / 1600);
    const oak = material('#ffffff', { map: oakMap, roughness: .8 });
    const joinery = material('#b89971', { roughness: .75 }), sage = material('#647769', { roughness: .8 }), brass = material('#b49561', { metalness: .7, roughness: .35 });
    box(root, [w, 30, d], [0, -15, bz + d / 2], oak);
    const rugMap = texture((c, tw, th) => {
        c.fillStyle = '#d9d1bc'; c.fillRect(0, 0, tw, th);
        c.strokeStyle = 'rgba(90,78,58,.13)'; c.lineWidth = 1;
        for (let i = 0; i < tw; i += 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, th); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(tw, i); c.stroke(); }
    }); rugMap.repeat.set(4, 5);
    box(root, [house ? 2250 : 1800, 5, house ? 2250 : 1900], [layout.desk[0], 2.5, house ? 270 : 480], material('#ffffff', { map: rugMap, roughness: 1 }), 6);
    if (house) box(root, [1550, 5, 1350], [-970, 2.5, 1910], material('#bca98b', { roughness: 1 }), 8);
    const tableAt = layout.table || (house ? [-475, 2100] : [80, 1870]);
    const table = new THREE.Group(); table.name = 'Reading side table'; root.add(table);
    mesh(table, new THREE.CylinderGeometry(230, 230, 25, 40), joinery, [tableAt[0], 437.5, tableAt[1]]);
    mesh(table, new THREE.CylinderGeometry(75, 95, 415, 32), joinery, [tableAt[0], 217.5, tableAt[1]]);
    mesh(table, new THREE.CylinderGeometry(150, 150, 10, 32), joinery, [tableAt[0], 5, tableAt[1]]);

    // Four wall sections frame a genuine opening, rather than a luminous pane
    // placed on an opaque wall. Window orientation stays tied to the room.
    const back = new THREE.Group(); back.name = 'Window wall'; root.add(back);
    const ww = premium ? 2400 : house ? 1700 : 1250, wx = premium ? -900 : house ? -670 : -520, bottom = 850, wh = premium ? 1750 : 1400;
    const left = wx - ww / 2, right = wx + ww / 2;
    box(back, [left + w / 2, h, 80], [(left - w / 2) / 2, h / 2, bz - 40], wallMat);
    box(back, [w / 2 - right, h, 80], [(right + w / 2) / 2, h / 2, bz - 40], wallMat);
    box(back, [ww, bottom, 80], [wx, bottom / 2, bz - 40], wallMat);
    box(back, [ww, h - bottom - wh, 80], [wx, (h + bottom + wh) / 2, bz - 40], wallMat);
    box(back, [w, 85, 18], [0, 42.5, bz + 9], trim);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = 512; skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const sky = box(back, [ww, wh, 8], [wx, bottom + wh / 2, bz - 65], new THREE.MeshBasicMaterial({ map: skyMap }));
    sky.castShadow = false; sky.receiveShadow = false;
    for (const x of [left, wx, right]) box(back, [35, wh + 65, 65], [x, bottom + wh / 2, bz + 8], trim);
    for (const y of [bottom, bottom + wh / 2, bottom + wh]) box(back, [ww + 65, 35, 65], [wx, y, bz + 8], trim);
    box(back, [ww + 120, 35, 150], [wx, bottom - 25, bz + 50], joinery, 3);
    rod(back, [left - 190, bottom + wh + 120, bz + 105], [right + 190, bottom + wh + 120, bz + 105], 12, brass);
    const linen = material('#eae4d7', { side: THREE.DoubleSide, roughness: 1 });
    for (const end of [left - 120, right + 120]) {
        const geo = new THREE.PlaneGeometry(310, bottom + wh - 200, 30, 1), p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 155) / 310 * Math.PI * 10) * 18);
        geo.computeVertexNormals(); mesh(back, geo, linen, [end, (bottom + wh - 200) / 2 + 285, bz + 120]);
    }
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });

    const side = new THREE.Group(); side.name = 'Storage and art wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], wallMat);
    box(side, [18, 85, d], [w / 2 - 9, 42.5, bz + d / 2], trim);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    // Entry wall is also a cutaway, with an 820 mm door and continuous trim.
    const entry = new THREE.Group(); entry.name = 'Entry wall'; root.add(entry);
    box(entry, [80, h, d], [-w / 2 - 40, h / 2, bz + d / 2], wallMat);
    box(entry, [18, 85, d], [-w / 2 + 9, 42.5, bz + d / 2], trim);
    const doorZ = front - 650;
    box(entry, [24, 2120, 900], [-w / 2 + 14, 1060, doorZ], trim);
    box(entry, [28, 2030, 820], [-w / 2 + 30, 1020, doorZ], material('#b9aa91'), 4);
    rod(entry, [-w / 2 + 52, 1000, doorZ - 310], [-w / 2 + 52, 1000, doorZ - 240], 9, brass);
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    const cx = house ? w / 2 - 570 : 995, cw = house ? 920 : 550;
    const cabinet = new THREE.Group(); cabinet.name = 'Oak storage'; root.add(cabinet);
    box(cabinet, [cw, 660, 350], [cx, 400, bz + 190], sage, 5);
    box(cabinet, [cw + 25, 30, 375], [cx, 725, bz + 190], joinery, 4);
    for (const x of [cx - cw / 2 + 55, cx + cw / 2 - 55]) for (const z of [bz + 75, bz + 315]) rod(cabinet, [x, 0, z], [x, 85, z], 14, brass);
    for (const x of [cx - cw / 4, cx + cw / 4]) {
        box(cabinet, [cw / 2 - 8, 620, 12], [x, 395, bz + 371], sage, 2);
        rod(cabinet, [x + 70, 570, bz + 386], [x + 70, 640, bz + 386], 5, brass);
    }
    // Compact display shelves above storage, clear of the lifting desk.
    for (const y of [1370, 1770]) {
        box(back, [cw + 35, 28, 210], [cx, y, bz + 110], joinery, 2);
        if (y === 1770) for (let i = 0; i < 5; i++) box(back, [25 + i % 2 * 8, 155 + i % 3 * 20, 100], [cx - cw / 2 + 60 + i * 36, y + 95, bz + 100], material(['#d7c8a8', '#7c8972', '#aa735c'][i % 3]), 1);
        sphere(back, [45, 65, 45], [cx + cw / 2 - 70, y + 78, bz + 100], material('#c4b5a2'));
    }
    if (house) {
        // A small wall hanger supports the guitar without filling floor space.
        const hanger = new THREE.Group(); hanger.name = 'Guitar wall hanger'; entry.add(hanger);
        const black = material('#282b2c', { metalness: .35, roughness: .65 });
        box(hanger, [15, 120, 70], [-w / 2 + 12, 1550, 150], black, 3);
        for (const z of [125, 175]) rod(hanger, [-w / 2 + 20, 1515, z], [-w / 2 + 100, 1515, z], 7, black);
    }
    const frame = new THREE.Group(); frame.position.set(w / 2 - 36, 1610, house ? 550 : 610); frame.rotation.y = -Math.PI / 2; side.add(frame);
    box(frame, [660, 810, 28], [0, 0, 0], joinery, 3);
    box(frame, [615, 765, 5], [0, 0, 17], trim);
    box(frame, [560, 700, 3], [0, 0, 21], material('#ffffff', { map: artTexture(), roughness: .9 }));
    if (house) {
        // Low storage along the side leaves a full route from entry to desk.
        box(side, [310, 650, premium ? 900 : 1300], [w / 2 - 165, 340, premium ? 450 : 750], sage, 6);
        box(side, [335, 25, premium ? 930 : 1330], [w / 2 - 166, 678, premium ? 450 : 750], joinery, 3);
        for (const z of (premium ? [160, 450, 740] : [310, 750, 1190])) box(side, [12, 590, premium ? 275 : 410], [w / 2 - 327, 350, z], sage, 2);
    }
    if (premium) {
        // Extra floor area becomes a lounge and a library, not scaled furniture.
        const loungeZ = layout.id === 'executive' ? 3190 : 2510;
        box(root, [3000, 5, 2100], [550, 2.5, loungeZ + 400], material('#c3b59e', { roughness: 1 }), 8);
        const coffee = new THREE.Group(); coffee.name = 'Lounge coffee table'; root.add(coffee);
        box(coffee, [1050, 35, 520], [700, 380, loungeZ], joinery, 16);
        for (const x of [290,1110]) for (const z of [loungeZ-180,loungeZ+180]) rod(coffee,[x,0,z],[x,365,z],14,brass);
        const bookcase = new THREE.Group(); bookcase.name = 'Built-in library'; side.add(bookcase);
        const z = 1780;
        box(bookcase, [24, 2140, 1500], [w / 2 - 12, 1090, z], sage, 3);
        for (const end of [z - 738, z + 738]) box(bookcase, [310, 2140, 24], [w / 2 - 165, 1090, end], sage, 3);
        box(bookcase, [310, 60, 1500], [w / 2 - 165, 30, z], sage, 3);
        for (const y of [470,870,1270,1670,2070]) {
            box(bookcase,[320,25,1460],[w/2-180,y,z],joinery,2);
            for (let n=0;n<14;n++) box(bookcase,[140,170+(n%3)*22,35],[w/2-200,y+105,z-650+n*85],material(['#d7c8a8','#61786d','#ad785e'][n%3]),1);
        }
        if (layout.id === 'executive') {
            const gallery = new THREE.Group(); gallery.name = 'Gallery art'; gallery.position.set(-w/2+35,1650,1000); gallery.rotation.y=Math.PI/2; entry.add(gallery);
            box(gallery,[1100,1100,30],[0,0,0],joinery,3);
            box(gallery,[1040,1040,5],[0,0,18],material('#ffffff',{map:artTexture(),roughness:.9}));
        }
    }
    // Ceiling is omitted for sight lines, but light fittings use its true height.
    const shade = material('#eee3cc', { roughness: .95, side: THREE.DoubleSide });
    const ceilingFixture = new THREE.Group(); ceilingFixture.name = 'Ceiling pendant'; root.add(ceilingFixture); room.ceilingFixture = ceilingFixture;
    rod(ceilingFixture, [0, h, 370], [0, h - 170, 370], 5, brass);
    mesh(ceilingFixture, new THREE.CylinderGeometry(240, 280, 140, 40, 1, true), shade, [0, h - 230, 370]);
    const glow = material('#fff0d5', { emissive: '#ffd89d', emissiveIntensity: .6 });
    const diffuser = mesh(ceilingFixture, new THREE.CylinderGeometry(268, 268, 6, 40), glow, [0, h - 300, 370]); diffuser.castShadow = false;
    const makeLight = (position, color, power, range) => {
        const light = new THREE.PointLight(color, 0, range * root.scale.x, 2); light.position.set(...position); root.add(light);
        return { light, power: power * (root.scale.x * 1000) ** 2 };
    };
    const lights = [
        makeLight([cx, 1080, bz + 450], '#ffcd8f', 3.5, 3500),
        makeLight([0, h - 340, 370], '#ffdfb0', 5, 4200),
        makeLight([w / 2 - 500, 150, front - 600], '#b18bdf', 1.5, 2300),
        makeLight([layout.readingLight[0], 1520, layout.readingLight[1]], '#ffdcaa', 2.5, 2600)
    ];
    // Light sources are owned by this room and disappear on scene replacement.
    room.homeAtmosphere = (modeId, accent = 1) => {
        const mode = HOME_MODES[modeId] || HOME_MODES.afternoon;
        const c = skyCanvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, mode.sky[0]); gradient.addColorStop(1, mode.sky[1]); c.fillStyle = gradient; c.fillRect(0, 0, 512, 512);
        c.fillStyle = modeId === 'night' || modeId === 'party' ? '#233248' : '#8ea59b';
        for (let i = 0; i < 12; i++) { const height = 20 + (i * 31 % 65); c.fillRect(i * 48, 512 - height, 39, height); }
        skyMap.needsUpdate = true;
        lights.forEach(({ light, power }, i) => { light.intensity = power * mode.practical * accent * (i === 2 && modeId !== 'party' ? .12 : 1); });
        lights[2].light.color.set(modeId === 'party' ? '#b880ff' : '#ffcf99'); glow.emissiveIntensity = .3 + mode.practical;
    };
    room.homeAtmosphere('afternoon');
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[wallMat, 'plaster'], [oak, 'wood'], [joinery, 'wood'], [sage, 'powder'], [brass, 'metal'], [linen, 'fabric'], [shade, 'fabric']]) mat.userData.roomSurface = surface;
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
