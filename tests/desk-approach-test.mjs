// Diagonal wheel moves and the "approach the landing spot" planner (22 Nov 2026, Vico: "the desk goes diagonal and then
// rotates into place ... 45-degree angle to the landing spot"; experience/desk-clips.mjs, experience/desk-approach.mjs).
//   node tests/desk-approach-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CLIP_DIRECTIONS,DIAGONALS,isDiagonal,cleanClip,clipTarget,sampleClipMotion,cleanClipMotion,clipSummary} from '../experience/desk-clips.mjs';
import {planApproach,approachClips,describePlan,shortTurn,legLabel} from '../experience/desk-approach.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CM=1/2.54,near=(a,b,eps,what)=>assert.ok(Math.abs(a-b)<=eps,`${what}: ${a} vs ${b}`);

// ---- 1 the four diagonals are travel directions; a diagonal goes at 45 degrees in the desk's frame, its value along it
assert.deepEqual(DIAGONALS,['forward-left','forward-right','backward-left','backward-right']);
for(const d of DIAGONALS){assert.ok(CLIP_DIRECTIONS.travel.includes(d));assert.ok(isDiagonal(d));assert.equal(cleanClip({lane:'wheels',kind:'travel',value:20,direction:d}).direction,d,'kept by cleanClip');}
assert.ok(!isDiagonal('forward')&&!isDiagonal('left'));
for(const yaw of [0,30,-90,135,200])for(const d of DIAGONALS){
  const p={height:30,tilt:0,x:5,z:-3,yaw},q=clipTarget({lane:'wheels',kind:'travel',value:20,direction:d},p),a=yaw*Math.PI/180;
  const dx=q.x-p.x,dz=q.z-p.z,fwd=dx*Math.sin(a)+dz*Math.cos(a),rgt=dx*Math.cos(a)-dz*Math.sin(a);
  near(Math.hypot(dx,dz),20,1e-6,`${d} at ${yaw}°: 20″ along it`);
  near(Math.abs(fwd),Math.abs(rgt),1e-6,`${d} at ${yaw}°: 45 degrees`);
  assert.equal(Math.sign(fwd),d.startsWith('forward')?1:-1);assert.equal(Math.sign(rgt),d.endsWith('right')?1:-1);assert.equal(q.yaw,yaw,'the heading is kept');
}
// straight moves are exactly as before (a verbatim copy of the old formula)
const old=(c,from)=>{const p={...from},angle=p.yaw*Math.PI/180,side=['left','right'].includes(c.direction),sign=['left','backward'].includes(c.direction)?-1:1;p.x+=sign*c.value*(side?Math.cos(angle):Math.sin(angle));p.z+=sign*c.value*(side?-Math.sin(angle):Math.cos(angle));return p;};
for(const yaw of [0,17,-90,181])for(const d of ['forward','backward','left','right']){const from={height:30,tilt:0,x:1.5,z:2.5,yaw},c={lane:'wheels',kind:'travel',value:33.3,direction:d},a=clipTarget(c,from),b=old(c,from);assert.equal(a.x,b.x);assert.equal(a.z,b.z);}
assert.equal(clipSummary({kind:'travel',direction:'forward-right',value:24}),'Diagonal forward-right 24″');assert.equal(clipSummary({kind:'travel',direction:'left',value:6}),'Move left 6″');
// while it plays, the desk is on the 45-degree line (a smooth clip mid-way)
{const m=cleanClipMotion({initial:{height:30,tilt:0,x:0,z:0,yaw:0},clips:[{id:'d',lane:'wheels',kind:'travel',start:1,duration:2,easing:'smooth',value:30,direction:'backward-left'}]},5);
 for(const t of [1.3,2,2.7]){const p=sampleClipMotion(m,t);near(p.x,p.z,1e-9,`on the line at ${t} s`);assert.ok(p.x<0&&p.z<0);}
 const end=sampleClipMotion(m,3);near(Math.hypot(end.x,end.z),30,1e-9,'30″ along');}

// ---- 2 the planner: lands within 1 cm and .5 degree of the landing spot, from anywhere
assert.equal(shortTurn(0,270),-90);assert.equal(shortTurn(170,-170),20);assert.equal(shortTurn(0,180),180);assert.equal(shortTurn(10,10),0);
let seed=11;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
for(let n=0;n<500;n++){
  const from={height:40,tilt:10,x:(rnd()-.5)*200,z:(rnd()-.5)*200,yaw:(rnd()-.5)*360},to={x:from.x+(rnd()-.5)*160,z:from.z+(rnd()-.5)*160,yaw:(rnd()-.5)*720};
  const order=rnd()<.5?'straight-first':'diagonal-first',plan=planApproach(from,to,{order}),start=2,clips=approachClips(plan,start);
  assert.ok(plan.legs.length<=3);assert.ok(plan.legs.filter(l=>l.kind==='travel'&&isDiagonal(l.direction)).length<=1,'one diagonal');
  if(plan.legs.length>1)assert.equal(plan.legs.at(-1).kind,'rotate','the turn last');
  const seconds=start+plan.seconds+1,m=cleanClipMotion({initial:from,clips},seconds),end=sampleClipMotion(m,seconds);
  assert.ok(Math.hypot(end.x-to.x,end.z-to.z)<=CM,`plan ${n}: lands ${(Math.hypot(end.x-to.x,end.z-to.z)*2.54).toFixed(3)} cm from the spot`);
  assert.ok(Math.abs(shortTurn(end.yaw,to.yaw))<=.5,`plan ${n}: heading off by ${shortTurn(end.yaw,to.yaw)}°`);
  // the legs play back to back, inside the time the plan says
  clips.forEach((c,i)=>{if(i)near(c.start,clips[i-1].start+clips[i-1].duration,.002,'back to back');});
  near(clips.length?clips.at(-1).start+clips.at(-1).duration-start:0,plan.seconds,.005,'the plan\'s seconds');
}
// the order: a straight leg first (Vico: "go forward a bit and then diagonally"), or the diagonal first
{const from={x:0,z:0,yaw:0},to={x:10,z:30,yaw:-90};
 const a=planApproach(from,to);assert.deepEqual(a.legs.map(l=>[l.kind,l.direction,l.value]),[['travel','forward',20],['travel','forward-right',14.142],['rotate','left',90]]);
 const b=planApproach(from,to,{order:'diagonal-first'});assert.deepEqual(b.legs.map(l=>l.direction),['forward-right','forward','left']);
 assert.equal(a.legs[0].duration,1.667,'12″/s');assert.equal(a.legs[2].duration,2,'45°/s');
 assert.match(describePlan(a),/^Forward 20″ → Diagonal forward-right 14\.142″ → Turn left into place 90° · 4\.846 s/);}
// exactly 45 degrees away: the diagonal alone; no offset: nothing
assert.deepEqual(planApproach({x:0,z:0,yaw:0},{x:-12,z:-12,yaw:0}).legs.map(l=>l.direction),['backward-left']);
assert.deepEqual(planApproach({x:3,z:4,yaw:90},{x:3,z:4,yaw:90}).legs,[]);assert.match(describePlan(planApproach({x:0,z:0,yaw:0},{x:0,z:0,yaw:0})),/^Already there/);
assert.throws(()=>planApproach({x:0,z:0,yaw:0},{x:500,z:0,yaw:0}),/up to 240″/);assert.throws(()=>planApproach({x:0,z:0},{x:1,z:1,yaw:0}),/heading/);
assert.equal(legLabel({kind:'travel',direction:'left',value:3}),'Strafe left 3″');

// ---- 3 the storage chapter (Andre's workshop) as a demo, on a COPY: from the pose at 12.25 s to where it lands
{const cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json'),'utf8')),shot=structuredClone(cut.shots.find(s=>s.id==='storage')),frozen=JSON.stringify(shot);
 const m=cleanClipMotion(shot.motion,shot.seconds),from=sampleClipMotion(m,12.25),to=sampleClipMotion(m,shot.seconds);
 const plan=planApproach(from,to),clips=approachClips(plan,12.25);
 const others=m.clips.filter(c=>c.lane!=='wheels'||c.start<12.25),demo=cleanClipMotion({...m,clips:[...others,...clips]},shot.seconds),end=sampleClipMotion(demo,shot.seconds);
 assert.ok(Math.hypot(end.x-to.x,end.z-to.z)<=CM&&Math.abs(shortTurn(end.yaw,to.yaw))<=.5,'the demo lands where the chapter does');
 assert.ok(12.25+plan.seconds<=shot.seconds,'and fits the chapter');assert.equal(JSON.stringify(shot),frozen,'the chapter data untouched');
 console.log('storage demo:',describePlan(plan));}
console.log('desk-approach-test: ok (diagonals at 45° with the heading kept, straight moves unchanged; 500 plans land within 1 cm and .5°)');
