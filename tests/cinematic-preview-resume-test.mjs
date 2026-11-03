import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resumePreviewTime} from '../experience/preview-transport.mjs';
const source=fs.readFileSync(new URL('../experience/player.mjs',import.meta.url),'utf8');
const body=source.split('async previewRange(value,i,range){')[1].split('\n    },')[0];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function run({elapsed=4,playing=false,rangeId='desk-a',prepared=true}={}){
 const calls=[],shot={id:'shot',seconds:10},value={shots:[shot]};
 const state={busy:false,playing,index:0,previewRange:{id:rangeId,start:2,end:6},preparedShot:prepared?JSON.stringify(shot):'',activeBake:null,previewOnly:false,finished:false};
 const dependencies={resumePreviewTime,performance:{now:()=>100},clock:{seconds:()=>elapsed,seek:t=>calls.push(['seek',t]),setRunning:()=>{}},document:{hidden:false},stage:()=>({edit:()=>{},pause:()=>{},tick:()=>{}}),frame:{},director:{progress:()=>{},transportChanged:()=>{}},$:()=>({}),syncAudio:()=>{},applyClient:()=>{},playShot:async(i,opts)=>calls.push(['load',opts.position]),toggleChapter:async()=>calls.push(['pause'])};
 const execute=new AsyncFunction('state','deps','value',`with(state){with(deps){return await (async function(value,i,range){${body}})(value,0,{id:'desk-a',start:2,end:6});}}`);
 await execute(state,dependencies,value);return calls;
}
assert.deepEqual(await run(),[['seek',4]]);
assert.deepEqual(await run({playing:true}),[['pause']]);
assert.deepEqual(await run({elapsed:6}),[['seek',2]]);
assert.deepEqual(await run({rangeId:'desk-b'}),[['seek',2]]);
assert.deepEqual(await run({prepared:false}),[['load',.2]]);
console.log('Player integration: pause/resume selected range, replay after end, switch range, reload changed chapter only.');
