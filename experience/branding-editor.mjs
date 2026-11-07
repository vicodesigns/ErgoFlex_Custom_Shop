import {ARTWORK_SURFACES} from '../artwork-config.mjs';
import {isSchoolRoom,effectiveBranding,setBrandingEdit,brandingElements,brandingCount,surfaceLabel} from './branding-edits.mjs';
import {roomDesks,surfaceSizes} from './branding-live.mjs';
// Director "Branding" (a tab in rooms with school stickers / logos: library, college, high school …). The branding
// elements of a desk are listed; the selected one gets its surface, position, width, turn and show / hide in inches
// and degrees, with a preview of the surface to drag it on. ONE edit changes every desk of the room (branding is the
// same on all of them): the chapter's shot.brandingEdits (branding-edits.mjs) is a sparse overlay on each desk's own
// artwork, which film-fx installs on the live stage and in the film (branding-live.mjs). Studio is never written.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
const clampN=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function createBrandingEditor({bridge,shot,film,commit,status,open,rerender,selection=()=>null}){
  let ref=null,selId=null,sizes=new Map(),sizing=null,drag=null,images=new Map(),dragLive=null,lastCommit=0;
  const win=()=>document.getElementById('stage')?.contentWindow||null;
  const available=()=>isSchoolRoom(shot()?.room);
  const edits=()=>effectiveBranding(film(),shot());
  const editedCount=()=>brandingCount(edits());
  const info=()=>{try{return win()?.ErgoFlex?.sceneDesks?roomDesks(win()):{room:null,desks:[]};}catch{return {room:null,desks:[]};}};
  // The desk the list is read from: the chosen one, else the first with branding (featured first).
  function refDesk(i){
    const withArt=i.desks.filter(d=>brandingElements(d.base).length);
    // The Desks tab's selection (director.mjs selectRoomDesk) leads; no selection = the featured desk. The temporary picker below is for a selected desk without graphics.
    const want=selection(),led=want&&withArt.find(d=>d.id===want);if(led)return led;
    return i.desks.find(d=>d.id===ref&&brandingElements(d.base).length)||withArt.find(d=>d.selected)||withArt.find(d=>d.primary)||withArt[0]||null;
  }
  function ensureSizes(desk){
    if(!desk||sizes.has(desk.size)||sizing)return;
    sizing=surfaceSizes(win(),desk.size).then(s=>{if(s)sizes.set(desk.size,s);}).catch(e=>console.warn('[branding] sizes',e)).finally(()=>{sizing=null;if(open()&&sizes.has(desk.size))rerender();});
  }
  const view=(el,e)=>{ // the element as it stands with the chapter's edit
    const x=e?.artwork?.surfaces?.[el.surface]?.[el.key];
    return {surface:x?.surface||el.surface,enabled:x?.enabled??el.layer.enabled,x:x?.x??el.layer.x,y:x?.y??el.layer.y,scale:x?.scale??el.layer.scale,rotation:x?.rotation??el.layer.rotation,edited:!!x};
  };
  const label=el=>`${surfaceLabel(el.surface)} · ${el.layer.name||el.key}`;
  function write(el,fields,text,{key=null}={}){
    const i=info();
    commit(()=>{shot().brandingEdits=setBrandingEdit(edits(),i.room||shot().room,el.surface,el.key,el.layer,fields);},{key:key||'branding-'+el.id,render:false});
    if(text)status(text);
  }
  function image(src,redraw){
    if(!images.has(src)){const im=new Image();im.onload=()=>redraw();im.src=src;images.set(src,im);}
    return images.get(src);
  }
  // ---- the preview of the selected graphic's surface: the studio's placement preview (paintArtworkLayer's math)
  function draw(canvas){
    const i=info(),d=refDesk(i);if(!canvas||!d)return;
    const e=edits(),els=brandingElements(d.base),sel=els.find(x=>x.id===selId);if(!sel)return;
    const v=dragLive&&dragLive.id===sel.id?{...view(sel,e),...dragLive.fields}:view(sel,e),sid=v.surface;
    const dims=sizes.get(d.size)?.[sid]||[40,20],ratio=dims[0]/dims[1];
    const W=canvas.clientWidth||320,H=Math.max(40,Math.round(W/ratio));
    if(canvas.width!==W*2||canvas.height!==H*2){canvas.width=W*2;canvas.height=H*2;canvas.style.height=H+'px';}
    const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    c.clearRect(0,0,w,h);c.fillStyle='#2b2f36';c.fillRect(0,0,w,h);
    c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=1;for(let k=1;k<4;k++){c.beginPath();c.moveTo(w*k/4,0);c.lineTo(w*k/4,h);c.moveTo(0,h*k/4);c.lineTo(w,h*k/4);c.stroke();}
    // Every graphic that ends up on this surface (the other desk-surface graphics too, so the placement reads), the selected one outlined.
    const here=[];
    for(const el of els){const vv=el.id===sel.id?v:view(el,e);if(vv.surface===sid&&vv.enabled!==false)here.push([el,vv]);}
    for(const [el,vv] of here){
      const im=image(el.layer.image,()=>draw(canvas)),cw=w*vv.scale/100;
      c.save();c.translate(w*vv.x/100,h*vv.y/100);c.rotate(vv.rotation*Math.PI/180);
      if(im.complete&&im.naturalWidth){const ch=cw*im.naturalHeight/im.naturalWidth;if(el.layer.backing==='white-disc'){c.fillStyle='#fff';c.beginPath();c.ellipse(0,0,cw*.442,ch*.452,0,0,Math.PI*2);c.fill();}c.globalAlpha=(el.layer.opacity??100)/100;c.drawImage(im,-cw/2,-ch/2,cw,ch);c.globalAlpha=1;
        if(el.id===sel.id){c.strokeStyle='#ffb800';c.lineWidth=2;c.strokeRect(-cw/2,-ch/2,cw,ch);}}
      else{c.strokeStyle='#ffb800';c.strokeRect(-cw/2,-cw/8,cw,cw/4);}
      c.restore();
    }
  }
  // ---- panel
  function panel(){
    if(!available())return '';
    const i=info(),d=refDesk(i),e=edits(),n=editedCount();
    const head=`<h3>Branding</h3><p class="director-hint">The school stickers and logos on the desks. One change here updates <b>every desk in this room</b>${i.desks.length?` (${i.desks.length} desk${i.desks.length===1?'':'s'})`:''} in this chapter. Studio is not changed.</p>`;
    if(!d)return head+`<p class="director-hint">${i.desks.length?'No desk in this room has school graphics yet.':'Loading the chapter…'}</p>`;
    const els=brandingElements(d.base);
    if(!els.some(x=>x.id===selId))selId=els[0]?.id||null;
    const sel=els.find(x=>x.id===selId),v=sel&&view(sel,e);
    ensureSizes(d);
    const dims=v&&sizes.get(d.size)?.[v.surface]||null;
    const same=i.desks.filter(x=>x.size===d.size&&brandingElements(x.base).length).length;
    const chips=els.map(el=>{const vv=view(el,e);return `<button class="lamp-chip prop-chip ${vv.enabled===false?'prop-hidden':''} ${el.id===selId?'selected':''}" data-action="br-pick" data-section="${escape(el.id)}" title="${escape(label(el))}${vv.edited?' · edited':''}">${escape(el.layer.name||el.key)} <small>${escape(surfaceLabel(vv.surface))}${vv.edited?' •':''}</small></button>`;}).join('');
    const num=(name,text,value,step,extra='')=>`<label>${text}<input name="${name}" type="number" step="${step}" value="${value}" ${extra} ${dims?'':'disabled'}></label>`;
    let form='';
    if(sel){
      const W=dims?.[0]||0,H=dims?.[1]||0;
      form=`<div class="movement-inspector prop-inspector" data-reveal="branding"><h4 title="${escape(sel.layer.name)}">${escape(sel.layer.name||sel.key)}</h4>
        <label>Surface<select name="br-surface">${ARTWORK_SURFACES.map(s=>`<option value="${s.id}" ${s.id===v.surface?'selected':''}>${escape(s.label)}</option>`).join('')}</select></label>
        <p class="director-hint">${dims?`That surface is about ${dims[0]} × ${dims[1]} in. Drag the graphic below, or type its place.`:'Measuring the surface…'}</p>
        <canvas class="branding-preview" data-branding-preview aria-label="Surface preview. Drag the graphic to move it." style="width:100%;border-radius:6px;touch-action:none;cursor:grab;display:block"></canvas>
        <div class="director-grid">${num('br-across','Across (in, from the left edge)',dims?r1(v.x/100*W):'',.1)}${num('br-down','Down (in, from the top edge)',dims?r1(v.y/100*H):'',.1)}</div>
        <div class="director-grid">${num('br-width','Width (in)',dims?r1(v.scale/100*W):'',.1,'min=".1"')}${num('br-rot','Turn (°)',r1(v.rotation),1,'min="-180" max="180"')}</div>
        <label class="director-check"><input type="checkbox" name="br-show" ${v.enabled===false?'':'checked'}>Show this graphic</label>
        <div class="director-actions"><button data-action="br-center" ${dims?'':'disabled'}>Center on the surface</button><button data-action="br-reset" ${v.edited?'':'disabled'} title="This graphic back to where the desks have it">Reset this graphic</button></div></div>`;
    }
    const followed=!!selection()&&selection()===d.id;
    const picker=followed?`<p class="director-hint">Showing the desk selected in the Desks tab.</p>`:`<label>Desk shown<select name="br-desk">${i.desks.filter(x=>brandingElements(x.base).length).map(x=>`<option value="${escape(x.id)}" ${x.id===d.id?'selected':''}>${escape(x.name)} · ${escape(x.size.replace('x30','″').replace(/x\d+$/,'″'))}</option>`).join('')}</select></label>`;
    return head+picker+`
      <p class="director-hint">Graphics on this desk (${same} desk${same===1?'':'s'} of this size carry them; the rest of the room follows where it has the same graphic).</p>
      <div class="prop-chips">${chips}</div>${form}
      <div class="director-actions"><button data-action="br-reset-all" ${n?'':'disabled'} title="Every graphic back to where the desks have it: one step, Undo brings it back">Reset all branding${n?' ('+n+')':''}</button></div>`;
  }
  // After the panel's html is in: wire the preview.
  function mount(root){
    const canvas=root?.querySelector?.('[data-branding-preview]');if(!canvas)return;
    draw(canvas);
    canvas.onpointerdown=ev=>{
      const i=info(),d=refDesk(i);if(!d||ev.button!==0)return;
      const sel=brandingElements(d.base).find(x=>x.id===selId);if(!sel)return;
      const v=view(sel,edits());canvas.setPointerCapture(ev.pointerId);canvas.style.cursor='grabbing';
      drag={id:sel.id,sel,px:ev.clientX,py:ev.clientY,x:v.x,y:v.y,rect:canvas.getBoundingClientRect(),d};ev.preventDefault();
    };
    canvas.onpointermove=ev=>{
      if(!drag||drag.id!==selId)return;
      const x=clampN(drag.x+(ev.clientX-drag.px)/drag.rect.width*100,-100,200),y=clampN(drag.y+(ev.clientY-drag.py)/drag.rect.height*100,-100,200);
      dragLive={id:drag.id,fields:{x:r2(x),y:r2(y)}};draw(canvas);
      const dims=sizes.get(drag.d.size)?.[view(drag.sel,edits()).surface];
      if(dims){const set=(n,val)=>{const f=root.querySelector(`[name="${n}"]`);if(f)f.value=String(r1(val));};set('br-across',x/100*dims[0]);set('br-down',y/100*dims[1]);}
      const now=performance.now();if(now-lastCommit>180){lastCommit=now;write(drag.sel,dragLive.fields,null,{key:'branding-drag-'+drag.id});}
    };
    const end=ev=>{
      if(!drag)return;const {sel}=drag,fields=dragLive?.fields;drag=null;dragLive=null;canvas.style.cursor='grab';
      try{canvas.releasePointerCapture(ev.pointerId);}catch{}
      if(fields){write(sel,fields,`${sel.layer.name||sel.key} moved on every desk in the room.`,{key:'branding-drag-'+sel.id});}
      rerender();
    };
    canvas.onpointerup=end;canvas.onpointercancel=end;
  }
  function current(){const d=refDesk(info());if(!d)return null;const els=brandingElements(d.base),sel=els.find(x=>x.id===selId);return sel?{d,sel,v:view(sel,edits())}:null;}
  async function action(name,arg){
    if(name==='br-pick'){selId=arg;rerender();return;}
    const cur=current();
    if(name==='br-reset-all'){
      if(!editedCount())return;
      commit(()=>{shot().brandingEdits={room:info().room||shot().room,artwork:{version:1,surfaces:{}}};},{render:false});
      status('All branding back to where the desks have it.');rerender();return;
    }
    if(!cur)return;
    if(name==='br-center'){write(cur.sel,{x:50,y:50},`${cur.sel.layer.name||cur.sel.key} centered on every desk.`);rerender();return;}
    if(name==='br-reset'){
      write(cur.sel,{surface:cur.sel.surface,enabled:cur.sel.layer.enabled,x:cur.sel.layer.x,y:cur.sel.layer.y,scale:cur.sel.layer.scale,rotation:cur.sel.layer.rotation},`${cur.sel.layer.name||cur.sel.key} back to where the desks have it.`);rerender();return;
    }
  }
  function changed(target){
    const name=target.name;
    if(name==='br-desk'){ref=target.value;rerender();return;}
    const cur=current();if(!cur)return;
    const {sel,v,d}=cur,dims=sizes.get(d.size)?.[v.surface];
    if(name==='br-surface'){write(sel,{surface:target.value},`${sel.layer.name||sel.key} moved to ${surfaceLabel(target.value)} on every desk.`);rerender();return;}
    if(name==='br-show'){write(sel,{enabled:target.checked},`${sel.layer.name||sel.key} ${target.checked?'shown':'hidden'} on every desk.`);rerender();return;}
    const n=Number(target.value);
    if(!Number.isFinite(n)){rerender();status('Enter a number.',true);return;}
    if(name==='br-rot'){write(sel,{rotation:clampN(n,-180,180)},`${sel.layer.name||sel.key} turned to ${r1(n)}° on every desk.`);rerender();return;}
    if(!dims){rerender();return;}
    if(name==='br-across'){write(sel,{x:clampN(n/dims[0]*100,-100,200)},`${sel.layer.name||sel.key} moved on every desk.`);rerender();return;}
    if(name==='br-down'){write(sel,{y:clampN(n/dims[1]*100,-100,200)},`${sel.layer.name||sel.key} moved on every desk.`);rerender();return;}
    if(name==='br-width'){write(sel,{scale:clampN(n/dims[0]*100,5,300)},`${sel.layer.name||sel.key} resized on every desk.`);rerender();return;}
  }
  return {panel,mount,action,changed,available,editedCount,
    // After film-fx (re)installs: the desks' records are new objects / artwork.
    applied:()=>{},
    selected:()=>selId};
}
