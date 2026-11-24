// Props with a desk of their own and a time on screen (experience/prop-edits.mjs desk / show):
// cleaning and keys, the film-edits install (another desk's edit is skipped; a timed prop is drawn only inside its
// window, with fade copies of its materials while a fade runs; restore puts everything back), and the importer's
// round trip for a chapter rendered as sub-shots (every sub-shot gets the Director's props).
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {cleanPropEdit,cleanAddEdit,cleanPropEdits,cleanShow,showFactor,propKey,propTarget,describePropEdit,isNoop,mergePropEdits,filmPropEdits,copyPropEffect,cleanPropEffect,applyPropEffect,describePropEffect,copyPropPosition,cleanPropPosition,applyPropPositionToAdd,describePropPosition,cleanPasteMask,describePasteMask} from '../experience/prop-edits.mjs';
import {cleanPropLayer} from '../experience/prop-layers.mjs';
import {cleanCut} from '../experience/cuts.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tools=path.join(root,'tools','experience');

// ---- cleaning, keys, words
assert.deepEqual(cleanShow({from:1.004,to:5.256,fadeIn:.4,fadeOut:0}),{from:1,to:5.26,fadeIn:.4});
assert.equal(cleanShow({from:3,to:3.05}),undefined,'shorter than a tenth of a second is no window');
assert.equal(cleanShow({from:'1',to:2}),undefined);assert.equal(cleanShow(null),undefined);
assert.deepEqual(cleanShow({from:-2,to:1,fadeIn:9,fadeOut:9}),{from:0,to:1,fadeIn:1,fadeOut:1},'fades no longer than the window, never before 0');
const timed=cleanPropEdit({match:'^Accessory:wide-monitor$',label:'Accessory:wide-monitor',desk:'office',show:{from:0,to:6.1,fadeOut:.5},junk:1});
assert.deepEqual(timed,{match:'^Accessory:wide-monitor$',label:'Accessory:wide-monitor',desk:'office',show:{from:0,to:6.1,fadeOut:.5}},'a window alone is an edit');
assert.equal(isNoop(timed),false);
assert.equal(cleanPropEdit({match:'^x$',desk:'office'}),null,'a desk alone changes nothing');
assert.equal(cleanPropEdit({match:'^x$',desk:'Office!',position:[1,0,0]}).desk,undefined,'an unusual desk id is dropped');
assert.equal(propKey(timed),'["^Accessory:wide-monitor$","","",null,"office"]');
assert.equal(propKey({match:'^Accessory:wide-monitor$'}),'["^Accessory:wide-monitor$","","",null]','the same item without a desk is another prop (every desk)');
assert.notEqual(propKey({match:'^a$',desk:'office'}),propKey({match:'^a$',desk:'gaming'}));
assert.deepEqual(propTarget(timed),{match:'^Accessory:wide-monitor$',desk:'office',label:'Accessory:wide-monitor'});
assert.match(describePropEdit(timed),/on screen 0–6\.1 s after its desk comes in, fades out 0\.5 s/);
assert.match(describePropEdit(cleanPropEdit({match:'^a$',hide:true,show:{from:2,to:4}})),/hidden, on screen 2–4 s$/);
const add=cleanAddEdit({add:{asset:'ergoflex-mug'},id:'ab12',parent:'desk',label:'Mug',desk:'gaming',show:{from:1,to:100000,fadeIn:.3}});
assert.equal(add.desk,'gaming');assert.deepEqual(add.show,{from:1,to:100000,fadeIn:.3});assert.match(describePropEdit(add),/added on the desk, on screen/);
// an added prop may ride one of the desk's shelves
assert.equal(cleanAddEdit({add:{asset:'ergoflex-mug'},id:'ab13',parent:'lower-shelf'}).parent,'lower-shelf');assert.equal(cleanAddEdit({add:{asset:'ergoflex-mug'},id:'ab13',parent:'ceiling'}).parent,'room');
assert.match(describePropEdit(cleanAddEdit({add:{asset:'ergoflex-mug'},id:'ab13',parent:'shelf'})),/added on the top shelf/);
// two edits to the same item on two desks both stay; the same key twice keeps the last
assert.equal(cleanPropEdits({propEdits:[{match:'^a$',desk:'office',hide:true},{match:'^a$',desk:'gaming',hide:true},{match:'^a$',desk:'gaming',show:{from:0,to:2}}]}).propEdits.length,2);
// layers keep a desk's key
assert.deepEqual(cleanPropLayer({name:'L',items:[propKey(timed),propKey({match:'^b$'}),'["^b$","","",null,"Bad!"]']}).items,[propKey(timed),propKey({match:'^b$'})]);
// the same rule the stage draws with
assert.deepEqual([0,.99,1,1.2,3,5,6.1,6.2].map(t=>showFactor({from:1,to:6.1,fadeIn:.4,fadeOut:2.2},t)).map(v=>Math.round(v*100)/100),[0,0,0,.5,1,.5,0,0]);
assert.equal(showFactor(undefined,3),1);

// ---- film-edits on a stage (node): two desks' edits, a timed prop, a fade
const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
globalThis.window={ErgoFlex:{loadedModel:desk}};
const E=await import('../tools/experience/film-edits.mjs');
const mat=new THREE.MeshStandardMaterial({color:'#888'}),item=(name,x)=>{const g=new THREE.Group();g.name=name;g.position.x=x;g.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),mat));scene.add(g);return g;};
const monitor=item('Accessory:wide-monitor',0),mug=item('Accessory:mug',1),mesh=monitor.children[0];scene.updateMatrixWorld(true);
assert.equal(E.forThisDesk({desk:'office'},{preset:'office'}),true);assert.equal(E.forThisDesk({desk:'office'},{preset:'gaming'}),false);assert.equal(E.forThisDesk({},{preset:'gaming'}),true);
const edits=[{match:'^Accessory:wide-monitor$',desk:'office',show:{from:0,to:6.1,fadeOut:1},director:true},{match:'^Accessory:wide-monitor$',desk:'gaming',position:[.5,0,0],director:true},{match:'^Accessory:mug$',show:{from:20,to:30},director:true}];
// the office sub-shot (renderRange starts at 12.5 s): the monitor leaves at 18.6 s; the gaming move is not applied
{const fx=E.installEdits({preset:'office',renderRange:[12.5,21.9],seconds:48,sceneEdits:structuredClone(edits)});
  assert.deepEqual(fx.count,[1,0,1],'the gaming desk\'s edit is skipped in the office shot');assert.equal(monitor.position.x,0);
  fx.apply(14);assert.equal(monitor.visible,true);assert.equal(mesh.material,mat,'no copies while it is fully on');assert.equal(mug.visible,false,'chapter seconds for an edit without a desk');
  fx.apply(18.1);assert.equal(monitor.visible,true);assert.notEqual(mesh.material,mat,'a see-through copy while it fades');assert.equal(mesh.material.transparent,true);assert.ok(Math.abs(mesh.material.opacity-.5)<1e-6,'half way through the fade out: '+mesh.material.opacity);
  fx.apply(19);assert.equal(monitor.visible,false);assert.equal(mesh.material,mat,'the copy is gone after the fade');
  monitor.visible=true;assert.equal(monitor.visible,false,'the app setting visible does not show it outside its time');
  fx.apply(25);assert.equal(mug.visible,true);fx.apply(31);assert.equal(mug.visible,false);
  fx.apply(18.1);fx.restore();assert.equal(mesh.material,mat,'restore during a fade puts the material back');assert.equal(monitor.visible,true);assert.equal(mug.visible,true);assert.equal(Object.getOwnPropertyDescriptor(monitor,'visible').value,true,'visible is a plain value again');}
// the gaming sub-shot: the move applies, the office window does not
{const fx=E.installEdits({preset:'gaming',renderRange:[0,5.3],seconds:48,sceneEdits:structuredClone(edits)});
  assert.deepEqual(fx.count,[0,1,1]);assert.ok(Math.abs(monitor.position.x-.5)<1e-9);fx.apply(40);assert.equal(monitor.visible,true,'no window on this desk');fx.restore();assert.equal(monitor.position.x,0);}
// addParent: the desktop and the shelves are the product desk's accessory mounts
{const mounts=new Map(['desktop','shelf','lower-shelf'].map(r=>{const g=new THREE.Group();g.name='Accessory mount:'+r;scene.add(g);return [r,{group:g}];}));
  window.ErgoFlex.workspaceAccessories={mounts,scale:.001};
  assert.equal(E.addParent('desk'),mounts.get('desktop').group);assert.equal(E.addParent('shelf'),mounts.get('shelf').group);assert.equal(E.addParent('lower-shelf'),mounts.get('lower-shelf').group);
  assert.equal(E.addParent('base-shelf'),null,'a desk without that shelf');assert.equal(E.addParent('room'),scene,'no room: the stage');assert.equal(E.addParent('constructor'),scene,'an unknown kind is the room');
  for(const m of mounts.values())m.group.removeFromParent();delete window.ErgoFlex.workspaceAccessories;}
// a timed prop the film hides stays hidden; hidden wins inside the window too
{const fx=E.installEdits({seconds:10,sceneEdits:[{match:'^Accessory:mug$',hide:true},{match:'^Accessory:mug$',show:{from:2,to:4},director:true}]});
  fx.apply(3);assert.equal(mug.visible,false,'hide wins');fx.restore();assert.equal(mug.visible,true);}
// a prop the desk's auto-stow put away (userData.stowHidden, the easel under 50 deg) stays up through its own window
{const fx=E.installEdits({seconds:10,sceneEdits:[{match:'^Accessory:mug$',show:{from:2,to:6},director:true}]});
  mug.userData.stowHidden=true;mug.visible=false;   // what DeskAutoStow.hideItems does
  fx.apply(3);assert.equal(mug.visible,true,'inside its window the stowed prop is up');
  fx.apply(7);assert.equal(mug.visible,false,'outside the window it is gone');
  mug.userData.stowHidden=false;mug.visible=false;fx.apply(3);assert.equal(mug.visible,false,'a prop hidden for any other reason stays hidden');
  fx.restore();mug.visible=true;delete mug.userData.stowHidden;}
{const fx=E.installEdits({seconds:10,sceneEdits:[{match:'^Accessory:mug$',hide:true},{match:'^Accessory:mug$',show:{from:2,to:6},director:true}]});
  mug.userData.stowHidden=true;fx.apply(3);assert.equal(mug.visible,false,'the film\'s own hide still wins over a window');fx.restore();mug.visible=true;delete mug.userData.stowHidden;}
// installed while paused: right for the last time applied, before the next frame
{const fx0=E.installEdits({seconds:10,sceneEdits:[]});fx0.apply(7);fx0.restore();
  const fx=E.installEdits({seconds:10,sceneEdits:[{match:'^Accessory:mug$',show:{from:2,to:4},director:true}]});assert.equal(mug.visible,false,'outside its window at 7 s without a frame');fx.restore();}

// ---- the importer: a chapter rendered as sub-shots gets the Director's props in every sub-shot
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'prop-timing-')),H=path.join(tmp,'hq'),py=(...a)=>execFileSync('python3',a,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();
fs.mkdirSync(path.join(H,'shots'),{recursive:true});
const v=(x,z)=>({position:[x,1.6,z],target:[0,1,0],fov:35});
const hero={id:'hero',room:'product',kind:'hero',seconds:20,preset:'gaming',presets:['gaming','office'],subshots:{A:[0,10.3],B:[9.7,20]},cameraPlan:{keys:[{at:0,...v(2,2)},{at:20,...v(-2,2)}]},sceneEdits:[{match:'^Wheel',hide:true}]};
const sub=(n,preset,rr)=>({...structuredClone(hero),subshot:n,preset,renderRange:rr,sceneEdits:[{match:'^Wheel',hide:true},{match:'^Old$',hide:true,director:true}]});
fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[hero]}));fs.writeFileSync(path.join(H,'shots','13.json'),JSON.stringify(hero));
fs.writeFileSync(path.join(H,'shots','13-subshots.json'),JSON.stringify({name:'t',shots:[sub('A','gaming',[0,10.3]),sub('B','office',[9.7,20])]}));
const link=path.join(tmp,'link.json');py(path.join(tools,'director-bridge.py'),'link',path.join(H,'shots','13.json'),'--json',link);
const page=JSON.parse(fs.readFileSync(link,'utf8')),mine=[timed,add,cleanPropEdit({match:'^Accessory:cable-tray$',hide:true})];
const cut=cleanCut({...page,shots:[{...page.shots[0],propEdits:mine}]});assert.deepEqual(cut.shots[0].propEdits,mine,'the cut keeps desk and show');
const file=path.join(tmp,'Film-chapter-hero.json');fs.writeFileSync(file,JSON.stringify(cut));
const script=path.join(tools,'build-round8-director.py'),read=f=>JSON.parse(fs.readFileSync(path.join(H,f),'utf8'));
py(script,H,'--import',file);assert.deepEqual(read('director-camera-hero.json').props,mine,'the import keeps desk and show');
py(script,H);
const director=s=>(s.sceneEdits||[]).filter(e=>e.director).map(({director,...e})=>e);
assert.deepEqual(director(read('review-cut.json').shots[0]),mine,'the chapter\'s own shot lists them all (what the Director reopens)');
assert.deepEqual(filmPropEdits(read('review-cut.json').shots[0]),mine,'and they reopen as the same Director edits');
for(const s of read('shots/13-subshots.json').shots){
  assert.deepEqual(director(s),mine,`sub-shot ${s.subshot} carries the Director's props (film-edits keeps each to its desk)`);
  assert.deepEqual(s.sceneEdits[0],{match:'^Wheel',hide:true},'after the hand-made edits; the earlier Director entry is replaced');
  assert.deepEqual(s.sceneEdits.filter(e=>E.forThisDesk(e,s)&&e.director).map(e=>e.match),s.preset==='office'?[timed.match,'^Accessory:cable-tray$']:[add.match,'^Accessory:cable-tray$']);
}
assert.equal(fs.readFileSync(path.join(H,'shots','13-subshots.json'),'utf8').includes('\n'),false,'the sub-shots file keeps its one-line form');
fs.rmSync(tmp,{recursive:true,force:true});
// the live stage's merge: the sub-shot's hand-made edits, then every Director edit (film-edits skips the other desks')
{const setup=sub('B','office',[9.7,20]),m=mergePropEdits(setup,{propEdits:mine}).sceneEdits;assert.equal(m.length,4);assert.deepEqual(m.slice(1).map(e=>e.desk||null),['office','gaming',null]);}
console.log('Props with a desk of their own and a time on screen: cleaning, keys and layers, the stage (another desk\'s edit skipped, drawn only in its window, fade copies, restore), and the importer writing them into every sub-shot.');
// an end left open (100000) reads "from … s", not "1–100000 s" (17 Nov: the Make permanent panel said "on screen 3–100000 s")
assert.match(describePropEdit(add),/on screen from 1 s after its desk comes in, fades in 0\.3 s/);assert.match(describePropEdit(cleanPropEdit({match:'^a$',show:{from:0,to:100000,fadeOut:1}})),/on screen the whole time, fades out 1 s/);

// ---- Copy & paste prop timing / fade effects (single, multi-select, cross-desk, fades-only)
{
  const srcFx=copyPropEffect({from:7.0,to:18.7,fadeIn:0.4,fadeOut:1.8,ease:'smooth'},{lo:0,hi:23.5,desk:null},'Drafting kit');
  assert.deepEqual(srcFx,{from:7,to:18.7,relFrom:7,relTo:18.7,fullStart:false,fullEnd:false,fadeIn:0.4,fadeOut:1.8,ease:'smooth',desk:null,label:'Drafting kit'});
  assert.deepEqual(cleanPropEffect(JSON.parse(JSON.stringify(srcFx))),srcFx,'clipboard JSON round-trip');
  assert.equal(describePropEffect(srcFx),'7–18.7 s · fade in 0.4 s, out 1.8 s · smooth');
  // Paste timing & fades onto a brand-new added prop spanning the whole chapter
  const pastedAll=applyPropEffect(srcFx,{from:0,to:23.5,fadeIn:0,fadeOut:0,ease:null},{lo:0,hi:23.5,desk:null},{mode:'all'});
  assert.deepEqual(pastedAll,{from:7,to:18.7,fadeIn:0.4,fadeOut:1.8,ease:'smooth'});
  // Paste fades only: preserves target prop's own appear/leave window, clamps fades if window is shorter
  const pastedFades=applyPropEffect(srcFx,{from:2,to:3.2,fadeIn:0,fadeOut:0,ease:null},{lo:0,hi:23.5,desk:null},{mode:'fades'});
  assert.deepEqual(pastedFades,{from:2,to:3.2,fadeIn:0.4,fadeOut:1.2,ease:'smooth'},'fades clamped to 1.2 s target window');
  // Paste across sub-shot desks maps relative to the target desk's span start
  const deskFx=copyPropEffect({from:13.5,to:18.5,fadeIn:0.5,fadeOut:0.5,ease:null},{lo:12.5,hi:21.9,desk:'office'},'Monitor');
  const otherDesk=applyPropEffect(deskFx,{from:0,to:10,fadeIn:0,fadeOut:0,ease:null},{lo:0,hi:10,desk:'gaming'},{mode:'all'});
  assert.deepEqual(otherDesk,{from:1,to:6,fadeIn:0.5,fadeOut:0.5,ease:null},'relative timing preserved across sub-shot desks');
  // Respects a target prop's own film fade bounds
  const filmBounded=applyPropEffect(srcFx,{from:8,to:15,fadeIn:0,fadeOut:0,ease:null,film:{from:8,to:15}},{lo:0,hi:23.5,desk:null},{mode:'all'});
  assert.deepEqual(filmBounded,{from:8,to:15,fadeIn:0.4,fadeOut:1.8,ease:'smooth'});
  // Whole-time cut copy/paste
  const cutFx=copyPropEffect({from:0,to:20,fadeIn:0,fadeOut:0,ease:null},{lo:0,hi:20,desk:null},'Lamp');
  assert.equal(describePropEffect(cutFx),'whole time · cut');
  assert.deepEqual(applyPropEffect(cutFx,{from:4,to:10,fadeIn:1,fadeOut:1,ease:'smooth'},{lo:0,hi:20,desk:null},{mode:'all'}),{from:0,to:20,fadeIn:0,fadeOut:0,ease:null});
}

// ---- Copy & paste prop position & full transform (shelf-aligned across desks & chapters)
{
  const shelfSrc=cleanAddEdit({add:{asset:'book-stack'},id:'bk01',label:'Books',parent:'shelf',desk:'gaming',position:[0.12,0,0.05],rotation:[0,30,0],scale:[1.2,1.2,1.2]});
  const clip=copyPropPosition(shelfSrc,{world:[1.5,1.4,-0.3],label:'Books'});
  assert.deepEqual(cleanPropPosition(JSON.parse(JSON.stringify(clip))),clip,'position clipboard JSON round-trip');
  assert.equal(describePropPosition(clip),'Books · Desktop shelf');
  // Target added prop on Desk 2 (starts on 'desk' at origin): Paste position moves it to 'shelf' at [0.12, 0, 0.05], keeping its own desk/id/rotation/scale
  const target=cleanAddEdit({add:{asset:'ergoflex-mug'},id:'mg02',label:'Mug',desk:'office',parent:'desk',position:[0,0,0],rotation:[0,90,0],scale:[1,1,1]});
  const moved=applyPropPositionToAdd(clip,target,{includeRotationScale:false,hasMount:()=>true});
  assert.equal(moved.parent,'shelf');assert.deepEqual(moved.position,[0.12,0,0.05]);
  assert.equal(moved.desk,'office','keeps target desk sub-shot');assert.deepEqual(moved.rotation,[0,90,0],'position-only keeps target rotation');assert.deepEqual(moved.scale,[1,1,1],'position-only keeps target scale');
  // Full transform also copies rotation and scale
  const xform=applyPropPositionToAdd(clip,target,{includeRotationScale:true,hasMount:()=>true});
  assert.equal(xform.parent,'shelf');assert.deepEqual(xform.position,[0.12,0,0.05]);assert.deepEqual(xform.rotation,[0,30,0]);assert.deepEqual(xform.scale,[1.2,1.2,1.2]);
  // Scene/film prop world position pasted onto added prop via worldToLocal
  const sceneClip=copyPropPosition(null,{world:[2,1.1,-0.5],worldQuat:[0,0.7071,0,0.7071],surface:'lower-shelf',label:'Lamp'});
  assert.equal(sceneClip.kind,'scene');assert.equal(describePropPosition(sceneClip),'Lamp · Desktop shelf (lower)');
  const fromScene=applyPropPositionToAdd(sceneClip,target,{position:true,rotation:true,scale:false,hasMount:()=>true,worldToLocal:(k,w)=>[0.25,0,-0.1],worldQuatToLocal:(k,q)=>[0,90,0]});
  assert.equal(fromScene.parent,'lower-shelf');assert.deepEqual(fromScene.position,[0.25,0,-0.1]);assert.deepEqual(fromScene.rotation,[0,90,0]);
  // Selectable paste mask: defaults to Position + Turn + Scale; supports Turn-only, Scale-only, and Position + Turn
  assert.deepEqual(cleanPasteMask(null),{position:true,rotation:true,scale:true,timing:false});
  assert.equal(describePasteMask(cleanPasteMask(null)),'Position + Turn + Scale');
  assert.equal(describePasteMask({position:true,rotation:true,scale:false,timing:true}),'Position + Turn + Fades');
  const turnOnly=applyPropPositionToAdd(clip,target,{position:false,rotation:true,scale:false});
  assert.equal(turnOnly.parent,'desk','turn-only keeps surface');assert.deepEqual(turnOnly.position,[0,0,0],'turn-only keeps position');assert.deepEqual(turnOnly.rotation,[0,30,0]);assert.deepEqual(turnOnly.scale,[1,1,1]);
  const scaleOnly=applyPropPositionToAdd(clip,target,{position:false,rotation:false,scale:true});
  assert.deepEqual(scaleOnly.position,[0,0,0]);assert.deepEqual(scaleOnly.rotation,[0,90,0]);assert.deepEqual(scaleOnly.scale,[1.2,1.2,1.2]);
  const posTurn=applyPropPositionToAdd(clip,target,{position:true,rotation:true,scale:false});
  assert.equal(posTurn.parent,'shelf');assert.deepEqual(posTurn.position,[0.12,0,0.05]);assert.deepEqual(posTurn.rotation,[0,30,0]);assert.deepEqual(posTurn.scale,[1,1,1],'pos+turn keeps scale');
}
