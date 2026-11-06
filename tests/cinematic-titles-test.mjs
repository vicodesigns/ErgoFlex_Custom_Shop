// Film titles in Director Mode: the model (experience/film-titles.mjs), the cut round trip (cuts.mjs), the import into
// titles-src.json (build-round8-director.py --import), titles-after-cut.py keeping Director timing, and finish-intro.py
// drawing a custom shadow shape with the same path the Director previews (assDrawing == ass_drawing).
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LINES,ANCHOR,BOX_BLUR,BOX_OPACITY,chapterTitles,cutRule,timingNotes,cleanFilmTitles,cleanShadow,fittedBox,fittedPaths,shadowOf,lineState,restTime,svgPath,assDrawing,segments,bounds,nearestOnPath,insertPoint,deletePoint,toggleSmooth,moveHandle,movePoint,transformPaths,pointCount,srcEntry} from '../experience/film-titles.mjs';
import {cleanShot,cleanCut} from '../experience/cuts.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),X=path.join(root,'tools/experience');

// ---- source + cut rule (titles-after-cut.py's numbers for the hq14 EDL) ----
const edl={dissolve:1.5,chapters:[{id:'awaken',start:0},{id:'rise',start:43.35},{id:'create',start:57.85}],transitions:[[.8,-.35],.8]};
assert.equal(cutRule(edl,'awaken').cutDone,undefined);assert.equal(cutRule(edl,'awaken').nextCut,43.35+.75-.35-.4);
const R=cutRule(edl,'rise');assert.equal(R.cutDone,.8);assert.equal(R.earliest,2.3);assert.equal(R.nextCut,14.5+.75-.4);assert.ok(Math.abs(R.latest-(R.nextCut-.8))<1e-9);
const src={titles:[{chapter:'awaken',rel_in:3.6,rel_out:9.2,eyebrow:'ERGOFLEX',title:'Level up your every day.',detail:'Better health.'},{chapter:'awaken',rel_in:13.2,rel_out:19.6,eyebrow:'SAFETY',title:'Safe for everyone around it.',detail:'Light and sound.',scrim:'60'},{chapter:'rise',rel_in:3.6,rel_out:9.4,eyebrow:'SIT · STAND',title:'Your height. Your rhythm.',detail:'Sit to focus.',scrim:'38',director_timing:true}]};
const aw=chapterTitles(src,'awaken');assert.deepEqual(aw.map(t=>t.id),['awaken-0','awaken-1']);assert.equal(aw[1].scrim,undefined);
assert.equal(chapterTitles(src,'rise')[0].timed,true);
assert.deepEqual(timingNotes({rel_in:3.6,rel_out:9.4},R),[]);
assert.match(timingNotes({rel_in:1,rel_out:6},R)[0],/1\.3 s before the 1\.5 s-after-cut mark \(2\.3 s\)/);
assert.match(timingNotes({rel_in:4,rel_out:6},R)[0],/under the usual 3\.5 s/);

// ---- cleaning ----
const t0=cleanFilmTitles([{id:'rise-0',rel_in:5,rel_out:2,title:'x'.repeat(300),shadow:{blur:500,opacity:-1,paths:[{line:'title',points:[{x:1,y:2},{x:3,y:4}]}]}}],16)[0];
assert.ok(t0.rel_out>t0.rel_in&&t0.title.length===140);assert.deepEqual(t0.shadow,{blur:80,opacity:0});
assert.equal(cleanShadow({paths:[{line:'bogus',points:[{x:0,y:0},{x:1,y:0,in:[0,0]},{x:1,y:1,out:[2,'3'],smooth:1}]}]}).paths[0].line,undefined);
assert.deepEqual(cleanShadow({paths:[{points:[{x:0,y:0},{x:1,y:0,in:[0,0]},{x:1,y:1,out:[2,'3'],smooth:1}]}]}).paths[0].points,[{x:0,y:0},{x:1,y:0},{x:1,y:1,out:[2,3],smooth:true}]);
assert.equal(cleanFilmTitles(undefined),undefined);

// ---- fitted boxes (libass BorderStyle 3: advance + padding; line box = Fontsize + 2 x padding, bottom at y + padding) ----
const measure=(L,t)=>t.length*L.size*.5;
const [E,T,D]=LINES;
assert.deepEqual(fittedBox(T,597),{x0:-26,x1:597+26,y0:912-86-26-912,y1:26});    // probed: x 102..751, y 800..938
assert.deepEqual(fittedBox(E,126),{x0:-16,x1:142,y0:812-28-16-912,y1:812+16-912}); // probed: x 112..270, y 768..828
const title={id:'rise-0',rel_in:3.6,rel_out:9.4,eyebrow:'SIT · STAND',title:'Your height.',detail:''};
const fit=fittedPaths(title,measure);assert.deepEqual(fit.map(p=>p.line),['eyebrow','title']);assert.equal(fit[1].points.length,4);
let S=shadowOf(title,measure);assert.equal(S.custom,false);assert.equal(S.blur,BOX_BLUR);assert.equal(S.opacity,BOX_OPACITY);
assert.ok(Math.abs(BOX_OPACITY-.3098)<1e-3);

// ---- timing (finish-intro: \fad(650,420), \move rise over 900 ms) ----
assert.equal(lineState(title,140,14,3.6).on,false);
let st=lineState(title,140,14,3.74+.325);assert.ok(Math.abs(st.alpha-.5)<1e-9&&st.dy>0);
st=lineState(title,140,14,6);assert.equal(st.alpha,1);assert.equal(st.dy,0);assert.equal(st.blur,0);
assert.ok(Math.abs(lineState(title,0,10,9.4-.21).alpha-.5)<1e-9);assert.equal(lineState(title,0,10,9.4).on,false);
assert.ok(restTime(title)>3.6+.38+.9&&restTime(title)<9.4-.42);

// ---- paths: SVG and ASS share the outline; editing keeps the shape until moved ----
const sq={line:'title',points:[{x:0,y:0},{x:100,y:0},{x:100,y:50},{x:0,y:50}]};
assert.equal(svgPath(sq),'M 128 912 L 228 912 L 228 962 L 128 962 L 128 912 Z');
assert.equal(assDrawing(sq),'m 128 912 l 228 912 l 228 962 l 128 962 l 128 912');
let r=insertPoint(sq,0,.25);assert.equal(r.index,1);assert.deepEqual(r.path.points[1],{x:25,y:0});
let curve=toggleSmooth(sq,1);assert.ok(curve.points[1].smooth&&curve.points[1].in&&curve.points[1].out);
assert.match(assDrawing(curve),/^m 128 912 b /);
const before=bounds([curve]);r=insertPoint(curve,1,.5);const after=bounds([r.path]);
for(const k of ['x0','y0','x1','y1'])assert.ok(Math.abs(before[k]-after[k])<.6,'splitting a curve keeps its outline');
assert.equal(pointCount([r.path]),5);
const n=nearestOnPath(sq,50,-3);assert.equal(n.seg,0);assert.ok(Math.abs(n.t-.5)<.01&&Math.abs(n.d-3)<1e-6);
assert.throws(()=>deletePoint({points:sq.points.slice(0,3)},0),/at least 3 points/);assert.equal(deletePoint(sq,0).points.length,3);
let h=moveHandle(curve,1,'out',[0,40]);const p1=h.points[1];assert.ok(Math.abs(Math.atan2(p1.in[1],p1.in[0])-Math.atan2(-40,0))<1e-6,'a smooth point keeps its handles opposite');
h=moveHandle(curve,1,'out',[0,40],true);assert.equal(h.points[1].smooth,undefined);assert.deepEqual(h.points[1].in,curve.points[1].in,'Alt breaks the handle');
assert.equal(toggleSmooth(curve,1).points[1].in,undefined);
assert.deepEqual(movePoint(sq,2,110,60).points[2],{x:110,y:60});
const big=transformPaths([sq],{ox:0,oy:0,sx:2,sy:.5,dx:10});assert.deepEqual(big[0].points[2],{x:210,y:25});
assert.equal(segments(sq).length,4);

// ---- the cut keeps the edited titles (Export cut), absent until edited ----
const shot=cleanShot({id:'rise',room:'product',seconds:16,filmTitles:[{...title,timed:true,shadow:{blur:24,paths:[sq]}}]});
assert.equal(shot.filmTitles.length,1);assert.equal(shot.filmTitles[0].shadow.blur,24);assert.equal(shot.filmTitles[0].timed,true);
assert.equal(cleanShot({id:'rise',room:'product',seconds:16}).filmTitles,undefined);
assert.deepEqual(srcEntry('rise',shot.filmTitles[0]).director_timing,true);

// ---- import -> titles-src.json, titles-after-cut keeps his timing, finish-intro draws the shape (same path) ----
const H=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-titles-'));
try{
  const key=(at)=>({at,position:[1,1,1],target:[0,0,0],fov:35});
  fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[{id:'awaken',seconds:44.85,cameraPlan:{keys:[key(0),key(44.85)]}},{id:'rise',seconds:16,cameraPlan:{keys:[key(0),key(16)]}},{id:'create',seconds:22.5,cameraPlan:{keys:[key(0),key(22.5)]}}]}));
  fs.writeFileSync(path.join(H,'titles-src.json'),JSON.stringify({...src,cta:{chapter:'create',rel_in:20,rel_out:null,text:'Go.'},logo:{chapter:'create',rel_in:19}},null,1));
  fs.writeFileSync(path.join(H,'edl.json'),JSON.stringify({fps:30,dissolve:1.5,total:79,chapters:[{index:1,id:'awaken',duration:44.85,start:0,end:44.85},{index:2,id:'rise',duration:16,start:43.35,end:59.35},{index:3,id:'create',duration:22.5,start:57.85,end:80.35}],transitions:[[.8,-.35],.8]}));
  const shape={blur:22,opacity:.4,paths:[{line:'title',points:[{x:-30,y:-120},{x:640,y:-120,out:[40,0],smooth:true,in:[-40,0]},{x:660,y:30},{x:-30,y:30}]}]};
  const exp={schema:'ergoflex.client-cut',version:1,id:'film-rise',name:'Film chapter: rise (16 s)',shots:[{id:'rise',room:'home',seconds:16,camera:{keys:[{id:'plan-00',time:0,view:{position:[1,1,1],target:[0,0,0],fov:35}},{id:'plan-01',time:1,view:{position:[1,1,1],target:[0,0,0],fov:35}}]},
    filmTitles:[{id:'rise-0',rel_in:1.2,rel_out:7,eyebrow:'SIT · STAND',title:'Your height, your rhythm.',detail:'Sit to focus.',timed:true,shadow:shape}]}]};
  const ef=path.join(H,'export.json');fs.writeFileSync(ef,JSON.stringify(exp));
  const out=execFileSync('python3',[path.join(X,'build-round8-director.py'),H,'--import',ef],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.equal(out.trim(),'rise','--import prints only the chapter id (the watcher reads it)');
  const got=JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8'));
  assert.equal(got.titles.length,3);assert.deepEqual(got.titles.map(t=>t.chapter),['awaken','awaken','rise'],'film order kept');
  const rt=got.titles[2];assert.equal(rt.title,'Your height, your rhythm.');assert.equal(rt.rel_in,1.2);assert.equal(rt.director_timing,true);assert.equal(rt.scrim,'38','other fields kept');
  assert.deepEqual(rt.shadow,shape);assert.equal(got.cta.text,'Go.');
  const backups=fs.readdirSync(H).filter(f=>/^titles-src\.pre-director-rise-\d{8}-\d{6}\.json$/.test(f));assert.equal(backups.length,1,'titles-src backed up first');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(H,backups[0]),'utf8')).titles,src.titles);
  // the same export again: nothing to write, no second backup
  execFileSync('python3',[path.join(X,'build-round8-director.py'),H,'--import',ef],{stdio:'ignore'});
  assert.equal(fs.readdirSync(H).filter(f=>f.startsWith('titles-src.pre-')).length,1);
  // titles-after-cut: his early title stays (flagged), nothing moved
  const cutLog=execFileSync('python3',[path.join(X,'titles-after-cut.py'),H],{encoding:'utf8'});
  assert.match(cutLog,/! rise .*1\.20.*kept as set in Director Mode/);assert.equal(JSON.parse(fs.readFileSync(path.join(H,'titles-src.json'),'utf8')).titles[2].rel_in,1.2);
  // finish-intro: the shape is one drawing per path, same darkness / softness, no fitted boxes for this title
  execFileSync('python3',[path.join(X,'finish-intro.py'),H,'--titles-only'],{stdio:'ignore'});
  const ass=fs.readFileSync(path.join(H,'final','titles.ass'),'utf8').split('\n');
  const drawing=ass.filter(l=>l.includes('\\p1')&&l.includes('0:00:44'));assert.equal(drawing.length,1);
  assert.ok(drawing[0].includes(`\\1a&H${Math.round(255*.6).toString(16).toUpperCase()}&\\blur22}`+assDrawing(shape.paths[0])+'{\\p0}'),'finish-intro draws the Director path');
  assert.ok(drawing[0].startsWith('Dialogue: 0,0:00:44.69,')&&drawing[0].includes('\\move(0,14,0,0,0,900)'),'the path keeps its line\'s timing (headline: +140 ms, 14 px rise)');
  const riseBoxes=ass.filter(l=>/Box(Eyebrow|Title|Detail)/.test(l)&&l.includes('0:00:44'));assert.equal(riseBoxes.length,0);
  assert.equal(ass.filter(l=>/,BoxTitle,/.test(l)).length,2,'the other titles keep their fitted boxes');
}finally{fs.rmSync(H,{recursive:true,force:true});}
console.log('Film titles: cut rule + gentle notes, fitted boxes (libass geometry), fade / rise timing, point editing (insert keeps the outline, smooth / sharp, mirrored and broken handles, delete, scale), cut keeps filmTitles, import -> titles-src (backup, film order, director_timing), titles-after-cut keeps his timing, finish-intro draws the same path verified.');
