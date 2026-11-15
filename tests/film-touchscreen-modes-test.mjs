// The onboard touchscreen's film face modes (tools/experience/film-touchscreen-modes.mjs, stream S15) and the oilers
// chapter's face keys (exports/cinematic-intro-cut-cine/build-oilers-story.py -> review-cut.json), without a browser:
//   - the module imports touchscreen-display.mjs by the URL studio.js uses (else the modes land on a second copy);
//   - film-fx loads it only for a shot with the touchscreen field;
//   - the modes register and draw: the prompt's button through TouchscreenDisplay's own prompt (FILM_BUTTON), the
//     person's preset, the live height (state.height) counting, 'At Kai's height' once there;
//   - the cut's keys: the first key a built-in mode (the face never caches the app screen before the film modes are
//     registered), the button pressed exactly when Noah's finger lands, the counting face up before the lift starts.
//   node tests/film-touchscreen-modes-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const studioImport = read('studio.js').match(/import \{ TouchscreenDisplay \} from '\.\/(touchscreen-display\.mjs[^']*)'/)[1];
const modesSrc = read('tools/experience/film-touchscreen-modes.mjs');
assert(modesSrc.includes(`from '../../${studioImport}'`), `film-touchscreen-modes.mjs imports ${studioImport} exactly as studio.js does`);
assert.match(read('tools/experience/film-fx.mjs'), /if \(shot\.touchscreen\) await import\('\.\/film-touchscreen-modes\.mjs'\);/, 'loaded only for a shot that poses the touchscreen');

const { TouchscreenDisplay, FILM_BUTTON } = await import('../' + studioImport);
const { MODE_NAMES } = await import('../tools/experience/film-touchscreen-modes.mjs');
assert.deepEqual(MODE_NAMES, ['presetPrompt', 'presetMoving']);
for (const m of MODE_NAMES) assert.equal(typeof TouchscreenDisplay.modes[m], 'function', m + ' registered on the studio copy');

// a recording 2D context and the ui helpers as TouchscreenDisplay.update hands them over
function ui() {
  const texts = [], boxes = [];
  const c = new Proxy({ textAlign: 'left', save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, arc() {}, moveTo() {}, lineTo() {}, closePath() {} }, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; } });
  return { texts, boxes, ui: { c, text: (label, x, y, size) => texts.push({ label: String(label), x, y, size }), box: (x, y, w, h) => boxes.push([x, y, w, h]), ink: '#202832', muted: '#626f7b', blue: '#30277e', panel: '#edf1f5', base: '#e6ebf1', dark: false, top: 83, width: 1280, height: 760 } };
}
const has = (t, s) => t.some(x => x.label.includes(s));
const cut = JSON.parse(read('exports/cinematic-intro-cut-cine/review-cut.json'));
const oil = cut.shots.find(s => s.id === 'oilers'), keys = oil.touchscreen.screen;
const pk = keys.find(k => k.mode === 'presetPrompt'), mk = keys.find(k => k.mode === 'presetMoving');

{ const { texts, boxes, ui: u } = ui(); TouchscreenDisplay.modes.presetPrompt(u, { height: 43.5 }, pk);
  for (const s of [pk.title, pk.text, pk.button, pk.sub, 'Sitting', 'Stool', 'Standing', 'Kai', '31.0', '43.5']) assert(has(texts, s), 'prompt shows ' + s);
  assert(boxes.some(([x, y, w, h]) => x === FILM_BUTTON.x && y === FILM_BUTTON.y && w === FILM_BUTTON.w && h === FILM_BUTTON.h), 'the button where the finger lands (FILM_BUTTON)');
  const label = texts.find(x => x.label === pk.button);
  assert(label.x >= FILM_BUTTON.x && label.x < FILM_BUTTON.x + FILM_BUTTON.w / 2, "the label starts in the button's left half, beside the fingertip (S9: centre, hand from the right)"); }
{ const { texts, ui: u } = ui(); TouchscreenDisplay.modes.presetMoving(u, { height: 37.2 }, mk);
  assert(has(texts, '37.2') && has(texts, mk.title) && !has(texts, mk.done), 'on its way: the live height and the title'); }
{ const { texts, ui: u } = ui(); TouchscreenDisplay.modes.presetMoving(u, { height: 31.0 }, mk);
  assert(has(texts, '31.0') && has(texts, mk.done) && has(texts, 'Ready'), "there: 31.0 and At Kai's height"); }

// the cut's keys against the chapter's own moves
const known = new Set([...Object.keys(TouchscreenDisplay.modes)]);
assert(['prompt', 'moving', 'message'].includes(keys[0].mode), 'the first key is a built-in mode');
for (const k of keys) assert(known.has(k.mode), k.mode + ' is a registered mode');
const tap = oil.people.cast.find(c => c.key === 'noah-taps').act.at, lift = oil.motion.clips.find(c => c.lane === 'lift');
const pressedAt = keys.find(k => k.pressed === true).at;
assert.equal(pressedAt, tap, 'the button answers when the finger lands');
assert(mk.at <= lift.start && mk.at > pressedAt, 'the counting face is up before the desk starts');
assert.equal(mk.from, oil.motion.initial.height); assert.equal(mk.target, lift.target);
const open = oil.touchscreen.open[0].at; assert(pk.at < open, 'the app-look prompt is up before the screen comes out');
console.log('film touchscreen modes: same module as studio.js, app-look prompt and counter, keys timed to the tap and the lift: OK');
