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

// ---- continuity on the real casts (review-cut.json): oilers (Noah, Kai) and storage (Andre)
{
  const fs=await import('node:fs'),path=await import('node:path'),url=await import('node:url');
  const root=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..'),cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-cine/review-cut.json'),'utf8'));
  const people=id=>structuredClone(cut.shots.find(s=>s.id===id).people),by=(cast,k)=>cast.find(e=>e.key===k);
  const o=people('oilers'),before=JSON.stringify(o);
  // Noah's walk: its last point moves; pull, tap and watch stood there: they follow; Noah talking (at the start) stays
  const steps=by(o.cast,'noah-steps'),Q=P.endsOf(steps).end,Q2=[Q[0]+300,Q[1]-200];
  let moved=P.movePoint(steps,P.pathOf(steps).length-1,Q2),cast=o.cast.map(e=>e.key==='noah-steps'?moved:e);
  let r=P.linkedMove(cast,o.when,'noah-steps',Q,Q2);
  assert.deepEqual(r.followed.map(f=>f.key).sort(),['noah-pulls','noah-taps','noah-watches'],'the end of Noah\'s walk takes pull, tap and watch with it');
  for(const k of ['noah-pulls','noah-taps','noah-watches'])assert.deepEqual(by(r.cast,k).at,Q2,k+' at the new spot');
  assert.deepEqual(by(r.cast,'noah-talks').at,by(o.cast,'noah-talks').at,'Noah talking (at the start) stays');
  assert.ok(r.cast.filter(e=>!/^noah/.test(e.key)).every(e=>JSON.stringify(e)===JSON.stringify(by(o.cast,e.key))),'nobody else changes');
  // its start: Noah talking follows, the others not
  const P0=P.endsOf(steps).start,P1=[P0[0]-150,P0[1]+90];moved=P.movePoint(steps,0,P1);
  r=P.linkedMove(o.cast.map(e=>e.key==='noah-steps'?moved:e),o.when,'noah-steps',P0,P1);
  assert.deepEqual(r.followed.map(f=>f.key),['noah-talks']);assert.deepEqual(by(r.cast,'noah-talks').at,P1);assert.deepEqual(moved.at,P1,'the walk\'s own placement with its start');
  // a STANDING placement moved (noah-pulls with the gizmo): the walk's end and the two after follow, down the chain
  r=P.linkedMove(o.cast,o.when,'noah-pulls',Q,Q2);
  assert.deepEqual(r.followed.map(f=>f.key).sort(),['noah-steps','noah-taps','noah-watches']);
  assert.deepEqual(P.endsOf(by(r.cast,'noah-steps')).end,Q2,'the walk now ends where they stand');assert.deepEqual(P.endsOf(by(r.cast,'noah-steps')).start,P0,'and starts where it did');
  assert.deepEqual(r.followed.find(f=>f.key==='noah-steps').ends,['end']);
  // Kai (S9 round 6: one roll, all the way to the dock): the end of kai-rolls is where kai types; that placement follows
  const kr=by(o.cast,'kai-rolls'),W0=P.endsOf(kr).end,W1=[W0[0]+100,W0[1]];
  r=P.linkedMove(o.cast.map(e=>e.key==='kai-rolls'?P.movePoint(kr,P.pathOf(kr).length-1,W1):e),o.when,'kai-rolls',W0,W1);
  assert.deepEqual(r.followed.map(f=>f.key),['kai']);assert.deepEqual(by(r.cast,'kai').at,W1);assert.deepEqual(P.endsOf(by(r.cast,'kai-rolls')).start,P.endsOf(kr).start,'the roll starts where it did');
  assert.equal(JSON.stringify(o),before,'the cast given is never changed');
  // storage: Andre's walk end -> phone out, up, presses, watches; its start -> nobody (he steps off from another spot)
  const st=people('storage'),aw=by(st.cast,'andre-steps-back'),E0=P.endsOf(aw).end,E1=[E0[0],E0[1]+250];
  r=P.linkedMove(st.cast,st.when,'andre-steps-back',E0,E1);assert.deepEqual(r.followed.map(f=>f.key).sort(),['andre-phone-out','andre-phone-up','andre-presses','andre-watches']);
  assert.deepEqual(P.linkedMove(st.cast,st.when,'andre-steps-back',P.endsOf(aw).start,[0,0]).followed,[],'nobody stood where his walk starts');
  // ---- arrival against the hand-over
  // (S9 round 6 retimed the walk and the roll: the times here are the cut's own)
  const S0=steps.walk.start,DL=o.when['noah-pulls'][0][0],room=DL-S0;
  let a=P.arrival(steps,room-.2,o.cast,o.when);assert.equal(a.deadline,DL);assert.equal(a.next,'noah-pulls');assert.ok(Math.abs(a.arrive-(DL-.2))<1e-9&&a.late===0,'on time');
  a=P.arrival(steps,room+.7,o.cast,o.when);assert.ok(Math.abs(a.late-.7)<1e-9,'0.7 s late');
  const fast=P.fixFaster(steps,a,{seconds:room+.7});assert.ok(Math.abs(fast.walk.pace-Math.min(P.FIELDS.walk.pace.max,steps.walk.pace*(room+.7)/room))<.011,'faster: pace scaled to the room left (up to its limit)');
  if(steps.walk.pace*(room+.7)/room<=P.FIELDS.walk.pace.max)assert.ok((fast.walk.start)===steps.walk.start&&Math.abs(P.arrival(fast,(room+.7)*steps.walk.pace/fast.walk.pace,o.cast,o.when).late)<.01,'and then on time');
  const win=o.when['noah-steps'][0][0],early=P.fixEarlier(steps,a,{seconds:room+.7});assert.ok(Math.abs(early.walk.start-Math.max(win,DL-(room+.7)))<1e-9,'earlier: back by the lateness (not before its window)');
  const KD=o.when['kai-rolls'][0][1],ks=P.routeInfo(kr,{rollPlan}).seconds,ka=P.arrival(kr,ks,o.cast,o.when);assert.equal(ka.deadline,KD);assert.equal(ka.late,0);
  const lateS=KD-kr.roll.start+.5,late=P.arrival(kr,lateS,o.cast,o.when);const kf=P.fixFaster(kr,late,{seconds:lateS,length:P.routeInfo(kr,{rollPlan}).length});assert.ok(kf.roll.speed>0&&kf.roll.speed<kr.roll.speed,'a roll: the speed to arrive by its deadline');
  assert.equal(P.fixEarlier(kr,late,{seconds:lateS}).roll.start,0,'a roll starts at most back to its window');
}
// a point the edit does not touch keeps its exact value (the film's paths have tenths of a millimetre)
{const fine={key:'k',id:'people-kai-wheel-roll',at:[0,0],turn:0,roll:{path:[[0,0],[-3372.0,-448.1],[-3507.7,-460.3]]}};
 const m=P.movePoint(fine,2,[-3600.4,-470]);assert.deepEqual(m.roll.path,[[0,0],[-3372.0,-448.1],[-3600,-470]],'only the moved point is rounded');
 assert.deepEqual(P.moveStart(fine,[10,0]).roll.path.slice(1),fine.roll.path.slice(1));assert.deepEqual(P.insertPoint(fine,0,[-1000,-200]).roll.path[2],[-3372.0,-448.1]);}
// toes: only when the choice differs from what the entry resolves to
assert.equal(P.setField({at:[0,0],walk:{path:[[0,0],[0,1]]}},'toes','bend').walk.toes,undefined,'bend is what no toes means: nothing written');
console.log('PASS people-path-edit: move / add / remove waypoints, the start with the placement, floor picking, the planner\'s route, the fields');
