// Non-destructive edits: timeline positions are independent of source video positions.
export const MIN_GRAPHIC=.1;
export function graphicTrack(sc,index=0){return JSON.stringify([sc.target??index,sc.mesh??null,sc.material??null,sc.person??null,sc.within??null]);}
export function graphicRange(sc,seconds){return [Math.max(0,Math.min(seconds-MIN_GRAPHIC,Number(sc.start)||0)),Math.max(MIN_GRAPHIC,Math.min(seconds,Number(sc.end??seconds)))];}
export function editGraphic(list,index,start,end,seconds,{trimStart=false}={}){
  if(!list[index]||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>seconds||end-start<MIN_GRAPHIC-1e-6)throw Error('Keep the clip inside the chapter and at least 0.1 seconds long.');
  const next=structuredClone(list),sc=next[index],[oldStart]=graphicRange(sc,seconds);
  if(trimStart)sc.offset=Number(sc.offset||0)+(start-oldStart)*Number(sc.rate??1);
  sc.start=start;sc.end=end;
  const key=graphicTrack(sc,index);
  if(next.some((other,i)=>{if(i===index||graphicTrack(other,i)!==key)return false;const [a,b]=graphicRange(other,seconds);return start<b-1e-6&&end>a+1e-6;}))throw Error('That overlaps another clip on this screen. Move it into a free gap or trim the neighboring clip first.');
  return next;
}
export function splitGraphic(list,index,at,seconds){
  const sc=list[index];if(!sc)throw Error('Select a graphic clip first.');const [start,end]=graphicRange(sc,seconds);
  if(!Number.isFinite(at)||at-start<MIN_GRAPHIC-1e-6||end-at<MIN_GRAPHIC-1e-6)throw Error('Place the playhead inside this clip, at least 0.1 seconds from either edge.');
  // Preserve implicit screen targets when the array gains a new entry.
  const next=structuredClone(list).map((s,i)=>({...s,target:s.target??i}));
  const left={...next[index],start,end:at},right={...next[index],start:at,end,offset:Number(sc.offset||0)+(at-start)*Number(sc.rate??1)};
  // (screen edit list, docs/screen-edit-list/CONTRACT.md: the right piece starts where the left one ends, so it has no
  // transition in of its own (it would dissolve into its own left half) and no compose (the first clip's only))
  delete right.transitionIn;delete right.compose;
  next.splice(index,1,left,right);return next;
}
