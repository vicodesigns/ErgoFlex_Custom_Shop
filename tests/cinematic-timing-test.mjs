import assert from 'node:assert/strict';
import {ShotClock,measureRoute,routePose} from '../experience/timing.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

// A dropped frame changes sampling frequency, not the desk's speed.
for(const samples of [[0,16,32,48,1000],[0,33,250,980,1000]]){
  const clock=new ShotClock();clock.reset(samples[0],true);
  for(const now of samples)close(clock.progress(now,2),now/2000);
  close(clock.progress(1000,2),.5);
  clock.setRunning(false,1000);close(clock.seconds(50000),1);
  clock.setRunning(true,50000);close(clock.progress(51000,2),1);
}
const c=new ShotClock();c.reset(100,true);c.setRunning(false,600);c.setRunning(false,900);
close(c.seconds(10000),.5);c.reset(10000,false);close(c.seconds(20000),0);

// Unequal route waypoints must not create artificial changes in travel speed.
const route=measureRoute([{x:0,z:0,yaw:0},{x:10,z:0,yaw:0},{x:1000,z:0,yaw:0}]);
close(routePose(route,.5).x,500);close(routePose(route,.01).x,10);
close(routePose(route,1).x,1000);close(routePose(route,-1).x,0);
const turn=measureRoute([{x:0,z:0,yaw:179*Math.PI/180},{x:0,z:0,yaw:-179*Math.PI/180}]);
close(routePose(turn,.5).yaw,Math.PI);
assert.equal(routePose(measureRoute([]),.5),null);
assert.deepEqual(routePose(measureRoute([{x:1,z:2,yaw:0},{x:1,z:2,yaw:0}]),.5),{x:1,z:2,yaw:0});
console.log('Cinematic timing: refresh-independent motion, pause/resume, uniform route speed and shortest turns verified.');
