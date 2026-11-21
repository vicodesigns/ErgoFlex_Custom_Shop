// Pose mode: the THUMB slider (Vico, 21 Nov 2026: "we don't have a thumb that either stretches it or curls it for a fist").
// The real editor, rigs and stage (people-postures harness) on the 3rd cut's Maya (rise), Ben (commons) and Noah (oilers):
// per hand, -100 stretched … 0 as built … 100 curled; the value reads back from the bones; the hinges stay within their
// limits; the grip and the thumb leave each other alone (a fist still wraps a thumb left as built); one undo step each,
// coalesced as 'pose-thumb-'; stored on the posture's pose (and in a pose key with Auto-key on); Copy to the other side
// carries it.
//   node tests/pose-thumb-test.mjs            (VERBOSE=1 prints the joint angles)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {RoomPeople} from '../room-people.mjs';
import {stage} from './people-postures-harness.mjs';
import {createScenePeopleEditor} from '../experience/scene-people-editor.mjs';
import {effectivePeople} from '../experience/people-edits.mjs';
import {poseAt} from '../people-pose-keys.mjs';

const VERBOSE=!!process.env.VERBOSE;
class Element {constructor(){this.style={};this.dataset={};this.classList={toggle(){},add(){},remove(){},contains(){return false;}};}setAttribute(){}addEventListener(){}removeEventListener(){}append(){}remove(){}querySelector(){return null;}querySelectorAll(){return [];}getBoundingClientRect(){return {left:0,top:0,width:1600,height:1000};}showModal(){}close(){}}
class Gizmo extends THREE.Object3D {constructor(){super();this.mode='translate';}setSize(){}setSpace(s){this.space=s;}setMode(m){this.mode=m;}attach(o){this.object=o;}detach(){this.object=null;}dispose(){}setTranslationSnap(){}setRotationSnap(){}setScaleSnap(){}}
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
let callbacks=[];
globalThis.addEventListener=()=>{};globalThis.requestAnimationFrame=cb=>callbacks.push(cb);
const dom=new Element(),doc=new Element();doc.head=new Element();doc.body=new Element();doc.createElement=()=>new Element();doc.documentElement=new Element();
globalThis.document=doc;
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/props/people.json',import.meta.url),'utf8'));
globalThis.fetch=async()=>({ok:true,json:async()=>catalog});globalThis.__ERGO_PRESENTATION__=true;
const D=THREE.MathUtils.radToDeg;
const flexOf=q=>D(2*Math.atan2(q.x,q.w));
const ang=(a,b)=>D(2*Math.acos(Math.min(1,Math.abs(a.dot(b)))));
const CUT='../exports/cinematic-intro-cut-vicos-3rd-cut/director-film/';
const PEOPLE=[['rise.json','maya-stand'],['commons.json','room-ben-1wyru4v'],['oilers.json','noah-talks']];
const results=[];

async function one(fileName,key){
  const film=JSON.parse(fs.readFileSync(new URL(CUT+fileName,import.meta.url),'utf8'));
  let t=0,shot={id:film.id,seconds:film.seconds},history=[],undoKeys=[];const messages=[];
  const {people,state}=await stage(RoomPeople,film);
  // a moment the person is on stage
  for(const at of [0,1,2,3,4,5,6,8,10,12,14,16,18,20,24,28,32]){if(at>film.seconds)break;t=at;people.update(state(t));await people.settled();people.update(state(t));if(people.byKey(key)?.visible)break;}
  assert.ok(people.byKey(key)?.visible,key+' is on stage at '+t+' s');
  const camera=new THREE.PerspectiveCamera(40,1.6,.1,10000);camera.position.set(1000,1000,1000);
  const view={scene:new THREE.Scene(),camera,renderer:{domElement:dom},controls:{enabled:true,target:new THREE.Vector3()}};
  const win={ErgoFlex:{workspaceRoom:{people}},document:doc,__directorThree:{THREE,TransformControls:Gizmo}};
  doc.getElementById=id=>id==='stage'?{contentWindow:win}:null;globalThis.window=win;
  const bridge={stage:()=>({three:()=>view}),ready:()=>true,playback:()=>({playing:false}),bakeState:()=>({baking:false})};
  const apply=async()=>{people.setFilter(effectivePeople(film,shot));people.update(state(t));await people.settled();people.update(state(t));};
  const tick=async(n=3)=>{for(let i=0;i<n;i++){await new Promise(r=>setImmediate(r));const cbs=callbacks;callbacks=[];for(const cb of cbs)cb();await people.settled();people.update(state(t));}};
  let last=null;
  const editor=createScenePeopleEditor({bridge,shot:()=>shot,film:()=>film,commit:(fn,o)=>{const k=o?.key;if(!(k&&k===last))history.push(structuredClone(shot));last=k||null;undoKeys.push(k||null);fn();apply();},status:m=>messages.push(m),open:()=>true,rerender:()=>{},time:()=>t,seek:v=>{t=v;apply();}});
  const obj=()=>people.byKey(key),rig=()=>obj().userData.personRig,bone=n=>rig().bones.get(n);
  const slider=(name)=>{const m=new RegExp(`name="${name}"[^>]*value="(-?\\d+)"`).exec(editor.panel());assert.ok(m,'slider '+name+' in the panel');return Number(m[1]);};
  const set=async(name,value)=>{await editor.changed({name,value:String(value)});await tick(2);};
  const quats=(side,re)=>[...rig().bones].filter(([n])=>re.test(n)&&n.endsWith('_'+side)).map(([n,b])=>[n,b.quaternion.clone()]);
  const same=(a,b,eps=.05)=>a.length===b.length&&a.every(([n,q],i)=>b[i][0]===n&&ang(q,b[i][1])<eps);
  const THUMB=/^thumb_0\d_[lr]$/,FING=/^(index|middle|ring|pinky)_0\d_[lr]$/;
  const posture=()=>{const e=shot.peopleEdits?.cast?.find(x=>x.key===key);return e?e.postures?.[obj().userData.person.id]||e:null;};     // (the record of the posture on screen)
  try{
    editor.panel();await tick();editor.select(key);await tick();await editor.action('pe-pose-enter');await tick(6);
    assert.ok(rig(),key+': skeleton in');
    const name=obj().userData.person.id;
    for(const sd of ['l','r'])assert.equal(slider('pe-thumb-'+sd),0,`${key}: the ${sd} thumb starts as built`);
    const rest=Object.fromEntries(['l','r'].flatMap(sd=>[1,2,3].map(j=>`thumb_0${j}_${sd}`)).map(n=>[n,rig().rest.get(n).clone()]));
    const row={who:name,side:{}};
    for(const sd of ['l','r']){
      const s={};row.side[sd]=s;
      for(const v of [-100,-50,50,100,0]){
        await set('pe-thumb-'+sd,v);
        assert.equal(slider('pe-thumb-'+sd),v,`${key}: the ${sd} thumb reads back ${v}`);
        const [b1,b2,b3]=[1,2,3].map(j=>bone(`thumb_0${j}_${sd}`)),cmc=ang(b1.quaternion,rest[b1.name]);
        const f2=flexOf(b2.quaternion),f3=flexOf(b3.quaternion),r2=flexOf(rest[b2.name]),r3=flexOf(rest[b3.name]);
        s[v]={cmc:+cmc.toFixed(1),mcp:+f2.toFixed(1),ip:+f3.toFixed(1),mcp0:+r2.toFixed(1),ip0:+r3.toFixed(1)};
        // limits: the base swings 58° in / 40° out at most; the hinges stay in [-8, 55] and [-12, 75] (or where the posture had them)
        assert.ok(cmc<=(v>0?58:40)+.5,`${key} ${sd} ${v}: base swing ${cmc.toFixed(1)}°`);
        assert.ok(f2<=Math.max(55,r2)+.5&&f2>=Math.min(-8,r2)-.5,`${key} ${sd} ${v}: knuckle ${f2.toFixed(1)}° (as built ${r2.toFixed(1)})`);
        assert.ok(f3<=Math.max(75,r3)+.5&&f3>=Math.min(-12,r3)-.5,`${key} ${sd} ${v}: end joint ${f3.toFixed(1)}° (as built ${r3.toFixed(1)})`);
        if(v>0)assert.ok(f2>=r2-.5&&f3>=r3-.5,`${key} ${sd} ${v}: curling never straightens a hinge`);
        if(v<0)assert.ok(f2<=r2+.5&&f3<=r3+.5,`${key} ${sd} ${v}: stretching never bends a hinge`);
        if(v===0)assert.ok(quats(sd,THUMB).every(([n,q])=>ang(q,rest[n])<1),`${key} ${sd}: 0 is the thumb as built (within 1°: a posture in motion moves its fingers a little)`);
      }
    }
    // one undo step per slider move, coalesced by its own key
    assert.ok(undoKeys.some(k=>k==='pose-thumb-'+key+'r'),'the thumb writes with its own undo key');
    // ---- independence: a thumb set by hand stays while the grip moves; the grip's fingers stay while the thumb moves
    const sd='r';
    await set('pe-thumb-r',-100);const th=quats(sd,THUMB);
    await set('pe-grip-r',100);
    const g100=slider('pe-grip-r');assert.ok(g100>=90,'the grip reads a fist ('+g100+': a posture in motion reads a step or two off, as before)');
    assert.ok(same(quats(sd,THUMB),th),`${key}: a fist leaves a thumb set by hand where it is`);
    assert.equal(slider('pe-thumb-r'),-100,'and the thumb still reads -100');
    const fist=quats(sd,FING);
    await set('pe-thumb-r',60);
    assert.ok(same(quats(sd,FING),fist),`${key}: the thumb leaves the fingers where they are`);
    assert.equal(slider('pe-grip-r'),g100,'the grip reads the same');
    await set('pe-grip-r',-60);assert.equal(slider('pe-thumb-r'),60,`${key}: opening the hand keeps the thumb at 60`);
    // a thumb back as built follows the grip: the fist wraps it, as before the thumb had a slider
    await set('pe-thumb-r',0);await set('pe-grip-r',100);
    assert.equal(slider('pe-thumb-r'),100,`${key}: a fist wraps a thumb left as built (it reads 100)`);
    await set('pe-grip-r',50);assert.equal(slider('pe-thumb-r'),50,`${key}: and it follows the grip while it is the grip's`);
    await set('pe-grip-r',0);assert.equal(slider('pe-thumb-r'),0,`${key}: grip back to 0, thumb back as built`);
    assert.ok(!Object.keys(posture()?.pose||{}).some(n=>/_r$/.test(n)&&(THUMB.test(n)||FING.test(n))),`${key}: the right hand as built leaves nothing in the cut`);
    // ---- stored on the posture, undo, redraw from the cut
    await set('pe-thumb-r',-100);
    const stored=posture()?.pose||{};
    assert.ok(stored.thumb_01_r&&stored.thumb_02_r,`${key}: the thumb's bones are in the posture's pose`);
    // (a slider's moves coalesce into one undo step, as the grip's do: undo takes the whole move back)
    const steps=history.length;await set('pe-thumb-r',-80);assert.equal(history.length,steps,'the thumb slider\'s moves are one undo step');
    await set('pe-grip-r',40);assert.equal(slider('pe-thumb-r'),-80,'the grip leaves the thumb at -80');
    shot=history.pop();await apply();await tick(3);
    assert.equal(slider('pe-grip-r'),0,`${key}: undo takes the grip back`);
    assert.equal(slider('pe-thumb-r'),-80,`${key}: and leaves the thumb at -80`);
    shot=history.pop();await apply();await tick(3);
    assert.equal(slider('pe-thumb-r'),0,`${key}: undo once more: the thumb as built`);
    await set('pe-thumb-r',-100);
    // ---- Copy to the other side
    await editor.changed({name:'pe-joint',value:'lowerarm_r'});await tick();await editor.action('pe-pose-mirror');await tick(3);
    const ml=slider('pe-thumb-l');row.mirror=ml;
    assert.equal(ml,-100,`${key}: Copy to the left side gives the left thumb -100 (read ${ml})`);
    // ---- Auto-key on: the thumb's bones go into a pose key at the playhead, and the stage draws them from it
    await editor.action('pe-key-auto');
    await set('pe-thumb-l',100);
    const rec=posture(),k=(rec.poseKeys||[]).find(x=>Math.abs(x.t-t)<1e-6);
    assert.ok(k?.pose?.thumb_01_l&&k.pose.thumb_03_l,`${key}: Auto-key keys the left thumb's bones at ${t} s`);
    const at=poseAt(rec,t);assert.ok(at.thumb_01_l,'poseAt carries the thumb');
    await apply();await tick(3);
    assert.equal(slider('pe-thumb-l'),100,`${key}: drawn from the key, the left thumb reads 100`);
    await editor.action('pe-key-auto');
    // ---- re-enter pose mode: the sliders read the bones again
    await editor.action('pe-pose-done');await tick(2);await editor.action('pe-pose-enter');await tick(6);
    assert.equal(slider('pe-thumb-l'),100,`${key}: re-entered, the left thumb reads 100`);
    assert.equal(slider('pe-thumb-r'),-100,`${key}: re-entered, the right thumb reads -100`);
    results.push(row);
    if(VERBOSE)console.log(JSON.stringify(row));
  }finally{people.dispose();}
}
for(const [f,k] of PEOPLE)await one(f,k);
console.log(`PASS pose: thumb slider (${results.map(r=>r.who).join(', ')}): reads back -100/-50/50/100/0 both hands, hinges within [-8,55]/[-12,75], base ≤58° in/≤40° out; grip and thumb independent; a fist wraps a thumb left as built; stored, undo, mirror, Auto-key, re-enter`);
