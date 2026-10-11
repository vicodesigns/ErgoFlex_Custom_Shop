import { LED_STRIPS } from './led-strip-map.mjs';

// A browser preview, not a port of Ambient.hpp. Horizontal strips sample
// successive screen bands; desktop wings sample the matching screen edge.
// Write electrical addresses using the geometry map (no demo-bank mirroring).
const bands = [.06, .20, .34, .48, .62, 0, 0, .94];
const gains = {calm:.25, normal:.5, intense:.8, full:1};
const linear = v => {const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
export function sampleScreenColours(frame, image, {mode='normal', audio=null}={}) {
    const {data,width,height}=image;
    const gain=(gains[mode]??.5)*(audio===null?1:.65+.35*Math.min(1,Math.max(0,audio)*5));
    for(let strip=0;strip<frame.length;strip++){
        const row=frame[strip],count=row.length/4;
        for(let p=0;p<count;p++){
            const t=(LED_STRIPS[strip].reverse?count-1-p:p)/Math.max(1,count-1);
            const x=Math.round((strip===5?.04:strip===6?.96:.04+.92*t)*(width-1));
            const y=Math.round((strip===5||strip===6?.08+.84*t:bands[strip])*(height-1));
            const sum=[0,0,0];let n=0;
            for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
                const xx=Math.max(0,Math.min(width-1,x+dx)),yy=Math.max(0,Math.min(height-1,y+dy)),i=(yy*width+xx)*4;
                for(let c=0;c<3;c++)sum[c]+=linear(data[i+c]);n++;
            }
            for(let c=0;c<3;c++)row[p*4+c]=Math.round(255*sum[c]/n*gain);
            row[p*4+3]=0; // No synthetic white-channel extraction.
        }
    }
    return frame;
}
