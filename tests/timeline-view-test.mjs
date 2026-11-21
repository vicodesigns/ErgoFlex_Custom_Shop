// The timeline keeps its view through every edit and reload (20 Nov 2026, Vico: "after I delete a camera key the timeline
// rebuilds, every layer opens again and the one I was on jumps away"), and zooms far enough to pull close keys apart.
//   1. timeline-view.mjs: per cut + chapter {groups, zoom, left, top}; a chapter never seen opens with every group folded
//   2. timeline-ui.mjs: 40 px a frame at the most zoom; the grid gets finer when zoomed (down to the frame)
//   3. director.mjs wiring: the rebuild keeps scrollTop as well as scrollLeft, the folds and zoom come from the view store,
//      an edit / undo / re-import never opens a group or scrolls to the selection, a click on a visible key never scrolls
//   node tests/timeline-view-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VIEW_STORE,VIEW_LIMIT,viewFor,saveView,isFolded,scrollToKeep,inView,readViews} from '../experience/timeline-view.mjs';
import {maxZoom,zoomStep,snapTimelineTime,FRAME,FRAME_PX} from '../experience/timeline-ui.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};

// ---- 1
{
  const st=memory();
  const first=viewFor('/exports/cut-a:ch1',st);
  assert.deepEqual(first,{groups:{},zoom:1,left:0,top:0,saved:false},'nothing stored: the defaults');
  for(const g of ['motion','lighting','titles','props','people','graphics','sound'])assert.equal(isFolded(first.groups,g),true,g+' starts folded');
  saveView('/exports/cut-a:ch1',{groups:{motion:false,people:true}},st,1);
  saveView('/exports/cut-a:ch1',{zoom:6.5,left:900,top:240},st,2);
  const back=viewFor('/exports/cut-a:ch1',st);
  assert.equal(isFolded(back.groups,'motion'),false,'Motion opened stays open');
  assert.equal(isFolded(back.groups,'people'),true,'People folded stays folded');
  assert.equal(isFolded(back.groups,'lighting'),true,'a group never touched is folded');
  assert.equal(back.zoom,6.5);assert.equal(back.left,900);assert.equal(back.top,240);assert.equal(back.saved,true);
  assert.equal(viewFor('/exports/cut-a:ch2',st).saved,false,'another chapter has its own view');
  assert.equal(viewFor('/exports/cut-b:ch1',st).saved,false,'another cut has its own view');
  assert.ok(st.m.has(VIEW_STORE),'stored under '+VIEW_STORE);
  // junk in the store is ignored, never thrown
  st.setItem(VIEW_STORE,'{oops');assert.deepEqual(viewFor('x',st).groups,{});
  st.setItem(VIEW_STORE,JSON.stringify({x:{groups:{motion:'no',sound:false},zoom:'big',left:-5,top:'7'}}));
  assert.deepEqual(viewFor('x',st),{groups:{sound:false},zoom:1,left:0,top:7,saved:true});
  // the oldest entries go past the limit, the one being saved never
  const big=memory();for(let i=0;i<VIEW_LIMIT+20;i++)saveView('k'+i,{zoom:2},big,i);
  const all=readViews(big);assert.equal(Object.keys(all).length,VIEW_LIMIT);assert.ok(!all.k0&&all['k'+(VIEW_LIMIT+19)]);
  // the scroll to keep after a rebuild
  assert.deepEqual(scrollToKeep({sameChapter:true,live:{left:30,top:400},stored:{left:0,top:0}}),{left:30,top:400});
  assert.deepEqual(scrollToKeep({sameChapter:false,live:{left:30,top:400},stored:{left:5,top:6}}),{left:5,top:6});
  assert.equal(inView(100,130,90,400),true);assert.equal(inView(80,130,90,400),false);assert.equal(inView(100,420,90,400),false);
}
// ---- 2
{
  assert.equal(FRAME_PX,40);assert.ok(Math.abs(maxZoom(30,1250)-30*30*40/1250)<1e-9,'40 px a frame at the most zoom');
  // at the most zoom on a 30 s chapter, two camera keys (30 px wide) one frame apart are a key's width apart
  const pxPerSecond=1250*maxZoom(30,1250)/30;assert.ok(pxPerSecond*FRAME>=30-1e-9,'keys a frame apart no longer overlap');
  assert.equal(zoomStep(.1,40),.1,'zoom 1: the chosen step');
  assert.equal(zoomStep(.1,700),.05,'zoomed: 0.05 s');
  assert.equal(zoomStep(.1,1200),FRAME,'far in: the frame');
  assert.equal(zoomStep(1,100),.05,'a coarse step gets fine too when far in');
  assert.equal(zoomStep(0,1200),0,'snap off stays off');
  // a drag snaps to the frame grid when zoomed in, to 0.1 s at zoom 1 (tolerance in px, so targets scale too)
  assert.equal(snapTimelineTime(1.04,{seconds:30,step:.1,pixels:1250}),1);
  assert.ok(Math.abs(snapTimelineTime(1.04,{seconds:30,step:.1,pixels:36000})-31*FRAME)<1e-9,'1.04 s -> frame 31 when zoomed in');
  assert.equal(snapTimelineTime(1.04,{seconds:30,step:.1,pixels:36000,bypass:true}),1.04,'Alt: free');
}
// ---- 3
{
  const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8').replace(/\r/g,'');
  assert.doesNotMatch(src,/ergoflex\.director\.laneGroups/,'the old global fold key is gone (per cut and chapter now)');
  assert.match(src,/const groupClosed=g=>\{adoptView\(\);return isFolded\(laneGroups,g\);\};/,'folded unless opened, from the view store');
  const render=/function renderTimeline\(\)\{([^]*?)\n  \}/.exec(src)?.[1]||'';assert.ok(render,'renderTimeline is there');
  assert.match(render,/live=was&&renderedView===viewKey\?\{left:was\.scrollLeft,top:was\.scrollTop\}/,'the rebuild reads both scroll axes');
  assert.match(render,/restoreScroll\(timeline\.querySelector\('\.timeline-viewport'\),live\)/,'and puts both back');
  assert.doesNotMatch(render,/\.scrollLeft=scroll;/,'not only scrollLeft as before');
  assert.match(src,/function changed\(\)\{editQuietUntil=performance\.now\(\)\+600;/,'every edit (commit, undo, redo) quiets the selection side effects');
  assert.match(src,/function loadProject\(value,keepDraft=true\)\{editQuietUntil=/,'a re-import too');
  assert.match(src,/const changed=b2sel\.set\(selectionNow\(\)\)&&!editQuiet\(\);/,'no group opens, no scroll, for a selection an edit changed');
  assert.match(src,/function centreSelection\(root\)\{[^]*?inView\(r\.top,r\.bottom/,'a visible selection is never scrolled to');
  for(const fn of ['setZoom','zoomToSelection'])assert.match(/^[^]*?\n  \}/.exec(src.slice(src.indexOf(`function ${fn}(`)))[0],/saveScroll\(\)/,fn+' saves the zoom');
  assert.match(src,/name==='zoom-in'\?1\.5:1\/1\.5[^\n]*\n[^\n]*saveScroll\(\);return;/,'the − / + / Fit buttons save the zoom');
}
// the graphics editor: no clip counts as selected until one is picked (it started at 0: clip 0 was "the selection")
{
  const ge=readFileSync(new URL('../experience/graphics-editor.mjs',import.meta.url),'utf8');
  assert.match(ge,/let selectedGraphic=-1,/);assert.match(ge,/clear\(\)\{selectedGraphic=-1;\}/);assert.match(ge,/remove\(\)\{const i=live\(\);/);
  const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8');
  assert.equal((src.match(/titleEditor\.clear\(\);graphics\.clear\?\.\(\);/g)||[]).length>=8,true,'every other pick clears the graphic');
}
console.log('timeline-view-test: ok (folds, zoom and scroll per cut and chapter, all folded at first, kept through edits; 40 px a frame; finer grid when zoomed)');
