// The Director's path editing (experience/people-path-edit.mjs): waypoints moved, added and removed on a cast entry's
// walk / roll (a new entry each time, the film's format), the start going with the placement, picking on the floor,
// the drawn route = the planner's (room-people-motion.mjs rollPlan), the inspector fields.
//   node tests/people-path-edit-test.mjs
import assert from 'node:assert/strict';
import {rollPlan} from '../room-people-motion.mjs';
import * as P from '../experience/people-path-edit.mjs';

const andre={key:'andre-steps-back',id:'people-andre-walk',at:[60,1935],turn:180,walk:{path:[[60,1935],[-250,2107],[-636,2267],[-1120,1538]],start:4.7,pace:2.33,step:450,then:'people-andre-stand-phone-pull',toes:'bend'}};
const kai={key:'kai-rolls',id:'people-kai-wheel-roll',at:[-961,1300],turn:0,roll:{path:[[-961,1300],[-961,-265],[-3757,-265],[-3757,-610]],start:.3,speed:1,radius:350}};
const frozen=JSON.stringify([andre,kai]);

// ---- reading
assert.equal(P.motionOf(andre),'walk');assert.equal(P.motionOf(kai),'roll');assert.equal(P.motionOf({key:'x',id:'people-x',at:[0,0]}),null);
assert.deepEqual(P.pathOf(andre),andre.walk.path);
assert.deepEqual(P.pathOf({at:[1,2],walk:{to:[3,4]}}),[[1,2],[3,4]],'a `to` walk starts where they stand');
assert.deepEqual(P.pathOf({at:[1,2],roll:{from:[5,6],to:[3,4]}}),[[5,6],[3,4]]);
assert.equal(P.pathOf({at:[1,2],walk:{}}),null,'no destination: no path');

// ---- move / add / remove: new entries, the film's fields only
let e=P.movePoint(andre,2,[-700.4,2300.6]);
assert.deepEqual(e.walk.path[2],[-700,2301],'moved and rounded to the millimetre');
assert.deepEqual(Object.keys(e.walk).sort(),Object.keys(andre.walk).sort(),'no new field');
assert.deepEqual(e.at,andre.at,'moving a waypoint leaves the placement');
e=P.movePoint(andre,0,[100,2000]);
assert.deepEqual(e.at,[100,2000],'the start is the placement: it moves with it');assert.deepEqual(e.walk.path[0],[100,2000]);
e=P.insertPoint(andre,1,[-400,2200]);
assert.equal(e.walk.path.length,5);assert.deepEqual(e.walk.path[2],[-400,2200],'added after point 1');
assert.equal(P.insertPoint(andre,1,[-260,2110]),andre,'a point on top of another is not added');
e=P.removePoint(andre,2);assert.equal(e.walk.path.length,3);assert.deepEqual(e.walk.path,[[60,1935],[-250,2107],[-1120,1538]]);
assert.equal(P.removePoint(andre,0),andre,'the start stays');
assert.equal(P.removePoint({at:[0,0],walk:{path:[[0,0],[0,1000]]}},1).walk.path.length,2,'two points stay');
assert.ok(!P.canRemove(andre,0)&&P.canRemove(andre,3)&&!P.canRemove({at:[0,0],walk:{path:[[0,0],[0,1]]}},1));
const to=P.insertPoint({key:'k',id:'people-k',at:[0,0],turn:0,walk:{to:[0,2000],start:1}},0,[500,1000]);
assert.deepEqual(to.walk,{start:1,path:[[0,0],[500,1000],[0,2000]]},'a `to` walk becomes a path (no to left, nothing new)');
e=P.movePoint(kai,2,[-3700,-300]);assert.deepEqual(e.roll.path[2],[-3700,-300]);assert.equal(e.roll.radius,350);
assert.equal(JSON.stringify([andre,kai]),frozen,'the entries given are never changed');

// ---- the person moved: at and the start together
e=P.moveStart(andre,[100,-35]);assert.deepEqual(e.at,[160,1900]);assert.deepEqual(e.walk.path[0],[160,1900]);assert.deepEqual(e.walk.path.slice(1),andre.walk.path.slice(1),'the rest of the path stays');
e=P.moveStart({at:[0,0],turn:0,walk:{path:[[500,500],[900,900]]}},[10,10]);assert.deepEqual(e.walk.path[0],[500,500],'a path that starts elsewhere keeps its start');
assert.deepEqual(P.moveStart({at:[0,0],turn:0},[5,5]).at,[5,5],'someone standing still: just the placement');
assert.deepEqual(P.snap([1234,-1260]),[1250,-1250]);

// ---- picking on the floor
assert.deepEqual(P.rayFloor([0,1000,0],[0,-1,1]),[0,1000]);assert.equal(P.rayFloor([0,1000,0],[0,1,1]),null,'looking up: no floor');assert.equal(P.rayFloor([0,1000,0],[1,0,0]),null);
const pts=P.pathOf(kai);
assert.deepEqual(P.hitTest(pts,[-950,-250]),{kind:'point',index:1},'near a handle: that handle');
let h=P.hitTest(pts,[-2000,-200]);assert.equal(h.kind,'segment');assert.equal(h.index,1,'on the second leg');assert.deepEqual(h.at,[-2000,-265],'the point on the leg');
assert.equal(P.hitTest(pts,[-2000,800]),null,'far from the path: nothing');
const drawnKai=P.drawnLine(kai,{rollPlan});
h=P.hitTest(pts,[-1050,-170],{pointTol:60,lineTol:40,drawn:drawnKai});assert.ok(h&&h.kind==='segment','a click on the rounded corner (off the control polygon) is on the path');
assert.equal(P.segmentOf(pts,[-3000,-270]),1);

// ---- the drawn route is the planner's
const walkLine=P.drawnLine(andre,{rollPlan});assert.deepEqual(walkLine,andre.walk.path,'a walker\'s hips go straight from point to point');
const plan=rollPlan(pts.map(p=>[p[0]/1000,p[1]/1000]),{speed:1,radius:.35});
assert.deepEqual(drawnKai[0],[-961,1300]);const last=drawnKai[drawnKai.length-1];assert.ok(Math.hypot(last[0]+3757,last[1]+610)<1,'ends at the last point');
for(const s of [.2,.5,.8]){const a=plan.along(plan.length*s),near=Math.min(...drawnKai.map(p=>Math.hypot(p[0]-a.x*1000,p[1]-a.z*1000)));assert.ok(near<12,`the drawn route passes where the chair is (${s}): ${near.toFixed(1)} mm`);}
const corner=Math.min(...drawnKai.map(p=>Math.hypot(p[0]+961,p[1]+265)));assert.ok(corner>90&&corner<200,`the corner is rounded as the planner rounds it (${corner.toFixed(0)} mm inside the corner point for a 350 mm radius)`);
const info=P.routeInfo(kai,{rollPlan});assert.ok(Math.abs(info.length-plan.length*1000)<5&&Math.abs(info.seconds-plan.seconds)<1e-9,'route length and seconds from the planner');
const moved=P.drawnLine(P.movePoint(kai,2,[-3000,-265]),{rollPlan});assert.ok(Math.hypot(moved[moved.length-1][0]+3757,moved[moved.length-1][1]+610)<1&&moved.some(p=>Math.abs(p[0]+3000)<15),'a moved point re-plans the route');

// ---- the inspector's fields
e=P.setField(andre,'pace','2.6');assert.equal(e.walk.pace,2.6);
assert.equal(P.setField(andre,'pace','99').walk.pace,4,'clamped');
assert.equal(P.setField(andre,'pace','').walk.pace,undefined,'empty: the film\'s default');
e=P.setField(andre,'turn','-90');assert.equal(e.walk.turn,-90);assert.equal('turn' in P.setField(e,'turn','').walk,false);
assert.throws(()=>P.setField(andre,'start',''),/number/);assert.throws(()=>P.setField(andre,'start','abc'),/number/);
assert.equal(P.setField(andre,'then','').walk.then,undefined);assert.equal(P.setField(andre,'then','people-andre-stand-wait').walk.then,'people-andre-stand-wait');
assert.equal(P.setField(andre,'toes','stiff').walk.toes,'stiff');
e=P.setField(kai,'radius','512.6');assert.equal(e.roll.radius,513);assert.equal(P.setField(kai,'speed','1.25').roll.speed,1.25);assert.equal(P.setField(kai,'ease','0').roll.ease,.05);
assert.equal(P.setField(kai,'pace','2'),kai,'a walk field on a roll changes nothing');
for(const [k,fields] of Object.entries(P.FIELDS))for(const name of Object.keys(fields))assert.ok(['start','pace','step','turn','speed','radius','ease'].includes(name),`${k}.${name} is a field the film reads`);
assert.equal(JSON.stringify([andre,kai]),frozen,'the entries given are never changed');
console.log('PASS people-path-edit: move / add / remove waypoints, the start with the placement, floor picking, the planner\'s route, the fields');
