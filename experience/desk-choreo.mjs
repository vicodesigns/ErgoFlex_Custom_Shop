// Desk choreography: every room desk gets its own lift / tilt movement timeline.
//
// Data (shot.deskEdits, one entry per edited non-featured room desk; DeskSel owns the other fields of an entry):
//   {desk:'<api.sceneDesks record id>', name, size:'48x30'|'60x30', initial?:{height,tilt}, clips:[...], ...}
// `clips` are the featured desk's own movement clips (desk-clips.mjs), lift and tilt lanes only. A desk starts from its
// `initial` pose, else from the pose it has in the room (its base), and plays its clips by chapter seconds. Every sample
// is held inside the real desk of that size (motion-limits.mjs): 28-52.5 in, -5 to 65 deg, and the tilt gives way to the
// height (at 28 in the 60 in and 48 in desks both reach 39 deg; full 65 deg needs 40.5 in / 42.5 in).
//
// Three consumers share this file: the Director timeline editor (a view of the shot that shows one desk's clips as the
// "motion" the desk editor edits), the live stage (createDeskChoreo, sampled at the playhead) and tools/experience/
// film-fx.mjs (the same createDeskChoreo, once per frame by chapter time), so the live stage and the render agree.
import {cleanClip,cleanClipMotion,sampleClipMotion,validateClipSchedule,clipEnd} from './desk-clips.mjs';
import {cleanPose} from './desk-track.mjs';
import {TILT_MIN,TILT_MAX,LOW_HEIGHT,maximumTiltForHeight} from '../motion-limits.mjs';

export const CHOREO_LANES=['lift','tilt'];
export const HEIGHT_MAX=52.5;
const SIZES=['48x30','60x30'];
export const sizeKey=v=>SIZES.includes(v)?v:/^48/.test(String(v||''))?'48x30':'60x30';
export const sizeLabel=v=>sizeKey(v)==='48x30'?'48″':'60″';
const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;

// A pose the real desk of that size can hold. Not rounded: this runs every frame.
export function limitDeskPose(pose,size){
  const height=Math.max(LOW_HEIGHT,Math.min(HEIGHT_MAX,finite(pose?.height,LOW_HEIGHT)));
  const tilt=Math.max(TILT_MIN,Math.min(TILT_MAX,maximumTiltForHeight(height,sizeKey(size)),finite(pose?.tilt,0)));
  return {height,tilt};
}
// "At 30 in the 48 in desk tilts to 39 deg at most" for the inspector.
export function deskLimitNote(size,height){
  const max=maximumTiltForHeight(Math.max(LOW_HEIGHT,Math.min(HEIGHT_MAX,height)),size);
  return `${sizeLabel(size)} desk: 28–52.5″ and −5° to 65°. At ${Number(height.toFixed(1))}″ it tilts to ${Number(Math.min(TILT_MAX,max).toFixed(1))}° at most.`;
}

// Clips for one desk: lift and tilt only, each valid, none overlapping on its lane, all inside the chapter.
// Tolerant (drops what cannot be kept) because this runs when a saved cut loads; the editor validates strictly.
export function cleanDeskClips(clips,seconds){
  if(!Array.isArray(clips))return [];
  const kept=[];
  for(const v of clips.slice(0,512)){
    let c;try{c=cleanClip(v);}catch{continue;}
    if(!CHOREO_LANES.includes(c.lane)||c.kind==='pose'&&!c.path)continue;
    if(seconds&&(c.start<0||clipEnd(c)>seconds+.00001))continue;
    kept.push(c);
  }
  kept.sort((a,b)=>a.start-b.start||a.lane.localeCompare(b.lane));
  const out=[];
  for(const c of kept){
    const last=out.filter(o=>o.lane===c.lane).at(-1);
    if(last&&c.start<clipEnd(last)-.00001)continue;
    if(out.some(o=>o.id===c.id))c.id=crypto.randomUUID();
    out.push(c);
  }
  return out;
}
// shot.deskEdits as it survives cleanShot: unknown keys of an entry (DeskSel's pose / build...) pass through.
export function cleanDeskChoreo(v={},seconds){
  if(!Array.isArray(v.deskEdits))return {};
  const by=new Map();
  for(const e of v.deskEdits.slice(0,48)){
    if(typeof e?.desk!=='string'||!/^[\w.:~-]{1,80}$/.test(e.desk))continue;
    const out={...structuredClone(e),desk:e.desk};
    out.clips=cleanDeskClips(e.clips,seconds);
    if(typeof e.name==='string')out.name=e.name.slice(0,80);else delete out.name;
    if(e.size!==undefined)out.size=sizeKey(e.size);
    if(e.initial)out.initial=limitDeskPose(e.initial,out.size);
    by.set(out.desk,out);
  }
  return {deskEdits:[...by.values()]};
}
// What the stage plays for a chapter: the Director's deskEdits, else the film shot's sceneDeskEdits (an import).
export function effectiveDeskEdits(film,shot){
  if(Array.isArray(shot?.deskEdits))return shot.deskEdits;
  return cleanDeskChoreo({deskEdits:film?.sceneDeskEdits},shot?.seconds||film?.seconds).deskEdits||[];
}
export const hasChoreo=e=>Array.isArray(e?.clips)&&e.clips.length>0;
// The throw the Director uses when a shorter chapter would cut a desk's movement off.
export function validateDeskEdits(edits,seconds){
  for(const e of edits||[])if(hasChoreo(e)){
    try{validateClipSchedule(e.clips,seconds);}catch(error){throw Error(`${e.name||'A desk'}: ${error.message}`);}
  }
}

// ---------- sampling (pure) ----------
// The motion object desk-clips.mjs samples: the desk's initial pose, else its base, then its clips.
export function deskMotion(edit,base={}){
  const start=limitDeskPose(edit?.initial||base,edit?.size);
  return {version:2,initial:cleanPose(start),clips:Array.isArray(edit?.clips)?edit.clips:[]};
}
export function sampleDeskEdit(edit,seconds,base={}){
  return limitDeskPose(sampleClipMotion(deskMotion(edit,base),seconds),edit?.size);
}
// Every choreographed desk at one time: [{desk, height, tilt}]. baseOf(deskId) is the desk's own pose in the room.
export function sampleDeskEdits(edits,seconds,baseOf=()=>({})){
  return (edits||[]).filter(hasChoreo).map(e=>({desk:e.desk,...sampleDeskEdit(e,seconds,baseOf(e.desk))}));
}

// ---------- the Director's view of one desk as a "shot" ----------
const keep=(e)=>Object.keys(e).some(k=>!['desk','name','size','clips'].includes(k));
// Write one desk's clips into shot.deskEdits (a desk with nothing left to say is removed).
export function putDeskClips(shot,desk,meta,clips){
  const list=(shot.deskEdits||[]).filter(e=>e.desk!==desk),old=(shot.deskEdits||[]).find(e=>e.desk===desk);
  const entry={...(old||{}),desk,name:meta.name??old?.name,size:meta.size??old?.size,clips:cleanDeskClips(clips,shot.seconds)};
  if(entry.name===undefined)delete entry.name;if(entry.size===undefined)delete entry.size;
  if(entry.clips.length||keep(entry)){list.push(entry);shot.deskEdits=list;}else if(list.length)shot.deskEdits=list;else delete shot.deskEdits;
  return shot;
}
// A Proxy of the shot whose `motion` is the desk's clips, so desk-editor.mjs edits any desk exactly as it edits the
// featured one: reads give {version:2, initial, clips}, writes of `motion` land in shot.deskEdits.
export function deskShotView(real,{desk,name,size,base,seed}){
  const entry=()=>(real.deskEdits||seed?.()||[]).find(e=>e.desk===desk);
  return new Proxy(real,{
    get(target,key){
      if(key==='id')return target.id+'~'+desk;
      if(key==='motion')return deskMotion({...entry(),size:entry()?.size||size},base);
      return target[key];
    },
    set(target,key,value){
      if(key==='motion'){
        // First Director edit of this chapter's desks: start from what the film already has (an earlier Export cut).
        if(!target.deskEdits&&seed?.()?.length)target.deskEdits=structuredClone(seed());
        putDeskClips(target,desk,{name,size},value?.clips||[]);return true;
      }
      target[key]=value;return true;
    }
  });
}
// Who is being choreographed in the Director: null = the featured desk. Reset when the chapter changes.
export function createChoreoTarget({realShot,roster,onChange=()=>{},baseline=()=>null}){
  let desk=null,shotId=null;
  const rows=()=>{try{return roster()||[];}catch{return [];}};
  // The chapter's desk edits: the Director's own once it has any, else the film's (an earlier import).
  const edits=()=>realShot()?.deskEdits||baseline()||[];
  const current=()=>{
    if(!desk)return null;
    const s=realShot();if(!s||s.id!==shotId){desk=null;return null;}
    const r=rows().find(r=>r.id===desk);if(!r||r.featured){if(rows().length)desk=null;return desk?{id:desk}:null;}
    return r;
  };
  return {
    desk:()=>current()?.id||null,
    info:()=>current(),
    pick(id){const next=id||null;if(next===desk)return;desk=next;shotId=next?realShot().id:null;onChange(desk);},
    roster:rows,real:realShot,edits,
    shot(){
      const real=realShot(),c=current();if(!c)return real;
      const e=edits().find(e=>e.desk===c.id);
      return deskShotView(real,{desk:c.id,name:c.name||e?.name,size:c.size||e?.size,base:{height:c.height,tilt:c.tilt},seed:baseline});
    },
    // The clips of every other desk (and the featured desk when a room desk is open), for the compact "Other desks" rows.
    others(){
      const real=realShot(),open=current()?.id||null,out=[];
      for(const e of edits())if(hasChoreo(e)&&e.desk!==open)out.push({id:e.desk,label:e.name||rows().find(r=>r.id===e.desk)?.name||e.desk,clips:e.clips});
      if(open&&real.motion?.clips?.length)out.unshift({id:'',label:'Featured desk',clips:real.motion.clips.filter(c=>CHOREO_LANES.includes(c.lane))});
      return out;
    }
  };
}

// ---------- the room's desks on the stage (live stage and film-fx) ----------
// Poses the room's other desks from their clips. Remembers each desk's own pose before the first write (record.choreoBase)
// and puts it back on restore(); the featured desk (api.sceneDesks.selected) is never touched.
export function createDeskChoreo(api){
  let edits=[];
  const desks=()=>api.sceneDesks,record=id=>desks()?.records?.get(id);
  const put=(r,height,tilt)=>{
    const key=`${height}:${tilt}`;if(r.poseAt===key&&r.state.height===height&&r.state.tilt===tilt)return false;
    if(!r.rig)desks().ensureRig(r);
    r.state.height=height;r.state.tilt=tilt;r.rig.updatePose(height,tilt);r.poseAt=key;desks().objects?.stow?.update(r);return true;
  };
  const base=r=>r.choreoBase||(r.choreoBase={height:r.state.height,tilt:r.state.tilt,poseAt:r.poseAt});
  const free=r=>{const b=r.choreoBase;if(!b)return;delete r.choreoBase;if(!r.rig)return;r.state.height=b.height;r.state.tilt=b.tilt;r.rig.updatePose(b.height,b.tilt);r.poseAt=b.poseAt;desks().objects?.stow?.update(r);};
  const owned=()=>[...(desks()?.records?.values()||[])].filter(r=>r.choreoBase);
  return {
    // The chapter's deskEdits; desks that lost their clips go back to their own pose.
    set(list){
      edits=(list||[]).filter(hasChoreo);
      const wanted=new Set(edits.map(e=>e.desk));
      for(const r of owned())if(!wanted.has(r.id))free(r);
    },
    count:()=>edits.length,
    apply(seconds){
      const posed=[];
      for(const e of edits){
        const r=record(e.desk);if(!r||r.id===desks().selected||!r.state)continue;
        const b=base(r),p=sampleDeskEdit({...e,size:e.size||r.state.size},seconds,b);
        put(r,p.height,p.tilt);posed.push(r.id);
      }
      return posed;
    },
    restore(){for(const r of owned())free(r);edits=[];},
    // The desk's own pose in the room (what its clips start from when it has no `initial`).
    baseOf(id){const r=record(id);return r?{...(r.choreoBase||{height:r.state.height,tilt:r.state.tilt})}:{}}
  };
}
// The room's desks for the Director's desk picker.
export function roomDesks(api,choreo){
  const desks=api.sceneDesks;
  return [...(desks?.records?.values()||[])].filter(r=>r.state).map(r=>{
    const b=choreo?.baseOf(r.id)||{height:r.state.height,tilt:r.state.tilt};
    return {id:r.id,name:r.state.name||r.id,size:sizeKey(r.state.size),featured:r.id===desks.selected,height:b.height??r.state.height,tilt:b.tilt??r.state.tilt};
  });
}
