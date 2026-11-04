// Gym colourways (node only): green stays exactly the authored room, black/red
// has the same shape with no green left in it, and the saved-state swaps only
// touch the authored values of the other colourway.
import assert from 'node:assert/strict';
import { GYM_THEMES, GYM_MODES, gymTheme, gymModes, themedGymLayout, themeGymDeskStyle, themeGymLights } from '../gym-theme.mjs?v=gym-black-red-20261104';
import { ROOM_DESK_STYLES, GYM_BLACKRED_DESK, roomDeskStyle, cleanDeskStyle, cleanRoomDeskStyles } from '../room-desk-styles.mjs?v=gym-black-red-20261104'; // the instance gym-theme.mjs reads
import { ROOM_DETAIL_PALETTES } from '../room-finish-palettes.mjs';

// GYM_MODES exactly as authored at 34f383e (gym-room.mjs:35-41), before the colourway toggle.
const AUTHORED_GYM_MODES = {
    morning: { label: 'Morning', description: 'Sunrise mobility · standing coach station', key: '#ffe9c9', fill: '#d6e8f2', accent: '#bded66', power: 1.65, ambient: .44, bounce: .62, exposure: 1.04, sky: ['#87bed5', '#f9dfac'], practical: .3, wash: .24, colors: ['#bbc99a', '#9fc2bc'], sun: [.9, -.36, '#ffcf96', .4], glass: .34, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Daylight strength · workout tracking at standing height', key: '#f3f9ff', fill: '#dcebf3', accent: '#c1ed69', power: 1.75, ambient: .46, bounce: .66, exposure: 1.04, sky: ['#79b7d6', '#dbece8'], practical: .4, wash: .3, colors: ['#b7ce90', '#8fbbb9'], sun: [1.45, .12, '#fff1dc', .26], glass: .4, height: 43.5, tilt: -5, offset: [0, 70], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Recovery & stretching · lowered desk for session notes', key: '#ffc39c', fill: '#c4d6e6', accent: '#75e0ce', power: .72, ambient: .28, bounce: .36, exposure: 1.09, sky: ['#837eaa', '#e5a984'], practical: .78, wash: .34, colors: ['#cfbe94', '#8cbeb2'], sun: [.72, .48, '#ff9e62', .42], glass: .2, height: 28, tilt: 0, offset: [0, 80], yaw: 0, leds: true, color: '#69dec9' },
    night: { label: 'Night', description: 'Reset & recharge · gear stowed, desk folded, floor clear', key: '#a9c8ec', fill: '#b6cce4', accent: '#55dbe1', power: .15, ambient: .17, bounce: .23, exposure: 1.1, sky: ['#132b48', '#3c5b75'], practical: .45, wash: .18, colors: ['#b8b497', '#8da8af'], sun: [1.2, -.1, '#8fb8ff', .07], glass: .045, height: 43.5, tilt: 65, offset: [50, 180], yaw: -8, leds: true, color: '#aaa487' },
    party: { label: 'Power circuit', description: 'High-energy circuit · desk turned toward the training zone', key: '#dce6fc', fill: '#d4dfee', accent: '#c3f343', power: 1.2, ambient: .4, bounce: .55, exposure: 1.08, sky: ['#3c4b70', '#8b85a1'], practical: .85, wash: .68, colors: ['#b2ce79', '#77afa6'], sun: [1.2, 0, '#000000', 0], glass: .09, height: 43.5, tilt: 12, offset: [50, 260], yaw: -14, leds: true, color: '#b6f348' }
};

// Green is the authored room, by identity where the room reads it.
assert.equal(gymModes('green'), GYM_MODES);
assert.deepEqual(GYM_MODES, AUTHORED_GYM_MODES);
assert.equal(GYM_THEMES.green.desk, ROOM_DESK_STYLES.gym);
assert.deepEqual(roomDeskStyle('gym', 'green'), { name: 'Grey & active green', woodFinish: 'Modern Grey', baseFinish: 'Black', trimColor: '#286344', sheen: 'satin', secondary: 'Space Gray' });
assert.equal(roomDeskStyle('gym'), ROOM_DESK_STYLES.gym);
assert.equal(roomDeskStyle('office', 'blackred'), ROOM_DESK_STYLES.office, 'Other rooms ignore the gym colourway');
assert.equal(roomDeskStyle('gym', 'blackred'), GYM_BLACKRED_DESK);
assert.deepEqual(ROOM_DETAIL_PALETTES.gym, ['#647d78', '#408778', '#e4e8dd', '#b7c8bf']);
assert.equal(GYM_THEMES.green.finish, null); assert.equal(GYM_THEMES.green.detailPalette, null);
const layout = { id: 'house', width: 4200, props: [] };
assert.equal(themedGymLayout(layout, 'green'), layout);
assert.equal(themedGymLayout(layout, undefined), layout);
assert.equal(themedGymLayout(layout, 'teal'), layout);
const themed = themedGymLayout(layout, 'blackred');
assert.notEqual(themed, layout); assert.equal(themed.theme, 'blackred'); assert.equal(themed.props, layout.props);
assert.equal(themed.finish.name, 'Matte black & signal red'); assert.deepEqual(themed.detailPalette, GYM_THEMES.blackred.detailPalette);
assert.equal(layout.theme, undefined, 'The shared layout object is never mutated');
for (const id of [undefined, null, '', 'teal', 'GREEN', '__proto__']) { assert.equal(gymTheme(id), GYM_THEMES.green); assert.equal(gymModes(id), GYM_MODES); }

// The black & red desk is a real catalog desk (the catalog's gaming preset finish).
assert.deepEqual(cleanDeskStyle(GYM_BLACKRED_DESK), { woodFinish: 'Black Birch', baseFinish: 'Black', trimColor: '#dc0909', sheen: 'satin' });
assert.equal(cleanRoomDeskStyles({ gymBlackRed: GYM_BLACKRED_DESK }).gymBlackRed, undefined, 'Not a room id');

// Same shape at every depth, so the room never reads a missing value.
const shape = (a, b, at) => {
    if (a === null || b === null) { assert.ok(a === null && b === null || at === 'finish' || at === 'detailPalette' || at === 'screenAccent' || at === 'screenMono' || at === 'book' || at === 'props', 'null only for green room defaults: ' + at); return; }
    assert.equal(typeof a, typeof b, at); assert.equal(Array.isArray(a), Array.isArray(b), at);
    // Material options are per finish (gloss red adds metalness); their keys may differ.
    if (typeof a !== 'object' || /materials\.\w+\.1$/.test(at)) return;
    if (Array.isArray(a)) assert.equal(a.length, b.length, at + ' length');
    else assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), at + ' keys');
    for (const k of Object.keys(a)) shape(a[k], b[k], at ? at + '.' + k : k);
};
const { id: _g, label: _gl, ...green } = GYM_THEMES.green, { id: _b, label: _bl, ...blackred } = GYM_THEMES.blackred;
shape(green, blackred, '');
for (const [id, mode] of Object.entries(GYM_THEMES.blackred.modes)) {
    assert.equal(mode.label, GYM_MODES[id].label); assert.equal(mode.description, GYM_MODES[id].description);
    for (const k of ['height', 'tilt', 'offset', 'yaw', 'leds', 'sun', 'power']) assert.deepEqual(mode[k], GYM_MODES[id][k], `${id}.${k}: posture and sun are shared`);
    assert.equal(!!mode.color, !!GYM_MODES[id].color);
}

// No green leak: every colour in black & red (foliage and the outdoor sky aside)
// is either a non-green hue or close to neutral.
const hsl = hex => {
    const v = hex.replace('#', '').slice(0, 6), [r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1)), h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    return [(h + 360) % 360, s, l];
};
let checked = 0;
const leaks = [], walk = (v, at) => {
    if (/^instances\.plants|^modes\.\w+\.sky/.test(at)) return;
    if (typeof v === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) { checked++; const [h, s] = hsl(v); if (h >= 70 && h <= 170 && s >= .2) leaks.push(at + ' ' + v); return; }
    if (typeof v === 'string' && /^\d+,\d+,\d+$/.test(v)) return walk('#' + v.split(',').map(n => (+n).toString(16).padStart(2, '0')).join(''), at);
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, at ? at + '.' + k : k);
};
walk(blackred, '');
assert.deepEqual(leaks, [], 'Green left in black & red');
assert.ok(checked > 120, 'The leak scan reached the palette: ' + checked);
assert.ok(walk('#c0ea50', 'canary') === undefined && leaks.pop() === 'canary #c0ea50', 'The leak scan flags lime');
assert.ok(hsl(GYM_BLACKRED_DESK.trimColor)[0] < 10, 'Red desk trim');

// Saved scene desks: an exact authored desk of the other colourway swaps; a custom one stays.
const greenDesk = cleanDeskStyle(ROOM_DESK_STYLES.gym), redDesk = cleanDeskStyle(GYM_BLACKRED_DESK);
assert.deepEqual(cleanDeskStyle(themeGymDeskStyle(greenDesk, 'blackred')), redDesk);
assert.deepEqual(cleanDeskStyle(themeGymDeskStyle(redDesk, 'green')), greenDesk);
assert.equal(themeGymDeskStyle(greenDesk, 'green'), greenDesk);
assert.equal(themeGymDeskStyle(redDesk, 'blackred'), redDesk);
assert.equal(themeGymDeskStyle({ ...greenDesk, trimColor: '#286344'.toUpperCase() }, 'blackred').woodFinish, 'Black Birch', 'Hex case does not matter');
assert.equal(themeGymDeskStyle({ ...greenDesk, sheen: 'gloss' }, 'blackred').sheen, 'gloss', 'Sheen is the visitor\'s choice');
const custom = { woodFinish: 'Walnut', baseFinish: 'Black', trimColor: '#286344', sheen: 'satin' };
assert.equal(themeGymDeskStyle(custom, 'blackred'), custom);
assert.equal(themeGymDeskStyle({ ...greenDesk, woodFinish: 'Walnut' }, 'blackred').woodFinish, 'Walnut');
for (const v of [undefined, null, {}]) assert.equal(themeGymDeskStyle(v, 'blackred'), v);

// Saved LED colours: a mode's authored colour maps to the same mode in the other colourway.
for (const id of Object.keys(GYM_MODES)) {
    const g = GYM_MODES[id].color, r = GYM_THEMES.blackred.modes[id].color;
    if (!g) continue;
    const lights = { color: g, glow: 24, enabled: true, effect: { mode: 'solid' } };
    const swapped = themeGymLights(lights, 'blackred');
    assert.deepEqual(swapped, { ...lights, color: r }, id);
    assert.equal(lights.color, g, 'The saved object is not mutated');
    assert.equal(themeGymLights(swapped, 'green').color, g, id + ' round trip');
    assert.equal(themeGymLights(lights, 'green'), lights);
}
assert.equal(themeGymLights({ color: '#B6F348' }, 'blackred').color, GYM_THEMES.blackred.modes.party.color);
for (const v of [{ color: '#33aa66' }, { color: '#ffffff' }, {}, undefined, { color: 3 }]) assert.equal(themeGymLights(v, 'blackred'), v);

console.log('PASS: gym colourways: green identical to 34f383e, black/red shape, no green leak, desk and LED swaps.');
