// film-edits.mjs installShow without a browser: a timed prop comes back when its window opens even though a pass caches
// and restores every object's `visible` while the window is shut (18 Nov 2026: three's GTAOPass, on in the film's hq13
// quality, does overrideVisibility / restoreVisibility around its normal pass; the getter's false written back through the
// setter became the prop's own state, so a room prop timed in the Director stayed hidden in Render still after its window
// opened again, and a prop that appears later in a chapter would never appear in a quality render).
//   node tests/film-edits-show-gtao-echo-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';

const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
globalThis.window={ErgoFlex:{loadedModel:desk,roomScene:'storage'}};
const {installEdits}=await import('../tools/experience/film-edits.mjs');
// GTAOPass.js overrideVisibility / restoreVisibility, as three has them
const cache=new Map();
const gtao=()=>{scene.traverse(o=>{cache.set(o,o.visible);if(o.isPoints||o.isLine)o.visible=false;});scene.traverse(o=>{o.visible=cache.get(o);});cache.clear();};
const prop=()=>{const g=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());g.name='Smart robot figure';scene.add(g);return g;};

// 1. appears later (from 2.5 s): hidden before, drawn after, with the pass on every frame
{const robot=prop();
  const fx=installEdits({id:'storage',sceneEdits:[{match:'^Smart robot figure$',show:{from:2.5,to:25}}]});
  for(const t of [0,1,2,2.4]){fx.apply(t);gtao();assert.equal(robot.visible,false,`hidden at ${t} s`);}
  for(const t of [2.6,5,12]){fx.apply(t);gtao();assert.equal(robot.visible,true,`drawn at ${t} s after the window opens (the pass's echo of false is not its own state)`);}
  // a fade in: drawn and see-through through it
  fx.restore();assert.equal(robot.visible,true,'restore: shown as before the edit');robot.removeFromParent();}

// 2. the Director's in-place update: hidden at the moment (G), then the whole time again (F): drawn
{const stool=prop();stool.name='Room stool';
  let fx=installEdits({id:'create',sceneEdits:[{match:'^Room stool$',show:{from:0,to:1}}]});
  fx.apply(2);gtao();assert.equal(stool.visible,false,'out of its window: hidden');
  fx.restore();fx=installEdits({id:'create',sceneEdits:[]});fx.apply(2);gtao();
  assert.equal(stool.visible,true,'the edit taken away: drawn again (it stayed hidden in the still stage)');
  fx.restore();stool.removeFromParent();}

// 3. a real hide while the window is open still holds, and the window still hides it
{const lamp=prop();lamp.name='Lamp';
  const fx=installEdits({id:'x',sceneEdits:[{match:'^Lamp$',show:{from:0,to:10}}]});
  fx.apply(5);gtao();assert.equal(lamp.visible,true);
  lamp.visible=false;fx.apply(5);gtao();assert.equal(lamp.visible,false,'hidden by its own code inside the window: stays hidden');
  lamp.visible=true;fx.apply(5);assert.equal(lamp.visible,true);
  fx.apply(11);gtao();assert.equal(lamp.visible,false,'after the window');
  fx.restore();assert.equal(lamp.visible,true,'restore: its own state, shown');}
console.log('film-edits show gtao echo test: passed (a timed prop comes back when its window opens, with GTAO caching visibility every frame)');
