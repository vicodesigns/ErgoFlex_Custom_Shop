// A shot's finish fade for render-cut.cjs (polish1126 hero end: the desk goes from black / red trim to pearl white).
//
// shot.finishFade = { at: [from, to],            chapter seconds
//                     set: { deskFinish, ledColor, ledGlow, ledSurfaces, lights, ... } }   shot fields of the second look
//
// The picture is cross-faded, not the desk's materials: every sub-frame of the window is baked twice, once as the shot
// and once as {...shot, ...set}, and the two finished pictures are mixed on the frame canvas. Motion and camera run on
// the chapter clock, so both pictures have the very same geometry: nothing is see-through, nothing fights in depth and
// nothing pops. The mix depends on the chapter time alone, so a render that starts inside the window gives the same
// frames as one that runs into it. A shot without finishFade never takes this path.
//
// finishFadeOf(shot)      -> { from, to, set } | null
// weightAt(fade, seconds) -> 0 (the shot's own look) .. 1 (the second look), smoothstep between from and to
// variantShot(shot, fade) -> the second look's shot (renderRange kept: desk-timed edits count from it)
function finishFadeOf(shot) {
  const f = shot?.finishFade; if (!f) return null;
  const [from, to] = Array.isArray(f.at) ? f.at.map(Number) : [];
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from) || !f.set || typeof f.set !== 'object')
    throw Error('finishFade needs at: [from, to] (chapter seconds, to > from) and set: {shot fields}');
  if ('renderRange' in f.set || 'motion' in f.set || 'camera' in f.set || 'cameraPlan' in f.set || 'seconds' in f.set)
    throw Error('finishFade.set may change the look only, not the timing, motion or camera');
  return { from, to, set: f.set };
}
function weightAt(fade, seconds) {
  const k = Math.max(0, Math.min(1, (seconds - fade.from) / (fade.to - fade.from)));
  return k * k * (3 - 2 * k);
}
function variantShot(shot, fade) {
  const out = { ...shot, ...fade.set }; delete out.finishFade; return out;
}

module.exports = { finishFadeOf, weightAt, variantShot };
