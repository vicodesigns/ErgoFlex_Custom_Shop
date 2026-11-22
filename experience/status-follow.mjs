// Status lights that follow the desk's moves (Vico, 22 Nov 2026: "As soon as a lift goes, the lift elevator blue goes until it
// stops ... if we have status indicator lighting, it should always mimic the length of the motion (lift, tilt, wheels),
// because it sucks to have to edit both ... if you don't want lights, you just don't add them").
//
// Pure, editor-time only: the film, the renderers and the importer never see any of this. A light "follows" a move clip when
//   - it carries the Director's own `link: <clip id>` (written by the Status light switch, Link to a move, Link all matching;
//     exportLighting drops it, so the film shot, Export cut and the render keys are exactly what they were), or
//   - it has no link and is not marked `manual: true`, and it matches a clip: same lane, same state (kind and wheel mode) and
//     its start and length within FOLLOW_TOL (0.05 s) of the clip's. These "found" links change nothing until their clip changes.
// A followed light is always the clip's span (at = start, dur = duration), its kind from the clip (lift up / down by the height
// before it, tilt retract / extend, wheels with the drive mode 1-10 from the direction), and keeps its own fade, fade-in and
// reverse. Lights never overlap (one state at a time): where two would, the one that starts later takes over and the earlier
// one ends there, as tools/experience/build-round8-director.py retime_status() hands over; a light with no room is dropped.
import {sampleClipMotion} from './desk-clips.mjs';
import {LIGHT_KINDS,WHEEL_MODES} from './film-lighting.mjs';

export const FOLLOW_TOL=.05;
export const FOLLOW_FADES={fade:1,fadeIn:.6};
const MIN_DUR=.05,r3=v=>Math.round(v*1000)/1000,same=(a,b)=>Math.abs(a-b)<=FOLLOW_TOL+1e-9;
const LANE_OF_KIND={'lift-up':'lift','lift-down':'lift','tilt-retract':'tilt','tilt-extend':'tilt',wheels:'wheels'};
export const MOVE_KINDS=Object.keys(LANE_OF_KIND);
// The real desk's drive modes (wheelDirection in led-movement.mjs; WHEEL_MODES names them): a travel direction -> mode,
// a turn -> mode (the desk's yaw < 0, "left", is 5 clockwise; yaw > 0, "right", is 6 counter-clockwise).
export const TRAVEL_MODE={left:1,right:2,forward:3,backward:4,'forward-left':7,'backward-left':8,'forward-right':9,'backward-right':10};
export const ROTATE_MODE={left:5,right:6};
const LANE_ORDER={lift:0,tilt:1,wheels:2};

// ---- a clip -> its light
export function followLane(c){
  if(!c)return null;
  if(c.lane==='lift'&&(c.kind==='lift'||(c.kind==='pose'&&Number.isFinite(c.target?.height))))return 'lift';
  if(c.lane==='tilt'&&(c.kind==='tilt'||(c.kind==='pose'&&Number.isFinite(c.target?.tilt))))return 'tilt';
  if(c.lane==='wheels'&&(c.kind==='rotate'||c.kind==='travel'))return 'wheels';
  return null;
}
export const canFollow=c=>!!followLane(c);
// kind (+ mode) from the clip and the pose before it (the importer's directions(): a target at or above the pose is "up")
export function clipLightKind(c,before={}){
  const lane=followLane(c);
  if(lane==='lift'){const t=c.kind==='lift'?c.target:c.target.height;return {kind:t>=(before.height??28)?'lift-up':'lift-down'};}
  if(lane==='tilt'){const t=c.kind==='tilt'?c.target:c.target.tilt;return {kind:t>=(before.tilt??0)?'tilt-retract':'tilt-extend'};}
  if(lane==='wheels')return {kind:'wheels',mode:(c.kind==='rotate'?ROTATE_MODE:TRAVEL_MODE)[c.direction]??3};
  return null;
}
// {at, dur, kind, mode?} the clip's light would have (before any overlap hand-over); null when the clip has no light
export function deriveLight(motion,c,seconds=Infinity){
  const lane=followLane(c);if(!lane)return null;
  const before=lane==='wheels'?{}:sampleClipMotion(motion,c.start),k=clipLightKind(c,before),at=r3(c.start),end=r3(Math.min(c.start+c.duration,seconds));
  if(end-at<.01)return null;
  return {at,dur:r3(end-at),...k};
}
const sameState=(e,d)=>e.kind===d.kind&&(d.kind!=='wheels'||(e.mode??3)===d.mode);

// ---- which lights follow which clips (ids -> {clip, via:'link'|'timing'})
export function resolveLinks(status,motion){
  const clips=(motion?.clips||[]).filter(canFollow),byId=new Map(clips.map(c=>[c.id,c])),out=new Map(),taken=new Set();
  for(const e of status){
    if(!LANE_OF_KIND[e.kind]||!e.link)continue;const c=byId.get(e.link);
    if(c&&followLane(c)===LANE_OF_KIND[e.kind]&&!taken.has(c.id)){out.set(e.id,{clip:c,via:'link'});taken.add(c.id);}
  }
  for(const e of status){
    if(out.has(e.id)||e.manual||e.link||!LANE_OF_KIND[e.kind])continue;
    const found=clips.filter(c=>!taken.has(c.id)&&followLane(c)===LANE_OF_KIND[e.kind]&&same(e.at,c.start)&&same(e.dur,c.duration)&&sameState(e,deriveLight(motion,c)||{}))
      .sort((a,b)=>Math.abs(a.start-e.at)-Math.abs(b.start-e.at))[0];
    if(found){out.set(e.id,{clip:found,via:'timing'});taken.add(found.id);}
  }
  return out;
}
export const linkOf=(status,motion,id)=>resolveLinks(status,motion).get(id)||null;
// the light that follows a clip ({entry, via}) or null
export function lightOfClip(status,motion,clipId){
  for(const [id,l] of resolveLinks(status,motion))if(l.clip.id===clipId)return {entry:status.find(e=>e.id===id),via:l.via};
  return null;
}

// ---- hand-over: lights are one at a time. Returns the settled list; `derived` ids may be trimmed or dropped freely.
function settle(list,derived,notes,label=()=>''){
  const cmp=(a,b)=>a.at-b.at||(derived.has(a.id)-derived.has(b.id))||(LANE_ORDER[LANE_OF_KIND[a.kind]]??3)-(LANE_ORDER[LANE_OF_KIND[b.kind]]??3);
  const out=[];
  for(const e of list.map(v=>({...v})).sort(cmp)){
    let dropped=false;
    while(out.length){
      const p=out.at(-1);
      if(p.at+p.dur<=e.at+1e-6||(!derived.has(p.id)&&!derived.has(e.id)))break;   // (two hand-set lights are never touched)
      if(e.at-p.at>=MIN_DUR-1e-9){p.dur=r3(e.at-p.at);if(!derived.has(p.id))notes.push(`The light at ${r3(p.at)} s now ends where the next one starts.`);break;}
      // the same start: one state at a time; a hand-set light stays, else the earlier lane wins
      if(derived.has(p.id)&&!derived.has(e.id)){out.pop();notes.push(`A light for ${label(p)} is covered by the one at ${r3(e.at)} s.`);continue;}
      dropped=true;notes.push(`A light for ${label(e)} is covered by the one at ${r3(p.at)} s.`);break;
    }
    if(!dropped)out.push(e);
  }
  return out;
}
const canon=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:1)):x);
const withState=(e,d,link)=>{const n={...e,at:d.at,dur:d.dur,kind:d.kind,link};delete n.manual;if(d.kind==='wheels')n.mode=d.mode;else delete n.mode;return n;};
const clipLabel=c=>c?`${c.lane==='lift'?'Lift':c.lane==='tilt'?'Tilt':c.kind==='rotate'?'Turn':'Move'} at ${r3(c.start)} s`:'the move';

// ---- the clips changed (move, resize, speed, target, direction, delete, pace, undo never gets here: it restores both):
// follow them. prev / next are the motions before / after (cleaned: {initial, clips}); status the lights; seconds the chapter.
// Lights found by timing only change when their own clip changed (anything else stays byte for byte); lights that carry a
// link are always kept equal to their clip. Returns {status, changed, notes}.
export function syncStatus(prev,next,status,seconds){
  const notes=[],links=resolveLinks(status,prev),nextClips=new Map((next?.clips||[]).map(c=>[c.id,c])),derived=new Set(),out=[];
  for(const e of status){
    const l=links.get(e.id);
    if(!l){out.push(e);continue;}
    const c=nextClips.get(l.clip.id),nd=c&&canFollow(c)?deriveLight(next,c,seconds):null;
    if(!nd){notes.push(`The light for ${clipLabel(l.clip)} went with its move.`);continue;}
    if(l.via==='timing'){
      const pd=deriveLight(prev,l.clip,seconds);
      if(pd&&pd.at===nd.at&&pd.dur===nd.dur&&sameState(pd,nd)){out.push(e);continue;}
    }
    derived.add(e.id);out.push(withState(e,nd,c.id));
  }
  // (lights with a link whose clip was found by timing earlier but kept as is are not "derived": nothing else touches them)
  const labelOf=e=>{const l=[...links].find(([id])=>id===e.id)?.[1];return l?clipLabel(l.clip):'a move';};
  const settled=derived.size||out.length!==status.length?settle(out,derived,notes,labelOf):out;
  const changed=canon(settled)!==canon(status);
  return {status:changed?settled:status,changed,notes};
}

// ---- the Status light switch, per clip
// fades for a new light: 1 / 0.6 unless every other move light of the chapter agrees on another pair
export function suggestFades(status){
  const moves=status.filter(e=>MOVE_KINDS.includes(e.kind)&&e.fade!==undefined);
  if(moves.length&&moves.every(e=>e.fade===moves[0].fade&&(e.fadeIn??0)===(moves[0].fadeIn??0)))return {fade:moves[0].fade,fadeIn:moves[0].fadeIn??0};
  return {...FOLLOW_FADES};
}
export function enableClipLight(status,motion,clipId,seconds,{id=crypto.randomUUID()}={}){
  const c=(motion?.clips||[]).find(v=>v.id===clipId);
  if(!c||!canFollow(c))throw Error('This movement has no status light: Lift, Tilt, Turn and Travel moves do. Add a light by hand in Lighting for a saved wheel path.');
  if(lightOfClip(status,motion,clipId))return {status,notes:[],added:null};
  const d=deriveLight(motion,c,seconds);if(!d)throw Error('This movement is too short for a status light.');
  const entry=withState({id,...suggestFades(status)},d,c.id),notes=[],derived=new Set([id,...[...resolveLinks(status,motion)].filter(([,l])=>l.via==='link').map(([i])=>i)]);
  const settled=settle([...status,entry],derived,notes,e=>e.id===id?clipLabel(c):'a move');
  const mine=settled.find(e=>e.id===id);
  if(!mine)throw Error(`Another status light already starts at ${r3(c.start)} s: the desk shows one state at a time. Move one of the moves, or turn the other light off first.`);
  return {status:settled,notes,added:mine};
}
export function disableClipLight(status,motion,clipId){
  const l=lightOfClip(status,motion,clipId);if(!l)return {status,removed:null};
  return {status:status.filter(e=>e.id!==l.entry.id),removed:l.entry};
}

// ---- link / unlink / link all (Lighting tab)
export function unlinkEntry(status,id){return status.map(e=>{if(e.id!==id)return e;const n={...e,manual:true};delete n.link;return n;});}
// a hand-set light follows `clipId`: it takes the clip's span and state now
export function linkEntryToClip(status,motion,id,clipId,seconds){
  const e=status.find(v=>v.id===id),c=(motion?.clips||[]).find(v=>v.id===clipId);
  if(!e||!c||!canFollow(c)||followLane(c)!==LANE_OF_KIND[e.kind])throw Error('Choose a move on the same lane as this light.');
  const taken=lightOfClip(status,motion,clipId);if(taken&&taken.entry.id!==id)throw Error('Another light already follows that move.');
  const d=deriveLight(motion,c,seconds);if(!d)throw Error('That movement is too short for a status light.');
  const notes=[],derived=new Set([id,...[...resolveLinks(status,motion)].filter(([,l])=>l.via==='link').map(([i])=>i)]);
  const settled=settle(status.map(v=>v.id===id?withState(v,d,c.id):v),derived,notes,v=>v.id===id?clipLabel(c):'a move');
  if(!settled.some(v=>v.id===id))throw Error(`Another status light already starts at ${r3(c.start)} s.`);
  return {status:settled,notes};
}
// the lights found by timing get their link (only the Director's own field: nothing else changes)
export function linkAllMatching(status,motion){
  const links=resolveLinks(status,motion);let n=0;
  const next=status.map(e=>{const l=links.get(e.id);if(!l||l.via!=='timing')return e;n++;const m={...e,link:l.clip.id};delete m.manual;return m;});
  return {status:n?next:status,count:n};
}
// every light by hand (the chapter's "Manual")
export function unlinkAll(status,motion){
  const links=resolveLinks(status,motion);let n=0;
  const next=status.map(e=>{if(!links.has(e.id))return e;n++;const m={...e,manual:true};delete m.link;return m;});
  return {status:n?next:status,count:n};
}

// ---- what the panels show
export function followCounts(status,motion){
  const links=resolveLinks(status,motion),clips=(motion?.clips||[]).filter(canFollow);
  let explicit=0,found=0;for(const l of links.values())if(l.via==='link')explicit++;else found++;
  return {moves:clips.length,linked:links.size,explicit,found,manual:status.filter(e=>MOVE_KINDS.includes(e.kind)&&!links.has(e.id)).length};
}
// 'off' (no status light in the chapter) / 'manual' (lights, none follows a move) / 'follow'
export function followMode(shot,status,motion){
  if(shot?.statusLight===false)return 'off';
  const n=followCounts(status||[],motion);
  return (status||[]).length&&!n.linked&&n.manual?'manual':'follow';
}
export const lightName=e=>{const k=LIGHT_KINDS.find(v=>v[0]===e.kind)?.[1]||e.kind;return e.kind==='wheels'?`Wheels · ${WHEEL_MODES[(e.mode??3)-1]||'drive'}`:k.split(' · ')[0];};
export const motionSig=m=>JSON.stringify([m?.initial,(m?.clips||[]).map(c=>[c.id,c.lane,c.kind,c.start,c.duration,c.target,c.value,c.direction])]);
