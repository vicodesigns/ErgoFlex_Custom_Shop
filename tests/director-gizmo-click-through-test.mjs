// A still press on the selected prop's gizmo is a click on what is under it (19 Nov 2026, Windows: APA desk, stored
// supply 8 sat under stored supply 1's gizmo and neither a click nor Alt+clicks reached it). Two things in three's
// TransformControls (0.163, the stage's) broke the click through, checked here on the real class:
//   1. its hover axis only follows pointermove: with the pointer resting while the camera moved (or a pick put the gizmo
//      under it) it is stale, and the prop editor read it at the press as "not on the gizmo", while TransformControls
//      hovers again as it takes the press and starts a drag; the prop editor then dropped the click as a drag
//   2. it says objectChange on every pointermove while it holds the press, one that goes nowhere too, so "moved" must be
//      the object really moving, not objectChange
// and the prop editor's answers (scene-prop-editor.mjs): hover at the press, moved = posedAway from the drag's start pose.
//   node tests/director-gizmo-click-through-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
globalThis.document??={pointerLockElement:null};
const dom={style:{},addEventListener(){},removeEventListener(){},setPointerCapture(){},releasePointerCapture(){},ownerDocument:{}};
const cam=new THREE.PerspectiveCamera(50,4/3,.01,100);cam.position.set(0,0,3);cam.lookAt(0,0,0);cam.updateMatrixWorld();
const scene=new THREE.Scene(),o=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1));scene.add(o);
const g=new TransformControls(cam,dom);scene.add(g);g.attach(o);g.setSpace('world');scene.updateMatrixWorld(true);
let changes=0;g.addEventListener('objectChange',()=>changes++);
let at=null;for(let x=-.3;x<=.3&&!at;x+=.005)for(let y=-.3;y<=.3&&!at;y+=.005){g.pointerHover({x,y,button:0});if(g.axis&&g.axis.length===1)at={x,y,axis:g.axis};}
assert.ok(at,'an arrow of the gizmo on screen');
// 1. a stale hover says "no axis"; hovering at the press finds the arrow, and TransformControls takes the press as a drag
g.axis=null;g.pointerHover({...at,button:0});assert.equal(g.axis,at.axis,'read at the press, the arrow is there');
const pose={p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()};g.pointerDown({...at,button:0});g.dragging=true;
// 2. a pointermove that goes nowhere: objectChange, but the object is where it was
const before=changes;g.pointerMove({...at,button:-1});
assert.ok(changes>before,'TransformControls says objectChange for a move that goes nowhere');
const ed=readFileSync(new URL('../experience/scene-prop-editor.mjs',import.meta.url),'utf8').replace(/\r/g,'');
const posedAway=new Function('return '+/const posedAway=([^;]*);/.exec(ed)[1])();
assert.equal(posedAway(o,pose),false,'and posedAway says it did not move');
o.position.x+=.01;assert.equal(posedAway(o,pose),true,'a real move is one');o.position.copy(pose.p);
o.rotateY(.01);assert.equal(posedAway(o,pose),true,'so is a turn');
g.pointerUp({...at,button:0});
// the wiring
assert.match(ed,/dom\.addEventListener\('pointerdown',ev=>\{gizmoMoved=false;if\(ev\.button===0&&!placing&&gizmo\.enabled&&gizmo\.object&&!gizmo\.dragging\)\{[^}]*gizmo\.pointerHover\(/,'the prop editor hovers the gizmo at the press, before reading its axis');
assert.match(ed,/drag=\{enabled:t\.controls\.enabled,obj:gizmo\.object,from:poseOf\(gizmo\.object\)\}/,'a drag keeps its start pose');
assert.match(ed,/addEventListener\('objectChange',\(\)=>\{if\(drag&&!drag\.moved&&\(!drag\.from\|\|posedAway\(gizmo\.object,drag\.from\)\)\)drag\.moved=gizmoMoved=true;/,'moved only when it really moved');
assert.ok(!/gizmoMoved=true;if\(drag\)drag\.moved=true;/.test(ed),'(not on every objectChange)');
// the click trace (read-only, the stage window's __directorClickTrace): the press, the pointerup, the click through, the pick
for(const e of ['down','up','through','inside','not-this-desk','second-click','locked'])assert.match(ed,new RegExp(`trace\\(\\{e:'${e}'`),'the trace notes '+e);
assert.match(ed,/const a=w\.__directorClickTrace\|\|=\[\];[^;]*;if\(a\.length>16\)a\.shift\(\);/,'the last 16 steps');
console.log('director-gizmo-click-through-test: ok (a still press on the gizmo: hover read at the press, objectChange without a move is no move)');
