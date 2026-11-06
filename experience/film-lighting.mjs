// Film desk lighting (tools/experience/film-status.mjs reads these shot fields):
//   ledStatus  [{at, dur, kind, fade, fadeIn?, mode?, reverse?}]  one desk-light state at a time (seconds)
//   ledNeutral [[seconds, '#hex'], …]  the neutral white over time (smoothstep between keys); else ledColor
//   ledColor   '#hex'  the neutral white;  sceneGlobals.roomLight  room LED spill level
//   sceneGlobals.exposureScale / environmentScale  room brightness / ambient (image) light: a number or
//              keys [[seconds, value], …]; only the fields the Director touched
// The Director keeps an id on each event / key (third tuple slot) for selection; exportLighting drops them.
export const LIGHT_KINDS=[['lift-up','Lift up · blue','#2f6bff'],['lift-down','Lift down · red','#ff3b30'],['tilt-retract','Tilt retract · purple','#9600ff'],['tilt-extend','Tilt extend · yellow-green','#d8f000'],['wheels','Wheels · red / amber','#ff5a1f'],['off','Off · dark','#30363c'],['collision','Collision · red breathe','#c4002a'],['proximity','Proximity · amber breathe','#ff9a00']];
export const WHEEL_MODES=['Strafe left','Strafe right','Forward','Back','Rotate CW','Rotate CCW','Diagonal left-forward','Diagonal left-back','Diagonal right-forward','Diagonal right-back'];
export const WARM='#52483c';
const kinds=LIGHT_KINDS.map(k=>k[0]);
const num=(v,min,max,fallback)=>Number.isFinite(Number(v))&&v!==null&&v!==''&&typeof v!=='boolean'?Math.max(min,Math.min(max,Number(v))):fallback;
const hexOk=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v)?v:null;
export const lightKindColor=kind=>LIGHT_KINDS.find(k=>k[0]===kind)?.[2]||'#888888';
export function cleanLighting(v={}){
  const out={},seen=new Set(),unique=id=>{id=safeId(id)||crypto.randomUUID();while(seen.has(id))id=crypto.randomUUID();seen.add(id);return id;};
  if(Array.isArray(v.ledStatus))out.ledStatus=v.ledStatus.slice(0,200).flatMap(e=>{
    if(!kinds.includes(e?.kind))return [];const at=num(e.at,0,90,null),dur=num(e.dur,.01,90,null);if(at===null||dur===null)return [];
    const c={id:unique(e.id),at,dur,kind:e.kind};
    if(e.fade!==undefined)c.fade=num(e.fade,0,10,1);if(e.fadeIn!==undefined)c.fadeIn=num(e.fadeIn,0,10,0);
    if(e.mode!==undefined)c.mode=Math.round(num(e.mode,1,10,3));if(typeof e.reverse==='boolean')c.reverse=e.reverse;
    return [c];
  }).sort((a,b)=>a.at-b.at);
  if(Array.isArray(v.ledNeutral))out.ledNeutral=v.ledNeutral.slice(0,64).flatMap(k=>Array.isArray(k)&&num(k[0],0,90,null)!==null&&hexOk(k[1])?[[num(k[0],0,90,0),k[1].toLowerCase(),unique(k[2])]]:[]).sort((a,b)=>a[0]-b[0]);
  if(hexOk(v.ledColor))out.ledColor=v.ledColor.toLowerCase();
  // timeOfDay [{at, mode, ease?}]: the room blends from one daypart preset to the next across each gap.
  if(Array.isArray(v.timeOfDay))out.timeOfDay=v.timeOfDay.slice(0,32).flatMap(k=>typeof k?.mode==='string'&&/^[a-z0-9-]{1,40}$/.test(k.mode)&&num(k.at,0,90,null)!==null?[{id:unique(k.id),at:num(k.at,0,90,0),mode:k.mode,...(k.ease==='smooth'||k.ease==='linear'?{ease:k.ease}:{})}]:[]).sort((a,b)=>a.at-b.at);
  const g=v.sceneGlobals||{},globals={},room=num(g.roomLight,0,4,null);if(room!==null)globals.roomLight=room;
  for(const k of ['exposureScale','environmentScale']){const x=g[k];if(Array.isArray(x)){const keys=x.slice(0,64).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])).map(p=>[num(p[0],0,90,0),num(p[1],0,20,1)]);if(keys.length)globals[k]=keys;}else{const n=num(x,0,20,null);if(n!==null)globals[k]=n;}}
  if(Object.keys(globals).length)out.sceneGlobals=globals;
  return out;
}
// The film's own field shapes: no Director ids.
export function exportLighting(shot){
  const s={...shot};
  if(Array.isArray(s.ledStatus))s.ledStatus=s.ledStatus.map(({id,...e})=>e);
  if(Array.isArray(s.ledNeutral))s.ledNeutral=s.ledNeutral.map(k=>[k[0],k[1]]);
  if(Array.isArray(s.timeOfDay))s.timeOfDay=s.timeOfDay.map(({id,...k})=>k);
  return s;
}
// Linear-light colour helpers (sRGB transfer).
const lin=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4,srgb=c=>c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055;
export const toLinear=hex=>[1,3,5].map(i=>lin(parseInt(hex.slice(i,i+2),16)/255));
export const toHex=rgb=>'#'+rgb.map(c=>Math.round(Math.max(0,Math.min(1,srgb(Math.max(0,c))))*255).toString(16).padStart(2,'0')).join('');
const luma=rgb=>.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
export function scaleColor(hex,k){return toHex(toLinear(hex).map(c=>c*k));}
// Warmth 0 = true white, 1 = the evening warm hue, at the same brightness (luminance).
function hues(){const w=toLinear(WARM),l=luma(w);return {warm:w.map(c=>c/l)};}
export function warmthOf(hex){
  const c=toLinear(hex),l=luma(c);if(l<=1e-6)return 0;const {warm}=hues(),d=warm.map(v=>v-1),u=c.map(v=>v/l-1);
  return Math.max(0,Math.min(1,d.reduce((n,v,i)=>n+v*u[i],0)/d.reduce((n,v)=>n+v*v,0)));
}
export function withWarmth(hex,w){const c=toLinear(hex),l=luma(c)||1e-4,{warm}=hues();return toHex(warm.map(v=>l*(1+(v-1)*w)));}
export const brightnessOf=hex=>luma(toLinear(hex));
// Perceptual lightness (CIE L*, 0-100) and a colour with the same chromaticity at another lightness.
export function lightnessOf(hex){const y=luma(toLinear(hex));return y>216/24389?116*Math.cbrt(y)-16:y*24389/27;}
export function withLightness(hex,L){
  const target=L<=8?L*27/24389:((L+16)/116)**3,c=toLinear(hex),y=luma(c);
  if(target<=0)return '#000000';if(y<=1e-6)return toHex([target,target,target]);return toHex(c.map(v=>v*target/y));
}
// Presets for the desk white: the film's day white, softer and warmer whites, the evening warm, off.
export const WHITE_PRESETS=[['True white','#929292'],['Soft white','#8f877c'],['Golden white','#7a6a55'],['Warm white','#52483c'],['Off','#000000']];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function neutralAt(keys,t){
  if(!keys.length)return '#ffffff';const i=keys.findIndex(k=>k[0]>t);if(i<0)return keys.at(-1)[1];if(i===0)return keys[0][1];
  const a=keys[i-1],b=keys[i],u=smooth((t-a[0])/Math.max(1e-6,b[0]-a[0])),x=toLinear(a[1]),y=toLinear(b[1]);return toHex(x.map((v,n)=>v+(y[n]-v)*u));
}
// Desk white key names by warmth; daypart tints for the Time of day lane.
export const whiteName=hex=>{const p=WHITE_PRESETS.find(p=>p[1]===String(hex).toLowerCase());if(p)return p[0];if(lightnessOf(hex)<1)return 'Off';const w=warmthOf(hex);return w<.2?'True white':w<.55?'Soft white':w<.88?'Golden white':'Warm white';};
export const DAYPART_TINTS={morning:'#ffcf8a',day:'#fff3d6',afternoon:'#fff3d6',evening:'#ff8a4a',sunset:'#ff8a4a',night:'#2d3a78',party:'#b04cff',focus:'#dfe9ff',calm:'#9fc7ff'};
export function daypartAt(keys,t){
  const tint=m=>DAYPART_TINTS[m]||'#8899aa';if(!keys.length)return '#8899aa';const i=keys.findIndex(k=>k.at>t);if(i<0)return tint(keys.at(-1).mode);if(i===0)return tint(keys[0].mode);
  const a=keys[i-1],b=keys[i];let u=(t-a.at)/Math.max(1e-6,b.at-a.at);if(b.ease==='smooth')u=smooth(u);const x=toLinear(tint(a.mode)),y=toLinear(tint(b.mode));return toHex(x.map((v,n)=>v+(y[n]-v)*u));
}
export const statusAt=(events,t)=>events.find(e=>t>=e.at&&t<e.at+e.dur)||null;
// The strip colour at a time: the active state's colour, else the neutral white.
export function lightAt(light,t){const e=statusAt(light.status,t);return e?lightKindColor(e.kind):neutralAt(light.neutral,t);}
export function validateStatus(events,seconds){
  const list=[...events].sort((a,b)=>a.at-b.at);
  for(const e of list)if(e.at<0||e.dur<=0||e.at+e.dur>seconds+1e-5)throw Error(`Light states must fit inside the ${seconds}-second chapter.`);
  for(let i=1;i<list.length;i++)if(list[i].at<list[i-1].at+list[i-1].dur-1e-5)throw Error('Two light states cannot overlap: the desk shows one state at a time.');
}
