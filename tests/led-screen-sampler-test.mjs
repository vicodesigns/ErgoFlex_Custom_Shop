import assert from 'node:assert/strict';
import {sampleScreenColours} from '../led-screen-sampler.mjs';
import {createLedFrame,LED_STRIPS} from '../led-strip-map.mjs';
const width=160,height=90,data=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set(x<width/2?[255,0,0,255]:[0,0,255,255],(y*width+x)*4);
const frame=createLedFrame();sampleScreenColours(frame,{data,width,height},{mode:'full'});
for(const strip of LED_STRIPS.filter(s=>![5,6].includes(s.id))){
 const row=frame[strip.id],left=(strip.reverse?strip.count-1:0)*4,right=(strip.reverse?0:strip.count-1)*4;
 assert.deepEqual([...row.slice(left,left+4)],[255,0,0,0]);assert.deepEqual([...row.slice(right,right+4)],[0,0,255,0]);
}
assert.equal(frame[5][0],255);assert.equal(frame[5][2],0);assert.equal(frame[6][0],0);assert.equal(frame[6][2],255);
sampleScreenColours(frame,{data,width,height},{mode:'calm'});assert.equal(frame[5][0],64);
sampleScreenColours(frame,{data,width,height},{mode:'full',audio:0});assert.equal(frame[5][0],166);
sampleScreenColours(frame,{data,width,height},{mode:'full',audio:.2});assert.equal(frame[5][0],255);
data.fill(0);sampleScreenColours(frame,{data,width,height},{mode:'full'});assert.ok(frame.every(r=>r.every(v=>v===0)),'Black screen remains black');
console.log('Screen regions, electrical directions, preset gain, audio response and black-frame sampling passed.');
