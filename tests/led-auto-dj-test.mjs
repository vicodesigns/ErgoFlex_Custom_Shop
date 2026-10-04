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
