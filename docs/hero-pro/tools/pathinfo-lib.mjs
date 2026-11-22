// The render's own sampling of a baked camera (experience: linear between baked keys, 'hold' stays, else smoothstep).
export function sampleBaked(keys, T, t) {
  const f = t / T;
  if (f <= keys[0].time) return keys[0].view;
  const i = keys.findIndex(k => k.time > f); if (i < 0) return keys.at(-1).view;
  const a = keys[i - 1], b = keys[i], p = (f - a.time) / (b.time - a.time), u = a.easing === 'hold' ? 0 : a.easing === 'linear' ? p : p * p * (3 - 2 * p);
  const L = (x, y) => x.map((v, j) => v + (y[j] - v) * u);
  return { position: L(a.view.position, b.view.position), target: L(a.view.target, b.view.target), fov: a.view.fov + (b.view.fov - a.view.fov) * u };
}
