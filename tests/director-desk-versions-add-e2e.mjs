// Director "Desk versions": more desks than the film's six, and fewer, end to end (real GPU Chrome; run under the
// browser-test gate). Chapter 12 (hero): the + in the Desk versions lane adds a copy of the picked desk (Gaming) at the
// end as G: seven segments, the badge and the live stage follow it, its window halves the last desk's; Undo / Redo are
// one step; Duplicate puts a copy right after its source; a drag reorders the longer lane (ids travel with the desk);
// rename and the seam work on the new desk; Render still inside G renders the gaming build; Export cut carries seven
// versions and the importer + pass write seven sub-shots (renderRanges as exported, the film shot's map and presets)
// in a temp copy; Remove takes desks away down to one (the film's own too); Reset brings the film's six back, and
// the next desk added does not get an id that was used before.
//   node tests/director-desk-versions-add-e2e.mjs      (BASE=http://127.0.0.1:<port> to use a running server; SHOTS=<dir> keeps pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='hero');
if(!chapter||!fs.existsSync(path.join(root,HQ,'director-film','hero-subshots.json'))){console.log(`Director desk versions add e2e: skipped (${HQ} has no hero chapter or director-film/hero-subshots.json).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-desk-versions-add-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=120000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const lane=()=>page.$$eval('#director-timeline [data-desk-version]',b=>b.map(x=>({n:x.dataset.deskVersion,text:x.querySelector('strong').textContent,left:parseFloat(x.style.left),width:parseFloat(x.style.width),picked:x.classList.contains('picked')})));
const laneText=async()=>(await lane()).map(x=>x.text).join(', ');
const badge=()=>page.$eval('.desk-version-badge',e=>e.hidden?'':e.textContent).catch(()=>'');
const draft=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});
const versions=async()=>(await draft())?.deskVersions||null;
const wood=()=>page.evaluate(()=>document.getElementById('stage').contentWindow.ErgoFlex.currentConfig.woodFinish);
const settled=()=>page.evaluate(()=>!document.body.classList.contains('loading')&&!/^Switching/.test(document.querySelector('#director-panel [data-status]')?.textContent||''));
const playhead=()=>page.$eval('#director-timeline [name="timeline-seconds"]',e=>Number(e.value));
const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(500);};
const title=sel=>page.$eval(sel,e=>e.title).catch(()=>'');
const laneBox=()=>page.$eval('.desk-versions-lane',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
async function drag(from,to,steps=12){await page.mouse.move(from.x,from.y);await page.mouse.down();for(let i=1;i<=steps;i++){await page.mouse.move(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps);await wait(20);}await page.mouse.up();await wait(600);}
// Seek and wait until the stage has the desk the badge names.
// (the switch starts up to 220 ms after the seek; `top`: the desktop finish the stage must show)
// A seek is refused while the stage is still switching desks: wait for it, and seek again if the playhead did not move.
async function at(t,label,top=null){
  for(let i=0;i<6;i++){await wait(500);await until(settled,'the stage settles before the seek');await seek(page,t);if(Math.abs(await playhead()-t)<.06)break;}
  await wait(400);await until(async()=>await settled()&&await badge()===label&&(!top||await wood()===top),`${label} at ${t} s (playhead ${await playhead()} s, badge "${await badge()}", top ${await wood()})`);await wait(900);await until(settled,'the stage settles');
}
try{
  await openChapter(page,base,chapter);
  check((await laneText())==='A · Gaming, B · Artist, C · Office, D · HBHS, E · OCC, F · Architect','the film\'s six: '+await laneText());
  await at(2,'Desk A · Gaming');const gaming=await wood();
  await at(44,'Desk F · Architect');const architect=await wood();
  check(gaming&&architect&&gaming!==architect,`the stage shows the gaming top at 2 s (${gaming}) and the architect's at 44 s (${architect})`);

  // ---- the controls: + in the lane's label, + Desk version / Duplicate / Remove in the Desk version tab, each with a tooltip
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="A"]').click());await wait(600);
  check(await page.$eval('#director-panel [data-inspector-tab="version"]',b=>b.getAttribute('aria-pressed')==='true').catch(()=>false),'clicking Gaming opens the Desk version tab');
  const tips={lane:await title('#director-timeline [data-dv-add]'),add:await title('#director-panel [data-dv-add]'),dup:await title('#director-panel [data-dv-duplicate]'),remove:await title('#director-panel [data-dv-remove]')};
  check(/copy of Desk A · Gaming/.test(tips.lane)&&/at the end/.test(tips.lane)&&/Desk F · Architect/.test(tips.lane)&&/Undo/.test(tips.lane),'the lane\'s + says what it will do: '+tips.lane);
  check(/copy of Desk A · Gaming/.test(tips.add)&&/right after it/.test(tips.dup)&&/Remove Desk A · Gaming/.test(tips.remove)&&/Desk B · Artist/.test(tips.remove),'the tab\'s buttons have tooltips: '+tips.dup+' / '+tips.remove);
  check(await page.$eval('#director-panel [data-dv-add]',b=>b.textContent)==='+ Desk version'&&await page.$eval('#director-timeline [data-dv-add]',b=>b.getAttribute('aria-label'))==='Add a desk version','+ Desk version in the tab, + (Add a desk version) on the lane');
  await page.screenshot({path:path.join(shots,'1-controls.png')});

  // ---- + on the lane: Gaming again, at the end
  await click('#director-timeline [data-dv-add]');
  await until(async()=>(await lane()).length===7,'seven segments');
  check((await laneText())==='A · Gaming, B · Artist, C · Office, D · HBHS, E · OCC, F · Architect, G · Gaming','seven segments: '+await laneText());
  let dv=await until(versions,'the draft keeps the list');
  check(dv.length===7&&dv[6].n==='G'&&dv[6].preset==='gaming'&&dv[6].start===40.6&&dv[6].end===48&&dv[5].start===33.4&&dv[5].end===41.2&&JSON.stringify(dv.slice(0,5).map(v=>[v.start,v.end]))==='[[0,5.3],[4.7,13.1],[12.5,21.9],[21.3,27.7],[27.1,34]]',
    `G takes the second half of F's time: F ${dv[5].start}–${dv[5].end}, G ${dv[6].start}–${dv[6].end}; the others keep theirs`);
  check((await draft()).deskVersionsLast==='G','the cut remembers G as the highest id handed out');
  check(Math.abs(await playhead()-40.91)<.06,`the playhead goes to the new desk (${await playhead()} s)`);
  await until(async()=>await settled()&&await badge()==='Desk G · Gaming','the badge names G');await wait(1500);await until(settled,'settled');
  check(await badge()==='Desk G · Gaming'&&await wood()===gaming,`at ${await playhead()} s the frame reads "${await badge()}" and the stage shows the gaming top (${await wood()})`);
  const said=await statusOf(page);
  check(/^Desk G · Gaming added at the end, a copy of Desk A: it shows 40\.9–48 s and Desk F · Architect now 33\.7–40\.9 s\./.test(said),'status: '+said);
  const subtitle=await page.$eval('#director-panel [data-inspector-page="version"] .inspector-subtitle',e=>e.textContent).catch(()=>'');
  check((await lane()).find(x=>x.n==='G')?.picked&&subtitle==='G · Gaming',`G is the picked desk in the lane (${(await lane()).filter(x=>x.picked).map(x=>x.n).join()||'none'}) and the tab ("${subtitle}")`);
  check(await page.$$eval('#director-timeline .desk-version-fade',e=>e.length)===6&&await page.$$eval('#director-timeline [data-desk-seam]',e=>e.length)===6,'six crossfades, six seams');
  await page.screenshot({path:path.join(shots,'2-seven.png')});
  // the live desk follows the lane: F is the architect, G the gamer again
  await at(38,'Desk F · Architect',architect);check(await wood()===architect,`38 s: F · Architect on the stage (${await wood()})`);
  await at(45,'Desk G · Gaming',gaming);check(await wood()===gaming,`45 s: G · Gaming on the stage (${await wood()})`);
  check(!/could not/.test(await statusOf(page)),'status: '+await statusOf(page));

  // ---- Undo / Redo: one step
  await click('#director-panel [data-action=undo]');check((await lane()).length===6&&!(await versions()),'Undo takes the new desk back in one step');
  await click('#director-panel [data-action=redo]');check((await laneText()).endsWith('F · Architect, G · Gaming'),'Redo brings it back: '+await laneText());

  // ---- Duplicate: a copy of B right after it; then Undo
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="B"]').click());await wait(600);
  await click('#director-panel [data-dv-duplicate]');
  await until(async()=>(await lane()).length===8,'eight segments');
  dv=await until(async()=>{const v=await versions();return v?.length===8&&v;},'draft with eight');
  check((await laneText()).startsWith('A · Gaming, B · Artist, H · Artist, C · Office')&&dv[1].end===9.2&&dv[2].start===8.6&&dv[2].end===13.1,`Duplicate: ${await laneText()} (B ${dv[1].start}–${dv[1].end}, H ${dv[2].start}–${dv[2].end})`);
  check(/^Desk H · Artist added after Desk B, a copy of Desk B/.test(await until(async()=>await settled()&&await statusOf(page),'status')),'status: '+await statusOf(page));
  await page.screenshot({path:path.join(shots,'3-eight.png')});
  await click('#director-panel [data-action=undo]');check((await lane()).length===7,'Undo: seven again');

  // ---- reorder the longer lane: G to the front and back to the end; a desk keeps its id
  const mid=(L,s)=>({x:L.x+(s.left+s.width/2)/100*L.w,y:L.y+L.h/2});
  let L=await laneBox(),segs=await lane();
  await drag(mid(L,segs[6]),mid(L,segs[0]));
  check((await laneText())==='G · Gaming, A · Gaming, B · Artist, C · Office, D · HBHS, E · OCC, F · Architect','G dragged to the front: '+await laneText());
  check(JSON.stringify((await lane()).map(s=>[s.left,s.width]))===JSON.stringify(segs.map(s=>[s.left,s.width])),'the time windows stay where they were');
  L=await laneBox();segs=await lane();await drag(mid(L,segs[0]),mid(L,segs[6]));
  check((await laneText())==='A · Gaming, B · Artist, C · Office, D · HBHS, E · OCC, F · Architect, G · Gaming','and back to the end: '+await laneText());

  // ---- rename G, move its seam (40.9 -> about 43)
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="G"]').click());await wait(600);
  await page.click('#director-panel [name="dv-name"]',{clickCount:3});await page.keyboard.type('Gaming finale');await page.keyboard.press('Tab');await wait(600);
  check((await laneText()).endsWith('G · Gaming finale'),'renamed on the lane: '+await laneText());
  L=await laneBox();await drag({x:L.x+40.9/48*L.w,y:L.y+L.h/2},{x:L.x+43/48*L.w,y:L.y+L.h/2});
  dv=await until(async()=>{const v=await versions();return v&&v[6].start>41&&v;},'the seam moved');
  check(Math.abs(dv[6].start-42.7)<.2&&Math.abs(dv[5].end-dv[6].start-.6)<.02,`seam F|G dragged: F ends ${dv[5].end}, G starts ${dv[6].start} (0.6 s crossfade kept)`);

  // ---- Render still inside G: the gaming build
  await at(46,'Desk G · Gaming finale');
  await page.evaluate(()=>document.querySelector('.film-tools [data-action=render-still]').click());
  await page.waitForFunction(()=>/Still rendered|Render still failed/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  const still=await page.evaluate(()=>document.querySelector('iframe[title="Film still renderer"]')?.contentWindow?.ErgoFlex?.currentConfig?.woodFinish||'none');
  check(/Still rendered/.test(await statusOf(page))&&still===gaming,`46 s Render still uses the gaming build (${still}): ${await statusOf(page)}`);
  if(process.env.SHOTS){const url=await page.$eval('#film-still img',i=>i.src).catch(()=>null);if(url?.startsWith('data:'))fs.writeFileSync(path.join(shots,'4-still-46s-G.jpg'),Buffer.from(url.split(',')[1],'base64'));}

  // ---- Export cut: seven versions
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await click('#director-panel [data-action=save-export]');
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download',30000);
  const exFile=path.join(downloads,file),exShot=JSON.parse(fs.readFileSync(exFile,'utf8')).shots[0],ex=exShot.deskVersions;
  check(Array.isArray(ex)&&ex.length===7&&ex.map(v=>v.n).join('')==='ABCDEFG'&&ex[6].preset==='gaming'&&ex[6].name==='Gaming finale'&&exShot.deskVersionsLast==='G','Export cut: shot.deskVersions '+JSON.stringify(ex?.map(v=>`${v.n} ${v.preset} ${v.start}-${v.end}`)));

  // ---- importer + pass in a temp copy: seven sub-shots
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json','director-camera-hero.json','titles-src.json'])if(fs.existsSync(path.join(root,HQ,f)))fs.copyFileSync(path.join(root,HQ,f),path.join(H,f));
  for(const f of ['13.json','13-subshots.json'])fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const script=path.join(root,'tools/experience/build-round8-director.py'),film0=JSON.parse(fs.readFileSync(path.join(root,HQ,'shots','13-subshots.json'),'utf8')).shots;
  execFileSync('python3',[script,H,'--import',exFile],{cwd:root,stdio:['ignore','pipe','pipe']});
  check(JSON.parse(fs.readFileSync(path.join(H,'director-camera-hero.json'),'utf8')).versions?.length===7,'importer: director-camera-hero.json has seven `versions`');
  execFileSync('python3',[script,H],{cwd:root,stdio:['ignore','pipe','pipe']});
  const sub=JSON.parse(fs.readFileSync(path.join(H,'shots','13-subshots.json'),'utf8')).shots,cut=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='hero');
  check(sub.length===7&&sub.map(s=>s.subshot).join('')==='ABCDEFG'&&sub.map(s=>s.preset).join()==='gaming,artist,office,hbhs,occ,architect,gaming','13-subshots.json: seven sub-shots '+sub.map(s=>s.subshot+'='+s.preset).join(' '));
  check(sub.every((s,i)=>s.renderRange[0]===ex[i].start&&s.renderRange[1]===ex[i].end)&&sub[0].renderRange[0]===0&&sub[6].renderRange[1]===cut.seconds,'renderRanges are the export\'s: '+sub.map(s=>s.renderRange.join('–')).join(' '));
  check(sub.slice(1).every((s,i)=>Math.abs(sub[i].renderRange[1]-s.renderRange[0]-.6)<.011),'each pair overlaps 0.6 s (the crossfades)');
  const strip=s=>{const {subshot,renderRange,name,...rest}=s;return JSON.stringify(rest);};
  check(sub[6].name==='Gaming finale'&&strip(sub[6])===strip(sub[0])&&strip(sub[0])===strip(film0[0]),'G is the film\'s gaming sub-shot again (model, screens, dressing, kicker, exposure, camera), with its name and window');
  check(JSON.stringify(sub.slice(0,5))===JSON.stringify(film0.slice(0,5)),'A to E are the film\'s sub-shots, untouched');
  check(JSON.stringify(cut.subshots)===JSON.stringify(Object.fromEntries(ex.map(v=>[v.n,[v.start,v.end]])))&&cut.presets.join()===sub.map(s=>s.preset).join(),'film shot: the subshots map has seven entries, presets follow');
  const plan=JSON.parse(execFileSync('python3',[path.join(root,'tools/experience/join-subshots.py'),path.join(H,'shots','13-subshots.json'),tmp,path.join(tmp,'13.mkv'),'--plan']).toString());
  check(plan.inputs.length===7&&plan.fades.length===6&&plan.fades.every(f=>f[0]===.6)&&plan.seconds===cut.seconds,'join plan: 7 renders, 6 crossfades of 0.6 s, '+plan.seconds+' s: '+JSON.stringify(plan.fades));
  fs.writeFileSync(path.join(shots,'subshots-summary.txt'),sub.map(s=>`${s.subshot} ${s.preset} ${s.renderRange} ${s.name||''}`).join('\n'));

  // ---- Remove: G, then one of the film's own (C), then down to one
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="G"]').click());await wait(600);
  await click('#director-panel [data-dv-remove]');
  await until(async()=>(await lane()).length===6,'six segments');
  check((await laneText())==='A · Gaming, B · Artist, C · Office, D · HBHS, E · OCC, F · Architect','G removed: '+await laneText());
  check(/^Desk G · Gaming finale removed: Desk F · Architect now shows 33\.7–48 s\./.test(await until(async()=>await settled()&&await statusOf(page),'status')),'status: '+await statusOf(page));
  await until(async()=>await settled()&&await badge()==='Desk F · Architect'&&await wood()===architect,'F at the playhead, on the stage');
  check(await badge()==='Desk F · Architect'&&await wood()===architect,'the architect is back on the stage where G was');
  await click('#director-panel [data-action=undo]');check((await lane()).length===7,'Undo brings G back in one step');await click('#director-panel [data-action=redo]');
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="C"]').click());await wait(600);
  await click('#director-panel [data-dv-remove]');
  await until(async()=>(await lane()).length===5,'five segments');
  dv=await until(async()=>{const v=await versions();return v?.length===5&&v;},'draft with five');
  check((await laneText())==='A · Gaming, B · Artist, D · HBHS, E · OCC, F · Architect'&&dv[1].end===21.9,`one of the film's own (C · Office) removed: ${await laneText()}; B stays on until ${dv[1].end}`);
  for(let i=0;i<4;i++){await click('#director-panel [data-dv-remove]');await wait(300);}
  await until(async()=>(await lane()).length===1,'one segment');
  check(await page.$eval('#director-panel [data-dv-remove]',b=>b.disabled&&/at least one desk/.test(b.title))&&await page.$$eval('#director-timeline [data-desk-seam]',e=>e.length)===0,'one desk left: Remove is off ("'+await title('#director-panel [data-dv-remove]')+'"), no seams');
  await page.screenshot({path:path.join(shots,'5-one.png')});

  // ---- Reset to the film; the next desk does not get G again
  await click('#director-panel [data-dv-reset]');
  await until(async()=>(await lane()).length===6,'six after Reset');
  check((await laneText())==='A · Gaming, B · Artist, C · Office, D · HBHS, E · OCC, F · Architect'&&!(await versions()),'Reset desk versions to the film: '+await laneText());
  await click('#director-panel [data-dv-add]');
  await until(async()=>(await lane()).length===7,'seven after another add');
  const again=(await lane()).at(-1);check(again.n==='H','the next desk is '+again.text+': G is not handed out a second time');
  await until(settled,'settled');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){failures.push(error.message);console.error(error);await page.screenshot({path:path.join(shots,'failure.png')}).catch(()=>{});}
finally{await close();}
console.log('pictures:',shots);
assert.equal(failures.length,0,failures.join('\n'));
console.log('Director desk versions add e2e: ok');
