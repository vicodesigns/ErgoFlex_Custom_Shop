// S31 M4 smoke (real Chrome, the harness's own scratch server): the People track on oilers of the Cinematographer's cut.
// A row per person with the programmed diamonds (experience/people-track.mjs); clicking Noah's tap goes to 8.2 s and
// selects noah-taps; dragging it to about 8.6 s and Kai's docking change to about 9.8 s, then Export cut: only
// noah-taps.act.at and the two `when` edges changed.
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-people-track-e2e.mjs [shots dir]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
import {programmedDiamonds} from '../experience/people-track.mjs';
const CUT='exports/cinematic-intro-cut-cine',shots=process.argv[2]||null;
const c=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='oilers');
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
const {base,page,errors,close}=await openDirectorBrowser();
const pt=()=>page.$$eval('[data-pt-index]',l=>l.map(e=>({i:Number(e.dataset.ptIndex),label:e.getAttribute('aria-label')})));
async function drag(label,to){
  const find=`[...document.querySelectorAll('[data-pt-index]')].find(e=>e.getAttribute('aria-label').startsWith(${JSON.stringify(label)}))`;
  await page.evaluate(`${find}.scrollIntoView({block:'center'})`);await wait(400);
  const {box,lane}=await page.evaluate(`(()=>{const e=${find},r=e.getBoundingClientRect(),l=e.parentElement.getBoundingClientRect();return {box:{x:r.x,y:r.y,width:r.width,height:r.height},lane:{x:l.x,width:l.width}};})()`);
  const x=lane.x+lane.width*to/c.seconds,y=box.y+box.height/2;
  await page.mouse.move(box.x+box.width/2,y);await page.mouse.down();await page.mouse.move(box.x+box.width/2+8,y,{steps:3});await page.mouse.move(x,y,{steps:8});await page.mouse.up();await wait(800);
}
try{
  await openChapter(page,base,c);
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());await wait(1500);
  const want=programmedDiamonds(film.people,film.seconds),got=await pt();
  assert.equal(got.length,want.diamonds.length,`${got.length} diamonds on the track, ${want.diamonds.length} programmed`);
  const rows=await page.$$eval('.people-track-row .desk-lane-label',l=>l.map(e=>e.textContent));
  assert.deepEqual(rows,want.rows.map(r=>r.label),'a row per person');
  // click the tap
  await page.evaluate(()=>{const e=[...document.querySelectorAll('[data-pt-index]')].find(e=>e.getAttribute('aria-label').startsWith('noah-taps action at'));e.scrollIntoView({block:'center'});e.click();});await wait(1200);
  const now=await page.$eval('#director-timeline [name="timeline-seconds"]',e=>Number(e.value));assert.ok(Math.abs(now-8.2)<.02,'the playhead went to the tap: '+now);
  const header=await page.$eval('#director-panel',p=>p.textContent);assert.ok(/Noah/.test(header),'Noah selected');
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.evaluate(()=>document.querySelector('.people-track-row')?.scrollIntoView({block:'center'}));await wait(300);await page.screenshot({path:path.join(shots,'s31-track-1-people-track.png')});}
  await drag('noah-taps action at',8.6);
  await drag('kai-rolls posture change at',9.8);
  if(shots){await page.evaluate(()=>document.querySelector('.people-track-row')?.scrollIntoView({block:'center'}));await wait(300);await page.screenshot({path:path.join(shots,'s31-track-2-retimed.png')});}
  const text=await page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-panel [data-action="save-export"]').click();}));
  const pe=JSON.parse(text).shots[0].peopleEdits;assert.equal(pe.v,2);
  const tap=pe.cast.find(e=>e.key==='noah-taps').act.at;assert.ok(Math.abs(tap-8.6)<.06,'tap retimed: '+tap);
  assert.ok(Math.abs(pe.when['kai-rolls'][0][1]-9.8)<.06&&pe.when['kai-rolls'][0][1]===pe.when['kai-docks'][0][0],'docking change moved both edges: '+JSON.stringify([pe.when['kai-rolls'],pe.when['kai-docks']]));
  const exp=structuredClone(film.people);exp.cast.find(e=>e.key==='noah-taps').act.at=tap;exp.when['kai-rolls'][0][1]=exp.when['kai-docks'][0][0]=pe.when['kai-docks'][0][0];exp.cast.find(e=>e.key==='kai-docks').roll.start=pe.when['kai-docks'][0][0];
  const {v,...rest}=pe;assert.deepEqual(rest,exp,'nothing else changed');
  assert.deepEqual(errors,[],'page errors');
  console.log(`PASS director people track: ${got.length} diamonds in ${rows.length} rows; click = playhead + select; tap -> ${tap} s, Kai docks at ${pe.when['kai-docks'][0][0]} s; nothing else changed`);
}finally{await close();}
