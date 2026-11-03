import assert from 'node:assert/strict';
import {paceChapter} from '../experience/chapter-timing.mjs';
import {showcaseShots} from '../experience/showcase.mjs';
import {sampleClipMotion} from '../experience/desk-clips.mjs';
import {sampleCamera} from '../experience/camera-track.mjs';
const shot=showcaseShots()[1],motion=shot.motion;
const view=x=>({position:[x,3,8],target:[0,1,0],fov:35,aspect:16/9});
const keys=[{id:'a',time:0,easing:'smooth',view:view(1)},{id:'b',time:1,easing:'smooth',view:view(4)}];
const original=structuredClone(shot);
const slowed=paceChapter(shot,motion,keys,shot.seconds*1.25);
for(const t of [0,3,6,10,15,20])assert.deepEqual(sampleClipMotion(slowed.motion,t*1.25),sampleClipMotion(motion,t));
const held=paceChapter(shot,motion,keys,shot.seconds+2,true);
for(const t of [0,5,10,20,21,22]){
 assert.deepEqual(sampleClipMotion(held.motion,t),sampleClipMotion(motion,Math.min(t,20)));
 const actual=sampleCamera(held.camera.keys,t/22),expected=sampleCamera(keys,Math.min(t/20,1));
 actual.position.forEach((v,i)=>assert.ok(Math.abs(v-expected.position[i])<1e-9));
}
assert.deepEqual(shot,original);
assert.throws(()=>paceChapter(shot,motion,keys,91));
assert.throws(()=>paceChapter(shot,motion,Array(64).fill(keys[0]),22,true));
console.log('Pacing: synchronized retime, stationary ending hold, immutable input and limits passed.');
