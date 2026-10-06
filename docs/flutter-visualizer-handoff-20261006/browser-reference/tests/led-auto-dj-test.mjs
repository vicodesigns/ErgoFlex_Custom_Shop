import assert from 'node:assert/strict';
import { AutoDJ, normalizeDJSettings, djPool, DJ_EFFECT_IDS } from '../led-auto-dj.mjs';
const weights=Object.fromEntries(DJ_EFFECT_IDS.map(fx=>[fx,0]));
assert.equal(normalizeDJSettings({program:'bad',comfort:'bad',bars:99}).program,'party');
assert.deepEqual(djPool({program:'custom',weights}),[]);
const weighted={...weights,28:4,29:1,31:4,40:2};
assert.equal(djPool({program:'custom',weights:weighted}).filter(fx=>fx===28).length,4);
assert.equal(djPool({program:'custom',weights:weighted,comfort:'reduced'}).filter(fx=>fx===31).length,2);
assert.ok(djPool({program:'custom',weights:weighted,comfort:'minimal'}).every(fx=>fx!==31&&fx!==40));
for(const program of ['chill','party','rave']){
    const dj=new AutoDJ({program,comfort:'minimal'},()=>.5);assert.ok(dj.start());
    const seen=new Set([dj.fx]);
    for(let t=0;t<250;t+=.25){const fx=dj.tick(t,{volume:.4,energy:.4,bassBeat:t%1===0});assert.ok(fx!==31&&fx!==40);seen.add(fx);}
    assert.ok(seen.size>1,`${program} changes effects`);
}
const empty=new AutoDJ({program:'custom',weights});assert.equal(empty.start(),false);
const safeCustom=new AutoDJ({program:'custom',comfort:'minimal',weights:{...weights,28:4,40:4}});safeCustom.start();
for(let t=.25;t<=19;t+=.25)safeCustom.tick(t,{volume:.2,energy:.2});
assert.equal(safeCustom.tick(19.25,{volume:1,energy:1,bassBeat:true}),28,'Minimal reactive drops respect custom Off ratings');
const dj=new AutoDJ({program:'party'},()=>.2);dj.start(0);const first=dj.fx;
for(let t=.25;t<=30;t+=.25)dj.tick(t,{volume:.3,energy:.3});
assert.notEqual(dj.fx,first,'Fallback rotates without beats');
assert.equal(dj.switchedAt,30);
const held=dj.fx;for(let i=0;i<100;i++)dj.tick(30,{volume:.3});assert.equal(dj.fx,held,'Paused song clock cannot advance rotation');
dj.tick(3,{volume:.3});assert.equal(dj.switchedAt,3,'Seek resets cadence rather than jumping through programs');
dj.configure({program:'rave',comfort:'minimal'});dj.fx=31;dj.configure({program:'rave',comfort:'minimal'});assert.ok(dj.fx!==31&&dj.fx!==40,'Comfort change removes active flashing effect immediately');
dj.stop();assert.equal(dj.tick(20,{bassBeat:true}),null);
console.log('Auto DJ: weighted pools, all programs, comfort, fallback, pause, seek and stop pass.');

const mixDJ=new AutoDJ({program:'custom',comfort:'minimal',weights:{...weights,28:4,29:2,33:3,31:4,40:4}},()=>.4);mixDJ.start();
const composition=mixDJ.stripEffects();
assert.equal(composition.length,8);assert.ok(new Set(composition).size>1,'Several effects run together');
assert.ok(composition.every(fx=>[28,29,33].includes(fx)),'Off and minimal comfort apply to every strip');
assert.deepEqual(mixDJ.stripEffects(),composition,'Composition holds steady between phrases');
mixDJ.configure({...mixDJ.settings,mixStrips:false});assert.equal(new Set(mixDJ.stripEffects()).size,1,'Unison option works');
mixDJ.configure({...mixDJ.settings,mixStrips:true,weights:{...weights,33:4}});assert.deepEqual(mixDJ.stripEffects(),Array(8).fill(33),'One enabled effect stays valid');
mixDJ.reason='quiet';assert.equal(new Set(mixDJ.stripEffects()).size,1,'Quiet sections coordinate');
mixDJ.reason='drop';assert.equal(new Set(mixDJ.stripEffects()).size,1,'Drops coordinate');
console.log('Auto DJ: simultaneous strip mixing, stable phrases, single-effect pools, Off ratings and comfort pass.');

const {SAVED_LED_LOOKS,SAVED_LED_PALETTES}=await import('../led-saved-library.mjs');
const lookWeights=Object.fromEntries(SAVED_LED_LOOKS.map(l=>[l.name,0]));lookWeights['Master REGGAE']=4;
const recipes=new AutoDJ({program:'custom',weights,lookWeights,paletteWeights:{Bliz:4}},()=>.99);recipes.setLibrary(SAVED_LED_LOOKS,SAVED_LED_PALETTES);
assert.equal(recipes.start(),true,'Looks-only rotation can start');assert.equal(recipes.currentLook.name,'Master REGGAE');assert.equal(recipes.currentPalette.name,'Bliz');
assert.deepEqual(recipes.stripEffects(),SAVED_LED_LOOKS.find(l=>l.name==='Master REGGAE').strips.map(s=>s.fx));
recipes.configure({...recipes.settings,comfort:'minimal'});assert.equal(recipes.pool.length,0,'Minimal excludes authored looks containing Strobe');
recipes.stop();assert.equal(recipes.currentLook,null);assert.equal(recipes.currentPalette,null);
console.log('Auto DJ saved recipes/palettes: looks-only playback, saved strip assignment, Off ratings, comfort and restoration pass.');

const restricted=new AutoDJ({program:'custom',weights,lookWeights:{Daytime:4,Evening:4,'Reggae (Static)':4}},()=>.5);
restricted.setLibrary(SAVED_LED_LOOKS,SAVED_LED_PALETTES);
assert.equal(restricted.looks.length,24);
assert.ok(restricted.looks.every(look=>!['Daytime','Evening','Night City','Red','Mex','Blue Red','Reggae (Static)'].includes(look.name)));
assert.ok(restricted.pool.every(value=>!['look:Daytime','look:Evening','look:Reggae (Static)'].includes(value)),'Stale Favorite ratings cannot add non-music looks');
assert.equal(Object.hasOwn(normalizeDJSettings({bars:4}),'bars'),false,'Legacy bars setting is retired');

const aligned=new AutoDJ({program:'custom',weights:{...weights,28:4,29:4},beatAlign:true},()=>.3);aligned.start();
for(let i=1;i<=301;i++){const t=i/10;aligned.tick(t,{volume:.3,energy:.3,bassBeat:(i-2)%5===0});}
assert.equal(aligned.switchedAt,0,'At 30 seconds, steady tempo waits for the next beat');
assert.equal(aligned.pendingSwitch,true);
aligned.tick(30.2,{volume:.3,energy:.3,bassBeat:true});assert.equal(aligned.switchedAt,30.2,'Change lands on the next beat');
const immediate=new AutoDJ({...aligned.settings,beatAlign:false},()=>.3);immediate.start();
for(let i=1;i<=300;i++)immediate.tick(i/10,{volume:.3,energy:.3,bassBeat:(i-2)%5===0});
assert.equal(immediate.switchedAt,30,'Beat switch can be disabled');
const lost=new AutoDJ(aligned.settings,()=>.3);lost.start();
for(let i=1;i<=300;i++)lost.tick(i/10,{volume:.3,energy:.3,bassBeat:(i-2)%5===0});
assert.equal(lost.pendingSwitch,true);
for(let i=301;i<=315;i++)lost.tick(i/10,{volume:.3,energy:.3});
assert.ok(lost.switchedAt>=30&&lost.switchedAt<=31.5,'Lost beat cannot stall rotation');
lost.tick(2,{volume:.3,energy:.3});assert.equal(lost.pendingSwitch,false);assert.deepEqual(lost.beatTimes,[],'Seek discards tempo history');
console.log('Music-only library, retired bar settings, beat landing, immediate mode, lost tempo and seek pass.');
