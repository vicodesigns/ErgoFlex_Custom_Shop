// Held things moved on their own (people-held.mjs): a model's 'Held.*' parts, skinned to the hand, move / turn / resize
// about their base by the posture's `held`, still follow the hand, and go back exactly; the stored shape is checked.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyHeld,heldItems,archivedHeld} from '../people-held.mjs';
import {validateArchivedKeys,postureRecord,hasPosturePose} from '../people-postures.mjs';
// a body: root -> hand_r (at 0,1,0); a box 'robot' (0.1 m, base at y=1) skinned all to the hand, and a skin part to root
function model(){
  const root=new THREE.Bone();root.name='Root';const hand=new THREE.Bone();hand.name='hand_r';hand.position.set(0,1,0);root.add(hand);
  const g=new THREE.BoxGeometry(.1,.1,.1);g.translate(0,1.05,.2);const n=g.getAttribute('position').count;
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(n*4).fill(0).map((_,i)=>i%4===0?1:0),4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(new Array(n*4).fill(0).map((_,i)=>i%4===0?1:0),4));
  const robot=new THREE.SkinnedMesh(g,[new THREE.MeshStandardMaterial({name:'Held.robo-pal 0'})]);
  const b=new THREE.BoxGeometry(.3,1,.2);const m=b.getAttribute('position').count;b.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(m*4).fill(0),4));b.setAttribute('skinWeight',new THREE.Float32BufferAttribute(new Array(m*4).fill(0).map((_,i)=>i%4===0?1:0),4));
  const body=new THREE.SkinnedMesh(b,new THREE.MeshStandardMaterial({name:'Human.body'}));
  const o=new THREE.Group();o.add(root,robot,body);o.updateMatrixWorld(true);
  const sk=new THREE.Skeleton([root,hand]);robot.bind(sk,robot.matrixWorld);body.bind(sk,body.matrixWorld);return {o,hand,robot,body};
}
const at=(mesh,i=0)=>{mesh.parent.updateMatrixWorld(true);mesh.skeleton.update();const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),i);mesh.applyBoneTransform(i,p);return p;};
const close=(a,b,msg)=>assert.ok(a.distanceTo(b)<1e-6,`${msg}: ${a.toArray()} vs ${b.toArray()}`);
{const {o,robot,body,hand}=model();
  assert.deepEqual(heldItems(o),[{bone:'hand_r',label:'robo-pal'}]);
  const p0=at(robot),b0=at(body),n=robot.geometry.getAttribute('position').count;
  // moved 10 cm up and 5 cm to his right (x -): only the robot moves
  assert.ok(applyHeld(o,{hand_r:{at:[-.05,.1,0]}}));close(at(robot),p0.clone().add(new THREE.Vector3(-.05,.1,0)),'moved');close(at(body),b0,'the body stays');
  assert.equal(applyHeld(o,{hand_r:{at:[-.05,.1,0]}}),false,'nothing to do when unchanged');
  // still follows the hand: the hand goes up 20 cm, the robot with it
  hand.position.y+=.2;close(at(robot),p0.clone().add(new THREE.Vector3(-.05,.3,0)),'follows the hand');hand.position.y-=.2;
  // turned 90 degrees about its base (centre 0,1,.2): a corner (x .05, z .25) goes to (x .05, z .15) after +90 about y
  applyHeld(o,{hand_r:{turn:[0,90,0]}});
  const c=new THREE.Vector3(0,1,.2);for(let i=0;i<n;i++){const v=new THREE.Vector3().fromBufferAttribute(robot.geometry.getAttribute('position'),i).sub(c).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2).add(c);close(at(robot,i),v,'turned about its base');}
  // twice the size about the base: the top goes from 1.1 to 1.2
  applyHeld(o,{hand_r:{scale:2}});const top=Math.max(...Array.from({length:n},(_,i)=>at(robot,i).y));assert.ok(Math.abs(top-1.2)<1e-6,'scaled about its base '+top);
  // back as built: the original skeleton, exactly
  applyHeld(o,null);close(at(robot),p0,'back');assert.equal(robot.skeleton,body.skeleton);assert.equal(robot.userData.heldOriginal,undefined);}
// the stored shape
assert.deepEqual(archivedHeld({hand_r:{at:[.1,0,0],turn:[0,45,0],scale:1.5},'bad bone!':{at:[1,0,0]},hand_l:{at:[0,0,0]},x:{at:[9,0,0]}}),{hand_r:{at:[.1,0,0],turn:[0,45,0],scale:1.5}});
assert.equal(archivedHeld({hand_r:{scale:1}}),undefined);
const entry=validateArchivedKeys({id:'people-andre-stand-robot-work',postures:{'people-andre-stand-robot-work':{held:{hand_r:{at:[0,.02,0]},junk:5}}}});
assert.deepEqual(entry.postures['people-andre-stand-robot-work'].held,{hand_r:{at:[0,.02,0]}});
assert.deepEqual(postureRecord(entry).held,{hand_r:{at:[0,.02,0]}});assert.ok(hasPosturePose(entry),'a held offset needs the skeleton');
console.log('people-held-test: ok (move / turn / size about the base, follows the hand, back exactly, stored shape)');
