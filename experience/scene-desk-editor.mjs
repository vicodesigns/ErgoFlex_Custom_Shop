import {cleanDeskEdit,effectiveDeskEdits,describeDeskEdit} from './desk-edits.mjs';
import {clampStartPose,startPoseLimits,START_PRESETS} from './start-pose.mjs';
// Director "Desks": every ErgoFlex desk in the room, not only the featured one (the chapter's hero desk, edited in the
// Groove tab). Select a desk in the Desks list or by clicking it in the view; its panel sets Size (48″ / 60″), Position
// X / Z in inches, Rotate in degrees, the starting Height and Tilt (start-pose.mjs clamps them to the real desk), and
// Reset desk. Edits go to the chapter's cut shot (shot.deskEdits, experience/desk-edits.mjs); film-fx applies them to the
// live stage, Render still and the film as the film shot's sceneDeskEdits. Studio is never written.
// Selecting the featured desk (list, click, Esc, empty click) leaves the desk selection: the Groove tab is its editor.
// The view: a teal box and floor footprint on the selected desk, and a round handle under it: drag it on the floor to
// move the desk (the numbers follow). Clicks reach this editor before the Props editor (a window capture listener on the
// stage): a click on a bare desk selects it; a click on something riding the desk (monitor, plant, a dressing item) is
// the Props editor's unless the Desks tab is open. Studio's own click editing is off in the Director (as for props).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r1=v=>Math.round(v*10)/10,IN=25.4,rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const wrapDeg=d=>{d=((d%360)+540)%360-180;return Math.abs(d)<1e-9?0:d;};
const sizeLabel=s=>s?String(s).slice(0,2)+'″':'';
const MUTED=Symbol('director-desks');
export function createSceneDeskEditor({bridge,shot,film,commit,status,open,rerender,onSelect=()=>{},onPick=()=>{},lightsShowing=()=>false,inTab=()=>false,showFeatured=()=>{}}){
  let sel=null,tools=null,booting=null,drag=null,gesture=0,shotId=null;
  const frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow;
  const api=()=>win()?.ErgoFlex,desks=()=>api()?.sceneDesks,three=()=>bridge.stage()?.three?.();
  const editing=()=>open()&&bridge.ready()&&!bridge.playback().playing&&!bridge.bakeState().baking;
  const records=()=>[...(desks()?.records?.values()||[])],rec=id=>desks()?.records?.get(id)||null;
  const featured=()=>desks()?.selected??null;
  // A chapter change forgets the selection (the stage is another room).
  // Every change of the selected room desk goes through onPick(id | null) (null = the featured desk): director.mjs selectRoomDesk.
  const sync=()=>{const id=shot()?.id,had=sel;if(id!==shotId){shotId=id;sel=null;}if(sel&&(!rec(sel)||sel===featured()))sel=null;if(had&&!sel)onPick(null);return sel;};
  const edits=()=>effectiveDeskEdits(film(),shot());
  const editOf=id=>edits().find(e=>e.desk===id)||null;
  const editedCount=()=>edits().length;
  const name=r=>r?.state?.name||'ErgoFlex desk';
  // What the desk is now (its edit, else the film's own): the panel's numbers.
  const was=r=>r?.deskEditWas?.state||r?.state;
  function view(id){
    const r=rec(id),e=editOf(id)||{},s=r.state;
    return {size:e.size||s.size,pose:e.pose||s.pose,initial:e.initial||{height:s.height,tilt:s.tilt}};
  }
  // Every desk write: one undo step per click / typed value (a slider drag shares its key).
  function put(id,patch,text,{key=null}={}){
    const r=rec(id);if(!r)return;
    const next={...(editOf(id)||{}),desk:id,name:name(r),...patch};
    if(next.size&&next.size===was(r)?.size&&!next.initial)delete next.size;   // back at its own size: no change to keep
    const clean=cleanDeskEdit(next);
    commit(()=>{const s=shot(),list=edits().filter(e=>e.desk!==id);s.deskEdits=clean?[...list,clean]:list;},{key,render:false});
    status(text);rerender();
  }
  // ---- selection
  function select(id,{announce=true}={}){
    sync();const r=rec(id);if(!r)return;
    if(id===featured()){const had=!!sel;sel=null;if(had){rerender();onPick(null);}showFeatured();status('Featured desk selected: its moves and starting position are in the Groove tab.');return;}
    sel=id;onSelect();onPick(id);rerender();ensure().catch(e=>console.warn("[desk tools]",e));
    if(announce)status(`${name(r)} selected · ${sizeLabel(view(id).size)} · drag the round handle under it to move it · Esc goes back to the featured desk.`);
  }
  function deselect(){if(!sel)return;sel=null;onPick(null);rerender();}
  const selected=()=>sync();
  function header(){const id=sync();if(!id)return null;const r=rec(id),e=editOf(id);return {name:name(r),detail:e?describeDeskEdit(e,was(r)):sizeLabel(r.state.size)+' · as the film has it'};}
  // ---- reading the stage
  const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const isOurs=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools||p.userData?.filmFx||p.isTransformControls||/^Cinematic effects$|^Film lights$/.test(p.name))return true;return false;};
  // Studio's room editing (click-drag of desks and furnishings) is off in the Director, as the Props editor does it.
  function muteStudio(){
    const a=api();if(!a)return;const ri=a.roomInteractions;
    if(ri&&!ri[MUTED]){ri[MUTED]=true;try{ri.end?.();ri.select?.(null);}catch{}ri.enabled=()=>false;}
    const ctx=a.sceneDesks?.ctx;if(ctx&&!ctx[MUTED]){ctx[MUTED]=true;try{a.sceneDesks.objects?.endDrag?.();}catch{}ctx.objectsEditable=()=>false;ctx.rearrange=()=>false;}
  }
  // The desk under a click: {id, onItem} | {featured:true, onItem} | null.
  function deskAt(hit){
    const a=api(),model=a?.loadedModel;let onItem=false;
    for(let p=hit.object;p;p=p.parent){
      if(p===model)return {featured:true,onItem};
      if(p.userData?.sceneDeskId&&rec(p.userData.sceneDeskId))return {id:p.userData.sceneDeskId,onItem};
      if(p.userData?.directorAdd||p.userData?.sceneAsset||p.userData?.dayKit||/^Accessory:|^(Scene dressing|Accessory mount|Desk dressing):|:(desktop|shelf|lower-shelf|base-shelf)$/.test(p.name||''))onItem=true;
    }
    return null;
  }
  // ---- stage tools: selection box, footprint, move handle, picking
  async function boot(){
    const w=win(),t=three();if(!t)throw Error('The stage is still loading.');
    // Our own callbacks: the Props and Lights editors boot the same module with shared names, and a second booter would orphan the first.
    if(!w.__directorThree)await new Promise((resolve,reject)=>{w.__dirThreeDoneDesk=resolve;w.__dirThreeFailDesk=reject;const s=w.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree=window.__directorThree||{THREE:T,TransformControls:C.TransformControls};window.__dirThreeDoneDesk();},e=>window.__dirThreeFailDesk(e));";w.document.head.append(s);});
    muteStudio();
    const {THREE}=w.__directorThree,group=new THREE.Group();group.name='Director desk tools';group.userData.directorTools=true;group.visible=false;t.scene.add(group);
    const COLOR=0x45cfac,box=new THREE.BoxHelper(undefined,COLOR);box.material.depthTest=false;box.material.transparent=true;box.renderOrder=998;group.add(box);
    const mat=(opacity)=>new THREE.MeshBasicMaterial({color:COLOR,transparent:true,opacity,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    const foot=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat(.16));foot.rotation.x=-Math.PI/2;foot.renderOrder=996;foot.userData.directorTools=true;group.add(foot);
    const handle=new THREE.Group();handle.userData.directorTools=true;handle.renderOrder=999;
    const disc=new THREE.Mesh(new THREE.CircleGeometry(.16,40),mat(.55)),ring=new THREE.Mesh(new THREE.RingGeometry(.16,.2,40),mat(1));
    for(const m of [disc,ring]){m.rotation.x=-Math.PI/2;m.renderOrder=999;m.userData.directorTools=true;handle.add(m);}
    group.add(handle);
    const ray=new THREE.Raycaster(),dom=t.renderer.domElement;let down=null;
    const pointer=ev=>{const r=dom.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);return ray;};
    const onHandle=ev=>{if(!group.visible)return false;return pointer(ev).intersectObject(disc,false).length>0||ray.intersectObject(ring,false).length>0;};
    w.addEventListener('pointerdown',ev=>{
      down=null;if(ev.button!==0||!editing()||w.__directorDragging)return;
      if(sel&&onHandle(ev)){startDrag(ev);ev.stopImmediatePropagation();ev.preventDefault();return;}
      down={x:ev.clientX,y:ev.clientY};
    },true);
    w.addEventListener('pointermove',ev=>{if(drag&&ev.pointerId===drag.pointer){moveDrag(ev);ev.stopImmediatePropagation();ev.preventDefault();}},true);
    w.addEventListener('pointerup',ev=>{
      if(drag&&ev.pointerId===drag.pointer){endDrag(ev);ev.stopImmediatePropagation();ev.preventDefault();return;}
      const d=down;down=null;if(!d||ev.button!==0||Math.hypot(ev.clientX-d.x,ev.clientY-d.y)>5||w.__directorDragging||lightsShowing()||!editing())return;
      if(ev.target!==dom)return;
      const hit=pointer(ev).intersectObject(t.scene,true).find(h=>h.object.isMesh&&shown(h.object)&&!isOurs(h.object)&&!h.object.material?.isShaderMaterial);
      const at=hit&&deskAt(hit);
      if(at&&(!at.onItem||inTab())&&(at.id||sel||inTab())){ev.stopImmediatePropagation();ev.preventDefault();select(at.id||featured());return;}
      if(sel&&!at?.id){deselect();status('Back to the featured desk. Click a desk to edit it.');}
    },true);
    w.addEventListener('pointercancel',ev=>{if(drag&&ev.pointerId===drag.pointer)endDrag(ev,true);},true);
    tools={THREE,group,box,foot,handle,ray,pointer,scene:t.scene,t};requestAnimationFrame(tick);return tools;
  }
  const ensure=()=>booting||=boot().then(t=>t,error=>{booting=null;throw error;});
  function tick(){
    requestAnimationFrame(tick);if(!tools)return;
    const t=three();if(!t||t.scene!==tools.scene){tools.group.removeFromParent();tools=null;booting=null;if(t&&open())ensure().catch(e=>console.warn("[desk tools]",e));return;}
    muteStudio();
    const id=sync(),r=id&&editing()?rec(id):null,{group,box,foot,handle,THREE}=tools;
    if(!r?.group){group.visible=false;return;}
    group.visible=true;r.group.updateMatrixWorld(true);box.setFromObject(r.group);
    const b=new THREE.Box3().setFromObject(r.group),c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()),y=b.min.y+.004;
    foot.position.set(c.x,y,c.z);foot.scale.set(Math.max(.3,s.x),Math.max(.3,s.z),1);
    handle.position.set(c.x,y+.002,c.z);
    if(drag)bridge.stage()?.wake?.(300);
  }
  // ---- dragging the handle: the desk follows the floor point; the edit is written when the pointer lets go
  function startDrag(ev){
    const r=rec(sel),{THREE,t,ray,group}=tools;if(!r?.group)return;
    const y=r.group.getWorldPosition(new THREE.Vector3()).y,plane=new THREE.Plane(new THREE.Vector3(0,1,0),-y),point=new THREE.Vector3();
    if(!ray.ray.intersectPlane(plane,point))return;
    const w=win();w.__directorDragging=true;
    drag={pointer:ev.pointerId,id:sel,plane,last:point.clone(),controls:t.controls.enabled,changed:false,start:{x:r.state.pose.x,z:r.state.pose.z}};
    t.controls.enabled=false;try{t.renderer.domElement.setPointerCapture(ev.pointerId);}catch{}
    status(`Moving ${name(r)}…`);
  }
  function moveDrag(ev){
    const {THREE,ray,pointer}=tools,r=rec(drag.id);if(!r?.group)return;pointer(ev);
    const point=new THREE.Vector3();if(!ray.ray.intersectPlane(drag.plane,point))return;
    const parent=r.group.parent;if(!parent)return;parent.updateWorldMatrix(true,false);
    const a=parent.worldToLocal(drag.last.clone()),b=parent.worldToLocal(point.clone());
    r.group.position.x+=b.x-a.x;r.group.position.z+=b.z-a.z;r.group.updateMatrixWorld(true);drag.last.copy(point);drag.changed=true;
    r.state.pose={x:r.group.position.x,z:r.group.position.z,yaw:r.group.rotation.y};
    status(`Moving ${name(r)}: x ${r1(r.state.pose.x/IN)}″, z ${r1(r.state.pose.z/IN)}″.`);
  }
  function endDrag(ev,cancel=false){
    const d=drag;drag=null;if(!d)return;const {t}=tools,w=win();
    try{t.renderer.domElement.releasePointerCapture(d.pointer);}catch{}
    t.controls.enabled=d.controls;w.__directorDragging=false;
    const r=rec(d.id);if(!r)return;
    if(cancel||!d.changed){r.state.pose={x:d.start.x,z:d.start.z,yaw:r.state.pose.yaw};desks()?.place(r);return;}
    const p=r.state.pose;
    put(d.id,{pose:{x:Math.round(p.x*10)/10,z:Math.round(p.z*10)/10,yaw:p.yaw}},`${name(r)} moved to x ${r1(p.x/IN)}″, z ${r1(p.z/IN)}″.`);
  }
  // ---- the panel's controls
  function nudge(id,axis,by){
    const v=view(id),p=v.pose;
    if(axis==='yaw')return put(id,{pose:{...p,yaw:rad(wrapDeg(deg(p.yaw)+by))}},`Turned ${by>0?'+':''}${by}°.`);
    put(id,{pose:{...p,[axis]:p[axis]+by*IN}},`Moved ${by>0?'+':''}${by}″ ${axis==='x'?'along x':'along z'}.`);
  }
  function setSize(id,size){
    const r=rec(id),v=view(id);if(!r||v.size===size)return;
    const e=editOf(id),next={size};
    if(e?.initial)next.initial=clampStartPose(e.initial,size);
    put(id,next,`${name(r)}: ${sizeLabel(size)} desk.`);
  }
  function setStart(id,field,value,{key=null,text=true}={}){
    const r=rec(id),v=view(id),p=clampStartPose({...v.initial,[field]:value},v.size,field);
    put(id,{initial:p},`${name(r)} starts at ${p.height}″, ${p.tilt}°.`,{key});return p;
  }
  function reset(id=sel){
    const r=rec(id);if(!r)return;if(!editOf(id)){status(`${name(r)} is already as the film has it.`);return;}
    commit(()=>{shot().deskEdits=edits().filter(e=>e.desk!==id);},{render:false});status(`${name(r)} is back as the film has it.`);rerender();
  }
  function resetAll(){
    const n=editedCount();if(!n){status('No desk edits in this chapter: the desks are the film\'s.');return;}
    commit(()=>{shot().deskEdits=[];},{render:false});status('All desks back to the film in this chapter.');rerender();
  }
  async function action(act,arg){
    sync();
    if(act==='dk-select'){select(String(arg));return;}
    if(act==='dk-featured'){if(sel)onPick(null);sel=null;rerender();showFeatured();status('Featured desk: its moves and starting position are in the Groove tab.');return;}
    if(act==='dk-reset-all'){resetAll();return;}
    if(!sel)return;
    if(act==='dk-size'){setSize(sel,String(arg));return;}
    if(act==='dk-nudge'){const [axis,by]=String(arg).split(':');nudge(sel,axis,Number(by));return;}
    if(act==='dk-preset'){const p=START_PRESETS[arg];if(p){const v=view(sel),c=clampStartPose(p,v.size);put(sel,{initial:c},`${name(rec(sel))} starts ${arg==='sitting'?'sitting':'standing'}: ${c.height}″, ${c.tilt}°.`);}return;}
    if(act==='dk-reset'){reset();return;}
  }
  function changed(el,{live=false}={}){
    if(!sel)return;const n=el.name,v=Number(el.value);if(el.value===''||!Number.isFinite(v)){rerender();return;}
    const pose=view(sel).pose;
    if(n==='dk-x'||n==='dk-z'){const k=n==='dk-x'?'x':'z';put(sel,{pose:{...pose,[k]:v*IN}},`${k==='x'?'x':'z'} ${r1(v)}″.`);return;}
    if(n==='dk-yaw'){put(sel,{pose:{...pose,yaw:rad(wrapDeg(v))}},`Turned to ${r1(wrapDeg(v))}°.`);return;}
    if(/^dk-(height|tilt)(-n)?$/.test(n)){
      const f=n.startsWith('dk-height')?'height':'tilt',p=setStart(sel,f,v,{key:live?'desk-start-'+gesture:null});
      if(live)showStart(p);return;
    }
  }
  const showStart=p=>{const box=document.getElementById('director-panel');if(!box)return;for(const [n,val] of [['dk-height',p.height],['dk-height-n',p.height],['dk-tilt',p.tilt],['dk-tilt-n',p.tilt]]){const el=box.querySelector(`[name="${n}"]`);if(el&&document.activeElement!==el)el.value=String(val);}};
  document.addEventListener('pointerdown',ev=>{if(ev.target.closest?.('[name="dk-height"],[name="dk-tilt"]'))gesture++;},true);
  // ---- the inspector
  function panel(){
    sync();
    const list=records();
    if(!three()?.scene||!list.length)return `<h3>Desks</h3><p class="director-hint">${three()?.scene?'This room has no ErgoFlex desks other than the featured one.':'Loading the chapter…'}</p>`;
    const n=editedCount(),fid=featured();
    const rows=list.map(r=>{
      const e=editOf(r.id),isF=r.id===fid,on=r.id===sel;
      return `<li><button data-action="${isF?'dk-featured':'dk-select'}" data-section="${escape(r.id)}" class="desk-row ${isF?'is-featured':''} ${e?'is-edited':''}" aria-pressed="${on}" title="${escape(r.id)}"><span class="desk-star">${isF?'★':e?'●':'○'}</span><span class="desk-name">${escape(name(r))}</span><small>${sizeLabel(r.state.size)}${isF?' · featured desk':e?' · edited':''}</small></button></li>`;
    }).join('');
    const head=`<h3>Desks</h3><p class="director-hint">Click a desk in the view, or pick one here. The featured desk (★) is the chapter's hero desk: its moves and starting position are in the Groove tab. Edits stay in this chapter.</p>
      <ul class="desk-list" data-desk-list>${rows}</ul>
      <div class="director-actions"><button data-action="dk-reset-all" ${n?'':'disabled'} title="Every other desk back to the film in this chapter: one step, Undo brings them back">Reset all desks to the film${n?' ('+n+')':''}</button></div>`;
    if(!sel)return head+'<p class="director-hint">No desk selected: the featured desk is what you edit.</p>';
    const r=rec(sel),v=view(sel),e=editOf(sel),L=startPoseLimits(v.size),p=v.pose,yaw=r1(wrapDeg(deg(p.yaw)));
    const num=(nm,text,value,step,unit,extra='')=>`<label class="desk-num">${text}<span><input name="${nm}" type="number" step="${step}" value="${value}" ${extra}><em>${unit}</em></span></label>`;
    const nudgeRow=(axis,list)=>`<span class="desk-nudge">${list.map(b=>`<button data-action="dk-nudge" data-section="${axis}:${b}" title="${b>0?'+':''}${b}${axis==='yaw'?'°':'″'}">${b>0?'+':'−'}${Math.abs(b)}</button>`).join('')}</span>`;
    const row=(f,label,min,max,step,unit,value)=>`<div class="start-pose-row"><label for="dk-${f}-n">${label}</label><input name="dk-${f}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} slider"><input id="dk-${f}-n" name="dk-${f}-n" type="number" min="${min}" max="${max}" step="${step}" value="${value}"><span class="start-pose-unit">${unit}</span></div>`;
    return head+`<div class="movement-inspector desk-inspector" data-reveal="desk"><h4 title="${escape(sel)}">${escape(name(r))}</h4>
      <p class="director-hint">${e?escape(describeDeskEdit(e,was(r))):'As the film has it.'}</p>
      <div class="director-actions desk-size" role="group" aria-label="Desk size">${['48x30','60x30'].map(s=>`<button data-action="dk-size" data-section="${s}" aria-pressed="${v.size===s}" title="${sizeLabel(s)} wide ErgoFlex desk">${sizeLabel(s)}</button>`).join('')}</div>
      <div class="desk-pos">${num('dk-x','Position X',r1(p.x/IN),1,'in')}${nudgeRow('x',[-12,-1,1,12])}${num('dk-z','Position Z',r1(p.z/IN),1,'in')}${nudgeRow('z',[-12,-1,1,12])}${num('dk-yaw','Rotate',yaw,1,'°')}${nudgeRow('yaw',[-15,-5,5,15])}</div>
      <p class="director-hint">X runs along the room's left-right, Z front-back, from the room's origin. Drag the round handle under the desk in the view to move it.</p>
      <fieldset class="chapter-pacing start-pose" data-desk-start><legend>Starting height and tilt</legend>
        ${row('height','Height',L.heightMin,L.heightMax,.5,'in',v.initial.height)}${row('tilt','Tilt',L.tiltMin,L.tiltMax,.5,'°',v.initial.tilt)}
        <div class="director-actions start-pose-presets"><button data-action="dk-preset" data-section="sitting" title="Sitting: 28″, 0°">Sitting</button><button data-action="dk-preset" data-section="standing" title="Standing: 43.5″, −5°">Standing</button></div>
        <p class="director-hint">${sizeLabel(v.size)} desk: ${L.heightMin}–${L.heightMax}″, ${L.tiltMin}° to ${L.tiltMax}°. Full ${L.tiltMax}° needs ${L.fullTiltHeight}″ or more.</p></fieldset>
      <div class="director-actions"><button data-action="dk-reset" ${e?'':'disabled'} title="This desk back to the film: its size, place and start">Reset desk</button><button data-action="dk-featured" title="Back to the featured desk (Esc)">Featured desk</button></div></div>`;
  }
  return {panel,action,changed,select,deselect,selected,header,reset,resetAll,editedCount,edits,ensure,
    applied:()=>{if(open()&&film()&&!tools)ensure().catch(e=>console.warn("[desk tools]",e));},
    ids:()=>records().map(r=>r.id),featuredId:featured};
}
