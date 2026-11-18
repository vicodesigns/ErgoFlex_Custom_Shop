// "Travels with" (film-edits.mjs follow / place, prop-edits.mjs cleanPlace): a prop picked to travel with a desk surface
// stays where it was on screen at the pick, then follows that surface (the shelf unit as it lifts, the desktop as it
// tilts, the lift frame without tilt, the base not at all), and restore() puts it back under its own parent.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cleanPropEdit,cleanPlace} from '../experience/prop-edits.mjs';
const scene=new THREE.Scene(),desk=new THREE.Group();desk.name='Desk';scene.add(desk);
const mount=(name,y)=>{const g=new THREE.Group();g.name=name;g.position.set(0,y,0);g.scale.setScalar(.001);desk.add(g);return g;};   // desk mounts are in millimetres
const base=mount('base',.1),top=mount('desktop',.75),shelf=mount('shelf',1.1),lower=mount('lower',.95);
globalThis.window={ErgoFlex:{loadedModel:desk,heightInches:28,sceneDesks:{active:{product:true,rig:{mounts:{desktop:top,shelf,'lower-shelf':lower,'base-shelf':base}}}}}};
const E=await import('../tools/experience/film-edits.mjs');
// the toy-story RC controller: built on the base shelf, lifted up to the top shelf by hand (as in Vico's cut)
const rc=new THREE.Group();rc.name='Robot RC test controller';rc.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.02,.06)));rc.position.set(5,1000,22);rc.scale.setScalar(850);base.add(rc);scene.updateMatrixWorld(true);
const at=()=>{scene.updateMatrixWorld(true);return rc.getWorldPosition(new THREE.Vector3());},near=(a,b,m)=>assert.ok(a.distanceTo(b)<1e-6,`${m}: ${a.toArray()} vs ${b.toArray()}`);
// the pick, as the Director does it (scene-prop-editor.mjs setFollow): the prop's transform in the surface's frame now
function pick(kind){const F=E.followMatrix(kind),local=F.clone().invert().multiply(rc.matrixWorld),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();local.decompose(p,q,s);
  const r=new THREE.Euler().setFromQuaternion(q),deg=THREE.MathUtils.radToDeg;return cleanPropEdit({match:'^Robot RC test controller$',follow:kind,place:{position:p.toArray(),rotation:[r.x,r.y,r.z].map(deg),scale:s.toArray()},position:[9,9,9]});}
const w0=at(),parent0=rc.parent,p0=rc.position.clone(),s0=rc.scale.clone();
{const e=pick('shelf');assert.deepEqual(Object.keys(e).sort(),['follow','match','place'],'the offsets give way to the place');
  const fx=E.installEdits({sceneEdits:[{...e,director:true}]});assert.equal(rc.parent,shelf);near(at(),w0,'kept where it was at the pick');
  shelf.position.y+=.2;near(at(),w0.clone().add(new THREE.Vector3(0,.2,0)),'rides the shelf unit up');
  base.position.y-=.05;near(at(),w0.clone().add(new THREE.Vector3(0,.2,0)),'not the base');
  fx.restore();assert.equal(rc.parent,parent0);assert.ok(rc.position.equals(p0)&&rc.scale.equals(s0),'restored under its own parent');shelf.position.y-=.2;base.position.y+=.05;}
{const w=at(),e=pick('desk'),fx=E.installEdits({sceneEdits:[{...e,director:true}]});near(at(),w,'desktop: kept at the pick');
  top.rotation.x=.3;scene.updateMatrixWorld(true);const pv=top.getWorldPosition(new THREE.Vector3()),exp=w.clone().sub(pv).applyAxisAngle(new THREE.Vector3(1,0,0),.3).add(pv);near(at(),exp,'tilts with the desktop');
  top.rotation.x=0;fx.restore();}
{const w=at(),e=pick('lift'),fx=E.installEdits({sceneEdits:[{...e,director:true}]});near(at(),w,'lift: kept at the pick');
  window.ErgoFlex.heightInches=40;near(at(),w.clone().add(new THREE.Vector3(0,12*25.4*.001,0)),'rises 12 in with the desk (no tilt)');
  window.ErgoFlex.heightInches=28;fx.restore();assert.equal(rc.parent,parent0);}
// picked while the desk is up: the place still puts it there, and it lands in the same spot when installed at another height
{window.ErgoFlex.heightInches=36;const w=at(),e=pick('lift');window.ErgoFlex.heightInches=28;const fx=E.installEdits({sceneEdits:[{...e,director:true}]});
  near(at(),w.clone().sub(new THREE.Vector3(0,8*25.4*.001,0)),'installed lower: 8 in lower');window.ErgoFlex.heightInches=36;near(at(),w,'at 36 in again: where it was picked');window.ErgoFlex.heightInches=28;fx.restore();}
// THE BUG (Windows, 17 Nov): the real desk mounts set .matrix themselves with matrixAutoUpdate off (workspace-3d.mjs
// WorkspaceAccessories.update, scene-desk-rig.mjs updatePose); followMatrix's updateMatrix() rebuilt it from the identity
// position, so the pick measured the shelf at the desk's origin (y 0) and the controller floated 1.4 m over it.
{const posed=new THREE.Group();posed.name='Desk dressing:lower-shelf';posed.matrixAutoUpdate=false;desk.add(posed);
  posed.matrix.compose(new THREE.Vector3(.3,.95,-.1),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.4),new THREE.Vector3(.001,.001,.001));posed.matrixWorldNeedsUpdate=true;
  window.ErgoFlex.sceneDesks.active.rig.mounts['lower-shelf']=posed;const before=posed.matrix.clone(),w=at(),e=pick('lower-shelf');
  assert.ok(posed.matrix.equals(before),'measuring the frame leaves the mount\'s own matrix alone');
  assert.ok(Math.abs(e.place.scale[0]-850)<.01,'the place is in the shelf\'s millimetres: scale '+e.place.scale[0]+' (850 here, the controller\'s size over the frame\'s)');
  const fx=E.installEdits({sceneEdits:[{...e,director:true}]});assert.equal(rc.parent,posed);near(at(),w,'lower shelf (a posed mount): kept where it was at the pick');
  fx.restore();window.ErgoFlex.sceneDesks.active.rig.mounts['lower-shelf']=lower;desk.remove(posed);}
assert.equal(cleanPlace({position:[1,2],rotation:[0,0,0],scale:[1,1,1]}),null);assert.equal(cleanPropEdit({match:'x',follow:'nowhere',place:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}}),null,'an unknown surface is no edit');
console.log('prop-travels-with-test: ok (kept at the pick; shelf unit, desktop tilt, lift; restore; cleaning)');
