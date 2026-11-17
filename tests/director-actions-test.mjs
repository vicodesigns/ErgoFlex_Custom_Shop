// The Director's action table (experience/director-actions.mjs): matching, the context stack, clashes, reserved keys,
// that every key of the old sheet (shortcuts.mjs, 14397a53) is kept or listed as changed, and the generated docs.
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {ACTIONS, RESERVED, CHANGED, SECTIONS, LIVE_PHASES, parseSpec, matchSpec, resolve, targetKind, markdown, keyText, stackOf, effectiveActions, specOf, bindCheck, rebind, searchActions} from '../experience/director-actions.mjs';

const ev = (spec, more = {}) => { const s = parseSpec(spec); return { key: s.kind === 'code' ? (s.shift ? s.base.toUpperCase() : s.base.toLowerCase()) : s.base === 'Space' ? ' ' : s.base, code: s.code || (s.base === 'Space' ? 'Space' : ''), ctrlKey: s.ctrl, shiftKey: s.shift, altKey: s.alt, metaKey: false, ...more }; };
const id = (spec, state = {}, more) => resolve(ev(spec, more), state)?.id ?? null;

// matching: letters by code, symbols by character whatever Shift does, Cmd = Ctrl
assert.ok(matchSpec('C', { key: 'c', code: 'KeyC' }));
assert.ok(!matchSpec('C', { key: 'C', code: 'KeyC', shiftKey: true }));
assert.ok(matchSpec('?', { key: '?', code: 'Slash', shiftKey: true }));
assert.ok(matchSpec('Ctrl+Z', { key: 'z', code: 'KeyZ', metaKey: true }));
assert.ok(matchSpec('1', { key: '!', code: 'Digit1', shiftKey: true }) === false, 'Shift+1 is not 1');
assert.ok(matchSpec('Space', { key: ' ', code: 'Space' }));
assert.ok(matchSpec('+', { key: '+', code: 'Equal', shiftKey: true }));

// the always-on keys
assert.equal(id('Space'), 'play');
assert.equal(id('ArrowLeft'), 'step-back');
assert.equal(id('Shift+ArrowRight'), 'step-forward');
assert.equal(id('C'), 'camera-add');
assert.equal(id('R'), 'tool-scale');
assert.equal(id('Shift+R'), 'still');
assert.equal(id('T'), null, 'T is free until P4 (the hint says Scale is now R)');
assert.equal(id('Ctrl+M'), 'export');
assert.equal(id('Ctrl+S'), 'save');
// ← → step the playhead whatever is selected (the 17 Nov rule); Alt nudges
assert.equal(id('ArrowLeft', { items: new Set(['camera', 'desk-clip']) }), 'step-back');
assert.equal(id('Alt+ArrowLeft', { items: new Set(['camera']) }), 'nudge-back');
assert.equal(id('Alt+ArrowLeft', { items: new Set(['title']) }), 'title-nudge');
// modal tools win, and their editor rows let the key through
assert.equal(resolve(ev('ArrowLeft'), { items: new Set(['still']) })?.owner, 'editor');
assert.equal(resolve(ev('ArrowLeft'), { items: new Set(['shape', 'title']) })?.owner, 'editor');
assert.equal(id('I', { items: new Set(['pose', 'person']) }), 'pose-key');
assert.equal(id('Alt+R', { items: new Set(['pose', 'person']) }), 'pose-reset-joint');
assert.equal(id('Alt+R', { items: new Set(['person']) }), 'reset-film');
assert.equal(id('Escape', { items: new Set(['keys-panel', 'prop']) }), 'keys-panel-close');
// item keys only while the item is selected
assert.equal(id('U'), null);
assert.equal(id('U', { items: new Set(['camera']) }), 'camera-update');
assert.equal(id('P', { items: new Set(['person']) }), 'pose-mode');
// focus: typing, fields, sliders, buttons
assert.equal(id('C', { target: 'text' }), null, 'typing a C types it');
assert.equal(id('Ctrl+S', { target: 'text' }), 'save');
assert.equal(id('F1', { target: 'text' }), 'keys-panel-anywhere');
assert.equal(id('ArrowLeft', { target: 'field' }), null, 'a number field keeps its arrows');
assert.equal(id('Ctrl+Z', { target: 'field' }), 'undo', 'a number field shares the editor undo (as before)');
assert.equal(id('Ctrl+Z', { target: 'text' }), null, 'text keeps the browser undo');
assert.equal(id('ArrowLeft', { target: 'range' }), null);
assert.equal(id('Space', { target: 'button' }), 'play', 'a focused button never swallows Space (the 17 Nov bug)');
assert.equal(id('ArrowLeft', { target: 'button' }), 'step-back');
assert.equal(id('C', { dialog: true }), null);
assert.equal(id('Enter', { target: 'button' }), null, 'Enter presses a focused button');
assert.equal(id('Enter'), 'open-inspector');
assert.equal(id('Ctrl+Z', { baking: true }), null);
assert.equal(targetKind({ tagName: 'INPUT', type: 'number' }), 'field');
assert.equal(targetKind({ tagName: 'BUTTON' }), 'button');
assert.equal(targetKind({ tagName: 'INPUT', type: 'text' }), 'text');
// the iframe case: a key from the stage document resolves the same (resolve never looks at the document)
assert.equal(id('Shift+F', { target: 'other' }), 'frame-room');

// no two rows of one context share a key (a context's rows are tried in order: a clash would hide one)
for (const [ctx] of SECTIONS) {
  const seen = new Map();
  for (const r of ACTIONS.filter(a => a.ctx === ctx && a.owner !== 'gesture'))
    for (const k of r.keys) { const s = parseSpec(k), sig = [s.ctrl, s.alt, s.kind === 'char' ? '*' : s.shift, s.base].join('|');
      assert.ok(!seen.has(sig) || seen.get(sig) === r.id, `${ctx}: ${k} is both ${seen.get(sig)} and ${r.id}`); seen.set(sig, r.id); }
}
// an always-on key hidden by an item row must be the same idea, or the item row is listed as shadowing it
const always = ACTIONS.filter(a => ['global', 'timeline', 'view'].includes(a.ctx) && a.owner !== 'gesture');
for (const r of ACTIONS.filter(a => !['global', 'timeline', 'view'].includes(a.ctx) && a.owner !== 'gesture'))
  for (const k of r.keys) for (const a of always) if (a.keys.some(x => x === k)) assert.ok(r.id === a.id || r.shadows?.includes(a.id), `${r.ctx} ${k}: ${r.id} hides ${a.id}; declare it in shadows`);
// no reserved key is bound
for (const r of ACTIONS) for (const k of r.keys) assert.ok(!RESERVED.includes(k), `${r.id} binds reserved ${k}`);
// every row is well formed
for (const r of ACTIONS) { assert.ok(r.id && r.label && r.ctx && r.phase, JSON.stringify(r)); assert.ok(SECTIONS.some(([s]) => s === r.ctx), `${r.id}: unknown ctx ${r.ctx}`);
  assert.ok(r.owner === 'gesture' ? !!r.gesture : r.keys.length || r.aliases?.length, `${r.id}: keys, aliases or a gesture`); }
// every key of the old sheet (shortcuts.mjs at 43d6b528, kept as a fixture) is still in the table, or listed as changed
const old = JSON.parse(readFileSync(new URL('./fixtures/shortcut-sheet-14397a53.json', import.meta.url), 'utf8')).sections;
const caps = new Set(ACTIONS.flatMap(a => a.keys.map(keyText)).concat(CHANGED.filter(c => c.spec).map(c => keyText(c.spec))));
const splitOld = k => k.replace(/Ctrl\/Cmd/g, 'Ctrl').split(/ {2}| (?=[^+]*$)/).flatMap(x => x.includes('+') ? [x] : x.split(' ')).map(x => x.replace(/^←$/, '←').replace(/^−$/, '-'));
const SPELL = { '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown', PgUp: 'PageUp', PgDn: 'PageDown', Esc: 'Escape', '-': '-', '+': '+' };
const PASS = new Set(['T', 'Ctrl+Y']);       // T: scale, now R (in CHANGED); listed as the old "W E T" row
for (const [sec, list] of old) for (const [k] of list) {
  if (k[0] === '~') continue;
  for (const cap of splitOld(k)) {
    const spec = cap.split('+').map(x => SPELL[x] || x).join('+'), shown = keyText(spec);
    assert.ok(caps.has(shown) || PASS.has(shown) || ACTIONS.some(a => a.keys.includes(spec)), `old key "${cap}" (${sec}: ${k}) is neither kept nor in CHANGED`);
  }
}
// the Director marks only contexts the table has (activeShortcuts in director.mjs)
const src = readFileSync(new URL('../experience/director.mjs', import.meta.url), 'utf8');
const fn = src.slice(src.indexOf('function activeShortcuts()'), src.indexOf('const keysPanel='));
const used = [...fn.matchAll(/a\.add\('([a-z-]+)'\)|\?'([a-z-]+)':'([a-z-]+)'/g)].flatMap(m => m.slice(1).filter(Boolean));
assert.ok(used.length >= 10, 'activeShortcuts found');
for (const u of used) assert.ok(SECTIONS.some(([s]) => s === u), `director marks "${u}", the table has no such context`);
// the dispatcher is bound on the stage's document too (the 3D view), and the old per-key handlers are gone
assert.ok(/previewDocument\.addEventListener\('keydown',dispatchKey,true\)/.test(src), 'dispatcher on the stage document');
for (const gone of ['function viewKeys', 'function globalKeys', 'function historyShortcut']) assert.ok(!src.includes(gone), `${gone} is retired`);
// the docs are generated from the table
const md = markdown();
assert.ok(md.includes('| Shift+R | Still image of this frame |'));
const doc = new URL('../docs/director-shortcuts.md', import.meta.url);
if (existsSync(doc)) assert.equal(readFileSync(doc, 'utf8'), md, 'docs/director-shortcuts.md is stale: node tools/experience/director-shortcuts-doc.mjs');
assert.deepEqual(stackOf({ items: new Set(['prop', 'pose']) }).slice(0, 2), ['pose', 'prop']);
assert.ok(ACTIONS.every(a => LIVE_PHASES.has(a.phase)));
// ---- drop 2: Vico's own keys, the command search
const kev = (key, code, m = {}) => ({ key, code, ctrlKey: !!m.ctrl, shiftKey: !!m.shift, altKey: !!m.alt, metaKey: false });
assert.equal(specOf(kev('k', 'KeyK', { ctrl: true, shift: true })), 'Ctrl+Shift+K');
assert.equal(specOf(kev('?', 'Slash', { shift: true })), '?', 'a symbol: the character, Shift in it');
assert.equal(specOf(kev('ArrowLeft', 'ArrowLeft', { alt: true })), 'Alt+ArrowLeft');
assert.equal(specOf(kev(' ', 'Space')), 'Space');assert.equal(specOf(kev('Shift', 'ShiftLeft', { shift: true })), null);
for (const k of ['A', 'Ctrl+Shift+K', 'Alt+ArrowLeft', '?', 'F9']) { const s = parseSpec(k); assert.ok(matchSpec(k, kev(s.kind === 'code' ? s.base.toLowerCase() : s.base, s.code || s.base, s)), k + ' round trips'); }
assert.ok(bindCheck('loop', 'Ctrl+W').reserved, 'a browser key is refused');
assert.ok(bindCheck('loop', 'Ctrl+1').reserved);
assert.ok(bindCheck('loop', 'Escape').reserved, 'Esc stays the way out');
assert.equal(bindCheck('loop', 'C').clash?.id, 'camera-add', 'a taken key names its action');
assert.ok(bindCheck('loop', 'Ctrl+J').ok);
assert.ok(bindCheck('escape', 'J').fixed, 'an editor\'s key is not the Director\'s to change');
assert.throws(() => rebind({}, 'loop', 'Ctrl+T'), /browser/);
assert.throws(() => rebind({}, 'loop', 'S'), /Snapping/);
const mine = rebind({}, 'loop', 'Ctrl+J'), t2 = effectiveActions(mine);
assert.deepEqual(mine, { loop: ['Ctrl+J'] });
assert.equal(resolve(kev('j', 'KeyJ', { ctrl: true }), { items: new Set(), actions: t2 })?.id, 'loop', 'the new key runs it');
assert.equal(resolve(kev('l', 'KeyL'), { items: new Set(), actions: t2 }), null, 'the old one no longer does');
assert.equal(resolve(kev('l', 'KeyL'), { items: new Set() })?.id, 'loop', 'the default table is untouched');
assert.ok(bindCheck('snap', 'Ctrl+J', mine).clash, 'a key of his own counts as taken');
assert.deepEqual(rebind(mine, 'loop', null), {}, 'reset');
assert.deepEqual(effectiveActions({ loop: [] }).find(r => r.id === 'loop').keys, [], 'unbound');
assert.equal(effectiveActions({ escape: ['J'] }).find(r => r.id === 'escape').keys[0], 'Escape', 'an editor row keeps its keys');
assert.equal(resolve(kev('p', 'KeyP', { ctrl: true }), { items: new Set(), target: 'text' })?.id, 'palette', 'Ctrl+P: the command search, even while typing');
for (const [q, id] of [['m', 'tool-move'], ['ro', 'tool-rotate'], ['sc', 'tool-scale'], ['zs', 'frame-selection'], ['ze', 'frame-room'], ['top', 'view-top'], ['persp', 'view-persp'], ['front', 'view-front'], ['right', 'view-right'], ['film', 'film-camera'], ['export', 'export'], ['undo', 'undo'], ['bug', 'report']])
  assert.equal(searchActions(q)[0]?.id, id, `the search finds ${id} by "${q}"`);
assert.ok(!searchActions('').some(r => r.id === 'palette' || r.owner !== 'director'), 'the search lists only what it can run');
console.log(`director-actions-test: ok (${ACTIONS.length} rows)`);
