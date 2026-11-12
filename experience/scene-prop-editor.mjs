import {cleanPropEdit,cleanAddEdit,isAddEdit,newAddId,propKey,propTarget,effectivePropEdits,escapeRegex,propName,describePropEdit,studioSceneIds,writeSceneAssets} from './prop-edits.mjs';
import {stackRows} from './lane-rows.mjs';
import {createPropLibrary,deskItem} from './prop-library.mjs';
import {groupPanelHtml,groupCentreDelta,pickMode} from './prop-selection.mjs';
import {dropToSurface} from './drop-to-surface.mjs';
// Director "Props": click a prop in the view (not in light mode) to select it, then move / rotate / scale it with
// the gizmo (W / E / T, Shift snaps) or the Prop inspector, hide it (Delete), reset it. Edits go to the chapter's
// cut shot (shot.propEdits, film sceneEdits format, prop-edits.mjs); film-fx applies them after the film's own
// sceneEdits on the live stage, in Render still and in the film. Studio is never written, except by
// "Make permanent in Studio…", which Vico confirms prop by prop.
// "+ Add prop" (Props tab, timeline "+ Prop"): the library browser (prop-library.mjs); the pick goes on the desktop
// under the screen centre (desk-sized items) or on the floor in front of the camera, selected with the gizmo. Its
// edit is an add entry (prop-edits.mjs cleanAddEdit: its own transform in the desk's or the room's frame); Delete or
// Reset to the film removes it.
// Multi-select (prop-selection.mjs): Shift+click adds, Ctrl/Cmd+click toggles, click empty clears; everything selected
// (room props and desk items alike, all are prop edits) moves, turns, hides and resets together, one undo step each.
// A gizmo drag moves the live object at once (restored by __directorPropsRestore before film-fx re-installs).
// The timeline's Props lane: one bar per desk item, added prop and edited prop over the seconds it is on screen. Drag a
// bar's ends (or the Prop inspector's "On screen" fields) to set when it appears and leaves, with a fade in and out
// (prop-edits.mjs show). In a chapter the film renders as sub-shots (the finale) every desk has its own bars under its
// stretch of the Desk versions lane, and an edit belongs to the desk it was made on (prop-edits.mjs desk).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r3=v=>Math.round(v*1000)/1000,r1=v=>Math.round(v*10)/10;
const wrapDeg=d=>{d=((d+180)%360+360)%360-180;return Math.abs(d)<1e-6?0:d;};
const MODES={translate:'Move',rotate:'Rotate',scale:'Scale'},VERB={translate:'Moved',rotate:'Rotated',scale:'Scaled'};
const STATE_KEY='ergoflex.sceneAssets.v1';
export function createScenePropEditor({bridge,shot,film,commit,status,open,rerender,onSelect=()=>{},lightsShowing=()=>false,fold=()=>{},person=()=>false,blocked=()=>false,
  scope=()=>null,versions=()=>[],seconds=()=>0,time=()=>0,seek=()=>{}}){
  let sel=null,others=[],lockedKeys=()=>new Set(),itemsCache=null,itemsAt=0,flash=null,pivotAt=0,pivotDirty=true,mode='translate',tools=null,booting=null,drag=null,snapping=false,pending=null,dialogPlan=null,placing=false;
  const snaps=new Map(),frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow;
  const three=()=>bridge.stage()?.three?.();
  const editing=()=>open()&&bridge.ready()&&!bridge.playback().playing&&!bridge.bakeState().baking;
  const sceneOf=()=>three()?.scene||null;
  // Every user-facing text says the friendly name ('Steelcase leap v2'); the raw object name ('Prop:steelcase-leap-v2')
  // only shows in tooltips and the inspector's small grey line.
  const label=o=>o?.userData?.directorAdd?.label||propName(o?.name),nice=n=>propName(n||'');
  // ---- the cut
  const edits=()=>effectivePropEdits(film(),shot());
  const editOfKey=key=>edits().find(e=>propKey(e)===key)||null;
  const editedCount=()=>edits().length;
  // ---- a desk of its own and time on screen (prop-edits.mjs desk / show)
  // scope(): the desk on stage in a chapter rendered as sub-shots {n, preset, label, start, from, to}, null elsewhere.
  // versions(): that chapter's desks in time order ([] elsewhere). A new edit there belongs to the desk on stage.
  const deskNow=()=>scope()||null;
  const withDesk=t=>{const d=deskNow();return d?.preset&&!t.desk?{...t,desk:d.preset}:t;};
  const END=100000,r2=v=>Math.round(v*100)/100;   // show.to END: until the desk (or the chapter) ends
  // Where an edit's seconds count from and when it can be on screen, in chapter seconds: {t0, lo, hi, desk, n, label}.
  // A desk's edit counts from its sub-shot's start (t0) and can show while that desk is the one on screen (lo…hi).
  function spanOf(desk,n=null){
    const T=seconds()||0;if(!desk)return {t0:0,lo:0,hi:T};
    const list=versions().filter(v=>v.preset===desk),t=time(),v=list.find(x=>x.n===n)||list.find(x=>x.n===deskNow()?.n)||list.find(x=>t>=x.from&&t<x.to)||list[0];
    return v?{t0:v.start,lo:v.from,hi:Math.min(T,v.to),desk,n:v.n,label:v.label}:{t0:0,lo:0,hi:T,desk,missing:true};
  }
  // An edit's time on screen within its span, in chapter seconds.
  function onScreen(e,span){
    const w=e?.show,clamp=x=>Math.max(span.lo,Math.min(span.hi,x));
    return {from:w?clamp(span.t0+w.from):span.lo,to:w?clamp(span.t0+w.to):span.hi,fadeIn:w?.fadeIn||0,fadeOut:w?.fadeOut||0,timed:!!w};
  }
  // The show for chapter seconds from…to in a span: an end on the span's edge stays open; the whole time is no show.
  function showFor(span,{from,to,fadeIn=0,fadeOut=0}){
    const atLo=from<=span.lo+.05,atHi=to>=span.hi-.05;
    if(atLo&&atHi&&!fadeIn&&!fadeOut)return undefined;
    return {from:atLo&&!fadeIn?0:r2(Math.max(0,from-span.t0)),to:atHi&&!fadeOut?END:r2(to-span.t0),...(fadeIn?{fadeIn:r2(fadeIn)}:{}),...(fadeOut?{fadeOut:r2(fadeOut)}:{})};
  }
  const timeText=(s,span)=>s.from<=span.lo+.05&&s.to>=span.hi-.05?(span.desk?'the whole time its desk is on screen':'the whole chapter'):`${r1(s.from)}–${r1(s.to)} s`;
  // Writes a prop's time on screen (m: {key, target}); next in chapter seconds.
  function writeShow(m,next,span,name){
    const e=editOfKey(m.key),show=showFor(span,next),edit={...m.target,...(e||{}),show};if(show===undefined)delete edit.show;
    const fades=[next.fadeIn?`fades in ${r1(next.fadeIn)} s`:'',next.fadeOut?`fades out ${r1(next.fadeOut)} s`:''].filter(Boolean).join(', ');
    write(m.key,edit,`${name}: on screen ${timeText(next,span)}${fades?', '+fades:''}.`);
  }
  // Every prop write: seeds shot.propEdits from the film's earlier-exported entries first (like camera keys).
  function write(key,next,text,{undoKey=null}={}){
    if(next&&!cleanPropEdit(next)&&!isNoopEdit(next)){status(`${CANT_SAVE}: ${UNUSUAL}`,true);rerender();return;}
    commit(()=>{const s=shot(),list=edits().filter(e=>propKey(e)!==key),clean=next&&cleanPropEdit(next);s.propEdits=clean?[...list,clean]:list;},{key:undoKey,render:false});
    status(text);rerender();
  }
  // One undo step for several props at once: changes [{key, next | null}].
  function writeMany(changes,text,also=null){
    for(const c of changes)if(c.next&&!cleanPropEdit(c.next)&&!isNoopEdit(c.next)){status(`${CANT_SAVE}: ${UNUSUAL}`,true);rerender();return;}
    commit(()=>{const keys=new Set(changes.map(c=>c.key)),list=edits().filter(e=>!keys.has(propKey(e)));for(const c of changes){const clean=c.next&&cleanPropEdit(c.next);if(clean)list.push(clean);}shot().propEdits=list;also?.();},{key:null,render:false});
    pivotDirty=true;status(text);rerender();
  }
  // ---- what can't be kept
  // The status text whenever a selected item can't become a Director edit (said when it's selected and when it's moved).
  const CANT_SAVE='This item can\'t be saved in the film yet',UNUSUAL='its name is too long or unusual for a film edit.';
  const isNoopEdit=e=>!e.position&&!e.rotation&&!e.scale&&e.hide===undefined;
  // Why the film couldn't keep an edit to o with target t ('' = it can): the cleaned edit must find exactly o again.
  function unrecordable(o,t){
    const probe=cleanPropEdit({...t,position:[.1,0,0]});if(!probe)return UNUSUAL;
    let f;try{f=win().__filmEdits.editTargets(probe);}catch{return 'the film can\'t look it up.';}
    return f.length===1&&f[0]===o?'':f.some(x=>x===o)?'the film can\'t tell it apart from other items with the same name.':'the film can\'t find it again by its name.';
  }
  // Studio's own room editing also lives in the stage (studio.js RoomInteractions and the scene desks' object editor:
  // click-drag moves a furnishing or a desk item, Delete removes it, a double click opens Studio's item gizmo). Its
  // window capture listener runs before the Director's and stops the click, so in a room with Studio furnishings (the
  // Humboldt library) the Director never saw the click and Studio's drag moved the prop where nothing records it (the
  // stage's storage is throwaway). In Director Mode the Director owns the pointer: Studio's item editing is off here.
  // Anything Studio still moves says so in the status line.
  const MUTED=Symbol('director');
  function muteStudioEditing(){
    const api=win()?.ErgoFlex;if(!api)return;
    const ri=api.roomInteractions;
    if(ri&&!ri[MUTED]){ri[MUTED]=true;try{ri.end?.();ri.select?.(null);}catch{}ri.enabled=()=>false;
      const end=ri.onEditEnd;ri.onEditEnd=edit=>{studioMoved();return end?.(edit);};}
    const ctx=api.sceneDesks?.ctx,objects=api.sceneDesks?.objects;
    if(ctx&&!ctx[MUTED]){ctx[MUTED]=true;try{objects?.endDrag?.();}catch{}ctx.objectsEditable=()=>false;ctx.rearrange=()=>false;}
    if(api.itemGizmo?.active)try{api.itemGizmo.close();}catch{}
  }
  function studioMoved(){status(`${CANT_SAVE}: Studio's room editing moved it, not the Director. Undo in Studio or reload the chapter, then click it and use the Director's gizmo.`,true);}
  // ---- stage objects
  const filmEdit=o=>(o?.userData.__filmFxEdits||[]).filter(e=>e.director).at(-1)||null;
  const handMoves=o=>(o?.userData.__filmFxEdits||[]).filter(e=>!e.director&&(e.position||e.rotation||e.scale!==undefined));
  const pathOf=o=>{const scene=sceneOf(),out=[];for(let p=o;p&&p!==scene;p=p.parent)out.unshift(p.name||p.type);return out.join(' > ');};
  const inScene=o=>{const scene=sceneOf();for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
  const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const isOurs=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls||/^Cinematic effects$|^Film lights$/.test(p.name))return true;return false;};
  // The prop a click means: one item of the desk's daily kit (the open notebook…), the innermost Studio scene asset or
  // desk accessory, else the library prop (Prop:…). On the desk model itself only such props count, never its parts.
  function meaningful(o,{above=null}={}){
    const scene=sceneOf(),desk=win()?.ErgoFlex?.loadedModel;let fallback=null,skipping=!!above;
    for(let p=o;p&&p!==scene;p=p.parent){
      if(p.userData?.directorAdd&&!skipping)return p;
      if(p===desk)return skipping?null:fallback;
      if(skipping){if(p===above)skipping=false;continue;}
      if(p.parent?.userData?.dayKit)return p;
      if(p.userData?.sceneAsset||p.userData?.dayKit||/^Accessory:/.test(p.name))return p;
      if(!fallback&&(/^Prop:/.test(p.name)||p.userData?.propId))fallback=p;
    }
    return skipping?null:fallback;
  }
  // Props riding on the desk (on the desk model, its daily kit, its mounts and dressing): their edits are kept along
  // the parent's own axes (space:'local'), so they follow lift and tilt whatever pose the edit is installed at.
  function ridesDesk(o){const desk=win()?.ErgoFlex?.loadedModel;for(let p=o?.parent;p;p=p.parent)if(p===desk||p.userData?.dayKit||/^(Scene dressing|Accessory mount|Desk dressing):/.test(p.name))return true;return false;}
  const ON_DESK='It sits on the desk and travels with it, so Studio\'s room layout can\'t hold it. Keep it as a chapter edit.';
  const onDeskItself=o=>{const desk=win()?.ErgoFlex?.loadedModel;for(let p=o;p;p=p.parent)if(p===desk||p.userData?.dayKit)return true;return false;};
  // The film target for a prop: its name, plus its Studio key, path or position when others share the name.
  function targetFor(o){
    const E=win().__filmEdits,t={match:'^'+escapeRegex(o.name||'')+'$',label:o.name||'Unnamed prop'},only=x=>{const f=E.editTargets(x);return f.length===1&&f[0]===o;};
    if(o.userData.sceneAssetKey){t.asset=o.userData.sceneAssetKey;if(only(t))return t;delete t.asset;}
    if(only(t))return t;
    t.path='^'+escapeRegex(pathOf(o))+'$';if(only(t))return t;delete t.path;
    const w=o.getWorldPosition(o.position.clone()),twins=E.editTargets(t).filter(x=>x!==o).map(x=>{const p=x.getWorldPosition(x.position.clone());return Math.hypot(p.x-w.x,p.z-w.z);});
    t.near=[r3(w.x),r3(w.z),r3(Math.max(.01,Math.min(.3,(Math.min(...twins,1)||.02)*.45)))];
    if(only(t))return t;
    throw Error(`${label(o)} can't be told apart from an identical prop at the same spot, so it can't be edited on its own.`);
  }
  // The target of the prop under a click or in a list: its own installed Director edit's, else its name's, kept to
  // the desk on stage in a sub-shot chapter.
  function targetOf(o){const mine=filmEdit(o)&&cleanPropEdit(filmEdit(o));return mine||withDesk(targetFor(o));}
  // The prop as film-fx placed it (before any live drag) and where it is without the Director's edit.
  function installed(o){const s=snaps.get(o);return s?{position:s.position.clone(),rotation:o.rotation.clone().setFromQuaternion(s.quaternion,o.rotation.order),scale:s.scale.clone()}:{position:o.position.clone(),rotation:o.rotation.clone(),scale:o.scale.clone()};}
  const parentScale=o=>{const {THREE}=tools;if(!o.parent)return new THREE.Vector3(1,1,1);o.parent.updateWorldMatrix(true,false);return o.parent.getWorldScale(new THREE.Vector3());};
  function base(o){
    const {THREE}=tools,E=filmEdit(o),st=installed(o);o.parent?.updateMatrixWorld(true);
    const local=st.position.clone();if(E?.position&&E.space==='local')local.sub(new THREE.Vector3(...E.position).divide(parentScale(o)));
    const world=local.clone();if(o.parent)o.parent.localToWorld(world);
    if(E?.position&&E.space!=='local')world.sub(new THREE.Vector3(...E.position));
    const rot=st.rotation.clone();if(E?.rotation){rot.x-=THREE.MathUtils.degToRad(E.rotation[0]||0);rot.y-=THREE.MathUtils.degToRad(E.rotation[1]||0);rot.z-=THREE.MathUtils.degToRad(E.rotation[2]||0);}
    const scale=st.scale.clone();if(Array.isArray(E?.scale))scale.divide(new THREE.Vector3(...E.scale));else if(Number.isFinite(E?.scale))scale.divideScalar(E.scale);
    const out={world,rot,scale};if(ridesDesk(o)){out.local=o.parent?o.parent.worldToLocal(world.clone()):world.clone();}return out;
  }
  // An edit from the prop's state now (after a drag or typed numbers) relative to base().
  // Turns: of the two Euler triples for the same rotation, the one nearest the film's (a turn about y stays a turn
  // about y, not ±180° on x and z). Scale: kept between ×0.01 and ×100, never mirrored.
  function editFrom(o,b,{world,rot,scale}={}){
    const {THREE}=tools,w=world||o.getWorldPosition(new THREE.Vector3()),r=rot||o.rotation,s=scale||o.scale,deg=THREE.MathUtils.radToDeg;
    const [a0,a1,a2]=(r.order||'XYZ').toLowerCase().split(''),alt={[a0]:r[a0]+Math.PI,[a1]:Math.PI-r[a1],[a2]:r[a2]+Math.PI};
    const turn=e=>['x','y','z'].map(k=>wrapDeg(deg(e[k]-b.rot[k]))),plain=turn(r),other=turn(alt),size=t=>t.reduce((n,v)=>n+Math.abs(v),0);
    const clamp=v=>Math.round(Math.min(100,Math.max(.01,Math.abs(v)))*1e4)/1e4;
    const position=b.local?(o.parent?o.parent.worldToLocal(w.clone()):w.clone()).sub(b.local).multiply(parentScale(o)):w.clone().sub(b.world);
    return {space:b.local?'local':undefined,position:position.toArray().map(r3),rotation:(size(other)<size(plain)-1e-6?other:plain).map(r1),scale:[s.x/b.scale.x,s.y/b.scale.y,s.z/b.scale.z].map(clamp)};
  }
  // ---- added props: their own transform in the parent's frame (prop-edits.mjs cleanAddEdit)
  const parentK=o=>{const {THREE}=tools;if(!o.parent)return 1;o.parent.updateWorldMatrix(true,false);return o.parent.getWorldScale(new THREE.Vector3()).x||1;};
  const libScale=o=>1000*win().__filmEdits.mmScale()/parentK(o);
  function addFrom(o,e,{position,rotation,scale}={}){
    const k=parentK(o),b=libScale(o),deg=tools.THREE.MathUtils.radToDeg;
    return cleanAddEdit({...e,position:position||o.position.toArray().map(v=>r3(v*k)),rotation:rotation||[o.rotation.x,o.rotation.y,o.rotation.z].map(v=>r1(wrapDeg(deg(v)))),
      scale:scale||[o.scale.x/b,o.scale.y/b,o.scale.z/b].map(v=>Math.round(Math.min(100,Math.max(.01,Math.abs(v)))*1e4)/1e4)});
  }
  function changedAdd(o,e,name,v){
    let next=null,verb='Moved';
    if(/^pp-p[xyz]$/.test(name)){if(Math.abs(v)>1000)throw Error('Positions run from -1000 to 1000 m.');const {THREE}=tools,w=o.getWorldPosition(new THREE.Vector3());w.setComponent('xyz'.indexOf(name[4]),v);
      const local=o.parent?o.parent.worldToLocal(w):w,k=parentK(o);next={position:local.toArray().map(x=>r3(x*k))};}
    else if(/^pp-r[xyz]$/.test(name)){const r=e.rotation.slice();r['xyz'.indexOf(name[4])]=r1(wrapDeg(v));next={rotation:r};verb='Rotated';}
    else if(name==='pp-s'){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');next={scale:[v,v,v]};verb='Scaled';}
    else if(/^pp-s[xyz]$/.test(name)){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');const f=e.scale.slice();f['xyz'.indexOf(name[4])]=v;next={scale:f};verb='Scaled';}
    else return;
    write(sel.key,cleanAddEdit({...e,...next}),`${verb} ${label(o)}.`);
  }
  // Where a new prop goes: desk-sized items on the featured desk's desktop where the screen centre's ray meets it
  // (kept on the top), else on the floor where that ray meets it (or 1.5 m ahead), turned to face the camera.
  function placement(entry){
    const {THREE,t}=tools,E=win().__filmEdits,cam=t.camera,kind=deskItem(entry)&&E.addParent('desk')?'desk':'room',parent=E.addParent(kind);
    parent.updateWorldMatrix(true,false);cam.updateMatrixWorld();
    const k=parent.getWorldScale(new THREE.Vector3()).x||1,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),cam);
    const origin=new THREE.Vector3().setFromMatrixPosition(parent.matrixWorld),up=new THREE.Vector3(0,1,0).transformDirection(parent.matrixWorld);
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(kind==='desk'?up:new THREE.Vector3(0,1,0),origin);
    let hit=ray.ray.intersectPlane(plane,new THREE.Vector3());
    const camPos=cam.getWorldPosition(new THREE.Vector3());
    const mm=E.mmScale();   // scene units per millimetre
    if(kind==='room'&&(!hit||hit.distanceTo(camPos)>4000*mm)){const f=cam.getWorldDirection(new THREE.Vector3());f.y=0;if(f.lengthSq()<1e-6)f.set(0,0,-1);hit=camPos.clone().addScaledVector(f.normalize(),1500*mm);hit.y=origin.y;}
    const local=hit?parent.worldToLocal(hit.clone()):new THREE.Vector3();local.y=0;
    if(kind==='desk'){
      // Keep it on the top: the desktop's measured size (mm, width across local x, depth across local z), less the item.
      const size=parent.userData.surfaceSize,half=Math.max(...entry.size)/2+20;
      if(size?.width&&size?.depth){local.x=THREE.MathUtils.clamp(local.x,-Math.max(0,size.width/2-half),Math.max(0,size.width/2-half));local.z=THREE.MathUtils.clamp(local.z,-Math.max(0,size.depth/2-half),Math.max(0,size.depth/2-half));}
      else if(!hit||local.length()>400)local.set(0,0,0);
    }
    const toCam=parent.worldToLocal(camPos.clone()).sub(local),yaw=Math.atan2(toCam.x,toCam.z)*180/Math.PI;
    return {kind,position:local.toArray().map(v=>r3(v*k)),rotation:[0,r1(wrapDeg(yaw)),0]};
  }
  // Click-to-place: the surface under the cursor. On the featured desk's top it rides the desk; anywhere else it stands
  // in the room at that point (a table, a shelf, the floor), keeping the way it faces.
  function placeAt(o,e,point){
    const {THREE}=tools,E=win().__filmEdits,top=E.addParent('desk');let kind='room';
    if(top){top.updateWorldMatrix(true,false);const l=top.worldToLocal(point.clone()),size=top.userData.surfaceSize;if(Math.abs(l.y)<40&&(!size||Math.abs(l.x)<=size.width/2+20&&Math.abs(l.z)<=size.depth/2+20))kind='desk';}
    const parent=E.addParent(kind);parent.updateWorldMatrix(true,false);const k=parent.getWorldScale(new THREE.Vector3()).x||1,local=parent.worldToLocal(point.clone());if(kind==='desk')local.y=0;
    let rotation=e.rotation;
    if(kind!==e.parent){const q=parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion())),r=new THREE.Euler().setFromQuaternion(q);rotation=[r.x,r.y,r.z].map(v=>r1(wrapDeg(v*180/Math.PI)));}
    write(sel.key,cleanAddEdit({...e,parent:kind,position:local.toArray().map(v=>r3(v*k)),rotation}),`Placed ${label(o)} ${kind==='desk'?'on the desk (it rides the lift and tilt)':'there, in the room'}.`);
  }
  async function addProp(entry){
    await ensure();if(!editing()){status('Pause the chapter first: props are added on the paused frame.',true);return;}
    // It comes in at the playhead (from the start when the playhead is within half a second of it) and stays to the
    // end of the chapter, or of the desk on stage in a sub-shot chapter: its bar in the Props lane trims it.
    const d=deskNow(),span=spanOf(d?.preset,d?.n),now=Math.max(span.lo,Math.min(span.hi,time())),late=now-span.lo>.5&&span.hi-now>=.3;
    const at=placement(entry),e=cleanAddEdit({add:{asset:entry.id},id:newAddId(),label:entry.name,parent:at.kind,position:at.position,rotation:at.rotation,scale:[1,1,1],
      ...(d?.preset?{desk:d.preset}:{}),...(late?{show:showFor(span,{from:r2(now),to:span.hi})}:{})});
    if(!e)throw Error(`${entry.name} can't be added (its library id is unusual).`);
    const key=propKey(e);write(key,e,`Added ${entry.name} ${at.kind==='desk'?'on the desk (it rides the lift and tilt)':'on the floor in front of the camera'}${d?` of Desk ${d.n} · ${d.label}`:''}${late?`, from ${r1(now)} s (drag its bar in the Props lane to change when it shows)`:''}: W move · E rotate · T scale · Shift snaps · Delete removes it.`);
    sel={key,target:propTarget(e),obj:null};onSelect();rerender();
    return e;
  }
  const library=createPropLibrary({status,room:()=>shot()?.room,roomName:()=>shot()?.room,
    load:async()=>{await ensure();return (await win().__filmEdits.propLibrary()).index.props;},
    onPick:entry=>{addProp(entry).catch(error=>status(error.message,true));}});
  function objOf(m){if(m.obj&&!inScene(m.obj))m.obj=null;if(!m.obj&&tools)m.obj=find(m.key,m.target);return m.obj;}
  const current=()=>sel?objOf(sel):null;
  const members=()=>sel?[...others,sel]:[];
  const isSel=key=>members().some(m=>m.key===key);
  const group=()=>others.length>0;
  // Installed Director entries by prop key (one scene walk, kept until film-fx re-installs or for 1 s).
  let found=null,foundAt=0;
  function installedIndex(){
    const scene=sceneOf();if(!scene)return new Map();if(found&&performance.now()-foundAt<1000)return found;
    found=new Map();foundAt=performance.now();scene.traverse(o=>{for(const e of o.userData.__filmFxEdits||[])if(e.director&&!found.has(propKey(e)))found.set(propKey(e),o);});return found;
  }
  function find(key,target){
    const scene=sceneOf();if(!scene)return null;const hit=installedIndex().get(key);if(hit&&inScene(hit))return hit;
    const e=editOfKey(key)||target||sel?.target;if(!e||!win()?.__filmEdits)return null;
    // Another desk's prop: the item of that name on stage now belongs to the desk that is showing, not to this edit.
    if(e.desk&&e.desk!==deskNow()?.preset)return null;
    const f=win().__filmEdits.editTargets(e);return f.length===1?f[0]:null;
  }
  // ---- stage tools: gizmo, selection box, picking
  async function boot(){
    const w=win(),t=three();if(!t)throw Error('The stage is still loading.');
    if(!w.__directorThree)await new Promise((resolve,reject)=>{w.__dirThreeDone=resolve;w.__dirThreeFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree={THREE:T,TransformControls:C.TransformControls};window.__dirThreeDone();},e=>window.__dirThreeFail(e));";w.document.head.append(s);});
    if(!w.__filmEdits)await new Promise((resolve,reject)=>{w.__dirEditsDone=resolve;w.__dirEditsFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="import('/tools/experience/film-edits.mjs').then(m=>{window.__filmEdits=m;window.__dirEditsDone();},e=>window.__dirEditsFail(e));";w.document.head.append(s);});
    muteStudioEditing();
    const {THREE,TransformControls}=w.__directorThree,group=new THREE.Group();group.name='Director prop tools';group.userData.directorTools=true;t.scene.add(group);
    const box=new THREE.BoxHelper(undefined,0x63d8f5);box.material.depthTest=false;box.material.transparent=true;box.renderOrder=998;box.visible=false;group.add(box);
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;gizmo.setSize(1.35);gizmo.setSpace('world');gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    gizmo.addEventListener('dragging-changed',ev=>{w.__directorDragging=ev.value;if(ev.value){drag={enabled:t.controls.enabled,obj:gizmo.object};t.controls.enabled=false;startDrag();}else{t.controls.enabled=drag?.enabled??true;endDrag();}});
    gizmo.addEventListener('objectChange',()=>{if(drag?.grp){moveGroupLive();status(`${mode==='translate'?'Moving ':'Turning '}${drag.grp.items.length} items together…`+(snapping?' (snapping)':' · Shift snaps'));return;}const o=current();if(o&&sel?.blocked){status(`${CANT_SAVE}: ${sel.blocked} It goes back when you let go.`,true);return;}if(o)status((mode==='translate'?'Moving ':mode==='rotate'?'Rotating ':'Scaling ')+label(o)+'…'+(snapping?' (snapping)':' · Shift snaps'));});
    const raycaster=new THREE.Raycaster(),dom=t.renderer.domElement;let down=null;
    dom.addEventListener('pointerdown',ev=>{down=ev.button===0&&(placing||!gizmo.dragging&&!gizmo.axis)?{x:ev.clientX,y:ev.clientY,alt:ev.altKey}:null;},true);
    dom.addEventListener('pointerup',ev=>{
      const d=down;down=null;if(!d||ev.button!==0||Math.hypot(ev.clientX-d.x,ev.clientY-d.y)>5||gizmo.dragging||w.__directorDragging||lightsShowing()||!editing()||blocked())return;
      const r=dom.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);
      if(placing){const now=current(),e=sel&&editOfKey(sel.key);placing=false;
        if(now&&isAddEdit(e)){const h=raycaster.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object)&&!isAncestor(now,h.object));if(h)placeAt(now,e,h.point);else{status('Nothing there to put it on.',true);rerender();}return;}}
      const hit=raycaster.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object));
      // People are not props: a click on one selects them in the People tab (scene-people-editor.mjs).
      if(hit&&!placing&&person(hit.object)){if(sel)deselect();return;}
      const now=current(),o=hit&&(d.alt&&now&&isAncestor(now,hit.object)?meaningful(hit.object,{above:now}):meaningful(hit.object));
      const how=pickMode(ev);
      if(!o){if(sel&&how==='replace'){deselect();status('Nothing to edit there: click a prop (furniture, lamps, desk items). Esc deselects.');}return;}
      pick(o,{how});
    },true);
    const keys=e=>{const on=e.shiftKey;if(on!==snapping){snapping=on;syncSnap();}};
    for(const doc of [document,w.document]){doc.addEventListener('keydown',keys,true);doc.addEventListener('keyup',keys,true);}
    // End: drop the selected prop onto the surface below it (Shift+End: drop flat, Alt+End: align to the surface).
    const endKey=e=>{if(e.key!=='End'||e.ctrlKey||e.metaKey||!sel||!editing()||lightsShowing()||e.target?.closest?.('input,select,textarea,[contenteditable],#director-timeline')||document.querySelector('dialog[open]'))return;
      e.preventDefault();e.stopPropagation();dropSelected(e.altKey?'align':e.shiftKey?'flat':'drop').catch(error=>status(error.message,true));};
    for(const doc of [document,w.document])doc.addEventListener('keydown',endKey,true);
    w.__directorPropsRestore=()=>{for(const [o,s] of snaps){o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.updateMatrixWorld(true);}snaps.clear();};
    const pivot=new THREE.Object3D();pivot.name='Director group pivot';pivot.userData.directorTools=true;group.add(pivot);
    const boxes=[box],fbox=new THREE.BoxHelper(undefined,0xffd166);fbox.material.depthTest=false;fbox.material.transparent=true;fbox.renderOrder=999;fbox.visible=false;group.add(fbox);
    tools={THREE,group,box,boxes,fbox,pivot,gizmo,t};syncSnap();requestAnimationFrame(tick);return tools;
  }
  const isAncestor=(a,o)=>{for(let p=o;p;p=p.parent)if(p===a)return true;return false;};
  const ensure=()=>booting||=boot().then(t=>{learn();rerender();return t;},error=>{booting=null;throw error;});
  function syncSnap(){if(!tools)return;const g=tools.gizmo;g.setTranslationSnap(snapping?.05:null);g.setRotationSnap(snapping?tools.THREE.MathUtils.degToRad(15):null);g.setScaleSnap(snapping?.1:null);}
  // Highlight boxes (one per selected item), the group pivot (centre of the movable ones) and the gizmo.
  function syncBoxes(objs){
    const {THREE,group:g,boxes}=tools;
    while(boxes.length<objs.length){const b=new THREE.BoxHelper(undefined,0x63d8f5);b.material.depthTest=false;b.material.transparent=true;b.renderOrder=998;g.add(b);boxes.push(b);}
    boxes.forEach((b,i)=>{const o=objs[i];if(o){b.setFromObject(o);b.visible=true;b.material.opacity=shown(o)?1:.45;}else b.visible=false;});
  }
  function recentre(movable){
    const {THREE,pivot}=tools;if(!pivotDirty&&performance.now()-pivotAt<400)return;pivotDirty=false;pivotAt=performance.now();
    const box=new THREE.Box3();for(const o of movable)box.union(new THREE.Box3().setFromObject(o));
    if(box.isEmpty())return;box.getCenter(pivot.position);pivot.quaternion.identity();pivot.scale.set(1,1,1);pivot.updateMatrixWorld(true);
  }
  function tick(){
    requestAnimationFrame(tick);if(!tools)return;muteStudioEditing();const {gizmo,fbox,pivot,t}=tools,live=editing();
    const ms=live?members():[],objs=ms.map(objOf),o=live?current():null;
    syncBoxes(live?objs.map(x=>x||null).filter(Boolean):[]);
    if(live&&flash&&flash.until>performance.now()&&inScene(flash.obj)){fbox.setFromObject(flash.obj);fbox.visible=true;fbox.material.opacity=.45+.55*Math.abs(Math.sin((flash.until-performance.now())/130));bridge.stage()?.wake?.(100);}else{fbox.visible=false;flash=null;}
    if(live&&group()&&mode==='scale')mode='translate';
    const movable=ms.map((m,i)=>m.blocked?null:objs[i]).filter(x=>x&&shown(x));
    if(live&&group()&&movable.length&&!placing){
      if(!gizmo.dragging){recentre(movable);}
      if(gizmo.object!==pivot)gizmo.attach(pivot);gizmo.setMode(mode);gizmo.setSpace('world');gizmo.visible=gizmo.enabled=true;
    }
    else if(o&&shown(o)&&!placing&&!group()){if(gizmo.object!==o)gizmo.attach(o);gizmo.setMode(mode);gizmo.setSpace(mode==='scale'?'local':'world');gizmo.visible=gizmo.enabled=true;}
    else if(!gizmo.dragging){if(gizmo.object)gizmo.detach();gizmo.visible=gizmo.enabled=false;}
    if(gizmo.dragging)bridge.stage()?.wake?.(300);
  }
  // ---- moving several at once: the gizmo drags the pivot; every item gets the pivot's change (world matrix delta)
  function beginGroup(){
    const {pivot}=tools;pivot.updateMatrixWorld(true);
    const items=members().map(m=>({m,o:objOf(m)})).filter(x=>x.o&&!x.m.blocked).map(({m,o})=>{if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});o.updateWorldMatrix(true,false);return {m,o,b:base(o),m0:o.matrixWorld.clone()};});
    return {p0:pivot.matrixWorld.clone(),items};
  }
  function applyDelta(g,D){
    const {THREE}=tools;
    for(const it of g.items){const p=it.o.parent;p?.updateWorldMatrix(true,false);const inv=p?p.matrixWorld.clone().invert():new THREE.Matrix4();inv.multiply(D.clone().multiply(it.m0)).decompose(it.o.position,it.o.quaternion,it.o.scale);it.o.updateMatrixWorld(true);}
    bridge.stage()?.wake?.(300);
  }
  function moveGroupLive(){const g=drag.grp,{pivot}=tools;pivot.updateMatrixWorld(true);applyDelta(g,pivot.matrixWorld.clone().multiply(g.p0.clone().invert()));}
  function endGroup(g,text){
    const changes=[];let skipped=members().length-g.items.length;
    for(const it of g.items){
      try{const e=editOfKey(it.m.key);let next;
        if(isAddEdit(e))next=addFrom(it.o,e);else next={...it.m.target,...(e||{}),...editFrom(it.o,it.b)};
        if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null))continue;changes.push({key:it.m.key,next});}
      catch(error){skipped++;console.warn('[props] group',error.message);}
    }
    if(!changes.length){status('Nothing moved.');rerender();return;}
    writeMany(changes,`${text} ${changes.length} items together${skipped?` (${skipped} could not be saved and stayed put)`:''}. One Undo puts them all back.`);
  }
  // Typed moves (inches / degrees, relative) on the group panel: the same path as a drag.
  function groupChanged(el){
    const name=el.name,v=Number(el.value);
    if(name==='pp-hide'){hide(el.checked);return;}
    if(el.value===''||!Number.isFinite(v))throw Error('Enter a number.');
    const {THREE,pivot}=tools,mm=win().__filmEdits.mmScale(),movable=members().map(objOf).filter(Boolean);pivotDirty=true;recentre(movable);
    let D,text;
    if(/^pp-gm[xyz]$/.test(name)){if(Math.abs(v)>1000)throw Error('Moves run up to 1000 inches.');const d=[0,0,0];d['xyz'.indexOf(name[5])]=v*25.4*mm;D=new THREE.Matrix4().makeTranslation(...d);text='Moved';}
    else if(name==='pp-gry'){D=groupCentreDelta(THREE,pivot.position,THREE.MathUtils.degToRad(wrapDeg(v)));text='Turned';}
    else return;
    const g=beginGroup();applyDelta(g,D);endGroup(g,text);
  }
    function startDrag(){const o=drag?.obj;if(!o)return;if(o===tools.pivot){drag.grp=beginGroup();return;}if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});drag.base=base(o);}
  function endDrag(){
    if(drag?.grp){const g=drag.grp;drag=null;pivotDirty=true;endGroup(g,mode==='translate'?'Moved':'Turned');return;}
    const o=drag?.obj,b=drag?.base;drag=null;if(!o||!b||!sel)return;
    if(sel.blocked){const s=snaps.get(o);if(s){o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.updateMatrixWorld(true);bridge.stage()?.wake?.(300);}status(`${CANT_SAVE}: ${sel.blocked} It is back where the film puts it.`,true);return;}
    try{const e=editOfKey(sel.key)||sel.target;
      if(isAddEdit(e)){write(sel.key,addFrom(o,e),`${VERB[mode]} ${label(o)}.`);return;}
      const next={...sel.target,...(e||{}),...editFrom(o,b)};
      if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null)){status(label(o)+' did not move.');return;}
      write(sel.key,next,`${VERB[mode]} ${label(o)}. Undo puts it back; Render still shows the film look.`);}
    catch(error){status(error.message,true);}
  }
  // ---- selection
  // how: 'replace' (click), 'add' (Shift+click), 'toggle' (Ctrl/Cmd+click).
  function pick(o,{how='replace'}={}){
    let target;try{target=targetOf(o);}catch(error){if(how==='replace'){sel=null;others=[];onSelect();rerender();}status(`${CANT_SAVE}: ${error.message}`,true);return;}
    const t=propTarget({...target,label:target.label||o.name||''});
    const key=propKey(t);
    if(lockedKeys().has(key)){status(`${label(o)} is locked in a layer: unlock the layer in Layers to pick it in the view.`,true);return;}
    const blocked=isAddEdit(filmEdit(o))?'':unrecordable(o,t),entry={key,target:t,obj:o,blocked};
    if(how==='replace')setMembers([entry]);
    else if(how==='toggle'&&isSel(key)){setMembers(members().filter(m=>m.key!==key));status(`${label(o)} removed from the selection (${members().length} selected).`);return;}
    else setMembers([...members().filter(m=>m.key!==key),entry]);
    if(group()){status(`${members().length} selected (${members().map(m=>nice(m.target.label)).slice(0,4).join(', ')}${members().length>4?'…':''}) · they move together · Shift+click adds, Ctrl+click adds or removes, click empty space clears.`);return;}
    if(blocked){status(`${CANT_SAVE}: ${blocked} Moving ${label(o)} here won't be kept.`,true);return;}
    const moves=handMoves(o).length?' The film also places it by hand; your edit adds to that.':'';
    const added=isAddEdit(filmEdit(o));
    status(`${label(o)} selected · W move · E rotate · T scale · Shift snaps · ${added?'Delete removes it (added in this chapter)':'Delete hides it in this chapter'} · Alt-click picks what it sits on · Shift+click adds more.${moves}`);
  }
  // The selection, last entry = the one the single-prop inspector shows.
  function setMembers(list){
    sel=list.at(-1)||null;others=list.slice(0,-1);pivotDirty=true;if(group()&&mode==='scale')mode='translate';onSelect();rerender();
  }
  function select(key,{how='replace'}={}){
    if(!tools){ensure().then(()=>select(key,{how})).catch(error=>status(error.message,true));return;}
    const e=editOfKey(key),o=find(key);if(!e&&!o)return;
    const entry={key,target:e?propTarget(e):items().find(i=>i.key===key)?.target||sel?.target,obj:o};
    if(how==='toggle'&&isSel(key))setMembers(members().filter(m=>m.key!==key));
    else setMembers(how==='replace'?[entry]:[...members().filter(m=>m.key!==key),entry]);
    status(o?`${label(o)} selected${o&&!shown(o)?' (hidden in this chapter: untick Hide to bring it back)':''}.`:`${e?.label?nice(e.label):'That prop'} is not in the room right now (the film setup did not find it).`,!o);
  }
  function deselect(){placing=false;if(!sel)return;sel=null;others=[];rerender();}
  // ---- edits from the inspector and keys
  function apply(change,text){
    const o=current();if(!sel)return;const e=editOfKey(sel.key)||{},next={...sel.target,...e,...change};
    for(const k of Object.keys(change))if(change[k]===undefined)delete next[k];
    write(sel.key,next,text);
  }
  function hide(on=true){
    if(group()){hideItems(members(),on);return true;}
    const o=current();if(!sel)return false;if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return true;}
    if(isAddEdit(editOfKey(sel.key))){remove();return true;}const name=o?label(o):nice(sel.target.label),filmHides=o&&(o.userData.__filmFxEdits||[]).some(e=>!e.director&&e.hide);
    apply({hide:on?true:filmHides?false:undefined},on?`Hid ${name} in this chapter. Undo, or untick Hide in Props, brings it back.`:`Showed ${name} again.`);return true;
  }
  // Hide / show several (the selection, or a layer's items [{key, target}]) as ordinary per-chapter hide edits: one undo step.
  function hideItems(list,on,also=null){
    const changes=[];let skipped=0;
    for(const m of list){
      if(m.blocked){skipped++;continue;}
      const e=editOfKey(m.key),o=m.obj&&inScene(m.obj)?m.obj:find(m.key,m.target),target=m.target||items().find(i=>i.key===m.key)?.target;
      if(!target&&!e){skipped++;continue;}
      if(isAddEdit(e)){if(on)changes.push({key:m.key,next:null});continue;}
      const filmHides=o&&(o.userData.__filmFxEdits||[]).some(x=>!x.director&&x.hide);
      changes.push({key:m.key,next:{...(target||{}),...(e||{}),hide:on?true:filmHides?false:undefined}});
    }
    for(const c of changes)if(c.next&&c.next.hide===undefined)delete c.next.hide;
    if(!changes.length){if(also)commit(also,{key:null,render:false});status(skipped?`${CANT_SAVE}: ${skipped} of them can't be kept in the film.`:'Nothing to change.',!!skipped);return;}
    writeMany(changes,`${on?'Hid':'Showed'} ${changes.length} item${changes.length===1?'':'s'} in this chapter${skipped?` (${skipped} can't be kept in the film)`:''}. One Undo brings ${on?'them back':'the change back'}.`,also);
  }
  // An added prop: Delete, Reset to the film and Remove all take it out of the chapter (Undo brings it back).
  function remove(){if(!sel)return;const e=editOfKey(sel.key);if(!isAddEdit(e))return;const name=e.label||nice(e.match);write(sel.key,null,`Removed ${name} (added in this chapter). Undo brings it back.`);sel=null;others=[];rerender();}
  function reset(){if(!sel)return;if(group()){const list=members().filter(m=>editOfKey(m.key));if(!list.length){status('They are already where the film puts them.');return;}writeMany(list.map(m=>({key:m.key,next:null})),`${list.length} items back to the film. One Undo brings them back.`);return;}if(isAddEdit(editOfKey(sel.key))){remove();return;}const name=sel.target.label?nice(sel.target.label):'The prop';if(!editOfKey(sel.key)){status(name+' is already where the film puts it.');return;}write(sel.key,null,`${name} back to the film.`);}
  function resetAll(){const n=editedCount();if(!n){status('No prop edits in this chapter: the props are the film\'s.');return;}const a=edits().filter(isAddEdit).length;commit(()=>{shot().propEdits=[];},{render:false});if(sel&&a)sel=null;status(`All props back to the film (${n} edit${n===1?'':'s'} cleared${a?`, ${a} added prop${a===1?'':'s'} removed`:''}). Undo brings them back.`);rerender();}
  async function changed(el){
    await ensure();if(group()){groupChanged(el);return;}
    if(sel&&/^pp-t-/.test(el.name)){changedTiming(el.name,el.value===''?NaN:Number(el.value));return;}
    const o=current();if(!sel||!o)return;const name=el.name,v=Number(el.value);
    if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);rerender();return;}
    if(name==='pp-hide'){hide(el.checked);return;}
    if(el.value===''||!Number.isFinite(v))throw Error('Enter a number.');
    const added=editOfKey(sel.key);if(isAddEdit(added)){changedAdd(o,added,name,v);return;}
    const b=base(o),{THREE}=tools,st=installed(o),world=st.position.clone();if(o.parent){o.parent.updateMatrixWorld(true);o.parent.localToWorld(world);}
    const e=editOfKey(sel.key)||{},rotNow=new THREE.Euler(b.rot.x,b.rot.y,b.rot.z,b.rot.order),turn=(e.rotation||[0,0,0]).slice(),fac=(e.scale||[1,1,1]).slice();
    let verb='Moved';
    if(/^pp-p[xyz]$/.test(name)){if(Math.abs(v)>1000)throw Error('Positions run from -1000 to 1000 m.');world.setComponent('xyz'.indexOf(name[4]),v);}
    else if(/^pp-r[xyz]$/.test(name)){turn['xyz'.indexOf(name[4])]=wrapDeg(v);verb='Rotated';}
    else if(name==='pp-s'){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');fac[0]=fac[1]=fac[2]=v;verb='Scaled';}
    else if(/^pp-s[xyz]$/.test(name)){if(v<.01||v>100)throw Error('Scale runs from 0.01 to 100.');fac['xyz'.indexOf(name[4])]=v;verb='Scaled';}
    else return;
    rotNow.x+=THREE.MathUtils.degToRad(turn[0]);rotNow.y+=THREE.MathUtils.degToRad(turn[1]);rotNow.z+=THREE.MathUtils.degToRad(turn[2]);
    const next={...sel.target,...e,...editFrom(o,b,{world,rot:rotNow,scale:b.scale.clone().multiply(new THREE.Vector3(...fac))})};
    write(sel.key,next,`${verb} ${label(o)}.`);
  }
  // ---- the chapter's editable things, for the Layers tab: [{key, target, obj, name, desk, hidden}]
  function items(){
    if(!tools||!three()?.scene)return [];if(itemsCache&&performance.now()-itemsAt<1500)return itemsCache;
    const seen=new Set(),out=[];
    sceneOf().traverse(x=>{if(!x.isMesh||isOurs(x))return;const o=meaningful(x);if(!o||seen.has(o))return;seen.add(o);
      try{const t=targetOf(o),key=propKey(t);
        if(out.some(i=>i.key===key))return;
        out.push({key,target:propTarget({...t,label:t.label||o.name||''}),obj:o,name:label(o),desk:onDeskItself(o)||ridesDesk(o),hidden:!shown(o)||editOfKey(key)?.hide===true,area:areaOf(o)});}catch{}
    });
    itemsAt=performance.now();return itemsCache=out;
  }
  // Room area: the nearest named group the prop sits in below the room's root ('' when it sits straight in the room).
  function areaOf(o){const root=win()?.ErgoFlex?.workspaceRoom?.root;let name='';for(let p=o.parent;p&&p!==root&&p!==sceneOf();p=p.parent){if(p.userData?.dayKit||/^(Scene dressing|Accessory mount|Desk dressing|Accessory):/.test(p.name))return '';if(p.name&&!/^(Group|Object3D|Scene)$/i.test(p.name)&&!/^Prop:|^Studio/.test(p.name))name=p.name;}return name;}
  // Select by keys (the Layers list): how replace | add | toggle. Items the film can't keep are still selected (and say so).
  async function selectKeys(keys,how='replace'){
    await ensure();const list=items(),entries=[];
    for(const k of keys){const i=list.find(x=>x.key===k);if(!i)continue;entries.push({key:k,target:i.target,obj:i.obj,blocked:isAddEdit(filmEdit(i.obj))?'':unrecordable(i.obj,i.target)});}
    if(!entries.length){if(how==='replace')setMembers([]);return 0;}
    let next;if(how==='replace')next=entries;else if(how==='toggle'){const rm=new Set(entries.map(e=>e.key).filter(isSel));next=[...members().filter(m=>!rm.has(m.key)),...entries.filter(e=>!rm.has(e.key))];}else next=[...members().filter(m=>!entries.some(e=>e.key===m.key)),...entries];
    setMembers(next);
    status(next.length>1?`${next.length} selected · they move together (W move · E rotate).`:`${label(next[0].obj)} selected · W move · E rotate · T scale · Delete hides it.`);return entries.length;
  }
  // "Shows where it is": a pulsing outline on the stage for ~1.5 s.
  function flashKey(key){const o=items().find(i=>i.key===key)?.obj;if(o)flash={obj:o,until:performance.now()+1500};}
  // ---- Drop to surface (drop-to-surface.mjs): the prop straight down onto what is below it.
  const surfaceName=obj=>{const m=meaningful(obj);if(m)return label(m);for(let p=obj;p;p=p.parent){const n=p.name&&!/^(Mesh|Object3D|Group|Scene|Cube|Plane)[\d._]*$/i.test(p.name)?p.name:'';if(n)return /^Room:/.test(n)?'the room':nice(n.replace(/^(Prop|Accessory|Desk dressing|Scene dressing):\s*/,''));}return 'the surface';};
  // One object: moves (and for flat / align turns) it live and says what happened; nothing is written. A caller with
  // several objects drops each, then writes each with writeLive. Returns {ok,reason} or {ok,o,base,distance,surface,text}.
  function dropObject(o,dropMode='drop'){
    if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});
    const b=base(o),was={p:o.position.clone(),q:o.quaternion.clone()},r=dropToSurface({THREE:tools.THREE,scene:sceneOf(),obj:o,mode:dropMode,mm:.001,skip:isOurs});
    if(!r.ok)return r;
    const inches=r.distance/.0254,abs=Math.abs(inches),surface=surfaceName(r.surface);
    const text=abs<.02?`${label(o)} already rests on ${surface}${r.rotated?' (now '+(dropMode==='align'?'aligned to it':'upright')+')':''}.`
      :`${inches>0?'Dropped':'Raised'} ${abs.toFixed(1)}\u2033 onto ${surface}${r.rotated?(dropMode==='align'?', aligned to it':', upright')+'':''}.`;
    const rests=abs<.02&&!r.rotated;if(rests){o.position.copy(was.p);o.quaternion.copy(was.q);o.updateMatrixWorld(true);}   // already on it: no edit
    return {...r,o,base:b,text,rests};
  }
  // The edit for an object moved live (a gizmo drag's end, or a drop), written as one undo step.
  function writeLive(o,b,text){
    const e=editOfKey(sel.key)||sel.target;
    if(isAddEdit(e)){write(sel.key,addFrom(o,e),text);return true;}
    const next={...sel.target,...(e||{}),...editFrom(o,b)};
    if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null)){status(text);return false;}
    write(sel.key,next,text);return true;
  }
  async function dropSelected(dropMode='drop'){
    await ensure();
    if(!sel){status('Select a prop first, then drop it onto the surface below.',true);return;}
    if(!editing()){status('Pause the chapter first: props are moved on the paused frame.',true);return;}
    if(group()){dropGroup(dropMode);return;}
    const o=current();if(!o){status('That prop is not in the room right now.',true);return;}
    if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return;}
    if(!shown(o)){status(`${label(o)} is hidden in this chapter: untick Hide first.`,true);return;}
    const had=snaps.has(o),r=dropObject(o,dropMode);
    if(!r.ok){if(!had)snaps.delete(o);status(r.reason,true);rerender();return;}
    if(r.rests){if(!had)snaps.delete(o);status(r.text);return;}
    try{writeLive(o,r.base,r.text);}catch(error){status(error.message,true);}
  }
  // Several selected: each drops straight down on its own (lowest first, so a stack settles from the bottom up),
  // all written as one undo step. Items that can't be saved, are hidden, already rest or have nothing below stay put.
  function dropGroup(dropMode){
    const dropped=[],rested=[],stuck=[],skipped=[];
    const list=members().map(m=>({m,o:objOf(m)})).sort((a,b)=>(a.o?a.o.getWorldPosition(new tools.THREE.Vector3()).y:0)-(b.o?b.o.getWorldPosition(new tools.THREE.Vector3()).y:0));
    for(const {m,o} of list){
      if(!o||m.blocked||!shown(o)){skipped.push(m);continue;}
      const had=snaps.has(o),r=dropObject(o,dropMode);
      if(!r.ok){if(!had)snaps.delete(o);stuck.push(r.reason);continue;}
      if(r.rests){if(!had)snaps.delete(o);rested.push(m);continue;}
      dropped.push({m,o,b:r.base});
    }
    const changes=[];
    for(const it of dropped){
      try{const e=editOfKey(it.m.key);const next=isAddEdit(e)?addFrom(it.o,e):{...it.m.target,...(e||{}),...editFrom(it.o,it.b)};
        if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null))continue;changes.push({key:it.m.key,next});}
      catch(error){skipped.push(it.m);console.warn('[props] group drop',error.message);}
    }
    const notes=[rested.length?`${rested.length} already rested`:'',stuck.length?`${stuck.length} had nothing below`:'',skipped.length?`${skipped.length} could not be moved`:''].filter(Boolean).join(', ');
    if(!changes.length){status(stuck[0]||(rested.length?'They already rest on the surface below.':'Nothing to drop.')+(skipped.length?` (${skipped.length} could not be moved)`:''),!!stuck.length);rerender();return;}
    writeMany(changes,`Dropped ${changes.length} items onto the surface below${notes?` (${notes})`:''}. One Undo puts them all back.`);
  }
  // ---- Make permanent in Studio: Studio's own room state through the studio server, never the file.
  function studioRoom(){
    const api=win()?.ErgoFlex;if(!api?.sceneAssetStates)return {reason:'The stage is still loading.'};
    const id=studioSceneIds(shot()).find(k=>api.sceneAssetStates.has(k));
    if(!id||!api.sceneAssetRegistry?.size)return {reason:'This room is built by the app, not a saved Studio layout.'};
    return {id,api};
  }
  // [{edit, key, name, change, obj, editorId, ok, why, transform | remove}]
  function plan(){
    const room=studioRoom(),{THREE}=tools||{};
    return edits().map((e,i)=>{
      const key=propKey(e),o=tools&&find(key),raw=e.label||o?.name||'',name=isAddEdit(e)?(e.label||nice(e.add.asset)):nice(raw),row={edit:e,key,name,raw,change:describePropEdit(e),obj:o};
      if(isAddEdit(e))return addPlan(row,e,o,room,i);
      if(o&&onDeskItself(o))return {...row,ok:false,why:ON_DESK};
      if(room.reason)return {...row,ok:false,why:room.reason};
      if(!o)return {...row,ok:false,why:'Not in the room right now: the film setup did not find it.'};
      if(/^Accessory:/.test(o.name)||!o.userData.sceneAssetKey)return {...row,ok:false,why:/^Accessory:/.test(o.name)?'A desk accessory: it belongs to the desk build, not the room\'s Studio layout.':'Built by the app with the room, not a saved Studio item, so Studio can\'t keep a change to it.'};
      const editorId='scene:'+o.userData.sceneAssetKey;
      if(!room.api.sceneAssetRegistry.has(editorId))return {...row,ok:false,why:'Studio does not list this prop in this room\'s layout.'};
      if(handMoves(o).length&&(e.position||e.rotation||e.scale))return {...row,ok:false,why:'The film\'s own setup also moves this prop in this chapter, so Studio and the film would disagree. Keep it as a chapter edit.'};
      if(e.hide===true)return {...row,ok:true,editorId,remove:true,change:row.change+' → removed from the room in Studio'};
      if(!(e.position||e.rotation||e.scale))return {...row,ok:false,why:'Only shown in this chapter: Studio already shows it.'};
      if(snaps.has(o))return {...row,ok:false,why:'Finish the drag first.'};
      // Studio keeps the local transform under its parent without the room's daily staging (room-life.mjs).
      o.updateWorldMatrix(true,false);o.parent.updateWorldMatrix(true,false);
      const M=new THREE.Matrix4().copy(o.parent.matrixWorld).invert().multiply(o.matrixWorld),delta=o.userData.dailyDelta;if(delta)M.premultiply(new THREE.Matrix4().fromArray(delta).invert());
      const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();M.decompose(p,q,s);
      return {...row,ok:true,editorId,transform:{p:{x:p.x,y:p.y,z:p.z},q:{x:q.x,y:q.y,z:q.z,w:q.w},s:{x:s.x,y:s.y,z:s.z}},local:{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()},sceneId:room.id};
    });
  }
  // An added prop becomes a new Studio item in the room (as Studio's own library Add makes one); not on the desk.
  function addPlan(row,e,o,room,i){
    if(e.parent==='desk')return {...row,ok:false,why:'Added on the desk: it travels with the desk, so Studio\'s room layout can\'t hold it. Keep it as a chapter edit.'};
    if(room.reason)return {...row,ok:false,why:room.reason};
    if(!o)return {...row,ok:false,why:'Not on the stage right now (still loading).'};
    if(o.parent!==room.api.workspaceRoom?.root)return {...row,ok:false,why:'Not in this room\'s Studio layout (the stage has no room here).'};
    if(snaps.has(o))return {...row,ok:false,why:'Finish the drag first.'};
    const key=`${shot().room}:custom:${Date.now()}-${i}:${e.add.asset}`,t={p:{x:o.position.x,y:o.position.y,z:o.position.z},q:{x:o.quaternion.x,y:o.quaternion.y,z:o.quaternion.z,w:o.quaternion.w},s:{x:o.scale.x,y:o.scale.y,z:o.scale.z}};
    return {...row,ok:true,editorId:'scene:'+key,studioKey:key,add:{propId:e.add.asset,position:[t.p.x,t.p.y,t.p.z]},transform:t,local:{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()},sceneId:room.id,change:row.change+' → a new item in the room in Studio'};
  }
  function permanentState(){
    const room=tools?studioRoom():{reason:'The Props tools are still starting.'};if(room.reason)return {ok:false,why:room.reason};
    if(!editedCount())return {ok:false,why:'No prop edits in this chapter yet.'};
    const rows=plan(),n=rows.filter(r=>r.ok).length;return n?{ok:true,n,rows}:{ok:false,why:rows[0]?.why||'Nothing to write.',rows};
  }
  const dialog=document.createElement('dialog');dialog.id='prop-permanent';dialog.setAttribute('aria-labelledby','prop-permanent-title');document.body.append(dialog);
  function openPermanent(){
    const st=permanentState();if(!st.rows&&!st.ok){status(st.why,true);return;}
    const room=studioRoom();dialogPlan=st.rows;
    dialog.innerHTML=`<div class="director-heading"><div><span class="director-kicker">MAKE PERMANENT IN STUDIO</span><h2 id="prop-permanent-title">Write these props to Studio?</h2></div></div>
      <p>Studio's <b>${escape(room.id||'')}</b> room keeps exactly these changes, for Studio and for every chapter in that room. This chapter's edits for them are then folded in (Studio holds them). Nothing else in Studio changes.</p>
      <ul class="prop-permanent-list">${st.rows.map((r,i)=>`<li class="${r.ok?'':'blocked'}"><label class="director-check"><input type="checkbox" data-permanent="${i}" ${r.ok?'checked':'disabled'}><span><b title="${escape(r.raw)}">${escape(r.name)}</b> · ${escape(r.change)}${r.ok?'':`<small>${escape(r.why)}</small>`}</span></label></li>`).join('')}</ul>
      <div class="director-actions"><button data-permanent-go class="primary" ${st.ok?'':'disabled'}>Write ${st.n||0} prop${st.n===1?'':'s'} to Studio</button><button data-permanent-cancel>Cancel</button></div><p class="director-hint" data-permanent-status role="status"></p>`;
    dialog.showModal();dialog.querySelector('[data-permanent-cancel]').focus();
  }
  dialog.addEventListener('change',()=>{const n=dialog.querySelectorAll('[data-permanent]:checked').length,b=dialog.querySelector('[data-permanent-go]');if(b){b.disabled=!n;b.textContent=`Write ${n} prop${n===1?'':'s'} to Studio`;}});
  dialog.addEventListener('click',async event=>{
    if(event.target.closest('[data-permanent-cancel]')){dialog.close();return;}
    const go=event.target.closest('[data-permanent-go]');if(!go)return;
    const rows=[...dialog.querySelectorAll('[data-permanent]:checked')].map(el=>dialogPlan[Number(el.dataset.permanent)]).filter(r=>r?.ok);if(!rows.length)return;
    go.disabled=true;const say=t=>{const el=dialog.querySelector('[data-permanent-status]');if(el)el.textContent=t;};say('Writing to Studio…');
    try{await makePermanent(rows);dialog.close();}catch(error){say(error.message);go.disabled=false;status(error.message,true);}
  });
  async function makePermanent(rows){
    const sceneId=rows[0].sceneId||studioRoom().id,api=studioRoom().api,sync=window.__studioState;
    const got=await fetch('/api/studio-state',{cache:'no-store'});if(!got.ok)throw Error(`Studio's state is unavailable (${got.status}).`);
    const base=(await got.json()).values?.[STATE_KEY]??null,value=writeSceneAssets(base,sceneId,rows.map(r=>({editorId:r.editorId,...(r.add?{add:r.add,transform:r.transform}:r.remove?{remove:true}:{transform:r.transform})})));
    const posted=await fetch('/api/studio-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client:sync?.client||'director-'+Math.random().toString(36).slice(2,10),by:'Director',changes:[{key:STATE_KEY,value,base}]})});
    if(!posted.ok)throw Error(`Studio did not take the change (${posted.status}).`);const result=(await posted.json()).results?.[0];if(!result||result.skipped||result.error)throw Error('Studio did not take the change: '+(result?.skipped||result?.error||'no answer'));
    // This page's copy of the shared state (no second write: the sync script sees it as its own base) and the stage's memory.
    try{const stored=(await (await fetch('/api/studio-state',{cache:'no-store'})).json()).values?.[STATE_KEY];if(stored){sync?.base?.set(STATE_KEY,stored);localStorage.setItem(STATE_KEY,stored);}}catch{}
    const mem=api.sceneAssetStates.get(sceneId);
    for(const r of rows){if(!mem)break;if(r.add){mem.added?.set?.(r.editorId,{editorId:r.editorId,propId:r.add.propId,position:r.add.position});mem.transforms.set(r.editorId,r.transform);continue;}if(r.remove){const a=mem.added;if(a?.has?.(r.editorId)){a.delete(r.editorId);mem.transforms.delete(r.editorId);}else mem.removed.add(r.editorId);}else mem.transforms.set(r.editorId,r.transform);}
    // The props keep their place on the stage once the chapter's edits are folded in (film-fx re-installs without them).
    pending={rows,keys:new Set(rows.map(r=>r.key))};fold(pending.keys);
    if(group())setMembers(members().filter(m=>!pending.keys.has(m.key)));else if(sel&&pending.keys.has(sel.key))sel=null;
    status(`Made ${rows.length} prop${rows.length===1?'':'s'} permanent in Studio (${sceneId}): ${rows.map(r=>r.name).join(', ')}. This chapter's edits for them are folded in; Export cut so the film follows.`);
    rerender();
  }
  // ---- inspector (Props tab)
  // ---- On screen: when the selected prop appears and leaves, and its fades (chapter seconds in the fields)
  const selName=()=>{const o=current(),e=sel&&editOfKey(sel.key);return o?label(o):nice(e?.label||sel?.target.label||'');};
  const selSpan=()=>{const e=editOfKey(sel.key);return spanOf((e||sel.target).desk);};
  function timingHtml(){
    const e=editOfKey(sel.key),span=selSpan(),s=onScreen(e,span);
    const num=(name,text,value,extra='')=>`<label>${text}<input name="${name}" type="number" step=".1" min="0" value="${value}" ${extra}></label>`;
    const where=span.missing?`Its desk (${escape(span.desk)}) is not in this chapter now, so it does not show.`:span.desk?`Belongs to Desk ${escape(span.n)} · ${escape(span.label)}, on screen ${r1(span.lo)}–${r1(span.hi)} s. It follows that desk if you reorder the desks.`:`The chapter runs 0–${r1(span.hi)} s.`;
    return `<div class="prop-timing" data-prop-timing><h5>On screen <small>${escape(timeText(s,span))}</small></h5>
      <div class="director-grid">${num('pp-t-from','Appears at (s)',r2(s.from))}${num('pp-t-to','Leaves at (s)',r2(s.to))}${num('pp-t-fin','Fade in (s)',s.fadeIn,'max="30"')}${num('pp-t-fout','Fade out (s)',s.fadeOut,'max="30"')}</div>
      <div class="director-actions"><button data-action="pp-t-from-now" title="It appears at the playhead">Appear at playhead</button><button data-action="pp-t-to-now" title="It leaves at the playhead">Leave at playhead</button><button data-action="pp-t-all" ${s.timed?'':'disabled'} title="On screen the whole time again, no fades">Whole time</button></div>
      <p class="director-hint">${where} You can also drag the ends of its bar in the timeline's Props lane.</p></div>`;
  }
  function setTiming(change){
    if(!sel)return;if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return;}
    const span=selSpan();if(span.missing){status('Its desk is not in this chapter now: nothing to time.',true);return;}
    const s=onScreen(editOfKey(sel.key),span),next={from:s.from,to:s.to,fadeIn:s.fadeIn,fadeOut:s.fadeOut,...change};
    if('from' in change)next.from=Math.max(span.lo,Math.min(change.from,next.to-.1));
    if('to' in change)next.to=Math.min(span.hi,Math.max(change.to,next.from+.1));
    if(next.to-next.from<.1){status('It needs at least a tenth of a second on screen.',true);rerender();return;}
    const len=next.to-next.from;next.fadeIn=Math.min(next.fadeIn,len);next.fadeOut=Math.min(next.fadeOut,len);
    writeShow(sel,next,span,selName());
  }
  function changedTiming(name,v){
    if(!Number.isFinite(v)||v<0)throw Error('Enter seconds, 0 or more.');
    if(name==='pp-t-from')setTiming({from:v});else if(name==='pp-t-to')setTiming({to:v});
    else if(name==='pp-t-fin')setTiming({fadeIn:Math.min(30,v)});else if(name==='pp-t-fout')setTiming({fadeOut:Math.min(30,v)});
  }
  function panel(){
    if(!three()?.scene)return '<h3>Props</h3><p class="director-hint">Loading the chapter…</p>';
    const o=current(),e=sel&&editOfKey(sel.key),st=permanentState(),n=editedCount();
    const head=`<h3>Props</h3><p class="director-hint">Click a prop in the view to select it (not while Lights are shown). W move · E rotate · T scale · Shift snaps · Delete hides it. Edits stay in this chapter: Studio does not change.</p>
      <div class="director-actions"><button data-action="pp-add" class="prop-add-button" title="Add a model from the prop library: it goes on the desk or the floor in front of the camera, ready to move">+ Add prop</button><button data-action="pp-reset-all" ${n?'':'disabled'} title="Every prop back to the film in this chapter: one step, Undo brings them back">Reset all props to the film${n?' ('+n+')':''}</button><button data-action="pp-permanent" ${st.ok?'':'disabled'} title="${escape(st.ok?'Write these prop edits into Studio\'s room layout (you confirm each one)':st.why)}">Make permanent in Studio…</button></div>${st.ok?'':`<p class="director-hint" data-permanent-why>${escape(st.why)}</p>`}`;
    if(!sel)return head+'<p class="director-hint">No prop selected. Shift+click adds to the selection, Ctrl+click adds or removes.</p>';
    if(group())return head+groupPanelHtml({members:members().map(m=>({key:m.key,name:nice(m.target.label||''),desk:!!(objOf(m)&&(onDeskItself(objOf(m))||ridesDesk(objOf(m)))),hidden:editOfKey(m.key)?.hide===true||(!!objOf(m)&&!shown(objOf(m))),blocked:m.blocked,missing:!objOf(m)})),mode,escape,edited:members().some(m=>editOfKey(m.key)),extra:dropButtons()});
    if(!o)return head+`<div class="movement-inspector prop-inspector" data-reveal="prop"><h4 title="${escape(sel.target.label||'')}">${escape(nice(sel.target.label))}</h4><p class="director-hint">${(e||sel.target).desk&&(e||sel.target).desk!==deskNow()?.preset?'It belongs to another desk of this chapter: click its bar in the Props lane to go to that desk.':'Not in the room right now (the film setup did not find it).'}</p>${timingHtml()}<div class="director-actions"><button data-action="pp-reset" ${e?'':'disabled'}>Reset to the film</button></div></div>`;
    if(!tools)return head;if(isAddEdit(e))return head+addPanel(o,e);const b=base(o),{THREE}=tools,pos=o.getWorldPosition(new THREE.Vector3()).toArray(),turn=e?.rotation||[0,0,0],fac=e?.scale||[1,1,1],uniform=Math.abs(fac[0]-fac[1])<1e-4&&Math.abs(fac[1]-fac[2])<1e-4;
    const num=(name,text,value,step,extra='')=>`<label>${text}<input name="${name}" type="number" step="${step}" value="${value}" ${extra}></label>`;
    const studio=plan().find(r=>r.key===sel.key),hidden=e?.hide===true||!shown(o),moved=b?o.getWorldPosition(new THREE.Vector3()).distanceTo(b.world):0;
    return head+`<div class="movement-inspector prop-inspector" data-reveal="prop"><h4>${escape(propName(o.name))}</h4><p class="director-hint prop-name">${escape(o.name||'Unnamed')}${o.userData.sceneAssetKey?' · Studio item':''}</p>
      <div class="director-actions prop-modes">${Object.entries(MODES).map(([m,t])=>`<button data-action="pp-mode-${m}" aria-pressed="${mode===m}" title="${t} (${m==='translate'?'W':m==='rotate'?'E':'T'})">${t}</button>`).join('')}${meaningful(o.parent||o)?'<button data-action="pp-parent" title="Select what it sits on (Alt-click in the view)">Select what it sits on</button>':''}</div>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-p'+k,'Position '+k+' (m)',r3(pos[i]),.01)).join('')}</div>${e?.position?`<p class="director-hint">Moved ${r3(moved)} m from the film's place.</p>`:''}
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-r'+k,'Turn '+k+' (°)',r1(turn[i]),1)).join('')}</div>
      <label>Scale ×<input name="pp-s" type="number" min=".01" max="100" step=".05" value="${uniform?Number(fac[0].toFixed(3)):''}" placeholder="mixed"></label>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-s'+k,'Scale '+k+' ×',Number(fac[i].toFixed(3)),.05,'min=".01" max="100"')).join('')}</div>
      ${dropButtons()}
      ${timingHtml()}
      <label class="director-check"><input type="checkbox" name="pp-hide" ${e?.hide===true||(!shown(o)&&!e?.show)?'checked':''}>Hide in this chapter</label>
      <div class="director-actions"><button data-action="pp-reset" ${e?'':'disabled'} title="This prop back to where the film puts it">Reset to the film</button></div>
      <p class="director-hint" data-studio-note>${studio?(studio.ok?'Studio: can be made permanent.':'Studio: '+escape(studio.why)):onDeskItself(o)?'Studio: '+escape(ON_DESK):'Studio: unchanged (edit the prop to make it permanent later).'}</p></div>`;
  }
  function addPanel(o,e){
    const {THREE}=tools,pos=o.getWorldPosition(new THREE.Vector3()).toArray(),fac=e.scale,uniform=Math.abs(fac[0]-fac[1])<1e-4&&Math.abs(fac[1]-fac[2])<1e-4,studio=plan().find(r=>r.key===sel.key);
    const num=(name,text,value,step,extra='')=>`<label>${text}<input name="${name}" type="number" step="${step}" value="${value}" ${extra}></label>`;
    return `<div class="movement-inspector prop-inspector prop-added" data-reveal="prop"><h4>${escape(label(o))}</h4><p class="director-hint prop-name">+ Added in this chapter · ${escape(e.add.asset)} · ${e.parent==='desk'?'on the desk (rides lift and tilt)':'in the room'}</p>
      <div class="director-actions prop-modes">${Object.entries(MODES).map(([m,t])=>`<button data-action="pp-mode-${m}" aria-pressed="${mode===m}" title="${t} (${m==='translate'?'W':m==='rotate'?'E':'T'})">${t}</button>`).join('')}</div>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-p'+k,'Position '+k+' (m)',r3(pos[i]),.01)).join('')}</div>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-r'+k,'Turn '+k+' (°)',r1(e.rotation[i]),1)).join('')}</div>
      <label>Scale ×<input name="pp-s" type="number" min=".01" max="100" step=".05" value="${uniform?Number(fac[0].toFixed(3)):''}" placeholder="mixed"></label>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-s'+k,'Scale '+k+' ×',Number(fac[i].toFixed(3)),.05,'min=".01" max="100"')).join('')}</div>
      ${dropButtons()}
      ${timingHtml()}
      <div class="director-actions"><button data-action="pp-place" aria-pressed="${placing}" title="Then click a surface in the view: the desktop (it rides the desk), a table, a shelf or the floor">Place on a surface…</button><button data-action="pp-remove" title="Take it out of this chapter (Delete): Undo brings it back">Remove from this chapter</button></div>
      <p class="director-hint" data-studio-note>${studio?(studio.ok?'Studio: can be added to the room for good (Make permanent in Studio…).':'Studio: '+escape(studio.why)):''}</p></div>`;
  }
  const dropButtons=()=>`<div class="director-actions prop-drop"><button data-action="pp-drop" title="Move it straight down until it rests on the surface below (End)">Drop to surface</button><button data-action="pp-drop-flat" title="Level it (no tilt or roll), then drop it onto the surface below (Shift+End)">Drop flat</button><button data-action="pp-drop-align" title="Tilt it to the surface under it (a ramp, the tilted desktop), then drop it (Alt+End)">Align to surface</button></div>`;
  async function action(name,arg){
    if(name==='pp-add'){library.open();return;}
    await ensure();
    if(name==='pp-remove'){remove();return;}
    if(name==='pp-drop'||name==='pp-drop-flat'||name==='pp-drop-align'){await dropSelected(name==='pp-drop-flat'?'flat':name==='pp-drop-align'?'align':'drop');return;}
    if(name==='pp-place'){const o=current();if(!o||!isAddEdit(editOfKey(sel.key)))return;placing=!placing;rerender();status(placing?`Click a surface in the view to put ${label(o)} there (the desktop, a table, the floor). Click Place again to cancel.`:'Placing cancelled.');return;}
    if(name==='pp-pick'){select(arg);return;}
    if(name==='pp-lane'){if(performance.now()<barSuppress)return;laneClick(laneList[Number(arg)]);return;}
    if(name==='pp-t-from-now'){setTiming({from:r2(time())});return;}
    if(name==='pp-t-to-now'){setTiming({to:r2(time())});return;}
    if(name==='pp-t-all'){setTiming({from:-1,to:END,fadeIn:0,fadeOut:0});return;}
    if(name==='pp-unsel'){setMembers(members().filter(m=>m.key!==arg));return;}
    if(name==='pp-clear'){deselect();onSelect();status('Selection cleared.');return;}
    if(name==='pp-reset-all'){resetAll();return;}
    if(name==='pp-permanent'){openPermanent();return;}
    if(name==='pp-reset'){reset();return;}
    if(name==='pp-parent'){const o=current(),p=o&&meaningful(o.parent);if(p)pick(p);return;}
    if(name.startsWith('pp-mode-')){setMode(name.slice(8));return;}
  }
  function setMode(m){if(!MODES[m])return;if(group()&&m==='scale'){status('Scale works on one item at a time: select one item, or move and turn the group.',true);return;}mode=m;rerender();status(`Gizmo: ${MODES[m].toLowerCase()}${sel?'':' (select a prop first)'}.`);}
  // ---- the timeline's Props lane: bars over the seconds each prop is on screen
  // The desk's own items are learned from the stage (they differ per desk in a sub-shot chapter) and kept for the
  // session, so every desk's bars are there once it has been on stage.
  const seen=new Map(),seenKey=desk=>`${shot()?.id||''}|${desk||''}`;
  try{for(const [k,v] of Object.entries(JSON.parse(sessionStorage.getItem('directorPropItems')||'{}')))if(Array.isArray(v))seen.set(k,v);}catch{}
  function learn(){
    if(!tools||!three()?.scene)return;const d=deskNow();if(versions().length&&!d)return;
    const list=items().filter(i=>i.desk&&!i.obj?.userData?.directorAdd&&(!i.hidden||editOfKey(i.key))).map(i=>({key:i.key,target:i.target,name:i.name}));
    const k=seenKey(d?.preset),was=JSON.stringify(seen.get(k)||null);if(JSON.stringify(list)===was)return false;
    seen.set(k,list);try{sessionStorage.setItem('directorPropItems',JSON.stringify(Object.fromEntries(seen)));}catch{}
    return true;
  }
  const laneName=e=>isAddEdit(e)?(e.label||propName(e.add.asset)):propName(e.label||e.match.replace(/^\^|\$$/g,'').replace(/\\/g,''));
  let laneList=[],laneRows=1,barDrag=null,barSuppress=0,wanted=null;const ROW=17,MAX_ROWS=9;
  function laneItems(){
    const T=seconds()||1,vs=versions(),out=[],chapter={t0:0,lo:0,hi:T},all=edits();
    const push=(span,row)=>{const s=onScreen(row.e,span);out.push({id:row.key+'|'+(span.n||''),...row,span,start:s.from,end:Math.max(s.from+.01,s.to),timed:s.timed,fadeIn:s.fadeIn,fadeOut:s.fadeOut});};
    const spans=vs.length?vs.map(v=>({t0:v.start,lo:v.from,hi:Math.min(T,v.to),n:v.n,label:v.label,desk:v.preset})):[chapter];
    for(const span of spans){
      const rows=new Map(),known=seen.get(seenKey(span.desk));
      for(const k of known||[])rows.set(k.key,{key:k.key,target:k.target,name:k.name,e:editOfKey(k.key)});
      for(const e of all){if(vs.length&&e.desk!==span.desk)continue;const k=propKey(e);if(!rows.has(k))rows.set(k,{key:k,target:propTarget(e),name:laneName(e),e});}
      for(const r of rows.values())push(span,r);
      if(vs.length&&!known)out.push({id:'ghost|'+span.n,ghost:true,span,start:span.lo,end:span.hi,name:`Desk ${span.n} · ${span.label}: click to see its items`});
    }
    // Edits that hold for every desk of a sub-shot chapter (made before desks had props of their own): one bar each.
    if(vs.length)for(const e of all.filter(e=>!e.desk)){const k=propKey(e);if(!out.some(i=>i.key===k))push(chapter,{key:k,target:propTarget(e),name:laneName(e),e});}
    return out;
  }
  function lane(){
    laneList=laneItems();laneRows=1;const T=seconds()||1;
    if(!laneList.length)return '<span class="desk-lane-empty">Click a prop in the view to move, turn, scale, hide or time it · + Prop adds one from the library</span>';
    const layers=stackRows(laneList);laneRows=layers.count;
    return laneList.map((it,i)=>{
      const e=it.e,x=it.start/T*100,w=Math.max(.5,(it.end-it.start)/T*100),top=1+layers.row.get(it.id)*ROW;
      if(it.ghost)return `<button type="button" class="prop-bar ghost" data-action="pp-lane" data-index="${i}" style="left:${x}%;width:${w}%;top:${top}px;height:${ROW-2}px" title="Go to this desk: its items are listed here once it has been on stage">${escape(it.name)}</button>`;
      const hiddenBar=e?.hide===true,added=isAddEdit(e),fi=it.fadeIn>0?Math.min(100,it.fadeIn/(it.end-it.start)*100):0,fo=it.fadeOut>0?Math.min(100,it.fadeOut/(it.end-it.start)*100):0;
      const tip=`${it.name}${it.span.desk?` · Desk ${it.span.n} · ${it.span.label}`:''} · on screen ${timeText({from:it.start,to:it.end},it.span)}${e?' · '+describePropEdit(e):' · as the film has it'}${hiddenBar?' · hidden: click, then untick Hide to bring it back':''} · click to select, drag an end to set when it appears or leaves${it.timed?', drag the middle to move it':''}`;
      return `<button type="button" class="prop-bar ${e?'prop-chip':'film'} ${hiddenBar?'prop-hidden':''} ${added?'prop-added':''} ${it.timed?'timed':''} ${isSel(it.key)?'selected':''}" data-action="pp-lane" data-index="${i}" style="left:${x}%;width:${w}%;top:${top}px;height:${ROW-2}px;--fade-in:${fi}%;--fade-out:${fo}%" title="${escape(tip)}">${added?'<b aria-label="added">+</b>':''}${escape(it.name)}</button>`;}).join('');
  }
  const laneHeight=()=>Math.min(MAX_ROWS,Math.max(2,laneRows))*ROW+4;
  // A click on a bar: the playhead goes into its seconds when it is outside them (so its desk comes on stage), then
  // the prop is selected (as soon as the stage has it).
  function laneClick(it){
    if(!it)return;const t=time(),inside=t>=it.start-1e-3&&t<=it.end+1e-3;
    if(!inside||it.ghost){const to=Math.min(it.end-.05,it.start+(it.ghost?.2:.1));seek(Math.max(0,to));}
    if(it.ghost){status(`${it.name.split(':')[0]} is coming on stage: its items appear in the Props lane.`);return;}
    setMembers([{key:it.key,target:it.target,obj:tools?find(it.key,it.target):null}]);
    const o=current();wanted=o?null:{key:it.key,target:it.target,until:performance.now()+8000};status(o?`${label(o)} selected · W move · E rotate · T scale · drag its bar's ends to set when it shows.`:`${it.name} selected${it.span.desk&&it.span.desk!==deskNow()?.preset?`: going to Desk ${it.span.n} · ${it.span.label}`:''}.`);
    if(!tools)ensure().catch(error=>status(error.message,true));
  }
  // A bar's ends drag to set when the prop appears and leaves (within its desk's seconds, snapped to a tenth);
  // the middle of a timed bar moves it. Back over the whole stretch, the timing is cleared.
  document.addEventListener('pointerdown',ev=>{
    const bar=ev.target.closest?.('.prop-bar');if(!bar||bar.classList.contains('ghost')||ev.button!==0||!editing())return;
    const it=laneList[Number(bar.dataset.index)],T=seconds(),r=bar.getBoundingClientRect(),box=bar.parentElement.getBoundingClientRect();if(!it||!T||!box.width)return;
    const grip=Math.min(8,r.width/3),edge=ev.clientX-r.left<grip?'in':r.right-ev.clientX<grip?'out':'move';
    barDrag={it,bar,edge,x:ev.clientX,width:box.width,T,from:[it.start,it.end],now:null};
  },true);
  document.addEventListener('pointermove',ev=>{
    const d=barDrag;if(!d||(!d.now&&Math.abs(ev.clientX-d.x)<3))return;
    const dt=(ev.clientX-d.x)/d.width*d.T,snap=v=>Math.round(v*10)/10,{lo,hi}=d.it.span;let [a,b]=d.from;
    if(d.edge==='in')a=Math.max(lo,Math.min(b-.2,snap(a+dt)));
    else if(d.edge==='out')b=Math.min(hi,Math.max(a+.2,snap(b+dt)));
    else if(d.it.timed){const len=b-a;a=Math.max(lo,Math.min(hi-len,snap(a+dt)));b=a+len;}
    else return;
    d.now=[a,b];d.bar.style.left=a/d.T*100+'%';d.bar.style.width=Math.max(.5,(b-a)/d.T*100)+'%';
    status(`${d.it.name}: on screen ${r1(a)}–${r1(b)} s.`);
  },true);
  const endBar=()=>{
    const d=barDrag;barDrag=null;if(!d?.now)return;barSuppress=performance.now()+350;
    const [a,b]=d.now,it=d.it;if(Math.abs(a-d.from[0])<1e-6&&Math.abs(b-d.from[1])<1e-6){rerender();return;}
    const len=b-a;writeShow(it,{from:a,to:b,fadeIn:Math.min(it.fadeIn,len),fadeOut:Math.min(it.fadeOut,len)},it.span,it.name);
  };
  document.addEventListener('pointerup',endBar,true);document.addEventListener('pointercancel',()=>{if(barDrag?.now)rerender();barDrag=null;},true);
  // After film-fx (re)installs: objects may be new; folded-in props keep their Studio place on the stage.
  function applied(){
    found=null;itemsCache=null;pivotDirty=true;for(const m of members())if(m.obj&&!inScene(m.obj))m.obj=null;
    learn();
    // A bar clicked for a desk that was not on stage: its prop is picked up now that it is.
    if(wanted&&performance.now()<wanted.until&&sel?.key===wanted.key){const o=tools&&find(wanted.key,wanted.target);if(o){sel.obj=o;wanted=null;status(`${label(o)} selected · W move · E rotate · T scale · drag its bar's ends to set when it shows.`);}}else wanted=null;
    if(pending&&!edits().some(e=>pending.keys.has(propKey(e)))){
      // Added props: the chapter's copy is gone with its edit; Studio's own item stands in its place (as Studio loads it).
      for(const r of pending.rows.filter(r=>r.add)){const room=win()?.ErgoFlex?.workspaceRoom;room?.addAsset(r.add.propId,r.studioKey,r.add.position).then(obj=>{if(!obj)return;obj.position.copy(r.local.p);obj.quaternion.copy(r.local.q);obj.scale.copy(r.local.s);obj.updateMatrixWorld(true);bridge.stage()?.wake?.(300);}).catch(error=>console.warn('[props] Studio copy',error));}
      for(const r of pending.rows){const o=r.obj;if(r.add||!o||!inScene(o))continue;if(r.remove)o.removeFromParent();else{o.position.copy(r.local.p);o.quaternion.copy(r.local.q);o.scale.copy(r.local.s);o.updateMatrixWorld(true);}}
      pending=null;bridge.stage()?.wake?.(300);
    }
  }
  return {panel,lane,laneHeight,action,changed,select,deselect,hide,reset,setMode,applied,editedCount,ensure,learn,
    selected:()=>sel?.key||null,selectedKeys:()=>members().map(m=>m.key),selectKeys,items,hideItems:(keys,on,also)=>hideItems(keys.map(k=>{const i=items().find(x=>x.key===k);return i?{key:k,target:i.target,obj:i.obj}:{key:k};}),on,also),
    flashKey,setLocked:fn=>{lockedKeys=fn;},isHidden:key=>{const e=editOfKey(key);if(e)return e.hide===true;const i=items().find(x=>x.key===key);return !!i&&i.hidden;},selectedName:()=>sel?(current()?.name||sel.target.label):null,mode:()=>mode,
    addProp,dropSelected,dropObject,writeLive,openLibrary:()=>library.open(),library:()=>library,
    header:()=>group()?{name:`${members().length} selected`,detail:'moving, turning and hiding together'}:sel?{name:current()?label(current()):nice(sel.target.label),detail:(editOfKey(sel.key)?describePropEdit(editOfKey(sel.key)):'from the film')}:null};
}
