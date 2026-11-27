// The Director's Finish lane: where a desk version turns to its second look (the hero's gaming desk going Pearl White before the logo).
// A block per fade under the Desk versions lane: a ramp from `from` to `to` (drag its edges for when it starts and how long it takes,
// drag its body to shift it) and the held look after it. The Desk version tab has the numbers, the finishes, Add and Remove.
// Data and cleaning: finish-fades.mjs. The live view, Render still and the film follow it (player.mjs, desk-versions.mjs, the importer).
import {PRODUCT_CONFIG} from '../catalog.mjs';
import {effectiveFades,filmFades,edited as fadesEdited,newFade,looksOf,retime,MIN_FADE,PEARL} from './finish-fades.mjs';

export function createFinishLane({shot,versions,commit,endGroup,status,seek,rerender,showTab,isOpen,panel,escape,playhead,swatch}){
  let pickedN=null,drag=null,swallow=0;
  const fmt=x=>Number(Number(x).toFixed(2)),seconds=()=>shot()?.seconds||0;
  const list=()=>{try{return versions()||[];}catch{return [];}};
  const fades=()=>effectiveFades(shot(),list());
  const has=()=>list().length>0;
  const woods=PRODUCT_CONFIG.woodFinishes,bases=PRODUCT_CONFIG.baseFinishes;
  const colourOf=(table,name,fallback)=>table.find(f=>f.name===name)?.color||fallback;
  // What a desk looks like before its fade: its preset's own swatch.
  const baseSwatch=v=>v?.swatch||{wood:'#444',base:'#222',trim:'#888'};
  const pct=x=>Math.max(0,Math.min(100,x/(seconds()||1)*100));
  const fadeList=()=>list().filter(v=>fades()[v.n]).map(v=>({v,fade:fades()[v.n]}));
  const picked=()=>{const l=list(),f=fades();return l.find(v=>v.n===pickedN&&f[v.n])||l.find(v=>f[v.n])||null;};
  // ---- the lane
  function lane(){
    const l=list();if(!l.length)return '';
    const blocks=fadeList().map(({v,fade})=>{
      const [a,b]=fade.at,k=looksOf(fade),from=baseSwatch(v),toWood=colourOf(woods,k.wood,'#f4f3ef'),toBase=colourOf(bases,k.base,'#f8f8f8'),end=Math.max(b,Math.min(seconds(),v.end??seconds()));
      const name=k.wood||'Finish',tip=`Desk ${v.n} · ${v.label}: turns ${name} (${k.base||'frame'}, ${k.trim||'trim'}) from ${fmt(a)} to ${fmt(b)} s (${fmt(b-a)} s fade), then stays ${name} to ${fmt(end)} s. Drag the edges to change when it starts and how long it takes; drag the middle to shift it; click for the numbers.`;
      const sel=picked()?.n===v.n?' picked':'';
      return `<button type="button" class="finish-ramp${sel}" data-ff="${escape(v.n)}" style="left:${pct(a)}%;width:${Math.max(.4,pct(b)-pct(a))}%;--from:${from.wood};--to:${toWood}" title="${escape(tip)}" aria-label="${escape(tip)}"><i class="finish-h start" data-ff-h="start" aria-hidden="true"></i><i class="finish-h end" data-ff-h="end" aria-hidden="true"></i></button>`
        +(end>b+.01?`<button type="button" class="finish-held${sel}" data-ff="${escape(v.n)}" style="left:${pct(b)}%;width:${pct(end)-pct(b)}%;--to:${toWood};--base:${toBase};--trim:${escape(k.trim||'#f5f5f2')}" title="${escape(tip)}" aria-label="${escape(tip)}"><span class="desk-version-swatch" style="--wood:${toWood};--base:${toBase}"></span><strong>${escape(name)}</strong></button>`:'');
    }).join('');
    const empty=blocks?'':'<span class="finish-empty">No finish change here · + adds one to the desk under the playhead</span>';
    return `<div class="desk-lane-row finish-row" data-lane-color="finish"><span class="desk-lane-label" title="A desk turns to a second finish (the hero's gaming desk goes Pearl White before the logo). The picture cross-fades between the two looks over the ramp.">Finish <small data-finish-now></small><button type="button" class="lane-add" data-ff-add title="Add a white finish fade to the desk under the playhead, starting at the playhead" aria-label="Add a finish fade">+</button></span><div class="desk-lane finish-lane" role="group" aria-label="Finish changes over the chapter">${blocks}${empty}<div class="camera-track-playhead" data-shared-playhead style="left:0%"></div></div></div>`;
  }
  // ---- editing (one write path: the cut's finishFades list, seeded from the film's the first time)
  function write(mutate,text,{key=null}={}){
    commit(()=>{const s=shot();if(!fadesEdited(s))s.finishFades=structuredClone(filmFades(list()));mutate(s.finishFades);},{key});
    if(text)status(text);
  }
  const nowN=()=>{const l=list(),t=(playhead()||0)*seconds();return (l.find(v=>t<v.to)||l.at(-1))?.n;};
  function add(){
    const l=list();if(!l.length)return;
    const t=Math.max(0,Math.min(seconds()-MIN_FADE,(playhead()||0)*seconds())),v=l.find(x=>t<x.to)||l.at(-1);
    if(fades()[v.n]){status(`Desk ${v.n} · ${v.label} already has a finish fade (${fmt(fades()[v.n].at[0])}–${fmt(fades()[v.n].at[1])} s): drag it, or remove it first.`,true);pickedN=v.n;rerender();return;}
    const fade=newFade(v.setup||{},t,1.25);pickedN=v.n;
    write(s=>{s[v.n]=fade;},`Desk ${v.n} · ${v.label} turns Pearl White from ${fmt(fade.at[0])} to ${fmt(fade.at[1])} s. Drag its edges in the Finish lane, or change it in the Desk version tab. Undo takes it back.`);
    showTab('version');
  }
  function remove(n){
    const v=list().find(x=>x.n===n);if(!v||!fades()[n])return;
    write(s=>{delete s[n];},`Desk ${n}${v?` · ${v.label}`:''} keeps its own finish all the way: the fade is gone. Undo brings it back.`);
    rerender();
  }
  function reset(){commit(()=>{delete shot().finishFades;});rerender();status('Finish fades are back to the film’s.');}
  function setAt(n,part,value,{key}={}){
    const f=fades()[n];if(!f)return;
    const at=retime(f.at,part,value,seconds());if(at[0]===f.at[0]&&at[1]===f.at[1])return;
    write(s=>{s[n]={...s[n],at};},`Desk ${n} finish: ${fmt(at[0])}–${fmt(at[1])} s (${fmt(at[1]-at[0])} s fade).`,{key});
  }
  function setLook(n,patch){
    const f=fades()[n];if(!f)return;
    write(s=>{const set=structuredClone(s[n].set);set.deskFinish={...(set.deskFinish||PEARL),...patch};s[n]={...s[n],set};},`Desk ${n} finish look: ${[patch.wood,patch.base,patch.trim].filter(Boolean).join(' · ')}.`,{key:'ff-look-'+n});
    endGroup();
  }
  // ---- dragging on the lane
  const timeAt=event=>{const r=document.querySelector('#director-timeline .finish-lane')?.getBoundingClientRect();return r?Math.max(0,Math.min(seconds(),(event.clientX-r.left)/r.width*seconds())):0;};
  function down(event){
    if(event.button!==0)return;
    const block=event.target.closest?.('.finish-ramp[data-ff]'),handle=event.target.closest?.('[data-ff-h]');
    if(!block)return;
    const n=block.dataset.ff,f=fades()[n];if(!f)return;
    drag={n,part:handle?handle.dataset.ffH:'both',x:event.clientX,grab:timeAt(event)-f.at[0],moved:false,at:[...f.at]};
    if(handle)event.preventDefault();
    addEventListener('pointermove',move);addEventListener('pointerup',up,{once:true});addEventListener('pointercancel',up,{once:true});
  }
  function move(event){
    if(!drag)return;
    if(!drag.moved&&Math.abs(event.clientX-drag.x)<4)return;
    drag.moved=true;
    const t=timeAt(event);
    setAt(drag.n,drag.part,drag.part==='both'?t-drag.grab:t,{key:'ff-drag-'+drag.n});
  }
  function up(){
    removeEventListener('pointermove',move);const d=drag;drag=null;if(!d)return;
    if(d.moved){swallow=Date.now();endGroup();rerender();}
  }
  function click(event){
    const add_=event.target.closest?.('#director-timeline [data-ff-add]');if(add_){event.preventDefault();add();return;}
    const b=event.target.closest?.('#director-timeline [data-ff]');if(!b)return;
    if(Date.now()-swallow<400){event.preventDefault();return;}
    const n=b.dataset.ff,f=fades()[n];if(!f)return;event.preventDefault();
    pickedN=n;showTab('version');try{seek(Math.min(1,Math.max(0,f.at[0]/(seconds()||1))));}catch(error){status(error.message,true);}
  }
  // ---- the Desk version tab's section
  function panelHtml(){
    const l=list();if(!l.length)return '';
    const fl=fadeList(),v=picked(),f=v&&fades()[v.n],k=f?looksOf(f):null,total=seconds();
    const opt=(table,sel)=>table.map(x=>`<option value="${escape(x.name)}" ${x.name===sel?'selected':''}>${escape(x.name)}</option>`).join('')+(sel&&!table.some(x=>x.name===sel)?`<option value="${escape(sel)}" selected>${escape(sel)}</option>`:'');
    const here=l.find(x=>(playhead()||0)*total<x.to)||l.at(-1);
    return `<h3 class="finish-head">Finish fade <span class="inspector-subtitle">${fl.length?fl.map(x=>`Desk ${escape(x.v.n)}`).join(', '):'none'}</span></h3>
      <p class="director-hint">A desk turns to a second finish over a few seconds (the hero's gaming desk goes Pearl White before the logo). The picture cross-fades between the two looks; the desk's lights, LED and exposure come with the look. Drag the block in the Finish lane, or type the numbers here.</p>
      ${f?`<label class="build-desk">Desk<select name="ff-pick" aria-label="Desk with a finish fade">${fl.map(x=>`<option value="${escape(x.v.n)}" ${x.v.n===v.n?'selected':''}>${escape(x.v.n)} · ${escape(x.v.label)} · ${fmt(x.fade.at[0])}–${fmt(x.fade.at[1])} s</option>`).join('')}</select></label>
      <div class="build-desk-times"><label>Starts <input name="ff-start" type="number" step=".05" min="0" max="${total}" value="${fmt(f.at[0])}" aria-label="Finish fade starts (seconds)"> s</label><label>Fully changed <input name="ff-end" type="number" step=".05" min="0" max="${total}" value="${fmt(f.at[1])}" aria-label="Finish fade complete (seconds)"> s</label><label>Takes <input name="ff-len" type="number" step=".05" min="${MIN_FADE}" max="${total}" value="${fmt(f.at[1]-f.at[0])}" aria-label="Finish fade length (seconds)"> s</label></div>
      <label class="build-desk">Top finish<select name="ff-wood" aria-label="Finish of the desktop">${opt(woods,k.wood)}</select></label>
      <label class="build-desk">Frame<select name="ff-base" aria-label="Finish of the frame">${opt(bases,k.base)}</select></label>
      <label class="build-desk">Trim colour<input name="ff-trim" type="color" value="${/^#[0-9a-f]{6}$/i.test(k.trim)?k.trim:'#f5f5f2'}" aria-label="Trim colour"></label>`:'<p class="director-hint">No desk in this chapter has a finish fade right now.</p>'}
      <div class="director-actions desk-version-actions"><button type="button" data-ff-add title="Add a Pearl White fade to Desk ${escape(here?.n||'')} starting at the playhead" ${here&&!fades()[here.n]?'':'disabled'}>+ Finish fade on Desk ${escape(here?.n||'')}</button>${f?`<button type="button" data-ff-remove="${escape(v.n)}">Remove Desk ${escape(v.n)}'s fade</button>`:''}<button type="button" data-ff-reset ${fadesEdited(shot())?'':'disabled'} title="Back to the finish fades the film has (the hero ending). One Undo takes it back.">Reset to the film</button></div>`;
  }
  function onChange(event){
    const t=event.target;if(!panel||!panel.contains(t)||!t.name?.startsWith('ff-'))return;
    const n=picked()?.n;if(!n)return;
    if(t.name==='ff-pick'){pickedN=t.value;rerender();const f=fades()[t.value];if(f)seek(Math.min(1,f.at[0]/(seconds()||1)));}
    else if(t.name==='ff-start'){setAt(n,'start',Number(t.value));endGroup();rerender();}
    else if(t.name==='ff-end'){setAt(n,'end',Number(t.value));endGroup();rerender();}
    else if(t.name==='ff-len'){const f=fades()[n];if(f)setAt(n,'end',f.at[0]+Math.max(MIN_FADE,Number(t.value)||MIN_FADE));endGroup();rerender();}
    else if(t.name==='ff-wood')setLook(n,{wood:t.value});
    else if(t.name==='ff-base')setLook(n,{base:t.value});
    else if(t.name==='ff-trim')setLook(n,{trim:t.value});
  }
  function onClick(event){
    const b=event.target.closest?.('[data-ff-add],[data-ff-remove],[data-ff-reset]');if(!b||!panel.contains(b)||b.disabled)return;
    if(b.matches('[data-ff-add]'))add();else if(b.matches('[data-ff-remove]'))remove(b.dataset.ffRemove);else reset();
  }
  if(panel){panel.addEventListener('change',onChange);panel.addEventListener('click',onClick);}
  document.addEventListener('pointerdown',event=>{if(event.target.closest?.('#director-timeline'))down(event);});
  // The playhead moved: say which desk it is on in the lane label (like the Desk versions lane).
  function sync(){const el=document.querySelector('#director-timeline [data-finish-now]');if(!el)return;const n=nowN(),f=n&&fades()[n];const text=f?`${n} → ${looksOf(f).wood||'finish'}`:'';if(el.textContent!==text)el.textContent=text;}
  return {lane,click,panel:panelHtml,sync,has,add,remove,reset,list:fadeList,fades,select:n=>{pickedN=n;}};
}
