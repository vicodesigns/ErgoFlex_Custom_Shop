import * as THREE from 'three';

const tiers = [
    ['apartment', 'Apartment living lounge', 3600, 4200, 2600],
    ['house', 'Home lounge & listening room', 4600, 5400, 2800],
    ['spacious', 'Media lounge & arcade corner', 5800, 6400, 3000],
    ['premium', 'Social lounge & games room', 7200, 8000, 3200],
    ['executive', 'Private entertainment suite', 9000, 9500, 3400]
];
export const LOUNGE_LAYOUTS = Object.fromEntries(tiers.map(([id, name, width, depth, height], tier) => {
    const back = -1700, front = back + depth;
    const desk = [-width / 2 + (tier ? 1250 : 1100), back + 900];
    const loungeZ = front - (tier ? 1500 : 1200), sofaX = -width / 2 + (tier ? 540 : 460), tableX = -width / 2 + (tier ? 1630 : 1320);
    const props = [
        { id: 'kenney-furniture-chair-cushion', at: [desk[0], 0, desk[1] + 980], turn: 180 },
        { id: tier ? 'sofa-fabric' : 'sofa-leather-wood', at: [sofaX, 0, loungeZ], turn: 90 },
        { id: 'coffee-table', at: [tableX, 0, loungeZ], turn: 90 },
        { id: 'game-controller', at: [tableX + 60, 391.2, loungeZ - 230], turn: 90 },
        { id: 'journal', at: [tableX - 80, 391.2, loungeZ + 175], turn: 85 },
        { id: 'tea-cup', at: [tableX + 140, 391.2, loungeZ + 220] },
        { id: 'samsung-neo-tv', at: [width / 2 - 200, 650, loungeZ], turn: -90 },
        { id: 'arcade-orbit-runner', at: [width / 2 - 520, 0, back + 560], turn: -90 },
        { id: 'decor-plant2', at: [0, 0, front - 240] }
    ];
    if (tier) props.push({ id: 'jukebox', at: [width / 2 - 560, 0, back + (tier >= 2 ? 2700 : 1770)], turn: -90 });
    if (tier >= 2) props.push(
        { id: 'arcade-pixel-garden', at: [width / 2 - 520, 0, back + 1600], turn: -90 },
        { id: 'armchair-poppi', at: [width / 2 - 900, 0, front - 690], turn: -135 },
        { id: 'monstera', at: [width / 2 - 520, 0, loungeZ - 1450] }
    );
    if (tier >= 3) props.push(
        { id: 'foosball', at: [tier === 4 ? 2400 : 600, 0, front - (tier === 4 ? 2300 : 3700)] },
        { id: 'bar-stool-brass', at: [-width / 2 + 920, 0, back + 3200] },
        { id: 'bar-stool-brass', at: [-width / 2 + 920, 0, back + 3900] },
        { id: 'kenney-furniture-kitchen-coffee-machine', at: [-width / 2 + 350, 930, back + 3380], turn: 90 }
    );
    if (tier === 4) props.push({ id: 'arcade-night-drive', at: [width / 2 - 560, 0, back + 3650], turn: -90 });
    return [id, { id, name, width, depth, height, back, desk, loungeZ, sofaX, tableX, tier, props,
        daylight: [-width / 2 + 100, back + 2400] }];
}));
export const loungeLayoutById = id => LOUNGE_LAYOUTS[id] || LOUNGE_LAYOUTS.apartment;
export const loungeLayoutForSize = size => LOUNGE_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const LOUNGE_MODES = {
    morning: { label: 'Morning', description: 'Coffee & daylight · standing desk for a fresh start', key: '#fff0d6', fill: '#dceaf2', accent: '#d8d7b4', power: 1.6, ambient: .48, bounce: .65, exposure: 1.07, sky: ['#a3c4da', '#ece0bd'], practical: .25, wash: .18, colors: ['#efcd9c', '#b8d4c4'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Reading & conversation · relaxed seated desk', key: '#fff2dc', fill: '#e0e9f1', accent: '#e1d3b7', power: 1.25, ambient: .45, bounce: .6, exposure: 1.08, sky: ['#abc5d8', '#e9e5d5'], practical: .4, wash: .35, colors: ['#efd5ae', '#bdd2c4'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden-hour listening · warm lamps and cabinet lights', key: '#f6d0a7', fill: '#cbd8e6', accent: '#efbb85', power: .75, ambient: .32, bounce: .42, exposure: 1.13, sky: ['#9a8aa7', '#dba987'], practical: .85, wash: .7, colors: ['#ffcf95', '#9fc7b6'], height: 28, tilt: 0, offset: [0, 70], yaw: 0, leds: true, color: '#ffd8a3' },
    night: { label: 'Movie night', description: 'Low-glare cinema · soft media bias lights', key: '#c3d4ec', fill: '#c4d2e3', accent: '#a7b8e7', power: .24, ambient: .24, bounce: .3, exposure: 1.17, sky: ['#1e304a', '#40536f'], practical: .45, wash: .9, colors: ['#f0c58c', '#8fa9df'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: true, color: '#9bb8e8' },
    party: { label: 'Game night', description: 'Arcade & friends · desk turned toward the room', key: '#ded3e5', fill: '#c5d6e9', accent: '#d5a4d8', power: .55, ambient: .33, bounce: .4, exposure: 1.14, sky: ['#495b79', '#a3899c'], practical: .9, wash: 1.15, colors: ['#ffcf98', '#d29de1'], height: 43.5, tilt: -5, offset: [60, 260], yaw: -12, leds: true, color: '#d0a2ee' }
};
function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}
export function buildLoungeRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier, loungeZ } = layout, front = bz + d;
    const cream = material('#d7d4c7', { roughness: .9 }), sage = material('#657b72', { roughness: .85 });
    const dark = material('#293b3d', { roughness: .7 }), brass = material('#af915a', { metalness: .7, roughness: .35 });
    const woodMap = texture((c, tw, th) => { c.fillStyle = '#836548'; c.fillRect(0, 0, tw, th); for (let i = 0; i < 6; i++) { c.fillStyle = ['#977658','#816346','#a1815f'][i%3];c.fillRect(i*tw/6,0,tw/6-2,th); c.strokeStyle = '#35251532'; for(let j=0;j<16;j++){const x=i*tw/6+j*5;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+5,th*.3,x-4,th*.7,x,th);c.stroke();} } },512,1024);
    const walnut = material('#ffffff', { map: woodMap, roughness: .78 });
    const floorMap = woodMap.clone(); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(w/1400,d/2200);floorMap.needsUpdate=true;
    box(root,[w,30,d],[0,-15,bz+d/2],material('#ffffff',{map:floorMap,roughness:.8}));
    const rugMap = texture((c, tw, th) => { c.fillStyle='#ae9e89';c.fillRect(0,0,tw,th);c.strokeStyle='#ece2cb';c.lineWidth=6;c.strokeRect(18,18,tw-36,th-36);c.strokeStyle='#4b6c6866';c.lineWidth=2;for(let n=-tw;n<tw*2;n+=60){c.beginPath();c.moveTo(n,0);c.lineTo(n-tw,th);c.stroke();}c.strokeStyle='#b0ab9630';c.lineWidth=1;for(let y=0;y<th;y+=4){c.beginPath();c.moveTo(0,y);c.lineTo(tw,y);c.stroke();}});
    box(root,[tier?2700:2250,5,tier?2700:2250],[-w/2+(tier?1430:1190),2.5,loungeZ],material('#ffffff',{map:rugMap,roughness:1}),8);
    const group = (id,name,at=[0,0,0],turn=0,parent=root) => {const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`lounge:${layout.id}:fixture:${id}`});return g;};
    const glow=[];
    const strip=(parent,size,at,channel=0)=>{const mat=material('#efd0a3',{emissive:'#efd0a3',emissiveIntensity:.3});const o=box(parent,size,at,mat,2);o.castShadow=false;glow.push({mat,channel});return o;};
    const back=new THREE.Group();back.name='Lounge walnut and sage feature wall';root.add(back);
    box(back,[w,h,80],[0,h/2,bz-40],sage);box(back,[w,100,30],[0,50,bz+15],walnut);
    for(let x=-w/2+45;x<w/2;x+=85)box(back,[28,h-150,22],[x,h/2+20,bz+11],walnut,2);
    strip(back,[w-100,12,12],[0,h-120,bz+35]);room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    const art=group('lounge-landscape','Original evening landscape',[tier>=2?0:layout.desk[0],h-540,bz+40],0,back);
    const artMap=texture((c,tw,th)=>{c.fillStyle='#c8bba5';c.fillRect(0,0,tw,th);c.fillStyle='#e1bf81';c.beginPath();c.arc(tw*.72,th*.3,th*.17,0,Math.PI*2);c.fill();for(let i=0;i<3;i++){c.fillStyle=['#8b9b88','#587c75','#355b59'][i];c.beginPath();c.moveTo(0,th);c.bezierCurveTo(tw*.1,th*(.35+i*.15),tw*.55,th*(.8-i*.07),tw,th*(.3+i*.19));c.lineTo(tw,th);c.fill();}},1024,512);
    box(art,[tier?1600:1240,620,28],[0,0,0],brass,3);box(art,[tier?1555:1195,575,4],[0,0,19],material('#ffffff',{map:artMap,roughness:.9}));
    if(tier>=2){
        const hearth=group('electric-hearth','Stone electric fireplace and hearth',[0,0,bz+160]);
        box(hearth,[1760,70,450],[0,35,70],dark,4);box(hearth,[1600,750,300],[0,445,0],material('#b0a38e'),5);box(hearth,[1400,360,12],[0,430,157],dark,5);
        const flameMap=texture((c,tw,th)=>{c.fillStyle='#171f22';c.fillRect(0,0,tw,th);for(let i=0;i<26;i++){c.fillStyle=i%2?'#f1bb60':'#c9703c';c.beginPath();const x=i*tw/26;c.moveTo(x,th-30);c.quadraticCurveTo(x+50,th*.65,x+25,th*(.15+i%4*.12));c.quadraticCurveTo(x+10,th*.8,x-22,th-30);c.fill();}},1024,256);
        box(hearth,[1340,305,4],[0,435,166],material('#ffffff',{map:flameMap,emissive:'#b1632c',emissiveIntensity:.22,roughness:.6}));
    }
    const right=new THREE.Group();right.name='Lounge media and arcade wall';root.add(right);box(right,[80,h,d],[w/2+40,h/2,bz+d/2],cream);box(right,[20,100,d],[w/2-10,50,bz+d/2],walnut);room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
    const left=new THREE.Group();left.name='Lounge daylight and entry wall';root.add(left);
    const wz=bz+2300,ww=tier?1850:1350,low=800,wh=1450,a=wz-ww/2,b=wz+ww/2;
    box(left,[80,h,a-bz],[-w/2-40,h/2,(a+bz)/2],cream);box(left,[80,h,front-b],[-w/2-40,h/2,(front+b)/2],cream);box(left,[80,low,ww],[-w/2-40,low/2,wz],cream);box(left,[80,h-low-wh,ww],[-w/2-40,(h+low+wh)/2,wz],cream);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(left,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[-w/2-52,low+wh/2,wz]);pane.rotation.y=Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(left,[65,wh+50,30],[-w/2+10,low+wh/2,z],walnut);for(const y of [low,low+wh])box(left,[65,30,ww+60],[-w/2+10,y,wz],walnut);box(left,[170,30,ww+80],[-w/2+50,low-15,wz],walnut,3);
    for(const z of [a-75,b+75])for(let i=0;i<5;i++)mesh(left,new THREE.CylinderGeometry(22,22,2100,10),material('#b9b19e'),[-w/2+60,1200,z-60+i*30]);
    rod(left,[-w/2+75,2300,a-170],[-w/2+75,2300,b+170],10,brass);room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
    const media=group('media-console','Walnut media console and bias lighting',[w/2-200,0,loungeZ],-Math.PI/2);
    box(media,[1650,500,340],[0,345,0],walnut,5);for(const x of [-700,700])for(const z of [-100,100])rod(media,[x,0,z],[x,95,z],12,brass);box(media,[1700,55,380],[0,622.5,0],walnut,4);
    for(const x of [-530,0,530])box(media,[490,430,12],[x,345,177],dark,3);strip(media,[1570,8,8],[0,130,191],1);strip(media,[1400,12,10],[0,1040,-75],1);
    const filmMap=texture((c,tw,th)=>{const sky=c.createLinearGradient(0,0,0,th);sky.addColorStop(0,'#283c57');sky.addColorStop(1,'#e2ba82');c.fillStyle=sky;c.fillRect(0,0,tw,th);c.fillStyle='#f3d69e';c.beginPath();c.arc(tw*.7,th*.3,th*.13,0,Math.PI*2);c.fill();for(let i=0;i<3;i++){c.fillStyle=['#748b87','#3c625f','#234647'][i];c.beginPath();c.moveTo(0,th);for(let x=0;x<=tw;x+=32)c.lineTo(x,th*(.48+i*.16)+Math.sin(x*.012+i)*35);c.lineTo(tw,th);c.fill();}c.fillStyle='#f5e3c9';c.font='28px serif';c.fillText('THE LONG WAY HOME',40,th-45);},1024,576);
    room.decorateProp=(object,placement)=>{if(placement.id!=='samsung-neo-tv')return;const display=mesh(object,new THREE.PlaneGeometry(1.094,.615),new THREE.MeshBasicMaterial({map:filmMap,toneMapped:false}),[0,.3521,.0108]);display.name='Lounge cinema display';display.castShadow=display.receiveShadow=false;};
    const lamp=group('reading-lamp','Brass reading lamp',[layout.sofaX+140,0,loungeZ-(tier?1550:1270)]);
    mesh(lamp,new THREE.CylinderGeometry(110,125,20,24),brass,[0,10,0]);rod(lamp,[0,20,0],[0,1550,0],12,brass);
    mesh(lamp,new THREE.CylinderGeometry(130,200,250,24,1,true),material('#ddd0b3',{side:THREE.DoubleSide}),[0,1580,0]);strip(lamp,[60,8,60],[0,1460,0]);
    const arcSign=group('arcade-sign','PLAY TOGETHER illuminated sign',[w/2-36,2250,bz+1100],-Math.PI/2,right);
    const signMap=texture((c,tw,th)=>{c.fillStyle='#32444e';c.fillRect(0,0,tw,th);c.fillStyle='#eac98c';c.font='bold 53px sans-serif';c.textAlign='center';c.fillText('PLAY TOGETHER',tw/2,95);c.strokeStyle='#8bbfc0';c.lineWidth=4;c.strokeRect(22,22,tw-44,th-44);},1024,160);
    box(arcSign,[tier?1800:1060,220,18],[0,0,0],brass,4);box(arcSign,[tier?1750:1010,175,4],[0,0,13],material('#ffffff',{map:signMap,emissive:'#7a6341',emissiveIntensity:.2}));
    if(tier>=3){
        const bar=group('lounge-bar','Walnut refreshments bar and display',[ -w/2+350,0,bz+3550],Math.PI/2);
        box(bar,[1640,820,550],[0,440,0],walnut,4);box(bar,[1570,60,480],[0,30,0],dark);box(bar,[1740,50,650],[0,905,0],material('#ad9c81'),4);
        for(let x=-740;x<740;x+=60)box(bar,[22,760,15],[x,440,283],walnut,2);
        for(const y of [1530,1970]){box(bar,[1660,35,290],[0,y,-100],walnut,3);strip(bar,[1550,8,10],[0,y-24,45]);}
        for(let i=0;i<7;i++){mesh(bar,new THREE.CylinderGeometry(30,40,200+i%2*30,16),material(i%2?'#65796a':'#ac815c',{roughness:.35}),[-600+i*185,1547.5+100+i%2*15,-70]);mesh(bar,new THREE.CylinderGeometry(13,13,50,12),brass,[-600+i*185,1772.5+i%2*30,-70]);}
    }
    if(tier===4){
        const pool=group('billiard-table','Original billiard table and cue stand',[1100,0,bz+3600]);
        for(const x of [-850,850])for(const z of [-450,450])box(pool,[140,650,140],[x,325,z],walnut,5);
        box(pool,[2280,230,1300],[0,695,0],walnut,8);box(pool,[2070,18,1090],[0,819,0],material('#3e7e72',{roughness:1}),5);
        for(const z of [-610,610])box(pool,[2190,70,85],[0,820,z],dark,8);for(const x of [-1100,1100])box(pool,[85,70,1140],[x,820,0],dark,8);
        for(const x of [-1060,0,1060])for(const z of [-560,560])mesh(pool,new THREE.CylinderGeometry(60,60,18,20),dark,[x,852,z]);
        const colors=['#f3e6b9','#bd723e','#6596a1','#aa5364','#514f74','#c8b756'];for(let i=0;i<6;i++)sphere(pool,[28,28,28],[(i%3-1)*65,856,Math.floor(i/3)*70-35],material(colors[i],{roughness:.25}));sphere(pool,[28,28,28],[-600,856,100],cream);
        rod(pool,[-930,890,460],[780,890,490],7,walnut);
    }
    const ceiling=new THREE.Group();ceiling.name='Lounge sculptural pendant';root.add(ceiling);room.ceilingFixture=ceiling;
    const center=[layout.tableX+150,loungeZ];for(let i=0;i<5;i++){const angle=i*Math.PI*2/5,x=center[0]+Math.cos(angle)*260,z=center[1]+Math.sin(angle)*260,y=h-500-i%2*100;rod(ceiling,[center[0],h,center[1]],[x,y,z],5,brass);sphere(ceiling,[95,95,95],[x,y-70,z],material('#e4d7bc'));strip(ceiling,[40,8,40],[x,y-165,z]);}
    const lights=[{at:[layout.desk[0],1800,layout.desk[1]-130],power:2.9,task:true},{at:[w/2-600,1700,loungeZ],power:3.3,channel:1},{at:[lamp.position.x,1450,lamp.position.z],power:2.6,task:true},{at:[tier>=3?-w/2+700:layout.tableX,1800,tier>=3?bz+3500:loungeZ],power:3.4}].map(spec=>{const light=new THREE.PointLight('#f3cf9e',0,4500*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    room.roomAtmosphere=(id,accent=1)=>{const mode=LOUNGE_MODES[id]||LOUNGE_MODES.afternoon;const c=skyCanvas.getContext('2d'),grad=c.createLinearGradient(0,0,0,512);grad.addColorStop(0,mode.sky[0]);grad.addColorStop(1,mode.sky[1]);c.fillStyle=grad;c.fillRect(0,0,512,512);c.fillStyle='#829780';for(let i=0;i<12;i++){c.beginPath();c.arc(i*47,490,50+i%3*12,0,Math.PI*2);c.fill();}skyMap.needsUpdate=true;glow.forEach(({mat,channel})=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.1+mode.wash*accent;});lights.forEach(spec=>{spec.light.color.set(spec.task?'#ffe0b6':mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});root.userData.atmosphere=id;};
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[cream, 'plaster'], [sage, 'powder'], [dark, 'powder'], [brass, 'metal'], [walnut, 'wood']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('afternoon');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
