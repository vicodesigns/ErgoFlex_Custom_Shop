// Camera transitions between camera keys (20 Nov 2026, Vico: cut, dissolve, dip to black / white, length dragged).
//   1. camera-transitions.mjs: clean, room, set (clamped, the first key refused, film: explicit null), plan fields both ways,
//      what the preview shows at a time (dip opacity, dissolve mix and which still frame), bands, drag length
//   2. camera-track.mjs: cleanCut keeps the field; a client cut holds then switches at a key with a transition
//   3. film-render.mjs filmCamera: the key's own transition decides (null removes a plan cut); without the field the plan's
//      cut by id as before; a dissolve bakes as the cut
//   4. film-changes.mjs: a transition set or removed counts as a camera change; the plan's own does not
//   5. director.mjs wiring (source): keys show the plan's cuts, the inspector row, the lane bands, the preview hook
//   node tests/camera-transitions-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRANSITION_TYPES,DEFAULT_DUR,MIN_DUR,MAX_DUR,segmentInfo,segmentType,WHIP,M_PER_UNIT,cleanTransition,transitionRoom,setTransition,planFields,fromPlan,transitionAt,transitionBands,dragLength} from '../experience/camera-transitions.mjs';
import {cleanCameraKeys,sampleCamera} from '../experience/camera-track.mjs';
import {filmCamera} from '../experience/film-render.mjs';
import {cameraChanged} from '../experience/film-changes.mjs';

const view=x=>({position:[x,1,5],target:[x,1,0],fov:35,aspect:16/9});
const K=(id,time,extra={})=>({id,time,label:id,easing:'linear',view:view(time*10),...extra});
const S=20;   // chapter seconds
// ---- 1
assert.deepEqual(TRANSITION_TYPES,['cut','dissolve','dip-black','dip-white']);
assert.equal(cleanTransition(null),null);assert.equal(cleanTransition({type:'wipe'}),null);
assert.deepEqual(cleanTransition({type:'cut',dur:2}),{type:'cut'});
assert.deepEqual(cleanTransition({type:'dissolve'}),{type:'dissolve',dur:DEFAULT_DUR});
assert.deepEqual(cleanTransition({type:'dip-black',dur:99}),{type:'dip-black',dur:MAX_DUR});
assert.deepEqual(cleanTransition({type:'dip-white',dur:0}),{type:'dip-white',dur:Math.round(MIN_DUR*1000)/1000});
{
  const keys=[K('a',0),K('b',.25),K('c',.5),K('d',.55)];   // 0 s, 5 s, 10 s, 11 s
  assert.equal(transitionRoom(keys,0,S),0,'the first key has no room');
  assert.equal(transitionRoom(keys,1,S),3,'5 s between keys: the most there is (3 s)');
  assert.ok(Math.abs(transitionRoom(keys,2,S)-2)<1e-9,'10 s with a key 1 s after: 2 s (centred)');
  const one=setTransition(keys,'c',{type:'dissolve',dur:2.5},S);
  assert.ok(Math.abs(one[2].transition.dur-2)<1e-9,'the length clamped to the room');
  assert.throws(()=>setTransition(one,'d',{type:'dip-black',dur:1},S),/No room/,'the dissolve before reaches key d: no room for another band');
  const wide=setTransition([K('a',0),K('b',.25),K('c',.5),K('d',.65)],'c',{type:'dissolve',dur:2},S),two=setTransition(wide,'d',{type:'dip-black',dur:5},S);
  assert.ok(Math.abs(two[3].transition.dur-3)<1e-9,'13 s, the band before ends at 11 s: 2 x 2 s, capped at 3 s');
  assert.ok(two[3].time*S-two[3].transition.dur/2>=two[2].time*S+two[2].transition.dur/2-1e-9,'no overlap');
  assert.throws(()=>setTransition(keys,'a',{type:'cut'},S),/first camera view/);
  assert.equal(setTransition(keys,'a',{type:'move'},S)[0].transition,null,'move on the first key: fine (none)');
  assert.deepEqual(setTransition(keys,'b',{type:'cut'},S)[1].transition,{type:'cut'});
  assert.equal(setTransition(one,'c',{type:'move'},S)[2].transition,null,'film: explicitly none');
  assert.ok(!('transition' in setTransition(one,'c',{type:'move'},S,{explicit:false})[2]),'client cut: the field dropped');
  const tight=[K('a',0),K('b',.5),K('c',.501)];
  assert.throws(()=>setTransition(tight,'c',{type:'dissolve',dur:1},S),/No room/);
  assert.deepEqual(setTransition(tight,'c',{type:'cut'},S)[2].transition,{type:'cut'},'a cut needs no room');
  // plan fields both ways
  assert.deepEqual(planFields(null),{});assert.deepEqual(planFields({type:'cut'}),{cut:true});
  assert.deepEqual(planFields({type:'dissolve',dur:.8}),{cut:true,transition:{type:'dissolve',dur:.8}});
  assert.equal(fromPlan({at:3}),null);assert.deepEqual(fromPlan({cut:true}),{type:'cut'});
  assert.deepEqual(fromPlan({cut:true,transition:{type:'dip-white',dur:1.2}}),{type:'dip-white',dur:1.2});
  for(const t of [null,{type:'cut'},{type:'dissolve',dur:.8},{type:'dip-black',dur:1}])assert.deepEqual(fromPlan(planFields(t))??null,t,'round trip '+JSON.stringify(t));
  // the preview at a time: dissolve at 10 s, 2 s long (9..11)
  assert.equal(transitionAt(one,8.9,S),null);
  const a=transitionAt(one,9.5,S);assert.equal(a.type,'dissolve');assert.equal(a.other,'in');assert.ok(Math.abs(a.mix-.25)<1e-9,'before the key: the incoming still over the live (held) outgoing view');
  const b=transitionAt(one,10.5,S);assert.equal(b.other,'out');assert.ok(Math.abs(b.mix-.25)<1e-9,'after: the outgoing still over the live incoming view');
  assert.equal(transitionAt(one,10,S).p,.5);
  const dip=setTransition(keys,'c',{type:'dip-white',dur:2},S);
  assert.ok(Math.abs(transitionAt(dip,10,S).dip-1)<1e-9,'a dip is full at the key');assert.ok(Math.abs(transitionAt(dip,9.5,S).dip-.5)<1e-9);assert.equal(transitionAt(dip,9,S).dip,0);
  assert.equal(transitionAt(setTransition(keys,'c',{type:'cut'},S),10,S),null,'a cut has nothing to mix');
  assert.deepEqual(transitionBands(one,S),[{id:'c',type:'dissolve',dur:2,start:9,end:11}]);
  assert.equal(dragLength(one,'c',10.4,S),.8,'an edge at 10.4 s: 0.8 s');assert.equal(dragLength(one,'c',14,S),2,'clamped to the room');
  assert.equal(dragLength(one,'c',10,S),Math.round(MIN_DUR*1000)/1000,'never under two frames');
}
// ---- 2
{
  const cleaned=cleanCameraKeys([K('a',0,{transition:null}),K('b',.5,{transition:{type:'dissolve',dur:1}}),K('c',1)]);
  assert.equal(cleaned[0].transition,null);assert.deepEqual(cleaned[1].transition,{type:'dissolve',dur:1});assert.ok(!('transition' in cleaned[2]),'absent stays absent');
  assert.deepEqual(cleanCameraKeys([K('a',0,{transition:{type:'wipe'}})])[0].transition,null,'junk: none');
  const keys=cleanCameraKeys([K('a',0),K('b',.5,{transition:{type:'cut'}}),K('c',1)]);
  assert.deepEqual(sampleCamera(keys,.25).position,view(0).position,'before a cut: the view held');
  assert.deepEqual(sampleCamera(keys,.5).position,view(5).position,'at the key: the new view');
  const moving=cleanCameraKeys([K('a',0),K('b',.5),K('c',1)]);assert.notDeepEqual(sampleCamera(moving,.25).position,view(0).position,'without one: the move as before');
}
// ---- 3
{
  const plan={keys:[{at:0,position:[0,1,5],target:[0,1,0],fov:35},{at:10,position:[5,1,5],target:[5,1,0],fov:35,cut:true},{at:20,position:[9,1,5],target:[9,1,0],fov:35}]};
  const film={seconds:20,cameraPlan:plan};
  const dk=(i,extra)=>({id:'plan-0'+i,time:plan.keys[i].at/20,label:'',easing:'linear',view:{...view(0),position:plan.keys[i].position,target:plan.keys[i].target},...extra});
  const legacy=filmCamera(film,[dk(0),dk(1),dk(2)],20).cameraPlan.keys;assert.equal(legacy[1].cut,true,'no field: the plan cut by id, as before');
  const removed=filmCamera(film,[dk(0,{transition:null}),dk(1,{transition:null}),dk(2,{transition:null})],20).cameraPlan.keys;assert.ok(!removed[1].cut,'null: the plan cut removed');
  const dissolve=filmCamera(film,[dk(0,{transition:null}),dk(1,{transition:{type:'cut'}}),dk(2,{transition:{type:'dissolve',dur:.8}})],20);
  assert.deepEqual([dissolve.cameraPlan.keys[2].cut,dissolve.cameraPlan.keys[2].transition],[true,{type:'dissolve',dur:.8}]);
  const asCut=filmCamera(film,[dk(0,{transition:null}),dk(1,{transition:{type:'cut'}}),dk(2,{transition:{type:'cut'}})],20);
  assert.deepEqual(dissolve.camera.keys.map(k=>[k.time,k.view.position]),asCut.camera.keys.map(k=>[k.time,k.view.position]),'a dissolve bakes exactly as the cut (the render composites it)');
}
// ---- 4
{
  const film={seconds:20,cameraPlan:{keys:[{at:0,position:[0,1,5],target:[0,1,0],fov:35},{at:10,position:[5,1,5],target:[5,1,0],fov:35,cut:true}]},camera:{keys:[]}};
  const mk=t=>({seconds:20,camera:{keys:[{id:'plan-00',time:0,easing:'smooth',transition:null,view:{position:[0,1,5],target:[0,1,0],fov:35}},{id:'plan-01',time:.5,easing:'smooth',transition:t,view:{position:[5,1,5],target:[5,1,0],fov:35}}]}});
  assert.equal(cameraChanged(mk({type:'cut'}),film),false,'the plan\'s own cut: unchanged');
  assert.equal(cameraChanged(mk(null),film),true,'the cut removed: changed');
  assert.equal(cameraChanged(mk({type:'dip-black',dur:1}),film),true,'a dip: changed');
}
// ---- 5
{
  const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8');
  assert.match(src,/const keys=\(\)=>withPlanTransitions\(resolveCameraKeys\(/,'keys show the plan\'s cuts by id');
  assert.match(src,/transition:i\?fromPlan\(k\):null,view:/,'filmCameraKeys: each key\'s transition from the plan');
  assert.match(src,/\$\{transitionFields\(cameraKey\)\}/,'the inspector rows');
  assert.doesNotMatch(src,/<label>Move to next view<select name="key-easing">/,'no separate "Move to next view" beside the transition (20 Nov 2026: the two disagreed)');
  assert.match(src,/segmentRow\(list,i-1,'Into this view','key-transition'\)/,'"Into this view": the segment before');
  assert.match(src,/segmentRow\(list,i,'To the next view','key-transition-next'\)/,'"To the next view": the same control for the segment after (it edits the next key)');
  assert.match(src,/Film chapter: between views the camera glides on the film\\'s spline, so Move style and Camera route do not apply here/,'film chapters: Move style and route hidden, with the reason');
  assert.match(src,/if\(filmShot\(\)\)throw Error\('Film chapter: the camera glides on the film/,'and F9 / T say so instead of changing a dead setting');
  assert.match(src,/\$\{segmentsHtml\(\)\}/,'every lane segment labelled');
  assert.match(src,/\$\{transitionLane\(\)\}/,'the bands on the camera lane');
  assert.match(src,/function syncPlayhead\(\)\{\n    syncTransitionPreview\(\);/,'the preview follows the playhead');
  assert.match(src,/its motion is frozen here; the film renders both moving/,'the dissolve preview says it is a still frame');
  assert.match(src,/renders this as a plain cut until the render side for dissolves and dips lands/,'and that the film renders a cut for now');
  assert.match(src,/putTransition\(band\.dataset\.camTransition,\{type:'move'\}\)/,'Delete on a band: back to a move');
}
// ---- 6 segments: one type per segment, labels, warnings (Vico's Create numbers: 19.2 s -> 19.5 s, 2.36 units in 0.3 s;
// 19.5 s -> 19.533 s, a cut to the same view)
{
  const v=(p,t)=>({position:p,target:t,fov:35,aspect:16/9}),T=23.5;
  const keys=[{id:'a',time:19.2/T,easing:'linear',view:v([3.15,2.05,.35],[1,1,0])},{id:'b',time:19.5/T,easing:'linear',view:v([1.09,2.29,-.78],[0,1,-2])},
    {id:'c',time:19.533/T,easing:'hold',transition:{type:'cut'},view:v([1.09,2.29,-.78],[0,1,-2])},{id:'d',time:22/T,easing:'linear',view:v([0,2,0],[0,1,-3])}];
  const s0=segmentInfo(keys,0,T),s1=segmentInfo(keys,1,T);
  assert.equal(s0.type,'move');assert.equal(s0.label,'Move 0.3 s');assert.ok(s0.whip,'2.36 units (1.4 m) in 0.3 s: a whip');
  assert.match(s0.warn,/A 0\.3 s move over 1\.4 m.*reads as a whip/);
  assert.equal(s1.type,'cut');assert.equal(s1.label,'Cut');assert.ok(s1.same);assert.match(s1.warn,/This cut jumps to the same view/);
  assert.equal(segmentType(keys,2),'move','film: the key\'s "hold" easing does not count');assert.equal(segmentType(keys,2,{film:false}),'cut','a client cut: the old Hold, then cut is the same cut');
  const calm=[{id:'a',time:0,view:v([0,2,5],[0,1,0])},{id:'b',time:.5,view:v([1,2,5],[1,1,0])}];
  assert.equal(segmentInfo(calm,0,20).warn,null,'1 unit in 10 s: no warning');assert.equal(segmentInfo(calm,0,20).label,'Move 10 s');
  const dz=[...calm.slice(0,1),{...calm[1],transition:{type:'dissolve',dur:.8}}];assert.equal(segmentInfo(dz,0,20).label,'Dissolve 0.8 s');
  assert.equal(segmentInfo(calm,1,20),null);
  assert.deepEqual(WHIP,{speed:3,turn:60});assert.ok(Math.abs(M_PER_UNIT-.5984)<1e-3);
}
console.log('camera-transitions-test: ok (segments: one type, labels, same-view and whip warnings; cut / dissolve / dip model, room and clamps, plan fields both ways, preview mix, client-cut hold, filmCamera authoritative, change detection, Director wiring)');
