import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NodeIO,getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {cleanDeskObjects} from '../scene-desk-data.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read('assets/props/ergoflex-headphone-hook.glb'),root=doc.getRoot(),bounds=getBounds(root.listScenes()[0]);
assert(Math.abs(bounds.max[0]-.116646)<.00001,'Hook must retain the original 116.6 mm reach');
assert(Math.abs(bounds.min[0]+.023236)<.00001,'Plug must extend into the panel, opposite the hook');
assert(Math.abs(bounds.max[1]-.031399)<.00001,'Retaining lip must point upward');
assert(root.listNodes().some(n=>n.getName().includes('retaining flange')));
assert(root.listNodes().every(n=>!/Headphones/.test(n.getName())),'The imported hardware must not contain a replacement headphone model');
const index=JSON.parse(fs.readFileSync('assets/props/index.json'));
assert(index.props.some(p=>p.id==='headphones'&&p.file==='assets/props/headphones.glb'));
assert(!index.props.some(p=>p.id==='ergoflex-hanging-headphones'),'Withdraw the broken combined asset');
const recovery=JSON.parse(fs.readFileSync('assets/props/headphone-placement-recovery.json'));
for(const key of ['occmedialab/premium|main|default-desktop-1','occmedialab/premium|station-accessible-edit-04|default-desktop-0']){
 const saved=recovery[key];assert(saved&&Math.abs(saved.transform.q.y)>.5,'Keep the original manually rotated placement for recovery');assert.equal(Object.values(cleanDeskObjects({restored:saved})).length,1);
}
console.log('Original hook dimensions, inward plug, upward lip, separate hardware, original headphone asset and two manual-placement recovery records passed.');
