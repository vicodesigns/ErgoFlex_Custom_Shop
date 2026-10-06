import * as THREE from 'three';

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
export const WORKSHOP_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing planning and measurement', key: '#fff2de', fill: '#dcecf2', accent: '#d6e1dd', power: 1.65, ambient: .48, bounce: .65, exposure: 1.04, sky: ['#9ec6de', '#eee1c3'], practical: .45, wash: .25, colors: ['#e4f3f5', '#74b4b2'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Build & assemble · level desk at bench height', key: '#fff5e5', fill: '#deebf2', accent: '#d9c7ab', power: 1.4, ambient: .46, bounce: .6, exposure: 1.05, sky: ['#b4cddd', '#ece5d6'], practical: .65, wash: .4, colors: ['#ebf5ed', '#c99d64'], height: 36, tilt: 0, offset: [80, 100], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Detail work · focused task lights and warm wood', key: '#ead4b5', fill: '#cbdde9', accent: '#efb96c', power: .7, ambient: .32, bounce: .45, exposure: 1.12, sky: ['#828ca8', '#d8ad8e'], practical: .9, wash: .7, colors: ['#ffdda8', '#7bb8bc'], height: 28, tilt: 12, offset: [0, 150], yaw: 0, leds: true, color: '#ffdda8' },
    night: { label: 'Night', description: 'Quiet prototyping · cool bench lights and low ambient glow', key: '#c5d9ec', fill: '#c4d5e4', accent: '#86b5c8', power: .3, ambient: .25, bounce: .34, exposure: 1.16, sky: ['#263b53', '#496076'], practical: .7, wash: .75, colors: ['#c5e9ef', '#71b6c1'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#92d9e5' },
    party: { label: 'Open workshop', description: 'Show your projects · desk turned for a demonstration', key: '#e6e1d1', fill: '#d0e0e9', accent: '#e3aa68', power: .85, ambient: .4, bounce: .5, exposure: 1.1, sky: ['#7b96ad', '#d6ba91'], practical: 1, wash: 1, colors: ['#f5cc8c', '#77bec0'], height: 43.5, tilt: -5, offset: [100, 250], yaw: -12, leds: true, color: '#ffbd70' }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

export function buildWorkshopRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier } = layout, front = bz + d;
    const plaster = material('#bbbcb4', { roughness: .95 }), steel = material('#34474b', { metalness: .5, roughness: .48 });
    const silver = material('#a8b2b4', { metalness: .75, roughness: .35 }), orange = material('#d58b45', { roughness: .7 });
    const teal = material('#508884', { roughness: .75 }), rubber = material('#293335', { roughness: .95 });
    const woodMap = texture((c, tw, th) => { c.fillStyle='#b59366';c.fillRect(0,0,tw,th);c.strokeStyle='#71543435';for(let i=0;i<120;i++){const x=i*4.8;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+12,th*.3,x-8,th*.7,x+2,th);c.stroke();} });
    const ply = material('#ffffff', { map: woodMap, roughness: .8 });
    const floorMap = texture((c,tw,th)=>{c.fillStyle='#858b88';c.fillRect(0,0,tw,th);for(let i=0;i<2200;i++){c.fillStyle=i%3?'#e2e0cf20':'#29363630';c.fillRect(i*53.73%tw,i*29.61%th,2+i%3,2);}c.strokeStyle='#687370';c.lineWidth=2;c.strokeRect(0,0,tw,th);});
    floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(w/1200,d/1200);
    box(root,[w,30,d],[0,-15,bz+d/2],material('#ffffff',{map:floorMap,roughness:.92}));
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`workshop:${layout.id}:fixture:${id}`});return g;};
    const glow=[];
    const strip=(parent,size,at,channel=0)=>{const mat=material('#d8eef0',{emissive:'#d8eef0',emissiveIntensity:.3});const o=box(parent,size,at,mat,2);o.castShadow=false;glow.push({mat,channel});return o;};
    const label=(parent,text,size,at,color='#e3e6d7')=>{const map=texture((c,tw,th)=>{c.fillStyle='#26383d';c.fillRect(0,0,tw,th);c.fillStyle=color;c.font='bold 42px sans-serif';c.textAlign='center';c.fillText(text,tw/2,th*.65);},1024,128);return box(parent,[...size,5],at,material('#ffffff',{map,roughness:.8}));};
    const back=new THREE.Group();back.name='Workshop tool and bench wall';root.add(back);
    box(back,[w,h,80],[0,h/2,bz-40],plaster);box(back,[w,160,24],[0,80,bz+12],steel);room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    const pegMap=texture((c,tw,th)=>{c.fillStyle='#ae936a';c.fillRect(0,0,tw,th);c.fillStyle='#4b5149';for(let x=16;x<tw;x+=32)for(let y=16;y<th;y+=32){c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();}});
    pegMap.wrapS=pegMap.wrapT=THREE.RepeatWrapping;pegMap.repeat.set((w-200)/800,1.3);
    box(back,[w-160,1030,25],[0,1550,bz+12.5],material('#ffffff',{map:pegMap,roughness:.9}));
    label(back,'MAKE / REPAIR / REPEAT',[Math.min(w-240,3400),150],[0,h-200,bz+45]);
    const right=new THREE.Group();right.name='Workshop machines and storage wall';root.add(right);box(right,[80,h,d],[w/2+40,h/2,bz+d/2],plaster);box(right,[20,160,d],[w/2-10,80,bz+d/2],steel);room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    const left=new THREE.Group();left.name='Workshop daylight and materials wall';root.add(left);
    const wz=bz+2400,ww=tier?1900:1400,low=1050,wh=1200,a=wz-ww/2,b=wz+ww/2;
    box(left,[80,h,a-bz],[-w/2-40,h/2,(a+bz)/2],plaster);box(left,[80,h,front-b],[-w/2-40,h/2,(front+b)/2],plaster);box(left,[80,low,ww],[-w/2-40,low/2,wz],plaster);box(left,[80,h-low-wh,ww],[-w/2-40,(h+low+wh)/2,wz],plaster);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(left,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[-w/2-52,low+wh/2,wz]);pane.rotation.y=Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(left,[65,wh+50,30],[-w/2+10,low+wh/2,z],steel);for(const y of [low,low+wh])box(left,[65,30,ww+60],[-w/2+10,y,wz],steel);box(left,[170,30,ww+80],[-w/2+50,low-15,wz],ply);
    room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});

    const plans=group('project-board','Workshop project drawings and build checklist',[w/2-30,1800,bz+d*.52],-Math.PI/2,right);
    const planMap=texture((c,tw,th)=>{
        c.fillStyle='#d8ded4';c.fillRect(0,0,tw,th);c.fillStyle='#2b555b';c.font='bold 40px sans-serif';c.fillText('IN THE MAKING',38,65);
        c.strokeStyle='#668c8e';c.lineWidth=2;for(let x=35;x<tw*.59;x+=38){c.beginPath();c.moveTo(x,100);c.lineTo(x,th-40);c.stroke();}for(let y=100;y<th-35;y+=38){c.beginPath();c.moveTo(35,y);c.lineTo(tw*.58,y);c.stroke();}
        c.strokeStyle='#315a60';c.lineWidth=5;c.strokeRect(85,145,390,210);c.strokeRect(140,198,280,105);c.beginPath();c.moveTo(85,145);c.lineTo(140,198);c.moveTo(475,145);c.lineTo(420,198);c.moveTo(85,355);c.lineTo(140,303);c.moveTo(475,355);c.lineTo(420,303);c.stroke();
        c.font='27px sans-serif';['01  MEASURE','02  MAKE','03  REFINE','04  SHARE'].forEach((text,i)=>{c.strokeRect(650,142+i*63,22,22);c.fillText(text,695,163+i*63);});
        c.fillStyle='#b77e43';c.fillRect(38,th-32,tw-76,7);
    },1024,512);
    box(plans,[tier?1800:1200,670,18],[0,0,0],steel,4);box(plans,[tier?1740:1140,610,4],[0,0,12],material('#ffffff',{map:planMap,roughness:.9}));
    for(const z of [bz+90,front-80])rod(right,[w/2-25,180,z],[w/2-25,h-170,z],12,silver);
    rod(right,[w/2-25,h-170,bz+90],[w/2-25,h-170,front-80],12,silver);

    const bench=group('bench-run','Plywood workbench with drawers and tool wall',[0,0,bz+390]);
    box(bench,[w-150,65,730],[0,867.5,0],ply,5);
    const bays=Math.ceil((w-200)/900),bw=(w-200)/bays;
    for(let i=0;i<bays;i++){
        const x=-(w-200)/2+bw*(i+.5);
        box(bench,[bw-16,740,580],[x,430,-20],i%2?steel:teal,3);
        box(bench,[bw-75,95,500],[x,47.5,-20],rubber);
        for(const y of [215,390,565,740]){box(bench,[bw-45,155,15],[x,y,280],i%2?steel:teal,3);rod(bench,[x-80,y+20,297],[x+80,y+20,297],5,silver);}
    }
    strip(bench,[w-230,12,12],[0,1190,-280]);
    // Hanging hand tools use simple original geometry over the pegboard.
    for(let i=0;i<8;i++){
        const x=-w/2+190+i*100;
        rod(bench,[x,1100,-342],[x,1350-i%3*35,-342],8,i%2?orange:steel);
        if(i%2)box(bench,[65,25,22],[x,1360-i%3*35,-342],silver,3);
        else {const ring=mesh(bench,new THREE.TorusGeometry(17,5,6,14),silver,[x,1360-i%3*35,-340]);ring.rotation.x=0;}
    }
    const vise=group('bench-vise','Cast-iron bench vise',[-w/2+2200,900,bz+620]);
    box(vise,[150,40,170],[0,20,0],steel,4);box(vise,[120,90,130],[0,85,-30],steel,5);
    for(const z of [-60,45])box(vise,[180,40,30],[0,150,z],silver,2);
    rod(vise,[-110,95,85],[110,95,85],9,silver);rod(vise,[110,35,85],[110,155,85],6,orange);
    for(let i=0;i<3;i++)box(bench,[180,110,240],[w/2-400-i*240,955,-170],teal,4);
    // Clear floor lane and an anti-fatigue mat beside the moving desk.
    box(root,[tier?1900:1600,5,1550],[layout.desk[0],2.5,layout.desk[1]],rubber,18);
    for(const s of [-1,1])box(root,[12,2,1550],[layout.desk[0]+s*(tier?950:800),6,layout.desk[1]],orange);

    const materials=group('materials-rack','Upright plywood and timber storage',[-w/2+230,0,front-(tier>=2?2150:620)],Math.PI/2);
    box(materials,[900,70,400],[0,35,0],steel,3);
    for(const x of [-440,440]){rod(materials,[x,70,-160],[x,1750,-160],16,steel);rod(materials,[x,70,180],[x,170,-160],12,steel);}
    for(let i=0;i<5;i++){const panel=box(materials,[600-i*70,1450+i*45,22],[i*35-80,800+i*22,-70+i*35],ply);panel.rotation.x=-.055;}
    for(let i=0;i<5;i++)box(materials,[35,1400-i*120,35],[320+i*12,750-i*60,80],ply);

    const printer=group('desktop-printer','Open-frame prototype printer',[0,900,bz+350]);
    box(printer,[350,70,330],[0,35,0],rubber,6);box(printer,[290,18,260],[0,79,0],silver,3);
    for(const x of [-150,150])box(printer,[25,360,25],[x,245,-115],steel);
    box(printer,[330,25,25],[0,420,-115],steel);rod(printer,[-150,250,-105],[150,250,-105],8,silver);
    box(printer,[45,70,60],[10,242,-75],orange,4);rod(printer,[10,205,-60],[10,148,-60],4,silver);
    mesh(printer,new THREE.CylinderGeometry(70,70,35,24),teal,[0,485,-100]).rotation.x=Math.PI/2;
    box(printer,[100,65,100],[0,120,0],teal,8);

    if(tier>=2){
        const assembly=group('assembly-island','Assembly table and cutting station',[500,0,bz+4500]);
        box(assembly,[2000,70,1100],[0,865,0],ply,5);
        for(const x of [-870,870])for(const z of [-420,420])box(assembly,[70,830,70],[x,415,z],steel,3);
        box(assembly,[1840,35,850],[0,220,0],ply,3);
        for(let i=0;i<4;i++)box(assembly,[470,90,360],[-650+i*430,282.5,0],teal,4);
        label(assembly,'02 / ASSEMBLY',[1200,110],[0,730,556]);
        const cart=group('clamp-cart','Rolling clamp and jig rack',[-w/2+430,0,bz+3650]);
        for(const x of [-280,280])for(const z of [-180,180])sphere(cart,[45,45,20],[x,45,z],rubber);
        box(cart,[680,50,460],[0,100,0],steel,3);for(const x of [-280,280])box(cart,[40,1050,40],[x,650,0],steel);
        rod(cart,[-290,1100,0],[290,1100,0],20,steel);
        for(let i=0;i<6;i++){const x=-220+i*85;rod(cart,[x,180,40],[x,1000,40],9,silver);box(cart,[50,40,90],[x,880,65],orange,3);box(cart,[50,40,90],[x,240,65],orange,3);}
    }
    if(tier>=3){
        const cnc=group('cnc-router','Enclosed CNC routing and prototype bay',[w/2-1000,0,bz+3950]);
        box(cnc,[1650,780,1350],[0,390,0],steel,5);box(cnc,[1750,80,1450],[0,820,0],silver,4);
        for(let i=0;i<10;i++)box(cnc,[1500,25,20],[0,875,-570+i*125],rubber);
        for(const x of [-740,740])box(cnc,[60,520,60],[x,1140,0],steel);
        box(cnc,[1540,80,100],[0,1360,0],orange,4);box(cnc,[120,200,130],[180,1260,55],steel,5);rod(cnc,[180,1160,55],[180,1030,55],15,silver);
        box(cnc,[550,25,350],[0,905,0],ply,3);
        for(const x of [-800,800])for(const z of [-630,630])rod(cnc,[x,860,z],[x,1540,z],12,silver);
        for(const z of [-630,630])rod(cnc,[-800,1540,z],[800,1540,z],12,silver);
        const glazing=material('#b5dce0',{transparent:true,opacity:.12,depthWrite:false,roughness:.2});
        box(cnc,[1580,650,6],[0,1210,636],glazing);
        label(cnc,'03 / PROTOTYPE',[1100,120],[0,570,681]);
        const storage=group('parts-storage','Hardware bins and labelled parts cabinet',[-w/2+330,0,bz+5500],Math.PI/2);
        box(storage,[1500,2100,40],[0,1050,-240],steel,3);
        for(const x of [-720,720])box(storage,[40,2100,500],[x,1050,0],steel);
        for(const y of [30,500,1000,1500,2050])box(storage,[1460,30,500],[0,y,0],ply);
        for(let row=0;row<4;row++)for(let col=0;col<6;col++){const x=-580+col*230,y=140+row*500;box(storage,[205,180,350],[x,y,0],row%2?orange:teal,6);box(storage,[110,35,4],[x,y+25,178],plaster);}
    }
    if(tier===4){
        const laser=group('laser-bay','Laser cutting and finishing station',[300,0,front-1550]);
        box(laser,[1900,800,1100],[0,400,0],steel,6);box(laser,[2000,70,1200],[0,835,0],ply,5);
        box(laser,[1300,330,820],[0,1035,0],teal,6);box(laser,[1120,12,660],[0,1212,-10],rubber,8);
        for(let i=0;i<12;i++)box(laser,[1050,12,12],[0,1225,-285+i*50],silver);
        box(laser,[1250,80,35],[0,1120,430],orange,5);label(laser,'04 / FINISH & PRESENT',[1250,120],[0,610,558]);
        const samples=group('project-samples','Finished timber joinery and project display',[w/2-350,0,front-4000],-Math.PI/2);
        for(const x of [-700,700])box(samples,[60,1800,60],[x,900,-220],steel);
        for(const y of [100,650,1250,1770])box(samples,[1500,35,500],[0,y,0],ply);
        for(let i=0;i<5;i++){box(samples,[180,260,180],[-560+i*280,1427.5,0],ply,4);box(samples,[190,10,190],[-560+i*280,1562.5,0],orange,2);}
    }
    const ceiling=new THREE.Group();ceiling.name='Workshop linear task-light grid';root.add(ceiling);room.ceilingFixture=ceiling;
    for(const x of [-w*.25,w*.25])for(const z of [bz+d*.28,bz+d*.72]){
        rod(ceiling,[x,h,z-400],[x,h-200,z-400],3,silver);rod(ceiling,[x,h,z+400],[x,h-200,z+400],3,silver);
        box(ceiling,[110,50,1100],[x,h-220,z],steel,4);strip(ceiling,[80,8,1050],[x,h-250,z]);
    }
    const lights=[
        {at:[0,1680,bz+600],power:4.4,task:true},
        {at:[layout.desk[0],h-450,layout.desk[1]],power:4.2,task:true},
        {at:[tier>=2?500:0,h-450,bz+d*.7],power:4,task:true},
        {at:[w/2-700,1850,bz+d*.4],power:3.1,channel:1}
    ].map(spec=>{const light=new THREE.PointLight('#e4f3f5',0,4800*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    room.roomAtmosphere=(id,accent=1)=>{
        const mode=WORKSHOP_MODES[id]||WORKSHOP_MODES.morning,c=skyCanvas.getContext('2d'),grad=c.createLinearGradient(0,0,0,512);grad.addColorStop(0,mode.sky[0]);grad.addColorStop(1,mode.sky[1]);c.fillStyle=grad;c.fillRect(0,0,512,512);skyMap.needsUpdate=true;
        glow.forEach(({mat,channel})=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.12+mode.wash*accent;});
        lights.forEach(spec=>{spec.light.color.set(mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});
        root.userData.atmosphere=id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[plaster, 'plaster'], [steel, 'metal'], [silver, 'metal'], [orange, 'powder'], [teal, 'powder'], [rubber, 'rubber'], [ply, 'wood']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
