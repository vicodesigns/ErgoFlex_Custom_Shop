import {addCameraHolds} from './camera-holds.mjs';
import {cinematicViews,polishMovement,openingSwoop} from './cinematography.mjs';
import {paceChapter} from './chapter-timing.mjs';
import {validateClipSchedule,sampledMotionToClips,legacyMotionToClips,cleanClipMotion} from './desk-clips.mjs';
import {groupRange,snapGroupDelta,shiftGroup} from './timeline-group.mjs';
import {filmLink,loadFilmChapters,filmChapterLabel,filmChapterIndex} from './film-chapters.mjs';
import {timelineTicks,snapTimelineTime,adjacentEdit,TIMELINE_ZOOMS} from './timeline-ui.mjs';
import {createDeskEditor} from './desk-editor.mjs';
import {score} from './score.mjs';
import {makeOpeningShot} from './opening.mjs';
import {showcaseShots,showcaseViews} from './showcase.mjs';
import {BAKE_PROFILE} from './bake.mjs';
import {resolveCameraKeys,moveCameraKey,CAMERA_EASINGS} from './camera-track.mjs';
import {CutLibrary,makeCut,cleanCut,cleanShot,sceneShot,generateCut,encodeCut,KINDS,PRESET_IDS,defaultPreset} from './cuts.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(id,label,value)=>`<option value="${escape(id)}" ${id===value?'selected':''}>${escape(label)}</option>`;
const duration=shots=>shots.reduce((n,s)=>n+s.seconds,0);
const copy=value=>structuredClone(value);

export function mountDirector(bridge,catalog,initial){
  let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Browser storage is unavailable. Export this cut to keep it.');}};}
  const library=new CutLibrary(storage);
  let project=initial?{...makeCut(initial.name,initial.shots),client:initial.client,volume:initial.volume}:library.current()||makeCut();
  project=cleanCut(project,catalog);
  let selected=0,undo=[],redo=[],group=null,draftTimer,open=false,loadToken=0,composing=false;
  const choices=new Map(),automaticCameras=new Map();
  let keyId=null,playhead=0,keyDrag=null,suppressKeyClickUntil=0;
  let inspector='chapter',zoom=1,snapStep=.1,scrub=null,timelineResize=null,focusSelection=false;
  // Timeline group selection (camera keys + desk clips) and the film chapter list.
  const picks={keys:new Set(),clips:new Set()};let marquee=null,groupDrag=null,suppressGroupClickUntil=0;
  const film=filmLink(location.hash),signature=()=>JSON.stringify([project.name,project.client,project.volume,project.shots]);
  let filmChapters=null,filmError='',exported=signature();
  const panel=document.createElement('section');panel.id='director-panel';panel.setAttribute('aria-label','Director controls');
  const timeline=document.createElement('section');timeline.id='director-timeline';timeline.setAttribute('aria-label','Chapter timeline');
  const picker=document.createElement('dialog');picker.id='scene-picker';picker.setAttribute('aria-label','Choose client environments');
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
  document.body.append(panel,timeline,picker,file);
  const field=name=>panel.querySelector(`[name="${name}"]`);
  const shot=()=>project.shots[selected];
  const keys=()=>resolveCameraKeys(shot().camera,automaticCameras.get(shot().id)||[]);
  const selectedKey=()=>keys().find(k=>k.id===keyId);
  function showInspector(tab,selection=false,reveal=true){
    if(selection)focusSelection=true;
    inspector=tab;if(reveal)document.body.classList.remove('inspector-hidden');
    for(const page of panel.querySelectorAll('[data-inspector-page]'))page.hidden=page.dataset.inspectorPage!==tab;
    for(const button of panel.querySelectorAll('[data-inspector-tab]'))button.setAttribute('aria-pressed',String(button.dataset.inspectorTab===tab));
    panel.scrollTop=0;
  }
  function editTimes(){return [...keys().map(k=>k.time*shot().seconds),...deskEditor.boundaries()];}
  function snapTime(value,{pixels=1000,bypass=false,excludeClip,excludeKey,excludePlayhead=false}={}){
    return snapTimelineTime(value,{seconds:shot().seconds,step:snapStep,bypass,targets:[0,shot().seconds,...(excludePlayhead?[]:[playhead*shot().seconds]),...keys().filter(k=>k.id!==excludeKey).map(k=>k.time*shot().seconds),...deskEditor.boundaries(excludeClip)],tolerance:8*shot().seconds/pixels});
  }
  function ensureKeys(){shot().camera={keys:copy(keys())};return shot().camera.keys;}
  function requireReady(){if(!bridge.ready())throw Error('Wait for this chapter to finish loading.');}
  function seekCamera(time){requireReady();playhead=Math.max(0,Math.min(1,time));bridge.seek(playhead);syncPlayhead();}
  function syncTransport(){
    const bake=bridge.bakeState(),bakeLabel=BAKE_PROFILE.height+'p / '+BAKE_PROFILE.fps+' fps',state=bridge.playback(),active=state.playing&&state.index===selected,label=state.busy?'Loading chapter…':active?'❚❚ Pause chapter':'▶ Play chapter';
    for(const root of [panel,timeline]){
      for(const el of root.querySelectorAll('button,input,select,textarea')){
        if((bake.baking||composing)&&(!bake.baking||!['bake','bake-all'].includes(el.dataset.action))){
          if(!el.hasAttribute('data-before-bake'))el.dataset.beforeBake=String(el.disabled);el.disabled=true;
        }else if(el.hasAttribute('data-before-bake')){el.disabled=el.dataset.beforeBake==='true';delete el.dataset.beforeBake;}
      }
      for(const button of root.querySelectorAll('[data-action="bake"]')){button.textContent=bake.baking?'Cancel bake':bake.available?'Rebake chapter':'Bake chapter';button.disabled=state.busy&&!bake.baking;}
      for(const button of root.querySelectorAll('[data-action="bake-all"]')){button.textContent=bake.batch?'Cancel full bake':'Bake full intro · 1080p';button.disabled=state.busy&&!bake.batch;}
      for(const button of root.querySelectorAll('[data-action="bake-download"]'))button.disabled=!bake.available||bake.baking;
      for(const text of root.querySelectorAll('[data-bake-summary]'))text.textContent=bake.baking?(bake.batch?'Full intro · '+(bake.batch.index+1)+' / '+bake.batch.total+' chapters · ':'')+'Baking '+Math.round(bake.progress*100)+'% · '+bakeLabel:bake.state==='error'?'Bake unavailable: '+bake.error:bake.available?(bake.using?'Playing baked video':'Baked · '+bakeLabel)+' · '+(bake.bytes/1048576).toFixed(1)+' MB'+(bake.persisted?' · Saved locally':' · This session'):bake.state==='stale'?'Chapter edited · bake again to update':'Live 3D · Not baked';
      const enabled=root.querySelector('[name="baked-playback"]');if(enabled)enabled.checked=bake.enabled;
      for(const button of root.querySelectorAll('[data-action="chapter-toggle"]')){
        button.textContent=label;button.disabled=state.busy;button.setAttribute('aria-label',active?'Pause chapter':'Play chapter');button.setAttribute('aria-pressed',String(active));
      }
      for(const button of root.querySelectorAll('[data-action="preview"]'))button.disabled=state.busy;
      for(const button of root.querySelectorAll('[data-action="preview-loop"]')){button.setAttribute('aria-pressed',String(state.loop));button.textContent=state.loop?'Loop on':'Loop off';}
      if(!bake.baking&&!composing)for(const [name,stack] of [['undo',undo],['redo',redo]])for(const button of root.querySelectorAll(`[data-action="${name}"]`))button.disabled=!stack.length;
    }
    if(bake.baking)for(const root of [panel,timeline])for(const el of root.querySelectorAll('button,input,select,textarea'))if(!['bake','bake-all'].includes(el.dataset.action))el.disabled=true;
    if(composing)for(const root of [panel,timeline])for(const el of root.querySelectorAll('button,input,select,textarea'))el.disabled=true;
    deskEditor.sync();
    const cameraPreview=panel.querySelector('[data-action=key-preview]');if(cameraPreview)cameraPreview.textContent=state.playing&&state.range?.id==='camera-'+keyId?'❚❚ Pause camera move':'▶ Preview camera move';
  }
  function syncCameraOptions(){
    const select=field('camera-key');if(!select)return;
    for(const option of select.options){const key=keys().find(k=>k.id===option.value);if(key)option.textContent=key.label+' · '+(key.time*shot().seconds).toFixed(2)+'s';}
  }
  function syncPlayhead(){
    deskEditor.sync();
    const range=field('seek');if(range)range.value=playhead*100;
    const line=timeline.querySelector('[data-track-playhead]');if(line)line.style.left=(playhead*100)+'%';
    const label=timeline.querySelector('[data-track-time]');if(label)label.textContent=(playhead*shot().seconds).toFixed(2)+'s / '+shot().seconds+'s';
    for(const line of timeline.querySelectorAll('[data-shared-playhead]'))line.style.left=playhead*100+'%';
    const ruler=timeline.querySelector('.time-ruler');if(ruler)ruler.setAttribute('aria-valuenow',(playhead*shot().seconds).toFixed(2));
    const exact=timeline.querySelector('[name="timeline-seconds"]');if(exact&&document.activeElement!==exact)exact.value=(playhead*shot().seconds).toFixed(2);
  }
  function syncPan(){const viewport=timeline.querySelector('.timeline-viewport'),range=timeline.querySelector('[name="timeline-pan"]');if(viewport&&range&&document.activeElement!==range)range.value=viewport.scrollLeft/Math.max(1,viewport.scrollWidth-viewport.clientWidth)*100;}
  function selectKey(id){keyId=id;const k=selectedKey();if(!k)return;deskEditor.clearSelection();showInspector('camera',true);seekCamera(k.time);renderPanel();renderTimeline();}
  function captureKey(time,label){
    requireReady();const view=bridge.stage().captureCamera();if(!view)throw Error('The camera is not ready.');
    deskEditor.clearSelection();showInspector('camera');
    const existing=keys().find(k=>Math.abs(k.time-time)<.001);if(!existing&&keys().length>=64)throw Error('A chapter can hold up to 64 camera keyframes.');
    commit(()=>{const list=ensureKeys();if(existing){const key=list.find(k=>k.id===existing.id);key.view=view;keyId=key.id;}else{const key={id:crypto.randomUUID(),time,label:label||'Camera view '+(list.length+1),easing:'smooth',path:'orbit',view};list.push(key);keyId=key.id;}list.sort((a,b)=>a.time-b.time);},{render:true});
    status('Camera keyframe captured. Drag its diamond on the timeline to change its timing.');
  }

  const status=(message,error=false)=>{for(const el of [panel.querySelector('[data-status]'),timeline.querySelector('[data-timeline-status]')])if(el){el.textContent=message;el.classList.toggle('error',error);}};
  function draft(){clearTimeout(draftTimer);try{library.draft(project);status('Draft kept in this browser · Save cut when ready.');}catch{status('Edit kept in this editor (browser storage is full, so no draft copy) · Export cut sends it to the film.');}}
  function changed(){bridge.update(project);clearTimeout(draftTimer);draftTimer=setTimeout(draft,250);renderTimeline();syncCameraOptions();syncFilm();for(const [name,stack]of [['undo',undo],['redo',redo]]){const b=panel.querySelector(`[data-action="${name}"]`);if(b)b.disabled=!stack.length;}}
  // Film chapters: a dropdown that reloads this tab with another chapter's page.
  const filmIndex=()=>filmChapterIndex(filmChapters,project.shots.map(s=>s.id));
  const unexported=()=>signature()!==exported;
  function filmPicker(){
    if(!film)return '';
    if(!filmChapters)return `<div class="film-chapter-picker" data-film-picker><span class="director-hint">${filmError?escape(filmError):'Loading film chapters…'}</span></div>`;
    const i=filmIndex();
    return `<div class="film-chapter-picker" data-film-picker><button data-action="film-prev" aria-label="Previous film chapter" title="Previous film chapter" ${i<=0?'disabled':''}>‹</button><label><span>Film chapter</span><select name="film-chapter" aria-label="Film chapter" title="Switch film chapter (reloads this tab)">${i<0?'<option value="-1" selected>Choose a chapter…</option>':''}${filmChapters.map((c,n)=>option(String(n),filmChapterLabel(c),String(i))).join('')}</select></label><button data-action="film-next" aria-label="Next film chapter" title="Next film chapter" ${i<0&&filmChapters.length?'':i>=filmChapters.length-1?'disabled':''}>›</button><span class="film-dirty" data-film-dirty title="Edited since the last Export cut" ${unexported()?'':'hidden'}>● not exported</span></div>`;
  }
  function syncFilm(){
    if(!film)return;const dirty=unexported(),i=String(filmIndex());
    for(const el of document.querySelectorAll('[data-film-dirty]'))el.hidden=!dirty;
    for(const el of document.querySelectorAll('select[name="film-chapter"]'))if(el.value!==i)el.value=i;
  }
  function renderFilm(){for(const el of document.querySelectorAll('[data-film-picker]'))el.outerHTML=filmPicker();syncTransport();}
  if(film)loadFilmChapters(film.film).then(list=>{filmChapters=list;filmError='';},error=>{filmError='Film chapters unavailable: '+error.message;}).finally(renderFilm);
  const switcher=document.createElement('dialog');switcher.id='film-switch';switcher.setAttribute('aria-labelledby','film-switch-title');document.body.append(switcher);
  function switchFilm(n){
    const target=filmChapters?.[n];if(!target||n===filmIndex()){syncFilm();return;}
    if(!deskEditor.flush()){syncFilm();return;}
    if(!unexported()){goFilm(target);return;}
    switcher.dataset.target=String(n);
    switcher.innerHTML=`<div class="director-heading"><div><span class="director-kicker">SWITCH FILM CHAPTER</span><h2 id="film-switch-title">Export your edits first?</h2></div></div><p>This chapter changed since the last Export cut. Opening <b>${escape(filmChapterLabel(target))}</b> reloads this tab; unexported edits only stay as a browser draft.</p><div class="director-actions"><button data-switch="export" class="primary">Export cut, then switch</button><button data-switch="go">Switch without exporting</button><button data-switch="cancel">Cancel</button></div>`;
    switcher.showModal();switcher.querySelector('[data-switch=export]').focus();
  }
  function goFilm(target){deskEditor.stop();status('Opening film chapter '+filmChapterLabel(target)+'…');for(const el of document.querySelectorAll('[data-film-picker] button,[data-film-picker] select'))el.disabled=true;location.assign(target.url);}
  switcher.addEventListener('click',event=>{
    const choice=event.target.closest('[data-switch]')?.dataset.switch;if(!choice)return;
    const target=filmChapters?.[Number(switcher.dataset.target)];switcher.close();
    if(choice==='cancel'||!target){syncFilm();return;}
    if(choice==='go'){goFilm(target);return;}
    action('save-export');if(unexported())return;
    // Give the download a moment to leave before the page unloads its blob URL.
    status('Cut exported · opening '+filmChapterLabel(target)+'…');setTimeout(()=>goFilm(target),900);
  });
  switcher.addEventListener('close',()=>syncFilm());
  // Group selection: marquee or Shift/Ctrl-click camera keys and desk clips, then move them together.
  const picked=()=>picks.keys.size+picks.clips.size;
  function syncPicks(){
    const keyIds=new Set(keys().map(k=>k.id)),clipIds=new Set(deskEditor.motion().clips.map(c=>c.id));
    for(const id of picks.keys)if(!keyIds.has(id))picks.keys.delete(id);
    for(const id of picks.clips)if(!clipIds.has(id))picks.clips.delete(id);
    for(const el of timeline.querySelectorAll('[data-key]'))el.classList.toggle('grouped',picks.keys.has(el.dataset.key));
    for(const el of timeline.querySelectorAll('[data-desk-clip]'))el.classList.toggle('grouped',picks.clips.has(el.dataset.deskClip));
    timeline.classList.toggle('has-group',picked()>0);
  }
  function groupStatus(){const k=picks.keys.size,c=picks.clips.size;status(picked()?`${k} camera view${k===1?'':'s'} · ${c} move${c===1?'':'s'} selected · drag one to move them together · ←/→ nudge (Shift ×10) · Esc clears`:'Selection cleared.');}
  function clearPicks(){if(!picked())return;picks.keys.clear();picks.clips.clear();syncPicks();}
  function togglePick(kind,id){
    if(!picked()){if(keyId)picks.keys.add(keyId);const clip=deskEditor.selectedId();if(clip)picks.clips.add(clip);}
    if(picks[kind].has(id))picks[kind].delete(id);else picks[kind].add(id);syncPicks();groupStatus();
  }
  function pickAll(){for(const k of keys())picks.keys.add(k.id);for(const c of deskEditor.motion().clips)picks.clips.add(c.id);syncPicks();groupStatus();}
  const groupBase=()=>({seconds:shot().seconds,keys:copy(keys()),clips:copy(deskEditor.motion().clips)});
  function shiftPicks(delta,message){
    requireReady();const base=groupBase(),next=shiftGroup(base,picks,delta);if(Math.abs(next.delta)<1e-9){renderTimeline();status('The selection is already at the start of the chapter.');return;}
    const motion=deskEditor.motion(),longer=next.seconds!==base.seconds,position=playhead*base.seconds;
    commit(()=>{const s=shot();s.seconds=next.seconds;if(next.keys.length&&(picks.keys.size||longer))s.camera={keys:next.keys};if(picks.clips.size||longer)s.motion=cleanClipMotion({...copy(motion),clips:next.clips},next.seconds);},{render:true});
    seekCamera(position/next.seconds);
    status(`${message} ${next.delta>0?'+':''}${Number(next.delta.toFixed(3))}s${longer?` · chapter lengthened to ${next.seconds}s`:''}. Undo restores the previous timing.`);
  }
  function previewGroup(d){
    const s=d.base.seconds;let valid=true,next=null;try{next=shiftGroup(d.base,picks,d.delta);}catch{valid=false;}
    for(const el of timeline.querySelectorAll('[data-key].grouped')){const k=d.base.keys.find(k=>k.id===el.dataset.key);if(k){el.style.left=(k.time*s+d.delta)/s*100+'%';el.classList.toggle('invalid',!valid);}}
    for(const el of timeline.querySelectorAll('[data-desk-clip].grouped')){const c=d.base.clips.find(c=>c.id===el.dataset.deskClip);if(c){el.style.left=(c.start+d.delta)/s*100+'%';el.classList.toggle('invalid',!valid);}}
    status(valid?`Moving ${picked()} item${picked()===1?'':'s'} ${d.delta>0?'+':''}${Number(d.delta.toFixed(3))}s${next.seconds>s?` · chapter becomes ${next.seconds}s`:''} · Alt: bypass snap`:'Those positions overlap another movement or camera view.',!valid);
  }
  function commit(fn,{render=false,key=null}={}){
    if(!key||group!==key){undo.push(copy(project));undo=undo.slice(-40);redo=[];}
    group=key;fn();changed();if(render)renderPanel();
  }
  function loadProject(value,keepDraft=true){if(keepDraft)draft();project=cleanCut(value,catalog);picks.keys.clear();picks.clips.clear();selected=0;keyId=null;playhead=0;undo=[];redo=[];group=null;changed();render();load();}
  function render(){renderPanel();renderTimeline();}
  function renderPanel(){
    const scroll=panel.scrollTop,active=panel.contains(document.activeElement)?document.activeElement:null;
    const activeName=active?.name,selection=active?.selectionStart==null?null:[active.selectionStart,active.selectionEnd];
    const s=shot(),room=catalog.find(r=>r.id===s.room),layout=room?.layouts.find(l=>l.id===s.layout),modes=layout?.modes||room?.modes||[];
    const cameraKey=selectedKey();
    const cuts=[...library.data.cuts];for(const draft of Object.values(library.data.drafts))if(!cuts.some(c=>c.id===draft.id))cuts.push(draft);
    panel.innerHTML=`
      <div class="director-heading"><div><span class="director-kicker">DIRECTOR MODE</span><h2>Director studio.</h2></div><button data-action="inspector" aria-label="Hide inspector" title="Hide inspector; keep the timeline open">‹</button></div>
      <div class="inspector-global"><button data-action="save-export" class="primary" title="Download this cut (the film picks it up from Downloads); also keeps a copy in this browser when there is room">Export cut</button><button data-action="undo" title="Undo (Ctrl/Cmd+Z)" ${undo.length?'':'disabled'}>Undo</button><button data-action="redo" title="Redo (Ctrl+Y or Ctrl/Cmd+Shift+Z)" ${redo.length?'':'disabled'}>Redo</button></div>${filmPicker()}
      <nav class="inspector-tabs" aria-label="Inspector sections">${['project','chapter','camera','groove'].map(tab=>`<button data-inspector-tab="${tab}" aria-pressed="${inspector===tab}">${tab[0].toUpperCase()+tab.slice(1)}</button>`).join('')}<button data-action="inspector" aria-label="Hide inspector" title="Hide inspector">×</button></nav>
      <p data-status role="status" class="director-status">${project.shots.length} chapters · ${Math.round(duration(project.shots))} seconds</p>
      <div data-inspector-page="project">
      <div class="director-actions"><button data-action="new">New cut</button><button data-action="clone">Duplicate cut</button></div>
      <div class="version-templates"><span class="director-kicker">START WITH A VERSION</span><div class="director-actions"><button data-action="template-short">30-second reel</button><button data-action="template-long">85-second story</button><button data-action="template-showcase" class="primary">Director’s showcase · extended</button></div><p class="director-hint">Opens a new editable copy. Switch between your existing versions under Saved client cuts.</p></div>
      <div class="chapter-pacing"><button data-action="cinematic-pass" class="primary">Create cinematic camera & movement pass</button><p class="director-hint">Creates a separate cut with chapter-specific camera direction, readable movement timing and a low-angle opening finale. Your current cut remains available.</p></div>
      <label>Saved client cuts<select name="saved"><option value="">Choose a saved cut…</option>${cuts.map(c=>option(c.id,`${c.name}${library.data.drafts[c.id]?' · draft':''}`,project.id)).join('')}</select></label>
      <div class="director-grid"><label>Cut name<input name="name" maxlength="100" value="${escape(project.name)}"></label><label>Client / audience<input name="client" maxlength="100" placeholder="e.g. Humboldt Library" value="${escape(project.client)}"></label></div>
      <div class="director-actions"><button data-action="scenes">Choose environments</button><button data-action="import">Import cut</button><button data-action="export">Export cut</button><button data-action="link">Copy presentation link</button></div>
      <p class="director-hint">Links include your cut settings. Recipients need access to this server.</p>
      <label>Music volume<input name="volume" type="range" min="0" max="1" step=".01" value="${project.volume}"></label><div class="director-actions"><button data-action="play" class="primary">▶ Play client cut</button><button data-action="bake-all">Bake full intro · 1080p</button><button data-action="bake-export-all">Export all baked chapters</button><button data-action="delete-cut">Delete saved cut</button></div></div>
      <div data-inspector-page="chapter"><h3>Chapter ${selected+1} <span class="inspector-subtitle">of ${project.shots.length}</span></h3><div class="director-actions"><button data-action="add">+ Add chapter</button><button data-action="duplicate">Duplicate chapter</button><button data-action="remove" ${project.shots.length===1?'disabled':''}>Remove chapter</button>${selected===0?'<button data-action="rebuild-opening">✦ Rebuild opening</button><button data-action="camera-holds">4s holds at every view</button>':''}</div>
      <label>Headline<input name="title" maxlength="140" value="${escape(s.title)}"></label>
      <label>Supporting text<textarea name="detail" rows="2" maxlength="260">${escape(s.detail)}</textarea></label>
      <div class="director-grid"><label>Duration (seconds)<input name="seconds" type="number" min="2" max="90" step=".5" value="${s.seconds}"></label><label>Blend into shot (seconds)<input name="transition" type="number" min="0" max="3" step=".1" value="${s.transition}"></label></div>
      <fieldset class="chapter-pacing"><legend>Chapter pacing</legend>
      <div class="director-actions"><button data-action="pace-faster" ${s.seconds*.8<2?'disabled':''}>20% shorter</button><button data-action="pace-slower" ${s.seconds*1.25>90?'disabled':''}>25% longer</button><button data-action="pace-hold" ${s.seconds+2>90?'disabled':''}>+ 2s ending hold</button></div>
      <p class="director-hint">Shorter / longer retimes camera and all movements together. Ending hold keeps their timing and pauses on the final pose. Undo restores the previous timing.</p></fieldset>
      <label>Environment<select name="room">${catalog.map(r=>option(r.id,r.name,s.room)).join('')}</select></label>
      <div class="director-grid"><label>Room size / layout<select name="layout" ${room?.layouts.length?'':'disabled'}>${room?.layouts.length?room.layouts.map(l=>option(l.id,l.name,s.layout)).join(''):'<option>Product stage</option>'}</select></label><label>Time / activity<select name="mode" ${modes.length?'':'disabled'}>${modes.length?modes.map(m=>option(m.id,m.label,s.mode)).join(''):'<option>Studio</option>'}</select></label></div>
      <label>Feature / animation<select name="kind">${KINDS.map(([id,name])=>option(id,name,s.kind)).join('')}</select></label>
      <div class="director-grid"><label>Desk build<select name="preset">${PRESET_IDS.map(id=>option(id,({occ:'Orange Coast College',hbhs:'HBHS Oilers',library:'Humboldt / Library'})[id]||id[0].toUpperCase()+id.slice(1),s.preset)).join('')}</select></label><label>Desk width<select name="size">${option('48x30','48″',s.size)}${option('60x30','60″',s.size)}</select></label></div>
      <div class="director-actions"><button data-action="load">Load / reset shot</button><button data-action="chapter-toggle" class="primary">▶ Play chapter</button><button data-action="preview">↻ Restart chapter</button></div>
      <div class="bake-controls"><div class="director-actions"><button data-action="bake">Bake chapter</button><button data-action="bake-all">Bake full intro · 1080p</button><button data-action="bake-download">Download 3D video</button></div><label class="director-check"><input type="checkbox" name="baked-playback" checked>Use baked playback when available</label><p data-bake-summary role="status" class="director-hint"></p><p class="director-hint">Bake renders every frame in advance. Clips stay in this browser; editing the chapter requires a new bake.</p></div>
      </div><div data-inspector-page="camera"><h3>Camera keyframes</h3><p class="director-hint">Drag the scene to orbit. Scroll or pinch to zoom. Right-drag to pan. Then capture a view.</p>
      <div class="director-actions camera-framing"><button data-action="frame-desk">Frame desk</button><button data-action="frame-room" ${s.room==='product'?'disabled':''}>Frame room</button></div>
      <div class="director-actions"><button data-action="camera-from">${s.camera&&keys().some(k=>k.time===0)?'✓ ':''}Capture start view</button><button data-action="camera-to">${s.camera&&keys().some(k=>k.time===1)?'✓ ':''}Capture end view</button><button data-action="camera-clear">Reset camera</button></div>
      <label>Preview position<input name="seek" type="range" min="0" max="100" step=".01" value="${playhead*100}"></label>
      <p class="director-hint">Select a diamond below to edit its view. Scrub to a time, orbit the camera, then add a keyframe. Dashed diamonds are automatic views until you edit them.</p>
      <div class="director-actions"><button data-action="key-add">+ Add camera keyframe</button><button data-action="key-update" class="primary" ${cameraKey?'':'disabled'}>Update selected view</button><button data-action="key-duplicate" title="Duplicate selected camera view (Ctrl/Cmd+D)" ${cameraKey?'':'disabled'}>Duplicate keyframe</button><button data-action="key-delete" ${cameraKey?'':'disabled'}>Delete keyframe</button></div>
      <label>Selected camera keyframe<select name="camera-key"><option value="">Select a keyframe…</option>${keys().map(k=>option(k.id,`${k.label} · ${(k.time*s.seconds).toFixed(2)}s`,keyId)).join('')}</select></label>
      ${cameraKey?`<div class="selection-preview"><button data-action="key-preview" ${keys().at(-1)?.id===cameraKey.id?'disabled title="Last camera view: select an earlier view to preview its move"':''}>▶ Preview camera move</button><button data-action="key-go">Go to view</button></div><label>Keyframe name<input name="key-label" maxlength="60" value="${escape(cameraKey.label)}"></label><div class="director-grid"><label>Keyframe time (seconds)<input name="key-time" type="number" min="0" max="${s.seconds}" step=".05" value="${Number((cameraKey.time*s.seconds).toFixed(3))}"></label><label>Move to next view<select name="key-easing">${CAMERA_EASINGS.map(e=>option(e,({smooth:'Smooth move',linear:'Linear move',hold:'Hold, then cut'})[e],cameraKey.easing)).join('')}</select></label></div><label>Camera route<select name="key-path">${option('linear','Direct line',cameraKey.path||'linear')}${option('orbit','Orbit around subject',cameraKey.path||'linear')}</select></label><label>Field of view (degrees)<input name="key-fov" type="number" min="15" max="80" step="1" value="${cameraKey.view.fov}"></label><div class="director-actions lens-presets">${[[24,'Detail · 24°'],[35,'Balanced · 35°'],[50,'Wide · 50°']].map(([fov,label])=>`<button data-action="lens-${fov}" aria-pressed="${cameraKey.view.fov===fov}">${label}</button>`).join('')}</div><p class="director-hint">Lens buttons update this keyframe. After orbiting or framing the preview, use Update selected view to keep that composition.</p>`:''}

      </div><div data-inspector-page="groove">${deskEditor.panel()}</div>`;
    showInspector(inspector,false,false);deskEditor.sync();syncTransport();
    if(focusSelection){const target=inspector==='groove'?panel.querySelector('.movement-inspector'):panel.querySelector('[name="key-label"]')?.closest('label');if(target)panel.scrollTop=Math.max(0,target.offsetTop-panel.clientHeight*.25);focusSelection=false;}
    else {panel.scrollTop=scroll;const replacement=activeName?field(activeName):null;if(replacement){replacement.focus({preventScroll:true});if(selection&&replacement.setSelectionRange)try{replacement.setSelectionRange(...selection);}catch{}}}
  }
  function renderTimeline(){
    const scroll=timeline.querySelector('.timeline-viewport')?.scrollLeft||0,s=shot();
    const ticks=timelineTicks(s.seconds,Math.max(300,(timeline.clientWidth-150)*zoom));
    timeline.innerHTML=`<div class="timeline-resize" role="separator" aria-label="Resize timeline" aria-orientation="horizontal" tabindex="0"><span></span></div>
      <div class="timeline-toolbar"><div class="timeline-project"><strong>${escape(project.name)}</strong><span>${project.shots.length} chapters · ${Math.round(duration(project.shots))}s</span></div>${filmPicker()}
      <div class="timeline-transport"><button data-action="undo" aria-label="Undo edit" title="Undo (Ctrl/Cmd+Z)">↶</button><button data-action="redo" aria-label="Redo edit" title="Redo (Ctrl+Y or Ctrl/Cmd+Shift+Z)">↷</button><button data-action="edit-prev" aria-label="Previous edit" title="Previous camera view or movement edge">|‹</button><button data-action="preview-loop" aria-pressed="${!!bridge.playback().loop}" title="Repeat the chapter or selected camera / Groove preview">${bridge.playback().loop?'Loop on':'Loop off'}</button><button data-action="preview" aria-label="Restart chapter" title="Restart chapter">↻</button><button data-action="chapter-toggle" class="chapter-transport">▶ Play chapter</button><button data-action="edit-next" aria-label="Next edit" title="Next camera view or movement edge">›|</button>
      <label class="timeline-timecode"><input name="timeline-seconds" aria-label="Chapter playhead seconds" type="number" min="0" max="${s.seconds}" step=".033333" value="${(playhead*s.seconds).toFixed(2)}"><span>/ ${s.seconds}s</span></label></div>
      <div class="timeline-project-actions"><button data-action="inspector" aria-label="Toggle inspector">Inspector</button><button data-action="titles" aria-label="Toggle preview titles" aria-pressed="${document.body.classList.contains('preview-titles')}">Titles</button><button data-action="chapters" aria-label="Toggle chapter strip" aria-pressed="${!timeline.classList.contains('chapters-hidden')}">Chapters</button><button data-action="bake">Bake chapter</button><button data-action="add">+ Chapter</button><button data-action="duplicate">Duplicate chapter</button><button data-action="remove" ${project.shots.length===1?'disabled':''}>Remove chapter</button></div></div>
      <div class="chapter-cards">${project.shots.map((s,i)=>`<div class="chapter-card ${i===selected?'selected':''}" draggable="true" data-index="${i}"><button data-action="select" data-index="${i}" aria-current="${i===selected}" aria-label="Edit chapter ${i+1}: ${escape(s.title)}"><span>${String(i+1).padStart(2,'0')} · ${s.seconds}s</span><strong>${escape(s.title)}</strong><small>${escape(catalog.find(r=>r.id===s.room)?.name||s.room)} · ${escape((catalog.find(r=>r.id===s.room)?.layouts.find(l=>l.id===s.layout)?.modes||catalog.find(r=>r.id===s.room)?.modes||[]).find(m=>m.id===s.mode)?.label||'Studio')}</small></button><div><button data-action="up" data-index="${i}" aria-label="Move chapter ${i+1} earlier" ${i===0?'disabled':''}>←</button><button data-action="down" data-index="${i}" aria-label="Move chapter ${i+1} later" ${i===project.shots.length-1?'disabled':''}>→</button></div></div>`).join('')}</div>
      <div class="workbench-toolbar"><strong title="${escape(s.title)}"><span>CHAPTER ${String(selected+1).padStart(2,'0')}</span> ${escape(s.title)}</strong><span class="workbench-count">${keys().length} views · ${deskEditor.count()} moves</span>
      <div class="track-palette"><button data-action="key-add">+ Camera view</button>${deskEditor.tools()}</div>
      <label class="snap-control">Snap <select name="timeline-snap" aria-label="Timeline snapping">${[[0,'Off'],[.1,'0.1s'],[.5,'0.5s'],[1,'1s']].map(([v,label])=>option(v,label,snapStep)).join('')}</select></label>
      <div class="timeline-zoom"><button data-action="zoom-out" aria-label="Zoom timeline out" ${zoom===1?'disabled':''}>−</button><button data-action="zoom-fit" aria-label="Fit chapter to timeline" title="Fit the whole chapter">${zoom===1?'Fit':'Fit · '+zoom+'×'}</button><button data-action="zoom-in" aria-label="Zoom timeline in" ${zoom===8?'disabled':''}>+</button></div></div>
      <div class="timeline-viewport" tabindex="0" aria-label="Camera and desk timeline"><div class="timeline-content" style="width:${zoom*100}%;--timeline-grid:${(ticks[1]||s.seconds)/s.seconds*100}%">
      <div class="time-ruler-row"><span class="track-heading">SECONDS</span><div class="time-ruler" role="slider" aria-label="Chapter timeline scrubber" aria-valuemin="0" aria-valuemax="${s.seconds}" aria-valuenow="${(playhead*s.seconds).toFixed(2)}" tabindex="0">${ticks.map(t=>`<span style="left:${t/s.seconds*100}%">${Number(t.toFixed(2))}</span>`).join('')}<div class="ruler-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div></div>
      <div class="camera-lane-row"><span class="track-heading"><b>◆ Camera</b><small>${s.camera?'Custom views':'Original views'}</small></span><div class="camera-track" role="group" aria-label="Camera keyframe timeline"><div class="camera-track-line"></div>${keys().slice(0,-1).map((k,i)=>`<span class="camera-segment" style="left:${k.time*100}%;width:${(keys()[i+1].time-k.time)*100}%"><i>${({smooth:'Smooth move',linear:'Linear move',hold:'Hold / cut'})[k.easing]}</i></span>`).join('')}<div class="camera-track-playhead" data-track-playhead style="left:${playhead*100}%"></div>${keys().map(k=>`<button class="camera-key ${keyId===k.id?'selected':''} ${shot().camera?'':'automatic'}" style="left:${k.time*100}%" data-key="${k.id}" aria-label="Camera keyframe: ${escape(k.label)} at ${(k.time*shot().seconds).toFixed(2)} seconds" aria-pressed="${keyId===k.id}" title="${escape(k.label)} · ${(k.time*shot().seconds).toFixed(2)}s"><span>◆</span><small>${(k.time*shot().seconds).toFixed(1)}s</small></button>`).join('')}<span class="camera-track-zero">0s</span><span class="camera-track-end">${shot().seconds}s</span></div></div>
      ${deskEditor.timeline()}</div></div>
      <label class="timeline-pan" ${zoom===1?'hidden':''}><span>Pan view</span><input name="timeline-pan" type="range" min="0" max="100" step=".1" value="0" aria-label="Timeline horizontal position"></label>
      <div class="timeline-footer"><span data-bake-summary class="timeline-bake-summary" role="status"></span><span data-timeline-status role="status">Click ruler to scrub · Drag empty lanes to select several · Shift/Ctrl-click adds · Ctrl+A all · Alt: bypass snap · Space: play</span><output data-track-time>${(playhead*s.seconds).toFixed(2)}s / ${s.seconds}s</output></div>`;
    timeline.querySelector('.timeline-viewport').scrollLeft=scroll;
    syncTransport();syncPlayhead();syncPan();syncPicks();
  }
  async function load(){
    const token=++loadToken,position=playhead;status('Loading this chapter…');
    try{await bridge.editShot(project,selected);if(token===loadToken){automaticCameras.set(shot().id,bridge.stage().cameraKeys());deskEditor.ready();playhead=position;if(!keys().some(k=>k.id===keyId))keyId=null;renderPanel();renderTimeline();bridge.seek(playhead);status('Camera is live. Existing desk movements appear below; select a block to edit it, or add Lift, Tilt or Wheels.');}}catch(error){if(token===loadToken)status(error.message,true);}
  }
  function move(from,to){if(to<0||to>=project.shots.length)return;commit(()=>{const [s]=project.shots.splice(from,1);project.shots.splice(to,0,s);selected=to;},{render:true});load();}
  function exportCut(){const url=URL.createObjectURL(new Blob([JSON.stringify(cleanCut(project,catalog),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(project.name.replace(/[^a-z0-9]+/gi,'-')||'client-cut')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);exported=signature();syncFilm();status('Cut exported. Import it in Director Mode on another browser.');}
  async function action(name,index){
    try{
      if(composing)return;
      group=null;
      if(name==='film-prev'||name==='film-next'){const i=filmIndex();switchFilm(name==='film-prev'?i-1:i<0?0:i+1);return;}
      if(name==='inspector'){document.body.classList.toggle('inspector-hidden');return;}
      if(name==='titles'){document.body.classList.toggle('preview-titles');timeline.querySelector('[data-action=titles]')?.setAttribute('aria-pressed',String(document.body.classList.contains('preview-titles')));return;}
      if(name==='chapters'){timeline.classList.toggle('chapters-hidden');timeline.querySelector('[data-action=chapters]')?.setAttribute('aria-pressed',String(!timeline.classList.contains('chapters-hidden')));return;}
      if(name.startsWith('zoom-')){
        const i=TIMELINE_ZOOMS.indexOf(zoom);zoom=name==='zoom-fit'?1:TIMELINE_ZOOMS[Math.max(0,Math.min(TIMELINE_ZOOMS.length-1,i+(name==='zoom-in'?1:-1)))];renderTimeline();
        const viewport=timeline.querySelector('.timeline-viewport');viewport.scrollLeft=zoom===1?0:Math.max(0,playhead*(viewport.scrollWidth-130)-(viewport.clientWidth-130)/2);return;
      }
      if(name==='edit-prev'||name==='edit-next'){seekCamera(adjacentEdit(editTimes(),playhead*shot().seconds,name==='edit-prev'?-1:1,shot().seconds)/shot().seconds);return;}
      if(name==='close'){setOpen(false);return;}
      if(name.startsWith('pace-')){
        requireReady();
        const s=shot(),hold=name==='pace-hold',seconds=Math.round((hold?s.seconds+2:s.seconds*(name==='pace-faster'?.8:1.25))*1000)/1000;
        const motion=s.motion?legacyMotionToClips(s.motion,s.seconds):sampledMotionToClips(bridge.stage().motionDefaults(),s.seconds);
        const next=paceChapter(s,motion,keys(),seconds,hold);
        commit(()=>{project.shots[selected]=next;},{render:true});
        await load();status(hold?'Added a 2-second ending hold. Existing movement timing is preserved.':'Chapter retimed to '+seconds+' seconds. Camera and movements stay synchronized.');return;
      }
      if(name==='template-short'||name==='template-long'){const short=name==='template-short';loadProject(makeCut(short?'30-second reel':'85-second story',score(short?'social':'full')));status('Opened a separate '+(short?'30-second':'85-second')+' editable cut. Your previous work is kept under Saved client cuts.');return;}
      if(name==='cinematic-pass'){
        requireReady();draft();const previous=copy(project),next=copy(project);next.id=crypto.randomUUID();next.name=(project.name+' · cinematic').slice(0,100);next.updated='';
        composing=true;syncTransport();
        try{
          for(let i=0;i<next.shots.length;i++){
            status('Directing chapter '+(i+1)+' / '+next.shots.length+' · '+next.shots[i].title);
            await bridge.editShot(next,i);
            const s=next.shots[i],motion=s.motion?legacyMotionToClips(s.motion,s.seconds):sampledMotionToClips(bridge.stage().motionDefaults(),s.seconds);
            if(i===0&&s.kind==='glide'){
              // Preserve the opening performance and earlier camera compositions.
              s.motion=motion;
              next.shots[i]=openingSwoop(s,bridge.stage().cameraKeys(),bridge.stage().cinematicSubject());
            }else{
              next.shots[i]=polishMovement(s,motion);
              await bridge.editShot(next,i);
              next.shots[i].camera={keys:bridge.stage().showcaseCameraKeys(cinematicViews(next.shots[i]))};
            }
          }
          const saved=library.save(cleanCut(next,catalog));loadProject(saved,false);
        }catch(error){await bridge.editShot(previous,selected);throw error;}
        finally{composing=false;syncTransport();}
        return;
      }
      if(name==='template-showcase'){
        requireReady();draft();
        const previous=copy(project),next=cleanCut(makeCut('Director’s showcase',showcaseShots()),catalog);
        const button=panel.querySelector('[data-action=template-showcase]');button.disabled=true;
        try{
          for(let i=0;i<next.shots.length;i++){
            status('Composing chapter '+(i+1)+' / '+next.shots.length+' · '+next.shots[i].title);
            await bridge.editShot(next,i);
            if(!next.shots[i].motion&&['group','storage'].includes(next.shots[i].kind)){
              const s=next.shots[i],motion=sampledMotionToClips(bridge.stage().motionDefaults(),s.seconds);
              // Keep the genuine room route, with time to read its start and finish.
              motion.clips=motion.clips.map(c=>({...c,start:2+c.start*(s.seconds-5)/s.seconds,duration:c.duration*(s.seconds-5)/s.seconds}));
              s.motion=motion;bridge.stage().motionTrack(motion,s.id);
            }
            next.shots[i].camera={keys:i===0?bridge.stage().openingCameraKeys():bridge.stage().showcaseCameraKeys(showcaseViews(next.shots[i].kind))};
          }
          library.save(next);loadProject(next,false);
          status('Director’s showcase is ready: 12 individually paced chapters. Your previous cut is in Saved client cuts.');
        }catch(error){await bridge.editShot(previous,selected);button.disabled=false;throw error;}
        return;
      }
      if(name==='new'){loadProject(makeCut('New client cut',[sceneShot(catalog.find(r=>r.id==='product'))]));return;}
      if(name==='clone'){loadProject({...copy(project),id:crypto.randomUUID(),name:project.name+' · copy',updated:''});return;}
      if(name==='save-export'){clearTimeout(draftTimer);try{project=library.save(project);}catch{}exportCut();renderPanel();return;}
      if(name==='save'){clearTimeout(draftTimer);project=library.save(project);renderPanel();status('Saved in this browser. Export a copy for a portable backup.');return;}
      if(name==='load'){await load();return;}
      if(name==='frame-desk'||name==='frame-room'){requireReady();bridge.stage().frameSubject(name==='frame-room'?'room':'desk');status('Preview framed. Capture a new camera view or update the selected view to save it.');return;}
      if(name==='key-go'){const k=selectedKey();if(k)seekCamera(k.time);return;}
      if(name==='key-preview'){
        const list=keys(),i=list.findIndex(k=>k.id===keyId);if(i<0)return;
        const next=list[i+1];if(!next){seekCamera(list[i].time);status('This is the last view. Select an earlier camera view to preview its move.');return;}
        await bridge.previewRange(project,selected,{start:list[i].time*shot().seconds,end:next.time*shot().seconds,id:'camera-'+keyId,label:'Camera move'});return;
      }
      if(name.startsWith('lens-')){const k=selectedKey();if(!k)return;commit(()=>{ensureKeys().find(v=>v.id===keyId).view.fov=Number(name.slice(5));},{render:true});seekCamera(k.time);return;}
      if(name==='rebuild-opening'){
        requireReady();if(selected!==0)return;
        const previous=copy(project),opening=makeOpeningShot(shot());
        status('Building a new opening: wheels, rise, tilt and hero reveal…');
        try{
          await bridge.editShot({...project,shots:[opening,...project.shots.slice(1)]},0);
          opening.camera={keys:bridge.stage().openingCameraKeys()};
          library.save({...previous,id:crypto.randomUUID(),name:previous.name+' · before Chapter 1 rebuild'});
          keyId=null;playhead=0;
          commit(()=>{project.shots[0]=cleanShot(opening,catalog);},{render:true});
          await load();
          status('Opening rebuilt: 6 camera views and 8 Groove clips. Play chapter to preview; Ctrl+Z restores your previous version.');
        }catch(error){await bridge.editShot(previous,0);throw error;}
        return;
      }
      if(name==='camera-holds'){
        requireReady();if(keys().some(k=>k.label.startsWith('Settle · ')))throw Error('This opening already has settling holds. Edit the camera keys to adjust them.');
        const motion=shot().motion?legacyMotionToClips(shot().motion,shot().seconds):sampledMotionToClips(bridge.stage().motionDefaults(),shot().seconds);
        const next=addCameraHolds(shot(),keys(),motion,4),cut=copy(project);draft();
        cut.id=crypto.randomUUID();cut.name=(project.name+' · settled').slice(0,100);cut.shots[selected]=next;
        library.save(cleanCut(cut,catalog));loadProject(cut,false);return;
      }
      if(name==='bake-export-all'){status('Packaging the baked chapters…');await bridge.downloadAllBakes(project);status('Downloaded all baked chapters and the cut manifest.');return;}
      if(name==='bake-all'){
        if(bridge.bakeState().batch){bridge.cancelBake();return;}
        deskEditor.stop();draft();
        let complete;try{complete=await bridge.bakeAll(project);}catch(error){await load();throw error;}
        if(complete){setOpen(false);bridge.play(project);}else{await load();status('Bake stopped. Finished chapters are kept; Bake full intro resumes the remaining work.');}
        return;
      }
      if(name==='bake'){if(bridge.bakeState().batch){bridge.cancelBake();return;}await bridge.bake(project,selected);syncTransport();return;}
      if(name==='bake-download'){await bridge.downloadBake();status('Downloaded baked 3D footage as WebM. Captions and audio remain in the presentation.');return;}
      if(name==='preview-loop'){bridge.setPreviewLoop(!bridge.playback().loop);status(bridge.playback().loop?'Loop preview on. Play a chapter, camera move or Groove clip to repeat it.':'Loop preview off. Playback stops at the end of the current preview.');return;}
      if(name==='chapter-toggle'){await bridge.toggleChapter(project,selected);const state=bridge.playback();status(state.playing?'Playing this chapter only. Pause to inspect or edit.':'Chapter paused. Play resumes from this position.');syncTransport();return;}
      if(name==='preview'){status('Restarting this chapter…');await bridge.preview(project,selected);return;}
      if(name==='play'){draft();setOpen(false);bridge.play(project);return;}
      if(name==='scenes'){renderPicker();picker.showModal();return;}
      if(name==='export'){exportCut();return;}
      if(name==='import'){file.click();return;}
      if(name==='link'){const url=new URL('./',location.href);url.search='';url.hash='cut='+encodeCut(project);await navigator.clipboard.writeText(url.href);status('Presentation link copied. It includes this cut’s settings.');return;}
      if(name==='delete-cut'){clearTimeout(draftTimer);library.remove(project.id);loadProject(makeCut('New client cut'),false);return;}
      if(name==='undo'||name==='redo'){
        const source=name==='undo'?undo:redo,target=name==='undo'?redo:undo;if(!source.length)return;target.push(copy(project));project=source.pop();selected=Math.min(selected,project.shots.length-1);changed();render();await load();return;
      }
      if(name==='select'){clearPicks();selected=index;keyId=null;playhead=0;inspector='chapter';render();await load();return;}
      if(name==='up'||name==='down'){move(index,index+(name==='up'?-1:1));return;}
      if(name==='add'||name==='duplicate'){if(project.shots.length>=80)throw Error('A cut can contain up to 80 chapters.');const s={...copy(shot()),id:crypto.randomUUID()};if(name==='add'){s.title='New chapter';s.motion={version:2,initial:{height:30,tilt:0,x:0,z:0,yaw:0},clips:[]};}keyId=null;playhead=0;inspector='chapter';commit(()=>project.shots.splice(++selected,0,s),{render:true});await load();return;}
      if(name==='remove'){if(project.shots.length<=1)return;commit(()=>{project.shots.splice(selected,1);selected=Math.min(selected,project.shots.length-1);},{render:true});await load();return;}
      if(name.startsWith('camera-')){
        requireReady();
        if(name==='camera-clear'){commit(()=>delete shot().camera,{render:true});keyId=null;await load();return;}
        captureKey(name==='camera-from'?0:1,name==='camera-from'?'Start view':'End view');return;
      }
      if(name==='key-add'){captureKey(playhead);return;}
      if(name==='key-update'){
        requireReady();if(!selectedKey())return;const view=bridge.stage().captureCamera();
        commit(()=>{ensureKeys().find(k=>k.id===keyId).view=view;},{render:true});status('Selected camera view updated.');return;
      }
      if(name==='key-delete'){
        requireReady();if(!selectedKey())return;
        commit(()=>{const list=ensureKeys().filter(k=>k.id!==keyId);if(list.length)shot().camera={keys:list};else delete shot().camera;keyId=null;},{render:true});
        if(!shot().camera)await load();else seekCamera(playhead);return;
      }
      if(name==='key-duplicate'){
        requireReady();const list=keys(),i=list.findIndex(k=>k.id===keyId);if(i<0)return;if(list.length>=64)throw Error('A chapter can hold up to 64 camera keyframes.');
        const source=list[i],time=i<list.length-1?(source.time+list[i+1].time)/2:source.time<1?(source.time+1)/2:i>0?(list[i-1].time+source.time)/2:source.time/2;
        if(list.some(k=>Math.abs(k.time-time)<.001))throw Error('Move an existing keyframe to make room for a duplicate.');
        commit(()=>{const key={...copy(source),id:crypto.randomUUID(),time,label:source.label+' copy'};ensureKeys().push(key);shot().camera.keys.sort((a,b)=>a.time-b.time);keyId=key.id;},{render:true});seekCamera(time);return;
      }

    }catch(error){status(error.message,true);}
  }
  for(const el of [panel,timeline])el.addEventListener('click',event=>{const b=event.target.closest('button[data-action]');if(b)action(b.dataset.action,Number(b.dataset.index));});
  panel.addEventListener('click',event=>{const tab=event.target.closest('[data-inspector-tab]');if(tab)showInspector(tab.dataset.inspectorTab);});
  timeline.addEventListener('change',event=>{
    if(event.target.name==='timeline-snap'){snapStep=Number(event.target.value);return;}
    if(event.target.name==='film-chapter'){switchFilm(Number(event.target.value));return;}
    if(event.target.name==='timeline-seconds'){try{if(event.target.value!=='')seekCamera(Number(event.target.value)/shot().seconds);}catch(error){status(error.message,true);}}
  });
  timeline.addEventListener('input',event=>{
    if(event.target.name==='timeline-pan'){const viewport=timeline.querySelector('.timeline-viewport');viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)*Number(event.target.value)/100;return;}
    if(event.target.name==='timeline-seconds'&&event.target.value!=='')try{seekCamera(Number(event.target.value)/shot().seconds);}catch(error){status(error.message,true);}
  });
  timeline.addEventListener('scroll',event=>{if(event.target.classList?.contains('timeline-viewport'))syncPan();},true);
  panel.addEventListener('input',event=>{
    const el=event.target,name=el.name;if(!name)return;
    if(name==='seek'){try{seekCamera(Number(el.value)/100);}catch(error){status(error.message,true);}return;}
    if(['key-time','key-fov'].includes(name)&&selectedKey()){
      if(el.value===''||!Number.isFinite(Number(el.value)))return;
      try{requireReady();
        if(name==='key-time'){const list=moveCameraKey(keys(),keyId,Number(el.value)/shot().seconds);commit(()=>{shot().camera={keys:copy(list)};},{key:name});}
        else commit(()=>{ensureKeys().find(k=>k.id===keyId).view.fov=Math.max(15,Math.min(80,Number(el.value)));},{key:name});
        seekCamera(selectedKey().time);
      }catch(error){status(error.message,true);}return;
    }
    if(name==='key-label'&&selectedKey()){commit(()=>{ensureKeys().find(k=>k.id===keyId).label=el.value;},{key:name});return;}
    if(name==='seconds'){try{if(el.value===''||Number(el.value)<2||Number(el.value)>90)return;if(shot().motion?.clips)validateClipSchedule(shot().motion.clips,Number(el.value));}catch(error){el.value=shot().seconds;status(error.message,true);return;}}
    if(['name','client','volume','title','detail','seconds','transition'].includes(name)){
      commit(()=>{const target=['name','client','volume'].includes(name)?project:shot();target[name]=['volume','seconds','transition'].includes(name)?Number(el.value):el.value;},{key:name});return;
    }

  });
  panel.addEventListener('change',async event=>{
    const name=event.target.name,value=event.target.value;group=null;
    if(name==='film-chapter'){switchFilm(Number(value));return;}
    if(name==='baked-playback'){bridge.useBaked(event.target.checked);syncTransport();return;}
    if(name==='camera-key'){try{selectKey(value);}catch(error){status(error.message,true);}return;}
    if(['key-time','key-easing','key-path','key-fov'].includes(name)&&selectedKey()){
      try{requireReady();
        if(name==='key-time'){
          if(Math.abs(selectedKey().time-Math.max(0,Math.min(1,Number(value)/shot().seconds)))<1e-10){renderPanel();return;}
          const list=moveCameraKey(keys(),keyId,Number(value)/shot().seconds);
          commit(()=>{shot().camera={keys:copy(list)};},{render:true});
        }else if(name==='key-fov'&&selectedKey().view.fov===Math.max(15,Math.min(80,Number(value)||35))){renderPanel();return;}
        else commit(()=>{const k=ensureKeys().find(k=>k.id===keyId);if(name==='key-easing')k.easing=value;else if(name==='key-path'){if(value==='orbit')k.path='orbit';else delete k.path;}else k.view.fov=Math.max(15,Math.min(80,Number(value)||35));},{render:true});
        seekCamera(selectedKey().time);
      }catch(error){renderPanel();status(error.message,true);}return;
    }

    if(['seconds','transition','volume'].includes(name)){project=cleanCut(project,catalog);changed();renderPanel();return;}
    if(name==='saved'){const saved=library.get(value);if(saved)loadProject(saved);return;}
    if(['room','layout','mode','kind','preset','size'].includes(name)){
      commit(()=>{const s=shot();s[name]=value;if(name==='room'){delete s.layout;delete s.mode;delete s.camera;s.preset=defaultPreset(value,s.kind);}if(name==='layout'){delete s.mode;delete s.camera;}project.shots[selected]=cleanShot(s,catalog);},{render:true});await load();
    }
  });
  timeline.addEventListener('dragstart',event=>{if(event.target.closest('.camera-key, .desk-key')){event.preventDefault();return;}const card=event.target.closest('[data-index]');if(card){event.dataTransfer.setData('text/plain',card.dataset.index);event.dataTransfer.effectAllowed='move';}});
  timeline.addEventListener('dragover',event=>{if(event.target.closest('.chapter-card'))event.preventDefault();});
  timeline.addEventListener('drop',event=>{const card=event.target.closest('.chapter-card');if(!card)return;event.preventDefault();const from=Number(event.dataTransfer.getData('text/plain'));if(Number.isInteger(from)&&from>=0&&from<project.shots.length)move(from,Number(card.dataset.index));});
  timeline.addEventListener('click',event=>{
    if(performance.now()<suppressKeyClickUntil)return;
    const marker=event.target.closest('[data-key]');
    try{if(marker){selectKey(marker.dataset.key);return;}const rail=event.target.closest('.camera-track');if(rail){const box=rail.getBoundingClientRect();seekCamera((event.clientX-box.left)/box.width);}}catch(error){status(error.message,true);}
  });
  timeline.addEventListener('pointerdown',event=>{
    const marker=event.target.closest('[data-key]');if(!marker||event.button!==0)return;
    try{requireReady();const rail=marker.closest('.camera-track');keyDrag={id:marker.dataset.key,rail,marker,start:event.clientX,original:keys().find(k=>k.id===marker.dataset.key).time,time:0,moved:false};rail.setPointerCapture(event.pointerId);event.preventDefault();}catch(error){status(error.message,true);}
  });
  timeline.addEventListener('pointermove',event=>{
    if(!keyDrag)return;const d=keyDrag,box=d.rail.getBoundingClientRect();if(Math.abs(event.clientX-d.start)>3)d.moved=true;
    if(d.moved){d.time=snapTime((d.original+(event.clientX-d.start)/box.width)*shot().seconds,{pixels:box.width,bypass:event.altKey,excludeKey:d.id})/shot().seconds;d.marker.style.left=(d.time*100)+'%';d.marker.querySelector('small').textContent=(d.time*shot().seconds).toFixed(2)+'s';}
  });
  timeline.addEventListener('pointerup',event=>{
    if(!keyDrag)return;const d=keyDrag;keyDrag=null;suppressKeyClickUntil=performance.now()+250;
    try{if(d.moved){deskEditor.clearSelection();showInspector('camera',true);const list=moveCameraKey(keys(),d.id,d.time);commit(()=>{shot().camera={keys:copy(list)};keyId=d.id;},{render:true});seekCamera(d.time);status('Camera keyframe moved.');}else selectKey(d.id);}catch(error){renderTimeline();status(error.message,true);}
  });
  timeline.addEventListener('pointercancel',()=>{keyDrag=null;renderTimeline();});
  function resizeTimeline(height){document.body.style.setProperty('--director-timeline-height',Math.max(300,Math.min(innerHeight*.65,650,height))+'px');}
  function scrubRuler(event){
    const box=scrub.getBoundingClientRect();seekCamera(snapTime((event.clientX-box.left)/box.width*shot().seconds,{pixels:box.width,bypass:event.altKey,excludePlayhead:true})/shot().seconds);
  }
  timeline.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const handle=event.target.closest('.timeline-resize'),ruler=event.target.closest('.time-ruler');
    if(handle){timelineResize={y:event.clientY,height:timeline.getBoundingClientRect().height};handle.setPointerCapture(event.pointerId);event.preventDefault();return;}
    if(ruler)try{requireReady();scrub=ruler;ruler.setPointerCapture(event.pointerId);event.preventDefault();scrubRuler(event);}catch(error){scrub=null;status(error.message,true);}
  });
  timeline.addEventListener('pointermove',event=>{
    if(timelineResize){resizeTimeline(timelineResize.height+timelineResize.y-event.clientY);return;}
    if(scrub)try{scrubRuler(event);}catch(error){scrub=null;status(error.message,true);}
  });
  timeline.addEventListener('pointerup',()=>{scrub=null;if(timelineResize){timelineResize=null;renderTimeline();}});
  timeline.addEventListener('pointercancel',()=>{scrub=null;timelineResize=null;});
  timeline.addEventListener('keydown',event=>{
    if(event.target.matches('input,select,textarea')){if(event.target.name==='timeline-seconds'&&event.key==='Enter'){event.preventDefault();event.target.blur();}return;}
    if(event.target.closest('.timeline-resize')&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();resizeTimeline(timeline.getBoundingClientRect().height+(event.key==='ArrowUp'?20:-20));return;}
    if(event.defaultPrevented)return;
    if(event.code==='Space'){event.preventDefault();action('chapter-toggle');return;}
    if(['+','=','-'].includes(event.key)){event.preventDefault();action(event.key==='-'?'zoom-out':'zoom-in');return;}
    if(event.target.closest('[data-key],[data-desk-clip]'))return;
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();try{const seconds=shot().seconds,t=event.key==='Home'?0:event.key==='End'?seconds:playhead*seconds+(event.shiftKey?1:1/30)*(event.key==='ArrowLeft'?-1:1);seekCamera(t/seconds);}catch(error){status(error.message,true);}
    }
  });
  timeline.addEventListener('keydown',event=>{
    const marker=event.target.closest('[data-key]');if(!marker||!['ArrowLeft','ArrowRight','Delete','Backspace'].includes(event.key))return;event.preventDefault();
    try{requireReady();keyId=marker.dataset.key;if(['Delete','Backspace'].includes(event.key)){action('key-delete');return;}
      const key=selectedKey(),delta=(event.shiftKey?1:.1)/shot().seconds*(event.key==='ArrowLeft'?-1:1),list=moveCameraKey(keys(),keyId,key.time+delta);
      commit(()=>{shot().camera={keys:copy(list)};},{render:true});seekCamera(selectedKey().time);timeline.querySelector(`[data-key="${keyId}"]`)?.focus();
    }catch(error){status(error.message,true);}
  });
  file.addEventListener('change',async()=>{try{const picked=file.files[0];if(!picked)return;if(picked.size>5000000)throw Error('Choose a cut JSON file smaller than 5 MB.');const imported=cleanCut(JSON.parse(await picked.text()),catalog);loadProject({...imported,id:crypto.randomUUID(),updated:''});status('Imported as a separate cut.');}catch(error){status(error.message,true);}finally{file.value='';}});
  function renderPicker(){
    const search=picker.querySelector('[name="search"]')?.value||'';
    const cutName=picker.querySelector('[name="generate-name"]')?.value||(project.client?project.client+' presentation':'New client presentation');
    const seconds=picker.querySelector('[name="generate-seconds"]')?.value||8,bookends=picker.querySelector('[name="bookends"]')?.checked??true;
    picker.innerHTML=`<div class="director-heading"><div><span class="director-kicker">CLIENT CUT GENERATOR</span><h2>Which spaces tell their story?</h2></div><button data-picker="close" aria-label="Close scene picker">✕</button></div>
      <p>Choose environments, room sizes, and the activities you want to show. You can refine every chapter afterwards.</p>
      <div class="director-actions">${['Education','Libraries','Workplace','Home & wellness','Creative','Gaming','All','Clear'].map(label=>`<button data-picker="group" data-group="${label}">${label}</button>`).join('')}</div>
      <label>Find an environment<input name="search" type="search" placeholder="Library, media, healthcare…" value="${escape(search)}"></label>
      <div class="scene-picker-grid">${catalog.map(room=>{
        const choice=choices.get(room.id),layout=room.layouts.find(l=>l.id===choice?.layout)||room.layouts[0],modes=layout?.modes||room.modes||[];
        return `<div class="scene-choice" data-room="${room.id}" data-search="${escape((room.name+' '+room.id).toLowerCase())}"><label class="director-check"><input type="checkbox" data-choose="room" value="${room.id}" ${choice?'checked':''}>${escape(room.name)}</label>${choice?`<div class="choice-details">${room.layouts.length?`<label>Layout<select data-choose="layout">${room.layouts.map(l=>option(l.id,l.name,choice.layout)).join('')}</select></label>`:''}<div class="activity-choices">${modes.map(m=>`<label class="director-check"><input type="checkbox" data-choose="mode" value="${m.id}" ${choice.modes.has(m.id)?'checked':''}>${escape(m.label)}</label>`).join('')}</div></div>`:''}</div>`;
      }).join('')}</div>
      <div class="generator-settings"><label>New cut name<input name="generate-name" maxlength="100" value="${escape(cutName)}"></label><label>Seconds per chapter<input name="generate-seconds" type="number" min="2" max="90" value="${escape(seconds)}"></label><label class="director-check"><input name="bookends" type="checkbox" ${bookends?'checked':''}>Include opening and finale</label><button data-picker="generate" class="primary">Generate client cut</button><span data-picker-status role="status"></span></div>`;
    filterRooms(search);
  }
  function filterRooms(text){for(const row of picker.querySelectorAll('[data-search]'))row.hidden=!row.dataset.search.includes(text.toLowerCase());}
  function choose(room,layout){const l=room.layouts.find(l=>l.id===layout)||room.layouts.find(l=>l.id==='house')||room.layouts[0];choices.set(room.id,{layout:l?.id,modes:new Set([(l?.modes||room.modes||[])[0]?.id].filter(Boolean))});}
  picker.addEventListener('input',event=>{if(event.target.name==='search')filterRooms(event.target.value);});
  picker.addEventListener('change',event=>{
    const el=event.target,room=catalog.find(r=>r.id===el.closest('[data-room]')?.dataset.room);if(!room)return;
    if(el.dataset.choose==='room'){if(el.checked)choose(room);else choices.delete(room.id);renderPicker();}
    if(el.dataset.choose==='layout'){choose(room,el.value);renderPicker();}
    if(el.dataset.choose==='mode'){const selected=choices.get(room.id);if(el.checked)selected.modes.add(el.value);else selected.modes.delete(el.value);}
  });
  picker.addEventListener('click',event=>{
    const button=event.target.closest('[data-picker]');if(!button)return;
    if(button.dataset.picker==='close'){picker.close();return;}
    if(button.dataset.picker==='group'){
      choices.clear();const group=button.dataset.group,groups={Education:['occmedialab','highschool','kindergarten','elementary','middleschool','college','university'],Libraries:['library'],Workplace:['office','coworking','government','security','police','mobileit'], 'Home & wellness':['home','bedroom','gym','kitchen','lounge'],Creative:['creative','gallery','music','workshop'],Gaming:['gaming','scifi']};
      for(const room of catalog)if(group==='All'||groups[group]?.includes(room.id))choose(room,group==='Libraries'?'humboldt':undefined);renderPicker();return;
    }
    if(button.dataset.picker==='generate'){
      try{
        const selection=[...choices].flatMap(([room,c])=>c.modes.size?[...c.modes].map(mode=>({room,layout:c.layout,mode})):[{room,layout:c.layout}]);
        const value=generateCut(catalog,selection,{name:picker.querySelector('[name="generate-name"]').value,client:project.client,seconds:Number(picker.querySelector('[name="generate-seconds"]').value),bookends:picker.querySelector('[name="bookends"]').checked});
        picker.close();loadProject(value);status('New client cut generated. Your previous cut remains in the library.');
      }catch(error){picker.querySelector('[data-picker-status]').textContent=error.message;}
    }
  });
  function setOpen(value){deskEditor.stop();if(bridge.bakeState().baking&&!value){status('Cancel the bake before closing the editor.');return;}open=value;document.body.classList.toggle('directing',open);panel.hidden=timeline.hidden=!open;bridge.editMode(open);if(open){if(matchMedia('(max-width:700px)').matches)document.body.classList.add('inspector-hidden');render();load().then(()=>{
      const url=new URL(location.href);
      if(open&&url.searchParams.get('cinematic')==='1'&&bridge.ready()){
        url.searchParams.delete('cinematic');history.replaceState(null,'',url);action('cinematic-pass');
      }else if(open&&url.searchParams.get('bakeAll')==='1'&&bridge.ready()){
        url.searchParams.delete('bakeAll');history.replaceState(null,'',url);action('bake-all');
      }
    });}else draft();}
  const deskEditor=createDeskEditor({panel,timeline,bridge,shot,time:()=>playhead,seek:seekCamera,commit,render,status,preview:range=>bridge.previewRange(project,selected,range),snap:snapTime,focus:tab=>{keyId=null;showInspector(tab,true);}});
  // Group gestures run in the capture phase so they take over from single-item drags.
  const viewport=()=>timeline.querySelector('.timeline-viewport');
  timeline.addEventListener('pointerdown',event=>{
    if(event.button!==0||composing||bridge.bakeState().baking)return;
    const item=event.target.closest('[data-key],[data-desk-clip]');
    if(item){
      const kind=item.dataset.key?'keys':'clips',id=item.dataset.key||item.dataset.deskClip;
      if(event.shiftKey||event.ctrlKey||event.metaKey){event.preventDefault();event.stopImmediatePropagation();suppressGroupClickUntil=performance.now()+400;item.focus({preventScroll:true});togglePick(kind,id);return;}
      if(!picks[kind].has(id)){clearPicks();return;}
      if(event.target.closest('[data-resize]'))return;
      event.preventDefault();event.stopImmediatePropagation();
      try{requireReady();if(!deskEditor.flush())return;}catch(error){status(error.message,true);return;}
      groupDrag={id,kind,start:event.clientX,width:item.closest('.camera-track,[data-desk-lane]').getBoundingClientRect().width,delta:0,moved:false,base:groupBase()};
      viewport().setPointerCapture(event.pointerId);item.focus({preventScroll:true});return;
    }
    if(!event.target.closest('.timeline-content')||event.target.closest('.time-ruler,button,select,input,label,.desk-track-toolbar,.track-heading,.desk-lane-label'))return;
    event.preventDefault();viewport().focus({preventScroll:true});
    marquee={x:event.clientX,y:event.clientY,add:event.shiftKey||event.ctrlKey||event.metaKey,keys:new Set(picks.keys),clips:new Set(picks.clips),box:null};
  },true);
  timeline.addEventListener('pointermove',event=>{
    if(groupDrag){
      const d=groupDrag;if(Math.abs(event.clientX-d.start)>3)d.moved=true;if(!d.moved)return;
      const [lo,hi]=groupRange(d.base,picks);d.delta=Math.max(lo,Math.min(hi,snapGroupDelta((event.clientX-d.start)/d.width*d.base.seconds,snapStep,event.altKey)));previewGroup(d);return;
    }
    if(!marquee)return;const m=marquee;
    if(!m.box){if(Math.hypot(event.clientX-m.x,event.clientY-m.y)<5)return;m.box=document.createElement('div');m.box.className='timeline-marquee';document.body.append(m.box);viewport().setPointerCapture(event.pointerId);}
    const left=Math.min(m.x,event.clientX),right=Math.max(m.x,event.clientX),top=Math.min(m.y,event.clientY),bottom=Math.max(m.y,event.clientY);
    Object.assign(m.box.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
    const hit=el=>{const r=el.getBoundingClientRect();return r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom;};
    for(const [kind,attr,data] of [['keys','[data-key]','key'],['clips','[data-desk-clip]','deskClip']]){
      picks[kind]=new Set(m.add?m[kind]:[]);for(const el of timeline.querySelectorAll(attr))if(hit(el))picks[kind].add(el.dataset[data]);
    }
    syncPicks();
  });
  function endGroupGesture(event){
    if(groupDrag){
      const d=groupDrag;groupDrag=null;suppressGroupClickUntil=performance.now()+300;
      if(event.type==='pointercancel'){renderTimeline();return;}
      if(!d.moved){clearPicks();try{if(d.kind==='keys')selectKey(d.id);else deskEditor.select(d.id);}catch(error){status(error.message,true);}return;}
      try{shiftPicks(d.delta,'Selection moved');}catch(error){renderTimeline();status(error.message,true);}
      return;
    }
    if(!marquee)return;const m=marquee;marquee=null;
    if(m.box){m.box.remove();suppressGroupClickUntil=performance.now()+300;groupStatus();}else if(!m.add)clearPicks();
  }
  for(const type of ['pointerup','pointercancel'])timeline.addEventListener(type,endGroupGesture,true);
  timeline.addEventListener('click',event=>{if(performance.now()<suppressGroupClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',event=>{
    if(!open||composing||!picked()||event.defaultPrevented||document.querySelector('dialog[open]'))return;
    const target=event.target;if(target!==document.body&&!timeline.contains(target))return;
    if(target.matches?.('input,select,textarea'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();clearPicks();groupStatus();return;}
    if(!['ArrowLeft','ArrowRight'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{if(!deskEditor.flush())return;shiftPicks((snapStep||.1)*(event.shiftKey?10:1)*(event.key==='ArrowLeft'?-1:1),'Selection nudged');target.isConnected||viewport()?.focus({preventScroll:true});}catch(error){status(error.message,true);}
  },true);
  function historyShortcut(event){
    if(!open||composing||event.defaultPrevented||event.isComposing||event.altKey||!(event.ctrlKey||event.metaKey))return;
    const key=event.key.toLowerCase(),command=key==='z'?(event.shiftKey?'redo':'undo'):key==='y'&&!event.shiftKey?'redo':key==='d'&&!event.shiftKey?'duplicate-selection':key==='a'&&!event.shiftKey?'select-all':null;
    if(!command)return;
    if(command==='select-all'){if(event.target.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])'))return;event.preventDefault();event.stopImmediatePropagation();if(!bridge.bakeState().baking)pickAll();return;}
    // Text editing keeps the browser's native undo; numeric movement settings,
    // camera controls, timeline blocks and the 3D preview share editor history.
    const target=event.target;
    if(target.closest?.('textarea,[contenteditable]:not([contenteditable="false"])')||target.tagName==='INPUT'&&['text','search','email','password','url','tel'].includes(target.type))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.repeat||bridge.bakeState().baking)return;
    if(!deskEditor.flush())return;
    if(command==='duplicate-selection'){
      if(keyId)action('key-duplicate');else if(deskEditor.hasSelection())deskEditor.duplicate();else status('Select a camera view or Groove movement to duplicate.');
      return;
    }
    action(command);
  }
  document.addEventListener('keydown',historyShortcut,true);
  const preview=document.getElementById('stage');let previewDocument;
  function bindPreviewHistory(){
    const next=preview?.contentDocument;if(!next||next===previewDocument)return;
    previewDocument?.removeEventListener('keydown',historyShortcut,true);
    previewDocument=next;previewDocument.addEventListener('keydown',historyShortcut,true);
  }
  preview?.addEventListener('load',bindPreviewHistory);bindPreviewHistory();
  addEventListener('pagehide',()=>{deskEditor.stop();draft();});
  render();panel.hidden=timeline.hidden=true;
  return {open:()=>setOpen(true),close:()=>setOpen(false),isOpen:()=>open,project:()=>copy(project),select:i=>{selected=i;render();},setStatus:status,transportChanged:syncTransport,toggleChapter:()=>{deskEditor.stop();return action('chapter-toggle');},progress:t=>{playhead=t;syncPlayhead();}};
}
