import {createTimelineHints,timelineShortcuts} from './timeline-hints.mjs';
import {resolve as resolveKey,targetKind,changedHint,effectiveActions} from './director-actions.mjs';
import {createPalette} from './command-palette.mjs';
import {appBarHtml,statusBarHtml,wireMenus} from './director-appbar.mjs';
import {setSpaceAll,spaceNow} from './gumball.mjs';
import {enhanceNumberFields} from './number-fields.mjs';
import {createContextMenu} from './context-menu.mjs';
import {CHAPTER_FIELDS,fieldChanged as filmFieldChanged,filmValue as filmFieldValue,groupChanged as filmGroupChanged} from './film-changes.mjs';
import {chapterScore,staleness,snapTimes,snapTo,waveColumns,createScorePlayer} from './score-track.mjs';
import {createActionLog,captureErrors,reportBody,createReportDialog,sendReport} from './director-report.mjs';
import {createKeysPanel,loadUi,saveUi} from './keys-panel.mjs';
import {createViewNav} from './view-nav.mjs';
import {createGraphicsEditor} from './graphics-editor.mjs';
import {addCameraHolds} from './camera-holds.mjs';
import {cinematicViews,polishMovement,openingSwoop} from './cinematography.mjs';
import {paceChapter,lengthenChapter,chapterFloor,shortenChapter} from './chapter-timing.mjs';
import {validateClipSchedule,sampledMotionToClips,legacyMotionToClips,cleanClipMotion,planClipInsertion,clipSummary,clipEnd} from './desk-clips.mjs';
import {groupRange,snapGroupDelta,shiftGroup,CHAPTER_MAX} from './timeline-group.mjs';
import {LIGHT_KINDS,WHEEL_MODES,cleanLighting,exportLighting,lightKindColor,validateStatus,neutralAt,lightAt,scaleColor,warmthOf,withWarmth,whiteName,daypartAt,DAYPART_TINTS,lightnessOf,withLightness,WHITE_PRESETS} from './film-lighting.mjs';
import {filmRenderShot,createStillRenderer} from './film-render.mjs';
import {createSceneLightEditor} from './scene-light-editor.mjs';
import {createScenePropEditor} from './scene-prop-editor.mjs';
import {createLayersPanel} from './layers-panel.mjs';
import {layersOn,studioHiddenHere,chapterRooms,chapterSetting,deskHidePlan,LAYERS_KEY} from './layers-exchange.mjs';
import {effectivePropEdits as layersPropEdits} from './prop-edits.mjs';
import {cleanPeople as layersCleanPeople,canonicalPeople} from './people-edits.mjs';
import {createScenePeopleEditor} from './scene-people-editor.mjs';
import {createBrandingEditor} from './branding-editor.mjs';
import {createFloorReflectionEditor} from './floor-reflection-editor.mjs';
import {filmPropEdits,propKey} from './prop-edits.mjs';
import {createFilmLook} from './film-look.mjs';
import {createStillStrip} from './still-strip.mjs';
import {filmLink,loadFilmChapters,filmChapterLabel,filmChapterIndex} from './film-chapters.mjs';
import {createFilmFresh} from './film-fresh.mjs';
import {timelineTicks,snapTimelineTime,adjacentEdit,TIMELINE_ZOOMS,clampZoom,maxZoom,filmTimecode,nextMarker,toggleMarker,setLoopEnd} from './timeline-ui.mjs';
import {createDeskEditor} from './desk-editor.mjs';
import {stackRows,rowVar} from './lane-rows.mjs';
import {createChoreoTarget,validateDeskEdits} from './desk-choreo.mjs';
import {effectiveDeskEdits,cleanDeskEdit} from './desk-edits.mjs';
import {createStartPose} from './start-pose.mjs';
import {createRenderRequest} from './render-request.mjs';
import {createSceneDeskEditor} from './scene-desk-editor.mjs';
import {createStudioSync} from './studio-sync.mjs';
import {createDeskVersions,deskVersions as deskVersionList} from './desk-versions.mjs';
import {createDeskBuildPanel} from './desk-build-panel.mjs';
import {createTitleEditor,loadTitleSource} from './title-editor.mjs';
import {score} from './score.mjs';
import {makeOpeningShot} from './opening.mjs';
import {showcaseShots,showcaseViews} from './showcase.mjs';
import {BAKE_PROFILE} from './bake.mjs';
import {resolveCameraKeys,moveCameraKey,CAMERA_EASINGS} from './camera-track.mjs';
import {createSelection,markSelection,centreIn,GROUP_OF} from './director-selection.mjs';
import {CutLibrary,makeCut,cleanCut,cleanShot,sceneShot,generateCut,encodeCut,KINDS,PRESET_IDS,defaultPreset} from './cuts.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(id,label,value)=>`<option value="${escape(id)}" ${id===value?'selected':''}>${escape(label)}</option>`;
const duration=shots=>shots.reduce((n,s)=>n+s.seconds,0);
const copy=value=>structuredClone(value);

export function mountDirector(bridge,catalog,initial){
  let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Browser storage is unavailable. Export this cut to keep it.');}};}
  const library=new CutLibrary(storage);
  // Film chapter links must start from their current page, not an older generic library draft.
  // Film drafts have their own freshness and recovery flow below.
  let project=initial?(filmLink(location.hash)?initial:(library.get(initial.id)||{...makeCut(initial.name,initial.shots),id:initial.id,client:initial.client,volume:initial.volume})):library.current()||makeCut();
  project=cleanCut(project,catalog);
  let selected=0,undo=[],redo=[],undoLabels=[],redoLabels=[],labelPending=null,stillMark=null,group=null,draftTimer,open=false,loadToken=0,composing=false,leaving=false;
  const choices=new Map(),automaticCameras=new Map();
  let keyId=null,playhead=0,keyDrag=null,suppressKeyClickUntil=0;
  let magnet=true,inspector='chapter',zoom=1,snapStep=.1,scrub=null,timelineResize=null;
  // Timeline group selection (camera keys + desk clips) and the film chapter list.
  const picks={keys:new Set(),clips:new Set(),lights:new Set(),neutrals:new Set(),tods:new Set()};let lightSel=null,stills=null,stillBusy=false,marquee=null,groupDrag=null,suppressGroupClickUntil=0;
  const film=filmLink(location.hash),signature=()=>JSON.stringify([project.name,project.client,project.volume,project.shots]);
  let filmChapters=null,filmCuts=null,filmError='',exported=signature();
  // A film chapter reloaded after an import: the film's newer cut, an unexported draft to keep or drop, stale-export warning.
  const fresh=createFilmFresh(film,project,{storage,catalog,escape,render:()=>renderFilm(),status:m=>status(m),load:(cut,asExported)=>{loadProject(cut,false);if(asExported)exported=signature();syncFilm();}});
  {const d=fresh.initialDraft();if(d)project=cleanCut(d,catalog);}
  const panel=document.createElement('section');panel.id='director-panel';panel.setAttribute('aria-label','Director controls');
  const timeline=document.createElement('section');timeline.id='director-timeline';timeline.setAttribute('aria-label','Chapter timeline');
  const picker=document.createElement('dialog');picker.id='scene-picker';picker.setAttribute('aria-label','Choose client environments');
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
  // P1b calm shell: the app bar (every global command once) over the view; ?shell=classic or ⋯ → Classic layout for
  // the old arrangement (director-appbar.mjs). Outside the panel's and the timeline's rebuilds.
  const appbar=document.createElement('header');appbar.id='director-appbar';appbar.hidden=true;appbar.setAttribute('aria-label','Director');
  const classic=()=>new URLSearchParams(location.search).get('shell')==='classic'||loadUi().shell==='classic',shellOn=()=>!classic();
  document.body.append(appbar,panel,timeline,picker,file);
  enhanceNumberFields(panel);   // P5: drag a label to scrub, Esc puts the value back
  const field=name=>panel.querySelector(`[name="${name}"]`);
  const shot=()=>project.shots[selected];
  const keys=()=>resolveCameraKeys(shot().camera,automaticCameras.get(shot().id)||[]);
  const selectedKey=()=>keys().find(k=>k.id===keyId);
  // B2: ONE selection across the Director (director-selection.mjs). The prop, person or room desk selected now is marked
  // `b2-selected` wherever it shows (Props lane bars, Layers rows, People lane / list / sheet row, Desks list, the desk
  // lanes' header) and, when it changes, centred on the timeline; a tab opened later centres it there too.
  const b2sel=createSelection(),SEL_HOME={prop:'props',person:'people',desk:'desks'};
  function selectionNow(){
    try{const p=sceneProps.selected();if(p)return {kind:'prop',key:p};const h=scenePeople.selected();if(h)return {kind:'person',key:h};const d=deskSel.selected();if(d)return {kind:'desk',key:d};
      // P3: every other kind, in the order a click leaves them (the editors clear each other)
      if(keyId)return {kind:'camera',key:keyId};const c=deskEditor.selectedId();if(c)return {kind:'clip',key:c};const t=titleEditor.selectedId?.();if(t)return {kind:'title',key:t};
      const g=graphics.selected?.();if(g!==null&&g!==undefined&&g!==-1)return {kind:'graphic',key:g};if(lightSel)return {kind:'lightkey',key:lightSel.id};const l=sceneLights.selected();if(l)return {kind:'light',key:l};}catch{}   // (before the editors exist: nothing)
    return null;
  }
  function syncSelection(){
    const changed=b2sel.set(selectionNow());let desk='';try{desk=choreo.desk()||'';}catch{}
    for(const el of timeline.querySelectorAll('.desk-track-toolbar,.choreo-pick'))el.dataset.deskOf=desk;
    const sel=b2sel.get();
    // the selection's lane group opens when it is folded (Vico: "the right layer pops up")
    if(changed&&sel){const g=GROUP_OF[sel.kind];if(g&&groupClosed(g)&&timeline.querySelector(`[data-lane-group="${g}"]`)){laneGroups[g]=false;saveGroups();renderTimeline();return;}}
    const hits=markSelection([panel,timeline],sel);for(const r of timeline.querySelectorAll('.lane-has-sel'))r.classList.remove('lane-has-sel');for(const el of hits)el.closest?.('.desk-lane-row,.camera-lane-row')?.classList.add('lane-has-sel');
    if(changed&&sel)requestAnimationFrame(()=>requestAnimationFrame(()=>centreSelection(timeline)));
  }
  // Centre the selection's first visible mark under root (the timeline, or a tab page in the inspector).
  function centreSelection(root){
    const el=[...root.querySelectorAll('.b2-selected')].find(e=>e.getClientRects().length&&!e.closest('[hidden]'));
    if(el)centreIn(el,root===timeline?timeline:panel);
  }
  // P5: the tabs' names in the calm shell (the ids stay: tests and links use them); Classic keeps the old ones
  // P5 Scene list: what has no lane of its own (scene lights, the room's desks), at the top of the side column; props
  // are in the Layers tab's outliner. Folded or not is kept in this browser.
  function sceneListHtml(){
    let lights=[],desks=[];try{lights=sceneLights.lanes();}catch{}try{desks=deskSel.ids().filter(id=>id!==deskSel.featuredId?.());}catch{}
    const selDesk=(()=>{try{return deskSel.selected();}catch{return null;}})();
    return `<details class="scene-list" data-scene-list ${loadUi().sceneList===false?'':'open'}><summary>Scene <small>${lights.length} light${lights.length===1?'':'s'} · ${desks.length} room desk${desks.length===1?'':'s'}</small></summary>
      <div class="scene-list-rows">${lights.map(l=>`<button type="button" data-action="lamp-pick" data-section="${escape(l.path)}" class="${l.selected?'b2-selected':''}" title="${escape(l.label)}${l.edited?' · edited':''}"><i style="background:${escape(l.color)}"></i>${escape(l.label)}${l.edited?' <small>edited</small>':''}</button>`).join('')}
      ${desks.map(id=>`<button type="button" data-action="scene-desk-pick" data-section="${escape(id)}" class="desk-row ${selDesk===id?'b2-selected':''}" title="Room desk ${escape(id)}"><i class="desk-dot"></i>${escape(id)}</button>`).join('')}
      <button type="button" data-inspector-tab="layers" class="scene-list-more">Props and layers →</button></div></details>`;
  }
  panel.addEventListener('toggle',event=>{if(event.target.matches?.('[data-scene-list]'))saveUi({sceneList:event.target.open});},true);
  function tabLabel(tab){if(!shellOn())return tab==='version'?'Desk version':tab[0].toUpperCase()+tab.slice(1);return {project:'Cut',groove:'Moves',version:'Swaps',render:'Render',desks:'Desks'}[tab]||tab[0].toUpperCase()+tab.slice(1);}
  // (the tab grid fits about 9 characters with the icon in a 352 px column: short names, the full one on hover)
  const TAB_TITLE={project:'The whole cut: name, versions, import and export',groove:'Desk moves: the featured desk\'s lift, tilt and wheels',version:'Desk swaps: which desk version shows when',render:'Final render on the render PC',desks:'The room\'s other desks',lighting:'Lighting: time of day, room light, lamps'};
  function showInspector(tab,selection=false,unhide=true){
    const newTab=inspector!==tab;inspector=tab;if(unhide)document.body.classList.remove('inspector-hidden');if(tab==='lighting')queueMicrotask(()=>syncNow());if(tab==='render')queueMicrotask(()=>renderRequest?.refresh());if(tab==='layers')queueMicrotask(()=>renderLayers());
    for(const page of panel.querySelectorAll('[data-inspector-page]'))page.hidden=page.dataset.inspectorPage!==tab;
    for(const button of panel.querySelectorAll('[data-inspector-tab]'))button.setAttribute('aria-pressed',String(button.dataset.inspectorTab===tab));
    panel.scrollTop=0;
    const sel=b2sel.get();if(newTab&&sel&&SEL_HOME[sel.kind]!==tab)requestAnimationFrame(()=>{syncSelection();const page=panel.querySelector(`[data-inspector-page="${tab}"]`);if(page&&!page.hidden)centreSelection(page);});
  }
  // Selecting anything opens its home in the inspector: the tab its settings live in, that section open, scrolled
  // to and outlined for ~1.5 s. [tab, lighting section id or a selector in the tab's page]. Never moves focus, and
  // while a text field in the inspector has focus nothing switches or scrolls.
  const HOMES={camera:['camera','[data-reveal="camera-key"]'],clip:['groove','.movement-inspector'],tod:['lighting','tod'],room:['lighting','room'],
    white:['lighting','white'],status:['lighting','status'],lamp:['lighting','lamps'],light:['lighting','lamps'],title:['chapter','[data-reveal="titles"]'],prop:['props','[data-reveal="prop"]'],person:['people','[data-reveal="person"]'],desk:['desks','[data-reveal="desk"]'],floor:['lighting','[data-reveal="floor"]']};
  let revealWant=null,pulse=null;
  const typing=()=>{const a=document.activeElement;return !!a&&panel.contains(a)&&(a.isContentEditable||a.tagName==='TEXTAREA'||a.tagName==='INPUT'&&!/^(checkbox|radio|range|color|button|submit|reset)$/.test(a.type));};
  // Film chapters with titles: a title's home is the Title tab (title-editor.mjs); otherwise the Chapter Headline.
  const homeOf=type=>type==='title'&&titleEditor?.has()?['title','[data-reveal="title"]']:HOMES[type];
  function reveal(type){
    const home=homeOf(type);if(!home||typing())return false;
    if(inspector!==home[0]||document.body.classList.contains('inspector-hidden'))showInspector(home[0]);
    revealWant=type;requestAnimationFrame(()=>requestAnimationFrame(applyReveal));return true;
  }
  function revealTarget(type){
    const [tab,where]=homeOf(type),page=panel.querySelector(`[data-inspector-page="${tab}"]`);if(!page)return {};
    if(/^[\[.#]/.test(where))return {target:page.querySelector(where)};
    const section=page.querySelector(`[data-light-section="${where}"]`);
    return {section,target:section?.querySelector('.light-inspector,.scene-light-inspector,.movement-inspector')||section};
  }
  function applyReveal(){
    const type=revealWant;revealWant=null;if(!type||inspector!==homeOf(type)[0]||typing())return;
    const {section,target}=revealTarget(type);if(!target)return;
    if(section&&!section.open){section.open=true;delete lightSectionsShut[section.dataset.lightSection];}
    const top=target.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop;
    const tabsH=panel.querySelector('.inspector-tabs')?.getBoundingClientRect().height||0;   // (the tab bar is sticky: the target shows below it)
    panel.scrollTo({top:Math.max(0,top-Math.max(tabsH+16,Math.min(120,panel.clientHeight*.15))),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    pulse={type,at:performance.now()};repulse();
  }
  // The outline survives re-renders of the panel within its 1.5 s (it resumes where it was).
  function repulse(){
    if(!pulse)return;const age=performance.now()-pulse.at;if(age>1500){pulse=null;return;}
    const {target}=revealTarget(pulse.type);if(!target||target.classList.contains('reveal-pulse'))return;
    target.style.animationDelay=-age+'ms';target.classList.add('reveal-pulse');
    setTimeout(()=>{target.classList.remove('reveal-pulse');target.style.animationDelay='';},1500-age);
  }
  function editTimes(){return [...keys().map(k=>k.time*shot().seconds),...deskEditor.boundaries()];}
  // (Snap Beat / Bar: the score's grid, scoreModel(); a number: that step in seconds)
  const numStep=()=>typeof snapStep==='number'?snapStep:.1;
  function snapTime(value,{pixels=1000,bypass=false,excludeClip,excludeKey,excludePlayhead=false}={}){
    const grid=typeof snapStep==='string'?snapTimes(scoreModel(),snapStep):null;
    if(grid?.length&&!bypass){const tol=8*shot().seconds/pixels,edges=[0,shot().seconds,...(excludePlayhead?[]:[playhead*shot().seconds]),...keys().filter(k=>k.id!==excludeKey).map(k=>k.time*shot().seconds),...deskEditor.boundaries(excludeClip)];const near=snapTo(value,edges,tol);return Math.max(0,Math.min(shot().seconds,near!==value?near:snapTo(value,grid,Infinity)));}
    return snapTimelineTime(value,{seconds:shot().seconds,step:numStep(),bypass,targets:[0,shot().seconds,...(excludePlayhead?[]:[playhead*shot().seconds]),...keys().filter(k=>k.id!==excludeKey).map(k=>k.time*shot().seconds),...deskEditor.boundaries(excludeClip)],tolerance:8*shot().seconds/pixels});
  }
  let orbitBase=null;   // see liveView (Film look follows an orbit)
  // A live orbit can still be coasting (OrbitControls damping): spend what is left at once, so the next seek puts the
  // camera exactly on the keys.
  function stopOrbit(){const c=bridge.stage()?.three?.()?.controls;if(!c?.update)return;const d=c.enableDamping;c.enableDamping=false;try{c.update();}finally{c.enableDamping=d;}}
  function ensureKeys(){shot().camera={keys:copy(keys())};return shot().camera.keys;}
  // The film shot's story keys as a chapter page gets them (tools/experience/director-bridge.py link: plan-NN ids,
  // time = at / seconds, smooth first and last, linear between), so Render still and the live view bake the film's path.
  function filmCameraKeys(f){
    const plan=[...(f?.cameraPlan?.keys||[])].sort((a,b)=>a.at-b.at),T=Number(f?.seconds)||shot().seconds;if(!plan.length)return null;
    return plan.slice(0,64).map((k,i)=>({id:'plan-'+String(i).padStart(2,'0'),time:Math.round(k.at/T*1e6)/1e6,label:String(k.label||`Key ${i+1} at ${k.at.toFixed(1)} s`).slice(0,60),
      easing:i===0||i===plan.length-1?'smooth':'linear',view:{position:[...k.position],target:[...k.target],fov:k.fov??35,aspect:16/9}}));
  }
  function requireReady(){if(!bridge.ready())throw Error('Wait for this chapter to finish loading.');}
  function seekCamera(time){requireReady();orbitBase=null;playhead=Math.max(0,Math.min(1,time));bridge.seek(playhead);syncPlayhead();}
  function syncTransport(){
    const bake=bridge.bakeState(),bakeLabel=BAKE_PROFILE.height+'p / '+BAKE_PROFILE.fps+' fps',state=bridge.playback(),active=state.playing&&state.index===selected,label=state.busy?'Loading chapter…':active?'❚❚ Pause chapter':'▶ Play chapter';
    for(const root of [appbar,panel,timeline]){
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
    if(bake.baking)for(const root of [appbar,panel,timeline])for(const el of root.querySelectorAll('button,input,select,textarea'))if(!['bake','bake-all'].includes(el.dataset.action))el.disabled=true;
    if(composing)for(const root of [appbar,panel,timeline])for(const el of root.querySelectorAll('button,input,select,textarea'))el.disabled=true;
    {const b=timeline.querySelector('[data-tl-bake]');if(b){const st=bake.available?(bake.state==='stale'?'stale':'ok'):bake.state==='stale'?'stale':'none';b.className='tl-bake '+st;b.title=st==='ok'?'Preview video is current: playback uses it':st==='stale'?'Preview video is out of date: bake again (Render ▾)':'No preview video for this chapter';}}
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
    syncLightNow();syncNow();titleEditor.sync();scenePeople.poseSync();deskVersions.sync(playhead);if(playhead!==pokedAt){pokedAt=playhead;filmLook?.poke();}
    const ruler=timeline.querySelector('.time-ruler');if(ruler)ruler.setAttribute('aria-valuenow',(playhead*shot().seconds).toFixed(2));
    const exact=timeline.querySelector('[name="timeline-seconds"]');if(exact&&document.activeElement!==exact)exact.value=(playhead*shot().seconds).toFixed(2);
    const tc=timeline.querySelector('[data-film-tc]');if(tc)tc.textContent=timecodeNow();
  }
  function syncPan(){const viewport=timeline.querySelector('.timeline-viewport'),range=timeline.querySelector('[name="timeline-pan"]');if(viewport&&range&&document.activeElement!==range)range.value=viewport.scrollLeft/Math.max(1,viewport.scrollWidth-viewport.clientWidth)*100;}
  function selectKey(id){keyId=id;lightSel=null;sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();titleEditor.clear();const k=selectedKey();if(!k)return;deskEditor.clearSelection();reveal('camera');seekCamera(k.time);renderPanel();renderTimeline();}
  function captureKey(time,label){
    requireReady();const view=bridge.stage().captureCamera();if(!view)throw Error('The camera is not ready.');orbitBase=null;
    deskEditor.clearSelection();reveal('camera');
    const existing=keys().find(k=>Math.abs(k.time-time)<.001);if(!existing&&keys().length>=64)throw Error('A chapter can hold up to 64 camera keyframes.');
    commit(()=>{const list=ensureKeys();if(existing){const key=list.find(k=>k.id===existing.id);key.view=view;keyId=key.id;}else{const key={id:crypto.randomUUID(),time,label:label||'Camera view '+(list.length+1),easing:'smooth',path:'orbit',view};list.push(key);keyId=key.id;}list.sort((a,b)=>a.time-b.time);},{render:true});
    status('Camera keyframe captured. Drag its diamond on the timeline to change its timing.');
  }

  // The status line that follows an edit names it (first sentence); see editLabel() for edits without one.
  // A removal or a hide ("… Undo brings them back.") shows a toast with an Undo button for six seconds (no confirms).
  let toast=null,toastTimer=0;
  function undoToast(message){
    if(!toast){toast=Object.assign(document.createElement('div'),{className:'df-toast'});toast.setAttribute('role','status');toast.innerHTML='<span></span><button type="button">Undo</button>';document.body.append(toast);
      toast.querySelector('button').addEventListener('click',()=>{toast.classList.remove('shown');Promise.resolve(action('undo')).catch(error=>status(error.message,true));});}
    toast.firstChild.textContent=message.replace(/\s*Undo[^.]*\.?\s*$/,'');toast.classList.add('shown');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('shown'),6000);
  }
  const status=(message,error=false)=>{if(!error&&open&&message&&/\bUndo (brings|puts|restores|takes)/.test(message)&&undo.length)undoToast(message);if(labelPending&&!error&&message){labelPending.text=message.split(/\.(\s|$)/)[0];labelPending=null;}for(const el of [panel.querySelector('[data-status]'),timeline.querySelector('[data-timeline-status]')])if(el){el.textContent=message;el.title=message;el.classList.toggle('error',error);}};
  function saved(text,title){const el=document.querySelector('#director-appbar:not([hidden]) [data-saved]')||panel.querySelector('[data-saved]');if(el){el.textContent=text;el.title=title;}}
  // (for the e2e tests and Report a problem: which cut is open and where its draft is kept)
  function stampDraft(){document.body.dataset.cutId=project.id;document.body.dataset.draftStore=fresh?.on?'film':'library';}
  // read-only: the open chapter as the Director holds it (tests and diagnostics; a draft is only kept while it differs
  // from what was exported, so a change back to the film's own value leaves no draft to read)
  globalThis.__directorShot=()=>copy(shot());
  function draft(){clearTimeout(draftTimer);stampDraft();fresh.noteDraft(project,unexported());try{if(!fresh.on)library.draft(project);saved('Saved ✓','Draft kept in this browser · Export cut sends it to the film');}catch{saved('Not saved','Browser storage is full, so no draft copy · Export cut sends it to the film');}}
  function changed(){filmLook?.poke();bridge.update(project);clearTimeout(draftTimer);draftTimer=setTimeout(draft,250);renderTimeline();syncCameraOptions();syncFilm();for(const [name,stack]of [['undo',undo],['redo',redo]]){const b=panel.querySelector(`[data-action="${name}"]`);if(b)b.disabled=!stack.length;}renderAppBar();}
  // Film chapters: a dropdown that reloads this tab with another chapter's page.
  const filmIndex=()=>filmChapterIndex(filmChapters,project.shots.map(s=>s.id));
  const unexported=()=>signature()!==exported;
  function filmPicker(){
    if(!film)return '';
    if(!filmChapters)return `<div class="film-chapter-picker" data-film-picker><span class="director-hint">${filmError?escape(filmError):'Loading film chapters…'}</span></div>`;
    const i=filmIndex();
    return `<div class="film-chapter-picker" data-film-picker>${cutPicker()}<button data-action="film-prev" aria-label="Previous film chapter" title="Previous film chapter" ${i<=0?'disabled':''}>‹</button><label><span>Film chapter</span><select name="film-chapter" aria-label="Film chapter" title="Switch film chapter (reloads this tab)">${i<0?'<option value="-1" selected>Choose a chapter…</option>':''}${filmChapters.map((c,n)=>option(String(n),filmChapterLabel(c),String(i))).join('')}</select></label><button data-action="film-next" aria-label="Next film chapter" title="Next film chapter" ${i<0&&filmChapters.length?'':i>=filmChapters.length-1?'disabled':''}>›</button><span class="film-dirty" data-film-dirty title="Edited since the last Export cut" ${unexported()?'':'hidden'}>● not exported</span>${fresh.noticeHTML()}</div>`;
  }
  function syncFilm(){
    if(!film)return;const dirty=unexported(),i=String(filmIndex());
    for(const el of document.querySelectorAll('[data-film-dirty]'))el.hidden=!dirty;
    for(const el of document.querySelectorAll('select[name="film-chapter"]'))if(el.value!==i)el.value=i;
  }
  // Cuts of the film (exports/film-cuts.json, tools/experience/film-cuts.py): switch to the same chapter of another cut,
  // or copy this cut into a new one (the studio server's /__film/duplicate) and go on editing there.
  const cutDir=film?film.film.replace(/\/director-chapters\.json.*$/,''):null,myCut=()=>filmCuts?.find(c=>c.dir===cutDir)||null;
  function cutPicker(){
    if(!filmCuts?.length)return '';const mine=myCut();
    return `<label class="film-cut" title="${escape(mine?.note||'Which cut of the film this tab is editing')}"><span>Cut</span><select name="film-cut" aria-label="Film cut">${mine?'':'<option value="" selected>This cut</option>'}${filmCuts.map(c=>`<option value="${escape(c.id)}" ${c===mine?'selected':''}>${escape(c.name)}</option>`).join('')}<option value="__new">＋ Duplicate this cut…</option></select></label>`;
  }
  async function switchCut(id){
    if(id==='__new'){newCut();return;}
    const cut=filmCuts?.find(c=>c.id===id);if(!cut||cut===myCut()){renderFilm();return;}
    try{const list=await loadFilmChapters(cut.chapters),target=list.find(c=>c.id===shot().id)||list[0];switchTo({...target,cut:cut.name});}
    catch(error){status('That cut could not be opened: '+error.message,true);renderFilm();}
  }
  const cutDialog=document.createElement('dialog');cutDialog.id='film-cut-new';cutDialog.setAttribute('aria-labelledby','film-cut-new-title');document.body.append(cutDialog);
  function newCut(){
    const from=myCut();
    cutDialog.innerHTML=`<form method="dialog"><div class="director-heading"><div><span class="director-kicker">NEW CUT</span><h2 id="film-cut-new-title">Duplicate ${escape(from?.name||'this cut')}</h2></div></div><p>Makes a copy of every chapter of this cut as it is in the film now. Your edits there never touch ${escape(from?.name||'this cut')}.${unexported()?' <b>This chapter has unexported edits: Export cut first if the copy should have them.</b>':''}</p><label>Name<input name="cut-name" maxlength="60" required autocomplete="off" value="${escape((from?.name||'Cut')+' copy')}"></label><div class="director-actions"><button value="make" class="primary">Duplicate and open</button><button value="cancel" formnovalidate>Cancel</button></div></form>`;
    cutDialog.returnValue='';cutDialog.showModal();const input=cutDialog.querySelector('input');input.focus();input.select();
  }
  cutDialog.addEventListener('close',async()=>{
    const name=cutDialog.querySelector('input')?.value.trim();renderFilm();if(cutDialog.returnValue!=='make'||!name)return;
    status(`Making “${name}”…`);
    try{
      const r=await fetch('/__film/duplicate?from='+encodeURIComponent(cutDir)+'&name='+encodeURIComponent(name),{method:'POST'});
      if(!r.ok){let why='';try{why=(await r.json()).error||'';}catch{}throw Error(r.status===404||r.status===405?'this studio server is older than the Cut menu; restart it once, or run: python3 tools/experience/film-cuts.py duplicate '+cutDir.replace(/^\//,'')+' "'+name+'"':why||'the copy failed');}
      const made=await r.json(),list=await loadFilmChapters(made.chapters),target=list.find(c=>c.id===shot().id)||list[0];
      status(`“${name}” is ready · opening it…`);goFilm({...target,cut:name});
    }catch(error){status('No new cut: '+error.message,true);}
  });
  function renderFilm(){for(const el of document.querySelectorAll('[data-film-picker]'))el.outerHTML=filmPicker();syncTransport();}
  if(film)fetch('/exports/film-cuts.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{filmCuts=Array.isArray(v?.cuts)?v.cuts.filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string'&&typeof c.dir==='string'&&typeof c.chapters==='string'):null;},()=>{}).finally(()=>renderFilm());
  if(film)loadFilmChapters(film.film).then(list=>{filmChapters=list;filmError='';studioSync.remember(list[filmIndex()]);},error=>{filmError='Film chapters unavailable: '+error.message;}).finally(renderFilm);
  const switcher=document.createElement('dialog');switcher.id='film-switch';switcher.setAttribute('aria-labelledby','film-switch-title');document.body.append(switcher);
  let switchTarget=null;const targetLabel=t=>(t.cut?t.cut+' · ':'')+filmChapterLabel(t);
  function switchFilm(n){const target=filmChapters?.[n];if(!target||n===filmIndex()){syncFilm();return;}switchTo(target);}
  function switchTo(target){
    if(!deskEditor.flush()){renderFilm();return;}
    if(!unexported()){goFilm(target);return;}
    switchTarget=target;
    switcher.innerHTML=`<div class="director-heading"><div><span class="director-kicker">${target.cut?'SWITCH CUT':'SWITCH FILM CHAPTER'}</span><h2 id="film-switch-title">Export your edits first?</h2></div></div><p>This chapter changed since the last Export cut. Opening <b>${escape(targetLabel(target))}</b> reloads this tab; unexported edits only stay as a browser draft.</p><div class="director-actions"><button data-switch="export" class="primary">Export cut, then switch</button><button data-switch="go">Switch without exporting</button><button data-switch="cancel">Cancel</button></div>`;
    switcher.showModal();switcher.querySelector('[data-switch=export]').focus();
  }
  function goFilm(target){deskEditor.stop();status('Opening '+(target.cut?targetLabel(target):'film chapter '+filmChapterLabel(target))+'…');for(const el of document.querySelectorAll('[data-film-picker] button,[data-film-picker] select'))el.disabled=true;(leaving=true,location.assign(target.url));}
  switcher.addEventListener('click',async event=>{
    const choice=event.target.closest('[data-switch]')?.dataset.switch;if(!choice)return;
    const target=switchTarget;switchTarget=null;switcher.close();
    if(choice==='cancel'||!target){renderFilm();return;}
    if(choice==='go'){goFilm(target);return;}
    await action('save-export');if(unexported())return;
    // Give the download a moment to leave before the page unloads its blob URL.
    status('Cut exported · opening '+targetLabel(target)+'…');setTimeout(()=>goFilm(target),900);
  });
  switcher.addEventListener('close',()=>renderFilm());
  // Film lighting: the cut's own fields once edited, else the film shot's (ids kept per chapter).
  const filmShot=()=>bridge.filmShot?.(shot().id)||null,filmLights=new Map();
  // Chapters the film renders as sub-shots (the finale): one desk per sub-shot on the stage, its lane and badge.
  const deskVersions=createDeskVersions({bridge,shot,project:()=>project,selected:()=>selected,seek:t=>seekCamera(t),status,escape,scrubbing:()=>!!scrub||!!groupDrag||!!keyDrag,isOpen:()=>open,
    panel,commit:(fn,o)=>commit(fn,o),endGroup:()=>{group=null;},rerender:()=>renderPanel(),showTab:()=>{inspector='version';renderPanel();showInspector('version');}});
  function lighting(){
    const s=shot();let src=s.ledStatus?s:null,edited=!!src;
    if(!src){const f=filmShot();if(!f)return null;src=filmLights.get(s.id);if(!src){src=cleanLighting({ledStatus:f.ledStatus||[],ledNeutral:f.ledNeutral,ledColor:f.ledColor||'#ffffff',sceneGlobals:f.sceneGlobals});filmLights.set(s.id,src);}}
    const color=src.ledColor||'#ffffff',implicit=!src.ledNeutral?.length;
    return {status:src.ledStatus,neutral:implicit?[[0,color,'neutral-base']]:src.ledNeutral,color,roomLight:src.sceneGlobals?.roomLight,implicit,edited};
  }
  // Writes the whole lighting set into the cut (call inside commit).
  function writeLighting(L,{status=L.status,neutral=L.neutral,roomLight=L.roomLight}={}){
    const s=shot();validateStatus(status,s.seconds);
    s.ledStatus=copy(status).sort((a,b)=>a.at-b.at);
    if(L.implicit&&neutral.length===1&&neutral[0][0]===0){s.ledColor=neutral[0][1];delete s.ledNeutral;}else{s.ledNeutral=copy(neutral).sort((a,b)=>a[0]-b[0]);s.ledColor=L.color;}
    if(roomLight!==undefined&&roomLight!==null)s.sceneGlobals={...s.sceneGlobals,roomLight};
  }
  function putLighting(change,{key=null,render=true}={}){const L=lighting();if(!L)return;requireReady();commit(()=>writeLighting(L,change),{render,key});}
  // Time of day: the room's daypart keys (film shot until edited).
  const filmTods=new Map();
  function timeOfDay(){
    const s=shot();if(s.timeOfDay)return {keys:s.timeOfDay,edited:true};const f=filmShot();if(!f?.timeOfDay?.length)return null;
    let c=filmTods.get(s.id);if(!c){c=cleanLighting({timeOfDay:f.timeOfDay}).timeOfDay;filmTods.set(s.id,c);}return {keys:c,edited:false};
  }
  const roomModes=()=>{const s=shot(),room=catalog.find(r=>r.id===s.room),layout=room?.layouts.find(l=>l.id===s.layout);return layout?.modes||room?.modes||[];};
  function putTod(keys,{render=true}={}){requireReady();const s=shot();for(const k of keys)if(k.at<0||k.at>s.seconds+1e-6)throw Error(`Time-of-day keys must sit inside the ${s.seconds}-second chapter.`);commit(()=>{shot().timeOfDay=copy(keys).sort((a,b)=>a.at-b.at);},{render});}
  const lightItem=()=>{if(!lightSel)return null;if(lightSel.kind==='tods')return timeOfDay()?.keys.find(k=>k.id===lightSel.id)||null;const L=lighting();if(!L)return null;return lightSel.kind==='lights'?L.status.find(e=>e.id===lightSel.id):L.neutral.find(k=>k[2]===lightSel.id);};
  function selectLight(kind,id){
    lightSel={kind,id};keyId=null;deskEditor.clearSelection();sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();titleEditor.clear();const item=lightItem();if(!item)return;
    reveal(kind==='tods'?'tod':kind==='neutrals'?'white':'status');seekCamera((Array.isArray(item)?item[0]:item.at)/shot().seconds);render();
    const el=timeline.querySelector(`[data-light-clip="${id}"],[data-light-key="${id}"],[data-tod-key="${id}"]`);if(el)el.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  // Group selection: marquee or Shift/Ctrl-click camera keys, desk clips and lighting, then move them together.
  const KINDS_ON_TIMELINE=[['keys','[data-key]','key'],['clips','[data-desk-clip]','deskClip'],['lights','[data-light-clip]','lightClip'],['neutrals','[data-light-key]','lightKey'],['tods','[data-tod-key]','todKey']];
  const itemOf=el=>{for(const [kind,attr,data] of KINDS_ON_TIMELINE)if(el.matches(attr))return [kind,el.dataset[data]];return null;};
  const picked=()=>Object.values(picks).reduce((n,set)=>n+set.size,0);
  function syncPicks(){
    const L=lighting(),ids={keys:new Set(keys().map(k=>k.id)),clips:new Set(deskEditor.motion().clips.map(c=>c.id)),lights:new Set(L?.status.map(e=>e.id)),neutrals:new Set(L?.neutral.map(k=>k[2])),tods:new Set(timeOfDay()?.keys.map(k=>k.id))};
    for(const [kind,attr,data] of KINDS_ON_TIMELINE){
      for(const id of picks[kind])if(!ids[kind].has(id))picks[kind].delete(id);
      for(const el of timeline.querySelectorAll(attr))el.classList.toggle('grouped',picks[kind].has(el.dataset[data]));
    }
    timeline.classList.toggle('has-group',picked()>0);syncSelectedHeader();
  }
  function groupStatus(){
    const n=(v,one,many)=>v?`${v} ${v===1?one:many}`:'',parts=[n(picks.keys.size,'camera view','camera views'),n(picks.clips.size,'move','moves'),n(picks.lights.size,'light state','light states'),n(picks.neutrals.size,'white key','white keys'),n(picks.tods.size,'time-of-day key','time-of-day keys')].filter(Boolean);
    status(picked()?`${parts.join(' · ')} selected · drag one to move them together · ←/→ nudge (Shift ×10) · Esc clears`:'Selection cleared.');
  }
  function clearPicks(){if(!picked())return;for(const set of Object.values(picks))set.clear();syncPicks();}
  // The Selected header: what the inspector edits (or how many items a group move takes), with batch actions.
  function selectedHeader(){
    const n=picked();
    if(n){const c=(v,one,many)=>v?`${v} ${v===1?one:many}`:'',parts=[c(picks.keys.size,'camera view','camera views'),c(picks.clips.size,'move','moves'),c(picks.lights.size,'status light','status lights'),c(picks.neutrals.size,'white key','white keys'),c(picks.tods.size,'time-of-day key','time-of-day keys')].filter(Boolean).join(', ');
      return `<div class="sel-row"><span class="sel-icon">▦</span><span class="sel-name"><b>${n} items</b><small>${parts}</small></span><button data-action="sel-clear" title="Deselect (Esc)" aria-label="Deselect">×</button></div><div class="sel-batch"><label>Move by<input name="sel-move" type="number" step=".1" value="1"> s</label><button data-action="sel-move">Move</button><button data-action="sel-align" title="Move the selection so its first item starts at the playhead">Align to playhead</button><button data-action="sel-delete" title="Delete the selection (Delete)">Delete</button></div>`;}
    const th=titleEditor.header();if(th)return th;
    // P5: every selection's header ends with the same tools (Duplicate · Frame / Zoom to · Reset to the film · Delete)
    const TOOLS={dup:['⧉','Duplicate (Ctrl+D)'],frame:['⌖','Frame it in the view (F)'],zoom:['↔','Zoom the timeline to it (Z)'],reset:['↺','Reset to the film (Alt+R)'],delete:['🗑','Delete (Delete)']};
    const tools=list=>shellOn()&&list?.length?`<span class="sel-tools">${list.map(t=>`<button type="button" data-action="sel-tool" data-section="${t}" title="${TOOLS[t][1]}" aria-label="${TOOLS[t][1]}">${TOOLS[t][0]}</button>`).join('')}</span>`:'';
    const row=(icon,name,detail,list=null)=>`<div class="sel-row"><span class="sel-icon">${icon}</span><span class="sel-name"><b>${escape(name)}</b><small>${escape(detail)}</small></span>${tools(list)}<button data-action="sel-clear" title="Deselect (Esc)" aria-label="Deselect">×</button></div>`;
    const item=lightItem(),s=shot();
    if(item&&lightSel?.kind==='lights')return row('▬','Desk status · '+kindLabel(item.kind),`${r2(item.at)}–${r2(item.at+item.dur)} s`);
    if(item&&lightSel?.kind==='neutrals')return row('◆','Desk white · '+whiteName(item[1]),`${r2(item[0])} s · ${Math.round(lightnessOf(item[1]))}% bright`);
    if(item&&lightSel?.kind==='tods')return row('◆','Time of day · '+(roomModes().find(m=>m.id===item.mode)?.label||item.mode),`${r2(item.at)} s`);
    const k=selectedKey();if(k)return row('◆','Camera view · '+k.label,`${r2(k.time*s.seconds)} s`,['dup','zoom','delete']);
    const clipId=deskEditor.selectedId(),clip=clipId&&deskEditor.motion().clips.find(c=>c.id===clipId);if(clip)return row('▬','Desk move · '+clipSummary(clip),`${r2(clip.start)}–${r2(clipEnd(clip))} s`,['dup','zoom','delete']);
    const light=sceneLights.selected()&&sceneLights.lanes().find(x=>x.path===sceneLights.selected());if(light)return row('✺','Scene light · '+light.label,light.edited?'edited':'from the film',['frame']);
    const prop=sceneProps.header();if(prop)return row('▣','Prop · '+prop.name,prop.detail,['frame','reset','delete']);
    const person=scenePeople.header();if(person)return row('☻','Person · '+person.name,person.detail,['dup','frame','reset','delete']);
    const desk=deskSel.header();if(desk)return row('▭','Desk · '+desk.name,desk.detail);
    return '';
  }
  function syncSelectedHeader(){const el=panel.querySelector('[data-selected-header]');if(el)el.innerHTML=selectedHeader();syncSelection();}
  function clearSelection(){for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;titleEditor.clear();deskEditor.clearSelection();sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();render();status('Selection cleared.');}
  // Delete every picked item (lanes keep at least one white / time-of-day key); one undo step.
  function deletePicks(){
    const n=picked();if(!n)return;requireReady();const L=lighting(),T=timeOfDay(),motion=deskEditor.motion(),list=keys().filter(k=>!picks.keys.has(k.id));
    commit(()=>{const s=shot();
      if(picks.keys.size){if(list.length)s.camera={keys:copy(list)};else delete s.camera;}
      if(picks.clips.size)choreo.shot().motion=cleanClipMotion({...copy(motion),clips:motion.clips.filter(c=>!picks.clips.has(c.id))},s.seconds);
      if(L&&(picks.lights.size||picks.neutrals.size)){let neutral=L.neutral.filter(k=>!picks.neutrals.has(k[2]));if(!neutral.length)neutral=[L.neutral[0]];writeLighting(L,{status:L.status.filter(e=>!picks.lights.has(e.id)),neutral});}
      if(T&&picks.tods.size){let k=T.keys.filter(x=>!picks.tods.has(x.id));if(!k.length)k=[T.keys[0]];s.timeOfDay=copy(k);}
    },{render:true});
    for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;render();status(`Deleted ${n} item${n===1?'':'s'}. Undo restores them.`);
  }
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!open||picked()||document.querySelector('dialog[open]')||event.target.closest?.('input,select,textarea'))return;
    if(titleEditor.editing())return;
    if(!(lightSel||keyId||deskEditor.selectedId()||sceneLights.selected()||sceneProps.selected()||scenePeople.selected()||deskSel.selected()||titleEditor.selectedId()))return;
    event.preventDefault();event.stopImmediatePropagation();clearSelection();
  },true);
  // Ctrl+Shift+A: every item in the lane under the pointer.
  let hoverRow=null;
  function pickLane(){
    const row=hoverRow;if(!row)return status('Point at a lane, then Ctrl+Shift+A selects everything in it.');
    sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();for(const [kind,attr,data] of KINDS_ON_TIMELINE)for(const el of row.querySelectorAll(attr))picks[kind].add(el.dataset[data]);syncPicks();groupStatus();
  }
  function togglePick(kind,id){
    sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();
    if(!picked()){if(keyId)picks.keys.add(keyId);const clip=deskEditor.selectedId();if(clip)picks.clips.add(clip);if(lightItem())picks[lightSel.kind].add(lightSel.id);}
    if(picks[kind].has(id))picks[kind].delete(id);else picks[kind].add(id);syncPicks();groupStatus();
  }
  function pickAll(){
    const L=lighting();for(const k of keys())picks.keys.add(k.id);for(const c of deskEditor.motion().clips)picks.clips.add(c.id);
    if(L){for(const e of L.status)picks.lights.add(e.id);for(const k of L.neutral)picks.neutrals.add(k[2]);}
    for(const k of timeOfDay()?.keys||[])picks.tods.add(k.id);
    syncPicks();groupStatus();
  }
  const groupBase=()=>{const L=lighting();return {seconds:shot().seconds,keys:copy(keys()),clips:copy(deskEditor.motion().clips),...(L?{lights:copy(L.status),neutrals:copy(L.neutral)}:{}),...(timeOfDay()?{tods:copy(timeOfDay().keys)}:{})};};
  // Change the chapter length without moving anything that is already there (see chapter-timing.mjs); one undo step.
  // `at` seconds puts the playhead there afterwards; `apply(next)` adds the new item inside the same step.
  function resizeChapter(seconds,{motion=deskEditor.motion(),message='Chapter length changed',at=null,apply=null}={}){
    requireReady();const old=shot().seconds,position=playhead*old,longer=seconds>old+1e-9;
    // A room desk is open: its clips live in shot.deskEdits, the chapter's own motion stays the featured desk's. Chapter length is shared by all desks.
    const roomDesk=!!choreo.desk(),chapterMotion=roomDesk?deskEditor.featuredMotion():motion;
    if(!longer)validateDeskEdits(shot().deskEdits,seconds);
    const next=(longer?lengthenChapter:shortenChapter)(shot(),chapterMotion,keys(),seconds);
    commit(()=>{project.shots[selected]=next;if(roomDesk)choreo.shot().motion=motion;apply?.(next);},{render:true});
    seekCamera(at!==null?at/seconds:Math.min(1,position/seconds));
    status(`${message?message+' · chapter':'Chapter'} ${longer?'lengthened':'shortened'} to ${Number(seconds.toFixed(3))}s. Undo restores the previous timing.`);
  }
  function shiftPicks(delta,message,set=picks){
    requireReady();const base=groupBase(),next=shiftGroup(base,set,delta);if(Math.abs(next.delta)<1e-9){renderTimeline();status('The selection is already at the start of the chapter.');return;}
    const motion=deskEditor.motion(),longer=next.seconds!==base.seconds,position=playhead*base.seconds,L=lighting(),lit=set.lights?.size||set.neutrals?.size;
    commit(()=>{
      const s=shot();s.seconds=next.seconds;if(next.keys.length&&(set.keys?.size||longer))s.camera={keys:next.keys};if(set.clips?.size||(longer&&!choreo.desk()))choreo.shot().motion=cleanClipMotion({...copy(motion),clips:next.clips},next.seconds);
      if(lit)writeLighting(L,{status:next.lights,neutral:next.neutrals});
      if(set.tods?.size)s.timeOfDay=next.tods;
    },{render:true});
    seekCamera(position/next.seconds);
    status(`${message} ${next.delta>0?'+':''}${Number(next.delta.toFixed(3))}s${longer?` · chapter lengthened to ${next.seconds}s`:''}. Undo restores the previous timing.`);
  }
  // Magnet: every edge and key that is not moving, the playhead and the chapter ends, within 8 px.
  function snapTargets(set){
    const s=shot().seconds,out=[],L=lighting(),T=timeOfDay(),moving=(kind,id)=>set[kind]?.has(id);
    for(const c of deskEditor.motion().clips)if(!moving('clips',c.id))out.push([c.start,`${clipSummary(c)} start`],[clipEnd(c),`${clipSummary(c)} end`]);
    if(L)for(const e of L.status)if(!moving('lights',e.id))out.push([e.at,`${kindLabel(e.kind)} start`],[e.at+e.dur,`${kindLabel(e.kind)} end`]);
    for(const k of keys())if(!moving('keys',k.id))out.push([k.time*s,`camera view ${k.label}`]);
    if(L)for(const k of L.neutral)if(!moving('neutrals',k[2]))out.push([k[0],whiteName(k[1])+' key']);
    for(const k of T?.keys||[])if(!moving('tods',k.id))out.push([k.at,(roomModes().find(m=>m.id===k.mode)?.label||k.mode)+' key']);
    out.push(...titleEditor.snapTargets(set.titles?[...set.titles][0]:null));
    out.push([playhead*s,'the playhead'],[0,'the chapter start'],[s,'the chapter end']);
    return out;
  }
  function grabbedSpan(d){
    const b=d.base,i=d.id,s=b.seconds;
    if(d.kind==='keys'){const k=b.keys.find(k=>k.id===i);return k&&[k.time*s,k.time*s];}
    if(d.kind==='clips'){const c=b.clips.find(c=>c.id===i);return c&&[c.start,clipEnd(c)];}
    if(d.kind==='lights'){const e=b.lights?.find(e=>e.id===i);return e&&[e.at,e.at+e.dur];}
    if(d.kind==='neutrals'){const k=b.neutrals?.find(k=>k[2]===i);return k&&[k[0],k[0]];}
    if(d.kind==='titles'){const t=b.titles?.find(t=>t.id===i);return t&&(d.edge==='start'?[t.rel_in,t.rel_in]:d.edge==='end'?[t.rel_out,t.rel_out]:[t.rel_in,t.rel_out]);}
    const k=b.tods?.find(k=>k.id===i);return k&&[k.at,k.at];
  }
  function magnetDelta(d,raw){
    if(!magnet)return null;const span=grabbedSpan(d);if(!span)return null;const tol=8/d.width*d.base.seconds;let best=null;
    for(const [t,name] of snapTargets(d.set))for(const [edge,label] of [[span[0],'start'],[span[1],'end']]){const delta=t-edge,off=Math.abs(delta-raw);if(off<=tol&&(!best||off<best.off))best={delta,off,t,name,edge:label};}
    return best;
  }
  // Drag feedback: a ghost at the origin, a chip at the cursor, a guide line when snapped.
  function dragFeedback(d,event){
    const content=timeline.querySelector('.timeline-content'),s=d.base.seconds;if(!content)return;
    if(!d.ghosts){d.ghosts=[];for(const [kind,attr,data] of KINDS_ON_TIMELINE)for(const el of timeline.querySelectorAll(attr))if(d.set[kind]?.has(el.dataset[data])){const g=el.cloneNode(true);g.removeAttribute('data-key');g.removeAttribute('data-desk-clip');g.removeAttribute('data-light-clip');g.removeAttribute('data-light-key');g.removeAttribute('data-tod-key');g.classList.add('drag-ghost');g.classList.remove('grouped','selected','invalid');g.style.left=el.dataset.originLeft||el.style.left;el.parentElement.insertBefore(g,el);d.ghosts.push(g);}}
    d.chip||=Object.assign(document.createElement('div'),{className:'drag-chip'});if(!d.chip.isConnected)document.body.append(d.chip);
    const span=grabbedSpan(d),n=span?[span[0]+d.delta,span[1]+d.delta]:null,sign=d.delta>=0?'+':'−';
    d.chip.textContent=`${sign}${Math.abs(d.delta).toFixed(2)} s`+(n?` → ${n[0]===n[1]?r2(n[0])+' s':r2(n[0])+'–'+r2(n[1])+' s'}`:'')+(d.snap?` · snapped to ${d.snap.name}`:'');
    Object.assign(d.chip.style,{left:event.clientX+'px',top:event.clientY-12+'px'});
    if(!d.guide){d.guide=Object.assign(document.createElement('div'),{className:'snap-guide'});d.guide.append(Object.assign(document.createElement('span'),{className:'snap-guide-name'}));}
    if(d.snap){
      if(!d.guide.isConnected)content.append(d.guide);
      const row=content.querySelector('.camera-lane-row,.desk-lane-row'),lane=row?.querySelector('.camera-track,.desk-lane'),lr=lane?.getBoundingClientRect(),cr=content.getBoundingClientRect();
      const vr=content.closest('.timeline-viewport')?.getBoundingClientRect()||cr,ruler=content.querySelector('.time-ruler-row')?.getBoundingClientRect(),top=Math.max(ruler?ruler.bottom:vr.top,vr.top);
      // the line runs from under the (sticky) ruler down the lanes; the name sits just under the ruler, flipped left near the right edge
      const x=lr?lr.left-cr.left+d.snap.t/s*lr.width:0;d.guide.style.left=x+'px';d.guide.style.top=(top-cr.top)+'px';
      const name=d.guide.firstChild;name.textContent='snapped to '+d.snap.name;d.guide.dataset.name=name.textContent;
      d.guide.classList.toggle('flip',cr.left+x+name.offsetWidth+12>vr.right);
    }
    else d.guide.remove();
  }
  function endDragFeedback(d){for(const g of d.ghosts||[])g.remove();d.chip?.remove();d.guide?.remove();}
  function previewGroup(d){
    const s=d.base.seconds;let valid=true,next=null;try{next=shiftGroup(d.base,d.set,d.delta);}catch{valid=false;}
    const at={keys:k=>k.time*s,clips:c=>c.start,lights:e=>e.at,neutrals:k=>k[0],tods:k=>k.at},find={keys:id=>d.base.keys.find(k=>k.id===id),clips:id=>d.base.clips.find(c=>c.id===id),lights:id=>d.base.lights?.find(e=>e.id===id),neutrals:id=>d.base.neutrals?.find(k=>k[2]===id),tods:id=>d.base.tods?.find(k=>k.id===id)};
    for(const [kind,attr,data] of KINDS_ON_TIMELINE)for(const el of timeline.querySelectorAll(attr)){const id=el.dataset[data];if(!d.set[kind]?.has(id))continue;const item=find[kind](id);if(item){el.dataset.originLeft||=el.style.left;el.style.left=(at[kind](item)+d.delta)/s*100+'%';const small=el.querySelector('small'),a=at[kind](item)+d.delta;if(small)small.textContent=kind==='clips'?`${r2(a)}–${r2(a+item.duration)}s · ${r2(item.duration)}s`:kind==='lights'?`${r2(a)}–${r2(a+item.dur)}s`:kind==='keys'?`${a.toFixed(1)}s`:small.textContent;el.classList.toggle('invalid',!valid);}}
    const count=Object.values(d.set).reduce((n,v)=>n+v.size,0);
    status(valid?`Moving ${count} item${count===1?'':'s'} ${d.delta>0?'+':''}${Number(d.delta.toFixed(3))}s${next.seconds>s?` · chapter becomes ${next.seconds}s`:''} · Alt: bypass snap`:'Those positions overlap another movement, light state or key.',!valid);
  }
  // Lighting lane: light states as blocks, the neutral white's keys as diamonds above them.
  const kindLabel=kind=>LIGHT_KINDS.find(k=>k[0]===kind)?.[1]||kind,r2=v=>Number(v.toFixed(2));
  let lampsRowHtml=()=>'';
  function lightLane(){
    const L=lighting(),T=timeOfDay();if(!L&&!T)return '';const s=shot().seconds,on=(kind,id)=>lightSel?.kind===kind&&lightSel.id===id;
    const band=at=>Array.from({length:49},(_,i)=>`${at(i/48*s)} ${(i/48*100).toFixed(2)}%`).join(',');
    // Labelled keys alternate above / below the band so neighbours stay readable; spans mark the blends.
    const chip=(kind,attr,id,t,swatch,name,detail,i)=>`<button class="lane-key ${i%2?'low':''} ${t/s<.06?'start':t/s>.94?'end':''} ${on(kind,id)?'selected':''}" ${attr}="${id}" style="left:${t/s*100}%" aria-pressed="${on(kind,id)}" aria-label="${escape(name)} ${escape(detail)} at ${r2(t)} seconds" title="${escape(name)} · ${escape(detail)} · ${r2(t)}s (drag to retime)"><i style="background:${swatch}"></i><b>${escape(name)}</b><small>${escape(detail)} · ${r2(t)}s</small></button>`;
    const spans=(list,at,same)=>list.slice(1).map((k,i)=>same(list[i],k)?'':`<span class="lane-blend" style="left:${at(list[i])/s*100}%;width:${(at(k)-at(list[i]))/s*100}%" title="Blends ${r2(at(list[i]))} → ${r2(at(k))}s"></span>`).join('');
    const layers=L?stackRows(L.status.map(e=>({id:e.id,start:e.at,end:e.at+e.dur}))):null,status=L?`<div class="desk-lane-row ${layers.count>1?'layered':''}" data-lane-color="light" style="--rows:${layers.count}"><span class="desk-lane-label" title="The film's desk status lights">Desk status</span><div class="desk-lane light-lane" data-light-lane role="group" aria-label="Desk status lights timeline"><div class="desk-lane-line"></div>
      ${L.status.map(e=>`<button class="desk-clip light-clip ${on('lights',e.id)?'selected':''}" data-light-clip="${e.id}" style="${rowVar(layers,e.id)}left:${e.at/s*100}%;width:${e.dur/s*100}%;--lane:${lightKindColor(e.kind)}" aria-pressed="${on('lights',e.id)}" aria-label="Light state ${escape(kindLabel(e.kind))}, ${r2(e.at)} to ${r2(e.at+e.dur)} seconds" title="${escape(kindLabel(e.kind))} · ${r2(e.at)}–${r2(e.at+e.dur)}s · fade ${e.fade??1}s${e.fadeIn?` · fade in ${e.fadeIn}s`:''}"><span class="clip-resize" data-resize="start" title="Trim start"></span><strong>${escape(e.kind)}${e.kind==='wheels'&&e.mode?' '+e.mode:''}</strong><small>${r2(e.at)}–${r2(e.at+e.dur)}s</small><span class="clip-resize" data-resize="end" title="Trim end"></span></button>`).join('')}
      ${L.status.length?'':'<span class="desk-lane-empty">No light states · + Light adds one at the playhead</span>'}<div class="light-now" data-light-now></div><div class="camera-track-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div></div>
      `:'',white=L?`<div class="desk-lane-row" data-lane-color="white"><span class="desk-lane-label" title="The neutral white between status lights, over the chapter">Desk white<button data-action="light-key-add" class="lane-add" title="Add a white key at the playhead with the colour there" aria-label="Add a white key">+</button></span><div class="desk-lane key-lane white-lane" data-light-lane role="group" aria-label="Desk white over time"><div class="lane-band" style="background:linear-gradient(90deg,${band(t=>withWarmth('#d9d9d9',warmthOf(neutralAt(L.neutral,t))))})"></div>
      ${spans(L.neutral,k=>k[0],(a,b)=>a[1]===b[1])}${whiteLine(L,s)}${L.neutral.map((k,i)=>chip('neutrals','data-light-key',k[2],k[0],k[1],whiteName(k[1]),Math.round(lightnessOf(k[1]))+'% bright · '+k[1],i)).join('')}<div class="camera-track-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div></div>`:'';
    const label=m=>roomModes().find(x=>x.id===m)?.label||m;
    const tod=T?`<div class="desk-lane-row" data-lane-color="tod"><span class="desk-lane-label" title="The room's time of day: it blends from one daypart to the next">Time of day<button data-action="tod-add" class="lane-add" title="Add a time-of-day key at the playhead" aria-label="Add a time-of-day key">+</button></span><div class="desk-lane key-lane tod-lane" data-light-lane role="group" aria-label="Room time of day"><div class="lane-band" style="background:linear-gradient(90deg,${band(t=>daypartAt(T.keys,t))})"></div>
      ${spans(T.keys,k=>k.at,(a,b)=>a.mode===b.mode)}${T.keys.map((k,i)=>chip('tods','data-tod-key',k.id,k.at,DAYPART_TINTS[k.mode]||'#8899aa',label(k.mode),k.ease==='smooth'?'smooth blend':'blend',i)).join('')}<div class="camera-track-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div></div>`:'';
    // Room: brightness (solid) and fill light (dotted) over the chapter, log scale around ×1; drag a line up / down.
    const line=k=>Array.from({length:49},(_,i)=>{const t=i/48*s;return `${(i/48*1000).toFixed(1)},${(17-Math.log2(Math.max(.1,globalAt(k,t)))*10).toFixed(2)}`;}).join(' ');
    const room=filmShot()?`<div class="desk-lane-row" data-lane-color="room"><span class="desk-lane-label" title="Room brightness (solid) and fill light (dotted): drag a line up or down">Room</span><div class="desk-lane key-lane room-lane" data-light-lane><svg class="room-lines" viewBox="0 0 1000 34" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="1000" y1="17" y2="17" class="room-mid"/><polyline class="room-line room-exposure" points="${line('exposureScale')}"/><polyline class="room-line room-fill" points="${line('environmentScale')}"/><polyline class="room-hit fill-hit" data-room-line="environmentScale" points="${line('environmentScale')}"><title>Fill light ×${globalFactor('environmentScale').value.toFixed(2)} · drag up / down</title></polyline><polyline class="room-hit" data-room-line="exposureScale" points="${line('exposureScale')}"><title>Room brightness ×${globalFactor('exposureScale').value.toFixed(2)} · drag up / down (Alt: fill light)</title></polyline></svg><div class="camera-track-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div></div>`:'';
    lampsRowHtml=()=>{const lampList=sceneLights.lanes(),edited=lampList.filter(x=>x.edited);return `<div class="desk-lane-row ${edited.length?'':'empty'}" data-lane-color="lamps"><span class="desk-lane-label" title="Room lamps, sun and sky, film rig: edited lights show here">Lamps &amp; sun <small>${lampList.length}${edited.length?' · '+edited.length+' edited':''}</small></span><div class="desk-lane lamps-lane">${edited.map(x=>`<button class="lamp-chip ${x.selected?'selected':''}" data-action="lamp-pick" data-section="${escape(x.path)}" title="${escape(x.label)} · edited"><i style="background:${x.color}"></i>${escape(x.label)}</button>`).join('')}${sceneLights.editedCount()?'<button class="lamp-chip lamp-reset" data-action="sl-reset-all" title="Every light back to the film, added lights removed: one step, Undo brings them back">↺ Reset all lights to the film</button>':''}</div></div>`;};
    const lamps=filmShot()?lampsRowHtml():'';
    return `${laneGroupHead('lighting')}<div class="lane-group-body desk-lanes light-lanes" data-lane-body="lighting" ${groupClosed('lighting')?'hidden':''}>${tod}${room}${white}${status}${lamps}</div>`;
  }
  // Lane groups (MOTION, LIGHTING): collapsible, remembered in this browser; a collapsed group shows its items as ticks.
  let laneGroups={};try{laneGroups=JSON.parse(localStorage.getItem('ergoflex.director.laneGroups')||'{}')||{};}catch{}
  const groupClosed=g=>!!laneGroups[g];
  function laneGroupHead(g){
    const s=shot().seconds,L=lighting(),T=timeOfDay(),ticks=g==='graphics'?graphics.screens().map(sc=>sc.start??0):g==='motion'?[...keys().map(k=>k.time*s),...deskEditor.motion().clips.map(c=>c.start)]:g==='titles'?titleEditor.ticks():g==='sound'?(scoreModel()?.sfx||[]).map(x=>x.t):g==='props'||g==='people'?[]:[...(T?.keys||[]).map(k=>k.at),...(L?.neutral||[]).map(k=>k[0]),...(L?.status||[]).map(e=>e.at)];
    if(g==='lighting'&&!L&&!T)return '';if(g==='sound'&&!scoreModel())return '';if(g==='titles'&&!titleEditor.has())return '';if((g==='props'||g==='people')&&!filmShot())return '';
    return `<div class="lane-group-head" data-lane-group="${g}"><span class="desk-lane-label"><button data-action="group-toggle" data-index="${['motion','lighting','titles','props','people','graphics','sound'].indexOf(g)}" aria-expanded="${!groupClosed(g)}" title="${groupClosed(g)?'Show':'Hide'} the ${g} lanes${g==='lighting'?' (6 and 7 jump here)':''}">${groupClosed(g)?'▸':'▾'} ${g.toUpperCase()}</button></span><div class="lane-group-summary">${groupClosed(g)?ticks.map(t=>`<i style="left:${t/s*100}%"></i>`).join(''):''}</div></div>`;
  }
  // PROPS: the chapter's edited props as chips (hidden ones struck through), click one to select it.
  function propsGroup(){if(!filmShot())return '';return `${laneGroupHead('props')}<div class="lane-group-body desk-lanes prop-lanes" data-lane-body="props" ${groupClosed('props')?'hidden':''}>${propsLaneRow()}</div>`;}
  // PEOPLE: a group of its own, above PROPS (Vico, 2026-11-15: "people should have their own layer and not be part
  // also of the props, because it's already too many layers and stacked on top of the people"). The rows are the ones
  // that sat at the bottom of the Props group: who is on screen, then the keyframe sheet (S33: a row per character,
  // twirled open to its property rows; scene-people-editor.mjs trackRows).
  function peopleGroup(){if(!filmShot())return '';return `${laneGroupHead('people')}<div class="lane-group-body desk-lanes prop-lanes people-lanes" data-lane-body="people" ${groupClosed('people')?'hidden':''}><div class="desk-lane-row ${scenePeople.count()?'':'empty'}" data-lane-color="people" style="${peopleLaneStyle(4)}"><span class="desk-lane-label" title="The people in this chapter and the seconds each one is in the room (click a bar to select them)">People <small data-people-count>${scenePeople.count()||''}</small></span><div class="desk-lane people-lane" data-people-lane style="${peopleLaneStyle(0)}">${scenePeople.lane()}</div></div><div class="people-track-rows" data-people-track-rows>${scenePeople.trackRows()}</div></div>`;}
  // The Props lane: a bar per desk item, added prop and edited prop over the seconds it is on screen (scene-prop-editor.mjs
  // lane()); as tall as its rows, scrolling past nine.
  function propsLaneRow(){
    const html=sceneProps.lane(),bars=html.includes('prop-bar'),h=bars?sceneProps.laneHeight():0;
    return `<div class="desk-lane-row prop-bars-row ${bars?'':'empty'}" data-lane-color="props" ${h?`style="height:${h+4}px"`:''}><span class="desk-lane-label" title="The desk's items and every prop you added or changed, over the seconds each is on screen: click a bar to select it, drag its ends to set when it appears and leaves">Props <small data-props-count>${propCount()}</small></span><div class="desk-lane props-lane prop-bars-lane" data-props-lane ${h?`style="height:${h}px"`:''}>${html}</div></div>`;
  }
  // The desks of a chapter the film renders as sub-shots (the finale), with the cut's edits: [] elsewhere. Kept until
  // the film data or the edits change (the Props lane and the prop inspector ask on every render).
  let versionMemo=null;
  function deskVersionsNow(){
    const s=shot();if(!s)return [];const film=bridge.filmShot?.(s.id),subs=bridge.filmSubshots?.(s.id),key=JSON.stringify(s.deskVersions||null);
    if(versionMemo&&versionMemo.film===film&&versionMemo.subs===subs&&versionMemo.id===s.id&&versionMemo.key===key)return versionMemo.list;
    versionMemo={film,subs,id:s.id,key,list:film?deskVersionList(film,subs,s.deskVersions):[]};return versionMemo.list;
  }
  // The People lane grows with the people who are in the room at the same time (scene-people-editor.mjs lane()).
  const peopleLaneStyle=extra=>{const h=scenePeople.laneHeight();return h?`height:${h+extra}px`:'';};
  let peopleLaneFor=null;
  function sizePeopleLane(){
    const lane=timeline.querySelector('[data-people-lane]'),h=scenePeople.laneHeight();if(!lane)return;lane.style.height=h?h+'px':'';const row=lane.closest('.desk-lane-row');if(row)row.style.height=h?h+4+'px':'';
    // a newly selected person: their lane scrolls into the timeline's view (it is the last lane, often below the fold)
    const now=scenePeople.selected();if(now&&now!==peopleLaneFor&&row&&!row.closest('[hidden]'))row.scrollIntoView({block:'nearest'});peopleLaneFor=now;
  }
  function titlesGroup(){if(!titleEditor.has())return '';return `${laneGroupHead('titles')}<div class="lane-group-body desk-lanes title-lanes" data-lane-body="titles" ${groupClosed('titles')?'hidden':''}>${titleEditor.lane()}</div>`;}
  function revealLighting(){const v=timeline.querySelector('.timeline-viewport'),head=timeline.querySelector('[data-lane-group="lighting"]');if(!v||!head)return;if(groupClosed('lighting')){laneGroups.lighting=false;saveGroups();renderTimeline();return revealLighting();}const top=head.offsetTop-timeline.querySelector('.time-ruler-row').offsetHeight;if(top<v.scrollTop||top+head.parentElement.offsetHeight>v.scrollTop+v.clientHeight)v.scrollTop=top;}
  const ALL_GROUPS=['motion','lighting','titles','props','people','graphics','sound'];
  function setAllGroups(closed){for(const g of ALL_GROUPS)laneGroups[g]=closed;saveGroups();renderTimeline();status(closed?'Every lane group folded: } unfolds them.':'Every lane group unfolded.');}
  // Alt-click a group's twirl: fold or unfold every group (After Effects)
  timeline.addEventListener('click',event=>{const b=event.target.closest('[data-action="group-toggle"]');if(!b||!event.altKey)return;event.preventDefault();event.stopImmediatePropagation();setAllGroups(b.getAttribute('aria-expanded')==='true');},true);
  function saveGroups(){try{localStorage.setItem('ergoflex.director.laneGroups',JSON.stringify(laneGroups));}catch{}}
  // Fit: the timeline tall enough for every lane (capped by the layout); film chapters open fitted.
  let timelineFitted=false;
  function fitTimeline(){
    const v=timeline.querySelector('.timeline-viewport');if(!v)return;const Z=uiScale(),need=timeline.getBoundingClientRect().height+(v.scrollHeight-v.clientHeight)*Z+2;
    // half the window; a little more of a short one (the lanes of a film chapter did not fit in half of a 1080p window)
    resizeTimeline(Math.min(need,innerHeight*(innerHeight<=1150?.54:.5)));timelineFitted=true;
  }
  // Brightness of the desk white over the chapter as a line in the lane (L*, top = 100 %).
  function whiteLine(L,s){const pts=Array.from({length:49},(_,i)=>{const t=i/48*s;return `${(i/48*1000).toFixed(1)},${(30-lightnessOf(neutralAt(L.neutral,t))/100*26).toFixed(2)}`;}).join(' ');return `<svg class="white-line" viewBox="0 0 1000 34" preserveAspectRatio="none" aria-hidden="true"><polyline class="under" points="${pts}"/><polyline points="${pts}"/></svg>`;}
  function syncLightNow(){const bar=timeline.querySelector('[data-light-now]'),L=bar&&lighting();if(!L)return;bar.style.left=playhead*100+'%';bar.style.background=lightAt(L,playhead*shot().seconds);}
  // The Lighting tab, broad to narrow in lane order: Lighting now, Time of day, Room, Desk white, Desk status,
  // Lamps & sun. Each section edits one thing; the lanes are the picker.
  let lightSectionsShut={};try{lightSectionsShut=JSON.parse(localStorage.getItem('ergoflex.director.lightSections')||'{}')||{};}catch{}
  const section=(id,title,tag,body)=>`<details class="light-section" data-light-section="${id}" ${lightSectionsShut[id]?'':'open'}><summary><span>${title}</span>${tag?`<small>${tag}</small>`:''}</summary><div class="light-section-body">${body}</div></details>`;
  function lightPanel(){
    const L=lighting(),T=timeOfDay(),item=lightItem(),s=shot().seconds,kind=lightSel?.kind;
    const tod=T?section('tod','Time of day','the sun and sky through the window',`<p class="director-hint">The room blends from each daypart to the next across the gaps.${T.edited?'':' From the film shot until you edit it.'}</p><div class="director-actions"><button data-action="tod-add">+ Time-of-day key</button></div>${kind==='tods'&&item?todInspector(T,item):''}`):'';
    // roomLight scales the room's own lamps, sky fill and bounce (film-fx), not the desk's LEDs: those are the two LED glow fields.
    const room=section('room','Room','brightness, fill light, LED glow on walls and floor',`${globalFields(['exposureScale','environmentScale'])}${L?.roomLight!==undefined?`<label title="The room's lamps, sky fill and bounce light (not the desk's LEDs)">Room's own light (lamps, sky, bounce)<input name="room-light" type="number" min="0" max="2" step=".05" value="${L.roomLight}"></label>`:''}${globalFields(['ledWallGlow','ledFloorGlow'])}${floorRefl.panel()}`);
    if(!L)return nowCard()+tod+room+lampsSection();
    const white=section('white','Desk white','the LED colour when no status is showing',`<div class="director-actions"><button data-action="light-key-add">+ White key</button></div>${kind==='neutrals'&&item?whiteInspector(L,item,s):''}`);
    const status=section('status','Desk status','status lights while the desk moves',`<p class="director-hint">${L.edited?'Edited here; Export cut sends them to the film.':'From the film shot; your first edit keeps a copy in this cut.'}</p><div class="director-actions"><button data-action="light-add">+ Status light</button></div>${kind==='lights'&&item?statusInspector(item,s):''}`);
    return nowCard()+tod+room+white+status+lampsSection();
  }
  const lampsSection=()=>section('lamps','Lamps & sun','room lamps, sun and sky, film rig',`<div data-scene-lights>${sceneLights.panel()}</div>`);
  function statusInspector(e,s){return `<div class="movement-inspector light-inspector"><h4 style="--lane:${lightKindColor(e.kind)}">Status light</h4>
      <label>State<select name="light-kind">${LIGHT_KINDS.map(([id,label])=>option(id,label,e.kind)).join('')}</select></label>
      ${e.kind==='wheels'?`<label>Drive mode<select name="light-mode">${WHEEL_MODES.map((label,i)=>option(String(i+1),`${i+1} · ${label}`,String(e.mode??3))).join('')}</select></label>`:''}
      <div class="director-grid"><label>Start (seconds)<input name="light-at" type="number" min="0" max="${s}" step=".05" value="${r2(e.at)}"></label><label>Duration (seconds)<input name="light-dur" type="number" min=".05" max="${s}" step=".05" value="${r2(e.dur)}"></label></div>
      <div class="director-grid"><label title="How long the white takes to give way to the state">Fade in (seconds)<input name="light-fadein" type="number" min="0" max="10" step=".05" value="${e.fadeIn??0}"></label><label title="How long the strip takes to go back to the white">Fade out (seconds)<input name="light-fade" type="number" min="0" max="10" step=".05" value="${e.fade??1}"></label></div>
      <div class="director-actions"><button data-action="light-delete">Delete status light</button></div></div>`;}
  function whiteInspector(L,k,s){return `<div class="movement-inspector light-inspector"><h4>White key · ${escape(whiteName(k[1]))}</h4>
      <label>Time (seconds)<input name="neutral-time" type="number" min="0" max="${s}" step=".05" value="${r2(k[0])}"></label>
      <div class="white-presets">${WHITE_PRESETS.map(([name,hex])=>`<button data-action="white-preset" data-section="${hex}" aria-pressed="${k[1]===hex}" title="${name} ${hex}"><i style="background:${hex}"></i>${name}</button>`).join('')}</div>
      <label>Brightness <output data-neutral-bright>${Math.round(lightnessOf(k[1]))}%</output><span class="global-slider"><input name="neutral-bright" type="range" min="0" max="100" step="1" value="${Math.round(lightnessOf(k[1]))}" data-base="${k[1]}"><input name="neutral-bright-n" type="number" min="0" max="100" step="1" value="${Math.round(lightnessOf(k[1]))}"></span></label>
      <label>Warmth <small>(0 true white · 100 sunset warm)</small> <output data-neutral-warm>${Math.round(warmthOf(k[1])*100)}%</output><input name="neutral-warm" type="range" min="0" max="1" step=".01" value="${warmthOf(k[1]).toFixed(2)}" data-base="${k[1]}"></label>
      <details class="light-details"><summary>More</summary><div class="director-grid neutral-colour"><label>Colour<input name="neutral-color" type="color" value="${k[1]}"></label><label>Hex<input name="neutral-hex" maxlength="7" value="${k[1]}" spellcheck="false"></label></div></details>
      <div class="director-actions"><button data-action="light-delete" ${L.neutral.length<=1?'disabled title="The desk white needs at least one key"':''}>Delete white key</button></div></div>`;}
  function todInspector(T,item){const modes=roomModes(),s=shot().seconds;return `<div class="movement-inspector"><h4>Time-of-day key</h4>
      <div class="director-grid"><label>Time (seconds)<input name="tod-time" type="number" min="0" max="${s}" step=".05" value="${r2(item.at)}"></label><label>Daypart<select name="tod-mode">${modes.map(m=>option(m.id,m.label,item.mode)).join('')}${modes.some(m=>m.id===item.mode)?'':option(item.mode,item.mode,item.mode)}</select></label></div>
      <label>Blend into this daypart<select name="tod-ease">${option('linear','Even',item.ease||'linear')}${option('smooth','Smooth (ease in and out)',item.ease||'linear')}</select></label>
      <div class="director-actions"><button data-action="light-delete" ${T.keys.length<=1?'disabled':''}>Delete time-of-day key</button></div></div>`;}
  // "Lighting now": what lights the frame at the playhead, one row per section (click to go there).
  function globalAt(k,t){const own=shot().sceneGlobals?.[k],f=filmShot()?.sceneGlobals?.[k],v=own??f;if(Array.isArray(v)){const i=v.findIndex(p=>p[0]>t);return i<0?v.at(-1)[1]:i===0?v[0][1]:v[i-1][1]+(v[i][1]-v[i-1][1])*(t-v[i-1][0])/(v[i][0]-v[i-1][0]);}return typeof v==='number'?v:1;}
  function nowRows(){
    const t=playhead*shot().seconds,L=lighting(),T=timeOfDay(),rows=[],label=m=>roomModes().find(x=>x.id===m)?.label||m;
    if(T){const keys=[...T.keys].sort((a,b)=>a.at-b.at),i=keys.findIndex(k=>k.at>t);let text;if(i<0)text=label(keys.at(-1).mode);else if(i===0)text=label(keys[0].mode);else{const a=keys[i-1],b=keys[i];text=a.mode===b.mode?label(a.mode):`${label(a.mode)} → ${label(b.mode)} ${Math.round((t-a.at)/(b.at-a.at)*100)}%`;}rows.push(['tod','Time of day',text,daypartAt(T.keys,t)]);}
    rows.push(['room','Room brightness','×'+globalAt('exposureScale',t).toFixed(2)],['room','Fill light','×'+globalAt('environmentScale',t).toFixed(2)]);
    if(L){const e=L.status.find(e=>t>=e.at&&t<e.at+e.dur),c=e?lightKindColor(e.kind):neutralAt(L.neutral,t);rows.push([e?'status':'white','Desk strip',e?kindLabel(e.kind):whiteName(c)+' '+c,c]);if(L.roomLight!==undefined)rows.push(['room',"Room's own light",String(L.roomLight)]);}
    rows.push(['room','LED glow on the walls','×'+globalAt('ledWallGlow',t).toFixed(2)],['room','LED glow on the floor','×'+globalAt('ledFloorGlow',t).toFixed(2)]);
    const sum=sceneLights.summary();if(sum)rows.push(['lamps','Lamps & sun',sum]);
    return rows;
  }
  function nowCard(){return `<div class="lighting-now" data-lighting-now>${nowInner()}</div>`;}
  function nowInner(){return `<div class="lighting-now-head">LIGHTING NOW · ${(playhead*shot().seconds).toFixed(2)} s</div>${nowRows().map(([id,name,value,swatch])=>`<button class="now-row" data-action="now-go" data-section="${id}"><span>${name}</span><b>${swatch?`<i style="background:${swatch}"></i>`:''}${escape(value)}</b></button>`).join('')}`;}
  function syncNow(){const box=panel.querySelector('[data-lighting-now]');if(box&&!box.closest('[hidden]'))box.innerHTML=nowInner();}
  // Room brightness (exposureScale) and ambient light (environmentScale): the film's value until touched.
  // Keyed values ([[t, v], …]) are edited as one factor on the film's keys and written back scaled.
  // LED glow on the walls / floor: the desk's LED light in the room x the film's approved level (film-fx ledWallGlow / ledFloorGlow).
  const GLOBALS={exposureScale:['Room brightness',.5,2],environmentScale:['Fill light (soft light from everywhere)',.2,3],
    ledWallGlow:['LED glow on the walls',0,4,"The desk's LED light on the walls and furniture nearby; ×1 is the film's look"],
    ledFloorGlow:['LED glow on the floor',0,4,"The desk's LED light on the floor and rugs (its reflection under the desk); ×1 is the film's look"]};
  function globalFactor(k){
    const own=shot().sceneGlobals?.[k],film=filmShot()?.sceneGlobals?.[k];
    if(Array.isArray(film)){if(!Array.isArray(own)||own.length!==film.length)return {keys:film,value:1};const i=film.findIndex(p=>p[1]);return {keys:film,value:i<0?1:own[i][1]/film[i][1]};}
    if(Array.isArray(own))return {keys:own,value:1};
    return {value:typeof own==='number'?own:typeof film==='number'?film:1};
  }
  const stepsText=v=>{const n=Number((Math.log(v)/Math.log(1.11)).toFixed(1));return (n>0?'+':'')+n+' step'+(Math.abs(n)===1?'':'s')+' of ×1.11';};
  function globalFields(keys=Object.keys(GLOBALS)){
    return keys.map(k=>[k,GLOBALS[k]]).map(([k,[label,min,max,tip]])=>{const f=globalFactor(k),v=Number(f.value.toFixed(3));
      return `<label${tip?` title="${escape(tip)}"`:''}>${label}${f.keys?` <small>(keyed: scales all ${f.keys.length} keys)</small>`:''} <output data-global-steps="${k}">${k==='exposureScale'?stepsText(v):'×'+v}</output><span class="global-slider"><input type="range" name="g-${k}" min="${min}" max="${max}" step=".01" value="${v}"><input type="number" name="gn-${k}" min="${min}" max="${max}" step=".01" value="${v}"></span></label>`;}).join('');
  }
  function setGlobal(k,v,{key=null,render=true}={}){
    const [label,min,max]=GLOBALS[k];if(!Number.isFinite(v)||v<min||v>max)throw Error(`${label} runs from ${min} to ${max}.`);requireReady();
    const f=globalFactor(k),r=x=>Math.round(x*10000)/10000;
    commit(()=>{const s=shot();s.sceneGlobals={...s.sceneGlobals,[k]:f.keys?f.keys.map(([t,x])=>[t,r(x*v)]):r(v)};},{render,key});
    status(`${label} ${f.keys?'×'+v+' on every key':'set to '+v}${k==='exposureScale'?' ('+stepsText(v)+')':''}. Render still shows the film look.`);
  }
  // One light item changed: states stay one at a time, colour keys stay sorted.
  function editLight(change,{key=null,render=true}={}){
    const L=lighting(),item=lightItem();if(!item)return;
    if(lightSel.kind==='lights')putLighting({status:L.status.map(e=>e.id===item.id?{...e,...change}:e)},{key,render});
    else{const next=[change.time??item[0],change.color??item[1],item[2]];if(L.neutral.some(k=>k[2]!==item[2]&&Math.abs(k[0]-next[0])<.001))throw Error('There is already a colour key at that time.');putLighting({neutral:L.neutral.map(k=>k[2]===item[2]?next:k)},{key,render});}
  }
  function addLight(neutral){
    const L=lighting();if(!L)return;requireReady();const s=shot().seconds,t=Math.round(playhead*s*1000)/1000;
    if(neutral){
      const near=L.neutral.find(k=>Math.abs(k[0]-t)<.001);if(near){selectLight('neutrals',near[2]);return;}
      const k=[t,neutralAt(L.neutral,t),crypto.randomUUID()];putLighting({neutral:[...L.neutral,k]});selectLight('neutrals',k[2]);status('Colour key added at '+r2(t)+'s. Set its colour, brightness and warmth in Lighting.');return;
    }
    let space=planClipInsertion(L.status.map(e=>({lane:'light',start:e.at,duration:e.dur})),'light',t,s,3);if(!space)throw Error('The lighting lane is full. Shorten a light state first.');
    // A light state never lengthens the chapter: it takes the free stretch that is there (at least 0.3 s), or is refused.
    if(space.seconds>s+1e-9){const room=Math.floor((s-space.start)*1000)/1000;if(room<.3)throw Error(`There is no free stretch for another light state after ${r2(space.start)} s: the desk shows one state at a time. Shorten a state, or move the playhead to a gap.`);space={...space,duration:room,seconds:s};}
    const e={id:crypto.randomUUID(),at:Math.round(space.start*1000)/1000,dur:Math.round(space.duration*1000)/1000,kind:'lift-up',fade:1,fadeIn:.6};
    if(space.seconds>s+1e-9){resizeChapter(space.seconds,{message:'Light state added at '+e.at.toFixed(1)+'s',at:e.at,apply:()=>writeLighting(L,{status:[...L.status,e]})});selectLight('lights',e.id);return;}
    putLighting({status:[...L.status,e]});selectLight('lights',e.id);status('Light state added at '+r2(e.at)+'s. Choose its state and fades in Lighting.');
  }
  // Scene lights (room lamps, sun / sky, film rig, added lights) live in their own module.
  function renderSceneLights(){
    const box=panel.querySelector('[data-scene-lights]');if(!box)return;const active=box.contains(document.activeElement)?document.activeElement.name:null;
    syncLightTools?.();box.innerHTML=sceneLights.panel();{const row=timeline.querySelector('[data-lane-color=lamps]');if(row&&filmShot())row.outerHTML=lampsRowHtml();}if(active)box.querySelector(`[name="${active}"]`)?.focus({preventScroll:true});repulse();
  }
  const sceneLights=createSceneLightEditor({bridge,shot,film:filmShot,commit,status,open:()=>open,rerender:renderSceneLights,
    onSelect:()=>{const had=picked()||lightSel||keyId||deskEditor.selectedId()||titleEditor.selectedId()||sceneProps.selected();for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;deskEditor.clearSelection();titleEditor.clear();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();if(had)renderTimeline();syncSelectedHeader();reveal('light');}});
  // Props (scene-prop-editor.mjs): click a prop in the view, gizmo, Props tab, Props lane; per chapter only.
  function renderSceneProps(soft=false){
    const box=panel.querySelector('[data-scene-props]');if(box&&!(soft&&typing())){const active=box.contains(document.activeElement)?document.activeElement.name:null;box.innerHTML=sceneProps.panel();if(active)box.querySelector(`[name="${active}"]`)?.focus({preventScroll:true});}
    const lane=timeline.querySelector('[data-props-lane]');if(lane){const html=sceneProps.lane(),bars=html.includes('prop-bar'),h=bars?sceneProps.laneHeight():0,row=lane.closest('.desk-lane-row'),top=lane.scrollTop;
      lane.innerHTML=html;lane.style.height=h?h+'px':'';lane.scrollTop=top;if(row){row.style.height=h?h+4+'px':'';row.classList.toggle('empty',!bars);}const n=timeline.querySelector('[data-props-count]');if(n)n.textContent=propCount();}
    syncLightTools?.();syncSelectedHeader();renderLayers();repulse();
  }
  // Branding (branding-editor.mjs): the school stickers / logos, one edit for every desk of the room; per chapter only.
  function renderBranding(soft=false){
    const box=panel.querySelector('[data-scene-branding]');if(!box||(soft&&typing()))return;
    const active=box.contains(document.activeElement)?document.activeElement.name:null;box.innerHTML=branding.panel();branding.mount(box);
    if(active)box.querySelector(`[name="${active}"]`)?.focus({preventScroll:true});repulse();
  }
  const branding=createBrandingEditor({bridge,shot,film:filmShot,commit,status,open:()=>open,rerender:renderBranding,selection:()=>deskSel.selected()});
  const propCount=()=>{const n=sceneProps.editedCount();return n?n+' edited':'';};
  // Make permanent: Studio holds these props now, so this chapter's edits for them go (here and in the undo history,
  // so Undo never stacks them on Studio's new placement).
  function foldProps(keys){
    const id=shot().id,film=filmShot(),drop=p=>{for(const s of p.shots){if(s.id!==id)continue;const list=s.propEdits??(filmPropEdits(film).some(e=>keys.has(propKey(e)))?filmPropEdits(film):null);if(list)s.propEdits=list.filter(e=>!keys.has(propKey(e)));}};
    drop(project);for(const p of [...undo,...redo])drop(p);changed();render();
  }
  const sceneProps=createScenePropEditor({bridge,shot,film:filmShot,commit,status,open:()=>open,rerender:renderSceneProps,roomDesk:p=>openRoomDeskFromProps(p),lightsShowing:()=>sceneLights.showing(),fold:foldProps,person:o=>scenePeople.pickObject(o),blocked:()=>!!scenePeople.posing(),
    scope:()=>{const s=shot();return s&&deskVersionsNow().length?bridge.deskVersion?.(s.id)||null:null;},versions:deskVersionsNow,seconds:()=>shot()?.seconds||0,time:()=>playhead*(shot()?.seconds||0),seek:t=>seekCamera(t/(shot()?.seconds||1)),
    onSelect:()=>{for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;deskEditor.clearSelection();titleEditor.clear();sceneLights.deselect();deskSel.deselect();renderTimeline();renderSceneProps();if(inspector!=='layers')reveal('prop');}});
  // People (scene-people-editor.mjs): the chapter's cast; click a person in the view, gizmo, People tab; per chapter only.
  function renderPeople(soft=false){
    const box=panel.querySelector('[data-scene-people]');if(box&&!(soft&&typing())){const active=box.contains(document.activeElement)?document.activeElement.name:null,top=box.closest('.director-scroll,[data-inspector-page]')?.scrollTop;box.innerHTML=filmShot()?scenePeople.panel():'';if(active)box.querySelector(`[name="${active}"]`)?.focus({preventScroll:true});}
    const trackRows=timeline.querySelector('[data-people-track-rows]');if(trackRows)trackRows.innerHTML=scenePeople.trackRows();
    const lane=timeline.querySelector('[data-people-lane]');if(lane){lane.innerHTML=scenePeople.lane();const n=timeline.querySelector('[data-people-count]');if(n)n.textContent=scenePeople.count()||'';lane.closest('.desk-lane-row')?.classList.toggle('empty',!scenePeople.count());sizePeopleLane();}
    syncSelectedHeader();
  }
  const scenePeople=createScenePeopleEditor({bridge,shot,film:filmShot,commit,status,open:()=>open,rerender:()=>renderPeople(),time:()=>playhead*shot().seconds,seek:t=>seekCamera(t/(shot()?.seconds||1)),lightsShowing:()=>sceneLights.showing(),snap:(t,o)=>snapTime(t,o),
    onSelect:()=>{for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;deskEditor.clearSelection();titleEditor.clear();sceneLights.deselect();sceneProps.deselect();deskSel.deselect();renderTimeline();reveal('person');}});
  // Layers (layers-panel.mjs): the chapter's props and desk items as an outliner, named layers (select, hide, lock); shot.propLayers.
  // The Studio's show / hide (Layers phase 3; ?layers=0 or localStorage 'ergoflex.layers.ui' = '0': the tab as before):
  // what the Studio hides at this chapter's time and size, read from this page's copy of the shared key. Never the stage's.
  const stageLayout=()=>{try{return document.getElementById('stage')?.contentWindow?.ErgoFlex?.workspaceRoom?.roomLayout?.id||null;}catch{return null;}};
  const stageFeatured=()=>{try{return document.getElementById('stage')?.contentWindow?.ErgoFlex?.sceneDesks?.selected||'main';}catch{return 'main';}};
  // A room desk's eye: the desk edit, its chair and props as prop hide edits, its user out of the cast: one undo step.
  function layersHideDesk(item,stationId,hide){
    const s=shot(),f=filmShot();if(!s)return;
    // The cast a hide works on: the chapter's own people edits when they are the film's whole people object (v: 2, as the
    // People tab writes them), else the FILM's people verbatim as v: 2 (people-edits.mjs). Never the stage's resolved
    // cast: that is where each person stands now, without their walk, roll, actions or seat, and writing it as the
    // chapter's cast froze everyone who moves (Vico's high school draft, 2026-11-15: Kai stopped rolling, Noah walking).
    // A chapter that already has the older cast (no v) keeps it. A room person who is not in the film's cast (they come
    // from the room, by the film's only / except lists) is not touched here.
    const own=s.peopleEdits,fp=f?.people,seed=own?.v===2?own:(!own&&fp&&typeof fp==='object'&&!Array.isArray(fp)&&Array.isArray(fp.cast)?{v:2,...structuredClone(fp)}:studioSync.peopleSeed?.()||{cast:[]}),plan=deskHidePlan({stationId,hide,featured:stageFeatured(),items:sceneProps.items(),deskEdits:effectiveDeskEdits(f,s),propEdits:layersPropEdits(f,s),cast:seed.cast||[]});
    if(!plan.ok){status(plan.why,true);return;}
    // v2 (the film's own people, verbatim): a user of that desk who is one of the ROOM's own people (not in the cast) is
    // taken out with the film's `except` (or `only`), as the film itself does; nobody else is touched.
    let roomOnly=null;
    if(seed.v===2){
      const keys=new Set((seed.cast||[]).map(e=>e.key||e.id)),live=(()=>{try{return document.getElementById('stage')?.contentWindow?.ErgoFlex?.workspaceRoom?.people?.resolved?.()||[];}catch{return [];}})();
      const mine=live.filter(p=>p.station===stationId&&!keys.has(p.key)).map(p=>p.key);
      if(mine.length){
        roomOnly={except:Array.isArray(seed.except)?[...seed.except]:seed.only?null:[],only:Array.isArray(seed.only)?[...seed.only]:null};
        const filmExcept=Array.isArray(fp?.except)?fp.except:[],filmOnly=Array.isArray(fp?.only)?fp.only:null;   // (Show takes back only what a hide here added: the film's own lists stay)
        for(const k of mine){if(roomOnly.except){const has=roomOnly.except.includes(k);if(hide&&!has)roomOnly.except.push(k);if(!hide&&has&&!filmExcept.includes(k))roomOnly.except=roomOnly.except.filter(x=>x!==k);}
          if(roomOnly.only){const has=roomOnly.only.includes(k);if(!hide&&!has&&(!filmOnly||filmOnly.includes(k)))roomOnly.only.push(k);if(hide&&has)roomOnly.only=roomOnly.only.filter(x=>x!==k);}}
        plan.users.push(...mine);
      }
    }
    commit(()=>{const x=shot();x.deskEdits=plan.deskEdits;x.propEdits=plan.propEdits;if(plan.cast||roomOnly){const next={...seed,cast:plan.cast||seed.cast};if(roomOnly?.except)next.except=roomOnly.except;if(roomOnly?.only)next.only=roomOnly.only;const people=layersCleanPeople(next);if(people)x.peopleEdits=people;}},{render:true});
    status(`${hide?'Hid':'Showed'} ${item.name.replace(/ · ErgoFlex desk$/,'')}${plan.belongings.length?' with '+plan.belongings.length+' thing'+(plan.belongings.length===1?'':'s')+' of its own':''}${plan.users.length?' and '+plan.users.join(', '):''} in this chapter.${plan.unnamed.length?' Not on the stage (left as they are): '+plan.unnamed.join(', ')+'.':''} One Undo brings ${hide?'them back':'the hide back'}.`);
  }
  const layersStudio={on:()=>layersOn(),setting:()=>chapterSetting(shot()),featured:stageFeatured,hideDesk:layersHideDesk,
    hiddenHere:()=>{try{const s=shot();return s?studioHiddenHere(localStorage.getItem(LAYERS_KEY),s,chapterRooms(s,stageLayout()),sceneProps.items()):new Map();}catch(error){console.warn('[layers]',error);return new Map();}}};
  const graphics=createGraphicsEditor({panel,timeline,shot,filmShot,showInspector,renderPanel,renderTimeline,status,commit,groupHead:laneGroupHead,groupClosed,time:()=>playhead,snapStep:()=>numStep(),magnet:()=>magnet});
  const layers=createLayersPanel({root:panel,shot,commit,status,props:sceneProps,rerender:()=>renderLayers(),studio:layersStudio});
  function renderLayers(){
    const box=panel.querySelector('[data-scene-layers]');if(!box||inspector!=='layers')return;
    const active=box.contains(document.activeElement)?document.activeElement.name:null;if(active==='ly-search'&&typing())return;
    box.innerHTML=layers.panel();if(active)box.querySelector(`[name="${active}"]`)?.focus({preventScroll:true});syncSelection();
  }
  // Desks (scene-desk-editor.mjs): every other ErgoFlex desk in the room: the Desks tab, a click in the view, size / place / start; per chapter only.
  function renderSceneDesks(soft=false){
    const box=panel.querySelector('[data-scene-desks]');if(box&&!(soft&&typing())){const active=box.contains(document.activeElement)?document.activeElement.name:null;box.innerHTML=deskSel.panel();if(active)box.querySelector(`[name="${active}"]`)?.focus({preventScroll:true});}
    syncSelectedHeader();repulse();
  }
  // The ONE place a room desk selection arrives (Desks list, click on a desk in the view, Esc, empty click, Featured desk):
  // id = the api.sceneDesks record id, null = back to the featured desk. Add `choreo.pick(id)` on the marked line.
  // ---- S32: a room desk has ONE owner, the Desks editor (Vico, Nov 15: a room desk moved in the Props tab carried a prop
  // offset on top of its desk edit; the two fought and the desk landed elsewhere). The Props tab hands a room desk to the
  // Desks tab, and a chapter that still has prop moves / turns / hides on room desks gets them folded into those desks'
  // desk edits when it opens (one undo step): the desk stays exactly where it stands.
  const STATION=/:station:([a-z0-9][a-z0-9-]*)$/i;
  const stageDesks=()=>{try{return document.getElementById('stage')?.contentWindow?.ErgoFlex?.sceneDesks||null;}catch{return null;}};
  // The room desk (scene desk record) a prop edit or a picked object stands for: its asset key names the station, or its
  // match is the desk group's name, or the object is (inside) that group. Never the featured desk.
  function roomDeskOf({obj=null,edit=null}={}){
    const sd=stageDesks(),recs=[...(sd?.records?.values()||[])],featured=sd?.selected??null;if(!recs.length)return null;
    const st=String(edit?.asset||obj?.userData?.sceneAssetKey||'').match(STATION),byId=st?recs.find(r=>r.id==='station-'+st[1]):null;
    let r=byId;
    if(!r&&edit?.match&&/· ErgoFlex desk\$$/.test(edit.match)){try{const re=new RegExp(edit.match,'i');r=recs.find(x=>re.test(x.group?.name||''));}catch{}}
    if(!r&&obj)for(let o=obj;o&&!r;o=o.parent)r=recs.find(x=>x.group===o)||null;
    return r&&r.id!==featured?r:null;
  }
  function openRoomDeskFromProps(p){
    const r=roomDeskOf(p);if(!r)return false;
    sceneProps.deselect?.();deskSel.select(r.id,{announce:false});reveal('desk');
    status(`${r.state?.name||'This desk'} is a room desk: it is moved, turned and hidden in the Desks tab (the round handle, the arrows, the ring, Hide desk).`);
    return true;
  }
  const foldedDesks=new Set();
  function foldDeskProps(){
    const s=shot(),f=filmShot(),sd=stageDesks();if(!open||!s||!f||!sd?.records?.size)return;
    const key=project.id+'|'+s.id;if(foldedDesks.has(key))return;
    const props=layersPropEdits(f,s)||[],hits=props.map(e=>[e,roomDeskOf({edit:e})]).filter(([e,r])=>r&&!e.add);
    foldedDesks.add(key);if(!hits.length)return;
    const desks=effectiveDeskEdits(f,s),notes=[],names=[];
    for(const [e,r] of hits){
      const i=desks.findIndex(d=>d.desk===r.id),ed={...(i>=0?desks[i]:{desk:r.id,name:r.state?.name||'ErgoFlex desk'})};
      // where it stands now (its pose with the prop offset and turn on top): that becomes the desk's own place
      if(e.position||(e.rotation&&Math.abs(e.rotation[1]||0)>1e-6)){const g=r.group;ed.pose={x:Math.round(g.position.x*10)/10,z:Math.round(g.position.z*10)/10,yaw:Math.round(g.rotation.y*1e4)/1e4};}
      if(e.rotation&&(Math.abs(e.rotation[0]||0)>1e-6||Math.abs(e.rotation[2]||0)>1e-6))notes.push(`${r.state?.name||r.id}: its tilt (${[e.rotation[0],e.rotation[2]].map(v=>Math.round((v||0)*10)/10).join(' / ')}°) is dropped`);
      if(e.scale&&e.scale.some(v=>Math.abs(v-1)>1e-4))notes.push(`${r.state?.name||r.id}: its scale is dropped`);
      if(e.hide===true)ed.hide=true;
      const clean=cleanDeskEdit(ed);if(clean){if(i>=0)desks[i]=clean;else desks.push(clean);}names.push(r.state?.name||r.id);
    }
    const rest=props.filter(e=>!hits.some(([h])=>h===e));
    commit(()=>{const x=shot();x.deskEdits=desks;x.propEdits=rest;},{render:true});
    status(`Room desks are edited in the Desks tab now: the Props-tab move${hits.length===1?'':'s'} of ${[...new Set(names)].join(', ')} became ${hits.length===1?'its':'their'} desk edit${hits.length===1?'':'s'}, ${hits.length===1?'it stays':'they stay'} where ${hits.length===1?'it stands':'they stand'}${notes.length?' ('+notes.join('; ')+')':''}. Undo puts it back.`);
  }
  function selectRoomDesk(id){
    // One selection drives everything: the Groove timeline (every room desk has its own Lift / Tilt lanes), the Build tab's desk and the
    // Branding tab's shown desk read deskSel.selected() (null = the featured desk) through their `selection` options.
    choreo.pick(id||null);   // re-renders the panel and timeline when the desk changed
  }
  const deskSel=createSceneDeskEditor({bridge,onPick:selectRoomDesk,shot,film:filmShot,commit,status,open:()=>open,rerender:renderSceneDesks,lightsShowing:()=>sceneLights.showing(),
    inTab:()=>inspector==='desks'&&!document.body.classList.contains('inspector-hidden'),showFeatured:()=>showInspector('groove'),
    toggleVisibility:(id,hide,name)=>layersHideDesk({name},id.slice('station-'.length),hide),
    onSelect:()=>{for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;deskEditor.clearSelection();titleEditor.clear();sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();renderTimeline();reveal('desk');}});
  // Floor reflections (floor-reflection-editor.mjs): Lighting > Room, per LED source; outlines and drags in the view.
  const floorShowing=()=>open&&(sceneLights.showing()||inspector==='lighting'&&!document.body.classList.contains('inspector-hidden')&&!!panel.querySelector('[data-light-section="room"]')?.open&&!!panel.querySelector('[data-floor-section]')?.open);
  const floorRefl=createFloorReflectionEditor({bridge,shot,film:filmShot,commit,status,visible:floorShowing,rerender:()=>{if(inspector==='lighting'&&!typing())renderPanel();else syncSelectedHeader();},
    onSelect:()=>{for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;deskEditor.clearSelection();titleEditor.clear();sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();delete lightSectionsShut.room;const r=panel.querySelector('[data-light-section="room"]');if(r)r.open=true;renderTimeline();reveal('floor');}});
  // B2: a timeline row's name selects what the row stands for (a People sheet character, an "Other desks" row).
  timeline.addEventListener('click',event=>{
    const label=event.target.closest?.('.desk-lane-label');if(!label||event.target.closest('button,select,input'))return;
    const row=label.closest('[data-person-keys],[data-choreo-row]');if(!row)return;
    if(row.dataset.personKeys){const keys=row.dataset.personKeys.split(' ').filter(Boolean);if(keys.length&&!keys.includes(scenePeople.selected()))scenePeople.select(keys[0]);return;}
    const id=row.dataset.choreoRow;if(id)deskSel.select(id);else deskSel.deselect();
  });
  panel.addEventListener('toggle',event=>{if(event.target.matches?.('[data-floor-section]'))floorRefl.setExpanded(event.target.open);},true);
  // Render still: the playhead frame with the film look, rendered in a hidden stage of its own.
  // Render still: the playhead frame with the film look, shown inside the frame with a history strip.
  const still=createStillStrip();
  let bootMs=7000;try{bootMs=Number(localStorage.getItem('ergoflex.director.stillBootMs'))||7000;}catch{}
  // What changed since the previous still: edits added to the undo stack since then, else edits undone,
  // else (an edit outside undo) the project diff; nothing at all when the project is the same.
  const SHOT_FIELDS={camera:'camera views',motion:'desk moves',timeOfDay:'time of day',ledStatus:'desk status lights',ledNeutral:'desk white',ledColor:'desk colour',lighting:'lighting',sceneGlobals:'room brightness and fill light',sceneLights:'scene lights',lightEdits:'scene lights',lights:'scene lights',propEdits:'props',peopleEdits:'people',propLayers:'layers',brandingEdits:'branding',deskEdits:'desks',deskBuild:'desk build',deskVersions:'desk versions',screens:'screen graphics',filmTitles:'film titles',seconds:'chapter length',title:'chapter title',room:'room',layout:'layout',preset:'desk preset',kind:'shot kind',length:'length',mode:'mode',size:'desk size'};
  function listDiff(a=[],b=[],noun,at,fmt){
    if(b.length>a.length)return `${noun} added`+(at?` at ${fmt(at(b.find(x=>!a.some(y=>y.id===x.id))||b.at(-1)))} s`:'');
    if(b.length<a.length)return `${noun} removed`;
    if(at){const m=b.find(x=>{const y=a.find(y=>y.id===x.id);return y&&at(y)!==at(x);});if(m)return `${noun} moved to ${fmt(at(m))} s`;}
    return `${noun} changed`;
  }
  function diffText(a,b){
    if(!a||!b)return 'edits';
    if(a.shots.length!==b.shots.length)return b.shots.length>a.shots.length?'chapter added':'chapter removed';
    for(let i=0;i<b.shots.length;i++){
      const x=a.shots[i],y=b.shots[i];if(JSON.stringify(x)===JSON.stringify(y))continue;
      const fields=[...new Set([...Object.keys(x),...Object.keys(y)])].filter(k=>JSON.stringify(x[k])!==JSON.stringify(y[k]));
      const one=k=>{
        if(k==='timeOfDay'){const ka=x.timeOfDay||[],kb=y.timeOfDay||[];if(ka.length===kb.length&&!kb.some(k=>{const o=ka.find(o=>o.id===k.id);return o&&o.at!==k.at;})){const m=kb.find(k=>{const o=ka.find(o=>o.id===k.id);return o&&o.mode!==k.mode;});if(m)return `time-of-day key at ${r2(m.at)} s set to ${roomModes().find(r=>r.id===m.mode)?.label||m.mode}`;}return listDiff(ka,kb,'time-of-day key',k=>k.at,r2);}
        if(k==='camera')return listDiff(x.camera?.keys,y.camera?.keys,'camera view',k=>k.time,v=>r2(v*y.seconds));
        if(k==='motion'&&JSON.stringify(x.motion?.clips)===JSON.stringify(y.motion?.clips)&&JSON.stringify(x.motion?.initial)!==JSON.stringify(y.motion?.initial))return 'starting position';
        if(k==='motion')return listDiff(x.motion?.clips,y.motion?.clips,'desk move',c=>c.start,r2);
        return (SHOT_FIELDS[k]||k)+' changed';
      };
      return fields.slice(0,2).map(one).join(' and ')+(fields.length>2?` (+${fields.length-2} more)`:'');
    }
    return 'edits';
  }
  const capital=t=>t.charAt(0).toUpperCase()+t.slice(1);
  function editLabel(l){return l.text||capital(diffText(l.before,l.after));}
  function stillCaption(){
    const json=JSON.stringify(project),mark={json,labels:undoLabels.slice(),project:copy(project)};
    if(stillMark&&stillMark.json===json)return {mark,text:'no edits since the last still'};
    const prev=stillMark?.labels||[],now=new Set(undoLabels),had=new Set(prev);
    let last=-1;prev.forEach((l,i)=>{if(now.has(l))last=i;});
    const added=undoLabels.filter(l=>!had.has(l)),removed=last<0&&undoLabels.length>=40?[]:prev.slice(last+1);
    const more=n=>n>1?` (+${n-1} more)`:'';
    let text;
    if(added.length)text='after: '+editLabel(added.at(-1))+more(added.length);
    else if(removed.length)text='after: undid '+editLabel(removed.at(-1))+more(removed.length);
    else text=stillMark?'after: '+capital(diffText(stillMark.project,project)):'no edits yet';
    return {mark,text};
  }
  async function renderStill(){
    if(stillBusy)return;requireReady();if(!deskEditor.flush())return;
    const s=shot(),t=playhead,seconds=Number((t*s.seconds).toFixed(2)),name=`Film-${s.id}-${seconds.toFixed(2)}s.jpg`,film=filmShot();
    const job=deskVersions.renderShot(film,s,keys(),seconds),started=performance.now(),first=!stills?.warm?.(),caption=stillCaption();stillBusy=true;
    const title=()=>first?`Preparing film stage (first still only) · ${Math.round((performance.now()-started)/1000)} / ${Math.round(bootMs/1000)} s`:`Rendering ${s.id} at ${seconds.toFixed(2)} s… ${Math.round((performance.now()-started)/1000)} s`;
    still.busy(title(),film?'Film shot with your Director edits, film quality on.':'No film shot for this chapter: rendering the Director cut alone.',{expected:first?bootMs:0});
    const timer=setInterval(()=>{const text=title();status(text);still.progress(text);},500);
    try{
      stills||=createStillRenderer();const shot3d=await stills.render(job,t),took=performance.now()-started;
      // The chapter's film titles on top (as finish-intro burns them in), unless Titles is off in the toolbar.
      let url=shot3d,titled=0;try{titled=titleEditor.stillTitles(seconds);if(titled)url=await titleEditor.compositeStill(shot3d,seconds);}catch(error){console.warn('[render still] titles',error.message);titled=0;}
      if(first)try{localStorage.setItem('ergoflex.director.stillBootMs',String(Math.round(took)));bootMs=took;}catch{}
      still.add({url,name,seconds:seconds,note:`${Math.round(took/100)/10} s to render${titled?` · ${titled===1?'title':titled+' titles'} on`:''}`,detail:caption.text});stillMark=caption.mark;group=null;
      status('Still rendered: '+name+' · R renders another, \\ compares with the live view, Shift-click a thumbnail for A/B.');
    }catch(error){console.error('[render still]',error);still.error(error.message);status('Render still failed: '+error.message,true);stills?.dispose();stills=null;}
    finally{clearInterval(timer);stillBusy=false;}
  }
  addEventListener('pagehide',()=>stills?.dispose());
  // Film look (V): the real render crossfaded over the 16:9 frame whenever the view rests.
  const filmLook=film?createFilmLook({status,onStill:()=>action('render-still'),
    resting:()=>open&&bridge.ready()&&!bridge.playback().playing&&!scrub&&!keyDrag&&!groupDrag&&!marquee&&!stillBusy&&!composing&&!bridge.bakeState().baking,
    async render(){
      const s=shot(),t=playhead,view=liveView(),job=deskVersions.renderShot(filmShot(),s,keys(),t*s.seconds);
      // Orbited away from the keys: the film look shows the user's view (held for the whole chapter), not the saved one.
      if(view){job.camera={keys:[0,1].map(time=>({id:'live-'+time,time,label:'Your view',easing:'linear',view}))};delete job.cameraPlan;
        status((selectedKey()?'Update selected view':'+ Add camera keyframe')+' keeps this camera.');}
      stills||=createStillRenderer();const url=await stills.render(job,t);return {url,label:(t*s.seconds).toFixed(2)+' s'+(view?' · your view (not saved)':'')};}}):null;
  // The view the keys put the stage camera in (taken when an orbit, pan or zoom starts; dropped on a seek, play or
  // capture). While the live camera differs from it, Film look and Split's film side render the live camera.
  const viewNums=v=>[...v.position,...v.target,v.fov];
  function liveView(){
    if(!orbitBase)return null;stopOrbit();const view=bridge.stage()?.captureCamera();if(!view)return null;
    const a=viewNums(view),b=viewNums(orbitBase);return a.some((x,i)=>Math.abs(x-b[i])>1e-4)?view:null;
  }
  // Viewport tools (top left of the frame): Lights (Shift+L), Move (W: the selected light, prop or person), Aim (E: a
  // light), Rotate (E: a prop or person), Scale (R). They run the same actions as the keys (director-actions.mjs).
  // data-vt keeps its old values (l, w, e, pe, t): the browser tests click them.
  const lightTools=film?(()=>{const el=document.createElement('div');el.className='film-box light-tools';el.innerHTML='<button data-vt="l" aria-pressed="false" title="Show the scene lights in the view (Shift+L)">Lights</button><button data-vt="w" title="Move the selected light, prop or person (W)">Move</button><button data-vt="e" title="Aim the selected spot or sun (E)">Aim</button><button data-vt="pe" title="Rotate the selected prop or person (E)">Rotate</button><button data-vt="t" title="Scale the selected prop (R)">Scale</button>';document.body.append(el);
    el.addEventListener('click',e=>{const b=e.target.closest('[data-vt]');if(!b)return;try{runKey({l:'light-markers',w:'tool-move',e:'tool-rotate',pe:'tool-rotate',t:'tool-scale'}[b.dataset.vt]);}catch(error){status(error.message,true);}b.blur();});return el;})():null;
  const syncLightTools=()=>{if(!lightTools)return;const light=!!sceneLights.selected(),prop=!!sceneProps.selected(),m=sceneProps.mode();lightTools.querySelector('[data-vt=l]').setAttribute('aria-pressed',String(sceneLights.showing()));
    const set=(vt,on,pressed)=>{const b=lightTools.querySelector(`[data-vt=${vt}]`);b.disabled=!on;b.setAttribute('aria-pressed',String(!!(on&&pressed)));};
    set('w',light||prop,prop&&m==='translate');set('e',light,false);set('pe',prop,m==='rotate');set('t',prop,m==='scale');};
  let orbitHooked=false,pokedAt=-1,pokedPlaying=false;
  function hookOrbit(){if(orbitHooked||!filmLook)return;const dom=bridge.stage()?.three?.()?.renderer?.domElement;if(!dom)return;const poke=()=>filmLook.poke(),start=()=>{if(!orbitBase&&!bridge.playback().playing)orbitBase=bridge.stage()?.captureCamera()||null;poke();};dom.addEventListener('pointerdown',start,true);dom.addEventListener('pointermove',e=>{if(e.buttons)poke();},true);dom.addEventListener('wheel',start,{capture:true,passive:true});
    // P6 Lock camera to view (Blender): orbiting, panning or zooming updates the selected camera view on release
    let lockMoved=false,lockTimer=0;const lockDone=()=>{if(!lockCamera||!keyId||!lockMoved)return;lockMoved=false;try{action('key-update');}catch(error){status(error.message,true);}};
    dom.addEventListener('pointermove',e=>{if(e.buttons&&lockCamera)lockMoved=true;},true);dom.addEventListener('pointerup',()=>setTimeout(lockDone,0),true);
    dom.addEventListener('wheel',()=>{if(!lockCamera)return;lockMoved=true;clearTimeout(lockTimer);lockTimer=setTimeout(lockDone,350);},{capture:true,passive:true});
    orbitHooked=true;}
  var lockCamera=false;
  // P4 lane locks: a 🔒 in each lane's label; a locked lane takes no clicks or drags (its items stay selectable from the
  // inspector), kept in this browser.
  function laneId(row){return row.classList.contains('camera-lane-row')?'camera':row.dataset.laneColor||row.querySelector('[data-desk-lane]')?.dataset.deskLane||null;}
  function lockedLanes(){return new Set(loadUi().laneLocks||[]);}
  function decorateLocks(){
    const locked=lockedLanes();
    for(const row of timeline.querySelectorAll('.desk-lane-row,.camera-lane-row')){
      const id=laneId(row),label=row.querySelector('.desk-lane-label,.track-heading');if(!id||!label)continue;
      row.classList.toggle('lane-locked',locked.has(id));
      if(!label.querySelector('.lane-lock'))label.insertAdjacentHTML('beforeend',`<button type="button" class="lane-lock" data-lane-lock="${escape(id)}" aria-pressed="${locked.has(id)}" title="${locked.has(id)?'Unlock this lane':'Lock this lane: no clicks or drags in it'}">${locked.has(id)?'🔒':'🔓'}</button>`);
    }
  }
  timeline.addEventListener('click',event=>{const b=event.target.closest('[data-lane-lock]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();const set=lockedLanes(),id=b.dataset.laneLock;if(set.has(id))set.delete(id);else set.add(id);saveUi({laneLocks:[...set]});renderTimeline();status(set.has(id)?`Lane locked: ${id}.`:`Lane unlocked: ${id}.`);},true);
  timeline.addEventListener('pointerdown',event=>{const row=event.target.closest('.lane-locked');if(!row||event.target.closest('.desk-lane-label,.track-heading'))return;event.preventDefault();event.stopImmediatePropagation();status('This lane is locked: 🔒 in its label unlocks it.');},true);
  // P4 lane filter (After Effects' U / UU, here Shift+U): every lane → only lanes with something → only the selection's lanes
  var laneFilter='';
  function setLaneFilter(f){laneFilter=f;document.body.classList.toggle('df-filter-busy',f==='busy');document.body.classList.toggle('df-filter-sel',f==='sel');document.body.classList.toggle('df-filter-changed',f==='changed');renderPills();
    status(f==='busy'?'Lanes: only those with something in them (Shift+U again: only the selection\'s).':f==='sel'?(b2sel.get()?'Lanes: only the selection\'s (Shift+U again: only what changed from the film).':'Lanes: only the selection\'s, and nothing is selected (Shift+U: only what changed).'):f==='changed'?'Lanes: only the groups changed from the film (●) (Shift+U again: every lane).':'Every lane shown.');}
  // The still stage is created on demand to avoid loading a second full scene while editing.
  function commit(fn,{render=false,key=null}={}){
    if(!key||group!==key){const before=copy(project);undo.push(before);undo=undo.slice(-40);undoLabels.push({before,after:null,text:null});undoLabels=undoLabels.slice(-40);redo=[];redoLabels=[];}
    group=key;fn();const top=undoLabels.at(-1);if(top){top.after=copy(project);top.text=null;labelPending=top;setTimeout(()=>{if(labelPending===top)labelPending=null;});}changed();if(render)renderPanel();
  }
  // Studio <-> Director (studio-sync.mjs): the "Studio changed" badge, Refresh from Studio, Adopt Studio's version.
  function renderStudioSync(){for(const el of [...appbar.querySelectorAll('[data-studio-sync]'),...panel.querySelectorAll('[data-studio-sync]')])el.innerHTML=studioSync.html();}
  const studioSync=createStudioSync({bridge,project:()=>project,index:()=>selected,shot,film:filmShot,commit,status,rerender:renderStudioSync,render:()=>render(),stageItems:()=>{try{return sceneProps.items();}catch{return [];}}});
  function loadProject(value,keepDraft=true){if(keepDraft)draft();project=cleanCut(value,catalog);foldedDesks.clear();   // (a cut loaded now, e.g. Keep my unexported changes, gets its room-desk prop moves folded too)
for(const set of Object.values(picks))set.clear();lightSel=null;selected=0;keyId=null;playhead=0;undo=[];redo=[];undoLabels=[];redoLabels=[];labelPending=null;group=null;changed();render();load();}
  function render(){stampDraft();renderPanel();renderTimeline();}
  function renderPanel(){
    const scroll=panel.scrollTop,active=panel.contains(document.activeElement)?document.activeElement:null;
    const activeName=active?.name,selection=active?.selectionStart==null?null:[active.selectionStart,active.selectionEnd];
    const s=shot(),room=catalog.find(r=>r.id===s.room),layout=room?.layouts.find(l=>l.id===s.layout),modes=layout?.modes||room?.modes||[];
    const cameraKey=selectedKey();
    const cuts=[...library.data.cuts];for(const draft of Object.values(library.data.drafts))if(!cuts.some(c=>c.id===draft.id))cuts.push(draft);
    panel.innerHTML=(shellOn()?'':`
      <div class="director-heading"><div><span class="director-kicker">DIRECTOR MODE</span><h2>Director studio.</h2></div><button data-action="ab-classic" class="calm-back" title="The new layout: one app bar, one timeline row (the classic one stays one click away)">New layout</button><button data-action="inspector" aria-label="Hide inspector" title="Hide inspector; keep the timeline open">‹</button></div>
      <div class="inspector-global"><button data-action="save-export" class="primary" title="Download this cut (the film picks it up from Downloads); also keeps a copy in this browser when there is room">Export cut</button><button data-action="undo" title="Undo (Ctrl/Cmd+Z)" ${undo.length?'':'disabled'}>Undo</button><button data-action="redo" title="Redo (Ctrl+Y or Ctrl/Cmd+Shift+Z)" ${redo.length?'':'disabled'}>Redo</button><span class="studio-sync" data-studio-sync>${studioSync.html()}</span><span class="saved-indicator" data-saved title="Draft kept in this browser"></span></div>${filmPicker()}`)+`
      ${shellOn()&&filmShot()?sceneListHtml():''}<nav class="inspector-tabs" aria-label="Inspector sections">${['project','chapter',...(titleEditor.has()?['title']:[]),'camera','groove',...(lighting()||timeOfDay()||filmShot()?['lighting']:[]),...(filmShot()?['graphics','props','people','layers','desks']:[]),...(filmShot()&&branding.available()?['branding']:[]),...(filmShot()&&deskBuild.shows()?['build']:[]),...(filmShot()&&deskVersions.has()?['version']:[]),...(film?['render']:[])].map(tab=>`<button data-inspector-tab="${tab}" aria-pressed="${inspector===tab}" ${shellOn()&&TAB_TITLE[tab]?`title="${TAB_TITLE[tab]}"`:''}>${tabLabel(tab)}</button>`).join('')}<button data-action="inspector" aria-label="Hide inspector" title="Hide inspector">×</button></nav><div class="selected-header" data-selected-header>${selectedHeader()}</div>
      <p data-status role="status" class="director-status">${escape(titleEditor.editHint?.()||`${project.shots.length} chapters · ${Math.round(duration(project.shots))} seconds`)}</p>
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
      <div data-reveal="titles">${titleEditor.chapterFields()??`<label>Headline<input name="title" maxlength="140" value="${escape(s.title)}"></label>
      <label>Supporting text<textarea name="detail" rows="2" maxlength="260">${escape(s.detail)}</textarea></label>`}</div>
      <div class="director-grid"><label>Duration (seconds)<input name="seconds" type="number" min="2" max="90" step=".5" value="${s.seconds}"></label><label>Blend into shot (seconds)<input name="transition" type="number" min="0" max="3" step=".1" value="${s.transition}"></label></div>
      <fieldset class="chapter-pacing"><legend>Chapter pacing</legend>
      <div class="director-actions"><button data-action="pace-faster" ${s.seconds*.8<2?'disabled':''}>20% shorter</button><button data-action="pace-slower" ${s.seconds*1.25>90?'disabled':''}>25% longer</button><button data-action="pace-hold" ${s.seconds+2>90?'disabled':''}>+ 2s ending hold</button></div>
      <p class="director-hint">Shorter / longer retimes camera and all movements together. Ending hold keeps their timing and pauses on the final pose. Undo restores the previous timing.</p></fieldset>
      <label>Environment<select name="room">${catalog.map(r=>option(r.id,r.name,s.room)).join('')}</select></label>
      <div class="director-grid"><label>Room size / layout<select name="layout" ${room?.layouts.length?'':'disabled'}>${room?.layouts.length?room.layouts.map(l=>option(l.id,l.name,s.layout)).join(''):'<option>Product stage</option>'}</select></label><label>Time / activity${timeOfDay()?' <small>(driven by the Time of day lane)</small>':''}<select name="mode" ${modes.length&&!timeOfDay()?'':'disabled'} ${timeOfDay()?'title="The Time of day lane in Lighting drives the room\'s daypart"':''}>${modes.length?modes.map(m=>option(m.id,m.label,s.mode)).join(''):'<option>Studio</option>'}</select></label></div>
      <label>Feature / animation<select name="kind">${KINDS.map(([id,name])=>option(id,name,s.kind)).join('')}</select></label>
      <div class="director-grid"><label>Desk build<select name="preset">${PRESET_IDS.map(id=>option(id,({occ:'Orange Coast College',hbhs:'HBHS Oilers',library:'Humboldt / Library'})[id]||id[0].toUpperCase()+id.slice(1),s.preset)).join('')}</select></label><label>Desk width<select name="size">${option('48x30','48″',s.size)}${option('60x30','60″',s.size)}</select></label></div>
      ${startPose.panel()}
      <div class="director-actions"><button data-action="load">Load / reset shot</button><button data-action="chapter-toggle" class="primary">▶ Play chapter</button><button data-action="preview">↻ Restart chapter</button></div>
      <div class="bake-controls"><div class="director-actions"><button data-action="bake">Bake chapter</button><button data-action="bake-all">Bake full intro · 1080p</button><button data-action="bake-download">Download 3D video</button></div><label class="director-check"><input type="checkbox" name="baked-playback" checked>Use baked playback when available</label><p data-bake-summary role="status" class="director-hint"></p><p class="director-hint">Bake renders every frame in advance. Clips stay in this browser; editing the chapter requires a new bake.</p></div>
      </div><div data-inspector-page="camera"><h3>Camera keyframes</h3><p class="director-hint">Drag the scene to orbit. Scroll or pinch to zoom. Right-drag to pan. Then capture a view.</p>
      <div class="director-actions camera-framing"><button data-action="frame-desk">Frame desk</button><button data-action="frame-room" ${s.room==='product'?'disabled':''}>Frame room</button></div>
      <div class="director-actions"><button data-action="camera-from">${s.camera&&keys().some(k=>k.time===0)?'✓ ':''}Capture start view</button><button data-action="camera-to">${s.camera&&keys().some(k=>k.time===1)?'✓ ':''}Capture end view</button><button data-action="camera-clear" ${film&&filmShot()?'title="The film\'s own camera keys for this chapter, as the film shot has them (one undo step)"':''}>${film&&filmShot()?'Reset camera to the film':'Reset camera'}</button></div>
      <label>Preview position<input name="seek" type="range" min="0" max="100" step=".01" value="${playhead*100}"></label>
      <p class="director-hint">Select a diamond below to edit its view. Scrub to a time, orbit the camera, then add a keyframe. Dashed diamonds are automatic views until you edit them.</p>
      <div class="director-actions"><button data-action="key-add">+ Add camera keyframe</button><button data-action="key-update" class="primary" ${cameraKey?'':'disabled'}>Update selected view</button><button data-action="key-duplicate" title="Duplicate selected camera view (Ctrl/Cmd+D)" ${cameraKey?'':'disabled'}>Duplicate keyframe</button><button data-action="key-delete" ${cameraKey?'':'disabled'}>Delete keyframe</button></div>
      <label>Selected camera keyframe<select name="camera-key"><option value="">Select a keyframe…</option>${keys().map(k=>option(k.id,`${k.label} · ${(k.time*s.seconds).toFixed(2)}s`,keyId)).join('')}</select></label>
      ${cameraKey?`<div data-reveal="camera-key"><div class="selection-preview"><button data-action="key-preview" ${keys().at(-1)?.id===cameraKey.id?'disabled title="Last camera view: select an earlier view to preview its move"':''}>▶ Preview camera move</button><button data-action="key-go">Go to view</button></div><label>Keyframe name<input name="key-label" maxlength="60" value="${escape(cameraKey.label)}"></label><div class="director-grid"><label>Keyframe time (seconds)<input name="key-time" type="number" min="0" max="${s.seconds}" step=".05" value="${Number((cameraKey.time*s.seconds).toFixed(3))}"></label><label>Move to next view<select name="key-easing">${CAMERA_EASINGS.map(e=>option(e,({smooth:'Smooth move',linear:'Linear move',hold:'Hold, then cut'})[e],cameraKey.easing)).join('')}</select></label></div><label>Camera route<select name="key-path">${option('linear','Direct line',cameraKey.path||'linear')}${option('orbit','Orbit around subject',cameraKey.path||'linear')}</select></label><label>Field of view (degrees) <small class="lens-mm" title="The same view on a full-frame camera (24 mm high)">≈ ${Math.round(12/Math.tan(cameraKey.view.fov*Math.PI/360))} mm lens</small><input name="key-fov" type="number" min="15" max="80" step="1" value="${cameraKey.view.fov}"></label><div class="director-actions lens-presets">${[[24,'Detail · 24°'],[35,'Balanced · 35°'],[50,'Wide · 50°']].map(([fov,label])=>`<button data-action="lens-${fov}" aria-pressed="${cameraKey.view.fov===fov}">${label}</button>`).join('')}</div><p class="director-hint">Lens buttons update this keyframe. After orbiting or framing the preview, use Update selected view to keep that composition.</p></div>`:''}

      </div><div data-inspector-page="title">${titleEditor.panel()}</div><div data-inspector-page="graphics">${graphics.panel()}</div><div data-inspector-page="groove">${deskEditor.panel()}</div><div data-inspector-page="lighting">${lightPanel()}</div><div data-inspector-page="props"><div data-scene-props>${filmShot()?sceneProps.panel():''}</div></div><div data-inspector-page="people"><div data-scene-people>${filmShot()?scenePeople.panel():''}</div></div><div data-inspector-page="layers"><div data-scene-layers>${filmShot()&&inspector==='layers'?layers.panel():''}</div></div><div data-inspector-page="desks"><div data-scene-desks>${filmShot()?deskSel.panel():''}</div></div><div data-inspector-page="branding"><div data-scene-branding>${filmShot()?branding.panel():''}</div></div><div data-inspector-page="build">${filmShot()?deskBuild.panel():''}</div><div data-inspector-page="version">${filmShot()&&deskVersions.has()?deskVersions.panel():''}</div>${film?renderRequest.panel():''}`;
    branding.mount(panel.querySelector('[data-scene-branding]'));
    decorateChanged();
    renderAppBar();
    showInspector(inspector,false,false);deskEditor.sync();syncTransport();
    if(!revealWant)panel.scrollTop=scroll;
    syncSelection();
    const replacement=activeName?field(activeName):null;if(replacement){replacement.focus({preventScroll:true});if(selection&&replacement.setSelectionRange)try{replacement.setSelectionRange(...selection);}catch{}}
    repulse();
  }
  function renderTimeline(){
    const t0=performance.now(),scroll=timeline.querySelector('.timeline-viewport')?.scrollLeft||0,s=shot();
    const ticks=timelineTicks(s.seconds,Math.max(300,(timeline.clientWidth-150)*zoom));
    const shell=shellOn(),transportHtml=`<div class="timeline-transport">${shell?'':`<button data-action="undo" aria-label="Undo edit" title="Undo (Ctrl/Cmd+Z)">↶</button><button data-action="redo" aria-label="Redo edit" title="Redo (Ctrl+Y or Ctrl/Cmd+Shift+Z)">↷</button>`}<button data-action="edit-prev" aria-label="Previous edit" title="Previous camera view or movement edge (↑)">|‹</button><button data-action="preview-loop" aria-pressed="${!!bridge.playback().loop}" title="Repeat the chapter or selected camera / Groove preview (L)">${bridge.playback().loop?'Loop on':'Loop off'}</button><button data-action="preview" aria-label="Restart chapter" title="Restart chapter">↻</button><button data-action="chapter-toggle" class="chapter-transport">▶ Play chapter</button><button data-action="edit-next" aria-label="Next edit" title="Next camera view or movement edge (↓)">›|</button>
      <label class="timeline-timecode"><input name="timeline-seconds" aria-label="Chapter playhead seconds" type="number" min="0" max="${s.seconds}" step=".033333" value="${(playhead*s.seconds).toFixed(2)}"><span>/ ${s.seconds}s</span><small data-film-tc>${escape(timecodeNow())}</small></label></div>`;
    timeline.innerHTML=`<div class="timeline-resize" role="separator" aria-label="Resize timeline" aria-orientation="horizontal" tabindex="0"><span></span></div>
      ${shell?'':`<div class="timeline-toolbar"><div class="timeline-project"><strong>${escape(project.name)}</strong><span>${project.shots.length} chapters · ${Math.round(duration(project.shots))}s</span></div>${filmPicker()}
      ${transportHtml}
      <div class="timeline-project-actions"><button data-action="inspector" aria-label="Toggle inspector">Inspector</button><button data-action="titles" aria-label="Toggle preview titles" title="${film&&titleEditor.has()?'Show or hide the film titles in the frame':'Show or hide the chapter titles'}" aria-pressed="${film&&titleEditor.has()?titleEditor.shown():document.body.classList.contains('preview-titles')}">Titles</button><button data-action="chapters" aria-label="Toggle chapter strip" aria-pressed="${!timeline.classList.contains('chapters-hidden')}">Chapters</button><button data-action="bake">Bake chapter</button><button data-action="add">+ Chapter</button><button data-action="duplicate">Duplicate chapter</button><button data-action="remove" ${project.shots.length===1?'disabled':''}>Remove chapter</button></div></div>`}
      <div class="chapter-cards">${project.shots.map((s,i)=>`<div class="chapter-card ${i===selected?'selected':''}" draggable="true" data-index="${i}"><button data-action="select" data-index="${i}" aria-current="${i===selected}" aria-label="Edit chapter ${i+1}: ${escape(s.title)}"><span>${String(i+1).padStart(2,'0')} · ${s.seconds}s</span><strong>${escape(s.title)}</strong><small>${escape(catalog.find(r=>r.id===s.room)?.name||s.room)} · ${escape((catalog.find(r=>r.id===s.room)?.layouts.find(l=>l.id===s.layout)?.modes||catalog.find(r=>r.id===s.room)?.modes||[]).find(m=>m.id===s.mode)?.label||'Studio')}</small></button><div><button data-action="up" data-index="${i}" aria-label="Move chapter ${i+1} earlier" ${i===0?'disabled':''}>←</button><button data-action="down" data-index="${i}" aria-label="Move chapter ${i+1} later" ${i===project.shots.length-1?'disabled':''}>→</button></div></div>`).join('')}</div>
      <div class="workbench-toolbar">${shell?transportHtml:''}<strong title="${escape(s.title)}"><span>CHAPTER ${String(selected+1).padStart(2,'0')}</span> ${escape(s.title)}</strong><span class="workbench-count">${keys().length} views · ${deskEditor.count()} moves</span>${deskEditor.picker()}
      <div class="track-palette">${timelineShortcuts()}<button data-action="key-add">+ Camera view</button>${deskEditor.tools()}${lighting()?'<button data-action="light-add" class="light-add" title="Add a light state at the playhead (Shift-click: a neutral colour key)">+ Light</button>':''}${filmShot()?'<button data-action="pp-add" class="prop-add" title="Add a prop from the library to this chapter (on the desk or the floor in front of the camera)">+ Prop</button>':''}</div>
      <button data-action="magnet" class="magnet" aria-pressed="${magnet}" title="Magnet: snap to movement edges, keys, the playhead and the chapter ends (S); Alt bypasses">Magnet</button><label class="snap-control">Snap <select name="timeline-snap" aria-label="Timeline snapping">${[[0,'Off'],[.1,'0.1s'],[.5,'0.5s'],[1,'1s'],...(scoreModel()?[['beat','Beat'],['bar','Bar']]:[])].map(([v,label])=>option(v,label,snapStep)).join('')}</select></label>
      <div class="timeline-zoom"><button data-action="zoom-out" aria-label="Zoom timeline out" ${zoom===1?'disabled':''}>−</button><button data-action="zoom-fit" aria-label="Fit chapter to timeline" title="Fit the whole chapter (Shift+Z) · Z: zoom to the selection · Ctrl+wheel zooms at the pointer">${zoom===1?'Fit':'Fit · '+(Math.round(zoom*10)/10)+'×'}</button><button data-action="zoom-in" aria-label="Zoom timeline in" ${zoom>=zoomMax()-1e-6?'disabled':''}>+</button></div></div>
      <div class="timeline-viewport" tabindex="0" aria-label="Camera and desk timeline"><div class="timeline-content" style="width:${zoom*100}%;--timeline-grid:${(ticks[1]||s.seconds)/s.seconds*100}%">
      <div class="time-ruler-row"><span class="track-heading">SECONDS</span><div class="time-ruler" role="slider" aria-label="Chapter timeline scrubber" aria-valuemin="0" aria-valuemax="${s.seconds}" aria-valuenow="${(playhead*s.seconds).toFixed(2)}" tabindex="0">${ticks.map(t=>`<span style="left:${t/s.seconds*100}%">${Number(t.toFixed(2))}</span>`).join('')}${scoreHitsHtml()}${rulerMarksHtml()}<div class="ruler-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div><button class="chapter-end-handle" data-chapter-end type="button" aria-label="Chapter length: drag to change" title="Drag to change the chapter length (snaps to 0.5 s, Alt: free). Nothing already placed moves; the camera holds its last view."><i></i></button></div>
      ${deskVersions.lane()}${titlesGroup()}${graphics.lane()}${laneGroupHead('motion')}<div class="lane-group-body" data-lane-body="motion" ${groupClosed('motion')?'hidden':''}><div class="camera-lane-row"><span class="track-heading"><b>◆ Camera</b><small>${s.camera?'Custom views':'Original views'}</small></span><div class="camera-track" role="group" aria-label="Camera keyframe timeline"><div class="camera-track-line"></div>${keys().slice(0,-1).map((k,i)=>`<span class="camera-segment ease-${k.easing}" style="left:${k.time*100}%;width:${(keys()[i+1].time-k.time)*100}%"><i>${({smooth:'Smooth move',linear:'Linear move',hold:'Hold / cut'})[k.easing]}</i></span>`).join('')}<div class="camera-track-playhead" data-track-playhead style="left:${playhead*100}%"></div>${keys().map(k=>`<button class="camera-key ${keyId===k.id?'selected':''} ${shot().camera?'':'automatic'}" style="left:${k.time*100}%" data-key="${k.id}" aria-label="Camera keyframe: ${escape(k.label)} at ${(k.time*shot().seconds).toFixed(2)} seconds" aria-pressed="${keyId===k.id}" title="${escape(k.label)} · ${(k.time*shot().seconds).toFixed(2)}s · ${({smooth:'smooth',linear:'linear',hold:'hold'})[k.easing]||k.easing} to the next (T)" data-ease="${k.easing}"><span>${({smooth:'⧗',linear:'◆',hold:'■'})[k.easing]||'◆'}</span><small>${(k.time*shot().seconds).toFixed(1)}s</small></button>`).join('')}<span class="camera-track-zero">0s</span><span class="camera-track-end">${shot().seconds}s</span></div></div>
      ${deskEditor.timeline()}</div>${lightLane()}${peopleGroup()}${propsGroup()}${soundGroup()}</div></div>
      <label class="timeline-pan" ${zoom===1?'hidden':''}><span>Pan view</span><input name="timeline-pan" type="range" min="0" max="100" step=".1" value="0" aria-label="Timeline horizontal position"></label>
      <div class="timeline-footer"><span data-bake-summary class="timeline-bake-summary" role="status"></span><span data-timeline-status role="status">Click ruler to scrub · Drag empty lanes to select several · Shift/Ctrl-click adds · Ctrl+A all · Alt: bypass snap · Space: play</span><span class="sb-pills" data-sb-pills></span><output data-track-time>${(playhead*s.seconds).toFixed(2)}s / ${s.seconds}s</output></div>`;
    timeline.querySelector('.timeline-viewport').scrollLeft=scroll;
    renderPills();drawScore();decorateLocks();decorateGroups();
    if(debugTimeline){const ms=performance.now()-t0,el=timeline.querySelector('[data-track-time]');if(el)el.title=`renderTimeline ${ms.toFixed(1)} ms · ${timeline.getElementsByTagName('*').length} elements`;const f=timeline.querySelector('.timeline-footer');if(f)f.dataset.debug=`${ms.toFixed(1)} ms · ${timeline.getElementsByTagName('*').length} el`;}
    syncTransport();syncPlayhead();syncPan();syncPicks();syncSelection();
  }
  async function load(){
    const token=++loadToken,position=playhead;status('Loading this chapter…');
    try{await bridge.editShot(project,selected);if(token===loadToken){automaticCameras.set(shot().id,bridge.stage().cameraKeys());deskEditor.ready();playhead=position;if(!keys().some(k=>k.id===keyId))keyId=null;renderPanel();renderTimeline();if(film&&!timelineFitted&&!document.body.style.getPropertyValue('--director-timeline-height')){fitTimeline();renderTimeline();}hookOrbit();if(film&&filmShot())sceneProps.ensure().catch(error=>console.warn('[props]',error.message));orbitBase=null;bridge.seek(playhead);status('Camera is live. Existing desk movements appear below; select a block to edit it, or add Lift, Tilt or Wheels.');}}catch(error){if(token===loadToken)status(error.message,true);}
  }
  function move(from,to){if(to<0||to>=project.shots.length)return;commit(()=>{const [s]=project.shots.splice(from,1);project.shots.splice(to,0,s);selected=to;},{render:true});load();}
  function exportCut(){const text=JSON.stringify(((c)=>({...c,shots:c.shots.map(s=>exportLighting(s.peopleEdits?{...s,peopleEdits:canonicalPeople(s.peopleEdits)}:s))}))(cleanCut(project,catalog)),null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(project.name.replace(/[^a-z0-9]+/gi,'-')||'client-cut')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);exported=signature();fresh.exported(project);syncFilm();status('Cut exported. Import it in Director Mode on another browser.');return text;}
  async function action(name,index){
    if(name==='keys-panel'){keysPanel.toggle();return;}
    if(name==='report-problem'){reportDialog.open();return;}
    try{
      if(composing)return;
      group=null;
      if((name==='save-export'||name==='export')&&index!=='stale-ok'&&await fresh.guardExport(project,unexported(),()=>action(name,'stale-ok')))return;
      if(name==='film-keep-draft'||name==='film-use-film'){fresh.choose(name==='film-keep-draft'?'draft':'film');return;}
      if(name==='magnet'){magnet=!magnet;timeline.querySelector('[data-action=magnet]')?.setAttribute('aria-pressed',String(magnet));status(magnet?'Magnet on: drags snap to edges, keys and the playhead.':'Magnet off: drags snap to the grid only.');return;}
      if(name==='render-still'){await renderStill();return;}
      if(name==='sel-clear'){clearSelection();return;}
      if(name==='sel-delete'){deletePicks();return;}
      if(name==='sel-move'||name==='sel-align'){
        if(!picked())return;const base=groupBase(),t=playhead*shot().seconds,starts=[...base.keys.filter(k=>picks.keys.has(k.id)).map(k=>k.time*base.seconds),...base.clips.filter(c=>picks.clips.has(c.id)).map(c=>c.start),...(base.lights||[]).filter(e=>picks.lights.has(e.id)).map(e=>e.at),...(base.neutrals||[]).filter(k=>picks.neutrals.has(k[2])).map(k=>k[0]),...(base.tods||[]).filter(k=>picks.tods.has(k.id)).map(k=>k.at)];
        const delta=name==='sel-align'?t-Math.min(...starts):Number(field('sel-move')?.value);if(!Number.isFinite(delta))throw Error('Enter how many seconds to move the selection.');
        shiftPicks(delta,name==='sel-align'?'Aligned to the playhead':'Selection moved');return;
      }
      if(name.startsWith('sl-')){await sceneLights.action(name,index);return;}
      if(name.startsWith('pp-')){await sceneProps.action(name,index);return;}
      if(name.startsWith('pe-')){await scenePeople.action(name,index);return;}
      if(name.startsWith('ly-')){const r=await layers.action(name,index);if(r==='show'){showInspector('layers');renderLayers();panel.querySelector('[name="ly-name"]')?.focus();}else renderLayers();return;}
      if(name.startsWith('br-')){await branding.action(name,index);return;}
      if(name.startsWith('dk-')){await deskSel.action(name,index);return;}
      if(name.startsWith('ss-')){await studioSync.action(name);return;}
      if(name.startsWith('fr-')){await floorRefl.action(name,index);return;}
      if(name==='light-add'||name==='light-key-add'){addLight(name==='light-key-add');return;}
      if(name==='tod-add'){
        const T=timeOfDay();if(!T)return;requireReady();const t=Math.round(playhead*shot().seconds*1000)/1000,near=T.keys.find(k=>Math.abs(k.at-t)<.001);if(near){selectLight('tods',near.id);return;}
        const prev=[...T.keys].reverse().find(k=>k.at<=t)||T.keys[0],key={id:crypto.randomUUID(),at:t,mode:prev?.mode||roomModes()[0]?.id||'morning'};
        putTod([...T.keys,key]);selectLight('tods',key.id);status('Time-of-day key added at '+r2(t)+'s. Choose its daypart in Lighting.');return;
      }
      if(name==='light-delete'&&lightSel?.kind==='tods'){const T=timeOfDay(),item=lightItem();if(!item||T.keys.length<=1)return;putTod(T.keys.filter(k=>k.id!==item.id));lightSel=null;render();status('Deleted. Undo restores it.');return;}
      if(name==='light-delete'){
        const L=lighting(),item=lightItem();if(!item)return;
        if(lightSel.kind==='lights')putLighting({status:L.status.filter(e=>e.id!==item.id)});else{if(L.neutral.length<=1)return;putLighting({neutral:L.neutral.filter(k=>k[2]!==item[2])});}
        lightSel=null;render();status('Deleted. Undo restores it.');return;
      }
      if(name==='film-prev'||name==='film-next'){const i=filmIndex();switchFilm(name==='film-prev'?i-1:i<0?0:i+1);return;}
      if(name==='inspector'){document.body.classList.toggle('inspector-hidden');renderAppBar();return;}
      if(name==='ab-timeline'){document.body.classList.toggle('timeline-hidden');renderAppBar();status(document.body.classList.contains('timeline-hidden')?'Timeline hidden: Shift+Tab or ⋯ brings it back.':'Timeline shown.');return;}
      if(name==='ab-review'){review(true);return;}
      if(name==='ov-guides'){runKey('guides');return;}if(name==='ov-crop'){runKey('crop-cycle');return;}if(name==='ov-look'){runKey('film-look');return;}if(name==='ov-lights'){runKey('light-markers');return;}
      if(name==='ab-classic'){const now=!classic();saveUi({shell:now?'classic':'calm'});document.body.classList.toggle('df-shell',open&&!now);render();status(now?'Classic layout. ⋯ → Calm layout brings the new one back.':'Calm layout.');return;}
      if(name==='cut-settings'){if(document.body.classList.contains('inspector-hidden'))document.body.classList.remove('inspector-hidden');showInspector('project');return;}
      if(name==='final-render'){if(document.body.classList.contains('inspector-hidden'))document.body.classList.remove('inspector-hidden');showInspector('render');return;}
      if(name==='scene-desk-pick'){deskSel.select(index);return;}
      if(name==='field-reset'){resetField(index);return;}
      if(name==='sel-tool'){const t=index,ctxOf=sceneProps.selected()?'prop':scenePeople.selected()?'person':null;
        if(t==='dup'){runKey('duplicate');return;}if(t==='frame'){runKey('frame-selection');return;}if(t==='zoom'){zoomToSelection();return;}if(t==='reset'){runKey('reset-film',null,ctxOf);return;}
        if(t==='delete'){if(keyId){await action('key-delete');return;}if(scenePeople.selected()){scenePeople.remove();return;}if(sceneProps.selected()){sceneProps.hide(true);return;}document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true,cancelable:true}));return;}
        return;}
      if(name==='lamp-pick'){await sceneLights.changed({name:'sl-select',value:index});renderTimeline();return;}
      if(name==='white-preset'){editLight({color:index});const k=lightItem();if(k)status(`${whiteName(index)} ${index} at ${r2(k[0])} s.`);return;}
      if(name==='now-go'){const id=index;const el=panel.querySelector(`[data-light-section="${id}"]`);if(el){el.open=true;delete lightSectionsShut[id];el.scrollIntoView({block:'start',behavior:'smooth'});}return;}
      if(name==='group-toggle'){const g=['motion','lighting','titles','props','people','graphics','sound'][index]||'lighting';laneGroups[g]=!groupClosed(g);saveGroups();renderTimeline();return;}
      if(name==='titles'){if(film&&titleEditor.has()){const on=titleEditor.toggleShown();timeline.querySelector('[data-action=titles]')?.setAttribute('aria-pressed',String(on));status(on?'Film titles shown in the frame.':'Film titles hidden in the frame.');return;}document.body.classList.toggle('preview-titles');timeline.querySelector('[data-action=titles]')?.setAttribute('aria-pressed',String(document.body.classList.contains('preview-titles')));return;}
      if(name==='chapters'){timeline.classList.toggle('chapters-hidden');timeline.querySelector('[data-action=chapters]')?.setAttribute('aria-pressed',String(!timeline.classList.contains('chapters-hidden')));return;}
      if(name.startsWith('zoom-')){
        zoom=name==='zoom-fit'?1:clampZoom(zoom*(name==='zoom-in'?1.5:1/1.5),shot().seconds,laneWidth());if(zoom<1.02)zoom=1;renderTimeline();
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
      if(name==='undo'||name==='redo'){toast?.classList.remove('shown');
        const source=name==='undo'?undo:redo,target=name==='undo'?redo:undo;if(!source.length)return;
        const before=project.shots[selected];target.push(copy(project));project=source.pop();selected=Math.min(selected,project.shots.length-1);
        const moved=(name==='undo'?undoLabels:redoLabels).pop();if(moved)(name==='undo'?redoLabels:undoLabels).push(moved);labelPending=null;group=null;
        // Only a different scene needs the chapter re-prepared; everything else is applied like a normal edit.
        const after=project.shots[selected],rebuild=!before||!after||before.id!==after.id||['room','layout','mode','kind','preset','size'].some(k=>before[k]!==after[k]);
        changed();render();if(rebuild){await load();return;}
        deskEditor.ready();if(!keys().some(k=>k.id===keyId))keyId=null;if(JSON.stringify(before.camera)!==JSON.stringify(after.camera))seekCamera(playhead);status((name==='undo'?'Undone':'Redone')+(moved?': '+editLabel(moved):'')+'.');return;
      }
      if(name==='select'){clearPicks();selected=index;keyId=null;playhead=0;inspector='chapter';render();await load();return;}
      if(name==='up'||name==='down'){move(index,index+(name==='up'?-1:1));return;}
      if(name==='add'||name==='duplicate'){if(project.shots.length>=80)throw Error('A cut can contain up to 80 chapters.');const s={...copy(shot()),id:crypto.randomUUID()};if(name==='add'){s.title='New chapter';s.motion={version:2,initial:{height:30,tilt:0,x:0,z:0,yaw:0},clips:[]};}keyId=null;playhead=0;inspector='chapter';commit(()=>project.shots.splice(++selected,0,s),{render:true});await load();return;}
      if(name==='remove'){if(project.shots.length<=1)return;commit(()=>{project.shots.splice(selected,1);selected=Math.min(selected,project.shots.length-1);},{render:true});await load();return;}
      if(name.startsWith('camera-')){
        requireReady();
        if(name==='camera-clear'){
          // Film chapters: back to the film's own keys (its cameraPlan, as the chapter page opened them); the film's
          // path is never dropped. Other cuts: no keys (the automatic views), as before.
          const original=film&&filmShot()?filmCameraKeys(filmShot()):null;
          if(original){commit(()=>{shot().camera={keys:original};},{render:true});keyId=null;stopOrbit();seekCamera(playhead);status('Camera reset to the film.');return;}
          commit(()=>delete shot().camera,{render:true});keyId=null;await load();return;
        }
        captureKey(name==='camera-from'?0:1,name==='camera-from'?'Start view':'End view');return;
      }
      if(name==='key-add'){captureKey(playhead);return;}
      if(name==='key-update'){
        requireReady();if(!selectedKey())return;const view=bridge.stage().captureCamera();orbitBase=null;
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
  for(const el of [panel,timeline])el.addEventListener('click',event=>{const b=event.target.closest('button[data-action]');if(b)action(b.dataset.action,b.dataset.section??Number(b.dataset.index));});
  panel.addEventListener('toggle',event=>{const d=event.target.closest?.('[data-light-section]');if(!d)return;if(d.open)delete lightSectionsShut[d.dataset.lightSection];else lightSectionsShut[d.dataset.lightSection]=true;try{localStorage.setItem('ergoflex.director.lightSections',JSON.stringify(lightSectionsShut));}catch{}},true);
  panel.addEventListener('click',event=>{const tab=event.target.closest('[data-inspector-tab]');if(tab)showInspector(tab.dataset.inspectorTab);
    const hint=event.target.closest('.director-hint');if(hint&&!event.target.closest('a,button,input,select,textarea,label'))hint.classList.toggle('expanded');});   // long hints show three lines; click for all
  // A hint that is cut says so on hover (it was an unmarked "…": the click-to-read-all was undiscoverable).
  panel.addEventListener('pointerover',event=>{const h=event.target.closest?.('.director-hint');if(h&&!h.classList.contains('expanded')&&h.scrollHeight>h.clientHeight+1)h.title='Click to read all of it';else if(h&&h.title==='Click to read all of it'&&h.classList.contains('expanded'))h.removeAttribute('title');});
  timeline.addEventListener('change',event=>{
    if(event.target.name==='timeline-snap'){const v=event.target.value;snapStep=v==='beat'||v==='bar'?v:Number(v);renderPills();return;}
    if(event.target.name==='film-chapter'){switchFilm(Number(event.target.value));return;}
    if(event.target.name==='film-cut'){switchCut(event.target.value);return;}
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
    if(name.startsWith('sl-')){try{sceneLights.input(el);}catch(error){status(error.message,true);}return;}
    if(name.startsWith('dk-')&&el.type==='range'){try{deskSel.changed(el,{live:true});}catch(error){status(error.message,true);}return;}
    if(name.startsWith('fr-')&&el.type==='range'){try{floorRefl.changed(el,{live:true});}catch(error){status(error.message,true);}return;}
    if(name.startsWith('mx-')&&name!=='mx-on'){sceneLights.mixerChange(el,true).catch(error=>status(error.message,true));return;}
    if(/^gn?-/.test(name)){const k=name.replace(/^gn?-/,''),v=Number(el.value),twin=field((name.startsWith('gn-')?'g-':'gn-')+k),out=panel.querySelector(`[data-global-steps="${k}"]`);if(Number.isFinite(v)){if(twin)twin.value=String(v);if(out)out.textContent=k==='exposureScale'?stepsText(v):'×'+v;if(name.startsWith('g-'))try{setGlobal(k,v,{key:name,render:false});}catch(error){status(error.message,true);}}return;}
    // Neutral white sliders and picker edit live; one undo step per drag.
    if(['neutral-bright','neutral-bright-n','neutral-warm','neutral-color'].includes(name)&&lightItem()){
      try{
        const v=Number(el.value),base=field('neutral-bright')?.dataset.base||lightItem()[1];if(!Number.isFinite(v))return;
        const color=name==='neutral-color'?el.value:name.startsWith('neutral-bright')?withLightness(base==='#000000'?'#929292':base,Math.max(0,Math.min(100,v))):withWarmth(base,v);
        editLight({color},{key:name.replace('-n',''),render:false});
        if(name.startsWith('neutral-bright')){const out=panel.querySelector('[data-neutral-bright]');if(out)out.textContent=Math.round(v)+'%';const twin=field(name==='neutral-bright'?'neutral-bright-n':'neutral-bright');if(twin)twin.value=String(Math.round(v));}
        if(name==='neutral-warm'){const out=panel.querySelector('[data-neutral-warm]');if(out)out.textContent=Math.round(v*100)+'%';}
        for(const f of ['neutral-color','neutral-hex'])if(f!==name){const input=field(f);if(input)input.value=color;}
      }catch(error){status(error.message,true);}return;
    }
    if(['key-time','key-fov'].includes(name)&&selectedKey()){
      if(el.value===''||!Number.isFinite(Number(el.value)))return;
      try{requireReady();
        if(name==='key-time'){const list=moveCameraKey(keys(),keyId,Number(el.value)/shot().seconds);commit(()=>{shot().camera={keys:copy(list)};},{key:name});}
        else commit(()=>{ensureKeys().find(k=>k.id===keyId).view.fov=Math.max(15,Math.min(80,Number(el.value)));},{key:name});
        seekCamera(selectedKey().time);
      }catch(error){status(error.message,true);}return;
    }
    if(name==='key-label'&&selectedKey()){commit(()=>{ensureKeys().find(k=>k.id===keyId).label=el.value;},{key:name});return;}
    if(name==='seconds'){try{if(el.value===''||Number(el.value)<2||Number(el.value)>90)return;if(shot().motion?.clips)validateClipSchedule(shot().motion.clips,Number(el.value));validateDeskEdits(shot().deskEdits,Number(el.value));if(shot().ledStatus)validateStatus(shot().ledStatus,Number(el.value));}catch(error){el.value=shot().seconds;status(error.message,true);return;}}
    if(['name','client','volume','title','detail','seconds','transition'].includes(name)){
      commit(()=>{const target=['name','client','volume'].includes(name)?project:shot();target[name]=['volume','seconds','transition'].includes(name)?Number(el.value):el.value;},{key:name});return;
    }

  });
  panel.addEventListener('change',async event=>{
    const name=event.target.name,value=event.target.value;group=null;
    if(name==='film-chapter'){switchFilm(Number(value));return;}
    if(name==='film-cut'){switchCut(value);return;}
    if(/^gn?-/.test(name||'')){try{const k=name.replace(/^gn?-/,''),v=Number(value);if(Math.abs(globalFactor(k).value-v)<1e-6){renderPanel();return;}setGlobal(k,v);}catch(error){renderPanel();status(error.message,true);}return;}
    if(name?.startsWith('mx-')){try{await sceneLights.mixerChange(event.target,false);if(name!=='mx-gain'&&name!=='mx-color')renderSceneLights();}catch(error){renderSceneLights();status(error.message,true);}return;}
    if(name?.startsWith('sl-')){try{await sceneLights.changed(event.target);}catch(error){renderSceneLights();status(error.message,true);}return;}
    if(name?.startsWith('ly-')){try{layers.changed(event.target);}catch(error){renderLayers();status(error.message,true);}return;}
    if(name?.startsWith('pp-')){try{await sceneProps.changed(event.target);}catch(error){renderSceneProps();status(error.message,true);}return;}
    if(name?.startsWith('pe-')){try{await scenePeople.changed(event.target);}catch(error){renderPeople();status(error.message,true);}return;}
    if(name?.startsWith('br-')){try{branding.changed(event.target);}catch(error){renderBranding();status(error.message,true);}return;}
    if(name?.startsWith('dk-')){if(event.target.type==='range'){renderSceneDesks();return;}try{deskSel.changed(event.target);}catch(error){renderSceneDesks();status(error.message,true);}return;}
    if(name?.startsWith('fr-')){if(event.target.type==='range'){renderPanel();return;}try{floorRefl.changed(event.target);}catch(error){renderPanel();status(error.message,true);}return;}
    if(name==='light-selected'){const [kind,id]=value.split(':');if(id)selectLight(kind,id);else{lightSel=null;renderPanel();renderTimeline();}return;}
    if(name==='room-light'){try{const v=Number(value);if(value===''||!Number.isFinite(v)||v<0||v>2)throw Error('Room light level runs from 0 to 2.');putLighting({roomLight:v});status('Room light level set to '+v+'.');}catch(error){renderPanel();status(error.message,true);}return;}
    if(name?.startsWith('tod-')){
      try{
        const T=timeOfDay(),item=lightItem();if(!T||!item)return;let next={...item};
        if(name==='tod-time'){const n=Number(value);if(value===''||!Number.isFinite(n)||n<0||n>shot().seconds)throw Error('Enter a time inside the chapter.');if(T.keys.some(k=>k.id!==item.id&&Math.abs(k.at-n)<.001))throw Error('There is already a time-of-day key at that time.');next.at=n;}
        if(name==='tod-mode')next.mode=value;if(name==='tod-ease'){if(value==='smooth')next.ease='smooth';else delete next.ease;}
        putTod(T.keys.map(k=>k.id===item.id?next:k));seekCamera(next.at/shot().seconds);
        status(name==='tod-time'?`Time-of-day key moved to ${r2(next.at)} s.`:name==='tod-mode'?`Time-of-day key set to ${roomModes().find(m=>m.id===next.mode)?.label||next.mode}.`:'Time-of-day blend changed.');
      }catch(error){renderPanel();status(error.message,true);}
      return;
    }
    if(name?.startsWith('light-')||name?.startsWith('neutral-')){
      try{
        if(['neutral-bright','neutral-bright-n','neutral-warm','neutral-color'].includes(name)){renderPanel();return;}
        const n=Number(value),need=()=>{if(value===''||!Number.isFinite(n)||n<0)throw Error('Enter a time in seconds.');return n;};
        const change=name==='light-kind'?{kind:value,...(value==='wheels'&&!lightItem().mode?{mode:3}:{})}:name==='light-mode'?{mode:Number(value)}:name==='light-at'?{at:need()}:name==='light-dur'?{dur:Math.max(.05,need())}:name==='light-fade'?{fade:need()}:name==='light-fadein'?{fadeIn:need()}:name==='neutral-time'?{time:Math.min(shot().seconds,need())}:null;
        if(name==='neutral-hex'){const hex=value.trim().replace(/^#?/,'#').toLowerCase();if(!/^#[0-9a-f]{6}$/.test(hex))throw Error('Enter a colour as #rrggbb.');editLight({color:hex});}
        else if(change)editLight(change);
        const item=lightItem();if(item)seekCamera((Array.isArray(item)?item[0]:item.at)/shot().seconds);
      }catch(error){renderPanel();status(error.message,true);}
      return;
    }
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
  timeline.addEventListener('click',event=>deskVersions.click(event));
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
    try{if(d.moved){deskEditor.clearSelection();reveal('camera');const list=moveCameraKey(keys(),d.id,d.time);commit(()=>{shot().camera={keys:copy(list)};keyId=d.id;},{render:true});seekCamera(d.time);status('Camera keyframe moved.');}else selectKey(d.id);}catch(error){renderTimeline();status(error.message,true);}
  });
  timeline.addEventListener('pointercancel',()=>{keyDrag=null;renderTimeline();});
  timeline.addEventListener('dblclick',event=>{if(!event.target.closest('.timeline-resize'))return;if(timelineFitted){document.body.style.removeProperty('--director-timeline-height');timelineFitted=false;requestAnimationFrame(()=>renderTimeline());}else{fitTimeline();requestAnimationFrame(()=>renderTimeline());}});
  // F: Live / Film look / Split; G: thirds and title-safe guides.
  // Also bound in the stage frame (after an orbit the keys go there).
  // Which contexts of the action table are live: whatever is selected right now (director-actions.mjs SECTIONS).
  function activeShortcuts(){
    const a=new Set();
    try{
      if(keyId)a.add('camera');
      if(deskEditor.selectedId())a.add('desk-clip');
      if(titleEditor.selectedId())a.add(titleEditor.editing()?'shape':'title');
      if(inspector==='graphics'&&timeline.querySelector('[data-graphic-clip]'))a.add('graphic');
      if(lightSel)a.add('light-clip');
      if(sceneLights.selected())a.add('light');
      if(sceneProps.selected())a.add('prop');
      if(scenePeople.selected()){a.add('person');if(document.querySelector('.ps-row'))a.add('person-keys');}
      if(scenePeople.posing())a.add('pose');
      if(picked())a.add('group');
      if(still.open)a.add('still');
    }catch{}
    return a;
  }
  // ---- P4 timeline (timeline-ui.mjs): continuous zoom, Ctrl+wheel at the pointer, zoom to the selection, the playhead
  // followed page by page, the film timecode, markers (M) and the loop range (B / N, Alt+X), [ / ] to the playhead,
  // T / F9 the camera key's interpolation, and ?debug=timeline (the real renderTimeline time in the foot).
  function laneWidth(){return Math.max(300,(timeline.clientWidth||1200)-150);}
  function zoomMax(){return maxZoom(shot().seconds,laneWidth());}
  function setZoom(next,anchorPx=null){
    const v=timeline.querySelector('.timeline-viewport');if(!v)return;const was=zoom,width=v.scrollWidth,px=anchorPx??v.clientWidth/2,frac=(v.scrollLeft+px)/Math.max(1,width);
    zoom=clampZoom(next,shot().seconds,laneWidth());if(zoom<1.02)zoom=1;if(Math.abs(zoom-was)<1e-6)return;renderTimeline();
    const n=timeline.querySelector('.timeline-viewport');n.scrollLeft=Math.max(0,frac*n.scrollWidth-px);syncPan();
  }
  timeline.addEventListener('wheel',event=>{
    const v=event.target.closest('.timeline-viewport');if(!v)return;
    if(event.ctrlKey||event.metaKey){event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.0025),event.clientX-v.getBoundingClientRect().left);return;}
    if(event.shiftKey&&!event.deltaX){event.preventDefault();v.scrollLeft+=event.deltaY;syncPan();}
  },{passive:false});
  function selectionRange(){
    const s=shot().seconds;if(keyId){const k=selectedKey();if(k)return [k.time*s-1,k.time*s+1];}
    const c=deskEditor.selectedId()&&deskEditor.motion().clips.find(x=>x.id===deskEditor.selectedId());if(c)return [c.start,c.start+c.duration];
    const t=titleEditor.range?.();if(t)return t;const g=graphics.selected?.();if(g!==null&&g!==undefined&&g!==-1){const r=graphics.range?.(g);if(r)return r;}
    return null;
  }
  function zoomToSelection(){
    const r=selectionRange();if(!r){status('Select a camera view, a move, a title or a graphic first: Z zooms to it.');return;}
    const s=shot().seconds,len=Math.max(.5,r[1]-r[0]);zoom=clampZoom(s/(len*1.4),s,laneWidth());renderTimeline();
    const v=timeline.querySelector('.timeline-viewport');v.scrollLeft=Math.max(0,((r[0]+r[1])/2)/s*v.scrollWidth-v.clientWidth/2);syncPan();
  }
  function followPage(){
    if(zoom<=1||!bridge.playback().playing)return;const v=timeline.querySelector('.timeline-viewport');if(!v)return;
    const x=playhead*v.scrollWidth;if(x>v.scrollLeft+v.clientWidth-30||x<v.scrollLeft+150){v.scrollLeft=Math.max(0,x-170);syncPan();}
  }
  function timecodeNow(){const m=scoreModel();return m?filmTimecode(playhead*shot().seconds,{start:m.start,bars:m.bars,beats:m.beats}):'';}
  // markers and the loop range: Vico's aids, kept in this browser per cut and chapter (never in the cut)
  function markKey(){return `${cutDir||project.id}:${shot().id}`;}
  function markers(){return loadUi().markers?.[markKey()]||[];}
  function setMarkers(list){const all={...(loadUi().markers||{})};all[markKey()]=list;saveUi({markers:all});renderTimeline();}
  var loopRanges=new Map();
  function loopRange(){return loopRanges?.get(markKey())||null;}
  function rulerMarksHtml(){
    const s=shot().seconds,r=loopRange();
    return '<div class="tl-bake" data-tl-bake title="Preview video"></div>'+(r?`<div class="tl-loop" style="left:${r.start/s*100}%;width:${(r.end-r.start)/s*100}%" title="Loop range ${r.start.toFixed(2)}–${r.end.toFixed(2)} s (B / N set it, Alt+X clears it; with Loop on, Space plays it)"></div>`:'')
      +markers().map(t=>`<i class="tl-marker" style="left:${t/s*100}%" title="Marker at ${t.toFixed(2)} s (M on it removes it; Shift+↑/↓ jump)"></i>`).join('');
  }
  function playLoopRange(){const r=loopRange();if(!r||!bridge.playback().loop)return false;bridge.previewRange(project,selected,{start:r.start,end:r.end,id:'loop-range',label:'Loop range'}).catch(error=>status(error.message,true));return true;}
  // [ / ]: the selection's start / end to the playhead
  function toPlayhead(edge){
    const s=shot().seconds,t=playhead*s;
    if(keyId){requireReady();const list=moveCameraKey(keys(),keyId,playhead);commit(()=>{shot().camera={keys:copy(list)};},{render:true,key:'key-to-playhead'});status('Camera view moved to the playhead.');return;}
    const c=deskEditor.selectedId()&&deskEditor.motion().clips.find(x=>x.id===deskEditor.selectedId());
    if(c){deskEditor.nudge(edge==='start'?t-c.start:t-(c.start+c.duration));return;}
    const r=titleEditor.range?.();if(r&&titleEditor.nudgeTime(edge==='start'?t-r[0]:t-r[1]))return;
    status('Select a camera view, a move or a title: [ puts its start on the playhead, ] its end.');
  }
  var EASES=['smooth','linear','hold'];
  function setKeyEasing(next){const k=selectedKey();if(!k)throw Error('Select a camera view first.');const e=next||EASES[(EASES.indexOf(k.easing)+1)%EASES.length];commit(()=>{const x=ensureKeys().find(x=>x.id===keyId);if(x)x.easing=e;},{render:true});status(`Camera view: ${({smooth:'smooth move (Easy Ease)',linear:'linear move',hold:'hold, then cut'})[e]} to the next view.`);}
  var debugTimeline=new URLSearchParams(location.search).get('debug')==='timeline';
  // ---- P6 Isolate (/): only the selection in the view (Rhino's Isolate). The other props of the room are hidden in
  // this view only, kept hidden while it is on (the room may redraw them), and all come back on /, Esc or a chapter
  // change. People stay (the film's cast moves on its own clock). The film and the cut are not affected.
  var isolated=null,isolateTimer=0;
  function isolate(on){
    const w=bridge.stage()?.window?.()||document.getElementById('stage')?.contentWindow,room=w?.ErgoFlex?.workspaceRoom;
    if(!on){clearInterval(isolateTimer);if(isolated)for(const [o,v] of isolated)o.visible=v;isolated=null;renderPills();bridge.stage()?.wake?.(300);status('Isolate off: everything is back.');return;}
    const keep=nav&&(sceneProps.object?.()||scenePeople.object?.()||sceneLights.object?.()||deskSel.object?.());if(!keep||!room?.assets){status('Select a prop, a person, a light or a desk, then / shows it alone.');return;}
    const inKeep=o=>{for(let p=o;p;p=p.parent)if(p===keep)return true;for(let p=keep;p;p=p.parent)if(p===o)return true;return false;};
    isolated=new Map();const hide=()=>{for(const o of room.assets())if(!inKeep(o)){if(!isolated.has(o))isolated.set(o,o.visible);o.visible=false;}bridge.stage()?.wake?.(200);};
    hide();isolateTimer=setInterval(hide,250);renderPills();status('Isolated: only the selection is shown (/ or Esc brings the rest back).');
  }
  addEventListener('keydown',e=>{if(e.key==='Escape'&&isolated&&!e.target?.closest?.('input,textarea,select'))isolate(false);});
  // ---- right-click menus on the timeline (P4): camera views, desk moves, the ruler, lane groups
  const ctx=createContextMenu();
  const safe=fn=>()=>{try{const r=fn();if(r?.catch)r.catch(error=>status(error.message,true));}catch(error){status(error.message,true);}};
  timeline.addEventListener('contextmenu',event=>{
    if(event.target.closest('[data-sk],input,select,textarea'))return;
    const k=event.target.closest('.camera-key[data-key]'),c=event.target.closest('[data-desk-clip]'),r=event.target.closest('.time-ruler'),g=event.target.closest('.lane-group-head');
    if(!k&&!c&&!r&&!g)return;event.preventDefault();const x=event.clientX,y=event.clientY;
    if(k){
      if(keyId!==k.dataset.key)selectKey(k.dataset.key);const key=selectedKey();if(!key)return;
      ctx.open(x,y,[{label:'Go to this view',run:safe(()=>action('key-go'))},{label:'Update from the 3D view',hint:'U',run:safe(()=>action('key-update'))},{label:'Preview the move to the next',run:safe(()=>action('key-preview'))},'-',
        ...['smooth','linear','hold'].map(e=>({label:{smooth:'⧗ Smooth (Easy Ease)',linear:'◆ Linear',hold:'■ Hold, then cut'}[e],checked:key.easing===e,hint:e==='smooth'?'F9':'',run:safe(()=>setKeyEasing(e))})),'-',
        {label:'Move to the playhead',hint:'[',run:safe(()=>toPlayhead('start'))},{label:'Duplicate',hint:'Ctrl+D',run:safe(()=>action('key-duplicate'))},{label:'Zoom to it',hint:'Z',run:safe(zoomToSelection)},'-',{label:'Delete',hint:'Delete',run:safe(()=>action('key-delete'))}],key.label);
      return;
    }
    if(c){
      if(deskEditor.selectedId()!==c.dataset.deskClip)deskEditor.select(c.dataset.deskClip);
      ctx.open(x,y,[{label:'Play this move',hint:'Shift+Space',run:safe(()=>deskEditor.preview())},'-',{label:'Start at the playhead',hint:'[',run:safe(()=>toPlayhead('start'))},{label:'End at the playhead',hint:']',run:safe(()=>toPlayhead('end'))},
        {label:'Nudge a frame earlier',hint:'Alt+←',run:safe(()=>nudgeSelection(-1,false))},{label:'Nudge a frame later',hint:'Alt+→',run:safe(()=>nudgeSelection(1,false))},'-',
        {label:'Duplicate',hint:'Ctrl+D',run:safe(()=>deskEditor.duplicate())},{label:'Zoom to it',hint:'Z',run:safe(zoomToSelection)}],'Desk move');
      return;
    }
    if(r){
      const box=r.getBoundingClientRect(),t=Math.max(0,Math.min(shot().seconds,(x-box.left)/box.width*shot().seconds)),near=markers().find(m=>Math.abs(m-t)<shot().seconds*6/box.width);
      ctx.open(x,y,[{label:'Move the playhead here',run:safe(()=>seekCamera(t/shot().seconds))},near!==undefined?{label:`Remove the marker at ${near.toFixed(2)} s`,run:safe(()=>setMarkers(markers().filter(m=>m!==near)))}:{label:'Add a marker here',hint:'M',run:safe(()=>setMarkers([...markers(),Math.round(t*1000)/1000].sort((a,b)=>a-b)))},'-',
        {label:'Loop from here',hint:'B',run:safe(()=>{loopRanges.set(markKey(),setLoopEnd(loopRange(),'start',t,shot().seconds));renderTimeline();})},{label:'Loop to here',hint:'N',run:safe(()=>{loopRanges.set(markKey(),setLoopEnd(loopRange(),'end',t,shot().seconds));renderTimeline();})},
        {label:'Clear the loop range',hint:'Alt+X',disabled:!loopRange(),run:safe(()=>runKey('loop-clear'))},'-',{label:'Fit the chapter',hint:'Shift+Z',run:safe(()=>action('zoom-fit'))}],`${t.toFixed(2)} s`);
      return;
    }
    ctx.open(x,y,[{label:'Fold every group',hint:'{',run:safe(()=>setAllGroups(true))},{label:'Unfold every group',hint:'}',run:safe(()=>setAllGroups(false))}]);
  });
  // ---- P5 "changed from the film": a ↺ by every chapter field that differs from the film's own chapter (filmShot),
  // a ● on every lane group that does, and Shift+U's "changed" step (only those groups). A ↺ puts the film's value back
  // through the field's own change handler (its checks, one undo step).
  function filmValue(name){return filmFieldValue(filmShot(),name);}
  function fieldChanged(name){return filmFieldChanged(shot(),filmShot(),name);}
  function decorateChanged(){
    if(!filmShot())return;const page=panel.querySelector('[data-inspector-page="chapter"]');if(!page)return;
    for(const name of CHAPTER_FIELDS){
      const el=page.querySelector(`[name="${name}"]`),label=el?.closest('label');if(!label)continue;
      const on=fieldChanged(name);label.classList.toggle('field-changed',on);label.querySelector('.field-reset')?.remove();
      if(on){const v=filmValue(name),shown=typeof v==='string'?(v.length>40?v.slice(0,40)+'…':v):String(v);label.insertAdjacentHTML('beforeend',`<button type="button" class="field-reset" data-action="field-reset" data-section="${name}" title="Back to the film's ${escape(shown)}" aria-label="Back to the film's value">↺</button>`);}
    }
  }
  function resetField(name){
    const v=filmValue(name),el=panel.querySelector(`[data-inspector-page="chapter"] [name="${name}"]`);if(v===undefined||!el)return;
    el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    status(`${name[0].toUpperCase()+name.slice(1)}: back to the film's.`);
  }
  function groupChanged(g){return filmGroupChanged(shot(),filmShot(),g);}
  function decorateGroups(){
    for(const head of timeline.querySelectorAll('.lane-group-head[data-lane-group]')){
      const g=head.dataset.laneGroup,on=groupChanged(g),body=timeline.querySelector(`[data-lane-body="${g}"]`);head.classList.toggle('group-changed',on);body?.classList.toggle('group-changed',on);
      const b=head.querySelector('[data-action="group-toggle"]');if(b&&on&&!b.querySelector('.changed-dot'))b.insertAdjacentHTML('beforeend',' <i class="changed-dot" title="Changed from the film">●</i>');
    }
  }
  // ---- SOUND (P2, score-track.mjs): the film cut's score under the lanes; it plays with the playhead when Sound is on
  var score=null,scoreFor=null,scoreCache=null;
  var scorePlayer=cutDir?createScorePlayer({base:cutDir}):null;
  if(cutDir)Promise.all(['tempo-map','peaks','inputs'].map(n=>fetch(`${cutDir}/score/${n}.json`).then(r=>r.ok?r.json():null).catch(()=>null))).then(([tempo,peaks,inputs])=>{if(!tempo)return;score={tempo,peaks,inputs};scoreFor=null;if(open)renderTimeline();});
  function scoreModel(){if(!score||!film)return null;const id=shot()?.id;if(scoreFor!==id){scoreFor=id;scoreCache=chapterScore(score.tempo,id,{peaks:score.peaks,inputs:score.inputs});}return scoreCache;}
  try{const v=Number(loadUi().scoreVolume);if(Number.isFinite(v)&&scorePlayer)scorePlayer.setVolume(v);}catch{}
  var SFX_LANE={'lift-up':'lift','lift-down':'lift','tilt-extend':'tilt','tilt-retract':'tilt',wheels:'wheels'},SFX_NAME={'lift-up':'Lift up','lift-down':'Lift down','tilt-extend':'Tilt out','tilt-retract':'Tilt in',wheels:'Wheels'};
  function soundGroup(){
    const m=scoreModel();if(!m)return '';const s=shot().seconds,pct=t=>(t/s*100).toFixed(3)+'%',stale=staleness(score.inputs,m.id,{seconds:s})||(score.inputs?.wav_sha256&&score.tempo.wav_sha256&&score.inputs.wav_sha256!==score.tempo.wav_sha256?'The score was rebuilt after its preview: run tools/experience/build-score-preview.py on this cut':null);
    const section=m.sections.find(x=>x.t0<=playhead*s&&x.t1>playhead*s)||m.sections[0],vol=Math.round((scorePlayer?.volume()??.8)*100);
    const sections=m.sections.map(x=>`<span class="score-section" style="left:${pct(Math.max(0,x.t0))};width:${pct(Math.min(s,x.t1)-Math.max(0,x.t0))}" title="${escape(x.name)}${x.bpm?' · '+x.bpm+' BPM':''}${x.chords?' · '+x.chords.join(' '):''}">${escape(x.name)}</span>`).join('');
    const sync=m.sync.map(p=>`<i class="score-sync ${Math.abs(p.off)>.25&&!p.knot?'off':''}" style="left:${pct(p.t)}" title="${escape(p.kind)} at ${p.t.toFixed(2)} s: ${p.knot?'on the grid (knot)':p.off+' beat off the grid'}"></i>`).join('');
    const sfx=m.sfx.map((x,i)=>`<button type="button" class="sfx-block sfx-${escape(SFX_LANE[x.kind]||'other')}" data-sfx="${i}" style="left:${pct(Math.max(0,x.t))};width:${pct(Math.min(s,x.t+x.dur)-Math.max(0,x.t))}" title="${escape(SFX_NAME[x.kind]||x.kind)}: ${x.t.toFixed(2)}–${(x.t+x.dur).toFixed(2)} s · click: the movement that makes it">${escape(SFX_NAME[x.kind]||x.kind)}</button>`).join('');
    return `${laneGroupHead('sound')}<div class="lane-group-body desk-lanes sound-lanes" data-lane-body="sound" ${groupClosed('sound')?'hidden':''}>
      <div class="desk-lane-row score-row" data-lane-color="sound"><span class="desk-lane-label" title="The film's score for this chapter (preview only: the film is not affected)">Music <small>${escape(section?section.name:'')}${m.bpm?' · '+Math.round(m.bpm*10)/10+' BPM':''}</small><span class="score-tools"><canvas class="score-meter" data-score-meter width="6" height="18" title="Level"></canvas><input type="range" name="score-volume" min="0" max="100" value="${vol}" aria-label="Preview volume (not in the film)" title="Preview volume ${vol} % (preview only, not in the film)"></span>${stale?`<em class="score-stale" title="${escape(stale)}">stale</em>`:''}</span>
        <div class="desk-lane score-lane" data-score-lane>${m.peaks?'<canvas data-score-wave></canvas>':'<p class="lane-empty">No waveform yet: run tools/experience/build-score-preview.py on this cut.</p>'}${sections}${sync}${m.musicFrom!=null?`<i class="score-from" style="left:${pct(m.musicFrom)}" title="The music starts at ${m.musicFrom} s"></i>`:''}<div class="camera-track-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div></div>
      <div class="desk-lane-row sfx-row ${m.sfx.length?'':'empty'}" data-lane-color="sfx"><span class="desk-lane-label" title="The desk's movement sounds in the score, where its moves are in the picture">Movement sounds <small>${m.sfx.length||''}</small></span><div class="desk-lane sfx-lane">${sfx||'<p class="lane-empty">No movement sounds in this chapter (film rule).</p>'}<div class="camera-track-playhead" data-shared-playhead style="left:${playhead*100}%"></div></div></div>
      ${stale?`<p class="score-stale-note" role="status">${escape(stale)}</p>`:''}</div>`;
  }
  function scoreHitsHtml(){const m=scoreModel();if(!m)return '';const s=shot().seconds;return m.hits.map(h=>`<i class="score-hit" style="left:${(h.t/s*100).toFixed(3)}%" title="Music hit: ${escape(h.name.replace('_',' '))} at ${h.t.toFixed(2)} s"></i>`).join('');}
  // the waveform, bar lines, beat ticks (12 px apart at least) and the dissolves, drawn for the lane's width
  function drawScore(){
    const m=scoreModel(),c=timeline.querySelector('[data-score-wave]');if(!m||!c)return;
    const w=Math.max(1,Math.round(c.clientWidth)),h=Math.max(1,Math.round(c.clientHeight)),dpr=devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;
    const g=c.getContext('2d');g.scale(dpr,dpr);const s=shot().seconds,x=t=>t/s*w;
    for(const d of [m.head,m.tail])if(d){const a=x(d[0]-d[1]/2),b=x(d[0]+d[1]/2);g.fillStyle='#ffffff10';g.fillRect(a,0,b-a,h);g.strokeStyle='#ffffff26';g.beginPath();for(let k=a-h;k<b;k+=6){g.moveTo(Math.max(a,k),Math.min(h,h-(Math.max(a,k)-k)));g.lineTo(Math.min(b,k+h),Math.max(0,h-(Math.min(b,k+h)-k)));}g.stroke();}
    const cols=waveColumns(m.peaks,0,s,w),mid=h/2;
    g.fillStyle='#5cd3f655';cols.forEach((v,i)=>{const y=v.peak*mid;g.fillRect(i,mid-y,1,y*2);});
    g.fillStyle='#5cd3f6bb';cols.forEach((v,i)=>{const y=v.rms*mid;g.fillRect(i,mid-y,1,y*2);});
    const beatPx=m.bpm?60/m.bpm/s*w:0;
    if(beatPx>=12){g.fillStyle='#ffffff30';for(const b of m.beats)if(b.t>=0&&b.t<=s)g.fillRect(Math.round(x(b.t)),h-5,1,5);}
    g.fillStyle='#ffffff55';for(const t of m.bars)if(t>=0&&t<=s)g.fillRect(Math.round(x(t)),0,1,h);
  }
  // follow the playhead (Sound on, this chapter playing); a seek while paused plays a grain
  function soundOn(){return open&&!!scorePlayer&&!!scoreModel()?.peaks&&document.getElementById('sound')?.getAttribute('aria-pressed')==='true';}
  function scoreSync(){
    if(!scorePlayer)return;const st=bridge.playback(),m=scoreModel();
    if(!soundOn()||!st.playing||st.index!==selected){scorePlayer.stop();return;}
    scorePlayer.load(m).then(()=>{const now=bridge.playback();if(soundOn()&&now.playing)scorePlayer.follow(playhead*shot().seconds);meterLoop();}).catch(error=>status(error.message,true));
  }
  let grainAt=0;function scoreGrain(){if(!soundOn()||bridge.playback().playing)return;const now=performance.now();if(now-grainAt<70)return;grainAt=now;const m=scoreModel();scorePlayer.load(m).then(()=>scorePlayer.grain(playhead*shot().seconds)).catch(()=>{});}
  let metering=false;function meterLoop(){if(metering)return;metering=true;const step=()=>{const c=timeline.querySelector('[data-score-meter]');if(!scorePlayer?.playing()){metering=false;if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);return;}if(c){const g=c.getContext('2d'),v=Math.min(1,scorePlayer.meter()*1.4);g.clearRect(0,0,c.width,c.height);g.fillStyle=v>.9?'#ff6b6b':'#7ee08a';g.fillRect(0,c.height*(1-v),c.width,c.height*v);}requestAnimationFrame(step);};requestAnimationFrame(step);}
  document.getElementById('sound')?.addEventListener('click',()=>setTimeout(scoreSync,0));
  timeline.addEventListener('input',event=>{if(event.target.name!=='score-volume')return;const v=Number(event.target.value)/100;scorePlayer?.setVolume(v);saveUi({scoreVolume:v});event.target.title=`Preview volume ${Math.round(v*100)} % (preview only, not in the film)`;});
  timeline.addEventListener('click',event=>{
    const b=event.target.closest('[data-sfx]');if(!b)return;const m=scoreModel(),x=m?.sfx[Number(b.dataset.sfx)];if(!x)return;
    const lane=SFX_LANE[x.kind],clip=deskEditor.motion().clips.filter(c=>c.lane===lane).sort((a,c)=>Math.abs(a.start-x.t)-Math.abs(c.start-x.t))[0];
    try{if(clip){deskEditor.select(clip.id);reveal('clip');}seekCamera(Math.max(0,x.t)/shot().seconds);status(clip?`${SFX_NAME[x.kind]||x.kind}: the movement that makes this sound is selected.`:`${SFX_NAME[x.kind]||x.kind} at ${x.t.toFixed(2)} s.`);}catch(error){status(error.message,true);}
  });
  addEventListener('resize',()=>{if(open)drawScore();});
  // ---- the app bar and the mode pills (P1b, director-appbar.mjs)
  const closeMenus=wireMenus(appbar);
  function pressed(id){return document.getElementById(id)?.getAttribute('aria-pressed')==='true';}
  function renderAppBar(){
    if(!shellOn()||!open){appbar.hidden=true;return;}appbar.hidden=false;
    if(appbar.querySelector('.ab-pop:not([hidden])')||appbar.contains(document.activeElement)&&document.activeElement.matches('select'))return;   // (not while a menu or a select is open)
    const st=bridge.playback(),q=document.getElementById('preview-quality');
    appbar.innerHTML=appBarHtml({picker:filmPicker(),name:project.name,undo:{n:undo.length,label:undoLabels.at(-1)?editLabel(undoLabels.at(-1)):''},redo:{n:redo.length,label:redoLabels.at(-1)?editLabel(redoLabels.at(-1)):''},
      studio:studioSync.html(),playing:st.playing&&st.index===selected,busy:st.busy,sound:pressed('sound'),lowres:q&&!q.hidden?pressed('preview-quality'):null,film:!!film,
      history:[...undoLabels].reverse().map(editLabel),titles:film&&titleEditor.has()?titleEditor.shown():document.body.classList.contains('preview-titles'),chapters:!timeline.classList.contains('chapters-hidden'),
      inspector:!document.body.classList.contains('inspector-hidden'),timeline:!document.body.classList.contains('timeline-hidden'),
      overlays:{guides:!!document.querySelector('.film-look.guides'),crop:CROPS?.[cropAt]?.[0]||null,look:filmLook?.mode?.()||null,lights:!!sceneLights.showing?.()}});
    syncFilm();
  }
  appbar.addEventListener('click',event=>{
    const proxy=event.target.closest('[data-ab-proxy]');if(proxy){document.getElementById(proxy.dataset.abProxy)?.click();setTimeout(renderAppBar,0);proxy.blur();return;}
    const back=event.target.closest('[data-ab-undo]');if(back){const n=Number(back.dataset.abUndo);(async()=>{for(let i=0;i<n&&undo.length;i++)await action('undo');})().catch(error=>status(error.message,true));return;}
    const b=event.target.closest('button[data-action]');if(!b)return;b.blur();
    Promise.resolve(action(b.dataset.action,b.dataset.section??Number(b.dataset.index))).then(()=>setTimeout(renderAppBar,0)).catch(error=>status(error.message,true));
  });
  appbar.addEventListener('change',event=>{
    if(event.target.name==='film-chapter'){switchFilm(Number(event.target.value));return;}
    if(event.target.name==='film-cut'){switchCut(event.target.value);return;}
  });
  // the pills at the timeline's foot: every mode that is on, a click turns it off (Snap always shows)
  function renderPills(){
    const host=timeline.querySelector('[data-sb-pills]');if(!host)return;
    const st=bridge.playback(),body=document.body.classList;let free=false;try{free=freeView();}catch{}
    const posing=scenePeople.posing?.(),auto=posing&&(()=>{try{return localStorage.getItem('ergoflex.director.autoKey')==='1';}catch{return false;}})();
    const pills=[{id:'snap',label:magnet?`Snap ${typeof snapStep==='string'?snapStep:snapStep?snapStep+' s':'edges'}`:'Snap off',on:magnet,always:true,title:'Snapping (S): click to turn it '+(magnet?'off':'on')},
      {id:'loop',label:'Loop',on:!!st.loop,title:'Loop is on (L)'},{id:'space',label:spaceNow()==='local'?'Gizmo: Object':'Gizmo: World',on:spaceNow()==='local',always:true,title:'The move gizmo\'s frame: click for '+(spaceNow()==='local'?'World':'Object')},{id:'free',label:'Free view',on:free,warn:true,title:'Not the film camera (0 goes back)'},{id:'filter',label:laneFilter==='busy'?'Lanes: with something':laneFilter==='changed'?'Lanes: changed':'Lanes: selection only',on:!!laneFilter,warn:true,title:'Shift+U: click to show every lane'},{id:'isolate',label:'Isolated',on:!!isolated,warn:true,title:'Only the selection is shown: click to bring the rest back'},{id:'lock',label:'🔒 Camera locked to view',on:!!lockCamera,warn:true,title:'Moving the view updates the selected camera view: click to unlock'},{id:'speed',label:(st.rate===.5?'½':st.rate===.25?'¼':'1')+'× speed',on:(st.rate||1)!==1,warn:true,title:'Play speed: click for normal'},
      {id:'auto',label:'● Auto-key',on:!!auto,warn:true,title:'Pose mode: every change keys the pose (Shift+K)'},
      {id:'lowres',label:'Low-res',on:pressed('preview-quality'),title:'The preview runs at a lower resolution'},{id:'muted',label:'Muted',on:!pressed('sound'),title:'Sound is off (Shift+M)'},
      {id:'inspector',label:'Side column hidden',on:body.contains('inspector-hidden'),title:'Tab brings it back'},{id:'timeline',label:'Timeline hidden',on:body.contains('timeline-hidden'),title:'Shift+Tab brings it back'}];
    const sig=JSON.stringify(pills.map(p=>[p.label,p.on]));if(host.dataset.sig===sig)return;host.dataset.sig=sig;
    host.innerHTML=statusBarHtml('',pills).replace(/^<span class="sb-text"[^>]*><\/span>/,'');
  }
  timeline.addEventListener('click',event=>{
    const p=event.target.closest('[data-sb-pill]');if(!p)return;event.stopPropagation();
    const id=p.dataset.sbPill;try{({snap:()=>action('magnet'),loop:()=>action('preview-loop'),free:()=>runKey('film-camera'),space:()=>runKey('gizmo-space'),speed:()=>{bridge.setRate?.(1);scorePlayer?.setRate(1);},isolate:()=>isolate(false),filter:()=>setLaneFilter(''),lock:()=>runKey('lock-camera'),auto:()=>runKey('pose-auto-key'),lowres:()=>document.getElementById('preview-quality')?.click(),muted:()=>document.getElementById('sound')?.click(),inspector:()=>action('inspector'),timeline:()=>action('ab-timeline')})[id]?.();}catch(error){status(error.message,true);}
    setTimeout(()=>{renderPills();renderAppBar();},0);
  },true);
  // Review mode (Ctrl+`): the film frame alone, the whole window, playing; Esc or Ctrl+` comes back.
  function review(on){
    document.body.classList.toggle('df-review',on);
    if(on){keysPanel.close();palette.close();if(!bridge.playback().playing)action('chapter-toggle');status('Review mode: Esc or Ctrl+` comes back.');}
    window.dispatchEvent(new Event('resize'));
  }
  addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('df-review')){event.preventDefault();event.stopImmediatePropagation();review(false);}},true);
  // ` maximises the panel under the pointer: the 3D view (both side panels away), the timeline (taller); again: back
  let pointerOver='view';document.addEventListener('pointermove',ev=>{pointerOver=timeline.contains(ev.target)?'timeline':panel.contains(ev.target)?'panel':'view';},{passive:true});
  function maximise(){
    const body=document.body.classList;
    if(body.contains('df-max-view')||body.contains('df-max-timeline')){body.remove('df-max-view','df-max-timeline','inspector-hidden','timeline-hidden');status('Back to the full layout.');}
    else if(pointerOver==='timeline'){body.add('df-max-timeline');status('Timeline maximised: ` again comes back.');}
    else if(pointerOver==='panel'){status('The side column has a fixed width; Tab hides it, ` over the view or the timeline maximises those.');return;}
    else{body.add('df-max-view','inspector-hidden','timeline-hidden');status('3D view maximised: ` again comes back.');}
    renderAppBar();renderPills();window.dispatchEvent(new Event('resize'));
  }
  // ---- the keyboard (17 Nov 2026): one dispatcher for the Director's keys, on this page and the stage's (the 3D view).
  // director-actions.mjs says what a key means now (the selected item, a modal tool, what has focus); the rows it owns
  // run here (runKey); an editor's own rows (Delete, Esc, J/K, End, the shape keys…) are left to that editor's handler.
  // Keys work whatever was clicked last (a button no longer swallows Space or the arrows); typing is left alone.
  // Vico's own keys (the panel's Edit keys), laid over the table; the action log (the last 50, for repeat and reports)
  let bindings=loadUi().keys||{},boundTable=effectiveActions(bindings);
  const table=()=>boundTable,setBindings=next=>{bindings=next||{};boundTable=effectiveActions(bindings);saveUi({keys:bindings});};
  const actionLog=createActionLog(),pageErrors=captureErrors(window);
  const labelOf=id=>boundTable.find(r=>r.id===id)?.label||id;
  function runLogged(id,via,ctx){try{runKey(id,null,ctx);actionLog.add(id,labelOf(id),via);keysPanel.flash(id);}catch(error){status(error.message,true);}}
  const keysPanel=createKeysPanel({run:(id,ctx)=>runLogged(id,'panel',ctx),active:()=>liveContexts(),table,bindings:()=>bindings,setBindings,
    resolveAt:ev=>resolveKey(ev,{items:liveContexts(),target:'other',actions:boundTable})});
  const palette=createPalette({table,live:()=>liveContexts(),run:id=>runLogged(id,'search'),last:()=>actionLog.last()});
  const reportDialog=createReportDialog({status,send:body=>sendReport(body,{download:b=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(b,null,2)],{type:'application/json'}));a.download=`director-report-${b.at.replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}}),
    collect:async({note,shot})=>{
      let screenshot=null;if(shot){try{const t=bridge.stage()?.three?.();if(t){t.renderer.render(t.scene,t.camera);screenshot=t.renderer.domElement.toDataURL('image/jpeg',.85);}}catch{}}
      let view=null;try{view=bridge.stage()?.captureCamera?.()||null;}catch{}
      return reportBody({note,url:location.href,screenshot,view,log:actionLog.list(),errors:pageErrors(),version:document.querySelector('meta[name=director-version]')?.content||null,
        selection:{chapter:shot()?.id||null,time:Math.round(playhead*shot().seconds*1000)/1000,inspector,cameraKey:keyId||null,deskClip:deskEditor.selectedId?.()||null,title:titleEditor.selectedId?.()||null,
          graphic:graphics.selected?.()??null,prop:sceneProps.selected?.()||null,person:scenePeople.selected?.()||null,light:sceneLights.selected?.()||null,contexts:[...liveContexts()],focus:focusPanel,freeView:(()=>{try{return freeView();}catch{return null;}})()}});
    }});
  const nav=createViewNav({three:()=>bridge.stage()?.three?.(),selectionObject:()=>sceneProps.object?.()||scenePeople.object?.()||sceneLights.object?.()||deskSel.object?.()||null,
    boxPick:(rect,o)=>sceneProps.boxPick(rect,o),editing:()=>open&&!sceneLights.selected()&&!scenePeople.posing(),status:t=>status(t),wake:()=>bridge.stage()?.wake?.(400)});
  const liveContexts=()=>{const a=activeShortcuts();if(keysPanel.isOpen())a.add('keys-panel');return a;};
  let focusPanel='view';const setFocus=f=>{focusPanel=f;document.body.dataset.dfFocus=f;};
  document.addEventListener('pointerdown',ev=>setFocus(timeline.contains(ev.target)?'timeline':panel.contains(ev.target)?'panel':keysPanel.element.contains(ev.target)?focusPanel:'view'),true);
  function keyState(event){
    const el=event.target;let target=targetKind(el);if(el?.closest?.('.timeline-resize'))target='range';
    return {items:liveContexts(),target,dialog:!!document.querySelector('dialog[open]'),baking:!!bridge.bakeState().baking,actions:boundTable};
  }
  function dispatchKey(event){
    if(!open||composing||event.isComposing)return;
    let row=null,state=null;try{state=keyState(event);row=resolveKey(event,state);}catch{return;}
    if(!row){keyHint(event,state);return;}
    if(row.owner!=='director')return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.repeat&&!row.repeat)return;
    try{runKey(row.id,event,row.ctx);actionLog.add(row.id,row.label,'key');keysPanel.flash(row.id);keyHint(event,state,row);}catch(error){status(error.message,true);}
  }
  // Delete in the 3D view and on the page (not in the timeline, the panel, a field or a dialog): the selected pose key
  // (or joint) in pose mode, the selected person (a selected path point first), the selected prop (a room prop is
  // hidden in this chapter). Each editor's own Delete (titles, graphics, timeline picks, keys) keeps working: those act
  // in the timeline. (These branches were the old view key handler's; keys drop 1 dropped them, 17 Nov 2026.)
  function viewDelete(event){
    if(!open||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||!['Delete','Backspace'].includes(event.key))return;
    const t=event.target;if(t?.closest?.('input,select,textarea,[contenteditable]')||timeline.contains(t)||panel.contains(t)||document.querySelector('dialog[open]'))return;
    if(scenePeople.posing()&&scenePeople.poseKeySelected()){event.preventDefault();scenePeople.remove();return;}
    if(scenePeople.selected()&&!picked()){event.preventDefault();scenePeople.remove();return;}
    if(sceneProps.selected()&&!picked()){event.preventDefault();sceneProps.hide(true);}
  }
  document.addEventListener('keydown',viewDelete);
  // "R is now Scale…": for two weeks after the keys changed, once per key per session.
  const hinted=new Set(),hintEl=Object.assign(document.createElement('div'),{className:'key-hint'});hintEl.setAttribute('role','status');document.body.append(hintEl);
  let hintTimer=0;
  function keyHint(event,state,row=null){
    if(state?.target==='text'||state?.target==='field')return;
    const c=changedHint(event);if(!c||hinted.has(c.spec))return;if(row&&(c.spec==='Ctrl+S'||row.id.startsWith('key-ease')))return;
    const ui=loadUi(),since=ui.keysSince||new Date().toISOString().slice(0,10);if(!ui.keysSince)saveUi({keysSince:since});
    if(Date.now()-Date.parse(since)>14*864e5)return;
    hinted.add(c.spec);hintEl.textContent=c.now+' (? lists every key)';hintEl.classList.add('shown');clearTimeout(hintTimer);hintTimer=setTimeout(()=>hintEl.classList.remove('shown'),4200);
  }
  const FOVS=[24,35,50];
  function runKey(id,event,ctx){
    const shift=!!event?.shiftKey,need=(ok,text)=>{if(!ok)throw Error(text);};
    switch(id){
      case 'keys-panel':case 'keys-panel-anywhere':keysPanel.toggle();return;
      case 'keys-panel-close':keysPanel.close();return;
      case 'palette':palette.toggle();return;
      case 'crop-cycle':cycleCrop();return;
      case 'copy-attrs':(ctx==='person'?scenePeople:sceneProps).copyAttrs();return;
      case 'paste-attrs':(ctx==='person'?scenePeople:sceneProps).pasteAttrs();return;
      case 'lane-filter':{const F=['','busy','sel','changed'],next=F[(F.indexOf(laneFilter)+1)%F.length];setLaneFilter(next);return;}
      case 'lock-camera':lockCamera=!lockCamera;renderPills();status(lockCamera?(keyId?'Lock camera to view: orbit, pan or zoom and the selected camera view follows (one undo step each).':'Lock camera to view is on: select a camera view, then move the view.'):'Camera no longer locked to the view.');return;
      case 'isolate':isolate(!isolated);return;
      case 'speed-down':case 'speed-up':{const R=[.25,.5,1],now=bridge.playback().rate||1,i=Math.max(0,R.findIndex(r=>Math.abs(r-now)<1e-6)),next=R[Math.max(0,Math.min(R.length-1,i+(id==='speed-up'?1:-1)))];bridge.setRate?.(next);scorePlayer?.setRate(next);renderPills();status(next===1?'Normal speed.':`Playing at ${next===.5?'½':'¼'} speed (> back up).`);return;}
      case 'overlays':{const b=appbar.querySelector('[data-ab-open="overlays"]');need(b&&!appbar.hidden,'The Overlays menu is in the app bar (the calm layout).');b.click();return;}
      case 'gizmo-space':{const next=spaceNow()==='local'?'world':'local';setSpaceAll(next);renderPills();status(next==='local'?'Gizmo: Object frame (it turns with the item).':'Gizmo: World frame (the room\'s axes).');return;}
      case 'groups-collapse':case 'groups-expand':setAllGroups(id==='groups-collapse');return;
      case 'zoom-selection':zoomToSelection();return;
      case 'marker':setMarkers(toggleMarker(markers(),playhead*shot().seconds));status('Marker '+(markers().some(t=>Math.abs(t-playhead*shot().seconds)<1/30)?'added':'removed')+' at '+(playhead*shot().seconds).toFixed(2)+' s.');return;
      case 'marker-prev':case 'marker-next':{const t=nextMarker(markers(),playhead*shot().seconds,id==='marker-prev'?-1:1);need(t!==undefined,id==='marker-prev'?'No marker before the playhead (M adds one).':'No marker after the playhead (M adds one).');seekCamera(t/shot().seconds);return;}
      case 'loop-start':case 'loop-end':{const s=shot().seconds;loopRanges.set(markKey(),setLoopEnd(loopRange(),id==='loop-start'?'start':'end',playhead*s,s));renderTimeline();const r=loopRange();status(`Loop range ${r.start.toFixed(2)}–${r.end.toFixed(2)} s${bridge.playback().loop?' · Space plays it':' · L turns loop on'}.`);return;}
      case 'loop-clear':loopRanges.delete(markKey());renderTimeline();status('Loop range cleared.');return;
      case 'to-playhead-start':case 'to-playhead-end':toPlayhead(id==='to-playhead-start'?'start':'end');return;
      case 'key-ease-cycle':setKeyEasing(null);return;
      case 'key-ease-smooth':setKeyEasing('smooth');return;
      case 'toggle-inspector':action('inspector');return;
      case 'toggle-timeline':action('ab-timeline');return;
      case 'maximise':maximise();return;
      case 'review':review(!document.body.classList.contains('df-review'));return;
      case 'repeat-last':{const l=actionLog.last();need(l,'Nothing to repeat yet.');runKey(l,null);status(`Again: ${labelOf(l)}.`);return;}
      case 'report':reportDialog.open();return;
      case 'view-persp':case 'view-top':case 'view-front':case 'view-right':{
        if(!orbitBase&&!bridge.playback().playing)orbitBase=bridge.stage()?.captureCamera()||null;
        need(nav.setView(id.slice(5)),'The 3D view is not ready yet.');status(`${{persp:'Perspective',top:'Top',front:'Front',right:'Right'}[id.slice(5)]} view (free view: 0 goes back to the film camera).`);return;}
      case 'play':if(!bridge.playback().playing&&playLoopRange())return;action('chapter-toggle');return;
      case 'step-back':case 'step-forward':{const seconds=shot().seconds;seekCamera(Math.max(0,Math.min(1,(playhead*seconds+(shift?1:1/30)*(id==='step-back'?-1:1))/seconds)));return;}
      case 'go-start':seekCamera(0);return;
      case 'go-end':seekCamera(1);return;
      case 'edit-prev':case 'edit-next':action(id);return;
      case 'chapter-prev':case 'chapter-next':{const back=id==='chapter-prev';if(film){action(back?'film-prev':'film-next');return;}const i=selected+(back?-1:1);if(i>=0&&i<project.shots.length)action('select',i);return;}
      case 'camera-add':action('key-add');return;
      case 'film-camera':seekCamera(playhead);status('Back to the film camera.');return;
      case 'undo':case 'redo':if(bridge.bakeState().baking||!deskEditor.flush())return;action(id);return;
      case 'save':action('save');return;
      case 'export':action('save-export');return;
      case 'duplicate':
        if(bridge.bakeState().baking||!deskEditor.flush())return;
        if(keyId)action('key-duplicate');else if(deskEditor.hasSelection())deskEditor.duplicate();else if(titleEditor.selectedId())titleEditor.duplicate();
        else if(scenePeople.selected()&&!scenePeople.posing())scenePeople.action('pe-duplicate').catch(error=>status(error.message,true));else status('Select a camera view, a desk move, a title or a person to duplicate.');return;
      case 'select-all':if(!bridge.bakeState().baking)pickAll();return;
      case 'select-lane':pickLane();return;
      case 'open-inspector':openSelection();return;
      case 'sound':document.getElementById('sound')?.click();return;
      case 'loop':action('preview-loop');return;
      case 'snap':action('magnet');return;
      case 'zoom-in':case 'zoom-out':case 'zoom-fit':action(id);return;
      case 'nudge-back':case 'nudge-forward':nudgeSelection(id==='nudge-back'?-1:1,shift);return;
      case 'tool-move':case 'tool-rotate':case 'tool-scale':{
        const m=id==='tool-move'?'translate':id==='tool-rotate'?'rotate':'scale';
        if(scenePeople.selected()||scenePeople.posing()){scenePeople.setMode(m);return;}
        if(sceneProps.selected()){sceneProps.setMode(m);syncLightTools();return;}
        if(sceneLights.selected()){need(m!=='scale','A light has no scale: W moves it, E aims it.');sceneLights.setMode(m==='translate'?'move':'aim');status(m==='translate'?'Gizmo: move.':'Gizmo: aim.');return;}
        status('Select a prop, a person or a light first: W move · E rotate · R scale.');return;}
      case 'frame-selection':if(!orbitBase&&!bridge.playback().playing)orbitBase=bridge.stage()?.captureCamera()||null;need(nav.frame(),'Select a prop, a person, a light or a desk to frame it. Shift+F frames the room.');status('Framed the selection (free view). 0 goes back to the film camera.');return;
      case 'frame-room':action('frame-room');return;
      case 'film-look':filmLook?.cycle();return;
      case 'guides':filmLook?.toggleGuides();return;
      case 'still':action('render-still');return;
      case 'peek':if(event)still.peek(true);return;
      case 'light-markers':sceneLights.toggleShow().then(on=>status(on?'Lights shown: click a marker to select it, W move, E aim.':'Lights hidden.'));return;
      case 'group-1':case 'group-2':case 'group-3':case 'group-4':case 'group-5':case 'group-6':case 'group-7':case 'group-8':revealGroup(Number(id.slice(6)));return;
      case 'camera-update':action('key-update');return;
      case 'lens-prev':case 'lens-next':{const k=selectedKey();need(k,'Select a camera view first.');const f=k.view.fov,next=id==='lens-prev'?FOVS.find(v=>v>f+.5):[...FOVS].reverse().find(v=>v<f-.5);if(next)action('lens-'+next);else status(`The lens is already at ${f}°.`);return;}
      case 'play-selection':{
        if(ctx==='desk-clip'&&deskEditor.preview())return;
        const r=ctx==='title'?titleEditor.range():ctx==='graphic'?graphics.range(graphics.selected()):null;
        need(r,'Select a desk move, a title or a graphic to play it.');seekCamera(Math.max(0,r[0])/shot().seconds);if(!bridge.playback().playing)action('chapter-toggle');return;}
      case 'title-nudge':{
        const k=event?.key||'ArrowRight',n=shift?10:1,vertical=k==='ArrowUp'||k==='ArrowDown',d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
        if(focusPanel==='view'||vertical){titleEditor.nudgeFrame(d.map(v=>v*n));return;}
        titleEditor.nudgeTime(d[0]*n/30);return;}
      case 'light-on':{const box=panel.querySelector('[name="sl-on"]');need(box,'Open the light in the Lighting tab to switch it.');box.click();return;}
      case 'light-solo':{const sel=sceneLights.selected(),b=sel&&[...panel.querySelectorAll('[data-action="sl-solo"]')].find(x=>x.dataset.section===sel);need(b,'Open the Lighting tab’s light mixer to solo this light.');b.click();return;}
      case 'reset-film':if(ctx==='person'){scenePeople.action('pe-reset').catch(error=>status(error.message,true));return;}sceneProps.action('pp-reset');return;
      case 'pose-mode':scenePeople.action('pe-pose-enter').catch(error=>status(error.message,true));return;
      case 'pose-key':scenePeople.keyNow('all');return;
      case 'pose-key-limb':scenePeople.keyNow('limb');return;
      case 'pose-key-delete':case 'pose-auto-key':case 'pose-reset-joint':case 'pose-reset':
        scenePeople.action({'pose-key-delete':'pe-key-delete','pose-auto-key':'pe-key-auto','pose-reset-joint':'pe-pose-reset-joint','pose-reset':'pe-pose-reset'}[id]).catch(error=>status(error.message,true));return;
    }
    throw Error('That key has nothing to do here.');
  }
  // Alt+←/→: nudge the selection one frame in time (Shift: 10 frames): a group, a camera view, a desk move or a title.
  function nudgeSelection(dir,big){
    const step=(big?10:1)/30*dir;
    if(picked()){if(!deskEditor.flush())return;shiftPicks(step,'Selection nudged');return;}
    if(keyId){requireReady();const key=selectedKey(),list=moveCameraKey(keys(),keyId,key.time+step/shot().seconds);commit(()=>{shot().camera={keys:copy(list)};},{render:true,key:'key-nudge'});seekCamera(selectedKey().time);return;}
    if(deskEditor.nudge(step))return;
    if(titleEditor.nudgeTime(step))return;
    status('Select a camera view, a desk move, a title or a group to nudge it (Alt+←/→).');
  }
  // Enter: the selection's home in the inspector, its first field focused.
  function openSelection(){
    const type=keyId?'camera':deskEditor.selectedId()?'clip':lightSel?(lightSel.kind==='neutral'?'white':lightSel.kind==='tod'?'tod':'status'):sceneLights.selected()?'light':sceneProps.selected()?'prop':scenePeople.selected()?'person':deskSel.selected()?'desk':titleEditor.selectedId()?'title':null;
    if(!type){if(inspector==='graphics'){panel.querySelector('[data-inspector-page="graphics"] input')?.focus();return;}status('Select something first; Enter opens it in the inspector.');return;}
    if(document.body.classList.contains('inspector-hidden'))document.body.classList.remove('inspector-hidden');
    reveal(type);requestAnimationFrame(()=>{const home=panel.querySelector('[data-inspector-page]:not([hidden])');home?.querySelector('input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea')?.focus({preventScroll:false});});
  }
  // 1–7: a lane group, opened and scrolled into view.
  function revealGroup(n){
    const groupOf={1:'titles',2:'motion',3:'motion',4:'people',5:'props',6:'lighting',7:'lighting',8:'sound'}[n],v=timeline.querySelector('.timeline-viewport');
    if(!groupOf||!v)return;
    if(groupClosed(groupOf)){laneGroups[groupOf]=false;if(n===1)laneGroups.graphics=false;saveGroups();renderTimeline();}
    const lane={2:'.camera-lane-row',3:'[data-desk-lane]',6:'[data-tod-lane],[data-light-lane]',7:'[data-light-lane]'}[n];
    const head=(lane&&timeline.querySelector(lane))||timeline.querySelector(`[data-lane-group="${groupOf}"]`);
    if(!head){status('That group is not in this chapter.');return;}
    const ruler=timeline.querySelector('.time-ruler-row')?.offsetHeight||0,top=head.getBoundingClientRect().top-v.getBoundingClientRect().top+v.scrollTop-ruler;
    v.scrollTop=Math.max(0,top);status(`${['','Titles & graphics','Camera','Featured desk','People','Props','World','Lights'][n]} (${n}).`);
  }
  document.addEventListener('keydown',dispatchKey,true);
  addEventListener('blur',()=>still.peek(false));
  const peekUp=e=>{if(e.key==='\\')still.peek(false);};document.addEventListener('keyup',peekUp);
  // With the still view open: Esc closes it, ←/→ step through the history (before the timeline's own keys).
  addEventListener('keydown',event=>{
    if(!open||!still.open||event.target.closest?.('input,select,textarea'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();still.close();return;}
    if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&!event.shiftKey&&!event.altKey){event.preventDefault();event.stopImmediatePropagation();still.step(event.key==='ArrowLeft'?1:-1);}
  },true);
  // The interface's scale on a big screen (director-theme.css zooms the panel and the timeline above 2200 px wide).
  function uiScale(){return Number(getComputedStyle(timeline).zoom)||1;}
  function resizeTimeline(height){document.body.style.setProperty('--director-timeline-height',Math.max(300,Math.min(innerHeight*.65,720*uiScale(),height))+'px');}
  let scrubWant=null,scrubFrame=0;
  function scrubRuler(event){
    const box=scrub.getBoundingClientRect();scrubWant=snapTime((event.clientX-box.left)/box.width*shot().seconds,{pixels:box.width,bypass:event.altKey,excludePlayhead:true})/shot().seconds;
    if(!scrubFrame)scrubFrame=requestAnimationFrame(()=>{scrubFrame=0;if(scrubWant===null)return;const t=scrubWant;scrubWant=null;try{seekCamera(t);scoreGrain();}catch(error){status(error.message,true);}});
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
    if(event.target.closest('[data-key],[data-desk-clip],[data-title-clip]'))return;
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
  function setOpen(value){deskEditor.stop();if(bridge.bakeState().baking&&!value){status('Cancel the bake before closing the editor.');return;}open=value;nav.setActive(open);if(!open){keysPanel.close();review(false);}document.body.classList.toggle('directing',open);document.body.classList.toggle('df-shell',open&&shellOn());appbar.hidden=!open||!shellOn();document.body.classList.toggle('film-frame',open&&!!film);filmLook?.visible(open);panel.hidden=timeline.hidden=!open;bridge.editMode(open);titleEditor.sync();if(open){if(matchMedia('(max-width:700px)').matches)document.body.classList.add('inspector-hidden');render();load().then(()=>{
      const url=new URL(location.href);
      if(open&&url.searchParams.get('cinematic')==='1'&&bridge.ready()){
        url.searchParams.delete('cinematic');history.replaceState(null,'',url);action('cinematic-pass');
      }else if(open&&url.searchParams.get('bakeAll')==='1'&&bridge.ready()){
        url.searchParams.delete('bakeAll');history.replaceState(null,'',url);action('bake-all');
      }
    });}else draft();}
  // Every room desk has its own Lift / Tilt timeline (desk-choreo.mjs): the open desk's clips are what the desk editor sees.
  const choreo=createChoreoTarget({realShot:()=>shot(),baseline:()=>filmShot()?effectiveDeskEdits(filmShot(),{}):null,roster:()=>bridge.ready()?bridge.stage().roomDesks?.()||[]:[],onChange:()=>{deskEditor.clearSelection();render();}});
  const deskEditor=createDeskEditor({panel,timeline,bridge,shot:choreo.shot,choreo:{...choreo,pick:id=>{if(id)deskSel.select(id,{announce:false});else deskSel.deselect();}},time:()=>playhead,seek:seekCamera,commit,render,status,preview:range=>bridge.previewRange(project,selected,range),snap:snapTime,lengthen:(seconds,motion,message,at)=>resizeChapter(seconds,{motion,message,at}),focus:tab=>{keyId=null;lightSel=null;sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();titleEditor.clear();   /* (not deskSel.deselect(): the room desk being choreographed stays open; deselecting it made a Lift added to it land on the featured desk) */if(!reveal(tab==='groove'?'clip':tab))showInspector(tab,false,!typing());}});
  const startPose=createStartPose({panel,shot,motion:()=>deskEditor.featuredMotion(),time:()=>playhead,seek:seekCamera,commit,status,ready:requireReady});
  // Render tab (film chapters only): Send = Export cut when this chapter has unexported edits, then a Render-request-*.json download.
  const downloadText=(name,text)=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
  const renderRequest=createRenderRequest({panel,cut:()=>myCut()&&!myCut().master?cutDir.replace(/^\//,''):null,chapters:()=>filmChapters,shot,signature,unexported,status,escape,storage,download:downloadText,
    exportNow:async()=>{if(await fresh.guardExport(project,true,()=>{}))return null;clearTimeout(draftTimer);try{project=library.save(project);}catch{}const text=exportCut();renderPanel();return text;}});
  // Build tab: the selected desk's (default: the featured desk's) materials, trim and accessories (desk-build-panel.mjs).
  const deskBuild=createDeskBuildPanel({panel,shot,film:filmShot,commit,status,rerender:()=>renderPanel(),ready:()=>open&&bridge.ready(),selection:()=>deskSel.selected()||'featured',versions:()=>deskVersions.has()});   // no Desks-tab selection = the featured desk; the panel's own picker stays hidden
  // Film titles: the TITLES lane, the Title inspector and the title overlay in the frame (titles-src.json beside the film list).
  const titleEditor=createTitleEditor({panel,timeline,shot,time:()=>playhead,seek:seekCamera,commit,status,render,renderTimeline,ready:requireReady,open:()=>open,
    showInspector:tab=>{if(!reveal(tab))showInspector(tab,false,!typing());},
    onSelect:()=>{for(const set of Object.values(picks))set.clear();lightSel=null;keyId=null;deskEditor.clearSelection();sceneLights.deselect();sceneProps.deselect();scenePeople.deselect();deskSel.deselect();},
    snapDelta:({raw,edges,width,seconds,alt,exclude})=>{
      const tol=8/width*seconds;
      if(magnet&&!alt){let best=null;const all=snapTargets({titles:new Set([exclude])});for(const [t,name] of all)for(const e of edges){const delta=t-e,off=Math.abs(delta-raw);if(off<=tol&&(!best||off<best.off))best={delta,off,t,name};}if(best)return {delta:best.delta,snap:best};}
      return {delta:snapGroupDelta(raw,numStep(),alt),snap:null};
    },
    dragFeedback:(d,event)=>dragFeedback(d,event),endDragFeedback:d=>endDragFeedback(d)});
  if(film)loadTitleSource(film.film).then(v=>{titleEditor.setSource(v);render();},error=>console.warn('[titles]',error.message));
  // Group gestures run in the capture phase so they take over from single-item drags.
  // Lighting items have no editor of their own: a plain drag moves (or trims) just that item.
  const viewport=()=>timeline.querySelector('.timeline-viewport');
  timeline.addEventListener('pointerdown',event=>{
    if(event.button!==0||composing||bridge.bakeState().baking)return;
    const item=event.target.closest('[data-key],[data-desk-clip],[data-light-clip],[data-light-key],[data-tod-key]');
    if(item){
      const [kind,id]=itemOf(item),light=kind==='lights'||kind==='neutrals'||kind==='tods',edge=event.target.closest('[data-resize]')?.dataset.resize;
      if(event.shiftKey||event.ctrlKey||event.metaKey){event.preventDefault();event.stopImmediatePropagation();suppressGroupClickUntil=performance.now()+400;item.focus({preventScroll:true});togglePick(kind,id);return;}
      const grouped=picks[kind].has(id);
      if(!grouped){clearPicks();if(!light)return;}
      if(edge&&!light)return;
      event.preventDefault();event.stopImmediatePropagation();
      try{requireReady();if(!deskEditor.flush())return;}catch(error){status(error.message,true);return;}
      const width=item.closest('.camera-track,[data-desk-lane],[data-light-lane]').getBoundingClientRect().width,base=groupBase();
      if(edge&&kind==='lights'){const e=base.lights.find(e=>e.id===id);lightTrim={id,edge,start:event.clientX,width,base,original:e,candidate:e,moved:false,item};}
      else groupDrag={id,kind,start:event.clientX,width,delta:0,moved:false,base,set:grouped?picks:{[kind]:new Set([id])}};
      viewport().setPointerCapture(event.pointerId);item.focus({preventScroll:true});return;
    }
    if(!event.target.closest('.timeline-content')||event.target.closest('.time-ruler,button,select,input,label,.desk-track-toolbar,.track-heading,.desk-lane-label,[data-room-line],.lamps-lane,.lane-group-head,.choreo-others'))return;
    event.preventDefault();viewport().focus({preventScroll:true});
    if(!(event.shiftKey||event.ctrlKey||event.metaKey))sceneLights.deselect();
    marquee={x:event.clientX,y:event.clientY,add:event.shiftKey||event.ctrlKey||event.metaKey,base:Object.fromEntries(Object.entries(picks).map(([k,v])=>[k,new Set(v)])),box:null};
  },true);
  let lightTrim=null;
  timeline.addEventListener('pointermove',event=>{
    if(groupDrag){
      const d=groupDrag;if(Math.abs(event.clientX-d.start)>3)d.moved=true;if(!d.moved)return;
      const [lo,hi]=groupRange(d.base,d.set),raw=(event.clientX-d.start)/d.width*d.base.seconds,m=event.altKey?null:magnetDelta(d,raw);d.snap=m;
      d.delta=Math.max(lo,Math.min(hi,m?m.delta:snapGroupDelta(raw,numStep(),event.altKey)));previewGroup(d);dragFeedback(d,event);return;
    }
    if(lightTrim){
      const d=lightTrim,s=d.base.seconds;if(Math.abs(event.clientX-d.start)>3)d.moved=true;if(!d.moved)return;
      const o=d.original,end=o.at+o.dur,raw=(event.clientX-d.start)/d.width*s,edgeT=d.edge==='start'?o.at:end,tol=8/d.width*s;let delta=snapGroupDelta(raw,numStep(),event.altKey);
      if(magnet&&!event.altKey){let best=null;for(const [t] of snapTargets({lights:new Set([o.id])})){const off=Math.abs(t-edgeT-raw);if(off<=tol&&(!best||off<best[0]))best=[off,t-edgeT];}if(best)delta=best[1];}
      const at=d.edge==='start'?Math.max(0,Math.min(end-.05,o.at+delta)):o.at,dur=d.edge==='start'?end-at:Math.max(.05,Math.min(s-o.at,o.dur+delta));
      d.candidate={...o,at:Math.round(at*1e6)/1e6,dur:Math.round(dur*1e6)/1e6};d.item.style.left=d.candidate.at/s*100+'%';d.item.style.width=d.candidate.dur/s*100+'%';
      let valid=true;try{validateStatus(d.base.lights.map(e=>e.id===o.id?d.candidate:e),s);}catch{valid=false;}d.item.classList.toggle('invalid',!valid);
      status(`${d.candidate.at.toFixed(2)}–${(d.candidate.at+d.candidate.dur).toFixed(2)}s · ${d.candidate.dur.toFixed(2)}s`,!valid);return;
    }
    hoverRow=event.target.closest?.('.desk-lane-row,.camera-lane-row')||hoverRow;
    if(!marquee)return;const m=marquee;
    if(!m.box){if(Math.hypot(event.clientX-m.x,event.clientY-m.y)<5)return;m.box=document.createElement('div');m.box.className='timeline-marquee';document.body.append(m.box);viewport().setPointerCapture(event.pointerId);const v=viewport();m.sx=v.scrollLeft;m.sy=v.scrollTop;m.timer=setInterval(()=>marqueeAt(m.px,m.py,true),40);}
    m.px=event.clientX;m.py=event.clientY;marqueeAt(m.px,m.py,false);
  });
  function marqueeAt(x,y,auto){
    const m=marquee;if(!m?.box)return;const v=viewport(),vr=v.getBoundingClientRect(),ruler=timeline.querySelector('.time-ruler-row')?.offsetHeight||0;
    // Auto-scroll within 24 px of the viewport edges.
    if(auto){const dy=y>vr.bottom-24?12:y<vr.top+ruler+24?-12:0,dx=x>vr.right-24?16:x<vr.left+140?-16:0;if(!dx&&!dy)return;v.scrollTop+=dy;v.scrollLeft+=dx;}
    const ax=m.x-(v.scrollLeft-m.sx),ay=m.y-(v.scrollTop-m.sy);
    const left=Math.min(ax,x),right=Math.max(ax,x),top=Math.min(ay,y),bottom=Math.max(ay,y);
    Object.assign(m.box.style,{left:left+'px',top:Math.max(top,vr.top)+'px',width:right-left+'px',height:Math.max(0,Math.min(bottom,vr.bottom)-Math.max(top,vr.top))+'px'});
    const cl=Math.max(left,vr.left),cr=Math.min(right,vr.right),ct=Math.max(top,vr.top+ruler),cb=Math.min(bottom,vr.bottom);
    const hit=el=>{const r=el.getBoundingClientRect();return r.right>=cl&&r.left<=cr&&r.bottom>=ct&&r.top<=cb;};
    for(const [kind,attr,data] of KINDS_ON_TIMELINE){picks[kind]=new Set(m.add?m.base[kind]:[]);for(const el of timeline.querySelectorAll(attr))if(hit(el))picks[kind].add(el.dataset[data]);}
    m.box.dataset.count=String(picked());syncPicks();
  }
  function endGroupGesture(event){
    if(groupDrag){
      const d=groupDrag;groupDrag=null;suppressGroupClickUntil=performance.now()+300;endDragFeedback(d);
      if(event.type==='pointercancel'){renderTimeline();return;}
      if(!d.moved){clearPicks();try{if(d.kind==='keys')selectKey(d.id);else if(d.kind==='clips')deskEditor.select(d.id);else selectLight(d.kind,d.id);}catch(error){status(error.message,true);}return;}
      try{shiftPicks(d.delta,d.set===picks?'Selection moved':({keys:'Camera view',clips:'Desk move',lights:'Status light',neutrals:'White key',tods:'Time-of-day key'}[d.kind]||'Item')+' moved',d.set);if(d.set!==picks)selectLight(d.kind,d.id);}catch(error){renderTimeline();status(error.message,true);}
      return;
    }
    if(lightTrim){
      const d=lightTrim;lightTrim=null;suppressGroupClickUntil=performance.now()+300;
      if(event.type==='pointercancel'||!d.moved){renderTimeline();if(!d.moved)selectLight('lights',d.id);return;}
      try{putLighting({status:d.base.lights.map(e=>e.id===d.id?d.candidate:e)});selectLight('lights',d.id);status('Light state trimmed.');}catch(error){renderTimeline();status(error.message,true);}
      return;
    }
    if(!marquee)return;const m=marquee;marquee=null;
    clearInterval(m.timer);if(m.box){m.box.remove();suppressGroupClickUntil=performance.now()+300;groupStatus();}else if(!m.add)clearPicks();
  }
  for(const type of ['pointerup','pointercancel'])timeline.addEventListener(type,endGroupGesture,true);
  timeline.addEventListener('click',event=>{if(performance.now()<suppressGroupClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  // End handle: drag the right end of the ruler to change the chapter length (0.5 s steps, Alt: free, 2-90 s).
  // Everything already placed keeps its seconds; the camera holds its last view over added time; shortening stops
  // at the end of the last item. One undo step.
  let endDrag=null;
  function chapterShortest(){
    const L=lighting(),T=timeOfDay(),s=shot().seconds,titles=(titleEditor.titles?.()||[]).map(t=>t.rel_out).filter(t=>t<s-.01);
    return chapterFloor(shot(),deskEditor.motion(),keys(),[...deskEditor.featuredMotion().clips.map(c=>c.start+c.duration),...choreo.edits().flatMap(e=>(e.clips||[]).map(c=>c.start+c.duration)),...(L?[...L.status.map(e=>e.at+e.dur),...L.neutral.map(k=>k[0])]:[]),...(T?.keys||[]).map(k=>k.at),...titles]);
  }
  function endDragMove(event){
    const d=endDrag,raw=d.seconds+(event.clientX-d.x)/d.width*d.seconds,min=event.altKey?d.floor:Math.ceil(d.floor*2-1e-9)/2;
    let v=event.altKey?Math.round(raw*100)/100:Math.round(raw*2)/2,hint='';
    if(v<min){v=min;hint=`Shortest ${Number(min.toFixed(2))} s: the last item ends there.`;}
    if(v>CHAPTER_MAX){v=CHAPTER_MAX;hint='A chapter can be 90 s at most.';}
    d.value=v;const x=d.left+v/d.seconds*d.width,vr=viewport().getBoundingClientRect(),rr=d.ruler.getBoundingClientRect();
    d.ghost.style.left=Math.min(x,innerWidth-8)+'px';d.ghost.style.top=rr.top+'px';d.ghost.style.height=Math.max(0,vr.bottom-rr.top)+'px';
    d.ghost.firstChild.textContent=`${Number(v.toFixed(2))} s${Math.abs(v-d.seconds)<1e-9?'':` (${v>d.seconds?'+':'−'}${Number(Math.abs(v-d.seconds).toFixed(2))} s)`}`;
    d.ghost.dataset.hint=hint;d.ghost.classList.toggle('limit',!!hint);
    status(hint||`Chapter length ${Number(v.toFixed(2))} s${v>d.seconds?' · the camera holds its last view over the added time':''} · Alt: free`);
  }
  timeline.addEventListener('pointerdown',event=>{
    const h=event.target.closest?.('[data-chapter-end]');if(!h||event.button!==0||composing||bridge.bakeState().baking)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{
      requireReady();if(!deskEditor.flush())return;
      const ruler=timeline.querySelector('.time-ruler'),box=ruler.getBoundingClientRect(),ghost=document.createElement('div');
      ghost.className='chapter-end-ghost';ghost.append(document.createElement('b'));document.body.append(ghost);
      endDrag={x:event.clientX,width:box.width,left:box.left,ruler,seconds:shot().seconds,value:shot().seconds,floor:chapterShortest(),ghost,h};
      h.setPointerCapture(event.pointerId);h.classList.add('dragging');endDragMove(event);
    }catch(error){status(error.message,true);}
  },true);
  timeline.addEventListener('pointermove',event=>{if(endDrag)endDragMove(event);});
  for(const type of ['pointerup','pointercancel'])timeline.addEventListener(type,event=>{
    if(!endDrag)return;const d=endDrag;endDrag=null;d.ghost.remove();d.h.classList.remove('dragging');suppressGroupClickUntil=performance.now()+300;
    if(event.type==='pointercancel'||Math.abs(d.value-d.seconds)<1e-9){status('Chapter length unchanged.');return;}
    try{resizeChapter(d.value);}catch(error){renderTimeline();status(error.message,true);}
  },true);
  // Room lane: drag the brightness / fill line up or down (×2 per 7 lane px, log scale); one undo step per drag.
  let roomDrag=null;
  timeline.addEventListener('pointerdown',event=>{const hit=event.target.closest?.('[data-room-line]');if(!hit||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();reveal('room');
    try{requireReady();const k=event.altKey?'environmentScale':hit.dataset.roomLine,box=hit.closest('svg').getBoundingClientRect();roomDrag={k,y:event.clientY,scale:34/box.height,start:globalFactor(k).value,key:'room-'+k+'-'+Date.now()};viewport().setPointerCapture(event.pointerId);}catch(error){status(error.message,true);}},true);
  timeline.addEventListener('pointermove',event=>{if(!roomDrag)return;const d=roomDrag,[,min,max]=GLOBALS[d.k],v=Math.max(min,Math.min(max,Math.round(d.start*2**(-(event.clientY-d.y)/40)*100)/100));if(v===d.last)return;d.last=v;try{setGlobal(d.k,v,{key:d.key,render:false});}catch(error){status(error.message,true);}});
  for(const type of ['pointerup','pointercancel'])timeline.addEventListener(type,()=>{if(!roomDrag)return;roomDrag=null;suppressGroupClickUntil=performance.now()+300;renderPanel();},true);
  // Shift + "+ Light" adds a neutral colour key instead of a light state.
  timeline.addEventListener('click',event=>{const b=event.target.closest('[data-action="light-add"]');if(b&&event.shiftKey){event.preventDefault();event.stopImmediatePropagation();action('light-key-add');}},true);
  // A click on the lighting lane moves the playhead, like the other lanes.
  timeline.addEventListener('click',event=>{const rail=event.target.closest('[data-light-lane]');if(!rail||event.target.closest('[data-light-clip],[data-light-key],[data-tod-key],button,[data-room-line]'))return;try{const box=rail.getBoundingClientRect();seekCamera(Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)));}catch(error){status(error.message,true);}});
  timeline.addEventListener('keydown',event=>{
    const item=event.target.closest('[data-light-clip],[data-light-key],[data-tod-key]');if(!item||!['Delete','Backspace'].includes(event.key)||picked())return;
    event.preventDefault();const [kind,id]=itemOf(item);lightSel={kind,id};action('light-delete');
  });
  document.addEventListener('keydown',event=>{
    if(!open||composing||!picked()||event.defaultPrevented||document.querySelector('dialog[open]'))return;
    const target=event.target;if(target!==document.body&&!timeline.contains(target))return;
    if(target.matches?.('input,select,textarea'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();clearPicks();groupStatus();return;}
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();try{deletePicks();}catch(error){status(error.message,true);}return;}
  },true);
  const preview=document.getElementById('stage');let previewDocument;
  function bindPreviewHistory(){
    const next=preview?.contentDocument;if(!next||next===previewDocument)return;
    previewDocument?.removeEventListener('keydown',dispatchKey,true);previewDocument?.removeEventListener('keyup',peekUp);
    previewDocument?.removeEventListener('keydown',stageEscape,true);previewDocument?.removeEventListener('keydown',viewDelete);
    // the 3D view's own page: the same dispatcher (capture, before the stage's keys), the hold key's release, Esc, focus
    previewDocument=next;previewDocument.addEventListener('keydown',dispatchKey,true);previewDocument.addEventListener('keyup',peekUp);previewDocument.addEventListener('keydown',stageEscape,true);previewDocument.addEventListener('keydown',viewDelete);
    previewDocument.addEventListener('pointerdown',()=>setFocus('view'),true);preview.contentWindow?.addEventListener('blur',()=>still.peek(false));nav.refresh();
  }
  // Esc with the 3D view focused (after clicking a prop or a light): the Director's Esc (close the still, clear the
  // selection), never the stage page's own, which leaves its full-frame tour view and re-sizes the camera (the live
  // view then no longer matched the film's framing).
  function stageEscape(event){
    if(event.key==='Escape'&&document.body.classList.contains('df-review')){event.preventDefault();event.stopImmediatePropagation();review(false);return;}
    if(event.key!=='Escape'||!open)return;event.preventDefault();event.stopImmediatePropagation();
    if(still.open){still.close();return;}
    if(picked()){clearPicks();groupStatus();return;}
    if(lightSel||keyId||deskEditor.selectedId()||sceneLights.selected()||sceneProps.selected()||scenePeople.selected()||deskSel.selected()||titleEditor.selectedId())clearSelection();
  }
  preview?.addEventListener('load',bindPreviewHistory);bindPreviewHistory();
  addEventListener('pagehide',()=>{deskEditor.stop();draft();});
  // Leaving the page with unexported edits asks first (Ctrl+W, a reload, Back). The Director's own switches (film
  // chapter, cut) have their own dialog and set `leaving`.
  // (not under automation: navigator.webdriver is set by puppeteer / WebDriver, never in a person's browser; a prompt
  // there blocks a test's reload until it times out, and the draft is kept either way)
  addEventListener('beforeunload',event=>{if(!open||leaving||!unexported())return;draft();if(navigator.webdriver)return;event.preventDefault();event.returnValue='';});
  // "Free view (not saved)": the 3D view left the film's camera keys (an orbit, a frame, a centre). 0 or a click goes back.
  const navBox=document.createElement('div');navBox.className='film-box nav-pill-box';navBox.innerHTML='<button type="button" class="nav-pill" hidden title="The view is not the film camera: what you see is not saved. Click or press 0 to go back.">Free view (not saved) · <kbd>0</kbd> film camera</button><div class="crop-guide" hidden></div><div class="nav-views" role="toolbar" aria-label="Views" hidden>'+[['film-camera','Film','The film camera (0)'],['view-persp','Persp','Perspective (Ctrl+P: persp)'],['view-top','Top','Top, looking down (Ctrl+P: top)'],['view-front','Front','Front (Ctrl+P: front)'],['view-right','Right','Right (Ctrl+P: right)']].map(([id,l,t])=>`<button type="button" data-nav-view="${id}" title="${t}">${l}</button>`).join('')+'</div>';document.body.append(navBox);
  const navViews=navBox.querySelector('.nav-views'),cropEl=navBox.querySelector('.crop-guide');
  // P6: social crop guides over the film frame (Shift+G): 9:16, 1:1, 4:5, off
  var CROPS=[null,['9:16',9/16],['1:1',1],['4:5',.8]],cropAt=0;
  function cycleCrop(){cropAt=(cropAt+1)%CROPS.length;const c=CROPS[cropAt];cropEl.hidden=!c;if(c){cropEl.style.width=(c[1]/(16/9)*100).toFixed(3)+'%';cropEl.dataset.label=c[0];}status(c?`Crop guide ${c[0]}: what a ${c[0]} post keeps of the frame (Shift+G next).`:'Crop guide off.');renderAppBar();}navViews.addEventListener('click',ev=>{const b=ev.target.closest('[data-nav-view]');if(!b)return;runLogged(b.dataset.navView,'click');b.blur();});
  const navPill=navBox.firstChild;navPill.addEventListener('click',()=>{try{runKey('film-camera');}catch(error){status(error.message,true);}navPill.blur();});
  const freeView=()=>{if(!orbitBase)return false;const v=bridge.stage()?.captureCamera?.();if(!v)return false;const a=viewNums(v),b=viewNums(orbitBase);return a.some((x,i)=>Math.abs(x-b[i])>1e-4);};
  setInterval(()=>{navViews.hidden=!open;if(!open){navPill.hidden=true;return;}nav.refresh();renderPills();try{navPill.hidden=!freeView();}catch{navPill.hidden=true;}keysPanel.refresh();},400);
  // A film chapter is a one-chapter cut: its timeline space goes to the lanes (Chapters shows the strip).
  if(film)timeline.classList.add('chapters-hidden');
  createTimelineHints({root:timeline,active:activeShortcuts,context:el=>({seconds:shot().seconds,graphic:el.dataset.graphicClip!==undefined?graphics.screens()[Number(el.dataset.graphicClip)]:null})});
  render();panel.hidden=timeline.hidden=true;
  return {open:()=>setOpen(true),close:()=>setOpen(false),isOpen:()=>open,project:()=>copy(project),select:i=>{selected=i;render();},setStatus:status,ownsSound:()=>soundOn(),transportChanged:()=>{syncTransport();scoreSync();const p=!!bridge.playback().playing;if(p!==pokedPlaying){pokedPlaying=p;if(p)orbitBase=null;filmLook?.poke();}},toggleChapter:()=>{deskEditor.stop();return action('chapter-toggle');},progress:t=>{playhead=t;followPage();if(scorePlayer?.playing()||soundOn())scoreSync();syncPlayhead();},scrubbing:()=>!!scrub||!!groupDrag,filmApplied:()=>{setTimeout(()=>{try{foldDeskProps();}catch(error){console.warn('[desk fold]',error);}},300);if(inspector==='build'&&open)renderPanel();sceneLights.applied();sceneProps.applied();scenePeople.applied();if(open)renderPeople(true);floorRefl.applied();deskSel.applied();if(open){renderSceneProps(true);renderSceneDesks(true);renderBranding(true);}},
    // Selection -> inspector home (HOMES): for lanes and tools outside this module (the Titles lane: reveal('title')).
    reveal,revealHomes:()=>({...structuredClone(HOMES),title:homeOf('title')})};
}
