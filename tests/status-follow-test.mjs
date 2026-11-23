// Status lights follow the desk's moves (experience/status-follow.mjs, status-follow-ui.mjs; wired in director.mjs / desk-editor.mjs).
// Run: node tests/status-follow-test.mjs
//  - derive: the light's kind / wheel mode for every clip kind and direction (the four diagonals included), lift up / down from
//    the height before the clip, tilt retract / extend
//  - link / unlink / link all / enable / disable; found-by-timing links (0.05 s) change nothing until their clip changes
//  - re-derive on move / resize / speed / distance / target / direction / chapter pace / chapter length / delete / clear;
//    idempotence; the round trip back (what undo restores); one state at a time (hand-over)
//  - the film never sees it: every real chapter's film / lighting output is byte-identical before any clip changes, and with
//    every link and unlink; exportLighting drops link / manual
//  - agreement with the importer (tools/experience/build-round8-director.py retime_status) on moved / stretched / reversed / deleted
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cleanClip,cleanClipMotion,putClip,retimeClipBySpeed,sampleClipMotion} from '../experience/desk-clips.mjs';
import {paceChapter,lengthenChapter} from '../experience/chapter-timing.mjs';
import {cleanLighting,exportLighting,validateStatus} from '../experience/film-lighting.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
import {FOLLOW_TOL,TRAVEL_MODE,ROTATE_MODE,clipLightKind,deriveLight,resolveLinks,lightOfClip,syncStatus,enableClipLight,disableClipLight,unlinkEntry,linkEntryToClip,linkAllMatching,unlinkAll,followCounts,followMode,suggestFades,canFollow,followLane,motionSig} from '../experience/status-follow.mjs';
import {clipFollowHtml,followModeHtml,statusInspectorHtml,FOLLOW_MODES} from '../experience/status-follow-ui.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const T=30,close=(a,b,m)=>assert.ok(Math.abs(a-b)<6e-4,`${m}: ${a} vs ${b}`);
const lift=(id,start,duration,target)=>cleanClip({id,lane:'lift',kind:'lift',start,duration,target});
const tilt=(id,start,duration,target)=>cleanClip({id,lane:'tilt',kind:'tilt',start,duration,target});
const travel=(id,start,duration,direction,value=12)=>cleanClip({id,lane:'wheels',kind:'travel',start,duration,direction,value});
const rotate=(id,start,duration,direction,value=90)=>cleanClip({id,lane:'wheels',kind:'rotate',start,duration,direction,value});
const motion=(clips,initial={height:28,tilt:0,x:0,z:0,yaw:0})=>cleanClipMotion({initial,clips},T);
const entry=(id,at,dur,kind,extra={})=>({id,at,dur,kind,fade:1,fadeIn:.6,...extra});
const strip=list=>list.map(({link,manual,...e})=>e);

// ---- 1. derive
{
  const dirs=Object.entries(TRAVEL_MODE);
  assert.deepEqual(Object.fromEntries(dirs),{left:1,right:2,forward:3,backward:4,'forward-left':7,'backward-left':8,'forward-right':9,'backward-right':10});
  for(const [direction,mode] of dirs){
    const c=travel('t',2,3,direction),d=deriveLight(motion([c]),c);
    assert.deepEqual(d,{at:2,dur:3,kind:'wheels',mode},'travel '+direction);
  }
  assert.deepEqual(ROTATE_MODE,{left:5,right:6});
  for(const [direction,mode] of Object.entries(ROTATE_MODE)){const c=rotate('r',4,2.5,direction);assert.deepEqual(deriveLight(motion([c]),c),{at:4,dur:2.5,kind:'wheels',mode},'rotate '+direction);}
  // lift: up when the target is at / above the height before it (the importer's directions()), down below it
  const m=motion([lift('a',1,3,45),lift('b',6,3,30),lift('c',10,2,52),tilt('x',1,3,40),tilt('y',6,3,10),tilt('z',10,2,10)],{height:28,tilt:0,x:0,z:0,yaw:0});
  const k=id=>deriveLight(m,m.clips.find(c=>c.id===id)).kind;
  assert.equal(k('a'),'lift-up');assert.equal(k('b'),'lift-down',' 45 -> 30');assert.equal(k('c'),'lift-up',' 30 -> 52');
  assert.equal(k('x'),'tilt-retract','tilt increasing (steepening) = purple retract');assert.equal(k('y'),'tilt-extend','tilt back toward flat = yellow-green extend');assert.equal(k('z'),'tilt-retract','10 -> 10: at or above = retract, as the importer');
  // the pose before depends on the clips before it: raising the first lift makes the second one a "down"
  const m2=motion([lift('a',1,3,35),lift('b',6,3,40)]);assert.equal(deriveLight(m2,m2.clips[1]).kind,'lift-up');
  const m3=motion([lift('a',1,3,50),lift('b',6,3,40)]);assert.equal(deriveLight(m3,m3.clips[1]).kind,'lift-down');
  // a saved path / hold has none; a lift or tilt "pose" clip does
  assert.equal(canFollow(cleanClip({lane:'wheels',kind:'hold',start:1,duration:2})),false);
  assert.equal(canFollow(cleanClip({lane:'wheels',kind:'pose',start:1,duration:2,target:{x:5,z:5,yaw:0}})),false);
  assert.equal(followLane(cleanClip({lane:'lift',kind:'pose',start:1,duration:2,target:{height:40}})),'lift');
  // a clip's span is its light's span; the chapter end clips it
  assert.deepEqual(deriveLight(motion([lift('a',28.5,1.5,40)]),lift('a',28.5,1.5,40),29),{at:28.5,dur:.5,kind:'lift-up'});
  assert.deepEqual(clipLightKind(travel('t',0,1,'forward')),{kind:'wheels',mode:3});
}

// ---- 2. found by timing, explicit links, manual
{
  const m=motion([lift('a',3.4,4.2,43.5),lift('b',9.45,3.2,28),travel('w',14,3,'forward')]);
  const status=[entry('l1',3.4,4.2,'lift-up'),entry('l2',9.47,3.18,'lift-down'),entry('l3',14,3,'wheels',{mode:3,reverse:true}),entry('off',0,1,'off')];
  const links=resolveLinks(status,m);
  assert.deepEqual([...links].map(([id,l])=>[id,l.clip.id,l.via]),[['l1','a','timing'],['l2','b','timing'],['l3','w','timing']],'found within 0.05 s, off never');
  assert.ok(FOLLOW_TOL===.05);
  // too far apart / the other state / the other mode: not found
  assert.equal(resolveLinks([entry('x',3.46,4.2,'lift-up')],m).size,0,'0.06 s off');
  assert.equal(resolveLinks([entry('x',3.4,4.2,'lift-down')],m).size,0,'colour of the other direction is a hand-set choice');
  assert.equal(resolveLinks([entry('x',14,3,'wheels',{mode:2})],m).size,0,'the other drive mode');
  assert.equal(resolveLinks([entry('x',3.4,4.2,'lift-up',{manual:true})],m).size,0,'manual stays manual');
  // hand-over trimmed lights: an earlier light trimmed where the next light begins still auto-links to its clip
  {
    const hm=motion([tilt('t',9.25,3,-5),lift('l',10.4,5.75,45.5)]);
    const hs=[entry('et',9.25,1.15,'tilt-extend'),entry('el',10.4,5.75,'lift-up')];
    const hl=resolveLinks(hs,hm);
    assert.deepEqual([...hl].map(([id,l])=>[id,l.clip.id,l.via]),[['et','t','timing'],['el','l','timing']],'hand-over-trimmed tilt light auto-links to its tilt clip');
    // moving the lift later lets the trimmed tilt light automatically expand to the new hand-over point
    const moved=putClip(hm,{...hm.clips[1],start:11.5,duration:4.65},T);
    const res=syncStatus(hm,moved,hs,T);
    assert.ok(res.changed,'moving the following lift updates the hand-over');
    assert.equal(res.status.find(e=>e.id==='el').at,11.5);
  }
  // explicit link wins, and a clip has one light
  const s2=[entry('p',20,1,'lift-up',{link:'a'}),entry('q',3.4,4.2,'lift-up')];
  const l2=resolveLinks(s2,m);assert.equal(l2.get('p').clip.id,'a');assert.equal(l2.has('q'),false,'the clip is taken');
  assert.deepEqual(followCounts(status,m),{moves:3,linked:3,explicit:0,found:3,manual:0});
  assert.equal(followMode({},status,m),'follow');assert.equal(followMode({statusLight:false},status,m),'off');
  assert.equal(followMode({},unlinkAll(status,m).status,m),'manual');assert.equal(followMode({},[],m),'follow');
  // link all matching changes nothing but the Director's link field
  const all=linkAllMatching(status,m);assert.equal(all.count,3);assert.deepEqual(strip(all.status),status,'only the link field was added');
  assert.deepEqual(all.status.map(e=>e.link),['a','b','w',undefined]);
  assert.equal(linkAllMatching(all.status,m).count,0,'idempotent');
  assert.equal(linkAllMatching(all.status,m).status,all.status,'and returns the same list');
  // unlink / unlink all
  const un=unlinkEntry(all.status,'l2');assert.equal(un.find(e=>e.id==='l2').manual,true);assert.equal('link' in un.find(e=>e.id==='l2'),false);
  assert.equal(lightOfClip(un,m,'b'),null);assert.equal(lightOfClip(un,m,'a').via,'link');
  assert.equal(unlinkAll(all.status,m).count,3);
  // link a hand-set light to a move: it takes the move's span and state
  const hand=[entry('h',20,1,'lift-down',{manual:true})];
  const lk=linkEntryToClip(hand,m,'h','a',T);assert.deepEqual(strip(lk.status),[{id:'h',at:3.4,dur:4.2,kind:'lift-up',fade:1,fadeIn:.6}]);assert.equal(lk.status[0].link,'a');assert.equal('manual' in lk.status[0],false);
  assert.throws(()=>linkEntryToClip(hand,m,'h','w',T),/same lane/);
  assert.throws(()=>linkEntryToClip([entry('p',3.4,4.2,'lift-up',{link:'a'}),...hand],m,'h','a',T),/already follows/);
}

// ---- 3. enable / disable
{
  const m=motion([lift('a',3,4,45),tilt('t',9,2,40),travel('w',12,3,'forward-left'),rotate('r',16,3,'left')]);
  let st=[];
  for(const id of ['a','t','w','r']){const r=enableClipLight(st,m,id,T,{id:'L-'+id});assert.ok(r.added,id);st=r.status;}
  assert.deepEqual(strip(st),[entry('L-a',3,4,'lift-up'),entry('L-t',9,2,'tilt-retract'),entry('L-w',12,3,'wheels',{mode:7}),entry('L-r',16,3,'wheels',{mode:5})]);
  assert.deepEqual(st.map(e=>e.link),['a','t','w','r']);validateStatus(st,T);
  assert.equal(enableClipLight(st,m,'a',T).added,null,'already on: nothing changes');assert.equal(enableClipLight(st,m,'a',T).status,st);
  assert.throws(()=>enableClipLight(st,motion([cleanClip({lane:'wheels',kind:'hold',start:1,duration:1})]),'x',T),/no status light/);
  const off=disableClipLight(st,m,'w');assert.equal(off.removed.id,'L-w');assert.equal(off.status.length,3);assert.equal(disableClipLight(off.status,m,'w').removed,null);
  // fades: 1 / 0.6 unless every other move light of the chapter agrees on another pair
  assert.deepEqual(suggestFades([]),{fade:1,fadeIn:.6});assert.deepEqual(suggestFades([entry('x',0,1,'lift-up',{fade:.6,fadeIn:.3}),entry('y',2,1,'lift-down',{fade:.6,fadeIn:.3})]),{fade:.6,fadeIn:.3});
  assert.deepEqual(suggestFades([entry('x',0,1,'lift-up',{fade:.6}),entry('y',2,1,'lift-down')]),{fade:1,fadeIn:.6},'a mixed chapter gets the defaults');
  // a light is found for a clip switched on by timing, so the switch shows ON for an existing chapter without any change
  assert.equal(enableClipLight([entry('f',3,4,'lift-up')],m,'a',T).added,null);
  // one state at a time: another light already starts there
  const clash=motion([lift('a',3,4,45),travel('w',3,2,'forward')]);
  assert.throws(()=>enableClipLight([entry('L',3,4,'lift-up',{link:'a'})],clash,'w',T),/already starts at 3/);
  // a later start takes over from an earlier light: the earlier ends there (the importer's hand-over)
  const over=motion([lift('a',3,4,45),travel('w',5,4,'forward')]);
  const r=enableClipLight([entry('L',3,4,'lift-up',{link:'a'})],over,'w',T,{id:'W'});
  assert.deepEqual(strip(r.status).map(e=>[e.id,e.at,e.dur]),[['L',3,2],['W',5,4]]);
}

// ---- 4. the clips change: the light follows (move, resize, speed, distance, target, direction, delete, pace, length)
{
  const clips=[lift('a',3.4,4.2,43.5),tilt('t',9,2,40),travel('w',12,3,'forward'),lift('b',16,3,30)];
  const prev=motion(clips);let st=[];for(const id of ['a','t','w','b']){st=enableClipLight(st,prev,id,T,{id:'L-'+id}).status;}
  const step=(from,to,list=st,seconds=T)=>syncStatus(from,to,list,seconds);
  const at=(list,id)=>list.find(e=>e.id===id);
  // move
  {const next=putClip(prev,{...prev.clips[0],start:4.5},T),r=step(prev,next);assert.ok(r.changed);const e=at(r.status,'L-a');close(e.at,4.5,'moved at');close(e.dur,4.2,'moved dur');assert.equal(e.fadeIn,.6,'fades kept');assert.equal(e.link,'a');
    assert.deepEqual(r.status.filter(x=>x.id!=='L-a'),st.filter(x=>x.id!=='L-a'),'the others are untouched');}
  // resize (both edges)
  {const next=putClip(prev,{...prev.clips[0],start:2.5,duration:6},T),r=step(prev,next),e=at(r.status,'L-a');close(e.at,2.5,'resize at');close(e.dur,6,'resize dur');}
  // speed: retime by speed changes the duration, the light follows
  {const c=prev.clips[0],faster=retimeClipBySpeed(prev,c,8,T),next=putClip(prev,faster,T),r=step(prev,next),e=at(r.status,'L-a');close(e.dur,faster.duration,'speed dur');assert.ok(e.dur<c.duration);}
  // distance (a travel's value) with its speed preset changes the duration; the mode stays
  {const w=prev.clips.find(c=>c.id==='w'),moved=retimeClipBySpeed(prev,{...w,value:36},12,T),next=putClip(prev,moved,T),r=step(prev,next),e=at(r.status,'L-w');close(e.dur,3,'12 in/s over 36 in');assert.equal(e.mode,3);}
  // target: the lift now goes below the height before it: the colour flips
  {const next=putClip(prev,{...prev.clips.find(c=>c.id==='a'),target:28},T),r=step(prev,next);assert.equal(at(r.status,'L-a').kind,'lift-up','28 = 28 is still "at or above"');
    const down=putClip(motion([lift('z',0,1,40),...clips]),{...lift('a',3.4,4.2,43.5),target:30},T);const base=motion([lift('z',0,1,40),...clips]);
    const r2=step(base,down,[entry('L-a',3.4,4.2,'lift-up',{link:'a'})]);assert.equal(at(r2.status,'L-a').kind,'lift-down');}
  // an earlier clip changes the pose before this one: the later light's colour follows (without the later clip being touched)
  {const base=motion([lift('p',1,2,35),lift('q',5,2,40)]),list=[entry('LQ',5,2,'lift-up',{link:'q'})],next=putClip(base,{...base.clips[0],target:50},T),r=step(base,next,list);assert.equal(r.status[0].kind,'lift-down');}
  // direction: a travel turned diagonal, a turn reversed
  {const next=putClip(prev,{...prev.clips.find(c=>c.id==='w'),direction:'backward-right'},T),r=step(prev,next);assert.equal(at(r.status,'L-w').mode,10);}
  {const base=motion([rotate('r',4,2,'left')]),next=putClip(base,{...base.clips[0],direction:'right'},T),r=step(base,next,[entry('L',4,2,'wheels',{mode:5,link:'r'})]);assert.equal(r.status[0].mode,6);}
  // a wheels clip changed into a hold loses its light; a tilt kept as a tilt keeps it
  {const next=putClip(prev,{...prev.clips.find(c=>c.id==='w'),kind:'hold',direction:undefined,value:undefined},T),r=step(prev,next);assert.equal(at(r.status,'L-w'),undefined);assert.match(r.notes.join(' '),/went with its move/);}
  // delete: its light goes, only its light
  {const next={...prev,clips:prev.clips.filter(c=>c.id!=='t')},r=step(prev,next);assert.deepEqual(r.status.map(e=>e.id),['L-a','L-w','L-b']);}
  // clear: all of them
  {const r=step(prev,{...prev,clips:[]});assert.deepEqual(r.status,[]);}
  // chapter pace (20% shorter / 25% longer scale every clip): the lights scale with them
  {const shot={seconds:T,motion:prev},paced=paceChapter(shot,prev,[{id:'k',time:0,view:{}},{id:'k2',time:1,view:{}}],T*.8),r=step(prev,paced.motion,st,paced.seconds);
    for(const c of paced.motion.clips){const e=r.status.find(x=>x.link===c.id);close(e.at,Math.round(c.start*1000)/1000,'paced at '+c.id);close(e.dur,Math.round((Math.round((c.start+c.duration)*1000)/1000-Math.round(c.start*1000)/1000)*1000)/1000,'paced dur '+c.id);}}
  // chapter length: clips keep their absolute times, so nothing changes; a hold at the end changes nothing either
  {const longer=lengthenChapter({seconds:T,motion:prev},prev,[{id:'k',time:0,view:{}},{id:'k2',time:1,view:{}}],T+5);assert.equal(syncStatus(prev,longer.motion,st,T+5).changed,false);}
  // a clip made shorter than its light: clipped to the chapter end
  {const base=motion([lift('a',20,5,45)]),list=[entry('LA',20,5,'lift-up',{link:'a'})];const shorter=cleanClipMotion({initial:base.initial,clips:[{...base.clips[0],start:21,duration:4}]},T);const r=step(base,shorter,list,25);assert.deepEqual([r.status[0].at,r.status[0].dur],[21,4]);}
  // idempotence: re-deriving twice changes nothing, with and without a clip change
  {const next=putClip(prev,{...prev.clips[0],start:5,duration:6},T),once=step(prev,next).status,again=step(next,next,once);assert.equal(again.changed,false);assert.equal(again.status,once);
    const twice=syncStatus(prev,next,once,T);assert.equal(twice.changed,false,'the same change applied to its own result');
    assert.equal(step(prev,prev).changed,false,'nothing changed: nothing written');}
  // the round trip (what Undo restores): move away and back, the lights are what they were
  {const next=putClip(prev,{...prev.clips[0],start:6},T),away=step(prev,next).status,back=step(next,prev,away).status;assert.deepEqual(back,st);}
  // lights set by hand never follow
  {const hand=[...st,entry('H',22,2,'proximity')],next=putClip(prev,{...prev.clips[0],start:5},T),r=step(prev,next,hand);assert.deepEqual(at(r.status,'H'),at(hand,'H'));
    const un=unlinkEntry(st,'L-a'),r2=step(prev,next,un);assert.deepEqual(at(r2.status,'L-a'),at(un,'L-a'),'unlinked: stays');assert.equal(at(r2.status,'L-a').manual,true);}
  // enforcement: a linked light edited away from its move snaps back; a fade edit is kept
  {const drag=st.map(e=>e.id==='L-a'?{...e,at:12,fade:2}:e),r=step(prev,prev,drag),e=at(r.status,'L-a');close(e.at,3.4,'snapped back');assert.equal(e.fade,2,'fade kept');}
}

// ---- 5. found-by-timing links change nothing until their clip changes
{
  const prev=motion([lift('a',3.4,4.2,43.5),lift('b',9.45,3.2,28)]),film=[entry('x',3.43,4.18,'lift-up'),entry('y',9.45,3.2,'lift-down')];
  assert.equal(syncStatus(prev,prev,film,T).status,film,'untouched when nothing changed');
  const other=putClip(prev,{...prev.clips[1],start:11},T),r=syncStatus(prev,other,film,T);
  assert.deepEqual(r.status[0],film[0],'the light of the unchanged clip keeps its slightly different timing, byte for byte');assert.equal(r.status[1].at,11);assert.equal(r.status[1].link,'b');
  const label=putClip(prev,{...prev.clips[0],label:'Raise'},T);assert.equal(syncStatus(prev,label,film,T).changed,false,'a rename changes no light');
}

// ---- 6. hand-over
{
  const prev=motion([lift('a',3,4,45),travel('w',10,3,'forward')]),st=[entry('LA',3,4,'lift-up',{link:'a'}),entry('LW',10,3,'wheels',{mode:3,link:'w'})];
  // the travel is dragged over the lift's tail: the lift's light ends where the travel's starts, the travel keeps its full span
  const next=putClip(prev,{...prev.clips[1],start:5.5},T),r=syncStatus(prev,next,st,T);
  assert.deepEqual(r.status.map(e=>[e.id,e.at,e.dur]),[['LA',3,2.5],['LW',5.5,3]]);validateStatus(r.status,T);
  const back=syncStatus(next,prev,r.status,T);assert.deepEqual(back.status,st,'moving it back gives the lift its full length again');
  // the same start: the earlier lane's light stays, the other is dropped, and says so
  const same=putClip(prev,{...prev.clips[1],start:3},T),rs=syncStatus(prev,same,st,T);assert.deepEqual(rs.status.map(e=>e.id),['LA']);assert.match(rs.notes.join(' '),/covered/);
  // a hand-set light is never trimmed by another hand-set light
  const both=[entry('M1',1,5,'proximity'),entry('M2',3,2,'collision')];assert.equal(syncStatus(prev,prev,both,T).status,both);
}

// ---- 7. the film never sees it
{
  assert.equal(JSON.stringify(exportLighting({ledStatus:[{id:'i',at:1,dur:2,kind:'lift-up',link:'a'},{id:'j',at:4,dur:1,kind:'proximity',manual:true}]}).ledStatus),JSON.stringify([{at:1,dur:2,kind:'lift-up'},{at:4,dur:1,kind:'proximity'}]),'exportLighting drops id, link and manual');
  const c=cleanLighting({ledStatus:[{id:'i',at:1,dur:2,kind:'lift-up',link:'a'},{id:'j',at:4,dur:1,kind:'proximity',manual:true},{id:'k',at:6,dur:1,kind:'off',link:'bad id!'}]}).ledStatus;
  assert.deepEqual(c.map(e=>[e.link,e.manual]),[['a',undefined],[undefined,true],[undefined,undefined]],'cleanLighting keeps link / manual (a safe id only)');
  const sources=[];
  for(const f of ['tests/fixtures/director-film/director-film/awaken.json','tests/fixtures/director-film/director-film/rise.json','exports/cinematic-intro-20261104-hq14/review-cut.json','exports/cinematic-intro-cut-cine/review-cut.json']){
    const file=path.join(root,f);if(!fs.existsSync(file))continue;const d=JSON.parse(fs.readFileSync(file,'utf8'));for(const s of (d.shots||[d]))sources.push([f.split('/').slice(-2).join('/')+' '+s.id,s]);
  }
  assert.ok(sources.length>=14,'fixture chapters found: '+sources.length);
  let withLights=0,linkedFound=0;
  for(const [name,raw] of sources){
    const shot={...raw,...cleanLighting(raw)};
    const out=s=>JSON.stringify([exportLighting(s),filmRenderShot(raw,s,[])]);
    const before=out(shot),status=shot.ledStatus||[];
    if(!raw.motion?.clips?.length)continue;let m;try{m=cleanClipMotion(raw.motion,raw.seconds);}catch{continue;}
    // reading links changes nothing; a sync with no clip change writes nothing
    resolveLinks(status,m);followCounts(status,m);
    const idle=syncStatus(m,m,status,raw.seconds);
    // (a chapter whose lights carry no link: nothing to enforce; the list comes back as it was)
    assert.equal(idle.changed,false,name+': idle sync');assert.equal(idle.status,status,name+': same list');
    // every link / unlink variant: the film's output is byte-identical
    for(const [label,list] of [['link all',linkAllMatching(status,m).status],['unlink all',unlinkAll(status,m).status],['link all then unlink all',unlinkAll(linkAllMatching(status,m).status,m).status]]){
      assert.equal(out(shot.ledStatus?{...shot,ledStatus:list}:shot),before,`${name}: ${label} leaves the film's output byte-identical`);
    }
    if(status.length)withLights++;linkedFound+=followCounts(status,m).found;
    // switching every move's light on then off again: nothing of the Director's fields reach the film either
    let st=status;for(const c of m.clips)if(canFollow(c)){try{st=enableClipLight(st,m,c.id,raw.seconds).status;}catch{}}
    for(const e of st)assert.equal(JSON.stringify(exportLighting({ledStatus:[e]}).ledStatus[0]).includes('link'),false);
  }
  assert.ok(withLights>=8&&linkedFound>=8,`real chapters with lights ${withLights}, found links ${linkedFound}`);
}

// ---- 8. the pieces on screen
{
  const clip=lift('a',3,4,45),m=motion([clip]),d=deriveLight(m,clip);
  const off=clipFollowHtml({clip,on:false,derived:d,statusOff:false});
  assert.match(off,/name="follow-toggle"/);assert.doesNotMatch(off,/\bchecked\b/);assert.match(off,/Would be|would be/);assert.match(off,/Lift up · blue/);
  const on=clipFollowHtml({clip,on:true,entry:entry('L',3,4,'lift-up',{link:'a'}),derived:d,statusOff:false});
  assert.match(on,/name="follow-toggle"[^>]*checked/);assert.match(on,/name="follow-fadein"[^>]*value="0.6"/);assert.match(on,/name="follow-fade"[^>]*value="1"/);assert.match(on,/follows this move/);
  assert.match(clipFollowHtml({clip,on:false,derived:d,statusOff:true}),/Status lights are off for this chapter[\s\S]*data-section="follow"/);
  assert.match(clipFollowHtml({clip:cleanClip({lane:'wheels',kind:'hold',start:1,duration:2}),on:false,derived:null}),/A hold has no status light/);
  const html=followModeHtml({mode:'follow',counts:{moves:4,linked:2,explicit:1,found:1,manual:1},statusEdited:true});
  for(const [id] of FOLLOW_MODES)assert.match(html,new RegExp(`data-section="${id}"`));assert.match(html,/aria-checked="true"[^>]*data-section="follow"|data-section="follow"[^>]*/);assert.match(html,/Link all matching \(1\)/);assert.match(html,/radiogroup/);
  assert.doesNotMatch(followModeHtml({mode:'manual',counts:{moves:4,linked:0,explicit:0,found:0,manual:2},statusEdited:true}),/Link all matching/);
  const link={clip,via:'link'},linked=statusInspectorHtml({e:entry('L',3,4,'lift-up',{link:'a'}),link,seconds:T,clips:[],statusOff:false});
  assert.match(linked,/Follows Lift to 45″/);assert.match(linked,/Unlink to edit by hand/);assert.doesNotMatch(linked,/name="light-at"|name="light-kind"|name="light-dur"/,'timing and state are read-only while linked');assert.match(linked,/name="light-fadein"/);assert.match(linked,/🔗/);
  const hand=statusInspectorHtml({e:entry('L',3,4,'lift-up',{manual:true}),link:null,seconds:T,clips:[{id:'a',label:'Lift to 45″',start:3,duration:4,busy:false},{id:'b',label:'Lift to 30″',start:9,duration:2,busy:true}],statusOff:false});
  assert.match(hand,/name="light-at"/);assert.match(hand,/Linked to a move/);assert.match(hand,/<option value="b"[^>]*disabled/);
  assert.doesNotMatch(statusInspectorHtml({e:entry('L',3,4,'proximity'),link:null,seconds:T,clips:[],statusOff:false}),/Linked to a move/,'proximity / collision / off lights cannot follow a move');
  // wiring
  const dir=fs.readFileSync(path.join(root,'experience/director.mjs'),'utf8'),ed=fs.readFileSync(path.join(root,'experience/desk-editor.mjs'),'utf8');
  assert.match(dir,/function commit\(fn,\{render=false,key=null\}=\{\}\)\{\s*const pre=followSnapshot\(\);/);assert.match(dir,/group=key;fn\(\);followAfter\(pre\);/);
  assert.match(ed,/\$\{!di&&followHtml\?followHtml\(c\):''\}/);
  const css=fs.readFileSync(path.join(root,'experience/status-follow.css'),'utf8'),index=fs.readFileSync(path.join(root,'experience/index.html'),'utf8');
  assert.match(css,/@media \(pointer: coarse\)\{[^}]*follow-toggle,#director-panel \.follow-mode button[^}]*min-height:44px/);assert.ok(index.indexOf('status-follow.css')>index.indexOf('director-shell.css')&&index.indexOf('status-follow.css')<index.indexOf('director-phone.css'),'the sheet is loaded between the shell and the phone sheets');
  const lighting=fs.readFileSync(path.join(root,'experience/film-lighting.mjs'),'utf8');assert.match(lighting,/\(\{id,link,manual,\.\.\.e\}\)=>e/);
}

// ---- 9. agreement with the importer (build-round8-director.py retime_status), on the cases both sides handle
{
  const py=`
import ast,json,sys,copy
src=open(sys.argv[1],encoding='utf-8').read();tree=ast.parse(src);ns={'copy':copy}
want={'directions','retime_status'};names={'LANE_OF','FLIP','EPS'}
for n in tree.body:
    if isinstance(n,ast.FunctionDef) and n.name in want: exec(compile(ast.Module([n],[]),'x','exec'),ns)
    if isinstance(n,ast.Assign) and any(getattr(t,'id',None) in names for t in n.targets): exec(compile(ast.Module([n],[]),'x','exec'),ns)
c=json.loads(sys.argv[2]);out=ns['retime_status'](c['events'],c['old'],c['new'],c['oldT'],c['newT'],c['initial'],lambda *a:None,c['initial'])
print(json.dumps(out))`;
  const script=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'status-follow-')),'retime.py');fs.writeFileSync(script,py);
  const importer=path.join(root,'tools/experience/build-round8-director.py');
  const theirs=(events,old,next,oldT=T,newT=T)=>JSON.parse(execFileSync('python3',['-I',script,importer,JSON.stringify({events:events.map(({link,manual,...e})=>e),old,new:next,oldT,newT,initial:motion([]).initial})]).toString());
  const compare=(label,prevM,nextM,events,newT=T)=>{
    const ours=strip(syncStatus(prevM,nextM,events,newT).status).map(e=>[e.at,e.dur,e.kind,e.mode??null]),them=theirs(events,prevM.clips,nextM.clips,T,newT).map(e=>[e.at,e.dur,e.kind,e.mode??null]);
    assert.deepEqual(ours,them,label);
  };
  const prev=motion([lift('a',3.4,4.2,43.5),lift('b',9.45,3.2,28),tilt('t',14,2,40),travel('w',18,3,'forward')]);
  const ev=[entry('A',3.4,4.2,'lift-up'),entry('B',9.45,3.2,'lift-down'),entry('Tt',14,2,'tilt-retract'),entry('W',18,3,'wheels',{mode:3})];
  compare('moved',prev,putClip(prev,{...prev.clips[0],start:4.4},T),ev);
  compare('stretched',prev,putClip(prev,{...prev.clips[2],duration:4},T),ev);
  compare('resized from the start',prev,putClip(prev,{...prev.clips[1],start:8.45,duration:4.2},T),ev);
  compare('reversed (lift now goes down, tilt now extends)',prev,putClip(putClip(prev,{...prev.clips[0],target:28},T),{...prev.clips[2],target:-5},T),[entry('A',3.4,4.2,'lift-up'),entry('Tt',14,2,'tilt-retract')].map(e=>e));
  compare('deleted',prev,{...prev,clips:prev.clips.filter(c=>c.id!=='b')},ev);
  compare('travel stretched',prev,putClip(prev,{...prev.clips[3],duration:5},T),ev);
}
console.log('status-follow-test: ok');
