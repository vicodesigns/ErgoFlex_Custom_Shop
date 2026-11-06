import {bakeCameraPlan} from './camera-spline-bake.mjs';
import {exportLighting} from './film-lighting.mjs';
import {mergeSceneLights} from './light-edits.mjs';
// The shot a film render gets: the full built film shot with the Director's edits on top.
// Camera: filmCamera below.
export function filmRenderShot(film,shot,keys){
  const seconds=shot.seconds,next={...structuredClone(film||{}),id:shot.id,room:shot.room,kind:shot.kind,seconds};
  for(const k of ['layout','mode','preset','size','title','detail'])if(shot[k]!==undefined)next[k]=shot[k];
  if(shot.motion)next.motion=structuredClone(shot.motion);
  const lit=exportLighting(shot);
  for(const k of ['ledStatus','ledNeutral','ledColor'])if(lit[k]!==undefined)next[k]=structuredClone(lit[k]);
  if(lit.ledStatus&&!lit.ledNeutral)delete next.ledNeutral;
  if(shot.sceneGlobals)next.sceneGlobals={...next.sceneGlobals,...structuredClone(shot.sceneGlobals)};
  if(lit.timeOfDay)next.timeOfDay=structuredClone(lit.timeOfDay);
  const filmed=filmCamera(film,keys,seconds);
  if(filmed){next.cameraPlan=filmed.cameraPlan;next.camera=filmed.camera;}
  delete next.lights;Object.assign(next,mergeSceneLights(film,shot));
  if(next.quality===undefined)next.quality='hq13';
  return next;
}
// The film's camera for the Director's keys (null without keys: the film shot's own camera stays): the keys
// become cameraPlan keys (at = time × seconds; the film plan's hold / cut kept for plan-NN ids, as
// director-bridge import does) baked like camera-spline.mjs. The live stage samples these same baked keys
// (player.mjs), so the Director's view is the film's frame.
export function filmCamera(film,keys,seconds){
  if(!keys?.length)return null;
  const old=[...(film?.cameraPlan?.keys||[])].sort((a,b)=>a.at-b.at),plan={...(film?.cameraPlan||{}),keys:keys.map(k=>{
    const o=/^plan-\d+$/.test(k.id)?old[Number(k.id.slice(5))]:null,e={at:Math.round(k.time*seconds*1000)/1000,position:k.view.position,target:k.view.target,fov:k.view.fov??35};
    if(k.label)e.label=k.label;if(o?.hold!==undefined)e.hold=o.hold;if(o?.cut)e.cut=o.cut;return e;})};
  return {cameraPlan:plan,camera:{keys:film?.cameraPlan?bakeCameraPlan(plan,seconds):structuredClone(keys)}};
}
// Renders single frames with the film look in a hidden stage of its own (the same calls as
// tools/experience/render-cut.cjs: film-fx around prepare, beginBake, fx.frame, bakeFrame).
export function createStillRenderer({width=1280,height=720,src='/?view=product&presentation=1&tour=1'}={}){
  let frame=null,ready=null,prepared=null,setupKey=null;
  const win=()=>frame.contentWindow;
  async function boot(){
    frame=document.createElement('iframe');frame.src=src;frame.title='Film still renderer';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    Object.assign(frame.style,{position:'fixed',left:'-20000px',top:'0',width:width+'px',height:height+'px',border:'0',pointerEvents:'none'});
    document.body.append(frame);
    const until=Date.now()+180000;while(!win()?.ErgoPresentation){if(Date.now()>until)throw Error('The film stage did not start.');await new Promise(r=>setTimeout(r,250));}
    const w=win();
    await new Promise((resolve,reject)=>{w.__filmFxDone=resolve;w.__filmFxFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="import('/tools/experience/film-fx.mjs').then(m=>{window.__filmFx=m;window.__filmFxDone();},e=>window.__filmFxFail(e));";w.document.head.append(s);});
  }
  let queue=Promise.resolve();
  const render=(shot,t)=>(queue=queue.then(()=>renderNow(shot,t),()=>renderNow(shot,t)));
  async function renderNow(shot,t){
    ready||=boot().catch(error=>{dispose();throw error;});await ready;
    const w=win(),EP=w.ErgoPresentation,fx=w.__filmFx;
    // Prepare once per scene; film-fx alone re-installs when only the film layers changed.
    const {ledStatus,ledNeutral,ledColor,sceneGlobals,camera,cameraPlan,lights,lightEdits,timeOfDay,...scene}=shot,key=JSON.stringify(scene),setup=JSON.stringify(shot);
    // Lighting-only changes update the film layers in place; anything else re-prepares the room first.
    let full=key!==prepared;
    if(!full&&setup!==setupKey){let r='full';try{r=fx.update?await fx.update(shot):'full';}catch(error){console.warn('[still] update',error);}if(r==='full')full=true;else setupKey=setup;}
    if(full){
      fx.clear();fx.beforePrepare(shot);prepared=null;setupKey=null;
      try{await EP.prepare(shot);}finally{fx.unhookPreset();}prepared=key;
      await fx.install(shot);setupKey=setup;
    }
    // prepare reads the camera on the way in; later camera-only edits go straight to the track.
    EP.cameraTrack?.(shot.camera,shot.id);EP.reduced?.(false);
    if(shot.kind==='music'&&shot.ledMode!=='media'){const now=w.performance.now;w.performance.now=()=>0;try{w.ErgoFlex.setLedEffect({mode:'spectrum',period:Number(shot.ledPeriod)||6},false);}finally{w.performance.now=now;}}
    const canvas=w.document.createElement('canvas');canvas.width=width;canvas.height=height;
    const seconds=t*shot.seconds,offset=Number(shot.screenOffset)||0;
    EP.beginBake(width,height);
    try{await fx.frame(t,seconds,{video:false});await EP.bakeFrame(t,canvas,seconds+offset);}
    finally{fx.after();EP.endBake();}
    return canvas.toDataURL('image/jpeg',.92);
  }
  function dispose(){frame?.remove();frame=null;ready=null;prepared=null;setupKey=null;}
  return {render,dispose,warm:()=>!!prepared};
}
