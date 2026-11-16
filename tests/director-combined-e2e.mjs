// S31 combined tip check (real Chrome, the harness's own scratch server), storage of the Cinematographer's cut:
// 1. Andre walking (andre-steps-back): the path handles show; a middle point dragged on the floor moves only that point;
//    the gizmo move of his body moves `at` and the path's start by the same delta.
// 2. A path handle selected + Delete removes that point (not Andre).
// 3. Pose mode on andre-phone-up (standing still): the skeleton loads; auto-key OFF -> `pose`; auto-key ON -> a key;
//    that key diamond selected + Delete removes the key.
// 4. Export cut: only storage's `people` and its directorEdited marker differ.
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-combined-e2e.mjs [shots dir]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',H0=path.join(root,CUT),shots=process.argv[2]||null;
const c=JSON.parse(fs.readFileSync(path.join(H0,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='storage');
const src=fs.readFileSync(path.join(H0,'review-cut.json')),cut=JSON.parse(src),film=cut.shots.find(s=>s.id==='storage');
const py=(...a)=>execFileSync('python3',a,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(250);}};
const shot=async(page,name)=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name)});}};
const {base,page,errors,close}=await openDirectorBrowser();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-combined-'));
const W=`document.getElementById('stage').contentWindow`;
// the path points on the page (the stage frame's offset added)
const points=()=>page.evaluate(`(()=>{const f=document.getElementById('stage').getBoundingClientRect(),p=${W}.__directorPeoplePaths?.screenPoints?.();return p&&p.map(q=>({x:q.x+f.left,y:q.y+f.top}));})()`);
const set=(name,value)=>page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);
async function selectRow(key){const i=film.people.cast.findIndex(e=>e.key===key);await page.$eval(`[data-action="pe-row"][data-index="${i}"]`,e=>e.click());await wait(900);}
try{
  await openChapter(page,base,c);
  await page.$eval('[data-inspector-tab="people"]',e=>e.click());await until(()=>page.$('[data-action="pe-row"]'),'the People list');
  // ---- 1. path handles, a middle point, the body
  await seek(page,5);await selectRow('andre-steps-back');
  const pts=await until(points,'the path handles');
  const orig=film.people.cast.find(e=>e.key==='andre-steps-back'),n0=orig.walk.path.length,mid=Math.floor(n0/2);
  assert.equal(pts.length,n0,'a handle per path point');
  await shot(page,'s31-path-1-handles.png');
  await page.mouse.move(pts[mid].x,pts[mid].y);await page.mouse.down();await page.mouse.move(pts[mid].x+10,pts[mid].y+4,{steps:3});await page.mouse.move(pts[mid].x+50,pts[mid].y+30,{steps:8});await page.mouse.up();await wait(900);
  await shot(page,'s31-path-2-point-dragged.png');
  await until(()=>page.evaluate(`!!${W}.__directorPeopleGizmo?.object`),'the gizmo on Andre');
  await page.evaluate(`(()=>{const g=${W}.__directorPeopleGizmo;g.dispatchEvent({type:'dragging-changed',value:true});g.object.position.x+=100;g.dispatchEvent({type:'objectChange'});g.dispatchEvent({type:'dragging-changed',value:false});})()`);
  await wait(900);
  // ---- 2. a handle selected + Delete
  const del=Math.max(1,mid-2),pts2=await points();
  await page.mouse.move(pts2[del].x,pts2[del].y);await page.mouse.down();await page.mouse.up();await wait(400);
  assert.equal(await page.evaluate(`${W}.__directorPeoplePaths.picked()`),del,'the handle is selected');
  await page.keyboard.press('Delete');await wait(800);
  assert.equal((await points())?.length,n0-1,'Delete removed the point');
  // ---- 3. pose mode on a standing person
  await seek(page,9);await selectRow('andre-phone-up');
  await page.$eval('[data-action="pe-pose-enter"]',e=>e.click());
  await until(()=>page.$eval('#director-panel',p=>/Pose mode/.test(p.textContent)&&!/Loading the skeleton/.test(p.textContent)).catch(()=>false),'the skeleton',180000);
  if(await page.$eval('[data-action="pe-key-auto"]',e=>e.getAttribute('aria-pressed'))==='true')await page.$eval('[data-action="pe-key-auto"]',e=>e.click());
  await set('pe-joint','lowerarm_l');await wait(300);await set('pe-rx',25);await wait(700);
  await page.$eval('[data-action="pe-key-auto"]',e=>e.click());await wait(300);
  await seek(page,9.5);await set('pe-joint','lowerarm_r');await wait(300);await set('pe-rx',-20);await wait(700);
  const keys=await page.$$eval('[data-pose-key-row] [data-pose-key]',l=>l.map(e=>Number(e.dataset.poseKey)));assert.deepEqual(keys,[9.5],'auto-key wrote a key at 9.5 s');
  await shot(page,'s31-combined-pose.png');
  await page.$eval('[data-pose-key-row] [data-pose-key]',e=>e.click());await wait(400);
  await page.$eval('[data-pose-key-row]',e=>e.focus?.());await page.keyboard.press('Delete');await wait(700);
  assert.deepEqual(await page.$$eval('[data-pose-key-row] [data-pose-key]',l=>l.length),0,'Delete removed the key');
  await page.$eval('[data-action="pe-key-auto"]',e=>e.click());     // (leave auto-key off)
  // ---- 4. export, import, pass
  const text=await page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-panel [data-action="save-export"]').click();}));
  const H=path.join(tmp,'H');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json','titles-src.json','shots/13-subshots.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(H,f));
  const ex=path.join(tmp,'Film-chapter-storage.json');fs.writeFileSync(ex,text);
  py(path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex);py(path.join(root,'tools/experience/build-round8-director.py'),H);
  const after=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8'));
  for(const s of cut.shots){const a=after.shots.find(x=>x.id===s.id);if(s.id!=='storage'){assert.deepEqual(a,s,s.id+' unchanged');continue;}
    const diff=[...new Set([...Object.keys(a),...Object.keys(s)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(s[k])).sort();assert.deepEqual(diff,['directorEdited','people']);}
  const p=after.shots.find(x=>x.id==='storage').people;
  for(const k of Object.keys(film.people))if(k!=='cast')assert.deepEqual(p[k],film.people[k],'people.'+k);
  const changed=p.cast.filter((e,i)=>JSON.stringify(e)!==JSON.stringify(film.people.cast[i])).map(e=>e.key);
  assert.deepEqual(changed,['andre-steps-back','andre-phone-up'],'only the two edited entries');
  const a=p.cast.find(e=>e.key==='andre-steps-back');
  assert.deepEqual(a.at,[orig.at[0]+100,orig.at[1]],'body: at moved by the delta');
  assert.deepEqual(a.walk.path[0],[orig.walk.path[0][0]+100,orig.walk.path[0][1]],'body: the path start moved with it');
  assert.equal(a.walk.path.length,n0-1,'one point deleted');
  const {walk:w1,at:a1,...r1}=a,{walk:w0,at:a0,...r0}=orig;assert.deepEqual(r1,r0,'andre-steps-back: nothing else changed');
  const {path:p1,...wr1}=w1,{path:p0,...wr0}=w0;assert.deepEqual(wr1,wr0,'the walk settings unchanged');
  const ph=p.cast.find(e=>e.key==='andre-phone-up'),{pose,...rest}=ph;assert.deepEqual(rest,film.people.cast.find(e=>e.key==='andre-phone-up'),'andre-phone-up: only pose');
  assert.ok(pose.lowerarm_l&&!pose.lowerarm_r,'pose has the auto-key-off joint only');
  assert.deepEqual(errors,[],'page errors');
  console.log(`PASS combined: path handles (${n0}), point ${mid} dragged, body +100 mm (at and path start), point ${del} deleted by Delete; pose (auto-key off) and a key (auto-key on) deleted by Delete; only storage people + marker changed`);
}finally{await close();fs.rmSync(tmp,{recursive:true,force:true});}
