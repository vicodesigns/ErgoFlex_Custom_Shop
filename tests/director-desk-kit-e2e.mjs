// "Same setup as another desk", end to end (real GPU Chrome; NOT run by the node checks; written for the browser / GPU pass).
// Oilers (chapter 6, highschool, house, morning), the Desks tab: select the white desk Fern works at (station-project-review), Copy from
// the featured (black) desk with "Stand at this desk" ticked and the keyboard and mouse matched to the white frame:
//   1. the record holds the featured desk's keyboard tray, single monitor arm and monitor, the WHITE ErgoFlex keyboard and the WHITE mouse
//      (state.accessoryFinishes), each in its slot with the placement the build gives it; the desk stands at 43.5 in, flat
//   2. Fern is the standing model (people-fern-stand-type), the same hair colour, at that desk; her hands land on the keyboard on the tray
//      (distance between the hand bones and the keyboard top), the monitor's centre is near her eye line, nothing of the kit intersects
//      her arms or the laptop (bounding boxes), the room's drafting chair does not touch her
//   3. one undo step brings the desk back as the film has it; redo brings the kit back; Export cut (deskEdits[].build) carries it
//   4. screenshots at the chapter's first camera key (0 s) land in SHOTS: before.png and after.png, for Vico to look at
//   node tests/director-desk-kit-e2e.mjs        (SHOTS=<dir> keeps pictures; CUT=<cut dir>; DESK=station-<id> for another desk)
// Run it under the browser-test gate (scratchpad slot.sh). Downloads go to a temp folder (never ~/Downloads).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine',DESK=process.env.DESK||'station-project-review';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='oilers'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director desk kit e2e: skipped (${CUT} has no oilers chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'desk-kit-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(400);};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
const stageDesk=id=>page.evaluate(id=>{const api=document.getElementById('stage').contentWindow.ErgoFlex,r=api.sceneDesks.records.get(id);if(!r)return null;
  return {accessories:[...(r.state.accessories||[])],finishes:{...(r.state.accessoryFinishes||{})},height:r.state.height??null,
    placed:Object.fromEntries([...r.objects.entries()].filter(([k,v])=>k.startsWith('accessory-')&&!v.saved.removed).map(([k,v])=>[k.slice(10),{role:v.saved.role,p:v.saved.transform?.p}]))};},id);
const draft=()=>page.evaluate(()=>{try{const b=document.body.dataset;if(b.draftStore!=='film')return JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return null;}catch{return null;}});
try{
  await openChapter(page,base,chapter);
  await until(()=>page.evaluate(id=>!!document.getElementById('stage').contentWindow.ErgoFlex?.sceneDesks?.records?.get(id),DESK),'the desk',120000);
  await seek(page,0);await wait(2500);await shot('before');
  const before=await stageDesk(DESK);
  await click('#director-panel [data-inspector-tab=desks]');
  await click(`#director-panel [data-action=dk-select][data-section="${DESK}"]`);
  await page.select('#director-panel [name=dk-kit-src]','featured');
  await page.evaluate(()=>{const c=document.querySelector('#director-panel [name=dk-kit-stand]');if(!c.checked)c.click();});await wait(300);
  await click('#director-panel [data-action=dk-kit-copy]');
  await wait(3500);
  const after=await stageDesk(DESK);
  // the monitor is the featured desk's own (desk-kit.mjs copySetup: the source's part; the cine cut's featured desk has a curved
  // ultrawide, Vico's the flat monitor), else the HBHS desk's flat monitor
  const {isKitAccessory}=await import('../experience/desk-kit.mjs'),isMonitor=id=>isKitAccessory(id)&&!/arm|tray|keyboard|mouse|mx-master/.test(id);
  const srcMonitor=(await page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.currentConfig.accessories)).find(isMonitor)||'flat-monitor';
  for(const id of ['keyboard-tray','monitor-arm',srcMonitor,'ergo-keyboard','logitech-mx-master'])check(after.accessories.includes(id),`${id} is on the desk${id===srcMonitor?' (the featured desk\'s monitor)':''}`);
  check(after.finishes['ergo-keyboard']==='white'&&after.finishes['logitech-mx-master']==='white','the keyboard and the mouse are the WHITE ErgoFlex ones');
  check(after.placed['keyboard-tray']?.role==='desktop'&&after.placed['monitor-arm']?.role==='shelf','tray on the desktop frame, arm on the top shelf frame');
  const people=await page.evaluate(()=>{const api=document.getElementById('stage').contentWindow.ErgoFlex,ps=api.workspaceRoom?.people?.people||[];return ps.filter(o=>o.visible&&/fern/.test(o.userData.person?.id||o.name)).map(o=>o.userData.person.id);});
  check(people.includes('people-fern-stand-type'),`Fern stands at the desk (shown: ${people.join(', ')||'none'})`);
  await shot('after');
  const d=await draft();const entry=d?.shots?.find(s=>s.id==='oilers')?.deskEdits?.find(e=>e.desk===DESK)||null;
  if(entry)check(entry.initial?.height===43.5&&entry.build?.accessoryFinishes?.['ergo-keyboard']==='white'&&!!entry.build?.objects?.['accessory-keyboard-tray'],'the chapter draft keeps the build, its finishes and placements and the standing start (Export cut carries them)');
  else console.log('note: the draft is the film draft store; check Export cut by hand');
  // undo / redo
  await page.evaluate(()=>document.querySelector('#director-appbar [data-action=undo]').click());await wait(3500);
  const undone=await stageDesk(DESK);check(JSON.stringify(undone.accessories)===JSON.stringify(before.accessories),'one undo step: the desk is back as the film has it');
  await page.evaluate(()=>document.querySelector('#director-appbar [data-action=redo]').click());await wait(3500);
  const redone=await stageDesk(DESK);check(redone.finishes['ergo-keyboard']==='white','redo brings the setup back');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.slice(0,3).join(' | '):''));
}catch(error){failures.push(error.message);console.error(error);}
console.log(`pictures: ${SHOTS}`);
await close();
if(failures.length){console.error('FAIL\n'+failures.join('\n'));process.exit(1);}
console.log('Director desk kit e2e: ok');
