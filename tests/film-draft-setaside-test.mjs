// Set-aside film drafts (experience/film-fresh.mjs, 19 Nov 2026), without a browser: Vico lost High school edits after a
// reload. A stored draft older than the film's latest import was not loaded (the film's version opened, the draft only
// offered in a status line), and the first edit of the film's version wrote over it in the chapter's one draft slot.
// Now such a draft moves to its own key (ergoflex.director.filmDrafts.setAside.v1, per cut and chapter) and a modal asks.
// With a fake localStorage and fake <dialog>s, on the cine cut's pages (film-cine-rise, film-cine-coast):
//   1. a draft older than the film's stamp is set aside on load (the slot cleared), offered, and the modal opens
//   2. editing the film's version without choosing writes the slot, never the set-aside draft
//   3. a reload offers it again (the newer edit loads; both are kept)
//   4. Keep: the offered draft comes back; what the editor had is set aside in its turn (nothing lost)
//   5. Use the film's version asks again; Back keeps it; Delete deletes only that one; Decide later keeps it
//   6. a draft newer than the film loads; "Use the film's version" then sets it aside (never deletes)
//   7. two chapters keep their own set-aside drafts; Export cut clears the slot, never a set-aside draft
//   8. a set-aside draft the film's version already has is dropped (nothing to lose); a draft never written over when
//      the storage is full (hold)
//   node tests/film-draft-setaside-test.mjs
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const dialogs=[];
globalThis.document={createElement:()=>{const d={open:false,innerHTML:'',id:'',attrs:{},onclick:null,oncancel:null,setAttribute(k,v){this.attrs[k]=v;},showModal(){this.open=true;},close(){this.open=false;},querySelector:()=>({focus(){}})};dialogs.push(d);return d;},body:{append(){}}};
globalThis.history={state:null,replaceState(){}};globalThis.location={hash:'',href:'http://127.0.0.1/experience/'};
const {createFilmFresh,filmFresh,SET_ASIDE,draftChanges}=await import('../experience/film-fresh.mjs');
const DRAFTS='ergoflex.director.filmDrafts.v1';
const pageCut=ch=>{const f=readdirSync(new URL('../exports/cinematic-intro-cut-cine/',import.meta.url)).find(f=>new RegExp(`^director-ch\\d\\d-${ch}\\.html$`).test(f));
  const m=/#cut=([A-Za-z0-9_-]+)/.exec(readFileSync(new URL('../exports/cinematic-intro-cut-cine/'+f,import.meta.url),'utf8'));return JSON.parse(Buffer.from(m[1],'base64url').toString('utf8'));};
const FILM={rise:pageCut('rise'),coast:pageCut('coast')},STAMP={version:'v2',updated:'2026-01-01T12:00:00.000Z'},OLD='2026-01-01T11:00:00.000Z';
// a cut with camera key 2 of chapter `ch` at time t (a change cutChanges sees)
// (between keys 1 and 3 of both chapters: cleanCut sorts keys by time)
const edited=(ch,t)=>{const c=structuredClone(FILM[ch]);c.shots[0].camera.keys[1].time=t;return c;};
const key2=cut=>cut.shots[0].camera.keys[1].time;
const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,setItem(k,v){if(storage.full)throw Error('QuotaExceededError');store.set(k,String(v));},full:false};
const read=k=>JSON.parse(storage.getItem(k)||'{}');
const sig=c=>JSON.stringify(c);
// One page load of chapter ch in the Director: the editor's project, its exported baseline, film-fresh's hooks.
async function open(ch){
  filmFresh.state={chapter:{id:ch},stamp:STAMP,newer:false,hashCut:null};
  const ed={project:structuredClone(FILM[ch]),exportedSig:sig(FILM[ch]),statuses:[]},n=dialogs.length;
  ed.edit=t=>{ed.project=edited(ch,t);ed.f.noteDraft(ed.project,sig(ed.project)!==ed.exportedSig);};
  ed.f=createFilmFresh({film:'/x/director-chapters.json'},ed.project,{storage,catalog:null,escape:s=>String(s),render(){},status:(m,e)=>ed.statuses.push([m,!!e]),
    current:()=>({cut:ed.project,unexported:sig(ed.project)!==ed.exportedSig}),load:(cut,asExported)=>{ed.project=structuredClone(cut);if(asExported)ed.exportedSig=sig(ed.project);}});
  ed.ask=dialogs[n+1];const d=ed.f.initialDraft();if(d)ed.project=d;
  await new Promise(r=>setTimeout(r,5));
  ed.click=what=>ed.ask.onclick({target:{closest:()=>({dataset:{draft:what}})}});
  return ed;
}
const id={rise:FILM.rise.id,coast:FILM.coast.id};
const aside=ch=>(read(SET_ASIDE)[id[ch]]||[]),slot=ch=>read(DRAFTS)[id[ch]]||null;

// 1. a draft older than the film's stamp
store.set(DRAFTS,JSON.stringify({[id.rise]:{cut:edited('rise',.02),at:OLD}}));
let r=await open('rise');
assert.equal(key2(r.project),key2(FILM.rise),'1. the film\'s version opens');
assert.equal(slot('rise'),null,'1. the draft slot is cleared…');
assert.equal(aside('rise').length,1,'1. …because the draft is set aside');assert.equal(key2(aside('rise')[0].cut),.02);assert.equal(aside('rise')[0].at,OLD,'1. with the time it was made');
assert.ok(r.ask.open,'1. the modal asks on load');
assert.match(r.ask.innerHTML,/Film chapter: rise \(18 s\)<\/b>: 1 change made [^<]* in this browser and not exported/,'1. it names the chapter and how many changes');
assert.match(r.ask.innerHTML,/data-draft="keep"[^>]*>Keep my unexported changes<[^]*data-draft="film">Use the film's version<[^]*data-draft="later">Decide later</);
r.click('later');assert.ok(!r.ask.open,'Decide later closes it');
r.f.choose('film');assert.ok(r.ask.open&&/Delete these changes\?/.test(r.ask.innerHTML),'1. the strip\'s Use the film\'s version asks first');r.click('back');r.click('later');assert.equal(aside('rise').length,1,'1. Decide later keeps it set aside');
assert.match(r.f.noticeHTML(),/set aside[^]*film-keep-draft/,'1. the status line still offers it');
// 2. edit the film's version without choosing
r.edit(.03);
assert.equal(key2(slot('rise').cut),.03,'2. the edit is the chapter\'s draft');
assert.equal(aside('rise').length,1,'2. the set-aside draft is untouched');assert.equal(key2(aside('rise')[0].cut),.02);
// 3. reload: the newer edit loads, the set-aside draft is offered again
r=await open('rise');
assert.equal(key2(r.project),.03,'3. the newer draft loads');assert.ok(r.ask.open,'3. the modal asks again');assert.equal(key2(r.f.offered().cut),.02,'3. offering the set-aside draft');
// 4. Keep: the offered one comes back, the loaded one is set aside
r.click('keep');
assert.equal(key2(r.project),.02,'4. Keep: the set-aside changes are in the editor');
assert.equal(key2(slot('rise').cut),.02,'4. and in the chapter\'s draft slot');
assert.deepEqual(aside('rise').map(d=>key2(d.cut)),[.03],'4. what the editor had is set aside in its turn');
assert.equal(key2(r.f.offered().cut),.03);
// 5. the other one, from the strip (Show them…): Use the film's version asks again; Back; Delete deletes only that one
assert.match(r.f.noticeHTML(),/Other unexported changes[^]*film-draft-ask/,'5. the strip names the other set-aside changes');
r.f.prompt();assert.ok(r.ask.open);r.click('film');assert.ok(/Delete these changes\?/.test(r.ask.innerHTML),'5. Use the film\'s version asks first');
r.click('back');assert.ok(/Keep my unexported changes/.test(r.ask.innerHTML)&&aside('rise').length===1,'5. Back: nothing deleted');
r.click('film');r.click('delete');
assert.equal(aside('rise').length,0,'5. Delete: the set-aside draft is gone');assert.equal(key2(r.project),.02,'5. the editor keeps what it has');assert.equal(r.f.offered(),null);
// 6. a draft newer than the film loads; Use the film's version sets it aside
r=await open('rise');assert.equal(key2(r.project),.02,'6. a newer draft loads');assert.ok(!r.ask.open,'6. nothing set aside: no modal');
r.f.choose('film');
assert.equal(key2(r.project),key2(FILM.rise),'6. the film\'s version opens');assert.equal(slot('rise'),null);
assert.deepEqual(aside('rise').map(d=>key2(d.cut)),[.02],'6. the draft is set aside, not deleted');
// 7. two chapters; Export cut
store.set(DRAFTS,JSON.stringify({...read(DRAFTS),[id.coast]:{cut:edited('coast',.14),at:OLD}}));
const c=await open('coast');
assert.deepEqual(aside('coast').map(d=>key2(d.cut)),[.14],'7. coast\'s draft is set aside under coast');
assert.deepEqual(aside('rise').map(d=>key2(d.cut)),[.02],'7. rise\'s is still rise\'s');
assert.ok(Object.keys(read(SET_ASIDE)).every(k=>k===id.rise||k===id.coast)&&id.rise!==id.coast,'7. keyed per cut and chapter: '+Object.keys(read(SET_ASIDE)).join(', '));
c.edit(.145);c.f.exported(c.project);
assert.equal(slot('coast'),null,'7. Export cut clears the chapter\'s slot');assert.equal(aside('coast').length,1,'7. never a set-aside draft');
assert.match(c.f.noticeHTML(),/set aside/,'7. still offered after the export');
// 8. one the film already has is dropped; storage full: nothing written over
store.set(SET_ASIDE,JSON.stringify({...read(SET_ASIDE),[id.coast]:[...aside('coast'),{key:'same',cut:structuredClone(FILM.coast),at:OLD,asideAt:OLD}]}));
const c2=await open('coast');assert.ok(!aside('coast').some(d=>d.key==='same'),'8. a set-aside copy of the film\'s version is dropped');assert.equal(key2(c2.f.offered().cut),.14);
store.delete(SET_ASIDE);store.set(DRAFTS,JSON.stringify({[id.rise]:{cut:edited('rise',.06),at:OLD}}));storage.full=true;
const h=await open('rise');storage.full=false;
assert.equal(key2(slot('rise').cut),.06,'8. storage full: the draft stays in its slot');assert.equal(key2(h.f.offered().cut),.06,'8. and is offered');
h.edit(.07);assert.equal(key2(slot('rise').cut),.06,'8. an edit never writes over it');
assert.ok(h.statuses.some(([m,e])=>e&&/storage is full/.test(m)),'8. and says why');
h.click('keep');assert.equal(key2(h.project),.06,'8. Keep brings it back');
assert.equal(draftChanges(FILM.rise,edited('rise',.02)),1,'(one change: camera key 2)');
console.log('film-draft-setaside-test: ok (older drafts set aside per cut and chapter, offered on every load, never written over; Keep swaps, Delete asks first)');
