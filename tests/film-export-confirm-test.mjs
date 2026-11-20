// Export cut keeps the chapter's draft until the film has it (experience/film-fresh.mjs, 19 Nov 2026), without a browser.
// Vico's Create export (16:16) never reached his cut (no importer was running) and Export cut forgot his draft at once;
// the Director reloaded and showed the film's old version. Now the draft is the exported cut until the importer's record
// (<cut>/director-exports/imports.json, by the export file's sha256: tools/experience/director-import-watch.py) says the
// film has it. On the cine cut's create page cut, a fake localStorage and a fake server:
//   1. Export cut: the draft slot holds the exported cut at once; the editor's own "nothing unexported" write does not
//      drop it; the notice says it is waiting
//   2. the record says ok: the draft goes, the notice says the film has it
//   3. edited after the export: the record says ok, the newer edits stay
//   4. the record says it failed: the draft stays, the reason is shown as an error
//   5. no record in time: the draft stays, and he is told the importer may not be running
//   6. a reload before the film has it: the draft (the exported cut) loads, nothing lost
//   node tests/film-export-confirm-test.mjs
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
globalThis.document={createElement:()=>({setAttribute(){},showModal(){},close(){},querySelector:()=>null,open:false}),body:{append(){}}};
globalThis.history={state:null,replaceState(){}};globalThis.location={hash:'',href:'http://127.0.0.1:3000/experience/'};
const {createFilmFresh,filmFresh}=await import('../experience/film-fresh.mjs');
const DRAFTS='ergoflex.director.filmDrafts.v1',FILM='/exports/cinematic-intro-cut-cine/director-chapters.json';
const f=readdirSync(new URL('../exports/cinematic-intro-cut-cine/',import.meta.url)).find(f=>/^director-ch\d\d-create\.html$/.test(f));
const page=JSON.parse(Buffer.from(/#cut=([A-Za-z0-9_-]+)/.exec(readFileSync(new URL('../exports/cinematic-intro-cut-cine/'+f,import.meta.url),'utf8'))[1],'base64url').toString('utf8'));
const STAMP={version:'v1',updated:'2026-01-01T12:00:00.000Z'};
const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))};
let records={},asked=[];
globalThis.fetch=async url=>{asked.push(String(url));return {ok:true,json:async()=>records};};
const slot=()=>JSON.parse(storage.getItem(DRAFTS)||'{}')[page.id]||null,nOf=c=>Number(/ (\d+)\$$/.exec(c?.shots?.[0]?.propEdits?.[0]?.match||'')?.[1]);
const sig=c=>JSON.stringify(c),wait=ms=>new Promise(r=>setTimeout(r,ms));
function open({importWait=5000}={}){
  filmFresh.state={chapter:{id:'create'},stamp:STAMP,newer:false,hashCut:null};
  const ed={project:structuredClone(page),exportedSig:sig(page),statuses:[]};
  ed.f=createFilmFresh({film:FILM},ed.project,{storage,catalog:null,escape:s=>String(s),render(){},status:(m,e)=>ed.statuses.push([m,!!e]),importPoll:20,importWait,
    current:()=>({cut:ed.project,unexported:sig(ed.project)!==ed.exportedSig}),load(){}});
  const d=ed.f.initialDraft();if(d)ed.project=d;
  ed.edit=n=>{ed.project=structuredClone(ed.project);ed.project.shots[0].propEdits=[{match:'^Side shelf · large, cubby and cups '+n+'$',path:'',hide:true}];ed.f.noteDraft(ed.project,sig(ed.project)!==ed.exportedSig);};
  // Export cut as director.mjs does it: the text it downloads, the baseline, then film-fresh
  ed.export=async()=>{const text=JSON.stringify(ed.project,null,2);ed.exportedSig=sig(ed.project);return {text,sha:await ed.f.exported(ed.project,text)};};
  return ed;
}
const until=async(fn,what,ms=3000)=>{const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('timed out: '+what);await wait(10);}};
// 1 + 2
let e=open();e.edit(1);
let {text,sha}=await e.export();
assert.equal(sha,createHash('sha256').update(text).digest('hex'),'the record is looked up by the sha256 of the very file downloaded');
assert.equal(nOf(slot()?.cut),1,'1. the draft slot holds the exported cut');
e.f.noteDraft(e.project,false);assert.ok(slot(),'1. the editor\'s "nothing unexported" write does not drop it');
assert.match(e.f.noticeHTML(),/waiting for the film to take it in/,'1. the notice says it is waiting');
await until(()=>asked.length>1,'it asks the importer\'s record');
assert.equal(asked[0],'http://127.0.0.1:3000/exports/cinematic-intro-cut-cine/director-exports/imports.json','(at the cut\'s director-exports/imports.json)');
assert.ok(slot()&&e.f.importPending(),'1. no record yet: kept');
records={[sha]:{ok:true,chapter:'create',file:'Film-chapter-create-23-5-s- (8).json'}};
await until(()=>!e.f.importPending(),'the record is seen');
assert.equal(slot(),null,'2. the film has it: the draft goes');assert.match(e.f.noticeHTML(),/The film has your export/);
// 3. edited after the export
records={};e=open();e.edit(2);({sha}=await e.export());e.edit(3);
records={[sha]:{ok:true}};await until(()=>!e.f.importPending(),'confirmed');
assert.equal(nOf(slot()?.cut),3,'3. edits made after the export stay');
// 4. failed
store.clear();records={};e=open();e.edit(4);({sha}=await e.export());records={[sha]:{ok:false,error:'director-bridge: the shot has no camera'}};
await until(()=>!e.f.importPending(),'the failure is seen');
assert.equal(nOf(slot()?.cut),4,'4. a failed import: the draft stays');
assert.ok(e.statuses.some(([m,err])=>err&&/could not take in your export[^]*the shot has no camera[^]*stay in this browser/.test(m)),'4. and the reason is shown as an error');
e.f.noteDraft(e.project,false);assert.ok(slot(),'4. never dropped afterwards by the editor');
// 5. nothing in time
store.clear();records={};e=open({importWait:150});e.edit(5);await e.export();
await until(()=>!e.f.importPending(),'gives up',2000);
assert.ok(slot(),'5. no record in time: the draft stays');assert.ok(e.statuses.some(([m,err])=>err&&/has not taken in your export[^]*import watcher running/.test(m)),'5. he is told why');
// 6. a reload before the film has it (what happened at 16:22): the exported cut loads
const r=open();
assert.equal(nOf(r.project),5,'6. after a reload the exported changes are in the editor');
console.log('film-export-confirm-test: ok (the draft stays until the importer\'s record has the export; failures and silence are shown)');
process.exit(0);
