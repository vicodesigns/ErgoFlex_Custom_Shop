import * as THREE from 'three';
import { attachVista } from './window-vista.mjs?v=window-vista-20261110b';
import { interiorCraftFinishes } from './interior-craft-detail.mjs?v=natural-finishes-20261104';
import { gymProgramMaps, buildGymSessionDetail, migrateGymSavedFurniture } from './gym-session-detail.mjs?v=polish-20261111e';
import { GYM_MODES, gymTheme } from './gym-theme.mjs?v=polish-20261111e';

// All architecture and original equipment below is authored in millimetres.
const tiers = [
    ['apartment', 'Apartment training nook', 3200, 4200, 2600],
    ['house', 'Dedicated home gym', 4200, 5400, 2800],
    ['spacious', 'Strength & cardio studio', 5200, 6400, 3000],
    ['premium', 'Performance gym & recovery', 6400, 7800, 3200],
    ['executive', 'Private wellness suite', 8000, 9000, 3400]
];
export const GYM_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1700, front = back + depth, desk = [tier ? -420 : -250, back + 880];
    const recovery = tier >= 3 ? [-width / 2 + 1500, front - 600] : [-width / 2 + 350, front - 1400];
    const recoveryTurn = tier >= 3 ? 0 : 90;
    const training = [tier === 2 ? -240 : tier >= 3 ? 100 : 180, front - (tier >= 3 ? 2600 : 1200)];
    const hydration = [-width / 2 + (tier ? 350 : 250), back + 400];
    const props = [
        { id: 'kenney-furniture-bench-cushion-low', at: [recovery[0], 0, recovery[1]], turn: recoveryTurn },
        { id: 'decor-plant2', at: [-width / 2 + 240, 0, back + 1600] },
        { id: 'party-speaker', at: [width / 2 - 220, 0, back + 2000], turn: -15 },
        { id: 'hemp-protein', at: [hydration[0] - 130, 960, hydration[1]] },
        { id: 'water-bottle', at: [hydration[0] + 125, 960, hydration[1] + 75] },
        { id: 'gym-props-3', at: [training[0], 8, training[1]] }
    ];
    if (tier >= 2) props.push({ id: 'gym-props', at: [width / 2 - 530, 0, front - 2300], turn: 90 });
    if (tier >= 3) props.push({ id: 'basketball', at: [recovery[0] + 620, 0, recovery[1]] });
    return [id, { id, name, width, depth, height, back, desk, recovery, recoveryTurn, training, hydration, tier, props,
        groovePoses: { morning: {dx:90,dz:80,yaw:-.06}, afternoon: {dx:0,dz:0,yaw:0}, evening: {dx:150,dz:200,yaw:.08}, night: {dx:0,dz:0,yaw:0}, party: {dx:100,dz:tier>=2?400:180,yaw:-.12} },
        daylight: [-width / 2 + 100, back + 2100] }];
}));
export const gymLayoutById = id => GYM_LAYOUTS[id] || GYM_LAYOUTS.apartment;
export const gymLayoutForSize = size => GYM_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];

export { GYM_MODES };

function texture(draw, width = 512, height = 512) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

export function buildGymRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier } = layout, front = bz + d;
    room.migrateSavedTransform = (obj, saved) => migrateGymSavedFurniture(obj, saved, layout);
    // Colourway (gym-theme.mjs): green unless the layout carries another theme.
    const T = gymTheme(layout.theme), M = T.materials, C = T.canvas, I = T.instances, red = layout.theme === 'blackred';
    const graphite = material(...M.graphite), steel = material(...M.steel);
    const rubber = material(...M.rubber), lime = material(...M.lime);
    const silver = material(...M.silver), oak = material(...M.oak);
    const ash = material(...M.ash), slate = material(...M.slate);
    const glow = [], washes = [], practicals = [];
    const strip = (parent, size, at, channel = 0) => {
        const mat = material(C.strip, { emissive: C.strip, emissiveIntensity: .3 });
        const o = box(parent, size, at, mat, 2); o.castShadow = false; glow.push({ mat, channel }); return o;
    };
    // Warm-white practical fixtures (picture light, timer) follow mode.practical.
    const practical = (parent, size, at, color = C.practical, strength = 1) => {
        const mat = material(color, { emissive: color, emissiveIntensity: .5 });
        const o = box(parent, size, at, mat, 2); o.castShadow = false; practicals.push({ mat, strength }); return o;
    };
    const group = (id, name, at = [0, 0, 0], turn = 0, parent = root) => {
        const g = new THREE.Group(); g.name = name; g.position.set(...at); g.rotation.y = turn; parent.add(g);
        g.userData.propId = id; g.userData.sceneAssetName = name;
        markSceneAsset(g, { key: `gym:${layout.id}:fixture:${id}` }); return g;
    };
    const label = (parent, text, size, at, color = C.label[0], background = C.label[1]) => {
        const map = texture((c, tw, th) => { c.fillStyle = background; c.fillRect(0, 0, tw, th); c.fillStyle = color; c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, tw / 2, th / 2); }, 1024, 128);
        return box(parent, [size[0], size[1], 4], at, material('#ffffff', { map, roughness: .85 }));
    };
    // Repeated equipment (slats, bells, plates, bands) is instanced: one draw
    // call per batch, with per-instance colour on a shared base material.
    const unit = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 18), hex = new THREE.CylinderGeometry(1, 1, 1, 6), ball = new THREE.SphereGeometry(1, 18, 12);
    const euler = new THREE.Euler(0, 0, 0, 'YXZ'), quat = new THREE.Quaternion(), matrix = new THREE.Matrix4(), at3 = new THREE.Vector3(), size3 = new THREE.Vector3(), colour = new THREE.Color();
    const instanced = (parent, geometry, mat, items, shadow = true) => {
        const obj = new THREE.InstancedMesh(geometry, mat, items.length);
        items.forEach(item => obj.position.add(at3.set(...item.at))); obj.position.divideScalar(items.length);
        items.forEach((item, i) => {
            euler.set(...(item.rot || [0, 0, 0])); matrix.compose(at3.set(...item.at).sub(obj.position), quat.setFromEuler(euler), size3.set(...(item.size || [1, 1, 1])));
            obj.setMatrixAt(i, matrix); if (item.color) obj.setColorAt(i, colour.set(item.color));
        });
        obj.instanceMatrix.needsUpdate = true; if (obj.instanceColor) obj.instanceColor.needsUpdate = true;
        obj.castShadow = shadow; obj.receiveShadow = true; obj.computeBoundingBox(); obj.computeBoundingSphere(); parent.add(obj); return obj;
    };
    // Soft additive light pools fake grazing wall-washers and window sun
    // without adding real-time lights or shadow maps.
    const washMap = texture((c, tw, th) => {
        const g = c.createLinearGradient(0, th, 0, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, '#ffffff70'); g.addColorStop(1, '#ffffff00');
        c.fillStyle = g; c.fillRect(0, 0, tw, th);
        c.globalCompositeOperation = 'destination-in';
        const e = c.createLinearGradient(0, 0, tw, 0); e.addColorStop(0, '#ffffff00'); e.addColorStop(.18, '#ffffff'); e.addColorStop(.82, '#ffffff'); e.addColorStop(1, '#ffffff00');
        c.fillStyle = e; c.fillRect(0, 0, tw, th);
    }, 256, 256);
    const wash = (parent, size, at, channel, strength, rot = [0, 0, 0]) => {
        const mat = new THREE.MeshBasicMaterial({ map: washMap, color: '#000000', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const o = mesh(parent, new THREE.PlaneGeometry(...size), mat, at); o.rotation.set(...rot); o.castShadow = o.receiveShadow = false; o.renderOrder = 2;
        washes.push({ mat, channel, strength }); return o;
    };

    // Interlocking EPDM rubber tiles: 1 m squares with seams and flecks.
    const floorMap = texture((c, tw, th) => {
        const tones = C.floor.tones;
        for (let i = 0; i < 4; i++) { c.fillStyle = tones[i]; c.fillRect((i % 2) * tw / 2, (i >> 1) * th / 2, tw / 2, th / 2); }
        for (let i = 0; i < 16000; i++) { const x = (i * 73.71 + (i * i) % 97) % tw, y = (i * 29.37 + (i * 7) % 61) % th; c.fillStyle = C.floor.flecks[i % 5]; c.fillRect(x, y, i % 3 === 0 ? 2 : 1.4, i % 4 === 0 ? 2 : 1.4); }
        c.strokeStyle = C.floor.seams[0]; c.lineWidth = 3;
        for (const v of [1.5, tw / 2]) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, th); c.stroke(); c.beginPath(); c.moveTo(0, v); c.lineTo(tw, v); c.stroke(); }
        c.strokeStyle = C.floor.seams[1]; c.lineWidth = 1.5;
        for (const v of [5, tw / 2 + 4]) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, th); c.stroke(); c.beginPath(); c.moveTo(0, v); c.lineTo(tw, v); c.stroke(); }
    }, 1024, 1024); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 2000, d / 2000);
    box(root, [w, 30, d], [0, -15, bz + d / 2], material('#ffffff', { map: floorMap, roughness: .93 }));
    // Cool microcement walls; one canvas, repeated per wall face so the
    // mottling keeps its physical size on every wall.
    const concreteMap = texture((c, tw, th) => {
        c.fillStyle = C.wall.base; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 260; i++) {
            const x = (i * 197.3) % tw, y = (i * 83.9 + i * i * .7) % th, r = 40 + (i * 37) % 150, a = .025 + (i % 5) * .007;
            const tone = C.wall.mottle[i % 4 ? 0 : 1];
            for (const ox of [-tw, 0, tw]) for (const oy of [-th, 0, th]) {
                if (x + ox + r < 0 || x + ox - r > tw || y + oy + r < 0 || y + oy - r > th) continue;
                const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, `rgba(${tone},${a})`); g.addColorStop(1, `rgba(${tone},0)`);
                c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
            }
        }
        for (let i = 0; i < 9000; i++) { c.fillStyle = C.wall.specks[i % 2 ? 0 : 1]; c.fillRect((i * 61.17) % tw, (i * 47.83 + i % 13) % th, 1.3, 1.3); }
    }, 1024, 1024);
    const concretes = new Map();
    const concrete = (width, height) => {
        const key = `${Math.round(width)}x${Math.round(height)}`;
        if (!concretes.has(key)) {
            const map = concreteMap.clone(); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(width / 2200, height / 2200); map.needsUpdate = true;
            concretes.set(key, material('#ffffff', { map, roughness: .9 }));
        }
        return concretes.get(key);
    };

    const wall = new THREE.Group(); wall.name = 'Gym performance wall'; root.add(wall);
    const cx = layout.desk[0], coachW = tier ? 2000 : 1850, slatW = tier ? coachW : 1600;
    box(wall, [w, h, 80], [0, h / 2, bz - 40], concrete(w, h));
    box(wall, [w, 85, 30], [0, 42.5, bz + 15], steel);
    strip(wall, [w - 80, 12, 12], [0, h - 110, bz + 34], 0);
    // Coach station feature: dark acoustic slats aligned with the floor zone,
    // grazed by a lime uplight so the desk silhouette reads against them.
    const slatH = h - 260, slatN = Math.floor(slatW / 70);
    box(wall, [slatW + 60, slatH + 40, 22], [cx, 95 + slatH / 2, bz + 11], slate);
    instanced(wall, unit, graphite, Array.from({ length: slatN }, (_, i) => ({ at: [cx - (slatN - 1) * 35 + i * 70, 95 + slatH / 2, bz + 36], size: [30, slatH, 28] })), false);
    strip(wall, [slatW, 10, 14], [cx, 105, bz + 58], 0);
    wash(wall, [slatW + 40, slatH * .75], [cx, 95 + slatH * .375, bz + 52], 0, .55);
    const art = group('performance-sign', 'MOVE / BUILD / REPEAT training wall', [cx, h - 360, bz + 72], 0, wall);
    const signMap = texture((c, tw, th) => {
        c.fillStyle = C.sign.background; c.fillRect(0, 0, tw, th);
        c.fillStyle = C.sign.slash; c.beginPath(); c.moveTo(0, th); c.lineTo(105, 0); c.lineTo(220, 0); c.lineTo(115, th); c.fill();
        c.fillStyle = C.sign.title; c.font = 'italic 900 112px sans-serif'; c.fillText('MOVE.', 255, 137);
        c.fillStyle = C.sign.line; c.font = 'bold 24px sans-serif'; c.fillText('BUILD STRENGTH. KEEP MOVING.', 262, 192);
        c.fillStyle = C.sign.footer; c.font = '16px sans-serif'; c.fillText('ERGOFLEX   /   YOUR DAILY MOMENTUM', 262, 229);
    }, 1024, 256);
    box(art, [1520, 380, 25], [0, 0, 0], rubber, 4);
    const signFace = box(art, [1480, 350, 4], [0, 0, 16], material('#ffffff', { map: signMap, roughness: .85 }));
    // Black & red: the sign is a backlit lightbox; its red slash and lettering glow with the practicals.
    if (red) { signFace.material.emissive.set('#ffffff'); signFace.material.emissiveMap = signMap; practicals.push({ mat: signFace.material, strength: .4 }); }
    for (const x of [-700, 700]) for (const y of [-150, 150]) rod(art, [x, y, -36], [x, y, -10], 9, silver);
    // Chalk programming board, interval timer and picture light beside the station.
    const boardX = (cx + slatW / 2 + 30 + w / 2) / 2, boardW = Math.min(1000, w / 2 - cx - slatW / 2 - 260), boardY = h * .58;
    const board = group('training-board', 'Chalk workout board and interval timer', [boardX, boardY, bz], 0, wall);
    const programmes = gymProgramMaps(T), chalk = programmes.board;
    const boardH = boardW * 720 / 768;
    box(board, [boardW + 50, boardH + 50, 30], [0, 0, 15], oak, 6);
    box(board, [boardW, boardH, 4], [0, 0, 32], material('#ffffff', { map: chalk, roughness: .95 }));
    box(board, [boardW * .7, 22, 50], [0, -boardH / 2 - 30, 40], oak, 3);
    instanced(board, unit, material('#ffffff', { roughness: .9 }), [-60, 10, 70].map((x, i) => ({ at: [x, -boardH / 2 - 9, 50], size: [55, 14, 14], color: I.chalk[i] })), false);
    rod(board, [-boardW * .38, boardH / 2 + 90, 30], [-boardW * .38, boardH / 2 + 90, 150], 7, steel); rod(board, [boardW * .38, boardH / 2 + 90, 30], [boardW * .38, boardH / 2 + 90, 150], 7, steel);
    box(board, [boardW * .86, 34, 55], [0, boardH / 2 + 90, 165], steel, 8);
    practical(board, [boardW * .8, 6, 30], [0, boardH / 2 + 72, 168], C.practical, 1.2);
    wash(board, [boardW + 40, boardH + 40], [0, 0, 40], 'warm', .5, [0, 0, Math.PI]);
    const timerMap = programmes.timer;
    const timerY = Math.min(boardH / 2 + 340, h - boardY - 250);
    box(board, [620, 225, 60], [0, timerY, 30], rubber, 10);
    const face = practical(board, [580, 194, 4], [0, timerY, 62], '#ffffff', 1); face.material.map = face.material.emissiveMap = timerMap;
    room.walls.push({ obj: wall, axis: 'x', limit: bz * root.scale.x });

    const right = new THREE.Group(); right.name = 'Gym reflective strength wall'; root.add(right);
    box(right, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], concrete(d, h));
    box(right, [24, 90, d], [w / 2 - 12, 45, bz + d / 2], rubber);
    // Mirror glass carries a soft painted reflection so it reads as glass
    // without rendering the CAD desk a second time.
    const mirrorMap = texture((c, tw, th) => {
        const g = c.createLinearGradient(0, 0, 0, th); g.addColorStop(0, C.mirror[0]); g.addColorStop(.55, C.mirror[1]); g.addColorStop(1, C.mirror[2]); c.fillStyle = g; c.fillRect(0, 0, tw, th);
        c.fillStyle = C.mirror[3]; c.fillRect(0, th * .8, tw, th * .2);
        c.globalAlpha = .22; c.fillStyle = '#ffffff';
        for (const [x, wd] of [[60, 70], [170, 26], [300, 120], [460, 34]]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + wd, 0); c.lineTo(x + wd - 220, th); c.lineTo(x - 220, th); c.fill(); }
        c.globalAlpha = 1;
    }, 512, 1024);
    const glassMat = material('#ffffff', { map: mirrorMap, metalness: .35, roughness: .06, emissive: '#ffffff', emissiveMap: mirrorMap, emissiveIntensity: .3 });
    for (let i = 0; i < Math.min(5, tier + 2); i++) {
        const z = bz + 700 + i * 1020;
        box(right, [15, 1780, 950], [w / 2 - 10, 1350, z], steel, 2);
        const glass = box(right, [6, 1720, 900], [w / 2 - 22, 1350, z], glassMat); glass.castShadow = false;
        strip(right, [8, 1780, 10], [w / 2 - 32, 1350, z - 475], 1);
    }
    room.walls.push({ obj: right, axis: 'z', limit: -w / 2 * root.scale.x });
    const left = new THREE.Group(); left.name = 'Gym daylight and entry wall'; root.add(left);
    const wz = bz + 2150, ww = tier ? 1850 : 1350, low = 1000, wh = 1250, a = wz - ww / 2, b = wz + ww / 2;
    box(left, [80, h, a - bz], [-w / 2 - 40, h / 2, (bz + a) / 2], concrete(a - bz, h));
    box(left, [80, h, front - b], [-w / 2 - 40, h / 2, (b + front) / 2], concrete(front - b, h));
    box(left, [80, low, ww], [-w / 2 - 40, low / 2, wz], concrete(ww, low));
    box(left, [80, h - low - wh, ww], [-w / 2 - 40, (h + low + wh) / 2, wz], concrete(ww, h - low - wh));
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 512;
    const sky = new THREE.CanvasTexture(skyCanvas); sky.colorSpace = THREE.SRGBColorSpace;
    const pane = mesh(left, new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: sky }), [-w / 2 - 51, low + wh / 2, wz]); pane.rotation.y = Math.PI / 2; pane.castShadow = pane.receiveShadow = false;
    // The photographed view replaces the painted canvas once it has loaded; the canvas stays as the fallback.
    const windowVista = attachVista(pane, 'city'); room.windowViewReady = Promise.all([room.windowViewReady, windowVista.ready]);
    for (const z of [a, wz, b]) box(left, [65, wh + 40, 30], [-w / 2 + 10, low + wh / 2, z], steel);
    for (const y of [low, low + wh]) box(left, [65, 30, ww + 40], [-w / 2 + 10, y, wz], steel);
    box(left, [180, 30, ww + 70], [-w / 2 + 50, low - 15, wz], oak, 3);
    const door = front - 470;
    box(left, [25, 2100, 800], [-w / 2 + 18, 1050, door], steel, 3);
    box(left, [12, 1950, 720], [-w / 2 + 38, 975, door], oak, 3);
    rod(left, [-w / 2 + 55, 980, door - 260], [-w / 2 + 55, 1110, door - 260], 10, silver);
    room.walls.push({ obj: left, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });
    // Window sun on the floor: two panes projected along the mode's sun angle.
    const sunMap = texture((c, tw, th) => {
        c.filter = 'blur(10px)'; c.fillStyle = '#ffffff';
        const m = tw * 30 / ww;
        c.fillRect(22, 22, tw / 2 - m / 2 - 22, th - 44); c.fillRect(tw / 2 + m / 2, 22, tw / 2 - m / 2 - 22, th - 44);
    }, 512, 256);
    const sunGeometry = new THREE.BufferGeometry();
    sunGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    sunGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); sunGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    const sunMat = new THREE.MeshBasicMaterial({ map: sunMap, color: '#000000', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const sunPatch = mesh(root, sunGeometry, sunMat); sunPatch.name = 'Window sun patch'; sunPatch.castShadow = sunPatch.receiveShadow = false; sunPatch.renderOrder = 2;
    const placeSun = ([elevation, sweep]) => {
        const p = sunGeometry.attributes.position, reach = w - 160;
        [[a, low], [b, low], [b, low + wh], [a, low + wh]].forEach(([z, y], i) => {
            const run = y / elevation;
            p.setXYZ(i, -w / 2 + Math.min(reach, run), 14, Math.min(front - 40, Math.max(bz + 40, z + sweep * run)));
        });
        p.needsUpdate = true; sunGeometry.computeBoundingSphere();
    };

    const [tx, tz] = layout.training;
    const mat = group('training-zone', 'Mobility mat and circuit markings', [tx, 0, tz]);
    box(mat, [1400, 8, 2200], [0, 4, 0], rubber, 14);
    for (const x of [-710, 710]) red ? strip(mat, [14, 2, 2250], [x, 1, 0], 0) : box(mat, [14, 2, 2250], [x, 1, 0], lime);
    // Black & red closes the mat's LED edge frame, inside the same footprint.
    if (red) for (const z of [-1118, 1118]) strip(mat, [1434, 2, 14], [0, 1, z], 0);
    for (let i = 0; i < 5; i++) box(mat, [240, 2, 18], [0, 10, -930 + i * 410], steel);
    // The floor plaque reads from the room camera, rather than becoming a wall sign.
    const lane = label(mat, '01 / MOBILITY', [1000, 125], [0, 12, 990]); lane.rotation.x = -Math.PI / 2;
    const coach = group('coach-zone', 'ErgoFlex coaching station floor', [layout.desk[0], 0, layout.desk[1]]);
    box(coach, [coachW, 3, 1250], [0, 1.5, 100], material(...M.coachFloor), 10);
    for (const x of [-coachW / 2 + 75, coachW / 2 - 75]) red ? strip(coach, [12, 2, 1170], [x, 4, 100], 0) : box(coach, [12, 2, 1170], [x, 4, 100], lime);

    const hydrate = group('hydration-station', 'Timber hydration cabinet', [layout.hydration[0], 0, layout.hydration[1]]);
    // A compact cabinet keeps the 60-inch desk's swept footprint clear in
    // the apartment. Countertop objects retain their real physical size.
    const cabinetW = tier ? 600 : 440, doorX = (cabinetW - 60) / 4;
    box(hydrate, [cabinetW - 30, 850, 450], [0, 475, 0], oak, 4);
    for (const x of [70 - cabinetW / 2, cabinetW / 2 - 70]) for (const z of [-165, 165]) box(hydrate, [35, 50, 35], [x, 25, z], rubber);
    box(hydrate, [cabinetW, 60, 480], [0, 930, 0], steel, 5);
    for (const x of [-doorX, doorX]) { box(hydrate, [(cabinetW - 90) / 2, 750, 14], [x, 475, 233], graphite, 3); rod(hydrate, [x, 510, 246], [x, 610, 246], 5, silver); }
    label(hydrate, 'REFUEL', [cabinetW - 90, 70], [0, 830, 245]);
    strip(hydrate, [cabinetW - 70, 8, 10], [0, 910, 244]);
    // Floating shelf above the cabinet: folded towels, shakers and a snake plant.
    const shelf = group('refuel-shelf', 'Floating towel, shaker and plant shelf', [-w / 2 + 270, 1480, bz], 0, wall);
    box(shelf, [440, 32, 230], [0, 0, 115], ash, 4);
    for (const x of [-160, 160]) box(shelf, [26, 120, 26], [x, -70, 30], steel);
    instanced(shelf, unit, material('#ffffff', { roughness: .97 }), I.towels.map((color, i) => ({ at: [-135 + (i % 2) * 5, 37 + i * 42, 110], size: [160, 40, 165], color })));
    instanced(shelf, cyl, material('#ffffff', { roughness: .45 }), [
        { at: [-10, 101, 105], size: [40, 170, 40], color: I.shakers[0] }, { at: [-10, 196, 105], size: [34, 20, 34], color: I.shakers[1] },
        { at: [70, 91, 125], size: [36, 150, 36], color: I.shakers[2] }, { at: [70, 175, 125], size: [30, 18, 30], color: I.shakers[3] },
        { at: [168, 61, 110], size: [46, 90, 46], color: I.shakers[4] }
    ]);
    instanced(shelf, ball, material('#ffffff', { roughness: .7 }), [[-.18, .1], [.15, -.25], [.05, .3], [-.28, -.3], [.3, .2], [0, 0]].map(([rx, rz], i) => ({ at: [168 + rz * 90, 190 - i * 6, 110 + rx * 90], size: [10, 120 - i * 7, 24], rot: [rx, i * .9, rz], color: I.plants[i] })));

    const weights = group('dumbbell-rack', 'Two-tier free weight rack', [w / 2 - 320, 0, bz + 900], -Math.PI / 2);
    for (const x of [-580, 580]) {
        box(weights, [70, 70, 530], [x, 35, 0], rubber, 3);
        rod(weights, [x, 70, -160], [x, 870, 0], 24, steel);
    }
    const heads = [], handles = [], caps = [];
    for (let row = 0; row < 2; row++) {
        const y = 440 + row * 370;
        for (const z of [-105, 105]) rod(weights, [-620, y, z], [620, y, z], 17, steel);
        for (let i = 0; i < 5; i++) {
            const x = -470 + i * 235, rad = 46 + i * 7 - row * 6;
            handles.push({ at: [x, y + rad + 15, 0], size: [12, 270, 12], rot: [Math.PI / 2, 0, 0] });
            for (const z of [-110, 110]) { heads.push({ at: [x, y + rad + 15, z], size: [rad, 70, rad], rot: [Math.PI / 2, 0, 0] }); caps.push({ at: [x, y + rad + 15, z * 1.33], size: [rad * .45, 6, rad * .45], rot: [Math.PI / 2, 0, 0] }); }
        }
    }
    instanced(weights, hex, rubber, heads); instanced(weights, cyl, silver, handles); instanced(weights, cyl, red ? lime : silver, caps, false);
    label(weights, '02 / STRENGTH', [1140, 95], [0, 1010, 190]);

    const bench = (at, turn = 0) => {
        const g = group('weight-bench', 'Incline strength bench', at, turn);
        for (const z of [-480, 480]) { box(g, [650, 65, 80], [0, 32.5, z], rubber, 4); rod(g, [0, 65, z], [0, 410, z], 26, steel); }
        rod(g, [0, 345, -530], [0, 345, 550], 35, steel);
        box(g, [330, 85, 380], [0, 450, 410], rubber, 20);
        const pad = box(g, [330, 85, 900], [0, 570, -240], rubber, 20); pad.rotation.x = -.28;
        for (const x of [-145, 145]) rod(g, [x, 420, 500], [x, 695, -665], 6, lime);
    };
    if (tier) bench([w / 2 - 600, 0, bz + 2720]);

    if (tier) {
        const bike = group('spin-bike', 'Indoor training bike', [-w / 2 + 570, 0, bz + 2700]);
        for (const z of [-560, 560]) box(bike, [580, 75, 90], [0, 37.5, z], rubber, 6);
        rod(bike, [0, 110, -540], [0, 110, 540], 36, steel);
        const wheel = mesh(bike, new THREE.CylinderGeometry(240, 240, 100, 32), graphite, [0, 400, -330]); wheel.rotation.z = Math.PI / 2;
        const ring = mesh(bike, new THREE.TorusGeometry(210, 8, 8, 32), lime, [57, 400, -330]); ring.rotation.y = Math.PI / 2;
        rod(bike, [0, 110, -540], [0, 740, 280], 40, steel);
        rod(bike, [0, 110, 530], [0, 480, -180], 40, steel);
        rod(bike, [0, 480, 200], [0, 920, 270], 24, silver);
        box(bike, [280, 55, 260], [0, 940, 290], rubber, 20);
        rod(bike, [0, 480, -330], [0, 1130, -440], 24, steel);
        rod(bike, [-270, 1110, -420], [270, 1110, -420], 18, rubber);
        rod(bike, [-260, 1110, -420], [-260, 1180, -570], 18, rubber); rod(bike, [260, 1110, -420], [260, 1180, -570], 18, rubber);
        box(bike, [230, 125, 18], [0, 1160, -450], graphite, 8);
        label(bike, '24:08', [195, 85], [0, 1160, -437], I.bikeScreen);
        rod(bike, [-170, 370, 70], [170, 370, 70], 13, silver);
        for (const s of [-1, 1]) box(bike, [100, 35, 160], [s * 200, 370 + s * 100, 70], rubber, 5);
    }
    if (tier >= 2) {
        const rack = group('power-rack', 'Squat rack and Olympic bar', [w / 2 - 1020, 0, front - 1220]);
        const pins = [];
        for (const x of [-620, 620]) {
            box(rack, [100, 70, 1250], [x, 35, 0], rubber, 3);
            for (const z of [-470, 470]) {
                box(rack, [70, 2250, 70], [x, 1125, z], steel, 3);
                for (let y = 470; y < 1960; y += 140) pins.push({ at: [x, y, z + 37], size: [7, 7, 4] });
            }
            box(rack, [70, 70, 1080], [x, 2200, 0], steel);
            rod(rack, [x, 750, -430], [x, 750, 490], 18, lime);
        }
        instanced(rack, ball, rubber, pins, false);
        rod(rack, [-620, 2190, 460], [620, 2190, 460], 20, rubber);
        rod(rack, [-950, 1330, -390], [950, 1330, -390], 15, silver);
        const plates = [];
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) plates.push({ at: [s * (760 + i * 40), 1330, -390], size: [210 - i * 35, 36, 210 - i * 35], rot: [0, 0, Math.PI / 2], color: I.plates[i === 2 ? 0 : 1] });
        instanced(rack, cyl, material('#ffffff', { roughness: .85 }), plates);
        label(rack, 'ERGO / STRONG', [1060, 105], [0, 2140, -426]);
        // A low stored box stays out of the lifter's bay.
        box(rack, [500, 360, 500], [0, 180, -390], oak, 8);
        // Rubber lifting platform with a timber centre insert.
        box(rack, [1150, 12, 1150], [0, 6, 0], rubber, 4);
        box(rack, [560, 3, 1150], [0, 13.5, 0], ash, 2);
        // Black & red: an LED edge frame around the platform, within the rack's feet.
        if (red) for (const s of [-1, 1]) { strip(rack, [12, 3, 1174], [s * 581, 1.5, 0], 0); strip(rack, [1150, 3, 12], [0, 1.5, s * 581], 0); }
    }
    if (tier >= 3) {
        const run = group('treadmill', 'Incline cardio treadmill', [-w / 2 + 710, 0, front - 2500]);
        box(run, [850, 170, 1920], [0, 85, 0], steel, 24);
        box(run, [650, 14, 1680], [0, 177, 50], rubber, 8);
        instanced(run, unit, graphite, Array.from({ length: 11 }, (_, i) => ({ at: [0, 186, -710 + i * 140], size: [610, 2, 4] })), false);
        for (const x of [-385, 385]) { rod(run, [x, 170, -700], [x, 1220, -540], 27, steel); rod(run, [x, 950, -510], [x, 950, 60], 18, rubber); strip(run, [10, 12, 1580], [x, 179, 65], 1); }
        box(run, [790, 210, 110], [0, 1240, -530], graphite, 18);
        label(run, '06:42  /  8.0', [650, 100], [0, 1250, -470], I.treadmillScreen);
    }
    if (tier === 4) {
        const bag = group('boxing-station', 'Freestanding boxing station', [1000, 0, front - 850]);
        mesh(bag, new THREE.CylinderGeometry(330, 370, 200, 32), rubber, [0, 100, 0]);
        rod(bag, [0, 200, 0], [0, 850, 0], 55, steel);
        mesh(bag, new THREE.CylinderGeometry(190, 190, 1050, 32), graphite, [0, 1400, 0]);
        for (const y of [960, 1840]) mesh(bag, new THREE.CylinderGeometry(194, 194, 35, 32), lime, [0, y, 0]);
        label(bag, 'MOVE', [250, 90], [0, 1450, 193], I.bagText);
    }

    // Conditioning corner on the mirror wall: colour-coded kettlebells,
    // medicine balls and rolled mats, with bands and rings on a timber rail.
    // Each shelf occupies a free wall bay; premium keeps it on the mirror wall
    // so its footprint clears the treadmill on the opposite side.
    const side = tier === 2 || tier === 4 ? -1 : 1, storeZ = [1300, 2350, 2250, 2600, 2500][tier], storeL = tier === 3 ? 1000 : 1100, k = storeL / 1100;
    const conditioning = group('conditioning-shelf', 'Kettlebell and medicine ball shelf', [side * (w / 2 - 250), 0, storeZ]);
    instanced(conditioning, unit, steel, [-1, 1].flatMap(x => [-1, 1].map(z => ({ at: [x * 190, 362, z * (storeL / 2 - 20)], size: [32, 724, 32] }))));
    instanced(conditioning, unit, graphite, [60, 420, 700].map(y => ({ at: [0, y, 0], size: [410, 24, storeL] })));
    strip(conditioning, [8, 10, storeL - 80], [-side * 206, 690, 0], 1);
    const bells = [], bellHandles = [];
    const bell = (r, y, z, color) => {
        const cy = y + r * .92;
        bells.push({ at: [0, cy, z], size: [r, r * .92, r], color });
        bellHandles.push({ at: [0, cy + r * 1.22, z], size: [r * .7, r * .7, r * .7], rot: [0, Math.PI / 2, 0] });
    };
    [[I.bells[0][0], 100], [I.bells[0][0], 100], [I.bells[0][1], 106], [I.bells[0][1], 106]].forEach(([color, r], i) => bell(r, 72, (i - 1.5) * (storeL - 140) / 4, color));
    [[I.bells[1][0], 78], [I.bells[1][0], 78], [I.bells[1][1], 84], [I.bells[1][1], 84]].forEach(([color, r], i) => bell(r, 432, (i - 1.5) * (storeL - 140) / 4, color));
    instanced(conditioning, ball, material('#ffffff', { roughness: .5, metalness: .1 }), bells);
    instanced(conditioning, new THREE.TorusGeometry(1, .17, 8, 20), material(...M.bellHandle), bellHandles);
    instanced(conditioning, ball, material('#ffffff', { roughness: .82 }), [-390, -150, 80].map((z, i) => ({ at: [i === 1 ? 20 : -10, 712 + 112 - i * 6, z * k], size: [112 - i * 6, 112 - i * 6, 112 - i * 6], color: I.medBalls[i] })));
    instanced(conditioning, cyl, material('#ffffff', { roughness: .9 }), [[300, 0], [420, 0], [360, 1]].map(([z, row], i) => ({ at: [0, 712 + 62 + row * 112, z * k], size: [62, 380, 62], rot: [0, 0, Math.PI / 2], color: I.mats[i] })));
    const rail = group('accessory-rail', 'Resistance bands, rope and rings rail', [side * w / 2, 1460, storeZ], -side * Math.PI / 2, side > 0 ? right : left);
    box(rail, [storeL, 560, 22], [0, 0, 11], ash, 6);
    instanced(rail, unit, steel, [-.38, -.13, .12, .37].map(f => ({ at: [f * storeL, 210, 70], size: [22, 22, 120] })), false);
    const loops = [];
    [[-.38, 1], [-.38, .9], [-.13, 1], [.12, 1.1]].forEach(([f, s], i) => loops.push({ at: [f * storeL + i % 2 * 12, 210 - 150 * s, 95 + i * 6], size: [70 * s, 170 * s, 70 * s], rot: [0, 0, 0], color: I.bands[i] }));
    instanced(rail, new THREE.TorusGeometry(1, .09, 8, 26), material('#ffffff', { roughness: .6 }), loops);
    for (const s of [-1, 1]) {
        rod(rail, [.37 * storeL + s * 60, 210, 120], [.37 * storeL + s * 90, -60, 110], 6, rubber);
        const ringObj = mesh(rail, new THREE.TorusGeometry(95, 15, 10, 28), oak, [.37 * storeL + s * 92, -150, 110]); ringObj.rotation.y = Math.PI / 2 * .2;
    }
    label(rail, '03 / CONDITION', [storeL * .7, 70], [0, -230, 24]);

    // Recovery corner: tactile timber, rolled towels, and a warmer light.
    const recover = group('recovery-wall', 'Recovery slats and towel rail', [-w / 2 + 30, 680, front - 1400], Math.PI / 2, left);
    instanced(recover, unit, oak, Array.from({ length: 17 }, (_, i) => ({ at: [-520 + i * 65, 0, 0], size: [25, 550, 35] })));
    label(recover, 'BREATHE / RESET', [960, 100], [0, 170, 25], ...I.recovery);
    const towels = group('towel-storage', 'Towel rail and recovery foam rollers', [w / 2 - 250, 0, front - 270]);
    box(towels, [350, 40, 500], [0, 20, 0], oak, 5);
    for (let i = 0; i < 3; i++) mesh(towels, new THREE.CylinderGeometry(52, 52, 480, 16), i === 1 ? lime : rubber, [(i - 1) * 110, 280, 0]);
    const ceiling = new THREE.Group(); ceiling.name = 'Gym suspended light lanes'; root.add(ceiling); room.ceilingFixture = ceiling;
    for (const x of [-w * .28, w * .28]) {
        box(ceiling, [65, 70, d - 500], [x, h - 160, bz + d / 2], steel, 5);
        strip(ceiling, [35, 8, d - 560], [x, h - 199, bz + d / 2], x < 0 ? 0 : 1);
        for (const z of [bz + 430, front - 430]) rod(ceiling, [x, h, z], [x, h - 125, z], 5, steel);
    }
    for (const x of [-w / 2 + 75, w / 2 - 75]) strip(root, [12, 8, d - 160], [x, 45, bz + d / 2], x < 0 ? 0 : 1);
    // Mirror-wall wash: the cyan lane light grazes the glass from the skirting.
    wash(right, [d - 200, 1500], [w / 2 - 36, 830, bz + d / 2], 1, .32, [0, -Math.PI / 2, 0]);
    const specs = [
        { at: [layout.desk[0], h - 380, bz + 1100], power: 3.2, channel: 0 },
        { at: [w / 2 - 750, 1800, front - 1700], power: 3.2, channel: 1 },
        { at: [-w / 2 + 750, 1700, front - 800], power: 2.5, channel: 0, warm: true },
        { at: [tx, h - 420, tz], power: 4.2, channel: 1 }
    ].map(spec => { const light = new THREE.PointLight(T.lights.point, 0, 4500 * root.scale.x, 2); light.position.set(...spec.at); root.add(light); return { ...spec, light, power: spec.power * (root.scale.x * 1000) ** 2 }; });
    const sessions = buildGymSessionDetail(room, layout, { group, box, mesh, rod, material, label, markSceneAsset }, { mat, weights, hydrate }, T);
    room.roomAtmosphere = (id, accent = 1) => {
        const mode = T.modes[id] || T.modes.morning;
        programmes.update(id); sessions.apply(id);
        const c = skyCanvas.getContext('2d'), grad = c.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, mode.sky[0]); grad.addColorStop(1, mode.sky[1]); c.fillStyle = grad; c.fillRect(0, 0, 512, 512);
        c.fillStyle = C.blinds; for (let i = 0; i < 14; i++) c.fillRect(i * 40, 380 + i % 3 * 20, 30, 132); sky.needsUpdate = true; windowVista.setPhase(id);
        glow.forEach(({ mat, channel }) => { mat.color.set(mode.colors[channel]); mat.emissive.set(mode.colors[channel]); mat.emissiveIntensity = .12 + mode.wash * accent; });
        washes.forEach(({ mat, channel, strength }) => mat.color.set(channel === 'warm' ? T.lights.warmWash : mode.colors[channel]).multiplyScalar(strength * (channel === 'warm' ? mode.practical : mode.wash) * accent));
        practicals.forEach(({ mat, strength }) => { mat.emissiveIntensity = (.25 + mode.practical * 1.1) * strength; });
        glassMat.emissiveIntensity = mode.glass;
        placeSun(mode.sun); sunMat.color.set(mode.sun[2]).multiplyScalar(mode.sun[3]); sunPatch.visible = mode.sun[3] > 0;
        specs.forEach(spec => { spec.light.color.set(spec.warm ? T.lights.warm : T.lights.cool); if (!spec.warm) spec.light.color.lerp(new THREE.Color(mode.colors[spec.channel]), T.lightTint[id === 'party' ? 1 : 0]); spec.light.intensity = spec.power * (spec.warm ? mode.practical : mode.wash) * accent; });
        root.userData.atmosphere = id;
    };
    interiorCraftFinishes(room,{wood:[oak,ash],metal:[steel,silver],rubber:[rubber]});
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[graphite, 'powder'], [steel, 'metal'], [rubber, 'rubber'], [silver, 'metal'], [oak, 'wood'], [ash, 'wood'], [slate, 'powder'], ...[...concretes.values()].map(m => [m, 'plaster'])]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning'); root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
