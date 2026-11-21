// The movie's edit list (experience/screen-edit.mjs; docs/screen-edit-list/CONTRACT.md): only ch 10 media's movie screen;
// trim, split, ripple reorder, add from the bin, source in / out, transitions (validated; the chips' clamped spans equal
// the composer's planTrack, frame for frame, on the fixture and on 400 random tracks), missing sources, validation.
//   node tests/screen-edit-test.mjs [--print]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MOVIE,movieTrack,trackClips,isEditList,cleanTransition,setTransition,transitionPlan,trimClip,moveClip,splitClip,deleteClip,reorderClip,addClip,setSourceRange,missingClips,validateTrack,describeTrack} from '../experience/screen-edit.mjs';
import {planTrack} from '../tools/experience/compose-screen-edit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/screen-edit-list/media-ch10.json'),'utf8'));
const cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json'),'utf8'));
const MOVIE_SRC='app-reference/assets/desk_viewer/media/ambient-clip.mp4',T=17,info=()=>({duration:100,w:1280,h:720,fps:30,audio:true});
const frozen=v=>JSON.stringify(v);

// ---- 1 only the movie chapter's movie screen
const media=cut.shots.find(s=>s.id==='media'),music=cut.shots.find(s=>s.id==='music');
const key=movieTrack('media',media.screens);assert.ok(key,'ch 10 media: the movie track');
assert.equal(movieTrack('music',music.screens||[]),null,'ch 9 music (the game montage): no clip track (Vico)');
assert.equal(movieTrack('media',[{src:'x.mp4'}]),null,'no main-landscape screen: none');
assert.equal(MOVIE.target,'main-landscape');
assert.equal(isEditList(trackClips(media.screens,key,T)),false,'today: one clip, not an edit list (renders as before)');

// ---- 2 the fixture: the clips, and the chips' spans = the composer's plan
const L=fixture.screens,fk=movieTrack('media',L);
{
  const c=trackClips(L,fk,T);assert.deepEqual(c.map(x=>[x.start,x.end]),[[0,6],[6,11.5],[11.5,17]]);assert.ok(isEditList(c));
  const p=transitionPlan(L,fk,T,info);
  assert.deepEqual(p.map(x=>[x.type,x.got,x.from,x.to]),[['dissolve',1,5,6],['dip',.8,11.1,11.9]],'dissolve 5-6 s, dip 11.1-11.9 s (CONTRACT section 1)');
  if(process.argv.includes('--print'))console.log(describeTrack(L,fk,T,info).join('\n'));
}
// planTrack's clamps, frame for frame: dissolve = xIn, dip = dipOut of the clip before + dipIn
function same(list,k,what){
  const plan=planTrack(trackClips(list,k,T).map(c=>c.sc),{seconds:T,info}),mine=transitionPlan(list,k,T,info);
  for(const m of mine){const c=plan.clips[m.k];
    if(m.type==='dissolve')assert.equal(Math.round(m.got*30),c.xIn,`${what}: dissolve into clip ${m.k+1}`);
    else{assert.equal(Math.round(m.in*30),c.dipIn,`${what}: dip in, clip ${m.k+1}`);assert.equal(Math.round(m.out*30),m.k?plan.clips[m.k-1].dipOut:0,`${what}: dip out`);}}
}
same(L,fk,'fixture');
{
  let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
  for(let n=0;n<400;n++){
    const count=2+Math.floor(rnd()*4),list=[];let t=0;
    for(let k=0;k<count&&t<T-.5;k++){if(rnd()<.2)t+=Math.round(rnd()*30)/30;const len=Math.max(.2,Math.round(rnd()*6*30)/30),end=Math.min(T,t+len);
      const sc={target:'main-landscape',src:MOVIE_SRC,start:t,end,offset:Math.round(rnd()*120*10)/10,rate:[1,1,.5,2,1.5][Math.floor(rnd()*5)],...(rnd()<.3?{loop:false}:{})};
      const r=rnd();if(k&&r<.4)sc.transitionIn={type:'dissolve',dur:Math.round(rnd()*4.5*10)/10||.1};else if(r<.8)sc.transitionIn={type:'dip',dur:Math.round(rnd()*4.5*10)/10||.1,color:'#000000'};
      list.push(sc);t=end;}
    if(list.length)same(list,movieTrack('media',list),'random '+n);
  }
}

// ---- 3 split: the right piece has no transition in (it would dissolve into its own left half) and no compose
{
  const withCompose=structuredClone(L);withCompose[1].compose={fps:30};const was=frozen(withCompose);
  const s=splitClip(withCompose,1,8,T),c=trackClips(s,fk,T);
  assert.equal(c.length,4);assert.deepEqual(c[1].sc.transitionIn,{type:'dissolve',dur:1},'the left piece keeps it');
  assert.equal(c[2].start,8);assert.equal(c[2].sc.transitionIn,undefined,'the right piece: none');assert.equal(c[2].sc.compose,undefined);assert.equal(c[2].sc.offset,72,'source continues');
  assert.equal(frozen(withCompose),was,'input untouched');
}
// ---- 4 trim / move: no overlaps stored (the Graphics lane's rule)
{
  assert.throws(()=>trimClip(L,0,0,6.5,T),/overlaps/);
  const t=trimClip(L,1,6.5,11.5,T,{trimStart:true});assert.equal(t[1].offset,70.5,'trimming the head moves the source in');
  assert.throws(()=>moveClip(L,2,10,T),/overlaps/);
}
// ---- 5 ripple reorder: lengths, offsets, rates and transitions travel with the clip; gaps stay in place; compose to the new first
{
  const g=structuredClone(L);g[2].start=12;g[0].compose={fps:30};          // (a 0.5 s gap before clip 3: 6..11.5, gap, 12..17)
  g[2].end=17;const r=reorderClip(g,fk,2,0,T),c=trackClips(r,fk,T);
  assert.deepEqual(c.map(x=>[x.sc.offset,+x.start.toFixed(3),+x.end.toFixed(3)]),[[12,0,5],[40,5,11],[70,11.5,17]],'clip 3 first; the gap stays the second gap');
  assert.deepEqual(c[0].sc.transitionIn,{type:'dip',dur:.8,color:'#000000'},'its transition comes with it (first clip: fades up, the composer says)');
  assert.deepEqual(c[0].sc.compose,{fps:30});assert.equal(c[1].sc.compose,undefined,'compose on the new first clip only');
  assert.deepEqual(trackClips(reorderClip(L,fk,0,2,T),fk,T).map(x=>x.sc.offset),[70,12,40],'to the end');
  assert.throws(()=>reorderClip(L,fk,0,5,T),/Drop the clip/);
  assert.equal(frozen(reorderClip(L,fk,1,1,T)),frozen(L));
}
// ---- 6 add from the bin, delete
{
  const one=media.screens;
  assert.throws(()=>addClip(one,key,'x.mp4',{seconds:T}),/No room/,'the movie fills the chapter: no room after it');
  const short=trimClip(one,0,0,10,T),b=addClip(short,key,'divi-editor/upload-to-promo/hero.mp4',{seconds:T,srcSeconds:4}),c=trackClips(b,key,T);
  assert.deepEqual(c.map(x=>[x.start,x.end,x.sc.src.split('/').pop()]),[[0,10,'ambient-clip.mp4'],[10,14,'hero.mp4']],'appended, its own length');
  assert.equal(c[1].sc.brightness,.9,'the screen\'s display fields (clip 1\'s)');assert.equal(c[1].sc.offset,0);assert.equal(c[1].sc.transitionIn,undefined);
  const d=addClip(short,key,'y.mp4',{seconds:T,srcSeconds:60});assert.equal(trackClips(d,key,T)[1].end,17,'as long as the room allows');
  assert.throws(()=>addClip(short,key,'y.mp4',{at:5,seconds:T}),/playhead is on a clip/);
  const del=deleteClip(L,1);assert.equal(trackClips(del,fk,T).length,2);assert.equal(trackClips(del,fk,T)[1].start,11.5,'a gap stays');
}
// ---- 7 source monitor in / out
{
  const r=setSourceRange(L,fk,0,20,30,T);assert.equal(r.clamped,true,'10 s wanted, 6 s free before clip 2');assert.deepEqual([r.list[0].offset,r.list[0].start,r.list[0].end],[20,0,6]);
  const s=setSourceRange(L,fk,0,20,23,T);assert.equal(s.clamped,false);assert.equal(s.list[0].end,3);
  assert.throws(()=>setSourceRange(L,fk,0,5,5,T),/in point before the out point/);
}
// ---- 8 transitions: validation, set / remove
assert.deepEqual(cleanTransition({type:'dip',dur:.8,color:'#FFFFFF'}),{type:'dip',dur:.8,color:'#ffffff'});
assert.deepEqual(cleanTransition({type:'dissolve',dur:1.23456}),{type:'dissolve',dur:1.235});assert.deepEqual(cleanTransition({type:'cut',dur:3}),{type:'cut'});
assert.throws(()=>cleanTransition({type:'wipe',dur:1}),/cut, a dissolve or a dip/);assert.throws(()=>cleanTransition({type:'dissolve',dur:5}),/up to 4/);
assert.throws(()=>cleanTransition({type:'dissolve',dur:0}),/more than 0/);assert.throws(()=>cleanTransition({type:'dip',dur:1,color:'black'}),/colour/);
{const s=setTransition(L,2,null);assert.equal(s[2].transitionIn,undefined);const d=setTransition(L,2,{type:'dissolve',dur:2});assert.deepEqual(d[2].transitionIn,{type:'dissolve',dur:2});
 // the head handle: offset 1 s at rate 1 -> the dissolve is 1 s, and the chip says why
 const h=structuredClone(d);h[2].offset=1;const p=transitionPlan(h,fk,T,info).find(x=>x.k===2);assert.equal(p.got,1);assert.match(p.why,/source has 1 s before/);
 const first=setTransition(L,0,{type:'dissolve',dur:1});assert.equal(transitionPlan(first,fk,T,info)[0].got,0,'first clip: a cut');}
// ---- 9 missing sources, validation
assert.deepEqual(missingClips(L,fk,T,src=>!src.includes('ambient')),[0,1,2]);
{const m=structuredClone(L);m[1].missing=true;assert.deepEqual(missingClips(m,fk,T),[1]);}
assert.deepEqual(validateTrack(L,fk,T),[]);
{const bad=structuredClone(L);bad[1].start=5.5;bad[2].transitionIn={type:'dip',dur:9};bad[1].compose={};const e=validateTrack(bad,fk,T);
 assert.ok(e.some(x=>/overlap/.test(x))&&e.some(x=>/up to 4/.test(x))&&e.some(x=>/compose belongs/.test(x)),e.join(' | '));}
assert.deepEqual(L,fixture.screens,'the fixture was never changed');
console.log('screen-edit-test: ok (movie chapter only; transition chips = the composer\'s planTrack on the fixture and 400 random tracks; split / trim / ripple reorder / add / in-out / validation)');
