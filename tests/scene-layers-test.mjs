// Show / hide ("Layers") phase 1 (scene-layers.mjs): cells and their resolution, entries and cleaning, the migration of
// the old delete lists (rev 3464 and the high school as saved on the desk on Nov 13 2026), index-keyed ids, the Studio ->
// Director diff and chapter edits, Director -> Studio writes, people at hidden desks, and the server merge of the key.
// No browser.      node tests/scene-layers-test.mjs
import assert from 'node:assert/strict';
import {LAYERS_KEY,PHASES,SIZES,cellOf,scopeCell,covers,hiddenAt,hiddenAnywhere,hiddenCells,cleanEntry,cleanLayers,setCell,withEntry,roomEntries,
  entryKey,splitKey,deskRoomKey,assetRoomKey,kindOfId,propIdOf,labelOfId,migrateRoom,resolveAlias,diffLayers,chapterCell,toChapterEdits,
  fromChapterEdits,writeSceneLayers,hiddenPeople} from '../scene-layers.mjs';
import {mergeWrite,changedEntries,SPECS} from '../tools/studio-state/merge.mjs';
import {encodeStoredJSON,decodeStoredJSON} from '../browser-design-storage.mjs';
import {cleanSceneDeskData} from '../scene-desk-data.mjs';
import {cleanPropEdit} from '../experience/prop-edits.mjs';
import {cleanDeskEdit} from '../experience/desk-edits.mjs';

let n=0;const ok=name=>{n++;console.log('ok',name);};
const HS='highschool:house',id=s=>`scene:${HS}:${s}`;

// ---- cells
{
  assert.equal(cellOf('morning','60x30'),'morning/60x30');assert.equal(cellOf(null,undefined),'*/*');assert.equal(cellOf('*','48x30'),'*/48x30');
  assert.throws(()=>cellOf('noon','60x30'));assert.throws(()=>cellOf('morning','72x30'));
  assert.deepEqual(['cell','time','size','all'].map(s=>scopeCell(s,'afternoon','48x30')),['afternoon/48x30','afternoon/*','*/48x30','*/*']);
  assert.throws(()=>scopeCell('chapter','morning','60x30'));
  assert.ok(covers('*/*','morning/60x30')&&covers('morning/*','morning/60x30')&&covers('*/60x30','morning/60x30')&&covers('morning/60x30','morning/60x30'));
  assert.ok(!covers('morning/60x30','morning/*')&&!covers('afternoon/*','morning/60x30')&&!covers('*/48x30','morning/60x30'));
  ok('cells: names, scopes, covering');
}
{
  const e={kind:'prop',cells:{'*/*':true,'morning/*':false,'morning/60x30':true,'*/48x30':false}};
  // most specific first: phase/size, phase/*, */size, */*
  assert.equal(hiddenAt(e,'morning','60x30'),true,'exact cell');
  assert.equal(hiddenAt(e,'morning','48x30'),false,'phase/* beats */size');
  assert.equal(hiddenAt(e,'afternoon','48x30'),false,'*/size');
  assert.equal(hiddenAt(e,'afternoon','60x30'),true,'*/*');
  assert.equal(hiddenAt(null,'morning','60x30'),false);assert.equal(hiddenAt({kind:'prop',cells:{}},'morning','60x30'),false);
  assert.equal(hiddenAt({kind:'prop',cells:{'*/60x30':true}},'*','60x30'),true,'a room without dayparts (phase *)');
  assert.deepEqual(hiddenCells({kind:'prop',cells:{'evening/*':true}}),['evening/48x30','evening/60x30']);
  assert.ok(hiddenAnywhere({kind:'prop',cells:{'party/48x30':true}})&&!hiddenAnywhere({kind:'prop',legacy:'removed',cells:{'*/*':false}}));
  ok('hiddenAt: the most specific cell decides');
}

// ---- entries
{
  const at=(e,p,s)=>hiddenAt(e,p,s);
  // the eye's default: this time & size
  let e=setCell(null,'morning/60x30',true,{id:'desk:station-research-desk',label:'Research desk'});
  assert.deepEqual(e,{kind:'desk',label:'Research desk',cells:{'morning/60x30':true}});
  assert.ok(at(e,'morning','60x30')&&!at(e,'morning','48x30')&&!at(e,'afternoon','60x30'));
  // widen to every time: the narrower cell is folded in
  e=setCell(e,'*/60x30',true);assert.deepEqual(e.cells,{'*/60x30':true});
  // show in one cell inside the wider hide: an exception
  e=setCell(e,'afternoon/60x30',false);assert.deepEqual(e.cells,{'*/60x30':true,'afternoon/60x30':false});
  assert.ok(!at(e,'afternoon','60x30')&&at(e,'evening','60x30'));
  // show everywhere: no entry
  assert.equal(setCell(e,'*/*',false),null);
  // showing where it was never hidden changes nothing (no entry)
  assert.equal(setCell(null,'morning/60x30',false,{id:id('room:1:ergoflex-office-chair')}),null);
  // un-hide the only hidden cell: gone
  assert.equal(setCell({kind:'prop',cells:{'morning/60x30':true}},'morning/60x30',false),null);
  ok('setCell: hide here, widen, exception, show everywhere');
}
{
  // pruning keeps the meaning: */60x30 hidden with a morning/* exception (morning/60x30 shown by phase/* priority)
  const e=cleanEntry({kind:'prop',cells:{'*/60x30':true,'morning/*':false}});
  assert.deepEqual(e.cells,{'*/60x30':true,'morning/*':false},'a false cell is kept when it changes an answer');
  assert.equal(hiddenAt(e,'morning','60x30'),false);
  assert.deepEqual(cleanEntry({kind:'prop',cells:{'*/*':true,'morning/*':true,'party/48x30':true}}).cells,{'*/*':true},'redundant cells go');
  assert.equal(cleanEntry({kind:'prop',cells:{'*/*':false}}),null,'hidden nowhere: no entry');
  assert.deepEqual(cleanEntry({kind:'prop',legacy:'removed',cells:{}}),{kind:'prop',legacy:'removed',cells:{'*/*':false}},'a legacy entry shown again is kept');
  assert.equal(cleanEntry({kind:'sofa',cells:{'*/*':true}}),null);
  assert.deepEqual(cleanEntry({kind:'prop',label:'  Small bookshelf ',propId:'ergoflex-small-bookshelf',at:[-4213.7,2381.2],cells:{'*/*':true,'noon/60x30':true,'morning/60x30':'yes'},by:'Studio',t:1763090000000.4,junk:1}),
    {kind:'prop',label:'Small bookshelf',propId:'ergoflex-small-bookshelf',at:[-4210,2380],cells:{'*/*':true},by:'Studio',t:1763090000000});
  const layers=cleanLayers(JSON.stringify({[`${HS}|${id('room:24:ergoflex-small-bookshelf')}`]:{kind:'prop',cells:{'*/*':true}},'bad room|desk:main':{kind:'desk',cells:{'*/*':true}},
    [`${HS}|chair`]:{kind:'prop',cells:{'*/*':true}},[`${HS}|desk:main`]:{kind:'desk',cells:{'*/*':true}},office:{kind:'prop'}}));
  assert.deepEqual(Object.keys(layers),[`${HS}|${id('room:24:ergoflex-small-bookshelf')}`,`${HS}|desk:main`]);
  assert.deepEqual(cleanLayers('not json'),{});assert.deepEqual(cleanLayers(null),{});assert.deepEqual(cleanLayers('[1]'),{});
  ok('cleanEntry / cleanLayers: pruning keeps the meaning, bad keys and cells go');
}
{
  assert.deepEqual(splitKey(entryKey(HS,id('room:1:x'))),{room:HS,id:id('room:1:x')});assert.equal(splitKey('nokey'),null);
  assert.equal(deskRoomKey(HS),'highschool/house');assert.equal(assetRoomKey('highschool/house'),HS);
  assert.deepEqual([id('room:24:ergoflex-small-bookshelf'),id('fixture:desk-zone-rug'),'desk:main',id('station:research-desk'),'person:mia',id('person:mia:people-mia-sit-type'),'scene:highschool:custom:17-0:lamp','scene:highschool:copy:abc'].map(kindOfId),
    ['prop','fixture','desk','desk','person','person','added','added']);
  assert.equal(propIdOf(id('room:24:ergoflex-small-bookshelf')),'ergoflex-small-bookshelf');assert.equal(propIdOf(id('fixture:desk-zone-rug')),null);
  assert.deepEqual([id('room:24:ergoflex-small-bookshelf'),id('fixture:demo-floor-inlay'),'desk:station-window-research','person:mia'].map(labelOfId),['Small bookshelf','Demo floor inlay','Window research','Mia']);
  const l=withEntry({},HS,'desk:main',{kind:'desk',cells:{'*/*':true}});assert.deepEqual([...roomEntries(l,HS).keys()],['desk:main']);assert.deepEqual(withEntry(l,HS,'desk:main',null),{});
  ok('keys, kinds, prop ids and labels from ids');
}

// ---- migration
const T=(x,z)=>({p:{x,y:0,z},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}});
const desk=(o={})=>({pose:{x:0,z:0,yaw:0},height:30,tilt:0,lights:{},size:'60x30',phases:{},objects:{},artwork:{v:1,surfaces:{}},name:'ErgoFlex desk',added:false,...o});
const deg=d=>d*Math.PI/180,obj=(i)=>({role:'desktop',added:false,removed:false,label:'Teacher item '+i,transform:T(i*100,0)});
{
  // rev 3464 on Vico's server (read Nov 13 2026): the high school has the bookshelf removed; library house the whiteboard.
  const assets={[HS]:{removed:[id('room:24:ergoflex-small-bookshelf')],added:[],transforms:{[id('room:13:ergoflex-designer-chair')]:T(-2580,-2700)}},
    'library:house':{removed:['scene:library:house:fixture:collaboration-whiteboard'],added:[],transforms:{}}};
  const raw=JSON.stringify(assets);
  let layers={};const added=[];
  for(const room of Object.keys(assets)){const r=migrateRoom({room,assets:assets[room],desks:{desks:{},deleted:[]},layers,t:1});layers=r.layers;added.push(...r.added);}
  assert.equal(JSON.stringify(assets),raw,'the old value is not touched');
  assert.deepEqual(added,[`${HS}|${id('room:24:ergoflex-small-bookshelf')}`,'library:house|scene:library:house:fixture:collaboration-whiteboard']);
  assert.deepEqual(layers[added[0]],{kind:'prop',label:'Small bookshelf',propId:'ergoflex-small-bookshelf',legacy:'removed',cells:{'*/*':true},by:'migration',t:1});
  assert.equal(layers[added[1]].kind,'fixture');
  ok('migration, rev 3464: the bookshelf and the library whiteboard become hidden rows');
}
{
  // The high school as saved on the desk's Studio on Nov 13 2026 (Vico's marked-up top view): five removals; the
  // window-research station was deleted and later restored (deleted = []); main (Kai) at (-3350,-1950) yaw -25°, 28 in;
  // the accessible student (Fern) at (-4300,1750); the teacher's desk at (2700,-2100) yaw 135°, flat at 43.5 in, eight objects.
  const removed=[id('room:13:ergoflex-designer-chair'),id('fixture:desk-zone-rug'),id('room:1:ergoflex-office-chair'),id('room:24:ergoflex-small-bookshelf'),id('fixture:demo-floor-inlay')];
  const assets={removed:[...removed],added:[],transforms:{[id('room:1:ergoflex-office-chair')]:T(-4200,900)}};
  const deskData=cleanSceneDeskData({version:1,rooms:{'highschool/house':{selected:'main',deleted:[],desks:{
    main:desk({name:'Main desk',pose:{x:-3350,z:-1950,yaw:deg(-25)},height:28}),
    'station-accessible-student':desk({name:'Accessible student desk',size:'48x30',pose:{x:-4300,z:1750,yaw:0}}),
    'station-demonstration-desk':desk({name:'Wave and energy demonstration desk',pose:{x:2700,z:-2100,yaw:deg(135)},height:43.5,tilt:0,objects:Object.fromEntries([1,2,3,4,5,6,7,8].map(i=>['teacher-'+i,obj(i)]))}),
    'station-window-research':desk({name:'Window research desk',size:'48x30'})}}}});
  const desksRaw=encodeStoredJSON(deskData),assetsRaw=JSON.stringify(assets);
  const placements=new Map([[id('room:24:ergoflex-small-bookshelf'),{label:'Small bookshelf',propId:'ergoflex-small-bookshelf',at:[-4213,2381]}],[id('fixture:demo-floor-inlay'),{label:'Demo floor inlay',kind:'fixture'}]]);
  const room=decodeStoredJSON(desksRaw).rooms['highschool/house'];
  const r=migrateRoom({room:HS,assets,desks:room,layers:{},placements,t:2});
  assert.equal(JSON.stringify(assets),assetsRaw,'sceneAssets byte-identical');
  assert.equal(encodeStoredJSON(decodeStoredJSON(desksRaw)),desksRaw);assert.deepEqual(room,deskData.rooms['highschool/house'],'desk records identical');
  assert.equal(r.added.length,5,'five rows');
  for(const x of removed){const e=r.layers[entryKey(HS,x)];assert.ok(e&&e.legacy==='removed'&&hiddenAt(e,'morning','60x30')&&hiddenAt(e,'party','48x30'),x+' hidden everywhere');}
  assert.deepEqual(Object.values(r.layers).map(e=>[e.kind,e.label]),[['prop','Designer chair'],['fixture','Desk zone rug'],['prop','Office chair'],['prop','Small bookshelf'],['fixture','Demo floor inlay']]);
  assert.deepEqual(r.layers[entryKey(HS,id('room:24:ergoflex-small-bookshelf'))].at,[-4210,2380],'fingerprint from the built room');
  assert.ok(!Object.keys(r.layers).some(k=>k.includes('desk:')),'no desk rows: window-research was restored');
  // idempotent; switching one back on in the Studio is kept on the next migration (an entry wins over the old list)
  assert.deepEqual(migrateRoom({room:HS,assets,desks:room,layers:r.layers,placements,t:3}),{layers:r.layers,added:[]});
  const bk=entryKey(HS,id('room:24:ergoflex-small-bookshelf')),shown=withEntry(r.layers,HS,id('room:24:ergoflex-small-bookshelf'),setCell(r.layers[bk],'*/*',false));
  assert.deepEqual(shown[bk].cells,{'*/*':false});assert.equal(hiddenAt(shown[bk],'morning','60x30'),false);
  const again=migrateRoom({room:HS,assets,desks:room,layers:shown,t:4});
  assert.deepEqual(again.added,[]);assert.equal(hiddenAt(again.layers[bk],'morning','60x30'),false,'the bookshelf stays shown; the old list is unchanged');
  assert.equal(JSON.stringify(assets),assetsRaw);
  // an old tab removing one more thing later: picked up on the next load
  const later=migrateRoom({room:HS,assets:{...assets,removed:[...removed,id('room:7:water-bottle')]},desks:room,layers:again.layers,t:5});
  assert.deepEqual(later.added,[entryKey(HS,id('room:7:water-bottle'))]);
  // a deleted station becomes a hidden desk row
  const del=migrateRoom({room:HS,assets:null,desks:{...room,deleted:['station-window-research']},layers:{}});
  assert.deepEqual(del.layers[entryKey(HS,'desk:station-window-research')],{kind:'desk',label:'Window research',legacy:'deleted',cells:{'*/*':true},by:'migration'});
  assert.throws(()=>migrateRoom({room:'High School'}));
  ok('migration, the desk\'s high school (Nov 13): five removals become hidden rows, switchable, records byte-identical, idempotent');
}

// ---- index-keyed ids
{
  const bk=id('room:24:ergoflex-small-bookshelf'),entry={kind:'prop',propId:'ergoflex-small-bookshelf',at:[-4210,2380],cells:{'*/*':true}};
  const built=[{id:id('room:23:ergoflex-plant-2'),propId:'ergoflex-plant-2',at:[0,0]},{id:bk,propId:'ergoflex-small-bookshelf',at:[-4213,2381]}];
  assert.deepEqual(resolveAlias(bk,entry,built),{id:bk,alias:false},'same id, same prop, same place');
  // a placement inserted earlier in the room's list: the bookshelf is index 25 now, and index 24 is something else
  const moved=[{id:id('room:24:ergoflex-plant-2'),propId:'ergoflex-plant-2',at:[0,0]},{id:id('room:25:ergoflex-small-bookshelf'),propId:'ergoflex-small-bookshelf',at:[-4213,2381]},{id:id('room:31:ergoflex-small-bookshelf'),propId:'ergoflex-small-bookshelf',at:[3000,-2000]}];
  assert.deepEqual(resolveAlias(bk,entry,moved),{id:id('room:25:ergoflex-small-bookshelf'),alias:true},'nearest bookshelf at the fingerprint');
  assert.equal(resolveAlias(bk,entry,[{id:id('room:31:ergoflex-small-bookshelf'),propId:'ergoflex-small-bookshelf',at:[3000,-2000]}]),null,'too far: missing, not guessed');
  assert.equal(resolveAlias(bk,entry,[]),null,'the room no longer has it');
  // without a fingerprint: only an unambiguous propId match
  assert.deepEqual(resolveAlias(bk,{kind:'prop',cells:{'*/*':true}},moved.slice(0,2)),{id:id('room:25:ergoflex-small-bookshelf'),alias:true});
  assert.equal(resolveAlias(bk,{kind:'prop',cells:{'*/*':true}},moved),null,'two bookshelves, no fingerprint: missing');
  // stable ids resolve only to themselves
  assert.deepEqual(resolveAlias(id('fixture:desk-zone-rug'),{kind:'fixture'},[{id:id('fixture:desk-zone-rug')}]),{id:id('fixture:desk-zone-rug'),alias:false});
  assert.equal(resolveAlias(id('fixture:desk-zone-rug'),{kind:'fixture'},[]),null);
  ok('resolveAlias: index-keyed props follow their fingerprint; never a guess');
}

// ---- Studio -> Director
{
  const before={[entryKey(HS,'desk:station-research-desk')]:{kind:'desk',label:'Research desk',cells:{'afternoon/60x30':true}},[entryKey(HS,id('room:1:ergoflex-office-chair'))]:{kind:'prop',label:'Office chair',cells:{'*/*':true}},
    [entryKey('library:house','desk:main')]:{kind:'desk',cells:{'*/*':true}}};
  const after={[entryKey(HS,'desk:station-research-desk')]:{kind:'desk',label:'Research desk',cells:{'*/60x30':true}},[entryKey(HS,'person:mia')]:{kind:'person',label:'Mia',cells:{'morning/*':true}},
    [entryKey(HS,id('fixture:demo-floor-inlay'))]:{kind:'fixture',label:'Demo floor inlay',cells:{'evening/*':true}}};
  const oilers={id:'oilers',room:'highschool',layout:'house',mode:'morning',size:'60x30'};
  assert.equal(chapterCell(oilers),'morning/60x30');assert.equal(chapterCell({}),'*/*');
  const rows=diffLayers(JSON.stringify(before),after,HS,oilers.mode,oilers.size);
  assert.deepEqual(rows,[{id:'desk:station-research-desk',kind:'desk',label:'Research desk',change:'hidden'},{id:'person:mia',kind:'person',label:'Mia',change:'hidden'},
    {id:id('room:1:ergoflex-office-chair'),kind:'prop',label:'Office chair',change:'shown'}],'only what changed at the chapter\'s time and size, in this room');
  assert.deepEqual(diffLayers(after,after,HS,'morning','60x30'),[]);assert.deepEqual(diffLayers('x',null,HS,'morning','60x30'),[]);
  const names=new Map([[id('room:1:ergoflex-office-chair'),'Prop:ergoflex-office-chair']]);
  const edits=toChapterEdits([...rows,{id:'desk:main',kind:'desk',change:'hidden'},{id:id('fixture:desk-zone-rug'),kind:'fixture',change:'hidden'}],{names,featured:'main'});
  assert.deepEqual(edits.map(e=>[e.id,e.ok]),[['desk:station-research-desk',true],['person:mia',true],[id('room:1:ergoflex-office-chair'),true],['desk:main',false],[id('fixture:desk-zone-rug'),false]]);
  assert.deepEqual(edits[0].desk,{desk:'station-research-desk',hide:true});assert.deepEqual(edits[1].person,{key:'mia',hide:true});
  assert.deepEqual(edits[2].prop,{match:'^Prop:ergoflex-office-chair$',asset:'highschool:house:room:1:ergoflex-office-chair',label:'Prop:ergoflex-office-chair',hide:false});
  assert.deepEqual(cleanPropEdit(edits[2].prop),edits[2].prop,'a valid film prop edit (prop-edits.mjs)');
  assert.ok(/subject/.test(edits[3].why)&&/stage/.test(edits[4].why));
  // (pin updated deliberately in phase 3, set B: a chapter desk edit now keeps `hide: true`, and only `true`)
  assert.deepEqual(cleanDeskEdit(edits[0].desk),{desk:'station-research-desk',hide:true});
  assert.equal(cleanDeskEdit({desk:'station-research-desk',hide:false}),null,'hide:false is not kept: no edit');
  ok('diffLayers and toChapterEdits: Studio hides at a chapter\'s cell, as film edits');
}

// ---- Director -> Studio
{
  const shot={mode:'afternoon',size:'60x30',propEdits:[{match:'^Prop:ergoflex-small-bookshelf$',asset:'highschool:house:room:24:ergoflex-small-bookshelf',label:'Prop:ergoflex-small-bookshelf',hide:true},
    {match:'^Task chair$',asset:'highschool:house:fixture:mobile-desk-chair',position:[0,0,-.745]},{match:'^Student work table$',near:[6.789,3.131,.3],hide:true},
    {add:{asset:'campus-lockers-compact-hbhs'},id:'oilm1',match:'^Added prop:campus-lockers-compact-hbhs#oilm1$'},{match:'^Prop:water-bottle$',asset:'highschool:house:room:7:water-bottle',hide:false}],
    deskEdits:[{desk:'station-research-desk',hide:true,name:'Research desk'},{desk:'station-project-review',pose:{x:0,z:0,yaw:0}}],
    peopleEdits:{cast:[{key:'mia',id:'people-mia-sit-type',desk:'sit',station:'window-research',hide:true},{key:'zoe',id:'people-zoe-stand-type',desk:'stand'}]}};
  const rows=fromChapterEdits(shot);
  assert.deepEqual(rows.map(r=>[r.id,r.hidden]),[[id('room:24:ergoflex-small-bookshelf'),true],[id('room:7:water-bottle'),false],['desk:station-research-desk',true],['person:mia',true]],
    'Studio items only: no film-only (near) hides, no added props, no moves');
  const before=JSON.stringify({[entryKey(HS,id('room:7:water-bottle'))]:{kind:'prop',cells:{'*/*':true}},[entryKey('library:house','desk:main')]:{kind:'desk',cells:{'*/*':true}}});
  const out=JSON.parse(writeSceneLayers(before,HS,rows,chapterCell(shot),{t:9}));
  assert.deepEqual(out[entryKey(HS,id('room:24:ergoflex-small-bookshelf'))],{kind:'prop',label:'Prop:ergoflex-small-bookshelf',propId:'ergoflex-small-bookshelf',cells:{'afternoon/60x30':true},by:'Director',t:9},'the chapter\'s cell only');
  assert.deepEqual(out[entryKey(HS,id('room:7:water-bottle'))].cells,{'*/*':true,'afternoon/60x30':false},'a chapter show is an exception in the Studio');
  assert.deepEqual(out[entryKey(HS,'desk:station-research-desk')].cells,{'afternoon/60x30':true});assert.equal(out[entryKey(HS,'person:mia')].model,'people-mia-sit-type');
  assert.ok(out[entryKey('library:house','desk:main')],'other rooms untouched');
  const wide=JSON.parse(writeSceneLayers(before,HS,rows.slice(0,1),'*/*'));assert.deepEqual(wide[entryKey(HS,id('room:24:ergoflex-small-bookshelf'))].cells,{'*/*':true},'Vico chose everywhere');
  assert.throws(()=>writeSceneLayers(before,'High school',rows,'*/*'));
  ok('fromChapterEdits / writeSceneLayers: chapter hides become Studio hides at the chapter\'s cell, never `removed`');
}

// ---- people at hidden desks
{
  const layers={[entryKey(HS,'desk:station-window-research')]:{kind:'desk',cells:{'morning/60x30':true}},[entryKey(HS,'person:zoe')]:{kind:'person',cells:{'*/*':true}},[entryKey(HS,'desk:main')]:{kind:'desk',cells:{'party/*':true}}};
  const cast=[{key:'mia',station:'window-research',desk:'sit'},{key:'zoe',station:'student-standing',desk:'stand'},{key:'kai',desk:'wheel'},{key:'hale',at:[1750,-3200]}];
  assert.deepEqual([...hiddenPeople(layers,HS,cast,'morning','60x30')].sort(),['mia','zoe'],'Mia with her desk, Zoe on her own');
  assert.deepEqual([...hiddenPeople(layers,HS,cast,'morning','48x30')],['zoe'],'other size: Mia is back');
  assert.deepEqual([...hiddenPeople(layers,HS,cast,'party','60x30')].sort(),['kai','zoe'],'the featured desk\'s user follows desk:main');
  ok('hiddenPeople: a desk\'s user goes and comes back with it');
}

// ---- the server's merge of the key: one entry per item
{
  assert.deepEqual(SPECS[LAYERS_KEY],{codec:'plain',containers:[[]]});
  const k1=entryKey(HS,id('room:24:ergoflex-small-bookshelf')),k2=entryKey(HS,id('fixture:desk-zone-rug')),k3=entryKey(HS,'desk:station-research-desk');
  const base=JSON.stringify({[k1]:{kind:'prop',cells:{'*/*':true}}});
  const studio=JSON.stringify({[k1]:{kind:'prop',cells:{'*/*':true}},[k2]:{kind:'fixture',cells:{'morning/60x30':true}}});            // the Studio hides the rug
  const director=JSON.stringify({[k3]:{kind:'desk',cells:{'afternoon/60x30':true}}});                                                   // the Director shows the bookshelf, hides a desk
  const stored=mergeWrite(LAYERS_KEY,base,studio,base).value;
  const m=mergeWrite(LAYERS_KEY,stored,director,base),out=JSON.parse(m.value);
  assert.ok(m.merged);assert.deepEqual(Object.keys(out).sort(),[k2,k3].sort(),'both writers kept, the same room, different items');
  assert.deepEqual(m.changed,['|'+k3]);assert.deepEqual(m.removed,['|'+k1]);
  // the same item from both: the later writer wins for that item only
  const a=JSON.stringify({[k1]:{kind:'prop',cells:{'morning/*':true}},[k2]:{kind:'fixture',cells:{'*/*':true}}}),b=JSON.stringify({[k1]:{kind:'prop',cells:{'*/60x30':true}}});
  const both=JSON.parse(mergeWrite(LAYERS_KEY,a,b,JSON.stringify({[k1]:{kind:'prop',cells:{'*/*':true}}})).value);
  assert.deepEqual(both,{[k1]:{kind:'prop',cells:{'*/60x30':true}},[k2]:{kind:'fixture',cells:{'*/*':true}}});
  assert.deepEqual(changedEntries(LAYERS_KEY,base,studio),{changed:['|'+k2],removed:[]});
  ok('merge.mjs: ergoflex.sceneLayers.v1 merges per item');
}
assert.deepEqual(PHASES,['morning','afternoon','evening','night','party']);assert.deepEqual(SIZES,['48x30','60x30']);
console.log(`Scene layers: ${n} checks pass.`);
