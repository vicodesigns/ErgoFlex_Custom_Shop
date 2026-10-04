import * as THREE from 'three';

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
    return [id, { id, name, width, depth, height, back, tier, desk, thinker, vase, props,
        daylight: [width / 2 - 100, back + 1600] }];
}));
export const galleryLayoutById = id => GALLERY_LAYOUTS[id] || GALLERY_LAYOUTS.apartment;
export const galleryLayoutForSize = size => GALLERY_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const GALLERY_MODES = {
    morning: { label: 'Morning', description: 'Clear daylight · standing curation and planning', key: '#fff2dd', fill: '#e4edf5', accent: '#fff1d6', power: 1.5, ambient: .5, bounce: .7, exposure: 1.04, sky: ['#accada', '#f2e7d1'], practical: .3, wash: .35, colors: ['#ffe4bd', '#e4f0f5'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft museum daylight · seated cataloguing', key: '#fff7eb', fill: '#e8eff4', accent: '#eedcc5', power: 1.15, ambient: .48, bounce: .65, exposure: 1.07, sky: ['#b5cedd', '#eee9db'], practical: .45, wash: .5, colors: ['#ffe7c4', '#dceaf2'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Warm art lighting · desk angled for sketching', key: '#f6d9bb', fill: '#cfdae7', accent: '#f8c98f', power: .6, ambient: .32, bounce: .42, exposure: 1.12, sky: ['#8e94ae', '#d9b79b'], practical: .85, wash: .8, colors: ['#ffd29b', '#c3dae8'], height: 28, tilt: 39, offset: [0, 80], yaw: 0, leds: true, color: '#ffdda7' },
    night: { label: 'Night', description: 'After-hours collection · sculptures and artwork in focus', key: '#c9d7e7', fill: '#bdcde1', accent: '#e4ba8a', power: .18, ambient: .2, bounce: .23, exposure: 1.15, sky: ['#172a41', '#344d64'], practical: .75, wash: .6, colors: ['#f5cca0', '#a3c8e0'], height: 28, tilt: 0, offset: [0, 100], yaw: 0, leds: false },
    party: { label: 'Opening night', description: 'Exhibition reception · warm displays and standing desk', key: '#f3dcc6', fill: '#d4deed', accent: '#ffc888', power: .45, ambient: .3, bounce: .4, exposure: 1.14, sky: ['#3d5074', '#9b7d83'], practical: 1, wash: .95, colors: ['#ffd49e', '#adcfe6'], height: 43.5, tilt: 0, offset: [-70, 140], yaw: 8, leds: true, color: '#ffe0b0' }
};

function texture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

export function buildGalleryRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width: w, depth: d, height: h, back: bz, tier } = layout, front = bz + d;
    const ivory = material('#ece7de', { roughness: .95 }), black = material('#252b2e', { roughness: .5 });
    const brass = material('#b39a70', { metalness: .65, roughness: .35 });
    const oakMap = texture((c,tw,th) => { c.fillStyle='#a58b68'; c.fillRect(0,0,tw,th); c.strokeStyle='#71563735'; for(let i=0;i<110;i++){const x=i*tw/110;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+8,th*.3,x-5,th*.7,x,th);c.stroke();} });
    const oak = material('#ffffff', { map: oakMap, roughness: .8 });
    const stoneMap = texture((c,tw,th) => { c.fillStyle='#d5cdbf'; c.fillRect(0,0,tw,th); for(let i=0;i<1500;i++){const x=(i*137.53)%tw,y=(i*47.73)%th;c.fillStyle=i%2?'#b7aa9520':'#fff9ed45';c.fillRect(x,y,1+i%3,1+i%2);} c.strokeStyle='#a99e8e30';c.lineWidth=1;c.strokeRect(1,1,tw-2,th-2); });
    const floorMap=stoneMap.clone();floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(w/900,d/900);floorMap.needsUpdate=true;
    const stone=material('#ffffff',{map:stoneMap,roughness:.78});
    box(root,[w,30,d],[0,-15,bz+d/2],material('#ffffff',{map:floorMap,roughness:.75}));
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`gallery:${layout.id}:fixture:${id}`});return g;};
    const glow=[];
    const strip=(parent,size,at,channel=0)=>{const mat=material('#ffe4bd',{emissive:'#ffe4bd',emissiveIntensity:.35});const o=box(parent,size,at,mat,1);o.castShadow=false;glow.push({mat,channel});return o;};
    const back=new THREE.Group();back.name='Gallery main exhibition wall';root.add(back);
    box(back,[w,h,80],[0,h/2,bz-40],ivory);box(back,[w,90,20],[0,45,bz+10],stone);
    room.walls.push({obj:back,axis:'x',limit:bz*root.scale.x});
    const left=new THREE.Group();left.name='Gallery sculpture and print wall';root.add(left);
    box(left,[80,h,d],[-w/2-40,h/2,bz+d/2],ivory);box(left,[20,90,d],[-w/2+10,45,bz+d/2],stone);
    room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
    const right=new THREE.Group();right.name='Gallery daylight and salon wall';root.add(right);
    const wz=bz+1600,ww=tier?2000:1600,low=850,wh=1600,a=wz-ww/2,b=wz+ww/2;
    box(right,[80,h,a-bz],[w/2+40,h/2,(a+bz)/2],ivory);box(right,[80,h,front-b],[w/2+40,h/2,(front+b)/2],ivory);
    box(right,[80,low,ww],[w/2+40,low/2,wz],ivory);box(right,[80,h-low-wh,ww],[w/2+40,(h+low+wh)/2,wz],ivory);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
    const pane=mesh(right,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:skyMap}),[w/2+52,low+wh/2,wz]);pane.rotation.y=-Math.PI/2;pane.castShadow=pane.receiveShadow=false;
    for(const z of [a,wz,b])box(right,[65,wh+60,25],[w/2-10,low+wh/2,z],black);for(const y of [low,low+wh])box(right,[65,25,ww+60],[w/2-10,y,wz],black);
    box(right,[140,35,ww+70],[w/2-45,low-17.5,wz],stone);
    room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});

    // Art is original canvas artwork, with individual editable frames and labels.
    const artMaps=[0,1,2].map(style=>texture((c,tw,th)=>{
        c.fillStyle=['#eadfc7','#273e46','#f2e8d8'][style];c.fillRect(0,0,tw,th);
        if(style===0){c.fillStyle='#c27353';c.beginPath();c.arc(tw*.68,th*.35,th*.21,0,Math.PI*2);c.fill();for(let i=0;i<3;i++){c.fillStyle=['#aeb6a1','#728f82','#345c59'][i];c.beginPath();c.moveTo(0,th);c.bezierCurveTo(tw*.2,th*(.3+i*.16),tw*.65,th*(.9-i*.13),tw,th*(.5+i*.13));c.lineTo(tw,th);c.fill();}}
        if(style===1){for(let i=0;i<5;i++){c.strokeStyle=['#d6b37a','#f0dabc','#75aaad'][i%3];c.lineWidth=18-i*2;c.beginPath();c.arc(tw*.5,th*.5,th*(.13+i*.1),i*.6,Math.PI*1.55+i*.3);c.stroke();}c.fillStyle='#dc9971';c.fillRect(tw*.72,th*.14,tw*.04,th*.72);}
        if(style===2){for(let i=0;i<7;i++){c.fillStyle=['#ba694e','#d6b684','#769d91','#3f6468'][i%4];c.save();c.translate(tw*(.12+i*.12),th*(.28+(i%3)*.17));c.rotate((i-3)*.18);c.fillRect(-tw*.07,-th*.2,tw*.14,th*.4);c.restore();}}
    },1024,768));
    const labelMap=(title,sub)=>texture((c,tw,th)=>{c.fillStyle='#eee9de';c.fillRect(0,0,tw,th);c.fillStyle='#283b3f';c.font='500 30px sans-serif';c.fillText(title,24,50);c.font='22px sans-serif';c.fillText(sub,24,90);},512,128);
    const artwork=(id,at,width,height,style,turn=0,parent=back)=>{
        const g=group(id,['Tidal forms','Orbit study','Colour field'][style],at,turn,parent);
        box(g,[width+32,height+32,25],[0,0,0],black,3);box(g,[width,height,5],[0,0,16],material('#ffffff',{map:artMaps[style],roughness:.85}));
        box(g,[240,65,4],[width/2-120,-height/2-65,12],material('#ffffff',{map:labelMap(g.name,'ErgoFlex collection')}));
        rod(g,[-width*.32,height/2+100,90],[width*.32,height/2+100,90],8,brass);strip(g,[width*.64,8,12],[0,height/2+93,91]);
        return g;
    };
    artwork('main-art',[-w/2+(tier?1700:1450),1950,bz+35],tier?1700:1250,850,0);
    artwork('left-art',[-w/2+35,1930,bz+2250],900,1100,1,Math.PI/2,left);
    artwork('right-art',[w/2-35,2050,front-1100],tier>=3?2000:1050,850,2,-Math.PI/2,right);
    if(tier>=2)artwork('second-print',[-w/2+35,1900,front-2600],1200,900,2,Math.PI/2,left);

    const plinth=(id,name,at,size)=>{const g=group(id,name,[at[0],0,at[1]]);box(g,[size[0],45,size[2]],[0,22.5,0],black,3);box(g,[size[0]-25,size[1]-45,size[2]-25],[0,(size[1]+45)/2,0],stone,3);strip(g,[size[0]-90,6,8],[0,52,size[2]/2-10]);return g;};
    plinth('thinker-plinth','Stone plinth for The Thinker',layout.thinker,[720,850,640]);
    plinth('vase-plinth','Tall ceramic display plinth',layout.vase,[420,1000,420]);
    if(tier)plinth('aphrodite-plinth','Low marble sculpture base',[-w/2+560,bz+550],[820,120,760]);
    if(tier>=2)plinth('mercury-plinth','Bronze sculpture base',[w/2-650,bz+3800],[960,120,1000]);
    const bench=group('gallery-bench','Oak exhibition bench',[tier?0:250,0,bz+3000]);
    const bw=tier?1800:1300;
    for(const x of [-bw/2+100,bw/2-100])box(bench,[65,410,360],[x,205,0],black,4);
    box(bench,[bw,65,480],[0,437.5,0],oak,6);box(bench,[bw-80,35,400],[0,487.5,0],material('#776e5e',{roughness:.95}),8);
    if(tier>=3){
        const vitrine=group('collection-case','Glass exhibition case and award',[-1100,0,front-2300]);
        box(vitrine,[1300,100,700],[0,50,0],black,3);box(vitrine,[1250,700,650],[0,450,0],stone,4);box(vitrine,[1300,50,700],[0,825,0],oak,3);
        const glass=material('#c9e0e6',{transparent:true,opacity:.13,roughness:.15,depthWrite:false});
        for(const x of [-645,645])box(vitrine,[5,550,700],[x,1125,0],glass);for(const z of [-345,345])box(vitrine,[1300,550,5],[0,1125,z],glass);box(vitrine,[1300,5,700],[0,1402.5,0],glass);
        for(const x of [-650,650])for(const z of [-350,350])rod(vitrine,[x,850,z],[x,1405,z],4,brass);strip(vitrine,[1150,6,8],[0,852,-315]);
        const rug=group('salon-rug','Woven collector salon rug',[w/2-1500,0,front-2100]);
        box(rug,[2400,4,2900],[0,2,0],material('#c8bcaa',{roughness:1}),3);
    }
    if(tier===4){
        const sculpture=group('ribbon-sculpture','Original bronze ribbon sculpture',[0,0,bz+d*.55]);
        box(sculpture,[1000,160,1000],[0,80,0],stone,6);
        const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-270,160,-50),new THREE.Vector3(320,650,180),new THREE.Vector3(-350,1400,-100),new THREE.Vector3(0,2250,0),new THREE.Vector3(350,1700,110),new THREE.Vector3(-100,850,210)]);
        mesh(sculpture,new THREE.TubeGeometry(curve,80,65,10,false),brass,[0,0,0]);
        const panel=group('collection-divider','Freestanding exhibition panel',[-w/2+2400,0,front-4600]);
        box(panel,[2100,75,550],[0,37.5,0],black,4);box(panel,[1900,2200,90],[0,1175,0],ivory,4);
        // A second face of the gallery's original art, all in one movable group.
        box(panel,[1450,1100,20],[0,1250,62],black,3);box(panel,[1400,1050,5],[0,1250,75],material('#ffffff',{map:artMaps[1]}));
    }
    const ceiling=new THREE.Group();ceiling.name='Gallery track lighting';root.add(ceiling);room.ceilingFixture=ceiling;
    for(const x of [-w/2+650,w/2-900]){
        box(ceiling,[45,40,d-800],[x,h-80,bz+d/2],black,2);
        for(let i=0;i<4;i++){const z=bz+600+i*(d-1200)/3;rod(ceiling,[x,h-95,z],[x,h-200,z],8,black);const head=mesh(ceiling,new THREE.CylinderGeometry(40,40,100,16),black,[x,h-240,z]);head.rotation.z=x<0?-.45:.45;strip(ceiling,[50,6,50],[x,h-295,z]);}
    }
    const lights=[{at:[layout.thinker[0],2300,layout.thinker[1]+150],power:3.8},{at:[layout.desk[0],h-450,layout.desk[1]],power:3,task:true},{at:[-w/2+700,2200,front-1200],power:3.2},{at:[w/2-800,2400,bz+d*.55],power:4,channel:1}].map(spec=>{const light=new THREE.PointLight('#ffe4bd',0,5000*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    room.roomAtmosphere=(id,accent=1)=>{const mode=GALLERY_MODES[id]||GALLERY_MODES.morning,c=skyCanvas.getContext('2d'),gradient=c.createLinearGradient(0,0,0,512);gradient.addColorStop(0,mode.sky[0]);gradient.addColorStop(1,mode.sky[1]);c.fillStyle=gradient;c.fillRect(0,0,512,512);c.fillStyle='#7c918b';c.fillRect(0,460,512,52);skyMap.needsUpdate=true;
        glow.forEach(({mat,channel})=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.1+mode.wash*accent;});
        lights.forEach(spec=>{spec.light.color.set(mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});root.userData.atmosphere=id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[ivory, 'plaster'], [black, 'powder'], [brass, 'metal'], [oak, 'wood'], [stone, 'stone']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
