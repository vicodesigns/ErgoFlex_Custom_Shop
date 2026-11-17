import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {RoomPeople,deskFamily} from '../room-people.mjs';
import {postureRecord,migratePostures,editPosture,postureView,poseOwner,sourceOf,roomEditKey,editablePeople,blendPosturePoses} from '../people-postures.mjs';
import {canonicalPeople,cleanPeople,peopleFilter} from '../experience/people-edits.mjs';
import {setPoseKey,poseAt} from '../people-pose-keys.mjs';
import {sheet,sheetKeys,shiftKeys,deleteKeys,copyKeys,pasteKeys,setEase,setJointAngles,toggleKeyAt} from '../experience/people-track.mjs';
import {PersonRig,solveStill,drawPose,WORKOUTS} from '../room-people-motion.mjs';
import {stage,snapshots,snapshot} from './people-postures-harness.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const chapters=read('people-postures-chapters.json'),baseline=read('people-postures-baseline.json');
const rise=chapters[0],stand='people-maya-stand-type-41',sit='people-maya-sit-type',key='maya-stand';
const legacy=rise.people.cast.find(e=>e.key===key),before=JSON.stringify(legacy),oldPose=structuredClone(legacy.pose);
const turn=angle=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle*Math.PI/180).toArray();
const ID=[0,0,0,1];
// The real six-bone correction, including negative-w and tiny components, is exact.
const migrated=migratePostures(legacy);
assert.deepEqual(migrated.postures[stand].pose,oldPose);assert.equal(JSON.stringify(legacy),before);
assert.deepEqual(migratePostures(migrated),migrated);assert.ok(!('pose' in migrated));
assert.deepEqual(postureRecord(legacy,stand),postureRecord(migrated,stand));assert.deepEqual(postureRecord(legacy,sit),{});
const mixed={...legacy,poseKeys:[{t:7.123456789,pose:{head:turn(8)}}],postures:{[stand]:{pose:null},'people-maya-future':{custom:'kept',poseKeys:[]}}};
const mm=migratePostures(mixed);assert.equal(mm.postures[stand].pose,null);assert.deepEqual(mm.postures[stand].poseKeys,mixed.poseKeys);assert.deepEqual(mm.postures['people-maya-future'],mixed.postures['people-maya-future']);
for(const v of [undefined,2]){
  const p={...(v?{v}:{}),cast:[mixed]};const readBack=cleanPeople(p);assert.deepEqual(readBack.cast[0].pose,oldPose);
  const c=canonicalPeople(readBack);assert.deepEqual(c.cast[0].postures,mm.postures);assert.deepEqual(JSON.parse(JSON.stringify(c)),c);
}
// Archive order is retained in storage; evaluation and panel navigation still
// use temporal neighbours, with no quaternion quantization during a read.
{
 const keys=[{t:6,pose:{head:turn(30)}},{t:0,pose:{head:turn(0)}},{t:3,pose:{head:turn(12)}}],entry={...legacy,poseKeys:keys};
 for(const t of [0,1,3,4,7])assert.deepEqual(poseAt(postureRecord(migratePostures(entry),stand),t),poseAt({pose:legacy.pose,poseKeys:[keys[1],keys[2],keys[0]]},t));
 assert.deepEqual(migratePostures(entry).postures[stand].poseKeys,keys);
}
// Ownership is a source binding, never a character-name merge of free placements.
const roomSit={id:sit,desk:'sit'},extra={...legacy,extra:true};
assert.equal(poseOwner(roomSit,[legacy,rise.people.cast[1]]),legacy);assert.equal(poseOwner({id:'people-maya-stand-wait',at:[0,0]},[legacy]),null);
assert.equal(poseOwner(roomSit,[legacy,{...legacy,key:'other'}]),null,'ambiguous film desks remain separate');
const source=sourceOf(roomSit),bound={...migrated,poseBindings:[source]};
assert.equal(poseOwner(roomSit,[bound]),bound);assert.equal(poseOwner({...roomSit,id:sit+'-30',variant:source.key},[bound]),bound);
assert.equal(poseOwner({...roomSit,station:'elsewhere'},[bound]),null);
const virtual={key:roomEditKey(source),...roomSit,poseSource:source};
assert.equal(roomEditKey(structuredClone(source)),virtual.key);
assert.equal(editablePeople({cast:[bound]},[{...virtual,key:bound.key}]).cast.length,1);
assert.equal(editablePeople({cast:[]},[virtual]).cast[0].key,virtual.key);
assert.deepEqual(deskFamily(stand),[],'do not broaden the legacy -41 family');
// Every model and every bone/placement transform hashes exactly like pre-change HEAD.
for(const shot of chapters){
  const expected=baseline.find(b=>b.id===shot.id).frames;
  assert.deepEqual(await snapshots(RoomPeople,shot),expected,shot.id+': legacy code path matches pre-change baseline');
  const canonical={...shot,people:peopleFilter(canonicalPeople({v:2,...shot.people}))};
  assert.deepEqual(await snapshots(RoomPeople,canonical),expected,shot.id+': migration changes no model/transform');
}
// Maya: first seated edit uses her existing room model and preserves the desk actor.
const was=globalThis.__ERGO_PRESENTATION__;globalThis.__ERGO_PRESENTATION__=true;
const {people,state}=await stage(RoomPeople,rise);
let p=canonicalPeople(editablePeople({v:2,...rise.people},people.resolved({editable:true})));
assert.equal(p.cast.filter(e=>e.id===sit).length,0,'no extra seated cast placement');
assert.deepEqual(p.cast.find(e=>e.key===key).poseBindings,[source]);
const members=people.actors.map(a=>a.members.map(m=>m.id));
const entry=p.cast.find(e=>e.key===key);
editPosture(entry,sit,r=>{r.pose={upperarm_l:turn(9)};Object.assign(r,setPoseKey(r,16.6,'upperarm_l',turn(13)));});
people.setFilter(peopleFilter(p));people.update(state(16.6));await people.settled();people.update(state(16.6));
assert.deepEqual(people.actors.map(a=>a.members.map(m=>m.id)),members);
const shown=people.byKey(key);assert.equal(shown.userData.person.id,sit);assert.equal(people.editKeyOf(shown.userData.person),key);
const bone=shown.userData.personRig.bones.get('upperarm_l'),rest=shown.userData.personRig.rest.get('upperarm_l');
assert.ok(bone.quaternion.angleTo(rest.clone().multiply(new THREE.Quaternion().fromArray(postureRecord(entry,sit).poseKeys[0].pose.upperarm_l)))<1e-6,'seated keyed correction is drawn');
const visibleSnapshot=s=>({members:s.members,shown:s.shown,objects:s.objects.filter(o=>o.visible)});
people.update(state(8));assert.deepEqual(visibleSnapshot(snapshot(people)),visibleSnapshot(baseline[0].frames.find(f=>f.t===8)),'standing frame keeps the original correction');
assert.deepEqual(postureRecord(entry,stand).pose,oldPose);
const saved=JSON.parse(JSON.stringify(p));assert.deepEqual(peopleFilter(cleanPeople(saved)),peopleFilter(p),'export/reload/import preserve both records');
people.setFilter(rise.people);people.update(state(16.6));await people.settled();people.update(state(16.6));assert.deepEqual(visibleSnapshot(snapshot(people)),visibleSnapshot(baseline[0].frames.find(f=>f.t===16.6)),'undo to legacy cut removes the seated correction');
people.setFilter(peopleFilter(saved));people.update(state(16.6));await people.settled();people.update(state(16.6));assert.equal(people.byKey(key).userData.person.id,sit,'redo keeps model selection');
people.dispose();globalThis.__ERGO_PRESENTATION__=was;
// A room-only person is an edit overlay, including in a scene with no motion
// solver. Undo must remove the correction from the already-loaded skeleton.
{
  const shot={...rise,people:{only:[sit],motion:false,cast:[]}};
  const {people:roomPeople,state:roomState}=await stage(RoomPeople,shot);
  const initial=roomPeople.specs().map(s=>[s.id,s.key,s.desk,s.station]);
  const sources=roomPeople.resolved({editable:true}),projection=canonicalPeople(editablePeople({v:2,...shot.people},sources));
  assert.equal(projection.cast.length,1);const owner=projection.cast[0],roomKey=owner.key;
  editPosture(owner,sit,p=>{p.pose={head:turn(11)};});
  roomPeople.setFilter(peopleFilter(projection));roomPeople.update(roomState(16.6));await roomPeople.settled();roomPeople.update(roomState(16.6));
  assert.deepEqual(roomPeople.specs().map(s=>[s.id,s.key,s.desk,s.station]),initial,'source entries instantiate no models');
  const object=roomPeople.byKey(roomKey),rig=object.userData.personRig;
  assert.ok(rig);assert.ok(rig.bones.get('head').quaternion.angleTo(rig.rest.get('head'))>.1);
  roomPeople.setFilter(shot.people);roomPeople.update(roomState(16.6));
  assert.ok(rig.bones.get('head').quaternion.angleTo(rig.rest.get('head'))<1e-6,'undo restores an inactive room skeleton');
  assert.equal(roomPeople.editKeyOf(object.userData.person),roomKey,'room identity is stable before and after save/undo');
  const second={...sources[0],id:'people-maya-stand-type',poseSource:{key:'room-stand',id:'people-maya-stand-type'}};
  const grouped=editablePeople({cast:[]},[sources[0],second]);assert.equal(grouped.cast.length,1);assert.deepEqual(grouped.cast[0].poseBindings,[second.poseSource]);
  roomPeople.dispose();
}
// Same-time keys on different models have distinct IDs and independent operations.
let timeline=structuredClone(saved);editPosture(timeline.cast[0],stand,r=>Object.assign(r,setPoseKey(r,16.6,'upperarm_l',turn(21))));
const keys=[...sheetKeys(sheet(timeline,18)).values()].filter(k=>k.kind==='pose'&&k.entry===key&&k.t===16.6);
assert.equal(keys.length,2);assert.notEqual(keys[0].id,keys[1].id);
const seatedKey=keys.find(k=>k.posture===sit),standingKey=keys.find(k=>k.posture===stand);
const record=(p,id)=>postureRecord(p.cast.find(e=>e.key===key),id);
const standingBefore=structuredClone(record(timeline,stand));
const moved=shiftKeys(timeline,[seatedKey],-.6,18);assert.ok(!moved.error);assert.equal(record(moved.people,sit).poseKeys[0].t,16);assert.deepEqual(record(moved.people,stand),standingBefore);
const bothMoved=shiftKeys(timeline,keys,-.6,18);assert.equal(bothMoved.ids.size,2);assert.equal(new Set(bothMoved.ids.values()).size,2);
const removed=deleteKeys(timeline,[seatedKey]);assert.equal(removed.removed,1);assert.deepEqual(record(removed.people,stand),standingBefore);assert.ok(!record(removed.people,sit).poseKeys);
const copied=copyKeys(timeline,[seatedKey,standingKey]);assert.equal(copied.items.length,2);
const pasted=pasteKeys(timeline,copied,17,18);assert.equal(pasted.ids.length,2);assert.ok(record(pasted.people,sit).poseKeys.some(k=>k.t===17));assert.ok(record(pasted.people,stand).poseKeys.some(k=>k.t===17));
const eased=setEase(timeline,[seatedKey],'hold');assert.equal(record(eased.people,sit).poseKeys[0].ease,'hold');assert.deepEqual(record(eased.people,stand),standingBefore);
const angled=setJointAngles(timeline,seatedKey,'upperarm_l',[12,0,0]);assert.deepEqual(record(angled,stand),standingBefore);
const row=sheet(timeline,18).find(r=>r.row==='maya');const toggled=toggleKeyAt(timeline,row,'pose',16.6,18,{posture:sit,entry:key});assert.equal(toggled.did,'removed');assert.deepEqual(record(toggled.people,stand),standingBefore);
// Continuous, shortest-arc correction blending; the legacy single-store gate is
// covered by the pre-change frame hashes above.
const a={hand_l:turn(12)},b={hand_l:turn(-6),hand_r:turn(20)};
assert.equal(blendPosturePoses(a,b,0),a);assert.equal(blendPosturePoses(a,b,1),b);
let last=new THREE.Quaternion().fromArray(a.hand_l);for(let i=1;i<=100;i++){const q=new THREE.Quaternion().fromArray(blendPosturePoses(a,b,i/100).hand_l);assert.ok(q.angleTo(last)<.004);last=q;}
// Every existing workout composes the same fine-tune AFTER its solver, without
// changing solver output or the rig's prop/attachment positions.
const rigs=new Map();let count=0;
for(const file of fs.readdirSync(new URL('../assets/props/people-rigs/',import.meta.url))){
  if(!file.endsWith('.json'))continue;const data=JSON.parse(fs.readFileSync(new URL('../assets/props/people-rigs/'+file,import.meta.url),'utf8'));
  for(const [id,posture] of Object.entries(data.postures))if(WORKOUTS.has(posture.pose)&&!rigs.has(posture.pose))rigs.set(posture.pose,{data,id});
}
for(const pose of WORKOUTS){
  const {data,id}=rigs.get(pose),rig=new PersonRig(data),k=rig.key(id),e={key:'exercise',id,at:[0,0],postures:{[id]:{pose:{hand_l:turn(7)},poseKeys:[{t:2,pose:{hand_l:turn(14)}}]}}};
  for(const time of [0,2,4]){
    solveStill(rig,k,{time,seed:41});const bones=new Map(rig.names.map(n=>[n,new THREE.Bone()])),rest=new Map(rig.names.map(n=>[n,new THREE.Quaternion()]));
    const solver=rig.lq.map(q=>q.toArray());drawPose(rig,{bones,rest},0,poseAt(postureRecord(e,id),time));
    const expected=rig.lq[rig.names.indexOf('hand_l')].clone().multiply(new THREE.Quaternion().fromArray(poseAt(postureRecord(e,id),time).hand_l)).normalize();
    assert.ok(bones.get('hand_l').quaternion.angleTo(expected)<1e-6,id);assert.deepEqual(rig.lq.map(q=>q.toArray()),solver);count++;
  }
}
// Execute only the Python cleaner function: importing the builder would regenerate
// chapters. Both schema paths must preserve all correction precision and metadata.
const py="import ast,copy,json,re,math,sys\ns=ast.parse(open('tools/experience/build-round8-director.py').read())\nf=[n for n in s.body if (isinstance(n,ast.FunctionDef) and n.name in ('archived_pose','archived_keys','archived_postures','clean_people')) or (isinstance(n,ast.Assign) and any(getattr(t,'id','')=='_fin' for t in n.targets))]\nexec(compile(ast.Module(body=f,type_ignores=[]),'clean_people','exec'))\nprint(json.dumps(clean_people(json.load(sys.stdin))))";
for(const v of [undefined,2]){const input={...(v?{v}:{}),cast:[{...legacy,...migrated,poseBindings:[source]}]};const output=JSON.parse(execFileSync('python3',['-c',py],{input:JSON.stringify(input),encoding:'utf8'}));assert.deepEqual(output.cast[0].postures,migrated.postures);assert.deepEqual(output.cast[0].poseBindings,[source]);}
// Stored corrections keep their exact numbers, but a malformed one never reaches a skeleton (v1 and v2 paths)
{
  const exact=[0.14173924158754475,0.016719660787350796,0.10973899513183932,-0.9836604054676584];
  const bad={key:'a',id:'people-maya-sit-type',desk:'sit',pose:{hand_l:exact,'bad bone':[1,0,0,0],hand_r:[1,'x',0,0],head:[0,0,0,0],spine:[1,2]},postures:{'people-maya-stand-type-41':{pose:{hand_r:exact,neck:null}},'not a model':{pose:{hand_l:exact}}}};
  for(const v of [undefined,2]){
    const out=cleanPeople({...(v?{v}:{}),cast:[structuredClone(bad)]}).cast[0];
    assert.deepEqual(out.pose,{hand_l:exact},'only well-formed bones stay, exactly');
    assert.deepEqual(Object.keys(out.postures),['people-maya-stand-type-41']);assert.deepEqual(out.postures['people-maya-stand-type-41'].pose,{hand_r:exact});
  }
}
console.log(`PASS people postures: lossless migration, Rise/Wellness pre-change transform hashes, room bindings, Maya sit/stand, round trips, independent timeline operations, ${count} workout samples, Python parity`);
