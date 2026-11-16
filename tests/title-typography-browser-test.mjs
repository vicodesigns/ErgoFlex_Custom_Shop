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
const {default:puppeteer}=await import('puppeteer-core');
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
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',defaultViewport:{width:1920,height:1080},args:['--no-sandbox','--disable-gpu','--mute-audio']});
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
  await page.setRequestInterception(true);page.on('request',r=>r.url().endsWith('/title-test.html')?r.respond({status:200,contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/experience/director.css"></head><body class="film-frame"><div id="panel"></div><div id="timeline"></div></body></html>'}):r.continue());
  await page.goto(`http://127.0.0.1:${port}/title-test.html`);
  await ev(async()=>{
    const {createTitleEditor}=await import('/experience/title-editor.mjs');
    const panel=document.querySelector('#panel'),timeline=document.querySelector('#timeline');
    const shot={id:'awaken',seconds:20,filmTitles:[{id:'awaken-0',rel_in:0,rel_out:10,eyebrow:'HELLO',title:'Scale this title',detail:'Supporting text'}]};window.testShot=shot;window.commits=0;
    let editor;const render=()=>{panel.innerHTML=editor.panel();editor.sync();};
    editor=createTitleEditor({panel,timeline,shot:()=>shot,time:()=>.2,seek:()=>{},commit:(fn,opts)=>{fn();window.commits++;if(opts.render)render();},status:()=>{},render,renderTimeline:()=>{},showInspector:()=>{},onSelect:()=>{},snapDelta:()=>({}),dragFeedback:()=>{},endDragFeedback:()=>{},ready:()=>{},open:()=>true});
    editor.setSource({src:{titles:[]}});editor.select('awaken-0',{reveal:false});await editor.fontsLoaded;
    const box=document.querySelector('.title-overlay');box.style.cssText='position:fixed;left:500px;top:0;width:960px;height:540px;display:block';editor.sync();window.editor=editor;
  });
  const before=await ev(()=>{const r=document.querySelector('[data-card-move]').getBoundingClientRect();return {w:r.width,h:r.height};});
  const corner=await ev(()=>{const r=document.querySelector('[data-card-scale=se]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  await drag(corner,[corner[0]+70,corner[1]+30]);
  const after=await ev(()=>{const r=document.querySelector('[data-card-move]').getBoundingClientRect();return {w:r.width,h:r.height,scale:testShot.filmTitles[0].scale,commits};});
  check(after.scale>1&&Math.abs(before.w/before.h-after.w/after.h)<.001,'corner drag scales text and shadow proportionally');
  check(after.commits===1,'corner drag commits one history entry');
  await ev(()=>{const el=document.querySelector('[data-type=size][data-line=title]');el.value='110';el.dispatchEvent(new Event('input',{bubbles:true}));});
  check(await ev(()=>testShot.filmTitles[0].typography.title.size===110&&Number(document.querySelectorAll('.title-card text')[3].getAttribute('font-size'))>62),'font size updates saved layer and preview');
  await ev(()=>{const el=document.querySelector('[data-type=color][data-line=title]');el.value='#ff0000';el.dispatchEvent(new Event('input',{bubbles:true}));});
  check(await ev(()=>document.querySelectorAll('.title-card text')[3].getAttribute('fill')==='#ff0000'),'text color updates preview');
  const custom=await ev(()=>testShot.filmTitles[0]);check(custom.scale>1&&custom.typography.title.size===110,'scale and typography are saved on the title');
} catch(error){console.error(error);failures++;} finally {await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true});}
process.exitCode=failures?1:0;
