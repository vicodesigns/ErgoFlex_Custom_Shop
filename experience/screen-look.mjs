// How the film's screens look (19 Nov 2026, Vico: "the screens … are a little too bright, they pop out too much … a
// slider that makes the image dull or full strength, and whatever other settings there are for a screen, so I can make it
// look more like a monitor image"). One chapter field, shot.screenLook = { all: {…}, per: { '<screen target>': {…} } }:
// every value left out is today's, so a shot without it renders exactly as before. The Director's Graphics tab edits it,
// Export cut carries it, the importer writes it into the film shot (build-round8-director.py), and film-fx.mjs applies it
// to each film screen (the live stage, Render still, Film look and the 4K render alike). Pure: node tests run it.
//
//   brightness  the picture's strength: 1 = as today, .3 dull, up to 1.5
//   contrast    1 = as today; below flattens toward mid grey, above deepens
//   black       black level: a real LCD is never black; 0 = as today, up to .25 (the lift of the darkest parts)
//   saturation  1 = as today; 0 = grey
//   warmth      white point: 0 = as today, -1 cooler (bluish) … +1 warmer (yellowish)
//   glare       the room on the glass: a veil of light over the picture that lifts its darks most; 0 = none, up to 1
//   spill       how much of the screen's light blooms into the frame (Render / Film look): 1 = as today, 0 = none, 2 = double
export const FIELDS = {
  brightness: { label: 'Strength', tip: 'Full strength (100 %) down to dull', min: .2, max: 1.5, step: .01, def: 1, pct: true },
  contrast: { label: 'Contrast', tip: 'Below 100 % flattens the picture toward mid grey', min: .5, max: 1.5, step: .01, def: 1, pct: true },
  black: { label: 'Black level', tip: 'Lifts the darkest parts, as a real monitor never shows pure black', min: 0, max: .25, step: .005, def: 0, pct: true },
  saturation: { label: 'Saturation', tip: 'Colour strength; 0 % is grey', min: 0, max: 1.5, step: .01, def: 1, pct: true },
  warmth: { label: 'Colour temperature', tip: 'The white point: cooler (bluish) to warmer (yellowish)', min: -1, max: 1, step: .05, def: 0 },
  glare: { label: 'Glare', tip: 'The room on the glass: a veil of light that lifts the dark parts most', min: 0, max: 1, step: .01, def: 0, pct: true },
  spill: { label: 'Glow spill', tip: 'How much of the screen\'s light blooms into the frame (Render still, Film look, the film)', min: 0, max: 2, step: .05, def: 1, pct: true },
};
export const KEYS = Object.keys(FIELDS);
const TARGET = /^[\w .:\/#()+-]{1,80}$/;
const finite = v => typeof v === 'number' && Number.isFinite(v);
// One set of values: only the ones that differ from today's, each within its range (null: nothing left).
export function cleanValues(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const k of KEYS) { const f = FIELDS[k], x = v[k]; if (!finite(x)) continue; const c = Math.round(Math.min(f.max, Math.max(f.min, x)) * 1000) / 1000; if (c !== f.def) out[k] = c; }
  return Object.keys(out).length ? out : null;
}
// The chapter's field: {all?, per?} with only what changes anything; null when nothing does (the field is then left out).
export function cleanScreenLook(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const all = cleanValues(v.all), per = {};
  if (v.per && typeof v.per === 'object' && !Array.isArray(v.per)) for (const [t, x] of Object.entries(v.per).slice(0, 40)) { const c = cleanValues(x); if (c && TARGET.test(t)) per[t] = c; }
  const out = { ...(all ? { all } : {}), ...(Object.keys(per).length ? { per } : {}) };
  return Object.keys(out).length ? out : null;
}
// The values a screen gets: today's, then the chapter's "all screens", then its own.
export function lookFor(look, target) {
  const out = Object.fromEntries(KEYS.map(k => [k, FIELDS[k].def])), c = cleanScreenLook(look);
  Object.assign(out, c?.all || {}, (target !== undefined && target !== null && c?.per?.[String(target)]) || {});
  return out;
}
export const isToday = (values, keys = KEYS) => keys.every(k => values[k] === FIELDS[k].def);
// Only these need the picture's own pixels changed (a shader); strength is the material's colour, spill the bloom's.
export const SHADED = ['contrast', 'black', 'saturation', 'warmth', 'glare'];
// The white point for warmth w: a warm (3200 K-ish) or cool (9300 K-ish) tint, at |w|.
export function tintOf(w) {
  const warm = [1, .9, .74], cool = [.84, .92, 1], t = w > 0 ? warm : cool, a = Math.min(1, Math.abs(w));
  return t.map(x => 1 + (x - 1) * a);
}
// GLSL for film-fx's screen material (after the picture is sampled: diffuseColor is linear). uniforms: screenLook (vec4:
// contrast, black, saturation, glare) and screenTint (vec3). The same maths as applyLook below.
export const GLSL = `
uniform vec4 screenLook; uniform vec3 screenTint;
vec3 screenLookApply( vec3 c ) {
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, screenLook.z );
  c = max( ( c - 0.214 ) * screenLook.x + 0.214, 0.0 );
  c = c * screenTint;
  c = screenLook.y + c * ( 1.0 - screenLook.y );
  c = c + screenLook.w * 0.12 * ( 1.0 - min( c, 1.0 ) );
  return c;
}`;
export const CALL = 'diffuseColor.rgb = screenLookApply( diffuseColor.rgb );';
// The same on one linear colour, for tests and for anything drawn on a canvas.
export function applyLook(rgb, v) {
  const l = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2], t = tintOf(v.warmth);
  return rgb.map((x, i) => { let c = l + (x - l) * v.saturation; c = Math.max((c - .214) * v.contrast + .214, 0); c *= t[i]; c = v.black + c * (1 - v.black); return c + v.glare * .12 * (1 - Math.min(c, 1)); });
}
// The uniforms' values for a screen's values.
export const uniformsOf = v => ({ look: [v.contrast, v.black, v.saturation, v.glare], tint: tintOf(v.warmth) });
// The cut's field: kept as the Director left it (cleaned); {} is kept too: "back to today's" must reach the film.
export const cleanScreenLookField = v => v && typeof v.screenLook === 'object' && v.screenLook !== null && !Array.isArray(v.screenLook) ? { screenLook: cleanScreenLook(v.screenLook) || {} } : {};
// The film shot as the Director shows it: the cut's look over the film's ({} or a look of nothing: the film's goes).
export function withScreenLook(next, shot) {
  if (shot?.screenLook === undefined) return next;
  const c = cleanScreenLook(shot.screenLook); if (c) next.screenLook = c; else delete next.screenLook; return next;
}
