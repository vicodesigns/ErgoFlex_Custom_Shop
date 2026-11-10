import assert from 'node:assert/strict';
import {planClipInsertion,cleanClip,cleanClipMotion,putClip,sampleClipMotion,clipDistance,clipSpeedPresets,clipSpeedSetting,retimeClipBySpeed,legacyMotionToClips,findClipSpace,duplicateClip,validateClipSchedule,clipEnd} from '../experience/desk-clips.mjs';
import {tracksFromPoses,cleanPose,sampleDeskTracks} from '../experience/desk-track.mjs';
import {makeCut,encodeCut,decodeCut,CutLibrary,cleanShot} from '../experience/cuts.mjs';
import {bakeKey} from '../experience/bake.mjs';
const empty={version:2,initial:cleanPose({height:28}),clips:[]};
const turn=cleanClip({id:'turn',lane:'wheels',kind:'rotate',start:2,duration:4,value:360,direction:'right'});
const lift=cleanClip({id:'lift',lane:'lift',kind:'lift',start:1,duration:3,target:52.5});
const tilt=cleanClip({id:'tilt',lane:'tilt',kind:'tilt',start:2,duration:2,target:35});
let m=putClip(putClip(putClip(empty,turn,10),lift,10),tilt,10);
assert.equal(sampleClipMotion(m,0).yaw,0);assert.equal(sampleClipMotion(m,3).yaw,90);assert.equal(sampleClipMotion(m,6).yaw,360);assert.equal(sampleClipMotion(m,9).yaw,360);
assert.equal(sampleClipMotion(m,4).height,52.5);assert.equal(sampleClipMotion(m,4).tilt,35);assert.equal(sampleClipMotion(m,2.5).height,40.25);
assert.throws(()=>putClip(m,{...lift,id:'overlap',start:2},10),/cannot overlap/);
assert.throws(()=>putClip(m,{...turn,id:'hold',kind:'hold',start:4},10),/cannot overlap/,'a hold owns the wheels lane');
assert.throws(()=>putClip(m,{...turn,start:8},10),/fit inside/);
assert.throws(()=>validateClipSchedule(m.clips,5),/fit inside/);
assert.equal(clipDistance(m,turn)/turn.duration,90);
// A turn's amount is independent of frame rate, easing, heading and speed.
for(const direction of ['left','right'])for(const value of [90,100,180,360,720])for(const easing of ['linear','smooth']){
 const initial={...empty.initial,yaw:364.6},c={...turn,start:0,value,direction,easing},motion={initial,clips:[c]};
 for(const fps of [24,30,60]){
  let previous=initial.yaw,total=0;
  for(let frame=0;frame<=c.duration*fps;frame++){const yaw=sampleClipMotion(motion,frame/fps).yaw;total+=Math.abs(yaw-previous);previous=yaw;}
  assert.ok(Math.abs(total-value)<1e-8,`${value} degrees must rotate exactly once through its requested arc`);
 }
 assert.equal(sampleClipMotion(motion,8).yaw,initial.yaw+(direction==='left'?-value:value));
 assert.equal(sampleClipMotion(motion,0).yaw,initial.yaw,'restart returns to initial heading');
 assert.equal(sampleClipMotion(motion,8).yaw,sampleClipMotion(motion,8).yaw,'repeated sampling cannot accumulate turns');
}
assert.deepEqual(clipSpeedPresets(turn),{slow:45,medium:90,fast:180});
assert.equal(clipSpeedSetting(m,turn),'medium');
for(const [setting,speed] of Object.entries(clipSpeedPresets(turn))){
 const c=retimeClipBySpeed(m,turn,speed,12),motion=putClip(m,c,12);
 assert.equal(c.value,360);assert.equal(c.duration,360/speed);assert.equal(clipSpeedSetting(motion,c),setting);
 assert.equal(sampleClipMotion(motion,c.start+c.duration).yaw,360,'changing speed cannot add rotations');
}
assert.throws(()=>retimeClipBySpeed(m,turn,45,8),/needs 8s.*only 6s/);
assert.throws(()=>retimeClipBySpeed(sequenceForSpeed(),{...turn,start:0},45,12),/only 5s/);
function sequenceForSpeed(){return {...empty,clips:[{...turn,start:0},{...turn,id:'next',kind:'hold',start:5}]};}
const faster=putClip(m,{...turn,duration:2},10);assert.equal(sampleClipMotion(faster,3).yaw,180);assert.equal(sampleClipMotion(faster,4).yaw,360);
const moved=putClip(m,{...turn,start:6},10);assert.equal(sampleClipMotion(moved,3).yaw,0);assert.equal(sampleClipMotion(moved,8).yaw,180);
assert.equal(findClipSpace([turn],'wheels',2,3,10),6);assert.equal(findClipSpace([turn],'wheels',3,8,10),6);assert.equal(findClipSpace([turn],'wheels',5,0,10),null);
const duplicated=duplicateClip(m,'turn',10);assert.equal(duplicated.clips.filter(c=>c.lane==='wheels').length,2);assert.ok(duplicated.clips.some(c=>c.id!=='turn'&&c.lane==='wheels'&&c.start===6));
const sequence=putClip(putClip(empty,{...turn,start:0,duration:2},10),{...turn,id:'left',start:4,duration:2,value:720,direction:'left'},10);
assert.equal(sampleClipMotion(sequence,3).yaw,360);assert.equal(sampleClipMotion(sequence,5).yaw,0);assert.equal(sampleClipMotion(sequence,6).yaw,-360);
const travel=putClip(sequence,{id:'travel',lane:'wheels',kind:'travel',start:6,duration:2,value:24,direction:'forward'},10);assert.ok(Math.abs(sampleClipMotion(travel,8).z-24)<1e-8);
const tracks=tracksFromPoses(empty.initial,{...empty.initial,height:52.5,yaw:360});const legacy=legacyMotionToClips({tracks},10);assert.equal(legacy.clips.length,2);
for(const t of [0,.15,.3,.5,.8,1]){const old=sampleDeskTracks(tracks,t),next=sampleClipMotion(legacy,t*10);for(const f of ['height','tilt','yaw','x','z'])assert.ok(Math.abs(old[f]-next[f])<1e-8);}
const cut=makeCut('Movement blocks',[{room:'product',seconds:10,motion:m},{room:'product',seconds:10,motion:empty}]);assert.deepEqual(decodeCut(encodeCut(cut)),cut);
const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};new CutLibrary(storage).save(cut);assert.deepEqual(new CutLibrary(storage).current().shots[0].motion,m);assert.equal(new CutLibrary(storage).current().shots[1].motion.clips.length,0);
assert.throws(()=>cleanShot({...cut.shots[0],seconds:4}),/fit inside/);
assert.equal(cleanShot({...cut.shots[0],seconds:20}).motion.clips.find(c=>c.id==='turn').start,2);
assert.notEqual(await bakeKey(cut.shots[0]),await bakeKey({...cut.shots[0],motion:faster}));
assert.equal(clipEnd(turn),6);assert.equal(cleanClipMotion(empty,10).clips.length,0);

// Concurrent wheels moves: a turn and a glide (or two glides) play together; lift / tilt of one lane never do.
{
 const tr=cleanClip({id:'glide',lane:'wheels',kind:'travel',start:1,duration:4,value:12,direction:'forward'});
 const both=putClip(putClip(empty,turn,10),tr,10);
 assert.equal(both.clips.length,2,'a glide over a turn is allowed');
 // yaw 0 at 1 s when the glide starts, so the glide runs along +z (heading 0) however the turn goes on
 const p3=sampleClipMotion(both,3);assert.equal(p3.yaw,90);assert.ok(Math.abs(p3.z-6)<1e-8);
 const p6=sampleClipMotion(both,6);assert.equal(p6.yaw,360);assert.ok(Math.abs(p6.z-12)<1e-8);assert.ok(Math.abs(p6.x)<1e-8);
 // the order they were put in does not matter
 const flipped=putClip(putClip(empty,tr,10),turn,10);for(const t of [0,1.5,3,4.9,6,9])for(const f of ['x','z','yaw'])assert.ok(Math.abs(sampleClipMotion(both,t)[f]-sampleClipMotion(flipped,t)[f])<1e-9);
 // two glides at once add up (forward 12 and right 6 = a diagonal)
 const diag=putClip(both,{id:'side',lane:'wheels',kind:'travel',start:1,duration:4,value:6,direction:'right'},10);
 const pd=sampleClipMotion(diag,5);assert.ok(Math.abs(pd.z-12)<1e-8&&Math.abs(pd.x-6)<1e-8,'forward and right glides sum');
 // other lanes unaffected, lift cannot overlap lift, a path clip / hold cannot share the lane
 assert.equal(sampleClipMotion(putClip(both,lift,10),4).height,52.5);
 assert.throws(()=>putClip(both,{...tr,id:'path',kind:'pose',target:{x:0,z:1,yaw:0},start:2},10),/cannot overlap/);
 // a lane without overlap samples exactly as before (turn then glide in sequence)
 assert.ok(Math.abs(sampleClipMotion(travel,8).z-24)<1e-8);
 // inserting: a turn at the playhead inside a glide stays at the playhead (no jump to a gap); inside a lift it still moves
 assert.deepEqual(planClipInsertion(both.clips,'wheels',2,10,3,90,'rotate'),{start:2,duration:3,seconds:10});
 assert.notEqual(planClipInsertion([{lane:'lift',start:0,duration:6}],'lift',2,10,3,90,'lift').start,2);
 // speed: a turn's room is not cut short by an overlapping glide
 assert.equal(retimeClipBySpeed(putClip(empty,{...tr,start:5,duration:3},10),{...turn,start:2},45,10).duration,8);
 // survives the cut round trip
 const kept=cleanShot({room:'product',seconds:10,id:'x',motion:both});assert.equal(kept.motion.clips.length,2);
}
console.log('Movement clips: simultaneous lanes, full/reverse turns, gaps/holds, independent timing, speed/duration changes, moving/duplicating blocks, collision and chapter bounds, legacy migration, blank chapters, save/link round trips and bake invalidation verified.');
