// Autosaves that never hide Vico's work (19 Nov 2026, wellness: his draft went empty at 19:44:30 and the newest autosave
// was the empty one; he restored an empty entry over his open work twice). Without a browser:
//   1. the store: each entry counts its edits; a quiet save (edit, tab closed, chapter switch) with less than half the
//      edits of the one before, within a minute, keeps the one before for good (protected, with a note), through any
//      amount of pruning; an Export cut or a restore is a deliberate step and is not guarded
//   2. a draft set aside for the film's version is its own named, protected entry ("set aside: your unexported changes",
//      "your changes from 19:19"), even when the same as the newest
//   3. film-fresh: every draft set aside (Use the film's version, a reload with the film newer) goes to disk FIRST
//      (hooks.keep before the film's version is loaded); the banner says how many more edits the draft has and makes Keep
//      the default; a restored draft (written now) wins over the film's version on the next load
//   4. the client: keep() posts the set-aside cut with its note; the list shows notes and edit counts; Restore asks once
//      more when the version has far fewer edits than what is open
//   node tests/autosave-guard-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {writeAutosave,listAutosaves,KEEP_NEWEST} from '../tools/studio-state/autosave-store.mjs';
import {editsOf} from '../experience/edits-count.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'autosave-guard-'));
const proj=(props,keys=9)=>({schema:'ergoflex.client-cut',version:1,id:'film-vicos-2nd-cut-wellness',shots:[{id:'wellness',camera:{keys:Array.from({length:keys},(_,i)=>({time:i/keys}))},propEdits:Array.from({length:props},(_,i)=>({match:'^Prop:shelf-'+i+'$',hide:true}))}]});
const at=s=>new Date(Date.parse('2026-11-19T19:44:00Z')+s*1000);
const list=()=>listAutosaves(root,'cinematic-intro-cut-vicos-2nd-cut','wellness');
// 1
assert.equal(editsOf(proj(10)),19,'edits: 10 prop edits + 9 camera keys');
writeAutosave(root,{cut:'cinematic-intro-cut-vicos-2nd-cut',chapter:'wellness',reason:'edit',project:proj(10)},at(0));
writeAutosave(root,{cut:'cinematic-intro-cut-vicos-2nd-cut',chapter:'wellness',reason:'edit',project:proj(0)},at(30));
let l=list();assert.equal(l[0].edits,9);assert.ok(l[1].protected&&l[1].edits===19&&/kept: the next autosave had 9 of its 19 edits/.test(l[1].note),'1. the fuller one before the drop is kept, with a note: '+JSON.stringify(l[1]));
for(let i=1;i<=KEEP_NEWEST+10;i++)writeAutosave(root,{cut:'cinematic-intro-cut-vicos-2nd-cut',chapter:'wellness',reason:'edit',project:proj(0,9+i)},at(60+i*61));
assert.ok(list().some(e=>e.protected&&e.edits===19),'1. and survives the pruning of '+(KEEP_NEWEST+10)+' later saves');
writeAutosave(root,{cut:'g',chapter:'c',reason:'edit',project:proj(10)},at(0));writeAutosave(root,{cut:'g',chapter:'c',reason:'export',project:proj(0)},at(20));
assert.ok(!listAutosaves(root,'g','c').some(e=>e.protected),'1. an Export cut is deliberate: not guarded');
writeAutosave(root,{cut:'h',chapter:'c',reason:'edit',project:proj(10)},at(0));writeAutosave(root,{cut:'h',chapter:'c',reason:'edit',project:proj(0)},at(90));
assert.ok(!listAutosaves(root,'h','c').some(e=>e.protected),'1. more than a minute apart: not guarded');
// 2
writeAutosave(root,{cut:'k',chapter:'c',reason:'edit',project:proj(10)},at(0));
writeAutosave(root,{cut:'k',chapter:'c',reason:'aside',project:proj(10),note:'your changes from 19:19'},at(5));
l=listAutosaves(root,'k','c');assert.equal(l.length,2,'2. a set-aside draft is its own entry even when the same as the newest');
assert.ok(l[0].reason==='aside'&&l[0].protected&&l[0].note==='your changes from 19:19'&&l[0].edits===19,'2. named, protected, counted: '+JSON.stringify(l[0]));
fs.rmSync(root,{recursive:true,force:true});
// 3
const dialogs=[];globalThis.document={createElement:()=>{const d={open:false,innerHTML:'',setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},querySelector:()=>({focus(){}})};dialogs.push(d);return d;},body:{append(){}}};
globalThis.history={state:null,replaceState(){}};globalThis.location={hash:'',href:'http://127.0.0.1/experience/'};
const {createFilmFresh,filmFresh}=await import('../experience/film-fresh.mjs');
// (the cine cut's own wellness page cut: real camera keys, which the cut cleaner keeps)
const pageCut=(()=>{const f=fs.readdirSync(new URL('../exports/cinematic-intro-cut-cine/',import.meta.url)).find(f=>/^director-ch\d\d-wellness\.html$/.test(f));return JSON.parse(Buffer.from(/#cut=([A-Za-z0-9_-]+)/.exec(fs.readFileSync(new URL('../exports/cinematic-intro-cut-cine/'+f,import.meta.url),'utf8'))[1],'base64url').toString('utf8'));})();
const film=pageCut,mine=(()=>{const c=structuredClone(pageCut);c.shots[0].propEdits=Array.from({length:10},(_,i)=>({match:'^Prop:shelf-'+i+'$',path:'',hide:true}));return c;})(),K=editsOf(film),DRAFTS='ergoflex.director.filmDrafts.v1',STAMP={version:'v2',updated:'2026-11-19T19:17:00.000Z'};
const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))};
function open_(){
  filmFresh.state={chapter:{id:'wellness'},stamp:STAMP,newer:false,hashCut:null};
  const ed={project:structuredClone(film),sig:JSON.stringify(film),calls:[]};
  ed.f=createFilmFresh({film:'x'},ed.project,{storage,catalog:null,escape:s=>String(s),render(){},status(){},
    current:()=>({cut:ed.project,unexported:JSON.stringify(ed.project)!==ed.sig}),keep:(cut,t)=>ed.calls.push(['keep',editsOf(cut),t]),load:(cut,asExported)=>{ed.calls.push(['load',editsOf(cut)]);ed.project=structuredClone(cut);if(asExported)ed.sig=JSON.stringify(cut);}});
  const d=ed.f.initialDraft();if(d)ed.project=d;return ed;
}
store.set(DRAFTS,JSON.stringify({[mine.id]:{cut:mine,at:'2026-11-19T19:19:00.000Z'}}));
let e=open_();
assert.equal(editsOf(e.project),K+10,'3. a draft newer than the film loads');
assert.match(e.f.noticeHTML(),/Your draft has 10 more edits than the film's version\.[^]*class="primary" aria-pressed="true">Keep my unexported changes/,'3. the banner says so and Keep is the default');
e.f.choose('film');
assert.deepEqual(e.calls.slice(0,2).map(c=>c[0]),['keep','load'],'3. Use the film\'s version: the draft goes to disk first, then the film\'s version');
assert.equal(e.calls[0][1],K+10,'3. (the draft, all of it)');
assert.match(e.f.noticeHTML(),/Your draft has 10 more edits[^]*class="primary" aria-pressed="false">Keep my unexported changes/,'3. set aside: still offered, Keep highlighted');
store.clear();store.set(DRAFTS,JSON.stringify({[mine.id]:{cut:mine,at:'2026-11-19T19:00:00.000Z'}}));e=open_();
assert.ok(e.calls[0]?.[0]==='keep'&&e.calls[0][1]===K+10&&editsOf(e.project)===K,'3. a reload with the film newer: set aside, and to disk, before anything else');
// restore, then reopen: the restored draft wins (Restore loads it as an unexported draft; the draft is written now)
store.clear();store.set(DRAFTS,JSON.stringify({[mine.id]:{cut:mine,at:'2026-11-19T19:00:00.000Z'}}));e=open_();e.project=structuredClone(mine);e.f.stamp(e.project);   // (an older draft of the same content: Restore stamps it now anyway)
const again=open_();assert.equal(editsOf(again.project),K+10,'3. restored, then reopened: the restored draft is what opens');
// 4
const {createAutosave}=await import('../experience/director-autosave.mjs');
let posted=null;const a=createAutosave({place:()=>({cut:'cinematic-intro-cut-vicos-2nd-cut',chapter:'wellness'}),project:()=>film,escape:s=>s,restore(){},status(){},fetcher:async(u,o)=>{posted=JSON.parse(o.body);return {ok:true,status:200,json:async()=>({})};}});
await a.keep(mine,'aside','your changes from 19:19');
assert.ok(posted.reason==='aside'&&posted.note==='your changes from 19:19'&&editsOf(posted.project)===K+10&&posted.groups.length===0,'4. keep() posts the set-aside cut with its note');
const src=fs.readFileSync(new URL('../experience/director-autosave.mjs',import.meta.url),'utf8');
assert.match(src,/x\.note \? `<b class="autosave-note">/,'4. the list shows the note');assert.match(src,/\$\{x\.edits\} edit\$\{/,'4. and the edit count');
assert.match(src,/if \(Number\.isFinite\(x\.edits\) && open_ >= 2 && x\.edits < open_ \* \.5 && b\.dataset\.sure !== '1'\)/,'4. Restore of a much smaller version asks once more');
const dir=fs.readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8');assert.match(dir,/restore:v=>\{loadProject\(v,false\);fresh\.stamp\(project\);\}/,'(Restore stamps the draft as of now)');assert.match(dir,/keep:\(cut,at\)=>setTimeout\(\(\)=>\{let c=cut;try\{c=cleanCut\(cut,catalog\);\}catch\{\}autosave\?\.keep\(c,'aside',`your changes from \$\{autosaveWhen\(at\)\}`\);\},0\)/,'(the Director wires it)');
console.log('autosave-guard-test: ok (a drop keeps the fuller one; set-aside drafts are named entries written first; Keep is the default for a fuller draft; a restore wins on reopen)');
