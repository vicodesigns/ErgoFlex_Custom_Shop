// Node-only: the daily kit ignores a stale index-keyed record; other objects keep their saved records exactly as before.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SceneDeskObjects, dayKitRecordStale } from '../scene-desk-objects.mjs';
const KIT='Groove tabletop · daily materials';
const t=(s,x=520)=>({p:{x,y:0,z:-200},q:{x:0,y:0,z:0,w:1},s:{x:s,y:s,z:s}});
function run(objs,saved){
  const mount=new THREE.Group();objs.forEach(o=>mount.add(o));
  const r={id:'main',state:{objects:saved},rig:{mounts:{desktop:mount}}};
  const ed=Object.create(SceneDeskObjects.prototype);
  ed.manager={ctx:{sceneId:()=>'library'},records:new Map(),sync(){}};
  ed.register=(rr,id,obj,sv)=>{obj.__rec=sv;rr.objects.set(id,{id,obj,saved:sv});};
  ed.phase=()=>{};ed.syncAccessories=()=>{};
  try{ed.bind(r);}catch(e){}
  return r;
}
const mk=(name,kit)=>{const g=new THREE.Group();g.name=name;if(kit)g.userData.dayKit=true;return g;};
// 1. stale frame record on slot 4 does not reach the kit
{const objs=[0,1,2,3].map(i=>mk('prop'+i)),kit=mk(KIT,true);objs.push(kit);
 const r=run(objs,{'default-desktop-4':{role:'desktop',added:false,removed:false,label:'Small picture frame',transform:t(1000)}});
 const used=kit.__rec;assert.equal(used.label,KIT);assert.equal(used.transform.s.x,1);assert.equal(used.transform.p.x,0);}
// 2. a matching kit record still applies
{const kit=mk(KIT,true);kit.position.set(1,2,3);
 const rec={role:'desktop',added:false,removed:false,label:KIT,transform:t(1,440)};
 run([kit],{'default-desktop-0':rec});assert.strictEqual(kit.__rec,rec);}
// 3. same label but mm-unit scale >= 100 is ignored too
{const kit=mk(KIT,true);run([kit],{'default-desktop-0':{role:'desktop',label:KIT,transform:t(1000)}});assert.equal(kit.__rec.transform.s.x,1);}
// 4. non-kit object: matching and non-matching labels both apply the saved record as before (even scale 1000)
for(const label of ['Small picture frame','Something else']){const o=mk('Small picture frame');const rec={role:'desktop',added:false,removed:false,label,transform:t(1000)};
 run([o],{'default-desktop-0':rec});assert.strictEqual(o.__rec,rec,'non-kit '+label);}
assert.equal(dayKitRecordStale({label:KIT,transform:t(1)},KIT),false);
console.log('scene-desk-kit-record-test: ok');
