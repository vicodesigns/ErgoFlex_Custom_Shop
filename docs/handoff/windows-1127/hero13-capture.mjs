// Live Director, hero chapter: the 3D view at the requested chapter seconds, then a labelled contact sheet.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [repo,out]=process.argv.slice(2);
const {chapterList,wait,openDirectorBrowser,openChapter,seek}=await import(pathToFileURL(path.join(repo,'tests/director-e2e-harness.mjs')));
const chapter=chapterList()?.find(c=>c.id==='hero');
if(!chapter)throw Error('no hero chapter in this cut');
const TIMES=[12.0,12.4,12.6,12.8,13.0,13.2,13.4,13.8];
const {base,browser,page,errors,close}=await openDirectorBrowser();
try{
  await openChapter(page,base,chapter);
  await seek(page,10.5);await wait(2500);
  const stage=await page.$('#stage'),shots=[];
  for(const t of TIMES){
    await seek(page,t);await wait(1500);
    const png=await stage.screenshot();
    fs.writeFileSync(path.join(out,`hero-live-${t.toFixed(1)}.png`),png);
    shots.push({t,src:'data:image/png;base64,'+png.toString('base64')});
    console.log('shot',t.toFixed(1));
  }
  const sheet=await browser.newPage();
  await sheet.setViewport({width:1600,height:900});
  await sheet.setContent(`<body style="margin:0;background:#111;font:20px sans-serif;color:#fff"><div style="padding:10px">Vicos 3rd cut, hero chapter: live Director view (b5c8581f), stills after seek + 1.5 s</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 8px 8px">${shots.map(s=>`<figure style="margin:0"><figcaption style="padding:4px 0">${s.t.toFixed(1)} s</figcaption><img style="width:100%;display:block" src="${s.src}"></figure>`).join('')}</div></body>`,{waitUntil:'load'});
  await sheet.screenshot({path:path.join(out,'hero-live-12.0-13.8-sheet.png'),fullPage:true});
  console.log('sheet done; page errors:',errors.length?errors.join(' | '):'none');
}finally{await close();}
