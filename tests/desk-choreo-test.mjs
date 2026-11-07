// Desk choreography (experience/desk-choreo.mjs), pure parts: every room desk samples its own lift / tilt clips from its
// own start, is held inside its size's limits, survives cleanShot / cleanCut, and the Director's one-desk view of a shot
// reads and writes shot.deskEdits. Plus the stage applier (createDeskChoreo) against a fake scene-desks.
import assert from 'node:assert/strict';
import {cleanDeskClips,cleanDeskChoreo,deskMotion,sampleDeskEdit,sampleDeskEdits,limitDeskPose,deskShotView,putDeskClips,createChoreoTarget,createDeskChoreo,roomDesks,validateDeskEdits,deskLimitNote} from '../experience/desk-choreo.mjs';
import {cleanShot,cleanCut} from '../experience/cuts.mjs';
import {cleanClip,sampleClipMotion} from '../experience/desk-clips.mjs';

const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;
const lift=(id,start,duration,target,easing='linear')=>cleanClip({id,lane:'lift',kind:'lift',start,duration,target,easing});
const tilt=(id,start,duration,target,easing='linear')=>cleanClip({id,lane:'tilt',kind:'tilt',start,duration,target,easing});

// ---- limits: a desk of that size holds only what it can
assert.deepEqual(limitDeskPose({height:20,tilt:-20},'60x30'),{height:28,tilt:-5});
assert.deepEqual(limitDeskPose({height:99,tilt:99},'60x30'),{height:52.5,tilt:65});
assert.ok(near(limitDeskPose({height:28,tilt:65},'48x30').tilt,39),'at 28 in the most is 39 deg');
// 48 in reaches full tilt at 40.5 in, 60 in at 42.5 in
assert.ok(near(limitDeskPose({height:40.5,tilt:65},'48x30').tilt,65));
assert.ok(limitDeskPose({height:40.5,tilt:65},'60x30').tilt<65,'the 60 in desk needs 42.5 in for 65 deg');
assert.ok(near(limitDeskPose({height:42.5,tilt:65},'60x30').tilt,65));
assert.match(deskLimitNote('48x30',30),/48″ desk: 28–52\.5″.*At 30″ it tilts to \d+(\.\d)?° at most/);

// ---- sampling: own start, lanes run together, gaps hold
const clips=[lift('a',1,2,48),tilt('b',2,4,40),lift('c',5,1,30)];
const edit={desk:'desk-2',name:'Desk 2',size:'60x30',clips};
const base={height:30,tilt:0};
let p=sampleDeskEdit(edit,0,base);assert.deepEqual(p,{height:30,tilt:0},'before any clip: the desk start (base)');
p=sampleDeskEdit(edit,2,base);assert.ok(near(p.height,39)&&near(p.tilt,0),'half way up at 2 s: '+JSON.stringify(p));
p=sampleDeskEdit(edit,3,base);assert.ok(near(p.height,48)&&near(p.tilt,10),'lift done, tilt a quarter (3 s)');
p=sampleDeskEdit(edit,4.5,base);assert.ok(near(p.height,48)&&near(p.tilt,25),'gap holds the height');
p=sampleDeskEdit(edit,99,base);assert.ok(near(p.height,30)&&near(p.tilt,40),'after the last clip: lifted down to 30, tilt held');
// ...at 30 in the 60 in desk tilts only to ~39.6 deg: sampled tilt is held to the clearance
assert.ok(p.tilt<=40+1e-9&&p.tilt>=39,'tilt 40 at 30 in is held to the desk clearance, got '+p.tilt);
// initial wins over base
const withInitial={...edit,initial:{height:40,tilt:10}};
p=sampleDeskEdit(withInitial,0,base);assert.deepEqual(p,{height:40,tilt:10},'initial is the start');
// each desk starts from its own pose
const two=[edit,{desk:'desk-3',size:'48x30',clips:[lift('x',0,2,28)]}];
const at1=sampleDeskEdits(two,1,id=>id==='desk-2'?{height:30,tilt:0}:{height:44,tilt:0});
assert.deepEqual(at1.map(d=>d.desk),['desk-2','desk-3']);
assert.ok(near(at1[1].height,36),'desk-3 lowers from its own 44 in toward 28 over 2 s (1 s: 36)');
assert.deepEqual(sampleDeskEdits([{desk:'idle',clips:[]}],1),[],'a desk without clips is not sampled (left as it is)');
// the same clips on both sizes at 28 in: full tilt is cut to 39 on both
for(const size of ['48x30','60x30']){
  const e={desk:'t',size,clips:[tilt('t1',0,2,65)]};
  assert.ok(near(sampleDeskEdit(e,2,{height:28,tilt:0}).tilt,39),size+' at 28 in: 39 deg');
  assert.ok(near(sampleDeskEdit(e,2,{height:44,tilt:0}).tilt,65),size+' at 44 in: 65 deg');
}
// the motion handed to desk-clips matches what the featured desk samples
assert.deepEqual(sampleClipMotion(deskMotion(edit,base),2.5).height,sampleDeskEdit(edit,2.5,base).height);

// ---- cleaning
assert.deepEqual(cleanDeskClips('nope',10),[]);
const wheels=cleanClip({lane:'wheels',kind:'rotate',start:0,duration:2,value:90});
const messy=cleanDeskClips([lift('a',0,2,40),lift('b',1,2,30),wheels,lift('c',9,5,30),tilt('d',0,1,10)],10);
assert.deepEqual(messy.map(c=>c.id).sort(),['a','d'],'overlap, wheels and past-the-end clips are dropped');
const shot=cleanShot({id:'ch',room:'product',seconds:10,deskEdits:[{desk:'desk-2',name:'Desk 2',size:'48 in',clips:[lift('a',1,2,40)],pose:{x:10,z:20,yaw:.5},build:{woodFinish:'Oak'}},{desk:'bad id!',clips:[]},{desk:'desk-3',initial:{height:99,tilt:99},size:'48x30',clips:[]}]});
assert.equal(shot.deskEdits.length,2);
assert.equal(shot.deskEdits[0].size,'48x30');assert.deepEqual(shot.deskEdits[0].pose,{x:10,z:20,yaw:.5},'other fields of an entry pass through');assert.equal(shot.deskEdits[0].build.woodFinish,'Oak');
assert.deepEqual(shot.deskEdits[1].initial,{height:52.5,tilt:65},'initial is held to the size');
const cut=cleanCut({schema:'ergoflex.client-cut',version:1,id:'c',shots:[{id:'ch',room:'product',seconds:10,deskEdits:[{desk:'desk-2',clips:[lift('a',1,2,40)]}]}]});
assert.equal(cut.shots[0].deskEdits[0].clips[0].target,40,'cleanCut keeps the clips (Export cut / drafts)');
assert.equal(cleanShot({id:'x',room:'product',seconds:8}).deskEdits,undefined,'no deskEdits: the shot is as before');
assert.throws(()=>validateDeskEdits([{name:'Desk 2',clips:[lift('a',1,8,40)]}],6),/Desk 2:.*6-second/);

// ---- the Director's one-desk view
const real={id:'ch',seconds:10,size:'60x30',motion:{version:2,initial:{height:28},clips:[]}};
const view=deskShotView(real,{desk:'desk-2',name:'Desk 2',size:'60x30',base:{height:34,tilt:2}});
assert.equal(view.id,'ch~desk-2');assert.equal(view.seconds,10);
assert.deepEqual(view.motion.clips,[]);assert.equal(view.motion.initial.height,34,'the view starts from the desk\'s own pose');
view.motion={version:2,initial:{},clips:[lift('a',1,2,45),tilt('b',0,3,20)]};
assert.equal(real.deskEdits.length,1);assert.equal(real.deskEdits[0].desk,'desk-2');assert.equal(real.deskEdits[0].clips.length,2);assert.equal(real.deskEdits[0].name,'Desk 2');
assert.deepEqual(real.motion.clips,[],'the featured desk\'s motion is untouched');
assert.equal(view.motion.clips.length,2,'reads back what was written');
view.motion={version:2,initial:{},clips:[]};
assert.equal(real.deskEdits,undefined,'no clips left: the entry goes');
real.deskEdits=[{desk:'desk-2',clips:[lift('a',1,2,45)],pose:{x:1,z:2,yaw:0}}];
view.motion={version:2,initial:{},clips:[]};
assert.equal(real.deskEdits.length,1,'an entry that carries DeskSel\'s pose stays when its clips go');assert.equal(real.deskEdits[0].clips.length,0);

// ---- the target: featured by default, back to featured on another chapter or a vanished desk
let rows=[{id:'main',name:'Main',featured:true,size:'60x30',height:30,tilt:0},{id:'desk-2',name:'Desk 2',featured:false,size:'48x30',height:34,tilt:2}];
const state={s:{id:'ch1',seconds:10,motion:{clips:[]}}};
let changed=0;
const target=createChoreoTarget({realShot:()=>state.s,roster:()=>rows,onChange:()=>changed++});
assert.equal(target.desk(),null);assert.equal(target.shot(),state.s,'nothing open: the shot itself');
target.pick('desk-2');assert.equal(target.desk(),'desk-2');assert.equal(changed,1);
assert.equal(target.shot().id,'ch1~desk-2');assert.equal(target.shot().motion.initial.height,34);
target.shot().motion={version:2,initial:{},clips:[lift('a',1,2,45)]};
assert.deepEqual(target.others(),[],'open desk is not listed; the featured has no clips');
state.s.motion={clips:[lift('f',0,2,40)]};
assert.deepEqual(target.others().map(r=>r.label),['Featured desk']);
target.pick(null);assert.equal(target.desk(),null);
assert.deepEqual(target.others().map(r=>[r.id,r.label]),[['desk-2','Desk 2']],'featured open: the desks with clips are listed');
target.pick('desk-2');state.s={...state.s,id:'ch2'};assert.equal(target.desk(),null,'another chapter: the featured desk again');
target.pick('desk-2');rows=[rows[0]];assert.equal(target.desk(),null,'a desk that is not in the room any more');

// ---- the stage applier on a fake scene-desks
const mk=(id,h,t,size='48x30')=>({id,state:{name:id,size,height:h,tilt:t},rig:{calls:[],updatePose(hh,tt){this.calls.push([hh,tt]);}},poseAt:`${h}:${t}`});
const records=new Map([['main',mk('main',30,0,'60x30')],['d2',mk('d2',30,0)],['d3',mk('d3',44,0,'60x30')]]);
const api={sceneDesks:{records,selected:'main',ensureRig(){},objects:{stow:{update(){}}}}};
const choreo=createDeskChoreo(api);
choreo.set([{desk:'d2',size:'48x30',clips:[lift('a',0,2,48)]},{desk:'d3',clips:[lift('b',0,2,28)]},{desk:'main',clips:[lift('m',0,2,50)]},{desk:'gone',clips:[lift('g',0,2,50)]},{desk:'idle',clips:[]}]);
assert.equal(choreo.count(),4);
assert.deepEqual(choreo.apply(1),['d2','d3'],'the featured desk and unknown desks are skipped');
assert.ok(near(records.get('d2').state.height,39)&&near(records.get('d3').state.height,36),'each from its own start');
assert.equal(records.get('main').state.height,30,'the featured desk is never moved');
assert.deepEqual(records.get('d2').rig.calls.at(-1),[39,0],'through the rig');
const calls=records.get('d2').rig.calls.length;choreo.apply(1);assert.equal(records.get('d2').rig.calls.length,calls,'same time: no rig churn');
choreo.apply(2);assert.ok(near(records.get('d2').state.height,48));
assert.deepEqual(roomDesks(api,choreo).map(r=>[r.id,r.featured,r.size,r.height]),[['main',true,'60x30',30],['d2',false,'48x30',30],['d3',false,'60x30',44]],'the picker lists each desk at its own base pose, not the animated one');
choreo.set([{desk:'d3',clips:[lift('b',0,2,28)]}]);
assert.equal(records.get('d2').state.height,30,'a desk that lost its clips goes back to its own pose');
choreo.restore();
assert.equal(records.get('d3').state.height,44,'restore puts every desk back');assert.equal(choreo.count(),0);
console.log('desk choreo test passed');
