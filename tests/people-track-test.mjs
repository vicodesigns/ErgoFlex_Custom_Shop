// S31 M4: the People track's programmed diamonds (experience/people-track.mjs) on the Cinematographer's cut, and
// retiming them. The roll times match room-people-motion.mjs rollPlan exactly; retimes change only the linked fields.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {programmedDiamonds,retimeDiamond,rollClock} from '../experience/people-track.mjs';
import {rollPlan} from '../room-people-motion.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-cine/review-cut.json'),'utf8'));
const oilers=cut.shots.find(s=>s.id==='oilers'),T=oilers.seconds;
const {rows,diamonds}=programmedDiamonds(oilers.people,T);
const kinds=k=>diamonds.filter(d=>d.key===k).map(d=>d.kind);
// rows: one per character
assert.deepEqual(rows.map(r=>r.row).slice(0,3),['fern','kai','noah']);
// (S9 round 6: Kai rolls all the way in, one roll; its arcs are written as points, a diamond each)
assert.deepEqual(rows.find(r=>r.row==='kai').keys,['kai-rolls','kai']);
// Kai: roll start, the arcs' points, arrival, then the change to typing at 12.75
const kk=kinds('kai-rolls');assert.deepEqual([kk[0],...kk.slice(-2)],['roll-start','roll-end','change']);assert.ok(kk.slice(1,-2).every(k=>k==='roll-point')&&kk.length>4);
const kr=oilers.people.cast.find(e=>e.key==='kai-rolls'),plan=rollPlan(kr.roll.path.map(p=>[p[0]/1000,p[1]/1000]),{speed:kr.roll.speed,radius:kr.roll.radius/1000});
const end=diamonds.find(d=>d.key==='kai-rolls'&&d.kind==='roll-end');
assert.ok(Math.abs(end.t-(kr.roll.start+plan.seconds))<2e-3,`roll arrival ${end.t} = start + rollPlan.seconds ${kr.roll.start+plan.seconds}`);
assert.ok(diamonds.some(d=>d.key==='kai-rolls'&&d.kind==='change'&&d.t===12.75&&d.next==='kai'),'posture change at 12.75 s');
assert.ok(diamonds.some(d=>d.key==='noah-pulls'&&d.kind==='act'&&d.t===5.4)&&diamonds.some(d=>d.key==='noah-pulls'&&d.kind==='act-end'&&Math.abs(d.t-6.5)<1e-6),'the screen pull');
assert.ok(diamonds.some(d=>d.key==='noah-taps'&&d.kind==='act'&&d.t===8.2),'the tap');
assert.ok(diamonds.some(d=>d.key==='noah-steps'&&d.kind==='walk-start'&&d.t===3.9)&&diamonds.some(d=>d.key==='noah-steps'&&d.kind==='walk-end'),'the walk');
// retimes
const only=(a,b,what)=>{const diff=[];for(let i=0;i<a.cast.length;i++)if(JSON.stringify(a.cast[i])!==JSON.stringify(b.cast[i]))diff.push(a.cast[i].key);if(JSON.stringify(a.when)!==JSON.stringify(b.when))diff.push('when');assert.deepEqual(diff,what);};
const d=k=>diamonds.find(x=>x.key===k[0]&&x.kind===k[1]);
let p=retimeDiamond(oilers.people,d(['kai-rolls','change']),12.4,T);only(p,oilers.people,['when']);
assert.deepEqual([p.when['kai-rolls'][0][1],p.when['kai'][0][0]],[12.4,12.4],'a change moves both edges');
p=retimeDiamond(oilers.people,d(['noah-steps','walk-start']),4.5,T);only(p,oilers.people,['noah-steps']);assert.equal(p.cast.find(e=>e.key==='noah-steps').walk.start,4.5);
p=retimeDiamond(oilers.people,d(['noah-taps','act']),8.6,T);only(p,oilers.people,['noah-taps']);assert.equal(p.cast.find(e=>e.key==='noah-taps').act.at,8.6);
p=retimeDiamond(oilers.people,d(['kai-rolls','roll-end']),end.t+1,T);only(p,oilers.people,['kai-rolls']);
const e2=programmedDiamonds(p,T).diamonds.find(x=>x.key==='kai-rolls'&&x.kind==='roll-end');assert.ok(Math.abs(e2.t-(end.t+1))<.05,`roll arrival dragged to ${end.t+1}: speed ${p.cast.find(e=>e.key==='kai-rolls').roll.speed}, now ${e2.t}`);
const we=d(['noah-steps','walk-end']);p=retimeDiamond(oilers.people,we,we.t+.5,T);only(p,oilers.people,['noah-steps']);
const w2=programmedDiamonds(p,T).diamonds.find(x=>x.key==='noah-steps'&&x.kind==='walk-end');assert.ok(Math.abs(w2.t-(we.t+.5))<.1,'walk arrival dragged: '+w2.t);
assert.equal(retimeDiamond(oilers.people,we,3,T),null,'an arrival before its start is refused');
assert.ok(rollClock(2,1,1.2).seconds>2);
// every chapter of the cut derives without error
for(const s of cut.shots)if(s.people&&typeof s.people==='object')programmedDiamonds(s.people,s.seconds);
console.log(`people track: oilers ${rows.length} rows, ${diamonds.length} programmed diamonds (Kai arrives ${end.t} s = rollPlan); retimes change only their linked fields`);
