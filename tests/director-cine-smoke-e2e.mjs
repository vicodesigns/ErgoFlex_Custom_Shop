// S31 M1 smoke (real Chrome, the harness's own scratch server): the Director opens a chapter of the Cinematographer's
// cut as review-cut.json has it now (people from the film shot: the walker / roller moves as the playhead moves), and
// Export cut with no edit, imported and passed on a scratch copy of the cut folder, leaves review-cut.json identical.
//   STATE_FROM=C:/work/studio-state-rev3478.json CHROME=... node tests/director-cine-smoke-e2e.mjs [chapter id ...]
// Run under the GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',H0=path.join(root,CUT);
const ids=process.argv.slice(2).length?process.argv.slice(2):['oilers','storage'];
const chapters=JSON.parse(fs.readFileSync(path.join(H0,'director-chapters.json'),'utf8')).chapters;
const src=fs.readFileSync(path.join(H0,'review-cut.json'));
const py=(...a)=>execFileSync('python3',a,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-cine-smoke-'));
const {base,page,errors,close}=await openDirectorBrowser();
try{
  for(const id of ids){
    const c=chapters.find(x=>x.id===id);assert.ok(c,id+': no such chapter');
    await openChapter(page,base,c);
    const people=async t=>{await seek(page,t);await wait(1200);return page.evaluate(()=>(document.getElementById('stage').contentWindow.ErgoFlex?.workspaceRoom?.people?.list?.()||[]).filter(p=>p.visible).map(p=>({key:p.key,at:p.at,turn:p.turn})));};
    const film=JSON.parse(src).shots.find(s=>s.id===id),movers=(film.people?.cast||[]).filter(e=>e.walk||e.roll);
    const a=await people(movers.length?Math.max(.1,(movers[0].walk||movers[0].roll).start+.2):1),b=await people(movers.length?Math.min(c.seconds-.2,(movers[0].walk||movers[0].roll).start+2.5):c.seconds/2);
    assert.ok(a.length>0,id+': nobody visible on the stage');
    if(movers.length){const k=movers[0].key,pa=a.find(p=>p.key===k),pb=b.find(p=>p.key===k);assert.ok(pa&&pb,`${id}: ${k} on the stage`);const d=Math.hypot(pa.at[0]-pb.at[0],pa.at[1]-pb.at[1]);assert.ok(d>200,`${id}: ${k} moves along their path as the playhead moves (${Math.round(d)} mm)`);console.log(`${id}: ${a.length} people on the stage; ${k} moved ${Math.round(d)} mm between the two playhead times`);}
    // Export cut, no edit: capture the download
    const text=await page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-appbar [data-action="save-export"]').click();}));
    const H=path.join(tmp,id);fs.mkdirSync(path.join(H,'shots'),{recursive:true});
    for(const f of ['review-cut.json','titles-src.json','shots/13-subshots.json','cut.json'])if(fs.existsSync(path.join(H0,f)))fs.copyFileSync(path.join(H0,f),path.join(H,f));
    const ex=path.join(tmp,`Film-chapter-${id}.json`);fs.writeFileSync(ex,text);
    py(path.join(root,'tools/experience/build-round8-director.py'),H,'--import',ex);py(path.join(root,'tools/experience/build-round8-director.py'),H);
    assert.ok(fs.readFileSync(path.join(H,'review-cut.json')).equals(src),`${id}: open + Export cut with no edit leaves review-cut.json identical`);
    console.log(`${id}: opened, Export cut with no edit -> review-cut.json identical`);
  }
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS director cine smoke: '+ids.join(', '));
}finally{await close();fs.rmSync(tmp,{recursive:true,force:true});}
