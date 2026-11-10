import {ADDED_TYPES,sceneLightList,applyLightEdit,snapshotLight,restoreLight} from './light-edits.mjs';
// Director "Scene lights": the live stage's THREE lights after the film setup (room lamps, sun /
// sky, the film rig, the Director's own), billboard markers, a move / aim gizmo and an inspector.
// Edits go to the cut (shot.lightEdits for existing lights, shot.lights for added ones); film-fx
// re-applies them on the live stage, in Render still and in the film. Gizmo drags and colour
// changes also touch the live light at once (restored before film-fx re-installs).
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPE={PointLight:'point',SpotLight:'spot',RectAreaLight:'area',DirectionalLight:'directional',HemisphereLight:'hemisphere',AmbientLight:'ambient'};
const r3=v=>Math.round(v*1000)/1000,deg=r=>r*180/Math.PI;
const ADDED=/^Film lights > Film light · (director-[A-Za-z0-9_-]+)$/;
const isOurs=o=>{for(let p=o;p;p=p.parent)if(p.userData?.directorTools)return true;return false;};
const RIG_NAMES={key:'Key light',rimLeft:'Rim light left',rimRight:'Rim light right'};
const PROP_NAMES={'kenney-furniture-books':'Bookshelf lamp','ergoflex-plant-2':'Light by the plant','modern-lamp':'Table lamp','ficus':'Light by the ficus','kenney-furniture-plant-small1':'Light by the plant','armchair-poppi':'Light by the armchair','journal':'Desk light'};
export function friendlyProp(name){
  if(PROP_NAMES[name])return PROP_NAMES[name];
  const clean=name.replace(/^(kenney-furniture-|ergoflex-|quaternius-|kenney-)/,'').replace(/[-_]?\d+$/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').toLowerCase().trim();
  return /lamp|light/.test(clean)?clean[0].toUpperCase()+clean.slice(1):'Light by the '+clean;
}
const iconType=l=>l.isDirectionalLight?'sun':l.isSpotLight?'spot':l.isRectAreaLight?'panel':l.isHemisphereLight?'sky':'bulb';
function makeIcons(win,THREE){
  const out={};
  for(const kind of ['bulb','sun','spot','panel','sky'])for(const off of [false,true]){
    const c=win.document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.lineWidth=5;g.strokeStyle='#fff';g.fillStyle='#fff';
    const shape=()=>{g.beginPath();if(kind==='bulb'){g.arc(32,27,13,0,7);g.moveTo(25,42);g.lineTo(39,42);g.moveTo(26,49);g.lineTo(38,49);}
      else if(kind==='sun'){g.arc(32,32,11,0,7);for(let i=0;i<8;i++){const a=i*Math.PI/4;g.moveTo(32+Math.cos(a)*17,32+Math.sin(a)*17);g.lineTo(32+Math.cos(a)*27,32+Math.sin(a)*27);}}
      else if(kind==='spot'){g.moveTo(24,12);g.lineTo(40,12);g.lineTo(52,52);g.lineTo(12,52);g.closePath();}
      else if(kind==='panel'){g.rect(12,18,40,28);}
      else {g.arc(32,40,20,Math.PI,0);g.lineTo(12,40);}};
    shape();g.stroke();if(!off&&kind!=='sun'&&kind!=='sky'){shape();g.globalAlpha=.55;g.fill();g.globalAlpha=1;}if(!off&&kind==='sun'){g.beginPath();g.arc(32,32,11,0,7);g.fill();}
    g.beginPath();g.lineWidth=3;g.globalAlpha=.9;g.arc(32,32,30,0,7);g.stroke();
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;out[(off?'off-':'')+kind]=t;
  }
  return out;
}
export function createSceneLightEditor({bridge,shot,film,commit,status,open,rerender,onSelect=()=>{}}){
  let selected=null,show=false,mode='move',tools=null,booting=null,list=[],listAt=0,listSig='',drag=null;
  const snaps=new Map(),frame=()=>document.getElementById('stage');
  const three=()=>bridge.stage()?.three?.();
  const editing=()=>open()&&bridge.ready()&&!bridge.playback().playing&&!bridge.bakeState().baking;
  // Where the film puts a light, whatever the Director moved: names come from it, so one light keeps one name
  // (lane chip, mixer, picker, Selected header, status) before, during and after a move.
  function filmPlace(l){
    const u=l.userData.directorFilmPosition;if(u)return l.position.clone().set(...u);
    const s=snaps.get(l);if(s){const v=s.position.clone();if(!l.parent)return v;l.parent.updateMatrixWorld(true);return l.parent.localToWorld(v);}
    return l.getWorldPosition(l.position.clone());
  }
  // Readable names: film rig by its own names, room lamps by the prop they sit in, sun / sky by type.
  function describe(entries){
    const scene=three()?.scene;if(!scene)return [];
    const props=[];scene.traverse(o=>{if(/^Prop:/.test(o.name)&&!isOurs(o))props.push([o.name.slice(5),o.getWorldPosition(o.position.clone())]);});
    const directional=entries.filter(e=>e.light.isDirectionalLight).sort((a,b)=>b.light.intensity-a.light.intensity);let fill=0,room=0,ceiling=0;const addedN={};
    return entries.map(e=>{
      const l=e.light,type=TYPE[l.type]||l.type.replace(/Light$/,'').toLowerCase(),added=e.path.match(ADDED),pos=filmPlace(l);
      let group='Stage',label;
      if(added){group='Added';const n=addedN[type]=(addedN[type]||0)+1;label=`Added ${type} ${n}`;}
      else if(e.path.startsWith('Film lights >')){group='Film rig';const n=e.path.split('· ').pop();label=RIG_NAMES[n]||`Film ${n}`;}
      else if(/^Room:/.test(e.path)){group='Room';const near=props.map(([n,p])=>[n,p.distanceTo(pos)]).sort((a,b)=>a[1]-b[1])[0];label=near&&near[1]<1.2?friendlyProp(near[0]):pos.y>2.2?`Ceiling light ${++ceiling}`:`Room light ${++room}`;}
      else if(l.isHemisphereLight)label='Sky glow';
      else if(l.isDirectionalLight)label=directional[0]===e?'Sun':`Fill light ${++fill}`;
      else if(e.path.startsWith('Cinematic effects'))label='Stage glow';
      else label=`${type} ${e.path.split(' > ').pop()}`;
      return {...e,group,label,type,added:added?.[1]||null};
    });
  }
  function refresh(force=false){
    const scene=three()?.scene;if(!scene){list=[];return;}
    if(!force&&performance.now()-listAt<500&&list.every(e=>e.light.parent))return;
    listAt=performance.now();list=describe(sceneLightList(scene,isOurs));
    const sig=list.map(e=>e.path).join('|');if(sig!==listSig){listSig=sig;rebuildMarkers();rerender();}
  }
  const entry=()=>list.find(e=>e.path===selected)||null;
  const editOf=path=>shot().lightEdits?.find(e=>e.target===path)||null;
  const addedOf=name=>shot().lights?.find(l=>l.name===name)||null;
  // Light edits in this chapter: changed film lights plus the Director's added lights.
  const editedCount=()=>(shot().lightEdits?.length||0)+(shot().lights?.length||0);
  // Film-keyed intensity (e.g. chapter 1's productRig key) or a room under time of day.
  function keyedNote(e){
    const f=film(),name=e.path.startsWith('Film lights >')?e.path.split('· ').pop():null;
    const spec=name&&(f?.lights||[]).flatMap(l=>l.preset==='productRig'?[{name:'key',...l.key},{name:'rimLeft',...l.rimLeft},{name:'rimRight',...l.rimRight}]:[l]).find(l=>(l.name||l.type)===name);
    if(Array.isArray(spec?.intensity))return `Keyed over time (${spec.intensity.length} keys): editing the intensity scales every key by the same factor.`;
    if(e.group==='Room'&&f?.timeOfDay)return 'Time of day drives this light: editing the intensity scales it at every time.';
    return '';
  }
  // ---- writes
  function editExisting(path,change,key=null){
    commit(()=>{const s=shot(),edits=[...(s.lightEdits||[])],i=edits.findIndex(e=>e.target===path),next={...(edits[i]||{target:path}),...change};
      for(const k of Object.keys(next))if(next[k]===undefined)delete next[k];
      if(i<0)edits.push(next);else edits[i]=next;s.lightEdits=edits.filter(e=>Object.keys(e).length>1);if(!s.lightEdits.length)delete s.lightEdits;},{key,render:false});
  }
  function editAdded(name,change,key=null){commit(()=>{const s=shot();s.lights=(s.lights||[]).map(l=>l.name===name?{...l,...change}:l);},{key,render:false});}
  function direct(light,change){if(!snaps.has(light))snaps.set(light,snapshotLight(light));applyLightEdit(light,change);}
  function change(e,values,key=null){
    // values: film-format fields (position, aim, color, distance, decay, angle, penumbra, width, height, castShadow, intensity, visible, type)
    const {visible,intensity,...rest}=values;
    if(e.added){
      const fields={...rest};if(fields.aim){fields.target=fields.aim;delete fields.aim;}if(intensity!==undefined)fields.intensity=intensity;
      if(Object.keys(fields).length)editAdded(e.added,fields,key);if(visible!==undefined)editExisting(e.path,{visible},key);
    }else{
      const edit={...rest};if(visible!==undefined)edit.visible=visible;
      if(intensity!==undefined){const now=e.light.intensity,scale=editOf(e.path)?.intensityScale??1,raw=now/scale;if(!(raw>1e-6))throw Error('This light is at 0 here: move the playhead to where it is lit, then set its intensity.');edit.intensityScale=Math.round(intensity/raw*1000)/1000;}
      editExisting(e.path,edit,key);
    }
    const live={...rest};delete live.type;if(e.added&&intensity!==undefined)e.light.intensity=intensity;if(visible!==undefined)live.visible=visible;if(Object.keys(live).length)direct(e.light,live);
  }
  // ---- stage tools: markers, gizmo, picking
  async function boot(){
    const win=frame().contentWindow,t=three();if(!t)throw Error('The stage is still loading.');
    if(!win.__directorThree)await new Promise((resolve,reject)=>{win.__dirThreeDone=resolve;win.__dirThreeFail=reject;const s=win.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree={THREE:T,TransformControls:C.TransformControls};window.__dirThreeDone();},e=>window.__dirThreeFail(e));";win.document.head.append(s);});
    const {THREE,TransformControls}=win.__directorThree,group=new THREE.Group();group.name='Director light markers';group.userData.directorTools=true;t.scene.add(group);
    const c=win.document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#fff';g.beginPath();g.arc(32,32,13,0,7);g.fill();g.strokeStyle='#fff';g.lineWidth=4;for(let i=0;i<8;i++){const a=i*Math.PI/4;g.beginPath();g.moveTo(32+Math.cos(a)*19,32+Math.sin(a)*19);g.lineTo(32+Math.cos(a)*29,32+Math.sin(a)*29);g.stroke();}
    const icon=new THREE.CanvasTexture(c);icon.colorSpace=THREE.SRGBColorSpace;
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;gizmo.setSize(.75);gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    gizmo.addEventListener('dragging-changed',ev=>{win.__directorDragging=ev.value;if(ev.value){drag={enabled:t.controls.enabled};t.controls.enabled=false;startDrag();}else{t.controls.enabled=drag?.enabled??true;endDrag();}});
    gizmo.addEventListener('objectChange',()=>onDrag());
    const raycaster=new THREE.Raycaster();
    t.renderer.domElement.addEventListener('pointerdown',ev=>{
      if(!show||!editing()||ev.button!==0||gizmo.dragging||gizmo.axis)return;const r=t.renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),t.camera);raycaster.camera=t.camera;
      const hit=raycaster.intersectObjects(group.children,false).find(h=>h.object.userData.path!==selected);if(!hit)return;ev.stopImmediatePropagation();ev.preventDefault();select(hit.object.userData.path);
    },true);
    win.__directorLightsRestore=()=>{for(const [l,v] of soloSaved)if(l.parent)l.visible=v;soloSaved.clear();solo=null;for(const [l,s] of snaps)restoreLight(l,s);snaps.clear();};
    tools={THREE,group,gizmo,icon,t,icons:makeIcons(win,THREE)};rebuildMarkers();requestAnimationFrame(tick);return tools;
  }
  const ensure=()=>booting||=boot().catch(error=>{booting=null;throw error;});
  function rebuildMarkers(){
    if(!tools)return;const {THREE,group,icon}=tools;for(const m of [...group.children]){m.material.dispose();group.remove(m);}
    for(const e of list){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tools.icons[iconType(e.light)],depthTest:false,depthWrite:false,transparent:true,sizeAttenuation:false,toneMapped:false}));m.renderOrder=999;m.userData.path=e.path;m.userData.light=e.light;group.add(m);}
  }
  function tick(){
    requestAnimationFrame(tick);if(!tools)return;const {group,gizmo,t}=tools;const live=editing();refresh();if(show&&live&&(gizmo.dragging||group.visible))bridge.stage()?.wake?.(300);
    group.visible=show&&live;
    const px=1/Math.max(200,t.renderer.domElement.clientHeight||600);
    if(group.visible)for(const m of group.children){const l=m.userData.light;if(!l.parent)continue;l.getWorldPosition(m.position);m.material.color.copy(l.color);m.material.map=tools.icons[(l.visible?'':'off-')+iconType(l)];m.material.opacity=l.visible?1:.6;m.scale.setScalar((m.userData.path===selected?36:28)*px);}
    const e=entry(),target=e&&(mode==='aim'&&e.light.target&&!e.light.isRectAreaLight?e.light.target:e.light),movable=e&&!e.light.isHemisphereLight&&!e.light.isAmbientLight;
    if(show&&live&&movable){if(gizmo.object!==target){if(!target.parent)t.scene.add(target);gizmo.attach(target);}gizmo.visible=gizmo.enabled=true;}
    else if(!gizmo.dragging){if(gizmo.object)gizmo.detach();gizmo.visible=gizmo.enabled=false;}
  }
  function startDrag(){
    const e=entry();if(!e)return;direct(e.light,{});
    // A rect light keeps facing the point it faced before the move.
    if(e.light.isRectAreaLight){const {THREE}=tools,dir=new THREE.Vector3(0,0,-1).applyQuaternion(e.light.getWorldQuaternion(new THREE.Quaternion()));drag.aim=e.light.getWorldPosition(new THREE.Vector3()).addScaledVector(dir,2);}
  }
  function onDrag(){const e=entry();if(!e)return;if(e.light.isRectAreaLight&&drag?.aim){e.light.updateMatrixWorld(true);e.light.lookAt(drag.aim);}status(mode==='aim'?'Aiming '+e.label+'…':'Moving '+e.label+'…');}
  function endDrag(){
    const e=entry();if(!e)return;const {THREE}=tools,world=o=>o.getWorldPosition(new THREE.Vector3()).toArray().map(r3);
    try{
      if(mode==='aim'&&e.light.target&&!e.light.isRectAreaLight)change(e,{aim:world(e.light.target)});
      else change(e,{position:world(e.light),...(drag?.aim?{aim:drag.aim.toArray().map(r3)}:{})});
      status((mode==='aim'?'Aimed ':'Moved ')+e.label+'. Undo restores it; Render still shows the film look.');rerender();
    }catch(error){status(error.message,true);}
    drag=null;
  }
  function select(path){selected=path;onSelect();refresh(true);rerender();const e=entry();if(e)status(`${e.label} selected · drag the gizmo to ${mode==='aim'?'aim':'move'} it.`);}
  // Light mixer: one row per light, the fastest way to dim, recolour or switch lights. Brightness is a factor
  // of the film's own value (log slider, 0.1 to 4); Solo previews one light alone (live only, not saved).
  let solo=null;const soloSaved=new Map();
  function setSolo(path){
    for(const [l,v] of soloSaved)if(l.parent)l.visible=v;soloSaved.clear();solo=solo===path?null:path;
    if(solo)for(const e of list)if(e.path!==solo&&!e.light.isHemisphereLight){soloSaved.set(e.light,e.light.visible);e.light.visible=false;}
  }
  const ADDED_BASE={point:20,spot:120,rect:15};
  function factorOf(e){if(e.added){const a=addedOf(e.added);return a?(a.intensity??ADDED_BASE[a.type])/ADDED_BASE[a.type]:1;}return editOf(e.path)?.intensityScale??1;}
  const toSlider=f=>Math.round(Math.log10(Math.max(.1,Math.min(4,f)))*1000)/1000,fromSlider=v=>Math.round(10**Number(v)*100)/100;
  function mixer(){
    const groups=[['Sun & sky',e=>e.light.isDirectionalLight||e.light.isHemisphereLight],['Room lamps',e=>e.group==='Room'],['Film rig',e=>e.group==='Film rig'||e.group==='Stage'&&!e.light.isDirectionalLight&&!e.light.isHemisphereLight],['Added',e=>e.group==='Added']];
    return `<div class="light-mixer" role="table" aria-label="Light mixer">${groups.map(([name,test])=>{const rows=list.filter(test);return rows.length?`<div class="mixer-group">${name}</div>${rows.map(e=>{const f=factorOf(e),edited=!!(e.added||editOf(e.path));return `<div class="mixer-row ${e.path===selected?'selected':''}" data-mixer="${escape(e.path)}" role="row"><input type="checkbox" name="mx-on" ${e.light.visible?'checked':''} title="On / off" aria-label="${escape(e.label)} on"><input type="color" name="mx-color" value="#${e.light.color.getHexString()}" title="Colour" aria-label="${escape(e.label)} colour"><button class="mixer-name" data-action="sl-pick" data-section="${escape(e.path)}" title="${escape(e.label)} · click to select">${edited?'<i class="mixer-edited" title="Edited"></i>':''}${escape(e.label)}</button>${e.light.isHemisphereLight&&!edited&&false?'':`<input type="range" name="mx-gain" min="-1" max="0.602" step="0.01" value="${toSlider(f)}" title="Brightness ×${f.toFixed(2)} of the film" aria-label="${escape(e.label)} brightness"><output>×${f.toFixed(2)}</output>`}<button class="mixer-solo" data-action="sl-solo" data-section="${escape(e.path)}" aria-pressed="${solo===e.path}" title="Solo: show only this light (preview, not saved)">S</button><button class="mixer-reset" data-action="sl-reset-row" data-section="${escape(e.path)}" ${editOf(e.path)||e.added?'':'disabled'} title="${e.added?'Delete this added light':'Back to the film'}">↺</button></div>`;}).join('')}`:'';}).join('')}</div>`;
  }
  async function mixerChange(el,live){
    const row=el.closest('[data-mixer]'),e=row&&list.find(x=>x.path===row.dataset.mixer);if(!e)return false;await ensure();
    if(el.name==='mx-on'){change(e,{visible:el.checked});return true;}
    if(el.name==='mx-color'){change(e,{color:el.value},live?'mx-color-'+e.path:null);return true;}
    if(el.name==='mx-gain'){const f=fromSlider(el.value),out=row.querySelector('output');if(out)out.textContent='×'+f.toFixed(2);
      if(e.added){const a=addedOf(e.added);change(e,{intensity:Math.round(ADDED_BASE[a.type]*f*100)/100},live?'mx-gain-'+e.path:null);}
      else editExisting(e.path,{intensityScale:f},live?'mx-gain-'+e.path:null);return true;}
    return false;
  }
  // ---- inspector
  function panel(){
    if(!three()?.scene)return '<h4>Scene lights</h4><p class="director-hint">Loading the chapter…</p>';
    refresh(true);const e=entry(),groups=['Film rig','Room','Stage','Added'];
    const head=`<h4>Scene lights</h4><p class="director-hint">The chapter's lamps, sun / sky and film rig after the film setup. Select one here or click its marker in the view; the gizmo moves it (spots and suns: Aim).</p>
      <div class="director-actions"><label class="director-check"><input type="checkbox" name="sl-show" ${show?'checked':''}>Show lights</label><button data-action="sl-add-point">+ Point</button><button data-action="sl-add-spot">+ Spot</button><button data-action="sl-add-rect">+ Area (soft)</button></div>
      <div class="director-actions"><button data-action="sl-reset-all" ${editedCount()?'':'disabled'} title="Every lamp, sun, sky and rig light back to the film, added lights removed: one step, Undo brings them back">Reset all lights to the film${editedCount()?' ('+editedCount()+')':''}</button></div>
      ${mixer()}<label>Scene light<select name="sl-select"><option value="">Choose a light…</option>${groups.map(g=>{const items=list.filter(x=>x.group===g);return items.length?`<optgroup label="${g}">${items.map(x=>`<option value="${escape(x.path)}" ${x.path===selected?'selected':''}>${escape(x.label)}${editOf(x.path)?' · edited':''}${x.light.visible?'':' · off'}</option>`).join('')}</optgroup>`:'';}).join('')}</select></label>`;
    if(!e)return head;
    const l=e.light,a=e.added?addedOf(e.added):null,hex='#'+l.color.getHexString(),pos=l.getWorldPosition(l.position.clone()).toArray(),note=e.added?'':keyedNote(e);
    const aimable=!!l.target&&!l.isRectAreaLight,num=(name,label,value,step,min=0,max='')=>`<label>${label}<input name="${name}" type="number" step="${step}" min="${min}" ${max!==''?`max="${max}"`:''} value="${r3(value)}"></label>`;
    return head+`<div class="movement-inspector scene-light-inspector"><h4>${escape(e.label)}</h4><details class="light-details"><summary>Details</summary><p class="director-hint">${escape(e.path)}</p></details>
      <div class="director-actions"><label class="director-check"><input type="checkbox" name="sl-on" ${l.visible?'checked':''}>On</label><label class="director-check"><input type="checkbox" name="sl-shadow" ${l.castShadow?'checked':''} ${l.isHemisphereLight||l.isRectAreaLight?'disabled':''}>Casts shadow</label></div>
      ${a?`<label>Type<select name="sl-type">${ADDED_TYPES.map(([id,label])=>`<option value="${id}" ${a.type===id?'selected':''}>${label}</option>`).join('')}</select></label>`:`<p class="director-hint">Type: ${escape(e.type)} (fixed for existing lights)</p>`}
      ${aimable||!l.isHemisphereLight?`<div class="director-actions"><button data-action="sl-move" aria-pressed="${mode==='move'}">Move</button>${aimable?`<button data-action="sl-aim" aria-pressed="${mode==='aim'}">Aim</button>`:''}</div>`:''}
      <div class="director-grid neutral-colour"><label>Colour<input name="sl-color" type="color" value="${hex}"></label><label>Hex<input name="sl-hex" maxlength="7" value="${hex}" spellcheck="false"></label></div>
      ${num('sl-intensity','Intensity'+(note?' (at the playhead)':''),l.intensity,.1)}${note?`<p class="director-hint">${escape(note)}</p>`:''}
      ${'distance' in l&&!l.isDirectionalLight&&!l.isRectAreaLight?`<div class="director-grid">${num('sl-distance','Reach (m, 0 = unlimited)',l.distance,.1)}${num('sl-decay','Decay',l.decay,.1,0,4)}</div>`:''}
      ${l.isSpotLight?`<div class="director-grid">${num('sl-angle','Spot angle (°)',deg(l.angle),1,1,89)}${num('sl-penumbra','Penumbra',l.penumbra,.05,0,1)}</div>`:''}
      ${l.isRectAreaLight?`<div class="director-grid">${num('sl-width','Width (m)',l.width,.05,.01)}${num('sl-height','Height (m)',l.height,.05,.01)}</div>`:''}
      ${l.isHemisphereLight||l.isAmbientLight?'':`<div class="director-grid three-up">${['x','y','z'].map((k,i)=>num('sl-p'+k,'Position '+k,pos[i],.05,-1000)).join('')}</div>`}
      <div class="director-actions">${e.added?'<button data-action="sl-delete">Delete light</button>':`<button data-action="sl-reset" ${editOf(e.path)?'':'disabled'}>Reset to the film</button>`}</div></div>`;
  }
  async function action(name,arg){
    await ensure();
    if(name==='sl-pick'){select(arg);return;}
    if(name==='sl-solo'){refresh(true);setSolo(arg);rerender();status(solo?'Solo: only '+(list.find(x=>x.path===solo)?.label||'this light')+' (preview, not saved).':'Solo off.');return;}
    if(name==='sl-reset-row'){const was=selected;selected=arg;const e=entry();if(e)await action(e.added?'sl-delete':'sl-reset');selected=e?.added?null:was;rerender();return;}
    if(name==='sl-move'||name==='sl-aim'){mode=name.slice(3);rerender();return;}
    if(name==='sl-reset-all'){
      const n=editedCount();if(!n){status('No light edits in this chapter: the lights are the film\'s.');return;}
      if(entry()?.added)selected=null;
      commit(()=>{const s=shot();delete s.lightEdits;delete s.lights;},{render:false});rerender();
      status(`All lights back to the film (${n} edit${n===1?'':'s'} cleared). Undo brings them back.`);return;
    }
    if(name.startsWith('sl-add-')){
      const type=name.slice(7),{camera,controls}=three(),t0=controls.target.toArray(),p=camera.position.toArray();
      // Each added light is fanned out sideways (alternating right / left of the view's centre) so several never sit on one spot: a marker you can pick, a gizmo you can drag.
      const side=(n=>{const k=Math.ceil(n/2)*.4*(n%2?1:-1),f=[t0[0]-p[0],t0[2]-p[2]],len=Math.hypot(...f)||1;return [-f[1]/len*k,0,f[0]/len*k];})((shot().lights||[]).length),
        t=t0.map((v,i)=>v+side[i]),at=t0.map((v,i)=>r3(v+(p[i]-v)*.45+(i===1?.6:0)+side[i]));
      const id='director-'+crypto.randomUUID().slice(0,8),l={name:id,type,position:at,color:'#fff2e0',intensity:type==='point'?20:type==='spot'?120:15,...(type==='point'?{distance:0,decay:2}:{}),...(type==='spot'?{target:t.map(r3),angle:30,penumbra:.5,distance:0,decay:2}:{}),...(type==='rect'?{target:t.map(r3),width:1,height:.6}:{})};
      commit(()=>{const s=shot();s.lights=[...(s.lights||[]),l];},{render:false});selected='Film lights > Film light · '+id;show=true;mode='move';rerender();
      status(`Added a ${ADDED_TYPES.find(x=>x[0]===type)[1].toLowerCase()} light by the camera's view. Drag its gizmo; Export cut sends it to the film.`);return;
    }
    const e=entry();if(!e)return;
    if(name==='sl-reset'){commit(()=>{const s=shot();s.lightEdits=(s.lightEdits||[]).filter(x=>x.target!==e.path);if(!s.lightEdits.length)delete s.lightEdits;},{render:false});rerender();status(e.label+' back to the film setup.');return;}
    if(name==='sl-delete'){commit(()=>{const s=shot();s.lights=(s.lights||[]).filter(x=>x.name!==e.added);if(!s.lights.length)delete s.lights;s.lightEdits=(s.lightEdits||[]).filter(x=>x.target!==e.path);if(!s.lightEdits.length)delete s.lightEdits;},{render:false});selected=null;rerender();status('Light deleted. Undo restores it.');}
  }
  // Panel events (names sl-*); 'input' edits live with one undo step per drag, 'change' commits.
  function input(el){
    const e=entry();if(!e)return false;
    if(el.name==='sl-color'){change(e,{color:el.value},'sl-color');const hex=el.closest('[data-scene-lights]')?.querySelector('[name=sl-hex]');if(hex)hex.value=el.value;return true;}
    return false;
  }
  async function changed(el){
    const name=el.name,value=el.value;
    if(name==='sl-show'){show=el.checked;if(show)await ensure();return;}
    if(name==='sl-select'){await ensure();if(value)select(value);else{selected=null;rerender();}return;}
    const e=entry();if(!e)return;await ensure();
    if(name==='sl-color')return;
    const n=Number(value),need=(min=-Infinity,max=Infinity)=>{if(value===''||!Number.isFinite(n)||n<min||n>max)throw Error('Enter a number'+(Number.isFinite(min)?` from ${min}`:'')+(Number.isFinite(max)?` to ${max}`:'')+'.');return n;};
    const pos=()=>{const p=e.light.getWorldPosition(e.light.position.clone()).toArray().map(r3);p['xyz'.indexOf(name.slice(4))]=need(-1000,1000);return p;};
    const v=name==='sl-on'?{visible:el.checked}:name==='sl-shadow'?{castShadow:el.checked}:name==='sl-type'?{type:value}:name==='sl-hex'?(()=>{const h=value.trim().replace(/^#?/,'#').toLowerCase();if(!/^#[0-9a-f]{6}$/.test(h))throw Error('Enter a colour as #rrggbb.');return {color:h};})()
      :name==='sl-intensity'?{intensity:need(0,1e5)}:name==='sl-distance'?{distance:need(0,1000)}:name==='sl-decay'?{decay:need(0,4)}:name==='sl-angle'?{angle:need(1,89)}:name==='sl-penumbra'?{penumbra:need(0,1)}
      :name==='sl-width'?{width:need(.01,50)}:name==='sl-height'?{height:need(.01,50)}:/^sl-p[xyz]$/.test(name)?{position:pos()}:null;
    if(!v)return;change(e,v);rerender();status(e.label+' updated'+(v.intensity!==undefined&&!e.added?' (intensity scale '+(editOf(e.path)?.intensityScale??1)+'×)':'')+'.');
  }
  // Lanes / Lighting now: every light with its colour, edited when the cut changes it (or added it).
  function lanes(){if(!three()?.scene)return [];refresh();return list.map(e=>({path:e.path,label:e.label,color:'#'+e.light.color.getHexString(),edited:!!(e.added||editOf(e.path)),selected:e.path===selected}));}
  function summary(){
    if(!three()?.scene)return '';refresh();const n=g=>list.filter(e=>e.group===g).length,suns=list.filter(e=>e.light.isDirectionalLight).length,edited=list.filter(e=>e.added||editOf(e.path)).length;
    const parts=[n('Room')&&`${n('Room')} lamp${n('Room')===1?'':'s'}`,suns&&'1 sun',suns>1&&`${suns-1} fill${suns===2?'':'s'}`,n('Film rig')&&`${n('Film rig')} rig`,n('Added')&&`${n('Added')} added`].filter(Boolean);
    return parts.join(', ')+(edited?` · ${edited} edited`:'');
  }
  return {panel,action,input,changed,select,lanes,summary,mixerChange,editedCount,selected:()=>selected,
    deselect(){if(selected===null)return;selected=null;rerender();},
    toggleShow:async()=>{show=!show;if(show)await ensure();rerender();return show;},setMode:m=>{mode=m;rerender();},showing:()=>show,
    // Called after film-fx (re)installs: the light objects are new, the list and markers follow.
    applied(){listSig='';refresh(true);}};
}
