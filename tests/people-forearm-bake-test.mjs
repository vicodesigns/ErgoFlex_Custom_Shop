// The baked forearm of the phone-pull posture (17 Nov 2026, the storage film: Andre's arm looked cut off at the wrist
// as he takes out his phone). build_people.py cuts away body faces covered by cloth; the hand at the front pocket had
// half its forearm cut away under the shirt hem and the trousers. cast.BARE_FOREARMS names the postures whose forearm
// and hand are never cut (build_people.py cull_under bare_arms). Checks the source rule and the baked model: its forearm
// has as many faces as the same man's stand-wait, in both arms.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';

const cast=fs.readFileSync(new URL('../tools/people/cast.py',import.meta.url),'utf8'),build=fs.readFileSync(new URL('../tools/people/build_people.py',import.meta.url),'utf8');
assert.match(cast,/^BARE_FOREARMS = \{[^}]*'stand-phone-pull'[^}]*\}/m,'cast.BARE_FOREARMS names stand-phone-pull');
assert.match(build,/bare_arms=spec\['pose'\] in cast\.BARE_FOREARMS/,'the body cull is told which postures keep the forearm');
assert.match(build,/if bare and bare\(c\): return False/,'a forearm or hand face is never hidden for such a posture');

await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
async function armFaces(id){
  const root=(await io.read(new URL(`../assets/props/${id}.glb`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))).getRoot();
  const joints=root.listSkins()[0].listJoints().map(j=>decodeURIComponent(j.getName())),out={lowerarm_r:0,lowerarm_l:0};
  for(const mesh of root.listMeshes())for(const prim of mesh.listPrimitives()){
    if(prim.getMaterial()?.getName()!=='Human.body')continue;
    const J=prim.getAttribute('JOINTS_0'),W=prim.getAttribute('WEIGHTS_0'),idx=prim.getIndices();
    const dom=i=>{const j=J.getElement(i,[]),w=W.getElement(i,[]);let b=0;for(let k=1;k<4;k++)if(w[k]>w[b])b=k;return joints[j[b]];};
    for(let f=0;f<idx.getCount()/3;f++){const a=[0,1,2].map(k=>dom(idx.getScalar(f*3+k)));if(a.every(x=>x===a[0])&&a[0] in out)out[a[0]]++;}
  }
  return out;
}
const wait=await armFaces('people-andre-stand-wait'),pull=await armFaces('people-andre-stand-phone-pull');
for(const side of ['lowerarm_r','lowerarm_l'])assert.ok(pull[side]>=wait[side]*.95,`phone-pull ${side}: ${pull[side]} faces of stand-wait's ${wait[side]} (was 249 of 446 before the fix)`);
console.log('people-forearm-bake-test ok: phone-pull forearm faces',JSON.stringify(pull),'stand-wait',JSON.stringify(wait));
