// Timeline layers end to end (real GPU Chrome): items that cover the same seconds of one lane stack into sub-rows and stay
// selectable, draggable and exported. Chapter 2 (rise):
//   - a turn and a glide on the Wheels lane play together: two rows, both blocks clickable, the lane grows and shrinks back;
//   - the live desk heading / position follow both (turn 360 deg over 2-5 s, glide 12 in over 3-6 s: at 4.5 s 300 deg, x +5.2, z -3.0);
//   - the draft (what Export cut sends) carries both clips; a lift over a lift is still refused with a clear message;
//   - drag a block: only that clip moves.
//   node tests/director-layers-e2e.mjs      (SHOTS=<dir> keeps screenshots; run under flock /tmp/claude-1000/hq12-stills.lock)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chapterList,wait,openDirectorBrowser,openChapter,status as statusOf,seek,root} from './director-e2e-harness.mjs';
const chapter=chapterList()?.find(c=>c.id==='rise');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log('Director layers e2e: skipped (no rise chapter page in this checkout).');process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-layers-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
try{
  await openChapter(page,base,chapter);
  const click=async sel=>{await page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);await wait(600);};
  const draftShot=async()=>{await wait(1100);return page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});};
  const wheels=()=>page.$$eval('#director-timeline [data-desk-lane=wheels] [data-desk-clip]',c=>c.map(e=>({id:e.dataset.deskClip,top:e.offsetTop,height:e.offsetHeight,text:e.innerText.replace(/\s+/g,' ')})));
  const laneHeight=()=>page.$eval('#director-timeline [data-desk-lane=wheels]',e=>e.offsetHeight);
  const rowsAttr=()=>page.$eval('#director-timeline [data-desk-lane=wheels]',e=>e.parentElement.dataset.rows);
  await click('#director-panel [data-inspector-tab="groove"]');
  const h1=await laneHeight();
  await seek(page,2);await click('#director-timeline .track-palette [data-desk-action=add-wheels][data-desk-kind=rotate]');
  await seek(page,3);await click('#director-timeline .track-palette [data-desk-action=add-wheels][data-desk-kind=travel]');
  check(!/open time|full/i.test(await statusOf(page)),'a glide added at 3 s inside the turn is not refused or moved: '+await statusOf(page));
  const c=await wheels();
  check(c.length===2,'two blocks on the Wheels lane');
  check(await rowsAttr()==='2'&&c[0].top!==c[1].top&&Math.abs(c[0].top-c[1].top)>=c[0].height-1,'they sit in two sub-rows without covering each other ('+c.map(x=>x.top).join(' / ')+')');
  check(await laneHeight()>h1,'the Wheels lane grows to hold both');
  await page.screenshot({path:path.join(shots,'01-wheels-layers.png')});
  // select each block by clicking it
  for(const [i,pat] of [[0,/Turn/],[1,/Move forward/]]){
    await click(`#director-timeline [data-desk-clip="${c[i].id}"]`);
    check(pat.test(await page.$eval('#director-panel [data-inspector-page=groove],#director-panel',e=>e.textContent))&&await page.$eval(`#director-timeline [data-desk-clip="${c[i].id}"]`,e=>e.classList.contains('selected')),`block ${i+1} is selectable (${c[i].text})`);
  }
  // the live desk at 4.5 s: turned 300 deg, rolled half of 12 in along the heading it had when the glide began (120 deg: x +5.2, z -3.0)
  await seek(page,4.5);
  let readout='';for(let i=0;i<20;i++){readout=await page.$eval('[data-desk-readout]',e=>e.textContent);if(/300\.0° heading/.test(readout)&&/X 5\.2″/.test(readout))break;await wait(250);}
  check(/300\.0° heading/.test(readout)&&/X 5\.2″ · Z -3\.0″/.test(readout),'at 4.5 s the desk has turned 300° and rolled 6 in diagonally together: '+readout);
  // the draft keeps both
  let d=await draftShot();
  const clips=d.motion.clips.filter(x=>x.lane==='wheels');
  check(clips.length===2&&clips.some(x=>x.kind==='rotate'&&x.start===2&&x.duration===3)&&clips.some(x=>x.kind==='travel'&&x.start===3),'Export cut carries both overlapping wheel clips');
  // drag the lower block 1 s right: only that clip moves
  const box=await (await page.$(`#director-timeline [data-desk-clip="${c[1].id}"]`)).boundingBox();
  const lane=await (await page.$('#director-timeline [data-desk-lane=wheels]')).boundingBox();
  const perSecond=lane.width/18;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+perSecond,box.y+box.height/2,{steps:6});await page.mouse.up();await wait(900);
  d=await draftShot();
  const g=d.motion.clips.find(x=>x.kind==='travel'),t=d.motion.clips.find(x=>x.kind==='rotate');
  check(Math.abs(g.start-4)<.11&&t.start===2,`dragging the glide moves only the glide (${g.start} s; the turn stays at ${t.start} s)`);
  // still refused where the data model forbids it: a lift over a lift
  await seek(page,4);await click('#director-timeline .track-palette [data-desk-action=add-lift]');
  const lifts=(await draftShot()).motion.clips.filter(x=>x.lane==='lift');
  check(lifts.every((a,i)=>lifts.every((b,j)=>i===j||a.start>=b.start+b.duration-1e-6||b.start>=a.start+a.duration-1e-6)),'two lifts never cover the same seconds (the new one went to a free gap)');
  // back to one row once the glide is removed
  await click(`#director-timeline [data-desk-clip="${c[1].id}"]`);await click('#director-panel [data-desk-action=delete]');
  const after=await wheels();
  check(after.length===1&&await rowsAttr()==='1'&&await page.$eval('#director-timeline [data-desk-lane=wheels]',e=>!e.parentElement.classList.contains('layered')),'the lane is one row again once nothing overlaps');
  check(errors.length===0,'no page errors '+errors.join(' | '));
}catch(e){console.log('FAIL',e.message);failures.push(e.message);}
finally{await close();}
if(failures.length){console.log(`\n${failures.length} failed`);process.exit(1);}
console.log('\nDirector layers e2e: all checks passed.');
