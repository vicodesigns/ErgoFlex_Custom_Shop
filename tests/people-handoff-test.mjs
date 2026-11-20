// Kai's dock in the high school (Vicos 2nd cut, oilers; 19 Nov 2026): his roll to the desk ends in a change of posture
// into his typing placement. Without a browser, through the film's own people code (RoomPeople.pairUp, the stage and the
// render alike), on his data:
//   1. typing placement at a free spot where the dock ends (as it was until 03:01 UTC, and as the restore puts back):
//      the dock and the typing placement are paired: a change of posture (a blend) centred on 12.75 s
//   2. typing placement at the film desk (desk: 'wheel', reach 808: what Place "At the film desk" made of it): no pair,
//      the hand-over is a cut in one frame (pairUp pairs only people who are not at a desk)
//   3. people-edits.mjs handoffInto: the Director's warning finds the hand-over (kai-docks at 12.75 s), and not across
//      characters or a gap
//   4. (Vico, 19:29: he set Kai's seat distance, 32.8 in, which only a desk user has) the roll DOCKS into the desk user
//      (RoomPeople.docks): frame by frame from 11.5 to 14.2 s at 30 fps, one Kai on screen at every frame, his hands and
//      body never jump between frames (the old cut moved the hands ~0.4 m in one frame), and the dock ends on the desk
//      user's own pose with his correction (no arms too far forward): the frame after it is the desk user's
//   node tests/people-handoff-test.mjs
import assert from 'node:assert/strict';
import {library,makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries,RoomPeople} from '../room-people.mjs';
import {handoffInto} from '../experience/people-edits.mjs';
const rolls={key:'kai-rolls',id:'people-kai-wheel-roll',at:[-961,1300],turn:0,roll:{path:[[-961,1300],[-961,-265],[-3757,-265],[-3757,-610]],start:.3,speed:1,radius:350}};
const docks={key:'kai-docks',id:'people-kai-wheel-roll',at:[-3757,-610],turn:180,roll:{path:[[-3757,-610],[-3757,-1110]],start:9.4,speed:.7}};
const ID=[0,0,0,1],ARMS={upperarm_l:[-0.2669,-0.0107,0.016,0.9635],lowerarm_l:[0.393,0,0.037,0.9188],hand_l:[-0.0754,-0.2067,-0.0902,0.9713],upperarm_r:[-0.2703,-0.0091,0.0324,0.9622],lowerarm_r:[0.4221,0,-0.0398,0.9057],hand_r:[0.0074,0.119,0.0766,0.9899]};
const atSpot={key:'kai',id:'people-kai-wheel-type-31',at:[-3757,-1110],turn:180,postures:{'people-kai-wheel-type-31':{poseKeys:[{t:12.75,pose:Object.fromEntries(Object.keys(ARMS).map(b=>[b,ID])),ease:'smooth'},{t:13.5,pose:ARMS}]}}};
const atDesk={key:'kai',id:'people-kai-wheel-type-31',desk:'wheel',reach:808,postures:{'people-kai-wheel-type-31':{poseKeys:[{t:12.767,pose:ARMS}]}}};
const when={'kai-rolls':[[0,9.4,0,0]],'kai-docks':[[9.4,12.75,0,0]],kai:[[12.75,99,0,0]]};
globalThis.__ERGO_PRESENTATION__=true;
async function pairsOf(kai){
  const filter={except:[],cast:[rolls,docks,kai],when},room=makeRoom('highschool','house',[...castEntries('highschool','house'),...filter.cast]);
  const people=new RoomPeople(room,library()),state=t=>({height:31,tilt:0,mode:'morning',pose:{x:-3749,z:-2045,yaw:0},keyboard:{x:-3749,z:-1570},time:t,track:null,now:0});
  room.peopleState=()=>state(12);people.setFilter(filter);await people.setEnabled(true);await people.settled();
  for(let i=0;i<3;i++){people.update(state(12));await people.settled();}
  return people.pairs.map(p=>[p.from.key,p.to.key,p.at,!!p.ready]);
}
const free=await pairsOf(atSpot);
assert.ok(free.some(([a,b,at,ready])=>a==='kai-docks'&&b==='kai'&&at===12.75&&ready),'1. at a free spot where the dock ends: a change of posture at 12.75 s: '+JSON.stringify(free));
const desk=await pairsOf(atDesk);
assert.ok(!desk.some(([a,b])=>a==='kai-docks'&&b==='kai'),'2. at the film desk: not a pair (pairUp is for people not at a desk; RoomPeople.docks takes that hand-over, 4.)'+JSON.stringify(desk));
const people={cast:[rolls,docks,atDesk,{key:'noah',id:'people-noah-stand-type'}],when:{...when,noah:[[0,12.75]]}};
assert.deepEqual(handoffInto(people,'kai'),{key:'kai-docks',at:12.75},'3. the warning finds the dock');
assert.deepEqual(handoffInto(people,'kai-docks'),{key:'kai-rolls',at:9.4});
assert.equal(handoffInto({...people,when:{...when,kai:[[14,99]]}},'kai'),null,'3. not across a gap');
assert.equal(handoffInto({cast:[{key:'noah',id:'people-noah-stand-type'},atDesk],when:{noah:[[0,12.75]],kai:[[12.75,99]]}},'kai'),null,'3. not another character');
// 4. the dock, frame by frame, Kai as Vico set him at 19:29 (a desk user, 833 mm, his arms by his sides from 12.767 s)
{const vico={key:'kai',id:'people-kai-wheel-type-31',desk:'wheel',reach:833,postures:{'people-kai-wheel-type-31':{poseKeys:[{t:12.767,pose:ARMS}]}}};
  const filter={except:[],cast:[rolls,docks,vico],when},room=makeRoom('highschool','house',[...castEntries('highschool','house'),...filter.cast]);
  const people=new RoomPeople(room,library()),heightAt=t=>t<8.5?43.5:t>11.5?31:43.5+(31-43.5)*(1-Math.cos(Math.PI*(t-8.5)/3))/2;
  const track={seconds:15,heightAt,tiltAt:()=>0},state=t=>({height:heightAt(t),tilt:0,mode:'morning',pose:{x:-3749,z:-2045,yaw:0},keyboard:{x:-3749,z:-1570},time:t,track,now:0});
  room.peopleState=()=>state(11.5);people.setFilter(filter);await people.setEnabled(true);await people.settled();
  const kais=()=>people.people.filter(o=>o.visible&&/^people-kai-/.test(o.userData.person.id));
  const V=new (await import('three')).Vector3(),at=(o,b)=>{const bone=o.userData.personRig?.bones.get(b);return bone?bone.getWorldPosition(V).toArray():o.getWorldPosition(V).toArray();};
  let prev=null,worst={d:0},seen=new Set(),docked=0;
  for(let i=0;i<=81;i++){const t=Math.round((11.5+i/30)*1000)/1000;
    for(let k=0;k<2;k++){people.update(state(t));await people.settled();}
    const on=kais();assert.equal(on.length,1,`4. one Kai at ${t} s: ${on.map(o=>people.keyOf(o.userData.person)).join(', ')||'none'}`);
    const o=on[0];seen.add(people.keyOf(o.userData.person));if(o.userData.personDocking)docked++;
    const now={hl:at(o,'hand_l'),hr:at(o,'hand_r'),root:o.position.toArray()};
    if(prev)for(const k of ['hl','hr','root']){const d=Math.hypot(...now[k].map((v,j)=>v-prev[k][j]));if(d>worst.d)worst={d,k,t};}
    prev=now;}
  assert.ok(seen.has('kai-docks')&&seen.has('kai')&&docked>20,`4. the roll docks (${docked} frames) and the desk user takes over: ${[...seen]}`);
  assert.ok(worst.d<45,`4. no jump: the most any hand or the body moves in one frame is ${Math.round(worst.d)} mm (${worst.k} at ${worst.t} s)`);
  console.log(`  (dock: ${docked} frames; the largest move in one frame ${Math.round(worst.d)} mm, ${worst.k} at ${worst.t} s)`);}
const ed=(await import('node:fs')).readFileSync(new URL('../experience/scene-people-editor.mjs',import.meta.url),'utf8');
assert.match(ed,/const from=handoffInto\(currentPeople\(\),key,[^]*?if\(from&&station\)status\(`[^`]*is a cut, not a blend[^`]*`,true\);/,'Place at a ROOM desk warns about it (the film desk docks)');
console.log('people-handoff-test: ok (a free spot at the dock end blends; a roll docks into the film desk user frame by frame; a room desk warns)');
