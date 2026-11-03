import {cleanShot} from './cuts.mjs';
import {muxWebM} from './webm.mjs';
export const BAKE_VERSION='ergoflex-render-20261027-ergo-intro-v5';
export const BAKE_PROFILE={width:1920,height:1080,fps:30,bitrate:8000000};
export function bakeDefinition(shot){return JSON.stringify(cleanShot(shot));}
export function sourceSnapshot(storage){
  try{return JSON.stringify(Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k&&/build|artwork|scene(?:Desk|Assets|Screen|Palette)|part(?:Editor|Config|Material)/i.test(k)&&!/clientCuts|cinematicBake/i.test(k)).sort().map(k=>[k,storage.getItem(k)]));}catch{return 'storage-unavailable';}
}
export async function bakeKey(shot,source){const value=JSON.stringify([BAKE_VERSION,BAKE_PROFILE,JSON.parse(bakeDefinition(shot)),source]);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');}
export class BakeCache{
  constructor(){this.protectedKeys=new Set();this.memory=new Map();this.db=null;this.opening=null;}
  protect(keys){this.protectedKeys=new Set(keys);}
  async open(){if(this.opening)return this.opening;return this.opening=new Promise(resolve=>{if(typeof indexedDB==='undefined'){resolve(null);return;}const request=indexedDB.open('ergoflex.cinematicBakes.v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('clips',{keyPath:'key'});request.onsuccess=()=>resolve(this.db=request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);});}
  async get(key){if(this.memory.has(key))return this.memory.get(key);const db=await this.open();if(!db)return null;return new Promise(resolve=>{const r=db.transaction('clips').objectStore('clips').get(key);r.onsuccess=()=>{const value=r.result||null;if(value)this.memory.set(key,value);resolve(value);};r.onerror=()=>resolve(null);});}
  async put(record){this.memory.set(record.key,{...record,persisted:false});const db=await this.open();if(!db)return false;try{await new Promise((resolve,reject)=>{const tx=db.transaction('clips','readwrite'),store=tx.objectStore('clips'),r=store.getAll();r.onsuccess=()=>{const existing=r.result.filter(x=>x.key!==record.key).sort((a,b)=>a.created-b.created);let total=record.blob.size+existing.reduce((n,c)=>n+c.blob.size,0);while(existing.length&&(total>256*1024*1024||existing.length>=30)){const removable=existing.findIndex(x=>!this.protectedKeys.has(x.key));if(removable<0)break;const [old]=existing.splice(removable,1);total-=old.blob.size;store.delete(old.key);this.memory.delete(old.key);}store.put({...record,persisted:true});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});this.memory.set(record.key,{...record,persisted:true});return true;}catch{return false;}}
}
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const abort=signal=>{if(signal?.aborted)throw new DOMException('Bake cancelled.','AbortError');};
export async function renderBake(stage,shot,{signal,progress=()=>{},profile=BAKE_PROFILE}={}){
  if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined')throw Error('This browser cannot bake video. Live playback is still available.');
  const config={codec:'vp8',width:profile.width,height:profile.height,framerate:profile.fps,bitrate:profile.bitrate,latencyMode:'quality'};
  const supported=await VideoEncoder.isConfigSupported(config);if(!supported.supported)throw Error('VP8 video encoding is unavailable in this browser.');
  const frames=[],count=Math.max(2,Math.ceil(shot.seconds*profile.fps));let failure=null,total=0,started=false;
  const encoder=new VideoEncoder({output:chunk=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);total+=data.length;if(total>100*1024*1024){failure=new Error('The rendered chapter exceeds 100 MB. Shorten it and bake again.');return;}frames.push({timestamp:chunk.timestamp,key:chunk.type==='key',data});},error:error=>{failure=error;}});
  const canvas=document.createElement('canvas');canvas.width=profile.width;canvas.height=profile.height;
  try{
    abort(signal);encoder.configure(supported.config);started=true;await stage.beginBake(profile.width,profile.height);
    for(let i=0;i<count;i++){
      abort(signal);if(failure)throw failure;
      await stage.bakeFrame(i/(count-1),canvas,i/profile.fps);
      const timestamp=Math.round(i*1e6/profile.fps),duration=Math.min(Math.round(1e6/profile.fps),Math.round(shot.seconds*1e6)-timestamp);
      const frame=new VideoFrame(canvas,{timestamp,duration,alpha:'discard'});
      try{encoder.encode(frame,{keyFrame:i%(profile.fps*2)===0});}finally{frame.close();}
      if(i%3===0){progress((i+1)/count);await yieldTask();}
      while(encoder.encodeQueueSize>6){abort(signal);if(failure)throw failure;await yieldTask();}
    }
    await encoder.flush();abort(signal);if(failure)throw failure;progress(1);
    return muxWebM(frames,{...profile,duration:shot.seconds});
  }finally{if(encoder.state!=='closed')encoder.close();if(started)stage.endBake();}
}
