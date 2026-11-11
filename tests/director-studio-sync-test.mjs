// Studio <-> Director sync, the parts that are plain data (experience/studio-sync.mjs): what Studio changed between
// two states, the rows the Adopt dialog offers, the chapter desk edit that shows Studio's desk, the desk record
// "Make permanent in Studio" writes, and that write going through the server's merge without touching other rooms.
// Run: node tests/director-studio-sync-test.mjs
import assert from 'node:assert/strict';
import {diffSceneAssets,diffSceneDesks,adoptRows,deskEditFromStudio,writeSceneDesks,DESKS_KEY,STUDIO_KEYS} from '../experience/studio-sync.mjs';
import {decodeStoredJSON,encodeStoredJSON} from '../browser-design-storage.mjs';
import {cleanSceneDeskData} from '../scene-desk-data.mjs';
import {mergeWrite} from '../tools/studio-state/merge.mjs';
import {propKey} from '../experience/prop-edits.mjs';

const T=(x,y=0,z=0)=>({p:{x,y,z},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}});
// ---- props
const before=JSON.stringify({'office:house':{removed:['scene:office:plant'],added:[{editorId:'scene:office:custom:1:lamp',propId:'lamp',position:[0,0,0]}],transforms:{'scene:office:chair':T(1),'scene:office:rug':T(2)}},home:{transforms:{'scene:home:sofa':T(5)}}});
const after=JSON.stringify({'office:house':{removed:['scene:office:bin'],added:[{editorId:'scene:office:custom:2:vase',propId:'vase',position:[0,0,0]}],transforms:{'scene:office:chair':T(1.5),'scene:office:rug':T(2),'scene:office:custom:2:vase':T(3)}},home:{transforms:{'scene:home:sofa':T(9)}}});
const assets=diffSceneAssets(before,after,['office:house','office']);
const by=Object.fromEntries(assets.map(c=>[c.editorId,c.change]));
assert.deepEqual(by,{'scene:office:chair':'moved','scene:office:bin':'removed','scene:office:plant':'restored','scene:office:custom:2:vase':'added','scene:office:custom:1:lamp':'taken out'},'only this room, each prop once, with what Studio did');
assert.deepEqual(diffSceneAssets(before,before,['office:house']),[],'no change, no rows');
assert.deepEqual(diffSceneAssets(null,'not json',['office:house']),[],'unreadable values are no change');

// ---- desks
const desk=(o={})=>({pose:{x:0,z:0,yaw:0},height:30,tilt:0,lights:{},size:'60x30',phases:{},objects:{},artwork:{v:1,surfaces:{}},name:'Station A',added:false,...o});
const state=rooms=>encodeStoredJSON({version:1,v:1,rooms});
const d0=state({'office/house':{desks:{main:desk({name:'Main desk'}),'station-a':desk(),'station-b':desk({name:'Station B'})},deleted:[],selected:'main'},'home/house':{desks:{main:desk()},deleted:[],selected:'main'}});
const d1=state({'office/house':{desks:{main:desk({name:'Main desk',height:40}),'station-a':desk({pose:{x:500,z:-200,yaw:1},size:'48x30'}),'station-b':desk({name:'Station B'})},deleted:['station-c'],selected:'main'},'home/house':{desks:{main:desk({height:45})},deleted:[],selected:'main'}});
const desks=diffSceneDesks(d0,d1,'office/house');
assert.deepEqual(desks.map(c=>[c.desk,c.what.join('+')]),[['main','start'],['station-a','size+place'],['station-c','removed']],'what changed on each desk of this room');
assert.deepEqual(desks[1].studio,{name:'Station A',size:'48x30',pose:{x:500,z:-200,yaw:1},height:30,tilt:0});
assert.deepEqual(diffSceneDesks(d0,d0,'office/house'),[]);
// Studio saves a room for the first time: only desks that differ from the room's own are changes.
const first=diffSceneDesks(null,d1,'office/house',{'station-a':{size:'60x30',pose:{x:0,z:0,yaw:0},height:30,tilt:0},'station-b':{size:'60x30',pose:{x:0,z:0,yaw:0},height:30,tilt:0}});
assert.deepEqual(first.filter(c=>c.desk!=='main').map(c=>[c.desk,c.what.join('+')]),[['station-a','size+place'],['station-c','removed']],'a first save lists only the desks Studio really changed');

// ---- the Adopt rows
const chair={match:'^Prop:chair$',asset:'office:chair',label:'Prop:steelcase-leap-v2',position:[.2,0,0]},rug={match:'^Rug$',position:[0,0,1]};
const rows=adoptRows({assetChanges:assets,deskChanges:desks,propEdits:[chair,rug],deskEdits:[{desk:'station-a',name:'Station A',pose:{x:1,z:2,yaw:0},clips:[{id:'c'}]}],featured:'main'});
assert.deepEqual(rows.map(r=>[r.kind,r.id,r.conflict]),[['prop',propKey(chair),true],['desk','station-a',true]],'a prop row only where the chapter edits what Studio changed; the featured desk is never offered; a removed desk without a chapter edit is not a row');
assert.match(rows[0].studio,/Studio moved it/);assert.match(rows[0].chapter,/moved 0\.2 m/);
assert.match(rows[1].take,/moves and build stay/);
const offer=adoptRows({deskChanges:desks,featured:'main'});
assert.deepEqual(offer.map(r=>[r.id,r.conflict]),[['station-a',false]],'a Studio desk change the chapter does not edit is offered, not a conflict');
const taken=deskEditFromStudio('station-a',desks[1].studio,{desk:'station-a',pose:{x:1,z:2,yaw:0},clips:[{id:'c',start:0}]});
assert.deepEqual({size:taken.size,pose:taken.pose,initial:taken.initial,clips:taken.clips.length},{size:'48x30',pose:{x:500,z:-200,yaw:1},initial:{height:30,tilt:0},clips:1},"taking Studio's desk sets size, place and start and keeps the chapter's moves");

// ---- Make permanent, desks
const stage=desk({pose:{x:900,z:100,yaw:.5},height:41,tilt:10,style:{woodFinish:'Walnut',baseFinish:'Black',sheen:'satin'},accessories:['desk-mat'],accessoryFinishes:{},objects:{'accessory-desk-mat':{role:'desktop',added:false,removed:false,label:'Mat',transform:T(10)},'mug':{role:'desktop',added:true,removed:false,label:'Mug',propId:'mug',transform:T(1)}}});
const edit={desk:'station-a',pose:{x:900,z:100,yaw:.5},initial:{height:41,tilt:10},build:{woodFinish:'Walnut',baseFinish:'Black',accessories:[{id:'desk-mat',slot:'desktop'}]}};
const withObjects=state({'office/house':{desks:{'station-a':desk({objects:{'book':{role:'shelf',added:true,removed:false,label:'Book',propId:'book',transform:T(4)},'accessory-task-light':{role:'desktop',added:false,removed:false,label:'Light',transform:T(7)}},accessories:['task-light']})},deleted:['station-a'],selected:'main'},'home/house':{desks:{main:desk()},deleted:[],selected:'main'}});
const written=decodeStoredJSON(writeSceneDesks(withObjects,'office/house',[{desk:'station-a',edit,state:stage}]));
const a=written.rooms['office/house'].desks['station-a'];
assert.deepEqual([a.pose,a.height,a.tilt,a.style.woodFinish,a.accessories],[{x:900,z:100,yaw:.5},41,10,'Walnut',['desk-mat']],"the edit's place, start and build are written");
assert.deepEqual(Object.keys(a.objects).sort(),['accessory-desk-mat','book'],"Studio's own desk objects stay; only the build's accessories are replaced");
assert.deepEqual(written.rooms['office/house'].deleted,[],'a desk written back is no longer deleted in Studio');
assert.deepEqual(written.rooms['home/house'],decodeStoredJSON(withObjects).rooms['home/house'],'other rooms are untouched');
assert.equal(written.v,1,'the value keeps the version Studio reads');
assert.ok(cleanSceneDeskData(written).rooms['office/house'].desks['station-a'],"Studio's own reader accepts the record");
// A pose-only edit leaves start and build as Studio has them.
const poseOnly=decodeStoredJSON(writeSceneDesks(d0,'office/house',[{desk:'station-b',edit:{desk:'station-b',pose:{x:7,z:8,yaw:0}},state:desk({name:'Station B',pose:{x:7,z:8,yaw:0},height:50})}])).rooms['office/house'].desks['station-b'];
assert.deepEqual([poseOnly.pose,poseOnly.height],[{x:7,z:8,yaw:0},30],'only what the edit sets is written');
// A size switch takes the stage's record and keeps Studio's setup of the old size.
const resized=decodeStoredJSON(writeSceneDesks(d0,'office/house',[{desk:'station-a',edit:{desk:'station-a',size:'48x30'},state:desk({size:'48x30',sizeSetups:{'60x30':desk()}})}])).rooms['office/house'].desks['station-a'];
assert.deepEqual([resized.size,resized.sizeSetups['60x30'].size,resized.name],['48x30','60x30','Station A']);
// A desk Studio never saved, in a room Studio never saved.
const fresh=decodeStoredJSON(writeSceneDesks(null,'gym/house',[{desk:'station-a',edit:{desk:'station-a',pose:{x:1,z:1,yaw:0}},state:desk({pose:{x:1,z:1,yaw:0}})}]));
assert.deepEqual(Object.keys(fresh.rooms['gym/house'].desks),['station-a']);
assert.throws(()=>writeSceneDesks(d0,'product',[]),/not a Studio room layout/);
// Through the server's merge: another tab saved the home room meanwhile; the Director's write keeps it.
const theirs=state({...decodeStoredJSON(d0).rooms,'home/house':{desks:{main:desk({height:47})},deleted:[],selected:'main'}});
const mine=writeSceneDesks(d0,'office/house',[{desk:'station-b',edit:{desk:'station-b',pose:{x:7,z:8,yaw:0}},state:desk({name:'Station B',pose:{x:7,z:8,yaw:0}})}]);
const merged=decodeStoredJSON(mergeWrite(DESKS_KEY,theirs,mine,d0).value);
assert.deepEqual([merged.rooms['home/house'].desks.main.height,merged.rooms['office/house'].desks['station-b'].pose.x],[47,7],"the other tab's room survives the Director's write (write base)");
assert.deepEqual(STUDIO_KEYS,['ergoflex.sceneAssets.v1','ergoflex.sceneDesksBySizeV2']);
console.log('Studio sync data: diffs, adopt rows, desk write and merge pass.');
