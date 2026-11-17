// People motion fields (Director UX plan rev 3, 17 Nov 2026): a desk user's own chair roll (chairRoll / chairScoot,
// mm), their distance from the desk over time (reachKeys), and that both whitelists keep them: the Director's
// cleanPeople (experience/people-edits.mjs) and the film import's clean_people (tools/experience/build-round8-director.py).
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cleanPeople,cleanPerson,peopleFilter,cleanReachKeys} from '../experience/people-edits.mjs';
import {reachAt,PersonRig,DeskActor,solveDesk,STAND_UP} from '../room-people-motion.mjs';
import fs from 'node:fs';

// ---- reachAt: eased between keys, `reach` before the first, the last `to` after the end
const keys=[{at:2,dur:2,to:845},{at:6,dur:1,to:1000,ease:'linear'}];
assert.equal(reachAt(945,keys,0),945);
assert.equal(reachAt(945,keys,2),945);
assert.equal(reachAt(945,keys,3),895,'half way, smooth');
assert.equal(reachAt(945,keys,5),845);
assert.equal(reachAt(945,keys,6.5),922.5,'half way, linear, from the last key');
assert.equal(reachAt(945,keys,9),1000);
assert.equal(reachAt(945,keys,null),945,'no time (the Studio): reach itself');
assert.equal(reachAt(945,undefined,3),945);
assert.equal(reachAt(945,[{at:1,dur:0,to:900}],1.01),900,'no duration: a cut');
assert.equal(reachAt(945,[keys[1],keys[0]],5),845,'keys in any order');

// ---- the Director's whitelist (legacy form) keeps them, checked
const maya={key:'maya',id:'people-maya-sit-type',desk:'sit',reach:910,standReach:820,chairRoll:400,chairScoot:120,reachKeys:[{at:7,dur:1.2,to:880},{at:3,to:860,ease:'linear'}]};
const c=cleanPerson(maya);
assert.equal(c.reach,910);assert.equal(c.standReach,820);assert.equal(cleanPerson({...maya,standReach:9000}).standReach,undefined);assert.equal(c.chairRoll,400);assert.equal(c.chairScoot,120);
assert.deepEqual(c.reachKeys,[{at:3,dur:1.5,to:860,ease:'linear'},{at:7,dur:1.2,to:880}]);
assert.equal(cleanPerson({...maya,chairRoll:5000}).chairRoll,undefined,'out of range: dropped');
assert.equal(cleanPerson({...maya,chairScoot:-1}).chairScoot,undefined);
assert.equal(cleanPerson({key:'a',id:'people-maya-stand',at:[0,0],chairRoll:300}).chairRoll,undefined,'only at the desk');
assert.equal(cleanReachKeys([{at:-1,to:900},{at:1,to:9000},{at:'x',to:900}]),null);
assert.equal(cleanReachKeys(Array.from({length:30},(_,i)=>({at:i,to:900}))).length,16);
// a walker's own fields stay (KEPT): swing, toes, then; and look, act.by
const noah={key:'noah',id:'people-noah-walk',at:[100,200],turn:0,walk:{path:[[100,200],[900,200]],start:2,swing:'path',toes:'stiff'},look:['maya'],act:{at:3,dur:1,by:[0,10,40]}};
assert.deepEqual(cleanPerson(noah).walk,noah.walk);assert.deepEqual(cleanPerson(noah).look,['maya']);assert.deepEqual(cleanPerson(noah).act,noah.act);
// three spans, all kept (the on-screen span fix)
const v1={cast:[maya,noah],when:{maya:[[0,4],[6,9,.5,.5],[11,14]]}},p1=cleanPeople(v1);
assert.equal(p1.when.maya.length,3);
const f1=peopleFilter(v1);assert.deepEqual(f1.cast.find(e=>e.key==='maya').reachKeys,c.reachKeys);

// ---- v: 2 (what the Director writes): verbatim, both sides
const v2={v:2,cast:[maya,noah],when:v1.when,chair:{back:640,side:0,turn:0}};
assert.deepEqual(cleanPeople(v2).cast[0],maya);

// ---- the film import keeps the same (the Python whitelist, extracted the way people-postures-test does)
const py="import ast,copy,json,re,math,sys\ns=ast.parse(open('tools/experience/build-round8-director.py').read())\nf=[n for n in s.body if (isinstance(n,ast.FunctionDef) and n.name in ('archived_pose','archived_keys','archived_postures','clean_people')) or (isinstance(n,ast.Assign) and any(getattr(t,'id','')=='_fin' for t in n.targets))]\nexec(compile(ast.Module(body=f,type_ignores=[]),'clean_people','exec'))\nprint(json.dumps([clean_people(x) for x in json.load(sys.stdin)]))";
const [pyV1,pyV2]=JSON.parse(execFileSync('python3',['-c',py],{input:JSON.stringify([v1,v2]),cwd:new URL('..',import.meta.url)}).toString());
const pm=pyV1.cast.find(e=>e.key==='maya');
for(const k of ['reach','standReach','chairRoll','chairScoot','reachKeys'])assert.deepEqual(pm[k],c[k],'python keeps '+k+' as the Director cleans it');
assert.equal(pyV1.when.maya.length,3,'python keeps every span');
assert.deepEqual(pyV2.cast[0],maya,'python v2: verbatim');
const bad=JSON.parse(execFileSync('python3',['-c',py],{input:JSON.stringify([{cast:[{...maya,chairRoll:5000,chairScoot:-1,reachKeys:[{at:-1,to:900}]}]}]),cwd:new URL('..',import.meta.url)}).toString())[0].cast[0];
assert.equal(bad.chairRoll,undefined);assert.equal(bad.chairScoot,undefined);assert.equal(bad.reachKeys,undefined);

// ---- chair roll: the chair (and the hips with it) roll back further, the end posture unchanged
{
  const rig=new PersonRig(JSON.parse(fs.readFileSync(new URL('../assets/props/people-rigs/maya.json',import.meta.url),'utf8')));
  const member=(id,role,behind)=>({id,role,behind,scale:1000,object:{userData:{}}});
  const a=new DeskActor(rig);a.configure([member('people-maya-sit-type','sit',470),member('people-maya-stand-type','stand',415)]);
  const at=(tau,extra={})=>{const o=solveDesk(rig,a.keys,{tau,k:0,height:36,time:null,seed:a.seed,...extra});return {back:o.chair.back,z:rig.wp[rig.b.pelvis].z};};
  const base=at(1),more=at(1,{chairRoll:.4}),none=at(1,{chairRoll:undefined,chairScoot:undefined});
  assert.deepEqual(none,base,'absent: the film as before');
  assert.ok(more.back>base.back+.1,'a bigger roll rolls the chair further back');
  assert.ok(more.z<base.z-.05,'and the hips go back with it');
  const end=at(STAND_UP),endMore=at(STAND_UP,{chairRoll:.4});assert.ok(Math.abs(end.z-endMore.z)<1e-9,'standing: the same posture');
  assert.ok(at(STAND_UP,{chairScoot:.2}).back>end.back+.1,'scoot adds to the chair\'s back');
  a.chairRoll=.4;a.drive({height:36,time:null,dt:0});assert.ok(Number.isFinite(a.out.chair.back));
}

console.log('people-motion-fields-test: ok');
