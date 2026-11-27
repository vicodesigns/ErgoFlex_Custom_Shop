// Hero lead-in verify branch: live view + badge + Render still at chapter seconds, with the visible desk objects of each stage.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [repo,out]=process.argv.slice(2);
const {chapterList,wait,openDirectorBrowser,openChapter,seek,status}=await import(pathToFileURL(path.join(repo,'tests/director-e2e-harness.mjs')));
const {base,page,errors,close}=await openDirectorBrowser();
const save=(name,url)=>{const m=url.match(/^data:image\/(\w+);base64,(.*)$/s);const f=path.join(out,name+'.'+(m[1]==='jpeg'?'jpg':m[1]));fs.writeFileSync(f,Buffer.from(m[2],'base64'));return path.basename(f);};
const badge=()=>page.$eval('.desk-version-badge',e=>e.hidden?'(hidden)':e.textContent).catch(()=>'(none)');
const settle=async()=>{await page.waitForFunction(()=>!document.body.classList.contains('loading')&&!/^Switching/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:120000,polling:100});await wait(2500);};
// Visible named desk objects (outermost match per branch) in one frame's scene.
const visible=which=>page.evaluate(which=>{
  const f=which==='live'?document.getElementById('stage'):document.querySelector('iframe[title="Film still renderer"]'),w=f?.contentWindow,t=w?.ErgoPresentation?.three?.();
  if(!t)return {why:'no scene'};
  const c=w.ErgoFlex.currentConfig,names={};
  const re=/^(Accessory|Accessory mount|Desk dressing|Prop|Desk prop|Screen)\b|keyboard|mouse|easel|monitor|laptop|tablet|phone|painter|drafting|lamp|mug|speaker|headphone|cable.tray/i;
  const walk=o=>{if(!o.visible||o.userData?.directorTools)return;
    if(re.test(o.name||'')){let meshes=0;const count=n=>{if(!n.visible)return;if(n.isMesh&&[].concat(n.material||[]).some(m=>m&&m.visible!==false&&!(m.transparent&&m.opacity<.01)))meshes++;n.children.forEach(count);};count(o);if(meshes){names[o.name]=(names[o.name]||0)+meshes;return;}}
    o.children.forEach(walk);};
  walk(t.scene);
  return {wood:c.woodFinish,trim:c.trimColor,accessories:[...c.accessories],visible:names};
},which);
try{
  await openChapter(page,base,chapterList().find(c=>c.id==='hero'));
  console.log('chapter seconds (timeline max):',await page.$eval('#director-timeline [name="timeline-seconds"]',e=>e.max));
  console.log('lane:',(await page.$$eval('#director-timeline [data-desk-version]',b=>b.map(x=>x.dataset.deskVersion+' '+x.querySelector('strong').textContent))).join(' | '));
  await seek(page,0.5);await settle();
  console.log('LIVE 0.5 badge:',await badge());
  for(const t of [0.4,1.35,1.5,1.65,2.2,20]){
    await seek(page,t);await settle();
    const live=await (await page.$('#stage')).screenshot();fs.writeFileSync(path.join(out,`live-${t}.png`),live);
    console.log(`\n== ${t} s  live badge: ${await badge()}`);
    console.log('live:',JSON.stringify(await visible('live')));
    await page.$eval('#director-panel [data-status]',e=>e.textContent='');
    await page.evaluate(()=>document.querySelector('.film-tools [data-action=render-still]').click());
    await page.waitForFunction(()=>/Still rendered|Render still failed/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});
    const s=await status(page);console.log('status:',s.slice(0,200));
    if(!/Still rendered/.test(s))continue;
    await wait(800);
    const url=await page.$eval('#film-still img',async i=>{if(i.src.startsWith('data:'))return i.src;const b=await (await fetch(i.src)).blob();return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b);});});
    console.log('saved',save(`still-${t}`,url));
    console.log('still renderer:',JSON.stringify(await visible('still')));
    await page.keyboard.press('Escape');await wait(500);
  }
  console.log('\npage errors:',errors.length?errors.join(' | '):'none');
}finally{await close();}
