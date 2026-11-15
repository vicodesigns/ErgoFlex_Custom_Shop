// Director People: the selected walker's or wheelchair user's path on the stage floor, and its section in the People
// tab (people-path-edit.mjs is the pure part). Hooked into scene-people-editor.mjs at a few marked lines.
//   On the floor: the route the person follows (a walker's straight legs and footprints, a chair's rounded corners from
//   rollPlan), the control line between the points, a handle per point (the start, green, is where they stand: their
//   placement) and a + on each leg.
//   Drag a handle: that point moves on the floor (Shift snaps to 5 cm); the person re-solves live and the change is one
//   undo step when the button comes up. Drag the line or a + : a new point there. Ctrl+click the floor: a new last point.
//   Select a handle and press Delete, Alt+click it or right-click it: that point goes (the start and the last two stay).
//   The person's own gizmo (W) still moves them: their placement and the path's start move together.
import * as PE from './people-path-edit.mjs';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r1=v=>Math.round(v*10)/10;
const COLOR={walk:0x7fd7ff,roll:0xffb44a,start:0x5fe08a,sel:0xffffff,plus:0xff9bd2};
const SNAP=50;
export function createPathGizmo({win,three,tools,stagePeople,entry,edit,status,editing,lightsShowing,selected,posing,personName,objectOf,cast,modelOf,poseOf,seconds}){
  let h=null,picked=null,drag=null,planner=null,plannerLoading=null,lastKey=null,body=null,listening=false;
  // (the section's few styles live here, not in director.css)
  if(typeof document!=='undefined'&&!document.getElementById('people-path-style')){const s=document.createElement('style');s.id='people-path-style';s.textContent=`
.people-path-ends{margin-top:6px}.people-path-ends select{width:100%;min-width:0}
.people-path-points summary{cursor:pointer;font-size:10.5px;color:#9fb7c6;margin:6px 0}
.people-path-point{display:grid;grid-template-columns:44px 1fr 1fr 24px;gap:6px;align-items:end;margin-bottom:4px}
.people-path-point label{display:grid;gap:2px;font-size:10.5px;color:#9fb7c6;position:relative}.people-path-point label small{position:absolute;right:7px;bottom:7px;color:#7f97a6;pointer-events:none}
.people-path-point input{width:100%;box-sizing:border-box;padding-right:30px}.people-path-point>button:first-child{padding:4px 2px;font-size:10.5px}
.people-path-point.selected>button:first-child{background:#fff;color:#0a161e;border-color:#fff}`;document.head.append(s);}
  const kindOf=e=>PE.motionOf(e);
  // ---- the planner (rollPlan), from the stage window: room-people-motion.mjs needs the stage's three
  function loadPlanner(){
    const w=win();if(!w)return planner;if(w.__peoplePlanner)return planner=w.__peoplePlanner;
    if(plannerLoading!==w&&w.document){plannerLoading=w;const s=w.document.createElement('script');s.type='module';s.textContent="import('/room-people-motion.mjs').then(m=>{window.__peoplePlanner={rollPlan:m.rollPlan};},e=>console.warn('[people paths]',e));";w.document.head.append(s);}
    return null;
  }
  const P=()=>loadPlanner()||{};   // (the stage window's: a new stage window loads it again)
  const active=()=>{const k=selected(),e=k&&entry(k);return !!(k&&e&&kindOf(e)&&PE.pathOf(e)&&tools()&&editing()&&!lightsShowing()&&!posing());};
  const room=()=>win()?.ErgoFlex?.workspaceRoom?.root||null;
  // ---- the three.js objects
  function build(){
    const {THREE,t}=tools(),group=new THREE.Group();group.name='Director path tools';group.userData.directorTools=true;group.matrixAutoUpdate=false;group.renderOrder=996;t.scene.add(group);
    const mat=(color,o={})=>new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true,opacity:o.opacity??.95,side:THREE.DoubleSide});
    const route=new THREE.Mesh(new THREE.BufferGeometry(),mat(COLOR.walk,{opacity:.8}));route.renderOrder=996;
    const control=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xffffff,dashSize:60,gapSize:45,depthTest:false,transparent:true,opacity:.55}));control.renderOrder=997;
    const prints=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xffffff,size:5,sizeAttenuation:false,depthTest:false,transparent:true,opacity:.7}));prints.renderOrder=997;
    const sphere=new THREE.SphereGeometry(1,18,12),ring=new THREE.RingGeometry(1.25,1.6,32);ring.rotateX(-Math.PI/2);
    for(const o of [route,control,prints]){o.userData.directorTools=true;group.add(o);}
    h={group,route,control,prints,sphere,ring,mat,handles:[],plus:[],sign:'',printsOf:null};
  }
  function dispose(){if(!h)return;h.group.removeFromParent();h.group.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});h=null;}
  const handleMesh=(color,size)=>{const {THREE}=tools(),m=new THREE.Mesh(h.sphere,h.mat(color));m.renderOrder=999;m.userData.directorTools=true;m.userData.size=size;const r=new THREE.Mesh(h.ring,h.mat(color,{opacity:.9}));r.renderOrder=998;r.userData.directorTools=true;m.add(r);h.group.add(m);return m;};
  function ribbon(line,width){
    const pos=[],idx=[];
    for(let i=0;i<line.length;i++){
      const a=line[Math.max(0,i-1)],b=line[Math.min(line.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
      pos.push(line[i][0]-dz*width/2,6,line[i][1]+dx*width/2,line[i][0]+dz*width/2,6,line[i][1]-dx*width/2);
      if(i)idx.push(2*i-2,2*i-1,2*i,2*i-1,2*i+1,2*i);
    }
    return {pos,idx};
  }
  // The points being shown: the entry's, or the drag's.
  const pointsNow=e=>drag?.points||PE.pathOf(e);
  function draw(e,o){
    const {THREE}=tools(),kind=kindOf(e),pts=pointsNow(e),preview=drag?PE.withPath(e,pts):e,line=PE.drawnLine(preview,P())||pts;
    const sign=JSON.stringify([kind,pts,preview[kind].radius,picked,!!P().rollPlan]);
    if(sign!==h.sign){
      h.sign=sign;
      const rb=ribbon(line,kind==='roll'?60:36);h.route.geometry.dispose();h.route.geometry=new THREE.BufferGeometry();h.route.geometry.setAttribute('position',new THREE.Float32BufferAttribute(rb.pos,3));h.route.geometry.setIndex(rb.idx);h.route.material.color.setHex(COLOR[kind]);
      const seg=[];for(let i=0;i<pts.length-1;i++)seg.push(pts[i][0],8,pts[i][1],pts[i+1][0],8,pts[i+1][1]);
      h.control.geometry.dispose();h.control.geometry=new THREE.BufferGeometry();h.control.geometry.setAttribute('position',new THREE.Float32BufferAttribute(seg,3));h.control.computeLineDistances();
      while(h.handles.length>pts.length)h.handles.pop().removeFromParent();while(h.handles.length<pts.length)h.handles.push(handleMesh(COLOR[kind],1));
      while(h.plus.length>pts.length-1)h.plus.pop().removeFromParent();while(h.plus.length<pts.length-1){const m=handleMesh(COLOR.plus,.55);m.material.opacity=.6;h.plus.push(m);}
      h.handles.forEach((m,i)=>{m.position.set(pts[i][0],10,pts[i][1]);const c=i===picked?COLOR.sel:i===0?COLOR.start:COLOR[kind];m.material.color.setHex(c);m.children[0].material.color.setHex(c);m.userData.size=i===picked?1.35:i===0?1.15:1;m.children[0].visible=i===0||i===picked;});
      h.plus.forEach((m,i)=>m.position.set((pts[i][0]+pts[i+1][0])/2,10,(pts[i][1]+pts[i+1][1])/2));
    }
    // a walker's footprints, from the plan the stage walks (live while a point is dragged)
    const plan=kind==='walk'?o?.userData?.personLife?.plan:null;
    if(plan!==h.printsOf){h.printsOf=plan;const p=[];if(plan)for(const list of plan.prints)for(const q of list)p.push(q.x*1000,4,q.z*1000);h.prints.geometry.dispose();h.prints.geometry=new THREE.BufferGeometry();h.prints.geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));}
    h.prints.visible=!!plan;
  }
  // Each frame (scene-people-editor.mjs tick).
  function tick(){
    const k=selected();if(k!==lastKey){lastKey=k;picked=null;if(drag)cancel();}
    if(!tools())return;listen();
    const on=active();if(!on){if(h)h.group.visible=false;return;}
    if(!h)build();
    const root=room();if(!root){h.group.visible=false;return;}
    const e=entry(k),o=objectOf(k);root.updateWorldMatrix(true,false);h.group.matrix.copy(root.matrixWorld);h.group.matrixWorldNeedsUpdate=true;h.group.visible=true;
    draw(e,o);
    // handles a constant size on the screen
    const {THREE,t}=tools(),cam=t.camera.getWorldPosition(new THREE.Vector3()),k2=Math.tan(THREE.MathUtils.degToRad(t.camera.fov||40)/2),scale=root.matrixWorld.getMaxScaleOnAxis()||1,p=new THREE.Vector3();
    for(const m of [...h.handles,...h.plus]){p.copy(m.position).applyMatrix4(root.matrixWorld);m.scale.setScalar(p.distanceTo(cam)*k2*.016*m.userData.size/scale);}
  }
  // ---- the pointer
  const ndc=(ev,dom)=>{const r=dom.getBoundingClientRect();return [(ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1];};
  // the floor point under the pointer (room mm), and how many mm a screen pixel is there
  function floorAt(ev){
    const {THREE,t}=tools(),root=room();if(!root)return null;const dom=t.renderer.domElement,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(...ndc(ev,dom)),t.camera);
    const inv=root.matrixWorld.clone().invert(),o=ray.ray.origin.clone().applyMatrix4(inv),d=ray.ray.origin.clone().add(ray.ray.direction).applyMatrix4(inv).sub(o);
    const at=PE.rayFloor([o.x,o.y,o.z],[d.x,d.y,d.z],0);if(!at)return null;
    const r=dom.getBoundingClientRect(),px=v=>{const q=v.applyMatrix4(root.matrixWorld).project(t.camera);return [(q.x+1)/2*r.width,(1-q.y)/2*r.height];};
    const a=px(new THREE.Vector3(at[0],0,at[1])),b=px(new THREE.Vector3(at[0]+100,0,at[1])),c=px(new THREE.Vector3(at[0],0,at[1]+100));
    const perPx=100/Math.max(1e-3,Math.hypot(b[0]-a[0],b[1]-a[1]),Math.hypot(c[0]-a[0],c[1]-a[1]));
    return {at,perPx};
  }
  // what is under the pointer: a handle (screen distance), a +, the line, or the floor
  function hit(ev){
    const f=floorAt(ev);if(!f)return null;const e=entry(selected()),pts=PE.pathOf(e);
    const {THREE,t}=tools(),root=room(),dom=t.renderer.domElement,r=dom.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top;
    const screen=p=>{const q=new THREE.Vector3(p[0],0,p[1]).applyMatrix4(root.matrixWorld).project(t.camera);return Math.hypot((q.x+1)/2*r.width-mx,(1-q.y)/2*r.height-my);};
    // (the nearest of the handles and the +s under the pointer)
    let best=null;pts.forEach((p,i)=>{const d=screen(p);if(d<=14&&(!best||d<best.d))best={kind:'point',index:i,d};});
    for(let i=0;i<pts.length-1;i++){const m=[(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2],d=screen(m);if(d<=11&&(!best||d<best.d))best={kind:'plus',index:i,at:m.map(Math.round),d};}if(best)return {...best,f};
    const s=PE.hitTest(pts,f.at,{pointTol:0,lineTol:Math.max(20,8*f.perPx),drawn:PE.drawnLine(e,P())});
    return s?{...s,f}:{kind:'floor',f};
  }
  const grab=ev=>{ev.preventDefault();ev.stopImmediatePropagation();};
  function listen(){
    if(listening||!tools())return;listening=true;const {t}=tools(),dom=t.renderer.domElement,w=win();
    dom.addEventListener('pointerdown',ev=>{
      if(!active()||drag||tools().gizmo?.dragging)return;
      // (a handle or a + wins over the person's own gizmo, which walks with them over their path; the line and the floor do not)
      const x=hit(ev);if(!x||tools().gizmo?.axis&&ev.button===0&&x.kind!=='point'&&x.kind!=='plus')return;const e=entry(selected()),pts=PE.pathOf(e);
      if(ev.button===2){if(x.kind==='point'){grab(ev);}return;}      // (right-click on a handle: contextmenu removes it; not a pan)
      if(ev.button!==0)return;
      if(x.kind==='point'){grab(ev);pick(x.index);if(ev.altKey){removeAt(x.index);return;}start(ev,pts,x.index,false);return;}
      if(x.kind==='plus'){grab(ev);const n=[...pts];n.splice(x.index+1,0,x.at);picked=x.index+1;start(ev,n,x.index+1,true);return;}
      if(x.kind==='segment'){grab(ev);const n=[...pts];n.splice(x.index+1,0,x.at);picked=x.index+1;start(ev,n,x.index+1,true);return;}
      if(x.kind==='floor'&&(ev.ctrlKey||ev.metaKey)){grab(ev);const n=[...pts,x.f.at.map(Math.round)];picked=n.length-1;start(ev,n,n.length-1,true);return;}
    },true);
    dom.addEventListener('contextmenu',ev=>{if(!active())return;const x=hit(ev);if(x?.kind==='point'){ev.preventDefault();ev.stopImmediatePropagation();pick(x.index);removeAt(x.index);}},true);
    dom.addEventListener('pointermove',ev=>{if(!drag||ev.pointerId!==drag.id)return;grab(ev);move(ev);},true);
    const up=ev=>{if(!drag||ev.pointerId!==drag.id)return;grab(ev);finish();};
    dom.addEventListener('pointerup',up,true);dom.addEventListener('pointercancel',ev=>{if(drag&&ev.pointerId===drag.id)cancel();},true);
    // the person's own gizmo (W) on someone with a path: where they were when its drag began and where it has them now.
    // While it drags, the stage's walk / roll is held off them: each stage frame (people.update) the person is put back
    // where the gizmo has them, not re-solved onto the old path, so the two never fight. The new placement and path start
    // land on release (scene-people-editor endDrag -> bodyMoved), one undo step, and the stage re-solves from there.
    const g=tools().gizmo;
    g?.addEventListener('dragging-changed',ev=>{
      const o=g.object,k=selected();
      if(ev.value&&o&&k){const e=entry(k);body={key:k,from:[o.position.x,o.position.z],to:null,entry:e&&kindOf(e)?structuredClone(e):null};if(body.entry&&g.mode==='translate')hold(o);}
      else unhold();
    });
    g?.addEventListener('objectChange',()=>{const o=g.object;if(body&&o&&g.mode==='translate'){body.to=[o.position.x,o.position.z];if(held)held.at.copy(o.position);}});
    void w;
  }
  // (held: { people, update (the instance's own, put back on release), object, at, turn })
  let held=null;
  function hold(o){
    const people=stagePeople();if(!people||held)return;
    held={people,own:Object.prototype.hasOwnProperty.call(people,'update')?people.update:null,object:o,at:o.position.clone(),turn:o.rotation.y};
    const update=people.update;
    people.update=function(...a){const r=update.apply(this,a);if(held?.object){held.object.position.x=held.at.x;held.object.position.z=held.at.z;held.object.rotation.y=held.turn;}return r;};
  }
  function unhold(){if(!held)return;const {people,own}=held;if(own)people.update=own;else delete people.update;held=null;people.dirty=true;}
  function start(ev,points,index,added){
    const {t}=tools(),w=win(),k=selected();
    drag={id:ev.pointerId,key:k,index,points:points.map(p=>[...p]),added,moved:added,x:ev.clientX,y:ev.clientY,orbit:t.controls?.enabled,was:structuredClone(entry(k))};
    if(t.controls)t.controls.enabled=false;w.__directorDragging=true;
    try{t.renderer.domElement.setPointerCapture(ev.pointerId);}catch{}
    if(added)preview(k,PE.withPath(drag.was,drag.points));
  }
  function move(ev){
    if(!drag.moved&&Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)<4)return;drag.moved=true;
    const f=floorAt(ev);if(!f)return;const p=ev.shiftKey?PE.snap(f.at,SNAP):f.at.map(Math.round);
    drag.points[drag.index]=p;preview(drag.key,PE.withPath(drag.was,drag.points));
    const who=personName(drag.was);status(`${drag.added?'Adding a point to':'Moving point '+(drag.index+1)+' of'} ${who}'s path: ${p[0]}, ${p[1]} mm${ev.shiftKey?' (snapping to 5 cm)':' · Shift snaps'}`);
  }
  // the stage's person follows the path being dragged (their walk / roll re-planned at the playhead), before the edit lands
  function preview(key,e){
    const o=objectOf(key),spec=o?.userData?.person,kind=kindOf(e);if(!spec||!kind||!spec[kind])return;
    spec[kind]={...spec[kind],path:e[kind].path};delete spec[kind].to;delete spec[kind].from;if(Array.isArray(e.at))spec.at=[...e.at];
    const people=stagePeople();if(people)people.dirty=true;
  }
  function release(){const d=drag;drag=null;const {t}=tools(),w=win();if(t.controls&&d)t.controls.enabled=d.orbit??true;setTimeout(()=>{if(w)w.__directorDragging=false;},0);try{t.renderer.domElement.releasePointerCapture(d.id);}catch{}if(h)h.sign='';return d;}
  function finish(){
    const d=release();if(!d)return;const who=personName(d.was);
    if(!d.moved){status(`Point ${d.index+1} of ${who}'s path selected: drag it on the floor, Delete removes it${d.index===0?' (the start is where they stand: it stays)':''}.`);return;}
    const next=PE.withPath(d.was,d.points);
    put(d.key,next,d.added?`Added a point to ${who}'s path.`:`Moved point ${d.index+1} of ${who}'s path${d.index===0?' (and where they stand)':''}.`);
  }
  function cancel(){const d=release();if(d)put(d.key,d.was,null,true);}
  // the entry becomes `next` (one undo step); fields the walk / roll does not have stay untouched
  function put(key,next,text,quiet=false,options){
    if(quiet){const o=objectOf(key);if(o)preview(key,next);return;}
    edit(key,x=>{for(const k of Object.keys(x))delete x[k];Object.assign(x,structuredClone(next));},text,options);
  }
  function pick(i){picked=i;if(h)h.sign='';}
  function removeAt(i){
    const k=selected(),e=k&&entry(k);if(!e)return false;const who=personName(e);
    if(i===0){status(`The start of ${who}'s path is where they stand: drag it (or them) instead.`,true);return true;}
    if(!PE.canRemove(e,i)){status(`${who}'s path keeps at least two points.`,true);return true;}
    picked=null;put(k,PE.removePoint(e,i),`Removed point ${i+1} of ${who}'s path.`);return true;
  }
  // ---- hooks
  // Delete with a handle selected: that point (true: handled, the person stays).
  function removeSelected(){if(picked===null||!active())return false;return removeAt(picked);}
  // The person dragged with their gizmo (scene-people-editor endDrag, translate): their placement and the path's start
  // move by as much as the gizmo moved them. p: the entry being written; it already has the gizmo's place as `at`.
  function bodyMoved(p){
    const b=body;body=null;if(!b||b.key!==p.key||!b.entry||!b.to)return;
    const n=PE.moveStart(b.entry,[b.to[0]-b.from[0],b.to[1]-b.from[1]]),kind=kindOf(n);p.at=n.at;if(kind)p[kind]=n[kind];
  }
  // ---- the People tab section
  const field=(label,name,value,{step=1,min='',max='',unit='',title='',placeholder=''}={})=>`<label title="${escape(title)}">${escape(label)}<input type="number" name="${name}" value="${escape(value)}" step="${step}" ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''} ${placeholder?`placeholder="${escape(placeholder)}"`:''}>${unit?`<small>${escape(unit)}</small>`:''}</label>`;
  function panel(e){
    const kind=kindOf(e),pts=PE.pathOf(e);if(!kind||!pts)return '';const m=e[kind],F=PE.FIELDS[kind],o=objectOf(e.key);
    const info=PE.routeInfo(e,P()),plan=kind==='walk'?o?.userData?.personLife?.plan:null,secs=kind==='roll'?info?.seconds:plan?.seconds;
    const facts=[`${pts.length} points`,info?`${r1(info.length/1000)} m`:'',Number.isFinite(secs)?`${r1(secs)} s, there at ${r1((m.start||0)+secs)} s`:''].filter(Boolean).join(' · ');
    const num=(name,ph)=>field(F[name].label,'pe-path-'+name,m[name]??'',{step:F[name].step,min:F[name].min,max:name==='start'?Math.max(1,seconds()):F[name].max,unit:F[name].unit,title:F[name].title,placeholder:ph});
    let fields;
    if(kind==='walk'){
      const me=modelOf(e.id)?.character,others=cast().filter(x=>x.key!==e.key&&modelOf(x.id)?.character===me),seen=new Set(),opts=[['','Same posture (stands as they walked)']];
      for(const x of others)if(!seen.has(x.id)){seen.add(x.id);opts.push([x.id,`${poseOf(x.id)?.label||x.id} · ${x.key}`]);}
      if(m.then&&!seen.has(m.then))opts.push([m.then,poseOf(m.then)?.label||m.then]);
      fields=`<div class="director-row people-fields">${num('start')}${num('pace','1.8')}${num('step','auto')}${num('turn','auto')}</div>
        <div class="director-row people-fields people-path-ends"><label>Then<select name="pe-path-then" title="The posture they take at the end of the path: the person's other placements">${opts.map(([v,l])=>`<option value="${escape(v)}" ${v===(m.then||'')?'selected':''}>${escape(l)}</option>`).join('')}</select></label><label>Toes<select name="pe-path-toes">${PE.TOES.map(([v,l])=>`<option value="${v}" ${v===(m.toes==='stiff'?'stiff':'bend')?'selected':''}>${escape(l)}</option>`).join('')}</select></label></div>`;
    }else fields=`<div class="director-row people-fields">${num('start')}${num('speed','0.8')}${num('radius','450')}${num('ease','1.2')}</div><p class="director-hint">A chair ends facing along its last leg.${info?.tight?.length?` ${info.tight.length} corner${info.tight.length===1?'':'s'} turn tighter than the radius (a leg next to it is short).`:''}</p>`;
    const rows=pts.map((p,i)=>`<div class="people-path-point ${i===picked?'selected':''}"><button type="button" data-action="pe-path-pick" data-index="${i}" title="${i===0?'The start: where they stand (their placement)':'Select this point (Delete removes it)'}">${i===0?'Start':i}</button>${field('X','pe-path-x-'+i,p[0],{step:10,unit:'mm'})}${field('Z','pe-path-z-'+i,p[1],{step:10,unit:'mm'})}<button type="button" class="pose-saved-x" data-action="pe-path-remove" data-index="${i}" ${PE.canRemove(e,i)?'':'disabled'} aria-label="Remove point ${i}" title="Remove this point">×</button></div>`).join('');
    return `<h4>${kind==='walk'?'Walk':'Roll'} path</h4>
      <p class="director-hint">${escape(facts)}. On the floor: drag a point (Shift snaps to 5 cm), drag the line or a + to add one, Ctrl+click the floor to add a last point; select a point and press Delete, or right-click it, to remove it.</p>
      ${fields}
      <details class="people-path-points"${pts.length<=6?' open':''}><summary>Points (room mm)</summary>${rows}<div class="director-actions"><button type="button" data-action="pe-path-append">+ Point at the end</button></div></details>`;
  }
  function changed(el){
    const name=el?.name||'';if(!name.startsWith('pe-path-'))return false;
    const k=selected(),e=k&&entry(k);if(!e||!kindOf(e))return true;const who=personName(e),f=name.slice(8),xy=f.match(/^([xz])-(\d+)$/);
    if(xy){const i=Number(xy[2]),pts=PE.pathOf(e),v=Number(el.value);if(!pts?.[i]||el.value.trim()===''||!Number.isFinite(v))throw Error('Type a number.');const p=[...pts[i]];p[xy[1]==='x'?0:1]=v;put(k,PE.movePoint(e,i,p),`Moved point ${i+1} of ${who}'s path.`,false,{undoKey:'people-path-'+name+k});return true;}
    const next=PE.setField(e,f,el.value),m=next[kindOf(e)],F=PE.FIELDS[kindOf(e)][f];
    const said=f==='then'?(m.then?`${who} ends the walk as ${poseOf(m.then)?.label?.toLowerCase()||m.then}.`:`${who} ends the walk in the posture they walked in.`):f==='toes'?`${who}: ${m.toes==='stiff'?'stiff feet':'toes bend'} on the walk.`
      :m[f]===undefined?`${who}: ${F.label.toLowerCase()} back to the film's default.`:`${who}: ${F.label.toLowerCase()} ${m[f]} ${F.unit}.`;
    put(k,next,said,false,{undoKey:'people-path-'+f+k});return true;
  }
  function action(name,index){
    if(!name?.startsWith('pe-path-'))return false;const k=selected(),e=k&&entry(k);if(!e||!kindOf(e))return true;
    if(name==='pe-path-pick'){pick(index);status(`Point ${index===0?'Start':index} of ${personName(e)}'s path selected${index===0?'':': Delete removes it'}.`);return true;}
    if(name==='pe-path-remove'){removeAt(index);return true;}
    if(name==='pe-path-append'){const pts=PE.pathOf(e),a=pts[pts.length-2],b=pts[pts.length-1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;picked=pts.length;put(k,PE.insertPoint(e,pts.length-1,[b[0]+(b[0]-a[0])/l*1000,b[1]+(b[1]-a[1])/l*1000]),`Added a point a metre past the end of ${personName(e)}'s path.`);return true;}
    return true;
  }
  return {tick,panel,changed,action,removeSelected,bodyMoved,picked:()=>picked,dispose,
    // (tests) the handle points on the screen: [{ x, y }] in the stage frame's pixels
    screenPoints(){const k=selected(),e=k&&entry(k),root=room();if(!e||!root||!tools())return null;const {THREE,t}=tools(),r=t.renderer.domElement.getBoundingClientRect();return PE.pathOf(e).map(p=>{const q=new THREE.Vector3(p[0],0,p[1]).applyMatrix4(root.matrixWorld).project(t.camera);return {x:r.left+(q.x+1)/2*r.width,y:r.top+(1-q.y)/2*r.height};});}};
}
