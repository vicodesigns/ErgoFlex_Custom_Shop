// Desk versions: a chapter the film renders as sub-shots, one desk build (preset) each (the finale 'hero':
// tools/experience/build-round7-finale.py writes shots/13-subshots.json, six copies of the chapter that share one
// desk performance, camera and light rig, each with renderRange [t0, t1] in chapter seconds and its own preset,
// screens, desk dressing, kicker and exposure; join-subshots.py crossfades the overlaps). The built film shot carries
// the map ({A:[t0,t1],…}) and the preset order; build-round8-director.py --pages writes the sub-shots themselves as
// director-film/<id>-subshots.json next to the chapter's film shot.
//
// The Director shows them as a lane (one segment per sub-shot, overlaps hatched), names the current one on the frame,
// and the live stage and Render still use the sub-shot's own film shot (preset, kind, dressing) as the render does.
// The desk changes at the middle of each overlap: the centre of the film's crossfade.
//
// The cut can change the list (shot.deskVersions, desk-versions-edit.mjs): reorder, retime, another model or name, and
// add or remove versions. An added version (id 'G', 'H', …: never one the cut has used) is a copy of an existing one:
// the film renders it as one more sub-shot, a copy of its model's film sub-shot in its own window.
import {PRESETS,PRODUCT_CONFIG} from '../catalog.mjs';
import {SHARED_BUILD_PRESETS} from '../preset-defaults.mjs';
import {filmRenderShot} from './film-render.mjs';
import {NAMES,resolveSubshots,resolveFilm,moveVersion,moveSeam,seamsOf,shown,MIN_SHOWN,MAX_VERSIONS,RESET_NOTE,cleanDeskVersionList,addVersion,removeVersion,canAddVersion,nextVersionId} from './desk-versions-edit.mjs';

export const presetLabel=id=>NAMES[id]||PRESETS.find(p=>p.id===id)?.name||String(id||'Desk');
// The build's own colours: desktop finish, frame, trim (preset-defaults.mjs wins over the catalog card, as applyPreset).
export function presetSwatch(id){
  const c={...PRESETS.find(p=>p.id===id)?.config,...SHARED_BUILD_PRESETS[id]?.config},find=(list,name)=>list.find(f=>f.name===name)?.color;
  return {wood:find(PRODUCT_CONFIG.woodFinishes,c.woodFinish)||'#7d8790',base:find(PRODUCT_CONFIG.baseFinishes,c.baseFinish)||'#1c1c1e',trim:c.trimColor||'#85888c',woodName:c.woodFinish||'',baseName:c.baseFinish||''};
}
// [{n, preset, label, start, end, from, to, setup, kind}] in time order; from / to: where this desk is the one shown
// (overlap midpoints). setup is the sub-shot's film shot (null: the sub-shots file is missing, so only the preset changes).
export function deskVersions(film,subshots,edits){
  const base=deskVersionsBase(film,subshots),e=cleanDeskVersionList(edits);
  if(!base.length||!e)return base;
  const subs=Array.isArray(subshots)?subshots:Array.isArray(subshots?.shots)?subshots.shots:[];
  return deskVersionsBase(resolveFilm(film,e),subs.length?resolveSubshots(subs,e,subshots?.library):subshots);
}
function deskVersionsBase(film,subshots){
  const map=film?.subshots;if(!map||typeof map!=='object'||Array.isArray(map))return [];
  const presets=Array.isArray(film.presets)?film.presets:[],subs=Array.isArray(subshots)?subshots:Array.isArray(subshots?.shots)?subshots.shots:[];
  const list=Object.entries(map).filter(([,r])=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)).sort((a,b)=>a[1][0]-b[1][0]||a[0].localeCompare(b[0]))
    .map(([n,[start,end]],i)=>{const setup=subs.find(s=>s?.subshot===n)||null,preset=setup?.preset||presets[i]||film.preset;
      return {n,preset,label:setup?.name||presetLabel(preset),sig:n+'|'+preset,start,end,setup,kind:setup?.kind||null,swatch:presetSwatch(preset)};});
  for(const [i,v] of list.entries()){
    const prev=list[i-1],next=list[i+1];
    v.from=prev?(prev.end>v.start?(v.start+prev.end)/2:v.start):0;
    v.to=next?(v.end>next.start?(next.start+v.end)/2:next.start):Infinity;
  }
  return list;
}
export const versionAt=(list,seconds)=>list.find(v=>seconds<v.to)||list.at(-1)||null;
// The chapter shot as this sub-shot renders it: its preset and kind (F is 'glide': the ergonomic keyboard swap).
export const versionShot=(shot,v)=>v?{...shot,preset:v.preset,...(v.kind?{kind:v.kind}:{})}:shot;
// Render still / Film look: the sub-shot's film shot with the Director's edits on top (film-render.mjs).
export const versionRenderShot=(film,shot,keys,v)=>v?filmRenderShot(v.setup||film,versionShot(shot,v),keys):filmRenderShot(film,shot,keys);
// The sub-shots file next to the chapter's film shot: {shots, storage, library} (storage: the render's --storage seed,
// same server only; library: bundles of film sub-shots an import dropped), null when there is none.
export async function loadFilmSubshots(shotUrl,id,fetcher=globalThis.fetch){
  const url=new URL(`${id}-subshots.json`,shotUrl),response=await fetcher(url.href,{cache:'no-store'});if(!response.ok)return null;
  const value=await response.json(),shots=Array.isArray(value?.shots)?value.shots.filter(s=>s?.id===id&&typeof s.subshot==='string'):[];
  let storage=null;try{if(typeof value.storage==='string'){const u=new URL(value.storage,url);if(u.origin===url.origin)storage=u.href;}}catch{}
  return shots.length?{shots,storage,library:Array.isArray(value.library)?value.library:[]}:null;
}
// The render's storage seed (localStorage key -> string, render-cut.cjs --storage) as strings.
export async function loadStorageSeed(url,fetcher=globalThis.fetch){
  const response=await fetcher(url,{cache:'force-cache'});if(!response.ok)throw Error(`The film's storage seed is unavailable (${response.status}).`);
  let seed=await response.json();if(seed?.format==='ergoflex-studio-state-v1')seed=Object.fromEntries(Object.entries(seed.keys||{}).filter(([,r])=>!r.deleted).map(([k,r])=>[k,r.value]));
  return Object.fromEntries(Object.entries(seed||{}).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
}

// Director UI: the lane, the frame badge and the switching (debounced while scrubbing; one switch in flight).
export function createDeskVersions({bridge,shot,project,selected,seek,status,escape,scrubbing,isOpen,panel=null,commit=null,endGroup=()=>{},showTab=()=>{},rerender=()=>{}}){
  let timer=0,busy=false,want=null,lastText='',pickedN=null,lastPlayhead=0,drag=null,memo=null,said=null,tipKey='',lastStatus='';   // said: an add / remove / reset's status line, shown again once the stage has switched desks at that playhead
  const badge=document.createElement('div');badge.className='desk-version-badge';badge.hidden=true;badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');document.body.append(badge);
  // The film's six desks with the cut's edits (shot.deskVersions) on top; kept until the film data or the edits change.
  const list=()=>{
    const s=shot();if(!s)return [];
    const film=bridge.filmShot?.(s.id),subs=bridge.filmSubshots?.(s.id),edits=s.deskVersions;
    if(memo&&memo.film===film&&memo.subs===subs&&memo.id===s.id&&memo.key===JSON.stringify(edits||null))return memo.list;
    memo={film,subs,id:s.id,key:JSON.stringify(edits||null),list:deskVersions(film,subs,edits)};return memo.list;
  };
  const asEdits=l=>l.map(v=>({n:v.n,preset:v.preset,name:v.setup?.name||'',start:v.start,end:v.end}));
  const edited=()=>!!cleanDeskVersionList(shot()?.deskVersions);
  const fmt=x=>Number(x.toFixed(2));
  // The desk an add / duplicate copies and a remove takes: the one picked in the lane or the panel, else the one showing.
  const picked=n=>{const l=list();return (n&&l.find(x=>x.n===n))||l.find(x=>x.n===pickedN)||l.find(x=>x.n===current(lastPlayhead*shot().seconds)?.n)||l[0]||null;};
  const room=()=>canAddVersion(asEdits(list()),shot().seconds);
  const full=()=>list().length>=MAX_VERSIONS?`A chapter shows ${MAX_VERSIONS} desks at most.`:`No room for another desk: each shows at least ${MIN_SHOWN} s.`;
  const tag=v=>`Desk ${v.n} · ${v.label}`;
  const addTip=n=>{const v=picked(n),l=list();return !v?'':!room()?full():`+ Desk version: add a desk at the end of the chapter, a copy of ${tag(v)} (same model, screens and dressing). It takes the second half of ${tag(l.at(-1))}’s time; then change its model, drag it to reorder or drag the line before it to retime. One Undo takes it back.`;};
  const dupTip=n=>{const v=picked(n);return !v?'':!room()?full():`Duplicate: add a copy of ${tag(v)} right after it (same model, screens and dressing); the two share its time. One Undo takes it back.`;};
  const removeTip=n=>{const v=picked(n),l=list(),i=l.indexOf(v);return !v?'':l.length<2?'A chapter shows at least one desk.':`Remove ${tag(v)} from this chapter; ${tag(l[i?i-1:1])} ${i?'stays on for':'starts the chapter and takes'} its time. The film’s own desks can be removed too (Reset desk versions brings them back). One Undo takes it back.`;};
  function lane(){
    const v=list();if(!v.length)return '';
    const s=shot().seconds,pct=x=>Math.max(0,Math.min(100,x/s*100));
    const segs=v.map(x=>{const w=x.swatch,tip=`Desk ${x.n} · ${x.label} (${x.preset}) · film sub-shot ${fmt(x.start)}–${fmt(x.end)} s · this desk shows ${fmt(x.from)}–${fmt(Math.min(s,x.to))} s${w.woodName?` · ${w.woodName} top, ${w.baseName} frame`:''}${x.setup?'':' · preset only (no sub-shots file)'} · click to edit it, drag to reorder`;
      return `<button class="desk-version${pickedN===x.n?' picked':''}" data-desk-version="${escape(x.n)}" style="left:${pct(x.start)}%;width:${pct(x.end)-pct(x.start)}%;--wood:${w.wood};--trim:${w.trim};--base:${w.base}" aria-label="Desk ${escape(x.n)}, ${escape(x.label)}, ${fmt(x.start)} to ${fmt(x.end)} seconds" title="${escape(tip)}"><i class="desk-version-swatch" aria-hidden="true"></i><strong>${escape(x.n)} · ${escape(x.label)}</strong><small>${fmt(x.start)}–${fmt(x.end)}s</small></button>`;}).join('');
    const fades=v.slice(1).map((x,i)=>v[i].end>x.start?`<span class="desk-version-fade" style="left:${pct(x.start)}%;width:${pct(v[i].end)-pct(x.start)}%" title="Crossfade ${escape(v[i].n)} → ${escape(x.n)} · ${fmt(x.start)}–${fmt(v[i].end)} s (the desk changes at ${fmt(x.from)} s)"></span>`:'').join('');
    const seams=seamsOf(v).seams.map((x,i)=>`<i class="desk-version-seam" data-desk-seam="${i}" style="left:${pct(x)}%" role="separator" aria-label="Where ${escape(v[i].label)} gives way to ${escape(v[i+1].label)}: ${fmt(x)} seconds. Drag to change how long each shows." title="Drag to change how long each desk shows (${fmt(x)} s)"></i>`).join('');
    return `<div class="desk-lane-row desk-versions-row" data-lane-color="versions"><span class="desk-lane-label" title="The film renders this chapter as ${v.length} sub-shots, one desk build each, crossfaded where they overlap. The live view and Render still show the desk of the sub-shot under the playhead.">Desk versions <small data-desk-version-now></small>${commit?`<button type="button" class="lane-add" data-dv-add ${room()?'':'disabled'} title="${escape(addTip())}" aria-label="Add a desk version">+</button>`:''}</span><div class="desk-lane desk-versions-lane" role="group" aria-label="Desk versions over the chapter">${segs}${fades}${seams}<div class="camera-track-playhead" data-shared-playhead style="left:0%"></div></div></div>`;
  }
  function current(seconds){const v=list();return v.length?versionAt(v,seconds):null;}
  // The playhead moved (seek, scrub, playback, chapter load): label it and bring the stage's desk along.
  function sync(playhead){
    lastPlayhead=playhead;const s=shot(),v=s?current(playhead*s.seconds):null;
    badge.hidden=!v||!isOpen();
    if(!v){want=null;return;}
    const text=`Desk ${v.n} · ${v.label}`;if(text!==lastText||badge.dataset.sig!==v.sig){badge.dataset.sig=v.sig;lastText=text;badge.textContent=text;badge.title=`Film sub-shot ${v.n}: the ${v.preset} preset (${fmt(v.start)}–${fmt(v.end)} s)`;}
    const now=document.querySelector('#director-timeline [data-desk-version-now]');if(now&&now.textContent!==v.n)now.textContent=v.n;
    for(const b of document.querySelectorAll('#director-timeline [data-desk-version]'))b.classList.toggle('current',b.dataset.deskVersion===v.n);
    // The picked desk's outline and the + button's tooltip (the desk it would copy) follow the selection and the playhead.
    const key=`${pickedN}|${v.n}|${list().length}`;if(key!==tipKey){tipKey=key;const plus=document.querySelector('#director-timeline [data-dv-add]');if(plus)plus.title=addTip();
      for(const b of document.querySelectorAll('#director-timeline [data-desk-version]'))b.classList.toggle('picked',b.dataset.deskVersion===pickedN);}
    want={id:s.id,v};if(bridge.deskVersion?.(s.id)?.sig!==v.sig)schedule();
  }
  function schedule(ms){clearTimeout(timer);timer=setTimeout(apply,ms??(scrubbing()?220:40));}
  async function apply(){
    if(busy||!want)return;
    if(scrubbing()||!bridge.ready()){schedule(150);return;}
    const {id,v}=want,i=selected();if(project().shots[i]?.id!==id||bridge.deskVersion?.(id)?.sig===v.sig)return;
    busy=true;const started=performance.now();
    try{status(`Switching the desk to ${v.n} · ${v.label}…`);await bridge.setDeskVersion(project(),i,v);
      status(said&&Date.now()<said.until&&said.at===lastPlayhead?said.text:`Desk ${v.n} · ${v.label}: the film's sub-shot ${v.n} desk (${v.preset}${v.setup?'':', preset only'}), ${((performance.now()-started)/1000).toFixed(1)} s to switch.`);said=null;}
    catch(error){status('The desk version could not load: '+error.message,true);}
    finally{busy=false;if(want&&bridge.deskVersion?.(want.id)?.sig!==want.v.sig)schedule();}
  }
  // ---- editing: the panel, reorder by dragging a desk, drag the seam between two desks ----
  const total=()=>shot().seconds;
  function write(next,text,{key=null,last=null,tab=false}={}){
    commit(()=>{shot().deskVersions=next;if(last)shot().deskVersionsLast=last;},{key});
    if(tab)showTab('version');else if(!key)rerender();
    status(text);lastStatus=text;tipKey='';sync(lastPlayhead);
  }
  const models=()=>PRESETS.map(p=>({id:p.id,label:presetLabel(p.id),name:p.name}));
  const byN=n=>list().find(x=>x.n===n)||null;
  function select(n,{open=true}={}){pickedN=n;if(open)showTab('version');}
  function setModel(n,preset){
    const l=list(),i=l.findIndex(x=>x.n===n);if(i<0||l[i].preset===preset)return;
    const next=asEdits(l),old=next[i];
    // The name follows the model unless it was renamed.
    next[i]={...old,preset,name:!old.name||old.name===presetLabel(old.preset)?'':old.name};
    write(next,`Desk ${n} is now ${presetLabel(preset)}: finishes, accessories and artwork follow the model; ${RESET_NOTE}`);
  }
  function setName(n,name){
    const l=list(),i=l.findIndex(x=>x.n===n);if(i<0)return;const next=asEdits(l);
    next[i]={...next[i],name:name.trim()===presetLabel(next[i].preset)?'':name.trim().slice(0,40)};
    write(next,`Desk ${n} is called ${next[i].name||presetLabel(next[i].preset)}.`,{key:'dv-name-'+n});endGroup();
  }
  function setShown(n,which,seconds){
    const l=list(),i=l.findIndex(x=>x.n===n);if(i<0||!Number.isFinite(seconds))return;
    const seam=which==='start'?i-1:i;if(seam<0||seam>=l.length-1)return;
    const next=moveSeam(asEdits(l),seam,seconds,total());
    write(next,`Desk ${n} shows ${fmt(shown(next,i)[0])}–${fmt(shown(next,i)[1])} s.`);
  }
  function reorder(n,to){
    const l=list(),from=l.findIndex(x=>x.n===n);if(from<0||from===to)return;
    const next=moveVersion(asEdits(l),from,to);
    write(next,`Desk ${l[from].label} moved to place ${to+1}; the time slots stay, the desks move between them.`);
  }
  // Ids the cut has used: the film's, the list's, the highest handed out and any a prop edit is scoped to (desk:'<id>').
  const usedIds=()=>{const s=shot();return [...Object.keys(bridge.filmShot?.(s.id)?.subshots||{}),...list().map(v=>v.n),s.deskVersionsLast,...(Array.isArray(s.propEdits)?s.propEdits.map(e=>e?.desk):[])];};
  const span=(l,i)=>{const [a,b]=shown(l,i);return `${fmt(a)}–${fmt(b)} s`;};
  // A copy of desk n (default: the picked one): at the end of the chapter, or (after) right behind it. One undo step.
  function add({after=false,n=null}={}){
    const l=list(),v=picked(n);if(!v)return;
    if(!room()){status(full(),true);return;}
    const src=l.indexOf(v),at=after?src+1:l.length,id=nextVersionId(usedIds()),next=id&&addVersion(asEdits(l),src,at,id,total());
    if(!next){status('The desk version could not be added.',true);return;}
    const before=l[at-1],text=`Desk ${id} · ${v.label} added ${after?`after Desk ${v.n}`:'at the end'}, a copy of Desk ${v.n}: it shows ${span(next,at)} and Desk ${before.n} · ${before.label} now ${span(next,at-1)}. Change its model in the Desk version tab, drag it in the lane to reorder; Undo takes it back.`;
    pickedN=id;said=null;
    write(next,text,{last:id,tab:true});
    // Show it: the playhead goes to where the new desk starts (the stage switches to it, then this status line returns).
    try{if(bridge.ready())seek(Math.min(1,(shown(next,at)[0]+.01)/total()));}catch{}
    said={text,until:Date.now()+15000,at:lastPlayhead};
  }
  function remove(n=null){
    const l=list(),v=picked(n);if(!v)return;
    if(l.length<2){status('A chapter shows at least one desk.',true);return;}
    const i=l.indexOf(v),next=removeVersion(asEdits(l),i,total());if(!next)return;
    const k=Math.max(0,i-1),heir=l[i?i-1:1],text=`${tag(v)} removed: ${tag(heir)} now shows ${span(next,k)}. Undo brings it back.`;
    pickedN=heir.n;said={text,until:Date.now()+15000,at:lastPlayhead};
    write(next,text);
  }
  function reset(){const text='Desk versions are back to the film’s desks, order, lengths and models.';commit(()=>{delete shot().deskVersions;});rerender();said={text,until:Date.now()+15000,at:lastPlayhead};status(text);tipKey='';sync(lastPlayhead);}
  const timeAt=event=>{const r=document.querySelector('#director-timeline .desk-versions-lane').getBoundingClientRect();return Math.max(0,Math.min(total(),(event.clientX-r.left)/r.width*total()));};
  function down(event){
    if(event.button!==0)return;
    const seam=event.target.closest?.('[data-desk-seam]'),seg=event.target.closest?.('[data-desk-version]'),lane=event.target.closest?.('.desk-versions-lane');
    if(!lane||!(seam||seg))return;
    drag=seam?{kind:'seam',i:Number(seam.dataset.deskSeam),lane}:{kind:'move',n:seg.dataset.deskVersion,x:event.clientX,moved:false,lane,to:null};
    if(seam)event.preventDefault();
    addEventListener('pointermove',move);addEventListener('pointerup',up,{once:true});addEventListener('pointercancel',up,{once:true});
  }
  function slotAt(t){const l=list();const i=l.findIndex(x=>t<x.to);return i<0?l.length-1:i;}
  function move(event){
    if(!drag)return;
    if(drag.kind==='seam'){
      const l=list(),next=moveSeam(asEdits(l),drag.i,timeAt(event),total());
      if(JSON.stringify(next)!==JSON.stringify(asEdits(l)))write(next,`Seam ${l[drag.i].n}/${l[drag.i+1].n} at ${fmt(seamsOf(next).seams[drag.i])} s.`,{key:'dv-seam'});
      return;
    }
    if(!drag.moved&&Math.abs(event.clientX-drag.x)<5)return;
    drag.moved=true;drag.to=slotAt(timeAt(event));
    const l=list(),target=l[drag.to],mark=(document.querySelector('.desk-version-drop')||drag.lane.appendChild(Object.assign(document.createElement('i'),{className:'desk-version-drop'})));
    mark.style.left=Math.max(0,Math.min(100,target.from/total()*100))+'%';mark.style.width=Math.max(.5,(Math.min(total(),target.to)-target.from)/total()*100)+'%';
    mark.title=`Drop here: ${target.label} moves along`;
  }
  let swallow=0;
  function up(){
    removeEventListener('pointermove',move);const d=drag;drag=null;document.querySelector('.desk-version-drop')?.remove();
    if(!d)return;
    if(d.kind==='seam'){endGroup();if(lastStatus){rerender();status(lastStatus);}return;}      // the tab's Shown from / until follow the drag
    if(d.moved){swallow=Date.now();if(d.to!==null)reorder(d.n,d.to);}
  }
  function click(event){
    const plus=event.target.closest?.('#director-timeline [data-dv-add]');if(plus){event.preventDefault();if(!plus.disabled)add();return;}
    const b=event.target.closest?.('[data-desk-version]');if(!b)return;
    if(Date.now()-swallow<400){event.preventDefault();return;}
    const v=list().find(x=>x.n===b.dataset.deskVersion);if(!v)return;event.preventDefault();
    try{select(v.n,{open:false});seek(Math.min(1,v.from/shot().seconds));showTab('version');}catch(error){status(error.message,true);}
  }
  const fmtIn=x=>String(fmt(x));
  function panelHtml(){
    const l=list();if(!l.length)return '<h3>Desk version</h3><p class="director-hint">This chapter has one desk.</p>';
    const v=l.find(x=>x.n===pickedN)||l.find(x=>x.n===(current(lastPlayhead*total())||l[0]).n)||l[0],i=l.indexOf(v),[a,b]=shown(asEdits(l),i);
    const first=i===0,last=i===l.length-1;
    return `<h3>Desk version <span class="inspector-subtitle">${escape(v.n)} · ${escape(v.label)}</span></h3>
      <p class="director-hint">This chapter shows ${l.length} desk${l.length===1?'':'s'} one after the other. Change a desk’s model, name and how long it shows here; add a desk, duplicate this one or remove it below; drag a desk in the Desk versions lane to reorder, or drag the line between two desks to retime them. ${edited()?'Edited here; Export cut sends it to the film.':'As the film has it; your first change is kept in this cut.'}</p>
      <label class="build-desk">Desk<select name="dv-pick">${l.map(x=>`<option value="${escape(x.n)}" ${x.n===v.n?'selected':''}>${escape(x.n)} · ${escape(x.label)} · ${fmtIn(shown(asEdits(l),l.indexOf(x))[0])}–${fmtIn(shown(asEdits(l),l.indexOf(x))[1])} s</option>`).join('')}</select></label>
      <label class="build-desk">Model<select name="dv-model" aria-label="Desk model">${models().map(m=>`<option value="${escape(m.id)}" ${m.id===v.preset?'selected':''}>${escape(m.name)}</option>`).join('')}</select></label>
      <p class="director-hint" data-dv-note>The whole model comes with it: finishes, accessories and artwork or stickers (a model without stickers shows none). ${RESET_NOTE}</p>
      <label class="build-desk">Name<input name="dv-name" type="text" maxlength="40" value="${escape(v.setup?.name||'')}" placeholder="${escape(presetLabel(v.preset))}" aria-label="Name shown on the lane and the frame badge"></label>
      <div class="build-desk-times"><label>Shown from <input name="dv-start" type="number" step=".1" min="0" max="${total()}" value="${fmtIn(a)}" ${first?'disabled title="The first desk starts the chapter"':''}> s</label>
      <label>until <input name="dv-end" type="number" step=".1" min="0" max="${total()}" value="${fmtIn(b)}" ${last?'disabled title="The last desk runs to the end of the chapter"':''}> s</label></div>
      <p class="director-hint">Each desk shows at least ${MIN_SHOWN} s and the chapter keeps its length; the crossfade between desks keeps its width. The film renders this desk from ${fmtIn(v.start)} to ${fmtIn(v.end)} s.</p>
      <div class="director-actions desk-version-actions"><button type="button" data-dv-add data-dv-n="${escape(v.n)}" ${room()?'':'disabled'} title="${escape(addTip(v.n))}">+ Desk version</button><button type="button" data-dv-duplicate data-dv-n="${escape(v.n)}" ${room()?'':'disabled'} title="${escape(dupTip(v.n))}">Duplicate</button><button type="button" data-dv-remove data-dv-n="${escape(v.n)}" ${l.length>1?'':'disabled'} title="${escape(removeTip(v.n))}">Remove</button></div>
      <p class="director-hint" data-dv-count>${l.length} of ${MAX_VERSIONS} desks. A new desk is a copy of this one, with its own letter; the film renders one sub-shot per desk and crossfades them.</p>
      <div class="director-actions"><button type="button" data-dv-reset ${edited()?'':'disabled'} title="Back to the desks, order, lengths and models the film has now; desks added here go, removed ones return. One Undo takes it back.">Reset desk versions to the film</button></div>`;
  }
  function onChange(event){
    const t=event.target;if(!panel||!panel.contains(t))return;
    const l=list(),n=(l.find(x=>x.n===pickedN)||l.find(x=>x.n===current(lastPlayhead*total())?.n)||l[0])?.n;
    if(t.name==='dv-pick'){pickedN=t.value;rerender();const v=byN(t.value);if(v)seek(Math.min(1,v.from/total()));}
    else if(t.name==='dv-model')setModel(n,t.value);
    else if(t.name==='dv-name'){setName(n,t.value);}
    else if(t.name==='dv-start'||t.name==='dv-end')setShown(n,t.name==='dv-start'?'start':'end',Number(t.value));
  }
  function onClick(event){
    const b=event.target.closest?.('[data-dv-reset],[data-dv-add],[data-dv-duplicate],[data-dv-remove]');if(!b||!panel.contains(b)||b.disabled)return;
    const n=b.dataset.dvN||null;
    if(b.matches('[data-dv-reset]'))reset();else if(b.matches('[data-dv-add]'))add({n});else if(b.matches('[data-dv-duplicate]'))add({after:true,n});else remove(n);
  }
  if(panel){panel.addEventListener('change',onChange);panel.addEventListener('click',onClick);}
  document.addEventListener('pointerdown',event=>{if(event.target.closest?.('#director-timeline'))down(event);});
  return {lane,sync,click,current:()=>{const s=shot();return s?bridge.deskVersion?.(s.id)||null:null;},renderShot:(film,s,keys,seconds)=>{const v=current(seconds),job=versionRenderShot(film,s,keys,v),seed=v&&bridge.deskStorage?.(s.id);
    // The still renderer's stage takes the render's storage seed too (film-render.mjs; not part of the shot's JSON).
    if(seed)Object.defineProperty(job,'__storage',{value:seed,enumerable:false});return job;},has:()=>list().length>0,panel:panelHtml,list,select,edited,add,remove};
}
