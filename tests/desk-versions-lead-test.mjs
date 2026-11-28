// Desk versions: the blank Pearl White desk (look 'blank-pearl'), a desk added at the start of the chapter, and sliding desk versions
// and finish fades as a group (Vico, 27 Nov 2026: open a 1.5 s Pearl White lead-in by sliding the whole line-up right).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cleanDeskVersionList,addVersionAtStart,shiftVersions,moveSeam,resolveSubshots,resolveFilm,seamsOf,shown,LOOKS,BLANK_NAME} from '../experience/desk-versions-edit.mjs';
import {shiftGroup,groupRange} from '../experience/timeline-group.mjs';
import {whiteLook,PEARL} from '../experience/finish-fades.mjs';
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;console.log('ok  '+m);};
const film=[{n:'B',preset:'artist',name:'',start:0,end:5.64},{n:'C',preset:'architect',name:'',start:5.04,end:9.94},{n:'D',preset:'office',name:'',start:9.34,end:17.08},{n:'H',preset:'gaming',name:'',start:15.08,end:25.95}];
// the look field
ok(cleanDeskVersionList([{...film[0],look:'blank-pearl'},...film.slice(1)])[0].look==='blank-pearl','the list keeps a known look');
ok(!('look' in cleanDeskVersionList([{...film[0],look:'nonsense'},...film.slice(1)])[0]),'an unknown look is dropped');
// shift all four right by 1.5 s: the chapter grows by 1.5 s, every desk keeps its length and crossfade
const all=new Set(film.map(v=>v.n)),T=25.95;
let moved=shiftVersions(film,all,1.5,27.45);
ok(moved[0].start===1.5&&moved[3].end===27.45&&moved[1].start===6.54,'all desks slide 1.5 s');
ok(seamsOf(moved).overlaps.every((o,i)=>Math.abs(o-seamsOf(film).overlaps[i])<1e-6),'the crossfades keep their width');
// a gap between two desks is refused, a desk cannot pass its neighbour
assert.throws(()=>shiftVersions(film,new Set(['D']),3,T),/gap|pass/);n++;console.log('ok  a lone desk cannot open a gap');
assert.throws(()=>shiftVersions(film,new Set(['B']),-1,T),/before the chapter/);n++;console.log('ok  nothing starts before the chapter');
// added at the start: the gap is filled, the change happens where the gap ends
let withGap=moved,added=addVersionAtStart(withGap,0,'I',27.45,{look:'blank-pearl'});
ok(added[0].n==='I'&&added[0].start===0&&added[0].look==='blank-pearl'&&added[0].name===BLANK_NAME,'the new desk is the first, blank Pearl White');
ok(Math.abs(seamsOf(added).seams[0]-1.5)<1e-9,`the change is at 1.5 s (${seamsOf(added).seams[0]})`);
ok(shown(added,0)[1]===1.5&&added[1].start===1.2&&added[0].end===1.8,'it shows 0-1.5 s; the crossfade 1.2-1.8 s is centred on the change');
ok(added[1].end===moved[0].end&&added.slice(2).every((v,i)=>v.start===moved[i+1].start&&v.end===moved[i+1].end),'the other desks keep their windows');
// no gap: it takes the first half of the first desk
let split=addVersionAtStart(film,0,'I',T,{look:'blank-pearl'});
ok(split&&split[0].start===0&&shown(split,0)[1]>=2&&shown(split,1)[1]-shown(split,1)[0]>=2,'no gap: it shares the first desk\'s time');
ok(addVersionAtStart([{n:'B',preset:'artist',name:'',start:0,end:.9}],0,'I',.9)===null,'a first desk too short to share refuses');
// shortening the opener below 1.5 s (e.g. 1.25 s, down to 0.5 s)
let shorter=moveSeam(added,0,1.25,27.45);
ok(shown(shorter,0)[1]===1.25&&shorter[0].end===1.55&&shorter[1].start===.95,'opener can be shortened to 1.25 s');
let shortest=moveSeam(added,0,.2,27.45);
ok(shown(shortest,0)[1]===.5&&shortest[0].end===.8&&shortest[1].start===.2,'opener clamps at 0.5 s with positive Artist start');
// resolve against the real film sub-shots
const dir='exports/cinematic-intro-cut-vicos-3rd-cut/';
if(fs.existsSync(dir+'shots/13-subshots.json')){
  const subs=JSON.parse(fs.readFileSync(dir+'shots/13-subshots.json','utf8')).shots.filter(s=>s.id==='hero');
  const out=resolveSubshots(subs,added);
  const p=out.find(s=>s.subshot==='I'),b=out.find(s=>s.subshot==='B');
  ok(p&&p.deskLook==='blank-pearl'&&p.name===BLANK_NAME&&p.preset==='artist','the blank desk is an Artist desk named Pearl White');
  ok(p.renderRange[0]===0&&p.renderRange[1]===1.8,'its window is 0-1.8 s');
  ok(!(p.sceneEdits||[]).some(e=>e.add)&&p.screens.length===0&&!p.accessories,'no added props, no screens, no accessory list');
  ok(p.featuredBuild&&p.featuredBuild.woodFinish===PEARL.wood&&p.featuredBuild.accessories.length===0,'Pearl White finish, no accessories');
  ok(p.ledColor===whiteLook(subs[0]).ledColor,'the LED is the warm white of the ending');
  const rig=p.lights.find(l=>l.preset==='productRig');ok(typeof rig.key.intensity==='number','the rig is the white look\'s fixed levels');
  // per-desk fixed lighting on all five Hero sub-shots survives seam retiming
  const wantKey={I:11,B:30,C:4.5,D:4.5,H:30},wantKick={I:7,B:30,C:18,D:18,H:30};
  const retimedSubs=resolveSubshots(subs,shorter);
  for(const s of retimedSubs){
    const r=s.lights.find(l=>l.preset==='productRig'),k=s.lights.find(l=>l.name==='kicker');
    ok(r.key.intensity===wantKey[s.subshot]&&k.intensity===wantKick[s.subshot],`sub-shot ${s.subshot} keeps fixed per-desk lighting (key=${r.key.intensity}, kicker=${k.intensity}) after retiming`);
  }
  ok(b.sceneEdits.some(e=>e.add)&&!b.deskLook,'the Artist desk next to it keeps its props');
  ok(b.renderRange[0]===1.2,'Artist window starts at 1.2 s');
  // switching the look off again brings the plain desk back
  const plain=added.map(v=>v.n==='I'?{n:'I',preset:'artist',name:'',start:v.start,end:v.end}:v);
  const back=resolveSubshots(out,plain).find(s=>s.subshot==='I');
  ok(!back.deskLook&&!back.featuredBuild&&back.sceneEdits.some(e=>e.add)&&back.ledColor===b.ledColor,'without the look it is the Artist desk again');
  const f=resolveFilm({},added);ok(f.subshots.I[0]===0&&f.presets[0]==='artist','the film\'s map lists it first');
}
// group move through shiftGroup: desks + fade together
const base={seconds:T,keys:[{id:'k',time:0}],clips:[],versions:film,fades:{H:{at:[19.2,20.45],set:{deskFinish:{wood:'Pearl White'}}}}};
const g=shiftGroup(base,{versions:all,fades:new Set(['H']),keys:new Set(),clips:new Set()},1.5);
ok(g.seconds===27.45&&g.versions[0].start===1.5&&g.fades.H.at[0]===20.7&&g.fades.H.at[1]===21.95,'shiftGroup moves desks and the fade, and lengthens the chapter');
ok(g.versions.at(-1).end===g.seconds,'the last desk runs to the new end');
ok(groupRange(base,{versions:new Set(['B']),fades:new Set()})[0]===0,'a group at the start cannot move left');
console.log(`\n${n} checks passed`);
