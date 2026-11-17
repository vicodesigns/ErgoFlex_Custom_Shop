// A person's stays in a chapter (experience/people-spans.mjs): editing one stay keeps the others (17 Nov 2026:
// dragging Maya's second bar, or typing In/Out, used to drop every stay but the first).
import assert from 'node:assert/strict';
import {withSpan} from '../experience/people-spans.mjs';
const T = 18, two = [[3.8, 7.4, .5, .5], [9.7, 12.5, .5, .5]];
// the second stay moves; the first is untouched
let out = withSpan(two, 1, s => { s[0] = 10; s[1] = 13; }, T);
assert.deepEqual(out, [[3.8, 7.4, .5, .5], [10, 13, .5, .5]]);
// the first stay changes; the second is kept
out = withSpan(two, 0, s => { s[1] = 8; }, T);
assert.deepEqual(out, [[3.8, 8, .5, .5], [9.7, 12.5, .5, .5]]);
// the input is never changed
assert.deepEqual(two, [[3.8, 7.4, .5, .5], [9.7, 12.5, .5, .5]]);
// a stay pulled to the end runs a second past it
assert.deepEqual(withSpan(two, 1, s => { s[1] = T; }, T)[1], [9.7, T + 1, .5, .5]);
// no stays yet: the first one is made from the whole chapter
assert.deepEqual(withSpan(undefined, 0, s => { s[0] = 2; }, T), [[2, T + 1, .5, .5]]);
// an index past the end edits the first stay (never makes a hole)
assert.equal(withSpan(two, 5, s => { s[0] = 1; }, T).length, 2);
console.log('people-spans-test: ok');
