import * as THREE from 'three';
import { institutionalMap, detailKit, notebook, books } from './institutional-detail.mjs?v=scene-desk-styling-20261010';
import { createPoolLayer } from './room-light-pools.mjs?v=environment-expert-20261014';

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
const prop = (id, x, z, y = 0, turn = 0, scale) => ({ id, at: [x, y, z], turn, ...(scale ? { scale } : {}) });
// Compact tiers keep 600+ mm between the capture stage and the last desk row.
const compactStage = l => l.index === 0 || l.index === 2;
const roles = ['film-edit', 'sound-mix', 'digital-art', 'accessible-edit', 'colour-grade', 'animation', 'film-edit', 'sound-design', 'digital-art', 'film-edit', 'animation'];
const roleName = { 'film-edit':'Film editing', 'sound-mix':'Audio & sound mix', 'digital-art':'Digital illustration', 'accessible-edit':'Open access editing', 'colour-grade':'Colour grading', animation:'Animation & motion', 'sound-design':'Sound design' };

export const lighting = { media:{ practical:[.3,.38,.66,.28,.65],wash:[.18,.2,.15,.1,.5],task:'#e8f0fa',bounce:'#a7bfd4' } };
export const sceneOverrides = {
    occmedialab:{
        tiers:TIERS,wall:'#dcdedc',
        boardTitle:'FROM FIRST IDEA TO FINAL FRAME',
        desk:[prop('journal',-540,140),prop('headphones',530,-110)], shelf:[],
        modes:{
            // Daylight with blinds partly down; a dim neutral D65 surround for
            // colour work; a dark house for screening; a warm showcase evening.
            morning:{description:'Daylight planning · storyboards, shot lists and equipment prep',ambient:.34,exposure:1.0,height:35,tilt:0,leds:false},
            afternoon:{description:'Balanced work light · editing, animation and digital art',ambient:.38,exposure:1.0,height:28,tilt:0,leds:false},
            evening:{description:'Neutral grading surround · colour decisions and headphone mixing',key:'#e6edf7',fill:'#c9d3df',power:.32,ambient:.2,bounce:.3,practical:.55,exposure:1.0,colors:['#f2f4f7','#9fb2c6'],height:28,tilt:0,color:'#d8e8ff',leds:true},
            night:{description:'Screening · dark house, projection and quiet listening',key:'#8ea6c4',fill:'#7f97b5',power:.1,ambient:.12,bounce:.16,practical:.22,exposure:1.02,height:28,tilt:0,color:'#87b4e3',leds:true},
            party:{description:'Student reel showcase · portfolio critique and shared notes',key:'#ffe2bf',fill:'#d9cbb8',power:.7,ambient:.25,bounce:.45,practical:.8,exposure:.98,colors:['#ffd9a8','#e3c7a6'],height:35,tilt:0,color:'#f3bd79',leds:true}
        },
        layout(tier,l){
            l.name=NAMES[l.index]+' · '+COUNTS[l.index]+' desks';
            l.desk=[-l.width/2+1800,l.back+2400];
            const w=l.width,bz=l.back,front=bz+l.depth,compact=compactStage(l);
            // The critique table leaves room for seats on both sides.
            l.activity=[l.index?0:1000,front-1900];
            l.props[0].at=[l.desk[0],0,l.desk[1]+1050];
            const stage=compact?{depth:2200,backdrop:950,camera:-900,z:front-1300,talent:750}:{depth:3000,backdrop:1350,camera:-1250,z:front-1700,talent:1150};
            l.media={desks:COUNTS[l.index],capture:[-w/2+2000,stage.z],stage,print:[-w/2+820,bz+360]};
            l.props.push(prop('camera-bag',w/2-760,bz+430,1800));
            // Appended after the original list so saved placement keys stay put.
            const [ax,az]=l.activity;
            for(const dx of [-400,400])l.props.push(prop('ergoflex-designer-chair',ax+dx,az-700,0,0,.8),prop('ergoflex-designer-chair',ax+dx,az+700,0,180,.8));
            if(l.index>=2)for(const side of [-1,1])l.props.push(prop('ergoflex-designer-chair',ax+side*1000,az,0,side*-90,.8));
            // Capture: supplied camera on the tripod head and an interview stool;
            // both travel with the stage (stage local z is mirrored).
            const [cx,cz]=l.media.capture;
            l.props.push(prop('ergoflex-camera',cx,cz-stage.camera,1395,180,1.2),prop('ergoflex-tall-office-chair',cx,cz-stage.backdrop+stage.talent,0,0,.9));
            // Print counter equipment and supplies.
            l.props.push(prop('ergoflex-printer',-w/2+710,bz+360,900),prop('ergoflex-paper-tray',-w/2+1230,bz+350,900,0));
            l.props.push(prop('ergoflex-trash-can',l.index>=2?-w/2+3350:-w/2+1700,bz+350,0,0,.8),prop('ergoflex-trash-can',w/2-350,front-2600,0,0,.8));
            l.props.push(prop('ergoflex-small-bookshelf',w/2-2600,bz+300),prop('ergoflex-plant-2',w/2-350,front-370));
            if(l.index>=3){
                // Screening & critique lounge between the last row and the critique table.
                const lz=front-(l.index===3?4600:6000);
                l.media.lounge={at:[w*.22,lz],display:[w*.22,front-(l.index===3?2600:3800)]};
                l.props.push(prop('ergoflex-couch',w*.22,lz),prop('ergoflex-designer-chair',w*.22-1500,lz+500,0,25,.8),prop('ergoflex-designer-chair',w*.22+1500,lz+500,0,-25,.8));
            }
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
export const floor = (_spec,w,d) => {
    const map=institutionalMap((c,W,H)=>{
        for(let row=0;row<2;row++)for(let col=0;col<2;col++){
            c.fillStyle=['#4d5560','#4a525d','#50585f','#4b535c'][row*2+col];c.fillRect(col*256,row*256,256,256);
            c.strokeStyle='#c1cbd20c';c.lineWidth=1;
            for(let n=0;n<85;n++){c.beginPath();const p=n*3;if((row+col)%2){c.moveTo(col*256,row*256+p);c.lineTo(col*256+256,row*256+p);}else{c.moveTo(col*256+p,row*256);c.lineTo(col*256+p,row*256+256);}c.stroke();}
        }
        for(let n=0;n<20000;n++){c.fillStyle=n%2?'#7d879426':'#2f353d30';c.fillRect(rnd(n)*W,rnd(n+77)*H,2,4);}
        c.strokeStyle='#2b313822';c.lineWidth=2;c.strokeRect(0,0,W,H);
    },512,512);
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(w/1000,d/1000);map.anisotropy=4;
    return {map,roughness:.95,surface:'fabric'};
};
const rnd=n=>{const f=Math.sin(n*127.1+311.7)*43758.5453;return f-Math.floor(f);};
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
// Media content stays true to colour: a white emissive tint, levels per phase.
function screenMaterial(kit,variant=0){
    const m=kit.canvasMat((c,W,H)=>drawScreen(c,W,H,kit.spec,variant));m.emissive.set('#ffffff');m.emissiveMap=m.map;m.emissiveIntensity=.16;m.userData.screenVariant=variant;kit.screenMats.push(m);return m;
}
function screen(kit,parent,size,at,variant=0){
    const m=screenMaterial(kit,variant);
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
    kit.room.decorateProp=(object,placement)=>{
        if(placement.id!=='ergoflex-couch'||object.userData.milanoSofa)return;const copies=new Map();
        object.traverse(o=>{if(!o.isMesh)return;const swap=m=>{if(!/upholstery/i.test(m?.name||''))return m;if(!copies.has(m)){const c=m.clone();c.color.set('#2f3a48');c.userData.roomPaletteLocked=true;kit.room.ownedMaterials?.add(c);copies.set(m,c);}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);});
    };
    const print=kit.cabinet('print-scan',[-w/2+820,0,bz+360],1300,900,false);print.name='Print & scan counter';
    // The supplied printer and paper tray sit on the counter and move with it.
    const k=detailKit();books(k,-540,900,-30,3);
    for(const [id,x,z] of [['ergoflex-printer',-w/2+710,bz+360],['ergoflex-paper-tray',-w/2+1230,bz+350]])kit.room.propSupports.push({obj:print,id,at:[x,900,z]});k.build(print,kit.dress||mat('#ffffff','powder',{vertexColors:true}));label(print,'PRINT / SCAN',[950,110],[0,640,228],NAVY);
    if(l.index>=2){
        const lfp=asset('large-format-printer','Large-format poster printer',[-w/2+2350,0,bz+420]),pk=detailKit();
        pk.box([1600,330,520],[0,960,0],'#c9ced2');pk.box([1560,40,500],[0,1145,0],INK);pk.box([1500,120,180],[0,760,170],'#c9ced2');pk.add(new THREE.CylinderGeometry(55,55,1450,16),[0,740,240],WHITE,[1,1,1],[0,0,Math.PI/2]);
        for(const x of [-720,720]){pk.box([60,760,60],[x,400,0],SILVER);pk.box([60,40,560],[x,20,0],SILVER);for(const z of [-250,250])pk.ball(28,[x,28,z],INK);}
        pk.box([1300,8,420],[0,420,250],'#5b6672',[-.35,0,0]);pk.box([140,70,8],[560,1060,264],'#2f6fb0');pk.build(lfp,kit.dress||mat('#ffffff','powder',{vertexColors:true}));
        label(lfp,'POSTER / LARGE FORMAT',[900,90],[0,1240,270],NAVY);
    }
    const storage=byId('storage');if(storage){storage.name='Camera & equipment checkout';for(const o of storage.children)if(o.isMesh&&o.position.z>=210)o.visible=false;label(storage,'EQUIPMENT / CHECKOUT',[1120,130],[0,1660,231],NAVY);}
    const critique=byId('activity-table');critique.name='Storyboard & critique table';label(critique,'PLAN / REVIEW',[960,85],[0,680,333],NAVY);
    // Critique seating is supplied designer chairs around the table (layout props).
    // Large review display and flanking nearfields sit on the back wall.
    // A projection screen: white case, black masking border and the reel image.
    const reelW=Math.min(w*.36,3700),review=asset('reel-screen','Student reel screening display',[0,0,bz+92],kit.back);
    kit.box(review,[reelW+160,1450+160,40],[0,1780,-8],kit.mat('#eef0ee','powder'),6);kit.box(review,[reelW+60,1450+60,8],[0,1780,16],kit.mat('#111418','fabric'),2);
    const reel=kit.mesh(review,new THREE.PlaneGeometry(reelW,1450),screenMaterial(kit,3),[0,1780,22]);reel.castShadow=false;kit.reelScreen=reel;
    for(const x of [-1,1]){
        const speaker=asset('review-speaker-'+x,'Wall review speaker',[x*(Math.min(w*.36,3700)/2+250),1730,bz+150],kit.back);box(speaker,[220,520,200],[0,0,0],kit.ink,12);
        for(const [y,r] of [[-75,68],[150,25]]){const cone=kit.mesh(speaker,new THREE.CylinderGeometry(r,r,8,24),kit.mat('#445366','rubber'),[0,y,104]);cone.rotation.x=Math.PI/2;}
    }
    // Capture set: cyclorama roll, camera tripod, two softboxes and floor tape.
    // Green-screen practice: talent well off the backdrop, the camera 2+ m back.
    const sg=l.media.stage,stage=asset('capture-stage','Capture stage · camera, backdrop & softboxes',[l.media.capture[0],0,l.media.capture[1]]);
    stage.rotation.y=Math.PI;const back=sg.backdrop,cam=sg.camera,mid=(back+cam)/2;
    box(stage,[sg.depth===3000?2800:2600,15,sg.depth],[0,7.5,mid],mat('#8d9196','stone'),14);
    const chroma=kit.material('#1fa64a',{roughness:1,side:THREE.DoubleSide});chroma.userData.roomSurface='fabric';
    const roll=box(stage,[2350,2220,35],[0,1130,back],chroma,4);
    // Cove sweep and floor sheet so the key never shows a hard corner.
    const cove=kit.mesh(stage,new THREE.CylinderGeometry(450,450,2350,16,1,true,Math.PI*1.5,Math.PI/2),chroma,[0,465,back-465]);cove.rotation.z=Math.PI/2;
    box(stage,[2350,4,Math.max(700,back-cam-1700)],[0,17,back-465-Math.max(700,back-cam-1700)/2],chroma,2);
    box(stage,[2450,32,45],[0,2260,back],kit.metal,6);
    for(const x of [-1240,1240])box(stage,[30,2270,30],[x,1135,back],kit.ink,4);
    const capture=detailKit();tripod(capture,0,0,cam,1380);capture.box([150,24,160],[0,1370,cam],INK);
    const spread=sg.depth===3000?1300:1150,heads=[[-spread,back-650,1750,.8],[spread,back-650,1750,-.8],[-700,cam+500,1600,.6]];
    for(const [x,z,hgt] of heads){tripod(capture,x,0,z,hgt);capture.box([38,330,25],[x,hgt+170,z],INK);for(let n=0;n<3;n++){const a=n*Math.PI*2/3;capture.ball(55,[x+Math.sin(a)*240,40,z+Math.cos(a)*240],'#2b2f33',[1,.35,.6]);}}
    // Talent mark: an orange T between the camera and the backdrop.
    capture.box([420,3,40],[0,18,back-sg.talent+250],ORANGE);capture.box([40,3,300],[0,18,back-sg.talent+380],ORANGE);
    capture.build(stage,mat('#ffffff','powder',{vertexColors:true}));
    kit.room.propSupports.push({obj:stage,id:'ergoflex-camera',at:[l.media.capture[0],1395,l.media.capture[1]-cam]},{obj:stage,id:'ergoflex-tall-office-chair',at:[l.media.capture[0],0,l.media.capture[1]-back+sg.talent]});
    kit.mediaDiffusers=[];
    for(const [x,z,hgt,turn] of heads){
        // Softbox: a black four-sided fabric frustum with a white diffuser face.
        const head=new THREE.Group();head.position.set(x,hgt+150,z);head.rotation.y=turn;stage.add(head);
        const box4=kit.mesh(head,new THREE.CylinderGeometry(120,340,400,4,1,false),kit.mat('#1b1e22','fabric'),[0,0,-150]);box4.rotation.set(-Math.PI/2,Math.PI/4,0);
        const glow=kit.material('#f3f5ef',{emissive:'#e6efff',emissiveIntensity:.35,roughness:.75});kit.mesh(head,new THREE.PlaneGeometry(470,470),glow,[0,0,52]).castShadow=false;kit.mediaDiffusers.push(glow);
    }
    kit.label(stage,'CAPTURE / LIGHT / ACTION',[1450,120],[0,220,back+70],NAVY);
    // Keep stage dressing within its fixture; camera cutaway affects ceilings only.
    roll.userData.mediaBackdrop=true;
    const ceilingProjector=asset('ceiling-projector','Ceiling-mounted review projector',[0,kit.ceiling-370,bz+3300]);ceilingProjector.rotation.y=Math.PI;
    box(ceilingProjector,[380,170,320],[0,0,0],kit.trim,15);kit.mesh(ceilingProjector,new THREE.CylinderGeometry(45,45,12,24),kit.ink,[0,-15,-166]).rotation.x=Math.PI/2;
    box(ceilingProjector,[30,260,30],[0,190,0],kit.metal,4);ceilingProjector.userData.presentationOnly=true;kit.mediaCeiling=[ceilingProjector];
    // Projector beam: an additive open frustum from the lens to the screen.
    const lens=new THREE.Vector3(0,kit.ceiling-385,bz+3134),corners=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([sx,sy])=>new THREE.Vector3(sx*reelW/2,1780+sy*725,bz+115));
    const beam=new THREE.BufferGeometry().setFromPoints(corners.flatMap((c,n)=>[lens,c,corners[(n+1)%4]]));beam.setAttribute('color',new THREE.Float32BufferAttribute(corners.flatMap(()=>[1,1,1,.15,.15,.15,.15,.15,.15]),3));
    const beamMat=new THREE.MeshBasicMaterial({color:'#000000',vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    const ray=new THREE.Mesh(beam,beamMat);ray.name='Projector beam';ray.raycast=()=>{};ray.castShadow=false;ray.frustumCulled=false;kit.root.add(ray);kit.mediaCeiling.push(ray);kit.mediaBeam=beamMat;
}
export function dressProp(id,k,_g,kit){
    if(id==='storage'){
        for(let n=0;n<3;n++){const y=290+n*420;k.box([1080,24,410],[0,y,0],SILVER);for(let j=0;j<3;j++){const x=-350+j*350;k.box([265,170,250],[x,y+100,5],INK);k.box([65,20,5],[x,y+105,133],ORANGE);k.box([95,10,20],[x,y+193,5],SILVER);}}
        // Open upper doors read as a checkout cabinet, with labelled hard cases.
    }
}
// Student work varies: storyboard, type poster, animation cels, colour study, sound.
function pinupMotif(c,x,y,w,h,n){
    if(n===0){c.strokeStyle=INK;c.lineWidth=2;for(let r=0;r<3;r++)for(let k=0;k<2;k++){const fx=x+6+k*w/2,fy=y+6+r*h/3;c.strokeRect(fx,fy,w/2-12,h/3-16);c.beginPath();c.arc(fx+20+k*18,fy+h/6,8,0,Math.PI*2);c.moveTo(fx+28+k*18,fy+h/6);c.lineTo(fx+w/2-30,fy+h/3-24);c.stroke();}}
    else if(n===1){c.fillStyle=ORANGE;c.fillRect(x,y,w,h);c.fillStyle=NAVY;c.font=`900 ${Math.round(w*.24)}px "DejaVu Sans", sans-serif`;c.fillText('FRAME',x+8,y+h*.42);c.fillText('BY',x+8,y+h*.66);c.fillText('FRAME',x+8,y+h*.9);}
    else if(n===2){for(let k=0;k<4;k++){const cx=x+w*.2+k*w*.2,cy=y+h*(.55-k*.08);c.fillStyle=['#d9e6ef','#c6d8e6','#b3cadd','#a0bcd4'][k];c.fillRect(x+k*w*.06,y+k*h*.05,w*.8,h*.8);c.fillStyle=ORANGE;c.beginPath();c.arc(cx,cy,w*.08,0,Math.PI*2);c.fill();}}
    else if(n===3){const cx=x+w/2,cy=y+h/2,r=Math.min(w,h)*.42;for(let a=0;a<24;a++){c.fillStyle=`hsl(${a*15},60%,55%)`;c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r,a*Math.PI/12,(a+1.05)*Math.PI/12);c.fill();}}
    else{c.fillStyle='#0d1a2a';c.fillRect(x,y,w,h);for(let row=0;row<3;row++){c.strokeStyle=['#80c0d1','#f3ad62','#91bb98'][row];c.lineWidth=2;c.beginPath();for(let k=0;k<60;k++)c.lineTo(x+k*w/60,y+h*(.25+row*.25)+Math.sin(k*.9+row)*Math.sin(k*.2)*h*.09);c.stroke();}}
}
function poster(kit,id,title,at,wall,index){
    const g=kit.asset(id,title,at,wall),m=kit.canvasMat((c,W,H)=>{
        c.fillStyle=index%2?WHITE:NAVY;c.fillRect(0,0,W,H);
        if(index%3===0){c.fillStyle=INK;c.fillRect(20,55,W-40,H*.58);for(let n=0;n<3;n++)coastFrame(c,52,78+n*H*.18,W-104,H*.15,n+1);c.fillStyle='#e8e2d6';for(let n=0;n<14;n++){c.fillRect(28,62+n*H*.04,14,16);c.fillRect(W-42,62+n*H*.04,14,16);}}
        else if(index%3===1){const cx=W/2,cy=55+H*.29,r=H*.25;for(let a=0;a<36;a++){c.fillStyle=`hsl(${a*10},62%,55%)`;c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r,a*Math.PI/18,(a+1.05)*Math.PI/18);c.fill();}const g=c.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'#ffffffee');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();}
        else{c.fillStyle='#0d1a2a';c.fillRect(20,55,W-40,H*.58);for(let row=0;row<4;row++){c.strokeStyle=['#80c0d1','#f3ad62','#91bb98','#edf0ec'][row];c.lineWidth=2;c.beginPath();for(let n=0;n<120;n++){const v=Math.sin(n*.7+row*2)*Math.sin(n*.13+row)*Math.cos(n*.05);c.lineTo(30+n*(W-60)/120,95+row*H*.13+v*H*.05);}c.stroke();}}text(c,title.toUpperCase(),22,H-63,21,index%2?NAVY:WHITE);text(c,'OCC / FILM + MEDIA ARTS',22,H-24,12,index%2?NAVY:'#b6cde1');c.fillStyle=ORANGE;c.fillRect(20,20,W-40,9);
    },512,720);kit.box(g,[640,900,25],[0,0,-8],kit.ink,5);kit.mesh(g,new THREE.PlaneGeometry(610,865),m,[0,0,6]);return g;
}
export function decorate(kit){
    const {w,bz,front,layout:l}=kit,ready=[];
    const identity=kit.byId('room-sign');identity.position.y=2800;
    const circle=kit.asset('occ-circle','OCC coast identity mark',[-1600,2800,bz+75],kit.back);ready.push(logo(circle,'circle',[310,310],[0,0,0]));
    const pirate=kit.asset('occ-pirate','OCC Pirates media arts badge',[w/2-620,2450,bz+90],kit.back);ready.push(logo(pirate,'pirate',[540,540],[0,0,0]));
    const title=kit.asset('occ-wordmark','Orange Coast College wordmark',[-w/2+750,2440,bz+90],kit.back);kit.box(title,[740,550,28],[0,0,-17],kit.mat(NAVY,'powder'),8);ready.push(logo(title,'title',[660,490],[0,0,0]));
    kit.byId('wall-clock')?.position.set(-2350,2780,bz+65);
    // Navy acoustic-fabric wainscot with an orange cap replaces the loud accent
    // band; the right wall continues it either side of the door.
    const fabric=kit.material('#ffffff',{roughness:.97,map:institutionalMap((c,W,H)=>{c.fillStyle='#0b2f5f';c.fillRect(0,0,W,H);for(let y=0;y<H;y+=3){c.fillStyle=y%6?'#ffffff07':'#00000012';c.fillRect(0,y,W,1);}for(let x=0;x<W;x+=3){c.fillStyle='#00000009';c.fillRect(x,0,1,H);}},256,256)});
    fabric.map.wrapS=fabric.map.wrapT=THREE.RepeatWrapping;fabric.map.repeat.set(w/600,2);fabric.userData.roomSurface='fabric';
    const band=kit.back.children.find(o=>o.isMesh&&o.material===kit.accent&&Math.abs(o.position.y-325)<1);
    if(band){band.visible=false;}
    const wk=new THREE.Group();wk.name='Navy acoustic wainscot';wk.userData.presentationOnly=true;kit.back.add(wk);
    kit.box(wk,[w,1200,14],[0,600,bz+7],fabric,2);kit.box(wk,[w,40,24],[0,1220,bz+12],kit.mat(ORANGE,'powder'),3);
    const rk=new THREE.Group();rk.name='Navy acoustic wainscot';rk.userData.presentationOnly=true;kit.right.add(rk);
    const doorA=front-2140,doorB=front-1060;
    for(const [z0,z1] of [[bz,doorA],[doorB,front]])if(z1-z0>50){const rf=fabric.clone();rf.map=fabric.map.clone();rf.map.repeat.set((z1-z0)/600,2);kit.box(rk,[14,1090,z1-z0],[w/2-25,655,(z0+z1)/2],rf,2);kit.box(rk,[24,40,z1-z0],[w/2-30,1220,(z0+z1)/2],kit.mat(ORANGE,'powder'),3);}
    const lk=new THREE.Group();lk.name='Navy acoustic wainscot';lk.userData.presentationOnly=true;kit.left.add(lk);
    const wc=bz+kit.d*.54,wo=kit.d*.48,cap=kit.mat(ORANGE,'powder');
    for(const [z0,z1,top] of [[bz,wc-wo/2,1200],[wc-wo/2,wc+wo/2,790],[wc+wo/2,front,1200]]){
        const lf=fabric.clone();lf.map=fabric.map.clone();lf.map.repeat.set((z1-z0)/600,2*top/1200);
        kit.box(lk,[14,top,z1-z0],[-w/2+7,top/2,(z0+z1)/2],lf,2);kit.box(lk,[24,40,z1-z0],[-w/2+12,top+20,(z0+z1)/2],cap,3);
    }
    // Window blinds: partly down for editing, blackout for screening.
    const slats=institutionalMap((c,W,H)=>{c.fillStyle='#d9dcd8';c.fillRect(0,0,W,H);for(let y=0;y<H;y+=16){c.fillStyle='#b9bdb8';c.fillRect(0,y,W,2);c.fillStyle='#eef0ec';c.fillRect(0,y+3,W,2);}},64,256);
    slats.wrapT=THREE.RepeatWrapping;slats.repeat.set(1,6);
    const blind=kit.mesh(kit.window,new THREE.PlaneGeometry(kit.d*.48,1750),kit.material('#ffffff',{map:slats,roughness:.8}),[0,0,12]);blind.castShadow=false;blind.name='Window blind';kit.mediaBlind=blind;
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
    const k=detailKit();k.box([1080,900,30],[0,0,-10],'#8a6f50');for(let n=0;n<15;n++)k.box([55,880,45+(n%5)*25],[-490+n*70,0,0],n%2?'#b89a74':'#a3865f');k.build(sound,kit.dress);
    kit.label(sound,'LISTEN / MIX',[900,110],[0,590,40],NAVY);
    if(l.index>=1){
        const pin=kit.asset('student-work-gallery','Student work pin-up wall',[w/2-55,1450,bz+1500],kit.right);kit.mediaGallery=pin;pin.rotation.y=-Math.PI/2;
        panel(kit,pin,[2400,1120,30],[0,0,0],'#a3a9aa');for(let n=0;n<5;n++){const card=kit.mesh(pin,new THREE.PlaneGeometry(400,660),kit.canvasMat((c,W,H)=>{c.fillStyle=WHITE;c.fillRect(0,0,W,H);pinupMotif(c,16,32,W-32,H*.65,n);text(c,'STUDENT / '+String(n+1).padStart(2,'0'),16,H-30,18,NAVY);},256,384),[-920+n*460,0,22]);card.rotation.z=(n%2?1:-1)*.025;}
        kit.label(pin,'STUDENT WORK / IN PROGRESS',[1800,100],[0,640,20],NAVY);
        const booth=kit.asset('voice-foley-booth','Voice & Foley recording corner',[w/2-1050,0,front-3500]),bk=detailKit();
        for(const x of [-610,610]){bk.box([65,1960,850],[x,980,0],NAVY);bk.box([480,45,80],[x,42,0],SILVER);for(const z of [-340,340])bk.ball(28,[x,28,z],INK);}
        bk.box([1220,1600,60],[0,1140,-400],'#536a80');for(let n=0;n<10;n++)bk.box([70,1250,35],[-535+n*120,1100,-358],n%2?NAVY:'#849aac');
        bk.box([1285,40,900],[0,1980,0],NAVY);
        // Studio condenser in a shock mount on a boom stand.
        bk.cyl(150,155,25,[0,13,120],INK);bk.cyl(12,15,1280,[0,655,120],SILVER);bk.box([20,20,260],[0,1300,40],SILVER);
        bk.add(new THREE.CylinderGeometry(22,22,140,16),[0,1350,-90],'#c9cfd4');bk.add(new THREE.TorusGeometry(48,5,6,20),[0,1350,-90],INK,[1,1,1],[Math.PI/2,0,0]);
        bk.build(booth,kit.dress);
        const onAir=kit.material('#e0352b',{emissive:'#ff3b2e',emissiveIntensity:.15,roughness:.4});kit.box(booth,[440,130,60],[0,2070,380],onAir,8);kit.mediaOnAir=onAir;
        kit.label(booth,'ON AIR',[360,90],[0,2070,412],'#e0352b');
        const pop=kit.mesh(booth,new THREE.CircleGeometry(70,24),kit.mat('#202b35','fabric'),[0,1350,10]);pop.material.side=THREE.DoubleSide;
        kit.label(booth,'VOICE / FOLEY',[940,110],[0,1880,-359],NAVY);
    }
    if(l.media.lounge){
        // Rolling 75-inch review display facing the screening lounge.
        const [dx,dz]=l.media.lounge.display,display=kit.asset('mobile-review-display','Rolling review display',[dx,0,dz]);display.rotation.y=Math.PI;
        const dk=detailKit();dk.box([760,40,560],[0,60,0],INK);for(const x of [-330,330])for(const z of [-230,230])dk.ball(30,[x,30,z],INK);dk.box([90,1300,70],[0,700,0],SILVER);dk.build(display,kit.dress);
        screen(kit,display,[1660,940],[0,1450,40],1);
    }
    pools(kit);
}
// Additive pools for the screen, desk columns and the work wall; no lights.
function pools(kit){
    const {w,bz,layout:l}=kit,layer=createPoolLayer(kit.root,'Media lab light pools');kit.mediaPools=layer;
    layer.add(kit.root,[0,4,bz+1400],[4400,2600],'#6f93c8',[.05,.04,.1,.36,.18]);
    const columns=l.index===0?2:l.index<3?3:4,xs=columns===2?[-w/2+1800,w/2-2100]:Array.from({length:columns},(_,n)=>-w/2+1800+n*(w-3600)/(columns-1));
    // Only occupied workstation slots get a task-light pool.
    for(let n=0;n<COUNTS[l.index];n++)layer.add(kit.root,[xs[n%columns],3,bz+2400+Math.floor(n/columns)*4000+300],[1900,1500],'#eef3fb',[.04,.04,.14,.1,.18]);
    if(kit.mediaGallery)layer.add(kit.mediaGallery,[0,100,40],[2800,1700],'#ffd6a2',[.03,.03,.05,.04,.6],'back');
    const critique=kit.byId('activity-table');if(critique)layer.add(critique,[0,4,0],[2400,1600],'#ffd9a8',[0,0,.05,.04,.35]);
}
export function finishDecor(kit){
    const media=kit.byId('print-scan'),g=kit.asset('media-reference','Colour proof & reference swatches',[0,0,0],media),k=detailKit();
    for(let n=0;n<12;n++)k.box([23,3,35],[140+n*24,908,205],['#f4efe5','#6a8eaa','#c56b50','#91ab91','#334c72','#edac57'][n%6]);k.build(g,kit.dress);
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
export function atmosphere(phase,gain,kit){
    for(const m of kit.mediaDiffusers||[])m.emissiveIntensity=phase==='afternoon'?.85:phase==='night'?.12:phase==='party'?.55:.3;
    const p=phaseIndex(phase);
    for(const m of kit.screenMats)if(m.userData.screenVariant===3)m.emissiveIntensity=[.3,.3,.45,1,.85][p];
    // Screening and showcase: room light 1 becomes the screen's spill.
    const spill=kit.lights?.[1];if(spill){
        spill.userData.authored??={at:spill.position.clone()};
        if(phase==='night'||phase==='party'){spill.position.set(0,1500,kit.bz+1600);spill.color.set(phase==='night'?'#8fb3e0':'#ffd6aa');spill.intensity=(kit.root.scale.x*1000)**2*(phase==='night'?3.5:2.2)*gain;}
        else spill.position.copy(spill.userData.authored.at);
    }
    if(p===2||p===4){const c=kit.sky.map.image.getContext('2d'),W=c.canvas.width,H=c.canvas.height;c.save();c.globalCompositeOperation='multiply';c.globalAlpha=p===2?.55:.35;c.fillStyle=p===2?'#5a6478':'#c9a27a';c.fillRect(0,0,W,H);c.restore();kit.sky.map.needsUpdate=true;}
    if(kit.mediaBlind){const drop=[.15,.35,.75,1,.85][p],b=kit.mediaBlind;b.scale.y=drop;b.position.y=875*(1-drop);b.material.map.repeat.y=6*drop;}
    if(kit.mediaBeam)kit.mediaBeam.color.setScalar([0,0,0,.09,.05][p]);
    if(kit.mediaOnAir)kit.mediaOnAir.emissiveIntensity=[.15,.15,.8,.8,.3][p];
    kit.mediaPools?.apply(p,gain);
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

}
export const stageAnchor = l => ({at:l.activity,y:740,offset:[90,-80],support:'activity-table',small:true});
export function stageKit({h,m,g,y}){h.box(g,[80,18,55],[150,y+9,50],m.ink,5);for(let n=0;n<3;n++)h.box(g,[13,2,26],[126+n*23,y+20,50],m.brass,1);}
