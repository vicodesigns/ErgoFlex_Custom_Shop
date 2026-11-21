// A cut belongs to its camera key, not to an index (20 Nov 2026, Vico's Create: the film cut at 19.5 s "Cut: later, Lin
// paints…" landed on "Camera view 11", a copy of that view at 19.533 s, and the 19.5 s key lost it, so the render moved
// into the view and then "cut" to the same view). Cause: Director keys carry plan-NN ids from the film plan as it was when
// the draft was made; an import that put a key earlier in the chapter shifted every later index by one, and the cut / hold
// were inherited by index. Now the key is matched by what it is (camera-transitions.mjs matchPlanKeys, director-bridge.py
// match_plan): the same view at the same time, else the same view nearest in time, else the same time.
//   For filmCamera (the Director's film camera, Render still) and the importer alike, the cut stays on its view when:
//   a key is inserted before it, a key before it is deleted, it is retimed, it is re-aimed in place, the draft's ids are
//   one off (the Create case), and a copy of its view sits right after it (the copy gets nothing).
//   node tests/camera-cut-identity-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {matchPlanKeys} from '../experience/camera-transitions.mjs';
import {filmCamera} from '../experience/film-render.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cut-identity-'));
const T=20;
const V=(x,z=0)=>({position:[x,2,5+z],target:[x,1,z],fov:35});
// the film plan: A 0 s, B 5 s, C 9.45 s (hold .05), D 9.5 s CUT, E 15 s
const PLAN=[{at:0,...V(0),label:'A'},{at:5,...V(1),label:'B'},{at:9.45,...V(2),label:'C',hold:.05},{at:9.5,...V(7,3),label:'D cut',cut:true},{at:15,...V(8,3),label:'E'}];
const film={seconds:T,cameraPlan:{keys:PLAN}};
const dk=(id,at,v,label)=>({id,time:at/T,label,easing:'linear',view:{...v,aspect:16/9}});
const fresh=()=>PLAN.map((p,i)=>dk('plan-0'+i,p.at,p,p.label));
// which plan key labels carry the cut / hold after filmCamera and after the importer
const cutsOf=keys=>keys.filter(k=>k.cut).map(k=>[k.label,k.at]),holdsOf=keys=>keys.filter(k=>'hold' in k).map(k=>[k.label,k.hold]);
function viaImporter(keys){
  const planFile=path.join(tmp,'plan.json'),ex=path.join(tmp,'export.json'),out=path.join(tmp,'out.json');
  fs.writeFileSync(planFile,JSON.stringify({id:'x',seconds:T,cameraPlan:{keys:PLAN}}));
  fs.writeFileSync(ex,JSON.stringify({shots:[{id:'x',seconds:T,camera:{keys}}]}));
  execFileSync('python3',[path.join(root,'tools/experience/director-bridge.py'),'import',ex,out,'--shot','x','--plan',planFile],{stdio:['ignore','pipe','pipe']});
  return JSON.parse(fs.readFileSync(out,'utf8')).keys;
}
const both=(keys,what,wantCut,wantHold=[['C',.05]])=>{
  for(const [via,plan] of [['filmCamera',filmCamera(film,keys,T).cameraPlan.keys],['importer',viaImporter(keys)]]){
    assert.deepEqual(cutsOf(plan),wantCut,`${what} (${via}): the cut is on ${JSON.stringify(wantCut)}, got ${JSON.stringify(cutsOf(plan))}`);
    assert.deepEqual(holdsOf(plan),wantHold,`${what} (${via}): the hold stays on C`);
  }
  console.log('ok  '+what);
};
// nothing changed
both(fresh(),'no edit',[['D cut',9.5]]);
// a key inserted before the cut key (a new id)
{const k=fresh();k.splice(2,0,dk('new-1',7,V(4),'X'));both(k,'a key inserted before the cut key',[['D cut',9.5]]);}
// a key before it deleted
{const k=fresh();k.splice(1,1);both(k,'a key before the cut key deleted',[['D cut',9.5]]);}
// the cut key retimed
{const k=fresh();k[3]=dk('plan-03',10.2,PLAN[3],'D cut');both(k,'the cut key retimed to 10.2 s',[['D cut',10.2]]);}
// the cut key re-aimed in place (Update selected view)
{const k=fresh();k[3]=dk('plan-03',9.5,V(6,2),'D cut');both(k,'the cut key re-aimed in place',[['D cut',9.5]]);}
// the Create case: the draft's ids are one off (made when the plan had no B): A plan-00, C plan-01, D plan-02, E plan-03,
// B under a random id; and a copy of D's view at 9.533 s with plan-03's id (it shifted onto the next key)
{
  const k=[dk('plan-00',0,PLAN[0],'A'),dk('rnd-b',5,PLAN[1],'B'),dk('plan-01',9.45,PLAN[2],'C'),dk('plan-02',9.5,PLAN[3],'D cut'),dk('plan-03',9.533,PLAN[3],'Camera view 11'),dk('plan-04',15,PLAN[4],'E')];
  both(k,'ids one off and a copy of the cut view right after it (Vico\'s Create)',[['D cut',9.5]]);
  const m=matchPlanKeys(k,PLAN,T);assert.equal(m[4],null,'the copy is no plan key');assert.equal(m[3],PLAN[3]);assert.equal(m[1],PLAN[1],'B found by its view under a random id');
}
// the old by-index rule on that draft would have moved the cut onto the copy and dropped it from D: shown for the record
{
  const k=[dk('plan-00',0,PLAN[0],'A'),dk('plan-01',5,PLAN[1],'B'),dk('plan-02',9.45,PLAN[2],'C'),dk('plan-03',9.5,PLAN[3],'D cut'),dk('plan-04',9.533,PLAN[3],'Camera view 11')];
  const shifted=[{at:0,...V(0)},{at:2,...V(9)},...PLAN.slice(1)];   // the film after an import put a key at 2 s
  const byIndex=k.map(x=>shifted[Number(x.id.slice(5))]);assert.equal(byIndex[4].cut,true,'(by index the copy got the cut)');assert.ok(!byIndex[3].cut,'(and D lost it)');
  const m=matchPlanKeys(k,shifted,T);assert.equal(m[3].cut,true,'by what the key is: D keeps it');assert.equal(m[4],null);
}
fs.rmSync(tmp,{recursive:true,force:true});
console.log('camera-cut-identity-test: ok (a cut and a hold stay on their view through insert, delete, retime, re-aim, shifted ids and a duplicate view; filmCamera and the importer agree)');
