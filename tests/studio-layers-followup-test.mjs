// Layers phase 2 follow-up (studio-layers-model.mjs, studio-layers-panel.mjs): framing a row's item from further back and
// above, inside the room; the Delete toast (last, 7 s); the dock / phone sheet state, long-press timing, the scope sheet
// and what a row tap does. No browser.      node tests/studio-layers-followup-test.mjs
import assert from 'node:assert/strict';
import {frameView,TOAST_MS,deleteToastPlan,DELETE_TOAST,sheetNext,createPress,LONG_PRESS_MS,LONG_PRESS_SLOP,scopeSheetModel,rowTapPlan} from '../studio-layers-model.mjs';
import {createStudioLayers} from '../studio-layers-panel.mjs';
import {entryKey} from '../scene-layers.mjs';

let n=0;const ok=name=>{n++;console.log('ok',name);};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
// ---- framing (world metres: unit 1)
{
  const room={min:[-6,-4.5],max:[6,4.5],floor:0,ceiling:3};
  // the calculator on a student desk, the camera outside the room's front (the Studio's usual view)
  const v=frameView({center:[1,.76,2],size:[.15,.03,.1],from:[8,1.2,12],room,fov:35,aspect:16/9,unit:1});
  assert.deepEqual(v.target,[1,.76,2],'looks at the item');
  assert.ok(v.position[1]>=2-1e-9&&v.position[1]<=2.85+1e-9,'above a standing person\'s eyes, under the ceiling: '+v.position[1]);
  assert.ok(v.position[0]>=-5.75&&v.position[0]<=5.75&&v.position[2]>=-4.25&&v.position[2]<=4.25,'inside the room\'s walls: '+v.position);
  assert.ok(v.distance>=1.5,'far enough back to see its surroundings: '+v.distance.toFixed(2));
  assert.ok(v.position[1]>.76+.8,'looking down at it');
  assert.ok(v.position[2]>2&&v.position[0]>1,'from the side the viewer is on');
  // a sofa: further back, still inside
  const s=frameView({center:[-3,.4,-2],size:[2.2,.8,.9],from:[0,5,10],room,fov:35,aspect:16/9,unit:1});
  assert.ok(s.distance>v.distance&&s.position[0]>=-5.75&&s.position[2]<=4.25&&s.position[1]<=2.85);
  // a low ceiling: just under it, never through it
  const low=frameView({center:[0,.7,0],size:[.2,.2,.2],from:[0,1,5],room:{...room,ceiling:2.1},fov:35,aspect:1,unit:1});
  assert.ok(near(low.position[1],1.95),'just under a 2.1 m ceiling: '+low.position[1]);
  // millimetre world units (unit 1000) scale everything
  const mm=frameView({center:[1000,760,2000],size:[150,30,100],from:[8000,1200,12000],room:{min:[-6000,-4500],max:[6000,4500],floor:0,ceiling:3000},fov:35,aspect:16/9,unit:1000});
  mm.position.forEach((x,i)=>assert.ok(near(x/1000,v.position[i],1e-6)));
  // no room: 40 degrees down from the viewer's side
  const free=frameView({center:[0,0,0],size:[1,1,1],from:[0,0,10],fov:35,aspect:1,unit:1});
  assert.ok(near(Math.atan2(free.position[1],free.position[2])*180/Math.PI,40,1e-6));
  // the camera exactly above: a side is chosen, nothing breaks
  const top=frameView({center:[0,0,0],size:[.1,.1,.1],from:[0,9,0],room,fov:35,aspect:1,unit:1});assert.ok(top.position.every(Number.isFinite));
  ok('frameView: back and above, looking down, inside the walls and under the ceiling, any world unit');
}
// ---- the Delete toast: one call, after the undo step, deferred, 7 s, the exact text
{
  const HS='highschool:house',CALC='scene:highschool:house:room:40:calculator',calls=[];
  const obj={name:'Calculator',visible:true,userData:{}};
  const L=createStudioLayers({roomKey:()=>HS,phase:()=>'morning',size:()=>'60x30',items:()=>[{id:CALC,name:'Calculator',propId:'calculator',role:'room',obj}],
    assetState:()=>({removed:new Set()}),readRaw:()=>null,writeRaw:()=>calls.push(['write']),transaction:()=>calls.push(['undo']),
    notify:(text,opts)=>calls.push(['toast',text,opts]),afterVisibility:()=>calls.push(['after'])});
  assert.equal(L.hideForDelete([{editorId:CALC,obj}]),true);
  const toasts=calls.filter(c=>c[0]==='toast');
  assert.equal(toasts.length,1,'one toast: nothing of ours replaces it');
  assert.deepEqual(toasts[0],['toast',DELETE_TOAST,{ms:TOAST_MS,defer:true}]);
  assert.ok(calls.findIndex(c=>c[0]==='toast')>calls.findIndex(c=>c[0]==='undo'),'the toast comes after the hide and its undo step');
  assert.equal(TOAST_MS,7000);assert.deepEqual(deleteToastPlan(2,1),{text:'2 items hidden everywhere. Layers -> eye brings them back. Ctrl+Z undoes. 1 added item deleted.',ms:7000,defer:true});
  assert.equal(obj.visible,false);
  ok('Delete toast: one, after the undo step, deferred (the last toast), 7 s, exact text');
}
// ---- dock / phone sheet state
{
  const P={phone:true},D={phone:false},closed={open:false,peek:false};
  // desktop
  let s=sheetNext(closed,'button',D);assert.deepEqual(s,{open:true,peek:false});
  assert.deepEqual(sheetNext(s,'row',D),s,'desktop: a row tap keeps the dock');assert.deepEqual(sheetNext(s,'handle',D),s,'desktop: the handle resizes, no peek');
  assert.deepEqual(sheetNext(s,'button',D),closed);assert.deepEqual(sheetNext(s,'close',D),closed);
  assert.deepEqual(sheetNext(closed,'restore',D),{open:true,peek:false},'a stored open reopens on a desktop');
  // phone: half sheet -> row tap drops to a peek -> handle back to half -> handle peek again -> close
  s=sheetNext(closed,'button',P);assert.deepEqual(s,{open:true,peek:false},'opens at half height');
  s=sheetNext(s,'row',P);assert.deepEqual(s,{open:true,peek:true},'tap a row: peek (the framed item is visible)');
  s=sheetNext(s,'row',P);assert.deepEqual(s,{open:true,peek:true});
  s=sheetNext(s,'handle',P);assert.deepEqual(s,{open:true,peek:false},'handle: back to half');
  s=sheetNext(s,'handle',P);assert.deepEqual(s,{open:true,peek:true});
  assert.deepEqual(sheetNext(s,'button',P),closed,'the Layers button closes it, peek or not');
  assert.deepEqual(sheetNext(closed,'restore',P),closed,'a phone never reopens it by itself');
  assert.deepEqual(sheetNext(closed,'handle',P),closed);assert.deepEqual(sheetNext(closed,'row',P),closed);assert.deepEqual(sheetNext(null,'nothing',P),closed);
  ok('dock and phone sheet: open / half / peek / closed transitions');
}
// ---- long-press timing
{
  assert.equal(LONG_PRESS_MS,500);assert.equal(LONG_PRESS_SLOP,10);
  const p=createPress();
  p.down(100,100,0,'row-a');assert.equal(p.tick(499),null);assert.equal(p.id,'row-a');assert.equal(p.tick(500),'long');assert.equal(p.tick(800),null,'fires once');
  assert.equal(p.up(900),'long-done');assert.equal(p.swallowClick(),true,'the click after a long-press is swallowed');assert.equal(p.swallowClick(),false,'only that one');
  p.down(0,0,0,'b');assert.equal(p.up(200),'tap');assert.equal(p.swallowClick(),false,'a tap clicks');
  p.down(0,0,0,'c');assert.equal(p.move(6,6),'held','a small wobble keeps it');assert.equal(p.move(9,9),'cancelled','10 px or more is a scroll');assert.equal(p.tick(600),null);assert.equal(p.up(700),null);
  p.down(0,0,0,'d');p.cancel();assert.equal(p.tick(900),null);
  ok('long-press: 500 ms, 10 px slop, fires once, swallows exactly the next click');
}
// ---- the scope sheet and a row tap
{
  const row={id:'scene:hs:room:24:ergoflex-small-bookshelf',entryId:'scene:hs:room:24:ergoflex-small-bookshelf',name:'Small bookshelf',hidden:true};
  const m=scopeSheetModel({row,entry:{kind:'prop',legacy:'removed',cells:{'*/*':true,'morning/60x30':false}},phase:'afternoon',size:'60x30',labels:{morning:'First bell',afternoon:'Wave lab'}});
  assert.equal(m.title,'Show or hide Small bookshelf');
  assert.equal(m.line,'Hidden at: First bell 48 in, Wave lab 48 in, Wave lab 60 in, evening 48 in, evening 60 in, night 48 in, night 60 in, party 48 in, party 60 in');assert.ok(!m.line.includes('First bell 60 in'),'the exception is not listed');
  assert.deepEqual(m.buttons.map(b=>[b.kind,b.cell,b.label]),[
    ['hide','afternoon/60x30','Hide: This time & size (Wave lab · 60 in)'],['hide','afternoon/*','Hide: This time, both sizes (Wave lab)'],
    ['hide','*/60x30','Hide: Every time, this size (60 in)'],['hide','*/*','Hide: Everywhere'],
    ['show','afternoon/60x30','Show here (Wave lab · 60 in)'],['show','*/*','Show everywhere']]);
  assert.equal(scopeSheetModel({row:{...row,hidden:false},phase:'morning',size:'48x30'}).line,'Shown at every time and size.');
  assert.equal(scopeSheetModel({row:null}),null);
  assert.deepEqual(rowTapPlan({name:'Calculator',hidden:false},{phone:true}),{select:true,ghost:false,frame:true,peek:true,toast:''});
  assert.deepEqual(rowTapPlan({name:'Calculator',hidden:true},{phone:false}),{select:false,ghost:true,frame:true,peek:false,toast:'Calculator is hidden here: the outline shows where it is.'});
  assert.deepEqual(rowTapPlan({name:'Water bottle',missing:true}),{select:false,ghost:false,frame:false,peek:false,toast:'Water bottle is not in the room any more.'});
  ok('scope sheet rows and "Hidden at ..." line; a row tap selects + frames (shown) or outlines + frames (hidden), and peeks on a phone');
}
console.log(`Layers follow-up: ${n} checks pass.`);
