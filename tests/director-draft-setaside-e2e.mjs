// Unexported changes survive a newer film, end to end (19 Nov 2026, real GPU Chrome). What Vico saw on the High school
// chapter: he edited, the film was updated (an Export cut and import), he reloaded, the film's version opened, he edited
// it without choosing, reloaded again, and his first edits were gone: the chapter's one draft slot had been written
// over. Now (experience/film-fresh.mjs) a draft older than the film is set aside under its own key and a modal asks.
// Against a SCRATCH copy of the hq dir (never the real one), chapter 2 (rise):
//   1. an edit in the Director (camera key's field of view 31 deg): the draft slot has it
//   2. an import updates the film (build-round8-director.py pass + pages); reload: the film's version opens, the modal
//      names the chapter and its changes; Decide later; another edit (field of view 52 deg) without choosing
//   3. reload again: the newer edit (52) loads, and the modal offers the first one (31) again: Keep brings 31 back and
//      sets 52 aside; both are recoverable; "Show them…", Use the film's version, a second question, Delete: 52 is
//      gone, 31 stays in the editor. Screenshots.
//   node tests/director-draft-setaside-e2e.mjs      SOURCE_HQ=<full hq dir, only read> (default <repo>/$HQ), PORT=3201, SHOTS=<dir>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {root,HQ,wait,openDirectorBrowser,openChapter} from './director-e2e-harness.mjs';
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'setaside-shots-'));fs.mkdirSync(SHOTS,{recursive:true});

const SOURCE=path.resolve(process.env.SOURCE_HQ||path.join(root,HQ));
if(!fs.existsSync(path.join(SOURCE,'review-cut.json'))||!fs.existsSync(path.join(SOURCE,'director-camera-rise.json'))){console.log(`Director set-aside drafts e2e: skipped (${SOURCE} has no review-cut.json / director-camera-rise.json; set SOURCE_HQ).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(process.env.SCRATCH||os.tmpdir(),'director-setaside-')),site=path.join(tmp,'site'),dl=path.join(tmp,'dl');
const H='exports/director-fresh-hq',hq=path.join(site,H);
// The scratch site: this checkout's top level linked in, exports/ a real dir with the hq copy beside links to the rest.
fs.mkdirSync(path.join(site,'exports'),{recursive:true});fs.mkdirSync(dl);
for(const e of fs.readdirSync(root))if(e!=='exports')fs.symlinkSync(path.join(root,e),path.join(site,e));
for(const e of fs.readdirSync(path.join(root,'exports')))fs.symlinkSync(path.join(root,'exports',e),path.join(site,'exports',e));
fs.mkdirSync(path.join(hq,'previews'),{recursive:true});
for(const e of fs.readdirSync(SOURCE))if(/^(shots|director-film|review-cut\.json|titles-src\.json|director-camera.*\.json|director-ch.*\.html|director-chapters\.json)$/.test(e))fs.cpSync(path.join(SOURCE,e),path.join(hq,e),{recursive:true});
if(fs.existsSync(path.join(SOURCE,'previews/awaken-v5-cut.json')))fs.copyFileSync(path.join(SOURCE,'previews/awaken-v5-cut.json'),path.join(hq,'previews/awaken-v5-cut.json'));
const builder=path.join(site,'tools/experience/build-round8-director.py');
const build=(...a)=>execFileSync('python3',[builder,H,...a],{cwd:site,encoding:'utf8'});
build('--pages','--downloads',dl);
const chapters=()=>JSON.parse(fs.readFileSync(path.join(hq,'director-chapters.json'),'utf8')).chapters,rise=()=>chapters().find(c=>c.id==='rise');
// An import from a Director export: the clip "full-height" starts at `start`, camera key 2 moves by `dx`.
const dcFile=path.join(hq,'director-camera-rise.json'),original=JSON.parse(fs.readFileSync(dcFile,'utf8'));
function importEdit(start,dx){
  const dc=structuredClone(original);dc.clips.find(c=>c.id==='full-height').start=start;dc.keys[1].position[0]+=dx;
  fs.writeFileSync(dcFile,JSON.stringify(dc,null,1));build();build('--pages','rise','--downloads',dl);
}
const decode=enc=>JSON.parse(Buffer.from(enc,'base64url').toString('utf8'));
const port=Number(process.env.PORT||3201),state=path.join(tmp,'studio-state.json');
if(fs.existsSync(path.join(root,'studio-state.json'))){const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));delete st.keys?.['ergoflex.director.filmDrafts.v1'];delete st.keys?.['ergoflex.director.filmDrafts.setAside.v1'];delete st.keys?.['ergoflex.director.ui.v1'];fs.writeFileSync(state,JSON.stringify(st));}   // (no film drafts from other sessions: tests start clean)
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',state,'--root',site],{cwd:site,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('studio server did not start')),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);resolve();}});server.once('exit',c=>reject(Error('studio server exited '+c)));});
process.env.BASE=`http://127.0.0.1:${port}`;
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
try{
  // Export cut's JSON, read from its blob (downloads are denied).
  await page.evaluateOnNewDocument(()=>{window.__exports=[];const make=URL.createObjectURL;URL.createObjectURL=function(b){if(b instanceof Blob&&b.type==='application/json')b.text().then(t=>window.__exports.push(JSON.parse(t)));return make.call(this,b);};});
  const clip=()=>page.$eval('[data-desk-clip="full-height"]',e=>e.getAttribute('aria-label')).catch(()=>'');
  const hashCut=()=>page.evaluate(()=>new URLSearchParams(location.hash.slice(1)).get('cut')).then(decode);
  const notice=()=>page.$eval('#director-panel [data-film-fresh]',e=>e.textContent).catch(()=>'');
  const pressed=()=>page.$$eval('#director-panel [data-film-fresh] button[aria-pressed=true]',b=>b.map(x=>x.textContent));
  const dirty=()=>page.$eval('#director-panel [data-film-dirty]',e=>!e.hidden).catch(()=>null);
  const click=sel=>page.evaluate(sel=>document.querySelector(sel).click(),sel);
  const reload=async()=>{await page.reload();await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});await wait(800);};
  const until=async(fn,what,ms=15000)=>{const t=Date.now();for(;;){const v=await fn();if(v)return v;if(Date.now()-t>ms)throw Error('timed out: '+what);await wait(200);}};
  const exports=()=>page.evaluate(()=>window.__exports.length);
  const hhmm=iso=>{const d=new Date(iso);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

  const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
  const asked=()=>page.$eval('#film-draft',d=>d.open).catch(()=>false);
  // the camera key nearest 2.4 s, selected in the Camera tab; its field of view (the edit of this test)
  const pickKey=async()=>{await page.evaluate(()=>document.querySelector('[data-inspector-tab=camera]').click());await wait(300);
    return page.evaluate(()=>{const s=document.querySelector('#director-panel [name=camera-key]');if(!s)return null;
      const o=[...s.options].filter(o=>o.value).map(o=>({v:o.value,t:parseFloat(o.textContent.split('·').pop())})).sort((a,b)=>Math.abs(a.t-2.4)-Math.abs(b.t-2.4))[0];
      s.value=o.v;s.dispatchEvent(new Event('change',{bubbles:true}));return o.v;});};
  const fov=async()=>{await pickKey();await wait(300);return Number(await page.$eval('#director-panel [name="key-fov"]',e=>e.value).catch(()=>NaN));};
  const setFov=async v=>{await pickKey();await wait(300);await page.evaluate(v=>{const el=document.querySelector('#director-panel [name="key-fov"]');el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},v);};
  const fovsIn=key=>page.evaluate(key=>{const all=JSON.parse(localStorage.getItem(key)||'{}'),out=[];
    for(const v of Object.values(all))for(const d of [].concat(v))if(d?.cut?.shots?.[0]?.id==='rise')out.push(...d.cut.shots[0].camera.keys.map(k=>k.view?.fov));return out;},key);
  const slot=()=>fovsIn('ergoflex.director.filmDrafts.v1'),aside=()=>fovsIn('ergoflex.director.filmDrafts.setAside.v1');
  const v1=rise();await openChapter(page,base,v1);
  const film0=await fov();check(Number.isFinite(film0)&&film0!==31&&film0!==52,`the film's field of view at the key: ${film0}`);
  // ---- 1. an edit; the draft slot has it
  await setFov(31);await until(async()=>(await slot()).includes(31),'the draft has the edit');
  check(true,'1. edit (field of view 31): the draft slot has it');
  // ---- 2. the film moves on; reload; Decide later; edit again without choosing
  await wait(1100);importEdit(9,.25);const v2=rise();check(v2.version!==v1.version,`2. import: the film is newer (${v2.version})`);
  await reload();await until(asked,'the modal on load');
  const text=await page.$eval('#film-draft [data-draft-text]',e=>e.textContent);
  check(/^Film chapter: rise[^:]*: \d+ changes? made .+ in this browser and not exported\./.test(text),`2. the modal names the chapter and its changes: "${text}"`);
  check(!!await page.$('#film-draft [data-draft=keep]')&&!!await page.$('#film-draft [data-draft=film]')&&!!await page.$('#film-draft [data-draft=later]'),'2. Keep my unexported changes / Use the film\'s version / Decide later');
  await shot('01-modal-on-load');
  check((await aside()).includes(31)&&!(await slot()).includes(31),'2. the first edit is set aside (not in the draft slot any more)');
  await click('#film-draft [data-draft=later]');check(!await asked(),'2. Decide later closes it');
  check(await fov()===film0,'2. the film\'s version is in the editor');
  await setFov(52);await until(async()=>(await slot()).includes(52),'the second edit is the draft');
  check((await aside()).includes(31),'2. the second edit (52) did not write over the set-aside one (31)');
  // ---- 3. reload again: both recoverable
  await reload();await until(asked,'the modal on the second reload');
  check(await fov()===52,'3. the newer edit (52) loads');
  check((await aside()).includes(31),'3. the first edit (31) is still set aside, and offered');
  await shot('02-modal-again');
  await click('#film-draft [data-draft=keep]');await until(async()=>await fov()===31,'Keep brings 31 back');
  check(await fov()===31&&await dirty(),'3. Keep: the first edit (31) is back in the editor, not exported');
  check((await aside()).includes(52)&&(await slot()).includes(31),'3. and the second (52) is set aside in its turn: nothing lost');
  check(!!await page.$('#director-panel [data-action=film-draft-ask]'),'3. the strip offers the set-aside changes (Show them…)');
  await shot('03-kept');
  await click('#director-panel [data-action=film-draft-ask]');await until(asked,'the modal from the strip');
  await click('#film-draft [data-draft=film]');await until(()=>page.$('#film-draft [data-draft=delete]'),'the second question');
  check(/Delete these changes\?/.test(await page.$eval('#film-draft',e=>e.textContent)),'3. Use the film\'s version asks before deleting');
  await click('#film-draft [data-draft=delete]');await until(async()=>!(await aside()).includes(52),'52 deleted');
  check(await fov()===31&&!await asked(),'3. Delete: only the set-aside one (52) is gone; the editor keeps 31');
  const errs=errors.filter(e=>!/WebGL|GPU stall/i.test(e));
  check(!errs.length,`no page errors${errs.length?': '+errs.join(' | '):''}`);
}catch(error){console.error(error);failures.push(error.message);}
finally{await close();server.kill();if(!process.env.KEEP)fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failures.length?`Director set-aside drafts e2e: ${failures.length} FAILED (shots in ${SHOTS})`:`Director set-aside drafts e2e: all passed (shots in ${SHOTS})`);
process.exit(failures.length?1:0);
