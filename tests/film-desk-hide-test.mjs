// Desk hides in films (Layers phase 3, set B): tools/experience/film-desk-edits.mjs and experience/desk-edits.mjs.
//   node tests/film-desk-hide-test.mjs
// 1. Nothing changes without a hide: what the four review cuts produce for the film's desk edits and people is
//    byte-identical to the snapshot written with the code before desk hides existed (tests/fixtures/film-desk-hide-before.json,
//    tests/film-desk-hide-proof.mjs).
// 2. The film path with a stub stage: an edit without `hide` never touches a desk's visibility (no accessor, no change);
//    with `hide` the desk's group is not drawn (sticky against the app), stays hidden across a rebuilt group, and is put
//    back on restore; the featured desk is never touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {produce,SNAPSHOT,CUTS} from './film-desk-hide-proof.mjs';
import {installDeskEdits,hideDesk} from '../tools/experience/film-desk-edits.mjs';
import {cleanDeskEdit,describeDeskEdit} from '../experience/desk-edits.mjs';

let n=0;const ok=name=>{n++;console.log('ok',name);};
{
  const before=JSON.parse(fs.readFileSync(SNAPSHOT,'utf8')),now=JSON.parse(JSON.stringify(produce()));
  assert.deepEqual(Object.keys(now),CUTS);
  for(const cut of CUTS){
    if(before[cut]===null&&now[cut]===null)continue;
    assert.deepEqual(Object.keys(now[cut]).sort(),Object.keys(before[cut]).sort(),cut+': the same shots');
    for(const at of Object.keys(before[cut]))assert.deepEqual(now[cut][at],before[cut][at],`${cut} ${at}: desk edits / people unchanged`);
  }
  const shots=CUTS.reduce((a,c)=>a+Object.keys(before[c]||{}).length,0);assert.ok(shots>50,shots+' shots compared');
  ok(`nothing changes without a hide: ${shots} shots of the people cut, the Cinematographer's cut, HQ14 and the alternate cut produce the same desk edits and people`);
}
{
  assert.deepEqual(cleanDeskEdit({desk:'station-a',hide:true}),{desk:'station-a',hide:true});
  assert.equal(cleanDeskEdit({desk:'station-a',hide:'yes'}),null);assert.equal(cleanDeskEdit({desk:'station-a',hide:false}),null);
  assert.deepEqual(cleanDeskEdit({desk:'station-a',pose:{x:1,z:2,yaw:0},hide:false}),{desk:'station-a',pose:{x:1,z:2,yaw:0}},'without hide: exactly as before');
  assert.equal(describeDeskEdit({desk:'a',hide:true}),'hidden in this chapter');
  ok('desk edits keep hide:true only');
}
// ---- the film path, a stub stage
function stage(){
  const group=()=>({visible:true,userData:{}});
  const rec=(id)=>({id,state:{size:'60x30',pose:{x:0,z:0,yaw:0},height:28,tilt:0},group:group(),rig:{updatePose(){},mounts:{},setBodyVisible(){},dispose(){}}});
  const records=new Map([['main',rec('main')],['station-a',rec('station-a')],['station-b',rec('station-b')]]);
  const desks={records,selected:'main',ensureRig(){},place(){},objects:{stow:{update(){},restore(){}}},ctx:{}};
  return {api:{sceneDesks:desks},records};
}
{
  const {api,records}=stage(),a=records.get('station-a').group,b=records.get('station-b').group;
  const fx=installDeskEdits([{desk:'station-a',pose:{x:5,z:6,yaw:0}}],api);fx.frame(1);fx.frame(2);
  assert.equal(Object.getOwnPropertyDescriptor(a,'visible').value,true,'no accessor: a plain value, untouched');assert.ok(!('get' in Object.getOwnPropertyDescriptor(a,'visible')));
  fx.restore();assert.equal(a.visible,true);assert.equal(b.visible,true);
  ok('an edit without hide never touches a desk\'s visibility');
}
{
  const {api,records}=stage(),r=records.get('station-a');
  const fx=installDeskEdits([{desk:'station-a',hide:true},{desk:'main',hide:true}],api);
  assert.equal(r.group.visible,false,'hidden');r.group.visible=true;assert.equal(r.group.visible,false,'sticky against the app');
  assert.equal(records.get('main').group.visible,true,'the featured desk is never hidden');assert.deepEqual(fx.missing,['main']);
  assert.equal(records.get('station-b').group.visible,true,'the other desks untouched');
  const old=r.group;r.group={visible:true,userData:{}};fx.frame(3);assert.equal(r.group.visible,false,'a rebuilt group is hidden again on the next frame');
  assert.equal(old.visible,true,'the old group is put back (it is no longer drawn anyway)');
  fx.restore();assert.equal(r.group.visible,true,'restore: shown, with what the app set meanwhile');
  assert.equal(hideDesk({record:{}}),false,'no group: nothing');
  ok('a hidden desk: its group not drawn, sticky, kept hidden across a rebuild, put back on restore; never the featured desk');
}
console.log(`Film desk hides: ${n} checks pass.`);
