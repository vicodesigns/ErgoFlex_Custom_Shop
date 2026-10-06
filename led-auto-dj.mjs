import { customLookUsesMusic } from './led-custom-presets.mjs?v=desktop-bands-back-20261005';
// Browser conductor using the desk API's program pools, cadence and comfort policy.
// Music renderers remain browser adaptations; this does not send desk commands.
export const DJ_PROGRAMS = Object.freeze({
    chill: {pool:[33,32,30,39,33],seconds:45,drop:null,hold:0,quiet:33},
    party: {pool:[28,37,38,29,39,33,30,38],seconds:30,drop:40,hold:6,quiet:33},
    rave: {pool:[37,38,28,31,32,29,37],seconds:20,drop:40,hold:8,quiet:39},
    custom: {seconds:30,drop:40,hold:6,quiet:33}
});
export const DJ_EFFECT_IDS = [28,29,30,31,32,33,37,38,39,40];
export const DJ_SETTINGS_KEY = 'ergoflex.browserAutoDJ.v1';
const flashy = fx => fx === 31 || fx === 40;
const ratings = values => Object.fromEntries(Object.entries(values||{}).filter(([name,value])=>name.length<=80&&Number.isInteger(value)).map(([name,value])=>[name,Math.max(0,Math.min(4,value))]));
export function normalizeDJSettings(input = {}) {
    return {version:1,program:Object.hasOwn(DJ_PROGRAMS,input.program)?input.program:'party',
        comfort:['standard','reduced','minimal'].includes(input.comfort)?input.comfort:'standard',
        beatAlign:input.beatAlign!==false,
        remixPresets:input.remixPresets!==false,remixSliders:input.remixSliders!==false,
        remixPhysics:input.remixPhysics!==false,burstsOn:input.burstsOn!==false,
        randomizeOn:input.randomizeOn!==false,remixBursts:input.remixBursts!==false,
        dynamicsMode:['off','story','wide'].includes(input.dynamicsMode)?input.dynamicsMode:'wide',
        mixStrips:input.mixStrips!==false,
        lookWeights:ratings(input.lookWeights),paletteWeights:ratings(input.paletteWeights),
        weights:Object.fromEntries(DJ_EFFECT_IDS.map(fx=>[fx,Number.isInteger(input.weights?.[fx])?Math.max(0,Math.min(4,input.weights[fx])):2]))};
}
export function djPool(settings) {
    const config = normalizeDJSettings(settings);
    const source=config.program==='custom'?DJ_EFFECT_IDS:DJ_PROGRAMS[config.program].pool;
    const result=[];
    for(const fx of source){
        if(config.comfort==='minimal'&&flashy(fx))continue;
        let weight=config.program==='custom'?config.weights[fx]:2;
        if(config.comfort==='reduced'&&flashy(fx)&&weight>1)weight=Math.max(1,Math.floor(weight/2));
        for(let i=0;i<weight;i++)result.push(fx);
    }
    return result;
}
export class AutoDJ {
    constructor(settings={},random=Math.random){this.random=random;this.looks=[];this.palettes=[];this.configure(settings);this.enabled=false;this.reset();}
    setLibrary(looks=[],palettes=[]){this.looks=looks.filter(customLookUsesMusic);this.palettes=palettes;this.configure(this.settings);}
    configure(settings){this.settings=normalizeDJSettings(settings);this.effectPool=djPool(this.settings);this.pool=[...this.effectPool];
        for(const look of this.looks){let weight=this.settings.lookWeights[look.name]??2;const flash=look.strips.some(s=>flashy(s.fx));if(flash&&this.settings.comfort==='minimal')continue;if(flash&&this.settings.comfort==='reduced')weight=Math.ceil(weight/2);for(let i=0;i<weight;i++)this.pool.push('look:'+look.name);}
        this.deck=[];this.mixKey=null;this.revision=(this.revision||0)+1;
        if(this.enabled&&this.settings.comfort==='minimal'&&flashy(this.fx))this.fx=this.fx===40?39:33;
        if(this.enabled&&this.pool.length&&!this.pool.includes(this.currentLook?'look:'+this.currentLook.name:this.fx))this.fx=this.draw();
        return this.pool.length>0;
    }
    reset(time=0){this.time=time;this.switchedAt=time;this.beats=0;this.energyAverage=.1;this.quietAt=null;this.dropUntil=0;this.dropAt=time;this.drops=0;this.reason='phrase';this.deck=[];this.mixKey=null;this.beatTimes=[];this.lastBeatTime=null;this.pendingSwitch=false;}
    draw(){
        this.revision=(this.revision||0)+1;
        if(!this.pool.length)return null;
        if(!this.deck.length){this.deck=[...this.pool];for(let i=this.deck.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.deck[i],this.deck[j]]=[this.deck[j],this.deck[i]];}}
        const previous=this.currentLook?'look:'+this.currentLook.name:this.fx;
        let index=this.deck.findIndex(fx=>fx!==previous);if(index<0)index=this.deck.length-1;
        const choice=this.deck.splice(index,1)[0];this.currentLook=typeof choice==='string'?this.looks.find(look=>'look:'+look.name===choice):null;
        // Original colours stay in the rotation alongside separately rated palettes.
        const palettePool=[null,null];for(const p of this.palettes)for(let i=0;i<(this.settings.paletteWeights[p.name]??0);i++)palettePool.push(p);
        this.currentPalette=palettePool[Math.floor(this.random()*palettePool.length)];
        return this.currentLook?(this.currentLook.strips.find(s=>DJ_EFFECT_IDS.includes(s.fx))?.fx??28):choice;
    }
    start(time=0){if(!this.pool.length)return false;this.enabled=true;this.reset(time);this.fx=this.draw();return true;}
    stop(){this.enabled=false;this.currentLook=null;this.currentPalette=null;this.reset();}
    stripEffects(count=8){
        // Quiet passages and drops are coordinated accents. Phrase playback can
        // combine up to three effects, all driven by the same audio metrics.
        if(this.enabled&&this.currentLook&&this.reason==='phrase')return this.currentLook.strips.map(s=>s.fx);
        if(!this.enabled||!this.settings.mixStrips||this.reason!=='phrase')return Array(count).fill(this.fx);
        const key=`${this.fx}:${this.switchedAt}:${count}`;
        if(this.mixKey!==key){
            const chosen=[this.fx],available=this.effectPool.filter(fx=>!flashy(fx));
            while(chosen.length<3){
                const choices=available.filter(fx=>!chosen.includes(fx));if(!choices.length)break;
                chosen.push(choices[Math.floor(this.random()*choices.length)]);
            }
            const groups=[0,1,1,2,2,0,0,2],offset=Math.floor(this.random()*chosen.length);
            this.mix=Array.from({length:count},(_,strip)=>chosen[(groups[strip%8]+offset)%chosen.length]);
            // Flash-heavy effects stay on one strip during phrase mixing.
            if(flashy(this.fx)){this.mix=this.mix.map(fx=>fx===this.fx?(chosen[1]||this.fx):fx);this.mix[0]=this.fx;}
            this.mixKey=key;
        }
        return [...this.mix];
    }
    tick(time,metrics={}){
        if(!this.enabled)return null;
        if(time<this.time-.1||time>this.time+2){this.reset(time);return this.fx;}
        const dt=Math.max(0,time-this.time);this.time=time;
        if(metrics.bassBeat&&this.lastBeatTime!==time){this.beats++;this.beatTimes.push(time);if(this.beatTimes.length>5)this.beatTimes.shift();this.lastBeatTime=time;}
        const intervals=this.beatTimes.slice(1).map((value,index)=>value-this.beatTimes[index]);
        const interval=intervals.reduce((sum,value)=>sum+value,0)/Math.max(1,intervals.length);
        const steady=intervals.length>=3&&interval>=.25&&interval<=1.5&&intervals.every(value=>Math.abs(value-interval)<interval*.22)&&time-this.lastBeatTime<interval*1.8;
        const p=DJ_PROGRAMS[this.settings.program],volume=metrics.volume||0,energy=metrics.energy||volume;
        const average=this.energyAverage;this.energyAverage+= (energy-average)*Math.min(1,dt*1.5);
        if(volume<.035){if(this.quietAt===null)this.quietAt=time;}else this.quietAt=null;
        if(this.quietAt!==null&&time-this.quietAt>3){if(this.effectPool.includes(p.quiet)){this.fx=p.quiet;this.currentLook=null;this.currentPalette=null;}this.reason='quiet';this.switchedAt=time;this.pendingSwitch=false;return this.fx;}
        if(time<this.dropUntil)return this.fx;
        if(this.reason==='drop'){this.fx=this.draw();this.reason='phrase';this.switchedAt=time;this.beats=0;}
        const canDrop=p.drop!==null&&(this.settings.program!=='custom'||this.settings.weights[40]>0);
        if(canDrop&&metrics.bassBeat&&energy>.6&&energy>average*1.7&&time-this.dropAt>18){
            this.dropAt=time;this.drops++;
            if(this.settings.comfort!=='reduced'||this.drops%2===0){
                this.currentLook=null;this.currentPalette=null;
                this.fx=this.settings.comfort==='minimal'?(this.settings.program==='custom'&&!this.pool.includes(39)?this.draw():39):p.drop;this.dropUntil=time+p.hold;this.reason='drop';this.pendingSwitch=false;return this.fx;
            }
        }
        // Program timing chooses when a new look is due. Stable audio beats
        // choose the landing; no tempo or a lost beat must never stall the DJ.
        if(time-this.switchedAt>=p.seconds){
            if(this.settings.beatAlign&&steady&&!metrics.bassBeat){
                if(!this.pendingSwitch){this.pendingSwitch=true;this.switchDeadline=time+Math.min(1.5,interval*1.8);}
            }
            if(!this.settings.beatAlign||!steady||metrics.bassBeat||(this.pendingSwitch&&time>=this.switchDeadline)){
                this.fx=this.draw();this.switchedAt=time;this.pendingSwitch=false;this.reason='phrase';
            }
        }
        return this.fx;
    }
}
