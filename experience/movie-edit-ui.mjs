// The movie's clip track in the Director (21 Nov 2026, Vico: edit the movie chapter's screen video like Premiere; only
// chapter 10 media; docs/screen-edit-list/CONTRACT.md). The edits are experience/screen-edit.mjs; this is what the
// Graphics lane and the Graphics tab draw for the movie track, and what its fields do. Pure: node tests run it.
//   timeline   transition chips over each transition's span after the composer's clamps (a dissolve [cut - d, cut], a dip
//              around the cut), a + on every plain cut between two clips (add a transition), missing clips marked
//   inspector  "Movie edit": the clips in order (source in-out, speed, transition in), the selected clip's transition
//              (type, length, dip colour, why it is shorter), source in / out, speed; earlier / later, split, delete
// The live stage and the Director's Render still show a hard cut at each cut point (film-fx plays the clips
// butt-joined); the blend is composed by render-cut / render-still.cjs (compose-screen-edit.mjs).
import {TYPES,TYPE_LABEL,MAX_DUR,trackClips,transitionPlan,missingClips,setTransition,setSourceRange,sourceOut,validateTrack} from './screen-edit.mjs?v=clip-track-20261121';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=v=>Math.round(v*100)/100,pct=(t,T)=>`${Math.max(0,Math.min(100,t/(T||1)*100))}%`,name=src=>String(src||'clip').split('/').pop();
const GLYPH={dissolve:'⨯',dip:'◐'};
// The chips and seams of the movie track (inside its lane, over the clip blocks).
export function trackOverlay(list,key,seconds,{selected=-1,info}={}){
  const clips=trackClips(list,key,seconds),plan=transitionPlan(list,key,seconds,info);let html='';
  clips.forEach((c,k)=>{
    if(!k)return;const prev=clips[k-1],joined=Math.abs(prev.end-c.start)<1e-6,p=plan.find(x=>x.i===c.i),t=c.sc.transitionIn,sel=selected===c.i?' selected':'';
    if(p){const short=p.got<p.want-1e-6;
      const title=`${TYPE_LABEL[p.type]} into clip ${k+1}: ${r2(p.want)} s${short?` → ${r2(p.got)} s (${p.why})`:''} · ${r2(p.from)}–${r2(p.to)} s · the live view and Render still cut at ${r2(c.start)} s; the film render shows the blend`;
      html+=`<button type="button" class="clip-transition clip-transition-${p.type}${short?' clamped':''}${sel}" data-clip-transition="${c.i}" style="left:${pct(p.from,seconds)};width:max(10px,calc(${pct(p.to,seconds)} - ${pct(p.from,seconds)}))${p.type==='dip'?`;--dip:${esc(p.color)}`:''}" title="${esc(title)}" aria-label="${esc(title)}"><span>${GLYPH[p.type]}</span></button>`;
      return;}
    if(joined)html+=`<button type="button" class="clip-seam${sel}" data-clip-seam="${c.i}" style="left:${pct(c.start,seconds)}" title="${esc(`Cut into clip ${k+1} at ${r2(c.start)} s · click: add a dissolve or a dip here`)}" aria-label="${esc(`Cut at ${r2(c.start)} s: add a transition`)}">${t?.type==='cut'?'│':'+'}</button>`;
  });
  return html;
}
// The track's label on the lane.
export const trackLabel=(list,key,seconds,{known}={})=>{const n=trackClips(list,key,seconds).length,m=missingClips(list,key,seconds,known).length;return `Movie <small>${n} clip${n===1?'':'s'}${m?` · ${m} missing`:''}</small>`;};
// The Graphics tab's Movie edit section.
export function movieInspector(list,key,seconds,{selected=-1,info,known}={}){
  const clips=trackClips(list,key,seconds),plan=transitionPlan(list,key,seconds,info),missing=new Set(missingClips(list,key,seconds,known)),errs=validateTrack(list,key,seconds);
  const me=clips.find(c=>c.i===selected),k=me?clips.indexOf(me):-1;
  const row=(c,j)=>{const t=c.sc.transitionIn,p=plan.find(x=>x.i===c.i),rate=Number(c.sc.rate??1)||1,into=!j?'start':!t||t.type==='cut'?'cut':`${t.type} ${r2(t.dur)} s${p&&p.got<p.want-1e-6?` → ${r2(p.got)} s`:''}`;
    return `<li class="${c.i===selected?'selected':''}${missing.has(c.i)?' missing':''}"><button type="button" data-graphic-action="pick" data-graphic-index="${c.i}" title="${esc(c.sc.src)}"><b>${j+1}</b><span>${esc(name(c.sc.src))}${missing.has(c.i)?' ⚠':''}</span><small>${r2(c.start)}–${r2(c.end)} s · source ${r2(Number(c.sc.offset)||0)}–${r2(sourceOut(c))} s${rate!==1?' · ×'+rate:''} · in: ${esc(into)}</small></button></li>`;};
  let fields='';
  if(me){
    const t=me.sc.transitionIn,type=t?.type||'cut',p=plan.find(x=>x.i===me.i),rate=Number(me.sc.rate??1)||1;
    const why=p&&p.got<p.want-1e-6?`<p class="director-hint movie-clamp">Plays ${r2(p.got)} s: ${esc(p.why)}.</p>`:'';
    fields=`<div class="movie-clip-fields" data-movie-fields="${me.i}"><h5>Clip ${k+1} · ${esc(name(me.sc.src))}${missing.has(me.i)?' <span class="movie-missing">source not on this machine</span>':''}</h5>
      <div class="director-grid"><label title="${k?'How the clip before turns into this one':'The first clip: a dip fades up from its colour; a dissolve has nothing to dissolve from'}">Transition in<select name="me-type">${TYPES.map(x=>`<option value="${x}" ${x===type?'selected':''}>${TYPE_LABEL[x]}</option>`).join('')}</select></label>
      ${type==='cut'?'':`<label>Length<input type="number" name="me-dur" min="0.1" max="${MAX_DUR}" step="0.1" value="${r2(Number(t?.dur)||1)}"><small>s</small></label>`}
      ${type==='dip'?`<label>Dips through<input type="color" name="me-color" value="${esc(t?.color||'#000000')}"></label>`:''}</div>${why}
      ${type!=='cut'?'<p class="director-hint">The live view and Render still cut at the cut point; the film render shows the blend.</p>':''}
      <div class="director-grid"><label title="The moment of the source this clip starts on">Source in<input type="number" name="me-in" min="0" step="0.1" value="${r2(Number(me.sc.offset)||0)}"><small>s</small></label><label title="The moment of the source it ends on (the clip's length follows, up to the next clip)">Source out<input type="number" name="me-out" min="0" step="0.1" value="${r2(sourceOut(me))}"><small>s</small></label><label>Speed<input type="number" name="me-rate" min="0.25" max="4" step="0.05" value="${rate}"><small>×</small></label></div>
      <div class="director-actions"><button type="button" data-graphic-action="earlier" ${k>0?'':'disabled'} title="Swap with the clip before (ripple: the clips keep their lengths)">◀ Earlier</button><button type="button" data-graphic-action="later" ${k<clips.length-1?'':'disabled'} title="Swap with the clip after">Later ▶</button><button type="button" data-graphic-action="split" data-graphic-index="${me.i}" title="Split at the playhead (Ctrl/Cmd+K)">✂ Split</button><button type="button" class="danger" data-graphic-action="delete" data-graphic-index="${me.i}">Delete clip</button></div></div>`;
  }
  return `<section class="movie-edit" data-movie-edit><h4>Movie edit</h4>
    <p class="director-hint">The movie on the TV, clip by clip. Click a clip or a seam; Ctrl/Cmd+drag a clip on the timeline to move it between others (ripple). The live view and Render still show a cut at every cut point; the film render (render-cut) shows the dissolves and dips.</p>
    ${errs.length?`<p class="director-hint movie-errors">${errs.map(esc).join(' ')}</p>`:''}
    <ol class="movie-clips">${clips.map(row).join('')}</ol>${fields||'<p class="director-hint">Select a clip to set its transition, source in / out and speed.</p>'}</section>`;
}
// A Movie edit field changed: {list (the new shot.screens), clamped} or null (not ours); throws a sentence for a bad value.
export function movieFieldChange(list,key,seconds,i,el){
  const sc=list[i];if(!sc)throw Error('Select a clip first.');const n=Number(el.value);
  const num=()=>{if(String(el.value).trim()===''||!Number.isFinite(n))throw Error('Type a number.');return n;};
  const t=x=>({list:setTransition(list,i,x),clamped:false});
  if(el.name==='me-type')return t(el.value==='cut'?(sc.transitionIn?{type:'cut'}:null):{type:el.value,dur:Number(sc.transitionIn?.dur)||1,color:sc.transitionIn?.color});
  if(el.name==='me-dur')return t({...sc.transitionIn,dur:num()});
  if(el.name==='me-color')return t({...sc.transitionIn,color:el.value});
  if(el.name==='me-in'||el.name==='me-out'){
    const c=trackClips(list,key,seconds).find(x=>x.i===i),inS=el.name==='me-in'?num():Number(sc.offset)||0,outS=el.name==='me-out'?num():(el.name==='me-in'?num()+sourceOut(c)-(Number(sc.offset)||0):sourceOut(c));
    return setSourceRange(list,key,i,inS,outS,seconds);
  }
  if(el.name==='me-rate'){const r=num();if(r<.25||r>4)throw Error('Speed runs from 0.25× to 4×.');const next=structuredClone(list);next[i].rate=r;return {list:next,clamped:false};}
  return null;
}
