import {validateClipSchedule} from './desk-clips.mjs';
import {sampleCamera} from './camera-track.mjs';

// Motion is resolved before this edit so automatic demonstrations are retimed too.
export function paceChapter(shot, motion, cameraKeys, seconds, hold=false){
  if(!Number.isFinite(seconds)||seconds<2||seconds>90)throw Error('Chapter duration must be between 2 and 90 seconds.');
  if(hold&&seconds<=shot.seconds)throw Error('An ending hold must extend the chapter.');
  if(!cameraKeys.length)throw Error('Wait for the chapter camera to finish loading.');
  if(hold&&cameraKeys.length>=64)throw Error('Remove a camera view before adding an ending hold (64-view limit).');
  const next=structuredClone(shot),ratio=seconds/shot.seconds;
  next.seconds=seconds;next.motion=structuredClone(motion);
  if(!hold)next.motion.clips.forEach(c=>{c.start*=ratio;c.duration*=ratio;});
  validateClipSchedule(next.motion.clips,seconds);
  next.camera={keys:structuredClone(cameraKeys)};
  if(hold){
    next.camera.keys.forEach(k=>{k.time/=ratio;});
    next.camera.keys.push({...structuredClone(next.camera.keys.at(-1)),id:crypto.randomUUID(),time:1,label:'Ending hold'});
  }
  return next;
}
// Longer chapter without touching what is there: every clip, light and time-of-day key keeps its absolute time,
// camera keys are rescaled to the new length and the camera holds its last view (an "Ending hold" key; an earlier
// ending hold is folded into it so repeated growing does not pile up keys).
const sameView=(a,b)=>JSON.stringify(a?.view)===JSON.stringify(b?.view);
export function lengthenChapter(shot, motion, cameraKeys, seconds){
  const next=paceChapter(shot,motion,cameraKeys,seconds,true),k=next.camera.keys;
  if(k.length>=3&&k.at(-3)&&k.at(-2).label==='Ending hold'&&sameView(k.at(-2),k.at(-3)))k.splice(-2,1);
  return next;
}
// The shortest the chapter may become: past the end of its last clip / light / title / time-of-day key (extraEnds).
// Camera views do not hold it: shortening trims the camera (shortenChapter). 21 Nov 2026, Vico on hero ("I can only make
// it longer, it seems to be stuck"): a film chapter's camera has a view every second, and the floor sat on the second-last
// one (47.0 + 0.1 s), which the 0.5 s snap rounded up to the chapter's own 47.5 s, so the end could not move left.
export function chapterFloor(shot, motion, cameraKeys, extraEnds=[]){
  return Math.max(2,...motion.clips.map(c=>c.start+c.duration),...extraEnds.filter(Number.isFinite));
}
// The camera views past the new end that shortening the chapter to `seconds` trims (shortenChapter).
export function viewsPastEnd(shot, cameraKeys, seconds){return cameraKeys.filter(k=>k.time*shot.seconds>seconds+.0005).length;}
// Shorter chapter: every clip, light and key keeps its absolute time (the floor keeps them inside). The camera keeps its
// views before the new end; views past it are trimmed and the chapter ends on the view the camera has at the new end
// (a view right at the new end becomes the last one; a camera that already holds before the new end just holds).
export function shortenChapter(shot, motion, cameraKeys, seconds){
  if(!Number.isFinite(seconds)||seconds<2||seconds>=shot.seconds)throw Error('A shorter chapter must be at least 2 seconds.');
  if(!cameraKeys.length)throw Error('Wait for the chapter camera to finish loading.');
  const next=structuredClone(shot),s=shot.seconds,keys=structuredClone(cameraKeys),end=seconds/s;
  next.seconds=seconds;next.motion=structuredClone(motion);
  validateClipSchedule(next.motion.clips,seconds);
  const at=t=>t*s,before=keys.filter(k=>at(k.time)<seconds-.0005),onEnd=keys.find(k=>Math.abs(at(k.time)-seconds)<=.0005),past=keys.filter(k=>at(k.time)>seconds+.0005);
  let list;
  if(onEnd)list=[...before,onEnd];
  else if(!past.length)list=before;                                    // (the camera holds its last view already)
  else{
    const cut=past[0],view=sampleCamera(keys,end);                       // (the view the camera has at the new end)
    list=[...before,{id:/^[a-zA-Z0-9_-]{1,76}$/.test(cut.id)?cut.id+'-end':crypto.randomUUID(),label:'Chapter end',easing:cut.easing||'smooth',view:{...cut.view,...view},time:end}];
  }
  if(!list.length)list=[{...keys[0],time:0}];
  list.forEach(k=>{k.time=Math.min(1,at(k.time)/seconds);});
  if(onEnd||past.length)list.at(-1).time=1;
  next.camera={keys:list};
  return next;
}
