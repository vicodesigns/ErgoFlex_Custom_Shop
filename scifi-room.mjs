import * as THREE from 'three';

const tiers = [
    ['apartment', 'Compact ship quarters', 3800, 4600, 2800],
    ['house', 'Orbital crew workspace', 5200, 6200, 3200],
    ['spacious', 'Deep-space research bay', 6800, 8200, 3600],
    ['premium', 'Exploration command & service bay', 9000, 10600, 4200],
    ['executive', 'Orbital command & robotics hall', 12000, 14000, 5400]
];
export const SCIFI_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1800, front = back + depth;
    const desk = [width / 2 - 900, back + 950];
    const service = [-width / 2 + 420, back + 2150];
    const props = [
        { id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 980], turn: 180 },
        { id: 'space-age-radio', at: [service[0] + 80, 900, service[1] - 300], turn: 90 },
        { id: 'binoculars', at: [service[0] + 70, 900, service[1] + 360], turn: 90 },
        { id: 'robot-dog', at: [-width / 2 + 1150, 0, back + 2350], turn: 25 },
        { id: 'trash-can-futuristic', at: [-width / 2 + 1080, 0, front - 380], turn: 15 }
    ];
    if (tier) for (const z of (tier === 1 ? [back + 3700] : [back + 3700, back + 5300])) props.push({ id: 'kenney-space-template-wall-half', at: [width / 2 - 390, 0, z], turn: -90 });
    if (tier >= 3) props.push(
        { id: 'kenney-space-gate-door-window', at: [-width / 2 + 1800, 0, back + 560] },
        { id: 'kenney-factory-machine-window', at: [-width / 2 + 2200, 0, front - 2300] }
    );
    if (tier === 4) props.push(
        { id: 'kenney-factory-robot-arm-a', at: [0, 0, front - 4100], turn: 90 },
        { id: 'kenney-space-cables', at: [0, 0, front - 4100] }
    );
    return [id, { id, name, width, depth, height, back, tier, desk, service, props,
        daylight: [width / 2 - 100, back + 1600] }];
}));
export const scifiLayoutById = id => SCIFI_LAYOUTS[id] || SCIFI_LAYOUTS.apartment;
export const scifiLayoutForSize = size => SCIFI_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
// `sun` tints the light the viewport throws across the deck and `glare` is its
// strength; `cabin` scales how much of the strip wash the bay lights spill.
export const SCIFI_MODES = {
    morning: { label: 'Morning', description: 'Dawn orbit · standing mission preparation', key: '#ffe9d4', fill: '#9cc3ea', accent: '#73e5ed', power: 1.3, ambient: .42, bounce: .6, exposure: 1.1, practical: .5, wash: .55, colors: ['#7ceaf4', '#b1bbff'], planet: ['#9fd6e8', '#1f5d88'], sun: '#ffc590', glare: .34, cabin: 1, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: true, color: '#5ae9ff', status: 'DAWN WATCH' },
    afternoon: { label: 'Afternoon', description: 'Research operations · seated analysis under clean task light', key: '#f3f8ff', fill: '#b6cdea', accent: '#9af3e6', power: 1.25, ambient: .5, bounce: .7, exposure: 1.14, practical: .9, wash: .5, colors: ['#bff4ff', '#d2dcff'], planet: ['#a8d6ec', '#1d4a80'], sun: '#eaf4ff', glare: .26, cabin: 1, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false, status: 'RESEARCH OPERATIONS' },
    evening: { label: 'Evening', description: 'Deep-space navigation · angled command desk and blue light', key: '#a9c3ea', fill: '#7f99cc', accent: '#7094ff', power: .5, ambient: .25, bounce: .3, exposure: 1.15, practical: .65, wash: .9, colors: ['#68dfff', '#b797ff'], planet: ['#6596bb', '#192451'], sun: '#7ea4ff', glare: .14, cabin: .85, height: 43.5, tilt: 15, offset: [0, 80], yaw: 0, leds: true, color: '#668cff', status: 'NAVIGATION WATCH' },
    night: { label: 'Night', description: 'Quiet watch · low cabin light with illuminated paths', key: '#86a3cb', fill: '#6d86b0', accent: '#74c9e9', power: .12, ambient: .14, bounce: .16, exposure: 1.2, practical: .3, wash: .7, colors: ['#68dfe5', '#827fff'], planet: ['#355e92', '#101c3b'], sun: '#4f78c8', glare: .07, cabin: .3, height: 28, tilt: 0, offset: [0, 110], yaw: 0, leds: true, color: '#56dce8', status: 'NIGHT WATCH' },
    party: { label: 'Hyperdrive', description: 'Hyperspace transit · violet and cyan command lighting', key: '#b2c2f0', fill: '#8c94d4', accent: '#c079ff', power: .38, ambient: .22, bounce: .3, exposure: 1.18, practical: .85, wash: 1.05, colors: ['#61efff', '#d588ff'], planet: ['#ae87e6', '#22245a'], sun: '#b98bff', glare: .22, cabin: .95, height: 43.5, tilt: 0, offset: [-60, 140], yaw: 8, leds: true, color: '#bc74ff', status: 'HYPERDRIVE TRANSIT' }
};

function texture(draw, width=512, height=512) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}
// Seeded jitter keeps every procedural texture identical between rebuilds.
const jitter=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1,7),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};
// Atlas regions in canvas pixels -> UV rectangles (canvas textures are flipped).
const region=(x0,y0,x1,y1,W=1024,H=512)=>[x0/W,1-y1/H,x1/W,1-y0/H];
const SIGN={deck:region(0,0,1024,128),airlock:region(0,128,512,256),oxygen:region(512,128,1024,256),crew1:region(0,256,256,384),crew2:region(256,256,512,384),keypad:region(512,256,768,512),gauges:region(768,256,1024,512),caution:region(0,384,512,512)};
const DECAL={bay:region(0,0,512,256),chevrons:region(512,0,1024,256),hazard:region(0,256,1024,384),dock:region(0,384,512,512),cargo:region(512,384,1024,512)};

// Fine detail is baked per finish: one draw call per material and shadow role,
// not per bolt. Child groups (editable fixtures) are left intact.
function bake(group) {
    const batches=new Map();
    for(const obj of [...group.children]){
        if(!obj.isMesh||obj.isInstancedMesh)continue;
        const key=obj.material.uuid+(obj.castShadow?':cast':'');
        if(!batches.has(key))batches.set(key,[]);batches.get(key).push(obj);
    }
    for(const meshes of batches.values()){
        const pieces=meshes.map(m=>{m.updateMatrix();return (m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix);});
        const geometry=new THREE.BufferGeometry();
        for(const [name,size] of [['position',3],['normal',3],['uv',2]]){
            if(pieces.some(g=>!g.attributes[name]))continue;
            const data=new Float32Array(pieces.reduce((n,g)=>n+g.attributes[name].count*size,0));let offset=0;
            for(const g of pieces){data.set(g.attributes[name].array,offset);offset+=g.attributes[name].count*size;}
            geometry.setAttribute(name,new THREE.BufferAttribute(data,size));
        }
        pieces.forEach(g=>g.dispose());
        const first=meshes[0],merged=new THREE.Mesh(geometry,first.material);
        merged.name=`${group.name} · ${first.material.name||'finish'}`;merged.castShadow=first.castShadow;merged.receiveShadow=true;
        meshes.forEach(m=>{m.geometry.dispose();m.removeFromParent();});group.add(merged);
    }
    return group;
}

export function buildScifiRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width:w, depth:d, height:h, back:bz, tier }=layout,front=bz+d;
    // Two-tone hull: blue-grey composite panels, brushed ribs, gunmetal equipment.
    const hull=material('#465567',{roughness:.56,metalness:.42}),pale=material('#8e9ba7',{roughness:.42,metalness:.62});
    const dark=material('#1b2631',{roughness:.5,metalness:.4}),rubber=material('#121a24',{roughness:.92});
    const orange=material('#c27a3c',{roughness:.6,metalness:.2});
    const trim=material('#aab5bf',{roughness:.3,metalness:.85}),shell=material('#c9d0d6',{roughness:.48,metalness:.12});
    const red=material('#b4372f',{roughness:.45,metalness:.15}),green=material('#3c8a5c',{roughness:.5}),cable=material('#2c6886',{roughness:.55});
    const visor=material('#c99b4c',{roughness:.12,metalness:1}),paint=material('#c3cdc9',{roughness:.85});
    const portGlass=material('#0d2233',{emissive:'#2a7aa0',emissiveIntensity:.45,roughness:.1,metalness:.5});
    const leds=['#47ff9c','#ffb84d','#ff5454'].map(c=>material(c,{emissive:c,emissiveIntensity:1.2}));
    const glowMats=[0,1].map(()=>material('#75eafa',{emissive:'#75eafa',emissiveIntensity:.55}));
    const panelMap=texture((c,tw,th)=>{
        const g=c.createLinearGradient(0,0,0,th);g.addColorStop(0,'#4b5b6d');g.addColorStop(.58,'#3f4d5c');g.addColorStop(1,'#333f4c');c.fillStyle=g;c.fillRect(0,0,tw,th);
        for(let i=0;i<420;i++){c.fillStyle=jitter(i)>.5?`rgba(255,255,255,${.015+jitter(i+7)*.03})`:`rgba(0,0,0,${.03+jitter(i+7)*.05})`;c.fillRect(jitter(i+1)*tw,jitter(i+2)*th,2+jitter(i+3)*18,1+jitter(i+4)*5);}
        const seam=(x,y,sw,sh)=>{c.strokeStyle='#121a24';c.lineWidth=5;c.strokeRect(x,y,sw,sh);c.strokeStyle='rgba(170,192,212,.38)';c.lineWidth=1.5;c.strokeRect(x+4,y+4,sw-8,sh-8);};
        seam(8,8,tw-16,th-16);seam(28,28,tw-56,th*.6-34);seam(28,th*.6+16,tw-56,th*.4-44);
        c.fillStyle='#5b6c80';c.fillRect(28,th*.6-8,tw-56,16);c.fillStyle='rgba(220,235,250,.25)';c.fillRect(28,th*.6-8,tw-56,2);
        for(let i=0;i<11;i++){c.fillStyle='#141d28';c.fillRect(78+i*33,th*.84,17,70);c.fillStyle='rgba(170,190,210,.3)';c.fillRect(78+i*33,th*.84+68,17,2);}
        c.fillStyle='rgba(200,218,232,.32)';c.font='bold 13px monospace';c.fillText('PNL 04-B · 220V',48,th*.6+48);
        c.fillStyle='#c9a640';c.fillRect(tw-118,th*.6+38,70,20);c.fillStyle='#1c2128';for(let i=0;i<5;i++){c.beginPath();c.moveTo(tw-118+i*16,th*.6+58);c.lineTo(tw-108+i*16,th*.6+38);c.lineTo(tw-100+i*16,th*.6+38);c.lineTo(tw-110+i*16,th*.6+58);c.fill();}
        c.fillStyle='#8d9aa5';for(const x of [24,tw-24])for(const y of [24,th*.6,th-24]){c.beginPath();c.arc(x,y,4.5,0,7);c.fill();}
    },512,1024);
    // Deck plating: 1 m plates, diamond tread in a checkerboard, worn bevels and bolts.
    const floorMap=texture((c,tw)=>{
        c.fillStyle='#29333e';c.fillRect(0,0,tw,tw);const half=tw/2;
        for(const [px,py,tread] of [[0,0,1],[half,0,0],[0,half,0],[half,half,1]]){
            c.fillStyle=tread?'#323d49':'#3a4654';c.fillRect(px+4,py+4,half-8,half-8);
            if(tread){c.fillStyle='rgba(140,160,182,.26)';for(let y=py+16,r=0;y<py+half-12;y+=15,r++)for(let x=px+16+(r%2)*7;x<px+half-12;x+=15){c.save();c.translate(x,y);c.rotate((r+Math.round(x/15))%2?.62:-.62);c.fillRect(-5,-1.4,10,2.8);c.restore();}}
            else for(let i=0;i<26;i++){c.fillStyle=`rgba(255,255,255,${.015+jitter(px+py+i)*.025})`;c.fillRect(px+10,py+12+i*9.3,half-20,1);}
            c.strokeStyle='#10161d';c.lineWidth=6;c.strokeRect(px+3,py+3,half-6,half-6);c.strokeStyle='rgba(175,195,215,.28)';c.lineWidth=1.5;c.strokeRect(px+8,py+8,half-16,half-16);
            c.fillStyle='#7b8894';for(const x of [px+18,px+half-18])for(const y of [py+18,py+half-18]){c.beginPath();c.arc(x,y,3.5,0,7);c.fill();}
        }
        for(let i=0;i<260;i++){c.fillStyle=`rgba(0,0,0,${.04+jitter(i+90)*.07})`;c.beginPath();c.ellipse(jitter(i+91)*tw,jitter(i+92)*tw,3+jitter(i+93)*16,1+jitter(i+94)*4,jitter(i)*3,0,7);c.fill();}
    });
    floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(w/2000,d/2000);
    box(root,[w,35,d],[0,-17.5,bz+d/2],material('#ffffff',{map:floorMap,roughness:.6,metalness:.32}));
    // Signage atlas: lit lettering on dark plates, one texture and one draw call per owner.
    const signMap=texture((c)=>{
        c.fillStyle='#0b121b';c.fillRect(0,0,1024,512);c.textBaseline='middle';
        const plate=(x,y,pw,ph,bg,edge)=>{c.fillStyle=bg;c.fillRect(x+3,y+3,pw-6,ph-6);c.strokeStyle=edge;c.lineWidth=3;c.strokeRect(x+9,y+9,pw-18,ph-18);};
        plate(0,0,1024,128,'#0c1520','#3f5a70');c.fillStyle='#dff6ff';c.font='600 54px sans-serif';c.fillText('ORBITAL DECK 04',44,66);c.fillStyle='#7fd8e8';c.font='500 26px sans-serif';c.fillText('ERGOFLEX STATION · BAY C',590,50);c.fillText('PRESSURISED · 101.3 kPa',590,88);
        plate(0,128,512,128,'#0c1520','#3f5a70');c.fillStyle='#dff6ff';c.font='600 52px sans-serif';c.fillText('AIRLOCK 02',120,194);c.strokeStyle='#ffc457';c.lineWidth=6;c.beginPath();c.arc(64,192,30,0,7);c.stroke();c.beginPath();c.moveTo(64,166);c.lineTo(64,218);c.stroke();
        plate(512,128,512,128,'#4d0f0f','#e25b4f');c.fillStyle='#ffe6e1';c.font='600 46px sans-serif';c.fillText('EMERGENCY O₂',600,194);c.fillStyle='#ffe6e1';c.fillRect(552,174,14,40);c.fillRect(539,187,40,14);
        for(const [x,t] of [[0,'CREW 01'],[256,'CREW 02']]){plate(x,256,256,128,'#0c1520','#3f5a70');c.fillStyle='#dff6ff';c.font='600 40px sans-serif';c.fillText(t,x+40,306);c.fillStyle='#7fd8e8';c.font='22px monospace';c.fillText(x?'MED · EVA':'NAV · EVA',x+40,350);}
        plate(512,256,256,256,'#0a1119','#334a5c');
        for(let r=0;r<4;r++)for(let k=0;k<3;k++){const x=544+k*66,y=300+r*50;c.fillStyle=r===3&&k===2?'#2f9c64':r===3&&k===0?'#a8402f':'#1e2c3a';c.fillRect(x,y,56,40);c.fillStyle='#cfe6f2';c.font='600 22px monospace';c.fillText(r===3?['×','0','✓'][k]:String(r*3+k+1),x+20,y+21);}
        c.fillStyle='#7fe7f2';c.fillRect(544,272,190,16);
        plate(768,256,256,256,'#0a1119','#334a5c');
        for(const [x,y,v,col] of [[830,330,.72,'#6be7f4'],[960,330,.45,'#ffc457'],[830,440,.88,'#6bf4a8'],[960,440,.3,'#ff7a6b']]){c.lineWidth=10;c.strokeStyle='#1d2b39';c.beginPath();c.arc(x,y,40,Math.PI*.75,Math.PI*2.25);c.stroke();c.strokeStyle=col;c.beginPath();c.arc(x,y,40,Math.PI*.75,Math.PI*(.75+1.5*v));c.stroke();}
        plate(0,384,512,128,'#d3a536','#1b1f24');c.fillStyle='#14171c';c.font='700 38px sans-serif';c.fillText('CAUTION',40,430);c.font='600 24px sans-serif';c.fillText('CYCLE BEFORE ENTRY · CHECK SUIT SEALS',40,476);
    },1024,512);
    const signMat=material('#ffffff',{map:signMap,emissive:'#ffffff',emissiveMap:signMap,emissiveIntensity:.6,roughness:.35});
    // Painted deck stencils, scuffed, with alpha so the plating shows through.
    const decalMap=texture((c)=>{
        c.clearRect(0,0,1024,512);c.textBaseline='middle';c.textAlign='center';c.fillStyle='rgba(214,224,228,.9)';
        c.font='800 150px sans-serif';c.fillText('BAY 04',256,132);
        c.fillStyle='rgba(120,226,240,.85)';for(let i=0;i<3;i++){const y=60+i*62;c.beginPath();c.moveTo(640,y+60);c.lineTo(768,y);c.lineTo(896,y+60);c.lineTo(896,y+86);c.lineTo(768,y+26);c.lineTo(640,y+86);c.fill();}
        c.fillStyle='#d9ab32';c.fillRect(0,264,1024,112);c.fillStyle='#16191e';for(let x=-120;x<1100;x+=80){c.beginPath();c.moveTo(x,376);c.lineTo(x+40,376);c.lineTo(x+152,264);c.lineTo(x+112,264);c.fill();}
        c.fillStyle='rgba(214,224,228,.9)';c.font='800 92px sans-serif';c.fillText('DOCK 01',256,452);
        c.font='700 52px monospace';c.fillText('CARGO 7A · 480 KG',768,430);c.font='500 30px monospace';c.fillText('HANDLE IN ZERO-G',768,480);c.textAlign='left';
        c.globalCompositeOperation='destination-out';for(let i=0;i<1600;i++){c.fillStyle=`rgba(0,0,0,${.25+jitter(i+300)*.6})`;c.beginPath();c.arc(jitter(i+301)*1024,jitter(i+302)*512,1+jitter(i+303)*4.5,0,7);c.fill();}c.globalCompositeOperation='source-over';
    },1024,512);
    const decalMat=material('#ffffff',{map:decalMap,transparent:true,depthWrite:false,roughness:.75,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const atlas=(parent,size,uvs,mat,at,rot=[0,0,0])=>{
        const geometry=new THREE.PlaneGeometry(...size),uv=geometry.attributes.uv;
        for(let i=0;i<uv.count;i++)uv.setXY(i,uvs[0]+uv.getX(i)*(uvs[2]-uvs[0]),uvs[1]+uv.getY(i)*(uvs[3]-uvs[1]));
        const o=mesh(parent,geometry,mat,at);o.rotation.set(...rot);o.castShadow=false;return o;
    };
    // Detail is authored in a local frame (x along the surface, z outward), then
    // re-parented flat onto its owner so it bakes with the rest of that owner.
    const frame=(parent,at,turn,build)=>{
        const f=new THREE.Group();f.position.set(...at);f.rotation.set(...turn);parent.add(f);build(f);
        parent.updateWorldMatrix(true,true);const meshes=[];f.traverse(o=>{if(o.isMesh)meshes.push(o);});
        meshes.forEach(o=>{parent.attach(o);o.castShadow=false;});f.removeFromParent();
    };
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`scifi:${layout.id}:fixture:${id}`});return g;};
    const strip=(parent,size,at,channel=0)=>{const o=box(parent,size,at,glowMats[channel],2);o.castShadow=false;return o;};
    // Kick plinth and chamfered ceiling cornice shared by every bulkhead.
    const bulkhead=(f,length,gaps=[])=>{
        let x=-length/2;for(const [g0,g1] of [...gaps,[length/2,length/2]]){if(g0-x>40)box(f,[g0-x,130,80],[(x+g0)/2,65,40],dark);x=g1;}
        const lip=box(f,[length,255,22],[0,h-102,120],pale);lip.rotation.x=Math.PI/4;
        box(f,[length,16,40],[0,h-198,22],dark);
    };
    const back=new THREE.Group();back.name='Sci-fi bay reinforced rear bulkhead';root.add(back);box(back,[w,h,100],[0,h/2,bz-50],hull);
    const columns=Math.floor(w/1000),pw=w/columns,panelMat=material('#ffffff',{map:panelMap,roughness:.58,metalness:.35});
    for(let i=0;i<columns;i++){const x=-w/2+pw*(i+.5);box(back,[pw-35,h-280,30],[x,h/2,bz+17],panelMat,4);box(back,[35,h,65],[x-pw/2+18,h/2,bz+32],pale,3);}
    strip(back,[w-120,18,18],[0,180,bz+55]);strip(back,[w-120,20,20],[0,h-200,bz+55],1);room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    const left=new THREE.Group();left.name='Sci-fi bay service bulkhead';root.add(left);box(left,[100,h,d],[-w/2-50,h/2,bz+d/2],hull);
    for(let z=bz+250;z<front-200;z+=1400){box(left,[65,h,55],[-w/2+32,h/2,z],pale,3);const length=Math.min(1100,front-z-70);strip(left,[16,18,length],[-w/2+62,180,z+length/2]);}
    room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
    const right=new THREE.Group();right.name='Sci-fi bay orbital observation wall';root.add(right);
    const wz=bz+1600,ww=tier?2200:1700,low=850,wh=tier?1750:1550,a=wz-ww/2,b=wz+ww/2;
    box(right,[100,h,a-bz],[w/2+50,h/2,(a+bz)/2],hull);box(right,[100,h,front-b],[w/2+50,h/2,(front+b)/2],hull);box(right,[100,low,ww],[w/2+50,low/2,wz],hull);box(right,[100,h-low-wh,ww],[w/2+50,(h+low+wh)/2,wz],hull);
    const orbitCanvas=document.createElement('canvas');orbitCanvas.width=1024;orbitCanvas.height=768;const orbitMap=new THREE.CanvasTexture(orbitCanvas);orbitMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(right,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:orbitMap}),[w/2+65,low+wh/2,wz]);pane.rotation.y=-Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,b])box(right,[150,wh+120,70],[w/2-10,low+wh/2,z],pale,10);for(const y of [low,low+wh])box(right,[150,70,ww+120],[w/2-10,y,wz],pale,10);
    strip(right,[18,12,ww-60],[w/2-90,low+30,wz]);strip(right,[18,12,d-200],[w/2-60,180,bz+d/2],1);room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    // Viewport: chamfered corners, bolted frame, faint glass reflection and the
    // pool of planet-light it throws across the deck.
    for(const [z,sz] of [[a,1],[b,-1]])for(const [y,sy] of [[low,1],[low+wh,-1]]){const g=box(right,[140,180,180],[w/2-16,y+sy*55,z+sz*55],pale,6);g.rotation.x=Math.PI/4;}
    for(const z of [a,b])for(let y=low+110;y<low+wh-60;y+=190)rod(right,[w/2-94,y,z],[w/2-82,y,z],8,trim);
    for(const y of [low,low+wh])for(let z=a+120;z<b-60;z+=190)rod(right,[w/2-94,y,z],[w/2-82,y,z],8,trim);
    const glassMap=texture((c,tw,th)=>{c.clearRect(0,0,tw,th);for(const [x0,width,alpha] of [[.12,.1,.22],[.27,.035,.16],[.62,.16,.12],[.82,.04,.14]]){const g=c.createLinearGradient(tw*x0,0,tw*(x0+width),0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(255,255,255,${alpha})`);g.addColorStop(1,'rgba(255,255,255,0)');c.save();c.transform(1,0,-.45,1,th*.25,0);c.fillStyle=g;c.fillRect(0,0,tw,th);c.restore();}},256,256);
    const glassMat=new THREE.MeshBasicMaterial({map:glassMap,transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false});
    const glass=mesh(right,new THREE.PlaneGeometry(ww,wh),glassMat,[w/2+30,low+wh/2,wz]);glass.rotation.y=-Math.PI/2;glass.castShadow=false;
    const poolMap=texture((c,tw,th)=>{const g=c.createLinearGradient(0,0,tw,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.55,'rgba(255,255,255,.55)');g.addColorStop(.86,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,.35)');c.fillStyle=g;c.fillRect(0,0,tw,th);
        c.globalCompositeOperation='destination-in';const v=c.createLinearGradient(0,0,0,th);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.2,'rgba(0,0,0,1)');v.addColorStop(.8,'rgba(0,0,0,1)');v.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=v;c.fillRect(0,0,tw,th);},256,256);
    const poolMat=new THREE.MeshBasicMaterial({map:poolMap,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false});
    const pool=mesh(right,new THREE.PlaneGeometry(1800,ww*1.1),poolMat,[w/2-960,4,wz+140]);pool.rotation.x=-Math.PI/2;pool.castShadow=pool.receiveShadow=false;
    frame(right,[w/2,low-110,wz],[0,-Math.PI/2,0],f=>{
        box(f,[ww-280,140,72],[0,0,36],dark,8);
        const top=new THREE.Group();top.position.set(0,72,40);top.rotation.x=.45;f.add(top);box(top,[ww-300,12,72],[0,0,0],hull,4);
        for(let i=0,n=Math.floor((ww-420)/80);i<n;i++)for(const z of [-16,16]){const x=-(n-1)*40+i*80,lit=(i*7+(z>0?3:0))%5;box(top,[44,10,20],[x,7,z],lit===0?leds[0]:lit===2?glowMats[0]:lit===4?leds[1]:rubber);}
    });
    // Freely editable mission console and equipment bench.
    const lockerAt=tier?[-w/2+390,0,front-750]:[-w/2+535,0,bz+420],cw=tier?1600:1300,ch=tier?1050:860;
    const consoleX=tier>=3?-w/2+4800:tier?-w/2+1050:lockerAt[0]+450+40+cw/2;
    const console=group('mission-console','Mission navigation display',[consoleX,1900,bz+90],0,back);
    const screenCanvas=document.createElement('canvas');screenCanvas.width=1024;screenCanvas.height=640;const screenMap=new THREE.CanvasTexture(screenCanvas);screenMap.colorSpace=THREE.SRGBColorSpace;
    box(console,[cw,ch,85],[0,0,0],dark,12);box(console,[cw-110,ch-130,6],[0,0,47],new THREE.MeshBasicMaterial({map:screenMap}));strip(console,[cw-160,10,10],[0,-ch/2+45,53]);
    for(const sx of [-1,1]){strip(console,[10,ch-260,10],[sx*(cw/2+16),0,20],1);for(const sy of [-1,1]){const g=box(console,[90,90,95],[sx*(cw/2-12),sy*(ch/2-12),0],pale,4);g.rotation.z=Math.PI/4;}}
    box(console,[cw*.55,36,70],[0,-ch/2-14,10],pale,6);for(let i=0;i<4;i++)box(console,[12,12,6],[-cw*.25+i*28,-ch/2-14,47],leds[i%2?1:0]);
    const service=group('service-counter','Equipment console and storage',[layout.service[0],0,layout.service[1]],Math.PI/2);
    box(service,[1760,90,640],[0,45,0],dark,5);box(service,[1760,730,680],[0,455,0],hull,6);box(service,[1880,80,780],[0,860,0],pale,8);strip(service,[1680,8,6],[0,72,322]);
    for(const x of [-570,0,570]){box(service,[525,620,14],[x,480,349],dark,3);rod(service,[x-70,650,365],[x+70,650,365],8,pale);
        for(let j=0;j<4;j++)box(service,[300,9,6],[x,300+j*24,358],rubber);box(service,[120,36,4],[x-150,740,357],shell);box(service,[14,14,5],[x+200,740,358],leds[x?0:1]);}
    strip(service,[1690,8,12],[0,810,379]);
    // Telemetry riser, slanted control deck and a holo projector on the counter.
    const teleCanvas=document.createElement('canvas');teleCanvas.width=1024;teleCanvas.height=256;const teleMap=new THREE.CanvasTexture(teleCanvas);teleMap.colorSpace=THREE.SRGBColorSpace;
    box(service,[1780,340,90],[0,1070,-340],dark,6);mesh(service,new THREE.PlaneGeometry(1200,300),new THREE.MeshBasicMaterial({map:teleMap}),[-180,1072,-294]).castShadow=false;
    box(service,[1800,30,130],[0,1255,-330],pale,6);strip(service,[1650,8,10],[0,1238,-280],1);
    for(const x of [-855,855])box(service,[40,320,40],[x,1070,-290],pale,4);
    // The cutaway exposes the service side: access hatches, vents and wall feeds.
    for(const x of [-440,440]){box(service,[760,560,10],[x,470,-343],hull,4);for(let j=0;j<6;j++)box(service,[420,12,6],[x,300+j*30,-350],rubber);atlas(service,[300,75],SIGN.caution,signMat,[x+120,640,-349],[0,Math.PI,0]);for(const sx of [-1,1])for(const y of [215,725])rod(service,[x+sx*350,y,-348],[x+sx*350,y,-354],9,trim);}
    for(const [x,r,mat] of [[-760,22,cable],[-700,16,orange],[720,22,cable]])mesh(service,new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,860,-345),new THREE.Vector3(x+30,500,-372),new THREE.Vector3(x,120,-380),new THREE.Vector3(x-20,12,-370)]),16,r,6),mat).castShadow=false;for(let i=0;i<6;i++)box(service,[90,22,10],[650,980+i*36,-293],rubber);
    frame(service,[650,935,30],[.32,0,0],f=>{box(f,[400,70,300],[0,0,0],dark,8);atlas(f,[180,180],SIGN.keypad,signMat,[-80,36,0],[-Math.PI/2,0,0]);atlas(f,[150,150],SIGN.gauges,signMat,[105,36,0],[-Math.PI/2,0,0]);});
    const holoMat=new THREE.MeshBasicMaterial({color:'#7ceaf4',transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    const wireMat=new THREE.MeshBasicMaterial({color:'#7ceaf4',wireframe:true,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false});
    mesh(service,new THREE.CylinderGeometry(105,120,50,24),dark,[-700,925,30]);const emitter=mesh(service,new THREE.TorusGeometry(78,7,8,32),glowMats[0],[-700,952,30]);emitter.rotation.x=Math.PI/2;
    mesh(service,new THREE.CylinderGeometry(150,60,250,24,1,true),holoMat,[-700,1080,30]).castShadow=false;mesh(service,new THREE.SphereGeometry(92,18,12),wireMat,[-700,1135,30]).castShadow=false;mesh(service,new THREE.SphereGeometry(38,16,10),holoMat,[-700,1135,30]).castShadow=false;
    const lockers=group('crew-lockers','Crew storage and charging lockers',lockerAt,tier?Math.PI/2:0);
    box(lockers,[900,1900,700],[0,950,0],dark,8);box(lockers,[912,60,712],[0,30,0],rubber,4);box(lockers,[940,60,740],[0,1930,0],pale,8);
    for(let i=0;i<2;i++){const x=-220+i*440;box(lockers,[415,1750,18],[x,980,359],hull,5);rod(lockers,[x+130,800,376],[x+130,1080,376],8,pale);strip(lockers,[290,12,10],[x,1730,379],1);for(let j=0;j<5;j++)box(lockers,[210,12,8],[x,1420-j*32,373],rubber);
        atlas(lockers,[220,110],i?SIGN.crew2:SIGN.crew1,signMat,[x,1580,369]);box(lockers,[16,16,6],[x+150,1240,370],leds[i]);strip(lockers,[120,40,6],[x-90,640,369]);for(let j=0;j<3;j++)box(lockers,[260,10,6],[x,320-j*26,370],rubber);}
    for(const sx of [-1,1])for(const z of [-170,170])box(lockers,[12,1700,40],[sx*456,960,z],pale,3);
    // A suit helmet and coiled umbilical are stowed on top.
    sphere(lockers,[150,160,165],[-150,2110,0],shell);sphere(lockers,[118,92,72],[-150,2130,118],visor);
    const neck=mesh(lockers,new THREE.TorusGeometry(118,22,10,32),trim,[-150,1984,0]);neck.rotation.x=Math.PI/2;for(const sx of [-1,1])sphere(lockers,[22,22,22],[-150+sx*148,2120,0],leds[sx>0?1:0]);
    for(const [r,y] of [[95,1974],[78,1998]]){const coil=mesh(lockers,new THREE.TorusGeometry(r,13,8,28),cable,[190,y,40]);coil.rotation.x=Math.PI/2;}
    const airlock=group('crew-airlock','Crew access hatch',[w/2-120,0,front-950],-Math.PI/2,right);
    box(airlock,[1350,2450,90],[0,1225,0],dark,20);for(const x of [-635,635])box(airlock,[80,2450,125],[x,1225,0],pale,12);box(airlock,[1200,2280,30],[0,1190,65],hull,12);
    box(airlock,[20,2280,10],[0,1190,85],dark);for(const x of [-110,110])rod(airlock,[x,1040,100],[x,1370,100],12,pale);strip(airlock,[1050,12,10],[0,2290,89]);
    for(let i=0;i<7;i++){const mark=box(airlock,[85,42,5],[-520+i*170,75,80],orange);mark.rotation.z=-.5;}
    box(airlock,[1350,120,150],[0,2390,30],pale,8);atlas(airlock,[600,150],SIGN.airlock,signMat,[0,2390,106]);
    for(const y of [620,1780])box(airlock,[1120,26,12],[0,y,86],pale,3);
    for(const x of [-300,300]){mesh(airlock,new THREE.CircleGeometry(112,32),portGlass,[x,1620,81]);mesh(airlock,new THREE.TorusGeometry(115,16,10,32),pale,[x,1620,88]);}
    for(const x of [-635,635])atlas(airlock,[2300,70],DECAL.hazard,decalMat,[x,1190,63.5],[0,0,Math.PI/2]);
    box(airlock,[170,290,170],[790,1260,-35],dark,6);atlas(airlock,[130,130],SIGN.keypad,signMat,[790,1240,51]);box(airlock,[16,16,6],[790,1365,52],leds[0]);box(airlock,[320,95,130],[790,1500,-55],dark,4);atlas(airlock,[300,75],SIGN.caution,signMat,[790,1500,11]);
    if(tier!==1){
        box(airlock,[300,640,140],[-900,1150,-50],red,4);box(airlock,[260,600,10],[-900,1150,25],dark,3);box(airlock,[300,90,140],[-900,1545,-50],red,4);atlas(airlock,[280,70],SIGN.oxygen,signMat,[-900,1545,21]);
        rod(airlock,[-960,880,105],[-960,1260,105],62,red);box(airlock,[60,70,60],[-960,1290,105],trim,6);rod(airlock,[-960,1320,105],[-920,1360,160],10,rubber);
        rod(airlock,[-830,900,95],[-830,1230,95],48,shell);rod(airlock,[-830,1150,95],[-830,1190,95],50,green);box(airlock,[40,50,40],[-830,1255,95],trim,4);
        for(const y of [960,1180])box(airlock,[250,22,24],[-895,y,150],pale,3);
    }
    // Paths remain flat so the desk can explore the full room floor.
    const paths=group('floor-paths','Cyan floor navigation and landing marks');
    for(const x of [-w/2+120,w/2-120])strip(paths,[12,4,d-280],[x,2,bz+d/2]);
    const run=tier?1800:1000,runZ=bz+d*.55;
    for(const x of [-400,400])strip(paths,[12,4,run],[x,2,runZ],1);
    for(const x of [-400,400])atlas(paths,[200,100],DECAL.chevrons,decalMat,[x,3,runZ-run/2-130],[-Math.PI/2,0,0]);
    atlas(paths,[800,400],DECAL.bay,decalMat,[tier?0:350,3,front-(tier?1100:650)],[-Math.PI/2,0,0]);
    atlas(paths,[1200,140],DECAL.hazard,decalMat,[w/2-300,3,front-950],[-Math.PI/2,0,Math.PI/2]);
    // Painted docking-pad corners mark the desk's home berth.
    const [dx,dz]=layout.desk,hx=Math.min(900,w/2-dx-140),hz=540;
    for(const sx of [-1,1])for(const sz of [-1,1]){box(paths,[240,3,26],[dx+sx*(hx-120),1.5,dz+sz*hz],paint);box(paths,[26,3,240],[dx+sx*hx,1.5,dz+sz*(hz-120)],paint);}
    atlas(paths,[480,120],DECAL.dock,decalMat,[dx-hx+260,3,dz+hz+90],[-Math.PI/2,0,0]);
    // Hard-shell cargo cases stowed against the service bulkhead.
    const cargo=group('cargo-cases','Stowed cargo cases',[-w/2+340,0,tier?front-1620:front-420],Math.PI/2);
    const cases=tier?[[0,0,760,440,520,0],[20,440,560,320,420,.22],[620,0,380,520,380,-.12]]:[[0,0,760,440,520,0],[20,440,560,320,420,.22]];
    for(const [x,y,cw2,chh,cd,turn] of cases)frame(cargo,[x,y,0],[0,turn,0],f=>{
        box(f,[cw2-20,chh,cd-20],[0,chh/2,0],shell,10);box(f,[cw2,24,cd],[0,chh*.72,0],rubber,4);
        for(const sx of [-1,1])for(const sz of [-1,1])box(f,[60,chh,60],[sx*(cw2/2-30),chh/2,sz*(cd/2-30)],dark,6);
        for(const sx of [-1,1])box(f,[60,46,16],[sx*cw2*.26,chh*.72,cd/2-2],orange,4);rod(f,[-cw2*.18,chh*.45,cd/2+8],[cw2*.18,chh*.45,cd/2+8],9,trim);
        atlas(f,[cw2*.6,cw2*.15],DECAL.cargo,decalMat,[0,chh*.22,cd/2-9]);
    });
    cargo.traverse(o=>{if(o.isMesh&&o.material!==decalMat)o.castShadow=true;});
    // Rear bulkhead services: trims, piping with flanges and a drop valve,
    // drooping cable runs, junction boxes and the deck sign above the desk.
    const consoleSpan=[consoleX-cw/2-160,consoleX+cw/2+160];
    frame(back,[0,0,bz],[0,0,0],f=>{
        bulkhead(f,w);
        const y1=h-300,y2=h-240,x0=-w/2+80,x1=w/2-150,brackets=[];
        rod(f,[x0,y1,118],[x1,y1,118],34,trim);rod(f,[x0,y2,92],[x1-80,y2,92],18,cable);sphere(f,[40,40,40],[x1,y1,118],trim);rod(f,[x1,y1,118],[x1,150,118],34,trim);rod(f,[x1,130,118],[x1,180,118],50,pale);
        for(let x=x0+420;x<x1-100;x+=1100){brackets.push(x);rod(f,[x-24,y1,118],[x+24,y1,118],46,pale);box(f,[36,40,70],[x,y1,62],dark);rod(f,[x-14,y2,92],[x+14,y2,92],26,pale);}
        const vy=560;box(f,[110,130,110],[x1,vy,118],pale,8);rod(f,[x1,vy,175],[x1,vy,205],10,trim);
        const wheel=mesh(f,new THREE.TorusGeometry(80,9,8,24),red,[x1,vy,210]);wheel.castShadow=false;rod(f,[x1-80,vy,210],[x1+80,vy,210],6,red);rod(f,[x1,vy-80,210],[x1,vy+80,210],6,red);
        for(let i=0;i<brackets.length-1;i++){const p=brackets[i],q=brackets[i+1];if(q>consoleSpan[0]&&p<consoleSpan[1])continue;
            for(const [sag,z,r,mat] of [[150,140,10,cable],[95,128,8,rubber]])mesh(f,new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(p,y1-30,z),new THREE.Vector3((p+q)/2,y1-30-sag,z+10),new THREE.Vector3(q,y1-30,z)]),18,r,6),mat);}
        for(let i=1;i<columns;i++){const px=-w/2+pw*i;if(Math.abs(px-layout.desk[0])<950||(px>consoleSpan[0]&&px<consoleSpan[1]))continue;
            box(f,[130,200,46],[px,1150,88],dark,4);for(let j=0;j<3;j++)box(f,[14,14,6],[px-35+j*35,1215,113],leds[j]);box(f,[90,24,6],[px,1110,113],shell);rod(f,[px,1250,80],[px,y1-34,80],11,pale);}
        const sx=Math.max(Math.min(layout.desk[0]+60,w/2-800),tier?-w:consoleX+cw/2+640);box(f,[1160,180,24],[sx,h-560,80],dark,6);atlas(f,[1120,140],SIGN.deck,signMat,[sx,h-560,93]);for(const x of [-430,430])box(f,[40,60,40],[sx+x,h-560,50],pale);
    });
    frame(left,[-w/2,0,bz+d/2],[0,Math.PI/2,0],f=>bulkhead(f,d));
    frame(right,[w/2,0,bz+d/2],[0,-Math.PI/2,0],f=>{const z0=front-950-(bz+d/2);bulkhead(f,d,[[z0-690,z0+690]]);});
    if(tier>=2){
        const core=group('research-core','Shielded research core',[-w/2+1150,0,bz+d*.58]);
        mesh(core,new THREE.CylinderGeometry(510,510,140,12),dark,[0,70,0]);mesh(core,new THREE.CylinderGeometry(390,390,1720,16),hull,[0,1000,0]);
        for(const y of [250,1850,2100])mesh(core,new THREE.CylinderGeometry(470,470,90,16),pale,[0,y,0]);
        for(let i=0;i<6;i++){const angle=i*Math.PI/3,x=Math.cos(angle)*410,z=Math.sin(angle)*410;rod(core,[x,180,z],[x,2110,z],25,dark);strip(core,[18,1400,18],[x,1030,z]);}
        sphere(core,[220,290,220],[0,2080,0],material('#6ddfe6',{emissive:'#6ddfe6',emissiveIntensity:.45,roughness:.3}));
        for(const y of [720,1380])mesh(core,new THREE.CylinderGeometry(396,396,46,16,1,true),glowMats[1],[0,y,0]).castShadow=false;
        for(let i=0;i<12;i++){const angle=(i+.5)*Math.PI/6;mesh(core,new THREE.CylinderGeometry(16,16,14,8),trim,[Math.cos(angle)*470,147,Math.sin(angle)*470]);}
        atlas(core,[240,60],SIGN.caution,signMat,[0,520,397]);
    }
    if(tier>=3){
        const table=group('tactical-table','Orbital tactical projection table',[w/2-2000,0,front-2300]);
        mesh(table,new THREE.CylinderGeometry(450,570,140,6),dark,[0,70,0]);mesh(table,new THREE.CylinderGeometry(280,420,680,6),hull,[0,480,0]);mesh(table,new THREE.CylinderGeometry(750,750,110,6),pale,[0,875,0]);
        mesh(table,new THREE.CylinderGeometry(660,660,8,6),rubber,[0,934,0]);for(let i=0;i<6;i++){const angle=i*Math.PI/3;strip(table,[24,8,24],[Math.cos(angle)*560,942,Math.sin(angle)*560]);}
        const globeMap=texture((c,tw,th)=>{c.fillStyle='#254f79';c.fillRect(0,0,tw,th);c.fillStyle='#78c7c4';for(let i=0;i<14;i++){c.beginPath();c.ellipse((i*127.1)%tw,(i*81.3)%th,30+i%3*15,20+i%4*8,i,0,7);c.fill();}c.strokeStyle='#addfe0';for(let y=0;y<th;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(tw,y);c.stroke();}});
        sphere(table,[240,240,240],[0,1350,0],material('#ffffff',{map:globeMap,emissive:'#469fbb',emissiveIntensity:.25,roughness:.4}));
        for(const y of [990,1060]){const ring=mesh(table,new THREE.TorusGeometry(330,7,8,48),material('#8dedff',{emissive:'#8dedff',emissiveIntensity:.6}),[0,y,0]);ring.rotation.x=Math.PI/2;}
        mesh(table,new THREE.CylinderGeometry(330,560,420,6,1,true),holoMat,[0,1150,0]).castShadow=false;
        const bay=group('fabrication-floor','Service bay markings',[-w/2+2200,0,front-2300]);
        for(const x of [-1150,1150])strip(bay,[12,4,2800],[x,2,0],1);for(const z of [-1400,1400])strip(bay,[2300,4,12],[0,2,z],1);
        for(const z of [-1250,1250])atlas(bay,[2200,120],DECAL.hazard,decalMat,[0,3,z],[-Math.PI/2,0,0]);
    }
    if(tier===4){
        const cradle=group('cargo-cradle','Robotics payload cradle',[1800,0,front-4100]);
        box(cradle,[1100,120,1250],[0,60,0],dark,8);box(cradle,[1000,850,1150],[0,545,0],hull,8);for(const x of [-410,410])box(cradle,[70,910,1200],[x,555,0],orange,3);strip(cradle,[850,18,10],[0,760,583],1);
        atlas(cradle,[600,150],DECAL.cargo,decalMat,[0,380,576]);
        const overhead=group('robotics-marker','Robotics maintenance beacon',[0,0,front-4100]);
        box(overhead,[1800,4,1800],[0,2,0],rubber,5);for(const x of [-880,880])strip(overhead,[12,6,1760],[x,7,0]);
        for(const z of [-800,800])atlas(overhead,[1700,110],DECAL.hazard,decalMat,[0,5,z],[-Math.PI/2,0,0]);
    }
    const ceiling=new THREE.Group();ceiling.name='Sci-fi bay overhead gantry lights';root.add(ceiling);room.ceilingFixture=ceiling;
    for(let z=bz+800;z<front-400;z+=2000){box(ceiling,[w-180,80,130],[0,h-100,z],dark,8);for(const x of [-w*.28,w*.28])strip(ceiling,[w*.22,12,85],[x,h-147,z]);for(const x of [-w/2+150,w/2-150])box(ceiling,[120,160,170],[x,h-90,z],pale,6);}
    const lights=[{at:[layout.desk[0],h-450,layout.desk[1]],power:3.6,task:true},{at:[-w/2+1150,2000,bz+2000],power:3.5},{at:[-w/2+1150,2200,bz+d*.58],power:4.5},{at:[w/2-900,2100,front-1700],power:4.5,channel:1}].map(spec=>{const light=new THREE.PointLight('#75eafa',0,5000*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    for(const g of [back,left,right,console,service,lockers,airlock,paths,cargo,ceiling,...root.children.filter(o=>['research-core','tactical-table','fabrication-floor','cargo-cradle','robotics-marker'].includes(o.userData.propId))])bake(g);
    // Viewport: star field, nebula and the planet lit for the watch; hyperspace in transit.
    const drawOrbit=(id,mode)=>{
        const c=orbitCanvas.getContext('2d'),W=1024,H=768,k=(wh/H)/(ww/W);
        c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';
        const space=c.createLinearGradient(0,0,W,H);space.addColorStop(0,'#02050d');space.addColorStop(1,id==='party'?'#12062a':'#071331');c.fillStyle=space;c.fillRect(0,0,W,H);
        for(let i=0;i<5;i++){const x=jitter(i+40)*W,y=jitter(i+50)*H*.7,r=180+jitter(i+60)*300,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(mode.colors[i%2],id==='party'?.22:.12));g.addColorStop(1,rgba(mode.colors[i%2],0));c.fillStyle=g;c.fillRect(0,0,W,H);}
        if(id==='party'){
            const vx=W*.46,vy=H*.44;
            for(let i=0;i<520;i++){const angle=jitter(i)*Math.PI*2,r0=30+jitter(i+1)*260,len=40+r0*(.5+jitter(i+2)),x0=vx+Math.cos(angle)*r0,y0=vy+Math.sin(angle)*r0/k,x1=vx+Math.cos(angle)*(r0+len),y1=vy+Math.sin(angle)*(r0+len)/k;
                const g=c.createLinearGradient(x0,y0,x1,y1),col=i%3?mode.colors[i%2]:'#ffffff';g.addColorStop(0,rgba(col,0));g.addColorStop(1,rgba(col,.9));c.strokeStyle=g;c.lineWidth=1+jitter(i+3)*2.2;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();}
            const core=c.createRadialGradient(vx,vy,0,vx,vy,240);core.addColorStop(0,'rgba(255,255,255,.95)');core.addColorStop(.12,rgba(mode.colors[0],.7));core.addColorStop(.45,rgba(mode.colors[1],.25));core.addColorStop(1,rgba(mode.colors[1],0));c.fillStyle=core;c.fillRect(0,0,W,H);
            c.strokeStyle=rgba(mode.colors[1],.18);c.lineWidth=3;for(let i=1;i<6;i++){c.beginPath();c.ellipse(vx,vy,i*i*26,i*i*26/k,0,0,7);c.stroke();}
            return;
        }
        for(let i=0;i<620;i++){const x=jitter(i+500)*W,y=jitter(i+900)*H,s=jitter(i+1300),band=Math.abs((y-H*.15)-(x*.35))<120;c.fillStyle=s>.93?'#fff4d6':s>.7?'#cfe2ff':'#9fb7da';c.globalAlpha=(band?.9:.55)*(.35+s*.65);c.fillRect(x,y,s>.96?2.6:s>.75?1.8:1.1,s>.96?2.6:s>.75?1.8:1.1);}
        c.globalAlpha=1;
        const [lit,sunAngle]={morning:[.18,-2.55],afternoon:[.8,-2.3],evening:[.45,-.6],night:[.04,-2.7]}[id]||[.5,-2.4];
        // Physical circles on a stretched canvas: draw in a y-scaled frame.
        c.setTransform(1,0,0,1/k,0,0);
        const cx=760,cy=850*k,R=470,sx=Math.cos(sunAngle),sy=Math.sin(sunAngle);
        // moon and a distant station
        const mx=210,my=170*k,moon=c.createRadialGradient(mx+sx*14,my+sy*14,4,mx,my,34);moon.addColorStop(0,'#e7ecf2');moon.addColorStop(.7,'#8d97a5');moon.addColorStop(1,'#2a3140');c.fillStyle=moon;c.beginPath();c.arc(mx,my,34,0,7);c.fill();
        c.fillStyle='#1a2230';c.fillRect(392,232*k-3,60,6);c.fillRect(419,232*k-14,6,28);c.fillStyle='#41536d';c.fillRect(372,232*k-9,18,18);c.fillRect(454,232*k-9,18,18);c.fillStyle='#ff6a5c';c.fillRect(420,232*k-18,3,3);
        c.save();c.beginPath();c.arc(cx,cy,R,0,7);c.clip();
        const base=c.createLinearGradient(cx,cy-R,cx,cy+R);base.addColorStop(0,mode.planet[0]);base.addColorStop(1,mode.planet[1]);c.fillStyle=base;c.fillRect(cx-R,cy-R,R*2,R*2);
        c.filter='blur(14px)';for(let i=0;i<22;i++){c.fillStyle=rgba(i%3?'#2f7a6a':'#556b3f',.28);c.beginPath();c.ellipse(cx-R+jitter(i+70)*R*2,cy-R+jitter(i+80)*R*1.2,60+jitter(i+90)*150,14+jitter(i+95)*40,-.15+jitter(i+99)*.3,0,7);c.fill();}c.filter='none';
        c.filter='blur(5px)';c.fillStyle='rgba(240,248,255,.22)';for(let i=0;i<30;i++){const y=cy-R+jitter(i+120)*R*1.4,x=cx-R+jitter(i+130)*R*2;c.beginPath();c.ellipse(x,y,70+jitter(i+140)*180,6+jitter(i+150)*12,-.12+jitter(i+160)*.1,0,7);c.fill();}c.filter='none';
        // Terminator: the night side falls away from the sun across the disk.
        const night=c.createLinearGradient(cx+sx*R,cy+sy*R,cx-sx*R,cy-sy*R);night.addColorStop(0,'rgba(2,5,14,0)');night.addColorStop(Math.min(.95,lit*.9),'rgba(2,5,14,0)');night.addColorStop(Math.min(1,lit*.9+.3),'rgba(2,5,14,.93)');night.addColorStop(1,'rgba(2,5,14,.97)');c.fillStyle=night;c.fillRect(cx-R,cy-R,R*2,R*2);
        for(let i=0;i<320;i++){const ang=jitter(i+200)*Math.PI*2,rr=Math.sqrt(jitter(i+210))*R*.96,x=cx+Math.cos(ang)*rr,y=cy+Math.sin(ang)*rr,t=(1-((x-cx)*sx+(y-cy)*sy)/R)/2;if(t<lit*.9+.25)continue;c.fillStyle=`rgba(255,${190+Math.round(jitter(i)*50)},120,${.35+jitter(i+220)*.5})`;c.fillRect(x,y,1.6+jitter(i+230),1.6+jitter(i+230));}
        const limb=c.createRadialGradient(cx,cy,R*.82,cx,cy,R);limb.addColorStop(0,'rgba(0,0,0,0)');limb.addColorStop(1,rgba(mode.colors[0],.35));c.fillStyle=limb;c.fillRect(cx-R,cy-R,R*2,R*2);
        c.restore();
        c.shadowColor=mode.colors[0];c.shadowBlur=28;c.strokeStyle=rgba(mode.colors[0],.9);c.lineWidth=6;c.beginPath();c.arc(cx,cy,R+3,sunAngle-.9-lit,sunAngle+.9+lit);c.stroke();
        c.shadowBlur=60;c.strokeStyle=rgba(mode.colors[0],.25);c.lineWidth=22;c.beginPath();c.arc(cx,cy,R+14,sunAngle-.7-lit,sunAngle+.7+lit);c.stroke();c.shadowBlur=0;
        if(id!=='night'){const px=cx+sx*(R+(id==='morning'?6:240)),py=cy+sy*(R+(id==='morning'?6:240)),sun=c.createRadialGradient(px,py,0,px,py,id==='morning'?260:340);sun.addColorStop(0,'rgba(255,255,255,1)');sun.addColorStop(.06,rgba(mode.sun,.95));sun.addColorStop(.3,rgba(mode.sun,.28));sun.addColorStop(1,rgba(mode.sun,0));c.fillStyle=sun;c.fillRect(0,0,W,H*k);
            c.strokeStyle=rgba(mode.sun,.35);c.lineWidth=2;c.beginPath();c.moveTo(px-140,py+18);c.lineTo(px+140,py-18);c.stroke();}
        c.setTransform(1,0,0,1,0,0);
    };
    const drawScreen=mode=>{
        const s=screenCanvas.getContext('2d');s.fillStyle='#06111d';s.fillRect(0,0,1024,640);
        s.strokeStyle='#0f2436';s.lineWidth=1;for(let x=0;x<1024;x+=32){s.beginPath();s.moveTo(x,90);s.lineTo(x,640);s.stroke();}for(let y=90;y<640;y+=32){s.beginPath();s.moveTo(0,y);s.lineTo(1024,y);s.stroke();}
        s.fillStyle='#0d2033';s.fillRect(0,0,1024,88);s.fillStyle=mode.colors[0];s.fillRect(0,86,1024,3);s.font='600 40px sans-serif';s.fillText(mode.status,40,56);s.font='20px monospace';s.fillStyle='#9fc4da';s.fillText('ERGOFLEX / ORBITAL SYSTEMS',720,40);s.fillText('T+ 04:12:36  ORBIT 2,417',720,68);
        const g=s.createRadialGradient(290,350,10,310,370,95);g.addColorStop(0,mode.planet[0]);g.addColorStop(1,mode.planet[1]);s.fillStyle=g;s.beginPath();s.arc(305,365,85,0,7);s.fill();
        s.strokeStyle=mode.colors[0];s.lineWidth=2;s.setLineDash([8,8]);for(const [rx,ry] of [[170,120],[240,175]]){s.beginPath();s.ellipse(305,365,rx,ry,-.25,0,7);s.stroke();}s.setLineDash([]);
        s.strokeStyle=mode.colors[1];s.lineWidth=4;s.beginPath();s.ellipse(305,365,240,175,-.25,Math.PI*1.2,Math.PI*1.75);s.stroke();s.fillStyle=mode.colors[1];s.beginPath();s.moveTo(470,215);s.lineTo(492,232);s.lineTo(466,240);s.fill();
        s.strokeStyle='#dff6ff';s.lineWidth=2;s.beginPath();s.arc(150,250,14,0,7);s.moveTo(130,250);s.lineTo(170,250);s.moveTo(150,230);s.lineTo(150,270);s.stroke();
        s.font='20px monospace';const rows=[['O₂',.92],['HULL',.98],['POWER',.76],['NAV LOCK',.64],['COMMS',.83]];
        rows.forEach(([label,v],i)=>{const y=150+i*70;s.fillStyle='#9fc4da';s.fillText(label,630,y-8);s.fillText(Math.round(v*100)+'%',900,y-8);s.fillStyle='#14283b';s.fillRect(630,y,330,26);s.fillStyle=mode.colors[i%2];s.fillRect(630,y,330*v,26);});
        s.strokeStyle=mode.colors[0];s.lineWidth=2.5;s.beginPath();for(let x=0;x<=960;x+=8){const y=590-Math.sin(x*.035)*14-Math.sin(x*.11)*7;x?s.lineTo(40+x,y):s.moveTo(40,y);}s.stroke();
        screenMap.needsUpdate=true;
        const t=teleCanvas.getContext('2d');t.fillStyle='#071320';t.fillRect(0,0,1024,256);t.strokeStyle='#14304a';t.lineWidth=2;for(const x of [340,680])t.strokeRect(x-330,14,320,228);t.strokeRect(690,14,320,228);
        t.font='18px monospace';t.fillStyle='#9fc4da';t.fillText('SAMPLE 07 · SPECTRAL',26,40);t.fillText('BAY POWER',366,40);t.fillText('SYSTEMS',706,40);
        t.strokeStyle=mode.colors[0];t.lineWidth=3;t.beginPath();for(let x=0;x<=290;x+=5){const y=150-Math.exp(-((x-150)**2)/600)*80-Math.sin(x*.2)*8;x?t.lineTo(26+x,y):t.moveTo(26,y);}t.stroke();
        for(let i=0;i<10;i++){const v=.3+jitter(i+500)*.65;t.fillStyle=mode.colors[i%2];t.fillRect(372+i*29,226-v*160,20,v*160);}
        ['LIFE SUPPORT','THERMAL','GRAVITY','SHIELDS','DOCK CLAMP'].forEach((label,i)=>{t.fillStyle=i===4?'#ffc457':'#47ff9c';t.beginPath();t.arc(716,74+i*36,7,0,7);t.fill();t.fillStyle='#cfe6f2';t.fillText(label,734,80+i*36);});
        teleMap.needsUpdate=true;
    };
    room.roomAtmosphere=(id,accent=1)=>{
        const mode=SCIFI_MODES[id]||SCIFI_MODES.morning;
        drawOrbit(id,mode);orbitMap.needsUpdate=true;drawScreen(mode);
        glowMats.forEach((mat,channel)=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.15+mode.wash*accent;});
        signMat.emissiveIntensity=(.3+mode.wash*.55)*accent;leds.forEach(mat=>{mat.emissiveIntensity=(.7+(1.4-mode.power)*.6)*accent;});portGlass.emissive.set(mode.colors[0]);portGlass.emissiveIntensity=.12+mode.wash*.25;
        holoMat.color.set(mode.colors[0]);wireMat.color.set(mode.colors[id==='party'?1:0]);holoMat.opacity=.1+mode.wash*.08;
        glassMat.opacity=.25+mode.glare*.8;poolMat.color.set(mode.sun);poolMat.opacity=mode.glare;
        lights.forEach(spec=>{spec.light.color.set(mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash*mode.cabin)*accent;});root.userData.atmosphere=id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[hull, 'metal'], [pale, 'metal'], [trim, 'metal'], [dark, 'powder'], [rubber, 'rubber'], [orange, 'powder'], [shell, 'powder'], [red, 'powder'], [green, 'powder'], [cable, 'rubber']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
