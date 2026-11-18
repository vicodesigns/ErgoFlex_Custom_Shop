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
// the camera as a chapter page holds it (the story keys, plan-NN) is the film's: no ● on MOTION; a key moved is a change
{const T=film.seconds,plan=[...film.cameraPlan.keys].sort((a,b)=>a.at-b.at),page={...structuredClone(film),camera:{keys:plan.map((k,i)=>({id:'plan-'+String(i).padStart(2,'0'),time:Math.round(k.at/T*1e6)/1e6,label:'x',easing:i===0||i===plan.length-1?'smooth':'linear',view:{position:[...k.position],target:[...k.target],fov:k.fov??35,aspect:16/9}}))}};
  assert.deepEqual(changedGroups(page,film),[],'the page\'s story keys are the film\'s camera');
  const moved=structuredClone(page);moved.camera.keys[1].view.position[0]+=.05;assert.deepEqual(changedGroups(moved,film),['motion'],'a key moved');
  const eased=structuredClone(page);eased.camera.keys[1].easing='smooth';assert.deepEqual(changedGroups(eased,film),['motion'],'an easing changed');
  const later=structuredClone(page);later.camera.keys[1].time+=.01;assert.deepEqual(changedGroups(later,film),['motion'],'a key retimed');}
console.log('film-changes-test: ok');
