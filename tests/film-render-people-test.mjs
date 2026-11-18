// The Director's Render still and Film look show his People edits (18 Nov 2026): experience/film-render.mjs filmRenderShot
// puts the Director's cast over the film's exactly as the live stage does (film-chapters.mjs liveFilmShot, mergePeople), so a
// person added, moved or removed in the People tab is in the still before Export cut. Without People edits the still keeps
// the film's own cast. render-cut is not involved (it renders review-cut, where the import writes the people).
//   node tests/film-render-people-test.mjs
import assert from 'node:assert/strict';
import {filmRenderShot} from '../experience/film-render.mjs';
import {liveFilmShot} from '../experience/film-chapters.mjs';
import {mergePeople} from '../experience/people-edits.mjs';

const film={id:'create',room:'creative',layout:'premium',seconds:20,kind:'room',quality:'hq13',
  people:{only:['lin'],cast:[{key:'lin',id:'people-lin-stand-paint',at:[1200,-400],turn:30}]},cameraPlan:{keys:[]},camera:{keys:[]}};
const base={id:'create',room:'creative',layout:'premium',seconds:20,kind:'room'};

// no People edits: the film's cast, untouched
assert.deepEqual(filmRenderShot(film,base,null).people,film.people,'without People edits the still has the film\'s cast');

// v1 edits: Lin moved, a second person added, one hidden
const peopleEdits={cast:[{key:'lin',id:'people-lin-stand-paint',at:[900,-200],turn:10},{key:'andre',id:'people-andre-sit-read',at:[-600,800],turn:-90},{key:'kai',id:'people-kai-stand-wait',at:[0,0],hide:true}]};
const shot={...base,peopleEdits},still=filmRenderShot(film,shot,null).people,live=liveFilmShot(film,shot).people;
assert.deepEqual(still,live,'the still\'s cast is the live stage\'s');
assert.deepEqual(still,mergePeople(film,shot).people);
assert.deepEqual(still.cast.map(e=>[e.key,e.at]),[['lin',[900,-200]],['andre',[-600,800]]],'moved and added, the hidden one left out');
assert.deepEqual(still.only,[],'only the Director\'s cast: none of the room\'s own');

// v2 edits (the film's whole people object, edited in place): the still takes it as the live stage does
const v2={v:2,only:['lin'],cast:[{key:'lin',id:'people-lin-stand-paint',at:[1500,-100],turn:45},{key:'kai',id:'people-kai-stand-wait',at:[0,0],hide:true}],when:{kai:[[2,8]]}};
const s2={...base,peopleEdits:v2};
assert.deepEqual(filmRenderShot(film,s2,null).people,liveFilmShot(film,s2).people,'v2: the same as the live stage');
assert.deepEqual(filmRenderShot(film,s2,null).people.cast.map(e=>e.key),['lin'],'v2: the hidden one and its time left out');
assert.equal(filmRenderShot(film,s2,null).people.when,undefined);

// the film shot itself is not changed, and the still keeps film quality
assert.deepEqual(film.people.cast[0].at,[1200,-400]);
assert.equal(filmRenderShot(film,shot,null).quality,'hq13');
console.log('film-render-people-test: ok (Render still / Film look take the Director\'s People edits as the live stage does; none: the film\'s cast)');
