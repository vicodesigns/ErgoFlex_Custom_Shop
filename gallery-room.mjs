import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tiers = [
    ['apartment', 'Apartment art collection', 4000, 4600, 2800],
    ['house', 'Home collector gallery', 4800, 5800, 3000],
    ['spacious', 'Art gallery & curator studio', 6200, 7200, 3200],
    ['premium', 'Private collection & exhibition salon', 8000, 9200, 3500],
    ['executive', 'Grand gallery & sculpture hall', 10000, 11800, 4000]
];
export const GALLERY_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1800, front = back + depth;
    const desk = [width / 2 - 900, back + 950];
    const thinker = [-width / 2 + 850, back + 1900];
    const vase = [-width / 2 + 700, front - 720];
    // The marble loop takes the free front corner in the apartment; larger
    // rooms give that corner to the salon chair, so it joins the sculpture walk.
    const sculpture = tier ? [-width / 2 + 850, (thinker[1] + vase[1]) / 2 + 300] : [width / 2 - 650, front - 650];
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 970], turn: 180 },
        { id: 'the-thinker', at: [thinker[0], 850, thinker[1]], turn: 25 },
        { id: 'antique-vase', at: [vase[0], 1000, vase[1]] }
    ];
    if (tier) props.push(
        { id: 'aphrodite', at: [-width / 2 + 560, 120, back + 550], turn: 20 },
        { id: 'kenney-furniture-potted-plant', at: [width / 2 - 350, 0, back + 2450] }
    );
    if (tier && tier < 3) props.push(
        { id: 'armchair-poppi', at: [width / 2 - 700, 0, front - 800], turn: -30 },
        { id: 'coffee-table-2', at: [width / 2 - 1600, 0, front - 650] },
        { id: 'journal', at: [width / 2 - 1620, 700, front - 650] }
    );
    if (tier >= 2) props.push({ id: 'mercury-statue', at: [width / 2 - 650, 120, back + 3800], turn: -25 });
    if (tier >= 3) props.push(
        { id: 'sofa-fabric', at: [width / 2 - 700, 0, front - 2100], turn: -90 },
        { id: 'coffee-table', at: [width / 2 - 1800, 0, front - 2100], turn: 90 },
        { id: 'journal', at: [width / 2 - 1800, 391.2, front - 2240], turn: 80 },
        { id: 'gold-award', at: [-1100, 850, front - 2300], turn: 15 }
    );
    return [id, { id, name, width, depth, height, back, tier, desk, thinker, vase, sculpture, props,
        daylight: [width / 2 - 100, back + 1600] }];
}));
export const galleryLayoutById = id => GALLERY_LAYOUTS[id] || GALLERY_LAYOUTS.apartment;
export const galleryLayoutForSize = size => GALLERY_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const GALLERY_MODES = {
    morning: { label: 'Morning', description: 'Clear daylight · standing curation and planning', key: '#fff2dd', fill: '#e4edf5', accent: '#fff1d6', power: 1.5, ambient: .5, bounce: .7, exposure: 1.04, sky: ['#accada', '#f2e7d1'], practical: .3, wash: .35, colors: ['#ffe4bd', '#e4f0f5'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft museum daylight · seated cataloguing', key: '#fff7eb', fill: '#e8eff4', accent: '#eedcc5', power: 1.15, ambient: .48, bounce: .65, exposure: 1.07, sky: ['#b5cedd', '#eee9db'], practical: .45, wash: .5, colors: ['#ffe7c4', '#dceaf2'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm art lighting · desk angled for sketching', key: '#f6d9bb', fill: '#cfdae7', accent: '#f8c98f', power: .6, ambient: .32, bounce: .42, exposure: 1.12, sky: ['#8e94ae', '#d9b79b'], practical: .85, wash: .8, colors: ['#ffd29b', '#c3dae8'], height: 28, tilt: 39, offset: [0, 80], yaw: 0, leds: true, color: '#ffdda7' },
    night: { label: 'Night', description: 'After-hours collection · sculptures and artwork in focus', key: '#c9d7e7', fill: '#bdcde1', accent: '#e4ba8a', power: .12, ambient: .13, bounce: .16, exposure: 1.2, sky: ['#172a41', '#344d64'], practical: .6, wash: .9, colors: ['#f5cca0', '#a3c8e0'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: false },
    party: { label: 'Opening night', description: 'Exhibition reception · warm displays and standing desk', key: '#f3dcc6', fill: '#d4deed', accent: '#ffc888', power: .45, ambient: .3, bounce: .4, exposure: 1.14, sky: ['#3d5074', '#9b7d83'], practical: 1, wash: .95, colors: ['#ffd49e', '#adcfe6'], height: 43.5, tilt: 0, offset: [-70, 140], yaw: 8, leds: true, color: '#ffe0b0' }
};
// Window sun patch per daypart: depth into the room, sideways skew, tint and strength.
const SUN = {
    morning: { near: 380, length: 1900, skew: -620, color: '#fff0d6', gain: .3 },
    afternoon: { near: 300, length: 1250, skew: 420, color: '#ffe3bb', gain: .2 },
    evening: { near: 420, length: 2600, skew: 1050, color: '#ffae72', gain: .16 },
    night: { near: 300, length: 1300, skew: 120, color: '#86a6dc', gain: .07 },
    party: { near: 300, length: 1300, skew: 0, color: '#000000', gain: 0 }
};
const ART = [
    { title: 'Tidal forms', artist: 'Mara Lindqvist', line: 'Oil on linen, 2024' },
    { title: 'Orbit study', artist: 'Jude Okafor', line: 'Acrylic on canvas, 2021' },
    { title: 'Colour field', artist: 'Lena Brandt', line: 'Gouache on board, 2023' },
    { title: 'Quiet horizon', artist: 'Ines Moreau', line: 'Oil on canvas, 2019' },
    { title: 'Night garden', artist: 'Teo Halvorsen', line: 'Pigment print, 2022' }
];
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}
// Linen weave, dry-brush drag and pigment speckle shared by every painting.
function canvasGrain(c, tw, th, seed) {
    c.save(); c.globalAlpha = .07;
    for (let y = 0; y < th; y += 3) { c.fillStyle = y % 6 ? '#ffffff' : '#000000'; c.fillRect(0, y, tw, 1); }
    for (let x = 0; x < tw; x += 3) { c.fillStyle = x % 6 ? '#000000' : '#ffffff'; c.fillRect(x, 0, 1, th); }
    c.globalAlpha = .1; c.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
        const x = hash(seed + i) * tw, y = hash(seed + i * 2.3) * th, l = 20 + hash(seed + i * 5.1) * 90, a = (hash(seed + i * 7.7) - .5) * .7;
        c.strokeStyle = i % 2 ? '#ffffff' : '#2a2520'; c.lineWidth = 2 + hash(seed + i * 3.3) * 5;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 2600; i++) { c.fillStyle = i % 3 ? '#00000012' : '#ffffff22'; c.fillRect(hash(seed * 3 + i) * tw, hash(seed * 5 + i * 1.7) * th, 2, 2); }
    c.restore();
}
function drawPainting(style, c, tw, th) {
    c.fillStyle = ['#eadfc7', '#233a43', '#f2e8d8', '#b9a48a', '#1c2b29'][style]; c.fillRect(0, 0, tw, th);
    if (style === 0) {
        const sky = c.createLinearGradient(0, 0, 0, th * .7); sky.addColorStop(0, '#f1e3c6'); sky.addColorStop(1, '#e2cfae'); c.fillStyle = sky; c.fillRect(0, 0, tw, th);
        const sun = c.createRadialGradient(tw * .68, th * .33, th * .05, tw * .68, th * .33, th * .23); sun.addColorStop(0, '#d5764f'); sun.addColorStop(.85, '#c46a48'); sun.addColorStop(1, '#c46a4800');
        c.fillStyle = sun; c.beginPath(); c.arc(tw * .68, th * .33, th * .23, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 5; i++) {
            c.fillStyle = ['#c9c4ad', '#aeb6a1', '#7f998b', '#4d7470', '#2c4f4f'][i]; c.beginPath(); c.moveTo(0, th);
            c.lineTo(0, th * (.5 + i * .09)); c.bezierCurveTo(tw * .22, th * (.32 + i * .13), tw * .6, th * (.86 - i * .1), tw, th * (.46 + i * .11)); c.lineTo(tw, th); c.fill();
            c.strokeStyle = '#ffffff30'; c.lineWidth = 3; c.stroke();
        }
    }
    if (style === 1) {
        const g = c.createRadialGradient(tw * .5, th * .5, 10, tw * .5, th * .5, tw * .6); g.addColorStop(0, '#2f4d55'); g.addColorStop(1, '#16262c'); c.fillStyle = g; c.fillRect(0, 0, tw, th);
        c.lineCap = 'round';
        for (let i = 0; i < 7; i++) { c.strokeStyle = ['#d6b37a', '#f0dabc', '#75aaad', '#c98a63'][i % 4]; c.lineWidth = 22 - i * 2.2; c.globalAlpha = .9 - i * .06; c.beginPath(); c.arc(tw * .46, th * .52, th * (.1 + i * .075), i * .7, Math.PI * 1.45 + i * .35); c.stroke(); }
        c.globalAlpha = 1; c.fillStyle = '#dc9971'; c.fillRect(tw * .76, th * .12, tw * .035, th * .76);
        c.fillStyle = '#f0dabc'; c.beginPath(); c.arc(tw * .7, th * .24, 16, 0, Math.PI * 2); c.fill();
    }
    if (style === 2) {
        for (let i = 0; i < 9; i++) {
            c.fillStyle = ['#ba694e', '#d6b684', '#769d91', '#3f6468', '#e4cfa7'][i % 5]; c.save(); c.translate(tw * (.1 + i * .1), th * (.3 + (i % 3) * .17)); c.rotate((i - 4) * .16);
            c.globalAlpha = .92; c.fillRect(-tw * .055, -th * .2, tw * .11, th * .4); c.restore();
        }
        c.globalAlpha = 1; c.strokeStyle = '#2d3b3d'; c.lineWidth = 4; c.beginPath(); c.moveTo(tw * .06, th * .86); c.lineTo(tw * .94, th * .86); c.stroke();
    }
    if (style === 3) {
        // Two soft-edged colour fields, the gallery's quiet anchor piece.
        const field = (y, hgt, col) => { c.save(); c.filter = 'blur(10px)'; c.fillStyle = col; c.fillRect(tw * .08, y, tw * .84, hgt); c.restore(); };
        field(th * .08, th * .5, '#8a3c2c'); field(th * .64, th * .27, '#d3a35c'); field(th * .6, th * .025, '#3a2420');
    }
    if (style === 4) {
        c.lineCap = 'round';
        for (let i = 0; i < 26; i++) {
            const x = tw * (.08 + hash(i) * .84), y = th * (.95 - hash(i + 4) * .1), top = th * (.15 + hash(i + 9) * .45);
            c.strokeStyle = ['#5d8a63', '#9fbf8a', '#3f6c57'][i % 3]; c.lineWidth = 3 + hash(i + 2) * 4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (hash(i + 5) - .5) * 160, (y + top) / 2, x + (hash(i + 7) - .5) * 80, top); c.stroke();
            c.fillStyle = ['#e7b8a6', '#f2dca7', '#c86f68', '#efe8dc'][i % 4]; c.beginPath(); c.arc(x + (hash(i + 7) - .5) * 80, top, 10 + hash(i + 3) * 22, 0, Math.PI * 2); c.fill();
        }
    }
    canvasGrain(c, tw, th, style * 101 + 7);
}
// Nine small works on paper share one atlas so the salon hang is a few draw calls.
function drawPaper(k, c, s) {
    c.fillStyle = ['#f1ebde', '#ece5d6', '#f3efe6', '#d6d6d2', '#efe7d4', '#f2efe8', '#e9e3d6', '#26476a', '#efe9dc'][k]; c.fillRect(0, 0, s, s);
    c.lineCap = 'round';
    if (k === 0) { c.strokeStyle = '#2b2b2b'; for (let i = 0; i < 12; i++) { c.lineWidth = 1.5 + hash(i) * 2; c.beginPath(); c.moveTo(s * (.42 + hash(i + 1) * .1), s * .12); c.bezierCurveTo(s * (.15 + hash(i) * .3), s * .45, s * (.55 + hash(i + 3) * .3), s * .62, s * (.38 + hash(i + 9) * .2), s * .9); c.stroke(); } c.beginPath(); c.arc(s * .47, s * .16, s * .07, 0, Math.PI * 2); c.stroke(); }
    if (k === 1) { for (let r = 0; r < 4; r++) { c.strokeStyle = '#4a4033'; c.lineWidth = 1.2; for (let x = 0; x < s; x += 4) { const y = s * (.42 + r * .13) + Math.sin(x / s * 6 + r) * s * .05; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, s * (.95)); c.globalAlpha = .25 + r * .12; c.stroke(); } } c.globalAlpha = 1; }
    if (k === 2) { for (let i = 0; i < 5; i++) { c.fillStyle = ['#c6603f', '#e2b45a', '#3e6e78', '#202a2c', '#9fb7a3'][i]; c.beginPath(); c.arc(s * (.25 + hash(i) * .5), s * (.25 + hash(i + 3) * .5), s * (.08 + hash(i + 5) * .14), 0, Math.PI * 2); c.fill(); } }
    if (k === 3) { const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#f2f2f0'); g.addColorStop(.62, '#a9aaa6'); g.addColorStop(.63, '#4b4c49'); g.addColorStop(1, '#1d1e1c'); c.fillStyle = g; c.fillRect(s * .08, s * .08, s * .84, s * .84); c.fillStyle = '#272826'; c.fillRect(s * .58, s * .38, s * .12, s * .25); }
    if (k === 4) { c.strokeStyle = '#47603f'; c.lineWidth = 3; c.beginPath(); c.moveTo(s * .5, s * .92); c.bezierCurveTo(s * .45, s * .6, s * .58, s * .4, s * .5, s * .1); c.stroke(); for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#6f8f5a' : '#58784b'; c.save(); c.translate(s * .5, s * (.2 + i * .1)); c.rotate(i % 2 ? .8 : -.8); c.beginPath(); c.ellipse(s * .1, 0, s * .1, s * .035, 0, 0, Math.PI * 2); c.fill(); c.restore(); } }
    if (k === 5) { c.strokeStyle = '#b9b2a6'; c.lineWidth = 1; for (let i = 1; i < 16; i++) { c.beginPath(); c.moveTo(s * .1, s * .1 + i * s * .05); c.lineTo(s * .9, s * .1 + i * s * .05); c.stroke(); c.beginPath(); c.moveTo(s * .1 + i * s * .05, s * .1); c.lineTo(s * .1 + i * s * .05, s * .9); c.stroke(); } }
    if (k === 6) { const g = c.createRadialGradient(s * .5, s * .42, s * .05, s * .5, s * .45, s * .42); g.addColorStop(0, '#4a4542'); g.addColorStop(.6, '#7b736c'); g.addColorStop(1, '#e9e3d600'); c.fillStyle = g; c.beginPath(); c.ellipse(s * .5, s * .45, s * .24, s * .32, 0, 0, Math.PI * 2); c.fill(); c.fillRect(s * .3, s * .72, s * .4, s * .2); }
    if (k === 7) { c.strokeStyle = '#e8f0f5'; for (let i = 0; i < 9; i++) { c.lineWidth = 2; c.beginPath(); c.moveTo(s * .5, s * .9); c.quadraticCurveTo(s * (.2 + i * .07), s * .5, s * (.12 + i * .095), s * (.12 + hash(i) * .2)); c.stroke(); c.fillStyle = '#dce8f0'; c.beginPath(); c.ellipse(s * (.12 + i * .095), s * (.12 + hash(i) * .2), 12, 6, i, 0, Math.PI * 2); c.fill(); } }
    if (k === 8) { c.fillStyle = '#c84f37'; c.fillRect(s * .14, s * .14, s * .42, s * .5); c.fillStyle = '#273e46'; c.fillRect(s * .46, s * .44, s * .4, s * .42); c.fillStyle = '#e1b65a'; c.fillRect(s * .2, s * .7, s * .2, s * .14); }
    for (let i = 0; i < 500; i++) { c.fillStyle = i % 2 ? '#0000000c' : '#ffffff18'; c.fillRect(hash(k * 37 + i) * s, hash(k * 91 + i * 1.3) * s, 2, 2); }
}

export function buildGalleryRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier } = layout, front = bz + d;
    const ivory = material('#ece7de', { roughness: .95 }), black = material('#252b2e', { roughness: .5 });
    const brass = material('#b39a70', { metalness: .65, roughness: .35 });
    const satin = material('#f1eee8', { roughness: .7 }), feature = material('#7a8882', { roughness: .92 });
    const alu = material('#b9bcbd', { metalness: .75, roughness: .32 }), steel = material('#2c2f31', { metalness: .55, roughness: .42 });
    const oakMap = texture((c,tw,th) => { c.fillStyle='#a58b68'; c.fillRect(0,0,tw,th); c.strokeStyle='#71563735'; for(let i=0;i<110;i++){const x=i*tw/110;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+8,th*.3,x-5,th*.7,x,th);c.stroke();} });
    const oak = material('#ffffff', { map: oakMap, roughness: .8 });
    const stoneMap = texture((c,tw,th) => { c.fillStyle='#d5cdbf'; c.fillRect(0,0,tw,th); for(let i=0;i<1500;i++){const x=(i*137.53)%tw,y=(i*47.73)%th;c.fillStyle=i%2?'#b7aa9520':'#fff9ed45';c.fillRect(x,y,1+i%3,1+i%2);} c.strokeStyle='#a99e8e30';c.lineWidth=1;c.strokeRect(1,1,tw-2,th-2); });
    const stone=material('#ffffff',{map:stoneMap,roughness:.78});
    // Honed limestone: 900 mm slabs, each with its own tone, cloudy fossils and a fine joint.
    const floorMap=texture((c,tw,th)=>{const s=tw/2;for(let k=0;k<4;k++){const x0=(k%2)*s,y0=(k>>1)*s;c.fillStyle=['#ddd6ca','#d7cfc2','#e1dbd0','#d4ccbf'][k];c.fillRect(x0,y0,s,s);c.save();c.beginPath();c.rect(x0,y0,s,s);c.clip();
        for(let i=0;i<34;i++){const x=x0+hash(k*97+i)*s,y=y0+hash(k*53+i*3.1)*s,r=30+hash(k*31+i*7.3)*120,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%4?'#faf6ef18':'#bcae9811');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
        for(let i=0;i<1600;i++){c.fillStyle=i%3?'#8f816c20':'#ffffff3a';c.fillRect(x0+hash(k*1999+i)*s,y0+hash(k*733+i*1.7)*s,1+i%2,1+i%2);}
        c.restore();c.strokeStyle='#9f927e';c.lineWidth=1.5;c.strokeRect(x0+.75,y0+.75,s-1.5,s-1.5);}},1024,1024);
    floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(w/1800,d/1800);
    box(root,[w,30,d],[0,-15,bz+d/2],material('#ffffff',{map:floorMap,roughness:.46}));
    const marbleMap=texture((c,tw,th)=>{c.fillStyle='#efece6';c.fillRect(0,0,tw,th);for(let i=0;i<16;i++){c.strokeStyle=i%4?'#9d978f2c':'#7d766d50';c.lineWidth=.6+hash(i)*2.4;c.beginPath();let x=hash(i*7)*tw,y=0;c.moveTo(x,y);while(y<th){x+=(hash(i*13+y)-.5)*70;y+=18+hash(i+y)*30;c.lineTo(x,y);}c.stroke();}});
    const marble=material('#ffffff',{map:marbleMap,roughness:.28});
    const unit=new THREE.PlaneGeometry(1,1);
    // Static trim and repeated small parts are merged per material.
    const merge=(parent,mat,geos,at=[0,0,0])=>{const o=mesh(parent,mergeGeometries(geos),mat,at);geos.forEach(g=>g.dispose());return o;};
    const part=(size,at,geo)=>(geo||new THREE.BoxGeometry(...size)).translate(...at);
    const seg=(from,to,r,sides=8)=>{const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),dl=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,dl.length(),sides);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dl.normalize()));return g.translate(...a.add(b).multiplyScalar(.5).toArray());};
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`gallery:${layout.id}:fixture:${id}`});return g;};
    const glowMats=[0,1].map(()=>material('#ffe4bd',{emissive:'#ffe4bd',emissiveIntensity:.35}));
    const strip=(parent,size,at,channel=0)=>{const o=box(parent,size,at,glowMats[channel],1);o.castShadow=false;return o;};
    // Track spots read as additive scallops on the walls and soft pools on the floor.
    const scallopMap=texture((c,tw,th)=>{c.save();c.translate(tw/2,th*.3);c.scale(1,2.3);const g=c.createRadialGradient(0,0,0,0,0,tw*.5);g.addColorStop(0,'#ffffff');g.addColorStop(.3,'#ffffffa8');g.addColorStop(.65,'#ffffff30');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(-tw/2,-th,tw,th*2);c.restore();
        c.globalCompositeOperation='destination-out';c.filter='blur(7px)';c.fillStyle='#000';c.beginPath();c.moveTo(-20,-20);c.lineTo(tw+20,-20);c.lineTo(tw+20,th*.34);c.quadraticCurveTo(tw/2,th*-.06,-20,th*.34);c.closePath();c.fill();
        c.filter='none';const f=c.createLinearGradient(0,th*.55,0,th);f.addColorStop(0,'#00000000');f.addColorStop(1,'#000000');c.fillStyle=f;c.fillRect(0,th*.55,tw,th*.45);},256,512);
    const poolMap=texture((c,tw,th)=>{const g=c.createRadialGradient(tw/2,th/2,0,tw/2,th/2,tw/2);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#ffffff70');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,tw,th);},128,128);
    const additive=(map,extra={})=>new THREE.MeshBasicMaterial({map,color:'#000000',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,...extra});
    const washMats=[additive(scallopMap),additive(scallopMap)],poolMat=additive(poolMap);
    const flat=o=>{o.castShadow=o.receiveShadow=false;o.renderOrder=2;return o;};
    const scallop=(side,along,width,channel=0)=>{const parent={back,left,right}[side],y=h*.53,off=9;
        const at=side==='back'?[along,y,bz+off]:side==='left'?[-w/2+off,y,along]:[w/2-off,y,along];
        const o=flat(mesh(parent,unit,washMats[channel],at));o.rotation.y=side==='back'?0:side==='left'?Math.PI/2:-Math.PI/2;o.scale.set(width,h*.84,1);return o;};
    const pools=new THREE.Group();pools.name='Gallery lighting track floor pools';root.add(pools);
    const pool=(x,z,size)=>{const o=flat(mesh(pools,unit,poolMat,[x,2,z]));o.rotation.x=-Math.PI/2;o.scale.set(size,size,1);return o;};

    const back=new THREE.Group();back.name='Gallery main exhibition wall';root.add(back);
    box(back,[w,h,80],[0,h/2,bz-40],ivory);
    room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    const left=new THREE.Group();left.name='Gallery sculpture and print wall';root.add(left);
    box(left,[80,h,d],[-w/2-40,h/2,bz+d/2],ivory);
    room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
    const right=new THREE.Group();right.name='Gallery daylight and salon wall';root.add(right);
    const wz=bz+1600,ww=tier?2000:1600,low=850,wh=1600,a=wz-ww/2,b=wz+ww/2;
    box(right,[80,h,a-bz],[w/2+40,h/2,(a+bz)/2],ivory);box(right,[80,h,front-b],[w/2+40,h/2,(front+b)/2],ivory);
    box(right,[80,low,ww],[w/2+40,low/2,wz],ivory);box(right,[80,h-low-wh,ww],[w/2+40,(h+low+wh)/2,wz],ivory);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(right,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[w/2+52,low+wh/2,wz]);pane.rotation.y=-Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(right,[65,wh+60,25],[w/2-10,low+wh/2,z],black);for(const y of [low,low+wh])box(right,[65,25,ww+60],[w/2-10,y,wz],black);
    box(right,[140,35,ww+70],[w/2-45,low-17.5,wz],marble);
    room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    // Shadow-gap skirtings and a hanging rail at the cornice on every wall.
    merge(back,black,[part([w,14,8],[0,7,bz+4])]);merge(back,alu,[part([w,16,14],[0,h-46,bz+7])]);
    merge(left,black,[part([8,14,d],[-w/2+4,7,bz+d/2])]);merge(left,alu,[part([14,16,d],[-w/2+7,h-46,bz+d/2])]);
    merge(right,black,[part([8,14,a-bz],[w/2-4,7,(a+bz)/2]),part([8,14,front-b],[w/2-4,7,(front+b)/2]),part([8,14,ww],[w/2-4,7,wz])]);
    merge(right,alu,[part([14,16,d],[w/2-7,h-46,bz+d/2]),part([70,80,ww+80],[w/2-35,low+wh+70,wz])]);
    // UV-filtering roller blind, a third drawn, glowing softly with daylight.
    const blindMat=material('#f2ede3',{roughness:.95,transparent:true,opacity:.86,emissive:'#fff4e2',emissiveIntensity:.12});
    box(right,[8,wh*.3,ww-30],[w/2-60,low+wh-wh*.15+10,wz],blindMat).castShadow=false;box(right,[16,22,ww-20],[w/2-60,low+wh*.7+12,wz],alu);
    // Low daylight on the floor, reshaped for each daypart in roomAtmosphere.
    const sunMap=texture((c,tw,th)=>{c.filter='blur(5px)';c.fillStyle='#ffffff';const m=tw*.012;c.fillRect(10,14,tw/2-m-10,th-28);c.fillRect(tw/2+m,14,tw/2-m-10,th-28);c.filter='none';
        c.globalCompositeOperation='destination-out';const f=c.createLinearGradient(0,th,0,0);f.addColorStop(0,'#00000000');f.addColorStop(1,'#000000d0');c.fillStyle=f;c.fillRect(0,0,tw,th);},512,256);
    const sunMat=additive(sunMap,{side:THREE.DoubleSide}),sunGeo=new THREE.PlaneGeometry(1,1),sun=flat(mesh(right,sunGeo,sunMat,[0,0,0]));sun.name='Window daylight patch';

    // Original canvas artwork with gallery frames, hanging wires, labels and sale dots.
    const artMaps=new Map(),artMats=[],dots=[],labels=new Map();
    const artMaterial=style=>{if(!artMaps.has(style)){const map=texture((c,tw,th)=>drawPainting(style,c,tw,th),1024,768);const mat=material('#ffffff',{map,emissive:'#000000',emissiveMap:map,roughness:.82});artMats.push(mat);artMaps.set(style,mat);}return artMaps.get(style);};
    const labelMat=style=>{if(!labels.has(style)){const {title,artist,line}=ART[style];labels.set(style,material('#ffffff',{roughness:.7,map:texture((c,tw,th)=>{c.fillStyle='#f5f2eb';c.fillRect(0,0,tw,th);c.fillStyle='#1f2a2c';c.font='600 36px Georgia, serif';c.fillText(title,28,54);c.font='25px sans-serif';c.fillStyle='#384446';c.fillText(artist,28,94);c.font='italic 21px sans-serif';c.fillStyle='#5b6567';c.fillText(line,28,128);c.fillRect(28,142,44,2);},512,160)}));}return labels.get(style);};
    const dotMat=material('#c41f2b',{roughness:.55}),dotGeo=new THREE.CircleGeometry(15,20),wireMat=material('#8e9496',{metalness:.8,roughness:.3});
    const oakFrame=material('#c5a57c',{map:oakMap,roughness:.6}),matBoard=material('#f7f4ee',{roughness:.95});
    const artwork=(id,at,width,height,style,turn=0,parent=back,frame='black')=>{
        const g=group(id,ART[style].title,at,turn,parent),lip=frame==='float'?14:frame==='oak'?46:34,gap=frame==='oak'?90:0,zw=-35;
        box(g,[width+gap*2+lip*2,height+gap*2+lip*2,frame==='float'?44:32],[0,0,0],frame==='oak'?oakFrame:black,3);
        if(gap)box(g,[width+gap*2,height+gap*2,4],[0,0,15],matBoard);
        box(g,[width,height,frame==='float'?38:5],[0,0,frame==='float'?6:18],artMaterial(style));
        const ow=width/2+gap+lip,oh=height/2+gap+lip,lx=ow-115,ly=-oh-75;
        // Labels sit on the wall face (in front of the feature paint), below the frame's right corner.
        const label=box(g,[230,72,3],[lx,ly,zw+8],labelMat(style));label.castShadow=false;
        const dot=mesh(g,dotGeo,dotMat,[lx-135,ly+22,zw+10]);dot.visible=false;dot.castShadow=false;dots.push(dot);
        const rail=h-54-at[1];merge(g,wireMat,[seg([-ow*.55,oh,zw+10],[-ow*.3,rail,zw+7],1.4,5),seg([ow*.55,oh,zw+10],[ow*.3,rail,zw+7],1.4,5)]);
        return g;
    };
    const mainW=tier?1700:1250,mainX=-w/2+(tier?1700:1450),featureR=mainX+mainW/2+220;
    // A deep sage feature bay frames the hero canvas and the salon hang.
    merge(back,feature,[part([featureR+w/2,h-14,6],[(featureR-w/2)/2,(h+14)/2,bz+3])]);
    artwork('main-art',[mainX,1950,bz+35],mainW,850,0);scallop('back',mainX,mainW*1.45);
    artwork('left-art',[-w/2+35,1930,bz+2250],900,1100,1,Math.PI/2,left);scallop('left',bz+2250,1500);
    artwork('right-art',[w/2-35,2050,front-1100],tier>=3?2000:1050,850,2,-Math.PI/2,right,tier>=3?'black':'oak');scallop('right',front-1100,(tier>=3?2000:1050)*1.5,1);
    if(tier>=2){artwork('second-print',[-w/2+35,1900,front-2600],1200,900,4,Math.PI/2,left);scallop('left',front-2600,1800);}

    // Salon hang of works on paper beside the hero canvas (merged frames, mats and atlas art).
    const paperMap=texture((c,tw)=>{const s=tw/3;for(let k=0;k<9;k++){c.save();c.translate((k%3)*s,Math.floor(k/3)*s);c.beginPath();c.rect(0,0,s,s);c.clip();drawPaper(k,c,s);c.restore();}},1024,1024);
    const paperMat=material('#ffffff',{map:paperMap,emissive:'#000000',emissiveMap:paperMap,roughness:.9});artMats.push(paperMat);
    const salonX=-w/2+420,salon=group('salon-hang','Salon hang · works on paper',[salonX,1850,bz+30],0,back);
    const sheets=[[-160,320,240,330,'black',0],[140,380,260,220,'oak',3],[140,50,260,340,'black',4],[-160,-60,240,260,'oak',2],[-10,-390,520,230,'black',7]];
    const frameParts={black:[],oak:[]},mats=[],papers=[];
    for(const [x,y,fw,fh,kind,cell] of sheets){
        frameParts[kind].push(part([fw,fh,26],[x,y,0]));mats.push(part([fw-36,fh-36,3],[x,y,13.5]));
        const pg=new THREE.PlaneGeometry(fw-36-(kind==='oak'?70:50),fh-36-(kind==='oak'?70:50)),uv=pg.attributes.uv,cx=cell%3,cy=Math.floor(cell/3);
        for(let i=0;i<uv.count;i++)uv.setXY(i,(cx+uv.getX(i))/3,(2-cy+uv.getY(i))/3);papers.push(part(null,[x,y,15.5],pg));
    }
    merge(salon,black,frameParts.black);merge(salon,oakFrame,frameParts.oak);merge(salon,matBoard,mats);merge(salon,paperMat,papers);
    scallop('back',salonX,900);
    // Smaller rooms add a series of three studies along the sculpture wall.
    if(tier<2){const seriesZ=bz+3550,series=group('print-series','Series of three studies',[-w/2+30,1750,seriesZ],Math.PI/2,left),fr=[],mt=[],pp=[];
        for(let i=0;i<3;i++){const x=(i-1)*480,cell=[4,7,3][i];fr.push(part([400,500,26],[x,0,0]));mt.push(part([364,464,3],[x,0,13.5]));
            const pg=new THREE.PlaneGeometry(260,330),uv=pg.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,(cell%3+uv.getX(j))/3,(2-Math.floor(cell/3)+uv.getY(j))/3);pp.push(part(null,[x,0,15.5],pg));}
        merge(series,oakFrame,fr);merge(series,matBoard,mt);merge(series,paperMat,pp);scallop('left',seriesZ,1700);}

    // Exhibition title in vinyl lettering above the desk: the desk is object no. 01.
    const titleR=w/2-150,titleL=Math.max(featureR+150,titleR-1400),titleW=titleR-titleL,titleX=(titleL+titleR)/2;
    const titleMap=texture((c,tw,th)=>{c.fillStyle='#2a3133';c.font='300 30px sans-serif';c.letterSpacing='10px';c.fillText('THE ERGOFLEX COLLECTION · GALLERY II',4,40);
        c.font='600 104px Georgia, serif';c.letterSpacing='6px';c.fillText('Forms in Motion',0,160);c.fillRect(4,196,120,4);c.letterSpacing='0px';
        c.font='27px sans-serif';c.fillStyle='#4b5557';['Objects that rise, tilt and travel with the people who use them.','Sculpture, painting and works on paper in conversation with','object no. 01 — a height-adjustable desk in steel and oak.'].forEach((t,i)=>c.fillText(t,4,250+i*38));},1024,384);
    const titleMesh=mesh(back,new THREE.PlaneGeometry(titleW,titleW*.375),new THREE.MeshStandardMaterial({map:titleMap,transparent:true,roughness:.9,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),[titleX,h-430-titleW*.1875,bz+2]);titleMesh.castShadow=false;
    if(tier>=2){const hw=Math.min(1600,titleL-featureR-700);artwork('back-horizon',[(featureR+titleL)/2,1900,bz+35],hw,hw*.62,3,0,back,'float');scallop('back',(featureR+titleL)/2,hw*1.5);}
    scallop('back',titleX,titleW*.9);

    // Plinths: painted body on a shadow-gap toe, honed marble cap and a brass plaque.
    const plinth=(id,name,at,size,body=satin)=>{const g=group(id,name,[at[0],0,at[1]]),cap=size[1]>300?16:22;
        box(g,[size[0]-40,30,size[2]-40],[0,15,0],black,2);box(g,[size[0],size[1]-30-cap,size[2]],[0,(size[1]+30-cap)/2,0],body,3);box(g,[size[0]+8,cap,size[2]+8],[0,size[1]-cap/2,0],marble,2);
        strip(g,[size[0]-60,6,8],[0,24,size[2]/2-22]);if(size[1]>300)box(g,[200,56,4],[0,size[1]-150,size[2]/2+2],brass,1);
        pool(at[0],at[1],Math.max(size[0],size[2])*1.9);return g;};
    plinth('thinker-plinth','Stone plinth for The Thinker',layout.thinker,[720,850,640],stone);
    plinth('vase-plinth','Tall ceramic display plinth',layout.vase,[420,1000,420]);
    if(tier)plinth('aphrodite-plinth','Low marble sculpture base',[-w/2+560,bz+550],[820,120,760]);
    if(tier>=2)plinth('mercury-plinth','Bronze sculpture base',[w/2-650,bz+3800],[960,120,1000]);
    // Brass stanchions and a velvet rope keep visitors back from The Thinker.
    const rope=group('thinker-stanchions','Brass stanchions and velvet rope',[layout.thinker[0],0,layout.thinker[1]+640]);
    const posts=[-470,0,470].filter((_,i)=>tier||i!==1),postGeos=[],baseGeos=[];
    for(const x of posts){baseGeos.push(part(null,[x,8,0],new THREE.CylinderGeometry(140,150,16,24)));postGeos.push(seg([x,16,0],[x,900,0],22,12),part(null,[x,925,0],new THREE.SphereGeometry(36,14,10)));}
    merge(rope,steel,baseGeos);merge(rope,brass,postGeos);
    const velvet=material('#7b1a26',{roughness:.85}),ropeGeos=[];
    for(let i=0;i<posts.length-1;i++){const x0=posts[i]+30,x1=posts[i+1]-30,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x0,880,0),new THREE.Vector3((x0+x1)/2,(tier?760:720),0),new THREE.Vector3(x1,880,0)]);ropeGeos.push(new THREE.TubeGeometry(curve,24,15,8,false));}
    merge(rope,velvet,ropeGeos);
    // Polished marble loop: an original sculpture on its own low plinth.
    const [sx,sz]=layout.sculpture,loop=group('marble-loop','Original marble loop sculpture',[sx,0,sz]);
    box(loop,[480,30,480],[0,15,0],black,2);box(loop,[520,354,520],[0,207,0],satin,3);box(loop,[528,16,528],[0,392,0],marble,2);
    const knotGeo=new THREE.TorusKnotGeometry(195,54,180,18,2,3);knotGeo.rotateX(Math.PI/2.4);knotGeo.computeBoundingBox();knotGeo.translate(0,400-knotGeo.boundingBox.min.y+30,0);
    mesh(loop,knotGeo,marble,[0,0,0]);mesh(loop,new THREE.CylinderGeometry(60,80,34,20),steel,[0,417,0]);
    pool(sx,sz,1100);
    // Museum bench: steel sled legs, an oak slab and button-tufted leather.
    const bench=group('gallery-bench','Oak exhibition bench',[tier?0:250,0,bz+3000]);
    const bw=tier?1800:1300,legs=[];
    for(const x of [-bw/2+110,bw/2-110])legs.push(part([50,380,50],[x,220,-180]),part([50,380,50],[x,220,180]),part([50,30,420],[x,15,0]),part([50,30,420],[x,395,0]));
    merge(bench,steel,legs);box(bench,[bw,55,480],[0,437.5,0],oak,6);
    const leatherMap=texture((c,tw,th)=>{c.fillStyle='#3b302a';c.fillRect(0,0,tw,th);const sx=tw/8,sy=th/3;c.strokeStyle='#2a221e';c.lineWidth=2;
        for(let i=-1;i<10;i++){c.beginPath();c.moveTo(i*sx,0);c.lineTo(i*sx+th,th);c.stroke();c.beginPath();c.moveTo(i*sx,0);c.lineTo(i*sx-th,th);c.stroke();}
        for(let j=0;j<=3;j++)for(let i=0;i<=8;i++){if((i+j)%2)continue;const x=i*sx,y=j*sy,g=c.createRadialGradient(x,y,1,x,y,16);g.addColorStop(0,'#14100e');g.addColorStop(1,'#3b302a00');c.fillStyle=g;c.fillRect(x-16,y-16,32,32);}
        for(let i=0;i<1600;i++){c.fillStyle=i%2?'#ffffff0d':'#0000001a';c.fillRect(hash(i)*tw,hash(i*1.9)*th,2,2);}},512,192);
    box(bench,[bw-60,40,420],[0,485,0],material('#ffffff',{map:leatherMap,roughness:.5}),12);
    pool(tier?0:250,bz+3000,bw*1.3);
    if(tier>=3){
        const vitrine=group('collection-case','Glass exhibition case and award',[-1100,0,front-2300]);
        box(vitrine,[1300,100,700],[0,50,0],black,3);box(vitrine,[1250,700,650],[0,450,0],stone,4);box(vitrine,[1300,50,700],[0,825,0],oak,3);
        const glass=material('#c9e0e6',{transparent:true,opacity:.13,roughness:.15,depthWrite:false});
        for(const x of [-645,645])box(vitrine,[5,550,700],[x,1125,0],glass);for(const z of [-345,345])box(vitrine,[1300,550,5],[0,1125,z],glass);box(vitrine,[1300,5,700],[0,1402.5,0],glass);
        for(const x of [-650,650])for(const z of [-350,350])rod(vitrine,[x,850,z],[x,1405,z],4,brass);strip(vitrine,[1150,6,8],[0,852,-315]);
        const rug=group('salon-rug','Woven collector salon rug',[w/2-1500,0,front-2100]);
        box(rug,[2400,4,2900],[0,2,0],material('#c8bcaa',{roughness:1}),3);
        pool(-1100,front-2300,1600);
    }
    if(tier===4){
        const sculpture=group('ribbon-sculpture','Original bronze ribbon sculpture',[0,0,bz+d*.55]);
        box(sculpture,[1000,160,1000],[0,80,0],stone,6);
        const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-270,160,-50),new THREE.Vector3(320,650,180),new THREE.Vector3(-350,1400,-100),new THREE.Vector3(0,2250,0),new THREE.Vector3(350,1700,110),new THREE.Vector3(-100,850,210)]);
        mesh(sculpture,new THREE.TubeGeometry(curve,80,65,10,false),brass,[0,0,0]);
        const panel=group('collection-divider','Freestanding exhibition panel',[-w/2+2400,0,front-4600]);
        box(panel,[2100,75,550],[0,37.5,0],black,4);box(panel,[1900,2200,90],[0,1175,0],ivory,4);
        // A second face of the gallery's original art, all in one movable group.
        box(panel,[1450,1100,20],[0,1250,62],black,3);box(panel,[1400,1050,5],[0,1250,75],artMaterial(1));
        pool(0,bz+d*.55,1900);
    }
    // Track lighting: three rails of aimed spots (bodies, stems and lenses merged).
    const ceiling=new THREE.Group();ceiling.name='Gallery track lighting';root.add(ceiling);room.ceilingFixture=ceiling;
    const backTrackZ=bz+900,backL=-w/2+800,backR=w/2-1050,heads=[];
    for(const x of [-w/2+650,w/2-900]){box(ceiling,[40,34,d-800],[x,h-60,bz+d/2],black,2);for(let i=0;i<4;i++){const z=bz+600+i*(d-1200)/3;heads.push([x,z,x<0?-w/2:w/2,1700,z]);}}
    box(ceiling,[backR-backL,34,40],[(backL+backR)/2,h-60,backTrackZ],black,2);
    for(const x of [salonX+120,mainX,titleX-titleW*.25,titleX+titleW*.25])heads.push([Math.min(Math.max(x,backL+60),backR-60),backTrackZ,x,1800,bz]);
    const bodies=[],lenses=[],up=new THREE.Vector3(0,1,0);
    for(const [x,z,tx,ty,tz] of heads){
        const pivot=new THREE.Vector3(x,h-175,z),dir=new THREE.Vector3(tx,ty,tz).sub(pivot).normalize(),q=new THREE.Quaternion().setFromUnitVectors(up,dir);
        bodies.push(seg([x,h-77,z],[x,h-150,z],7,6),part([24,60,90],[x,h-160,z]));
        const body=new THREE.CylinderGeometry(40,34,150,14).applyQuaternion(q);bodies.push(body.translate(...pivot.clone().addScaledVector(dir,30).toArray()));
        const lens=new THREE.CylinderGeometry(29,29,4,14).applyQuaternion(q);lenses.push(lens.translate(...pivot.clone().addScaledVector(dir,107).toArray()));
    }
    merge(ceiling,black,bodies);const lensMat=material('#fff2da',{emissive:'#fff2da',emissiveIntensity:1});merge(ceiling,lensMat,lenses).castShadow=false;
    const lights=[{at:[layout.thinker[0],2300,layout.thinker[1]+150],power:3.8},{at:[layout.desk[0],h-450,layout.desk[1]],power:3,task:true},{at:[-w/2+700,2200,front-1200],power:3.2},{at:[w/2-800,2400,bz+d*.55],power:4,channel:1}].map(spec=>{const light=new THREE.PointLight('#ffe4bd',0,5000*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    const tint=new THREE.Color();
    room.roomAtmosphere=(id,accent=1)=>{const mode=GALLERY_MODES[id]||GALLERY_MODES.morning,c=skyCanvas.getContext('2d'),gradient=c.createLinearGradient(0,0,0,512),dark=['night','party'].includes(id);
        gradient.addColorStop(0,mode.sky[0]);gradient.addColorStop(1,mode.sky[1]);c.fillStyle=gradient;c.fillRect(0,0,512,512);
        // A low city skyline outside; windows light up after dark.
        for(let i=0;i<14;i++){const bw=24+hash(i)*34,x=i*38-10,top=300+hash(i+5)*120;c.fillStyle=dark?'#141d2a':id==='evening'?'#6b6670':'#9aa9ad';c.fillRect(x,top,bw,512-top);
            if(dark||id==='evening')for(let y=top+10;y<470;y+=16)for(let wx=x+5;wx<x+bw-6;wx+=10)if(hash(i*31+y*.7+wx)>.55){c.fillStyle=hash(wx+y)>.3?'#ffd89a':'#c9e3ff';c.globalAlpha=dark?.85:.4;c.fillRect(wx,y,4,6);c.globalAlpha=1;}}
        c.fillStyle=dark?'#24302c':'#7c918b';c.fillRect(0,470,512,42);skyMap.needsUpdate=true;
        glowMats.forEach((mat,channel)=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.1+mode.wash*accent;});
        washMats.forEach((mat,channel)=>mat.color.set(mode.colors[channel]).multiplyScalar((.05+mode.wash*.3)*accent));
        poolMat.color.set(mode.colors[0]).multiplyScalar((.03+mode.wash*.16)*accent);
        lensMat.emissive.set(mode.colors[0]);lensMat.emissiveIntensity=.4+mode.wash*1.6*accent;
        artMats.forEach(mat=>mat.emissive.setScalar((.03+mode.wash*.17)*accent));
        blindMat.emissiveIntensity=dark?.02:mode.power*.12;
        dots.forEach(dot=>{dot.visible=id==='party';});
        const s=SUN[id]||SUN.morning,pos=sunGeo.attributes.position,uv=sunGeo.attributes.uv;
        for(let i=0;i<pos.count;i++){const u=uv.getX(i),v=uv.getY(i);pos.setXYZ(i,w/2-s.near-v*s.length,2.5,a+60+u*(ww-120)+v*s.skew);}
        pos.needsUpdate=true;sunGeo.computeBoundingSphere();sunMat.color.copy(tint.set(s.color)).multiplyScalar(s.gain);sun.visible=s.gain>0;
        lights.forEach(spec=>{spec.light.color.set(mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});root.userData.atmosphere=id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[ivory, 'plaster'], [feature, 'plaster'], [satin, 'powder'], [black, 'powder'], [steel, 'metal'], [alu, 'metal'], [brass, 'metal'], [oak, 'wood'], [oakFrame, 'wood'], [stone, 'stone'], [marble, 'stone']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
