// Director "Build" tab for the FEATURED desk, end to end (real GPU Chrome; run under the browser-test gate).
// Chapter 2 (rise, home room) has only the featured desk. The Build tab shows there, "Featured desk" is the default, and
// desktop finish / frame finish / trim colour / accessories (with the shelf each goes on) edit it like the store configurator:
// the stage takes them at once, the draft holds shot.deskBuild, Export cut carries it, and build-round8-director.py puts it in
// the chapter's director-camera file as `build` and onto the film shot as `featuredBuild` (film-fx installFeaturedBuild).
//   node tests/director-featured-build-e2e.mjs        (BASE=http://127.0.0.1:3128 to use a running server; SHOTS=<dir> keeps pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='rise');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director featured build e2e: skipped (${HQ} has no rise chapter page in this checkout).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-featured-build-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(300);};
const tabs=()=>page.$$eval('#director-panel [data-inspector-tab]',b=>b.map(x=>x.textContent.trim()));
const stage=()=>page.evaluate(()=>{const api=document.getElementById('stage').contentWindow.ErgoFlex,c=api.currentConfig,o=api.sceneDesks.active.objects;
  return {wood:c.woodFinish,base:c.baseFinish,trim:c.trimColor,accessories:[...c.accessories],
    placed:Object.fromEntries([...o.entries()].filter(([k,v])=>k.startsWith('accessory-')&&!v.saved.removed).map(([k,v])=>[k.slice(10),{role:v.saved.role,mount:v.obj.parent?.name,visible:v.obj.visible}]))};});
const draft=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});
const pick=(kind,value)=>click(`#director-panel [data-build-pick=${kind}][data-value="${value}"]`);
try{
  await openChapter(page,base,chapter);
  check((await tabs()).includes('Build'),'chapter 2 (rise): the Build tab shows');
  await click('#director-panel [data-inspector-tab=build]');
  const before=await stage();
  check(/Featured desk/.test(await page.$eval('#director-panel [data-inspector-page=build]',e=>e.textContent)),'the panel is for the featured desk');
  check((await page.$$('#director-panel .build-swatch')).length>=30,'swatches for desktop, frame and trim are there');
  check((await page.$$eval('#director-panel [data-build-pick=wood][aria-pressed=true]',b=>b.map(x=>x.title))).join()===before.wood,`the desktop swatch shows the stage's ${before.wood}`);

  await pick('wood','Coast Navy');await pick('base','Terracotta');await pick('trim','#f99239');
  const styled=await until(async()=>{const d=await stage();return d.wood==='Coast Navy'&&d.base==='Terracotta'&&d.trim==='#f99239'?d:null;},'the stage takes the finishes');
  check(!!styled,'stage: Coast Navy / Terracotta / #f99239 (live, no reload)');
  let b=(await draft())?.deskBuild;
  check(b?.woodFinish==='Coast Navy'&&b.baseFinish==='Terracotta'&&b.trimColor==='#f99239'&&!b.accessories,'draft: shot.deskBuild has the three finishes');

  await page.select('#director-panel [name=build-add]','drawing-tablet');await page.select('#director-panel [name=build-add-slot]','lower-shelf');
  await click('#director-panel [data-build-add]');
  const added=await until(async()=>{const d=await stage();const t=d.placed['drawing-tablet'];return t&&t.role==='lower-shelf'&&/lower-shelf/.test(t.mount||'')?d:null;},'the tablet on the second shelf');
  check(!!added,`Drawing tablet on the Second shelf: ${JSON.stringify(added?.placed['drawing-tablet'])}`);
  check(before.accessories.every(a=>added.accessories.includes(a)),'the desk keeps its other accessories');
  b=(await draft())?.deskBuild;
  check(b?.accessories?.find(a=>a.id==='drawing-tablet')?.slot==='lower-shelf','draft: build.accessories has the tablet on the lower shelf');
  await page.$eval('#director-panel [data-build-add]',e=>e.scrollIntoView({block:'center'}));await wait(600);
  await page.screenshot({path:path.join(shots,'featured-build-tab.png')});

  // ---- export, then the film's importer
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await click('#director-panel [data-action=save-export]');
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download',30000);
  const exFile=path.join(downloads,file),exported=JSON.parse(fs.readFileSync(exFile,'utf8')),eb=exported.shots[0].deskBuild;
  check(eb?.woodFinish==='Coast Navy'&&eb.baseFinish==='Terracotta'&&eb.trimColor==='#f99239'&&eb.accessories?.some(a=>a.id==='drawing-tablet'&&a.slot==='lower-shelf'),'Export cut: shot.deskBuild carries finishes and the tablet slot');
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  const film=JSON.parse(fs.readFileSync(path.join(root,HQ,'review-cut.json'),'utf8')).shots.find(s=>s.id==='rise');
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[film]}));fs.writeFileSync(path.join(H,'shots','02.json'),JSON.stringify(film));
  const script=path.join(root,'tools/experience/build-round8-director.py');
  execFileSync('python3',[script,H,'--import',exFile],{cwd:root,stdio:['ignore','pipe','pipe']});
  const dc=JSON.parse(fs.readFileSync(path.join(H,'director-camera-rise.json'),'utf8'));
  check(dc.build?.woodFinish==='Coast Navy'&&dc.build.accessories?.some(a=>a.id==='drawing-tablet'),'importer: director-camera-rise.json has `build`');
  execFileSync('python3',[script,H],{cwd:root,stdio:['ignore','pipe','pipe']});
  const fb=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots[0].featuredBuild;
  check(fb?.trimColor==='#f99239'&&fb.baseFinish==='Terracotta'&&fb.accessories?.some(a=>a.id==='drawing-tablet'&&a.slot==='lower-shelf'),'run_pass: the film shot has featuredBuild');

  // ---- reset
  await click('#director-panel [data-build-reset]');
  const reset=await until(async()=>{const d=await stage();return d.wood===before.wood&&d.base===before.base&&d.trim===before.trim&&!d.accessories.includes('drawing-tablet')?d:null;},'reset to the chapter');
  check(!!reset,'Reset: the featured desk is back to the chapter\'s own build');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){failures.push(error.message);console.error(error);}
finally{await close();}
assert.equal(failures.length,0,failures.join('\n'));
console.log('Director featured build e2e: ok');
