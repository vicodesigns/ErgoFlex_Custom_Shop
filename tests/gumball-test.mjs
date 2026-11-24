// Rhino's Gumball over the Director's and Studio's gizmos (P3): typed values (inches/fractions/units), negative-scale
// mirror/invert, click-on-handle inline input, per-axis applyAxisTransform, Shift constrain, Ctrl snap, exact redo of
// the last drag, and the World / Object switch.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {parseLength,parseValue,clickableHandle,applyAxisTransform,constrain,enhanceGizmo,setSpaceAll,spaceNow} from '../experience/gumball.mjs';
import {ItemGizmo} from '../scene-item-editing.mjs';
assert.equal(parseLength('12'),304.8,'bare numbers are inches');assert.equal(parseLength('30cm'),300);assert.equal(parseLength('300mm'),300);
assert.equal(parseLength('2ft'),609.6);assert.equal(parseLength('1.5m'),1500);assert.equal(parseLength('-3in'),-76.2);assert.equal(parseLength('abc'),null);
assert.equal(parseLength('2.5'),63.5,'decimal inches');assert.equal(parseLength('2 1/2'),63.5,'mixed fraction inches');
assert.equal(parseLength('-2-1/2"'),-63.5,'negative hyphenated fraction inches');assert.equal(parseLength('3/4'),19.05,'simple fraction inches');
assert.equal(parseLength("1' 6\""),457.2,'feet and inches');assert.equal(parseLength('1/0'),null,'zero denominator rejected');
assert.equal(parseValue('45°','rotate'),45);assert.equal(parseValue('-90','rotate'),-90);assert.equal(parseValue('90','rotate'),90);
assert.equal(parseValue('150%','scale'),1.5);assert.equal(parseValue('2','scale'),2);assert.equal(parseValue('150','scale'),1.5);
assert.equal(parseValue('-1','scale'),-1,'negative scale factor mirrors/inverts');
assert.equal(parseValue('-100%','scale'),-1,'-100% mirrors/inverts');
assert.equal(parseValue('-100','scale'),-1,'bare -100 mirrors/inverts (-1, not -100)');
assert.equal(parseValue('-1.5x','scale'),-1.5);assert.equal(parseValue('×-1','scale'),-1);
assert.equal(parseValue('0','scale'),null,'zero scale is rejected');
assert.ok(clickableHandle('translate','X')&&clickableHandle('rotate','Y')&&clickableHandle('scale','Z')&&clickableHandle('scale','XYZ'));
assert.ok(!clickableHandle('translate','XY')&&!clickableHandle('rotate','XYZE'));
assert.deepEqual(constrain({x:3,y:0,z:1},'XZ'),{x:3,y:0,z:0});assert.deepEqual(constrain({x:1,y:5,z:2},'XYZ'),{x:0,y:5,z:0});assert.deepEqual(constrain({x:1,y:2,z:3},'X'),{x:1,y:2,z:3});

// a fake TransformControls on a real three.js object, a fake stage window
class Listeners{constructor(){this.l={};}addEventListener(t,f){(this.l[t]||=[]).push(f);}removeEventListener(t,f){this.l[t]=(this.l[t]||[]).filter(x=>x!==f);}dispatchEvent(e){for(const f of this.l[e.type]||[])f(e);}}
const el=()=>({style:{},append(){},remove(){},set textContent(v){this.text=v;}});
const win=new Listeners();win.document={createElement:el,body:{append(){}}};win.parent=win;
const gizmo=new Listeners();Object.assign(gizmo,{mode:'translate',axis:null,dragging:false,enabled:true,space:'world',userData:{},object:new THREE.Object3D(),
  snaps:[],setTranslationSnap(v){this.snaps.push(['t',v]);},setRotationSnap(){},setScaleSnap(){},setSpace(s){this.space=s;},domElement:new Listeners()});
const commits=[];let from=null;   // an editor: commits the change between its drag's start and end
gizmo.addEventListener('dragging-changed',e=>{if(e.value)from={p:gizmo.object.position.clone(),s:gizmo.object.scale.clone()};else commits.push({dp:gizmo.object.position.clone().sub(from.p),s:gizmo.object.scale.clone()});});
const msgs=[],g=enhanceGizmo(gizmo,{win,THREE,mmPerUnit:()=>1000,status:m=>msgs.push(m)});
// a drag along +X by 0.1 m (100 mm)
gizmo.dragging=true;gizmo.axis='X';gizmo.dispatchEvent({type:'dragging-changed',value:true});gizmo.object.position.set(.1,0,0);gizmo.dispatchEvent({type:'objectChange'});
gizmo.dragging=false;gizmo.dispatchEvent({type:'dragging-changed',value:false});
assert.equal(commits.length,1);
// then type 12in, Enter: exactly 304.8 mm along the drag from its start
const key=(k,type='keydown',m={})=>{const e={key:k,type,ctrlKey:!!m.ctrl,altKey:false,metaKey:false,shiftKey:!!m.shift,target:null,prevented:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};win.dispatchEvent(e);return e;};
for(const c of '12in')assert.ok(key(c).prevented,'typing is taken by the gizmo right after a drag');
assert.equal(g.typed(),'12in');key('Enter');
assert.ok(Math.abs(gizmo.object.position.x-.3048)<1e-9,'exactly 12 in from the start');
assert.equal(commits.length,2,'the exact redo is one more edit the editor commits');assert.ok(Math.abs(commits[1].dp.x-(.3048-.1))<1e-9);
assert.match(msgs.at(-1),/Moved exactly 12\.0 in · 305 mm/);
// Rhino click-on-handle: clean click (<5px) opens inline numeric input; Escape cancels without leaking; drag does not open popup
gizmo.mode='translate';gizmo.axis='X';
gizmo.domElement.dispatchEvent({type:'pointerdown',button:0,clientX:100,clientY:100});
gizmo.domElement.dispatchEvent({type:'pointerup',button:0,clientX:101,clientY:100});
assert.equal(g.popupOpen(),true,'clicking X arrow opens Rhino handle input');
assert.equal(key('Escape').prevented,true,'Escape closes popup cleanly');
assert.equal(g.popupOpen(),false);
// applyAxis directly along X by 2 1/2 inches (no prior drag required!)
const xBefore=gizmo.object.position.x;
assert.equal(g.applyAxis('translate','X','2 1/2'),true);
assert.ok(Math.abs(gizmo.object.position.x-(xBefore+0.0635))<1e-9,'2 1/2 inches = 0.0635 m along +X');
// applyAxis scale -1 on X ONLY mirrors X without altering Y or Z
assert.equal(g.applyAxis('scale','X','-1'),true);
assert.deepEqual(gizmo.object.scale.toArray(),[-1,1,1],'per-axis scale -1 mirrors only X');
assert.equal(g.applyAxis('scale','Y','150%'),true);
assert.deepEqual(gizmo.object.scale.toArray(),[-1,1.5,1],'per-axis scale 150% scales only Y');
// applyAxisTransform under a rotated + mm-scaled parent (like a tilted desktop or room)
{
  const parent=new THREE.Group();parent.rotation.y=Math.PI/2;parent.scale.setScalar(0.001);
  const child=new THREE.Group();parent.add(child);parent.updateMatrixWorld(true);
  assert.equal(applyAxisTransform({THREE,obj:child,mode:'translate',axis:'X',value:25.4,space:'world',mmPerUnit:1000}),true);
  const wp=child.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(wp.x-0.0254)<1e-6&&Math.abs(wp.z)<1e-6,'1 in world +X moves 0.0254 m in world even under rotated mm parent');
}
// Shift: a plane drag keeps its main axis
gizmo.axis='XZ';gizmo.dragging=true;gizmo.dispatchEvent({type:'dragging-changed',value:true});key('Shift');gizmo.object.position.set(gizmo.object.position.x+.4,0,.1);gizmo.dispatchEvent({type:'objectChange'});
assert.ok(Math.abs(gizmo.object.position.z)<1e-9,'Shift holds the main axis');key('Shift','keyup');
gizmo.dragging=false;gizmo.dispatchEvent({type:'dragging-changed',value:false});
// Ctrl: snapping while held
key('Control');assert.deepEqual(gizmo.snaps.at(-1),['t',.05]);key('Control','keyup');assert.deepEqual(gizmo.snaps.at(-1),['t',null]);
// a turn typed in degrees
gizmo.mode='rotate';gizmo.dragging=true;gizmo.dispatchEvent({type:'dragging-changed',value:true});gizmo.object.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),.3);gizmo.dragging=false;gizmo.dispatchEvent({type:'dragging-changed',value:false});
for(const c of '90')key(c);key('Enter');
const a=2*Math.acos(Math.abs(gizmo.object.quaternion.w))*180/Math.PI;assert.ok(Math.abs(a-90)<1e-6,`turned exactly 90° (${a})`);
// World / Object
setSpaceAll('local');assert.equal(gizmo.space,'local');assert.equal(spaceNow(),'local');setSpaceAll('world');
gizmo.userData.fixedSpace=true;setSpaceAll('local');assert.equal(gizmo.space,'world','a desk keeps its own frame');
// Studio ItemGizmo: negative-scale drag & flip() mirror cleanly without snapping back
{
  const scene=new THREE.Scene(),shelf=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.04,0.2));shelf.position.set(0.5,0.8,0);scene.add(shelf);scene.updateMatrixWorld(true);
  const ctrl=new Listeners();Object.assign(ctrl,{mode:'unified',object:undefined,dragging:false,controls:[],setMode(m){this.mode=m;},attach(o){this.object=o;},detach(){this.object=undefined;}});
  let committed=0;
  const ig=new ItemGizmo({control:ctrl,scene,canvas:{},before:()=>null,commit:()=>{committed++;},changed:()=>{}});
  assert.equal(ig.open({kind:'desk',target:shelf,objects:[shelf],label:'Side shelf'}),true);
  ctrl.dispatchEvent({type:'dragging-changed',value:true,mode:'scale'});
  ig.proxy.scale.set(-1,1,1);ctrl.dispatchEvent({type:'objectChange',mode:'scale'});
  ctrl.dispatchEvent({type:'dragging-changed',value:false,mode:'scale'});
  assert.ok(shelf.scale.x<0,'Studio ItemGizmo scale drag past zero mirrors instead of snapping back');
  assert.equal(committed,1);
  assert.equal(ig.flip('x'),true,'ItemGizmo.flip("x") mirrors back');
  assert.ok(shelf.scale.x>0,'flipping twice restores positive scale');
  assert.equal(committed,2);
}
g.dispose();console.log('gumball-test: ok');
