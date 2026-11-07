// Director "Build" tab: the selected room desk's materials, trim and accessories, like the store configurator
// (desk-build.mjs holds the data and the stage code). One edit = one undo step; the live stage changes at once through the
// film layers (shot.deskEdits[].build -> sceneDeskEdits -> film-fx -> applyBuild), the same path Render still and the film take.
// Which desk: DeskSel's selection (the `selection` option, a desk id or null). Until that lands this tab has its own
// "Desk" picker (TEMP, listed from the stage's room desks); with a selection the picker is hidden.
import {accessory} from '../catalog.mjs';
import {SLOTS,slotLabel,naturalSlot,slotless,woodSwatches,baseSwatches,trimSwatches,presetBuilds,presetBuild,cleanDeskBuild,cleanBuildAccessories,
  catalogAccessories,roomDesks,readDesk,withDeskBuild,hasBuildTab,isBrandingRoom} from './desk-build.mjs';
import {effectiveDeskEdits} from './desk-edits.mjs';
import {presetSwatch} from './desk-versions.mjs';

const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sizeLabel=s=>s==='48x30'?'48″':s==='60x30'?'60″':String(s||'');

export function createDeskBuildPanel({panel,shot,film,commit,status,rerender,ready,selection=()=>null}){
  let picked=null,openAdd=false;
  const win=()=>document.getElementById('stage')?.contentWindow||null,api=()=>win()?.ErgoFlex||null;
  const live=()=>{try{return ready?.()!==false&&!!api()?.sceneDesks?.records;}catch{return false;}};
  const room=()=>shot()?.room;
  const desks=()=>live()?roomDesks(api()):[];
  const current=()=>{const want=selection()||picked,list=desks();return list.find(r=>r.id===want)?.id||list[0]?.id||null;};
  const edits=()=>effectiveDeskEdits(film(),shot());
  const entry=id=>edits().find(e=>e.desk===id)||null;
  // The build as the Director holds it (what the stage was told); the desk's own live reading fills the rest.
  const held=id=>entry(id)?.build||null;

  // The desk as the Director means it: the held build over the stage's own reading (the stage follows a moment later).
  function intended(id){const d=readDesk(api(),id),b=held(id)||{};return {...d,...(b.woodFinish?{woodFinish:b.woodFinish}:{}),...(b.baseFinish?{baseFinish:b.baseFinish}:{}),...(b.trimColor?{trimColor:b.trimColor}:{}),...(b.accessories?{accessories:b.accessories}:{})};}
  function write(id,build,text){
    const r=api()?.sceneDesks?.records.get(id),clean=build&&cleanDeskBuild(build);
    commit(()=>{shot().deskEdits=withDeskBuild(edits(),id,r?.state.name,clean||null);},{render:false});
    status(text);rerender();
  }
  // What a change starts from: the held build, with the desk's accessory list spelled out once it is edited.
  const start=(id,{accessories=false}={})=>{
    const b=structuredClone(held(id)||{});
    if(accessories&&!b.accessories)b.accessories=intended(id)?.accessories||[];
    return b;
  };
  const kindName={wood:'Desktop finish',base:'Frame finish',trim:'Trim colour'};
  const field={wood:'woodFinish',base:'baseFinish',trim:'trimColor'};

  function swatches(kind,list,chosen){
    return `<div class="build-swatches" role="group" aria-label="${kindName[kind]}">${list.map(s=>`<button type="button" class="build-swatch" data-build-pick="${kind}" data-value="${escape(s.color&&kind==='trim'?s.color:s.name)}" aria-pressed="${(kind==='trim'?s.color:s.name).toLowerCase()===String(chosen||'').toLowerCase()}" style="--sw:${escape(s.color)}" title="${escape(s.name)}" aria-label="${escape(s.name)}"></button>`).join('')}</div>`;
  }
  function accessoryRows(d){
    if(!d.accessories.length)return '<p class="director-hint">No accessories on this desk.</p>';
    return `<ul class="build-accessories">${d.accessories.map(a=>{const item=accessory(a.id);
      return `<li class="build-accessory"><span class="build-acc-name" title="${escape(item?.description||'')}">${escape(item?.name||a.id)}</span>${slotless(a.id)?`<span class="build-acc-fixed" title="${escape(item?.name||a.id)} has one place on the desk">${escape(slotLabel(a.slot))}</span>`:`<select data-build-slot="${escape(a.id)}" aria-label="Where ${escape(item?.name||a.id)} goes">${SLOTS.map(([id,label])=>`<option value="${id}" ${id===a.slot?'selected':''}>${label}</option>`).join('')}</select>`}<button type="button" data-build-remove="${escape(a.id)}" aria-label="Remove ${escape(item?.name||a.id)}" title="Remove">✕</button></li>`;}).join('')}</ul>`;
  }
  function addRow(d){
    const have=new Set(d.accessories.map(a=>a.id)),groups=new Map();
    for(const a of catalogAccessories()){if(have.has(a.id))continue;const c=a.category||'Other';if(!groups.has(c))groups.set(c,[]);groups.get(c).push(a);}
    return `<div class="build-add"><label>Accessory<select name="build-add"><option value="">Choose an accessory…</option>${[...groups].map(([c,l])=>`<optgroup label="${escape(c)}">${l.map(a=>`<option value="${escape(a.id)}">${escape(a.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <label>Goes on<select name="build-add-slot">${SLOTS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><button type="button" data-build-add>+ Add</button></div>`;
  }
  const presetChips=()=>`<div class="build-presets" role="group" aria-label="Start from a build preset">${presetBuilds().map(p=>{const w=presetSwatch(p.id);
    return `<button type="button" data-build-preset="${escape(p.id)}" style="--wood:${w.wood};--trim:${w.trim};--base:${w.base}" title="${escape(p.name)} · ${escape(w.woodName)} top, ${escape(w.baseName)} frame, ${p.accessories.length} accessories. Replaces this desk's finishes and accessories."><i class="build-preset-swatch" aria-hidden="true"></i><span>${escape(p.name)}</span></button>`;}).join('')}</div>`;

  function content(){
    if(isBrandingRoom(room()))return '<h3>Build</h3><p class="director-hint">School, college and library rooms carry the school’s branding, so their desks use the Branding tab instead.</p>';
    if(!hasBuildTab(room()))return '<h3>Build</h3><p class="director-hint">The Build tab styles the desks of a room. Product chapters use the chapter’s Desk build.</p>';
    if(!live())return '<h3>Build</h3><p class="director-hint">The room is loading…</p>';
    const list=desks();
    if(!list.length)return `<h3>Build</h3><p class="director-hint">This room has only the featured desk. Its build is set in the Chapter tab (Desk build); other desks of a room appear here.</p>`;
    const id=current(),edited=!!held(id),d=intended(id);
    const picker=selection()?'':`<label class="build-desk">Desk <small>(temporary picker)</small><select name="build-desk">${list.map(r=>`<option value="${escape(r.id)}" ${r.id===id?'selected':''}>${escape(r.state.name)} · ${sizeLabel(r.state.size)}</option>`).join('')}</select></label>`;
    return `<h3>Build <span class="inspector-subtitle">${escape(d.name)} · ${sizeLabel(d.size)}</span></h3>${picker}
      <p class="director-hint">Materials, trim and accessories for this desk, like the store’s configurator. Size is on the desk’s own panel. ${edited?'Edited here; Export cut sends it to the film.':'As the room has it; your first change is kept in this cut.'}</p>
      <fieldset class="chapter-pacing build-box"><legend>Start from a build preset</legend>${presetChips()}</fieldset>
      <fieldset class="chapter-pacing build-box"><legend>Desktop finish <small data-build-name="wood">${escape(d.woodFinish||'')}</small></legend>${swatches('wood',woodSwatches(),d.woodFinish)}</fieldset>
      <fieldset class="chapter-pacing build-box"><legend>Frame finish <small data-build-name="base">${escape(d.baseFinish||'')}</small></legend>${swatches('base',baseSwatches(),d.baseFinish)}</fieldset>
      <fieldset class="chapter-pacing build-box"><legend>Trim colour <small data-build-name="trim">${escape(trimSwatches().find(t=>t.color===d.trimColor)?.name||d.trimColor||'')}</small></legend>${swatches('trim',trimSwatches(),d.trimColor)}</fieldset>
      <fieldset class="chapter-pacing build-box"><legend>Accessories <small>${d.accessories.length}</small></legend>${d.loaded?accessoryRows(d)+addRow(d):'<p class="director-hint">This desk’s accessories are not loaded yet.</p>'}
        <p class="director-hint">Desktop, top shelf, second shelf or the shelf at the base. A second keyboard, mouse or display replaces the first, as in the store.</p></fieldset>
      <div class="director-actions"><button type="button" data-build-reset ${edited?'':'disabled'}>Reset this desk to the room</button></div>`;
  }

  function onClick(event){
    const b=event.target.closest?.('[data-build-pick],[data-build-preset],[data-build-remove],[data-build-add],[data-build-reset]');if(!b||!panel.contains(b))return;
    const id=current();if(!id||!live())return;
    try{
      if(b.dataset.buildPick){const kind=b.dataset.buildPick,next=start(id);next[field[kind]]=b.dataset.value;
        write(id,next,`${kindName[kind]}: ${kind==='trim'?trimSwatches().find(t=>t.color===b.dataset.value)?.name||b.dataset.value:b.dataset.value}.`);}
      else if(b.dataset.buildPreset){const p=presetBuild(b.dataset.buildPreset),name=presetBuilds().find(x=>x.id===b.dataset.buildPreset)?.name;if(p)write(id,p,`Started from the ${name} build.`);}
      else if(b.dataset.buildRemove){const next=start(id,{accessories:true}),was=accessory(b.dataset.buildRemove);next.accessories=next.accessories.filter(a=>a.id!==b.dataset.buildRemove);write(id,next,`${was?.name||'Accessory'} removed.`);}
      else if(b.dataset.buildAdd!==undefined){
        const add=panel.querySelector('[name="build-add"]')?.value,slot=panel.querySelector('[name="build-add-slot"]')?.value;
        if(!add){status('Choose an accessory to add.');return;}
        const next=start(id,{accessories:true});next.accessories=cleanBuildAccessories([...next.accessories.filter(a=>a.id!==add),{id:add,slot:slotless(add)?naturalSlot(add):slot}]);
        write(id,next,`${accessory(add)?.name||add} added${slotless(add)?'':' to the '+slotLabel(slot).toLowerCase()}.`);}
      else if(b.dataset.buildReset!==undefined){write(id,null,'This desk is back to the room’s build.');}
    }catch(error){status(error.message,true);}
  }
  function onChange(event){
    const t=event.target;if(!panel.contains(t))return;
    if(t.name==='build-desk'){picked=t.value;rerender();return;}
    if(t.dataset?.buildSlot){const id=current();if(!id||!live())return;
      try{const next=start(id,{accessories:true}),a=next.accessories.find(x=>x.id===t.dataset.buildSlot);if(!a)return;a.slot=t.value;write(id,next,`${accessory(a.id)?.name||a.id} now goes on the ${slotLabel(t.value).toLowerCase()}.`);}catch(error){status(error.message,true);}}
  }
  panel.addEventListener('click',onClick);panel.addEventListener('change',onChange);
  return {
    panel:content,
    // The tab shows in film chapters whose room is not a school / college / library room.
    shows:()=>hasBuildTab(room()),
    select:id=>{picked=id;},
    current,
  };
}
