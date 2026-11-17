const draggableSelector='[data-graphic-clip],[data-title-clip],[data-desk-clip],[data-key],[data-light-clip],[data-light-key],[data-tod-key],[data-sk]';
const itemSelector='[data-graphic-clip],[data-title-clip],[data-desk-clip],[data-key],[data-light-clip],[data-light-key],[data-tod-key],[data-sk],[data-prop-key],[data-person-key],[data-choreo-clip]';
const n=v=>Number(v.toFixed(2)),seconds=v=>`${n(v)} s`;
export function timelineHint(el,{seconds:duration,graphic}={},title=''){
  const kind=el.matches('[data-graphic-clip]')?'Graphics':el.matches('[data-title-clip]')?'Title':el.matches('[data-desk-clip],[data-choreo-clip]')?'Desk motion':el.matches('[data-key]')?'Camera':el.matches('[data-light-clip],[data-light-key],[data-tod-key]')?'Lighting':el.matches('[data-sk],[data-person-key]')?'People':el.matches('[data-prop-key]')?'Props':null;
  const lines=[];if(title)lines.push(title);
  const left=el.style.left,width=el.style.width;
  if(kind&&Number.isFinite(duration)&&left.endsWith('%')){
    const a=parseFloat(left)*duration/100,b=width.endsWith('%')?a+parseFloat(width)*duration/100:a;
    lines.unshift(b>a?`Timeline ${seconds(a)} → ${seconds(b)} · Duration ${seconds(b-a)}`:`Time ${seconds(a)}`);
    if(graphic){const rate=Number(graphic.rate??1),offset=Number(graphic.offset)||0;lines.push(`Source ${seconds(offset)} → ${seconds(offset+(b-a)*rate)} (before loop/hold) · ${rate}× · ${graphic.loop===false?'Hold at source end':'Loop'}`);}
  }
  if(el.matches('[data-graphic-clip]'))lines.push('Drag: move · Edges: trim / extend · Ctrl/Cmd+K: split at playhead');
  else if(el.matches('[data-title-clip]'))lines.push('Drag: move · Edges: trim · Alt+←/→: nudge one frame · Shift: ×10 · Enter: inspector');
  else if(el.matches('[data-desk-clip]'))lines.push('Drag: move · Edges: resize · Alt+←/→: nudge one frame · Shift: ×10 · Delete: remove');
  else if(el.matches('[data-key]'))lines.push('Drag: retime · Alt+←/→: nudge one frame · Shift: ×10 · Delete: remove');
  else if(el.matches('[data-light-clip]'))lines.push('Click: inspector · Drag: move · Edges: trim · Delete: remove');
  else if(el.matches('[data-light-key],[data-tod-key]'))lines.push('Click: inspector · Drag: retime · Delete: remove');
  else if(el.matches('[data-prop-key],[data-person-key]'))lines.push('Click: select and open inspector');
  else if(el.matches('[data-sk]'))lines.push('Drag: retime character keyframe');
  else if(el.matches('[data-choreo-clip]'))lines.push('Click: open this desk’s movement editor');
  if(el.matches('[data-graphic-clip],[data-title-clip],[data-desk-clip],[data-key],[data-light-clip],[data-light-key],[data-tod-key]'))lines.push('Alt while dragging: bypass snap');
  const action=el.dataset.action||el.dataset.graphicAction||el.dataset.deskAction;
  const controls={'key-add':['Add camera view','Capture a camera keyframe at the current playhead.'],'pp-add':['Add prop','Open the prop library for this chapter.'],'light-add':['Add lighting key','Add a lighting state at the playhead. Shift+click adds a white-light key.'],split:['Split graphic','Ctrl/Cmd+K · Cut the selected graphic at the playhead. Both pieces keep their source timing.'],'chapter-toggle':['Play / pause chapter','Space · Toggle chapter playback.'],'zoom-in':['Zoom in','+ · Show more timeline detail.'],'zoom-out':['Zoom out','− · Show more chapter time.'],magnet:['Magnet snapping','Snap to nearby times while dragging. Hold Alt to bypass snapping.'],'group-toggle':['Timeline group','Click to expand or collapse these lanes.']};
  let control=controls[action];
  if(el.matches('.time-ruler'))control=['Seek in chapter','Click or drag the ruler to move the playhead. Alt bypasses snapping.'];
  if(el.matches('.timeline-resize'))control=['Timeline height','Drag to resize · Double-click to fit/reset · ↑/↓ when focused to resize.'];
  if(el.matches('[name="timeline-snap"]'))control=['Snap interval','Choose the timing increment for timeline edits. Alt bypasses snapping while dragging.'];
  if(control){lines.unshift(control[1]);return {heading:control[0],lines};}
  if(!lines.length)lines.push('Click to '+(el.textContent.trim()||'use this control').toLowerCase()+'.');
  return {heading:kind||el.getAttribute('aria-label')||el.textContent.trim()||'Timeline control',lines};
}
// The timeline's ⌨ button opens the Director's shortcut panel (keys-panel.mjs; also ?, F1 or Ctrl+Alt+K).
export const timelineShortcuts=()=>`<button type="button" class="timeline-shortcuts" data-action="keys-panel" title="Every key and mouse gesture (?)">⌨ Shortcuts</button>`;
export function createTimelineHints({root,context=()=>({}),active=()=>new Set()}){
  const tip=document.createElement('div');tip.className='timeline-tooltip';tip.id='timeline-tooltip-'+Math.random().toString(36).slice(2);tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);
  let current=null,drag=null,timer=null,point={x:0,y:0},restore=[],described=null,frame=0;
  function hide(){clearTimeout(timer);tip.hidden=true;for(const [el,title] of restore)el.setAttribute('title',title);restore=[];if(described){const ids=(described.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!==tip.id);if(ids.length)described.setAttribute('aria-describedby',ids.join(' '));else described.removeAttribute('aria-describedby');described=null;}}
  function position(){const r=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-r.width-8,point.x+16))+'px';tip.style.top=Math.max(8,point.y+r.height+25>innerHeight?point.y-r.height-16:point.y+22)+'px';}
  function show(el,live=false){
    if(!el?.isConnected||root.hidden){hide();return;}
    const ctx=context(el),saved=restore.find(([x])=>x===el)?.[1]||el.getAttribute('title')||el.getAttribute('aria-label')||'';
    if(drag&&ctx.graphic){ctx.graphic={...ctx.graphic};if(drag.edge==='start')ctx.graphic.offset=Number(ctx.graphic.offset||0)+(parseFloat(el.style.left)-drag.left)*ctx.seconds/100*Number(ctx.graphic.rate??1);}
    const info=timelineHint(el,ctx,saved);tip.replaceChildren();const head=document.createElement('strong');head.textContent=live?(drag.edge?'Trim '+drag.edge:'Move')+' · '+info.heading:info.heading;tip.append(head);
    for(const line of info.lines){const p=document.createElement('div');p.textContent=line;tip.append(p);}
    if(live&&Number.isFinite(drag.left)&&el.style.left.endsWith('%')){const delta=(parseFloat(el.style.left)-drag.left)*ctx.seconds/100;const end=(parseFloat(el.style.left)+parseFloat(el.style.width||'0'))*ctx.seconds/100;const change=drag.edge==='end'?end-drag.end:delta;const p=document.createElement('div');p.className='timeline-tooltip-change';p.textContent=`${drag.edge?'Trim':'Move'} ${change>=0?'+':''}${seconds(change)} · Release to apply`;tip.append(p);}
    if(described!==el){if(described)hide();described=el;const old=el.getAttribute('aria-describedby');el.setAttribute('aria-describedby',[old,tip.id].filter(Boolean).join(' '));}
    tip.hidden=false;position();
  }
  function target(event){const el=event.target.closest?.(itemSelector+',button,summary[title],.time-ruler,.timeline-resize,[name="timeline-snap"]');return el&&root.contains(el)?el:null;}
  function suppress(el){for(let node=el;node&&node!==root;node=node.parentElement)if(node.hasAttribute('title')){restore.push([node,node.getAttribute('title')]);node.removeAttribute('title');}}
  root.addEventListener('pointerover',event=>{if(drag||event.pointerType==='touch')return;const el=target(event);if(!el||el===current)return;hide();current=el;suppress(event.target.closest('[title]')||el);point={x:event.clientX,y:event.clientY};timer=setTimeout(()=>show(el),300);});
  root.addEventListener('pointerout',event=>{if(drag)return;if(current&&!current.contains(event.relatedTarget)){hide();current=null;}});
  root.addEventListener('focusin',event=>{if(drag)return;const el=target(event);if(!el)return;hide();current=el;suppress(el);const r=el.getBoundingClientRect();point={x:r.left,y:r.bottom};show(el);});
  root.addEventListener('focusout',()=>{if(!drag){hide();current=null;}});
  document.addEventListener('pointerdown',event=>{const el=event.target.closest?.(draggableSelector);hide();current=null;if(!el||!root.contains(el)||event.button!==0)return;const ctx=context(el);drag={el,x:event.clientX,y:event.clientY,left:parseFloat(el.style.left),end:(parseFloat(el.style.left)+parseFloat(el.style.width||'0'))*ctx.seconds/100,edge:event.target.closest('[data-graphic-edge],[data-resize]')?.dataset.graphicEdge||event.target.closest('[data-resize]')?.dataset.resize};suppress(el);},true);
  document.addEventListener('pointermove',event=>{point={x:event.clientX,y:event.clientY};if(drag&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>3){document.body.classList.add('timeline-rich-drag');cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>drag&&show(drag.el,true));}else if(!tip.hidden&&!drag)position();},true);
  function finish(){cancelAnimationFrame(frame);drag=null;document.body.classList.remove('timeline-rich-drag');hide();}
  document.addEventListener('pointerup',finish,true);document.addEventListener('pointercancel',finish,true);addEventListener('blur',finish);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')finish();},true);
  root.addEventListener('scroll',()=>{if(!drag)hide();},true);
  return {hide:finish};
}
