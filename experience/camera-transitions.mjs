// Camera transitions between camera keys (Vico, 20 Nov 2026: "a cut, a dissolve, a dip, like Premiere / DaVinci, the length
// dragged on the timeline"). A transition sits on the key it goes INTO (the edit point at that key's time, as the film's
// cameraPlan `cut: true` does), centred on it:
//   key.transition = {type:'cut'}                                    the camera jumps to this view at its time
//                  = {type:'dissolve'|'dip-black'|'dip-white', dur}   dur seconds, centred on the key's time
//                  = null (film chapters: explicitly none, so an inherited plan cut stays removed) or absent (the move)
// The camera itself always switches at the key's time (the film bakes these keys as cut: true); a dissolve mixes the
// outgoing and the incoming views over [t - dur/2, t + dur/2], a dip goes through black / white and back. The film writes
// them as cameraPlan keys {cut: true, transition: {type, dur}}; the 4K render composites them (the render side: Windows;
// until it lands a dissolve or dip renders as a plain cut).
// Pure, except createTransitionPreview (the stage's freeze frames and the dip layer).
export const TRANSITION_TYPES=['cut','dissolve','dip-black','dip-white'];
export const TRANSITION_LABELS={move:'Move',cut:'Cut',dissolve:'Dissolve','dip-black':'Dip to black','dip-white':'Dip to white'};
export const DEFAULT_DUR=.8,MIN_DUR=2/30,MAX_DUR=3;
const r3=v=>Math.round(v*1000)/1000;
export const hasLength=t=>!!t&&t.type!=='cut';
// A transition as stored: null for none, {type:'cut'}, or {type, dur} with dur in [MIN_DUR, MAX_DUR].
export function cleanTransition(v){
  if(!v||typeof v!=='object'||!TRANSITION_TYPES.includes(v.type))return null;
  if(v.type==='cut')return {type:'cut'};
  const d=Number(v.dur);return {type:v.type,dur:r3(Math.max(MIN_DUR,Math.min(MAX_DUR,Number.isFinite(d)?d:DEFAULT_DUR)))};
}
const half=k=>hasLength(k?.transition)?k.transition.dur/2:0;
// The longest transition key i can have (seconds): its band stays clear of the neighbouring keys' bands and inside the
// chapter. keys: [{time (0..1), transition?}] sorted; seconds: the chapter's length.
export function transitionRoom(keys,i,seconds){
  if(i<=0||i>=keys.length)return 0;
  const t=keys[i].time*seconds,lo=keys[i-1].time*seconds+half(keys[i-1]),hi=i+1<keys.length?keys[i+1].time*seconds-half(keys[i+1]):seconds;
  return Math.max(0,Math.min(MAX_DUR,2*Math.min(t-lo,hi-t)));
}
// Keys with key `id`'s transition set (null / {type:'move'}: removed; the length clamped to the room). Film chapters keep an
// explicit null (an inherited plan cut stays removed); `explicit` false drops the field instead.
export function setTransition(keys,id,value,seconds,{explicit=true}={}){
  const i=keys.findIndex(k=>k.id===id);if(i<0)throw Error('That camera view is gone.');
  if(i===0&&value&&value.type!=='move')throw Error('The first camera view has no view before it to come from.');
  let t=value?.type==='move'?null:cleanTransition(value);
  if(hasLength(t)){const room=transitionRoom(keys,i,seconds);if(room<MIN_DUR)throw Error('No room for a '+TRANSITION_LABELS[t.type].toLowerCase()+' here: the views around it are too close. Use a cut, or move the views apart.');t={...t,dur:r3(Math.min(t.dur,room))};}
  return keys.map((k,j)=>{if(j!==i)return k;const n={...k};if(t)n.transition=t;else if(explicit)n.transition=null;else delete n.transition;return n;});
}
// ---- the film's cameraPlan ------------------------------------------------------------------------------------------
// A Director key's transition as cameraPlan fields (film-render.mjs filmCamera, director-bridge.py import).
export function planFields(t){
  const c=cleanTransition(t);if(!c)return {};
  return c.type==='cut'?{cut:true}:{cut:true,transition:{type:c.type,dur:c.dur}};
}
// A cameraPlan key's transition for the Director (filmCameraKeys): cut: true -> {type:'cut'} unless it carries its own.
export function fromPlan(k){
  if(!k?.cut)return null;
  return cleanTransition(k.transition)||{type:'cut'};
}
// ---- what the preview shows at chapter second t ----------------------------------------------------------------------
// keys: Director keys (time 0..1). -> null, or {key, from, type, p (0..1 across the band), dip (layer opacity),
// mix (the other view's opacity), other: 'in'|'out' (which freeze frame lies over the live view)}
export function transitionAt(keys,t,seconds){
  for(let i=1;i<keys.length;i++){
    const k=keys[i],tr=k.transition;if(!hasLength(tr))continue;
    const at=k.time*seconds,a=at-tr.dur/2,b=at+tr.dur/2;if(t<a||t>b)continue;
    const p=Math.max(0,Math.min(1,(t-a)/tr.dur));
    if(tr.type==='dissolve')return {key:k,from:keys[i-1],type:tr.type,p,dip:0,mix:t<at?p:1-p,other:t<at?'in':'out'};
    return {key:k,from:keys[i-1],type:tr.type,p,dip:1-Math.abs(2*p-1),mix:0,other:null};
  }
  return null;
}
// The band each keyed transition draws on the timeline: [{id, type, dur, start, end} in seconds].
export const transitionBands=(keys,seconds)=>keys.flatMap((k,i)=>i>0&&hasLength(k.transition)?[{id:k.id,type:k.transition.type,dur:k.transition.dur,start:k.time*seconds-k.transition.dur/2,end:k.time*seconds+k.transition.dur/2}]:[]);
// A band edge dragged to chapter second x: the new length (symmetric about the key), clamped to the room.
export function dragLength(keys,id,x,seconds){
  const i=keys.findIndex(k=>k.id===id);if(i<1)return null;
  return r3(Math.max(MIN_DUR,Math.min(transitionRoom(keys,i,seconds),2*Math.abs(x-keys[i].time*seconds))));
}

// ---- the Director preview (the stage's own renderer) ----------------------------------------------------------------
// Dips: a black / white layer over the stage, its opacity from the playhead (exact). Dissolves: FREEZE FRAMES of the two
// views (rendered once with the stage's renderer and a copy of its camera), the other view's frame laid over the live one
// (the outgoing view's motion is frozen in the preview; the film renders it moving).
export function createTransitionPreview({stage,doc,room=()=>null}){
  let layer=null,canvas=null,cache=new Map();
  function host(){
    const d=doc();if(!d?.body)return null;
    if(layer?.ownerDocument!==d){
      layer=d.createElement('div');layer.dataset.cameraTransition='';Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'2147483000',opacity:'0',display:'none'});
      canvas=d.createElement('canvas');canvas.dataset.cameraTransitionFrame='';Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2147482999',opacity:'0',display:'none'});
      d.body.append(canvas,layer);cache=new Map();
    }
    return {layer,canvas};
  }
  // the view rendered once (cached by view and size) as an ImageBitmap-like canvas
  function frameOf(view){
    const t=stage()?.three?.();if(!t?.renderer||!t.camera||!t.scene)return null;
    const el=t.renderer.domElement,key=JSON.stringify([view.position,view.target,view.fov,el.width,el.height]);
    if(cache.has(key))return cache.get(key);
    const cam=t.camera.clone();cam.position.set(...view.position);cam.fov=view.fov??cam.fov;cam.updateProjectionMatrix();cam.lookAt(...view.target);cam.updateMatrixWorld(true);
    const r=room();
    try{r?.update?.(cam);}catch{}
    t.renderer.render(t.scene,cam);
    const copy=el.ownerDocument.createElement('canvas');copy.width=el.width;copy.height=el.height;copy.getContext('2d').drawImage(el,0,0);
    try{r?.update?.(t.camera);}catch{}
    t.renderer.render(t.scene,t.camera);   // (the live view back at once)
    if(cache.size>8)cache.delete(cache.keys().next().value);cache.set(key,copy);return copy;
  }
  function hide(){if(layer){layer.style.display='none';layer.style.opacity='0';}if(canvas){canvas.style.display='none';canvas.style.opacity='0';}}
  return {
    // at chapter second t of keys: show what the transition looks like (or nothing)
    update(keys,t,seconds){
      const now=transitionAt(keys,t,seconds),h=now?host():null;if(!now||!h){hide();return null;}
      if(now.type==='dissolve'){
        h.layer.style.display='none';const view=(now.other==='in'?now.key:now.from).view,f=view&&frameOf(view);if(!f){hide();return now;}
        const c=h.canvas;if(c.width!==f.width||c.height!==f.height){c.width=f.width;c.height=f.height;}c.getContext('2d').drawImage(f,0,0);
        c.style.display='block';c.style.opacity=String(now.mix);return now;
      }
      h.canvas.style.display='none';h.layer.style.background=now.type==='dip-white'?'#fff':'#000';h.layer.style.display='block';h.layer.style.opacity=String(now.dip);return now;
    },
    hide,forget(){cache=new Map();},
  };
}
