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
export const SCIFI_MODES = {
    morning: { label: 'Morning', description: 'Dawn orbit · standing mission preparation', key: '#d9edff', fill: '#9ac5e9', accent: '#73e5ed', power: 1.35, ambient: .43, bounce: .58, exposure: 1.08, practical: .5, wash: .55, colors: ['#7ceaf4', '#b1bbff'], planet: ['#8ccee3', '#1f5d88'], height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: true, color: '#5ae9ff', status: 'DAWN WATCH' },
    afternoon: { label: 'Afternoon', description: 'Research operations · seated analysis under clean task light', key: '#edf6ff', fill: '#acc7e8', accent: '#86f0e0', power: 1.1, ambient: .4, bounce: .5, exposure: 1.1, practical: .75, wash: .5, colors: ['#9cecff', '#b8caff'], planet: ['#86bad6', '#183c70'], height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false, status: 'RESEARCH OPERATIONS' },
    evening: { label: 'Evening', description: 'Deep-space navigation · angled command desk and blue light', key: '#b4cdeb', fill: '#849ecf', accent: '#7094ff', power: .55, ambient: .27, bounce: .32, exposure: 1.15, practical: .65, wash: .85, colors: ['#68dfff', '#b797ff'], planet: ['#6596bb', '#192451'], height: 43.5, tilt: 15, offset: [0, 80], yaw: 0, leds: true, color: '#668cff', status: 'NAVIGATION WATCH' },
    night: { label: 'Night', description: 'Quiet watch · low cabin light with illuminated paths', key: '#8baacd', fill: '#748db4', accent: '#74c9e9', power: .15, ambient: .17, bounce: .19, exposure: 1.18, practical: .3, wash: .6, colors: ['#68dfe5', '#827fff'], planet: ['#355e92', '#101c3b'], height: 28, tilt: 0, offset: [0, 110], yaw: 0, leds: true, color: '#56dce8', status: 'NIGHT WATCH' },
    party: { label: 'Hyperdrive', description: 'Hyperspace transit · violet and cyan command lighting', key: '#b2c2f0', fill: '#8c94d4', accent: '#c079ff', power: .4, ambient: .23, bounce: .3, exposure: 1.18, practical: .85, wash: 1, colors: ['#61efff', '#d588ff'], planet: ['#ae87e6', '#22245a'], height: 43.5, tilt: 0, offset: [-60, 140], yaw: 8, leds: true, color: '#bc74ff', status: 'HYPERDRIVE TRANSIT' }
};

function texture(draw, width=512, height=512) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

export function buildScifiRoom(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere, markSceneAsset } = helpers;
    const { width:w, depth:d, height:h, back:bz, tier }=layout,front=bz+d;
    const hull=material('#4a5968',{roughness:.72,metalness:.3}),pale=material('#83909b',{roughness:.65,metalness:.25});
    const dark=material('#1d2935',{roughness:.68,metalness:.35}),rubber=material('#121c27',{roughness:.95});
    const orange=material('#bd7840',{roughness:.7,metalness:.25});
    const panelMap=texture((c,tw,th)=>{c.fillStyle='#3b4856';c.fillRect(0,0,tw,th);c.strokeStyle='#161f2c';c.lineWidth=6;c.strokeRect(10,10,tw-20,th-20);c.strokeStyle='#73808c';c.lineWidth=2;c.strokeRect(17,17,tw-34,th-34);for(let i=0;i<14;i++){c.fillStyle='#1c2b39';c.fillRect(40+i*31,th*.8,14,30);}c.fillStyle='#87949d';for(const x of [30,tw-30])for(const y of [30,th-30]){c.beginPath();c.arc(x,y,4,0,7);c.fill();}});
    const floorMap=panelMap.clone();floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(w/950,d/1100);floorMap.needsUpdate=true;
    box(root,[w,35,d],[0,-17.5,bz+d/2],material('#ffffff',{map:floorMap,roughness:.72,metalness:.25}));
    const group=(id,name,at=[0,0,0],turn=0,parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`scifi:${layout.id}:fixture:${id}`});return g;};
    const glow=[];
    const strip=(parent,size,at,channel=0)=>{const mat=material('#75eafa',{emissive:'#75eafa',emissiveIntensity:.55});const o=box(parent,size,at,mat,2);o.castShadow=false;glow.push({mat,channel});return o;};
    const back=new THREE.Group();back.name='Sci-fi bay reinforced rear bulkhead';root.add(back);box(back,[w,h,100],[0,h/2,bz-50],hull);
    const columns=Math.floor(w/1000),pw=w/columns;
    for(let i=0;i<columns;i++){const x=-w/2+pw*(i+.5);box(back,[pw-35,h-280,30],[x,h/2,bz+17],material('#ffffff',{map:panelMap,roughness:.75,metalness:.3}),4);box(back,[35,h,65],[x-pw/2+18,h/2,bz+32],pale,3);}
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
    // Freely editable mission console and equipment bench.
    const console=group('mission-console','Mission navigation display',[-w/2+(tier>=3?4800:1050),1900,bz+90],0,back);
    const screenCanvas=document.createElement('canvas');screenCanvas.width=1024;screenCanvas.height=640;const screenMap=new THREE.CanvasTexture(screenCanvas);screenMap.colorSpace=THREE.SRGBColorSpace;
    box(console,[1600,1050,85],[0,0,0],dark,12);box(console,[1490,920,6],[0,0,47],new THREE.MeshBasicMaterial({map:screenMap}));strip(console,[1440,10,10],[0,-480,53]);
    const service=group('service-counter','Equipment console and storage',[layout.service[0],0,layout.service[1]],Math.PI/2);
    box(service,[1800,90,740],[0,45,0],dark,5);box(service,[1760,730,680],[0,455,0],hull,6);box(service,[1880,80,780],[0,860,0],pale,8);
    for(const x of [-570,0,570]){box(service,[525,620,14],[x,480,349],dark,3);rod(service,[x-70,650,365],[x+70,650,365],8,pale);}strip(service,[1690,8,12],[0,810,379]);
    const lockers=group('crew-lockers','Crew storage and charging lockers',[-w/2+390,0,front-750],Math.PI/2);
    box(lockers,[900,1900,700],[0,950,0],dark,8);for(let i=0;i<2;i++){const x=-220+i*440;box(lockers,[415,1750,18],[x,980,359],hull,5);rod(lockers,[x+130,800,376],[x+130,1080,376],8,pale);strip(lockers,[290,12,10],[x,1730,379],1);for(let j=0;j<5;j++)box(lockers,[210,12,8],[x,1420-j*32,373],rubber);}
    const airlock=group('crew-airlock','Crew access hatch',[w/2-120,0,front-950],-Math.PI/2,right);
    box(airlock,[1350,2450,90],[0,1225,0],dark,20);for(const x of [-635,635])box(airlock,[80,2450,125],[x,1225,0],pale,12);box(airlock,[1200,2280,30],[0,1190,65],hull,12);
    box(airlock,[20,2280,10],[0,1190,85],dark);for(const x of [-110,110])rod(airlock,[x,1040,100],[x,1370,100],12,pale);strip(airlock,[1050,12,10],[0,2290,89]);
    for(let i=0;i<7;i++){const mark=box(airlock,[85,42,5],[-520+i*170,75,80],orange);mark.rotation.z=-.5;}
    // Paths remain flat so the desk can explore the full room floor.
    const paths=group('floor-paths','Cyan floor navigation and landing marks');
    for(const x of [-w/2+120,w/2-120])strip(paths,[12,4,d-280],[x,2,bz+d/2]);
    for(const x of [-400,400])strip(paths,[12,4,tier?1800:1000],[x,2,bz+d*.55],1);
    if(tier>=2){
        const core=group('research-core','Shielded research core',[-w/2+1150,0,bz+d*.58]);
        mesh(core,new THREE.CylinderGeometry(510,510,140,12),dark,[0,70,0]);mesh(core,new THREE.CylinderGeometry(390,390,1720,16),hull,[0,1000,0]);
        for(const y of [250,1850,2100])mesh(core,new THREE.CylinderGeometry(470,470,90,16),pale,[0,y,0]);
        for(let i=0;i<6;i++){const angle=i*Math.PI/3,x=Math.cos(angle)*410,z=Math.sin(angle)*410;rod(core,[x,180,z],[x,2110,z],25,dark);strip(core,[18,1400,18],[x,1030,z]);}
        sphere(core,[220,290,220],[0,2080,0],material('#6ddfe6',{emissive:'#6ddfe6',emissiveIntensity:.45,roughness:.3}));
    }
    if(tier>=3){
        const table=group('tactical-table','Orbital tactical projection table',[w/2-2000,0,front-2300]);
        mesh(table,new THREE.CylinderGeometry(450,570,140,6),dark,[0,70,0]);mesh(table,new THREE.CylinderGeometry(280,420,680,6),hull,[0,480,0]);mesh(table,new THREE.CylinderGeometry(750,750,110,6),pale,[0,875,0]);
        mesh(table,new THREE.CylinderGeometry(660,660,8,6),rubber,[0,934,0]);for(let i=0;i<6;i++){const angle=i*Math.PI/3;strip(table,[24,8,24],[Math.cos(angle)*560,942,Math.sin(angle)*560]);}
        const globeMap=texture((c,tw,th)=>{c.fillStyle='#254f79';c.fillRect(0,0,tw,th);c.fillStyle='#78c7c4';for(let i=0;i<14;i++){c.beginPath();c.ellipse((i*127.1)%tw,(i*81.3)%th,30+i%3*15,20+i%4*8,i,0,7);c.fill();}c.strokeStyle='#addfe0';for(let y=0;y<th;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(tw,y);c.stroke();}});
        sphere(table,[240,240,240],[0,1350,0],material('#ffffff',{map:globeMap,emissive:'#469fbb',emissiveIntensity:.25,roughness:.4}));
        for(const y of [990,1060]){const ring=mesh(table,new THREE.TorusGeometry(330,7,8,48),material('#8dedff',{emissive:'#8dedff',emissiveIntensity:.6}),[0,y,0]);ring.rotation.x=Math.PI/2;}
        const bay=group('fabrication-floor','Service bay markings',[-w/2+2200,0,front-2300]);
        for(const x of [-1150,1150])strip(bay,[12,4,2800],[x,2,0],1);for(const z of [-1400,1400])strip(bay,[2300,4,12],[0,2,z],1);
    }
    if(tier===4){
        const cradle=group('cargo-cradle','Robotics payload cradle',[1800,0,front-4100]);
        box(cradle,[1100,120,1250],[0,60,0],dark,8);box(cradle,[1000,850,1150],[0,545,0],hull,8);for(const x of [-410,410])box(cradle,[70,910,1200],[x,555,0],orange,3);strip(cradle,[850,18,10],[0,760,583],1);
        const overhead=group('robotics-marker','Robotics maintenance beacon',[0,0,front-4100]);
        box(overhead,[1800,4,1800],[0,2,0],rubber,5);for(const x of [-880,880])strip(overhead,[12,6,1760],[x,7,0]);
    }
    const ceiling=new THREE.Group();ceiling.name='Sci-fi bay overhead gantry lights';root.add(ceiling);room.ceilingFixture=ceiling;
    for(let z=bz+800;z<front-400;z+=2000){box(ceiling,[w-180,80,130],[0,h-100,z],dark,8);for(const x of [-w*.28,w*.28])strip(ceiling,[w*.22,12,85],[x,h-147,z]);}
    const lights=[{at:[layout.desk[0],h-450,layout.desk[1]],power:3.6,task:true},{at:[-w/2+1150,2000,bz+2000],power:3.5},{at:[-w/2+1150,2200,bz+d*.58],power:4.5},{at:[w/2-900,2100,front-1700],power:4.5,channel:1}].map(spec=>{const light=new THREE.PointLight('#75eafa',0,5000*root.scale.x,2);light.position.set(...spec.at);root.add(light);return {...spec,light,power:spec.power*(root.scale.x*1000)**2};});
    room.roomAtmosphere=(id,accent=1)=>{
        const mode=SCIFI_MODES[id]||SCIFI_MODES.morning,c=orbitCanvas.getContext('2d');c.fillStyle='#070f23';c.fillRect(0,0,1024,768);
        for(let i=0;i<220;i++){const x=(i*173.91)%1024,y=(i*67.37)%768;c.fillStyle=i%3?'#b9d9ff':'#fff4cf';if(id==='party'){c.strokeStyle=mode.colors[i%2];c.lineWidth=1+i%2;c.beginPath();c.moveTo(x,y);c.lineTo(x+(x-512)*.22,y+(y-384)*.22);c.stroke();}else c.fillRect(x,y,1+i%3,1+i%3);}
        const planet=c.createRadialGradient(690,440,20,750,600,470);planet.addColorStop(0,mode.planet[0]);planet.addColorStop(1,mode.planet[1]);c.fillStyle=planet;c.beginPath();c.arc(800,690,430,0,7);c.fill();c.strokeStyle=mode.colors[0];c.lineWidth=8;c.beginPath();c.arc(800,690,434,Math.PI,Math.PI*1.8);c.stroke();
        c.strokeStyle='#d5edff45';c.lineWidth=12;for(let i=0;i<5;i++){c.beginPath();c.ellipse(775,670,330,45+i*25,-.2,0,6.3);c.stroke();}orbitMap.needsUpdate=true;
        const s=screenCanvas.getContext('2d');s.fillStyle='#101f32';s.fillRect(0,0,1024,640);s.fillStyle=mode.colors[0];s.font='600 40px sans-serif';s.fillText(mode.status,45,65);s.font='22px sans-serif';s.fillText('ERGOFLEX  /  ORBITAL SYSTEMS',45,104);
        s.strokeStyle=mode.colors[0];s.lineWidth=3;for(const r of [70,135,195]){s.beginPath();s.arc(315,350,r,0,6.3);s.stroke();}s.beginPath();s.moveTo(75,350);s.lineTo(555,350);s.moveTo(315,140);s.lineTo(315,570);s.stroke();s.fillStyle=mode.colors[1];s.beginPath();s.arc(405,260,18,0,7);s.fill();
        for(let i=0;i<5;i++){s.fillStyle='#233a52';s.fillRect(630,190+i*70,330,38);s.fillStyle=mode.colors[i%2];s.fillRect(630,190+i*70,110+i*35,38);}s.font='24px sans-serif';s.fillStyle='#cfe6f7';s.fillText('LINK ACTIVE',630,155);screenMap.needsUpdate=true;
        glow.forEach(({mat,channel})=>{mat.color.set(mode.colors[channel]);mat.emissive.set(mode.colors[channel]);mat.emissiveIntensity=.15+mode.wash*accent;});
        lights.forEach(spec=>{spec.light.color.set(mode.colors[spec.channel||0]);spec.light.intensity=spec.power*(spec.task?mode.practical:mode.wash)*accent;});root.userData.atmosphere=id;
    };
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[hull, 'metal'], [pale, 'metal'], [dark, 'powder'], [rubber, 'rubber'], [orange, 'powder']]) mat.userData.roomSurface = surface;
    room.roomAtmosphere('morning');root.userData.dimensionsMm={width:w,depth:d,height:h};
}
