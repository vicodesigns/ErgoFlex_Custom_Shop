// Side shelving props (tools/props/import-side-shelving.mjs, side-shelving.mjs): the 7 library entries and their GLBs,
// the roles each carries, and the desk match (wood follows the desk's material, the print plastic its trim colour).
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {isSideShelving,styleSideShelving,syncDeskMatch} from '../side-shelving.mjs';
const root=path.resolve(import.meta.dirname,'..'),index=JSON.parse(fs.readFileSync(path.join(root,'assets/props/index.json'))).props;
const want={'ergoflex-side-shelf-large':['wood'],'ergoflex-side-shelf-small':['wood'],'ergoflex-side-shelf-large-pair':['wood'],'ergoflex-side-shelf-small-pair':['wood'],
  'ergoflex-side-cup-holder':['wood','acrylic'],'ergoflex-side-shelf-large-cubby':['wood','acrylic','print'],'ergoflex-side-shelf-small-cubby':['wood','acrylic','print']};
const io=new NodeIO();
for(const [id,roles] of Object.entries(want)){
  const e=index.find(p=>p.id===id);assert(e,id+' is in the library index');assert.equal(e.category,'shelving');assert(isSideShelving(id));
  assert(e.size[1]<100&&e.size[0]>100,id+' size in mm: '+e.size);
  const doc=await io.read(path.join(root,e.file)),names=doc.getRoot().listMaterials().map(m=>m.getName());
  for(const r of roles)assert(names.includes('Side shelf '+r),id+' has the '+r+' role: '+names);
  assert.equal(names.length,roles.length,id+' has only its roles');
}
// the desk match on a styled wood + print instance
const g=new THREE.Group();
for(const [name,flag] of [['Side shelf wood'],['Side shelf print'],['Side shelf acrylic']]){const m=new THREE.MeshStandardMaterial({color:'#336699'});m.name=name;g.add(new THREE.Mesh(new THREE.BufferGeometry(),m));}
styleSideShelving(g);const [wood,print,acrylic]=g.children;
assert(wood.userData.artistShelfWood&&!print.userData.artistShelfWood&&print.userData.deskTrimPlastic&&acrylic.material.transparent);
const desk=new THREE.MeshPhysicalMaterial({color:'#8b5a2b'});syncDeskMatch(g,{wood:desk,trim:'#e8702a'});
assert.equal(wood.material.color.getHexString(),'8b5a2b');assert.equal(print.material.color.getHexString(),'e8702a');assert.equal(acrylic.material.color.getHexString(),'eef6f8');
desk.color.set('#222222');desk.version++;syncDeskMatch(g,{wood:desk,trim:'#dc0909'});
assert.equal(wood.material.color.getHexString(),'222222');assert.equal(print.material.color.getHexString(),'dc0909');
console.log('side shelving: 7 library props with their roles (wood / acrylic / print); the wood follows the desk\'s finish, the print the trim colour, the acrylic stays clear: OK');
