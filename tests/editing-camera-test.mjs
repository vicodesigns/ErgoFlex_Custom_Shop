// The Director's Editing camera (experience/editing-camera.mjs, stage.mjs, director.mjs; 19 Nov 2026), without a browser:
//   1. cameraFollows: the camera keys drive the camera unless the Editing camera holds it; a bake always films the keys
//   2. poseOf / putPose: a view taken and put back exactly (camera, orbit pivot, field of view, zoom, up)
//   3. the stage: cam() asks cameraFollows; holdCamera(false) puts the camera back on the keys at the playhead at once;
//      a re-prepared chapter keeps the held view; a bake films the keys and gives the held view back after; orbit / pan /
//      zoom stay live while playing with the camera held (editCamera)
//   4. the Director: a per-browser preference in the UI store, never in the cut (cleanCut drops it), the export or the
//      film; Shift+C, the app bar, the status pill, the view's pill, the pose bar's one-click hint; 0 turns it off; Go to
//      this view goes there and holds it; Preview camera move says why it does not move; playback stays live (no bake)
//   node tests/editing-camera-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {cameraFollows,poseOf,putPose,PREF} from '../experience/editing-camera.mjs';
import {cleanCut,makeCut} from '../experience/cuts.mjs';
import {ACTIONS} from '../experience/director-actions.mjs';
import {appBarHtml} from '../experience/director-appbar.mjs';
// 1
assert.equal(cameraFollows(),true,'nothing held: the keys drive the camera');
assert.equal(cameraFollows({held:true}),false,'held: they do not');
assert.equal(cameraFollows({held:true,baking:true}),true,'a bake films the keys whatever is held');
assert.equal(cameraFollows({held:false,baking:true}),true);
// 2
const cam=new THREE.PerspectiveCamera(40,16/9,.01,100),controls={target:new THREE.Vector3(1,1.2,-3)};
cam.position.set(2,1.6,4);cam.lookAt(controls.target);cam.zoom=1.25;cam.updateProjectionMatrix();
const held=poseOf(cam,controls),was=JSON.stringify(held);
cam.position.set(-5,3,1);cam.lookAt(0,0,0);controls.target.set(0,0,0);cam.fov=60;cam.zoom=1;   // the keys move it (a prepare, a bake)
putPose(cam,controls,held);
assert.equal(JSON.stringify(poseOf(cam,controls)),was,'the held view comes back exactly');
{const ref=new THREE.PerspectiveCamera(40,16/9,.01,100);ref.zoom=1.25;ref.updateProjectionMatrix();assert.deepEqual(cam.projectionMatrix.elements,ref.projectionMatrix.elements,'with its projection');}
putPose(cam,controls,null);assert.equal(JSON.stringify(poseOf(cam,controls)),was,'(no pose: nothing moves)');
// 3
const st=readFileSync(new URL('../experience/stage.mjs',import.meta.url),'utf8');
assert.match(st,/function cam\(t\) \{\n    if\(!start\|\|editorMode\|\|!cameraFollows\(\{held:cameraHeld,baking:!!bakeSession\}\)\)return;/,'cam() leaves a held camera alone, except in a bake');
assert.match(st,/function holdCamera\(on\)\{[^]*?if\(was&&!cameraHeld&&shot\)\{const p=paused,e=editorMode;paused=false;editorMode=false;cam\(lastProgress\);/,'off: back on the keys at the playhead at once');
assert.match(st,/prepare:async next=>\{preparing=true;const held=cameraHeld\?poseOf\(ctx\.camera,ctx\.controls\):null;cameraHeld=false;try\{return await prepare\(next\);\}finally\{preparing=false;if\(held\)\{cameraHeld=true;putPose\(ctx\.camera,ctx\.controls,held\);/,'a re-prepared chapter keeps the held view (prepare itself still reads the keys\' views)');
assert.match(st,/heldBeforeBake=cameraHeld\?poseOf\(ctx\.camera,ctx\.controls\):null;bakeSession=/,'a bake notes the held view…');
assert.match(st,/if\(heldBeforeBake\)\{putPose\(ctx\.camera,ctx\.controls,heldBeforeBake\);heldBeforeBake=null;\}/,'…and gives it back after');
assert.match(st,/function edit\(on\)\{wake\(\);editorMode=!!on;ctx\.editCamera\(editorMode\|\|cameraHeld\);/,'orbit stays live while playing with the camera held');
assert.match(st,/holdCamera,cameraHeld:\(\)=>cameraHeld,/,'the stage\'s API');
// 4
const dir=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8');
assert.match(dir,/var held=!!loadUi\(\)\[HOLD_PREF\]/,'a per-browser preference (the Director\'s UI store)');
assert.match(dir,/const holdWanted=\(\)=>held&&open&&!document\.body\.classList\.contains\('df-review'\);/,'held only while the Director is open and not in Review mode (the film always plays on its keys)');
assert.match(dir,/setInterval\(\(\)=>\{syncHold\(\);navViews\.hidden=!open;/,'checked whether the Director is open or not');assert.equal(PREF,'holdCamera');
assert.ok(!/(shot\(\)|project|x)\.holdCamera|holdCamera:held\b/.test(dir),'never written into the cut');
const cut=makeCut('Test');cut.holdCamera=true;cut.shots[0].holdCamera=true;
const clean=cleanCut(JSON.parse(JSON.stringify(cut)),null);assert.ok(!('holdCamera' in clean)&&!('holdCamera' in clean.shots[0]),'and the cut cleaner (export, drafts) would drop it anyway');
const row=ACTIONS.find(a=>a.id==='hold-camera');assert.deepEqual(row?.keys,['Shift+C'],'Shift+C');
assert.ok(!ACTIONS.some(a=>a.id!=='hold-camera'&&a.keys.includes('Shift+C')),'nobody else\'s Shift+C');
assert.match(dir,/case 'hold-camera':setHold\(!held\);return;/);
assert.match(dir,/case 'film-camera':if\(held\)\{setHold\(false,/,'0 (back to the film camera) turns it off');
assert.match(dir,/if\(name==='key-go'\)\{const k=selectedKey\(\);if\(!k\)return;if\(held\)\{bridge\.stage\(\)\?\.holdCamera\?\.\(false\);seekCamera\(k\.time\);bridge\.stage\(\)\?\.holdCamera\?\.\(true\);/,'Go to this view goes there and holds it');
assert.match(dir,/if\(name==='key-preview'\)\{\n        if\(held\)\{status\(/,'Preview camera move says why it does not move');
assert.match(dir,/if\(held\)\{if\(bridge\.bakeState\(\)\.enabled\)\{heldBaked=true;bridge\.useBaked\(false\);\}\}/,'playback stays live (a preview video shows the keys\' camera)');
assert.match(dir,/\{id:'held',label:'● Editing camera',on:held,warn:true/,'the status pill');
assert.match(dir,/navPill\.innerHTML=held\?'● Editing camera · the view stays put/,'the pill on the view');
const on=appBarHtml({held:true}),off=appBarHtml({held:false});
assert.match(on,/class="ab-btn ab-hold on" data-action="hold-camera" aria-pressed="true"[^>]*>● Editing camera</,'the app bar: on, and plain to see');
assert.match(off,/data-action="hold-camera" aria-pressed="false"[^>]*>Editing camera</);
const pose=readFileSync(new URL('../experience/scene-pose-editor.mjs',import.meta.url),'utf8');
assert.match(pose,/\$\{cameraHeld\(\)\?'<span class="pose-held"[^>]*>● Camera held<\/span>':'<button type="button" data-action="hold-camera"[^>]*>Hold camera while posing<\/button>'\}/,'the pose bar: a one-click hint, never turned on by itself');
console.log('editing-camera-test: ok (the keys drive the camera unless it is held; held views survive prepare and bakes; never in the cut)');
