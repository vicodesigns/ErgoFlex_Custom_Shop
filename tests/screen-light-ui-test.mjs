// The Lighting tab's Screen light controls (21 Nov 2026, Vico on the media chapters: "the colors on the reflections are a
// bit bright and washed out"; docs/screen-reflection/CONTRACT.md). Pure + the Director's wiring:
//   node tests/screen-light-ui-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMedia,screenLightNow,screenLightChange,screenLightField,screenLightSummary,screenLightHTML,FIELDS,KEYS} from '../experience/screen-light-ui.mjs';
import {cleanLighting} from '../experience/film-lighting.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r/g,'');
const cut=JSON.parse(read('exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json')),shot=id=>cut.shots.find(s=>s.id===id);
const music=shot('music'),media=shot('media');

// ---- 1 only the media chapters (ledMode 'media')
assert.deepEqual(cut.shots.filter(s=>isMedia(s)).map(s=>s.id).sort(),['media','music'],'ch 9 music and ch 10 media');
assert.equal(isMedia(null,{ledMode:'media'}),true,'(the Director shot when there is no film shot)');assert.equal(isMedia({ledMode:'full'},{ledMode:'media'}),false,'the film decides');

// ---- 2 what the sliders show: the chapter's data defaults (the engineer's picks) until edited; {} = 100 %
{
  const m=screenLightNow(undefined,media.sceneGlobals.screenLight);
  assert.equal(m.from,'film');assert.deepEqual(m.values,{gain:.6,saturation:1.4,contrast:1,tint:'#ffffff',keepHue:true},'ch 10 opens at 60 %, 140 %, keep colours');
  const n=screenLightNow(undefined,music.sceneGlobals.screenLight);assert.deepEqual([n.values.gain,n.values.saturation,n.values.keepHue],[.55,1.5,false],'ch 9 at 55 %, 150 %');
  assert.deepEqual(screenLightNow({},media.sceneGlobals.screenLight),{values:{gain:1,saturation:1,contrast:1,tint:'#ffffff',keepHue:false},from:'director'},'{} = as before, edited here');
  assert.equal(screenLightNow({gain:.8},media.sceneGlobals.screenLight).values.saturation,1,'the Director\'s object replaces the film\'s whole (as the live shot and the importer do)');
  assert.equal(screenLightNow(undefined,undefined).from,'today');assert.equal(screenLightNow(undefined,{}).from,'today');
}

// ---- 3 a field changed -> the field written (only what differs from today; {} for all defaults)
{
  const v=screenLightNow(undefined,media.sceneGlobals.screenLight).values;
  let n=screenLightChange(v,{name:'scl-gain',type:'range',value:'45'});assert.equal(n.gain,.45,'% -> fraction');
  assert.deepEqual(screenLightField(n),{gain:.45,saturation:1.4,keepHue:true},'the rest of the chapter\'s values are kept');
  n=screenLightChange(n,{name:'scln-saturation',type:'number',value:'100'});assert.deepEqual(screenLightField(n),{gain:.45,keepHue:true},'100 % is today\'s: not stored');
  n=screenLightChange(n,{name:'scl-keepHue',type:'checkbox',checked:false});assert.equal(n.keepHue,false);
  n=screenLightChange(n,{name:'scl-tint',type:'color',value:'#FFE0C0'});assert.equal(n.tint,'#ffe0c0');
  n=screenLightChange(n,{name:'scln-contrast',type:'number',value:'130'});assert.equal(n.contrast,1.3);
  assert.deepEqual(screenLightField(n),{gain:.45,contrast:1.3,tint:'#ffe0c0'});
  assert.deepEqual(screenLightField({gain:1,saturation:1,contrast:1,tint:'#ffffff',keepHue:false}),{},'all defaults: {}');
  assert.throws(()=>screenLightChange(v,{name:'scln-gain',value:'400'}),/Brightness runs from 0 % to 300 %/);
  assert.throws(()=>screenLightChange(v,{name:'scln-contrast',value:'40'}),/Contrast runs from 50 % to 200 %/);
  assert.throws(()=>screenLightChange(v,{name:'scln-gain',value:''}),/Type a number/);
  assert.throws(()=>screenLightChange(v,{name:'scl-tint',value:'red'}),/colour/);
  assert.equal(screenLightChange(v,{name:'scl-nothing',value:'1'}),null,'not a field');
  assert.equal(screenLightSummary(n),'45 % · sat 100 % · contrast 130 % · tint #ffe0c0');
  assert.equal(screenLightSummary(v),'60 % · sat 140 % · keeps colours');
}

// ---- 4 the panel: a control per FIELDS key, in its range, the source said, the two ways back
{
  const html=screenLightHTML(screenLightNow(undefined,media.sceneGlobals.screenLight),{filmValues:media.sceneGlobals.screenLight});
  for(const k of KEYS){const f=FIELDS[k];assert.ok(html.includes(`name="scl-${k}"`),k);if(!f.bool&&!f.color)assert.ok(html.includes(`name="scln-${k}"`)&&html.includes(`min="${Math.round(f.min*100)}" max="${Math.round(f.max*100)}"`),k+' range in %');}
  assert.match(html,/name="scl-gain" min="0" max="300" step="1" value="60"/);assert.match(html,/name="scl-keepHue" checked/);
  assert.match(html,/data-from="film"/);assert.match(html,/chapter's own values/);assert.doesNotMatch(html,/screen-light-film/,'not edited: no "chapter\'s values" button');
  assert.match(html,/data-action="screen-light-reset" (?!disabled)/,'100 % offered');
  const edited=screenLightHTML(screenLightNow({gain:.3},media.sceneGlobals.screenLight),{filmValues:media.sceneGlobals.screenLight});
  assert.match(edited,/data-action="screen-light-film"/,'edited: back to the chapter\'s values');
  assert.match(screenLightHTML(screenLightNow({},null)),/data-action="screen-light-reset" disabled/,'at 100 % already');
}

// ---- 5 the cut keeps it (cleanLighting: {} kept, defaults dropped) and Render still / the live shot take the Director's whole
assert.deepEqual(cleanLighting({sceneGlobals:{screenLight:{}}}).sceneGlobals,{screenLight:{}});
assert.deepEqual(cleanLighting({sceneGlobals:{screenLight:{gain:.45,saturation:1}}}).sceneGlobals,{screenLight:{gain:.45}});
{
  const fr=read('experience/film-render.mjs'),fc=read('experience/film-chapters.mjs');
  assert.match(fr,/next\.sceneGlobals=\{\.\.\.next\.sceneGlobals,\.\.\.structuredClone\(shot\.sceneGlobals\)\}/,'Render still: the Director\'s sceneGlobals over the film\'s');
  assert.match(fc,/next\.sceneGlobals=\{\.\.\.next\.sceneGlobals,\.\.\.lit\.sceneGlobals\}/,'the live film shot too');
  assert.match(read('tools/experience/film-fx.mjs'),/if \(gChanged\('screenLight'\) && active\.led\) active\.led\.light = screenLightTransform\(g1\.screenLight\)/,'film-fx applies a change in place');
}

// ---- 6 the Director's wiring
const dm=read('experience/director.mjs');
assert.match(dm,/import \{isMedia,screenLightNow,screenLightChange,screenLightField,screenLightSummary,screenLightHTML\} from '\.\/screen-light-ui\.mjs\?v=screen-light-20261121';/);
assert.match(dm,/from '\.\/film-lighting\.mjs\?v=screen-light-20261121';/,'film-lighting (now carrying screenLight) versioned');
assert.match(dm,/\$\{globalFields\(\['ledWallGlow','ledFloorGlow'\]\)\}\$\{media\?screenLightPanel\(\):''\}/,'in Room, after the LED glow rows, media chapters only');
assert.match(dm,/const screenLightState=\(\)=>screenLightNow\(shot\(\)\.sceneGlobals\?\.screenLight,filmShot\(\)\?\.sceneGlobals\?\.screenLight\);/);
assert.match(dm,/if\(field===undefined\)delete g\.screenLight;else g\.screenLight=field;s\.sceneGlobals=g;/,'written into shot.sceneGlobals (deleted: the film\'s again)');
assert.match(dm,/if\(\/\^scl-\/\.test\(name\)&&\(el\.type==='range'\|\|el\.type==='color'\)\)\{try\{setScreenLight\(el,\{live:true\}\);/,'a drag is live, one undo step');
assert.match(dm,/if\(\/\^scln\?-\/\.test\(name\|\|''\)\)\{try\{setScreenLight\(event\.target\);/,'numbers, checkbox, release');
assert.match(dm,/name==='screen-light-reset'\)\{putScreenLight\(\{\}\);/,'100 %: {} (the importer then removes the film\'s field)');
assert.match(dm,/name==='screen-light-film'\)\{putScreenLight\(undefined\);/);
assert.match(dm,/rows\.push\(\['room','Screen light',screenLightSummary\(v\)/,'Lighting now');
console.log('screen-light-ui-test: ok (media chapters only; opens at the chapter\'s values; % fields -> the contract\'s field; {} = 100 %; live and Render still take it)');
