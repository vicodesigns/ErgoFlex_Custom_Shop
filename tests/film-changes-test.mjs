// P5 "changed from the film" (film-changes.mjs) on the cine cut's real Rise chapter: an untouched copy changes
// nothing; a changed length, a custom camera, a desk move, people edits and props each show where they belong.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {changedFields,changedGroups,fieldChanged,filmValue} from '../experience/film-changes.mjs';
import {cleanCut} from '../experience/cuts.mjs';
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
// every chapter page of the cine cut, opened as the Director opens it (cleanCut: a travel's path as distance and side,
// labels cut to 60), reads unchanged; a desk move retimed lights MOTION (storage and oilers were lit untouched)
for(const f of fs.readdirSync(new URL('../exports/cinematic-intro-cut-cine/',import.meta.url)).filter(f=>/^director-ch.*\.html$/.test(f))){
  const enc=/#cut=([A-Za-z0-9_-]+)/.exec(fs.readFileSync(new URL('../exports/cinematic-intro-cut-cine/'+f,import.meta.url),'utf8'))[1];
  const s=cleanCut(JSON.parse(Buffer.from(enc.replaceAll('-','+').replaceAll('_','/'),'base64').toString('utf8')),null).shots[0];
  const f2=JSON.parse(fs.readFileSync(new URL(`../exports/cinematic-intro-cut-cine/director-film/${s.id}.json`,import.meta.url),'utf8'));
  assert.deepEqual(changedGroups(s,f2).filter(g=>g==='motion'),[],s.id+': untouched, no ● on MOTION');
  if(s.motion?.clips?.length){const t=structuredClone(s);t.motion.clips[0].start+=.5;assert.ok(changedGroups(t,f2).includes('motion'),s.id+': a desk move retimed lights MOTION');}
}
console.log('film-changes-test: ok');
