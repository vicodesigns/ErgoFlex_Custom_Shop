// The Lighting tab's Screen light controls in a real Chrome (21 Nov 2026, Vico on the media chapters: "the colors on the
// reflections are a bit bright and washed out"; docs/screen-reflection/CONTRACT.md). Self-contained: any studio state,
// no earlier test. On Vico's 3rd cut:
//   1  ch 10 media: Lighting > Room has "Screen light on the room", opened at the chapter's own values (60 %, 140 %,
//      Keep colours on) and says they are the chapter's                                  (screenshot 1-panel)
//   2  Render still at 15 s at those values (A), at Brightness 25 % (B), and (undo, back to 60 %) at Saturation 0 % (C):
//      the lower frame darker in B; where the screen light falls (the pixels A and B differ on) greyer in C than in A
//      (stills A / B / C saved)
//   3  one undo step per change; "100 % (as before)" writes {} and shows 100 %; "↺ Chapter's values" brings 60 / 140 back
//   4  Export cut: the chapter's shot carries sceneGlobals.screenLight as set (only values that differ from 100 %)
//   5  a chapter without ledMode 'media' (rise) has no Screen light controls
//   CHROME=... [STATE_FROM=...] node tests/screen-light-e2e.mjs [shots dir]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root,status} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-vicos-3rd-cut';
const shots=process.argv[2]||path.join(os.tmpdir(),'screen-light-shots');fs.mkdirSync(shots,{recursive:true});
const chapters=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters,chapter=id=>chapters.find(x=>x.id===id);
const film=JSON.parse(fs.readFileSync(path.join(root,CUT,'review-cut.json'),'utf8')).shots.find(s=>s.id==='media');
assert.ok(chapter('media')&&film?.ledMode==='media','the 3rd cut has ch 10 media with ledMode media');
// The chapter's own values: on the desk the 3rd cut carries ch 10's (60 % / 140 % / keep colours); a checkout of main may
// carry none (100 %). The test expects whatever this checkout's film shot has.
const {lightFor,cleanScreenLight,isToday}=await import('../experience/screen-light.mjs');
const own=film.sceneGlobals?.screenLight,CH=lightFor(own),FROM=isToday(own)?'today':'film',P=v=>Math.round(v*100);
const chapterPanel={from:FROM,gain:P(CH.gain),saturation:P(CH.saturation),contrast:P(CH.contrast),tint:CH.tint,keepHue:CH.keepHue};
console.log('the chapter\'s screen light in this checkout:',JSON.stringify(own??null));
const {base,page,errors,close}=await openDirectorBrowser();
const log=(...a)=>console.log(...a);
const until=async(fn,what,ms=60000)=>{const end=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await status(page));await wait(250);}};
const shoot=async name=>{await wait(300);const f=path.join(shots,name);await page.screenshot({path:f});log('screenshot',f);};
const change=async(name,value)=>{await page.evaluate((n,v)=>{const e=document.querySelector(`#director-panel [name="${n}"]`);if(!e)throw Error('no field '+n);if(e.type==='checkbox')e.checked=!!v;else e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},name,value);await wait(700);};
const act=async name=>{await page.$eval(`#director-panel [data-action="${name}"]`,e=>e.click());await wait(700);};
const panelState=()=>page.evaluate(()=>{const b=document.querySelector('#director-panel [data-screen-light]');if(!b)return null;const v=n=>b.querySelector(`[name="${n}"]`);
  return {from:b.dataset.from,gain:Number(v('scln-gain').value),saturation:Number(v('scln-saturation').value),contrast:Number(v('scln-contrast').value),tint:v('scl-tint').value,keepHue:v('scl-keepHue').checked};});
const openRoom=async()=>{await page.$eval('[data-inspector-tab="lighting"]',e=>e.click());await wait(600);await page.evaluate(()=>{const d=document.querySelector('#director-panel [data-light-section="room"]');if(d)d.open=true;});await wait(300);
  await page.evaluate(()=>document.querySelector('#director-panel [data-screen-light]')?.scrollIntoView({block:'center'}));};
const key=async combo=>{const [m,k]=combo.split('+');await page.$eval('#director-timeline .timeline-viewport',e=>e.focus());await page.keyboard.down(m);await page.keyboard.press(k);await page.keyboard.up(m);await wait(800);};
// Render still (Shift+R) -> its image; the mean of the frame's lower part (the desk, its floor and the wall glow below the
// screens) as [luma, chroma] (0..255), measured in the page from the still's own pixels.
async function still(name){
  await page.keyboard.down('Shift');await page.keyboard.press('KeyR');await page.keyboard.up('Shift');
  await until(async()=>/Still rendered/.test(await status(page)),'Render still',300000);
  const url=await page.evaluate(()=>document.querySelector('#film-still img.still-main')?.src||null);assert.ok(url,'the still image');
  if(url.startsWith('data:'))fs.writeFileSync(path.join(shots,name),Buffer.from(url.split(',')[1],'base64'));
  const m=await page.evaluate(async u=>{const img=new Image();img.src=u;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);
    const y0=Math.round(c.height*.55),d=g.getImageData(0,y0,c.width,c.height-y0).data;let L=0,C=0,n=0;for(let i=0;i<d.length;i+=16){const r=d[i],gg=d[i+1],b=d[i+2];L+=.2126*r+.7152*gg+.0722*b;C+=Math.max(r,gg,b)-Math.min(r,gg,b);n++;}return {luma:L/n,chroma:C/n};},url);
  await page.keyboard.press('Escape');await wait(500);
  log('still',name,JSON.stringify({luma:+m.luma.toFixed(2),chroma:+m.chroma.toFixed(2)}));return {...m,url};
}
// Where the screen light reaches (21 Nov 2026: Windows measured the whole lower frame at 8 s, where the rug, the wheelchair
// and the walls dominate, and saturation 0 moved its chroma 33.2 -> 33.5): the pixels that change between the chapter's
// light (A) and a much dimmer one (B), over the whole frame; their mean chroma in A and in C (saturation 0).
const lit=(a,b,c)=>page.evaluate(async(a,b,c)=>{
  const px=async u=>{const img=new Image();img.src=u;await img.decode();const k=document.createElement('canvas');k.width=img.naturalWidth;k.height=img.naturalHeight;const g=k.getContext('2d');g.drawImage(img,0,0);return g.getImageData(0,0,k.width,k.height).data;};
  const A=await px(a),B=await px(b),C=await px(c),Y=(d,i)=>.2126*d[i]+.7152*d[i+1]+.0722*d[i+2],ch=(d,i)=>Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2]);
  let n=0,all=0,ca=0,cc=0,dy=0;for(let i=0;i<A.length;i+=8){all++;const d=Y(A,i)-Y(B,i);if(d>6){n++;dy+=d;ca+=ch(A,i);cc+=ch(C,i);}}
  return {share:n/all,chromaA:n?ca/n:0,chromaC:n?cc/n:0,dimmed:n?dy/n:0};},a.url,b.url,c.url);
const exportCut=()=>page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-appbar [data-action="save-export"]').click();}));
try{
  // ---- 1 ch 10 media: the controls at the chapter's values
  await openChapter(page,base,chapter('media'));await seek(page,15);await openRoom();   // (15 s: the desktop strongly lit by the movie)
  const p0=await until(panelState,'the Screen light controls in Lighting > Room');
  assert.deepEqual(p0,chapterPanel,'opened at the chapter\'s values');
  assert.ok(await page.$eval('#director-panel [data-light-section="room"]',e=>{const t=e.textContent,i=t.indexOf('LED glow on the floor'),j=t.indexOf('Screen light on the room');return i>=0&&j>i;}),'after the LED glow rows');
  assert.ok(await page.$eval('#director-panel [data-lighting-now]',e=>/Screen light/.test(e.textContent)),'Lighting now has the row');
  await shoot('screen-light-1-panel.png');
  log('1 ok: Lighting > Room > Screen light at the chapter\'s values',JSON.stringify(p0));
  // ---- 2 Render still follows the values
  const A=await still('screen-light-A-chapter.jpg');
  await change('scln-gain',25);
  assert.deepEqual(await panelState(),{...chapterPanel,from:'director',gain:25},'Brightness 25 %, edited here');
  assert.match(await status(page),/Screen light: 25 %/);
  const B=await still('screen-light-B-brightness25.jpg');
  await key('Control+z');assert.equal((await panelState()).gain,chapterPanel.gain,'undo: brightness back to the chapter\'s');
  await change('scln-saturation',0);assert.equal((await panelState()).saturation,0);const C=await still('screen-light-C-saturation0.jpg');
  assert.ok(B.luma<A.luma-1,`Brightness 25 %: the lower frame darker in Render still (${A.luma.toFixed(1)} -> ${B.luma.toFixed(1)})`);
  const m=await lit(A,B,C);log('lit by the screen',JSON.stringify(Object.fromEntries(Object.entries(m).map(([k,v])=>[k,+v.toFixed(3)]))));
  assert.ok(m.share>.01,`the screen light reaches part of the frame (${(m.share*100).toFixed(1)} % of the pixels dim at 25 %)`);
  assert.ok(m.chromaC<m.chromaA*.85,`Saturation 0 %: where the screen light falls it is greyer (chroma ${m.chromaA.toFixed(1)} -> ${m.chromaC.toFixed(1)})`);
  await shoot('screen-light-2-edited.png');
  log('2 ok: Render still shows the Director\'s screen light');
  // ---- 3 undo, 100 %, the chapter's values
  await key('Control+z');{const p=await panelState();assert.deepEqual(p,chapterPanel,'undo: one step back (saturation): the chapter\'s values, nothing of ours left');}
  if(FROM==='film'){
    await act('screen-light-reset');assert.deepEqual(await panelState(),{from:'director',gain:100,saturation:100,contrast:100,tint:'#ffffff',keepHue:false},'100 % (as before)');
    assert.ok(await page.$eval('#director-panel [data-action="screen-light-reset"]',e=>e.disabled),'at 100 % already');
    await act('screen-light-film');assert.deepEqual(await panelState(),chapterPanel,'the chapter\'s values again');
  }else{   // (the chapter is at 100 % already: 100 % is greyed out, there are no chapter values to go back to)
    assert.ok(await page.$eval('#director-panel [data-action="screen-light-reset"]',e=>e.disabled),'at 100 % already');
    assert.equal(await page.$('#director-panel [data-action="screen-light-film"]'),null,'no chapter values: no button for them');
  }
  log('3 ok: undo, 100 %, chapter\'s values');
  // ---- 4 Export cut
  await change('scln-gain',45);if(CH.keepHue)await change('scl-keepHue',false);
  const exp=JSON.parse(await exportCut()),sh=(exp.shots||[]).find(s=>s.id==='media')||exp.shots?.[0];
  assert.deepEqual(sh?.sceneGlobals?.screenLight,cleanScreenLight({...CH,gain:.45,keepHue:false}),'exported: only what differs from 100 %');
  log('4 ok: Export cut carries sceneGlobals.screenLight',JSON.stringify(sh.sceneGlobals.screenLight));
  // ---- 5 a chapter without the screen light
  await openChapter(page,base,chapter('rise'));await openRoom();
  assert.equal(await page.$('#director-panel [data-screen-light]'),null,'rise (not ledMode media): no Screen light controls');
  assert.deepEqual(errors,[],'page errors');
  log(`PASS screen-light-e2e (stills and screenshots in ${shots})`);
}catch(error){
  await page.screenshot({path:path.join(shots,'screen-light-fail.png')}).catch(()=>{});console.log('status:',await status(page));throw error;
}finally{await close();}
