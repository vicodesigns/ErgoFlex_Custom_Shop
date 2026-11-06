import assert from 'node:assert/strict';
import {groupRange,snapGroupDelta,shiftGroup} from '../experience/timeline-group.mjs';
import {filmLink,cleanFilmChapters,filmChapterLabel,filmChapterIndex,loadFilmChapters,loadFilmShot,liveFilmShot} from '../experience/film-chapters.mjs';
const view={position:[1,1,1],target:[0,0,0],fov:35,aspect:16/9};
const base={seconds:10,keys:[{id:'a',time:0,easing:'hold',view},{id:'b',time:.5,easing:'smooth',view},{id:'c',time:1,easing:'linear',view}],
  clips:[{id:'l1',lane:'lift',kind:'lift',start:1,duration:2,target:40},{id:'l2',lane:'lift',kind:'lift',start:6,duration:3,target:30},{id:'t1',lane:'tilt',kind:'tilt',start:4,duration:2,target:20}]};
const picks=(keys,clips)=>({keys:new Set(keys),clips:new Set(clips)});
// Range: never before 0, never past the 90 s chapter limit.
assert.deepEqual(groupRange(base,picks(['b'],['l2'])),[-5,81]);
assert.deepEqual(groupRange(base,picks([],[])),[0,0]);
assert.equal(snapGroupDelta(1.26,.1),1.3);assert.equal(snapGroupDelta(1.26,0),1.26);assert.equal(snapGroupDelta(1.26,.5,true),1.26);
// Same delta for keys and clips; durations, easings and unpicked items keep their seconds.
let next=shiftGroup(base,picks(['b'],['t1']),1.5);
assert.equal(next.seconds,10);assert.equal(next.keys.find(k=>k.id==='b').time,.65);assert.equal(next.clips.find(c=>c.id==='t1').start,5.5);
assert.equal(next.clips.find(c=>c.id==='t1').duration,2);assert.equal(next.keys.find(k=>k.id==='b').easing,'smooth');assert.equal(next.clips.find(c=>c.id==='l1').start,1);
// Past the end: the chapter grows to fit, unpicked keys keep their absolute time, the last key stays at or before the end.
next=shiftGroup(base,picks(['b','c'],['l2']),2);
assert.equal(next.seconds,12);assert.equal(next.keys.at(-1).id,'c');assert.equal(next.keys.at(-1).time,1);
assert.ok(Math.abs(next.keys.find(k=>k.id==='b').time*12-7)<1e-9);assert.equal(next.keys[0].time,0);assert.equal(next.clips.find(c=>c.id==='l2').start,8);
// Clamped at 0, and keys re-sorted after crossing.
next=shiftGroup(base,picks(['b'],['l1']),-9);assert.equal(next.delta,-1);assert.equal(next.clips.find(c=>c.id==='l1').start,0);assert.equal(next.keys.find(k=>k.id==='b').time,.4);
next=shiftGroup({...base,keys:[...base.keys.slice(0,2),{id:'d',time:.7,view},base.keys[2]]},picks(['b'],[]),3);assert.deepEqual(next.keys.map(k=>k.id),['a','d','b','c']);
// Collisions are refused: overlapping clips on one lane, or two keys at one time.
assert.throws(()=>shiftGroup(base,picks([],['l1']),4),/overlap/);
assert.throws(()=>shiftGroup(base,picks(['b'],[]),5),/same time/);
// Film chapter links and the chapter list.
assert.equal(filmLink('#cut=abc'),null);
assert.deepEqual(filmLink('#cut=abc&film=%2Fexports%2Fx%2Fdirector-chapters.json&director=1'),{film:'/exports/x/director-chapters.json',director:true});
const list=cleanFilmChapters({chapters:[{n:1,id:'awaken',title:'Level up your every day.',seconds:44.85,page:'/exports/x/director-ch01.html'},{n:2,id:'rise',seconds:9,page:'director-ch02-rise.html'},{n:3,id:'evil',seconds:1,page:'https://elsewhere.example/x.html'}]},'http://127.0.0.1:3000/exports/x/director-chapters.json');
assert.equal(list.length,2);assert.equal(list[1].url,'http://127.0.0.1:3000/exports/x/director-ch02-rise.html');
assert.equal(filmChapterLabel(list[0]),'1 · awaken (44.85 s)');assert.equal(filmChapterIndex(list,['rise']),1);assert.equal(filmChapterIndex(list,['nope']),-1);
assert.throws(()=>cleanFilmChapters({chapters:[]},'http://127.0.0.1/'));
await assert.rejects(loadFilmChapters('https://elsewhere.example/c.json','http://127.0.0.1:3000/experience/'),/this server/);
const loaded=await loadFilmChapters('/f/c.json','http://127.0.0.1:3000/experience/',async url=>({ok:true,json:async()=>({chapters:[{n:1,id:'awaken',seconds:4,page:'/p.html'}],url})}));
assert.equal(loaded[0].url,'http://127.0.0.1:3000/p.html');
// Film shots: the chapter's full built shot dresses the live stage; quality passes stay off live.
const withShot=cleanFilmChapters({chapters:[{n:1,id:'rise',page:'/p.html',shot:'director-film/rise.json'},{n:2,id:'x',page:'/q.html',shot:'https://elsewhere.example/x.json'}]},'http://127.0.0.1:3000/exports/x/director-chapters.json');
assert.equal(withShot[0].shot,'http://127.0.0.1:3000/exports/x/director-film/rise.json');assert.equal(withShot[1].shot,null);
const filmShot={id:'rise',seconds:16,sceneEdits:[{match:'^Prop:painted-mug$',hide:true}],quality:{bloom:false},motion:{clips:[1]}};
assert.equal((await loadFilmShot('/s.json','rise',async()=>({ok:true,json:async()=>filmShot}))).sceneEdits.length,1);
assert.equal((await loadFilmShot('/c.json','rise',async()=>({ok:true,json:async()=>({shots:[{id:'a'},filmShot]})}))).id,'rise');
await assert.rejects(loadFilmShot('/s.json','awaken',async()=>({ok:true,json:async()=>filmShot})),/does not match/);
const live=liveFilmShot(filmShot,{id:'rise',seconds:18,motion:{clips:[2]}});
assert.equal(live.seconds,18);assert.deepEqual(live.motion,{clips:[2]});assert.equal(live.quality,undefined);assert.equal(live.sceneEdits,filmShot.sceneEdits);assert.ok(filmShot.quality);
console.log('Timeline groups: shared delta for camera keys and desk clips, 0 / 90 s clamps, chapter growth with keys kept at or before the end, re-sorting and collision refusal; film chapter links, list cleaning and labels verified.');
