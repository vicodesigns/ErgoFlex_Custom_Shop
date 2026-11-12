// Director, the finale: the Props lane draws the artist desk's easel and painter shelf only while the desk shows them
// (they go away once its tilt falls below 50 deg), and the stage agrees with the bar.
//   node tests/director-stow-window-e2e.mjs      (needs the film's screen videos under exports/**/screens)
import assert from 'node:assert/strict';
import {openDirectorBrowser,openChapter,chapterList,seek,wait,HQ} from './director-e2e-harness.mjs';
import {legacyMotionToClips,sampleClipMotion} from '../experience/desk-clips.mjs';
import fs from 'node:fs';
// Where the artist desk's tilt crosses 50 deg in this cut (HQ=exports/<cut> picks the cut; the default is hq14).
const hero=JSON.parse(fs.readFileSync(new URL('../'+HQ+'/review-cut.json',import.meta.url))).shots.find(s=>s.id==='hero'),motion=legacyMotionToClips(hero.motion,hero.seconds);
let cross=null;for(let t=0;t<=hero.seconds&&cross===null;t+=.01)if(sampleClipMotion(motion,t).tilt<50&&t>3)cross=t;
console.log('expected: the desk crosses 50 deg at '+cross.toFixed(2)+' s ('+HQ+')');
const {base,page,close}=await openDirectorBrowser(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('ok  '+what);};
await page.evaluateOnNewDocument(()=>{
  window.__t=()=>{const w=document.getElementById('stage').contentWindow;return {t:w.ErgoPresentation.three()};};
  window.__shownLike=re=>{let hit=null;__t().t.scene.traverse(o=>{if(!hit&&re.test(o.name||''))hit=o;});if(!hit)return null;for(let p=hit;p;p=p.parent)if(!p.visible)return false;return true;};
});
const bars=()=>page.$$eval('[data-props-lane] .prop-bar',l=>l.map(b=>({text:b.textContent,cls:b.className,left:parseFloat(b.style.left),width:parseFloat(b.style.width),title:b.title})));
const go=async(s,ms=2200)=>{await seek(page,s);await wait(ms);};
try{
  const ch=chapterList().find(c=>c.id==='hero');await openChapter(page,base,ch);
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(3000);
  const T=Number(await page.$eval('#director-timeline [name="timeline-seconds"]',e=>e.max));
  await go(6);await page.waitForFunction(()=>/Artist/.test(document.querySelector('.desk-version-badge')?.textContent||''),{timeout:30000});await wait(2000);
  const list=await bars(),end=b=>(b.left+b.width)/100*T,start=b=>b.left/100*T;
  const easel=list.find(b=>b.text==='Artist easel'&&start(b)>3&&start(b)<6),shelf=list.find(b=>b.text==='Painter shelf'&&start(b)>3&&start(b)<6),arm=list.find(b=>b.text==='Monitor arm'&&start(b)>3&&start(b)<6);
  check(easel&&Math.abs(end(easel)-cross)<.25,'Artist easel bar ends where the desk stows it ('+cross.toFixed(2)+' s): '+(easel&&end(easel).toFixed(2)));
  check(shelf&&Math.abs(end(shelf)-cross)<.25,'Painter shelf bar ends with it: '+(shelf&&end(shelf).toFixed(2)));
  check(arm&&end(arm)>12,'Monitor arm (fixed hardware) keeps the whole desk stretch: '+(arm&&end(arm).toFixed(2)));
  check(easel&&/puts it away/.test(easel.title),'the tooltip says why');
  await go(cross-.6);const before=await page.evaluate(()=>__shownLike(/artist-easel|Artist painting/i));
  await go(cross+.8);const after=await page.evaluate(()=>__shownLike(/artist-easel|Artist painting/i));
  check(before===true&&after===false,'the stage agrees: easel shown just before '+cross.toFixed(1)+' s ('+before+'), gone just after ('+after+')');
  check(!errors.length,'no page errors: '+errors.join(' | ').slice(0,300));
  console.log(`\nDirector stow-window e2e: ${passed.length} checks passed.`);
}finally{await close();}
