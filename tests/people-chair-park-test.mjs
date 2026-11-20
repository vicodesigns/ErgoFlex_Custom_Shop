// Where the film desk user's chair ends up while they stand (Vico, wellness, 19 Nov 2026: "How can I adjust where this
// chair ends up when she stands up?"), without a browser:
//   1. the stage (RoomPeople chairOf, the film alike) parks the chair at people.chair {back, side, turn}: mm behind the
//      seat along the desk's front, mm to the sitter's right, degrees; while seated it is at the seat
//   2. the People tab: "Where the chair ends up" (Back / Side in inches, Turn in degrees) at the top of the tab whenever
//      the chapter has a film desk, whoever is selected; Park it / Don't park it / The film's; the chapter's people.chair
//   3. "Move it in the view": a gizmo on the parked chair; where the stage parks it reads back as people.chair
//   node tests/people-chair-park-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {library,makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries,RoomPeople} from '../room-people.mjs';
globalThis.__ERGO_PRESENTATION__=true;
const crew=[{key:'andre-sit',id:'people-andre-sit-type',desk:'sit'},{key:'andre-stand',id:'people-andre-stand-type',desk:'stand'}];
async function chairAt(height,chair){
  const filter={only:[],cast:crew,...(chair?{chair}:{})},room=makeRoom('office',null,[...castEntries('office',null),...crew]);
  const people=new RoomPeople(room,library()),state={height,tilt:0,mode:'morning',pose:{x:0,z:0,yaw:0},keyboard:{x:0,z:260},time:null,track:null,now:0};
  room.peopleState=()=>state;people.setFilter(filter);await people.setEnabled(true);await people.settled();
  for(let i=0;i<40;i++){people.update({...state,dt:.1});await people.settled();}
  const a=people.actors.find(x=>x.character==='andre');assert.ok(a?.chair,'andre has his task chair');
  return {p:a.chair.position.toArray().map(Math.round),turn:Math.round(a.chair.rotation.y*180/Math.PI),home:people.chairHome?.toArray().map(Math.round)};
}
async function standing(chair){
  const filter={only:[],cast:crew,chair},room=makeRoom('office',null,[...castEntries('office',null),...crew]);
  const people=new RoomPeople(room,library()),state={height:43.5,tilt:0,mode:'morning',pose:{x:0,z:0,yaw:0},keyboard:{x:0,z:260},time:null,track:null,now:0};
  room.peopleState=()=>state;people.setFilter(filter);await people.setEnabled(true);await people.settled();
  for(let i=0;i<40;i++){people.update({...state,dt:.1});await people.settled();}
  return {people,a:people.actors.find(x=>x.character==='andre')};
}
// 1
const stood=await chairAt(43.5,{back:100,side:-700,turn:60}),dflt=await chairAt(43.5,{back:620,side:0,turn:0}),seated=await chairAt(28,{back:100,side:-700,turn:60});
assert.deepEqual([stood.p[0]-stood.home[0],stood.p[2]-stood.home[2]],[-700,100],'1. standing: 100 mm behind the seat, 700 mm to the sitter\'s left: '+JSON.stringify(stood));
assert.equal(stood.turn,180+60,'1. turned 60 degrees');
assert.deepEqual([dflt.p[0]-dflt.home[0],dflt.p[2]-dflt.home[2]],[0,620],'1. another spot: another place');
assert.ok(Math.hypot(seated.p[0]-seated.home[0],seated.p[2]-seated.home[2])<300,'1. seated: the chair is at the seat (rolled in), not parked: '+JSON.stringify(seated));
// 2
const ed=readFileSync(new URL('../experience/scene-people-editor.mjs',import.meta.url),'utf8');
assert.match(ed,/const PARK=\{back:\['Back','pe-park-back',620,'in'[^]*?side:\['Side','pe-park-side',0,'in'[^]*?turn:\['Turn','pe-park-turn',0,'°'/,'2. Back / Side in inches, Turn in degrees (the film\'s defaults)');
assert.match(ed,/value=k==='turn'\?Math\.round\(x\*2\)\/2:Math\.round\(x\*IN\);\s*write\(p=>\{p\.chair=\{back:PARK\.back\[2\],side:PARK\.side\[2\],turn:PARK\.turn\[2\],\.\.\.\(p\.chair\|\|\{\}\),\[k\]:value\};\}/,'2. inches to mm into the chapter\'s people.chair, one undo step per field');
assert.match(ed,/if\(name==='pe-park-off'\)\{write\(p=>\{delete p\.chair;\}/);assert.match(ed,/if\(name==='pe-park-film'\)\{const f=film\(\)\?\.people\?\.chair;/);
assert.match(ed,/\$\{hasFilmDesk\(\)\?`<details class="people-chair-park" data-chair-park open><summary>Where the chair ends up · while they stand<\/summary>\$\{parkPanel\(\)\}<\/details>`:''\}\s*\$\{keyInspector\(\)\}<div class="people-list">/,'2. at the top of the People tab, whoever is selected (Vico could not find it in one person\'s panel)');
assert.equal((ed.match(/parkPanel\(\)\}/g)||[]).length,1,'2. once (not in a person\'s panel as well)');
// 3. the chair's gizmo: its spot read back as people.chair, through the stage's own chair
{const fnOf=n=>{const i=ed.indexOf('  function '+n+'(');let d=0,j=ed.indexOf('{',i);for(;;j++){if(ed[j]==='{')d++;else if(ed[j]==='}'&&--d===0)break;}return ed.slice(i,j+1);};
  const THREE=await import('three'),parkOf=new Function('tools',fnOf('parkOf')+';return parkOf;')({THREE});
  for(const want of [{back:100,side:-700,turn:60},{back:620,side:0,turn:0},{back:350,side:420,turn:-30}]){
    const {people,a}=await standing(want),got=parkOf({people,chair:a.chair});
    assert.ok(Math.abs(got.back-want.back)<=1&&Math.abs(got.side-want.side)<=1&&Math.abs(got.turn-want.turn)<=.5,'3. the chair where people.chair puts it reads back as that: '+JSON.stringify({want,got}));}
  assert.match(ed,/function chairDragStart\(\)\{const c=parkedChair\(\),f=c\?\.people\.filter;if\(!c\|\|!f\)return;chairDrag=\{c,f,copy:\{\.\.\.f\}\};c\.people\.filter=chairDrag\.copy;\}/,'3. the drag holds a copy of the stage\'s filter, never the film\'s object');
  assert.match(ed,/write\(p=>\{p\.chair=v;\},`The chair ends up/,'3. the drag ends in the chapter\'s people.chair');
  assert.match(ed,/status\(c\?'The chair is parked only while they stand: scrub to a moment when they are standing\.'/,'3. and says when the chair is not parked at the playhead');}
console.log('people-chair-park-test: ok (the stage parks the chair where people.chair says; the People tab sets it)');
