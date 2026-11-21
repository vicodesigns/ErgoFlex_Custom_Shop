// Director Desks tab, "Same setup as another desk": the keyboard tray, single monitor arm, monitor, keyboard and mouse of a
// desk (the black featured desk, or any room desk) put on another room desk, placed for THAT desk. Pure data code
// (shared by the Director, the tests and the Export cut path); the stage code is desk-build.mjs applyBuild, which the live
// Director and film-fx both call, so the stage is the render.
//
// What is written is one deskEdits[] entry's `build` (desk-build.mjs): accessories [{id, slot}], accessoryFinishes and objects
// (each accessory's placement in its slot's frame, millimetres from the middle of that surface). Slot frames move with the
// desktop, so the tray, the keyboard and the mouse (desktop frame) and the arm and the monitor (top shelf frame) already
// follow the desk's lift and tilt: a desk raised to 43.5 in carries the whole setup up with it, nothing is re-placed for the
// height. What does depend on who stands there is the monitor: it is put at the user's eye height (`eyeMm`), see monitorOffset.
// The poses of the people (room-people.mjs) were built with the keyboard where the featured desk keeps it, so the tray,
// keyboard and mouse placement is copied as it is (the hands land on the keys), only scaled across between the 48 in and the
// 60 in desk like the studio's own size switch (scene-desk-data.mjs seedSceneDeskSize).
import {accessory} from '../catalog.mjs';
import {SHARED_BUILD_PRESETS} from '../preset-defaults.mjs';
import {cleanDeskBuild,cleanBuildAccessories,naturalSlot} from './desk-build.mjs';
import {clampStartPose} from './start-pose.mjs';

const IN=25.4;
export const KIT_PARTS=['tray','arm','monitor','keyboard','mouse'];
// The parts as catalog accessories: which ids can fill each, and the group the store keeps exclusive.
const PART={tray:{ids:['keyboard-tray']},arm:{ids:['monitor-arm']},monitor:{group:'main-display'},keyboard:{group:'keyboard'},mouse:{group:'mouse'}};
// The HBHS · Oilers desk's own setup (catalog PRESETS hbhs, preset-defaults.mjs): what a source desk without one of the parts gives.
export const HBHS_KIT={tray:'keyboard-tray',arm:'monitor-arm',monitor:'flat-monitor',keyboard:'ergo-keyboard',mouse:'logitech-mx-master'};
// White ErgoFlex inputs (catalog: only these two carry a white finish) and the tray finish the studio's white HBHS uses.
export const WHITE_INPUTS={keyboard:'ergo-keyboard',mouse:'logitech-mx-master'};
export const WHITE_TRAY='steel';   // studio.js setHBHSColors: white tone = white keyboard and mouse on the brushed-steel tray

const partOf=id=>{const a=accessory(id);if(!a)return null;for(const p of KIT_PARTS){const d=PART[p];if(d.ids?.includes(id)||(d.group&&a.exclusiveGroup===d.group))return p;}return null;};
export const isKitAccessory=id=>!!partOf(id);

// Where the HBHS desk puts each part (mount-local mm; the 60 in desk's numbers), from preset-defaults.mjs.
export function hbhsObjects(){return structuredClone(SHARED_BUILD_PRESETS.hbhs.room.desks.main.objects);}

// ---- the monitor, at the user's eye
// The store / HBHS placement (monitor y -80 on the top shelf's frame) puts the middle of the panel at an adult's eye line
// (about 520 mm above the desktop for an adult at either end of the lift: 28 in seated, 43.5 in standing). For a shorter
// user the panel comes down by the difference, but never lower than a clear hand's breadth above the desktop. `half`: half
// the panel's height (mm), by monitor.
export const EYE_REF_ABOVE_DESKTOP=520;
export const MONITOR_HALF={'flat-monitor':200,'wide-monitor':175,'dell-u2724d':190,'portrait-monitor':330};
export const MONITOR_CLEARANCE=60;
export const EYE_FRACTION=.93;   // eye height of a standing person, from the top of their head (their model's height)
export const eyeOf=heightMm=>Number.isFinite(heightMm)&&heightMm>800&&heightMm<2300?Math.round(heightMm*EYE_FRACTION):null;
export const deskTopMm=heightIn=>Math.round(heightIn*IN*10)/10;
// The change to the monitor's y (mm, on its slot's frame) for a user whose eyes are `eyeMm` above the floor at a desk `heightIn`.
export function monitorOffset({monitor,heightIn,eyeMm}){
  if(!Number.isFinite(eyeMm)||!Number.isFinite(heightIn))return 0;
  const above=eyeMm-deskTopMm(heightIn),half=MONITOR_HALF[monitor]??200,lowest=half+MONITOR_CLEARANCE;
  const centre=Math.max(lowest,above);   // never into the desktop
  return Math.round((centre-EYE_REF_ABOVE_DESKTOP)*10)/10;
}
// The monitor on its arm hangs from the top-shelf slot frame, which is NOT at desktop level: measured in the stage (oilers
// film, probe of station-project-review) the frame is 258 mm above the desktop and the accessory's y offsets act 1.06 times
// (the desk's own scale), so the panel's lower edge (the model's origin) is at SHELF_FRAME_ABOVE_DESKTOP + y*FRAME_SCALE above
// the desktop. monitorOffset's centre clamp assumed 0 there and let a short user's panel sink into the desktop (Fern, 43.5 in:
// y -340 put the lower edge 100 mm below the surface).
export const SHELF_FRAME_ABOVE_DESKTOP=258,FRAME_SCALE=1.06,PANEL_EDGE_CLEARANCE=25;
export const lowestMonitorY=(clearance=PANEL_EDGE_CLEARANCE)=>Math.ceil((clearance-SHELF_FRAME_ABOVE_DESKTOP)/FRAME_SCALE*10)/10;
// Where things are above the floor (mm) for a desk at `heightIn`: slot frames are fixed to the desktop, so every height is
// the desk's plus the part's own offset. (The top shelf's frame sits SHELF_ABOVE_DESKTOP over the desktop; its value is the
// store model's and only matters for comparing two heights, which it cancels out of.)
export const SHELF_ABOVE_DESKTOP=0;
export function heightsAt(objects,heightIn){
  const top=deskTopMm(heightIn),out={};
  for(const [key,o] of Object.entries(objects||{}))out[key]=Math.round((top+(o.role==='desktop'?0:SHELF_ABOVE_DESKTOP)+o.transform.p.y)*10)/10;
  return out;
}

// ---- the copy
const scaleX=(o,k)=>{const c=structuredClone(o);c.transform.p.x=Math.round(c.transform.p.x*k*1e3)/1e3;return c;};
const sizeRatio=(from,to)=>!from||!to||from===to?1:to==='48x30'?.8:1.25;
const keyOf=id=>'accessory-'+id;

// Which finish a copy wears. 'auto': white inputs on a white frame (base finish White / Pearl White), as the HBHS classroom
// has it (hbhs-design.mjs highschoolDeskTone); black otherwise. 'white' / 'black' force it; 'source' keeps the source's.
export function finishFor(mode,baseFinish){
  if(mode==='white'||mode==='black'||mode==='source')return mode;
  return /white/i.test(String(baseFinish||''))?'white':'black';
}

// source: {size, accessories:[{id,slot}], accessoryFinishes, objects:{'accessory-id':{role,transform}}} (desk-build.mjs readSetup)
// target: {size, heightIn, baseFinish?, accessories?:[{id,slot}] (the desk's own build / accessories now)}
// opts:   {finish:'auto'|'white'|'black'|'source', eyeMm?}
// -> {build, parts:{part:id}, finish, notes:[...]}; build is a cleaned desk build (desk-build.mjs cleanDeskBuild).
export function copySetup(source,target,opts={}){
  if(!source||!target)return null;
  const finish=finishFor(opts.finish||'auto',target.baseFinish),notes=[],fallback=hbhsObjects();
  const have=new Map((source.accessories||[]).map(a=>[a.id,a]));
  // the five parts: the source's own, else the HBHS desk's
  const pick={};
  for(const p of KIT_PARTS){
    let id=[...have.keys()].find(i=>partOf(i)===p&&!(p==='arm'&&i!=='monitor-arm'));
    if(!id){id=HBHS_KIT[p];notes.push(`${p}: the source has none, the HBHS desk's ${accessory(id).name} is used`);}
    pick[p]=id;
  }
  if(have.has('monitor-arm-2')&&!have.has('monitor-arm'))notes.push('arm: the source has a dual arm; the single arm is used (as the HBHS desk)');
  if(finish==='white'){pick.keyboard=WHITE_INPUTS.keyboard;pick.mouse=WHITE_INPUTS.mouse;}
  const k=sizeRatio(source.size,target.size),objects={},slots=[];
  for(const p of KIT_PARTS){
    const id=pick[p],srcObj=source.objects?.[keyOf(id)],hb=fallback[keyOf(id)];
    // the source's placement when it has this very part (a different keyboard has its own numbers); else the part's HBHS one
    const o=srcObj||hb;
    if(!o){notes.push(`${p}: ${accessory(id).name} has no placement to copy; the store layout places it`);slots.push({id,slot:naturalSlot(id)});continue;}
    const slot=o.role||have.get(id)?.slot||naturalSlot(id);
    // fallbacks are 60 in numbers; a source's are in its own size
    const placed=scaleX(o,srcObj?k:sizeRatio('60x30',target.size));
    objects[keyOf(id)]=placed;slots.push({id,slot});
  }
  // the monitor to the user's eyes
  const mk=keyOf(pick.monitor);
  if(objects[mk]&&Number.isFinite(opts.eyeMm)){
    const dy=monitorOffset({monitor:pick.monitor,heightIn:target.heightIn,eyeMm:opts.eyeMm});
    if(dy){objects[mk].transform.p.y=Math.round((objects[mk].transform.p.y+dy)*10)/10;notes.push(`monitor: ${dy>0?'+':''}${dy} mm to the user's eye height at ${target.heightIn}″`);}
    // never with the panel's lower edge nearer the desktop than PANEL_EDGE_CLEARANCE (the arm holds it in the air)
    const floor=lowestMonitorY();if(objects[mk].transform.p.y<floor){objects[mk].transform.p.y=floor;notes.push(`monitor: raised to y ${floor} mm, its lower edge ${PANEL_EDGE_CLEARANCE} mm above the desktop`);}
  }
  // finishes: white inputs on the tray the studio's white HBHS uses; else the source's own
  const fins={};
  if(finish==='white'){for(const p of ['keyboard','mouse'])fins[pick[p]]='white';fins[pick.tray]=WHITE_TRAY;}
  else if(finish==='black'){fins[pick.tray]=WHITE_TRAY;}   // black inputs are the default (not written); the tray stays steel as on the black HBHS desk
  else for(const p of KIT_PARTS){const f=source.accessoryFinishes?.[pick[p]];if(f)fins[pick[p]]=f;}
  // the desk's other accessories stay (its objects keep the room's placement); the five parts and what they replace go
  const mine=(target.accessories||[]).filter(a=>!partOf(a.id)&&!(accessory(a.id)?.exclusiveGroup==='monitor-mount'));
  const build=cleanDeskBuild({accessories:[...mine,...slots],accessoryFinishes:fins,objects});
  return {build,parts:pick,finish,notes};
}

// The desk edit for the target: its build (kept fields such as finishes of the frame stay) and, for `stand`, the standing
// start (43.5 in, flat: the posture of a typist standing is built for 43.5 in, room-people.mjs HEIGHT_FIT).
export function kitEdit(existing,result,{stand=false,size}={}){
  const e={...(existing||{})};
  e.build={...(existing?.build||{}),...result.build};
  if(stand)e.initial=clampStartPose({height:43.5,tilt:0},size||existing?.size||'60x30');
  return e;
}
export const STANDING={height:43.5,tilt:0};
export const describeKit=r=>`${KIT_PARTS.map(p=>accessory(r.parts[p])?.name).join(', ')}${r.finish==='white'?' (white keyboard and mouse)':''}`;
export {cleanBuildAccessories};
