// P5 "changed from the film" (film-changes.mjs) on the cine cut's real Rise chapter: an untouched copy changes
// nothing; a changed length, a custom camera, a desk move, people edits and props each show where they belong.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {changedFields,changedGroups,fieldChanged,filmValue} from '../experience/film-changes.mjs';
const film=JSON.parse(fs.readFileSync(new URL('../exports/cinematic-intro-cut-cine/director-film/rise.json',import.meta.url),'utf8'));
const cut=structuredClone(film);
assert.deepEqual(changedFields(cut,film),[],'an untouched chapter: no field changed');
assert.deepEqual(changedGroups(cut,film),[],'and no lane group');
cut.seconds=film.seconds+2;assert.deepEqual(changedFields(cut,film),['seconds']);assert.equal(filmValue(film,'seconds'),film.seconds);
assert.equal(fieldChanged(cut,film,'transition'),film.transition!==undefined&&false,'a field the film does not have is never "changed"');
cut.camera={keys:[]};assert.deepEqual(changedGroups(cut,film),['motion'],'a custom camera: motion');
cut.peopleEdits={v:2,cast:[]};cut.propEdits=[{key:'x'}];cut.ledStatus=[...(film.ledStatus||[]),{at:1,dur:1,kind:'up'}];
assert.deepEqual(changedGroups(cut,film).sort(),['lighting','motion','people','props']);
assert.deepEqual(changedGroups(null,film),[]);assert.deepEqual(changedGroups(cut,null),[]);
console.log('film-changes-test: ok');
