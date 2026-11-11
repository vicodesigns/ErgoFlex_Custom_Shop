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
const SLATE = '#36424f', CHARCOAL = '#182028', BRASS = '#c99b52', TEAL = '#4d92a8', CORK = '#bfa582';
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
            morning:{description:'Daylight planning · call sheets, shot lists and equipment checkout',power:1.1,ambient:.32,exposure:1.0,height:35,tilt:0,leds:false},
            afternoon:{description:'Balanced work light · rough cuts, print proofs and shared edit notes',power:1.3,ambient:.35,exposure:1.0,height:28,tilt:0,leds:false},
            evening:{description:'Neutral grading surround · reference swatches, cue sheets and headphone mixing',key:'#e6edf7',fill:'#c9d3df',power:.24,ambient:.22,bounce:.3,practical:.36,exposure:1.0,colors:['#f2f4f7','#9fb2c6'],height:28,tilt:0,color:'#637788',leds:true},
            night:{description:'Late edit · one bay lit by its screens and a task light, the lab dark around it',key:'#8ea6c4',fill:'#7f97b5',power:.06,ambient:.09,bounce:.11,practical:.14,exposure:1.04,height:28,tilt:0,color:'#344653',leds:true},
            party:{description:'Screening & wrap · student reels on the big screen, house lights down, food on the critique table',key:'#ffe2bf',fill:'#d9cbb8',power:.12,ambient:.14,bounce:.2,practical:.8,exposure:1.02,colors:['#ffd9a8','#e3c7a6'],height:35,tilt:0,color:'#f3bd79',leds:true}
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
            // Screening & wrap: food on the critique table (party only).
            for(const [id,dx,dz,turn] of WRAP_FOOD)l.props.push({...prop(id,ax+dx,az+dz,742,turn),phases:['party']});
            // Bags at the feet of every other bay, on the side away from the chair's swing.
            for(const [n,s] of (l.stations||[]).entries()){
                if(n%3===1)continue;
                const a=(s.turn||0)*Math.PI/180,side=n%2?1:-1,ox=side*(s.size==='48x30'?920:1080),oz=180;
                l.props.push(prop(n%3?'backpack':'backpack-daypack',s.at[0]+Math.cos(a)*ox+Math.sin(a)*oz,s.at[1]-Math.sin(a)*ox+Math.cos(a)*oz,0,(s.turn||0)+side*70));
            }
        }
    }
};
const WRAP_FOOD=[['takeout-boxes',-430,-40,15],['coffee-cups',440,-150,0],['soda-bottle',560,60,0]];
export function stations(_id,l){
    const i=l.index, columns=i===0?2:i<3?3:4;
    const xs=columns===2?[-l.width/2+1800,l.width/2-2100]:Array.from({length:columns},(_,n)=>-l.width/2+1800+n*(l.width-3600)/(columns-1));
    const slots=Array.from({length:COUNTS[i]},(_,n)=>[xs[n%columns],l.back+2400+Math.floor(n/columns)*4000]);
    return slots.slice(1).map((at,n)=>{
        const role=roles[n],narrow=role==='accessible-edit'||(i===0&&role==='digital-art');
        return {id:role+'-'+String(n+1).padStart(2,'0'),name:roleName[role]+' '+(n+1),role,
            at,size:narrow?'48x30':'60x30',turn:i>=3&&Math.floor((n+1)/columns)===2?180:0,height:28,tilt:0,chair:role!=='accessible-edit',
            // Each bay is someone's: a mug, a bottle or loose notes, by seat.
            desktop:[prop('headphones',narrow?-470:-610,-130),...(role==='digital-art'||role==='animation'?[prop('sketchbook',narrow?430:620,110,1)]:[]),
                ...[[prop('insulated-mug',narrow?-280:-360,190)],[prop('water-bottle',narrow?300:400,200)],[],[prop('papers',narrow?230:300,170,0,-12)],[prop('insulated-mug',narrow?260:330,200)]][n%5]],shelf:[]};
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
    const sky=c.createLinearGradient(x,y,x,y+h);
    sky.addColorStop(0,phase===3?'#0f2442':phase===2?'#2c587c':'#3f8eb8');
    sky.addColorStop(.58,phase===3?'#274669':phase===2?'#d68a59':'#8ec5db');
    sky.addColorStop(1,phase===3?'#4f667f':'#f2c292');
    c.fillStyle=sky;c.fillRect(x,y,w,h);
    // Sun / moon disc over the Pacific horizon.
    c.fillStyle=phase===3?'#e3eef8':'#ffe7ba';
    c.beginPath();c.arc(x+w*(.72-phase*.07),y+h*(phase===2?.44:.26),Math.max(4,h*.09),0,Math.PI*2);c.fill();
    // Distant Catalina / coastal headland silhouette.
    c.fillStyle=phase===3?'#1b334f':'#3b698c';
    c.beginPath();c.moveTo(x,y+h*.53);c.quadraticCurveTo(x+w*.22,y+h*.43,x+w*.48,y+h*.52);c.quadraticCurveTo(x+w*.74,y+h*.46,x+w,y+h*.53);c.lineTo(x+w,y+h*.58);c.lineTo(x,y+h*.58);c.fill();
    // Ocean water & whitewater surf lines.
    c.fillStyle=phase===3?'#1c3d5e':'#2b5d82';c.fillRect(x,y+h*.53,w,h*.47);
    c.strokeStyle='#e8f4fa88';c.lineWidth=Math.max(1,h*.015);
    for(let r=0;r<2;r++){c.beginPath();c.moveTo(x+w*.08,y+h*(.61+r*.07));c.quadraticCurveTo(x+w*.45,y+h*(.58+r*.07),x+w*.92,y+h*(.66+r*.07));c.stroke();}
    // Sandy beach berm.
    c.fillStyle=phase===3?'#6d665c':'#d8ba8a';c.beginPath();c.moveTo(x,y+h);c.lineTo(x+w*.45,y+h*.62);c.lineTo(x+w,y+h*.87);c.lineTo(x+w,y+h);c.fill();
    // Coastal palms.
    c.fillStyle='#1d333d';
    for(let n=0;n<4;n++){
        const px=x+w*(.12+n*.23),py=y+h*.66;
        c.fillRect(px,py-h*.41,Math.max(1.5,w*.009),h*.41);
        for(let side=-1;side<=1;side+=2){
            c.beginPath();c.ellipse(px+side*w*.03,py-h*.39,w*.055,h*.024,side*.35,0,Math.PI*2);c.fill();
            c.beginPath();c.ellipse(px+side*w*.022,py-h*.41,w*.045,h*.02,side*.12,0,Math.PI*2);c.fill();
        }
    }
}
export function drawScreen(c,W,H,_spec,variant=0,phase='morning'){
    const p=phaseIndex(phase);
    c.fillStyle='#0d1622';c.fillRect(0,0,W,H);
    c.fillStyle=NAVY;c.fillRect(0,0,W,46);
    c.fillStyle=ORANGE;c.fillRect(0,44,W,3);
    text(c,['OCC / STUDENT REEL · NON-LINEAR EDIT','COLOUR & COMPOSITION · DAVINCI RESOLVE','AUDIO POST / ADM DOLBY MIX','PORTFOLIO / SCREENING MASTER'][variant%4],22,30,18);
    text(c,['TC 01:00:14:08','TC 01:04:22:19','TC 01:08:05:12','TC 01:12:40:00'][p]||`TC 01:0${p}:18:04`,W-168,30,14,'#9fc0de');
    if(variant%4===2){
        text(c,'STEMS · DIALOGUE / AMBIENCE / FOLEY / SCORE',24,76,16,'#a9c4df');
        for(let row=0;row<5;row++){
            const y=96+row*(H-156)/5,rh=(H-180)/5;
            c.fillStyle=row%2?'#1c2f42':'#152536';c.fillRect(24,y,W-118,rh);
            c.fillStyle=['#3e7ca0','#d67c2c','#488966','#7c6aa8','#b05252'][row];c.fillRect(24,y,6,rh);
            c.strokeStyle=['#80c0d1','#f3ad62','#91bb98','#c5b3e6','#e39696'][row];c.lineWidth=2;
            c.beginPath();
            for(let n=0;n<110;n++){
                const v=Math.sin(n*.83+row)*Math.sin(n*.19+row)*Math.cos(n*.13);
                c.lineTo(36+n*(W-140)/110,y+rh*.5+v*rh*.38);
            }
            c.stroke();
        }
        // Right-hand master stereo LUFS meter bridge.
        c.fillStyle='#142230';c.fillRect(W-82,96,58,H-152);
        for(let b=0;b<18;b++){
            const by=H-68-b*13;
            c.fillStyle=b>14?'#e05246':b>11?ORANGE:'#56b886';
            if(b<=13+(p%3))c.fillRect(W-72,by,16,9);
            if(b<=12+(p%4))c.fillRect(W-48,by,16,9);
        }
    }else if(variant%4===1){
        coastFrame(c,22,66,W*.53,H*.49,p);
        c.strokeStyle='#ffffff44';c.lineWidth=1;c.strokeRect(22,66,W*.53,H*.49);
        text(c,'RGB PARADE / VECTORSCOPE',W*.59,86,16,'#a9c4df');
        c.fillStyle='#14202e';c.fillRect(W*.59,98,W*.38,H*.38);
        for(let k=0;k<3;k++){
            c.strokeStyle=['#e06655','#7ec492','#69a2d8'][k];c.lineWidth=2;c.beginPath();
            for(let n=0;n<55;n++)c.lineTo(W*(.60+k*.12)+n*W*.002,H*.33-Math.sin(n*.11+k)*H*.09);
            c.stroke();
        }
        for(let n=0;n<9;n++){
            c.fillStyle=['#edc490','#d99156','#709c97','#2c6792','#182e50'][n%5];
            c.fillRect(24+n*(W-48)/9,H*.72,(W-68)/9,H*.14);
        }
    }else{
        coastFrame(c,24,64,W*.66,H*.48,p);
        c.strokeStyle='#ffffff38';c.lineWidth=1.5;c.strokeRect(24,64,W*.66,H*.48);
        // Rule-of-thirds safe-title guides on the program monitor.
        c.strokeStyle='#ffffff1c';c.lineWidth=1;
        for(const f of [1/3,2/3]){
            c.beginPath();c.moveTo(24+W*.66*f,64);c.lineTo(24+W*.66*f,64+H*.48);
            c.moveTo(24,64+H*.48*f);c.lineTo(24+W*.66,64+H*.48*f);c.stroke();
        }
        text(c,p===4?'STUDENT REEL REVIEW':'PROJECT / COAST STORIES',W*.72,88,Math.max(12,W*.018),'#a9c4df');
        for(let n=0;n<5;n++){
            c.fillStyle=n%2?'#355978':'#567b99';c.fillRect(W*.72,106+n*26,W*.24,18);
            c.fillStyle=ORANGE;c.fillRect(W*.72,106+n*26,5,18);
        }
        for(let row=0;row<3;row++)for(let n=0;n<5;n++){
            c.fillStyle=['#568fae','#ec9860','#7ca88c'][row];
            c.fillRect(24+n*(W-48)/5,H*.64+row*H*.08,(W-65)/5,H*.06);
        }
        c.strokeStyle=ORANGE;c.lineWidth=2.5;c.beginPath();c.moveTo(W*(.28+p*.07),H*.61);c.lineTo(W*(.28+p*.07),H*.90);c.stroke();
    }
    c.fillStyle='#152436';c.fillRect(0,H-34,W,34);
    text(c,['PREP / SHOT LISTS','EDIT / CREATE','SOUND / COLOUR','SCREENING','PORTFOLIO CRITIQUE'][p],22,H-11,15,'#d2e2f0');
    text(c,'OCC FILM & MEDIA ARTS · 24 FPS · D65',W-275,H-11,13,ORANGE);
}
export function drawBoard(c,W,H,_spec,variant=0,phase='morning'){
    const p=phaseIndex(phase),statuses=[
        ['Shot list · 24mm','Crew / camera kit','Call sheet 07:30','Coast bluff permit'],
        ['Captured · A-cam','Selects synced','Rough cut v03','Room tone pickup'],
        ['Picture lock','Rec.709 LUT pass','Dialogue + Foley','5.1 stems check'],
        ['DCP reel ready','Audience cards','Director Q&A notes','Festival master'],
        ['Student reels','Peer critique','Portfolio selects','Final export']
    ][p];
    c.fillStyle='#edf0f2';c.fillRect(0,0,W,H);
    c.fillStyle=NAVY;c.fillRect(0,0,W,56);
    c.fillStyle=ORANGE;c.fillRect(0,54,W,4);
    text(c,['PRE-PRODUCTION / COAST STORIES','EDIT / REVIEW / REVISE','SOUND + COLOUR / FINISHING','SCREENING / LISTEN + RESPOND','PORTFOLIOS / WORK IN PROGRESS'][p],24,37,22,WHITE);
    text(c,'PROD #OCC-204 · 2.39:1 SCOPE',W-260,36,13,'#bfd4e8');
    for(let n=0;n<4;n++){
        const x=22+n*(W-36)/4,cw=(W-64)/4;
        c.fillStyle='#ffffff';c.fillRect(x,70,cw,H-124);
        c.strokeStyle='#c5d0da';c.lineWidth=1.5;c.strokeRect(x,70,cw,H-124);
        c.fillStyle=NAVY;c.fillRect(x,70,cw,26);
        text(c,['01 · PLAN','02 · CAPTURE','03 · EDIT & MIX','04 · SHARE'][n],x+10,88,13,WHITE);
        coastFrame(c,x+8,104,cw-16,92,(variant+n)%5);
        c.strokeStyle='#1f2a36';c.lineWidth=1.5;c.strokeRect(x+8,104,cw-16,92);
        text(c,['SC 01 · WIDE EST.','SC 04 · INTERVIEW','SC 07 · FOLEY / SFX','SC 10 · FINAL REEL'][n],x+10,216,13,NAVY);
        text(c,statuses[n],x+10,238,12,'#3c4f63');
        for(let k=0;k<2;k++){
            c.fillStyle=(n+k)<=p?ORANGE:'#c2cdd6';
            c.fillRect(x+10,254+k*16,cw-20,8);
        }
        // Color-script swatches along the bottom of each storyboard card.
        for(let s=0;s<4;s++){
            c.fillStyle=['#07326b','#3b7ea1','#f18a27','#d8ba8a'][(n+s)%4];
            c.fillRect(x+10+s*(cw-24)/4,292,(cw-32)/4,12);
        }
    }
    text(c,'STUDENT PRODUCTION / '+['Plan the story','Discuss the rough cut','Check the mix','Collect the feedback','Share the next version'][p],26,H-16,13,NAVY);
}

// Custom Orange Coast College / Costa Mesa quad & Art Center daylight window view.
function drawOccCampusView(c,W,H,phase){
    const p=phaseIndex(phase),night=phase==='night',evening=phase==='evening',party=phase==='party';
    const sky=c.createLinearGradient(0,0,0,H*.68);
    if(night){sky.addColorStop(0,'#0b192e');sky.addColorStop(.55,'#162c4a');sky.addColorStop(1,'#264260');}
    else if(evening){sky.addColorStop(0,'#284b72');sky.addColorStop(.52,'#6b829c');sky.addColorStop(1,'#e5a273');}
    else if(party){sky.addColorStop(0,'#1f3f66');sky.addColorStop(.55,'#6b7e99');sky.addColorStop(1,'#f0b074');}
    else if(phase==='Morning'||p===0){sky.addColorStop(0,'#5ca0c9');sky.addColorStop(.6,'#9bc9df');sky.addColorStop(1,'#e8dec8');}
    else{sky.addColorStop(0,'#3b88be');sky.addColorStop(.62,'#82bce0');sky.addColorStop(1,'#dce8ef');}
    c.fillStyle=sky;c.fillRect(0,0,W,H);
    if(night){
        c.fillStyle='#dbe9f6';
        for(let n=0;n<42;n++)c.fillRect(rnd(n+120)*W,rnd(n+420)*H*.42,1.5,1.5);
    }
    // Sun / moon glow.
    const sx=p===1?W*.76:p===2||p===4?W*.68:W*.24,sy=evening||party?H*.42:H*.20;
    const sunGlow=c.createRadialGradient(sx,sy,2,sx,sy,night?28:58);
    sunGlow.addColorStop(0,night?'#eef5ff':'#fff6dc');
    sunGlow.addColorStop(.4,night?'#9bb8dc55':'#ffd89b88');
    sunGlow.addColorStop(1,'#ffffff00');
    c.fillStyle=sunGlow;c.beginPath();c.arc(sx,sy,night?28:58,0,Math.PI*2);c.fill();
    c.fillStyle=night?'#e4eef9':'#fff5d6';c.beginPath();c.arc(sx,sy,night?13:20,0,Math.PI*2);c.fill();
    // Distant coastal Saddleback / Santa Ana ridge.
    c.fillStyle=night?'#182a3e':evening||party?'#52657c':'#7e9eb2';
    c.beginPath();c.moveTo(0,H*.62);
    c.quadraticCurveTo(W*.18,H*.50,W*.42,H*.56);
    c.quadraticCurveTo(W*.68,H*.47,W*.92,H*.54);
    c.lineTo(W,H*.56);c.lineTo(W,H*.68);c.lineTo(0,H*.68);c.fill();
    // Campus lawn & decomposed-granite quad walks.
    c.fillStyle=night?'#1b2e2b':evening?'#566e5c':'#789674';
    c.fillRect(0,H*.64,W,H*.36);
    c.fillStyle=night?'#353c42':evening?'#9e9585':'#cfc6b4';
    c.beginPath();c.moveTo(W*.18,H);c.lineTo(W*.44,H*.69);c.lineTo(W*.58,H*.69);c.lineTo(W*.86,H);c.fill();
    // OCC Visual & Performing Arts / Media Pavilion across the quad.
    const pav=[[W*.04,H*.44,W*.38,H*.25],[W*.48,H*.41,W*.46,H*.28]];
    for(const [bx,by,bw,bh] of pav){
        // Architectural concrete & navy fascia.
        c.fillStyle=night?'#273544':evening?'#9ea5ad':'#cfd3d6';
        c.fillRect(bx,by,bw,bh);
        c.fillStyle=night?'#0b2244':NAVY;
        c.fillRect(bx-4,by,bw+8,10);
        c.fillStyle=ORANGE;
        c.fillRect(bx-4,by+10,bw+8,4);
        // Curtain-wall glazing bays.
        const cols=5,cw=(bw-28)/cols;
        for(let col=0;col<cols;col++){
            const gx=bx+10+col*cw;
            c.fillStyle=night||party?'#f3c37a':evening?'#d8b48a':'#567f99';
            c.fillRect(gx,by+20,cw-6,bh-28);
            // Terracotta / orange architectural brise-soleil fins.
            c.fillStyle=night?'#8f5420':ORANGE;
            c.fillRect(gx-2,by+18,3,bh-24);
        }
    }
    // Tall California fan palms & coastal campus trees along the quad.
    for(let n=0;n<6;n++){
        const px=W*(.09+n*.165),py=H*(.72+(n%2)*.05),th=H*(.28+(n%3)*.04);
        c.strokeStyle=night?'#222c33':'#594a3c';c.lineWidth=5;
        c.beginPath();c.moveTo(px,py);c.quadraticCurveTo(px+(n%2?6:-6),py-th*.5,px+(n%2?3:-3),py-th);c.stroke();
        const tx=px+(n%2?3:-3),ty=py-th;
        c.fillStyle=night?'#19302c':evening?'#355245':'#3f684e';
        for(let a=0;a<7;a++){
            const ang=-Math.PI*.95+a*Math.PI*.31;
            c.beginPath();c.ellipse(tx+Math.cos(ang)*18,ty+Math.sin(ang)*10,20,5,ang,0,Math.PI*2);c.fill();
        }
    }
    // Campus pathway bollard lights (glowing in evening, night & showcase).
    for(let n=0;n<4;n++){
        const lx=W*(.28+n*.15),ly=H*(.76+n*.04);
        c.fillStyle='#2a343d';c.fillRect(lx-2,ly,4,18);
        if(night||evening||party){
            const g=c.createRadialGradient(lx,ly,1,lx,ly,22);
            g.addColorStop(0,'#ffe4b5');g.addColorStop(1,'#ffe4b500');
            c.fillStyle=g;c.beginPath();c.arc(lx,ly,22,0,Math.PI*2);c.fill();
        }
    }
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
    const m=kit.canvasMat((c,W,H)=>drawScreen(c,W,H,kit.spec,variant),1024,512);m.emissive.set('#ffffff');m.emissiveMap=m.map;m.emissiveIntensity=.16;m.userData.screenVariant=variant;kit.screenMats.push(m);return m;
}
function screen(kit,parent,size,at,variant=0){
    const m=screenMaterial(kit,variant);
    kit.box(parent,[size[0]+40,size[1]+40,55],at,kit.ink,8);return kit.mesh(parent,new THREE.PlaneGeometry(...size),m,[at[0],at[1],at[2]+29]);
}
function panel(kit,parent,size,at,color=NAVY){return kit.box(parent,size,at,kit.mat(color,'fabric'),8);}
function tripod(k,x,y,z,height=1400){
    k.cyl(16,20,height-250,[x,y+(height+250)/2,z],SILVER,'metal');
    // Locking collars on the telescoping riser column.
    for(const cy of [y+height*.58,y+height*.78])k.cyl(23,23,28,[x,cy,z],INK,'rubber');
    for(let n=0;n<3;n++){
        const a=n*Math.PI*2/3,dx=Math.sin(a)*300,dz=Math.cos(a)*300;
        const start=new THREE.Vector3(x,y+height*.58,z),end=new THREE.Vector3(x+dx,y+25,z+dz),delta=end.clone().sub(start);
        k.add(new THREE.CylinderGeometry(12,17,delta.length(),12),start.clone().add(end).multiplyScalar(.5).toArray(),INK,[1,1,1],new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())).toArray().slice(0,3),'metal');
        k.ball(25,[end.x,end.y,end.z],INK,[1,.4,1],undefined,'rubber');
    }
}

// Migrate untouched legacy wall-fixture coordinates from studio-state.json so
// fixed wall overlaps (sound-treatment vs speaker, pin-up gallery vs wainscot
// and storage cabinet, room-sign vs occ-circle) take effect automatically.
export function migrateMediaFixtureTransform(obj,saved,layout){
    if(!obj||!saved?.p||!layout)return saved;
    const id=obj.userData?.propId;
    if(!id)return saved;
    const near=(a,b,tol=25)=>Math.abs(a-b)<=tol;
    const w=layout.width,d=layout.depth,bz=layout.back;
    const legacy={
        'room-sign':[[0,2800,bz+50],[0,2520,bz+50]],
        'occ-circle':[[-1600,2800,bz+75]],
        'wall-clock':[[-2350,2780,bz+65],[-w/2+550,2450,bz+55]],
        'sound-treatment':[[-w/2+1900,1700,bz+70]],
        'student-work-gallery':[[w/2-55,1450,bz+1500],[w/2-55,2350,bz+1450]],
        'acoustic-panels':[[w/2-45,1850,bz+d*.28],[w/2-45,1850,bz+d*.24]]
    }[id];
    if(!legacy)return saved;
    if(legacy.some(([lx,ly,lz])=>near(saved.p.x,lx,35)&&near(saved.p.y,ly,35)&&near(saved.p.z,lz,35))){
        return {p:{x:obj.position.x,y:obj.position.y,z:obj.position.z},q:saved.q,s:saved.s};
    }
    return saved;
}

export function furnish(kit){
    const {layout:l,asset,box,mat,byId,label}=kit,w=kit.w,bz=kit.bz,front=kit.front;
    const dress=kit.dress||mat('#ffffff','powder',{vertexColors:true});
    kit.room.migrateSavedTransform=(obj,saved)=>migrateMediaFixtureTransform(obj,saved,l);
    kit.room.decorateProp=(object,placement)=>{
        if(placement.id!=='ergoflex-couch'||object.userData.milanoSofa)return;const copies=new Map();
        object.traverse(o=>{if(!o.isMesh)return;const swap=m=>{if(!/upholstery/i.test(m?.name||''))return m;if(!copies.has(m)){const c=m.clone();c.color.set('#2f3a48');c.userData.roomPaletteLocked=true;kit.room.ownedMaterials?.add(c);copies.set(m,c);}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);});
    };
    const print=kit.cabinet('print-scan',[-w/2+820,0,bz+360],1300,900,false);print.name='Print & scan counter';
    // A real printer is 563 mm deep. The standard 420 mm storage carcass
    // needs a 650 mm worktop to support its feet and its front paper path.
    const worktop=print.children.find(o=>o.isMesh&&Math.abs(o.position.y-885)<1);
    if(worktop)worktop.geometry.scale(1,1,650/420);
    print.userData.roomSupportHeights=[900];
    // The supplied printer and paper tray sit on the counter and move with it.
    const k=detailKit();
    books(k,-540,900,-30,4);
    // Backsplash utility rail, D65 proofing hood stanchions & cabinet base trim.
    k.box([1280,55,22],[0,928,-195],NAVY,undefined,'metal');
    k.box([1280,6,26],[0,958,-195],ORANGE,undefined,'metal');
    for(const sx of [-420,420])k.box([18,90,18],[sx,945,-195],SILVER,undefined,'metal');
    for(const [id,x,z] of [['ergoflex-printer',-w/2+710,bz+360],['ergoflex-paper-tray',-w/2+1230,bz+350]])kit.room.propSupports.push({obj:print,id,at:[x,900,z]});
    k.build(print,dress);
    label(print,'PRINT / SCAN · COLOUR PROOF',[860,78],[0,995,-182],NAVY);
    if(l.index>=2){
        const lfp=asset('large-format-printer','Large-format poster printer',[-w/2+2350,0,bz+420]),pk=detailKit();
        pk.box([1600,330,520],[0,960,0],'#c9ced2',undefined,'metal');
        pk.box([1560,40,500],[0,1145,0],INK,undefined,'rubber');
        pk.box([1500,120,180],[0,760,170],'#c9ced2',undefined,'metal');
        pk.add(new THREE.CylinderGeometry(55,55,1450,16),[0,740,240],WHITE,[1,1,1],[0,0,Math.PI/2],'paper');
        for(const x of [-720,720]){
            pk.box([60,760,60],[x,400,0],SILVER,undefined,'metal');
            pk.box([60,40,560],[x,20,0],SILVER,undefined,'metal');
            for(const z of [-250,250])pk.ball(28,[x,28,z],INK,undefined,undefined,'rubber');
        }
        // Catch basket & emerging colour proof sheet.
        pk.box([1300,8,420],[0,420,250],'#5b6672',[-.35,0,0],'fabric');
        pk.box([920,3,340],[-60,610,258],WHITE,[-.28,0,0],'paper');
        pk.box([860,2,220],[-60,612,255],'#2d6894',[-.28,0,0],'paper');
        pk.box([860,2,65],[-60,582,315],ORANGE,[-.28,0,0],'paper');
        // Control touchscreen & status bar on right housing.
        pk.box([155,82,12],[560,1060,264],INK,undefined,'rubber');
        pk.box([135,64,8],[560,1060,268],'#2f6fb0',undefined,'glass');
        // Rear header stanchions so the label is physically mounted to the chassis.
        for(const sx of [-320,320])pk.box([16,85,16],[sx,1185,-185],SILVER,undefined,'metal');
        pk.build(lfp,dress);
        label(lfp,'POSTER / LARGE FORMAT',[780,76],[0,1220,-174],NAVY);
    }
    const storage=byId('storage');
    if(storage){
        storage.name='Camera & equipment checkout';
        for(const o of storage.children)if(o.isMesh&&o.position.z>=210)o.visible=false;
        label(storage,'EQUIPMENT / CHECKOUT',[1120,96],[0,1735,214],NAVY);
    }
    const critique=byId('activity-table');critique.name='Storyboard & critique table';label(critique,'PLAN / REVIEW',[960,85],[0,680,333],NAVY);
    // Critique seating is supplied designer chairs around the table (layout props).
    // Large review display and flanking nearfields sit on the back wall.
    // Motorized cinema screening display: top cassette, dark masking border and bottom weight bar.
    const reelW=Math.min(w*.36,3700),review=asset('reel-screen','Student reel screening display',[0,0,bz+92],kit.back);
    kit.box(review,[reelW+180,78,86],[0,2555,14],kit.metal,8);
    kit.box(review,[reelW+180,8,90],[0,2514,16],kit.mat(ORANGE,'powder'),2);
    kit.box(review,[reelW+96,1450+96,28],[0,1780,-4],kit.mat('#1d242d','metal'),6);
    kit.box(review,[reelW+48,1450+48,8],[0,1780,15],kit.mat('#0e1217','fabric'),2);
    kit.box(review,[reelW+120,26,42],[0,1012,12],kit.metal,4);
    const reel=kit.mesh(review,new THREE.PlaneGeometry(reelW,1450),screenMaterial(kit,3),[0,1780,22]);reel.castShadow=false;kit.reelScreen=reel;
    for(const x of [-1,1]){
        const speaker=asset('review-speaker-'+x,'Wall review speaker',[x*(reelW/2+240),1780,bz+150],kit.back);
        box(speaker,[230,540,210],[0,0,0],kit.ink,12);
        const sk=detailKit();
        sk.box([206,516,12],[0,0,102],CHARCOAL,undefined,'metal');
        sk.box([150,18,8],[0,-215,106],'#0e1318',undefined,'rubber');
        sk.add(new THREE.CylinderGeometry(76,76,10,24),[0,-65,105],ORANGE,[1,1,1],[Math.PI/2,0,0],'metal');
        sk.add(new THREE.CylinderGeometry(66,52,14,24),[0,-65,108],'#3c4958',[1,1,1],[Math.PI/2,0,0],'rubber');
        sk.ball(22,[0,-65,110],INK,[1,1,.35],undefined,'rubber');
        sk.add(new THREE.CylinderGeometry(34,34,10,24),[0,145,105],SILVER,[1,1,1],[Math.PI/2,0,0],'metal');
        sk.ball(16,[0,145,108],INK,[1,1,.4],undefined,'metal');
        sk.box([18,6,4],[68,-215,108],'#4cd97b',undefined,'glass');
        sk.box([90,140,85],[0,0,-125],SILVER,undefined,'metal');
        sk.build(speaker,dress);
    }
    // Capture set: cyclorama roll, camera tripod, two softboxes and floor tape.
    // Green-screen practice: talent well off the backdrop, the camera 2+ m back.
    const sg=l.media.stage,stage=asset('capture-stage','Capture stage · camera, backdrop & softboxes',[l.media.capture[0],0,l.media.capture[1]]);
    stage.rotation.y=Math.PI;const back=sg.backdrop,cam=sg.camera,mid=(back+cam)/2,padW=sg.depth===3000?2800:2600;
    box(stage,[padW,15,sg.depth],[0,7.5,mid],mat('#7b828a','stone'),14);
    // Chroma muslin: three sewn widths with seams, soft hanging folds and a
    // little light fall-off toward the hem, not a flat painted plane.
    const chromaMap=(()=>{const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
        g.fillStyle='#1fa64a';g.fillRect(0,0,256,256);
        for(let n=0;n<26;n++){const x=(n*37.3)%256,w=6+(n*13)%14,gr=g.createLinearGradient(x-w,0,x+w,0);gr.addColorStop(0,'rgba(0,40,10,0)');gr.addColorStop(.5,n%3?'rgba(0,40,10,.16)':'rgba(190,255,200,.10)');gr.addColorStop(1,'rgba(0,40,10,0)');g.fillStyle=gr;g.fillRect(x-w,0,2*w,256);}
        const v=g.createLinearGradient(0,0,0,256);v.addColorStop(0,'rgba(255,255,255,.06)');v.addColorStop(.7,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,30,10,.18)');g.fillStyle=v;g.fillRect(0,0,256,256);
        for(const x of [85,171]){g.fillStyle='rgba(8,60,25,.55)';g.fillRect(x,0,2,256);g.fillStyle='rgba(150,230,170,.25)';g.fillRect(x+2,0,1,256);}
        const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;})();
    const chroma=kit.material('#ffffff',{map:chromaMap,roughness:.92,side:THREE.DoubleSide});chroma.userData.roomSurface='fabric';chroma.userData.roomPaletteLocked=chroma.userData.roomFinishLocked=true;
    const roll=box(stage,[2350,2220,24],[0,1130,back-4],chroma,4);
    // Dark charcoal acoustic/light-block backing on the rear of the chroma wall
    // so reverse views see a tailored studio flat rather than raw green bleed.
    box(stage,[2370,2230,14],[0,1130,back+16],kit.mat(CHARCOAL,'fabric'),4);
    // Cove sweep and floor sheet so the key never shows a hard corner.
    const cove=kit.mesh(stage,new THREE.CylinderGeometry(450,450,2350,16,1,true,Math.PI*1.5,Math.PI/2),chroma,[0,465,back-465]);cove.rotation.z=Math.PI/2;
    const sweepLen=Math.max(700,back-cam-1700);
    box(stage,[2350,4,sweepLen],[0,17,back-465-sweepLen/2],chroma,2);
    // Heavy-duty goal-post studio truss & weighted base plates.
    box(stage,[2540,42,56],[0,2265,back+6],kit.metal,6);
    for(const x of [-1240,1240]){
        box(stage,[38,2280,38],[x,1140,back+6],kit.ink,4);
        box(stage,[180,14,420],[x,22,back+6],kit.ink,4);
    }
    const capture=detailKit();
    tripod(capture,0,0,cam,1380);
    capture.box([160,28,175],[0,1370,cam],INK,undefined,'metal');
    // Fluid-head pan bar & utility shelf with clapperboard on the camera tripod.
    capture.box([14,14,240],[65,1345,cam-110],INK,[.35,-.2,0],'rubber');
    capture.box([210,10,145],[140,920,cam],CHARCOAL,undefined,'metal');
    capture.box([150,6,110],[145,929,cam],WHITE,undefined,'paper');
    capture.box([150,6,22],[145,933,cam-42],ORANGE,undefined,'metal');
    const spread=sg.depth===3000?1300:1150,heads=[[-spread,back-650,1750,.8],[spread,back-650,1750,-.8],[-700,cam+500,1600,.6]];
    for(const [x,z,hgt] of heads){
        tripod(capture,x,0,z,hgt);
        capture.box([42,330,30],[x,hgt+170,z],INK,undefined,'metal');
        // Ballast pack with status indicator mounted on the stand column.
        capture.box([72,140,56],[x,680,z-28],CHARCOAL,undefined,'metal');
        capture.box([18,8,4],[x,725,z-57],ORANGE,undefined,'glass');
        // Saddlebag sandbags draped across the tripod legs.
        for(let n=0;n<3;n++){
            const a=n*Math.PI*2/3;
            capture.ball(58,[x+Math.sin(a)*220,42,z+Math.cos(a)*220],'#272c32',[1,.36,.65],undefined,'fabric');
            capture.box([42,6,26],[x+Math.sin(a)*220,60,z+Math.cos(a)*220],ORANGE,undefined,'fabric');
        }
    }
    // Talent mark (orange gaffer T) and perimeter safety corner L-marks on the stage pad.
    capture.box([420,3,40],[0,18,back-sg.talent+250],ORANGE);
    capture.box([40,3,300],[0,18,back-sg.talent+380],ORANGE);
    for(const sx of [-1,1])for(const sz of [-1,1]){
        const cx=sx*(padW/2-90),cz=mid+sz*(sg.depth/2-90);
        capture.box([140,2.5,24],[cx-sx*58,16.5,cz],ORANGE);
        capture.box([24,2.5,140],[cx,16.5,cz-sz*58],ORANGE);
    }
    capture.build(stage,dress);
    kit.room.propSupports.push({obj:stage,id:'ergoflex-camera',at:[l.media.capture[0],1395,l.media.capture[1]-cam]},{obj:stage,id:'ergoflex-tall-office-chair',at:[l.media.capture[0],0,l.media.capture[1]-back+sg.talent]});
    kit.mediaDiffusers=[];
    for(const [x,z,hgt,turn] of heads){
        // Softbox: a black four-sided fabric frustum with a white diffuser face and grid trim.
        const head=new THREE.Group();head.position.set(x,hgt+150,z);head.rotation.y=turn;stage.add(head);
        const box4=kit.mesh(head,new THREE.CylinderGeometry(120,340,400,4,1,false),kit.mat('#1b1e22','fabric'),[0,0,-150]);box4.rotation.set(-Math.PI/2,Math.PI/4,0);
        kit.box(head,[495,495,18],[0,0,46],kit.ink,4);
        const glow=kit.material('#f3f5ef',{emissive:'#e6efff',emissiveIntensity:.35,roughness:.75});kit.mesh(head,new THREE.PlaneGeometry(465,465),glow,[0,0,56]).castShadow=false;kit.mediaDiffusers.push(glow);
    }
    kit.label(stage,'CAPTURE / LIGHT / ACTION',[1360,96],[0,2265,back+38],NAVY);
    // Keep stage dressing within its fixture; camera cutaway affects ceilings only.
    roll.userData.mediaBackdrop=true;
    const ceilingProjector=asset('ceiling-projector','Ceiling-mounted review projector',[0,kit.ceiling-370,bz+3300]);ceilingProjector.rotation.y=Math.PI;
    box(ceilingProjector,[420,165,360],[0,0,0],kit.mat('#232b35','metal'),14);
    box(ceilingProjector,[430,12,370],[0,42,0],kit.mat(ORANGE,'powder'),4);
    box(ceilingProjector,[240,18,220],[0,320,0],kit.metal,6);
    box(ceilingProjector,[34,250,34],[0,195,0],kit.metal,4);
    const lensBarrel=kit.mesh(ceilingProjector,new THREE.CylinderGeometry(54,58,28,24),kit.metal,[0,-8,-182]);lensBarrel.rotation.x=Math.PI/2;
    const lensGlass=kit.mesh(ceilingProjector,new THREE.CylinderGeometry(42,42,10,24),kit.material('#d8ecff',{emissive:'#8ec5ff',emissiveIntensity:.45,roughness:.15}),[0,-8,-194]);lensGlass.rotation.x=Math.PI/2;
    ceilingProjector.userData.presentationOnly=true;kit.mediaCeiling=[ceilingProjector];
    // Projector beam: an additive open frustum from the lens to the screen.
    const lens=new THREE.Vector3(0,kit.ceiling-385,bz+3134),corners=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([sx,sy])=>new THREE.Vector3(sx*reelW/2,1780+sy*725,bz+115));
    const beam=new THREE.BufferGeometry().setFromPoints(corners.flatMap((c,n)=>[lens,c,corners[(n+1)%4]]));beam.setAttribute('color',new THREE.Float32BufferAttribute(corners.flatMap(()=>[1,1,1,.15,.15,.15,.15,.15,.15]),3));
    const beamMat=new THREE.MeshBasicMaterial({color:'#000000',vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    const ray=new THREE.Mesh(beam,beamMat);ray.name='Projector beam';ray.raycast=()=>{};ray.castShadow=false;ray.frustumCulled=false;kit.root.add(ray);kit.mediaCeiling.push(ray);kit.mediaBeam=beamMat;
}
export function dressProp(id,k,_g,kit){
    if(id==='storage'){
        // Dark slate acoustic/pegboard liner covers the loud orange cabinet back
        // so the open equipment checkout cage reads like a real studio gear locker.
        k.box([1188,1720,10],[0,900,-192],CHARCOAL,undefined,'metal');
        for(let row=0;row<12;row++)for(let col=0;col<16;col++){
            k.box([6,6,4],[-525+col*70,220+row*120,-185],'#2d3844',undefined,'metal');
        }
        for(let n=0;n<3;n++){
            const y=260+n*390;
            k.box([1180,24,395],[0,y,0],SILVER,undefined,'metal');
            for(let j=0;j<3;j++){
                const x=-360+j*360;
                k.box([270,175,255],[x,y+100,5],INK,undefined,'rubber');
                k.box([68,20,5],[x,y+105,135],ORANGE,undefined,'paper');
                k.box([96,10,20],[x,y+193,5],SILVER,undefined,'metal');
            }
        }
        // Protective case ribs, recessed latches and barcode inventory tags.
        for(let row=0;row<3;row++)for(let col=0;col<3;col++){
            const x=-360+col*360,y=260+row*390;
            for(const dx of [-100,100]){
                k.box([18,28,9],[x+dx,y+151,138],SILVER,undefined,'metal');
                k.box([14,10,11],[x+dx,y+151,144],INK,undefined,'rubber');
            }
            for(const dx of [-78,78])k.box([8,110,9],[x+dx,y+96,137],'#39434b',undefined,'rubber');
            k.box([79,25,3],[x,y+65,135],WHITE,undefined,'paper');
            for(let n=0;n<5;n++)k.box([2+n%2,15,1],[x-28+n*11,y+65,137],INK,undefined,'paper');
        }
        // Upper 4th shelf with cinema prime lens tubes, boom pole case & field audio kit.
        const topY=1430;
        k.box([1180,24,395],[0,topY,0],SILVER,undefined,'metal');
        for(let j=0;j<4;j++){
            const lx=-420+j*135;
            k.cyl(44,44,165,[lx,topY+95,15],CHARCOAL,'rubber');
            k.cyl(46,46,16,[lx,topY+172,15],ORANGE,'metal');
            k.box([48,18,3],[lx,topY+95,60],WHITE,undefined,'paper');
        }
        // Field audio recorder bag & clapperboard on the right of the top shelf.
        k.box([240,130,190],[170,topY+77,15],NAVY,undefined,'fabric');
        k.box([220,16,175],[170,topY+146,15],ORANGE,undefined,'fabric');
        k.box([190,125,18],[440,topY+75,35],WHITE,[0,-.18,0],'paper');
        k.box([190,24,20],[440,topY+142,35],INK,[0,-.18,0],'metal');
    }
}
// Student work varies: storyboard, type poster, animation cels, colour study, sound.
function pinupMotif(c,x,y,w,h,n){
    if(n===0){
        c.fillStyle='#f4f1ea';c.fillRect(x,y,w,h);
        c.strokeStyle=INK;c.lineWidth=2;
        for(let r=0;r<3;r++)for(let k=0;k<2;k++){
            const fx=x+8+k*w/2,fy=y+8+r*h/3,fw=w/2-16,fh=h/3-18;
            coastFrame(c,fx,fy,fw,fh,(r+k)%4);
            c.strokeRect(fx,fy,fw,fh);
        }
    }else if(n===1){
        c.fillStyle=ORANGE;c.fillRect(x,y,w,h);
        c.fillStyle=NAVY;c.fillRect(x,y,w,28);
        c.fillStyle=WHITE;c.font='700 13px "DejaVu Sans", sans-serif';c.fillText('OCC FILM FESTIVAL',x+10,y+19);
        c.fillStyle=NAVY;c.font=`900 ${Math.round(w*.22)}px "DejaVu Sans", sans-serif`;
        c.fillText('FRAME',x+10,y+h*.45);c.fillText('BY',x+10,y+h*.67);c.fillText('FRAME',x+10,y+h*.89);
    }else if(n===2){
        c.fillStyle='#162536';c.fillRect(x,y,w,h);
        for(let k=0;k<4;k++){
            const cx=x+w*.22+k*w*.18,cy=y+h*(.58-k*.09);
            c.strokeStyle=['#6da9d2','#8ec4e6','#cbe3f2','#ffffff'][k];c.lineWidth=2;
            c.strokeRect(x+12+k*w*.05,y+14+k*h*.04,w*.72,h*.72);
            c.fillStyle=k===3?ORANGE:'#f3ad6288';c.beginPath();c.arc(cx,cy,w*.09,0,Math.PI*2);c.fill();
        }
    }else if(n===3){
        c.fillStyle='#18222c';c.fillRect(x,y,w,h);
        const cx=x+w/2,cy=y+h*.44,r=Math.min(w,h)*.34;
        for(let a=0;a<24;a++){
            c.fillStyle=`hsl(${a*15},68%,56%)`;
            c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r,a*Math.PI/12,(a+1.05)*Math.PI/12);c.fill();
        }
        for(let s=0;s<5;s++){
            c.fillStyle=['#07326b','#2a6f97','#f18a27','#e9c46a','#e76f51'][s];
            c.fillRect(x+10+s*(w-20)/5,y+h*.82,(w-32)/5,h*.12);
        }
    }else{
        c.fillStyle='#0d1a2a';c.fillRect(x,y,w,h);
        for(let row=0;row<3;row++){
            c.strokeStyle=['#80c0d1','#f3ad62','#91bb98'][row];c.lineWidth=2;
            c.beginPath();
            for(let k=0;k<60;k++)c.lineTo(x+k*w/60,y+h*(.25+row*.25)+Math.sin(k*.9+row)*Math.sin(k*.2)*h*.09);
            c.stroke();
        }
    }
}
function poster(kit,id,title,at,wall,index){
    const g=kit.asset(id,title,at,wall),m=kit.canvasMat((c,W,H)=>{
        // Museum mat board & inner bevel border.
        c.fillStyle='#eceae2';c.fillRect(0,0,W,H);
        c.strokeStyle='#b8b4a6';c.lineWidth=3;c.strokeRect(18,18,W-36,H-36);
        c.fillStyle=index%2?'#f7f6f1':NAVY;c.fillRect(28,28,W-56,H-56);
        c.fillStyle=ORANGE;c.fillRect(28,28,W-56,12);
        if(index%3===0){
            // 35mm contact sheet & aspect-ratio study.
            c.fillStyle=INK;c.fillRect(44,62,W-88,H*.58);
            for(let n=0;n<3;n++){
                coastFrame(c,82,84+n*H*.185,W-164,H*.155,n+1);
                c.strokeStyle='#ffffff55';c.lineWidth=1;c.strokeRect(82,84+n*H*.185,W-164,H*.155);
                text(c,`24A · ${['2.39:1 SCOPE','1.85:1 FLAT','16:9 HD'][n]}`,90,102+n*H*.185,11,ORANGE);
            }
            c.fillStyle='#e8e2d6';
            for(let n=0;n<15;n++){
                c.fillRect(52,70+n*H*.037,14,15);
                c.fillRect(W-66,70+n*H*.037,14,15);
            }
        }else if(index%3===1){
            // Colour science, vectorscope & Kelvin daylight progression.
            c.fillStyle='#141e28';c.fillRect(44,62,W-88,H*.58);
            const cx=W/2,cy=62+H*.24,r=H*.18;
            for(let a=0;a<36;a++){
                c.fillStyle=`hsl(${a*10},68%,56%)`;
                c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r,a*Math.PI/18,(a+1.05)*Math.PI/18);c.fill();
            }
            const grad=c.createRadialGradient(cx,cy,0,cx,cy,r);
            grad.addColorStop(0,'#ffffffee');grad.addColorStop(1,'#ffffff00');
            c.fillStyle=grad;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();
            c.strokeStyle='#ffffff44';c.lineWidth=1.5;c.beginPath();c.arc(cx,cy,r+10,0,Math.PI*2);c.stroke();
            const kelvins=[['3200K','#f39c4b'],['4300K','#f4c686'],['5600K','#e8f0f2'],['6500K','#9ec5e6']];
            kelvins.forEach(([lbl,col],k)=>{
                const kx=58+k*(W-116)/4,kw=(W-140)/4;
                c.fillStyle=col;c.fillRect(kx,62+H*.46,kw,36);
                text(c,lbl,kx+8,62+H*.54,12,'#cbd8e4');
            });
        }else{
            // Multi-track sound design & polar pickup pattern.
            c.fillStyle='#0d1a2a';c.fillRect(44,62,W-88,H*.58);
            for(let row=0;row<4;row++){
                c.strokeStyle=['#80c0d1','#f3ad62','#91bb98','#edf0ec'][row];c.lineWidth=2.2;
                c.beginPath();
                for(let n=0;n<120;n++){
                    const v=Math.sin(n*.7+row*2)*Math.sin(n*.13+row)*Math.cos(n*.05);
                    c.lineTo(54+n*(W-108)/120,105+row*H*.12+v*H*.045);
                }
                c.stroke();
            }
        }
        text(c,title.toUpperCase(),44,H-92,26,index%2?NAVY:WHITE);
        text(c,['CINEMATOGRAPHY & STORY STRUCTURE','COLOR GRADING & DISPLAY CALIBRATION','PRODUCTION SOUND & DOLBY ATMOS MIX'][index%3],44,H-64,12,index%2?'#4a5d70':ORANGE);
        text(c,'ORANGE COAST COLLEGE · FILM & MEDIA ARTS',44,H-42,12,index%2?NAVY:'#b6cde1');
    },512,720);
    kit.box(g,[640,900,26],[0,0,-8],kit.ink,5);
    kit.box(g,[652,912,14],[0,0,-14],kit.metal,4);
    kit.mesh(g,new THREE.PlaneGeometry(608,868),m,[0,0,6]);
    // Brushed gallery picture light bar above each framed poster.
    const pk=detailKit();
    pk.box([280,14,55],[0,472,22],CHARCOAL,undefined,'metal');
    pk.box([250,4,36],[0,464,28],'#ffe8bf',undefined,'glass');
    pk.build(g,kit.dress||kit.mat('#ffffff','powder',{vertexColors:true}));
    return g;
}
export function decorate(kit){
    const {w,bz,front,layout:l}=kit,ready=[],dress=kit.dress||kit.mat('#ffffff','powder',{vertexColors:true});
    // Replace the oversized generic orange banner on room-sign with a tailored
    // OCC Coast Navy & Orange architectural studio header plaque.
    const identity=kit.byId('room-sign');
    if(identity){
        identity.position.set(0,2805,bz+50);
        for(const c of [...identity.children]){c.geometry?.dispose();identity.remove(c);}
        const signW=Math.min(w-3200,1820),signH=176;
        kit.box(identity,[signW+28,signH+24,22],[0,0,-10],kit.metal,6);
        kit.box(identity,[signW,signH,16],[0,0,0],kit.mat(NAVY,'powder'),4);
        const signMat=kit.canvasMat((c,W,H)=>{
            c.fillStyle=NAVY;c.fillRect(0,0,W,H);
            c.fillStyle=ORANGE;c.fillRect(0,0,18,H);c.fillRect(0,H-10,W,10);
            text(c,'ORANGE COAST COLLEGE · MULTIMEDIA ART LAB',W/2+6,H*.48,30,WHITE,'center');
            text(c,'SCHOOL OF VISUAL & PERFORMING ARTS · FILM / SOUND / DIGITAL MEDIA',W/2+6,H*.78,16,'#bfd4e8','center');
        },1024,160);
        kit.mesh(identity,new THREE.PlaneGeometry(signW-12,signH-12),signMat,[0,0,9]).castShadow=false;
    }
    const circle=kit.asset('occ-circle','OCC coast identity mark',[-1260,2800,bz+75],kit.back);
    const ck=detailKit();
    ck.add(new THREE.CylinderGeometry(168,168,14,48),[0,0,-10],SILVER,[1,1,1],[Math.PI/2,0,0],'metal');
    ck.add(new THREE.CylinderGeometry(156,156,16,48),[0,0,-8],WHITE,[1,1,1],[Math.PI/2,0,0],'metal');
    ck.build(circle,dress);
    ready.push(logo(circle,'circle',[310,310],[0,0,2]));
    const pirate=kit.asset('occ-pirate','OCC Pirates media arts badge',[w/2-620,2450,bz+90],kit.back);
    const pk=detailKit();
    pk.add(new THREE.CylinderGeometry(285,285,16,48),[0,0,-12],NAVY,[1,1,1],[Math.PI/2,0,0],'metal');
    pk.add(new THREE.CylinderGeometry(272,272,18,48),[0,0,-9],WHITE,[1,1,1],[Math.PI/2,0,0],'metal');
    pk.build(pirate,dress);
    ready.push(logo(pirate,'pirate',[540,540],[0,0,2]));
    const title=kit.asset('occ-wordmark','Orange Coast College wordmark',[-w/2+750,2440,bz+90],kit.back);
    kit.box(title,[760,570,22],[0,0,-21],kit.metal,8);
    kit.box(title,[740,550,28],[0,0,-15],kit.mat(NAVY,'powder'),8);
    kit.box(title,[740,12,32],[0,-269,-14],kit.mat(ORANGE,'powder'),3);
    ready.push(logo(title,'title',[660,490],[0,0,2]));
    const clock=kit.byId('wall-clock');
    if(clock){
        clock.position.set(-2150,2680,bz+65);
        const rim=clock.children.find(m=>m.geometry?.type==='CylinderGeometry');
        if(rim)rim.material=kit.mat(NAVY,'metal',{metalness:.55,roughness:.35});
    }
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
    // Window blinds: partly down for editing, blackout for screening, with top valance & cord ladders.
    const slats=institutionalMap((c,W,H)=>{
        c.fillStyle='#d9dcd8';c.fillRect(0,0,W,H);
        for(let y=0;y<H;y+=16){
            c.fillStyle='#9fa6b0';c.fillRect(0,y,W,2);
            c.fillStyle='#f2f4f0';c.fillRect(0,y+3,W,3);
        }
        for(const x of [10,W/2,W-10]){c.fillStyle='#78828e55';c.fillRect(x,0,1.5,H);}
    },128,256);
    slats.wrapT=THREE.RepeatWrapping;slats.repeat.set(1,6);
    kit.box(kit.window,[wo+40,68,92],[0,885,22],kit.mat(CHARCOAL,'metal'),4);
    const blind=kit.mesh(kit.window,new THREE.PlaneGeometry(wo,1750),kit.material('#ffffff',{map:slats,roughness:.78,side:THREE.DoubleSide}),[0,0,18]);blind.castShadow=false;blind.name='Window blind';kit.mediaBlind=blind;
    // Storyboard & review board marker tray, erasers & magnetic clapper tokens.
    if(kit.board){
        const bmk=detailKit();
        bmk.box([1900,18,68],[0,-502,36],SILVER,undefined,'metal');
        for(let m=0;m<4;m++)bmk.add(new THREE.CylinderGeometry(7,7,125,12),[-360+m*155,-488,42],[NAVY,ORANGE,'#2b8a6e',INK][m],[1,1,1],[0,0,Math.PI/2],'rubber');
        bmk.box([115,24,42],[340,-486,42],CHARCOAL,undefined,'fabric');
        for(let t=0;t<4;t++)bmk.add(new THREE.CylinderGeometry(14,14,8,16),[-780+t*52,445,24],t%2?ORANGE:NAVY,[1,1,1],[Math.PI/2,0,0],'metal');
        bmk.build(kit.board,dress);
    }
    kit.room.mediaArtReady=Promise.all(ready);
    // Left rear wall has no window opening: art boards and course work sit here.
    const frames=['Story / Screen','Light / Colour','Sound / Silence'];
    for(let n=0;n<3;n++){const g=poster(kit,'film-poster-'+n,frames[n],[-w/2+58,1850,bz+450+n*790],kit.left,n);g.rotation.y=Math.PI/2;}
    // Grey absorption and oak slats around the sound area; positioned cleanly between
    // the student pin-up gallery and the storyboard planning board on the right wall.
    const acoustic=kit.byId('acoustic-panels');if(acoustic){
        acoustic.position.set(w/2-45,1850,bz+kit.d*.335);
        for(const child of acoustic.children)child.geometry?.dispose();acoustic.clear();
        const ak=detailKit();
        for(let n=0;n<5;n++){
            const px=-480+n*240;
            ak.box([188,1020,42],[px,0,0],n%2?'#637d94':NAVY,undefined,'fabric');
            ak.box([18,1020,48],[px-86,0,2],'#b89a74',undefined,'paper');
            ak.box([18,1020,48],[px+86,0,2],'#b89a74',undefined,'paper');
            ak.box([160,8,4],[px,-455,23],ORANGE,undefined,'metal');
        }
        ak.build(acoustic,dress);
    }
    // Position the QRD slat diffuser cleanly between occ-wordmark and the left review
    // speaker in compact tiers, and centered above the large-format printer in larger tiers.
    const soundX=l.index===0?-2460:l.index===1?-2800:-w/2+2350;
    const sound=kit.asset('sound-treatment','Sound corner acoustic diffuser',[soundX,1820,bz+70],kit.back);
    const k=detailKit();
    k.box([940,780,26],[0,0,-10],CHARCOAL,undefined,'metal');
    k.box([900,740,22],[0,0,-2],'#7a6044',undefined,'paper');
    for(let n=0;n<13;n++){
        const depth=38+((n*3+2)%5)*18;
        k.box([48,710,depth],[-396+n*66,0,depth/2],n%2?'#c2a37c':'#9e805a',undefined,'paper');
    }
    k.box([940,8,34],[0,-386,4],ORANGE,undefined,'metal');
    k.build(sound,dress);
    kit.label(sound,'LISTEN / MIX',[760,84],[0,455,24],NAVY);
    if(l.index>=1){
        // Centered at y=1850 (above the 1240mm wainscot cap) and z=bz+1780 (clear of
        // the rear-right equipment checkout cabinet and the acoustic panels).
        const pin=kit.asset('student-work-gallery','Student work pin-up wall',[w/2-55,1850,bz+1780],kit.right);kit.mediaGallery=pin;pin.rotation.y=-Math.PI/2;
        kit.box(pin,[1940,980,28],[0,0,-4],kit.mat(CHARCOAL,'metal'),6);
        panel(kit,pin,[1890,930,24],[0,0,4],CORK);
        const gk=detailKit();
        gk.box([1940,8,36],[0,-486,6],ORANGE,undefined,'metal');
        for(let n=0;n<5;n++){
            const cx=-720+n*360;
            const card=kit.mesh(pin,new THREE.PlaneGeometry(315,520),kit.canvasMat((c,W,H)=>{
                c.fillStyle=WHITE;c.fillRect(0,0,W,H);
                c.strokeStyle='#d0d6dc';c.lineWidth=2;c.strokeRect(4,4,W-8,H-8);
                pinupMotif(c,14,26,W-28,H*.68,n);
                c.fillStyle=NAVY;c.fillRect(14,H-68,W-28,2);
                text(c,['STORYBOARD','FESTIVAL POSTER','ANIMATION CEL','COLOUR SCRIPT','SOUND DESIGN'][n],14,H-44,15,NAVY);
                text(c,'OCC MEDIA ARTS · 0'+(n+1),14,H-22,12,ORANGE);
            },256,384),[cx,15,20]);
            card.rotation.z=(n%2?1:-1)*.02;
            // Brass pushpins at the top corners of each pinned critique sheet.
            for(const dx of [-130,130])gk.add(new THREE.CylinderGeometry(6,6,8,12),[cx+dx,255,22],ORANGE,[1,1,1],[Math.PI/2,0,0],'metal');
        }
        gk.build(pin,dress);
        kit.label(pin,'STUDENT WORK / IN PROGRESS',[1420,84],[0,555,16],NAVY);
        const booth=kit.asset('voice-foley-booth','Voice & Foley recording corner',[w/2-1050,0,front-3500]),bk=detailKit();
        for(const x of [-610,610]){
            bk.box([65,1960,850],[x,980,0],NAVY,undefined,'fabric');
            bk.box([72,1970,38],[x,985,415],SILVER,undefined,'metal');
            bk.box([72,1970,38],[x,985,-415],SILVER,undefined,'metal');
            bk.box([480,45,80],[x,22,0],SILVER,undefined,'metal');
            for(const z of [-340,340])bk.ball(28,[x,28,z],INK,undefined,undefined,'rubber');
        }
        // Full-height acoustic rear wall with oak & navy resonator slats and script shelf.
        bk.box([1220,1920,60],[0,980,-400],'#394b5e',undefined,'fabric');
        for(let n=0;n<10;n++){
            bk.box([68,1520,34],[-535+n*119,1040,-358],n%2?NAVY:'#b89a74',undefined,n%2?'fabric':'paper');
        }
        // Angled voiceover script ledge with printed dialogue cue sheet.
        bk.box([760,16,240],[0,1010,-265],CHARCOAL,[.22,0,0],'metal');
        bk.box([210,3,270],[-80,1022,-260],WHITE,[.22,0,.05],'paper');
        bk.box([1285,48,900],[0,1984,0],NAVY,undefined,'fabric');
        bk.box([1300,54,42],[0,1984,432],CHARCOAL,undefined,'metal');
        bk.box([1300,8,46],[0,1956,434],ORANGE,undefined,'metal');
        // Studio condenser in a spider shock mount on a weighted boom stand + Foley floor mat.
        bk.box([920,10,620],[0,5,40],'#27303a',undefined,'rubber');
        bk.cyl(155,165,28,[0,14,120],INK,'metal');
        bk.cyl(12,15,1280,[0,655,120],SILVER,'metal');
        bk.cyl(22,22,42,[0,980,120],INK,'rubber');
        bk.box([20,20,280],[0,1300,40],SILVER,undefined,'metal');
        bk.add(new THREE.CylinderGeometry(22,22,145,16),[0,1350,-90],'#d5dce2',[1,1,1],[0,0,0],'metal');
        bk.add(new THREE.TorusGeometry(48,5,6,20),[0,1350,-90],INK,[1,1,1],[Math.PI/2,0,0],'metal');
        // Studio headphones hanging on the right interior wall hook.
        bk.box([28,16,45],[562,1380,80],SILVER,undefined,'metal');
        bk.add(new THREE.TorusGeometry(58,8,6,18,Math.PI),[548,1355,80],INK,[1,1,1],[0,Math.PI/2,0],'rubber');
        bk.build(booth,dress);
        // Recessed broadcast tally housing for the ON AIR lamp.
        kit.box(booth,[470,152,68],[0,2075,374],kit.mat(CHARCOAL,'metal'),8);
        const onAir=kit.material('#e0352b',{emissive:'#ff3b2e',emissiveIntensity:.15,roughness:.4});kit.box(booth,[440,126,56],[0,2075,382],onAir,6);kit.mediaOnAir=onAir;
        kit.label(booth,'ON AIR',[360,86],[0,2075,412],'#e0352b');
        const pop=kit.mesh(booth,new THREE.CircleGeometry(70,24),kit.mat('#202b35','fabric'),[0,1350,10]);pop.material.side=THREE.DoubleSide;
        kit.label(booth,'VOICE / FOLEY',[940,96],[0,1885,-359],NAVY);
    }
    if(l.media.lounge){
        // Rolling 75-inch review display facing the screening lounge.
        const [dx,dz]=l.media.lounge.display,display=kit.asset('mobile-review-display','Rolling review display',[dx,0,dz]);display.rotation.y=Math.PI;
        const dk=detailKit();
        dk.box([820,42,580],[0,58,0],INK,undefined,'metal');
        for(const x of [-350,350])for(const z of [-240,240])dk.ball(30,[x,30,z],INK,undefined,undefined,'rubber');
        for(const x of [-180,180])dk.box([46,1320,56],[x,710,0],SILVER,undefined,'metal');
        // Soundbar & media player shelf below the 75-inch screen.
        dk.box([680,18,220],[0,820,45],CHARCOAL,undefined,'metal');
        dk.box([920,58,68],[0,930,45],INK,undefined,'metal');
        dk.build(display,dress);
        screen(kit,display,[1660,940],[0,1450,40],1);
    }
    pools(kit);
}
// Daylight through the ocean window: the open part of the glazing (below the
// blind) projected on the carpet along the shared sun direction
// (room-refinement DAY_ANGLES), so its place and length follow the hour and
// the blind. Soft in the morning, a short bright patch in the afternoon, long
// and warm at dusk, none at night or behind the screening blackout.
const SUN_DIR={morning:[.62,-.36],afternoon:[1.45,.12],evening:[.32,.48]},SUN_LEVEL={morning:.075,afternoon:.2,evening:.05};   // a read of daylight on the carpet, not a spotlight: the film's morning keeps its mood
const BLIND_DROP=[.15,.35,.75,.55,1];
function mediaSun(kit){
    const {w,d,bz,front}=kit,z0=bz+d*.54,half=d*.24;
    const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,256,128);g.filter='blur(5px)';
    for(const [a,b] of [[.03,.32],[.35,.65],[.68,.97]]){g.fillStyle='#fff';g.fillRect(a*256,10,(b-a)*256,108);}
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    const geo=new THREE.PlaneGeometry(1,1,12,12);geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*3),3));
    const mat=new THREE.MeshBasicMaterial({map,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const sun=new THREE.Mesh(geo,mat);sun.name='Window daylight patch';sun.renderOrder=2;sun.raycast=()=>{};sun.castShadow=sun.receiveShadow=false;sun.frustumCulled=false;kit.root.add(sun);
    return (phase,color,gain)=>{
        const dir=SUN_DIR[phase];sun.visible=!!dir;if(!dir)return;
        const [elevation,sweep]=dir,top=2600-BLIND_DROP[phaseIndex(phase)]*1750,pos=geo.attributes.position,uv=geo.attributes.uv,col=geo.attributes.color;
        for(let i=0;i<pos.count;i++){
            const y=800+uv.getY(i)*(top-800),z=z0-half+uv.getX(i)*half*2,t=y/elevation,x=-w/2+25+t,zz=z+sweep*t;
            const edge=Math.min(w/2-40-x,zz-bz-30,front-30-zz),v=THREE.MathUtils.smoothstep(edge,0,420)/(1+t/6000);
            pos.setXYZ(i,Math.min(x,w/2-40),9,THREE.MathUtils.clamp(zz,bz+30,front-30));col.setXYZ(i,v,v,v);
        }
        pos.needsUpdate=col.needsUpdate=true;geo.computeBoundingSphere();mat.color.set(color).multiplyScalar(SUN_LEVEL[phase]*gain);
    };
}
// Additive pools for the screen, desk columns and the work wall; no lights.
function pools(kit){
    const {w,bz,layout:l}=kit,layer=createPoolLayer(kit.root,'Media lab light pools');kit.mediaPools=layer;
    layer.add(kit.root,[0,4,bz+1400],[4400,2600],'#6f93c8',[.05,.04,.1,.03,.4]);
    const columns=l.index===0?2:l.index<3?3:4,xs=columns===2?[-w/2+1800,w/2-2100]:Array.from({length:columns},(_,n)=>-w/2+1800+n*(w-3600)/(columns-1));
    // Only occupied workstation slots get a task-light pool.
    // Late edit: only the featured bay is in use; the others are asleep.
    for(let n=0;n<COUNTS[l.index];n++)layer.add(kit.root,[xs[n%columns],3,bz+2400+Math.floor(n/columns)*4000+300],[1900,1500],'#eef3fb',[.04,.04,.14,n?.012:.3,.05]);
    layer.add(kit.root,[xs[0]+250,2,bz+2400-150],[1500,1100],'#ffd9ad',[0,0,0,.34,0]);
    if(kit.mediaGallery)layer.add(kit.mediaGallery,[0,100,40],[2200,1400],'#ffd6a2',[.03,.03,.05,.04,.6],'back');
    const critique=kit.byId('activity-table');if(critique)layer.add(critique,[0,4,0],[2400,1600],'#ffd9a8',[0,0,.05,.04,.35]);
}
export function finishDecor(kit){
    const dress=kit.dress||kit.mat('#ffffff','powder',{vertexColors:true});
    const media=kit.byId('print-scan'),g=kit.asset('media-reference','Colour proof & reference swatches',[0,0,0],media),k=detailKit();
    // D65 colour checker passport & Pantone swatch deck on the right front of the counter.
    k.box([310,6,110],[275,903,205],CHARCOAL,undefined,'rubber');
    for(let n=0;n<12;n++)k.box([21,3,42],[145+n*23,907,188],['#f4efe5','#6a8eaa','#c56b50','#91ab91','#334c72','#edac57'][n%6],undefined,'paper');
    for(let n=0;n<12;n++)k.box([21,3,42],[145+n*23,907,232],['#1f2933','#3b6e8c','#d9822b','#e6c280','#789c88','#a8584c'][n%6],undefined,'paper');
    k.build(g,dress);
    const finish=kit.asset('media-finishing-tools','Print finishing · tape & binding clips',[-465,900,-180],media),tools=detailKit();
    // The rear left corner leaves the printer, return tray and proof stack free.
    tools.box([112,8,58],[0,4,0],INK,undefined,'rubber');
    for(const z of [-23,23])tools.box([50,34,6],[-24,25,z],INK,undefined,'metal');
    tools.add(new THREE.TorusGeometry(22,7,6,20),[-24,32,0],'#cbbf9e',[1,1,1],[0,0,0],'paper');
    tools.box([12,24,58],[48,20,0],SILVER,undefined,'metal');
    tools.box([52.2,1,30],[21.5,41,0],'#d5c8a8',[0,0,-.352],'paper');
    for(let n=0;n<2;n++){
        tools.box([24,15,18],[70+n*32,7.5,0],INK,undefined,'metal');
        tools.add(new THREE.TorusGeometry(8,1.2,4,12,Math.PI),[70+n*32,21,5],SILVER,[1,1,1],[0,0,0],'metal');
    }
    tools.build(finish,dress);
}
export function activityMaterials(k,phase,y){
    // Printed call sheets, edit tools, grading references and critique papers
    // are separate editable furniture-local kits in campus-lived-in.mjs.
}
// Screening & wrap (party): the critique table's review chairs leave the
// table and form a short row facing the screen; larger labs move the end
// chairs into a second row. Reversible (room-life's dailyDelta convention).
function wrapSeating(kit){
    const m=kit.phaseMover(),[ax,az]=kit.layout.activity,find=(x,z)=>()=>[kit.root.children.find(o=>o.userData.propId==='ergoflex-designer-chair'&&Math.hypot(o.position.x-x,o.position.z-z)<120)];
    const seats=[[-400,-700,0,-1200],[400,-700,0,-400],[-400,700,1,400],[400,700,1,1200]];
    for(const [dx,dz,back,rx] of seats)m.add(find(ax+dx,az+dz),null,i=>i===4?kit.pivotMove(ax+dx,az+dz,rx-dx,-1500-dz,back?0:Math.PI):null);
    // (the two end chairs of the larger labs stay at the table: the rows would put them into the edit bay in front)
    return m;
}
export function atmosphere(phase,gain,kit){
    (kit.mediaWrap??=wrapSeating(kit)).apply(phaseIndex(phase));
    // House lights: full for planning and editing, dimmed to a grading surround,
    // off for the screening (exit signs, screens and projection carry the room).
    if(kit.glow)kit.glow.emissiveIntensity=[.5,.56,.16,.012,.04][phaseIndex(phase)]*gain;
    for(const m of kit.mediaDiffusers||[])m.emissiveIntensity=phase==='afternoon'?.65:phase==='night'?0:phase==='party'?.3:.18;
    const p=phaseIndex(phase);
    for(const m of kit.screenMats)if(m.userData.screenVariant===3)m.emissiveIntensity=[.24,.26,.4,.06,.9][p];
    if(kit.lights?.[0])kit.lights[0].intensity*=[.85,.8,.55,1.2,.3][p];
    if(kit.mediaBoardPhase!==phase){
        const face=kit.board?.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.material.map?.image?.getContext);
        if(face){const c=face.material.map.image;drawBoard(c.getContext('2d'),c.width,c.height,kit.spec,0,phase);face.material.map.needsUpdate=true;}
        kit.mediaBoardPhase=phase;
    }
    // Screening: room light 1 becomes the screen's spill. Late edit: it is
    // the lab's one remaining night light, so the dark bays still read.
    const spill=kit.lights?.[1];if(spill){
        spill.userData.authored??={at:spill.position.clone()};
        if(phase==='party'){spill.position.set(0,1500,kit.bz+1600);spill.color.set('#9fbbe4');spill.intensity=(kit.root.scale.x*1000)**2*3.5*gain;}
        else{spill.position.copy(spill.userData.authored.at);if(phase==='night')spill.intensity*=.2;}
    }
    if(kit.sky?.map?.image?.getContext){
        const c=kit.sky.map.image.getContext('2d'),W=c.canvas.width,H=c.canvas.height;
        drawOccCampusView(c,W,H,phase);
        kit.sky.map.needsUpdate=true;
    }
    kit.mediaSun??=mediaSun(kit);kit.mediaSun(phase,kit.spec.modes[phase]?.key||'#fff4e0',gain);
    if(kit.mediaBlind){const drop=BLIND_DROP[p],b=kit.mediaBlind;b.scale.y=drop;b.position.y=875*(1-drop);b.material.map.repeat.y=6*drop;}
    if(kit.mediaBeam)kit.mediaBeam.color.setScalar([0,0,0,0,.09][p]);
    if(kit.mediaOnAir)kit.mediaOnAir.emissiveIntensity=[.04,.12,.7,.015,.04][p];
    kit.mediaPools?.apply(p,gain);
    if(kit.room.ceilingFixture)for(const g of kit.mediaCeiling||[])if(g.parent!==kit.room.ceilingFixture)kit.room.ceilingFixture.attach(g);
    kit.root.userData.mediaLab={concept:true,phase,deskCount:COUNTS[kit.layout.index],zones:['Editing','Digital art','Audio post','Capture','Print & scan','Critique','Equipment checkout']};
}
function deskProductionKit(role,size='60x30'){
    const g=new THREE.Group();
    g.name=/sound/.test(role)?'Audio mixing console & interface':role==='colour-grade'?'Colour grading control panel':'Media project slate & card reader';
    const k=detailKit(),wide=size==='60x30';
    if(/sound/.test(role)){
        k.box([390,34,210],[0,17,-80],INK,undefined,'metal');
        k.box([374,10,36],[0,38,-162],CHARCOAL,undefined,'glass');
        for(let n=0;n<8;n++){
            k.cyl(9,9,9,[-153+n*43,40,-125],n%3?SILVER:ORANGE,'metal');
            k.box([6,3,62],[-153+n*43,36,-48],SILVER,undefined,'metal');
            k.box([18,9,13],[-153+n*43,42,-58+n%3*10],WHITE,undefined,'rubber');
        }
        k.box([140,40,85],[wide?570:450,20,100],INK,undefined,'metal');
        for(let n=0;n<3;n++)k.cyl(9,9,8,[wide?530+n*28:410+n*28,44,100],n===2?ORANGE:SILVER,'metal');
    }else if(role==='colour-grade'){
        // Three-trackball DaVinci micro colour grading surface & jog wheel.
        k.box([110,18,70],[wide?-610:-470,9,110],INK,undefined,'metal');
        k.box([70,4,55],[wide?-610:-470,20,110],SILVER,undefined,'metal');
        const px=wide?565:435;
        k.box([185,18,125],[px,9,-20],INK,undefined,'metal');
        for(let n=0;n<3;n++){
            const bx=px-54+n*54;
            k.cyl(20,22,8,[bx,20,-12],SILVER,'metal');
            k.ball(14,[bx,24,-12],n===1?ORANGE:'#3a4856',undefined,undefined,'ceramic');
        }
    }else if(!/art|animation/.test(role)){
        k.box([110,18,70],[wide?-610:-470,9,110],INK,undefined,'metal');
        k.box([70,4,55],[wide?-610:-470,20,110],SILVER,undefined,'metal');
        k.cyl(18,20,8,[wide?-610:-470,25,110],ORANGE,'metal');
        k.box([180,10,125],[wide?570:440,5,-20],INK,undefined,'paper');
        for(let n=0;n<4;n++)k.box([17,2,60],[wide?520+n*25:390+n*25,11,-20],n%2?WHITE:ORANGE,undefined,'paper');
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
        const g=new THREE.Group();g.name='Nearfield studio speakers';g.userData.mediaSpeakerPair=true;g.userData.keepShelfDetail=true;
        g.userData.deskObject={desk:'station-'+spec.id,id:'media-studio-speakers'};mount.add(g);
        for(const side of [-1,1]){
            const speaker=new THREE.Group();speaker.userData.mediaSpeakerSide=side;speaker.position.x=side*(spec.size==='60x30'?660:470);g.add(speaker);const k=detailKit();
            k.box([140,245,165],[0,122,-105],INK,undefined,'metal');
            k.ball(49,[0,90,-19],'#596574',[1,1,.08],undefined,'rubber');
            k.ball(18,[0,195,-19],SILVER,[1,1,.08],undefined,'metal');
            k.box([65,3,5],[0,18,-19],ORANGE,undefined,'metal');
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
