// Shared harness for the Director end-to-end tests (real GPU Chrome, not tests/cinematic-* quick tests).
// Serves this checkout (tools/studio-server.mjs on a free port, studio state in a temp copy) unless BASE is given,
// blocks the studio sync / live-reload scripts and the state API, denies downloads, and collects page errors and
// module "not exported" errors. Run the tests under flock /tmp/claude-1000/hq12-stills.lock.
//
// openDirectorBrowser({shared:true}) (opt-in, for the Studio <-> Director exchange: Refresh from Studio, Adopt, Make
// permanent): the page is NOT cut off from the shared state: /api/studio-state and /__studio/sync.js are served as the
// studio server serves them. EXPOSURE: the page then reads and writes that server's copy of every shared key, the cut
// drafts ('ergoflex.clientCuts.v1') and the Studio's room state included. That is acceptable ONLY because it is always the
// harness' OWN scratch server on a free port with a scratch state file in a new temp directory that starts EMPTY (no
// drafts, no Studio edits of anyone's): BASE is refused with it, port 3000 and the committed studio-state.json are
// refused (tests/director-e2e-options.mjs harnessServer -> the Studio e2e's serverArgs rules). The returned `stateFile`
// and `base` let a test write to and read from that server as the Studio would.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {harnessServer} from './director-e2e-options.mjs';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const HQ=process.env.HQ||'exports/cinematic-intro-20261104-hq14';
export const chapterList=()=>{const f=path.join(root,HQ,'director-chapters.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).chapters:null;};
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});

// VIEW=2560x1440 (env) runs any Director e2e at that window size (the big-screen scale, the 1080p layout).
const VIEW=(process.env.VIEW||'').match(/^(\d+)x(\d+)$/);
export async function openDirectorBrowser({width=VIEW?Number(VIEW[1]):1600,height=VIEW?Number(VIEW[2]):1000,shared=false}={}){
  let server=null,base=process.env.BASE,stateFile=null;
  if(shared&&base)throw Error('shared state runs only against the harness\'s own scratch server: unset BASE');
  if(!base){
    const port=await freePort(),state=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'director-e2e-')),'studio-state.json');stateFile=state;
    const plan=harnessServer({root,port,stateFile:state,shared});
    if(plan.copyState&&fs.existsSync(path.join(root,'studio-state.json')))fs.copyFileSync(path.join(root,'studio-state.json'),state);
    server=spawn(process.execPath,plan.args,{cwd:root,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);resolve();}});server.once('exit',c=>reject(Error('studio server exited '+c)));});
    base=`http://127.0.0.1:${port}`;
  }
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'director-e2e-profile-'));
  const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width,height},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
  const errors=[],page=await browser.newPage(),cdp=await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior',{behavior:'deny'}).catch(()=>{});
  // (shared: nothing intercepted; the default: the page cut off from the shared state)
  if(!shared)await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/__studio/*'},{urlPattern:'*/api/studio-state*'}]});
  cdp.on('Fetch.requestPaused',e=>{
    if(/__studio\/(sync|reload)\.js/.test(e.request.url))cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from('/* blocked */').toString('base64')}).catch(()=>{});
    else cdp.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});
  });
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError/.test(t))errors.push(t);});
  const close=async()=>{await browser.close().catch(()=>{});server?.kill();fs.rmSync(profile,{recursive:true,force:true});};
  return {base,browser,page,errors,close,stateFile,shared};
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
