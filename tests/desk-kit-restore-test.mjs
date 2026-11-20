// Undo of "Same setup as another desk" (19 Nov 2026: tests/director-desk-kit-e2e.mjs, one Undo did not bring the film's desk
// back). film-desk-edits.mjs restore() put the room's own build back through import().then(): a tick later, after the
// size / pose restore and after film-fx had already installed the next edits on the desk. Now, on a stand-in stage:
//   1. install a desk edit with the kit build, then restore(): the room's own accessories, finishes and placements are on
//      the record and synced to its accessory set WHEN restore() RETURNS (not a tick later); its promise settles
//   2. restore() before the build has even loaded: the kit is never applied (nothing synced after the restore)
//   3. restore() while applyBuild waits for the kit's accessories to load: it stops there; the room's build stays
//   4. a re-install of the film's own edit after the restore (what film-fx does): the room's build, not the kit
//   node tests/desk-kit-restore-test.mjs
import assert from 'node:assert/strict';
import {installDeskEdits} from '../tools/experience/film-desk-edits.mjs';
import {copySetup,hbhsObjects,kitEdit} from '../experience/desk-kit.mjs';
globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);
const t=(x,y,z)=>({p:{x,y,z},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}});
const style={woodFinish:'White Birch',baseFinish:'White',trimColor:'#e8702a',sheen:'satin'};
const OWN=['apple-keyboard','magic-mouse','monitor-arm','dell-u2724d'];
function stage({gate=null}={}){
  const syncs=[],mounts={desktop:{userData:{surfaceSize:{width:1200,depth:760}}},shelf:{userData:{surfaceSize:{width:1200,depth:480}}}};
  const r={id:'station-project-review',state:{name:'APA review desk',size:'48x30',height:28,tilt:0,pose:{x:-4080,z:1149.4,yaw:0},style:{...style},accessories:[...OWN],accessoryFinishes:{},
    objects:Object.fromEntries(OWN.map((id,i)=>['accessory-'+id,{role:['monitor-arm','dell-u2724d'].includes(id)?'shelf':'desktop',added:false,removed:false,label:id,transform:t(i*100,0,0)}]))},
    rig:{mounts,updatePose(h,tl){r.posed=[h,tl];}},objects:new Map(),renderedStyle:style};
  r.peripherals={get ready(){return gate?gate.promise:Promise.resolve();},sync(config){syncs.push(structuredClone(config));r.objects=new Map(config.accessories.map(id=>['accessory-'+id,{obj:{},saved:r.state.objects['accessory-'+id]||{role:'desktop'},baseScale:{}}]));}};
  const records=new Map([[r.id,r]]);
  const sceneDesks={records,selected:'main',ctx:{readLive:()=>({style}),restyle(rec){rec.renderedStyle=rec.state.style;}},ensureRig(){},place(){},
    objects:{register(rec,key,obj,saved){rec.objects.set(key,{obj,saved,baseScale:{}});},stow:{update(){},restore(){}}},sync(){}};
  return {api:{sceneDesks,currentConfig:{size:'48x30',accessories:[]}},r,syncs};
}
const featured={id:'featured',size:'60x30',baseFinish:'Black',accessories:[{id:'monitor-arm',slot:'shelf'},{id:'flat-monitor',slot:'shelf'},{id:'keyboard-tray',slot:'desktop'},{id:'ergo-keyboard',slot:'desktop'},{id:'logitech-mx-master',slot:'desktop'}],accessoryFinishes:{'keyboard-tray':'steel'},objects:hbhsObjects()};
const kit=copySetup(featured,{size:'48x30',baseFinish:'White',heightIn:43.5,accessories:[]},{finish:'white',eyeMm:1332});
const film={desk:'station-project-review',name:'APA review desk',size:'48x30',pose:{x:-4080,z:1149.4,yaw:0}};
const withKit=kitEdit(film,kit,{stand:true,size:'48x30'});
const KIT=['ergo-keyboard','flat-monitor','keyboard-tray','logitech-mx-master','monitor-arm'];
const sorted=a=>[...a].sort();
// 1
{const {api,r,syncs}=stage();const own=structuredClone(r.state.objects);
  const h=installDeskEdits([withKit],api);await h.ready;
  assert.deepEqual(sorted(r.state.accessories),KIT,'1. the kit is on the desk');assert.deepEqual(r.posed,[43.5,0],'1. standing');
  const p=h.restore();
  assert.deepEqual(r.state.accessories,OWN,'1. restore(): the room\'s own accessories at once');assert.deepEqual(r.state.accessoryFinishes,{},'1. and finishes');
  assert.deepEqual(Object.fromEntries(Object.entries(r.state.objects).filter(([k])=>k.startsWith('accessory-'))),own,'1. and placements');
  assert.deepEqual(syncs.at(-1).accessories,OWN,'1. synced to the accessory set before restore() returns');assert.deepEqual(r.posed,[28,0],'1. the film desk\'s own height back');
  await p;assert.deepEqual(r.state.accessories,OWN,'1. still after it settles');
  // 4. film-fx then installs the film's own edit (no build)
  const h2=installDeskEdits([film],api);await h2.ready;await new Promise(res=>setTimeout(res,20));
  assert.deepEqual(r.state.accessories,OWN,'4. the film\'s own edit after it: the room\'s build');assert.deepEqual(syncs.at(-1).accessories,OWN);}
// 2
{const {api,r,syncs}=stage();const h=installDeskEdits([withKit],api);const p=h.restore();await p;await h.ready;await new Promise(res=>setTimeout(res,20));
  assert.ok(!syncs.some(s=>s.accessories.includes('keyboard-tray')),'2. restored before the build loaded: the kit is never applied');assert.deepEqual(r.state.accessories,OWN);}
// 3
{let open;const gate={promise:new Promise(res=>{open=res;})};const {api,r,syncs}=stage({gate});
  const h=installDeskEdits([withKit],api);
  for(let i=0;i<50&&!syncs.some(s=>s.accessories.includes('keyboard-tray'));i++)await new Promise(res=>setTimeout(res,2));
  assert.ok(syncs.some(s=>s.accessories.includes('keyboard-tray')),'3. (the kit is loading)');
  gate.promise=Promise.resolve();const p=h.restore();open();await p;const res=await (h.ready);await new Promise(res=>setTimeout(res,20));
  assert.deepEqual(r.state.accessories,OWN,'3. restore() during the kit\'s load: the room\'s build stays');assert.deepEqual(syncs.at(-1).accessories,OWN,'3. the last sync is the room\'s');}
console.log('desk-kit-restore-test: ok (Undo of a desk kit: the room\'s own build back at once, before the next install; a build still loading never lands)');
process.exit(0);
