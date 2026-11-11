// Director lights end to end (real GPU Chrome): several lights of one kind coexist. Chapter 2 (rise):
//   - Lamps & sun: three spots, two points and an area light are added; each lands on its own spot (not stacked),
//     is listed, has its own chip in the timeline (all reachable: none clipped), is selected from the chip and edited on its own;
//   - the live stage has all six lights;
//   - several status lights and several time-of-day keys coexist (each its own block / key on the lane);
//   - two status lights cannot cover the same seconds (the strip shows one state at a time): a clear message, nothing changes.
//   node tests/director-lights-e2e.mjs      (SHOTS=<dir> keeps screenshots; run under flock /tmp/claude-1000/hq12-stills.lock)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chapterList,wait,openDirectorBrowser,openChapter,status as statusOf,seek,root} from './director-e2e-harness.mjs';
const chapter=chapterList()?.find(c=>c.id==='rise');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log('Director lights e2e: skipped (no rise chapter page in this checkout).');process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-lights-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
try{
  await openChapter(page,base,chapter);
  const click=async sel=>{await page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);await wait(500);};
  const setField=async(name,v)=>{await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);if(!el)throw Error('no field '+n);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},name,v);await wait(500);};
  const draftShot=async()=>{await wait(1100);return page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});};
  const stageLights=()=>page.evaluate(()=>{const n=[];document.getElementById('stage').contentWindow.ErgoPresentation.three().scene.traverse(o=>{if(o.isLight&&/director-/.test(o.name||''))n.push(o.type);});return n;});
  await click('#director-panel [data-inspector-tab="lighting"]');
  const kinds=['spot','spot','spot','point','point','rect'];
  for(const k of kinds)await click(`#director-panel [data-action="sl-add-${k}"]`);
  await wait(1500);
  let d=await draftShot();
  check(d.lights?.length===6&&new Set(d.lights.map(l=>l.name)).size===6,'six added lights with six different ids: '+d.lights?.map(l=>l.type).join(', '));
  const apart=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  check(d.lights.every((a,i)=>d.lights.every((b,j)=>i===j||apart(a.position,b.position)>=.25)),'every added light has its own place (none stacked on another)');
  const until=async(fn,ms=15000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)return v;await wait(200);}};
  await until(()=>page.$$eval('#director-panel [data-scene-lights] [data-action="sl-pick"]',r=>r.length>=14));
  const rows=await page.$$eval('#director-panel [data-scene-lights] [data-action="sl-pick"]',r=>r.map(e=>e.textContent.trim()));
  check(['Added spot 1','Added spot 2','Added spot 3','Added point 1','Added point 2','Added area 1'].every(n=>rows.some(r=>r.includes(n))),'the Lamps & sun list has all six');
  await page.evaluate(()=>{const v=document.querySelector('#director-timeline .timeline-viewport');v.scrollTop=v.scrollHeight;});await wait(300);
  await until(()=>page.$$eval('#director-timeline .lamps-lane [data-action=lamp-pick]',c=>c.length>=6));
  const chips=await page.$$eval('#director-timeline .lamps-lane [data-action=lamp-pick]',c=>c.map(e=>{const r=e.getBoundingClientRect(),l=e.parentElement.getBoundingClientRect();return {path:e.dataset.section,label:e.textContent.trim(),inside:r.left>=l.left-1&&r.right<=l.right+1&&r.top>=l.top-1&&r.bottom<=l.bottom+1};}));
  check(chips.length===6&&chips.every(c=>c.inside),'the Lamps lane shows a chip for each, none clipped: '+chips.map(c=>c.label).join(', '));
  const live=await stageLights();
  check(live.filter(t=>t==='SpotLight').length>=3&&live.filter(t=>t==='PointLight').length>=2&&live.some(t=>t==='RectAreaLight'),'the stage has all of them: '+live.join(','));
  await page.screenshot({path:path.join(shots,'01-six-lights.png')});
  // each light is picked from its chip and edited alone
  for(const [i,c] of chips.entries()){
    await click(`#director-timeline [data-action=lamp-pick][data-section="${c.path}"]`);
    const head=await page.$eval('#director-panel [data-selected-header]',e=>e.textContent);
    check(head.includes(c.label),`chip ${c.label} selects that light (${head.trim().slice(0,40)})`);
    await setField('sl-intensity',10+i);
  }
  d=await draftShot();
  check(d.lights.map(l=>l.intensity).join()==='10,11,12,13,14,15','each light kept its own intensity: '+d.lights.map(l=>l.intensity));
  // several status lights and time-of-day keys
  await seek(page,0);await click('#director-panel [data-action="tod-add"]');await seek(page,6);await click('#director-panel [data-action="tod-add"]');await seek(page,12);await click('#director-panel [data-action="tod-add"]');
  const tods=await page.$$eval('#director-timeline [data-tod-key]',k=>k.length);
  check(tods>=4,'several time-of-day keys on the lane: '+tods);
  const before=await page.$$eval('#director-timeline [data-light-clip]',k=>k.length);
  await seek(page,10);await click('#director-panel [data-action="light-add"]');await seek(page,15);await click('#director-panel [data-action="light-add"]');
  const after=await page.$$eval('#director-timeline [data-light-clip]',k=>k.length);
  check(after===before+2,`two more status lights on the Desk status lane (${before} -> ${after})`);
  // overlapping states are refused with a clear reason
  const sel=await page.$eval('#director-timeline [data-light-clip].selected',e=>e.dataset.lightClip);
  await setField('light-at',3.5);
  check(/one state at a time/.test(await statusOf(page)),'a status light over another is refused: '+await statusOf(page));
  check(errors.length===0,'no page errors '+errors.join(' | '));
}catch(e){console.log('FAIL',e.message);failures.push(e.message);}
finally{await close();}
if(failures.length){console.log(`\n${failures.length} failed`);process.exit(1);}
console.log('\nDirector lights e2e: all checks passed.');
