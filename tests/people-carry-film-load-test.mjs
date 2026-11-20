// Kai's controller through the Director's own load path (19 Nov 2026: Vico loaded chapter 9 after the carry import,
// chose "Use the film's version", and at 9.9 s Kai stood with empty hands). The chapter's film shot
// (<cut>/director-film/music.json, the file director-chapters.json names) is read by loadFilmShot, joined with the
// chapter page's cut by liveFilmShot (film-chapters.mjs, what player.mjs prepares the stage with) and handed to the
// stage's people as stage.mjs does (setRoomPeople: shot.people as the filter):
//   1. carry and the walking model's grip survive the load (film -> live shot -> the stage's filter)
//   2. frame by frame 5-11.5 s through RoomPeople: one Kai, from 7.2 s the walking model, holding the controller, the
//      right hand on the seated grip; at 9.9 s too
//   3. the modules the browser loads are served fresh (no-store) or carry a changed ?v= (a stale room-people.mjs in his
//      browser would show exactly this)
//   CUT=exports/cinematic-intro-cut-vicos-2nd-cut node tests/people-carry-film-load-test.mjs   (skipped without the cut)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {library,makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries,RoomPeople} from '../room-people.mjs';
import {loadFilmShot,liveFilmShot} from '../experience/film-chapters.mjs';
globalThis.__ERGO_PRESENTATION__=true;
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),CUT=path.resolve(root,process.env.CUT||'exports/cinematic-intro-cut-vicos-2nd-cut');
const list=path.join(CUT,'director-chapters.json');
if(!fs.existsSync(list)){console.log('people-carry-film-load-test: skipped (no '+CUT+')');process.exit(0);}
const chapter=JSON.parse(fs.readFileSync(list,'utf8')).chapters.find(c=>c.id==='music');
const local=u=>path.join(CUT,'..','..',decodeURIComponent(new URL(u,'http://x/').pathname).replace(/^\//,''));
const film=await loadFilmShot('http://127.0.0.1:3000'+chapter.shot,'music',async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(local(u),'utf8'))}));
const page=JSON.parse(Buffer.from(/#cut=([A-Za-z0-9_-]+)/.exec(fs.readFileSync(local(chapter.page),'utf8'))[1],'base64url').toString('utf8')).shots[0];
const live=liveFilmShot(film,page),people=live.people;
// 1
const B=people?.cast?.find(e=>e.key==='kai-gets-up');
if(!B?.carry){console.log('people-carry-film-load-test: skipped (this cut\'s music chapter has no kai-gets-up with carry)');process.exit(0);}
assert.deepEqual(B.carry,{from:'people-kai-sit-controller'},'1. carry survives film -> live shot');
assert.ok(B.postures?.['people-kai-walk']?.held?.hand_r,'1. and the walking model\'s grip');
// 2 (the library with a stand-in controller in the seated model, as tests/people-carry-test.mjs)
const SIT=B.carry.from,WALK=B.id;
function lib(){const l=library(),ri=l.rigInstance;l.rigInstance=async id=>{const g=await ri(id);if(!g||id!==SIT)return g;
  g.updateMatrixWorld(true);const bones=[];g.traverse(o=>{if(o.isBone)bones.push(o);});const j=bones.findIndex(b=>b.name==='hand_r'),p=bones[j].getWorldPosition(new THREE.Vector3()),k=1/g.scale.x;
  const geo=new THREE.BoxGeometry(.15,.03,.1);geo.translate(p.x*k,p.y*k+.03,p.z*k+.04);const n=geo.attributes.position.count;
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(n*4).fill(0).map((_,i)=>i%4?0:j),4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(new Array(n*4).fill(0).map((_,i)=>i%4?0:1),4));
  const m=new THREE.SkinnedMesh(geo,new THREE.MeshStandardMaterial({name:'Held.Controller'}));g.add(m);g.updateMatrixWorld(true);m.bind(new THREE.Skeleton(bones));return g;};return l;}
const filter={...people};delete filter.v;
const room=makeRoom(live.room||'gaming',live.layout||'house',[...castEntries(live.room||'gaming',live.layout||'house'),...filter.cast]),rp=new RoomPeople(room,lib());
const state=t=>({height:30,tilt:0,mode:'morning',pose:{x:0,z:190,yaw:0},keyboard:{x:0,z:450},time:t,track:null,now:0});
room.peopleState=()=>state(5);rp.setFilter(filter);await rp.setEnabled(true);await rp.settled();for(let k=0;k<3;k++){rp.update(state(5));await rp.settled();}
const held=o=>{const out=[];o.traverse(m=>{if(m.isSkinnedMesh&&/^Held\./.test(m.material?.name||''))out.push(m);});return out;};
const hand=o=>{o.updateMatrixWorld(true);const b=o.userData.personRig.bones;return b.get('spine_03').worldToLocal(b.get('hand_r').getWorldPosition(new THREE.Vector3())).multiplyScalar(1000);};
let ref=null,worst=0,at99=null;
for(let i=0;i<=195;i++){const t=Math.round((5+i/30)*1000)/1000;for(let k=0;k<2;k++){rp.update(state(t));await rp.settled();}
  const on=rp.people.filter(o=>o.visible&&/^people-kai-/.test(o.userData.person.id));assert.equal(on.length,1,`${t}s: one Kai`);const o=on[0];
  assert.ok(held(o).length,`${t}s: ${o.userData.person.id} holds the controller`);
  if(t>=7.2)assert.equal(o.userData.person.id,WALK,`${t}s: the walking model`);
  if(t>=7&&!ref)ref=hand(o);if(ref&&t>=7)worst=Math.max(worst,hand(o).distanceTo(ref));
  if(Math.abs(t-9.9)<.001)at99={id:o.userData.person.id,held:held(o).length,carry:o.userData.personCarry};}
assert.ok(worst<2,`2. the right hand stays on the seated grip (at most ${worst.toFixed(2)} mm off)`);
assert.ok(at99&&at99.id===WALK&&at99.held&&at99.carry?.parts,'2. at 9.9 s: the walking model with the controller '+JSON.stringify(at99));
// 3 (the server sends no-store, but a page open since before a merge keeps the modules it loaded; a deploy behind a cache
// serves by ?v=: the tags must have changed with carry)
const src=f=>fs.readFileSync(path.join(root,f),'utf8'),tag=/room-people\.mjs\?v=([\w.-]+)/.exec(src('workspace-3d.mjs'))?.[1],mtag=/room-people-motion\.mjs\?v=([\w.-]+)/.exec(src('room-people.mjs'))?.[1];
const day=t=>Number(/(\d{8})/.exec(t||'')?.[1]||0);
assert.ok(day(tag)>=20261119&&tag!=='held-offset-20261117b',`3. workspace-3d.mjs loads room-people.mjs?v=${tag} (changed with carry)`);
assert.ok(day(mtag)>=20261119,`3. room-people.mjs loads room-people-motion.mjs?v=${mtag} (holdArms)`);
assert.ok(/carryHeld/.test(src('room-people.mjs'))&&/export function holdArms/.test(src('room-people-motion.mjs')),'3. and those modules have carry');
console.log(`people-carry-film-load-test: ok (the film's music chapter through the Director's load path: carry survives, Kai holds the controller 5-11.5 s, at 9.9 s too; room-people.mjs?v=${tag})`);
process.exit(0);
