// Layers, decision 8: Save / Load project carries the hides (studio-layers-model.mjs projectLayers /
// projectLayersRestore; studio.js serializeProject -> presentation.sceneLayers, applyProjectPresentation). No browser.
//   node tests/studio-layers-project-test.mjs
import assert from 'node:assert/strict';
import {projectLayers,projectLayersRestore,LAYERS_KEY} from '../studio-layers-model.mjs';
import {cleanLayers,entryKey,hiddenAt} from '../scene-layers.mjs';
import {mergeWrite} from '../tools/studio-state/merge.mjs';

const HS='highschool:house',BK='scene:highschool:house:room:24:ergoflex-small-bookshelf',CALC='scene:highschool:house:room:40:calculator';
const stored=JSON.stringify({[entryKey(HS,BK)]:{kind:'prop',legacy:'removed',cells:{'*/*':true,'morning/60x30':false}},[entryKey(HS,CALC)]:{kind:'prop',label:'Calculator',cells:{'*/*':true},by:'Studio',t:5},
  [entryKey('library:house','desk:main')]:{kind:'desk',cells:{'*/*':true}}});
// save: the project's presentation.sceneLayers, through JSON (a project file)
const project=JSON.parse(JSON.stringify({formatVersion:1,presentation:{sceneAssets:{},sceneLayers:projectLayers(stored)}}));
assert.deepEqual(project.presentation.sceneLayers,cleanLayers(stored),'saved as the cleaned value');
// load: the same value comes back, byte for byte as the cleaner writes it
const raw=projectLayersRestore(project.presentation.sceneLayers);
assert.equal(raw,JSON.stringify(cleanLayers(stored)));
assert.equal(projectLayersRestore(JSON.parse(raw)),raw,'a second round trip changes nothing');
const back=JSON.parse(raw);assert.equal(hiddenAt(back[entryKey(HS,BK)],'morning','60x30'),false);assert.equal(hiddenAt(back[entryKey(HS,BK)],'afternoon','60x30'),true);
// an old project (no field) loads unchanged: nothing is written
assert.equal(projectLayersRestore(undefined),null);assert.equal(projectLayersRestore(null),null);
assert.deepEqual(JSON.parse(JSON.stringify({presentation:{sceneAssets:{}}})).presentation.sceneLayers,undefined);
// a project saved with no hides clears them (that project had none); junk is cleaned, never stored as is
assert.equal(projectLayersRestore({}),'{}');
assert.equal(projectLayersRestore({'bad|x':{kind:'prop'},[entryKey(HS,CALC)]:{kind:'prop',cells:{'*/*':true,'noon/x':true}}}),JSON.stringify({[entryKey(HS,CALC)]:{kind:'prop',cells:{'*/*':true}}}));
assert.deepEqual(projectLayers(null),{});assert.deepEqual(projectLayers('not json'),{});
// the write goes through the server's per-item merge like any other: another browser's newer hide in another room stays
const theirs=JSON.stringify({...JSON.parse(stored),[entryKey('gym:house','scene:gym:house:fixture:mat')]:{kind:'fixture',cells:{'*/*':true}}});
const m=JSON.parse(mergeWrite(LAYERS_KEY,theirs,projectLayersRestore({[entryKey(HS,CALC)]:{kind:'prop',cells:{'*/*':true}}}),stored).value);
assert.ok(m[entryKey('gym:house','scene:gym:house:fixture:mat')],'another browser\'s hide in another room survives the project load');
assert.ok(!m[entryKey(HS,BK)],'the project\'s own state wins for what it changed');
console.log('Layers in projects: save, load, round trip, old projects unchanged, merge: pass.');
