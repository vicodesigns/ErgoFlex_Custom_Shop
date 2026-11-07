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
import {PRESETS,PRODUCT_CONFIG} from '../catalog.mjs';
import {SHARED_BUILD_PRESETS} from '../preset-defaults.mjs';
import {filmRenderShot} from './film-render.mjs';

const NAMES={artist:'Artist',occ:'OCC',architect:'Architect',hbhs:'HBHS',office:'Office',gaming:'Gaming',library:'Library',music:'Music',compact:'Compact',creative:'Creative'};
export const presetLabel=id=>NAMES[id]||PRESETS.find(p=>p.id===id)?.name||String(id||'Desk');
// The build's own colours: desktop finish, frame, trim (preset-defaults.mjs wins over the catalog card, as applyPreset).
export function presetSwatch(id){
  const c={...PRESETS.find(p=>p.id===id)?.config,...SHARED_BUILD_PRESETS[id]?.config},find=(list,name)=>list.find(f=>f.name===name)?.color;
  return {wood:find(PRODUCT_CONFIG.woodFinishes,c.woodFinish)||'#7d8790',base:find(PRODUCT_CONFIG.baseFinishes,c.baseFinish)||'#1c1c1e',trim:c.trimColor||'#85888c',woodName:c.woodFinish||'',baseName:c.baseFinish||''};
}
// [{n, preset, label, start, end, from, to, setup, kind}] in time order; from / to: where this desk is the one shown
// (overlap midpoints). setup is the sub-shot's film shot (null: the sub-shots file is missing, so only the preset changes).
export function deskVersions(film,subshots){
  const map=film?.subshots;if(!map||typeof map!=='object'||Array.isArray(map))return [];
  const presets=Array.isArray(film.presets)?film.presets:[],subs=Array.isArray(subshots)?subshots:Array.isArray(subshots?.shots)?subshots.shots:[];
  const list=Object.entries(map).filter(([,r])=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)).sort((a,b)=>a[1][0]-b[1][0]||a[0].localeCompare(b[0]))
    .map(([n,[start,end]],i)=>{const setup=subs.find(s=>s?.subshot===n)||null,preset=setup?.preset||presets[i]||film.preset;
      return {n,preset,label:presetLabel(preset),start,end,setup,kind:setup?.kind||null,swatch:presetSwatch(preset)};});
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
// The sub-shots file next to the chapter's film shot: {shots, storage} (storage: the render's --storage seed, same
// server only), null when there is none.
export async function loadFilmSubshots(shotUrl,id,fetcher=globalThis.fetch){
  const url=new URL(`${id}-subshots.json`,shotUrl),response=await fetcher(url.href,{cache:'no-store'});if(!response.ok)return null;
  const value=await response.json(),shots=Array.isArray(value?.shots)?value.shots.filter(s=>s?.id===id&&typeof s.subshot==='string'):[];
  let storage=null;try{if(typeof value.storage==='string'){const u=new URL(value.storage,url);if(u.origin===url.origin)storage=u.href;}}catch{}
  return shots.length?{shots,storage}:null;
}
// The render's storage seed (localStorage key -> string, render-cut.cjs --storage) as strings.
export async function loadStorageSeed(url,fetcher=globalThis.fetch){
  const response=await fetcher(url,{cache:'force-cache'});if(!response.ok)throw Error(`The film's storage seed is unavailable (${response.status}).`);
  let seed=await response.json();if(seed?.format==='ergoflex-studio-state-v1')seed=Object.fromEntries(Object.entries(seed.keys||{}).filter(([,r])=>!r.deleted).map(([k,r])=>[k,r.value]));
  return Object.fromEntries(Object.entries(seed||{}).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
}

// Director UI: the lane, the frame badge and the switching (debounced while scrubbing; one switch in flight).
export function createDeskVersions({bridge,shot,project,selected,seek,status,escape,scrubbing,isOpen}){
  let timer=0,busy=false,want=null,lastText='';
  const badge=document.createElement('div');badge.className='desk-version-badge';badge.hidden=true;badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');document.body.append(badge);
  const list=()=>{const s=shot();return s?deskVersions(bridge.filmShot?.(s.id),bridge.filmSubshots?.(s.id)):[];};
  const fmt=x=>Number(x.toFixed(2));
  function lane(){
    const v=list();if(!v.length)return '';
    const s=shot().seconds,pct=x=>Math.max(0,Math.min(100,x/s*100));
    const segs=v.map(x=>{const w=x.swatch,tip=`Desk ${x.n} · ${x.label} (${x.preset}) · film sub-shot ${fmt(x.start)}–${fmt(x.end)} s · this desk shows ${fmt(x.from)}–${fmt(Math.min(s,x.to))} s${w.woodName?` · ${w.woodName} top, ${w.baseName} frame`:''}${x.setup?'':' · preset only (no sub-shots file)'} · click to go to its start`;
      return `<button class="desk-version" data-desk-version="${escape(x.n)}" style="left:${pct(x.start)}%;width:${pct(x.end)-pct(x.start)}%;--wood:${w.wood};--trim:${w.trim};--base:${w.base}" aria-label="Desk ${escape(x.n)}, ${escape(x.label)}, ${fmt(x.start)} to ${fmt(x.end)} seconds" title="${escape(tip)}"><i class="desk-version-swatch" aria-hidden="true"></i><strong>${escape(x.n)} · ${escape(x.label)}</strong><small>${fmt(x.start)}–${fmt(x.end)}s</small></button>`;}).join('');
    const fades=v.slice(1).map((x,i)=>v[i].end>x.start?`<span class="desk-version-fade" style="left:${pct(x.start)}%;width:${pct(v[i].end)-pct(x.start)}%" title="Crossfade ${escape(v[i].n)} → ${escape(x.n)} · ${fmt(x.start)}–${fmt(v[i].end)} s (the desk changes at ${fmt(x.from)} s)"></span>`:'').join('');
    return `<div class="desk-lane-row desk-versions-row" data-lane-color="versions"><span class="desk-lane-label" title="The film renders this chapter as ${v.length} sub-shots, one desk build each, crossfaded where they overlap. The live view and Render still show the desk of the sub-shot under the playhead.">Desk versions <small data-desk-version-now></small></span><div class="desk-lane desk-versions-lane" role="group" aria-label="Desk versions over the chapter">${segs}${fades}<div class="camera-track-playhead" data-shared-playhead style="left:0%"></div></div></div>`;
  }
  function current(seconds){const v=list();return v.length?versionAt(v,seconds):null;}
  // The playhead moved (seek, scrub, playback, chapter load): label it and bring the stage's desk along.
  function sync(playhead){
    const s=shot(),v=s?current(playhead*s.seconds):null;
    badge.hidden=!v||!isOpen();
    if(!v){want=null;return;}
    const text=`Desk ${v.n} · ${v.label}`;if(text!==lastText){lastText=text;badge.textContent=text;badge.title=`Film sub-shot ${v.n}: the ${v.preset} preset (${fmt(v.start)}–${fmt(v.end)} s)`;}
    const now=document.querySelector('#director-timeline [data-desk-version-now]');if(now&&now.textContent!==v.n)now.textContent=v.n;
    for(const b of document.querySelectorAll('#director-timeline [data-desk-version]'))b.classList.toggle('current',b.dataset.deskVersion===v.n);
    want={id:s.id,v};if(bridge.deskVersion?.(s.id)?.n!==v.n)schedule();
  }
  function schedule(ms){clearTimeout(timer);timer=setTimeout(apply,ms??(scrubbing()?220:40));}
  async function apply(){
    if(busy||!want)return;
    if(scrubbing()||!bridge.ready()){schedule(150);return;}
    const {id,v}=want,i=selected();if(project().shots[i]?.id!==id||bridge.deskVersion?.(id)?.n===v.n)return;
    busy=true;const started=performance.now();
    try{status(`Switching the desk to ${v.n} · ${v.label}…`);await bridge.setDeskVersion(project(),i,v);
      status(`Desk ${v.n} · ${v.label}: the film's sub-shot ${v.n} desk (${v.preset}${v.setup?'':', preset only'}), ${((performance.now()-started)/1000).toFixed(1)} s to switch.`);}
    catch(error){status('The desk version could not load: '+error.message,true);}
    finally{busy=false;if(want&&bridge.deskVersion?.(want.id)?.n!==want.v.n)schedule();}
  }
  function click(event){const b=event.target.closest?.('[data-desk-version]');if(!b)return;const v=list().find(x=>x.n===b.dataset.deskVersion);if(!v)return;event.preventDefault();try{seek(Math.min(1,v.from/shot().seconds));}catch(error){status(error.message,true);}}
  return {lane,sync,click,current:()=>{const s=shot();return s?bridge.deskVersion?.(s.id)||null:null;},renderShot:(film,s,keys,seconds)=>{const v=current(seconds),job=versionRenderShot(film,s,keys,v),seed=v&&bridge.deskStorage?.(s.id);
    // The still renderer's stage takes the render's storage seed too (film-render.mjs; not part of the shot's JSON).
    if(seed)Object.defineProperty(job,'__storage',{value:seed,enumerable:false});return job;},has:()=>list().length>0};
}
