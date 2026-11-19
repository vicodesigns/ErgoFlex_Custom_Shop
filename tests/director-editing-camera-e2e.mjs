// The Director's Editing camera, end to end (19 Nov 2026, real GPU Chrome, the coast chapter of the Cinematographer's cut).
// Vico: "I want to move around without the camera changing on me … play back everything and my camera stays put …
// Then I can toggle that off and go back to the camera as it's supposed to play in the scene."
//   1. the app bar's Editing camera turns it on: its button, the status pill and the pill on the view say so
//   2. the view moved by hand (a right-drag orbit), then the chapter played from 0 to 5 s: the camera stays on the held
//      view at every sample while the playhead runs and the desk rises (the lift starts at 3.6 s)
//   3. off: the camera is back on the keys at the playhead (the same view a seek there gives)
//   4. the cut is untouched: the camera keys are as they were, Export cut carries no trace of it
//   5. pose mode: the pose bar offers "Hold camera while posing" (one click turns it on: "● Camera held")
//   6. the preference survives a reload (on), and Shift+C turns it off
//   node tests/director-editing-camera-e2e.mjs        (CUT=<cut dir>, default the Cinematographer's; SHOTS=<dir>)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf,watchStage,ensureLivePeople,pickInView} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='coast'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`editing camera e2e: skipped (${CUT} has no coast chapter page here).`);process.exit(0);}
const film=JSON.parse(fs.readFileSync(path.join(root,chapter.shot.replace(/^\//,'')),'utf8'));
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'editing-camera-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser(),warnings=watchStage(page);
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);return ok;};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(200);}};
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const view=()=>page.evaluate(()=>{const t=document.getElementById('stage').contentWindow.ErgoPresentation.three();return {p:t.camera.position.toArray(),t:t.controls.target.toArray(),fov:t.camera.fov};});
const far=(a,b)=>Math.max(...a.p.map((v,i)=>Math.abs(v-b.p[i])),...a.t.map((v,i)=>Math.abs(v-b.t[i])),Math.abs(a.fov-b.fov)/100);
const heldNow=()=>page.evaluate(()=>!!document.getElementById('stage').contentWindow.ErgoPresentation.cameraHeld?.());
const deskHeight=()=>page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.deskHeight);
const playhead=()=>page.evaluate(()=>Number(document.querySelector('#director-timeline [name="timeline-seconds"]')?.value));
const keysNow=()=>page.evaluate(`(()=>{try{const b=document.body.dataset;const f=JSON.parse(localStorage.getItem('ergoflex.director.filmDrafts.v1')||'{}');const c=f[b.cutId]?.cut;return JSON.stringify(c?.shots?.[0]?.camera??null);}catch{return null;}})()`);
try{
  await page.evaluateOnNewDocument(()=>{window.__exports=[];const make=URL.createObjectURL;URL.createObjectURL=function(b){if(b instanceof Blob&&b.type==='application/json')b.text().then(t=>window.__exports.push(t));return make.call(this,b);};});
  await openChapter(page,base,chapter);await seek(page,0);
  await click('#director-panel [data-inspector-tab="people"]');await ensureLivePeople(page,{id:'coast',filmPeople:film.people,warnings});
  const keys0=await keysNow();
  // ---- 1. on
  check(!!await page.$('#director-appbar [data-action="hold-camera"]'),'the app bar has an Editing camera button');
  await click('#director-appbar [data-action="hold-camera"]');
  await until(heldNow,'the stage holds the camera');
  check(await page.$eval('#director-appbar [data-action="hold-camera"]',b=>b.getAttribute('aria-pressed')==='true'&&/● Editing camera/.test(b.textContent)),'1. on: the app bar button says "● Editing camera"');
  check(await until(()=>page.$('[data-sb-pill="held"]'),'the status pill',3000).then(()=>true,()=>false),'1. the status bar has its pill');
  check(await until(()=>page.evaluate(()=>{const p=document.querySelector('.nav-pill');return p&&!p.hidden&&/Editing camera/.test(p.textContent);}),'the pill on the view',3000).then(()=>true,()=>false),'1. and the view says it ("● Editing camera · the view stays put")');
  check(/Editing camera on/.test(await statusOf(page)),'1. status: '+await statusOf(page));
  // ---- 2. move the view by hand, play 0 → 5 s
  const box=await page.$eval('#stage',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.55};});
  await page.mouse.move(box.x,box.y);await page.mouse.down({button:'right'});for(let i=1;i<=8;i++){await page.mouse.move(box.x+i*15,box.y-i*3);await wait(25);}await page.mouse.up({button:'right'});await wait(400);
  const heldView=await view();await shot('01-held-on');
  const h0=await deskHeight();
  await click('#director-appbar [data-action="chapter-toggle"]');
  let worst=0,samples=0,t0=Date.now();
  while(Date.now()-t0<5200){await wait(200);worst=Math.max(worst,far(await view(),heldView));samples++;}
  await click('#director-appbar [data-action="chapter-toggle"]');await wait(600);
  const t1=await playhead(),h1=await deskHeight();
  // a seek while held leaves the view too; it also puts the playhead on an exact time for the comparison below
  const T=5;await seek(page,T);check(far(await view(),heldView)<1e-4,`2. a seek (to ${T} s) leaves the held view alone`);
  check(t1>3.8,`2. the chapter played (the playhead at ${t1.toFixed(2)} s)`);
  check(h1>h0+.2,`2. the desk rose meanwhile (${h0} → ${h1} in)`);
  check(worst<1e-4,`2. the camera stayed on the held view at all ${samples} samples (largest difference ${worst.toExponential(1)})`);
  await shot('02-after-play-held');
  // ---- 3. off: back on the keys at the playhead
  await click('#director-appbar [data-action="hold-camera"]');await until(async()=>!await heldNow(),'the hold off');await wait(300);
  const back=await view();
  check(far(back,heldView)>.01,`3. off: the view leaves the held one (${far(back,heldView).toFixed(3)})`);
  // (the same time both ways: the playhead was put on T exactly; Windows, 19 Nov 2026, compared the stage's last frame
  // with a seek to the field's rounded seconds)
  await seek(page,T);await wait(300);const keyed=await view();
  check(far(back,keyed)<1e-3,`3. and is the keys' view at the playhead (Δ ${far(back,keyed).toExponential(1)} from a seek to ${T} s)`);
  check(!await page.$('[data-sb-pill="held"]')&&await page.$eval('#director-appbar [data-action="hold-camera"]',b=>b.getAttribute('aria-pressed')==='false'),'3. its pill is gone, the button off');
  await shot('03-off');
  // ---- 4. the cut untouched; Export cut carries nothing of it
  check((await keysNow())===keys0,'4. the camera keys are as they were (the draft\'s camera unchanged)');
  await click('#director-appbar [data-action="hold-camera"]');await until(heldNow,'on again');
  await click('#director-appbar [data-action="save-export"]');
  const sent=await until(()=>page.evaluate(()=>window.__exports.at(-1)||null),'the export',20000).catch(()=>null);
  if(sent)check(!/holdCamera|Editing camera/i.test(sent),'4. Export cut (with it on) carries no trace of it');
  else check(true,'4. (Export cut not needed: nothing to export, the cut unchanged)');
  // ---- 5. the pose bar's one-click hint
  await click('#director-appbar [data-action="hold-camera"]');await until(async()=>!await heldNow(),'off for the pose check');
  await seek(page,0);await wait(800);
  const ava=await until(async()=>{const v=await pickInView(page,'person');return v.found?.find(p=>p.featured&&/^people-ava-sit-type/.test(p.id))||null;},'Ava in the picture at 0 s');
  await page.mouse.click(ava.x,ava.y,{clickCount:2,count:2,delay:40});
  await until(()=>page.$('#director-panel .people-pose-bar'),'pose mode');
  check(/Hold camera while posing/.test(await page.$eval('#director-panel .people-pose-bar',e=>e.textContent)),'5. the pose bar offers "Hold camera while posing" (not turned on by itself)');
  check(!await heldNow(),'5. entering pose mode did not turn it on');
  await click('#director-panel .people-pose-bar [data-action="hold-camera"]');await until(heldNow,'one click holds it');
  check(await until(async()=>/● Camera held/.test(await page.$eval('#director-panel .people-pose-bar',e=>e.textContent).catch(()=>'')),'the pose bar says so',5000).then(()=>true,()=>false),'5. one click: "● Camera held"');
  await shot('04-pose-held');
  await click('#director-panel [data-action="pe-pose-done"]');await wait(400);
  // ---- 6. kept across a reload; Shift+C turns it off
  await page.reload();await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});await wait(1500);
  check(await until(heldNow,'held after the reload',15000).then(()=>true,()=>false),'6. after a reload it is still on (a per-browser preference), and says so');
  check(await page.$eval('#director-appbar [data-action="hold-camera"]',b=>b.getAttribute('aria-pressed')==='true'),'6. the app bar shows it on');
  await page.evaluate(()=>{document.activeElement?.blur?.();window.focus();});   // (the Director's page has the keys, not a field)
  await page.keyboard.down('Shift');await page.keyboard.press('KeyC');await page.keyboard.up('Shift');
  check(await until(async()=>!await heldNow(),'Shift+C off',5000).then(()=>true,()=>false),'6. Shift+C turns it off');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){await shot('99-failed');check(false,error.message);}
finally{await close();}
console.log(failures.length?`FAIL editing camera e2e: ${failures.length} (shots in ${SHOTS})`:`PASS editing camera e2e (shots in ${SHOTS})`);
process.exitCode=failures.length?1:0;
