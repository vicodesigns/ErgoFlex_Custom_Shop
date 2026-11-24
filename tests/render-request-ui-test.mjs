// Render inspector & quick-menu quality settings (experience/render-request.mjs):
// 30 / 60 fps, HEVC 10-bit / H.264 / both, resolution persistence across reloads, estimate scaling, and quick-chapter send.
import assert from 'node:assert/strict';
import {RESOLUTIONS,FPS_OPTIONS,FORMATS,DEFAULTS,cleanSettings,loadSettings,saveSettings,estimateMinutes,makeRequest,createRenderRequest} from '../experience/render-request.mjs';

function memStorage(){
  const map=new Map();
  return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),map};
}
function stubPanel(){
  const listeners={};
  return {
    addEventListener:(ev,fn)=>{(listeners[ev]??=[]).push(fn);},
    emit:(ev,e)=>{for(const fn of listeners[ev]||[])fn(e);},
    querySelector:()=>null,
  };
}

// 1. Defaults & sanitization
assert.deepEqual(RESOLUTIONS,['480p','720p','1080p','4K']);
assert.deepEqual(FPS_OPTIONS,[30,60]);
assert.deepEqual(FORMATS.map(f=>f[0]),['both','hevc','h264']);
assert.deepEqual(cleanSettings(null),DEFAULTS);
assert.deepEqual(cleanSettings({resolution:'8K',fps:99,format:'avi'}),DEFAULTS);
assert.deepEqual(cleanSettings({resolution:'4K',fps:'30',format:'hevc'}),{resolution:'4K',fps:30,format:'hevc'});

// 2. Estimates: 30 fps is half of 60 fps
assert.equal(estimateMinutes({scope:'film',resolution:'720p',fps:60}),40);
assert.equal(estimateMinutes({scope:'film',resolution:'720p',fps:30}),20);
assert.equal(estimateMinutes({scope:'film',resolution:'4K',fps:60}),120);
assert.equal(estimateMinutes({scope:'film',resolution:'4K',fps:30}),60);

// 3. Persistence across browser reloads & live syncing
const storage=memStorage();
assert.deepEqual(loadSettings(storage),DEFAULTS);
assert.equal(saveSettings(storage,{resolution:'1080p',fps:30,format:'h264'}),true);
assert.deepEqual(loadSettings(storage),{resolution:'1080p',fps:30,format:'h264'});

let changedCount=0,lastStatus='';
const downloads=[];
const panel1=stubPanel();
const rr1=createRenderRequest({
  panel:panel1,
  chapters:()=>[{id:'rise',seconds:24}],
  shot:()=>({id:'rise',seconds:24}),
  signature:()=>'sig-1',
  unexported:()=>false,
  exportNow:async()=>null,
  status:m=>{lastStatus=m;},
  escape:s=>String(s??''),
  storage,
  now:()=>new Date('2026-11-23T22:00:00.000Z'),
  download:(name,text)=>downloads.push({name,req:JSON.parse(text)}),
  settle:0,
  changed:()=>{changedCount++;},
});
// Loaded remembered settings from storage
assert.deepEqual(rr1.settings(),{resolution:'1080p',fps:30,format:'h264',summary:'1080p · 30 fps · H.264'});
const html1=rr1.panel();
assert.match(html1,/<option value="1080p" selected>/);
assert.match(html1,/<option value="30" selected>/);
assert.match(html1,/<option value="h264" selected>/);

// Changing quality via quick button updates form, persists, and notifies
rr1.setQuality({resolution:'4K',fps:60,format:'hevc'},{announce:true});
assert.equal(changedCount,1);
assert.match(lastStatus,/4K · 60 fps · HEVC 10-bit/);
assert.deepEqual(loadSettings(storage),{resolution:'4K',fps:60,format:'hevc'});

// Quick chapter send overrides scope='film' cleanly without mutating form.scope
rr1.form.scope='film';
rr1.form.force=true;
await rr1.send({scope:'chapter'});
assert.equal(rr1.form.scope,'film','quick chapter send does not overwrite inspector scope');
assert.equal(downloads.length,1);
assert.equal(downloads[0].req.scope,'chapter');
assert.equal(downloads[0].req.chapter,'rise');
assert.equal(downloads[0].req.resolution,'4K');
assert.equal(downloads[0].req.fps,60);
assert.equal(downloads[0].req.format,'hevc');
assert.equal(downloads[0].req.force,undefined,'chapter quick send never sets film force');

// Fresh instance (simulated browser reload) remembers 4K · 60 fps · hevc (and resets scope to chapter)
const rr2=createRenderRequest({
  panel:stubPanel(),
  chapters:()=>[{id:'rise',seconds:24}],
  shot:()=>({id:'rise',seconds:24}),
  signature:()=>'sig-2',
  unexported:()=>false,
  exportNow:async()=>null,
  status:()=>{},
  escape:s=>String(s??''),
  storage,
  download:()=>{},
  settle:0,
});
assert.equal(rr2.form.scope,'chapter','scope resets safely to chapter on reload');
assert.deepEqual(rr2.settings(),{resolution:'4K',fps:60,format:'hevc',summary:'4K · 60 fps · HEVC 10-bit'});
assert.equal(rr2.recent()[0].fps,60);
assert.equal(rr2.recent()[0].format,'hevc');

// makeRequest defaults legacy callers cleanly
const defReq=makeRequest({scope:'film',chapter:'hero',resolution:'720p',note:'',created:new Date('2026-11-23T22:00:00.000Z'),signature:'0123456789abcdef',exportSha:null,estimate:40,force:false});
assert.equal(defReq.fps,60);
assert.equal(defReq.format,'both');

console.log('render-request-ui-test: ok');
