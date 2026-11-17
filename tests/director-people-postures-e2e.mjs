// Windows render PC only. No screenshots, stills, or renders are produced.
// Uses an isolated browser and the harness's scratch state; Vico's cut is read-only.
// POSTURE_CUT=exports/cinematic-intro-cut-vicos-2nd-cut CHROME=... node tests/director-people-postures-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
if(process.platform!=='win32')throw Error('Run the Director acceptance test on the Windows render PC; Linux has insufficient memory.');
const cut=process.env.POSTURE_CUT||'exports/cinematic-intro-cut-vicos-2nd-cut';
const chapter=JSON.parse(fs.readFileSync(path.join(root,cut,'director-chapters.json'),'utf8')).chapters.find(c=>c.id==='rise');
const original=JSON.parse(fs.readFileSync(path.join(root,cut,'director-film/rise.json'),'utf8'));
const originalPose=original.people.cast.find(e=>e.key==='maya-stand').pose;
const STAND='people-maya-stand-type-41',SIT='people-maya-sit-type';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-postures-'));
const {base,page,errors,close}=await openDirectorBrowser();
const until=async(fn,what)=>{const end=Date.now()+120000;while(Date.now()<end){if(await fn())return;await wait(250);}throw Error('Timed out: '+what);};
const click=selector=>page.$eval(selector,e=>e.click());
const set=(name,value)=>page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);if(!e)throw Error('Missing field '+n);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
const select=async()=>{await click('[data-inspector-tab="people"]');await until(()=>page.$('[data-person-key="maya-stand"]'),'Maya row');await click('[data-person-key="maya-stand"] .people-pick');};
const exported=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const previous=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=previous;fetch(this.href).then(r=>r.text()).then(resolve,reject);};document.querySelector('#director-appbar [data-action="save-export"]').click();}));
const showing=()=>page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom.people.byKey('maya-stand')?.userData.person.id);
const stores=text=>JSON.parse(text).shots.find(s=>s.id==='rise').peopleEdits.cast.find(e=>e.key==='maya-stand');
try{
  await openChapter(page,base,chapter);await seek(page,16.6);await select();assert.equal(await showing(),SIT);
  await click('[data-action="pe-pose-enter"]');await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)&&!/Loading the skeleton/.test(p.textContent)),'seated pose tools');
  assert.ok(await page.evaluate(()=>{const w=document.getElementById('stage').contentWindow,g=w.ErgoPresentation.three().scene.getObjectByName('Director pose tools');return g?.children.some(c=>c.userData?.joint==='hand_l');}),'seated hand dot');
  if(await page.$eval('[data-action="pe-key-auto"]',e=>e.getAttribute('aria-pressed'))==='true')await click('[data-action="pe-key-auto"]');
  await set('pe-joint','hand_l');await set('pe-rx',15);await click('[data-action="pe-key-all"]');await wait(800);
  const entry=stores(await exported());assert.equal(entry.id,STAND);assert.deepEqual(entry.postures?.[STAND]?.pose,originalPose);   // (a cut whose maya-stand has no pose of its own, like the cine cut, has no standing record: both undefined)assert.ok(entry.postures[SIT].poseKeys.some(k=>Math.abs(k.t-16.6)<.001&&k.pose.hand_l));
  await click('#director-appbar [data-action="undo"]');await wait(500);assert.match(await page.$eval('#director-panel',p=>p.textContent),/none yet/);
  await click('#director-appbar [data-action="redo"]');await wait(500);assert.match(await page.$eval('#director-panel',p=>p.textContent),/1 key/);
  await seek(page,8);assert.equal(await showing(),STAND);await seek(page,16.6);assert.equal(await showing(),SIT);
  const text=await exported(),expected=stores(text);
  // (Export cut forgets this tab's draft: the exported file is the film's once it is imported, so a reload now shows the film's own cut. The round trip that matters is the file: re-import below.)
  await page.reload();await until(()=>page.$eval('#director-panel',p=>/Camera is live/.test(p.textContent)).catch(()=>false),'reload');
  const file=path.join(tmp,'posture-cut.json');fs.writeFileSync(file,text);await (await page.$('input[type="file"]')).uploadFile(file);await until(()=>page.$eval('#director-panel',p=>/Imported as a separate cut/.test(p.textContent)).catch(()=>false),'re-import');
  assert.deepEqual(stores(await exported()).postures,expected.postures,'re-import keeps both stores');assert.deepEqual(errors,[]);
  console.log('PASS Director Maya postures: seated dots/edit/keys, standing fix, undo/redo, scrub, export/reload/re-import');
}finally{await close();fs.rmSync(tmp,{recursive:true,force:true});}
