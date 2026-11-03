const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
export function cleanCamera(v){
  const valid=a=>Array.isArray(a)&&a.length===3&&a.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<10000);
  if(!valid(v?.position)||!valid(v?.target)||Math.hypot(...v.position.map((n,i)=>n-v.target[i]))<.001)return null;
  return {position:[...v.position],target:[...v.target],fov:number(v.fov,15,80,35),aspect:number(v.aspect,.2,5,16/9)};
}

const clamp=t=>Math.max(0,Math.min(1,Number(t)||0));
export const CAMERA_EASINGS=['smooth','linear','hold'];
export function cleanCameraKeys(value){
  if(!Array.isArray(value))return [];
  const seen=new Set();
  return value.slice(0,64).flatMap(k=>{
    const view=cleanCamera(k?.view);if(!view)return [];
    let id=typeof k.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(k.id)?k.id:crypto.randomUUID();
    if(seen.has(id))id=crypto.randomUUID();seen.add(id);
    return [{id,time:clamp(k.time),label:typeof k.label==='string'?k.label.trim().slice(0,60):'Camera view',easing:CAMERA_EASINGS.includes(k.easing)?k.easing:'smooth',...(k.path==='orbit'?{path:'orbit'}:{}),view}];
  }).sort((a,b)=>a.time-b.time).filter((k,i,a)=>i===a.length-1||a[i+1].time-k.time>.00001);
}
export function resolveCameraKeys(camera,defaults=[]){
  if(camera?.keys?.length)return camera.keys;
  if(!camera)return defaults;
  const from=camera.from||defaults[0]?.view,to=camera.to||from;
  return [{id:'camera-start',time:0,label:'Start view',easing:'smooth',view:from},{id:'camera-end',time:1,label:'End view',easing:'smooth',view:to}].filter(k=>k.view);
}
// Easing belongs to the departure key. Hold cuts to the next view at its time.
export function cameraSegment(keys,time){
  if(!keys.length)return null;
  const t=clamp(time);if(t<=keys[0].time)return {a:keys[0].view,b:keys[0].view,u:0};
  const i=keys.findIndex(k=>k.time>t);if(i<0)return {a:keys.at(-1).view,b:keys.at(-1).view,u:0};
  const a=keys[i-1],b=keys[i],p=(t-a.time)/(b.time-a.time);
  return {a:a.view,b:b.view,path:a.path||'linear',u:a.easing==='hold'?0:a.easing==='linear'?p:p*p*(3-2*p)};
}
export function sampleCamera(keys,time){
  const segment=cameraSegment(keys,time);if(!segment)return null;
  const {a,b,u,path}=segment,lerp=(x,y)=>x+(y-x)*u,target=a.target.map((n,i)=>lerp(n,b.target[i]));
  let position=a.position.map((n,i)=>lerp(n,b.position[i]));
  if(path==='orbit'){
    const from=a.position.map((n,i)=>n-a.target[i]),to=b.position.map((n,i)=>n-b.target[i]);
    const yaw=Math.atan2(from[2],from[0]),delta=Math.atan2(Math.sin(Math.atan2(to[2],to[0])-yaw),Math.cos(Math.atan2(to[2],to[0])-yaw));
    const radius=lerp(Math.hypot(...from),Math.hypot(...to)),elevation=lerp(Math.atan2(from[1],Math.hypot(from[0],from[2])),Math.atan2(to[1],Math.hypot(to[0],to[2]))),angle=yaw+delta*u;
    position=[target[0]+radius*Math.cos(elevation)*Math.cos(angle),target[1]+radius*Math.sin(elevation),target[2]+radius*Math.cos(elevation)*Math.sin(angle)];
  }
  return {position,target,fov:lerp(a.fov,b.fov),aspect:lerp(a.aspect,b.aspect)};
}
export function moveCameraKey(keys,id,time){
  const t=clamp(time);if(keys.some(k=>k.id!==id&&Math.abs(k.time-t)<.001))throw Error('There is already a keyframe at that time. Move it slightly further away.');
  return keys.map(k=>k.id===id?{...k,time:t}:k).sort((a,b)=>a.time-b.time);
}
