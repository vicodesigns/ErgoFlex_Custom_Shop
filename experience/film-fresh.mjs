import {cleanCut} from './cuts.mjs';
import {editsOf} from './edits-count.mjs';
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
// Set-aside drafts (19 Nov 2026, Vico lost High school edits): a stored draft older than the film's latest import is not
// loaded (the film's version opens), and it used to stay in the one draft slot of its chapter, where the first edit of
// the film's version wrote over it. Now it moves here first: { '<project id>': [{key, cut, at, asideAt, base}, ...] },
// the project id being film-<cut>-<chapter> (film-<chapter> for the master), so cuts and chapters never share one. An
// entry leaves only when he keeps it (it becomes the chapter's draft), deletes it after a second question, or when the
// film's version already has everything in it. The server autosaves (director-autosaves) are another matter: untouched.
export const SET_ASIDE='ergoflex.director.filmDrafts.setAside.v1';
function readAside(storage){try{const v=JSON.parse(storage.getItem(SET_ASIDE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
function writeAside(storage,all){try{storage.setItem(SET_ASIDE,JSON.stringify(all));return true;}catch{return false;}}
// How many things a draft changes against the film's version: camera keys, desk clips, length (cutChanges), and each
// other field of the shot (people, props, lights, titles…).
const fieldsOf=cut=>{const {id,camera,motion,seconds,layout,mode,...s}=cut?.shots?.[0]||{};return s;};
export function draftChanges(film,cut){
  const a=fieldsOf(film),b=fieldsOf(cut);let n=cutChanges(film,cut).length;
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[k])!==JSON.stringify(b[k]))n++;
  return n;
}
export function ago(iso,now=Date.now()){
  const t=Date.parse(iso);if(!Number.isFinite(t))return 'earlier';const m=Math.max(0,Math.round((now-t)/60000));
  return (m<1?'just now':m<60?`${m} minute${m===1?'':'s'} ago`:m<48*60?`${Math.round(m/60)} hour${Math.round(m/60)===1?'':'s'} ago`:`${Math.round(m/1440)} days ago`)+(clock(iso)?` (${clock(iso)})`:'');
}

// The Director's side. hooks: {storage, catalog, escape, render() (re-renders the notice), load(cut, asExported)
// (puts a cut in the editor; asExported: it becomes the exported baseline), status(text, error), current() ({cut,
// unexported}: what the editor has now)}.
export function createFilmFresh(film,project,hooks){
  const state=film?filmFresh.state:null,id=project.shots.length===1?project.shots[0].id:null,on=!!(state&&id===state.chapter.id);
  if(!on)return {on,stamp(){},initialDraft:()=>null,noteDraft(){},noticeHTML:()=>'',choose(){},exported(){},guardExport:async()=>false,prompt(){},offered:()=>null};
  const draftKey=project.id; // Each film cut has its own chapter project id.
  let base={cut:structuredClone(project),version:state.stamp.version},filmCut=structuredClone(project),exportedAt='',wrote=false;
  let notice=state.newer?{text:loadedText(state.stamp)}:null;
  let offer=null,asking=false,hold=false;   // the set-aside draft offered now (the newest); the second question; a draft that could not be set aside
  const dialog=document.createElement('dialog');dialog.id='film-stale';dialog.setAttribute('aria-labelledby','film-stale-title');document.body.append(dialog);
  const ask=document.createElement('dialog');ask.id='film-draft';ask.setAttribute('aria-labelledby','film-draft-title');document.body.append(ask);
  const belongs=d=>d?.cut?.id===draftKey;
  const forget=()=>{const all=readDrafts(hooks.storage);let changed=false;for(const key of [draftKey,id])if(belongs(all[key])){delete all[key];changed=true;}if(changed)writeDrafts(hooks.storage,all);};
  const storedDraft=()=>{const all=readDrafts(hooks.storage),d=belongs(all[draftKey])?all[draftKey]:(belongs(all[id])?all[id]:null);if(!d?.cut)return null;try{return {cut:cleanCut(d.cut,hooks.catalog),at:d.at||''};}catch{return null;}};
  const clean=c=>{try{return cleanCut(c,hooks.catalog);}catch{return null;}};
  const asideList=()=>{const l=readAside(hooks.storage)[draftKey];return Array.isArray(l)?l.filter(d=>belongs(d)&&typeof d.key==='string'):[];};
  // (false: not stored, the browser's storage is full; the caller then keeps what it has)
  function putAside(cut,at){
    const c=clean(cut);if(!c)return false;
    const all=readAside(hooks.storage),list=Array.isArray(all[draftKey])?all[draftKey]:[];
    if(list.some(d=>{const x=belongs(d)&&clean(d.cut);return !!x&&sameCut(x,c);}))return true;    // (already set aside)
    const now=new Date().toISOString();
    all[draftKey]=[...list,{key:Date.now().toString(36)+Math.random().toString(36).slice(2,7),cut:structuredClone(cut),at:at||now,asideAt:now,base:state.stamp.version}];
    // (and to disk, as its own named autosave, before the film's version takes its place: File ▸ Autosaves lists it)
    hooks.keep?.(structuredClone(cut),at||now);
    return writeAside(hooks.storage,all);
  }
  function dropAside(key){
    const all=readAside(hooks.storage),list=(Array.isArray(all[draftKey])?all[draftKey]:[]).filter(d=>d?.key!==key);
    if(list.length)all[draftKey]=list;else delete all[draftKey];return writeAside(hooks.storage,all);
  }
  // The newest set-aside draft that the film's version does not already have (one it has holds nothing to lose).
  function nextOffer(){
    for(const d of asideList().slice().reverse()){const c=clean(d.cut);if(!c)continue;if(sameCut(c,filmCut)){dropAside(d.key);continue;}return {...d,cut:c};}
    return hold?(()=>{const d=storedDraft();return d?{key:'',main:true,cut:d.cut,at:d.at}:null;})():null;
  }
  const full=()=>hooks.status('The browser\'s storage is full: your changes could not be set aside, so nothing was replaced. Export cut keeps them in the film.',true);
  // An unexported draft of this chapter from an earlier load: loaded at once when it is at least as new as the film's
  // latest import; otherwise the film's version opens and the draft is set aside (above) and offered (prompt).
  function initialDraft(){
    const d=storedDraft();let loaded=null;
    if(d){
      let old=null;try{old=state.hashCut&&cleanCut(state.hashCut,hooks.catalog);}catch{}
      if(sameCut(d.cut,filmCut)||(old&&sameCut(d.cut,old)))forget();
      else if(Date.parse(d.at)>=Date.parse(state.stamp.updated))loaded=d;   // unknown times: set aside
      else if(putAside(d.cut,d.at))forget();
      else hold=true;                                                          // (no room: it stays in its slot, never written over)
    }
    offer=nextOffer();
    if(loaded)notice={text:notice?.text||'',draft:loaded,using:'draft',offer};
    else if(offer)notice={text:notice?.text||'',offer,using:'film'};
    if(offer)setTimeout(()=>prompt(),0);
    if(hold)setTimeout(full,0);
    return loaded?loaded.cut:null;
  }
  function noteDraft(cut,unexported){
    if(hold)return;                                                            // (a draft that could not be set aside is not written over)
    if(!unexported){if(unconfirmed)return;if(wrote){forget();wrote=false;}return;}   // (an export the film has not confirmed keeps its draft)   // only a draft this tab wrote (an offered one stays until he picks)
    wrote=true;
    const all=readDrafts(hooks.storage),prev=belongs(all[draftKey])?all[draftKey]:(belongs(all[id])?all[id]:null),c=structuredClone(cut),edited=(()=>{try{return JSON.stringify(cleanCut(prev.cut,hooks.catalog).shots)!==JSON.stringify(cleanCut(c,hooks.catalog).shots);}catch{return true;}})();
    all[draftKey]={cut:c,at:edited?new Date().toISOString():prev.at,base:base.version};if(belongs(all[id]))delete all[id];writeDrafts(hooks.storage,all);
  }
  // A version brought back from File ▸ Autosaves is the chapter's draft as of now (newer than any film version it was
  // made before), so the next load opens it, never the banner or the film's version (19 Nov 2026, Vico's wellness).
  function stamp(cut){if(hold)return;const all=readDrafts(hooks.storage);all[draftKey]={cut:structuredClone(cut),at:new Date().toISOString(),base:base.version};if(belongs(all[id]))delete all[id];writeDrafts(hooks.storage,all);wrote=true;}
  // Keep: the offered draft becomes the chapter's draft in the editor. What the editor had (the film's version, maybe
  // edited since) is set aside in its turn when it has unexported changes: nothing is lost either way.
  function keepOffer(){
    const o=offer;if(!o)return;const live=hooks.current?.();if(ask.open)ask.close();asking=false;
    if(!o.main&&live?.unexported&&!putAside(live.cut,new Date().toISOString())){full();return;}
    hold=false;hooks.load(o.cut,false);wrote=true;noteDraft(o.cut,true);   // (its slot written at once, before it leaves the set-aside list)
    if(!o.main)dropAside(o.key);
    offer=nextOffer();notice={text:notice?.text||'',draft:{cut:o.cut,at:o.at},using:'draft',offer};
    hooks.status('Your unexported changes are back. Export cut sends them to the film.');hooks.render();
  }
  // Use the film's version, after the second question: the set-aside draft is deleted from this browser. The editor keeps
  // what it has (the film's version and anything done since).
  function discardOffer(){
    const o=offer;if(!o)return;if(ask.open)ask.close();asking=false;
    if(o.main){forget();hold=false;}else if(!dropAside(o.key)){full();return;}
    offer=nextOffer();if(notice){notice.offer=offer;if(!offer&&notice.using!=='draft'&&!notice.text)notice=null;}
    hooks.status('The set-aside changes are deleted. This chapter is the film\'s version.');hooks.render();
    if(offer)prompt();
  }
  function prompt(){
    if(!offer){if(ask.open)ask.close();return;}
    const e=hooks.escape,n=draftChanges(filmCut,offer.cut),more=asideList().filter(d=>d.key!==offer.key).length;
    ask.innerHTML=`<div class="director-heading"><div><span class="director-kicker">UNEXPORTED CHANGES</span><h2 id="film-draft-title">${asking?'Delete these changes?':'Your earlier changes are set aside'}</h2></div></div>
      <p data-draft-text><b>${e(project.name||id)}</b>: ${n} change${n===1?'':'s'} made ${e(ago(offer.at))} in this browser and not exported. The film has a newer version of this chapter${clock(state.stamp.updated)?` (${clock(state.stamp.updated)})`:''}, so that opened instead; your changes are kept until you choose.</p>${more?`<p>This chapter has ${more} more set-aside draft${more===1?'':'s'}: they are offered next.</p>`:''}
      ${asking?`<p class="film-draft-warn">They will be deleted from this browser. (The studio server's autosaves keep their own copies.)</p><div class="director-actions"><button data-draft="back" class="primary">Back</button><button data-draft="delete" class="danger">Delete my unexported changes</button></div>`
        :`<div class="director-actions"><button data-draft="keep" class="primary">Keep my unexported changes</button><button data-draft="film">Use the film's version</button><button data-draft="later">Decide later</button></div>`}`;
    ask.onclick=event=>{
      const c=event.target.closest('[data-draft]')?.dataset.draft;if(!c)return;
      if(c==='film'||c==='back'){asking=c==='film';prompt();return;}
      asking=false;ask.close();
      if(c==='keep')keepOffer();else if(c==='delete')discardOffer();
      else{hooks.status('Your earlier changes stay set aside: Keep my unexported changes, above the timeline, brings them back.');hooks.render();}
    };
    ask.oncancel=()=>{asking=false;};   // (Esc: decide later)
    if(!ask.open)ask.showModal();ask.querySelector(asking?'[data-draft=back]':'[data-draft=keep]')?.focus();
  }
  function noticeHTML(){
    if(!notice)return '';const e=hooks.escape,o=notice.offer;let choice='';
    // (how many more edits a draft holds than the film's version: Keep is the default then, and says so; 19 Nov 2026)
    const more=c=>{try{return editsOf(c)-editsOf(filmCut);}catch{return 0;}},moreText=n=>n>0?`<span class="film-fresh-more">Your draft has ${n} more edit${n===1?'':'s'} than the film's version.</span>`:'';
    if(notice.using==='draft'&&notice.draft)choice=`<span class="film-fresh-draft">You have unexported changes${clock(notice.draft.at)?` from ${clock(notice.draft.at)}`:''} in this browser.</span>${moreText(more(notice.draft.cut))}<span class="film-fresh-choice"><button data-action="film-keep-draft" class="primary" aria-pressed="true">Keep my unexported changes</button><button data-action="film-use-film" aria-pressed="false" title="Sets these changes aside (nothing is deleted) and opens the film's version">Use the film's version</button></span>`;
    if(notice.using==='draft'&&notice.draft&&o)choice+=`<span class="film-fresh-draft">Other unexported changes${clock(o.at)?` from ${clock(o.at)}`:''} are set aside.</span><span class="film-fresh-choice"><button data-action="film-draft-ask">Show them…</button></span>`;
    else if(o)choice=`<span class="film-fresh-draft">Your earlier unexported changes${clock(o.at)?` from ${clock(o.at)}`:''} are set aside.</span>${moreText(more(o.cut))}<span class="film-fresh-choice"><button data-action="film-keep-draft" class="${more(o.cut)>0?'primary':''}" aria-pressed="false">Keep my unexported changes</button><button data-action="film-use-film" aria-pressed="true" title="Asks before deleting the set-aside changes">Use the film's version…</button></span>`;
    return `<div class="film-fresh" data-film-fresh role="status">${notice.text?`<span>${e(notice.text)}</span>`:''}${choice}</div>`;
  }
  function choose(which){
    if(notice?.using==='draft'&&notice.draft){
      if(which!=='film')return;
      // the loaded draft is set aside (not deleted), and the film's version opens: Keep brings it back
      const live=hooks.current?.();if(live?.unexported&&!putAside(live.cut,notice.draft.at)){full();return;}
      hooks.load(filmCut,true);forget();wrote=false;offer=nextOffer();notice={text:notice.text,offer,using:'film'};
      hooks.status('Using the film\'s version. Your changes are set aside: Keep my unexported changes brings them back.');hooks.render();return;
    }
    if(!offer)return;
    if(which==='draft')keepOffer();else{asking=true;prompt();}
  }
  // Export cut only downloads a file; the film takes it in with an importer (tools/experience/director-import-watch.py),
  // which records each export it imported, by the file's sha256, in <cut>/director-exports/imports.json. The chapter's
  // draft stays in this browser until that record says the film has it (19 Nov 2026: no importer was running, Vico's
  // Create export never reached the film, and this used to forget his draft at once; a reload showed the old version).
  // Confirmed: the draft goes (unless he edited since). Failed, or nothing after IMPORT_WAIT: it stays and he is told.
  let unconfirmed=false,pending=null;
  const IMPORT_POLL=hooks.importPoll??3000,IMPORT_WAIT=hooks.importWait??10*60000;
  const importsUrl=()=>{try{return new URL('director-exports/imports.json',new URL(film.film,location.href)).href;}catch{return null;}};
  async function sha256(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  function exported(cut,text=null){
    base={...base,cut:structuredClone(cut)};exportedAt=new Date().toISOString();
    if(notice?.draft||notice?.offer)notice=offer?{text:'',offer,using:'film'}:null;
    // the chapter's draft is the exported cut until the film confirms it (written now: the editor's own draft write may
    // still be waiting for its 250 ms)
    if(!hold){const all=readDrafts(hooks.storage);all[draftKey]={cut:structuredClone(cut),at:exportedAt,base:base.version};if(belongs(all[id]))delete all[id];writeDrafts(hooks.storage,all);wrote=true;}
    unconfirmed=true;hooks.render();
    return watchImport(text);
  }
  async function watchImport(text){
    if(pending)clearTimeout(pending.timer);pending=null;
    const url=importsUrl(),at=exportedAt,say=(t,error=false)=>{notice={...(notice||{}),text:t};hooks.render();if(error)hooks.status(t,true);};
    if(!text||!url||!globalThis.crypto?.subtle){say(`Exported at ${clock(at)}. Your changes stay in this browser until the film has them.`);return;}
    const sha=await sha256(text),until=Date.now()+IMPORT_WAIT,mine={sha,at,timer:0};pending=mine;
    say(`Exported at ${clock(at)}: waiting for the film to take it in. Your changes stay in this browser until it has.`);
    const look=async()=>{
      if(pending!==mine)return;
      let rec=null;try{const r=await fetch(url,{cache:'no-store'});if(r.ok)rec=(await r.json())?.[sha]||null;}catch{}
      if(pending!==mine)return;
      if(rec?.ok){pending=null;unconfirmed=false;if(!hooks.current?.().unexported){forget();wrote=false;}say(`The film has your export from ${clock(at)}.`);hooks.status(`The film has taken in your export from ${clock(at)}.`);return;}
      if(rec){pending=null;say(`The film could not take in your export from ${clock(at)}: ${rec.error||'the import failed'}. Your changes stay in this browser.`,true);return;}
      if(Date.now()>until){pending=null;say(`The film has not taken in your export from ${clock(at)} (is the Director import watcher running?). Your changes stay in this browser: export again once it is.`,true);return;}
      mine.timer=setTimeout(look,IMPORT_POLL);
    };
    mine.timer=setTimeout(look,IMPORT_POLL);
    return sha;
  }
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
      if(dirty&&!putAside(cut,new Date().toISOString())){full();return;}   // (set aside: offered, never written over)
      adopt(now,latest);forget();wrote=false;offer=nextOffer();
      notice={text:loadedText(now.stamp),offer,using:'film'};
      hooks.load(latest,true);hooks.render();
    };
    dialog.showModal();dialog.querySelector('[data-stale=latest]').focus();
    return true;
  }
  return {on,initialDraft,noteDraft,noticeHTML,choose,exported,guardExport,prompt,stamp,offered:()=>offer,importPending:()=>!!pending,unconfirmed:()=>unconfirmed};
}
