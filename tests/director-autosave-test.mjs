// Director autosave (experience/director-autosave.mjs, tools/studio-state/autosave-store.mjs, the studio server's
// /__director/autosave routes): versions on disk under exports/director-autosaves/<cut>/<chapter>/, the same content
// written once, the history kept (30 newest, hourly for 14 days, then daily), bad names refused, and the routes on a
// scratch server (never :3000).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {writeAutosave,listAutosaves,readAutosave,keepOf,KEEP_NEWEST} from '../tools/studio-state/autosave-store.mjs';
import {createAutosave,placeOf,when,changesSince} from '../experience/director-autosave.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'autosave-test-'));
const project=n=>({id:'p1',name:'Cut',shots:[{id:'storage',seconds:12,camera:{keys:[{time:n}]}}]});
// ---- the store
const t0=new Date('2026-11-17T20:00:00Z');
const a=writeAutosave(root,{cut:'cinematic-intro-cut-x',chapter:'storage',reason:'edit',groups:['motion'],project:project(0)},t0);
assert.ok(!a.skipped&&a.file.endsWith('-edit.json.gz'));
assert.ok(writeAutosave(root,{cut:'cinematic-intro-cut-x',chapter:'storage',project:project(0)},new Date(+t0+1000)).skipped,'the same content is not written twice');
const b=writeAutosave(root,{cut:'cinematic-intro-cut-x',chapter:'storage',reason:'chapter',project:project(.5)},new Date(+t0+2000));
assert.deepEqual(readAutosave(root,'cinematic-intro-cut-x','storage',b.file),project(.5));
writeAutosave(root,{cut:'cinematic-intro-cut-x',chapter:'rise',project:project(.2)},new Date(+t0+3000));
const list=listAutosaves(root,'cinematic-intro-cut-x');assert.deepEqual(list.map(x=>[x.chapter,x.reason]),[['rise','edit'],['storage','chapter'],['storage','edit']]);
assert.deepEqual(list.find(x=>x.reason==='edit'&&x.chapter==='storage').groups,['motion']);
assert.ok(!fs.readdirSync(path.join(root,'exports')).some(d=>d!=='director-autosaves'),'nothing outside exports/director-autosaves');
for(const bad of ['../x','a/b','.hidden',''])assert.throws(()=>writeAutosave(root,{cut:bad,chapter:'storage',project:project(1)}),/Bad cut/);
assert.throws(()=>readAutosave(root,'cinematic-intro-cut-x','storage','../../review-cut.json'),/Bad autosave file/);
// the history: 30 newest, then one an hour for 14 days, then one a day
{const now=Date.parse('2026-12-01T12:00:00Z'),h=3600e3,entries=[];
  for(let i=0;i<40;i++)entries.push({file:`f${i}`,at:new Date(now-i*60e3).toISOString()});            // 40 in the last 40 minutes
  for(let i=1;i<=48;i++)for(const m of [5,35])entries.push({file:`h${i}${m}`,at:new Date(now-i*h-m*60e3).toISOString()});   // two an hour, two days back
  for(let d=20;d<23;d++)for(const k of [0,6])entries.push({file:`d${d}${k}`,at:new Date(now-d*24*h-k*h).toISOString()});   // older than 14 days: two a day
  const kept=keepOf(entries,now),files=new Set(kept.map(e=>e.file));
  for(let i=0;i<KEEP_NEWEST;i++)assert.ok(files.has(`f${i}`));
  const hours=new Set(kept.slice(KEEP_NEWEST).filter(e=>now-Date.parse(e.at)<14*24*h).map(e=>Math.floor(Date.parse(e.at)/h)));
  assert.equal(hours.size,kept.slice(KEEP_NEWEST).filter(e=>now-Date.parse(e.at)<14*24*h).length,'one an hour');
  assert.equal(kept.filter(e=>now-Date.parse(e.at)>14*24*h).length,3,'one a day after two weeks');}
{let last;for(let i=0;i<40;i++)last=writeAutosave(root,{cut:'c2',chapter:'awaken',project:project(i)},new Date(+t0+i*1000));
  assert.equal(last.kept,KEEP_NEWEST);assert.equal(fs.readdirSync(path.join(root,'exports/director-autosaves/c2/awaken')).filter(f=>f.endsWith('.gz')).length,KEEP_NEWEST,'pruned files are deleted');}
// ---- the client: where, a save, the same content once, the tab closing, the server too old
assert.deepEqual(placeOf('/exports/cinematic-intro-cut-vicos-2nd-cut',project(0)),{cut:'cinematic-intro-cut-vicos-2nd-cut',chapter:'storage'});
assert.deepEqual(placeOf(null,{id:'abc 1',shots:[{},{}]}),{cut:'library-abc-1',chapter:'project'});
// what changed since the export, by name (a headline edit is not 'camera')
{const base={shots:[{id:'storage',title:'A',seconds:12,camera:{keys:[1]},titles:[{id:'t'}]}]};
  assert.deepEqual(changesSince(base,{shots:[{...base.shots[0],title:'B'}]}),['headline']);
  assert.deepEqual(changesSince(base,{shots:[{...base.shots[0],titles:[{id:'t',text:'x'}],motion:{clips:[]}}]}),['desk','titles']);
  assert.deepEqual(changesSince(base,structuredClone(base)),[]);}
assert.match(when('2026-11-17T22:14:00',new Date('2026-11-17T23:00:00')),/^22:14$/);
{const posts=[];let p=project(0),status=200;
  const fetcher=async(url,opt)=>{posts.push({url,opt,body:opt?.body&&JSON.parse(opt.body)});return {status,ok:status===200,json:async()=>status===200?{at:'2026-11-17T22:14:00.000Z',file:'x'}:{error:'no'}};};
  const states=[];const s=createAutosave({place:()=>({cut:'c',chapter:'storage'}),project:()=>p,groups:()=>['motion'],escape:x=>x,status(){},restore(){},onState:x=>states.push(x.kind),fetcher});
  await s.save('edit');assert.equal(posts.length,1);assert.deepEqual(posts[0].body.groups,['motion']);assert.equal(posts[0].body.v,1);assert.match(s.text().text,/^Autosaved \d\d:\d\d ✓$/);
  await s.save('edit');assert.equal(posts.length,1,'unchanged: not sent again');
  p=project(1);s.poke();assert.equal(s.state().kind,'pending');s.closing();assert.equal(posts.length,2);assert.equal(posts[1].body.reason,'close');assert.equal(posts[1].opt.keepalive,true);
  status=404;p=project(2);await s.save('edit');assert.equal(s.state().kind,'off');assert.match(s.text().text,/restart the studio server/);assert.ok(s.text().warn);
  status=500;await s.save('edit');assert.equal(s.state().kind,'error');}
// ---- the routes, on a scratch server
const port=31000+Math.floor(Math.random()*900),srv=spawn(process.execPath,[new URL('../tools/studio-server.mjs',import.meta.url).pathname,'--root',root,'--port',String(port),'--host','127.0.0.1','--state','state.json','--no-watch'],{stdio:['ignore','pipe','pipe']});
try{
  await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('server did not start')),15000);srv.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});srv.on('exit',c=>fail(Error('server exited '+c)));});
  const base=`http://127.0.0.1:${port}`;
  let r=await fetch(base+'/__director/autosave',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({v:1,cut:'srv-cut',chapter:'coast',reason:'edit',groups:[],project:project(3)})});
  const w=await r.json();assert.equal(r.status,200);assert.ok(w.file);
  r=await fetch(base+'/__director/autosaves?cut=srv-cut');const l=await r.json();assert.equal(l.list.length,1);assert.equal(l.list[0].chapter,'coast');
  r=await fetch(`${base}/__director/autosave?cut=srv-cut&chapter=coast&file=${encodeURIComponent(w.file)}`);assert.deepEqual(await r.json(),project(3));
  r=await fetch(base+'/__director/autosave',{method:'POST',body:JSON.stringify({v:1,cut:'../../etc',chapter:'x',project:project(1)})});assert.equal(r.status,400);
  r=await fetch(base+'/__director/autosave',{method:'POST',body:'{"v":2}'});assert.equal(r.status,400);
}finally{srv.kill('SIGTERM');}
fs.rmSync(root,{recursive:true,force:true});
console.log('director-autosave-test: ok (store, history, names, client save / dedupe / close / old server, server routes)');
