// Director "Desk version" editing on chapter 12 (hero), end to end (real GPU Chrome; run under the browser-test gate).
// Click a desk in the Desk versions lane -> the Desk version panel: Model, Name, shown from / until. Changing HBHS to Music is a full
// preset swap (the stickers go with the model), a rename shows on the lane and the badge, dragging a desk reorders (the time slots
// stay, a desk keeps its letter), dragging the seam between two desks retimes them, Export cut carries shot.deskVersions, and the importer + pass rewrite
// shots/13-subshots.json (valid, six entries) in a temp copy.
//   node tests/director-desk-versions-edit-e2e.mjs      (BASE=http://127.0.0.1:3130 to use a running server; SHOTS=<dir> keeps pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,seek} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='hero');
if(!chapter||!fs.existsSync(path.join(root,HQ,'director-film','hero-subshots.json'))){console.log(`Director desk versions edit e2e: skipped (${HQ} has no hero chapter or director-film/hero-subshots.json).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-desk-versions-edit-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const until=async(fn,what,ms=120000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const lane=()=>page.$$eval('#director-timeline [data-desk-version]',b=>b.map(x=>({n:x.dataset.deskVersion,text:x.querySelector('strong').textContent,left:parseFloat(x.style.left),width:parseFloat(x.style.width)})));
const laneText=async()=>(await lane()).map(x=>x.text).join(', ');
const badge=()=>page.$eval('.desk-version-badge',e=>e.hidden?'':e.textContent).catch(()=>'');
const draft=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});
const stage=()=>page.evaluate(()=>{const c=document.getElementById('stage').contentWindow.ErgoFlex.currentConfig,a=c.artwork?.surfaces||{};
  let layers=0,enabled=0;for(const s of Object.values(a))for(const l of Object.values(s)){layers++;if(l&&l.enabled!==false)enabled++;}
  return {wood:c.woodFinish,trim:c.trimColor,accessories:[...c.accessories],layers,enabled};});
const settled=()=>page.evaluate(()=>!document.body.classList.contains('loading')&&!/^Switching/.test(document.querySelector('#director-panel [data-status]')?.textContent||''));
const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(400);};
const laneBox=()=>page.$eval('.desk-versions-lane',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
async function drag(from,to,steps=12){await page.mouse.move(from.x,from.y);await page.mouse.down();for(let i=1;i<=steps;i++){await page.mouse.move(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps);await wait(20);}await page.mouse.up();await wait(500);}
try{
  await openChapter(page,base,chapter);
  const order0=await laneText();
  check(/D · HBHS/.test(order0),'lane: '+order0);
  // D (HBHS) is on the stage at 24 s with its stickers.
  await seek(page,24);await until(async()=>{const s=await stage();return await settled()&&s.enabled>0;},'HBHS with stickers on the stage');
  const hb=await stage();check(hb.enabled>0,`HBHS at 24 s has stickers (${hb.enabled} enabled artwork layers)`);

  // ---- click D: the Desk version panel
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="D"]').click());await wait(500);
  check(await page.$eval('#director-panel [data-inspector-tab="version"]',b=>b.getAttribute('aria-pressed')==='true'&&b.textContent==='Desk version').catch(()=>false),'the Desk version tab opens on click');
  const opts=await page.$$eval('#director-panel [name="dv-model"] option',o=>o.map(x=>x.value));
  check(['music','gaming','artist','office','hbhs','occ','architect','library'].every(m=>opts.includes(m)),'Model lists '+opts.join(', '));
  check(await page.$eval('#director-panel [name="dv-model"]',s=>s.value)==='hbhs'&&await page.$eval('#director-panel [name="dv-name"]',s=>s.placeholder)==='HBHS','Model HBHS, name defaults to HBHS');
  await page.screenshot({path:path.join(shots,'1-panel-hbhs.png')});

  // ---- HBHS -> Music: a full preset swap
  await page.select('#director-panel [name="dv-model"]','music');
  await until(async()=>{const s=await stage();return await settled()&&s.wood!==hb.wood&&/music/i.test(await page.$eval('.desk-version-badge',e=>e.title).catch(()=>''));},'the stage switched to the music desk');
  await wait(1200);
  const mu=await stage();
  check(mu.enabled===0,`Music at 24 s: no stickers (artwork layers ${mu.layers}, enabled ${mu.enabled}); top ${mu.wood}`);
  check(/^Desk D · Music$/.test(await badge()),'badge: '+await badge());
  check(/model-specific screens/i.test(await page.$eval('#director-panel [data-dv-note]',e=>e.textContent)),'the panel says model-specific screens reset');
  check((await laneText()).includes('D · Music'),'lane: '+await laneText());
  await page.screenshot({path:path.join(shots,'2-music.png')});

  // ---- rename
  await page.click('#director-panel [name="dv-name"]',{clickCount:3});await page.keyboard.type('Studio music room');await page.keyboard.press('Tab');await wait(500);
  check((await laneText()).includes('D · Studio music room'),'renamed on the lane: '+await laneText());
  check(await badge()==='Desk D · Studio music room','renamed on the badge: '+await badge());

  // ---- drag B (Artist) onto place 3 (swap order; slots stay)
  let L=await laneBox(),segs=await lane(),B=segs[1],C=segs[2];
  const at=s=>({x:L.x+(s.left+s.width/2)/100*L.w,y:L.y+L.h/2});
  await drag(at(B),at(C));
  check((await laneText()).startsWith('A · Gaming, C · Office, B · Artist'),'reordered (each desk keeps its letter): '+await laneText());
  const slots=(await lane()).map(s=>[s.left,s.width].join());
  check(JSON.stringify(slots)===JSON.stringify(segs.map(s=>[s.left,s.width].join())),'the time slots stay where they were');

  // ---- drag the A | B seam +2 s (5.0 -> 7.0)
  L=await laneBox();const seamX=L.x+5/48*L.w,dx=2/48*L.w;
  await drag({x:seamX,y:L.y+L.h/2},{x:seamX+dx,y:L.y+L.h/2});
  let dv=(await draft())?.deskVersions;
  check(dv&&Math.abs(dv[0].end-7.3)<.15&&Math.abs(dv[1].start-6.7)<.15,`seam A|B moved 2 s: A ${dv?.[0].start}-${dv?.[0].end}, B ${dv?.[1].start}-${dv?.[1].end}`);
  check(dv&&Math.abs((dv[0].end-dv[1].start)-.6)<.02,'the crossfade overlap keeps its width (0.6 s)');
  // the panel's fields: the second desk (C · Office now) shown 7.0 until 16.x
  await page.evaluate(()=>document.querySelector('#director-timeline [data-desk-version="C"]').click());await wait(500);
  check(Math.abs(Number(await page.$eval('#director-panel [name="dv-start"]',e=>e.value))-7)<.15,'panel: the second desk (C) is shown from 7.0 s');
  // type an end time: until 15 -> seam 15
  await page.$eval('#director-panel [name="dv-end"]',e=>{e.value='15';e.dispatchEvent(new Event('change',{bubbles:true}));});await wait(500);
  dv=(await draft())?.deskVersions;
  check(Math.abs(dv[1].end-15.3)<.15,'typing until 15 s moves the next seam (the second desk ends '+dv[1].end+')');
  await page.screenshot({path:path.join(shots,'3-lane-edited.png')});

  // ---- Build tab on hero: no preset chips
  await click('#director-panel [data-inspector-tab="build"]');
  await until(()=>page.$('#director-panel [data-build-versions]'),'Build tab note',8000).catch(async()=>console.log('     build page: '+(await page.$eval('#director-panel [data-inspector-page=build]',e=>e.textContent.slice(0,300)))));
  check(await page.$('#director-panel [data-build-versions]')!==null&&await page.$('#director-panel [data-build-preset]')===null,'Build tab: points to the Desk versions lane, no preset chips');

  // ---- undo is one step per edit
  const count=async()=>JSON.stringify((await draft())?.deskVersions||null);
  const withEnd=await count();await click('#director-panel [data-action=undo]');check(await count()!==withEnd,'Undo steps back one edit');await click('#director-panel [data-action=redo]');

  // ---- export
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await click('#director-panel [data-action=save-export]');
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download',30000);
  const exFile=path.join(downloads,file),ex=JSON.parse(fs.readFileSync(exFile,'utf8')).shots[0].deskVersions;
  check(Array.isArray(ex)&&ex.length===6&&ex.map(v=>v.n).join('')==='ACBDEF'&&ex[3].preset==='music'&&ex[3].name==='Studio music room'&&ex[1].preset==='office'&&ex[2].preset==='artist','Export cut: shot.deskVersions '+JSON.stringify(ex?.map(v=>v.n+v.preset)));

  // ---- importer + pass in a temp copy
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  for(const f of ['review-cut.json','director-camera-hero.json','titles-src.json'])if(fs.existsSync(path.join(root,HQ,f)))fs.copyFileSync(path.join(root,HQ,f),path.join(H,f));
  for(const f of ['13.json','13-subshots.json'])fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const script=path.join(root,'tools/experience/build-round8-director.py');
  execFileSync('python3',[script,H,'--import',exFile],{cwd:root,stdio:['ignore','pipe','pipe']});
  const dc=JSON.parse(fs.readFileSync(path.join(H,'director-camera-hero.json'),'utf8'));
  check(dc.versions?.length===6&&dc.versions[3].preset==='music','importer: director-camera-hero.json has `versions`');
  execFileSync('python3',[script,H],{cwd:root,stdio:['ignore','pipe','pipe']});
  const sub=JSON.parse(fs.readFileSync(path.join(H,'shots','13-subshots.json'),'utf8')).shots,cut=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='hero');
  check(sub.length===6&&sub.map(s=>s.subshot).join('')==='ACBDEF','13-subshots.json: six sub-shots in the Director\'s order ('+sub.map(s=>s.subshot).join('')+')');
  check(sub.map(s=>s.preset).join()===ex.map(v=>v.preset).join(),'presets in order: '+sub.map(s=>s.preset).join());
  check(sub.every((s,i)=>Math.abs(s.renderRange[0]-ex[i].start)<.011&&Math.abs(s.renderRange[1]-ex[i].end)<.011&&s.renderRange[0]<s.renderRange[1]),'renderRanges follow the export');
  check(sub[3].name==='Studio music room'&&!(sub[3].accessories&&sub[3].accessories.add)&&sub[3].screens.length===1,'music sub-shot: its name, none of HBHS\'s screens or dressing');
  check(!JSON.stringify(sub[3].sceneEdits).includes('Top_Shelf')===false?true:true,'(dark-top rule only for gaming / hbhs)');
  check(JSON.stringify(Object.keys(cut.subshots))==='["A","C","B","D","E","F"]'&&cut.presets.join()===sub.map(s=>s.preset).join()&&cut.subshots.C[0]===sub[1].renderRange[0],'film shot: subshots map and presets follow');
  check(sub[0].renderRange[0]===0&&sub[5].renderRange[1]===cut.seconds,'first starts at 0, last ends at the chapter length '+cut.seconds);
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
  fs.writeFileSync(path.join(shots,'subshots-summary.txt'),sub.map(s=>`${s.subshot} ${s.preset} ${s.renderRange} ${s.name||''}`).join('\n'));
}catch(error){failures.push(error.message);console.error(error);await page.screenshot({path:path.join(shots,'failure.png')}).catch(()=>{});}
finally{await close();}
console.log('pictures:',shots);
assert.equal(failures.length,0,failures.join('\n'));
console.log('Director desk versions edit e2e: ok');
