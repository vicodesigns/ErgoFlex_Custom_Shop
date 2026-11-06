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
  check(await ev(()=>document.querySelectorAll('.shape-hint path[data-hint]').length)===3,'the selected title shows its shadow outline (dashed) in the frame');
  if(shots)await page.screenshot({path:path.join(shots,'titles-lane.png')});
  // 3. drag (move) with undo / redo
  await drag([b0.cx,b0.y],[b0.cx+b0.lane*(1/16),b0.y]);
  let b1=await block();log('after move',b1.text,await statusText());
  check(/^4\.6–10\.4s$/.test(b1.text)&&/Title moved to 4\.6–10\.4 s/.test(await statusText()),'dragging the block moves the title 1 s (snapped to 0.1 s)');
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await sleep(500);
  check((await block()).text==='3.6–9.4s','Ctrl+Z puts it back');
  await page.keyboard.down('Control');await page.keyboard.press('y');await page.keyboard.up('Control');await sleep(500);
  check((await block()).text==='4.6–10.4s','Ctrl+Y redoes the move');
  // 4. trim the in point before the 1.5 s mark: gentle warning, timing kept
  b1=await block();await drag([b1.x+4,b1.y],[b1.x+4-b1.lane*(3.4/16),b1.y],{alt:true});
  const tr=await block(),warn=await ev(()=>[...document.querySelectorAll('.title-warning')].map(e=>e.textContent));log('after trim',tr.text,JSON.stringify(warn));
  check(/^1\.[12]\d*–10\.4s · before the 1\.5 s mark$/.test(tr.text)&&tr.early,'trimming the in point (Alt: no snap) keeps the out point; the block is marked early');
  check(warn.some(w=>/before the 1\.5 s-after-cut mark \(2\.3 s\)\. The film keeps your timing\./.test(w))&&/before the 1\.5 s-after-cut mark/.test(await statusText()),'a gentle warning (inspector + status) and no correction');
  const len=10.4-parseFloat(tr.text);await ev(()=>document.querySelector('[data-title-action=to-rule]').click());await sleep(400);
  const ruled=await block();check(ruled.text===`2.3–${Number((2.3+len).toFixed(2))}s`&&!ruled.early,'"Start at the 1.5 s mark" moves it onto the mark, keeping its length');
  // 5. copy
  await page.click('[data-inspector-page=title] [name=ft-title]',{clickCount:3});await page.keyboard.type('Your height, your rhythm.');await sleep(300);
  check(await ev(()=>[...document.querySelectorAll('.title-card text')].some(t=>t.textContent==='Your height, your rhythm.')),'typing a new headline updates the frame');
  // 6. shadow editing
  await ev(()=>document.querySelector('[data-title-action=edit-shadow]').click());await sleep(500);
  let sh=await shapeState();log('edit mode',JSON.stringify(sh));
  check(await statusText()==='Editing the shadow: drag points · double-click smooth/sharp · Alt-drag breaks a handle · Enter when done','while the shape is edited, the message line shows the editing hint (not the chapter count): '+await statusText());
  check(sh.pts===12&&sh.scale===8&&await ev(()=>document.body.classList.contains('title-shape-editing')),'Edit shadow shape: 12 points (3 fitted boxes) and 8 resize squares around the whole shadow');
  if(shots)await page.screenshot({path:path.join(shots,'shadow-edit-fitted.png')});
  const titleBox=await ev(()=>{const p=document.querySelectorAll('.se-outline')[1].getBBox();return [p.x,p.y,p.width,p.height];});
  // add a point on the headline box's top edge, then drag it up
  const top=await screen(titleBox[0]+titleBox[2]*.6,titleBox[1]);await page.mouse.click(top[0],top[1]);await sleep(300);
  sh=await shapeState();check(sh.pts===13&&sh.on==='1:1','clicking an edge adds a point there (selected)');
  const added=await screen(titleBox[0]+titleBox[2]*.6,titleBox[1]);await drag(added,[added[0],added[1]-30]);
  const moved=await ev(()=>{const r=document.querySelector('.se-pt.on').getBBox();return r.y+r.height/2;});check(moved<titleBox[1]-20,'dragging the point moves it');
  // double-click: smooth (handles appear), drag a handle, Alt-drag breaks it
  const pt=await screen(titleBox[0]+titleBox[2]*.6,moved);await page.mouse.move(pt[0],pt[1]);for(let i=0;i<2;i++){await page.mouse.down();await page.mouse.up();await sleep(60);}await sleep(400);
  sh=await shapeState();check(sh.smooth===1&&sh.handles===2,'double-clicking the point makes it smooth, with two handles');
  const hd=await ev(()=>{const h=document.querySelector('.se-handle[data-h$=":out"]');return [+h.getAttribute('cx'),+h.getAttribute('cy')];});
  const hs=await screen(...hd);const before=await pathD(1);await drag(hs,[hs[0]+40,hs[1]-25]);
  check((await pathD(1))!==before&&/C /.test(await pathD(1)),'dragging a handle curves the edge (a bezier in the frame)');
  const pts=await ev(()=>{const c=document.querySelector('circle.se-pt');return [+c.getAttribute('cx'),+c.getAttribute('cy')];});
  const hin=await ev(()=>{const h=document.querySelector('.se-handle[data-h$=":in"]');return [+h.getAttribute('cx'),+h.getAttribute('cy')];});
  const his=await screen(...hin);await drag(his,[his[0]-10,his[1]+40],{alt:true});
  const broken=await ev(()=>{const o=document.querySelector('.se-handle[data-h$=":out"]'),i=document.querySelector('.se-handle[data-h$=":in"]'),c=document.querySelector('circle.se-pt');return {c:[+c.getAttribute('cx'),+c.getAttribute('cy')],o:[+o.getAttribute('cx'),+o.getAttribute('cy')],i:[+i.getAttribute('cx'),+i.getAttribute('cy')]};});
  const cross=(broken.o[0]-broken.c[0])*(broken.i[1]-broken.c[1])-(broken.o[1]-broken.c[1])*(broken.i[0]-broken.c[0]);
  check(Math.abs(cross)>200&&/Alt|broken|Curve/.test(await statusText()),'Alt-dragging a handle breaks it (the two handles no longer line up)');
  // delete a corner point with Delete
  const corner=await ev(()=>{const r=document.querySelector('rect.se-pt[data-pt="0:1"]');return [+r.getAttribute('x')+(+r.getAttribute('width'))/2,+r.getAttribute('y')+(+r.getAttribute('height'))/2];});
  const cs=await screen(...corner);await page.mouse.click(cs[0],cs[1]);await sleep(200);await page.keyboard.press('Delete');await sleep(400);
  sh=await shapeState();check(sh.pts===12&&/Point deleted/.test(await statusText()),'Delete removes the selected point');
  // scale: drag the east square of the whole-shadow frame
  await page.keyboard.down('Control');await page.keyboard.press('a');await page.keyboard.up('Control');await sleep(300);
  const wbox=await ev(()=>{const f=document.querySelector('.se-frame');return [+f.getAttribute('x'),+f.getAttribute('width')];}),east=await ev(()=>{const r=document.querySelector('.se-scale[data-scale=e]');return [+r.getAttribute('x')+(+r.getAttribute('width'))/2,+r.getAttribute('y')+(+r.getAttribute('height'))/2];});
  const es=await screen(...east),k=1920/(await ev(()=>document.querySelector('.title-svg').getBoundingClientRect().width));await drag(es,[es[0]+120/k,es[1]]);
  const wbox2=await ev(()=>{const f=document.querySelector('.se-frame');return [+f.getAttribute('x'),+f.getAttribute('width')];});
  check(Math.abs(wbox2[0]-wbox[0])<1&&Math.abs(wbox2[1]-wbox[1]-120)<4,'the east square makes the shadow 120 px wider (left edge stays)');
  // body: drag inside the headline shape moves the selection
  const bodyAt=await screen(titleBox[0]+40,titleBox[1]+titleBox[3]/2);await drag(bodyAt,[bodyAt[0],bodyAt[1]+20/k]);
  check(/Shape moved/.test(await statusText()),'dragging inside a shape moves it');
  if(shots)await page.screenshot({path:path.join(shots,'shadow-edit-points.png')});
  // softness / darkness
  await ev(()=>{const s=document.querySelector('[name=ft-blur-n]');s.value='26';s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));const o=document.querySelector('[name=ft-opacity-n]');o.value='45';o.dispatchEvent(new Event('input',{bubbles:true}));o.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(400);
  const look=await ev(()=>({blur:document.querySelector('[data-title-blur]')?.textContent,dark:document.querySelector('[data-title-opacity]')?.textContent,op:document.querySelector('.title-card path').getAttribute('fill-opacity'),note:document.querySelector('[data-title-shape-note]')?.textContent}));
  log('look',JSON.stringify(look));
  check(look.blur==='26'&&look.dark==='45%'&&Math.abs(Number(look.op)-.45)<.01,'Softness 26 and Darkness 45% apply to the shadow in the frame');
  check(/Your own shape: 3 parts, 12 points/.test(look.note),'the inspector names the custom shape');
  await page.keyboard.press('Escape');await sleep(300);
  check(!(await ev(()=>document.body.classList.contains('title-shape-editing')))&&await ev(()=>!!document.querySelector('[data-title-clip].selected')),'Esc finishes editing the shape (the title stays selected)');
  const hint=await ev(()=>{const r=document.querySelectorAll('.shape-hint path')[1].getBoundingClientRect();return [r.x+12,r.y+r.height/2];});await page.mouse.click(...hint);await sleep(400);
  check(await ev(()=>document.body.classList.contains('title-shape-editing')),'clicking the dashed shadow outline starts editing it');
  await page.keyboard.press('Enter');await sleep(300);check(!(await ev(()=>document.body.classList.contains('title-shape-editing'))),'Enter finishes editing');
  check(/^\d+ chapters? · \d+ seconds$/.test(await statusText()),'editing done: the message line is back to the normal one: '+await statusText());
  // 7. Export cut -> import -> titles-src -> finish-intro
  const cut=await exportCut(),ft=cut.shots[0].filmTitles;log('export',JSON.stringify(ft).slice(0,300));
  check(ft?.length===1&&ft[0].title==='Your height, your rhythm.'&&ft[0].rel_in===2.3&&ft[0].timed===true&&ft[0].shadow.paths.length===3&&ft[0].shadow.blur===26&&ft[0].shadow.opacity===.45,'Export cut carries the title copy, timing and shadow shape');
  const H=path.join(tmp,'hq');fs.mkdirSync(H);for(const f of ['titles-src.json','edl.json'])fs.copyFileSync(path.join(root,'tests/fixtures/director-titles',f),path.join(H,f));
  const key=at=>({at,position:[1,1,1],target:[0,0,0],fov:35});
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[{id:'awaken',seconds:44.85,cameraPlan:{keys:[key(0),key(44.85)]}},{id:'rise',seconds:16,cameraPlan:{keys:cut.shots[0].camera.keys.map(k=>key(k.time*16))}}]}));
  const ef=path.join(tmp,'Film-chapter-rise-16-s-.json');fs.writeFileSync(ef,JSON.stringify(cut));
  const id=execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ef],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const got=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8')).titles.find(t=>t.chapter==='rise');
  check(id==='rise'&&got.title==='Your height, your rhythm.'&&got.rel_in===2.3&&got.director_timing===true&&got.scrim==='38'&&JSON.stringify(got.shadow)===JSON.stringify(ft[0].shadow),'build-round8-director.py --import writes them into titles-src.json');
  check(fs.readdirSync(H).some(f=>/^titles-src\.pre-director-rise-/.test(f)),'titles-src.json was backed up first');
  execFileSync('python3',[path.join(root,'tools/experience/finish-intro.py'),H,'--titles-only'],{stdio:'ignore'});
  const ass=fs.readFileSync(path.join(H,'final/titles.ass'),'utf8');
  check(ft[0].shadow.paths.every(p=>ass.includes('\\1a&H8C&\\blur26}'+assDrawing(p)+'{\\p0}')),'finish-intro.py draws each shadow part with the Director\'s path, 45% dark, softness 26');
  // 8. Reset to fitted
  await ev(()=>document.querySelector('[data-title-action=reset-shadow]').click());await sleep(400);
  const reset=await exportCut();check(!reset.shots[0].filmTitles[0].shadow&&await ev(()=>document.querySelectorAll('.title-card path').length)===3,'Reset to fitted goes back to the fitted boxes (no shadow in the export)');
  check(!consoleErrors.some(e=>/does not provide an export|not exported|SyntaxError/.test(e))&&!consoleErrors.length,'no page or module errors in the console');
}catch(error){log('ERROR',error.stack);failures++;}
finally{await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true});log('done · failures',failures);process.exitCode=failures?1:0;}
