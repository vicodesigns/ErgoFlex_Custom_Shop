// Props with a desk of their own and a time on screen (experience/prop-edits.mjs desk / show):
// cleaning and keys, the film-edits install (another desk's edit is skipped; a timed prop is drawn only inside its
// window, with fade copies of its materials while a fade runs; restore puts everything back), and the importer's
// round trip for a chapter rendered as sub-shots (every sub-shot gets the Director's props).
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {cleanPropEdit,cleanAddEdit,cleanPropEdits,cleanShow,showFactor,propKey,propTarget,describePropEdit,isNoop,mergePropEdits,filmPropEdits} from '../experience/prop-edits.mjs';
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
