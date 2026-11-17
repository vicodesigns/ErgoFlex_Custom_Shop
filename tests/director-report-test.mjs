// Report a problem (keys drop 2, 17 Nov 2026): the action log, the report body, and the studio server writing it to
// exports/director-reports/<time>/ (a scratch root, no watching). An older server (404) downloads it instead.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createActionLog,reportBody,sendReport} from '../experience/director-report.mjs';

const log=createActionLog(3);
for(const id of ['play','loop','palette','tool-move','repeat-last'])log.add(id,id,'key');
assert.equal(log.list().length,3,'the last few only');assert.equal(log.last(),'tool-move','repeat skips the search and itself');
const png='data:image/png;base64,'+Buffer.from([0x89,0x50,0x4e,0x47,1,2,3]).toString('base64');
const body=reportBody({note:'W did nothing on Maya',url:'http://127.0.0.1:3000/experience/',selection:{person:'maya'},log:log.list(),errors:[{at:'x',text:'boom'}],screenshot:png,view:null,version:null});
assert.equal(body.v,1);assert.equal(reportBody({screenshot:'javascript:alert(1)'}).screenshot,null,'only an image data URL');

// the endpoint, on a scratch root
const root=fs.mkdtempSync(path.join(os.tmpdir(),'director-report-')),port=3900+Math.floor(Math.random()*90);
const server=spawn(process.execPath,[new URL('../tools/studio-server.mjs',import.meta.url).pathname,'--port',String(port),'--host','127.0.0.1','--root',root,'--no-watch'],{stdio:['ignore','pipe','pipe']});
try{
  await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('server did not start')),8000);server.stdout.on('data',d=>{if(/studio server/.test(d)){clearTimeout(t);ok();}});server.on('exit',c=>fail(Error('server exited '+c)));});
  const at=p=>`http://127.0.0.1:${port}${p}`;
  const r=await sendReport(body,{fetch:(u,o)=>fetch(at(u),o),download:()=>assert.fail('the server has the endpoint')});
  assert.match(r.dir,/^exports\/director-reports\/\d{8}T\d{6}-[a-z0-9]{4}$/);
  const dir=path.join(root,r.dir),saved=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
  assert.equal(saved.note,'W did nothing on Maya');assert.equal(saved.screenshot,'screenshot.png');assert.deepEqual(saved.selection,{person:'maya'});
  assert.deepEqual([...fs.readFileSync(path.join(dir,'screenshot.png'))],[0x89,0x50,0x4e,0x47,1,2,3]);
  assert.match(fs.readFileSync(path.join(dir,'README.md'),'utf8'),/W did nothing on Maya[\s\S]*tool-move[\s\S]*boom/);
  assert.equal((await fetch(at('/__director/report'),{method:'POST',body:'{"v":2}'})).status,400,'not a report: refused');
  // an older server: downloaded instead
  let got=null;assert.equal(await sendReport(body,{fetch:async()=>({ok:false,status:404,json:async()=>({})}),download:b=>{got=b;}}),null);assert.equal(got,body);
  got=null;await sendReport(body,{fetch:async()=>{throw new TypeError('Failed to fetch');},download:b=>{got=b;}});assert.equal(got,body,'no server at all: downloaded');
}finally{server.kill();fs.rmSync(root,{recursive:true,force:true});}
console.log('director-report-test: ok');
