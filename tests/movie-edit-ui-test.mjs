// The movie's clip track as the Director draws it (experience/movie-edit-ui.mjs, wired in graphics-editor.mjs; ch 10
// media only): the chips over the clamped spans, + on plain cuts, the Movie edit section, its fields -> shot.screens.
//   node tests/movie-edit-ui-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {trackOverlay,trackLabel,movieInspector,movieFieldChange,binHTML,binInfoOf,binSources,monitorHTML} from '../experience/movie-edit-ui.mjs';
import {movieTrack,trackClips} from '../experience/screen-edit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r/g,'');
const L=JSON.parse(read('tests/fixtures/screen-edit-list/media-ch10.json')).screens,T=17,key=movieTrack('media',L),info=()=>({duration:100});

// ---- 1 the lane: a chip per transition over its span (dissolve 5-6 s, dip 11.1-11.9 s), the label
{
  const html=trackOverlay(L,key,T,{selected:2,info});
  const chips=[...html.matchAll(/data-clip-transition="(\d+)" style="left:([\d.]+)%;width:max\(10px,calc\(([\d.]+)% - ([\d.]+)%\)\)/g)].map(m=>[+m[1],+(+m[2]/100*T).toFixed(3),+(+m[3]/100*T).toFixed(3)]);
  assert.deepEqual(chips,[[1,5,6],[2,11.1,11.9]],'chips at the spans the composer blends');
  assert.match(html,/class="clip-transition clip-transition-dip selected"/,'the selected clip\'s chip');assert.match(html,/--dip:#000000/);
  assert.doesNotMatch(html,/data-clip-seam/,'no plain cut here');
  assert.match(html,/the live view cuts at 6 s; Render still and the film show the blend/);
  assert.equal(trackLabel(L,key,T),'Movie <small>3 clips</small>');
}
// a plain cut gets a +; a clamped dissolve a dashed chip with the reason
{
  const cut=structuredClone(L);delete cut[1].transitionIn;cut[2].transitionIn={type:'dissolve',dur:3};cut[2].offset=1;
  const html=trackOverlay(cut,key,T,{info});
  assert.match(html,/class="clip-seam" data-clip-seam="1" style="left:35\.29\d*%"/,'+ at 6 s');
  assert.match(html,/clip-transition clip-transition-dissolve clamped/);assert.match(html,/3 s → 1 s \(the source has 1 s before this clip&#39;s in point\)/);
}
// ---- 2 the Movie edit section
{
  const none=movieInspector(L,key,T,{info});assert.equal((none.match(/data-graphic-action="pick"/g)||[]).length,3,'three clips listed');assert.match(none,/Select a clip/);
  const html=movieInspector(L,key,T,{selected:1,info});
  assert.match(html,/data-movie-fields="1"/);assert.match(html,/<option value="dissolve" selected>Dissolve<\/option>/);assert.match(html,/name="me-dur" min="0.1" max="4" step="0.1" value="1"/);
  assert.match(html,/name="me-in" [^>]*value="70"/);assert.match(html,/name="me-out" [^>]*value="75.5"/);
  assert.match(html,/data-graphic-action="earlier" (?!disabled)/);assert.match(html,/data-graphic-action="later" (?!disabled)/);
  assert.match(movieInspector(L,key,T,{selected:0,info}),/data-graphic-action="earlier" disabled/,'the first clip cannot go earlier');
  assert.match(movieInspector(L,key,T,{selected:2,info}),/name="me-color" value="#000000"/,'a dip has its colour');
  const m=structuredClone(L);m[1].missing=true;assert.match(movieInspector(m,key,T,{selected:1,info}),/source not on this machine/);assert.equal(trackLabel(m,key,T),'Movie <small>3 clips · 1 missing</small>');
}
// ---- 3 the fields
{
  const set=(i,name,value)=>movieFieldChange(L,key,T,i,{name,value});
  assert.deepEqual(set(1,'me-type','dip').list[1].transitionIn,{type:'dip',dur:1,color:'#000000'},'dissolve -> dip keeps the length');
  assert.deepEqual(set(1,'me-type','cut').list[1].transitionIn,{type:'cut'},'a cut (still an edit list)');
  assert.deepEqual(movieFieldChange(L,key,T,0,{name:'me-type',value:'cut'}).list[0].transitionIn,undefined,'nothing there: stays nothing');
  assert.equal(set(1,'me-dur','2.5').list[1].transitionIn.dur,2.5);assert.throws(()=>set(1,'me-dur','6'),/up to 4/);assert.throws(()=>set(1,'me-dur',''),/Type a number/);
  assert.equal(set(2,'me-color','#FFFFFF').list[2].transitionIn.color,'#ffffff');
  const i=set(0,'me-in','20');assert.deepEqual([i.list[0].offset,i.list[0].end],[20,6],'source in moves, the length stays');
  const o=set(0,'me-out','43');assert.deepEqual([o.list[0].offset,o.list[0].end,o.clamped],[40,3,false],'source out: the clip ends earlier');
  assert.equal(set(0,'me-out','60').clamped,true,'longer than the room before clip 2: clamped');
  assert.equal(set(1,'me-rate','2').list[1].rate,2);assert.throws(()=>set(1,'me-rate','9'),/0.25× to 4×/);
  assert.equal(movieFieldChange(L,key,T,0,{name:'pe-x',value:'1'}),null,'not ours');
}
// ---- 3b the bin and the monitor
{
  const bin={sources:[{src:'app-reference/assets/desk_viewer/media/ambient-clip.mp4',group:'movie',seconds:100,w:1280,h:720,fps:30,audio:true},{src:'divi-editor/upload-to-promo/hero.mp4',group:'promo',seconds:12.5,w:1920,h:1080,fps:30,audio:false},{src:'z/odd.mp4',group:'weird',seconds:2},{nope:1}],missing:['the full movie']};
  assert.equal(binSources(bin).length,3);assert.equal(binInfoOf(bin)('/divi-editor/upload-to-promo/hero.mp4').seconds,12.5,'a leading / is the same source');assert.equal(binInfoOf(bin)('q.mp4'),null);
  const h=binHTML(bin,{picked:'divi-editor/upload-to-promo/hero.mp4'});
  assert.match(h,/Source bin · 3 clips/);assert.match(h,/<summary>Movie · 1<\/summary>/);assert.match(h,/<summary>ErgoFlex promo · 1<\/summary>/);assert.match(h,/<summary>Other · 1<\/summary>/);
  assert.match(h,/class="selected" data-movie-bin="divi-editor\/upload-to-promo\/hero\.mp4"/);assert.match(h,/Not on this machine: the full movie/);
  assert.match(binHTML(null),/Loading the source bin/);assert.match(binHTML({sources:[]}),/--bin/);
  const m=monitorHTML({mode:'bin',src:'divi-editor/upload-to-promo/hero.mp4',inS:3,outS:null,seconds:12.5,canAdd:true});
  assert.match(m,/<video data-source-monitor src="\/divi-editor\/upload-to-promo\/hero\.mp4"/);assert.match(m,/In <b>3 s<\/b> · Out <b>–<\/b> · source 12\.5 s/);
  assert.match(m,/data-graphic-action="bin-add" data-section="playhead" (?!disabled)/);assert.match(m,/data-graphic-action="mark-in"/);
  assert.doesNotMatch(monitorHTML({mode:'clip',src:'a.mp4',inS:1,outS:2}),/bin-add/,'a clip\'s source: marks only');assert.equal(monitorHTML({mode:'clip',src:null}),'');
}
// ---- 4 graphics-editor.mjs: only the movie track, the chips, the ripple, the section, the fields
const g=read('experience/graphics-editor.mjs');
assert.match(g,/const movieKey=\(\)=>movieTrack\(shot\(\)\.id,graphicScreens\(\)\);/);
assert.match(g,/const movie=!!mk&&graphicTrack\(entries\[0\]\[0\],entries\[0\]\[1\]\)===mk;/,'only the movie track gets the overlay');
assert.match(g,/\$\{movie\?trackOverlay\(list,mk,seconds,movieOpts\(\)\):''\}/);
assert.match(g,/ripple=!!mk&&\(event\.ctrlKey\|\|event\.metaKey\)&&!event\.target\.dataset\.graphicEdge&&graphicTrack\(graphicScreens\(\)\[index\],index\)===mk/,'Ctrl/Cmd+drag on a movie clip ripples');
assert.match(g,/const list=reorderClip\(graphicScreens\(\),d\.mk,d\.from,d\.to,shot\(\)\.seconds\);commit/);
assert.match(g,/r=mk&&movieFieldChange\(graphicScreens\(\),mk,shot\(\)\.seconds,i,el\)/);
assert.match(g,/if\(action==='earlier'\|\|action==='later'\)/);
assert.ok(!/\[name="me-type"\]'\)\?\.focus\(/.test(g),'a chip / + click shows the fields without focusing them (a focused select swallows Shift+R)');
assert.match(g,/remove\(\)\{const i=live\(\);if\(i<0\)return false;if\(onTransition&&graphicScreens\(\)\[i\]\?\.transitionIn\)\{const list=setTransition\(graphicScreens\(\),i,null\)/,'Delete on a picked chip: the transition only');
assert.match(read('experience/director.mjs'),/from '\.\/graphics-editor\.mjs\?v=clip-track-20261121';/);
assert.match(read('experience/director.mjs'),/graphics\.setBinUrl\(cutDir\?cutDir\+'\/director-film\/screen-bin\.json':null\);/,'the bin beside the chapter shots');
assert.match(g,/const mk=movieKey\(\);if\(mk\)loadBin\(\);/,'loaded only for the movie chapter');
assert.match(g,/movieInspector\(list,mk,shot\(\)\.seconds,movieOpts\(\)\)\+monitorPart\(list,mk\)\+binHTML\(bin,\{picked:binPick\}\)/);
assert.match(g,/const r=addFromBin\(graphicScreens\(\),mk,\{src:binPick,seconds:binInfo\(binPick\)\?\.seconds\?\?null,inS:marks\.in,outS:marks\.out\},\{at:where,seconds:shot\(\)\.seconds\}\);/);
assert.match(g,/if\(binPick\)\{marks\[action==='mark-in'\?'in':'out'\]=t;/,'bin source: the marks');
assert.match(g,/name:action==='mark-in'\?'me-in':'me-out',value:String\(t\)/,'clip source: its Source in \/ out');
assert.equal(movieTrack('music',[{target:'main-landscape',src:'x.mp4'}]),null,'the game montage: no clip track');
{const dm=read('experience/director.mjs');
 assert.match(dm,/if\(cutDir&&Array\.isArray\(job\.screens\)&&job\.screens\.some\(sc=>sc&&sc\.transitionIn\)\)\{/,'Render still composes only an edit list');
 assert.match(dm,/await fetch\('\/api\/screen-edit',\{method:'POST'/);assert.match(dm,/job\.screens=d\.screens;/);
 assert.match(dm,/composed=' · movie edit NOT composed \('\+error\.message\+'\): cuts shown';/,'a failure is said on the still');
 const sv=read('tools/studio-server.mjs');assert.match(sv,/os\.setPriority\(child\.pid, 10\)/,'a lower priority');assert.match(sv,/const p = composeQueue\.then\(run, run\); composeQueue = p\.catch/,'one at a time');}
assert.equal(trackClips(L,key,T).length,3);
console.log('movie-edit-ui-test: ok (chips at the composer\'s spans, + on cuts, Movie edit section and fields, wired for the movie track only)');
