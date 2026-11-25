// Director Tray mode end to end (real Chrome): the tray MOVES. Regression for 24 Nov 2026 ("the tray would not move at all"): the rig
// install called api.loadProp, which window.ErgoFlex does not have, so the jointed tray never loaded although the panel said "slide 40 %".
// Types Slide / Tilt / Swing in the Tray tab of chapter 1 and checks the rig's pivots move on the live stage, and that a limit is SAID.
// Run: CHROME=<chrome.exe> HQ=exports/<a cut with director-chapters.json> node tests/director-tray-e2e.mjs   (a chapter whose desk has the tray: awaken)
import assert from 'node:assert/strict';
import {openDirectorBrowser,openChapter,chapterList,wait,status} from './director-e2e-harness.mjs';
const {base,page,errors,close}=await openDirectorBrowser();
const set=async(name,v)=>{await page.evaluate((n,v)=>{const el=document.querySelector(`[name="${n}"]`);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));},name,v);await wait(1500);};
const pivots=()=>page.evaluate(()=>{const it=document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks.active.objects.get('accessory-keyboard-tray'),o={};it.obj.traverse(n=>{if(/^Tray_(Slide|Swing|Tilt)$/.test(n.name))o[n.name]=[...n.position.toArray(),...n.quaternion.toArray()];});return o;});
try{
  await openChapter(page,base,chapterList().find(c=>c.id==='awaken'));
  await page.evaluate(()=>document.querySelector('[data-inspector-tab="tray"]')?.click());await wait(400);
  await page.evaluate(()=>document.querySelector('[data-action="tr-enter"]')?.click());await wait(600);
  await set('tr-slide-n',1);const a=await pivots();assert.ok(a.Tray_Slide,'the jointed tray is loaded (Tray_Slide exists): '+await status(page)+' '+errors.join('|'));
  await set('tr-slide-n',40);const b=await pivots();assert.notDeepEqual(b.Tray_Slide,a.Tray_Slide,'slide moves the carriage');
  await set('tr-tilt-n',10);const c=await pivots();assert.notDeepEqual(c.Tray_Tilt,b.Tray_Tilt,'tilt turns the plate');
  await set('tr-swing-n',15);const d=await pivots();assert.notDeepEqual(d.Tray_Swing,c.Tray_Swing,'swing turns the plate');
  await set('tr-slide-n',90);
  const msg=await page.evaluate(()=>document.querySelector('[data-tray-joint="slide"]')?.innerText||'');
  assert.match(msg,/keyed 90 %/);assert.match(msg,/does not fit under the desk|held to/,'a limit is said in words: '+msg);
  console.log('PASS Director Tray: slide, tilt and swing move the jointed tray on the live stage; a limit is named under the slider.');
}catch(e){console.error('FAIL',e.message);process.exitCode=1;}finally{await close();}
