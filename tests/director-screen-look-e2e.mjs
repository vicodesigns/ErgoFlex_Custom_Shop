// The Graphics tab's Screen look, end to end (19 Nov 2026, real GPU Chrome, the coast chapter of the Cinematographer's cut).
//   1. the Graphics tab has Screen look: All screens or one, a slider each (strength, contrast, black level, saturation,
//      colour temperature, glare, glow spill), Reset; screenshot of the panel
//   2. Strength 60 % on All screens: the stage's film screens dim at once (their material colour x .6), no reload
//   3. one screen on its own (black level): only that screen's shader is changed; the others keep today's
//   4. Export cut carries shot.screenLook; Reset every screen puts the screens back exactly (colour and shader)
//   node tests/director-screen-look-e2e.mjs        (CUT=<cut dir>, default the Cinematographer's; SHOTS=<dir>)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='coast'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`screen look e2e: skipped (${CUT} has no coast chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'screen-look-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);return ok;};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(200);}};
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
// the stage's film screens: name, colour, whether their shader is the look's
const screens=()=>page.evaluate(()=>{const out=[];document.getElementById('stage').contentWindow.ErgoPresentation.three().scene.traverse(o=>{if(o.userData?.filmScreen&&o.material)out.push({name:o.name,c:o.material.color.r,shaded:!!o.material.userData?.screenLook,spill:o.userData.screenSpill});});return out;});
const slide=(k,v)=>page.evaluate((k,v)=>{const el=document.querySelector(`#director-panel [name="sl-${k}"]`);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},k,v);
try{
  await page.evaluateOnNewDocument(()=>{window.__exports=[];const make=URL.createObjectURL;URL.createObjectURL=function(b){if(b instanceof Blob&&b.type==='application/json')b.text().then(t=>window.__exports.push(t));return make.call(this,b);};});
  await openChapter(page,base,chapter);await seek(page,2);
  const s0=await until(async()=>{const s=await screens();return s.length?s:null;},'the chapter\'s film screens on the stage');
  check(s0.every(s=>!s.shaded&&s.spill===1),`${s0.length} film screen(s), today's look (no shader change, spill 1)`);
  // ---- 1
  await click('#director-panel [data-inspector-tab="graphics"]');
  await until(()=>page.$('#director-panel [data-screen-look]'),'the Screen look section');
  const names=await page.$$eval('#director-panel [data-screen-look] .screen-look-row span',l=>l.map(e=>e.textContent));
  check(JSON.stringify(names)===JSON.stringify(['Strength','Contrast','Black level','Saturation','Colour temperature','Glare','Glow spill']),'1. the sliders: '+names.join(', '));
  const targets=await page.$$eval('#director-panel [name="sl-target"] option',l=>l.map(o=>o.value));check(targets[0]===''&&targets.length>=2,'1. All screens, then each screen: '+targets.slice(1).join(', '));
  // ---- 2
  await slide('brightness',.6);
  await until(async()=>(await screens()).every((s,i)=>Math.abs(s.c-s0[i].c*.6)<1e-6),'the screens dim live');
  check(true,'2. Strength 60 %: every film screen dims at once ('+s0.map(s=>s.c.toFixed(2)).join(', ')+' → x .6)');
  await page.$eval('#director-panel [data-screen-look]',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(SHOTS,'01-screen-look-panel.png')});
  // ---- 3
  const one=targets[1];await page.select('#director-panel [name="sl-target"]',one);await wait(400);
  await slide('black',.05);
  const s3=await until(async()=>{const s=await screens();return s.some(x=>x.shaded)?s:null;},'one screen shaded');
  check(s3.filter(x=>x.shaded).length===1&&s3.find(x=>x.shaded).name.includes(one.split('/')[0]),`3. only "${one}" gets the black level`);
  await page.screenshot({path:path.join(SHOTS,'02-one-screen.png')});
  // ---- 4
  await click('#director-appbar [data-action="save-export"]');
  const sent=await until(()=>page.evaluate(()=>window.__exports.at(-1)||null),'the export',20000);
  const look=JSON.parse(sent).shots[0].screenLook;
  check(look?.all?.brightness===.6&&look?.per?.[one]?.black===.05,'4. Export cut carries the look: '+JSON.stringify(look));
  await page.select('#director-panel [name="sl-target"]','');await wait(300);
  await click('#director-panel [data-sl-action="reset-every"]');
  await until(async()=>{const s=await screens();return s.every((x,i)=>!x.shaded&&Math.abs(x.c-s0[i].c)<1e-9&&x.spill===1);},'every screen back');
  check(true,'4. Reset every screen: colour, shader and spill exactly as they were');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){await page.screenshot({path:path.join(SHOTS,'99-failed.png')}).catch(()=>{});check(false,error.message);}
finally{await close();}
console.log(failures.length?`FAIL screen look e2e: ${failures.length} (shots in ${SHOTS})`:`PASS screen look e2e (shots in ${SHOTS})`);
process.exitCode=failures.length?1:0;
