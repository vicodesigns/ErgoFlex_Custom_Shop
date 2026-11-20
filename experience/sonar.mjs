// The film's sonar (stage.mjs, the 'proximity' chapter: awareness) as the Director sets it: shot.sonar, ABSENT by default.
// Absent means the film as it is: the reach is the desk's distance to the nearest film obstacle, three pings alive at once
// (a ping every 2.4 s, 7.2 s to arrive), centred on the desk. Every key below is a change from that, and a key that equals
// the film's own value is not kept (so a chapter he never touched, or put back, has no `sonar` and renders as before).
//   shot.sonar = {
//     enabled?: false,    the film's sonar off for this chapter (true is the film's own: not kept)
//     radius?: inches,    how far the rings run (the reach, 6..600): replaces the distance to the obstacle; the rings then run
//                         to this circle whatever the obstacle's place, and the circle lights as each ping lands
//     rings?: 1..6,       rings per pulse = how many rings are alive at once; they are spaced travel / rings apart
//                         (the film's own count is 3 = 2.4 s apart over 7.2 s, so rings: 3 is not kept)
//     x?, z?: inches,     the centre's offset from the desk's centre (the film's), on the stage's own axes as they are at
//                         the start (X to the right, Z toward the camera) and turning with the desk after that
//   }
// `{}` is kept too ("back to the film's"): an Export cut must be able to take an imported sonar off the film shot.
export const FILM_RINGS = 3, TRAVEL = 7.2, FILM_GAP = 2.4;
export const FIELDS = {
  radius: { min: 6, max: 600, step: 0.5, label: 'Size (radius)' },
  rings: { min: 1, max: 6, step: 1, label: 'Rings per pulse' },
  x: { min: -240, max: 240, step: 0.5, label: 'Centre X' },
  z: { min: -240, max: 240, step: 0.5, label: 'Centre Z' },
};
const round = v => Math.round(v * 10) / 10;
const finite = v => typeof v === 'number' && Number.isFinite(v);
// One sonar object -> its kept form, or null when nothing in it differs from the film's.
export function cleanSonar(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  if (v.enabled === false) out.enabled = false;
  if (finite(v.radius)) out.radius = round(Math.min(FIELDS.radius.max, Math.max(FIELDS.radius.min, v.radius)));
  if (finite(v.rings)) { const n = Math.min(FIELDS.rings.max, Math.max(FIELDS.rings.min, Math.round(v.rings))); if (n !== FILM_RINGS) out.rings = n; }
  for (const k of ['x', 'z']) if (finite(v[k])) { const n = round(Math.min(FIELDS[k].max, Math.max(FIELDS[k].min, v[k]))); if (n !== 0) out[k] = n; }
  return Object.keys(out).length ? out : null;
}
// The cut's field: kept as the Director left it (cleaned); {} (back to the film's) is kept; anything else: no field.
export const cleanSonarField = v => v && typeof v.sonar === 'object' && v.sonar !== null && !Array.isArray(v.sonar) ? { sonar: cleanSonar(v.sonar) || {} } : {};
// The film shot as the Director shows and renders it: the cut's sonar over the film's ({} or nothing that differs: the film's goes).
export function withSonar(next, shot) {
  if (shot?.sonar === undefined) return next;
  const c = cleanSonar(shot.sonar); if (c) next.sonar = c; else delete next.sonar; return next;
}
// Rings per pulse -> the pings' spacing in seconds (the film's own count, or none set: the film's own 2.4 s, exactly).
export const gapOf = cfg => cfg?.rings ? TRAVEL / cfg.rings : FILM_GAP;
// How many ping meshes the stage needs: the film's 7; more when the rings come closer than the film's (a ring runs on until
// it reaches the obstacle, which can be up to twice the reach away, so about twice as many are alive).
export const meshesFor = cfg => cfg?.rings > FILM_RINGS ? Math.max(7, cfg.rings * 2 + 2) : 7;
// The time (chapter seconds) that holds the sonar at the moment all its rings are out at once, evenly spaced: the newest is
// half a gap old, the others a gap apart, the oldest still short of the reach (Preview at full; the Director's, never saved).
export const fullSec = (pingStop, cfg) => { const gap = gapOf(cfg); return pingStop - TRAVEL + Math.ceil(TRAVEL / gap) * gap + gap / 2; };
// The ping loop of stage.mjs tick(), as numbers. S = the reach (world units), far = the reach in this frame (the obstacle's
// near edge from the centre, or S), count = ping meshes, cfg = the cleaned shot.sonar or null.
// Returns {from, speed, rows: [{i, age, r, alive, a}], echoAge}: a = the ping's opacity before reduced motion; echoAge = how
// long ago the newest ping to reach `far` arrived (Infinity: none yet). With cfg null this is the film's loop to the digit.
export function pingRows({ sec, pingStop, S, far, count, cfg = null }) {
  const travel = TRAVEL, gap = gapOf(cfg), from = S * .06, speed = (S - from) / travel;
  const first = Math.ceil((sec - pingStop + travel) / gap - 1e-9); let echoAge = Infinity; const rows = [];
  for (let i = 0; i < count; i++) {
    const age = sec - (pingStop - travel + (first - 1 - i) * gap), r = from + speed * age;
    if (age < 0 || r >= far) { if (age >= 0) echoAge = Math.min(echoAge, (r - far) / speed); rows.push({ i, age, r, alive: false, a: 0 }); continue; }
    rows.push({ i, age, r, alive: true, a: .9 * Math.min(1, age / .35) * (1 - .3 * r / far) });
  }
  return { from, speed, rows, echoAge };
}
