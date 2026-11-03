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
