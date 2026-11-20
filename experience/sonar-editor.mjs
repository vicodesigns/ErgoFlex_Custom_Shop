// Graphics tab: Sonar (a proximity chapter's: the awareness chapter). Vico, 19 Nov 2026: "add the sonar in there … enable it,
// look at it when it's in full, see how many rings it shows … see how big it is, change the amount of rings per pulse and see
// the update … a tool to relocate where the center is, because I want to nudge it around."
//   Sonar on             the film's sonar for this chapter (off: no rings at all)
//   Size                 the radius the rings run to; the film's own (the distance to the obstacle where the desk stops) until set
//   Rings per pulse      how many rings are alive at once, spaced evenly (7.2 s / rings apart); the film's own is 3
//   Centre X, Z          offsets from the desk's centre, with a move tool on the stage (a gizmo on the floor)
//   Preview at full      holds the moment every ring is out at once. The editor's only: never saved, never in a render.
// The data is shot.sonar (sonar.mjs); every change goes to the stage at once (player.mjs update -> stage sonarTrack).
import {cleanSonar,FIELDS,FILM_RINGS} from './sonar.mjs';
const IN_CM=2.54,r1=v=>Math.round(v*10)/10;
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const toUnit=(inches,unit)=>unit==='cm'?Math.round(inches*IN_CM*10)/10:r1(inches);
export const fromUnit=(value,unit)=>unit==='cm'?value/IN_CM:value;
export function createSonarEditor({panel,bridge,shot,filmShot,commit,status,showing}){
  let unit='in',tool=false,gesture=0,tools=null,booting=null,timer=0;
  try{if(localStorage.getItem('ergoflex.director.sonarUnit')==='cm')unit='cm';}catch{}
  const frame=()=>document.getElementById('stage'),win=()=>frame()?.contentWindow,stage=()=>bridge.stage?.(),three=()=>stage()?.three?.();
  const available=()=>shot()?.kind==='proximity'&&!!filmShot();
  const current=()=>cleanSonar(shot().sonar!==undefined?shot().sonar:filmShot()?.sonar)||{};
  const info=()=>{try{return stage()?.sonarInfo?.()||null;}catch{return null;}};
  const host=()=>panel.querySelector('[data-sonar-host]');
  const field=n=>panel.querySelector(`[data-sonar] [name="${n}"]`);
  // One change to the chapter's sonar: a copy of what it is now, changed, cleaned (what equals the film's goes), kept. Nothing
  // left and nothing imported on the film: the key is absent again (so an untouched or put-back chapter is the film as it was).
  function write(change,text,{key=null}={}){
    const next=structuredClone(current());change(next);const clean=cleanSonar(next);
    commit(()=>{if(clean)shot().sonar=clean;else if(filmShot()?.sonar)shot().sonar={};else delete shot().sonar;},{key,render:false});
    if(text)status(text);
  }
  function panelHtml(){
    if(!available())return '';
    const c=current(),i=info(),film=i?.filmRadius,radiusIn=c.radius??film??60,rings=c.rings??FILM_RINGS,x=c.x??0,z=c.z??0,u=unit;
    const U=u==='cm'?'cm':'in',step=u==='cm'?1:.5,lo=toUnit(FIELDS.radius.min,u),hi=toUnit(FIELDS.radius.max,u),off=toUnit(FIELDS.x.max,u);
    const row=(n,label,min,max,st,value,unitText,slider=true)=>`<div class="start-pose-row sonar-row"><label for="so-${n}-n">${label}</label>${slider?`<input name="so-${n}" type="range" min="${min}" max="${max}" step="${st}" value="${value}" aria-label="${label} slider">`:'<span></span>'}<input id="so-${n}-n" name="so-${n}-n" type="number" min="${min}" max="${max}" step="${st}" value="${value}"><span class="start-pose-unit">${unitText}</span></div>`;
    const readout=i?.found?`Reach ${toUnit(i.radius,u)} ${U}${c.radius===undefined?' (the film\'s: to the obstacle where the desk stops)':` (the film's: ${toUnit(film,u)} ${U})`} · ${rings} ring${rings===1?'':'s'} per pulse (the film's: ${FILM_RINGS}) · centre ${toUnit(x,u)}, ${toUnit(z,u)} ${U}`:'The film\'s sonar shows once the chapter has loaded (the desk\'s distance to the obstacle).';
    return `<fieldset class="chapter-pacing sonar-controls" data-sonar><legend>Sonar</legend>
      <label class="director-check"><input type="checkbox" name="so-enabled" ${c.enabled===false?'':'checked'}>Sonar on <small>(the film's pulses from the desk's centre)</small></label>
      <p class="start-pose-head"><span>Units</span><select name="so-unit" aria-label="Units"><option value="in" ${u==='in'?'selected':''}>inches</option><option value="cm" ${u==='cm'?'selected':''}>centimetres</option></select></p>
      ${row('radius','Size',lo,hi,step,toUnit(radiusIn,u),U)}
      ${row('rings','Rings',FIELDS.rings.min,FIELDS.rings.max,1,rings,'per pulse')}
      <div class="start-map-position"><strong>Centre</strong><p class="director-hint">Offset from the desk's centre; it turns with the desk. X to the right, Z toward the camera.</p>
      ${row('x','X',-off,off,step,toUnit(x,u),U)}${row('z','Z',-off,off,step,toUnit(z,u),U)}</div>
      <div class="director-actions start-pose-presets"><button type="button" data-so-action="tool" aria-pressed="${tool}" title="Drag a handle on the floor to move the sonar's centre">${tool?'✓ ':''}Move centre on stage</button><button type="button" data-so-action="preview" aria-pressed="${!!i?.preview}" title="Holds the moment every ring is out at once, to look at the size and the rings. Not saved; not in a render.">${i?.preview?'✓ ':''}Preview at full</button></div>
      <div class="director-actions start-pose-presets"><button type="button" data-so-action="reset-size" ${c.radius===undefined?'disabled':''}>Film's size</button><button type="button" data-so-action="reset-rings" ${c.rings===undefined?'disabled':''}>Film's rings (${FILM_RINGS})</button><button type="button" data-so-action="reset-centre" ${c.x||c.z?'':'disabled'}>Desk's centre</button><button type="button" data-so-action="reset" ${Object.keys(c).length?'':'disabled'}>Reset all</button></div>
      <p class="director-hint" data-sonar-readout>${escape(readout)}</p>
      <p class="director-hint">Rings per pulse is how many rings are out at once; they are spaced evenly (7.2 s ÷ rings apart). A size you set is the circle the rings run to, wherever the obstacle stands. Preview at full is for looking only: it is never saved and never in a render.</p></fieldset>`;
  }
  // Refresh just this section (the stage may have loaded, the preview ended): in place, never while a field of it is being typed.
  function refresh(){const h=host();if(!h||!available())return;if(h.contains(document.activeElement)&&/INPUT|SELECT/.test(document.activeElement.tagName))return;h.innerHTML=panelHtml();syncTool();}
  function show(){
    const c=current(),i=info(),out=panel.querySelector('[data-sonar-readout]');
    for(const [n,v] of [['radius',c.radius??i?.filmRadius],['rings',c.rings??FILM_RINGS],['x',c.x??0],['z',c.z??0]]){if(v===undefined||v===null)continue;const val=n==='rings'?v:toUnit(v,unit);for(const sfx of ['','-n']){const el=field('so-'+n+sfx);if(el&&document.activeElement!==el)el.value=String(val);}}
    if(out&&i?.found)out.textContent=`Reach ${toUnit(i.radius,unit)} ${unit==='cm'?'cm':'in'} · ${c.rings??FILM_RINGS} rings per pulse · centre ${toUnit(c.x??0,unit)}, ${toUnit(c.z??0,unit)} ${unit==='cm'?'cm':'in'}`;
  }
  function typed(el,{drag=false}={}){
    const n=el.name.replace(/^so-/,'').replace(/-n$/,''),v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;
    const key=drag?'sonar-'+n+'-'+gesture:null;
    if(n==='rings')write(s=>{s.rings=Math.round(v);},`Sonar: ${Math.min(FIELDS.rings.max,Math.max(FIELDS.rings.min,Math.round(v)))} rings per pulse.`,{key});
    else if(n==='radius')write(s=>{s.radius=fromUnit(v,unit);},`Sonar size: radius ${toUnit(Math.min(FIELDS.radius.max,Math.max(FIELDS.radius.min,fromUnit(v,unit))),unit)} ${unit==='cm'?'cm':'in'}.`,{key});
    else if(n==='x'||n==='z')write(s=>{s[n]=fromUnit(v,unit);},`Sonar centre ${n.toUpperCase()}: ${toUnit(fromUnit(v,unit),unit)} ${unit==='cm'?'cm':'in'} from the desk's centre.`,{key});
    show();
  }
  panel.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-sonar] input[type=range]'))gesture++;},true);
  panel.addEventListener('input',e=>{const el=e.target;if(!el.closest?.('[data-sonar]')||!/^so-(radius|rings|x|z)$/.test(el.name))return;e.stopPropagation();try{typed(el,{drag:true});}catch(error){status(error.message,true);}},true);
  panel.addEventListener('change',e=>{const el=e.target;if(!el.closest?.('[data-sonar]'))return;e.stopPropagation();gesture++;
    try{
      if(el.name==='so-enabled'){write(s=>{if(el.checked)delete s.enabled;else s.enabled=false;},el.checked?'Sonar on.':'Sonar off for this chapter.');refresh();return;}
      if(el.name==='so-unit'){unit=el.value==='cm'?'cm':'in';try{localStorage.setItem('ergoflex.director.sonarUnit',unit);}catch{}refresh();return;}
      if(/^so-(radius|rings|x|z)-n$/.test(el.name))typed(el);
      refresh();
    }catch(error){status(error.message,true);refresh();}
  },true);
  panel.addEventListener('click',e=>{const b=e.target.closest?.('[data-sonar] [data-so-action]');if(!b)return;e.preventDefault();e.stopPropagation();
    try{
      const a=b.dataset.soAction,id=shot().id;
      if(a==='tool'){tool=!tool;syncTool();refresh();status(tool?'Move centre: drag the handle on the floor (the sonar\'s centre; the fields follow).':'Move centre tool off.');return;}
      if(a==='preview'){const on=!info()?.preview;stage()?.sonarPreview?.(on,id);status(on?'Preview at full: every ring out at once. Not saved and not in a render; Play or close the editor ends it.':'Preview at full off.');refresh();return;}
      if(a==='reset-size')write(s=>{delete s.radius;},'Sonar size: the film\'s reach again.');
      else if(a==='reset-rings')write(s=>{delete s.rings;},`Sonar rings: the film's ${FILM_RINGS} per pulse again.`);
      else if(a==='reset-centre')write(s=>{delete s.x;delete s.z;},'Sonar centre: the desk\'s centre again.');
      else if(a==='reset')write(s=>{for(const k of Object.keys(s))delete s[k];},'Sonar: back to the film\'s.');
      refresh();
    }catch(error){status(error.message,true);}});
  // ---- the move tool: a handle on the floor at the sonar's centre, with the Gumball-style gizmo the people / props use
  async function boot(){
    const w=win(),t=three();if(!w||!t)throw Error('The stage is still loading.');
    if(!w.__directorThree){
      if(!w.__dirThreeDone){w.__dirThreeDone=()=>{};w.__dirThreeFail=()=>{};const s=w.document.createElement('script');s.type='module';s.textContent="Promise.all([import('three'),import('three/addons/controls/TransformControls.js')]).then(([T,C])=>{window.__directorThree={THREE:T,TransformControls:C.TransformControls};window.__dirThreeDone();},e=>window.__dirThreeFail(e));";w.document.head.append(s);}
      await new Promise((resolve,reject)=>{const end=Date.now()+30000;(function wait(){if(w.__directorThree)resolve();else if(Date.now()>end)reject(Error('The editing tools did not load.'));else setTimeout(wait,50);})();});
    }
    const {THREE,TransformControls}=w.__directorThree,group=new THREE.Group();group.name='Director sonar tools';group.userData.directorTools=true;t.scene.add(group);
    const mat=new THREE.MeshBasicMaterial({color:0xff9bd2,transparent:true,opacity:.85,depthTest:false,side:THREE.DoubleSide}),handle=new THREE.Mesh(new THREE.RingGeometry(.5,.62,32),mat);
    handle.rotation.x=-Math.PI/2;handle.renderOrder=998;handle.userData.directorTools=true;handle.name='Director sonar centre';group.add(handle);
    const gizmo=new TransformControls(t.camera,t.renderer.domElement);gizmo.userData.directorTools=true;w.__directorSonarGizmo=gizmo;gizmo.setSize(1.2);gizmo.setSpace('world');gizmo.setMode('translate');gizmo.showY=false;gizmo.visible=false;gizmo.enabled=false;t.scene.add(gizmo);
    let orbit=true,key=0;
    gizmo.addEventListener('dragging-changed',ev=>{w.__directorDragging=ev.value;if(ev.value){orbit=t.controls.enabled;t.controls.enabled=false;key++;}else t.controls.enabled=orbit;});
    gizmo.addEventListener('objectChange',()=>{
      const sp=stage()?.sonarSpace?.();if(!sp)return;const o=sp.fromWorld(handle.position.x,handle.position.z),x=r1(o.x),z=r1(o.z);
      write(s=>{s.x=x;s.z=z;},`Sonar centre: ${toUnit(x,unit)}, ${toUnit(z,unit)} ${unit==='cm'?'cm':'in'} from the desk's centre…`,{key:'sonar-centre-'+key});show();});
    tools={THREE,group,handle,gizmo,t,mat};requestAnimationFrame(loop);return tools;
  }
  const ensure=()=>booting||=boot().catch(error=>{booting=null;throw error;});
  // The handle follows the sonar's centre (the desk rolls; the playhead moves) except while it is being dragged.
  function loop(){
    if(!tools)return;
    const on=tool&&showing()&&available(),sp=on?stage()?.sonarSpace?.():null,{handle,gizmo,THREE}=tools;
    const live=!!sp&&!!info()?.found;handle.visible=live;gizmo.visible=live;gizmo.enabled=live;
    if(live){
      if(!gizmo.dragging){const c=current(),p=sp.toWorld(c.x||0,c.z||0);handle.position.set(p.x,sp.y+.01,p.z);const s=Math.max(.05,sp.u*3);handle.scale.setScalar(s);}
      if(gizmo.object!==handle)gizmo.attach(handle);
    }else if(gizmo.object)gizmo.detach();
    requestAnimationFrame(loop);
  }
  function syncTool(){if(tool&&!tools)ensure().catch(error=>{tool=false;status(error.message,true);});}
  return {
    // The panel's HTML (empty unless the chapter is a proximity one), in a host the section refreshes itself in.
    panel:()=>`<div data-sonar-host>${panelHtml()}</div>`,
    available,applied(){clearTimeout(timer);timer=setTimeout(()=>{try{refresh();}catch{}},700);},   // (the stage has loaded the chapter: the film's reach is known)
    refresh,tool:()=>tool,
    // the chapter changed: the move tool off
    deselect(){tool=false;if(tools)tools.gizmo.detach();},
  };
}
