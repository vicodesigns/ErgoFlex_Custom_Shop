// Pose mode with Auto-key OFF on someone who has pose keys (Windows report, 17 Nov 2026), the real editor and rig on the
// cine cut's storage chapter (Andre at 15 s):
//  (A) a change writes only the bones it touched: keyed bones never leak into the static pose;
//  (B) a bone keyed AT the playhead changes that key; one keyed only elsewhere is left alone and the status says why.
//   node tests/pose-keyed-autokey-off-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {RoomPeople} from '../room-people.mjs';
import {stage} from './people-postures-harness.mjs';
import {createScenePeopleEditor} from '../experience/scene-people-editor.mjs';
import {effectivePeople} from '../experience/people-edits.mjs';
const file=new URL('../exports/cinematic-intro-cut-cine/director-film/storage.json',import.meta.url),T0=15,AUTO=false;
const film=JSON.parse(fs.readFileSync(file,'utf8'));
let callbacks=[],messages=[],writes=0,t=T0,shot={id:film.id,seconds:film.seconds},history=[];
class Element {constructor(){this.style={};this.dataset={};this.classList={toggle(){},add(){},remove(){},contains(){return false;}};}setAttribute(){}addEventListener(){}removeEventListener(){}append(){}remove(){}querySelector(){return null;}querySelectorAll(){return [];}getBoundingClientRect(){return {left:0,top:0,width:1600,height:1000};}showModal(){}close(){}}
const gizmos=[];class Gizmo extends THREE.Object3D {constructor(){super();gizmos.push(this);this.mode='translate';}setSize(){}setSpace(s){this.space=s;}setMode(m){this.mode=m;}attach(o){this.object=o;}detach(){this.object=null;}dispose(){}setTranslationSnap(){}setRotationSnap(){}setScaleSnap(){}}
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
if(AUTO)storage.set('ergoflex.director.autoKey','1');
globalThis.addEventListener=()=>{};globalThis.requestAnimationFrame=cb=>callbacks.push(cb);
const dom=new Element(),doc=new Element();doc.head=new Element();doc.body=new Element();doc.createElement=()=>new Element();doc.documentElement=new Element();
globalThis.document=doc;
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/props/people.json',import.meta.url),'utf8'));
globalThis.fetch=async()=>({ok:true,json:async()=>catalog});globalThis.__ERGO_PRESENTATION__=true;
const {people,state}=await stage(RoomPeople,film);people.update(state(t));await people.settled();people.update(state(t));
const camera=new THREE.PerspectiveCamera(40,1.6,.1,10000);camera.position.set(1000,1000,1000);
const view={scene:new THREE.Scene(),camera,renderer:{domElement:dom},controls:{enabled:true,target:new THREE.Vector3()}};
const win={ErgoFlex:{workspaceRoom:{people}},document:doc,__directorThree:{THREE,TransformControls:Gizmo}};
doc.getElementById=id=>id==='stage'?{contentWindow:win}:null;
const bridge={stage:()=>({three:()=>view}),ready:()=>true,playback:()=>({playing:false}),bakeState:()=>({baking:false})};
const apply=async()=>{people.setFilter(effectivePeople(film,shot));people.update(state(t));await people.settled();people.update(state(t));};
const tick=async(n=3)=>{for(let i=0;i<n;i++){await new Promise(r=>setImmediate(r));const cbs=callbacks;callbacks=[];for(const cb of cbs)cb();await people.settled();people.update(state(t));}};
const editor=createScenePeopleEditor({bridge,shot:()=>shot,film:()=>film,commit:fn=>{history.push(structuredClone(shot));fn();writes++;apply();},status:m=>messages.push(m),open:()=>true,rerender:()=>{},time:()=>t,seek:v=>{t=v;apply();}});


const rec=()=>shot.peopleEdits?.cast?.find(x=>x.key==='andre-watches')?.postures?.['people-andre-stand-phone-watch']||{};
const auto=async on=>{const now=localStorage.getItem('ergoflex.director.autoKey')==='1';if(now!==on){await editor.action('pe-key-auto');await tick();}};
const turn=async(joint,field,value)=>{await editor.changed({name:'pe-joint',value:joint});await tick();await editor.changed({name:field,value:String(value)});await tick(2);};
try{
  editor.panel();await tick();editor.select('andre-watches');await tick();await editor.action('pe-pose-enter');await tick(6);
  // a static adjustment first (Auto-key off), then a key on the elbow (Auto-key on)
  await auto(false);await turn('spine_03','pe-ry',8);
  assert.deepEqual(Object.keys(rec().pose||{}),['spine_03'],'static: the chest only');
  await auto(true);await turn('lowerarm_l','pe-rx',-20);
  const k=rec().poseKeys;assert.equal(k?.length,1,'one key');assert.ok(k[0].pose.lowerarm_l,'the elbow is keyed at 15 s');
  const elbowKey=k[0].pose.lowerarm_l;
  // (A) Auto-key off, the head: the static pose gains the head, and nothing of the elbow's key
  await auto(false);const writes0=writes;await turn('head','pe-ry',10);
  assert.deepEqual(Object.keys(rec().pose||{}).sort(),['head','spine_03'],'static: the chest and the head, not the keyed elbow ('+Object.keys(rec().pose||{})+')');
  assert.equal(writes,writes0+1,'one undo step');
  // (B1) Auto-key off on the keyed elbow AT its key's time: the key changes in place, the static pose does not
  await turn('lowerarm_l','pe-rx',-35);
  assert.ok(!rec().pose?.lowerarm_l,'the elbow stays out of the static pose');
  assert.equal(rec().poseKeys.length,1,'still one key');assert.notDeepEqual(rec().poseKeys[0].pose.lowerarm_l,elbowKey,'the key at 15 s took the change');
  assert.match(messages.at(-1),/Key at 15\.00 s updated/);
  // (B2) Auto-key off on the elbow at 17 s (keyed only at 15 s): nothing is written, the status says why
  t=17;await apply();await tick(3);const before=JSON.stringify(rec()),w=writes;
  await turn('lowerarm_l','pe-rx',-50);
  assert.equal(writes,w,'nothing written');assert.equal(JSON.stringify(rec()),before,'the cut is unchanged');
  assert.match(messages.at(-1),/keyed at other times: turn Auto-key on/,'the status says why: '+messages.at(-1));
  // ... while an unkeyed joint at 17 s still goes into the static pose (only it)
  await turn('neck_01','pe-ry',6);assert.deepEqual(Object.keys(rec().pose||{}).sort(),['head','neck_01','spine_03']);
  console.log('PASS pose, Auto-key off with keys: only touched bones written; a key at the playhead updated in place; keyed-elsewhere refused with a reason');
}finally{people.dispose();}
