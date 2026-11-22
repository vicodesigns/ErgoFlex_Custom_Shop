// The sonar's rings in the Director's live view, checked in PIXELS (21 Nov 2026, Vico on chapter 8 awareness: "I don't
// see the sonar ... I even clicked the preview at full and I don't see the rings"; org reproduced it in the desk's Chrome:
// the ring meshes visible with opacity .83 and not one ring pixel on screen: the film's band, w*.007, is under a pixel in
// the Director's viewport on a slanted floor, and (found in the desk's Chrome) the live floor buried them in depth.
// experience/stage.mjs now draws them live at least 2 screen pixels wide and 4 cm higher, still depth-tested (never in a
// bake: the film and Render still are unchanged)). Self-contained (any studio state), Vico's 3rd cut:
//   1  awareness, paused at 3 s, nothing edited: ring pixels on screen (sonar on vs off, same frame)   (sonar-1-film.png)
//   2  Size 60 in, 3 rings: ring pixels                                                                (sonar-2-size60.png)
//   3  Preview at full: ring pixels                                                                    (sonar-3-full.png)
// Ring pixels: the stage's screenshot with the Sonar on against the same frame with it off; a pixel counts when it is
// brighter in blue by 25 or more with the sonar on and cyan (blue above red by 30). window.__sonarDebug() is logged too.
//   CHROME=... [STATE_FROM=...] [MIN_RING_PIXELS=150] node tests/sonar-preview-e2e.mjs [shots dir]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-vicos-3rd-cut',MIN_PIXELS=Number(process.env.MIN_RING_PIXELS||150);
const shots=process.argv[2]||path.join(os.tmpdir(),'sonar-preview-shots');fs.mkdirSync(shots,{recursive:true});
const chapter=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters.find(x=>x.id==='awareness');
assert.ok(chapter,'the 3rd cut has the awareness chapter');
const {base,page,errors,close}=await openDirectorBrowser();
const log=(...a)=>console.log(...a);
const consoleLines=[];page.on('console',m=>{const t=m.text();if(/film[- ]?fx|film-status|film setup|obstacle|\[stage\]|sonar/i.test(t))consoleLines.push(m.type()+': '+t.slice(0,300));});
const debug=()=>page.evaluate(()=>document.getElementById('stage').contentWindow.__sonarDebug?.()||null).catch(e=>({error:e.message}));
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · '+JSON.stringify(await debug())+' · status: '+await status(page));await wait(300);}};
const change=async(name,value)=>{await page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [data-sonar] [name="${n}"]`);if(!e)throw Error('no field '+n);if(e.type==='checkbox')e.checked=!!v;else e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(1000);};
const stageShot=async()=>{const el=await page.$('#stage');return 'data:image/png;base64,'+await el.screenshot({encoding:'base64'});};
// the ring pixels: the stage with the sonar on against the same frame with it off (Sonar on unticked, then ticked again)
async function ringPixels(name){
  const off=(await change('so-enabled',false),await stageShot());await change('so-enabled',true);const on=await stageShot();
  if(name)fs.writeFileSync(path.join(shots,name),Buffer.from(on.split(',')[1],'base64'));
  const m=await page.evaluate(async(a,b)=>{
    const px=async u=>{const i=new Image();i.src=u;await i.decode();const k=document.createElement('canvas');k.width=i.naturalWidth;k.height=i.naturalHeight;const g=k.getContext('2d');g.drawImage(i,0,0);return {d:g.getImageData(0,0,k.width,k.height).data,w:k.width,h:k.height};};
    const A=await px(a),B=await px(b);let n=0,x0=1e9,x1=-1,y0=1e9,y1=-1;
    for(let i=0;i<A.d.length;i+=4){if(A.d[i+2]-B.d[i+2]>=25&&A.d[i+2]-A.d[i]>=30){n++;const p=i/4,x=p%A.w,y=Math.floor(p/A.w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
    return {ringPixels:n,box:n?[x0,y0,x1,y1]:null,size:[A.w,A.h]};},on,off);
  log('ring pixels',name||'',JSON.stringify(m),'debug',JSON.stringify(await debug()));return m;
}
const failures=[];
const soft=async(what,fn)=>{try{await fn();}catch(e){failures.push(what+': '+e.message.slice(0,600));log('FAIL',what,e.message.slice(0,600));}};
try{
  await openChapter(page,base,chapter);
  await page.$eval('[data-inspector-tab="graphics"]',e=>e.click());await wait(600);
  await until(()=>page.$('#director-panel [data-sonar]'),'the Sonar section in the Graphics tab');
  await page.evaluate(()=>{try{localStorage.setItem('ergoflex.director.sonarUnit','in');}catch{}});
  await seek(page,3);
  await until(async()=>{const d=await debug();return d?.R>0?d:null;},'the sonar\'s reach (the film\'s obstacle, or a size)',90000).catch(e=>log('no reach yet:',e.message.slice(0,400)));
  // ---- 1 the film's sonar, nothing edited
  await soft('1 the film\'s sonar on screen (paused at 3 s, nothing edited)',async()=>{const m=await ringPixels('sonar-1-film.png');assert.ok(m.ringPixels>=MIN_PIXELS,`ring pixels ${m.ringPixels} (need ${MIN_PIXELS})`);});
  // ---- 2 Size 60 in, 3 rings
  await soft('2 Size 60 in, 3 rings on screen',async()=>{
    await change('so-radius-n',60);await change('so-rings-n',3);
    assert.match(await page.$eval('#director-panel [data-sonar-readout]',e=>e.textContent),/Reach 60 in/);
    const m=await ringPixels('sonar-2-size60.png');assert.ok(m.ringPixels>=MIN_PIXELS,`ring pixels ${m.ringPixels} (need ${MIN_PIXELS})`);});
  // ---- 3 Preview at full
  await soft('3 Preview at full on screen',async()=>{
    await page.$eval('#director-panel [data-sonar] [data-so-action="preview"]',e=>e.click());await wait(1000);
    const d=await debug();assert.equal(d?.previewFull,true,'Preview at full on');
    const m=await ringPixels('sonar-3-full.png');assert.ok(m.ringPixels>=MIN_PIXELS,`ring pixels ${m.ringPixels} (need ${MIN_PIXELS})`);
    await page.$eval('#director-panel [data-sonar] [data-so-action="preview"]',e=>e.click());await wait(600);});
  await page.screenshot({path:path.join(shots,'sonar-4-page.png')});
  log('film-fx / stage console lines:',JSON.stringify(consoleLines.slice(-40),null,1));
  if(failures.length)throw Error(failures.length+' step(s) failed:\n  '+failures.join('\n  '));
  assert.deepEqual(errors,[],'page errors');
  log(`PASS sonar-preview-e2e (screenshots in ${shots})`);
}catch(error){
  await page.screenshot({path:path.join(shots,'sonar-fail.png')}).catch(()=>{});console.log('status:',await status(page));throw error;
}finally{await close();}
