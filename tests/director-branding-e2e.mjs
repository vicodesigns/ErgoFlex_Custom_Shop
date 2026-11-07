// Director Branding (Branding tab, experience/branding-editor.mjs) end to end (real GPU Chrome; not one of the quick
// tests/cinematic-* checks). Chapter 6 (oilers, the high school): the tab lists the desk's school graphics; moving the
// Oilers lettering on ONE desk (inches) moves it on EVERY desk of the room, hiding it hides it everywhere, moving it
// to another surface works, one edit is one undo step; Export cut carries shot.brandingEdits; build-round8-director
// --import + the pass (in a temp copy of the hq dir) write shot.sceneBranding into review-cut.json and the chapter's
// shot file; a reload of the Director keeps the edit and the desks follow it again; Studio's own records are untouched.
//
//   node tests/director-branding-e2e.mjs        (BASE=http://127.0.0.1:3124 to use a running server)
// SHOTS=<dir> keeps the screenshots there. Downloads go to a temp folder (never ~/Downloads).
// Run it under the browser-test slot gate (scratchpad slot.sh) or flock /tmp/claude-1000/hq12-stills.lock.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,HQ,chapterList,wait,openDirectorBrowser,openChapter,status as statusOf} from './director-e2e-harness.mjs';

const chapter=chapterList()?.find(c=>c.id==='oilers');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director branding e2e: skipped (${HQ} has no oilers chapter page in this checkout).`);process.exit(0);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-branding-e2e-')),downloads=path.join(tmp,'downloads'),shots=process.env.SHOTS||path.join(tmp,'shots');
fs.mkdirSync(downloads);fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const near=(a,b,eps=.06)=>Math.abs(a-b)<=eps;
try{
  const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await openChapter(page,base,chapter);
  const status=()=>statusOf(page);
  const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(150);}};
  const draftShot=()=>page.evaluate(()=>{try{const v=JSON.parse(localStorage.getItem('ergoflex.clientCuts.v1'));return (v.drafts[v.active]||v.cuts.find(c=>c.id===v.active)).shots[0];}catch{return null;}});
  const click=async sel=>{await page.evaluate(s=>document.querySelector(s).click(),sel);await wait(500);};
  // Every room desk's logo on a surface: the record state's artwork (what Studio's rigs draw), per desk.
  const desks=()=>page.evaluate(()=>{const sd=document.getElementById('stage').contentWindow.ErgoFlex.sceneDesks;
    return [...sd.records.values()].map(r=>({id:r.id,selected:sd.selected===r.id,size:r.state.size,art:Object.fromEntries(Object.entries(r.state.artwork?.surfaces||{}).map(([s,ly])=>[s,Object.fromEntries(Object.entries(ly).map(([k,l])=>[k,{name:l.name,x:l.x,y:l.y,scale:l.scale,rotation:l.rotation,enabled:l.enabled}]))])),
      meshes:r.rig?.group?[...(()=>{const a=[];r.rig.group.traverse(o=>{if(/^Artwork /.test(o.name||''))a.push(o.name);});return a;})()]:null}));});
  const layer=(d,surface,key)=>d.art[surface]?.[key];
  const setField=async(name,v)=>{await page.evaluate((n,val)=>{const el=document.querySelector(`#director-panel [name="${n}"]`);el.value=String(val);el.dispatchEvent(new Event('change',{bubbles:true}));},name,v);await wait(1500);};

  const before=await desks();
  const branded=before.filter(d=>Object.keys(d.art).length);
  check(before.length>=6&&branded.length>=4,`the high school room has ${before.length} desks, ${branded.length} carry school graphics`);
  const own0=layer(branded[0],'desktop','logo');

  // ---- the tab
  const tabs=await page.$$eval('#director-panel [data-inspector-tab]',b=>b.map(x=>x.dataset.inspectorTab));
  check(tabs.includes('branding'),'Branding tab shown in a school room: '+tabs.join(' · '));
  await click('#director-panel [data-inspector-tab=branding]');
  await until(()=>page.$('#director-panel [data-scene-branding] .lamp-chip'),'element chips');
  const chips=await page.$$eval('#director-panel [data-scene-branding] .lamp-chip',b=>b.map(x=>x.textContent.trim().replace(/\s+/g,' ')));
  check(chips.length===4&&chips.some(c=>/Oilers/.test(c)&&/Desktop/.test(c)),'lists the desk\'s four graphics: '+chips.join(' | '));
  await until(()=>page.$eval('#director-panel [name="br-across"]',e=>!e.disabled).catch(()=>false),'surface measured');
  const dims=await page.$eval('#director-panel [data-scene-branding] .director-hint:nth-of-type(2)',e=>e.textContent).catch(()=>'');
  const f0=await page.evaluate(()=>Object.fromEntries(['br-across','br-down','br-width','br-rot'].map(n=>[n,Number(document.querySelector(`#director-panel [name="${n}"]`).value)])));
  check(f0['br-across']>20&&f0['br-down']>f0['br-across']*.3&&f0['br-width']>10,`the Oilers lettering reads in inches: across ${f0['br-across']}, down ${f0['br-down']}, width ${f0['br-width']}, turn ${f0['br-rot']}°`);
  await page.screenshot({path:path.join(shots,'branding-tab.png')});
  await (await page.$('#director-panel [data-scene-branding]')).screenshot({path:path.join(shots,'branding-panel.png')}).catch(()=>{});

  // ---- one edit, every desk: across 12 in, down 8 in, a quarter turn
  await setField('br-across',12);
  let d=await draftShot();
  const b1=d?.brandingEdits?.artwork?.surfaces?.desktop?.logo;
  check(b1&&b1.name&&near(b1.x,12/f0['br-across']*own0.x,.8)&&d.brandingEdits.room==='highschool',`the draft holds brandingEdits for the room: ${JSON.stringify(d?.brandingEdits)}`);
  const mid=await desks();
  const after1=mid.filter(x=>layer(x,'desktop','logo'));
  check(after1.length===branded.length&&after1.every(x=>near(layer(x,'desktop','logo').x,b1.x,.01)&&near(layer(x,'desktop','logo').y,own0.y,.01)),`all ${after1.length} desks with the graphic moved it to x ${b1.x}% (including the featured one)`);
  check(mid.filter(x=>!Object.keys(x.art).length).length===before.length-branded.length,'desks without the graphic are left alone');
  await setField('br-down',8);await setField('br-rot',15);
  d=await draftShot();const b2=d.brandingEdits.artwork.surfaces.desktop.logo;
  check(near(b2.rotation,15,.01)&&b2.y<own0.y,`down + turn kept in the same edit: y ${b2.y}%, turn ${b2.rotation}°`);
  const after2=(await desks()).filter(x=>layer(x,'desktop','logo'));
  check(after2.every(x=>near(layer(x,'desktop','logo').rotation,15,.01)&&near(layer(x,'desktop','logo').y,b2.y,.01)),'every desk follows (turn, down)');
  // The other desks' real artwork meshes were redrawn (not only their records)
  const others=(await desks()).filter(x=>!x.selected&&layer(x,'desktop','logo'));
  check(others.length>=3&&others.every(x=>x.meshes?.some(n=>/desktop logo/.test(n))),`the ${others.length} other desks' rigs draw the lettering`);
  await page.screenshot({path:path.join(shots,'branding-moved.png')});

  // ---- hide, another surface, undo
  await click('#director-panel [name="br-show"]');
  d=await draftShot();check(d.brandingEdits.artwork.surfaces.desktop.logo.enabled===false,'Show unticked -> enabled:false in the draft');
  check((await desks()).filter(x=>layer(x,'desktop','logo')).every(x=>layer(x,'desktop','logo').enabled===false),'the lettering is hidden on every desk');
  await click('#director-panel [name="br-show"]');
  check((await desks()).filter(x=>layer(x,'desktop','logo')).every(x=>layer(x,'desktop','logo').enabled===true),'shown again on every desk');
  await setField('br-surface','upper-shelf');
  d=await draftShot();check(d.brandingEdits.artwork.surfaces.desktop.logo.surface==='upper-shelf','Surface -> Top shelf in the draft');
  const moved=await desks();
  check(moved.filter(x=>layer(x,'upper-shelf','logo')).length===branded.length&&moved.every(x=>!layer(x,'desktop','logo')),'the lettering is on the top shelf of every desk (off the desktop)');
  await page.screenshot({path:path.join(shots,'branding-shelf.png')});
  await click('#director-panel [data-action=undo]');await wait(1500);
  d=await draftShot();check(d.brandingEdits.artwork.surfaces.desktop.logo.surface===undefined&&(await desks()).every(x=>!layer(x,'upper-shelf','logo')),'Undo takes the surface move back (one step) on every desk');
  await setField('br-surface','desktop');   // a no-op change keeps the edit on the desktop

  const mine=(await draftShot()).brandingEdits;
  // ---- reload: the Director keeps it, the desks follow it again
  await openChapter(page,base,chapter);
  const mine0=(await draftShot()).brandingEdits;const re=await draftShot();check(JSON.stringify(re.brandingEdits)===JSON.stringify(mine0),'after a reload the draft still holds the edit');
  await until(async()=>{const x=(await desks()).filter(y=>layer(y,'desktop','logo'));return x.length&&x.every(y=>near(layer(y,'desktop','logo').rotation,15,.01));},'desks follow after reload').catch(async e=>{console.log('DEBUG',JSON.stringify({mine,desks:(await desks()).map(x=>[x.id,x.art.desktop?.logo])}));throw e;});
  check(true,'after the reload every desk of the room shows the edited lettering again');
  await click('#director-panel [data-inspector-tab=branding]');
  const after=await until(()=>page.$eval('#director-panel [name="br-rot"]',e=>Number(e.value)).catch(()=>null),'panel');
  check(after===15,'the Branding tab reads the edit back (turn 15°)');
  // ---- Export cut -> importer -> review-cut sceneBranding (temp copy of the chapter)
  await click('#director-panel [data-inspector-tab=chapter]');
  await page.evaluate(()=>document.querySelector('#director-panel [data-action=save-export]').click());
  const file=await until(()=>fs.readdirSync(downloads).find(f=>f.endsWith('.json')&&!f.endsWith('.crdownload')),'export download');
  const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8'));
  check(JSON.stringify(exported.shots[0].brandingEdits)===JSON.stringify(mine),'Export cut carries brandingEdits');
  const H=path.join(tmp,'hq');fs.mkdirSync(path.join(H,'shots'),{recursive:true});
  fs.copyFileSync(path.join(root,HQ,'review-cut.json'),path.join(H,'review-cut.json'));
  for(const f of fs.readdirSync(path.join(root,HQ,'shots')))if(/^\d\d\.json$/.test(f)&&JSON.parse(fs.readFileSync(path.join(root,HQ,'shots',f),'utf8')).id==='oilers')fs.copyFileSync(path.join(root,HQ,'shots',f),path.join(H,'shots',f));
  const ex=path.join(tmp,'Film-chapter-oilers-e2e.json');fs.copyFileSync(path.join(downloads,file),ex);
  const py=path.join(root,'tools/experience/build-round8-director.py');
  execFileSync('python3',[py,H,'--import',ex],{stdio:'ignore'});execFileSync('python3',[py,H],{stdio:'ignore'});
  const dc=JSON.parse(fs.readFileSync(path.join(H,'director-camera-oilers.json'),'utf8'));
  check(JSON.stringify(dc.branding)===JSON.stringify(mine),'the importer keeps it in director-camera-oilers.json as branding');
  const built=JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
  check(JSON.stringify(built.sceneBranding)===JSON.stringify(mine),'review-cut.json oilers shot has sceneBranding');
  const filmFile=fs.readdirSync(path.join(H,'shots')).map(f=>JSON.parse(fs.readFileSync(path.join(H,'shots',f),'utf8'))).find(s=>s.id==='oilers');
  check(!filmFile||JSON.stringify(filmFile.sceneBranding)===JSON.stringify(mine),'the chapter\'s shot file has sceneBranding too');
  // An export without the field keeps the earlier import's; an empty overlay clears it.
  const bare=JSON.parse(JSON.stringify(exported));delete bare.shots[0].brandingEdits;fs.writeFileSync(path.join(tmp,'Film-chapter-oilers-bare.json'),JSON.stringify(bare));
  execFileSync('python3',[py,H,'--import',path.join(tmp,'Film-chapter-oilers-bare.json')],{stdio:'ignore'});
  check(JSON.stringify(JSON.parse(fs.readFileSync(path.join(H,'director-camera-oilers.json'),'utf8')).branding)===JSON.stringify(mine),'an export without brandingEdits keeps the earlier import\'s');
  const clear=JSON.parse(JSON.stringify(exported));clear.shots[0].brandingEdits={room:'highschool',artwork:{version:1,surfaces:{}}};fs.writeFileSync(path.join(tmp,'Film-chapter-oilers-clear.json'),JSON.stringify(clear));
  execFileSync('python3',[py,H,'--import',path.join(tmp,'Film-chapter-oilers-clear.json')],{stdio:'ignore'});execFileSync('python3',[py,H],{stdio:'ignore'});
  check(JSON.parse(fs.readFileSync(path.join(H,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers').sceneBranding===undefined,'an empty overlay (Reset all) removes sceneBranding from the film');

  // ---- Reset all branding
  await click('#director-panel [data-inspector-tab=branding]');await click('#director-panel [data-action=br-reset-all]');await wait(1500);
  const reset=await desks();
  check(reset.filter(x=>layer(x,'desktop','logo')).every(x=>near(layer(x,'desktop','logo').x,own0.x,.01)&&near(layer(x,'desktop','logo').rotation,0,.01)),'Reset all branding puts every desk back as Studio has it');
  check(errors.length===0,'no page errors'+(errors.length?': '+errors.slice(0,3).join(' | '):''));
}catch(e){console.log('FAIL '+e.message);failures.push(e.message);}
finally{await close();}
console.log(failures.length?`\n${failures.length} failed`:'\nDirector branding e2e passed');
process.exit(failures.length?1:0);
