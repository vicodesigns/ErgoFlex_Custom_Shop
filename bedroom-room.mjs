import * as THREE from 'three';

const tiers = [
    ['apartment', 'Apartment bedroom & desk nook', 3800, 4400, 2600],
    ['house', 'Home bedroom & reading corner', 4600, 5400, 2800],
    ['spacious', 'Spacious bedroom & dressing room', 5800, 6500, 3000],
    ['premium', 'Primary bedroom & private retreat', 7200, 8000, 3200],
    ['executive', 'Private bedroom & lounge suite', 9000, 9600, 3400]
];
export const BEDROOM_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1800, front = back + depth, desk = [width / 2 - (tier ? 900 : 800), back + 950];
    const bed = [-width / 2 + (tier ? 1550 : 1260), back + 1060], bedHalf = tier ? 989.6 : 800.3;
    const bedside = [[bed[0] - bedHalf - (tier ? 280 : 230), back + 400]];
    if (tier >= 2) bedside.push([bed[0] + bedHalf + 280, back + 400]);
    const reading = [-width / 2 + 700, front - 700];
    const props = [
        // bed-2 has its headboard at +Z; turn it toward the back wall.
        { id: tier ? 'bed' : 'bed-2', at: [bed[0], 0, bed[1]], turn: tier ? 0 : 180 },
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 960], turn: 180 },
        { id: 'dresser', at: [width / 2 - 420, 0, front - 850], turn: -90 },
        { id: 'table-mirror-2', at: [width / 2 - 420, 1089.6, front - 850], turn: -90 },
        { id: 'kenney-furniture-plant-small2', at: [width / 2 - 420, 1089.6, front - 1170] },
        { id: 'rose', at: [width / 2 - 430, 1089.6, front - 520], turn: 20 },
        { id: 'journal', at: [bedside[0][0] + 65, 550, bedside[0][1] + 65], turn: -10 },
        ...bedside.map(([x,z]) => ({ id: 'kenney-furniture-lamp-round-table', at: [x - 40, 550, z - 70] }))
    ];
    // The compact room's only free floor corner is between the bed foot and the wardrobe.
    if (!tier) props.push({ id: 'ficus', at: [-width / 2 + 260, 0, front - 1520] });
    if (tier) props.push(
        { id: 'armchair-poppi', at: [reading[0], 0, reading[1]], turn: 25 },
        { id: 'coffee-table-2', at: [reading[0] + 850, 0, reading[1] + 220] },
        { id: 'tea-cup', at: [reading[0] + 860, 700, reading[1] + 190] },
        { id: 'journal', at: [reading[0] + 760, 700, reading[1] + 250], turn: 10 },
        { id: 'kenney-furniture-lamp-round-floor', at: [reading[0] - 340, 0, reading[1] - 820] },
        { id: 'kenney-furniture-potted-plant', at: [width / 2 - 330, 0, back + 2800] }
    );
    if (tier >= 2) props.push({ id: 'full-length-mirror', at: [-width / 2 + 35, 0, front - 430], turn: 90, on: 'wall' });
    if (tier >= 3) props.push({ id: 'photo-frame', at: [-width / 2 + 2100, 892.9, front - 2400], turn: 12 });
    if (tier === 4) props.push(
        { id: 'sofa-fabric', at: [width / 2 - 700, 0, front - 2500], turn: -90 },
        { id: 'coffee-table', at: [width / 2 - 1800, 0, front - 2500], turn: 90 },
        { id: 'journal', at: [width / 2 - 1800, 391.2, front - 2600], turn: 80 },
        { id: 'tea-cup', at: [width / 2 - 1740, 391.2, front - 2290] }
    );
    return [id, { id, name, width, depth, height, back, tier, desk, bed, bedHalf, bedside, reading, props,
        daylight: [width / 2 - 100, back + 1700] }];
}));
export const bedroomLayoutById = id => BEDROOM_LAYOUTS[id] || BEDROOM_LAYOUTS.apartment;
export const bedroomLayoutForSize = size => BEDROOM_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const BEDROOM_MODES = {
    morning: { label: 'Morning', description: 'Gentle daylight · standing desk for a fresh start', key: '#ffe8c8', fill: '#d8e8f2', accent: '#e4d6b8', power: 1.75, ambient: .44, bounce: .6, exposure: 1.06, sky: ['#94bddb', '#f6dcb6'], practical: .2, wash: .16, colors: ['#f0d1a1', '#b7cebf'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft window light · seated work and journaling', key: '#fff2de', fill: '#dfe9f0', accent: '#e8d1af', power: 1.4, ambient: .46, bounce: .62, exposure: 1.08, sky: ['#9fc2dc', '#ece6d6'], practical: .35, wash: .28, colors: ['#efd1ae', '#b9c9ba'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm reading lamps · desk angled for a quiet wind-down', key: '#f7b985', fill: '#b9c4dd', accent: '#efb07a', power: .62, ambient: .25, bounce: .34, exposure: 1.14, sky: ['#6f7aa4', '#f0a979'], practical: .9, wash: .82, colors: ['#ffc58a', '#b4bfc0'], height: 28, tilt: 12, offset: [0, 80], yaw: 0, leds: true, color: '#ffdda7' },
    night: { label: 'Night', description: 'Restful bedroom · dim amber paths and desk LEDs off', key: '#9fb5d8', fill: '#9fb0cc', accent: '#d4a975', power: .2, ambient: .15, bounce: .2, exposure: 1.12, sky: ['#0c1829', '#2b3f5c'], practical: .22, wash: .42, colors: ['#e9b276', '#8ea7b9'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: false },
    party: { label: 'Weekend', description: 'A slow morning · open light and room to stretch', key: '#fff0d6', fill: '#d6e5ee', accent: '#d8c5a8', power: 1.3, ambient: .44, bounce: .58, exposure: 1.1, sky: ['#a6cbe2', '#f1dcbc'], practical: .55, wash: .5, colors: ['#efcfa1', '#bbcfbd'], height: 43.5, tilt: 0, offset: [-60, 130], yaw: 8, leds: true, color: '#f3d3aa' }
};
// Per-mode strength of the fixtures each mode switches on: window sun (and moon)
// on the floor, the window halo, the roman shade drop, reading sconces and lamp
// halos, candles, the picture light and the opal pendants. Sun angles follow
// the shared light rig so the patch agrees with the key light's shadows.
const BEDROOM_FIXTURES = {
    morning: { sun: .62, sunColor: '#ffd8a4', slope: .62, sweep: -.36, halo: .42, shade: .04, lamps: 0, candles: 0, picture: 0, pendant: 0 },
    afternoon: { sun: .5, sunColor: '#fff0d4', slope: 1.45, sweep: .12, halo: .34, shade: .1, lamps: 0, candles: 0, picture: .12, pendant: 0 },
    evening: { sun: .5, sunColor: '#ff9e5c', slope: .36, sweep: .48, halo: .3, shade: .22, lamps: 1, candles: 1, picture: .9, pendant: .55 },
    night: { sun: .26, slope: 1.3, sweep: -.1, halo: .12, shade: .5, lamps: .3, candles: .7, picture: 0, pendant: 0, moon: '#93acd8' },
    party: { sun: .55, sunColor: '#ffe6c0', slope: 1.1, sweep: .25, halo: .4, shade: 0, lamps: .14, candles: 0, picture: .2, pendant: 0 }
};
const SKY_SCENES = {
    morning: { sun: [120, 250, '255,236,196', 22, 170], hills: '#9db4b6', roofs: '#c4b9a7', trees: '#7e9a82', cloud: '255,255,255', lit: 0 },
    afternoon: { sun: [360, 70, '255,250,236', 20, 150], hills: '#a4b8ad', roofs: '#cfc4b1', trees: '#829d84', cloud: '255,255,255', lit: 0 },
    evening: { sun: [330, 380, '255,186,112', 30, 230], hills: '#85798f', roofs: '#6e5f6e', trees: '#4f5a55', cloud: '255,196,160', lit: .7 },
    night: { sun: [370, 105, '226,234,255', 15, 80], hills: '#1d2c42', roofs: '#16223a', trees: '#0f1a2b', cloud: '110,130,165', lit: 1, stars: true },
    party: { sun: [200, 140, '255,244,222', 20, 160], hills: '#a5bcb4', roofs: '#d0c6b3', trees: '#7f9d86', cloud: '255,255,255', lit: 0 }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}
// Stable pseudo-random numbers keep procedural textures identical between rebuilds.
const rnd = seed => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildBedroomRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier, bed, bedHalf } = layout, front = bz + d;
    const cream = material('#e1dbcc', { roughness: .95 }), sage = material('#89988b', { roughness: .9 });
    const linen = material('#c7bdab', { roughness: 1 }), dark = material('#445653', { roughness: .78 });
    const brass = material('#b59a67', { metalness: .6, roughness: .4 });
    // Quarter-sawn oak veneer: fine grain, soft tonal bands and a few cathedral figures.
    const woodMap=texture((c,tw,th)=>{c.fillStyle='#ab8f6c';c.fillRect(0,0,tw,th);
        for(let i=0;i<16;i++){c.fillStyle=`rgba(${rnd(i)>.5?'198,168,126':'122,90,60'},${.05+rnd(i+40)*.08})`;c.fillRect(rnd(i+9)*tw,0,18+rnd(i+3)*70,th);}
        for(let i=0;i<300;i++){const x=rnd(i+100)*tw,sway=4+rnd(i+7)*9;c.strokeStyle=rnd(i+3)>.28?`rgba(88,60,36,${.07+rnd(i)*.13})`:`rgba(236,210,170,${.08+rnd(i)*.1})`;c.lineWidth=.6+rnd(i+5)*1.3;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+sway,th*.33,x-sway,th*.66,x+rnd(i+11)*6-3,th);c.stroke();}
        for(let k=0;k<3;k++){const cx=tw*(.18+k*.32),cy=th*(.3+rnd(k+70)*.45);for(let j=0;j<8;j++){c.strokeStyle=`rgba(98,66,40,${.08+j*.012})`;c.lineWidth=1.1;c.beginPath();c.ellipse(cx,cy,8+j*6,80+j*30,0,Math.PI*1.1,Math.PI*1.9);c.stroke();}}
    },512,1024);
    const oak = material('#ffffff', { map: woodMap, roughness: .62 });
    // Wide-plank oak floor: staggered end joints, bevelled seams and per-board tone.
    const floorMap=texture((c,tw,th)=>{const boards=6,bw=tw/boards,tones=['#b29775','#ab8f6c','#b89c79','#ae926f','#a98c68','#b49875','#af9370'];
        for(let i=0;i<boards;i++){const joints=[rnd(i+1)*th];joints.push(joints[0]+th*(.38+rnd(i+20)*.24));
            for(let s=0;s<2;s++){const y0=joints[s],len=s?th-(joints[1]-joints[0]):joints[1]-joints[0],tone=tones[(i*2+s)%tones.length];
                for(const y of [y0,y0-th]){c.fillStyle=tone;c.fillRect(i*bw,y,bw,len);
                    for(let g=0;g<30;g++){const x=i*bw+4+rnd(i*31+s*7+g)*(bw-8);c.strokeStyle=rnd(g+i+s)>.25?`rgba(94,66,40,${.06+rnd(g+i)*.12})`:'rgba(238,216,180,.12)';c.lineWidth=.7+rnd(g*3+i)*1.3;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+5,y+len*.35,x-5,y+len*.7,x+rnd(g)*4-2,y+len);c.stroke();}
                    if(rnd(i*13+s)>.55){const ky=y+len*(.2+rnd(i+s)*.6),kx=i*bw+bw*(.3+rnd(i*5+s)*.4);c.fillStyle='rgba(90,60,36,.35)';c.beginPath();c.ellipse(kx,ky,5,9,0,0,Math.PI*2);c.fill();c.strokeStyle='rgba(90,60,36,.18)';c.beginPath();c.ellipse(kx,ky,10,22,0,0,Math.PI*2);c.stroke();}
                    c.fillStyle='rgba(70,50,32,.85)';c.fillRect(i*bw,y,bw,2);c.fillStyle='rgba(255,238,210,.2)';c.fillRect(i*bw,y+2,bw,1.5);}
            }
            c.fillStyle='rgba(70,50,32,.9)';c.fillRect(i*bw,0,2.5,th);c.fillStyle='rgba(255,240,215,.22)';c.fillRect(i*bw+2.5,0,1.5,th);
        }
    },1024,1024);
    floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w/1140,d/3200);
    box(root,[w,30,d],[0,-15,bz+d/2],material('#ffffff',{map:floorMap,roughness:.58}));
    // Hand-troweled limewash for the walls; low contrast so it reads at any wall length.
    const plasterMap=texture((c,tw,th)=>{c.fillStyle='#e6dfd2';c.fillRect(0,0,tw,th);
        for(let i=0;i<190;i++){const x=rnd(i+3)*tw,y=rnd(i+91)*th,r=30+rnd(i+17)*120,tone=rnd(i+5)>.5?'252,248,240':'190,178,158',a=.05+rnd(i)*.06;
            for(const ox of [-tw,0,tw])for(const oy of [-th,0,th]){const g=c.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,r);g.addColorStop(0,`rgba(${tone},${a})`);g.addColorStop(1,`rgba(${tone},0)`);c.fillStyle=g;c.fillRect(x+ox-r,y+oy-r,r*2,r*2);}}
        for(let i=0;i<6000;i++){c.fillStyle=i%2?'rgba(120,104,84,.07)':'rgba(255,255,255,.09)';c.fillRect(rnd(i+500)*tw,rnd(i+900)*th,1.5,1.5);}
    });
    const plaster = material('#ffffff', { map: plasterMap, roughness: .96 });
    // Berber wool: soft lattice, double border and a fine weave.
    const weaveMap=texture((c,tw,th)=>{c.fillStyle='#d6cbb5';c.fillRect(0,0,tw,th);
        for(let i=0;i<14000;i++){c.fillStyle=rnd(i)>.5?'rgba(255,250,238,.2)':'rgba(118,102,80,.13)';c.fillRect(rnd(i+1)*tw,rnd(i+2)*th,2,2);}
        c.save();c.beginPath();c.rect(96,96,tw-192,th-192);c.clip();const s=tw/8;
        for(let k=-9;k<=17;k++){for(const dir of [1,-1]){c.strokeStyle='rgba(120,100,76,.5)';c.lineWidth=4;c.beginPath();for(let y=0;y<=th;y+=32){const x=k*s+dir*y+Math.sin(y*.07+k)*3;y?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}}
        c.restore();c.strokeStyle='#8c7a60';c.lineWidth=12;c.strokeRect(36,36,tw-72,th-72);c.strokeStyle='#b39f80';c.lineWidth=5;c.strokeRect(66,66,tw-132,th-132);
        c.strokeStyle='rgba(150,137,113,.16)';c.lineWidth=1;for(let i=0;i<tw;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,th);c.stroke();}for(let i=0;i<th;i+=5){c.beginPath();c.moveTo(0,i);c.lineTo(tw,i);c.stroke();}
    },1024,1024);
    const rugMat = material('#ffffff', { map: weaveMap, roughness: 1 });
    const fringeMap=texture((c,tw,th)=>{for(let i=0;i<tw;i+=5){c.strokeStyle=i%10?'#eadfca':'#d9ccb3';c.lineWidth=2.6;c.beginPath();c.moveTo(i+2,0);c.lineTo(i+2+Math.sin(i)*3,th*(.75+rnd(i)*.25));c.stroke();}},1024,64);
    const fringeMat = material('#ffffff', { map: fringeMap, alphaTest: .4, transparent: false, roughness: 1 });
    const knitMap=texture((c,tw,th)=>{c.fillStyle='#ffffff';c.fillRect(0,0,tw,th);for(let x=0;x<tw;x+=16)for(let y=0;y<th;y+=12){c.fillStyle='rgba(0,0,0,.17)';c.beginPath();c.moveTo(x,y);c.lineTo(x+8,y+6);c.lineTo(x+8,y+12);c.lineTo(x,y+6);c.fill();c.fillStyle='rgba(0,0,0,.06)';c.beginPath();c.moveTo(x+16,y);c.lineTo(x+8,y+6);c.lineTo(x+8,y+12);c.lineTo(x+16,y+6);c.fill();}},256,256);
    knitMap.wrapS = knitMap.wrapT = THREE.RepeatWrapping; knitMap.repeat.set(4,4);
    const knit = material('#a9694f', { map: knitMap, roughness: 1 }), oatKnit = material('#e3d7c0', { map: knitMap, roughness: 1 });
    const rattan = material('#e2c79c', { map: weaveMap, roughness: 1 });
    const terracotta = material('#b8704f', { roughness: .85 }), leafMat = material('#5e7d58', { roughness: .7 });
    const glassMat = material('#d9b88c', { roughness: .12, transparent: true, opacity: .5, depthWrite: false });
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`bedroom:${layout.id}:fixture:${id}`});return g;};
    const glow=[];
    const strip=(parent,size,at,channel=0)=>{const mat=material('#efd0a1',{emissive:'#efd0a1',emissiveIntensity:.3});const o=box(parent,size,at,mat,2);o.castShadow=false;glow.push({mat,channel});return o;};
    // Mode-driven fixtures: additive light pools, glowing shades and candle flames.
    const fixtures=[];let current=['morning',1];
    const tune=entry=>{const [id,accent]=current,mode=BEDROOM_MODES[id]||BEDROOM_MODES.morning,f=BEDROOM_FIXTURES[id]||BEDROOM_FIXTURES.morning;
        const k=f[entry.kind]*(['sun','halo'].includes(entry.kind)?1:accent)*(entry.gain||1);
        const color=entry.kind==='sun'?f.moon||f.sunColor:entry.kind==='halo'?mode.sky[1]:entry.kind==='candles'?'#ffb46a':mode.colors[entry.channel||0];
        if(entry.mat.isMeshStandardMaterial){entry.mat.emissive.set(color);entry.mat.emissiveIntensity=Math.max(.0001,k);}else entry.mat.color.set(color).multiplyScalar(k);
        if(entry.obj)entry.obj.visible=k>.01;};
    const fixture=(obj,kind,mat,gain=1,channel=0)=>{const entry={obj,kind,mat,gain,channel};fixtures.push(entry);tune(entry);return obj;};
    const additive=map=>new THREE.MeshBasicMaterial({map,color:'#000000',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    const pool=(parent,size,at,map,kind,gain=1,rot=[0,0,0])=>{const mat=additive(map),o=mesh(parent,new THREE.PlaneGeometry(...size),mat,at);o.rotation.set(...rot);o.castShadow=o.receiveShadow=false;o.renderOrder=2;return fixture(o,kind,mat,gain);};
    const washMap=texture((c,tw,th)=>{c.translate(tw/2,th*.42);c.scale(1,2.1);const g=c.createRadialGradient(0,0,0,0,0,tw/2);g.addColorStop(0,'#ffffff');g.addColorStop(.35,'#ffffff80');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(-tw/2,-th,tw,th*2);},256,512);
    const haloMap=texture((c,tw,th)=>{const g=c.createRadialGradient(tw/2,th/2,0,tw/2,th/2,tw/2);g.addColorStop(0,'#ffffff');g.addColorStop(.18,'#ffffffa0');g.addColorStop(.5,'#ffffff30');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,tw,th);},128,128);
    const halo=(parent,at,size,kind,gain=1)=>{const mat=new THREE.SpriteMaterial({map:haloMap,color:'#000000',blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});const s=new THREE.Sprite(mat);s.position.set(...at);s.scale.set(size,size,1);s.renderOrder=3;parent.add(s);return fixture(s,kind,mat,gain);};
    const candle=(parent,at,scale=1)=>{const [x,y,z]=at;
        mesh(parent,new THREE.CylinderGeometry(38*scale,36*scale,90*scale,20),glassMat,[x,y+45*scale,z]).castShadow=false;
        mesh(parent,new THREE.CylinderGeometry(32*scale,32*scale,52*scale,16),cream,[x,y+27*scale,z]);
        const flameMat=material('#ffe2b0',{emissive:'#ffb46a',emissiveIntensity:1});const flame=sphere(parent,[8*scale,19*scale,8*scale],[x,y+76*scale,z],flameMat);flame.castShadow=false;
        fixture(flame,'candles',flameMat,2.2);halo(parent,[x,y+78*scale,z],150*scale,'candles',.7);};
    // Instanced foliage: one draw call per plant, however many leaves it has.
    const leafGeometry=new THREE.SphereGeometry(1,10,7);
    const leaves=(parent,points,mat=leafMat)=>{const o=new THREE.InstancedMesh(leafGeometry,mat,points.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
        points.forEach(([x,y,z,sx,sy,sz,rx=0,ry=0,rz=0],i)=>{m.compose(new THREE.Vector3(x,y,z),q.setFromEuler(e.set(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));o.setMatrixAt(i,m);});
        o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
    const rug=group('bedside-rug','Woven bedside area rug',[bed[0],0,bz+2050]);
    const rugWidth=tier?2550:2110;box(rug,[rugWidth,4,2300],[0,2,0],rugMat,4);
    for(const z of [-1185,1185])box(rug,[rugWidth-80,2,70],[0,1.5,z],fringeMat);
    const back=new THREE.Group();back.name='Bedroom linen and oak headboard wall';root.add(back);
    box(back,[w,h,80],[0,h/2,bz-40],plaster);box(back,[w,110,24],[0,55,bz+12],oak);
    const panels=group('headboard-wall','Linen panels and oak bedside wall',[bed[0],0,bz+24],0,back);
    const panelWidth=tier?2900:2440;
    box(panels,[panelWidth,100,30],[0,50,0],oak);
    box(panels,[panelWidth,1560,30],[0,880,0],sage,8);
    for(let i=0;i<5;i++)box(panels,[panelWidth/5-12,1190,35],[-panelWidth/2+panelWidth/5*(i+.5),825,22],linen,12);
    for(const x of [-panelWidth/2+35,panelWidth/2-35])box(panels,[25,1530,40],[x,880,22],oak,3);
    strip(panels,[panelWidth-110,10,10],[0,1675,-3]);room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    // Brass and linen reading sconces on the panels, each with its own wall wash.
    const shadeMat=material('#f2e2c6',{emissive:'#ffc58a',emissiveIntensity:.0001,roughness:.9,side:THREE.DoubleSide});fixture(null,'lamps',shadeMat,1.1);
    for(const [i,side] of [-1,1].entries()){
        const sconce=group('sconce-'+i,'Brass and linen reading sconce',[Math.max(-w/2+300,bed[0]+side*(bedHalf+(tier?280:230))),1240,bz+66],0,back);
        mesh(sconce,new THREE.CylinderGeometry(52,52,14,24),brass,[0,0,7]).rotation.x=Math.PI/2;
        rod(sconce,[0,0,10],[0,52,140],7,brass);sphere(sconce,[16,16,16],[0,52,140],brass);
        mesh(sconce,new THREE.CylinderGeometry(78,104,150,28,1,true),shadeMat,[0,40,150]).castShadow=false;
        pool(sconce,[520,1250],[0,-70,2],washMap,'lamps',.55);
    }
    const artMap=texture((c,tw,th)=>{c.fillStyle='#dcd0b5';c.fillRect(0,0,tw,th);
        const sky=c.createLinearGradient(0,0,0,th*.7);sky.addColorStop(0,'#e6dcc6');sky.addColorStop(1,'#d8c6a4');c.fillStyle=sky;c.fillRect(0,0,tw,th);
        const sun=c.createRadialGradient(tw*.72,th*.35,0,tw*.72,th*.35,th*.36);sun.addColorStop(0,'#e8c49880');sun.addColorStop(1,'#e8c49800');c.fillStyle=sun;c.fillRect(0,0,tw,th);
        c.fillStyle='#be9c73';c.beginPath();c.arc(tw*.72,th*.35,th*.21,0,Math.PI*2);c.fill();
        for(let i=0;i<3;i++){c.fillStyle=['#a2ab96','#798b7d','#556f67'][i];c.beginPath();c.moveTo(0,th);c.bezierCurveTo(tw*.25,th*(.28+i*.18),tw*.55,th*(.95-i*.13),tw,th*(.45+i*.16));c.lineTo(tw,th);c.fill();}
        // Dry-brush strokes and paper tooth give the print a painted surface.
        for(let i=0;i<900;i++){const x=rnd(i+3)*tw,y=rnd(i+41)*th;c.strokeStyle=`rgba(${rnd(i+7)>.5?'255,250,236':'60,70,60'},${.04+rnd(i+9)*.05})`;c.lineWidth=1+rnd(i)*3;c.beginPath();c.moveTo(x,y);c.lineTo(x+20+rnd(i+5)*50,y+rnd(i+6)*6-3);c.stroke();}
        for(let i=0;i<9000;i++){c.fillStyle=i%2?'rgba(255,255,255,.08)':'rgba(80,70,50,.06)';c.fillRect(rnd(i+70)*tw,rnd(i+170)*th,1.4,1.4);}
    },1024,512);
    const artWidth=tier?1400:1130;
    const art=group('bedroom-landscape','Original quiet landscape',[bed[0],2050,bz+35],0,back);
    box(art,[artWidth,510,18],[0,0,0],oak,3);box(art,[artWidth-45,465,4],[0,0,12],material('#ffffff',{map:artMap,roughness:.9}));
    // A slim brass picture light washes the canvas in the evening.
    for(const x of [-artWidth/3,artWidth/3])rod(art,[x,240,8],[x,300,100],5,brass);
    rod(art,[-artWidth*.42,300,105],[artWidth*.42,300,105],16,brass);
    const pictureMat=material('#fff1d8',{emissive:'#ffe2b8',emissiveIntensity:.0001});fixture(null,'picture',pictureMat,2);
    box(art,[artWidth*.8,5,14],[0,284,104],pictureMat).castShadow=false;
    pool(art,[artWidth+160,700],[0,-20,15],washMap,'picture',.5);
    const left=new THREE.Group();left.name='Bedroom wardrobe and dressing wall';root.add(left);box(left,[80,h,d],[-w/2-40,h/2,bz+d/2],plaster);box(left,[20,110,d],[-w/2+10,55,bz+d/2],oak);room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
    const right=new THREE.Group();right.name='Bedroom daylight and desk wall';root.add(right);
    const wz=bz+1700,ww=tier?2000:1600,low=850,wh=1450,a=wz-ww/2,b=wz+ww/2;
    box(right,[80,h,a-bz],[w/2+40,h/2,(a+bz)/2],plaster);box(right,[80,h,front-b],[w/2+40,h/2,(front+b)/2],plaster);box(right,[80,low,ww],[w/2+40,low/2,wz],plaster);box(right,[80,h-low-wh,ww],[w/2+40,(h+low+wh)/2,wz],plaster);
    box(right,[20,110,a-bz],[w/2-10,55,(a+bz)/2],oak);box(right,[20,110,front-b],[w/2-10,55,(front+b)/2],oak);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(right,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[w/2+52,low+wh/2,wz]);pane.rotation.y=-Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(right,[65,wh+50,30],[w/2-10,low+wh/2,z],oak);for(const y of [low,low+wh])box(right,[65,30,ww+60],[w/2-10,y,wz],oak);box(right,[170,30,ww+80],[w/2-50,low-15,wz],oak,3);
    // Layered window: a linen roman shade, café sheers and full-height pleated drapes.
    const shadeMap=texture((c,tw,th)=>{c.fillStyle='#e9e0cf';c.fillRect(0,0,tw,th);for(let y=0;y<th;y+=128){const g=c.createLinearGradient(0,y,0,y+128);g.addColorStop(0,'#f8f2e6');g.addColorStop(.8,'#ebe2d0');g.addColorStop(1,'#cdc1aa');c.fillStyle=g;c.fillRect(0,y,tw,128);}for(let i=0;i<tw;i+=3){c.fillStyle='rgba(150,135,110,.12)';c.fillRect(i,0,1,th);}},128,512);
    shadeMap.wrapS=shadeMap.wrapT=THREE.RepeatWrapping;
    const romanShade=mesh(right,new THREE.BoxGeometry(14,1,ww+40),material('#ffffff',{map:shadeMap,roughness:1}),[w/2-52,low+wh,wz]);romanShade.name='Window roman shade';
    box(right,[30,40,ww+70],[w/2-52,low+wh+35,wz],oak,4);
    const drapeGeometry=(width,height,folds,depth)=>{const g=new THREE.PlaneGeometry(width,height,folds*8,6),p=g.attributes.position;for(let i=0;i<p.count;i++){const t=(p.getY(i)+height/2)/height;p.setZ(i,Math.sin((p.getX(i)/width+.5)*folds*Math.PI*2)*depth*(1.25-.45*t));}g.computeVertexNormals();return g;};
    const drapeMat=material('#d3c6ae',{roughness:1,side:THREE.DoubleSide}),sheerMat=material('#fbf6ec',{roughness:1,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false});
    const drapes=drapeGeometry(440,2290,6,26),sheers=drapeGeometry(420,1460,8,16);
    for(const [z,side] of [[a-260,-1],[b+260,1]]){
        // Drapes stack beside the frame, clear of the sill and the desk's reach.
        const drape=mesh(right,drapes,drapeMat,[w/2-90,1225,z]);drape.rotation.y=-Math.PI/2;drape.name='Pleated linen curtain';
        const sheer=mesh(right,sheers,sheerMat,[w/2-95,low+wh/2+40,z-side*440]);sheer.rotation.y=-Math.PI/2;sheer.castShadow=false;sheer.name='Sheer curtain';
    }
    rod(right,[w/2-90,2410,a-510],[w/2-90,2410,b+510],11,brass);
    for(const z of [a-540,b+540])sphere(right,[24,24,24],[w/2-90,2410,z],brass);
    for(const z of [a-430,b+430])rod(right,[w/2,2410,z],[w/2-90,2410,z],6,brass);
    rod(right,[w/2-95,low+wh+20,a-20],[w/2-95,low+wh+20,b+20],5,brass);
    // Window sill: a trailing pothos, a candle and a pair of paperbacks.
    const sill=new THREE.Group();sill.name='Window sill dressing';right.add(sill);
    const sx=w/2-88;mesh(sill,new THREE.CylinderGeometry(58,44,112,22),terracotta,[sx,906,a+190]);
    leaves(sill,[...Array(14)].map((_,i)=>{const ang=i*2.4,r=i<9?40+i*6:70;return i<9?[sx+Math.cos(ang)*r,985+(i%3)*28,a+190+Math.sin(ang)*r,46,14,30,.5,ang,.4]:[sx-70-(i-9)*6,930-(i-9)*55,a+150+(i%2)*80,32,10,24,1.2,i,.3];}));
    candle(sill,[sx,850,b-170],.9);
    box(sill,[150,30,215],[sx,865,b-400],material('#6f8a7e',{roughness:.8}),3);box(sill,[138,26,200],[sx+4,893,b-395],material('#e5d8bd',{roughness:.85}),3).rotation.y=.18;
    const sunMap=texture((c,tw,th)=>{c.filter='blur(5px)';c.fillStyle='#ffffff';const m=tw*40/ww;c.fillRect(24,24,tw/2-m/2-24,th-48);c.fillRect(tw/2+m/2,24,tw/2-m/2-24,th-48);},512,256);
    const sunGeometry=new THREE.BufferGeometry();sunGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
    sunGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));sunGeometry.setIndex([0,1,2,0,2,3]);
    const sunMat=additive(sunMap);sunMat.side=THREE.DoubleSide;const sunPatch=mesh(root,sunGeometry,sunMat);sunPatch.name='Window sun patch';sunPatch.castShadow=sunPatch.receiveShadow=false;sunPatch.renderOrder=2;fixture(sunPatch,'sun',sunMat,.9);
    const placeSun=f=>{const p=sunGeometry.attributes.position,top=low+wh*(1-f.shade);
        [[a,low],[b,low],[b,top],[a,top]].forEach(([z,y],i)=>{const run=y/f.slope;p.setXYZ(i,Math.max(-w/2+40,w/2-run),6,Math.min(front-40,Math.max(bz+40,z-f.sweep*run)));});
        p.needsUpdate=true;sunGeometry.computeBoundingSphere();sunGeometry.computeBoundingBox();};
    const glowMap=texture((c,tw,th)=>{c.filter='blur(26px)';c.fillStyle='#ffffff';c.fillRect(70,70,tw-140,th-140);},256,256);
    pool(right,[ww+900,wh+500],[w/2-3,low+wh/2,wz],glowMap,'halo',.55,[0,-Math.PI/2,0]).name='Window daylight halo';
    // A brass-rimmed round mirror over the dresser bounces the window light back into the room.
    const looking=group('dresser-mirror','Brass round mirror over the dresser',[w/2-8,1820,front-850],-Math.PI/2,right);
    mesh(looking,new THREE.CylinderGeometry(340,340,14,48),brass,[0,0,7]).rotation.x=Math.PI/2;
    const mirrorMap=texture((c,tw,th)=>{const g=c.createLinearGradient(0,0,tw,th);g.addColorStop(0,'#f1f0ea');g.addColorStop(.5,'#cfd5d3');g.addColorStop(1,'#b7bfbf');c.fillStyle=g;c.fillRect(0,0,tw,th);
        c.filter='blur(6px)';c.fillStyle='rgba(255,252,240,.7)';c.fillRect(tw*.12,th*.18,tw*.22,th*.5);c.fillStyle='rgba(160,150,135,.35)';c.fillRect(0,th*.78,tw,th*.22);c.filter='none';
        c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.moveTo(tw*.55,0);c.lineTo(tw*.75,0);c.lineTo(tw*.3,th);c.lineTo(tw*.1,th);c.fill();},256,256);
    mesh(looking,new THREE.CylinderGeometry(318,318,6,48),material('#ffffff',{map:mirrorMap,metalness:.25,roughness:.1}),[0,0,15]).rotation.x=Math.PI/2;
    room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    for(const [i,[x,z]] of layout.bedside.entries()){
        const nightstand=group('bedside-'+i,'Oak bedside drawer and soft path light',[x,0,z]);
        for(const px of [-145,145])for(const pz of [-150,150])rod(nightstand,[px,0,pz],[px,120,pz],12,oak);
        box(nightstand,[380,400,420],[0,300,0],oak,5);box(nightstand,[410,50,450],[0,525,0],oak,6);
        for(const y of [205,400]){box(nightstand,[335,165,10],[0,y,216],linen,3);rod(nightstand,[-55,y+15,228],[55,y+15,228],5,brass);}
        strip(nightstand,[300,8,8],[0,100,185]);
        candle(nightstand,[-140,550,140]);
    }
    const bench=group('bedroom-bench','Upholstered oak bench at the foot of the bed',[bed[0],0,bz+2480]);
    for(const x of [-520,520])for(const z of [-155,155])rod(bench,[x,0,z],[x,365,z],20,oak);
    box(bench,[1200,55,430],[0,370,0],oak,6);box(bench,[1200,95,440],[0,442.5,0],sage,20);
    // Bench dressing: a folded knit throw and a short stack of books.
    box(bench,[380,46,440],[320,513,0],oatKnit,18);box(bench,[360,30,420],[326,551,6],knit,12).rotation.y=.04;
    box(bench,[230,34,165],[-330,507,-20],material('#556f67',{roughness:.8}),3);box(bench,[210,30,150],[-326,539,-14],material('#c49a6c',{roughness:.85}),3).rotation.y=-.2;
    const wardrobeWidth=tier>=3?2400:tier?1600:1000,wardrobeZ=front-(tier>=3?3200:tier?2450:680);
    const wardrobe=group('wardrobe','Oak wardrobe and linen sliding doors',[-w/2+320,0,wardrobeZ],Math.PI/2);
    box(wardrobe,[wardrobeWidth,2200,30],[0,1100,-270],oak,3);for(const x of [-wardrobeWidth/2+15,wardrobeWidth/2-15])box(wardrobe,[30,2200,570],[x,1100,0],oak);
    box(wardrobe,[wardrobeWidth,80,560],[0,40,0],dark);box(wardrobe,[wardrobeWidth,35,600],[0,2182.5,0],oak);
    // The back faces the open side of the room, so it is finished in fluted oak.
    const reedMap=texture((c,tw,th)=>{for(let x=0;x<tw;x+=16){const g=c.createLinearGradient(x,0,x+16,0);g.addColorStop(0,'#7d6346');g.addColorStop(.3,'#c4a77f');g.addColorStop(.62,'#b08f69');g.addColorStop(1,'#6e553a');c.fillStyle=g;c.fillRect(x,0,16,th);}for(let i=0;i<60;i++){c.strokeStyle=`rgba(80,56,34,${.05+rnd(i)*.08})`;c.beginPath();const x=rnd(i+4)*tw;c.moveTo(x,0);c.lineTo(x+rnd(i)*4,th);c.stroke();}},256,256);
    reedMap.wrapS=reedMap.wrapT=THREE.RepeatWrapping;reedMap.repeat.set(wardrobeWidth/480,4);
    box(wardrobe,[wardrobeWidth-24,2150,6],[0,1100,-288],material('#ffffff',{map:reedMap,roughness:.66}));
    const doors=tier>=3?4:tier?3:2;
    for(let i=0;i<doors;i++){const dw=wardrobeWidth/doors,x=-wardrobeWidth/2+dw*(i+.5);box(wardrobe,[dw-12,2070,22],[x,1110,291],i%2?linen:sage,3);rod(wardrobe,[x+dw*.28,920,310],[x+dw*.28,1220,310],5,brass);}
    strip(wardrobe,[wardrobeWidth-100,10,10],[0,120,300]);
    // Woven storage baskets on top of the wardrobe.
    box(wardrobe,[340,220,300],[-wardrobeWidth/2+250,2310,-20],rattan,16);
    for(const [i,color] of ['#e3d7c0','#8a9a8c','#c79a73'].entries())box(wardrobe,[400-i*20,60,280-i*10],[wardrobeWidth/2-280,2230+i*60,0],material(color,{map:knitMap,roughness:1}),18);
    if(tier){
        const readingRug=group('reading-rug','Woven reading corner rug',[layout.reading[0]+330,0,layout.reading[1]]);
        box(readingRug,[1800,4,1300],[0,2,0],rugMat,4);for(const x of [-935,935])box(readingRug,[70,2,1220],[x,1.5,0],fringeMat);
        // A woven blanket basket beside the reading table, outside every Groove route.
        const basket=group('reading-basket','Woven basket with knit throws',[layout.reading[0]+1400,0,layout.reading[1]+250]);
        mesh(basket,new THREE.CylinderGeometry(170,145,360,28),rattan,[0,180,0]);
        mesh(basket,new THREE.TorusGeometry(166,13,8,28),rattan,[0,360,0]).rotation.x=Math.PI/2;
        mesh(basket,new THREE.CylinderGeometry(78,78,380,20),knit,[-25,420,10]).rotation.set(.18,0,.32);
        mesh(basket,new THREE.CylinderGeometry(64,64,330,20),oatKnit,[48,395,-40]).rotation.set(-.2,0,-.3);
        const shelf=group('reading-shelf','Oak reading ledge and linen books',[-w/2+110,1550,layout.reading[1]-150],Math.PI/2,left);
        box(shelf,[1050,30,200],[0,0,0],oak);for(let i=0;i<7;i++)box(shelf,[35+i%2*10,190+i%3*20,120],[-380+i*65,110,0],i%2?sage:linen,2);
        leaves(shelf,[...Array(10)].map((_,i)=>[300+Math.cos(i*2.4)*50,40+i*18-(i>6?(i-6)*60:0),Math.sin(i*2.4)*40,40,12,26,.6,i*2.4,.4]));
        mesh(shelf,new THREE.CylinderGeometry(55,42,100,20),terracotta,[300,65,0]);
    }
    if(tier>=2){
        const alcove=group('desk-alcove','Oak desk wall ledges and original botanical art',[layout.desk[0],1800,bz+95],0,back);
        box(alcove,[1460,32,180],[0,100,0],oak,3);box(alcove,[1180,32,170],[0,-280,0],oak,3);
        for(let i=0;i<5;i++)box(alcove,[40,200+i%3*20,110],[-520+i*60,222,0],i%2?sage:cream,2);
        const botMap=texture((c,tw,th)=>{c.fillStyle='#e6dec9';c.fillRect(0,0,tw,th);c.strokeStyle='#55766b';c.lineWidth=5;c.beginPath();c.moveTo(tw*.5,th*.9);c.quadraticCurveTo(tw*.3,th*.5,tw*.55,th*.12);c.stroke();c.fillStyle='#7d9481';for(let i=0;i<5;i++){c.beginPath();c.ellipse(tw*(i%2?.37:.57),th*(.24+i*.12),tw*.15,th*.05,i%2?-.6:.5,0,Math.PI*2);c.fill();}},256,384);
        box(alcove,[320,460,15],[320,346,0],brass,3);box(alcove,[280,420,4],[320,346,12],material('#ffffff',{map:botMap}));strip(alcove,[1000,8,8],[0,-306,90]);
        mesh(alcove,new THREE.CylinderGeometry(50,40,95,20),terracotta,[-150,-216,0]);leaves(alcove,[...Array(9)].map((_,i)=>[-150+Math.cos(i*2.4)*36,-150+(i%3)*24,Math.sin(i*2.4)*36,38,12,24,.5,i*2.4,.4]));
        candle(alcove,[480,-264,10],.8);
    } else {
        // Compact rooms: a three-frame gallery over the desk on the same picture line as the bed art.
        const galleryMap=texture((c,tw,th)=>{const pw=tw/3;
            const panel=(i,draw)=>{c.save();c.translate(i*pw,0);c.fillStyle='#f4efe4';c.fillRect(0,0,pw,th);c.beginPath();c.rect(34,34,pw-68,th-68);c.clip();draw(pw,th);c.restore();};
            panel(0,(pw,th)=>{c.fillStyle='#e8dfca';c.fillRect(0,0,pw,th);c.strokeStyle='#55766b';c.lineWidth=5;c.beginPath();c.moveTo(pw*.5,th*.92);c.quadraticCurveTo(pw*.32,th*.5,pw*.56,th*.1);c.stroke();c.fillStyle='#7d9481';for(let i=0;i<6;i++){c.beginPath();c.ellipse(pw*(i%2?.36:.6),th*(.2+i*.11),pw*.15,th*.035,i%2?-.6:.5,0,Math.PI*2);c.fill();}});
            panel(1,(pw,th)=>{c.fillStyle='#ead6bc';c.fillRect(0,0,pw,th);c.fillStyle='#c27b55';c.beginPath();c.moveTo(pw*.2,th*.85);c.lineTo(pw*.2,th*.45);c.arc(pw*.5,th*.45,pw*.3,Math.PI,0);c.lineTo(pw*.8,th*.85);c.fill();c.fillStyle='#e9b77c';c.beginPath();c.arc(pw*.5,th*.3,pw*.12,0,Math.PI*2);c.fill();c.fillStyle='#6f8577';c.fillRect(0,th*.85,pw,th*.15);});
            panel(2,(pw,th)=>{c.fillStyle='#dfe3dc';c.fillRect(0,0,pw,th);c.strokeStyle='#38463f';c.lineWidth=3;c.beginPath();c.moveTo(pw*.1,th*.7);c.lineTo(pw*.35,th*.4);c.lineTo(pw*.5,th*.55);c.lineTo(pw*.7,th*.3);c.lineTo(pw*.9,th*.7);c.stroke();c.beginPath();c.arc(pw*.72,th*.2,pw*.07,0,Math.PI*2);c.stroke();});
        },1024,512);
        const gallery=group('desk-gallery','Gallery of framed prints over the desk',[layout.desk[0],2020,bz+20],0,back);
        for(const [i,x,fw,fh] of [[0,-430,300,410],[1,0,420,540],[2,430,300,410]]){
            const map=galleryMap.clone();map.offset.set(i/3,0);map.repeat.set(1/3,1);map.needsUpdate=true;
            box(gallery,[fw,fh,24],[x,0,0],i===1?oak:dark,3);box(gallery,[fw-40,fh-40,4],[x,0,13],material('#ffffff',{map,roughness:.85}));
        }
    }
    if(tier>=3){
        const vanity=group('dressing-island','Oak dressing island with upholstered stool',[-w/2+1900,0,front-2400]);
        for(const x of [-610,610])for(const z of [-235,235])rod(vanity,[x,0,z],[x,720,z],16,brass);
        box(vanity,[1400,50,650],[0,775,0],oak,5);box(vanity,[1310,160,550],[0,670,0],linen,3);
        for(const x of [-410,0,410]){box(vanity,[390,125,10],[x,670,281],sage,3);sphere(vanity,[9,9,9],[x,680,297],brass);}
        // The stool belongs to this editable furniture group.
        for(const x of [-145,145])for(const z of [535,825])rod(vanity,[x,0,z],[x,390,z],13,oak);
        box(vanity,[400,90,400],[0,425,680],sage,20);
        box(vanity,[420,12,260],[380,806,-60],brass,4);for(const [i,x] of [300,370,440].entries())mesh(vanity,new THREE.CylinderGeometry(24,28,80+i*25,16),glassMat,[x,812+(80+i*25)/2,-60]);
    }
    if(tier===4){
        const retreatRug=group('retreat-rug','Private lounge woven rug',[w/2-1500,0,front-2500]);
        box(retreatRug,[2300,4,2700],[0,2,0],rugMat,4);
        const divider=group('retreat-divider','Oak screen between sleeping and lounge areas',[w/2-1650,0,front-4200]);
        for(const x of [-850,850])box(divider,[80,1800,80],[x,900,0],oak,3);
        box(divider,[1800,60,80],[0,1770,0],oak,3);
        for(let x=-780;x<=780;x+=120)box(divider,[35,1700,45],[x,880,0],oak,3);
        const art2=group('retreat-art','Original landscape over the private lounge',[w/2-30,1850,front-2500],-Math.PI/2,right);
        box(art2,[1500,700,20],[0,0,0],oak,3);box(art2,[1450,650,4],[0,0,14],material('#ffffff',{map:artMap}));
    }
    const ceiling=new THREE.Group();ceiling.name='Bedroom opal and brass pendants';root.add(ceiling);room.ceilingFixture=ceiling;
    const opal=material('#f3eee4',{emissive:'#ffd9a8',emissiveIntensity:.0001,roughness:.5});fixture(null,'pendant',opal,1.4);
    for(const [x,z] of [[bed[0],bed[1]+170],[layout.desk[0],layout.desk[1]]]){
        rod(ceiling,[x,h,z],[x,h-400,z],4,brass);sphere(ceiling,[160,110,160],[x,h-485,z],opal);strip(ceiling,[75,6,75],[x,h-600,z]);
    }
    // Library props: lamp shades get a halo, the bed a knit throw and cushions.
    const throwMat=knit,cushionMats=[material('#b98a5c',{roughness:1}),material('#7d8f7f',{map:knitMap,roughness:1}),material('#e8dcc7',{map:knitMap,roughness:1})];
    room.decorateProp=(object,placement)=>{
        if(placement.id==='kenney-furniture-lamp-round-table')halo(object,[0,.36,0],.62,'lamps',.7);
        else if(placement.id==='kenney-furniture-lamp-round-floor')halo(object,[0,1.55,0],.8,'lamps',.75);
        else if(placement.id==='bed'||placement.id==='bed-2'){
            // Native bed frames: bed-2 has its headboard at +Z, bed at -Z.
            const compact=placement.id==='bed-2',foot=compact?-1:1,top=compact?.5:.462,half=compact?.73:.875,end=compact?.88:.9;
            const z=foot*(end-.31);
            box(object,[half*2,.04,.62],[0,top+.02,z],throwMat,.015);
            for(const x of [-half,half])box(object,[.03,.26,.62],[x,top-.11,z],throwMat,.012);
            for(const [i,x] of [-.36,.36,0].entries()){const c=box(object,i<2?[.44,.42,.13]:[.56,.27,.12],[x,top+(i<2?.21:.14),-foot*(end-(i<2?.3:.45))],cushionMats[i],.05);c.rotation.x=-foot*.32;}
        }
    };
    const lights=[{at:[layout.bedside[0][0],1050,bz+550],power:2.4},{at:[layout.desk[0],h-450,layout.desk[1]],power:3.1,task:true},{at:[tier?layout.reading[0]:bed[0],1500,tier?layout.reading[1]:bed[1]+500],power:2.6},{at:[w/2-600,1700,bz+d*.5],power:2.7,channel:1}].map(spec=>{const light=new THREE.PointLight('#f3d2a2',0,4400*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    const paintSky=(id,mode)=>{const c=skyCanvas.getContext('2d'),S=512,scene=SKY_SCENES[id]||SKY_SCENES.morning,[sx,sy,col,radius,spread]=scene.sun;
        const grad=c.createLinearGradient(0,0,0,S);grad.addColorStop(0,mode.sky[0]);grad.addColorStop(.78,mode.sky[1]);grad.addColorStop(1,mode.sky[1]);c.fillStyle=grad;c.fillRect(0,0,S,S);
        if(scene.stars)for(let i=0;i<110;i++){c.fillStyle=`rgba(235,240,255,${.25+rnd(i)*.6})`;c.fillRect(rnd(i+3)*S,rnd(i+8)*S*.6,rnd(i+1)>.85?2.2:1.3,rnd(i+1)>.85?2.2:1.3);}
        const glowGrad=c.createRadialGradient(sx,sy,0,sx,sy,spread);glowGrad.addColorStop(0,`rgba(${col},.85)`);glowGrad.addColorStop(1,`rgba(${col},0)`);c.fillStyle=glowGrad;c.fillRect(0,0,S,S);
        c.fillStyle=`rgb(${col})`;c.beginPath();c.arc(sx,sy,radius,0,Math.PI*2);c.fill();
        if(scene.stars){c.fillStyle=mode.sky[0];c.beginPath();c.arc(sx+7,sy-4,radius*.92,0,Math.PI*2);c.fill();}
        for(let i=0;i<7;i++){const cx=rnd(i+20)*S,cy=40+rnd(i+30)*180,cw=60+rnd(i+40)*90;c.fillStyle=`rgba(${scene.cloud},${scene.stars?.1:.32})`;for(let j=0;j<4;j++){c.beginPath();c.ellipse(cx+j*cw*.3-cw*.45,cy+(j%2)*6,cw*.38,14+rnd(i+j)*10,0,0,Math.PI*2);c.fill();}}
        c.fillStyle=scene.hills;c.beginPath();c.moveTo(0,S);for(let x=0;x<=S;x+=16)c.lineTo(x,370-Math.sin(x*.012+1)*26-Math.sin(x*.031)*10);c.lineTo(S,S);c.fill();
        // A row of neighbouring rooftops, with lit windows after dusk.
        for(let i=0;i<7;i++){const x=i*80-20+rnd(i+60)*20,bw=60+rnd(i+70)*30,bh=50+rnd(i+80)*50,y=450-bh;c.fillStyle=scene.roofs;c.fillRect(x,y,bw,bh+80);c.beginPath();c.moveTo(x-6,y);c.lineTo(x+bw/2,y-26-rnd(i)*10);c.lineTo(x+bw+6,y);c.fill();
            if(scene.lit)for(let j=0;j<3;j++)if(rnd(i*3+j)>.35){c.fillStyle=`rgba(255,${190+(j*20)},${110+j*20},${scene.lit*(.6+rnd(j+i)*.4)})`;c.fillRect(x+10+j*(bw-24)/3,y+14,10,13);}}
        c.fillStyle=scene.trees;for(let i=0;i<14;i++){c.beginPath();c.arc(i*40,500,46+(i%3)*12+rnd(i)*8,0,Math.PI*2);c.fill();}
        skyMap.needsUpdate=true;};
    room.roomAtmosphere=(id,accent=1)=>{const mode=BEDROOM_MODES[id]||BEDROOM_MODES.morning,f=BEDROOM_FIXTURES[id]||BEDROOM_FIXTURES.morning;current=[BEDROOM_MODES[id]?id:'morning',accent];
        paintSky(current[0],mode);placeSun(f);romanShade.scale.y=Math.max(70,wh*f.shade+70);romanShade.position.y=low+wh-romanShade.scale.y/2+10;shadeMap.repeat.set(1,romanShade.scale.y/880);
        fixtures.forEach(tune);
        glow.forEach(({mat,channel})=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.08+mode.wash*accent;});lights.forEach(spec=>{spec.light.color.set(mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});root.userData.atmosphere=id;};
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [plaster, 'plaster'], [sage, 'powder'], [linen, 'fabric'], [dark, 'powder'], [brass, 'metal'], [oak, 'wood'], [drapeMat, 'fabric']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
