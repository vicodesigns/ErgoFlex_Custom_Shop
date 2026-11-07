// Director timeline: adding at the chapter end grows the chapter (nothing jumps to 0 s, nothing stretches) and the
// end handle on the ruler drags the chapter length (real GPU Chrome; run under scratchpad slot.sh).
//   node tests/director-timeline-extend-e2e.mjs        (BASE=http://127.0.0.1:<port> to use a running server; SHOTS=<dir> keeps drag.png)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf,seek} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='hero');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director timeline extend e2e: skipped (${HQ} has no hero chapter page in this checkout).`);process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-timeline-extend-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const near=(a,b,eps=.03)=>Math.abs(a-b)<=eps;
try{
  await openChapter(page,base,chapter);
  const status=()=>statusOf(page);
  // Everything with a time, as absolute seconds.
  const snap=()=>page.evaluate(()=>{
    const S=Number(document.querySelector('#director-timeline .time-ruler').getAttribute('aria-valuemax')),pct=(el,p)=>parseFloat(el.style[p])*S/100,rows=sel=>[...document.querySelectorAll('#director-timeline '+sel)];
    return {seconds:S,
      clips:rows('[data-desk-clip]').map(e=>({id:e.dataset.deskClip,lane:e.closest('[data-desk-lane]')?.dataset.deskLane,start:pct(e,'left'),duration:pct(e,'width')})),
      keys:rows('[data-key]').map(e=>({id:e.dataset.key,at:pct(e,'left')})),
      lights:rows('[data-light-clip]').map(e=>({id:e.dataset.lightClip,at:pct(e,'left'),dur:pct(e,'width')})),
      tods:rows('[data-tod-key]').map(e=>({id:e.dataset.todKey,at:pct(e,'left')}))};});
  const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(900);};
  const undo=()=>click('#director-panel [data-action=undo]');
  const same=(a,b,get,what)=>a.every(x=>{const y=b.find(v=>v.id===x.id);return y&&get(x).every((v,i)=>near(v,get(y)[i]));})&&check(true,what)||check(false,what);

  // Make the draft hold every camera view/clip explicitly: give the camera a first edit-free baseline via a no-op seek.
  await seek(page,0);
  const s0=chapter&&await snap();
  const end=await page.$eval('#director-timeline [name="timeline-seconds"]',e=>Number(e.max));
  check(end>2,`chapter is ${end}s long`);

  // ---- (a) playhead at the end -> Tilt lands there, the chapter grows, earlier items keep their seconds
  await seek(page,end);
  await page.click('#director-timeline [data-desk-add="tilt"]');await wait(1200);
  const s1=await snap(),tilt=s1?.clips.find(c=>!s0?.clips.some(o=>o.id===c.id)&&c.lane==='tilt');
  check(!!tilt,'a new tilt clip exists');
  check(tilt&&near(tilt.start,end),`the tilt starts at the playhead (${tilt?.start}s, not 0)`);
  check(s1&&tilt&&near(s1.seconds,end+3)&&near(tilt.start+tilt.duration,s1.seconds),`chapter grew from ${end}s to ${s1?.seconds}s, just enough for the tilt`);
  check(/Tilt added at .*s · chapter lengthened to .*s/.test(await status()),'status: '+await status());
  check(s0.clips.every(c=>{const y=s1.clips.find(v=>v.id===c.id);return y&&near(y.start,c.start)&&near(y.duration,c.duration);}),'every earlier desk move keeps its start and length');
  check(s0.lights.every(c=>{const y=s1.lights.find(v=>v.id===c.id);return y&&near(y.at,c.at)&&near(y.dur,c.dur);}),'every light state keeps its time');
  check(s0.tods.every(c=>{const y=s1.tods.find(v=>v.id===c.id);return y&&near(y.at,c.at);}),'every time-of-day key keeps its time');
  check(s0.keys.every(c=>{const y=s1.keys.find(v=>v.id===c.id);return y&&near(y.at,c.at,.01);}),'every camera view keeps its absolute time');
  check(s1.keys.at(-1)&&near(s1.keys.at(-1).at,s1.seconds)&&s1.keys.length===s0.keys.length+1,'the camera holds its last view over the added time (ending hold)');
  await undo();
  const s2=await snap();
  check(s2&&near(s2.seconds,s0.seconds)&&s2.clips.length===s0.clips.length&&s2.keys.length===s0.keys.length,'Undo restores the old length and clips');

  // ---- (b) the end handle: drag right +4 s, then left past the last item (clamped), one Undo step each
  const handle=async(dx,{alt=false,shot:name=null,release=true}={})=>{
    const box=await (await page.$('#director-timeline [data-chapter-end]')).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx/2,y,{steps:4});await page.mouse.move(x+dx,y,{steps:4});await wait(300);
    const chip=await page.$eval('.chapter-end-ghost b',e=>e.textContent).catch(()=>null),hint=await page.$eval('.chapter-end-ghost',e=>e.dataset.hint).catch(()=>null);
    if(name)await page.screenshot({path:path.join(shots,name)});
    await page.mouse.up();await wait(1200);return {chip,hint};
  };
  const px=async()=>{const r=await page.$eval('#director-timeline .time-ruler',e=>e.getBoundingClientRect().width);return r;};
  await seek(page,0);
  const b0=await snap(),width=await px();
  const live=await handle(4/b0.seconds*width,{shot:'drag.png'});
  const b1=await snap();
  check(near(b1.seconds,b0.seconds+4,.05),`dragging the handle right by 4 s: ${b0.seconds}s -> ${b1.seconds}s (live readout "${live.chip}")`);
  check(b0.clips.every(c=>{const y=b1.clips.find(v=>v.id===c.id);return y&&near(y.start,c.start)&&near(y.duration,c.duration);})&&b0.keys.every(c=>{const y=b1.keys.find(v=>v.id===c.id);return y&&near(y.at,c.at,.05);}),'existing items keep their seconds after the drag');
  check(b1.keys.at(-1)&&near(b1.keys.at(-1).at,b1.seconds,.05),'camera holds the last view to the new end');
  const last=Math.max(...b1.clips.map(c=>c.start+c.duration),...b1.lights.map(l=>l.at+l.dur),...b1.tods.map(t=>t.at));
  const w1=await px(),back=await handle(-(b1.seconds)/b1.seconds*w1);
  const b2=await snap();
  check(b2.seconds>=last-.001&&b2.seconds<b1.seconds&&!!back.hint,`dragging far left clamps at the last item (${b2.seconds}s; last item ends ${last.toFixed(2)}s; hint "${back.hint}")`);
  check(b1.clips.every(c=>{const y=b2.clips.find(v=>v.id===c.id);return y&&near(y.start,c.start)&&near(y.duration,c.duration);}),'no item moved or shrank on the way back');
  // ---- (c) Undo is one step per drag
  await undo();let b3=await snap();
  check(near(b3.seconds,b1.seconds,.05),`Undo after the shorten returns to ${b1.seconds}s (${b3.seconds}s)`);
  await undo();b3=await snap();
  check(near(b3.seconds,b0.seconds,.05)&&b3.keys.length===b0.keys.length,`Undo after the lengthen returns to ${b0.seconds}s (${b3.seconds}s, ${b3.keys.length} camera views)`);
  fs.writeFileSync(path.join(shots,'state.json'),JSON.stringify({s0,s1,s2},null,1));
  check(errors.length===0,'no module errors'+(errors.length?': '+errors[0]:''));
}catch(e){check(false,'exception: '+(e.stack||e));}
finally{await close();}
if(failures.length){console.log(`\n${failures.length} FAIL`);process.exit(1);}
console.log('\nDirector timeline extend e2e passed.');
