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
