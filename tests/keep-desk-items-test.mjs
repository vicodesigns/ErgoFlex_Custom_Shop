// shot.keepDeskItems (28 Nov 2026): the hero's Office desk (D) keeps its loose desktop items on the desk while it is tilted, so they are on from the
// first frame and the Props lane's bars are theirs to time. Source-level checks (the behaviour itself runs in a browser: director-props-away-e2e).
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
assert.match(read('desk-auto-stow.mjs'),/const wanted=this\.off\?\[\]:items\.filter\(/,'the stow has nothing to put away when it is off');
assert.match(read('desk-auto-stow.mjs'),/this\.off=false/,'off is false by default');
assert.match(read('experience/rider-handoff.mjs'),/const active = \(\) => !stow\(\)\?\.off && /,'no stow, no hand-off');
const fx=read('tools/experience/film-fx.mjs');
assert.match(fx,/if \(shot\.keepDeskItems\) active\.keepItems = installKeepDeskItems\(\);/,'film-fx installs it');
assert.match(fx,/active\.keepItems\?\.restore\(\);/,'and puts it back in clear()');
assert.match(fx,/shot\.accessories \|\| shot\.keepDeskItems \|\|/,'a shot with only the flag still installs');
// module versions bumped, so an open page does not keep the old stow
assert.match(read('scene-desk-objects.mjs'),/desk-auto-stow\.mjs\?v=keep-desk-items-20261127/);
assert.match(read('experience/stage.mjs'),/rider-handoff\.mjs\?v=keep-desk-items-20261127/);
assert.match(read('experience/player.mjs'),/film-fx\.mjs\?v=20261127-featured-settle/);
assert.match(read('experience/film-render.mjs'),/film-fx\.mjs\?v=20261127-featured-settle/);
// the cut: the Office sub-shot only
const subs=JSON.parse(read('exports/cinematic-intro-cut-vicos-3rd-cut/shots/13-subshots.json').replace(/^﻿/,'')).shots;
assert.deepEqual(subs.filter(s=>s.keepDeskItems).map(s=>s.subshot),['D'],'only the Office sub-shot carries the flag');
// the Props lane draws no put-away stretch for a desk that has it
assert.match(read('experience/scene-prop-editor.mjs'),/keep:!!v\.setup\?\.keepDeskItems/);
assert.match(read('experience/scene-prop-editor.mjs'),/if\(!tiltAt\|\|span\.keep\|\|/);
assert.match(read('tools/experience/film-fx.mjs'),/restoring = \(async[\s\S]*export async function install\(shot\) \{\n  clear\(\);\n  unhookPreset\(\);\n  if \(restoring\)/);
console.log('keep-desk-items-test ok');
