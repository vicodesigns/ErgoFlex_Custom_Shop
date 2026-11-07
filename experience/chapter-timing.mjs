import {validateClipSchedule} from './desk-clips.mjs';

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
// The shortest the chapter may become: past the end of its last clip / light / key. The final camera view sits on the
// chapter end, so only the views before it count (a pure ending hold may be removed entirely).
export function chapterFloor(shot, motion, cameraKeys, extraEnds=[]){
  const s=shot.seconds,k=cameraKeys,last=k.at(-1),prev=k.at(-2);
  const cam=!prev?0:(last.time>=.999?prev.time*s+(sameView(last,prev)?0:.1):last.time*s);
  return Math.max(2,cam,...motion.clips.map(c=>c.start+c.duration),...extraEnds.filter(Number.isFinite));
}
export function shortenChapter(shot, motion, cameraKeys, seconds){
  if(!Number.isFinite(seconds)||seconds<2||seconds>=shot.seconds)throw Error('A shorter chapter must be at least 2 seconds.');
  const next=structuredClone(shot),s=shot.seconds,keys=structuredClone(cameraKeys),last=keys.at(-1);
  next.seconds=seconds;next.motion=structuredClone(motion);
  validateClipSchedule(next.motion.clips,seconds);
  const anchored=last.time>=.999;
  if(anchored&&keys.length>=2&&Math.abs(keys.at(-2).time*s-seconds)<.0005&&sameView(last,keys.at(-2)))keys.pop();
  keys.forEach((k,i)=>{k.time=anchored&&i===keys.length-1?1:Math.min(1,k.time*s/seconds);});
  keys.at(-1).time=anchored||keys.at(-1).time>=1?1:keys.at(-1).time;
  next.camera={keys};
  return next;
}
