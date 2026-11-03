import assert from 'node:assert/strict';
import {cinematicViews,polishMovement,openingSwoop} from '../experience/cinematography.mjs';
import {showcaseShots} from '../experience/showcase.mjs';
import {sampleClipMotion,validateClipSchedule} from '../experience/desk-clips.mjs';
import {sampleCamera,cleanCameraKeys} from '../experience/camera-track.mjs';
import {cleanCut,makeCut} from '../experience/cuts.mjs';
const shots=showcaseShots();
for(const s of shots){
 const views=cinematicViews(s);assert.equal(views[0].time,0);assert.equal(views.at(-1).time,1);
 assert.ok(views.every((v,i)=>!i||v.time>views[i-1].time));
 for(const field of ['scope','angle','elevation','distance','focus','fov'])assert.equal(views.at(-1)[field],views.at(-2)[field]);
 const motion=s.motion||{version:2,initial:{height:30,tilt:0,x:0,z:0,yaw:0},clips:[]};
 const next=polishMovement(s,motion);validateClipSchedule(next.motion.clips,next.seconds);
 assert.ok(next.motion.clips.every(c=>c.start>=1.2-1e-6&&c.start+c.duration<=next.seconds-2+1e-6));
 const before=sampleClipMotion(motion,90),after=sampleClipMotion(next.motion,90);assert.deepEqual(after,before);
}
const shot=shots[0],original=structuredClone(shot);
const keys=[0,.3,.65,.92,1].map((time,i)=>({id:'view-'+i,time,label:'View '+i,easing:'smooth',path:'orbit',view:{position:[6+i*.4,4+i*.2,8-i*.3],target:[0,2+i*.1,0],fov:i>=3?45:35,aspect:16/9}}));
const next=openingSwoop(shot,keys,{floor:0,height:4,center:[0,2,0]});
assert.deepEqual(shot,original);assert.deepEqual(next.motion,shot.motion);
assert.deepEqual(next.camera.keys.at(-1).view,keys.at(-1).view);
assert.ok(next.seconds>shot.seconds+6);
const low=next.camera.keys.find(k=>k.label.startsWith('Low-angle'));
assert.ok(low.view.position[1]<low.view.target[1]);
assert.ok(next.camera.keys.find(k=>k.label.startsWith('Lift complete')).time*next.seconds>=Math.max(...shot.motion.clips.map(c=>c.start+c.duration)));
for(let t=0;t<=next.seconds;t+=.025){const camera=sampleCamera(next.camera.keys,t/next.seconds);assert.ok(camera.position.every(Number.isFinite));assert.ok(camera.position[1]>.1);}
for(const t of [0,2,5,8,10]){
 const a=sampleCamera(keys,t/shot.seconds),b=sampleCamera(next.camera.keys,t/next.seconds);
 a.position.forEach((v,i)=>assert.ok(Math.abs(v-b.position[i])<1e-9));
}
assert.equal(cleanCameraKeys(next.camera.keys).length,next.camera.keys.length);
const saved=cleanCut(makeCut('Cinematic test',[next,...shots.slice(1)]));
assert.deepEqual(saved.shots[0].camera.keys.at(-1).view,keys.at(-1).view);
console.log('Cinematic direction: all 12 chapter plans, movement endpoints, opening preservation, low-angle floor clearance and save round trip passed.');
