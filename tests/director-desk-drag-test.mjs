// A room desk moved in BOTH the Props tab (a prop edit: an offset on the desk's group) and the Desks tab (a desk edit:
// its pose) must land where it is dropped. The stage puts the group at pose + offset each time the film layers are
// applied (film-desk-edits.mjs place, then film-edits.mjs adds the prop edit's position). Vico, 2026-11-15: "the desk
// appears in a different spot than from where I moved it", further with every drag.
import assert from 'node:assert/strict';
import {deskDragPose,cleanDeskEdit} from '../experience/desk-edits.mjs';
const offset={x:-2275,z:0};                                   // the prop edit on the review desk in his draft (mm)
const apply=pose=>({x:pose.x+offset.x,z:pose.z+offset.z});    // where the group stands after the layers are applied
let pose={x:-1345.9,z:6700,yaw:0},group=apply(pose);
for(const [dx,dz] of [[500,0],[0,-300],[-120,40]]){
  const from={...group},now={x:group.x+dx,z:group.z+dz};      // the drag moves the group on the stage
  const next=deskDragPose(pose,from,now);
  assert.deepEqual(apply(next),now,'the desk stands where it was dropped once the film layers are applied again');
  assert.equal(next.yaw,pose.yaw);
  // what the editor did before: the group's place read back as the pose (the offset folded in, then added again)
  assert.notDeepEqual(apply({x:now.x,z:now.z,yaw:0}),now);
  pose=next;group=apply(pose);
}
assert.deepEqual({x:Math.round(pose.x*10)/10,z:pose.z},{x:-965.9,z:6440},'three drags add up to their own sum, no drift');
// no prop edit on the desk: the same as before
assert.deepEqual(deskDragPose({x:100,z:200,yaw:1},{x:100,z:200},{x:150,z:180}),{x:150,z:180,yaw:1});
assert.ok(cleanDeskEdit({desk:'station-project-review',pose:{x:pose.x,z:pose.z,yaw:pose.yaw}}));
console.log('director desk drag: a desk with a prop offset lands where it is dropped, three drags in a row; without an offset as before: OK');
