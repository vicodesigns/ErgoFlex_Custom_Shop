// Finish fades: a desk version's second look (the hero's gaming desk turns Pearl White just before the logo).
//
// The film carries one per sub-shot: shot.finishFade = {at:[from,to], set:{deskFinish, ledColor, ledGlow, lights, sceneGlobals…}}
// (tools/experience/finish-fade.cjs: the picture is cross-faded from the sub-shot's own look to {...sub-shot, ...set} over the chapter
// seconds from..to, smoothstep). The Director edits them as shot.finishFades = {<desk version letter>: {at, set}}: present = the cut's
// complete list (a letter that is not in it has no fade, so a film fade can be taken away); absent = the film's own. The importer
// (build-round8-director.py, director-camera-<id>.json 'finishFades') writes each one onto its sub-shot, and the film renders it.
//
// Pure: no DOM, no three. tests/finish-fades-test.mjs.
export const FADE_SET_KEYS=Object.freeze(['deskFinish','featuredBuild','ledColor','ledGlow','ledSurfaces','lights','lightEdits','sceneGlobals','sceneEdits','screens','screenGain']);
export const MIN_FADE=.1;
// The library's 'Pearl-white growing workspace' finish (room-desk-styles.mjs).
export const PEARL={wood:'Pearl White',base:'White',trim:'#f5f5f2'};
// What the white look does to a black / red desk's lights (the hero's ending, polish1126-heroend/apply-heroend.py): the product rig's
// key and rims come down so a white desk is not blown out, the LED goes warm white and the exposure drops.
const WHITE_LIGHTS={key:11,rimLeft:34,rimRight:34,kicker:7,frontLow:1.8,pool:.3},WHITE_LED='#fff6ea',WHITE_GLOW=.06,EXPOSURE_SCALE=.6;
const round=(v,n=100)=>Math.round(v*n)/n;
const num=v=>typeof v==='number'&&Number.isFinite(v);

// One fade as the cut keeps it, or null: at [from,to] chapter seconds (0 <= from < to), set an object of the known look fields.
export function cleanFade(f,{max=3600}={}){
  if(!f||typeof f!=='object'||Array.isArray(f))return null;
  const at=Array.isArray(f.at)&&f.at.length===2?f.at.map(Number):null;
  if(!at||!at.every(Number.isFinite)||at[0]<0||at[1]>max||!(at[1]>at[0]))return null;
  if(!f.set||typeof f.set!=='object'||Array.isArray(f.set))return null;
  const set={};for(const k of FADE_SET_KEYS)if(k in f.set&&f.set[k]!==undefined)set[k]=structuredClone(f.set[k]);
  if(!Object.keys(set).length||JSON.stringify(set).length>400000)return null;
  const a=round(at[0]),b=round(at[1]);if(!(b>a))return null;      // (rounded, like the importer: a hundredth is the finest fade)
  return {at:[a,b],set};
}
// shot.finishFades as the cut keeps it: {finishFades:{<letter>:fade}} ({} kept: every fade taken away), or {} when the field is absent.
export function cleanFinishFadesField(v={},seconds=null){
  const m=v?.finishFades;if(!m||typeof m!=='object'||Array.isArray(m))return {};
  const out={};
  for(const [n,f] of Object.entries(m).slice(0,12)){
    if(!/^[A-Za-z][A-Za-z0-9_-]{0,11}$/.test(n))continue;
    const c=cleanFade(f);if(!c)continue;
    // a chapter shortened after the fade was placed: one that starts past the end goes, one that runs past it ends with the chapter
    if(Number.isFinite(seconds)&&seconds>0){if(c.at[0]>=seconds-MIN_FADE)continue;if(c.at[1]>seconds)c.at[1]=round(seconds);}
    out[n]=c;
  }
  return {finishFades:out};
}
// The fades in force: the cut's own list when it has one, else the film's (each desk version's sub-shot, v.setup.finishFade).
// versions: desk-versions.mjs deskVersions() entries. -> {<letter>: fade}
export function effectiveFades(shot,versions=[]){
  if(shot?.finishFades&&typeof shot.finishFades==='object')return shot.finishFades;
  const out={};for(const v of versions||[]){const f=v?.setup?.finishFade;if(f&&Array.isArray(f.at)&&f.set)out[v.n]=f;}
  return out;
}
export const edited=shot=>!!shot?.finishFades&&typeof shot.finishFades==='object';
// The film's own fades (what Reset goes back to), as a fresh object.
export const filmFades=(versions=[])=>effectiveFades({},versions);

// The second look of a desk (a sub-shot's film shot): Pearl White wood / frame / trim, a warm white LED, softer lights and a lower
// exposure. The rig edits are the ones the hero's ending uses; a desk without the product rig only gets the finish and the LED.
export function whiteLook(sub={}){
  const out={deskFinish:{...PEARL},ledColor:WHITE_LED,ledGlow:WHITE_GLOW};
  const exposure=sub?.sceneGlobals?.exposure;
  out.sceneGlobals={...(sub?.sceneGlobals||{}),...(num(exposure)?{exposure:round(exposure*EXPOSURE_SCALE)}:{})};
  if(!Object.keys(out.sceneGlobals).length)delete out.sceneGlobals;
  if(Array.isArray(sub?.lights)&&sub.lights.length){
    const lights=structuredClone(sub.lights),rig=lights.find(l=>l?.preset==='productRig');
    if(rig){
      for(const k of ['key','rimLeft','rimRight'])if(rig[k]&&typeof rig[k]==='object')rig[k].intensity=WHITE_LIGHTS[k];
      if(rig.pool&&typeof rig.pool==='object')rig.pool.strength=WHITE_LIGHTS.pool;
      for(const l of lights)if(l&&l!==rig&&typeof l.name==='string'&&Object.hasOwn(WHITE_LIGHTS,l.name))l.intensity=WHITE_LIGHTS[l.name];
      out.lights=lights;
    }
  }
  return out;
}
// A new fade for a desk: starts `from` s into the chapter, takes `length` s, white look made from the desk's own lights.
export function newFade(sub,from,length=1.25){
  const a=round(Math.max(0,from)),b=round(a+Math.max(MIN_FADE,length));
  return {at:[a,b],set:whiteLook(sub)};
}
// The finish names / colours a fade's look shows (the lane block, the panel): wood, frame, trim.
export function looksOf(fade){const d=fade?.set?.deskFinish||{};return {wood:d.wood||'',base:d.base||'',trim:d.trim||''};}
// Move or resize a fade: part 'start' (the fade begins), 'end' (it is complete), 'both' (shift). Keeps at least MIN_FADE seconds and the
// chapter's bounds. Returns the new {at} (the set is the caller's).
export function retime(at,part,value,seconds){
  let [a,b]=at;const T=num(seconds)&&seconds>0?seconds:Infinity,v=Number(value);if(!Number.isFinite(v))return [a,b];
  if(part==='start')a=Math.min(Math.max(0,v),b-MIN_FADE);
  else if(part==='end')b=Math.max(Math.min(T,v),a+MIN_FADE);
  else{const len=b-a,na=Math.min(Math.max(0,v),Math.max(0,T-len));a=na;b=na+len;}
  return [round(a),round(b)];
}
