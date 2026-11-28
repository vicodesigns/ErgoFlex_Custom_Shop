import {withScreenLook} from './screen-look.mjs';
import {withSonar} from './sonar.mjs';
import {bakeCameraPlan} from './camera-spline-bake.mjs';
import {planFields,matchPlanKeys} from './camera-transitions.mjs';
import {exportLighting} from './film-lighting.mjs';
import {mergeSceneLights} from './light-edits.mjs';
import {mergePropEdits} from './prop-edits.mjs?v=20261127-hero-min-shown';
import {mergeBranding} from './branding-edits.mjs';
import {mergeDeskEdits} from './desk-edits.mjs';
import {mergeTrayEdits} from './tray-pose.mjs';
import {mergeFeaturedBuild} from './desk-build.mjs';
import {mergePeople} from './people-edits.mjs';
import {withStatusLight} from '../tools/experience/film-status-light.mjs';
// The film renderer composites two looks with this smoothstep. Live editing can
// switch between the looks without keeping a second WebGL stage open.
export function finishFadeAt(shot,seconds){
  const fade=shot?.finishFade;
  if(!Array.isArray(fade?.at)||!fade.set)return null;
  const [from,to]=fade.at;
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return null;
  const x=Math.max(0,Math.min(1,(seconds-from)/(to-from)));
  return {weight:x*x*(3-2*x),look:fade.set};
}
// The shot a film render gets: the full built film shot with the Director's edits on top.
// Camera: filmCamera below.
export function filmRenderShot(film,shot,keys){
  const seconds=shot.seconds,next={...structuredClone(film||{}),id:shot.id,room:shot.room,kind:shot.kind,seconds};
  for(const k of ['layout','look','mode','preset','size','title','detail','subshot'])if(shot[k]!==undefined)next[k]=shot[k];
  if(shot.motion)next.motion=structuredClone(shot.motion);
  const lit=exportLighting(shot);
  if(Array.isArray(shot.screens))next.screens=structuredClone(shot.screens);
  withScreenLook(next,shot);   // (the Graphics tab's screen look)
  // a clip whose source is not on this machine (build-round8-director.py local_screens: missing) is kept in the cut, not played
  // (only then; an entry's implicit target is its index, so the targets are pinned first)
  if(Array.isArray(next.screens)&&next.screens.some(sc=>sc?.missing===true))next.screens=next.screens.map((sc,i)=>({...sc,target:sc.target??i})).filter(sc=>sc.missing!==true);
  withSonar(next,shot);        // (the Graphics tab's Sonar, a proximity chapter's)
  for(const k of ['ledStatus','ledNeutral','ledColor'])if(lit[k]!==undefined)next[k]=structuredClone(lit[k]);
  if(lit.ledStatus&&!lit.ledNeutral)delete next.ledNeutral;
  withStatusLight(next,shot);   // (the chapter's status-light switch: false carried, true back to the default)
  if(shot.sceneGlobals)next.sceneGlobals={...next.sceneGlobals,...structuredClone(shot.sceneGlobals)};
  if(lit.timeOfDay)next.timeOfDay=structuredClone(lit.timeOfDay);
  const filmed=filmCamera(film,keys,seconds);
  if(filmed){next.cameraPlan=filmed.cameraPlan;next.camera=filmed.camera;}
  // (people: the Director's cast over the film's, as the live stage shows it: film-chapters.mjs liveFilmShot; 18 Nov 2026:
  // Render still and Film look showed the film's own cast until an Export cut brought his People edits in)
  delete next.lights;Object.assign(next,mergeSceneLights(film,shot),mergePropEdits(film,shot),mergePeople(film,shot),mergeBranding(film,shot),mergeDeskEdits(film,shot),mergeTrayEdits(film,shot),mergeFeaturedBuild(film,shot));
  if(next.quality===undefined)next.quality='hq13';
  return next;
}
// The film's camera for the Director's keys (null without keys: the film shot's own camera stays): the keys
// become cameraPlan keys (at = time × seconds; the film plan's hold / cut kept for the key that IS that plan key (matchPlanKeys), as
// director-bridge import does) baked like camera-spline.mjs. The live stage samples these same baked keys
// (player.mjs), so the Director's view is the film's frame.
export function filmCamera(film,keys,seconds){
  if(!keys?.length)return null;
  // (each key's own plan key by what it is, not by its plan-NN index: camera-transitions.mjs matchPlanKeys, 20 Nov 2026)
  const match=matchPlanKeys(keys,film?.cameraPlan?.keys,seconds),plan={...(film?.cameraPlan||{}),keys:keys.map((k,i)=>{
    const o=match[i],e={at:Math.round(k.time*seconds*1000)/1000,position:k.view.position,target:k.view.target,fov:k.view.fov??35};
    if(k.label)e.label=k.label;if(o?.hold!==undefined)e.hold=o.hold;
    // the key's own transition when it has the field (20 Nov 2026: null = none, even over a plan cut); else the plan's cut
    if('transition' in k)Object.assign(e,planFields(k.transition));else if(o?.cut)e.cut=o.cut;return e;})};
  return {cameraPlan:plan,camera:{keys:film?.cameraPlan?bakeCameraPlan(plan,seconds):structuredClone(keys)}};
}
// Renders single frames with the film look in a hidden stage of its own (the same calls as
// tools/experience/render-cut.cjs: film-fx around prepare, beginBake, fx.frame, bakeFrame).
export function createStillRenderer({width=1280,height=720,src='/?room=product&view=product&presentation=1&tour=1'}={}){
  let frame=null,ready=null,prepared=null,setupKey=null,seeded=null;
  const win=()=>frame.contentWindow;
  async function boot(){
    frame=document.createElement('iframe');frame.src=src;frame.title='Film still renderer';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    Object.assign(frame.style,{position:'fixed',left:'-20000px',top:'0',width:width+'px',height:height+'px',border:'0',pointerEvents:'none'});
    document.body.append(frame);
    const until=Date.now()+180000;while(!win()?.ErgoPresentation){if(Date.now()>until)throw Error('The film stage did not start.');await new Promise(r=>setTimeout(r,250));}
    const w=win();
    await new Promise((resolve,reject)=>{w.__filmFxDone=resolve;w.__filmFxFail=reject;const s=w.document.createElement('script');s.type='module';s.textContent="import('/tools/experience/film-fx.mjs?v=20261127-desk-version-finishes').then(m=>{window.__filmFx=m;window.__filmFxDone();},e=>window.__filmFxFail(e));";w.document.head.append(s);});
  }
  let queue=Promise.resolve();
  const render=(shot,t)=>(queue=queue.then(()=>renderFinish(shot,t),()=>renderFinish(shot,t)));
  async function renderFinish(shot,t){
    const fade=finishFadeAt(shot,t*shot.seconds);
    let canvas;
    if(!fade?.weight)canvas=await renderNow(shot,t);
    else{
      const after={...shot,...fade.look};
      if(fade.weight===1)canvas=await renderNow(after,t);
      else{
        canvas=await renderNow(shot,t);
        const end=await renderNow(after,t),ctx=canvas.getContext('2d');
        ctx.save();ctx.globalAlpha=fade.weight;ctx.drawImage(end,0,0);ctx.restore();
      }
    }
    return canvas.toDataURL('image/jpeg',.92);
  }
  async function renderNow(shot,t){
    ready||=boot().catch(error=>{dispose();throw error;});await ready;
    const w=win(),EP=w.ErgoPresentation,fx=w.__filmFx;
    // Prepare once per scene; film-fx alone re-installs when only the film layers changed.
    const {ledStatus,ledNeutral,ledColor,sceneGlobals,camera,cameraPlan,lights,lightEdits,timeOfDay,sceneEdits,sceneBranding,sceneDeskEdits,featuredBuild,...scene}=shot,storage=shot.__storage||null,key=JSON.stringify(scene)+'|'+(storage?.url||''),setup=JSON.stringify(shot);
    // Lighting, prop (sceneEdits), branding and desk changes update the film layers in place; anything else re-prepares the room first.
    let full=key!==prepared;
    if(!full&&setup!==setupKey){let r='full';try{r=fx.update?await fx.update(shot):'full';}catch(error){console.warn('[still] update',error);}if(r==='full')full=true;else setupKey=setup;}
    if(full){
      // A render storage seed (desk-versions.mjs: the finale's --storage) goes into this stage's memory-only storage.
      if(w.__ERGO_PRESENTATION__){const ls=w.localStorage;if(seeded){for(const [k,v] of seeded)if(v===null)ls.removeItem(k);else ls.setItem(k,v);seeded=null;}
        if(storage){seeded=new Map();for(const [k,v] of Object.entries(storage.values)){seeded.set(k,ls.getItem(k));ls.setItem(k,v);}}}
      fx.clear();await fx.settled?.();fx.beforePrepare(shot);prepared=null;setupKey=null;
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
    return canvas;
  }
  function dispose(){frame?.remove();frame=null;ready=null;prepared=null;setupKey=null;seeded=null;}
  return {render,dispose,warm:()=>!!prepared};
}
