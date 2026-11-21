// The sonar's rings in the Director's live view (21 Nov 2026, Vico on chapter 11 awareness: "I don't see the sonar, so I
// can't see how it's going to look in the preview here. I even clicked the preview at full and I don't see the rings").
// The stage was prepared before film-fx put the obstacle (the dog) on it, and a paused Director never ticked, so the
// reach (and with it every ring) could stay missing for good; experience/stage.mjs now keeps looking (also while paused)
// and draws the rings to the Director's Size when no obstacle is there. Self-contained (any studio state), Vico's 3rd cut:
//   1  awareness, paused at 3 s, nothing edited: the film's sonar is found (the dog) and rings are drawn (sonar-1-film.png)
//   2  Graphics > Sonar: Size 60 in, 3 rings: the readout has the reach, rings drawn at 3 s       (sonar-2-size60.png)
//   3  Preview at full: every ring out at once, all drawn                                         (sonar-3-full.png)
//   4  Sonar off: no ring drawn; on again: drawn
//   CHROME=... [STATE_FROM=...] node tests/sonar-preview-e2e.mjs [shots dir]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-vicos-3rd-cut';
const shots=process.argv[2]||path.join(os.tmpdir(),'sonar-preview-shots');fs.mkdirSync(shots,{recursive:true});
const chapter=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='awareness');
assert.ok(chapter,'the 3rd cut has the awareness chapter');
const {base,page,errors,close}=await openDirectorBrowser();
const log=(...a)=>console.log(...a);
// every film-fx / film-status / stage line the page prints (21 Nov 2026: on Windows the obstacle never reached the stage)
const consoleLines=[];page.on('console',m=>{const t=m.text();if(/film[- ]?fx|film-status|film setup|obstacle|\[stage\]|\[people\]|sonar/i.test(t))consoleLines.push(m.type()+': '+t.slice(0,300));});
// What the stage has when the film's sonar is missing: film-fx loaded?, its objects, the film shot's obstacles, the status.
async function diag(){
  return page.evaluate(async url=>{
    const w=document.getElementById('stage').contentWindow,P=w.ErgoPresentation,{scene}=P.three(),fx=[],named={};
    scene.traverse(o=>{if(o.userData?.filmFx&&o.parent&&!o.parent.userData?.filmFx)fx.push((o.name||o.type)+(o.visible?'':' (hidden)'));if(/obstacle|status|sonar/i.test(o.name||''))named[o.name]=(named[o.name]||0)+1;});
    let film=null;try{const j=await (await fetch(url,{cache:'no-store'})).json();film={kind:j.kind,obstacles:j.obstacles??null,sonar:j.sonar??null,ledStatus:Array.isArray(j.ledStatus)?j.ledStatus.length:null};}catch(e){film='fetch failed: '+e.message;}
    return {filmFxLoaded:!!w.__filmFx,fxTop:fx.slice(0,40),named,info:P.sonarInfo?.()||null,snapshot:P.snapshot?.()||null,film,status:document.querySelector('#director-panel [data-status]')?.textContent||''};
  },new URL(chapter.shot,base).href).catch(e=>({error:e.message}));
}
const failures=[];
const soft=async(what,fn)=>{try{await fn();}catch(e){failures.push(what+': '+e.message.slice(0,600));log('FAIL',what,e.message.slice(0,600));}};
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · '+JSON.stringify(await rings().catch(e=>e.message))+' · status: '+await status(page));await wait(300);}};
const shoot=async name=>{await wait(400);const f=path.join(shots,name);await page.screenshot({path:f});log('screenshot',f);};
// what the stage draws: the ping / echo meshes (visible, opacity), the sonar info, the obstacles on the stage
const rings=()=>page.evaluate(()=>{const w=document.getElementById('stage').contentWindow,P=w.ErgoPresentation,{scene}=P.three();const out={pings:0,drawn:0,maxOpacity:0,obstacles:0};
  scene.traverse(o=>{if(o.name==='Film obstacle')out.obstacles++;if(o.name==='Stage sonar ping'){out.pings++;if(o.visible&&o.material.opacity>0.01){out.drawn++;out.maxOpacity=Math.max(out.maxOpacity,o.material.opacity);}}});
  out.info=P.sonarInfo?.()||null;return out;});
const change=async(name,value)=>{await page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [data-sonar] [name="${n}"]`);if(!e)throw Error('no field '+n);if(e.type==='checkbox')e.checked=!!v;else e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(900);};
try{
  await openChapter(page,base,chapter);
  await page.$eval('[data-inspector-tab="graphics"]',e=>e.click());await wait(600);
  await until(()=>page.$('#director-panel [data-sonar]'),'the Sonar section in the Graphics tab');
  await page.evaluate(()=>{try{localStorage.setItem('ergoflex.director.sonarUnit','in');}catch{}});
  // ---- 1 paused at 3 s, nothing edited: the film's obstacle found, rings drawn (no further seek needed: the stage looks on)
  await seek(page,3);
  await soft('1 the film\'s sonar, nothing edited',async()=>{
    const r1=await until(async()=>{const r=await rings();return r.info?.found&&r.drawn>0?r:null;},'the film\'s sonar drawn while paused (the obstacle found)',90000);
    log('1',JSON.stringify(r1));assert.ok(r1.obstacles>0,'the film obstacle is on the stage');assert.ok(r1.info.obstacle,'found by its obstacle');assert.ok(r1.maxOpacity>.1);});
  log('diagnostics after step 1:',JSON.stringify(await diag(),null,1));
  await page.$eval('#director-panel [data-sonar]',e=>e.scrollIntoView({block:'center'}));await shoot('sonar-1-film.png');
  // ---- 2 Size 60 in, 3 rings
  await soft('2 Size 60 in, 3 rings (with or without the obstacle)',async()=>{
    await change('so-radius-n',60);await change('so-rings-n',3);
    const r2=await until(async()=>{const r=await rings();return r.info?.radius&&Math.abs(r.info.radius-60)<.6&&r.drawn>0?r:null;},'rings at Size 60',30000);
    log('2',JSON.stringify(r2));assert.match(await page.$eval('#director-panel [data-sonar-readout]',e=>e.textContent),/Reach 60 in/);});
  await shoot('sonar-2-size60.png');
  // ---- 3 Preview at full
  await soft('3 Preview at full',async()=>{
    await page.$eval('#director-panel [data-sonar] [data-so-action="preview"]',e=>e.click());await wait(900);
    const r3=await rings();log('3',JSON.stringify(r3));await shoot('sonar-3-full.png');
    assert.equal(r3.info.preview,true,'Preview at full on');assert.ok(r3.drawn>=3,`every ring out at once (${r3.drawn} drawn)`);assert.ok(r3.maxOpacity>.1);
    await page.$eval('#director-panel [data-sonar] [data-so-action="preview"]',e=>e.click());await wait(600);});
  // ---- 4 off / on
  await soft('4 Sonar off / on',async()=>{
    await change('so-enabled',false);assert.equal((await rings()).drawn,0,'Sonar off: no ring');
    await change('so-enabled',true);await until(async()=>(await rings()).drawn>0,'rings back with Sonar on',20000);});
  log('film-fx / stage console lines:',JSON.stringify(consoleLines.slice(-40),null,1));
  if(failures.length)throw Error(failures.length+' step(s) failed:\n  '+failures.join('\n  '));
  assert.deepEqual(errors,[],'page errors');
  log(`PASS sonar-preview-e2e (screenshots in ${shots})`);
}catch(error){
  await page.screenshot({path:path.join(shots,'sonar-fail.png')}).catch(()=>{});console.log('status:',await status(page));throw error;
}finally{await close();}
