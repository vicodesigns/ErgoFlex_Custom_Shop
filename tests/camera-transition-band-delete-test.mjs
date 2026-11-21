// Delete on a camera transition band removes the TRANSITION only, never the camera key (Windows e2e, 20 Nov 2026: the band's
// edge drag also started the timeline's marquee, which swept the key under the band into the group picks; Delete on the
// band then reached the group picks' own Delete first (document, capture) and deleted the key: "Deleted 1 item", 10 keys
// to 9, nothing selected, Ctrl+D had nothing to copy).
//   1. the model: back to a move keeps every key, its place and its id; one commit = one undo step
//   2. director.mjs wiring: no marquee from a band; the group picks' Delete skips a focused band; a band click clears the
//      picks and selects its key; the band's Delete clears the picks, keeps (selects) its key and commits once
//   node tests/camera-transition-band-delete-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTransition} from '../experience/camera-transitions.mjs';

// ---- 1
{
  const V=x=>({position:[x,1,5],target:[x,1,0],fov:35,aspect:16/9});
  const keys=[0,.2,.5,.8,1].map((t,i)=>({id:'k'+i,time:t,label:'K'+i,easing:'linear',view:V(i),transition:i===2?{type:'dissolve',dur:.8}:null}));
  const after=setTransition(keys,'k2',{type:'move'},20);
  assert.equal(after.length,keys.length,'no key goes');
  assert.deepEqual(after.map(k=>[k.id,k.time,k.view]),keys.map(k=>[k.id,k.time,k.view]),'every key keeps its id, time and view');
  assert.equal(after[2].transition,null,'only the transition is gone (explicitly none: a plan cut stays removed)');
  assert.deepEqual(after.filter((k,i)=>i!==2),keys.filter((k,i)=>i!==2),'the other keys are untouched');
}
// ---- 2
{
  const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8').replace(/\r/g,'');
  const body=(start,end='\n  }')=>{const i=src.indexOf(start);assert.ok(i>=0,'found: '+start.slice(0,60));return src.slice(i,src.indexOf(end,i+start.length));};
  // the marquee never starts on a band
  assert.match(src,/\.lane-group-head,\.choreo-others,\[data-cam-transition\]'\)\)return;\n    event\.preventDefault\(\);viewport\(\)\.focus\(\{preventScroll:true\}\);/,'no marquee from a transition band');
  // the group picks' Delete (document, capture) leaves a focused band to its own handler
  assert.match(src,/if\(target\.closest\?\.\('\[data-cam-transition\]'\)\)return;   \/\/ \(a focused transition band/,'the group picks\' Delete skips a band');
  // a band click: picks cleared, its key selected
  assert.match(src,/const band=event\.target\.closest\?\.\('\[data-cam-transition\]'\);if\(!band\|\|event\.button!==0\)return;[^]*?clearPicks\(\);if\(keyId!==id\)selectKey\(id\);/,'a band click clears the picks and selects its key');
  // the band's Delete: the transition only, the key kept and selected, one commit
  const del=body("const band=event.target.closest?.('[data-cam-transition]');if(!band||!['Delete','Backspace']",'},true);');
  assert.match(del,/event\.preventDefault\(\);event\.stopImmediatePropagation\(\);/);
  assert.match(del,/clearPicks\(\);if\(keyId!==id\)selectKey\(id\);putTransition\(id,\{type:'move'\}\);/,'picks cleared, the key selected, back to a move');
  assert.doesNotMatch(del,/key-delete|deletePicks|deleteSelection/,'never deletes a key');
  const put=body('  function putTransition(id,value){');
  assert.equal((put.match(/commit\(/g)||[]).length,1,'putTransition commits once: one undo step');
  assert.doesNotMatch(put,/keyId=null/,'and keeps the selection');
}
console.log('camera-transition-band-delete-test: ok (Delete on a band: the transition only, the key kept and selected, one undo step; no marquee from a band; the group picks\' Delete skips it)');
