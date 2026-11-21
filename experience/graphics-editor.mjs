import {graphicTrack,graphicRange as clipRange,editGraphic,splitGraphic} from './graphic-clips.mjs?v=clip-track-20261121';
// the movie chapter's clip track (ch 10 media only; docs/screen-edit-list/CONTRACT.md)
import {movieTrack,trackClips,reorderClip,setTransition,addFromBin,sourceOut} from './screen-edit.mjs?v=clip-track-20261121';
import {trackOverlay,trackLabel,movieInspector,movieFieldChange,binHTML,binInfoOf,monitorHTML} from './movie-edit-ui.mjs?v=clip-track-20261121';
import {FIELDS,KEYS,cleanScreenLook,lookFor} from './screen-look.mjs';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=v=>Number(v.toFixed(2));
export function createGraphicsEditor({panel,timeline,shot,filmShot,showInspector,renderPanel,renderTimeline,status,commit,onPick,groupHead,groupClosed,time,snapStep,magnet}){
  // -1: no graphic selected (20 Nov 2026: it started at 0, so clip 0 counted as the selection whenever nothing else was,
  // and Delete or a re-render after an edit picked it up)
  let selectedGraphic=-1,graphicDrag=null,lookTarget='';
  const graphicScreens=()=>shot().screens??filmShot()?.screens??[];
  const graphicRange=sc=>clipRange(sc,shot().seconds);
  // The movie track (null in every other chapter: there the lane is as it always was). Source lengths: the source bin's.
  const movieKey=()=>movieTrack(shot().id,graphicScreens());
  // The source bin (<cut>/director-film/screen-bin.json, loaded once when the movie chapter's Graphics tab first shows)
  // and the source monitor: a bin source picked (its marks make the clip it adds) or the selected clip's own source.
  let bin=null,binUrl=null,binLoading=false,binInfo=()=>null,binPick=null,marks={in:null,out:null};
  const monitorTime=new Map();
  function loadBin(){if(bin||binLoading||!binUrl)return;binLoading=true;fetch(binUrl,{cache:'no-store'}).then(r=>r.ok?r.json():{sources:[],missing:[]}).catch(()=>({sources:[],missing:[]})).then(doc=>{bin=doc;binInfo=binInfoOf(doc);binLoading=false;renderPanel();renderTimeline();});}
  const movieOpts=()=>({selected:selectedGraphic,info:src=>binInfo(src)});
  function monitorPart(list,mk){
    const seconds=shot().seconds,me=trackClips(list,mk,seconds).find(c=>c.i===selectedGraphic);
    if(binPick)return monitorHTML({mode:'bin',src:binPick,inS:marks.in,outS:marks.out,seconds:binInfo(binPick)?.seconds,canAdd:true});
    if(me)return monitorHTML({mode:'clip',src:me.sc.src,inS:Number(me.sc.offset)||0,outS:sourceOut(me),seconds:binInfo(me.sc.src)?.seconds});
    return '';
  }
  // onTransition: the clip was picked by its transition chip (Delete then takes the transition, not the clip)
  let onTransition=false;
  function pickGraphic(index,{transition=false}={}){onPick?.();selectedGraphic=index;onTransition=transition;binPick=null;showInspector('graphics',true);renderPanel();renderTimeline();status('Graphic selected. Drag the clip to move it; drag either edge to trim.');}
  function graphicsGroup(){
    if(!filmShot())return '';const seconds=shot().seconds,list=graphicScreens(),tracks=new Map();
    list.forEach((sc,i)=>{const key=graphicTrack(sc,i);if(!tracks.has(key))tracks.set(key,[]);tracks.get(key).push([sc,i]);});
    const mk=movieKey(),clip=(sc,i)=>{const [a,b]=graphicRange(sc);return `<button class="desk-clip ${selectedGraphic===i?'selected':''}${sc.missing?' missing':''}" data-graphic-clip="${i}" aria-pressed="${selectedGraphic===i}" aria-label="Graphic ${i+1}, ${r2(a)} to ${r2(b)} seconds" style="left:${a/seconds*100}%;width:${(b-a)/seconds*100}%;background:#244d58" title="${escape(sc.src)}${sc.missing?' · NOT ON THIS MACHINE: kept in the cut, not shown here':''} · drag to move; edges trim source; Ctrl/Cmd+K splits at the playhead${mk&&graphicTrack(sc,i)===mk?'; Ctrl/Cmd+drag moves it between the other clips (ripple)':''}"><span class="clip-resize" data-graphic-edge="start"></span><strong>${escape((sc.src||'Graphic').split('/').pop())}</strong><small>${r2(a)}–${r2(b)} s</small><span class="clip-resize" data-graphic-edge="end"></span></button>`;};
    return `${groupHead('graphics')}<div class="lane-group-body desk-lanes" data-lane-body="graphics" ${groupClosed('graphics')?'hidden':''}><div class="director-actions"><button data-graphic-action="split" ${list[selectedGraphic]?'':'disabled'}>✂ Split at playhead</button></div>${list.length?[...tracks.values()].map(entries=>{const movie=!!mk&&graphicTrack(entries[0][0],entries[0][1])===mk;return `<div class="desk-lane-row${movie?' movie-track':''}" data-lane-color="graphics"${movie?' data-movie-track':''}><span class="desk-lane-label">${movie?trackLabel(list,mk,seconds):escape(entries[0][0].target??'Screen')}</span><div class="desk-lane" data-graphic-lane><div class="desk-lane-line"></div>${entries.map(([sc,i])=>clip(sc,i)).join('')}${movie?trackOverlay(list,mk,seconds,movieOpts()):''}<div class="camera-track-playhead" data-shared-playhead style="left:${time()*100}%"></div></div></div>`;}).join(''):'<p class="director-hint">No screen graphics in this chapter.</p>'}</div>`;
  }
  function graphicAction(action,index=selectedGraphic,button=null){try{
    if(action==='pick'){pickGraphic(index);return;}
    if(action==='mark-in'||action==='mark-out'){
      const v=panel.querySelector('[data-source-monitor]'),t=v?Math.round(v.currentTime*100)/100:NaN;if(!Number.isFinite(t))return;
      if(binPick){marks[action==='mark-in'?'in':'out']=t;renderPanel();status(`${action==='mark-in'?'In':'Out'} at ${t} s of the source. + Add puts it on the Movie track.`);return;}
      const mk=movieKey(),r=mk&&movieFieldChange(graphicScreens(),mk,shot().seconds,selectedGraphic,{name:action==='mark-in'?'me-in':'me-out',value:String(t)});if(!r)return;
      commit(()=>{shot().screens=r.list;},{render:true});renderTimeline();status(`Source ${action==='mark-in'?'in':'out'} ${t} s${r.clamped?' (shortened to the time before the next clip)':''}.`);return;}
    if(action==='bin-add'){
      const mk=movieKey();if(!mk||!binPick)return;const where=button?.dataset.section==='playhead'?Math.round(time()*shot().seconds*100)/100:null;
      const r=addFromBin(graphicScreens(),mk,{src:binPick,seconds:binInfo(binPick)?.seconds??null,inS:marks.in,outS:marks.out},{at:where,seconds:shot().seconds});
      const name=binPick.split('/').pop();binPick=null;marks={in:null,out:null};selectedGraphic=r.i;
      commit(()=>{shot().screens=r.list;},{render:true});showInspector('graphics',true);renderPanel();renderTimeline();status(`${name} added to the Movie track${r.clamped?', shortened to the free time there':''}. Add a transition on its + to blend it in.`);return;}
    let list;if(action==='earlier'||action==='later'){const mk=movieKey(),clips=mk?trackClips(graphicScreens(),mk,shot().seconds):[],k=clips.findIndex(c=>c.i===index);if(k<0)return;
      const to=k+(action==='earlier'?-1:1);list=reorderClip(graphicScreens(),mk,k,to,shot().seconds);selectedGraphic=index;
      commit(()=>{shot().screens=list;},{render:true});showInspector('graphics',true);renderPanel();renderTimeline();status(`Clip moved ${action==='earlier'?'earlier':'later'}: the clips around it keep their lengths. Undo puts it back.`);return;}
    if(action==='split'){list=splitGraphic(graphicScreens(),index,r2(time()*shot().seconds),shot().seconds);selectedGraphic=index+1;}
    else if(action==='delete'){list=structuredClone(graphicScreens()).map((sc,i)=>({...sc,target:sc.target??i}));list.splice(index,1);selectedGraphic=-1;}else return;
    commit(()=>{shot().screens=list;},{render:true});showInspector('graphics',true);renderPanel();renderTimeline();status(action==='split'?'Clip split. Drag either piece to move it, or extend an edge to reveal more of the source.':'Graphic clip deleted. Undo restores it.');
  }catch(error){status(error.message,true);}}
  for(const root of [panel,timeline]){
    root.addEventListener('click',event=>{const button=event.target.closest('[data-graphic-action]');if(!button)return;event.preventDefault();event.stopPropagation();graphicAction(button.dataset.graphicAction,button.dataset.graphicIndex===undefined?selectedGraphic:Number(button.dataset.graphicIndex),button);});
    root.addEventListener('keydown',event=>{if(event.target.closest('input,select,textarea,[contenteditable]'))return;const el=event.target.closest('[data-graphic-clip]');if(!el&&!event.target.closest('[data-inspector-page="graphics"]'))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopImmediatePropagation();graphicAction('split',el?Number(el.dataset.graphicClip):selectedGraphic);}});
  }
  timeline.addEventListener('pointerdown',event=>{if(event.target.closest('[data-clip-transition],[data-clip-seam]')){event.preventDefault();event.stopPropagation();}},true);
  timeline.addEventListener('click',event=>{const b=event.target.closest('[data-clip-transition],[data-clip-seam]');if(!b)return;event.preventDefault();event.stopPropagation();
    const i=Number(b.dataset.clipTransition??b.dataset.clipSeam);pickGraphic(i,{transition:b.dataset.clipTransition!==undefined});status(b.dataset.clipSeam!==undefined?'A cut. Set Transition in (Graphics tab) to Dissolve or Dip.':'Transition selected: its type, length and colour are in the Graphics tab (Render still and the film show it; the live view cuts).');
    // (the fields are shown, not focused: a focused select would swallow the Director's keys, Shift+R included; Windows e2e, 21 Nov 2026)
    panel.querySelector('[data-movie-fields]')?.scrollIntoView({block:'nearest'});},true);
  timeline.addEventListener('pointerdown',event=>{const el=event.target.closest('[data-graphic-clip]');if(!el||event.button!==0)return;event.preventDefault();event.stopPropagation();const index=Number(el.dataset.graphicClip),[a,b]=graphicRange(graphicScreens()[index]);const mk=movieKey(),ripple=!!mk&&(event.ctrlKey||event.metaKey)&&!event.target.dataset.graphicEdge&&graphicTrack(graphicScreens()[index],index)===mk;graphicDrag={index,el,a,b,x:event.clientX,width:el.closest('[data-graphic-lane]').getBoundingClientRect().width,seconds:shot().seconds,edge:event.target.dataset.graphicEdge,next:[a,b],ripple,mk};el.setPointerCapture(event.pointerId);});
  timeline.addEventListener('pointermove',event=>{const d=graphicDrag;if(!d)return;if(d.ripple){rippleMove(d,event);return;}const raw=(event.clientX-d.x)/d.width*d.seconds,delta=event.altKey||!magnet()?raw:Math.round(raw/(snapStep()||.1))*(snapStep()||.1);let [a,b]=[d.a,d.b];if(d.edge==='start')a=Math.max(0,Math.min(b-.1,a+delta));else if(d.edge==='end')b=Math.max(a+.1,Math.min(d.seconds,b+delta));else{const dx=Math.max(-a,Math.min(d.seconds-b,delta));a+=dx;b+=dx;}d.next=[r2(a),r2(b)];d.el.style.left=a/d.seconds*100+'%';d.el.style.width=(b-a)/d.seconds*100+'%';d.el.querySelector('small').textContent=`${r2(a)}–${r2(b)} s`;});
  // Ripple: the clip follows the pointer; a marker shows where it goes in the order; the drop reorders (reorderClip).
  function rippleMove(d,event){
    const dt=(event.clientX-d.x)/d.width*d.seconds,mid=(d.a+d.b)/2+dt,clips=trackClips(graphicScreens(),d.mk,d.seconds),from=clips.findIndex(c=>c.i===d.index),others=clips.filter(c=>c.i!==d.index);
    let to=others.filter(c=>(c.start+c.end)/2<mid).length;d.to=to;d.from=from;
    d.el.style.left=(d.a+dt)/d.seconds*100+'%';d.el.style.opacity='.75';
    const lane=d.el.closest('[data-graphic-lane]');let m=lane.querySelector('.ripple-marker');if(!m){m=document.createElement('div');m.className='ripple-marker';lane.append(m);}
    const at=to<others.length?others[to].start:others.at(-1)?.end??0;m.style.left=at/d.seconds*100+'%';
    status(to===from?'Ripple: drop to keep it where it is.':`Ripple: clip ${from+1} goes to position ${to+1} (the others keep their lengths).`);
  }
  function endGraphic(event){const d=graphicDrag;if(!d)return;graphicDrag=null;if(event.type==='pointercancel'){renderTimeline();return;}
    if(d.ripple){try{if(d.to!==undefined&&d.to!==d.from){const list=reorderClip(graphicScreens(),d.mk,d.from,d.to,shot().seconds);commit(()=>{shot().screens=list;},{render:true});status(`Clip moved to position ${d.to+1}: the clips around it keep their lengths. Undo puts it back.`);}pickGraphic(d.index);}catch(error){renderTimeline();status(error.message,true);}return;}try{if(d.next[0]!==d.a||d.next[1]!==d.b){const list=editGraphic(graphicScreens(),d.index,d.next[0],d.next[1],shot().seconds,{trimStart:d.edge==='start'});commit(()=>{shot().screens=list;},{render:true});}pickGraphic(d.index);}catch(error){renderTimeline();status(error.message,true);}}
  timeline.addEventListener('pointerup',endGraphic);timeline.addEventListener('pointercancel',endGraphic);
  timeline.addEventListener('keydown',event=>{const el=event.target.closest('[data-graphic-clip]');if(el&&event.key==='Enter'){event.preventDefault();pickGraphic(Number(el.dataset.graphicClip));}});
  // ---- Screen look (screen-look.mjs; Vico, 19 Nov 2026: "a little too bright, they pop out too much … make it look more
  // like a monitor image"): for every screen of the chapter, or one of them, today's look at 100 %. The cut's field
  // (shot.screenLook) once touched, else the film's; Reset all writes {} so the export takes the film back to today's.
  const lookNow=()=>cleanScreenLook(shot().screenLook!==undefined?shot().screenLook:filmShot()?.screenLook)||{};
  const targetsOf=list=>[...new Set(list.map((sc,i)=>String(sc.target??i)))];
  const valueText=(k,v)=>k==='warmth'?(Math.abs(v)<.001?'neutral':`${v<0?'cooler':'warmer'} ${Math.round(Math.abs(v)*100)} %`):Math.round(v*100)+' %';
  function lookPanel(list){
    const targets=targetsOf(list);if(lookTarget&&!targets.includes(lookTarget))lookTarget='';
    const look=lookNow(),v=lookFor(look,lookTarget||null),own=lookTarget?look.per?.[lookTarget]:look.all,changed=!!(own&&Object.keys(own).length);
    return `<section class="screen-look" data-screen-look><h4>Screen look</h4>
      <label>Applies to<select name="sl-target" aria-label="Which screens">${['',...targets].map(t=>`<option value="${escape(t)}" ${t===lookTarget?'selected':''}>${t?escape(t)+(look.per?.[t]?' •':''):'All screens'}</option>`).join('')}</select></label>
      ${KEYS.map(k=>{const f=FIELDS[k],mine=own?.[k]!==undefined;return `<label class="screen-look-row${mine?' set':''}" title="${escape(f.tip)}"><span>${escape(f.label)}</span><input type="range" name="sl-${k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v[k]}" aria-label="${escape(f.label)}"><output data-sl-out="${k}">${valueText(k,v[k])}</output></label>`;}).join('')}
      <div class="director-actions"><button type="button" data-sl-action="reset" ${changed?'':'disabled'}>Reset ${lookTarget?'this screen':'all screens'}</button>${lookTarget?'':`<button type="button" data-sl-action="reset-every" ${look.per?'':'disabled'} title="Every screen's own settings too">Reset every screen</button>`}</div>
      <p class="director-hint">100 % is the picture as it was. ${lookTarget?`This screen starts from All screens; what you set here is its own.`:`For every screen of this chapter; pick one above to set it on its own.`} Glow spill shows in Film look and Render still.</p></section>`;
  }
  function setLook(change,text,key){
    const look=structuredClone(lookNow());change(look);const clean=cleanScreenLook(look);
    commit(()=>{shot().screenLook=clean||{};},{key,render:false});if(text)status(text);
  }
  function lookInput(el,final){
    const k=el.name.slice(3);if(!FIELDS[k])return;const value=Number(el.value),t=lookTarget;
    setLook(look=>{const box=t?((look.per||={})[t]||={}):(look.all||={});box[k]=value;},final?`${t||'All screens'}: ${FIELDS[k].label.toLowerCase()} ${valueText(k,value)}.`:'','screen-look-'+(t||'all')+'-'+k);
    const out=panel.querySelector(`[data-sl-out="${k}"]`);if(out)out.textContent=valueText(k,value);el.closest('.screen-look-row')?.classList.add('set');
  }
  panel.addEventListener('input',event=>{const el=event.target;if(!el.closest?.('[data-screen-look]')||!/^sl-/.test(el.name)||el.name==='sl-target')return;event.stopPropagation();lookInput(el,false);},true);
  panel.addEventListener('change',event=>{const el=event.target;if(!el.closest?.('[data-screen-look]'))return;event.stopPropagation();
    if(el.name==='sl-target'){lookTarget=el.value;renderPanel();return;}if(/^sl-/.test(el.name)){lookInput(el,true);renderPanel();}},true);
  panel.addEventListener('click',event=>{const b=event.target.closest('[data-sl-action]');if(!b)return;event.preventDefault();event.stopPropagation();const t=lookTarget;
    if(b.dataset.slAction==='reset')setLook(look=>{if(t){if(look.per)delete look.per[t];}else delete look.all;},t?`${t}: back to All screens.`:'All screens: back to the picture as it was (screens with their own settings keep them).');
    else setLook(look=>{delete look.all;delete look.per;},'Every screen back to the picture as it was.');
    renderPanel();});
  function screenLayers(){
    const list=shot().screens??filmShot()?.screens??[];
    if(!list.length)return '<p class="director-hint">No screen graphics in this chapter.</p>';
    const mk=movieKey();if(mk)loadBin();
    return `${lookPanel(list)}${mk?movieInspector(list,mk,shot().seconds,movieOpts())+monitorPart(list,mk)+binHTML(bin,{picked:binPick}):''}<p class="director-hint">Select a clip, place the playhead where you want to cut, then Split at playhead (Ctrl/Cmd+K). Drag pieces to move them; drag edges to trim or extend the source.</p><details open><summary>Screen graphics · ${list.length}</summary>${list.map((sc,i)=>`<details ${selectedGraphic===i?'open':''}><summary>${escape(sc.target??'Screen')} · clip ${i+1}</summary><div class="director-actions"><button data-graphic-action="split" data-graphic-index="${i}">✂ Split at playhead</button><button data-graphic-action="delete" data-graphic-index="${i}">Delete clip</button></div><div class="director-grid"><label>Comes in (seconds)<input type="number" min="0" max="${shot().seconds}" step=".1" data-screen-index="${i}" data-screen-field="start" value="${graphicRange(sc)[0]}"></label><label>Goes out (seconds)<input type="number" min="0" max="${shot().seconds}" step=".1" data-screen-index="${i}" data-screen-field="end" value="${graphicRange(sc)[1]}"></label></div><label>Graphic source<input data-screen-index="${i}" data-screen-field="src" value="${escape(sc.src)}"></label><div class="director-grid"><label>Clip offset (seconds)<input type="number" step=".05" data-screen-index="${i}" data-screen-field="offset" value="${Number(sc.offset)||0}"></label><label>Playback speed<input type="number" min=".01" step=".05" data-screen-index="${i}" data-screen-field="rate" value="${sc.rate??1}"></label></div><label>Fit<select data-screen-index="${i}" data-screen-field="fit">${['cover','contain','stretch'].map(v=>`<option ${v===(sc.fit||'cover')?'selected':''}>${v}</option>`).join('')}</select></label><label>Loop<select data-screen-index="${i}" data-screen-field="loop"><option value="true" ${sc.loop!==false?'selected':''}>Loop</option><option value="false" ${sc.loop===false?'selected':''}>Hold last frame</option></select></label></details>`).join('')}<p class="director-hint">Offset selects the starting moment of the source clip. These settings apply to this chapter.</p></details>`;
  }
  panel.addEventListener('change',event=>{
    const el=event.target;if(!/^me-/.test(el.name||'')||!el.closest('[data-movie-fields]'))return;event.stopPropagation();
    try{const mk=movieKey(),i=Number(el.closest('[data-movie-fields]').dataset.movieFields),r=mk&&movieFieldChange(graphicScreens(),mk,shot().seconds,i,el);if(!r)return;
      selectedGraphic=i;commit(()=>{shot().screens=r.list;},{render:true});renderTimeline();
      status(el.name==='me-type'?(el.value==='cut'?'A cut.':`${el.value==='dip'?'Dip':'Dissolve'} in. The live view cuts here; Render still and the film show the blend.`):r.clamped?'Shortened to the time before the next clip.':'Clip updated.');
    }catch(error){renderPanel();status(error.message,true);}
  },true);
  panel.addEventListener('change',event=>{
    const el=event.target;if(el.dataset.screenIndex===undefined)return;
    event.stopPropagation();try{let list=structuredClone(shot().screens??filmShot()?.screens??[]),sc=list[Number(el.dataset.screenIndex)],key=el.dataset.screenField;if(!sc)return;
      const value=key==='loop'?el.value==='true':['offset','rate','start','end'].includes(key)?Number(el.value):el.value;
      if(typeof value==='number'&&(!Number.isFinite(value)||(key==='rate'&&value<=0)))throw Error('Enter a valid playback value.');
      if(key==='start'&&(value<0||value>=(sc.end??shot().seconds)))throw Error('Comes in must be before Goes out.');
      if(key==='end'&&(value<= (sc.start??0)||value>shot().seconds))throw Error('Goes out must follow Comes in and fit in the chapter.');
      if(key==='start'||key==='end'){const [a,b]=graphicRange(sc);list=editGraphic(list,Number(el.dataset.screenIndex),key==='start'?value:a,key==='end'?value:b,shot().seconds,{trimStart:key==='start'});}else sc[key]=value;selectedGraphic=Number(el.dataset.screenIndex);commit(()=>{shot().screens=list;},{render:true});status('Monitor graphic updated.');
    }catch(error){renderPanel();status(error.message,true);}
  },true);
  const live=()=>selectedGraphic>=0&&selectedGraphic<graphicScreens().length?selectedGraphic:-1;
  // bin picks; the monitor keeps its moment across re-renders (media events do not bubble: capture)
  panel.addEventListener('click',event=>{const b=event.target.closest('[data-movie-bin]');if(!b)return;event.preventDefault();event.stopPropagation();
    binPick=b.dataset.movieBin;marks={in:null,out:null};renderPanel();status(`${binPick.split('/').pop()} in the monitor: play or scrub it, Mark in / Mark out, then + Add.`);},true);
  panel.addEventListener('loadedmetadata',event=>{const v=event.target;if(!v.matches?.('[data-source-monitor]'))return;const src=v.getAttribute('src'),t=monitorTime.get(src)??Number(v.dataset.in);if(Number.isFinite(t)&&t>0)v.currentTime=Math.min(t,v.duration||t);},true);
  panel.addEventListener('timeupdate',event=>{const v=event.target;if(v.matches?.('[data-source-monitor]'))monitorTime.set(v.getAttribute('src'),v.currentTime);},true);
  panel.addEventListener('seeked',event=>{const v=event.target;if(v.matches?.('[data-source-monitor]'))monitorTime.set(v.getAttribute('src'),v.currentTime);},true);
  return {setBinUrl(u){if(u!==binUrl){binUrl=u||null;bin=null;binInfo=()=>null;}},panel:screenLayers,lane:graphicsGroup,screens:graphicScreens,selected:live,clear(){selectedGraphic=-1;},remove(){const i=live();if(i<0)return false;if(onTransition&&graphicScreens()[i]?.transitionIn){const list=setTransition(graphicScreens(),i,null);onTransition=false;commit(()=>{shot().screens=list;},{render:true});renderTimeline();status('Transition deleted: a cut again. Undo brings it back.');return true;}graphicAction('delete',i);return true;},range:i=>{const sc=graphicScreens()[i];return sc?graphicRange(sc):null;}};
}
