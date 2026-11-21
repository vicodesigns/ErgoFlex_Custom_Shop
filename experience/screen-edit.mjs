// The movie's edit list in the Director (21 Nov 2026, Vico: "a Premiere-style video editor for the movie chapter, so he
// can show the most impressive part of the film"; docs/screen-edit-list/CONTRACT.md). Only chapter 10 media's movie
// screen (target main-landscape): Vico does not edit the game montage (ch 9). Pure: node tests run it.
//
// The edit list IS shot.screens (one source of truth): a track = the entries with one Graphics-lane track key
// (graphic-clips.mjs graphicTrack); each clip: src, start / end (chapter s, end = the cut point), offset (source in),
// rate, loop, display fields (the screen's: clip 1's), transitionIn {type cut|dissolve|dip, dur 0..4 s, color} on the
// INCOMING clip, compose on clip 1 only. Clips never overlap on the timeline (butt-joined at the cut); a dissolve takes
// the incoming clip's head handle (source before its in point), a dip is centred on the cut. The composer clamps
// (tools/experience/compose-screen-edit.mjs planTrack); transitionPlan here gives the same numbers for the chips
// (tests/screen-edit-test.mjs checks them against planTrack). The live stage plays a hard cut at every cut point.
import {graphicTrack,graphicRange,editGraphic,splitGraphic,MIN_GRAPHIC} from './graphic-clips.mjs?v=clip-track-20261121';
export const MOVIE={chapter:'media',target:'main-landscape'};
export const TYPES=['cut','dissolve','dip'],MAX_DUR=4,FPS=30;
export const TYPE_LABEL={cut:'Cut',dissolve:'Dissolve',dip:'Dip to colour'};
const TRACK_FIELDS=['target','mesh','material','person','within'],EDIT_FIELDS=['src','start','end','offset','rate','loop','transitionIn','compose','missing'];
const r6=v=>Math.round(v*1e6)/1e6,r3=v=>Math.round(v*1000)/1000;
const has=(o,k)=>!!o&&typeof o==='object'&&Object.prototype.hasOwnProperty.call(o,k);
// The movie track's key in this chapter, or null (any other chapter, or no movie screen): the clip track shows only then.
export function movieTrack(shotId,list){
  if(shotId!==MOVIE.chapter||!Array.isArray(list))return null;
  const i=list.findIndex(sc=>sc&&sc.target===MOVIE.target);return i<0?null:graphicTrack(list[i],i);
}
// The track's clips in timeline order: [{i (index in shot.screens), sc, start, end, len}].
export function trackClips(list,key,seconds){
  return (list||[]).map((sc,i)=>({sc,i})).filter(({sc,i})=>sc&&graphicTrack(sc,i)===key)
    .map(({sc,i})=>{const [start,end]=graphicRange(sc,seconds);return {i,sc,start,end,len:end-start};}).sort((a,b)=>a.start-b.start||a.i-b.i);
}
export const isEditList=clips=>clips.some(c=>has(c.sc,'transitionIn'));
export const sourceOut=c=>(Number(c.sc.offset)||0)+c.len*(Number(c.sc.rate??1)||1);
// ---- transitions
export function cleanTransition(t){
  if(t===null||t===undefined)return null;
  if(!TYPES.includes(t.type))throw Error('A transition is a cut, a dissolve or a dip.');
  if(t.type==='cut')return {type:'cut'};
  const dur=Number(t.dur);if(!Number.isFinite(dur)||dur<=0||dur>MAX_DUR)throw Error(`A ${t.type} lasts more than 0 and up to ${MAX_DUR} seconds.`);
  const out={type:t.type,dur:r3(dur)};
  if(t.type==='dip'){const c=t.color??'#000000';if(!/^#[0-9a-f]{6}$/i.test(c))throw Error('Pick the colour it dips through.');out.color=c.toLowerCase();}
  return out;
}
// The transition into clip i (index in shot.screens): t null = none (a plain cut, and the track stops being an edit
// list when no clip has one: it renders as today).
export function setTransition(list,i,t){
  if(!list[i])throw Error('Select a clip first.');const next=structuredClone(list),c=cleanTransition(t);
  if(c)next[i].transitionIn=c;else delete next[i].transitionIn;return next;
}
// What the composer will do with each transition (frames at 30 fps, as planTrack): [{i, k (position), type, want, got,
// out, in, from, to, why}] seconds; want = asked, got = after the clamps, from..to the chip's span on the timeline.
// info(src) -> {duration} (optional: a looping source's offset is taken modulo its length when known).
export function transitionPlan(list,key,seconds,info=()=>null){
  const clips=trackClips(list,key,seconds),F=FPS,out=[];
  const fr=clips.map(c=>{const sF=Math.round(c.start*F),eF=Math.round(c.end*F),rate=Number(c.sc.rate??1)||1,d=Number(info(c.sc.src)?.duration)||0;let offset=Number(c.sc.offset)||0;
    if(c.sc.loop!==false&&d>0)offset=((offset%d)+d)%d;else if(offset<0)offset=0;return {sF,eF,len:eF-sF,rate,offset,dipIn:0};});
  clips.forEach((c,k)=>{
    const t=c.sc.transitionIn;if(!t||!['dissolve','dip'].includes(t.type))return;const dur=Math.min(MAX_DUR,Number(t.dur));if(!(dur>0))return;
    const me=fr[k],prev=fr[k-1],adjacent=!!prev&&prev.eF===me.sF,cut=c.start,row={i:c.i,k,type:t.type,want:dur};
    if(t.type==='dissolve'){
      if(!adjacent){out.push({...row,got:0,from:cut,to:cut,why:prev?'a gap before it: nothing to dissolve from':'the first clip: nothing to dissolve from'});return;}
      const want=Math.round(dur*F),handle=Math.floor(me.offset/me.rate*F+1e-6),room=prev.len-prev.dipIn,d=Math.max(0,Math.min(want,handle,room));
      const why=d<want?(d===handle?`the source has ${r3(handle/F)} s before this clip's in point`:`the clip before has ${r3(room/F)} s free`):'';
      out.push({...row,got:d>=1?d/F:0,from:cut-(d>=1?d/F:0),to:cut,why});return;
    }
    const want=Math.round(dur*F/2),hIn=Math.min(want,me.len),hOut=adjacent?Math.min(want,prev.len-prev.dipIn):0;me.dipIn=hIn;
    out.push({...row,color:t.color||'#000000',got:(hIn+hOut)/F,out:hOut/F,in:hIn/F,from:cut-hOut/F,to:cut+hIn/F,why:hIn<want||(adjacent&&hOut<want)?'a clip is shorter than half the dip':adjacent?'':'after '+(prev?'a gap':'nothing')+': fades up only'});
  });
  return out;
}
// ---- edits (each returns a new shot.screens; the input is never changed)
export const trimClip=(list,i,start,end,seconds,{trimStart=false}={})=>editGraphic(list,i,r6(start),r6(end),seconds,{trimStart});
export const moveClip=(list,i,start,seconds)=>{const [a,b]=graphicRange(list[i],seconds);return editGraphic(list,i,r6(start),r6(start+b-a),seconds);};
// Split at the playhead (graphic-clips.mjs splitGraphic: the right piece has no transition in and no compose).
export const splitClip=(list,i,at,seconds)=>splitGraphic(list,i,r6(at),seconds);
// Delete a clip: the next one keeps its own transition; a gap stays where it was (the screen shows its own picture).
export function deleteClip(list,i){if(!list[i])throw Error('Select a clip first.');const next=structuredClone(list).map((s,j)=>({...s,target:s.target??j}));next.splice(i,1);return next;}
// Ripple reorder (Premiere's Ctrl-drag): the clip at position `from` of the track goes to position `to`; every clip keeps
// its length, offset, rate and transition in; the gaps stay where they are in the order; the track starts where it did.
// compose moves to the new first clip.
export function reorderClip(list,key,from,to,seconds){
  const clips=trackClips(list,key,seconds),n=clips.length;
  if(!(from>=0&&from<n&&to>=0&&to<n))throw Error('Drop the clip on the track, between two clips.');
  if(from===to)return structuredClone(list);
  const gaps=clips.map((c,k)=>k?c.start-clips[k-1].end:0),order=clips.map((_,k)=>k);order.splice(to,0,...order.splice(from,1));
  const next=structuredClone(list),compose=clips.map(c=>c.sc.compose).find(Boolean);let t=clips[0].start;
  order.forEach((k,pos)=>{t+=gaps[pos];const sc=next[clips[k].i];sc.start=r6(t);t+=clips[k].len;sc.end=r6(t);delete sc.compose;if(pos===0&&compose)sc.compose=structuredClone(compose);});
  return next;
}
// A clip from the source bin: the screen's own fields (clip 1's display fields), the source from its start, placed at
// `at` (else after the last clip) in the free time there, as long as the source or the room allows.
export function addClip(list,key,src,{at=null,seconds,srcSeconds=null}={}){
  if(typeof src!=='string'||!src)throw Error('Pick a clip in the source bin.');
  const clips=trackClips(list,key,seconds);if(!clips.length)throw Error('This chapter has no movie screen.');
  const t=at===null||at===undefined?clips.at(-1).end:Number(at);
  if(clips.some(c=>t>=c.start-1e-6&&t<c.end-1e-6))throw Error('The playhead is on a clip: move it to free time on the track, or split the clip first.');
  const next=clips.find(c=>c.start>=t-1e-6),room=(next?next.start:seconds)-t,len=Math.min(room,srcSeconds>0?srcSeconds:room);
  if(len<MIN_GRAPHIC-1e-6)throw Error('No room there: trim a clip first (the chapter keeps its length).');
  const base=Object.fromEntries(Object.entries(clips[0].sc).filter(([k])=>!EDIT_FIELDS.includes(k)));
  const out=structuredClone(list).map((s,j)=>({...s,target:s.target??j}));
  out.push({...structuredClone(base),src,start:r6(t),end:r6(t+len),offset:0});return out;
}
// The source monitor's in / out (source seconds) for clip i: offset = in, the clip's length = (out - in) / rate from its
// start, within the free time after it. {list, clamped}
export function setSourceRange(list,key,i,inS,outS,seconds){
  const sc=list[i];if(!sc)throw Error('Select a clip first.');
  if(!(Number.isFinite(inS)&&Number.isFinite(outS)&&inS>=0&&outS>inS))throw Error('Mark an in point before the out point.');
  const clips=trackClips(list,key,seconds),me=clips.find(c=>c.i===i),after=clips.find(c=>c.start>=me.end-1e-6&&c.i!==i),rate=Number(sc.rate??1)||1;
  const want=(outS-inS)/rate,limit=(after?after.start:seconds)-me.start,len=Math.min(want,limit);
  if(len<MIN_GRAPHIC-1e-6)throw Error('That is shorter than 0.1 seconds on the timeline.');
  const next=structuredClone(list);next[i].offset=r6(inS);next[i].start=r6(me.start);next[i].end=r6(me.start+len);return {list:next,clamped:len<want-1e-6};
}
// Clips whose source is not here (known(src) false): the importer keeps them (missing: true) so an Export never drops
// them; the Director says so instead of showing an empty screen.
export const missingClips=(list,key,seconds,known=()=>true)=>trackClips(list,key,seconds).filter(c=>c.sc.missing===true||!known(c.sc.src)).map(c=>c.i);
// Problems that would stop the composer (shown, never written): overlaps, bad transitions, no src.
export function validateTrack(list,key,seconds){
  const clips=trackClips(list,key,seconds),errs=[];
  clips.forEach((c,k)=>{
    if(k&&c.start<clips[k-1].end-1e-6)errs.push(`Clips ${k} and ${k+1} overlap (${r3(clips[k-1].end)} > ${r3(c.start)} s).`);
    if(!c.sc.src)errs.push(`Clip ${k+1} has no source.`);
    if(!(Number(c.sc.rate??1)>0))errs.push(`Clip ${k+1}: the speed must be above 0.`);
    try{cleanTransition(c.sc.transitionIn);}catch(e){errs.push(`Clip ${k+1}: ${e.message}`);}
    if(k&&c.sc.compose)errs.push(`Clip ${k+1}: compose belongs on the first clip.`);
  });
  return errs;
}
// A readable line per clip (the checkpoint print, the hint under the track).
export function describeTrack(list,key,seconds,info=()=>null){
  const clips=trackClips(list,key,seconds),plan=transitionPlan(list,key,seconds,info);
  return clips.map((c,k)=>{const p=plan.find(x=>x.k===k),t=c.sc.transitionIn,rate=Number(c.sc.rate??1)||1;
    const tr=!t||t.type==='cut'?(k?'cut':'start'):`${t.type} ${t.dur} s${p&&Math.abs(p.got-p.want)>1e-6?` -> ${r3(p.got)} s (${p.why})`:''}`;
    return `${k+1}. ${r3(c.start).toFixed(2)}-${r3(c.end).toFixed(2)} s  ${String(c.sc.src).split('/').pop()} ${r3(Number(c.sc.offset)||0)}-${r3(sourceOut(c))} s${rate!==1?' x'+rate:''}  in: ${tr}`;});
}
