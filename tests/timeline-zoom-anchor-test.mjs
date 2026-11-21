// Ctrl+wheel keeps the time under the pointer within a frame (21 Nov 2026, Windows e2e on rise: "time under it 2.0431 ->
// 2.0751", about 1 frame off). setZoom anchored a fraction of the whole scroll width, which includes the 150 px lane
// labels that do not zoom; now it anchors the fraction of the ruler (the seconds) under the pointer (rulerAnchorScroll).
//   node tests/timeline-zoom-anchor-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rulerAnchorScroll} from '../experience/timeline-ui.mjs';
// the timeline as laid out: a viewport at client x 0, 1250 px wide; the content zoom × the viewport, its first 150 px the
// lane labels (sticky in the page, part of the scroll width); the ruler is the rest of the content
const VIEW=1250,LABEL=150,SECONDS=23.5,FRAME=1/30;
const layout=(zoom,scroll)=>{const width=VIEW*zoom;return {scrollWidth:width,ruler:{left:LABEL-scroll,width:width-LABEL}};};
const timeAt=(zoom,scroll,x)=>{const r=layout(zoom,scroll).ruler;return (x-r.left)/r.width*SECONDS;};
// the old way: a fraction of the scroll width
const oldWay=(from,to,scroll,x)=>{const frac=(scroll+x)/layout(from,scroll).scrollWidth;return Math.max(0,frac*layout(to,0).scrollWidth-x);};
// the new way: the ruler before, the ruler after the rebuild (which put back the same scroll first)
const newWay=(from,to,scroll,x)=>rulerAnchorScroll({scroll,x,before:layout(from,scroll).ruler,after:layout(to,scroll).ruler});
// Windows' case: 3956 -> 7207 px, the pointer at 60 % of the lanes
{
  const from=3956/VIEW,to=7207/VIEW,x=LABEL+(VIEW-LABEL)*.6,scroll=900,t0=timeAt(from,scroll,x);
  const drift=Math.abs(timeAt(to,oldWay(from,to,scroll,x),x)-t0),held=Math.abs(timeAt(to,newWay(from,to,scroll,x),x)-t0);
  assert.ok(drift>FRAME/2,`(the old way drifted ${(drift*1000).toFixed(1)} ms: what Windows saw)`);
  assert.ok(held<1e-9,`the new way holds the time under the pointer (${held})`);
}
// any zoom in or out, anywhere on the lanes, from any scroll that leaves room: within a frame (exact in this model)
for(const [from,to] of [[1,1.5],[1.5,1],[2,8],[8,2],[3.2,3.3],[12,30]])for(const p of [.05,.3,.6,.95])for(const s of [0,.25,.5]){
  const x=LABEL+(VIEW-LABEL)*p,scroll=Math.min(layout(from,0).scrollWidth-VIEW,s*layout(from,0).scrollWidth),t0=timeAt(from,scroll,x),to_=newWay(from,to,scroll,x);
  if(to_>layout(to,0).scrollWidth-VIEW||to_<=0)continue;     // (at a scroll edge the browser clamps: nothing can hold it)
  assert.ok(Math.abs(timeAt(to,to_,x)-t0)<FRAME/100,`${from}× -> ${to}× at ${p}: ${timeAt(to,to_,x)} vs ${t0}`);
}
// the UI scale: client px × k = CSS px
assert.equal(rulerAnchorScroll({scroll:100,x:500,before:{left:0,width:1000},after:{left:-100,width:2000},k:1.25}),100+(-100+.5*2000-500)*1.25);
assert.equal(rulerAnchorScroll({scroll:0,x:10,before:null,after:{left:0,width:1}}),null,'no ruler: the caller falls back');
assert.equal(rulerAnchorScroll({scroll:0,x:400,before:{left:0,width:1000},after:{left:0,width:500}}),0,'never below 0');
// director.mjs uses it, after the rebuild, with the ruler's boxes
{
  const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8').replace(/\r/g,'');
  const fn=/function setZoom\(next,anchorPx=null\)\{[^]*?\n  \}/.exec(src)?.[0]||'';assert.ok(fn,'setZoom is there');
  assert.match(fn,/const r0=v\.querySelector\('\.time-ruler'\)\?\.getBoundingClientRect\(\)/,'the ruler before');
  assert.match(fn,/r1=n\.querySelector\('\.time-ruler'\)\?\.getBoundingClientRect\(\)/,'the ruler after the rebuild');
  assert.ok(fn.indexOf('renderTimeline()')<fn.indexOf('r1='),'measured after renderTimeline');
  assert.match(fn,/rulerAnchorScroll\(\{scroll:n\.scrollLeft,x,before:r0,after:r1,k\}\)/,'and anchored on it');
  assert.match(src,/setZoom\(zoom\*Math\.exp\(-event\.deltaY\*\.0025\),event\.clientX-v\.getBoundingClientRect\(\)\.left\)/,'Ctrl+wheel passes the pointer');
}
console.log('timeline-zoom-anchor-test: ok (the time under the pointer stays put through any zoom; the old way drifted about a frame)');
