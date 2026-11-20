// Which way a walker faces at the end of the walk (19 Nov 2026, Vico: Kai ends his walk in the music chapter not facing
// the desk and wants to set it himself). The People tab's Walk path section: "Faces at the end" (slider, live, and a
// number; one undo step), "Face the desk", "Face along the path", and an arrow on the floor at the path's end whose tip
// turns it. The field is walk.turn (room-people.mjs walkEnd); this checks, without a browser:
//   1. the rule (people-path-edit.mjs endFacing): set, else the placement handed over to, else along the last leg;
//      facingToward and wrapTurn in the room's turn (0 faces +z, 90 faces +x)
//   2. the section (people-path-gizmo.mjs, on stubs): the row; the slider's drag previews on the stage's walker and its
//      end writes walk.turn as one undo step; the number; Face the desk (the stage's film desk keyboard); Face along the
//      path (removes it)
//   3. the stage (RoomPeople, Kai's walk in the music chapter): with walk.turn he turns into it over the end of the walk
//      (a few degrees a frame, not in one), and stands at it; without, along the path
//   4. kept: the Director (people-edits.mjs cleanPerson, v2 verbatim) and the importer (build-round8-director.py clean_people)
//   node tests/people-walk-facing-test.mjs
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as PE from '../experience/people-path-edit.mjs';
import {createPathGizmo} from '../experience/people-path-gizmo.mjs';
import {cleanPerson,cleanPeople} from '../experience/people-edits.mjs';
import {library,makeRoom} from '../tools/experience/people-ghost-audit.mjs';
import {castEntries,RoomPeople} from '../room-people.mjs';
globalThis.__ERGO_PRESENTATION__=true;
const A={key:'people-kai-sit-controller',id:'people-kai-sit-controller',at:[-1079,1348],turn:151};
const kai=(more={})=>({key:'kai-gets-up',id:'people-kai-walk',at:[-1079,1348],turn:151,change:{seconds:2.2},walk:{path:[[-1079,1348],[-427,1784]],start:8.4,then:'people-kai-stand-wait',...more},carry:{from:A.id}});
// 1
assert.equal(PE.wrapTurn(190),-170);assert.equal(PE.wrapTurn(-180),180);assert.equal(PE.wrapTurn(540),180);
assert.equal(PE.facingToward([0,0],[0,1000]),0,'1. +z is 0');assert.equal(PE.facingToward([0,0],[1000,0]),90,'1. +x is 90');assert.equal(PE.facingToward([5,5],[5,5]),null);
assert.deepEqual(PE.endFacing(kai(),[A]),{turn:56.2,from:'path'},'1. no turn, no placement where it ends: along the last leg');
assert.deepEqual(PE.endFacing(kai({turn:175}),[A]),{turn:175,from:'set'},'1. set');
assert.deepEqual(PE.endFacing(kai(),[A,{key:'w',id:'people-kai-stand-wait',at:[-430,1790],turn:-20}]),{turn:-20,from:'then'},'1. the placement it hands over to');
assert.equal(PE.FIELDS.walk.turn.label,'Faces at the end');
// 2: the section on stubs
let cast=[A,kai()],undo=[],said=[],dirty=0;
const spec=structuredClone(cast[1]),stage={userData:{person:spec}};
const people={room:{peopleState:()=>({keyboard:{x:-245,z:-100},pose:{x:-245,z:-360,yaw:0}}),roomLayout:{desk:[-245,-550]}},set dirty(v){dirty++;}};
const g=createPathGizmo({win:()=>({__peoplePlanner:{}}),three:()=>null,tools:()=>null,stagePeople:()=>people,entry:k=>cast.find(e=>e.key===k)||null,
  edit:(key,fn,text,options)=>{const e=structuredClone(cast.find(x=>x.key===key));fn(e,null);cast=cast.map(x=>x.key===key?e:x);undo.push(options?.undoKey||'step');said.push(text);},
  status:t=>said.push(t),editing:()=>true,lightsShowing:()=>false,selected:()=>'kai-gets-up',posing:()=>false,personName:()=>'Kai',objectOf:()=>stage,cast:()=>cast,
  modelOf:id=>({character:'kai'}),poseOf:id=>({label:id}),seconds:()=>12.5});
const walk=()=>cast.find(e=>e.key==='kai-gets-up').walk;
const html=g.panel(cast[1]);
for(const want of ['data-walk-facing','name="pe-path-turn-r"','name="pe-path-turn"','data-action="pe-path-face-desk"','data-action="pe-path-face-path"','Faces at the end'])assert.ok(html.includes(want),'2. the row has '+want);
assert.ok(/data-action="pe-path-face-path" disabled/.test(html),'2. "Face along the path" is off while nothing is set');
assert.ok(!/name="pe-path-turn" value="[^"]/.test(html)&&html.includes('placeholder="56 (along the path)"'),'2. the number is empty, the slider and placeholder show the facing along the path');
// the slider: input previews (the stage's walker, no edit), change writes one step
const el=(name,value,extra={})=>({name,value:String(value),type:name.endsWith('-r')?'range':'number',closest:()=>null,...extra});
assert.ok(g.input(el('pe-path-turn-r',120)));assert.ok(g.input(el('pe-path-turn-r',150)));
assert.equal(spec.walk.turn,150,'2. the slider previews on the stage\'s walker');assert.ok(dirty>=2,'2. and the stage redraws');assert.equal(undo.length,0,'2. no edit while it is dragged');
assert.ok(g.changed(el('pe-path-turn-r',150)));assert.equal(walk().turn,150,'2. the drag\'s end writes walk.turn');assert.equal(undo.length,1,'2. one undo step');
assert.deepEqual(walk().path,[[-1079,1348],[-427,1784]],'2. the path and the rest stay');assert.equal(walk().start,8.4);assert.deepEqual(cast[1].carry,{from:A.id});
assert.ok(g.changed(el('pe-path-turn',200)));assert.equal(walk().turn,-160,'2. typed 200 is -160 in the room\'s turn');
assert.ok(/disabled/.test(g.panel(cast[1]).match(/data-action="pe-path-face-path"[^>]*/)[0])===false,'2. "Face along the path" is on once set');
// Face the desk: from the end of the path to the stage's film desk keyboard
g.action('pe-path-face-desk');const want=PE.facingToward([-427,1784],[-245,-100]);
assert.equal(walk().turn,want,`2. Face the desk: ${want}°`);assert.ok(Math.abs(want-174.5)<.6,'2. (back across the room, toward the desk)');
g.action('pe-path-face-path');assert.equal(walk().turn,undefined,'2. Face along the path removes it');assert.equal(undo.length,4,'2. each button one undo step');
// 3: the stage
async function yaws(turn){
  const B=kai(turn===undefined?{}:{turn}),filter={only:[],cast:[A,B],when:{[A.key]:[[0,7.2,0,0]],'kai-gets-up':[[7.2,99,0,0]]}};
  const room=makeRoom('gaming','house',[...castEntries('gaming','house'),...filter.cast]),rp=new RoomPeople(room,library());
  const state=t=>({height:30,tilt:0,mode:'morning',pose:{x:-245,z:-360,yaw:0},keyboard:{x:-245,z:-100},time:t,track:null,now:0});
  room.peopleState=()=>state(5);rp.setFilter(filter);await rp.setEnabled(true);await rp.settled();for(let k=0;k<3;k++){rp.update(state(5));await rp.settled();}
  const out=[];for(let i=0;i<=180;i++){const t=Math.round((8+i/30)*1000)/1000;for(let k=0;k<2;k++){rp.update(state(t));await rp.settled();}const o=rp.people.find(o=>o.visible&&o.userData.person.key==='kai-gets-up');if(o)out.push([t,PE.wrapTurn(o.rotation.y*180/Math.PI)]);}
  return out;
}
const along=await yaws(),set=await yaws(want);
assert.ok(Math.abs(along.at(-1)[1]-56.2)<.2,`3. without a set facing he stands along the path (${along.at(-1)[1]}°)`);
assert.ok(Math.abs(set.at(-1)[1]-want)<.2,`3. with it he stands facing the desk (${set.at(-1)[1]}°, want ${want}°)`);
let worst=0,first=null,last=null;for(let i=1;i<set.length;i++){const d=Math.abs(PE.wrapTurn(set[i][1]-set[i-1][1]));worst=Math.max(worst,d);if(d>.05){first??=set[i][0];last=set[i][0];}}
assert.ok(worst<6,`3. he turns into it, at most ${worst.toFixed(2)}° a frame`);assert.ok(last-first>.8,`3. over ${(last-first).toFixed(2)} s (${first}-${last} s), not in one frame`);
// 4
assert.equal(cleanPerson(kai({turn:174.5})).walk.turn,174.5,'4. the Director keeps walk.turn (v1)');
assert.equal(cleanPeople({v:2,cast:[A,kai({turn:174.5})]}).cast[1].walk.turn,174.5,'4. and v2');
// (the importer is a script with no main guard: its imports, functions and constants only, compiled from the file)
const py=execFileSync('python3',['-c',`import ast,copy,json,math,re,sys
src=open('tools/experience/build-round8-director.py').read();g={'__name__':'clean_people'}
for n in ast.parse(src).body:
  if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef))or isinstance(n,ast.Assign)and 'argv' not in ast.dump(n):
    try:exec(compile(ast.Module([n],[]),'importer','exec'),g)
    except Exception:pass
c=json.loads(sys.stdin.read());print(json.dumps([g['clean_people']({'cast':c})['cast'][0].get('walk',{}).get('turn'),g['clean_people']({'v':2,'cast':c})['cast'][0]['walk'].get('turn')]))`],{cwd:new URL('..',import.meta.url).pathname,encoding:'utf8',input:JSON.stringify([kai({turn:174.5})])}).trim().split('\n').at(-1);
assert.deepEqual(JSON.parse(py),[174.5,174.5],'4. the importer keeps it (v1 and v2): '+py);
console.log(`people-walk-facing-test: ok (Faces at the end: slider live + one undo step, number, Face the desk ${want}°, Face along the path; Kai turns into it over ${(last-first).toFixed(1)} s, at most ${worst.toFixed(1)}° a frame; kept by the Director and the importer)`);
process.exit(0);
