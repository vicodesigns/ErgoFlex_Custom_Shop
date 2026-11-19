// Room desks' items in the Layers tab and the click routing around them (18 Nov 2026), without a browser:
//   1. layers-panel.mjs: items with roomDesk go under their desk ("<desk> · on this desk"), never under the featured
//      desk's items or the room props; the desk itself keeps its row among the room props
//   2. director.mjs roomDeskOf: an object on a desk's mount is not the desk (a Layers row of a desk item selects the
//      item, not the desk); the desk group itself still is
//   3. scene-prop-editor.mjs: a double-click enters a desk, Esc (both documents) leaves it first, a Desks-tab pick ends
//      it quietly, and box select / clicks inside keep to the desk entered
//   node tests/director-room-desk-layers-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLayersPanel} from '../experience/layers-panel.mjs';
const key=(m,p='')=>JSON.stringify(['^'+m+'$','',p,null]);
const items=[
  {key:key('Prop:monitor'),target:{label:'Prop:monitor'},name:'Monitor',desk:true,hidden:false,area:''},
  {key:key('Prop:mug','a'),target:{label:'Prop:mug'},name:'Mug',desk:false,roomDesk:'station-research-desk',deskName:'Research desk',hidden:false,area:''},
  {key:key('Prop:books','b'),target:{label:'Prop:books'},name:'Books',desk:false,roomDesk:'station-research-desk',deskName:'Research desk',hidden:true,area:''},
  {key:key('Prop:lamp','c'),target:{label:'Prop:lamp'},name:'Lamp',desk:false,roomDesk:'station-window-research',deskName:'Window research desk',hidden:false,area:''},
  {key:key('Research desk · ErgoFlex desk'),target:{label:'Research desk · ErgoFlex desk'},name:'Research desk · ErgoFlex desk',desk:false,hidden:false,area:''},
  {key:key('Prop:sofa'),target:{label:'Prop:sofa'},name:'Sofa',desk:false,hidden:false,area:'Lounge'},
];
const root={addEventListener(){},querySelector:()=>null};
const props={items:()=>items,selectedKeys:()=>[],setLocked(){},selectKeys:async()=>1,flashKey(){},hideItems(){}};
const panel=createLayersPanel({root,shot:()=>({propLayers:[]}),commit(){},status(){},props,rerender(){}}).panel();
const group=id=>{const m=new RegExp(`data-ly-group="${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^]*?</details>`).exec(panel);return m?m[0]:null;};
const rd=group('room-desk:station-research-desk'),wr=group('room-desk:station-window-research'),feat=group('desk');
assert.ok(rd,'the research desk has its own group');assert.match(rd,/Research desk · on this desk/);
assert.equal((rd.match(/data-ly-item=/g)||[]).length,2,'its two items, hidden one included');
assert.ok(rd.includes('Mug')&&rd.includes('Books')&&!rd.includes('Lamp'));
assert.ok(wr&&wr.includes('Lamp'),'the window desk has its own group with its lamp');
assert.ok(feat&&feat.includes('Monitor')&&!feat.includes('Mug'),'the featured desk\'s items stay theirs');
const rooms=panel.slice(panel.indexOf('data-ly-group="room:'));
assert.ok(rooms.includes('Research desk · ErgoFlex desk')&&!rooms.includes('>Mug<'),'the desk keeps its own row among the room props; its items are not there');
assert.ok(panel.indexOf('room-desk:')>panel.indexOf('data-ly-group="desk"')&&panel.indexOf('room-desk:')<panel.indexOf('data-ly-group="room:'),'order: featured desk, room desks, room props');
// 2. roomDeskOf
const dir=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8').replace(/\r/g,'');
const rdo=/function roomDeskOf\([^]*?\n  \}/.exec(dir)?.[0]||'';
assert.match(rdo,/Desk dressing:/,'roomDeskOf stops at a desk mount');
const fn=new Function('recs','featured','obj',`const STATION=/:station:([a-z0-9][a-z0-9-]*)$/i;const stageDesks=()=>({records:new Map(recs.map(r=>[r.id,r])),selected:featured});${rdo};return roomDeskOf({obj});`);
const g={name:'Research desk · ErgoFlex desk',parent:null},mount={name:'Desk dressing:desktop',parent:g},mug={name:'Prop:mug',parent:mount},mesh={name:'mesh',parent:mug},body={name:'body',parent:g};
const recs=[{id:'main',group:{name:'m'}},{id:'station-research-desk',group:g,state:{name:'Research desk'}}];
assert.equal(fn(recs,'main',mug),null,'an item on the desk is not the desk');
assert.equal(fn(recs,'main',mesh),null,'nor a mesh of it');
assert.equal(fn(recs,'main',g)?.id,'station-research-desk','the desk group is the desk');
assert.equal(fn(recs,'main',body)?.id,'station-research-desk','the desk\'s own body is the desk');
assert.equal(fn(recs,'station-research-desk',g),null,'never the featured desk');
// 3. the wiring
const ed=readFileSync(new URL('../experience/scene-prop-editor.mjs',import.meta.url),'utf8').replace(/\r/g,'');
assert.match(ed,/addEventListener\('dblclick'[^]*?enterDesk\(rd\)/,'a double-click enters the desk under it');
assert.match(ed,/function boxPick[^]*?if\(inside&&!inInside\(m\)\)return;/,'box select keeps to the desk entered');
assert.match(ed,/if\(hit&&inside\)\{\s*if\(!inInside\(hit\.object\)\)/,'a click inside ignores other things');
assert.match(ed,/const rd=roomDeskGroupOf\(hit\.object\);if\(rd\)\{if\(underGizmo\)return;if\(sel\)deselect\(\);if\(roomDesk\(/,'outside, a click on a room desk (or its item) selects the desk');
// 19 Nov 2026 (Windows run): a double-click enters what its FIRST click hit (that click can change the view); a press on
// the gizmo that never moves is a click on what is under it (the gumball covered the neighbours) and writes no edit;
// Alt+click inside a desk cycles through the items under the pointer; leaving a desk from Layers keeps Layers open
assert.match(ed,/const first=lastPress&&performance\.now\(\)-lastPress\.t<800[^;]*;\s*let hit=first\?\.hit&&inScene\(first\.hit\.object\)\?first\.hit:null;/,'the double-click uses what was under its first press');
assert.match(ed,/if\(d\.gizmo\)\{setTimeout\(\(\)=>\{if\(!gizmo\.dragging&&!w\.__directorDragging&&!gizmoMoved\)viewClick\(ev,d,true\);\},0\);return;\}/,'a gizmo press that never moved clicks what is under it');
assert.match(ed,/if\(drag&&!drag\.moved\)\{drag=null;return;\}/,'and writes no edit');
assert.match(ed,/if\(d\.alt\)\{const stack=\[\.\.\.new Set\(hits\.map\(h=>roomDeskItem\(h\.object\)\)/,'Alt+click cycles through the stack inside a desk');
assert.match(ed,/roomDesk\(\{obj:g,edit:null,key:null,stay:true\}\)/,'leaving asks to stay on the tab');
assert.match(dir,/if\(!\(p\.stay&&inspector==='layers'\)\)reveal\('desk'\)/,'and the Director keeps Layers open then');
assert.equal((dir.match(/if\(sceneProps\.insideDesk\?\.\(\)\)\{[^}]*sceneProps\.leaveDesk\(\)/g)||[]).length,2,'Esc leaves the desk first, in the Director and the stage documents');
assert.match(dir,/createSceneDeskEditor\([^]*?onSelect:\(\)=>\{[^}]*sceneProps\.leaveDesk\?\.\(\{quiet:true\}\)/,'a desk picked in the Desks tab ends it quietly');
// 4. Studio's click-to-feature a desk is off in the Director (19 Nov 2026: a click on a room desk made it THE featured
//    desk: its body hidden, its people at the featured desk's place; studio.js onCanvasClick -> sceneDesks.pick / select)
const de=readFileSync(new URL('../experience/scene-desk-editor.mjs',import.meta.url),'utf8').replace(/\r/g,'');
for(const [f,src] of [['scene-prop-editor.mjs',ed],['scene-desk-editor.mjs',de]])assert.match(src,/sd\.pick=\(\)=>null/,f+' mutes Studio\'s desk pick');
const studio=readFileSync(new URL('../studio.js',import.meta.url),'utf8');
assert.match(studio,/const picked=sceneDesks\?\.pick\(event\);if\(picked\?\.id&&picked\.id!==sceneDesks\.selected\)\{sceneDesks\.select\(picked\.id\)/,'(Studio still features a clicked desk through pick: the mute is what stops it in the Director)');
// 5. (19 Nov 2026, Windows, twice) the double-click reads what was under its FIRST PRESS. Its clicks can't carry it: while
//    the desk is selected the Desks tab takes the clicks on it (scene-desk-editor.mjs: pointerup in capture on the stage
//    window, stopImmediatePropagation), so viewClick never saw them, and the dblclick's own ray came after the redraw
//    those selects made (the APA desk's neighbour, MMET, or the desk's body: no item). The press always reaches here.
assert.match(de,/w\.addEventListener\('pointerup',[^]*?ev\.stopImmediatePropagation\(\);ev\.preventDefault\(\);release\(ev\);select\(/,'(the Desks tab keeps the clicks on a selected desk to itself)');
assert.match(ed,/dom\.addEventListener\('pointerdown',ev=>\{gizmoMoved=false;[^]*?\n      down=ev\.button===0\?[^\n]*if\(down\)notePress\(ev,down\);\},true\);/,'every press is noted, before any click handler');
assert.match(ed,/function notePress\(ev,d\)\{[^]*?if\(p&&!p\.second&&!ev\.altKey&&now-p\.t<600&&Math\.hypot\([^)]*\)<8\)\{p\.second=true;d\.second=true;return;\}[^]*?lastPress=\{t:now,x:ev\.clientX,y:ev\.clientY,hit:raycaster\.intersectObject/,'the hit is read at the press; a double-click\'s second press keeps the first');
assert.match(ed,/function viewClick[^]*?if\(d\.second\)return;\s*const hits=/,'the second click of a double-click does nothing as a click');
assert.ok(!/lastClick/.test(ed),'(no click record left)');
assert.match(dir,/globalThis\.__directorPropEdits=\(\)=>shot\(\)\?copy\(layersPropEdits\(filmShot\(\),shot\(\)\)/,'the e2e reads the Director\'s edits, the film\'s while the shot has none');
// 6. The first Director edit of a chapter copies the film's director:true entries into the shot unchanged (the cine
//    cut's oil room: 5 lockers and a wall, from an earlier Export cut); the merge marks them director:true again
{const {filmPropEdits,mergePropEdits}=await import('../experience/prop-edits.mjs');
  const f=JSON.parse(readFileSync(new URL('../exports/cinematic-intro-cut-cine/director-film/oilers.json',import.meta.url),'utf8')),own=f.sceneEdits.filter(e=>e.director);
  const copied=filmPropEdits(f);assert.equal(copied.length,own.length);
  copied.forEach((e,i)=>assert.deepEqual({...e,director:true},own[i],'entry '+i+' as the film has it, but for the director flag'));
  assert.deepEqual(mergePropEdits(f,{propEdits:copied}).sceneEdits,f.sceneEdits.filter(e=>!e.director).concat(own),'and the film the Director hands on is the same');}
console.log('director-room-desk-layers-test: ok (room desks\' items under their desk in Layers; an item is not its desk; enter / leave wiring)');
