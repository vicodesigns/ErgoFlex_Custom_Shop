// Title text options (2026-11-25): line height, case, opacity, outline, drop shadow per text block (typography.<line>) and
// text alignment per title (titles-src 'align'). Each must exist in the model (film-titles.mjs), the import
// (build-round8-director.py) and the film burn (finish-intro.py), and a title that uses none of them must burn
// byte-identical to before: tests/fixtures/titles-text-options holds a 17-title source (Vico's 13-title cut plus placed,
// scaled, 3-line and custom-shadow titles) and the titles.ass / titles.json the burn made before the options existed.
//   node tests/title-text-options-test.mjs        (python3 on PATH)
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {titleLines,expandedLines,stepOf,caseOf,cleanTypography,cleanTitle,placeOf,alignShift,srcEntry,LINE_LEAD,FONT_REAL,textBounds,fittedPaths} from '../experience/film-titles.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),X=path.join(root,'tools/experience'),FI=path.join(X,'finish-intro.py');
const env={...process.env,PYTHONUTF8:'1'},eol=b=>b.toString('utf8').replace(/\r\n/g,'\n');
const burn=(dir,srcObj,edl)=>{fs.writeFileSync(path.join(dir,'edl.json'),edl);fs.writeFileSync(path.join(dir,'titles-src.json'),JSON.stringify(srcObj,null,1));
  execFileSync('python3',[FI,dir,'--titles-only'],{stdio:'ignore',env});return {ass:eol(fs.readFileSync(path.join(dir,'final','titles.ass'))),json:eol(fs.readFileSync(path.join(dir,'final','titles.json')))};};
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-text-options-'));
try{
  // ---- 1. defaults: byte-identical burn ---------------------------------------------------------------------------------
  const G=path.join(root,'tests/fixtures/titles-text-options'),edl=fs.readFileSync(path.join(G,'edl.json'));
  const gsrc=JSON.parse(fs.readFileSync(path.join(G,'titles-src.json'),'utf8')),got=burn(TMP,gsrc,edl);
  assert.equal(got.ass,eol(fs.readFileSync(path.join(G,'titles.ass'))),'titles.ass byte-identical for titles that use no new option');
  assert.equal(got.json,eol(fs.readFileSync(path.join(G,'titles.json'))),'titles.json byte-identical');
  assert.ok(gsrc.titles.length>=17&&gsrc.titles.some(t=>t.typography)&&gsrc.titles.some(t=>t.shadow?.paths)&&gsrc.titles.some(t=>t.place),'the fixture covers typography, custom shadows and placed titles');
  // the same titles with every new option set to its default value / left out: still identical
  const noop=burn(TMP,{...gsrc,titles:gsrc.titles.map(t=>({...t,typography:cleanTypography(t.typography)}))},edl);assert.equal(noop.ass,got.ass,'cleaning the typography changes nothing');

  // ---- 2. model --------------------------------------------------------------------------------------------------------
  const base={id:'rise-0',rel_in:1,rel_out:6,eyebrow:'EYE',title:'Line one\nLine two\nLine three',detail:'Sub one\nSub two'};
  assert.deepEqual(titleLines(base).map(L=>[L.shadow,L.shadowAlpha.toFixed(3),L.shadowColor,L.opacity,L.strokeW]),[[1.2,'0.294','#000000',1,0],[2,'0.373','#000000',1,0],[1.5,'0.373','#000000',1,0]],'no options: the film\'s values');
  assert.equal(stepOf(titleLines(base)[1]),86*LINE_LEAD,'default line step = 0.74 x font size');
  assert.equal(Math.round(LINE_LEAD*FONT_REAL*100)/100,1.3,'which the panel shows as 1.30');
  const ys=t=>expandedLines(t).map(L=>[L.key,L.y]);
  const plainYs=ys(base);
  const open=ys({...base,typography:{title:{lineHeight:2}}});
  const step=2*86/FONT_REAL;assert.ok(Math.abs((open.filter(r=>r[0]==='title')[2][1]-open.filter(r=>r[0]==='title')[1][1])-step)<.011,'headline lines are lineHeight x em apart');
  assert.equal(open.filter(r=>r[0]==='title')[2][1],912,'the last headline line keeps the film\'s baseline');
  assert.ok(open.find(r=>r[0]==='eyebrow')[1]<plainYs.find(r=>r[0]==='eyebrow')[1],'a looser headline lifts the eyebrow so they never meet');
  assert.deepEqual(ys({...base,typography:{eyebrow:{lineHeight:2}}}).filter(r=>r[0]!=='eyebrow'),plainYs.filter(r=>r[0]!=='eyebrow'),'other blocks do not move');
  assert.ok(Math.abs(ys({...base,typography:{detail:{lineHeight:2}}}).filter(r=>r[0]==='detail')[1][1]-970-2*40/FONT_REAL)<.011,'supporting lines step down by their own line height');
  assert.equal(expandedLines({...base,title:'Mixed Case',typography:{title:{caps:'upper'}}}).find(L=>L.key==='title').text,'MIXED CASE');
  assert.equal(caseOf({caps:'lower'},'ABC'),'abc');assert.equal(base.title.includes('Line'),true,'the stored copy stays as typed');
  assert.deepEqual(cleanTypography({title:{lineHeight:9,caps:'x',opacity:1,strokeW:0,strokeColor:'#ff0000',shadowDist:99,shadowOpacity:2,shadowColor:'#000000'}}),{title:{lineHeight:3,shadowDist:30,shadowOpacity:1}},'ranges clamped, defaults and junk dropped');
  assert.deepEqual(cleanTypography({title:{opacity:.5,strokeW:3,strokeColor:'#FF0000',caps:'upper',shadowColor:'#112233',lineHeight:1.5}}),{title:{lineHeight:1.5,caps:'upper',opacity:.5,strokeW:3,strokeColor:'#FF0000',shadowColor:'#112233'}});
  assert.equal(cleanTypography({title:{strokeColor:'#ff0000'}}),undefined,'a colour without an outline width is nothing');
  // alignment
  assert.deepEqual([placeOf({}).align,placeOf({}).x,placeOf({align:'center'}).x,placeOf({align:'right'}).x,placeOf({place:'top-right'}).align,placeOf({place:'top-right',align:'left'}).x],['left',128,960,1792,'right',128]);
  assert.equal(placeOf({align:'center',position:{x:500,y:700}}).x,500,'an explicit position wins');
  assert.equal(cleanTitle({...base,align:'left'}).align,undefined,'left is the default: not stored');assert.equal(cleanTitle({...base,align:'center'}).align,'center');
  assert.equal(cleanTitle({...base,place:'top-right',align:'left'}).align,'left');assert.equal(cleanTitle({...base,place:'top-right',align:'right'}).align,undefined);
  assert.equal(srcEntry('rise',cleanTitle({...base,align:'center'})).align,'center','the export carries it');
  assert.deepEqual([alignShift('left',100),alignShift('center',100),alignShift('right',100)],[0,-50,-100]);
  const measure=(L,t)=>t.length*L.size*.5,tbC=textBounds({...base,title:'AB',eyebrow:'',detail:'',align:'center'},measure);assert.deepEqual([tbC.x0,tbC.x1],[-43,43],'centred text bounds');
  const fc=fittedPaths({...base,title:'AB',eyebrow:'',detail:'',align:'center'},measure)[0].points.map(p=>p.x);assert.deepEqual([Math.min(...fc),Math.max(...fc)],[-43-22,43+22],'centred shadow box');

  // ---- 3. the burn ------------------------------------------------------------------------------------------------------
  const E=JSON.stringify({fps:30,dissolve:1.5,total:60,chapters:[{index:1,id:'rise',duration:60,start:0,end:60}],transitions:[]});
  const run=entry=>{const o=burn(TMP,{titles:[{chapter:'rise',rel_in:2,rel_out:9,eyebrow:'Sit',title:'Head one\nHead two',detail:'Sub',...entry}],cta:{chapter:'rise',rel_in:50,rel_out:null,text:''},logo:{chapter:'rise',rel_in:50}},E);
    return o.ass.split('\n').filter(l=>/,(Eyebrow|Title|Detail),/.test(l));};
  const L0=run({}),tag=(ls,style,i=0)=>ls.filter(l=>l.includes(`,${style},`))[i];
  // line height: 2 x em = 97.62 px between the headline lines (film: 63.64)
  const lh=run({typography:{title:{lineHeight:2}}}),ym=l=>Number(l.match(/\\move\(\d+(?:\.\d+)?,([\d.]+),/)[1]);
  assert.ok(Math.abs((ym(tag(lh,'Title',1))-ym(tag(lh,'Title',0)))-2*86/FONT_REAL)<.02,'burn: headline lines lineHeight x em apart');
  assert.ok(Math.abs((ym(tag(L0,'Title',1))-ym(tag(L0,'Title',0)))-86*LINE_LEAD)<.02,'burn: default step 0.74 x size');
  assert.ok(ym(tag(lh,'Eyebrow'))<ym(tag(L0,'Eyebrow')),'burn: the eyebrow rises with a looser headline');
  assert.ok(!tag(lh,'Title',0).includes('\\fs'),'burn: a line height alone adds no style tags');
  // case, opacity, outline, shadow
  assert.ok(tag(run({typography:{title:{caps:'upper'}}}),'Title',0).endsWith('HEAD ONE'),'burn: UPPERCASE');
  const op=tag(run({typography:{title:{opacity:.5}}}),'Title',0);assert.ok(op.includes('\\1a&H80&')&&op.includes('\\4a&H')&&!op.includes('\\alpha'),`burn: opacity 50 % -> \\1a&H80& and the shadow dimmed with it (${op.slice(0,160)})`);
  const st=tag(run({typography:{title:{strokeW:3,strokeColor:'#ff0000'}}}),'Title',0);assert.ok(st.includes('\\bord3\\shad2')&&st.toLowerCase().includes('\\3c&h0000ff&'),`burn: outline 3 px red (ASS BGR) (${st.slice(0,160)})`);
  const sh=tag(run({typography:{detail:{shadowDist:5,shadowColor:'#336699',shadowOpacity:.8}}}),'Detail',0);assert.ok(sh.includes('\\shad5')&&sh.toLowerCase().includes('\\4c&h996633&')&&sh.includes('\\4a&H33&'),`burn: shadow 5 px, colour, 80 % (${sh.slice(0,170)})`);
  assert.ok(tag(run({typography:{detail:{shadowDist:0}}}),'Detail',0).includes('\\shad0'),'burn: shadow off');
  const sc=run({scale:2,typography:{title:{strokeW:3,shadowDist:4}}});assert.ok(tag(sc,'Title',0).includes('\\bord6')&&tag(sc,'Title',0).includes('\\shad8'),'burn: outline and shadow scale with the title');
  // alignment: centre = \an2 at the frame centre, right = \an3 at the right margin, an explicit position wins
  assert.ok(tag(run({align:'center'}),'Title',0).includes('\\an2\\move(960,'),'burn: centre');
  assert.ok(tag(run({align:'right'}),'Title',0).includes('\\an3\\move(1792,'),'burn: right');
  assert.ok(tag(run({align:'center',position:{x:500,y:700}}),'Title',0).includes('\\an2\\move(500,'),'burn: centre at his position');
  assert.ok(tag(run({place:'top-right',align:'left'}),'Title',0).includes('\\an1\\move(128,'),'burn: top-right placed, aligned left');
  // the shadow boxes follow alignment and case
  const shapes=align=>burn(TMP,{titles:[{chapter:'rise',rel_in:2,rel_out:9,eyebrow:'',title:'Head',detail:'',...align}],cta:{chapter:'rise',rel_in:50,rel_out:null,text:''},logo:{chapter:'rise',rel_in:50}},E).ass.split('\n').filter(l=>/,Scrim,.*\\p1/.test(l));
  const mx=l=>{const d=l.slice(l.indexOf('}m ')+3,l.indexOf('{\\p0}')).match(/-?\d+(\.\d+)?/g).map(Number);const xs=d.filter((_,i)=>i%2===0);return [Math.min(...xs),Math.max(...xs)];};
  const [c0,c1]=mx(shapes({align:'center'})[0]);assert.ok(Math.abs((c0+c1)/2-960)<.5,'burn: the centred shadow box is centred on x = 960');
  const [r0,r1]=mx(shapes({align:'right'})[0]);assert.ok(Math.abs(r1-(1792+22))<.5,'burn: the right-aligned box ends one padding past the right margin');
  const [u0,u1]=mx(shapes({title:'sit to focus',typography:{title:{caps:'upper'}}})[0]),[n0,n1]=mx(shapes({title:'sit to focus'})[0]);assert.ok(u1-u0>n1-n0+5,'burn: the shadow box is measured on the upper-cased text');

  // ---- 4. the Director's export -> import keeps the options -----------------------------------------------------------------
  const H=path.join(TMP,'imp');fs.mkdirSync(H);
  const typography={title:{lineHeight:1.6,caps:'upper',opacity:.9,strokeW:2,strokeColor:'#112233',shadowDist:3,shadowColor:'#445566',shadowOpacity:.5},detail:{lineHeight:1.1}};
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[{id:'rise',seconds:16,cameraPlan:{keys:[{at:0,position:[1,1,1],target:[0,0,0],fov:35},{at:16,position:[1,1,1],target:[0,0,0],fov:35}]}}]}));
  fs.writeFileSync(path.join(H,'titles-src.json'),JSON.stringify({titles:[{chapter:'rise',rel_in:3.6,rel_out:9.4,eyebrow:'E',title:'T',detail:'D'}],cta:{chapter:'rise',rel_in:15,rel_out:null,text:''},logo:{chapter:'rise',rel_in:15}}));
  fs.writeFileSync(path.join(H,'edl.json'),E);
  const ent=cleanTitle({id:'rise-0',rel_in:3.6,rel_out:9.4,eyebrow:'E',title:'T',detail:'D',typography,align:'center',timed:true},16);
  const exp={schema:'ergoflex.client-cut',version:1,id:'film-rise',name:'Film chapter: rise (16 s)',shots:[{id:'rise',room:'home',seconds:16,camera:{keys:[{id:'plan-00',time:0,view:{position:[1,1,1],target:[0,0,0],fov:35}},{id:'plan-01',time:1,view:{position:[1,1,1],target:[0,0,0],fov:35}}]},filmTitles:[ent]}]};
  fs.writeFileSync(path.join(H,'export.json'),JSON.stringify(exp));
  execFileSync('python3',[path.join(X,'build-round8-director.py'),H,'--import',path.join(H,'export.json')],{stdio:'ignore',env});
  const imp=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8')).titles[0];
  assert.deepEqual(imp.typography,ent.typography,'import keeps every typography option exactly as the Director cleaned it');assert.equal(imp.align,'center','import keeps align');
  assert.deepEqual(cleanTitle({...imp,id:'rise-0'},16).typography,ent.typography,'and the Director reads it back the same');

  console.log('Title text options: defaults burn byte-identical (17-title fixture); line height / case / opacity / outline / shadow per block and align per title in the model, the import and the burn.');
}finally{fs.rmSync(TMP,{recursive:true,force:true});}
