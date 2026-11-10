// Director Cut menu end to end (real GPU Chrome): the film's cuts are listed, switching opens the same chapter of the
// other cut as a project of its own, and Duplicate makes a new cut (the studio server's /__film/duplicate) and opens it.
// Run under: flock /tmp/claude-1000/hq12-stills.lock node tests/director-cuts-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDirectorBrowser,openChapter,chapterList,status,wait,root} from './director-e2e-harness.mjs';

const tool=path.join(root,'tools/experience/film-cuts.py'),ALT='exports/cinematic-intro-20261110-alt';
if(!fs.existsSync(path.join(root,ALT,'director-chapters.json')))execFileSync('python3',[tool,'adopt',ALT,'Alternate cut','--id','alt']);
execFileSync('python3',[tool,'list']);
const {base,page,errors,close}=await openDirectorBrowser();
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);};
const until=async(fn,what,ms=120000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(250);}};
const live=()=>page.evaluate(()=>location.pathname==='/experience/'&&/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''));
const cutSelect=()=>page.evaluate(()=>{const el=document.querySelector('#director-timeline select[name="film-cut"]');return el?{value:el.value,options:[...el.options].map(o=>o.value)}:null;});
const project=()=>page.evaluate(()=>{try{const h=new URLSearchParams(location.hash.slice(1)),c=h.get('cut').replaceAll('-','+').replaceAll('_','/');return {id:JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(c),x=>x.charCodeAt(0)))).id,film:h.get('film')};}catch{return null;}});
const choose=v=>page.evaluate(v=>{const el=document.querySelector('#director-timeline select[name="film-cut"]');el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));},v);
let made=null;
try{
  await openChapter(page,base,chapterList().find(c=>c.id==='rise'));
  const first=await until(cutSelect,'the Cut menu');
  check(first.value==='vico'&&first.options.includes('alt')&&first.options.at(-1)==='__new','the Cut menu lists the film\'s cuts, this one selected: '+first.options.join(', '));
  // ---- switch to the alternate cut: same chapter, its own project
  await choose('alt');
  await until(async()=>(await project())?.film?.includes(ALT)&&await live(),'the alternate cut\'s chapter opens');
  const alt=await project(),sel=await until(cutSelect,'the Cut menu in the other cut');
  check(alt.id==='film-alt-rise'&&sel.value==='alt','switching opens the same chapter of the other cut as its own project: '+alt.id);
  check(await page.evaluate(()=>/rise/.test(document.querySelector('#director-timeline select[name="film-chapter"]')?.selectedOptions[0]?.textContent||'')),'the chapter picker follows the cut');
  // ---- duplicate it
  await choose('__new');
  await until(()=>page.$('#film-cut-new[open] input[name="cut-name"]'),'the new cut dialog');
  await page.evaluate(()=>{const d=document.getElementById('film-cut-new');d.querySelector('input').value='E2E copy';d.querySelector('button[value=make]').click();});
  await until(async()=>/cinematic-intro-cut-e2e-copy/.test((await project())?.film||'')&&await live(),'the copy opens',240000);
  made=path.join(root,'exports',(await project()).film.split('/')[2]);
  const copy=await project(),sel2=await until(cutSelect,'the Cut menu in the copy');
  check(/^film-e2e-copy(-\d+)?-rise$/.test(copy.id)&&/^e2e-copy/.test(sel2.value)&&fs.existsSync(path.join(made,'cut.json')),'Duplicate makes a new cut and opens it: '+copy.id);
  check(fs.readFileSync(path.join(made,'review-cut.json'),'utf8')===fs.readFileSync(path.join(root,ALT,'review-cut.json'),'utf8'),'the copy starts with the same film data');
  check(!errors.length,'no page errors: '+errors.join(' | '));
  console.log('PASS Director cuts: '+passed.join('; ')+'.');
}catch(error){console.error('FAIL after: '+passed.join('; '));console.error(error.message);console.error('status: '+await status(page));console.error('errors: '+errors.join(' | '));process.exitCode=1;}
finally{await close();if(made&&/cinematic-intro-cut-e2e-copy/.test(made))fs.rmSync(made,{recursive:true,force:true});for(const d of fs.readdirSync(path.join(root,'exports')))if(/^cinematic-intro-cut-e2e-copy/.test(d))fs.rmSync(path.join(root,'exports',d),{recursive:true,force:true});execFileSync('python3',[tool,'list']);}
