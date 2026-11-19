// The Director's Move tool for people (scene-people-editor.mjs, 19 Nov 2026), without a browser: what the first move of
// someone of the room's own cast writes, and that the film's own people code (room-people.mjs, the stage and the
// render alike) draws it. The OCC media lab's coast chapter of the Cinematographer's cut, Andre at the sound-mix desk.
//   1. takeIn + unplace (the editor's own functions): the room's placement goes into except, the entry keeps its key
//      and its pose corrections, and is at a spot of its own; the film's people filter (peopleFilter) keeps all that
//   2. RoomPeople draws him there and not at the desk, seated on a task chair of his own (nobody sits on air), with
//      his pose correction applied
//   3. Delete on the room's person: except, the entry kept as off; RoomPeople draws nobody
//   node tests/people-move-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {library,makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries,RoomPeople} from '../room-people.mjs';
import {editablePeople} from '../people-postures.mjs';
import {cleanPeople,canonicalPeople,peopleFilter} from '../experience/people-edits.mjs';
import {SEAT_FIELDS} from '../experience/people-track.mjs';
const film=JSON.parse(readFileSync(new URL('../exports/cinematic-intro-cut-cine/director-film/coast.json',import.meta.url),'utf8'));
const ed=readFileSync(new URL('../experience/scene-people-editor.mjs',import.meta.url),'utf8');
// a function of the editor, as it is there (its braces counted)
const fn=name=>{const i=ed.indexOf(`  function ${name}(`);assert.ok(i>=0,name+' is in the editor');let d=0,j=ed.indexOf('{',i);for(;;j++){if(ed[j]==='{')d++;else if(ed[j]==='}'&&--d===0)break;}return ed.slice(i,j+1);};
const {takeIn,unplace}=new Function('SEAT_FIELDS',`${fn('takeIn')}\n${fn('unplace')}\nreturn {takeIn,unplace};`)(SEAT_FIELDS);
const STATION={id:'sound-mix-02',at:[3000,2500],turn:0,height:28};
const state=t=>({height:28,tilt:0,mode:film.mode||'morning',pose:{x:0,z:0,yaw:0},keyboard:{x:0,z:260},time:t,track:null,now:0});
globalThis.__ERGO_PRESENTATION__=true;
async function staged(people){
  const room=makeRoom('occmedialab','house',[...castEntries('occmedialab','house'),...people.cast]);room.roomLayout.stations=[STATION];
  const rp=new RoomPeople(room,library());room.peopleState=()=>state(1);rp.setFilter(people);await rp.setEnabled(true);await rp.settled();
  for(let i=0;i<3;i++){rp.update(state(1));await rp.settled();}
  return rp;
}
const andre=rp=>rp.people.filter(o=>/^people-andre-/.test(o.userData.person.id)&&o.visible);
// before: at the desk, the room's
const before=await staged(film.people);
const at0=andre(before);assert.equal(at0.length,1,'Andre is drawn once');assert.ok(!at0[0].userData.person.extra&&at0[0].userData.person.station==='sound-mix-02','at the sound-mix desk, the room\'s placement');
const desk=[Math.round(at0[0].position.x),Math.round(at0[0].position.z)];
// 1. the first move
const base={v:2,...structuredClone(film.people)},people=editablePeople(base,before.resolved({editable:true}));
const x=people.cast.find(e=>e.poseSource?.station==='sound-mix-02');assert.ok(x,'the People tab has him as the room\'s (poseSource)');
const key=x.key,rk=x.poseSource.key,Q=[0,.2588,0,.9659];
x.postures={[x.id]:{pose:{upperarm_l:Q}}};   // (a pose correction of his, made before the move)
takeIn(people,x);unplace(x);x.at=[desk[0]+900,desk[1]-400];x.turn=90;
const edits=cleanPeople(canonicalPeople(people)),f=peopleFilter(edits),y=f.cast.find(e=>e.key===key);
assert.ok(f.except.includes(rk),'the room\'s placement is left out: except '+rk);
assert.ok(y&&!y.poseSource&&!y.station&&!y.desk&&y.at[0]===desk[0]+900&&y.turn===90,'his entry is at a spot of its own: '+JSON.stringify({at:y?.at,turn:y?.turn}));
assert.deepEqual(y.postures?.[y.id]?.pose?.upperarm_l,Q,'with his pose correction');
// 2. drawn there
const after=await staged(f),drawn=andre(after);
assert.equal(drawn.length,1,'Andre is drawn once: '+drawn.map(o=>o.userData.person.id+(o.userData.person.extra?' (chapter)':' (room)')).join(', '));
assert.ok(drawn[0].userData.person.extra,'as the chapter\'s');
assert.deepEqual([Math.round(drawn[0].position.x),Math.round(drawn[0].position.z)],[desk[0]+900,desk[1]-400],'where he was moved');
assert.ok(Math.abs(drawn[0].rotation.y-Math.PI/2)<1e-6,'facing the way he was turned');
const chair=drawn[0].userData.personChair;assert.ok(chair&&chair.visible,'seated, on a task chair of his own');
assert.ok(Math.hypot(chair.position.x-drawn[0].position.x,chair.position.z-drawn[0].position.z)<1,'the chair under him');
assert.ok(drawn[0].userData.personRig&&drawn[0].userData.person.poseNow?.upperarm_l,'his pose correction applied');
// 3. Delete on the room's person
const p3=editablePeople({v:2,...structuredClone(film.people)},before.resolved({editable:true})),z=p3.cast.find(e=>e.poseSource?.station==='sound-mix-02');
z.hide=true;p3.except=[...new Set([...(p3.except||[]),z.poseSource.key])];
const f3=peopleFilter(cleanPeople(canonicalPeople(p3)));assert.ok(!f3.cast.some(e=>e.key===z.key),'his entry is off (the film leaves it out)');
assert.equal(andre(await staged(f3)).length,0,'and nobody draws him');
// the editor: everyone but the film desk's user gets the Gumball; the first move is the edit above
assert.match(ed,/const grab=on&&\(free\(e\)\|\|movable\(e\)\)&&!busy;/);
assert.match(ed,/const featured=e=>!!e\?\.desk&&!e\.station;\n  const movable=e=>!!e&&!featured\(e\)&&!free\(e\);/);
assert.match(ed,/function toSpot\(key,spot,text\)\{[^]*?write\(p=>\{const x=p\.cast\.find\(x=>x\.key===key\);if\(!x\)return;takeIn\(p,x\);asShown\(x,as\);unplace\(x\);/);
console.log('people-move-test: ok (the first move of the room\'s person: except, a spot of their own, a chair, the pose kept; drawn by the film\'s people code)');
