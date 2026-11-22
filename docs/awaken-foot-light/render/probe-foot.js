function () {
  const E = window.ErgoFlex, P = window.ErgoPresentation;
  let g = null; E.loadedModel.traverse(o => { if (o.name === 'Foot LED floor glow') g = o; });
  g.updateWorldMatrix(true, false);
  const m = g.matrixWorld.elements, c = [m[12], m[13], m[14]];
  const v = P.captureCamera(), p = v.position, t = v.target;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = norm(sub(t, p)), r = norm(cr(f, [0, 1, 0])), u = cr(r, f), th = 1 / Math.tan(v.fov * Math.PI / 360);
  const proj = q => { const d = sub(q, p), z = dot(d, f); return [0.5 + 0.5 * th / v.aspect * dot(d, r) / z, 0.5 - 0.5 * th * dot(d, u) / z, z]; };
  const pts = [[0, 0, 0], [.3, 0, 0], [-.3, 0, 0], [0, 0, .3], [0, 0, -.3]].map(o => proj([c[0] + o[0], c[1] + o[1], c[2] + o[2]]));
  return { centre: c, cam: v, screen: pts, uniforms: Object.fromEntries(['strength', 'fadeReach', 'stripHalfSpan', 'falloffPower'].map(k => [k, g.material.uniforms[k]?.value])) };
}
