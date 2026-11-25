// The end card on the Titles lane (Nov 24 2026, Vico: "I'm trying to edit the logo and the 'Let's build yours' title, and
// I don't see it anywhere in the timeline"). experience/end-card.mjs + title-editor.mjs, in headless Chrome on a bare page
// (the Titles lane, the Title tab and the frame overlay, as tests/title-typography-browser-test.mjs does), fed the cut's
// own titles-src.json and edl.json:
//   1. the hero's lane shows the wordmark and the CTA as end-card blocks where titles-src has them, and the film's last
//      fade; a chapter without the end card shows none;
//   2. selecting a block opens the end-card inspector (CTA: text, font, size, letter spacing, x, gap, fade-in, in, out;
//      wordmark: in, scale, x, y) with today's values and the score note;
//   3. dragging the wordmark block moves it and the CTA with it (one undo step); trimming the CTA's out point; the
//      inspector's fields write shot.endCard; dragging the CTA in the frame moves it (x / gap);
//   4. cuts.mjs keeps shot.endCard (draft, export) and never edits the render shot; build-round8-director.py --import of
//      that export writes titles-src.json logo / cta with edited: true (other entries untouched), and an export without
//      endCard leaves titles-src.json alone; finish-intro.py --titles-only then burns the edited CTA where it was put.
//   node tests/director-end-card-test.mjs [--cut DIR] [--shots DIR]    (python3, Chrome: $CHROME)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {endCardOf,mergedEndCard,cleanEndCard,ctaLayout,logoBox,filmFadeAt,spans} from '../experience/end-card.mjs';
import {cleanShot,cleanCut} from '../experience/cuts.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),X=path.join(root,'tools/experience');
const arg=k=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:null;
const CUT=path.resolve(arg('--cut')||path.join(root,'exports/cinematic-intro-cut-vicos-3rd-cut')),shots=arg('--shots');
const src=JSON.parse(fs.readFileSync(path.join(CUT,'titles-src.json'),'utf8')),edl=JSON.parse(fs.readFileSync(path.join(CUT,'edl.json'),'utf8'));
const hero=edl.chapters.find(c=>c.id===src.logo.chapter),SEC=hero.duration;
let failures=0;const log=(...a)=>console.log(...a);const check=(ok,label)=>{log(ok?'PASS':'FAIL',label);if(!ok)failures++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---- model (node) ----
const film=endCardOf(src,hero.id);
check(film&&film.logo.rel_in===src.logo.rel_in&&film.cta.rel_in===src.cta.rel_in&&film.cta.text===src.cta.text,`end card from titles-src: wordmark ${film?.logo.rel_in} s, CTA ${film?.cta.rel_in} s`);
check(endCardOf(src,'rise')===null,'no end card in another chapter');
const L0=ctaLayout(film),B0=logoBox(film.logo);
check(B0.x===960&&Math.abs(B0.y-788.4)<1e-9&&Math.abs(B0.w-422.4)<1e-9,`defaults = finish-intro's wordmark (centre 960, 788.4; 22 % = 422.4 px): ${B0.x}, ${B0.y}, ${B0.w}`);
check(Math.abs(L0.top-(788.4+422.4*304/1400/2+(src.cta.gap??0)))<1e-9&&L0.x===960,`CTA top ${L0.top.toFixed(2)} = the wordmark's bottom + gap, centred on it`);
const fade=filmFadeAt(edl,hero.id);check(Math.abs(fade-(edl.total-1.4-hero.start))<1e-6,`film fade at hero ${fade} s`);
const ce=cleanEndCard({logo:{rel_in:99,x:'a',scale:9},cta:{rel_in:20,rel_out:20.1,text:'a\nb',font:'Comic',size:4,evil:1}},SEC);
check(ce.logo.rel_in===SEC&&ce.logo.scale===5&&ce.logo.x===undefined&&ce.cta.text==='a b'&&ce.cta.font===undefined&&ce.cta.size===8&&ce.cta.rel_out===20.5&&!('evil' in ce.cta),'cleanEndCard clamps and drops unknown fields '+JSON.stringify(ce));
check(cleanEndCard({})===undefined&&cleanEndCard(null)===undefined,'nothing edited: no field');
const sh=cleanShot({id:'hero',room:'product',seconds:SEC,endCard:{cta:{text:'Build yours.'}}});
check(sh.endCard?.cta?.text==='Build yours.','cleanShot keeps shot.endCard');
check(!JSON.stringify(filmRenderShot({id:'hero',room:'product',kind:'scene',seconds:SEC},sh,null)).includes('endCard'),'the render shot never gets endCard (no chapter cache key moves)');

// ---- the lane / inspector / overlay in Chrome ----
const {default:puppeteer}=await import('puppeteer-core');
const port=await new Promise(res=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-endcard-'));
fs.copyFileSync(path.join(root,'studio-state.json'),path.join(tmp,'state.json'));   // (a studio state file; the test page reads none of it)
const server=spawn('node',[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',path.join(tmp,'state.json')],{cwd:root,stdio:'ignore'});
let up=false;for(let i=0;i<150&&!up;i++){try{up=(await fetch(`http://127.0.0.1:${port}/experience/director.css`)).ok;}catch{}if(!up)await sleep(100);}
if(!up)throw Error('the studio server did not start');
const chrome=process.env.CHROME||[String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,'/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
const browser=await puppeteer.launch({executablePath:chrome,headless:'new',defaultViewport:{width:1600,height:1000},args:['--no-sandbox','--disable-gpu','--mute-audio']});
let exported=null;
try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let base=null;try{base=execFileSync('git',['show','1ee2901b:experience/title-editor.mjs'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});}catch{}
  await page.setRequestInterception(true);
  page.on('request',r=>{const u=r.url();
    if(u.endsWith('/end-card-test.html'))return r.respond({status:200,contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/experience/director.css"><style>body{background:#0b1218;color:#dfe8ee;font:12px system-ui;margin:0}#timeline{position:fixed;left:0;right:0;top:560px;padding:8px}#panel{position:fixed;left:980px;top:0;width:600px;height:550px;overflow:auto;padding:8px}.desk-lane{height:40px}</style></head><body class="film-frame"><div id="panel" class="director-panel"></div><div id="timeline" class="timeline-content"></div></body></html>'});
    if(u.endsWith('/experience/title-editor-base.mjs')&&base)return r.respond({status:200,contentType:'text/javascript; charset=utf-8',body:Buffer.from(base,'utf8')});
    r.continue();});
  await page.goto(`http://127.0.0.1:${port}/experience/end-card-test.html`);
  const setup=async(module,shotId)=>page.evaluate(async({module,src,edl,SEC,shotId})=>{
    document.querySelectorAll('.title-overlay').forEach(e=>e.remove());
    const {createTitleEditor}=await import(module);
    const panel=document.querySelector('#panel'),timeline=document.querySelector('#timeline');
    const shot={id:shotId,room:'product',seconds:SEC};window.testShot=shot;window.commits=0;window.msgs=[];let editor,t=.2;
    const render=()=>{panel.innerHTML=editor.panel();editor.sync();},renderTimeline=()=>{timeline.innerHTML=`<div class="desk-lanes title-lanes">${editor.lane()}</div>`;};
    editor=createTitleEditor({panel,timeline,shot:()=>shot,time:()=>t,seek:v=>{t=v;},commit:(fn,opts)=>{fn();window.commits++;if(opts.render)render();},status:m=>window.msgs.push(m),render,renderTimeline,
      showInspector:()=>{},onSelect:()=>{},snapDelta:({raw})=>({delta:raw,snap:null}),dragFeedback:()=>{},endDragFeedback:()=>{},ready:()=>{},open:()=>true});
    editor.setSource({src,edl});window.editor=editor;window.seekTo=v=>{t=v;editor.sync();};await editor.fontsLoaded;
    const box=document.querySelector('.title-overlay');box.style.cssText='position:fixed;left:0;top:0;width:960px;height:540px;display:block;background:#1d2a33';
    renderTimeline();render();
  },{module,src,edl,SEC,shotId});
  const out=shots?path.resolve(shots):null;if(out)fs.mkdirSync(out,{recursive:true});
  const shotPng=async name=>{if(out)await page.screenshot({path:path.join(out,name)});};
  if(base){await setup('/experience/title-editor-base.mjs','hero');await page.evaluate(()=>window.seekTo(22.2/testShot.seconds));await shotPng('polish1124-endcard-lane-before.png');
    check(await page.evaluate(()=>document.querySelectorAll('[data-end-clip]').length)===0,'before (base 1ee2901b): the hero\'s Titles lane is empty');}
  await setup('/experience/title-editor.mjs','hero');
  const lane=await page.evaluate(()=>[...document.querySelectorAll('[data-end-clip]')].map(b=>({k:b.dataset.endClip,left:parseFloat(b.style.left),width:parseFloat(b.style.width),text:b.textContent})));
  check(lane.length===2&&Math.abs(lane[0].left-src.logo.rel_in/SEC*100)<.01&&Math.abs(lane[1].left-src.cta.rel_in/SEC*100)<.01,'the lane shows the wordmark and the CTA blocks at their times '+JSON.stringify(lane.map(l=>[l.k,l.left.toFixed(2)])));
  check(lane[1]?.text.includes('build yours'),'the CTA block carries its copy');
  const fl=await page.evaluate(()=>{const f=document.querySelector('[data-film-fade]');return f&&parseFloat(f.style.left);});
  check(fl!==null&&Math.abs(fl-fade/SEC*100)<.01,`the film's last fade on the lane from ${fade} s`);
  await page.evaluate(()=>window.seekTo(22.2/testShot.seconds));
  check(await page.evaluate(()=>!!document.querySelector('[data-end-card=logo] image')&&!!document.querySelector('[data-end-card=cta] text')),'the frame overlay draws the wordmark and the CTA at 22.2 s');
  // select the CTA: the inspector
  const box=async sel=>page.evaluate(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};},sel);
  let b=await box('[data-end-clip=cta]');await page.mouse.click(b.cx,b.cy);await sleep(120);
  const fields=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#panel [name^=ec-]')].map(e=>[e.name,e.value])));
  check(fields['ec-cta-text']===src.cta.text&&+fields['ec-cta-size']===src.cta.size&&fields['ec-cta-font']===src.cta.font&&+fields['ec-cta-spacing']===src.cta.spacing&&+fields['ec-cta-gap']===src.cta.gap&&+fields['ec-cta-fade']===src.cta.fade_in&&+fields['ec-cta-in']===src.cta.rel_in&&fields['ec-cta-out']===''&&+fields['ec-cta-x']===960,'CTA inspector: today\'s text, font, size, spacing, gap, fade-in, in, out, x '+JSON.stringify(fields));
  await shotPng('polish1124-endcard-lane-after-cta.png');
  check(await page.evaluate(()=>testShot.endCard===undefined&&commits===0),'selecting edits nothing');
  // the wordmark: drag its block +1 s; the CTA follows; one commit
  b=await box('[data-end-clip=logo]');const lw=await page.evaluate(()=>document.querySelector('[data-title-lane]').getBoundingClientRect().width),dx=lw/SEC*1;
  await page.mouse.move(b.x+30,b.cy);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(b.x+30+dx*i/8,b.cy);await sleep(16);}await page.mouse.up();await sleep(150);
  const moved=await page.evaluate(()=>({e:structuredClone(testShot.endCard),commits,f:Object.fromEntries([...document.querySelectorAll('#panel [name^=ec-]')].map(e=>[e.name,e.value])),note:document.querySelector('[data-end-score-note]')?.textContent||''}));
  const dl=moved.e?.logo?.rel_in-src.logo.rel_in,dc=moved.e?.cta?.rel_in-src.cta.rel_in;
  check(Math.abs(dl-1)<.02&&Math.abs(dc-dl)<1e-6&&moved.commits===1,`wordmark block dragged +${dl?.toFixed(3)} s, the CTA +${dc?.toFixed(3)} s with it, one undo step`);
  check(/score gets re-fitted/.test(moved.note)&&/You moved the wordmark/.test(moved.note),'the wordmark inspector says the score gets re-fitted');
  await shotPng('polish1124-endcard-lane-after-logo-moved.png');
  // back to the film's wordmark (Reset), then CTA edits in the inspector
  await page.evaluate(()=>document.querySelector('[data-title-action=end-reset]').click());
  check(await page.evaluate(()=>testShot.endCard===undefined),'Reset wordmark drops the wordmark edit and takes the CTA back with it (nothing edited left)');
  await page.evaluate(()=>editor.select('end-cta',{reveal:false}));
  const set=(name,v,ev='input')=>page.evaluate(({name,v,ev})=>{const el=document.querySelector(`#panel [name=${name}]`);el.value=v;el.dispatchEvent(new Event(ev,{bubbles:true}));},{name,v,ev});
  await set('ec-cta-text','Let’s build yours, together.');await set('ec-cta-size','60');await set('ec-cta-font','Poppins Bold','input');await set('ec-cta-spacing','4');await set('ec-cta-gap','80');await set('ec-cta-fade','0.8');
  await set('ec-cta-out','24','change');
  const ed=await page.evaluate(()=>structuredClone(testShot.endCard.cta));
  check(ed.text==='Let’s build yours, together.'&&ed.size===60&&ed.font==='Poppins Bold'&&ed.spacing===4&&ed.gap===80&&ed.fade_in===.8&&ed.rel_out===24,'CTA fields write shot.endCard.cta '+JSON.stringify(ed));
  b=await box('[data-end-clip=cta]');check(Math.abs(b.w-(24-ed.rel_in)/SEC*lw)<2,'the CTA block ends at its new out point');
  // drag the CTA in the frame: 60 px (film) right, 40 px down
  await page.evaluate(()=>window.seekTo(22.5/testShot.seconds));
  const r=await box('[data-end-move=cta]'),k=960/1920;
  await page.mouse.move(r.cx,r.cy);await page.mouse.down();for(let i=1;i<=6;i++){await page.mouse.move(r.cx+60*k*i/6,r.cy+40*k*i/6);await sleep(16);}await page.mouse.up();await sleep(150);
  const fr=await page.evaluate(()=>structuredClone(testShot.endCard.cta));
  check(Math.abs(fr.x-1020)<1.5&&Math.abs(fr.gap-120)<1.5,`CTA dragged in the frame: x ${fr.x}, gap ${fr.gap}`);
  await shotPng('polish1124-endcard-frame-edited.png');
  exported=cleanCut({schema:'ergoflex.client-cut',version:1,id:'film-hero',name:'Film chapter: hero',shots:[{id:'hero',room:'product',seconds:SEC,endCard:await page.evaluate(()=>testShot.endCard)}]});
  check(JSON.stringify(exported.shots[0].endCard.cta)===JSON.stringify(fr),'Export cut (cleanCut) keeps the edited end card');
  // another chapter: no end-card blocks
  await setup('/experience/title-editor.mjs','rise');
  check(await page.evaluate(()=>document.querySelectorAll('[data-end-clip],[data-film-fade]').length)===0,'another chapter shows no end card');
  check(!errors.length,'no page errors '+errors.join(' | '));
}catch(error){console.error(error);failures++;}finally{await browser.close();server.kill();}

// ---- import: the export -> titles-src.json (scratch cut), then finish-intro --titles-only ----
if(exported){
  const H=path.join(tmp,'cut');fs.mkdirSync(H);
  try{
    const key=at=>({at,position:[1,1,1],target:[0,0,0],fov:35});
    fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[{id:'hero',seconds:SEC,cameraPlan:{keys:[key(0),key(SEC)]}}]}));
    const s0={titles:[{chapter:'rise',rel_in:3.6,rel_out:9.4,eyebrow:'A',title:'B',detail:'C'}],cta:src.cta,logo:src.logo};
    fs.writeFileSync(path.join(H,'titles-src.json'),JSON.stringify(s0,null,1));
    fs.writeFileSync(path.join(H,'edl.json'),JSON.stringify({fps:30,dissolve:1.5,total:SEC+10,chapters:[{index:1,id:'rise',duration:11.5,start:0,end:11.5},{index:2,id:'hero',duration:SEC,start:10,end:SEC+10}]}));
    const cam={keys:[{id:'plan-00',time:0,view:{position:[1,1,1],target:[0,0,0],fov:35}},{id:'plan-01',time:1,view:{position:[1,1,1],target:[0,0,0],fov:35}}]};
    const ef=path.join(H,'export.json'),py=(...a)=>execFileSync('python3',a,{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUTF8:'1'}});
    fs.writeFileSync(ef,JSON.stringify({...exported,shots:[{...exported.shots[0],camera:cam}]}));
    check(py(path.join(X,'build-round8-director.py'),H,'--import',ef).trim()==='hero','build-round8-director.py --import takes the hero export');
    const got=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8')),c=exported.shots[0].endCard.cta;
    check(got.cta.edited===true&&got.cta.text===c.text&&got.cta.size===60&&got.cta.font==='Poppins Bold'&&got.cta.x===c.x&&got.cta.gap===c.gap&&got.cta.rel_out===24&&got.cta.fade_in===.8,'titles-src.json cta: his edits, edited: true '+JSON.stringify(got.cta));
    check(JSON.stringify(got.logo)===JSON.stringify(src.logo)&&JSON.stringify(got.titles)===JSON.stringify(s0.titles),'the wordmark (not edited) and the titles untouched');
    check(fs.readdirSync(H).some(f=>/^titles-src\.pre-director-hero-endcard-/.test(f)),'a backup of titles-src.json first');
    py(path.join(X,'finish-intro.py'),H,'--titles-only');
    const line=fs.readFileSync(path.join(H,'final','titles.ass'),'utf8').split('\n').find(l=>l.includes(',CTA,'));
    check(line.includes('\\move(1020,')&&line.includes('\\fs60')&&line.includes('\\fnPoppins Bold')&&line.includes('\\fsp4')&&line.includes('\\fad(800,')&&line.includes('together'),'finish-intro burns the edited CTA: '+line.slice(0,160));
    const end=line.split(',')[2];check(end===`0:00:${(10+24).toFixed(2)}`,`the CTA ends at its out point (${end})`);
    // an export without endCard leaves titles-src.json alone
    const before=fs.readFileSync(path.join(H,'titles-src.json'),'utf8');
    fs.writeFileSync(ef,JSON.stringify({...exported,shots:[{id:'hero',room:'product',seconds:SEC,camera:cam}]}));py(path.join(X,'build-round8-director.py'),H,'--import',ef);
    check(fs.readFileSync(path.join(H,'titles-src.json'),'utf8')===before,'an export without endCard leaves titles-src.json as it is');
  }catch(error){console.error(error.stderr||error);failures++;}
}
fs.rmSync(tmp,{recursive:true,force:true});
console.log(failures?`${failures} failure(s)`:'all ok');process.exitCode=failures?1:0;
