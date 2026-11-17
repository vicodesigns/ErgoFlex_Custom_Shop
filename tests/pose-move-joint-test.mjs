// Pose mode: blue joints move too (Vico, 17 Nov 2026). The real editor, rigs and stage (people-postures harness) on the cine
// cut's storage chapter: Andre's left elbow moved 5 cm keeps the hand within 1 mm, the turns land in his posture's
// record as one undo step, undo restores; a joint that cannot move says why.
//   node tests/pose-move-joint-test.mjs
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

const V=()=>new THREE.Vector3(),root=people.room?.root,mmPer=1/(root?.getWorldScale?root.getWorldScale(V()).x:1)||1;
const andre=()=>people.byKey('andre-watches'),boneW=n=>andre().userData.personRig.bones.get(n).getWorldPosition(V());
try{
  editor.panel();await tick();editor.select('andre-watches');await tick();await editor.action('pe-pose-enter');await tick(6);
  // a joint that cannot move says why, and stays in Turn
  await editor.changed({name:'pe-joint',value:'pelvis'});await tick();messages.length=0;await editor.action('pe-pose-move');
  assert.match(messages.at(-1)||'',/hips carry the whole body/,'the hips say why they do not move');
  assert.match(editor.panel(),/data-action="pe-pose-move"[^>]*disabled/,'Move joint is disabled there');
  // the left elbow, Move
  await editor.changed({name:'pe-joint',value:'lowerarm_l'});await tick();await editor.action('pe-pose-move');await tick(3);
  const g=gizmos.find(x=>x.object&&!x.object.isBone&&x.mode==='translate');assert.ok(g,'the move gizmo is on the elbow');
  const hand0=boneW('hand_l'),elbow0=boneW('lowerarm_l'),shoulder=boneW('upperarm_l');
  assert.ok(g.object.getWorldPosition(V()).distanceTo(elbow0)*mmPer<1,'the gizmo sits on the elbow');
  // 5 cm out, perpendicular to the shoulder-to-hand line
  const axis=hand0.clone().sub(shoulder).normalize(),out=new THREE.Vector3(0,1,0).cross(axis).normalize();if(out.lengthSq()<.5)out.set(1,0,0);
  globalThis.window=win;g.dispatchEvent({type:'dragging-changed',value:true});
  for(let f=1;f<=4;f++){g.object.position.copy(g.object.parent.worldToLocal(elbow0.clone().addScaledVector(out,50/mmPer*f/4)));g.object.updateMatrixWorld(true);g.dispatchEvent({type:'objectChange'});people.update(state(t));}
  g.dispatchEvent({type:'dragging-changed',value:false});await tick(3);
  const hand1=boneW('hand_l'),elbow1=boneW('lowerarm_l');
  const handMm=hand1.distanceTo(hand0)*mmPer,elbowMm=elbow1.distanceTo(elbow0)*mmPer;
  assert.ok(handMm<1,`the hand stays put (${handMm.toFixed(3)} mm)`);
  assert.ok(elbowMm>30,`the elbow moved (${elbowMm.toFixed(1)} mm; it swings round the shoulder-hand line)`);
  const e=shot.peopleEdits.cast.find(x=>x.key==='andre-watches'),rec=e.postures?.['people-andre-stand-phone-watch'];
  assert.ok(rec?.pose?.upperarm_l&&rec?.pose?.lowerarm_l,'the shoulder and elbow turns are stored on his posture');
  assert.equal(writes,1,'one undo step');
  // after the stage redraws from the cut, scrubbing away and back
  t=17;await apply();await tick(2);t=T0;await apply();await tick(2);
  assert.ok(boneW('hand_l').distanceTo(hand0)*mmPer<1&&boneW('lowerarm_l').distanceTo(elbow1)*mmPer<1,'the cut redraws the same pose');
  // undo
  shot=history.pop();await apply();await tick(2);
  assert.ok(!shot.peopleEdits?.cast?.find(x=>x.key==='andre-watches')?.postures?.['people-andre-stand-phone-watch']?.pose?.lowerarm_l,'undo: no elbow turn');
  assert.ok(boneW('lowerarm_l').distanceTo(elbow0)*mmPer<1,'undo: the elbow is back');
  // a knee: the foot stays
  await editor.changed({name:'pe-joint',value:'calf_r'});await tick();await editor.action('pe-pose-move');await tick(3);
  const k=gizmos.find(x=>x.object&&!x.object.isBone&&x.mode==='translate'),foot0=boneW('foot_r'),knee0=boneW('calf_r');
  k.dispatchEvent({type:'dragging-changed',value:true});k.object.position.copy(k.object.parent.worldToLocal(knee0.clone().add(new THREE.Vector3(30/mmPer,0,30/mmPer))));k.object.updateMatrixWorld(true);k.dispatchEvent({type:'objectChange'});k.dispatchEvent({type:'dragging-changed',value:false});await tick(3);
  assert.ok(boneW('foot_r').distanceTo(foot0)*mmPer<1,'the foot stays when the knee moves');
  // the collarbone: the shoulder follows the drag; the chest: the waist and upper back bend, the hips stay
  const drag1=async(name,by)=>{await editor.changed({name:'pe-joint',value:name});await tick();await editor.action('pe-pose-move');await tick(3);const z=gizmos.find(x=>x.object&&!x.object.isBone&&x.mode==='translate'),at=boneW(name);
    z.dispatchEvent({type:'dragging-changed',value:true});z.object.position.copy(z.object.parent.worldToLocal(at.clone().add(by)));z.object.updateMatrixWorld(true);z.dispatchEvent({type:'objectChange'});z.dispatchEvent({type:'dragging-changed',value:false});await tick(3);};
  const sh0=boneW('upperarm_r');await drag1('clavicle_r',new THREE.Vector3(0,25/mmPer,0));assert.ok(boneW('upperarm_r').y-sh0.y>10/mmPer,'the collarbone lifts the shoulder');
  const pel0=boneW('pelvis'),ch0=boneW('spine_03');await drag1('spine_03',new THREE.Vector3(40/mmPer,0,0));
  assert.ok(boneW('spine_03').distanceTo(ch0)*mmPer>15,'the chest moves');assert.ok(boneW('pelvis').distanceTo(pel0)*mmPer<.5,'the hips stay');
  const head0=boneW('head');await drag1('head',new THREE.Vector3(0,0,30/mmPer));assert.ok(boneW('head').distanceTo(head0)*mmPer>10,'the head moves (the neck turns)');
  console.log(`PASS pose: blue joints move (elbow 5 cm out: hand ${handMm.toFixed(3)} mm, elbow ${elbowMm.toFixed(1)} mm; knee; hips refuse with a reason; one undo step; undo restores)`);
}finally{people.dispose();}
