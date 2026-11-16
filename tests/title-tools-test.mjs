// Title tools (M1): + Title / Duplicate / Delete in the model (film-titles.mjs), the draft / Export cut round trip
// (cuts.mjs keeps filmTitles, [] = every title of the chapter deleted), build-round8-director.py --import into a
// scratch titles-src.json (new ids become new entries, deleted ones go, other chapters untouched), finish-intro.py
// --titles-only (titles.ass) and --chapter-titles (a burned chapter video) showing the new / duplicated title, and the
// render side untouched (filmTitles never reaches the render shot, so no chapter cache key moves).
//   node tests/title-tools-test.mjs        (python3 and ffmpeg on PATH)
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newTitle,duplicateTitle,newTitleId,spanAt,cleanFilmTitles,chapterTitles,srcEntry,DEFAULT_COPY,NEW_TITLE_SECONDS,MAX_TITLES,titleLines,lineGaps,withGap,GAPS,cleanTypography,fittedBox,fittedPaths,LINES} from '../experience/film-titles.mjs';
import {cleanShot,cleanCut} from '../experience/cuts.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),X=path.join(root,'tools/experience');
const py=(...a)=>execFileSync('python3',a,{encoding:'utf8',stdio:['ignore','pipe','pipe']});

// ---- model ----
assert.deepEqual(spanAt(3,16),[3,8]);assert.deepEqual(spanAt(14,16),[11,16],'near the end: moved earlier, still 5 s, inside the chapter');
assert.deepEqual(spanAt(-2,16),[0,5]);assert.deepEqual(spanAt(1,3),[0,3],'a chapter shorter than 5 s: the whole chapter');
assert.equal(newTitleId('rise',['rise-0','rise-new1']),'rise-new2');assert.ok(!/^rise-\d+$/.test(newTitleId('rise',[])),'never the <chapter>-<n> form the import maps to an existing entry');
const a=newTitle('rise',4.25,16,['rise-0']);
assert.deepEqual({...a},{id:'rise-new1',rel_in:4.25,rel_out:9.25,...DEFAULT_COPY,timed:true});
assert.equal(NEW_TITLE_SECONDS,5);
const base={id:'rise-0',rel_in:3.6,rel_out:9.4,eyebrow:'SIT · STAND',title:'Your height.',detail:'Sit.',position:{x:300,y:700},scale:1.2,shadow:{blur:30}};
const d=duplicateTitle(base,'rise',16,['rise-0','rise-new1']);
assert.equal(d.id,'rise-new2');assert.equal(d.rel_in,9.4);assert.equal(d.rel_out,15.2);assert.deepEqual(d.position,base.position);assert.equal(d.scale,1.2);assert.deepEqual(d.shadow,{blur:30});assert.equal(d.title,'Your height.');
const d2=duplicateTitle({...base,rel_in:8,rel_out:14},'rise',16,['rise-0']);assert.deepEqual([d2.rel_in,d2.rel_out],[8,14],'no room after it: same time (stacks)');
assert.equal(base.id,'rise-0','the original is not touched');
assert.equal(MAX_TITLES,8);

// ---- draft / Export cut keep the list; [] (all deleted) survives cleanShot / cleanCut ----
const shot=cleanShot({id:'rise',room:'product',seconds:16,filmTitles:[base,a,d]});
assert.deepEqual(shot.filmTitles.map(t=>t.id),['rise-0','rise-new1','rise-new2']);
assert.deepEqual(cleanShot({id:'rise',room:'product',seconds:16,filmTitles:[]}).filmTitles,[],'every title deleted is kept as []');
assert.equal(cleanShot({id:'rise',room:'product',seconds:16}).filmTitles,undefined,'never edited: no field');
const cutAll=cleanCut({schema:'ergoflex.client-cut',version:1,id:'film-rise',name:'x',shots:[{id:'rise',room:'product',seconds:16,filmTitles:[]}]});
assert.deepEqual(cutAll.shots[0].filmTitles,[]);
assert.deepEqual(JSON.parse(JSON.stringify(cleanCut(JSON.parse(JSON.stringify(cutAll))))).shots[0].filmTitles,[],'draft reload keeps []');

// ---- render side: filmTitles never reaches the render shot / live film shot (cache keys untouched) ----
const film={id:'rise',room:'product',kind:'scene',seconds:16,title:'Rise'};
for(const ft of [undefined,[],shot.filmTitles]){
  const s={id:'rise',room:'product',kind:'scene',seconds:16,...(ft?{filmTitles:ft}:{})};
  const r=filmRenderShot(film,s,null),l=liveFilmShot(film,s);
  assert.equal(JSON.stringify(r).includes('filmTitles'),false);assert.equal(JSON.stringify(l).includes('filmTitles'),false);
  assert.deepEqual(r,filmRenderShot(film,{id:'rise',room:'product',kind:'scene',seconds:16},null),'the render shot is the same with or without titles');
}

// ---- import -> titles-src.json -> finish-intro (titles.ass and a burned chapter) ----
const H=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-title-tools-'));
try{
  const key=at=>({at,position:[1,1,1],target:[0,0,0],fov:35});
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[{id:'awaken',seconds:44.85,cameraPlan:{keys:[key(0),key(44.85)]}},{id:'rise',seconds:16,cameraPlan:{keys:[key(0),key(16)]}},{id:'create',seconds:22.5,cameraPlan:{keys:[key(0),key(22.5)]}}]}));
  const src={titles:[{chapter:'awaken',rel_in:3.6,rel_out:9.2,eyebrow:'ERGOFLEX',title:'Level up.',detail:'Better health.'},{chapter:'awaken',rel_in:13.2,rel_out:19.6,eyebrow:'SAFETY',title:'Safe.',detail:'Light.',scrim:'60'},{chapter:'rise',rel_in:3.6,rel_out:9.4,eyebrow:'SIT · STAND',title:'Your height. Your rhythm.',detail:'Sit to focus.',scrim:'38'}],cta:{chapter:'create',rel_in:20,rel_out:null,text:'Go.'},logo:{chapter:'create',rel_in:19}};
  fs.writeFileSync(path.join(H,'titles-src.json'),JSON.stringify(src,null,1));
  fs.writeFileSync(path.join(H,'edl.json'),JSON.stringify({fps:30,dissolve:1.5,total:79,chapters:[{index:1,id:'awaken',duration:44.85,start:0,end:44.85},{index:2,id:'rise',duration:16,start:43.35,end:59.35},{index:3,id:'create',duration:22.5,start:57.85,end:80.35}],transitions:[[.8,-.35],.8]}));
  const cam={keys:[{id:'plan-00',time:0,view:{position:[1,1,1],target:[0,0,0],fov:35}},{id:'plan-01',time:1,view:{position:[1,1,1],target:[0,0,0],fov:35}}]};
  // the Director's list: the film's rise-0, a new title at 1 s (renamed), and a duplicate of rise-0
  const film0=chapterTitles(src,'rise')[0];
  const added={...newTitle('rise',1,16,[film0.id]),title:'Brand new card'};
  const dup=duplicateTitle(film0,'rise',16,[film0.id,added.id]);
  const exportOf=list=>cleanCut({schema:'ergoflex.client-cut',version:1,id:'film-rise',name:'Film chapter: rise (16 s)',shots:[{id:'rise',room:'home',seconds:16,camera:cam,filmTitles:list}]});
  const ef=path.join(H,'export.json');fs.writeFileSync(ef,JSON.stringify(exportOf([film0,added,dup])));
  assert.equal(py(path.join(X,'build-round8-director.py'),H,'--import',ef).trim(),'rise');
  let got=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8'));
  assert.deepEqual(got.titles.map(t=>[t.chapter,t.title]),[['awaken','Level up.'],['awaken','Safe.'],['rise','Brand new card'],['rise','Your height. Your rhythm.'],['rise','Your height. Your rhythm.']],'new + duplicate in, film order, awaken untouched');
  assert.deepEqual(got.titles.slice(0,2),src.titles.slice(0,2),'other chapters byte-for-byte');
  const [nNew,nOld,nDup]=got.titles.slice(2);
  assert.equal(nNew.rel_in,1);assert.equal(nNew.rel_out,6);assert.equal(nNew.eyebrow,'EYEBROW');assert.equal(nNew.director_timing,true);assert.equal(nNew.scrim,undefined,'a new title does not inherit another entry');
  assert.equal(nOld.scrim,'38');assert.equal(nDup.rel_in,9.4);assert.equal(nDup.rel_out,15.2);
  assert.deepEqual(srcEntry('rise',cleanFilmTitles([added],16)[0]),{chapter:'rise',rel_in:1,rel_out:6,eyebrow:'EYEBROW',title:'Brand new card',detail:'Supporting text',director_timing:true});
  // titles.ass carries all three rise titles (absolute: rise starts at 43.35 s)
  py(path.join(X,'finish-intro.py'),H,'--titles-only');
  const ass=fs.readFileSync(path.join(H,'final','titles.ass'),'utf8');
  assert.ok(/Dialogue: 1,0:00:44\.49,0:00:49\.35,Title,.*Brand new card/.test(ass),'titles.ass: the new title (headline +140 ms)');
  assert.equal((ass.match(/,Title,,[^\n]*Your height\. Your rhythm\./g)||[]).length,2,'titles.ass: the original and its duplicate');
  // --chapter-titles burns them onto a chapter video (a short black 1920x1080 clip): the new title is in the frame at 4 s
  const vin=path.join(H,'rise-in.mp4'),vout=path.join(H,'rise-out.mp4');
  execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=black:s=1920x1080:r=10:d=8','-c:v','libx264','-pix_fmt','yuv420p',vin]);
  const burn=py(path.join(X,'finish-intro.py'),H,'--chapter-titles','rise',vin,vout);assert.match(burn,/rise: 3 title\(s\)/);
  const crop=(file,t,[x,y,w,h])=>execFileSync('ffmpeg',['-v','error','-ss',String(t),'-i',file,'-frames:v','1','-vf',`crop=${w}:${h}:${x}:${y},format=gray`,'-f','rawvideo','-'],{maxBuffer:1<<26});
  const lit=buf=>buf.reduce((n,v)=>n+(v>128),0);
  const headline=[128,820,900,100];                      // the lower-left headline row
  assert.ok(lit(crop(vout,4,headline))>2000,'the new title is burned in at 4 s');
  assert.equal(lit(crop(vin,4,headline)),0,'(the source has nothing there)');
  assert.equal(lit(crop(vout,.5,headline)),0,'nothing before the new title comes in');
  // delete every rise title: the export keeps [] and the import removes the chapter's entries, awaken untouched
  fs.writeFileSync(ef,JSON.stringify(exportOf([])));
  assert.deepEqual(JSON.parse(fs.readFileSync(ef,'utf8')).shots[0].filmTitles,[]);
  const log=execFileSync('python3',[path.join(X,'build-round8-director.py'),H,'--import',ef],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  got=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8'));
  assert.deepEqual(got.titles,src.titles.slice(0,2),'rise titles removed, the others as they were');assert.equal(got.cta.text,'Go.');
  assert.match(py(path.join(X,'finish-intro.py'),H,'--chapter-titles','rise',vin,vout),/rise has no titles: plain copy/);
  assert.ok(log.trim()==='rise');
}finally{fs.rmSync(H,{recursive:true,force:true});}

// ---- M2: per-line offsets and line spacing (defaults = the film's layout) ----
{
  const plain={id:'rise-0',rel_in:3.6,rel_out:9.4,eyebrow:'A',title:'B',detail:'C'};
  assert.deepEqual(titleLines(plain).map(L=>[L.key,L.y,L.dx]),[['eyebrow',812,0],['title',912,0],['detail',970,0]],'no typography: the film\'s lines');
  assert.deepEqual(titleLines(plain).map(L=>L.spacing),[6,0,.2],'the headline\'s Style -0.6 is what libass burns: 0');
  assert.equal(titleLines({typography:{title:{spacing:-1}}})[1].spacing,-1,'a spacing he sets is kept (\\fsp honours negatives)');
  assert.deepEqual(lineGaps(plain),{top:100,bottom:58});assert.deepEqual(GAPS,{top:100,bottom:58});
  const g=withGap(plain,'top',80);assert.deepEqual(g,{eyebrow:{dy:20}});assert.deepEqual(lineGaps({...plain,typography:g}),{top:80,bottom:58});
  const g2=withGap({...plain,typography:{title:{dy:-10}}},'bottom',70);assert.deepEqual(g2,{title:{dy:-10},detail:{dy:2}},'gaps are measured from the headline wherever it is');
  assert.equal(withGap(plain,'top',100),undefined,'the film\'s gap again: nothing stored');
  assert.deepEqual(cleanTypography({eyebrow:{dx:3.456,dy:0,size:30},detail:{dx:5000}}),{eyebrow:{size:30,dx:3.46},detail:{dx:1000}});
  const L0=titleLines({typography:{eyebrow:{dx:10,dy:-5}}})[0],b0=fittedBox(LINES[0],100),b1=fittedBox(L0,100);
  assert.deepEqual([b1.x0-b0.x0,b1.x1-b0.x1,b1.y0-b0.y0,b1.y1-b0.y1],[10,10,-5,-5],'a moved line\'s fitted box moves with it');
  const fit=fittedPaths({...plain,typography:{detail:{dy:12}}},(L,t)=>50);assert.equal(fit[2].points[0].y-fittedPaths(plain,(L,t)=>50)[2].points[0].y,12);
  // the burn: offsets only move \move (no type tags), defaults byte-identical
  const H2=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-title-lines-'));
  try{
    const edl={fps:30,dissolve:1.5,total:60,chapters:[{index:1,id:'awaken',duration:44.85,start:0,end:44.85},{index:2,id:'rise',duration:16,start:43.35,end:59.35}],transitions:[.8]};
    const run=entry=>{fs.writeFileSync(path.join(H2,'edl.json'),JSON.stringify(edl));fs.writeFileSync(path.join(H2,'titles-src.json'),JSON.stringify({titles:[{chapter:'rise',rel_in:3.6,rel_out:9.4,eyebrow:'SIT',title:'Head',detail:'Sub',...entry}],cta:{chapter:'rise',rel_in:15,rel_out:null,text:''},logo:{chapter:'rise',rel_in:15}}));
      py(path.join(X,'finish-intro.py'),H2,'--titles-only');return fs.readFileSync(path.join(H2,'final','titles.ass'),'utf8').split('\n').filter(l=>/,(Box)?(Eyebrow|Title|Detail),/.test(l));};
    const base=run({}),moved=run({typography:{eyebrow:{dx:6,dy:-24},detail:{dy:18}}});
    assert.ok(base.find(l=>/,Eyebrow,/.test(l)).includes('{\\an1\\move(128,822,128,812,0,900)'),'default eyebrow as before');
    assert.ok(moved.find(l=>/,Eyebrow,/.test(l)).includes('{\\an1\\move(134,798,134,788,0,900)'),'eyebrow moved 6 right, 24 up, no type tags');
    assert.ok(moved.find(l=>/,BoxEyebrow,/.test(l)).includes('\\move(134,798,134,788,0,900)'),'its box moves with it');
    assert.ok(moved.find(l=>/,Detail,/.test(l)).includes('\\move(128,998,128,988,0,900)'),'supporting line 18 down');
    assert.deepEqual(moved.filter(l=>/,(Box)?Title,/.test(l)),base.filter(l=>/,(Box)?Title,/.test(l)),'the headline is untouched');
    const scaled=run({scale:1.5,typography:{eyebrow:{dy:-20}}});
    assert.ok(scaled.find(l=>/,Eyebrow,/.test(l)).includes('\\move(128,'+(912+(792-912)*1.5+15)+',128,'+(912+(792-912)*1.5)+',0,900)'),'offsets scale with the title (about the headline baseline)');
    const styled=run({typography:{title:{color:'#ff0000'}}});
    assert.ok(styled.find(l=>/,Title,/.test(l)).includes('\\fs86\\fsp0\\b600'),'a restyled headline keeps the spacing libass burnt before (0, not -0.6)');
  }finally{fs.rmSync(H2,{recursive:true,force:true});}
}
console.log('Title tools: + Title / Duplicate / Delete (ids, span inside the chapter, copy keeps layout + shadow), draft and Export cut keep the list ([] included), filmTitles never in the render shot, import adds / removes titles-src entries (other chapters untouched), titles.ass + --chapter-titles burn show the new title, delete-all import verified; M2 per-line offsets / line spacing in the model, fitted boxes and the burn (defaults unchanged).');
