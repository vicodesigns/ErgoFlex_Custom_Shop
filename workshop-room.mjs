import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tiers = [
    ['apartment', 'Compact maker workshop', 3600, 4400, 2600],
    ['house', 'Garage workshop & repair bay', 4800, 5600, 2800],
    ['spacious', 'Woodworking & assembly studio', 6000, 7000, 3000],
    ['premium', 'Fabrication & prototype workshop', 7600, 8800, 3200],
    ['executive', 'Private maker & fabrication suite', 9600, 10800, 3400]
];
export const WORKSHOP_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1800, front = back + depth, desk = [-width / 2 + 1100, back + 2250];
    const props = [
        { id: 'chop-saw', at: [-width / 2 + 600, 900, back + 400] },
        { id: 'hammer-drill', at: [-width / 2 + 1300, 900, back + 430], turn: 20 },
        { id: 'rubber-mallet', at: [-width / 2 + 1150, 900, back + 270], turn: 90 },
        // This library model's feet sit 21.2 mm above its authored origin.
        { id: 'oscilloscope', at: [width / 2 - 600, 878.8, back + 380] },
        { id: 'toolbox', at: [width / 2 - 1250, 900, back + 330] },
        { id: 'site-radio', at: [width / 2 - 900, 900, back + 290], turn: -15 },
        { id: 'tool-cart', at: [width / 2 - 440, 0, front - 820], turn: -90 },
        { id: 'kenney-furniture-stool-bar-square', at: [desk[0], 0, desk[1] + 900] },
        { id: 'cork-board', at: [0, 1750, back + 46], on: 'wall' }
    ];
    if (tier) props.push({ id: 'shop-machine', at: [width / 2 - 650, 0, back + 1800], turn: -90 },
        { id: 'toolbox-industrial', at: [width / 2 - 680, 0, front - 2500], turn: -90 });
    if (tier >= 2) props.push({ id: 'cutter-machine', at: [500, 900, back + 4500] },
        { id: 'pallet', at: [-width / 2 + 900, 0, front - 850] },
        { id: 'work-boot', at: [-width / 2 + 250, 0, back + 3800], turn: 30 });
    return [id, { id, name, width, depth, height, back, tier, desk, props,
        daylight: [-width / 2 + 100, back + 2500] }];
}));
export const workshopLayoutById = id => WORKSHOP_LAYOUTS[id] || WORKSHOP_LAYOUTS.apartment;
export const workshopLayoutForSize = size => WORKSHOP_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
// tubes: overhead fluorescent level · tube: its colour · string: festoon bulbs · sign: back-wall lightbox.
export const WORKSHOP_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing planning and measurement', key: '#fff0d8', fill: '#d9eaf2', accent: '#d6e1dd', power: 1.75, ambient: .46, bounce: .62, exposure: 1.04, sky: ['#8fbedc', '#f4dfb8'], practical: .45, wash: .25, tubes: .3, tube: '#eef5f3', string: 0, sign: .12, colors: ['#e4f3f5', '#74b4b2'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Build & assemble · level desk at bench height', key: '#fff6e8', fill: '#e2eef5', accent: '#d9c7ab', power: 1.45, ambient: .5, bounce: .64, exposure: 1.05, sky: ['#a9cbe2', '#eae6d9'], practical: .65, wash: .4, tubes: 1, tube: '#f1f7ff', string: 0, sign: .22, colors: ['#ebf5ed', '#c99d64'], height: 36, tilt: 0, offset: [80, 100], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Detail work · focused task lights and warm wood', key: '#f0c99c', fill: '#c6d6e6', accent: '#efb96c', power: .62, ambient: .3, bounce: .44, exposure: 1.12, sky: ['#6f7ea3', '#e8a878'], practical: .95, wash: .7, tubes: .22, tube: '#ffe6c2', string: .55, sign: .75, colors: ['#ffd9a0', '#7bb8bc'], height: 28, tilt: 12, offset: [0, 150], yaw: 0, leds: true, color: '#ffdda8' },
    night: { label: 'Night', description: 'Quiet prototyping · cool bench lights and low ambient glow', key: '#b9d0e8', fill: '#bfd2e4', accent: '#86b5c8', power: .16, ambient: .12, bounce: .18, exposure: 1.08, sky: ['#17263a', '#3c5470'], practical: .75, wash: .42, tubes: .05, tube: '#cfe9f4', string: .18, sign: .5, colors: ['#c5e9ef', '#71b6c1'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#92d9e5' },
    party: { label: 'Open workshop', description: 'Show your projects · desk turned for a demonstration', key: '#e8dfcb', fill: '#d0e0e9', accent: '#e3aa68', power: .8, ambient: .4, bounce: .5, exposure: 1.1, sky: ['#5f7a9a', '#e0b07e'], practical: 1, wash: 1, tubes: .5, tube: '#fff0da', string: 1.35, sign: 1.25, colors: ['#f5cc8c', '#e8a35f'], height: 43.5, tilt: -5, offset: [100, 250], yaw: -12, leds: true, color: '#ffbd70' }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}
// Stable pseudo-random values keep every rebuild of a layout identical.
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// World-aligned UVs give repeated maps (painted block, hazard tape) a physical
// size, so courses and stripes line up across separate pieces.
function planarUV(geometry, period) {
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
        uv.setXY(i, u / period, v / period);
    }
    uv.needsUpdate = true; return geometry;
}

export function buildWorkshopRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier } = layout, front = bz + d;
    // Small repeated parts are merged per prop and material: one draw call each.
    const kits = new Map();
    const part = (parent, mat, geometry, at = [0, 0, 0], rot = [0, 0, 0], uvPeriod = 0) => {
        const g = geometry.index ? geometry.toNonIndexed() : geometry; if (g !== geometry) geometry.dispose();
        g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
        if (uvPeriod) planarUV(g, uvPeriod);
        if (!kits.has(parent)) kits.set(parent, new Map());
        const byMat = kits.get(parent); if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g); return g;
    };
    const kbox = (parent, size, at, mat, rot, uvPeriod) => part(parent, mat, new THREE.BoxGeometry(...size), at, rot, uvPeriod);
    const kcyl = (parent, [top, bottom, height, seg = 14], at, mat, rot) => part(parent, mat, new THREE.CylinderGeometry(top, bottom, height, seg), at, rot);
    const krod = (parent, from, to, radius, mat, seg = 8) => {
        const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a), g = new THREE.CylinderGeometry(radius, radius, delta.length(), seg);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
        return part(parent, mat, g, a.add(b).multiplyScalar(.5).toArray());
    };
    const ktorus = (parent, [radius, tube, arc = Math.PI * 2], at, mat, rot) => part(parent, mat, new THREE.TorusGeometry(radius, tube, 6, 20, arc), at, rot);
    const kball = (parent, [rx, ry, rz], at, mat) => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(rx, ry, rz); return part(parent, mat, g, at); };
    const flushKits = () => {
        for (const [parent, byMat] of kits) for (const [mat, list] of byMat) {
            const obj = mesh(parent, mergeGeometries(list), mat); list.forEach(g => g.dispose());
            if (mat.emissive?.getHex()) obj.castShadow = false;
        }
        kits.clear();
    };

    // Painted concrete block, sealed slab, plywood, maple worktops and hardboard.
    const blockMap = texture((c, tw, th) => {
        c.fillStyle = '#b9b9b0'; c.fillRect(0, 0, tw, th);
        for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
            const x = col * 128 + (row % 2) * 64, y = row * 64, tone = 196 + Math.round((hash(row * 9 + col) - .5) * 12);
            c.fillStyle = `rgb(${tone},${tone},${tone - 7})`; c.fillRect(x + 2, y + 2, 124, 60);
            for (let s = 0; s < 26; s++) { c.fillStyle = s % 2 ? '#ffffff16' : '#5a5a5014'; c.fillRect(x + 4 + hash(row * 131 + col * 17 + s) * 118, y + 4 + hash(s * 7 + row + col * 3) * 54, 2, 2); }
        }
    });
    blockMap.wrapS = blockMap.wrapT = THREE.RepeatWrapping;
    const plaster = material('#ffffff', { map: blockMap, roughness: .93 }), paintLow = material('#9fb2ae', { map: blockMap, roughness: .86 });
    const steel = material('#34474b', { metalness: .5, roughness: .48 });
    const silver = material('#a8b2b4', { metalness: .75, roughness: .35 }), orange = material('#d58b45', { roughness: .7 });
    const teal = material('#508884', { roughness: .75 }), rubber = material('#293335', { roughness: .95 });
    const red = material('#b63a2e', { roughness: .45, metalness: .1 }), yellow = material('#e0ad34', { roughness: .5 });
    const paper = material('#ebe7dc', { roughness: .85 }), cardboard = material('#b28b5b', { roughness: .95 });
    const handle = material('#a8784a', { roughness: .55 }), pine = material('#d4ae79', { roughness: .74 }), oak = material('#a1734a', { roughness: .68 }), walnut = material('#6c4a33', { roughness: .62 });
    const enamel = material('#e8ebe6', { roughness: .38, metalness: .15 }), glass = material('#b8ccc8', { roughness: .12, metalness: .1 });
    const woodMap = texture((c, tw, th) => {
        c.fillStyle = '#bb9868'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#c8a6731c' : '#94704418'; c.fillRect(i * tw / 9, 0, tw / 9, th); }
        c.lineWidth = 1.4;
        for (let i = 0; i < 150; i++) {
            const x = i * 3.45 + hash(i) * 3, bend = 18 * Math.sin(i * .21);
            c.strokeStyle = i % 7 ? '#73553524' : '#6a4a2c44'; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + bend, th * .3, x - bend, th * .7, x + bend * .3, th); c.stroke();
        }
        c.fillStyle = '#6a4a2c33'; for (const [x, y] of [[140, 120], [380, 360]]) { c.beginPath(); c.ellipse(x, y, 7, 15, 0, 0, Math.PI * 2); c.fill(); }
    });
    const ply = material('#ffffff', { map: woodMap, roughness: .8 });
    const butcherMap = texture((c, tw, th) => {
        const tones = ['#caa271', '#b98f5d', '#d7b282', '#ae8453', '#c39a68'];
        for (let i = 0; i * 16 < th; i++) {
            c.fillStyle = tones[Math.floor(hash(i * 3.7) * tones.length)]; c.fillRect(0, i * 16, tw, 16);
            c.strokeStyle = '#6b4a2a22'; c.lineWidth = 1; for (let g = 0; g < 4; g++) { c.beginPath(); c.moveTo(0, i * 16 + 3 + g * 3.5); c.bezierCurveTo(tw * .3, i * 16 + 2 + g * 3, tw * .7, i * 16 + 5 + g * 3, tw, i * 16 + 3 + g * 3.5); c.stroke(); }
            c.fillStyle = '#5c3e2240'; c.fillRect(hash(i * 11.3) * tw, i * 16, 2, 16); c.fillRect(0, i * 16, tw, 1);
        }
    }, 1024, 256);
    const block = material('#ffffff', { map: butcherMap, roughness: .6 });
    const floorMap = texture((c, tw, th) => {
        c.fillStyle = '#8b908c'; c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 70; i++) {
            const x = hash(i) * tw, y = hash(i + 50) * th, r = 40 + hash(i + 90) * 150, g = c.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, i % 2 ? '#a5a9a21c' : '#6d736f1c'); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        for (let i = 0; i < 5200; i++) { c.fillStyle = i % 3 ? '#e2e0cf22' : '#29363630'; c.fillRect(hash(i * 1.37) * tw, hash(i * 2.11) * th, 1 + i % 3, 1 + i % 2); }
        c.strokeStyle = '#ffffff0c'; c.lineWidth = 6; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(hash(i * 5) * tw, hash(i * 7) * th, 120 + i * 9, i, i + 1.6); c.stroke(); }
        for (const [x, y, r] of [[300, 700, 46], [760, 260, 30], [820, 860, 22]]) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#3a3a3440'); g.addColorStop(1, '#3a3a3400'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r * 1.3, r, .4, 0, Math.PI * 2); c.fill(); }
        // Saw-cut control joints every 1.2 m.
        for (const p of [0, tw / 2]) { c.fillStyle = '#5b625f'; c.fillRect(p, 0, 3, th); c.fillRect(0, p, tw, 3); c.fillStyle = '#b1b5ae55'; c.fillRect(p + 3, 0, 1, th); c.fillRect(0, p + 3, tw, 1); }
    }, 1024, 1024);
    floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w / 2400, d / 2400);
    const slab = material('#ffffff', { map: floorMap, roughness: .86 });
    box(root, [w, 30, d], [0, -15, bz + d / 2], slab);
    const hazardMap = texture((c, tw) => { c.fillStyle = '#e3b232'; c.fillRect(0, 0, tw, tw); c.fillStyle = '#26292a'; for (let k = -2; k < 3; k++) { c.beginPath(); c.moveTo(k * 64, 0); c.lineTo(k * 64 + 32, 0); c.lineTo(k * 64 + 32 + tw, tw); c.lineTo(k * 64 + tw, tw); c.fill(); } }, 128, 128);
    hazardMap.wrapS = hazardMap.wrapT = THREE.RepeatWrapping;
    const hazard = material('#ffffff', { map: hazardMap, roughness: .7 });
    // One atlas for all safety signage (4 × 2 cells).
    const signMap = texture((c) => {
        const cell = (i, draw) => { c.save(); c.translate(i % 4 * 256, Math.floor(i / 4) * 256); draw(); c.restore(); };
        const caption = (text, color = '#1f2a2c', y = 226, size = 24) => { c.fillStyle = color; c.font = `bold ${size}px sans-serif`; c.textAlign = 'center'; c.fillText(text, 128, y); };
        const plate = (bg = '#f4f1e8') => { c.fillStyle = bg; c.fillRect(6, 6, 244, 244); c.strokeStyle = '#2a3436'; c.lineWidth = 3; c.strokeRect(10, 10, 236, 236); };
        cell(0, () => { plate(); c.fillStyle = '#1f5fa8'; c.beginPath(); c.arc(128, 100, 70, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 9; c.strokeRect(78, 86, 42, 30); c.strokeRect(136, 86, 42, 30); c.beginPath(); c.moveTo(120, 96); c.lineTo(136, 96); c.stroke(); caption('EYE PROTECTION', '#1f5fa8', 200); caption('MUST BE WORN', '#1f2a2c', 230, 20); });
        cell(1, () => { plate(); c.fillStyle = '#1f5fa8'; c.beginPath(); c.arc(128, 100, 70, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 10; c.beginPath(); c.arc(128, 104, 40, Math.PI, 0); c.stroke(); c.fillStyle = '#fff'; c.fillRect(78, 98, 22, 40); c.fillRect(156, 98, 22, 40); caption('HEARING', '#1f5fa8', 200); caption('PROTECTION', '#1f2a2c', 230, 20); });
        cell(2, () => { plate('#f2c230'); c.fillStyle = '#1e2224'; c.beginPath(); c.moveTo(128, 34); c.lineTo(206, 166); c.lineTo(50, 166); c.closePath(); c.fill(); c.fillStyle = '#f2c230'; c.beginPath(); c.moveTo(128, 60); c.lineTo(186, 154); c.lineTo(70, 154); c.closePath(); c.fill(); c.fillStyle = '#1e2224'; c.fillRect(121, 84, 14, 40); c.fillRect(121, 132, 14, 13); caption('CAUTION', '#1e2224', 200, 28); caption('MOVING MACHINERY', '#1e2224', 230, 18); });
        cell(3, () => { plate('#c2342a'); c.fillStyle = '#fff'; c.fillRect(108, 70, 40, 100); c.beginPath(); c.arc(128, 70, 20, Math.PI, 0); c.fill(); c.fillRect(120, 36, 16, 20); c.fillRect(136, 40, 34, 8); caption('FIRE', '#fff', 206, 26); caption('EXTINGUISHER', '#fff', 234, 20); });
        cell(4, () => { plate('#1f8a4c'); c.fillStyle = '#fff'; c.fillRect(98, 46, 60, 150); c.fillRect(53, 91, 150, 60); c.fillStyle = '#1f8a4c'; c.fillRect(110, 58, 36, 126); c.fillRect(65, 103, 126, 36); c.fillStyle = '#fff'; c.fillRect(118, 66, 20, 110); c.fillRect(73, 111, 110, 20); caption('FIRST AID', '#fff', 232, 24); });
        cell(5, () => { plate('#f7f5ee'); c.fillStyle = '#1f2a2c'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('THIS SHOP HAS', 128, 54); c.fillText('WORKED SAFELY FOR', 128, 82); c.fillStyle = '#1f8a4c'; c.fillRect(56, 98, 144, 82); c.fillStyle = '#f7f5ee'; c.font = 'bold 64px monospace'; c.fillText('214', 128, 162); caption('DAYS', '#1f2a2c', 222, 26); });
        cell(6, () => { plate('#f4f1e8'); c.fillStyle = '#1f2a2c'; c.font = 'bold 26px sans-serif'; c.textAlign = 'left'; c.fillText('SHOP RULES', 34, 52); c.font = '17px sans-serif'; ['1  Glasses on', '2  Unplug to change blades', '3  Clamp it, don’t hold it', '4  Sweep up', '5  Share what you make'].forEach((t, i) => c.fillText(t, 34, 90 + i * 30)); c.fillStyle = '#d58b45'; c.fillRect(34, 60, 188, 4); });
        cell(7, () => { plate('#f2c230'); c.fillStyle = '#1e2224'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('UNPLUG', 128, 92); c.fillText('BEFORE', 128, 130); c.font = 'bold 22px sans-serif'; c.fillText('CHANGING BLADES', 128, 170); c.fillRect(40, 196, 176, 8); });
    }, 1024, 512);
    const signs = material('#ffffff', { map: signMap, roughness: .6 });
    const signPlate = (parent, cell, [sw, sh], at, turn = 0) => {
        const g = new THREE.PlaneGeometry(sw, sh), uv = g.attributes.uv, cx = cell % 4, cy = Math.floor(cell / 4);
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 4, 1 - (cy + 1) / 2 + uv.getY(i) / 2);
        return part(parent, signs, g, at, [0, turn, 0]);
    };

    // Open-workshop bunting: pennants sample one colour band each, so a whole run is one draw call.
    const flagMap=texture((c,tw,th)=>{['#d58b45','#508884','#e0ad34','#ebe7dc','#b63a2e'].forEach((col,i)=>{c.fillStyle=col;c.fillRect(i*tw/5,0,tw/5,th);});},160,16);
    const flags=material('#ffffff',{map:flagMap,roughness:.8,side:THREE.DoubleSide}),bunting=[];
    const pennants=(parent,from,to,sag,turn)=>{
        const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),mid=a.clone().add(b).multiplyScalar(.5);mid.y-=sag*2;
        const curve=new THREE.QuadraticBezierCurve3(a,mid,b),count=Math.max(4,Math.round(a.distanceTo(b)/190));part(parent,rubber,new THREE.TubeGeometry(curve,24,2.5,4));
        for(let i=0;i<count;i++){
            const g=new THREE.PlaneGeometry(130,150),pos=g.attributes.position,uv=g.attributes.uv,band=(i%5+.5)/5;
            pos.setXY(2,0,-75);pos.setXY(3,0,-75);for(let k=0;k<uv.count;k++)uv.setXY(k,band,.5);
            const p=curve.getPoint((i+.5)/count);part(parent,flags,g,[p.x,p.y-72,p.z],[0,turn,0]);
        }
    };
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`workshop:${layout.id}:fixture:${id}`});return g;};
    // Emissive fixtures follow the mode: task (bench/practical), tube (shop
    // fluorescents), string (festoon bulbs), sign (lightbox) and screen.
    const glow=[];
    const glowMat=(kind,color='#d8eef0',extra={})=>{const mat=material(color,{emissive:color,emissiveIntensity:.3,...extra});glow.push({mat,kind});return mat;};
    const taskGlow=glowMat('task'),tubeGlow=glowMat('tube','#f1f7ff',{roughness:.3}),bulbGlow=glowMat('string','#8c7653',{roughness:.3}),screenGlow=glowMat('screen','#6fd0c8');
    const label=(parent,text,size,at,color='#e3e6d7')=>{const map=texture((c,tw,th)=>{c.fillStyle='#26383d';c.fillRect(0,0,tw,th);c.fillStyle=color;c.font='bold 42px sans-serif';c.textAlign='center';c.fillText(text,tw/2,th*.65);},1024,128);return box(parent,[...size,5],at,material('#ffffff',{map,roughness:.8}));};
    const wallBox=(parent,size,at,mat)=>{const g=new THREE.BoxGeometry(...size);g.translate(...at);return mesh(parent,planarUV(g,1600),mat);};

    const back=new THREE.Group();back.name='Workshop tool and bench wall';root.add(back);
    wallBox(back,[w,h,80],[0,h/2,bz-40],plaster);box(back,[w,160,24],[0,80,bz+12],steel);room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    wallBox(back,[w,940,2],[0,630,bz+1],paintLow);box(back,[w,30,4],[0,1115,bz+2],yellow);
    const pegMap=texture((c,tw,th)=>{
        c.fillStyle='#a98c63';c.fillRect(0,0,tw,th);
        for(let i=0;i<2600;i++){c.fillStyle=i%2?'#c3a77d26':'#6d553722';c.fillRect(hash(i*.73)*tw,hash(i*1.91)*th,3+i%4,1);}
        for(let x=8;x<tw;x+=16)for(let y=8;y<th;y+=16){c.fillStyle='#d2b88f55';c.beginPath();c.arc(x+.7,y+.7,3.4,0,Math.PI*2);c.fill();c.fillStyle='#3d3f38';c.beginPath();c.arc(x,y,2.7,0,Math.PI*2);c.fill();}
    });
    pegMap.wrapS=pegMap.wrapT=THREE.RepeatWrapping;pegMap.repeat.set((w-200)/800,1.3);
    box(back,[w-160,1030,25],[0,1550,bz+12.5],material('#ffffff',{map:pegMap,roughness:.9}));
    // Timber frame around the pegboard and a steel raceway with outlets along the worktop.
    for(const y of [1015,2085])kbox(back,[w-80,40,32],[0,y,bz+16],pine);
    for(const s of [-1,1])kbox(back,[40,1110,32],[s*((w-160)/2+20),1550,bz+16],pine);
    kbox(back,[w-200,80,30],[0,945,bz+43],silver);
    for(let x=-w/2+400;x<w/2-300;x+=600){kbox(back,[78,56,4],[x,945,bz+60],paper);for(const o of [-14,14])kbox(back,[6,14,2],[x+o,945,bz+63],rubber);}
    // Back-lit shop sign; the lettering glows with the mode's sign level.
    const signW=Math.min(w-240,3400),signText=texture((c,tw,th)=>{
        c.fillStyle='#000000';c.fillRect(0,0,tw,th);c.font='bold 64px sans-serif';c.textAlign='center';c.textBaseline='middle';
        const parts=['MAKE','/','REPAIR','/','REPEAT'],gap=34,widths=parts.map(p=>c.measureText(p).width),total=widths.reduce((a,b)=>a+b,0)+gap*4;
        let x=(tw-total)/2;parts.forEach((p,i)=>{c.fillStyle=p==='/'?'#ff9a3c':'#f6f1e3';c.fillText(p,x+widths[i]/2,th/2+3);x+=widths[i]+gap;});
        c.fillStyle='#ff9a3c';c.fillRect(40,th-14,tw-80,4);
    },1024,128);
    kbox(back,[signW+40,190,46],[0,h-160,bz+23],steel);
    const signFace=material('#ffffff',{map:signText,emissive:'#ffffff',emissiveMap:signText,emissiveIntensity:.2,roughness:.4});glow.push({mat:signFace,kind:'sign'});
    mesh(back,new THREE.BoxGeometry(signW,150,6),signFace,[0,h-160,bz+49]).castShadow=false;
    const right=new THREE.Group();right.name='Workshop machines and storage wall';root.add(right);wallBox(right,[80,h,d],[w/2+40,h/2,bz+d/2],plaster);box(right,[20,160,d],[w/2-10,80,bz+d/2],steel);room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    wallBox(right,[2,940,d],[w/2-1,630,bz+d/2],paintLow);box(right,[4,30,d],[w/2-2,1115,bz+d/2],yellow);
    const left=new THREE.Group();left.name='Workshop daylight and materials wall';root.add(left);
    const wz=bz+2400,ww=tier?1900:1400,low=1050,wh=1200,a=wz-ww/2,b=wz+ww/2;
    wallBox(left,[80,h,a-bz],[-w/2-40,h/2,(a+bz)/2],plaster);wallBox(left,[80,h,front-b],[-w/2-40,h/2,(front+b)/2],plaster);wallBox(left,[80,low,ww],[-w/2-40,low/2,wz],plaster);wallBox(left,[80,h-low-wh,ww],[-w/2-40,(h+low+wh)/2,wz],plaster);
    wallBox(left,[2,940,a-bz],[-w/2+1,630,(a+bz)/2],paintLow);wallBox(left,[2,940,front-b],[-w/2+1,630,(front+b)/2],paintLow);wallBox(left,[2,890,ww],[-w/2+1,605,wz],paintLow);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(left,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[-w/2-52,low+wh/2,wz]);pane.rotation.y=Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(left,[65,wh+50,30],[-w/2+10,low+wh/2,z],steel);for(const y of [low,low+wh])box(left,[65,30,ww+60],[-w/2+10,y,wz],steel);box(left,[170,30,ww+80],[-w/2+50,low-15,wz],ply);
    for(const z of [(a+wz)/2,(wz+b)/2])kbox(left,[30,16,ww/2-40],[-w/2+10,low+wh*.55,z],steel);
    // Window sill: a potted cutting, a jar of pencils and a coffee can of brushes.
    kcyl(left,[55,42,110],[-w/2+60,low+55,wz-ww*.3],orange);kball(left,[80,70,80],[-w/2+60,low+150,wz-ww*.3],material('#5d8a55',{roughness:.85}));
    kcyl(left,[38,38,120],[-w/2+60,low+60,wz+ww*.25],silver);for(let i=0;i<5;i++)krod(left,[-w/2+60,low+80,wz+ww*.25+(i-2)*10],[-w/2+60+(i-2)*12,low+230,wz+ww*.25+(i-2)*16],5,i%2?yellow:handle);
    room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});

    const plans=group('project-board','Workshop project drawings and build checklist',[w/2-30,tier>=3?1800:1580,bz+d*.52],-Math.PI/2,right);
    const planMap=texture((c,tw,th)=>{
        c.fillStyle='#d8ded4';c.fillRect(0,0,tw,th);c.fillStyle='#2b555b';c.font='bold 40px sans-serif';c.fillText('IN THE MAKING',38,65);
        c.strokeStyle='#668c8e';c.lineWidth=2;for(let x=35;x<tw*.59;x+=38){c.beginPath();c.moveTo(x,100);c.lineTo(x,th-40);c.stroke();}for(let y=100;y<th-35;y+=38){c.beginPath();c.moveTo(35,y);c.lineTo(tw*.58,y);c.stroke();}
        c.strokeStyle='#315a60';c.lineWidth=5;c.strokeRect(85,145,390,210);c.strokeRect(140,198,280,105);c.beginPath();c.moveTo(85,145);c.lineTo(140,198);c.moveTo(475,145);c.lineTo(420,198);c.moveTo(85,355);c.lineTo(140,303);c.moveTo(475,355);c.lineTo(420,303);c.stroke();
        c.lineWidth=2;c.setLineDash([8,6]);c.beginPath();c.moveTo(85,385);c.lineTo(475,385);c.moveTo(505,145);c.lineTo(505,355);c.stroke();c.setLineDash([]);c.font='20px sans-serif';c.fillText('1200',260,410);c.save();c.translate(530,270);c.rotate(-Math.PI/2);c.fillText('600',0,0);c.restore();
        c.font='27px sans-serif';['01  MEASURE','02  MAKE','03  REFINE','04  SHARE'].forEach((text,i)=>{c.strokeRect(650,142+i*63,22,22);c.fillText(text,695,163+i*63);});
        c.strokeStyle='#b77e43';c.lineWidth=4;for(const i of [0,1]){c.beginPath();c.moveTo(653,150+i*63);c.lineTo(661,160+i*63);c.lineTo(676,138+i*63);c.stroke();}
        c.fillStyle='#b77e43';c.fillRect(38,th-32,tw-76,7);
    },1024,512);
    box(plans,[tier?1800:1200,670,18],[0,0,0],steel,4);box(plans,[tier?1740:1140,610,4],[0,0,12],material('#ffffff',{map:planMap,roughness:.9}));
    // Pinned sketches and a hanging steel rule along the board's top edge.
    for(let i=0;i<3;i++){const x=(tier?480:260)+i*(tier?120:95);kbox(plans,[150,190,2],[x,-215+i*12,17+i],paper,[0,0,(i-1)*.06]);kball(plans,[7,7,5],[x,-130+i*12,22],red);}
    kbox(plans,[tier?900:600,28,3],[0,-352,14],silver);
    for(const z of [bz+90,front-80])rod(right,[w/2-25,180,z],[w/2-25,h-90,z],12,silver);
    rod(right,[w/2-25,h-90,bz+90],[w/2-25,h-90,front-80],12,silver);
    for(const z of [bz+90,front-80])kbox(right,[40,120,90],[w/2-22,1250,z],steel);

    const bench=group('bench-run','Plywood workbench with drawers and tool wall',[0,0,bz+390]);
    box(bench,[w-150,65,730],[0,867.5,0],block,5);kbox(bench,[w-150,40,8],[0,880,368],walnut);
    const bays=Math.ceil((w-200)/900),bw=(w-200)/bays;
    for(let i=0;i<bays;i++){
        const x=-(w-200)/2+bw*(i+.5);
        box(bench,[bw-16,740,580],[x,430,-20],i%2?steel:teal,3);
        box(bench,[bw-75,95,500],[x,47.5,-20],rubber);
        for(const y of [215,390,565,740]){box(bench,[bw-45,155,15],[x,y,280],i%2?steel:teal,3);rod(bench,[x-80,y+20,297],[x+80,y+20,297],5,silver);kbox(bench,[72,34,2],[x-bw/2+80,y+40,288.5],paper);}
    }
    // Hanging hand tools use simple original geometry over the pegboard.
    for(let i=0;i<8;i++){
        const x=-w/2+190+i*100;
        krod(bench,[x,1100,-342],[x,1350-i%3*35,-342],8,i%2?orange:steel);
        if(i%2)kbox(bench,[65,25,22],[x,1360-i%3*35,-342],silver);
        else ktorus(bench,[17,5],[x,1360-i%3*35,-340],silver);
        kcyl(bench,[3,3,26,6],[x,1373-i%3*35+18,-352],silver,[Math.PI/2,0,0]);
    }
    {
        const x0=-w/2+170,z=-350;
        // Level, panel saw and framing square.
        kbox(bench,[780,55,28],[x0+400,1912,z+4],yellow);for(const o of [-260,0,260])kbox(bench,[44,20,4],[x0+400+o,1912,z+19],teal);
        kbox(bench,[500,125,3],[x0+390,1790,z-8],silver,[0,0,-.04]);kbox(bench,[120,120,26],[x0+80,1800,z-4],handle);kbox(bench,[50,40,28],[x0+80,1800,z-4],rubber);
        kbox(bench,[420,44,3],[x0+330,1560,z-8],silver);kbox(bench,[44,170,3],[x0+520,1625,z-8],silver);
        // Graduated combination spanners.
        for(let i=0;i<8;i++){const x=x0+720+i*45,len=140+i*14;kbox(bench,[14,len,5],[x,1850-len/2,z-6],silver);ktorus(bench,[13+i,5],[x,1850+6+i,z-6],silver);ktorus(bench,[13+i,5,Math.PI*1.3],[x,1850-len-6-i,z-6],silver,[0,0,-Math.PI*.15]);}
        // Pliers with red grips.
        for(let i=0;i<3;i++){const x=x0+760+i*110;for(const s of [-1,1]){kbox(bench,[12,110,6],[x+s*6,1540,z-6],steel,[0,0,s*.05]);kbox(bench,[18,120,12],[x+s*14,1430,z-6],red,[0,0,s*.12]);}}
        if(w>=4800){
            // Chisel roll and coping saw for the larger benches.
            const xb=-w/2+1300;kbox(bench,[520,24,90],[xb+260,1640,z+30],handle);
            for(let i=0;i<6;i++){kcyl(bench,[13,15,95],[xb+40+i*85,1700,z+30],i%2?orange:handle);kbox(bench,[10+i*4,140,4],[xb+40+i*85,1580,z+30],silver);}
            krod(bench,[xb+90,1850,z],[xb+390,1850,z],3,silver);ktorus(bench,[150,8,Math.PI],[xb+240,1850,z],steel);kcyl(bench,[16,16,110],[xb+240,1790,z],handle);
        }
        // Screwdriver rack beneath the cork board.
        kbox(bench,[480,22,80],[0,1360,z+30],handle);
        for(let i=0;i<9;i++){const x=-200+i*50;kcyl(bench,[14,15,95],[x,1420,z+30],[red,yellow,teal][i%3]);kcyl(bench,[3.5,3.5,90+i%3*30],[x,1300-i%3*15,z+30],silver,undefined);}
        // F-clamps right of the cork board.
        for(let i=0;i<6;i++){const x=540+i*95;kbox(bench,[10,380,6],[x,1730,z-4],silver);kbox(bench,[80,24,24],[x+35,1908,z-4],steel);kbox(bench,[80,24,24],[x+35,1620,z-4],steel);kcyl(bench,[14,12,110],[x+55,1545,z-4],handle);}
        // Safety glasses and ear defenders on hooks, extension cord coil, tape measure.
        const xr=w/2-560;
        ktorus(bench,[62,9,Math.PI],[xr+20,1560,z+8],red);for(const s of [-1,1])kcyl(bench,[34,34,40],[xr+20+s*62,1530,z+8],red,[Math.PI/2,0,0]);
        kbox(bench,[150,40,10],[xr+20,1420,z+6],rubber);for(const s of [-1,1])kbox(bench,[62,36,4],[xr+20+s*38,1420,z+13],glass);
        ktorus(bench,[110,10],[xr+330,1720,z+10],orange);ktorus(bench,[96,10],[xr+330,1700,z+16],orange);kbox(bench,[60,90,40],[xr+330,1820,z+18],rubber);
        kbox(bench,[78,78,42],[xr+130,1760,z+16],yellow);kbox(bench,[30,30,44],[xr+130,1760,z+18],rubber);kbox(bench,[20,60,3],[xr+130,1700,z+20],silver);
        if(w>=4800)for(let i=0;i<4;i++){const x=1180+i*130;krod(bench,[x,1520,z],[x,1840,z],13,handle);kbox(bench,[i%2?120:90,44,44],[x,1855,z+6],i===3?rubber:steel);}
        // Longer benches repeat clamp, hammer, spanner and driver kits along the spare pegboard.
        const hangKits=[
            [380,x=>{for(let i=0;i<4;i++){const cx=x+20+i*95;kbox(bench,[10,380,6],[cx,1730,z-4],silver);kbox(bench,[80,24,24],[cx+35,1908,z-4],steel);kbox(bench,[80,24,24],[cx+35,1620,z-4],steel);kcyl(bench,[14,12,110],[cx+55,1545,z-4],handle);}}],
            [400,x=>{for(let i=0;i<3;i++){const cx=x+60+i*130;krod(bench,[cx,1520,z],[cx,1840,z],13,handle);kbox(bench,[i%2?120:90,44,44],[cx,1855,z+6],i===2?rubber:steel);}}],
            [380,x=>{for(let i=0;i<8;i++){const cx=x+20+i*45,len=140+i*14;kbox(bench,[14,len,5],[cx,1850-len/2,z-6],silver);ktorus(bench,[13+i,5],[cx,1856+i,z-6],silver);}}],
            [480,x=>{kbox(bench,[480,22,80],[x+240,1360,z+30],handle);for(let i=0;i<9;i++){const cx=x+40+i*50;kcyl(bench,[14,15,95],[cx,1420,z+30],[red,yellow,teal][i%3]);kcyl(bench,[3.5,3.5,90+i%3*30],[cx,1300-i%3*15,z+30],silver);}}]
        ];
        const fill=(from,to,k=0)=>{for(let x=from;;k++){const [span,draw]=hangKits[k%hangKits.length];if(x+span>to)break;draw(x);x+=span+160;}};
        if(tier>=2){fill(-w/2+1900,-560);fill(1700,w/2-640,1);}
    }
    // Bench top: work in progress, shavings, a mug and a pencil.
    {
        const gx=-w/2+880;
        kbox(bench,[220,18,140],[gx,909,190],pine);for(const s of [-1,1])kbox(bench,[220,120,16],[gx,978,190+s*62],pine);for(const s of [-1,1])kbox(bench,[16,120,108],[gx+s*102,978,190],pine);
        for(const s of [-1,1]){kbox(bench,[8,280,6],[gx+s*60,995,230],silver,[Math.PI/2,0,0]);kbox(bench,[30,24,24],[gx+s*60,995,357],steel);kbox(bench,[30,24,24],[gx+s*60,995,103],steel);}
        for(let i=0;i<14;i++)kball(bench,[16+hash(i)*14,4,10+hash(i+3)*8],[-w/2+430+hash(i+7)*270,903,190+hash(i+11)*150],pine);
        kcyl(bench,[42,38,96],[w/2-1640,948,260],paper);ktorus(bench,[24,7,Math.PI],[w/2-1640+42,950,260],paper,[0,0,-Math.PI/2]);
        krod(bench,[-120,905,250],[40,905,262],4,yellow);
    }
    const vise=group('bench-vise','Cast-iron bench vise',[-w/2+2200,900,bz+620]);
    box(vise,[150,40,170],[0,20,0],steel,4);box(vise,[120,90,130],[0,85,-30],steel,5);
    for(const z of [-60,45])box(vise,[180,40,30],[0,150,z],silver,2);
    rod(vise,[-110,95,85],[110,95,85],9,silver);rod(vise,[110,35,85],[110,155,85],6,orange);
    // Clear floor lane and an anti-fatigue mat beside the moving desk.
    box(root,[tier?1900:1600,5,1550],[layout.desk[0],2.5,layout.desk[1]],rubber,18);
    for(const s of [-1,1])box(root,[12,2,1550],[layout.desk[0]+s*(tier?950:800),6,layout.desk[1]],orange);
    const marks=new THREE.Group();marks.name='Workshop floor markings and sawdust';root.add(marks);
    kbox(marks,[Math.min(w-1300,2600),10,560],[-w/2+400+Math.min(w-1300,2600)/2,5,bz+1060],rubber);
    const dust=material('#c8aa7d',{roughness:1});for(let i=0;i<34;i++)kball(marks,[5+hash(i*3)*9,1.6,4+hash(i*5)*6],[-w/2+440+hash(i)*480,10.5,bz+830+hash(i+40)*220],dust);
    if(tier){
        const x0=w/2-1340,z0=bz+1290,z1=bz+2310;
        kbox(marks,[50,2,z1-z0],[x0,1,(z0+z1)/2],hazard,undefined,200);for(const z of [z0,z1])kbox(marks,[w/2-20-x0,2,50],[(x0+w/2-20)/2,1,z],hazard,undefined,200);
    }

    // Overhead lumber store on cantilever arms, clear of the floor and the desk's routes.
    const arms=tier>=2?[h-840,h-560,h-280]:[h-540,h-280],rackZ=bz+1500,rackL=Math.min(d-1900,4400);
    const materials=group('materials-rack','Wall-mounted cantilever lumber rack',[w/2,arms[0],rackZ],0,right);
    {
        const n=Math.max(3,Math.ceil(rackL/1100)+1),top=arms[arms.length-1]-arms[0];
        for(let k=0;k<n;k++){const z=60+k*(rackL-120)/(n-1);kbox(materials,[55,top+180,60],[-27.5,(top+70-110)/2,z],steel);for(const y of arms)kbox(materials,[380,30,44],[-245,y-arms[0],z],steel,[0,0,-.03]),kbox(materials,[16,46,44],[-428,y-arms[0]+30,z],orange);}
        const woods=[ply,pine,oak,walnut,pine];
        arms.forEach((y,level)=>{
            const base=24+Math.round(hash(level+.5)*18);
            for(let layer=0;layer<2;layer++){
                let x=-75-layer*40;const lift=y-arms[0]+16+layer*base;
                for(let j=0;j<5-layer*2;j++){
                    const seed=level*13+layer*5+j,thick=layer?20+Math.round(hash(seed)*24):base,width=70+Math.round(hash(seed+1)*(layer?140:90)),len=rackL*(.55+hash(seed+2)*.43);
                    if(x-width<-422)break;
                    const z=rackL/2+(hash(seed+3)-.5)*300;
                    kbox(materials,[width,thick,Math.min(len,rackL+200)],[x-width/2,lift+thick/2,z],woods[seed%woods.length]);x-=width+(layer?20:6);
                }
            }
        });
    }

    // Safety station between the bench end and the machines.
    const safety=group('safety-station','First aid, extinguisher and shop safety signs',[w/2,1000,bz+1050],0,right);
    kbox(safety,[40,120,60],[-20,300,170],steel);
    kcyl(safety,[72,72,430,18],[-96,-5,170],red);kball(safety,[72,36,72],[-96,210,170],red);kcyl(safety,[28,28,40],[-96,245,170],rubber);
    kbox(safety,[110,12,28],[-96,285,170],silver,[0,0,.25]);kbox(safety,[150,10,28],[-90,268,170],silver);krod(safety,[-60,250,170],[-60,-100,205],9,rubber);kcyl(safety,[14,22,60],[-60,-130,205],rubber);
    kcyl(safety,[73,73,120,18],[-96,30,170],paper);
    kbox(safety,[110,380,320],[-55,450,-150],paper);const green=material('#1f8a4c',{roughness:.6});kbox(safety,[4,160,50],[-112,460,-150],green);kbox(safety,[4,50,160],[-112,460,-150],green);kbox(safety,[8,30,60],[-112,330,-60],silver);
    signPlate(safety,3,[220,220],[-3,570,170],-Math.PI/2);signPlate(safety,0,[230,230],[-3,880,170],-Math.PI/2);signPlate(safety,1,[230,230],[-3,880,-150],-Math.PI/2);
    if(tier){signPlate(right,2,[220,220],[w/2-3,1690,bz+1660],-Math.PI/2);signPlate(right,7,[220,220],[w/2-3,1690,bz+1900],-Math.PI/2);}

    // Shop clock and the safe-days board above the rolling cart.
    const clockFace=texture((c,tw)=>{c.fillStyle='#f6f3ea';c.fillRect(0,0,tw,tw);c.translate(tw/2,tw/2);c.fillStyle='#1f2a2c';for(let i=0;i<60;i++){c.save();c.rotate(i*Math.PI/30);c.fillRect(-1.5,-118,3,i%5?8:20);c.restore();}
        c.font='bold 26px sans-serif';c.textAlign='center';c.textBaseline='middle';for(let i=1;i<=12;i++)c.fillText(i,Math.sin(i*Math.PI/6)*86,-Math.cos(i*Math.PI/6)*86);
        c.lineCap='round';c.lineWidth=8;c.beginPath();c.moveTo(0,0);c.lineTo(Math.sin(-1.03)*55,-Math.cos(-1.03)*55);c.stroke();c.lineWidth=5;c.beginPath();c.moveTo(0,0);c.lineTo(Math.sin(1.05)*92,-Math.cos(1.05)*92);c.stroke();
        c.strokeStyle='#c2342a';c.lineWidth=2;c.beginPath();c.moveTo(0,20);c.lineTo(Math.sin(2.6)*100,-Math.cos(2.6)*100);c.stroke();},256,256);
    const clock=group('shop-clock','Shop clock and safe-days board',[w/2,1720,front-700],0,right);
    kcyl(clock,[170,170,46,32],[-23,0,0],steel,[0,0,Math.PI/2]);mesh(clock,new THREE.CylinderGeometry(152,152,8,32),material('#ffffff',{map:clockFace,roughness:.5}),[-48,0,0]).rotation.z=Math.PI/2;
    signPlate(clock,5,[300,300],[-3,-400,0],-Math.PI/2);signPlate(clock,6,[300,300],[-3,-400,-340],-Math.PI/2);

    // Supply shelf above the pegboard with a task light underneath.
    const shelfL=w-200,supply=group('supply-shelf','Supply shelf, parts bins and bench task light',[0,2125,bz],0,back);
    kbox(supply,[shelfL,25,300],[0,0,150],ply);kbox(supply,[shelfL,40,10],[0,-5,305],steel);
    for(const s of [-1,-.5,.5,1]){const x=s*(shelfL/2-40);kbox(supply,[20,160,200],[x,-92,140],steel);kbox(supply,[20,24,140],[x,-180,70],steel);}
    kbox(supply,[shelfL-200,22,44],[0,-24,262],silver);mesh(supply,new THREE.BoxGeometry(shelfL-220,5,32),taskGlow,[0,-37,262]).castShadow=false;
    {
        const pattern=['bin','bin','bin','bin','gap','can','can','can','gap','jar','jar','jar','gap','box','gap','spray','spray','spray','gap','bin','bin','bin','gap','box','gap'],size={bin:160,can:125,jar:92,box:330,spray:62,gap:70};
        let x=-shelfL/2+70,k=0;
        while(true){
            const kind=pattern[k%pattern.length],wd=size[kind];if(x+wd>shelfL/2-70)break;const cx=x+wd/2,y=12.5;
            if(kind==='bin'){kbox(supply,[150,112,210],[cx,y+56,128],k%2?orange:teal);kbox(supply,[150,40,24],[cx,y+20,240],k%2?orange:teal);kbox(supply,[80,30,2],[cx,y+75,234],paper);}
            if(kind==='can'){kcyl(supply,[56,56,128],[cx,y+64,150],silver);kcyl(supply,[57,57,74],[cx,y+60,150],[orange,teal,red,paper][k%4]);kcyl(supply,[50,50,6],[cx,y+131,150],steel);}
            if(kind==='jar'){kcyl(supply,[40,40,118],[cx,y+59,150],glass);kcyl(supply,[42,42,20],[cx,y+128,150],[red,teal,yellow][k%3]);kcyl(supply,[36,36,50],[cx,y+28,150],silver);}
            if(kind==='box'){kbox(supply,[300,150,240],[cx,y+75,140],cardboard);kbox(supply,[302,4,44],[cx,y+152,140],paper);kbox(supply,[110,60,2],[cx-60,y+80,261],paper);}
            if(kind==='spray'){kcyl(supply,[27,27,170],[cx,y+85,170],[red,teal,yellow][k%3]);kcyl(supply,[22,24,32],[cx,y+186,170],rubber);}
            x+=wd;k++;
        }
    }

    // Offcut crate and shop vacuum at the end of the bench run.
    const offcuts=group('offcut-bin','Plywood offcut crate',[w/2-230,0,bz+960]);
    kbox(offcuts,[380,30,380],[0,15,0],ply);for(const s of [-1,1]){kbox(offcuts,[18,520,380],[s*181,260,0],ply);kbox(offcuts,[344,520,18],[0,260,s*181],ply);}
    kbox(offcuts,[200,60,4],[0,380,192],paper);
    for(let i=0;i<8;i++){const len=600+hash(i+20)*520,tx=(hash(i+30)-.5)*.16,tz=(hash(i+40)-.5)*.16,sx=-120+(i%3)*110,sz=-110+Math.floor(i/3)*100;kbox(offcuts,[40+hash(i)*60,len,30+hash(i+9)*50],[sx+Math.sin(tz)*len/2,30+len/2*Math.cos(tx),sz-Math.sin(tx)*len/2],[pine,oak,ply,walnut][i%4],[tx,0,tz]);}
    const vac=group('shop-vac','Wet-dry shop vacuum',[w/2-650,0,bz+950]);
    for(let i=0;i<4;i++){const t=i*Math.PI/2+Math.PI/4;kball(vac,[28,28,28],[Math.cos(t)*120,28,Math.sin(t)*120],rubber);}
    kcyl(vac,[150,165,40],[0,70,0],rubber);kcyl(vac,[165,150,330,20],[0,255,0],yellow);kcyl(vac,[170,170,90,20],[0,465,0],rubber);kball(vac,[110,50,110],[0,510,0],rubber);
    krod(vac,[-70,555,0],[70,555,0],14,rubber);for(const s of [-1,1])krod(vac,[s*70,510,0],[s*70,555,0],10,rubber);
    ktorus(vac,[120,22],[0,300,0],rubber,[Math.PI/2,0,0]);kcyl(vac,[30,30,80],[0,330,170],rubber,[Math.PI/2,0,0]);

    if(tier){
        // Air compressor parked lengthwise between the industrial toolbox and the
        // rolling cart's Groove/daily positions, with its hose reel on the wall.
        const air=group('air-compressor','Air compressor and hose reel',[w/2-400,0,front-2020]);
        for(const s of [-1,1])kcyl(air,[70,70,40,16],[-230,70,s*150],rubber,[Math.PI/2,0,0]);kbox(air,[60,60,300],[250,30,0],rubber);
        kcyl(air,[170,170,600,24],[0,250,0],red,[0,0,Math.PI/2]);for(const s of [-1,1])kball(air,[40,170,170],[s*300,250,0],red);
        kbox(air,[260,170,220],[-40,500,0],steel);kcyl(air,[60,60,180],[150,500,0],silver,[Math.PI/2,0,0]);
        for(const x of [-60,60])kcyl(air,[32,32,16],[x,470,118],paper,[Math.PI/2,0,0]);
        for(const z of [-120,120])krod(air,[-280,600,z],[-280,760,z],10,silver);krod(air,[-280,760,-120],[-280,760,120],10,silver);
        ktorus(air,[150,12],[320,1000,0],yellow,[0,Math.PI/2,0]);ktorus(air,[130,12],[316,990,0],yellow,[0,Math.PI/2,0]);kbox(air,[30,60,80],[375,1160,0],steel);
    }

    const printer=group('desktop-printer','Open-frame prototype printer',[w/2-240,900,bz+350]);
    box(printer,[320,60,300],[0,30,0],rubber,6);kbox(printer,[250,10,230],[0,73,0],silver);kbox(printer,[240,4,220],[0,80,0],rubber);kbox(printer,[70,46,50],[-20,105,10],orange);
    for(const x of [-140,140])kbox(printer,[22,380,22],[x,250,-120],steel);
    kbox(printer,[302,22,22],[0,440,-120],steel);krod(printer,[-140,230,-105],[140,230,-105],6,silver);
    kbox(printer,[50,60,55],[-20,230,-75],orange);kcyl(printer,[3,8,22],[-20,190,-60],silver);
    krod(printer,[0,451,-120],[0,500,-120],6,silver);mesh(printer,new THREE.CylinderGeometry(70,70,40,24),teal,[0,520,-100]).rotation.x=Math.PI/2;
    krod(printer,[-40,470,-90],[-20,262,-75],1.6,teal,5);
    mesh(printer,new THREE.BoxGeometry(80,42,4),screenGlow,[95,32,151]).castShadow=false;kcyl(printer,[10,10,8],[30,32,152],silver,[Math.PI/2,0,0]);

    if(tier>=2){
        const assembly=group('assembly-island','Assembly table and cutting station',[500,0,bz+4500]);
        box(assembly,[2000,70,1100],[0,865,0],block,5);
        for(const x of [-870,870])for(const z of [-420,420])box(assembly,[70,830,70],[x,415,z],steel,3);
        box(assembly,[1840,35,850],[0,220,0],ply,3);
        for(let i=0;i<4;i++)box(assembly,[470,90,360],[-650+i*430,282.5,0],teal,4);
        label(assembly,'02 / ASSEMBLY',[1200,110],[0,730,556]);
        // Cutting mat, a dovetailed box mid glue-up and a speed square.
        kbox(assembly,[460,3,380],[-720,901.5,-120],material('#3f6f5a',{roughness:.8}));kbox(assembly,[180,4,180],[-640,903,180],silver,[0,.4,0]);
        kbox(assembly,[380,18,260],[740,909,-60],walnut);for(const s of [-1,1]){kbox(assembly,[380,200,18],[740,1000,-60+s*121],walnut);kbox(assembly,[18,200,224],[740+s*181,1000,-60],walnut);}
        for(const s of [-1,1])kbox(assembly,[12,12,330],[740+s*110,1112,-60],silver),kbox(assembly,[30,40,30],[740+s*110,1112,-230],steel),kbox(assembly,[30,40,30],[740+s*110,1112,110],steel);
        const cart=group('clamp-cart','Rolling clamp and jig rack',[tier===4?2000:500,0,front-900]);
        for(const x of [-280,280])for(const z of [-180,180])sphere(cart,[45,45,20],[x,45,z],rubber);
        box(cart,[680,50,460],[0,100,0],steel,3);for(const x of [-280,280])box(cart,[40,1050,40],[x,650,0],steel);
        rod(cart,[-290,1100,0],[290,1100,0],20,steel);
        // A pair of sawhorses with a board marked out for cutting.
        const horses=group('sawhorses','Sawhorses with a marked-out board',[-w/2+(tier>=3?2400:1700),0,front-1850]);
        for(const sx of [-420,420]){
            kbox(horses,[90,70,720],[sx,705,0],pine);kbox(horses,[60,18,560],[sx,600,0],ply);
            for(const s of [-1,1])for(const sz of [-1,1]){krod(horses,[sx+s*30,690,sz*280],[sx+s*170,14,sz*310],17,pine,6);kbox(horses,[50,8,50],[sx+s*170,4,sz*310],rubber);}
        }
        kbox(horses,[1400,30,260],[0,755,-40],oak);kbox(horses,[1200,1,3],[0,770.6,10],rubber);kbox(horses,[180,3,180],[-300,771.5,-60],silver,[0,.6,0]);
        krod(horses,[250,775,60],[400,775,90],4,yellow);
        for(let i=0;i<6;i++){const x=-220+i*85;krod(cart,[x,180,40],[x,1000,40],9,silver);kbox(cart,[50,40,90],[x,880,65],orange);kbox(cart,[50,40,90],[x,240,65],orange);kcyl(cart,[13,11,100],[x,190,95],handle,[Math.PI/2,0,0]);}
    }
    if(tier>=3){
        const cnc=group('cnc-router','Enclosed CNC routing and prototype bay',[w/2-1000,0,bz+3950]);
        box(cnc,[1650,780,1350],[0,390,0],steel,5);box(cnc,[1750,80,1450],[0,820,0],silver,4);
        for(let i=0;i<10;i++)kbox(cnc,[1500,25,20],[0,875,-570+i*125],rubber);
        for(const x of [-740,740])box(cnc,[60,520,60],[x,1140,0],steel);
        box(cnc,[1540,80,100],[0,1360,0],orange,4);box(cnc,[120,200,130],[180,1260,55],steel,5);rod(cnc,[180,1160,55],[180,1030,55],15,silver);
        box(cnc,[550,25,350],[0,905,0],ply,3);
        for(const x of [-800,800])for(const z of [-630,630])krod(cnc,[x,860,z],[x,1540,z],12,silver);
        for(const z of [-630,630])krod(cnc,[-800,1540,z],[800,1540,z],12,silver);
        const glazing=material('#b5dce0',{transparent:true,opacity:.12,depthWrite:false,roughness:.2});
        box(cnc,[1580,650,6],[0,1210,636],glazing);
        label(cnc,'03 / PROTOTYPE',[1100,120],[0,570,681]);
        mesh(cnc,new THREE.BoxGeometry(220,130,6),screenGlow,[-560,1000,684]).castShadow=false;
        const storage=group('parts-storage','Hardware bins and labelled parts cabinet',[-w/2+330,0,bz+6300],Math.PI/2);
        box(storage,[1500,2100,40],[0,1050,-240],steel,3);
        for(const x of [-720,720])box(storage,[40,2100,500],[x,1050,0],steel);
        for(const y of [30,500,1000,1500,2050])box(storage,[1460,30,500],[0,y,0],ply);
        for(let row=0;row<4;row++)for(let col=0;col<6;col++){const x=-580+col*230,y=140+row*500;kbox(storage,[205,180,350],[x,y,0],row%2?orange:teal);kbox(storage,[110,35,4],[x,y+25,178],paper);}
    }
    if(tier===4){
        const laser=group('laser-bay','Laser cutting and finishing station',[300,0,front-1550]);
        box(laser,[1900,800,1100],[0,400,0],steel,6);box(laser,[2000,70,1200],[0,835,0],ply,5);
        box(laser,[1300,330,820],[0,1035,0],teal,6);box(laser,[1120,12,660],[0,1212,-10],rubber,8);
        for(let i=0;i<12;i++)kbox(laser,[1050,12,12],[0,1225,-285+i*50],silver);
        box(laser,[1250,80,35],[0,1120,430],orange,5);label(laser,'04 / FINISH & PRESENT',[1250,120],[0,610,558]);
        const samples=group('project-samples','Finished timber joinery and project display',[w/2-350,0,front-4000],-Math.PI/2);
        for(const x of [-700,700])box(samples,[60,1800,60],[x,900,-220],steel);
        for(const y of [100,650,1250,1770])box(samples,[1500,35,500],[0,y,0],ply);
        for(let i=0;i<5;i++){box(samples,[180,260,180],[-560+i*280,1427.5,0],[ply,walnut,oak][i%3],4);kbox(samples,[190,10,190],[-560+i*280,1562.5,0],orange);}
    }
    // Twin-tube shop fluorescents on chains with enamel reflectors.
    const ceiling=new THREE.Group();ceiling.name='Workshop linear task-light grid';root.add(ceiling);room.ceilingFixture=ceiling;
    for(const x of [-w*.25,w*.25])for(const z of [bz+d*.28,bz+d*.72]){
        for(const o of [-450,450])krod(ceiling,[x,h,z+o],[x,h-185,z+o],3,steel,5);krod(ceiling,[x,h,z],[x,h-185,z],4,rubber,6);
        kbox(ceiling,[250,26,1260],[x,h-198,z],enamel);for(const s of [-1,1])kbox(ceiling,[8,64,1260],[x+s*136,h-232,z],enamel,[0,0,s*.45]);for(const s of [-1,1])kbox(ceiling,[230,46,10],[x,h-222,z+s*628],enamel);
        for(const s of [-1,1])kcyl(ceiling,[14,14,1210,10],[x+s*55,h-238,z],tubeGlow,[Math.PI/2,0,0]);
        krod(ceiling,[x+90,h-211,z+300],[x+90,h-560,z+300],1.2,silver,4);kball(ceiling,[6,9,6],[x+90,h-566,z+300],silver);
    }
    // Festoon bulbs zig-zag between the shop lights for evenings and the open workshop.
    {
        const z1=bz+d*.28+628,z2=bz+d*.72-628,y=h-246,hooks=[[-w*.25,z1],[w*.25,z1],[-w*.25,z2],[w*.25,z2]];
        for(let s=0;s<3;s++){
            const a=new THREE.Vector3(hooks[s][0],y,hooks[s][1]),b=new THREE.Vector3(hooks[s+1][0],y,hooks[s+1][1]),len=a.distanceTo(b),mid=a.clone().add(b).multiplyScalar(.5);mid.y-=Math.min(560,len*.24);
            const curve=new THREE.QuadraticBezierCurve3(a,mid,b);part(ceiling,rubber,new THREE.TubeGeometry(curve,32,3,5));
            const bulbs=Math.max(4,Math.round(len/320));
            for(let j=0;j<bulbs;j++){const p=curve.getPoint((j+.5)/bulbs);kcyl(ceiling,[10,10,30,8],[p.x,p.y-15,p.z],rubber);kball(ceiling,[24,31,24],[p.x,p.y-52,p.z],bulbGlow);}
        }
    }
    {
        // Each wall's bunting hangs at its cord height and hides with that wall.
        const run=(wall,name,y)=>{const g=new THREE.Group();g.name=name;g.position.y=y;g.visible=false;wall.add(g);bunting.push(g);return g;};
        const side=run(right,'Open workshop bunting along the lumber wall',h-40),shelf=run(back,'Open workshop bunting along the supply shelf',2110);
        const runs=Math.max(2,Math.round((d-600)/2200)),step=(d-600)/runs;
        for(let r=0;r<runs;r++)pennants(side,[w/2-68,0,bz+300+r*step],[w/2-68,0,bz+300+(r+1)*step],40,-Math.PI/2);
        const spans=Math.max(2,Math.round((w-400)/1800)),span=(w-400)/spans;
        for(let r=0;r<spans;r++)pennants(shelf,[-w/2+200+r*span,0,bz+312],[-w/2+200+(r+1)*span,0,bz+312],25,0);
    }
    const lights=[
        {at:[0,1880,bz+520],power:4.4,level:'practical'},
        {at:[layout.desk[0],h-450,layout.desk[1]],power:4.2,level:'practical'},
        {at:[tier>=2?500:0,h-450,bz+d*.7],power:4,level:'tubes',tube:true},
        {at:[w/2-700,1850,bz+d*.4],power:3.1,level:'wash',channel:1}
    ].map(spec=>{const light=new THREE.PointLight('#e4f3f5',0,4800*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    const paintSky=(mode,id)=>{
        const c=skyCanvas.getContext('2d'),grad=c.createLinearGradient(0,0,0,512),night=id==='night';grad.addColorStop(0,mode.sky[0]);grad.addColorStop(1,mode.sky[1]);c.fillStyle=grad;c.fillRect(0,0,512,512);
        if(night){c.fillStyle='#f3f0dc';for(let i=0;i<70;i++){c.globalAlpha=.25+hash(i)*.6;c.fillRect(hash(i+3)*512,hash(i+9)*300,2,2);}c.globalAlpha=1;c.beginPath();c.arc(370,105,24,0,Math.PI*2);c.fill();}
        else{const [sx,sy]={morning:[110,340],afternoon:[310,90],evening:[410,385],party:[390,350]}[id]||[300,100],sun=c.createRadialGradient(sx,sy,0,sx,sy,170);sun.addColorStop(0,'#fff6dccc');sun.addColorStop(.25,'#ffe7b866');sun.addColorStop(1,'#ffe7b800');c.fillStyle=sun;c.fillRect(0,0,512,512);}
        const far=night?'#1b2a3c':id==='evening'||id==='party'?'#5a4a58':'#7f978d',near=night?'#111b27':id==='evening'||id==='party'?'#3c3440':'#5f7569';
        c.fillStyle=far;for(let i=0;i<14;i++){c.beginPath();c.arc(i*40+hash(i)*20,400-hash(i+5)*40,34+hash(i+2)*26,0,Math.PI*2);c.fill();}c.fillRect(0,400,512,112);
        c.fillStyle=near;c.fillRect(250,330,190,182);c.beginPath();c.moveTo(236,334);c.lineTo(345,270);c.lineTo(454,334);c.fill();
        c.fillStyle=night||id==='evening'?'#f2c46e':'#a7b9bd';c.fillRect(290,370,46,40);c.fillRect(370,370,46,40);
        c.fillStyle=near;for(let x=0;x<512;x+=26)c.fillRect(x,446,18,66);c.fillRect(0,462,512,8);
        skyMap.needsUpdate=true;
    };
    room.roomAtmosphere=(id,accent=1)=>{
        const mode=WORKSHOP_MODES[id]||WORKSHOP_MODES.morning;paintSky(mode,id);
        glow.forEach(({mat,kind})=>{
            if(kind==='sign'){mat.emissiveIntensity=mode.sign*1.7*accent;return;}
            if(kind==='screen'){mat.emissiveIntensity=(.45+.5*mode.wash)*accent;return;}
            if(kind==='string'){mat.emissive.set('#ff9c45');mat.emissiveIntensity=(.02+mode.string*1.25)*accent;return;}
            const color=kind==='tube'?mode.tube:mode.colors[0];mat.color.set(color);mat.emissive.set(color);
            mat.emissiveIntensity=(kind==='tube'?.06+mode.tubes*1.5:.12+mode.practical*1.1)*accent;
        });
        lights.forEach(spec=>{spec.light.color.set(spec.tube?mode.tube:mode.colors[spec.channel||0]);spec.light.intensity=spec.power*mode[spec.level]*accent;});
        bunting.forEach(g=>g.visible=id==='party');root.userData.atmosphere=id;
    };
    flushKits();
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[plaster, 'plaster'], [paintLow, 'plaster'], [steel, 'metal'], [silver, 'metal'], [orange, 'powder'], [teal, 'powder'], [red, 'powder'], [yellow, 'powder'], [enamel, 'powder'], [rubber, 'rubber'], [ply, 'wood'], [block, 'wood'], [pine, 'wood'], [oak, 'wood'], [walnut, 'wood'], [handle, 'wood'], [slab, 'stone']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
