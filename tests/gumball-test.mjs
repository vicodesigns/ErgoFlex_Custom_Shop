// Rhino's Gumball over the Director's gizmos (P3): typed values (units), Shift constrain, Ctrl snap, the exact redo
// of the last drag as one more edit the editor commits, and the World / Object switch.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {parseLength,parseValue,constrain,enhanceGizmo,setSpaceAll,spaceNow} from '../experience/gumball.mjs';
assert.equal(parseLength('12'),304.8,'bare numbers are inches');assert.equal(parseLength('30cm'),300);assert.equal(parseLength('300mm'),300);
assert.equal(parseLength('2ft'),609.6);assert.equal(parseLength('1.5m'),1500);assert.equal(parseLength('-3in'),-76.2);assert.equal(parseLength('abc'),null);
assert.equal(parseValue('45°','rotate'),45);assert.equal(parseValue('90','rotate'),90);assert.equal(parseValue('150%','scale'),1.5);assert.equal(parseValue('2','scale'),2);assert.equal(parseValue('150','scale'),1.5);
assert.deepEqual(constrain({x:3,y:0,z:1},'XZ'),{x:3,y:0,z:0});assert.deepEqual(constrain({x:1,y:5,z:2},'XYZ'),{x:0,y:5,z:0});assert.deepEqual(constrain({x:1,y:2,z:3},'X'),{x:1,y:2,z:3});

// a fake TransformControls on a real three.js object, a fake stage window
class Listeners{constructor(){this.l={};}addEventListener(t,f){(this.l[t]||=[]).push(f);}removeEventListener(t,f){this.l[t]=(this.l[t]||[]).filter(x=>x!==f);}dispatchEvent(e){for(const f of this.l[e.type]||[])f(e);}}
const el=()=>({style:{},append(){},remove(){},set textContent(v){this.text=v;}});
const win=new Listeners();win.document={createElement:el,body:{append(){}}};win.parent=win;
const gizmo=new Listeners();Object.assign(gizmo,{mode:'translate',axis:null,dragging:false,enabled:true,space:'world',userData:{},object:new THREE.Object3D(),
  snaps:[],setTranslationSnap(v){this.snaps.push(['t',v]);},setRotationSnap(){},setScaleSnap(){},setSpace(s){this.space=s;},domElement:new Listeners()});
const commits=[];let from=null;   // an editor: commits the change between its drag's start and end
gizmo.addEventListener('dragging-changed',e=>{if(e.value)from=gizmo.object.position.clone();else commits.push(gizmo.object.position.clone().sub(from));});
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
assert.equal(commits.length,2,'the exact redo is one more edit the editor commits');assert.ok(Math.abs(commits[1].x-(.3048-.1))<1e-9);
assert.match(msgs.at(-1),/Moved exactly 12\.0 in · 305 mm/);
// Shift: a plane drag keeps its main axis
gizmo.axis='XZ';gizmo.dragging=true;gizmo.dispatchEvent({type:'dragging-changed',value:true});key('Shift');gizmo.object.position.set(.3048+.4,0,.1);gizmo.dispatchEvent({type:'objectChange'});
assert.ok(Math.abs(gizmo.object.position.z)<1e-9&&Math.abs(gizmo.object.position.x-.7048)<1e-9,'Shift holds the main axis');key('Shift','keyup');
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
g.dispose();console.log('gumball-test: ok');
