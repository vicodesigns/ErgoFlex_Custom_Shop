import assert from 'node:assert/strict';
import { BurstOverlay, BuildDropDetector, BURST_RECIPES, burstPeriodMs, burstHueStep, burstStripWeight, tailFactor, hsvToRgb, normalizeBurst } from '../led-music-bursts.mjs';
import { AutoDJ, DJ_BURST_POOLS, normalizeDJSettings } from '../led-auto-dj.mjs';

const DT=1/60, counts=[14,14,15,14,14,11,11,13];
const frame=(v=[40,40,40,200])=>counts.map(c=>{const a=new Uint8Array(c*4);for(let i=0;i<c;i++)a.set(v,i*4);return a;});
const loud={energy:.6,beat:false};
// Run frames from t0 for seconds; returns last ms.
function run(o,t0,seconds,metrics=loud,flags={},beatEvery=0){let t=t0;for(let i=0;i<seconds*60;i++){t+=DT*1000;o.update(t,DT,{...metrics,beat:beatEvery>0&&i%beatEvery===0},flags);}return t;}

// Defaults = classic.
const d=normalizeBurst({});assert.deepEqual(d,{enable:false,rate:128,spectrum:0,zone:128,depth:255,tail:128,section:0,dropAware:false});
assert.equal(tailFactor(128),245);assert.equal(tailFactor(0),238);assert.equal(tailFactor(255),252);
assert.deepEqual(BURST_RECIPES.burst_base,{rate:128,spectrum:0,zone:128,depth:255,tail:128,section:0,dropAware:false});
assert.equal(BURST_RECIPES.burst_sparse.section,120);assert.equal(BURST_RECIPES.burst_dense.tail,110);assert.equal(BURST_RECIPES.burst_focused.zone,64);

// Disabled: no change to the frame.
{const o=new BurstOverlay({enable:false});o.update(1000,DT,{energy:1,beat:true});const f=frame(),g=frame();o.apply(f);assert.deepEqual(f,g);}

// Rate period: linear 1500@1 -> 350@255 (comfort) / 120 (no comfort).
assert.equal(burstPeriodMs(1,true),1500);assert.equal(burstPeriodMs(255,true),350);assert.equal(burstPeriodMs(255,false),120);
assert.ok(burstPeriodMs(128,true)>burstPeriodMs(129,true));
{const slow=new BurstOverlay({enable:true,rate:1}),fast=new BurstOverlay({enable:true,rate:255});run(slow,0,6);run(fast,0,6);
 assert.ok(fast.bursts>slow.bursts*3,`rate scales burst count ${fast.bursts} vs ${slow.bursts}`);
 assert.ok(slow.bursts>=3&&slow.bursts<=5);}
// Rate 0 = beats only; silence never bursts.
{const o=new BurstOverlay({enable:true,rate:0});run(o,0,3);assert.equal(o.bursts,0);run(o,3000,3,loud,{},30);assert.ok(o.bursts>=5);}
{const o=new BurstOverlay({enable:true,rate:255});run(o,0,3,{energy:0});assert.equal(o.bursts,0,'silence floor');}
// Comfort floor 350 ms between bursts even on every-frame beats.
{const o=new BurstOverlay({enable:true,rate:255});run(o,0,2,loud,{comfort:true},1);assert.ok(o.bursts<=Math.ceil(2000/350)+1);
 const n=new BurstOverlay({enable:true,rate:255});run(n,0,2,loud,{},1);assert.ok(n.bursts>o.bursts*2);}

// Depth scaling: 255 is the full classic wash, low depth is subtle and monotonic.
function peakAmt(depth){const o=new BurstOverlay({enable:true,depth,rate:0});o.update(100,DT,{energy:1,beat:true});return o.amount(0);}
assert.ok(peakAmt(255)>240);assert.ok(peakAmt(255)>peakAmt(170)&&peakAmt(170)>peakAmt(60)&&peakAmt(60)>peakAmt(10));
assert.ok(peakAmt(40)<peakAmt(255)/4);
{const f=frame([40,40,40,200]),o=new BurstOverlay({enable:true,depth:255,rate:0});o.update(100,DT,{energy:1,beat:true});o.apply(f);
 const [r,g,b]=hsvToRgb(o.hue);assert.ok(Math.abs(f[0][0]-r)<=40&&f[0][3]<30,'near-total wash, white eased out');
 const s=frame([40,40,40,200]),q=new BurstOverlay({enable:true,depth:40,rate:0});q.update(100,DT,{energy:1,beat:true});q.apply(s);
 assert.ok(s[0][3]>120&&s[0][3]<200,'subtle depth keeps most of the base');}
// Tail: higher = longer glow.
function framesToFade(tail){const o=new BurstOverlay({enable:true,tail,rate:0});o.update(100,DT,{energy:1,beat:true});let n=0;while(o.env>20&&n<2000){o.update(100+n,DT,{energy:0});n++;}return n;}
assert.ok(framesToFade(255)>framesToFade(128)&&framesToFade(128)>framesToFade(0));
// Decay is frame-rate independent.
{const a=new BurstOverlay({enable:true,rate:0}),b=new BurstOverlay({enable:true,rate:0});a.update(0,DT,{energy:1,beat:true});b.update(0,DT,{energy:1,beat:true});
 for(let i=0;i<30;i++)a.update(i,DT,{energy:0});for(let i=0;i<15;i++)b.update(i,2*DT,{energy:0});assert.ok(Math.abs(a.env-b.env)<1);}

// Zone weighting.
assert.equal(burstStripWeight(0,128),255);assert.ok(burstStripWeight(0,255)>burstStripWeight(7,255));assert.ok(burstStripWeight(7,0)>burstStripWeight(0,0));assert.equal(burstStripWeight(7,255),48);

// Hue continuity: spectrum 127 -> 128 steps agree (85), falls to 24, primaries 85 apart.
assert.equal(burstHueStep(127),85);assert.equal(burstHueStep(128),85);assert.equal(burstHueStep(255),24);
for(let s=128;s<255;s++)assert.ok(burstHueStep(s)>=burstHueStep(s+1)&&burstHueStep(s)-burstHueStep(s+1)<=1);
{const o=new BurstOverlay({enable:true,spectrum:0});const seen=[];for(let i=0;i<6;i++){o.advanceHue();seen.push(o.hue);}
 assert.deepEqual(seen,[0,85,170,0,85,170]);
 const w=new BurstOverlay({enable:true,spectrum:255});w.hue=0;w.advanceHue();w.advanceHue();assert.equal(w.hue,48);
 const e=new BurstOverlay({enable:true,spectrum:200});e.advanceHue();assert.equal(e.hue,burstHueStep(200));}

// Sections with injected clock: hype 30 s, calm 2 s + section*160 ms, gain slews ~1 s.
{const o=new BurstOverlay({enable:true,section:40,rate:255,tail:128});
 let t=run(o,0,29);assert.equal(o.hype,true);assert.equal(o.gain,255);const hypeBursts=o.bursts;assert.ok(hypeBursts>20);
 t=run(o,t,1.5);assert.equal(o.hype,false,'calm after 30 s');assert.ok(o.gain>0&&o.gain<255,'gain slewing, not popping');
 t=run(o,t,1);assert.ok(o.gain<8);const calmStart=o.bursts;
 t=run(o,t,2);assert.equal(o.bursts,calmStart,'calm = no new bursts');assert.equal(o.amount(0),0);
 // calm lasts 2000+40*160 = 8400 ms from its start (~30 s)
 t=run(o,t,5.5);assert.equal(o.hype,true,'hype resumes after calm span');
 t=run(o,t,1.5);assert.ok(o.bursts>calmStart,'bursts return');
 assert.equal(calmMs(255),42800);}
function calmMs(s){return 2000+s*160;}
{const a=new BurstOverlay({enable:true,section:0});run(a,0,45);assert.equal(a.hype,true);assert.equal(a.gain,255);}
// Longer section value = longer calm.
{const calmLen=s=>{const o=new BurstOverlay({enable:true,section:s,rate:255});let t=run(o,0,31);let n=0;while(!o.hype&&n<4000){t=run(o,t,.1);n++;}return n;};assert.ok(calmLen(200)>calmLen(20)*2);}

// Drop-aware: build holds bursts back, the drop edge fires a full hit and forces hype ~12 s.
{const o=new BurstOverlay({enable:true,dropAware:true,rate:255,section:0});
 let t=run(o,0,1);assert.ok(o.bursts>0&&o.gain===255,'no build -> normal');
 t=run(o,t,2,loud,{build:true});assert.ok(o.gain<8,'build fades bursts out');const b0=o.bursts;
 t=run(o,t,1,loud,{build:true});assert.equal(o.bursts,b0,'build hold: no bursts');
 o.update(t+16,DT,loud,{build:true,drop:true});assert.equal(o.drops,1);assert.equal(o.env>=240,true,'drop fires full-strength burst');assert.equal(o.bursts,b0+1);
 // drop level held: only the rising edge counts
 for(let i=0;i<10;i++)o.update(t+32+i*16,DT,loud,{drop:true});assert.equal(o.drops,1);}
{const o=new BurstOverlay({enable:true,dropAware:true,section:40,rate:255});let t=run(o,0,31);assert.equal(o.hype,false);
 o.update(t+16,DT,loud,{drop:true});assert.equal(o.hype,true,'drop forces hype');assert.equal(o.sectMs,t+16-18000);
 // 12 s of hype remain, then calm
 let u=run(o,t+16,11);assert.equal(o.hype,true);u=run(o,u,1.5);assert.equal(o.hype,false);}
{const o=new BurstOverlay({enable:true,dropAware:false,rate:255});run(o,0,1);o.update(2000,DT,loud,{drop:true});assert.equal(o.drops,0,'dropAware off ignores drops');}

// Build/drop detector flags a loud jump after a quiet stretch.
{const det=new BuildDropDetector();let t=0,dropped=false;for(let i=0;i<300;i++){t+=16;det.update(t,.016,{energy:.2});}
 for(let i=0;i<5;i++){t+=16;const f=det.update(t,.016,{energy:.95,bassBeat:i===0});dropped=dropped||f.drop;}assert.ok(dropped);}

// Auto DJ burst recipes.
assert.equal(normalizeDJSettings({}).bursts,false);assert.equal(normalizeDJSettings({bursts:true}).bursts,true);
for(const program of Object.keys(DJ_BURST_POOLS))for(const name of DJ_BURST_POOLS[program])assert.ok(BURST_RECIPES[name],name);
{const dj=new AutoDJ({program:'party',bursts:true},()=>.3);dj.start(0);assert.equal(dj.burstRecipe,'burst_base');
 const seen=new Set([dj.burstRecipe]);for(let t=.25;t<200;t+=.25){dj.tick(t,{volume:.3,energy:.3});seen.add(dj.burstRecipe);}
 assert.ok(['burst_base','burst_sparse','burst_dense','burst_focused'].every(n=>seen.has(n)),'party rotates all four');}
console.log('Color Bursts: defaults, rate, depth, tail, zone, hue continuity, sections, drop-aware and DJ recipes pass.');
