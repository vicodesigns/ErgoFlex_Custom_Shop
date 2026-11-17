// Runs the real editor/pose controllers with real rigs and a minimal DOM adapter.
// This checks transaction routing, not browser layout or GPU pixels.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {RoomPeople} from '../room-people.mjs';
import {stage} from './people-postures-harness.mjs';
import {createScenePeopleEditor} from '../experience/scene-people-editor.mjs';
import {effectivePeople} from '../experience/people-edits.mjs';
import {postureRecord} from '../people-postures.mjs';
const film=JSON.parse(fs.readFileSync(new URL('./fixtures/people-postures-chapters.json',import.meta.url),'utf8'))[0];
const oldGlobals=Object.fromEntries(['document','addEventListener','requestAnimationFrame','fetch','localStorage','__ERGO_PRESENTATION__'].map(k=>[k,globalThis[k]]));
let callbacks=[],messages=[],history=[],redo=[],writes=0,t=16.6,shot={id:'rise',seconds:18};
class Element {constructor(){this.style={};this.dataset={};this.classList={toggle(){},add(){}};}setAttribute(){}addEventListener(){}append(){}querySelector(){return null;}querySelectorAll(){return [];}getBoundingClientRect(){return {left:0,top:0,width:1600,height:1000};}}
class Gizmo extends THREE.Object3D {setSize(){}setSpace(){}setMode(m){this.mode=m;}attach(o){this.object=o;}detach(){this.object=null;}dispose(){}}
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
globalThis.addEventListener=()=>{};globalThis.requestAnimationFrame=cb=>callbacks.push(cb);
const dom=new Element(),doc=new Element();doc.head=new Element();doc.body=new Element();doc.createElement=()=>new Element();
globalThis.document=doc;
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/props/people.json',import.meta.url),'utf8'));
globalThis.fetch=async()=>({ok:true,json:async()=>catalog});globalThis.__ERGO_PRESENTATION__=true;
const {people,state}=await stage(RoomPeople,film);people.update(state(t));await people.settled();people.update(state(t));
const camera=new THREE.PerspectiveCamera(40,1.6,.1,10000);camera.position.set(1000,1000,1000);
const view={scene:new THREE.Scene(),camera,renderer:{domElement:dom},controls:{enabled:true,target:new THREE.Vector3()}};
const win={ErgoFlex:{workspaceRoom:{people}},document:doc,__directorThree:{THREE,TransformControls:Gizmo}};
doc.getElementById=id=>id==='stage'?{contentWindow:win}:null;
const bridge={stage:()=>({three:()=>view}),ready:()=>true,playback:()=>({playing:false}),bakeState:()=>({baking:false})};
const apply=()=>{people.setFilter(effectivePeople(film,shot));people.update(state(t));};
const tick=async()=>{await new Promise(r=>setImmediate(r));callbacks.shift()?.();await people.settled();};
const editor=createScenePeopleEditor({bridge,shot:()=>shot,film:()=>film,commit:fn=>{history.push(structuredClone(shot));redo=[];fn();writes++;apply();},status:m=>messages.push(m),open:()=>true,rerender:()=>{},time:()=>t,seek:v=>{t=v;apply();}});
try{
  editor.panel();await tick();editor.select('maya-stand');await tick();
  assert.equal(writes,0);await editor.action('pe-pose-enter');await tick();
  assert.equal(writes,0,'entering seated pose mode does not rewrite or dirty the cast');
  assert.match(editor.panel(),/Pose mode · sit-type/);assert.match(editor.panel(),/none yet/);
  await editor.changed({name:'pe-joint',value:'lowerarm_l'});await editor.changed({name:'pe-rx',value:'20'});await tick();
  let e=shot.peopleEdits.cast.find(e=>e.key==='maya-stand');
  assert.equal(e.id,'people-maya-stand-type-41');assert.ok(postureRecord(e,'people-maya-sit-type').pose.lowerarm_l);
  assert.deepEqual(postureRecord(e,e.id).pose,film.people.cast[0].pose,'standing correction remains exact after seated controller edit');
  editor.keyNow('all');await tick();e=shot.peopleEdits.cast.find(e=>e.key==='maya-stand');assert.equal(postureRecord(e,'people-maya-sit-type').poseKeys[0].t,16.6);
  assert.match(editor.trackRows(),/Maya/);assert.match(editor.panel(),/1 key/);
  // Saved poses take the active seated record; applying one cannot recast Maya
  // or clear her other posture's correction/keys.
  await editor.action('pe-pose-save');editor.panel();
  assert.ok([...storage.keys()].some(k=>/pose/i.test(k)));
  await editor.action('pe-pose-apply',0);await tick();
  assert.equal(shot.peopleEdits.cast[0].id,'people-maya-stand-type-41');
  assert.deepEqual(postureRecord(shot.peopleEdits.cast[0],'people-maya-stand-type-41').pose,film.people.cast[0].pose);
  // The controller rebinds while scrubbing. It must never write to the new model
  // merely because the displayed posture changed.
  const writesBefore=writes;t=8;apply();await tick();assert.equal(writes,writesBefore);assert.match(editor.panel(),/Pose mode · stand-type-41/);
  t=16.6;apply();await tick();assert.match(editor.panel(),/Pose mode · sit-type/);assert.match(editor.panel(),/1 key/);
  history.pop(); // saved-pose application retained exactly the same correction
  const after=structuredClone(shot);redo.push(structuredClone(shot));shot=history.pop();apply();await tick();assert.ok(!postureRecord(shot.peopleEdits.cast[0],'people-maya-sit-type').poseKeys);
  shot=redo.pop();apply();await tick();assert.deepEqual(shot,after);
  // Auto-key routes a new edit to the same seated store.
  await editor.action('pe-key-auto');await editor.changed({name:'pe-joint',value:'hand_l'});await editor.changed({name:'pe-rx',value:'12'});await tick();
  assert.deepEqual(postureRecord(shot.peopleEdits.cast[0],'people-maya-stand-type-41').pose,film.people.cast[0].pose);
  assert.equal(shot.peopleEdits.cast.filter(e=>e.id==='people-maya-sit-type').length,0);
  // A chapter whose film has no cast of its own: the room's crew is copied in as plain entries (each one can be moved,
  // hidden or recoloured), never as pose-only entries.
  editor.deselect();
  const crew=[{key:'ana',id:'people-maya-stand-wait',at:[100,200],turn:0},{key:'bo',id:'people-priya-stretch',at:[900,-400],turn:90,pose:{hand_l:[0.1,0,0,0.995]}}];
  const stub={resolved:(o={})=>o.editable?crew.map(c=>({...c,poseSource:{key:c.key,id:c.id}})):structuredClone(crew),keyOf:s=>s.key||s.id,editKeyOf:s=>s.key||s.id,byKey:()=>null,list:()=>[]};
  let shot2={id:'x',seconds:18};const films={id:'x'},win2={ErgoFlex:{workspaceRoom:{people:stub}},document:doc,__directorThree:{THREE,TransformControls:Gizmo}},was=doc.getElementById;
  doc.getElementById=id=>id==='stage'?{contentWindow:win2}:null;
  const editor2=createScenePeopleEditor({bridge,shot:()=>shot2,film:()=>films,commit:fn=>{fn();},status:()=>{},open:()=>true,rerender:()=>{},time:()=>t,seek:()=>{}});
  await editor2.action('pe-room');
  assert.ok(shot2.peopleEdits&&shot2.peopleEdits.cast.length===2,'Bring in the room\'s people copies each one');
  assert.ok(shot2.peopleEdits.cast.every(e=>!e.poseSource&&!e.poseBindings),'copied as real entries, not pose-only ones');
  assert.deepEqual(postureRecord(shot2.peopleEdits.cast[1]).pose,{hand_l:[0.1,0,0,0.995]},'their own fine tuning comes with them');
  doc.getElementById=was;
  editor.deselect();console.log('PASS people posture controllers: select seated Maya, read-only entry, static pose, keys, auto-key, scrub rebind, undo/redo, standing precision');
}finally{people.dispose();for(const [k,v] of Object.entries(oldGlobals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
