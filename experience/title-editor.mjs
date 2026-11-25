import {titleLines,expandedLines,LINES,ANCHOR,FILM_W,FONT_REAL,DESC,BOX_BLUR,BOX_OPACITY,BLUR_SIGMA,chapterTitles,cutRule,timingNotes,cleanFilmTitles,shadowOf,fittedPaths,textBounds,lineState,pathTiming,restTime,svgPath,bounds,nearestOnPath,insertPoint,deletePoint,toggleSmooth,moveHandle,movePoint,transformPaths,pointCount,placeOf,newTitle,duplicateTitle,MAX_TITLES,NEW_TITLE_SECONDS,lineGaps,withGap,GAPS,SKEW_ITALIC,cleanTypography,FALLBACK,ASC,splitTitle,pasteTitles,shiftTitles,withLine,newTitleId} from './film-titles.mjs';
import {stackRows,rowVar} from './lane-rows.mjs';
import {endCardOf,mergedEndCard,cleanEndCard,logoBox,ctaLayout,spans as endSpans,filmFadeAt,logoAlpha,ctaState,CTA_FONTS,LOGO_DEFAULT,CTA_DEFAULT,LOGO_FADE} from './end-card.mjs';
// Film titles in Director Mode: the TITLES lane (one block per title card: drag to move, edges to trim), the Title
// inspector (copy, timing, shadow) and the title overlay in the 16:9 frame, drawn as finish-intro.py burns it in.
// "Edit shadow shape" turns the overlay into a point editor for the soft shape behind the copy (Figma-style):
// click a point to select it, drag it or its handles, Alt-drag a handle to break it, double-click (or Alt-click) a
// point for smooth / sharp, click an edge to add a point, Delete removes it, drag inside a shape to move it,
// the frame's corner and edge squares scale the selection (Shift keeps proportions, Alt scales from the centre).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const oneLine=v=>String(v??'').replace(/\s*\n\s*/g,' ').trim();
const lineRows=(v,min=1)=>Math.max(min,Math.min(5,String(v??'').split('\n').length));
const r2=v=>Number((+v).toFixed(2));
const FONT_URL=new URL('../app-reference/assets/google_fonts/',import.meta.url).href;
const FAMILY={700:'EF Film Poppins Bold',600:'EF Film Poppins SemiBold',500:'EF Film Poppins Medium',400:'EF Film Poppins'};
const FONT_FILES=[['Poppins-Bold.ttf',700],['Poppins-SemiBold.ttf',600],['Poppins-Medium.ttf',500],['Poppins-Regular.ttf',400]];
const NS='http://www.w3.org/2000/svg';
// The end card's wordmark: the film's own post/logo-color.png (the cut folders link to this copy).
const LOGO_URL=new URL('../exports/cinematic-intro-20261030/post/logo-color.png',import.meta.url).href;
export async function loadTitleSource(filmList,base=location.href,fetcher=globalThis.fetch){
  const url=new URL(filmList,base),get=async name=>{const r=await fetcher(new URL(name,url).href,{cache:'no-store'});if(!r.ok)throw Error(`${name} unavailable (${r.status})`);return r.json();};
  const [src,edl]=await Promise.all([get('titles-src.json'),get('edl.json').catch(()=>null)]);
  if(!Array.isArray(src?.titles))throw Error('titles-src.json has no titles.');
  return {src,edl};
}
export function createTitleEditor({panel,timeline,shot,time,seek,commit,status,render,renderTimeline,showInspector,onSelect,snapDelta,dragFeedback,endDragFeedback,ready,open}){
  let copiedLayout=null,cardDrag=null;
  // M3: several titles picked on the lane (multi, with `selected` the one the inspector shows), the line picked in the
  // frame (lineSel: 'eyebrow' | 'title' | 'detail'), a line being dragged, and the titles clipboard (Ctrl+C / Ctrl+V).
  const multi=new Set();let lineSel=null,lineDrag=null,clipboard=null;
  const CLIP_KEY='ergoflex.director.titleClipboard.v1';
  try{clipboard=JSON.parse(localStorage.getItem(CLIP_KEY)||'null');}catch{}
  const LINE_LABEL={eyebrow:'Eyebrow',title:'Headline',detail:'Supporting text'};
  let source=null,selected=null,editing=false,shown=true,fontsReady=false,drag=null,suppress=0,lastKey='';
  const fromFilm=new Map();
  // ---- fonts + measuring (libass sizes Poppins by its full height; no kerning, like the ASS overlay) -----------
  const canvas=document.createElement('canvas').getContext('2d'),widths=new Map();
  const fontsLoaded=Promise.all(FONT_FILES.map(async([file,w])=>{const f=new FontFace(FAMILY[w],`url(${FONT_URL}${file})`);await f.load();document.fonts.add(f);})).then(()=>{fontsReady=true;widths.clear();lastKey='';sync();if(selected)render();}).catch(error=>console.warn('[titles] fonts',error.message));
  // Runs of the text: Poppins, or the fallback font (glyphs Poppins lacks; FALLBACK) at its own size, like libass.
  const covered=new Map();
  function inPoppins(ch,w){
    const k=w+ch;if(covered.has(k))return covered.get(k);if(!fontsReady)return true;
    const width=f=>{canvas.font=`${w} 40px "${FAMILY[w]}", ${f}`;return canvas.measureText(ch).width;};
    const v=/\s/.test(ch)||width('monospace')===width('cursive');covered.set(k,v);return v;
  }
  function runs(L,text){const out=[];for(const ch of text){const fb=!inPoppins(ch,L.weight);if(out.length&&out.at(-1).fb===fb)out.at(-1).text+=ch;else out.push({text:ch,fb});}return out;}
  const fontOf=(L,fb,k=1)=>fb?`${L.weight} ${L.size/FALLBACK.real*k}px "${FALLBACK.family}", sans-serif`:`${L.weight} ${L.size/FONT_REAL*k}px "${FAMILY[L.weight]}", Poppins, sans-serif`;
  function measure(L,text){
    const key=JSON.stringify(L)+'|'+text+'|'+fontsReady;let w=widths.get(key);if(w!==undefined)return w;
    try{canvas.fontKerning='none';canvas.letterSpacing='0px';}catch{}
    w=0;for(const r of runs(L,text)){canvas.font=fontOf(L,r.fb,8);w+=canvas.measureText(r.text).width/8;}   // at 8x: no hinting, like libass
    w+=L.spacing*[...text].length;widths.set(key,w);return w;      // libass: spacing after every glyph (negative too, via \fsp)
  }
  // The line box grows when a fallback glyph's ascender reaches higher than Poppins' (libass BorderStyle 3).
  measure.rise=(L,text)=>runs(L,text).some(r=>r.fb)?L.size*Math.max(0,FALLBACK.asc-ASC):0;
  // ---- data -------------------------------------------------------------------------------------------------
  // Every film chapter (titles-src.json loaded) has the Titles lane and the Title tab, with or without titles (+ Title).
  const has=()=>!!source;
  function titles(){
    const s=shot();if(s.filmTitles)return s.filmTitles;if(!source)return [];
    let list=fromFilm.get(s.id);if(!list){list=cleanFilmTitles(chapterTitles(source.src,s.id),s.seconds)||[];fromFilm.set(s.id,list);}return list;
  }
  const rule=()=>source?.edl?cutRule(source.edl,shot().id):null;
  const item=()=>titles().find(t=>t.id===selected)||null;
  const edited=()=>!!shot().filmTitles||!!shot().endCard;
  // ---- the end card (end-card.mjs): the wordmark and the CTA of the chapter that has them (the hero) -------------
  // endSel: 'logo' | 'cta' (the inspector shows the end card instead of a title); shot.endCard: only the parts he changed.
  let endSel=null,laneEndDrag=null,endFrameDrag=null;
  const END_LABEL={logo:'Wordmark',cta:'CTA line'};
  const endFilm=()=>source?endCardOf(source.src,shot().id):null;
  const endCard=()=>{const f=endFilm();return f?mergedEndCard(f,shot().endCard):null;};
  const endFade=()=>source?.edl?filmFadeAt(source.edl,shot().id):null;
  // The card as drawn while a lane or frame drag is under way.
  function endView(){const c=endCard();if(!c)return null;if(laneEndDrag?.card)return laneEndDrag.card;if(endFrameDrag?.card)return endFrameDrag.card;return c;}
  function putEnd(change,{parts,key=null,message='',renderAll=true}={}){
    ready();const next=structuredClone(endCard());change(next);
    commit(()=>{const s=shot(),edit={...(s.endCard||{})};for(const p of parts)edit[p]=next[p];const c=cleanEndCard(edit,s.seconds);if(c)s.endCard=c;else delete s.endCard;},{render:renderAll,key});
    lastKey='';sync();if(message)status(message);
  }
  // Moving the wordmark carries the CTA by the same amount (it keeps its distance after the wordmark).
  function moveLogo(c,a,seconds){const d=a-c.logo.rel_in;c.logo.rel_in=a;const sp=c.cta.rel_out===null||c.cta.rel_out===undefined?null:c.cta.rel_out;
    const lim=sp===null?seconds-.5:seconds;const dd=Math.max(-c.cta.rel_in,Math.min(lim-(sp??c.cta.rel_in),d));c.cta.rel_in=r3(c.cta.rel_in+dd);if(sp!==null)c.cta.rel_out=r3(sp+dd);return c;}
  const r3=v=>Math.round(v*1000)/1000;
  // Where both end-card parts are fully in (for Select / Show): after the CTA's fade-in, before the film's fade.
  function endRest(c){const s=shot().seconds,f=endFade()??s,L=ctaLayout(c);return Math.max(0,Math.min(f-.05,s-.05,Math.max(c.logo.rel_in+LOGO_FADE,c.cta.rel_in+L.fade_in+.2)));}
  function selectEnd(part,{reveal=true}={}){
    const c=endCard();if(!c)return;onSelect();selected=null;multi.clear();lineSel=null;if(editing)setEditing(false,false);endSel=part;showInspector('title',true);
    if(reveal){try{seek(endRest(c)/shot().seconds);}catch{}}
    render();renderTimeline();lastKey='';sync();status(part==='logo'?'Wordmark selected. Drag its block to change when it comes in (the CTA follows), or drag it in the frame; edit it in Title.':'CTA line selected. Drag its block to move it, its edges to trim; drag it in the frame, or edit its copy and type in Title.');
  }
  function put(change,{key=null,message='',renderAll=true}={}){
    ready();const list=titles().map(t=>t.id===selected?change(structuredClone(t)):t);
    commit(()=>{const s=shot();s.filmTitles=cleanFilmTitles(list,s.seconds);const first=s.filmTitles[0];if(first){s.title=first.title||s.title;s.detail=first.detail;}},{render:renderAll,key});
    lastKey='';sync();if(message)status(message);
  }
  // Add / duplicate / delete: the chapter's whole list in one undo step (shot.filmTitles; [] = every title deleted).
  function putList(list,{select:id=null}={}){
    ready();commit(()=>{const s=shot();s.filmTitles=cleanFilmTitles(list,s.seconds);const first=s.filmTitles[0];if(first){s.title=first.title||s.title;s.detail=first.detail;}},{render:true});
    selected=id&&titles().some(t=>t.id===id)?id:null;if(!selected&&editing)setEditing(false,false);lastKey='';sync();
  }
  function addTitle(){
    const s=shot(),list=titles();if(list.length>=MAX_TITLES)throw Error(`A chapter holds ${MAX_TITLES} titles; delete one first.`);
    const t=newTitle(s.id,time()*s.seconds,s.seconds,list.map(x=>x.id));onSelect();
    putList([...list,t],{select:t.id});const message=`Title added at ${r2(t.rel_in)}–${r2(t.rel_out)} s. Type its copy in Title; Undo removes it.`;
    showInspector('title',true);try{seek(restTime(t)/s.seconds);}catch{}render();if(document.body.classList.contains('ef-phone'))requestAnimationFrame(()=>timeline.querySelector(`[data-title-clip="${t.id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'}));status(message);return t.id;
  }
  function duplicateSelected(){
    if(picked().length>1)return duplicateMany();
    const s=shot(),list=titles(),t=item();if(!t)throw Error('Select a title to duplicate.');if(list.length>=MAX_TITLES)throw Error(`A chapter holds ${MAX_TITLES} titles; delete one first.`);
    const c=duplicateTitle(t,s.id,s.seconds,list.map(x=>x.id));
    putList([...list,c],{select:c.id});showInspector('title',true);try{seek(restTime(c)/s.seconds);}catch{}render();status(`Title duplicated at ${r2(c.rel_in)}–${r2(c.rel_out)} s.`);return c.id;
  }
  function duplicateMany(){
    const s=shot(),list=titles(),src=picked();if(list.length+src.length>MAX_TITLES)throw Error(`A chapter holds ${MAX_TITLES} titles; delete some first.`);
    const ids=list.map(x=>x.id),copies=src.map(t=>{const c=duplicateTitle(t,s.id,s.seconds,ids);ids.push(c.id);return c;});
    putList([...list,...copies],{select:copies[0].id});for(const c of copies)multi.add(c.id);render();renderTimeline();status(`${copies.length} titles duplicated.`);return copies.map(c=>c.id);
  }
  function deleteSelected(){
    if(picked().length>1){const gone=new Set(picked().map(t=>t.id)),rest=titles().filter(x=>!gone.has(x.id));multi.clear();putList(rest,{});render();status(`${gone.size} titles deleted. Undo brings them back.`);return;}
    const t=item();if(!t)throw Error('Select a title to delete.');const rest=titles().filter(x=>x.id!==t.id);
    putList(rest,{});render();status(`Title “${oneLine(t.title||t.eyebrow)||'untitled'}” deleted.${rest.length?'':' This chapter now has no titles.'} Undo brings it back.`);
  }
  function splitSelected(){
    const s=shot(),t=item();if(!t)throw Error('Select a title to split.');const at=time()*s.seconds,list=titles();
    if(list.length>=MAX_TITLES)throw Error(`A chapter holds ${MAX_TITLES} titles; delete one first.`);
    const [a,b]=splitTitle(t,at,s.id,s.seconds,list.map(x=>x.id));multi.clear();
    putList([...list.filter(x=>x.id!==t.id),a,b],{select:b.id});render();status(`Title split at ${r2(at)} s: ${r2(a.rel_in)}–${r2(a.rel_out)} s and ${r2(b.rel_in)}–${r2(b.rel_out)} s. Undo joins them again.`);return b.id;
  }
  function copySelected(){
    const list=picked();if(!list.length)throw Error('Select a title to copy.');clipboard=structuredClone(list);try{localStorage.setItem(CLIP_KEY,JSON.stringify(clipboard));}catch{}
    render();status(`${list.length} title${list.length===1?'':'s'} copied. Ctrl+V pastes at the playhead (in any chapter).`);
  }
  function pasteAtPlayhead(){
    if(!clipboard?.length)throw Error('Copy a title first (Ctrl+C).');const s=shot(),list=titles();
    if(list.length+clipboard.length>MAX_TITLES)throw Error(`A chapter holds ${MAX_TITLES} titles; delete some first.`);
    const add=pasteTitles(clipboard,time()*s.seconds,s.id,s.seconds,list.map(x=>x.id));onSelect();multi.clear();
    putList([...list,...add],{select:add[0].id});for(const t of add)multi.add(t.id);showInspector('title',true);render();renderTimeline();
    status(`${add.length} title${add.length===1?'':'s'} pasted at ${r2(add[0].rel_in)} s.`);return add.map(t=>t.id);
  }
  function putTiming(id,a,b,message){
    ready();const s=shot(),list=titles().map(t=>t.id===id?{...t,rel_in:a,rel_out:b,timed:true}:t);
    commit(()=>{s.filmTitles=cleanFilmTitles(list,s.seconds);},{render:true});selected=id;lastKey='';sync();
    const t=item(),notes=t?timingNotes(t,rule()):[];status(message+(notes.length?' Note: '+notes[0]+' The film keeps your timing.':''));
  }
  // ---- selection --------------------------------------------------------------------------------------------
  function select(id,{reveal=true,keepMulti=false}={}){
    if(id==='end-logo'||id==='end-cta'){selectEnd(id.slice(4),{reveal});return;}
    endSel=null;onSelect();if(id!==selected)lineSel=null;selected=id;if(!keepMulti)multi.clear();const t=item();if(!t)return;showInspector('title',true);
    if(reveal){try{seek(restTime(t)/shot().seconds);}catch{}}
    render();if(document.body.classList.contains('ef-phone'))requestAnimationFrame(()=>timeline.querySelector(`[data-title-clip="${t.id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'}));status('Title selected. Drag its block to move it, its edges to trim, or edit its copy and shadow in Title.');
  }
  function clear(){if(!selected&&!editing&&!multi.size&&!endSel)return false;selected=null;endSel=null;multi.clear();lineSel=null;setEditing(false,false);return true;}
  // The picked titles: the lane's multi-selection plus the inspector's title, in film order.
  function picked(){const ids=new Set(multi);if(selected)ids.add(selected);return titles().filter(t=>ids.has(t.id));}
  // While the shape is edited, the inspector's message line keeps this hint (director.mjs renders it there).
  const SHAPE_HINT='Editing the shadow: drag points · double-click smooth/sharp · Alt-drag breaks a handle · Enter when done';
  function setEditing(on,announce=true){
    if(on&&!item())return;editing=on;shape.pt=null;shape.sel=on?new Set(shadowOf(item(),measure).paths.map((_,i)=>i)):new Set();
    document.body.classList.toggle('title-shape-editing',editing);lastKey='';sync();
    const b=panel.querySelector('[data-title-action=edit-shadow]');if(b){b.setAttribute('aria-pressed',String(editing));b.textContent=editing?'Done editing shape':'Edit shadow shape';}
    if(announce)status(editing?SHAPE_HINT:'Shadow editing done.');
  }
  // ---- timeline lane ----------------------------------------------------------------------------------------
  function ticks(){return titles().map(t=>t.rel_in);}
  function lane(){
    const s=shot().seconds,R=rule(),list=titles();
    const zone=R?.cutDone!==undefined?`<span class="title-cut-zone" style="width:${Math.min(100,R.cutDone/s*100)}%" title="The transition from the previous chapter (done at ${r2(R.cutDone)} s)"></span>`:'';
    const mark=R?.earliest!==undefined?`<span class="title-rule" data-title-rule style="left:${R.earliest/s*100}%" title="1.5 s after the cut (${r2(R.earliest)} s): the film's titles come in from here"><i>1.5 s after cut</i></span>`:'';
    const EC=endView(),ES=EC?endSpans(EC,s):null,FA=EC?endFade():null;
    const layers=stackRows([...list.map(t=>({id:t.id,start:t.rel_in,end:t.rel_out})),...(ES?[{id:'end-logo',start:ES.logo[0],end:ES.logo[1]},{id:'end-cta',start:ES.cta[0],end:ES.cta[1]}]:[])]),blocks=list.map(t=>{const notes=timingNotes(t,R),early=R?.earliest!==undefined&&t.rel_in<R.earliest-1e-6,custom=!!t.shadow?.paths;
      return `<button class="desk-clip title-clip ${selected===t.id||multi.has(t.id)?'selected':''} ${early?'early':''}" data-title-clip="${t.id}" style="${rowVar(layers,t.id)}left:${t.rel_in/s*100}%;width:${(t.rel_out-t.rel_in)/s*100}%" aria-pressed="${selected===t.id||multi.has(t.id)}" aria-label="Title ${escape(oneLine(t.title))}, ${r2(t.rel_in)} to ${r2(t.rel_out)} seconds" title="${escape([oneLine(t.eyebrow),oneLine(t.title)].filter(Boolean).join(' · '))} · ${r2(t.rel_in)}–${r2(t.rel_out)}s${custom?' · custom shadow':''}${notes.length?' · '+escape(notes.join(' ')):''} (drag to move, edges to trim)"><span class="clip-resize" data-resize="start" title="Trim the title's in point"></span><strong>${t.eyebrow?`<em>${escape(oneLine(t.eyebrow))}</em> `:''}${escape(oneLine(t.title)||'(no headline)')}</strong><small>${r2(t.rel_in)}–${r2(t.rel_out)}s${custom?' · custom shadow':''}${early?' · before the 1.5 s mark':''}</small><span class="clip-resize" data-resize="end" title="Trim the title's out point"></span></button>`;}).join('');
    const endBlocks=ES?['logo','cta'].map(k=>{const [a,b]=ES[k],on=endSel===k,label=k==='logo'?'ErgoFlex wordmark':`“${oneLine(EC.cta.text)}”`,tail=k==='logo'||EC.cta.rel_out==null?'end':`${r2(b)}s`;
      return `<button class="desk-clip title-clip end-clip end-${k} ${on?'selected':''}" data-end-clip="${k}" style="${rowVar(layers,'end-'+k)}left:${a/s*100}%;width:${(b-a)/s*100}%" aria-pressed="${on}" aria-label="End card ${END_LABEL[k]}, from ${r2(a)} seconds" title="End card · ${escape(END_LABEL[k])}${k==='cta'?' · '+escape(oneLine(EC.cta.text)):''} · ${r2(a)} s to the ${tail==='end'?'film\'s end':tail} (drag to move${k==='cta'?', edges to trim':'; the CTA follows'})"><span class="clip-resize" data-resize="start" title="${k==='logo'?'When the wordmark comes in':'Trim the CTA\'s in point'}"></span><strong><em>END CARD</em> ${escape(label)}</strong><small>${r2(a)}–${tail}${shot().endCard?.[k]?' · edited':''}</small><span class="clip-resize" data-resize="end" title="Trim the CTA's out point (to the end: it fades with the film)"></span></button>`;}).join(''):'';
    const fade=FA!==null&&FA!==undefined&&FA<s?`<span class="title-film-fade" data-film-fade style="left:${Math.max(0,FA)/s*100}%;width:${(s-Math.max(0,FA))/s*100}%" title="The film fades to black from ${r2(FA)} s (the last 1.4 s): the wordmark and the CTA fade out with it"><i>film fade</i></span>`:'';
    return `<div class="desk-lane-row ${layers.count>1?'layered':''}" data-lane-color="titles" style="--rows:${layers.count}"><span class="desk-lane-label" title="The film's title cards (titles-src.json): drag a block to move it, its edges to trim, click it to edit the copy and the shadow">Titles${edited()?' <small>edited</small>':''} <button class="title-add" data-title-add type="button" title="Add a title at the playhead (placeholder copy, ${NEW_TITLE_SECONDS} s)" aria-label="Add a title at the playhead" ${list.length>=MAX_TITLES?'disabled':''}>+ Title</button></span><div class="desk-lane title-lane" data-title-lane role="group" aria-label="Film titles timeline"><div class="desk-lane-line"></div>${zone}${mark}${blocks}${endBlocks}${fade}<div class="camera-track-playhead" data-shared-playhead style="left:${time()*100}%"></div></div></div>`;
  }
  function snapTargets(exclude){
    const out=[];for(const t of titles())if(t.id!==exclude)out.push([t.rel_in,`${oneLine(t.title)||'title'} in`],[t.rel_out,`${oneLine(t.title)||'title'} out`]);
    const R=rule();if(R?.earliest!==undefined)out.push([R.earliest,'the 1.5 s-after-cut mark']);if(R?.cutDone!==undefined)out.push([R.cutDone,'the end of the transition']);
    const EC=endCard();if(EC){if(exclude!=='end-logo')out.push([EC.logo.rel_in,'the wordmark']);if(exclude!=='end-cta'){out.push([EC.cta.rel_in,'the CTA in']);if(EC.cta.rel_out!=null)out.push([EC.cta.rel_out,'the CTA out']);}const F=endFade();if(F!==null)out.push([F,'the film fade']);}
    return out;
  }
  // Drag a block (move) or an edge (trim); Magnet / snap / Alt like the other lanes; one undo step per drag.
  timeline.addEventListener('pointerdown',event=>{
    const el=event.target.closest('[data-title-clip]');if(!el||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    try{ready();}catch(error){status(error.message,true);return;}
    const t=titles().find(x=>x.id===el.dataset.titleClip);if(!t)return;
    if(event.shiftKey||event.ctrlKey||event.metaKey){togglePick(t.id);suppress=performance.now()+300;return;}
    const lane=el.closest('[data-title-lane]'),edge=event.target.closest('[data-resize]')?.dataset.resize||null;
    drag={id:t.id,kind:'titles',edge,el,start:event.clientX,width:lane.getBoundingClientRect().width,base:{seconds:shot().seconds,titles:structuredClone(titles())},original:t,delta:0,set:{},moved:false,candidate:null};
    if(!edge&&multi.size>1&&multi.has(t.id))drag.group=picked().map(x=>x.id);
    el.setPointerCapture(event.pointerId);el.focus({preventScroll:true});
  });
  timeline.addEventListener('pointerdown',event=>{
    const el=event.target.closest('[data-end-clip]');if(!el||event.button!==0)return;event.preventDefault();event.stopPropagation();
    try{ready();}catch(error){status(error.message,true);return;}const c=endCard();if(!c)return;const part=el.dataset.endClip,lane=el.closest('[data-title-lane]');
    let edge=event.target.closest('[data-resize]')?.dataset.resize||null;if(part==='logo')edge='start';
    const [a,b]=endSpans(c,shot().seconds)[part];
    laneEndDrag={part,edge,el,start:event.clientX,width:lane.getBoundingClientRect().width,seconds:shot().seconds,base:c,card:null,moved:false,
      id:'end-'+part,kind:'titles',original:{id:'end-'+part,rel_in:a,rel_out:b}};laneEndDrag.base.titles=[laneEndDrag.original];
    el.setPointerCapture(event.pointerId);el.focus({preventScroll:true});
  });
  timeline.addEventListener('pointermove',event=>{
    const d=laneEndDrag;if(!d)return;if(Math.abs(event.clientX-d.start)>(event.pointerType==='touch'?8:3))d.moved=true;if(!d.moved)return;
    const s=d.seconds,o=d.original,raw=(event.clientX-d.start)/d.width*s,edges=d.edge==='start'?[o.rel_in]:d.edge==='end'?[o.rel_out]:[o.rel_in,o.rel_out];
    const r=snapDelta({raw,edges,width:d.width,seconds:s,alt:event.altKey,exclude:o.id})||{},delta=Number.isFinite(r.delta)?r.delta:raw,c=structuredClone(d.base);delete c.titles;
    if(d.part==='logo')moveLogo(c,r3(Math.max(0,Math.min(s-.5,o.rel_in+delta))),s);
    else if(d.edge==='start')c.cta.rel_in=r3(Math.max(0,Math.min(o.rel_out-.5,o.rel_in+delta)));
    else if(d.edge==='end'){const v=Math.max(o.rel_in+.5,Math.min(s,o.rel_out+delta));c.cta.rel_out=v>=s-.02?null:r3(v);}
    else{const dd=Math.max(-o.rel_in,Math.min(s-o.rel_out,delta));c.cta.rel_in=r3(o.rel_in+dd);if(c.cta.rel_out!=null)c.cta.rel_out=r3(o.rel_out+dd);}
    d.card=c;d.snap=r.snap;const sp=endSpans(c,s);
    for(const k of ['logo','cta']){const b=timeline.querySelector(`[data-end-clip="${k}"]`);if(!b)continue;const [a,e]=sp[k];b.style.left=a/s*100+'%';b.style.width=(e-a)/s*100+'%';const sm=b.querySelector('small');if(sm)sm.textContent=`${r2(a)}–${k==='logo'||c.cta.rel_out==null?'end':r2(e)+'s'}`;}
    d.candidate=sp[d.part];dragFeedback(d,event);lastKey='';sync();
    status(d.part==='logo'?`Wordmark in at ${r2(c.logo.rel_in)} s (the CTA follows: ${r2(c.cta.rel_in)} s) · the score's logo hit is re-fitted to it after the import${r.snap?' · snapped to '+r.snap.name:''} · Alt: bypass snap`
      :`CTA ${r2(c.cta.rel_in)}–${c.cta.rel_out==null?'the film\'s end':r2(c.cta.rel_out)+' s'}${r.snap?' · snapped to '+r.snap.name:''} · Alt: bypass snap`);
  });
  function endLaneDrag(event){
    const d=laneEndDrag;if(!d)return;laneEndDrag=null;endDragFeedback(d);suppress=performance.now()+300;
    if(event.type==='pointercancel'||!d.moved||!d.card){if(event.type!=='pointercancel'&&!d.moved)selectEnd(d.part);else{renderTimeline();lastKey='';sync();}return;}
    const c=d.card;endSel=d.part;
    putEnd(x=>{x.logo=c.logo;x.cta=c.cta;},{parts:d.part==='logo'?['logo','cta']:['cta'],message:d.part==='logo'?`Wordmark now comes in at ${r2(c.logo.rel_in)} s; the CTA moved with it (${r2(c.cta.rel_in)} s). The score's logo hit will be re-fitted to the wordmark after the import.`:`CTA now ${r2(c.cta.rel_in)}–${c.cta.rel_out==null?'the film\'s end':r2(c.cta.rel_out)+' s'}.`});
    renderTimeline();
  }
  timeline.addEventListener('pointerup',endLaneDrag);timeline.addEventListener('pointercancel',endLaneDrag);
  timeline.addEventListener('keydown',event=>{
    const el=event.target.closest('[data-end-clip]');if(!el||!['ArrowLeft','ArrowRight','Enter'].includes(event.key))return;event.preventDefault();event.stopPropagation();
    if(event.key==='Enter'){selectEnd(el.dataset.endClip);return;}endSel=el.dataset.endClip;try{nudgeEnd((event.shiftKey?1:.1)*(event.key==='ArrowLeft'?-1:1));timeline.querySelector(`[data-end-clip="${endSel}"]`)?.focus();}catch(error){status(error.message,true);}
  });
  // Timing nudge of the selected end-card part (arrows on its block, Alt+arrows): the wordmark carries the CTA.
  function nudgeEnd(delta){
    const c=endCard();if(!c||!endSel)return false;const s=shot().seconds;
    if(endSel==='logo'){const a=r3(Math.max(0,Math.min(s-.5,c.logo.rel_in+delta)));putEnd(x=>moveLogo(x,a,s),{parts:['logo','cta'],message:`Wordmark nudged to ${r2(a)} s (the CTA follows). The score's logo hit is re-fitted after the import.`});}
    else{const [a,b]=endSpans(c,s).cta,dd=Math.max(-a,Math.min(s-b,delta));putEnd(x=>{x.cta.rel_in=r3(a+dd);if(x.cta.rel_out!=null)x.cta.rel_out=r3(b+dd);},{parts:['cta'],message:`CTA nudged to ${r2(a+dd)} s.`});}
    renderTimeline();return true;
  }
  function togglePick(id){
    if(!multi.size&&selected)multi.add(selected);if(multi.has(id))multi.delete(id);else multi.add(id);
    const keep=selected&&multi.has(selected)?selected:[...multi][0]||null;onSelect();selected=keep;lineSel=null;
    if(selected)showInspector('title',true);render();renderTimeline();lastKey='';sync();
    status(multi.size>1?`${multi.size} titles selected: drag one to move them together; Delete, Ctrl+D, Ctrl+C work on all.`:selected?'Title selected.':'Selection cleared.');
  }
  function pickMany(ids){if(!ids.length)return;onSelect();multi.clear();for(const id of ids)multi.add(id);selected=ids[0];lineSel=null;showInspector('title',true);render();renderTimeline();lastKey='';sync();
    status(`${ids.length} title${ids.length===1?'':'s'} selected.`);}
  timeline.addEventListener('pointermove',event=>{
    if(!drag)return;const d=drag,s=d.base.seconds,o=d.original;if(Math.abs(event.clientX-d.start)>(event.pointerType==='touch'?8:3))d.moved=true;if(!d.moved)return;
    const raw=(event.clientX-d.start)/d.width*s,edges=d.edge==='start'?[o.rel_in]:d.edge==='end'?[o.rel_out]:[o.rel_in,o.rel_out];
    const {delta,snap}=snapDelta({raw,edges,width:d.width,seconds:s,alt:event.altKey,exclude:o.id});d.snap=snap;
    if(d.group){const {delta:dd,list}=shiftTitles(d.base.titles,d.group,delta,s);d.candidate=list;d.delta=dd;
      for(const x of list)if(d.group.includes(x.id)){const b=timeline.querySelector(`[data-title-clip="${x.id}"]`);if(b){b.style.left=x.rel_in/s*100+'%';const sm=b.querySelector('small');if(sm)sm.textContent=`${r2(x.rel_in)}–${r2(x.rel_out)}s`;}}
      dragFeedback(d,event);status(`${d.group.length} titles ${dd>=0?'+':''}${r2(dd)} s${snap?' · snapped to '+snap.name:''} · Alt: bypass snap`);return;}
    let a=o.rel_in,b=o.rel_out;
    // (a drag follows the finger exactly; only the chapter's ends and the 0.5 s minimum stop it, and the status says so)
    let stop='';
    if(d.edge==='start'){const w=o.rel_in+delta;a=Math.max(0,Math.min(b-.5,w));stop=w<0?'the chapter start':w>b-.5?'the 0.5 s minimum':'';}
    else if(d.edge==='end'){const w=o.rel_out+delta;b=Math.max(a+.5,Math.min(s,w));stop=w>s?'the chapter end':w<a+.5?'the 0.5 s minimum':'';}
    else{const dd=Math.max(-o.rel_in,Math.min(s-o.rel_out,delta));a=o.rel_in+dd;b=o.rel_out+dd;stop=delta<-o.rel_in-1e-6?'the chapter start':delta>s-o.rel_out+1e-6?'the chapter end':'';}
    d.stop=stop;
    a=Math.round(a*1000)/1000;b=Math.round(b*1000)/1000;d.candidate=[a,b];d.delta=d.edge==='end'?b-o.rel_out:a-o.rel_in;
    d.el.style.left=a/s*100+'%';d.el.style.width=(b-a)/s*100+'%';const small=d.el.querySelector('small');if(small)small.textContent=`${r2(a)}–${r2(b)}s`;
    const early=rule()?.earliest!==undefined&&a<rule().earliest-1e-6;d.el.classList.toggle('early',early);
    dragFeedback(d,event);
    status(`${d.edge==='start'?'In':d.edge==='end'?'Out':'Title'} ${r2(a)}–${r2(b)} s · ${r2(b-a)} s on screen${early?' · before the 1.5 s-after-cut mark':''}${stop?' · stopped at '+stop:''}${snap?' · snapped to '+snap.name:''} · Alt: bypass snap`);
  });
  function endDrag(event){
    if(!drag)return;const d=drag;drag=null;endDragFeedback(d);suppress=performance.now()+300;
    if(event.type==='pointercancel'){renderTimeline();return;}
    if(d.group&&d.moved&&d.candidate){const keep=[...multi];putList(d.candidate,{select:d.id});for(const id of keep)multi.add(id);renderTimeline();status(`${d.group.length} titles moved ${d.delta>=0?'+':''}${r2(d.delta)} s.`);return;}
    if(!d.moved||!d.candidate){select(d.id);return;}
    onSelect();endSel=null;selected=d.id;showInspector('title',true);putTiming(d.id,d.candidate[0],d.candidate[1],d.edge?`Title ${d.edge==='start'?'in point':'out point'} trimmed: ${r2(d.candidate[0])}–${r2(d.candidate[1])} s${d.stop?' (stopped at '+d.stop+')':''}.`:`Title moved to ${r2(d.candidate[0])}–${r2(d.candidate[1])} s${d.stop?' (stopped at '+d.stop+')':''}.`);
  }
  timeline.addEventListener('pointerup',endDrag);timeline.addEventListener('pointercancel',endDrag);
  // Marquee (drag on empty lanes, director.mjs's own gesture): title blocks it crosses are picked as well, after the
  // director's own selection settles. Shift / Ctrl add to the picked titles.
  let band=null;
  timeline.addEventListener('pointerdown',event=>{band=null;if(event.button!==0||event.target.closest('[data-title-clip],[data-end-clip],button,select,input,label,.time-ruler,.lane-group-head,.desk-lane-label')||!event.target.closest('.timeline-content'))return;
    band={x:event.clientX,y:event.clientY,add:event.shiftKey||event.ctrlKey||event.metaKey};},true);
  addEventListener('pointerup',event=>{const b=band;band=null;if(!b||Math.hypot(event.clientX-b.x,event.clientY-b.y)<5)return;
    const r={x0:Math.min(b.x,event.clientX),x1:Math.max(b.x,event.clientX),y0:Math.min(b.y,event.clientY),y1:Math.max(b.y,event.clientY)};
    const hit=[...timeline.querySelectorAll('[data-title-clip]')].filter(el=>{const q=el.getBoundingClientRect();return q.right>=r.x0&&q.left<=r.x1&&q.bottom>=r.y0&&q.top<=r.y1;}).map(el=>el.dataset.titleClip);
    if(!hit.length)return;const prior=b.add?picked().map(t=>t.id):[];setTimeout(()=>pickMany([...new Set([...prior,...hit])]),0);},true);
  timeline.addEventListener('click',event=>{
    if(event.target.closest('[data-title-add]')){event.preventDefault();event.stopPropagation();try{addTitle();}catch(error){status(error.message,true);}return;}
    if(event.target.closest('[data-title-clip],[data-end-clip]')){if(performance.now()<suppress){event.preventDefault();event.stopPropagation();}return;}
    const rail=event.target.closest('[data-title-lane]');if(!rail)return;try{const r=rail.getBoundingClientRect();seek(Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)));}catch(error){status(error.message,true);}
  });
  timeline.addEventListener('keydown',event=>{
    const el=event.target.closest('[data-title-clip]');if(!el||!['ArrowLeft','ArrowRight','Enter','Delete','Backspace'].includes(event.key))return;event.preventDefault();
    if(event.key==='Enter'){select(el.dataset.titleClip);return;}
    if(event.key==='Delete'||event.key==='Backspace'){event.stopPropagation();try{selected=el.dataset.titleClip;deleteSelected();}catch(error){status(error.message,true);}return;}
    try{const t=titles().find(x=>x.id===el.dataset.titleClip),s=shot().seconds,d=(event.shiftKey?1:.1)*(event.key==='ArrowLeft'?-1:1),dd=Math.max(-t.rel_in,Math.min(s-t.rel_out,d));
      putTiming(t.id,Math.round((t.rel_in+dd)*1000)/1000,Math.round((t.rel_out+dd)*1000)/1000,`Title nudged to ${r2(t.rel_in+dd)}–${r2(t.rel_out+dd)} s.`);timeline.querySelector(`[data-title-clip="${t.id}"]`)?.focus();}catch(error){status(error.message,true);}
  });
  // ---- inspector --------------------------------------------------------------------------------------------
  function header(){if(endSel&&endCard()){const c=endCard(),[a]=endSpans(c,shot().seconds)[endSel];return `<div class="sel-row"><span class="sel-icon">E</span><span class="sel-name"><b>${escape('End card · '+(endSel==='logo'?'Wordmark':oneLine(c.cta.text)||'CTA'))}</b><small>from ${r2(a)} s${shot().endCard?.[endSel]?' · edited':''}</small></span><button data-action="sel-clear" title="Deselect (Esc)" aria-label="Deselect">×</button></div>`;}
    const t=item();if(!t)return '';return `<div class="sel-row"><span class="sel-icon">T</span><span class="sel-name"><b>${escape('Title · '+(oneLine(t.title||t.eyebrow)||'untitled'))}</b><small>${r2(t.rel_in)}–${r2(t.rel_out)} s${t.shadow?.paths?' · custom shadow':''}</small></span><button data-action="sel-clear" title="Deselect (Esc)" aria-label="Deselect">×</button></div>`;}
  function list(){
    return titles().map((t,i)=>`<button class="title-pick ${selected===t.id?'selected':''}" data-title-action="pick" data-title-id="${t.id}" title="Edit this title"><b>${i+1}</b><span>${t.eyebrow?`<em>${escape(oneLine(t.eyebrow))}</em> · `:''}${escape(oneLine(t.title)||'(no headline)')}</span><small>${r2(t.rel_in)}–${r2(t.rel_out)} s</small></button>`).join('');
  }
  // The Chapter tab's Headline / Supporting text: the chapter's first film title (the card the film shows).
  function chapterFields(){
    if(!has()||!titles().length)return null;const all=titles(),t=all[0];
    return `<div class="film-title-fields"><p class="director-hint">${all.length>1?`The film shows ${all.length} titles in this chapter; these fields are title 1. Pick a title below (or on the Titles lane) for the others, its timing and its shadow.`:'The film title of this chapter (titles-src.json). Press Enter inside any field for a second line.'}</p>
      <label>Eyebrow<textarea name="ft-eyebrow" data-title-id="${t.id}" rows="${lineRows(t.eyebrow)}" maxlength="60" placeholder="Press Enter for a new line">${escape(t.eyebrow)}</textarea></label>
      <label>Headline<textarea name="ft-title" data-title-id="${t.id}" rows="${lineRows(t.title)}" maxlength="140" placeholder="Press Enter for a new line">${escape(t.title)}</textarea></label>
      <label>Supporting text<textarea name="ft-detail" data-title-id="${t.id}" rows="${lineRows(t.detail,2)}" maxlength="260" placeholder="Press Enter for a new line">${escape(t.detail)}</textarea></label>
      <div class="title-list">${list()}</div></div>`;
  }
  function typeControls(t,key){const L=titleLines(t).find(l=>l.key===key);return `<div class="director-grid"><label>Font<select data-type="weight" data-line="${key}">${[[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold']].map(([w,n])=>`<option value="${w}" ${w===L.weight?'selected':''}>Poppins ${n}</option>`).join('')}</select></label><label>Font size<input type="number" min="8" max="300" data-type="size" data-line="${key}" value="${L.size}"></label><label>Letter spacing<input type="number" min="-10" max="40" step=".1" data-type="spacing" data-line="${key}" value="${L.spacing}"></label><label>Text color<input type="color" data-type="color" data-line="${key}" value="${L.color}"></label><label>Style<select data-type="italic" data-line="${key}"><option value="false" ${!L.italic?'selected':''}>Normal</option><option value="true" ${L.italic?'selected':''}>Italic</option></select></label><label>Move right (px)<input type="number" step="1" data-type="dx" data-line="${key}" value="${L.dx}" title="Moves this line alone, in film pixels (0 = the film's place)"></label><label>Move down (px)<input type="number" step="1" data-type="dy" data-line="${key}" value="${r2(L.y-LINES.find(l=>l.key===key).y)}" title="Moves this line alone, in film pixels (0 = the film's place)"></label></div>`;}
  panel.addEventListener('input',event=>{const el=event.target;if(!el.dataset.type)return;event.stopPropagation();const key=el.dataset.type,value=key==='color'?el.value:key==='italic'?el.value==='true':Number(el.value);if(el.value===''||(typeof value==='number'&&!Number.isFinite(value)))return;try{put(t=>{t.typography={...t.typography,[el.dataset.line]:{...t.typography?.[el.dataset.line],[key]:value}};return t;},{key:'type-'+selected+el.dataset.line+key,renderAll:false});if(key==='dx'||key==='dy')syncLineFields();}catch(error){status(error.message,true);}},true);
  // Line spacing: baseline to baseline, eyebrow -> headline (the eyebrow moves) and headline -> supporting (it moves).
  const linesMoved=t=>titleLines(t).some(L=>L.dx||L.y!==LINES.find(l=>l.key===L.key).y);
  // After a live (no re-render) spacing / offset edit: the gap fields and Reset line positions follow.
  function syncLineFields(){const t=item();if(!t)return;const g=lineGaps(t);for(const [k,v] of Object.entries(g)){const el=panel.querySelector(`[data-gap="${k}"]`);if(el&&document.activeElement!==el)el.value=String(v);}
    const b=panel.querySelector('[data-title-action=reset-lines]');if(b)b.disabled=!linesMoved(t);}
  function spacingControls(t){const g=lineGaps(t),moved=linesMoved(t);
    return `<details open class="title-spacing"><summary>Line spacing</summary><div class="director-grid"><label>Eyebrow to headline (px)<input type="number" step="1" min="-400" max="600" data-gap="top" value="${g.top}" title="Baseline to baseline; the film's is ${GAPS.top}"></label><label>Headline to supporting (px)<input type="number" step="1" min="-400" max="600" data-gap="bottom" value="${g.bottom}" title="Baseline to baseline; the film's is ${GAPS.bottom}"></label></div><div class="director-actions"><button data-title-action="reset-lines" ${moved?'':'disabled'} title="Every line back to the film's place (${GAPS.top} / ${GAPS.bottom} px)">Reset line positions</button></div></details>`;}
  panel.addEventListener('input',event=>{const el=event.target;if(!el.dataset.gap)return;event.stopPropagation();const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;
    try{put(t=>{const typ=withGap(t,el.dataset.gap,Math.max(-400,Math.min(600,v)));if(typ)t.typography=typ;else delete t.typography;return t;},{key:'gap-'+selected+el.dataset.gap,renderAll:false});syncLineFields();status(`${el.dataset.gap==='top'?'Eyebrow to headline':'Headline to supporting text'}: ${v} px (the film's is ${GAPS[el.dataset.gap]}).`);}catch(error){status(error.message,true);}},true);
  // On a touch screen: buttons that move or trim the selected title in steps (a short block is hard to hit with a finger).
  const touch=()=>{try{return matchMedia('(pointer: coarse)').matches;}catch{return false;}};
  const NUDGES=[['move','-0.5','Move −0.5 s'],['move','0.5','Move +0.5 s'],['in','-0.1','In −0.1 s'],['in','0.1','In +0.1 s'],['out','-0.1','Out −0.1 s'],['out','0.1','Out +0.1 s']];
  const nudgeHtml=()=>touch()?`<div class="title-nudge" data-title-nudge>${NUDGES.map(([w,d,l])=>`<button type="button" data-title-action="nudge" data-nudge="${w}:${d}">${l}</button>`).join('')}</div>`:'';
  function nudge(spec){
    const t=item();if(!t)throw Error('Select a title first.');const [what,d]=spec.split(':'),step=Number(d),s=shot().seconds;let a=t.rel_in,b=t.rel_out;
    if(what==='in')a=Math.max(0,Math.min(b-.5,a+step));else if(what==='out')b=Math.max(a+.5,Math.min(s,b+step));
    else{const dd=Math.max(-a,Math.min(s-b,step));a+=dd;b+=dd;}
    a=Math.round(a*1000)/1000;b=Math.round(b*1000)/1000;putTiming(t.id,a,b,`Title ${what==='move'?'moved':what==='in'?'in point trimmed':'out point trimmed'}: ${r2(a)}–${r2(b)} s.`);
  }
  // The end card's picks (Title tab), and its inspector when one part is selected.
  function endPicks(){const c=endCard();if(!c)return '';const sp=endSpans(c,shot().seconds);
    return `<div class="title-list end-list"><p class="director-hint">End card (the film's last frames; not a title card)</p>${['logo','cta'].map(k=>`<button class="title-pick ${endSel===k?'selected':''}" data-title-action="end-pick" data-title-id="${k}" title="Edit the end card's ${END_LABEL[k]}"><b>E</b><span><em>END CARD</em> · ${escape(k==='logo'?'ErgoFlex wordmark':oneLine(c.cta.text))}</span><small>${r2(sp[k][0])} s</small></button>`).join('')}</div>`;}
  function endPanelHtml(){
    const c=endCard(),k=endSel,s=shot().seconds,F=endFade(),L=ctaLayout(c),B=logoBox(c.logo),ed=shot().endCard||{},film=endFilm();
    const moved=ed.logo&&Math.abs((ed.logo.rel_in??film.logo.rel_in)-film.logo.rel_in)>1e-6;
    const head=`<h3>End card <span class="inspector-subtitle">${k==='logo'?'the ErgoFlex wordmark':'the line under the wordmark'}</span></h3>${endPicks()}`;
    const reset=`<div class="director-actions"><button data-title-action="end-go" title="Move the playhead to where the wordmark and the CTA are both in">Show end card</button><button data-title-action="end-reset" data-title-id="${k}" ${ed[k]?'':'disabled'} title="Back to the film's ${END_LABEL[k]} (titles-src.json)">Reset ${k==='logo'?'wordmark':'CTA'}</button></div>`;
    const fadeNote=F!==null?`<p class="director-hint">The film fades to black from <b>${r2(F)} s</b> (its last 1.4 s); the end card fades out with it.</p>`:'';
    const scoreNote=`<p class="director-hint end-note" role="note" data-end-score-note>${moved?'<b>You moved the wordmark.</b> ':''}The score's logo hit lands on the wordmark's first frame, so moving the wordmark means the score gets re-fitted: Orch does that after the import (the film keeps your time). The CTA moves with the wordmark.</p>`;
    if(k==='logo')return `<div data-reveal="title">${head}<label>Comes in (seconds)<input name="ec-logo-in" type="number" min="0" max="${s}" step=".05" value="${r2(c.logo.rel_in)}"></label>${scoreNote}
      <label>Scale (%)<input name="ec-logo-scale" type="number" min="10" max="500" step="1" value="${Math.round((c.logo.scale??1)*100)}" title="100 % = the film's 22 % of the frame width"></label><div class="director-grid"><label>X centre (film pixels)<input name="ec-logo-x" type="number" step="1" value="${r2(B.x)}" title="The film's is ${LOGO_DEFAULT.x}"></label><label>Y centre (film pixels)<input name="ec-logo-y" type="number" step="1" value="${r2(B.y)}" title="The film's is ${r2(LOGO_DEFAULT.y)} (73 % of the height)"></label></div>
      <p class="director-hint">Drag the wordmark in the frame to move it; the CTA stays under it. It stays to the film's end.</p>${fadeNote}${reset}</div>`;
    return `<div data-reveal="title">${head}<label>Text<input name="ec-cta-text" maxlength="120" value="${escape(c.cta.text)}"></label>
      <div class="director-grid"><label>Font<select name="ec-cta-font">${CTA_FONTS.map(([f,n])=>`<option value="${f}" ${f===L.font?'selected':''}>${n}</option>`).join('')}</select></label><label>Font size<input name="ec-cta-size" type="number" min="8" max="300" step="1" value="${L.size}"></label><label>Letter spacing<input name="ec-cta-spacing" type="number" min="-10" max="40" step=".1" value="${L.spacing}"></label><label>Fade-in (seconds)<input name="ec-cta-fade" type="number" min="0" max="5" step=".05" value="${L.fade_in}"></label></div>
      <div class="director-grid"><label>X centre (film pixels)<input name="ec-cta-x" type="number" step="1" value="${r2(L.x)}" title="Empty or the wordmark's centre (${r2(B.x)}) keeps it on the wordmark's axis"></label><label>Gap under the wordmark (px)<input name="ec-cta-gap" type="number" step="1" value="${r2(c.cta.gap??0)}" title="From the wordmark's bottom to the line's top"></label></div>
      <div class="director-grid"><label>Comes in (seconds)<input name="ec-cta-in" type="number" min="0" max="${s}" step=".05" value="${r2(c.cta.rel_in)}"></label><label>Goes out (seconds)<input name="ec-cta-out" type="number" min="0" max="${s}" step=".05" value="${c.cta.rel_out==null?'':r2(c.cta.rel_out)}" placeholder="film end" title="Empty: to the film's end (it fades out with the film)"></label></div>
      <p class="director-hint">Drag the line in the frame to move it (sideways: X; up / down: the gap under the wordmark).</p>${fadeNote}${reset}</div>`;
  }
  function panelHtml(){
    if(!has())return '<p class="director-hint">This chapter has no film titles.</p>';
    if(endSel&&endCard())return endPanelHtml();
    const t=item(),full=titles().length>=MAX_TITLES,addBtn=`<button data-title-action="add" ${full?'disabled':''} title="A new title at the playhead with placeholder copy">+ Add title</button>`;
    if(!titles().length)return `<div data-reveal="title"><h3>Film titles</h3><p class="director-hint">This chapter has no titles${endCard()?' (the end card below is the wordmark and the CTA)':''}. Add one at the playhead, then type its copy.</p><div class="director-actions title-list-actions">${addBtn}</div>${endPicks()}</div>`;
    if(!t)return `<div data-reveal="title"><h3>Film titles</h3><p class="director-hint">Select a title on the Titles lane, or here, to edit its copy, timing and the shadow behind it.</p><div class="director-actions title-list-actions">${addBtn}</div><div class="title-list">${list()}</div>${endPicks()}</div>`;
    const R=rule(),notes=timingNotes(t,R),S=shadowOf(t,measure),n=titles().indexOf(t)+1,tb=textBounds(t,measure),bb=bounds(S.paths);
    const short=S.custom&&tb&&bb&&(tb.x1>bb.x1+2||tb.x0<bb.x0-2);
    return `<div data-reveal="title"><h3>Film title ${n} <span class="inspector-subtitle">of ${titles().length} in this chapter</span></h3><div class="title-list">${titles().length>1?list():''}</div>
      <div class="director-actions title-list-actions">${addBtn}<button data-title-action="duplicate" ${full?'disabled':''} title="A copy of this title (copy, layout, shadow) right after it (Ctrl+D)">Duplicate</button><button data-title-action="delete" title="Delete this title (Delete); Undo brings it back">Delete</button><button data-title-action="split" title="Split this title at the playhead into two (Ctrl/Cmd+K)">Split at playhead</button><button data-title-action="copy" title="Copy this title (Ctrl/Cmd+C)">Copy</button><button data-title-action="paste" ${clipboard?.length?'':'disabled'} title="Paste the copied title(s) at the playhead (Ctrl/Cmd+V)">Paste</button></div>${lineSel?`<p class="director-hint" data-line-hint>${LINE_LABEL[lineSel]} selected in the frame: drag it to move this line alone (it snaps to the other lines, the film's place and the safe margins; Alt: no snapping); arrows nudge 1 px (Shift 10). Esc goes back to the whole title.</p>`:''}
      <label>Title scale (%)<input name="ft-scale" type="number" min="10" max="500" step="1" value="${Math.round((t.scale??1)*100)}"></label><div class="director-grid"><label>X (film pixels)<input name="ft-x" type="number" step="1" value="${placeOf(t).x}"></label><label>Y (headline baseline)<input name="ft-y" type="number" step="1" value="${placeOf(t).anchor[1]}"></label></div><div class="director-actions"><button data-title-action="copy-layout">Copy layout</button><button data-title-action="paste-layout" ${copiedLayout?'':'disabled'}>Paste layout</button></div>${spacingControls(t)}<details open><summary>Text layers</summary><p class="director-hint">Press Enter inside Eyebrow, Headline, or Supporting text to break onto another line.</p><details open><summary>Eyebrow</summary><label>Eyebrow<textarea name="ft-eyebrow" rows="${lineRows(t.eyebrow)}" maxlength="60" placeholder="Press Enter for a new line">${escape(t.eyebrow)}</textarea></label>${typeControls(t,'eyebrow')}</details>
      <details open><summary>Headline</summary><label>Headline<textarea name="ft-title" rows="${lineRows(t.title)}" maxlength="140" placeholder="Press Enter for a new line">${escape(t.title)}</textarea></label>${typeControls(t,'title')}</details>
      <details open><summary>Supporting text</summary><label>Supporting text<textarea name="ft-detail" rows="${lineRows(t.detail,2)}" maxlength="260" placeholder="Press Enter for a new line">${escape(t.detail)}</textarea></label>${typeControls(t,'detail')}</details>
      </details><div class="director-grid"><label>Comes in (seconds)<input name="ft-in" type="number" min="0" max="${shot().seconds}" step=".05" value="${r2(t.rel_in)}"></label><label>Goes out (seconds)<input name="ft-out" type="number" min="0" max="${shot().seconds}" step=".05" value="${r2(t.rel_out)}"></label></div>${nudgeHtml()}
      <p class="director-hint title-rule-note">${R?.earliest!==undefined?`Film rule: titles come in at least 1.5 s after the cut, here from <b>${r2(R.earliest)} s</b>.`:'This chapter opens the film: no cut before it.'}${t.timed?' Your timing is kept as you set it.':''}</p>
      ${notes.map(x=>`<p class="title-warning" role="note">${escape(x)} The film keeps your timing.</p>`).join('')}
      <div class="director-actions">${R?.earliest!==undefined?`<button data-title-action="to-rule" title="Move the title so it comes in exactly at the 1.5 s-after-cut mark">Start at the 1.5 s mark</button>`:''}<button data-title-action="go" title="Move the playhead to where the whole title is in">Show title</button></div>
      <details open><summary>Shadow layer</summary><fieldset class="title-shadow"><legend>Shadow behind the text</legend>
      <p class="director-hint" data-title-shape-note>${S.custom?`Your own shape: ${S.paths.length} part${S.paths.length===1?'':'s'}, ${pointCount(S.paths)} points.`:'Fitted to each line of text, as the film has it now.'}</p>
      ${short?'<p class="title-warning" role="note">The text runs past the shadow shape. Widen the shape, or Reset to fitted.</p>':''}
      <div class="director-actions"><button data-title-action="edit-shadow" class="primary" aria-pressed="${editing}">${editing?'Done editing shape':'Edit shadow shape'}</button><button data-title-action="reset-shadow" ${t.shadow?'':'disabled'} title="Back to the boxes fitted to each line, with the film's softness and darkness">Reset to fitted</button></div>
      <label>Softness <output data-title-blur>${r2(S.blur)}</output><span class="global-slider"><input name="ft-blur" type="range" min="0" max="60" step="1" value="${S.blur}"><input name="ft-blur-n" type="number" min="0" max="80" step="1" value="${S.blur}"></span></label>
      <label>Darkness <output data-title-opacity>${Math.round(S.opacity*100)}%</output><span class="global-slider"><input name="ft-opacity" type="range" min="0" max="100" step="1" value="${Math.round(S.opacity*100)}"><input name="ft-opacity-n" type="number" min="0" max="100" step="1" value="${Math.round(S.opacity*100)}"></span></label>
      ${editing?`<div class="director-actions title-point-tools"><button data-title-action="pt-smooth" ${shape.pt?'':'disabled'}>Make point smooth</button><button data-title-action="pt-sharp" ${shape.pt?'':'disabled'}>Make point sharp</button><button data-title-action="pt-delete" ${shape.pt?'':'disabled'}>Delete point</button></div>
      <p class="director-hint title-shape-help">Click a point to select it, then drag it. Drag its handles to curve the edge; Alt-drag a handle to break it. Double-click a point for smooth or sharp. Click an edge to add a point; Delete removes the selected point. Drag inside a shape to move it; the corner and edge squares make it bigger or smaller (Shift keeps proportions, Alt from the centre). Arrows nudge 1 px (Shift 10). Ctrl+A selects every part. Esc when done.</p>`:''}
      </fieldset></details></div>`;
  }
  // Copy / timing / shadow fields (live, one undo step per field edit or slider drag).
  panel.addEventListener('input',event=>{
    const el=event.target,name=el.name;if(!name?.startsWith('ft-'))return;event.stopPropagation();
    try{
      const id=el.dataset.titleId||selected;if(!id)return;const prev=selected;selected=id;
      if(['ft-eyebrow','ft-title','ft-detail'].includes(name)){const k=name.slice(3);if(el.tagName==='TEXTAREA')el.rows=lineRows(el.value,name==='ft-detail'?2:1);put(t=>{t[k]=el.value;return t;},{key:name+id,renderAll:false});selected=prev;renderTimeline();return;}
      if(name==='ft-scale'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;put(t=>({...t,scale:v/100}),{key:name+id,renderAll:false});return;}
      if(name==='ft-x'||name==='ft-y'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;put(t=>{const P=placeOf(t);t.position={x:P.x,y:P.anchor[1],[name==='ft-x'?'x':'y']:v};return t;},{key:name+id,renderAll:false});return;}
      if(name==='ft-blur'||name==='ft-blur-n'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;put(t=>{t.shadow={...t.shadow,blur:Math.max(0,Math.min(80,v))};return t;},{key:'ft-blur'+id,renderAll:false});const o=panel.querySelector('[data-title-blur]');if(o)o.textContent=String(v);const twin=panel.querySelector(`[name="${name==='ft-blur'?'ft-blur-n':'ft-blur'}"]`);if(twin)twin.value=String(v);status(`Shadow softness ${v} (the film's is ${BOX_BLUR}).`);return;}
      if(name==='ft-opacity'||name==='ft-opacity-n'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;put(t=>{t.shadow={...t.shadow,opacity:Math.max(0,Math.min(100,v))/100};return t;},{key:'ft-opacity'+id,renderAll:false});const o=panel.querySelector('[data-title-opacity]');if(o)o.textContent=Math.round(v)+'%';const twin=panel.querySelector(`[name="${name==='ft-opacity'?'ft-opacity-n':'ft-opacity'}"]`);if(twin)twin.value=String(v);status(`Shadow darkness ${Math.round(v)}% (the film's is ${Math.round(BOX_OPACITY*100)}%).`);return;}
    }catch(error){status(error.message,true);}
  },true);
  // End-card fields: copy / type / place live (one undo step per field), timing on change.
  const EC_NUM={'ec-logo-scale':['logo','scale',v=>Math.max(.1,Math.min(5,v/100))],'ec-logo-x':['logo','x'],'ec-logo-y':['logo','y'],'ec-cta-size':['cta','size',v=>Math.max(8,Math.min(300,v))],'ec-cta-spacing':['cta','spacing',v=>Math.max(-10,Math.min(40,v))],'ec-cta-fade':['cta','fade_in',v=>Math.max(0,Math.min(5,v))],'ec-cta-x':['cta','x'],'ec-cta-gap':['cta','gap']};
  panel.addEventListener('input',event=>{
    const el=event.target,name=el.name;if(!name?.startsWith('ec-'))return;event.stopPropagation();
    try{
      if(name==='ec-cta-text'){putEnd(c=>{c.cta.text=el.value;},{parts:['cta'],key:name,renderAll:false});renderTimeline();return;}
      if(name==='ec-cta-font'){putEnd(c=>{c.cta.font=el.value;},{parts:['cta'],key:name,renderAll:false,message:`CTA font ${el.value} (the film's was ${endFilm().cta.font??CTA_DEFAULT.font}).`});return;}
      const spec=EC_NUM[name];if(!spec)return;const v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;const [part,key,f=x=>x]=spec;
      putEnd(c=>{c[part][key]=f(v);},{parts:[part],key:name,renderAll:false});
    }catch(error){status(error.message,true);}
  },true);
  panel.addEventListener('change',event=>{
    const el=event.target,name=el.name;if(!name?.startsWith('ec-'))return;event.stopPropagation();
    try{
      const s=shot().seconds,c=endCard();if(!c)return;
      if(name==='ec-logo-in'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))throw Error('Enter a time in seconds.');const a=r3(Math.max(0,Math.min(s-.5,v)));putEnd(x=>moveLogo(x,a,s),{parts:['logo','cta'],message:`Wordmark now comes in at ${r2(a)} s; the CTA moved with it. The score's logo hit will be re-fitted to it after the import.`});renderTimeline();return;}
      if(name==='ec-cta-in'){const v=Number(el.value);if(el.value===''||!Number.isFinite(v))throw Error('Enter a time in seconds.');const b=c.cta.rel_out??s,a=r3(Math.max(0,Math.min(b-.5,v)));putEnd(x=>{x.cta.rel_in=a;},{parts:['cta'],message:`CTA comes in at ${r2(a)} s.`});renderTimeline();return;}
      if(name==='ec-cta-out'){const v=Number(el.value);if(el.value!==''&&!Number.isFinite(v))throw Error('Enter a time in seconds, or leave it empty for the film\'s end.');const b=el.value===''||v>=s-.02?null:r3(Math.max(c.cta.rel_in+.5,Math.min(s,v)));putEnd(x=>{x.cta.rel_out=b;},{parts:['cta'],message:b===null?'CTA stays to the film\'s end (it fades out with the film).':`CTA goes out at ${r2(b)} s.`});renderTimeline();return;}
      render();renderTimeline();status('End card updated. Export cut sends it to the film.');
    }catch(error){render();status(error.message,true);}
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
    try{titleAction(b.dataset.titleAction,b.dataset.titleId,b.dataset.nudge);}catch(error){status(error.message,true);}
  });
  function titleAction(name,id,extra){
    if(name==='pick'){select(id);return;}
    if(name==='end-pick'){selectEnd(id);return;}
    if(name==='end-go'){const c=endCard();if(c)seek(endRest(c)/shot().seconds);return;}
    if(name==='end-reset'){
      // the wordmark back to the film's takes the CTA back by the time it was carried (and drops its edit when that is all it had)
      ready();const film=endFilm(),cur=endCard();commit(()=>{const s=shot(),e={...(s.endCard||{})};delete e[id];
        if(id==='logo'&&e.cta&&film&&cur){const d=film.logo.rel_in-cur.logo.rel_in;if(Math.abs(d)>1e-9){const c={...e.cta,rel_in:r3(cur.cta.rel_in+d)};if(cur.cta.rel_out!=null)c.rel_out=r3(cur.cta.rel_out+d);e.cta=c;}
          if(JSON.stringify(mergedEndCard(film,{cta:e.cta}).cta)===JSON.stringify(film.cta))delete e.cta;}
        const c=cleanEndCard(e,s.seconds);if(c)s.endCard=c;else delete s.endCard;},{render:true});lastKey='';sync();renderTimeline();status(`${END_LABEL[id]} back to the film's${id==='logo'?' (the CTA moved back with it)':''}.`);return;}
    if(name==='add'){addTitle();return;}
    if(name==='nudge'){nudge(extra||'');return;}
    if(name==='paste'){pasteAtPlayhead();return;}
    const t=item();if(!t)return;
    if(name==='duplicate'){duplicateSelected();return;}
    if(name==='delete'){deleteSelected();return;}
    if(name==='split'){splitSelected();return;}
    if(name==='copy'){copySelected();return;}
    if(name==='reset-lines'){put(x=>{for(const k of Object.keys(x.typography||{})){delete x.typography[k].dx;delete x.typography[k].dy;}const typ=cleanTypography(x.typography);if(typ)x.typography=typ;else delete x.typography;return x;},{message:'Every line is back in the film\'s place.'});return;}
    if(name==='copy-layout'){copiedLayout=structuredClone({position:{x:placeOf(t).x,y:placeOf(t).anchor[1]},scale:t.scale,typography:t.typography,place:t.place,shadow:t.shadow});render();status('Title layout copied. Select another title and paste layout.');return;}
    if(name==='paste-layout'&&copiedLayout){put(x=>({...x,...structuredClone(copiedLayout)}),{message:'Title layout pasted.'});return;}
    if(name==='go'){seek(restTime(t)/shot().seconds);return;}
    if(name==='to-rule'){const R=rule();if(R?.earliest===undefined)return;const on=t.rel_out-t.rel_in,a=R.earliest,b=Math.min(shot().seconds,a+on);putTiming(t.id,a,Math.round(b*1000)/1000,`Title now comes in at the 1.5 s mark (${r2(a)} s).`);return;}
    if(name==='edit-shadow'){setEditing(!editing);if(editing)seek(restTime(t)/shot().seconds);render();return;}
    if(name==='reset-shadow'){put(x=>{delete x.shadow;return x;},{message:'Shadow reset to the fitted boxes, with the film\'s softness and darkness.'});if(editing)setEditing(true,false);render();return;}
    if(name==='pt-smooth'||name==='pt-sharp'){const [pi,k]=shape.pt||[];if(pi===undefined)return;const S=shadowOf(t,measure),p=S.paths[pi].points[k],isSmooth=!!(p.in||p.out);if((name==='pt-smooth')===isSmooth)return;S.paths[pi]=toggleSmooth(S.paths[pi],k);saveShape(S.paths,name==='pt-smooth'?'Point made smooth: drag its handles to shape the curve.':'Point made sharp.');return;}
    if(name==='pt-delete'){deleteSelectedPoint();return;}
  }
  // ---- Render still: the film titles burned onto the 3D still, like finish-intro.py burns them onto the film --------
  // The same cards the frame overlay draws (cardSvg: copy, fitted or custom shadow, fade / rise at that time), as one
  // 1920 x 1080 SVG with the fonts embedded (an SVG image cannot reach the page's fonts), drawn over the JPEG.
  // No titles (none at that time, or the toolbar's Titles off): the still comes back as it is.
  let fontCss=null;
  const b64=buf=>{const u=new Uint8Array(buf);let out='';for(let i=0;i<u.length;i+=32768)out+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(out);};
  const embeddedFonts=()=>fontCss||=Promise.all(FONT_FILES.map(async([file,w])=>{
    const r=await fetch(FONT_URL+file);if(!r.ok)throw Error('title font unavailable');return `@font-face{font-family:"${FAMILY[w]}";font-weight:${w};src:url(data:font/ttf;base64,${b64(await r.arrayBuffer())}) format("truetype");}`;})).then(a=>a.join(''),e=>{fontCss=null;throw e;});
  function stillTitles(seconds){return shown&&has()?titles().filter(x=>seconds>=x.rel_in&&seconds<x.rel_out):[];}
  async function compositeStill(url,seconds,type='image/jpeg'){
    const list=stillTitles(seconds);if(!list.length)return url;
    await fontsLoaded;const css=await embeddedFonts();let defs='',body='';
    for(const x of list){const c=cardSvg(x,seconds,false);defs+=c.defs;body+=`<g class="title-card">${c.body}</g>`;}
    const svgText=`<svg xmlns="${NS}" width="${FILM_W}" height="1080" viewBox="0 0 ${FILM_W} 1080"><style>${css}</style><defs>${defs}</defs>${body}</svg>`;
    const load=src=>new Promise((ok,fail)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>fail(Error('The title layer could not be drawn.'));i.src=src;});
    const blob=URL.createObjectURL(new Blob([svgText],{type:'image/svg+xml'}));
    try{
      const [still,layer]=await Promise.all([load(url),load(blob)]);
      const c=document.createElement('canvas');c.width=still.naturalWidth;c.height=still.naturalHeight;const g=c.getContext('2d');
      g.drawImage(still,0,0);g.drawImage(layer,0,0,c.width,c.height);return c.toDataURL(type,.92);
    }finally{URL.revokeObjectURL(blob);}
  }
  // ---- overlay (the 16:9 frame) -----------------------------------------------------------------------------
  const box=document.createElement('div');box.className='film-box title-overlay';box.setAttribute('aria-hidden','true');
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${FILM_W} 1080`);svg.setAttribute('preserveAspectRatio','none');svg.classList.add('title-svg');box.append(svg);document.body.append(box);
  const shape={pt:null,sel:new Set(),draft:null};let lastPt=null;
  const blurFilter=(id,b)=>`<filter id="${id}" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2720" height="1880"><feGaussianBlur stdDeviation="${(b*BLUR_SIGMA).toFixed(3)}"/></filter>`;
  function cardSvg(t,at,rest){
    if(cardDrag&&cardDrag.id===t.id)t={...t,position:cardDrag.next};
    const S=shapeFor(t),P=placeOf(t),defs=[],parts=[];let n=0;
    // shadow (layer 0): each path its own soft shape, timed like its line (finish-intro: one Dialogue each)
    if(S.blur>0)defs.push(blurFilter('tb-'+t.id,S.blur));
    S.paths.forEach(p=>{const [delay,rise]=pathTiming(p),st=rest?{on:true,alpha:1,dy:0}:lineState(t,delay,rise,at);if(!st.on||st.alpha<=0)return;
      parts.push(`<path d="${svgPath(p,P.anchor)}" fill="#000" fill-opacity="${(S.opacity*st.alpha).toFixed(4)}" transform="translate(0 ${st.dy.toFixed(2)})" ${S.blur>0?`filter="url(#tb-${t.id})"`:''}/>`);});
    // text (layer 1), with its drop shadow (supports multi-line copy via Enter -> '\n')
    for(const L of expandedLines(t)){const s=L.text;if(!s)continue;const st=rest?{on:true,alpha:1,dy:0,blur:0}:lineState(t,L.delay,L.rise,at);if(!st.on||st.alpha<=0)continue;
      const fid=st.blur>.05?`tt-${t.id}-${n++}`:null;if(fid)defs.push(blurFilter(fid,st.blur));
      // italic: libass shears the upright glyphs (faux italic, 12 deg) about each line's baseline; the overlay does the same
      // (the shadow copy is the same sheared glyphs, offset), so the advance and every edge land where the burn puts them.
      // textLength: Chrome hints glyph advances at small sizes (a 40 px supporting line comes out ~1.5% wider than libass,
      // which does not hint); the line is laid out to its unhinted advance (measure), as libass sets it.
      const x=P.x+L.dx,y=L.y+P.dy-L.size*DESC+st.dy,attrs=`font-family="${FAMILY[L.weight]}" font-weight="${L.weight}" font-size="${(L.size/FONT_REAL).toFixed(3)}" letter-spacing="${L.spacing}" textLength="${measure(L,s).toFixed(2)}" lengthAdjust="spacing"${P.align==='right'?' text-anchor="end"':''} style="font-kerning:none;white-space:pre"`;
      const body=runs(L,s).map(r=>r.fb?`<tspan font-family="${FALLBACK.family}" font-size="${(L.size/FALLBACK.real).toFixed(3)}">${escape(r.text)}</tspan>`:escape(r.text)).join('');
      const shear=(tx,ty)=>L.italic?` transform="translate(${tx} ${ty.toFixed(2)}) skewX(${(-SKEW_ITALIC).toFixed(4)}) translate(${-tx} ${(-ty).toFixed(2)})"`:'';
      parts.push(`<g ${fid?`filter="url(#${fid})"`:''} opacity="${st.alpha.toFixed(4)}"><text x="${x+L.shadow}" y="${(y+L.shadow).toFixed(2)}"${shear(x+L.shadow,y+L.shadow)} ${attrs} fill="#000" fill-opacity="${L.shadowAlpha.toFixed(3)}">${body}</text><text x="${x}" y="${y.toFixed(2)}"${shear(x,y)} ${attrs} fill="${L.color}">${body}</text></g>`);}
    const scale=cardDrag?.id===t.id?(cardDrag.scale??t.scale??1):(t.scale??1);
    return {defs:defs.join(''),body:`<g transform="translate(${P.x} ${P.anchor[1]}) scale(${scale}) translate(${-P.x} ${-P.anchor[1]})">${parts.join('')}</g>`};
  }
  // Each line's box in the frame (film px, the title's scale and place applied): x across its text, y from the line's
  // top (baseline - full size above the box bottom) to its box bottom (the line's y). Multi-line fields merge all sub-lines.
  function lineBoxes(t){
    const P=placeOf(t),s=t.scale??1,AX=P.x,AY=P.anchor[1],sx=x=>AX+(x-AX)*s,sy=y=>AY+(y-AY)*s;
    const byKey=new Map();
    for(const L of expandedLines(t)){
      const w=measure(L,L.text),x0=sx(P.x+L.dx-(P.align==='right'?w:0)),x1=sx(P.x+L.dx-(P.align==='right'?w:0)+w),y1=L.y+P.dy,b0=sy(y1-L.size),b1=sy(y1);
      const cur=byKey.get(L.key);
      if(!cur)byKey.set(L.key,{key:L.key,x0,x1,y0:b0,y1:b1});
      else{cur.x0=Math.min(cur.x0,x0);cur.x1=Math.max(cur.x1,x1);cur.y0=Math.min(cur.y0,b0);cur.y1=Math.max(cur.y1,b1);}
    }
    return [...byKey.values()];
  }
  const svgPoint=event=>{const m=svg.getScreenCTM();if(!m)return [0,0];const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse());return [p.x,p.y];};
  const lineAt=(t,[x,y])=>lineBoxes(t).find(b=>x>=b.x0-4&&x<=b.x1+4&&y>=b.y0-4&&y<=b.y1+4)?.key||null;
  const SAFE={action:[96,54],title:[192,108]};           // 5% / 10% of 1920 x 1080
  // The dragged line's dx / dy with snapping (Alt: none): its left edge to the title's edge, the other lines' edges and
  // the safe margins; its box bottom to the film's place, the other lines (and other titles on screen) and the safe
  // margins; its top to the top safe margins. Returns the guides to draw (film px).
  function snapLine(t,key,dx,dy,alt){
    const P=placeOf(t),s=t.scale??1,AX=P.x,AY=P.anchor[1],L=LINES.find(l=>l.key===key),tol=7*px()/s,guides=[];if(alt)return {dx,dy,guides};
    const others=titleLines(t).filter(l=>l.key!==key&&t[l.key]),absX=d=>AX+d*s,absY=d=>AY+(L.y+d-912)*s,fromY=Y=>(Y-AY)/s+912-L.y;
    const xs=[[0,'the title edge'],...others.map(o=>[o.dx,LINE_LABEL[o.key]]),[(SAFE.action[0]-AX)/s,'action-safe'],[(SAFE.title[0]-AX)/s,'title-safe'],[(FILM_W-SAFE.title[0]-AX)/s,'title-safe right'],[(FILM_W-SAFE.action[0]-AX)/s,'action-safe right']];
    const list=titles().filter(x=>x.id!==t.id&&time()*shot().seconds>=x.rel_in&&time()*shot().seconds<x.rel_out);
    const ys=[[0,`the film's place`],...others.map(o=>[fromY(AY+(o.y-912)*s),LINE_LABEL[o.key]]),...list.flatMap(x=>lineBoxes(x).map(b=>[fromY(b.y1),'another title'])),
      [fromY(1080-SAFE.title[1]),'title-safe bottom'],[fromY(1080-SAFE.action[1]),'action-safe bottom'],[fromY(SAFE.title[1]+L.size*s),'title-safe top'],[fromY(SAFE.action[1]+L.size*s),'action-safe top']];
    const best=(v,c)=>c.reduce((b,[t,n])=>Math.abs(t-v)<=tol&&(!b||Math.abs(t-v)<Math.abs(b[0]-v))?[t,n]:b,null);
    const bx=best(dx,xs),by=best(dy,ys);
    if(bx){dx=bx[0];guides.push({x:absX(bx[0]),name:bx[1]});}
    if(by){dy=by[0];guides.push({y:absY(by[0]),name:by[1]});}
    return {dx,dy,guides};
  }
  const lineView=x=>lineDrag&&lineDrag.id===x.id?withLine(x,lineDrag.key,lineDrag.next):x;
  function endSvg(at){
    const c=endView();if(!c||!shown)return '';const s=shot().seconds,F=endFade(),parts=[];
    const B=logoBox(c.logo),la=endSel==='logo'?Math.max(.35,logoAlpha(c,at,s,F)):logoAlpha(c,at,s,F);
    if(la>0)parts.push(`<g data-end-card="logo"><image href="${LOGO_URL}" x="${B.x0.toFixed(2)}" y="${B.y0.toFixed(2)}" width="${B.w.toFixed(2)}" height="${B.h.toFixed(2)}" preserveAspectRatio="none" opacity="${la.toFixed(4)}"/><rect data-end-move="logo" x="${B.x0}" y="${B.y0}" width="${B.w}" height="${B.h}" fill="transparent" style="pointer-events:all;cursor:move"><title>Drag to move the wordmark (the CTA stays under it)</title></rect>${endSel==='logo'?`<rect x="${B.x0}" y="${B.y0}" width="${B.w}" height="${B.h}" fill="none" stroke="#ffd27a" stroke-width="${px()}" style="pointer-events:none"/>`:''}</g>`);
    let st=ctaState(c,at,s,F);if(endSel==='cta'&&(!st.on||st.alpha<.35))st={on:true,alpha:.35,dy:0};
    if(st.on&&st.alpha>0&&c.cta.text){const L=ctaLayout(c),T={weight:L.weight,size:L.size,spacing:L.spacing},text=oneLine(c.cta.text),w=measure(T,text),x0=L.x-w/2,top=L.top+st.dy,y=top+L.size-L.size*DESC;
      const attrs=`font-family="${FAMILY[L.weight]}" font-weight="${L.weight}" font-size="${(L.size/FONT_REAL).toFixed(3)}" letter-spacing="${L.spacing}" textLength="${w.toFixed(2)}" lengthAdjust="spacing" style="font-kerning:none;white-space:pre"`;
      parts.push(`<g data-end-card="cta" opacity="${st.alpha.toFixed(4)}"><text x="${(x0+1.5).toFixed(2)}" y="${(y+1.5).toFixed(2)}" ${attrs} fill="#000" fill-opacity="${(1-0xA0/255).toFixed(3)}">${escape(text)}</text><text x="${x0.toFixed(2)}" y="${y.toFixed(2)}" ${attrs} fill="#ffffff">${escape(text)}</text><rect data-end-move="cta" x="${x0}" y="${top}" width="${w}" height="${L.size}" fill="transparent" style="pointer-events:all;cursor:move"><title>Drag to move the CTA (sideways: X; up / down: the gap under the wordmark)</title></rect>${endSel==='cta'?`<rect x="${x0}" y="${top}" width="${w}" height="${L.size}" fill="none" stroke="#ffd27a" stroke-width="${px()}" style="pointer-events:none"/>`:''}</g>`);}
    return `<g class="end-card-overlay">${parts.join('')}</g>`;
  }
  svg.addEventListener('pointerdown',event=>{
    const part=event.target.closest?.('[data-end-move]')?.dataset.endMove;if(!part||editing||event.button!==0)return;event.preventDefault();event.stopPropagation();
    try{ready();}catch(error){status(error.message,true);return;}if(endSel!==part)selectEnd(part,{reveal:false});const c=endCard();if(!c)return;
    endFrameDrag={part,start:svgPoint(event),base:c,card:null};svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove',event=>{
    const d=endFrameDrag;if(!d)return;const [fx,fy]=svgPoint(event),dx=fx-d.start[0],dy=fy-d.start[1];if(!d.card&&Math.hypot(dx,dy)<2*px())return;
    const c=structuredClone(d.base),B=logoBox(d.base.logo),L=ctaLayout(d.base);
    if(d.part==='logo'){c.logo.x=r2(B.x+dx);c.logo.y=r2(B.y+dy);if(c.cta.x!=null)c.cta.x=r2(c.cta.x+dx);}else{c.cta.x=r2(L.x+dx);c.cta.gap=r2(Number(d.base.cta.gap??0)+dy);}
    d.card=c;lastKey='';sync();status(d.part==='logo'?`Wordmark centre ${r2(c.logo.x)}, ${r2(c.logo.y)} (the film's: ${LOGO_DEFAULT.x}, ${r2(LOGO_DEFAULT.y)})`:`CTA centre x ${r2(c.cta.x)}, ${r2(c.cta.gap)} px under the wordmark`);
  });
  function endFrameUp(event){
    const d=endFrameDrag;if(!d)return;endFrameDrag=null;if(event.type==='pointercancel'||!d.card){lastKey='';sync();return;}const c=d.card;
    putEnd(x=>{x.logo=c.logo;x.cta=c.cta;},{parts:d.part==='logo'?(c.cta.x!=null?['logo','cta']:['logo']):['cta'],message:d.part==='logo'?'Wordmark moved. Undo puts it back.':'CTA moved. Undo puts it back.'});
  }
  svg.addEventListener('pointerup',endFrameUp);svg.addEventListener('pointercancel',endFrameUp);
  function shapeFor(t){const S=shadowOf(t,measure);if(editing&&t.id===selected&&shape.draft)S.paths=shape.draft;return S;}
  function sync(){
    const visible=open()&&shown&&has()&&document.body.classList.contains('film-frame');box.hidden=!visible;if(!visible){lastKey='';return;}
    const at=time()*shot().seconds,t0=item(),t=t0&&lineView(t0),list=(editing&&t0?[t0]:titles().filter(x=>at>=x.rel_in&&at<x.rel_out)).map(lineView);
    const key=JSON.stringify([at.toFixed(3),list,endView(),endSel,editing,shape.pt,[...shape.sel],shape.draft,cardDrag?.next,cardDrag?.scale,lineSel,lineDrag?.next,lineDrag?.guides,fontsReady,svg.clientWidth]);if(key===lastKey)return;lastKey=key;
    let defs='',body='';for(const x of list){const c=cardSvg(x,at,editing&&x.id===selected);defs+=c.defs;const bb=bounds(shadowOf(x,measure).paths),P=placeOf(x),scale=cardDrag?.id===x.id?(cardDrag.scale??x.scale??1):(x.scale??1),pos=cardDrag?.id===x.id?cardDrag.next:{x:P.x,y:P.anchor[1]};body+=`<g class="title-card" data-title-card="${x.id}">${c.body}${!editing&&bb?`<rect data-card-move x="${bb.x0*scale+pos.x}" y="${bb.y0*scale+pos.y}" width="${(bb.x1-bb.x0)*scale}" height="${(bb.y1-bb.y0)*scale}" fill="transparent" style="pointer-events:all;cursor:move"/>`:''}</g>`;}
    const guides=(lineDrag?.guides||[]).map(g=>g.x!==undefined?`<line class="title-guide" x1="${g.x}" y1="0" x2="${g.x}" y2="1080" stroke="#ff4fd8" stroke-width="${px()}" stroke-dasharray="${6*px()} ${4*px()}" style="pointer-events:none"/>`:`<line class="title-guide" x1="0" y1="${g.y}" x2="${FILM_W}" y2="${g.y}" stroke="#ff4fd8" stroke-width="${px()}" stroke-dasharray="${6*px()} ${4*px()}" style="pointer-events:none"/>`).join('');
    svg.innerHTML=`<defs>${defs}</defs>${editing?'':endSvg(at)}${body}${editing&&t?editLayer(t):t&&list.some(x=>x.id===t.id)?titleFrame(t):''}${guides}`;
  }
  // A selected title shows its shadow's outline (dashed); clicking the shape starts editing it.
  function titleFrame(t){
    const b=bounds(shadowOf(t,measure).paths);if(!b)return '';const P=placeOf(t),scale=cardDrag?.id===t.id?(cardDrag.scale??t.scale??1):(t.scale??1),pos=cardDrag?.id===t.id?cardDrag.next:{x:P.x,y:P.anchor[1]},h=6*px();
    const x0=pos.x+b.x0*scale,y0=pos.y+b.y0*scale,x1=pos.x+b.x1*scale,y1=pos.y+b.y1*scale;
    const lb=lineSel&&t.id===selected&&!cardDrag?lineBoxes(t).find(b=>b.key===lineSel):null,lp=3*px();
    const line=lb?`<rect data-line-frame="${lineSel}" x="${lb.x0-lp}" y="${lb.y0-lp}" width="${lb.x1-lb.x0+2*lp}" height="${lb.y1-lb.y0+2*lp}" fill="none" stroke="#ffd400" stroke-width="${1.5*px()}" stroke-dasharray="${5*px()} ${3*px()}" style="pointer-events:none"/>`:'';
    return `<g>${line}<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="#5bd6f5" stroke-width="${px()}" style="pointer-events:none"/>${[['nw',x0,y0],['ne',x1,y0],['se',x1,y1],['sw',x0,y1]].map(([corner,x,y])=>`<rect data-card-scale="${corner}" x="${x-h}" y="${y-h}" width="${h*2}" height="${h*2}" fill="#5bd6f5" stroke="white" stroke-width="${px()}" style="pointer-events:all;cursor:${corner==='nw'||corner==='se'?'nwse':'nesw'}-resize"><title>Scale title proportionally</title></rect>`).join('')}</g>`;
  }
  function hintLayer(t,at){
    if(cardDrag?.id===t.id)t={...t,position:cardDrag.next};
    const S=shadowOf(t,measure);return `<g class="shape-hint">${S.paths.map(p=>{const [delay,rise]=pathTiming(p),st=lineState(t,delay,rise,at);return st.on?`<path data-hint d="${svgPath(p,placeOf(t).anchor)}" transform="translate(0 ${st.dy.toFixed(2)})"><title>Drag to move the whole title; use Shadow layer to edit its shape</title></path>`:'';}).join('')}</g>`;
  }
  // ---- shadow shape editing ---------------------------------------------------------------------------------
  const anchorOf=t=>placeOf(t).anchor,px=()=>FILM_W/Math.max(1,svg.getBoundingClientRect().width);
  function editLayer(t){
    const S=shapeFor(t),[AX,AY]=anchorOf(t),k=px(),h=5.5*k,parts=[`<rect class="se-bg" x="0" y="0" width="${FILM_W}" height="1080" fill="transparent"/>`];
    S.paths.forEach((p,pi)=>{const d=svgPath(p,[AX,AY]);parts.push(`<path class="se-body" data-body="${pi}" d="${d}"/><path class="se-edge" data-edge="${pi}" d="${d}" stroke-width="${12*k}"/><path class="se-outline ${shape.sel.has(pi)?'sel':''}" d="${d}"/>`);});
    const sel=[...shape.sel].filter(i=>S.paths[i]),bb=sel.length?bounds(sel.map(i=>S.paths[i])):null;
    // the resize frame sits a little outside the shape, so its squares never cover the points
    if(bb){const g=9*k,[x0,y0,x1,y1]=[bb.x0+AX-g,bb.y0+AY-g,bb.x1+AX+g,bb.y1+AY+g],m=[(x0+x1)/2,(y0+y1)/2];
      parts.push(`<rect class="se-frame" x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}"/>`);
      for(const [c,x,y] of [['nw',x0,y0],['n',m[0],y0],['ne',x1,y0],['e',x1,m[1]],['se',x1,y1],['s',m[0],y1],['sw',x0,y1],['w',x0,m[1]]])parts.push(`<rect class="se-scale" data-scale="${c}" x="${x-h}" y="${y-h}" width="${2*h}" height="${2*h}"><title>Drag to resize (Shift keeps proportions, Alt from the centre)</title></rect>`);}
    if(shape.pt){const [pi,j]=shape.pt,p=S.paths[pi]?.points[j];if(p)for(const w of ['in','out'])if(p[w]){const hx=p.x+p[w][0]+AX,hy=p.y+p[w][1]+AY;parts.push(`<line class="se-hline" x1="${p.x+AX}" y1="${p.y+AY}" x2="${hx}" y2="${hy}"/><circle class="se-handle" data-h="${pi}:${j}:${w}" cx="${hx}" cy="${hy}" r="${h*.9}"><title>Drag to curve · Alt-drag breaks the handle</title></circle>`);}}
    S.paths.forEach((p,pi)=>p.points.forEach((q,j)=>{const on=shape.pt&&shape.pt[0]===pi&&shape.pt[1]===j,smooth=!!(q.in||q.out);
      parts.push(smooth?`<circle class="se-pt ${on?'on':''}" data-pt="${pi}:${j}" cx="${q.x+AX}" cy="${q.y+AY}" r="${h}"><title>Smooth point · drag to move · double-click: sharp</title></circle>`:`<rect class="se-pt ${on?'on':''}" data-pt="${pi}:${j}" x="${q.x+AX-h}" y="${q.y+AY-h}" width="${2*h}" height="${2*h}"><title>Sharp point · drag to move · double-click: smooth</title></rect>`);}));
    return `<g class="shape-edit" transform="translate(${AX} ${AY}) scale(${t.scale??1}) translate(${-AX} ${-AY})">${parts.join('')}</g>`;
  }
  const filmPoint=event=>{const m=svg.getScreenCTM();if(!m)return [0,0];const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse()),[AX,AY]=anchorOf(item());return [(p.x-AX)/(item().scale??1),(p.y-AY)/(item().scale??1)];};
  function saveShape(paths,message){
    put(t=>{t.shadow={...t.shadow,paths:structuredClone(paths)};return t;},{message});shape.draft=null;lastKey='';sync();
  }
  function deleteSelectedPoint(){
    const t=item();if(!t||!shape.pt)return status('Select a point first (click it).');const [pi,k]=shape.pt,S=shadowOf(t,measure);
    S.paths[pi]=deletePoint(S.paths[pi],k);shape.pt=null;saveShape(S.paths,'Point deleted. Undo brings it back.');
  }
  const menu=document.createElement('div');menu.className='director-panel';menu.hidden=true;menu.style.cssText='position:fixed;z-index:10000;padding:10px;background:#151f28;color:#fff;border:1px solid #5bd6f5;border-radius:8px';document.body.append(menu);
  svg.addEventListener('contextmenu',event=>{const id=event.target.closest('[data-title-card]')?.dataset.titleCard;if(id&&id!==selected)select(id,{reveal:false});if(!item())return;event.preventDefault();menu.innerHTML='<button data-layout="copy-layout">Copy title layout</button> <button data-layout="paste-layout" '+(copiedLayout?'':'disabled')+'>Paste title layout</button>';menu.style.left=Math.min(event.clientX,innerWidth-300)+'px';menu.style.top=Math.min(event.clientY,innerHeight-70)+'px';menu.hidden=false;});
  menu.addEventListener('click',event=>{const action=event.target.dataset.layout;if(action)try{titleAction(action);}catch(error){status(error.message,true);}menu.hidden=true;});
  document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))menu.hidden=true;});
  svg.addEventListener('pointerdown',event=>{
    if(!editing&&event.button===0&&(event.target.closest?.('[data-card-move]')||event.target.closest?.('[data-card-scale]')||event.target.closest?.('[data-hint]'))){
      const id=event.target.closest('[data-title-card]')?.dataset.titleCard,was=!!id&&id===selected;if(id&&id!==selected)select(id,{reveal:false});if(!item())return;
      const hit=!event.target.dataset.cardScale?lineAt(item(),svgPoint(event)):null;
      if(was&&hit&&hit===lineSel){event.preventDefault();event.stopPropagation();try{ready();const t=item(),L=titleLines(t).find(l=>l.key===hit),base={dx:L.dx,dy:L.y-LINES.find(l=>l.key===hit).y};
        lineDrag={id:t.id,key:hit,start:svgPoint(event),base,next:{...base},guides:[],moved:false,scale:t.scale??1};svg.setPointerCapture(event.pointerId);}catch(error){status(error.message,true);}return;}
      event.preventDefault();event.stopPropagation();try{ready();const t=item(),P=placeOf(t);cardDrag={id:t.id,x:event.clientX,y:event.clientY,base:{x:P.x,y:P.anchor[1]},next:{x:P.x,y:P.anchor[1]},hit:was?hit:null,was};const corner=event.target.dataset.cardScale;if(corner){const b=bounds(shadowOf(t,measure).paths),scale=t.scale??1,r=svg.getBoundingClientRect();cardDrag.scale=scale;cardDrag.initialScale=scale;cardDrag.fixed=[P.x+(corner.includes('w')?b.x1:b.x0)*scale,P.anchor[1]+(corner.includes('n')?b.y1:b.y0)*scale];cardDrag.pointer=[(event.clientX-r.left)*FILM_W/r.width,(event.clientY-r.top)*1080/r.height];}svg.setPointerCapture(event.pointerId);}catch(error){status(error.message,true);}return;}
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
    if(lineDrag){const d=lineDrag,[fx,fy]=svgPoint(event);if(Math.hypot(fx-d.start[0],fy-d.start[1])>2*px())d.moved=true;if(!d.moved)return;
      const r=snapLine(item(),d.key,d.base.dx+(fx-d.start[0])/d.scale,d.base.dy+(fy-d.start[1])/d.scale,event.altKey);d.next={dx:r2(r.dx),dy:r2(r.dy)};d.guides=r.guides;lastKey='';sync();
      status(`${LINE_LABEL[d.key]} ${d.next.dx>=0?'+':''}${d.next.dx}, ${d.next.dy>=0?'+':''}${d.next.dy} px${r.guides.length?' · snapped to '+r.guides.map(g=>g.name).join(' and '):''} · Alt: no snapping`);return;}
    if(cardDrag?.fixed){const d=cardDrag,r=svg.getBoundingClientRect(),p=[(event.clientX-r.left)*FILM_W/r.width,(event.clientY-r.top)*1080/r.height],v=d.pointer.map((x,i)=>x-d.fixed[i]),u=p.map((x,i)=>x-d.fixed[i]);let ratio=(v[0]*u[0]+v[1]*u[1])/(v[0]*v[0]+v[1]*v[1]);d.scale=Math.max(.1,Math.min(5,d.initialScale*ratio));ratio=d.scale/d.initialScale;d.next={x:r2(d.fixed[0]+(d.base.x-d.fixed[0])*ratio),y:r2(d.fixed[1]+(d.base.y-d.fixed[1])*ratio)};lastKey='';sync();return;}
    if(cardDrag){const r=svg.getBoundingClientRect();cardDrag.next={x:r2(cardDrag.base.x+(event.clientX-cardDrag.x)*FILM_W/r.width),y:r2(cardDrag.base.y+(event.clientY-cardDrag.y)*1080/r.height)};lastKey='';sync();return;}
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
    if(lineDrag){const d=lineDrag;lineDrag=null;if(event.type!=='pointercancel'&&d.moved&&(d.next.dx!==d.base.dx||d.next.dy!==d.base.dy))put(x=>withLine(x,d.key,d.next),{message:`${LINE_LABEL[d.key]} moved to ${d.next.dx>=0?'+':''}${d.next.dx}, ${d.next.dy>=0?'+':''}${d.next.dy} px from its place. Undo puts it back.`});lastKey='';sync();return;}
    if(cardDrag){const d=cardDrag;cardDrag=null;const moved=d.next.x!==d.base.x||d.next.y!==d.base.y||d.scale!==undefined&&d.scale!==d.initialScale;
      if(event.type!=='pointercancel'&&moved)put(t=>({...t,position:d.next,...(d.scale!==undefined?{scale:d.scale}:{})}),{message:'Title moved.'});
      else if(event.type!=='pointercancel'&&d.was&&d.hit!==lineSel){lineSel=d.hit;render();status(lineSel?`${LINE_LABEL[lineSel]} selected: drag it to move this line alone; arrows nudge it (Shift 10 px); Esc for the whole title.`:'Whole title selected: drag to move it.');}
      lastKey='';sync();return;}
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
  // A selected title (not editing its shape): Delete removes it, Ctrl/Cmd+D duplicates it (registered before
  // director.mjs's history shortcuts, so Ctrl+D lands here first).
  // (window, capture: before director.mjs's document-level Esc / history keys, so Esc first drops a picked line)
  addEventListener('keydown',event=>{
    if(editing||!open()||!has()||event.defaultPrevented||document.querySelector('dialog[open]'))return;
    const target=event.target;if(target.closest?.('input,select,textarea,[contenteditable]'))return;
    if(target!==document.body&&!timeline.contains(target)&&!box.contains(target)&&!panel.contains(target))return;
    const mod=(event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey,k=event.key.toLowerCase(),sel=!!item();
    const act=mod&&k==='v'&&clipboard?.length?'paste':!sel?null:mod&&k==='d'?'dup':mod&&k==='c'?'copy':mod&&k==='k'?'split':!event.ctrlKey&&!event.metaKey&&(event.key==='Delete'||event.key==='Backspace')?'del'
      :event.key==='Escape'&&lineSel?'unline':!event.ctrlKey&&!event.metaKey&&!event.altKey&&/^Arrow/.test(event.key)&&!timeline.contains(target)?'nudge':null;
    if(!act)return;event.preventDefault();event.stopImmediatePropagation();if(event.repeat&&act!=='nudge')return;
    try{
      if(act==='paste')pasteAtPlayhead();else if(act==='dup')duplicateSelected();else if(act==='copy')copySelected();else if(act==='split')splitSelected();else if(act==='del')deleteSelected();
      else if(act==='unline'){lineSel=null;lastKey='';sync();render();status('Back to the whole title.');}
      else nudge({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key].map(v=>v*(event.shiftKey?10:1)));
    }catch(error){status(error.message,true);}
  },true);
  // Arrow nudges: the picked line (typography dx / dy) or, with no line picked, the whole title (position).
  function nudge([dx,dy]){
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    const t=item();if(!t)return;
    if(lineSel){const L=titleLines(t).find(l=>l.key===lineSel),base=LINES.find(l=>l.key===lineSel);
      if(!L||!base)return;
      put(x=>withLine(x,lineSel,{dx:L.dx+dx,dy:L.y-base.y+dy}),{key:'nudge-line-'+t.id+lineSel,renderAll:false});syncLineFields();lastKey='';sync();status(`${LINE_LABEL[lineSel]} nudged ${dx?`${dx>0?'right':'left'} ${Math.abs(dx)}`:`${dy>0?'down':'up'} ${Math.abs(dy)}`} px (Shift ×10).`);return;}
    const P=placeOf(t),px=Number.isFinite(P?.x)?P.x:0,py=Number.isFinite(P?.anchor?.[1])?P.anchor[1]:0;
    put(x=>({...x,position:{x:r2(px+dx),y:r2(py+dy)}}),{key:'nudge-title-'+t.id,renderAll:false});
    for(const [n,v] of [['ft-x',px+dx],['ft-y',py+dy]]){const el=panel.querySelector(`[name=${n}]`);if(el)el.value=String(r2(v));}status(`Title nudged to ${r2(px+dx)}, ${r2(py+dy)} (Shift ×10).`);
  }
  function saveShapeKeyed(paths){put(t=>{t.shadow={...t.shadow,paths:structuredClone(paths)};return t;},{key:'ft-nudge'+selected,renderAll:false,message:'Nudged (Shift ×10).'});}
  addEventListener('resize',()=>{lastKey='';sync();});
  return {
    setSource(v){source=v;fromFilm.clear();lastKey='';if(endSel&&!endCard())endSel=null;},has,titles,ticks,lane,snapTargets,panel:panelHtml,chapterFields,header,
    // the Director's keys: Alt+arrows nudge the selected title (or its picked line) in the frame, or one step in time.
    nudgeFrame:d=>{if(endSel&&endCard()){const [dx,dy]=d;if(!Number.isFinite(dx)||!Number.isFinite(dy))return false;const c=endCard();
      if(endSel==='logo'){const B=logoBox(c.logo);putEnd(x=>{x.logo.x=r2(B.x+dx);x.logo.y=r2(B.y+dy);},{parts:['logo'],key:'end-nudge-logo',renderAll:false,message:`Wordmark nudged to ${r2(B.x+dx)}, ${r2(B.y+dy)}.`});}
      else{const L=ctaLayout(c);putEnd(x=>{x.cta.x=r2(L.x+dx);x.cta.gap=r2(Number(c.cta.gap??0)+dy);},{parts:['cta'],key:'end-nudge-cta',renderAll:false,message:'CTA nudged.'});}return true;}
      if(!item())return false;nudge(d);return true;},
    nudgeTime(delta){if(endSel&&endCard())return nudgeEnd(delta);const t=item();if(!t)return false;const s=shot().seconds,dd=Math.max(-t.rel_in,Math.min(s-t.rel_out,delta));putTiming(t.id,Math.round((t.rel_in+dd)*1000)/1000,Math.round((t.rel_out+dd)*1000)/1000,`Title nudged to ${r2(t.rel_in+dd)}–${r2(t.rel_out+dd)} s.`);return true;},
    range:()=>{if(endSel&&endCard())return endSpans(endCard(),shot().seconds)[endSel];const t=item();return t?[t.rel_in,t.rel_out]:null;},
    selectedId:()=>selected||(endSel&&endCard()?'end-'+endSel:null),select,clear,add:addTitle,duplicate:duplicateSelected,
    remove:()=>{if(endSel&&endCard()){status('The end card stays in the film: Reset in Title puts it back to the film\'s.');return;}deleteSelected();},
    endCard:()=>endCard(),endSelected:()=>endSel,split:splitSelected,copy:copySelected,paste:pasteAtPlayhead,picked:()=>picked().map(t=>t.id),lineSelected:()=>lineSel,editing:()=>editing,editHint:()=>editing?SHAPE_HINT:null,sync,fontsLoaded,measure,
    toggleShown(){shown=!shown;lastKey='';sync();return shown;},shown:()=>shown,compositeStill,stillTitles:seconds=>stillTitles(seconds).length,
    fitted:t=>fittedPaths(t,measure),
  };
}
