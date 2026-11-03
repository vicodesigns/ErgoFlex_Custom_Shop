import assert from 'node:assert/strict';
import {showcaseShots,showcaseViews,SHOWCASE_PLAN} from '../experience/showcase.mjs';
import {cleanCut,makeCut} from '../experience/cuts.mjs';
import {validateClipSchedule,sampleClipMotion} from '../experience/desk-clips.mjs';
const shots=cleanCut(makeCut('Showcase',showcaseShots())).shots;
assert.equal(shots.length,12);
assert.equal(shots.reduce((n,s)=>n+s.seconds,0),218);
for(const [i,s] of shots.entries()){
  assert.equal(s.id,SHOWCASE_PLAN[i][0]);
  assert.ok(s.seconds>=12);
  if(s.motion){validateClipSchedule(s.motion.clips,s.seconds);assert.ok(s.motion.clips.every(c=>c.start+c.duration<=s.seconds-1));}
  const views=showcaseViews(s.kind);assert.equal(views[0].time,0);assert.equal(views.at(-1).time,1);
  assert.equal(views.at(-1).distance,views.at(-2).distance);
  assert.equal(views.at(-1).angle,views.at(-2).angle);
}
assert.equal(sampleClipMotion(shots[1].motion,20).height,52.5);
assert.equal(sampleClipMotion(shots[2].motion,10).tilt,25);
assert.equal(sampleClipMotion(shots[2].motion,24).tilt,65);
assert.equal(sampleClipMotion(shots[6].motion,20).height,43.5);
console.log('Showcase: 12 chapters, 218 seconds, valid independent movements, full lift, drafting/easel holds and camera landing holds.');
