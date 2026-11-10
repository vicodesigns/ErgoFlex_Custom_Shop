import {cleanCut} from './cuts.mjs';
import {loadFilmChapters} from './film-chapters.mjs';
// Film chapter freshness. A chapter page bakes its cut into the URL hash, so a reloaded Director tab (F5, a live
// reload) came back with the cut it was first opened with, and its next Export cut sent those stale values back to
// the film. build-round8-director.py --pages stamps every page cut and director-chapters.json entry with
// filmVersion (content hash) and filmUpdated (UTC time that version was built; 'version' / 'updated' in the list): on load the player swaps in the page's
// newer cut and rewrites the hash; the Director keeps unexported drafts per chapter and warns before a stale tab
// exports over newer film values.
const DRAFTS='ergoflex.director.filmDrafts.v1';
const rawCut=enc=>{try{return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(enc.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));}catch{return null;}};
const hashCut=hash=>new URLSearchParams(String(hash||'').replace(/^#/,'')).get('cut');
const stampOf=c=>({version:typeof c?.filmVersion==='string'?c.filmVersion:'',updated:typeof c?.filmUpdated==='string'?c.filmUpdated:''});
export const clock=iso=>{const d=new Date(iso);return !iso||Number.isNaN(d.getTime())?'':`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
export const withCut=(hash,enc)=>String(hash).replace(/([#&]cut=)[A-Za-z0-9_-]+/,`$1${enc}`);
const loadedText=stamp=>`Loaded the latest film version of this chapter${clock(stamp.updated)?` (your export from ${clock(stamp.updated)})`:''}.`;
async function pageCut(url,fetcher){
  const response=await fetcher(url,{cache:'no-store'});if(!response.ok)throw Error(`Chapter page unavailable (${response.status}).`);
  const m=/#cut=([A-Za-z0-9_-]+)/.exec(await response.text());if(!m)throw Error('The chapter page has no cut.');return m[1];
}
// The film's current cut of chapter id: {chapter, stamp, enc} (enc null when the list's version is 'known').
export async function filmChapterNow(film,id,{base=location.href,fetcher=globalThis.fetch,known=''}={}){
  const chapter=(await loadFilmChapters(film,base,fetcher)).find(c=>c.id===id);if(!chapter)return null;
  if(known&&chapter.version===known)return {chapter,stamp:{version:chapter.version,updated:chapter.updated},enc:null};
  const enc=await pageCut(chapter.url,fetcher);return {chapter,stamp:stampOf(rawCut(enc)),enc};
}
// On load: the film's cut when it is newer than the hash's. {enc, stamp, newer, previous (the hash's stamp), hashCut}.
export async function latestFilmCut(film,hash,options={}){
  const enc=hashCut(hash),cut=enc&&rawCut(enc),id=cut?.shots?.length===1&&cut.shots[0].id;if(!id)return null;
  const mine=stampOf(cut),now=await filmChapterNow(film,id,{...options,known:mine.version});if(!now)return null;
  const keep={chapter:now.chapter,enc,stamp:mine,newer:false};
  if(!now.enc||now.enc===enc||(now.stamp.version&&now.stamp.version===mine.version))return keep;
  if(Date.parse(now.stamp.updated)<Date.parse(mine.updated))return keep;   // a hash newer than its page: never expected
  return {chapter:now.chapter,enc:now.enc,stamp:now.stamp,newer:true,previous:mine,hashCut:cut};
}
// Set by the player before the Director mounts: the chapter's stamp and whether the hash was replaced.
export const filmFresh={state:null};

// What differs between two cuts of one chapter, per item: length, camera keys (in time order), desk clips (by id).
const r=x=>Math.round(Number(x)*100)/100;
const near=(a,b,eps)=>Math.abs(Number(a)-Number(b))<=eps;
const vecNear=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>near(x,b[i],1e-3));
function cutItems(cut){
  const s=cut?.shots?.[0],out=new Map();if(!s)return out;const T=Number(s.seconds)||0;
  out.set('length',{label:'chapter length',text:`${r(T)} s`,value:T,T});
  [...(s.camera?.keys||[])].sort((a,b)=>a.time-b.time).forEach((k,i)=>out.set('key:'+i,{label:`camera key ${i+1}`,text:`${r(k.time*T)} s`,value:k,T}));
  for(const c of s.motion?.clips||[])out.set('clip:'+c.id,{label:`${c.lane||'desk'} clip “${c.label||c.id}”`,text:`${r(c.start)}–${r(c.start+c.duration)} s`,value:c,T});
  return out;
}
function same(key,a,b){
  if(!a||!b)return !a&&!b;const x=a.value,y=b.value;
  if(key==='length')return near(x,y,.005);
  if(key.startsWith('key:'))return near(x.time*a.T,y.time*b.T,.005)&&vecNear(x.view?.position,y.view?.position)&&vecNear(x.view?.target,y.view?.target)&&near(x.view?.fov??35,y.view?.fov??35,.01);
  return near(x.start,y.start,.005)&&near(x.duration,y.duration,.005)&&(x.target??null)===(y.target??null)&&(x.kind||'')===(y.kind||'');
}
// [{key, text}] for every item that differs, worded from -> to.
export function cutChanges(from,to){
  const a=cutItems(from),b=cutItems(to),out=[];
  for(const key of new Set([...a.keys(),...b.keys()])){
    const x=a.get(key),y=b.get(key);if(same(key,x,y))continue;
    const what=!x?'added':!y?'removed':x.text===y.text?`${x.text} (view moved)`:`${x.text} → ${y.text}`;
    out.push({key,text:`${(y||x).label}: ${what}`});
  }
  return out;
}
// Fields outside the page cut (lighting, props, titles) count too when deciding whether a draft is the same cut.
const rest=cut=>JSON.stringify((cut?.shots||[]).map(({id,camera,motion,seconds,layout,mode,...s})=>s));
const sameCut=(a,b)=>!cutChanges(a,b).length&&rest(a)===rest(b);
function readDrafts(storage){try{return JSON.parse(storage.getItem(DRAFTS)||'{}')||{};}catch{return {};}}
function writeDrafts(storage,drafts){try{storage.setItem(DRAFTS,JSON.stringify(drafts));}catch{}}

// The Director's side. hooks: {storage, catalog, escape, render() (re-renders the notice), load(cut, asExported)
// (puts a cut in the editor; asExported: it becomes the exported baseline), status(text)}.
export function createFilmFresh(film,project,hooks){
  const state=film?filmFresh.state:null,id=project.shots.length===1?project.shots[0].id:null,on=!!(state&&id===state.chapter.id);
  if(!on)return {on,initialDraft:()=>null,noteDraft(){},noticeHTML:()=>'',choose(){},exported(){},guardExport:async()=>false};
  let base={cut:structuredClone(project),version:state.stamp.version},filmCut=structuredClone(project),exportedAt='',wrote=false;
  let notice=state.newer?{text:loadedText(state.stamp)}:null;
  const dialog=document.createElement('dialog');dialog.id='film-stale';dialog.setAttribute('aria-labelledby','film-stale-title');document.body.append(dialog);
  const forget=()=>{const all=readDrafts(hooks.storage);if(id in all){delete all[id];writeDrafts(hooks.storage,all);}};
  const storedDraft=()=>{const d=readDrafts(hooks.storage)[id];if(!d?.cut)return null;try{return {cut:cleanCut(d.cut,hooks.catalog),at:d.at||''};}catch{return null;}};
  // An unexported draft of this chapter from an earlier load: offered when it differs from both the hash's cut and
  // the film's; loaded at once when it is newer than the film's latest import, else the film's version stays.
  function initialDraft(){
    const d=storedDraft();if(!d)return null;
    let old=null;try{old=state.hashCut&&cleanCut(state.hashCut,hooks.catalog);}catch{}
    if(sameCut(d.cut,filmCut)||(old&&sameCut(d.cut,old))){forget();return null;}
    const older=!(Date.parse(d.at)>=Date.parse(state.stamp.updated));   // unknown times: the film's
    notice={text:notice?.text||'',draft:d,using:older?'film':'draft'};
    return older?null:d.cut;
  }
  function noteDraft(cut,unexported){
    if(!unexported){if(wrote){forget();wrote=false;}return;}   // only a draft this tab wrote (an offered one stays until he picks)
    wrote=true;
    const all=readDrafts(hooks.storage),prev=all[id],c=structuredClone(cut),edited=(()=>{try{return JSON.stringify(cleanCut(prev.cut,hooks.catalog).shots)!==JSON.stringify(cleanCut(c,hooks.catalog).shots);}catch{return true;}})();
    all[id]={cut:c,at:edited?new Date().toISOString():prev.at,base:base.version};writeDrafts(hooks.storage,all);
  }
  function noticeHTML(){
    if(!notice)return '';const d=notice.draft,e=hooks.escape;
    const choice=d?`<span class="film-fresh-draft">You have unexported changes${clock(d.at)?` from ${clock(d.at)}`:''} in this browser.</span><span class="film-fresh-choice"><button data-action="film-keep-draft" aria-pressed="${notice.using==='draft'}">Keep my unexported changes</button><button data-action="film-use-film" aria-pressed="${notice.using==='film'}">Use the film's version</button></span>`:'';
    return `<div class="film-fresh" data-film-fresh role="status">${notice.text?`<span>${e(notice.text)}</span>`:''}${choice}</div>`;
  }
  function choose(which){
    if(!notice?.draft||notice.using===which)return;notice.using=which;
    if(which==='draft')hooks.load(notice.draft.cut,false);else{hooks.load(filmCut,true);forget();}
    hooks.status(which==='draft'?'Your unexported changes are back. Export cut sends them to the film.':'Using the film\'s version of this chapter.');
    hooks.render();
  }
  function exported(cut){base={...base,cut:structuredClone(cut)};exportedAt=new Date().toISOString();forget();if(notice?.draft){notice=null;hooks.render();}}
  function adopt(now,cut){base={cut:structuredClone(cut||base.cut),version:now.stamp.version};if(cut)filmCut=structuredClone(cut);if(now.enc)history.replaceState(history.state,'',withCut(location.hash,now.enc));}
  // Export cut from a tab the film has moved past: true when the warning took over (Export anyway / Load the latest).
  async function guardExport(cut,dirty,exportAnyway){
    const now=await Promise.race([filmChapterNow(film.film,id,{known:base.version}),new Promise(r=>setTimeout(()=>r(null),1500))]).catch(error=>{console.warn('[film fresh]',error.message);return null;});
    if(!now?.enc)return false;                                                              // same version, or unreachable
    if(Date.parse(now.stamp.updated)<Date.parse(exportedAt))return false;              // this tab's export is not in yet
    let latest;try{latest=cleanCut(rawCut(now.enc),hooks.catalog);}catch{return false;}
    const moved=new Set(cutChanges(base.cut,latest).map(c=>c.key)),revert=cutChanges(latest,cut).filter(c=>moved.has(c.key));
    if(!revert.length){adopt(now,latest);return false;}                                       // the film moved nowhere this tab differs
    const e=hooks.escape;
    dialog.innerHTML=`<div class="director-heading"><div><span class="director-kicker">EXPORT CUT</span><h2 id="film-stale-title">This tab is older than the film</h2></div></div><p data-stale-text>This tab is older than the film (exported ${e(clock(now.stamp.updated)||'since')}). Exporting will overwrite:</p><ul data-stale-list>${revert.slice(0,12).map(c=>`<li>${e(c.text)}</li>`).join('')}${revert.length>12?`<li>and ${revert.length-12} more</li>`:''}</ul><div class="director-actions"><button data-stale="export">Export anyway</button><button data-stale="latest" class="primary">Load the latest</button></div>`;
    dialog.onclick=event=>{
      const choice=event.target.closest('[data-stale]')?.dataset.stale;if(!choice)return;dialog.close();
      if(choice==='export'){adopt(now,latest);exportAnyway();return;}
      if(dirty){noteDraft(cut,true);wrote=false;}adopt(now,latest);   // kept as an offered draft
      notice={text:loadedText(now.stamp),draft:dirty?storedDraft():null,using:'film'};
      hooks.load(latest,true);hooks.render();
    };
    dialog.showModal();dialog.querySelector('[data-stale=latest]').focus();
    return true;
  }
  return {on,initialDraft,noteDraft,noticeHTML,choose,exported,guardExport};
}
