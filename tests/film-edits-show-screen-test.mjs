// film-edits.mjs installShow without a browser: a timed prop's fade takes the film's own screen picture on it too
// (18 Nov 2026: a monitor with a Director fade faded its body while film-fx's 'Film screen · main-landscape' mesh, flagged
// filmFx, stayed whole, so the Director's still and the film drew 99 % of it at the fade's midpoint). Other film-fx meshes
// under the prop are still left alone; the picture keeps its own texture (a playing clip keeps playing); outside the fade
// it wears its own material again; hidden outside the window as before.
//   node tests/film-edits-show-screen-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';

const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
globalThis.window={ErgoFlex:{loadedModel:desk,roomScene:'creative'}};
const {installEdits}=await import('../tools/experience/film-edits.mjs');
const monitor=new THREE.Group();monitor.name='Accessory:flat-monitor';desk.add(monitor);
const body=new THREE.Mesh(new THREE.BoxGeometry(1,.6,.04),new THREE.MeshStandardMaterial({color:'#222'}));body.name='Bezel';
const panel=new THREE.Mesh(new THREE.PlaneGeometry(.9,.5),new THREE.MeshStandardMaterial({color:'#000'}));panel.name='Screen';monitor.add(body,panel);
// as film-fx.mjs installScreens adds it: under the screen object, flagged filmFx and filmScreen
const clip=new THREE.Texture(),pictureMat=new THREE.MeshBasicMaterial({map:clip,toneMapped:false});
const picture=new THREE.Mesh(new THREE.PlaneGeometry(.9,.5),pictureMat);picture.name='Film screen · main-landscape';picture.userData.filmFx=true;picture.userData.filmScreen=true;panel.add(picture);
// another film-fx mesh under the prop (a status light, say): not the fade's
const otherMat=new THREE.MeshBasicMaterial({color:'#0f0'}),other=new THREE.Mesh(new THREE.PlaneGeometry(.1,.1),otherMat);other.name='Film status';other.userData.filmFx=true;monitor.add(other);

const fx=installEdits({id:'create',sceneEdits:[{match:'^Accessory:flat-monitor$',show:{from:0,to:10,fadeIn:0,fadeOut:1}}]});
assert.deepEqual(fx.count,[1]);
const op=m=>m.material.opacity;
fx.apply(5);
assert.equal(picture.material,pictureMat,'before the fade: the picture wears its own material');
assert.equal(op(body),1);
fx.apply(9.5);   // the fade's midpoint (linear): 0.5
assert.notEqual(picture.material,pictureMat,'in the fade the picture wears a see-through copy');
assert.equal(op(picture),.5,'the picture fades with the prop');assert.equal(op(body),.5);assert.equal(op(panel),.5);
assert.ok(picture.material.transparent&&picture.material.userData.filmFxCopy);
assert.equal(picture.material.map,clip,'the copy shares the clip texture: a playing screen keeps playing');
assert.equal(picture.material.toneMapped,false,'and keeps the picture\'s own settings');
assert.equal(other.material,otherMat,'a film-fx mesh that is not a screen picture is left alone');
assert.equal(pictureMat.opacity,1,'the picture\'s own material is untouched');
fx.apply(9.75);assert.equal(op(picture),.25);
fx.apply(10.5);assert.equal(monitor.visible,false,'after the window it is not drawn');assert.equal(picture.material,pictureMat,'and the picture is back on its own material');
fx.apply(3);assert.equal(monitor.visible,true);
fx.apply(9.5);fx.restore();
assert.equal(picture.material,pictureMat,'restore puts the picture\'s material back');assert.equal(body.material.opacity,1);
console.log('film-edits show screen test: passed (a fading prop fades the film\'s screen picture on it; other film-fx meshes left alone)');
