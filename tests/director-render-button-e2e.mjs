// Director "Render preview" (Render tab, experience/render-request.mjs) end to end (real GPU Chrome; not one of the quick
// tests/cinematic-* checks). Chapter "rise": the tab's scope / resolution / note fields and the honest wait estimates;
// Send on an exported chapter downloads only Render-request-rise-720p-<stamp>.json {v:1, scope, chapter, resolution, note,
// created, signature}; with unexported edits Send first downloads the Export cut file (Film-chapter-*.json), then the
// request, whose exportSha is the sha256 of that very file; the "not exported" badge clears; the Queued line and the
// last-requests list (localStorage) show it.
//
//   node tests/director-render-button-e2e.mjs        (BASE=http://127.0.0.1:3125 to use a running server)
// SHOTS=<dir> keeps screenshots (render-tab.png, render-queued.png). Downloads go to a temp folder (never ~/Downloads).
// Run it under the browser-test lock (scratchpad slot.sh).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='rise');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director render button e2e: skipped (${HQ} has no rise chapter page in this checkout).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-render-button-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const files=()=>fs.readdirSync(downloads).filter(f=>f.endsWith('.json')).sort();
try{
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await openChapter(page,base,chapter);
  const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
  const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(500);};
  const setField=async(name,value,event='change')=>{await page.evaluate((n,v,e)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event(e,{bubbles:true}));},name,value,event);await wait(300);};
  const text=sel=>page.$eval(sel,e=>e.textContent.trim()).catch(()=>'');
  const est=()=>text('#director-panel [data-render-estimate]');
  const dirtyShown=()=>page.$eval('[data-film-dirty]',e=>!e.hidden);

  // ---- the tab and its controls
  const tabs=await page.$$eval('#director-panel [data-inspector-tab]',b=>b.map(x=>x.dataset.inspectorTab));
  check(tabs.includes('render'),'inspector has a Render tab: '+tabs.join(' · '));
  await click('#director-panel [data-inspector-tab=render]');
  const ui=await page.evaluate(()=>{const q=n=>document.querySelector(`#director-panel [name="${n}"]`);return {scope:[...q('render-scope').options].map(o=>o.textContent),res:[...q('render-res').options].map(o=>o.value),note:!!q('render-note'),send:document.querySelector('#director-panel [data-render-send]')?.textContent,shown:!document.querySelector('#director-panel [data-inspector-page=render]').hidden};});
  check(ui.shown&&ui.note&&/Send/.test(ui.send),'Render page shows the note field and a Send button ('+ui.send+')');
  check(ui.scope.length===2&&/^This chapter/.test(ui.scope[0])&&ui.scope[1]==='Whole film','scope: '+ui.scope.join(' / '));
  check(ui.res.join()==='480p,720p,1080p,4K','resolutions: '+ui.res.join(' '));

  // ---- honest estimates (chapter 720p ~3 min for an 18 s chapter, film 720p ~40 min, film 4K ~2 h)
  check(/about 3 min/.test(await est()),'This chapter · 720p: '+await est());
  await setField('render-res','4K');check(/about 8 min|about 9 min/.test(await est()),'This chapter · 4K scales up: '+await est());
  await setField('render-scope','film');check(/about 2 h/.test(await est()),'Whole film · 4K: '+await est());
  await setField('render-res','720p');check(/about 40 min/.test(await est()),'Whole film · 720p: '+await est());
  await setField('render-res','480p');await setField('render-scope','chapter');
  check(/about (1|2) min/.test(await est()),'This chapter · 480p: '+await est());
  await page.$eval('#director-panel [data-render-box]',e=>e.scrollIntoView({block:'center'}));await wait(300);
  await (await page.$('#director-panel [data-render-box]')).screenshot({path:path.join(shots,'render-tab.png'),captureBeyondViewport:false});

  // ---- Send on an exported chapter: only the request file
  await setField('render-res','720p');await setField('render-note','check the lift at 6 s','input');
  check(!(await dirtyShown()),'chapter starts exported (no "not exported" badge)');
  await click('#director-panel [data-render-send]');
  const first=await until(()=>files().find(f=>/^Render-request-/.test(f)),'request download');
  check(/^Render-request-rise-720p-\d{8}-\d{6}\.json$/.test(first),'file name '+first);
  const r1=JSON.parse(fs.readFileSync(path.join(downloads,first),'utf8'));
  check(r1.v===1&&r1.scope==='chapter'&&r1.chapter==='rise'&&r1.resolution==='720p'&&r1.note==='check the lift at 6 s','fields: '+JSON.stringify({v:r1.v,scope:r1.scope,chapter:r1.chapter,resolution:r1.resolution,note:r1.note}));
  check(!isNaN(Date.parse(r1.created))&&Math.abs(Date.now()-Date.parse(r1.created))<120000,'created ISO '+r1.created);
  check(/^[0-9a-f]{16}$/.test(r1.signature)&&r1.exportSha===null&&r1.estimateMinutes>=1,`signature ${r1.signature}, exportSha null, estimate ${r1.estimateMinutes} min`);
  check(files().length===1,'nothing but the request downloaded (no Export cut for a clean chapter): '+files().join(', '));
  const queued=await text('#director-panel [data-render-result]');
  check(/Queued for the render PC/.test(queued)&&/about 3 min/.test(queued),'result line: '+queued);
  check(/Render request sent/.test(await statusOf(page)),'status: '+await statusOf(page));
  await (await page.$('#director-panel [data-render-box]')).screenshot({path:path.join(shots,'render-queued.png'),captureBeyondViewport:false});

  // ---- Send with unexported edits: Export cut first, then the request that carries the export's sha256
  await click('#director-panel [data-inspector-tab=chapter]');
  const was=await page.$eval('#director-panel [name="transition"]',e=>e.value),next=String(Number(was)>=1?0.5:Number(was)+0.5);
  await setField('transition',next);await wait(500);
  check(await dirtyShown(),`edit (blend ${was} -> ${next} s) shows "not exported"`);
  await click('#director-panel [data-inspector-tab=render]');
  await setField('render-scope','film');await setField('render-res','1080p');await setField('render-note','','input');
  await click('#director-panel [data-render-send]');
  const second=await until(()=>files().find(f=>/^Render-request-film-1080p-/.test(f)),'second request download',30000);
  const exp=files().filter(f=>/^Film-chapter-/.test(f));
  check(exp.length===1,'Export cut file downloaded first: '+exp.join(', '));
  const r2=JSON.parse(fs.readFileSync(path.join(downloads,second),'utf8')),expText=fs.readFileSync(path.join(downloads,exp[0]));
  check(r2.scope==='film'&&r2.chapter==='rise'&&r2.resolution==='1080p'&&r2.note==='','request 2 fields: '+JSON.stringify({scope:r2.scope,chapter:r2.chapter,resolution:r2.resolution}));
  check(r2.exportSha===crypto.createHash('sha256').update(expText).digest('hex'),'exportSha is the sha256 of the downloaded Export cut file');
  check(JSON.parse(expText).shots[0].transition===Number(next),`the exported cut carries the edit (blend ${next} s)`);
  check(fs.statSync(path.join(downloads,exp[0])).mtimeMs<=fs.statSync(path.join(downloads,second)).mtimeMs+1,'export landed before the request');
  check(!(await dirtyShown()),'badge cleared: the chapter counts as exported');
  check(r2.signature!==r1.signature,`signature changed with the edit (${r1.signature} -> ${r2.signature})`);
  check(/cut exported first/.test(await text('#director-panel [data-render-result]')),'result line says the cut was exported first');
  const list=await page.$$eval('#director-panel .render-recent li',l=>l.map(x=>x.textContent.trim()));
  check(list.length===2&&/Whole film/.test(list[0])&&/Chapter rise/.test(list[1]),'recent list (newest first): '+list.join(' | '));
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ergoflex.renderRequests.v1')||'[]'));
  check(stored.length===2&&stored[0].scope==='film','localStorage keeps the last requests ('+stored.length+')');
  check(!fs.readdirSync(path.join(os.homedir(),'Downloads')).some(f=>/^Render-request-/.test(f)&&fs.statSync(path.join(os.homedir(),'Downloads',f)).mtimeMs>Date.now()-600000),'nothing written to ~/Downloads');
  check(errors.length===0,'no page errors'+(errors.length?': '+errors.slice(0,3).join(' | '):''));
}catch(error){failures.push(error.message);console.log('FAIL',error.stack);}
finally{await close();}
console.log(failures.length?`\nDirector render button e2e: ${failures.length} failure(s).`:'\nDirector render button e2e: all checks passed.');
process.exit(failures.length?1:0);
