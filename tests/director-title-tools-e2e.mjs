// Director Mode e2e, title tools M1: + Title at the playhead, Duplicate, Delete (button, Delete key, Ctrl+D), Undo / Redo,
// the draft (reload keeps the list, an emptied chapter included), Export cut -> build-round8-director.py --import into
// a scratch titles-src.json -> finish-intro.py --titles-only shows the new and the duplicated title.
//   CHROME=<chrome.exe> node tests/director-title-tools-e2e.mjs [--shots DIR]
// Starts its own studio server on a free port (state in a temp copy), opens the rise fixture chapter
// (tests/fixtures/director-titles) in Chrome.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {default:puppeteer}=await import('puppeteer-core');
const shots=process.argv.includes('--shots')?process.argv[process.argv.indexOf('--shots')+1]:null;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-title-tools-e2e-')),downloads=path.join(tmp,'downloads');fs.mkdirSync(downloads);
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
let failures=0;const check=(ok,label)=>{log(ok?'PASS':'FAIL',label);if(!ok)failures++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=await new Promise(res=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
fs.copyFileSync(path.join(root,'studio-state.json'),path.join(tmp,'state.json'));
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',path.join(tmp,'state.json')],{cwd:root,stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/experience/`)).ok)break;}catch{}await sleep(100);}
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:path.join(tmp,'profile'),defaultViewport:{width:1920,height:1080},args:['--no-sandbox','--ignore-gpu-blocklist','--mute-audio']});
const page=await browser.newPage();const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
const done=[];cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')done.push(path.join(downloads,e.guid));});
const consoleErrors=[];page.on('pageerror',e=>{log('pageerror',e.message);consoleErrors.push(e.message);});page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|\[film fx\]/.test(m.text())){consoleErrors.push(m.text());log('console error',m.text().slice(0,200));}});
const ev=(fn,...a)=>page.evaluate(fn,...a);
const statusText=()=>ev(()=>document.querySelector('#director-panel [data-status]')?.textContent||'');
async function exportCut(){const n=done.length;await page.$eval('#director-panel [data-action=save-export]',b=>b.click());for(let i=0;i<200&&done.length===n;i++)await sleep(100);return JSON.parse(fs.readFileSync(done.at(-1),'utf8'));}
const blocks=()=>ev(()=>[...document.querySelectorAll('[data-title-clip]')].map(b=>({id:b.dataset.titleClip,text:b.querySelector('strong').textContent,time:b.querySelector('small').textContent,selected:b.classList.contains('selected')})));
const playhead=()=>ev(()=>Number(document.querySelector('[name=timeline-seconds]')?.value));
const click=sel=>ev(sel=>{const b=document.querySelector(sel);if(!b)throw Error('missing '+sel);b.click();},sel);
async function openChapter(){
  await page.goto(`http://127.0.0.1:${port}/tests/fixtures/director-titles/director-ch02-rise.html`,{timeout:180000});
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:240000});
  await page.waitForFunction(()=>document.querySelector('[data-title-add]'),{timeout:20000});await sleep(1200);
}
try{
  await openChapter();
  let b=await blocks();check(b.length===1&&/Your height/.test(b[0].text),'the rise chapter opens with its one film title');
  check(await ev(()=>!!document.querySelector('[data-title-add]')&&document.querySelector('[data-title-add]').textContent.includes('+ Title')),'the Titles lane has a + Title button');
  // 1. + Title at the playhead (click the lane at 11 s first)
  await ev(()=>{const r=document.querySelector('[data-title-lane]').getBoundingClientRect();const x=r.left+r.width*11/16,y=r.top+4;const el=document.elementFromPoint(x,y);el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));});await sleep(400);
  const at=await playhead();log('playhead',at);
  await click('[data-title-add]');await sleep(700);
  b=await blocks();const added=b.find(x=>/New headline/.test(x.text));log('after add',JSON.stringify(b));
  check(b.length===2&&added&&added.selected,'+ Title adds a selected block with the placeholder headline');
  check(added&&added.time===`${Number(Math.min(at,11).toFixed(2))}–${Number((Math.min(at,11)+5).toFixed(2))}s`,'the new title starts at the playhead and lasts 5 s inside the chapter: '+added?.time);
  const insp=await ev(()=>({tab:document.querySelector('[data-inspector-tab=title]')?.getAttribute('aria-pressed'),title:document.querySelector('#director-panel [data-inspector-page=title] [name=ft-title]')?.value,eyebrow:document.querySelector('#director-panel [data-inspector-page=title] [name=ft-eyebrow]')?.value,overlay:[...document.querySelectorAll('.title-card text')].map(t=>t.textContent)}));
  log('inspector',JSON.stringify(insp));
  check(insp.tab==='true'&&insp.title==='New headline'&&insp.eyebrow==='EYEBROW','the Title inspector opens on the new title');
  check(insp.overlay.includes('New headline')&&insp.overlay.includes('Supporting text'),'the frame overlay draws the new title');
  if(shots)await page.screenshot({path:path.join(shots,'title-added.png')});
  // type its copy
  await ev(()=>{const el=document.querySelector('#director-panel [data-inspector-page=title] [name=ft-title]');el.value='Made in Director';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});await sleep(300);
  // 2. Undo / Redo
  await click('#director-panel [data-action=undo]');await sleep(400);await click('#director-panel [data-action=undo]');await sleep(500);
  check((await blocks()).length===1,'Undo (twice: copy, then add) removes the added title');
  await click('#director-panel [data-action=redo]');await sleep(400);await click('#director-panel [data-action=redo]');await sleep(500);
  b=await blocks();check(b.length===2&&b.some(x=>/Made in Director/.test(x.text)),'Redo brings it back with its copy');
  // 3. Duplicate (button) the film title
  const orig=b.find(x=>/Your height/.test(x.text));
  await page.click(`[data-title-clip="${orig.id}"] strong`);await sleep(600);
  await click('#director-panel [data-title-action=duplicate]');await sleep(600);
  b=await blocks();const dups=b.filter(x=>/Your height/.test(x.text));log('after duplicate',JSON.stringify(b));
  check(b.length===3&&dups.length===2&&dups.some(x=>x.selected&&x.id!==orig.id),'Duplicate adds a selected copy of the title');
  check(dups.find(x=>x.id!==orig.id)?.time==='9.4–15.2s','the copy sits right after the original (9.4–15.2 s)');
  // 4. Ctrl+D duplicates, Delete deletes (keyboard, focus on the page)
  await ev(()=>document.activeElement?.blur());await page.keyboard.down('Control');await page.keyboard.press('KeyD');await page.keyboard.up('Control');await sleep(600);
  check((await blocks()).length===4,'Ctrl+D duplicates the selected title');
  await ev(()=>document.activeElement?.blur());await page.keyboard.press('Delete');await sleep(600);
  check((await blocks()).length===3,'Delete removes the selected title');
  check(/deleted/.test(await statusText()),'the message line says it was deleted: '+await statusText());
  // 5. Export cut carries the list; import -> titles-src; finish-intro shows the new and duplicated titles
  const cut=await exportCut(),ft=cut.shots[0].filmTitles;log('export',JSON.stringify(ft.map(t=>[t.id,t.title,t.rel_in,t.rel_out])));
  check(ft.length===3&&ft.some(t=>t.title==='Made in Director'&&t.timed)&&ft.filter(t=>t.title==='Your height. Your rhythm.').length===2,'Export cut carries the new and duplicated titles');
  const H=path.join(tmp,'hq');fs.mkdirSync(H);for(const f of ['titles-src.json','edl.json'])fs.copyFileSync(path.join(root,'tests/fixtures/director-titles',f),path.join(H,f));
  const key=at=>({at,position:[1,1,1],target:[0,0,0],fov:35});
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[{id:'awaken',seconds:44.85,cameraPlan:{keys:[key(0),key(44.85)]}},{id:'rise',seconds:16,cameraPlan:{keys:cut.shots[0].camera.keys.map(k=>key(k.time*16))}}]}));
  const before=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8'));
  const ef=path.join(tmp,'Film-chapter-rise-16-s-.json');fs.writeFileSync(ef,JSON.stringify(cut));
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ef],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  let src=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8'));
  check(src.titles.filter(t=>t.chapter==='rise').map(t=>t.title).join('|')===ft.map(t=>t.title).join('|'),'import writes the three rise titles into titles-src.json');
  check(JSON.stringify(src.titles.filter(t=>t.chapter!=='rise'))===JSON.stringify(before.titles.filter(t=>t.chapter!=='rise')),'the other chapters\' titles are untouched');
  execFileSync('python3',[path.join(root,'tools/experience/finish-intro.py'),H,'--titles-only'],{stdio:'ignore'});
  const ass=fs.readFileSync(path.join(H,'final/titles.ass'),'utf8');
  check(ass.includes('Made in Director')&&(ass.match(/,Title,,[^\n]*Your height\. Your rhythm\./g)||[]).length===2,'finish-intro titles.ass burns the new and the duplicated title');
  // 6. delete every title: the lane stays with + Title, the draft keeps it after a reload, the export says []
  for(let i=0;i<5&&(await blocks()).length;i++){const id=(await blocks())[0].id;await ev(id=>document.querySelector(`[data-title-clip="${id}"]`).focus(),id);await page.keyboard.press('Delete');await sleep(500);}
  check((await blocks()).length===0&&await ev(()=>!!document.querySelector('[data-title-add]')),'every title deleted (Delete on a focused block): the lane stays, with + Title');
  check(await ev(()=>/no titles/.test(document.querySelector('#director-panel [data-inspector-page=title]')?.textContent||'')),'the Title tab says the chapter has no titles and offers + Add title');
  // The draft: a film chapter keeps its unexported changes in film-fresh's store ('ergoflex.director.filmDrafts.v1');
  // a reload reads it back through cleanCut (film-fresh storedDraft). The [] must survive that.
  await sleep(1000);
  const kept=await ev(async()=>{const {cleanCut}=await import('/experience/cuts.mjs');const fd=JSON.parse(localStorage.getItem('ergoflex.director.filmDrafts.v1')||'{}');const d=fd['film-rise'];return {raw:d?.cut?.shots?.[0]?.filmTitles,clean:d?cleanCut(d.cut).shots[0].filmTitles:null};});
  log('draft',JSON.stringify(kept));
  check(Array.isArray(kept.raw)&&!kept.raw.length&&Array.isArray(kept.clean)&&!kept.clean.length,'the draft keeps the chapter without titles ([] stored and read back through cleanCut, so the film titles do not come back)');
  const empty=await exportCut();check(Array.isArray(empty.shots[0].filmTitles)&&empty.shots[0].filmTitles.length===0,'Export cut says filmTitles: []');
  fs.writeFileSync(ef,JSON.stringify(empty));
  execFileSync('python3',[path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ef],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  src=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8'));
  check(!src.titles.some(t=>t.chapter==='rise')&&JSON.stringify(src.titles)===JSON.stringify(before.titles.filter(t=>t.chapter!=='rise')),'import of the emptied chapter removes its entries, other chapters untouched');
  // 7. + Title on the empty chapter, then Undo
  await click('[data-title-add]');await sleep(600);check((await blocks()).length===1,'+ Title on an empty chapter adds the first title');
  // 8. M2: line spacing and per-line offsets in the Title inspector, live in the frame, in the export
  const textY=()=>ev(()=>[...document.querySelectorAll('.title-card text')].filter((_,i)=>i%2===1).map(t=>[t.textContent,Number(t.getAttribute('x')),Number(t.getAttribute('y'))]));
  const set=(sel,v)=>ev(([sel,v])=>{const el=document.querySelector('#director-panel [data-inspector-page=title] '+sel);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},[sel,v]);
  const gaps=await ev(()=>[...document.querySelectorAll('#director-panel [data-gap]')].map(e=>Number(e.value)));
  check(JSON.stringify(gaps)==='[100,58]','Line spacing shows the film\'s gaps (eyebrow to headline 100, headline to supporting 58)');
  const y0=await textY();await set('[data-gap=top]',80);await sleep(400);const y1=await textY();log('gap',JSON.stringify([y0,y1]));
  check(y0.length===3&&Math.abs(y1[0][2]-y0[0][2]-20)<.01&&y1[1][2]===y0[1][2]&&y1[2][2]===y0[2][2],'Eyebrow to headline 80: the eyebrow comes 20 px closer, the others stay');
  await set('[data-type=dx][data-line=detail]',15);await sleep(400);const y2=await textY();
  check(Math.abs(y2[2][1]-y0[2][1]-15)<.01&&y2[1][1]===y0[1][1],'Supporting text Move right 15: only that line moves');
  if(shots)await page.screenshot({path:path.join(shots,'title-lines.png')});
  const lined=await exportCut();const lt=lined.shots[0].filmTitles[0].typography;log('typography',JSON.stringify(lt));
  check(lt?.eyebrow?.dy===20&&lt?.detail?.dx===15&&!lt.title,'Export cut carries the line offsets (eyebrow dy 20, supporting dx 15)');
  check(await ev(()=>!document.querySelector('#director-panel [data-title-action=reset-lines]').disabled),'Reset line positions is enabled as soon as a line moves');
  await click('#director-panel [data-title-action=reset-lines]');await sleep(400);
  check(JSON.stringify(await textY())===JSON.stringify(y0),'Reset line positions puts every line back');
  await click('#director-panel [data-action=undo]');await sleep(400);
  check(JSON.stringify(await textY())===JSON.stringify(y2),'Undo brings the moved lines back');
  // 9. A real reload of the film draft (film-fresh on): delete the chapter's titles, reload the page; the draft comes back
  // at once, or film-fresh offers it (Keep my unexported changes); either way the chapter stays without titles.
  for(let i=0;i<5&&(await blocks()).length;i++){const id=(await blocks())[0].id;await ev(id=>document.querySelector(`[data-title-clip="${id}"]`).focus(),id);await page.keyboard.press('Delete');await sleep(500);}
  check((await blocks()).length===0,'before the reload: no titles');await sleep(1500);
  await page.reload({timeout:180000});
  await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:240000});
  await page.waitForFunction(()=>document.querySelector('[data-title-add]'),{timeout:20000});await sleep(1500);
  const notice=await ev(()=>({fresh:!!document.querySelector('[data-film-fresh]'),text:document.querySelector('[data-film-fresh]')?.textContent||'',keep:!!document.querySelector('[data-action=film-keep-draft]'),pressed:document.querySelector('[data-action=film-keep-draft]')?.getAttribute('aria-pressed')}));
  log('after reload',JSON.stringify({notice,blocks:await blocks()}));
  if(notice.keep&&notice.pressed!=='true'){await click('[data-action=film-keep-draft]');await sleep(1200);}
  check((await blocks()).length===0,`after a real reload the chapter is still without titles (${notice.keep?'film-fresh offered the draft: '+(notice.pressed==='true'?'already loaded':'Keep my unexported changes'):'draft loaded at once'})`);
  check(!consoleErrors.length,'no page or module errors in the console');
}catch(error){log('ERROR',error.stack);failures++;}
finally{await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:300});log('done · failures',failures);process.exitCode=failures?1:0;}
