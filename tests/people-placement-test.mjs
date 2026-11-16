// S33a2: how a cast entry is placed (experience/people-track.mjs placementOf / freeSpot). Only a person at a spot of
// their own (`at`) is hand-placed: the People inspector reads X / Z from `at` for them alone (Nia and Finn of oilers sit
// on student chairs, `on` + `seat`, no `at`: selecting them threw "Cannot read properties of undefined (reading '0')").
// Every cast entry of every chapter of the cut has a known placement. Pure: node tests/people-placement-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {placementOf,freeSpot,SEAT_FIELDS} from '../experience/people-track.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cut=JSON.parse(fs.readFileSync(path.join(root,'exports/cinematic-intro-cut-cine/review-cut.json'),'utf8'));
const oil=cut.shots.find(s=>s.id==='oilers').people.cast,of=k=>oil.find(e=>e.key===k);
assert.equal(placementOf(of('fern')),'station');assert.equal(placementOf(of('kai-rolls')),'spot');assert.equal(placementOf(of('noah-taps')),'spot');
assert.equal(placementOf(of('nia-class')),'seat');assert.equal(placementOf(of('finn-class')),'seat');
assert.ok(!freeSpot(of('nia-class'))&&!freeSpot(of('finn-class')),'seated: not hand-placed');
assert.equal(placementOf({id:'x',desk:'sit'}),'desk');assert.equal(placementOf({id:'x',beside:[0,500]}),'beside');
assert.equal(placementOf({id:'x',near:[0,0],face:[1,1]}),'seat');assert.equal(placementOf({id:'x',by:'shelf-1'}),'furniture');assert.equal(placementOf({id:'x',around:['rug',90,800]}),'furniture');
assert.equal(placementOf({id:'x'}),'none');assert.equal(placementOf({id:'x',at:[1]}),'none');assert.equal(placementOf(null),'none');
assert.ok(SEAT_FIELDS.includes('on')&&SEAT_FIELDS.includes('seat')&&!SEAT_FIELDS.includes('at'));
// every entry of the cut: a known placement, and hand-placed exactly when it has a spot of its own
let n=0;const kinds={};
for(const s of cut.shots)for(const e of s.people?.cast||[]){n++;const k=placementOf(e);kinds[k]=(kinds[k]||0)+1;assert.notEqual(k,'none',`${s.id} ${e.key}: a known placement`);assert.equal(freeSpot(e),k==='spot');if(freeSpot(e))assert.equal(typeof e.at[0],'number');}
console.log(`people placement: ${n} cast entries of the cut, ${JSON.stringify(kinds)}; only "spot" is hand-placed`);
