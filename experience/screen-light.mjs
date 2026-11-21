// The light the screens throw onto the room (21 Nov 2026, Vico on the media chapters: "the colours reflected onto the
// surfaces from the screens look a bit too bright and washed out"). In a chapter with ledMode 'media' (chapter 9 music,
// the gaming room's TV montage; chapter 10 media, movie night) the desk's LED light is the screen's picture: film-fx.mjs
// samples the picture (led-screen-sampler.mjs: bands and edges, linear light), scales it by shot.ledGain, clips each
// channel at the strip's maximum and uploads it to the strips, the desk's receivers (desktop, floor / foot glow, base,
// wings) and the room LED spill (walls and floor within ~2 m); the picture's mean colour becomes the LED colour too.
// That is the coloured light on the desk, the floor and the walls. This module tunes it, after the sampling and before
// the upload. It never touches the screens' own pictures (that is screenLook, experience/screen-look.mjs).
//
// One chapter field, shot.sceneGlobals.screenLight = {gain?, saturation?, contrast?, tint?, keepHue?}: every value left
// out is today's, so a chapter without it (or with {}) renders exactly as before (the same code path, same pixels).
// The Director's Lighting tab edits it, Export cut carries it in the shot's sceneGlobals, build-round8-director.py
// --import keeps it in the chapter's director-camera-<id>.json 'lighting' and the pass writes it back into the film
// shot's sceneGlobals ({} = back to the film's default: the field is removed). Pure: node tests run it.
//
//   gain        brightness of the light: x on top of the chapter's ledGain; 1 = as today, .5 half, up to 3
//   saturation  colour strength of the light (luminance kept, linear Rec.709 weights): 1 = as today, 0 = white light,
//               up to 3. Applied before the gain and the clip.
//   contrast    1 = as today; above deepens the dark samples and lifts the bright ones (a power on each sample's
//               luminance around linear .18), below evens them out. .5 to 2.
//   tint        '#rrggbb': a colour filter on the light at the same luminance; '#ffffff' = none. A pale colour is a
//               light tint, a saturated one a strong one.
//   keepHue     false = as today: a channel the gain pushes past the strip's maximum clips on its own, so bright colours
//               wash toward white (the "washed out" look at a high ledGain). true = the whole colour is scaled down
//               instead, keeping its hue and saturation.
export const FIELDS = {
  gain: { label: 'Brightness', tip: 'How bright the screen-coloured light on the desk, floor and walls is (100 % = the chapter as today)', min: 0, max: 3, step: .01, def: 1, pct: true },
  saturation: { label: 'Saturation', tip: 'Colour strength of the light; 0 % is white light', min: 0, max: 3, step: .01, def: 1, pct: true },
  contrast: { label: 'Contrast', tip: 'Above 100 % the dark parts of the picture throw less light and the bright parts more', min: .5, max: 2, step: .01, def: 1, pct: true },
  tint: { label: 'Tint', tip: 'A colour filter on the light, at the same brightness (white = none)', def: '#ffffff', color: true },
  keepHue: { label: 'Keep colours in highlights', tip: 'Where the light is brightest, dim the whole colour instead of letting it wash to white', def: false, bool: true },
};
export const KEYS = Object.keys(FIELDS);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const HEX = /^#[0-9a-f]{6}$/i;
// The chapter's field with only the values that differ from today's, each in its range ({} when nothing does).
// null for something that is not an object at all (the field is then left alone).
export function cleanScreenLight(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const k of KEYS) {
    const f = FIELDS[k], x = v[k];
    if (f.bool) { if (typeof x === 'boolean' && x !== f.def) out[k] = x; continue; }
    if (f.color) { if (typeof x === 'string' && HEX.test(x) && x.toLowerCase() !== f.def) out[k] = x.toLowerCase(); continue; }
    if (!finite(x)) continue;
    const c = Math.round(Math.min(f.max, Math.max(f.min, x)) * 1000) / 1000;
    if (c !== f.def) out[k] = c;
  }
  return out;
}
export const isToday = v => { const c = cleanScreenLight(v); return !c || !Object.keys(c).length; };
// Every value, today's filled in.
export const lightFor = v => ({ ...Object.fromEntries(KEYS.map(k => [k, FIELDS[k].def])), ...(cleanScreenLight(v) || {}) });

const lin = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4, srgb = c => c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055;
const Y = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const PIVOT = .18;
// The tint filter: the hex colour in linear light, normalised to luminance 1.
function filterOf(hex) {
  const c = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255)), y = Y(...c);
  return y > 1e-6 ? c.map(x => x / y) : [1, 1, 1];
}
// A prepared transform (film-fx builds it once per chapter and on a Director edit): null = today's (no transform).
export function screenLightTransform(v) {
  if (isToday(v)) return null;
  const s = lightFor(v);
  return { ...s, filter: filterOf(s.tint) };
}
// One colour, linear light (0…1 = the strip's range before the gain), through contrast, saturation and tint; the gain
// and the clip are the caller's (applyPixel). Writes into out[0..2].
export function shapeLinear(t, r, g, b, out) {
  let y = Y(r, g, b);
  if (t.contrast !== 1 && y > 1e-6) { const k = PIVOT * (y / PIVOT) ** t.contrast / y; r *= k; g *= k; b *= k; y *= k; }
  if (t.saturation !== 1) { r = y + (r - y) * t.saturation; g = y + (g - y) * t.saturation; b = y + (b - y) * t.saturation; }
  if (t.tint !== '#ffffff') { r *= t.filter[0]; g *= t.filter[1]; b *= t.filter[2]; }
  out[0] = Math.max(0, r); out[1] = Math.max(0, g); out[2] = Math.max(0, b);
  return out;
}
// The media-mode LED target for one pixel: the sampler's linear bytes (0…255), x ledGain x gain, clipped (per channel,
// or as a whole with keepHue), as bytes. Writes rgb into dst[i..i+2] and keeps the sampler's 4th (white) byte x gains.
const tmp = [0, 0, 0];
export function applyPixel(t, src, dst, i, ledGain) {
  shapeLinear(t, src[i] / 255, src[i + 1] / 255, src[i + 2] / 255, tmp);
  const k = 255 * ledGain * t.gain;
  let r = tmp[0] * k, g = tmp[1] * k, b = tmp[2] * k;
  if (t.keepHue) { const m = Math.max(r, g, b); if (m > 255) { const f = 255 / m; r *= f; g *= f; b *= f; } }
  dst[i] = Math.min(255, r); dst[i + 1] = Math.min(255, g); dst[i + 2] = Math.min(255, b); dst[i + 3] = Math.min(255, src[i + 3] * ledGain * t.gain);
}
// The LED colour film-fx sets from the picture's mean (an sRGB hex): the same shaping and gain (no ledGain: that colour
// never took it), clipped as a whole so it keeps its hue.
export function applyHex(t, hex) {
  shapeLinear(t, ...[1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255)), tmp);
  let c = tmp.map(x => x * t.gain); const m = Math.max(...c); if (m > 1) c = c.map(x => x / m);
  return '#' + c.map(x => Math.round(Math.max(0, Math.min(1, srgb(x))) * 255).toString(16).padStart(2, '0')).join('');
}
