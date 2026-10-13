import * as THREE from 'three';
import { institutionalMap, institutionalFloor, detailKit, notebook, books, plant } from './institutional-detail.mjs?v=scene-desk-styling-20261010';

// OCC lab concept, not an as-built plan. All coordinates are room-local mm.
// Each tier reserves a front capture/critique zone and a clear right-hand entry.
// Workstation peripherals come from the owner's independently edited Product
// setups; this module supplies the architecture, production gear and stories.
export const GROUP = 'media';
export const SCENES = ['occmedialab'];
export const stableWorkstations = true;
const NAVY = '#07326b', ORANGE = '#f18a27', WHITE = '#edf0ec', INK = '#232b35', SILVER = '#aab4bc';
const PHASES = ['morning', 'afternoon', 'evening', 'night', 'party'];
const TIERS = ['apartment', 'house', 'spacious', 'premium', 'executive'];
const NAMES = ['Project suite', 'Teaching lab', 'Production lab', 'Collaborative studio', 'Flagship media lab'];
const COUNTS = [4, 6, 8, 10, 12];
const phaseIndex = phase => Math.max(0, PHASES.indexOf(phase));
const prop = (id, x, z, y = 0) => ({ id, at: [x, y, z] });
const roles = ['film-edit', 'sound-mix', 'digital-art', 'accessible-edit', 'colour-grade', 'animation', 'film-edit', 'sound-design', 'digital-art', 'film-edit', 'animation'];
const roleName = { 'film-edit':'Film editing', 'sound-mix':'Audio & sound mix', 'digital-art':'Digital illustration', 'accessible-edit':'Open access editing', 'colour-grade':'Colour grading', animation:'Animation & motion', 'sound-design':'Sound design' };

export const lighting = { media:{ practical:[.3,.38,.66,.28,.65],wash:[.18,.2,.3,.1,.34],task:'#e8f0fa',bounce:'#a7bfd4' } };
export const sceneOverrides = {
    occmedialab:{
        tiers:TIERS,
        boardTitle:'FROM FIRST IDEA TO FINAL FRAME',
        desk:[prop('journal',-540,140),prop('headphones',530,-110)], shelf:[],
        modes:{
            morning:{description:'Daylight planning · storyboards, shot lists and equipment prep',height:35,tilt:0,leds:false},
            afternoon:{description:'Balanced work light · editing, animation and digital art',height:28,tilt:0,leds:false},
            evening:{description:'Neutral task light · colour decisions and headphone mixing',key:'#dee9f7',fill:'#c6d5e5',power:.6,ambient:.3,practical:.66,exposure:1.08,height:28,tilt:0,color:'#d8e8ff',leds:true},
            night:{description:'Dim screening wash · projection and quiet listening',key:'#bdcede',fill:'#a1b8d0',power:.18,ambient:.2,practical:.28,exposure:1.12,height:28,tilt:0,color:'#87b4e3',leds:true},
            party:{description:'Student reel showcase · portfolio critique and shared notes',height:35,tilt:0,practical:.65,power:1.05,ambient:.4,color:'#f3bd79',leds:true}
        },
        layout(tier,l){
            l.name=NAMES[l.index]+' · '+COUNTS[l.index]+' desks';
            l.desk=[-l.width/2+1800,l.back+2400];
            l.activity=[l.index?0:1000,l.back+l.depth-700];
            l.props[0].at=[l.desk[0],0,l.desk[1]+1050];
            l.media={desks:COUNTS[l.index],capture:[-l.width/2+1800,l.back+l.depth-1000],print:[-l.width/2+820,l.back+360]};
            l.props.push(prop('camera-bag',l.width/2-760,l.back+430,1800));
        }
    }
};
export function stations(_id,l){
    const i=l.index, columns=i===0?2:i<3?3:4;
    const xs=columns===2?[-l.width/2+1800,l.width/2-2100]:Array.from({length:columns},(_,n)=>-l.width/2+1800+n*(l.width-3600)/(columns-1));
    const slots=Array.from({length:COUNTS[i]},(_,n)=>[xs[n%columns],l.back+2400+Math.floor(n/columns)*4000]);
    return slots.slice(1).map((at,n)=>{
        const role=roles[n],narrow=role==='accessible-edit'||(i===0&&role==='digital-art');
        return {id:role+'-'+String(n+1).padStart(2,'0'),name:roleName[role]+' '+(n+1),role,
            at,size:narrow?'48x30':'60x30',turn:i>=3&&Math.floor((n+1)/columns)===2?180:0,height:28,tilt:0,chair:role!=='accessible-edit',
            desktop:[prop('headphones',narrow?-470:-610,-130),...(role==='digital-art'||role==='animation'?[prop('sketchbook',narrow?430:620,110,1)]:[])],shelf:[]};
    });
}
export const finish = spec => ({name:spec.name+' · acoustic carpet, navy felt & silver metal',ground:'#626c7c',wood:.58,metal:.3,stone:.58,night:.92,partyDay:true});
export const floor = (_spec,w,d) => institutionalFloor('carpet',w,d);
export const options = () => ({trimColor:'#b6c1cd',acousticName:'Navy acoustic absorption panels',signLabel:'OCC · FILM / SOUND / DIGITAL ART',rugColor:null,planter:false,
    boardOnSideWall:true,boardName:'Production storyboard & review board',boardFooter:'#dce5ed',storage:{height:1800,open:false},nightBackground:.6});

function text(c,s,x,y,size=22,color=WHITE,align='left'){
    c.fillStyle=color;c.font=`600 ${size}px "DejaVu Sans", sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y);c.textAlign='left';
}
function coastFrame(c,x,y,w,h,phase=0){
    const sky=c.createLinearGradient(x,y,x,y+h);sky.addColorStop(0,phase===3?'#132e54':'#4e9dc2');sky.addColorStop(1,phase===3?'#4f667f':'#f2c292');c.fillStyle=sky;c.fillRect(x,y,w,h);
    c.fillStyle='#315f85';c.fillRect(x,y+h*.52,w,h*.48);c.fillStyle='#d5b686';c.beginPath();c.moveTo(x,y+h);c.lineTo(x+w*.45,y+h*.6);c.lineTo(x+w,y+h*.87);c.lineTo(x+w,y+h);c.fill();
    c.fillStyle='#203944';for(let n=0;n<4;n++){const px=x+w*(.12+n*.23),py=y+h*.65;c.fillRect(px,py-h*.4,w*.008,h*.4);for(let side=-1;side<=1;side+=2){c.beginPath();c.ellipse(px+side*w*.03,py-h*.38,w*.055,h*.025,side*.35,0,Math.PI*2);c.fill();}}
}
export function drawScreen(c,W,H,_spec,variant=0,phase='morning'){
    const p=phaseIndex(phase);c.fillStyle='#101b2a';c.fillRect(0,0,W,H);c.fillStyle=NAVY;c.fillRect(0,0,W,44);text(c,['OCC / STUDENT REEL','COLOUR & COMPOSITION','AUDIO POST / MIX','PORTFOLIO / REVIEW'][variant%4],22,30,18);
    if(variant%4===2){
        text(c,'DIALOGUE     FOLEY     MUSIC',24,78,18,'#a9c4df');
        for(let row=0;row<5;row++){
            const y=100+row*(H-160)/5;c.fillStyle=row%2?'#20354a':'#182c40';c.fillRect(24,y,W-90,(H-180)/5);
            c.strokeStyle=['#80c0d1','#f3ad62','#91bb98'][row%3];c.lineWidth=2;c.beginPath();for(let n=0;n<100;n++){const v=Math.sin(n*.83+row)*Math.sin(n*.19+row)*Math.cos(n*.13);c.lineTo(32+n*(W-112)/100,y+18+v*12);}c.stroke();
        }
    }else if(variant%4===1){
        coastFrame(c,22,70,W*.53,H*.47,p);text(c,'SCOPES / COLOUR',W*.61,91,18,'#a9c4df');
        for(let k=0;k<3;k++){c.strokeStyle=['#db6958','#87b298','#729aca'][k];c.lineWidth=2;c.beginPath();for(let n=0;n<55;n++)c.lineTo(W*.6+n*W*.006,H*.45-Math.sin(n*.09+k)*H*.13);c.stroke();}
        for(let n=0;n<9;n++){c.fillStyle=['#edc490','#709c97','#2c6792','#182e50'][n%4];c.fillRect(26+n*(W-50)/9,H*.72,(W-65)/9,H*.14);}
    }else{
        coastFrame(c,26,67,W*.67,H*.47,p);text(c,p===4?'STUDENT REEL REVIEW':'PROJECT / COAST STORIES',W*.73,94,Math.max(11,W*.017),'#a9c4df');
        for(let n=0;n<5;n++){c.fillStyle=n%2?'#416a8a':'#6b8fab';c.fillRect(W*.73,118+n*27,W*.22,17);}
        for(let row=0;row<3;row++)for(let n=0;n<5;n++){c.fillStyle=['#619bb7','#ec9860','#88ac96'][row];c.fillRect(26+n*(W-48)/5,H*.65+row*H*.08,(W-65)/5,H*.06);}
        c.strokeStyle=ORANGE;c.lineWidth=2;c.beginPath();c.moveTo(W*(.3+p*.06),H*.62);c.lineTo(W*(.3+p*.06),H*.91);c.stroke();
    }
    text(c,['PREP / SHOT LISTS','EDIT / CREATE','SOUND / COLOUR','SCREENING','PORTFOLIO CRITIQUE'][p],24,H-14,15,'#c2d6e6');
}
export function drawBoard(c,W,H,_spec,variant=0){
    c.fillStyle='#e9edf0';c.fillRect(0,0,W,H);text(c,'FROM FIRST IDEA TO FINAL FRAME',26,45,24,NAVY);
    for(let n=0;n<4;n++){const x=25+n*(W-45)/4;c.fillStyle=NAVY;c.fillRect(x,69,(W-65)/4,26);text(c,['PLAN','CAPTURE','EDIT','SHARE'][n],x+8,89,14);
        coastFrame(c,x,110,(W-65)/4,95,(variant+n)%5);text(c,['Shot / coast','Interview','Sound notes','Student reel'][n],x+8,234,13,NAVY);
        for(let k=0;k<3;k++){c.fillStyle=k===variant%3?ORANGE:'#b2bfcb';c.fillRect(x+8,253+k*21,(W-95)/4,11);}}
}

const logoMaps=new Map();
function logoMap(name){
    if(!logoMaps.has(name)){
        let resolve;const ready=new Promise(r=>resolve=r);const map=new THREE.TextureLoader().load(`assets/artwork/orange-coast-college-${name}.png`,()=>resolve(),undefined,()=>resolve());map.colorSpace=THREE.SRGBColorSpace;logoMaps.set(name,{map,ready});
    }
    return logoMaps.get(name);
}
function logo(parent,name,size,at,rotation=0){
    const {map,ready}=logoMap(name),m=new THREE.MeshStandardMaterial({map,transparent:true,roughness:.8,depthWrite:false,side:THREE.DoubleSide});m.userData.sharedTextures=true;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(...size),m);p.position.set(...at);p.rotation.y=rotation;p.castShadow=false;parent.add(p);return ready;
}
function screen(kit,parent,size,at,variant=0){
    const m=kit.canvasMat((c,W,H)=>drawScreen(c,W,H,kit.spec,variant));m.emissive.set('#a1b4ce');m.emissiveMap=m.map;m.emissiveIntensity=.16;m.userData.screenVariant=variant;kit.screenMats.push(m);
    kit.box(parent,[size[0]+40,size[1]+40,55],at,kit.ink,8);return kit.mesh(parent,new THREE.PlaneGeometry(...size),m,[at[0],at[1],at[2]+29]);
}
function panel(kit,parent,size,at,color=NAVY){return kit.box(parent,size,at,kit.mat(color,'fabric'),8);}
function camera(k,x,y,z,scale=1){
    k.box([175*scale,120*scale,140*scale],[x,y,z],INK);k.add(new THREE.CylinderGeometry(42*scale,42*scale,90*scale,20),[x,y,z+108*scale],INK,[1,1,1],[Math.PI/2,0,0]);
    k.box([75*scale,56*scale,8*scale],[x+110*scale,y+12*scale,z],SILVER);k.box([100*scale,20*scale,90*scale],[x,y+85*scale,z],INK);
}
function tripod(k,x,y,z,height=1400){
    k.cyl(16,20,height-250,[x,y+(height+250)/2,z],SILVER);
    for(let n=0;n<3;n++){const a=n*Math.PI*2/3,dx=Math.sin(a)*300,dz=Math.cos(a)*300;
        const start=new THREE.Vector3(x,y+height*.58,z),end=new THREE.Vector3(x+dx,y+25,z+dz),delta=end.clone().sub(start);
        k.add(new THREE.CylinderGeometry(12,17,delta.length(),12),start.clone().add(end).multiplyScalar(.5).toArray(),INK,[1,1,1],new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())).toArray().slice(0,3));
        k.ball(25,[end.x,end.y,end.z],INK,[1,.4,1]);
    }
}

export function furnish(kit){
    const {layout:l,asset,box,mat,byId,label}=kit,w=kit.w,bz=kit.bz,front=kit.front;
    const print=kit.cabinet('print-scan',[-w/2+820,0,bz+360],1300,900,false);print.name='Print & scan counter';
    const k=detailKit();k.box([550,290,360],[-110,1045,0],'#d3d9dc');k.box([460,40,200],[-110,1210,-50],INK);k.box([370,15,250],[-110,920,150],INK);k.box([300,2,280],[-110,933,185],WHITE);
    k.box([360,70,270],[400,936,-10],INK);k.box([290,4,230],[400,974,-10],'#b7c8cd');books(k,-540,900,-30,3);k.build(print,kit.dress||mat('#ffffff','powder',{vertexColors:true}));label(print,'PRINT / SCAN',[950,110],[0,640,228],NAVY);
    const storage=byId('storage');if(storage){storage.name='Camera & equipment checkout';for(const o of storage.children)if(o.isMesh&&o.position.z>=210)o.visible=false;label(storage,'EQUIPMENT / CHECKOUT',[1120,130],[0,1660,231],NAVY);}
    const critique=byId('activity-table');critique.name='Storyboard & critique table';label(critique,'PLAN / REVIEW',[960,85],[0,680,333],NAVY);
    for(let n=0;n<2+Math.min(l.index,2);n++)kit.chair('critique-chair-'+n,[l.activity[0]-450+n*360,0,l.activity[1]-880],450,0);
    // Large review display and flanking nearfields sit on the back wall.
    const review=asset('reel-screen','Student reel screening display',[0,0,bz+92],kit.back);screen(kit,review,[Math.min(w*.36,3700),1450],[0,1780,0],3);
    for(const x of [-1,1]){
        const speaker=asset('review-speaker-'+x,'Wall review speaker',[x*(Math.min(w*.36,3700)/2+250),1730,bz+150],kit.back);box(speaker,[220,520,200],[0,0,0],kit.ink,12);
        for(const [y,r] of [[-75,68],[150,25]]){const cone=kit.mesh(speaker,new THREE.CylinderGeometry(r,r,8,24),kit.mat('#445366','rubber'),[0,y,104]);cone.rotation.x=Math.PI/2;}
    }
    // Capture set: cyclorama roll, camera tripod, two softboxes and floor tape.
    const stage=asset('capture-stage','Capture stage · camera, backdrop & softboxes',[l.media.capture[0],0,l.media.capture[1]]);
    stage.rotation.y=Math.PI;
    box(stage,[2500,15,1600],[0,7.5,-60],mat('#344054','rubber'),14);
    const roll=panel(kit,stage,[2350,2220,35],[0,1110,650],'#4c966d');
    box(stage,[2450,32,45],[0,2250,650],kit.metal,6);
    for(const x of [-1240,1240])box(stage,[30,2270,30],[x,1135,650],kit.ink,4);
    const capture=detailKit();tripod(capture,0,0,-580,1380);camera(capture,0,1460,-580);capture.box([150,24,160],[0,1370,-580],INK);
    for(const x of [-920,920]){tripod(capture,x,0,-450,1700);capture.box([38,330,25],[x,1870,-450],INK);}
    for(const x of [-600,600])capture.box([420,3,28],[x,18,450],ORANGE);capture.build(stage,mat('#ffffff','powder',{vertexColors:true}));
    kit.mediaDiffusers=[];
    for(const x of [-920,920]){
        const head=new THREE.Group();head.position.set(x,1850,-450);head.rotation.y=x<0?.45:-.45;stage.add(head);
        box(head,[500,480,180],[0,0,-80],kit.ink,15);
        const glow=kit.material('#f3f5ef',{emissive:'#e6efff',emissiveIntensity:.35,roughness:.75});box(head,[470,450,12],[0,0,18],glow,15);kit.mediaDiffusers.push(glow);
    }
    kit.label(stage,'CAPTURE / LIGHT / ACTION',[1450,120],[0,220,720],NAVY);
    // Keep stage dressing within its fixture; camera cutaway affects ceilings only.
    roll.userData.mediaBackdrop=true;
    const ceilingProjector=asset('ceiling-projector','Ceiling-mounted review projector',[0,kit.ceiling-370,bz+3300]);
    box(ceilingProjector,[380,170,320],[0,0,0],kit.trim,15);kit.mesh(ceilingProjector,new THREE.CylinderGeometry(45,45,12,24),kit.ink,[0,-15,-166]).rotation.x=Math.PI/2;
    box(ceilingProjector,[30,260,30],[0,190,0],kit.metal,4);ceilingProjector.userData.presentationOnly=true;kit.mediaCeiling=[ceilingProjector];
    const labels=asset('lab-zone-markings','Media lab zone markings');labels.userData.presentationOnly=true;
    for(const [name,at] of [['EDIT / CREATE',[l.desk[0],22,l.desk[1]+1750]],['SOUND / IMAGE',[w*.2,22,bz+5800]]]){
        const p=label(labels,name,[1450,160],at,NAVY);p.rotation.x=-Math.PI/2;p.receiveShadow=true;
    }
}
export function dressProp(id,k,_g,kit){
    if(id==='storage'){
        for(let n=0;n<3;n++){const y=290+n*420;k.box([1080,24,410],[0,y,0],SILVER);for(let j=0;j<3;j++){const x=-350+j*350;k.box([265,170,250],[x,y+100,5],INK);k.box([65,20,5],[x,y+105,133],ORANGE);k.box([95,10,20],[x,y+193,5],SILVER);}}
        // Open upper doors read as a checkout cabinet, with labelled hard cases.
    }
}
function poster(kit,id,title,at,wall,index){
    const g=kit.asset(id,title,at,wall),m=kit.canvasMat((c,W,H)=>{
        c.fillStyle=index%2?WHITE:NAVY;c.fillRect(0,0,W,H);coastFrame(c,20,55,W-40,H*.58,index);text(c,title.toUpperCase(),22,H-63,21,index%2?NAVY:WHITE);text(c,'OCC / FILM + MEDIA ARTS',22,H-24,12,index%2?NAVY:'#b6cde1');c.fillStyle=ORANGE;c.fillRect(20,20,W-40,9);
    },512,720);kit.box(g,[640,900,25],[0,0,-8],kit.ink,5);kit.mesh(g,new THREE.PlaneGeometry(610,865),m,[0,0,6]);return g;
}
export function decorate(kit){
    const {w,bz,front,layout:l}=kit,ready=[];
    const identity=kit.byId('room-sign');identity.position.y=2800;
    const circle=kit.asset('occ-circle','OCC coast identity mark',[-1600,2800,bz+75],kit.back);ready.push(logo(circle,'circle',[310,310],[0,0,0]));
    const pirate=kit.asset('occ-pirate','OCC Pirates media arts badge',[w/2-620,2450,bz+90],kit.back);ready.push(logo(pirate,'pirate',[540,540],[0,0,0]));
    const title=kit.asset('occ-wordmark','Orange Coast College wordmark',[-w/2+750,2440,bz+90],kit.back);kit.box(title,[740,550,28],[0,0,-17],kit.mat(NAVY,'powder'),8);ready.push(logo(title,'title',[660,490],[0,0,0]));
    kit.byId('wall-clock')?.position.set(-2350,2780,bz+65);
    kit.room.mediaArtReady=Promise.all(ready);
    // Left rear wall has no window opening: art boards and course work sit here.
    const frames=['Story / Screen','Light / Colour','Sound / Silence'];
    for(let n=0;n<3;n++){const g=poster(kit,'film-poster-'+n,frames[n],[-w/2+58,1850,bz+450+n*790],kit.left,n);g.rotation.y=Math.PI/2;}
    // Grey absorption and oak slats around the sound area; never a floor blocker.
    const acoustic=kit.byId('acoustic-panels');if(acoustic){
        acoustic.position.z=bz+kit.d*.28;for(const child of acoustic.children)child.geometry?.dispose();acoustic.clear();
        const ak=detailKit();for(let n=0;n<5;n++){ak.box([210,1050,45],[-560+n*280,0,0],n%2?'#7590a6':NAVY);ak.box([180,7,3],[-560+n*280,-465,24],ORANGE);}ak.build(acoustic,kit.dress);
    }
    const sound=kit.asset('sound-treatment','Sound corner acoustic diffuser',[-w/2+1900,1700,bz+70],kit.back);
    const k=detailKit();for(let n=0;n<15;n++)k.box([55,880,45+(n%5)*25],[-490+n*70,0,0],n%3===0?ORANGE:'#8198aa');k.build(sound,kit.dress);
    kit.label(sound,'LISTEN / MIX',[900,110],[0,590,40],NAVY);
    if(l.index>=1){
        const pin=kit.asset('student-work-gallery','Student work pin-up wall',[w/2-55,2350,bz+1500],kit.right);pin.rotation.y=-Math.PI/2;
        panel(kit,pin,[2400,1120,30],[0,0,0],'#a3a9aa');for(let n=0;n<5;n++){const card=kit.mesh(pin,new THREE.PlaneGeometry(400,660),kit.canvasMat((c,W,H)=>{c.fillStyle=WHITE;c.fillRect(0,0,W,H);coastFrame(c,16,32,W-32,H*.65,n);text(c,'STUDENT / '+String(n+1).padStart(2,'0'),16,H-30,18,NAVY);},256,384),[-920+n*460,0,22]);card.rotation.z=(n%2?1:-1)*.025;}
        kit.label(pin,'STUDENT WORK / IN PROGRESS',[1800,100],[0,690,20],NAVY);
        const booth=kit.asset('voice-foley-booth','Voice & Foley recording corner',[w/2-1050,0,front-3500]),bk=detailKit();
        for(const x of [-610,610]){bk.box([65,1960,850],[x,980,0],NAVY);bk.box([480,45,80],[x,42,0],SILVER);for(const z of [-340,340])bk.ball(28,[x,28,z],INK);}
        bk.box([1220,1600,60],[0,1140,-400],'#536a80');for(let n=0;n<10;n++)bk.box([70,1250,35],[-535+n*120,1100,-358],n%2?NAVY:'#849aac');
        bk.cyl(150,155,25,[0,13,120],INK);bk.cyl(12,15,1280,[0,655,120],SILVER);bk.box([85,150,70],[0,1430,120],INK);bk.build(booth,kit.dress);
        const pop=kit.mesh(booth,new THREE.CircleGeometry(70,24),kit.mat('#202b35','fabric'),[0,1430,245]);pop.material.side=THREE.DoubleSide;
        kit.label(booth,'VOICE / FOLEY',[940,110],[0,1880,-359],NAVY);
    }
    const greenery=kit.asset('media-planter','Media lab planter',[w/2-350,0,front-370]);const pk=detailKit();plant(pk,0,0,0,.95);pk.build(greenery,kit.dress);
}
export function finishDecor(kit){
    const media=kit.byId('print-scan'),g=kit.asset('media-reference','Colour proof & reference swatches',[0,0,0],media),k=detailKit();
    for(let n=0;n<12;n++)k.box([23,3,35],[-570+n*24,908,135],['#f4efe5','#6a8eaa','#c56b50','#91ab91','#334c72','#edac57'][n%6]);k.build(g,kit.dress);
}
export function activityMaterials(k,phase,y){
    // Storyboard pages and a clapper slate, instead of generic social snacks.
    for(let n=0;n<(phase===4?5:3);n++){
        const x=-120+n*150;k.box([130,2,190],[x,y+2,30],WHITE);for(let j=0;j<3;j++)k.box([100,1,40],[x,y+3.2,-25+j*55],['#a4bfc9','#738ba4','#cfa273'][(phase+j)%3]);
    }
    k.box([200,120,12],[-490,y+70,30],INK);k.box([210,24,15],[-490,y+144,30],WHITE);
    for(let n=0;n<5;n++)k.box([18,25,16],[-580+n*40,y+144,30],INK,[0,0,.35]);
    notebook(k,350,y,-160,NAVY);k.box([90,25,60],[530,y+12,-160],INK);
}
export function atmosphere(phase,_gain,kit){
    for(const m of kit.mediaDiffusers||[])m.emissiveIntensity=phase==='afternoon'?.85:phase==='night'?.12:phase==='party'?.55:.3;
    if(kit.room.ceilingFixture)for(const g of kit.mediaCeiling||[])if(g.parent!==kit.room.ceilingFixture)kit.room.ceilingFixture.attach(g);
    kit.root.userData.mediaLab={concept:true,phase,deskCount:COUNTS[kit.layout.index],zones:['Editing','Digital art','Audio post','Capture','Print & scan','Critique','Equipment checkout']};
}
function deskProductionKit(role,size='60x30'){
    const g=new THREE.Group();g.name=role==='sound-mix'||role==='sound-design'?'Audio mixing console & interface':'Media project slate & card reader';
    const k=detailKit(),wide=size==='60x30';
    if(/sound/.test(role)){
        k.box([390,38,210],[0,19,-80],INK);for(let n=0;n<8;n++){k.cyl(9,9,9,[-153+n*43,45,-135],n%3?SILVER:ORANGE);k.box([7,3,60],[-153+n*43,40,-50],SILVER);k.box([18,8,12],[-153+n*43,47,-60+n%3*8],WHITE);}
        k.box([140,40,85],[wide?570:450,20,100],INK);for(let n=0;n<3;n++)k.cyl(9,9,8,[wide?530+n*28:410+n*28,44,100],SILVER);
    }else if(!/art|animation/.test(role)){
        k.box([110,18,70],[wide?-610:-470,9,110],INK);k.box([70,4,55],[wide?-610:-470,20,110],SILVER);
        k.box([180,10,125],[wide?570:440,6,-20],INK);for(let n=0;n<4;n++)k.box([17,2,60],[wide?520+n*25:390+n*25,12,-20],n%2?WHITE:ORANGE);
    }
    k.build(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6}));return g;
}
function deskBadge(mount,size){
    const g=new THREE.Group();g.name='OCC desk identity decal';g.userData.mediaDeskBadge=true;mount.add(g);const p=logoMap('circle').map,m=new THREE.MeshStandardMaterial({map:p,transparent:true,roughness:.9,depthWrite:false});m.userData.sharedTextures=true;
    const badge=new THREE.Mesh(new THREE.PlaneGeometry(72,72),m);badge.position.set((size==='60x30'?762:610)-105,1.3,210);badge.rotation.x=-Math.PI/2;badge.castShadow=false;g.add(badge);
}
export function stationDetail(spec,mount,_T,{role}){
    if(role==='desktop'){mount.add(deskProductionKit(spec.role,spec.size));deskBadge(mount,spec.size);}
    if(role==='shelf'&&/sound/.test(spec.role)){
        const g=new THREE.Group();g.name='Nearfield studio speakers';g.userData.mediaSpeakerPair=true;
        g.userData.deskObject={desk:'station-'+spec.id,id:'media-studio-speakers'};mount.add(g);
        for(const side of [-1,1]){
            const speaker=new THREE.Group();speaker.userData.mediaSpeakerSide=side;speaker.position.x=side*(spec.size==='60x30'?660:470);g.add(speaker);const k=detailKit();
            k.box([140,245,165],[0,122,-105],INK);k.ball(49,[0,90,-19],'#596574',[1,1,.08]);k.ball(18,[0,195,-19],SILVER,[1,1,.08]);k.box([65,3,5],[0,18,-19],ORANGE);
            k.build(speaker,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7}));
        }
    }
}
export function mainDeskDetail({role,add}){if(role==='desktop'){add(deskProductionKit('film-edit','48x30'));const g=new THREE.Group();g.name='OCC desktop identity';deskBadge(g,'48x30');add(g);}}
export function peripheralScreens(set,record,phase){
    record.group.traverse(obj=>{
        if(obj.userData.mediaSpeakerPair)for(const child of obj.children)child.position.x=child.userData.mediaSpeakerSide*(record.state.size==='60x30'?660:470);
        if(obj.userData.mediaDeskBadge)obj.children[0].position.x=(record.state.size==='60x30'?762:610)-105;
    });
    const audio=/sound/.test(record.spec?.role||''),art=/art|animation|colour/.test(record.spec?.role||'');
    for(const [id,root] of set.items){
        const screen=root.getObjectByName('monitor-screen');if(!screen?.isMesh)continue;
        let own=screen.userData.mediaLabScreen;
        if(!own){
            const variant=audio?2:art||id==='portrait-monitor'?1:0;
            const map=institutionalMap((c,W,H)=>drawScreen(c,W,H,null,variant,phase),768,432);
            if(id==='portrait-monitor'){map.center.set(.5,.5);map.rotation=-Math.PI/2;}
            own=screen.userData.mediaLabScreen={map,phase,variant};
        }
        // Captured tab/screen video takes priority over this simulated project.
        if(screen.material.map&&screen.material.map!==own.map)continue;
        if(own.phase!==phase){drawScreen(own.map.image.getContext('2d'),768,432,null,own.variant,phase);own.map.needsUpdate=true;own.phase=phase;}
        if(screen.material.map!==own.map){
            screen.material.map=own.map;screen.material.color.set('#ffffff');screen.material.emissiveMap=own.map;screen.material.emissive.set('#d2e5ff');screen.material.needsUpdate=true;
        }
        screen.material.emissiveIntensity=phase==='night'?.24:.1;
    }
}
export const stageAnchor = l => ({at:l.activity,y:740,offset:[90,-80],support:'activity-table',small:true});
export function stageKit({h,m,g,y}){h.box(g,[80,18,55],[150,y+9,50],m.ink,5);for(let n=0;n<3;n++)h.box(g,[13,2,26],[126+n*23,y+20,50],m.brass,1);}
