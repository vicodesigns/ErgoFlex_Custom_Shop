// The Director's Sonar (experience/sonar.mjs, sonar-editor.mjs, stage.mjs, the cut, Export cut; 19 Nov 2026), without a browser.
// Vico: "add the sonar in there … enable it, look at it when it's in full, see how many rings it shows … see how big it is,
// change the amount of rings per pulse and see the update … a tool to relocate where the center is."
//   1. the data: shot.sonar is ABSENT by default; what equals the film's is not kept; bad values dropped or clamped
//   2. the cut: cleanShot keeps / leaves out the key, {} survives (a reset must reach the film), Export cut carries it
//   3. the film shot: absent leaves the live / render film shot exactly as it was; present replaces, {} takes the film's off
//   4. the stage maths: with no sonar object the ping loop gives exactly today's numbers (a verbatim copy of stage.mjs's old
//      loop is the reference); rings per pulse = rings alive at once, a gap of 7.2 s / rings; Preview at full shows them all
//   5. Preview at full is never saved (it is not part of the data, the panel's action does not write, the stage clears it)
//   6. the wiring in the sources (player, stage API, render path) and the unit helpers
//   node tests/sonar-controls-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELDS,FILM_RINGS,TRAVEL,FILM_GAP,cleanSonar,cleanSonarField,withSonar,gapOf,meshesFor,fullSec,pingRows} from '../experience/sonar.mjs';
import {cleanShot,cleanCut} from '../experience/cuts.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
import {toUnit,fromUnit} from '../experience/sonar-editor.mjs';
const src=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
// 1. the data
assert.equal(FILM_RINGS,3);assert.equal(TRAVEL,7.2);assert.equal(FILM_GAP,2.4);
for(const v of [undefined,null,0,'x',[],true,{}])assert.equal(cleanSonar(v),null,'nothing: '+JSON.stringify(v));
assert.equal(cleanSonar({enabled:true,rings:3,x:0,z:0}),null,'the film\'s own values are not kept');
assert.deepEqual(cleanSonar({enabled:false}),{enabled:false});
assert.deepEqual(cleanSonar({radius:96.04,rings:5,x:-12.26,z:7}),{radius:96,rings:5,x:-12.3,z:7});
assert.deepEqual(cleanSonar({radius:1,rings:99}),{radius:FIELDS.radius.min,rings:FIELDS.rings.max},'clamped');
assert.deepEqual(cleanSonar({radius:9999,rings:0,x:1e9,z:-1e9}),{radius:FIELDS.radius.max,rings:FIELDS.rings.min,x:FIELDS.x.max,z:FIELDS.z.min});
assert.equal(cleanSonar({rings:2.6,junk:1,preview:true,full:true}),null,'rings round (2.6 is 3, the film\'s); unknown keys (a preview) are never kept');
assert.deepEqual(cleanSonar({rings:4.4,preview:true}),{rings:4});
assert.equal(cleanSonar({radius:'60',rings:NaN,x:Infinity,z:null,enabled:'no'}),null,'junk dropped');
assert.deepEqual(cleanSonar(cleanSonar({radius:80,rings:4,x:3,z:-3,enabled:false})),{radius:80,rings:4,x:3,z:-3,enabled:false},'idempotent');
// 2. the cut
const base={id:'awareness',room:'product',kind:'proximity',seconds:12,title:'Aware',preset:'gaming',transition:.8,size:'60x30'};
assert.ok(!('sonar' in cleanShot(base)),'absent stays absent');
for(const bad of [undefined,'x',[1],null,5])assert.ok(!('sonar' in cleanShot({...base,sonar:bad})),'not an object: no field');
assert.deepEqual(cleanShot({...base,sonar:{radius:70,rings:5,x:2,z:-4,preview:true}}).sonar,{radius:70,rings:5,x:2,z:-4});
assert.deepEqual(cleanShot({...base,sonar:{}}).sonar,{},'{} (back to the film\'s) is kept so a reset reaches the film');
assert.deepEqual(cleanShot({...base,sonar:{rings:3,x:0}}).sonar,{},'a copy of the film\'s is {}');
assert.deepEqual(cleanSonarField({}),{});assert.deepEqual(cleanSonarField({sonar:{enabled:false}}),{sonar:{enabled:false}});
// Export cut (director.mjs exportCut) = cleanCut(project) as JSON; and it loads back the same
const cut={schema:'ergoflex.client-cut',version:1,id:'t',name:'t',client:'',volume:.3,updated:'',shots:[{...base},{...base,id:'awareness-2',sonar:{radius:84,rings:5,x:6,z:-2}}]};
const exported=JSON.parse(JSON.stringify(cleanCut(cut)));
assert.ok(!('sonar' in exported.shots[0]),'Export cut: a chapter without it has no key (the file is as it was)');
assert.deepEqual(exported.shots[1].sonar,{radius:84,rings:5,x:6,z:-2},'Export cut carries it');
assert.deepEqual(cleanCut(exported).shots[1].sonar,exported.shots[1].sonar,'and Import cut / a reload keeps it');
const dir=src('experience/director.mjs');
assert.match(dir,/const exportText=\(\)=>JSON\.stringify\(\(\(c\)=>\(\{\.\.\.c,shots:c\.shots\.map\(s=>exportLighting\(/,'exportCut goes through cleanCut (exportText: the one serialisation Export cut and Send to desk share)');
assert.match(dir,/cleanCut\(project,catalog\)\),null,2\)/);
assert.match(dir,/sonar:'sonar'/,'the "what changed" list names it');assert.match(dir,/createSonarEditor\(/);assert.match(dir,/\$\{sonarEditor\.panel\(\)\}\$\{graphics\.panel\(\)\}/,'in the Graphics tab');
// 3. the film shot
const film={id:'awareness',room:'product',kind:'proximity',seconds:12,obstacles:[{x:0,ahead:1.25}],quality:'hq13'};
assert.ok(!('sonar' in liveFilmShot(film,{...base})),'live: absent leaves the film shot without it');
assert.equal(JSON.stringify(liveFilmShot(film,{...base})),JSON.stringify(liveFilmShot(film,{...base,sonar:undefined})));
assert.deepEqual(liveFilmShot(film,{...base,sonar:{rings:5}}).sonar,{rings:5},'live: the cut\'s over the film\'s');
assert.deepEqual(liveFilmShot({...film,sonar:{rings:2,radius:50}},{...base}).sonar,{rings:2,radius:50},'live: no cut field: the film\'s own stays');
assert.deepEqual(liveFilmShot({...film,sonar:{rings:2,radius:50}},{...base,sonar:{x:4}}).sonar,{x:4},'live: the cut\'s replaces the film\'s whole');
assert.ok(!('sonar' in liveFilmShot({...film,sonar:{rings:2}},{...base,sonar:{}})),'live: {} takes the film\'s off');
assert.ok(!('sonar' in filmRenderShot(film,{...base},[])),'render: absent: none');
assert.deepEqual(filmRenderShot(film,{...base,sonar:{enabled:false,x:-5}},[]).sonar,{enabled:false,x:-5},'render: the Director\'s');
assert.ok(!('sonar' in filmRenderShot({...film,sonar:{rings:2}},{...base,sonar:{}},[])),'render: {} takes the film\'s off');
assert.deepEqual(withSonar({a:1},{}),{a:1});
// 4. the stage maths. The reference is stage.mjs's ping loop as it was before this feature, verbatim.
function legacy({sec,pingStop,sonar,far,count}){
  const travel=7.2,gap=2.4,from=sonar*.06,speed=(sonar-from)/travel;
  const first=Math.ceil((sec-pingStop+travel)/gap-1e-9);let echoAge=Infinity;const rows=[];
  for(let i=0;i<count;i++){
    const age=sec-(pingStop-travel+(first-1-i)*gap),r=from+speed*age;
    if(age<0||r>=far){if(age>=0)echoAge=Math.min(echoAge,(r-far)/speed);rows.push({i,age,r,alive:false,a:0});continue;}
    rows.push({i,age,r,alive:true,a:.9*Math.min(1,age/.35)*(1-.3*r/far)});
  }
  return {from,speed,rows,echoAge};
}
let n=0;
for(const pingStop of [0,5.4,8.0999,9.9])for(const S of [.31,1.234567,2.9,17.5])for(const farK of [1,1.0001,1.37,2.5,3.1])for(let k=0;k<=240;k++){
  const sec=k*.05,far=S*farK,mine=pingRows({sec,pingStop,S,far,count:7,cfg:null}),old=legacy({sec,pingStop,sonar:S,far,count:7});
  assert.deepEqual(mine,old,`no sonar object: today's numbers exactly (${pingStop} ${S} ${farK} ${sec})`);n++;
  assert.deepEqual(pingRows({sec,pingStop,S,far,count:7}),old,'and with cfg left out');
}
assert.equal(gapOf(null),2.4);assert.equal(gapOf({}),2.4);assert.equal(gapOf({x:1}),2.4,'a sonar without rings keeps the film\'s gap');
assert.equal(TRAVEL/3,2.4,'three rings is the film\'s 2.4 s (so a stored 3 would change nothing; it is not kept)');
assert.equal(meshesFor(null),7);assert.equal(meshesFor({rings:2}),7);assert.equal(meshesFor({radius:50}),7,'the film\'s seven ping meshes unless more rings are asked for');
// rings per pulse: rings alive at once, spaced TRAVEL / rings; the film's own count is 3
for(let rings=1;rings<=6;rings++){
  const cfg=rings===3?null:{rings},S=2,pingStop=7.2,count=meshesFor(cfg),gap=gapOf(cfg);assert.ok(Math.abs(gap-TRAVEL/rings)<1e-12);
  const at=pingRows({sec:fullSec(pingStop,cfg),pingStop,S,far:S,count,cfg}),alive=at.rows.filter(r=>r.alive);
  assert.equal(alive.length,rings,`${rings} rings: Preview at full shows exactly ${rings} out at once`);
  const radii=alive.map(r=>r.r).sort((a,b)=>a-b);
  for(let i=1;i<radii.length;i++)assert.ok(Math.abs((radii[i]-radii[i-1])-at.speed*gap)<1e-9,'evenly spaced');
  assert.ok(radii.at(-1)<S&&radii[0]>at.from,'inside the reach, none at the centre\'s edge, none beyond');
  assert.ok(alive.every(r=>r.a>.5),'all clearly visible ('+alive.map(r=>r.a.toFixed(2))+')');
  // over a whole run, with the obstacle up to twice the reach away (the desk far from it), never more alive than meshes
  for(let sec=0;sec<40;sec+=.07)for(const far of [S,S*1.5,S*2]){const k=pingRows({sec,pingStop,S,far,count:1000,cfg}).rows.filter(r=>r.alive).length;assert.ok(k<=count,`${rings} rings: ${k} alive at ${sec} needs <= ${count} meshes`);}
  // a ping is exactly TRAVEL old (arriving at the reach) as the desk stops: the film's timing is kept for every count
  assert.ok(pingRows({sec:pingStop,pingStop,S,far:S,count:1000,cfg}).rows.some(r=>Math.abs(r.age-TRAVEL)<1e-9),`${rings}: a ping arrives as the desk stops`);
}
// 5. Preview at full is never saved
assert.equal(cleanSonar({preview:true,full:true,previewFull:true}),null);
assert.deepEqual(Object.keys(FIELDS).sort(),['radius','rings','x','z']);
const ed=src('experience/sonar-editor.mjs'),stageSrc=src('experience/stage.mjs');
const previewBranch=ed.slice(ed.indexOf("if(a==='preview')"),ed.indexOf("if(a==='reset-size')"));
assert.ok(previewBranch.includes('sonarPreview')&&!/write\(|commit\(|shot\(\)\./.test(previewBranch),'the Preview action only tells the stage: it never writes the shot');
assert.ok(!/previewFull/.test(ed),'the editor keeps no preview state of its own: the stage has it');
assert.match(stageSrc,/previewFull=false;sonarCfg=null;/,'the stage clears it with every chapter (clear)');
assert.match(stageSrc,/function edit\(on\)\{wake\(\);editorMode=!!on;if\(!on\)previewFull=false;/,'and when the editor plays or closes');
assert.ok(!/shot\.previewFull|shot\.preview/.test(stageSrc),'the stage never puts it in the shot');
// 6. the wiring
const player=src('experience/player.mjs');
assert.match(player,/staged=\{\.\.\.staged,sonar:shot\.sonar\}/,'player: the live film shot\'s sonar reaches the stage with the chapter');
assert.match(player,/stage\(\)\.sonarTrack\?\.\(so,s\.id\)/,'player: a change reaches the stage at once');
assert.match(stageSrc,/sonarTrack:\(value,id\)=>/);assert.match(stageSrc,/sonarSpace:\(\)=>/);assert.match(stageSrc,/sonarPreview:\(on,id\)=>/);
assert.match(stageSrc,/return sonarCfg&&\(sonarCfg\.x\|\|sonarCfg\.z\)\?ringAt\.add\(sonarShift\(\)\):ringAt;/,'no offset: the centre is the desk\'s exactly as before');
assert.match(stageSrc,/const S=sonarCfg\?\.radius\?sonarCfg\.radius\*unitsPerInch\(\):R,hold=previewFull;/,'no sonar: S is the film\'s reach (R)');
// 7. (21 Nov 2026, Vico on awareness: no rings in the Director, nor at Preview at full) the reach is looked for until it is
// found: every tick for the first 240 (the film render as before), then every 400 ms, and while the Director is paused;
// found late while paused, the frame is drawn again. With no obstacle on the stage, the Director's Size draws the rings.
assert.match(stageSrc,/const sonarDue=\(\)=>\{if\(sonarTries\+\+<240\)return true;const now=performance\.now\(\);if\(now<sonarNext\)return false;sonarNext=now\+400;return true;\};/);
assert.match(stageSrc,/if\(kind==='proximity'&&reach&&!sonar&&sonarDue\(\)\)sonar=sonarReach\(\);/);
assert.ok(!/sonarTries\+\+<240\)sonar=sonarReach/.test(stageSrc),'no longer given up after 240 tries');
assert.match(stageSrc,/const sonarR=\(\)=>sonar\|\|\(ringHome&&sonarCfg\?\.radius\?sonarCfg\.radius\*unitsPerInch\(\):0\);/,'the reach: the film\'s, else the Director\'s size');
assert.match(stageSrc,/const R=kind==='proximity'\?sonarR\(\):0;/);assert.match(stageSrc,/if\(R&&pings\.length\)\{\n {8}\/\/ the reach in this frame/,'the rings draw on R');
assert.match(stageSrc,/if\(!Number\.isFinite\(far\)\|\|far<=0\)far=R;/,'no obstacle: far is R');
assert.match(stageSrc,/setInterval\(\(\)=>\{if\(!paused\|\|!editorMode\|\|preparing\|\|shot\?\.kind!=='proximity'\|\|!reach\|\|sonar\|\|document\.hidden\)return;const r=sonarReach\(\);if\(r\)\{sonar=r;wake\(\);seek\(lastProgress\);\}\},500\);/,'paused in the Director (the loop may sleep): a timer looks, and draws again when found');
assert.match(stageSrc,/return \{found:!!sonarR\(\),obstacle:!!sonar,/,'the panel: found (rings drawable) and obstacle');
assert.match(ed,/i\.obstacle\?` \(the film's: \$\{toUnit\(film,u\)\} \$\{U\}\)`:' \(your size: the obstacle has not been found on this stage yet\)'/,'the readout says when it is the size alone');
assert.match(ed,/Set a Size to see the rings right away\./);
// 8. the live band (21 Nov 2026: the meshes drawn at opacity .83, not a pixel on screen in the Director): at least 2.5 screen
// pixels where the ring lies, wider on a slanted floor, and in a bake (render-cut, render-still, Render still) the film's
// own w*.007, so the film stays pixel-identical
assert.match(stageSrc,/const liveBand=\(band,at\)=>\{\n {4}if\(bakeSession\)return band;/,'in a bake: the film\'s band');
assert.match(stageSrc,/return Math\.max\(band,2\*perPx\/slant\);/,'live: at least 2 px');
// ...and depth (org, the desk's Chrome: lifted 5 cm alone, the rings showed; the live floor buried them): live the pings and
// the echo ride LIVE_LIFT above their film height, still depth-tested; in a bake their film height
assert.match(stageSrc,/const LIVE_LIFT=\.04,ringY=m=>\{m\.position\.y=m\.userData\.y0\+\(bakeSession\?0:LIVE_LIFT\);\};/);
assert.match(stageSrc,/m\.position\.y=y;m\.userData\.y0=y;m\.renderOrder=RING_ORDER;/,'each ring keeps its film height');
assert.match(stageSrc,/setRing\(ring,row\.r,band\);ringY\(ring\);/);assert.match(stageSrc,/ringY\(echo\);echo\.visible=/);
assert.ok(!/depthTest:false/.test(stageSrc.slice(stageSrc.indexOf('const ringMesh'),stageSrc.indexOf('const ringMesh')+400)),'still depth-tested');
assert.match(stageSrc,/band=liveBand\(w\*\.007,d\),off=sonarCfg\?\.enabled===false;/,'the pings and the echo take it');
assert.match(stageSrc,/window\.__sonarDebug=\(deep=false\)=>\{/,'a debug hook for a real browser');
assert.match(stageSrc,/pingRows\(\{sec,pingStop,S,far,count:pings\.length,cfg:sonarCfg\}\)/);
assert.match(stageSrc,/Array\.from\(\{length:meshesFor\(sonarCfg\)\}/,'seven ping meshes when absent');
assert.match(stageSrc,/ringHome=\{c:c\.clone\(\),p:[^}]*q:ctx\.loadedModel\.getWorldQuaternion/);
const py=src('tools/experience/build-round8-director.py');
assert.match(py,/def clean_sonar\(v\)/);assert.match(py,/apply_sonar\(cid, f, load\(p\)\['sonar'\]\)/);assert.match(py,/dc\['sonar'\] = clean_sonar\(shot\['sonar'\]\)/);
// units: inches stored, centimetres shown
assert.equal(toUnit(10,'in'),10);assert.equal(toUnit(10,'cm'),25.4);assert.equal(fromUnit(25.4,'cm'),10);assert.equal(fromUnit(7,'in'),7);
for(const v of [6,12.5,60,240.5])assert.ok(Math.abs(fromUnit(toUnit(v,'cm'),'cm')-v)<.05,'cm round trip to .05 in');
console.log(`sonar controls test: ok (${n} ping-loop frames identical to today's)`);
