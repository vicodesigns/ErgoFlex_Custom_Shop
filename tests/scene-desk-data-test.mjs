import assert from 'node:assert/strict';
import {cleanSceneDeskData,cleanDeskRecording,sampleDeskRecording,cleanDeskObjects} from '../scene-desk-data.mjs';
const setting={pose:{x:400,z:1200,yaw:.3},height:40,tilt:0,lights:{color:'#286344',enabled:true}};
const frames=[{t:0,x:0,z:0,yaw:0,height:36,tilt:0},{t:2,x:400,z:800,yaw:Math.PI*2,height:44,tilt:20}];
const source={version:1,rooms:{'hospital/house':{selected:'station-review',deleted:['main'],desks:{'station-review':{...setting,name:'Review desk',size:'48x30',phases:{night:{...setting,recording:frames}}}}}}};
const clean=cleanSceneDeskData(source);assert.equal(clean.rooms['hospital/house'].selected,'station-review');
assert.deepEqual(clean.rooms['hospital/house'].desks['station-review'].phases.night.recording,frames);
source.rooms['hospital/house'].desks['station-review'].lights.color='#ffffff';assert.equal(clean.rooms['hospital/house'].desks['station-review'].lights.color,'#286344');
assert.deepEqual(sampleDeskRecording(frames,1),{pose:{x:200,z:400,yaw:Math.PI},height:40,tilt:10});
assert.equal(sampleDeskRecording(frames,9).pose.yaw,Math.PI*2);
assert.deepEqual(cleanDeskRecording([{...frames[0],t:1},frames[1]]),[]);
assert.deepEqual(cleanDeskRecording([frames[0],{...frames[1],height:Infinity}]),[]);
assert.deepEqual(cleanDeskRecording([frames[0],{...frames[1],t:0}]),[]);
const broken=structuredClone(clean);broken.rooms['hospital/house'].desks['station-review'].pose.x=NaN;
assert.deepEqual(cleanSceneDeskData(broken).rooms['hospital/house'].desks,{});
assert.deepEqual(cleanSceneDeskData({rooms:{'hospital/house':null}}).rooms['hospital/house'],{desks:{},deleted:[],selected:null});
console.log('Desk identities, per-setting poses, independent light settings, recording interpolation, full turns and invalid-file bounds passed.');

const transform={p:{x:15,y:0,z:30},q:{x:0,y:0,z:0,w:1},s:{x:1000,y:1000,z:1000}};
const objects=cleanDeskObjects({'object-apple':{role:'lower-shelf',added:true,propId:'apple',label:'Apple',transform},'default-desktop-0':{role:'desktop',removed:true,transform},'bad':{role:'wall',transform}});
assert.equal(objects['object-apple'].propId,'apple');assert.equal(objects['default-desktop-0'].removed,true);assert.equal(objects.bad,undefined);
transform.p.x=999;assert.equal(objects['object-apple'].transform.p.x,15);
assert.deepEqual(cleanDeskObjects({bad:{role:'desktop',transform:{...transform,s:{x:0,y:1,z:1}}}}),{});
assert.deepEqual(cleanDeskObjects({bad:{role:'desktop',transform:{...transform,q:{x:0,y:0,z:0,w:0}}}}),{});
console.log('Desk prop attachments, additions, removed defaults, independent transforms and invalid inputs passed.');

const pair = cleanDeskObjects({
 'accessory-wide-monitor':{role:'shelf',transform:{p:{x:-300,y:210,z:80},q:{x:0,y:0,z:0,w:1},s:{x:1000,y:1000,z:1000}}},
 'accessory-portrait-monitor':{role:'shelf',transform:{p:{x:400,y:160,z:90},q:{x:0,y:0,z:0,w:1},s:{x:1000,y:1000,z:1000}}}
});
assert.equal(pair['accessory-wide-monitor'].transform.p.x,400);
assert.equal(pair['accessory-portrait-monitor'].transform.p.x,-300);
assert.equal(pair['accessory-wide-monitor'].transform.p.y,210);
pair['accessory-wide-monitor'].transform.p.x=-350.5;
assert.equal(cleanDeskObjects(pair)['accessory-wide-monitor'].transform.p.x,-350.5,'later manual edits are not swapped again');
console.log('Old monitor pairs move curved right and portrait left once, retaining all other edits.');

const {seedScenePeripherals,seedSceneSizeWithPeripherals,peripheralReference}=await import('../scene-peripheral-layouts.mjs');
const sceneSeed=seedScenePeripherals({...setting,size:'60x30',phases:{},objects:{}},'office');
sceneSeed.accessories=sceneSeed.accessories.filter(id=>id!=='logitech-mx-master');sceneSeed.accessories.push('task-light');sceneSeed.accessoryFinishes['ergo-keyboard']='white';
const narrowSeed=seedSceneSizeWithPeripherals(sceneSeed,'48x30');
assert.equal(narrowSeed.accessories.includes('logitech-mx-master'),false,'removed inputs do not return when seeding another width');
assert.equal(narrowSeed.accessories.includes('task-light'),true,'extra purchased accessories seed across widths');
assert.equal(narrowSeed.accessoryFinishes['ergo-keyboard'],'white','custom peripheral finish seeds across widths');
assert.deepEqual(narrowSeed.objects['accessory-wide-monitor'].transform,peripheralReference('office','48x30').objects['accessory-wide-monitor'].transform,'new width uses its measured Product placement');
assert.equal(sceneSeed.size,'60x30');narrowSeed.objects['accessory-wide-monitor'].transform.p.x=999;
assert.notEqual(sceneSeed.objects['accessory-wide-monitor'].transform.p.x,999,'new scene variants own their transforms');
console.log('New widths inherit purchased additions, removals and finish edits while using fitted Product reference positions.');
