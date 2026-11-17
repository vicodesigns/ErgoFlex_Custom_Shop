// The shortcut sheet (experience/shortcuts.mjs): its shape, the live-first order, and that the Director marks only
// sections that exist.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHORTCUT_GLOBAL, SHORTCUT_ITEMS, shortcutsCardHtml} from '../experience/shortcuts.mjs';

const ids = SHORTCUT_ITEMS.map(([id]) => id);
assert.equal(new Set(ids).size, ids.length, 'item section ids are unique');
for (const [id, title, list] of [...SHORTCUT_GLOBAL, ...SHORTCUT_ITEMS]) {
  assert.ok(id && title && list.length, `${id}: has a title and rows`);
  for (const row of list) assert.ok(row.length === 2 && row.every(x => typeof x === 'string' && x), `${id}: a row is [keys, text]: ${row}`);
}
// Nothing selected: every section is listed, none is live.
const none = shortcutsCardHtml(new Set());
assert.ok(!none.includes('sc-live'));
for (const [, title] of [...SHORTCUT_GLOBAL, ...SHORTCUT_ITEMS]) assert.ok(none.includes(title.replace(/&/g, '&amp;')) || none.includes(title.replace(/"/g, '&quot;')), `${title} is listed`);
// A prop selected: its section is live and comes before the "everywhere" one.
const prop = shortcutsCardHtml(new Set(['prop']));
assert.equal((prop.match(/sc-live/g) || []).length, 1);
assert.ok(prop.indexOf('sc-live') < prop.indexOf('Everywhere in the Director'));
assert.ok(prop.indexOf('Everywhere in the Director') < prop.lastIndexOf('<h4>Person</h4>'), 'the other items come after');
// Key caps vs plain gestures; HTML is escaped.
assert.ok(none.includes('<kbd>Space</kbd>') && none.includes('<span class="sc-k">Drag an edge</span>'));
for (const [, cap] of none.matchAll(/<kbd>(.*?)<\/kbd>/g)) assert.ok(!/[<>"]/.test(cap), `raw character in key cap ${cap}`);
// The Director only marks sections the sheet has.
const src = readFileSync(new URL('../experience/director.mjs', import.meta.url), 'utf8');
const fn = src.slice(src.indexOf('function activeShortcuts()'), src.indexOf('function globalKeys'));
const used = [...fn.matchAll(/a\.add\('([a-z-]+)'\)|\?'([a-z-]+)':'([a-z-]+)'/g)].flatMap(m => m.slice(1).filter(Boolean));
assert.ok(used.length >= 10);
for (const id of used) assert.ok(ids.includes(id), `director marks "${id}", the sheet has no such section`);
console.log('shortcuts-test: ok (' + ids.length + ' item sections, ' + used.length + ' marked by the Director)');
