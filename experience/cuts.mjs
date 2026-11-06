import {cleanClipMotion} from './desk-clips.mjs';
import {cleanDeskTracks,cleanPose} from './desk-track.mjs';
export {cleanPose} from './desk-track.mjs';
import {cleanCameraKeys,cleanCamera} from './camera-track.mjs';
export {cleanCamera} from './camera-track.mjs';
import {score} from './score.mjs';
import {cleanLighting} from './film-lighting.mjs';
import {cleanSceneLights} from './light-edits.mjs';
import {cleanFilmTitles} from './film-titles.mjs';
export const CUTS_KEY='ergoflex.clientCuts.v1';
export const KINDS=[['room','Explore the room'],['hero','Desk showcase'],['glide','Omni-wheel movement'],['lift','Sit to stand'],['tilt','Drafting / easel'],['group','Group-work Groove'],['storage','Storage Groove'],['wellness','Movement break'],['proximity','Proximity demo'],['music','Music lighting'],['media','Curved-screen media']];
export const PRESET_IDS=['office','artist','gaming','music','library','compact','creative','architect','occ','hbhs'];
const id=()=>globalThis.crypto.randomUUID();
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v)?v:id();
const text=(v,max,fallback='')=>typeof v==='string'?(v.trim().slice(0,max)||fallback):fallback;
const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
export function defaultPreset(room,kind='room'){
  if(room==='occmedialab')return 'occ';if(room==='highschool')return 'hbhs';if(room==='library')return 'library';
  if(kind==='tilt'||room==='creative')return 'artist';if(room==='gaming')return 'gaming';if(room==='music')return 'music';
  return 'office';
}
export function defaultMotion(kind){
  const from=cleanPose({height:['tilt','storage'].includes(kind)?43.5:28}),to={...from};
  if(['lift','wellness'].includes(kind))to.height=43.5;
  if(['tilt','storage'].includes(kind))to.tilt=65;
  return {from,to};
}
export function cleanShot(v={},catalog){
  const room=text(v.room,64,'product');
  if(!/^[a-z]+$/.test(room))throw Error('Invalid environment.');
  const environment=catalog?.find(r=>r.id===room);if(catalog&&!environment)throw Error(`Unknown environment: ${room}`);
  const kind=KINDS.some(([id])=>id===v.kind)?v.kind:'room';
  const layouts=environment?.layouts||[],layout=layouts.find(l=>l.id===v.layout)||layouts[0];
  const modes=layout?.modes||environment?.modes||[],mode=modes.find(m=>m.id===v.mode)||modes[0];
  const shot={id:safeId(v.id),room,kind,seconds:number(v.seconds,2,90,8),title:text(v.title,140,'Your space. Reimagined.'),detail:text(v.detail,260),
    preset:PRESET_IDS.includes(v.preset)?v.preset:defaultPreset(room,kind),transition:number(v.transition,0,3,.8),size:['48x30','60x30'].includes(v.size)?v.size:'60x30'};
  if(catalog){if(layout)shot.layout=layout.id;if(mode)shot.mode=mode.id;}
  else {if(/^[a-z0-9-]{1,64}$/.test(v.layout||''))shot.layout=v.layout;if(/^[a-z0-9-]{1,64}$/.test(v.mode||''))shot.mode=v.mode;}
  if(Array.isArray(v.motion?.clips))shot.motion=cleanClipMotion(v.motion,shot.seconds);
  else if(v.motion){const tracks=cleanDeskTracks(v.motion.tracks);shot.motion=Object.values(tracks).some(a=>a.length)?{tracks}:{from:cleanPose(v.motion.from),to:cleanPose(v.motion.to)};}
  const from=cleanCamera(v.camera?.from),to=cleanCamera(v.camera?.to);
  const keys=cleanCameraKeys(v.camera?.keys);
  if(keys.length)shot.camera={keys};else if(from||to)shot.camera={...(from?{from}:{}),...(to?{to}:{} )};
  // Film lighting edited in the Director (absent until then).
  Object.assign(shot,cleanLighting(v),cleanSceneLights(v));
  // Film titles edited in the Director (absent until then): copy, timing, shadow shape.
  const titles=cleanFilmTitles(v.filmTitles,shot.seconds);if(titles?.length)shot.filmTitles=titles;
  return shot;
}
export function cleanCut(value,catalog){
  if(value?.schema!=='ergoflex.client-cut'||value.version!==1)throw Error('Choose an ErgoFlex client-cut JSON file.');
  if(!Array.isArray(value.shots)||!value.shots.length||value.shots.length>80)throw Error('A cut needs between 1 and 80 chapters.');
  const seen=new Set(),shots=value.shots.map(v=>{const shot=cleanShot(v,catalog);if(seen.has(shot.id))shot.id=id();seen.add(shot.id);return shot;});
  return {schema:'ergoflex.client-cut',version:1,id:safeId(value.id),name:text(value.name,100,'Client presentation'),client:text(value.client,100),
    volume:number(value.volume,0,1,.32),updated:text(value.updated,40),shots};
}
export function makeCut(name='New client cut',shots=score()){
  return cleanCut({schema:'ergoflex.client-cut',version:1,id:id(),name,shots:shots.map(s=>({...s,preset:s.preset||({awaken:'gaming',hero:'gaming',awareness:'gaming'})[s.id]||defaultPreset(s.room,s.kind)}))});
}
export function sceneShot(room,{layout,mode,seconds=8}={}){
  const place=room.layouts.find(l=>l.id===layout)||room.layouts[0],activity=(place?.modes||room.modes||[]).find(m=>m.id===mode)||(place?.modes||room.modes||[])[0];
  return cleanShot({id:id(),room:room.id,layout:place?.id,mode:activity?.id,seconds,kind:'room',title:room.name,detail:activity?.label||room.caption||'',preset:defaultPreset(room.id)});
}
export function generateCut(catalog,selection,{name='Client presentation',client='',seconds=8,bookends=true}={}){
  const shots=selection.map(choice=>{
    const room=catalog.find(r=>r.id===choice.room);if(!room)throw Error('That environment is unavailable.');return sceneShot(room,{...choice,seconds});
  });
  if(!shots.length)throw Error('Select at least one environment.');
  if(bookends){const base=makeCut().shots;shots.unshift({...base[0],seconds:4});shots.push({...base.at(-1),seconds:4});}
  return {...makeCut(name,shots),client};
}
export function encodeCut(cut){
  const bytes=new TextEncoder().encode(JSON.stringify(cleanCut(cut)));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  if(bytes.length>45000)throw Error('This cut is too large for a link. Use Export cut instead.');
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeCut(encoded,catalog){
  if(typeof encoded!=='string'||encoded.length>65000||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('Invalid presentation link.');
  try{return cleanCut(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)))),catalog);}catch(error){throw Error(`This presentation link could not be opened: ${error.message}`);}
}
export class CutLibrary{
  constructor(storage){this.storage=storage;this.data={version:1,cuts:[],drafts:Object.create(null),active:null};try{const saved=JSON.parse(storage.getItem(CUTS_KEY)||'null');if(saved?.version===1){this.data.cuts=(saved.cuts||[]).slice(0,60).map(c=>cleanCut(c));for(const c of Object.values(saved.drafts||{}).slice(0,60)){const draft=cleanCut(c);this.data.drafts[draft.id]=draft;}this.data.active=typeof saved.active==='string'?saved.active:null;}}catch{} }
  write(){this.storage.setItem(CUTS_KEY,JSON.stringify(this.data));}
  refresh(){this.data=new CutLibrary(this.storage).data;}
  draft(cut){const c=cleanCut(cut);this.refresh();delete this.data.drafts[c.id];this.data.drafts[c.id]=c;const keys=Object.keys(this.data.drafts);for(const key of keys.slice(0,Math.max(0,keys.length-60)))delete this.data.drafts[key];this.data.active=c.id;this.write();}
  save(cut){const c={...cleanCut(cut),updated:new Date().toISOString()};this.refresh();const i=this.data.cuts.findIndex(x=>x.id===c.id);if(i<0){if(this.data.cuts.length>=60)throw Error('The library holds 60 cuts. Export a backup before removing one.');this.data.cuts.push(c);}else this.data.cuts[i]=c;delete this.data.drafts[c.id];this.data.active=c.id;this.write();return structuredClone(c);}
  current(){const d=this.data.drafts[this.data.active]||this.data.cuts.find(c=>c.id===this.data.active);return d?structuredClone(d):null;}
  get(id){const c=this.data.drafts[id]||this.data.cuts.find(c=>c.id===id);return c?structuredClone(c):null;}
  remove(id){this.refresh();this.data.cuts=this.data.cuts.filter(c=>c.id!==id);delete this.data.drafts[id];if(this.data.active===id)this.data.active=null;this.write();}
}
