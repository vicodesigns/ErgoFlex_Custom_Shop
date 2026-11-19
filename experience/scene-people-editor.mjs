import {enhanceGizmo,mmPerUnitOf} from './gumball.mjs';
import {postureView,editPosture,migratePostures,editablePeople,postureRecord} from '../people-postures.mjs';
import {cleanPeople,canonicalPeople,effectivePeople,newKey,spanText,PARTS} from './people-edits.mjs';
import {createPoseEditor,JOINTS} from './scene-pose-editor.mjs';
import {stackRows} from './lane-rows.mjs';
import {withSpan} from './people-spans.mjs';
import {reachAt as reachAtTime} from '../people-reach.mjs';
import {endsOf,characterOf} from './people-path-edit.mjs';
import {placementOf,freeSpot,SEAT_FIELDS,sheet,sheetKeys,EASE_SHAPES,NO_EASE,pick,neighborTime,shiftKeys,deleteKeys,copyKeys,pasteKeys,setEase,toggleKeyAt,entryAt,turnAngles,setJointAngles,waypointOf,setWaypoint} from './people-track.mjs';
import {loadSavedPoses,storeSavedPoses,addSavedPose} from './saved-poses.mjs';
import {createPathGizmo} from './people-path-gizmo.mjs';   // S31 M3 path editing (hook)
import {shownTimeline,hasCorrection,heightSibling,spansOf,fmt as fmtSec} from './people-shown.mjs';
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
// A desk user's distance from the keys' front edge as the film places them (room-people.mjs REACH, mm; their `reach`),
// and the chair's roll on the way up (room-people-motion.mjs ROLL, SCOOT, mm; their chairRoll, chairScoot).
export const DESK_REACH={sit:945,wheel:935,stand:890},CHAIR_ROLL=265,CHAIR_SCOOT=90;
const IN=25.4,inch=mm=>Math.round(mm/IN*10)/10;
const thumb=id=>`/assets/props/thumbs/${encodeURIComponent(id)}.png`;
export function createScenePeopleEditor({bridge,shot,film,commit,status,open,rerender,time=()=>0,seek=()=>{},onSelect=()=>{},lightsShowing=()=>false,snap=null}){
  let sel=null,catalog=null,loading=null,tools=null,booting=null,mode='translate',busy=null,rowKeys=[],laneKeys=[],charIds=[],shown=[];
  const filters={sex:'all',age:'all',heritage:'all'},lib={query:'',sex:'all',stance:'all',aid:'all'};
  const frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow,three=()=>bridge.stage()?.three?.();
  const stagePeople=()=>win()?.ErgoFlex?.workspaceRoom?.people||null;
  const editing=()=>open()&&bridge.ready()&&!bridge.playback().playing&&!bridge.bakeState().baking;
  const seconds=()=>shot()?.seconds||0;
  // ---- the catalog
  const sexIs=(sex,want)=>sex===want||(want==='woman'&&sex==='girl')||(want==='man'&&sex==='boy');   // Women and Men include the girls and the boys
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
  // S31: a film chapter with a `people` object of its own (the Cinematographer's cut: walks, rolls, acts, seats, only /
  // except / place) is copied VERBATIM as peopleEdits v2 (people-edits.mjs): nothing the film has is lost by an edit.
  function seed(){
    const f=film()?.people;
    if(f&&typeof f==='object'&&!Array.isArray(f)&&Array.isArray(f.cast))return {v:2,...structuredClone(f)};
    // (a chapter whose film has no cast of its own: the room's people as plain entries, so the first edit copies them in and
    // each one can be moved, hidden, recoloured or posed; they are the chapter's from then on)
    const live=stagePeople()?.resolved?.()||[];
    return {cast:live,when:f&&typeof f==='object'?structuredClone(f.when||{}):{},...(f?.chair?{chair:f.chair}:{}),...(f?.fade!==undefined?{fade:f.fade}:{})};
  }
  // The cast the tabs work on. Only a cast that keeps the film's own people (v2: the room's crew in `only` is still the
  // room's) gets the room's people as pose-only entries (poseSource); a copied-in cast has them as real entries already.
  const currentPeople=()=>{const base=own()||seed();return base.v===2?editablePeople(base,stagePeople()?.resolved?.({editable:true})||[]):base;};
  const cast=()=>currentPeople().cast;
  const entry=key=>cast().find(e=>e.key===key)||null;
  const spans=key=>(own()?own().when:film()?.people?.when)?.[key]||null;
  const count=()=>cast().filter(e=>!e.hide).length;
  function write(change,text,{undoKey=null}={}){
    const next=currentPeople();change(next);const clean=cleanPeople(canonicalPeople(next));
    if(!clean){status('That would not be a cast the film can keep.',true);rerender();return;}
    commit(()=>{shot().peopleEdits=clean;},{key:undoKey,render:false});status(text);rerender();
  }
  const edit=(key,change,text,options)=>write(p=>{const e=p.cast.find(e=>e.key===key);if(e)change(e,p);},text,options);
  // ---- the view: selection box and gizmo on the selected person's model
  async function boot(){
    const w=win(),t=three();if(!t)throw Error('The stage is still loading.');
    // three + TransformControls for the stage window, shared with the other editors (window.__directorThree). Whoever
    // asks first loads them; this editor only waits for them to be there, so two editors starting together never
    // take each other's "loaded" callback (that left one of them waiting for ever).
    if(!w.__directorThree){
      if(!w.__dirThreeDone){w.__dirThreeDone=()=>{};w.__dirThreeFail=()=>{};const s=w.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree={THREE:T,TransformControls:C.TransformControls};window.__dirThreeDone();},e=>window.__dirThreeFail(e));";w.document.head.append(s);}
      await new Promise((resolve,reject)=>{const end=Date.now()+30000;(function wait(){if(w.__directorThree)resolve();else if(Date.now()>end)reject(Error('The editing tools did not load.'));else setTimeout(wait,50);})();});
    }
    const {THREE,TransformControls}=w.__directorThree,group=new THREE.Group();group.name='Director people tools';group.userData.directorTools=true;t.scene.add(group);
    const box=new THREE.BoxHelper(undefined,0xff9bd2);box.material.depthTest=false;box.material.transparent=true;box.renderOrder=998;box.visible=false;group.add(box);
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;w.__directorPeopleGizmo=gizmo;w.__directorPeoplePaths=paths;gizmo.setSize(1.2);gizmo.setSpace('world');gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    enhanceGizmo(gizmo,{win:w,THREE,mmPerUnit:()=>mmPerUnitOf(w,THREE),status:t=>status(t)});   // P3: Rhino's Gumball (gumball.mjs)
    let orbit=true;
    gizmo.addEventListener('dragging-changed',ev=>{w.__directorDragging=ev.value;if(ev.value){orbit=t.controls.enabled;t.controls.enabled=false;dragFrom=gizmo.object?read(gizmo.object):null;const e=sel&&entry(sel);if(dragFrom&&e?.desk&&!free(e)){dragFrom.stance=seatedDesk(gizmo.object.userData?.person?.desk??e.desk)?'sit':'stand';dragFrom.reach=reachOfStance(e,dragFrom.stance);}}else{t.controls.enabled=orbit;endDrag();}});
    gizmo.addEventListener('objectChange',()=>{const e=sel&&entry(sel);if(!e)return;
      if(dragFrom?.reach!==undefined&&gizmo.object){const r=reachOf(dragFrom,read(gizmo.object));previewReach(sel,r);status(`${personName(e)}: ${inch(r)} in from the desk (was ${inch(dragFrom.reach)} in)…`);return;}
      status(`${mode==='translate'?'Moving':mode==='rotate'?'Turning':'Scaling'} ${personName(e)}…`);});
    // Double-click a person: pose mode (the first click of the pair has selected them). Double-click elsewhere leaves it.
    t.renderer.domElement.addEventListener('dblclick',ev=>{
      if(!editing()||lightsShowing())return;const k=pose.personAt(ev);
      if(k&&entry(k)){ev.preventDefault();ev.stopPropagation();if(sel!==k)select(k,{announce:false});enterPose(k);}
      else if(k){select(k);status('Their first change copies the film\'s cast into this chapter: move or change them once, then double-click to pose.');}
      else if(pose.active())pose.exit();
    },true);
    tools={THREE,TransformControls,group,box,gizmo,t};requestAnimationFrame(tick);return tools;
  }
  const ensure=()=>booting||=boot().catch(error=>{booting=null;throw error;});
  const objectOf=key=>stagePeople()?.byKey?.(key)||null;
  const activeModel=key=>objectOf(key)?.userData?.person?.id||entry(key)?.id;
  const poseEntry=key=>postureView(entry(key),activeModel(key));
  const poseEdit=(key,change,text,options)=>{const id=activeModel(key);edit(key,x=>editPosture(x,id,change),text,options);};
  const free=e=>freeSpot(e);   // S33a2: only a person at a spot of their own (`at`); a seated one follows their seat
  function tick(){
    if(!tools)return;requestAnimationFrame(tick);
    pose.tick();paths.tick();   // S31 M3 hook
    if(pose.active()){tools.box.visible=false;if(tools.gizmo.object&&!tools.gizmo.dragging)tools.gizmo.detach();tools.gizmo.visible=tools.gizmo.enabled=false;return;}
    const {box,gizmo}=tools,e=sel&&entry(sel),o=e&&objectOf(sel),on=!!o&&o.visible&&editing()&&!lightsShowing();
    box.visible=on;if(on)box.setFromObject(o);
    const grab=on&&free(e)&&!busy;
    // at the film desk: one arrow, toward and away from the desk (their distance from it, `reach`)
    const deskGrab=on&&!grab&&!busy&&!!e.desk&&!e.station&&!e.poseSource;
    if(grab){if(gizmo.object!==o)gizmo.attach(o);gizmo.space='world';gizmo.setMode(mode);gizmo.showX=gizmo.showZ=mode!=='rotate';gizmo.showY=true;}
    else if(deskGrab){if(gizmo.object!==o)gizmo.attach(o);gizmo.space='local';gizmo.setMode('translate');gizmo.showX=gizmo.showY=false;gizmo.showZ=true;}
    else if(gizmo.object&&!gizmo.dragging)gizmo.detach();
    gizmo.visible=gizmo.enabled=grab||deskGrab;
  }
  // The dragged model's place, in the room's millimetres: where it stands, its lift, the way it faces, its size.
  function read(o){
    const {THREE}=tools,dir=new THREE.Vector3(0,0,1).applyQuaternion(o.quaternion),base=o.userData.personBase;
    return {at:[Math.round(o.position.x),Math.round(o.position.z)],y:Math.round(o.position.y),turn:r1(THREE.MathUtils.radToDeg(Math.atan2(dir.x,dir.z))),scale:base?Math.round(o.scale.y/base.y*1000)/1000:1};
  }
  // S31: the drag is applied as a CHANGE to the placement (moved by, turned by), not as where the model is drawn now:
  // someone walking, rolling or seated is drawn away from their `at`, and only their placement moves, nothing else.
  let dragFrom=null;
  // A desk user dragged toward or away from the desk: their new `reach` (mm), from how far the drag went along the way
  // they face (the model faces the desk; `reach` grows away from it).
  function reachOf(from,now){const a=from.turn*Math.PI/180,d=-((now.at[0]-from.at[0])*Math.sin(a)+(now.at[1]-from.at[1])*Math.cos(a));return Math.round(Math.max(0,Math.min(3000,from.reach+d)));}
  // the stage's models of that person stand there while the drag goes on (every posture of theirs at the desk)
  function previewReach(key,r){const o=tools?.gizmo?.object,spec=o?.userData?.person;if(!spec)return;spec.reach=r;const people=stagePeople();if(people)people.dirty=true;}
  function endDrag(){
    const o=tools?.gizmo.object,e=sel&&entry(sel),from=dragFrom;dragFrom=null;if(!o||!e)return;const now=read(o),name=personName(e);
    if(!from){rerender();return;}
    if(from.reach!==undefined){const r=reachOf(from,now);if(Math.abs(r-from.reach)<1){rerender();return;}setReach(sel,r,from.stance);return;}
    const dx=now.at[0]-from.at[0],dz=now.at[1]-from.at[1],dy=now.y-from.y,dt=now.turn-from.turn;
    if(mode==='translate'&&Math.hypot(dx,dz)<.5&&Math.abs(dy)<.5){rerender();return;}
    edit(sel,(p,all)=>{
      if(mode==='translate'){const at=Array.isArray(p.at)?p.at:from.at;p.at=[Math.round(at[0]+dx),Math.round(at[1]+dz)];if(Math.abs(dy)>=.5)p.y=Math.max(-2000,Math.round((p.y||0)+dy));paths.bodyMoved(p,all);/* S31 M3 hook: a walker's path start goes with them */}
      else if(mode==='rotate')p.turn=r1((((p.turn||0)+dt+180)%360+360)%360-180);
      else p.scale=Math.min(3,Math.max(.2,now.scale));},
      mode==='translate'?`Moved ${name} by ${Math.round(Math.hypot(dx,dz))} mm.`:mode==='rotate'?`Turned ${name} by ${r1(dt)}°.`:`${name} is now ${Math.round(now.scale*100)} % of their built size.`);
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
  const pose=createPoseEditor({wake:()=>bridge.stage()?.wake?.(600),win,three,tools:()=>tools,stagePeople,entry:poseEntry,edit:poseEdit,status,rerender,personName:e=>e?personName(e):'',editing,saved:e=>savedHTML(e),time,seek,seconds,
    siblings:k=>(sheetRows.length?sheetRows:track()).find(r=>r.entries.includes(k))?.entries||[k],follow:k=>{if(sel!==k){sel=k;onSelect();}},models:k=>modelNotes(k)});
  const poseEditor=pose;     // swap() has a `pose` argument of its own
  // Pose mode: which of this person's models the film draws when (people-shown.mjs). Corrections belong to one model
  // each and are never inherited: a desk that rises past the model's height has the film draw another model (Ava's 30 in
  // seated model from 4.35 s in the coast chapter, then her standing ones), so the pose mode names each one that has no
  // correction, and offers an explicit copy to the same posture built for the other height (one edit, Undo takes it back).
  const timelineOf=key=>{const actor=objectOf(key)?.userData?.personActor;return actor?shownTimeline(actor):[];};
  const ownerOf=spec=>{const k=spec&&stagePeople()?.editKeyOf?.(spec);return k?entry(k):null;};
  const modelLabel=id=>{const p=poseOf(id),m=modelOf(id);return `${p?p.label.toLowerCase():id}${m?.deskHeight?` (desk at ${m.deskHeight} in)`:''}`;};
  function modelNotes(key){
    const e=entry(key),now=activeModel(key),tl=e&&catalog?timelineOf(key):[];if(tl.length<2)return '';
    const name=personName(e),out=[],seen=new Set(),T=seconds();
    if(tl.some(s=>s.id===now))out.push(`<p class="director-hint pose-model-note" data-pose-model="${escape(now)}">The film draws this model (${escape(modelLabel(now))}) at ${spansOf(tl,now)}.</p>`);
    for(const s of tl){
      if(s.id===now||seen.has(s.id))continue;seen.add(s.id);
      const owner=ownerOf(s.member?.object?.userData?.person);if(hasCorrection(owner&&postureRecord(owner,s.id)))continue;
      const more=tl.filter(x=>x.id===s.id).slice(1).map(x=>`${fmtSec(x.from)}–${fmtSec(x.to)} s`);
      out.push(`<p class="director-hint pose-model-note pose-model-bare" data-pose-model="${escape(s.id)}">From ${fmtSec(s.from)} s${s.to<T-1e-6?` to ${fmtSec(s.to)} s`:''}${more.length?` (and ${more.join(', ')})`:''} the film shows ${escape(name)} ${escape(modelLabel(s.id))}: it has no correction.</p>`);
    }
    if(hasCorrection(postureRecord(e,now)))for(const id of new Set(tl.map(s=>s.id))){
      const s=tl.find(x=>x.id===id);if(!heightSibling(catalog.models,now,id)||ownerOf(s.member?.object?.userData?.person)?.key!==key)continue;
      const had=hasCorrection(postureRecord(e,id)),h=modelOf(id).deskHeight;
      out.push(`<div class="director-actions"><button type="button" data-action="pe-pose-copy-model" data-section="${escape(id)}" title="${escape(`Copies this model's pose, pose keys and held things to the ${h} in model${had?', replacing its own correction':''}. One edit: Undo takes it back. Nothing is copied on its own.`)}">Copy this correction to the ${h} in model (shown ${spansOf(tl,id)})</button></div>`);
    }
    return out.join('');
  }
  function copyToModel(id){
    const key=pose.active()||sel,e=key&&entry(key),from=key&&activeModel(key);
    if(!e||typeof id!=='string'||!heightSibling(catalog?.models,from,id)){status('Copy a correction to the same posture built for another desk height.',true);return;}
    if(!hasCorrection(postureRecord(e,from))){status('This model has no correction to copy yet.',true);return;}
    const had=hasCorrection(postureRecord(e,id)),h=modelOf(id).deskHeight;
    edit(key,x=>{const r=structuredClone(postureRecord(x,from));editPosture(x,id,p=>{delete p.pose;delete p.poseKeys;delete p.held;Object.assign(p,r);});},
      `${personName(e)}: the ${h} in model has this correction now${had?' (its own was replaced)':''}. Undo takes it back.`);
  }
  // S31 M3 hook: a walker's / roller's path on the floor and in the People tab (people-path-gizmo.mjs)
  const paths=createPathGizmo({win,three,tools:()=>tools,stagePeople,entry,edit:(...a)=>edit(...a),status,editing,lightsShowing,selected:()=>sel,posing:()=>pose.active(),personName:e=>e?personName(e):'',objectOf:k=>objectOf(k),cast:()=>cast(),modelOf:id=>modelOf(id),poseOf:id=>poseOf(id),seconds,spans:k=>spans(k),time});
  // ---- selection
  function select(key,{announce=true}={}){
    const e=entry(key);if(!e){deselect();return;}
    if(pose.active()&&pose.active()!==key)pose.exit();
    sel=key;onSelect();ensure().catch(error=>status(error.message,true));loadCatalog();
    if(announce)status(`${personName(e)} selected: ${free(e)?'W moves, E turns, R scales; Delete removes.':'they follow the desk. Choose “Free spot” in the People tab to move them by hand.'}`);
    rerender();
  }
  function deselect(){pose.exit();if(!sel)return;sel=null;rerender();}
  // A click in the view on a person's model (scene-prop-editor.mjs hands it over).
  // Two clicks on the same person within a moment are a double-click: pose mode (also caught by the view's dblclick).
  let lastPick={key:null,t:0};
  function pickObject(o){
    const people=stagePeople();
    for(let p=o;p;p=p.parent)if(p.userData?.person){
      const key=people.editKeyOf(p.userData.person),now=performance.now(),twice=key===lastPick.key&&now-lastPick.t<450;lastPick={key,t:now};
      select(key,{announce:!twice});
      if(twice&&entry(key))ensure().then(()=>{if(sel===key&&!pose.active())return enterPose(key);}).catch(error=>status(error.message,true));
      return true;
    }
    return false;
  }
  // ---- saved poses (saved-poses.mjs): kept under a name, applied to anyone as a starting point
  const store=()=>globalThis.localStorage;
  let savedList=[];
  function savedHTML(e){
    savedList=loadSavedPoses(store());const p=poseOf(e.id);
    if(!savedList.length)return '<p class="director-hint">No saved poses yet. Adjust the pose, name it and press Save pose: it can then be put on anyone as a starting point.</p>';
    const order=savedList.map((x,i)=>[x,i]).sort((a,b)=>(b[0].posture===p?.id)-(a[0].posture===p?.id));
    return `<div class="pose-saved" role="list" aria-label="Saved poses">${order.map(([x,i])=>{const same=x.posture===p?.id,label=catalog?.poses[x.posture]?.label||x.posture,n=Object.keys(x.joints).length;
      return `<span class="pose-saved-item ${same?'':'other'}" role="listitem"><button type="button" data-action="pe-pose-apply" data-index="${i}" ${e.poseSource&&!same?'disabled':''} title="${escape(`${label} with ${n} joint${n===1?'':'s'} adjusted${x.from?' · made on '+x.from:''}${same?'':' · changes the posture to this one'}`)}">${escape(x.name)}</button><button type="button" class="pose-saved-x" data-action="pe-pose-delete" data-index="${i}" aria-label="Delete the saved pose ${escape(x.name)}" title="Delete this saved pose (people who have it keep it)">×</button></span>`;}).join('')}</div>`;
  }
  function savePose(){
    const e=sel&&poseEntry(sel),p=e&&poseOf(e.id);if(!e||!p)return;
    if(!e.pose){status('Adjust a joint first: there is nothing to save yet.',true);return;}
    const typed=document.querySelector('#director-panel [name="pe-pose-name"]')?.value||'';
    try{const {poses,saved}=addSavedPose(loadSavedPoses(store()),{name:typed.trim()||p.label,posture:p.id,joints:e.pose,from:personName(e)});storeSavedPoses(store(),poses);
      status(`Saved as “${saved.name}”. It is under Saved poses for anyone, and never replaces another saved pose.`);rerender();}
    catch(error){status(error.message.includes('quota')?'The browser storage is full: the pose was not saved.':error.message,true);}
  }
  async function applySaved(index){
    const x=savedList[index],e=sel&&entry(sel);if(!x||!e||!catalog)return;
    if(e.poseSource&&poseOf(activeModel(sel))?.id!==x.posture){status('Choose a saved pose for the posture showing at the playhead.',true);return;}
    if(!catalog.poses[x.posture]){status('That saved pose was made on a posture this library no longer has.',true);return;}
    if(poseOf(activeModel(sel))?.id===x.posture)poseEdit(sel,p=>{p.pose=structuredClone(x.joints);},`${personName(e)}: saved pose “${x.name}”.`);
    else await swap(sel,null,x.posture,x.joints);
    if(poseEntry(sel)?.pose)status(`${personName(entry(sel))}: saved pose “${x.name}”. Fine-tune from here; the saved pose stays as it is.`);
  }
  function deleteSaved(index){
    const x=savedList[index];if(!x)return;
    try{storeSavedPoses(store(),loadSavedPoses(store()).filter(p=>p.id!==x.id));status(`Deleted the saved pose “${x.name}”. People who have it keep it.`);}catch(error){status(error.message,true);}
    rerender();
  }
  // ---- changes
  // Entering pose mode is read-only: editing targets the model showing now.
  async function enterPose(key){if(entry(key))poseEditor.enter(key);}
  async function swap(key,character,pose,joints=null){
    const e=entry(key),m=e&&modelOf(e.id);if(!e||!catalog)return;
    const c=character||m?.character;let p=pose||m?.pose;if(!c||!p)return;
    // a child swapped in for an adult (or the other way round) takes a posture of their own kind: the others are built on the wrong furniture
    const kid=catalog.characters[c]?.age==='child';
    if(/^kid-/.test(p)!==kid){
      const info=catalog.poses[p]||{},up=info.stance==='standing'||info.stance==='walking',floor=/floor|kneel/.test(p);
      // (seated away from a desk means a seat that was there for the other: on the floor is right wherever they are)
      const to=kid?(info.desk?(up?'kid-stand-desk':'kid-sit-desk'):up?'kid-stand':'kid-sit-floor')
        :(info.desk?(up?'stand-type':'sit-type'):up?'stand-wait':'sit-floor');
      p=catalog.poses[to]?to:kid?'kid-stand':'stand-wait';
    }
    let id=modelFor(c,p,m?.deskHeight??null);
    if(!id){id=await build(wantedId(c,p));if(!id)return;}
    const info=catalog.poses[p],name=catalog.characters[c]?.name||cap(c);
    if(p!==m?.pose)poseEditor.exit();
    edit(key,x=>{
      const archived=migratePostures(x);delete x.pose;delete x.poseKeys;if(archived.postures)x.postures=archived.postures;
      delete x.poseSource;delete x.poseBindings;x.id=id;
      if(joints)editPosture(x,id,p=>{p.pose=structuredClone(joints);});  // a saved pose: its posture and its joints in one step
      if(info.desk){const role=info.stance==='seated'?'sit':info.stance==='wheelchair'?'wheel':'stand';if(!x.desk){x.desk=role;delete x.at;delete x.turn;delete x.y;delete x.beside;}else{swapReach(x,role);x.desk=role;}}
      else if(x.desk){const o=objectOf(key),spot=o&&tools?read(o):floorSpot();delete x.desk;delete x.station;delete x.reach;x.at=spot.at;x.turn=spot.turn;}
    },`${name}: ${info.label.toLowerCase()}.`);
  }
  // Sitting down or getting up at the desk keeps both distances: `reach` is always the posture they are in now.
  function swapReach(x,role){
    const was=seatedDesk(x.desk),now=seatedDesk(role);if(was===now)return;
    const own=x.reach,other=x[now?'sitReach':'standReach'];delete x.reach;delete x.sitReach;delete x.standReach;
    if(other!==undefined)x.reach=other;if(own!==undefined)x[was?'sitReach':'standReach']=own;
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
  function remove(key=sel){const e=entry(key);if(!e)return;if(e.poseSource){status('This person belongs to the room’s cast. Use the room’s People controls to remove them.');return;}write(p=>{p.cast=p.cast.filter(x=>x.key!==key);if(p.when)delete p.when[key];},`Removed ${personName(e)} from this chapter. Undo brings them back.`);if(sel===key)sel=null;rerender();}
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
  // Span k (default the first) of a person's stays in the chapter: changed in place, every other span kept as it was.
  function setSpan(key,change,k=0){
    const T=seconds();
    write(p=>{(p.when||={})[key]=withSpan(p.when[key],k,change,T);},
      'Timing updated.',{undoKey:'people-when-'+key+'-'+k});
  }
  // At the film desk: how far from it they sit or stand (mm; the film's default for the posture clears it).
  // stance 'sit' | 'stand': their own posture's distance is `reach`; the other one's (the same person's other models at
  // the desk, the room's included) is sitReach / standReach (room-people.mjs deskReach).
  const seatedDesk=d=>d!=='stand';
  const reachField=(e,stance)=>seatedDesk(e.desk)===(stance==='sit')?'reach':stance==='sit'?'sitReach':'standReach';
  const reachDefault=(e,stance)=>stance==='sit'?(e.desk==='wheel'?DESK_REACH.wheel:DESK_REACH.sit):DESK_REACH.stand;
  const reachOfStance=(e,stance)=>e[reachField(e,stance)]??reachDefault(e,stance);
  function setReach(key,mm,stance){const e=entry(key);if(!e?.desk)return;stance||=seatedDesk(e.desk)?'sit':'stand';const f=reachField(e,stance),d=reachDefault(e,stance),r=Math.round(Math.max(0,Math.min(3000,mm)));
    edit(key,x=>{if(Math.abs(r-d)<1.5)delete x[f];else x[f]=r;},`${personName(e)}${stance==='sit'?' seated':' standing'}: ${inch(r)} in from the desk${Math.abs(r-d)<1.5?' (the film\'s distance)':` (${r<d?'closer':'further'} than the film's ${inch(d)} in by ${inch(Math.abs(r-d))} in)`}.${stance==='sit'?' Their chair goes with them.':''}`,{undoKey:'people-reach-'+stance+key});}
  // where they are at film second t (their own reach, rolled in or out by reachKeys)
  const reachAt=(e,t)=>reachAtTime(reachOfStance(e,'sit'),e.reachKeys,t);
  function reachKeysOf(e){return Array.isArray(e?.reachKeys)?e.reachKeys:[];}
  function setReachKeys(key,change,text,undoKey=null){edit(key,x=>{const list=reachKeysOf(x).map(k=>({...k}));change(list,x);list.sort((a,b)=>a.at-b.at);if(list.length)x.reachKeys=list.slice(0,16);else delete x.reachKeys;},text,undoKey?{undoKey}:undefined);}
  async function changed(el){
    if(keyChanged(el))return;   // S33: the selected key's Inspector
    if(pose.changed(el))return;
    if(paths.changed(el))return;   // S31 M3 hook
    const name=el.name,e=sel&&entry(sel),v=Number(el.value);
    if(name==='pe-sex'||name==='pe-age'||name==='pe-heritage'){filters[name.slice(3)]=el.value;rerender();return;}
    if(!e)return;
    const who=personName(e),num=(lo,hi)=>{if(el.value.trim()===''||!Number.isFinite(v))throw Error('Type a number.');return Math.min(hi,Math.max(lo,v));};
    if(name==='pe-pose'){await swap(sel,null,el.value);return;}
    if(name?.startsWith('pe-color-')){const part=name.slice(9);if(!PARTS.includes(part)||!/^#[0-9a-f]{6}$/i.test(el.value))return;edit(sel,x=>{(x.colors||={})[part]=el.value.toLowerCase();},`${who}: ${part} recoloured.`,{undoKey:'people-color-'+part+sel});return;}
    if(name==='pe-anchor'){
      if(el.value==='free'){const o=objectOf(sel),spot=o&&tools?read(o):floorSpot(),shown=o?.userData?.person,as=shown?.variant&&modelOf(shown.id)?shown.id:null;   // they stay as they are now: in the posture the desk has them in
        edit(sel,x=>{if(as&&as!==x.id){const old=migratePostures(x);delete x.pose;delete x.poseKeys;if(old.postures)x.postures=old.postures;x.id=as;}delete x.desk;delete x.station;delete x.reach;delete x.beside;for(const f of SEAT_FIELDS)delete x[f];x.at=spot.at;x.turn=spot.turn;},`${who} stays where they are now and no longer follows the desk.`);}
      else if(el.value==='seat')return;
      else{const p=poseOf(e.id);edit(sel,x=>{for(const f of SEAT_FIELDS)delete x[f];delete x.at;delete x.turn;delete x.y;delete x.beside;x.desk=p?.stance==='seated'?'sit':p?.stance==='wheelchair'?'wheel':'stand';},`${who} is at the film desk and follows it.`);}
      return;
    }
    if(name==='pe-x'||name==='pe-z'){const i=name==='pe-x'?0:1,mm=num(-100000,100000);edit(sel,x=>{if(x.at)x.at[i]=Math.round(mm);},`Moved ${who}.`,{undoKey:'people-'+name+sel});return;}
    if(name==='pe-reach-sit'||name==='pe-reach-stand'){setReach(sel,num(0,118)*IN,name.slice(9));return;}
    if(name==='pe-chair-roll'||name==='pe-chair-scoot'){const f=name==='pe-chair-roll'?'chairRoll':'chairScoot',d=f==='chairRoll'?CHAIR_ROLL:CHAIR_SCOOT,hi=f==='chairRoll'?800:300,mm=Math.round(num(0,hi/IN)*IN);
      edit(sel,x=>{if(Math.abs(mm-d)<1.5)delete x[f];else x[f]=Math.min(hi,mm);},f==='chairRoll'?`${who}: the chair rolls back ${inch(mm)} in before they stand (the film's ${inch(d)} in).`:`${who}: slides ${inch(mm)} in to the front of the seat as they lean in (the film's ${inch(d)} in).`,{undoKey:'people-'+f+sel});return;}
    const rk=name?.match(/^pe-rk-(at|dur|to|ease)-(\d+)$/);
    if(rk){const i=Number(rk[2]),f=rk[1];const v=f==='ease'?el.value:f==='to'?Math.round(num(0,118)*IN):num(0,f==='at'?Math.max(1,seconds()):30);
      setReachKeys(sel,list=>{if(!list[i])return;if(f==='ease'){if(v==='linear')list[i].ease='linear';else delete list[i].ease;}else list[i][f]=f==='to'?v:Math.round(v*1000)/1000;},`${who}: roll ${i+1} ${f==='at'?'starts at '+r1(v)+' s':f==='dur'?'takes '+r1(v)+' s':f==='to'?'ends '+inch(v)+' in from the desk':v==='linear'?'moves at an even speed':'eases in and out'}.`,'people-rk-'+f+i+sel);return;}
    if(name==='pe-y'){const mm=num(-2000,5000);edit(sel,x=>{x.y=Math.round(mm);},`${who}: lifted ${Math.round(mm)} mm.`,{undoKey:'people-y'+sel});return;}
    if(name==='pe-turn'){const d=num(-360,360);edit(sel,x=>{x.turn=d;},`Turned ${who} to ${r1(d)}°.`,{undoKey:'people-turn'+sel});return;}
    if(name==='pe-scale'){const pc=num(20,300);edit(sel,x=>{x.scale=pc/100;},`${who} is now ${Math.round(pc)} % of their built size.`,{undoKey:'people-scale'+sel});return;}
    if(name==='pe-whole'){if(el.checked)write(p=>{if(p.when)delete p.when[sel];},`${who} is in the room for the whole chapter.`);else{setSpan(sel,s=>{s[0]=Math.min(Math.max(0,time()),seconds()-.5);});status(`${who} now has seconds of their own: set In and Out below.`);}return;}
    const sp=name?.match(/^pe-(in|out|fin|fout)(?:-(\d+))?$/);
    if(sp){const k=Number(sp[2]||0),f=sp[1];
      if(f==='in'){const t=num(0,seconds());setSpan(sel,s=>{s[0]=Math.min(t,s[1]-.05);},k);}
      else if(f==='out'){const t=num(0,seconds());setSpan(sel,s=>{s[1]=Math.max(t,s[0]+.05);},k);}
      else{const t=num(0,5);setSpan(sel,s=>{s[f==='fin'?2:3]=t;},k);}
      return;}
    if(name==='pe-look'){const v=el.value;edit(sel,x=>{if(v)x.look=[v];else delete x.look;},v?`${who} looks at ${personName(entry(v)||{id:v})}.`:`${who} looks where their posture looks.`);return;}
    if(name==='pe-act-at'||name==='pe-act-dur'){const f=name.slice(7),t=f==='at'?num(0,Math.max(1,seconds())):num(.1,30);edit(sel,x=>{if(x.act)x.act[f]=Math.round(t*1000)/1000;},`${who}: the action ${f==='at'?'at '+r1(t)+' s':'takes '+r1(t)+' s'}.`,{undoKey:'people-act-'+f+sel});return;}
    const by=name?.match(/^pe-act-by-(\d)$/);
    if(by){const i=Number(by[1]),mm=Math.round(num(-1000,1000));edit(sel,x=>{if(Array.isArray(x.act?.by))x.act.by[i]=mm;},`${who}: the hand pulls ${['across','up','out'][i]} ${mm} mm.`,{undoKey:'people-act-by'+i+sel});return;}
    const ch=name?.match(/^pe-ch-(seconds|arms|turn|step|line)(?:-(\d))?$/);
    if(ch){const f=ch[1];
      edit(sel,x=>{const c=x.change&&typeof x.change==='object'?x.change:{};
        if(f==='seconds'){if(el.value.trim()==='')delete c.seconds;else c.seconds=Math.round(num(.2,10)*100)/100;}
        else if(f==='step'){if(el.checked)c.step=true;else delete c.step;}
        else if(f==='line'){if(el.checked)c.hands='line';else delete c.hands;}
        else{const d=f==='arms'?[.22,1]:[0,.72],pair=[...(c[f]??d)],i=Number(ch[2]);pair[i]=Math.round(num(0,1)*100)/100;if(pair[0]>pair[1])pair[1-i]=pair[i];c[f]=pair;}
        if(Object.keys(c).length)x.change=c;else delete x.change;},
        f==='seconds'?`${who}: the change of posture takes ${el.value.trim()===''?'the film\'s time':r1(Number(el.value))+' s'}.`:f==='step'?`${who}: ${el.checked?'planted steps':'a glide'} into the new spot.`:f==='line'?`${who}: the hands ${el.checked?'go straight':'follow the arms\' arc'}.`:`${who}: ${f==='arms'?'the arms move':'the body turns'} in that part of the change.`,{undoKey:'people-change-'+f+sel});
      return;}
  }
  async function action(name,index){
    if(keyAction(name))return;   // S33: the selected key's Inspector
    if(pose.action(name,index))return;
    if(paths.action(name,index))return;   // S31 M3 hook
    if(name==='pe-pose-enter'){if(sel){await ensure();await enterPose(sel);}return;}
    if(name==='pe-pose-save'){savePose();return;}
    if(name==='pe-pose-copy-model'){copyToModel(index);return;}
    if(name==='pe-pose-apply'){await applySaved(index);return;}
    if(name==='pe-pose-delete'){deleteSaved(index);return;}
    if(name==='pe-lane'&&performance.now()<barSuppress)return;
    if(name==='pe-add'){openLibrary();return;}
    if(name==='pe-row'){const key=rowKeys[index];if(key)select(key);return;}
    if(name==='pe-lane'){const key=laneKeys[index];if(key)select(key);return;}
    if(name==='pe-eye'){const key=rowKeys[index],e=key&&entry(key);if(e)edit(key,x=>{if(x.hide)delete x.hide;else x.hide=true;},e.hide?`${personName(e)} is back in the chapter.`:`${personName(e)} is out of this chapter (kept in the list).`);return;}
    if(name==='pe-char'){const c=charIds[index];if(c&&sel)await swap(sel,c,null);return;}
    if(name==='pe-remove'){remove();return;}
    if(name==='pe-color-reset'){const part=PARTS[index],e=sel&&entry(sel);if(e?.colors?.[part])edit(sel,x=>{delete x.colors[part];if(!Object.keys(x.colors).length)delete x.colors;},`${personName(e)}: ${part} as built.`);return;}
    if(name==='pe-duplicate'){duplicate();return;}
    if(name==='pe-reach-reset'){const e=sel&&entry(sel);if(e?.desk)write(p=>{const x=p.cast.find(x=>x.key===sel);if(x){delete x.reach;delete x.sitReach;delete x.standReach;}},`${personName(e)} is at the film's distance from the desk again.`);return;}
    if(name==='pe-rk-add'){const e=sel&&entry(sel);if(!e?.desk)return;const now=reachAt(e,time()),t=Math.round(time()*10)/10;
      setReachKeys(sel,list=>{list.push({at:t,dur:1.5,to:Math.round(now+(list.length%2?50:-50))});},`${personName(e)} rolls ${reachKeysOf(e).length%2?'out':'in'} 2 in from ${r1(t)} s. Set where to and how long below.`);return;}
    if(name==='pe-rk-remove'){const e=sel&&entry(sel);if(!e)return;setReachKeys(sel,list=>{list.splice(index,1);},`${personName(e)}: roll ${index+1} removed.`);return;}
    if(name==='pe-face-camera'){face('camera');return;}
    if(name==='pe-face-desk'){face('desk');return;}
    if(name==='pe-in-now'){if(sel)setSpan(sel,s=>{s[0]=Math.min(time(),s[1]-.05);},spanAtPlayhead(sel));return;}
    if(name==='pe-out-now'){if(sel)setSpan(sel,s=>{s[1]=Math.max(time(),s[0]+.05);},spanAtPlayhead(sel));return;}
    if(name==='pe-span-add'||name==='pe-span-split'||name==='pe-span-remove'){
      const e=sel&&entry(sel);if(!e)return;const T=seconds(),t=time(),who=personName(e);
      write(p=>{const l=(p.when?.[sel]||[]).map(s=>[...s]);
        if(name==='pe-span-remove'){l.splice(index,1);}
        else if(name==='pe-span-split'){const i=l.findIndex(s=>t>s[0]+.5&&t<s[1]-.5);if(i<0)return;const s=l[i];l.splice(i,1,[s[0],t-.5,s[2]??.5,.5],[t+.5,s[1],.5,s[3]??.5]);}
        else{const end=l.length?Math.max(...l.map(s=>Math.min(s[1],T))):0,a=Math.min(Math.max(t,end+.5),T-1);if(a<0)return;l.push([Math.round(a*10)/10,Math.min(T+1,a+3),.5,.5]);l.sort((x,y)=>x[0]-y[0]);}
        if(l.length>8)l.length=8;(p.when||={})[sel]=l;if(!l.length)delete p.when[sel];},
        name==='pe-span-remove'?`${who}: stay ${index+1} removed.`:name==='pe-span-split'?`${who}: the stay is cut at ${r1(t)} s (out half a second before, back half a second after).`:`${who}: one more stay, from ${r1(Math.max(t,0))} s. Set In and Out.`);
      return;}
    if(name==='pe-ch-reset'){const e=sel&&entry(sel);if(e?.change)edit(sel,x=>{delete x.change;},`${personName(e)}: the change of posture takes the film's timing.`);return;}
    if(name==='pe-ch-closer'||name==='pe-ch-walk'||name==='pe-ch-face'){
      const e=sel&&entry(sel),prev=e&&handoverFrom(e),g=prev&&changeGap(prev,e);if(!g)return;const who=personName(e);
      if(name==='pe-ch-face'){const turn=prev.walk?.turn??prev.turn??0;edit(sel,x=>{x.turn=turn;},`${who} faces the way they did before the change (${r1(turn)}°).`);return;}
      if(name==='pe-ch-closer'){const k=200/g.mm,at=[Math.round(g.from[0]+(e.at[0]-g.from[0])*k),Math.round(g.from[1]+(e.at[1]-g.from[1])*k)];edit(sel,x=>{x.at=at;},`${who}: moved to 20 cm from where the change starts, so the two postures blend.`);return;}
      const t0=(spans(e.key)||[[0]])[0][0],start=Math.max(0,Math.round((t0-g.mm/1100-.8)*10)/10);
      write(p=>{const o=p.cast.find(x=>x.key===prev.key);if(o)o.walk={path:[[...o.at],[...e.at]],start};},`${personName(prev)} walks ${r1(g.mm/1000)} m to the new spot from ${r1(start)} s, so the change starts where they arrive. Check the arrival under Walk path.`);
      return;}
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
  // P5 paste attributes (Ctrl+C / Ctrl+Alt+V on a person): clothes and hair colours, size and whom they look at
  let attrClip=null;
  function copyAttrs(){const e=sel&&entry(sel);if(!e){status('Select a person first: Ctrl+C copies their colours, size and gaze.');return false;}attrClip={colors:e.colors?{...e.colors}:null,scale:e.scale??null,look:e.look?[...[].concat(e.look)]:null,name:personName(e)};status(`Copied ${attrClip.name}'s colours, size and gaze: Ctrl+Alt+V pastes them onto another person.`);return true;}
  function pasteAttrs(){const e=sel&&entry(sel);if(!attrClip){status('Copy a person\'s look first (Ctrl+C on them).');return false;}if(!e){status('Select the person to paste onto.');return false;}
    edit(sel,x=>{if(attrClip.colors)x.colors={...attrClip.colors};else delete x.colors;if(attrClip.scale)x.scale=attrClip.scale;else delete x.scale;const look=(attrClip.look||[]).filter(k=>k!==x.key);if(look.length)x.look=look;else delete x.look;},`${personName(e)}: the colours, size and gaze of ${attrClip.name}. Undo puts them back.`);return true;}
  function setMode(m){if(pose.active()){pose.setMode(m);return;}if(!MODES[m])return;mode=m;rerender();status(`People gizmo: ${MODES[m]}.`);}
  // ---- the library dialog
  const dialog=document.createElement('dialog');dialog.id='people-library';dialog.className='people-library';dialog.setAttribute('aria-labelledby','people-library-title');document.body.append(dialog);
  const chip=(group,value,label,n)=>`<button type="button" class="lamp-chip pl-chip" data-pe-filter="${group}" data-pe-value="${escape(value)}" aria-pressed="${lib[group]===value}">${escape(label)}${n===undefined?'':` <small>${n}</small>`}</button>`;
  function libraryList(){
    const words=lib.query.toLowerCase().split(/\s+/).filter(Boolean);
    shown=Object.entries(catalog.models).map(([id,m])=>({id,...m,c:catalog.characters[m.character]||{},p:catalog.poses[m.pose]||{}}))
      .filter(m=>(lib.sex==='all'||sexIs(m.c.sex,lib.sex))&&(lib.stance==='all'||m.p.stance===lib.stance)&&(lib.aid==='all'||m.aids.includes(lib.aid))&&words.every(w=>`${m.name} ${m.c.sex} ${m.c.age} ${m.c.heritage} ${m.p.stance} ${m.aids.join(' ')}`.toLowerCase().includes(w)));
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
    const c=who(e.id),p=poseOf(e.id),m=modelOf(e.id),s=spans(e.key)?.[0]||null,T=seconds(),o=objectOf(e.key),isFree=free(e),placed=placementOf(e);
    if(!catalog)return '<p class="director-hint">Loading the people catalog…</p>';
    if(e.poseSource){
      const view=poseEntry(e.key),head=`<div class="people-head"><strong>${escape(personName(e))}</strong><small>${escape(doing(view))}</small></div>`;
      if(pose.active()===e.key)return pose.panel(head);
      return `<section class="people-selected">${head}<p class="director-hint">Part of the room’s cast. Fine-tune the posture showing at the playhead.</p><button type="button" data-action="pe-pose-enter">Fine-tune pose…</button>${savedHTML(view)}</section>`;
    }
    const chars=Object.entries(catalog.characters).filter(([,x])=>(filters.sex==='all'||sexIs(x.sex,filters.sex))&&(filters.age==='all'||x.age===filters.age)&&(filters.heritage==='all'||x.heritage===filters.heritage));
    charIds=chars.map(([id])=>id);
    const face_=id=>{const any=Object.entries(catalog.models).find(([,x])=>x.character===id);return any?thumb(any[0]):'';};
    const uniq=k=>[...new Set(Object.values(catalog.characters).map(x=>x[k]))];
    // children have their own postures (built on child furniture), adults theirs
    const kid=catalog.characters[m?.character]?.age==='child';
    const poses=STANCES.map(st=>[st,Object.entries(catalog.poses).filter(([id,x])=>x.stance===st&&/^kid-/.test(id)===kid)]).filter(([,l])=>l.length);
    const built=id=>!!(m&&modelFor(m.character,id));
    const here=!o?'Loading the model…':o.visible?'':s&&!isFree?'':s?`Not in the room at ${r1(time())} s.`:isFree?'':'Not showing now: the desk is between sitting and standing height, where nobody works at it.';
    const head=`<div class="people-head"><img src="${thumb(e.id)}" alt=""><div><strong>${escape(c?.name||personName(e))}</strong><small>${escape(c?[c.sex,c.age,c.height?Math.round(c.height*(e.scale||1))+' cm':''].filter(Boolean).join(' · '):e.id)}</small><small>${escape(doing(e))}${m?.aids?.length?' · '+escape(m.aids.join(', ')):''}</small></div></div>`;
    if(pose.active()===e.key)return pose.panel(head);
    const tuned=Object.keys(poseEntry(e.key)?.pose||{}).length;
    // the colours the model really has (read from its textures on the stage), and whether its outfit is one piece
    const asBuilt=o?stagePeople()?.partColors?.(e.key):null,onePiece=(c?.outfit||[]).every(g=>!/pants|skirt|jeans|shorts|trousers/i.test(g));
    return `<section class="people-selected" data-reveal="person">
      <div class="people-head"><img src="${thumb(e.id)}" alt=""><div><strong>${escape(c?.name||personName(e))}</strong><small>${escape(c?[c.sex,c.age,c.height?Math.round(c.height*(e.scale||1))+' cm':''].filter(Boolean).join(' · '):e.id)}</small><small>${escape(doing(e))}${m?.aids?.length?' · '+escape(m.aids.join(', ')):''}</small></div></div>
      ${busy?`<p class="director-hint people-busy">Building ${escape(busy.replace(/^people-/,''))}…</p>`:''}${here?`<p class="director-hint">${escape(here.trim())}</p>`:''}
      <h4>Character</h4>
      <div class="people-filters">${select_('pe-sex',filters.sex,[['all','Everyone'],['woman','Women'],['man','Men']])}${select_('pe-age',filters.age,[['all','Any age'],...uniq('age').map(a=>[a,cap(a)])])}${select_('pe-heritage',filters.heritage,[['all','Any heritage'],...uniq('heritage').map(a=>[a,a])])}</div>
      <div class="people-chars" role="listbox" aria-label="Character">${chars.map(([id,x],i)=>`<button type="button" data-action="pe-char" data-index="${i}" role="option" aria-selected="${id===m?.character}" title="${escape(`${x.name}: ${x.sex}, ${x.age}, ${x.heritage}, ${x.height} cm`)}${m&&!modelFor(id,m.pose)?' (this posture is built on request)':''}"><img src="${face_(id)}" alt="" loading="lazy"><span>${escape(x.name)}</span></button>`).join('')||'<p class="director-hint">Nobody matches these filters.</p>'}</div>
      <h4>Posture</h4>
      <select name="pe-pose" aria-label="Posture">${poses.map(([st,list])=>`<optgroup label="${cap(st)}">${list.map(([id,x])=>`<option value="${id}" ${id===p?.id?'selected':''}>${escape(x.label)}${x.desk?' · at the desk':''}${built(id)?'':' · built on request'}</option>`).join('')}</optgroup>`).join('')}</select>
      <div class="director-actions"><button type="button" data-action="pe-pose-enter" title="Turn joints and drag hands and feet to get the posture just right (or double-click the person in the view)">Fine-tune pose…</button><span class="director-hint people-tuned">${tuned?`${tuned} joint${tuned===1?'':'s'} adjusted`:'or double-click them in the view'}</span></div>
      ${loadSavedPoses(store()).length?`<h4>Saved poses</h4>${savedHTML(e)}`:''}
      <h4>Place</h4>
      ${select_('pe-anchor',isFree?'free':placed==='seat'||placed==='furniture'?'seat':'desk',[['free','Free spot (move by hand)'],['desk',e.station?'At a desk in the room':'At the film desk (follows it)'],...(placed==='seat'||placed==='furniture'?[['seat',placed==='seat'?'On a seat in the room (as the film has it)':'By furniture in the room (as the film has it)']]:[])])}
      ${isFree?`<div class="director-row people-fields">${field('X',`pe-x`,e.at[0],{step:10,unit:'mm'})}${field('Z','pe-z',e.at[1],{step:10,unit:'mm'})}${field('Turn','pe-turn',e.turn||0,{step:5,min:-360,max:360,unit:'°'})}${field('Lift','pe-y',e.y||0,{step:5,unit:'mm',title:'Raises a seated person onto a seat, or anyone onto a step'})}</div>
      <div class="director-actions people-modes">${Object.entries(MODES).map(([k,l])=>`<button type="button" data-action="pe-mode-${k}" aria-pressed="${mode===k}">${l}</button>`).join('')}<button type="button" data-action="pe-face-desk">Face the desk</button><button type="button" data-action="pe-face-camera">Face the camera</button></div>`:placed==='seat'||placed==='furniture'?`<p class="director-hint">${placed==='seat'?'They sit on a seat in the room':'They stand or sit by a piece of furniture in the room'}${typeof e.on==='string'?` (${escape(e.on)})`:''} and stay with it. Choose “Free spot” to place them by hand.</p>`:'<p class="director-hint">They work at the desk and move with it, and they sit or stand as its height changes: seated at 28 to 30 in, standing at 43.5 in, out of the way while it travels between.</p>'+seatPanel(e)}
      ${paths.panel(e)/* S31 M3 hook */}${motionPanel(e)}
      <div class="director-row people-fields">${field('Size','pe-scale',Math.round((e.scale||1)*100),{step:1,min:20,max:300,unit:'%',title:'100 % is the size the character was built at'})}</div>
      <h4>Clothes and hair</h4>
      <div class="people-colors">${PARTS.map((part,i)=>{const mine=e.colors?.[part],was=asBuilt?.[part]||c?.colors?.[part]||'#8a8f96';return `<label title="${mine?'Recoloured':'As built'}: ${part}">${cap(part)}<span><input type="color" name="pe-color-${part}" value="${escape(mine||was)}">${mine?`<button type="button" data-action="pe-color-reset" data-index="${i}" title="Back to the colour the character was built with">↺</button>`:''}</span></label>`;}).join('')}</div>
      <p class="director-hint">Outfit: ${escape((c?.outfit||[]).map(g=>g.replace(/^[a-z]+_/,'').replace(/[_-]+/g,' ').replace(/\d+$/,'').trim()).join(', ')||'as built')}. ${onePiece?' It is one piece: Top colours it above the waist, Bottom below.':''} A colour keeps the fabric's folds and weave.</p>
      <h4>In the room</h4>
      ${spansPanel(e)}
      <div class="director-actions people-end"><button type="button" data-action="pe-duplicate">Duplicate</button><button type="button" class="danger" data-action="pe-remove">Remove from the chapter</button></div>
    </section>`;
  }
  // At the film desk: how far from it they are, how far their chair rolls, and rolling in or out during the shot.
  function seatPanel(e){
    if(!e.desk||e.station)return '';
    const chair=e.desk!=='wheel'&&e.chair!==false,keys=reachKeysOf(e),T=Math.max(1,seconds()),changed=['reach','sitReach','standReach'].some(f=>e[f]!==undefined);
    const dist=stance=>field(stance==='sit'?(e.desk==='wheel'?'In the wheelchair':'Seated'):'Standing','pe-reach-'+stance,inch(reachOfStance(e,stance)),{step:.5,min:0,max:118,unit:'in',title:`${stance==='sit'?'Seated':'Standing'}: their distance from the keyboard's front edge (the film's ${inch(reachDefault(e,stance))} in).${stance==='sit'?' The chair moves with them.':''} Or drag the arrow in the view.`});
    const rows=keys.map((k,i)=>`<div class="people-rk"><span>${i+1}</span>${field('At','pe-rk-at-'+i,k.at,{step:.1,min:0,max:T,unit:'s',title:'The chapter second the roll starts'})}${field('Over','pe-rk-dur-'+i,k.dur??1.5,{step:.1,min:0,max:30,unit:'s',title:'How long it takes'})}${field('To','pe-rk-to-'+i,inch(k.to),{step:.5,min:0,max:118,unit:'in',title:'Their distance from the desk at the end'})}${select_('pe-rk-ease-'+i,k.ease==='linear'?'linear':'smooth',[['smooth','Ease in and out'],['linear','Even speed']])}<button type="button" class="pose-saved-x" data-action="pe-rk-remove" data-index="${i}" aria-label="Remove roll ${i+1}" title="Remove this roll">×</button></div>`).join('');
    return `<h4>Seat and chair</h4>
      <p class="director-hint">Distance from the desk</p>
      <div class="director-row people-fields">${dist('sit')}${e.desk!=='wheel'?dist('stand'):''}${changed?`<button type="button" data-action="pe-reach-reset" title="Back to the film's distances">↺</button>`:''}</div>
      ${chair?`<div class="director-row people-fields">${field('Chair rolls back','pe-chair-roll',inch(e.chairRoll??CHAIR_ROLL),{step:.5,min:0,max:31,unit:'in',title:`How far the chair rolls back before they stand, and in again as they sit (the film's ${inch(CHAIR_ROLL)} in)`})}${field('Slide to the seat front','pe-chair-scoot',inch(e.chairScoot??CHAIR_SCOOT),{step:.5,min:0,max:11.8,unit:'in',title:`How far they slide forward on the seat as they lean in to stand (the film's ${inch(CHAIR_SCOOT)} in)`})}</div>`:''}
      <h4>Roll in / out <small>seated</small></h4>
      ${rows||'<p class="director-hint">They stay at that distance. Add a roll to have them roll their chair in or out during the shot.</p>'}
      <div class="director-actions"><button type="button" data-action="pe-rk-add" ${keys.length>=16?'disabled title="16 rolls at most"':''}>+ Roll in / out at the playhead</button></div>`;
  }
  // Every stay of theirs in the chapter (the film keeps 8 at most: people-edits.mjs cleanSpans and the import).
  function spansPanel(e){
    const list=spans(e.key)||[],T=seconds();
    if(!list.length)return `<label class="director-check"><input type="checkbox" name="pe-whole" checked>The whole chapter</label>`;
    const row=(sp,k)=>`<div class="people-span" data-span-row="${k}"><span>${k+1}</span>${field('In','pe-in-'+k,sp[0],{step:.1,min:0,max:T,unit:'s'})}${field('Out','pe-out-'+k,Math.min(sp[1],T),{step:.1,min:0,max:T,unit:'s'})}${field('Fade in','pe-fin-'+k,sp[2]??.5,{step:.1,min:0,max:5,unit:'s'})}${field('Fade out','pe-fout-'+k,sp[3]??.5,{step:.1,min:0,max:5,unit:'s'})}${list.length>1?`<button type="button" class="pose-saved-x" data-action="pe-span-remove" data-index="${k}" aria-label="Remove stay ${k+1}" title="Remove this stay">×</button>`:''}</div>`;
    return `<label class="director-check"><input type="checkbox" name="pe-whole">The whole chapter</label>${list.map(row).join('')}
      <div class="director-actions"><button type="button" data-action="pe-in-now">In at the playhead</button><button type="button" data-action="pe-out-now">Out at the playhead</button></div>
      <div class="director-actions"><button type="button" data-action="pe-span-add" ${list.length>=8?'disabled title="8 stays at most (the film keeps 8)"':''}>+ Stay</button><button type="button" data-action="pe-span-split" ${list.length>=8?'disabled':''} title="Cut the stay under the playhead in two, a second apart">Split at the playhead</button>${list.length>=8?'<span class="director-hint">8 stays at most.</span>':''}</div>`;
  }
  // The stay under the playhead (or the first): what In / Out at the playhead change.
  function spanAtPlayhead(key){const l=spans(key)||[],t=time();const i=l.findIndex(s=>t>=s[0]-.05&&t<=s[1]+.05);return i<0?0:i;}
  // The placement of the same character whose stay ends as this one's starts: the two make a change of posture
  // (room-people.mjs pairUp / sameSpot: windows within .75 s; the spots within 220 mm and 17°, or it is a cross-fade).
  function handoverFrom(e){
    const c=characterOf(e.id),mine=spans(e.key);if(!mine?.length)return null;const t0=mine[0][0];if(!(t0>0))return null;
    return cast().find(o=>o.key!==e.key&&!o.hide&&characterOf(o.id)===c&&(spans(o.key)||[]).some(s=>Math.abs(s[1]-t0)<.75))||null;
  }
  function changeGap(prev,e){
    const a=endsOf(prev).end,b=Array.isArray(e.at)?e.at:null;if(!a||!b)return null;
    const turn=Math.abs((((prev.walk?.turn??prev.turn??0)-(e.turn??0)+540)%360)-180);
    return {mm:Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])),turn:Math.round(turn),from:a};
  }
  function motionPanel(e){
    const others=cast().filter(o=>o.key!==e.key&&!o.hide),look=[].concat(e.look??[])[0]||'',out=[];
    out.push(`<div class="director-row people-fields"><label class="people-wide">Looks at${select_('pe-look',look,[['','Where the posture looks'],...others.map(o=>[o.key,`${personName(o)} · ${o.key}`]),...(look&&!others.some(o=>o.key===look)?[[look,look]]:[])])}</label></div>`);
    if(e.act&&typeof e.act==='object'){
      const by=Array.isArray(e.act.by)?e.act.by:null;
      out.push(`<h4>Action</h4><div class="director-row people-fields">${field('At','pe-act-at',e.act.at??0,{step:.1,min:0,max:Math.max(1,seconds()),unit:'s',title:'The chapter second the action happens'})}${field('Takes','pe-act-dur',e.act.dur??1,{step:.1,min:.1,max:30,unit:'s'})}</div>
        ${by?`<div class="director-row people-fields">${['X','Y','Z'].map((l,i)=>field('Pull '+l,'pe-act-by-'+i,by[i]??0,{step:5,min:-1000,max:1000,unit:'mm',title:'How far the hand draws the touchscreen out (desk frame: X across, Y up, Z toward them)'})).join('')}</div>`:''}`);
    }
    const prev=handoverFrom(e);
    if(e.change||prev){
      const c=e.change||{},g=prev&&changeGap(prev,e),far=g&&(g.mm>220||g.turn>17);
      out.push(`<h4>Posture change${prev?` <small>from ${escape(personName(prev))} · ${escape(prev.key)}</small>`:''}</h4>
        ${far?`<p class="people-path-late" role="alert">${g.mm>220?`The two spots are ${g.mm} mm apart`:`They turn ${g.turn}° between the two`}: too far to blend, so they will cross-fade (220 mm and 17° at most).</p><div class="director-actions">${g.mm>220?'<button type="button" data-action="pe-ch-closer">Bring closer</button>':''}${g.mm>220&&!prev.walk&&!prev.roll&&Array.isArray(prev.at)?'<button type="button" data-action="pe-ch-walk">Make it a walk</button>':''}${g.turn>17?'<button type="button" data-action="pe-ch-face">Face the same way</button>':''}</div>`:''}
        <div class="director-row people-fields">${field('Takes','pe-ch-seconds',c.seconds??'',{step:.1,min:.2,max:10,unit:'s',title:'How long the change takes (empty: 1.4 s, 2.4 s to get up or sit down)'})}${field('Arms from','pe-ch-arms-0',(c.arms??[.22,1])[0],{step:.05,min:0,max:1,title:'The part of the change (0 to 1) in which the arms move'})}${field('to','pe-ch-arms-1',(c.arms??[.22,1])[1],{step:.05,min:0,max:1})}${field('Turn from','pe-ch-turn-0',(c.turn??[0,.72])[0],{step:.05,min:0,max:1,title:'The part of the change in which the body turns and moves to the new spot'})}${field('to','pe-ch-turn-1',(c.turn??[0,.72])[1],{step:.05,min:0,max:1})}</div>
        <label class="director-check"><input type="checkbox" name="pe-ch-step" ${c.step?'checked':''}>Planted steps (left, then right)</label>
        <label class="director-check"><input type="checkbox" name="pe-ch-line" ${c.hands==='line'?'checked':''}>Hands go straight</label>
        ${e.change?'<div class="director-actions"><button type="button" data-action="pe-ch-reset">↺ Film\'s timing</button></div>':''}`);
    }
    return out.join('');
  }
  function panel(){
    if(!catalog)loadCatalog();
    const list=cast(),mine=!!own(),T=seconds();rowKeys=list.map(e=>e.key);const e=sel&&entry(sel);
    const row=(x,i)=>`<div class="people-row ${x.key===sel?'selected':''} ${x.hide?'off':''}" data-person-key="${escape(x.key)}"><button type="button" class="people-pick" data-action="pe-row" data-index="${i}" title="Select ${escape(personName(x))}"><img src="${thumb(x.id)}" alt="" loading="lazy"><span><strong>${escape(personName(x))}</strong><small>${escape(doing(x))}</small><small>${escape(x.desk?(x.station?'at a room desk':'at the film desk'):'free spot')} · ${escape(spanText(spans(x.key),T))}</small></span></button><button type="button" class="people-eye" ${x.poseSource?'disabled':''} data-action="pe-eye" data-index="${i}" aria-pressed="${!x.hide}" title="${x.hide?'Bring back into the chapter':'Take out of the chapter (keeps the entry)'}">${x.hide?'○':'●'}</button></div>`;
    return `<div class="director-heading"><div><span class="director-kicker">PEOPLE</span><h3>${list.length?`${count()} in this chapter`:'Nobody in this chapter'}</h3></div></div>
      <div class="director-actions"><button type="button" data-action="pe-add">+ Add person</button>${list.length?'':'<button type="button" data-action="pe-room">Bring in the room\'s people</button>'}${mine?'<button type="button" data-action="pe-reset" title="Back to the cast the film has for this chapter">Reset to the film</button>':''}</div>
      <p class="director-hint">${mine?'This chapter has its own cast.':list.length?'This is the film\'s cast. Your first change copies it into the chapter.':'Add people from the library, or bring in the people who live in this room.'} Click a person in the view or in the list.</p>
      ${keyInspector()}<div class="people-list">${list.map(row).join('')}</div>${e?selectedPanel(e):''}`;
  }
  // ---- the People KEYFRAME SHEET (S33 A2; people-track.mjs sheet): After Effects' twirl-down / Blender's dope sheet.
  // A row per character: collapsed, a small diamond wherever any of its properties has a key and a thin bar while
  // they are on screen; twirled open (▸), its property rows On screen / Path / Actions / Pose; Pose twirls open to a
  // row per keyed joint. A key's shape is its interpolation (pose keys: diamond linear, circle smooth, square hold;
  // the programmed motion's time keys are diamonds).
  const SHEET_OPEN='ergoflex.director.peopleSheet';
  const twirls=(()=>{try{return new Set(JSON.parse(globalThis.localStorage?.getItem(SHEET_OPEN)||'[]'));}catch{return new Set();}})();
  const saveTwirls=()=>{try{localStorage.setItem(SHEET_OPEN,JSON.stringify([...twirls]));}catch{}};
  let sheetRows=[],sheetMap=new Map(),picked=new Set(),skJoint=null;
  const walkSeconds=k=>stagePeople()?.byKey?.(k)?.userData?.personLife?.plan?.seconds;
  const jointName=b=>JOINTS.find(j=>j[0]===b)?.[1]||b;
  const posture=e=>poseOf(e.id)?.label||e.id.replace(/^people-[a-z]+-/,'').replace(/-/g,' ');
  function track(){const p=currentPeople();sheetRows=sheet(p,seconds(),{walkSeconds,label:posture,jointOrder:JOINTS.map(j=>j[0])});sheetMap=sheetKeys(sheetRows);for(const id of picked)if(!sheetMap.has(id))picked.delete(id);return sheetRows;}
  const KIND_TITLE={'in':'comes in','out':'goes out','change':'posture change','walk-start':'sets off (walk)','walk-point':'walk waypoint','walk-end':'arrives (walk)','roll-start':'sets off (roll)','roll-point':'roll waypoint','roll-end':'arrives (roll)','act':'action','act-end':'action ends','pose':'pose key','joint':'joint key'};
  const keyTitle=k=>`${k.entry}${k.posture?' · '+posture({id:k.posture}):''}: ${k.kind==='joint'?jointName(k.bone)+' key':KIND_TITLE[k.kind]||k.label} at ${k.t.toFixed(2)} s${k.ease?' · '+k.ease:''}${k.linked?' (the placement edge it starts with)':''}`;
  const shapeOf=k=>k.ease?EASE_SHAPES[k.ease]||'circle':'diamond';
  const pct=t=>`${Math.max(0,Math.min(100,t/(seconds()||1)*100))}%`;
  const keyBtn=k=>`<button type="button" class="sk sk-${shapeOf(k)} sk-${k.prop} ${picked.has(k.id)?'selected':''}" data-sk="${escape(k.id)}" style="left:clamp(6px,${pct(k.t)},calc(100% - 6px))" title="${escape(keyTitle(k))}" aria-label="${escape(keyTitle(k))}"></button>`;
  const playheadLine=()=>`<div class="camera-track-playhead" data-shared-playhead style="left:${pct(time())}"></div>`;
  const sheetRow=(cls,label,lane,attrs='')=>`<div class="desk-lane-row ps-row ${cls}" data-lane-color="people" ${attrs}><span class="desk-lane-label">${label}</span><div class="desk-lane ps-lane">${lane}${playheadLine()}</div></div>`;
  const twirl=(id,open,what)=>`<button type="button" class="ps-twirl" data-ps-twirl="${escape(id)}" aria-expanded="${open}" title="${open?'Fold':'Show'} ${escape(what)}">${open?'▾':'▸'}</button>`;
  // ◀ ◆ ▶ at the left of each property row: the previous key of the row, add / remove a key at the playhead, the next.
  const NAV='<span class="ps-nav"><button type="button" data-ps-nav="-1" title="Previous key of this row (J: of the sheet)">◀</button><button type="button" data-ps-nav="0" title="Add or remove a key of this row at the playhead">◆</button><button type="button" data-ps-nav="1" title="Next key of this row (K: of the sheet)">▶</button></span>';
  function trackRows(){
    if(!film()?.people&&!own())return '';
    const rows=track();
    return rows.map(r=>{
      const open=twirls.has(r.row),on=r.entries.includes(sel);
      const summary=`${r.bars.map(b=>`<i class="ps-onscreen" style="left:${pct(b.t0)};width:calc(${pct(b.t1)} - ${pct(b.t0)})"></i>`).join('')}${r.summary.map(t=>`<i class="ps-dot" style="left:${pct(t)}"></i>`).join('')}`;
      let html=sheetRow(`ps-char ${on?'selected':''}`,`${twirl(r.row,open,r.label+'\'s properties')}<b>${escape(r.label)}</b>`,summary,`data-ps-row="${escape(r.row)}" data-person-keys="${escape(r.entries.join(' '))}"`);
      if(!open)return html;
      const P=r.props,poseOpen=twirls.has(r.row+'|pose'),nav=NAV;
      html+=sheetRow('ps-prop',`<span class="ps-name">On screen</span>${nav}`,`${r.bars.map(b=>`<span class="ps-bar ps-place" style="left:${pct(b.t0)};width:calc(${pct(b.t1)} - ${pct(b.t0)})" title="${escape(b.entry)}: ${escape(b.label)} · ${b.t0.toFixed(2)}–${b.t1.toFixed(2)} s">${escape(b.label)}</span>`).join('')}${P.screen.map(keyBtn).join('')}`,`data-ps-prop="screen" data-ps-of="${escape(r.row)}"`);
      html+=sheetRow('ps-prop',`<span class="ps-name">Path</span>${nav}`,P.path.length?P.path.map(keyBtn).join(''):'<span class="ps-empty">no walk or roll</span>',`data-ps-prop="path" data-ps-of="${escape(r.row)}"`);
      html+=sheetRow('ps-prop',`<span class="ps-name">Actions</span>${nav}`,P.actions.length?`${r.actBars.map(b=>`<span class="ps-bar ps-act" style="left:${pct(b.t0)};width:calc(${pct(b.t1)} - ${pct(b.t0)})"></span>`).join('')}${P.actions.map(keyBtn).join('')}`:'<span class="ps-empty">no actions</span>',`data-ps-prop="actions" data-ps-of="${escape(r.row)}"`);
      html+=sheetRow('ps-prop',`${r.joints.length?twirl(r.row+'|pose',poseOpen,'a row per keyed joint'):'<span class="ps-twirl-gap"></span>'}<span class="ps-name">Pose</span>${nav}`,P.pose.length?P.pose.map(keyBtn).join(''):'<span class="ps-empty">no pose keys · double-click the person to pose</span>',`data-ps-prop="pose" data-ps-of="${escape(r.row)}"`);
      if(poseOpen){
        const models=[...new Set(P.pose.map(k=>k.posture||''))];
        for(const model of models){
          const group=r.row+'|pose|'+model,expanded=!model||twirls.has(group),keys=P.pose.filter(k=>(k.posture||'')===model);
          if(model)html+=sheetRow('ps-prop',`${twirl(group,expanded,'keyed joints')}<span class="ps-name">${escape(posture({id:model}))}</span>${nav}`,keys.map(keyBtn).join(''),`data-ps-prop="pose" data-ps-posture="${escape(model)}" data-ps-of="${escape(r.row)}"`);
          if(expanded)for(const j of r.joints.filter(j=>(j.posture||'')===model))html+=sheetRow('ps-prop ps-joint',`<span class="ps-name" title="${escape(jointName(j.bone))}">${escape(jointName(j.bone))}</span>${nav}`,j.keys.map(keyBtn).join(''),`data-ps-prop="joint" data-ps-posture="${escape(model)}" data-ps-bone="${escape(j.bone)}" data-ps-of="${escape(r.row)}"`);
        }
      }
      return html;
    }).join('');
  }
  document.addEventListener('click',ev=>{
    const b=ev.target.closest?.('[data-ps-twirl]');if(!b)return;ev.preventDefault();ev.stopPropagation();
    const id=b.dataset.psTwirl;if(twirls.has(id))twirls.delete(id);else twirls.add(id);saveTwirls();rerender();
  },true);
  // ---- selecting keys (M-b): click selects, Shift+click adds or takes out, a drag on empty row space is a marquee.
  // The key's person becomes the selected person, so the People tab shows the key's Inspector.
  const pickedKeys=()=>[...picked].map(id=>sheetMap.get(id)).filter(Boolean);
  const rowOf=k=>sheetRows.find(r=>r.row===k.row);
  function setPicked(next,{focus=null}={}){
    picked=next;const k=focus&&sheetMap.get(focus)||pickedKeys()[0];
    if(k&&k.kind==='joint')skJoint=k.bone;else if(k&&k.kind==='pose'&&!k.bones.includes(skJoint))skJoint=k.bones[0]||null;
    if(k&&sel!==k.entry&&entry(k.entry)){select(k.entry,{announce:false});return;}
    if(k)onSelect();rerender();
  }
  const peopleChanged=(next,text)=>write(p=>{for(const key of Object.keys(p))delete p[key];Object.assign(p,structuredClone(next));},text);
  const cur=()=>currentPeople();
  let press=null,box=null;
  document.addEventListener('pointerdown',ev=>{
    if(ev.button!==0)return;
    const keyEl=ev.target.closest?.('[data-sk]'),laneEl=!keyEl&&ev.target.closest?.('.ps-row .ps-lane');
    if(!keyEl&&!laneEl)return;
    ev.preventDefault();ev.stopPropagation();
    if(keyEl){const lane=keyEl.parentElement.getBoundingClientRect();press={id:keyEl.dataset.sk,x:ev.clientX,y:ev.clientY,shift:ev.shiftKey,left:lane.left,width:lane.width,moved:false};return;}
    box={x:ev.clientX,y:ev.clientY,add:ev.shiftKey,base:new Set(picked),el:null};
  },true);
  document.addEventListener('pointermove',ev=>{
    if(box){
      if(!box.el){if(Math.hypot(ev.clientX-box.x,ev.clientY-box.y)<5)return;box.el=document.createElement('div');box.el.className='timeline-marquee';document.body.append(box.el);}
      const l=Math.min(box.x,ev.clientX),r=Math.max(box.x,ev.clientX),t=Math.min(box.y,ev.clientY),b=Math.max(box.y,ev.clientY);
      Object.assign(box.el.style,{left:l+'px',top:t+'px',width:r-l+'px',height:b-t+'px'});
      const hits=[...document.querySelectorAll('.ps-row [data-sk]')].filter(e=>{const q=e.getBoundingClientRect();return q.right>=l&&q.left<=r&&q.bottom>=t&&q.top<=b;}).map(e=>e.dataset.sk);
      box.hits=hits;const now=pick(box.base,hits,{add:box.add});for(const e of document.querySelectorAll('.ps-row [data-sk]'))e.classList.toggle('selected',now.has(e.dataset.sk));box.el.dataset.count=String(now.size);
      return;
    }
    if(press)dragMove(ev);
  },true);
  document.addEventListener('pointerup',ev=>{
    if(box){const b=box;box=null;b.el?.remove();
      if(b.el){setPicked(pick(b.base,b.hits||[],{add:b.add}));status(`${picked.size} key${picked.size===1?'':'s'} selected.`);}
      else if(!b.add&&picked.size){picked=new Set();rerender();}
      return;}
    if(!press)return;const p=press;press=null;ev.stopPropagation();
    if(p.moved){dragEnd(p,ev);return;}
    setPicked(p.shift?pick(picked,[p.id],{toggle:true}):pick(picked,[p.id]),{focus:p.id});
    const k=sheetMap.get(p.id);if(!k)return;
    // a plain click also takes the playhead to the key (as the pose panel's diamonds do); a pose key opens pose mode on
    // its placement there, with that key selected, ready for the dots (17 Nov 2026, Vico)
    if(!p.shift&&editing()){seek(k.t);if((k.kind==='pose'||k.kind==='joint')&&entry(k.entry)){if(pose.active()!==k.entry)enterPose(k.entry);pose.focusKey(k.t);}}
    status(`${keyTitle(k)}. Drag to move${picked.size>1?' the selected keys':''} · J / K previous / next key · Delete removes it.`);
  },true);
  document.addEventListener('pointercancel',()=>{box?.el?.remove();box=null;if(press?.moved)rerender();press=null;},true);
  document.addEventListener('click',ev=>{if(ev.target.closest?.('[data-sk],.ps-row .ps-lane')){ev.preventDefault();ev.stopPropagation();}},true);
  // ◀ ◆ ▶ of a property row
  function rowOfNav(el){
    const r=el.closest('[data-ps-prop]'),row=sheetRows.find(x=>x.row===r?.dataset.psOf);if(!row)return null;
    const prop=r.dataset.psProp,bone=r.dataset.psBone||null,posture=r.dataset.psPosture||null;
    return {row,prop,bone,posture,keys:prop==='joint'?row.joints.find(j=>j.bone===bone&&(j.posture||null)===posture)?.keys||[]:row.props[prop].filter(k=>!posture||k.posture===posture)};
  }
  function jump(times,dir){const t=neighborTime(times,time(),dir);if(t===undefined){status(dir<0?'No key before the playhead.':'No key after the playhead.');return null;}seek(t);return t;}
  document.addEventListener('click',ev=>{
    const b=ev.target.closest?.('[data-ps-nav]');if(!b)return;ev.preventDefault();ev.stopPropagation();
    const n=rowOfNav(b);if(!n)return;const dir=Number(b.dataset.psNav);
    if(dir){const t=jump(n.keys.map(k=>k.t),dir);if(t!==undefined&&t!==null){const k=n.keys.find(k=>Math.abs(k.t-t)<1e-6);if(k)setPicked(pick(picked,[k.id]),{focus:k.id});}return;}
    toggleAtPlayhead(n);
  },true);
  // J / K: the previous / next key of the sheet (every key showing), as After Effects. Esc: no key selected (first; the
  // next Esc clears the person, director.mjs). On window, capture: before the Director's own keys on the document.
  addEventListener('keydown',ev=>{
    if(!open()||ev.target.closest?.('input,select,textarea,[contenteditable]')||document.querySelector('dialog[open]'))return;
    if(keyCommand(ev))return;
    if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
    const k=ev.key.toLowerCase();
    if((k==='j'||k==='k')&&document.querySelector('.ps-row')){ev.preventDefault();ev.stopImmediatePropagation();jump([...document.querySelectorAll('.ps-row [data-sk]')].map(e=>sheetMap.get(e.dataset.sk)?.t).filter(t=>t!==undefined),k==='j'?-1:1);return;}
    if(!picked.size)return;
    if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();picked=new Set();rerender();status('No key selected.');}
  },true);
  // ---- the Inspector for the selected key(s) (top of the People tab)
  const PROP_NAME={screen:'On screen',path:'Path',actions:'Actions',pose:'Pose',joint:'Pose'};
  const fx=v=>Number((Math.round(v*1000)/1000).toFixed(3));
  const numField=(label,name,value,step,unit,extra='')=>`<label>${label}<input type="number" name="${name}" value="${value}" step="${step}" ${extra}>${unit?`<small>${unit}</small>`:''}</label>`;
  function easeField(keys){
    const eased=keys.filter(k=>k.ease),same=eased.length&&eased.every(k=>k.ease===eased[0].ease)?eased[0].ease:'';
    if(!eased.length)return `<label title="${escape(NO_EASE)}">Interpolation<select name="pe-sk-ease" disabled><option>Linear (time key)</option></select></label><p class="director-hint ps-why">${escape(NO_EASE)}</p>`;
    return `<label>Interpolation<select name="pe-sk-ease">${same?'':'<option value="" selected>Mixed</option>'}${[['linear','Linear ◆'],['smooth','Smooth (ease) ●'],['hold','Hold ■']].map(([v,l])=>`<option value="${v}" ${v===same?'selected':''}>${l}</option>`).join('')}</select></label>`;
  }
  function keyInspector(){
    const keys=pickedKeys();if(!keys.length)return '';
    const people=cur();
    if(keys.length>1){
      const who=[...new Set(keys.map(k=>k.row))].map(r=>sheetRows.find(x=>x.row===r)?.label||r).join(', ');
      return `<section class="ps-inspector" data-ps-inspector data-reveal="person"><div class="director-heading"><div><span class="director-kicker">KEYS</span><h3>${keys.length} keys selected</h3></div></div>
        <p class="director-hint">${escape(who)} · ${fx(Math.min(...keys.map(k=>k.t)))}–${fx(Math.max(...keys.map(k=>k.t)))} s</p>
        <div class="director-row people-fields">${numField('Move by','pe-sk-dt',0,.05,'s','title="Shifts every selected key by this many seconds (one undo step)"')}${easeField(keys)}</div>
        <div class="director-actions"><button type="button" data-action="pe-sk-delete" class="danger">Delete keys</button></div></section>`;
    }
    const k=keys[0],row=rowOf(k),e=entry(k.entry),what=k.kind==='joint'?`Pose › ${jointName(k.bone)}`:PROP_NAME[k.prop];
    let values='';
    if(k.kind==='pose'||k.kind==='joint'){
      const at=(postureRecord(e,k.posture||e?.id).poseKeys||[]).find(x=>Math.abs(x.t-k.t)<1e-6),bone=k.kind==='joint'?k.bone:(k.bones.includes(skJoint)?skJoint:k.bones[0]),a=turnAngles(at?.pose?.[bone]);
      values=`${k.kind==='pose'?`<label>Joint<select name="pe-sk-joint">${k.bones.map(b=>`<option value="${escape(b)}" ${b===bone?'selected':''}>${escape(jointName(b))}</option>`).join('')}</select></label>`:''}
        <div class="director-row people-fields pose-angles">${['Bend','Twist','Side'].map((l,i)=>numField(l,'pe-sk-r'+'xyz'[i],a[i],1,'°','min="-180" max="180"')).join('')}</div>`;
    }else if(k.prop==='path'){
      const w=waypointOf(people,k);
      values=w?`<div class="director-row people-fields">${numField('X','pe-sk-x',w[0],10,'mm')}${numField('Z','pe-sk-z',w[1],10,'mm')}</div>`:'<p class="director-hint">This point is where they stand (their place in the People tab).</p>';
    }else if(k.prop==='screen'){
      const placed=entry(k.kind==='change'?k.d.next:k.entry),p=placed&&poseOf(placed.id),m=placed&&modelOf(placed.id),kid=catalog?.characters?.[m?.character]?.age==='child';
      values=placed&&catalog?`<label>Posture ${k.kind==='change'?'from here':k.kind==='in'?'coming in':'going out'}<select name="pe-sk-posture">${Object.entries(catalog.poses).filter(([id])=>/^kid-/.test(id)===kid).map(([id,x])=>`<option value="${id}" ${id===p?.id?'selected':''}>${escape(x.label)}</option>`).join('')}</select></label>`:'';
    }
    return `<section class="ps-inspector" data-ps-inspector data-reveal="person"><div class="director-heading"><div><span class="director-kicker">KEY · ${escape(what.toUpperCase())}</span><h3>${escape(row?.label||k.entry)} · ${escape(k.kind==='joint'?jointName(k.bone):KIND_TITLE[k.kind]||k.label)}</h3></div></div>
      <p class="director-hint">${escape(k.entry)}${k.linked?' · the placement edge this set-off starts with':''}</p>
      <div class="director-row people-fields">${numField('Time','pe-sk-t',fx(k.t),.05,'s',`min="0" max="${seconds()}"`)}${easeField([k])}</div>${values}
      <div class="director-actions"><button type="button" data-action="pe-sk-prev" title="Previous key of this row (J: of the sheet)">◀ Previous</button><button type="button" data-action="pe-sk-next" title="Next key of this row">Next ▶</button><button type="button" class="danger" data-action="pe-sk-delete" title="Delete">Delete</button></div></section>`;
  }
  function stepKey(dir){
    const k=pickedKeys()[0];if(!k)return;const r=rowOf(k),list=k.kind==='joint'?r.joints.find(j=>j.bone===k.bone)?.keys||[]:r.props[k.prop];
    const t=neighborTime(list.map(x=>x.t),k.t,dir),n=t!==undefined&&list.find(x=>Math.abs(x.t-t)<1e-6);if(!n){status(dir<0?'The first key of this row.':'The last key of this row.');return;}
    seek(n.t);setPicked(new Set([n.id]),{focus:n.id});
  }
  function keyAction(name){
    if(name==='pe-sk-prev'){stepKey(-1);return true;}
    if(name==='pe-sk-next'){stepKey(1);return true;}
    if(name==='pe-sk-delete'){deletePicked();return true;}
    return false;
  }
  function keyChanged(el){
    const name=el.name,keys=pickedKeys();if(!name?.startsWith('pe-sk-'))return false;if(!keys.length)return true;
    const v=Number(el.value),k=keys[0],num=()=>{if(el.value.trim()===''||!Number.isFinite(v))throw Error('Type a number.');return v;};
    if(name==='pe-sk-joint'){skJoint=el.value;rerender();return true;}
    if(name==='pe-sk-t'){moveKeys(keys,num()-k.t);return true;}
    if(name==='pe-sk-dt'){moveKeys(keys,num());return true;}
    if(name==='pe-sk-ease'){setInterp(keys,el.value);return true;}
    if(/^pe-sk-r[xyz]$/.test(name)){
      const at=(postureRecord(entry(k.entry),k.posture||entry(k.entry)?.id).poseKeys||[]).find(x=>Math.abs(x.t-k.t)<1e-6),bone=k.kind==='joint'?k.bone:(k.bones.includes(skJoint)?skJoint:k.bones[0]),a=turnAngles(at?.pose?.[bone]);
      a['xyz'.indexOf(name.slice(-1))]=Math.max(-180,Math.min(180,num()));const next=setJointAngles(cur(),k,bone,a);
      if(next)peopleChanged(next,`${personName(entry(k.entry))}: ${jointName(bone).toLowerCase()} at ${fx(k.t)} s, bend ${a[0]}° twist ${a[1]}° side ${a[2]}°.`);return true;
    }
    if(name==='pe-sk-x'||name==='pe-sk-z'){
      const w=waypointOf(cur(),k);if(!w)return true;const x=name==='pe-sk-x'?num():w[0],z=name==='pe-sk-z'?num():w[1],next=setWaypoint(cur(),k,x,z);
      if(next)peopleChanged(next,`${k.entry}: ${KIND_TITLE[k.kind]} at ${Math.round(x)}, ${Math.round(z)} mm.`);return true;
    }
    if(name==='pe-sk-posture'){const key=k.kind==='change'?k.d.next:k.entry;swap(key,null,el.value);return true;}
    return true;
  }
  // ---- moving, copy / paste, delete, ◆ at the playhead, interpolation: every one is one write() = one undo step.
  // A drag moves every selected key by the same seconds (the timeline's Snap and Magnet apply; Alt: free).
  const snapT=(t,ev,width)=>snap?snap(t,{pixels:width,bypass:ev.altKey}):ev.altKey?t:Math.round(t*20)/20;
  const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
  function dragMove(ev){
    const p=press;if(!p.moved&&Math.abs(ev.clientX-p.x)<3)return;
    if(!p.moved){
      if(!editing()){status('Stop the playback to move keys.',true);press=null;return;}
      p.moved=true;if(!picked.has(p.id))picked=p.shift?pick(picked,[p.id],{add:true}):new Set([p.id]);
      p.keys=pickedKeys();p.anchor=sheetMap.get(p.id);p.els=[...document.querySelectorAll('.ps-row [data-sk]')].filter(e=>picked.has(e.dataset.sk));
      for(const e of document.querySelectorAll('.ps-row [data-sk]'))e.classList.toggle('selected',picked.has(e.dataset.sk));
    }
    const T=seconds()||1,t=Math.max(0,Math.min(T,snapT(p.anchor.t+(ev.clientX-p.x)/p.width*T,ev,p.width)));p.dt=Math.round((t-p.anchor.t)*1000)/1000;
    for(const e of p.els){const k=sheetMap.get(e.dataset.sk);if(k)e.style.left=`clamp(6px,${pct(k.t+p.dt)},calc(100% - 6px))`;}
    const r=shiftKeys(cur(),p.keys,p.dt,seconds(),{walkSeconds});p.error=r.error||null;for(const e of p.els)e.classList.toggle('invalid',!!r.error);
    status(r.error||`${p.keys.length>1?plural(p.keys.length,'key'):keyTitle(p.anchor)} ${p.dt>=0?'+':''}${p.dt.toFixed(2)} s${ev.altKey?' (free)':''}`,!!r.error);
  }
  function dragEnd(p){
    if(!p.dt){rerender();return;}
    if(p.error){rerender();status(p.error,true);return;}
    moveKeys(p.keys,p.dt);
  }
  function moveKeys(keys,dt){
    if(!keys.length||!dt){rerender();return;}
    const r=shiftKeys(cur(),keys,dt,seconds(),{walkSeconds});if(r.error){rerender();status(r.error,true);return;}
    picked=new Set([...picked].map(id=>r.ids.get(id)||id));
    peopleChanged(r.people,`${keys.length>1?plural(keys.length,'key'):keyTitle(keys[0]).replace(/ at [\d.]+ s.*/,'')} moved ${dt>0?'+':''}${fx(dt)} s.`);
  }
  function deletePicked(){
    const keys=pickedKeys();if(!keys.length)return;const r=deleteKeys(cur(),keys);
    if(!r.removed){status(`Not deleted: ${r.skipped.length===1?keyTitle(r.skipped[0]).replace(/ at [\d.]+ s.*/,'')+' is':'these are'} the programmed motion's own timing: drag ${r.skipped.length===1?'it':'them'} instead (only pose keys and waypoints are deleted).`,true);return;}
    picked=new Set(r.skipped.map(k=>k.id));peopleChanged(r.people,`${plural(r.removed,'key')} deleted${r.skipped.length?` (${r.skipped.length} kept: the motion's own timing, drag them instead)`:''}. Undo brings ${r.removed===1?'it':'them'} back.`);
  }
  let clip=null;
  function copyPicked(){
    const keys=pickedKeys(),c=copyKeys(cur(),keys);
    if(!c.items.length){status('Only pose keys are copied: a set-off, waypoint, edge or action is a moment of the motion itself (drag it instead).',true);return;}
    clip=c;status(`Copied ${plural(c.items.length,'pose key')}${c.skipped?` (${c.skipped} time key${c.skipped===1?'':'s'} left out)`:''}. Ctrl+V pastes at the playhead.`);
  }
  function pastePicked(){
    if(!clip){status('Copy a pose key first (Ctrl+C).',true);return;}
    const from=[...new Set(clip.items.map(i=>i.entry))],to=from.length===1&&sel&&sel!==from[0]&&entry(sel)?sel:null,t=time();
    const r=pasteKeys(cur(),clip,t,seconds(),{to,posture:to?activeModel(to):null});if(!r.ids.length){status('Nothing pasted: the keys would fall outside the chapter.',true);return;}
    picked=new Set(r.ids);peopleChanged(r.people,`${plural(r.ids.length,'pose key')} pasted at ${fx(t)} s${to?' on '+personName(entry(to)):''}.`);
  }
  function setInterp(keys,ease){
    if(!ease)return;const r=setEase(cur(),keys,ease);if(!r.n){status(NO_EASE,true);rerender();return;}
    peopleChanged(r.people,`${plural(r.n,'pose key')}: ${ease==='hold'?'hold (steps to the next key)':ease==='linear'?'linear':'smooth (ease)'}.`);
  }
  function toggleAtPlayhead(n){
    if(!editing()){status('Stop the playback to add or remove keys.',true);return;}
    const r=toggleKeyAt(cur(),n.row,n.prop,time(),seconds(),{bone:n.bone,entry:n.posture?n.keys[0]?.entry:null,posture:n.posture||activeModel(entryAt(cur(),n.row.entries,time())),walkSeconds});if(r.error){status(r.error,true);return;}
    picked=r.did==='added'?new Set([r.id]):new Set();peopleChanged(r.people,`${n.row.label}: ${n.prop==='joint'?jointName(n.bone).toLowerCase()+' key':n.prop==='path'?'waypoint':'pose key'} ${r.did} at ${fx(time())} s.`);
  }
  function keyCommand(ev){
    const k=ev.key.toLowerCase(),mod=ev.ctrlKey||ev.metaKey;
    if(!mod&&(ev.key==='Delete'||ev.key==='Backspace')&&picked.size){ev.preventDefault();ev.stopImmediatePropagation();deletePicked();return true;}
    if(mod&&!ev.shiftKey&&!ev.altKey&&k==='c'&&picked.size){ev.preventDefault();ev.stopImmediatePropagation();copyPicked();return true;}
    if(mod&&!ev.shiftKey&&!ev.altKey&&k==='v'&&clip){ev.preventDefault();ev.stopImmediatePropagation();pastePicked();return true;}
    return false;
  }
  // Right-click a key: its interpolation (After Effects' Keyframe Interpolation); time keys show why there is none.
  const menu=document.createElement('div');menu.className='ps-menu';menu.hidden=true;menu.setAttribute('role','menu');document.body.append(menu);
  const closeMenu=()=>{menu.hidden=true;};
  document.addEventListener('contextmenu',ev=>{
    const el=ev.target.closest?.('[data-sk]');if(!el)return;ev.preventDefault();ev.stopPropagation();
    const id=el.dataset.sk;if(!picked.has(id))setPicked(new Set([id]),{focus:id});
    const keys=pickedKeys(),eased=keys.filter(k=>k.ease),now=eased.length&&eased.every(k=>k.ease===eased[0].ease)?eased[0].ease:null;
    menu.innerHTML=`<strong>Interpolation · ${plural(keys.length,'key')}</strong>${[['linear','◆ Linear'],['smooth','● Smooth (ease)'],['hold','■ Hold']].map(([v,l])=>`<button type="button" role="menuitemradio" data-ps-ease="${v}" aria-checked="${v===now}" ${eased.length?'':'disabled'}>${l}</button>`).join('')}${eased.length?'':`<small>${escape(NO_EASE)}</small>`}`;
    menu.hidden=false;menu.style.left=Math.min(ev.clientX,innerWidth-230)+'px';menu.style.top=Math.max(8,Math.min(ev.clientY,innerHeight-menu.offsetHeight-8))+'px';
  },true);
  document.addEventListener('pointerdown',ev=>{if(!menu.hidden&&!menu.contains(ev.target))closeMenu();},true);
  addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!menu.hidden){ev.stopImmediatePropagation();closeMenu();}},true);
  menu.addEventListener('click',ev=>{const b=ev.target.closest('[data-ps-ease]');if(!b||b.disabled)return;closeMenu();setInterp(pickedKeys(),b.dataset.psEase);});
  // The timeline's People lane: one bar per person over the seconds they are in the room. People who are there at the
  // same time get rows of their own (lane-rows.mjs); the lane grows past two rows so every bar keeps its name.
  let laneRows=1;
  const ROW=16;
  function lane(){
    const T=seconds()||1,list=cast().filter(e=>!e.hide);laneKeys=list.map(e=>e.key);laneRows=1;if(!list.length)return '';
    const items=list.flatMap((e,i)=>(spans(e.key)||[[0,T]]).map(([a,b],k)=>({id:i+':'+k,i,k,e,start:Math.max(0,a),end:Math.max(Math.max(0,a)+.01,Math.min(b,T))})));
    const layers=stackRows(items);laneRows=layers.count;const step=laneRows<=2?36/laneRows:ROW,h=Math.floor(step)-2;
    return items.map(it=>{const e=it.e,x=it.start/T*100,w=Math.max(.6,(it.end-it.start)/T*100);
      return `<button type="button" class="people-bar ${e.key===sel?'selected':''} ${spans(e.key)?'':'whole'}" data-action="pe-lane" data-index="${it.i}" data-span="${it.k}" data-person-key="${escape(e.key)}" style="left:${x}%;width:${w}%;top:${1+layers.row.get(it.id)*step}px;height:${h}px" title="${escape(personName(e))}: ${escape(doing(e))} · ${escape(spanText(spans(e.key),T))}">${escape(personName(e))}</button>`;}).join('');
  }
  // A bar's ends drag to set when the person comes in and goes out; its middle drags the whole stay along the chapter
  // (snapped to a tenth of a second). A bar pulled back to the whole chapter loses its span again.
  let barDrag=null,barSuppress=0;
  document.addEventListener('pointerdown',ev=>{
    const bar=ev.target.closest?.('.people-bar');if(!bar||ev.button!==0||!editing())return;
    const key=laneKeys[Number(bar.dataset.index)],T=seconds(),r=bar.getBoundingClientRect(),lane=bar.parentElement.getBoundingClientRect();if(!key||!T||!lane.width)return;
    const k=Number(bar.dataset.span)||0,all=spans(key),s=all?.[k]||[0,T],grip=Math.min(8,r.width/3),edge=ev.clientX-r.left<grip?'in':r.right-ev.clientX<grip?'out':'move';
    barDrag={key,bar,edge,x:ev.clientX,width:lane.width,T,from:[Math.max(0,s[0]),Math.min(s[1],T)],now:null,whole:!all,k,many:(all?.length||0)>1};
  },true);
  document.addEventListener('pointermove',ev=>{
    const d=barDrag;if(!d||(!d.now&&Math.abs(ev.clientX-d.x)<3))return;
    const dt=(ev.clientX-d.x)/d.width*d.T,snap=v=>Math.round(v*10)/10;let [a,b]=d.from;
    if(d.edge==='in')a=Math.max(0,Math.min(b-.2,snap(a+dt)));
    else if(d.edge==='out')b=Math.min(d.T,Math.max(a+.2,snap(b+dt)));
    else if(!d.whole){const len=b-a;a=Math.max(0,Math.min(d.T-len,snap(a+dt)));b=a+len;}
    d.now=[a,b];d.bar.style.left=a/d.T*100+'%';d.bar.style.width=Math.max(.6,(b-a)/d.T*100)+'%';
    status(`${personName(entry(d.key))}: in the room from ${r1(a)} to ${r1(b)} s.`);
  },true);
  const endBar=()=>{
    const d=barDrag;barDrag=null;if(!d?.now)return;barSuppress=performance.now()+350;
    const [a,b]=d.now,name=personName(entry(d.key));
    if(!d.many&&a<=.001&&b>=d.T-.001){if(d.whole)rerender();else write(p=>{if(p.when)delete p.when[d.key];},`${name} is in the room for the whole chapter.`);return;}
    setSpan(d.key,s=>{s[0]=a;s[1]=b;},d.k);status(`${name}: in the room from ${r1(a)} to ${r1(b)} s. Drag the bar's ends to change it.`);
  };
  document.addEventListener('pointerup',endBar,true);document.addEventListener('pointercancel',()=>{if(barDrag?.now)rerender();barDrag=null;},true);
  // Inline heights for the lane and its row (empty string while two rows fit the standard lane).
  const laneHeight=()=>{lane();return laneRows>2?laneRows*ROW+4:0;};
  const header=()=>{const e=sel&&entry(sel);return e?{name:personName(e),detail:pose.active()===sel?'Pose mode'+(pose.joint()?' · '+pose.jointLabel():''):doing(e)}:null;};
  // After the film setup is (re)applied or the cut changes: the selection may be gone.
  function applied(){if(sel&&!entry(sel)){pose.exit();sel=null;}ensure().catch(()=>null);}
  return {copyAttrs,pasteAttrs,panel,lane,laneHeight,action,changed,select,deselect,selected:()=>sel,object:()=>sel?objectOf(sel):null,header,pickObject,setMode,mode:()=>mode,count,remove:k=>{if(k===undefined&&pose.active()){if(pose.selectedKey()!==null){pose.deleteKey();return;}pose.resetJoint();return;}if(k===undefined&&paths.removeSelected())return;/* S31 M3 hook */remove(k);},posing:()=>pose.active(),trackRows,poseKeyLane:()=>pose.keyLane(),poseKeySelected:()=>pose.selectedKey()!==null,poseSync:()=>pose.sync(),keyNow:w=>pose.keyNow(w),applied,openLibrary,effective:()=>effectivePeople(film(),shot())};
}
