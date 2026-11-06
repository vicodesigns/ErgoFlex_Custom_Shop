import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanLighting,exportLighting,neutralAt,lightAt,scaleColor,warmthOf,withWarmth,brightnessOf,validateStatus,WARM} from '../experience/film-lighting.mjs';
import {shiftGroup} from '../experience/timeline-group.mjs';
import {bakeCameraPlan} from '../experience/camera-spline-bake.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
import {cleanShot} from '../experience/cuts.mjs';
const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
// Cleaning keeps the film's fields (ids added for the Director), export drops the ids.
const lit=cleanLighting({ledStatus:[{at:9.25,dur:6.9,kind:'lift-up',fade:1,fadeIn:.6},{at:0,dur:7.45,kind:'off',fade:.3},{at:2,dur:1,kind:'bogus'},{at:25.55,dur:6,kind:'wheels',fade:1,mode:5,reverse:true}],ledNeutral:[[14.2,'#929292'],[0,'#929292'],[15.4,'#52483C']],ledColor:'#242424',sceneGlobals:{roomLight:.55,exposureScale:.9}});
assert.deepEqual(lit.ledStatus.map(e=>e.kind),['off','lift-up','wheels']);assert.ok(lit.ledStatus.every(e=>typeof e.id==='string'));
assert.deepEqual(lit.ledNeutral.map(k=>k[0]),[0,14.2,15.4]);assert.equal(lit.ledNeutral[2][1],'#52483c');assert.deepEqual(lit.sceneGlobals,{roomLight:.55,exposureScale:.9});
const out=exportLighting({id:'rise',...lit});
assert.deepEqual(out.ledStatus[2],{at:25.55,dur:6,kind:'wheels',fade:1,mode:5,reverse:true});assert.deepEqual(out.ledNeutral[2],[15.4,'#52483c']);
assert.deepEqual(Object.keys(cleanShot({id:'x',room:'product'})).includes('ledStatus'),false,'no lighting fields until edited');
assert.equal(cleanShot({id:'x',room:'product',ledStatus:[]}).ledStatus.length,0,'an emptied lane stays edited');
// Neutral white over time (smoothstep between keys) and the strip colour at a time.
assert.equal(neutralAt(lit.ledNeutral,3),'#929292');assert.equal(neutralAt(lit.ledNeutral,20),'#52483c');
const mid=neutralAt(lit.ledNeutral,14.8);assert.ok(mid!=='#929292'&&mid!=='#52483c');
assert.equal(lightAt({status:lit.ledStatus,neutral:lit.ledNeutral},10),'#2f6bff');assert.equal(lightAt({status:lit.ledStatus,neutral:lit.ledNeutral},8),'#929292');
// Brightness in linear light, warmth at the same brightness.
assert.ok(near(brightnessOf(scaleColor('#767676',2)),brightnessOf('#767676')*2,.01));assert.equal(scaleColor('#767676',1),'#767676');
assert.ok(warmthOf('#929292')<.02);assert.ok(warmthOf(WARM)>.98);
const warm=withWarmth('#929292',1);assert.ok(near(brightnessOf(warm),brightnessOf('#929292'),.01));assert.ok(warmthOf(warm)>.95);assert.ok(near(warmthOf(withWarmth('#929292',.4)),.4,.03));
assert.throws(()=>validateStatus([{at:0,dur:3},{at:2,dur:1}],10),/overlap/);assert.throws(()=>validateStatus([{at:9,dur:3}],10),/fit/);
// Group moves carry light states and colour keys with camera keys and clips.
const view={position:[1,1,1],target:[0,0,0],fov:35,aspect:16/9};
const base={seconds:10,keys:[{id:'a',time:0,view},{id:'b',time:1,view}],clips:[],lights:[{id:'s1',at:1,dur:2,kind:'lift-up'},{id:'s2',at:5,dur:2,kind:'lift-down'}],neutrals:[[0,'#929292','n0'],[8,'#52483c','n1']]};
const pick=o=>({keys:new Set(o.keys),clips:new Set(),lights:new Set(o.lights),neutrals:new Set(o.neutrals)});
let next=shiftGroup(base,pick({lights:['s2'],neutrals:['n1']}),3);
assert.equal(next.seconds,11);assert.equal(next.lights[1].at,8);assert.equal(next.lights[1].dur,2);assert.equal(next.neutrals[1][0],11);assert.equal(next.neutrals[1][1],'#52483c');assert.equal(next.keys[1].time*11,10);
assert.throws(()=>shiftGroup(base,pick({lights:['s1']}),3),/overlap/);
assert.throws(()=>shiftGroup(base,pick({neutrals:['n1']}),-8),/same time/);
// The film camera bake: same keys as the CLI produced for the rise fixture.
const rise=JSON.parse(fs.readFileSync(new URL('./fixtures/director-film/director-film/rise.json',import.meta.url)));
const baked=bakeCameraPlan(rise.cameraPlan,rise.seconds);assert.equal(baked.length,rise.camera.keys.length);
let worst=0;for(const [i,k] of baked.entries()){const r=rise.camera.keys[i];worst=Math.max(worst,Math.abs(k.time-r.time),...k.view.position.map((v,j)=>Math.abs(v-r.view.position[j])),...k.view.target.map((v,j)=>Math.abs(v-r.view.target[j])));}
assert.ok(worst<1e-3,'browser bake matches camera-spline.mjs (worst '+worst+')');
// Render shot: film shot + Director story keys / clips / lighting; quality defaults to hq13.
const plan=[...rise.cameraPlan.keys].sort((a,b)=>a.at-b.at),dkeys=plan.map((k,i)=>({id:'plan-'+String(i).padStart(2,'0'),time:k.at/rise.seconds,label:k.label,view:{position:k.position,target:k.target,fov:k.fov}}));
dkeys[3]={...dkeys[3],time:6/rise.seconds};
const directorShot={id:'rise',room:'home',kind:'lift',seconds:16,motion:{version:2,initial:rise.motion.initial,clips:[]},ledStatus:[{id:'q',at:2,dur:1,kind:'off',fade:.5}],ledColor:'#242424',sceneGlobals:{roomLight:.3}};
const job=filmRenderShot(rise,directorShot,dkeys);
assert.equal(job.cameraPlan.keys[3].at,6);assert.equal(job.camera.keys.at(-1).time,1);assert.deepEqual(job.motion.clips,[]);assert.deepEqual(job.ledStatus,[{at:2,dur:1,kind:'off',fade:.5}]);
assert.equal(job.ledNeutral,undefined);assert.equal(job.sceneGlobals.roomLight,.3);assert.equal(job.sceneGlobals.exposureScale,.9);assert.deepEqual(job.sceneEdits,rise.sceneEdits);assert.deepEqual(job.quality,rise.quality);
assert.equal(filmRenderShot({...rise,quality:undefined},{...directorShot,ledStatus:undefined},dkeys).quality,'hq13');
assert.deepEqual(filmRenderShot(rise,{id:'rise',room:'home',kind:'lift',seconds:16},dkeys).ledNeutral,rise.ledNeutral,'unedited lighting stays the film\'s');
// Room brightness / ambient light: numbers or keys, only the touched fields, merged over the film's.
const g=cleanLighting({sceneGlobals:{exposureScale:1.23,environmentScale:[[0,.3],[7.75,.7]],junk:1}}).sceneGlobals;
assert.deepEqual(g,{exposureScale:1.23,environmentScale:[[0,.3],[7.75,.7]]});
const withGlobals=filmRenderShot({...rise,sceneGlobals:{roomLight:.55,exposureScale:.9,ledRoomSpill:.15}},{...directorShot,sceneGlobals:{roomLight:.55,environmentScale:2}},dkeys).sceneGlobals;
assert.deepEqual(withGlobals,{roomLight:.55,exposureScale:.9,ledRoomSpill:.15,environmentScale:2});
console.log('Film lighting: clean/export round trip, neutral white over time, linear brightness and warmth, light states and colour keys in group moves, the browser camera bake (matches camera-spline.mjs) and the render shot merge verified.');
