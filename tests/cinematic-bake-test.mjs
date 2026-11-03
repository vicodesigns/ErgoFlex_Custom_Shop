import assert from 'node:assert/strict';
import {BakeCache,bakeKey,bakeDefinition,sourceSnapshot,renderBake,BAKE_PROFILE} from '../experience/bake.mjs';
import {muxWebM} from '../experience/webm.mjs';
assert.deepEqual(BAKE_PROFILE,{width:1920,height:1080,fps:30,bitrate:8000000});
const shot={id:'one',room:'product',kind:'hero',seconds:5,title:'Desk'};
assert.equal(await bakeKey(shot,'source'),await bakeKey({...shot},'source'));
assert.notEqual(await bakeKey(shot,'source'),await bakeKey({...shot,seconds:6},'source'));
assert.notEqual(await bakeKey(shot,'source'),await bakeKey(shot,'new-artwork'));
assert.notEqual(await bakeKey(shot,'source'),await bakeKey({...shot,camera:{keys:[{id:'k',time:0,view:{position:[0,1,2],target:[0,0,0]}}]}},'source'));
const entries=[['ergoflex.clientCuts.v1','private cut'],['ergoflex.builds','desk artwork'],['ergoflex.cinematicSeen.v1','1']];
assert.equal(sourceSnapshot({length:3,key:i=>entries[i][0],getItem:key=>entries.find(e=>e[0]===key)[1]}),JSON.stringify([entries[1]]));
const blob=muxWebM([{timestamp:0,key:true,data:new Uint8Array([1,2,3])},{timestamp:33333,key:false,data:new Uint8Array([4,5])}],{width:1280,height:720,fps:30,duration:2/30});
assert.equal(blob.type,'video/webm');const bytes=new Uint8Array(await blob.arrayBuffer());assert.deepEqual([...bytes.slice(0,4)],[0x1a,0x45,0xdf,0xa3]);assert.ok(new TextDecoder().decode(bytes).includes('V_VP8'));
assert.throws(()=>muxWebM([],{width:1,height:1,fps:30,duration:1}),/starting video keyframe/);
const cache=new BakeCache();assert.equal(await cache.get('missing'),null);assert.equal(await cache.put({key:'one',blob,created:1}),false);assert.equal((await cache.get('one')).blob,blob);
await assert.rejects(renderBake({},shot),/cannot bake video/);
// Exercise the encoder loop without WebGL: exact timestamps, backpressure-safe
// frame ownership, cancellation and restoring the live viewport after errors.
const oldEncoder=globalThis.VideoEncoder,oldFrame=globalThis.VideoFrame,oldDoc=globalThis.document;
let closes=0,frames=0,ends=0,samples=[];
class Frame{constructor(canvas,init){this.timestamp=init.timestamp;this.duration=init.duration;frames++;}close(){closes++;}}
class Encoder{static async isConfigSupported(config){return{supported:true,config};}constructor(callbacks){this.callbacks=callbacks;this.state='unconfigured';this.encodeQueueSize=0;}configure(){this.state='configured';}encode(frame,{keyFrame}){this.callbacks.output({timestamp:frame.timestamp,type:keyFrame?'key':'delta',byteLength:1,copyTo:data=>data.set([0])});}async flush(){}close(){this.state='closed';}}
globalThis.VideoEncoder=Encoder;globalThis.VideoFrame=Frame;globalThis.document={createElement:()=>({})};
try{
  const stage={beginBake(){},bakeFrame(t){samples.push(t);},endBake(){ends++;}};
  await renderBake(stage,{...shot,seconds:1},{profile:{...BAKE_PROFILE,fps:4,width:32,height:32}});assert.deepEqual(samples,[0,1/3,2/3,1]);assert.equal(frames,closes);assert.equal(ends,1);
  const controller=new AbortController();await assert.rejects(renderBake(stage,{...shot,seconds:1},{signal:controller.signal,progress:()=>controller.abort(),profile:{...BAKE_PROFILE,fps:4}}),/cancelled/i);assert.equal(ends,2);
  await assert.rejects(renderBake({...stage,bakeFrame(){throw Error('raster failed');}},shot),/raster failed/);assert.equal(ends,3);assert.equal(frames,closes);
}finally{globalThis.VideoEncoder=oldEncoder;globalThis.VideoFrame=oldFrame;globalThis.document=oldDoc;}
console.log('Bake: content invalidation, source isolation, WebM container, cache fallback, timestamped encoding, closed frames, cancel and failure cleanup verified.');
