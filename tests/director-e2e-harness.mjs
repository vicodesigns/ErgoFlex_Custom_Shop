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
    {const from=process.env.STATE_FROM||path.join(root,'studio-state.json');if(plan.copyState&&fs.existsSync(from)){const st=JSON.parse(fs.readFileSync(from,'utf8'));delete st.keys?.['ergoflex.director.filmDrafts.v1'];delete st.keys?.['ergoflex.director.ui.v1'];fs.writeFileSync(state,JSON.stringify(st));}}   // (without anyone's film drafts: a chapter opens as the film has it)   // (STATE_FROM: a saved state to start the scratch copy from)
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
  const close=async()=>{await browser.close().catch(()=>{});server?.kill();try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300});}catch{}};
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

// Film chapters keep their unexported draft in 'ergoflex.director.filmDrafts.v1' ({'<cut id>': {cut, at, base}},
// experience/film-fresh.mjs, since 6 Nov 2026), not in the cut library 'ergoflex.clientCuts.v1'. The Director stamps
// <body data-cut-id data-draft-store="film|library"> (director.mjs stampDraft), so tests read "the active cut" through
// this expression (inline in their page.evaluate code: puppeteer sends the function's text to the page), shaped like
// the library ({active, drafts, cuts}) so `v.drafts[v.active]` still finds it; no film draft yet reads as none.
export const FILM_DRAFT_READER="(()=>{const b=document.body.dataset;if(b.draftStore!=='film')return JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));let f={};try{f=JSON.parse(localStorage.getItem('ergoflex.director.filmDrafts.v1')||'{}')||{};}catch{}const d=f[b.cutId]?.cut;return {active:'film',drafts:d?{film:d}:{},cuts:[]};})()";

// ---- people live on the stage (19 Nov 2026) --------------------------------------------------------------------
// Windows found the cine cut's coast chapter with nobody on the Director's stage (workspaceRoom.people.enabled false,
// list() empty) although its film has a cast. peopleState says what the stage has; ensureLivePeople, when they are
// off, prints that state and the page's [people] / [film setup] / [film fx] / [desk versions] warnings (watchStage
// collects them from the start), then turns them on the way the player does for a film chapter
// (ErgoPresentation.peopleTrack(<film's people>, <chapter id>) -> studio setRoomPeople), so a test of the editors can
// go on, and the run's log says that the product left them off.
export function watchStage(page){
  const lines=[];page.on('console',m=>{const t=m.text();if(/\[(people|film setup|film fx|desk versions|stage)\]/.test(t))lines.push(t.slice(0,300));});return lines;
}
export const peopleState=page=>page.evaluate(()=>{const w=document.getElementById('stage').contentWindow,api=w.ErgoFlex,r=api?.workspaceRoom,p=r?.people;
  return {flag:api?.roomPeople??null,room:r?.id||null,look:r?.look??null,layout:r?.roomLayout?.id||null,stations:r?.roomLayout?.stations?.length??0,hasPeople:!!p,enabled:!!p?.enabled,filter:!!p?.filter,filterCast:p?.filter?.cast?.length??null,available:p?p.available:null,count:p?.people?.length??0,shown:p?p.people.filter(o=>o.visible).length:0};});
export async function ensureLivePeople(page,{id,filmPeople,warnings=[],log=console.log,ms=30000}){
  const ready=s=>s.enabled&&s.count>0;let s=await peopleState(page);
  for(const end=Date.now()+8000;!ready(s)&&Date.now()<end;){await wait(500);s=await peopleState(page);}
  if(ready(s))return {forced:false,state:s};
  log(`NOTE people are off on the Director's stage for ${id}: ${JSON.stringify(s)}${warnings.length?' · page warnings: '+warnings.join(' | '):' · no page warnings'}`);
  if(!filmPeople)throw Error('people are off and the film has no cast to turn on');
  await page.evaluate((p,id)=>document.getElementById('stage').contentWindow.ErgoPresentation.peopleTrack?.(p,id),filmPeople,id);
  for(const end=Date.now()+ms;!ready(s);){if(Date.now()>end)throw Error('people still off after peopleTrack: '+JSON.stringify(s));await wait(500);s=await peopleState(page);}
  log(`NOTE turned them on through ErgoPresentation.peopleTrack (the player's own call): ${JSON.stringify(s)}`);
  return {forced:true,state:s};
}

// ---- points in the view that really hit something (19 Nov 2026) ------------------------------------------------------
// Windows: clicks at a person's projected middle selected nobody on the cine coast (a desk, a monitor or a partition in
// front of them), and no featured-desk accessory was found by its box. pickInView casts rays through a grid of the
// stage view (the stage's own camera, the editors' three.js) and keeps the first visible mesh each ray meets, so a point
// it returns is one a click there reaches. kind: 'person' (an ancestor with userData.person; key / editKey / id /
// featured: the film desk's user), 'item' (a child of a desk mount: "Accessory mount:*" on the film desk, "Desk
// dressing:*" on the room's desks), 'room' (neither). Returns { found: [{ ...info, n: rays that met it, x, y: the page
// point of its ray nearest the middle of its rays }], biggest first, kinds: what the rays met, by count } or { why }.
export const pickInView=(page,kind,{grid=[24,14]}={})=>page.evaluate((kind,grid)=>{
  const f=document.getElementById('stage'),w=f.contentWindow,t=w.ErgoPresentation?.three?.(),T=w.__directorThree?.THREE;
  if(!t||!T)return {why:'the stage or the editors\' three.js is not ready'};
  const r=f.getBoundingClientRect(),ray=new T.Raycaster(),people=w.ErgoFlex.workspaceRoom?.people;t.scene.updateMatrixWorld(true);
  const shown=o=>{for(let a=o;a;a=a.parent){if(!a.visible||a.userData?.directorTools||a.isTransformControls)return false;}return true;};
  const personOf=o=>{for(let a=o;a;a=a.parent)if(a.userData?.person)return a;return null;};
  const itemOf=o=>{for(let a=o;a&&a.parent;a=a.parent)if(/^(Accessory mount|Desk dressing):/.test(a.parent.name||''))return a;return null;};
  const found=new Map(),kinds={};
  for(let i=0;i<grid[0];i++)for(let j=0;j<grid[1];j++){
    const nx=-.92+1.84*(i+.5)/grid[0],ny=-.92+1.84*(j+.5)/grid[1];ray.setFromCamera(new T.Vector2(nx,ny),t.camera);
    const hit=ray.intersectObjects(t.scene.children,true).find(h=>h.object.isMesh&&shown(h.object)&&[].concat(h.object.material||[]).some(m=>m&&m.visible!==false));
    if(!hit)continue;
    const p=personOf(hit.object),it=!p&&itemOf(hit.object),k=p?'person':it?'item':'room';kinds[k]=(kinds[k]||0)+1;if(k!==kind)continue;
    const o=p||it||hit.object;let e=found.get(o);
    if(!e){const s=p?.userData.person;e={n:0,pts:[],name:o.name||o.userData?.propId||'(unnamed)',...(s?{key:people?.keyOf?.(s)??null,editKey:people?.editKeyOf?.(s)??null,id:s.id,featured:!!s.desk&&!s.station,variant:s.variant||null}:{})};found.set(o,e);}
    e.n++;e.pts.push([r.left+(nx+1)/2*r.width,r.top+(1-ny)/2*r.height]);
  }
  const out=[...found.values()].map(({pts,...e})=>{const mx=pts.reduce((a,p)=>a+p[0],0)/pts.length,my=pts.reduce((a,p)=>a+p[1],0)/pts.length,b=pts.sort((a,c)=>Math.hypot(a[0]-mx,a[1]-my)-Math.hypot(c[0]-mx,c[1]-my))[0];return {...e,x:b[0],y:b[1]};}).sort((a,b)=>b.n-a.n);
  return {found:out,kinds};
},kind,grid);
// Aims the Director's free view at a person of the stage (people.byKey(key)): the orbit pivot on their middle, the
// camera `distance` m away at azimuth `turn` degrees around them, raised `rise` m. Setup for a test whose chapter's film
// camera never frames anyone but the film desk's user (the cine coast). The view stays where it is put (the Director
// leaves a free view alone until a seek or playback). Returns the person's middle, or null.
export const aimAt=(page,key,{turn=0,distance=3,rise=.8}={})=>page.evaluate((key,turn,distance,rise)=>{
  const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation?.three?.(),T=w.__directorThree?.THREE,o=w.ErgoFlex.workspaceRoom?.people?.byKey?.(key);
  if(!t||!T||!o||!o.visible)return null;
  const b=new T.Box3().setFromObject(o);if(b.isEmpty())return null;const c=b.getCenter(new T.Vector3()),a=turn*Math.PI/180;
  t.camera.position.set(c.x+Math.sin(a)*distance,c.y+rise,c.z+Math.cos(a)*distance);t.controls.target.copy(c);t.camera.lookAt(c);t.controls.update?.();t.camera.updateMatrixWorld(true);
  w.ErgoPresentation.wake?.(800);return c.toArray();
},key,turn,distance,rise);
