// Title text options in the Director's Title panel (line height, case, opacity, outline, drop shadow, text align): the fields exist,
// edit the saved title and the preview overlay (title-editor.mjs on a mini page, as title-typography-browser-test.mjs).
//   CHROME=<chrome.exe> node tests/title-text-options-browser-test.mjs [--shots DIR]
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
{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));delete st.keys?.['ergoflex.director.filmDrafts.v1'];delete st.keys?.['ergoflex.director.filmDrafts.setAside.v1'];delete st.keys?.['ergoflex.director.ui.v1'];fs.writeFileSync(path.join(tmp,'state.json'),JSON.stringify(st));}   // (no film drafts from other sessions: tests start clean)
const server=spawn('node',[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',path.join(tmp,'state.json')],{cwd:root,stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/experience/`)).ok)break;}catch{}await sleep(100);}
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',defaultViewport:{width:1920,height:1080},args:['--no-sandbox','--disable-gpu','--mute-audio']});
const page=await browser.newPage();const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
const done=[];cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')done.push(path.join(downloads,e.guid));});
const consoleErrors=[];page.on('pageerror',e=>{log('pageerror',e.message);consoleErrors.push(e.message);});page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text())){consoleErrors.push(m.text());log('console error',m.text().slice(0,200));}});
const ev=(fn,...a)=>page.evaluate(fn,...a);
const statusText=()=>ev(()=>document.querySelector('#director-panel [data-status]')?.textContent||'');
async function exportCut(){const n=done.length;await page.$eval('#director-appbar [data-action=save-export]',b=>b.click());for(let i=0;i<200&&done.length===n;i++)await sleep(100);return JSON.parse(fs.readFileSync(done.at(-1),'utf8'));}
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
    const shot={id:'awaken',seconds:20,filmTitles:[{id:'awaken-0',rel_in:0,rel_out:10,eyebrow:'ERGOFLEX',title:'Meet the workstation\nthat moves with you.',detail:'More comfort. Clearer focus.'}]};window.testShot=shot;window.commits=0;
    let editor;const render=()=>{panel.innerHTML=editor.panel();editor.sync();};
    editor=createTitleEditor({panel,timeline,shot:()=>shot,time:()=>.2,seek:()=>{},commit:(fn,opts)=>{fn();window.commits++;if(opts.render)render();},status:()=>{},render,renderTimeline:()=>{},showInspector:()=>{},onSelect:()=>{},snapDelta:()=>({}),dragFeedback:()=>{},endDragFeedback:()=>{},ready:()=>{},open:()=>true});
    editor.setSource({src:{titles:[]}});editor.select('awaken-0',{reveal:false});await editor.fontsLoaded;
    const box=document.querySelector('.title-overlay');box.style.cssText='position:fixed;left:500px;top:0;width:960px;height:540px;display:block';editor.sync();window.editor=editor;
  });
  const set=(sel,value)=>ev(([sel,value])=>{const el=document.querySelector(sel);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},[sel,value]);
  const T=()=>ev(()=>testShot.filmTitles[0]);
  const texts=()=>ev(()=>[...document.querySelectorAll('.title-card text')].map(e=>({y:Number(e.getAttribute('y')),fill:e.getAttribute('fill'),stroke:e.getAttribute('stroke'),sw:e.getAttribute('stroke-width'),anchor:e.getAttribute('text-anchor'),x:Number(e.getAttribute('x')),txt:e.textContent,fo:e.getAttribute('fill-opacity'),op:e.parentNode.getAttribute('opacity')})));
  const mainTitleLines=async()=>(await texts()).filter(t=>t.fill==='#ffffff'&&/Meet|that moves|MEET|THAT/i.test(t.txt));
  const gap=async()=>{const l=await mainTitleLines();return l[1].y-l[0].y;};
  // the panel carries the new options, with the film's value shown as default
  const labels=await ev(()=>[...document.querySelectorAll('#panel [data-type]')].map(e=>e.dataset.type+':'+e.dataset.line));
  for(const k of ['lineHeight','caps','opacity','strokeW','strokeColor','shadowDist','shadowColor','shadowOpacity'])check(['eyebrow','title','detail'].every(l=>labels.includes(k+':'+l)),`Title panel has ${k} for the eyebrow, headline and supporting text`);
  check(await ev(()=>!!document.querySelector('#panel select[name=ft-align]')),'Title panel has Text align');
  check(await ev(()=>document.querySelector('#panel [data-type=lineHeight][data-line=title]').value==='1.3'),'Line height shows the film\'s 1.3 em by default');
  const g0=await gap();check(Math.abs(g0-86*0.74)<.1,`default headline line step is the film's 63.64 px (${g0})`);
  // 1. line height
  await set('[data-type=lineHeight][data-line=title]','2');
  check(Math.abs(await gap()-2*86/1.762)<.1&&(await T()).typography.title.lineHeight===2,'line height 2 sets the headline step to 97.6 px and saves it');
  await set('[data-type=lineHeight][data-line=title]','');
  check(Math.abs(await gap()-g0)<.01&&!(await T()).typography?.title?.lineHeight,'clearing line height goes back to the film\'s');
  // 2. case
  await set('[data-type=caps][data-line=title]','upper');
  check((await mainTitleLines()).every(t=>t.txt===t.txt.toUpperCase())&&(await T()).title.includes('Meet'),'UPPERCASE shows capitals in the preview and keeps the typed copy');
  await set('[data-type=caps][data-line=title]','');
  // 3. opacity, outline, shadow
  await set('[data-type=opacity][data-line=title]','50');
  check((await ev(()=>[...document.querySelectorAll('.title-card g[opacity]')].map(g=>g.getAttribute('opacity')))).some(o=>Math.abs(Number(o)-.5)<.01),'opacity 50 % halves the headline\'s group opacity');
  await set('[data-type=strokeW][data-line=title]','3');await set('[data-type=strokeColor][data-line=title]','#ff0000');
  check((await mainTitleLines()).every(t=>t.stroke==='#ff0000'&&t.sw==='6.00'),'outline 3 px red = stroke 6 under the fill');
  await set('[data-type=shadowDist][data-line=title]','6');await set('[data-type=shadowColor][data-line=title]','#3366ff');await set('[data-type=shadowOpacity][data-line=title]','80');
  const sh=(await texts()).filter(t=>t.fill==='#3366ff');check(sh.length===2&&sh.every(t=>t.fo==='0.800'),'shadow colour and opacity reach the preview');
  const saved=(await T()).typography.title;check(saved.opacity===.5&&saved.strokeW===3&&saved.strokeColor==='#ff0000'&&saved.shadowDist===6&&saved.shadowColor==='#3366ff'&&saved.shadowOpacity===.8,'every option is saved on the title');
  // 4. alignment keeps the block where it is, and the preview anchors the text
  await set('[data-type=opacity][data-line=title]','100');await set('[data-type=strokeW][data-line=title]','0');
  const l0=(await mainTitleLines())[0].x;
  await set('#panel select[name=ft-align]','center');
  const t1=await T();check(t1.align==='center'&&t1.position&&(await mainTitleLines()).every(t=>t.anchor==='middle'),'Centre: saved, text-anchor middle');
  const cs=await mainTitleLines();check(Math.abs(cs[0].x-cs[1].x)<.01&&cs[0].x>l0,'centre: both headline lines share one centre x (the block did not jump)');
  await set('#panel select[name=ft-align]','right');check((await mainTitleLines()).every(t=>t.anchor==='end')&&(await T()).align==='right','Right: text-anchor end');
  await set('#panel select[name=ft-align]','left');check(!(await T()).align&&(await mainTitleLines()).every(t=>!t.anchor),'Left is the default again (nothing saved)');
  if(shots){await ev(()=>{const el=document.querySelector('[data-type=lineHeight][data-line=title]');el.value='1.8';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.screenshot({path:path.join(shots,'director-text-options.png')});}
} catch(error){console.error(error);failures++;} finally {await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true});}
process.exitCode=failures?1:0;
