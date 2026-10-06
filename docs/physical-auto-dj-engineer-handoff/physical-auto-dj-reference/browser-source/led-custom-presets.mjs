// Saved desk recipes for the browser preview. No hardware commands or account data.
import { DECORATIVE_EFFECTS, MUSIC_EFFECTS, MusicSampler, sampleDecorativeInto } from './led-showcase-effects.mjs?v=desktop-bands-back-20261005';
export const CUSTOM_LOOKS_KEY='ergoflex.browserLedLooks.v1';
export function customLookUsesMusic(look){return !!look?.music||look?.strips?.some(strip=>MUSIC_EFFECTS.some(effect=>effect.fx===strip.fx))===true;}
const supported=new Set([0,2,...DECORATIVE_EFFECTS.map(e=>e.fx),...MUSIC_EFFECTS.map(e=>e.fx)]);
const byte=(value,fallback=255)=>{if(value===undefined)return fallback;if(!Number.isInteger(value)||value<0||value>255)throw new Error('Colour, brightness and speed values must be whole numbers from 0 to 255.');return value;};
const color=value=>{if(!Array.isArray(value)||![3,4].includes(value.length))throw new Error('Strip colours must be RGB or RGBW arrays.');return [...value.map(channel=>byte(channel)),...(value.length===3?[0]:[])];};
export function normalizeCustomPalette(entry){
    const name=String(entry?.name||'').trim().slice(0,80),blend=entry?.blend,stops=entry?.stops;
    if(!name||![0,1].includes(blend)||!Array.isArray(stops)||stops.length<2||stops.length>16)throw new Error('A palette needs a name, blend mode and 2–16 colour sections.');
    const normalized=stops.map((s,index)=>{const pos=byte(s.pos,NaN),rgba=[s.r,s.g,s.b,s.w].map(v=>byte(v,0));if(!Number.isInteger(pos)||(index===0&&pos!==0)||(index>0&&pos<=stops[index-1].pos))throw new Error(`${name}: palette sections must start at zero and increase.`);return {pos,r:rgba[0],g:rgba[1],b:rgba[2],w:rgba[3]};});
    return {name,blend,stops:normalized,...(entry.fixed===true?{fixed:true}:{})};
}
export function sampleCustomPalette(palette,position){
    const x=Math.max(0,Math.min(255,Math.floor(position))),stops=palette.stops;
    if(palette.fixed&&palette.blend===1){const s=stops[Math.min(15,Math.floor((x+8)/16))];return [s.r,s.g,s.b,s.w];}
    let index=0;while(index+1<stops.length&&stops[index+1].pos<=x)index++;
    const a=stops[index],rgba=[a.r,a.g,a.b,a.w];
    if(palette.blend===1||index===stops.length-1)return rgba;
    const b=stops[index+1],frac=Math.floor((x-a.pos)*256/(b.pos-a.pos));
    return rgba.map((v,i)=>v+Math.floor(([b.r,b.g,b.b,b.w][i]-v)*frac/256));
}
export function normalizeCustomLook(entry,palettes=[]){
    if(!entry||typeof entry!=='object')throw new Error('Expected a named LED preset.');
    const name=String(entry.name||entry.n||'').trim().slice(0,80);if(!name)throw new Error('Each preset needs a name.');
    let payload=entry.payload||entry;if(typeof payload==='string')payload=JSON.parse(payload);
    const music=payload.mode==='music'?payload.music:null;
    if(music)payload=payload.wled;
    const source=payload.seg||payload.strips;if(!Array.isArray(source)||source.length!==8)throw new Error(`${name}: include all eight strips with IDs 0–7.`);
    const strips=source.map(original=>{
        const segment={...original};
        if(music){
            Object.assign(segment,{fx:[28,29,30,31,32,33,37,38,39,40][music.visualization??0]??28,pal:music.palette_id??0,sx:music.speed??128,ix:music.intensity??128,rev:music.reverse===true,mi:music.mirror===true,on:true,bri:255});
            const override=music.segment_configs?.find(s=>s.id===original.id);if(override)Object.assign(segment,override);
            if(!segment.upal_ref&&music.upal_ref)segment.upal_ref=music.upal_ref;
        }
        const id=segment.id;if(!Number.isInteger(id)||id<0||id>7)throw new Error(`${name}: invalid strip ID.`);
        const fx=segment.fx??0,pal=segment.pal??0;
        if(!supported.has(fx))throw new Error(`${name}: effect ${fx} needs a browser renderer before it can be imported.`);
        const definition=segment.palette||palettes.find(p=>p.id===segment.upal_ref)||segment.builtinPalette;
        if(segment.upal_ref&&!definition)throw new Error(`${name}: include the referenced user palette definition.`);
        if(![0,20,21].includes(pal)&&!definition)throw new Error(`${name}: palette ${pal} needs its palette definition before it can be imported.`);
        if(!Array.isArray(segment.col)||!segment.col.length||segment.col.length>3)throw new Error(`${name}: include the saved strip colours.`);
        const col=segment.col.map(color);while(col.length<3)col.push([0,0,0,0]);
        return {id,fx,pal,col,bri:byte(segment.bri),sx:byte(segment.sx,128),ix:byte(segment.ix,128),on:segment.on!==false,rev:segment.rev===true,mi:segment.mi===true,...(definition?{palette:normalizeCustomPalette(definition)}:{})};
    }).sort((a,b)=>a.id-b.id);
    if(new Set(strips.map(s=>s.id)).size!==8)throw new Error(`${name}: strip IDs must not repeat.`);
    return {name,bri:byte(payload.bri),on:payload.on!==false,strips,...(music?{music:{sensitivity:Math.max(.1,Math.min(4,Number(music.sensitivity)||1))}}:entry.music?{music:{sensitivity:Math.max(.1,Math.min(4,Number(entry.music.sensitivity)||1))}}:{})};
}
export function importCustomLooks(data){
    const rows=Array.isArray(data)?data:data?.presets||data?.preset&&[data.preset]||(data?.name||data?.n?[data]:Object.values(data||{}).filter(value=>value?.n||value?.name));
    if(!Array.isArray(rows)||!rows.length||rows.length>100)throw new Error('Choose a JSON export containing 1–100 named presets.');
    const looks=rows.map(row=>normalizeCustomLook(row,data?.palettes||[]));if(new Set(looks.map(look=>look.name)).size!==looks.length)throw new Error('Preset names must be unique within the file.');
    return looks;
}
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function palette(segment,position){
    if(segment.palette)return sampleCustomPalette(segment.palette,position*255);
    if(segment.pal===20)return lerp(segment.col[0],segment.col[1],position);
    if(segment.pal===21)return position<.5?lerp(segment.col[0],segment.col[1],position*2):lerp(segment.col[1],segment.col[2],(position-.5)*2);
    return segment.col[0];
}
export class CustomLookSampler{
    constructor(counts){this.scratch=counts.map(count=>new Uint8Array(count*4));this.music=new MusicSampler();this.musicFrame=counts.map(count=>new Uint8Array(count*4));this.decorativeFrames=new Map();}
    sample(frame,look,seconds,metrics,reducedMotion=false,delta=.016,height=.5){
        if(!look)return false;
        const rendered=new Map(),musicEffects=look.strips.map(s=>MUSIC_EFFECTS.some(e=>e.fx===s.fx)?s.fx:28);
        const musicFrame=this.musicFrame;
        this.music.sample(musicFrame,musicEffects,metrics,seconds,delta,reducedMotion,look.strips.map(strip=>({...strip,rev:false})));
        for(const segment of look.strips){
            const row=frame[segment.id],count=row.length/4,fx=segment.fx,period=30-segment.sx/255*26,phase=(Math.max(0,seconds)/period)%1;
            let animation=null;
            if(fx>3&&fx!==17&&!MUSIC_EFFECTS.some(e=>e.fx===fx)){
                const key=fx+':'+segment.sx;
                if(!rendered.has(key)){let pixels=this.decorativeFrames.get(key);if(!pixels){pixels=this.scratch.map(row=>new Uint8Array(row.length));this.decorativeFrames.set(key,pixels);}sampleDecorativeInto(pixels,{mode:`fx-${fx}`,period},seconds,'#ffffff',reducedMotion,height);rendered.set(key,pixels);}
                animation=rendered.get(fx+':'+segment.sx);
            }else if(MUSIC_EFFECTS.some(e=>e.fx===fx))animation=musicFrame;
            for(let p=0;p<count;p++){
                const address=segment.rev?count-1-p:p,position=segment.palette?Math.floor((256*address+128)/count)/255:address/Math.max(1,count-1);let gain=1,rgba=palette(segment,position);
                if(!reducedMotion){
                    if(fx===1)gain=phase<.5?1:0;
                    else if(fx===2)gain=segment.ix/1020+(1-segment.ix/1020)*Math.abs(Math.sin(seconds*(.02+segment.sx/255*.08)/.033/2));
                    else if(fx===3)rgba=lerp(segment.col[0],segment.col[1],.5+.5*Math.sin(seconds*(.01+segment.sx/255*.06)/.033));
                }
                if(fx===17)rgba=lerp(segment.col[0],segment.col[1],position);
                if(animation){const offset=address*4;gain=Math.max(animation[segment.id][offset],animation[segment.id][offset+1],animation[segment.id][offset+2])/255;}
                if(fx===0&&segment.pal!==0&&!segment.palette)rgba=palette(segment,0); // User palettes paint their whole sections in Solid.
                if(!look.on||!segment.on)gain=0;
                gain*=segment.bri/255;
                for(let channel=0;channel<4;channel++)row[p*4+channel]=Math.round(rgba[channel]*gain);
            }
        }
        return true;
    }
}

export function tintCustomMusic(frame,look){
    for(const segment of look.strips){const row=frame[segment.id],count=row.length/4;for(let p=0;p<count;p++){const offset=p*4,gain=(!look.on||!segment.on?0:Math.max(row[offset],row[offset+1],row[offset+2])/255)*segment.bri/255,address=segment.rev?count-1-p:p,rgba=palette(segment,segment.palette?Math.floor((256*address+128)/count)/255:address/Math.max(1,count-1));for(let c=0;c<4;c++)row[offset+c]=Math.round(rgba[c]*gain);}}
}
