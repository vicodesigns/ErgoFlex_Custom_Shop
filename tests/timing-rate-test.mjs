// P6 play speed: the shot clock runs at ½× / ¼× from the moment the rate changes, and back.
import assert from 'node:assert/strict';
import {ShotClock} from '../experience/timing.mjs';
const c=new ShotClock();c.reset(0,true);
assert.equal(c.seconds(1000),1);
c.setRate(.5,1000);assert.equal(c.seconds(3000),2,'half speed after 1 s: 1 + 2 × 0.5');
c.setRate(.25,3000);assert.equal(c.seconds(7000),3);
c.setRate(1,7000);assert.equal(c.seconds(8000),4);
c.setRate(0,8000);assert.equal(c.rate,1,'a bad rate is normal speed');
c.setRunning(false,9000);assert.equal(c.seconds(20000),5,'paused');
console.log('timing-rate-test: ok');
