// render-probe.cjs --probe: Kai (oilers) at this still: his model's world matrix, the desk height, his skinned arm vertices in his own frame,
// and (once per stage) every non-person mesh triangle near his arms, in his own frame (metres; +x his left, +y up, +z ahead).
const room = ErgoFlex.workspaceRoom, rp = room.people;
const kai = rp.people.filter(o => /^kai/.test(rp.keyOf(o.userData.person)) && o.visible);
const st = room.peopleState ? room.peopleState() : null;
const res = { time: st?.time ?? null, height: st?.height ?? null, tilt: st?.tilt ?? null, shown: kai.map(o => rp.keyOf(o.userData.person) + ':' + o.userData.person.id + ':' + (o.userData.personAmount ?? 1)) };
if (!kai.length) return { ...res, error: 'no kai' };
const o = kai.find(k => (k.userData.personAmount ?? 1) > .5) || kai[0]; o.updateMatrixWorld(true);
const V = o.position.constructor, inv = o.matrixWorld.clone().invert();
res.matrixWorld = o.matrixWorld.elements.map(v => +v.toFixed(6));
res.worldPos = o.getWorldPosition(new V()).toArray(); res.fwd = new V(0, 0, 1).transformDirection(o.matrixWorld).toArray(); res.left = new V(1, 0, 0).transformDirection(o.matrixWorld).toArray();
const bone = n => { const b = o.userData.personRig?.bones?.get(n); if (!b) return null; b.updateWorldMatrix(true, false); const w = b.getWorldPosition(new V()); return { w: w.toArray().map(v => +v.toFixed(4)), m: w.clone().applyMatrix4(inv).toArray().map(v => +v.toFixed(4)) }; };
res.bones = {}; for (const n of ['hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r', 'upperarm_l', 'middle_03_l', 'middle_03_r', 'head', 'pelvis']) res.bones[n] = bone(n);
// arm vertices (skinned, as drawn), model frame
const ARMRE = /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)(?:_twist)?(?:_0\d)?_([lr])$/; const pts = [];
o.traverse(m => {
  if (!m.isSkinnedMesh || !m.visible) return;
  const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = m.skeleton.bones, v = new V();
  for (let i = 0; i < g.attributes.position.count; i += 2) {
    let best = 0, bi = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > best) { best = w; bi = si.getComponent(i, k); } }
    const name = bones[bi]?.name || ''; const mm = ARMRE.exec(name); if (!mm) continue;
    m.getVertexPosition(i, v); (m.applyBoneTransform || m.boneTransform).call(m, i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv);
    pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4), name]);
  }
});
res.arm = pts;
if (!window.__kaiDeskDumped) {
  window.__kaiDeskDumped = true;
  let top = o; while (top.parent) top = top.parent;
  const LO = [-.65, .35, -.2], HI = [.65, 1.15, .9];
  const parts = [], a = new V(), b = new V(), c = new V(), M4 = o.matrixWorld.constructor, mk = new M4();
  const isPerson = n => { for (let p = n; p; p = p.parent) if (p.userData?.person || /^Person/.test(p.name || '')) return true; return false; };
  top.traverse(m => {
    if (!m.isMesh || m.isSkinnedMesh || !m.visible || isPerson(m)) return;
    let vis = true; for (let p = m; p; p = p.parent) if (p.visible === false) { vis = false; break; } if (!vis) return;
    const g = m.geometry; if (!g?.attributes?.position) return;
    m.updateWorldMatrix(true, false); mk.multiplyMatrices(inv, m.matrixWorld);
    if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(mk);
    if (bb.max.x < LO[0] || bb.min.x > HI[0] || bb.max.y < LO[1] || bb.min.y > HI[1] || bb.max.z < LO[2] || bb.min.z > HI[2]) return;
    const pos = g.attributes.position, idx = g.index, n = idx ? idx.count / 3 : pos.count / 3, tris = [];
    const inst = m.isInstancedMesh ? m.count : 0; if (inst) return;   // (instanced meshes skipped; listed)
    for (let t = 0; t < n; t++) {
      const i0 = idx ? idx.getX(3 * t) : 3 * t, i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1, i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mk); b.fromBufferAttribute(pos, i1).applyMatrix4(mk); c.fromBufferAttribute(pos, i2).applyMatrix4(mk);
      if (Math.max(a.x, b.x, c.x) < LO[0] || Math.min(a.x, b.x, c.x) > HI[0] || Math.max(a.y, b.y, c.y) < LO[1] || Math.min(a.y, b.y, c.y) > HI[1] || Math.max(a.z, b.z, c.z) < LO[2] || Math.min(a.z, b.z, c.z) > HI[2]) continue;
      tris.push(+a.x.toFixed(4), +a.y.toFixed(4), +a.z.toFixed(4), +b.x.toFixed(4), +b.y.toFixed(4), +b.z.toFixed(4), +c.x.toFixed(4), +c.y.toFixed(4), +c.z.toFixed(4));
    }
    if (!tris.length) return;
    const chain = []; for (let p = m; p && chain.length < 5; p = p.parent) chain.push(p.name || p.type);
    parts.push({ name: chain.join(' < '), mat: m.material?.name || '', n: tris.length / 9, bb: [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map(v => +v.toFixed(4)), tris });
  });
  res.parts = parts; res.partsSummary = parts.map(p => p.name + ' [' + p.n + '] ' + p.bb.join(','));
}
return res;
