import {cleanPropLayers,lockedKeys,layerOf} from './prop-layers.mjs';
import {pickMode} from './prop-selection.mjs';
import {rowEye,hiddenOnly,showAllKeys} from './layers-exchange.mjs';
// Director "Layers" tab: an outliner of the chapter's editable things (the featured desk's items, then the room's
// props by area) with search; click a row to select it and see where it is (a pulsing outline on the stage);
// Shift+click adds, Ctrl/Cmd+click adds or removes (as in the view). Layers are named groups of those things
// (shot.propLayers, prop-layers.mjs): select all, show / hide (the ordinary per-chapter hide edits, so the film
// matches), lock (can't be picked in the view), add the selection, drag rows onto a layer.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto.randomUUID();
// studio (Layers phase 3, null or on()===false with ?layers=0: the tab as before): {on(), hiddenHere(): Map(prop key ->
// {id}) what the Studio hides at this chapter's time and size, setting(): 'First bell · 60 in'}. A Studio hide reaches the
// chapter only through "Hide here too" (the ordinary chapter hide edit): the film never reads the Studio's hides.
export function createLayersPanel({root,shot,commit,status,props,rerender,studio=null}){
  let search='',newName='',closed=new Set(),onlyHidden=false;
  const extras=()=>{try{return !!studio?.on?.();}catch{return false;}};
  const studioHere=()=>{try{return extras()?studio.hiddenHere?.()||new Map():new Map();}catch{return new Map();}};
  const featured=()=>{try{return studio?.featured?.()||'main';}catch{return 'main';}};
  const layers=()=>shot()?.propLayers||[];
  props.setLocked(()=>lockedKeys(layers()));
  // One undo step: the layer list change (and, with `also`, the hide edits that go with it).
  function setLayers(fn){commit(()=>{const list=structuredClone(layers());fn(list);shot().propLayers=cleanPropLayers({propLayers:list}).propLayers;},{render:false});}
  const find=(list,id)=>list.find(l=>l.id===id);
  const nameOf=key=>props.items().find(i=>i.key===key)?.name||'(not in the room)';
  function row(i,sel,inLayers,here=new Map()){
    const tag=inLayers.map(l=>`<i class="layer-tag" title="In layer ${escape(l.name)}">${escape(l.name)}</i>`).join('');
    let more='';
    if(extras()){
      const eye=rowEye(i,{featured:featured()}),studioHides=here.has(i.key);
      more=`${studioHides?`<small class="layer-flag studio" title="Studio hides it at ${escape(studio.setting?.()||'this chapter\'s time and size')}">Studio hides it</small>${i.hidden?'':`<button data-action="ly-studio-take" data-section="${escape(i.key)}" title="Hide it in this chapter too (the chapter's own hide edit; Undo brings it back)">Hide here too</button>`}`:''}<button class="layer-eye" data-action="ly-row-eye" data-section="${escape(i.key)}" aria-pressed="${!i.hidden}" ${eye.can?'':'disabled'} title="${escape(eye.can?(i.hidden?'Show it in this chapter':'Hide it in this chapter (the film matches)'):eye.why)}">${i.hidden?'Show':'Hide'}</button>`;
    }
    return `<li class="layer-item ${sel.has(i.key)?'selected':''} ${i.hidden?'is-hidden':''}" draggable="true" data-ly-item="${escape(i.key)}" title="${escape(i.target.label||i.name)}${i.area?' · '+escape(i.area):''} · click selects · Shift+click adds · Ctrl+click adds or removes · drag onto a layer"><span class="layer-name">${escape(i.name)}</span>${i.area&&!i.desk?`<small>${escape(i.area)}</small>`:''}${tag}${i.hidden?'<small class="layer-flag">hidden</small>':''}${more}</li>`;
  }
  function outline(){
    const q=search.trim().toLowerCase(),sel=new Set(props.selectedKeys()),all=props.items(),here=studioHere();
    const list=hiddenOnly(all,extras()&&onlyHidden).filter(i=>!q||i.name.toLowerCase().includes(q)||(i.area||'').toLowerCase().includes(q)||layerOf(layers(),i.key).some(l=>l.name.toLowerCase().includes(q)));
    if(!all.length)return '<p class="director-hint">Loading the chapter\'s props…</p>';
    if(!list.length)return '<p class="director-hint">Nothing matches that search.</p>';
    const byName=(a,b)=>a.name.localeCompare(b.name),desk=list.filter(i=>i.desk).sort(byName),areas=new Map();
    for(const i of list.filter(i=>!i.desk).sort(byName)){const a=i.area||'In the room';if(!areas.has(a))areas.set(a,[]);areas.get(a).push(i);}
    const section=(id,title,items)=>`<details class="layer-group" data-ly-group="${escape(id)}" ${closed.has(id)?'':'open'}><summary>${escape(title)} <small>${items.length}</small></summary><ul>${items.map(i=>row(i,sel,layerOf(layers(),i.key),here)).join('')}</ul></details>`;
    return (desk.length?section('desk','Desk items (the featured desk)',desk):'')+[...areas].sort(([a],[b])=>a==='In the room'?-1:b==='In the room'?1:a.localeCompare(b)).map(([a,items])=>section('room:'+a,areas.size>1?'Room props · '+a:'Room props',items)).join('');
  }
  function layerHtml(l){
    const sel=new Set(props.selectedKeys()),n=l.items.filter(k=>sel.has(k)).length;
    return `<li class="layer-row ${l.hidden?'is-hidden':''} ${l.locked?'is-locked':''}" data-ly-layer="${escape(l.id)}" title="Drop rows here to add them to this layer">
      <div class="layer-head"><input name="ly-rename" data-section="${escape(l.id)}" value="${escape(l.name)}" aria-label="Layer name" maxlength="60"><small>${l.items.length} item${l.items.length===1?'':'s'}${n?` · ${n} selected`:''}</small></div>
      <div class="layer-tools"><button data-action="ly-select" data-section="${escape(l.id)}" title="Select everything in this layer, then move it together">Select all</button>
      <button data-action="ly-eye" data-section="${escape(l.id)}" aria-pressed="${!l.hidden}" title="${l.hidden?'Show':'Hide'} the layer in this chapter (the film matches)">${l.hidden?'Hidden':'Visible'}</button>
      <button data-action="ly-lock" data-section="${escape(l.id)}" aria-pressed="${!!l.locked}" title="${l.locked?'Unlock: the view can pick these again':'Lock: the view can no longer pick these by clicking'}">${l.locked?'Locked':'Lock'}</button>
      <button data-action="ly-add" data-section="${escape(l.id)}" ${props.selectedKeys().length?'':'disabled'} title="Add the current selection to this layer">+ Selection</button>
      <button data-action="ly-del" data-section="${escape(l.id)}" title="Delete the layer (its items stay; a hidden layer's items are shown again)">Delete</button></div>
      <details><summary>${l.items.length?'Items':'Empty'}</summary><ul class="layer-members">${l.items.map(k=>`<li><span>${escape(nameOf(k))}</span><button data-action="ly-out" data-section="${escape(l.id)}|${escape(k)}" aria-label="Take ${escape(nameOf(k))} out of the layer" title="Take out of the layer">×</button></li>`).join('')}</ul></details></li>`;
  }
  function panel(){
    const n=props.selectedKeys().length,ls=layers();
    return `<h3>Layers</h3><p class="director-hint">Everything you can move in this chapter: the desk's items and the room's props. Click a row to select it and see where it is; Shift+click adds, Ctrl+click adds or removes. Group them into a layer to move, hide or lock them together.</p>
      <div class="layer-new"><input name="ly-name" placeholder="Layer name, e.g. Monitors" maxlength="60" aria-label="New layer name" value="${escape(newName)}"><button data-action="ly-create" class="primary" ${n?'':'disabled'} title="Make a layer from what is selected in the view or the list">New layer from selection${n?` (${n})`:''}</button><button data-action="pp-clear" ${n?'':'disabled'} title="Clear the selection (Esc)">Clear</button></div>
      <ul class="layer-list">${ls.length?ls.map(layerHtml).join(''):'<li class="director-hint">No layers yet. Select two or more things, name them, and press New layer from selection.</li>'}</ul>
      <label class="layer-search">Find<input type="search" name="ly-search" placeholder="Search props and layers" value="${escape(search)}"></label>
      ${extras()?(()=>{const n=showAllKeys(props.items()).length;return `<div class="layer-filters"><button data-action="ly-only-hidden" aria-pressed="${onlyHidden}" title="List only what is hidden in this chapter">Hidden only</button><button data-action="ly-show-all" ${n?'':'disabled'} title="Show everything hidden in this chapter (room desks excepted): one step, Undo hides them again">Show all in this chapter${n?` (${n})`:''}</button></div>`;})():''}
      <div class="layer-outline" data-ly-outline>${outline()}</div>`;
  }
  async function action(name,arg){
    // Layers phase 3 (the whole key in arg: a prop key may hold '|')
    if(name==='ly-only-hidden'){onlyHidden=!onlyHidden;rerender();return;}
    if(name==='ly-show-all'){const keys=showAllKeys(props.items());if(keys.length)props.hideItems(keys,false);rerender();return;}
    if(name==='ly-row-eye'||name==='ly-studio-take'){
      const item=props.items().find(x=>x.key===String(arg));if(!item){status('That item is not on the stage right now.',true);return;}
      const eye=rowEye(item,{featured:featured()});if(!eye.can){status(eye.why,true);return;}
      const hide=name==='ly-studio-take'?true:!item.hidden;
      // a room desk: the desk with its chair, its props and its user, one undo step (director.mjs studio.hideDesk)
      if(eye.desk){try{studio.hideDesk?.(item,eye.desk,hide);}catch(error){status(error.message,true);}rerender();return;}
      props.hideItems([item.key],hide);rerender();return;
    }
    const id=String(arg).split('|')[0],l=find(layers(),id);
    if(name==='ly-new'){return 'show';}
    if(name==='ly-create'){
      const keys=props.selectedKeys();if(!keys.length){status('Select something first (click it in the view or the list; Shift+click adds).',true);return;}
      const nm=newName.trim()||`Layer ${layers().length+1}`;newName='';
      setLayers(list=>{for(const x of list)x.items=x.items.filter(k=>!keys.includes(k));list.push({id:uid(),name:nm,items:keys});});
      status(`Layer "${nm}" made from ${keys.length} item${keys.length===1?'':'s'}. Select all in the layer to move them together.`);rerender();return;
    }
    if(!l)return;
    if(name==='ly-select'){const k=await props.selectKeys(l.items,'replace');if(!k)status('Nothing in that layer is in the room right now.',true);rerender();return;}
    if(name==='ly-eye'){
      const on=!l.hidden;props.hideItems(l.items,on,()=>{const x=find(layers(),id);const list=structuredClone(layers());const y=find(list,id);if(y){if(on)y.hidden=true;else delete y.hidden;}shot().propLayers=cleanPropLayers({propLayers:list}).propLayers;});
      rerender();return;
    }
    if(name==='ly-lock'){setLayers(list=>{const y=find(list,id);if(y){if(y.locked)delete y.locked;else y.locked=true;}});status(l.locked?`"${l.name}" unlocked.`:`"${l.name}" locked: its items can't be picked in the view.`);rerender();return;}
    if(name==='ly-add'){const keys=props.selectedKeys();if(!keys.length)return;addTo(id,keys);return;}
    if(name==='ly-del'){
      const drop=()=>{const list=layers().filter(x=>x.id!==id);shot().propLayers=cleanPropLayers({propLayers:list}).propLayers;};
      if(l.hidden)props.hideItems(l.items,false,drop);else setLayers(list=>{list.splice(list.findIndex(x=>x.id===id),1);});
      status(`Layer "${l.name}" deleted.`);rerender();return;
    }
    if(name==='ly-out'){const k=String(arg).slice(id.length+1);setLayers(list=>{const y=find(list,id);if(y)y.items=y.items.filter(x=>x!==k);});rerender();return;}
  }
  function addTo(id,keys){
    const l=find(layers(),id);if(!l)return;
    setLayers(list=>{for(const x of list)if(x.id!==id)x.items=x.items.filter(k=>!keys.includes(k));const y=find(list,id);y.items=[...new Set([...y.items,...keys])];});
    // A hidden layer hides what joins it (the film matches).
    if(l.hidden)props.hideItems(keys,true);
    status(`${keys.length} item${keys.length===1?'':'s'} added to "${l.name}".`);rerender();
  }
  function changed(el){
    if(el.name==='ly-rename'){const name=el.value.trim();if(!name){rerender();return;}setLayers(list=>{const y=find(list,el.dataset.section);if(y)y.name=name;});status(`Layer renamed "${name}".`);rerender();}
  }
  // ---- list interactions: rows (click + modifiers), search, drag onto a layer
  root.addEventListener('click',event=>{
    const r=event.target.closest('[data-ly-item]');if(!r||event.target.closest('button'))return;
    const key=r.dataset.lyItem;props.selectKeys([key],pickMode(event)).then(()=>{props.flashKey(key);});
  });
  root.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.name==='ly-name'){event.preventDefault();action('ly-create','').catch(error=>status(error.message,true));}});
  root.addEventListener('toggle',event=>{const d=event.target.closest?.('[data-ly-group]');if(!d)return;if(d.open)closed.delete(d.dataset.lyGroup);else closed.add(d.dataset.lyGroup);},true);
  root.addEventListener('input',event=>{
    if(event.target.name==='ly-name'){newName=event.target.value;return;}
    if(event.target.name!=='ly-search')return;search=event.target.value;const box=root.querySelector('[data-ly-outline]');if(box)box.innerHTML=outline();
  });
  let dragKeys=null;
  root.addEventListener('dragstart',event=>{
    const r=event.target.closest?.('[data-ly-item]');if(!r)return;const key=r.dataset.lyItem,sel=props.selectedKeys();
    dragKeys=sel.includes(key)?sel:[key];event.dataTransfer.setData('text/plain',dragKeys.join('\n'));event.dataTransfer.effectAllowed='copyMove';
  });
  root.addEventListener('dragover',event=>{if(dragKeys&&event.target.closest?.('[data-ly-layer]')){event.preventDefault();event.target.closest('[data-ly-layer]').classList.add('drop');}});
  root.addEventListener('dragleave',event=>event.target.closest?.('[data-ly-layer]')?.classList.remove('drop'));
  root.addEventListener('dragend',()=>{dragKeys=null;for(const e of root.querySelectorAll('.layer-row.drop'))e.classList.remove('drop');});
  root.addEventListener('drop',event=>{
    const row=event.target.closest?.('[data-ly-layer]');if(!row||!dragKeys)return;event.preventDefault();const keys=dragKeys;dragKeys=null;row.classList.remove('drop');addTo(row.dataset.lyLayer,keys);
  });
  return {panel,action,changed,layers};
}
