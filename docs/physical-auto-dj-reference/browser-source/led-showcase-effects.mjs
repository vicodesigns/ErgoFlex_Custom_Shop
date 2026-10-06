export const DECORATIVE_EFFECTS = Object.freeze([
    [1,'Blink'],[3,'Fade'],[4,'Chase / Comet'],[5,'Scanner'],[6,'Meteor'],
    [7,'Meteor Smooth'],[8,'Running'],[9,'Larson'],[10,'Twinkle'],[11,'Color Twinkles'],
    [12,'Sparkle'],[13,'Twinklefox'],[15,'Rainbow'],[16,'Palette Run'],[17,'Gradient'],
    [18,'Fire 2012'],[19,'Aurora'],[20,'Pacifica'],[21,'Candle'],[22,'Strobe (soft preview)'],
    [23,'Heartbeat'],[24,'Fireworks'],[25,'Elevator'],[26,'Cascade'],[27,'Height Sync']
].map(([fx,label])=>Object.freeze({fx,id:`fx-${fx}`,label})));

export const MUSIC_EFFECTS = Object.freeze([
    [28,'Spectrum'],[29,'Pulse'],[30,'Comet'],[31,'Strobe (soft preview)'],[32,'Fire'],
    [33,'Wave'],[37,'Tower'],[38,'Ripple'],[39,'Bass Sky'],[40,'Drop']
].map(([fx,label])=>Object.freeze({fx,label})));

const modulo=value=>((value%1)+1)%1;
const layers=[0,1,1,2,3,3,3,4];
const noise=value=>modulo(Math.sin(value*12.9898)*43758.5453);
const clamp=value=>Math.max(0,Math.min(1,value));

function writeColor(row,pixel,hue,gain,base=null){
    gain=clamp(gain);const offset=pixel*4;
    if(base){row[offset]=Math.round(base[0]*gain);row[offset+1]=Math.round(base[1]*gain);row[offset+2]=Math.round(base[2]*gain);}
    else for(let channel=0;channel<3;channel++){
        const position=modulo(hue+(channel===0?0:channel===1?2/3:1/3))*6;
        row[offset+channel]=Math.round(clamp(Math.abs(position-3)-1)*255*gain);
    }
    row[offset+3]=0;
}

export function sampleDecorativeInto(frame,effect,elapsed,color='#f10404',reducedMotion=false,height=0.5){
    const fx=Number(effect.mode?.slice(3));
    if(!DECORATIVE_EFFECTS.some(entry=>entry.fx===fx))return false;
    const base=[1,3,4,5,6,7,8,9,10,12,21,22,23,25,26,27].includes(fx);
    const rgb=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
    const phase=modulo(Math.max(0,elapsed)/Math.max(4,effect.period||8));
    for(let strip=0;strip<frame.length;strip++){
        const row=frame[strip], count=row.length/4;
        for(let pixel=0;pixel<count;pixel++){
            const position=pixel/Math.max(1,count-1), seed=strip*47+pixel;
            let gain=1,hue=phase+position+strip/8;
            if(!reducedMotion){
                switch(fx){
                    case 1: gain=.12+.88*(phase<.5);break;
                    case 3: gain=.15+.85*(.5+.5*Math.sin(phase*Math.PI*2));break;
                    case 4: gain=Math.max(.03,1-modulo(phase-position)*6);break;
                    case 6: gain=.03+.97*Math.max(0,1-modulo(phase-position)*3)**2;break;
                    case 7: gain=.03+.97*Math.max(0,1-modulo(phase-position)*2)**3;break;
                    case 5: gain=Math.max(.03,1-Math.abs(position-phase)*8);break;
                    case 9: gain=Math.max(.03,1-Math.abs(position-(.5+.5*Math.sin(phase*Math.PI*2)))*6);break;
                    case 8: gain=.12+.88*(modulo(position*4-phase*4)<.5);break;
                    case 10:case 11: gain=.08+.92*Math.max(0,Math.sin(phase*Math.PI*4+noise(seed)*20))**8;hue=noise(seed);break;
                    case 12: gain=.02+.98*Math.max(0,Math.sin(phase*Math.PI*8+noise(seed)*20))**24;break;
                    case 13: gain=.08+.92*Math.max(0,Math.sin(phase*Math.PI*2+noise(seed)*20))**3;hue=noise(seed)+phase*.15;break;
                    case 17: hue=position*.6;break;
                    case 18: hue=.02+noise(seed+Math.floor(phase*24))*.1;gain=.25+.75*noise(seed+Math.floor(phase*24));break;
                    case 19: hue=.32+Math.sin(position*5+phase*Math.PI*2)*.2;gain=.15+.85*(.5+.5*Math.sin(position*5+phase*Math.PI*2));break;
                    case 20: hue=.5+.15*Math.sin(position*6-phase*Math.PI*2);gain=.25+.75*(.5+.5*Math.sin(position*9+phase*Math.PI*2));break;
                    case 21: gain=.65+.35*noise(strip+Math.floor(phase*32));break;
                    case 22: gain=.12+.88*Math.max(0,Math.sin(phase*Math.PI*8))**4;break;
                    case 23: gain=.12+.88*Math.max(0,Math.sin(phase*Math.PI*4))**8;break;
                    case 24: gain=.05+.95*Math.max(0,1-Math.abs(position-noise(strip))*8-modulo(phase+noise(strip))*2);break;
                    case 25: gain=Math.max(.02,1-Math.abs(layers[strip]/4-phase)*4);break;
                    case 26: gain=.05+.95*Math.max(0,Math.sin((phase-layers[strip]/5)*Math.PI*2));break;
                    case 27: gain=.08+.92*(position<=clamp(height));break;
                    default: break;
                }
            }else{gain=1;hue=position+strip/8;}
            writeColor(row,pixel,hue,gain,base?rgb:null);
        }
    }
    return true;
}

// Head travel is about one fifth of the previous preview rate.
export const COMET_TRAVEL_RATE = 6;
export class MusicSampler{
    constructor(){this.pulse=new Float32Array(8);this.positions=new Float32Array(8);this.forward=false;this.drop=0;}
    reset(){this.pulse.fill(0);this.positions.fill(0);this.forward=false;this.drop=0;}
    sample(frame,fx,metrics,seconds,delta=.016,reducedMotion=false,configs=null){
        const effects=Array.isArray(fx)?fx:Array(frame.length).fill(fx);
        if(effects.length!==frame.length||effects.some(value=>!MUSIC_EFFECTS.some(entry=>entry.fx===value)))throw new RangeError('Unknown music effect');
        const dt=Math.min(.05,Math.max(0,delta)), volume=clamp(metrics.volume), energy=clamp(metrics.energy);
        if(metrics.bassBeat)this.forward=!this.forward;
        this.drop=Math.max(metrics.bassBeat?1:0,this.drop-dt*1.8);
        for(let strip=0;strip<frame.length;strip++){
            const fx=effects[strip],config=configs?.[strip],speed=config?(0.25+config.sx/128*.75):1,intensity=(config?.ix??127.5)/255,clock=seconds*speed;
            const row=frame[strip],count=row.length/4,band=clamp(metrics.bands[7-strip]||0);
            this.pulse[strip]=Math.max(metrics.beat?1:0,this.pulse[strip]-dt*(.5+3*intensity+strip*.1));
            this.positions[strip]=modulo(this.positions[strip]+(this.forward?1:-1)*(.02+energy*.15)*dt*COMET_TRAVEL_RATE*speed);
            for(let pixel=0;pixel<count;pixel++){
                const rawPosition=config?.rev?1-pixel/Math.max(1,count-1):pixel/Math.max(1,count-1),position=config?.mi?Math.abs(rawPosition*2-1):rawPosition, layer=layers[strip]/4;
                let gain=0,hue=position*.8+strip/12+seconds*.04;
                if(reducedMotion){gain=volume;hue=position*.6+strip/12;}
                else switch(fx){
                    case 28: gain=band>.03 && position*count<Math.max(1,Math.floor(band**(1.3-intensity)*count))?1:0;break;
                    case 29: gain=Math.max(volume*.25,this.pulse[strip]*Math.max(0,1-strip*.04));hue=strip/8+clock*.05;break;
                    case 30:{const distance=modulo((position-this.positions[strip])*(this.forward?1:-1));gain=volume*Math.max(.08,1-distance*(7-6*intensity));break;}
                    case 31: gain=volume*(.15+.85*Math.max(0,Math.sin(clock*Math.PI*4))**(7-6*intensity));break;
                    case 32: hue=.02+noise(strip*19+pixel+Math.floor(clock*12))*.1;gain=volume*(.1+(.4+intensity)*noise(pixel+strip*23+Math.floor(clock*12)));break;
                    case 33: gain=volume*(.15+.85*(.5+.5*Math.sin(position*(3+6*intensity)+clock*4+strip*.4)));break;
                    case 37: gain=volume*(layer<=Math.min(1,energy*(.5+intensity))?1:.08);hue=layer*.6;break;
                    case 38: gain=volume*Math.max(.05,1-Math.abs(modulo(clock*.6)-layer)*(5-4*intensity));break;
                    case 39: hue=.55+layer*.22;gain=volume*(.2+.8*(metrics.bands[0]||0)*(1-layer)*(.5+intensity));break;
                    case 40: gain=volume*Math.max(.04,this.drop*(.5+.5*Math.cos(position*(3+6*intensity)-layer*4)));hue=.05+this.drop*.6;break;
                }
                writeColor(row,pixel,hue,gain);
            }
        }
        return frame;
    }
}

export function analyseMusic(analyser,frequency,time,metrics,sensitivity=1,dt=.016){
    analyser.getFloatFrequencyData(frequency);analyser.getFloatTimeDomainData(time);
    const edges=[20,60,150,400,1000,2500,5000,10000,20000];
    const binHz=analyser.context.sampleRate/analyser.fftSize;
    let largest=0, squares=0;
    for(let band=0;band<8;band++){
        const first=Math.max(1,Math.floor(edges[band]/binHz)),last=Math.min(frequency.length,Math.ceil(edges[band+1]/binHz));
        let sum=0;for(let index=first;index<last;index++)sum+=10**(frequency[index]/20);
        const amplitude=sum/Math.max(1,last-first);metrics.raw[band]=amplitude;largest=Math.max(largest,amplitude);
    }
    for(const value of time)squares+=value*value;
    const volume=clamp(Math.sqrt(squares/time.length)*sensitivity*4);
    const bass=metrics.raw[0]+metrics.raw[1], oldAverage=metrics.bassAverage||bass;
    const now=performance.now();
    metrics.bassBeat=volume>.025 && bass>oldAverage*1.35 && now-metrics.lastBeat>250;
    metrics.beat=metrics.bassBeat;
    if(metrics.beat)metrics.lastBeat=now;
    metrics.bassAverage=oldAverage+(bass-oldAverage)*Math.min(1,dt*2);
    metrics.volume=volume;metrics.energy=volume;
    for(let band=0;band<8;band++){
        const target=volume>.005 && largest>0 ? clamp(metrics.raw[band]/largest*sensitivity) : 0;
        const alpha=1-Math.exp(-dt*(target>metrics.bands[band]?24:5));
        metrics.bands[band]+=(target-metrics.bands[band])*alpha;
    }
    return metrics;
}
