// The command search (Ctrl+P, Rhino's command line): type an action's name, a word of it, a Rhino command (m, ro,
// sc, zs, ze, top, front, right, persp, film) or a key; ↑/↓ pick, Enter runs, Esc closes. Enter on an empty search
// repeats the last command. Rows that need a selection say so and stay greyed.
import {searchActions,keyText} from './director-actions.mjs';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function createPalette({table=()=>undefined,live=()=>new Set(),run,last=()=>null,why=()=>null}){
  const el=document.createElement('div');el.className='df-palette';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-label','Command search');
  el.innerHTML=`<div class="df-palette-box"><input type="search" placeholder="Type a command: move, ro, zs, top, export…  (Enter on empty: repeat the last)" aria-label="Command" autocomplete="off" spellcheck="false"><ol role="listbox"></ol><p class="df-palette-foot">↑↓ choose · Enter run · Esc close · Rhino commands work too</p></div>`;
  document.body.append(el);
  const input=el.querySelector('input'),list=el.querySelector('ol');let rows=[],at=0;
  const usable=r=>{const ctx=r.ctx,l=live();return ['global','timeline','view'].includes(ctx)||l.has(ctx);};
  function render(){
    rows=searchActions(input.value,table());const recent=last();
    if(!input.value.trim()&&recent){const i=rows.findIndex(r=>r.id===recent);if(i>0)rows.unshift(...rows.splice(i,1));}
    rows=rows.slice(0,40);at=Math.min(at,Math.max(0,rows.length-1));
    list.innerHTML=rows.map((r,i)=>{const ok=usable(r),keys=r.keys.map(keyText).join(' / '),alias=(r.aliases||[]).slice(0,2).join(', ');
      return `<li role="option" data-i="${i}" aria-selected="${i===at}" class="${ok?'':'df-palette-off'}" title="${esc(ok?r.label:(why(r)||'Select the right kind of item first'))}"><span>${esc(r.label)}${r.id===recent&&!input.value.trim()?' <small>(last)</small>':''}</span><small>${esc(alias)}</small><kbd>${esc(keys)}</kbd></li>`;}).join('')||'<li class="df-palette-off">Nothing by that name. Press ? for the full list.</li>';
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
  }
  function open(){if(!el.hidden)return;el.hidden=false;input.value='';at=0;render();input.focus();}
  function close(){el.hidden=true;input.blur();}
  function go(i){
    const r=rows[i];
    if(!input.value.trim()&&last()&&i===0&&r?.id!==last()){close();run(last());return;}
    if(!r)return;if(!usable(r)){input.select();return;}close();run(r.id);
  }
  input.addEventListener('input',()=>{at=0;render();});
  input.addEventListener('keydown',ev=>{
    ev.stopPropagation();
    if(ev.key==='Escape'){ev.preventDefault();close();return;}
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ev.preventDefault();at=Math.max(0,Math.min(rows.length-1,at+(ev.key==='ArrowDown'?1:-1)));render();return;}
    if(ev.key==='Enter'){ev.preventDefault();if(!input.value.trim()&&last()){close();run(last());return;}go(at);return;}
    if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='p'){ev.preventDefault();close();}
  });
  list.addEventListener('mousemove',ev=>{const li=ev.target.closest('li[data-i]');if(li&&Number(li.dataset.i)!==at){at=Number(li.dataset.i);for(const x of list.children)x.setAttribute('aria-selected',String(x===li));}});
  list.addEventListener('click',ev=>{const li=ev.target.closest('li[data-i]');if(li)go(Number(li.dataset.i));});
  el.addEventListener('pointerdown',ev=>{if(ev.target===el)close();});
  return {open,close,toggle:()=>el.hidden?open():close(),isOpen:()=>!el.hidden,element:el};
}
