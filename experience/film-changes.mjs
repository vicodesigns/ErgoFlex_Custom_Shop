// What a Director chapter changed from the film's own chapter (plan rev 3, P5): the chapter fields that differ (the ↺
// by each one) and the lane groups that do (their ● and Shift+U's "changed" step). cut: the cut's shot; film: the
// film's shot (bridge.filmShot). Pure (node test).
export const CHAPTER_FIELDS = ['title', 'detail', 'seconds', 'transition', 'room', 'layout', 'mode', 'kind', 'preset', 'size'];
export const GROUP_KEYS = { motion: ['camera', 'motion'], lighting: ['lighting', 'timeOfDay', 'ledStatus', 'ledColor', 'ledGlow', 'ledSurfaces', 'sceneGlobals'], props: ['propEdits', 'sceneEdits'], people: ['peopleEdits'], graphics: ['screens'], titles: ['titles', 'titleEdits'] };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const filmValue = (film, name) => film && Object.prototype.hasOwnProperty.call(film, name) ? film[name] : undefined;
export function fieldChanged(cut, film, name) { const v = filmValue(film, name); return v !== undefined && !same(cut?.[name], v); }
export function changedFields(cut, film) { return CHAPTER_FIELDS.filter(n => fieldChanged(cut, film, n)); }
// The camera against the film's STORY keys (cameraPlan, as a chapter page gets them: director-bridge.py link, plan-NN at
// time = at / seconds), not its baked spline (camera.keys: spline-*), which never equals the editor's keys: the ● on
// MOTION was lit on every film chapter (17 Nov 2026). Same count, times within 5 ms, views within 1 mm, fov, easing.
const near = (a, b, e) => Math.abs(Number(a) - Number(b)) <= e;
const vecNear = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => near(x, b[i], 1e-3));
export function cameraChanged(cut, film) {
  if (!cut?.camera || same(cut.camera, film?.camera)) return false;   // (the film's own baked camera, as is)
  const plan = [...(film?.cameraPlan?.keys || [])].sort((a, b) => a.at - b.at);
  if (!plan.length) return !same(cut.camera, film?.camera);
  const keys = [...(cut.camera.keys || [])].sort((a, b) => a.time - b.time), T = Number(cut.seconds ?? film.seconds) || 1;
  if (keys.length !== plan.length) return true;
  return keys.some((k, i) => { const p = plan[i];
    return !near(k.time * T, p.at, .005) || !vecNear(k.view?.position, p.position) || !vecNear(k.view?.target, p.target) || !near(k.view?.fov ?? 35, p.fov ?? 35, .01)
      || (k.easing || 'smooth') !== (i === 0 || i === plan.length - 1 ? 'smooth' : 'linear') || ('hold' in k && !same(k.hold, p.hold)) || ('cut' in k && !same(k.cut, p.cut)); });
}
export function groupChanged(cut, film, group) {
  if (!film || !cut) return false;
  return (GROUP_KEYS[group] || []).some(k => k === 'camera' ? cameraChanged(cut, film) : k === 'peopleEdits' ? cut.peopleEdits !== undefined : k === 'propEdits' ? !!cut.propEdits?.length : (k in cut) && !same(cut[k], film[k]));
}
export function changedGroups(cut, film) { return Object.keys(GROUP_KEYS).filter(g => groupChanged(cut, film, g)); }
