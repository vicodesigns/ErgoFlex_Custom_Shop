// People keys select like the camera's diamonds, in a real Chrome (21 Nov 2026, Vico: "when I'm editing the poses I want
// to be able to click on the diamonds and have them be selectable, with the highlighted options shown in the inspector.
// Just like I can click the camera diamonds"). Self-contained (any studio state, any earlier test): opens the cine cut's
// media chapter, finds Omar on the page, writes his pose keys itself (pose mode, Auto-key: 3.2, 6 and 11 s), leaves pose
// mode, and then, with his timeline row folded:
//   1  a click on the folded diamond at 3.2 s: it is selected, the playhead goes to 3.2, the Inspector's KEY · POSE has
//      Time 3.2, pose mode comes on with the pose panel's 3.2 diamond selected (Key at 3.2), the header reads
//      "Pose key · Omar"                                                    (screenshots: 1-before, 2-after)
//   2  the pose panel's 6 s diamond: the timeline and the Inspector follow
//   3  Shift+click adds the 3.2 s diamond, Shift+click again takes it out
//   4  the 11 s diamond dragged to about 12 s (Alt: free) moves the key; Ctrl+Z puts it back
//   5  Esc: no key selected, on the timeline nor in the pose panel
// Every click first checks that the point really reaches the element (elementFromPoint), and says what is on top if not.
//   CHROME=... [STATE_FROM=...] node tests/people-key-select-e2e.mjs [shots dir]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status,watchStage,ensureLivePeople} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',WHO='Omar',KEYS=[3.2,6,11];
const shots=process.argv[2]||path.join(os.tmpdir(),'people-key-select-shots');fs.mkdirSync(shots,{recursive:true});
const chapter=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='media');
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='media');
assert.ok(chapter&&film,'the cine cut has the media chapter');
const T=film.seconds;
const {base,page,errors,close}=await openDirectorBrowser();
const warnings=watchStage(page);
const log=(...a)=>console.log(...a);
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(250);}};
const set=(name,value)=>page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);if(!e)throw Error('no field '+n);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
const act=async name=>{await page.$eval(`#director-panel [data-action="${name}"]`,e=>e.click());await wait(500);};
const shoot=async name=>{await wait(300);const f=path.join(shots,name);await page.screenshot({path:f});log('screenshot',f);};
const playhead=()=>page.$eval('#director-timeline [name="timeline-seconds"]',e=>Number(e.value));
const inspector=()=>page.$eval('[data-ps-inspector]',e=>e.textContent.replace(/\s+/g,' ')).catch(()=>'');
const header=()=>page.$eval('[data-selected-header]',e=>e.textContent.replace(/\s+/g,' ')).catch(()=>'');
const near=(a,b,eps=.03)=>Math.abs(a-b)<=eps;
let ROW=null;
// the folded row's diamonds: [{t, on}]
const dots=()=>page.$$eval(`[data-ps-row="${ROW}"] [data-sk-at]`,l=>l.map(e=>({t:Number(e.dataset.skAt),on:e.classList.contains('selected'),pe:getComputedStyle(e).pointerEvents})));
const dotsOn=async()=>(await dots()).filter(d=>d.on).map(d=>d.t).sort((a,b)=>a-b);
const poseOn=()=>page.$$eval('#director-panel .pose-key.selected',l=>l.map(e=>Number(e.dataset.poseKey)).sort((a,b)=>a-b));
// Bring an element into view inside its scrolling boxes (the timeline: right of the sticky lane labels), then return its
// middle, checked to be what a click there reaches.
async function reach(selector){
  const p=await page.evaluate(sel=>{
    const el=document.querySelector(sel);if(!el)return {why:'no element '+sel};
    el.scrollIntoView({block:'center',inline:'center'});
    const v=el.closest('.timeline-viewport');
    if(v){const r=el.getBoundingClientRect(),b=v.getBoundingClientRect(),label=v.querySelector('.desk-lane-label')?.getBoundingClientRect(),left=label?label.right:b.left,mid=(left+b.right)/2;v.scrollLeft+=r.left+r.width/2-mid;}
    const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);
    if(!top||!(top===el||el.contains(top)))return {why:`${sel} is covered at ${Math.round(x)},${Math.round(y)} by ${top?top.tagName+'.'+[...top.classList].join('.')+(top.dataset&&Object.keys(top.dataset).length?' '+JSON.stringify(top.dataset):''):'nothing'}`};
    const lane=el.parentElement.getBoundingClientRect();return {x,y,left:lane.left,width:lane.width};
  },selector);
  if(p.why)throw Error(p.why);return p;
}
const dotSel=async t=>{const d=(await dots()).reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a,{t:Infinity});if(!near(d.t,t))throw Error(`no diamond near ${t} s on ${WHO}'s row: ${(await dots()).map(x=>x.t).join(', ')}`);return `[data-ps-row="${ROW}"] [data-sk-at="${d.t}"]`;};
async function click(selector,{shift=false}={}){const p=await reach(selector);if(shift)await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);if(shift)await page.keyboard.up('Shift');await wait(700);}
const key=async(combo)=>{const [m,k]=combo.includes('+')?combo.split('+'):[null,combo];if(m)await page.keyboard.down(m);await page.keyboard.press(k);if(m)await page.keyboard.up(m);await wait(700);};
try{
  await page.evaluateOnNewDocument(()=>localStorage.removeItem('ergoflex.director.peopleSheet'));    // every row folded
  await openChapter(page,base,chapter);
  await ensureLivePeople(page,{id:'media',filmPeople:film.people,warnings,log});
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());
  // ---- Omar, wherever this state has him: the People list's row by name
  const person=await until(()=>page.$$eval('#director-panel .people-row[data-person-key]',(l,who)=>{const r=l.find(e=>new RegExp('\\b'+who+'\\b').test(e.textContent));return r?r.dataset.personKey:null;},WHO),`${WHO} in the People list`);
  log('person',person);
  await page.$eval(`#director-panel .people-row[data-person-key="${person}"] [data-action="pe-row"]`,e=>e.click());await wait(800);
  ROW=await until(()=>page.$eval(`#director-timeline [data-person-keys~="${person}"][data-ps-row]`,e=>e.dataset.psRow),`${WHO}'s timeline row`);
  assert.equal(await page.$$eval(`[data-ps-of="${ROW}"]`,l=>l.length),0,'his row is folded');
  // ---- seed: his pose keys at 3.2, 6, 11 s (pose mode, Auto-key), then out of pose mode
  await seek(page,KEYS[0]);await act('pe-pose-enter');
  await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)&&!/Loading the skeleton/.test(p.textContent)),'the skeleton',120000);
  if(await page.$eval('[data-action="pe-key-auto"]',e=>e.getAttribute('aria-pressed'))!=='true')await act('pe-key-auto');
  await set('pe-joint','lowerarm_l');await wait(400);
  for(const [t,deg] of [[KEYS[0],35],[KEYS[1],-10],[KEYS[2],20]]){await seek(page,t);await set('pe-rx',deg);await wait(700);}
  await act('pe-pose-done');
  await until(async()=>(await dots()).length,'his row\'s diamonds');
  for(const t of KEYS)await dotSel(t);          // (throws with the row's diamonds if one is missing)
  // (no Esc here: with nothing selected it would close the Director, player.mjs)
  assert.ok(!/Pose mode/.test(await page.$eval('#director-panel',p=>p.textContent)),'out of pose mode before the click');
  {const d=(await dots()).find(x=>near(x.t,KEYS[0]));assert.ok(!d.on,'not selected yet');assert.notEqual(d.pe,'none','the folded diamond takes clicks');}
  log('seeded',WHO,'pose keys at',KEYS.join(', '),'s · row',ROW);
  // ---- 1 the click
  await seek(page,1);await shoot('s33-me-1-before.png');
  await click(await dotSel(KEYS[0]));
  assert.deepEqual(await dotsOn(),[(await dots()).find(x=>near(x.t,KEYS[0])).t],'click selects the folded diamond');
  assert.ok(near(await playhead(),KEYS[0],.02),'the playhead goes to it: '+await playhead());
  const ins=await inspector();assert.ok(/KEY · POSE/.test(ins),'Inspector: '+ins);
  assert.ok(near(await page.$eval('#director-panel [name="pe-sk-t"]',e=>Number(e.value)),KEYS[0],.001),'Inspector Time 3.2');
  await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)),'pose mode on the key',20000);
  await until(async()=>(await poseOn()).length,'the pose panel\'s key',10000);
  assert.ok((await poseOn()).length===1&&near((await poseOn())[0],KEYS[0],.001),'the pose panel has the 3.2 key selected: '+await poseOn());
  assert.ok(near(await page.$eval('#director-panel [name="pe-key-t"]',e=>Number(e.value)),KEYS[0],.001),'pose panel Key at 3.2');
  {const h=await header();assert.ok(new RegExp('Pose key · '+WHO).test(h)&&/3\.2/.test(h),'header: '+h);}
  await shoot('s33-me-2-after.png');
  log('1 ok: the folded diamond selects; Inspector, pose panel and header show the key');
  // ---- 2 the pose panel's 6 s diamond
  {const t6=await page.$$eval('#director-panel .pose-key[data-pose-key]',l=>l.map(e=>Number(e.dataset.poseKey)));const t=t6.find(x=>near(x,KEYS[1]));assert.ok(t!==undefined,'the pose panel has a 6 s diamond: '+t6);
   await click(`#director-panel .pose-key[data-pose-key="${t}"]`);}
  assert.ok((await poseOn()).length===1&&near((await poseOn())[0],KEYS[1],.001),'pose panel: 6 selected');
  {const on=await dotsOn();assert.ok(on.length===1&&near(on[0],KEYS[1],.001),'the timeline follows the pose panel: '+on);}
  assert.ok(near(await page.$eval('#director-panel [name="pe-sk-t"]',e=>Number(e.value)),KEYS[1],.001),'and the Inspector\'s KEY section');
  log('2 ok: the pose panel and the timeline share the key');
  // ---- 3 Shift+click adds, Shift+click again takes out
  await click(await dotSel(KEYS[0]),{shift:true});
  {const on=await dotsOn();assert.ok(on.length===2&&near(on[0],KEYS[0])&&near(on[1],KEYS[1]),'Shift+click adds: '+on);}
  assert.ok(/2 keys selected/.test(await inspector()),'Inspector: '+await inspector());
  await click(await dotSel(KEYS[0]),{shift:true});
  {const on=await dotsOn();assert.ok(on.length===1&&near(on[0],KEYS[1]),'Shift+click on a selected diamond takes it out: '+on);}
  log('3 ok: Shift adds and takes out');
  // ---- 4 drag 11 -> about 12 s (Alt: free); Ctrl+Z
  {const p=await reach(await dotSel(KEYS[2])),to=p.x+p.width/T;
   await page.keyboard.down('Alt');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+6,p.y,{steps:2});await page.mouse.move(to,p.y,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');await wait(900);}
  {const ts=(await dots()).map(d=>d.t);assert.ok(!ts.some(t=>near(t,KEYS[2],.02))&&ts.some(t=>near(t,KEYS[2]+1,.15)),'dragged to about 12 s: '+ts);}
  await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());await key('Control+z');
  assert.ok((await dots()).some(d=>near(d.t,KEYS[2],.001)),'Ctrl+Z puts it back at 11 s: '+(await dots()).map(d=>d.t));
  log('4 ok: drag moves the key, one undo step');
  // ---- 5 Esc clears both
  await click(await dotSel(KEYS[1]));assert.equal((await dotsOn()).length,1);
  await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());await page.keyboard.press('Escape');await wait(600);
  assert.deepEqual(await dotsOn(),[],'Esc: none on the timeline');assert.deepEqual(await poseOn(),[],'nor in the pose panel');
  log('5 ok: Esc clears both');
  assert.deepEqual(errors,[],'page errors');
  log(`PASS people-key-select-e2e: ${WHO}'s folded diamonds select like the camera's (Inspector, pose panel, header, Shift, drag + undo, Esc) · screenshots in ${shots}`);
}catch(error){
  await page.screenshot({path:path.join(shots,'s33-me-fail.png')}).catch(()=>{});
  console.log('status:',await status(page));if(warnings.length)console.log('page warnings:',warnings.slice(-10).join(' | '));
  throw error;
}finally{await close();}
