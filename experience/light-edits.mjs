// Scene lights edited in the Director, applied by tools/experience/film-fx.mjs (live stage,
// Render still and the film renderer alike):
//   shot.lights      the film's own format (film-edits.mjs installLights); the Director's
//                    additions are named 'director-…' and append to the film's lights
//   shot.lightEdits  [{target, position?, aim?, color?, intensityScale?, distance?, decay?,
//                    angle?, penumbra?, width?, height?, visible?, castShadow?}]
//     target  the light's path from the scene root: object names (or types) joined by ' > ',
//             '#n' for the n-th sibling with the same label (lightPath below)
//     position / aim  world [x, y, z] (aim: a spot's target point)
//     intensityScale  multiplies whatever drives the light (keyframes, time of day), so keyed
//             lights keep their shape;  angle in degrees.
// No THREE import: vectors come from the lights' own realm (the stage frame).
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const num=(v,min,max)=>finite(v)?Math.max(min,Math.min(max,v)):undefined;
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n)&&Math.abs(n)<10000)?v.map(n=>Math.round(n*1e4)/1e4):undefined;
const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():undefined;
const keep=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined));
export const ADDED_TYPES=[['point','Point'],['spot','Spot'],['rect','Area (soft)']];
export function cleanAddedLight(l){
  if(!l||typeof l.name!=='string'||!/^director-[A-Za-z0-9_-]{1,60}$/.test(l.name)||!ADDED_TYPES.some(t=>t[0]===l.type))return null;
  const position=vec(l.position);if(!position)return null;
  return keep({name:l.name,type:l.type,position,target:vec(l.target),color:hex(l.color)||'#ffffff',intensity:num(l.intensity,0,1e5)??10,distance:num(l.distance,0,1000),decay:num(l.decay,0,4),
    angle:num(l.angle,1,89),penumbra:num(l.penumbra,0,1),width:num(l.width,.01,50),height:num(l.height,.01,50),castShadow:typeof l.castShadow==='boolean'?l.castShadow:undefined});
}
const EDIT_NUMBERS={intensityScale:[0,1000],distance:[0,1000],decay:[0,4],angle:[1,89],penumbra:[0,1],width:[.01,50],height:[.01,50]};
export function cleanLightEdit(e){
  if(typeof e?.target!=='string'||!e.target||e.target.length>300)return null;
  const out={target:e.target,position:vec(e.position),aim:vec(e.aim),color:hex(e.color)};
  for(const [k,[min,max]] of Object.entries(EDIT_NUMBERS))out[k]=num(e[k],min,max);
  for(const k of ['visible','castShadow'])if(typeof e[k]==='boolean')out[k]=e[k];
  const clean=keep(out);return Object.keys(clean).length>1?clean:null;
}
export function cleanSceneLights(v={}){
  const out={};
  if(Array.isArray(v.lights)){const seen=new Set();out.lights=v.lights.slice(0,64).map(cleanAddedLight).filter(l=>l&&!seen.has(l.name)&&seen.add(l.name));if(!out.lights.length)delete out.lights;}
  if(Array.isArray(v.lightEdits)){const by=new Map();for(const e of v.lightEdits.slice(0,200).map(cleanLightEdit))if(e)by.set(e.target,{...by.get(e.target),...e});out.lightEdits=[...by.values()];if(!out.lightEdits.length)delete out.lightEdits;}
  return out;
}
// The film's lights plus the Director's (an added light replaces a film light of the same name).
export function mergeSceneLights(film,shot){
  const out={},added=shot.lights||[],names=new Set(added.map(l=>l.name));
  const lights=[...(film?.lights||[]).filter(l=>!names.has(l.name)),...added];if(lights.length)out.lights=structuredClone(lights);
  if(shot.lightEdits?.length)out.lightEdits=structuredClone(shot.lightEdits);
  return out;
}
// Stable light paths.
const label=o=>o.name||o.type;
export function lightPath(o,root){
  const parts=[];
  for(let p=o;p&&p!==root;p=p.parent){const same=(p.parent?.children||[]).filter(c=>label(c)===label(p)),i=same.indexOf(p);parts.unshift(label(p)+(i>0?'#'+i:''));}
  return parts.join(' > ');
}
export function sceneLightList(root,skip=()=>false){const list=[];root?.traverse(o=>{if(o.isLight&&!skip(o))list.push({light:o,path:lightPath(o,root)});});return list;}
export const findLight=(root,target)=>sceneLightList(root).find(l=>l.path===target)?.light||null;
// Snapshot / restore everything an edit can touch.
export function snapshotLight(light){
  return {position:light.position.clone(),color:light.color.clone(),distance:light.distance,decay:light.decay,angle:light.angle,penumbra:light.penumbra,width:light.width,height:light.height,
    visible:light.visible,castShadow:light.castShadow,aim:light.target?.position.clone(),quaternion:light.quaternion.clone()};
}
export function restoreLight(light,s){
  light.position.copy(s.position);light.quaternion.copy(s.quaternion);light.color.copy(s.color);light.visible=s.visible;light.castShadow=s.castShadow;
  for(const k of ['distance','decay','angle','penumbra','width','height'])if(s[k]!==undefined)light[k]=s[k];
  if(s.aim&&light.target)light.target.position.copy(s.aim);light.updateMatrixWorld(true);light.target?.updateMatrixWorld(true);
}
const toLocal=(obj,world)=>{const v=obj.position.clone().set(...world);if(obj.parent){obj.parent.updateMatrixWorld(true);obj.parent.worldToLocal(v);}return v;};
// Absolute fields (intensityScale is the accessor in installLightEdits).
export function applyLightEdit(light,e){
  if(e.position){light.position.copy(toLocal(light,e.position));}
  if(e.aim&&light.target){light.target.position.copy(toLocal(light.target,e.aim));light.target.updateMatrixWorld(true);}
  if(light.isRectAreaLight&&(e.position||e.aim)){const at=e.aim||light.userData.directorAim;if(at){light.updateMatrixWorld(true);light.lookAt(light.position.clone().set(...at));}}
  if(e.color)light.color.set(e.color);
  if(e.angle!==undefined&&'angle' in light)light.angle=e.angle*Math.PI/180;
  for(const k of ['distance','decay','penumbra','width','height'])if(e[k]!==undefined&&k in light)light[k]=e[k];
  if(e.visible!==undefined)light.visible=e.visible;if(e.castShadow!==undefined)light.castShadow=e.castShadow;
  light.updateMatrixWorld(true);
}
export function installLightEdits(edits,root){
  const done=[],missing=[];
  for(const e of edits||[]){
    const light=findLight(root,e.target);if(!light){missing.push(e.target);continue;}
    // The film's own place (before this edit), so the Director names a light the same wherever it is moved.
    if(!light.userData.directorFilmPosition)light.userData.directorFilmPosition=light.getWorldPosition(light.position.clone()).toArray();
    const saved=snapshotLight(light),own=Object.getOwnPropertyDescriptor(light,'intensity');let undoScale=null;
    if(e.intensityScale!==undefined&&e.intensityScale!==1){
      // Chain over any accessor already there (sceneEdits light multipliers): writers keep writing the raw value.
      let raw=light.intensity;const scale=e.intensityScale,get=own?.get,set=own?.set;
      Object.defineProperty(light,'intensity',{configurable:true,enumerable:true,get:()=>(get?get.call(light):raw)*scale,set:v=>{if(set)set.call(light,v);else raw=v;}});
      undoScale=()=>{delete light.intensity;if(own?.get||own?.set)Object.defineProperty(light,'intensity',own);else Object.defineProperty(light,'intensity',{configurable:true,enumerable:true,writable:true,value:raw});};
    }
    applyLightEdit(light,e);done.push({light,e,saved,undoScale});
  }
  return {count:done.length,missing,
    apply(){for(const d of done)applyLightEdit(d.light,{...d.e,intensityScale:undefined});},
    restore(){for(const d of done.reverse()){d.undoScale?.();restoreLight(d.light,d.saved);}}};
}
