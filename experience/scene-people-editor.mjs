import {cleanPeople,effectivePeople,newKey,spanText,PARTS} from './people-edits.mjs';
import {createPoseEditor} from './scene-pose-editor.mjs';
// Director "People": who is in the chapter. The People tab lists the cast; click a person in the view (or a row) to
// select them, then move / turn / scale them with the gizmo (W / E / T) or the fields, change who they are
// (character) and what they are doing (posture), set the seconds they are in the room, duplicate or remove them, and
// add people from the library. Double-click a person (or Fine-tune pose) for pose mode: the joints of that person's
// skeleton can be turned and the hands and feet dragged (scene-pose-editor.mjs). Edits go to the chapter's cut shot (shot.peopleEdits, people-edits.mjs) and reach the
// live stage, Render still and the film as the chapter's `people` (room-people.mjs). The first edit copies the cast
// the film shows into the chapter, so every person is then an entry of its own.
// The models are posed library props (assets/props/people-*.glb, catalogued in assets/props/people.json: characters,
// postures, what is built). Every character is built in every posture (tools/people/build.py --all); should one be
// missing, the studio server builds it on request (/__people/build), where that is available.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const r1=v=>Math.round(v*10)/10;
const MODES={translate:'Move',rotate:'Turn',scale:'Scale'};
const STANCES=['standing','seated','wheelchair','walking'];
const thumb=id=>`/assets/props/thumbs/${encodeURIComponent(id)}.png`;
export function createScenePeopleEditor({bridge,shot,film,commit,status,open,rerender,time=()=>0,onSelect=()=>{},lightsShowing=()=>false}){
  let sel=null,catalog=null,loading=null,tools=null,booting=null,mode='translate',busy=null,rowKeys=[],laneKeys=[],charIds=[],shown=[];
  const filters={sex:'all',age:'all',heritage:'all'},lib={query:'',sex:'all',stance:'all',aid:'all'};
  const frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow,three=()=>bridge.stage()?.three?.();
  const stagePeople=()=>win()?.ErgoFlex?.workspaceRoom?.people||null;
  const editing=()=>open()&&bridge.ready()&&!bridge.playback().playing&&!bridge.bakeState().baking;
  const seconds=()=>shot()?.seconds||0;
  // ---- the catalog
  const loadCatalog=()=>loading||=fetch('/assets/props/people.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('The people catalog is missing (assets/props/people.json).');return r.json();}).then(c=>{catalog=c;rerender();return c;},error=>{loading=null;status(error.message,true);return null;});
  const modelOf=id=>catalog?.models?.[id]||null;
  const who=id=>{const m=modelOf(id);return m&&catalog.characters[m.character]?{...catalog.characters[m.character],id:m.character}:null;};
  const poseOf=id=>{const m=modelOf(id);return m&&catalog.poses[m.pose]?{...catalog.poses[m.pose],id:m.pose}:null;};
  const personName=e=>who(e.id)?.name||cap(e.id.replace(/^people-/,'').split('-')[0]);
  const doing=e=>{const m=modelOf(e.id),p=poseOf(e.id);return p?p.label+(p.desk&&m.deskHeight?` (desk at ${m.deskHeight} in)`:''):e.id;};
  // The built model for a character in a posture (a desk posture: the height nearest the one asked for).
  function modelFor(character,pose,height=null){
    const hits=Object.entries(catalog.models).filter(([,m])=>m.character===character&&m.pose===pose);if(!hits.length)return null;
    return hits.sort((a,b)=>Math.abs((a[1].deskHeight??0)-(height??a[1].deskHeight??0))-Math.abs((b[1].deskHeight??0)-(height??b[1].deskHeight??0)))[0][0];
  }
  const wantedId=(character,pose)=>`people-${character}-${pose}`;
  // ---- the cut
  const own=()=>cleanPeople(shot()?.peopleEdits);
  // What the film shows before any edit here, as plain entries.
  function seed(){
    const f=film()?.people,live=stagePeople()?.resolved?.()||[];
    return {cast:live,when:f&&typeof f==='object'?structuredClone(f.when||{}):{},...(f?.chair?{chair:f.chair}:{}),...(f?.fade!==undefined?{fade:f.fade}:{})};
  }
  const cast=()=>(own()||seed()).cast;
  const entry=key=>cast().find(e=>e.key===key)||null;
  const spans=key=>(own()?own().when:film()?.people?.when)?.[key]||null;
  const count=()=>cast().filter(e=>!e.hide).length;
  function write(change,text,{undoKey=null}={}){
    const next=structuredClone(own()||seed());change(next);const clean=cleanPeople(next);
    if(!clean){status('That would not be a cast the film can keep.',true);rerender();return;}
    commit(()=>{shot().peopleEdits=clean;},{key:undoKey,render:false});status(text);rerender();
  }
  const edit=(key,change,text,options)=>write(p=>{const e=p.cast.find(e=>e.key===key);if(e)change(e,p);},text,options);
  // ---- the view: selection box and gizmo on the selected person's model
  async function boot(){
    const w=win(),t=three();if(!t)throw Error('The stage is still loading.');
    if(!w.__directorThree)await new Promise((resolve,reject)=>{w.__dirThreeDone=resolve;w.__dirThreeFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree={THREE:T,TransformControls:C.TransformControls};window.__dirThreeDone();},e=>window.__dirThreeFail(e));";w.document.head.append(s);});
    const {THREE,TransformControls}=w.__directorThree,group=new THREE.Group();group.name='Director people tools';group.userData.directorTools=true;t.scene.add(group);
    const box=new THREE.BoxHelper(undefined,0xff9bd2);box.material.depthTest=false;box.material.transparent=true;box.renderOrder=998;box.visible=false;group.add(box);
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;gizmo.setSize(1.2);gizmo.setSpace('world');gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    let orbit=true;
    gizmo.addEventListener('dragging-changed',ev=>{w.__directorDragging=ev.value;if(ev.value){orbit=t.controls.enabled;t.controls.enabled=false;}else{t.controls.enabled=orbit;endDrag();}});
    gizmo.addEventListener('objectChange',()=>{const e=sel&&entry(sel);if(e)status(`${mode==='translate'?'Moving':mode==='rotate'?'Turning':'Scaling'} ${personName(e)}…`);});
    // Double-click a person: pose mode (the first click of the pair has selected them). Double-click elsewhere leaves it.
    t.renderer.domElement.addEventListener('dblclick',ev=>{
      if(!editing()||lightsShowing())return;const k=pose.personAt(ev);
      if(k&&entry(k)){ev.preventDefault();ev.stopPropagation();if(sel!==k)select(k,{announce:false});pose.enter(k);}
      else if(k){select(k);status('Their first change copies the film\'s cast into this chapter: move or change them once, then double-click to pose.');}
      else if(pose.active())pose.exit();
    },true);
    tools={THREE,TransformControls,group,box,gizmo,t};requestAnimationFrame(tick);return tools;
  }
  const ensure=()=>booting||=boot().catch(error=>{booting=null;throw error;});
  const objectOf=key=>stagePeople()?.byKey?.(key)||null;
  const free=e=>!!e&&!e.desk&&!e.beside;
  function tick(){
    if(!tools)return;requestAnimationFrame(tick);
    pose.tick();
    if(pose.active()){tools.box.visible=false;if(tools.gizmo.object&&!tools.gizmo.dragging)tools.gizmo.detach();tools.gizmo.visible=tools.gizmo.enabled=false;return;}
    const {box,gizmo}=tools,e=sel&&entry(sel),o=e&&objectOf(sel),on=!!o&&o.visible&&editing()&&!lightsShowing();
    box.visible=on;if(on)box.setFromObject(o);
    const grab=on&&free(e)&&!busy;
    if(grab){if(gizmo.object!==o)gizmo.attach(o);gizmo.setMode(mode);gizmo.showX=gizmo.showZ=mode!=='rotate';gizmo.showY=true;}
    else if(gizmo.object&&!gizmo.dragging)gizmo.detach();
    gizmo.visible=gizmo.enabled=grab;
  }
  // The dragged model's place, in the room's millimetres: where it stands, its lift, the way it faces, its size.
  function read(o){
    const {THREE}=tools,dir=new THREE.Vector3(0,0,1).applyQuaternion(o.quaternion),base=o.userData.personBase;
    return {at:[Math.round(o.position.x),Math.round(o.position.z)],y:Math.round(o.position.y),turn:r1(THREE.MathUtils.radToDeg(Math.atan2(dir.x,dir.z))),scale:base?Math.round(o.scale.y/base.y*1000)/1000:1};
  }
  function endDrag(){
    const o=tools?.gizmo.object,e=sel&&entry(sel);if(!o||!e)return;const now=read(o),name=personName(e);
    edit(sel,p=>{if(mode==='translate'){p.at=now.at;p.y=Math.max(-2000,now.y);}else if(mode==='rotate')p.turn=now.turn;else p.scale=Math.min(3,Math.max(.2,now.scale));},
      mode==='translate'?`Moved ${name}.`:mode==='rotate'?`Turned ${name} to ${now.turn}°.`:`${name} is now ${Math.round(now.scale*100)} % of their built size.`);
  }
  // Where a new person goes: on the floor in the lower middle of the view, facing the camera.
  function floorSpot(){
    const t=three(),THREE=tools?.THREE,root=win()?.ErgoFlex?.workspaceRoom?.root;if(!t||!THREE||!root)return {at:[0,1500],turn:180};
    // through the lower middle of the frame (the floor nearer the camera, in front of what the shot is looking at)
    root.updateWorldMatrix(true,false);t.camera.updateMatrixWorld();const eye=root.worldToLocal(t.camera.getWorldPosition(new THREE.Vector3())),ahead=root.worldToLocal(new THREE.Vector3(0,-.62,.5).unproject(t.camera));
    const dir=ahead.sub(eye).normalize(),reach=dir.y<-.05?Math.min(6000,Math.max(1500,-eye.y/dir.y)):3000,p=eye.clone().addScaledVector(dir,reach);
    return {at:[Math.round(p.x),Math.round(p.z)],turn:r1(THREE.MathUtils.radToDeg(Math.atan2(eye.x-p.x,eye.z-p.z)))};
  }
  // ---- pose mode (scene-pose-editor.mjs)
  const pose=createPoseEditor({win,three,tools:()=>tools,stagePeople,entry,edit:(...a)=>edit(...a),status,rerender,personName:e=>e?personName(e):'',editing});
  const poseEditor=pose;     // swap() has a `pose` argument of its own
  // ---- selection
  function select(key,{announce=true}={}){
    const e=entry(key);if(!e){deselect();return;}
    if(pose.active()&&pose.active()!==key)pose.exit();
    sel=key;onSelect();ensure().catch(error=>status(error.message,true));loadCatalog();
    if(announce)status(`${personName(e)} selected: ${free(e)?'W moves, E turns, T scales; Delete removes.':'they follow the desk. Choose “Free spot” in the People tab to move them by hand.'}`);
    rerender();
  }
  function deselect(){pose.exit();if(!sel)return;sel=null;rerender();}
  // A click in the view on a person's model (scene-prop-editor.mjs hands it over).
  function pickObject(o){const people=stagePeople();for(let p=o;p;p=p.parent)if(p.userData?.person){select(people.keyOf(p.userData.person));return true;}return false;}
  // ---- changes
  async function swap(key,character,pose){
    const e=entry(key),m=e&&modelOf(e.id);if(!e||!catalog)return;
    const c=character||m?.character,p=pose||m?.pose;if(!c||!p)return;
    let id=modelFor(c,p,m?.deskHeight??null);
    if(!id){id=await build(wantedId(c,p));if(!id)return;}
    const info=catalog.poses[p],name=catalog.characters[c]?.name||cap(c);
    if(p!==m?.pose)poseEditor.exit();
    edit(key,x=>{
      x.id=id;if(p!==m?.pose)delete x.pose;      // fine tuning belongs to the posture it was made on
      if(info.desk){const role=info.stance==='seated'?'sit':info.stance==='wheelchair'?'wheel':'stand';if(!x.desk){x.desk=role;delete x.at;delete x.turn;delete x.y;delete x.beside;}else x.desk=role;}
      else if(x.desk){const o=objectOf(key),spot=o&&tools?read(o):floorSpot();delete x.desk;delete x.station;delete x.reach;x.at=spot.at;x.turn=spot.turn;}
    },`${name}: ${info.label.toLowerCase()}.`);
  }
  // A character in a posture nobody has built yet: the studio server builds it (where it can).
  async function build(id){
    if(busy)return null;busy=id;status(`Building ${id.replace(/^people-/,'')} (about ten seconds)…`);rerender();
    try{
      const r=await fetch('/__people/build?id='+encodeURIComponent(id),{method:'POST'});
      if(!r.ok){let why='';try{why=(await r.json()).error||'';}catch{}throw Error(r.status===404||r.status===405?`That one is not built yet, and this server cannot build people (restart the studio server, or run: python3 tools/people/build.py ${id}).`:why||'The build failed.');}
      loading=null;await loadCatalog();await stagePeople()?.library?.reloadIndex?.();
      if(!modelOf(id))throw Error('The build finished but the model is not in the catalog.');
      return id;
    }catch(error){status(error.message,true);return null;}finally{busy=null;rerender();}
  }
  async function add(id){
    await loadCatalog();await ensure().catch(()=>null);const m=modelOf(id);if(!m){status('That model is not in the people catalog.',true);return;}
    const info=catalog.poses[m.pose],taken=new Set(cast().map(e=>e.key)),key=newKey(id,taken),spot=floorSpot();
    write(p=>{p.cast.push(info?.desk?{key,id,desk:info.stance==='seated'?'sit':info.stance==='wheelchair'?'wheel':'stand'}:{key,id,at:spot.at,turn:spot.turn});},
      `Added ${m.name}${info?.desk?' at the film desk':' in front of the camera'}. Undo takes them out again.`);
    sel=key;onSelect();rerender();
  }
  function remove(key=sel){const e=entry(key);if(!e)return;write(p=>{p.cast=p.cast.filter(x=>x.key!==key);if(p.when)delete p.when[key];},`Removed ${personName(e)} from this chapter. Undo brings them back.`);if(sel===key)sel=null;rerender();}
  function duplicate(){
    const e=sel&&entry(sel);if(!e)return;const key=newKey(e.id,new Set(cast().map(x=>x.key)));
    write(p=>{const copy={...structuredClone(e),key};if(copy.at)copy.at=[copy.at[0]+600,copy.at[1]];p.cast.push(copy);const s=p.when?.[e.key];if(s)(p.when||={})[key]=structuredClone(s);},`Duplicated ${personName(e)}${e.at?', 60 cm to the side':''}.`);
    sel=key;rerender();
  }
  function face(target){
    const e=sel&&entry(sel),o=e&&objectOf(sel),w=win(),t=three();if(!e||!o||!free(e)||!tools)return;
    const {THREE}=tools,root=w.ErgoFlex.workspaceRoom.root;let p;
    if(target==='camera')p=root.worldToLocal(t.camera.getWorldPosition(new THREE.Vector3()));
    else{const d=stagePeople()?.room?.peopleState?.()?.pose;if(!d){status('There is no film desk to face in this room.',true);return;}p=new THREE.Vector3(d.x,0,d.z);}
    const turn=r1(THREE.MathUtils.radToDeg(Math.atan2(p.x-o.position.x,p.z-o.position.z)));
    edit(sel,x=>{x.turn=turn;},`${personName(e)} faces the ${target==='camera'?'camera':'desk'}.`);
  }
  function setSpan(key,change){
    const T=seconds();
    // A span that runs to the chapter's end is kept a second past it, so the person does not fade out under the dissolve.
    write(p=>{const cur=(p.when?.[key]?.[0])||[0,T+1,.5,.5],s=[cur[0],Math.min(cur[1],T),cur[2]??.5,cur[3]??.5];change(s);if(s[1]>=T-.001)s[1]=T+1;(p.when||={})[key]=[s];},
      'Timing updated.',{undoKey:'people-when-'+key});
  }
  async function changed(el){
    if(pose.changed(el))return;
    const name=el.name,e=sel&&entry(sel),v=Number(el.value);
    if(name==='pe-sex'||name==='pe-age'||name==='pe-heritage'){filters[name.slice(3)]=el.value;rerender();return;}
    if(!e)return;
    const who=personName(e),num=(lo,hi)=>{if(el.value.trim()===''||!Number.isFinite(v))throw Error('Type a number.');return Math.min(hi,Math.max(lo,v));};
    if(name==='pe-pose'){await swap(sel,null,el.value);return;}
    if(name?.startsWith('pe-color-')){const part=name.slice(9);if(!PARTS.includes(part)||!/^#[0-9a-f]{6}$/i.test(el.value))return;edit(sel,x=>{(x.colors||={})[part]=el.value.toLowerCase();},`${who}: ${part} recoloured.`,{undoKey:'people-color-'+part+sel});return;}
    if(name==='pe-anchor'){
      if(el.value==='free'){const o=objectOf(sel),spot=o&&tools?read(o):floorSpot();edit(sel,x=>{delete x.desk;delete x.station;delete x.reach;delete x.beside;x.at=spot.at;x.turn=spot.turn;},`${who} stays where they are now and no longer follows the desk.`);}
      else{const p=poseOf(e.id);edit(sel,x=>{delete x.at;delete x.turn;delete x.y;delete x.beside;x.desk=p?.stance==='seated'?'sit':p?.stance==='wheelchair'?'wheel':'stand';},`${who} is at the film desk and follows it.`);}
      return;
    }
    if(name==='pe-x'||name==='pe-z'){const i=name==='pe-x'?0:1,mm=num(-100000,100000);edit(sel,x=>{if(x.at)x.at[i]=Math.round(mm);},`Moved ${who}.`,{undoKey:'people-'+name+sel});return;}
    if(name==='pe-y'){const mm=num(-2000,5000);edit(sel,x=>{x.y=Math.round(mm);},`${who}: lifted ${Math.round(mm)} mm.`,{undoKey:'people-y'+sel});return;}
    if(name==='pe-turn'){const d=num(-360,360);edit(sel,x=>{x.turn=d;},`Turned ${who} to ${r1(d)}°.`,{undoKey:'people-turn'+sel});return;}
    if(name==='pe-scale'){const pc=num(20,300);edit(sel,x=>{x.scale=pc/100;},`${who} is now ${Math.round(pc)} % of their built size.`,{undoKey:'people-scale'+sel});return;}
    if(name==='pe-whole'){if(el.checked)write(p=>{if(p.when)delete p.when[sel];},`${who} is in the room for the whole chapter.`);else{setSpan(sel,s=>{s[0]=Math.min(Math.max(0,time()),seconds()-.5);});status(`${who} now has seconds of their own: set In and Out below.`);}return;}
    if(name==='pe-in'){const t=num(0,seconds());setSpan(sel,s=>{s[0]=Math.min(t,s[1]-.05);});return;}
    if(name==='pe-out'){const t=num(0,seconds());setSpan(sel,s=>{s[1]=Math.max(t,s[0]+.05);});return;}
    if(name==='pe-fin'){const t=num(0,5);setSpan(sel,s=>{s[2]=t;});return;}
    if(name==='pe-fout'){const t=num(0,5);setSpan(sel,s=>{s[3]=t;});return;}
  }
  async function action(name,index){
    if(pose.action(name,index))return;
    if(name==='pe-pose-enter'){if(sel){await ensure();pose.enter(sel);}return;}
    if(name==='pe-add'){openLibrary();return;}
    if(name==='pe-row'){const key=rowKeys[index];if(key)select(key);return;}
    if(name==='pe-lane'){const key=laneKeys[index];if(key)select(key);return;}
    if(name==='pe-eye'){const key=rowKeys[index],e=key&&entry(key);if(e)edit(key,x=>{if(x.hide)delete x.hide;else x.hide=true;},e.hide?`${personName(e)} is back in the chapter.`:`${personName(e)} is out of this chapter (kept in the list).`);return;}
    if(name==='pe-char'){const c=charIds[index];if(c&&sel)await swap(sel,c,null);return;}
    if(name==='pe-remove'){remove();return;}
    if(name==='pe-color-reset'){const part=PARTS[index],e=sel&&entry(sel);if(e?.colors?.[part])edit(sel,x=>{delete x.colors[part];if(!Object.keys(x.colors).length)delete x.colors;},`${personName(e)}: ${part} as built.`);return;}
    if(name==='pe-duplicate'){duplicate();return;}
    if(name==='pe-face-camera'){face('camera');return;}
    if(name==='pe-face-desk'){face('desk');return;}
    if(name==='pe-in-now'){if(sel)setSpan(sel,s=>{s[0]=Math.min(time(),s[1]-.05);});return;}
    if(name==='pe-out-now'){if(sel)setSpan(sel,s=>{s[1]=Math.max(time(),s[0]+.05);});return;}
    if(name==='pe-mode-translate'||name==='pe-mode-rotate'||name==='pe-mode-scale'){setMode(name.slice(8));return;}
    if(name==='pe-room'){
      await bridge.stage()?.peopleTrack?.(true,shot().id);const live=stagePeople()?.resolved?.()||[];
      if(!live.length){status('This room has no people of its own yet. Use + Add person.',true);return;}
      write(p=>{p.cast=live;},`Brought in the room's ${live.length} people. Each one is now an entry you can move, change or remove.`);return;
    }
    if(name==='pe-reset'){
      if(shot().peopleEdits===undefined){status('The cast is already the film\'s.');return;}
      commit(()=>{delete shot().peopleEdits;},{render:false});sel=null;status('People reset: the chapter shows the film\'s cast again. Undo brings your cast back.');rerender();return;
    }
  }
  function setMode(m){if(pose.active()){pose.setMode(m);return;}if(!MODES[m])return;mode=m;rerender();status(`People gizmo: ${MODES[m]}.`);}
  // ---- the library dialog
  const dialog=document.createElement('dialog');dialog.id='people-library';dialog.className='people-library';dialog.setAttribute('aria-labelledby','people-library-title');document.body.append(dialog);
  const chip=(group,value,label,n)=>`<button type="button" class="lamp-chip pl-chip" data-pe-filter="${group}" data-pe-value="${escape(value)}" aria-pressed="${lib[group]===value}">${escape(label)}${n===undefined?'':` <small>${n}</small>`}</button>`;
  function libraryList(){
    const words=lib.query.toLowerCase().split(/\s+/).filter(Boolean);
    shown=Object.entries(catalog.models).map(([id,m])=>({id,...m,c:catalog.characters[m.character]||{},p:catalog.poses[m.pose]||{}}))
      .filter(m=>(lib.sex==='all'||m.c.sex===lib.sex)&&(lib.stance==='all'||m.p.stance===lib.stance)&&(lib.aid==='all'||m.aids.includes(lib.aid))&&words.every(w=>`${m.name} ${m.c.sex} ${m.c.age} ${m.c.heritage} ${m.p.stance} ${m.aids.join(' ')}`.toLowerCase().includes(w)));
    dialog.querySelector('[data-pe-count]').textContent=`${shown.length} of ${Object.keys(catalog.models).length} people`;
    dialog.querySelector('[data-pe-results]').innerHTML=shown.length?`<div class="pl-grid">${shown.map((m,i)=>`<button type="button" class="pl-card" data-pe-pick="${i}" title="${escape(m.name)}"><img src="${thumb(m.id)}" alt="" loading="lazy" decoding="async" onerror="this.classList.add('pl-nothumb')"><span class="pl-name">${escape(m.name)}</span><small>${escape([m.c.sex,m.c.age,m.c.height?m.c.height+' cm':'',...m.aids].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`:'<p class="director-hint">Nobody matches. Clear a filter or the search.</p>';
  }
  function libraryFrame(){
    const aids=[...new Set(Object.values(catalog.models).flatMap(m=>m.aids))].sort();
    dialog.innerHTML=`<div class="director-heading"><div><span class="director-kicker">ADD PERSON</span><h2 id="people-library-title">People library</h2></div><button type="button" class="pl-close" data-pe-close aria-label="Close the people library">×</button></div>
      <div class="pl-filters"><input type="search" name="pe-search" placeholder="Search by name, posture, age…" aria-label="Search the people library" autocomplete="off" spellcheck="false" value="${escape(lib.query)}"></div>
      <div class="pl-chips" role="group" aria-label="Filters">${chip('sex','all','Everyone')}${chip('sex','woman','Women')}${chip('sex','man','Men')}<span class="pe-gap"></span>${chip('stance','all','Any posture')}${STANCES.map(s=>chip('stance',s,cap(s))).join('')}<span class="pe-gap"></span>${chip('aid','all','All')}${aids.map(a=>chip('aid',a,cap(a))).join('')}</div>
      <p class="director-hint pl-count" data-pe-count aria-live="polite"></p><div class="pl-scroll" data-pe-results></div>
      <p class="director-hint">Desk postures go to the film desk and follow it; everyone else is placed on the floor in front of the camera, facing it. Any character can take any posture afterwards (People tab, Posture).</p>`;
    libraryList();
  }
  async function openLibrary(){if(!await loadCatalog())return;libraryFrame();if(!dialog.open)dialog.showModal();dialog.querySelector('[name=pe-search]')?.focus();}
  dialog.addEventListener('input',event=>{if(event.target.name==='pe-search'){lib.query=event.target.value;libraryList();}});
  dialog.addEventListener('click',event=>{
    const f=event.target.closest('[data-pe-filter]'),pick=event.target.closest('[data-pe-pick]');
    if(event.target.closest('[data-pe-close]')){dialog.close();return;}
    if(f){lib[f.dataset.peFilter]=f.dataset.peValue;libraryFrame();return;}
    if(pick){const m=shown[Number(pick.dataset.pePick)];dialog.close();if(m)add(m.id).catch(error=>status(error.message,true));}
  });
  // ---- the People tab
  const field=(label,name,value,{step=1,min='',max='',unit='',disabled=false,title=''}={})=>`<label title="${escape(title)}">${escape(label)}<input type="number" name="${name}" value="${escape(value)}" step="${step}" ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''} ${disabled?'disabled':''}>${unit?`<small>${escape(unit)}</small>`:''}</label>`;
  const select_=(name,value,options)=>`<select name="${name}">${options.map(([v,l])=>`<option value="${escape(v)}" ${v===value?'selected':''}>${escape(l)}</option>`).join('')}</select>`;
  function selectedPanel(e){
    const c=who(e.id),p=poseOf(e.id),m=modelOf(e.id),s=spans(e.key)?.[0]||null,T=seconds(),o=objectOf(e.key),isFree=free(e);
    if(!catalog)return '<p class="director-hint">Loading the people catalog…</p>';
    const chars=Object.entries(catalog.characters).filter(([,x])=>(filters.sex==='all'||x.sex===filters.sex)&&(filters.age==='all'||x.age===filters.age)&&(filters.heritage==='all'||x.heritage===filters.heritage));
    charIds=chars.map(([id])=>id);
    const face_=id=>{const any=Object.entries(catalog.models).find(([,x])=>x.character===id);return any?thumb(any[0]):'';};
    const uniq=k=>[...new Set(Object.values(catalog.characters).map(x=>x[k]))];
    const poses=STANCES.map(st=>[st,Object.entries(catalog.poses).filter(([,x])=>x.stance===st)]).filter(([,l])=>l.length);
    const built=id=>!!(m&&modelFor(m.character,id));
    const here=!o?'Loading the model…':o.visible?'':s&&!isFree?'':s?`Not in the room at ${r1(time())} s.`:isFree?'':'Not showing now: a desk posture shows only while the desk is at the height it was built for.';
    const head=`<div class="people-head"><img src="${thumb(e.id)}" alt=""><div><strong>${escape(c?.name||personName(e))}</strong><small>${escape(c?[c.sex,c.age,c.height?Math.round(c.height*(e.scale||1))+' cm':''].filter(Boolean).join(' · '):e.id)}</small><small>${escape(doing(e))}${m?.aids?.length?' · '+escape(m.aids.join(', ')):''}</small></div></div>`;
    if(pose.active()===e.key)return pose.panel(head);
    const tuned=Object.keys(e.pose||{}).length;
    return `<section class="people-selected" data-reveal="person">
      <div class="people-head"><img src="${thumb(e.id)}" alt=""><div><strong>${escape(c?.name||personName(e))}</strong><small>${escape(c?[c.sex,c.age,c.height?Math.round(c.height*(e.scale||1))+' cm':''].filter(Boolean).join(' · '):e.id)}</small><small>${escape(doing(e))}${m?.aids?.length?' · '+escape(m.aids.join(', ')):''}</small></div></div>
      ${busy?`<p class="director-hint people-busy">Building ${escape(busy.replace(/^people-/,''))}…</p>`:''}${here?`<p class="director-hint">${escape(here.trim())}</p>`:''}
      <h4>Character</h4>
      <div class="people-filters">${select_('pe-sex',filters.sex,[['all','Everyone'],['woman','Women'],['man','Men']])}${select_('pe-age',filters.age,[['all','Any age'],...uniq('age').map(a=>[a,cap(a)])])}${select_('pe-heritage',filters.heritage,[['all','Any heritage'],...uniq('heritage').map(a=>[a,a])])}</div>
      <div class="people-chars" role="listbox" aria-label="Character">${chars.map(([id,x],i)=>`<button type="button" data-action="pe-char" data-index="${i}" role="option" aria-selected="${id===m?.character}" title="${escape(`${x.name}: ${x.sex}, ${x.age}, ${x.heritage}, ${x.height} cm`)}${m&&!modelFor(id,m.pose)?' (this posture is built on request)':''}"><img src="${face_(id)}" alt="" loading="lazy"><span>${escape(x.name)}</span></button>`).join('')||'<p class="director-hint">Nobody matches these filters.</p>'}</div>
      <h4>Posture</h4>
      <select name="pe-pose" aria-label="Posture">${poses.map(([st,list])=>`<optgroup label="${cap(st)}">${list.map(([id,x])=>`<option value="${id}" ${id===p?.id?'selected':''}>${escape(x.label)}${x.desk?' · at the desk':''}${built(id)?'':' · built on request'}</option>`).join('')}</optgroup>`).join('')}</select>
      <div class="director-actions"><button type="button" data-action="pe-pose-enter" title="Turn joints and drag hands and feet to get the posture just right (or double-click the person in the view)">Fine-tune pose…</button><span class="director-hint people-tuned">${tuned?`${tuned} joint${tuned===1?'':'s'} adjusted`:'or double-click them in the view'}</span></div>
      <h4>Place</h4>
      ${select_('pe-anchor',isFree?'free':'desk',[['free','Free spot (move by hand)'],['desk',e.station?'At a desk in the room':'At the film desk (follows it)']])}
      ${isFree?`<div class="director-row people-fields">${field('X',`pe-x`,e.at[0],{step:10,unit:'mm'})}${field('Z','pe-z',e.at[1],{step:10,unit:'mm'})}${field('Turn','pe-turn',e.turn||0,{step:5,min:-360,max:360,unit:'°'})}${field('Lift','pe-y',e.y||0,{step:5,unit:'mm',title:'Raises a seated person onto a seat, or anyone onto a step'})}</div>
      <div class="director-actions people-modes">${Object.entries(MODES).map(([k,l])=>`<button type="button" data-action="pe-mode-${k}" aria-pressed="${mode===k}">${l}</button>`).join('')}<button type="button" data-action="pe-face-desk">Face the desk</button><button type="button" data-action="pe-face-camera">Face the camera</button></div>`:'<p class="director-hint">They stand or sit where the desk needs them and move with it. A desk posture shows only while the desk is at the height it was built for.</p>'}
      <div class="director-row people-fields">${field('Size','pe-scale',Math.round((e.scale||1)*100),{step:1,min:20,max:300,unit:'%',title:'100 % is the size the character was built at'})}</div>
      <h4>Clothes and hair</h4>
      <div class="people-colors">${PARTS.map((part,i)=>{const mine=e.colors?.[part],was=c?.colors?.[part]||'#8a8f96';return `<label title="${mine?'Recoloured':'As built'}: ${part}">${cap(part)}<span><input type="color" name="pe-color-${part}" value="${escape(mine||was)}">${mine?`<button type="button" data-action="pe-color-reset" data-index="${i}" title="Back to the colour the character was built with">↺</button>`:''}</span></label>`;}).join('')}</div>
      <p class="director-hint">Outfit: ${escape((c?.outfit||[]).map(g=>g.replace(/^[a-z]+_/,'').replace(/[_-]+/g,' ').replace(/\d+$/,'').trim()).join(', ')||'as built')}. A colour keeps the fabric's folds and weave.</p>
      <h4>In the room</h4>
      <label class="director-check"><input type="checkbox" name="pe-whole" ${s?'':'checked'}>The whole chapter</label>
      ${s?`<div class="director-row people-fields">${field('In','pe-in',s[0],{step:.1,min:0,max:T,unit:'s'})}${field('Out','pe-out',Math.min(s[1],T),{step:.1,min:0,max:T,unit:'s'})}${field('Fade in','pe-fin',s[2]??.5,{step:.1,min:0,max:5,unit:'s'})}${field('Fade out','pe-fout',s[3]??.5,{step:.1,min:0,max:5,unit:'s'})}</div>
      <div class="director-actions"><button type="button" data-action="pe-in-now">In at the playhead</button><button type="button" data-action="pe-out-now">Out at the playhead</button></div>`:''}
      <div class="director-actions people-end"><button type="button" data-action="pe-duplicate">Duplicate</button><button type="button" class="danger" data-action="pe-remove">Remove from the chapter</button></div>
    </section>`;
  }
  function panel(){
    if(!catalog)loadCatalog();
    const list=cast(),mine=!!own(),T=seconds();rowKeys=list.map(e=>e.key);const e=sel&&entry(sel);
    const row=(x,i)=>`<div class="people-row ${x.key===sel?'selected':''} ${x.hide?'off':''}"><button type="button" class="people-pick" data-action="pe-row" data-index="${i}" title="Select ${escape(personName(x))}"><img src="${thumb(x.id)}" alt="" loading="lazy"><span><strong>${escape(personName(x))}</strong><small>${escape(doing(x))}</small><small>${escape(x.desk?(x.station?'at a room desk':'at the film desk'):'free spot')} · ${escape(spanText(spans(x.key),T))}</small></span></button><button type="button" class="people-eye" data-action="pe-eye" data-index="${i}" aria-pressed="${!x.hide}" title="${x.hide?'Bring back into the chapter':'Take out of the chapter (keeps the entry)'}">${x.hide?'○':'●'}</button></div>`;
    return `<div class="director-heading"><div><span class="director-kicker">PEOPLE</span><h3>${list.length?`${count()} in this chapter`:'Nobody in this chapter'}</h3></div></div>
      <div class="director-actions"><button type="button" data-action="pe-add">+ Add person</button>${list.length?'':'<button type="button" data-action="pe-room">Bring in the room\'s people</button>'}${mine?'<button type="button" data-action="pe-reset" title="Back to the cast the film has for this chapter">Reset to the film</button>':''}</div>
      <p class="director-hint">${mine?'This chapter has its own cast.':list.length?'This is the film\'s cast. Your first change copies it into the chapter.':'Add people from the library, or bring in the people who live in this room.'} Click a person in the view or in the list.</p>
      <div class="people-list">${list.map(row).join('')}</div>${e?selectedPanel(e):''}`;
  }
  // The timeline's People lane: one bar per person over the seconds they are in the room.
  function lane(){
    const T=seconds()||1,list=cast().filter(e=>!e.hide);laneKeys=list.map(e=>e.key);if(!list.length)return '';
    const h=Math.max(5,Math.min(15,Math.floor(36/list.length)));
    return list.map((e,i)=>(spans(e.key)||[[0,T]]).map(([a,b])=>{const x=Math.max(0,a)/T*100,w=Math.max(.6,(Math.min(b,T)-Math.max(0,a))/T*100);
      return `<button type="button" class="people-bar ${e.key===sel?'selected':''}" data-action="pe-lane" data-index="${i}" style="left:${x}%;width:${w}%;top:${1+i*(36/list.length)}px;height:${h}px" title="${escape(personName(e))}: ${escape(doing(e))} · ${escape(spanText(spans(e.key),T))}">${h>=10?escape(personName(e)):''}</button>`;}).join('')).join('');
  }
  const header=()=>{const e=sel&&entry(sel);return e?{name:personName(e),detail:pose.active()===sel?'Pose mode'+(pose.joint()?' · '+pose.jointLabel():''):doing(e)}:null;};
  // After the film setup is (re)applied or the cut changes: the selection may be gone.
  function applied(){if(sel&&!entry(sel)){pose.exit();sel=null;}ensure().catch(()=>null);}
  return {panel,lane,action,changed,select,deselect,selected:()=>sel,header,pickObject,setMode,mode:()=>mode,count,remove:k=>{if(k===undefined&&pose.active()){pose.resetJoint();return;}remove(k);},posing:()=>pose.active(),applied,openLibrary,effective:()=>effectivePeople(film(),shot())};
}
