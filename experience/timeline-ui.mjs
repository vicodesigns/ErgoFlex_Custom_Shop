export const TIMELINE_ZOOMS=[1,1.5,2,3,4,6,8];
export function timelineTicks(seconds,pixels=1000){
  const desired=seconds*75/Math.max(100,pixels),step=[.05,.1,.2,.5,1,2,5,10,15,30,60].find(v=>v>=desired)||60;
  const ticks=[];for(let t=0;t<seconds-.00001;t+=step)ticks.push(Number(t.toFixed(3)));
  ticks.push(seconds);return ticks;
}
export function snapTimelineTime(value,{seconds,step=.1,targets=[],tolerance=0,bypass=false}={}){
  const clamp=v=>Math.max(0,Math.min(seconds,v));
  if(bypass||!step)return clamp(value);
  const near=targets.filter(Number.isFinite).sort((a,b)=>Math.abs(a-value)-Math.abs(b-value))[0];
  if(near!==undefined&&Math.abs(near-value)<=tolerance)return clamp(near);
  return clamp(Math.round(value/step)*step);
}
export function adjacentEdit(times,current,direction,seconds){
  const sorted=[...new Set([0,...times,seconds])].filter(Number.isFinite).sort((a,b)=>a-b);
  return direction<0?(sorted.filter(t=>t<current-.0001).at(-1)??0):(sorted.find(t=>t>current+.0001)??seconds);
}
