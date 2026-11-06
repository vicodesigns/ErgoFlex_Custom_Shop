import {cleanPropEdit,propKey,effectivePropEdits,escapeRegex,propName,describePropEdit,studioSceneIds,writeSceneAssets} from './prop-edits.mjs';
// Director "Props": click a prop in the view (not in light mode) to select it, then move / rotate / scale it with
// the gizmo (W / E / T, Shift snaps) or the Prop inspector, hide it (Delete), reset it. Edits go to the chapter's
// cut shot (shot.propEdits, film sceneEdits format, prop-edits.mjs); film-fx applies them after the film's own
// sceneEdits on the live stage, in Render still and in the film. Studio is never written, except by
// "Make permanent in Studio…", which Vico confirms prop by prop.
// A gizmo drag moves the live object at once (restored by __directorPropsRestore before film-fx re-installs).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r3=v=>Math.round(v*1000)/1000,r1=v=>Math.round(v*10)/10;
const wrapDeg=d=>{d=((d+180)%360+360)%360-180;return Math.abs(d)<1e-6?0:d;};
const MODES={translate:'Move',rotate:'Rotate',scale:'Scale'},VERB={translate:'Moved',rotate:'Rotated',scale:'Scaled'};
const STATE_KEY='ergoflex.sceneAssets.v1';
export function createScenePropEditor({bridge,shot,film,commit,status,open,rerender,onSelect=()=>{},lightsShowing=()=>false,fold=()=>{}}){
  let sel=null,mode='translate',tools=null,booting=null,drag=null,snapping=false,pending=null,dialogPlan=null;
  const snaps=new Map(),frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow;
  const three=()=>bridge.stage()?.three?.();
  const editing=()=>open()&&bridge.ready()&&!bridge.playback().playing&&!bridge.bakeState().baking;
  const sceneOf=()=>three()?.scene||null;
  const label=o=>o?.name||'Unnamed prop';
  // ---- the cut
  const edits=()=>effectivePropEdits(film(),shot());
  const editOfKey=key=>edits().find(e=>propKey(e)===key)||null;
  const editedCount=()=>edits().length;
  // Every prop write: seeds shot.propEdits from the film's earlier-exported entries first (like camera keys).
  function write(key,next,text,{undoKey=null}={}){
    commit(()=>{const s=shot(),list=edits().filter(e=>propKey(e)!==key),clean=next&&cleanPropEdit(next);s.propEdits=clean?[...list,clean]:list;},{key:undoKey,render:false});
    status(text);rerender();
  }
  // ---- stage objects
  const filmEdit=o=>(o?.userData.__filmFxEdits||[]).filter(e=>e.director).at(-1)||null;
  const handMoves=o=>(o?.userData.__filmFxEdits||[]).filter(e=>!e.director&&(e.position||e.rotation||e.scale!==undefined));
  const pathOf=o=>{const scene=sceneOf(),out=[];for(let p=o;p&&p!==scene;p=p.parent)out.unshift(p.name||p.type);return out.join(' > ');};
  const inScene=o=>{const scene=sceneOf();for(let p=o;p;p=p.parent)if(p===scene)return true;return false;};
  const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const isOurs=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls||/^Cinematic effects$|^Film lights$/.test(p.name))return true;return false;};
  // The prop a click means: the innermost Studio scene asset or desk accessory, else the library prop (Prop:…).
  function meaningful(o,{above=null}={}){
    const scene=sceneOf(),desk=win()?.ErgoFlex?.loadedModel;let fallback=null,skipping=!!above;
    for(let p=o;p&&p!==scene;p=p.parent){
      if(p===desk)return null;
      if(skipping){if(p===above)skipping=false;continue;}
      if(p.userData?.sceneAsset||/^Accessory:/.test(p.name))return p;
      if(!fallback&&(/^Prop:/.test(p.name)||p.userData?.propId))fallback=p;
    }
    return skipping?null:fallback;
  }
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
  function base(o){
    const {THREE}=tools,E=filmEdit(o),st=installed(o);o.parent?.updateMatrixWorld(true);
    const world=st.position.clone();if(o.parent)o.parent.localToWorld(world);
    if(E?.position)world.sub(new THREE.Vector3(...E.position));
    const rot=st.rotation.clone();if(E?.rotation){rot.x-=THREE.MathUtils.degToRad(E.rotation[0]||0);rot.y-=THREE.MathUtils.degToRad(E.rotation[1]||0);rot.z-=THREE.MathUtils.degToRad(E.rotation[2]||0);}
    const scale=st.scale.clone();if(Array.isArray(E?.scale))scale.divide(new THREE.Vector3(...E.scale));else if(Number.isFinite(E?.scale))scale.divideScalar(E.scale);
    return {world,rot,scale};
  }
  // An edit from the prop's state now (after a drag or typed numbers) relative to base().
  // Turns: of the two Euler triples for the same rotation, the one nearest the film's (a turn about y stays a turn
  // about y, not ±180° on x and z). Scale: kept between ×0.01 and ×100, never mirrored.
  function editFrom(o,b,{world,rot,scale}={}){
    const {THREE}=tools,w=world||o.getWorldPosition(new THREE.Vector3()),r=rot||o.rotation,s=scale||o.scale,deg=THREE.MathUtils.radToDeg;
    const [a0,a1,a2]=(r.order||'XYZ').toLowerCase().split(''),alt={[a0]:r[a0]+Math.PI,[a1]:Math.PI-r[a1],[a2]:r[a2]+Math.PI};
    const turn=e=>['x','y','z'].map(k=>wrapDeg(deg(e[k]-b.rot[k]))),plain=turn(r),other=turn(alt),size=t=>t.reduce((n,v)=>n+Math.abs(v),0);
    const clamp=v=>Math.round(Math.min(100,Math.max(.01,Math.abs(v)))*1e4)/1e4;
    return {position:w.clone().sub(b.world).toArray().map(r3),rotation:(size(other)<size(plain)-1e-6?other:plain).map(r1),scale:[s.x/b.scale.x,s.y/b.scale.y,s.z/b.scale.z].map(clamp)};
  }
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
    const {THREE,TransformControls}=w.__directorThree,group=new THREE.Group();group.name='Director prop tools';group.userData.directorTools=true;t.scene.add(group);
    const box=new THREE.BoxHelper(undefined,0x63d8f5);box.material.depthTest=false;box.material.transparent=true;box.renderOrder=998;box.visible=false;group.add(box);
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;gizmo.setSize(1.35);gizmo.setSpace('world');gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    gizmo.addEventListener('dragging-changed',ev=>{w.__directorDragging=ev.value;if(ev.value){drag={enabled:t.controls.enabled,obj:gizmo.object};t.controls.enabled=false;startDrag();}else{t.controls.enabled=drag?.enabled??true;endDrag();}});
    gizmo.addEventListener('objectChange',()=>{const o=current();if(o)status((mode==='translate'?'Moving ':mode==='rotate'?'Rotating ':'Scaling ')+label(o)+'…'+(snapping?' (snapping)':' · Shift snaps'));});
    const raycaster=new THREE.Raycaster(),dom=t.renderer.domElement;let down=null;
    dom.addEventListener('pointerdown',ev=>{down=ev.button===0&&!gizmo.dragging&&!gizmo.axis?{x:ev.clientX,y:ev.clientY,alt:ev.altKey}:null;},true);
    dom.addEventListener('pointerup',ev=>{
      const d=down;down=null;if(!d||ev.button!==0||Math.hypot(ev.clientX-d.x,ev.clientY-d.y)>5||gizmo.dragging||w.__directorDragging||lightsShowing()||!editing())return;
      const r=dom.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);
      const hit=raycaster.intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object));
      const now=current(),o=hit&&(d.alt&&now&&isAncestor(now,hit.object)?meaningful(hit.object,{above:now}):meaningful(hit.object));
      if(!o){if(sel){deselect();status('Nothing to edit there: click a prop (furniture, lamps, desk items). Esc deselects.');}return;}
      pick(o);
    },true);
    const keys=e=>{const on=e.shiftKey;if(on!==snapping){snapping=on;syncSnap();}};
    for(const doc of [document,w.document]){doc.addEventListener('keydown',keys,true);doc.addEventListener('keyup',keys,true);}
    w.__directorPropsRestore=()=>{for(const [o,s] of snaps){o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.updateMatrixWorld(true);}snaps.clear();};
    tools={THREE,group,box,gizmo,t};syncSnap();requestAnimationFrame(tick);return tools;
  }
  const isAncestor=(a,o)=>{for(let p=o;p;p=p.parent)if(p===a)return true;return false;};
  const ensure=()=>booting||=boot().then(t=>{rerender();return t;},error=>{booting=null;throw error;});
  function syncSnap(){if(!tools)return;const g=tools.gizmo;g.setTranslationSnap(snapping?.05:null);g.setRotationSnap(snapping?tools.THREE.MathUtils.degToRad(15):null);g.setScaleSnap(snapping?.1:null);}
  function tick(){
    requestAnimationFrame(tick);if(!tools)return;const {gizmo,box,t}=tools,live=editing(),o=live?current():null;
    if(o){box.setFromObject(o);box.visible=true;box.material.opacity=shown(o)?1:.45;if(gizmo.dragging)bridge.stage()?.wake?.(300);}else box.visible=false;
    if(o&&shown(o)){if(gizmo.object!==o)gizmo.attach(o);gizmo.setMode(mode);gizmo.setSpace(mode==='scale'?'local':'world');gizmo.visible=gizmo.enabled=true;}
    else if(!gizmo.dragging){if(gizmo.object)gizmo.detach();gizmo.visible=gizmo.enabled=false;}
  }
  function startDrag(){const o=drag?.obj;if(!o)return;if(!snaps.has(o))snaps.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});drag.base=base(o);}
  function endDrag(){
    const o=drag?.obj,b=drag?.base;drag=null;if(!o||!b||!sel)return;
    try{const e=editOfKey(sel.key)||sel.target,next={...sel.target,...(e||{}),...editFrom(o,b)};
      if(JSON.stringify(cleanPropEdit(next))===JSON.stringify(e?cleanPropEdit(e):null)){status(label(o)+' did not move.');return;}
      write(sel.key,next,`${VERB[mode]} ${label(o)}. Undo puts it back; Render still shows the film look.`);}
    catch(error){status(error.message,true);}
  }
  // ---- selection
  function pick(o){
    let target;try{target=filmEdit(o)?cleanPropEdit(filmEdit(o))||targetFor(o):targetFor(o);}catch(error){status(error.message,true);return;}
    const t={match:target.match,...(target.asset?{asset:target.asset}:{}),...(target.path?{path:target.path}:{}),...(target.near?{near:target.near}:{}),label:target.label||label(o)};
    sel={key:propKey(t),target:t,obj:o};onSelect();rerender();
    const moves=handMoves(o).length?' The film also places it by hand; your edit adds to that.':'';
    status(`${label(o)} selected · W move · E rotate · T scale · Shift snaps · Delete hides it in this chapter · Alt-click picks what it sits on.${moves}`);
  }
  function select(key){
    if(!tools){ensure().then(()=>select(key)).catch(error=>status(error.message,true));return;}
    const e=editOfKey(key),o=find(key);if(!e&&!o)return;
    sel={key,target:e?{match:e.match,...(e.asset?{asset:e.asset}:{}),...(e.path?{path:e.path}:{}),...(e.near?{near:e.near}:{}),label:e.label}:sel?.target,obj:o};onSelect();rerender();
    status(o?`${label(o)} selected${o&&!shown(o)?' (hidden in this chapter: untick Hide to bring it back)':''}.`:`${e?.label||'That prop'} is not in the room right now (the film setup did not find it).`,!o);
  }
  function deselect(){if(!sel)return;sel=null;rerender();}
  // ---- edits from the inspector and keys
  function apply(change,text){
    const o=current();if(!sel)return;const e=editOfKey(sel.key)||{},next={...sel.target,...e,...change};
    for(const k of Object.keys(change))if(change[k]===undefined)delete next[k];
    write(sel.key,next,text);
  }
  function hide(on=true){
    const o=current();if(!sel)return false;const name=o?label(o):sel.target.label,filmHides=o&&(o.userData.__filmFxEdits||[]).some(e=>!e.director&&e.hide);
    apply({hide:on?true:filmHides?false:undefined},on?`Hid ${name} in this chapter. Undo, or untick Hide in Props, brings it back.`:`Showed ${name} again.`);return true;
  }
  function reset(){if(!sel)return;const name=sel.target.label||'The prop';if(!editOfKey(sel.key)){status(name+' is already where the film puts it.');return;}write(sel.key,null,`${name} back to the film.`);}
  function resetAll(){const n=editedCount();if(!n){status('No prop edits in this chapter: the props are the film\'s.');return;}commit(()=>{shot().propEdits=[];},{render:false});status(`All props back to the film (${n} edit${n===1?'':'s'} cleared). Undo brings them back.`);rerender();}
  async function changed(el){
    await ensure();const o=current();if(!sel||!o)return;const name=el.name,v=Number(el.value);
    if(name==='pp-hide'){hide(el.checked);return;}
    if(el.value===''||!Number.isFinite(v))throw Error('Enter a number.');
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
    return edits().map(e=>{
      const key=propKey(e),o=tools&&find(key),name=e.label||o?.name||'Prop',row={edit:e,key,name,change:describePropEdit(e),obj:o};
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
      <ul class="prop-permanent-list">${st.rows.map((r,i)=>`<li class="${r.ok?'':'blocked'}"><label class="director-check"><input type="checkbox" data-permanent="${i}" ${r.ok?'checked':'disabled'}><span><b>${escape(r.name)}</b> · ${escape(r.change)}${r.ok?'':`<small>${escape(r.why)}</small>`}</span></label></li>`).join('')}</ul>
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
    const base=(await got.json()).values?.[STATE_KEY]??null,value=writeSceneAssets(base,sceneId,rows.map(r=>({editorId:r.editorId,...(r.remove?{remove:true}:{transform:r.transform})})));
    const posted=await fetch('/api/studio-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client:sync?.client||'director-'+Math.random().toString(36).slice(2,10),by:'Director',changes:[{key:STATE_KEY,value,base}]})});
    if(!posted.ok)throw Error(`Studio did not take the change (${posted.status}).`);const result=(await posted.json()).results?.[0];if(!result||result.skipped||result.error)throw Error('Studio did not take the change: '+(result?.skipped||result?.error||'no answer'));
    // This page's copy of the shared state (no second write: the sync script sees it as its own base) and the stage's memory.
    try{const stored=(await (await fetch('/api/studio-state',{cache:'no-store'})).json()).values?.[STATE_KEY];if(stored){sync?.base?.set(STATE_KEY,stored);localStorage.setItem(STATE_KEY,stored);}}catch{}
    const mem=api.sceneAssetStates.get(sceneId);
    for(const r of rows){if(!mem)break;if(r.remove){const a=mem.added;if(a?.has?.(r.editorId)){a.delete(r.editorId);mem.transforms.delete(r.editorId);}else mem.removed.add(r.editorId);}else mem.transforms.set(r.editorId,r.transform);}
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
      <div class="director-actions"><button data-action="pp-reset-all" ${n?'':'disabled'} title="Every prop back to the film in this chapter: one step, Undo brings them back">Reset all props to the film${n?' ('+n+')':''}</button><button data-action="pp-permanent" ${st.ok?'':'disabled'} title="${escape(st.ok?'Write these prop edits into Studio\'s room layout (you confirm each one)':st.why)}">Make permanent in Studio…</button></div>${st.ok?'':`<p class="director-hint" data-permanent-why>${escape(st.why)}</p>`}`;
    if(!sel)return head+'<p class="director-hint">No prop selected.</p>';
    if(!o)return head+`<div class="movement-inspector prop-inspector" data-reveal="prop"><h4>${escape(sel.target.label||'Prop')}</h4><p class="director-hint">Not in the room right now (the film setup did not find it).</p><div class="director-actions"><button data-action="pp-reset" ${e?'':'disabled'}>Reset to the film</button></div></div>`;
    if(!tools)return head;const b=base(o),{THREE}=tools,pos=o.getWorldPosition(new THREE.Vector3()).toArray(),turn=e?.rotation||[0,0,0],fac=e?.scale||[1,1,1],uniform=Math.abs(fac[0]-fac[1])<1e-4&&Math.abs(fac[1]-fac[2])<1e-4;
    const num=(name,text,value,step,extra='')=>`<label>${text}<input name="${name}" type="number" step="${step}" value="${value}" ${extra}></label>`;
    const studio=plan().find(r=>r.key===sel.key),hidden=e?.hide===true||!shown(o),moved=b?o.getWorldPosition(new THREE.Vector3()).distanceTo(b.world):0;
    return head+`<div class="movement-inspector prop-inspector" data-reveal="prop"><h4>${escape(propName(o.name))}</h4><p class="director-hint prop-name">${escape(o.name||'Unnamed')}${o.userData.sceneAssetKey?' · Studio item':''}</p>
      <div class="director-actions prop-modes">${Object.entries(MODES).map(([m,t])=>`<button data-action="pp-mode-${m}" aria-pressed="${mode===m}" title="${t} (${m==='translate'?'W':m==='rotate'?'E':'T'})">${t}</button>`).join('')}${meaningful(o.parent||o)?'<button data-action="pp-parent" title="Select what it sits on (Alt-click in the view)">Select what it sits on</button>':''}</div>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-p'+k,'Position '+k+' (m)',r3(pos[i]),.01)).join('')}</div>${e?.position?`<p class="director-hint">Moved ${r3(moved)} m from the film's place.</p>`:''}
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-r'+k,'Turn '+k+' (°)',r1(turn[i]),1)).join('')}</div>
      <label>Scale ×<input name="pp-s" type="number" min=".01" max="100" step=".05" value="${uniform?Number(fac[0].toFixed(3)):''}" placeholder="mixed"></label>
      <div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('pp-s'+k,'Scale '+k+' ×',Number(fac[i].toFixed(3)),.05,'min=".01" max="100"')).join('')}</div>
      <label class="director-check"><input type="checkbox" name="pp-hide" ${hidden?'checked':''}>Hide in this chapter</label>
      <div class="director-actions"><button data-action="pp-reset" ${e?'':'disabled'} title="This prop back to where the film puts it">Reset to the film</button></div>
      <p class="director-hint" data-studio-note>${studio?(studio.ok?'Studio: can be made permanent.':'Studio: '+escape(studio.why)):'Studio: unchanged (edit the prop to make it permanent later).'}</p></div>`;
  }
  async function action(name,arg){
    await ensure();
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
    return `${list.map(e=>{const k=propKey(e),hiddenChip=e.hide===true;return `<button class="lamp-chip prop-chip ${hiddenChip?'prop-hidden':''} ${sel?.key===k?'selected':''}" data-action="pp-pick" data-section="${escape(k)}" title="${escape((e.label||e.match)+' · '+describePropEdit(e))}${hiddenChip?' · click, then untick Hide to bring it back':''}">${escape(propName(e.label||e.match.replace(/^\^|\$$/g,'').replace(/\\/g,'')))}</button>`;}).join('')}${list.length?'<button class="lamp-chip lamp-reset" data-action="pp-reset-all" title="Every prop back to the film: one step, Undo brings them back">↺ Reset all props to the film</button>':'<span class="desk-lane-empty">Click a prop in the view to move, turn, scale or hide it in this chapter</span>'}`;
  }
  // After film-fx (re)installs: objects may be new; folded-in props keep their Studio place on the stage.
  function applied(){
    found=null;if(sel?.obj&&!inScene(sel.obj))sel.obj=null;
    if(pending&&!edits().some(e=>pending.keys.has(propKey(e)))){
      for(const r of pending.rows){const o=r.obj;if(!o||!inScene(o))continue;if(r.remove)o.removeFromParent();else{o.position.copy(r.local.p);o.quaternion.copy(r.local.q);o.scale.copy(r.local.s);o.updateMatrixWorld(true);}}
      pending=null;bridge.stage()?.wake?.(300);
    }
  }
  return {panel,lane,action,changed,select,deselect,hide,reset,setMode,applied,editedCount,ensure,
    selected:()=>sel?.key||null,selectedName:()=>sel?(current()?.name||sel.target.label):null,mode:()=>mode,
    header:()=>sel?{name:propName(current()?.name||sel.target.label),detail:(editOfKey(sel.key)?describePropEdit(editOfKey(sel.key)):'from the film')}:null};
}
