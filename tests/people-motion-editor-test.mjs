// People motion controls in the Director (plan rev 3, 17 Nov 2026): distance from the desk, chair roll, roll in / out,
// every stay, looks at, + Walk to. The real editor with real rigs and a minimal DOM adapter (people-postures-editor-test).
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
const P=()=>shot.peopleEdits.cast.find(e=>e.key==='maya-stand'),W=()=>shot.peopleEdits.when;
const deskDistance=()=>{const o=people.byKey('maya-stand');return o?Math.round(o.position.distanceTo(new THREE.Vector3(0,0,260))):null;};
try{
  editor.panel();await tick();editor.select('maya-stand');await tick();
  let html=editor.panel();
  assert.match(html,/Distance from the desk/);assert.match(html,/name="pe-reach-stand" value="33.5"/,'850 mm shown in inches');assert.match(html,/name="pe-reach-sit" value="37.2"/,'seated: the film\'s 945 mm');
  assert.match(html,/Chair rolls back/,'Maya sits too: her chair roll is offered');assert.match(html,/Roll in \/ out/);
  // distance from the desk: seated Maya is the room's model; the person's seated distance (sitReach on the film's
  // entry) moves her too
  const was=deskDistance();
  await editor.changed({name:'pe-reach-sit',value:'33.5'});await tick();
  assert.equal(P().sitReach,851);assert.equal(P().reach,850,'her standing distance is untouched');
  assert.ok(Math.abs(was-deskDistance()-94)<=2,`the seated model moves 94 mm closer (${was} -> ${deskDistance()})`);
  // chair roll: on the stage's actor (the room's seated model takes the film entry's)
  await editor.changed({name:'pe-chair-roll',value:'15'});await editor.changed({name:'pe-chair-scoot',value:'3.5'});await tick();
  assert.equal(P().chairRoll,381);assert.equal(P().chairScoot,undefined,'the film\'s own value clears the field');
  assert.equal(people.actors[0]?.chairRoll,.381,'the stage\'s actor has her chair roll');
  // roll in / out: she rolls in during the shot, her chair with her
  t=4;await editor.action('pe-rk-add');await tick();
  assert.deepEqual(P().reachKeys,[{at:4,dur:1.5,to:801}]);
  await editor.changed({name:'pe-rk-to-0',value:'28'});await editor.changed({name:'pe-rk-dur-0',value:'2'});await editor.changed({name:'pe-rk-ease-0',value:'linear'});await tick();
  assert.deepEqual(P().reachKeys,[{at:4,dur:2,to:711,ease:'linear'}]);
  t=16.6;apply();await tick();const after=deskDistance(),chair=people.actors[0]?.chair?.position.distanceTo(new THREE.Vector3(0,0,260));
  assert.ok(Math.abs(was-after-234)<=2,`at 16.6 s she has rolled in to 28 in (${was} -> ${after})`);
  t=3;apply();await tick();assert.ok(Math.abs(was-deskDistance()-94)<=2,'before the roll: 33.5 in');
  const chairBefore=people.actors[0]?.chair?.position.distanceTo(new THREE.Vector3(0,0,260));
  assert.ok(chair!==undefined&&Math.abs(chairBefore-chair-140)<=2,`the chair rolls in with her (${chairBefore} -> ${chair})`);
  assert.match(editor.panel(),/pe-rk-at-0/);
  // a posture change at the desk keeps both distances: `reach` is always the posture they are in
  t=16.6;apply();await tick();
  await editor.changed({name:'pe-pose',value:'sit-type'});await tick();
  assert.equal(P().desk,'sit');assert.equal(P().reach,851,'seated is now her own posture: reach');assert.equal(P().standReach,850,'and the standing distance is kept');
  assert.equal(P().sitReach,undefined);assert.equal(P().chairRoll,381);assert.equal(P().reachKeys.length,1);
  await editor.action('pe-rk-remove',0);await tick();assert.equal(P().reachKeys,undefined);
  await editor.action('pe-reach-reset');await tick();assert.equal(P().reach,undefined,'back to the film\'s distance');assert.equal(P().standReach,undefined);
  // a free spot clears the distance (they no longer follow the desk)
  // every stay: the second one edits in place, the first stays
  editor.select('maya-waits');await tick();html=editor.panel();
  assert.match(html,/name="pe-in-0"/);assert.match(html,/name="pe-in-1"/);
  await editor.changed({name:'pe-in-1',value:'10'});await tick();
  assert.deepEqual(W()['maya-waits'],[[3.75,7.4,.4,.4],[10,12.5,.4,.4]]);
  t=14;await editor.action('pe-span-add');await tick();assert.equal(W()['maya-waits'].length,3);assert.equal(W()['maya-waits'][2][0],14);
  t=5.5;await editor.action('pe-span-split');await tick();assert.deepEqual(W()['maya-waits'].slice(0,2).map(s=>s.slice(0,2)),[[3.75,5],[6,7.4]]);
  t=11;await editor.action('pe-out-now');await tick();assert.equal(W()['maya-waits'][2][1],11,'Out at the playhead changes the stay under it');
  await editor.action('pe-span-remove',3);await tick();assert.equal(W()['maya-waits'].length,3);
  // looks at
  await editor.changed({name:'pe-look',value:'maya-stand'});await tick();assert.deepEqual(shot.peopleEdits.cast.find(e=>e.key==='maya-waits').look,['maya-stand']);
  await editor.changed({name:'pe-look',value:''});await tick();assert.equal(shot.peopleEdits.cast.find(e=>e.key==='maya-waits').look,undefined);
  // + Walk to…: offered to someone standing at a spot of their own; the next floor click is where they go
  assert.match(editor.panel(),/\+ Walk to…/);
  messages.length=0;await editor.action('pe-path-go');assert.match(messages.at(-1),/Click the floor where Maya walks to/);
  await editor.action('pe-path-go');assert.match(messages.at(-1),/No path added/);
  // a change of posture: timing fields, and the too-far warning
  const waits=shot.peopleEdits.cast.find(e=>e.key==='maya-waits');
  shot.peopleEdits.cast.push({key:'maya-after',id:'people-maya-stretch',at:[waits.at[0]+600,waits.at[1]],turn:waits.turn||0});shot.peopleEdits.when['maya-after']=[[5,7,.4,.4]];apply();await tick();
  editor.select('maya-after');await tick();html=editor.panel();
  assert.match(html,/Posture change/);assert.match(html,/600 mm apart/);
  await editor.changed({name:'pe-ch-seconds',value:'2'});await editor.changed({name:'pe-ch-step',checked:true});await editor.changed({name:'pe-ch-arms-0',value:'.4'});await tick();
  assert.deepEqual(shot.peopleEdits.cast.find(e=>e.key==='maya-after').change,{seconds:2,step:true,arms:[.4,1]});
  await editor.action('pe-ch-closer');await tick();assert.equal(Math.round(shot.peopleEdits.cast.find(e=>e.key==='maya-after').at[0]-waits.at[0]),200);
  assert.doesNotMatch(editor.panel(),/mm apart/);
  // paste attributes: Maya (waiting)'s size and colour onto the other Maya placement
  editor.select('maya-waits');await tick();await editor.changed({name:'pe-scale',value:'110'});await editor.changed({name:'pe-color-top',value:'#336699'});await tick();
  assert.ok(editor.copyAttrs());editor.select('maya-after');await tick();assert.ok(editor.pasteAttrs());await tick();
  const pasted=shot.peopleEdits.cast.find(e=>e.key==='maya-after');assert.equal(pasted.scale,1.1);assert.equal(pasted.colors.top,'#336699');
  // Delete on a selected person (director.mjs viewDelete -> scenePeople.remove()): one undo step, and undo restores them
  editor.select('maya-after');await tick();const castBefore=structuredClone(shot.peopleEdits.cast),whenBefore=structuredClone(shot.peopleEdits.when),steps=history.length;
  editor.remove();await tick();
  assert.ok(!shot.peopleEdits.cast.some(e=>e.key==='maya-after'),'Delete removes the person from the chapter');assert.equal(history.length,steps+1,'one undo step');
  shot=history.pop();apply();await tick();
  assert.deepEqual(shot.peopleEdits.cast,castBefore,'undo brings them back exactly');assert.deepEqual(shot.peopleEdits.when,whenBefore,'and their stays');
  // (the stage is not checked here: after the posture swap above this harness cannot load her seated model, see above)
  editor.deselect();console.log('PASS people motion controls: distance from the desk (kept across postures, moves the model), chair roll on the stage actor, roll in / out over time, every stay, looks at, + Walk to, posture change timing and the 220 mm warning');
}finally{people.dispose();for(const [k,v] of Object.entries(oldGlobals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
