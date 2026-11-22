// POST /api/screen-edit (tools/studio-server.mjs; the Director's Render still with the movie's edit list composed, so it
// shows the real dissolve / dip). On a scratch tree (two 2 s synthetic clips, ffmpeg testsrc, nothing big): an edit list
// is composed in a child (screen-edit-for-director.mjs) into exports/<cut>/screens/edl/, the answer is the render's
// screens (one entry per run, the composed mp4); the same request again is cached; a shot without transitionIn is
// answered at once with its own screens, nothing composed; a bad cut or shot is refused; two at once run one after the
// other. CPU only (ffmpeg on 160x90 frames, about a second).
//   node tests/screen-edit-server-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(spawnSync('ffmpeg',['-version']).status!==0){console.log('screen-edit-server-test: skipped (no ffmpeg)');process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'screen-edit-server-')),cut='exports/test-cut';
fs.mkdirSync(path.join(tmp,cut),{recursive:true});fs.mkdirSync(path.join(tmp,'media'),{recursive:true});
fs.writeFileSync(path.join(tmp,cut,'review-cut.json'),JSON.stringify({shots:[{id:'media',seconds:4}]}));
for(const [n,c] of [['a','testsrc'],['b','smptebars']])assert.equal(spawnSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',`${c}=size=160x90:rate=30:duration=3`,'-pix_fmt','yuv420p',path.join(tmp,'media',n+'.mp4')]).status,0,'made '+n);
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const server=spawn(process.execPath,[path.join(repo,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--root',tmp,'--state',path.join(tmp,'state.json')],{cwd:repo,stdio:['ignore','pipe','pipe']});
let serverErr='';server.stderr.on('data',d=>{serverErr+=d;});
try{
  await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('server did not start: '+serverErr)),20000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.once('exit',c=>fail(Error('server exited '+c+' '+serverErr)));});
  const post=async body=>{const r=await fetch(`http://127.0.0.1:${port}/api/screen-edit`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  const edit=[{target:'main-landscape',src:'media/a.mp4',start:0,end:2,offset:0},{target:'main-landscape',src:'media/b.mp4',start:2,end:4,offset:1,transitionIn:{type:'dissolve',dur:.5}}];
  // ---- composed: one run, the composed mp4 under the cut's screens/edl
  const t0=Date.now(),[one,two]=await Promise.all([post({cut:'/'+cut,shot:{id:'media',seconds:4,screens:edit}}),post({cut:'/'+cut,shot:{id:'media',seconds:4,screens:edit.map(s=>({...s}))}})]);
  assert.equal(one.status,200,JSON.stringify(one.body));assert.equal(one.body.composed,true);
  const run=one.body.screens;assert.equal(run.length,1,'one entry for the run');
  assert.match(run[0].src,/^exports\/test-cut\/screens\/edl\/media-main-landscape-[0-9a-f]{12}\.mp4$/);assert.deepEqual([run[0].start,run[0].end,run[0].rate,run[0].loop],[0,4,1,false]);
  assert.ok(fs.existsSync(path.join(tmp,run[0].src)),'the composed mp4 is there');
  assert.ok(one.body.report.some(l=>/dissolve/.test(l)),'the report says what it composed');
  assert.equal(two.status,200);assert.deepEqual(two.body.screens,run,'the second of two at once: the same (queued, then cached or reused)');
  const again=await post({cut:cut,shot:{id:'media',seconds:4,screens:edit}});assert.equal(again.body.cached,true,'the same request again: cached');assert.deepEqual(again.body.screens,run);
  console.log(`composed in ${Date.now()-t0} ms`);
  // ---- no edit list: at once, untouched
  const plain=[{target:'main-landscape',src:'media/a.mp4',offset:0}];
  const p=await post({cut:'/'+cut,shot:{id:'media',seconds:4,screens:plain}});assert.equal(p.status,200);assert.equal(p.body.composed,false);assert.deepEqual(p.body.screens,plain);
  // ---- refused
  assert.equal((await post({cut:'/exports/nope',shot:{id:'media',seconds:4,screens:edit}})).status,400,'not a cut');
  assert.equal((await post({cut:'/../etc',shot:{id:'media',seconds:4,screens:edit}})).status,400,'not under exports');
  assert.equal((await post({cut:'/'+cut,shot:{id:'media',seconds:0,screens:edit}})).status,400,'no length');
  const bad=await post({cut:'/'+cut,shot:{id:'media',seconds:4,screens:[edit[0],{...edit[1],src:'media/gone.mp4'}]}});assert.equal(bad.status,500);assert.match(bad.body.error,/source missing: media\/gone\.mp4/,'a missing source: said');
  console.log('screen-edit-server-test: ok (composed in a child into the cut\'s screens/edl, cached, queued, no edit list = untouched, bad requests refused)');
}finally{server.kill();fs.rmSync(tmp,{recursive:true,force:true});}
