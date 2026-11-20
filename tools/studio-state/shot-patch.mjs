// A chapter patch (docs/music-kai-walk/patch.json): the exact fields to set on one chapter, applied the same way to the
// Director's project shot (an autosave entry: people in shot.peopleEdits, the camera as editor keys shot.camera.keys,
// time 0..1) and to the film's shot (director-film/<chapter>.json / review-cut.json: people in shot.people, the camera
// as story keys shot.cameraPlan.keys, at = seconds, baked into shot.camera.keys). Pure (node test); nothing is read or
// written here. Only what the patch names changes: everything else of the shot, of each cast entry (its `held`, its
// postures, its pose keys) and of the camera before the hand-off stays as it is.
//
// patch = {
//   v: 1, chapter: 'music',
//   set: { statusLight: false },                                   shot fields set as given
//   people: { cast: { '<key>': { ...fields } },                    merged into that cast entry (objects key by key,
//             expect: { '<key>': { id, at } } },                     arrays and values replaced); expect: refuse when the
//                                                                    entry is not that model or not at that spot
//   camera: { from: <seconds>, keys: [{ at, position, target, fov, label }], hold: true }
//     every camera key AFTER `from` is dropped; a key AT `from` is the camera as it is there now (sampled from the
//     shot's own baked camera, so the move up to the hand-off is the shot's own); then the patch's keys. With hold, a
//     last key at the chapter's end repeats the patch's last view when the chapter runs longer than it.
// }
import { bakeCameraPlan } from '../../experience/camera-spline-bake.mjs';

const finite = v => typeof v === 'number' && Number.isFinite(v);
const r4 = v => Math.round(v * 1e4) / 1e4;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
// objects merged key by key (recursively), everything else replaced; the input is not changed
export function merge(base, change) {
  const out = isObj(base) ? structuredClone(base) : {};
  for (const [k, v] of Object.entries(change || {})) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : structuredClone(v);
  return out;
}
const lerp = (a, b, f) => a + (b - a) * f;
// The view of baked dense keys ({time 0..1, view}) at chapter second t.
export function sampleBaked(keys, t, seconds) {
  const k = [...keys].sort((a, b) => a.time - b.time), u = t / seconds;
  if (!k.length) throw Error('The camera has no keys.');
  if (u <= k[0].time) return structuredClone(k[0].view);
  for (let i = 1; i < k.length; i++) if (u <= k[i].time) {
    const a = k[i - 1], b = k[i];
    if (a.easing === 'hold') return structuredClone(a.view);
    const f = b.time > a.time ? (u - a.time) / (b.time - a.time) : 0, mix = (x, y) => x.map((v, n) => lerp(v, y[n], f));
    return { position: mix(a.view.position, b.view.position), target: mix(a.view.target, b.view.target), fov: lerp(a.view.fov ?? 35, b.view.fov ?? 35, f), aspect: a.view.aspect ?? 16 / 9 };
  }
  return structuredClone(k.at(-1).view);
}
const view = v => ({ position: v.position.map(r4), target: v.target.map(r4), fov: r4(v.fov ?? 35) });
// The patch's camera keys after `from` (plus the hold to the end): [{at, position, target, fov, label}].
function tail(cam, seconds) {
  const keys = cam.keys.map(k => ({ at: k.at, ...view(k), label: k.label || '' })).sort((a, b) => a.at - b.at);
  if (keys.some(k => !(k.at > cam.from && k.at <= seconds + 1e-6))) throw Error(`The patch's camera keys must lie after ${cam.from} s and inside the ${seconds} s chapter.`);
  if (cam.hold && seconds - keys.at(-1).at > .05) keys.push({ ...keys.at(-1), at: seconds, label: 'Holding his point of view' });
  return keys;
}
// The film's story plan of a Director chapter's editor keys (film-render.mjs filmCamera): at = time x seconds, the
// film plan's hold / cut for plan-NN ids (filmPlan: the film shot's cameraPlan, when known), else the key's own.
export function planOfEditorKeys(keys, seconds, filmPlan = null) {
  const old = [...(filmPlan?.keys || [])].sort((a, b) => a.at - b.at);
  return { ...(filmPlan || {}), keys: keys.map(k => {
    const o = /^plan-\d+$/.test(k.id) ? old[Number(k.id.slice(5))] : null, e = { at: Math.round(k.time * seconds * 1000) / 1000, position: k.view.position, target: k.view.target, fov: k.view.fov ?? 35 };
    const hold = o ? o.hold : k.hold, cut = o ? o.cut : k.cut; if (hold !== undefined) e.hold = hold; if (cut) e.cut = cut; return e;
  }) };
}
function patchPeople(people, p, where) {
  if (!p) return people;
  if (!isObj(people) || !Array.isArray(people.cast)) throw Error(`The chapter has no cast in ${where}: nothing to patch (is the stand-up in this version?).`);
  const out = structuredClone(people);
  for (const [key, fields] of Object.entries(p.cast || {})) {
    const i = out.cast.findIndex(e => (e.key || e.id) === key); if (i < 0) throw Error(`${where}: no cast entry '${key}'.`);
    const want = p.expect?.[key], e = out.cast[i];
    if (want?.id && e.id !== want.id) throw Error(`${where}: '${key}' is ${e.id}, the patch is for ${want.id}.`);
    if (want?.at && !(Array.isArray(e.at) && Math.hypot(e.at[0] - want.at[0], e.at[1] - want.at[1]) <= 30)) throw Error(`${where}: '${key}' stands at ${JSON.stringify(e.at)}, the patch's walk starts at ${JSON.stringify(want.at)}.`);
    out.cast[i] = merge(e, fields);
  }
  if (p.when) out.when = merge(out.when || {}, p.when);
  return out;
}
// The film's shot (a copy) with the patch: people in shot.people, cameraPlan + its bake.
export function patchFilmShot(shot, patch) {
  const s = structuredClone(shot), T = Number(s.seconds), notes = [];
  Object.assign(s, structuredClone(patch.set || {}));
  if (patch.people) s.people = patchPeople(s.people, patch.people, 'the film shot (people)');
  const cam = patch.camera;
  if (cam) {
    if (!s.cameraPlan?.keys?.length || !s.camera?.keys?.length) throw Error('The film shot has no cameraPlan to patch.');
    const at = sampleBaked(s.camera.keys, cam.from, T), kept = s.cameraPlan.keys.filter(k => k.at <= cam.from - 1e-3);
    notes.push(`camera: ${s.cameraPlan.keys.length - kept.length} story key(s) from ${cam.from} s on replaced`);
    s.cameraPlan = { ...s.cameraPlan, keys: [...kept, { at: cam.from, ...view(at), label: 'Hand-off: the camera as it is here' }, ...tail(cam, T)] };
    s.camera = { ...s.camera, keys: bakeCameraPlan(s.cameraPlan, T) };
  }
  return { shot: s, notes };
}
// The Director's project shot (a copy) with the patch: people in shot.peopleEdits, editor keys in shot.camera.keys.
// filmPlan: the film shot's cameraPlan (for the plan-NN keys' holds and cuts, as filmCamera reads them).
export function patchDirectorShot(shot, patch, { filmPlan = null } = {}) {
  const s = structuredClone(shot), T = Number(s.seconds), notes = [];
  Object.assign(s, structuredClone(patch.set || {}));
  if (patch.people) s.peopleEdits = patchPeople(s.peopleEdits, patch.people, 'the Director chapter (peopleEdits)');
  const cam = patch.camera;
  if (cam) {
    const keys = s.camera?.keys; if (!Array.isArray(keys) || !keys.length) throw Error('The Director chapter has no camera keys to patch.');
    const plan = planOfEditorKeys([...keys].sort((a, b) => a.time - b.time), T, filmPlan), at = sampleBaked(bakeCameraPlan(plan, T), cam.from, T);
    const kept = keys.filter(k => k.time * T <= cam.from - 1e-3), aspect = keys.find(k => finite(k.view?.aspect))?.view.aspect ?? 16 / 9;
    notes.push(`camera: ${keys.length - kept.length} editor key(s) from ${cam.from} s on replaced${filmPlan ? '' : ' (no film plan given: holds / cuts from the keys themselves)'}`);
    const add = [{ at: cam.from, ...view(at), label: 'Hand-off: the camera as it is here' }, ...tail(cam, T)];
    s.camera = { ...s.camera, keys: [...kept, ...add.map((k, i) => ({ id: 'kai-walk-' + i, time: k.at / T, label: k.label, easing: i === add.length - 1 ? 'smooth' : 'linear', view: { position: k.position, target: k.target, fov: k.fov, aspect } }))] };
  }
  return { shot: s, notes };
}
// The one chapter of a Director project to patch.
export function patchProject(project, patch, opts = {}) {
  if (!project || !Array.isArray(project.shots)) throw Error('Not a Director project.');
  const i = project.shots.findIndex(s => s.id === patch.chapter); if (i < 0) throw Error(`The project has no chapter '${patch.chapter}'.`);
  const out = structuredClone(project), r = patchDirectorShot(out.shots[i], patch, opts); out.shots[i] = r.shot;
  return { project: out, notes: r.notes };
}
