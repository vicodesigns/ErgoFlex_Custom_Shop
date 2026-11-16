// B2 (S33): ONE selection across the Director (real Chrome on the harness's own scratch server, Cinematographer's cut).
// On oilers and commons: select a prop on its Props bar, a person in the People tab and on the People sheet, a room desk
// in the Desks tab; each time the thing is marked b2-selected in every place it shows (Props lane / Layers, People lane
// / list / sheet row, Desks list / the desk lanes' header) and on screen in the timeline, and the previous one is not.
//   CHROME=".../chrome.exe" [SHOTS=<dir>] [ROOMS=oilers,commons] node tests/director-selection-e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {openDirectorBrowser,openChapter,seek,wait,root} from './director-e2e-harness.mjs';
const CUT='exports/cinematic-intro-cut-cine',ROOMS=(process.env.ROOMS||'oilers,commons').split(',');
const chapters=JSON.parse(fs.readFileSync(path.join(root,CUT,'director-chapters.json'),'utf8')).chapters;
const shots=process.env.SHOTS||null;
const {base,page,errors,close}=await openDirectorBrowser({width:1600,height:1000});
const passed=[],check=(ok,what)=>{assert.ok(ok,what);passed.push(what);console.log('  ok: '+what);};
const until=async(fn,what,ms=30000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw Error('timed out: '+what);await wait(200);}};
const snap=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png')});}};
const tab=async t=>{await page.evaluate(t=>document.querySelector(`#director-panel [data-inspector-tab="${t}"]`)?.click(),t);await wait(500);};
// every b2-selected element: where it is, and whether it is on screen inside the timeline's viewport / the panel
const marks=()=>page.evaluate(()=>[...document.querySelectorAll('.b2-selected')].map(e=>{const r=e.getBoundingClientRect(),inTl=!!e.closest('#director-timeline'),box=(inTl?document.querySelector('#director-timeline .timeline-viewport'):document.getElementById('director-panel')).getBoundingClientRect(),cy=r.top+r.height/2;
  return {where:inTl?'timeline':'panel',what:e.className.replace('b2-selected','').trim().split(/\s+/).slice(0,2).join(' '),key:e.dataset.propKey||e.dataset.lyItem||e.dataset.personKey||e.dataset.personKeys||e.dataset.section||e.dataset.choreoRow||e.dataset.deskOf||'',shown:r.height>0,onScreen:r.height>0&&cy>=box.top&&cy<=box.bottom,mid:r.height>0?Math.abs(cy-(box.top+box.height/2))/box.height:null};}));
try{
  for(const id of ROOMS){
    const ch=chapters.find(c=>c.id===id);console.log(`\n${id}: ${ch.page}`);
    await openChapter(page,base,ch);await seek(page,ch.seconds/2);await wait(600);
    // ---- a prop, from its bar on the timeline: the bar and its Layers row
    await until(()=>page.$('#director-timeline .prop-bar'),'a Props bar',40000);
    const bars=await page.$$eval('#director-timeline .prop-bar',l=>l.map(b=>b.dataset.propKey));
    const pk=bars.at(-1);   // the last one: the bottom of a scrolling lane
    await page.evaluate(k=>[...document.querySelectorAll('#director-timeline .prop-bar')].find(b=>b.dataset.propKey===k).click(),pk);await wait(900);
    let m=await marks();
    check(m.some(x=>x.where==='timeline'&&x.key===pk&&x.onScreen),`${id}: the prop's Props bar is marked and on screen in the timeline (${bars.length} bars, the last one)`);
    await tab('layers');await wait(400);m=await marks();
    const ly=m.find(x=>x.where==='panel'&&x.key===pk);
    if(ly)check(ly.onScreen,`${id}: the Layers tab marks its row and scrolls it into view (${ly.mid.toFixed(2)} from the middle)`);
    else console.log(`  note: ${id}: no Layers row for that bar`);
    await snap(id+'-1-prop');
    // ---- a person, from the People tab list: the People lane bar, the list row and the sheet row; the prop is not marked
    await tab('people');
    const pkey=await until(()=>page.$$eval('#director-panel .people-row[data-person-key]',l=>l.map(r=>r.dataset.personKey)).then(l=>l.length?l:null),'the People list').catch(()=>null);
    if(pkey){
      await page.evaluate(k=>document.querySelector(`#director-panel .people-row[data-person-key="${k}"] .people-pick`).click(),pkey.at(-1));await wait(900);
      m=await marks();
      check(m.some(x=>x.where==='panel'&&x.key===pkey.at(-1))&&m.some(x=>x.where==='timeline'&&x.what.startsWith('people-bar')&&x.key===pkey.at(-1)),`${id}: ${pkey.at(-1)} is marked in the People list and on the People lane`);
      const row=m.find(x=>x.where==='timeline'&&x.what.includes('ps-row'));
      check(row&&row.onScreen,`${id}: their People sheet row is marked and on screen (${row?.mid?.toFixed(2)} from the middle)`);
      check(!m.some(x=>x.key===pk),`${id}: the prop is no longer marked anywhere`);
      await snap(id+'-2-person');
      // the sheet: clicking another character's name selects them everywhere
      const other=await page.$$eval('#director-timeline .ps-char[data-person-keys]',l=>l.map(r=>r.dataset.personKeys).find(k=>!k.split(' ').includes(document.querySelector('#director-panel .people-row.selected')?.dataset.personKey)));
      if(other){
        await page.evaluate(k=>document.querySelector(`#director-timeline .ps-char[data-person-keys="${k}"] .desk-lane-label b`).click(),other);await wait(900);
        const now=await page.$eval('#director-panel .people-row.selected',e=>e.dataset.personKey).catch(()=>null);
        check(other.split(' ').includes(now),`${id}: a click on ${other}'s name on the sheet selects them in the People tab too`);
        m=await marks();check(m.some(x=>x.where==='panel'&&x.key===now)&&m.some(x=>x.where==='timeline'&&x.key===now&&x.what.startsWith('people-bar')),`${id}: and marks them on the People lane`);
      }
    }else console.log(`  note: ${id}: nobody in this chapter`);
    // ---- a room desk, from the Desks tab: the list row and the desk lanes' header
    await tab('desks');
    const dk=await until(()=>page.$$eval('#director-panel .desk-row[data-action="dk-select"]',l=>l.map(b=>b.dataset.section)).then(l=>l.length?l:null),'a room desk',20000).catch(()=>null);
    if(dk){
      await page.evaluate(k=>document.querySelector(`#director-panel .desk-row[data-section="${k}"]`).click(),dk[0]);await wait(1200);
      m=await marks();
      check(m.some(x=>x.where==='panel'&&x.key===dk[0]),`${id}: room desk ${dk[0]} is marked in the Desks list`);
      check(m.some(x=>x.where==='timeline'&&x.key===dk[0]),`${id}: and on the timeline's desk lanes (their header / Desk picker)`);
      check(!m.some(x=>x.where==='timeline'&&x.what.startsWith('people-bar')),`${id}: no person is marked any more`);
      await snap(id+'-3-desk');
      // back to a prop: the desk is not marked
      await page.evaluate(k=>[...document.querySelectorAll('#director-timeline .prop-bar')].find(b=>b.dataset.propKey===k)?.click(),bars[0]);await wait(900);
      m=await marks();check(m.some(x=>x.key===bars[0])&&!m.some(x=>x.key===dk[0]),`${id}: a prop picked again replaces the desk everywhere`);
    }else console.log(`  note: ${id}: no room desks`);
    await page.keyboard.press('Escape');await wait(400);
    m=await marks();check(!m.length,`${id}: Esc clears every mark`);
  }
  check(!errors.length,'no page errors'+(errors.length?': '+errors.join(' | '):''));
  console.log(`\ndirector-selection-e2e: ${passed.length} passed`);
}finally{await close();}
