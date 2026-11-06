import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cleanSceneLights,mergeSceneLights,lightPath,sceneLightList,findLight,installLightEdits} from '../experience/light-edits.mjs';
import {cleanShot} from '../experience/cuts.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
const THREE=await import(createRequire(import.meta.url).resolve('three',{paths:['/home/ergo/ErgoFlex_Custom_Shop/node_modules']}));
// Cleaning: added lights need a director- name, a type and a position; edits need a target and a change.
const clean=cleanSceneLights({lights:[{name:'director-ab12',type:'spot',position:[1,2,3],target:[0,0,0],color:'#FFAA00',intensity:120,angle:30,penumbra:.5},{name:'key',type:'rect',position:[0,0,0]},{name:'director-x',type:'laser',position:[0,0,0]}],
  lightEdits:[{target:'Room:home > PointLight#2',position:[1,1,1],intensityScale:2,color:'#ff0000',junk:1},{target:'Room:home > PointLight#2',visible:false},{target:'x'}]});
assert.deepEqual(clean.lights.map(l=>l.name),['director-ab12']);assert.equal(clean.lights[0].color,'#ffaa00');
assert.deepEqual(clean.lightEdits,[{target:'Room:home > PointLight#2',position:[1,1,1],color:'#ff0000',intensityScale:2,visible:false}]);
assert.equal(Object.keys(cleanShot({id:'x',room:'product'})).includes('lightEdits'),false);
assert.equal(cleanShot({id:'x',room:'product',...clean}).lightEdits.length,1);
// Merge: the film's lights (productRig) plus the Director's, edits carried; render and live shots both get them.
const film={id:'awaken',seconds:10,lights:[{preset:'productRig',key:{intensity:[[0,6],[5,22]]}}],quality:{bloom:false}};
const shot={id:'awaken',seconds:10,room:'product',kind:'glide',...clean};
assert.deepEqual(mergeSceneLights(film,shot).lights.map(l=>l.preset||l.name),['productRig','director-ab12']);
assert.equal(liveFilmShot(film,shot).lights.length,2);assert.equal(liveFilmShot(film,shot).lightEdits[0].intensityScale,2);
assert.equal(filmRenderShot(film,shot,[]).lights.length,2);assert.equal(filmRenderShot(film,{...shot,lights:undefined,lightEdits:undefined},[]).lights.length,1);
// Paths: names or types, '#n' for repeated siblings.
const scene=new THREE.Scene(),room=new THREE.Group();room.name='Room:home';scene.add(room);
const lamps=[0,1,2].map(i=>{const l=new THREE.PointLight('#ffcc99',.3,0,2);l.position.set(i,1,0);room.add(l);return l;});
const sun=new THREE.DirectionalLight('#ffffff',1);scene.add(sun);
assert.deepEqual(sceneLightList(scene).map(e=>e.path),['Room:home > PointLight','Room:home > PointLight#1','Room:home > PointLight#2','DirectionalLight']);
assert.equal(lightPath(lamps[2],scene),'Room:home > PointLight#2');assert.equal(findLight(scene,'Room:home > PointLight#1'),lamps[1]);
// Install: world position (room group offset), colour, scale over whatever writes the intensity, restore undoes all.
room.position.set(10,0,0);scene.updateMatrixWorld(true);
const fx=installLightEdits([{target:'Room:home > PointLight#2',position:[1,2,3],color:'#ff0000',intensityScale:2,visible:false},{target:'Room:home > Nope',color:'#00ff00'}],scene);
assert.deepEqual(fx.missing,['Room:home > Nope']);
assert.deepEqual(lamps[2].getWorldPosition(new THREE.Vector3()).toArray().map(v=>+v.toFixed(6)),[1,2,3]);assert.equal(lamps[2].color.getHexString(),'ff0000');assert.equal(lamps[2].visible,false);
assert.equal(lamps[2].intensity,.6);lamps[2].intensity=5;assert.equal(lamps[2].intensity,10,'time-of-day style writers set the raw value; the edit scales it');
lamps[2].color.set('#123456');fx.apply();assert.equal(lamps[2].color.getHexString(),'ff0000','re-applied every frame over per-frame writers');
fx.restore();assert.equal(lamps[2].intensity,5);assert.equal(lamps[2].color.getHexString(),'ffcc99');
assert.deepEqual(lamps[2].position.toArray(),[2,1,0]);assert.equal(lamps[2].visible,true);assert.equal(Object.getOwnPropertyDescriptor(lamps[2],'intensity').writable,true);
// Spot aim in world space.
const spot=new THREE.SpotLight('#ffffff',50);room.add(spot);room.add(spot.target);scene.updateMatrixWorld(true);
installLightEdits([{target:'Room:home > SpotLight',aim:[0,0,5],angle:40}],scene);
assert.deepEqual(spot.target.getWorldPosition(new THREE.Vector3()).toArray().map(v=>+v.toFixed(6)),[0,0,5]);assert.ok(Math.abs(spot.angle-40*Math.PI/180)<1e-9);
console.log('Scene lights: clean / merge into live and render shots, stable light paths, world-space moves and aims, colour re-applied each frame, intensity scaling over keyed writers, missing targets reported and full restore verified.');
