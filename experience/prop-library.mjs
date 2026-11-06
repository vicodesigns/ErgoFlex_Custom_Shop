// Director "+ Add prop": the whole prop library as a searchable grid. The models are Studio's (assets/props/index.json
// read through Studio's own PROP_LIBRARY in the stage, tools/experience/film-edits.mjs propLibrary) with Studio's
// thumbnails (assets/props/thumbs/<id>.png, as studio.js renderSceneAssetLibrary shows them).
// Search box (name, id, category, collection), category chips, "Fits this room" (the entry's scenes), recently used
// on top. Keyboard: type to search, arrows move, Enter adds, Esc closes. Picking calls onPick(entry); the caller
// places it (scene-prop-editor.mjs addProp). Styles: prop-library.css (its own file, linked once).
const RECENT_KEY='ergoflex.director.recentProps',RECENT_MAX=12;
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
// 78 × 12 × 147 mm -> "7.8 × 1.2 × 14.7 cm"; a metre or more -> "1.2 × 0.8 × 2 m" (width × height × depth).
export function sizeText(size){
  if(!Array.isArray(size)||size.length!==3)return '';
  const big=Math.max(...size)>=1000,f=v=>big?Number((v/1000).toFixed(2)):Number((v/10).toFixed(1));
  return `${size.map(f).join(' × ')} ${big?'m':'cm'}`;
}
// Desk-top items: small things that stand (not furniture, architecture, people…), at most 60 cm across.
const NOT_DESK=new Set(['furniture','architecture','environment','industrial','people','pets','fitness','space']);
export const deskItem=e=>!!e&&['floor','surface'].includes(e.anchor||'floor')&&!NOT_DESK.has(e.category)&&Array.isArray(e.size)&&Math.max(...e.size)<=600;
export function recentIds(){try{const v=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,RECENT_MAX):[];}catch{return [];}}
export function pushRecent(id){try{localStorage.setItem(RECENT_KEY,JSON.stringify([id,...recentIds().filter(x=>x!==id)].slice(0,RECENT_MAX)));}catch{}}
// Filtering (pure, tested): every word of the query in the name / id / category / collection.
export function filterEntries(entries,{query='',category='all',room=null,fits=false}={}){
  const words=query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(e=>(category==='all'||e.category===category)&&(!fits||!room||(e.scenes||[]).includes(room))&&(!words.length||(()=>{const hay=`${e.name} ${e.id} ${e.category} ${e.collection||''}`.toLowerCase();return words.every(w=>hay.includes(w));})()));
}
let linked=false;
function linkStyles(){if(linked)return;linked=true;const l=document.createElement('link');l.rel='stylesheet';l.href=new URL('./prop-library.css',import.meta.url).href;document.head.append(l);}
export function createPropLibrary({load,room,roomName=()=>room(),onPick,status=()=>{}}){
  linkStyles();
  let entries=null,loading=null,query='',category='all',fits=false,active=0,shown=[];
  const dialog=document.createElement('dialog');dialog.id='prop-library';dialog.setAttribute('aria-labelledby','prop-library-title');document.body.append(dialog);
  const thumb=e=>`/assets/props/thumbs/${encodeURIComponent(e.id)}.png${e.triangleFinish?'?v=table-clearance-20261021':''}`;
  const card=(e,i)=>`<button type="button" class="pl-card" role="option" id="pl-opt-${i}" data-pl-index="${i}" aria-selected="${i===active}" title="${escape(e.name)} · ${escape(e.id)}${e.collection?' · '+escape(e.collection):''}"><img src="${thumb(e)}" alt="" loading="lazy" decoding="async" onerror="this.classList.add('pl-nothumb')"><span class="pl-name">${escape(e.name)}</span><small>${escape(sizeText(e.size))} · ${escape(e.category)}${deskItem(e)?' · on the desk':''}</small></button>`;
  function frame(){
    dialog.innerHTML=`<div class="director-heading"><div><span class="director-kicker">ADD PROP</span><h2 id="prop-library-title">Prop library</h2></div><button type="button" class="pl-close" data-pl-close aria-label="Close the prop library">×</button></div>
      <div class="pl-filters"><input type="search" name="pl-search" placeholder="Search ${entries?entries.length+' ':''}models…" aria-label="Search the prop library" autocomplete="off" spellcheck="false" role="combobox" aria-controls="pl-results" aria-expanded="true"><label class="director-check"><input type="checkbox" name="pl-fits" ${fits?'checked':''}>Fits this room <small>(${escape(roomName()||'this room')})</small></label></div>
      <div class="pl-chips" role="group" aria-label="Category" data-pl-chips></div>
      <p class="director-hint pl-count" data-pl-count aria-live="polite"></p>
      <div class="pl-scroll" id="pl-results" role="listbox" aria-label="Library models" data-pl-results></div>
      <p class="director-hint pl-keys">Type to search · ←↑→↓ move · Enter adds · Esc closes. Desk-sized items go on the desktop under the screen centre; the rest on the floor in front of the camera.</p>`;
  }
  function chips(){
    const counts=new Map();for(const e of filterEntries(entries,{room:room(),fits}))counts.set(e.category,(counts.get(e.category)||0)+1);
    const cats=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));if(category!=='all'&&!counts.has(category))cats.push([category,0]);
    dialog.querySelector('[data-pl-chips]').innerHTML=[['all',[...counts.values()].reduce((a,b)=>a+b,0)],...cats].map(([c,n])=>`<button type="button" class="lamp-chip pl-chip" data-pl-category="${escape(c)}" aria-pressed="${c===category}">${c==='all'?'All':escape(cap(c))} <small>${n}</small></button>`).join('');
  }
  function list(){
    const r=room(),hits=filterEntries(entries,{query,category,room:r,fits}),byId=new Map(entries.map(e=>[e.id,e]));
    const recent=query?[]:filterEntries(recentIds().map(id=>byId.get(id)).filter(Boolean),{category,room:r,fits});
    shown=[...recent,...hits];active=Math.min(active,Math.max(0,shown.length-1));
    const box=dialog.querySelector('[data-pl-results]');
    box.innerHTML=(recent.length?`<h3>Recently used</h3><div class="pl-grid" data-pl-grid>${recent.map((e,i)=>card(e,i)).join('')}</div><h3>All models</h3>`:'')+
      (hits.length?`<div class="pl-grid" data-pl-grid>${hits.map((e,i)=>card(e,i+recent.length)).join('')}</div>`:`<p class="director-hint">No models match${query?` “${escape(query)}”`:''}${fits?' in this room (untick Fits this room to search the whole library)':''}.</p>`);
    dialog.querySelector('[data-pl-count]').textContent=`${hits.length} of ${entries.length} models${fits?' that fit this room':''}${category!=='all'?' · '+cap(category):''}`;
    sync(false);
  }
  function sync(scroll=true){
    const input=dialog.querySelector('[name=pl-search]');
    for(const el of dialog.querySelectorAll('.pl-card'))el.setAttribute('aria-selected',String(Number(el.dataset.plIndex)===active));
    const el=dialog.querySelector(`#pl-opt-${active}`);input?.setAttribute('aria-activedescendant',el?el.id:'');if(el&&scroll)el.scrollIntoView({block:'nearest'});
  }
  // Up / Down: the card in the next row above / below (across the Recently used and All grids) nearest in x.
  function move(key){
    if(!shown.length)return;const n=shown.length;
    if(key==='ArrowRight')active=Math.min(n-1,active+1);else if(key==='ArrowLeft')active=Math.max(0,active-1);else if(key==='Home')active=0;else if(key==='End')active=n-1;
    else{
      const cards=[...dialog.querySelectorAll('.pl-card')],at=dialog.querySelector(`#pl-opt-${active}`)?.getBoundingClientRect();if(!at)return;
      const down=key==='ArrowDown',rows=cards.map(c=>[c,c.getBoundingClientRect()]).filter(([,r])=>down?r.top>at.top+4:r.top<at.top-4);
      if(rows.length){const y=down?Math.min(...rows.map(([,r])=>r.top)):Math.max(...rows.map(([,r])=>r.top)),row=rows.filter(([,r])=>Math.abs(r.top-y)<4);
        active=Number(row.reduce((a,b)=>Math.abs(b[1].left-at.left)<Math.abs(a[1].left-at.left)?b:a)[0].dataset.plIndex);}
    }
    sync();
  }
  function pick(i){const e=shown[i];if(!e)return;pushRecent(e.id);dialog.close();onPick(e);}
  async function open(){
    if(!entries){status('Loading the prop library…');try{entries=await(loading||=load());}catch(error){loading=null;status('The prop library could not load: '+error.message,true);return;}
      entries=[...entries].sort((a,b)=>a.name.localeCompare(b.name));}
    query='';active=0;frame();chips();list();
    if(!dialog.open)dialog.showModal();const input=dialog.querySelector('[name=pl-search]');input.focus();
    status(`Prop library: ${entries.length} models. Type to search, arrows to move, Enter adds.`);
  }
  dialog.addEventListener('input',event=>{if(event.target.name==='pl-search'){query=event.target.value.trim();active=0;list();}});
  dialog.addEventListener('change',event=>{if(event.target.name==='pl-fits'){fits=event.target.checked;active=0;chips();list();dialog.querySelector('[name=pl-search]').focus();}});
  dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-pl-close]')){dialog.close();return;}
    const chip=event.target.closest('[data-pl-category]');if(chip){category=chip.dataset.plCategory;active=0;chips();list();dialog.querySelector('[name=pl-search]').focus();return;}
    const c=event.target.closest('.pl-card');if(c)pick(Number(c.dataset.plIndex));
  });
  // Clicks on the backdrop close it.
  dialog.addEventListener('pointerdown',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();   // keys inside the browser never reach the Director (Delete, W/E/T, R…)
    const input=dialog.querySelector('[name=pl-search]');
    if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)||((event.key==='Home'||event.key==='End')&&event.target!==input)){
      if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&event.target===input&&input.value&&!(event.key==='ArrowRight'&&input.selectionStart===input.value.length))return;   // caret moves in the text
      event.preventDefault();move(event.key);return;
    }
    if(event.key==='Enter'){if(event.target.closest?.('[data-pl-category],[data-pl-close]'))return;event.preventDefault();const c=event.target.closest?.('.pl-card');pick(c?Number(c.dataset.plIndex):active);return;}
    // Type to search from anywhere in the browser.
    if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.target!==input&&event.target.type!=='checkbox'){input.focus();}
    else if(event.key==='Backspace'&&event.target!==input){input.focus();}
  });
  dialog.addEventListener('keyup',event=>event.stopPropagation());
  return {open,close:()=>dialog.open&&dialog.close(),isOpen:()=>dialog.open,element:dialog};
}
