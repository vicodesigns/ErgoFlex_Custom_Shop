// S33a2 (real Chrome, the harness's own scratch server): selecting every person of the People list opens their
// inspector with no page error, on oilers (Fern at a room desk, Kai rolling, Noah's placements, Nia and Finn seated on
// student chairs: `on` + `seat`, no `at`) and storage (Andre's nine placements, a walk).
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-people-select-all-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openDirectorBrowser,openChapter,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine';
const chapters=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters;
const {base,page,errors,close}=await openDirectorBrowser();
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(250);}};
try{
  for(const id of ['oilers','storage']){
    await openChapter(page,base,chapters.find(x=>x.id===id));
    await page.$eval('[data-inspector-tab="people"]',e=>e.click());await until(()=>page.$('[data-action="pe-row"]'),'the People list');
    await until(()=>page.$eval('#director-panel [data-scene-people]',b=>!/Loading the people catalog/.test(b.textContent)).catch(()=>false),'the catalog');
    const n=await page.$$eval('[data-action="pe-row"]',l=>l.length),names=[];
    for(let i=0;i<n;i++){
      const before=errors.length;
      await page.$eval(`[data-action="pe-row"][data-index="${i}"]`,e=>e.click());await wait(700);
      const got=await page.evaluate(i=>{const row=document.querySelector(`[data-action="pe-row"][data-index="${i}"]`);return {name:row?.querySelector('strong')?.textContent,open:!!document.querySelector('#director-panel .people-selected'),selected:!!row?.closest('.people-row.selected'),status:document.querySelector('#director-panel [data-status]')?.textContent||''};},i);
      assert.deepEqual(errors.slice(before),[],`${id} row ${i} (${got.name}): page errors`);
      assert.ok(got.open&&got.selected,`${id} row ${i} (${got.name}): the inspector opens (${got.status})`);
      assert.ok(!/Cannot read|undefined/.test(got.status),`${id} row ${i} (${got.name}): status ${got.status}`);
      names.push(got.name);
    }
    console.log(`${id}: ${n} people selected one by one, each inspector open: ${names.join(', ')}`);
  }
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS people select-all: every person of oilers and storage opens their inspector with no error');
}finally{await close();}
