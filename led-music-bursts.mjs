// Browser mirror of the desk's "Color Bursts" music overlay (ergoled_firmware EffectEngine.h:
// advanceBurstHue, burstPeriodMs, advanceBurstSection, the burst advance + wash blocks).
// Integer maths follow the firmware so defaults give the classic look. Time is injected (ms) so
// tests are deterministic. Firmware advances once per ~60 fps frame; here step() takes the real
// dt and scales per-frame constants by dt*60.
export const BURST_DEFAULTS = Object.freeze({enable:false,rate:128,spectrum:0,zone:128,depth:255,tail:128,section:0,dropAware:false});
export const BURST_RECIPES = Object.freeze({
    burst_base:{rate:128,spectrum:0,zone:128,depth:255,tail:128,section:0,dropAware:false},
    burst_sparse:{rate:60,spectrum:0,zone:255,depth:200,tail:160,section:120,dropAware:true},
    burst_dense:{rate:200,spectrum:128,zone:128,depth:255,tail:110,section:40,dropAware:true},
    burst_focused:{rate:128,spectrum:128,zone:64,depth:170,tail:150,section:90,dropAware:true}
});
const FRAME=1/60, HYPE_MS=30000, SILENCE_FLOOR=6;
const byte=(value,fallback)=>Number.isFinite(Number(value))?Math.max(0,Math.min(255,Math.round(Number(value)))):fallback;
export function normalizeBurst(input={}){
    const d=BURST_DEFAULTS;
    return {enable:!!input.enable,rate:byte(input.rate,d.rate),spectrum:byte(input.spectrum,d.spectrum),zone:byte(input.zone,d.zone),
        depth:byte(input.depth,d.depth),tail:byte(input.tail,d.tail),section:byte(input.section,d.section),dropAware:!!input.dropAware};
}
// Firmware STRIP_VPOS: 0=top .. 255=bottom. Mirrors burstStripWeight.
const STRIP_VPOS=[0,40,40,100,170,170,170,255];
export function burstStripWeight(strip,zone){
    const v=STRIP_VPOS[strip&7];if(zone===128)return 255;
    let falloff;
    if(zone>128)falloff=((v*((zone-128)*2))>>8);else falloff=(((255-v)*((128-zone)*2))>>8);
    const w=falloff>=255?0:255-falloff;return w<48?48:w;
}
export function hsvToRgb(h){
    const region=Math.floor(h/43),rem=((h-region*43)*6)&255,v=255,p=0;
    const q=Math.floor(v*(255-rem)/255),t=Math.floor(v*rem/255);
    switch(region){case 0:return[v,t,p];case 1:return[q,v,p];case 2:return[p,v,t];case 3:return[p,q,v];case 4:return[t,p,v];default:return[v,p,q];}
}
// Linear from 1500 ms at rate 1 to the floor at 255 (350 ms comfort, 120 ms otherwise).
export function burstPeriodMs(rate,comfort){const min=comfort?350:120;return Math.trunc(1500-Math.trunc(((rate-1)*(1500-min))/254));}
// Hue: spectrum<128 cycles three primaries; >=128 marches with a step falling 85 -> 24 (continuous at 127/128).
export function burstHueStep(spectrum){return spectrum<128?85:85-Math.trunc(((spectrum-128)*61)/127);}
export function tailFactor(tail){return 245+Math.trunc(((tail-128)*7)/127);}   // /256 per frame; 128 -> 245
export class BurstOverlay{
    constructor(config={}){this.configure(config);this.reset();}
    configure(config){this.cfg=normalizeBurst(config);return this.cfg;}
    reset(){this.env=0;this.hue=0;this.step=0;this.lastBurstMs=-1e9;this.hype=true;this.gain=255;this.sectMs=0;this.prevDrop=false;this.drops=0;this.bursts=0;}
    section(nowMs,flags,dt){
        const cfg=this.cfg,drop=!!flags.drop,build=!!flags.build;let dropHit=false;
        if(drop&&!this.prevDrop&&cfg.dropAware)dropHit=true;this.prevDrop=drop;
        if(cfg.section===0&&!cfg.dropAware){this.hype=true;this.gain=255;this.sectMs=nowMs;return{gain:255,dropHit};}
        if(cfg.section!==0){
            const calmMs=2000+cfg.section*160,span=nowMs-this.sectMs;
            if(this.hype&&span>=HYPE_MS){this.hype=false;this.sectMs=nowMs;}
            else if(!this.hype&&span>=calmMs){this.hype=true;this.sectMs=nowMs;}
        }
        let target=this.hype;
        if(cfg.dropAware){
            if(dropHit){this.hype=true;this.sectMs=nowMs-(HYPE_MS-12000);}
            if(build)target=false;
            if(dropHit)target=true;
        }
        const slew=4*dt/FRAME;   // ~1 s end to end
        this.gain=target?Math.min(255,this.gain+slew):Math.max(0,this.gain-slew);
        return{gain:this.gain,dropHit};
    }
    advanceHue(){
        const s=this.cfg.spectrum;
        if(s<128){this.hue=(Math.trunc(s*170/127)+this.step*85)&255;this.step=(this.step+1)%3;}
        else this.hue=(this.hue+burstHueStep(s))&255;
    }
    // metrics: {energy 0..1, beat boolean}; flags: {build, drop}; returns whether a burst fired.
    update(nowMs,dt,metrics={},flags={},stale=false){
        const cfg=this.cfg;
        if(!cfg.enable){this.env=0;this.gain=255;this.hype=true;return false;}
        dt=Math.max(0,Math.min(.1,dt));
        const energy=Math.max(0,Math.min(255,Math.round((metrics.energy||0)*255)));
        const soundPresent=!stale&&energy>=SILENCE_FLOOR,{gain,dropHit}=this.section(nowMs,flags,dt);
        let trigger=soundPresent&&(!!metrics.beat||dropHit);
        if(!trigger&&soundPresent&&cfg.rate>0&&nowMs-this.lastBurstMs>=burstPeriodMs(cfg.rate,!!flags.comfort))trigger=true;
        if(gain<8&&!dropHit)trigger=false;
        if(trigger&&flags.comfort&&nowMs-this.lastBurstMs<350)trigger=false;
        if(trigger){
            this.lastBurstMs=nowMs;this.env=dropHit?255:Math.min(255,140+energy);this.bursts++;if(dropHit)this.drops++;this.advanceHue();
        }
        if(this.env>0)this.env*=Math.pow(tailFactor(cfg.tail)/256,dt/FRAME);   // firmware decays on the firing frame too
        if(this.env<.5)this.env=0;
        return trigger;
    }
    // Per-strip wash amount 0..255 (firmware: env*weight>>8, *(depth+1)>>8, *(gain+1)>>8).
    amount(strip){
        if(!this.cfg.enable||this.env<=0)return 0;
        let amt=Math.floor(Math.floor(this.env)*burstStripWeight(strip,this.cfg.zone)/256);
        amt=Math.floor(amt*(this.cfg.depth+1)/256);
        if(this.gain!==255)amt=Math.floor(amt*(Math.floor(this.gain)+1)/256);
        return amt;
    }
    // Wash the final RGBW frame: each of R,G,B eases toward the burst hue, white eases to 0.
    apply(frame){
        if(!this.cfg.enable||this.env<=0)return false;
        const [r,g,b]=hsvToRgb(this.hue);let touched=false;
        frame.forEach((row,strip)=>{
            const amt=this.amount(strip);if(!amt)return;touched=true;
            for(let i=0;i+3<row.length;i+=4){
                row[i]+=((r-row[i])*amt)>>8;row[i+1]+=((g-row[i+1])*amt)>>8;row[i+2]+=((b-row[i+2])*amt)>>8;row[i+3]+=((0-row[i+3])*amt)>>8;
            }
        });
        return touched;
    }
}
// Build / drop detector for sources with no firmware flags: a drop is a loud bass beat that
// jumps well over the running energy (same test the DJ uses); a build is energy climbing above
// its slow average with no beat for ~1 s. Browser approximation of the desk's analyser flags.
export class BuildDropDetector{
    constructor(){this.reset();}
    reset(){this.slow=.1;this.fast=.1;this.lastBeat=-1e9;this.lastDrop=-1e9;this.build=false;this.buildUntil=-1e9;}
    update(nowMs,dt,metrics={}){
        const e=metrics.energy||0;this.slow+=(e-this.slow)*Math.min(1,dt*.3);this.fast+=(e-this.fast)*Math.min(1,dt*2);
        let drop=false;
        if(metrics.bassBeat){
            if(e>.6&&e>this.slow*1.7&&nowMs-this.lastDrop>8000){drop=true;this.lastDrop=nowMs;}
            this.lastBeat=nowMs;
        }
        if(!drop&&e>.12&&this.fast>this.slow*1.15&&nowMs-this.lastBeat>1000)this.buildUntil=nowMs+1500;
        this.build=nowMs<this.buildUntil&&!drop;
        return{build:this.build,drop:drop?(this._dropHold=nowMs+120,true):nowMs<(this._dropHold||0)};
    }
}
