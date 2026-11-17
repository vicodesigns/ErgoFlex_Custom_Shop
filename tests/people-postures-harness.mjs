// Headless bone/placement comparisons, not a substitute for Windows pixel diffs.
import {createHash} from 'node:crypto';
import {library,makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries} from '../room-people.mjs';
import {sampleClipMotion} from '../experience/desk-clips.mjs';
export const times=[0,3.4,4,5.2,6,7.6,8,9.45,10.2,11.1,12.65,16.6];
export async function stage(RoomPeople,shot){
  const room=makeRoom(shot.room,shot.layout||'house',[...castEntries(shot.room,shot.layout||'house'),...shot.people.cast]);
  const people=new RoomPeople(room,library()),motion=shot.motion?.clips?shot.motion:null;
  const at=t=>motion?sampleClipMotion(motion,t):{height:28,tilt:0};
  const track={seconds:shot.seconds,heightAt:t=>at(t).height,tiltAt:t=>at(t).tilt||0};
  const state=t=>({height:at(t).height,tilt:at(t).tilt||0,mode:shot.mode||'morning',pose:{x:0,z:0,yaw:0},keyboard:{x:0,z:260},time:t,track,now:0});
  room.peopleState=()=>state(0);people.setFilter(shot.people);await people.setEnabled(true);await people.settled();
  return {people,state};
}
export function snapshot(people){
  const objects=people.people.map(o=>{
    const s=o.userData.person,rig=o.userData.personRig;
    const data={id:s.id,key:people.keyOf(s),variant:s.variant||null,visible:o.visible,amount:o.userData.personAmount??null,at:o.position.toArray(),turn:o.quaternion.toArray(),scale:o.scale.toArray(),bones:rig?[...rig.bones].map(([n,b])=>[n,b.quaternion.toArray(),b.position.toArray()]):null};
    return {id:s.id,key:people.keyOf(s),visible:o.visible,hash:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
  });
  return {members:people.actors.map(a=>a.members.map(m=>[m.id,m.role,m.behind,m.dz])),shown:people.actors.map(a=>a.shown?.id||null),objects};
}
export async function snapshots(RoomPeople,shot){
  const was=globalThis.__ERGO_PRESENTATION__;globalThis.__ERGO_PRESENTATION__=true;
  let people;
  try{
    const s=await stage(RoomPeople,shot);people=s.people;const out=[];
    for(const t of times.filter(t=>t<=shot.seconds)){people.update(s.state(t));await people.settled();people.update(s.state(t));out.push({t,...snapshot(people)});}
    return out;
  }finally{people?.dispose();globalThis.__ERGO_PRESENTATION__=was;}
}
