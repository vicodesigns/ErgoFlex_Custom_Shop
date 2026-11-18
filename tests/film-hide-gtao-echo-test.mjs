// A hidden desk (film-desk-edits.mjs hideDesk) and a prop hide edit (film-edits.mjs, hide:true) come back when the hide is
// taken away, even though a pass cached and restored every object's `visible` while they were hidden (18 Nov 2026: three's
// GTAOPass, on in the film's hq13 quality, does overrideVisibility / restoreVisibility around its normal pass; the getter's
// false written back through the setter became the object's own state, so in the Director's Render still / Film look a desk
// hidden with the Layers eye, or a prop hidden with Hide, stayed missing after Undo or showing it again, until a reload).
// The film itself never un-hides (each render starts fresh), so this changes no film pixels.
//   node tests/film-hide-gtao-echo-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';

const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
globalThis.window={ErgoFlex:{loadedModel:desk,roomScene:'creative'}};
const {installEdits}=await import('../tools/experience/film-edits.mjs');
const {hideDesk,unhideDesk}=await import('../tools/experience/film-desk-edits.mjs');
// GTAOPass.js overrideVisibility / restoreVisibility, as three has them
const cache=new Map();
const gtao=()=>{scene.traverse(o=>{cache.set(o,o.visible);if(o.isPoints||o.isLine)o.visible=false;});scene.traverse(o=>{o.visible=cache.get(o);});cache.clear();};

// 1. hidden desk: the second desk hidden with the Layers eye, a few film-quality frames, then Undo
{const group=new THREE.Group();group.name='Room desk 2';group.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));scene.add(group);
  const entry={record:{group}};
  assert.equal(hideDesk(entry),true);
  for(let i=0;i<3;i++){gtao();assert.equal(group.visible,false,'hidden while the hide holds');}
  group.visible=true;gtao();assert.equal(group.visible,false,'the app setting it back each frame does not show it');
  unhideDesk(entry);
  assert.equal(group.visible,true,'Undo the hide: the desk is drawn again (it stayed missing in Render still)');
  gtao();assert.equal(group.visible,true);
  group.removeFromParent();}

// 2. a desk the app itself had hidden before the hide stays hidden after it
{const group=new THREE.Group();group.name='Stowed desk';scene.add(group);group.visible=false;
  const entry={record:{group}};hideDesk(entry);gtao();unhideDesk(entry);
  assert.equal(group.visible,false,'its own state (hidden) comes back');group.removeFromParent();}

// 3. a prop hide edit: the potted fern hidden, film-quality frames, then shown again (the edit taken away)
{const fern=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());fern.name='Potted fern';scene.add(fern);
  let fx=installEdits({id:'create',sceneEdits:[{match:'^Potted fern$',hide:true}]});
  for(let t=0;t<3;t++){fx.apply(t);gtao();assert.equal(fern.visible,false,'hidden while the edit holds');}
  fx.restore();
  assert.equal(fern.visible,true,'the hide taken away: the fern is drawn again (it stayed missing in Render still)');
  fx=installEdits({id:'create',sceneEdits:[]});fx.apply(1);gtao();assert.equal(fern.visible,true);fx.restore();
  // hide, then a later edit shows it again (hide:false over a sticky hide): drawn, through the passes too
  fx=installEdits({id:'create',sceneEdits:[{match:'^Potted fern$',hide:true},{match:'^Potted fern$',hide:false}]});
  fx.apply(0);gtao();gtao();assert.equal(fern.visible,true,'hide then hide:false: drawn');fx.restore();assert.equal(fern.visible,true);
  fern.removeFromParent();}

// 4. the app's own true while hidden is still remembered (desk dressing sets visible back each frame)
{const lamp=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());lamp.name='Lamp';lamp.visible=false;scene.add(lamp);
  const fx=installEdits({id:'create',sceneEdits:[{match:'^Lamp$',hide:true}]});fx.apply(0);
  lamp.visible=true;gtao();fx.restore();assert.equal(lamp.visible,true,'set true by its own code while hidden: shown after');lamp.removeFromParent();}
console.log('film hide gtao echo test: passed (a hidden desk and a prop hide come back when taken away, with GTAO caching visibility every frame)');
