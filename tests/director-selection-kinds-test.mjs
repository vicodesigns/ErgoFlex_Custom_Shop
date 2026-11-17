// P3: one selection for every kind the Director selects; each marks where it shows on the timeline and opens its lane
// group (director-selection.mjs selectionSelectors / GROUP_OF; director.mjs selectionNow).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectionSelectors,GROUP_OF,createSelection} from '../experience/director-selection.mjs';
const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8');
for(const kind of ['prop','person','desk','camera','clip','title','graphic','light','lightkey'])assert.ok(selectionSelectors({kind,key:'a"b'}).length,`${kind} shows somewhere`);
assert.deepEqual(selectionSelectors({kind:'camera',key:'k1'}),['.camera-key[data-key="k1"]']);
assert.match(selectionSelectors({kind:'title',key:'x"y'})[0],/x\\"y/,'keys are quoted');
for(const kind of Object.keys(GROUP_OF))assert.match(src,new RegExp(`kind:'${kind}'`),`director.mjs selects ${kind}`);
for(const g of new Set(Object.values(GROUP_OF)))assert.match(src,new RegExp(`'${g}'`),`group ${g} exists`);
// the timeline really draws those attributes
const files=['desk-editor','title-editor','graphics-editor'].map(f=>readFileSync(new URL(`../experience/${f}.mjs`,import.meta.url),'utf8')).join('\n')+src;
for(const a of ['data-desk-clip','data-title-clip','data-graphic-clip','data-tod-key','data-light-key','class="camera-key'])assert.ok(files.includes(a),a);
const s=createSelection();let seen=0;s.on(()=>seen++);s.set({kind:'graphic',key:0});assert.equal(s.get().key,'0','graphic 0 is a selection');assert.equal(seen,1);
console.log('director-selection-kinds-test: ok');
