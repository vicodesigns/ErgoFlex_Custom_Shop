// Director prop edits (experience/prop-edits.mjs) without a browser: cleaning, the merge into the chapter's
// sceneEdits for the live stage and Render still, film-edits.mjs applying them (world offsets, turns, per-axis
// scale, hide / show over the film's hide, Studio asset targets among same-named props, full restore), the Studio
// "make permanent" write, and the film's round trip (build-round8-director.py --import and its pass, film-cameras
// sceneEditsAdd untouched) in a temp copy of a chapter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {cleanPropEdit,cleanPropEdits,mergePropEdits,effectivePropEdits,filmPropEdits,propKey,describePropEdit,writeSceneAssets,propName,escapeRegex,studioSceneIds} from '../experience/prop-edits.mjs';
import {cleanShot,cleanCut} from '../experience/cuts.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tools=path.join(root,'tools/experience');

// ---- cleaning
assert.equal(cleanPropEdit({match:'^Prop:mug$',position:[0,0,0]}),null,'no change is no edit');
assert.equal(cleanPropEdit({match:'([',position:[1,0,0]}),null,'a broken regex is dropped');
assert.deepEqual(cleanPropEdit({match:'^Prop:mug$',scale:1.5,junk:1}),{match:'^Prop:mug$',scale:[1.5,1.5,1.5]});
assert.deepEqual(cleanPropEdit({match:'^Oak chair$',asset:'library:humboldt:room:10:chair',near:[1,2,.1],position:[.123456,0,-.2],rotation:[0,15,0],hide:false,label:'Oak chair'}),
  {match:'^Oak chair$',asset:'library:humboldt:room:10:chair',near:[1,2,.1],label:'Oak chair',position:[.1235,0,-.2],rotation:[0,15,0],hide:false});
assert.deepEqual(cleanPropEdits({propEdits:[{match:'^A$',position:[1,0,0]},{match:'^A$',position:[2,0,0]},{match:'^B$'}]}).propEdits,[{match:'^A$',position:[2,0,0]}],'one edit per prop, the last wins');
assert.deepEqual(cleanPropEdits({}),{});assert.deepEqual(cleanPropEdits({propEdits:[]}),{propEdits:[]},'[] is kept: he reset every prop');
assert.equal(escapeRegex('Oak chair · lichen (2)'),'Oak chair · lichen \\(2\\)');assert.equal(propName('Prop:steelcase-leap-v2'),'Steelcase leap v2');assert.equal(propName('Oak study chair · lichen'),'Oak study chair · lichen');
assert.deepEqual(studioSceneIds({room:'library',layout:'humboldt'}),['library:humboldt','library']);
assert.equal(describePropEdit({position:[.3,0,-.4],rotation:[0,15,0],scale:[1.2,1.2,1.2],hide:true}),'moved 0.5 m (x +0.3, z −0.4), turned 15° about y, scaled ×1.2, hidden');
// The cut keeps them through cleanShot / cleanCut (draft and Export cut).
const pe=[{match:'^Prop:painted-mug$',asset:'home:desktop:3:painted-mug',hide:true},{match:'^Prop:steelcase-leap-v2$',position:[.5,0,-.25],rotation:[0,30,0],scale:[1,1.1,1]}];
assert.equal('propEdits' in cleanShot({id:'x',room:'product'}),false);
assert.deepEqual(cleanShot({id:'x',room:'product',propEdits:pe}).propEdits,pe);
const cut=cleanCut({schema:'ergoflex.client-cut',version:1,id:'film-rise',name:'x',shots:[{id:'rise',room:'product',propEdits:pe}]});assert.deepEqual(cut.shots[0].propEdits,pe);

// ---- merge: hand-made film edits first, then the Director's (earlier director entries replaced)
const film={id:'rise',seconds:16,sceneEdits:[{match:'^Prop:painted-mug$',hide:true},{match:'^Commons reading lamp$',position:[0,0,.45]},{match:'^Old$',position:[1,0,0],director:true}]};
assert.deepEqual(mergePropEdits(film,{id:'rise'}),{},'no propEdits: the film shot as it is');
assert.deepEqual(effectivePropEdits(film,{id:'rise'}),[{match:'^Old$',position:[1,0,0]}],'an earlier export\'s entries are the Director\'s edits');
assert.deepEqual(filmPropEdits(film),[{match:'^Old$',position:[1,0,0]}]);
const merged=mergePropEdits(film,{propEdits:pe}).sceneEdits;
assert.deepEqual(merged.map(e=>[e.match,!!e.director]),[['^Prop:painted-mug$',false],['^Commons reading lamp$',false],['^Prop:painted-mug$',true],['^Prop:steelcase-leap-v2$',true]]);
assert.deepEqual(mergePropEdits(film,{propEdits:[]}).sceneEdits.map(e=>e.match),['^Prop:painted-mug$','^Commons reading lamp$'],'reset all drops the earlier export\'s entries');
const shot={id:'rise',room:'home',seconds:16,propEdits:pe};
assert.deepEqual(liveFilmShot(film,shot).sceneEdits,merged,'live stage');assert.deepEqual(filmRenderShot(film,shot,[]).sceneEdits,merged,'Render still: the same sceneEdits');
assert.deepEqual(film.sceneEdits.length,3,'the film shot itself is untouched');

// ---- film-edits applies them (in node: a scene, the desk, a room group with an offset)
const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
globalThis.window={ErgoFlex:{loadedModel:desk,roomScene:'home'}};
const {installEdits,editTargets}=await import('../tools/experience/film-edits.mjs');
const room=new THREE.Group();room.name='Room:home';room.position.set(10,0,0);room.rotation.y=Math.PI/2;scene.add(room);
const prop=(name,x,z,key)=>{const g=new THREE.Group();g.name=name;g.position.set(x,0,z);if(key)Object.assign(g.userData,{sceneAsset:true,sceneAssetKey:key});g.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5)));room.add(g);return g;};
const chairs=[prop('Oak chair',0,0,'home:room:0:chair'),prop('Oak chair',1,0,'home:room:1:chair'),prop('Oak chair',2,0,'home:room:2:chair')],mug=prop('Prop:painted-mug',0,1,'home:desktop:3:painted-mug');
scene.updateMatrixWorld(true);
assert.equal(editTargets({match:'^Oak chair$'}).length,3);assert.deepEqual(editTargets({match:'^Oak chair$',asset:'home:room:1:chair'}),[chairs[1]],'asset: one of several same-named props');
const w0=chairs[1].getWorldPosition(new THREE.Vector3()),r0=chairs[1].rotation.clone(),s0=chairs[1].scale.clone();
const fx=installEdits({sceneEdits:[{match:'^Prop:painted-mug$',hide:true},{match:'^Oak chair$',asset:'home:room:1:chair',position:[.3,0,-.4],rotation:[0,15,0],scale:[1,1.2,.8],director:true},{match:'^Prop:painted-mug$',hide:false,director:true}]});
assert.deepEqual(fx.count,[1,1,1]);
const w1=chairs[1].getWorldPosition(new THREE.Vector3());assert.deepEqual(w1.clone().sub(w0).toArray().map(v=>+v.toFixed(6)),[.3,0,-.4],'position: a world offset, whatever the room group\'s transform');
assert.ok(Math.abs(chairs[1].rotation.y-r0.y-THREE.MathUtils.degToRad(15))<1e-9);assert.deepEqual(chairs[1].scale.toArray().map(v=>+v.toFixed(6)),[1,1.2,.8],'per-axis scale');
assert.equal(chairs[0].position.x,0,'its twins stay');assert.equal(mug.visible,true,'hide:false after the film\'s hide shows it again');
mug.visible=false;assert.equal(mug.visible,false,'and hands it back to the app (it may hide it itself)');mug.visible=true;
assert.deepEqual(chairs[1].userData.__filmFxEdits.map(e=>!!e.director),[true],'objects know which edits act on them');
fx.restore();
assert.deepEqual(chairs[1].getWorldPosition(new THREE.Vector3()).toArray().map(v=>+v.toFixed(6)),w0.toArray().map(v=>+v.toFixed(6)));assert.ok(chairs[1].rotation.equals(r0));assert.ok(chairs[1].scale.equals(s0));
assert.equal(mug.visible,true);assert.equal(Object.getOwnPropertyDescriptor(mug,'visible').writable,true,'restore leaves a plain property');assert.equal(chairs[1].userData.__filmFxEdits,undefined);
{const fx2=installEdits({sceneEdits:[{match:'^Prop:painted-mug$',hide:true}]});assert.equal(mug.visible,false);mug.visible=true;assert.equal(mug.visible,false,'the film\'s sticky hide still holds');fx2.restore();assert.equal(mug.visible,true);}
{const fx3=installEdits({sceneEdits:[{match:'^Prop:painted-mug$',hide:false}]});assert.equal(mug.visible,true,'hide:false alone changes nothing');fx3.restore();}

// ---- Make permanent: only the confirmed props, in Studio's per-room record
const studio=JSON.stringify({'home:house':{removed:['scene:home:house:x'],added:[{editorId:'scene:home:house:custom:1',propId:'ficus'}],transforms:{'scene:home:house:custom:1':{p:{x:1,y:0,z:0}}}},'library:humboldt':{removed:[],added:[],transforms:{}}});
const T={p:{x:500,y:0,z:-250},q:{x:0,y:.13,z:0,w:.99},s:{x:1,y:1.1,z:1}};
const out=JSON.parse(writeSceneAssets(studio,'home:house',[{editorId:'scene:home:room:1:chair',transform:T},{editorId:'scene:home:house:custom:1',remove:true},{editorId:'scene:home:desktop:3:painted-mug',remove:true},{editorId:'nope',remove:true}]));
assert.deepEqual(out['home:house'].transforms['scene:home:room:1:chair'],T);assert.deepEqual(out['home:house'].added,[],'a Studio addition is dropped');
assert.equal(out['home:house'].transforms['scene:home:house:custom:1'],undefined);assert.deepEqual(out['home:house'].removed,['scene:home:house:x','scene:home:desktop:3:painted-mug'],'a default prop is removed');
assert.deepEqual(out['library:humboldt'],JSON.parse(studio)['library:humboldt'],'other rooms untouched');
assert.deepEqual(JSON.parse(writeSceneAssets(null,'gym:house',[{editorId:'scene:gym:x',transform:T}])),{'gym:house':{removed:[],added:[],transforms:{'scene:gym:x':T}}});

// ---- the film's round trip in a temp chapter: --import keeps them, the pass writes them after the hand-made edits
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'director-props-')),H=path.join(tmp,'hq'),py=(...a)=>execFileSync('python3',a,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();
fs.mkdirSync(path.join(H,'shots'),{recursive:true});
const v=(x,z)=>({position:[x,1.6,z],target:[0,1,0],fov:35});
const filmShot={id:'media',room:'music',kind:'room',seconds:12,cameraPlan:{keys:[{at:0,...v(2,2)},{at:12,...v(-2,2)}]},
  sceneEdits:[{match:'^Prop:steelcase-leap-v2$',position:[2.92,0,-1.8],rotation:[0,35,0]},{match:'^Piano bench$',position:[0,0,.35]},{match:'^Gone$',hide:true,director:true}]};
fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify({shots:[filmShot]}));fs.writeFileSync(path.join(H,'shots','10.json'),JSON.stringify(filmShot));
const link=path.join(tmp,'link.json');py(path.join(tools,'director-bridge.py'),'link',path.join(H,'shots','10.json'),'--json',link);
const page=JSON.parse(fs.readFileSync(link,'utf8')),mine=[{match:'^Piano bench$',position:[.1,0,0],label:'Piano bench'},{match:'^Prop:painted-mug$',asset:'music:desktop:2:painted-mug',hide:true}];
const exportOf=propEdits=>{const c=cleanCut({...page,shots:[{...page.shots[0],...(propEdits?{propEdits}:{})}]});const f=path.join(tmp,'Film-chapter-media.json');fs.writeFileSync(f,JSON.stringify(c));return f;};
const read=f=>JSON.parse(fs.readFileSync(path.join(H,f),'utf8')),edits=()=>read('review-cut.json').shots[0].sceneEdits;
const script=path.join(tools,'build-round8-director.py');
py(script,H,'--import',exportOf(mine));assert.deepEqual(read('director-camera-media.json').props,mine,'kept beside the camera keys');
py(script,H);
assert.deepEqual(edits(),[filmShot.sceneEdits[0],filmShot.sceneEdits[1],...mine.map(e=>({...e,director:true}))],'hand-made first, the Director\'s after, earlier director entries replaced');
assert.deepEqual(read('shots/10.json').sceneEdits,edits(),'the render shot too');
// A builder or film-cameras sceneEditsAdd rewrites the hand-made edits: the next pass puts his back after them.
const rc=read('review-cut.json');rc.shots[0].sceneEdits=[{match:'^Prop:steelcase-leap-v2$',position:[3,0,-1.8]},{match:'^Piano bench$',position:[0,0,.4]}];fs.writeFileSync(path.join(H,'review-cut.json'),JSON.stringify(rc));
py(script,H);assert.deepEqual(edits().map(e=>[e.match,e.position?.[2]??null,!!e.director]),[['^Prop:steelcase-leap-v2$',-1.8,false],['^Piano bench$',.4,false],['^Piano bench$',0,true],['^Prop:painted-mug$',null,true]]);
// An export without propEdits keeps them; propEdits [] removes them.
py(script,H,'--import',exportOf(null));py(script,H);assert.equal(edits().filter(e=>e.director).length,2,'an export that never touched props keeps the earlier ones');
py(script,H,'--import',exportOf([]));py(script,H);assert.deepEqual(edits().map(e=>e.match),['^Prop:steelcase-leap-v2$','^Piano bench$'],'reset all in the Director clears them from the film');
fs.rmSync(tmp,{recursive:true,force:true});
console.log('Director props: cleaning and the cut, the merge after the film\'s hand-made sceneEdits for the live stage and Render still, film-edits world offsets / turns / per-axis scale / hide and show / Studio asset targets / full restore, the Studio write, and the film round trip (import, pass, builders\' edits kept, keep / reset) all verified.');
