// Director People end to end (real GPU Chrome): the People tab on a film chapter. Bring in the room's people, select
// one from the list, move / turn / scale with the fields, change posture and character, give a person seconds in the
// room, add one from the library, hide and remove, undo; the live stage follows every step; a click in the view on a
// person selects them. Serves this checkout on a free port with a temp studio state.
// Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-people-e2e.mjs      SHOTS=<dir> keeps screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,chapterList,status,wait,seek,root,HQ} from './director-e2e-harness.mjs';
import {peopleFilter} from '../experience/people-edits.mjs';

const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-people-shots-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-people-e2e-')),downloads=path.join(tmp,'downloads');fs.mkdirSync(downloads);
await (await page.createCDPSession()).send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(200);}};
const snap=name=>page.screenshot({path:path.join(shots,name+'.png')});
// The stage's people (room-people.mjs) and the Director's cut shot.
const live=()=>page.evaluate(()=>{const p=document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom?.people;return p?p.list().filter(x=>x.allowed&&!x.missing):[];});
const edits=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].peopleEdits||null;}catch{return null;}});
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const setField=(name,value)=>page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);if(!el)throw Error('no field '+n);if(el.type==='checkbox'){el.checked=v;}else el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
try{
  const chapter=chapterList().find(c=>c.id==='rise');
  await openChapter(page,base,chapter);
  await click('#director-panel [data-inspector-tab="people"]');
  check(await page.$('#director-panel [data-scene-people] [data-action="pe-add"]'),'the People tab is there with + Add person');
  await snap('01-people-tab');

  // the room's own cast becomes this chapter's entries
  if(await page.$('#director-panel [data-action="pe-room"]')){await click('#director-panel [data-action="pe-room"]');}
  await until(async()=>(await page.$$('#director-panel .people-row')).length>=2,'the room\'s people are listed');
  const rows=await page.$$eval('#director-panel .people-row strong',l=>l.map(e=>e.textContent));
  check(rows.length>=2,'the home\'s people are listed: '+rows.join(', '));
  await until(async()=>(await live()).length>=2,'the stage shows them');
  await snap('02-room-people');

  // a click in the view on a person selects them (the film camera at 8.5 s looks at Maya standing at the desk)
  await seek(page,8.5);
  const spot=await until(()=>page.evaluate(()=>{
    const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation.three();
    const o=w.ErgoFlex.workspaceRoom.people.list().find(p=>p.visible&&p.desk),obj=o&&w.ErgoFlex.workspaceRoom.people.byKey(o.key);if(!obj)return null;
    const c=obj.getWorldPosition(new obj.position.constructor());c.y+=1.7;c.project(t.camera);const r=f.getBoundingClientRect();
    return Math.abs(c.x)<.9&&Math.abs(c.y)<.9?{x:r.left+(c.x+1)/2*r.width,y:r.top+(1-c.y)/2*r.height,key:o.key}:null;}),'a person in the view');
  await page.mouse.click(spot.x,spot.y);
  await until(async()=>/Person · Maya/.test(await page.$eval('#director-panel [data-selected-header]',e=>e.textContent)),'the click selects the person');
  passed.push('a click on a person in the view selects them (not as a prop)');
  check(await page.$('#director-panel .people-row.selected'),'their row is marked in the People tab');
  await snap('02b-clicked');
  // select the reader (a free spot), move, turn, scale with the fields
  const idx=await page.$$eval('#director-panel .people-row',l=>l.findIndex(r=>/free spot/.test(r.textContent)));
  check(idx>=0,'someone stands or sits at a free spot');
  await click(`#director-panel .people-row:nth-child(${idx+1}) .people-pick`);
  await until(()=>page.$('#director-panel [name="pe-x"]'),'the selected person\'s fields');
  const before=(await live()).find(p=>!p.desk);
  await setField('pe-x',before.at[0]+400);await setField('pe-turn',45);await setField('pe-scale',110);
  const moved=await until(async()=>{const p=(await live()).find(p=>p.key===before.key);return p&&Math.abs(p.at[0]-(before.at[0]+400))<2&&Math.abs(p.turn-45)<1&&Math.abs(p.scale-1.1)<.01?p:null;},'the stage follows the fields');
  check(moved,'move, turn and size reach the live stage: '+JSON.stringify({at:moved.at,turn:moved.turn,scale:moved.scale}));

  // clothes: a colour for the top reaches the model's own materials
  await setField('pe-color-top','#b02a2a');
  await until(()=>page.evaluate(k=>{const o=document.getElementById('stage').contentWindow.ErgoFlex.workspaceRoom.people.byKey(k);return !!o?.userData.personTinted&&o.userData.personMaterials.some(m=>m.userData.tint?.on.value===1);},before.key),'the top is recoloured on the stage');
  passed.push('a clothing colour recolours the person on the stage');
  // posture and character
  const pose0=await page.$eval('#director-panel [name="pe-pose"]',e=>e.value);
  const other=await page.$$eval('#director-panel [name="pe-pose"] option',l=>l.filter(o=>!/built on request|at the desk/.test(o.textContent)).map(o=>o.value));
  if(other.find(v=>v!==pose0)){await setField('pe-pose',other.find(v=>v!==pose0));await until(async()=>(await page.$eval('#director-panel [name="pe-pose"]',e=>e.value))!==pose0,'posture changed');passed.push('posture changes to another built one');}
  await setField('pe-sex','man');
  await until(async()=>(await page.$$('#director-panel .people-chars button')).length>0,'characters filtered');
  check(await page.$$eval('#director-panel .people-chars button',l=>l.length>0&&l.length<19),'the character list filters by sex');

  // seconds in the room
  await setField('pe-whole',false);await until(()=>page.$('#director-panel [name="pe-in"]'),'timing fields');
  await setField('pe-in',2);await setField('pe-out',9);
  const e1=await until(async()=>{const e=await edits();return e?.when&&Object.values(e.when)[0]?.[0]?.[1]===9?e:null;},'the span is in the cut');
  check(Object.values(e1.when)[0][0][0]===2,'a person can be given seconds in the room: '+JSON.stringify(Object.values(e1.when)[0]));

  // add from the library
  const n0=(await page.$$('#director-panel .people-row')).length;
  await click('#director-panel [data-action="pe-add"]');await until(()=>page.$('#people-library[open] .pl-card'),'the people library opens');
  await snap('03-library');
  check(await page.$$eval('#people-library .pl-card',l=>l.length>=40),'the library lists the built people');
  await page.evaluate(()=>{[...document.querySelectorAll('#people-library [data-pe-filter="stance"]')].find(b=>b.dataset.peValue==='wheelchair').click();});
  await until(async()=>{const n=await page.$$eval('#people-library .pl-card',l=>l.length);return n>0&&n<150;},'the library filters by posture');
  await page.evaluate(()=>{[...document.querySelectorAll('#people-library .pl-card')].find(b=>/watching|rolling/i.test(b.textContent)).click();});
  await until(async()=>(await page.$$('#director-panel .people-row')).length===n0+1,'the added person is listed');
  await until(async()=>(await live()).some(p=>/wheel/.test(p.id)&&p.visible),'the added person is on the stage');
  passed.push('a person added from the library stands in front of the camera');
  await snap('04-added');

  // undo takes them out again; hide keeps the entry
  await click('[data-action="undo"]');
  await until(async()=>(await page.$$('#director-panel .people-row')).length===n0,'undo removes the added person');
  passed.push('undo takes the added person out');
  await click('#director-panel .people-row:nth-child(1) .people-eye');
  await until(async()=>(await page.$$('#director-panel .people-row.off')).length===1,'a hidden person stays in the list');
  passed.push('the eye takes a person out of the chapter and keeps the entry');
  await snap('05-end');
  // ---- Export cut -> import -> the film chapter's `people` (temp copy of the chapter)
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const mine=await edits();     // the draft, saved by the export
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8'));check(JSON.stringify(exported.shots[0].peopleEdits)===JSON.stringify(mine),'Export cut carries the cast');
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});fs.copyFileSync(path.join(root,HQ,'review-cut.json'),path.join(H,'review-cut.json'));
  for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='rise')fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const ex=path.join(tmp,'Film-chapter-rise-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex],{stdio:'ignore'});execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H],{stdio:'ignore'});
  const built=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='rise');
  check(JSON.stringify(built.people)===JSON.stringify(peopleFilter(mine)),'the film chapter gets the cast as its people: '+built.people.cast.map(e=>e.key).join(', '));
  check(!errors.length,'no page errors: '+errors.join(' | '));
  console.log('PASS Director people: '+passed.join('; ')+'.');console.log('screenshots: '+shots);
}catch(error){await snap('fail').catch(()=>{});console.error('FAIL after: '+passed.join('; '));console.error(error.message);console.error('status: '+await status(page));console.error('errors: '+errors.join(' | '));console.error('screenshots: '+shots);process.exitCode=1;}
finally{await close();}
