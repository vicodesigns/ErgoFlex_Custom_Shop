// Desk versions (experience/desk-versions.mjs): the finale's sub-shots as Director segments, the desk shown at a time
// (overlap midpoints), the stage shot (preset + kind) and the Render still shot (the sub-shot's own film shot).
import assert from 'node:assert/strict';
import {deskVersions,versionAt,versionShot,versionRenderShot,presetSwatch,presetLabel,loadFilmSubshots,loadStorageSeed} from '../experience/desk-versions.mjs';

const range={A:[0,5.3],B:[4.7,13.1],C:[12.5,21.9],D:[21.3,27.7],E:[27.1,34],F:[33.4,48]},presets=['artist','occ','architect','hbhs','office','gaming'];
const film={id:'hero',preset:'gaming',kind:'glide',seconds:48,subshots:range,presets,sceneGlobals:{exposure:.95},cameraPlan:{keys:[{at:0,position:[4,2,8],target:[0,1,0],fov:26},{at:48,position:[5,2,6],target:[0,1,0],fov:26}]}};
const subs=Object.entries(range).map(([n,r],i)=>({...film,subshots:undefined,presets:undefined,subshot:n,renderRange:r,preset:presets[i],kind:n==='F'?'glide':'hero',sceneGlobals:{exposure:.6+i*.05},...(n==='E'?{accessories:{add:[{id:'calculator'}]}}:{})}));

assert.deepEqual(deskVersions({id:'x'},subs),[],'no sub-shots map: no versions');
const v=deskVersions(film,subs);
assert.deepEqual(v.map(x=>`${x.n} · ${x.label}`),['A · Artist','B · OCC','C · Architect','D · HBHS','E · Office','F · Gaming']);
assert.deepEqual(v.map(x=>[x.start,x.end]),Object.values(range));
assert.deepEqual(v.map(x=>+x.from.toFixed(3)),[0,5,12.8,21.6,27.4,33.7],'each desk starts at the middle of its crossfade in');
assert.equal(v.at(-1).to,Infinity);
for(const [t,n] of [[0,'A'],[2,'A'],[4.99,'A'],[5,'B'],[8,'B'],[17,'C'],[24,'D'],[30,'E'],[33.69,'E'],[33.7,'F'],[40,'F'],[48,'F']])assert.equal(versionAt(v,t).n,n,`${t} s -> ${n}`);
assert.equal(v[4].setup.accessories.add[0].id,'calculator','E carries its own film shot');
// Without the sub-shots file: the map and preset order alone (preset only).
const bare=deskVersions(film,null);assert.equal(bare.length,6);assert.equal(bare[1].preset,'occ');assert.equal(bare[1].setup,null);

// Stage shot: the chapter with the sub-shot's preset and kind; F keeps glide (the ergonomic keyboard swap).
const shot={id:'hero',room:'product',kind:'glide',seconds:48,preset:'gaming',size:'60x30'};
assert.deepEqual(versionShot(shot,v[1]),{...shot,preset:'occ',kind:'hero'});
assert.deepEqual(versionShot(shot,v[5]),{...shot,preset:'gaming',kind:'glide'});
assert.equal(versionShot(shot,null),shot);
// Render still: the sub-shot's film shot (its exposure, accessories), the sub-shot's preset over the cut's.
const job=versionRenderShot(film,shot,null,v[4]);
assert.equal(job.preset,'office');assert.equal(job.kind,'hero');assert.equal(job.sceneGlobals.exposure,subs[4].sceneGlobals.exposure);assert.equal(job.accessories.add[0].id,'calculator');
assert.equal(versionRenderShot(film,shot,null,null).preset,'gaming');
assert.equal(versionRenderShot(film,shot,null,bare[2]).preset,'architect','preset only: the main film shot with the preset swapped');

// Swatches: the build's own desktop finish, frame and trim.
assert.deepEqual([presetSwatch('occ').woodName,presetSwatch('occ').wood,presetSwatch('occ').trim],['Coast Navy','#002d6a','#f99239']);
assert.equal(presetSwatch('gaming').trim,'#dc0909');assert.equal(presetLabel('hbhs'),'HBHS');

// The sub-shots file next to the film shot; missing -> null.
const seen=[],fetcher=async url=>{seen.push(url);return url.endsWith('/director-film/hero-subshots.json')?{ok:true,json:async()=>({shots:[...subs,{id:'other',subshot:'Z'}],storage:'/exports/x/post/finale-seed.json'})}:url.endsWith('/post/finale-seed.json')?{ok:true,json:async()=>({'ergoflex.buildPresetsV1':'{"format":1}',n:{a:1}})}:{ok:false};};
const loaded=await loadFilmSubshots('http://h/exports/x/director-film/hero.json','hero',fetcher);
assert.equal(seen[0],'http://h/exports/x/director-film/hero-subshots.json');assert.equal(loaded.shots.length,6);assert.equal(loaded.storage,'http://h/exports/x/post/finale-seed.json');
assert.equal(deskVersions(film,loaded)[4].setup.preset,'office','the loaded file feeds deskVersions');
assert.deepEqual(await loadStorageSeed(loaded.storage,fetcher),{'ergoflex.buildPresetsV1':'{"format":1}',n:'{"a":1}'},'seed values stay strings');
assert.equal(await loadFilmSubshots('http://h/exports/x/director-film/rise.json','rise',fetcher),null);
console.log('Desk versions: 6 finale sub-shots as segments, desk changes at the crossfade middles, stage + Render still shots per sub-shot, swatches and the sub-shots file passed.');
