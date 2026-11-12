// Desk versions, the edit model (experience/desk-versions-edit.mjs) and the film side of it: more desks than the
// film's six (a copy of a model the chapter already shows, with its own id), fewer (down to one), ids that are never
// handed out twice, the sub-shots the film renders for 7 and 8 versions, the importer's helper
// (tools/experience/desk-versions-apply.mjs) and the join plan (tools/experience/join-subshots.py --plan; a real
// ffmpeg join of seven tiny clips when ffmpeg is there). No browser, no render.
//   node tests/cinematic-desk-versions-edit-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cleanDeskVersionList,cleanDeskVersionsField,nextVersionId,addVersion,removeVersion,canAddVersion,moveVersion,moveSeam,seamsOf,shown,
  resolveSubshots,resolveFilm,libraryEntry,effectiveVersions,MIN_SHOWN,MAX_VERSIONS} from '../experience/desk-versions-edit.mjs';
import {deskVersions,versionAt} from '../experience/desk-versions.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),T=48;
const WIN={A:[0,5.3],B:[4.7,13.1],C:[12.5,21.9],D:[21.3,27.7],E:[27.1,34],F:[33.4,48]},PRESETS=['gaming','artist','office','hbhs','occ','architect'];
// The film's six sub-shots: one camera / performance, a bundle per model (office has clips that start with its window).
const chapter={id:'hero',room:'product',seconds:T,cameraPlan:{keys:[{at:0,position:[4,2,8],target:[0,1,0],fov:26}]},motion:{clips:[{id:'m1',start:1,duration:3}]}};
const common={match:'^Floor$',material:{roughness:.4}};
const subs=Object.entries(WIN).map(([n,r],i)=>({...chapter,subshot:n,renderRange:r,preset:PRESETS[i],kind:n==='A'?'glide':'hero',
  lights:[{name:'key',intensity:40},{name:'kicker',intensity:n==='A'?30:18}],sceneGlobals:{environmentScale:.4,exposure:.6+i*.05},
  sceneEdits:[common,{match:`^Only_${PRESETS[i]}$`,hide:true}],
  screens:n==='C'?[{target:'main-landscape',src:'fin-wide.mp4',offset:-13.1},{target:'main-portrait',src:'fin-portrait.mp4',offset:-13.1,rate:2}]:[{target:'main-landscape',src:'main.mp4'}],
  ...(n==='C'?{accessories:{add:[{id:'calculator'}]}}:{})}));
const film={...chapter,preset:'gaming',kind:'glide',subshots:WIN,presets:PRESETS};
const six=Object.entries(WIN).map(([n,[start,end]],i)=>({n,preset:PRESETS[i],name:'',start,end}));
const ids=l=>l.map(v=>v.n).join(' '),models=l=>l.map(v=>v.preset).join(' ');
const tiles=l=>{const {seams,overlaps}=seamsOf(l);assert.equal(l[0].start,0);assert.equal(l.at(-1).end,T);
  for(const [i,v] of l.entries()){const [a,b]=shown(l,i);assert.ok(b-a>=MIN_SHOWN-.011,`${v.n} shows ${(b-a).toFixed(2)} s`);assert.ok(v.end>v.start);}
  assert.ok(overlaps.every(o=>Math.abs(o-.6)<.011),'every seam crossfades 0.6 s: '+overlaps.map(o=>o.toFixed(2)));return seams;};

// ---- the list a cut keeps: 1 to 12 versions, ids A..Z then AA..ZZ, unique
assert.deepEqual(cleanDeskVersionList(six),six);
assert.equal(cleanDeskVersionList([six[0]]).length,1,'one desk is a valid list');
assert.equal(cleanDeskVersionList([]),null);
assert.equal(cleanDeskVersionList([...six,{...six[0],n:'G',start:40,end:48}]).length,7);
assert.equal(cleanDeskVersionList([...six,{...six[0],n:'AB',start:40,end:48}]).at(-1).n,'AB');
for(const bad of ['g','A1','AAA','',null])assert.equal(cleanDeskVersionList([...six,{...six[0],n:bad,start:40,end:48}]),null,`id ${bad} is refused`);
assert.equal(cleanDeskVersionList([...six,{...six[0],start:40,end:48}]),null,'the same id twice is refused');
assert.equal(cleanDeskVersionList(Array.from({length:MAX_VERSIONS+1},(_,i)=>({n:String.fromCharCode(65+i),preset:'gaming',start:i,end:i+1}))),null);
assert.deepEqual(cleanDeskVersionsField({deskVersions:six,deskVersionsLast:'H'}),{deskVersions:six,deskVersionsLast:'H'});
assert.deepEqual(cleanDeskVersionsField({deskVersionsLast:'h'}),{});
assert.deepEqual(effectiveVersions([{n:'A',preset:'gaming',start:0,end:48}],[{n:'Q',preset:'occ',start:0,end:48}]).map(v=>v.n),['Q'],'the cut\'s list is the statement, whatever the film has');

// ---- ids: the next after every id used; never one handed out before
assert.equal(nextVersionId('ABCDEF'.split('')),'G');
assert.equal(nextVersionId(['A','B','C','D','E','F','H']),'I','G stays free once H was given out: ids only go up');
assert.equal(nextVersionId(['A','F',undefined,'bad',7,'K']),'L');
assert.equal(nextVersionId(['Z']),'AA');assert.equal(nextVersionId(['AZ']),'BA');assert.equal(nextVersionId(['ZZ']),null);assert.equal(nextVersionId([]),'A');

// ---- add: a copy of Gaming at the end takes the second half of the last desk's time
const seven=addVersion(six,0,6,'G',T);
assert.equal(ids(seven),'A B C D E F G');assert.equal(models(seven),'gaming artist office hbhs occ architect gaming');
assert.deepEqual(tiles(seven).map(x=>+x.toFixed(2)),[5,12.8,21.6,27.4,33.7,40.9],'the new seam halves F (33.7-48 s), on a tenth of a second');
assert.deepEqual(seven.slice(0,5),six.slice(0,5),'the desks before it keep their windows');
assert.deepEqual([seven[5].start,seven[5].end,seven[6].start,seven[6].end],[33.4,41.2,40.6,48]);
assert.deepEqual(cleanDeskVersionList(seven),seven,'what add makes is a clean list');
// duplicate: right after its source, the two share the source's time
const dup=addVersion(six,1,2,'G',T);
assert.equal(ids(dup),'A B G C D E F');assert.equal(dup[2].preset,'artist');
assert.deepEqual(tiles(dup).map(x=>+x.toFixed(2)),[5,8.9,12.8,21.6,27.4,33.7]);
// a named desk keeps its name on the copy
assert.equal(addVersion(six.map(v=>v.n==='D'?{...v,name:'Humboldt'}:v),3,6,'G',T)[6].name,'Humboldt');
// eight, with two copies of one model
const eight=addVersion(seven,2,3,'H',T);
assert.equal(ids(eight),'A B C H D E F G');assert.equal(models(eight),'gaming artist office office hbhs occ architect gaming');tiles(eight);
// a desk too short to share: every desk gives part of what it has above the minimum
const tight=addVersion([{n:'A',preset:'gaming',name:'',start:0,end:3.3},{n:'B',preset:'artist',name:'',start:2.7,end:48}],0,1,'G',T);
assert.equal(ids(tight),'A G B');tiles(tight);assert.ok(Math.abs(shown(tight,1)[1]-shown(tight,1)[0]-MIN_SHOWN)<.02,'the new desk shows the minimum');
// one desk -> two: the seam gets the default crossfade
const two=addVersion([{n:'A',preset:'gaming',name:'',start:0,end:T}],0,1,'G',T);
assert.deepEqual(two.map(v=>[v.n,v.start,v.end]),[['A',0,24.3],['G',23.7,48]]);
// refusals: the id in use, no room, the limit
assert.equal(addVersion(six,0,6,'C',T),null);assert.equal(addVersion(six,0,0,'G',T),null,'a new desk goes after one');
assert.equal(canAddVersion(six,13.9),false,'7 desks need 14 s');assert.equal(addVersion(six,0,6,'G',13.9),null);
let many=six;for(let i=6;i<MAX_VERSIONS;i++)many=addVersion(many,0,many.length,nextVersionId(many.map(v=>v.n)),T);
assert.equal(many.length,MAX_VERSIONS);tiles(many);assert.equal(canAddVersion(many,T),false);assert.equal(addVersion(many,0,many.length,'S',T),null);

// ---- remove: the desk before it stays on; add then remove is the list as it was
assert.deepEqual(removeVersion(seven,6,T),six);assert.deepEqual(removeVersion(dup,2,T),six);
const five=removeVersion(six,2,T);                                    // one of the film's own (C, office)
assert.equal(ids(five),'A B D E F');assert.deepEqual(tiles(five).map(x=>+x.toFixed(2)),[5,21.6,27.4,33.7],'B stays on for C\'s time');
const noFirst=removeVersion(six,0,T);assert.equal(ids(noFirst),'B C D E F');assert.equal(noFirst[0].start,0);assert.equal(shown(noFirst,0)[1],12.8);
let one=six;while(one.length>1)one=removeVersion(one,one.length-1,T);
assert.deepEqual(one,[{n:'A',preset:'gaming',name:'',start:0,end:T}]);assert.equal(removeVersion(one,0,T),null,'never below one desk');
// the id of a removed version is not given to the next one (the cut remembers the highest handed out)
assert.equal(nextVersionId([...removeVersion(seven,6,T).map(v=>v.n),'G']),'H');

// ---- reorder and retime work on the longer list; the slots (letters, windows) stay, the desks move between them
const moved=moveVersion(seven,6,0);
assert.equal(ids(moved),'A B C D E F G');assert.equal(models(moved),'gaming gaming artist office hbhs occ architect');
assert.deepEqual(moved.map(v=>[v.start,v.end]),seven.map(v=>[v.start,v.end]),'the time windows stay');
assert.equal(ids(moveVersion(six,0,5)),'A B C D E F');assert.equal(models(moveVersion(six,0,5)),'artist office hbhs occ architect gaming','Gaming to the end: the letters stay in time order');
const retimed=moveSeam(seven,5,44,T);assert.equal(seamsOf(retimed).seams[5],44);assert.deepEqual([retimed[5].end,retimed[6].start],[44.3,43.7]);
assert.equal(seamsOf(moveSeam(seven,5,47.5,T)).seams[5],46,'a seam stops 2 s before the end');

// ---- the film's sub-shots for the list
const same=(a,b,what)=>assert.equal(JSON.stringify(a),JSON.stringify(b),what);
same(resolveSubshots(subs,six),subs,'the film\'s six as they are resolve to the film\'s six sub-shots, unchanged');
const out7=resolveSubshots(subs,seven);
assert.equal(out7.map(s=>s.subshot).join(' '),'A B C D E F G');same(out7.slice(0,5),subs.slice(0,5));
same(out7[6],{...subs[0],subshot:'G',renderRange:[40.6,48]},'G is the gaming sub-shot again, in its own window');
same(out7[5],{...subs[5],renderRange:[33.4,41.2]},'F ends where G takes over');
same(resolveSubshots(out7,seven),out7,'resolving the film that has them already changes nothing (the pass is idempotent)');
same(resolveFilm(film,seven).subshots,{A:[0,5.3],B:[4.7,13.1],C:[12.5,21.9],D:[21.3,27.7],E:[27.1,34],F:[33.4,41.2],G:[40.6,48]});
assert.deepEqual(resolveFilm(film,seven).presets,[...PRESETS,'gaming']);
// eight: H is office again, later; its clips start with its own window (offset moves by the rate)
const out8=resolveSubshots(subs,eight),H=out8[3],C=out8[2];
assert.equal(out8.map(s=>s.subshot+':'+s.preset).join(' '),'A:gaming B:artist C:office H:office D:hbhs E:occ F:architect G:gaming');
assert.deepEqual(H.accessories,subs[2].accessories);assert.equal(H.kind,'hero');assert.equal(H.sceneGlobals.exposure,subs[2].sceneGlobals.exposure);
const shift=12.5-H.renderRange[0];
assert.deepEqual(H.screens.map(s=>s.offset),[+(-13.1+shift).toFixed(2),+(-13.1+shift*2).toFixed(2)],'the copy\'s clips follow its window');
assert.deepEqual(C.screens.map(s=>s.offset),[-13.1,-13.1],'the first office keeps its own');
same(resolveSubshots(out8,eight),out8);
assert.equal(Object.keys(resolveFilm(film,eight).subshots).join(' '),'A B C H D E F G','the film\'s map lists them in time order');
// a copy of a desk whose model has no film desk: both get the preset's defaults
const lib2=resolveSubshots(subs,addVersion(six.map(v=>v.n==='D'?{...v,preset:'music'}:v),3,6,'G',T));
same({...lib2[6],subshot:'D',renderRange:lib2[3].renderRange},lib2[3],'a copy of a model without a film desk resolves like it');
assert.equal(lib2[6].preset,'music');assert.deepEqual(lib2[6].sceneEdits,[common]);
// a renamed copy carries its name
assert.equal(resolveSubshots(subs,seven.map(v=>v.n==='G'?{...v,name:'Finale'}:v))[6].name,'Finale');
// reorder: each slot renders the desk that moved into it, with that model's bundle
const outMoved=resolveSubshots(subs,moved);
assert.equal(outMoved.map(s=>s.subshot+':'+s.preset).join(' '),'A:gaming B:gaming C:artist D:office E:hbhs F:occ G:architect');
assert.deepEqual(outMoved[3].accessories,subs[2].accessories,'the office in slot D has the office dressing');
assert.deepEqual(outMoved[0].renderRange,[0,5.3]);assert.equal(outMoved[0].kind,'glide');

// ---- removing one of the film's own, and getting its dressing back later from the library
const out5=resolveSubshots(subs,five);
assert.equal(out5.map(s=>s.subshot+':'+s.preset).join(' '),'A:gaming B:artist D:hbhs E:occ F:architect');
const library=[libraryEntry(subs[2])];
assert.deepEqual(Object.keys(library[0]).sort(),['accessories','id','kind','lights','preset','renderRange','sceneEdits','sceneGlobals','screens','subshot']);
const back=addVersion(five,0,5,'G',T).map(v=>v.n==='G'?{...v,preset:'office'}:v);
const bare=resolveSubshots(out5,back)[5],withLib=resolveSubshots(out5,back,library)[5];
assert.equal(bare.accessories,undefined,'without the library the office comes back with the preset\'s defaults');
assert.deepEqual(withLib.accessories,subs[2].accessories,'with it, the film\'s office dressing');
same(withLib.cameraPlan,chapter.cameraPlan);assert.equal(withLib.subshot,'G');assert.equal(withLib.screens[0].src,'fin-wide.mp4');

// ---- the Director's list (desk-versions.mjs): seven segments, the copy named at its time
const dv=deskVersions(film,{shots:subs,library:[]},seven);
assert.deepEqual(dv.map(v=>`${v.n} · ${v.label}`),['A · Gaming','B · Artist','C · Office','D · HBHS','E · OCC','F · Architect','G · Gaming']);
assert.equal(versionAt(dv,40.89).n,'F');assert.equal(versionAt(dv,40.91).n,'G');assert.equal(versionAt(dv,48).n,'G');
assert.equal(dv[6].setup.subshot,'G');assert.notEqual(dv[6].sig,dv[0].sig,'the copy is its own version on the stage');
assert.equal(deskVersions(film,{shots:subs},[seven[6]]).length,1);assert.equal(deskVersions(film,subs,null).length,6);
assert.equal(deskVersions(film,{shots:out5,library},back)[5].setup.accessories.add[0].id,'calculator','the Director reads the library too');

// ---- the importer's helper
const apply=input=>JSON.parse(execFileSync('node',[path.join(root,'tools/experience/desk-versions-apply.mjs')],{input:JSON.stringify(input),maxBuffer:1<<28}).toString());
const a7=apply({subshots:subs,versions:seven});
same(a7.subshots,out7);same(a7.film,{subshots:resolveFilm({},seven).subshots,presets:[...PRESETS,'gaming']});assert.deepEqual(a7.library,[]);
const a5=apply({subshots:subs,versions:five});
assert.equal(a5.subshots.length,5);same(a5.library,library,'a dropped film desk leaves its bundle in the library');
same(apply({subshots:a5.subshots,versions:five,library:a5.library}).library,library,'and it stays there');
same(apply({subshots:a5.subshots,versions:back,library:a5.library}).subshots[5],withLib);
assert.equal(spawnSync('node',[path.join(root,'tools/experience/desk-versions-apply.mjs')],{input:JSON.stringify({subshots:subs,versions:[]})}).status,1,'an invalid list fails');

// ---- the film's real finale, when this checkout has it: the six resolve to themselves, byte for byte; seven and eight
const real=path.join(root,'exports/cinematic-intro-20261104-hq14/shots/13-subshots.json');
let realNote='(no film data here)';
if(fs.existsSync(real)){
  const text=fs.readFileSync(real,'utf8'),shots=JSON.parse(text).shots,list=shots.map(s=>({n:s.subshot,preset:s.preset,name:s.name||'',start:s.renderRange[0],end:s.renderRange[1]})),total=shots.at(-1).seconds;
  same(resolveSubshots(shots,cleanDeskVersionList(list)),shots,'the real six resolve to the file\'s six');
  const l7=addVersion(list,0,list.length,nextVersionId(list.map(v=>v.n)),total),r7=resolveSubshots(shots,l7),g=r7.at(-1),first=shots.find(s=>s.preset===list[0].preset);
  assert.equal(r7.length,list.length+1);same({...g,subshot:first.subshot,renderRange:first.renderRange},first,'the real copy is the first desk\'s sub-shot in a new window');
  assert.equal(g.renderRange[1],total);same(resolveSubshots(r7,l7),r7);
  const l8=addVersion(l7,2,3,nextVersionId(l7.map(v=>v.n)),total),r8=resolveSubshots(shots,l8);assert.equal(r8.length,list.length+2);same(resolveSubshots(r8,l8),r8);
  realNote=`(real finale: ${list.length} -> ${r7.length} and ${r8.length} sub-shots, ${r8.map(s=>s.subshot+':'+s.preset).join(' ')})`;
}

// ---- the join: N sub-shots, N-1 crossfades where they overlap; one sub-shot is the chapter as it is
const join=path.join(root,'tools/experience/join-subshots.py'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'desk-versions-join-'));
try{
  const cut=path.join(tmp,'cut.json');fs.writeFileSync(cut,JSON.stringify({shots:out7}));
  const plan=JSON.parse(execFileSync('python3',[join,cut,tmp,path.join(tmp,'out.mkv'),'--plan']).toString());
  assert.equal(plan.inputs.length,7);assert.deepEqual(plan.inputs.map(f=>path.basename(f)),['01.mkv','02.mkv','03.mkv','04.mkv','05.mkv','06.mkv','07.mkv']);
  assert.deepEqual(plan.fades,[[0.6,4.7],[0.6,12.5],[0.6,21.3],[0.6,27.1],[0.6,33.4],[0.6,40.6]],'six crossfades, each 0.6 s at the next sub-shot\'s start');
  assert.equal(plan.seconds,T);
  const cut1=path.join(tmp,'cut1.json');fs.writeFileSync(cut1,JSON.stringify({shots:resolveSubshots(subs,one)}));
  const plan1=JSON.parse(execFileSync('python3',[join,cut1,tmp,path.join(tmp,'out1.mkv'),'--plan']).toString());
  assert.equal(plan1.inputs.length,1);assert.deepEqual(plan1.fades,[]);
  let joined='(ffmpeg not found: the join itself was not run)';
  if(spawnSync('ffmpeg',['-version']).status===0){
    // Seven tiny clips, each as long as its window (as render-cut renders a renderRange), joined for real.
    const colors=['red','green','blue','yellow','purple','orange','white'];
    for(const [i,s] of out7.entries())execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',`color=c=${colors[i]}:s=64x36:r=30:d=${(s.renderRange[1]-s.renderRange[0]).toFixed(4)}`,'-c:v','libx264','-pix_fmt','yuv444p',path.join(tmp,String(i+1).padStart(2,'0')+'.mkv')]);
    const said=execFileSync('python3',[join,cut,tmp,path.join(tmp,'out.mkv')]).toString(),seconds=Number(/([\d.]+) s\s*$/.exec(said)?.[1]);
    assert.ok(Math.abs(seconds-T)<.05,`seven sub-shots join to the ${T} s chapter (${seconds} s)`);
    const frames=Number(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','csv=p=0',path.join(tmp,'out.mkv')]).toString());
    assert.equal(frames,T*30,'every frame of the chapter');
    fs.copyFileSync(path.join(tmp,'01.mkv'),path.join(tmp,'one-01.mkv'));fs.mkdirSync(path.join(tmp,'one'));fs.renameSync(path.join(tmp,'one-01.mkv'),path.join(tmp,'one','01.mkv'));
    execFileSync('python3',[join,cut1,path.join(tmp,'one'),path.join(tmp,'out1.mkv')]);assert.ok(fs.statSync(path.join(tmp,'out1.mkv')).size>0,'one sub-shot joins to itself');
    joined=`a real join of seven 64x36 clips is ${seconds} s, ${frames} frames`;
  }
  console.log(`Desk versions edit model: add / duplicate / remove (1 to ${MAX_VERSIONS}), ids never reused, reorder and seams on 7, the film's sub-shots for 7 and 8 with a repeated model, the library, the importer's helper and the join plan passed ${realNote}; ${joined}.`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
