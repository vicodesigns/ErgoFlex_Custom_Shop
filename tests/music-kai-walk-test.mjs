// Vico's music chapter (19 Nov 2026): Kai's walk to the middle of the room, the camera's hand-off into his point of view,
// and the chapter's status-light switch. Without a browser.
//   1. statusLight: absent / true is exactly as before (no ledStatus dropped, the movement cue untouched, no field added
//      to any film shot); false drops the chapter's ledStatus states, switches the app's movement cue off and back
//   2. the data path: the cut keeps it, the live and Render-still film shots carry it (true = back to the default),
//      render-cut / render-still pass it to film-fx, film-fx installs and restores it, Export cut / the importer carry it
//   3. the patch (docs/music-kai-walk/patch.json): the walk turns the short way and faces along it, 2-4 steps, clear of
//      the armchair and the coffee table, ends square in front of the desk; only the named fields change (held kept)
//   4. the camera: the move up to the hand-off is the chapter's own (sampled where the patch takes over), the last view
//      is his eyes looking at the desk; the Director's editor keys the same
//   5. the autosave script: backup first, a new -restore entry, the existing entries byte for byte as they were
//   node tests/music-kai-walk-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {statusEvents,statusLightOn,statusLightOff,withStatusLight} from '../tools/experience/film-status-light.mjs';
import {cleanLighting} from '../experience/film-lighting.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
import {patchFilmShot,patchDirectorShot,sampleBaked,merge} from '../tools/studio-state/shot-patch.mjs';
import {writeAutosave,readIndex,readAutosave} from '../tools/studio-state/autosave-store.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const near=(a,b,e)=>Math.abs(a-b)<=e;

// 1. the switch
const states=[{at:6.5,dur:2.7,kind:'wheels',mode:5}];
assert.ok(statusLightOn({})&&statusLightOn({statusLight:true}),'absent / true: on');
assert.deepEqual(statusEvents({ledStatus:states}),states,'absent: the states as they are');
assert.notEqual(statusEvents({ledStatus:states})[0],states[0],'(copies)');
assert.deepEqual(statusEvents({ledStatus:states,statusLight:true}),states);
assert.deepEqual(statusEvents({}),[]);
assert.deepEqual(statusEvents({ledStatus:states,statusLight:false}),[],'false: no states');
const calls=[],app={ledMotionState:{enabled:true},setLedMotionEnabled(v){calls.push(v);this.ledMotionState.enabled=v;}};
const cue=statusLightOff(app);assert.deepEqual(calls,[false]);assert.equal(app.ledMotionState.enabled,false);
cue.restore();assert.deepEqual(calls,[false,true],'the stage\'s own setting back');
const off={ledMotionState:{enabled:false},setLedMotionEnabled(v){calls.push(v);}};calls.length=0;statusLightOff(off).restore();assert.deepEqual(calls,[false,false],'a stage that had it off keeps it off');
assert.equal(statusLightOff({}),null,'an app without the switch: nothing');
// film-fx: only a shot with statusLight:false touches the movement cue; it is put back on clear()
const fx=read('tools/experience/film-fx.mjs');
assert.match(fx,/if \(shot\.statusLight === false\) active\.motionCue = statusLightOff\(api\);/);
assert.match(fx,/active\.motionCue\?\.restore\(\);\n  active = null;/);
assert.match(fx,/\|\| shot\.statusLight === false;\n  if \(!wants\) return null;/,'a shot that only switches the light off still installs');
assert.ok(!/LIVE_FIELDS = \[[^\]]*statusLight/.test(fx),'a change re-installs (not an in-place field)');
assert.match(read('tools/experience/film-status.mjs'),/events = statusEvents\(shot\);/);
// every chapter of the cine cut: no film shot has the field, so nothing renders differently
const cine=JSON.parse(read('exports/cinematic-intro-cut-cine/review-cut.json'));
assert.equal(cine.shots.filter(s=>'statusLight' in s).length,0,'no chapter sets it today');

// 2. the data path
assert.deepEqual(cleanLighting({statusLight:false}).statusLight,false,'the cut keeps false');
assert.deepEqual(cleanLighting({statusLight:true}).statusLight,true,'and true (back to the default)');
assert.ok(!('statusLight' in cleanLighting({statusLight:'no'}))&&!('statusLight' in cleanLighting({})),'junk / absent: no field');
const film={id:'music',room:'gaming',seconds:9.9,ledMode:'media',ledPreset:'full'};
for(const make of [s=>liveFilmShot(film,s),s=>filmRenderShot(film,s,null)]){
  assert.ok(!('statusLight' in make({id:'music',seconds:9.9})),'absent: the film shot has no field');
  assert.equal(make({id:'music',seconds:9.9,statusLight:false}).statusLight,false,'false carried');
  assert.ok(!('statusLight' in make({id:'music',seconds:9.9,statusLight:true})),'true: the default');
  assert.equal(liveFilmShot({...film,statusLight:false},{id:'music',seconds:9.9}).statusLight,false,'the film\'s own kept');
  assert.ok(!('statusLight' in make({id:'music',seconds:9.9,statusLight:true})));
}
assert.deepEqual(withStatusLight({statusLight:false},{statusLight:true}),{});
for(const f of ['tools/experience/render-cut.cjs','tools/experience/render-still.cjs'])assert.match(read(f),/'featuredBuild','statusLight','screenLook'];/,f+' passes it to film-fx');
const py=read('tools/experience/build-round8-director.py');
assert.match(py,/LIGHT_FIELDS = \([^)]*'statusLight'\)/,'Export cut -> the film shot (importer)');
assert.match(py,/elif k == 'statusLight':\n\s+if lighting\[k\] is False: s\[k\] = False\n\s+else: s\.pop\(k, None\)/);
assert.match(read('experience/player.mjs'),/l\.timeOfDay,s\.statusLight,l\.propEdits/,'the live preview re-installs on a change');

// 3. the patch
const patch=JSON.parse(read('docs/music-kai-walk/patch.json'));
assert.equal(patch.chapter,'music');assert.deepEqual(patch.set,{statusLight:false});
const walk=patch.people.cast['kai-gets-up'].walk,P=walk.path;
assert.deepEqual(Object.keys(patch.people.cast['kai-gets-up']),['walk'],'only his walk: no held, no postures, no change, no turn');
assert.deepEqual(P[0],[-1079,1348],'from where his walking placement stands (Vico: [-1079, 1348])');
const yawOf=(a,b)=>Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI,wrap=d=>((d+540)%360)-180;
const first=yawOf(P[0],P[1]);assert.ok(Math.abs(wrap(first-151))<=45,`he stands up and turns the short way: 151 -> ${first.toFixed(1)}`);
for(let i=2;i<P.length;i++)assert.ok(Math.abs(wrap(yawOf(P[i-1],P[i])-yawOf(P[i-2],P[i-1])))<=60,'no sharp corner');
assert.ok(Math.abs(wrap(walk.turn-yawOf(P.at(-2),P.at(-1))))<=90,'the last turn to the desk is under 90 deg');
let L=0;for(let i=1;i<P.length;i++)L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
const want=.70049*.64*1000,steps=Math.max(1,Math.round(L/want))+2;   // room-people-motion.mjs walkPlan, Kai's rig legs
assert.ok(steps>=2&&steps<=4,`${steps} steps`);
const gone=patch.people.when['kai-gets-up'][0];assert.equal(gone[0],7.2,'he still gets up at 7.2 s');assert.ok(gone[1]>walk.start&&gone[1]<=patch.camera.keys.at(-1).at,'gone during the hand-off');
assert.ok(walk.start+steps/walk.pace<=10.5,'he is there by the end of the chapter (give or take the last step)');
// the room (people mm, gaming / house; boxes from the scene probe): the coffee table as the film moved it, the armchair
const table={x0:-563,x1:143,z0:1024,z1:2224},chair=[-1308,1519];
const boxDist=(p,b)=>Math.hypot(Math.max(b.x0-p[0],0,p[0]-b.x1),Math.max(b.z0-p[1],0,p[1]-b.z1));
for(let i=1;i<P.length;i++)for(let u=0;u<=1;u+=.02){const p=[P[i-1][0]+(P[i][0]-P[i-1][0])*u,P[i-1][1]+(P[i][1]-P[i-1][1])*u];
  assert.ok(boxDist(p,table)>=230,`clear of the coffee table at ${p.map(Math.round)}`);if(i>1||u>.3)assert.ok(Math.hypot(p[0]-chair[0],p[1]-chair[1])>=280,'away from the armchair');}
const end=P.at(-1),deskCentre=[-273,-467];   // (the layout's desk x -245, the probe's box centre -301)
assert.ok(Math.abs(end[0]-deskCentre[0])<=120,'square in front of the desk (within 12 cm of its centre line)');assert.equal(walk.turn,180,'facing the desk');
assert.ok(end[1]-deskCentre[1]>=762/2+600&&Math.hypot(end[0],end[1]-650)<=500,'in the middle of the room, clear of the desk');

// merge: objects key by key, the rest of an entry as it was
const entry={key:'kai-gets-up',id:'people-kai-walk',at:[-1079,1348],turn:151,change:{seconds:2.2},walk:{path:[[-1079,1348],[-427,1784]],start:8.4,then:'people-kai-stand-wait'},
  postures:{'people-kai-walk':{held:{item:'game-controller',hand:'both'}}},held:{item:'game-controller'}};
const m=merge(entry,patch.people.cast['kai-gets-up']);
assert.deepEqual(m.walk,{...entry.walk,path:P,pace:walk.pace,turn:180});
assert.deepEqual(m.postures,entry.postures,'postures.*.held kept');assert.deepEqual(m.held,entry.held,'held kept');
assert.deepEqual(m.change,entry.change);assert.equal(m.turn,151);

// 4. the film shot (the cine stand-in at Vico's length, his people) and the camera
const s0=structuredClone(cine.shots[8]);
const people={...structuredClone(s0.people),cast:[structuredClone(entry)],when:{'kai-gets-up':[[7.2,99]],'people-kai-sit-controller':[[0,7.2]]}};
const film0={...s0,people};
const {shot:f1}=patchFilmShot(film0,patch);
assert.equal(f1.statusLight,false);assert.deepEqual(f1.people.cast[0].postures,entry.postures,'held kept in the film shot');
assert.deepEqual(f1.people.when,{...people.when,'kai-gets-up':[[7.2,9.58,.5,.13]]},'his window ends as the camera enters his head (fades in as before: .5 s is the default); the seated window as it was');assert.deepEqual(f1.people.cast[0].walk.path,P);
const T=f1.seconds,from=patch.camera.from;
assert.deepEqual(f1.cameraPlan.keys.filter(k=>k.at<from),s0.cameraPlan.keys.filter(k=>k.at<from),'his story keys before the hand-off untouched');
const was=sampleBaked(s0.camera.keys,from,T),now=sampleBaked(f1.camera.keys,from,T);
for(let i=0;i<3;i++){assert.ok(near(was.position[i],now.position[i],2e-3),'the camera is where it was at the hand-off');assert.ok(near(was.target[i],now.target[i],2e-3));}
for(const t of [0,2,4.9])assert.deepEqual(sampleBaked(f1.camera.keys,t,T).position.map(v=>+v.toFixed(2)),sampleBaked(s0.camera.keys,t,T).position.map(v=>+v.toFixed(2)),`the move before the cut (${t} s) as it was`);
const last=f1.cameraPlan.keys.at(-1);assert.equal(last.at,T,'the last view holds to the end');
const K=.0015087,eye=[K*end[1],-K*end[0]],pov=patch.camera.keys.at(-1);
assert.ok(Math.hypot(pov.position[0]-eye[0],pov.position[2]-eye[1])<=.35,'his eyes (within 0.23 m, just in front of them)');
assert.ok(pov.position[1]>1.25*1000*K&&pov.position[1]<1.5*1000*K,'at a standing eye height');
assert.ok(pov.target[0]<pov.position[0]-1&&near(pov.target[2],pov.position[2],.05),'looking straight at the desk');
// the Director's editor keys (plan-NN, time 0..1)
const ed=s0.cameraPlan.keys.map((k,i)=>({id:'plan-'+i,time:k.at/s0.seconds,label:k.label,easing:i===0||i===s0.cameraPlan.keys.length-1?'smooth':'linear',view:{position:k.position,target:k.target,fov:k.fov,aspect:16/9}}));
const dshot={id:'music',seconds:s0.seconds,camera:{keys:ed},peopleEdits:{v:2,...people},motion:s0.motion};
const {shot:d1,notes}=patchDirectorShot(dshot,patch,{filmPlan:s0.cameraPlan});
assert.equal(d1.statusLight,false);assert.deepEqual(d1.peopleEdits.cast[0].postures,entry.postures);assert.equal(d1.peopleEdits.v,2);
assert.deepEqual(d1.camera.keys.filter(k=>k.time*T<from),ed.filter(k=>k.time*T<from),'his editor keys before the hand-off untouched (ids too)');
assert.ok(d1.camera.keys.filter(k=>/^kai-walk-/.test(k.id)).length===patch.camera.keys.length+2,'the hand-off key, the patch\'s keys and the hold');
const dv=d1.camera.keys.find(k=>k.id==='kai-walk-0').view;for(let i=0;i<3;i++)assert.ok(near(dv.position[i],was.position[i],5e-3),'the Director\'s hand-off key is the film\'s camera there');
assert.ok(notes.length);
assert.throws(()=>patchDirectorShot({...dshot,peopleEdits:undefined},patch),/no cast/,'no people edits: refused, not invented');
assert.throws(()=>patchFilmShot({...film0,people:{...people,cast:[{...entry,at:[0,0]}]}},patch),/stands at/,'he is not where the walk starts: refused');

// 5. the autosave script on a synthetic folder
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'music-kai-walk-')),cutName='cinematic-intro-cut-test',dir=path.join(tmp,'exports','director-autosaves',cutName,'music');
try{
  const project=n=>({id:'p',shots:[{...structuredClone(dshot),title:'v'+n}]});
  writeAutosave(tmp,{cut:cutName,chapter:'music',reason:'edit',project:project(1)},new Date(Date.now()-60000));
  writeAutosave(tmp,{cut:cutName,chapter:'music',reason:'edit',project:project(2)},new Date(Date.now()-30000));
  const before=Object.fromEntries(fs.readdirSync(dir).map(f=>[f,fs.readFileSync(path.join(dir,f))]));
  const script=path.join(root,'tools','studio-state','autosave-patch.mjs'),patchPath=path.join(root,'docs','music-kai-walk','patch.json');
  const dry=execFileSync(process.execPath,[script,'--autosave',dir,'--patch',patchPath,'--dry-run'],{encoding:'utf8'});
  assert.match(dry,/dry run/);assert.deepEqual(fs.readdirSync(path.dirname(dir)).sort(),['music'],'dry run: no backup');assert.equal(fs.readdirSync(dir).length,3);
  const out=execFileSync(process.execPath,[script,'--autosave',dir,'--patch',patchPath],{encoding:'utf8'});
  const backups=fs.readdirSync(path.dirname(dir)).filter(f=>/^music-backup-\d{8}-\d{6}$/.test(f));assert.equal(backups.length,1,out);
  for(const [f,b] of Object.entries(before)){assert.ok(fs.readFileSync(path.join(path.dirname(dir),backups[0],f)).equals(b),'backup = the folder before');if(f!=='index.json')assert.ok(fs.readFileSync(path.join(dir,f)).equals(b),'existing entries untouched: '+f);}
  const index=readIndex(dir);assert.equal(index.length,3);assert.match(index[0].file,/-restore\.json\.gz$/);assert.equal(index[0].reason,'restore');
  const restored=readAutosave(tmp,cutName,'music',index[0].file),ch=restored.shots[0];
  assert.equal(ch.title,'v2','patched from the NEWEST entry');assert.equal(ch.statusLight,false);assert.deepEqual(ch.peopleEdits.cast[0].walk.path,P);
  assert.deepEqual(ch.peopleEdits.cast[0].postures,entry.postures,'held kept through the autosave');
  assert.deepEqual(JSON.parse(zlib.gunzipSync(before[index[1].file]).toString()).shots[0].title,'v2');
  // refuses a folder that is not an autosave chapter, or another chapter
  assert.throws(()=>execFileSync(process.execPath,[script,'--autosave',tmp,'--patch',patchPath],{stdio:'pipe'}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log('music-kai-walk-test: ok');
