// film-edits.mjs sceneEdits clone:true without a browser: two edits that recolour two props sharing one library material
// each get a copy of their own. Oilers (ch6) closes the room with two kenney-furniture-paneling props, a charcoal
// wainscot and an orange rail; the copies used to be shared across edits, so the rail's orange painted the wainscot
// too and the front wall did not match the room's charcoal dado. Copies made only to go physical (clearcoat) are
// still shared across edits, and restore() puts every material back and disposes every copy.
//   node tests/film-edits-clone-test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';

const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
globalThis.window={ErgoFlex:{loadedModel:desk,roomScene:'highschool'}};
const {installEdits}=await import('../tools/experience/film-edits.mjs');
const shared=new THREE.MeshStandardMaterial({color:'#8a6a4a',roughness:.5});   // one library material, as the GLB cache hands out
const prop=name=>{const g=new THREE.Group();g.name=name;g.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,.05),shared),new THREE.Mesh(new THREE.BoxGeometry(1,.1,.05),shared));scene.add(g);return g;};
const wainscot=prop('Added prop:kenney-furniture-paneling#oilwn'),rail=prop('Added prop:kenney-furniture-paneling#oilrl');
const hex=o=>o.children.map(m=>'#'+m.material.color.getHexString());
const fx=installEdits({sceneEdits:[
  {match:'^Added prop:kenney-furniture-paneling#oilwn$',clone:true,material:{color:'#2a2c30',roughness:.8}},
  {match:'^Added prop:kenney-furniture-paneling#oilrl$',clone:true,material:{color:'#e8721c',roughness:.6}}]});
assert.deepEqual(fx.count,[1,1]);
assert.deepEqual(hex(wainscot),['#2a2c30','#2a2c30'],'the wainscot keeps its charcoal (it used to come out orange)');
assert.deepEqual(hex(rail),['#e8721c','#e8721c'],'the rail is orange');
assert.notEqual(wainscot.children[0].material,rail.children[0].material,'each edit has its own copy');
assert.equal(wainscot.children[0].material,wainscot.children[1].material,'one copy per material within an edit');
assert.equal(wainscot.children[0].material.roughness,.8);assert.equal(rail.children[0].material.roughness,.6);
assert.equal('#'+shared.color.getHexString(),'#8a6a4a','the library material itself is untouched');
const copies=[wainscot.children[0].material,rail.children[0].material];let disposed=0;for(const c of copies)c.addEventListener('dispose',()=>disposed++);
fx.restore();
assert.equal(wainscot.children[0].material,shared);assert.equal(rail.children[1].material,shared);assert.equal(disposed,2,'restore disposes both copies');

// Physical copies (clearcoat on a standard material, no clone): still one copy per material for all edits, as before.
const a=prop('Wheel_F_L'),b=prop('Desktop');
const fx2=installEdits({sceneEdits:[{match:'^Wheel_F_L$',material:{clearcoat:.3}},{match:'^Desktop$',material:{clearcoat:.25}}]});
assert.ok(a.children[0].material.isMeshPhysicalMaterial,'went physical');
assert.equal(a.children[0].material,b.children[0].material,'physical copies stay shared across edits (unchanged behaviour)');
fx2.restore();assert.equal(a.children[0].material,shared);
console.log('film-edits clone test: passed');
