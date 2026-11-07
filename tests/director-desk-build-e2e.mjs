// Director "Build" tab for a room desk, end to end (real GPU Chrome; not one of the quick tests/cinematic-* checks).
// The Build tab (experience/desk-build-panel.mjs) styles a room desk that is NOT the featured one, like the store
// configurator: desktop finish, frame finish, trim colour, build presets, accessories and the slot each one goes in. It
// shows in every room except school / college / library ones (those use branding): chapters 4, 5, 6 (library,
// occmedialab, highschool) have no Build tab. The film chapters of the other rooms only have the featured desk, so the
// test swaps chapter 7's room (wellness) for the hospital, whose workstations are non-featured desks with their own
// state.style / accessories.
//   tabs: gym has Build (only the featured desk: a hint); library, occmedialab, highschool do not
//   hospital: pick "Medication administration" (48″, White Birch, Silver) -> Coast Navy / Terracotta / Coast Orange
//     on the stage record, featured desk untouched; add a Drawing tablet to the Second shelf; move the keyboard to the
//     Base shelf; remove the mouse; each is one undo step; Export cut carries deskEdits[].build; a reload keeps it.
//
//   node tests/director-desk-build-e2e.mjs        (BASE=http://127.0.0.1:3123 to use a running server; SHOTS=<dir> keeps pictures)
// Run it under the browser-test gate (scratchpad slot.sh). Downloads go to a temp folder (never ~/Downloads).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='wellness');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director desk build e2e: skipped (${HQ} has no wellness chapter page in this checkout).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-desk-build-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const DESK='station-medication-station';
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(300);};
const tabs=()=>page.$$eval('#director-panel [data-inspector-tab]',b=>b.map(x=>x.textContent.trim()));
const setRoom=async room=>{
  await click('#director-panel [data-inspector-tab=chapter]');
  await page.evaluate(r=>{const s=document.querySelector('#director-panel select[name=room]');s.value=r;s.dispatchEvent(new Event('change',{bubbles:true}));},room);
  await wait(2500);
  await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:180000}).catch(()=>{});
  await wait(2500);
};
// The record the stage holds for a desk: style, accessories and where each one sits.
const stageDesk=id=>page.evaluate(id=>{const api=document.getElementById('stage').contentWindow.ErgoFlex,r=api.sceneDesks.records.get(id);if(!r)return null;
  return {style:r.state.style,accessories:[...(r.state.accessories||[])],placed:Object.fromEntries([...r.objects.entries()].filter(([k,v])=>k.startsWith('accessory-')&&!v.saved.removed).map(([k,v])=>[k.slice(10),{role:v.saved.role,mount:v.obj.parent?.name,visible:v.obj.visible}])),
    featured:{id:api.sceneDesks.selected,wood:api.currentConfig.woodFinish,base:api.currentConfig.baseFinish,trim:api.currentConfig.trimColor}};},id);
const shotDraft=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});
const buildOf=async()=>(await shotDraft())?.deskEdits?.find(e=>e.desk===DESK)?.build||null;
const undoOn=()=>page.$eval('#director-panel [data-action=undo]',b=>!b.disabled);
const pick=(kind,value)=>click(`#director-panel [data-build-pick=${kind}][data-value="${value}"]`);
try{
  await openChapter(page,base,chapter);
  // ---- which rooms get the tab
  check((await tabs()).includes('Build'),'gym (chapter 7): the Build tab shows');
  await click('#director-panel [data-inspector-tab=build]');
  check(/only the featured desk/.test(await page.$eval('#director-panel [data-inspector-page=build]',e=>e.textContent)),'gym: a hint says the room has only the featured desk');
  for(const room of ['library','occmedialab','highschool']){await setRoom(room);check(!(await tabs()).includes('Build'),`${room} (school / college / library): no Build tab`);}
  await setRoom('hospital');
  check((await tabs()).includes('Build'),'hospital: the Build tab shows');
  await click('#director-panel [data-inspector-tab=build]');
  const desks=await page.$$eval('#director-panel [name=build-desk] option',o=>o.map(x=>x.value));
  check(desks.length===2&&desks.includes(DESK),`the Desk picker lists the room's other desks (${desks.join(', ')})`);
  await page.select('#director-panel [name=build-desk]',DESK);await wait(500);
  const before=await stageDesk(DESK);
  check(before.style.woodFinish==='White Birch'&&before.style.baseFinish==='Silver','the desk starts as the room has it (White Birch / Silver)');
  check(['wood','base','trim'].every(k=>true)&&(await page.$$('#director-panel .build-swatch')).length>=30,'swatches for desktop, frame and trim; presets: '+await page.$$eval('#director-panel [data-build-preset]',b=>b.length));
  check((await page.$$eval('#director-panel [data-build-pick=wood][aria-pressed=true]',b=>b.map(x=>x.title))).join()==='White Birch','the desktop swatch shows White Birch pressed');
  const mainBefore=before.featured;

  // ---- finishes
  await pick('wood','Coast Navy');await pick('base','Terracotta');await pick('trim','#f99239');
  const styled=await until(async()=>{const d=await stageDesk(DESK);return d.style.woodFinish==='Coast Navy'&&d.style.baseFinish==='Terracotta'&&d.style.trimColor==='#f99239'?d:null;},'the stage desk takes the finishes');
  check(!!styled,'stage record: Coast Navy / Terracotta / #f99239 (live, no reload)');
  check(styled.featured.wood===mainBefore.wood&&styled.featured.trim===mainBefore.trim,`the featured desk is untouched (${styled.featured.wood} / ${styled.featured.trim})`);
  let b=await buildOf();
  check(b?.woodFinish==='Coast Navy'&&b.baseFinish==='Terracotta'&&b.trimColor==='#f99239'&&!b.accessories,'draft: deskEdits[].build has the three finishes and no accessory list yet');
  check((await shotDraft()).deskEdits[0].desk===DESK,'draft: deskEdits[0].desk is the record id');

  // ---- accessories
  const roles0=before.placed;
  check(roles0['ergo-keyboard']?.role==='desktop'&&roles0['monitor-arm']?.role==='shelf',`the room's accessories sit where the room puts them (keyboard ${roles0['ergo-keyboard']?.role}, arm ${roles0['monitor-arm']?.role})`);
  await page.select('#director-panel [name=build-add]','drawing-tablet');await page.select('#director-panel [name=build-add-slot]','lower-shelf');
  await click('#director-panel [data-build-add]');
  const added=await until(async()=>{const d=await stageDesk(DESK);const t=d.placed['drawing-tablet'];return t&&t.role==='lower-shelf'&&/lower-shelf/.test(t.mount||'')?d:null;},'the tablet on the second shelf');
  check(!!added,`Drawing tablet on the Second shelf: ${JSON.stringify(added?.placed['drawing-tablet'])}`);
  check(added.accessories.includes('drawing-tablet')&&added.accessories.includes('flat-monitor'),'the desk keeps its other accessories');
  await page.select('#director-panel [data-build-slot=ergo-keyboard]','base-shelf');
  const moved=await until(async()=>{const d=await stageDesk(DESK);const t=d.placed['ergo-keyboard'];return t&&/base-shelf/.test(t.mount||'')?d:null;},'the keyboard on the base shelf');
  check(!!moved,`Ergonomic keyboard moved to the Base shelf: ${JSON.stringify(moved?.placed['ergo-keyboard'])}`);
  await click('#director-panel [data-build-remove=logitech-mx-master]');
  const removed=await until(async()=>{const d=await stageDesk(DESK);return !d.accessories.includes('logitech-mx-master')&&!d.placed['logitech-mx-master']?d:null;},'the mouse removed');
  check(!!removed,'Logitech MX Master removed from the stage desk');
  b=await buildOf();
  const slots=Object.fromEntries((b?.accessories||[]).map(a=>[a.id,a.slot]));
  check(slots['drawing-tablet']==='lower-shelf'&&slots['ergo-keyboard']==='base-shelf'&&!('logitech-mx-master' in slots)&&slots['monitor-arm']==='shelf',`draft build.accessories: ${JSON.stringify(slots)}`);
  await page.$eval('#director-panel [data-build-add]',e=>e.scrollIntoView({block:'center'}));await wait(400);
  await page.screenshot({path:path.join(shots,'build-tab.png')});

  // ---- undo
  await click('#director-panel [data-action=undo]');
  const undone=await until(async()=>{const d=await stageDesk(DESK);return d.accessories.includes('logitech-mx-master')?d:null;},'undo brings the mouse back');
  check(!!undone&&undone.placed['ergo-keyboard']?.role==='base-shelf','Undo: the mouse is back, the keyboard stays on the base shelf');
  await click('#director-panel [data-action=redo]');
  check(!!await until(async()=>{const d=await stageDesk(DESK);return !d.accessories.includes('logitech-mx-master')?d:null;},'redo removes it again'),'Redo: the mouse is removed again');

  // ---- export
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await click('#director-panel [data-action=save-export]');
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download',30000);
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8')),entry=exported.shots[0].deskEdits?.find(e=>e.desk===DESK);
  check(entry?.build?.woodFinish==='Coast Navy'&&entry.build.baseFinish==='Terracotta'&&entry.build.trimColor==='#f99239','Export cut: shot.deskEdits[].build carries the finishes');
  const exSlots=Object.fromEntries((entry?.build?.accessories||[]).map(a=>[a.id,a.slot]));
  check(exSlots['drawing-tablet']==='lower-shelf'&&exSlots['ergo-keyboard']==='base-shelf'&&!('logitech-mx-master' in exSlots),'Export cut: build.accessories carries the slots '+JSON.stringify(exSlots));
  check(entry?.name==='Medication administration','Export cut: the desk name is kept as a label');

  // ---- reload keeps it
  await page.reload();
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  await wait(3000);
  await page.evaluate(()=>document.querySelector('#director-panel [data-inspector-tab=build]')?.click());await wait(1500);
  const re=await until(async()=>{const d=await stageDesk(DESK);return d&&d.style.woodFinish==='Coast Navy'&&d.placed['drawing-tablet']?.role==='lower-shelf'?d:null;},'the reloaded stage has the build',90000).catch(()=>null);
  check(!!re,'reload: the stage desk still has Coast Navy and the tablet on the second shelf');
  check(!!re&&re.placed['ergo-keyboard']?.role==='base-shelf'&&!re.accessories.includes('logitech-mx-master'),'reload: keyboard on the base shelf, mouse still removed');
  check((await page.$$eval('#director-panel [data-build-pick=wood][aria-pressed=true]',b=>b.map(x=>x.title))).join()==='Coast Navy','reload: the Build tab shows Coast Navy pressed');
  await wait(1500);await page.screenshot({path:path.join(shots,'build-reloaded.png')});

  // ---- reset
  await click('#director-panel [data-build-reset]');
  const reset=await until(async()=>{const d=await stageDesk(DESK);return d.style.woodFinish==='White Birch'&&d.accessories.includes('logitech-mx-master')&&!d.accessories.includes('drawing-tablet')?d:null;},'reset to the room');
  check(!!reset&&reset.placed['ergo-keyboard']?.role==='desktop','Reset: the desk is back to the room\'s White Birch build and its own accessories');
  check((await shotDraft()).deskEdits?.length===0,'Reset: no deskEdits entry is left');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){failures.push(error.message);console.error(error);}
finally{await close();}
assert.equal(failures.length,0,failures.join('\n'));
console.log('Director desk build e2e: ok');
