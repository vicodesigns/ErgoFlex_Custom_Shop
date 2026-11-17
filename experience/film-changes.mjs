// What a Director chapter changed from the film's own chapter (plan rev 3, P5): the chapter fields that differ (the ↺
// by each one) and the lane groups that do (their ● and Shift+U's "changed" step). cut: the cut's shot; film: the
// film's shot (bridge.filmShot). Pure (node test).
export const CHAPTER_FIELDS = ['title', 'detail', 'seconds', 'transition', 'room', 'layout', 'mode', 'kind', 'preset', 'size'];
export const GROUP_KEYS = { motion: ['camera', 'motion'], lighting: ['lighting', 'timeOfDay', 'ledStatus', 'ledColor', 'ledGlow', 'ledSurfaces', 'sceneGlobals'], props: ['propEdits', 'sceneEdits'], people: ['peopleEdits'], graphics: ['screens'], titles: ['titles', 'titleEdits'] };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const filmValue = (film, name) => film && Object.prototype.hasOwnProperty.call(film, name) ? film[name] : undefined;
export function fieldChanged(cut, film, name) { const v = filmValue(film, name); return v !== undefined && !same(cut?.[name], v); }
export function changedFields(cut, film) { return CHAPTER_FIELDS.filter(n => fieldChanged(cut, film, n)); }
export function groupChanged(cut, film, group) {
  if (!film || !cut) return false;
  return (GROUP_KEYS[group] || []).some(k => k === 'camera' ? !!cut.camera && !same(cut.camera, film.camera) : k === 'peopleEdits' ? cut.peopleEdits !== undefined : k === 'propEdits' ? !!cut.propEdits?.length : (k in cut) && !same(cut[k], film[k]));
}
export function changedGroups(cut, film) { return Object.keys(GROUP_KEYS).filter(g => groupChanged(cut, film, g)); }
