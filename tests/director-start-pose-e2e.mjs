// Director "Starting position" (Chapter tab, experience/start-pose.mjs) end to end (real GPU Chrome; not one of the
// quick tests/cinematic-* checks). Chapter 12 (hero): Max height + Max tilt set the chapter's motion.initial and the
// live stage's desk at 0 s; the first lift leaves the new start without a jump and still reaches its target; each
// click is one undo step, a slider drag is one undo step; Export cut carries it; build-round8-director --import + the
// pass (in a temp copy of the hq dir) write it into review-cut.json, shots/13.json and every sub-shot of
// shots/13-subshots.json, keeping the film's x / z / yaw and every clip.
//
//   node tests/director-start-pose-e2e.mjs        (BASE=http://127.0.0.1:3108 to use a running server)
// SHOTS=<dir> keeps the screenshot of the control (control.png). Downloads go to a temp folder (never ~/Downloads).
// Run it under the browser-test lock (flock /tmp/claude-1000/hq12-stills.lock or scratchpad slot.sh).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf,seek} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='hero');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director start pose e2e: skipped (${HQ} has no hero chapter page in this checkout).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-start-pose-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const near=(a,b,eps=.06)=>Math.abs(a-b)<=eps;
try{
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await openChapter(page,base,chapter);
  const status=()=>statusOf(page);
  const stage=()=>page.evaluate(()=>{const s=document.getElementById('stage').contentWindow.ErgoPresentation.snapshot();return {height:s.height,tilt:s.tilt};});
  const draftShot=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});
  const fields=()=>page.evaluate(()=>Object.fromEntries(['start-height','start-height-n','start-tilt','start-tilt-n'].map(n=>[n,Number(document.querySelector(`#director-panel [name="${n}"]`)?.value)])));
  const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(700);};
  const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
  const undoOn=()=>page.$eval('#director-panel [data-action=undo]',b=>!b.disabled);

  await click('#director-panel [data-inspector-tab=chapter]');
  const labels=await page.$$eval('#director-panel [data-start-pose-box] button',l=>l.map(b=>b.textContent.trim()));
  const legend=await page.$eval('#director-panel [data-start-pose-box] legend',e=>e.textContent.trim());
  check(legend==='Starting position','Chapter tab has the "Starting position" control');
  check(JSON.stringify(labels)===JSON.stringify(['Max height','Min height','Flat (0°)','Max tilt','Sitting','Standing','Use current']),'buttons: '+labels.join(' · '));
  const limits=await page.$eval('#director-panel [name="start-height"]',e=>[e.min,e.max]).then(async h=>[h,await page.$eval('#director-panel [name="start-tilt"]',e=>[e.min,e.max])]);
  check(limits[0].join()==='28,52.5'&&limits[1].join()==='-5,65',`slider ranges: height ${limits[0].join('–')}″, tilt ${limits[1].join('–')}°`);
  await seek(page,0);const before=await stage(),f0=await fields();
  check(near(before.height,f0['start-height'])&&near(before.tilt,f0['start-tilt']),`the control opens on the film's start (${f0['start-height']}″ / ${f0['start-tilt']}°; stage ${before.height.toFixed(2)}″ / ${before.tilt.toFixed(2)}°)`);
  const hadUndo=await undoOn();

  // ---- Max height, Max tilt: the stage's desk at 0 s
  await click('#director-panel [data-start-pose=max-height]');
  await click('#director-panel [data-start-pose=max-tilt]');
  const f1=await fields(),s1=await stage();
  check(f1['start-height']===52.5&&f1['start-height-n']===52.5&&f1['start-tilt']===65&&f1['start-tilt-n']===65,'fields read 52.5″ / 65° (slider and number)');
  check(near(s1.height,52.5)&&near(s1.tilt,65),`stage at 0 s: ${s1.height.toFixed(2)}″ / ${s1.tilt.toFixed(2)}°`);
  check(/Starting position: Max tilt|unchanged/.test(await status()),'status: '+await status());
  let d=await draftShot();check(d?.motion?.initial?.height===52.5&&d.motion.initial.tilt===65,'draft keeps motion.initial 52.5 / 65');
  await page.$eval('#director-panel [data-start-pose-box]',e=>e.scrollIntoView({block:'center'}));await wait(600);
  await (await page.$('#director-panel [data-start-pose-box]')).screenshot({path:path.join(shots,'control.png'),captureBeyondViewport:false});

  // ---- the clips play on from the new start: no jump into the first lift, its target still reached
  const lifts=d.motion.clips.filter(c=>c.lane==='lift').sort((a,b)=>a.start-b.start),L1=lifts[0];
  await seek(page,Math.max(0,L1.start-.05));const pre=await stage();
  await seek(page,L1.start+.05);const into=await stage();
  check(near(pre.height,52.5)&&Math.abs(into.height-52.5)<=Math.abs(L1.target-52.5)*.1+.05,`first lift (${L1.start}s → ${L1.target}″) leaves 52.5″ smoothly: ${pre.height.toFixed(2)} → ${into.height.toFixed(2)}″`);
  await seek(page,L1.start+L1.duration+.05);const done=await stage();
  check(near(done.height,L1.target),`first lift reaches its target ${L1.target}″ (${done.height.toFixed(2)}″)`);
  const T1=d.motion.clips.filter(c=>c.lane==='tilt').sort((a,b)=>a.start-b.start)[0];
  if(T1){await seek(page,T1.start+T1.duration+.05);const t=await stage();check(near(t.tilt,T1.target),`first tilt reaches its target ${T1.target}° (${t.tilt.toFixed(2)}°)`);}

  // ---- one undo step per click; a slider drag is one step
  await click('#director-panel [data-action=undo]');
  await seek(page,0);const u=await stage();d=await draftShot();
  const tiltWasMax=f0['start-tilt']===65;
  check(tiltWasMax?near(u.height,f0['start-height'])&&d.motion.initial.height===f0['start-height']:d.motion.initial.tilt===f0['start-tilt']&&d.motion.initial.height===52.5,`one Undo takes back one click (${d.motion.initial.height}″ / ${d.motion.initial.tilt}°; stage ${u.height.toFixed(2)}″)`);
  if(tiltWasMax){check(!(await undoOn())===!hadUndo,'Max tilt on a desk already at 65° made no undo step');}
  await click('#director-panel [data-action=redo]');if(!tiltWasMax)await click('#director-panel [data-action=redo]');
  d=await draftShot();check(d.motion.initial.height===52.5&&d.motion.initial.tilt===65,'Redo brings back 52.5 / 65');
  await click('#director-panel [data-inspector-tab=chapter]');
  await page.evaluate(async()=>{const el=document.querySelector('#director-panel [name="start-height"]');el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));for(const v of [51,49,47,45.5]){el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,60));}el.dispatchEvent(new Event('change',{bubbles:true}));});
  await wait(600);d=await draftShot();const dragged=d.motion.initial;
  check(dragged.height===45.5&&dragged.tilt===65,`slider drag to 45.5″ keeps 65° (above the 60″ desk's 42.5″ clearance): ${dragged.height}″ / ${dragged.tilt}°`);
  await page.evaluate(()=>{const el=document.querySelector('#director-panel [name="start-height-n"]');el.value='30';el.dispatchEvent(new Event('change',{bubbles:true}));});await wait(600);
  d=await draftShot();check(d.motion.initial.height===30&&d.motion.initial.tilt<65&&d.motion.initial.tilt>=39,`typing 30″ lowers the tilt to the desk's clearance (${d.motion.initial.tilt}°)`);
  await click('#director-panel [data-action=undo]');d=await draftShot();check(d.motion.initial.height===45.5&&d.motion.initial.tilt===65,'Undo the typed height');
  await click('#director-panel [data-action=undo]');d=await draftShot();check(d.motion.initial.height===52.5&&d.motion.initial.tilt===65,'one Undo takes back the whole slider drag');
  await seek(page,0);const s2=await stage();check(near(s2.height,52.5)&&near(s2.tilt,65),`stage back at 52.5″ / 65° (${s2.height.toFixed(2)} / ${s2.tilt.toFixed(2)})`);

  // ---- Export cut -> --import + pass (temp hq copy): review-cut, shots/13.json and every sub-shot
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8')),es=exported.shots[0];
  check(es.motion?.initial?.height===52.5&&es.motion.initial.tilt===65,'Export cut carries motion.initial 52.5 / 65');
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  fs.copyFileSync(path.join(root,HQ,'review-cut.json'),path.join(H,'review-cut.json'));
  let heroFile=null;for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='hero'){heroFile=f;fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));}
  fs.copyFileSync(path.join(root,HQ,'shots','13-subshots.json'),path.join(H,'shots','13-subshots.json'));
  const read=f=>JSON.parse(fs.readFileSync(path.join(H,f),'utf8'));
  const old=read('review-cut.json').shots.find(s=>s.id==='hero').motion,oldSubs=read('shots/13-subshots.json').shots.map(s=>s.motion);
  const ex=path.join(tmp,'Film-chapter-hero-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  const tool=path.join(root,'tools/experience/build-round8-director.py');
  execFileSync('python3',[tool,H,'--import',ex],{stdio:'ignore'});const log=execFileSync('python3',[tool,H],{encoding:'utf8'});
  check(/starting position 43\.5" \/ 65 deg -> 52\.5" \/ 65 deg/.test(log),'the pass logs the new starting position');
  check(read('director-camera-hero.json').initial?.height===52.5,'director-camera-hero.json keeps initial {height: 52.5, tilt: 65}');
  const same=(a,b)=>a.x===b.x&&a.z===b.z&&a.yaw===b.yaw;
  const rc=read('review-cut.json').shots.find(s=>s.id==='hero').motion;
  check(rc.initial.height===52.5&&rc.initial.tilt===65&&same(rc.initial,old.initial),`review-cut.json hero motion.initial ${JSON.stringify(rc.initial)}`);
  check(JSON.stringify(rc.clips.map(c=>[c.id,c.target,c.start,c.duration]))===JSON.stringify(old.clips.map(c=>[c.id,c.target,c.start,c.duration])),'review-cut.json hero clips unchanged (ids, targets, timing)');
  if(heroFile){const sh=read('shots/'+heroFile).motion;check(sh.initial.height===52.5&&sh.initial.tilt===65,`shots/${heroFile} motion.initial ${sh.initial.height} / ${sh.initial.tilt}`);}
  const subs=read('shots/13-subshots.json').shots;
  check(subs.length===6&&subs.every((s,i)=>s.motion.initial.height===52.5&&s.motion.initial.tilt===65&&same(s.motion.initial,oldSubs[i].initial)),`every sub-shot of 13-subshots.json (${subs.map(s=>s.subshot).join('')}) starts at 52.5 / 65`);
  check(subs.every((s,i)=>JSON.stringify(s.renderRange)===JSON.stringify(read('shots/13-subshots.json').shots[i].renderRange)),'sub-shot renderRanges kept');
  check(!fs.readdirSync(path.join(os.homedir(),'Downloads')).some(f=>/^Film-chapter-hero/.test(f)&&fs.statSync(path.join(os.homedir(),'Downloads',f)).mtimeMs>Date.now()-600000),'nothing written to ~/Downloads');
  check(errors.length===0,'no page errors'+(errors.length?': '+errors.slice(0,3).join(' | '):''));
}catch(error){failures.push(error.message);console.log('FAIL',error.stack);}
finally{await close();}
console.log(failures.length?`\nDirector start pose e2e: ${failures.length} failure(s).`:'\nDirector start pose e2e: all checks passed.');
process.exit(failures.length?1:0);
