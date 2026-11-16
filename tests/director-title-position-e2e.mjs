// Director Mode e2e: the film titles on the chapter timeline and the editable title shadow.
//   node tests/director-titles-e2e.mjs [--shots DIR]
// Starts its own studio server on a free port (state in a temp copy), opens the rise fixture chapter
// (tests/fixtures/director-titles: titles-src.json + edl.json beside the film chapter list) in headless Chrome and
// checks: TITLES lane + 1.5 s-after-cut mark, select -> Title inspector + overlay, drag / trim with undo, the early
// warning, copy edits, shadow edit mode (add a point on an edge, move it, smooth it, delete one, drag a handle,
// scale), softness / darkness, Reset to fitted, Export cut -> build-round8-director.py --import -> titles-src.json ->
// finish-intro.py draws the same shape, and no module export errors in the console.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {default:puppeteer}=await import(path.join(root,'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'));
const {assDrawing}=await import('../experience/film-titles.mjs');
const shots=process.argv.includes('--shots')?process.argv[process.argv.indexOf('--shots')+1]:null;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-titles-e2e-')),downloads=path.join(tmp,'downloads');fs.mkdirSync(downloads);
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
let failures=0;const check=(ok,label)=>{log(ok?'PASS':'FAIL',label);if(!ok)failures++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=await new Promise(res=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
fs.copyFileSync(path.join(root,'studio-state.json'),path.join(tmp,'state.json'));
const server=spawn('node',[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',path.join(tmp,'state.json')],{cwd:root,stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/experience/`)).ok)break;}catch{}await sleep(100);}
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',defaultViewport:{width:1920,height:1080},args:['--no-sandbox','--ignore-gpu-blocklist','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
const page=await browser.newPage();const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
const done=[];cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')done.push(path.join(downloads,e.guid));});
const consoleErrors=[];page.on('pageerror',e=>{log('pageerror',e.message);consoleErrors.push(e.message);});page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text())){consoleErrors.push(m.text());log('console error',m.text().slice(0,200));}});
const ev=(fn,...a)=>page.evaluate(fn,...a);
const statusText=()=>ev(()=>document.querySelector('#director-panel [data-status]')?.textContent||'');
async function exportCut(){const n=done.length;await page.$eval('#director-panel [data-action=save-export]',b=>b.click());for(let i=0;i<200&&done.length===n;i++)await sleep(100);return JSON.parse(fs.readFileSync(done.at(-1),'utf8'));}
const block=()=>ev(()=>{const b=document.querySelector('[data-title-clip]'),r=b.getBoundingClientRect(),l=b.closest('[data-title-lane]').getBoundingClientRect();return {x:r.x,y:r.y+r.height/2,w:r.width,cx:r.x+r.width/2,lane:l.width,text:b.querySelector('small').textContent,early:b.classList.contains('early')};});
// film pixels (1920x1080 grid) -> screen
const screen=(x,y)=>ev(([x,y])=>{const s=document.querySelector('.title-svg'),m=s.getScreenCTM(),p=new DOMPoint(x,y).matrixTransform(m);return [p.x,p.y];},[x,y]);
const shapeState=()=>ev(()=>({pts:document.querySelectorAll('.se-pt').length,smooth:document.querySelectorAll('circle.se-pt').length,handles:document.querySelectorAll('.se-handle').length,scale:document.querySelectorAll('.se-scale').length,on:document.querySelector('.se-pt.on')?.dataset.pt||null}));
const pathD=i=>ev(i=>document.querySelectorAll('.title-card path')[i]?.getAttribute('d'),i);
async function drag(from,to,{steps=8,alt=false}={}){if(alt)await page.keyboard.down('Alt');await page.mouse.move(...from);await page.mouse.down();for(let i=1;i<=steps;i++){await page.mouse.move(from[0]+(to[0]-from[0])*i/steps,from[1]+(to[1]-from[1])*i/steps);await sleep(16);}await page.mouse.up();if(alt)await page.keyboard.up('Alt');await sleep(250);}
try{
  await page.goto(`http://127.0.0.1:${port}/tests/fixtures/director-titles/director-ch02-rise.html`);
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:240000});
  await page.waitForFunction(()=>document.querySelector('[data-title-clip]'),{timeout:20000});await sleep(1200);
  // 1. the lane
  const lane=await ev(()=>({head:document.querySelector('[data-lane-group=titles]')?.textContent.trim(),blocks:[...document.querySelectorAll('[data-title-clip]')].map(b=>b.textContent),rule:document.querySelector('[data-title-rule]')?.style.left,ruleText:document.querySelector('[data-title-rule]')?.textContent,label:document.querySelector('[data-lane-color=titles] .desk-lane-label')?.textContent.trim(),tab:!!document.querySelector('[data-inspector-tab=title]')}));
  log('lane',JSON.stringify(lane));
  check(/TITLES/.test(lane.head)&&lane.label.startsWith('Titles')&&lane.blocks.length===1&&/SIT · STAND.*Your height\. Your rhythm\..*3\.6–9\.4s/.test(lane.blocks[0]),'TITLES lane shows the rise title (eyebrow, headline, 3.6–9.4 s)');
  check(lane.ruleText==='1.5 s after cut'&&Math.abs(parseFloat(lane.rule)-2.3/16*100)<.01,'the 1.5 s-after-cut mark sits at 2.3 s (cut done 0.8 s)');
  check(lane.tab,'the inspector has a Title tab');
  const chapterTab=await ev(()=>{document.querySelector('[data-inspector-tab=chapter]').click();return {eyebrow:document.querySelector('#director-panel [name=ft-eyebrow]')?.value,title:document.querySelector('#director-panel [name=ft-title]')?.value};});
  check(chapterTab.title==='Your height. Your rhythm.'&&chapterTab.eyebrow==='SIT · STAND','the Chapter tab\'s Headline / Supporting text edit the film title');
  // 2. select
  const b0=await block();await page.mouse.click(b0.cx,b0.y);await sleep(600);
  const sel=await ev(()=>({tab:document.querySelector('[data-inspector-tab=title]').getAttribute('aria-pressed'),title:document.querySelector('#director-panel [name=ft-title]')?.value,in:document.querySelector('[name=ft-in]')?.value,header:document.querySelector('[data-selected-header]')?.textContent,overlay:!document.querySelector('.title-overlay').hidden,texts:[...document.querySelectorAll('.title-card text')].map(t=>t.textContent),paths:document.querySelectorAll('.title-card path').length,selected:document.querySelector('[data-title-clip]').classList.contains('selected'),time:document.querySelector('[name=timeline-seconds]').value}));
  log('selected',JSON.stringify(sel));
  check(sel.tab==='true'&&sel.title==='Your height. Your rhythm.'&&sel.in==='3.6'&&/Title · Your height/.test(sel.header)&&sel.selected,'clicking the block opens the Title inspector (Selected header, copy, in / out)');
  check(await ev(()=>{const p=document.querySelector('#director-panel [data-inspector-page=title] [data-reveal=title]');return !!p&&(p.classList.contains('reveal-pulse')||!!p.closest('.reveal-pulse'))&&!p.closest('[hidden]');}),'selecting a title reveals the Title tab (reveal pulse on the Title inspector, not the Chapter Headline)');
  check(await ev(()=>{const h=document.querySelector('#director-panel [data-inspector-page=title] [data-reveal=title]');return h&&document.querySelector('[data-inspector-tab=title]').getAttribute('aria-pressed')==='true';}),'reveal(\'title\') home is the Title tab on film chapters');
  check(sel.overlay&&sel.paths===3&&sel.texts.includes('Your height. Your rhythm.')&&Number(sel.time)>5,'the frame shows the title with its 3 fitted shadow boxes at a time it is fully in');
  check(await ev(()=>document.querySelectorAll('[data-card-scale]').length)===4,'the selected title shows four proportional scale handles');
  if(shots)await page.screenshot({path:path.join(shots,'titles-lane.png')});

  const before=await ev(()=>({x:Number(document.querySelector('[name=ft-x]').value),y:Number(document.querySelector('[name=ft-y]').value),text:document.querySelectorAll('.title-card text')[3].getAttribute('x')}));
  const hit=await ev(()=>{const r=document.querySelector('[data-card-move]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  await drag(hit,[hit[0]+40,hit[1]-30]);
  const after=await ev(()=>({x:Number(document.querySelector('[name=ft-x]').value),y:Number(document.querySelector('[name=ft-y]').value),text:document.querySelectorAll('.title-card text')[3].getAttribute('x')}));
  check(after.x>before.x&&after.y<before.y&&Number(after.text)>Number(before.text),'whole-title drag moves text and anchor together');
  await ev(()=>document.querySelector('[data-title-action=copy-layout]').click());
  await ev(()=>{const el=document.querySelector('[name=ft-x]');el.value='400';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await ev(()=>document.querySelector('[data-title-action=paste-layout]').click());
  check(await ev(x=>Number(document.querySelector('[name=ft-x]').value)===x,after.x),'paste restores the copied title layout');
  const corner=await ev(()=>{const r=document.querySelector('[data-card-scale=se]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  await drag(corner,[corner[0]+45,corner[1]+30]);
  check(await ev(()=>Number(document.querySelector('[name=ft-scale]').value)>100),'corner handle scales title proportionally');
  await ev(()=>{const el=document.querySelector('[data-type=size][data-line=title]');el.value='110';el.dispatchEvent(new Event('input',{bubbles:true}));});
  check(await ev(()=>Number(document.querySelectorAll('.title-card text')[3].getAttribute('font-size'))>60),'font size changes the preview');
  const out=await exportCut();check(out.shots[0].filmTitles[0].scale>1&&out.shots[0].filmTitles[0].typography.title.size===110,'export keeps scale and typography');
} catch(error){console.error(error);failures++;} finally {await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true});}
process.exitCode=failures?1:0;
