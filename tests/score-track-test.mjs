// The Sound layer (P2): the score of a chapter in chapter seconds (by id), its dissolves, beat / bar snapping, the
// stale warning and the waveform columns, on the cine cut's real tempo map.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chapterScore,staleness,snapTimes,snapTo,waveColumns,createScorePlayer} from '../experience/score-track.mjs';
const tempo=JSON.parse(fs.readFileSync(new URL('../exports/cinematic-intro-cut-cine/score/tempo-map.json',import.meta.url),'utf8'));
const inputs={chapters:{rise:{start:43.35,seconds:18,head:[-.35,.8],tail:[17.65,.8]}},hits:tempo.hits};
const peaks={rate:200,chapters:{rise:{t0:41.85,t1:62.85,clip:'preview/rise.opus',min:Array(4200).fill(-64),max:Array(4200).fill(64),rms:Array(4200).fill(20)}}};
const m=chapterScore(tempo,'rise',{peaks,inputs});
assert.equal(m.start,43.35,'by id: rise starts at 43.35 s of the film');
assert.equal(m.bars[0],tempo.chapters.rise.bars_rel[0]);
assert.ok(m.beats.every(b=>b.t>=-.01&&b.t<=18.01)&&m.beats.length>=30,'beats inside the chapter');
assert.ok(m.beats.some(b=>b.beat===1),'beats keep their numbers');
assert.ok(m.sections.length&&m.sections.every(s=>s.t1>0&&s.t0<18));
assert.equal(m.peaks.t0,-1.5,'the preview starts 1.5 s before the chapter');
assert.deepEqual(m.head,[-.35,.8]);assert.deepEqual(m.tail,[17.65,.8]);
assert.equal(chapterScore(tempo,'nope'),null);
// the logo hit is in the hero chapter, 239.368 s of the film
const hero=chapterScore(tempo,'hero',{inputs:{chapters:{hero:{seconds:48}}}});
assert.ok(Math.abs(hero.hits.find(h=>h.name==='logo').t-(239.368-tempo.chapters.hero.start))<1e-3);
// movement sounds, chapter seconds (storage has the one-button sequence)
const st=chapterScore(tempo,'storage',{inputs:{chapters:{storage:{seconds:24.978}}}});
assert.ok(st.sfx.length>=3&&st.sfx.every(x=>x.t>-x.dur&&x.t<24.978));
// snapping: beat and bar grids
const beats=snapTimes(m,'beat'),bars=snapTimes(m,'bar');assert.equal(beats.length,m.beats.length);assert.equal(bars.length,m.bars.length);
assert.equal(snapTo(m.bars[2]+.05,bars,Infinity),m.bars[2]);assert.equal(snapTo(5,[1,2],.5),5,'outside the tolerance: unchanged');
assert.deepEqual(snapTimes(null,'beat'),[]);
// stale: the chapter's length changed since the score was built
assert.equal(staleness(inputs,'rise',{seconds:18}),null);
assert.equal(staleness(inputs,'rise',{seconds:20}),'Rise is 20 s; the score was built for 18 s · it is rebuilt at render');
// the waveform folds to the lane's width, log-scaled
const cols=waveColumns(m.peaks,0,18,100);assert.equal(cols.length,100);assert.ok(cols.every(c=>c.peak>0&&c.peak<=1&&c.rms<c.peak));
// the lane's mute (M): silent while muted, the volume kept for unmuting
{let g=null;class Ctx{constructor(){this.destination={};}createGain(){return g={gain:{value:1},connect(){}};}async decodeAudioData(){return {duration:1};}}
const fetch0=globalThis.fetch;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
const pl=createScorePlayer({base:'x',AudioContextClass:Ctx});pl.setVolume(.6);pl.setMuted(true);await pl.load({id:'rise',peaks:{clip:'c.opus',t0:0}});
assert.equal(g.gain.value,0);assert.equal(pl.volume(),.6);pl.setVolume(.4);assert.equal(g.gain.value,0);
pl.setMuted(false);assert.equal(g.gain.value,.4);assert.equal(pl.muted(),false);globalThis.fetch=fetch0;}
console.log('score-track-test: ok');
