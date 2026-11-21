export const TIMELINE_ZOOMS=[1,1.5,2,3,4,6,8];
export function timelineTicks(seconds,pixels=1000){
  const desired=seconds*75/Math.max(100,pixels),step=[.05,.1,.2,.5,1,2,5,10,15,30,60].find(v=>v>=desired)||60;
  const ticks=[];for(let t=0;t<seconds-.00001;t+=step)ticks.push(Number(t.toFixed(3)));
  ticks.push(seconds);return ticks;
}
// The grid step at this zoom (20 Nov 2026): zoomed in far enough that the chosen step is more than GRID_PX apart, the
// grid gets finer (0.05 s, then the frame), so keys a frame apart can be placed one by one; never finer than a frame.
export const FRAME=1/30,GRID_PX=48;
export function zoomStep(step,pxPerSecond){
  if(!step||!(pxPerSecond>0)||step*pxPerSecond<=GRID_PX)return step;
  for(const s of [.05,FRAME])if(s<step&&s*pxPerSecond<=GRID_PX)return s;
  return Math.min(step,FRAME);
}
export function snapTimelineTime(value,{seconds,step=.1,targets=[],tolerance=0,bypass=false,pixels=0}={}){
  const clamp=v=>Math.max(0,Math.min(seconds,v));
  if(bypass||!step)return clamp(value);
  if(pixels>0)step=zoomStep(step,pixels/seconds);
  const near=targets.filter(Number.isFinite).sort((a,b)=>Math.abs(a-value)-Math.abs(b-value))[0];
  if(near!==undefined&&Math.abs(near-value)<=tolerance)return clamp(near);
  return clamp(Math.round(value/step)*step);
}
export function adjacentEdit(times,current,direction,seconds){
  const sorted=[...new Set([0,...times,seconds])].filter(Number.isFinite).sort((a,b)=>a-b);
  return direction<0?(sorted.filter(t=>t<current-.0001).at(-1)??0):(sorted.find(t=>t>current+.0001)??seconds);
}
// ---- P4 (17 Nov 2026): continuous zoom, timecode, markers, the loop range ----
// The most zoom that still means anything: about 40 px a frame (30 fps; 20 Nov 2026, was 20: a camera key is 30 px wide,
// so keys a frame apart now separate), at least 8x.
export const FRAME_PX=40;
export const maxZoom=(seconds,viewWidth)=>Math.max(8,seconds*30*FRAME_PX/Math.max(200,viewWidth));
export const clampZoom=(z,seconds,viewWidth)=>Math.max(1,Math.min(maxZoom(seconds,viewWidth),z));
// The scrollLeft that keeps the time under the pointer where it is when the zoom goes from `from` to `to`.
// x: the pointer's px from the lanes' left edge (excluding the labels), lane: the lanes' width at zoom 1.
export function zoomScroll({scroll,x,from,to,lane}){const t=(scroll+x)/(lane*from);return Math.max(0,t*lane*to-x);}
// "film 0:50.95 · bar 4.2": the film's clock and the score's bar.beat at chapter second t (beats: [{t, beat}] from
// score-track chapterScore, bars: chapter seconds of each bar line).
// Ctrl+wheel / zoom buttons: the scrollLeft that keeps the time under screen x where it is (21 Nov 2026). before / after:
// the ruler's box (client px) before the zoom and after the rebuild, the rebuild having put back `scroll`; k = CSS px per
// client px (the UI scale). Measured on the ruler, not as a fraction of the scroll width, which includes the lane labels.
export function rulerAnchorScroll({scroll,x,before,after,k=1}){
  if(!before?.width||!after?.width)return null;const u=(x-before.left)/before.width;
  return Math.max(0,scroll+(after.left+u*after.width-x)*k);
}
export function filmTimecode(t,{start=null,bars=[],beats=[]}={}){
  const out=[];
  if(Number.isFinite(start)){const f=start+t,m=Math.floor(f/60),s=f-m*60;out.push(`film ${m}:${s.toFixed(2).padStart(5,'0')}`);}
  if(bars.length){let bar=-1;for(let i=0;i<bars.length;i++)if(bars[i]<=t+1e-6)bar=i;if(bar>=0){const b=beats.filter(x=>x.t<=t+1e-6&&x.t>=bars[bar]-1e-6).length||1;out.push(`bar ${bar+1}.${b}`);}}
  return out.join(' · ');
}
// The marker before / after t (dir -1 / 1), or undefined.
export const nextMarker=(list,t,dir)=>{const s=[...list].sort((a,b)=>a-b);return dir<0?s.filter(x=>x<t-1e-3).at(-1):s.find(x=>x>t+1e-3);};
// M at t: add a marker, or remove the one within `tol` seconds.
export function toggleMarker(list,t,tol=1/30){const i=list.findIndex(x=>Math.abs(x-t)<=tol);return i>=0?list.filter((_,k)=>k!==i):[...list,Math.round(t*1000)/1000].sort((a,b)=>a-b);}
// The loop range after B (start) or N (end) at t: the other end kept when it still makes a range.
export function setLoopEnd(range,which,t,seconds){
  const r={start:range?.start??0,end:range?.end??seconds};if(which==='start')r.start=t;else r.end=t;
  if(r.end-r.start<.1){if(which==='start')r.end=Math.min(seconds,r.start+Math.max(1,(range?.end??seconds)-(range?.start??0)));else r.start=Math.max(0,r.end-1);}
  return {start:Math.round(r.start*1000)/1000,end:Math.round(r.end*1000)/1000};
}
