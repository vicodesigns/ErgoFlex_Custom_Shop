import {score} from './score.mjs';
import {makeOpeningShot} from './opening.mjs';
import {cleanClipMotion} from './desk-clips.mjs';

// Deliberate demonstrations: establish, perform, then let the result breathe.
export const SHOWCASE_PLAN=[
  ['awaken',14,'Roll in. Rise up. Make it yours.','Wheel detail → lateral glide → rise → hero hold'],
  ['rise',20,'From seated focus to a full 52.5-inch standing height.','Seated setup → standing lift → full height → settle'],
  ['create',24,'Draft at 25°. Create at 65°. Supplies find their shelf.','Level workspace → drafting hold → easel hold'],
  ['commons',20,'Bring your workspace into the conversation.','Commons context → shared table approach → group-work hold'],
  ['coast',16,'A personal workstation inside a collaborative media lab.','Lab establishing view → workstation → shared creative space'],
  ['oilers',16,'A classroom for different ways of learning.','Classroom context → desk detail → learning-space reveal'],
  ['wellness',20,'Pause. Stand. Reset your working posture.','Seated work → reminder → rise → standing pause'],
  ['awareness',18,'Virtual proximity sweep · simulated obstacles.','Desk and obstacles → sweep detail → spatial overview'],
  ['music',18,'Reactive colour gives the room a different rhythm.','Gaming setup → illuminated frame → room atmosphere'],
  ['media',18,'A curved cinema experience with picture-driven colour.','Screen reveal → comfortable viewing hold → ambient context'],
  ['storage',22,'Tilt to 65°. Park at the wall. Open the floor.','Working space → storage tilt → wall parking → open-floor hold'],
  ['hero',12,'One desk. A day of possibilities.','Product portrait → gentle reveal → final title hold']
];
const move=(id,lane,kind,start,duration,params)=>({id,lane,kind,start,duration,easing:'smooth',...params});
export function showcaseShots(){
  return score().map((source,index)=>{
    const [,seconds,detail]=SHOWCASE_PLAN[index];
    const shot={...source,seconds,detail,transition:index===0?.45:1.1};
    if(index===0){
      const opening=makeOpeningShot(source),scale=seconds/8;
      return {...opening,seconds,detail,motion:cleanClipMotion({...opening.motion,clips:opening.motion.clips.map(c=>({...c,start:c.start*scale,duration:c.duration*scale}))},seconds)};
    }
    const clips=[];let height=28;
    if(source.kind==='lift')clips.push(
      move('comfortable-standing','lift','lift',3,6,{target:43.5,label:'Rise to comfortable standing'}),
      move('full-height','lift','lift',12,4,{target:52.5,label:'Full 52.5″ height'}));
    if(source.kind==='tilt'){
      height=43.5;clips.push(
        move('drafting','tilt','tilt',3,5,{target:25,label:'Drafting · 25°'}),
        move('easel','tilt','tilt',13,6,{target:65,label:'Artist easel · 65°'}));
    }
    if(source.kind==='wellness')clips.push(move('stand-break','lift','lift',6,6,{target:43.5,label:'Stand and reset'}));
    if(['lift','tilt','wellness'].includes(source.kind))shot.motion=cleanClipMotion({initial:{height,tilt:0,x:0,z:0,yaw:0},clips},seconds);
    return shot;
  });
}
// Camera guides are relative to the actual loaded scene; no hard-coded world scale.
export function showcaseViews(kind){
  const room=['room','group','storage'].includes(kind);
  if(room)return [
    {time:0,label:'Establish the space',scope:'room',angle:0,distance:1.02},
    {time:.18,label:'Read the setting',scope:'room',angle:.02,distance:1.02},
    {time:.55,label:kind==='room'?'Workstation and context':'Follow the workspace',scope:'zone',angle:.12,distance:1.35},
    {time:.84,label:'Reveal the result',scope:kind==='group'?'zone':'room',angle:.18,distance:kind==='group'?1.4:.98},
    {time:1,label:'Hold the result',scope:kind==='group'?'zone':'room',angle:.18,distance:kind==='group'?1.4:.98}
  ];
  return [
    {time:0,label:'Establish the feature',angle:0,distance:1.08},
    {time:.18,label:'Before the movement',angle:.02,distance:1.08},
    {time:.56,label:'Feature demonstration',angle:.13,distance:kind==='media'?.94:1.04},
    {time:.82,label:'Completed position',angle:.22,distance:1.12},
    {time:1,label:'Let the result breathe',angle:.22,distance:1.12}
  ];
}
