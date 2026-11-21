// A chapter can be shortened down to its last clip / light / title, whatever its camera (21 Nov 2026, Vico on chapter 12,
// hero, 47.5 s: "I can only make it longer, it seems to be stuck"). The film chapter's camera has a view every second
// (plan-00 .. plan-48: 0, 1, ..., 47, 47.5 s); the old floor was the second-last view + 0.1 s = 47.1 s, which the end
// handle's 0.5 s snap rounded up to 47.5 s, the length itself. Now camera views never hold the length: shortening trims
// the views past the new end and the chapter ends on the view the camera had there; everything before keeps its seconds.
//   node tests/chapter-shorten-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chapterFloor,shortenChapter,lengthenChapter,viewsPastEnd} from '../experience/chapter-timing.mjs';
import {sampleCamera} from '../experience/camera-track.mjs';
const S=47.5,times=[...Array.from({length:48},(_,i)=>i),47.5];
const view=t=>({position:[2+Math.cos(t/9),1.4+t/60,3+Math.sin(t/9)],target:[0,0.8,0],fov:26+t/20,aspect:16/9});
const heroKeys=()=>times.map((t,i)=>({id:'plan-'+String(i).padStart(2,'0'),time:t/S,label:'Key '+(i+1),easing:'linear',view:view(t)}));
const clip=(id,lane,start,duration,target)=>({id,lane,kind:lane,start,duration,easing:'linear',label:'',target});
const motion={version:2,initial:{height:52.5,tilt:65,x:0,z:0,yaw:0},clips:[clip('d-lift','lift',22.5,3.2,40),clip('f-lift','lift',34.22,6.5,28),clip('g-tilt','tilt',38.4,3.24,0)]};
const shot={id:'hero',seconds:S,motion,camera:{keys:heroKeys()}};
const near=(a,b,eps,what)=>assert.ok(Math.abs(a-b)<=eps,`${what}: ${a} vs ${b}`);
const sameView=(a,b,eps,what)=>{for(const f of ['position','target'])a[f].forEach((n,i)=>near(n,b[f][i],eps,`${what} ${f}[${i}]`));near(a.fov,b.fov,eps,what+' fov');};

// ---- 1 the floor: the last clip (41.64 s), not the second-last camera view
near(chapterFloor(shot,motion,heroKeys()),41.64,1e-9,'hero floor = the end of g-tilt');
near(chapterFloor(shot,motion,heroKeys(),[39.78,43]),43,1e-9,'a later light / title / time-of-day key holds it');
assert.equal(chapterFloor({seconds:10},{clips:[]},[{time:0,view:view(0)},{time:1,view:view(1)}]),2,'nothing placed: 2 s');
// the end handle's snapped minimum (Math.ceil(floor*2)/2) is below the length now: 42 s, not 47.5
assert.equal(Math.ceil(chapterFloor(shot,motion,heroKeys())*2-1e-9)/2,42,'the handle can go down to 42 s');

// ---- 2 shorter, between two views: the views before keep their seconds, the end is the view the camera had there
{
  const next=shortenChapter(shot,motion,heroKeys(),44.5),k=next.camera.keys;
  assert.equal(next.seconds,44.5);assert.equal(viewsPastEnd(shot,heroKeys(),44.5),4,'45, 46, 47, 47.5 s trimmed');
  assert.equal(k.length,46,'0 .. 44 s, then the chapter end');
  k.slice(0,-1).forEach((x,i)=>near(x.time*44.5,i,1e-9,`view ${i} keeps its second`));
  assert.equal(k.at(-1).time,1,'the end view sits on the chapter end');assert.equal(k.at(-1).label,'Chapter end');assert.equal(k.at(-1).id,'plan-45-end');
  sameView(k.at(-1).view,sampleCamera(heroKeys(),44.5/S),1e-9,'the end view is the camera at 44.5 s');
  for(let t=0;t<=44.5;t+=.25)sameView(sampleCamera(k,t/44.5),sampleCamera(heroKeys(),t/S),1e-9,`the camera at ${t} s is unchanged`);
  assert.deepEqual(next.motion,motion,'clips keep their seconds');
  assert.ok(new Set(k.map(x=>x.id)).size===k.length,'ids stay unique');
}
// ---- 3 onto a view: that view ends the chapter, nothing added
{
  const k=shortenChapter(shot,motion,heroKeys(),45).camera.keys;
  assert.equal(k.length,46);assert.equal(k.at(-1).id,'plan-45');assert.equal(k.at(-1).time,1);sameView(k.at(-1).view,view(45),0,'plan-45 itself');
}
// ---- 4 the fine-tune Vico asked for: Alt-free 0.01 s steps just under the length
{
  const next=shortenChapter(shot,motion,heroKeys(),47.37),k=next.camera.keys;
  assert.equal(viewsPastEnd(shot,heroKeys(),47.37),1,'only the 47.5 s view goes');
  assert.equal(k.at(-2).id,'plan-47');near(k.at(-2).time*47.37,47,1e-9,'47 s stays at 47 s');
  sameView(k.at(-1).view,sampleCamera(heroKeys(),47.37/S),1e-9,'and the end is the camera at 47.37 s');
}
// ---- 5 a camera that already holds before the new end: just holds (no view trimmed, nothing forced onto the end)
{
  const held=[{id:'a',time:0,label:'A',easing:'smooth',view:view(0)},{id:'b',time:.4,label:'B',easing:'smooth',view:view(4)}];
  const k=shortenChapter({...shot,seconds:10},{...motion,clips:[]},held,8).camera.keys;
  assert.equal(k.length,2);near(k[1].time*8,4,1e-9,'B stays at 4 s');assert.ok(k[1].time<1,'and is not pulled to the end');
}
// ---- 6 an ending hold (same view on the end as just before it): shortening to its start drops it, as before
{
  const k=[{id:'a',time:0,label:'A',easing:'smooth',view:view(0)},{id:'b',time:.8,label:'B',easing:'smooth',view:view(8)},{id:'h',time:1,label:'Ending hold',easing:'smooth',view:view(8)}];
  const out=shortenChapter({...shot,seconds:10},{...motion,clips:[]},k,8).camera.keys;
  assert.deepEqual(out.map(x=>x.id),['a','b']);assert.equal(out[1].time,1);
}
// ---- 7 what still stops it: a clip past the new end, under 2 s, not shorter
assert.throws(()=>shortenChapter(shot,motion,heroKeys(),41),/fit inside/,'g-tilt ends at 41.64 s');
assert.throws(()=>shortenChapter(shot,motion,heroKeys(),1.5),/at least 2 seconds/);
assert.throws(()=>shortenChapter(shot,motion,heroKeys(),48),/at least 2 seconds/);
// and longer is untouched: the camera holds its last view over the added time
{const next=lengthenChapter(shot,motion,heroKeys(),50);assert.equal(next.seconds,50);assert.equal(next.camera.keys.at(-1).label,'Ending hold');}

// ---- 8 the Director uses it: the end handle's floor, the status names the trimmed views
{
  const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8').replace(/\r/g,'');
  assert.match(src,/import \{paceChapter,lengthenChapter,chapterFloor,shortenChapter,viewsPastEnd\} from '\.\/chapter-timing\.mjs\?v=[^']+';/);
  assert.match(src,/return chapterFloor\(shot\(\),deskEditor\.motion\(\),keys\(\),\[/,'the end handle\'s floor');
  assert.match(src,/trimmed=longer\?0:viewsPastEnd\(shot\(\),keys\(\),seconds\)/,'resizeChapter counts the trimmed views');
  assert.match(src,/camera view\$\{trimmed===1\?'':'s'\} past the new end trimmed/,'and says so');
  assert.match(src,/const trim=v<d\.seconds\?viewsPastEnd\(shot\(\),keys\(\),v\):0;/,'the drag says it before the drop');
}
console.log('chapter-shorten-test: ok (hero 47.5 s goes down to 42 s, Alt to 41.64 s; the camera is trimmed at the new end, not a floor)');
