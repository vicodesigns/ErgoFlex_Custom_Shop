// Status lights follow the desk's moves, end to end (real GPU Chrome; run on the Windows machine, NOT on the desk). Chapter 2 (rise):
// two Lift blocks, each with a light on the Desk status lane that matches it (found by timing, so the switch shows ON).
//   - the move inspector's Status light switch: ON for a found light, off removes it (one undo step), on adds a linked one;
//   - dragging the Lift block moves its light with it (same left / width on the two lanes); the Speed preset changes the length
//     of both; Delete movement removes its light and one Undo brings both back;
//   - Lighting -> Desk status: the light reads "Follows ..." with no start / length fields; Unlink to edit by hand gives the
//     fields and a block that no longer follows; "Linked to a move" links it again and snaps it to the move;
//   - Follow moves | Manual | Off; Off writes statusLight:false and the switch says so;
//   - nothing of the link reaches the film: the cut's text (Export cut / Render still use exportLighting) has no "link" or "manual".
//   node tests/status-follow-e2e.mjs      (SHOTS=<dir> keeps screenshots; run under flock /tmp/claude-1000/hq12-stills.lock)
//   VIEW=390x844 runs it at a phone size (the 44 px touch targets are checked when the pointer is coarse).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chapterList,wait,openDirectorBrowser,openChapter,status as statusOf,seek,root,FILM_DRAFT_READER} from './director-e2e-harness.mjs';
const chapter=chapterList()?.find(c=>c.id==='rise');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log('Status follows e2e: skipped (no rise chapter page in this checkout).');process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'status-follows-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
try{
  await openChapter(page,base,chapter);
  const click=async sel=>{await page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);await wait(600);};
  const setField=async(name,v)=>{await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);if(!el)throw Error('no field '+n);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},name,v);await wait(700);};
  const draft=async()=>{await wait(1100);return page.evaluate(`(()=>{try{const v=${FILM_DRAFT_READER};return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}})()`);};
  const lights=()=>page.$$eval('#director-timeline [data-light-clip]',els=>els.map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.lightClip,left:r.left,width:r.width,linked:e.classList.contains('linked'),label:e.getAttribute('aria-label')};}));
  const clipBox=async n=>page.$$eval('#director-timeline [data-desk-lane=lift] [data-desk-clip]',(els,n)=>{const r=els[n].getBoundingClientRect();return {id:els[n].dataset.deskClip,left:r.left,width:r.width};},n);
  const selectClip=async n=>{const id=(await clipBox(n)).id;await click(`#director-timeline [data-desk-lane=lift] [data-desk-clip="${id}"]`);await wait(300);return id;};
  const near=(a,b,tol=3)=>Math.abs(a-b)<=tol;
  const lightFor=async clip=>{const ls=await lights();return ls.find(l=>near(l.left,clip.left)&&near(l.width,clip.width))||null;};
  const switchOn=()=>page.$eval('#director-panel [name="follow-toggle"]',e=>e.checked).catch(()=>null);

  // 1. the switch on the first Lift block: ON, because rise's light already starts and ends with it
  await click('#director-panel [data-inspector-tab="groove"]').catch(()=>{});
  let id0=await selectClip(0),before=await lights();
  check(before.length>=3,`the Desk status lane has the chapter's lights (${before.length})`);
  check(await switchOn()===true,'the Status light switch is ON for a move whose light already matches it (found by timing)');
  const touch=await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),sw=await page.$eval('#director-panel .follow-toggle',e=>e.getBoundingClientRect().height);
  check(!touch||sw>=44,`the switch is a ${Math.round(sw)} px row${touch?' (44 px or more for touch)':''}`);
  let clip=await clipBox(0);check(!!await lightFor(clip),'its light sits exactly under the block (same left and width)');
  // nothing changed yet: finding a link writes no lighting into the cut
  let d=await draft();check(!d?.ledStatus,'looking at a found link changed no data (the cut has no lighting of its own yet)');

  // 2. off removes the light (one undo step), on adds a linked one
  await click('#director-panel [name="follow-toggle"]');
  check((await lights()).length===before.length-1&&await switchOn()===false,'switching it off removed that light only');
  await click('#director-panel [data-action="undo"]');
  check((await lights()).length===before.length,'one Undo brought it back');
  await click('#director-panel [data-action="redo"]');await click('#director-panel [name="follow-toggle"]');
  const on=await lights();clip=await clipBox(0);const mine=await lightFor(clip);
  check(on.length===before.length&&!!mine&&mine.linked,'switching it on again adds a light that follows (chain on its block)');
  check(/follows/i.test(await statusOf(page))||/Status light on/.test(await statusOf(page)),'the status line says so: '+await statusOf(page));
  await page.screenshot({path:path.join(shots,'01-switch-on.png')});

  // 3. drag the block: its light follows
  await page.$eval(`#director-timeline [data-desk-lane=lift] [data-desk-clip="${id0}"]`,e=>e.scrollIntoView({block:'center',inline:'nearest'}));await wait(300);
  const box=await (await page.$(`#director-timeline [data-desk-lane=lift] [data-desk-clip="${id0}"]`)).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2,{steps:6});await page.mouse.up();await wait(900);
  const moved=await clipBox(0);check(moved.left>clip.left+10,'the block moved right ('+Math.round(moved.left-clip.left)+' px)');
  check(!!await lightFor(moved),'the light moved with it (same left and width)');
  // ...and one Undo takes both back
  await click('#director-panel [data-action="undo"]');clip=await clipBox(0);
  check(near(clip.left,moved.left-(moved.left-clip.left),1)&&!!await lightFor(clip)&&Math.abs(clip.left-moved.left)>10,'Undo put block and light back together');

  // 4. speed: the preset changes the length of both
  id0=await selectClip(0);const w0=(await clipBox(0)).width;
  await setField('desk-clip-speed-preset','fast');
  const fast=await clipBox(0);check(fast.width<w0-2,'a faster speed shortened the block');check(!!await lightFor(fast),'and its light with it');
  await click('#director-panel [data-action="undo"]');

  // 5. Lighting: the light reads "Follows ...", timing read-only; Unlink to edit by hand; Linked to a move
  clip=await clipBox(0);const l1=await lightFor(clip);
  await click('#director-panel [data-inspector-tab="lighting"]');await click(`#director-timeline [data-light-clip="${l1.id}"]`);
  let text=await page.$eval('#director-panel .light-inspector',e=>e.textContent);
  check(/Follows/.test(text)&&await page.$('#director-panel [name="light-at"]')===null,'Lighting shows "Follows ..." and no start / length fields');
  check(await page.$('#director-panel [data-follow-linked]:not([data-follow-linked=""])')!==null,'the inspector knows the move it follows');
  await click('#director-panel [data-action="follow-unlink"]');
  check(await page.$('#director-panel [name="light-at"]')!==null,'Unlink to edit by hand gives the start and length fields');
  check(!(await lights()).find(l=>l.id===l1.id)?.linked,'its block no longer shows the chain');
  // move the clip: the unlinked light stays
  await click('#director-panel [data-inspector-tab="groove"]');id0=await selectClip(0);await setField('desk-clip-start',(await page.$eval('[name="desk-clip-start"]',e=>Number(e.value)))+1);
  const stay=(await lights()).find(l=>l.id===l1.id);check(!!stay&&near(stay.left,l1.left,1),'an unlinked light stays where it is when its move changes');
  // link it again from the select
  await click('#director-panel [data-inspector-tab="lighting"]');await click(`#director-timeline [data-light-clip="${l1.id}"]`);
  const options=await page.$$eval('#director-panel [name="follow-link-clip"] option',o=>o.filter(x=>x.value&&!x.disabled).map(x=>x.value));
  check(options.length>=1,'"Linked to a move" lists the moves it could follow: '+options.length);
  if(options.length)await setField('follow-link-clip',options[0]);
  clip=await clipBox(0);check(!!await lightFor(clip),'linking snapped the light to the move');

  // 6. Delete movement removes its light, one Undo brings both back
  await click('#director-panel [data-inspector-tab="groove"]');id0=await selectClip(0);const n0=(await lights()).length,c0=await page.$$eval('#director-timeline [data-desk-lane=lift] [data-desk-clip]',e=>e.length);
  await click('#director-panel [data-desk-action="delete"]');
  check((await page.$$eval('#director-timeline [data-desk-lane=lift] [data-desk-clip]',e=>e.length))===c0-1&&(await lights()).length===n0-1,'Delete movement removed the block and its light');
  await click('#director-panel [data-action="undo"]');
  check((await page.$$eval('#director-timeline [data-desk-lane=lift] [data-desk-clip]',e=>e.length))===c0&&(await lights()).length===n0,'one Undo brought both back');

  // 7. the chapter control
  await click('#director-panel [data-inspector-tab="lighting"]');
  check(await page.$$eval('#director-panel .follow-mode button',b=>b.map(x=>x.textContent).join('|'))==='Follow moves|Manual|Off','Follow moves | Manual | Off');
  await click('#director-panel .follow-mode [data-section="off"]');d=await draft();
  check(d?.statusLight===false,'Off writes statusLight:false');
  await click('#director-panel [data-inspector-tab="groove"]');await selectClip(0);
  check(/off for this chapter/.test(await page.$eval('#director-panel .follow-light',e=>e.textContent)),'the move\'s switch says the lights are off');
  await click('#director-panel [data-inspector-tab="lighting"]');await click('#director-panel .follow-mode [data-section="follow"]');d=await draft();
  check(d?.statusLight!==false,'Follow moves turns them back on');
  await page.screenshot({path:path.join(shots,'02-lighting.png')});

  // 8. nothing of the link reaches the film
  const text2=await page.evaluate(`(()=>{try{const v=${FILM_DRAFT_READER};return JSON.stringify((v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].ledStatus);}catch{return '';}})()`);
  check(/"link"/.test(text2),'the Director\'s own draft keeps the link ('+(text2.match(/"link":"[^"]+"/g)||[]).length+' linked)');
  const exported=await page.evaluate(async()=>{const b=document.querySelector('[data-action="export"]');return typeof window.__efDirector?.exportText==='function'?window.__efDirector.exportText():null;}).catch(()=>null);
  if(exported)check(!/"link"|"manual"/.test(exported),'Export cut text has no link / manual fields');
  else console.log('note  Export cut text not reachable from the page here: tests/status-follow-test.mjs proves exportLighting drops them');
  check(errors.length===0,'no page errors '+errors.join(' | '));
}catch(e){console.log('FAIL',e.message);failures.push(e.message);}
finally{await close();}
if(failures.length){console.log(`\n${failures.length} failed`);process.exit(1);}
console.log('\nStatus follows e2e: all checks passed.');
