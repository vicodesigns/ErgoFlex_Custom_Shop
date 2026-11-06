import {validateClipSchedule,clipEnd} from './desk-clips.mjs';
// A timeline group: camera keys (fractions of the chapter) and desk clips (seconds)
// picked together. Moving it shifts their times only; holds, easings and clip
// durations stay as they are. Items pushed past the end lengthen the chapter.
export const CHAPTER_MAX=90;
const tidy=v=>Math.round(v*1e6)/1e6;
function pickedTimes({seconds,keys,clips},picks){
  return [...keys.filter(k=>picks.keys.has(k.id)).map(k=>[k.time*seconds,k.time*seconds]),...clips.filter(c=>picks.clips.has(c.id)).map(c=>[c.start,clipEnd(c)])];
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
  const keys=base.keys.map(k=>({...k,time:Math.max(0,Math.min(1,tidy(k.time*base.seconds+(picks.keys.has(k.id)?d:0))/seconds))})).sort((a,b)=>a.time-b.time);
  for(let i=1;i<keys.length;i++)if(keys[i].time-keys[i-1].time<.001&&(picks.keys.has(keys[i].id)||picks.keys.has(keys[i-1].id)))throw Error('Two camera views would land at the same time. Move the selection a little further.');
  const clips=base.clips.map(c=>picks.clips.has(c.id)?{...c,start:tidy(c.start+d)}:c).sort((a,b)=>a.start-b.start||a.lane.localeCompare(b.lane));
  validateClipSchedule(clips,seconds);
  return {seconds,keys,clips,delta:d};
}
