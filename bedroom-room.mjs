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
        { id: 'journal', at: [bedside[0][0] + 65, 550, bedside[0][1] + 65], turn: -10 },
        ...bedside.map(([x,z]) => ({ id: 'kenney-furniture-lamp-round-table', at: [x - 40, 550, z - 70] }))
    ];
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
    morning: { label: 'Morning', description: 'Gentle daylight · standing desk for a fresh start', key: '#fff0d9', fill: '#ddebf2', accent: '#e4d6b8', power: 1.55, ambient: .48, bounce: .63, exposure: 1.06, sky: ['#a5c7db', '#f0dfbd'], practical: .2, wash: .18, colors: ['#f0d1a1', '#b7cebf'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft window light · seated work and journaling', key: '#fff3e1', fill: '#e0e9f0', accent: '#e8d1af', power: 1.2, ambient: .45, bounce: .6, exposure: 1.08, sky: ['#b2c9d8', '#eee6d4'], practical: .35, wash: .3, colors: ['#efd1ae', '#b9c9ba'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm reading lamps · desk angled for a quiet wind-down', key: '#f6d2ab', fill: '#cbd9e5', accent: '#efbf88', power: .65, ambient: .32, bounce: .43, exposure: 1.12, sky: ['#9390aa', '#ddb08c'], practical: .85, wash: .7, colors: ['#f7cc96', '#bac7b5'], height: 28, tilt: 12, offset: [0, 80], yaw: 0, leds: true, color: '#ffdda7' },
    night: { label: 'Night', description: 'Restful bedroom · dim amber paths and desk LEDs off', key: '#bdcee2', fill: '#c1cfdf', accent: '#d4a975', power: .2, ambient: .22, bounce: .28, exposure: 1.14, sky: ['#213449', '#465a72'], practical: .25, wash: .38, colors: ['#e6b77e', '#8ea7a9'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: false },
    party: { label: 'Weekend', description: 'A slow morning · open light and room to stretch', key: '#f4e4ca', fill: '#d6e5ee', accent: '#d8c5a8', power: 1.05, ambient: .42, bounce: .54, exposure: 1.1, sky: ['#b5cddd', '#e7d2b1'], practical: .55, wash: .5, colors: ['#efcfa1', '#bbcfbd'], height: 43.5, tilt: 0, offset: [-60, 130], yaw: 8, leds: true, color: '#f3d3aa' }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

export function buildBedroomRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier, bed, bedHalf } = layout, front = bz + d;
    const cream = material('#e1dbcc', { roughness: .95 }), sage = material('#89988b', { roughness: .9 });
    const linen = material('#c7bdab', { roughness: 1 }), dark = material('#445653', { roughness: .78 });
    const brass = material('#b59a67', { metalness: .6, roughness: .4 });
    const woodMap = texture((c,tw,th)=>{c.fillStyle='#ac916e';c.fillRect(0,0,tw,th);for(let i=0;i<6;i++){c.fillStyle=['#b89e7b','#a98e6b','#c0a584'][i%3];c.fillRect(i*tw/6,0,tw/6-2,th);c.strokeStyle='#654c3328';for(let j=0;j<16;j++){const x=i*tw/6+j*5;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+6,th*.3,x-4,th*.7,x,th);c.stroke();}}},512,1024);
    const oak = material('#ffffff', { map: woodMap, roughness: .8 });
    const floorMap = woodMap.clone(); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w/1400,d/2200);floorMap.needsUpdate=true;
    box(root,[w,30,d],[0,-15,bz+d/2],material('#ffffff',{map:floorMap,roughness:.82}));
    const weaveMap=texture((c,tw,th)=>{c.fillStyle='#c3b8a2';c.fillRect(0,0,tw,th);c.strokeStyle='#ede5d2';c.lineWidth=6;c.strokeRect(15,15,tw-30,th-30);c.strokeStyle='#96897135';c.lineWidth=1;for(let i=0;i<tw;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,th);c.stroke();}for(let i=0;i<th;i+=5){c.beginPath();c.moveTo(0,i);c.lineTo(tw,i);c.stroke();}});
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`bedroom:${layout.id}:fixture:${id}`});return g;};
    const glow=[];
    const strip=(parent,size,at,channel=0)=>{const mat=material('#efd0a1',{emissive:'#efd0a1',emissiveIntensity:.3});const o=box(parent,size,at,mat,2);o.castShadow=false;glow.push({mat,channel});return o;};
    const rug=group('bedside-rug','Woven bedside area rug',[bed[0],0,bz+2050]);
    box(rug,[tier?2550:2110,4,2300],[0,2,0],material('#ffffff',{map:weaveMap,roughness:1}),4);
    const back=new THREE.Group();back.name='Bedroom linen and oak headboard wall';root.add(back);
    box(back,[w,h,80],[0,h/2,bz-40],cream);box(back,[w,110,24],[0,55,bz+12],oak);
    const panels=group('headboard-wall','Linen panels and oak bedside wall',[bed[0],0,bz+24],0,back);
    const panelWidth=tier?2900:2440;
    box(panels,[panelWidth,100,30],[0,50,0],oak);
    box(panels,[panelWidth,1560,30],[0,880,0],sage,8);
    for(let i=0;i<5;i++)box(panels,[panelWidth/5-12,1190,35],[-panelWidth/2+panelWidth/5*(i+.5),825,22],linen,12);
    for(const x of [-panelWidth/2+35,panelWidth/2-35])box(panels,[25,1530,40],[x,880,22],oak,3);
    strip(panels,[panelWidth-110,10,10],[0,1675,-3]);room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    const artMap=texture((c,tw,th)=>{c.fillStyle='#dcd0b5';c.fillRect(0,0,tw,th);c.fillStyle='#be9c73';c.beginPath();c.arc(tw*.72,th*.35,th*.21,0,Math.PI*2);c.fill();for(let i=0;i<3;i++){c.fillStyle=['#a2ab96','#798b7d','#556f67'][i];c.beginPath();c.moveTo(0,th);c.bezierCurveTo(tw*.25,th*(.28+i*.18),tw*.55,th*(.95-i*.13),tw,th*(.45+i*.16));c.lineTo(tw,th);c.fill();}},1024,512);
    const art=group('bedroom-landscape','Original quiet landscape',[bed[0],2050,bz+35],0,back);
    box(art,[tier?1400:1130,510,18],[0,0,0],oak,3);box(art,[tier?1355:1085,465,4],[0,0,12],material('#ffffff',{map:artMap,roughness:.9}));
    const left=new THREE.Group();left.name='Bedroom wardrobe and dressing wall';root.add(left);box(left,[80,h,d],[-w/2-40,h/2,bz+d/2],cream);box(left,[20,110,d],[-w/2+10,55,bz+d/2],oak);room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
    const right=new THREE.Group();right.name='Bedroom daylight and desk wall';root.add(right);
    const wz=bz+1700,ww=tier?2000:1600,low=850,wh=1450,a=wz-ww/2,b=wz+ww/2;
    box(right,[80,h,a-bz],[w/2+40,h/2,(a+bz)/2],cream);box(right,[80,h,front-b],[w/2+40,h/2,(front+b)/2],cream);box(right,[80,low,ww],[w/2+40,low/2,wz],cream);box(right,[80,h-low-wh,ww],[w/2+40,(h+low+wh)/2,wz],cream);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(right,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[w/2+52,low+wh/2,wz]);pane.rotation.y=-Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(right,[65,wh+50,30],[w/2-10,low+wh/2,z],oak);for(const y of [low,low+wh])box(right,[65,30,ww+60],[w/2-10,y,wz],oak);box(right,[170,30,ww+80],[w/2-50,low-15,wz],oak,3);
    for(const z of [a-70,b+70])for(let i=0;i<6;i++)mesh(right,new THREE.CylinderGeometry(24,24,2250,10),linen,[w/2-75,1200,z-65+i*27]);
    rod(right,[w/2-85,2370,a-170],[w/2-85,2370,b+170],8,brass);room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    for(const [i,[x,z]] of layout.bedside.entries()){
        const nightstand=group('bedside-'+i,'Oak bedside drawer and soft path light',[x,0,z]);
        for(const px of [-145,145])for(const pz of [-150,150])rod(nightstand,[px,0,pz],[px,120,pz],12,oak);
        box(nightstand,[380,400,420],[0,300,0],oak,5);box(nightstand,[410,50,450],[0,525,0],oak,6);
        for(const y of [205,400]){box(nightstand,[335,165,10],[0,y,216],linen,3);rod(nightstand,[-55,y+15,228],[55,y+15,228],5,brass);}
        strip(nightstand,[300,8,8],[0,100,185]);
    }
    const bench=group('bedroom-bench','Upholstered oak bench at the foot of the bed',[bed[0],0,bz+2480]);
    for(const x of [-520,520])for(const z of [-155,155])rod(bench,[x,0,z],[x,365,z],20,oak);
    box(bench,[1200,55,430],[0,370,0],oak,6);box(bench,[1200,95,440],[0,442.5,0],sage,20);
    const wardrobeWidth=tier>=3?2400:tier?1600:1000,wardrobeZ=front-(tier>=3?3200:tier?2450:680);
    const wardrobe=group('wardrobe','Oak wardrobe and linen sliding doors',[-w/2+320,0,wardrobeZ],Math.PI/2);
    box(wardrobe,[wardrobeWidth,2200,30],[0,1100,-270],oak,3);for(const x of [-wardrobeWidth/2+15,wardrobeWidth/2-15])box(wardrobe,[30,2200,570],[x,1100,0],oak);
    box(wardrobe,[wardrobeWidth,80,560],[0,40,0],dark);box(wardrobe,[wardrobeWidth,35,600],[0,2182.5,0],oak);
    const doors=tier>=3?4:tier?3:2;
    for(let i=0;i<doors;i++){const dw=wardrobeWidth/doors,x=-wardrobeWidth/2+dw*(i+.5);box(wardrobe,[dw-12,2070,22],[x,1110,291],i%2?linen:sage,3);rod(wardrobe,[x+dw*.28,920,310],[x+dw*.28,1220,310],5,brass);}
    strip(wardrobe,[wardrobeWidth-100,10,10],[0,120,300]);
    if(tier){
        const readingRug=group('reading-rug','Woven reading corner rug',[layout.reading[0]+330,0,layout.reading[1]]);
        box(readingRug,[1800,4,1300],[0,2,0],material('#ffffff',{map:weaveMap,roughness:1}),4);
        const shelf=group('reading-shelf','Oak reading ledge and linen books',[-w/2+110,1550,layout.reading[1]-150],Math.PI/2,left);
        box(shelf,[1050,30,200],[0,0,0],oak);for(let i=0;i<7;i++)box(shelf,[35+i%2*10,190+i%3*20,120],[-380+i*65,110,0],i%2?sage:linen,2);
    }
    if(tier>=2){
        const alcove=group('desk-alcove','Oak desk wall ledges and original botanical art',[layout.desk[0],1800,bz+95],0,back);
        box(alcove,[1460,32,180],[0,100,0],oak,3);box(alcove,[1180,32,170],[0,-280,0],oak,3);
        for(let i=0;i<5;i++)box(alcove,[40,200+i%3*20,110],[-520+i*60,222,0],i%2?sage:cream,2);
        const botMap=texture((c,tw,th)=>{c.fillStyle='#e6dec9';c.fillRect(0,0,tw,th);c.strokeStyle='#55766b';c.lineWidth=5;c.beginPath();c.moveTo(tw*.5,th*.9);c.quadraticCurveTo(tw*.3,th*.5,tw*.55,th*.12);c.stroke();c.fillStyle='#7d9481';for(let i=0;i<5;i++){c.beginPath();c.ellipse(tw*(i%2?.37:.57),th*(.24+i*.12),tw*.15,th*.05,i%2?-.6:.5,0,Math.PI*2);c.fill();}},256,384);
        box(alcove,[320,460,15],[320,346,0],brass,3);box(alcove,[280,420,4],[320,346,12],material('#ffffff',{map:botMap}));strip(alcove,[1000,8,8],[0,-306,90]);
    }
    if(tier>=3){
        const vanity=group('dressing-island','Oak dressing island with upholstered stool',[-w/2+1900,0,front-2400]);
        for(const x of [-610,610])for(const z of [-235,235])rod(vanity,[x,0,z],[x,720,z],16,brass);
        box(vanity,[1400,50,650],[0,775,0],oak,5);box(vanity,[1310,160,550],[0,670,0],linen,3);
        for(const x of [-410,0,410]){box(vanity,[390,125,10],[x,670,281],sage,3);sphere(vanity,[9,9,9],[x,680,297],brass);}
        // The stool belongs to this editable furniture group.
        for(const x of [-145,145])for(const z of [535,825])rod(vanity,[x,0,z],[x,390,z],13,oak);
        box(vanity,[400,90,400],[0,425,680],sage,20);
    }
    if(tier===4){
        const retreatRug=group('retreat-rug','Private lounge woven rug',[w/2-1500,0,front-2500]);
        box(retreatRug,[2300,4,2700],[0,2,0],material('#ffffff',{map:weaveMap,roughness:1}),4);
        const divider=group('retreat-divider','Oak screen between sleeping and lounge areas',[w/2-1650,0,front-4200]);
        for(const x of [-850,850])box(divider,[80,1800,80],[x,900,0],oak,3);
        box(divider,[1800,60,80],[0,1770,0],oak,3);
        for(let x=-780;x<=780;x+=120)box(divider,[35,1700,45],[x,880,0],oak,3);
        const art2=group('retreat-art','Original landscape over the private lounge',[w/2-30,1850,front-2500],-Math.PI/2,right);
        box(art2,[1500,700,20],[0,0,0],oak,3);box(art2,[1450,650,4],[0,0,14],material('#ffffff',{map:artMap}));
    }
    const ceiling=new THREE.Group();ceiling.name='Bedroom opal and brass pendants';root.add(ceiling);room.ceilingFixture=ceiling;
    for(const [x,z] of [[bed[0],bed[1]+170],[layout.desk[0],layout.desk[1]]]){
        rod(ceiling,[x,h,z],[x,h-400,z],4,brass);sphere(ceiling,[160,110,160],[x,h-485,z],cream);strip(ceiling,[75,6,75],[x,h-600,z]);
    }
    const lights=[{at:[layout.bedside[0][0],1050,bz+550],power:2.4},{at:[layout.desk[0],h-450,layout.desk[1]],power:3.1,task:true},{at:[tier?layout.reading[0]:bed[0],1500,tier?layout.reading[1]:bed[1]+500],power:2.6},{at:[w/2-600,1700,bz+d*.5],power:2.7,channel:1}].map(spec=>{const light=new THREE.PointLight('#f3d2a2',0,4400*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    room.roomAtmosphere=(id,accent=1)=>{const mode=BEDROOM_MODES[id]||BEDROOM_MODES.morning,c=skyCanvas.getContext('2d'),grad=c.createLinearGradient(0,0,0,512);grad.addColorStop(0,mode.sky[0]);grad.addColorStop(1,mode.sky[1]);c.fillStyle=grad;c.fillRect(0,0,512,512);c.fillStyle='#899f88';for(let i=0;i<12;i++){c.beginPath();c.arc(i*48,495,50+i%3*10,0,Math.PI*2);c.fill();}skyMap.needsUpdate=true;glow.forEach(({mat,channel})=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.08+mode.wash*accent;});lights.forEach(spec=>{spec.light.color.set(mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});root.userData.atmosphere=id;};
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [sage, 'powder'], [linen, 'fabric'], [dark, 'powder'], [brass, 'metal'], [oak, 'wood']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
