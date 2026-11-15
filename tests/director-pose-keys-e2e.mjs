// S31 M2 smoke (real Chrome, the harness's own scratch server): pose keys in pose mode on a chapter of the
// Cinematographer's cut. Auto-key: a joint changed at 3.2 s and at 6 s writes two keys (diamonds on the timeline's Pose
// keys row); dragging the 6 s diamond retimes it; the selected key's ease; copy + paste at the playhead; Delete removes
// a key; Undo brings it back; Export cut carries cast[i].poseKeys in peopleEdits v2.
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-pose-keys-e2e.mjs [chapter] [shots dir]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',id=process.argv[2]||'media',shots=process.argv[3]||null;
const c=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id===id);
const {base,page,errors,close}=await openDirectorBrowser();
const shoot=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name)});}};
const click=sel=>page.$eval(sel,e=>e.click());
const set=(name,value)=>page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
const diamonds=()=>page.$$eval('[data-pose-keys-lane] [data-pose-key]',l=>l.map(e=>Number(e.dataset.poseKey)));
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(250);}};
try{
  await openChapter(page,base,c);
  await click('[data-inspector-tab="people"]');await until(()=>page.$('[data-action="pe-row"]'),'the People list');
  await click('[data-action="pe-row"][data-index="0"]');await wait(800);
  await seek(page,3.2);
  await click('[data-action="pe-pose-enter"]');
  await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)&&!/Loading the skeleton/.test(p.textContent)).catch(()=>false),'the skeleton',120000);
  const auto=await page.$eval('[data-action="pe-key-auto"]',e=>e.getAttribute('aria-pressed'));
  if(auto!=='true')await click('[data-action="pe-key-auto"]');
  await set('pe-joint','lowerarm_l');await wait(300);
  await set('pe-rx',35);await wait(600);
  assert.deepEqual(await diamonds(),[3.2],'a key at 3.2 s after the elbow change');
  await shoot('s31-posekey-1-first-key.png');
  await seek(page,6);await set('pe-rx',-10);await wait(600);
  assert.deepEqual(await diamonds(),[3.2,6],'a second key at 6 s');
  // drag the 6 s diamond to about 8 s
  const d=await page.$('[data-pose-keys-lane] [data-pose-key="6"]'),box=await d.boundingBox(),lane=await (await page.$('[data-pose-keys-lane]')).boundingBox();
  const x8=lane.x+lane.width*8/c.seconds;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+20,box.y+box.height/2,{steps:4});await page.mouse.move(x8,box.y+box.height/2,{steps:8});await page.mouse.up();await wait(700);
  const after=await diamonds();assert.equal(after.length,2);assert.ok(Math.abs(after[1]-8)<.1,'dragged to about 8 s: '+after);
  await shoot('s31-posekey-2-dragged.png');
  // select it (click), ease = hold
  await click(`[data-pose-keys-lane] [data-pose-key="${after[1]}"]`);await wait(500);
  await set('pe-key-ease','hold');await wait(400);
  // copy the 3.2 s key and paste it at 11 s
  await click('[data-pose-keys-lane] [data-pose-key="3.2"]');await wait(500);await click('[data-action="pe-key-copy"]');
  await seek(page,11);await click('[data-action="pe-key-paste"]');await wait(500);
  assert.equal((await diamonds()).length,3,'pasted at 11 s');
  await shoot('s31-posekey-3-three-keys.png');
  // delete the selected (pasted) key, then undo
  await click('[data-action="pe-key-delete"]');await wait(400);assert.equal((await diamonds()).length,2,'deleted');
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(600);
  assert.equal((await diamonds()).length,3,'undo brings the key back');
  const text=await page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-panel [data-action="save-export"]').click();}));
  const pe=JSON.parse(text).shots[0].peopleEdits;assert.equal(pe?.v,2,'peopleEdits v2');
  const keyed=pe.cast.find(e=>e.poseKeys);assert.ok(keyed,'a cast entry with poseKeys');
  const ts=keyed.poseKeys.map(k=>k.t);assert.equal(ts.length,3);assert.ok(Math.abs(ts[0]-3.2)<1e-6&&Math.abs(ts[1]-8)<.1&&Math.abs(ts[2]-11)<.05,'key times '+ts);
  assert.equal(keyed.poseKeys[1].ease,'hold');assert.ok(keyed.poseKeys[0].pose.lowerarm_l,'the elbow keyed');
  const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id===id).people;
  for(const e of film.cast){const mine=pe.cast.find(x=>x.key===e.key);const {poseKeys,...rest}=mine;assert.deepEqual(rest,e,`${e.key}: every other field as the film has it`);}
  console.log(`${id}: ${keyed.key} keyed at ${ts.join(', ')} s (ease ${keyed.poseKeys.map(k=>k.ease||'smooth').join('/')}); status: ${await status(page)}`);
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS director pose keys: auto-key, drag retime, ease, copy/paste, delete, undo, export v2');
}finally{await close();}
