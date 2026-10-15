import assert from 'node:assert/strict';
import {roomDeskActivity,planRoomDeskActivity,obstacleForDesk,wallParkingCandidates} from '../room-desk-activities.mjs';
import {poseIsClear,segmentIsClear} from '../room-groove.mjs';
import {cleanSceneDeskData} from '../scene-desk-data.mjs';

const bounds={minX:-6000,maxX:6000,minZ:-4000,maxZ:7000};
for(const size of ['48x30','60x30'])for(const kind of ['storage','pairs','triples']){
    const footprint={halfWidth:size==='48x30'?650:800,halfDepth:520,offsetX:0,offsetZ:-100,margin:30};
    const desks=Array.from({length:6},(_,i)=>({id:'desk-'+i,size,pose:{x:-2600+(i%3)*2600,z:-1700+Math.floor(i/3)*4100,yaw:0},footprint,targetFootprint:{...footprint,halfDepth:620}}));
    const obstacles=[{id:'table',minX:-500,maxX:500,minZ:500,maxZ:1400}];
    const result=planRoomDeskActivity({desks,bounds,obstacles,kind});
    assert.equal(result.moves.filter(m=>!m.transit).length,6,`${size} ${kind}: all desks find a route`);
    const current=new Map(desks.map(d=>[d.id,{...d}]));
    for(const move of result.moves){
        const d=current.get(move.id),others=[...obstacles,...[...current.values()].filter(x=>x.id!==d.id).map(x=>obstacleForDesk(x))];
        for(let n=1;n<move.route.length;n++)assert.ok(segmentIsClear(move.route[n-1],move.route[n],bounds,others,d.footprint),'complete swept route is clear');
        d.pose=move.pose;if(kind!=='storage'&&!move.transit)d.footprint=d.targetFootprint;
        assert.ok(poseIsClear(d.pose,bounds,others,d.footprint),'final worktop fits');
        if(kind==='storage')assert.ok(Math.min(move.pose.x-bounds.minX,bounds.maxX-move.pose.x,move.pose.z-bounds.minZ,bounds.maxZ-move.pose.z)<900,'storage reaches perimeter');
    }
    const homes=Object.fromEntries(desks.map(d=>[d.id,{pose:d.pose,height:28,tilt:0,lights:{enabled:false}}]));
    const returned=planRoomDeskActivity({desks:[...current.values()],bounds,obstacles,kind:'work',homes});
    assert.equal(returned.moves.length,6,'original positions remain reachable');
    returned.moves.forEach(move=>assert.deepEqual(move.pose,homes[move.id].pose));
    const poses=wallParkingCandidates(bounds,footprint);assert.ok(poses.every(p=>poseIsClear(p,bounds,[],footprint)));
}
for(const scene of ['highschool','occmedialab','library','office','home','gaming','creative','workshop'])assert.equal(roomDeskActivity(scene,'night',7).kind,'storage');
for(const scene of ['hospital','laboratory','security','police','mobileit','scifi'])assert.notEqual(roomDeskActivity(scene,'night',7).kind,'storage','active night operations stay operational');
assert.equal(roomDeskActivity('highschool','party',7).kind,'triples');
assert.equal(roomDeskActivity('office','afternoon',4).kind,'pairs');
assert.deepEqual(planRoomDeskActivity({desks:[],bounds,obstacles:[],kind:'triples'}).moves,[]);
const trapped={id:'trapped',pose:{x:0,z:0,yaw:0},footprint:{halfWidth:600,halfDepth:500,margin:20}};
assert.deepEqual(planRoomDeskActivity({desks:[trapped],bounds,obstacles:[{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000}],kind:'triples'}).moves,[],'a blocked room returns promptly without staging desks that cannot form a group');
const saved={pose:{x:200,z:300,yaw:0},height:43,tilt:22,lights:{enabled:true,color:'#abcdef'}};
const priority=planRoomDeskActivity({desks:[{id:'main',pose:{x:2000,z:2000,yaw:0},footprint:{halfWidth:600,halfDepth:500,margin:20}}],bounds,obstacles:[],kind:'storage',saved:{main:saved}});
assert.deepEqual(priority.moves[0].setting,saved);assert.deepEqual(priority.moves[0].pose,saved.pose,'owner Groove takes priority over a generated parking pose');
const homeDesk={id:'main',pose:{x:0,z:0,yaw:0},footprint:{halfWidth:600,halfDepth:500,margin:20}};
const sameBay={main:{pose:homeDesk.pose,height:28,tilt:0}},lowFixture=[{id:'original-low-fixture',minX:500,maxX:800,minZ:300,maxZ:800}];
assert.equal(planRoomDeskActivity({desks:[homeDesk],bounds,obstacles:lowFixture,kind:'work',homes:sameBay}).moves.length,0);
assert.equal(planRoomDeskActivity({desks:[homeDesk],bounds,obstacles:lowFixture,kind:'work',homes:sameBay,authoredReturns:['main']}).moves.length,1,'an unchanged authored work bay can undo its own fold despite conservative 2D fixture bounds');
const data=cleanSceneDeskData({rooms:{'office/house':{desks:{main:{...saved,size:'60x30'}},activityHome:{main:{'48x30':{...saved,pose:{x:1,z:2,yaw:0}},'60x30':saved,'bad':saved},missing:{'60x30':saved}}}}});
assert.deepEqual(data.rooms['office/house'].activityHome,{main:{'48x30':{...saved,pose:{x:1,z:2,yaw:0}},'60x30':saved}});
console.log('PASS: both widths, perimeter storage, pairs/triples, complete swept routes, exact return positions, night watch exclusions and width-specific return persistence.');
