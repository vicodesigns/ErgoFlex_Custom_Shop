// Layers: what belongs to a desk (its chair, its props) hides and comes back with the desk's eye. The rule is an
// explicit relation only: the room's placement names its station (`station`), never a distance.
//   node tests/studio-layers-seats-test.mjs
// Checked on the real room data: every institutional room and tier (the high school as Vico's saved state keys it),
// the office and the coworking layouts; then the derived hide / show in the model and the panel (a stub, no browser).
import assert from 'node:assert/strict';
import {INSTITUTIONAL_ROOMS} from '../institutional-scenes.mjs';
import {OFFICE_LAYOUTS} from '../office-room.mjs';
import {COWORKING_LAYOUTS} from '../coworking-room.mjs';
import {buildRows,groupRows,hiddenCount,visibilityOf,deskOfItem,eyeLocked} from '../studio-layers-model.mjs';
import {createStudioLayers} from '../studio-layers-panel.mjs';
import {entryKey} from '../scene-layers.mjs';
import {ownVisible} from '../room-people.mjs';
import {setLayersHidden} from '../studio-layers-panel.mjs';

let n=0;const ok=name=>{n++;console.log('ok',name);};
// every layout: each station with a chair has exactly one chair naming it, 1050 mm (or chairDistance) in front, turned
// with it; a station without a chair gets none from its layout; no placement names a station the layout lacks
function checkLayout(where,layout,{chairOf=s=>s.chairId||'steelcase-leap-v2',auto=s=>s.chair!==false}={}){
  const ids=new Set((layout.stations||[]).map(s=>s.id)),named=(layout.props||[]).map((p,i)=>({p,i})).filter(x=>x.p.station!==undefined);
  for(const x of named)assert.ok(ids.has(x.p.station),`${where}: room:${x.i}:${x.p.id} names a station the layout lacks: ${x.p.station}`);
  for(const s of layout.stations||[]){
    if(auto(s)){
      const gen=named.filter(x=>x.p.station===s.id&&x.p.id===chairOf(s));
      assert.ok(gen.length>=1,`${where}: station ${s.id} has no chair naming it`);
      const a=(s.turn||0)*Math.PI/180,d=s.chairDistance??1050,c=gen[0].p.at;
      assert.ok(Math.abs(c[0]-(s.at[0]+Math.sin(a)*d))<1&&Math.abs(c[2]-(s.at[1]+Math.cos(a)*d))<1,`${where}: ${s.id}'s chair is not ${d} mm in front of it`);
    }
  }
  return named.length;
}
{
  let rooms=0,claims=0;
  for(const [id,room] of Object.entries(INSTITUTIONAL_ROOMS))for(const [tier,layout] of Object.entries(room.layouts)){rooms++;claims+=checkLayout(`${id}/${tier}`,layout);}
  for(const [tier,layout] of Object.entries(OFFICE_LAYOUTS)){rooms++;claims+=checkLayout(`office/${tier}`,layout,{chairOf:()=> 'steelcase-leap-v2',auto:()=>true});}
  for(const [tier,layout] of Object.entries(COWORKING_LAYOUTS)){rooms++;claims+=checkLayout(`coworking/${tier}`,layout,{chairOf:()=> 'steelcase-leap-v2',auto:()=>true});}
  assert.ok(rooms>=30&&claims>=80,`${rooms} layouts, ${claims} placements naming a desk`);
  ok(`every station's own chair names its desk, in ${rooms} layouts (institutional, office, coworking); nothing names a missing desk`);
}
{
  // The high school (house), keyed as Vico's saved state keys it: indices unchanged by the annotation.
  const L=INSTITUTIONAL_ROOMS.highschool.layouts.house,at=i=>L.props[i];
  assert.deepEqual([1,2,13,19,20,24].map(i=>[i,at(i).id,at(i).station||null]),[
    [1,'ergoflex-office-chair','window-research'],[2,'ergoflex-office-chair','research-desk'],[13,'ergoflex-designer-chair',null],
    [19,'ergoflex-tall-office-chair','project-review'],[20,'ergoflex-desktop-pc','research-desk'],[24,'ergoflex-small-bookshelf',null]]);
  // exactly these four belong to a desk: the two station chairs, the drafting chair, the PC tower. The teacher's
  // conference chair, the lab stools, the student chairs and everything else stay with the room.
  assert.deepEqual(L.props.map((p,i)=>p.station?`room:${i}:${p.id}>${p.station}`:null).filter(Boolean),
    ['room:1:ergoflex-office-chair>window-research','room:2:ergoflex-office-chair>research-desk','room:19:ergoflex-tall-office-chair>project-review','room:20:ergoflex-desktop-pc>research-desk']);
  assert.ok(L.props.filter(p=>/ergoflex-artist-stool|ergoflex-designer-chair/.test(p.id)).every(p=>!p.station),'the lab stools and the conference chair are the room\'s');
  assert.equal(deskOfItem({station:'research-desk'}),'desk:station-research-desk');assert.equal(deskOfItem({}),null);assert.equal(deskOfItem({station:'bad id!'}),null);
  ok('high school: room:1, room:2 (station chairs), room:19 (drafting chair) and room:20 (PC tower) belong to their desks; nothing else does');
}
// ---- the derived hide / show
const HS='highschool:house',R='desk:station-research-desk',P='desk:station-project-review',id=s=>`scene:${HS}:${s}`;
const CH=id('room:2:ergoflex-office-chair'),PC=id('room:20:ergoflex-desktop-pc'),TALL=id('room:19:ergoflex-tall-office-chair'),NEIGH=id('room:1:ergoflex-office-chair'),STOOL=id('room:9:ergoflex-artist-stool');
const desks=[{id:'desk:main',name:'Main desk',featured:true},{id:R,name:'MMET media desk'},{id:P,name:'APA set and costume design review desk'},{id:'desk:station-window-research',name:'Coastal research nook'}];
const items=()=>[{id:CH,name:'Office chair',propId:'ergoflex-office-chair',role:'room',station:'research-desk'},{id:PC,name:'Desktop PC',propId:'ergoflex-desktop-pc',role:'room',station:'research-desk'},
  {id:TALL,name:'Tall office chair',propId:'ergoflex-tall-office-chair',role:'room',station:'project-review'},{id:NEIGH,name:'Office chair',propId:'ergoflex-office-chair',role:'room',station:'window-research'},
  {id:STOOL,name:'Artist stool',propId:'ergoflex-artist-stool',role:'room'}];
{
  const layers={[entryKey(HS,R)]:{kind:'desk',cells:{'morning/60x30':true}},[entryKey(HS,P)]:{kind:'desk',cells:{'morning/60x30':true}}};
  const {rows}=buildRows({room:HS,items:items(),layers,phase:'morning',size:'60x30',desks}),by=Object.fromEntries(rows.map(r=>[r.id,r]));
  for(const x of [CH,PC,TALL]){assert.ok(by[x].hidden&&by[x].byDesk&&!by[x].own&&eyeLocked(by[x]),x);}
  assert.ok(!by[NEIGH].hidden&&!by[STOOL].hidden,'the neighbour\'s chair and the room\'s stool stay');
  assert.match(by[CH].secondary,/belongs to MMET media desk · hidden with it/);
  const g=groupRows(rows),dg=g.find(x=>x.id==='desk');
  assert.deepEqual(dg.rows.find(r=>r.id===R).nested.map(r=>r.id).sort(),[CH,PC].sort(),'nested under the desk row');
  assert.deepEqual(dg.rows.find(r=>r.id===P).nested.map(r=>r.id),[TALL]);
  assert.deepEqual(g.find(x=>x.id==='furniture')?.rows.map(r=>r.id)||[],[STOOL],'not listed again under Furniture');
  assert.equal(hiddenCount(rows),5,'two desks, two chairs, the PC: each counted once');
  const vis=visibilityOf({room:HS,items:items(),layers,phase:'morning',size:'60x30',desks});
  assert.deepEqual([CH,PC,TALL,NEIGH,STOOL].map(x=>vis.get(x)),[true,true,true,false,false]);
  assert.deepEqual([CH,PC,TALL].map(x=>visibilityOf({room:HS,items:items(),layers,phase:'afternoon',size:'60x30',desks}).get(x)),[false,false,false],'Wave lab: back with the desks');
  // without the desks (the props-only call of phase 2) nothing is derived
  assert.equal(visibilityOf({room:HS,items:items(),layers,phase:'morning',size:'60x30'}).get(CH),false);
  // a chair hidden on its own stays hidden when its desk shows
  const own={...layers,[entryKey(HS,CH)]:{kind:'prop',cells:{'*/*':true}}};
  const shownDesk=buildRows({room:HS,items:items(),layers:{...own,[entryKey(HS,R)]:undefined},phase:'morning',size:'60x30',desks}).rows.find(r=>r.id===CH);
  assert.ok(shownDesk.hidden&&shownDesk.own&&!shownDesk.byDesk&&!eyeLocked(shownDesk));
  ok('derived: the desk\'s eye hides its chair and PC (no entries of their own), nested, greyed, locked eyes, counted once; the neighbour\'s chair stays; an own hide holds');
}
{
  // the panel with a stub: the objects really go and come back, and no entry is written for them
  const objs=Object.fromEntries(items().map(d=>[d.id,{name:d.name,visible:true,userData:{}}])),storage=new Map(),undo=[];let phase='morning';
  const L=createStudioLayers({roomKey:()=>HS,phase:()=>phase,size:()=>'60x30',items:()=>items().map(d=>({...d,obj:objs[d.id]})),desks:()=>desks,people:()=>[],
    assetState:()=>({removed:new Set()}),readRaw:k=>storage.get(k)??null,writeRaw:(k,v)=>storage.set(k,v),transaction:e=>undo.push(e),notify:()=>{},applyDesks:()=>false,applyPeople:()=>false});
  L.hydrated();
  L.test.hide(R,'cell');
  assert.deepEqual([CH,PC,TALL,NEIGH,STOOL].map(x=>objs[x].visible),[false,false,true,true,true],'the media desk\'s chair and PC go; the others stay');
  assert.deepEqual(Object.keys(JSON.parse(storage.get('ergoflex.sceneLayers.v1'))),[entryKey(HS,R)],'only the desk\'s entry is written');
  phase='afternoon';L.apply();assert.equal(objs[CH].visible,true);phase='morning';L.apply();assert.equal(objs[CH].visible,false);
  L.applyUndo(undo[0]);assert.deepEqual([objs[CH].visible,objs[PC].visible],[true,true],'undo: back');
  L.applyUndo({...undo[0],before:undo[0].after,after:undo[0].before});assert.deepEqual([objs[CH].visible,objs[PC].visible],[false,false],'redo: gone');
  L.test.show(R,'cell');assert.deepEqual([objs[CH].visible,objs[PC].visible],[true,true]);
  L.test.hide(PC,'all');L.test.hide(R,'cell');L.test.show(R,'cell');
  assert.deepEqual([objs[CH].visible,objs[PC].visible],[true,false],'the PC hidden on its own stays hidden when the desk is shown');
  ok('panel stub: the desk\'s eye takes its chair and PC with it and brings them back; undo/redo; an own hide holds');
}
{
  // At First bell Noah sits at the media desk and the people code sets the room's station chair aside (visible = false)
  // for the chair his posture brings. That is not a Layers hide: the row shows it as shown, the badge does not count it,
  // and hiding then showing the desk gives back exactly the visibility the people code last asked for.
  const objs=Object.fromEntries(items().map(d=>[d.id,{name:d.name,visible:true,userData:{}}])),storage=new Map(),undo=[];
  objs[CH].visible=false;   // stepped aside for Noah
  const L=createStudioLayers({roomKey:()=>HS,phase:()=>'morning',size:()=>'60x30',items:()=>items().map(d=>({...d,obj:objs[d.id]})),desks:()=>desks,people:()=>[],
    assetState:()=>({removed:new Set()}),readRaw:k=>storage.get(k)??null,writeRaw:(k,v)=>storage.set(k,v),transaction:e=>undo.push(e),notify:()=>{},applyDesks:()=>false,applyPeople:()=>false});
  L.hydrated();
  let rows=L.test.rows(),chair=rows.find(r=>r.id===CH);
  assert.equal(chair.hidden,false,'stepped aside is not hidden by Layers');assert.equal(objs[CH].visible,false,'Layers leaves the people code state alone');
  L.test.hide(R,'cell');assert.deepEqual([objs[CH].visible,objs[PC].visible],[false,false]);
  // while the desk is hidden its user is gone: the people code puts the chair back (raw true), then Noah comes back
  objs[CH].visible=true;assert.equal(objs[CH].visible,false,'the sticky hide holds');
  L.test.show(R,'cell');assert.deepEqual([objs[CH].visible,objs[PC].visible],[true,true],'show: the chair as the people code last set it, the PC as before');
  objs[CH].visible=false;   // Noah sits again: set aside again
  L.test.hide(R,'cell');objs[CH].visible=false;L.test.show(R,'cell');
  assert.deepEqual([objs[CH].visible,objs[PC].visible],[false,true],'nothing touched by the people code meanwhile: back exactly as before the hide (set aside)');
  // the badge counts Layers hides only
  rows=L.test.rows();assert.equal(rows.filter(r=>r.hidden).length,0,'no Layers hide: nothing counted, though the chair is invisible');
  L.applyUndo(undo.at(-1));assert.equal(objs[CH].visible,false,'undo of the show: hidden by the desk');
  L.applyUndo({...undo.at(-1),before:undo.at(-1).after,after:undo.at(-1).before});assert.equal(objs[CH].visible,false,'redo: back to before (still set aside)');
  ok('a station chair set aside for its seated user: not a Layers hide, not counted, and returned to exactly that after the desk is shown');
}
{
  // The people code setting a chair aside WHILE Layers hides it: it must record the chair's own visibility (what was set
  // underneath the hide), not the hide's `false`, or the chair would stay invisible after the desk and its user return.
  const chair={visible:true,userData:{}},people=new Map();
  setLayersHidden(chair,true);assert.equal(chair.visible,false);assert.equal(ownVisible(chair),true,'its own visibility under the hide');
  people.set(chair,ownVisible(chair));chair.visible=false;   // room-people.mjs: set aside (records true)
  setLayersHidden(chair,false);assert.equal(chair.visible,false,'shown by Layers: still set aside');
  chair.visible=people.get(chair);people.delete(chair);assert.equal(chair.visible,true,'the people code puts it back: visible (not stuck invisible)');
  assert.equal(ownVisible({visible:true}),true);assert.equal(ownVisible({visible:false}),false,'no Layers: plain visible (the film path)');
  assert.ok(!Object.keys((()=>{const o={visible:true,userData:{}};setLayersHidden(o,true);return o;})()).includes('layersRawVisible'),'not enumerable: a copy never carries it');
  ok('a chair set aside by the people code while Layers hides it records its own visibility, and comes back');
}
console.log(`Layers seats and desk props: ${n} checks pass.`);
