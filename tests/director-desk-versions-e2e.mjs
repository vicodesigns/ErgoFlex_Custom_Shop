// Director "Desk versions", end to end (real GPU Chrome; not one of the quick tests/cinematic-* checks).
// Chapter 12 (hero) is rendered as six sub-shots, one desk build each (shots/13-subshots.json, copied by
// build-round8-director.py --pages to director-film/hero-subshots.json). The Director shows them as a lane of 6
// segments (A · Artist … F · Gaming); seeking into a segment puts that sub-shot's desk on the live stage and names it
// on the frame (8 s: B · OCC, Coast Navy top; 30 s: E · Office, Modern Grey top); a segment click seeks to where its
// desk starts; Render still inside a segment renders that desk; no page errors.
//
//   node tests/director-desk-versions-e2e.mjs        (BASE=http://127.0.0.1:3109 to use a running server;
//                                                     SHOTS=<dir> also saves frames at 2 8 17 24 30 40 s)
// Run it under flock /tmp/claude-1000/hq12-stills.lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chapterList,root,HQ,wait,openDirectorBrowser,openChapter,status as statusOf,seek} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='hero');
if(!chapter||!fs.existsSync(path.join(root,HQ,'director-film','hero-subshots.json'))){console.log(`Director desk versions e2e: skipped (${HQ} has no hero chapter or director-film/hero-subshots.json: run build-round8-director.py --pages hero).`);process.exit(0);}
const WANT=[['A','Artist'],['B','OCC'],['C','Architect'],['D','HBHS'],['E','Office'],['F','Gaming']];
// The desk each sub-shot's preset puts on the stage: the film renders the finale with --storage post/finale-seed.json,
// whose saved builds (ergoflex.buildPresetsV1, 60x30) are the presets' desks; the Director's stage takes the same seed.
const PRESET={A:'artist',B:'occ',C:'architect',D:'hbhs',E:'office',F:'gaming'},subFile=JSON.parse(fs.readFileSync(path.join(root,HQ,'director-film','hero-subshots.json'),'utf8'));
const seedFile=subFile.storage&&path.join(root,subFile.storage.replace(/^\//,''));
const builds=seedFile&&fs.existsSync(seedFile)?JSON.parse(JSON.parse(fs.readFileSync(seedFile,'utf8'))['ergoflex.buildPresetsV1']).data.data.entries:null;
const {SHARED_BUILD_PRESETS:P}=await import('../preset-defaults.mjs');
const build=id=>{const e=builds?.[id];return e?(e.config.size==='60x30'?e.config:e.sizeSetups['60x30'].config):P[id].config;};
const WOOD=Object.fromEntries(Object.entries(PRESET).map(([n,id])=>[n,build(id).woodFinish])),TRIM=Object.fromEntries(Object.entries(PRESET).map(([n,id])=>[n,build(id).trimColor.toLowerCase()]));
const MARK={A:'artist-easel',C:'drafting-kit',D:builds?'portrait-monitor':'flat-monitor'};   // A and C share a finish
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const stageDesk=()=>page.evaluate(()=>{const api=document.getElementById('stage').contentWindow.ErgoFlex;return {wood:api.currentConfig.woodFinish,trim:api.currentConfig.trimColor,accessories:[...api.currentConfig.accessories]};});
const badge=()=>page.$eval('.desk-version-badge',e=>e.hidden?'':e.textContent).catch(()=>'');
// Seek, then wait until the stage carries the desk of that sub-shot (the switch re-prepares the stage).
async function seekTo(t,n){
  const started=Date.now();await seek(page,t);
  await page.waitForFunction((wood,trim,mark)=>{const c=document.getElementById('stage').contentWindow.ErgoFlex.currentConfig;
    return c.woodFinish===wood&&String(c.trimColor).toLowerCase()===trim&&(!mark||c.accessories.includes(mark))&&!document.body.classList.contains('loading')&&!/^Switching/.test(document.querySelector('#director-panel [data-status]')?.textContent||'');},{timeout:120000,polling:100},WOOD[n],TRIM[n],MARK[n]||'');
  const took=(Date.now()-started)/1000;await wait(900);return took;
}
try{
  await openChapter(page,base,chapter);
  const lane=await page.$$eval('#director-timeline [data-desk-version]',b=>b.map(x=>({n:x.dataset.deskVersion,text:x.querySelector('strong').textContent,left:parseFloat(x.style.left),width:parseFloat(x.style.width)})));
  check(lane.length===6,`the Desk versions lane has ${lane.length} segments (6)`);
  check(JSON.stringify(lane.map(x=>x.text))===JSON.stringify(WANT.map(([n,l])=>`${n} · ${l}`)),'segments read '+lane.map(x=>x.text).join(', '));
  const fades=await page.$$eval('#director-timeline .desk-version-fade',e=>e.length);check(fades===5,`5 crossfade overlaps shown (${fades})`);
  check(Math.abs(lane[1].left-4.7/48*100)<.01&&Math.abs(lane[1].left+lane[1].width-13.1/48*100)<.01,'B spans its renderRange 4.7–13.1 s');
  check((await badge())==='Desk A · Artist',`at 0 s the frame reads "${await badge()}"`);
  check((await stageDesk()).wood===WOOD.A,`at 0 s the stage desk is the artist build (${(await stageDesk()).wood})`);

  for(const [t,n,label] of [[8,'B','OCC'],[30,'E','Office']]){
    const took=await seekTo(t,n),desk=await stageDesk();
    check((await badge())===`Desk ${n} · ${label}`,`${t} s: the frame reads "${await badge()}" (${took.toFixed(1)} s to switch)`);
    check(desk.wood===WOOD[n],`${t} s: the stage desk top is ${desk.wood} (${WOOD[n]})`);
    if(n==='E')check(['wide-monitor','portrait-monitor'].every(a=>desk.accessories.includes(a)),'30 s: the office build has both monitors');
    check(!/film setup could not be applied/.test(await statusOf(page)),`${t} s: the sub-shot's film setup applied`);
    check(!/could not/.test(await statusOf(page)),'status: '+await statusOf(page));
  }
  // Scrub back and forth across seams quickly: the stage settles on the last one.
  for(const t of [3,16,25,44])await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},t);
  await seekTo(44,'F');check((await stageDesk()).wood===WOOD.F&&(await badge())==='Desk F · Gaming','fast scrub 3 > 16 > 25 > 44 s settles on F · Gaming');
  // A segment click seeks to where its desk starts (the middle of its crossfade in).
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="C"]').click());
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#director-timeline [name="timeline-seconds"]').value)-12.8)<.05,{timeout:10000}).catch(()=>{});
  const at=Number(await page.$eval('#director-timeline [name="timeline-seconds"]',e=>e.value));check(Math.abs(at-12.8)<.05,`clicking C seeks to ${at} s (12.8: the middle of the B > C crossfade)`);
  await seekTo(at,'C');check((await stageDesk()).wood===WOOD.C,'C: the architect build is on the stage');

  if(process.env.SHOTS){
    fs.mkdirSync(process.env.SHOTS,{recursive:true});
    for(const [t,n] of [[2,'A'],[8,'B'],[17,'C'],[24,'D'],[30,'E'],[40,'F']]){await seekTo(t,n);await wait(1500);await page.screenshot({path:path.join(process.env.SHOTS,`hero-${String(t).padStart(2,'0')}s-${n}.png`)});console.log('     saved', `hero-${t}s-${n}.png`);}
  }
  // Render still inside D renders the HBHS desk (the still renderer's stage is its own).
  await seekTo(24,'D');
  await page.evaluate(()=>document.querySelector('.film-tools [data-action=render-still]').click());
  await page.waitForFunction(()=>/Still rendered|Render still failed/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
  const still=await page.evaluate(()=>{const w=document.querySelector('iframe[title="Film still renderer"]')?.contentWindow,c=w?.ErgoFlex?.currentConfig;return c?`${c.woodFinish} / ${String(c.trimColor).toLowerCase()} / ${c.accessories.join(',')}`:'none';});
  check(/Still rendered/.test(await statusOf(page)),'24 s Render still: '+await statusOf(page));
  check(still.startsWith(`${WOOD.D} / ${TRIM.D} /`)&&still.includes(MARK.D),`24 s Render still uses the HBHS build (${still})`);
  // The live stage's storage gets its own values back outside the desk versions (here: still the hero, so seeded).
  check(await page.evaluate(()=>!!document.getElementById('stage').contentWindow.__ERGO_PRESENTATION__),'the stage storage is the memory-only presentation copy');
  if(process.env.SHOTS){const url=await page.$eval('#film-still img',i=>i.src).catch(()=>null);if(url?.startsWith('data:'))fs.writeFileSync(path.join(process.env.SHOTS,'hero-24s-D-render-still.jpg'),Buffer.from(url.split(',')[1],'base64'));}
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){failures.push(error.message);console.error(error);}
finally{await close();}
assert.equal(failures.length,0,failures.join('\n'));
console.log('Director desk versions e2e: ok');
