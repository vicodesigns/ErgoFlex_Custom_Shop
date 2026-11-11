import {validateClipSchedule,clipEnd} from './desk-clips.mjs';
import {validateStatus} from './film-lighting.mjs';
// A timeline group: camera keys (fractions of the chapter), desk clips (seconds), light states
// ({id, at, dur}) and neutral light keys ([seconds, hex, id]) picked together. Moving it shifts
// their times only; holds, easings, durations and colours stay as they are. Items pushed past
// the end lengthen the chapter.
export const CHAPTER_MAX=90;
const tidy=v=>Math.round(v*1e6)/1e6,has=(set,id)=>!!set?.has(id);
function pickedTimes({seconds,keys,clips,lights=[],neutrals=[],tods=[]},picks){
  return [...keys.filter(k=>has(picks.keys,k.id)).map(k=>[k.time*seconds,k.time*seconds]),...clips.filter(c=>has(picks.clips,c.id)).map(c=>[c.start,clipEnd(c)]),
    ...lights.filter(e=>has(picks.lights,e.id)).map(e=>[e.at,e.at+e.dur]),...neutrals.filter(k=>has(picks.neutrals,k[2])).map(k=>[k[0],k[0]]),...tods.filter(k=>has(picks.tods,k.id)).map(k=>[k.at,k.at])];
}
// The deltas (seconds) that keep the group at or after 0 and inside the chapter limit.
export function groupRange(base,picks,max=CHAPTER_MAX){
  const times=pickedTimes(base,picks);if(!times.length)return [0,0];
  return [-Math.min(...times.map(t=>t[0])),Math.max(0,max-Math.max(...times.map(t=>t[1])))];
}
export function snapGroupDelta(delta,step,bypass=false){return bypass||!step?delta:Math.round(delta/step)*step;}
export function shiftGroup(base,picks,delta,max=CHAPTER_MAX){
  const [lo,hi]=groupRange(base,picks,max),d=Math.max(lo,Math.min(hi,delta));
  const end=Math.max(base.seconds,...pickedTimes(base,picks).map(t=>t[1]+d));
  const seconds=end>base.seconds+1e-9?Math.min(max,Math.ceil(tidy(end)*1000)/1000):base.seconds;
  const keys=base.keys.map(k=>({...k,time:Math.max(0,Math.min(1,tidy(k.time*base.seconds+(has(picks.keys,k.id)?d:0))/seconds))})).sort((a,b)=>a.time-b.time);
  for(let i=1;i<keys.length;i++)if(keys[i].time-keys[i-1].time<.001&&(has(picks.keys,keys[i].id)||has(picks.keys,keys[i-1].id)))throw Error('Two camera views would land at the same time. Move the selection a little further.');
  const clips=base.clips.map(c=>has(picks.clips,c.id)?{...c,start:tidy(c.start+d)}:c).sort((a,b)=>a.start-b.start||a.lane.localeCompare(b.lane));
  validateClipSchedule(clips,seconds);
  const next={seconds,keys,clips,delta:d};
  if(base.lights){next.lights=base.lights.map(e=>has(picks.lights,e.id)?{...e,at:tidy(e.at+d)}:e).sort((a,b)=>a.at-b.at);validateStatus(next.lights,seconds);}
  if(base.neutrals){
    next.neutrals=base.neutrals.map(k=>has(picks.neutrals,k[2])?[tidy(k[0]+d),k[1],k[2]]:k).sort((a,b)=>a[0]-b[0]);
    for(let i=1;i<next.neutrals.length;i++)if(next.neutrals[i][0]-next.neutrals[i-1][0]<.001&&(has(picks.neutrals,next.neutrals[i][2])||has(picks.neutrals,next.neutrals[i-1][2])))throw Error('Two light colour keys would land at the same time. Move the selection a little further.');
  }
  if(base.tods){
    next.tods=base.tods.map(k=>has(picks.tods,k.id)?{...k,at:tidy(k.at+d)}:k).sort((a,b)=>a.at-b.at);
    for(let i=1;i<next.tods.length;i++)if(next.tods[i].at-next.tods[i-1].at<.001&&(has(picks.tods,next.tods[i].id)||has(picks.tods,next.tods[i-1].id)))throw Error('Two time-of-day keys would land at the same time. Move the selection a little further.');
  }
  return next;
}
