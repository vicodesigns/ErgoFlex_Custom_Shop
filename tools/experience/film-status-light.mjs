// A chapter's status-indicator light switch (19 Nov 2026, Vico's music chapter: the desk turns back to centre while the
// gaming LED look, ledMode 'media' / ledPreset 'full', has to stay on). Pure: no three.js, no window, so node tests it.
//   shot.statusLight === false   no status-indicator light in this chapter:
//     - the app's movement cue (studio.js LedMotion: the red wheels comet on the wings and the foot rest while the desk
//       turns, blue / red / yellow / purple while it lifts or tilts) is off for the shot (statusLightOff, film-fx.mjs);
//       it is asked for the strips' pixels before the media / game path, so it replaced the chapter's look;
//     - the shot's ledStatus states are not played (statusEvents, film-status.mjs); ledNeutral / ledColor (the regular
//       white) and obstacles stay as they are.
//   absent (or anything but false): exactly as before.
export const statusLightOn = shot => shot?.statusLight !== false;
// The ledStatus states film-status.mjs plays (copies).
export const statusEvents = shot => statusLightOn(shot) ? (shot?.ledStatus || []).map(e => ({ ...e })) : [];
// Switches the app's movement cue off; -> { was, restore() } (restore puts the stage's own setting back), or null when
// the app has no such switch.
export function statusLightOff(app) {
  if (typeof app?.setLedMotionEnabled !== 'function') return null;
  const was = app.ledMotionState?.enabled !== false;
  app.setLedMotionEnabled(false);
  return { was, restore() { app.setLedMotionEnabled(was); } };
}
// The Director's chapter field onto a film shot (film-render.mjs filmRenderShot, film-chapters.mjs liveFilmShot): false
// is carried, true takes the film's back to the default, absent leaves the film's as it is.
export function withStatusLight(next, shot) {
  if (shot?.statusLight === false) next.statusLight = false;
  else if (shot?.statusLight === true) delete next.statusLight;
  return next;
}
