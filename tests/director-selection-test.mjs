// B2: the one Director selection (experience/director-selection.mjs): the shared object and its change event, where each
// kind shows (selectors), the centring arithmetic, and marking on a minimal DOM.   node tests/director-selection-test.mjs
import assert from 'node:assert/strict';
import {createSelection,sameSelection,selectionSelectors,centreScroll,markSelection,SELECTED_CLASS} from '../experience/director-selection.mjs';
let n=0;const ok=(what,fn)=>{fn();n++;console.log('  ok: '+what);};

ok('set / get / is, and the change event fires once per real change',()=>{
  const s=createSelection(),seen=[];const off=s.on((now,was)=>seen.push([now&&now.key,was&&was.key]));
  assert.equal(s.get(),null);
  assert.equal(s.set({kind:'prop',key:'["Prop:lamp",0]'}),true);
  assert.equal(s.set({kind:'prop',key:'["Prop:lamp",0]'}),false,'same thing again: no change');
  assert.ok(s.is('prop','["Prop:lamp",0]'));assert.ok(!s.is('person','["Prop:lamp",0]'));
  assert.equal(s.set({kind:'person',key:'kai'}),true);
  assert.equal(s.set(null),true);assert.equal(s.set({kind:'desk',key:''}),false,'an empty key is nothing selected');
  assert.deepEqual(seen,[['["Prop:lamp",0]',null],['kai','["Prop:lamp",0]'],[null,'kai']]);
  off();s.set({kind:'desk',key:'station-a'});assert.equal(seen.length,3,'unsubscribed');
  assert.ok(sameSelection(null,null)&&sameSelection({kind:'desk',key:'1'},{kind:'desk',key:'1'})&&!sameSelection({kind:'desk',key:'1'},{kind:'prop',key:'1'}));
});
ok('selectors: props (lane bar, Layers row), people (lane / list, sheet row), desks (list, timeline rows); quotes escaped',()=>{
  assert.deepEqual(selectionSelectors({kind:'prop',key:'["a",1]'}),['.prop-bar[data-prop-key="[\\"a\\",1]"]','[data-ly-item="[\\"a\\",1]"]']);
  assert.deepEqual(selectionSelectors({kind:'person',key:'kai'}),['[data-person-key="kai"]','[data-person-keys~="kai"]']);
  assert.ok(selectionSelectors({kind:'desk',key:'station-3'}).some(x=>x.includes('data-desk-of="station-3"')));
  assert.deepEqual(selectionSelectors(null),[]);assert.deepEqual(selectionSelectors({kind:'nothing-yet',key:'x'}),[]);   // (P3: lights and every other kind have marks now)
});
ok('centreScroll: centres, clamps at both ends, keeps a fully visible item when nearest',()=>{
  // view 200 px at scroll 100; item 300..320 below the fold (start relative to the view = 300)
  assert.equal(centreScroll({scroll:100,view:200,start:300,size:20,max:1000}),100+310-100);
  assert.equal(centreScroll({scroll:100,view:200,start:-90,size:20,max:1000}),0,'clamped at 0');
  assert.equal(centreScroll({scroll:900,view:200,start:180,size:20,max:950}),950,'clamped at the end');
  assert.equal(centreScroll({scroll:50,view:200,start:20,size:20,max:1000,nearest:true}),50,'already in view');
  assert.equal(centreScroll({scroll:50,view:200,start:-400,size:900,max:1000,nearest:true}),50,'a bar wider than the view that covers it stays');
  assert.equal(centreScroll({scroll:50,view:200,start:20,size:20,max:1000}),0,'centred (clamped)');
});
ok('markSelection marks every place it shows, clears the old marks',()=>{
  // a tiny fake DOM: elements with classList and a matcher for the selectors used here
  const mk=attrs=>{const c=new Set();return {attrs,classList:{add:x=>c.add(x),remove:x=>c.delete(x),contains:x=>c.has(x)},has:x=>c.has(x)};};
  const els=[mk({cls:'prop-bar','data-prop-key':'p1'}),mk({'data-ly-item':'p1'}),mk({cls:'prop-bar','data-prop-key':'p2'}),mk({'data-person-key':'kai'}),mk({'data-person-keys':'kai kai-2'})];
  const match=(el,sel)=>sel.split(',').some(one=>{const m=one.match(/^(\.[\w-]+)?\[([\w-]+)(~?)="(.*)"\]$/);if(!m)return one==='.'+SELECTED_CLASS&&el.has(SELECTED_CLASS);
    const [,cls,attr,tilde,v]=m,val=el.attrs[attr];if(cls&&el.attrs.cls!==cls.slice(1))return false;if(val==null)return false;return tilde?val.split(' ').includes(v):val===v;});
  const root={querySelectorAll:sel=>els.filter(e=>match(e,sel))};
  let hits=markSelection([root,null],{kind:'prop',key:'p1'});
  assert.equal(hits.length,2);assert.ok(els[0].has(SELECTED_CLASS)&&els[1].has(SELECTED_CLASS)&&!els[2].has(SELECTED_CLASS));
  hits=markSelection([root],{kind:'person',key:'kai'});
  assert.equal(hits.length,2);assert.ok(!els[0].has(SELECTED_CLASS)&&els[3].has(SELECTED_CLASS)&&els[4].has(SELECTED_CLASS));
  hits=markSelection([root],null);assert.equal(hits.length,0);assert.ok(els.every(e=>!e.has(SELECTED_CLASS)));
});
console.log(`director-selection: ${n} passed`);
