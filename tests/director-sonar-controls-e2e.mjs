// The Graphics tab's Sonar, end to end (19 Nov 2026; real GPU Chrome, the awareness chapter of the Cinematographer's cut).
// NOT YET RUN: written on the render PC while its GPU belonged to another session; the first run is the check.
//   1. a proximity chapter's Graphics tab has Sonar (on, size, rings per pulse, centre X / Z, Move centre on stage, Preview
//      at full, resets); nothing in the shot (no sonar key) until he touches it; screenshot of the panel
//   2. Preview at full: all the film's rings (3) are out at once, the echo marks the reach; screenshot
//   3. Rings per pulse 5 / 2: that many rings out at once, the stage follows with no reload
//   4. Size: the circle the rings run to is the size set (inches, via the desk's units), the film's reach when reset
//   5. Sonar on off: no rings at all; on again: back
//   6. Centre X / Z: the rings' centre moves by that many inches from where it was; the Move centre tool (a gizmo on the
//      floor) dragged moves it too and the fields follow; Reset puts it back on the desk's centre
//   7. Export cut carries shot.sonar (and only its data keys: the preview is never saved); the draft keeps it over a reload
//   8. Play ends the preview (the editor's only); a render never has it (the stage clears it with every chapter)
//   node tests/director-sonar-controls-e2e.mjs        (CUT=<cut dir>, default the Cinematographer's; SHOTS=<dir>)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {root,wait,openDirectorBrowser,openChapter,seek,status as statusOf,FILM_DRAFT_READER} from './director-e2e-harness.mjs';

const CUT=process.env.CUT||'exports/cinematic-intro-cut-cine';
const listFile=path.join(root,CUT,'director-chapters.json'),chapter=fs.existsSync(listFile)?JSON.parse(fs.readFileSync(listFile,'utf8')).chapters.find(c=>c.id==='awareness'):null;
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`sonar controls e2e: skipped (${CUT} has no awareness chapter page here).`);process.exit(0);}
const SHOTS=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'sonar-controls-'));fs.mkdirSync(SHOTS,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);return ok;};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what+' · status: '+await statusOf(page));await wait(200);}};
const click=sel=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw Error('no '+s);el.click();},sel);
const shot=name=>page.screenshot({path:path.join(SHOTS,name+'.png')}).catch(()=>{});
// the stage's sonar: what its API says, the ping rings (outer radius in inches, centre), the echo ring, the desk's units
const stage=()=>page.evaluate(()=>{
  const w=document.getElementById('stage').contentWindow,P=w.ErgoPresentation,t=P.three(),info=P.sonarInfo?.()||null,sp=P.sonarSpace?.()||null,u=sp?.u||1;
  const rings=[];let echo=null;t.scene.traverse(o=>{
    if(o.name!=='Stage sonar ping'&&o.name!=='Stage sonar echo')return;
    const p=o.geometry.attributes.position;let r=0;for(let i=0;i<p.count;i++)r=Math.max(r,Math.hypot(p.getX(i),p.getY(i)));
    const e={r:r/u,x:o.position.x,z:o.position.z,visible:o.visible,opacity:o.material.opacity};if(o.name==='Stage sonar echo')echo=e;else rings.push(e);});
  return {info,raw:sp?{x:sp.raw.x,z:sp.raw.z}:null,u,rings,echo,shown:rings.filter(r=>r.visible&&r.opacity>.05),total:rings.length};});
const fieldVal=n=>page.$eval(`#director-panel [data-sonar] [name="${n}"]`,e=>e.value);
const setField=(n,v)=>page.evaluate((n,v)=>{const el=document.querySelector(`#director-panel [data-sonar] [name="${n}"]`);if(!el)throw Error('no '+n);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},n,v);
const draft=()=>page.evaluate(`(()=>{try{const v=${FILM_DRAFT_READER};const c=v.drafts[v.active]||v.cuts.find(c=>c.id===v.active);return c.shots.find(s=>s.id==='awareness')||c.shots[0];}catch{return null;}})()`);
const near=(a,b,e)=>Math.abs(a-b)<=e;
try{
  await page.evaluateOnNewDocument(()=>{window.__exports=[];const make=URL.createObjectURL;URL.createObjectURL=function(b){if(b instanceof Blob&&b.type==='application/json')b.text().then(t=>window.__exports.push(t));return make.call(this,b);};});
  await openChapter(page,base,chapter);await seek(page,2);
  // ---- 1
  await click('#director-panel [data-inspector-tab="graphics"]');
  await until(()=>page.$('#director-panel [data-sonar]'),'the Sonar section');
  const names=await page.$$eval('#director-panel [data-sonar] .sonar-row label',l=>l.map(e=>e.textContent));
  check(JSON.stringify(names)===JSON.stringify(['Size','Rings','X','Z']),'1. the fields: '+names.join(', '));
  const buttons=await page.$$eval('#director-panel [data-sonar] [data-so-action]',l=>l.map(e=>e.dataset.soAction));
  check(['tool','preview','reset-size','reset-rings','reset-centre','reset'].every(a=>buttons.includes(a)),'1. the tools: '+buttons.join(', '));
  const s0=await until(async()=>{const s=await stage();return s.info?.found?s:null;},'the film\'s sonar (the obstacle\'s reach is known)');
  check(s0.info.rings===3&&s0.info.enabled&&!s0.info.cfg&&s0.total===7,`1. today's sonar: 3 rings, on, no sonar object, 7 ping meshes (reach ${s0.info.radius.toFixed(1)} in)`);
  check((await draft())?.sonar===undefined,'1. nothing in the shot until he touches it');
  check(await fieldVal('so-rings-n')==='3'&&near(Number(await fieldVal('so-radius-n')),s0.info.filmRadius,.06),'1. the fields show the film\'s own rings and reach');
  await page.$eval('#director-panel [data-sonar]',e=>e.scrollIntoView({block:'start'}));await shot('01-sonar-panel');
  // ---- 2
  await click('#director-panel [data-so-action="preview"]');
  const s2=await until(async()=>{const s=await stage();return s.info?.preview&&s.shown.length?s:null;},'Preview at full');
  check(s2.shown.length===3&&!!s2.echo?.visible,`2. Preview at full: ${s2.shown.length} rings out at once, the echo marks the reach (${s2.echo?.r.toFixed(1)} in)`);
  check((await draft())?.sonar===undefined,'2. the preview wrote nothing into the shot');
  await shot('02-preview-at-full');
  // ---- 3
  await setField('so-rings-n',5);
  const s3=await until(async()=>{const s=await stage();return s.shown.length===5?s:null;},'5 rings out at once');
  check(s3.info.rings===5&&s3.total>=12,`3. 5 rings per pulse: 5 out at once (${s3.total} ping meshes made)`);await shot('03-five-rings');
  await setField('so-rings-n',2);
  check(!!await until(async()=>(await stage()).shown.length===2,'2 rings out at once'),'3. 2 rings per pulse: 2 out at once');
  await setField('so-rings-n',3);
  check(!!await until(async()=>{const s=await stage();return s.shown.length===3&&!s.info.cfg?s:null;},'back to the film\'s 3'),'3. 3 is the film\'s: 3 out, no sonar object left');
  const d3=await draft();check(d3?.sonar===undefined,'3. and nothing kept in the shot (the key is absent again)');
  // ---- 4
  await setField('so-radius-n',60);
  const s4=await until(async()=>{const s=await stage();return s.echo?.visible&&near(s.echo.r,60,1.5)?s:null;},'the reach ring at 60 in');
  check(true,`4. Size 60 in: the circle the rings run to is ${s4.echo.r.toFixed(1)} in, the outermost ring ${Math.max(...s4.shown.map(r=>r.r)).toFixed(1)} in`);
  check(Math.max(...s4.shown.map(r=>r.r))<s4.echo.r,'4. the rings stay inside it');await shot('04-size-60');
  await page.select('#director-panel [data-sonar] [name="so-unit"]','cm');
  await until(async()=>near(Number(await fieldVal('so-radius-n')),152.4,.2),'centimetres');
  check(true,'4. centimetres: 60 in shows as '+await fieldVal('so-radius-n')+' cm');
  await page.select('#director-panel [data-sonar] [name="so-unit"]','in');
  await until(async()=>near(Number(await fieldVal('so-radius-n')),60,.06),'inches again');
  await click('#director-panel [data-so-action="reset-size"]');
  const s4r=await until(async()=>{const s=await stage();return s.echo?.visible&&near(s.echo.r,s0.info.filmRadius,1.5)?s:null;},'the film\'s reach again');
  check(!!s4r,'4. Film\'s size: the film\'s reach again ('+s4r.echo.r.toFixed(1)+' in)');
  // ---- 5
  await page.$eval('#director-panel [data-sonar] [name="so-enabled"]',e=>e.click());
  const s5=await until(async()=>{const s=await stage();return s.shown.length===0&&!s.echo?.visible?s:null;},'sonar off');
  check(s5.info.enabled===false,'5. Sonar off: no rings and no echo');await shot('05-off');
  check((await draft())?.sonar?.enabled===false,'5. the shot has sonar.enabled false');
  await page.$eval('#director-panel [data-sonar] [name="so-enabled"]',e=>e.click());
  check(!!await until(async()=>(await stage()).shown.length===3,'sonar on again'),'5. Sonar on: the three rings are back');
  // ---- 6
  const u=(await stage()).u;
  await setField('so-x-n',20);await setField('so-z-n',-10);
  const s6=await until(async()=>{const s=await stage();return s.info.cfg?.x===20&&s.info.cfg?.z===-10?s:null;},'the centre moved');
  const at=s6.rings[0],dx=(at.x-s6.raw.x)/u,dz=(at.z-s6.raw.z)/u;
  check(near(dx,20,.2)&&near(dz,-10,.2),`6. Centre X 20, Z -10: the rings' centre is ${dx.toFixed(1)}, ${dz.toFixed(1)} in from the desk's centre`);await shot('06-centre-moved');
  await click('#director-panel [data-so-action="tool"]');
  const tool=await until(()=>page.evaluate(()=>{const w=document.getElementById('stage').contentWindow,g=w.__directorSonarGizmo,h=g?.object;return h&&g.visible&&g.enabled?{x:h.position.x,z:h.position.z}:null;}),'the move tool on the floor');
  check(!!tool,'6. Move centre on stage: a gizmo handle on the floor at the sonar\'s centre');await shot('07-move-tool');
  // a drag of the handle = the handle moved and the gizmo's own objectChange (what a drag sends): 10 in to the right, 8 in toward the camera
  await page.evaluate(([dx,dz])=>{const w=document.getElementById('stage').contentWindow,g=w.__directorSonarGizmo,h=g.object;h.position.x+=dx;h.position.z+=dz;g.dispatchEvent({type:'objectChange'});},[10*u,8*u]);
  await until(async()=>{const s=await stage();return s.info.cfg&&near(s.info.cfg.x,30,.3)&&near(s.info.cfg.z,-2,.3)?s:null;},'the drag moved the sonar');
  check(near(Number(await fieldVal('so-x-n')),30,.3)&&near(Number(await fieldVal('so-z-n')),-2,.3),`6. dragged the handle: the fields follow (${await fieldVal('so-x-n')}, ${await fieldVal('so-z-n')}) and the stage with them`);
  await click('#director-panel [data-so-action="tool"]');
  await click('#director-panel [data-so-action="reset-centre"]');
  const s6c=await until(async()=>{const s=await stage();return !s.info.cfg?.x&&!s.info.cfg?.z?s:null;},'the desk\'s centre again');
  check(near((s6c.rings[0].x-s6c.raw.x)/u,0,.2)&&near((s6c.rings[0].z-s6c.raw.z)/u,0,.2),'6. Desk\'s centre: the rings are on the desk\'s centre again');
  // ---- 7
  await setField('so-radius-n',72);await setField('so-rings-n',4);await setField('so-x-n',-6);await wait(600);
  await click('#director-appbar [data-action="save-export"]');
  const sent=await until(()=>page.evaluate(()=>window.__exports.at(-1)||null),'the export',20000);
  const sonar=JSON.parse(sent).shots.find(s=>s.id==='awareness')?.sonar;
  check(!!sonar&&sonar.radius===72&&sonar.rings===4&&sonar.x===-6&&Object.keys(sonar).every(k=>['enabled','radius','rings','x','z'].includes(k)),'7. Export cut carries it: '+JSON.stringify(sonar));
  check(!/previewFull|"preview"/.test(sent),'7. and nothing of the preview');
  check(JSON.parse(sent).shots.filter(s=>s.id!=='awareness').every(s=>!('sonar' in s)),'7. the other chapters have no sonar key');
  const kept=await draft();check(JSON.stringify(kept?.sonar)===JSON.stringify(sonar),'7. the draft keeps it: '+JSON.stringify(kept?.sonar));
  await page.goto(base+chapter.page);
  await page.waitForFunction(()=>/Camera is live/.test(document.querySelector('#director-panel [data-status]')?.textContent||''),{timeout:300000});await wait(800);
  await click('#director-panel [data-inspector-tab="graphics"]');await until(()=>page.$('#director-panel [data-sonar]'),'the Sonar section after a reload');
  const s7=await until(async()=>{const s=await stage();return s.info?.found&&s.info.cfg?s:null;},'the stage after a reload');
  check(s7.info.cfg.radius===72&&s7.info.cfg.rings===4&&s7.info.cfg.x===-6&&!s7.info.preview,'7. a reload keeps it on the stage (and the preview is off)');
  check(await fieldVal('so-rings-n')==='4'&&await fieldVal('so-radius-n')==='72','7. and in the fields');
  // ---- 8
  await click('#director-panel [data-so-action="preview"]');await until(async()=>(await stage()).info?.preview,'preview on');
  await click('#director-panel [data-action="chapter-toggle"]');await wait(800);
  check(!(await stage()).info?.preview,'8. Play ends the preview (it is the editor\'s only)');
  check(!/previewFull/.test(JSON.stringify(await draft())),'8. and it is nowhere in the draft');
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
}catch(error){await page.screenshot({path:path.join(SHOTS,'99-failed.png')}).catch(()=>{});check(false,error.message);}
finally{await close();}
console.log(failures.length?`FAIL sonar controls e2e: ${failures.length} (shots in ${SHOTS})`:`PASS sonar controls e2e (shots in ${SHOTS})`);
process.exitCode=failures.length?1:0;
