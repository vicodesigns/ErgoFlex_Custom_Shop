// Director people edits: who is in a film chapter. They live in the cut shot as shot.peopleEdits and reach the live
// stage, Render still and the film as the chapter's `people` (room-people.mjs filter).
//   shot.peopleEdits = {
//     cast: [ { key, id, hide?,                              one person: a name for this placement, the library model
//               desk: 'sit' | 'stand' | 'wheel', station?,   at the film desk (follows it; shown while its height suits
//               reach?,                                      the model), or at one of the room's other desks
//               beside: [dx, dz],                            or near the film desk, in its frame
//               at: [x, z], turn, y,                         or at a spot: room millimetres, degrees, lift in mm
//               scale,                                       size factor (1 = as built)
//               colors: { top, bottom, shoes, hair },        '#rrggbb' for those parts of the model (absent: as built)
//               pose: { '<bone>': [x, y, z, w] },            pose fine tuning: that bone turned from the built pose (quaternion,
//                                                            the bone's own frame; experience/pose-editor.mjs)
//               look: ['<key>', ...],                        whom they look at (room-people.mjs gazeOf)
//               poseKeys: [{ t, pose, ease? }, ...],          the joints along the chapter's time (people-pose-keys.mjs)
//               walk, roll, act, change, on, seat, ... } ],   the film's own placement fields (room-people.mjs, top): kept as they are
//     when: { '<key>': [[t0, t1, fadeIn?, fadeOut?], ...] }, the seconds of the chapter that person is there (absent: all of it)
//     chair: { back, side, turn }, fade                      as in the film's people filter
//   }
// shot.peopleEdits absent: the chapter's cast is the film's (film.people). Present: it is the whole cast, the room's
// own people included as plain entries (the People tab copies them in on the first edit), so a later change to a
// room's standing cast never changes a chapter Vico has arranged.
//
// v: 2 (S31, 2026-11-15): shot.peopleEdits = { v: 2, ...the film's whole `people` object } VERBATIM: only, except, place,
// chair, fade, when and the cast with every field, known here or not. Nothing is whitelisted, so a chapter with walks,
// rolls, actions and seated extras goes through the Director and comes back the same. The Director import
// (build-round8-director.py) does the same on its side: the film's `people` is this object minus `v` and minus the cast
// entries with hide: true (and their `when`). Without `v` it is the first form above (cleaned field by field).
import {cleanPoseKeys} from '../people-pose-keys.mjs';
import {migratePostures,validateArchivedKeys} from '../people-postures.mjs';
export {cleanPoseKeys,poseAt,setPoseKey,removePoseKey,moveKey,setKeyEase,copyKey,pasteKey,keyTimes,keyedBones,EASES,KEY_SNAP} from '../people-pose-keys.mjs';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const r1=v=>Math.round(v*10)/10,r3=v=>Math.round(v*1000)/1000;
const KEY=/^[a-z0-9][a-z0-9_-]{0,47}$/i,MODEL=/^people-[a-z0-9][a-z0-9._-]{0,90}$/i,STATION=/^[a-z0-9][a-z0-9_-]{0,60}$/i;
export const PARTS=['top','bottom','shoes','hair'];
const pair=(v,max)=>Array.isArray(v)&&v.length===2&&v.every(n=>finite(n)&&Math.abs(n)<=max)?v.map(n=>Math.round(n)):undefined;
// A pose: bone name -> unit quaternion (4 decimals); turns under a hundredth of a degree are dropped.
const BONE=/^[A-Za-z][A-Za-z0-9_]{0,39}$/;
export function cleanPose(v){
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const out={};
  for(const [name,q] of Object.entries(v).slice(0,80)){
    if(!BONE.test(name)||!Array.isArray(q)||q.length!==4||!q.every(finite))continue;
    const n=Math.hypot(...q);if(n<1e-6)continue;
    const s=q[3]<0?-1/n:1/n,u=q.map(c=>Math.round(c*s*10000)/10000);
    if(Math.hypot(u[0],u[1],u[2])<1e-4)continue;
    out[name]=u;
  }
  return Object.keys(out).length?out:null;
}
const PLACED=['on','near','by','around'];
const KEPT=[...PLACED,'seat','along','depth','rise','toward','face','clear','walk','roll','act','change','toes','tread','carry'];
// sitReach / standReach: the person's distance from the desk in their other stance (mm; `reach` is their own model's),
// which the room's models of the same person at the featured desk take too (room-people.mjs deskReach).
// A desk user's own chair roll: chairRoll (mm the chair rolls back before they stand, the film's 265) and chairScoot
// (mm they slide to the seat's front as they lean in, the film's 90). room-people-motion.mjs ROLL / SCOOT.
export const CHAIR_FIELDS=[['chairRoll',800],['chairScoot',300]];
export const REACH_EASES=['smooth','linear'];
// reachKeys: [{at, dur, to, ease?}] the chair rolled in or out during the shot (room-people-motion.mjs reachAt): seconds,
// seconds, mm from the keys like `reach`; at most 16, in time order.
export function cleanReachKeys(v){
  if(!Array.isArray(v))return null;
  const out=v.slice(0,16).filter(k=>k&&finite(k.at)&&finite(k.to)&&k.at>=0&&k.at<=600&&k.to>=0&&k.to<=3000).map(k=>{const o={at:r3(k.at),dur:r3(finite(k.dur)?Math.max(0,Math.min(30,k.dur)):1.5),to:Math.round(k.to)};if(k.ease==='linear')o.ease='linear';return o;}).sort((a,b)=>a.at-b.at);
  return out.length?out:null;
}
const plain=v=>{try{return JSON.stringify(v)!==undefined;}catch{return false;}};
export function cleanPerson(e){
  if(!e||typeof e!=='object'||typeof e.id!=='string'||!MODEL.test(e.id))return null;
  const key=typeof e.key==='string'&&KEY.test(e.key)?e.key:e.id.slice(0,48),out={key,id:e.id};
  if(e.hide===true)out.hide=true;
  if(e.fromDesk===true&&!['sit','stand','wheel'].includes(e.desk))out.fromDesk=true;   // (the desk user stepping out and back: room-people.mjs stepOuts)
  if(['sit','stand','wheel'].includes(e.desk)){out.desk=e.desk;if(typeof e.station==='string'&&STATION.test(e.station))out.station=e.station;if(finite(e.reach)&&e.reach>=0&&e.reach<=3000)out.reach=Math.round(e.reach);}
  else{
    const at=pair(e.at,100000),beside=pair(e.beside,20000);
    if(at){out.at=at;out.turn=finite(e.turn)?r1(((e.turn+180)%360+360)%360-180):0;if(finite(e.y)&&Math.abs(e.y)<=5000&&Math.abs(e.y)>=.5)out.y=Math.round(e.y);}
    else if(beside)out.beside=beside;
    else if(!PLACED.some(k=>e[k]!==undefined))return null;   // (on a seat, near a spot, by or around a prop: the film's own placements)
    else if(finite(e.turn))out.turn=r1(e.turn);              // (their `turn` corrects the way the seat or the prop faces them)
  }
  // the film's own fields (room-people.mjs): kept as they are, so a walker, a wheelchair roll, an action or a seated
  // extra is still one after an edit in the People tab
  for(const k of KEPT)if(e[k]!==undefined&&plain(e[k]))out[k]=structuredClone(e[k]);
  if(e.chair===false)out.chair=false;
  // at the desk: their own chair roll (mm) and timed roll in / out (reachKeys); build-round8-director.py clean_people checks the same
  if(out.desk){for(const k of ['sitReach','standReach'])if(finite(e[k])&&e[k]>=0&&e[k]<=3000)out[k]=Math.round(e[k]);for(const [k,hi] of CHAIR_FIELDS)if(finite(e[k])&&e[k]>=0&&e[k]<=hi)out[k]=Math.round(e[k]);const rk=cleanReachKeys(e.reachKeys);if(rk)out.reachKeys=rk;}
  const keys=cleanPoseKeys(e.poseKeys);if(keys)out.poseKeys=keys;
  if(finite(e.scale)&&e.scale>=.2&&e.scale<=3&&Math.abs(e.scale-1)>1e-3)out.scale=r3(e.scale);
  const colors={};for(const part of PARTS)if(typeof e.colors?.[part]==='string'&&/^#[0-9a-f]{6}$/i.test(e.colors[part]))colors[part]=e.colors[part].toLowerCase();
  if(Object.keys(colors).length)out.colors=colors;
  const pose=cleanPose(e.pose);if(pose)out.pose=pose;
  // Existing correction values are archival data, not new editor input. Preserve
  // their precision and unknown model records through the legacy whitelist too.
  for(const k of ['pose','poseKeys','postures','poseBindings','poseSource'])if(e[k]!==undefined&&plain(e[k]))out[k]=structuredClone(e[k]);
  const look=[].concat(e.look??[]).filter(k=>typeof k==='string'&&KEY.test(k)).slice(0,4);if(look.length)out.look=look;
  return validateArchivedKeys(out);
}
export function cleanSpans(v,seconds=Infinity){
  if(!Array.isArray(v))return null;
  const spans=v.slice(0,8).flatMap(s=>{
    if(!Array.isArray(s)||!finite(s[0])||!finite(s[1]))return [];
    const t0=Math.max(0,Math.min(s[0],seconds)),t1=Math.max(t0,s[1]);if(t1-t0<.01)return [];
    const span=[r3(t0),r3(t1)];if(finite(s[2])||finite(s[3]))span.push(r3(Math.max(0,Math.min(5,finite(s[2])?s[2]:.5))),r3(Math.max(0,Math.min(5,finite(s[3])?s[3]:.5))));
    return [span];
  });
  return spans.length?spans:null;
}
// v: 2: the film's whole people object as it is (see the top); only a cast entry that is not a person is dropped.
function cleanPeopleV2(v){
  let out;try{out=JSON.parse(JSON.stringify(v));}catch{return null;}
  out.cast=out.cast.filter(e=>e&&typeof e==='object'&&typeof e.id==='string'&&MODEL.test(e.id)).map(validateArchivedKeys);
  return out;
}
// Called at a deliberate write/export boundary, never as a side effect of read.
export const canonicalPeople = p => ({...p,cast:p.cast.map(migratePostures)});
export function cleanPeople(v){
  if(!v||typeof v!=='object'||!Array.isArray(v.cast))return null;
  if(v.v===2)return cleanPeopleV2(v);
  const cast=[],seen=new Set();
  for(const raw of v.cast.slice(0,80)){const p=cleanPerson(raw);if(!p)continue;let key=p.key,n=2;while(seen.has(key))key=(p.key.slice(0,44)+'-'+n++);p.key=key;seen.add(key);cast.push(p);}
  const out={cast},when={};
  for(const [key,spans] of Object.entries(v.when&&typeof v.when==='object'?v.when:{})){const s=seen.has(key)&&cleanSpans(spans);if(s)when[key]=s;}
  if(Object.keys(when).length)out.when=when;
  const c=v.chair;if(c&&typeof c==='object'&&[c.back,c.side,c.turn].some(finite))out.chair={back:finite(c.back)?Math.round(c.back):620,side:finite(c.side)?Math.round(c.side):0,turn:finite(c.turn)?r1(c.turn):0};
  if(finite(v.fade)&&v.fade>=0&&v.fade<=5)out.fade=r3(v.fade);
  return out;
}
// The cut field (cuts.mjs): kept only when it is a cast.
export function cleanPeopleEdits(v={}){const p=cleanPeople(v.peopleEdits);return p?{peopleEdits:p}:{};}
// The film's `people` for a chapter with Director edits: nobody of the room's own cast, the Director's cast instead.
export function peopleFilter(edits){
  const p=cleanPeople(edits);if(!p)return null;
  if(p.v===2){   // the whole object, minus the marker and the hidden people (and their times)
    const {v,...out}=p,gone=new Set(out.cast.filter(e=>e.hide===true).map(e=>e.key||e.id));
    out.cast=out.cast.filter(e=>e.hide!==true);
    if(out.when&&typeof out.when==='object'){out.when=Object.fromEntries(Object.entries(out.when).filter(([k])=>!gone.has(k)||out.cast.some(e=>(e.key||e.id)===k)));if(!Object.keys(out.when).length)delete out.when;}
    return out;
  }
  const cast=p.cast.filter(e=>!e.hide).map(({hide,...e})=>e),keys=new Set(cast.map(e=>e.key)),out={only:[],cast};
  const when=Object.fromEntries(Object.entries(p.when||{}).filter(([k])=>keys.has(k)));if(Object.keys(when).length)out.when=when;
  if(p.chair)out.chair=p.chair;if(p.fade!==undefined)out.fade=p.fade;
  return out;
}
// For liveFilmShot: the Director's cast over the film's.
export function mergePeople(film,shot){const f=shot?.peopleEdits&&peopleFilter(shot.peopleEdits);return f?{people:f}:{};}
// The chapter's people as the stage should show them (null: nobody asked for people).
export function effectivePeople(film,shot){return mergePeople(film,shot).people??(film?.people&&typeof film.people==='object'?film.people:film?.people?true:null);}
// A new key for one more placement of a model: the character's name, numbered when taken.
export function newKey(id,taken){
  const base=(id.replace(/^people-/,'').split('-')[0]||'person').slice(0,40);let key=base,n=2;const has=k=>taken.has?taken.has(k):taken.includes(k);
  while(has(key))key=base+'-'+n++;return key;
}
// "0–18 s" / "whole chapter" for a person's spans.
export function spanText(spans,seconds){
  if(!spans?.length)return 'whole chapter';
  const f=v=>Number(v.toFixed(v%1?1:0));
  return spans.map(([a,b])=>a<=.001&&b>=(seconds??Infinity)?'whole chapter':`${f(a)}–${f(Math.min(b,seconds??b))} s`).join(', ');
}
// The placement that hands over INTO this one with a change of posture (room-people.mjs pairUp: the same character, not at
// a desk, its `when` ending within .75 s of this one's start): a roll docking, a walk arriving. pairUp only pairs people
// who are not at a desk, so putting this one at a desk turns that blend into a cut (19 Nov 2026: Kai's dock in the high
// school went from a smooth tween to a one-frame jump when "Place: At the film desk" made his typing placement a desk
// user). The Director says so when it happens. null: no such hand-over.
export function handoffInto(people,key,character=id=>/^people-([a-z]+)-/.exec(id||'')?.[1]||null){
  const cast=people?.cast||[],when=people?.when||{},me=cast.find(e=>e.key===key);if(!me||!character(me.id))return null;
  const starts=(when[key]||[]).map(s=>s[0]);if(!starts.length)return null;
  const from=cast.find(e=>e.key!==key&&!e.hide&&!e.desk&&character(e.id)===character(me.id)&&(when[e.key]||[]).some(([,t1])=>starts.some(t0=>Math.abs(t1-t0)<=.75)));
  return from?{key:from.key,at:starts.find(t0=>(when[from.key]||[]).some(([,t1])=>Math.abs(t1-t0)<=.75))}:null;
}
