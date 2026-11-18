// When the desk itself puts an item away. The film's own desk items are not timed in the cut: the desk's auto-stow
// (desk-auto-stow.mjs deskItemDisposition) hides the easel and the painter shelf of an artist desk once the tilt falls
// below EASEL_ANGLE, and the drafting kit of an architect desk once it rises to it. The Props lane draws a bar for each
// of those items, so the bar must end where the stow hides it, not run to the end of the desk's stretch.
// Pure (no THREE): the same name rules and angles as desk-auto-stow.mjs; tests/prop-stow-window-test.mjs checks that
// both agree. Names: the object's accessory id / prop id / name, lower case.
export const EASEL_ANGLE=50,STOW_ANGLE=9;
const PAINTER=/painter-shelf|painter accessory shelf/,EASEL=/artist-easel|art-easel|artist easel|artist painting|canvas/,DRAFTING=/drafting-kit|drafting board|architect floor plan/;
const FIXED=/task-light|clamp|easel-rail|easel-accessory|keyboard-tray|cable-tray|cpu-holder|led-strip|monitor-arm|monitor mount/;
// Does the tilt rule decide this item's visibility? (an item a rule keeps in place for good has no window)
export const hasStowRule=text=>{const t=String(text||'').toLowerCase();return PAINTER.test(t)||EASEL.test(t)||DRAFTING.test(t);};
// true: the desk hides the item at this tilt (degrees).
export function stowHides(text,tilt,recipe=''){
  const t=String(text||'').toLowerCase();if(tilt<=STOW_ANGLE)return false;
  if(PAINTER.test(t))return !(tilt>=EASEL_ANGLE);
  if(EASEL.test(t))return !(recipe==='architect'?tilt<EASEL_ANGLE:tilt>=EASEL_ANGLE);
  if(DRAFTING.test(t))return !(tilt<EASEL_ANGLE);
  return false;
}
// The seconds, within [lo, hi], in which the item is on screen as the desk stows it: {from, to}, or null when it is
// there the whole time (or never: the bar then stays whole). tiltAt(seconds) -> degrees.
export function stowWindow(text,recipe,tiltAt,lo,hi,step=.05){
  if(!hasStowRule(text)||!(hi>lo))return null;
  const shown=t=>!stowHides(text,tiltAt(t),recipe);
  let first=null,last=null;
  for(let t=lo;t<=hi+1e-9;t+=step){const tt=Math.min(hi,t);if(shown(tt)){if(first===null)first=tt;last=tt;}}
  if(first===null||(first<=lo+1e-9&&last>=hi-step))return null;
  const edge=(a,b,inside)=>{for(let i=0;i<14;i++){const m=(a+b)/2;if(shown(m)===inside)a=m;else b=m;}return a;};   // a is shown, b is not
  const from=first<=lo+1e-9?lo:edge(first,Math.max(lo,first-step),true),to=last>=hi-1e-9?hi:edge(last,Math.min(hi,last+step),true);
  const r=v=>Math.round(v*100)/100;
  return {from:r(from),to:r(to)};
}

// ---- The film's own timing of a desk item (17 Nov 2026, Vico, create in his 2nd cut: the painter shelf "really comes
// in at 12.7" while the Props lane said "the whole chapter"). film-fx accessories.add[].visible keys hold an item hidden
// (0) or shown (1) from each key on, whatever the desk's auto-stow does; null (and before the first key) hands it back
// to the desk (tools/experience/film-fx.mjs timeVisible / visibleAt). create: painter shelf [[0,0],[12.6,1]], easel
// [[0,0],[17.4,1]], drafting kit and easel rail [[0,0],[7,1],[18.8,0]].
const words=s=>String(s||'').toLowerCase().replace(/\\/g,'');
// The visible keys the film gives an item ('painter-shelf' is Accessory:painter-shelf, a library prop's id Prop:<id>),
// sorted, or null. text: the item's ids and names (any order, lower or upper case).
export function filmVisibleKeys(accessories,text){
  const t=words(text);
  for(const a of accessories?.add||[]){
    const id=typeof a==='string'?a:a?.id;if(typeof id!=='string'||!id||!Array.isArray(a?.visible))continue;
    const re=new RegExp('(^|[^a-z0-9-])'+id.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z0-9-])');
    if(re.test(t))return [...a.visible].filter(k=>Array.isArray(k)&&Number.isFinite(k[0])).sort((p,q)=>p[0]-q[0]);
  }
  return null;
}
// The film's word at chapter seconds s: true / false, or null (the desk decides). The same rule as film-fx visibleAt.
export const forcedAt=(keys,s)=>{let v=null;for(const [at,on] of keys||[])if(s>=at)v=on===null?null:!!on;return v;};
// The stretches of [lo, hi] in which the item is drawn: the film's keys where they hold, else the desk's tilt rule
// (tiltAt: seconds -> degrees, or null: no rule known). [{from, to}] in time order, rounded to a hundredth; [] never.
export function shownStretches({text='',recipe='',tiltAt=null,keys=null,lo,hi,step=.05}){
  if(!(hi>lo))return [];
  const rule=!!tiltAt&&hasStowRule(text);
  const shown=t=>{const f=forcedAt(keys,t);return f!==null?f:!rule||!stowHides(text,tiltAt(t),recipe);};
  const edge=(a,b)=>{const inside=shown(a);for(let i=0;i<20;i++){const m=(a+b)/2;if(shown(m)===inside)a=m;else b=m;}return (a+b)/2;};
  // sample points: the step grid plus every key (a key between two samples could hide a short stretch)
  const ts=new Set();for(let t=lo;t<hi;t+=step)ts.add(+t.toFixed(6));ts.add(hi);for(const [at] of keys||[])if(at>lo&&at<hi){ts.add(at);ts.add(Math.max(lo,at-1e-4));}
  const pts=[...ts].sort((a,b)=>a-b),out=[],r=v=>Math.round(v*100)/100;let start=shown(pts[0])?lo:null;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],sa=shown(a),sb=shown(b);if(sa===sb)continue;
    const x=edge(a,b);if(sb)start=x;else{out.push({from:r(start),to:r(x)});start=null;}
  }
  if(start!==null)out.push({from:r(start),to:r(hi)});
  return out.filter(s=>s.to-s.from>=.01);
}
// The film's forced window of an item: its keys' shown stretch (first to last, cut in and out) within its keyed fade
// (op: prop-edits.mjs keyedFadeWindow or null). {from, to, fadeIn, fadeOut, keyed:true} or null when the keys leave it
// on the whole time (op then stands alone).
export function keyedWindow(keys,op,lo,hi){
  if(!keys?.length)return null;
  const s=shownStretches({keys,lo,hi});if(!s.length)return null;
  let from=s[0].from,to=s[s.length-1].to;if(from<=lo+1e-3&&to>=hi-1e-3)return null;
  let fadeIn=0,fadeOut=0;const r=v=>Math.round(v*100)/100;
  if(op){
    if(op.from>=from-1e-3)fadeIn=op.fadeIn;else fadeIn=Math.max(0,op.from+op.fadeIn-from);
    if(op.to<=to+1e-3)fadeOut=op.fadeOut;else fadeOut=Math.max(0,to-(op.to-op.fadeOut));
    from=Math.max(from,op.from);to=Math.min(to,op.to);
  }
  if(!(to-from>=.1-1e-9))return null;
  return {from:r(from),to:r(to),fadeIn:r(Math.min(fadeIn,to-from)),fadeOut:r(Math.min(fadeOut,to-from)),keyed:true};
}
