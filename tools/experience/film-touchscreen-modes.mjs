// The desk's onboard touchscreen in a film: two face modes in the app's own look (the hub: HEIGHT tile, the Sitting /
// Stool / Standing preset row; touchscreen-display.mjs draws the header), registered on TouchscreenDisplay.modes for
// the shot's `touchscreen.screen` keys (experience/touchscreen-track.mjs). film-fx.mjs imports this module when a shot
// has the field; the Director's live preview runs film-fx too. Elsewhere a key with one of these modes shows the app's
// own screen (touchscreen-display.mjs: an unknown mode). Stream S15 (Nov 14 2026), the high school chapter: Noah lowers
// the desk for Kai.
//   'presetPrompt' { title, text, button, sub, pressed, person, preset }   a person's saved height as a question: the
//                  title and line on the left, the HEIGHT tile on the right, the big button where TouchscreenDisplay's
//                  'prompt' puts it (FILM_BUTTON: the same drawing, so the finger lands on it), the preset row below
//                  with the person's preset; pressed: the button pushed in and lit, the person's preset lit with it
//   'presetMoving' { title, from, target, done, person }   the desk on its way to the preset: the live height large in
//                  the HEIGHT tile (state.height: the desk's real height, so the number counts with the desk), the
//                  progress bar, the person's tile; within 0.05 in of the target `done` with a tick
// The face is authored upright, as the app draws it (the screen faces its user; the film's insert camera is placed to
// read it). The import below must be the URL studio.js uses (?v= included), or the modes land on a second copy of
// the module (tests/film-touchscreen-modes-test.mjs checks it).
import { TouchscreenDisplay, FILM_BUTTON } from '../../touchscreen-display.mjs?v=film-touchscreen-20261114';

const GREEN = dark => dark ? '#4fd17a' : '#1f8a45';
// The app's preset row (touchscreen-display.mjs: 'Sitting', 'Stool', 'Standing' at 29.3 / 35.0 / 42.1), with the
// person's own preset as a fourth; lit: 0..1.
function presetRow(ui, f, lit) {
    const { c, text, box, ink, muted, blue, dark } = ui;
    const row = [['Sitting', 29.3], ['Stool', 35.0], ['Standing', 42.1], [String(f.person || 'Preset'), Number(f.preset ?? f.target ?? 31)]];
    row.forEach(([label, v], i) => {
        const x = 32 + i * 306, y = 624, w = 292, h = 72, me = i === 3;
        if (me && lit > 0) { c.save(); c.shadowColor = '#5aa8ffaa'; c.shadowBlur = 28 * lit; c.globalAlpha = lit; c.fillStyle = '#5aa8ff'; c.beginPath(); c.roundRect(x - 6, y - 6, w + 12, h + 12, 30); c.fill(); c.restore(); }
        box(x, y, w, h, 24, me ? (dark ? '#173a6e' : '#cfdcff') : undefined);
        text(label, x + 24, y + 46, 30, me ? (dark ? '#ffffff' : blue) : ink, me ? '700' : '600');
        c.textAlign = 'right'; text(v.toFixed(1), x + w - 22, y + 46, 28, me ? (dark ? '#cfe0ff' : blue) : muted, '600'); c.textAlign = 'left';
    });
}
function heightTile(ui, state, x, y, w, h, size) {
    const { text, box, muted, ink } = ui;
    box(x, y, w, h, 30);
    text('HEIGHT', x + 22, y + 38, 20, muted, '600');
    text(state.height.toFixed(1), x + 26, y + 38 + size * .95, size, ink, '700');
    text('INCHES', x + 28, y + 38 + size * .95 + 40, 20, muted, '600');
}
const modes = {
    presetPrompt(ui, state, f) {
        const { c, text, muted, ink } = ui, p = f.pressed === true ? 1 : Math.max(0, Math.min(1, Number(f.pressed) || 0));
        // the button and its pushed / lit look: TouchscreenDisplay's own prompt (FILM_BUTTON), title and line ours
        TouchscreenDisplay.modes.prompt({ ...ui, text: (label, x, y, ...rest) => (y === 330 ? null : ui.text(label, x, y, ...rest)) }, state, { button: f.button, sub: f.sub, pressed: f.pressed });
        if (f.title) text(String(f.title), 70, 190, 60, ink, '700');
        if (f.text) text(String(f.text), 72, 258, 32, muted, '400');
        heightTile(ui, state, 934, 105, 320, 250, 84);
        presetRow(ui, f, p);
        void c; void FILM_BUTTON;
    },
    presetMoving(ui, state, f) {
        const { c, text, box, ink, muted, blue, dark } = ui, h = state.height, target = Number(f.target), from = Number.isFinite(Number(f.from)) ? Number(f.from) : null;
        const there = Number.isFinite(target) && Math.abs(h - target) < .05, down = Number.isFinite(target) && target < (from ?? h);
        // the HEIGHT tile, large: the number is the desk's own height at this frame
        box(26, 105, 760, 500, 30);
        text(String(there ? (f.done || 'At height') : (f.title || (down ? 'Lowering' : 'Raising'))), 56, 168, 44, there ? GREEN(dark) : ink, '700');
        c.textAlign = 'right'; text(h.toFixed(1), 600, 430, 230, ink, '700'); c.textAlign = 'left';
        text('in', 615, 430, 64, muted, '600');
        if (from !== null && Number.isFinite(target)) {
            const k = Math.max(0, Math.min(1, Math.abs(h - from) / (Math.abs(target - from) || 1)));
            box(56, 520, 700, 34, 17, dark ? '#12181d' : '#dae1e9', false);
            if (k > 0) { c.fillStyle = there ? GREEN(dark) : blue; c.beginPath(); c.roundRect(56, 520, Math.max(34, 700 * k), 34, 17); c.fill(); }
            text(`${from.toFixed(1)}`, 56, 588, 24, muted, '600'); c.textAlign = 'right'; text(`${target.toFixed(1)} in`, 756, 588, 24, muted, '600'); c.textAlign = 'left';
        }
        // the person's tile: who the desk is going to
        box(810, 105, 444, 500, 30, dark ? '#173a6e' : '#e3ebff');
        const cx = 1032, cy = 250, r = 78;
        c.save(); c.fillStyle = there ? GREEN(dark) : blue; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); c.restore();
        c.textAlign = 'center';
        if (there) { c.save(); c.strokeStyle = '#ffffff'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(cx - 34, cy + 2); c.lineTo(cx - 8, cy + 28); c.lineTo(cx + 38, cy - 26); c.stroke(); c.restore(); }
        else text(String(f.person || '?').slice(0, 1).toUpperCase(), cx, cy + 30, 86, '#ffffff', '700');
        text(String(f.person || ''), cx, cy + r + 70, 52, dark ? '#ffffff' : blue, '700');
        text(Number.isFinite(target) ? `${target.toFixed(1)} in · saved` : '', cx, cy + r + 118, 28, muted, '600');
        if (!there) { c.save(); c.fillStyle = blue; c.beginPath(); const y = 520; c.moveTo(cx - 34, y); c.lineTo(cx + 34, y); c.lineTo(cx, y + (down ? 44 : -44)); c.closePath(); c.fill(); c.restore(); }
        else text('Ready', cx, 556, 34, GREEN(dark), '700');
        c.textAlign = 'left';
        presetRow(ui, { ...f, preset: target }, 1);
    },
};
Object.assign(TouchscreenDisplay.modes, modes);
export const MODE_NAMES = Object.keys(modes);
