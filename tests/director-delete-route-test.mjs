// Delete acts on the selection the Director shows, never on an editor's leftover selection (18 Nov 2026, Vico, High
// school: he had touched a seated woman, then clicked a foot-shelf item and pressed Delete; the prop pick left her
// selected under it and Delete removed her cast entry, so she stood at the main desk).
//   1. director-selection.mjs deleteRoute: prop / person / pose key / timeline picks
//   2. director.mjs: every selecting editor's onSelect clears the other selectable kinds (props, people, room desks),
//      and both Delete paths (the view's key, the selection bar's button) route through deleteRoute(selectionNow())
//   node tests/director-delete-route-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deleteRoute} from '../experience/director-selection.mjs';
const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8').replace(/\r/g,'');
// 1. the route
assert.equal(deleteRoute({kind:'prop',key:'k'}),'prop');
assert.equal(deleteRoute({kind:'person',key:'fern'}),'person');
assert.equal(deleteRoute(null),null);
assert.equal(deleteRoute({kind:'desk',key:'station-x'}),null,'a room desk: Delete is the Desks tab\'s own');
assert.equal(deleteRoute({kind:'camera',key:'k1'}),null,'other kinds keep their own Delete');
assert.equal(deleteRoute({kind:'prop',key:'k'},{picked:true}),null,'timeline picks: their own Delete');
assert.equal(deleteRoute({kind:'person',key:'fern'},{poseKey:true}),'pose-key');
assert.equal(deleteRoute(null,{poseKey:true,picked:true}),'pose-key','a pose key in pose mode goes first');
// 2. the wiring
// each editor's options block (createScenePropEditor({...}) etc.) up to the next "const " declaration at its indent
const block=name=>{const i=src.indexOf(name+'({');assert.ok(i>=0,name+' is created in director.mjs');const j=src.indexOf('\n  const ',i+1);return src.slice(i,j>0?j:undefined);};
const onSelect=name=>{const b=block(name),m=/onSelect:\(\)=>\{([^]*?)\}\}\);/.exec(b);assert.ok(m,name+' has an onSelect');return m[1];};
const props=onSelect('createScenePropEditor'),people=onSelect('createScenePeopleEditor'),desks=onSelect('createSceneDeskEditor');
assert.match(props,/scenePeople\.deselect\(\)/,'a prop pick clears the People selection (the bug: it did not)');
assert.match(props,/deskSel\.deselect\(\)/,'a prop pick clears the room desk selection');
assert.match(people,/sceneProps\.deselect\(\)/,'a person pick clears the props');
assert.match(people,/deskSel\.deselect\(\)/,'a person pick clears the room desk');
assert.match(desks,/sceneProps\.deselect\(\)/);assert.match(desks,/scenePeople\.deselect\(\)/);
// the view's Delete: no editor is asked directly whether it has a selection; the route decides
const view=/function viewDelete\(event\)\{([^]*?)\n  \}/.exec(src)?.[1];assert.ok(view,'viewDelete is there');
assert.match(view,/deleteRoute\(selectionNow\(\)/,'the view\'s Delete routes through deleteRoute(selectionNow())');
assert.doesNotMatch(view,/scenePeople\.selected\(\)/,'no "a person is selected somewhere" shortcut before the prop');
const bar=/if\(t==='delete'\)\{([^\n]*)/.exec(src)?.[1];assert.ok(bar,'the selection bar\'s Delete is there');
assert.match(bar,/deleteRoute\(selectionNow\(\)/,'the selection bar\'s Delete routes the same way');
assert.doesNotMatch(bar,/if\(scenePeople\.selected\(\)\)\{scenePeople\.remove/,'not people first');
// selectionNow: a prop before a person (what the marks show)
const now=/function selectionNow\(\)\{([^]*?)\n  \}/.exec(src)?.[1]||'';
assert.ok(now.indexOf("kind:'prop'")>=0&&now.indexOf("kind:'prop'")<now.indexOf("kind:'person'"),'selectionNow puts the prop first');
console.log('director-delete-route-test: ok (Delete acts on the shown selection; a prop pick clears People, every editor clears the others)');
