// "Add to desks" (18 Nov 2026), no browser: a prop added on one of the room's other desks, on the mount Vico picks.
//   1. prop-edits.mjs: MOUNTS in Vico's words and order (Foot shelf, Desktop, Tilt, Desktop shelf), each with what it
//      follows; cleanAddEdit keeps parent 'lift' and on (a room desk's record id), drops on in the room
//   2. film-edits.mjs addParent(kind, on): the room desk's own rig mounts (Desk dressing:<role>), null for a mount it
//      lacks or a desk the room does not have (never the featured desk by mistake); 'lift' is a frame on that desk's base
//      shelf raised by that desk's own height (r.poseAt), level; without on, the featured desk's as before
//   3. build-round8-director.py clean_add keeps parent 'lift' and on (the film gets what the Director shows)
//   node tests/desk-add-mounts-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {MOUNTS,mountLabel,cleanAddEdit,cleanPropEdits,onDesk} from '../experience/prop-edits.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// ---- 1
assert.deepEqual(MOUNTS.map(m=>m.label),['Foot shelf','Desktop','Tilt','Desktop shelf','Desktop shelf (lower)']);
assert.deepEqual(MOUNTS.map(m=>m.kind),['base-shelf','lift','desk','shelf','lower-shelf']);
assert.match(MOUNTS[0].tip,/never rises or tilts/);assert.match(MOUNTS[1].tip,/rises and lowers with the lift, stays level/);assert.match(MOUNTS[2].tip,/rises with the lift and tilts/);
assert.equal(mountLabel('lift'),'Desktop');assert.equal(onDesk('lift'),true);
const a=cleanAddEdit({add:{asset:'backpack'},id:'a1',parent:'lift',on:'station-research-desk',label:'Backpack'});
assert.equal(a.parent,'lift');assert.equal(a.on,'station-research-desk');
assert.equal(cleanAddEdit({add:{asset:'backpack'},id:'a2',parent:'base-shelf',on:'Station X!'}).on,undefined,'an unusual desk id is dropped');
assert.equal(cleanAddEdit({add:{asset:'backpack'},id:'a3',parent:'room',on:'station-a'}).on,undefined,'in the room it is on no desk');
assert.equal(cleanAddEdit({add:{asset:'backpack'},id:'a4',parent:'desk'}).on,undefined,'absent: the featured desk, as before');
// one entry per desk: distinct keys, all kept
const many=cleanPropEdits({propEdits:[a,cleanAddEdit({add:{asset:'backpack'},id:'b1',parent:'desk'}),cleanAddEdit({add:{asset:'backpack'},id:'c1',parent:'base-shelf',on:'station-b'})]}).propEdits;
assert.equal(many.length,3);
// ---- 2
const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
const mount=(name,y=0)=>{const g=new THREE.Group();g.name=name;g.matrixAutoUpdate=false;g.matrix.makeTranslation(0,y,0);return g;};
const rigA=new THREE.Group();rigA.name='Research desk · ErgoFlex desk';scene.add(rigA);
const A={desktop:mount('Desk dressing:desktop',740),'base-shelf':mount('Desk dressing:base-shelf',120)};for(const m of Object.values(A))rigA.add(m);
const rA={id:'station-a',group:rigA,rig:{mounts:A},poseAt:'30:0',state:{height:30}};
const feat={desktop:new THREE.Group()};feat.desktop.name='Accessory mount:desktop';scene.add(feat.desktop);
const main={id:'main',state:{height:36},rig:{mounts:{}}};
globalThis.window={ErgoFlex:{loadedModel:desk,workspaceAccessories:{mounts:new Map([['desktop',{group:feat.desktop}]]),scale:.001},sceneDesks:{selected:'main',active:main,records:new Map([['main',main],['station-a',rA]])}}};
const E=await import('../tools/experience/film-edits.mjs');
assert.equal(E.addParent('desk','station-a'),A.desktop,'Tilt on a room desk: its own desktop mount');
assert.equal(E.addParent('base-shelf','station-a'),A['base-shelf'],'Foot shelf: its own base shelf');
assert.equal(E.addParent('shelf','station-a'),null,'a mount the desk does not have');
assert.equal(E.addParent('desk','station-nope'),null,'a desk the room does not have: nowhere');
assert.equal(E.addParent('desk','main'),feat.desktop,'the featured desk by its id: the featured desk\'s');
assert.equal(E.addParent('desk'),feat.desktop,'without on: the featured desk, as before');
assert.equal(E.addParent('room','station-a'),scene,'(room: the room)');
const lift=E.addParent('lift','station-a');
assert.ok(lift&&lift.parent===A['base-shelf'],'Desktop (level): a frame on the desk\'s base shelf');
assert.equal(E.addParent('lift','station-a'),lift,'the same frame each time');
lift.updateMatrix();assert.ok(Math.abs(lift.position.y-2*25.4)<1e-9,'raised by that desk\'s height (30 in): '+lift.position.y);
rA.poseAt='40:12';lift.updateMatrix();assert.ok(Math.abs(lift.position.y-12*25.4)<1e-9,'it follows the desk as it rises (40 in)');
assert.equal(lift.quaternion.angleTo(new THREE.Quaternion()),0,'and never tilts (12 deg on the top)');
delete rA.poseAt;lift.updateMatrix();assert.ok(Math.abs(lift.position.y-2*25.4)<1e-9,'no pose yet: its state\'s height');
assert.equal(E.addParent('lift','station-b'),null,'no such desk: no frame');
// ---- 3
const py=fs.readFileSync(path.join(root,'tools/experience/build-round8-director.py'),'utf8');
const s=py.indexOf('ADD_ASSET = re.compile'),e=py.indexOf('def clean_props');
const out=execFileSync('python3',['-c',`import re,json,sys\nns={'re':re,'desk_and_show':lambda e,d:None}\nexec(sys.stdin.read(),ns)\nprint(json.dumps([ns['clean_add'](x) for x in ${JSON.stringify(JSON.stringify([a,{add:{asset:'backpack'},id:'z',parent:'room',on:'station-a'}]))}.__class__ and json.loads(${JSON.stringify(JSON.stringify([a,{add:{asset:'backpack'},id:'z',parent:'room',on:'station-a'}]))})]))`],{input:py.slice(s,e)}).toString();
const [ia,ir]=JSON.parse(out);
assert.equal(ia.parent,'lift');assert.equal(ia.on,'station-research-desk');assert.equal(ia.director,true);
assert.equal(ir.on,undefined,'the importer drops on in the room too');
console.log('desk-add-mounts-test: ok (Vico\'s mounts; a room desk\'s own mounts and its level desktop; the importer keeps them)');
