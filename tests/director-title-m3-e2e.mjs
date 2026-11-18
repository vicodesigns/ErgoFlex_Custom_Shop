// Director Mode e2e, title tools M3: pick a line in the frame and drag it (snapping, Alt free), arrow nudges, Esc;
// multi-select on the Titles lane (Ctrl-click, marquee) and a group move; split at the playhead (Ctrl+K); copy / paste
// (Ctrl+C / Ctrl+V at the playhead); every action one Undo step; Export cut -> build-round8 --import -> finish-intro.
//   CHROME=<chrome.exe> node tests/director-title-m3-e2e.mjs [--shots DIR]
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {default:puppeteer}=await import('puppeteer-core');
const shots=process.argv.includes('--shots')?process.argv[process.argv.indexOf('--shots')+1]:null;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-title-m3-e2e-')),downloads=path.join(tmp,'downloads');fs.mkdirSync(downloads);
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
let failures=0;const check=(ok,label)=>{log(ok?'PASS':'FAIL',label);if(!ok)failures++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=await new Promise(res=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));delete st.keys?.['ergoflex.director.filmDrafts.v1'];delete st.keys?.['ergoflex.director.ui.v1'];fs.writeFileSync(path.join(tmp,'state.json'),JSON.stringify(st));}   // (no film drafts from other sessions: tests start clean)
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',path.join(tmp,'state.json')],{cwd:root,stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/experience/`)).ok)break;}catch{}await sleep(100);}
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:path.join(tmp,'profile'),defaultViewport:{width:1920,height:1080},args:['--no-sandbox','--ignore-gpu-blocklist','--mute-audio']});
const page=await browser.newPage();const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
const done=[];cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')done.push(path.join(downloads,e.guid));});
const consoleErrors=[];page.on('pageerror',e=>{log('pageerror',e.message);consoleErrors.push(e.message);});page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|\[film fx\]/.test(m.text())){consoleErrors.push(m.text());log('console error',m.text().slice(0,200));}});
const ev=(fn,...a)=>page.evaluate(fn,...a);
const statusText=()=>ev(()=>document.querySelector('#director-panel [data-status]')?.textContent||'');
async function exportCut(){const n=done.length;await page.$eval('#director-appbar [data-action=save-export]',b=>b.click());for(let i=0;i<200&&done.length===n;i++)await sleep(100);return JSON.parse(fs.readFileSync(done.at(-1),'utf8'));}
const blocks=()=>ev(()=>[...document.querySelectorAll('[data-title-clip]')].map(b=>({id:b.dataset.titleClip,text:b.querySelector('strong').textContent,time:b.querySelector('small').textContent,selected:b.classList.contains('selected')})));
const click=sel=>ev(sel=>{const b=document.querySelector(sel);if(!b)throw Error('missing '+sel);b.click();},sel);
const undo=async()=>{await click('#director-appbar [data-action=undo]');await sleep(450);};
const key=async(k,mods=[])=>{await ev(()=>document.activeElement?.blur());for(const m of mods)await page.keyboard.down(m);await page.keyboard.press(k);for(const m of mods.reverse())await page.keyboard.up(m);await sleep(450);};
const seekTo=sec=>ev(sec=>{const r=document.querySelector('[data-title-lane]').getBoundingClientRect(),x=r.left+r.width*sec/16,y=r.top+3;document.elementFromPoint(x,y).dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));},sec);
// the main (not shadow) text of a line, its screen centre, and the line's typography in the shot
const lineCentre=i=>ev(i=>{const r=document.querySelectorAll('.title-card text')[i*2+1].getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];},i);
const lineAttr=i=>ev(i=>{const t=document.querySelectorAll('.title-card text')[i*2+1];return {x:+t.getAttribute('x'),y:+t.getAttribute('y')};},i);
const filmPx=()=>ev(()=>1920/document.querySelector('.title-svg').getBoundingClientRect().width);
async function drag(from,to,{steps=10,alt=false}={}){if(alt)await page.keyboard.down('Alt');await page.mouse.move(...from);await page.mouse.down();for(let i=1;i<=steps;i++){await page.mouse.move(from[0]+(to[0]-from[0])*i/steps,from[1]+(to[1]-from[1])*i/steps);await sleep(16);}await page.mouse.up();if(alt)await page.keyboard.up('Alt');await sleep(400);}
try{
  await page.goto(`http://127.0.0.1:${port}/tests/fixtures/director-titles/director-ch02-rise.html`,{timeout:180000});
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:240000});
  await page.waitForFunction(()=>document.querySelector('[data-title-clip]'),{timeout:20000});await sleep(1200);
  // 1. select the title, then click its supporting line: the line is picked
  const b0=(await blocks())[0];await page.click(`[data-title-clip="${b0.id}"] strong`);await sleep(700);
  await page.mouse.click(...await lineCentre(2));await sleep(500);
  check(await ev(()=>document.querySelector('[data-line-frame]')?.dataset.lineFrame)==='detail','clicking the supporting line of the selected title picks that line (outlined)');
  check(await ev(()=>!!document.querySelector('[data-line-hint]')),'the Title inspector says the line is picked and how to move it');
  // 2. drag it (Alt: no snapping): only that line moves, by the drag in film px
  const k=await filmPx(),a0=[await lineAttr(0),await lineAttr(1),await lineAttr(2)],c=await lineCentre(2);
  await drag(c,[c[0]+60,c[1]+30],{alt:true});
  const a1=[await lineAttr(0),await lineAttr(1),await lineAttr(2)];log('line drag',JSON.stringify({k,a0,a1}));
  check(Math.abs(a1[2].x-a0[2].x-60*k)<1.5&&Math.abs(a1[2].y-a0[2].y-30*k)<1.5,'the supporting line follows the drag (Alt: free)');
  check(a1[0].x===a0[0].x&&a1[1].y===a0[1].y,'the eyebrow and the headline stay');
  await undo();check(JSON.stringify(await lineAttr(2))===JSON.stringify(a0[2]),'Undo puts the line back (one step)');
  // 3. snapping: a drag that ends 2 screen px right of the title edge snaps back to it; down 40 px stays
  await page.mouse.click(...await lineCentre(2));await sleep(300);
  if(await ev(()=>document.querySelector('[data-line-frame]')?.dataset.lineFrame)!=='detail'){await page.mouse.click(...await lineCentre(2));await sleep(300);}
  const c2=await lineCentre(2);await page.mouse.move(...c2);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(c2[0]+2*i/8,c2[1]+40*i/8);await sleep(16);}
  const guides=await ev(()=>document.querySelectorAll('.title-guide').length),st=await statusText();await page.mouse.up();await sleep(400);
  const a2=await lineAttr(2);log('snap',JSON.stringify({guides,st,a2}));
  check(a2.x===a0[2].x&&a2.y>a0[2].y+20,'the line snaps back to the title\'s left edge (x unchanged) while it moves down');
  check(guides>=1&&/snapped to the title edge/.test(st),'a guide shows while it snaps, the message line names it');
  // 4. arrows nudge the picked line (Shift 10), Esc goes back to the whole title
  await key('ArrowRight',['Alt']);await key('ArrowRight',['Alt']);await key('ArrowUp',['Shift','Alt']);   // Alt+arrows nudge in the frame (17 Nov 2026)
  const a3=await lineAttr(2);check(Math.abs(a3.x-a2.x-2)<.01&&Math.abs(a3.y-a2.y+10)<.01,'arrows nudge the line 1 px, Shift+arrow 10 px');
  await key('Escape');check(await ev(()=>!document.querySelector('[data-line-frame]'))&&await ev(()=>!!document.querySelector('[data-title-clip].selected')),'Esc goes back to the whole title (still selected)');
  const p0=await ev(()=>Number(document.querySelector('[name=ft-x]').value));await key('ArrowLeft',['Shift','Alt']);
  check(await ev(()=>Number(document.querySelector('[name=ft-x]').value))===p0-10,'with no line picked, arrows nudge the whole title');
  if(shots)await page.screenshot({path:path.join(shots,'m3-lines.png')});
  // 5. multi-select: + Title, Ctrl-click the first block, drag one: both move
  await seekTo(10.5);await sleep(300);await click('[data-title-add]');await sleep(700);
  let bl=await blocks();check(bl.length===2,'two titles on the lane');
  await page.keyboard.down('Control');await page.click(`[data-title-clip="${bl[0].id}"] strong`);await page.keyboard.up('Control');await sleep(500);
  bl=await blocks();check(bl.every(b=>b.selected),'Ctrl-click adds a title to the selection (both picked)');
  const lane=await ev(()=>{const r=document.querySelector('[data-title-lane]').getBoundingClientRect();return {x:r.x,w:r.width};});
  const r1=await ev(id=>{const r=document.querySelector(`[data-title-clip="${id}"] strong`).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];},bl[0].id);
  await drag(r1,[r1[0]-lane.w*(1/16),r1[1]]);
  const moved=await blocks();log('group move',JSON.stringify([bl.map(b=>b.time),moved.map(b=>b.time)]));
  check(moved.length===2&&moved.every((b,i)=>b.time!==bl[i].time),'dragging one picked title moves both');
  await undo();check(JSON.stringify((await blocks()).map(b=>b.time))===JSON.stringify(bl.map(b=>b.time)),'Undo moves both back (one step)');
  // marquee across both blocks (drag on the empty lane under them)
  await ev(()=>document.activeElement?.blur());await page.mouse.click(5,5);await sleep(300);
  const laneBox=await ev(()=>{const r=document.querySelector('[data-title-lane]').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
  await drag([laneBox[0]+laneBox[2]*.01,laneBox[1]+laneBox[3]-2],[laneBox[0]+laneBox[2]*.99,laneBox[1]+2]);await sleep(300);
  check((await blocks()).every(b=>b.selected),'a marquee across the Titles lane picks both titles');
  await key('d',['Control']);check((await blocks()).length===4,'Ctrl+D duplicates every picked title');await undo();
  check((await blocks()).length===2,'Undo removes both copies (one step)');
  // 6. split at the playhead
  bl=await blocks();await page.click(`[data-title-clip="${bl[0].id}"] strong`);await sleep(600);await seekTo(6);await sleep(400);
  await key('k',['Control']);const sp=await blocks();log('split',JSON.stringify(sp.map(b=>b.time)));
  const cut6=sp.map(b=>b.time.replace('s','').split('–').map(Number)),A=cut6.find(x=>x[0]===3.6),B=cut6.find(x=>x[1]===9.4&&x[0]!==3.6);
  check(sp.length===3&&A&&B&&A[1]===B[0]&&Math.abs(A[1]-6)<.05,'Ctrl+K splits the title at the playhead (3.6–~6 s and ~6–9.4 s, meeting at the playhead)');
  await undo();check((await blocks()).length===2,'Undo joins the pieces again');
  // 7. copy / paste at the playhead
  await page.click(`[data-title-clip="${bl[0].id}"] strong`);await sleep(600);await key('c',['Control']);
  await seekTo(9.5);await sleep(400);await key('v',['Control']);const pa=await blocks();log('paste',JSON.stringify(pa.map(b=>b.time)));
  check(pa.length===3&&pa.some(b=>b.selected&&/^9\.\d+–/.test(b.time)),'Ctrl+V pastes the copied title at the playhead, selected');
  // 8. export -> import -> titles-src -> finish-intro
  const cut=await exportCut(),ft=cut.shots[0].filmTitles;log('export',JSON.stringify(ft.map(t=>[t.id,t.rel_in,t.rel_out,t.typography])));
  const det=ft.find(t=>t.id===bl[0].id||t.id==='rise-0')?.typography?.detail;
  check(ft.length===3&&det&&det.dx===2&&det.dy>15,'Export cut carries the pasted title and the moved line (dx 2, dy > 15)');
  const H=path.join(tmp,'hq');fs.mkdirSync(H);for(const f of ['titles-src.json','edl.json'])fs.copyFileSync(path.join(root,'tests/fixtures/director-titles',f),path.join(H,f));
  const kk=at=>({at,position:[1,1,1],target:[0,0,0],fov:35});
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[{id:'awaken',seconds:44.85,cameraPlan:{keys:[kk(0),kk(44.85)]}},{id:'rise',seconds:16,cameraPlan:{keys:cut.shots[0].camera.keys.map(x=>kk(x.time*16))}}]}));
  const ef=path.join(tmp,'Film-chapter-rise-16-s-.json');fs.writeFileSync(ef,JSON.stringify(cut));
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ef],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const src=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8')).titles.filter(t=>t.chapter==='rise');
  check(src.length===3&&src.some(t=>t.typography?.detail?.dx===2),'import writes the three titles and the moved line into titles-src.json');
  execFileSync('python3',[path.join(root,'tools/experience/finish-intro.py'),H,'--titles-only'],{stdio:'ignore'});
  const ass=fs.readFileSync(path.join(H,'final/titles.ass'),'utf8');
  check((ass.match(/,Detail,,[^\n]*/g)||[]).some(l=>/\\move\((\d+(\.\d+)?),/.exec(l)&&Number(/\\move\((\d+(\.\d+)?),/.exec(l)[1])!==128),'finish-intro burns the moved supporting line off the film\'s x');
  check(!consoleErrors.length,'no page or module errors in the console');
}catch(error){log('ERROR',error.stack);failures++;}
finally{await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:300});log('done · failures',failures);process.exitCode=failures?1:0;}
