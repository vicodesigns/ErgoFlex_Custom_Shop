// desk-build.mjs applyBuild / restoreBuild on a stand-in stage (no browser): a build with accessoryFinishes and objects reaches the
// desk's accessory sync (finishes) and its saved objects (placements, custom, in their slot), a second apply is the same state,
// and restoreBuild puts the room's own accessories, finishes and placements back. readSetup reads what was applied.
//   node tests/desk-build-apply-test.mjs
import assert from 'node:assert/strict';
import {applyBuild,restoreBuild,readSetup,FEATURED} from '../experience/desk-build.mjs';
import {copySetup,hbhsObjects} from '../experience/desk-kit.mjs';

globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);
const t=(x,y,z)=>({p:{x,y,z},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}});
const style={woodFinish:'White Birch',baseFinish:'White',trimColor:'#e8702a',sheen:'satin'};
function stage(){
  const syncs=[],registered=[],mounts={desktop:{userData:{surfaceSize:{width:1500,depth:760}}},shelf:{userData:{surfaceSize:{width:1500,depth:480}}}};
  const r={id:'station-project-review',primary:false,state:{name:'APA review desk',size:'60x30',style:{...style},accessories:['apple-keyboard','magic-mouse','monitor-arm','dell-u2724d'],accessoryFinishes:{},objects:{'accessory-apple-keyboard':{role:'desktop',added:false,removed:false,label:'Apple Magic Keyboard',custom:true,transform:t(0,0,300)}}},
    rig:{mounts},objects:new Map(),renderedStyle:style};
  r.peripherals={ready:Promise.resolve(),sync(config){
    syncs.push(structuredClone(config));
    // like the studio's accessory set: every accessory in the config gets an object with the saved placement or the store's default
    r.objects=new Map();
    for(const id of config.accessories){const key='accessory-'+id,saved=r.state.objects[key]||{role:['monitor-arm','flat-monitor','dell-u2724d'].includes(id)?'shelf':'desktop',added:false,removed:false,label:id,transform:t(1,1,1)};r.objects.set(key,{obj:{},saved,baseScale:{}});}
  }};
  const records=new Map([[r.id,r]]);
  const sceneDesks={records,selected:'main',ctx:{readLive:()=>({style}),restyle(rec){rec.renderedStyle=rec.state.style;}},ensureRig(){},
    objects:{register(rec,key,obj,saved){registered.push([key,saved.role]);rec.objects.set(key,{obj,saved,baseScale:{}});}},sync(){}};
  return {api:{sceneDesks,currentConfig:{size:'60x30',accessories:[]}},r,syncs,registered};
}
const featured={id:FEATURED,size:'60x30',baseFinish:'Black',accessories:[{id:'monitor-arm',slot:'shelf'},{id:'flat-monitor',slot:'shelf'},{id:'keyboard-tray',slot:'desktop'},{id:'ergo-keyboard',slot:'desktop'},{id:'logitech-mx-master',slot:'desktop'}],accessoryFinishes:{'keyboard-tray':'steel'},objects:hbhsObjects()};
const kit=copySetup(featured,{size:'60x30',baseFinish:'White',heightIn:43.5,accessories:[{id:'apple-keyboard',slot:'desktop'},{id:'magic-mouse',slot:'desktop'},{id:'monitor-arm',slot:'shelf'},{id:'dell-u2724d',slot:'shelf'}]},{finish:'white',eyeMm:1332});

const {api,r,syncs}=stage();
const was=structuredClone(r.state);
const res=await applyBuild(api,r.id,kit.build);
assert.deepEqual(res,{desk:r.id,style:true,accessories:true});
const last=syncs.at(-1);
assert.deepEqual(last.accessories.slice().sort(),['ergo-keyboard','flat-monitor','keyboard-tray','logitech-mx-master','monitor-arm']);
assert.deepEqual(last.accessoryFinishes,{'ergo-keyboard':'white','logitech-mx-master':'white','keyboard-tray':'steel'},'the white finishes reach the accessory set');
assert.deepEqual(r.state.accessoryFinishes,last.accessoryFinishes);
for(const [key,o] of Object.entries(kit.build.objects)){
  const s=r.state.objects[key];assert.ok(s,key);assert.equal(s.role,o.role);assert.equal(s.custom,true);assert.deepEqual(s.transform,o.transform,key+' placed where the build says');
  assert.deepEqual(r.objects.get(key).saved.transform,o.transform,key+' on the desk\'s object');
}
assert.ok(!('accessory-apple-keyboard' in r.state.objects),"the replaced keyboard's placement is gone");
// again: the same state
const once=structuredClone(r.state);
await applyBuild(api,r.id,kit.build);assert.deepEqual(r.state,once,'idempotent');
// readSetup reads it back, ready to copy on to another desk
const read=readSetup(api,r.id);
assert.deepEqual(read.accessories.map(a=>a.id).sort(),['ergo-keyboard','flat-monitor','keyboard-tray','logitech-mx-master','monitor-arm']);
assert.equal(read.accessoryFinishes['ergo-keyboard'],'white');assert.deepEqual(read.objects['accessory-keyboard-tray'].transform,kit.build.objects['accessory-keyboard-tray'].transform);
assert.equal(read.baseFinish,'White');
// a build with no finishes / objects (the Build tab's) leaves the room's own finishes and placements alone
await restoreBuild(api,r.id);
assert.deepEqual(r.state.accessories,was.accessories);assert.deepEqual(r.state.accessoryFinishes,{});assert.deepEqual(r.state.objects,was.objects,"the room's own placements are back");
await applyBuild(api,r.id,{accessories:[{id:'apple-keyboard',slot:'desktop'},{id:'magic-mouse',slot:'desktop'}]});
assert.deepEqual(syncs.at(-1).accessoryFinishes??{},{});assert.deepEqual(r.state.objects['accessory-apple-keyboard'],was.objects['accessory-apple-keyboard']);
await restoreBuild(api,r.id);
assert.equal(await restoreBuild(api,r.id),false,'nothing to restore twice');
console.log('desk-build-apply-test: ok (finishes and placements reach the desk, idempotent, restore brings the room back, readSetup round trip)');
