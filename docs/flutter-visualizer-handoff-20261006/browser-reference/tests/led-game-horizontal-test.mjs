import assert from 'node:assert/strict';
import { sampleGameBank } from '../led-game-frames.mjs';

const counts=[3,3,3,3,3,2,2,3];
const stride=counts.reduce((total,count)=>total+count,0)*4;
const data=new Uint8Array(stride*2);
let offset=0;
counts.forEach((count,stripId)=>{
    for(let pixel=0;pixel<count;pixel++){
        data.set([stripId*20+pixel, pixel+1, 2, 3],offset+pixel*4);
        data.set([stripId*20+pixel+10,pixel+11,12,13],stride+offset+pixel*4);
    }
    offset+=count*4;
});
const manifest={counts,frames:2,fps:1};
const raw=counts.map(count=>new Uint8Array(count*4));
const mirrored=counts.map(count=>new Uint8Array(count*4));
sampleGameBank(raw,data,manifest,.5);
sampleGameBank(mirrored,data,manifest,.5,true);
for(const stripId of [0,1,2,3,4,7]){
    for(let pixel=0;pixel<counts[stripId];pixel++)
        assert.deepEqual(mirrored[stripId].slice(pixel*4,pixel*4+4),raw[stripId].slice((counts[stripId]-1-pixel)*4,(counts[stripId]-pixel)*4));
}
assert.deepEqual(mirrored[5],raw[6]);
assert.deepEqual(mirrored[6],raw[5]);
assert.equal(mirrored[0][0],7);
sampleGameBank(raw,data,manifest,0);
assert.deepEqual(raw.flatMap(row=>[...row]),[...data.subarray(0,stride)]);
sampleGameBank(mirrored,data,manifest,999,true);
assert.equal(mirrored[0][0],12);
console.log('Horizontal Game Mode flip: six lateral strips, side swap, RGBW channel preservation, time interpolation and unchanged raw sampling passed.');
