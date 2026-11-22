// The timeline keeps its view through every edit and reload (20 Nov 2026, Vico: "after I delete a camera key the timeline
// rebuilds, every layer opens again and the one I was on jumps away"), and zooms far enough to pull close keys apart.
//   1. timeline-view.mjs: per cut + chapter {groups, zoom, left, top}; a chapter never seen opens with every group folded
//   2. timeline-ui.mjs: 40 px a frame at the most zoom; the grid gets finer when zoomed (down to the frame)
//   3. director.mjs wiring: the rebuild keeps scrollTop as well as scrollLeft, the folds and zoom come from the view store,
//      an edit / undo / re-import never opens a group or scrolls to the selection, a click on a visible key never scrolls
//   node tests/timeline-view-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VIEW_STORE,VIEW_LIMIT,viewFor,saveView,isFolded,scrollToKeep,inView,readViews,holdScroll,SCROLL_HOLD_MS,nextWantTop,reapplyTop,lostTop} from '../experience/timeline-view.mjs';
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
  // a scroll put back after a rebuild that did not take (Windows, rise: 54 -> 0 after an inspector edit and its undo):
  // held for a moment and put back each frame; one that took needs nothing
  assert.equal(holdScroll({left:0,top:54},{left:0,top:54},1000),null,'it took: no hold');
  assert.equal(holdScroll({left:0,top:54},{left:1,top:53},1000),null,'within a pixel or so: no hold');
  assert.deepEqual(holdScroll({left:0,top:54},{left:0,top:0},1000),{top:54,until:1000+SCROLL_HOLD_MS},'clamped to 0: the top held');
  assert.equal(holdScroll({left:300,top:0},{left:120,top:0},5),null,'a horizontal clamp is not held (a zoom out sets its own scrollLeft)');
  assert.equal(holdScroll(null,{left:0,top:0},0),null,'nothing to put back');
  assert.ok(SCROLL_HOLD_MS>=1000&&SCROLL_HOLD_MS<=3000,'a moment, not the 8 s a chapter open gets');
  // the same thing played out: lanes that reach their height two frames after the rebuild
  {
    // (frame 0: the lanes still short; they reach their height on frame 2)
    const vp={max:0,top:0,left:0,set(t){this.top=Math.max(0,Math.min(this.max,t));}};let want=null;const frames=[0,20,200];
    vp.set(54);want=holdScroll({left:0,top:54},{left:vp.left,top:vp.top},0);assert.ok(want,'frame 0: clamped, held');
    for(const [i,max] of frames.entries()){vp.max=max;if(!want)break;vp.set(want.top);if(holdScroll(want,{left:vp.left,top:vp.top},i)===null)want=null;}
    assert.equal(vp.top,54,'the scroll is back once the lanes are tall enough');assert.equal(want,null,'and the hold ends');
  }
  // the meant top (Windows, rise, 1cbfd180: after Escape / a blur the viewport read 0 with no scroll event, and every
  // rebuild after it read 0 and put back "want 0")
  assert.equal(nextWantTop({want:null,top:54,max:300,user:false}),54,'the first event sets it');
  assert.equal(nextWantTop({want:54,top:120,max:300,user:false}),120,'an app scroll down is meant');
  assert.equal(nextWantTop({want:54,top:0,max:300,user:false}),0,'an app scroll to the top (a group jump) is meant');
  assert.equal(nextWantTop({want:54,top:20,max:20,user:false}),54,'a clamp (the lanes got shorter) keeps the meant top');
  assert.equal(nextWantTop({want:54,top:20,max:20,user:true}),20,'unless the user is scrolling or folding in the timeline');
  assert.equal(reapplyTop({want:54,top:0,max:300}),54,'lost: put back');
  assert.equal(reapplyTop({want:54,top:20,max:20}),null,'as far as the lanes allow (already there)');
  assert.equal(reapplyTop({want:54,top:20,max:40}),40,'grown a bit: as far as they allow now');
  assert.equal(reapplyTop({want:54,top:55,max:300}),null,'within a pixel or so: nothing');
  assert.equal(reapplyTop({want:null,top:0,max:300}),null,'nothing meant yet: nothing');
  assert.equal(lostTop({top:0,max:300,want:54}),true,'a rebuild reading 0 while 54 is meant: lost');
  assert.equal(lostTop({top:20,max:20,want:54}),true,'clamped at its max: lost');
  assert.equal(lostTop({top:80,max:300,want:54}),false,'somewhere in the middle: a real position, kept');
  assert.equal(lostTop({top:0,max:300,want:0}),false,'0 meant: kept');assert.equal(lostTop({top:0,max:300,want:null}),false);
  // Windows' sequence replayed: scrolled to 54 (event), a silent reset to 0 (no event), then an inspector edit rebuilds
  {
    let want=null;const ev=(top,max=300,user=false)=>{want=nextWantTop({want,top,max,user});};
    ev(54,300,true);                          // the scroll to the camera row
    const old={top:0,max:300};                // Escape + blur: 0, no event
    assert.equal(reapplyTop({want,top:old.top,max:old.max}),54,'three frames after the blur: put back');
    const live={top:old.top};if(lostTop({...old,want}))live.top=want;
    assert.equal(live.top,54,'or, if the edit came first, the rebuild puts back 54, not 0');
    ev(0,300,true);assert.equal(want,0,'a wheel to the top by the user is meant, and kept by the next rebuild');
    assert.equal(lostTop({top:0,max:300,want}),false);
  }
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
  assert.match(src,/const groupClosed=g=>\{adoptView\(\);(if\(g==='titles'&&laneGroups\.titles===undefined&&document\.body\.classList\.contains\('ef-phone'\)\)return false;)?return isFolded\(laneGroups,g\);\};/,'folded unless opened, from the view store (on a phone the Titles lane starts open: fold-titles-test)');
  const render=/function renderTimeline\(\)\{([^]*?)\n  \}/.exec(src)?.[1]||'';assert.ok(render,'renderTimeline is there');
  assert.match(render,/live=was&&renderedView===viewKey\?\{left:was\.scrollLeft,top:was\.scrollTop\}/,'the rebuild reads both scroll axes');
  assert.match(render,/restoreScroll\(timeline\.querySelector\('\.timeline-viewport'\),live\)/,'and puts both back');
  assert.doesNotMatch(render,/\.scrollLeft=scroll;/,'not only scrollLeft as before');
  // the live scroll is held too when the rebuild clamped it (before: set once, so a clamp to 0 stuck)
  const restore=/function restoreScroll\(viewport,live\)\{([^]*?)\n  \}/.exec(src)?.[1]||'';assert.ok(restore,'restoreScroll is there');
  assert.match(restore,/if\(want===live\)\{const hold=holdScroll\(live,\{left:viewport\.scrollLeft,top:viewport\.scrollTop\},performance\.now\(\)\);if\(!hold\)return;want=viewWant=hold;\}/,'a clamped live restore becomes a hold');
  assert.ok(restore.indexOf('holdScroll')<restore.indexOf('if(want===viewWant)'),'and is then retried each frame like a stored one');
  assert.match(restore,/const left=want\.left\?\?live\?\.left;if\(left!=null\)viewport\.scrollLeft=left;/,'a hold leaves scrollLeft to the live one (a rebuild during a hold keeps both)');
  assert.match(restore,/\(want\.left==null\|\|Math\.abs\(viewport\.scrollLeft-want\.left\)<2\)/,'and is done when the top is back');
  // the paths Windows saw: an inspector edit (the name field commits on input) and undo / redo all rebuild through
  // changed() -> renderTimeline(), which reads the live scroll and restores it
  assert.match(src,/if\(name==='key-label'&&selectedKey\(\)\)\{commit\(/,'the name field commits');
  assert.match(/function commit\([^]*?\n  \}/.exec(src)[0],/changed\(\);/,'a commit goes through changed()');
  assert.match(/function changed\(\)\{[^\n]*/.exec(src)[0],/renderTimeline\(\);/,'changed() rebuilds through renderTimeline');
  assert.match(src,/if\(name==='undo'\|\|name==='redo'\)\{[^]*?changed\(\);render\(\);/,'undo / redo too');
  assert.match(src,/function render\(\)\{stampDraft\(\);renderPanel\(\);renderTimeline\(\);\}/,'render() as well');
  assert.equal((src.match(/timeline\.innerHTML=/g)||[]).length,1,'renderTimeline is the only rebuild of the timeline');
  // the meant top: kept from scroll events, put back by a rebuild that reads a lost one, when the lanes change size, and
  // three frames after a key / click / focus change that left it lost with no scroll event
  assert.match(src,/wantTop=\{key:viewKey,top:nextWantTop\(\{want:meantTop\(\),top:v\.scrollTop,max:v\.scrollHeight-v\.clientHeight,user:performance\.now\(\)<userScrollUntil\}\)\};/,'every scroll event updates the meant top');
  assert.match(src,/if\(event\.target\.closest\?\.\('\.timeline-viewport'\)\)\{viewWant=null;userScrollUntil=performance\.now\(\)\+800;\}/,'a wheel, click or key in the timeline is the user\'s');
  assert.match(render,/if\(live&&performance\.now\(\)>=userScrollUntil&&lostTop\(\{top:live\.top,max:was\.scrollHeight-was\.clientHeight,want:meantTop\(\)\}\)\)live\.top=meantTop\(\);/,'a rebuild that reads a lost top puts back the meant one');
  assert.ok(render.indexOf('lostTop(')<render.indexOf('restoreScroll('),'before it restores');
  assert.match(render,/topKeeper\.observe\(v\);topKeeper\.observe\(v\.querySelector\('\.timeline-content'\)\)/,'the lanes changing size put it back');
  assert.match(src,/for\(const type of \['keyup','pointerup','focusin','focusout','change','input'\]\)document\.addEventListener\(type,keepTopSoon/,'and so does any key, click, focus change or field edit');
  assert.match(src,/const n=scrollEvents;requestAnimationFrame\(\(\)=>\{if\(scrollEvents===n\)keepTop\(\);\}\)/,'only when no scroll event came (an app scroll is never undone)');
  assert.match(/function keepTop\(\)\{[^]*?\n  \}/.exec(src)[0],/viewWant\|\|performance\.now\(\)<userScrollUntil/,'never while a restore holds or the user scrolls');
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
