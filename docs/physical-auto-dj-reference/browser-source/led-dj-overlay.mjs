// Temporary browser DJ tuning. Saved looks, palettes and analyser metrics are
// never edited; stopping the DJ returns to the visitor's existing settings.
const clamp = value => Math.max(0, Math.min(1, value));
const MUSIC_IDS = new Set([28,29,30,31,32,33,37,38,39,40]);
// Speed and the effect's second parameter: reach, decay, tail, flash width,
// fire variation, wave scale, tower reach, ripple width, bass reach, drop scale.
const SLIDERS = {
    28:[[72,170],[75,210]],29:[[65,165],[65,200]],30:[[35,110],[90,200]],
    31:[[35,90],[30,95]],32:[[70,170],[65,210]],33:[[55,150],[65,205]],
    37:[[70,170],[100,220]],38:[[50,145],[85,210]],39:[[55,155],[90,215]],40:[[60,150],[90,205]]
};
const rgb = hue => [0,2/3,1/3].map(offset => Math.round(255*clamp(Math.abs(((hue+offset)%1)*6-3)-1)));

export class DJOverlay {
    constructor(){this.reset();}
    reset(){this.key=null;this.look=null;this.configs=null;this.smoothed=null;this.burstAt=-Infinity;this.beatIndex=0;this.lastBeatTime=null;this.effects=null;}
    prepare(dj,metrics,time,dt,reduced=false){
        if(!dj.enabled){this.reset();return {metrics,look:null,configs:null};}
        const settings=dj.settings;
        const source=dj.reason==='phrase'?dj.currentLook:null;
        const key=`${dj.revision}:${dj.switchedAt}:${dj.reason}:${dj.fx}`;
        if(key!==this.key){
            this.key=key;
            this.look=source?{...source,strips:source.strips.map(strip=>({...strip}))}:null;
            this.configs=this.look?.strips||dj.stripEffects().map((fx,id)=>({id,fx,sx:128,ix:128,rev:false,mi:false}));
            const pick = values => values[Math.min(values.length-1,Math.floor(dj.random()*values.length))];
            const allowed=[...new Set(dj.effectPool)].filter(fx=>fx!==31&&fx!==40);
            if(source&&settings.remixPresets&&allowed.length){
                const lead=pick(allowed),tiers=[lead,pick(allowed),pick(allowed)],groups=[0,1,1,2,2,0,0,2];
                this.configs.forEach((strip,id)=>{if(MUSIC_IDS.has(strip.fx))strip.fx=settings.mixStrips?tiers[groups[id]]:lead;});
            }
            if(settings.remixSliders)for(const strip of this.configs){
                const ranges=SLIDERS[strip.fx];if(!ranges)continue;
                [strip.sx,strip.ix]=ranges.map(([min,max])=>Math.round(min+dj.random()*(max-min)));
            }
            this.physics={attack:4+dj.random()*12,decay:1.5+dj.random()*4,punch:.1+dj.random()*.3};
            this.story={hue:dj.random(),style:Math.floor(dj.random()*3),drift:.012+dj.random()*.025};
            this.burst={width:settings.remixBursts ? .08+dj.random()*.2 : .13,every:settings.remixBursts?1+Math.floor(dj.random()*3):2};
        }
        const newBeat=metrics.bassBeat&&time!==this.lastBeatTime&&!reduced;
        if(newBeat){this.lastBeatTime=time;this.beatIndex++;
            // Comfort suppresses bursts and abrupt randomization, even if saved on.
            if(settings.comfort==='standard'&&settings.burstsOn&&this.beatIndex%this.burst.every===0)this.burstAt=time;
        }
        const randomize=settings.randomizeOn&&settings.comfort==='standard'&&!reduced;
        const configs=this.configs.map((strip,id)=>({...strip,
            rev:randomize?strip.rev!==(this.beatIndex%2===0):strip.rev,
            mi:randomize?(this.beatIndex+id)%3===0:strip.mi}));
        const look=this.look?{...this.look,strips:configs}:null;
        let effective=metrics;
        if(settings.remixPhysics&&!reduced){
            if(!this.smoothed)this.smoothed={bands:Array.from(metrics.bands),volume:metrics.volume,energy:metrics.energy};
            const smooth=(previous,value)=>previous+(value-previous)*(1-Math.exp(-dt*(value>previous?this.physics.attack:this.physics.decay)));
            for(const field of ['volume','energy'])this.smoothed[field]=smooth(this.smoothed[field],metrics[field]||0);
            this.smoothed.bands=this.smoothed.bands.map((value,id)=>smooth(value,metrics.bands[id]||0));
            const boost=newBeat?this.physics.punch:0;
            effective={...metrics,volume:clamp(this.smoothed.volume+boost),energy:clamp(this.smoothed.energy+boost),bands:this.smoothed.bands.map(value=>clamp(value+boost))};
        }else this.smoothed=null;
        this.effects=configs.map(strip=>strip.fx);
        return {metrics:effective,look,configs};
    }
    paint(frame,dj,metrics,time,reduced=false){
        if(!dj.enabled||reduced)return frame;
        const settings=dj.settings,wide=settings.dynamicsMode==='wide';
        const burstGain=settings.comfort==='standard'&&settings.burstsOn?clamp(1-(time-this.burstAt)/.4):0;
        frame.forEach((row,strip)=>{
            const config=this.configs?.[strip];if(config?.on===false||this.look?.on===false)return;
            let shift=0;
            if(settings.dynamicsMode!=='off'){
                shift=this.story.style===0?Math.sin(time*this.story.drift)*.12:
                    this.story.style===1?(this.beatIndex%12)/12*.2:(metrics.bands[7-strip]||0)*.22;
                if(wide)shift*=3;
            }
            const angle=shift*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle),a=(1-cos)/3,b=sin/Math.sqrt(3);
            const colour=rgb((this.story.hue+strip*.09+this.beatIndex*.13)%1),count=row.length/4;
            const center=((this.beatIndex*37+strip*19)%100)/100;
            for(let p=0;p<count;p++){
                const offset=p*4,r=row[offset],g=row[offset+1],blue=row[offset+2];
                if(shift){const rotated=[r*(cos+a)+g*(a-b)+blue*(a+b),r*(a+b)+g*(cos+a)+blue*(a-b),r*(a-b)+g*(a+b)+blue*(cos+a)].map(v=>Math.max(0,v));
                    const scale=Math.max(r,g,blue)/Math.max(1,...rotated);rotated.forEach((value,c)=>row[offset+c]=Math.round(value*scale));}
                const local=burstGain*clamp(1-Math.abs(p/Math.max(1,count-1)-center)/this.burst.width)*clamp(metrics.volume)*(config?.bri??255)/255*(this.look?.bri??255)/255;
                if(local)for(let c=0;c<3;c++)row[offset+c]=Math.max(row[offset+c],Math.round(colour[c]*local));
            }
        });
        return frame;
    }
}
