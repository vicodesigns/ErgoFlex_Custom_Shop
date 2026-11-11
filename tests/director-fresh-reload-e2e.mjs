// Director film chapters stay current across reloads, end to end (real GPU Chrome; not one of the quick tests/cinematic-*).
// A chapter page bakes its cut into the URL hash; a tab reloaded after an import used to come back with that old cut,
// and its next Export cut sent the stale values back (a lift clip went back to 10 s). Against a SCRATCH copy of the hq
// dir (never the real one), chapter 2 (rise):
//   1. open the page; simulate an import (edit director-camera-rise.json: a lift clip and a camera key, run the
//      build-round8-director.py pass and --pages rise); reload: the new values, the notice, the hash rewritten;
//   2. an unexported draft newer than the film loads by default (Use the film's version drops it); one older than the
//      film leaves the film's version loaded (Keep my unexported changes brings it back);
//   3. a further import, then Export cut from the open tab: the stale-export warning lists what would revert;
//      Export anyway exports; after one more import, Load the latest loads it in place.
//
//   node tests/director-fresh-reload-e2e.mjs      SOURCE_HQ=<full hq dir, only read> (default <repo>/$HQ), PORT=3200
// Serves a scratch tree (symlinks to this checkout + the scratch hq) with tools/studio-server.mjs --root; downloads
// are denied (exports are read from the blob). Run it under flock /tmp/claude-1000/hq12-stills.lock.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {root,HQ,wait,openDirectorBrowser,openChapter} from './director-e2e-harness.mjs';

const SOURCE=path.resolve(process.env.SOURCE_HQ||path.join(root,HQ));
if(!fs.existsSync(path.join(SOURCE,'review-cut.json'))||!fs.existsSync(path.join(SOURCE,'director-camera-rise.json'))){console.log(`Director fresh-reload e2e: skipped (${SOURCE} has no review-cut.json / director-camera-rise.json; set SOURCE_HQ).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(process.env.SCRATCH||os.tmpdir(),'director-fresh-')),site=path.join(tmp,'site'),dl=path.join(tmp,'dl');
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
const port=Number(process.env.PORT||3200),state=path.join(tmp,'studio-state.json');
if(fs.existsSync(path.join(root,'studio-state.json')))fs.copyFileSync(path.join(root,'studio-state.json'),state);
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

  // ---- 1. open; import; reload
  const v1=rise();check(!!v1.version&&!!v1.updated,`director-chapters.json stamps rise (version ${v1.version}, updated ${v1.updated})`);
  await openChapter(page,base,v1);
  check(/9\.45 to 12\.65 seconds/.test(await clip()),`opened: the lift clip reads "${await clip()}"`);
  check((await hashCut()).filmVersion===v1.version,'the hash cut carries the page version');
  check(!await notice(),'no notice when the hash is current');
  const key2=(await hashCut()).shots[0].camera.keys[1].view.position[0];
  await wait(1100);importEdit(9,.25);const v2=rise();
  check(v2.version!==v1.version,`import 1 (clip 9 s, key 2 moved): the page version changes (${v2.version})`);
  await reload();
  check(/9 to 12\.2 seconds/.test(await clip()),`reloaded: the lift clip shows the import (${await clip()})`);
  const after=await hashCut();
  check(after.filmVersion===v2.version&&Math.abs(after.shots[0].camera.keys[1].view.position[0]-(key2+.25))<1e-6,'reloaded: the hash holds the new cut (version and camera key 2)');
  const text=`Loaded the latest film version of this chapter (your export from ${hhmm(v2.updated)}).`;
  check(await notice()===text,`notice: "${await notice()}"`);
  check(!await dirty(),'reloaded film version is not marked "not exported"');
  await reload();check(!await notice()&&/9 to 12\.2/.test(await clip()),'a second reload stays current without a notice');

  // ---- 2. unexported drafts
  const draftOf=(start,at)=>page.evaluate((start,at)=>{
    const c=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(new URLSearchParams(location.hash.slice(1)).get('cut').replaceAll('-','+').replaceAll('_','/')),x=>x.charCodeAt(0))));
    c.shots[0].motion.clips.find(x=>x.id==='full-height').start=start;localStorage.setItem('ergoflex.director.filmDrafts.v1',JSON.stringify({rise:{cut:c,at}}));
  },start,at);
  await draftOf(8.5,new Date(Date.now()+1000).toISOString());await reload();
  check(/8\.5 to 11\.7/.test(await clip()),`a draft newer than the film loads by default (${await clip()})`);
  check(/You have unexported changes from \d\d:\d\d in this browser\./.test(await notice())&&(await pressed())[0]==='Keep my unexported changes',`draft choice offered: "${await notice()}" [${await pressed()}]`);
  check(await dirty(),'the draft is marked "not exported"');
  await click('#director-panel [data-action=film-use-film]');await until(async()=>/9 to 12\.2/.test(await clip()),'film version');
  check(/9 to 12\.2/.test(await clip())&&!await dirty(),'Use the film\'s version: the film\'s clip, nothing unexported');
  check(await page.evaluate(()=>!JSON.parse(localStorage.getItem('ergoflex.director.filmDrafts.v1')||'{}').rise),'Use the film\'s version drops the stored draft');
  await draftOf(8.5,'2000-01-01T00:00:00Z');await reload();
  check(/9 to 12\.2/.test(await clip())&&(await pressed())[0]==='Use the film\'s version',`a draft older than the film's import leaves the film's version loaded [${await pressed()}]`);
  await click('#director-panel [data-action=film-keep-draft]');await until(async()=>/8\.5 to 11\.7/.test(await clip()),'draft back');
  check(await dirty(),'Keep my unexported changes: the draft is back, marked "not exported"');
  await click('#director-panel [data-action=film-use-film]');await until(async()=>/9 to 12\.2/.test(await clip()),'film version again');

  // ---- 3. Export cut from a tab the film moved past
  await wait(1100);importEdit(9.45,-.2);const v3=rise();
  await click('#director-panel [data-action=save-export]');
  await until(()=>page.$eval('#film-stale',d=>d.open).catch(()=>false),'stale-export warning');
  const warn=await page.$eval('#film-stale [data-stale-text]',e=>e.textContent),list=await page.$$eval('#film-stale [data-stale-list] li',l=>l.map(x=>x.textContent));
  check(warn===`This tab is older than the film (exported ${hhmm(v3.updated)}). Exporting will overwrite:`,`warning: "${warn}"`);
  check(list.some(t=>/^lift clip “.*”: 9\.45–12\.65 s → 9–12\.2 s$/.test(t))&&list.some(t=>/^camera key 2: /.test(t)),`it lists the lift clip and camera key 2: ${JSON.stringify(list)}`);
  check(await exports()===0,'nothing exported before a choice');
  await click('#film-stale [data-stale=export]');await until(async()=>await exports()===1,'export anyway');
  const sent=await page.evaluate(()=>window.__exports[0].shots[0].motion.clips.find(c=>c.id==='full-height').start);
  check(sent===9,`Export anyway exports the tab's values (clip at ${sent} s)`);
  await click('#director-panel [data-action=save-export]');await until(async()=>await exports()===2,'second export');
  check(!await page.$eval('#film-stale',d=>d.open),'exporting again after Export anyway does not warn again');
  await wait(1100);importEdit(9.2,.1);const v4=rise();
  await click('#director-panel [data-action=save-export]');
  await until(()=>page.$eval('#film-stale',d=>d.open).catch(()=>false),'stale-export warning after import 3');
  await click('#film-stale [data-stale=latest]');await until(async()=>/9\.2 to 12\.4/.test(await clip()),'latest loaded',60000);
  check((await hashCut()).filmVersion===v4.version,'Load the latest: the clip and the hash are the film\'s newest');
  check(await notice()===`Loaded the latest film version of this chapter (your export from ${hhmm(v4.updated)}).`&&await exports()===2,`Load the latest: notice "${await notice()}", nothing exported`);
  await click('#director-panel [data-action=save-export]');await until(async()=>await exports()===3,'export after load latest');
  check(!await page.$eval('#film-stale',d=>d.open),'Export cut after Load the latest does not warn');
  const errs=errors.filter(e=>!/WebGL|GPU stall/i.test(e));
  check(!errs.length,`no page or "not exported" errors${errs.length?': '+errs.join(' | '):''}`);
}catch(error){console.error(error);failures.push(error.message);}
finally{await close();server.kill();if(!process.env.KEEP)fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failures.length?`Director fresh-reload e2e: ${failures.length} FAILED`:'Director fresh-reload e2e: all passed');
process.exit(failures.length?1:0);
