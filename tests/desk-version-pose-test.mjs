// A desk version keeps the desk's place (19 Nov 2026, Vico: chapter 12's Office desk came in turned about 30° against the
// red desk before it, same camera). The Office preset's Studio starting pose is turned (preset-defaults.mjs: yaw .5036 rad,
// x .4986): the stage applied it, remembered it as the Office origin (studio.js resetProductOrigin) and every frame
// after stood on it. Now a desk version (a film sub-shot, or the Director's live version) stands at the product origin.
//   1. the presets: Office's Studio pose is the turned one (what this guards against), the others stand at the origin
//   2. versionShot marks the Director's live version (subshot), and Render still's shot keeps the mark
//   3. the stage asks for the product origin for a sub-shot, and only then (stage.mjs prepare)
//   4. resetProductOrigin itself (studio.js, run on fakes): with the origin it stands the desk at yaw 0 / 0,0 even when the
//      Office origin was remembered turned, and remembers nothing; without, the preset's own chapters keep their view
//   node tests/desk-version-pose-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
globalThis.window??={};globalThis.localStorage??={getItem:()=>null,setItem(){}};
// 1
const {SHARED_BUILD_PRESETS:P}=await import('../preset-defaults.mjs');
assert.ok(Math.abs(P.office.room.desks.main.pose.yaw-.5036)<1e-3,'1. Office\'s Studio starting pose is turned 28.9°');
for(const id of ['gaming','artist','architect','hbhs','occ'])assert.deepEqual(P[id].room.desks.main.pose,{x:0,z:0,yaw:0},`1. ${id} stands at the origin`);
// 2
const {versionShot}=await import('../experience/desk-versions.mjs');
const {filmRenderShot}=await import('../experience/film-render.mjs');
const hero={id:'hero',room:'product',kind:'glide',preset:'gaming',size:'60x30',seconds:48,motion:{version:2,initial:{height:52.5,tilt:65,x:0,z:0,yaw:0},clips:[]}};
const D=versionShot(hero,{n:'D',preset:'office',kind:'hero'});
assert.equal(D.subshot,'D','2. the live version is marked');assert.equal(D.preset,'office');assert.equal(versionShot(hero,null).subshot,undefined,'2. a chapter without versions is not');
assert.equal(filmRenderShot({id:'hero',room:'product',preset:'gaming'},D,null).subshot,'D','2. Render still\'s shot keeps the mark');
// 3
const stage=src('experience/stage.mjs');
assert.match(stage,/ctx\.resetProductOrigin\(preset\+':'\+\(next\.size\|\|'60x30'\),typeof next\.subshot==='string'\?\{x:0,z:0,yaw:0\}:null\)/,'3. prepare passes the product origin for a sub-shot only');
assert.ok(stage.indexOf('ctx.resetProductOrigin(')<stage.indexOf('ctx.markAnchor();'),'3. before the Director\'s anchor is taken');
// 4: the method's own code, on fakes
const studio=src('studio.js'),a=studio.indexOf('        resetProductOrigin(key,pose=null){'),b=studio.indexOf('        markAnchor(){',a);
assert.ok(a>0&&b>a,'4. resetProductOrigin found');
const body=studio.slice(a,b).trim().replace(/,\s*$/,'');
const V=(x=0,y=0,z=0)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c;return this;},clone(){return V(this.x,this.y,this.z);},copy(o){this.x=o.x;this.y=o.y;this.z=o.z;return this;}});
function world(){
  const w={selectedRoomScene:'product',deskYaw:0,glideOffset:V(),glideTarget:V(),origins:new Map(),halted:0};
  const make=new Function('w',`let {selectedRoomScene}=w;const presentationProductOrigins=w.origins,glideOffset=w.glideOffset,glideTarget=w.glideTarget;
    let deskYaw;Object.defineProperty(w,'yaw',{get:()=>deskYaw,set:v=>{deskYaw=v;}});deskYaw=w.deskYaw;
    const applyDeskTransform=()=>{},haltAllMotion=()=>{w.halted++;},clampGlidePosition=p=>{p.x=Math.max(-.6,Math.min(.6,p.x));p.z=Math.max(-.6,Math.min(.6,p.z));return p;},applyGlideOffset=p=>glideOffset.copy(p);
    return {${body}};`);
  w.ctx=make(w);return w;
}
let w=world();
// the Office desk as applyPreset leaves it (its Studio pose), with the Office origin remembered turned
w.yaw=.5036;w.glideOffset.set(.4986,0,.0466);w.origins.set('office:60x30',{offset:V(.4986,0,.0466),yaw:.5036});
w.ctx.resetProductOrigin('office:60x30',{x:0,z:0,yaw:0});
assert.equal(w.yaw,0,'4. a desk version stands at yaw 0 (not the remembered 28.9°)');
assert.deepEqual([w.glideOffset.x,w.glideOffset.z],[0,0],'4. and at the origin');assert.deepEqual([w.glideTarget.x,w.glideTarget.z],[0,0]);
assert.equal(w.origins.get('office:60x30').yaw,.5036,'4. nothing remembered over the preset\'s own origin');
w=world();w.yaw=.5036;w.glideOffset.set(.4986,0,.0466);
w.ctx.resetProductOrigin('office:60x30',{x:0,z:0,yaw:0});assert.ok(!w.origins.has('office:60x30'),'4. and nothing remembered on a first load');
// without the origin (an Office chapter of its own): as before, the first load is remembered and kept
w=world();w.yaw=.5036;w.glideOffset.set(.4986,0,.0466);w.ctx.resetProductOrigin('office:60x30');
assert.equal(w.yaw,.5036,'4. an Office chapter keeps its starting view');w.yaw=1.2;w.ctx.resetProductOrigin('office:60x30');assert.equal(w.yaw,.5036,'4. and replays from it');
console.log('desk-version-pose-test: ok (every desk version stands at the product origin; Office no longer comes in turned 28.9°)');
