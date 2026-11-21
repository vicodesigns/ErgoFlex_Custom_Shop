// The Lighting tab's Screen light controls in a real Chrome (21 Nov 2026, Vico on the media chapters: "the colors on the
// reflections are a bit bright and washed out"; docs/screen-reflection/CONTRACT.md). Self-contained: any studio state,
// no earlier test. On Vico's 3rd cut:
//   1  ch 10 media: Lighting > Room has "Screen light on the room", opened at the chapter's own values (60 %, 140 %,
//      Keep colours on) and says they are the chapter's                                  (screenshot 1-panel)
//   2  Render still at those values (A); Brightness 25 % (B) and Saturation 0 % (C): the stills' desk / floor part gets
//      darker (B) and greyer (C) than A: Render still shows the Director's values      (stills A / B / C saved)
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
assert.deepEqual(film.sceneGlobals?.screenLight,{gain:.6,saturation:1.4,keepHue:true},'(the chapter\'s data defaults, eng/screen-reflection)');
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
  log('still',name,JSON.stringify({luma:+m.luma.toFixed(2),chroma:+m.chroma.toFixed(2)}));return m;
}
const exportCut=()=>page.evaluate(()=>new Promise(r=>{const was=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){HTMLAnchorElement.prototype.click=was;fetch(this.href).then(x=>x.text()).then(r);};document.querySelector('#director-appbar [data-action="save-export"]').click();}));
try{
  // ---- 1 ch 10 media: the controls at the chapter's values
  await openChapter(page,base,chapter('media'));await seek(page,8);await openRoom();
  const p0=await until(panelState,'the Screen light controls in Lighting > Room');
  assert.deepEqual(p0,{from:'film',gain:60,saturation:140,contrast:100,tint:'#ffffff',keepHue:true},'opened at the chapter\'s values');
  assert.ok(await page.$eval('#director-panel [data-light-section="room"]',e=>{const t=e.textContent,i=t.indexOf('LED glow on the floor'),j=t.indexOf('Screen light on the room');return i>=0&&j>i;}),'after the LED glow rows');
  assert.ok(await page.$eval('#director-panel [data-lighting-now]',e=>/Screen light/.test(e.textContent)&&/60 %/.test(e.textContent)),'Lighting now has the row');
  await shoot('screen-light-1-panel.png');
  log('1 ok: Lighting > Room > Screen light at 60 % / 140 % / keep colours (the chapter\'s values)');
  // ---- 2 Render still follows the values
  const A=await still('screen-light-A-chapter.jpg');
  await change('scln-gain',25);
  assert.deepEqual(await panelState(),{from:'director',gain:25,saturation:140,contrast:100,tint:'#ffffff',keepHue:true},'Brightness 25 %, edited here');
  assert.match(await status(page),/Screen light: 25 %/);
  const B=await still('screen-light-B-brightness25.jpg');
  await change('scln-saturation',0);const C=await still('screen-light-C-saturation0.jpg');
  assert.ok(B.luma<A.luma-1,`Brightness 25 %: the lower frame darker in Render still (${A.luma.toFixed(1)} -> ${B.luma.toFixed(1)})`);
  assert.ok(C.chroma<B.chroma-.5,`Saturation 0 %: greyer (${B.chroma.toFixed(1)} -> ${C.chroma.toFixed(1)})`);
  await shoot('screen-light-2-edited.png');
  log('2 ok: Render still shows the Director\'s screen light');
  // ---- 3 undo, 100 %, the chapter's values
  await key('Control+z');assert.equal((await panelState()).saturation,140,'undo: one step back (saturation)');
  await key('Control+z');assert.equal((await panelState()).gain,60,'undo: brightness back to 60 %');
  await act('screen-light-reset');assert.deepEqual(await panelState(),{from:'director',gain:100,saturation:100,contrast:100,tint:'#ffffff',keepHue:false},'100 % (as before)');
  assert.ok(await page.$eval('#director-panel [data-action="screen-light-reset"]',e=>e.disabled),'at 100 % already');
  await act('screen-light-film');assert.equal((await panelState()).from,'film');assert.equal((await panelState()).gain,60,'the chapter\'s values again');
  log('3 ok: undo, 100 %, chapter\'s values');
  // ---- 4 Export cut
  await change('scln-gain',45);await change('scl-keepHue',false);
  const exp=JSON.parse(await exportCut()),sh=(exp.shots||[]).find(s=>s.id==='media')||exp.shots?.[0];
  assert.deepEqual(sh?.sceneGlobals?.screenLight,{gain:.45,saturation:1.4},'exported: only what differs from 100 %');
  log('4 ok: Export cut carries sceneGlobals.screenLight',JSON.stringify(sh.sceneGlobals.screenLight));
  // ---- 5 a chapter without the screen light
  await openChapter(page,base,chapter('rise'));await openRoom();
  assert.equal(await page.$('#director-panel [data-screen-light]'),null,'rise (not ledMode media): no Screen light controls');
  assert.deepEqual(errors,[],'page errors');
  log(`PASS screen-light-e2e (stills and screenshots in ${shots})`);
}catch(error){
  await page.screenshot({path:path.join(shots,'screen-light-fail.png')}).catch(()=>{});console.log('status:',await status(page));throw error;
}finally{await close();}
