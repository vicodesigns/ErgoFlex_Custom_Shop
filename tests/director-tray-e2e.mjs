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
  assert.match(await status(page),/held at 45 %/,'the status line names the limit too: '+await status(page));
  // jog (the Key buttons and K) and the saved poses
  const seek=async t=>{await page.evaluate(t=>{const el=document.querySelector('#director-timeline [name="timeline-seconds"]');el.value=String(t);el.dispatchEvent(new Event('change',{bubbles:true}));},t);await wait(700);};
  const click=async sel=>{await page.evaluate(q=>document.querySelector(q)?.click(),sel);await wait(700);};
  const at=()=>page.evaluate(()=>Number(document.querySelector('[data-tray-at]')?.textContent));
  const keys=()=>page.evaluate(()=>document.querySelectorAll('[data-tray-key-row] [data-tray-key]').length);
  await click('[data-action="tr-reset"]');await click('[data-action="tr-auto"]');
  await seek(1);await set('tr-tilt-n',5);await seek(3);await set('tr-tilt-n',-5);await seek(0);
  assert.equal(await keys(),2);
  await click('[data-action="tr-key-next"]');assert.equal(await at(),1,'Key > jumps to the first key');
  await click('[data-action="tr-key-next"]');assert.equal(await at(),3,'Key > jumps to the next key');
  await click('[data-action="tr-key-prev"]');assert.equal(await at(),1,'< Key jumps back');
  await seek(2);await page.evaluate(()=>document.activeElement?.blur?.());await page.keyboard.press('k');await wait(700);
  assert.equal(await keys(),3,'K keys every joint at the playhead');
  await page.evaluate(()=>{const e=document.querySelector('[name="tr-pose-name"]');e.value='Typing';e.dispatchEvent(new Event('change',{bubbles:true}));});await click('[data-action="tr-save"]');
  assert.match(await page.evaluate(()=>document.querySelector('.tray-saved')?.innerText||''),/Typing/);
  await set('tr-tilt-n',9);await click('[data-action="tr-apply"]');
  const tilt=await page.evaluate(()=>document.querySelector('[name="tr-tilt-n"]').value);assert.equal(Number(tilt),0,'applying the saved pose sets its tilt back (the pose was keyed at tilt 0 ... K keyed the tray as it was at 2 s)');
  await click('[data-action="tr-forget"]');assert.equal(await page.evaluate(()=>document.querySelectorAll('.tray-saved li').length),0,'forgotten');
  console.log('PASS Director Tray: slide, tilt and swing move the jointed tray on the live stage; a limit is named under the slider.');
}catch(e){console.error('FAIL',e.message);process.exitCode=1;}finally{await close();}
