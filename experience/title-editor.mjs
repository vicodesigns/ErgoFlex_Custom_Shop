import {LINES,ANCHOR,FILM_W,FONT_REAL,DESC,BOX_BLUR,BOX_OPACITY,BLUR_SIGMA,chapterTitles,cutRule,timingNotes,cleanFilmTitles,shadowOf,fittedPaths,textBounds,lineState,pathTiming,restTime,svgPath,bounds,nearestOnPath,insertPoint,deletePoint,toggleSmooth,moveHandle,movePoint,transformPaths,pointCount} from './film-titles.mjs';
// Film titles in Director Mode: the TITLES lane (one block per title card: drag to move, edges to trim), the Title
// inspector (copy, timing, shadow) and the title overlay in the 16:9 frame, drawn as finish-intro.py burns it in.
// "Edit shadow shape" turns the overlay into a point editor for the soft shape behind the copy (Figma-style):
// click a point to select it, drag it or its handles, Alt-drag a handle to break it, double-click (or Alt-click) a
// point for smooth / sharp, click an edge to add a point, Delete removes it, drag inside a shape to move it,
// the frame's corner and edge squares scale the selection (Shift keeps proportions, Alt scales from the centre).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=v=>Number((+v).toFixed(2));
const FONT_URL=new URL('../app-reference/assets/google_fonts/',import.meta.url).href;
const FAMILY={600:'EF Film Poppins SemiBold',400:'EF Film Poppins'};
const NS='http://www.w3.org/2000/svg';
export async function loadTitleSource(filmList,base=location.href,fetcher=globalThis.fetch){
  const url=new URL(filmList,base),get=async name=>{const r=await fetcher(new URL(name,url).href,{cache:'no-store'});if(!r.ok)throw Error(`${name} unavailable (${r.status})`);return r.json();};
  const [src,edl]=await Promise.all([get('titles-src.json'),get('edl.json').catch(()=>null)]);
  if(!Array.isArray(src?.titles))throw Error('titles-src.json has no titles.');
  return {src,edl};
}
export function createTitleEditor({panel,timeline,shot,time,seek,commit,status,render,renderTimeline,showInspector,onSelect,snapDelta,dragFeedback,endDragFeedback,ready,open}){
  let source=null,selected=null,editing=false,shown=true,fontsReady=false,drag=null,suppress=0,lastKey='';
  const fromFilm=new Map();
  // ---- fonts + measuring (libass sizes Poppins by its full height; no kerning, like the ASS overlay) -----------
  const canvas=document.createElement('canvas').getContext('2d'),widths=new Map();
  const fontsLoaded=Promise.all([['Poppins-SemiBold.ttf',600],['Poppins-Regular.ttf',400]].map(async([file,w])=>{const f=new FontFace(FAMILY[w],`url(${FONT_URL}${file})`);await f.load();document.fonts.add(f);})).then(()=>{fontsReady=true;widths.clear();lastKey='';sync();if(selected)render();}).catch(error=>console.warn('[titles] fonts',error.message));
  function measure(L,text){
    const key=L.key+'|'+text+'|'+fontsReady;let w=widths.get(key);if(w!==undefined)return w;
    canvas.font=`${L.weight} ${L.size/FONT_REAL}px "${FAMILY[L.weight]}", Poppins, sans-serif`;try{canvas.fontKerning='none';canvas.letterSpacing='0px';}catch{}
    w=canvas.measureText(text).width+Math.max(0,L.spacing)*[...text].length;widths.set(key,w);return w;
  }
  // ---- data -------------------------------------------------------------------------------------------------
  const has=()=>!!source&&(titles().length>0);
  function titles(){
    const s=shot();if(s.filmTitles)return s.filmTitles;if(!source)return [];
    let list=fromFilm.get(s.id);if(!list){list=cleanFilmTitles(chapterTitles(source.src,s.id),s.seconds)||[];fromFilm.set(s.id,list);}return list;
  }
  const rule=()=>source?.edl?cutRule(source.edl,shot().id):null;
  const item=()=>titles().find(t=>t.id===selected)||null;
  const edited=()=>!!shot().filmTitles;
  function put(change,{key=null,message='',renderAll=true}={}){
    ready();const list=titles().map(t=>t.id===selected?change(structuredClone(t)):t);
    commit(()=>{const s=shot();s.filmTitles=cleanFilmTitles(list,s.seconds);const first=s.filmTitles[0];if(first){s.title=first.title||s.title;s.detail=first.detail;}},{render:renderAll,key});
    lastKey='';sync();if(message)status(message);
  }
  function putTiming(id,a,b,message){
    ready();const s=shot(),list=titles().map(t=>t.id===id?{...t,rel_in:a,rel_out:b,timed:true}:t);
    commit(()=>{s.filmTitles=cleanFilmTitles(list,s.seconds);},{render:true});selected=id;lastKey='';sync();
    const t=item(),notes=t?timingNotes(t,rule()):[];status(message+(notes.length?' Note: '+notes[0]+' The film keeps your timing.':''));
  }
  // ---- selection --------------------------------------------------------------------------------------------
  function select(id,{reveal=true}={}){
    onSelect();selected=id;const t=item();if(!t)return;showInspector('title',true);
    if(reveal){try{seek(restTime(t)/shot().seconds);}catch{}}
    render();status('Title selected. Drag its block to move it, its edges to trim, or edit its copy and shadow in Title.');
  }
  function clear(){if(!selected&&!editing)return false;selected=null;setEditing(false,false);return true;}
  function setEditing(on,announce=true){
    if(on&&!item())return;editing=on;shape.pt=null;shape.sel=on?new Set(shadowOf(item(),measure).paths.map((_,i)=>i)):new Set();
    document.body.classList.toggle('title-shape-editing',editing);lastKey='';sync();
    const b=panel.querySelector('[data-title-action=edit-shadow]');if(b){b.setAttribute('aria-pressed',String(editing));b.textContent=editing?'Done editing shape':'Edit shadow shape';}
    if(announce)status(editing?'Editing the shadow: click a point to select it, drag handles to curve, click an edge to add a point, Delete removes it, drag inside to move, the corner squares scale. Esc when done.':'Shadow editing done.');
  }
  // ---- timeline lane ----------------------------------------------------------------------------------------
  function ticks(){return titles().map(t=>t.rel_in);}
  function lane(){
    const s=shot().seconds,R=rule(),list=titles();
    const zone=R?.cutDone!==undefined?`<span class="title-cut-zone" style="width:${Math.min(100,R.cutDone/s*100)}%" title="The transition from the previous chapter (done at ${r2(R.cutDone)} s)"></span>`:'';
    const mark=R?.earliest!==undefined?`<span class="title-rule" data-title-rule style="left:${R.earliest/s*100}%" title="1.5 s after the cut (${r2(R.earliest)} s): the film's titles come in from here"><i>1.5 s after cut</i></span>`:'';
    const blocks=list.map(t=>{const notes=timingNotes(t,R),early=R?.earliest!==undefined&&t.rel_in<R.earliest-1e-6,custom=!!t.shadow?.paths;
      return `<button class="desk-clip title-clip ${selected===t.id?'selected':''} ${early?'early':''}" data-title-clip="${t.id}" style="left:${t.rel_in/s*100}%;width:${(t.rel_out-t.rel_in)/s*100}%" aria-pressed="${selected===t.id}" aria-label="Title ${escape(t.title)}, ${r2(t.rel_in)} to ${r2(t.rel_out)} seconds" title="${escape([t.eyebrow,t.title].filter(Boolean).join(' · '))} · ${r2(t.rel_in)}–${r2(t.rel_out)}s${custom?' · custom shadow':''}${notes.length?' · '+escape(notes.join(' ')):''} (drag to move, edges to trim)"><span class="clip-resize" data-resize="start" title="Trim the title's in point"></span><strong>${t.eyebrow?`<em>${escape(t.eyebrow)}</em> `:''}${escape(t.title||'(no headline)')}</strong><small>${r2(t.rel_in)}–${r2(t.rel_out)}s${custom?' · custom shadow':''}${early?' · before the 1.5 s mark':''}</small><span class="clip-resize" data-resize="end" title="Trim the title's out point"></span></button>`;}).join('');
    return `<div class="desk-lane-row" data-lane-color="titles"><span class="desk-lane-label" title="The film's title cards (titles-src.json): drag a block to move it, its edges to trim, click it to edit the copy and the shadow">Titles${edited()?' <small>edited</small>':''}</span><div class="desk-lane title-lane" data-title-lane role="group" aria-label="Film titles timeline"><div class="desk-lane-line"></div>${zone}${mark}${blocks}<div class="camera-track-playhead" data-shared-playhead style="left:${time()*100}%"></div></div></div>`;
  }
  function snapTargets(exclude){
    const out=[];for(const t of titles())if(t.id!==exclude)out.push([t.rel_in,`${t.title||'title'} in`],[t.rel_out,`${t.title||'title'} out`]);
    const R=rule();if(R?.earliest!==undefined)out.push([R.earliest,'the 1.5 s-after-cut mark']);if(R?.cutDone!==undefined)out.push([R.cutDone,'the end of the transition']);return out;
  }
  // Drag a block (move) or an edge (trim); Magnet / snap / Alt like the other lanes; one undo step per drag.
  timeline.addEventListener('pointerdown',event=>{
    const el=event.target.closest('[data-title-clip]');if(!el||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    try{ready();}catch(error){status(error.message,true);return;}
    const t=titles().find(x=>x.id===el.dataset.titleClip);if(!t)return;
    const lane=el.closest('[data-title-lane]'),edge=event.target.closest('[data-resize]')?.dataset.resize||null;
    drag={id:t.id,kind:'titles',edge,el,start:event.clientX,width:lane.getBoundingClientRect().width,base:{seconds:shot().seconds,titles:structuredClone(titles())},original:t,delta:0,set:{},moved:false,candidate:null};
    el.setPointerCapture(event.pointerId);el.focus({preventScroll:true});
  });
  timeline.addEventListener('pointermove',event=>{
    if(!drag)return;const d=drag,s=d.base.seconds,o=d.original;if(Math.abs(event.clientX-d.start)>3)d.moved=true;if(!d.moved)return;
    const raw=(event.clientX-d.start)/d.width*s,edges=d.edge==='start'?[o.rel_in]:d.edge==='end'?[o.rel_out]:[o.rel_in,o.rel_out];
    const {delta,snap}=snapDelta({raw,edges,width:d.width,seconds:s,alt:event.altKey,exclude:o.id});d.snap=snap;
    let a=o.rel_in,b=o.rel_out;
    if(d.edge==='start')a=Math.max(0,Math.min(b-.5,o.rel_in+delta));else if(d.edge==='end')b=Math.max(a+.5,Math.min(s,o.rel_out+delta));
    else{const dd=Math.max(-o.rel_in,Math.min(s-o.rel_out,delta));a=o.rel_in+dd;b=o.rel_out+dd;}
    a=Math.round(a*1000)/1000;b=Math.round(b*1000)/1000;d.candidate=[a,b];d.delta=d.edge==='end'?b-o.rel_out:a-o.rel_in;
    d.el.style.left=a/s*100+'%';d.el.style.width=(b-a)/s*100+'%';const small=d.el.querySelector('small');if(small)small.textContent=`${r2(a)}–${r2(b)}s`;
    const early=rule()?.earliest!==undefined&&a<rule().earliest-1e-6;d.el.classList.toggle('early',early);
    dragFeedback(d,event);
    status(`${d.edge==='start'?'In':d.edge==='end'?'Out':'Title'} ${r2(a)}–${r2(b)} s · ${r2(b-a)} s on screen${early?' · before the 1.5 s-after-cut mark':''}${snap?' · snapped to '+snap.name:''} · Alt: bypass snap`);
  });
  function endDrag(event){
    if(!drag)return;const d=drag;drag=null;endDragFeedback(d);suppress=performance.now()+300;
    if(event.type==='pointercancel'){renderTimeline();return;}
    if(!d.moved||!d.candidate){select(d.id);return;}
    onSelect();selected=d.id;showInspector('title',true);putTiming(d.id,d.candidate[0],d.candidate[1],d.edge?`Title ${d.edge==='start'?'in point':'out point'} trimmed: ${r2(d.candidate[0])}–${r2(d.candidate[1])} s.`:`Title moved to ${r2(d.candidate[0])}–${r2(d.candidate[1])} s.`);
  }
  timeline.addEventListener('pointerup',endDrag);timeline.addEventListener('pointercancel',endDrag);
  timeline.addEventListener('click',event=>{
    if(event.target.closest('[data-title-clip]')){if(performance.now()<suppress){event.preventDefault();event.stopPropagation();}return;}
    const rail=event.target.closest('[data-title-lane]');if(!rail)return;try{const r=rail.getBoundingClientRect();seek(Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)));}catch(error){status(error.message,true);}
  });
  timeline.addEventListener('keydown',event=>{
    const el=event.target.closest('[data-title-clip]');if(!el||!['ArrowLeft','ArrowRight','Enter'].includes(event.key))return;event.preventDefault();
    if(event.key==='Enter'){select(el.dataset.titleClip);return;}
    try{const t=titles().find(x=>x.id===el.dataset.titleClip),s=shot().seconds,d=(event.shiftKey?1:.1)*(event.key==='ArrowLeft'?-1:1),dd=Math.max(-t.rel_in,Math.min(s-t.rel_out,d));
      putTiming(t.id,Math.round((t.rel_in+dd)*1000)/1000,Math.round((t.rel_out+dd)*1000)/1000,`Title nudged to ${r2(t.rel_in+dd)}–${r2(t.rel_out+dd)} s.`);timeline.querySelector(`[data-title-clip="${t.id}"]`)?.focus();}catch(error){status(error.message,true);}
  });
  // ---- inspector --------------------------------------------------------------------------------------------
  function header(){const t=item();if(!t)return '';return `<div class="sel-row"><span class="sel-icon">T</span><span class="sel-name"><b>${escape('Title · '+(t.title||t.eyebrow||'untitled'))}</b><small>${r2(t.rel_in)}–${r2(t.rel_out)} s${t.shadow?.paths?' · custom shadow':''}</small></span><button data-action="sel-clear" title="Deselect (Esc)" aria-label="Deselect">×</button></div>`;}
  function list(){
    return titles().map((t,i)=>`<button class="title-pick ${selected===t.id?'selected':''}" data-title-action="pick" data-title-id="${t.id}" title="Edit this title"><b>${i+1}</b><span>${t.eyebrow?`<em>${escape(t.eyebrow)}</em> · `:''}${escape(t.title||'(no headline)')}</span><small>${r2(t.rel_in)}–${r2(t.rel_out)} s</small></button>`).join('');
  }
  // The Chapter tab's Headline / Supporting text: the chapter's first film title (the card the film shows).
  function chapterFields(){
    if(!has())return null;const all=titles(),t=all[0];
    return `<div class="film-title-fields"><p class="director-hint">${all.length>1?`The film shows ${all.length} titles in this chapter; these fields are title 1. Pick a title below (or on the Titles lane) for the others, its timing and its shadow.`:'The film title of this chapter (titles-src.json). Its timing and shadow: select it on the Titles lane.'}</p>
      <label>Eyebrow<input name="ft-eyebrow" data-title-id="${t.id}" maxlength="60" value="${escape(t.eyebrow)}"></label>
      <label>Headline<input name="ft-title" data-title-id="${t.id}" maxlength="140" value="${escape(t.title)}"></label>
      <label>Supporting text<textarea name="ft-detail" data-title-id="${t.id}" rows="2" maxlength="260">${escape(t.detail)}</textarea></label>
      <div class="title-list">${list()}</div></div>`;
  }
  function panelHtml(){
    if(!has())return '<p class="director-hint">This chapter has no film titles.</p>';
    const t=item();
    if(!t)return `<div data-reveal="title"><h3>Film titles</h3><p class="director-hint">Select a title on the Titles lane, or here, to edit its copy, timing and the shadow behind it.</p><div class="title-list">${list()}</div></div>`;
    const R=rule(),notes=timingNotes(t,R),S=shadowOf(t,measure),n=titles().indexOf(t)+1,tb=textBounds(t,measure),bb=bounds(S.paths);
    const short=S.custom&&tb&&bb&&(tb.x1>bb.x1+2||tb.x0<bb.x0-2);
    return `<div data-reveal="title"><h3>Film title ${n} <span class="inspector-subtitle">of ${titles().length} in this chapter</span></h3><div class="title-list">${titles().length>1?list():''}</div>
      <label>Eyebrow<input name="ft-eyebrow" maxlength="60" value="${escape(t.eyebrow)}"></label>
      <label>Headline<input name="ft-title" maxlength="140" value="${escape(t.title)}"></label>
      <label>Supporting text<textarea name="ft-detail" rows="2" maxlength="260">${escape(t.detail)}</textarea></label>
      <div class="director-grid"><label>Comes in (seconds)<input name="ft-in" type="number" min="0" max="${shot().seconds}" step=".05" value="${r2(t.rel_in)}"></label><label>Goes out (seconds)<input name="ft-out" type="number" min="0" max="${shot().seconds}" step=".05" value="${r2(t.rel_out)}"></label></div>
      <p class="director-hint title-rule-note">${R?.earliest!==undefined?`Film rule: titles come in at least 1.5 s after the cut, here from <b>${r2(R.earliest)} s</b>.`:'This chapter opens the film: no cut before it.'}${t.timed?' Your timing is kept as you set it.':''}</p>
      ${notes.map(x=>`<p class="title-warning" role="note">${escape(x)} The film keeps your timing.</p>`).join('')}
      <div class="director-actions">${R?.earliest!==undefined?`<button data-title-action="to-rule" title="Move the title so it comes in exactly at the 1.5 s-after-cut mark">Start at the 1.5 s mark</button>`:''}<button data-title-action="go" title="Move the playhead to where the whole title is in">Show title</button></div>
      <fieldset class="title-shadow"><legend>Shadow behind the text</legend>
      <p class="director-hint" data-title-shape-note>${S.custom?`Your own shape: ${S.paths.length} part${S.paths.length===1?'':'s'}, ${pointCount(S.paths)} points.`:'Fitted to each line of text, as the film has it now.'}</p>
      ${short?'<p class="title-warning" role="note">The text runs past the shadow shape. Widen the shape, or Reset to fitted.</p>':''}
      <div class="director-actions"><button data-title-action="edit-shadow" class="primary" aria-pressed="${editing}">${editing?'Done editing shape':'Edit shadow shape'}</button><button data-title-action="reset-shadow" ${t.shadow?'':'disabled'} title="Back to the boxes fitted to each line, with the film's softness and darkness">Reset to fitted</button></div>
      <label>Softness <output data-title-blur>${r2(S.blur)}</output><span class="global-slider"><input name="ft-blur" type="range" min="0" max="60" step="1" value="${S.blur}"><input name="ft-blur-n" type="number" min="0" max="80" step="1" value="${S.blur}"></span></label>
      <label>Darkness <output data-title-opacity>${Math.round(S.opacity*100)}%</output><span class="global-slider"><input name="ft-opacity" type="range" min="0" max="100" step="1" value="${Math.round(S.opacity*100)}"><input name="ft-opacity-n" type="number" min="0" max="100" step="1" value="${Math.round(S.opacity*100)}"></span></label>
      ${editing?`<div class="director-actions title-point-tools"><button data-title-action="pt-smooth" ${shape.pt?'':'disabled'}>Make point smooth</button><button data-title-action="pt-sharp" ${shape.pt?'':'disabled'}>Make point sharp</button><button data-title-action="pt-delete" ${shape.pt?'':'disabled'}>Delete point</button></div>
      <p class="director-hint title-shape-help">Click a point to select it, then drag it. Drag its handles to curve the edge; Alt-drag a handle to break it. Double-click a point for smooth or sharp. Click an edge to add a point; Delete removes the selected point. Drag inside a shape to move it; the corner and edge squares make it bigger or smaller (Shift keeps proportions, Alt from the centre). Arrows nudge 1 px (Shift 10). Ctrl+A selects every part. Esc when done.</p>`:''}
      </fieldset></div>`;
  }
  // Copy / timing / shadow fields (live, one undo step per field edit or slider drag).
  panel.addEventListener('input',event=>{
    const el=event.target,name=el.name;if(!name?.startsWith('ft-'))return;event.stopPropagation();
    try{
      const id=el.dataset.titleId||selected;if(!id)return;const prev=selected;selected=id;
      if(['ft-eyebrow','ft-title','ft-detail'].includes(name)){const k=name.slice(3);put(t=>{t[k]=el.value;return t;},{key:name+id,renderAll:false});selected=prev;renderTimeline();return;}
      if(name==='ft-blur'||name==='ft-blur-n'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;put(t=>{t.shadow={...t.shadow,blur:Math.max(0,Math.min(80,v))};return t;},{key:'ft-blur'+id,renderAll:false});const o=panel.querySelector('[data-title-blur]');if(o)o.textContent=String(v);const twin=panel.querySelector(`[name="${name==='ft-blur'?'ft-blur-n':'ft-blur'}"]`);if(twin)twin.value=String(v);status(`Shadow softness ${v} (the film's is ${BOX_BLUR}).`);return;}
      if(name==='ft-opacity'||name==='ft-opacity-n'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;put(t=>{t.shadow={...t.shadow,opacity:Math.max(0,Math.min(100,v))/100};return t;},{key:'ft-opacity'+id,renderAll:false});const o=panel.querySelector('[data-title-opacity]');if(o)o.textContent=Math.round(v)+'%';const twin=panel.querySelector(`[name="${name==='ft-opacity'?'ft-opacity-n':'ft-opacity'}"]`);if(twin)twin.value=String(v);status(`Shadow darkness ${Math.round(v)}% (the film's is ${Math.round(BOX_OPACITY*100)}%).`);return;}
    }catch(error){status(error.message,true);}
  },true);
  panel.addEventListener('change',event=>{
    const el=event.target,name=el.name;if(!name?.startsWith('ft-'))return;event.stopPropagation();
    try{
      if(name==='ft-in'||name==='ft-out'){const t=item();if(!t)return;const v=Number(el.value);if(el.value===''||!Number.isFinite(v))throw Error('Enter a time in seconds.');
        let a=t.rel_in,b=t.rel_out;if(name==='ft-in')a=Math.max(0,Math.min(b-.5,v));else b=Math.max(a+.5,Math.min(shot().seconds,v));
        putTiming(t.id,Math.round(a*1000)/1000,Math.round(b*1000)/1000,`Title ${name==='ft-in'?'comes in':'goes out'} at ${r2(name==='ft-in'?a:b)} s.`);return;}
      if(['ft-eyebrow','ft-title','ft-detail','ft-blur','ft-opacity','ft-blur-n','ft-opacity-n'].includes(name)){render();if(name.startsWith('ft-blur')||name.startsWith('ft-opacity'))return;status('Title copy updated. Export cut sends it to the film.');}
    }catch(error){render();status(error.message,true);}
  },true);
  panel.addEventListener('click',event=>{
    const b=event.target.closest('[data-title-action]');if(!b)return;event.stopPropagation();
    try{titleAction(b.dataset.titleAction,b.dataset.titleId);}catch(error){status(error.message,true);}
  });
  function titleAction(name,id){
    if(name==='pick'){select(id);return;}
    const t=item();if(!t)return;
    if(name==='go'){seek(restTime(t)/shot().seconds);return;}
    if(name==='to-rule'){const R=rule();if(R?.earliest===undefined)return;const on=t.rel_out-t.rel_in,a=R.earliest,b=Math.min(shot().seconds,a+on);putTiming(t.id,a,Math.round(b*1000)/1000,`Title now comes in at the 1.5 s mark (${r2(a)} s).`);return;}
    if(name==='edit-shadow'){setEditing(!editing);if(editing)seek(restTime(t)/shot().seconds);render();return;}
    if(name==='reset-shadow'){put(x=>{delete x.shadow;return x;},{message:'Shadow reset to the fitted boxes, with the film\'s softness and darkness.'});if(editing)setEditing(true,false);render();return;}
    if(name==='pt-smooth'||name==='pt-sharp'){const [pi,k]=shape.pt||[];if(pi===undefined)return;const S=shadowOf(t,measure),p=S.paths[pi].points[k],isSmooth=!!(p.in||p.out);if((name==='pt-smooth')===isSmooth)return;S.paths[pi]=toggleSmooth(S.paths[pi],k);saveShape(S.paths,name==='pt-smooth'?'Point made smooth: drag its handles to shape the curve.':'Point made sharp.');return;}
    if(name==='pt-delete'){deleteSelectedPoint();return;}
  }
  // ---- overlay (the 16:9 frame) -----------------------------------------------------------------------------
  const box=document.createElement('div');box.className='film-box title-overlay';box.setAttribute('aria-hidden','true');
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${FILM_W} 1080`);svg.setAttribute('preserveAspectRatio','none');svg.classList.add('title-svg');box.append(svg);document.body.append(box);
  const shape={pt:null,sel:new Set(),draft:null};let lastPt=null;
  const blurFilter=(id,b)=>`<filter id="${id}" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2720" height="1880"><feGaussianBlur stdDeviation="${(b*BLUR_SIGMA).toFixed(3)}"/></filter>`;
  function cardSvg(t,at,rest){
    const S=shapeFor(t),defs=[],parts=[];let n=0;
    // shadow (layer 0): each path its own soft shape, timed like its line (finish-intro: one Dialogue each)
    if(S.blur>0)defs.push(blurFilter('tb-'+t.id,S.blur));
    S.paths.forEach(p=>{const [delay,rise]=pathTiming(p),st=rest?{on:true,alpha:1,dy:0}:lineState(t,delay,rise,at);if(!st.on||st.alpha<=0)return;
      parts.push(`<path d="${svgPath(p)}" fill="#000" fill-opacity="${(S.opacity*st.alpha).toFixed(4)}" transform="translate(0 ${st.dy.toFixed(2)})" ${S.blur>0?`filter="url(#tb-${t.id})"`:''}/>`);});
    // text (layer 1), with its drop shadow
    for(const L of LINES){const s=t[L.key];if(!s)continue;const st=rest?{on:true,alpha:1,dy:0,blur:0}:lineState(t,L.delay,L.rise,at);if(!st.on||st.alpha<=0)continue;
      const fid=st.blur>.05?`tt-${t.id}-${n++}`:null;if(fid)defs.push(blurFilter(fid,st.blur));
      const y=L.y-L.size*DESC+st.dy,attrs=`font-family="${FAMILY[L.weight]}" font-weight="${L.weight}" font-size="${(L.size/FONT_REAL).toFixed(3)}" letter-spacing="${L.spacing}" style="font-kerning:none;white-space:pre"`;
      parts.push(`<g ${fid?`filter="url(#${fid})"`:''} opacity="${st.alpha.toFixed(4)}"><text x="${128+L.shadow}" y="${(y+L.shadow).toFixed(2)}" ${attrs} fill="#000" fill-opacity="${L.shadowAlpha.toFixed(3)}">${escape(s)}</text><text x="128" y="${y.toFixed(2)}" ${attrs} fill="${L.color}">${escape(s)}</text></g>`);}
    return {defs:defs.join(''),body:parts.join('')};
  }
  function shapeFor(t){const S=shadowOf(t,measure);if(editing&&t.id===selected&&shape.draft)S.paths=shape.draft;return S;}
  function sync(){
    const visible=open()&&shown&&has()&&document.body.classList.contains('film-frame');box.hidden=!visible;if(!visible){lastKey='';return;}
    const at=time()*shot().seconds,t=item(),list=editing&&t?[t]:titles().filter(x=>at>=x.rel_in&&at<x.rel_out);
    const key=JSON.stringify([at.toFixed(3),list,editing,shape.pt,[...shape.sel],shape.draft,fontsReady,svg.clientWidth]);if(key===lastKey)return;lastKey=key;
    let defs='',body='';for(const x of list){const c=cardSvg(x,at,editing&&x.id===selected);defs+=c.defs;body+=`<g class="title-card" data-title-card="${x.id}">${c.body}</g>`;}
    svg.innerHTML=`<defs>${defs}</defs>${body}${editing&&t?editLayer(t):t&&list.includes(t)?hintLayer(t,at):''}`;
  }
  // A selected title shows its shadow's outline (dashed); clicking the shape starts editing it.
  function hintLayer(t,at){
    const S=shadowOf(t,measure);return `<g class="shape-hint">${S.paths.map(p=>{const [delay,rise]=pathTiming(p),st=lineState(t,delay,rise,at);return st.on?`<path data-hint d="${svgPath(p)}" transform="translate(0 ${st.dy.toFixed(2)})"><title>Click to edit the shadow shape</title></path>`:'';}).join('')}</g>`;
  }
  // ---- shadow shape editing ---------------------------------------------------------------------------------
  const [AX,AY]=ANCHOR,px=()=>FILM_W/Math.max(1,svg.getBoundingClientRect().width);
  function editLayer(t){
    const S=shapeFor(t),k=px(),h=5.5*k,parts=[`<rect class="se-bg" x="0" y="0" width="${FILM_W}" height="1080" fill="transparent"/>`];
    S.paths.forEach((p,pi)=>{const d=svgPath(p);parts.push(`<path class="se-body" data-body="${pi}" d="${d}"/><path class="se-edge" data-edge="${pi}" d="${d}" stroke-width="${12*k}"/><path class="se-outline ${shape.sel.has(pi)?'sel':''}" d="${d}"/>`);});
    const sel=[...shape.sel].filter(i=>S.paths[i]),bb=sel.length?bounds(sel.map(i=>S.paths[i])):null;
    if(bb){const [x0,y0,x1,y1]=[bb.x0+AX,bb.y0+AY,bb.x1+AX,bb.y1+AY],m=[(x0+x1)/2,(y0+y1)/2];
      parts.push(`<rect class="se-frame" x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}"/>`);
      for(const [c,x,y] of [['nw',x0,y0],['n',m[0],y0],['ne',x1,y0],['e',x1,m[1]],['se',x1,y1],['s',m[0],y1],['sw',x0,y1],['w',x0,m[1]]])parts.push(`<rect class="se-scale" data-scale="${c}" x="${x-h}" y="${y-h}" width="${2*h}" height="${2*h}"><title>Drag to resize (Shift keeps proportions, Alt from the centre)</title></rect>`);}
    if(shape.pt){const [pi,j]=shape.pt,p=S.paths[pi]?.points[j];if(p)for(const w of ['in','out'])if(p[w]){const hx=p.x+p[w][0]+AX,hy=p.y+p[w][1]+AY;parts.push(`<line class="se-hline" x1="${p.x+AX}" y1="${p.y+AY}" x2="${hx}" y2="${hy}"/><circle class="se-handle" data-h="${pi}:${j}:${w}" cx="${hx}" cy="${hy}" r="${h*.9}"><title>Drag to curve · Alt-drag breaks the handle</title></circle>`);}}
    S.paths.forEach((p,pi)=>p.points.forEach((q,j)=>{const on=shape.pt&&shape.pt[0]===pi&&shape.pt[1]===j,smooth=!!(q.in||q.out);
      parts.push(smooth?`<circle class="se-pt ${on?'on':''}" data-pt="${pi}:${j}" cx="${q.x+AX}" cy="${q.y+AY}" r="${h}"><title>Smooth point · drag to move · double-click: sharp</title></circle>`:`<rect class="se-pt ${on?'on':''}" data-pt="${pi}:${j}" x="${q.x+AX-h}" y="${q.y+AY-h}" width="${2*h}" height="${2*h}"><title>Sharp point · drag to move · double-click: smooth</title></rect>`);}));
    return `<g class="shape-edit">${parts.join('')}</g>`;
  }
  const filmPoint=event=>{const m=svg.getScreenCTM();if(!m)return [0,0];const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse());return [p.x-AX,p.y-AY];};
  function saveShape(paths,message){
    put(t=>{t.shadow={...t.shadow,paths:structuredClone(paths)};return t;},{message});shape.draft=null;lastKey='';sync();
  }
  function deleteSelectedPoint(){
    const t=item();if(!t||!shape.pt)return status('Select a point first (click it).');const [pi,k]=shape.pt,S=shadowOf(t,measure);
    S.paths[pi]=deletePoint(S.paths[pi],k);shape.pt=null;saveShape(S.paths,'Point deleted. Undo brings it back.');
  }
  svg.addEventListener('pointerdown',event=>{
    if(!editing&&event.button===0&&event.target.closest?.('[data-hint]')&&item()){event.preventDefault();event.stopPropagation();try{ready();setEditing(true);seek(restTime(item())/shot().seconds);render();}catch(error){status(error.message,true);}return;}
    if(!editing||event.button!==0)return;const t=item();if(!t)return;event.preventDefault();event.stopPropagation();
    try{ready();}catch(error){status(error.message,true);return;}
    const el=event.target,S=shadowOf(t,measure),at=filmPoint(event),base=structuredClone(S.paths);
    const ds=el.dataset||{};let d=null;
    if(ds.h){const [pi,k,w]=ds.h.split(':');d={type:'handle',pi:+pi,k:+k,which:w};}
    else if(ds.pt){const [pi,k]=ds.pt.split(':').map(Number),now=performance.now();
      // a second click on the same point within 450 ms: smooth <-> sharp (the overlay redraws between clicks, so no dblclick)
      if(lastPt&&lastPt.key===ds.pt&&now-lastPt.at<450){lastPt=null;shape.pt=[pi,k];S.paths[pi]=toggleSmooth(S.paths[pi],k);saveShape(S.paths,S.paths[pi].points[k].in?'Point made smooth: drag its handles to shape the curve.':'Point made sharp.');return;}
      lastPt={key:ds.pt,at:now};shape.pt=[pi,k];if(!shape.sel.has(pi)&&!event.shiftKey)shape.sel=new Set([pi]);else shape.sel.add(pi);d={type:'point',pi,k,alt:event.altKey};}
    else if(ds.scale){d={type:'scale',corner:ds.scale,bb:bounds([...shape.sel].map(i=>base[i]))};}
    else if(ds.edge!==undefined){const pi=+ds.edge,n=nearestOnPath(base[pi],...at),r=insertPoint(base[pi],n.seg,n.t);base[pi]=r.path;shape.pt=[pi,r.index];shape.sel=new Set([pi]);shape.draft=structuredClone(base);d={type:'point',pi,k:r.index,inserted:true};}
    else if(ds.body!==undefined){const pi=+ds.body;if(event.shiftKey){if(shape.sel.has(pi))shape.sel.delete(pi);else shape.sel.add(pi);}else if(!shape.sel.has(pi))shape.sel=new Set([pi]);shape.pt=null;d={type:'body'};}
    else{shape.pt=null;if(!event.shiftKey)shape.sel=new Set();lastKey='';sync();render();return;}
    drag={...d,start:at,base,moved:false,ox:event.clientX,oy:event.clientY};svg.setPointerCapture(event.pointerId);lastKey='';sync();
    if(d.type==='point'||d.type==='handle')renderPanelTools();
  });
  svg.addEventListener('pointermove',event=>{
    const d=drag;if(!d||!editing||!d.base)return;if(Math.hypot(event.clientX-d.ox,event.clientY-d.oy)>2){d.moved=true;lastPt=null;}if(!d.moved)return;
    const [fx,fy]=filmPoint(event),dx=fx-d.start[0],dy=fy-d.start[1],next=structuredClone(d.base);
    if(d.type==='point'){const p=d.base[d.pi].points[d.k];next[d.pi]=movePoint(d.base[d.pi],d.k,p.x+dx,p.y+dy);}
    else if(d.type==='handle'){const p=d.base[d.pi].points[d.k];next[d.pi]=moveHandle(d.base[d.pi],d.k,d.which,[fx-p.x,fy-p.y],event.altKey);}
    else if(d.type==='body'){const moved=transformPaths([...shape.sel].map(i=>d.base[i]),{dx,dy});[...shape.sel].forEach((i,n)=>{next[i]=moved[n];});}
    else if(d.type==='scale'&&d.bb){
      const b=d.bb,c=d.corner,center=event.altKey,ox=center?(b.x0+b.x1)/2:c.includes('w')?b.x1:b.x0,oy=center?(b.y0+b.y1)/2:c.includes('n')?b.y1:b.y0;
      const w=Math.max(1,b.x1-b.x0),h=Math.max(1,b.y1-b.y0),k=center?2:1;
      let sx=c.includes('e')?(w+dx*k)/w:c.includes('w')?(w-dx*k)/w:1,sy=c.includes('s')?(h+dy*k)/h:c.includes('n')?(h-dy*k)/h:1;
      if(event.shiftKey){const u=c.length===2?Math.max(sx,sy):c==='n'||c==='s'?sy:sx;sx=sy=u;}
      sx=Math.max(.05,sx);sy=Math.max(.05,sy);
      const moved=transformPaths([...shape.sel].map(i=>d.base[i]),{ox,oy,sx,sy});[...shape.sel].forEach((i,n)=>{next[i]=moved[n];});
      d.scaleBy=[sx,sy];
    }
    shape.draft=next;lastKey='';sync();
    status(d.type==='scale'?`Scaling ${Math.round(d.scaleBy[0]*100)}% × ${Math.round(d.scaleBy[1]*100)}%${event.shiftKey?' (proportional)':''}`:d.type==='body'?`Moving the shape ${r2(dx)}, ${r2(dy)} px`:d.type==='handle'?(event.altKey?'Handle broken: the two sides curve on their own.':'Curving the edge (Alt breaks the handle)'):`Point at ${r2(fx)}, ${r2(fy)} px from the headline's corner`);
  });
  function endShape(event){
    const d=drag;if(!d||!d.base)return;drag=null;
    if(event.type==='pointercancel'){shape.draft=null;lastKey='';sync();return;}
    if(d.inserted&&!d.moved){saveShape(shape.draft,'Point added. Drag it to reshape the edge; Delete removes it.');return;}
    if(!d.moved){shape.draft=null;if(d.type==='point'&&d.alt){const t=item(),S=shadowOf(t,measure);S.paths[d.pi]=toggleSmooth(S.paths[d.pi],d.k);saveShape(S.paths,'Point switched between smooth and sharp.');return;}lastKey='';sync();renderPanelTools();return;}
    saveShape(shape.draft,{point:d.inserted?'Point added and moved.':'Point moved.',handle:'Curve changed.',body:'Shape moved.',scale:'Shape resized.'}[d.type]);
  }
  svg.addEventListener('pointerup',endShape);svg.addEventListener('pointercancel',endShape);
  function renderPanelTools(){for(const b of panel.querySelectorAll('.title-point-tools button'))b.disabled=!shape.pt;}
  // Keys while editing the shape (before the timeline's and history's own shortcuts).
  document.addEventListener('keydown',event=>{
    if(!editing||!open()||event.target.closest?.('input,select,textarea,[contenteditable]')||document.querySelector('dialog[open]'))return;
    const t=item();if(!t)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(shape.pt){shape.pt=null;lastKey='';sync();renderPanelTools();status('Point deselected. Esc again finishes editing the shape.');}else{setEditing(false);render();}return;}
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();try{deleteSelectedPoint();}catch(error){status(error.message,true);}return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();event.stopImmediatePropagation();shape.sel=new Set(shadowOf(t,measure).paths.map((_,i)=>i));shape.pt=null;lastKey='';sync();status('Every part of the shadow selected: drag inside to move, the squares to resize.');return;}
    if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();setEditing(false);render();return;}
    const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!dir||event.ctrlKey||event.metaKey||event.altKey)return;
    event.preventDefault();event.stopImmediatePropagation();const n=event.shiftKey?10:1,S=shadowOf(t,measure);
    if(shape.pt){const [pi,k]=shape.pt,p=S.paths[pi].points[k];S.paths[pi]=movePoint(S.paths[pi],k,p.x+dir[0]*n,p.y+dir[1]*n);}
    else if(shape.sel.size){const moved=transformPaths([...shape.sel].map(i=>S.paths[i]),{dx:dir[0]*n,dy:dir[1]*n});[...shape.sel].forEach((i,m)=>{S.paths[i]=moved[m];});}
    else return;
    saveShapeKeyed(S.paths);
  },true);
  function saveShapeKeyed(paths){put(t=>{t.shadow={...t.shadow,paths:structuredClone(paths)};return t;},{key:'ft-nudge'+selected,renderAll:false,message:'Nudged (Shift ×10).'});}
  addEventListener('resize',()=>{lastKey='';sync();});
  return {
    setSource(v){source=v;fromFilm.clear();lastKey='';},has,titles,ticks,lane,snapTargets,panel:panelHtml,chapterFields,header,
    selectedId:()=>selected,select,clear,editing:()=>editing,sync,fontsLoaded,measure,
    toggleShown(){shown=!shown;lastKey='';sync();return shown;},shown:()=>shown,
    fitted:t=>fittedPaths(t,measure),
  };
}
