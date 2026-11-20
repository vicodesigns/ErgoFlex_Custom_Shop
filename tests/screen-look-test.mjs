// The screens' look (experience/screen-look.mjs, film-fx.mjs, film-quality.mjs, the Graphics tab; 19 Nov 2026), without a
// browser. Vico: the screens are "a little too bright, they pop out too much … make it look more like a monitor image".
//   1. the fields: today's values are the defaults; a look keeps only what differs, clamped; per screen over all screens
//   2. today's look is today's pixels: film-fx leaves the screen's material exactly as before (no shader change, the same
//      colour), and the maths is the identity there
//   3. a look: the screen's own shader gets the adjustment after the picture is sampled (the real three.js basic shader),
//      its uniforms are the look's; strength goes into the colour with the screen's brightness and screenGain; spill
//      into the mesh for film-quality's bloom; back to today's: the material is as before again
//   4. the maths: dull, flatter, lifted blacks, grey, warmer / cooler, glare lifting the darks most
//   5. the data path: the cut keeps it (and {} for a reset), the live / Render-still film shot takes the cut's over the
//      film's, Export cut, render-cut / render-still pass it to film-fx, film-fx updates it in place, film-quality scales
//      the screen's bloom by its spill (1: the glow pass as it was)
//   node tests/screen-look-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FIELDS,KEYS,cleanValues,cleanScreenLook,lookFor,isToday,SHADED,applyLook,tintOf,uniformsOf,GLSL,CALL,cleanScreenLookField,withScreenLook} from '../experience/screen-look.mjs';
import {cleanCut,makeCut} from '../experience/cuts.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;
// 1
assert.deepEqual(KEYS,['brightness','contrast','black','saturation','warmth','glare','spill']);
assert.deepEqual(Object.fromEntries(KEYS.map(k=>[k,FIELDS[k].def])),{brightness:1,contrast:1,black:0,saturation:1,warmth:0,glare:0,spill:1},'100 % is today');
assert.equal(cleanValues({brightness:1,contrast:1}),null,'today\'s values are left out');
assert.deepEqual(cleanValues({brightness:.55,black:.9,saturation:'x',glare:NaN}),{brightness:.55,black:.25},'clamped, junk dropped');
assert.equal(cleanScreenLook({all:{brightness:1},per:{monitor:{}}}),null,'nothing that changes anything: no field');
const look={all:{brightness:.6,black:.04},per:{'ergoflex-wide-monitor/monitor-screen':{brightness:.8,saturation:.7},'bad\u0000':{brightness:.5}}};
const c=cleanScreenLook(look);assert.deepEqual(c,{all:{brightness:.6,black:.04},per:{'ergoflex-wide-monitor/monitor-screen':{brightness:.8,saturation:.7}}});
assert.deepEqual(lookFor(c,'main-landscape'),{brightness:.6,contrast:1,black:.04,saturation:1,warmth:0,glare:0,spill:1},'a screen without its own: all screens');
assert.deepEqual(lookFor(c,'ergoflex-wide-monitor/monitor-screen'),{brightness:.8,contrast:1,black:.04,saturation:.7,warmth:0,glare:0,spill:1},'its own over all screens');
assert.ok(isToday(lookFor(null,'x'))&&isToday(lookFor({}, 'x')));
// 2 + 3: film-fx's own functions, on a real three.js material
const fx=readFileSync(new URL('../tools/experience/film-fx.mjs',import.meta.url),'utf8');
const fn=name=>{const i=fx.search(new RegExp(`\\n(?:function ${name}\\(|const ${name} = )`));assert.ok(i>=0,name);const start=fx.indexOf(name,i);
  if(fx.slice(i,i+7)==='\nconst '){const end=fx.indexOf(';\n',start);return fx.slice(i+1,end+1);}const end=fx.indexOf('\n}\n',start);assert.ok(end>0);return fx.slice(i+1,end+2);};   // (a top-level function ends at a closing brace at column 0; its strings have braces of their own)
const keyAt=(k,t)=>{let v=k[0][1];for(const [s,x] of k)if(t>=s)v=x;return v;};
const F=new Function('THREE','lookFor','uniformsOf','LOOK_GLSL','LOOK_CALL','LOOK_SHADED','isToday','keyAt',`${fn('shadeScreen')}\n${fn('gainOf')}\n${fn('lookScreens')}\nreturn {shadeScreen,gainOf,lookScreens};`)(THREE,lookFor,uniformsOf,GLSL,CALL,SHADED,isToday,keyAt);
const screen=(spec={target:'main-landscape'})=>{const m=new THREE.MeshBasicMaterial({map:new THREE.Texture(),toneMapped:false});return {spec,key:String(spec.target),mesh:new THREE.Mesh(new THREE.PlaneGeometry(),m)};};
let sc=screen();const plain=new THREE.MeshBasicMaterial();
F.lookScreens([sc],{screenGain:1.3});
assert.ok(!Object.hasOwn(sc.mesh.material,'onBeforeCompile')&&!Object.hasOwn(sc.mesh.material,'customProgramCacheKey'),'2. today\'s look: the material\'s shader is untouched');
assert.equal(sc.mesh.material.onBeforeCompile,plain.onBeforeCompile);assert.equal(sc.mesh.material.customProgramCacheKey(),plain.customProgramCacheKey());
assert.equal(sc.mesh.material.color.r,1.3,'2. its colour: brightness x screenGain, as before');assert.equal(sc.mesh.userData.screenSpill,1);
for(const rgb of [[0,0,0],[1,1,1],[.03,.5,.9],[.214,.214,.214]])applyLook(rgb,lookFor(null)).forEach((x,i)=>assert.ok(near(x,rgb[i],1e-12),'2. the identity at today\'s values'));
sc=screen({target:'main-landscape',brightness:[[0,.5],[2,1]]});
F.lookScreens([sc],{screenGain:2,screenLook:{all:{brightness:.6,contrast:.8,black:.04,saturation:.7,warmth:.5,glare:.3,spill:.4}}});
const m=sc.mesh.material;assert.ok(near(m.color.r,.5*2*.6),'3. strength x the screen\'s own (keyed) brightness x screenGain: '+m.color.r);
assert.ok(near(F.gainOf(sc,{screenGain:2},2),1*2*.6),'3. and at a later key');
assert.equal(sc.mesh.userData.screenSpill,.4,'3. spill for film-quality');
assert.equal(m.customProgramCacheKey(),'film-screen-look');
const shader={uniforms:{},fragmentShader:THREE.ShaderLib.basic.fragmentShader};m.onBeforeCompile(shader);
assert.ok(shader.fragmentShader.includes('vec3 screenLookApply( vec3 c )')&&/#include <map_fragment>\n\tdiffuseColor\.rgb = screenLookApply\( diffuseColor\.rgb \);/.test(shader.fragmentShader),'3. the adjustment runs right after the picture is sampled');
assert.ok(shader.fragmentShader.indexOf('uniform vec4 screenLook')<shader.fragmentShader.indexOf('void main() {'));
const u=uniformsOf(lookFor({all:{contrast:.8,black:.04,saturation:.7,warmth:.5,glare:.3}},'x'));
assert.deepEqual(shader.uniforms.screenLook.value.toArray(),u.look);assert.deepEqual(shader.uniforms.screenTint.value.toArray().map(x=>+x.toFixed(6)),u.tint.map(x=>+x.toFixed(6)));
F.lookScreens([sc],{screenGain:2,screenLook:{all:{brightness:.6}}});
assert.ok(!Object.hasOwn(m,'onBeforeCompile')&&!Object.hasOwn(m,'customProgramCacheKey')&&!m.userData.screenLook,'3. strength alone: no shader');
assert.ok(near(m.color.r,.5*2*.6));
F.lookScreens([sc],{screenGain:2});assert.ok(near(m.color.r,1)&&sc.mesh.userData.screenSpill===1,'3. back to today\'s');
// 4
const v=k=>({...lookFor(null),...k});
const lum=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
assert.ok(lum(applyLook([.9,.9,.9],v({contrast:.6})))<.9&&lum(applyLook([.02,.02,.02],v({contrast:.6})))>.02,'4. lower contrast: flatter');
assert.ok(near(applyLook([0,0,0],v({black:.05}))[0],.05),'4. black level: black is lifted');
const g=applyLook([.8,.1,.1],v({saturation:0}));assert.ok(near(g[0],g[1])&&near(g[1],g[2]),'4. saturation 0: grey');
const w=applyLook([.5,.5,.5],v({warmth:1})),cl=applyLook([.5,.5,.5],v({warmth:-1}));assert.ok(w[0]>w[2]&&cl[2]>cl[0],'4. warmer: more red than blue; cooler: the other way');
assert.deepEqual(tintOf(0),[1,1,1]);
const gl=v({glare:1});assert.ok(applyLook([0,0,0],gl)[0]-0>applyLook([.9,.9,.9],gl)[0]-.9,'4. glare lifts the darks most');
assert.match(GLSL,/0\.214[^]*0\.12/,'(the shader and applyLook share their constants)');assert.equal(CALL,'diffuseColor.rgb = screenLookApply( diffuseColor.rgb );');
// 5
assert.deepEqual(cleanScreenLookField({screenLook:{all:{brightness:.7,contrast:1}}}),{screenLook:{all:{brightness:.7}}});
assert.deepEqual(cleanScreenLookField({screenLook:{}}),{screenLook:{}},'a reset is kept (it must reach the film)');assert.deepEqual(cleanScreenLookField({}),{});
const cut=makeCut('Test');cut.shots[0].screenLook={all:{brightness:.7}};
assert.deepEqual(cleanCut(JSON.parse(JSON.stringify(cut)),null).shots[0].screenLook,{all:{brightness:.7}},'the cut keeps it (drafts, Export cut)');
const film={id:'coast',seconds:14.5,screens:[{target:'main-landscape',src:'a.mp4'}],screenLook:{all:{brightness:.5}}};
assert.deepEqual(liveFilmShot(film,{id:'coast',seconds:14.5}).screenLook,{all:{brightness:.5}},'the film\'s look while the cut has none');
assert.deepEqual(liveFilmShot(film,{id:'coast',seconds:14.5,screenLook:{all:{black:.05}}}).screenLook,{all:{black:.05}},'the cut\'s over the film\'s');
assert.equal(liveFilmShot(film,{id:'coast',seconds:14.5,screenLook:{}}).screenLook,undefined,'a reset: the film\'s goes');
assert.deepEqual(withScreenLook({screenLook:{all:{brightness:.5}}},{}),{screenLook:{all:{brightness:.5}}});
const fr=readFileSync(new URL('../experience/film-render.mjs',import.meta.url),'utf8');assert.match(fr,/withScreenLook\(next,shot\);/,'Render still / Film look take it');
for(const f of ['render-cut.cjs','render-still.cjs'])assert.match(readFileSync(new URL('../tools/experience/'+f,import.meta.url),'utf8'),/const FX_FIELDS=\[[^\]]*'screenLook'\]/,f+' passes it to film-fx');
assert.match(fx,/const LIVE_FIELDS = \['screenLook',/,'film-fx updates it in place (no reinstall)');assert.match(fx,/if \(changed\('screenLook'\)\) lookScreens\(active\.screens, shot\);/);
assert.match(fx,/lookScreens\(\[sc\], shot\);/,'and applies it at install');
const pl=readFileSync(new URL('../experience/player.mjs',import.meta.url),'utf8');assert.match(pl,/l\.screens,s\.screenLook\]\);/,'the live stage refreshes on an edit');
const q=readFileSync(new URL('../tools/experience/film-quality.mjs',import.meta.url),'utf8');
assert.match(q,/const share = isScreen \? \(q\.screenBloom !== undefined && Number\(q\.screenBloom\) < 1 \? Number\(q\.screenBloom\) : 1\) \* \(screenMeshes\.has\(o\) \? Number\(o\.userData\.screenSpill \?\? 1\) : 1\) : 1;/,'film-quality: the bloom share x the spill');
assert.match(q,/if \(q\.bloom && isScreen && share !== 1\) \{/,'share 1 (today): the glow pass as it was');
const ge=readFileSync(new URL('../experience/graphics-editor.mjs',import.meta.url),'utf8');
assert.match(ge,/name="sl-target"[^]*'All screens'/,'the Graphics tab: All screens or one');assert.ok(KEYS.every(k=>ge.includes('name="sl-${k}"')),'a slider for each');
assert.match(ge,/data-sl-action="reset"/);assert.match(ge,/commit\(\(\)=>\{shot\(\)\.screenLook=clean\|\|\{\};\},\{key,render:false\}\)/,'one undo step per slider drag, saved in the chapter');
console.log('screen-look-test: ok (today\'s look leaves the screens as they were; a look shades them, live, in the cut, the export and the render)');
