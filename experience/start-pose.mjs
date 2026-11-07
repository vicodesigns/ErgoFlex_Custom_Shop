// Chapter tab: "Starting position" — the desk's height and tilt at 0 s (the chapter's motion.initial).
// Clamped to the real desk: 28–52.5″ for both desk widths, −5° to 65°, and the app's lift/tilt clearance
// (motion-limits.mjs: full 65° needs 40.5″ on the 48″ desk, 42.5″ on the 60″; at 28″ the most is 39°).
// A tilt that needs more clearance raises the desk, a height too low for the tilt lowers the tilt, as in the app.
// Movements are untouched: each clip still runs from the pose before it to its own target (desk-clips.mjs), so
// the first clip leaves the new start without a jump and every target is still reached.
import {sampleClipMotion} from './desk-clips.mjs';
import {cleanPose} from './desk-track.mjs';
import {TILT_MIN,TILT_MAX,LOW_HEIGHT,maximumTiltForHeight,minimumHeightForTilt} from '../motion-limits.mjs';

export const HEIGHT_MIN=LOW_HEIGHT,HEIGHT_MAX=52.5;
// The app's ergo forms (studio.js loadErgoForms): Sitting 28″ / 0°, Standing 43.5″ / −5°.
export const START_PRESETS={sitting:{height:28,tilt:0},standing:{height:43.5,tilt:-5}};
const r1=v=>Math.round(v*10)/10,deg=v=>(v<0?'−':'')+Math.abs(r1(v))+'°';
export function startPoseLimits(size){
  return {heightMin:HEIGHT_MIN,heightMax:HEIGHT_MAX,tiltMin:TILT_MIN,tiltMax:TILT_MAX,fullTiltHeight:minimumHeightForTilt(TILT_MAX,size),lowTiltMax:maximumTiltForHeight(HEIGHT_MIN,size)};
}
// The pose the real desk can hold. `lead` is the field he changed: it wins, the other one gives way.
export function clampStartPose(pose,size,lead='height'){
  let height=Math.max(HEIGHT_MIN,Math.min(HEIGHT_MAX,Number(pose.height))),tilt=Math.max(TILT_MIN,Math.min(TILT_MAX,Number(pose.tilt)));
  if(lead==='tilt')height=Math.max(height,minimumHeightForTilt(tilt,size));
  else tilt=Math.min(tilt,maximumTiltForHeight(height,size));
  height=r1(height);tilt=r1(tilt);
  // Rounding to 0.1 never leaves the clearance: the tilt rounds down, the raised height up.
  if(tilt>maximumTiltForHeight(height,size)+1e-9){if(lead==='tilt')height=Math.min(HEIGHT_MAX,Math.ceil(minimumHeightForTilt(tilt,size)*10-1e-9)/10);else tilt=Math.floor(maximumTiltForHeight(height,size)*10+1e-9)/10;}
  return {height,tilt};
}
export function startPoseTarget(name,current,size,{at}={}){
  const L=startPoseLimits(size);
  if(name==='max-height')return clampStartPose({...current,height:L.heightMax},size,'height');
  if(name==='min-height')return clampStartPose({...current,height:L.heightMin},size,'height');
  if(name==='flat')return clampStartPose({...current,tilt:0},size,'tilt');
  if(name==='max-tilt')return clampStartPose({...current,tilt:L.tiltMax},size,'tilt');
  if(START_PRESETS[name])return clampStartPose(START_PRESETS[name],size,'height');
  if(name==='current'&&at)return clampStartPose(at,size,'height');
  return null;
}

export function createStartPose({panel,shot,motion,time,seek,commit,status,ready}){
  let gesture=0;
  const size=()=>shot().size||'60x30',start=()=>cleanPose(motion().initial);
  const field=n=>panel.querySelector(`[name="${n}"]`);
  function note(){
    const L=startPoseLimits(size());
    return `${size()==='48x30'?'48″':'60″'} desk: ${L.heightMin}–${L.heightMax}″ · ${deg(L.tiltMin)} to ${deg(L.tiltMax)}. Full ${deg(L.tiltMax)} needs ${L.fullTiltHeight}″ or more; at ${L.heightMin}″ the most is ${deg(L.lowTiltMax)}.`;
  }
  function show(p){
    for(const [n,v] of [['start-height',p.height],['start-height-n',p.height],['start-tilt',p.tilt],['start-tilt-n',p.tilt]]){const el=field(n);if(el&&document.activeElement!==el)el.value=String(v);}
    const out=panel.querySelector('[data-start-pose-readout]');if(out)out.textContent=`${p.height}″ · ${deg(p.tilt)}`;
  }
  // One undo step per click, typed value or slider drag (the drag's input events share a commit key).
  function apply(next,{key=null,message}={}){
    ready();const m=motion(),was=cleanPose(m.initial),p={...was,...next};
    if(Math.abs(p.height-was.height)<1e-6&&Math.abs(p.tilt-was.tilt)<1e-6){show(p);status(message||'Starting position unchanged.');return false;}
    commit(()=>{shot().motion={...structuredClone(m),initial:cleanPose(p)};},{key,render:!key});
    if(key)show(p);seek(0);status(message||`Starting position: ${p.height}″, ${deg(p.tilt)}. Movements play on from here.`);return true;
  }
  function typed(el,{drag=false}={}){
    const f=el.name.startsWith('start-height')?'height':'tilt',v=Number(el.value);if(el.value===''||!Number.isFinite(v))return;
    const was=start(),p=clampStartPose({...was,[f]:v},size(),f),other=f==='height'?'tilt':'height',moved=Math.abs(p[other]-was[other])>1e-6;
    apply(p,{key:drag?'start-pose-'+gesture:null,message:`Starting position: ${p.height}″, ${deg(p.tilt)}${moved?(f==='tilt'?' (raised for tilt clearance)':' (tilt lowered: the desk is too low for more)'):''}${Math.abs(p[f]-v)>1e-6?` (${f} limit ${f==='height'?p.height+'″':deg(p.tilt)})`:''}.`});
    if(!drag)show(p);
  }
  panel.addEventListener('pointerdown',e=>{if(e.target.closest?.('[name="start-height"],[name="start-tilt"]'))gesture++;},true);
  panel.addEventListener('input',e=>{const n=e.target.name;if(n!=='start-height'&&n!=='start-tilt')return;try{typed(e.target,{drag:true});}catch(error){status(error.message,true);}});
  panel.addEventListener('change',e=>{const n=e.target.name;if(n!=='start-height-n'&&n!=='start-tilt-n'&&n!=='start-height'&&n!=='start-tilt')return;gesture++;
    try{if(n.endsWith('-n'))typed(e.target);else show(start());}catch(error){status(error.message,true);show(start());}});
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-start-pose]');if(!b)return;
    try{const name=b.dataset.startPose,at=name==='current'?sampleClipMotion(motion(),time()*shot().seconds):null,p=startPoseTarget(name,start(),size(),{at});if(!p)return;
      const label={'max-height':'Max height','min-height':'Min height',flat:'Flat (0°)','max-tilt':'Max tilt',sitting:'Sitting',standing:'Standing',current:`the pose at ${r1(time()*shot().seconds)} s`}[name];
      apply(p,{message:`Starting position: ${label} → ${p.height}″, ${deg(p.tilt)}. Movements play on from here.`});
    }catch(error){status(error.message,true);}});
  return {
    panel(){
      const L=startPoseLimits(size()),p=start();
      const row=(f,label,min,max,step,unit,value)=>`<div class="start-pose-row"><label for="start-${f}-n">${label}</label><input name="start-${f}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} slider"><input id="start-${f}-n" name="start-${f}-n" type="number" min="${min}" max="${max}" step="${step}" value="${value}"><span class="start-pose-unit">${unit}</span></div>`;
      const btn=(id,text,title,on)=>`<button data-start-pose="${id}" title="${title}" ${on?'aria-pressed="true"':''}>${text}</button>`;
      return `<fieldset class="chapter-pacing start-pose" data-start-pose-box><legend>Starting position</legend>
      <p class="start-pose-head"><span>Desk at 0 s</span><output data-start-pose-readout>${p.height}″ · ${deg(p.tilt)}</output></p>
      ${row('height','Height',L.heightMin,L.heightMax,.5,'in',p.height)}${row('tilt','Tilt',L.tiltMin,L.tiltMax,.5,'°',p.tilt)}
      <div class="director-actions start-pose-presets">${btn('max-height','Max height',`${L.heightMax}″`,p.height===L.heightMax)}${btn('min-height','Min height',`${L.heightMin}″ (tilt lowers to ${deg(L.lowTiltMax)} if needed)`,p.height===L.heightMin)}${btn('flat','Flat (0°)','Desktop level',p.tilt===0)}${btn('max-tilt','Max tilt',`${deg(L.tiltMax)} (raises the desk to ${L.fullTiltHeight}″ if needed)`,p.tilt===L.tiltMax)}</div>
      <div class="director-actions start-pose-presets start-pose-forms">${btn('sitting','Sitting','The app’s Sitting form: 28″, 0°',p.height===28&&p.tilt===0)}${btn('standing','Standing','The app’s Standing form: 43.5″, −5°',p.height===43.5&&p.tilt===-5)}${btn('current','Use current','Start where the desk is at the playhead')}</div>
      <p class="director-hint">${note()} Movements keep their targets and play on from this start.</p></fieldset>`;
    }
  };
}
