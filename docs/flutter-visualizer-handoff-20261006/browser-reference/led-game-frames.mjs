export function validateGameManifest(m, counts) {
    if(m?.version!==1 || !Number.isFinite(m.duration) || m.duration<=0 || m.duration>60 ||
        !Number.isInteger(m.fps) || m.fps<1 || m.fps>60 || !Number.isInteger(m.frames) || m.frames<2 || m.frames>3600 ||
        Math.abs(m.frames/m.fps-m.duration)>.1 || !Array.isArray(m.counts) || m.counts.join(',')!==counts.join(',') ||
        !/^[a-z0-9-]+\.mp4$/.test(m.video) || !m.banks ||
        !['calm','normal','intense','full'].every(mode=>['colours','music'].every(content=>/^[a-z0-9-]+\.rgbw$/.test(m.banks[mode+':'+content]||''))))
        throw new Error('The lighting clip has an incompatible frame map.');
    return m;
}
export function sampleGameBank(frame, data, manifest, seconds, mirrorHorizontally=false) {
    const stride=manifest.counts.reduce((a,b)=>a+b,0)*4;
    if(data.length!==stride*manifest.frames)throw new Error('Lighting frame bank length does not match the clip.');
    const position=Math.max(0,Math.min(manifest.frames-1,(Number(seconds)||0)*manifest.fps));
    const a=Math.floor(position),b=Math.min(manifest.frames-1,a+1),mix=position-a;
    let offset=0;
    for(let stripId=0;stripId<frame.length;stripId++){
        const row=frame[stripId];
        const sourceId=mirrorHorizontally && (stripId===5 || stripId===6) ? 11-stripId : stripId;
        const sourceCount=manifest.counts[sourceId], count=row.length/4;
        let sourceOffset=offset;
        if(sourceId!==stripId){sourceOffset=0;for(let prior=0;prior<sourceId;prior++)sourceOffset+=manifest.counts[prior]*4;}
        for(let pixel=0;pixel<count;pixel++){
            const mappedPixel=count===sourceCount ? pixel : Math.round(pixel/Math.max(1,count-1)*(sourceCount-1));
            const sourcePixel=mirrorHorizontally && stripId!==5 && stripId!==6 ? sourceCount-1-mappedPixel : mappedPixel;
            for(let channel=0;channel<4;channel++){
                const index=sourceOffset+sourcePixel*4+channel;
                row[pixel*4+channel]=Math.round(data[a*stride+index]*(1-mix)+data[b*stride+index]*mix);
            }
        }
        offset+=row.length;
    }
    return frame;
}
