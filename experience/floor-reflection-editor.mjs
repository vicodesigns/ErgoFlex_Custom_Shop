import {FLOOR_SOURCES,FLOOR_SOURCE_FIELDS,cleanFloorSources,floorSourceAt,describeFloorSource} from './film-lighting.mjs';
export {describeFloorSource};
// Director "Floor reflections" (Lighting > Room, under LED glow on the floor): the floor light of each of the desk's
// four LED sources (the footrest strip, the centre strip under the desktop, the left and right side strips), placed,
// sized and toned per chapter. Edits go to the cut shot (sceneGlobals.ledFloorSources, experience/film-lighting.mjs);
// film-fx / film-viewer-leds draw them on the live stage, in Render still and in the film.
// In the view (while the sub-section is open, or Lights are shown): each pool's outline on the floor; click a pool to
// select its source, drag inside it to move it, drag the end dot for its length and the side dot for its spread.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABEL=Object.fromEntries(FLOOR_SOURCES),SHORT={foot:'Footrest',center:'Centre',left:'Left side',right:'Right side'};
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
const lower=id=>(LABEL[id]||id).replace(/ \(.*\)$/,'').replace(/^./,c=>c.toLowerCase());
export function createFloorReflectionEditor({bridge,shot,film,commit,status,rerender,visible,onSelect=()=>{}}){
  let sel=null,expanded=false,tools=null,booting=null,drag=null,poolsAt=0,pools=[];
  const frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow,three=()=>bridge.stage()?.three?.();
  const available=()=>!!film()?.ledReceivers;
  // The cut's own value once edited, else the film's (like Room brightness).
  const own=()=>shot().sceneGlobals?.ledFloorSources,filmValue=()=>film()?.sceneGlobals?.ledFloorSources||null;
  const values=()=>own()??filmValue()??{};
  const at=id=>floorSourceAt(values(),id);
  const edited=id=>JSON.stringify(values()[id]||null)!==JSON.stringify(filmValue()?.[id]||null);
  function write(next,text,{undoKey=null,quiet=false}={}){
    const clean=cleanFloorSources(next),same=JSON.stringify(clean)===JSON.stringify(cleanFloorSources(filmValue()));
    commit(()=>{const s=shot(),g={...(s.sceneGlobals||{})};if(same)delete g.ledFloorSources;else g.ledFloorSources=clean||{};s.sceneGlobals=g;if(!Object.keys(g).length)delete s.sceneGlobals;},{key:undoKey,render:false});
    if(!quiet)rerender();status(text);bridge.stage()?.wake?.(400);   // after the re-render: the panel redraws the status line
  }
  const withSource=(id,change)=>{const all={...values()},cur={...(all[id]||{}),...change};for(const k of Object.keys(change))if(change[k]===undefined)delete cur[k];all[id]=cur;return all;};
  // ---- inspector
  function field(id,k){
    const [label,min,max]=FLOOR_SOURCE_FIELDS[k],v=at(id)[k],name='fr-'+k;
    if(k==='on')return `<label class="director-check"><input type="checkbox" name="${name}" ${v?'checked':''}>On</label>`;
    if(k==='x'||k==='z')return `<label>${label}<input type="number" name="${name}" min="${min}" max="${max}" step="1" value="${r1(v)}"></label>`;
    const tip={spread:'How broad the pool is across the strip',length:'How long the pool is along the strip',edge:'Above ×1 the pool fades out more gently; below ×1 its edge is sharper',brightness:'How bright this pool is',saturation:'How strong its colour is (×0 is white light)'}[k];
    return `<label title="${tip}">${label} <output data-fr-out="${k}">×${r2(v)}</output><span class="global-slider"><input type="range" name="${name}" min="${min}" max="${max}" step=".01" value="${v}"><input type="number" name="${name}-n" min="${min}" max="${max}" step=".01" value="${v}"></span></label>`;
  }
  function panel(){
    if(!available())return '';
    const any=FLOOR_SOURCES.some(([id])=>edited(id)),s=sel;
    const picker=`<div class="director-actions floor-sources" role="group" aria-label="Floor reflection source">${FLOOR_SOURCES.map(([id])=>`<button data-action="fr-pick" data-section="${id}" aria-pressed="${s===id}" title="${escape(LABEL[id])} · ${escape(describeFloorSource(values()[id]))}">${SHORT[id]}${edited(id)?' •':''}</button>`).join('')}</div>`;
    const body=s?`<h4>${escape(LABEL[s])}</h4><p class="director-hint">${escape(describeFloorSource(values()[s]))}. Across: + toward the right wing. Front / back: + toward the desk's front.</p>
      ${field(s,'on')}<div class="director-grid">${field(s,'x')}${field(s,'z')}</div>
      ${['spread','length','edge','brightness','saturation'].map(k=>field(s,k)).join('')}
      <div class="director-actions"><button data-action="fr-reset" ${edited(s)?'':'disabled'} title="This source's floor reflection back to the film">Reset to the film</button></div>`
      :'<p class="director-hint">Pick a source, or click its pool on the floor in the view.</p>';
    return `<details class="floor-section" data-floor-section ${expanded?'open':''}><summary><span>Floor reflections</span><small>each LED strip's light on the floor</small></summary>
      <div class="floor-inspector" data-reveal="floor"><p class="director-hint">Outlines show on the floor while this is open (or Lights are shown): click a pool to pick it, drag it to move it, drag its dots for length (end) and spread (side).</p>
      ${picker}${body}<div class="director-actions"><button data-action="fr-reset-all" ${any?'':'disabled'} title="Every source's floor reflection back to the film: one step, Undo brings them back">Reset all floor reflections</button></div></div></details>`;
  }
  function pick(id,{fromView=false}={}){
    if(!LABEL[id])return;sel=id;expanded=true;onSelect();rerender();bridge.stage()?.wake?.(300);
    status(`${LABEL[id]} selected${fromView?' · drag the pool to move it, its dots for length and spread':''}. ${describeFloorSource(values()[id])}.`);
  }
  function deselect(){if(!sel)return;sel=null;rerender();}
  async function action(name,arg){
    if(name==='fr-pick'){pick(arg);ensure().catch(()=>{});return;}
    if(name==='fr-reset'){if(!sel)return;const f=filmValue()?.[sel],all={...values()};if(f)all[sel]=f;else delete all[sel];write(all,`${LABEL[sel]}: floor reflection back to the film. Undo brings your change back.`);return;}
    if(name==='fr-reset-all'){const n=FLOOR_SOURCES.filter(([id])=>edited(id)).length;if(!n){status('The floor reflections are the film\'s.');return;}write(filmValue()||{},`All floor reflections back to the film (${n} source${n===1?'':'s'}). Undo brings them back.`);}
  }
  // Inputs: sliders live (one undo step per drag), numbers / checkbox on change.
  function changed(el,{live=false}={}){
    if(!sel)return;const k=el.name.replace(/^fr-/,'').replace(/-n$/,''),f=FLOOR_SOURCE_FIELDS[k];if(!f)return;
    let v;if(k==='on')v=el.checked;else{v=Number(el.value);if(el.value===''||!Number.isFinite(v))throw Error('Enter a number.');if(v<f[1]||v>f[2])throw Error(`${f[0]} runs from ${f[1]} to ${f[2]}.`);}
    const out=document.querySelector(`[data-fr-out="${k}"]`);if(out)out.textContent='×'+r2(v);
    if(live){const twin=document.querySelector(`[name="fr-${k}${el.name.endsWith('-n')?'':'-n'}"]`);if(twin)twin.value=String(v);}
    const text=k==='on'?`${LABEL[sel]}: floor reflection ${v?'on':'off'}.`:`${LABEL[sel]}: ${f[0].replace(' ×','').replace(/ \(cm\)$/,'').toLowerCase()} ${k==='x'||k==='z'?r1(v)+' cm':'×'+r2(v)}.`;
    write(withSource(sel,{[k]:v}),text+' Undo puts it back.',{undoKey:live?'fr-'+sel+'-'+k:null,quiet:live});
  }
  // ---- stage: outlines, handles, picking, drags
  async function boot(){
    const w=win(),t=three();if(!t)throw Error('The stage is still loading.');
    if(!w.__directorThree)await new Promise((resolve,reject)=>{w.__dirThreeDone=resolve;w.__dirThreeFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree={THREE:T,TransformControls:C.TransformControls};window.__dirThreeDone();},e=>window.__dirThreeFail(e));";w.document.head.append(s);});
    const {THREE}=w.__directorThree,group=new THREE.Group();group.name='Director floor reflections';group.userData.directorTools=true;group.visible=false;t.scene.add(group);
    const lines=new Map(),dot=(color)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:.9}));m.renderOrder=999;m.visible=false;group.add(m);return m;};
    const handles={move:dot(0xffffff),length:dot(0x63d8f5),spread:dot(0xffc861)};for(const [k,m] of Object.entries(handles))m.name='handle:'+k;
    // Each pool's half-brightness outline, and its strip dropped onto the floor (dashed): where the light comes from.
    const strips=new Map();
    for(const [id] of FLOOR_SOURCES){const g=new THREE.BufferGeometry(),l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.35,depthTest:false}));l.name='pool:'+id;l.renderOrder=998;l.frustumCulled=false;group.add(l);lines.set(id,l);
      const sl=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xffffff,transparent:true,opacity:.5,depthTest:false,dashSize:.02,gapSize:.015}));sl.name='strip:'+id;sl.renderOrder=998;sl.frustumCulled=false;group.add(sl);strips.set(id,sl);}
    const dom=t.renderer.domElement,ray=new THREE.Raycaster();
    const ndc=ev=>{const r=dom.getBoundingClientRect();return new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1);};
    const floorHit=(ev,y)=>{ray.setFromCamera(ndc(ev),t.camera);const p=new THREE.Vector3();return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y),p)?p:null;};
    const screen=p=>{const v=p.clone().project(t.camera),r=dom.getBoundingClientRect();return [(v.x+1)/2*r.width+r.left,(1-v.y)/2*r.height+r.top];};
    const inside=(pts,p)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)c=!c;}return c;};
    dom.addEventListener('pointerdown',ev=>{
      if(ev.button!==0||!showing()||w.__directorDragging)return;
      const list=livePools(true);if(!list.length)return;
      // A handle of the selected pool first (12 px), else the smallest pool under the pointer.
      const mine=list.find(p=>p.key===sel);let kind=null,target=null;
      if(mine)for(const [k,m] of Object.entries(handles)){if(!m.visible)continue;const [x,y]=screen(m.position);if(Math.hypot(x-ev.clientX,y-ev.clientY)<12){kind=k;target=mine;break;}}
      if(!target){const hits=list.filter(p=>{const h=floorHit(ev,p.centre.y);return h&&inside(p.points,h);}).sort((a,b)=>a.halfLength*a.halfWidth-b.halfLength*b.halfWidth);target=hits[0];kind='move';}
      if(!target)return;
      ev.preventDefault();ev.stopImmediatePropagation();w.__directorDragging=true;
      if(target.key!==sel)pick(target.key,{fromView:true});
      const start=floorHit(ev,target.centre.y);
      drag={kind,key:target.key,pool:target,start,base:at(target.key),moved:false,enabled:t.controls?.enabled,pointer:ev.pointerId};
      if(t.controls)t.controls.enabled=false;try{dom.setPointerCapture(ev.pointerId);}catch{}
    },true);
    dom.addEventListener('pointermove',ev=>{
      if(!drag)return;ev.stopImmediatePropagation();const p=floorHit(ev,drag.pool.centre.y);if(!p)return;
      const next=dragValue(drag,p);if(!next)return;drag.moved=true;drag.next=next;
      w.__filmFx?.previewFloorSources?.(withSource(drag.key,next));bridge.stage()?.wake?.(300);
      status(dragText(drag.key,next,'…'));
    },true);
    const end=ev=>{
      if(!drag)return;ev.stopImmediatePropagation();const d=drag;drag=null;if(t.controls)t.controls.enabled=d.enabled??true;
      try{dom.releasePointerCapture(d.pointer);}catch{}setTimeout(()=>{w.__directorDragging=false;},0);
      if(!d.moved||!d.next){w.__filmFx?.previewFloorSources?.(undefined);return;}
      write(withSource(d.key,d.next),dragText(d.key,d.next,'.')+' Undo puts it back.');
    };
    dom.addEventListener('pointerup',end,true);dom.addEventListener('pointercancel',end,true);
    tools={THREE,group,lines,strips,handles,t};requestAnimationFrame(tick);return tools;
  }
  const ensure=()=>booting||=boot().catch(error=>{booting=null;throw error;});
  // Drag maths in the floor plane (world): offsets through the desk's axes, length / spread as ratios of the pool.
  function dragValue(d,p){
    const P=d.pool,delta=p.clone().sub(d.start),b=d.base;
    if(d.kind==='move'){const clamp=v=>Math.max(-100,Math.min(100,Math.round(v)));return {x:clamp(b.x+delta.dot(P.right)/P.worldPerCm),z:clamp(b.z+delta.dot(P.front)/P.worldPerCm)};}
    const rel=p.clone().sub(P.centre);rel.y=0;
    if(d.kind==='length'){const half=Math.abs(rel.dot(P.axis));return {length:Math.max(.25,Math.min(3,r2(b.length*half/Math.max(1e-6,P.halfLength))))};}
    if(d.kind==='spread'){const across=new tools.THREE.Vector3(-P.axis.z,0,P.axis.x).normalize(),half=Math.abs(rel.dot(across));return {spread:Math.max(.25,Math.min(4,r2(b.spread*half/Math.max(1e-6,P.halfWidth))))};}
    return null;
  }
  const dragText=(id,v,end)=>v.length!==undefined?`${LABEL[id]}: length ×${r2(v.length)}${end}`:v.spread!==undefined?`${LABEL[id]}: spread ×${r2(v.spread)}${end}`:`${end==='.'?'Moved':'Moving'} the ${lower(id)}'s floor reflection: ${v.x>0?'+':''}${v.x} cm across, ${v.z>0?'+':''}${v.z} cm front/back${end}`;
  const showing=()=>available()&&!bridge.playback().playing&&(visible()||false);
  function livePools(force=false){
    if(!force&&performance.now()-poolsAt<100)return pools;poolsAt=performance.now();
    try{pools=win()?.__filmFx?.floorPools?.()||[];}catch{pools=[];}return pools;
  }
  function tick(){
    requestAnimationFrame(tick);if(!tools)return;const {group,lines,handles,t}=tools,on=showing();
    if(group.visible!==on){group.visible=on;bridge.stage()?.wake?.(200);}if(!on)return;
    const list=livePools(),size=Math.max(.01,(t.camera.position.distanceTo(list[0]?.centre||t.camera.position))*.008);
    for(const [id,l] of lines){const p=list.find(x=>x.key===id);l.visible=!!p;if(!p){tools.strips.get(id).visible=false;continue;}
      // Built by the stage's own three (typed arrays from this page's realm fail its instanceof checks).
      l.geometry.setFromPoints(p.points.map(v=>v.clone().setY(v.y+.002)));l.geometry.computeBoundingSphere();
      l.material.opacity=id===sel?.9:p.on?.35:.15;l.material.color.set(id===sel?0x63d8f5:0xffffff);
      const sl=tools.strips.get(id);sl.visible=!!p.strip;if(p.strip){sl.geometry.setFromPoints(p.strip.map(v=>v.clone().setY(v.y+.002)));sl.computeLineDistances();sl.material.opacity=id===sel?.8:.4;}}
    const p=list.find(x=>x.key===sel);
    for(const m of Object.values(handles))m.visible=!!p;
    if(p){const across=new tools.THREE.Vector3(-p.axis.z,0,p.axis.x).normalize(),lift=v=>v.setY(v.y+.003);
      handles.move.position.copy(lift(p.centre.clone()));handles.length.position.copy(lift(p.centre.clone().addScaledVector(p.axis,p.halfLength)));handles.spread.position.copy(lift(p.centre.clone().addScaledVector(across,p.halfWidth)));
      for(const m of Object.values(handles))m.scale.setScalar(size);}
    if(drag)bridge.stage()?.wake?.(300);
  }
  return {panel,action,changed,pick,deselect,ensure,available,selected:()=>sel,
    setExpanded:v=>{expanded=!!v;if(v)ensure().catch(()=>{});bridge.stage()?.wake?.(200);},expanded:()=>expanded,
    applied:()=>{pools=[];poolsAt=0;},
    header:()=>sel?{name:LABEL[sel],detail:describeFloorSource(values()[sel])}:null};
}
