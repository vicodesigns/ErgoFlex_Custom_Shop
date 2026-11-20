// A chapter's status-indicator light switch, shot.statusLight (19 Nov 2026, Vico's music chapter, Chapter 9: the desk
// turns back to centre while the gaming LED look, ledMode 'media' / ledPreset 'full', has to stay on). Without a browser.
//   1. statusLight: absent / true is exactly as before (no ledStatus dropped, the movement cue untouched, no field added
//      to any film shot); false drops the chapter's ledStatus states, switches the app's movement cue off and back
//   2. the data path: the cut keeps it, the live and Render-still film shots carry it (true = back to the default),
//      render-cut / render-still pass it to film-fx, film-fx installs and restores it, Export cut / the importer carry it
//   node tests/status-light-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {statusEvents,statusLightOn,statusLightOff,withStatusLight} from '../tools/experience/film-status-light.mjs';
import {cleanLighting} from '../experience/film-lighting.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
import {filmRenderShot} from '../experience/film-render.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');

// 1. the switch
const states=[{at:6.5,dur:2.7,kind:'wheels',mode:5}];
assert.ok(statusLightOn({})&&statusLightOn({statusLight:true}),'absent / true: on');
assert.deepEqual(statusEvents({ledStatus:states}),states,'absent: the states as they are');
assert.notEqual(statusEvents({ledStatus:states})[0],states[0],'(copies)');
assert.deepEqual(statusEvents({ledStatus:states,statusLight:true}),states);
assert.deepEqual(statusEvents({}),[]);
assert.deepEqual(statusEvents({ledStatus:states,statusLight:false}),[],'false: no states');
const calls=[],app={ledMotionState:{enabled:true},setLedMotionEnabled(v){calls.push(v);this.ledMotionState.enabled=v;}};
const cue=statusLightOff(app);assert.deepEqual(calls,[false]);assert.equal(app.ledMotionState.enabled,false);
cue.restore();assert.deepEqual(calls,[false,true],'the stage\'s own setting back');
const off={ledMotionState:{enabled:false},setLedMotionEnabled(v){calls.push(v);}};calls.length=0;statusLightOff(off).restore();assert.deepEqual(calls,[false,false],'a stage that had it off keeps it off');
assert.equal(statusLightOff({}),null,'an app without the switch: nothing');
// film-fx: only a shot with statusLight:false touches the movement cue; it is put back on clear()
const fx=read('tools/experience/film-fx.mjs');
assert.match(fx,/if \(shot\.statusLight === false\) active\.motionCue = statusLightOff\(api\);/);
assert.match(fx,/active\.motionCue\?\.restore\(\);\n  active = null;/);
assert.match(fx,/\|\| shot\.statusLight === false;\n  if \(!wants\) return null;/,'a shot that only switches the light off still installs');
assert.ok(!/LIVE_FIELDS = \[[^\]]*statusLight/.test(fx),'a change re-installs (not an in-place field)');
assert.match(read('tools/experience/film-status.mjs'),/events = statusEvents\(shot\);/);
// every chapter of the cine cut: no film shot has the field, so nothing renders differently
const cine=JSON.parse(read('exports/cinematic-intro-cut-cine/review-cut.json'));
assert.equal(cine.shots.filter(s=>'statusLight' in s).length,0,'no chapter sets it today');

// 2. the data path
assert.deepEqual(cleanLighting({statusLight:false}).statusLight,false,'the cut keeps false');
assert.deepEqual(cleanLighting({statusLight:true}).statusLight,true,'and true (back to the default)');
assert.ok(!('statusLight' in cleanLighting({statusLight:'no'}))&&!('statusLight' in cleanLighting({})),'junk / absent: no field');
const film={id:'music',room:'gaming',seconds:9.9,ledMode:'media',ledPreset:'full'};
for(const make of [s=>liveFilmShot(film,s),s=>filmRenderShot(film,s,null)]){
  assert.ok(!('statusLight' in make({id:'music',seconds:9.9})),'absent: the film shot has no field');
  assert.equal(make({id:'music',seconds:9.9,statusLight:false}).statusLight,false,'false carried');
  assert.ok(!('statusLight' in make({id:'music',seconds:9.9,statusLight:true})),'true: the default');
  assert.equal(liveFilmShot({...film,statusLight:false},{id:'music',seconds:9.9}).statusLight,false,'the film\'s own kept');
  assert.ok(!('statusLight' in make({id:'music',seconds:9.9,statusLight:true})));
}
assert.deepEqual(withStatusLight({statusLight:false},{statusLight:true}),{});
for(const f of ['tools/experience/render-cut.cjs','tools/experience/render-still.cjs'])assert.match(read(f),/'featuredBuild','statusLight','screenLook'];/,f+' passes it to film-fx');
const py=read('tools/experience/build-round8-director.py');
assert.match(py,/LIGHT_FIELDS = \([^)]*'statusLight'\)/,'Export cut -> the film shot (importer)');
assert.match(py,/elif k == 'statusLight':\n\s+if lighting\[k\] is False: s\[k\] = False\n\s+else: s\.pop\(k, None\)/);
assert.match(read('experience/player.mjs'),/l\.timeOfDay,s\.statusLight,l\.propEdits/,'the live preview re-installs on a change');
console.log('status-light-test: ok (absent: as before; false: no movement cue, no ledStatus states, carried to the film)');
