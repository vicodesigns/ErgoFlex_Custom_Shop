import assert from 'node:assert/strict';
import { DECORATIVE_EFFECTS, MUSIC_EFFECTS, MusicSampler, sampleDecorativeInto, analyseMusic } from '../led-showcase-effects.mjs';

const counts=[14,14,15,14,14,11,11,13];
const createFrame=()=>counts.map(count=>new Uint8Array(count*4));
assert.equal(DECORATIVE_EFFECTS.length,25);assert.equal(MUSIC_EFFECTS.length,10);
assert.equal(new Set([...DECORATIVE_EFFECTS,...MUSIC_EFFECTS].map(effect=>effect.fx)).size,35);
for(const effect of DECORATIVE_EFFECTS){
    const frame=createFrame();
    assert.equal(sampleDecorativeInto(frame,{mode:effect.id,period:8},1.2,'#ff0000'),true);
    assert.ok(frame.some(row=>row.some(value=>value>0)),effect.label+' produces pixels');
    const still=createFrame(),later=createFrame();
    sampleDecorativeInto(still,{mode:effect.id,period:8},1,'#ff0000',true);
    sampleDecorativeInto(later,{mode:effect.id,period:8},7,'#ff0000',true);
    assert.deepEqual(still,later,effect.label+' reduced motion is steady');
}
assert.equal(sampleDecorativeInto(createFrame(),{mode:'solid'},0),false);
for(const effect of MUSIC_EFFECTS){
    const sampler=new MusicSampler(),frame=createFrame();
    const metrics={bands:new Float32Array([1,.8,.6,.4,.2,.3,.7,.9]),volume:.8,energy:.75,beat:true,bassBeat:true};
    sampler.sample(frame,effect.fx,metrics,.18,.016);
    assert.ok(frame.some(row=>row.some(value=>value>0)),effect.label+' reacts');
    sampler.sample(frame,effect.fx,{...metrics,bands:new Float32Array(8),volume:0,energy:0,beat:false,bassBeat:false},1,.05);
    for(let index=0;index<50;index++)sampler.sample(frame,effect.fx,{...metrics,bands:new Float32Array(8),volume:0,energy:0,beat:false,bassBeat:false},2+index,.05);
    assert.ok(frame.every(row=>row.every(value=>value===0)),effect.label+' silence clears output');
    sampler.reset();assert.ok(sampler.pulse.every(value=>value===0));
}
const analyser={context:{sampleRate:48000},fftSize:2048,
    getFloatFrequencyData:buffer=>buffer.fill(-Infinity),getFloatTimeDomainData:buffer=>buffer.fill(0)};
const metrics={bands:new Float32Array(8),raw:new Float32Array(8),lastBeat:-1000};
analyseMusic(analyser,new Float32Array(1024),new Float32Array(2048),metrics);
assert.equal(metrics.volume,0);assert.equal(metrics.beat,false);assert.ok(metrics.bands.every(value=>value===0));
assert.throws(()=>new MusicSampler().sample(createFrame(),99,metrics,0),RangeError);
console.log('All 25 added decorative previews, ten music effects, silence, reset, reduced motion and silent audio analysis passed.');

const effects=[28,29,30,33,37,38,39,32],mixed=createFrame(),music=new MusicSampler();
const input={bands:new Float32Array([1,.8,.6,.4,.2,.3,.7,.9]),volume:.8,energy:.75,beat:true,bassBeat:true};
music.sample(mixed,effects,input,.18,.016);
for(let strip=0;strip<8;strip++){const reference=createFrame();new MusicSampler().sample(reference,effects[strip],input,.18,.016);assert.deepEqual(mixed[strip],reference[strip],`Strip ${strip} uses its assigned effect with the shared clock`);}
assert.throws(()=>music.sample(createFrame(),[28],input,0),RangeError);
console.log('Mixed strip rendering matches each single-effect renderer.');

// The Comet head travels about .75 of a strip per second at ordinary energy,
// rather than racing several complete strip lengths per second.
const comet=new MusicSampler();comet.forward=true;
for(let i=0;i<20;i++)comet.sample(createFrame(),30,{...input,energy:.7,beat:false,bassBeat:false},i*.05,.05);
assert.ok(Math.abs(comet.positions[0]-.75)<.0001,'Comet speed is five times slower at neutral tuning');
