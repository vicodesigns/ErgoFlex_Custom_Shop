import * as THREE from 'three';

export const SCENE_SCREENS_KEY = 'ergoflex.sceneScreensV1';
const PHASES = ['morning','afternoon','evening','night','party'];
// Titles describe illustrative projects, never real work or patient data.
export const SCREEN_THEMES = Object.fromEntries([
    ['office','Project workspace','plan','#72c9bf',['Daily priorities','Design review','Team debrief','Focus session','Project showcase']],
    ['home','Home workspace','plan','#91b9d8',['Morning plan','Work in progress','Evening journal','Quiet focus','Weekend ideas']],
    ['coworking','Community workspace','plan','#edb56d',['Shared planning','Sprint board','Community notes','Solo focus','Community meetup']],
    ['library','Library research','read','#9fc4a0',['Catalogue & reading list','Research annotations','Reading by lamplight','Late study notes','Study group sources']],
    ['study','Reading & research','read','#dab77a',['Reading list','Research notebook','Chapter review','Quiet annotations','Seminar discussion']],
    ['music','Audio studio','audio','#ad9cec',['Vocal warm-up','Multitrack session','Listening mix','Headphone master','Live set cues']],
    ['creative','Artist workspace','art','#edb27f',['Colour studies','Illustration in progress','Sketchbook review','Quiet drawing','Portfolio collection']],
    ['gaming','Gaming studio','game','#71ccea',['Launch & warm-up','Practice arena','Co-op adventure','Solo exploration','Tournament lobby']],
    ['gym','Training studio','metrics','#b2d27b',['Mobility plan','Circuit intervals','Recovery session','Rest & recovery','Team workout']],
    ['kitchen','Kitchen notebook','recipe','#e8b078',['Breakfast recipe','Lunch preparation','Supper for two','Tomorrow’s menu','Dinner party menu']],
    ['lounge','Lounge cinema','cinema','#d0a0bc',['Morning magazine','Travel documentary','Movie night','Ambient nightscape','Game night']],
    ['bedroom','Personal journal','read','#b9a8d8',['Morning pages','Reading journal','Wind-down chapter','Night reading','Weekend inspirations']],
    ['workshop','Design & fabrication','draft','#eab26e',['Measurements & plan','Prototype assembly','Assembly review','Design check','Maker showcase']],
    ['gallery','Gallery collection','art','#d4bd86',['Curator notes','Collection study','Artist conversation','Archive research','Exhibition opening']],
    ['scifi','Orbital systems','space','#71d9e2',['Mission briefing','Sample analysis','Navigation watch','Quiet systems watch','Transit coordination']],
    ['security','Operations demo','metrics','#77c4d2',['Shift briefing','Active watch','Evening status','Night watch','Team handover']],
    ['police','Public service demo','plan','#94bddc',['Briefing agenda','Illustrative case board','Shift notes','Quiet review','Team briefing']],
    ['government','Civic workspace','plan','#9ecbb4',['Daily planning','Service workflow','Review agenda','Quiet drafting','Workshop proposals']],
    ['kindergarten','Little discoveries','learn','#ebc173',['Welcome & weather','Shapes & colours','Family discoveries','Tomorrow’s activities','Shared learning']],
    ['elementary','Learning studio','learn','#a6ce9f',['Morning reading','Project exploration','Family learning','Lesson preparation','Class workshop']],
    ['middleschool','Learning studio','learn','#8fc6db',['Seminar question','Team experiment','Study notes','Lesson preparation','STEM workshop']],
    ['highschool','Research classroom','learn','#9fb9db',['Class outline','Group investigation','Study review','Lesson preparation','Project presentation']],
    ['college','College seminar','read','#dab987',['Lecture notes','Working seminar','Evening discussion','Independent study','Group presentation']],
    ['university','University research','read','#9cbfa7',['Lecture outline','Research seminar','Evening lecture','Graduate reading','Symposium findings']],
    ['laboratory','Research instrument demo','metrics','#8fd1c2',['Instrument preparation','Sample experiment','Analysis curves','Instrument watch','Research review']],
    ['hospital','Care workspace demo','care','#a6d6ce',['Rounds planning','Care coordination','Handover checklist','Observation demo','Team review']],
    ['mobileit','Systems workshop demo','metrics','#82bddd',['System checks','Service diagnostics','Maintenance plan','Overnight status','Deployment review']],
    ['occmedialab','OCC media projects','film','#f5a349',['Storyboard & shot plan','Edit & create','Sound & colour','Student reel screening','Portfolio critique']],
    ['product','Desk workspace','plan','#9ed6c1',['Workspace preview','Work in progress','Review notes','Quiet focus','Project collection']]
].map(([id,title,kind,accent,tasks])=>[id,{title,kind,accent,tasks}]));

export function cleanScreenSettings(value) {
    const out={v:1,enabled:{},off:{}};
    for(const [id,on] of Object.entries(value?.enabled||{}))if(SCREEN_THEMES[id]&&typeof on==='boolean')out.enabled[id]=on;
    for(const [key,off] of Object.entries(value?.off||{}))if(key.length<500&&off===true)out.off[key]=true;
    return out;
}
function text(c,value,x,y,size=20,color='#e7eff5',max=900){c.fillStyle=color;c.font=`${size>=24?'600 ':''}${size}px sans-serif`;c.fillText(value,x,y,max);}
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function graph(c,x,y,w,h,phase,color,wave=false){
    c.strokeStyle='#34505f';c.lineWidth=1;for(let i=0;i<5;i++){c.beginPath();c.moveTo(x,y+i*h/4);c.lineTo(x+w,y+i*h/4);c.stroke();}
    c.strokeStyle=color;c.lineWidth=3;c.beginPath();for(let i=0;i<=100;i++){const v=wave?Math.sin(i*.55+phase)*Math.sin(i*.07+1):.25+Math.sin(i*.065+phase)*.23+i*.003;c.lineTo(x+w*i/100,y+h*.5-v*h*.45);}c.stroke();
}
export function drawSceneScreen(c,W,H,{scene='office',phase='morning',label,variant=0,role='',preset}={}) {
    const productTheme=({occ:'occmedialab',artist:'creative',architect:'workshop',creative:'creative',library:'library',music:'music',gaming:'gaming',office:'office',compact:'home'})[preset];
    const theme=SCREEN_THEMES[scene==='product'?(productTheme||'product'):scene]||SCREEN_THEMES.office,pi=Math.max(0,PHASES.indexOf(phase)),a=theme.accent;
    let kind=theme.kind;if(scene==='product')kind=({artist:'art',creative:'art',architect:'draft',music:'audio',gaming:'game',library:'read',compact:'plan'})[preset]||'plan';
    if(scene==='occmedialab')kind=/sound/.test(role)?'audio':/art|animation|colour/.test(role)?'art':phase==='night'?'cinema':variant===1?'art':'film';
    c.save();c.scale(W/960,H/540);box(c,0,0,960,540,phase==='night'?'#0a1521':'#142431');box(c,0,0,960,52,'#203747');
    text(c,theme.title.toUpperCase(),24,33,18,a,730);text(c,['09:00','14:00','18:30','22:00','16:00'][pi],850,33,17);
    const title=label&&!['Morning','Afternoon','Evening','Night','Party'].includes(label)?label:theme.tasks[pi];text(c,title,26,96,30,'#ecf3f4',900);
    text(c,variant?'REFERENCE / REVIEW':'ACTIVE PROJECT',28,126,12,'#9daebc');
    if(['audio','film'].includes(kind)){
        box(c,26,145,610,195,'#0c1824');
        if(kind==='film')landscape(c,34,153,594,179,pi,a);else{for(let i=0;i<4;i++)graph(c,42,162+i*43,575,32,pi+i,['#8fd9d2','#b1a2e6','#dbaf76','#7daeca'][i],true);}
        box(c,657,145,277,195,'#203544');text(c,kind==='film'?'Shot / review notes':'Mix / channel levels',672,177,19,a,250);
        for(let i=0;i<5;i++){text(c,(kind==='film'?['Establishing view','Detail & texture','Character moment','Cutaway study','Closing frame']:['Voice','Ambient field','Music bed','Room tone','Master bus'])[i],673,212+i*25,14);box(c,858,201+i*25,52-((pi+i)%3)*9,7,a);}
        for(let row=0;row<4;row++){text(c,['V1 / MAIN','A1 / VOICE','A2 / FIELD','A3 / SCORE'][row],28,370+row*30,12,'#a5bcc9');for(let n=0;n<6;n++)box(c,130+n*131+pi*4,354+row*30,110-(row+n)%3*14,23,['#689da8','#9c89bb','#81ac91','#c8a06d'][row]);}
        box(c,285+pi*75,347,2,130,'#f7ede1');
    }else if(['art','game','cinema','space'].includes(kind)){
        box(c,26,145,680,330,'#0b1724');
        if(kind==='art'){
            box(c,43,161,644,297,'#ded6c6');for(let i=0;i<7;i++){c.fillStyle=['#7b9f91','#d79367','#58839c','#bfa763','#ac93b9'][(i+pi)%5];c.beginPath();c.ellipse(120+i*73,270+Math.sin(i+pi)*70,72,95,(i+pi)*.5,0,7);c.fill();}
            text(c,phase==='night'?'LINE / LIGHT STUDY':'COLOUR / FORM STUDY',62,437,15,'#283744');
        }else if(kind==='space'){
            for(let i=0;i<70;i++)box(c,40+(i*137)%650,160+(i*67)%290,i%5?2:4,2,'#879eb7');c.strokeStyle=a;c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.ellipse(353,300,100+i*62,65+i*37,-.4,0,7);c.stroke();}c.fillStyle='#88b7cc';c.beginPath();c.arc(353,300,61,0,7);c.fill();box(c,470+pi*22,246-pi*7,8,8,'#ffffff');
        }else{landscape(c,40,159,652,299,pi,a);text(c,kind==='game'?['READY TO EXPLORE','PRACTICE ARENA','CO-OP JOURNEY','NIGHT EXPEDITION','TEAM LOBBY'][pi]:theme.tasks[pi],62,441,19);}
        text(c,kind==='art'?'Palette & layers':kind==='space'?'Telemetry':'Session notes',732,176,18,a,200);
        for(let i=0;i<6;i++){box(c,734,196+i*38,22,22,['#bdd2bc',a,'#81a6be','#b3a0c8'][i%4]);text(c,kind==='art'?['Base colour','Light study','Shape layer','Texture','Reference','Final review'][i]:['Explore','Observe','Collect','Review','Reflect','Continue'][i],769,213+i*38,14,'#ccd8df',160);}
    }else if(['metrics','care'].includes(kind)){
        const labels=kind==='care'?['Workflow','Team tasks','Room readiness']:['Signal','Capacity','Session'];
        for(let i=0;i<3;i++){box(c,26+i*312,148,288,88,'#233b49');text(c,labels[i],45+i*312,176,15,a);text(c,kind==='care'?['Planned','Reviewed','Ready'][(i+pi)%3]:`${[72,84,96][(i+pi)%3]} %`,45+i*312,214,26);}
        graph(c,46,266,560,168,pi,a);text(c,kind==='care'?'ILLUSTRATIVE WORKFLOW':'ILLUSTRATIVE SIGNAL',49,463,13,'#a5becb');
        for(let i=0;i<5;i++){box(c,652,263+i*39,275,29,'#233b49');text(c,(kind==='care'?['Plan rounds','Coordinate tasks','Prepare workspace','Review handover','Confirm equipment']:['Input check','Calibration','Stable baseline','Review queue','Session ready'])[i],663,283+i*39,16,a);}
    }else if(kind==='plan'){
        for(let col=0;col<3;col++){const x=26+col*312;box(c,x,147,288,330,'#203642');text(c,['Plan','In progress','Review'][(col+pi)%3],x+18,181,21,a);for(let n=0;n<3;n++){box(c,x+14,198+n*86,260,74,['#344e5c','#375761','#3f4f66'][(n+pi+col)%3]);text(c,['Outline ideas','Develop project','Share findings'][(n+col+pi)%3],x+28,225+n*86,17);text(c,variant?'Reference notes':'Workspace team',x+28,249+n*86,12,'#a9c1cb');}}
    }else if(kind==='draft'){
        box(c,26,147,665,331,'#1f3c53');c.strokeStyle='#426579';c.lineWidth=1;for(let n=0;n<28;n++){c.beginPath();c.moveTo(35+n*24,151);c.lineTo(35+n*24,472);c.stroke();}for(let n=0;n<14;n++){c.beginPath();c.moveTo(30,154+n*24);c.lineTo(684,154+n*24);c.stroke();}
        c.strokeStyle='#d6e9ea';c.lineWidth=4;c.strokeRect(117,202,435,210);c.strokeRect(117,202,170,110);c.strokeRect(352,202,200,110);c.strokeRect(352,352,200,60);text(c,'FLOOR PLAN / DESIGN STUDY',742,184,15,a,188);text(c,'Revision '+(pi+1),739,219,18);text(c,'Scale 1:100',739,253,17);
    }else{
        const learning=kind==='learn',recipe=kind==='recipe';box(c,26,147,596,330,'#e8e0cf');text(c,recipe?'INGREDIENTS / METHOD':learning?'DISCOVER / TRY / REFLECT':'RESEARCH NOTEBOOK',48,181,19,'#405760',560);
        if(learning){for(let n=0;n<3;n++){c.fillStyle=['#bf735c','#62978f','#d4ac58'][(n+pi)%3];c.beginPath();c.arc(122+n*170,274,49,0,7);c.fill();text(c,['A','B','C'][(n+pi)%3],104+n*170,287,35,'#fff6e2');}}
        else for(let n=0;n<7;n++){text(c,(recipe?['Seasonal ingredients','Prepare & measure','Combine gently','Cook / rest / serve','Taste & adjust','Share at the table','Keep recipe notes']:['Source / reading notes','Question to investigate','Evidence & observations','Patterns and connections','Ideas for discussion','Reflection / next steps','Bibliography / references'])[(n+pi)%7],49,218+n*33,18,'#536369',548);}
        if(learning){text(c,'What do you notice?',58,380,23,'#405760');text(c,'Make a prediction. Share your idea.',58,423,19,'#65746e');}
        text(c,'Session notebook',657,180,21,a,277);for(let n=0;n<5;n++){box(c,657,207+n*46,276,34,'#28424e');text(c,['Explore','Make notes','Try an idea','Review','Share'][(n+pi)%5],674,230+n*46,17);}
    }
    box(c,0,502,960,38,'#203747');text(c,title.toUpperCase(),24,526,14,a,728);text(c,'SIMULATED',837,526,12,'#9aaeba',112);c.restore();
}
function landscape(c,x,y,w,h,pi,a){
    const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,['#5d9fbd','#67b1cc','#855d9b','#152844','#72909f'][pi]);g.addColorStop(1,'#c7be92');c.fillStyle=g;c.fillRect(x,y,w,h);
    c.fillStyle=pi===3?'#dbe5ec':'#f5dc9b';c.beginPath();c.arc(x+w*.75,y+h*.23,h*.085,0,7);c.fill();
    for(let n=0;n<3;n++){c.fillStyle=['#5c8794','#355b70','#234359'][n];c.beginPath();c.moveTo(x,y+h);for(let i=0;i<9;i++)c.lineTo(x+i*w/8,y+h*(.45+n*.16)-Math.sin(i*1.7+pi+n)*h*.12);c.lineTo(x+w,y+h);c.fill();}box(c,x+w*.42,y+h*.62,w*.16,h*.38,a);
}
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
export class SceneScreens {
    constructor(ctx,settings){this.ctx=ctx;this.settings=cleanScreenSettings(settings);this.entries=[];this.known=new WeakMap();this.cache=new Map();this.at=-Infinity;this.discoveredAt=-Infinity;this.context='';this.revision=0;this.selected='';}
    enabled(scene=this.ctx.context().scene){return this.settings.enabled[scene]??scene!=='product';}
    export(){return structuredClone(this.settings);}
    restore(value){this.settings=cleanScreenSettings(value);this.update(true);this.ctx.save(this.export());}
    save(){this.ctx.save(this.export());this.update(true);}
    setEnabled(on){this.settings.enabled[this.ctx.context().scene]=!!on;this.save();}
    setScreen(key,on){if(on)delete this.settings.off[key];else this.settings.off[key]=true;this.save();}
    allOn(){const prefix=this.ctx.context().scene+':';for(const key of Object.keys(this.settings.off))if(key.startsWith(prefix))delete this.settings.off[key];this.settings.enabled[this.ctx.context().scene]=true;this.save();}
    discover(context){
        const found=[],seen=new Set(),{scene,layout}=context;
        const add=(obj,key,label,info={})=>{
            if(!obj.isMesh||Array.isArray(obj.material)||seen.has(obj))return;seen.add(obj);
            let entry=this.known.get(obj);if(!entry){
                const m=obj.material;entry={obj,key,label,info,native:m.userData.screenVariant!==undefined||obj.userData.sceneDisplay==='native'||m.userData.sceneDisplay==='native',base:{map:m.map,color:m.color?.clone(),emissive:m.emissive?.clone(),emissiveMap:m.emissiveMap,intensity:m.emissiveIntensity??0}};if(!entry.native&&m.map&&!m.userData.sharedTextures&&!m.map.userData.sceneScreenContent)obj.ownedTextures=[...(obj.ownedTextures||[]),m.map];this.known.set(obj,entry);
            }
            entry.key=key;entry.label=label;entry.info=info;found.push(entry);
        };
        for(const {root,key,label,role,id} of this.ctx.sources())root?.traverse(obj=>{if(obj.name==='monitor-screen')add(obj,`${scene}:${layout}:${key}:${id}`,`${label} · ${id.replaceAll('-',' ')}`,{role,variant:id==='portrait-monitor'?1:0,portrait:/portrait/.test(id)});});
        let n=0;this.ctx.room()?.root?.traverse(obj=>{
            if(obj.material?.userData?.screenVariant!==undefined||obj.userData.sceneDisplay||obj.material?.userData?.sceneDisplay||['Gaming TV display','Lounge cinema display','Game Mode synchronized screen'].includes(obj.name)){
                let parent=obj;while(parent.parent&&!parent.userData.sceneAssetKey&&!parent.userData.propId)parent=parent.parent;
                add(obj,`${scene}:${layout}:fixture:${parent.userData.sceneAssetKey||parent.userData.propId||obj.name}:${n++}`,parent.name||'Room display',{variant:obj.material.userData.screenVariant??0});
            }
        });
        if(found.map(e=>e.key+'|'+e.label).join('\n')!==this.entries.map(e=>e.key+'|'+e.label).join('\n'))this.revision++;
        this.entries=found;if(!found.some(e=>e.key===this.selected))this.selected=found[0]?.key||'';
    }
    texture(context,entry){
        const info=entry.info,{scene,phase,label,preset}=context,variant=info.variant||0;
        const key=[scene,phase,label,preset,info.role,variant,info.portrait].join('|');if(this.cache.has(key))return this.cache.get(key);
        const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;drawSceneScreen(canvas.getContext('2d'),960,540,{scene,phase,label,variant,role:info.role,preset});
        const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.userData.sceneScreenContent=true;
        if(info.portrait){map.center.set(.5,.5);map.rotation=-Math.PI/2;}
        this.cache.set(key,map);return map;
    }
    update(force=false){
        const context=this.ctx.context(),identity=[context.scene,context.layout,context.phase,context.label,context.preset].join('|'),now=performance.now();
        if(!force&&identity===this.context&&now-this.at<250)return;
        const changed=identity!==this.context;this.context=identity;
        if(force||changed||now-this.discoveredAt>1000||this.ctx.sourcesChanged?.()){this.discover(context);this.discoveredAt=now;}
        // Use a separate discovery timer so applying the dark glass does not
        // depend on the room's material updater or game preview cadence.
        this.at=now;
        for(const entry of this.entries){
            const {obj,key,base}=entry,m=obj.material,on=this.enabled(context.scene)&&!this.settings.off[key];
            const external=m.map?.isVideoTexture||(m.map&&m.map!==base.map&&!m.map.userData.sceneScreenContent&&!obj.userData.mediaLabScreen);
            const map=external?m.map:entry.native?base.map:on?this.texture(context,entry):null;
            if(m.map!==map){m.map=map;m.needsUpdate=true;}
            m.color?.copy(on?(entry.native||external?base.color:new THREE.Color('#ffffff')):new THREE.Color(entry.native||external?'#000000':'#060709'));
            if(m.emissive){m.emissiveMap=on?map:base.emissiveMap;m.emissive.set(on?'#c9dbea':'#000000');m.emissiveIntensity=on?(context.phase==='night'?.18:.1):0;}
            obj.userData.sceneScreenStatus={key,on,phase:context.phase,theme:context.scene};
        }
        // Keep texture memory bounded after visiting many scenes and phases.
        const active=new Set(this.entries.map(e=>e.obj.material.map));
        if(this.cache.size>32)for(const [key,map] of this.cache){if(active.has(map))continue;this.cache.delete(key);map.dispose();if(this.cache.size<=32)break;}
        this.ctx.sync?.(this);
    }
    click(event,camera,canvas,roots){
        this.update(true);const rect=canvas.getBoundingClientRect(),p=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(p,camera);
        const hit=ray.intersectObjects(roots.filter(Boolean),true).find(h=>visible(h.object)&&h.object.material?.depthWrite!==false);
        const entry=this.entries.find(e=>e.obj===hit?.object);if(!entry)return false;
        this.selected=entry.key;
        // Clicking a dark screen while all content is disabled enables this
        // display alone, preserving the off state of the other visible screens.
        if(!this.enabled()) {for(const e of this.entries)this.settings.off[e.key]=true;this.settings.enabled[this.ctx.context().scene]=true;this.setScreen(entry.key,true);}
        else this.setScreen(entry.key,!!this.settings.off[entry.key]);
        this.ctx.notify?.(`${entry.label}: ${this.settings.off[entry.key]?'off':'on'}`);return true;
    }
}
