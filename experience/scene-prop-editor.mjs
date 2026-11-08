import {cleanPropEdit,cleanAddEdit,isAddEdit,newAddId,propKey,effectivePropEdits,escapeRegex,propName,describePropEdit,studioSceneIds,writeSceneAssets} from './prop-edits.mjs';
import {createPropLibrary,deskItem} from './prop-library.mjs';
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
// A gizmo drag moves the live object at once (restored by __directorPropsRestore before film-fx re-installs).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r3=v=>Math.round(v*1000)/1000,r1=v=>Math.round(v*10)/10;
const wrapDeg=d=>{d=((d+180)%360+360)%360-180;return Math.abs(d)<1e-6?0:d;};
const MODES={translate:'Move',rotate:'Rotate',scale:'Scale'},VERB={translate:'Moved',rotate:'Rotated',scale:'Scaled'};
const STATE_KEY='ergoflex.sceneAssets.v1';
export function createScenePropEditor({bridge,shot,film,commit,status,open,rerender,onSelect=()=>{},lightsShowing=()=>false,fold=()=>{}}){
  let sel=null,mode='translate',tools=null,booting=null,drag=null,snapping=false,pending=null,dialogPlan=null,placing=false;
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
  // Every prop write: seeds shot.propEdits from the film's earlier-exported entries first (like camera keys).
  function write(key,next,text,{undoKey=null}={}){
    if(next&&!cleanPropEdit(next)&&!isNoopEdit(next)){status(`${CANT_SAVE}: ${UNUSUAL}`,true);rerender();return;}
    commit(()=>{const s=shot(),list=edits().filter(e=>propKey(e)!==key),clean=next&&cleanPropEdit(next);s.propEdits=clean?[...list,clean]:list;},{key:undoKey,render:false});
    status(text);rerender();
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
    const at=placement(entry),e=cleanAddEdit({add:{asset:entry.id},id:newAddId(),label:entry.name,parent:at.kind,position:at.position,rotation:at.rotation,scale:[1,1,1]});
    if(!e)throw Error(`${entry.name} can't be added (its library id is unusual).`);
    const key=propKey(e);write(key,e,`Added ${entry.name} ${at.kind==='desk'?'on the desk (it rides the lift and tilt)':'on the floor in front of the camera'}: W move · E rotate · T scale · Shift snaps · Delete removes it.`);
    sel={key,target:{match:e.match,label:e.label},obj:null};onSelect();rerender();
    return e;
  }
  const library=createPropLibrary({status,room:()=>shot()?.room,roomName:()=>shot()?.room,
    load:async()=>{await ensure();return (await win().__filmEdits.propLibrary()).index.props;},
    onPick:entry=>{addProp(entry).catch(error=>status(error.message,true));}});
  function current(){
    if(!sel)return null;if(sel.obj&&!inScene(sel.obj))sel.obj=null;
    if(!sel.obj&&tools)sel.obj=find(sel.key);return sel.obj;
  }
  // Installed Director entries by prop key (one scene walk, kept until film-fx re-installs or for 1 s).
  let found=null,foundAt=0;
  function installedIndex(){
    const scene=sceneOf();if(!scene)return new Map();if(found&&performance.now()-foundAt<1000)return found;
    found=new Map();foundAt=performance.now();scene.traverse(o=>{for(const e of o.userData.__filmFxEdits||[])if(e.director&&!found.has(propKey(e)))found.set(propKey(e),o);});return found;
  }
  function find(key){
    const scene=sceneOf();if(!scene)return null;const hit=installedIndex().get(key);if(hit&&inScene(hit))return hit;
    const e=editOfKey(key)||sel?.target;if(!e||!win()?.__filmEdits)return null;const f=win().__filmEdits.editTargets(e);return f.length===1?f[0]:null;
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
    gizmo.addEventListener('objectChange',()=>{const o=current();if(o&&sel?.blocked){status(`${CANT_SAVE}: ${sel.blocked} It goes back when you let go.`,true);return;}if(o)status((mode==='translate'?'Moving ':mode==='rotate'?'Rotating ':'Scaling ')+label(o)+'…'+(snapping?' (snapping)':' · Shift snaps'));});
    const raycaster=new THREE.Raycaster(),dom=t.renderer.domElement;let down=null;
    dom.addEventListener('pointerdown',ev=>{down=ev.button===0&&(placing||!gizmo.dragging&&!gizmo.axis)?{x:ev.clientX,y:ev.clientY,alt:ev.altKey}:null;},true);
    dom.addEventListener('pointerup',ev=>{
      const d=down;down=null;if(!d||ev.button!==0||Math.hypot(ev.clientX-d.x,ev.clientY-d.y)>5||gizmo.dragging||w.__directorDragging||lightsShowing()||!editing())return;
      const r=dom.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);
      if(placing){const now=current(),e=sel&&editOfKey(sel.key);placing=false;
        if(now&&isAddEdit(e)){const h=raycaster.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object)&&!isAncestor(now,h.object));if(h)placeAt(now,e,h.point);else{status('Nothing there to put it on.',true);rerender();}return;}}
      const hit=raycaster.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object));
      const now=current(),o=hit&&(d.alt&&now&&isAncestor(now,hit.object)?meaningful(hit.object,{above:now}):meaningful(hit.object));
      if(!o){if(sel){deselect();status('Nothing to edit there: click a prop (furniture, lamps, desk items). Esc deselects.');}return;}
      pick(o);
    },true);
    const keys=e=>{const on=e.shiftKey;if(on!==snapping){snapping=on;syncSnap();}};
    for(const doc of [document,w.document]){doc.addEventListener('keydown',keys,true);doc.addEventListener('keyup',keys,true);}
    // End: drop the selected prop onto the surface below it (Shift+End: drop flat, Alt+End: align to the surface).
    const endKey=e=>{if(e.key!=='End'||e.ctrlKey||e.metaKey||!sel||!editing()||lightsShowing()||e.target?.closest?.('input,select,textarea,[contenteditable],#director-timeline')||document.querySelector('dialog[open]'))return;
      e.preventDefault();e.stopPropagation();dropSelected(e.altKey?'align':e.shiftKey?'flat':'drop').catch(error=>status(error.message,true));};
    for(const doc of [document,w.document])doc.addEventListener('keydown',endKey,true);
    w.__directorPropsRestore=()=>{for(const [o,s] of snaps){o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.updateMatrixWorld(true);}snaps.clear();};
    tools={THREE,group,box,gizmo,t};syncSnap();requestAnimationFrame(tick);return tools;
  }
  const isAncestor=(a,o)=>{for(let p=o;p;p=p.parent)if(p===a)return true;return false;};
  const ensure=()=>booting||=boot().then(t=>{rerender();return t;},error=>{booting=null;throw error;});
  function syncSnap(){if(!tools)return;const g=tools.gizmo;g.setTranslationSnap(snapping?.05:null);g.setRotationSnap(snapping?tools.THREE.MathUtils.degToRad(15):null);g.setScaleSnap(snapping?.1:null);}
  function tick(){
    requestAnimationFrame(tick);if(!tools)return;muteStudioEditing();const {gizmo,box,t}=tools,live=editing(),o=live?current():null;
    if(o){box.setFromObject(o);box.visible=true;box.material.opacity=shown(o)?1:.45;if(gizmo.dragging)bridge.stage()?.wake?.(300);}else box.visible=false;
    if(o&&shown(o)&&!placing){if(gizmo.object!==o)gizmo.attach(o);gizmo.setMode(mode);gizmo.setSpace(mode==='scale'?'local':'world');gizmo.visible=gizmo.enabled=true;}
    else if(!gizmo.dragging){if(gizmo.object)gizmo.detach();gizmo.visible=gizmo.enabled=false;}
  }
  function startDrag(){const o=drag?.obj;if(!o)return;if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});drag.base=base(o);}
  function endDrag(){
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
  function pick(o){
    let target;try{target=filmEdit(o)?cleanPropEdit(filmEdit(o))||targetFor(o):targetFor(o);}catch(error){sel=null;onSelect();rerender();status(`${CANT_SAVE}: ${error.message}`,true);return;}
    const t={match:target.match,...(target.asset?{asset:target.asset}:{}),...(target.path?{path:target.path}:{}),...(target.near?{near:target.near}:{}),label:target.label||o.name||''};
    const blocked=isAddEdit(filmEdit(o))?'':unrecordable(o,t);
    sel={key:propKey(t),target:t,obj:o,blocked};onSelect();rerender();
    if(blocked){status(`${CANT_SAVE}: ${blocked} Moving ${label(o)} here won't be kept.`,true);return;}
    const moves=handMoves(o).length?' The film also places it by hand; your edit adds to that.':'';
    const added=isAddEdit(filmEdit(o));
    status(`${label(o)} selected · W move · E rotate · T scale · Shift snaps · ${added?'Delete removes it (added in this chapter)':'Delete hides it in this chapter'} · Alt-click picks what it sits on.${moves}`);
  }
  function select(key){
    if(!tools){ensure().then(()=>select(key)).catch(error=>status(error.message,true));return;}
    const e=editOfKey(key),o=find(key);if(!e&&!o)return;
    sel={key,target:e?{match:e.match,...(e.asset?{asset:e.asset}:{}),...(e.path?{path:e.path}:{}),...(e.near?{near:e.near}:{}),label:e.label}:sel?.target,obj:o};onSelect();rerender();
    status(o?`${label(o)} selected${o&&!shown(o)?' (hidden in this chapter: untick Hide to bring it back)':''}.`:`${e?.label?nice(e.label):'That prop'} is not in the room right now (the film setup did not find it).`,!o);
  }
  function deselect(){placing=false;if(!sel)return;sel=null;rerender();}
  // ---- edits from the inspector and keys
  function apply(change,text){
    const o=current();if(!sel)return;const e=editOfKey(sel.key)||{},next={...sel.target,...e,...change};
    for(const k of Object.keys(change))if(change[k]===undefined)delete next[k];
    write(sel.key,next,text);
  }
  function hide(on=true){
    const o=current();if(!sel)return false;if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return true;}
    if(isAddEdit(editOfKey(sel.key))){remove();return true;}const name=o?label(o):nice(sel.target.label),filmHides=o&&(o.userData.__filmFxEdits||[]).some(e=>!e.director&&e.hide);
    apply({hide:on?true:filmHides?false:undefined},on?`Hid ${name} in this chapter. Undo, or untick Hide in Props, brings it back.`:`Showed ${name} again.`);return true;
  }
  // An added prop: Delete, Reset to the film and Remove all take it out of the chapter (Undo brings it back).
  function remove(){if(!sel)return;const e=editOfKey(sel.key);if(!isAddEdit(e))return;const name=e.label||nice(e.match);write(sel.key,null,`Removed ${name} (added in this chapter). Undo brings it back.`);sel=null;rerender();}
  function reset(){if(!sel)return;if(isAddEdit(editOfKey(sel.key))){remove();return;}const name=sel.target.label?nice(sel.target.label):'The prop';if(!editOfKey(sel.key)){status(name+' is already where the film puts it.');return;}write(sel.key,null,`${name} back to the film.`);}
  function resetAll(){const n=editedCount();if(!n){status('No prop edits in this chapter: the props are the film\'s.');return;}const a=edits().filter(isAddEdit).length;commit(()=>{shot().propEdits=[];},{render:false});if(sel&&a)sel=null;status(`All props back to the film (${n} edit${n===1?'':'s'} cleared${a?`, ${a} added prop${a===1?'':'s'} removed`:''}). Undo brings them back.`);rerender();}
  async function changed(el){
    await ensure();const o=current();if(!sel||!o)return;const name=el.name,v=Number(el.value);
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
    const o=current();if(!o){status('That prop is not in the room right now.',true);return;}
    if(sel.blocked){status(`${CANT_SAVE}: ${sel.blocked}`,true);return;}
    if(!shown(o)){status(`${label(o)} is hidden in this chapter: untick Hide first.`,true);return;}
    const had=snaps.has(o),r=dropObject(o,dropMode);
    if(!r.ok){if(!had)snaps.delete(o);status(r.reason,true);rerender();return;}
    if(r.rests){if(!had)snaps.delete(o);status(r.text);return;}
    try{writeLive(o,r.base,r.text);}catch(error){status(error.message,true);}
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
    if(sel&&pending.keys.has(sel.key))sel=null;
    status(`Made ${rows.length} prop${rows.length===1?'':'s'} permanent in Studio (${sceneId}): ${rows.map(r=>r.name).join(', ')}. This chapter's edits for them are folded in; Export cut so the film follows.`);
    rerender();
  }
  // ---- inspector (Props tab)
  function panel(){
    if(!three()?.scene)return '<h3>Props</h3><p class="director-hint">Loading the chapter…</p>';
    const o=current(),e=sel&&editOfKey(sel.key),st=permanentState(),n=editedCount();
    const head=`<h3>Props</h3><p class="director-hint">Click a prop in the view to select it (not while Lights are shown). W move · E rotate · T scale · Shift snaps · Delete hides it. Edits stay in this chapter: Studio does not change.</p>
      <div class="director-actions"><button data-action="pp-add" class="prop-add-button" title="Add a model from the prop library: it goes on the desk or the floor in front of the camera, ready to move">+ Add prop</button><button data-action="pp-reset-all" ${n?'':'disabled'} title="Every prop back to the film in this chapter: one step, Undo brings them back">Reset all props to the film${n?' ('+n+')':''}</button><button data-action="pp-permanent" ${st.ok?'':'disabled'} title="${escape(st.ok?'Write these prop edits into Studio\'s room layout (you confirm each one)':st.why)}">Make permanent in Studio…</button></div>${st.ok?'':`<p class="director-hint" data-permanent-why>${escape(st.why)}</p>`}`;
    if(!sel)return head+'<p class="director-hint">No prop selected.</p>';
    if(!o)return head+`<div class="movement-inspector prop-inspector" data-reveal="prop"><h4 title="${escape(sel.target.label||'')}">${escape(nice(sel.target.label))}</h4><p class="director-hint">Not in the room right now (the film setup did not find it).</p><div class="director-actions"><button data-action="pp-reset" ${e?'':'disabled'}>Reset to the film</button></div></div>`;
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
      <label class="director-check"><input type="checkbox" name="pp-hide" ${hidden?'checked':''}>Hide in this chapter</label>
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
    if(name==='pp-reset-all'){resetAll();return;}
    if(name==='pp-permanent'){openPermanent();return;}
    if(name==='pp-reset'){reset();return;}
    if(name==='pp-parent'){const o=current(),p=o&&meaningful(o.parent);if(p)pick(p);return;}
    if(name.startsWith('pp-mode-')){setMode(name.slice(8));return;}
  }
  function setMode(m){if(!MODES[m])return;mode=m;rerender();status(`Gizmo: ${MODES[m].toLowerCase()}${sel?'':' (select a prop first)'}.`);}
  // Props lane: edited props as chips (hidden ones struck through), click to select; reset-all chip.
  function lane(){
    const list=edits();
    return `${list.map(e=>{const k=propKey(e),hiddenChip=e.hide===true,added=isAddEdit(e);return `<button class="lamp-chip prop-chip ${hiddenChip?'prop-hidden':''} ${added?'prop-added':''} ${sel?.key===k?'selected':''}" data-action="pp-pick" data-section="${escape(k)}" title="${escape((e.label||e.match)+' · '+describePropEdit(e))}${hiddenChip?' · click, then untick Hide to bring it back':''}${added?' · Delete removes it':''}">${added?'<b aria-label="added">+</b>':''}${escape(added?(e.label||propName(e.add.asset)):propName(e.label||e.match.replace(/^\^|\$$/g,'').replace(/\\/g,'')))}</button>`;}).join('')}${list.length?'<button class="lamp-chip lamp-reset" data-action="pp-reset-all" title="Every prop back to the film, added ones removed: one step, Undo brings them back">↺ Reset all props to the film</button>':'<span class="desk-lane-empty">Click a prop in the view to move, turn, scale or hide it in this chapter, or + Prop to add one</span>'}`;
  }
  // After film-fx (re)installs: objects may be new; folded-in props keep their Studio place on the stage.
  function applied(){
    found=null;if(sel?.obj&&!inScene(sel.obj))sel.obj=null;
    if(pending&&!edits().some(e=>pending.keys.has(propKey(e)))){
      // Added props: the chapter's copy is gone with its edit; Studio's own item stands in its place (as Studio loads it).
      for(const r of pending.rows.filter(r=>r.add)){const room=win()?.ErgoFlex?.workspaceRoom;room?.addAsset(r.add.propId,r.studioKey,r.add.position).then(obj=>{if(!obj)return;obj.position.copy(r.local.p);obj.quaternion.copy(r.local.q);obj.scale.copy(r.local.s);obj.updateMatrixWorld(true);bridge.stage()?.wake?.(300);}).catch(error=>console.warn('[props] Studio copy',error));}
      for(const r of pending.rows){const o=r.obj;if(r.add||!o||!inScene(o))continue;if(r.remove)o.removeFromParent();else{o.position.copy(r.local.p);o.quaternion.copy(r.local.q);o.scale.copy(r.local.s);o.updateMatrixWorld(true);}}
      pending=null;bridge.stage()?.wake?.(300);
    }
  }
  return {panel,lane,action,changed,select,deselect,hide,reset,setMode,applied,editedCount,ensure,
    selected:()=>sel?.key||null,selectedName:()=>sel?(current()?.name||sel.target.label):null,mode:()=>mode,
    addProp,dropSelected,dropObject,writeLive,openLibrary:()=>library.open(),library:()=>library,
    header:()=>sel?{name:current()?label(current()):nice(sel.target.label),detail:(editOfKey(sel.key)?describePropEdit(editOfKey(sel.key)):'from the film')}:null};
}
