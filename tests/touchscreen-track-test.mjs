// The film's touchscreen field (experience/touchscreen-track.mjs) and the screen's film modes (touchscreen-display.mjs):
// posed from chapter time, the same at any frame rate; inert for a chapter without the field.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cleanTouchscreen, screenProgressAt, screenContentAt, touchscreenAt, SCREEN_TRAVEL } from '../experience/touchscreen-track.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);

// ---- nothing to pose: null (the stage hands the screen back, which is a no-op when it was never taken)
for (const v of [undefined, null, 0, '', {}, [], { open: [] }, { screen: [] }]) assert.equal(touchscreenAt(v, 3), null, JSON.stringify(v));
assert.equal(cleanTouchscreen({ open: [{ at: 'x', to: 1 }] }), null, 'keys without a time are dropped');

// ---- the travel: the app's speed by default, smooth, held before and after
const open = { open: [{ at: 2, to: 1 }] };
near(screenProgressAt(open, 0), 0, 'stowed before the key');
near(screenProgressAt(open, 2), 0, 'starts at its key');
near(screenProgressAt(open, 2 + SCREEN_TRAVEL / 2), .5, 'half way at half the travel');
near(screenProgressAt(open, 2 + SCREEN_TRAVEL * .25), .15625, 'smooth (eased) start');
near(screenProgressAt(open, 2 + SCREEN_TRAVEL), 1, 'out and turned up at the end of the travel');
near(screenProgressAt(open, 99), 1, 'stays open');
near(screenProgressAt({ open: [{ at: 1, to: 1, dur: 2, easing: 'linear' }] }, 1.5), .25, 'linear easing, given duration');
near(screenProgressAt({ open: [{ at: 0, to: .5 }] }, SCREEN_TRAVEL / 2), .5, 'part of a travel takes part of the time');
near(screenProgressAt({ from: 1, open: [{ at: 4, to: 0, dur: 1 }] }, 3), 1, '`from`: open before the first key');
near(screenProgressAt({ from: 1, open: [{ at: 4, to: 0, dur: 1 }] }, 5), 0, 'and stowed after it');
near(screenProgressAt({ open: [{ at: 4, open: true, dur: 0 }] }, 4), 1, 'a zero-length key jumps');
// shorthand: an array of { at, open }
near(screenProgressAt([{ at: 0, open: true, dur: 1, easing: 'linear' }, { at: 3, open: false, dur: 1, easing: 'linear' }], 3.5), .5, 'shorthand array');
// a key that comes before the previous travel has finished takes over from where the screen is then
const back = { open: [{ at: 0, to: 1, dur: 2, easing: 'linear' }, { at: 1, to: 0, dur: 1, easing: 'linear' }] };
near(screenProgressAt(back, 1), .5, 'interrupted at half way');
near(screenProgressAt(back, 1.5), .25, 'and goes back from there');
near(screenProgressAt(back, 2), 0, 'stowed again');

// ---- frame-deterministic: the same second is the same pose at any frame rate, in any order, and never jumps
const film = { open: [{ at: 1.2, to: 1, dur: 1.6 }, { at: 9.5, to: 0 }] };
const at = t => screenProgressAt(film, t), samples = [0, 1.2, 1.7, 2.3, 2.8, 5, 9.5, 10.2, 11.7, 14];
const first = samples.map(at);
for (const fps of [24, 30, 60]) {
    let last = at(0);
    for (let f = 0; f <= 14 * fps; f++) {
        const v = at(f / fps);
        assert.ok(Math.abs(v - last) <= 1 / (1.6 * fps) * 1.51 + 1e-9, `no jump at ${fps} fps frame ${f}`); last = v;
    }
}
assert.deepEqual([...samples].reverse().map(at).reverse(), first, 'scrubbing backwards gives the same values');
assert.deepEqual(samples.map(at), first, 'sampling again gives the same values');

// ---- the face: the screen key in force, with `since`
const face = { screen: [{ at: 4, mode: 'prompt', title: 'Kai is here', button: "Lower to Kai's height" }, { at: 6.25, mode: 'prompt', button: "Lower to Kai's height", pressed: true }, { at: 6.5, mode: 'moving', target: 31, from: 43.5 }, { at: 12, mode: 'app' }] };
assert.equal(screenContentAt(face, 3.9), null, 'the app screen before the first key');
assert.deepEqual(screenContentAt(face, 5), { mode: 'prompt', title: 'Kai is here', button: "Lower to Kai's height", since: 1 });
assert.equal(screenContentAt(face, 6.3).pressed, true);
assert.deepEqual(screenContentAt(face, 7), { mode: 'moving', target: 31, from: 43.5, since: .5 });
assert.equal(screenContentAt(face, 13), null, "mode 'app': the app's own screen again");
assert.deepEqual(touchscreenAt({ ...film, ...face }, 7), { progress: 1, screen: { mode: 'moving', target: 31, from: 43.5, since: .5 } });
assert.deepEqual(touchscreenAt(face, 7).progress, 0, 'a face without open keys: the screen stays stowed');

// ---- inert where a chapter has no field (source checks on the two call sites; pixels: the display test below)
const stage = fs.readFileSync(path.join(ROOT, 'experience/stage.mjs'), 'utf8');
assert.match(stage, /if\(shot\.touchscreen\)api\.setFilmTouchscreen\?\.\(touchscreenAt\(shot\.touchscreen,t\*shot\.seconds\)\);/, 'tick poses the screen only for a chapter with the field');
assert.match(stage, /api\.setFilmTouchscreen\?\.\(touchscreenAt\(next\.touchscreen,0\)\);/, 'prepare poses it at 0, or hands it back (null)');
const studio = fs.readFileSync(path.join(ROOT, 'studio.js'), 'utf8');
assert.match(studio, /function setFilmTouchscreen\(film\) \{\s*if \(!film\) \{\s*if \(!touchscreenBeforeFilm\) return;/, 'handing back a screen the film never took does nothing');
assert.match(studio, /\.\.\.\(filmTouchscreen\?\{film:filmTouchscreen\}:\{\}\)/, 'the display state has no film key unless a film set one');

// ---- the display: without a film screen it draws exactly what it drew before this change (every canvas call and
// property set recorded and compared with the HEAD~ version of the module); with one it draws the mode's body.
function recorder() {
    const log = [];
    const ctx = new Proxy({}, {
        get(_, k) { if (k === 'canvas') return null; if (k === 'createRadialGradient' || k === 'createLinearGradient') return (...a) => { log.push([k, a]); return { addColorStop: (...b) => log.push(['stop', b]) }; }; return (...a) => { log.push([k, a]); }; },
        set(_, k, v) { log.push(['=' + String(k), v]); return true; }
    });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
    return log;
}
const state = { theme: 'light', height: 43.5, tilt: 0, guard: false, sound: true, leds: true, alert: null, heightSpeed: 'Medium', glideSpeed: 'Medium', tiltSpeed: 'Fast', heightJog: 0, phase: 'morning', moving: false };
const base = (() => { try { return execFileSync('git', ['-C', ROOT, 'merge-base', 'HEAD', 'origin/video/cinematic-intro-hq'], { encoding: 'utf8' }).trim(); } catch { return '04f24e0f'; } })();
const before = path.join(os.tmpdir(), `touchscreen-display-before-${process.pid}.mjs`);
fs.writeFileSync(before, execFileSync('git', ['-C', ROOT, 'show', `${base}:touchscreen-display.mjs`], { encoding: 'utf8' }));
try {
    const Old = (await import(pathToFileURL(before).href)).TouchscreenDisplay, New = (await import('../touchscreen-display.mjs')).TouchscreenDisplay;
    for (const s of [state, { ...state, theme: 'dark', height: 31, moving: true }, { ...state, alert: { kind: 'ahead', name: 'chair' } }]) {
        const a = recorder(); new Old().update(s); const b = recorder(); new New().update(s);
        assert.equal(JSON.stringify(b), JSON.stringify(a), 'no film screen: the same drawing as before');      // (as JSON: a gradient is a new object each time)
    }
    const plain = recorder(); new New().update(state);
    for (const film of [{ mode: 'prompt', title: 'Kai is here', button: "Lower to Kai's height", pressed: true }, { mode: 'moving', target: 31, from: 43.5 }, { mode: 'message', title: 'Hi' }]) {
        const log = recorder(); assert.equal(new New().update({ ...state, film }), true);
        assert.notEqual(JSON.stringify(log), JSON.stringify(plain), film.mode + ' draws its own body');
        assert.ok(!log.some(([k, a]) => k === 'fillText' && a[0] === 'GLIDE'), film.mode + ': the app body is not drawn under it');
    }
    const unknown = recorder(); new New().update({ ...state, film: { mode: 'no-such-mode' } });
    assert.equal(JSON.stringify(unknown), JSON.stringify(plain), 'an unknown mode shows the app screen');
    // the moving mode shows the real height it is given, to a tenth
    const moving = recorder(); new New().update({ ...state, height: 36.25, film: { mode: 'moving', target: 31, from: 43.5 } });
    assert.ok(moving.some(([k, a]) => k === 'fillText' && a[0] === '36.3'), 'the live height');
} finally { fs.rmSync(before, { force: true }); }
console.log('touchscreen track and display: ok');
