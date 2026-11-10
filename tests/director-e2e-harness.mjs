// Shared harness for the Director end-to-end tests (real GPU Chrome, not tests/cinematic-* quick tests).
// Serves this checkout (tools/studio-server.mjs on a free port, studio state in a temp copy) unless BASE is given,
// blocks the studio sync / live-reload scripts and the state API, denies downloads, and collects page errors and
// module "not exported" errors. Run the tests under flock /tmp/claude-1000/hq12-stills.lock.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const HQ=process.env.HQ||'exports/cinematic-intro-20261104-hq14';
export const chapterList=()=>{const f=path.join(root,HQ,'director-chapters.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).chapters:null;};
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});

export async function openDirectorBrowser({width=1600,height=1000}={}){
  let server=null,base=process.env.BASE;
  if(!base){
    const port=await freePort(),state=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'director-e2e-')),'studio-state.json');
    if(fs.existsSync(path.join(root,'studio-state.json')))fs.copyFileSync(path.join(root,'studio-state.json'),state);
    server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',state,'--root',root,'--no-watch'],{cwd:root,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);resolve();}});server.once('exit',c=>reject(Error('studio server exited '+c)));});
    base=`http://127.0.0.1:${port}`;
  }
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'director-e2e-profile-'));
  const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width,height},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
  const errors=[],page=await browser.newPage(),cdp=await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior',{behavior:'deny'}).catch(()=>{});
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/__studio/*'},{urlPattern:'*/api/studio-state*'}]});
  cdp.on('Fetch.requestPaused',e=>{
    if(/__studio\/(sync|reload)\.js/.test(e.request.url))cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from('/* blocked */').toString('base64')}).catch(()=>{});
    else cdp.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});
  });
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError/.test(t))errors.push(t);});
  const close=async()=>{await browser.close().catch(()=>{});server?.kill();fs.rmSync(profile,{recursive:true,force:true});};
  return {base,browser,page,errors,close};
}
// A chapter page (director-chNN-*.html) up to "Camera is live".
export async function openChapter(page,base,chapter){
  await page.goto(base+chapter.page);
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  await wait(800);
}
export const status=page=>page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
export async function seek(page,seconds){
  await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},seconds);
  await wait(500);
}
