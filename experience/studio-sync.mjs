// Studio <-> Director sync: props, desks and saved character placements.
//
// Studio and the Director share one state through the studio server (tools/studio-server.mjs, /api/studio-state).
// The Director's stage is a frame with its own in-memory copy of that state, taken when the Director page loaded.
//   Refresh from Studio   the page reads the shared state again (tools/studio-state/sync.js pull), the stage takes the
//                         new values and prepares the open chapter again at the same position. The cut, its edits
//                         and the undo history are the Director page's own and are not touched.
//   Studio changed badge  sync.js already polls /api/studio-state/changes every 5 s (a plain fetch: no connection is
//                         held open); this module watches that poll for Studio's keys.
//   Adopt Studio's version  after a Refresh, what Studio changed is compared with what the chapter overrides:
//                         props the chapter also moves, and room desks. Nothing is dropped without a choice.
//   Send to Director      the Director remembers which chapter page shows which room (ROOM_LINKS_KEY), so Studio can
//                         open the chapter of the room it is in.
// What the stage reads from Studio:
//   props  'ergoflex.sceneAssets.v1' (room[:layout] -> removed, added, transforms). The chapter's prop edits are
//          offsets on top of Studio's place, so a Studio move shows after a Refresh, under the chapter's own edit.
//   desks  'ergoflex.sceneDesksBySizeV2'. The film builds a chapter's room desks from the room itself, not from Studio's
//          saved desks (stage.mjs clearRoomRecipe), so that the film never depends on them. A Studio desk change
//          therefore reaches a chapter only as a chapter desk edit, when it is adopted here.
//   people saved :person: transforms in sceneAssets are offered as chapter peopleEdits. Adoption is selective,
//          undoable, and preserves the rest of the cast and its timing. Refresh never silently replaces the cast.
import {decodeStoredJSON,encodeStoredJSON} from '../browser-design-storage.mjs';
import {propKey,describePropEdit,propName,effectivePropEdits,studioSceneIds} from './prop-edits.mjs';
import {cleanDeskEdit,effectiveDeskEdits,describeDeskEdit} from './desk-edits.mjs';
import {clampStartPose} from './start-pose.mjs';
import {cleanPeople} from './people-edits.mjs';
import {studioPeopleChanges,peopleEditsFromStudio} from './studio-people-sync.mjs';
import {diffLayers,chapterCell} from '../scene-layers.mjs';
import {LAYERS_KEY,layersOn,chapterRooms,chapterSetting,stageTargets,layerAdoptRows,applyLayerRows,deskHidePlan} from './layers-exchange.mjs';

export const ASSETS_KEY='ergoflex.sceneAssets.v1',DESKS_KEY='ergoflex.sceneDesksBySizeV2';
export const STUDIO_KEYS=[ASSETS_KEY,DESKS_KEY];
export const ROOM_LINKS_KEY='ergoflex.director.roomLinks.v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const parse=raw=>{try{const v=raw?JSON.parse(raw):{};return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}};
const decode=raw=>{try{const v=raw?decodeStoredJSON(raw):null;return v&&typeof v==='object'?v:{};}catch{return {};}};
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

// ---- Layers (show / hide, phase 3): what the Studio hid or showed at a chapter's time and size, in the chapter's
// room(s): [{id, kind, label, change:'hidden'|'shown', room}]. The film never reads the layers key: these rows only
// become chapter edits when Vico takes them in the Adopt dialog (layers-exchange.mjs layerAdoptRows / applyLayerRows).
export function diffSceneLayers(beforeRaw,afterRaw,shot,rooms){
  const cell=chapterCell(shot),[mode,size]=cell.split('/'),out=[];
  for(const room of rooms||[])for(const r of diffLayers(beforeRaw,afterRaw,room,mode,size))out.push({...r,room});
  return out;
}
// ---- what changed in Studio between two values of a key
// Props of the chapter's room: [{editorId, sceneId, change:'moved'|'put back'|'removed'|'restored'|'added'|'taken out'}]
export function diffSceneAssets(beforeRaw,afterRaw,sceneIds){
  const before=parse(beforeRaw),after=parse(afterRaw),out=new Map();
  for(const sceneId of sceneIds){
    const b=before[sceneId]||{},a=after[sceneId]||{},set=(editorId,change)=>out.set(editorId,{editorId,sceneId,change});
    const bt=b.transforms||{},at=a.transforms||{};
    for(const id of new Set([...Object.keys(bt),...Object.keys(at)]))if(!same(bt[id],at[id]))set(id,at[id]?'moved':'put back');
    const br=new Set(b.removed||[]),ar=new Set(a.removed||[]);
    for(const id of ar)if(!br.has(id))set(id,'removed');
    for(const id of br)if(!ar.has(id))set(id,'restored');
    const ids=list=>new Set((list||[]).map(x=>x?.editorId).filter(Boolean)),ba=ids(b.added),aa=ids(a.added);
    for(const id of aa)if(!ba.has(id))set(id,'added');
    for(const id of ba)if(!aa.has(id))set(id,'taken out');
  }
  return [...out.values()];
}
const deskFacts=d=>d?{name:d.name||'ErgoFlex desk',size:d.size,pose:d.pose&&{x:d.pose.x,z:d.pose.z,yaw:d.pose.yaw},height:d.height,tilt:d.tilt}:null;
const near=(a,b,eps)=>Math.abs((a??0)-(b??0))<=eps;
// Desks of the chapter's room: [{desk, what:['size','place','start','build'], gone?:true, studio:{name,size,pose,height,tilt}|null}]
// known: {desk: {size,pose,height,tilt}} for desks Studio had not saved before (the room's own desks, as the stage has
// them): Studio saving a room for the first time is not a change to every desk in it.
export function diffSceneDesks(beforeRaw,afterRaw,roomKey,known={}){
  const b=decode(beforeRaw).rooms?.[roomKey]||{},a=decode(afterRaw).rooms?.[roomKey]||{},bd=b.desks||{},ad=a.desks||{},out=[];
  const gone=new Set(a.deleted||[]),wasGone=new Set(b.deleted||[]);
  for(const id of new Set([...Object.keys(bd),...Object.keys(ad),...gone])){
    const fresh=!bd[id]&&!!known[id],x=bd[id]||known[id],y=ad[id];
    if(gone.has(id)){if(!wasGone.has(id))out.push({desk:id,what:['removed'],gone:true,studio:null});continue;}
    if(!y)continue;
    const what=[];
    if(!x||x.size!==y.size)what.push('size');
    if(!x||!near(x.pose?.x,y.pose?.x,.5)||!near(x.pose?.z,y.pose?.z,.5)||!near(x.pose?.yaw,y.pose?.yaw,1e-4))what.push('place');
    if(!x||!near(x.height,y.height,.01)||!near(x.tilt,y.tilt,.01))what.push('start');
    if(!fresh&&(!x||!same(x.style,y.style)||!same(x.accessories,y.accessories)))what.push('build');
    if(what.length)out.push({desk:id,what,studio:deskFacts(y)});
  }
  return out;
}
// The chapter desk edit that shows Studio's desk: its size, place and start. The chapter's own moves and build stay.
export function deskEditFromStudio(desk,studio,existing=null){
  const next={...(existing?clone(existing):{}),desk,name:studio.name};
  if(studio.size)next.size=studio.size;
  if(studio.pose)next.pose={...studio.pose};
  if(Number.isFinite(studio.height)&&Number.isFinite(studio.tilt))next.initial=clampStartPose({height:studio.height,tilt:studio.tilt},next.size||'48x30');
  return cleanDeskEdit(next);
}
const STUDIO_DID={moved:'Studio moved it','put back':'Studio put it back where the room has it',removed:'Studio removed it',restored:'Studio put it back in the room',added:'Studio added it','taken out':'Studio took it out again'};
// The rows of the Adopt dialog. kind 'prop': the chapter also edits a prop Studio changed. kind 'desk': Studio changed
// a room desk (conflict: the chapter edits it too). take: what "take Studio's" does.
export function adoptRows({assetChanges=[],deskChanges=[],peopleChanges=[],peopleEdits=null,propEdits=[],deskEdits=[],featured=null}){
  const rows=[];
  for(const c of assetChanges){
    const e=propEdits.find(p=>p.asset&&'scene:'+p.asset===c.editorId);if(!e)continue;
    rows.push({kind:'prop',id:propKey(e),name:e.label?propName(e.label):propName(String(e.asset).split(':').pop()),conflict:true,
      studio:STUDIO_DID[c.change]||'Studio changed it',chapter:describePropEdit(e),take:'Drop the chapter\'s edit: the prop is where Studio has it'});
  }
  for(const c of deskChanges){
    if(c.desk===featured||c.desk==='main')continue;   // the featured desk is the chapter's own (Groove, Build tabs)
    const e=deskEdits.find(d=>d.desk===c.desk)||null;
    if(c.gone){if(e)rows.push({kind:'desk',id:c.desk,name:e.name||c.desk,conflict:true,gone:true,studio:'Studio removed this desk from the room',chapter:describeDeskEdit(e),take:''});continue;}
    const can=c.what.some(w=>['size','place','start'].includes(w));
    rows.push({kind:'desk',id:c.desk,name:c.studio.name,conflict:!!e,desk:c,studio:'Studio changed its '+c.what.join(', '),
      chapter:e?describeDeskEdit(e):'as the film has it',take:can?'Use Studio\'s size, place and start in this chapter'+(e?.clips?.length||e?.build?' (the chapter\'s moves and build stay)':''):''});
  }
  for(const person of peopleChanges){
    const name=person.id.replace(/^people-/,'').split('-')[0];
    rows.push({kind:'person',id:person.key,name:name.charAt(0).toUpperCase()+name.slice(1),person,
      conflict:!!peopleEdits?.cast?.some(p=>p.key===person.key),studio:person.removed?'Studio removed this person':'Studio changed their position, turn or size',
      chapter:peopleEdits?.cast?.some(p=>p.key===person.key)?'your Director placement':'the film\'s cast',
      take:person.removed?'Hide this person in the chapter':'Use Studio\'s position, turn and size in this chapter'});
  }
  return rows;
}

// ---- Make permanent in Studio, desks: Studio's 'ergoflex.sceneDesksBySizeV2' value with the confirmed desks written in.
//   rows: [{desk, edit, state}]   edit = the chapter's desk edit; state = the desk's record on the stage with the edit
//   applied (Studio's own record format: the stage runs Studio's code, so a size switch or a build is already exactly
//   what Studio itself would have saved). Only what the edit sets is written over Studio's record; a desk Studio has
//   not saved yet, or one whose size changes, takes the stage's record.
export function writeSceneDesks(raw,roomKey,rows){
  if(!/^[a-z]+\/[a-z]+$/.test(roomKey))throw Error('This room is not a Studio room layout.');
  let all;try{all=raw?decodeStoredJSON(raw):null;}catch{throw Error('Studio\'s desks could not be read.');}
  if(!all||typeof all!=='object')all={version:1,rooms:{}};
  all={...all,v:1,rooms:{...(all.rooms||{})}};
  const room=all.rooms[roomKey]?clone(all.rooms[roomKey]):{desks:{},deleted:[],selected:'main'};room.desks||={};
  for(const row of rows){
    const {desk,edit,state}=row;if(typeof desk!=='string'||!state||!edit)continue;
    const stored=room.desks[desk];let next;
    if(!stored||(edit.size&&stored.size!==state.size)){
      next=clone(state);
      // Studio's own saved setup for the other size stays as Studio has it.
      if(stored){const {sizeSetups:mine={},name,added,...variant}=stored,own=mine[state.size];
        next={...(own?clone(own):next),name:stored.name||state.name,added:stored.added===true,sizeSetups:{...Object.fromEntries(Object.entries(mine).filter(([k])=>k!==state.size)),[variant.size]:clone(variant)}};}
    }else next=clone(stored);
    if(edit.pose)next.pose={x:edit.pose.x,z:edit.pose.z,yaw:edit.pose.yaw};
    if(edit.initial){const p=clampStartPose(edit.initial,next.size);next.height=p.height;next.tilt=p.tilt;}
    if(edit.build){
      if(state.style)next.style=clone(state.style);
      if(Array.isArray(state.accessories)){next.accessories=[...state.accessories];next.accessoryFinishes=clone(state.accessoryFinishes||{});}
      const objects=Object.fromEntries(Object.entries(next.objects||{}).filter(([k])=>!k.startsWith('accessory-')));
      for(const [k,v] of Object.entries(state.objects||{}))if(k.startsWith('accessory-'))objects[k]=clone(v);
      next.objects=objects;
    }
    next.name||=state.name||'ErgoFlex desk';
    room.desks[desk]=next;room.deleted=(room.deleted||[]).filter(id=>id!==desk);
  }
  room.selected=room.desks[room.selected]?room.selected:Object.keys(room.desks)[0]||'main';
  all.rooms[roomKey]=room;
  return encodeStoredJSON(all);
}

// What the stage was last given for Studio's keys: the page's copy when the Director opened, then every Refresh and
// every Make permanent. The stage's own storage is no measure: the app rewrites it as rooms come and go.
const shown=new Map();
export function noteStudioValue(key,value){shown.set(key,value??null);}
// ---- the Director's controller
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createStudioSync({bridge,project,index,shot,film,commit,status,rerender,render,stageItems=()=>[]}){
  const sync=()=>window.__studioState,frame=()=>document.getElementById('stage'),api=()=>frame()?.contentWindow?.ErgoFlex;
  let waiting=[],seenRev=sync()?.rev||0,busy=false,rows=[];
  for(const key of STUDIO_KEYS)if(!shown.has(key))try{shown.set(key,localStorage.getItem(key));}catch{shown.set(key,null);}
  // Layers: watched and diffed here, never handed to the stage (bridge.refreshStudio): the film does not read it.
  const LAYERS=layersOn(),WATCH=LAYERS?[...STUDIO_KEYS,LAYERS_KEY]:STUDIO_KEYS;
  if(LAYERS&&!shown.has(LAYERS_KEY))try{shown.set(LAYERS_KEY,localStorage.getItem(LAYERS_KEY));}catch{shown.set(LAYERS_KEY,null);}
  // The shared poll: Studio's keys saved by another tab since the last Refresh are this module's; the rest keep the reload badge.
  sync()?.watch?.(keys=>{
    const mine=keys.filter(k=>WATCH.includes(k.key)&&k.rev>seenRev),count=waiting.length;
    waiting=mine;if(mine.length!==count)paint();
    return keys.filter(k=>!WATCH.includes(k.key));
  });
  // The badge also sits in the page's top bar, beside Close editor: the inspector scrolls, a change must not scroll away.
  const top=document.createElement('button');top.type='button';top.id='studio-changed';top.hidden=true;
  top.onclick=()=>refresh().catch(error=>status(error.message,true));
  document.getElementById('director')?.before(top);
  function paint(){
    const n=waiting.length;top.hidden=!n||busy;
    top.textContent=`Studio changed: ${n} edit${n===1?'':'s'} · Refresh`;
    top.title=`${who()} saved ${n} change${n===1?'':'s'} to Studio's props, desks or people. Read them into the stage: the chapter's edits and Undo stay.`;
    rerender();
  }
  const available=()=>!!sync()?.pull;
  const who=()=>[...new Set(waiting.map(k=>k.by))].join(', ');
  function peopleSeed(){
    const own=cleanPeople(shot()?.peopleEdits);if(own)return own;
    const f=film()?.people;
    return cleanPeople({cast:api()?.workspaceRoom?.people?.resolved?.()||[],when:f?.when||{},...(f?.chair?{chair:f.chair}:{}),...(f?.fade!==undefined?{fade:f.fade}:{})})||{cast:[]};
  }
  function html(){
    if(!available())return '';
    const n=waiting.length;
    return `<button data-action="ss-refresh" data-studio-refresh class="${n?'studio-changed':''}" ${busy?'disabled':''} title="${escape(n?`${who()} saved ${n} change${n===1?'':'s'} to Studio's props, desks or people. Read them into the stage: the chapter's edits and Undo stay.`:'Read Studio\'s props, desks and character placements into the stage again. The chapter\'s edits and Undo stay.')}">${n?`Studio changed: ${n} edit${n===1?'':'s'} · Refresh`:'Refresh from Studio'}</button>`;
  }
  async function refresh(){
    if(busy)return;if(!available())throw Error('Studio\'s shared state is not available on this server.');
    if(!bridge.ready()||bridge.bakeState().baking)throw Error('Wait for this chapter to finish loading.');
    busy=true;paint();
    try{
      status('Reading Studio…');
      const pulled=await sync().pull(key=>WATCH.includes(key));seenRev=pulled.rev;waiting=[];
      const values=Object.fromEntries(STUDIO_KEYS.map(k=>[k,localStorage.getItem(k)])),changed=STUDIO_KEYS.filter(k=>shown.get(k)!==values[k]);
      const s=shot(),roomKey=api()?.sceneDesks?.key||null,featured=api()?.sceneDesks?.selected??null,before=Object.fromEntries(changed.map(k=>[k,shown.get(k)]));
      if(changed.length)await bridge.refreshStudio(project(),index(),Object.fromEntries(changed.map(k=>[k,values[k]])));
      for(const k of changed)shown.set(k,values[k]);
      const sceneIds=studioSceneIds(s),layout=api()?.workspaceRoom?.roomLayout?.id;
      if(!s.layout&&layout)sceneIds.unshift(`${s.room}:${layout}`);
      const assetChanges=(changed.includes(ASSETS_KEY)?diffSceneAssets(before[ASSETS_KEY],values[ASSETS_KEY],sceneIds):[]).filter(c=>!/:person:/.test(c.editorId));
      // Offer saved placements even when Director opened after the Studio save, or a previous offer was kept.
      const peopleChanges=studioPeopleChanges(values[ASSETS_KEY],sceneIds,peopleSeed().cast);
      // The room's desks as the film has them (under the chapter's edits), for desks Studio saves for the first time.
      const known={};for(const r of api()?.sceneDesks?.records?.values()||[]){const st=r.deskEditWas?.state||r.state;if(st?.pose)known[r.id]={size:st.size,pose:{...st.pose},height:st.height,tilt:st.tilt};}
      const deskChanges=roomKey&&changed.includes(DESKS_KEY)?diffSceneDesks(before[DESKS_KEY],values[DESKS_KEY],roomKey,known):[];
      rows=adoptRows({assetChanges,deskChanges,peopleChanges,peopleEdits:s.peopleEdits,propEdits:effectivePropEdits(film(),s),deskEdits:effectiveDeskEdits(film(),s),featured});
      // Layers: the Studio's hides and shows at this chapter's time and size, named from this stage (never guessed)
      let layerChanges=[];
      if(LAYERS){try{
        const now=localStorage.getItem(LAYERS_KEY),was=shown.get(LAYERS_KEY)??null;
        if(now!==was){layerChanges=diffSceneLayers(was,now,s,chapterRooms(s,layout||null));shown.set(LAYERS_KEY,now);}
        if(layerChanges.length)rows.push(...layerAdoptRows(layerChanges,{targets:stageTargets(stageItems()),propEdits:effectivePropEdits(film(),s),featured:featured||'main',setting:chapterSetting(s),items:stageItems(),cast:peopleSeed().cast||[]}));
      }catch(error){console.warn('[layers] refresh',error);}}
      const conflicts=rows.filter(r=>r.conflict).length;
      status(`Refreshed from Studio: ${assetChanges.length} prop, ${deskChanges.length} desk${LAYERS?`, ${layerChanges.length} show / hide`:''} and ${peopleChanges.length} character change${peopleChanges.length===1?'':'s'} in this room. The chapter's edits and Undo are as they were.${conflicts?` ${conflicts} also edited in this chapter: choose which to keep.`:''}`);
      if(rows.length)openAdopt();
    }finally{busy=false;paint();}
  }
  // ---- Adopt Studio's version: one row per item, keep the chapter's or take Studio's; one undo step.
  const dialog=document.createElement('dialog');dialog.id='studio-adopt';dialog.setAttribute('aria-labelledby','studio-adopt-title');document.body.append(dialog);
  function openAdopt(){
    if(!rows.length){status('Studio and this chapter do not disagree on anything since the last Refresh.');return;}
    const conflicts=rows.filter(r=>r.conflict).length;
    dialog.innerHTML=`<div class="director-heading"><div><span class="director-kicker">STUDIO CHANGED</span><h2 id="studio-adopt-title">${conflicts?'Keep the chapter\'s edit, or take Studio\'s?':'Use Studio\'s changes in this chapter?'}</h2></div></div>
      <p>${conflicts?'Studio changed something this chapter also edits. ':''}Nothing changes unless you choose it here; one Undo puts it back.${rows.some(r=>r.kind==='desk')?' Room desks: the film keeps its own desk layout, so Studio\'s desk shows in a chapter only when you take it.':''}</p>
      <ul class="prop-permanent-list studio-adopt-list">${rows.map((r,i)=>`<li class="${r.take?'':'blocked'}"><b>${escape(r.name)}</b>${r.conflict?' <em>edited in both</em>':''}<small>${escape(r.studio)} · the chapter: ${escape(r.chapter)}</small>
        <label class="director-check"><input type="radio" name="adopt-${i}" value="keep" checked><span>Keep ${r.conflict?'the chapter\'s edit':r.kind==='person'?'the film\'s character':r.kind==='layer'?'the chapter as it is':'the film\'s desk'}</span></label>
        ${r.take?`<label class="director-check"><input type="radio" name="adopt-${i}" value="take" data-adopt="${i}"><span>${escape(r.take)}</span></label>`:r.kind==='layer'?`<small>${escape(r.chapter)}</small>`:`<small>${r.gone?'The chapter\'s edit stays: the film still has this desk.':'Only its build changed in Studio: a chapter takes a build in the Build tab.'}</small>`}</li>`).join('')}</ul>
      <div class="director-actions"><button data-adopt-go class="primary" disabled>Apply</button><button data-adopt-cancel>Close</button></div>`;
    dialog.showModal();dialog.querySelector('[data-adopt-cancel]').focus();
  }
  dialog.addEventListener('change',()=>{const n=dialog.querySelectorAll('[data-adopt]:checked').length,b=dialog.querySelector('[data-adopt-go]');if(b){b.disabled=!n;b.textContent=n?`Apply (${n} from Studio)`:'Apply';}});
  dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-adopt-cancel]')){dialog.close();return;}
    if(!event.target.closest('[data-adopt-go]'))return;
    const taken=[...dialog.querySelectorAll('[data-adopt]:checked')].map(el=>rows[Number(el.dataset.adopt)]).filter(Boolean);
    dialog.close();if(taken.length)adopt(taken);
  });
  function adopt(taken){
    const props=new Set(taken.filter(r=>r.kind==='prop').map(r=>r.id)),desks=taken.filter(r=>r.kind==='desk'&&r.desk),people=taken.filter(r=>r.kind==='person'),layerRows=taken.filter(r=>r.kind==='layer'&&r.edit),layerDesks=taken.filter(r=>r.kind==='layer'&&r.desk);
    const deskSeed=layerDesks.length?peopleSeed():null;
    const seed=people.length?peopleSeed():null;
    commit(()=>{
      const s=shot(),f=film();
      if(props.size)s.propEdits=effectivePropEdits(f,s).filter(e=>!props.has(propKey(e)));
      // Layers: the Studio's hide (or show) as this chapter's own prop edit (the film's ordinary hide), one undo step
      if(layerRows.length)s.propEdits=applyLayerRows(effectivePropEdits(f,s),layerRows);
      // a room desk: the desk edit + its chair and props + its user out of the cast, in this same undo step
      for(const r of layerDesks){
        const plan=deskHidePlan({stationId:r.desk.stationId,hide:r.desk.hide,featured:api()?.sceneDesks?.selected||'main',items:stageItems(),deskEdits:effectiveDeskEdits(f,s),propEdits:effectivePropEdits(f,s),cast:(s.peopleEdits?cleanPeople(s.peopleEdits):deskSeed)?.cast||[]});
        if(!plan.ok)continue;
        s.deskEdits=plan.deskEdits;s.propEdits=plan.propEdits;const p=cleanPeople({...(cleanPeople(s.peopleEdits)||deskSeed),cast:plan.cast});if(p)s.peopleEdits=p;
      }
      if(people.length)s.peopleEdits=peopleEditsFromStudio(seed,people.map(r=>r.person));
      if(desks.length){
        let list=effectiveDeskEdits(f,s);
        for(const r of desks){const next=deskEditFromStudio(r.id,r.desk.studio,list.find(e=>e.desk===r.id)||null);list=list.filter(e=>e.desk!==r.id);if(next)list.push(next);}
        s.deskEdits=list;
      }
    },{render:false});
    rows=rows.filter(r=>!taken.includes(r));
    status(`Took Studio's version of ${taken.map(r=>r.name).join(', ')}. One Undo brings the chapter's own back.`);
    render();
  }
  // ---- Send to Director: which chapter page shows which room (Studio reads this to open the right chapter).
  function remember(chapter){
    const s=shot();if(!s?.room||!chapter?.url)return;
    try{
      const url=new URL(chapter.url,location.href),link={url:url.pathname+url.search,id:String(chapter.id||s.id).slice(0,80),title:String(chapter.title||s.title||'').slice(0,140)};
      const all=parse(localStorage.getItem(ROOM_LINKS_KEY)),rooms={...(all.rooms||{}),[s.room]:link};
      const next=JSON.stringify({v:1,rooms,last:link});if(next!==localStorage.getItem(ROOM_LINKS_KEY))localStorage.setItem(ROOM_LINKS_KEY,next);
    }catch{}
  }
  async function action(name){
    if(name==='ss-refresh'){await refresh();return;}
    if(name==='ss-adopt'){openAdopt();return;}
  }
  return {html,action,refresh,remember,pending:()=>waiting.length,rows:()=>rows,busy:()=>busy,peopleSeed};
}
