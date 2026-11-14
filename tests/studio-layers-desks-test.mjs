// Layers, phase 4 (desks and people), without a browser: the rows (a desk with its user nested), which desks are hidden,
// who is out (a desk's user goes with it; the featured desk's user follows desk:main), the panel's scene side with a
// stub, and room-people.mjs (studioOut in allowed(); a station that is gone has nobody, with no layout fallback).
//   node tests/studio-layers-desks-test.mjs
import assert from 'node:assert/strict';
import {buildRows,groupRows,hiddenCount,deskVisibility,personOut,personLayerKey,personName,personDesk,eyeLocked,peopleOutSignature,LAYERS_KEY} from '../studio-layers-model.mjs';
import {createStudioLayers} from '../studio-layers-panel.mjs';
import {entryKey} from '../scene-layers.mjs';
import {RoomPeople} from '../room-people.mjs';

let n=0;const ok=name=>{n++;console.log('ok',name);};
const HS='highschool:house',R='desk:station-research-desk',W='desk:station-window-research',M='desk:main';
const specs={noah:{id:'people-noah-sit-type',station:'research-desk',desk:'sit'},noah30:{id:'people-noah-sit-type-30',station:'research-desk',desk:'sit',variant:'people-noah-sit-type'},
  mia:{id:'people-mia-sit-type',station:'window-research',desk:'sit'},kai:{id:'people-kai-wheel-type',desk:'wheel'},hale:{id:'people-hale-stand-present',at:[1750,-3200]},sam:{key:'sam-water',id:'people-sam-stand-phone'}};
{
  assert.deepEqual(Object.values(specs).map(personLayerKey),['noah-sit-type','noah-sit-type','mia-sit-type','kai-wheel-type','hale-stand-present','sam-water'],'a posture variant is the same person');
  assert.equal(personLayerKey({id:'people-Odd Name!!'}),'odd-name-');assert.equal(personLayerKey({}),null);
  assert.deepEqual(['noah-sit-type','kai','',null].map(personName),['Noah (sit type)','Kai','Person','Person']);
  assert.deepEqual(Object.values(specs).map(personDesk),[R,R,W,M,null,null]);
  ok('people keys, names and the desk each one follows');
}
const desks=[{id:M,name:'Main desk',featured:true},{id:R,name:'Research desk'},{id:W,name:'Window research desk'},{id:'desk:station-demonstration-desk',name:'Wave and energy demonstration desk'}];
const people=[{id:'person:noah-sit-type',name:'Noah (sit type)',desk:R},{id:'person:mia-sit-type',name:'Mia (sit type)',desk:W},{id:'person:kai-wheel-type',name:'Kai (wheel type)',desk:M},{id:'person:hale-stand-present',name:'Hale (stand present)',desk:null}];
{
  // Vico's case: the two back desks hidden for First bell at 60 in
  const layers={[entryKey(HS,R)]:{kind:'desk',cells:{'morning/60x30':true}},[entryKey(HS,W)]:{kind:'desk',cells:{'morning/60x30':true}},[entryKey(HS,'person:hale-stand-present')]:{kind:'person',cells:{'*/*':true}}};
  const {rows}=buildRows({room:HS,items:[],layers,phase:'morning',size:'60x30',desks,people}),by=Object.fromEntries(rows.map(r=>[r.id,r]));
  assert.ok(by[R].hidden&&by[W].hidden&&!by[M].hidden&&by[M].featured);
  assert.match(by[R].secondary,/Noah \(sit type\) works here/);assert.match(by[M].secondary,/the featured desk · Kai/);
  assert.ok(by['person:noah-sit-type'].hidden&&by['person:noah-sit-type'].byDesk&&!by['person:noah-sit-type'].own&&eyeLocked(by['person:noah-sit-type']));
  assert.match(by['person:noah-sit-type'].secondary,/at Research desk · hidden with its desk/);
  assert.ok(by['person:hale-stand-present'].hidden&&by['person:hale-stand-present'].own&&!eyeLocked(by['person:hale-stand-present']));
  assert.ok(!by['person:kai-wheel-type'].hidden);
  const g=groupRows(rows),dg=g.find(x=>x.id==='desk'),pg=g.find(x=>x.id==='person');
  assert.equal(dg.rows[0].id,M,'the featured desk first');assert.deepEqual(dg.rows.find(r=>r.id===R).nested.map(r=>r.id),['person:noah-sit-type'],'the user is nested under the desk');
  assert.deepEqual(pg.rows.map(r=>r.id),['person:hale-stand-present'],'People lists only who is not at a desk');
  assert.equal(hiddenCount(rows),5,'two desks, their two users, and Hale');
  // Wave lab: all back but Hale (hidden everywhere)
  assert.deepEqual(buildRows({room:HS,items:[],layers,phase:'afternoon',size:'60x30',desks,people}).rows.filter(r=>r.hidden).map(r=>r.id),['person:hale-stand-present']);
  // 48 in: back too
  assert.equal(buildRows({room:HS,items:[],layers,phase:'morning',size:'48x30',desks,people}).rows.filter(r=>r.hidden&&r.kind==='desk').length,0);
  assert.deepEqual([...deskVisibility({room:HS,desks,layers,phase:'morning',size:'60x30'})],[[M,false],[R,true],[W,true],['desk:station-demonstration-desk',false]]);
  const out=personOut({room:HS,layers,phase:'morning',size:'60x30'});
  assert.deepEqual(Object.values(specs).map(out),[true,true,true,false,true,false],'Noah (both postures) and Mia with their desks, Hale on his own');
  const kaiOut=personOut({room:HS,layers:{[entryKey(HS,M)]:{kind:'desk',cells:{'*/*':true}}},phase:'morning',size:'60x30'});
  assert.equal(kaiOut(specs.kai),true,'Kai goes with the featured desk');assert.equal(kaiOut(specs.noah),false);
  assert.equal(peopleOutSignature(Object.values(specs),out),'111010');
  ok('rows: desks with nested users, locked eyes for users hidden with their desk, time and size, who is out');
}
{
  // the panel with a stub: one eye on the research desk -> applyDesks / applyPeople get the right answers; undo
  const storage=new Map(),undo=[],deskCalls=[],peopleCalls=[];let phase='morning';
  const L=createStudioLayers({roomKey:()=>HS,phase:()=>phase,size:()=>'60x30',items:()=>[],desks:()=>desks,people:()=>people,assetState:()=>({removed:new Set()}),
    readRaw:k=>storage.get(k)??null,writeRaw:(k,v)=>storage.set(k,v),transaction:e=>undo.push(e),notify:()=>{},
    applyDesks:vis=>{deskCalls.push(new Map(vis));return true;},applyPeople:out=>{peopleCalls.push(out);return true;},afterVisibility:()=>{}});
  L.hydrated();assert.equal(deskCalls.at(-1).get(R),false);assert.equal(storage.size,0,'opening writes nothing');
  assert.equal(L.test.hide(R,'cell'),true);
  assert.equal(deskCalls.at(-1).get(R),true,'the desk is hidden');assert.equal(peopleCalls.at(-1)(specs.noah),true,'Noah goes with it');assert.equal(peopleCalls.at(-1)(specs.mia),false);
  assert.deepEqual(JSON.parse(storage.get(LAYERS_KEY))[entryKey(HS,R)],{kind:'desk',label:'Research desk',cells:{'morning/60x30':true},by:'Studio',t:JSON.parse(storage.get(LAYERS_KEY))[entryKey(HS,R)].t});
  assert.equal(undo.length,1);
  phase='afternoon';L.apply();assert.equal(deskCalls.at(-1).get(R),false,'Wave lab: back');assert.equal(peopleCalls.at(-1)(specs.noah),false);
  phase='morning';L.apply();assert.equal(deskCalls.at(-1).get(R),true);
  L.applyUndo(undo[0]);assert.equal(deskCalls.at(-1).get(R),false,'undo shows it');
  const rows=L.test.rows();assert.ok(rows.some(r=>r.id==='person:noah-sit-type'&&r.nestedIn===R));
  // a broken desks hook never stops the props
  const B=createStudioLayers({roomKey:()=>HS,phase:()=>'morning',size:()=>'60x30',items:()=>[],desks:()=>{throw Error('x');},people:()=>{throw Error('y');},applyDesks:()=>{throw Error('z');},readRaw:()=>null,writeRaw:()=>{}});
  assert.doesNotThrow(()=>{B.hydrated();B.apply();assert.deepEqual(B.test.rows(),[]);});
  ok('panel stub: one eye hides the desk and its user, follows time, undo');
}
{
  // room-people.mjs: studioOut (the Studio only) and a station that is gone
  const room={id:'highschool',roomLayout:{stations:[{id:'research-desk',at:[1000,2000],turn:0,height:28}]},assets:()=>[]};
  const P=new RoomPeople(room,{entry:()=>null});
  assert.equal(P.allowed(specs.noah),true);
  P.studioOut=s=>s.station==='research-desk';assert.equal(P.allowed(specs.noah),false);assert.equal(P.allowed(specs.mia),true);
  P.studioOut=()=>{throw Error('broken');};assert.equal(P.allowed(specs.noah),true,'a broken hook hides nobody');
  P.studioOut=()=>true;P.filter={except:[]};assert.equal(P.allowed(specs.noah),true,'a film filter: studioOut is not asked');
  P.filter=null;P.studioOut=null;
  const obj={position:{set(){return this;},addScaledVector(){return this;}},rotation:{y:0},userData:{}};
  const gone={station:()=>({gone:true})},live={station:()=>({height:30,pose:{x:5,z:6,yaw:0}})};
  assert.equal(P.stationNow(specs.noah,gone),null,'gone: nobody there, no layout fallback');
  assert.equal(P.atStation(obj,specs.noah,gone),null);assert.notEqual(obj.userData.personMissing,true,'gone is not missing: the user comes back with the desk');
  assert.deepEqual(P.stationNow(specs.noah,live).pose,{x:5,z:6,yaw:0});
  assert.equal(P.stationNow(specs.noah,{station:()=>null}).height,28,'no live desk at all: the layout\'s station as before');
  ok('room-people: studioOut only without a film filter; a gone station has nobody and its user is not marked missing');
}
{
  // A daypart change re-applies desk hides at once (seen on the desk: one daypart behind while the panel's 500 ms check
  // waited for the new hour's people to load). studio.js setMeasuredRoomMode calls studioLayers.apply() after the mode
  // is set; the panel's apply() reads the time then, for desks and people alike.
  const fs=await import('node:fs'),src=fs.readFileSync(new URL('../studio.js',import.meta.url),'utf8');
  const body=src.slice(src.indexOf('function setMeasuredRoomMode('),src.indexOf('function setRoomScene('));
  const setAt=body.indexOf('institutionalState[sceneId].mode = id'),applyAt=body.indexOf('studioLayers?.apply();');
  assert.ok(setAt>0&&applyAt>setAt,'setMeasuredRoomMode re-applies Layers after the mode is set');
  let phase='morning';const deskCalls=[],peopleCalls=[];
  const layers={[entryKey(HS,R)]:{kind:'desk',cells:{'morning/60x30':true}}};
  const L=createStudioLayers({roomKey:()=>HS,phase:()=>phase,size:()=>'60x30',items:()=>[],desks:()=>desks,people:()=>people,assetState:()=>({removed:new Set()}),
    readRaw:()=>JSON.stringify(layers),writeRaw:()=>{},applyDesks:v=>{deskCalls.push(v);return false;},applyPeople:o=>{peopleCalls.push(o);return false;}});
  L.hydrated();assert.equal(deskCalls.at(-1).get(R),true);
  for(const [p,want] of [['afternoon',false],['morning',true],['afternoon',false],['evening',false],['morning',true]]){
    phase=p;L.apply();
    assert.equal(deskCalls.at(-1).get(R),want,`desk at ${p}`);assert.equal(peopleCalls.at(-1)(specs.noah),want,`Noah at ${p}`);
  }
  ok('a daypart change: the very next apply uses the new time for the desk and its user (never one behind)');
}
console.log(`Layers desks and people: ${n} checks pass.`);
