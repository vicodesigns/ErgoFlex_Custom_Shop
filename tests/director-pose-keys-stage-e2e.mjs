// S31: pose keys on the live stage (the desk's room-people.mjs keyPoses), real Chrome on the harness's scratch server.
// media, the first person: auto-key on, the left elbow as built at 3 s and bent 90 degrees at 9 s; pose mode left; the
// stage's elbow measured at 3 (a key), 6 (half way), 9 (a key) and 12 s (after). Stills of each (shots dir); EXPORT_OUT=<file>
// keeps the Export cut (for a film still: tools/experience/render-cut.cjs on the imported cut).
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-pose-keys-stage-e2e.mjs [shots dir]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',shots=process.argv[2]||null;
const c=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='media');
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='media');
const key=film.people.cast[0].key;
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(250);}};
const set=(page,name,value)=>page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
const {base,page,errors,close}=await openDirectorBrowser();
// the elbow's turn from its rest on the stage (degrees)
const elbow=()=>page.evaluate(k=>{const w=document.getElementById('stage').contentWindow,o=w.ErgoFlex.workspaceRoom.people.byKey(k),r=o?.userData.personRig;if(!r)return null;const b=r.bones.get('lowerarm_l'),q=r.rest.get('lowerarm_l').clone().invert().multiply(b.quaternion);return 2*Math.acos(Math.min(1,Math.abs(q.w)))*180/Math.PI;},key);
try{
  await openChapter(page,base,c);
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());await until(()=>page.$('[data-action="pe-row"]'),'the People list');
  await page.$eval('[data-action="pe-row"][data-index="0"]',e=>e.click());await wait(800);
  await seek(page,3);await page.$eval('[data-action="pe-pose-enter"]',e=>e.click());
  await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)&&!/Loading the skeleton/.test(p.textContent)).catch(()=>false),'the skeleton',180000);
  if(await page.$eval('[data-action="pe-key-auto"]',e=>e.getAttribute('aria-pressed'))!=='true')await page.$eval('[data-action="pe-key-auto"]',e=>e.click());
  await set(page,'pe-joint','lowerarm_l');await wait(300);
  await page.$eval('[data-action="pe-key-limb"]',e=>e.click());await wait(500);         // 3 s: the arm as it is (as built)
  await seek(page,9);await set(page,'pe-rx',90);await wait(700);                         // 9 s: the elbow bent 60
  const keys=await page.$$eval('[data-pose-key-row] [data-pose-key]',l=>l.map(e=>Number(e.dataset.poseKey)));assert.deepEqual(keys,[3,9]);
  await page.$eval('[data-action="pe-pose-done"]',e=>e.click());await wait(800);
  const at={};
  for(const t of [3,6,9,12]){await seek(page,t);await wait(1500);at[t]=await elbow();if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,`s31-posekey-stage-${t}s.png`)});}}
  console.log('elbow turn from rest on the stage:',JSON.stringify(Object.fromEntries(Object.entries(at).map(([k,v])=>[k,v&&Math.round(v*10)/10]))));
  assert.ok(at[3]!==null&&at[3]<3,'3 s: as built');assert.ok(Math.abs(at[9]-90)<3,'9 s: 90 degrees');assert.ok(Math.abs(at[6]-45)<5,'6 s: half way (smooth: 45)');assert.ok(Math.abs(at[12]-90)<3,'12 s: held after the last key');
  if(process.env.EXPORT_OUT){const text=await page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-panel [data-action="save-export"]').click();}));fs.writeFileSync(process.env.EXPORT_OUT,text);}
  assert.deepEqual(errors,[],'page errors');
  console.log(`PASS pose keys on the stage: ${key}'s elbow ${at[3].toFixed(1)} / ${at[6].toFixed(1)} / ${at[9].toFixed(1)} / ${at[12].toFixed(1)} degrees at 3 / 6 / 9 / 12 s`);
}finally{await close();}
