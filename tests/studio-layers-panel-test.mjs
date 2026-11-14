// Studio Layers panel, phase 2: the pure model (studio-layers-model.mjs) and the panel's scene side without a DOM
// (studio-layers-panel.mjs with a stub context: hydration, the sticky hide, Delete -> hide, undo / redo, a new time or
// size). No browser.      node tests/studio-layers-panel-test.mjs
import assert from 'node:assert/strict';
import {layersSwitch,UI_SWITCH_KEY,LAYERS_KEY,GROUPS,kindOf,entryKind,listable,settingLine,scopeChoices,defaultScope,cellFor,chipOf,hiddenAtLine,buildRows,filterRows,groupRows,
  hiddenCount,changeFor,applySide,invertChange,showAllChange,SHOW_ALL_CONFIRM,showAllConfirmText,deletePlan,DELETE_TOAST,deleteToast,visibilityOf,badgeText} from '../studio-layers-model.mjs';
import {createStudioLayers,setLayersHidden,isLayersHidden} from '../studio-layers-panel.mjs';
import {entryKey,hiddenAt,cleanLayers} from '../scene-layers.mjs';

let n=0;const ok=name=>{n++;console.log('ok',name);};
const HS='highschool:house',id=s=>`scene:${HS}:${s}`;
const BK=id('room:24:ergoflex-small-bookshelf'),CHAIR=id('room:13:ergoflex-designer-chair'),RUG=id('fixture:desk-zone-rug'),INLAY=id('fixture:demo-floor-inlay'),OFFICE=id('room:1:ergoflex-office-chair');
const items=()=>[
  {id:BK,name:'Small bookshelf',propId:'ergoflex-small-bookshelf',role:'room',category:'furniture',anchor:'floor',at:[-4213,2381]},
  {id:CHAIR,name:'Designer chair',propId:'ergoflex-designer-chair',role:'room',category:'furniture',anchor:'floor',at:[-2580,-2700]},
  {id:OFFICE,name:'Office chair',propId:'ergoflex-office-chair',role:'room',category:'furniture',anchor:'floor',at:[-4200,900]},
  {id:RUG,name:'Mobile workspace floor rug',role:'room'},
  {id:INLAY,name:'Demo floor inlay',role:'room'},
  {id:id('fixture:whiteboard'),name:'Whiteboard',role:'room',onWall:true},
  {id:id('placement:93:0:Wainscot cap rail'),name:'Wainscot cap rail',role:'room',onWall:true},
  {id:id('room:30:atelier-lamp-arc'),name:'Arc lamp',propId:'atelier-lamp-arc',category:'lighting',role:'room'},
  {id:id('desktop:2:mug'),name:'Mug',propId:'mug',role:'desktop'},
  {id:'scene:highschool:custom:17-0:campus-lockers',name:'Lockers',propId:'campus-lockers',custom:true},
  {id:id('person:mia:people-mia-sit-type'),name:'Mia',person:true},
  {id:id('station:research-desk'),name:'Research desk'}];

// ---- switch, kinds, header
{
  assert.equal(UI_SWITCH_KEY,'ergoflex.layers.ui');assert.equal(LAYERS_KEY,'ergoflex.sceneLayers.v1');
  assert.deepEqual([layersSwitch('',null),layersSwitch('?layers=0',null),layersSwitch('?x=1&layers=off',null),layersSwitch('',' 0 '),layersSwitch('?layers=1','0'),layersSwitch('','1'),layersSwitch(undefined,undefined)],[true,false,false,false,true,true,true]);
  assert.deepEqual(items().map(kindOf),['furniture','furniture','furniture','fixture','fixture','wall','wall','light','desk-item','added','furniture','furniture']);
  assert.deepEqual(items().map(listable),[true,true,true,true,true,true,true,true,true,true,false,false],'people and desks are phase 4');
  assert.deepEqual(['furniture','desk-item','wall','fixture','light','added'].map(entryKind),['prop','prop','wall','fixture','light','added']);
  assert.equal(settingLine('First bell','morning','60x30'),'First bell · 60 in');assert.equal(settingLine('','afternoon','48x30'),'Afternoon · 48 in');assert.equal(settingLine('','*','60x30'),'60 in');
  assert.deepEqual(scopeChoices('morning','60x30','First bell').map(c=>[c.scope,c.label]),[['cell','This time & size (First bell · 60 in)'],['time','This time, both sizes (First bell)'],['size','Every time, this size (60 in)'],['all','Everywhere']]);
  assert.deepEqual(scopeChoices('*','48x30').map(c=>c.scope),['size','all'],'a room without dayparts');
  assert.equal(defaultScope('morning'),'cell');assert.equal(defaultScope('*'),'size');
  assert.deepEqual(['cell','time','size','all'].map(s=>cellFor(s,'morning','60x30')),['morning/60x30','morning/*','*/60x30','*/*']);
  assert.equal(cellFor('cell','*','60x30'),'*/60x30');
  ok('switch (?layers=0, stored 0, ?layers=1 wins), kinds, setting line, scope choices');
}
// ---- rows: tonight's high school, after migration (five old deletes) and one desk-size hide
const legacy=ids=>Object.fromEntries(ids.map(i=>[entryKey(HS,i),{kind:i.includes(':fixture:')?'fixture':'prop',legacy:'removed',cells:{'*/*':true}}]));
{
  const layers={...legacy([CHAIR,RUG,OFFICE,BK,INLAY]),[entryKey(HS,id('room:30:atelier-lamp-arc'))]:{kind:'light',cells:{'*/60x30':true}},[entryKey(HS,id('room:7:water-bottle'))]:{kind:'prop',label:'Water bottle',cells:{'evening/*':true}}};
  const {rows}=buildRows({room:HS,items:items(),layers,phase:'morning',size:'60x30'}),by=Object.fromEntries(rows.map(r=>[r.name,r]));
  assert.equal(rows.length,11,'ten live items and one missing; no people or desks');
  for(const name of ['Small bookshelf','Designer chair','Office chair','Mobile workspace floor rug','Demo floor inlay'])assert.ok(by[name].hidden&&by[name].legacy==='removed'&&by[name].chip==='everywhere · old delete',name);
  assert.match(by['Small bookshelf'].secondary,/films still leave it out/);
  assert.equal(by['Arc lamp'].chip,'all times');assert.ok(by['Arc lamp'].hidden);
  assert.ok(!by['Whiteboard'].hidden&&by['Whiteboard'].chip===''&&by['Whiteboard'].group==='wall');
  assert.ok(by['Water bottle'].missing&&by['Water bottle'].group==='missing'&&!by['Water bottle'].hidden&&by['Water bottle'].chip==='hidden elsewhere');
  assert.ok(by['Lockers'].custom&&!by['Mug'].custom&&by['Mug'].group==='desk-item');
  const groups=groupRows(rows);
  assert.deepEqual(groups.map(g=>[g.id,g.count,g.hidden]),[['furniture',3,3],['wall',2,0],['fixture',2,2],['light',1,1],['desk-item',1,0],['added',1,0],['missing',1,0]]);
  assert.equal(hiddenCount(rows),6);assert.equal(badgeText(6),'6 hidden');assert.equal(badgeText(0),'');
  assert.deepEqual(filterRows(rows,{filter:'hidden'}).map(r=>r.name).sort(),['Arc lamp','Demo floor inlay','Designer chair','Mobile workspace floor rug','Office chair','Small bookshelf']);
  assert.deepEqual(filterRows(rows,{filter:'hidden',anywhere:true}).length,7,'with "anywhere": the bottle hidden in the evening too');
  assert.deepEqual(filterRows(rows,{query:'chair'}).map(r=>r.name).sort(),['Designer chair','Office chair']);
  assert.deepEqual(filterRows(rows,{query:'wall pieces'}).map(r=>r.name).sort(),['Wainscot cap rail','Whiteboard'],'search by group');
  // the same room at 48 in: the lamp is back
  assert.ok(!buildRows({room:HS,items:items(),layers,phase:'morning',size:'48x30'}).rows.find(r=>r.name==='Arc lamp').hidden);
  assert.equal(visibilityOf({room:HS,items:items(),layers,phase:'morning',size:'60x30'}).get(BK),true);
  assert.deepEqual(buildRows({room:null,items:items(),layers,phase:'morning',size:'60x30'}).rows.filter(r=>r.hidden),[],'no room: nothing hidden');
  ok('rows: the five old deletes are greyed "everywhere · old delete" rows; groups, counts, filters, search, missing');
}
{
  // chips
  const c=cells=>chipOf({kind:'prop',cells},'morning','60x30');
  assert.deepEqual([c({'morning/60x30':true}),c({'morning/*':true}),c({'*/60x30':true}),c({'*/*':true}),c({'afternoon/60x30':true}),c({'morning/60x30':true,'evening/48x30':true})],['','both sizes','all times','everywhere','hidden elsewhere','here and elsewhere']);
  assert.equal(chipOf({kind:'prop',legacy:'removed',cells:{'*/*':false}},'morning','60x30'),'shown · old delete');assert.equal(chipOf(null,'morning','60x30'),'');
  assert.equal(hiddenAtLine({kind:'prop',cells:{'*/60x30':true,'afternoon/60x30':false}},{morning:'First bell',evening:'After-school study'}),'Hidden at: First bell 60 in, After-school study 60 in, night 60 in, party 60 in');
  assert.equal(hiddenAtLine({kind:'prop',cells:{'*/*':true}}),'Hidden everywhere.');assert.equal(hiddenAtLine(null),'Shown at every time and size.');
  ok('chips and the "Hidden at" line');
}
{
  // index-keyed: the room's list moved the bookshelf to index 25 -> its row is found by the fingerprint, and an edit moves the entry
  const moved=items().map(d=>d.id===BK?{...d,id:id('room:25:ergoflex-small-bookshelf')}:d);
  const layers={[entryKey(HS,BK)]:{kind:'prop',propId:'ergoflex-small-bookshelf',at:[-4210,2380],legacy:'removed',cells:{'*/*':true}}};
  const {rows,aliases}=buildRows({room:HS,items:moved,layers,phase:'morning',size:'60x30'});
  const row=rows.find(r=>r.id===id('room:25:ergoflex-small-bookshelf'));
  assert.ok(row.hidden&&row.entryId===BK&&/found again/.test(row.secondary));assert.equal(aliases.get(BK),id('room:25:ergoflex-small-bookshelf'));
  assert.ok(!rows.some(r=>r.missing));
  const change=changeFor(layers,HS,[row.id],'*/*',false,{entryIds:new Map([[row.id,BK]])});
  const after=applySide(layers,change.after);
  assert.equal(after[entryKey(HS,BK)],undefined,'old key dropped');assert.deepEqual(after[entryKey(HS,row.id)].cells,{'*/*':false},'kept as a shown legacy entry under the live id');
  assert.deepEqual(applySide(after,change.before),cleanLayers(layers),'undo puts the old key back');
  // nothing near the fingerprint: a Missing row, never another prop
  const far=items().map(d=>d.id===BK?{...d,id:id('room:25:ergoflex-small-bookshelf'),at:[3000,-2000]}:d);
  assert.ok(buildRows({room:HS,items:far,layers,phase:'morning',size:'60x30'}).rows.find(r=>r.id===BK)?.missing);
  ok('index-keyed ids: fingerprint alias, the edit moves the entry, Missing when it cannot be found');
}
// ---- changes and undo
{
  let layers={...legacy([BK])};
  const meta=i=>({kind:'prop',label:'Designer chair',propId:'ergoflex-designer-chair',at:[-2580,-2700]});
  const hide=changeFor(layers,HS,[CHAIR],'morning/60x30',true,{meta,t:5});
  assert.deepEqual(hide,{type:'layers',room:HS,before:{[entryKey(HS,CHAIR)]:null},after:{[entryKey(HS,CHAIR)]:{kind:'prop',label:'Designer chair',propId:'ergoflex-designer-chair',at:[-2580,-2700],cells:{'morning/60x30':true},by:'Studio',t:5}}});
  const l1=applySide(layers,hide.after);assert.ok(hiddenAt(l1[entryKey(HS,CHAIR)],'morning','60x30'));
  assert.deepEqual(applySide(l1,invertChange(hide).after),cleanLayers(layers),'undo');
  assert.equal(changeFor(l1,HS,[CHAIR],'morning/60x30',true),null,'no change, no undo step');
  assert.equal(changeFor(l1,'Bad Room',[CHAIR],'*/*',true),null);
  // show the old-deleted bookshelf: one step, kept as a shown legacy entry
  const show=changeFor(l1,HS,[BK],'*/*',false);assert.deepEqual(applySide(l1,show.after)[entryKey(HS,BK)].cells,{'*/*':false});
  // show all hidden here: one step for all of them
  const rows=buildRows({room:HS,items:items(),layers:{...legacy([CHAIR,RUG,OFFICE,BK,INLAY])},phase:'morning',size:'60x30'}).rows;
  const all=showAllChange({...legacy([CHAIR,RUG,OFFICE,BK,INLAY])},HS,rows,'morning/60x30');
  assert.equal(all.count,5);assert.equal(Object.keys(all.change.after).length,5);
  assert.deepEqual(applySide(legacy([CHAIR,RUG,OFFICE,BK,INLAY]),all.change.after)[entryKey(HS,RUG)].cells,{'*/*':true,'morning/60x30':false},'shown here only');
  assert.equal(SHOW_ALL_CONFIRM,10);assert.match(showAllConfirmText(12),/Show all 12 hidden items/);
  ok('changes: one undo step each, inverse restores exactly, show all is one step');
}
{
  const plan=deletePlan([{id:BK},{id:'scene:highschool:custom:17-0:campus-lockers',custom:true},{id:id('copy:abc')},{id:id('person:mia:people-mia-sit-type'),person:true},{id:RUG}]);
  assert.deepEqual(plan.hide,[BK,RUG]);assert.deepEqual(plan.remove.map(e=>e.id),['scene:highschool:custom:17-0:campus-lockers',id('copy:abc'),id('person:mia:people-mia-sit-type')]);
  assert.equal(DELETE_TOAST,'Hidden everywhere. Layers -> eye brings it back. Ctrl+Z undoes.');
  assert.equal(deleteToast(1,0),DELETE_TOAST);assert.equal(deleteToast(2,1),'2 items hidden everywhere. Layers -> eye brings them back. Ctrl+Z undoes. 1 added item deleted.');
  ok('Delete: stock items -> hide everywhere, added items and people -> the old delete; the toast');
}
// ---- the panel's scene side, with a stub context (no DOM)
{
  const obj=(name,extra={})=>({name,visible:true,userData:{...extra}});
  const objs=Object.fromEntries(items().map(d=>[d.id,obj(d.name,d.person?{person:{}}:{})]));
  const storage=new Map(),undo=[],toasts=[],pick=[];let phase='morning',size='60x30',after=0;
  const ctx={roomKey:()=>HS,phase:()=>phase,size:()=>size,phaseLabels:()=>({morning:'First bell'}),items:()=>items().map(d=>({...d,obj:objs[d.id]})),
    assetState:()=>({removed:new Set([CHAIR,RUG,OFFICE,BK,INLAY])}),readRaw:k=>storage.get(k)??null,writeRaw:(k,v)=>storage.set(k,v),
    transaction:e=>undo.push(e),notify:t=>toasts.push(t),setPickable:(o,on)=>pick.push([o.name,on]),afterVisibility:()=>after++};
  const L=createStudioLayers(ctx);
  assert.equal(L.keeps(objs[BK]),true);assert.equal(L.keeps(objs[id('person:mia:people-mia-sit-type')]),false,'people keep the old removal (phase 4)');
  L.hydrated();
  for(const i of [CHAIR,RUG,OFFICE,BK,INLAY])assert.equal(objs[i].visible,false,'old delete hidden: '+i);
  assert.equal(objs[id('fixture:whiteboard')].visible,true);assert.equal(storage.size,0,'opening a room writes nothing');assert.ok(after>=1);
  assert.ok(pick.some(([name,on])=>name==='Small bookshelf'&&on===false),'not pickable');
  // room life sets visible back each frame: the hide holds, and the raw value is remembered
  objs[BK].visible=true;assert.equal(objs[BK].visible,false);assert.ok(isLayersHidden(objs[BK])&&objs[BK].userData.layersHidden);
  // Delete on the whiteboard (stock) and the lockers (added): the whiteboard is hidden everywhere, the lockers go on to the old delete
  const wb={editorId:id('fixture:whiteboard'),obj:objs[id('fixture:whiteboard')]},lk={editorId:'scene:highschool:custom:17-0:campus-lockers',isCustom:true,obj:objs['scene:highschool:custom:17-0:campus-lockers']};
  const rest=L.hideForDelete([wb,lk]);
  assert.deepEqual(rest,[lk]);assert.equal(objs[id('fixture:whiteboard')].visible,false);assert.equal(undo.length,1);assert.equal(undo[0].type,'layers');
  assert.match(toasts.at(-1),/hidden everywhere/i);
  let stored=JSON.parse(storage.get(LAYERS_KEY));
  assert.deepEqual(stored[entryKey(HS,id('fixture:whiteboard'))].cells,{'*/*':true});
  assert.equal(Object.keys(stored).length,6,'the write carries the migrated old deletes too');
  assert.equal(L.hideForDelete([lk]),null,'only added items: the old delete path');
  // undo, redo
  L.applyUndo(undo[0]);assert.equal(objs[id('fixture:whiteboard')].visible,true,'undo shows it');
  L.applyUndo(invertChange(undo[0]));assert.equal(objs[id('fixture:whiteboard')].visible,false,'redo hides it');
  // show the old-deleted bookshelf (row eye = everywhere chip here): it comes back with the value room life last set
  L.applyUndo({type:'layers',room:HS,before:{[entryKey(HS,BK)]:{kind:'prop',legacy:'removed',cells:{'*/*':false}}},after:{}});
  assert.equal(objs[BK].visible,true);assert.equal(objs[BK].userData.layersHidden,undefined);
  stored=JSON.parse(storage.get(LAYERS_KEY));assert.deepEqual(stored[entryKey(HS,BK)].cells,{'*/*':false});
  // the next room load: the bookshelf stays shown (its entry wins over the old list)
  L.hydrated();assert.equal(objs[BK].visible,true);
  // a time-and-size hide follows the setting
  storage.set(LAYERS_KEY,JSON.stringify({...stored,[entryKey(HS,id('room:30:atelier-lamp-arc'))]:{kind:'light',cells:{'morning/60x30':true}}}));
  L.hydrated();assert.equal(objs[id('room:30:atelier-lamp-arc')].visible,false);
  size='48x30';L.apply();assert.equal(objs[id('room:30:atelier-lamp-arc')].visible,true,'48 in: back');
  phase='afternoon';size='60x30';L.apply();assert.equal(objs[id('room:30:atelier-lamp-arc')].visible,true,'Wave lab: back');
  phase='morning';L.apply();assert.equal(objs[id('room:30:atelier-lamp-arc')].visible,false);
  // a broken context never throws into the Studio
  const broken=createStudioLayers({items:()=>{throw Error('x');},roomKey:()=>{throw Error('y');}});
  assert.doesNotThrow(()=>{broken.hydrated();broken.apply();assert.equal(broken.hideForDelete([wb]),null);broken.applyUndo(undo[0]);});
  ok('panel scene side: old deletes hidden on load, sticky hide, Delete -> hide, undo / redo, shown again stays shown, time and size');
}
{
  // setLayersHidden keeps an accessor someone else installed (film-edits style) and restores it
  let raw=true;const o={userData:{}};Object.defineProperty(o,'visible',{configurable:true,get:()=>raw,set:v=>{raw=v;}});
  setLayersHidden(o,true);assert.equal(o.visible,false);o.visible=false;assert.equal(raw,false,'the setter still reaches the old accessor');
  setLayersHidden(o,false);raw=true;assert.equal(o.visible,true,'the old accessor is back');
  assert.equal(setLayersHidden(null,true),false);
  ok('setLayersHidden: sticky, and restores whatever was there');
}
assert.deepEqual(GROUPS.map(g=>g.id),['furniture','wall','fixture','light','desk-item','added','missing']);
console.log(`Studio layers panel: ${n} checks pass.`);
