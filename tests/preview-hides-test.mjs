// Preview hides (the 👁 in a lane's label): hidden objects get layer mask 0 and get their own mask back exactly; a
// bake (paused) shows everything; objects that come in later are hidden on the next pass.
import assert from 'node:assert/strict';
import {createPreviewHides} from '../experience/preview-hides.mjs';
const node=(mask=1,kids=[])=>{const o={layers:{mask},children:kids,traverse(f){f(o);for(const k of kids)k.traverse(f);}};return o;};
const leg=node(5),person=node(1,[leg]),prop=node(3),other=node(1);
let people=[person],props=[prop],paused=false,wakes=0,tick=null;
const h=createPreviewHides({targets:id=>id==='people'?people:id==='props'?props:[],paused:()=>paused,wake:()=>wakes++,setInterval:f=>{tick=f;return 1;},clearInterval:()=>{tick=null;}});
h.set('people',true);
assert.equal(person.layers.mask,0);assert.equal(leg.layers.mask,0);assert.equal(prop.layers.mask,3);assert.equal(other.layers.mask,1);assert.ok(wakes>0);assert.ok(tick,'a pass runs while something is hidden');
// something else turns the mask back on: the next pass hides it again
leg.layers.mask=5;tick();assert.equal(leg.layers.mask,0);
// a person who comes in later is hidden too
const late=node(1);people=[person,late];tick();assert.equal(late.layers.mask,0);
// a bake: everything back, and kept back while paused
paused=true;h.suspend();assert.equal(person.layers.mask,1);assert.equal(leg.layers.mask,5);tick();assert.equal(leg.layers.mask,5);
paused=false;tick();assert.equal(leg.layers.mask,0);
// shown again: the exact masks come back, the pass stops
h.toggle('props');assert.equal(prop.layers.mask,0);
h.set('people',false);assert.equal(person.layers.mask,1);assert.equal(leg.layers.mask,5);assert.equal(late.layers.mask,1);assert.equal(prop.layers.mask,0);
h.clear();assert.equal(prop.layers.mask,3);assert.equal(tick,null);assert.deepEqual(h.list(),[]);
h.load(['props',7,'p:jo']);assert.deepEqual(h.list(),['props','p:jo']);assert.equal(prop.layers.mask,0);
console.log('preview-hides-test: ok');
