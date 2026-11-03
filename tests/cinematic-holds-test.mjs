import assert from 'node:assert/strict';
import {addCameraHolds} from '../experience/camera-holds.mjs';
import {sampleCamera} from '../experience/camera-track.mjs';
import {sampleClipMotion} from '../experience/desk-clips.mjs';
const shot={seconds:10},keys=[0,.5,1].map((time,i)=>({id:'k'+i,time,label:'View '+i,easing:'smooth',view:{position:[2+i,3,5],target:[0,1,0],fov:35,aspect:16/9}}));
const motion={initial:{height:28,tilt:0,x:0,z:0,yaw:0},clips:[{id:'turn',start:0,duration:10,lane:'wheels',kind:'rotate',direction:'right',value:360,easing:'smooth'}]};
const result=addCameraHolds(shot,keys,motion,4);assert.equal(result.seconds,22);
for(const [start,view]of [[0,keys[0].view],[9,keys[1].view],[18,keys[2].view]]){
 for(const t of [start+.1,start+2,start+3.9]){assert.deepEqual(sampleCamera(result.camera.keys,t/22),view);assert.deepEqual(sampleClipMotion(result.motion,t),sampleClipMotion(result.motion,start));}
}
assert.equal(sampleClipMotion(result.motion,22).yaw,360);
assert.equal(motion.clips.length,1);assert.equal(keys.length,3);
console.log('Camera holds: four-second static viewpoints, matching desk holds, preserved full rotation and immutable source passed.');
