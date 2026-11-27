// finish-fades.mjs: cleaning, the fades in force, the white look (must equal the hero ending's by-hand look), retiming.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanFade,cleanFinishFadesField,effectiveFades,whiteLook,newFade,retime,filmFades,edited,MIN_FADE} from '../experience/finish-fades.mjs';
const cut='exports/cinematic-intro-cut-vicos-3rd-cut/shots/13-subshots.json';
const subs=JSON.parse(fs.readFileSync(new URL('../'+cut,import.meta.url),'utf8').replace(/^﻿/,'')).shots;
const H=subs.find(s=>s.subshot==='H'),D=subs.find(s=>s.subshot==='D');
// the film's own hero ending: whiteLook(H) makes the very same look
assert.deepEqual(whiteLook(H),H.finishFade.set,'whiteLook(H) is the hero ending look');
// a desk without the product rig only gets finish, LED and exposure
const bare=whiteLook({sceneGlobals:{exposure:.5},lights:[{preset:'spot'}]});
assert.equal(bare.lights,undefined);assert.deepEqual(bare.deskFinish,{wood:'Pearl White',base:'White',trim:'#f5f5f2'});assert.equal(bare.sceneGlobals.exposure,.3);
// cleaning
assert.equal(cleanFade({at:[5,4],set:{deskFinish:{}}}),null);
assert.equal(cleanFade({at:[1,2],set:{nonsense:1}}),null);
assert.deepEqual(cleanFade({at:[1.234,2.5],set:{ledColor:'#fff',extra:1}}),{at:[1.23,2.5],set:{ledColor:'#fff'}});
assert.deepEqual(cleanFinishFadesField({}),{});assert.deepEqual(cleanFinishFadesField({finishFades:{}}),{finishFades:{}});
assert.deepEqual(cleanFinishFadesField({finishFades:{H:{at:[1,2],set:{ledGlow:.1}},'bad key':{at:[1,2],set:{ledGlow:.1}},G:{at:[3,1],set:{ledGlow:.1}}}}),{finishFades:{H:{at:[1,2],set:{ledGlow:.1}}}});
// the fades in force
const versions=subs.map(s=>({n:s.subshot,setup:s}));
assert.deepEqual(Object.keys(effectiveFades({},versions)),['H']);
assert.deepEqual(effectiveFades({finishFades:{}},versions),{},'an empty list takes the film fade away');
assert.equal(edited({}),false);assert.equal(edited({finishFades:{}}),true);
assert.deepEqual(Object.keys(filmFades(versions)),['H']);
// a new fade on the Office desk
const nf=newFade(D,13,1);assert.deepEqual(nf.at,[13,14]);assert.equal(nf.set.deskFinish.wood,'Pearl White');assert.equal(nf.set.sceneGlobals.exposure,.51);
// retime keeps MIN_FADE and the chapter
assert.deepEqual(retime([19.2,20.45],'start',25,25.95),[20.35,20.45]);
assert.deepEqual(retime([19.2,20.45],'end',19,25.95),[19.2,19.3]);
assert.deepEqual(retime([19.2,20.45],'end',99,25.95),[19.2,25.95]);
assert.deepEqual(retime([19.2,20.45],'both',25,25.95),[24.7,25.95]);
assert.deepEqual(retime([19.2,20.45],'both',-3,25.95),[0,1.25]);
assert.ok(MIN_FADE>0);
console.log('finish-fades-test ok');
// review fixes: rounding can not make an empty fade; a shortened chapter trims or drops fades
import {cleanFinishFadesField as cff} from '../experience/finish-fades.mjs';
assert.equal(cleanFade({at:[0.001,0.004],set:{ledGlow:.1}}),null);
const L={ledGlow:.1};
assert.deepEqual(cff({finishFades:{H:{at:[19.2,20.45],set:L}}},15),{finishFades:{}},'starts past the end: dropped');
assert.deepEqual(cff({finishFades:{H:{at:[13,20.45],set:L}}},15),{finishFades:{H:{at:[13,15],set:L}}},'runs past the end: ends with the chapter');
assert.deepEqual(cff({finishFades:{H:{at:[14.95,20],set:L}}},15),{finishFades:{}},'less than a fade left: dropped');
assert.deepEqual(cff({finishFades:{H:{at:[19.2,20.45],set:L}}},25.95),{finishFades:{H:{at:[19.2,20.45],set:L}}});
console.log('finish-fades review fixes ok');
