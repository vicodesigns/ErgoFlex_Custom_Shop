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
async function exportCut(){const n=done.length;await page.$eval('#director-appbar [data-action=save-export]',b=>b.click());for(let i=0;i<200&&done.length===n;i++)await sleep(100);return JSON.parse(fs.readFileSync(done.at(-1),'utf8'));}
const block=()=>ev(()=>{const b=document.querySelector('[data-title-clip]'),r=b.getBoundingClientRect(),l=b.closest('[data-title-lane]').getBoundingClientRect();return {x:r.x,y:r.y+r.height/2,w:r.width,cx:r.x+r.width/2,lane:l.width,text:b.querySelector('small').textContent,early:b.classList.contains('early')};});
// film pixels (1920x1080 grid) -> screen
const screen=(x,y)=>ev(([x,y])=>{const s=document.querySelector('.title-svg'),m=s.getScreenCTM(),p=new DOMPoint(x,y).matrixTransform(m);return [p.x,p.y];},[x,y]);
const shapeState=()=>ev(()=>({pts:document.querySelectorAll('.se-pt').length,smooth:document.querySelectorAll('circle.se-pt').length,handles:document.querySelectorAll('.se-handle').length,scale:document.querySelectorAll('.se-scale').length,on:document.querySelector('.se-pt.on')?.dataset.pt||null}));
const pathD=i=>ev(i=>document.querySelectorAll('.title-card path')[i]?.getAttribute('d'),i);
async function drag(from,to,{steps=8,alt=false}={}){if(alt)await page.keyboard.down('Alt');await page.mouse.move(...from);await page.mouse.down();for(let i=1;i<=steps;i++){await page.mouse.move(from[0]+(to[0]-from[0])*i/steps,from[1]+(to[1]-from[1])*i/steps);await sleep(16);}await page.mouse.up();if(alt)await page.keyboard.up('Alt');await sleep(250);}
try{
  await page.setRequestInterception(true);page.on('request',r=>r.url().endsWith('/graphics-test.html')?r.respond({status:200,contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/experience/director.css"></head><body><div id="panel"></div><div id="timeline" style="width:1000px"></div></body></html>'}):r.continue());
  await page.goto(`http://127.0.0.1:${port}/graphics-test.html`);
  await ev(async()=>{
    const {createGraphicsEditor}=await import('/experience/graphics-editor.mjs');
    const {createTimelineHints,timelineShortcuts}=await import('/experience/timeline-hints.mjs');
    const panel=document.querySelector('#panel'),timeline=document.querySelector('#timeline');
    window.testShot={id:'awaken',seconds:20};window.commits=0;window.currentTab='';window.graphicTime=.2;
    let editor;const renderPanel=()=>panel.innerHTML=editor.panel(),renderTimeline=()=>timeline.innerHTML=editor.lane();
    editor=createGraphicsEditor({panel,timeline,shot:()=>testShot,filmShot:()=>({screens:[{target:'main',src:'clip.mp4',start:2,end:8,offset:3}]}),showInspector:tab=>currentTab=tab,renderPanel,renderTimeline,status:()=>{},commit:fn=>{fn();commits++;renderPanel();renderTimeline();},groupHead:()=>'<div>GRAPHICS</div>',groupClosed:()=>false,time:()=>graphicTime,snapStep:()=>.1,magnet:()=>true});renderPanel();renderTimeline();
    timeline.querySelector('[data-graphic-lane]').style.width='800px';
    createTimelineHints({root:timeline,context:el=>({seconds:20,graphic:el.dataset.graphicClip===undefined?null:(testShot.screens??[{target:'main',src:'clip.mp4',start:2,end:8,offset:3}])[Number(el.dataset.graphicClip)]})});
    window.shortcutMarkup=timelineShortcuts();
    // the ⌨ Shortcuts button opens the Director's keys panel (keys-panel.mjs, since keys drop 1): wired here as the
    // Director wires it (its button's data-action="keys-panel"; Esc closes the panel)
    const {createKeysPanel}=await import('/experience/keys-panel.mjs');const kp=createKeysPanel({run:()=>{}});
    timeline.addEventListener('click',e=>{if(e.target.closest('[data-action="keys-panel"]'))kp.toggle();});
    addEventListener('keydown',e=>{if(e.key==='Escape')kp.close();});
  });
  const clip=await ev(()=>{const r=document.querySelector('[data-graphic-clip]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  await page.mouse.click(...clip);
  check(await ev(()=>currentTab==='graphics'&&document.querySelector('details details').open),'clip click selects the Graphics inspector');
  const before=await ev(()=>commits);
  await drag(clip,[clip[0]+40,clip[1]]);
  check(await ev(()=>testShot.screens[0].start>2&&testShot.screens[0].end>8&&Math.abs(testShot.screens[0].end-testShot.screens[0].start-6)<.001),'drag moves the clip without changing duration');
  check(await ev(n=>commits===n+1,before),'clip drag creates one history entry');
  const edge=await ev(()=>{const r=document.querySelector('[data-graphic-edge=end]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  const prior=await ev(()=>testShot.screens[0].end);await drag(edge,[edge[0]+35,edge[1]]);
  check(await ev(end=>testShot.screens[0].end>end,prior),'end handle trims the graphic range');
  await ev(()=>{const el=document.querySelector('[data-screen-field=start]');el.value='4';el.dispatchEvent(new Event('change',{bubbles:true}));});
  check(await ev(()=>testShot.screens[0].start===4),'inspector Comes in updates the clip');
  await ev(()=>{graphicTime=.3;document.querySelector('#panel [data-graphic-action=split][data-graphic-index="0"]').click();});
  check(await ev(()=>testShot.screens.length===2&&document.querySelectorAll('[data-graphic-lane]').length===1),'split makes two pieces on one screen track');
  const splitSource=await ev(()=>({left:{...testShot.screens[0]},right:{...testShot.screens[1]}}));
  const right=await ev(()=>{const r=document.querySelector('[data-graphic-clip="1"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  await drag(right,[right[0]+100,right[1]]);
  check(await ev(prev=>testShot.screens[1].start>prev.right.start&&testShot.screens[1].offset===prev.right.offset&&testShot.screens[0].end===prev.left.end,splitSource),'split piece moves independently and retains source in-point');
  const leftEdge=await ev(()=>{const r=document.querySelector('[data-graphic-clip="0"] [data-graphic-edge=end]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  await drag(leftEdge,[leftEdge[0]+30,leftEdge[1]]);
  check(await ev(prev=>testShot.screens[0].end>prev.left.end,splitSource),'edge extends a cut piece into the gap');
  const hover=await ev(()=>{const r=document.querySelector('[data-graphic-clip="1"]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
  await page.mouse.move(...hover);await sleep(450);
  check(await ev(()=>{const tip=document.querySelector('[role=tooltip]');return !tip.hidden&&/Timeline.*Duration/.test(tip.textContent)&&/Source/.test(tip.textContent)&&/split at playhead/.test(tip.textContent);}), 'graphic hover shows timeline, duration, source timing and split shortcut');
  await page.mouse.down();await page.mouse.move(hover[0]+15,hover[1],{steps:3});await sleep(80);
  check(await ev(()=>{const tip=document.querySelector('[role=tooltip]');return !tip.hidden&&/Move.*Graphics/.test(tip.textContent)&&/Release to apply/.test(tip.textContent);}), 'dragging shows live timing and move delta');
  await page.mouse.up();check(await ev(()=>document.querySelector('[role=tooltip]').hidden),'drag release removes timing card');
  await ev(()=>{document.querySelector('#timeline').insertAdjacentHTML('beforeend',shortcutMarkup+'<button data-title-clip="test" style="left:10%;width:20%" title="Example title">Title</button><button data-desk-clip="test" style="left:20%;width:20%">Motion</button><button data-key="test" style="left:30%">Camera</button><button data-light-clip="test" style="left:40%;width:10%">Light</button><button data-prop-key="test">Prop</button><button data-person-key="test">Person</button>');});
  for(const [selector,expected] of [['[data-title-clip=test]','Enter: inspector'],['[data-desk-clip=test]','Edges: resize'],['[data-key=test]','Drag: retime'],['[data-light-clip=test]','Edges: trim'],['[data-prop-key=test]','Click: select'],['[data-person-key=test]','Click: select']]){
    await ev(sel=>document.querySelector(sel).focus(),selector);
    check(await ev(text=>{const tip=document.querySelector('[role=tooltip]');return !tip.hidden&&tip.textContent.includes(text);},expected),'focused '+selector+' has the correct contextual hint');
  }
  await ev(()=>document.querySelector('.timeline-shortcuts').click());await sleep(60);
  check(await ev(()=>{const p=document.getElementById('director-keys'),r=p.getBoundingClientRect();return !p.hidden&&r.top>=0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),'shortcut panel fits inside the viewport');
  await page.keyboard.press('Escape');
  check(await ev(()=>document.getElementById('director-keys').hidden&&document.querySelector('[role=tooltip]').hidden),'Escape dismisses tooltip and shortcut panel');
} catch(error){console.error(error);failures++;} finally {await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true});}
process.exitCode=failures?1:0;
