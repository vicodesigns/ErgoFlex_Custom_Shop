// Carrying a held thing through a change of posture and a walk (room-people.mjs `carry`, 19 Nov 2026, Vico: Kai gets up
// from the sofa at 7.2 s in the music chapter and walks two steps, and must keep the controller in his hands; it used to
// go at the change's middle, with the seated model it belongs to). Headless, the real Kai rig data
// (tools/experience/people-ghost-audit.mjs), a stand-in controller ('Held.' part on hand_r) in the seated model:
//   1. the walking model gets the controller (its own 'Held.' part, bound to its hand_r, the seated model's bind data)
//   2. it sits in the walking model's hand exactly as in the seated model's (the same place in the hand's frame)
//   3. frame by frame 5-11.5 s (sitting, getting up, the walk, standing): one Kai, the controller drawn in every frame,
//      the right hand where the seated pose holds it relative to the chest (not swinging), nothing jumps
//   4. without `carry` the walk swings the arms as before (the hand moves against the chest)
//   5. the Director keeps `carry` (people-edits.mjs cleanPerson)
//   node tests/people-carry-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {library,makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries,RoomPeople} from '../room-people.mjs';
import {cleanPerson} from '../experience/people-edits.mjs';
globalThis.__ERGO_PRESENTATION__=true;
const SIT='people-kai-sit-controller',WALK='people-kai-walk';
const A={key:SIT,id:SIT,at:[-1214,1348],turn:151,postures:{[SIT]:{held:{hand_r:{at:[.028,.047,.019]}},poseKeys:[{t:0,pose:{upperarm_r:[-.016,.0255,-.022,.9993],lowerarm_r:[-.0109,0,.001,.9999],hand_r:[.0106,.0384,.0162,.9991]}}]}}};
const yaw=151*Math.PI/180,end=[Math.round(-1214-Math.cos(yaw)*900),Math.round(1348+Math.sin(yaw)*900)];
const B=carry=>({key:'kai-gets-up',id:WALK,at:[-1214,1348],turn:151,change:{seconds:2.2},walk:{path:[[-1214,1348],end],start:8.4,then:'people-kai-stand-wait'},
  ...(carry?{carry:{from:SIT},postures:{[WALK]:structuredClone(A.postures[SIT])}}:{})});
// the library, with a controller in the seated model: a small box skinned to hand_r, weight 1 (as build_people.py does)
function lib(){
  const l=library(),rigInstance=l.rigInstance;
  l.rigInstance=async id=>{const g=await rigInstance(id);if(!g||id!==SIT)return g;
    g.updateMatrixWorld(true);const bones=[];g.traverse(o=>{if(o.isBone)bones.push(o);});const j=bones.findIndex(b=>b.name==='hand_r'),hand=bones[j];
    const geo=new THREE.BoxGeometry(.15,.03,.1),p=hand.getWorldPosition(new THREE.Vector3()),k=1/g.scale.x;geo.translate(p.x*k,p.y*k+.03,p.z*k+.04);
    const n=geo.attributes.position.count;geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(n*4).fill(0).map((_,i)=>i%4?0:j),4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(new Array(n*4).fill(0).map((_,i)=>i%4?0:1),4));
    const m=new THREE.SkinnedMesh(geo,new THREE.MeshStandardMaterial({name:'Held.Controller'}));m.name='controller';g.add(m);g.updateMatrixWorld(true);m.bind(new THREE.Skeleton(bones));return g;};
  return l;
}
// a vertex of a skinned part where the stage draws it (three.js, attached bind mode): bone world x bone inverse x bind matrix
const top=o=>{while(o.parent)o=o.parent;return o;};
const drawn=(mesh,i=0)=>{top(mesh.skeleton.bones[0]).updateMatrixWorld(true);const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.bindMatrix);
  const j=mesh.geometry.attributes.skinIndex.getX(i);return v.applyMatrix4(mesh.skeleton.boneInverses[j]).applyMatrix4(mesh.skeleton.bones[j].matrixWorld);};
// (in the hand's own frame: a held offset rebinds the part to a bone of its own under the hand, people-held.mjs)
const base=mesh=>mesh.userData.heldOriginal||mesh.skeleton;
const inHand=(mesh,i)=>{const hand=base(mesh).bones[mesh.geometry.attributes.skinIndex.getX(i)];hand.updateMatrixWorld(true);return hand.worldToLocal(drawn(mesh,i));};
async function run(carry){
  const people={v:2,only:[],cast:[A,B(carry)],when:{[SIT]:[[0,7.2,0,0]],'kai-gets-up':[[7.2,99,0,0]]}},filter={...people};delete filter.v;
  const room=makeRoom('gaming','house',[...castEntries('gaming','house'),...filter.cast]),rp=new RoomPeople(room,lib());
  const state=t=>({height:30,tilt:0,mode:'morning',pose:{x:0,z:190,yaw:0},keyboard:{x:0,z:450},time:t,track:null,now:0});
  room.peopleState=()=>state(5);rp.setFilter(filter);await rp.setEnabled(true);await rp.settled();for(let k=0;k<3;k++){rp.update(state(5));await rp.settled();}
  return {rp,state};
}
const parts=o=>{const out=[];o.traverse(m=>{if(m.isSkinnedMesh&&/^Held\./.test(m.material?.name||''))out.push(m);});return out;};
const chest=o=>{const b=o.userData.personRig.bones;return {s:b.get('spine_03'),h:b.get('hand_r')};};
const handOnChest=o=>{const {s,h}=chest(o);o.updateMatrixWorld(true);return s.worldToLocal(h.getWorldPosition(new THREE.Vector3())).multiplyScalar(1000);};   // (mm: the bone frame is metres)
async function frames(carry){
  const {rp,state}=await run(carry),out=[];
  for(let i=0;i<=195;i++){const t=Math.round((5+i/30)*1000)/1000;for(let k=0;k<2;k++){rp.update(state(t));await rp.settled();}
    const on=rp.people.filter(o=>o.visible&&/^people-kai-/.test(o.userData.person.id));assert.equal(on.length,1,`${t}s: one Kai (${on.length})`);
    const o=on[0],held=parts(o);out.push({t,o,pos:[o.position.x,o.position.z],id:o.userData.person.id,held,hand:handOnChest(o),at:held[0]?drawn(held[0],0):null});}
  return {rp,out};
}
// 1 + 2
const {rp,out}=await frames(true);
const walker=rp.people.find(o=>o.userData.person.id===WALK),seated=rp.people.find(o=>o.userData.person.id===SIT);
const [mine]=parts(walker),own=parts(seated)[0]||out[0].held[0];
assert.ok(mine&&base(mine).bones.every(b=>walker.userData.personRig.bones.get(b.name)===b),'1. the walking model has the controller, on its own bones');
assert.ok(mine.userData.heldOriginal&&own.userData.heldOriginal,'1. with Vico\'s grip offset on both (people-held.mjs)');
assert.equal(base(mine).bones[mine.geometry.attributes.skinIndex.getX(0)].name,'hand_r','1. in its right hand');
for(const i of [0,5,11]){const a=inHand(own,i),b=inHand(mine,i);assert.ok(a.distanceTo(b)<1e-6,`2. vertex ${i} sits in the hand as in the seated model (${a.toArray().map(v=>v.toFixed(4))} / ${b.toArray().map(v=>v.toFixed(4))})`);}
// 3
// (from the change on: seated before it, the idle stirs the arms a little, as for anyone; the change starts from the posture)
const ref=out.find(f=>f.t>=7).hand;let worstHand=0,worstStep=0,worstAt=0;
for(let i=0;i<out.length;i++){const f=out[i];assert.ok(f.held.length&&f.held.every(m=>m.visible!==false),`${f.t}s: the controller is drawn (${f.id})`);
  if(f.t>=6.25)worstHand=Math.max(worstHand,f.hand.distanceTo(ref));if(i){const d=f.at.distanceTo(out[i-1].at);if(d>worstStep){worstStep=d;worstAt=f.t;}}}
const ids=[...new Set(out.map(f=>f.id))];
assert.deepEqual(ids,[SIT,WALK],'3. sitting, then the walking model (getting up, the walk, standing): '+ids.join(' > '));
const walkFrames=out.filter(f=>f.t>=8.6&&f.t<=10.4),moved=Math.max(...walkFrames.map(f=>Math.hypot(f.pos[0]-walkFrames[0].pos[0],f.pos[1]-walkFrames[0].pos[1])));
assert.ok(moved>500,`3. he walks (${Math.round(moved)} mm)`);
assert.ok(worstHand<2,`3. the right hand stays where the seated pose holds it against the chest (at most ${worstHand.toFixed(2)} off)`);
// (his body rises at up to ~1.2 m/s at 7.1 s: about 40 mm a frame, the controller with it)
assert.ok(worstStep<48,`3. the controller moves with him, never jumps (largest move in a frame ${worstStep.toFixed(1)} mm at ${worstAt} s)`);
// the seated model hands over to the walking one at the change's middle: the controller does not jump there
const sw=out.findIndex(f=>f.id===WALK),step=i=>out[i].at.distanceTo(out[i-1].at);
assert.ok(sw>1&&Math.abs(step(sw)-step(sw-1))<5,`3. at the hand-over (${out[sw].t} s) the controller moves on as before (${step(sw-1).toFixed(1)} > ${step(sw).toFixed(1)} mm a frame)`);
// 4
const plain=await frames(false),pref=plain.out.find(f=>f.t>=7).hand,swing=Math.max(...plain.out.filter(f=>f.t>=8.6&&f.t<=10.4).map(f=>f.hand.distanceTo(pref)));
assert.ok(swing>worstHand+20,`4. without carry the arms are the walk's own (the hand moves ${swing.toFixed(0)} mm against the chest)`);
assert.ok(plain.out.filter(f=>f.id===WALK).every(f=>!f.held.length),'4. and the walking model holds nothing');
// 5
assert.deepEqual(cleanPerson({...B(true)}).carry,{from:SIT},'5. the Director keeps carry');
console.log(`people-carry-test: ok (Kai keeps the controller through getting up, the walk and standing: the right hand within ${worstHand.toFixed(2)} mm of the seated grip against the chest, the controller at most ${worstStep.toFixed(1)} mm a frame; the walk without carry moves it ${swing.toFixed(0)} mm)`);
process.exit(0);
