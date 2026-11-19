// Which of a desk user's models the film draws when (experience/people-shown.mjs), for the Director's pose mode, without
// a browser (19 Nov 2026: Vico's Ava "reset" at 4.35 s in the coast chapter: the desk passes 29 in and the film draws
// her 30 in seated model, which had no correction; then her standing ones). Corrections are never inherited: the pose
// mode names the models without one and offers an explicit copy to the same posture built for the other height.
//   1. shownTimeline matches DeskActor.drive frame by frame on the cine cut's coast chapter (the film's own path)
//   2. heightSibling: only the same character and posture at another desk height
//   3. the wiring: the pose panel shows the notes; the copy is one edit on the button, nowhere else
//   node tests/people-shown-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stage} from './people-postures-harness.mjs';
import {RoomPeople} from '../room-people.mjs';
import {shownTimeline,heightSibling,hasCorrection,spansOf} from '../experience/people-shown.mjs';
const shot=JSON.parse(readFileSync(new URL('../exports/cinematic-intro-cut-cine/director-film/coast.json',import.meta.url),'utf8'));
globalThis.__ERGO_PRESENTATION__=true;
const s=await stage(RoomPeople,shot),people=s.people;
people.update(s.state(0));await people.settled();people.update(s.state(0));
const ava=people.actors.find(a=>a.character==='ava');assert.ok(ava,'Ava is the featured desk user');
const tl=shownTimeline(ava);
assert.deepEqual(tl.map(x=>x.id),['people-ava-sit-type','people-ava-sit-type-30','people-ava-stand-low','people-ava-stand-mid'],'her models in the order the film draws them');
assert.deepEqual(tl.map(x=>[x.from,x.to]),[[0,4.35],[4.35,5.35],[5.35,6.6],[6.6,14.5]],'and when');
assert.equal(spansOf(tl,'people-ava-sit-type-30'),'4.35–5.35 s');
const at=t=>tl.find(x=>t>=x.from-1e-9&&t<x.to-1e-9)?.id||tl.at(-1).id;
for(let i=0;i<=290;i++){const t=Math.round(i*5)/100;people.update(s.state(t));await people.settled();people.update(s.state(t));
  assert.equal(ava.shown?.id,at(t),`at ${t} s the film draws what the timeline says`);}
// 2
const models=JSON.parse(readFileSync(new URL('../assets/props/people.json',import.meta.url),'utf8')).models;
assert.ok(heightSibling(models,'people-ava-sit-type','people-ava-sit-type-30')&&heightSibling(models,'people-ava-sit-type-30','people-ava-sit-type'));
assert.ok(!heightSibling(models,'people-ava-sit-type','people-ava-stand-mid'),'a standing model is not a sibling');
assert.ok(!heightSibling(models,'people-ava-sit-type','people-maya-sit-type-30'),'nor another character');
assert.ok(!heightSibling(models,'people-ava-sit-type','people-ava-sit-type'),'nor the model itself');
assert.ok(hasCorrection({poseKeys:[{t:0,pose:{hand_l:[0,0,0,1]}}]})&&!hasCorrection({})&&!hasCorrection(null)&&!hasCorrection({pose:{}}));
// 3
const ed=readFileSync(new URL('../experience/scene-people-editor.mjs',import.meta.url),'utf8'),pe=readFileSync(new URL('../experience/scene-pose-editor.mjs',import.meta.url),'utf8');
assert.match(pe,/data-action="pe-pose-done">Done<\/button>[^\n]*<\/div>\s*\$\{models\(key\)\}/,'the pose panel shows the notes under its bar');
assert.match(ed,/models:k=>modelNotes\(k\)/);
assert.match(ed,/it has no correction\./,'a model the film draws without a correction is named');
assert.match(ed,/if\(name==='pe-pose-copy-model'\)\{copyToModel\(index\);return;\}/,'the copy is the button\'s');
assert.equal((ed.match(/copyToModel\(/g)||[]).length,2,'and nothing else copies');
assert.match(ed,/function copyToModel\(id\)\{[^]*?heightSibling\(catalog\?\.models,from,id\)[^]*?edit\(key,x=>\{const r=structuredClone\(postureRecord\(x,from\)\);editPosture\(x,id,/,'one edit, to a height sibling only');
console.log('people-shown-test: ok (the models the film draws when; corrections copied only by the button)');
