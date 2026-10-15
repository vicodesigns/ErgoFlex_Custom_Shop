// Scene desk positions are in room-local millimetres; yaw is in radians.
import { cleanDeskStyle } from './room-desk-styles.mjs';
import { ACCESSORIES } from './catalog.mjs';
import { minimumHeightForTilt } from './motion-limits.mjs';
import { cleanArtwork } from './artwork-config.mjs';
export const SCENE_DESKS_KEY = 'ergoflex.sceneDesksBySizeV2';
const finite = (n,min,max) => Number.isFinite(n) && n>=min && n<=max;
const deskId = id => typeof id==='string' && /^[a-z][a-z0-9-]{0,79}$/.test(id);
export function cleanDeskObjects(value) {
    const objects={};
    for(const [id,v] of Object.entries(value||{})){
        if(!deskId(id)||Object.keys(objects).length>=200||!['desktop','shelf','lower-shelf','base-shelf'].includes(v?.role))continue;
        const t=v.transform;
        if(!t||!['p','s'].every(k=>['x','y','z'].every(a=>finite(t[k]?.[a],k==='s'?0.00001:-100000,100000)))||!['x','y','z','w'].every(a=>finite(t.q?.[a],-1,1)))continue;
        if(['x','y','z','w'].reduce((sum,a)=>sum+t.q[a]**2,0)<0.000001)continue;
        if(v.added&&(!deskId(v.propId)))continue;
        objects[id]={role:v.role,added:v.added===true,removed:v.removed===true,label:String(v.label||'Desk object').slice(0,100),
            ...(v.added?{propId:v.propId}:{}),...(v.custom?{custom:true}:{}),...(typeof v.artworkVisible==='boolean'?{artworkVisible:v.artworkVisible}:{}),...(v.clampMount==='rear-edge-v1'?{clampMount:v.clampMount}:{}),...(v.monitorLayout==='curved-right-v1'?{monitorLayout:v.monitorLayout}:{}),transform:Object.fromEntries(['p','q','s'].map(k=>[k,Object.fromEntries((k==='q'?['x','y','z','w']:['x','y','z']).map(a=>[a,t[k][a]]))]))};
    }
    const wide=objects['accessory-wide-monitor'],portrait=objects['accessory-portrait-monitor'];
    if(wide&&portrait){
        // One-time upgrade of saved Office pairs to the requested arrangement.
        // Later custom adjustments retain the marker and are left as edited.
        if(!wide.monitorLayout&&!portrait.monitorLayout&&wide.transform.p.x<portrait.transform.p.x){
            [wide.transform.p.x,portrait.transform.p.x]=[portrait.transform.p.x,wide.transform.p.x];
        }
        wide.monitorLayout=portrait.monitorLayout='curved-right-v1';
    }
    return objects;
}
export function cleanDeskPose(v) {
    if(!v || !finite(v.x,-100000,100000) || !finite(v.z,-100000,100000) || !finite(v.yaw,-10000,10000))return null;
    return {x:v.x,z:v.z,yaw:v.yaw};
}
export function cleanDeskSetting(v) {
    const pose=cleanDeskPose(v?.pose);
    if(!pose || !finite(v.height,28,52.5) || !finite(v.tilt,-5,90))return null;
    let lights={};
    try {const json=JSON.stringify(v.lights||{});if(json.length>60000)return null;lights=JSON.parse(json);}catch{return null;}
    return {pose,height:v.height,tilt:v.tilt,lights};
}
export function cleanDeskRecording(input) {
    if(!Array.isArray(input)||input.length<2||input.length>1801)return [];
    const frames=[];let previous=-1;
    for(const v of input){
        const pose=cleanDeskPose(v);
        if(!pose || !finite(v.t,0,180) || v.t<=previous || !finite(v.height,28,52.5)||!finite(v.tilt,-5,90))return [];
        frames.push({...pose,t:v.t,height:v.height,tilt:v.tilt});previous=v.t;
    }
    if(frames[0].t!==0)return [];
    return frames;
}
export function sampleDeskRecording(frames,time) {
    if(!frames.length)return null;
    let a=frames[0],b=a;
    for(let i=1;i<frames.length;i++){b=frames[i];if(time<=b.t)break;a=b;}
    const u=a===b?0:Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t)));
    const mix=k=>a[k]+(b[k]-a[k])*u;
    // Follow the recorded turn direction, including turns beyond 180 degrees.
    return {pose:{x:mix('x'),z:mix('z'),yaw:mix('yaw')},height:mix('height'),tilt:mix('tilt')};
}
export function cleanSceneDeskVariant(v) {
    const setting=cleanDeskSetting(v);
    if(!setting||!['48x30','60x30'].includes(v?.size))return null;
    const phases={};
    for(const phase of ['morning','afternoon','evening','night','party']){
        const s=cleanDeskSetting(v.phases?.[phase]);
        if(s)phases[phase]={...s,recording:cleanDeskRecording(v.phases[phase].recording)};
    }
    const valid=new Set(ACCESSORIES.map(a=>a.id)),accessories=Array.isArray(v.accessories)?[...new Set(v.accessories.filter(id=>valid.has(id)))]:null;
    const finishes=Object.fromEntries(Object.entries(v.accessoryFinishes||{}).filter(([id,finish])=>ACCESSORIES.find(a=>a.id===id)?.finishes?.includes(finish)));
    return {...setting,size:v.size,phases,objects:cleanDeskObjects(v.objects),
        artwork:cleanArtwork(v.artwork||{v:1,surfaces:{}}),
        ...(cleanDeskStyle(v.style)?{style:cleanDeskStyle(v.style)}:{}),
        ...(accessories?{accessories,accessoryFinishes:finishes}:{}),
        ...(deskId(v.peripheralRecipe)?{peripheralRecipe:v.peripheralRecipe}:{}),
        ...(v.peripheralSetup==='product-reference-v1'?{peripheralSetup:v.peripheralSetup}:{}),
        ...(v.classroomDesign==='hbhs-mixed-classroom-v1'?{classroomDesign:v.classroomDesign}:{}),
        ...(v.shelfStation==='shelf-first-v1'?{shelfStation:v.shelfStation}:{}),
        ...(['occ','hbhs'].includes(v.productArtwork?.id) && ['48x30','60x30'].includes(v.productArtwork.size) && Number.isSafeInteger(v.productArtwork.revision) && v.productArtwork.revision>=0
            ? {productArtwork:{id:v.productArtwork.id,size:v.productArtwork.size,revision:v.productArtwork.revision}} : {}),
        ...(v.productBuild?.id==='library' && ['48x30','60x30'].includes(v.productBuild.size) && Number.isSafeInteger(v.productBuild.revision) && v.productBuild.revision>=0
            ? {productBuild:{id:'library',size:v.productBuild.size,revision:v.productBuild.revision}} : {})};
}
export function seedSceneDeskSize(source,size) {
    const draft=cleanSceneDeskVariant({...source,size});
    if(!draft)return null;
    const ratio=size===source.size?1:size==='48x30'?.8:1.25;
    for(const object of Object.values(draft.objects))object.transform.p.x*=ratio;
    draft.height=Math.max(draft.height,minimumHeightForTilt(draft.tilt,size));
    for(const phase of Object.values(draft.phases)){
        phase.height=Math.max(phase.height,minimumHeightForTilt(phase.tilt,size));
        for(const frame of phase.recording)frame.height=Math.max(frame.height,minimumHeightForTilt(frame.tilt,size));
    }
    return draft;
}
export function cleanSceneDeskData(input) {
    const rooms={};
    for(const [key,room] of Object.entries(input?.rooms||{})){
        if(!/^[a-z]+\/[a-z]+$/.test(key)||Object.keys(rooms).length>=150)continue;
        const desks={};
        for(const [id,v] of Object.entries(room?.desks||{})){
            const variant=cleanSceneDeskVariant(v);
            if(!deskId(id)||!variant||Object.keys(desks).length>=24)continue;
            const sizeSetups={};
            for(const size of ['48x30','60x30'])if(size!==v.size){
                const saved=cleanSceneDeskVariant({...v.sizeSetups?.[size],size});
                if(saved)sizeSetups[size]=saved;
            }
            desks[id]={...variant,name:String(v.name||'ErgoFlex desk').slice(0,80),
                added:v.added===true,...(Object.keys(sizeSetups).length?{sizeSetups}:{})};
        }
        const deleted=[...new Set((Array.isArray(room?.deleted)?room?.deleted:[]).filter(deskId))].slice(0,24);
        const activityHome={};
        for(const [id,sizes] of Object.entries(room?.activityHome||{}))if(desks[id]){
            const valid={};for(const size of ['48x30','60x30']){const value=cleanDeskSetting(sizes?.[size]);if(value)valid[size]={...value,...(/^[a-f0-9]{8}$/.test(sizes[size].clearance)?{clearance:sizes[size].clearance}:{})};}
            if(Object.keys(valid).length)activityHome[id]=valid;
        }
        rooms[key]={desks,deleted,selected:desks[room?.selected]?room?.selected:Object.keys(desks)[0]||null,
            ...(Object.keys(activityHome).length?{activityHome}:{})};
    }
    return {version:1,rooms,...(Array.isArray(input?.productAccessories)?{productAccessories:[...new Set(input.productAccessories.filter(deskId))].slice(0,100)}:{})};
}
