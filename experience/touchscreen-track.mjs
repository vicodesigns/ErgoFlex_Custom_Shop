// The desk's onboard touchscreen in a film chapter (shot.touchscreen), posed from chapter time: the same second is
// always the same screen, however the film is played, scrubbed or baked (the app's own easing, studio.js, steps the
// screen by the frame's dt and is not used by a film). A shot without the field leaves the screen alone.
//
//   touchscreen: {
//     from: 0,                            where the screen is before the first `open` key (0 stowed under the desktop's
//                                         front-right corner, 1 slid out and turned up to face the user; default 0)
//     open: [{ at, to, dur, easing }],    from `at` (chapter seconds) the screen travels to `to` (0..1, or true / false)
//                                         over `dur` seconds (default: the app's speed, SCREEN_TRAVEL for a full travel,
//                                         less for part of one); easing 'smooth' (default) or 'linear'. The first half
//                                         of the travel slides it out along its rails, the second turns it up on its
//                                         pivot (studio.js setScreenProgress). A key that starts before the previous
//                                         one has finished takes over from where the screen is then.
//     screen: [{ at, mode, ... }]         what the face shows from `at` until the next key: a film mode of
//                                         TouchscreenDisplay (touchscreen-display.mjs: 'prompt', 'moving', 'message',
//                                         or one registered there) and that mode's own fields. No key yet, or mode
//                                         'app': the app's own screen.
//   }
// Shorthand: an array is the `open` list, each key { at, open: true | false | 0..1 }.
export const SCREEN_TRAVEL = 2.2;      // seconds for a full travel (studio.js: 1 / 2.2 of the way a second)

const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
// (true / false, or a number 0..1; anything else, a string included, is no level at all: the key is dropped)
const level = v => v === true ? 1 : v === false ? 0 : typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : null;
const smooth = t => t * t * (3 - 2 * t);

// The field as the film gives it -> { from, open: [{ at, to, dur, easing }], screen: [{ at, mode, ... }] } (keys in
// time order), or null when there is nothing to pose.
export function cleanTouchscreen(value) {
    if (!value || typeof value !== 'object') return null;
    const spec = Array.isArray(value) ? { open: value } : value;
    const open = (Array.isArray(spec.open) ? spec.open : []).filter(k => k && typeof k.at === 'number' && Number.isFinite(k.at) && level(k.to ?? k.open) !== null).map(k => ({
        at: k.at, to: level(k.to ?? k.open), dur: typeof k.dur === 'number' && Number.isFinite(k.dur) ? Math.max(0, k.dur) : null, easing: k.easing === 'linear' ? 'linear' : 'smooth'
    })).sort((a, b) => a.at - b.at);      // (dur null or missing: the app's speed)
    const screen = (Array.isArray(spec.screen) ? spec.screen : []).filter(k => k && Number.isFinite(Number(k.at)) && typeof k.mode === 'string')
        .map(k => ({ ...k, at: Number(k.at) })).sort((a, b) => a.at - b.at);
    if (!open.length && !screen.length && spec.from === undefined) return null;
    return { from: level(spec.from ?? 0) ?? 0, open, screen };
}

const cache = new WeakMap();
const cleaned = spec => { if (!spec || typeof spec !== 'object') return null; if (!cache.has(spec)) cache.set(spec, cleanTouchscreen(spec)); return cache.get(spec); };

// Where the screen is (0..1) at `seconds`.
export function screenProgressAt(spec, seconds) {
    const s = cleaned(spec); if (!s) return 0;
    const t = num(seconds, 0);
    let start = s.from, prev = null;
    const value = (key, from, at) => {
        const dur = key.dur ?? SCREEN_TRAVEL * Math.abs(key.to - from);
        if (!(dur > 0)) return at >= key.at ? key.to : from;
        const u = clamp01((at - key.at) / dur);
        return from + (key.to - from) * (key.easing === 'linear' ? u : smooth(u));
    };
    for (const key of s.open) {
        if (t < key.at) break;
        if (prev) start = value(prev.key, prev.from, key.at);      // (where the screen is when this key takes over)
        prev = { key, from: start };
    }
    return clamp01(prev ? value(prev.key, prev.from, t) : s.from);
}

// What the face shows at `seconds`: the screen key in force (its fields without `at`), or null for the app's own
// screen. (No clock in it: the face is redrawn only when what it shows changes.)
export function screenContentAt(spec, seconds) {
    const s = cleaned(spec); if (!s) return null;
    const t = num(seconds, 0); let key = null;
    for (const k of s.screen) { if (t < k.at) break; key = k; }
    if (!key || key.mode === 'app') return null;
    const { at, ...fields } = key;
    return fields;
}

// The field as a cut keeps it (experience/cuts.mjs cleanShot: the Director's load, import, export and bake key):
// numbers and the known names only; a screen key's other fields are its mode's (the screens stream has modes of its
// own), kept when they are a short name with a string, number or boolean value. undefined: nothing to keep.
const FIELD = /^[A-Za-z][A-Za-z0-9]{0,31}$/;
export function cleanTouchscreenField(value) {
    const s = cleanTouchscreen(value); if (!s) return undefined;
    const out = { from: s.from, open: s.open.slice(0, 64).map(k => ({ at: Math.max(0, Math.min(600, k.at)), to: k.to, ...(k.dur === null ? {} : { dur: Math.min(60, k.dur) }), easing: k.easing })), screen: [] };
    for (const k of s.screen.slice(0, 64)) {
        const key = { at: Math.max(0, Math.min(600, k.at)), mode: String(k.mode).slice(0, 40) };
        for (const [name, v] of Object.entries(k)) {
            if (name === 'at' || name === 'mode' || !FIELD.test(name) || ['constructor', 'prototype'].includes(name)) continue;
            if (typeof v === 'string') key[name] = v.slice(0, 160); else if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) key[name] = v;
        }
        out.screen.push(key);
    }
    return out;
}

// Both, for the stage: { progress, screen } (studio.js setFilmTouchscreen), or null for a shot without the field.
export function touchscreenAt(spec, seconds) {
    if (!cleaned(spec)) return null;
    return { progress: screenProgressAt(spec, seconds), screen: screenContentAt(spec, seconds) };
}
