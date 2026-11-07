// Director desk edits: per-chapter changes to the room's OTHER ErgoFlex desks (every api.sceneDesks record except the
// featured one: size, place, starting height / tilt; DeskChoreo adds their lift / tilt moves, DeskBuild their build).
// They live in the cut shot as shot.deskEdits and reach the live stage, Render still and the film as the film shot's
// sceneDeskEdits (tools/experience/film-desk-edits.mjs installs them through film-fx), exactly like propEdits.
//   {desk:'<scene desk record id>', name?:'<state.name, label only>',
//    size?:'48x30'|'60x30',                     the record's own size switch (the right model shows)
//    pose?:{x, z, yaw},                         room-local millimetres / radians (the record's state.pose)
//    initial?:{height, tilt},                   inches / degrees at 0 s, clamped for the desk's size (start-pose.mjs)
//    clips?:[…]                                 DeskChoreo: the desk's lift / tilt moves (desk-clips.mjs clip objects)
//    build?:{woodFinish, baseFinish, trimColor, accessories:[{id, slot}]}}     DeskBuild
// shot.deskEdits absent: the film shot's own sceneDeskEdits (an earlier Export cut, imported by
// build-round8-director.py as director-camera 'desks') are the Director's edits. Present (even []): they replace those.
import {clampStartPose} from './start-pose.mjs';
export const DESK_SIZES=['48x30','60x30'];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const r3=v=>Math.round(v*1e3)/1e3;
export const DESK_ID=/^[a-z][a-z0-9-]{0,79}$/;
export const SLOTS=['desktop','shelf','lower-shelf','base-shelf'];
const jsonSize=v=>{try{return JSON.stringify(v).length;}catch{return Infinity;}};
export function cleanDeskEdit(e){
  if(!e||typeof e!=='object'||typeof e.desk!=='string'||!DESK_ID.test(e.desk))return null;
  const out={desk:e.desk};
  if(typeof e.name==='string'&&e.name&&e.name.length<=80)out.name=e.name;
  if(DESK_SIZES.includes(e.size))out.size=e.size;
  const p=e.pose;if(p&&finite(p.x)&&finite(p.z)&&finite(p.yaw)&&Math.abs(p.x)<1e5&&Math.abs(p.z)<1e5&&Math.abs(p.yaw)<1e4)out.pose={x:r3(p.x),z:r3(p.z),yaw:Math.round(p.yaw*1e5)/1e5};
  const i=e.initial;if(i&&finite(i.height)&&finite(i.tilt))out.initial=clampStartPose(i,out.size||'48x30')   // the looser desk; the stage clamps for the desk's real size;
  // DeskChoreo / DeskBuild own their cleaning; here they pass through when sane.
  if(Array.isArray(e.clips)&&e.clips.length&&e.clips.length<=200&&e.clips.every(c=>c&&typeof c==='object')&&jsonSize(e.clips)<=200000)out.clips=structuredClone(e.clips);
  if(e.build&&typeof e.build==='object'&&!Array.isArray(e.build)&&jsonSize(e.build)<=50000)out.build=structuredClone(e.build);
  return Object.keys(out).some(k=>k!=='desk'&&k!=='name')?out:null;
}
export function cleanDeskEdits(v={}){
  if(!Array.isArray(v.deskEdits))return {};
  const by=new Map();for(const e of v.deskEdits.slice(0,48).map(cleanDeskEdit))if(e)by.set(e.desk,e);
  return {deskEdits:[...by.values()]};
}
export const filmDeskEdits=film=>(Array.isArray(film?.sceneDeskEdits)?film.sceneDeskEdits:[]).map(cleanDeskEdit).filter(Boolean);
export const effectiveDeskEdits=(film,shot)=>Array.isArray(shot?.deskEdits)?structuredClone(shot.deskEdits):filmDeskEdits(film);
// The chapter's film fields for the stage and the renderer ({} = the film's as they are).
export const mergeDeskEdits=(film,shot)=>Array.isArray(shot?.deskEdits)?{sceneDeskEdits:structuredClone(shot.deskEdits)}:{};
// "60″ → 48″, moved, turned 90°, starts at 40″ / 0°".
const inch=mm=>Math.round(mm/25.4*10)/10,deg=r=>Math.round(r*180/Math.PI*10)/10;
export function describeDeskEdit(e,was={}){
  const parts=[];
  if(e.size&&e.size!==was.size)parts.push((was.size?was.size.slice(0,2)+'″ → ':'')+e.size.slice(0,2)+'″');
  if(e.pose)parts.push('placed at x '+inch(e.pose.x)+'″, z '+inch(e.pose.z)+'″, turned '+deg(e.pose.yaw)+'°');
  if(e.initial)parts.push(`starts at ${e.initial.height}″ / ${e.initial.tilt}°`);
  if(e.clips?.length)parts.push(e.clips.length+' move'+(e.clips.length===1?'':'s'));
  if(e.build)parts.push('built');
  return parts.join(', ')||'unchanged';
}
