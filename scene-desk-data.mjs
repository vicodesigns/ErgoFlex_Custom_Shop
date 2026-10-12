// Scene desk positions are in room-local millimetres; yaw is in radians.
import { cleanDeskStyle } from './room-desk-styles.mjs';
export const SCENE_DESKS_KEY = 'ergoflex.sceneDesksV1';
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
            ...(v.added?{propId:v.propId}:{}),...(v.custom?{custom:true}:{}),...(v.monitorLayout==='curved-right-v1'?{monitorLayout:v.monitorLayout}:{}),transform:Object.fromEntries(['p','q','s'].map(k=>[k,Object.fromEntries((k==='q'?['x','y','z','w']:['x','y','z']).map(a=>[a,t[k][a]]))]))};
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
export function cleanSceneDeskData(input) {
    const rooms={};
    for(const [key,room] of Object.entries(input?.rooms||{})){
        if(!/^[a-z]+\/[a-z]+$/.test(key)||Object.keys(rooms).length>=150)continue;
        const desks={};
        for(const [id,v] of Object.entries(room?.desks||{})){
            const setting=cleanDeskSetting(v);
            if(!deskId(id)||!setting||!['48x30','60x30'].includes(v.size)||Object.keys(desks).length>=24)continue;
            const phases={};
            for(const phase of ['morning','afternoon','evening','night','party']){
                const s=cleanDeskSetting(v.phases?.[phase]);
                if(s)phases[phase]={...s,recording:cleanDeskRecording(v.phases[phase].recording)};
            }
            desks[id]={...setting,name:String(v.name||'ErgoFlex desk').slice(0,80),size:v.size,
                added:v.added===true,phases,objects:cleanDeskObjects(v.objects),...(cleanDeskStyle(v.style)?{style:cleanDeskStyle(v.style)}:{})};
        }
        const deleted=[...new Set((Array.isArray(room?.deleted)?room?.deleted:[]).filter(deskId))].slice(0,24);
        rooms[key]={desks,deleted,selected:desks[room?.selected]?room?.selected:Object.keys(desks)[0]||null};
    }
    return {version:1,rooms,...(Array.isArray(input?.productAccessories)?{productAccessories:[...new Set(input.productAccessories.filter(deskId))].slice(0,100)}:{})};
}
