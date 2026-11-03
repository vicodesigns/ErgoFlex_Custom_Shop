import {sampleCamera} from './camera-track.mjs';
import {validateClipSchedule} from './desk-clips.mjs';
const clone=v=>structuredClone(v);
const view=(time,label,scope,angle,elevation,distance=1.08,focus=.5,fov=35)=>({time,label,scope,angle,elevation,distance,focus,fov});
// Each chapter has a motivated move and a stationary landing, rather than a
// continuous orbit. Angles are offsets from the room's established front.
export function cinematicViews(shot){
  const v=view,kind=shot.kind;
  let list;
  if(kind==='group')list=[v(0,'Commons establishing view','room',0,35,1.02),v(.18,'Read the shared table','room',0,35,1.02),v(.55,'Track the approach','zone',.22,22,1.18),v(.86,'Together at table height','zone',.36,10,1.15)];
  else if(kind==='storage')list=[v(0,'Working room before reset','room',0,32,1.04),v(.2,'Storage transformation','zone',.12,25,1.2),v(.62,'Follow the parking route','zone',.32,30,1.25),v(.86,'Crane up to the cleared floor','room',.2,58,1.08)];
  else if(kind==='room')list=shot.room==='highschool'?[v(0,'Classroom establishing shot','room',0,40,1.06),v(.22,'Read the learning space','room',0,40,1.06),v(.58,'Push toward the workstation','zone',.12,20,1.14),v(.86,'Pull back to the class','room',.22,30,1.02)]:[v(0,'Lab establishing shot','room',0,34,1.06),v(.22,'Hold the creative context','room',0,34,1.06),v(.58,'Lateral workstation reveal','zone',.3,18,1.15),v(.86,'Shared studio overview','room',.2,42,1.04)];
  else if(kind==='lift')list=[v(0,'Seated eye-level portrait','desk',0,12,1.08),v(.16,'Before the rise','desk',0,12,1.08),v(.5,'Pedestal up with the lift','desk',.1,25,1.04),v(.84,'Low-angle standing reveal','desk',.3,-8,1.12,.62,40)];
  else if(kind==='tilt')list=[v(0,'Overhead workspace study','desk',0,58,1.08),v(.18,'Drafting surface detail','desk',.05,42,1.03),v(.5,'Side profile of the tilt','desk',.6,20,1.08),v(.84,'Easel portrait','desk',.3,8,1.13,.58,40)];
  else if(kind==='wellness')list=[v(0,'Seated working view','desk',0,16,1.14),v(.26,'A moment to reset','desk',0,16,1.14),v(.6,'Rise with the user','desk',.12,24,1.15),v(.84,'Pull back for movement','desk',.22,24,1.36)];
  else if(kind==='proximity')list=[v(0,'Low view of the mobile base','desk',0,10,1.16,.32),v(.2,'Space around the wheels','desk',0,10,1.16,.32),v(.58,'Crane over the clearance sweep','desk',.25,62,1.3,.4),v(.84,'Clearance overview','desk',.25,45,1.3,.4)];
  else if(kind==='music')list=[v(0,'Gaming atmosphere','desk',0,22,1.16),v(.22,'Push toward the illuminated frame','desk',.05,12,1.04),v(.6,'Low lateral lighting reveal','desk',.45,-5,1.12,.58,40),v(.84,'Pull back into the glow','desk',.3,24,1.22)];
  else if(kind==='media')list=[v(0,'Cinema setting','desk',0,20,1.2),v(.22,'Dolly toward the screen','desk',.04,12,1.04,.6),v(.66,'Hold the viewing experience','desk',.04,12,1.04,.6),v(.86,'Ease back to the room','desk',.16,20,1.2)];
  else list=[v(0,'Product portrait','desk',0,18,1.16),v(.2,'Hold the silhouette','desk',0,18,1.16),v(.6,'Gentle arc reveal','desk',.25,12,1.12),v(.82,'Final pullback','desk',.35,22,1.26)];
  return [...list,{...list.at(-1),time:1,label:'Hold & handoff'}];
}
export function polishMovement(shot,motion){
  const next=clone(shot),m=clone(motion),minimum=({glide:14,lift:20,tilt:24,group:20,room:16,wellness:20,proximity:18,music:18,media:18,storage:22,hero:12})[shot.kind]||14;
  const scale=Math.max(1,minimum/shot.seconds);
  m.clips.forEach(c=>{c.start*=scale;c.duration*=scale;if(!c.path&&c.easing!=='hold')c.easing='smooth';});
  const first=Math.min(...m.clips.map(c=>c.start)),offset=Number.isFinite(first)?Math.max(0,1.2-first):0;
  m.clips.forEach(c=>c.start+=offset);
  next.seconds=Math.max(shot.seconds*scale,...m.clips.map(c=>c.start+c.duration+2));
  if(next.seconds>90)throw Error('This chapter needs more than 90 seconds for its movements and closing hold.');
  next.seconds=Math.round(next.seconds*1000)/1000;next.motion=m;
  validateClipSchedule(m.clips,next.seconds);return next;
}
export function openingSwoop(shot,keys,subject){
  const next=clone(shot),last=clone(keys.at(-1)?.view);
  if(!last||!subject||subject.height<=0)throw Error('Wait for the opening desk and camera to load.');
  const lastMove=Math.max(0,...(shot.motion?.clips||[]).map(c=>c.start+c.duration));
  const start=Math.max(shot.seconds*.8,lastMove+.25),seconds=Math.max(shot.seconds,start+7);
  if(seconds>90)throw Error('Shorten this opening before adding the seven-second camera finale.');
  const anchor=sampleCamera(keys,Math.min(1,start/shot.seconds));
  const prefix=keys.filter(k=>k.time*shot.seconds<start-.001).map(k=>({...clone(k),time:k.time*shot.seconds/seconds}));
  if(prefix.length+6>64)throw Error('Remove some camera views before adding the finale.');
  const target=[subject.center[0],subject.floor+subject.height*.62,subject.center[2]];
  const yaw=Math.atan2(last.position[2]-last.target[2],last.position[0]-last.target[0]);
  const radius=Math.max(subject.height*1.5,Math.hypot(last.position[0]-last.target[0],last.position[2]-last.target[2])*.94);
  const orbit=(angle,y)=>({...clone(last),position:[target[0]+Math.cos(yaw+angle)*radius,y,target[2]+Math.sin(yaw+angle)*radius],target:[...target],fov:Math.max(40,last.fov)});
  const low=orbit(.85,subject.floor+subject.height*.18);
  const add=(at,label,value)=>({id:crypto.randomUUID(),time:at/seconds,label,path:'orbit',easing:'smooth',view:value});
  next.seconds=seconds;next.camera={keys:[...prefix,
    add(start,'Lift complete · begin descent',anchor),
    add(start+2,'Swoop around the raised desk',orbit(.4,subject.floor+subject.height*.4)),
    add(start+3.5,'Low-angle hero · look up',low),
    add(start+4.2,'Hold the upward view',clone(low)),
    add(start+6,'Return to ending composition',last),
    add(seconds,'Hold & handoff',clone(last))]};
  return next;
}
