// Director: editing a prop (typed position, scale, a gizmo move) must not snap the camera back to the film's camera.
// The user orbits somewhere handy, then moves things around; the view stays where they put it.
// folder (never ~/Downloads). Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-props-e2e.mjs
// SHOTS=<dir> keeps the screenshots and the before / after stills there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {root,HQ,chapterList,wait} from './director-e2e-harness.mjs';
import {filmPropEdits,propKey} from '../experience/prop-edits.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-props-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
// The scratch state: the checkout's, without the autosave ring and the saved cuts (several MB that leave no room in
// this browser's storage for the Director's draft, which the test reads).
const stateFile=path.join(tmp,'studio-state.json');{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));for(const k of ['ergoflexProjectAutosaveV1','ergoflex.clientCuts.v1'])delete st.keys[k];fs.writeFileSync(stateFile,JSON.stringify(st));}
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});}),BASE=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',stateFile,'--root',root],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.once('exit',c=>fail(Error('studio server exited '+c)));});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'director-props-profile-'));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:profile,defaultViewport:{width:1600,height:1000},
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
const page=await browser.newPage(),cdp=await page.createCDPSession(),errors=[];
await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
// Live reload off (this checkout may change under the test); the shared-state sync stays on, against the temp state.
// The chapter films now carry director edits of their own (Commons: 33) (sceneEdits with director:true). This test is about the
// editor's mechanics on an unedited chapter (chip counts, one draft entry per change), so the editor is served the
// film without them; every other request goes through untouched.
await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/__studio/reload.js'},{urlPattern:'*/director-film/*.json*'}]});
cdp.on('Fetch.requestPaused',async e=>{
  if(/director-film\/[\w-]+\.json/.test(e.request.url)){
    try{const film=JSON.parse(fs.readFileSync(path.join(root,HQ,'director-film',e.request.url.match(/director-film\/([\w-]+\.json)/)[1]),'utf8'));film.sceneEdits=(film.sceneEdits||[]).filter(x=>!x.director);
      return await cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'},{name:'cache-control',value:'no-store'}],body:Buffer.from(JSON.stringify(film)).toString('base64')});}
    catch{return cdp.send('Fetch.continueRequest',{requestId:e.requestId}).catch(()=>{});}
  }
  cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/javascript'}],body:Buffer.from('/* blocked */').toString('base64')}).catch(()=>{});
});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{const t=m.text();if(/not exported|does not provide an export|SyntaxError/.test(t))errors.push(t);if(process.env.LOG)console.log('[page]',t.slice(0,240));});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const status=()=>page.$eval('#director-panel [data-status]',e=>e.textContent).catch(()=>'');
const studioAssets=async()=>(await (await fetch(BASE+'/api/studio-state')).json()).values['ergoflex.sceneAssets.v1'];
const until=async(fn,what,ms=20000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
async function openChapter(id){
  const c=chapterList().find(x=>x.id===id);await page.goto(BASE+c.page);
  await page.waitForFunction(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(1200);
}
// In the page: the stage, our gizmo, objects by name / Studio key, screen points.
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow,t=w.ErgoPresentation.three();return {w,t,T:w.__directorThree.THREE};};
  window.__gizmo=()=>{const {t}=__t();let g=null;t.scene.traverse(o=>{if(o.isTransformControls&&o.userData.directorTools&&o.object&&o.visible)g=o;});return g;};
  window.__find=(test,scene)=>{let o=null;(scene||__t().t.scene).traverse(x=>{if(!o&&test(x))o=x;});return o;};
  window.__screen=o=>{const {t,T}=__t(),f=document.getElementById('stage'),c=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(t.camera),r=t.renderer.domElement.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+(c.x+1)/2*r.width,y:fr.top+r.top+(1-c.y)/2*r.height};};
  window.__pose=o=>{const {T}=__t();o.updateWorldMatrix(true,false);return {p:o.getWorldPosition(new T.Vector3()).toArray(),q:o.getWorldQuaternion(new T.Quaternion()).toArray(),s:o.getWorldScale(new T.Vector3()).toArray(),visible:(()=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;})()};};
  window.__draft=()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0].propEdits||null;}catch{return null;}};
});
const draft=()=>page.evaluate(()=>__draft());
const CHAIR='Prop:steelcase-leap-v2',MONITOR='Prop:ergoflex-wide-monitor';
const pose=name=>page.evaluate(n=>__pose(__find(x=>x.name===n)),name);
const near=(a,b,eps=2e-3)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=eps);
// A real drag on the gizmo: find the handle (axis) by hovering, then drag it.
async function dragHandle(axes,dir){
  const c=await page.evaluate(()=>__screen(__gizmo().object));let best=null;
  for(let r=10;r<240;r+=6)for(let a=0;a<360;a+=10){
    const x=c.x+r*Math.cos(a*Math.PI/180),y=c.y+r*Math.sin(a*Math.PI/180);await page.mouse.move(x,y);
    const axis=await page.evaluate(()=>__gizmo()?.axis);if(axes.includes(axis)&&(!best||r>best.r))best={r,a,x,y,axis};
  }
  if(!best)throw Error('no gizmo handle '+axes.join('/'));
  // The handle's outer end (scale: away from the centre, where the pointer ratio is sane).
  const {a,axis}=best,x=c.x+(best.r-4)*Math.cos(a*Math.PI/180),y=c.y+(best.r-4)*Math.sin(a*Math.PI/180);
  const [dx,dy]=dir==='tangent'?[-Math.sin(a*Math.PI/180)*70,Math.cos(a*Math.PI/180)*70]:[Math.cos(a*Math.PI/180)*45,Math.sin(a*Math.PI/180)*45];
  await page.mouse.move(x,y);await page.mouse.down();for(let i=1;i<=6;i++){await page.mouse.move(x+dx*i/6,y+dy*i/6);await wait(30);}await page.mouse.up();await wait(500);return axis;
}
async function setField(name,value){await page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(900);}
async function stillOf(file){
  const before=await page.$$eval('.still-strip img, .still-view img, [data-still] img',l=>l.length).catch(()=>0);
  await page.keyboard.press('r');
  await until(async()=>/Still rendered/.test(await status()),'Render still',240000);
  const url=await page.evaluate(()=>document.querySelector('#film-still img.still-main')?.src||null);
  if(url&&file)fs.writeFileSync(file,Buffer.from(url.split(',')[1],'base64'));
  await page.keyboard.press('Escape');await wait(400);return url;   // back to the live view
}
const cam=()=>page.evaluate(()=>{const {t}=__t(),c=t.camera;return {p:c.position.toArray(),t:t.controls.target.toArray(),fov:c.fov};});
const same=(a,b,eps=1e-4)=>a.p.every((v,i)=>Math.abs(v-b.p[i])<eps)&&a.t.every((v,i)=>Math.abs(v-b.t[i])<eps)&&Math.abs(a.fov-b.fov)<1e-6;
try{
  await openChapter('commons');
  await page.evaluate(()=>document.querySelector('[data-inspector-tab=lighting]').click());
  const at=await page.evaluate(n=>__screen(__find(x=>x.name===n)),CHAIR);await page.mouse.click(at.x,at.y);await wait(900);
  check(await page.evaluate(()=>__gizmo()?.object?.name)===CHAIR,'the chair is selected');
  // Orbit somewhere else (what dragging the view does: move the camera and its orbit target).
  await page.evaluate(()=>{const {t}=__t(),c=t.camera;c.position.x+=0.6;c.position.y+=0.35;c.position.z-=0.4;t.controls.target.x+=0.1;t.controls.update();});await wait(500);
  const orbit=await cam();
  const px=await page.$eval('#director-panel [name="pp-px"]',e=>Number(e.value));
  await setField('pp-px',px+0.25);await wait(900);
  check(/Moved/.test(await status()),'typed position is applied: '+await status());
  check(same(await cam(),orbit),'camera stays where it was after a typed position change: '+JSON.stringify({before:orbit,after:await cam()}));
  await setField('pp-s',1.2);await wait(900);
  check(/Scaled/.test(await status()),'typed size is applied: '+await status());
  check(same(await cam(),orbit),'camera stays after a size change');
  const pz=await page.$eval('#director-panel [name="pp-pz"]',e=>Number(e.value));await setField('pp-pz',pz+0.2);await wait(900);
  check(same(await cam(),orbit),'camera stays after another move');
  // Undo is also an edit
  await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await wait(900);
  check(same(await cam(),orbit),'camera stays after Undo');
  await page.keyboard.down('Control');await page.keyboard.press('y');await page.keyboard.up('Control');await wait(900);
  check(same(await cam(),orbit),'camera stays after Redo');
  await dragHandle(['X','Y','Z'],'radial');
  check(/^Moved /.test(await status()),'gizmo drag is applied: '+await status());
  check(same(await cam(),orbit),'camera stays after a gizmo drag');
  await page.mouse.move(5,5);await page.keyboard.press('Delete');await wait(900);
  check(/Hid /.test(await status()),'Delete hides the prop: '+await status());
  check(same(await cam(),orbit),'camera stays after hiding a prop');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
  console.log(passed.map(p=>'ok  '+p).join('\n'));
  console.log(`Director camera-stays e2e: ${passed.length} checks passed.`);
}catch(error){
  console.log(passed.map(p=>'ok  '+p).join('\n'));await page.screenshot({path:path.join(shots,'camera-stays-failure.png')}).catch(()=>{});console.error('FAILED:',error.message,'\nstatus:',await status(),'\nerrors:',errors.join(' | '));process.exitCode=1;
}finally{await browser.close().catch(()=>{});server.kill();fs.rmSync(profile,{recursive:true,force:true});if(!process.env.SHOTS)fs.rmSync(tmp,{recursive:true,force:true});else fs.rmSync(downloads,{recursive:true,force:true});}
