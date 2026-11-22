// "Approach the landing spot" (22 Nov 2026, Vico, the storage chapter: "instead of going forward it goes diagonally into
// the spot and then rotates into place ... We might need to go forward a bit and then diagonally: that can be calculated,
// right? 45-degree angle to the landing spot"). From the desk's pose at the start to a landing pose (x, z in inches, yaw
// in degrees: the Director's wheel pose, experience/desk-clips.mjs): one straight leg (forward / backward, or a strafe
// left / right) for the part a 45-degree line cannot cover, one diagonal leg, then one turn into the landing heading.
// The desk keeps its heading while it travels (the real desk's mecanum drive), so both legs are in the start heading's
// frame: forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw). Pure: node tests run it.
//
//   planApproach(from, to, {speed, turnSpeed, order})   -> {forward, right, turn, legs: [{kind, direction, value, duration}], seconds}
//   approachClips(plan, start, {easing})                 -> the Wheels lane clips (desk-clips.mjs cleanClip shape), back to back
export const MIN_MOVE=.05,MIN_TURN=.05;   // inches, degrees: below this a leg is left out
const r3=v=>Math.round(v*1000)/1000;
// the turn from a to b, the short way (-180 .. 180]
export const shortTurn=(a,b)=>{let d=((b-a)%360+540)%360-180;if(d===-180)d=180;return d;};
export function planApproach(from,to,{speed=12,turnSpeed=45,order='straight-first'}={}){
  for(const [n,p] of [['start',from],['landing spot',to]])if(![p?.x,p?.z,p?.yaw].every(Number.isFinite))throw Error(`The ${n} needs X, Z and a heading.`);
  if(!(speed>0)||!(turnSpeed>0))throw Error('Speeds must be greater than zero.');
  const a=from.yaw*Math.PI/180,dx=to.x-from.x,dz=to.z-from.z;
  const forward=dx*Math.sin(a)+dz*Math.cos(a),right=dx*Math.cos(a)-dz*Math.sin(a);
  const F=Math.abs(forward),R=Math.abs(right),both=Math.min(F,R),legs=[];
  const straight=F>R?{kind:'travel',direction:forward>0?'forward':'backward',value:F-R}:{kind:'travel',direction:right>0?'right':'left',value:R-F};
  const diagonal={kind:'travel',direction:`${forward>=0?'forward':'backward'}-${right>=0?'right':'left'}`,value:both*Math.SQRT2};
  const moves=order==='diagonal-first'?[diagonal,straight]:[straight,diagonal];
  for(const m of moves)if(m.value>=MIN_MOVE){if(m.value>240)throw Error(`The ${m.direction} leg would be ${r3(m.value)}″: one move goes up to 240″. Pick a nearer start or landing spot.`);legs.push({...m,value:r3(m.value),duration:r3(Math.max(.1,m.value/speed))});}
  const turn=shortTurn(from.yaw,to.yaw);
  if(Math.abs(turn)>=MIN_TURN)legs.push({kind:'rotate',direction:turn>0?'right':'left',value:r3(Math.abs(turn)),duration:r3(Math.max(.1,Math.abs(turn)/turnSpeed))});
  return {forward:r3(forward),right:r3(right),turn:r3(turn),diagonal:r3(diagonal.value),legs,seconds:r3(legs.reduce((n,l)=>n+l.duration,0))};
}
const LABEL={forward:'Forward',backward:'Back',left:'Strafe left',right:'Strafe right'};
export function legLabel(l){
  if(l.kind==='rotate')return `Turn ${l.direction} into place ${l.value}°`;
  return l.direction.includes('-')?`Diagonal ${l.direction} ${l.value}″`:`${LABEL[l.direction]} ${l.value}″`;
}
// The plan as Wheels clips from `start` (seconds), back to back; ids from `prefix` (unique per plan).
export function approachClips(plan,start,{easing='smooth',prefix='approach'}={}){
  let t=start;const tag=Math.random().toString(36).slice(2,8);
  return plan.legs.map((l,i)=>{const c={id:`${prefix}-${tag}-${i+1}`,lane:'wheels',kind:l.kind,start:r3(t),duration:l.duration,easing,label:legLabel(l),value:l.value,direction:l.direction};t+=l.duration;return c;});
}
// The plan in words, for the inspector.
export function describePlan(plan){
  const parts=plan.legs.map(legLabel);
  return `${parts.length?parts.join(' → '):'Already there'} · ${plan.seconds} s (offset: ${plan.forward}″ forward, ${plan.right}″ right, turn ${plan.turn}°)`;
}
