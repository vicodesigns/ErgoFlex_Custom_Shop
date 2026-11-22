// Diagonal wheel moves and "Approach a landing spot" in a real Chrome (22 Nov 2026, Vico: "add the diagonal wheel
// movements so I can use it in the shop scene ... the desk goes diagonal and then rotates into place"). Self-contained
// (any studio state; BASE=http://127.0.0.1:3010 runs it against a server you started), Vico's 3rd cut, ch 11 storage.
// Nothing is exported: the Director's draft only, Vico's chapter data is never written.
//   1  + Diagonal at 1 s: a forward-right block; the stage's desk moves along 45 degrees (sideways = forward at every
//      sample) and keeps its heading                                                     (diagonal-1-block.png)
//   2  the inspector's direction list has the four diagonals; back-left: the desk goes back and left at 45 degrees
//   3  Approach a landing spot from 12.25 s to where the chapter ends (Replace): a strafe, one diagonal, a turn; the
//      desk lands within 1 cm / .5 degree of where it landed before                         (diagonal-2-approach.png)
//   CHROME=... [BASE=...] node tests/desk-diagonal-e2e.mjs [shots dir]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-vicos-3rd-cut';
const shots=process.argv[2]||path.join(os.tmpdir(),'desk-diagonal-shots');fs.mkdirSync(shots,{recursive:true});
const chapter=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='storage');
assert.ok(chapter,'the 3rd cut has the storage chapter');
const {base,page,errors,close}=await openDirectorBrowser();
const log=(...a)=>console.log(...a);
const shoot=async name=>{await wait(400);const f=path.join(shots,name);await page.screenshot({path:f});log('screenshot',f);};
const pose=()=>page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoPresentation.capturePose());
const T=Number(chapter.seconds);
const at=async t=>{await seek(page,t);await wait(250);return pose();};
const clipsOnLane=()=>page.$$eval('#director-timeline [data-desk-lane="wheels"] [data-desk-clip]',l=>l.map(e=>e.textContent.replace(/\s+/g,' ').trim()));
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(250);}};
const set=async(name,value)=>{await page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);if(!e)throw Error('no field '+n);if(e.type==='checkbox')e.checked=!!v;else e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(300);};
try{
  await openChapter(page,base,chapter);
  await page.$eval('[data-inspector-tab="groove"]',e=>e.click()).catch(()=>{});await wait(600);
  const endBefore=await at(T);log('the chapter ends at',JSON.stringify(endBefore));
  // ---- 1 + Diagonal at 1 s
  await seek(page,1);
  await page.$eval('#director-timeline [data-desk-kind="diagonal"]',e=>e.click());await wait(800);
  const blocks=await clipsOnLane();log('wheels lane',JSON.stringify(blocks));assert.ok(blocks.some(b=>/Diagonal forward-right 12″/.test(b)),'a forward-right block');
  assert.match(await page.$eval('#director-panel .movement-inspector h4',e=>e.textContent),/Diagonal \(45°\)/);
  const p0=await at(1),samples=[];for(const t of [1.5,2.25,3,4])samples.push(await at(t));
  for(const p of samples){const dx=p.x-p0.x,dz=p.z-p0.z;log('t',JSON.stringify(p));assert.ok(Math.abs(Math.abs(dx)-Math.abs(dz))<.05,`45 degrees: sideways ${dx.toFixed(3)} vs forward ${dz.toFixed(3)}`);assert.ok(Math.abs(p.yaw-p0.yaw)<1e-6,'the heading kept');}
  const end=samples.at(-1);assert.ok(Math.abs(Math.hypot(end.x-p0.x,end.z-p0.z)-12)<.05,'12″ along the diagonal');assert.ok(end.x>p0.x&&end.z>p0.z,'forward and to the right (the desk starts at heading 0)');
  await seek(page,2.25);await shoot('diagonal-1-block.png');
  // ---- 2 the inspector's directions; back-left
  const dirs=await page.$$eval('#director-panel [name="desk-clip-direction"] option',l=>l.map(o=>o.value));
  for(const d of ['forward-left','forward-right','backward-left','backward-right'])assert.ok(dirs.includes(d),'the inspector offers '+d);
  await set('desk-clip-direction','backward-left');await page.$eval('#director-panel [data-desk-action="apply"]',e=>e.click()).catch(()=>{});await wait(700);
  {const q=await at(4);assert.ok(q.x<p0.x&&q.z<p0.z&&Math.abs(Math.abs(q.x-p0.x)-Math.abs(q.z-p0.z))<.05,'back-left at 45 degrees: '+JSON.stringify(q));}
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(400);
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(600);
  assert.ok(!(await clipsOnLane()).some(b=>/Diagonal/.test(b)),'undo takes the diagonal off again');
  log('1-2 ok: + Diagonal, 45 degrees both ways, heading kept');
  // ---- 3 Approach a landing spot from 12.25 s to where the chapter ends
  await page.evaluate(()=>{const d=document.querySelector('#director-panel [data-desk-approach]');d.open=true;d.scrollIntoView({block:'center'});});await wait(300);
  await set('desk-ap-start',12.25);await set('desk-ap-x',endBefore.x);await set('desk-ap-z',endBefore.z);await set('desk-ap-yaw',endBefore.yaw);await set('desk-ap-replace',true);
  const planText=await page.$eval('#director-panel [data-desk-ap-plan]',e=>e.textContent);log('plan:',planText);
  assert.match(planText,/Strafe right 3″ → Diagonal forward-right 80\.61″ → Turn left into place 90°/,'the plan for the workshop');
  await page.$eval('#director-panel [data-desk-action="approach"]',e=>e.click());await wait(900);
  const lane=await clipsOnLane();log('wheels lane after',JSON.stringify(lane));assert.ok(lane.some(b=>/Diagonal forward-right 80\.61″/.test(b)),'the diagonal block');
  const landed=await at(T);log('lands at',JSON.stringify(landed));
  assert.ok(Math.hypot(landed.x-endBefore.x,landed.z-endBefore.z)<=1/2.54,'within 1 cm of where it landed before');
  assert.ok(Math.abs(((landed.yaw-endBefore.yaw)%360+540)%360-180)<=.5,'and within .5 degree');
  await seek(page,15);await shoot('diagonal-2-approach.png');
  assert.deepEqual(errors,[],'page errors');
  log(`PASS desk-diagonal-e2e (screenshots in ${shots})`);
}catch(error){await page.screenshot({path:path.join(shots,'diagonal-fail.png')}).catch(()=>{});console.log('status:',await status(page));throw error;}
finally{await close();}
