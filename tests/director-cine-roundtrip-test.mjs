// S31: the Cinematographer's cut survives the Director round trip. For every chapter: its Director page cut
// (director-bridge.py link, as the chapter page has it) exported with no edit (cuts.mjs cleanCut, what Export cut
// writes), imported (build-round8-director.py --import) and passed (build-round8-director.py) leaves review-cut.json
// BYTE-IDENTICAL, on a scratch copy of the cut folder. Also: the director-film shots are the review-cut chapters
// (stale pages fail here: rebuild with tools/experience/film-cuts.py pages exports/cinematic-intro-cut-cine).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cleanCut} from '../experience/cuts.mjs';
import {fromPlan} from '../experience/camera-transitions.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tools=path.join(root,'tools/experience');
const CUT=process.env.CUT_DIR||'exports/cinematic-intro-cut-cine',H0=path.join(root,CUT);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-cine-rt-'));
const py=(...args)=>execFileSync('python3',args,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();
const src=fs.readFileSync(path.join(H0,'review-cut.json'));
const cut=JSON.parse(src);
// 1. director-film = review-cut (a screen clip that is on no disk here is left out of the Director's copy)
const stale=[];
for(const s of cut.shots){
  const f=JSON.parse(fs.readFileSync(path.join(H0,'director-film',s.id+'.json'),'utf8')),want=structuredClone(s);
  if(want.screens)want.screens=want.screens.filter(x=>fs.existsSync(path.join(root,x.src||'')));
  if(f.screens)f.screens=f.screens.filter(x=>fs.existsSync(path.join(root,x.src||'')));
  if(JSON.stringify(f)!==JSON.stringify(want))stale.push(s.id);
}
assert.deepEqual(stale,[],`director-film is stale for ${stale.join(', ')}: run python3 tools/experience/film-cuts.py pages ${CUT}`);
// A cut's chapter opens in the Director as a project of its own, film-<cut>-<chapter> (build-round8-director.py marks
// the page so); the importer refuses an export that belongs to another cut (two cuts share their chapter ids).
const cutId=fs.existsSync(path.join(H0,'cut.json'))?JSON.parse(fs.readFileSync(path.join(H0,'cut.json'),'utf8')).id:null;
const mark=(c,id)=>{if(cutId)c.id=`film-${cutId}-${id}`;return c;};
// 2. open, export with no edit, import, pass: identical
const results=[];
for(const s of cut.shots){
  const H=path.join(tmp,s.id);fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json','titles-src.json','shots/13-subshots.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(H,f));
  const page=path.join(tmp,s.id+'-page.json');py(path.join(tools,'director-bridge.py'),'link',path.join(H,'review-cut.json'),'--shot',s.id,'--json',page);
  const exported=mark(cleanCut(JSON.parse(fs.readFileSync(page,'utf8'))),s.id);
  const ex=path.join(tmp,`Film-chapter-${s.id}.json`);fs.writeFileSync(ex,JSON.stringify(exported,null,2));
  py(path.join(tools,'build-round8-director.py'),H,'--import',ex);
  py(path.join(tools,'build-round8-director.py'),H);
  const after=fs.readFileSync(path.join(H,'review-cut.json'));
  if(!after.equals(src)){
    const a=JSON.parse(after).shots.find(x=>x.id===s.id),b=s;
    const diff=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
    results.push(`${s.id}: CHANGED ${diff.join(',')||'(format)'}`);
  }else results.push(`${s.id}: identical`);
  for(const f of ["titles-src.json","shots/13-subshots.json"])if(fs.existsSync(path.join(H0,f))&&!fs.readFileSync(path.join(H,f)).equals(fs.readFileSync(path.join(H0,f))))results.push(`${s.id}: ${f} CHANGED`);//(fs.readFileSync(path.join(H,f)).equals(fs.readFileSync(path.join(H0,f))),`${s.id}: ${f} changed`);
}
console.log(results.join('\n'));
assert.ok(results.every(r=>r.endsWith('identical')),'a chapter changed in the no-edit round trip');
// 2b. Camera transitions (20 Nov 2026): the same no-edit export with every key carrying its transition as the Director
// now shows it (camera-transitions.mjs fromPlan: the plan's cut, null elsewhere; the importer takes it as authoritative)
// leaves review-cut.json byte-identical too; then a cut removed and a dissolve set reach the film's cameraPlan, nothing else.
const runCamera=(s,edit)=>{
  const H=path.join(tmp,'tr-'+s.id);fs.rmSync(H,{recursive:true,force:true});fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json','titles-src.json','shots/13-subshots.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(H,f));
  const page=path.join(tmp,s.id+'-tr-page.json');py(path.join(tools,'director-bridge.py'),'link',path.join(H,'review-cut.json'),'--shot',s.id,'--json',page);
  const exported=mark(cleanCut(JSON.parse(fs.readFileSync(page,'utf8'))),s.id),plan=[...s.cameraPlan.keys].sort((a,b)=>a.at-b.at),keys=exported.shots[0].camera?.keys||[];
  keys.forEach((k,i)=>{const n=/^plan-\d+$/.test(k.id)?Number(k.id.slice(5)):-1;k.transition=i&&n>=0?fromPlan(plan[n]):null;});
  edit?.(keys);exported.shots[0]=cleanCut(exported).shots[0];
  const ex=path.join(tmp,`Film-chapter-${s.id}-tr.json`);fs.writeFileSync(ex,JSON.stringify(exported,null,2));
  py(path.join(tools,'build-round8-director.py'),H,'--import',ex);py(path.join(tools,'build-round8-director.py'),H);
  return fs.readFileSync(path.join(H,'review-cut.json'));
};
const trSame=cut.shots.filter(s=>s.cameraPlan?.keys?.length).map(s=>[s.id,runCamera(s).equals(src)]);
console.log('transitions explicit, no edit: '+trSame.map(([id,ok])=>`${id} ${ok?'identical':'CHANGED'}`).join(', '));
assert.ok(trSame.every(([,ok])=>ok),'a chapter changed when its keys carry their transitions explicitly');
{
  const s=cut.shots.find(x=>(x.cameraPlan?.keys||[]).some(k=>k.cut));
  if(s){
    const plan=[...s.cameraPlan.keys].sort((a,b)=>a.at-b.at),ci=plan.findIndex(k=>k.cut),di=plan.findIndex((k,i)=>i>0&&!k.cut);
    const after=JSON.parse(runCamera(s,keys=>{keys[ci].transition=null;keys[di].transition={type:'dissolve',dur:.8};})).shots.find(x=>x.id===s.id);
    const got=[...after.cameraPlan.keys].sort((a,b)=>a.at-b.at);
    assert.equal(got.length,plan.length);
    assert.ok(!got[ci].cut&&!('transition' in got[ci]),`${s.id}: the removed cut is gone from plan key ${ci}`);
    assert.deepEqual([got[di].cut,got[di].transition],[true,{type:'dissolve',dur:.8}],`${s.id}: the dissolve is cut: true + transition on plan key ${di}`);
    const strip=k=>{const {cut:_c,transition:_t,...rest}=k;return rest;};
    assert.deepEqual(got.map(strip),plan.map(strip),`${s.id}: every key's place, aim, lens, time, hold and label as they were`);
    got.forEach((k,i)=>{if(i!==ci&&i!==di)assert.deepEqual([k.cut,k.transition],[plan[i].cut,plan[i].transition],`${s.id}: key ${i} keeps its cut`);});
    console.log(`transitions edited (${s.id}): plan key ${ci}'s cut removed, plan key ${di} a 0.8 s dissolve (cut: true + transition); the camera re-baked`);
  }else console.log('note: no chapter of this cut has a cut key; the edit check is skipped');
}
// 3. People v2 (peopleEdits = the film's whole `people`, {v: 2, ...}): unchanged -> identical; one walk retimed -> only
// that field of people changes and the chapter gets directorEdited {at, fields: ['people']}. (Set after cleanCut: the
// desk's people-edits.mjs cleanPeople keeps v2 verbatim.)
{
  const s=cut.shots.find(x=>x.id==='oilers'),H=path.join(tmp,'people');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  const run=(people,more=null)=>{
    for(const f of ['review-cut.json','titles-src.json','shots/13-subshots.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(H,f));
    for(const f of fs.readdirSync(H))if(/^director-camera/.test(f))fs.rmSync(path.join(H,f));
    const page=path.join(tmp,'p-page.json');py(path.join(tools,'director-bridge.py'),'link',path.join(H,'review-cut.json'),'--shot',s.id,'--json',page);
    const exported=mark(cleanCut(JSON.parse(fs.readFileSync(page,'utf8'))),s.id);if(people)exported.shots[0].peopleEdits=people;if(more)Object.assign(exported.shots[0],more);
    const ex=path.join(tmp,'Film-chapter-oilers.json');fs.writeFileSync(ex,JSON.stringify(exported));
    py(path.join(tools,'build-round8-director.py'),H,'--import',ex);py(path.join(tools,'build-round8-director.py'),H);
    return fs.readFileSync(path.join(H,'review-cut.json'));
  };
  assert.ok(run({v:2,...structuredClone(s.people)}).equals(src),'oilers: v2 people unchanged -> review-cut.json identical');
  const p={v:2,...structuredClone(s.people)},walker=p.cast.find(e=>e.walk);walker.walk.start=+(walker.walk.start+.5).toFixed(3);
  const after=JSON.parse(run(p)).shots.find(x=>x.id==='oilers'),want=structuredClone(s.people);want.cast.find(e=>e.key===walker.key&&e.walk).walk.start=walker.walk.start;
  assert.deepEqual(after.people,want,'oilers: v2 people written verbatim with the one change');
  assert.deepEqual(after.directorEdited?.fields,['people'],'oilers: marked directorEdited for people');
  const rest=Object.keys(s).filter(k=>k!=='people'&&k!=='directorEdited');assert.deepEqual(Object.fromEntries(rest.map(k=>[k,after[k]])),Object.fromEntries(rest.map(k=>[k,s[k]])),'oilers: nothing else changed');
  // A desk hidden in the Director (Desks tab Hide desk, a Layers eye) stays hidden in the film: the import dropped
  // `hide` (2026-11-15), so the desk came back. With a film cast member at that desk hidden in the v2 people
  // (director.mjs layersHideDesk): that person and their seconds leave the film's cast, everyone else is word for word.
  {
    const film=(s.sceneDeskEdits||[]).map(e=>structuredClone(e)),hidden='station-research-desk';
    const d=JSON.parse(run(null,{deskEdits:[...film.filter(e=>e.desk!==hidden),{desk:hidden,hide:true}]})).shots.find(x=>x.id==='oilers');
    assert.deepEqual(d.sceneDeskEdits.find(e=>e.desk===hidden),{desk:hidden,hide:true},'oilers: a desk hide reaches the film shot');
    assert.deepEqual(d.sceneDeskEdits.filter(e=>e.desk!==hidden),film.filter(e=>e.desk!==hidden),'oilers: the other desk edits are as they were');
    assert.deepEqual(d.people,s.people,'oilers: a desk hide without a user leaves the people alone');
    const user=s.people.cast.find(e=>e.station);
    if(user){
      const q={v:2,...structuredClone(s.people)};q.cast.find(e=>e.key===user.key).hide=true;
      const h=JSON.parse(run(q)).shots.find(x=>x.id==='oilers'),want=structuredClone(s.people);
      want.cast=want.cast.filter(e=>e.key!==user.key);if(want.when)delete want.when[user.key];
      assert.deepEqual(h.people.cast,want.cast,`oilers: ${user.key} hidden with their desk is out of the film's cast, the others word for word (walks, rolls, actions)`);
    }
    console.log(`desk hide: ${hidden} hide reaches sceneDeskEdits; ${user?user.key+' hidden with a desk leaves the cast, the rest verbatim':'no cast member at a desk'}`);
  }
  console.log(`people v2: unchanged -> identical; ${walker.key}'s walk start +0.5 s -> only people changed, directorEdited ${JSON.stringify(after.directorEdited.fields)}`);
}
fs.rmSync(tmp,{recursive:true,force:true});
// 4. an export of another cut's chapter is refused, and nothing is written
if(cutId){
  const s=cut.shots.find(x=>x.id==='oilers')||cut.shots[0],H=path.join(tmp,'other');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json','titles-src.json','shots/13-subshots.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(H,f));
  const page=path.join(tmp,'o-page.json');py(path.join(tools,'director-bridge.py'),'link',path.join(H,'review-cut.json'),'--shot',s.id,'--json',page);
  const other=cleanCut(JSON.parse(fs.readFileSync(page,'utf8')));other.id=`film-some-other-cut-${s.id}`;
  const ex=path.join(tmp,`Film-chapter-${s.id}-other.json`);fs.writeFileSync(ex,JSON.stringify(other));
  assert.throws(()=>py(path.join(tools,'build-round8-director.py'),H,'--import',ex),/belongs to film-some-other-cut/,'an export of another cut is refused');
  assert.ok(fs.readFileSync(path.join(H,'review-cut.json')).equals(src),'and the cut is untouched');
}
console.log(`Director round trip (${CUT}): director-film = review-cut.json; ${cut.shots.length} chapters opened and exported with no edit leave review-cut.json byte-identical.`);
