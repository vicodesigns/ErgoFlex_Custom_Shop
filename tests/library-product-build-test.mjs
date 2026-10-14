import assert from 'node:assert/strict';
import { applyLibraryProductBuild } from '../library-product-build.mjs';
import { cleanBuildPresets } from '../build-presets.mjs';
import { cleanSceneDeskData } from '../scene-desk-data.mjs';
const entry=cleanBuildPresets(null).entries.library;
for(const draft of [entry,...Object.values(entry.sizeSetups)]){
 draft.revision=draft.config.size==='48x30'?4:7;
 // The source artwork schema is also exercised in the renderer regression.
 const state={size:draft.config.size,name:'Reading desk',pose:{x:120,z:360,yaw:.3},height:42,tilt:-5,lights:{enabled:false},phases:{night:{pose:{x:120,z:400,yaw:.4},height:40,tilt:5,lights:{enabled:true},recording:[]}},objects:{}};
 const position=structuredClone([state.pose,state.phases,state.height,state.lights]);
 assert.equal(applyLibraryProductBuild(state,entry),true);
 assert.deepEqual(state.accessories,draft.config.accessories);
 assert.deepEqual(state.objects,draft.room.desks.main.objects);
 assert.deepEqual([state.pose,state.phases,state.height,state.lights],position);
 state.style.trimColor='#123456';
 assert.equal(applyLibraryProductBuild(state,entry),false,'same Product revision preserves later room edits');
 assert.equal(state.style.trimColor,'#123456');
 const restored=cleanSceneDeskData({rooms:{'library/house':{desks:{main:state}}}}).rooms['library/house'].desks.main;
 assert.deepEqual(restored.productBuild,{id:'library',size:draft.config.size,revision:draft.revision});
 draft.revision++;
 assert.equal(applyLibraryProductBuild(state,entry),true,'new Product edit updates room recipe');
 assert.equal(state.style.trimColor,draft.config.trimColor);
}
console.log('Library Product build: both widths, finishes, accessories, placements, saved link and room poses passed.');
