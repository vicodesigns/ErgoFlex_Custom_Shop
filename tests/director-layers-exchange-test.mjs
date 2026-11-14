// Layers phase 3, set A (the props part of the Director side), without a browser: the switch, the chapter's Studio rooms
// and setting, the stage's names for Studio items, what the Studio hides at a chapter's time and size, the Layers tab's
// eye rules (room desks locked for now), the Refresh rows (named from the stage; unnamed reported, never guessed), the
// chapter edits they become, and Make permanent writing a chapter hide to the layers key at the chapter's cell.
//   node tests/director-layers-exchange-test.mjs
import assert from 'node:assert/strict';
import {layersOn,chapterRooms,chapterSetting,stageTargets,studioHiddenHere,rowEye,hiddenOnly,showAllKeys,layerAdoptRows,applyLayerRows,permanentCells,splitPermanent,writePermanentLayers,deskHidePlan,foldDeskHides,belongingsOf,deskWith,stationOfItem,LAYERS_KEY} from '../experience/layers-exchange.mjs';
import {cleanDeskEdit} from '../experience/desk-edits.mjs';
import {cleanPeople,peopleFilter} from '../experience/people-edits.mjs';
import {diffSceneLayers} from '../experience/studio-sync.mjs';
import {cleanPropEdit,propKey} from '../experience/prop-edits.mjs';
import {entryKey,hiddenAt} from '../scene-layers.mjs';

let n=0;const ok=name=>{n++;console.log('ok',name);};
const HS='highschool:house',oilers={id:'oilers',room:'highschool',layout:'house',mode:'morning',size:'60x30'};
const BK='highschool:house:room:24:ergoflex-small-bookshelf',CH='highschool:house:room:13:ergoflex-designer-chair',ST='highschool:house:station:research-desk';
const T=(asset,name)=>({match:'^'+name.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&')+'$',asset,label:name});
const item=(asset,name,extra={})=>({key:propKey(T(asset,name)),target:T(asset,name),obj:{userData:{sceneAssetKey:asset}},name,...extra});
const items=[item(BK,'Prop:ergoflex-small-bookshelf'),item(CH,'Prop:ergoflex-designer-chair',{hidden:true}),item(ST,'MMET media desk · ErgoFlex desk'),{key:'k-added',target:{match:'^Added prop:x#a$'},obj:{userData:{}},name:'Added prop'}];
{
  assert.equal(layersOn('?layers=0','1'),false);assert.equal(layersOn('','0'),false);assert.equal(layersOn('',null),true);assert.equal(layersOn('?layers=1','0'),true);
  assert.equal(LAYERS_KEY,'ergoflex.sceneLayers.v1');
  assert.deepEqual(chapterRooms(oilers),['highschool:house','highschool']);assert.deepEqual(chapterRooms({room:'library'},'humboldt'),['library:humboldt','library']);assert.deepEqual(chapterRooms(null),[]);
  assert.equal(chapterSetting(oilers,{morning:'First bell'}),'First bell · 60 in');assert.equal(chapterSetting({}),'every time and size');
  const t=stageTargets(items);assert.deepEqual([...t.keys()],['scene:'+BK,'scene:'+CH,'scene:'+ST],'only Studio items (a sceneAssetKey), never an added prop');
  assert.equal(t.get('scene:'+BK).name,'Prop:ergoflex-small-bookshelf');
  ok('switch, rooms, setting, stage names for Studio items');
}
{
  const layers=JSON.stringify({[entryKey(HS,'scene:'+BK)]:{kind:'prop',cells:{'morning/60x30':true}},[entryKey(HS,'scene:'+CH)]:{kind:'prop',cells:{'afternoon/*':true}},[entryKey('library:house','scene:x')]:{kind:'prop',cells:{'*/*':true}}});
  const here=studioHiddenHere(layers,oilers,chapterRooms(oilers),items);
  assert.deepEqual([...here.keys()],[items[0].key],'the bookshelf (First bell, 60 in); not the chair (Wave lab only)');
  assert.equal(studioHiddenHere(layers,{...oilers,mode:'afternoon'},chapterRooms(oilers),items).has(items[1].key),true);
  assert.equal(studioHiddenHere('junk',oilers,['highschool:house'],items).size,0);
  assert.deepEqual([rowEye(items[0]).can,rowEye(items[2]).can],[true,true],'a room desk can be hidden (set B)');assert.equal(rowEye(items[2]).desk,'research-desk');
  assert.equal(rowEye(items[2],{featured:'station-research-desk'}).can,false);assert.match(rowEye(items[2],{featured:'station-research-desk'}).why,/subject/,'never the featured desk');
  assert.deepEqual(hiddenOnly(items,true).map(i=>i.name),['Prop:ergoflex-designer-chair']);assert.equal(hiddenOnly(items,false).length,4);
  assert.deepEqual(showAllKeys([...items,{...items[2],hidden:true}]),[items[1].key],'Show all leaves room desks alone');
  ok('Layers tab: Studio chips at the chapter\'s cell, eyes (the featured desk locked), hidden only, show all (desks left to their own eye)');
}
{
  const before=JSON.stringify({[entryKey(HS,'scene:'+CH)]:{kind:'prop',cells:{'*/*':true}}});
  const after=JSON.stringify({[entryKey(HS,'scene:'+BK)]:{kind:'prop',label:'Small bookshelf',cells:{'morning/60x30':true}},[entryKey(HS,'scene:highschool:house:room:7:water-bottle')]:{kind:'prop',label:'Water bottle',cells:{'*/*':true}},
    [entryKey(HS,'desk:station-research-desk')]:{kind:'desk',label:'MMET media desk',cells:{'*/*':true}},[entryKey(HS,'desk:main')]:{kind:'desk',cells:{'*/*':true}}});
  const changes=diffSceneLayers(before,after,oilers,chapterRooms(oilers));
  assert.deepEqual(changes.map(c=>[c.id,c.change,c.room]),[['desk:main','hidden',HS],['desk:station-research-desk','hidden',HS],['scene:'+CH,'shown',HS],['scene:'+BK,'hidden',HS],['scene:highschool:house:room:7:water-bottle','hidden',HS]]);
  assert.deepEqual(diffSceneLayers(after,after,oilers,['highschool:house']),[]);
  const propEdits=[{...T(CH,'Prop:ergoflex-designer-chair'),position:[-.471,0,-.286],hide:true}];
  const rows=layerAdoptRows(changes,{targets:stageTargets(items),propEdits,featured:'main',setting:'First bell · 60 in'}),by=Object.fromEntries(rows.map(r=>[r.id,r]));
  assert.equal(by['desk:main'].take,'');assert.match(by['desk:main'].chapter,/subject/,'the featured desk stays visible in the film');
  assert.equal(by['desk:station-research-desk'].take,'');assert.match(by['desk:station-research-desk'].chapter,/Not on the stage/,'no stage items given: reported, not guessed');
  assert.equal(by['scene:'+BK].take,'Hide it in this chapter too');assert.equal(by['scene:'+BK].studio,'Studio hid it (First bell · 60 in)');assert.equal(by['scene:'+BK].name,'Prop:ergoflex-small-bookshelf');
  assert.equal(by['scene:highschool:house:room:7:water-bottle'].take,'','not on this stage: reported, not guessed');assert.match(by['scene:highschool:house:room:7:water-bottle'].chapter,/Not on the stage/);
  assert.ok(by['scene:'+CH].conflict&&by['scene:'+CH].take==='Show it in this chapter too'&&by['scene:'+CH].chapter==='hidden in this chapter');
  // taking the rows: the bookshelf gets the chapter's ordinary hide edit; the chair's chapter hide goes, its move stays
  const next=applyLayerRows(propEdits,rows.filter(r=>r.take));
  const bk=next.find(e=>e.asset===BK),ch=next.find(e=>e.asset===CH);
  assert.deepEqual(bk,cleanPropEdit({...T(BK,'Prop:ergoflex-small-bookshelf'),hide:true}));assert.equal(ch.hide,undefined);assert.deepEqual(ch.position,[-.471,0,-.286]);
  // a show with no chapter edit writes nothing; a show of a chapter hide-only edit drops it
  assert.deepEqual(applyLayerRows([],[{kind:'layer',edit:{...T(BK,'x'),hide:false}}]),[]);
  assert.deepEqual(applyLayerRows([{...T(BK,'x'),hide:true}],[{kind:'layer',edit:{...T(BK,'x'),hide:false}}]),[]);
  assert.deepEqual(applyLayerRows(propEdits,[]),propEdits,'nothing taken: nothing changes');
  ok('Refresh rows: named from the stage, unnamed reported, featured desk refused; taking them writes ordinary chapter hide edits');
}
{
  assert.deepEqual(permanentCells(oilers,{morning:'First bell'}),[{cell:'morning/60x30',label:'Hidden in Studio for First bell · 60 in'},{cell:'*/*',label:'Hidden in Studio everywhere'}]);
  assert.deepEqual(permanentCells({}),[{cell:'*/*',label:'Hidden in Studio for every time and size'}]);
  const plan=[{editorId:'scene:'+BK,remove:true,name:'Small bookshelf',key:'a'},{editorId:'scene:'+CH,transform:{p:{x:1,y:0,z:0}},key:'b'},{editorId:'scene:highschool:custom:1:lamp',remove:true,key:'c'}];
  const split=splitPermanent(plan,new Set(['scene:highschool:custom:1:lamp']));
  assert.deepEqual(split.layers.map(r=>r.key),['a'],'a stock prop hidden -> a Studio hide');assert.deepEqual(split.assets.map(r=>r.key),['b','c'],'moves and Studio-added items as before');
  const base=JSON.stringify({[entryKey('library:house','scene:x')]:{kind:'prop',cells:{'*/*':true}}});
  const out=JSON.parse(writePermanentLayers(base,HS,split.layers,'morning/60x30',{t:7}));
  assert.deepEqual(out[entryKey(HS,'scene:'+BK)],{kind:'prop',label:'Small bookshelf',propId:'ergoflex-small-bookshelf',cells:{'morning/60x30':true},by:'Director',t:7});
  assert.ok(out[entryKey('library:house','scene:x')],'other rooms kept');assert.ok(hiddenAt(out[entryKey(HS,'scene:'+BK)],'morning','60x30')&&!hiddenAt(out[entryKey(HS,'scene:'+BK)],'afternoon','60x30'));
  assert.throws(()=>writePermanentLayers(base,'Bad Room',split.layers,'*/*'));
  ok('Make permanent: a chapter hide -> a Studio hide at the chapter\'s cell (never `removed`); moves and added items unchanged');
}
// ---- set B: a room desk hidden in a chapter (desk edit + its chair and props + its user out of the cast)
{
  const CHAIR='highschool:house:room:2:ergoflex-office-chair',PC='highschool:house:room:20:ergoflex-desktop-pc',NEIGH='highschool:house:room:1:ergoflex-office-chair';
  const own=(asset,name,station)=>({...item(asset,name),obj:{userData:{sceneAssetKey:asset,layersStation:station}}});
  const desk={...item(ST,'MMET media desk · ErgoFlex desk'),obj:{userData:{sceneAssetKey:ST,sceneDeskId:'station-research-desk'}}};
  const stage=[desk,own(CHAIR,'Prop:ergoflex-office-chair','research-desk'),own(PC,'Prop:ergoflex-desktop-pc','research-desk'),own(NEIGH,'Prop:ergoflex-office-chair','window-research'),{key:'odd',name:'Unnamed thing',obj:{userData:{layersStation:'research-desk'}}}];
  const cast=[{key:'noah-sit-type',id:'people-noah-sit-type',desk:'sit',station:'research-desk'},{key:'mia-sit-type',id:'people-mia-sit-type',desk:'sit',station:'window-research'},{key:'kai',id:'people-kai-wheel-type',desk:'wheel'}];
  assert.equal(stationOfItem(desk),'research-desk');assert.equal(stationOfItem(stage[1]),null);
  assert.deepEqual(belongingsOf(stage,'research-desk').map(x=>x.name),['Prop:ergoflex-office-chair','Prop:ergoflex-desktop-pc','Unnamed thing'],'only what the placement says belongs to it');
  assert.equal(deskWith({stationId:'research-desk',items:stage.slice(0,3),cast}),'office chair, desktop pc and Noah');
  const plan=deskHidePlan({stationId:'research-desk',hide:true,featured:'main',items:stage,deskEdits:[{desk:'station-research-desk',pose:{x:1,z:2,yaw:0}}],propEdits:[],cast});
  assert.ok(plan.ok);assert.deepEqual(plan.deskEdits,[{desk:'station-research-desk',pose:{x:1,z:2,yaw:0},hide:true}],'the desk edit keeps its pose and gains hide');
  assert.deepEqual(plan.propEdits.map(e=>[e.asset,e.hide]),[[CHAIR,true],[PC,true]],'its chair and PC as ordinary prop hide edits; the neighbour\'s chair untouched');
  assert.deepEqual(plan.unnamed,['Unnamed thing'],'no stage name: reported, not guessed');
  assert.deepEqual(plan.cast.map(p=>[p.key,!!p.hide]),[['noah-sit-type',true],['mia-sit-type',false],['kai',false]],'its user leaves the cast');
  assert.deepEqual(peopleFilter({cast:plan.cast}).cast.map(p=>p.key),['mia-sit-type','kai'],'the film\'s people: without Noah');
  assert.ok(plan.propEdits.every(e=>cleanPropEdit(e))&&plan.deskEdits.every(e=>cleanDeskEdit(e)));
  const back=deskHidePlan({stationId:'research-desk',hide:false,featured:'main',items:stage,deskEdits:plan.deskEdits,propEdits:plan.propEdits,cast:plan.cast});
  assert.deepEqual(back.deskEdits,[{desk:'station-research-desk',pose:{x:1,z:2,yaw:0}}]);assert.deepEqual(back.propEdits,[]);assert.ok(back.cast.every(p=>!p.hide));
  assert.deepEqual(deskHidePlan({stationId:'research-desk',hide:false,items:stage,deskEdits:[],propEdits:[],cast:[]}).deskEdits,[],'showing a desk the chapter never hid: no edit');
  assert.equal(deskHidePlan({stationId:'research-desk',hide:true,featured:'station-research-desk',items:stage}).ok,false,'the featured desk is refused');
  // a desk nobody works at in this chapter (the people cut's oilers casts Noah elsewhere): no cast change, so the
  // caller writes no peopleEdits; the desk and its chair / PC still go
  const castNoNoah=cast.filter(p=>p.station!=='research-desk'),nobody=deskHidePlan({stationId:'research-desk',hide:true,featured:'main',items:stage,deskEdits:[],propEdits:[],cast:castNoNoah});
  assert.ok(nobody.ok);assert.equal(nobody.cast,null,'no user: cast null (no peopleEdits written)');assert.deepEqual(nobody.users,[]);
  assert.deepEqual(nobody.deskEdits,[{desk:'station-research-desk',hide:true}]);assert.equal(nobody.propEdits.length,2);
  assert.equal(deskHidePlan({stationId:'research-desk',hide:true,items:stage,cast:plan.cast}).cast,null,'already out of the cast: nothing to change');
  assert.deepEqual(plan.users,['noah-sit-type'],'a desk with a user: who leaves');
  // a user who is an extra of the chapter's own cast (the people cut's Fern at the design review desk) leaves the same way
  const fern=deskHidePlan({stationId:'project-review',hide:true,featured:'main',items:stage,cast:[{key:'fern',id:'people-fern-sit-type',station:'project-review',desk:'sit'},...cast]});
  assert.deepEqual(fern.cast.filter(p=>p.hide).map(p=>p.key),['fern']);
  // the Refresh row: one row for the desk and what goes with it
  const rows=layerAdoptRows([{id:'desk:station-research-desk',kind:'desk',label:'MMET media desk',change:'hidden',room:HS},{id:'desk:station-gone',kind:'desk',change:'hidden',room:HS}],{targets:stageTargets(stage),items:stage.slice(0,3),cast,featured:'main',setting:'First bell · 60 in'});
  assert.equal(rows[0].take,'Hide MMET media desk with office chair, desktop pc and Noah in this chapter too');assert.deepEqual(rows[0].desk,{stationId:'research-desk',hide:true});
  assert.equal(rows[1].take,'');assert.match(rows[1].chapter,/Not on the stage/);
  // Make permanent folds the chair / PC hides back into one desk entry
  const perm=foldDeskHides([{editorId:'scene:'+CHAIR,obj:stage[1].obj},{editorId:'scene:'+PC,obj:stage[2].obj},{editorId:'scene:'+BK,obj:{userData:{}}}],[{desk:'station-research-desk',hide:true,name:'MMET media desk'}]);
  assert.deepEqual(perm.map(r=>r.editorId),['scene:'+BK,'desk:station-research-desk']);
  const written=JSON.parse(writePermanentLayers('{}',HS,perm,'morning/60x30'));
  assert.deepEqual(Object.keys(written).sort(),[entryKey(HS,'desk:station-research-desk'),entryKey(HS,'scene:'+BK)].sort(),'one desk entry, no chair / PC entries of their own');
  assert.equal(written[entryKey(HS,'desk:station-research-desk')].kind,'desk');
  assert.deepEqual(foldDeskHides([{editorId:'scene:'+CHAIR,obj:stage[1].obj}],[]).map(r=>r.editorId),['scene:'+CHAIR],'no desk hide: the chair is written on its own');
  ok('a room desk in a chapter: desk edit + its chair and PC as prop hides + its user out of the cast (one row); shown back; featured refused; Make permanent folds into one desk entry');
}
console.log(`Director layers exchange: ${n} checks pass.`);
