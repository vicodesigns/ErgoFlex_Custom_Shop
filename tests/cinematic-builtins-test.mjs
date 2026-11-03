import assert from 'node:assert/strict';
import {sampledMotionToClips,sampleClipMotion,clipDistance,putClip,legacyMotionToClips,findClipInsertion} from '../experience/desk-clips.mjs';
import {createDeskEditor} from '../experience/desk-editor.mjs';
import {makeCut,encodeCut,decodeCut} from '../experience/cuts.mjs';
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const tracks={lift:[],tilt:[],wheels:[]};
function pose(t){return {height:28+15.5*ease((t-.25)/.45),tilt:65*ease(t),x:0,z:12*Math.sin(t*Math.PI),yaw:(ease(t)-.5)*.16*180/Math.PI};}
for(let i=0;i<=128;i++){const time=i/128,p=pose(time);for(const [lane,fields] of Object.entries({lift:['height'],tilt:['tilt'],wheels:['x','z','yaw']}))tracks[lane].push({id:lane+i,time,easing:'linear',pose:Object.fromEntries(fields.map(f=>[f,p[f]]))});}
const movement=sampledMotionToClips(tracks,8),wheels=movement.clips.filter(c=>c.lane==='wheels'),[wheel,backward]=wheels;
assert.equal(movement.clips.length,4);assert.equal(wheels.length,2);
assert.equal(wheel.label,'Move forward');assert.equal(wheel.start,0);assert.equal(wheel.duration,4);assert.equal(wheel.path.length,65);
assert.equal(backward.label,'Move backward');assert.equal(backward.start,4);assert.equal(backward.duration,4);
assert.ok(Math.abs(wheels.reduce((n,c)=>n+clipDistance(movement,c),0)-24)<.001,'both travel directions must measure their own distance');
for(let i=0;i<=400;i++){
  const time=i/400,expected=pose(time),actual=sampleClipMotion(movement,time*8);
  for(const f of ['height','tilt','x','z','yaw'])assert.ok(Math.abs(expected[f]-actual[f])<.01,f+' path changed at '+time);
}
const moved=putClip(movement,{...wheel,start:2,duration:2},8);
assert.ok(Math.abs(sampleClipMotion(moved,4).z-12)<.001);assert.ok(Math.abs(sampleClipMotion(moved,8).z)<.001);
assert.throws(()=>putClip(movement,{...wheel,duration:5},8),/cannot overlap/);
const edited=putClip(movement,{...backward,target:{...backward.target,z:6}},8);
assert.equal(sampleClipMotion(edited,8).z,6);assert.equal(sampleClipMotion(edited,4).z,12,'editing backward must not change forward');
assert.equal(findClipInsertion(movement.clips,'wheels',0,8),null);
const shortened=putClip(movement,{...wheel,duration:3},8),gap=findClipInsertion(shortened.clips,'wheels',3,8);
assert.deepEqual(gap,{start:3,duration:1});
assert.equal(putClip(shortened,{id:'extra',lane:'wheels',kind:'rotate',...gap,value:90},8).clips.filter(c=>c.lane==='wheels').length,3);
const combined={version:2,initial:pose(0),clips:[{id:'builtin-wheels',lane:'wheels',kind:'pose',start:0,duration:8,target:pose(1),label:'Original wheel movement',path:tracks.wheels}]};
const migrated=legacyMotionToClips(combined,8);assert.equal(migrated.clips.length,2);
for(let i=0;i<=100;i++){const t=i/100;assert.ok(Math.abs(sampleClipMotion(combined,t*8).z-sampleClipMotion(migrated,t*8).z)<.001);assert.ok(Math.abs(sampleClipMotion(combined,t*8).yaw-sampleClipMotion(migrated,t*8).yaw)<.001);}
const cut=makeCut('Built-in performance',[{room:'product',seconds:8,motion:movement}]);assert.deepEqual(decodeCut(encodeCut(cut)),cut);
assert.equal(sampledMotionToClips({wheels:[{time:0,pose:{x:0,z:0,yaw:0}},{time:1,pose:{x:0,z:0,yaw:0}}]},8).clips.length,0);
// Exercise editor initialization without a browser: built-in blocks are visible
// without rewriting a cut, and an explicitly empty new chapter remains empty.
const oldDocument=globalThis.document,oldListener=globalThis.addEventListener;
globalThis.document={addEventListener(){}};globalThis.addEventListener=()=>{};
try{
  const root={addEventListener(){},querySelectorAll(){return[];},querySelector(){return null;}};
  let current={id:'original',room:'product',kind:'glide',seconds:8},captures=0;
  const bridge={stage:()=>({motionDefaults(){captures++;return tracks;},capturePose:()=>pose(0)})};
  const editor=createDeskEditor({panel:root,timeline:root,bridge,shot:()=>current,time:()=>0});
  editor.ready();assert.match(editor.timeline(),/Desk movements · 4 clips/);assert.match(editor.panel(),/Original chapter movements/);assert.equal(current.motion,undefined,'opening must not overwrite the saved cut');
  current.seconds=12;assert.match(editor.timeline(),/0–6s · 6s/,'automatic blocks should follow chapter duration');assert.match(editor.timeline(),/6–12s · 6s/);
  current={id:'new',seconds:8,motion:{version:2,initial:pose(0),clips:[]}};editor.ready();assert.match(editor.timeline(),/Desk movements · 0 clips/);assert.equal(captures,1,'empty custom chapters must not inherit built-in movement');
}finally{globalThis.document=oldDocument;globalThis.addEventListener=oldListener;}
console.log('Built-in Groove: separate forward/backward blocks at the turnaround, preserved travel/turn curves and delayed lift, independent edits, old combined-card migration, overlap rejection, adding into short gaps, speed, chapter duration, save/link round trips, no automatic save mutation, and empty new chapters verified.');
