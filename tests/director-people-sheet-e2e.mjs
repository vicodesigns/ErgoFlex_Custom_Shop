// S33 (A2) People keyframe sheet (real Chrome, the harness's own scratch server) on oilers of the Cinematographer's cut.
// M-a: a row per character (collapsed: small diamonds at every key time + the on-screen bar); twirled open: On screen /
// Path / Actions / Pose with the keys people-track.mjs sheet() derives; the big diamonds and the Pose keys row are gone.
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-people-sheet-e2e.mjs [shots dir]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openDirectorBrowser,openChapter,wait,root} from './director-e2e-harness.mjs';
import {sheet} from '../experience/people-track.mjs';
const CUT='exports/cinematic-intro-cut-cine',shots=process.argv[2]||null;
const c=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='oilers');
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
const {base,page,errors,close}=await openDirectorBrowser();
const shoot=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name)});}};
const twirl=async id=>{await page.$eval(`[data-ps-twirl="${id}"]`,e=>e.click());await wait(300);};
const rowKeys=(row,prop)=>page.$$eval(`[data-ps-of="${row}"][data-ps-prop="${prop}"] [data-sk]`,l=>l.map(e=>e.dataset.sk));
try{
  await page.evaluateOnNewDocument(()=>localStorage.removeItem('ergoflex.director.peopleSheet'));
  await openChapter(page,base,c);
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());await wait(1200);
  const want=sheet(film.people,film.seconds);
  // ---- M-a: rows, summary, twirl-down, keys
  assert.deepEqual(await page.$$eval('.ps-char .desk-lane-label b',l=>l.map(e=>e.textContent)),want.map(r=>r.label),'a row per character');
  assert.equal(await page.$$eval('[data-pt-index],[data-pose-keys-lane]',l=>l.length),0,'the big diamonds and the Pose keys row are gone');
  for(const r of want)assert.equal(await page.$$eval(`[data-ps-row="${r.row}"] .ps-dot`,l=>l.length),r.summary.length,`${r.label}: a summary diamond per key time`);
  assert.ok(await page.$$eval('[data-ps-row="kai"] .ps-onscreen',l=>l.length)===2,'Kai: two placements on screen');
  await twirl('kai');await twirl('noah');
  for(const r of want.filter(r=>r.row==='kai'||r.row==='noah'))for(const prop of ['screen','path','actions','pose'])
    assert.deepEqual(await rowKeys(r.row,prop),r.props[prop].map(k=>k.id),`${r.label} ${prop}`);
  assert.deepEqual(await page.$$eval('[data-ps-of="kai"][data-ps-prop="screen"] .ps-place',l=>l.length),2,'a bar per placement');
  await page.evaluate(()=>document.querySelector('[data-ps-row="kai"]').scrollIntoView({block:'start'}));await wait(300);
  await shoot('s33-ma-sheet.png');
  await twirl('kai');assert.equal(await page.$$eval('[data-ps-of="kai"]',l=>l.length),0,'folded again');
  assert.deepEqual(errors,[],'page errors');
  console.log(`PASS people sheet M-a: ${want.length} character rows, summaries, twirl-down property rows match sheet()`);
}finally{await close();}
