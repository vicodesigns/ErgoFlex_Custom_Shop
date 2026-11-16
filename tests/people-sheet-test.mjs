// S33 (A2): the People keyframe sheet's model (experience/people-track.mjs sheet & co) on the Cinematographer's cut:
// rows and property keys, multi-key moves (what is linked, all or nothing), delete, copy / paste, the ◆ at the
// playhead, interpolation, Bend / Twist / Side. Pure: node tests/people-sheet-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sheet,sheetKeys,programmedDiamonds,pick,neighborTime,shiftKeys,deleteKeys,copyKeys,pasteKeys,setEase,toggleKeyAt,entryAt,turnAngles,anglesTurn,setJointAngles,waypointOf,setWaypoint,EASE_SHAPES} from '../experience/people-track.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-cine/review-cut.json'),'utf8'));
const shot=id=>cut.shots.find(s=>s.id===id);
const oil=shot('oilers'),T=oil.seconds,P=oil.people,frozen=JSON.stringify(P);
const rows=sheet(P,T),keys=sheetKeys(rows),row=n=>rows.find(r=>r.row===n),id=s=>{const k=keys.get(s);assert.ok(k,'no key '+s+' in '+[...keys.keys()].filter(x=>x.includes(s.split('|')[1])).join(', '));return k;};
// ---- rows: the same characters as the programmed track; every programmed diamond is a key of one property row
assert.deepEqual(rows.map(r=>r.row),programmedDiamonds(P,T).rows.map(r=>r.row));
const all=rows.flatMap(r=>[...r.props.screen,...r.props.path.filter(k=>!k.linked),...r.props.actions]);
assert.equal(all.length,programmedDiamonds(P,T).diamonds.length,'every programmed diamond once (a merged set-off also on Path)');
const kai=row('kai'),noah=row('noah');
assert.deepEqual(kai.props.screen.map(k=>k.kind),['change'],'Kai: the change to typing');
assert.equal(kai.props.path[0].kind,'roll-start');assert.equal(kai.props.path.at(-1).kind,'roll-end');
assert.deepEqual(kai.bars.map(b=>[b.entry,b.t0,b.t1]),[['kai-rolls',0,12.75],['kai',12.75,T]],'On screen: a bar per placement');
assert.deepEqual(noah.props.actions.map(k=>[k.kind,k.t]),[['act',5.4],['act-end',6.5],['act',8.2]]);
assert.deepEqual(noah.actBars.map(b=>[b.entry,b.t0,Math.round(b.t1*100)/100]),[['noah-pulls',5.4,6.5],['noah-taps',8.2,8.2]]);
// noah-steps walks from 3.9; his placement starts at 3.2: a set-off of its own. The summary has every key time.
assert.ok(noah.props.path.some(k=>k.kind==='walk-start'&&k.t===3.9&&!k.linked));
for(const r of rows)for(const l of Object.values(r.props))for(const k of l)assert.ok(r.summary.includes(k.t),'summary has '+k.id);
// storage: Andre steps back (his walk); a walk that starts as its placement comes in is that edge's key (linked)
const st=shot('storage'),sr=sheet(st.people,st.seconds),andre=sr.find(r=>r.row==='andre');
assert.ok(andre.props.path.some(k=>k.kind==='walk-start')&&andre.props.path.some(k=>k.kind==='walk-end'),'Andre walks');
{const L=structuredClone(st.people),e=L.cast.find(x=>x.key==='andre-steps-back');e.walk.start=L.when['andre-steps-back'][0][0];
 const so=sheet(L,st.seconds).find(r=>r.row==='andre').props.path.find(k=>k.kind==='walk-start');assert.ok(so?.linked&&so.d.kind==='change'&&so.t===4,'a set-off at the change is that change, linked');}
assert.equal(andre.bars.length,9,'nine placements on screen');
// ---- selection
let s=pick(new Set(),['a']);s=pick(s,['b'],{toggle:true});assert.deepEqual([...s],['a','b']);s=pick(s,['a'],{toggle:true});assert.deepEqual([...s],['b']);
assert.deepEqual([...pick(s,['c','d'],{add:true})],['b','c','d']);assert.deepEqual([...pick(s,['c'])],['c']);
assert.equal(neighborTime([1,2,3],2,-1),1);assert.equal(neighborTime([1,2,3],2,1),3);assert.equal(neighborTime([1,2,3],3,1),undefined);
// ---- moves: one key, several keys, linked fields only, all or nothing
const diff=(a,b)=>{const out=[];for(let i=0;i<a.cast.length;i++)if(JSON.stringify(a.cast[i])!==JSON.stringify(b.cast[i]))out.push(a.cast[i].key);if(JSON.stringify(a.when)!==JSON.stringify(b.when))out.push('when');return out;};
let r=shiftKeys(P,[id('act|noah-taps|0')],.4,T);assert.deepEqual(diff(r.people,P),['noah-taps']);assert.equal(r.people.cast.find(e=>e.key==='noah-taps').act.at,8.6);
// the screen pull bar moved (act + its end): the length is kept
r=shiftKeys(P,[id('act|noah-pulls|0'),id('act-end|noah-pulls|0')],-.3,T);const pull=r.people.cast.find(e=>e.key==='noah-pulls').act;assert.deepEqual([pull.at,pull.dur],[5.1,1.1]);
// the walk: set-off and arrival together = the walk moves, its pace stays
const ns=P.cast.find(e=>e.key==='noah-steps');r=shiftKeys(P,noah.props.path,.5,T);const ns2=r.people.cast.find(e=>e.key==='noah-steps');
assert.deepEqual([ns2.walk.start,ns2.walk.pace],[ns.walk.start+.5,ns.walk.pace],'a whole walk moved keeps its pace');assert.deepEqual(diff(r.people,P),['noah-steps']);
// Kai: the change and the roll's arrival moved later together
r=shiftKeys(P,[id('change|kai-rolls|0'),kai.props.path.at(-1)],.5,T);assert.ok(!r.error,r.error);
assert.deepEqual([r.people.when['kai-rolls'][0][1],r.people.when.kai[0][0]],[13.25,13.25]);
const end2=programmedDiamonds(r.people,T).diamonds.find(d=>d.key==='kai-rolls'&&d.kind==='roll-end');assert.ok(Math.abs(end2.t-(kai.props.path.at(-1).t+.5))<.05,'the arrival moved too: '+end2.t);
// Noah's chain of placements all moved later by 1 s: the later edges first, so none of them runs into the next
const chain=noah.props.screen;r=shiftKeys(P,chain,1,T);assert.ok(!r.error,r.error);
assert.deepEqual(chain.map(k=>{const [kind,key,span]=k.id.split('|');return r.people.when[key][span][kind==='in'?0:1];}),chain.map(k=>k.t+1));
r=shiftKeys(P,chain,-1,T);assert.ok(!r.error,r.error);
// refused: past the end of the chapter, or an edge past the next one; the people given never change
assert.ok(shiftKeys(P,[id('act|noah-taps|0')],10,T).error);
assert.ok(shiftKeys(P,[id('change|noah-talks|0')],5,T).error,'a change past the next placement\'s end');
assert.equal(JSON.stringify(P),frozen,'the input is never changed');
// delete: the programmed motion's own keys are not deleted; a waypoint is
r=deleteKeys(P,[id('act|noah-taps|0'),id('change|kai-rolls|0')]);assert.equal(r.removed,0);assert.equal(r.skipped.length,2);
const wp=kai.props.path.find(k=>k.kind==='roll-point');r=deleteKeys(P,[wp]);assert.equal(r.removed,1);
assert.equal(r.people.cast.find(e=>e.key==='kai-rolls').roll.path.length,P.cast.find(e=>e.key==='kai-rolls').roll.path.length-1);
// ---- pose keys (media: Omar, keyed here as pose mode keys him)
const media=shot('media'),M=structuredClone(media.people),omar=M.cast.find(e=>e.key==='omar');
const q=a=>anglesTurn(a).map(v=>Math.round(v*1e4)/1e4);
omar.poseKeys=[{t:2,pose:{lowerarm_l:q([30,0,0]),head:q([0,10,0])}},{t:5,pose:{lowerarm_l:q([-10,0,0])},ease:'hold'},{t:9,pose:{head:q([0,-20,0])},ease:'linear'}];
const mr=sheet(M,media.seconds,{jointOrder:['head','lowerarm_l']}),om=mr.find(r=>r.row==='omar'),mk=sheetKeys(mr),K=s=>{const k=mk.get(s);assert.ok(k,'no '+s);return k;};
assert.deepEqual(om.props.pose.map(k=>[k.t,k.ease]),[[2,'smooth'],[5,'hold'],[9,'linear']]);
assert.deepEqual(om.joints.map(j=>[j.bone,j.keys.map(k=>k.t)]),[['head',[2,9]],['lowerarm_l',[2,5]]],'a row per keyed joint, in the order given');
assert.deepEqual(om.bars.map(b=>[b.t0,b.t1]),[[0,media.seconds]],'on screen the whole chapter (no when)');
assert.deepEqual([EASE_SHAPES.linear,EASE_SHAPES.smooth,EASE_SHAPES.hold],['diamond','circle','square']);
// move two whole keys by +1 (5 -> 6, 9 -> 10); one joint (head at 2) to 3
r=shiftKeys(M,[K('pose|omar|5'),K('pose|omar|9')],1,media.seconds);let ok=r.people.cast[0].poseKeys;
assert.deepEqual(ok.map(k=>[k.t,k.ease||'smooth']),[[2,'smooth'],[6,'hold'],[10,'linear']],'keys carry their ease');assert.equal(r.ids.get('pose|omar|5'),'pose|omar|6');
r=shiftKeys(M,[K('pose|omar|2|head')],1,media.seconds);ok=r.people.cast[0].poseKeys;
assert.deepEqual(ok.map(k=>[k.t,Object.keys(k.pose).sort().join()]),[[2,'lowerarm_l'],[3,'head'],[5,'lowerarm_l'],[9,'head']]);
// moving keys over each other (2 -> 5, 5 -> 8): no merge between the moved ones
r=shiftKeys(M,[K('pose|omar|2'),K('pose|omar|5')],3,media.seconds);assert.deepEqual(r.people.cast[0].poseKeys.map(k=>k.t),[5,8,9]);
// onto a key that stays: merges (the moved joints win)
r=shiftKeys(M,[K('pose|omar|5')],4,media.seconds);ok=r.people.cast[0].poseKeys;assert.deepEqual(ok.map(k=>k.t),[2,9]);assert.deepEqual(Object.keys(ok[1].pose).sort(),['head','lowerarm_l']);
assert.ok(shiftKeys(M,[K('pose|omar|9')],-10,media.seconds).error,'before 0 is refused');
// delete a whole key and a joint
r=deleteKeys(M,[K('pose|omar|5'),K('pose|omar|2|head')]);assert.equal(r.removed,2);assert.deepEqual(r.people.cast[0].poseKeys.map(k=>[k.t,Object.keys(k.pose).join()]),[[2,'lowerarm_l'],[9,'head']]);
// copy two keys, paste at the playhead (12): relative times kept, ease kept
const clip=copyKeys(M,[K('pose|omar|5'),K('pose|omar|9')]);r=pasteKeys(M,clip,12,media.seconds);
assert.deepEqual(r.people.cast[0].poseKeys.map(k=>[k.t,k.ease||'smooth']),[[2,'smooth'],[5,'hold'],[9,'linear'],[12,'hold'],[16,'linear']]);assert.deepEqual(r.ids,['pose|omar|12','pose|omar|16']);
assert.equal(copyKeys(P,[id('act|noah-taps|0')]).items.length,0,'only pose keys are copied');
// ease for several
r=setEase(M,[K('pose|omar|2'),K('pose|omar|9|head')],'hold');assert.deepEqual(r.people.cast[0].poseKeys.map(k=>k.ease||'smooth'),['hold','hold','hold']);
r=setEase(M,[K('pose|omar|5')],'smooth');assert.equal(r.people.cast[0].poseKeys[1].ease,undefined,'smooth is the default: not written');
// ◆ at the playhead: removes the key there, else keys what is keyed as it is at that time
r=toggleKeyAt(M,om,'pose',5,media.seconds);assert.equal(r.did,'removed');assert.deepEqual(r.people.cast[0].poseKeys.map(k=>k.t),[2,9]);
r=toggleKeyAt(M,om,'pose',3.5,media.seconds);assert.equal(r.did,'added');const k35=r.people.cast[0].poseKeys.find(k=>k.t===3.5);assert.deepEqual(Object.keys(k35.pose).sort(),['head','lowerarm_l']);
assert.ok(Math.abs(turnAngles(k35.pose.lowerarm_l)[0]-10)<.2,'the elbow as it is at 3.5 s: halfway from 30 to -10 (smooth): '+turnAngles(k35.pose.lowerarm_l));
r=toggleKeyAt(M,om,'joint',7,media.seconds,{bone:'head'});assert.deepEqual(Object.keys(r.people.cast[0].poseKeys.find(k=>k.t===7).pose),['head']);
assert.ok(toggleKeyAt(M,om,'screen',3,media.seconds).error);assert.ok(toggleKeyAt(P,row('fern'),'pose',3,T).error,'nothing keyed: says so');
// a waypoint on Noah's walk at the playhead keeps the walk's timing; the ◆ there takes it out again
const ws=noah.props.path,mid=(ws[0].t+ws.at(-1).t)/2;r=toggleKeyAt(P,noah,'path',mid,T);assert.equal(r.did,'added');
const nr=sheet(r.people,T).find(x=>x.row==='noah'),np=nr.props.path.find(k=>k.kind==='walk-point');assert.ok(np&&Math.abs(np.t-mid)<.05,'the waypoint is where he is at the playhead: '+np?.t);
assert.ok(Math.abs(nr.props.path.at(-1).t-ws.at(-1).t)<.01,'the arrival stays');
r=toggleKeyAt(r.people,nr,'path',np.t,T);assert.equal(r.did,'removed');assert.deepEqual(r.people.cast.find(e=>e.key==='noah-steps').walk.path,ns.walk.path);
assert.equal(entryAt(P,kai.entries,13),'kai');assert.equal(entryAt(P,kai.entries,3),'kai-rolls');
// values: Bend / Twist / Side round trip; a waypoint's x, z
for(const a of [[30,0,0],[0,10,0],[12,-25,40],[-80,5,-3]])assert.deepEqual(turnAngles(anglesTurn(a)),a);
r=setJointAngles(M,K('pose|omar|2'),'head',[5,15,0]);assert.deepEqual(turnAngles(r.cast[0].poseKeys[0].pose.head),[5,15,0]);
const w0=ws.at(-1);assert.deepEqual(waypointOf(P,w0),ns.walk.path.at(-1));const W=setWaypoint(P,w0,-3000,-700);assert.deepEqual(W.cast.find(e=>e.key==='noah-steps').walk.path.at(-1),[-3000,-700]);
assert.equal(JSON.stringify(P),frozen,'the input is never changed');
// every chapter of the cut derives without error
for(const c of cut.shots)if(c.people&&typeof c.people==='object')sheet(c.people,c.seconds);
console.log(`people sheet: oilers ${rows.length} characters, ${keys.size} keys; moves / delete / copy-paste / ◆ / ease / angles as specified`);
