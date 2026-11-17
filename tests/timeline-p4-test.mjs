// P4 timeline helpers (timeline-ui.mjs): continuous zoom limits, zoom at the pointer, the film timecode, markers and
// the loop range.
import assert from 'node:assert/strict';
import {maxZoom,clampZoom,zoomScroll,filmTimecode,nextMarker,toggleMarker,setLoopEnd} from '../experience/timeline-ui.mjs';
assert.equal(maxZoom(10,1500),8,'at least 8x');assert.ok(Math.abs(maxZoom(48,1400)-48*30*20/1400)<1e-9,'about 20 px a frame');
assert.equal(clampZoom(.5,18,1400),1);assert.equal(clampZoom(1000,18,1400),maxZoom(18,1400));
assert.equal(zoomScroll({scroll:0,x:500,from:1,to:2,lane:1000}),500,'the time under the pointer stays');
assert.equal(zoomScroll({scroll:300,x:200,from:2,to:1,lane:1000}),50);
assert.equal(filmTimecode(7.6,{start:43.35}),'film 0:50.95');
assert.equal(filmTimecode(3,{start:0,bars:[0,2],beats:[{t:0},{t:.5},{t:1},{t:1.5},{t:2},{t:2.5},{t:3}]}),'film 0:03.00 · bar 2.3');
assert.equal(filmTimecode(1),'');
assert.equal(nextMarker([2,5,9],5,1),9);assert.equal(nextMarker([2,5,9],5,-1),2);assert.equal(nextMarker([2],2,1),undefined);
assert.deepEqual(toggleMarker([1,3],2),[1,2,3]);assert.deepEqual(toggleMarker([1,2,3],2.01),[1,3],'M on a marker removes it');
assert.deepEqual(setLoopEnd(null,'start',4,18),{start:4,end:18});
assert.deepEqual(setLoopEnd({start:4,end:18},'end',9,18),{start:4,end:9});
assert.deepEqual(setLoopEnd({start:4,end:9},'start',12,18),{start:12,end:17},'a start past the end keeps the length');
console.log('timeline-p4-test: ok');
