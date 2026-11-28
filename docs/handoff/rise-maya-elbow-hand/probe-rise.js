// render-probe.cjs --probe: Maya (rise) at this still: her model's world matrix, a few bones in her frame, and every visible
// non-person mesh triangle near her upper body (chair back / headrest), in her own frame (metres; +x her left, +y up, +z ahead).
const room = ErgoFlex.workspaceRoom, rp = room.people;
const list = rp.people.filter(o => /maya/.test(rp.keyOf(o.userData.person)) && o.visible);
const st = room.peopleState ? room.peopleState() : null;
const res = { time: st?.time ?? null, height: st?.height ?? null, shown: list.map(o => rp.keyOf(o.userData.person) + ':' + o.userData.person.id + ':' + (o.userData.personAmount ?? 1)) };
if (!list.length) return { ...res, error: 'no maya' };
const o = list.find(k => (k.userData.personAmount ?? 1) > .5) || list[0]; o.updateMatrixWorld(true);
const V = o.position.constructor, inv = o.matrixWorld.clone().invert();
res.matrixWorld = o.matrixWorld.elements.map(v => +v.toFixed(6));
const bone = n => { const b = o.userData.personRig?.bones?.get(n); if (!b) return null; b.updateWorldMatrix(true, false); return b.getWorldPosition(new V()).applyMatrix4(inv).toArray().map(v => +v.toFixed(4)); };
res.bones = {}; for (const n of ['hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r', 'middle_03_l', 'middle_03_r', 'head', 'spine_03', 'Root']) res.bones[n] = bone(n);
const sk = [];
o.traverse(m => {
  if (!m.isSkinnedMesh || !m.visible) return;
  const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bs = m.skeleton.bones, v = new V();
  for (let i = 0; i < g.attributes.position.count; i++) {
    let best = 0, bi = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > best) { best = w; bi = si.getComponent(i, k); } }
    m.getVertexPosition(i, v); (m.applyBoneTransform || m.boneTransform).call(m, i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv);
    if (v.y < .7) continue;
    sk.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4), bs[bi]?.name || '', m.material?.name || '']);
  }
});
res.skin = sk;
let top = o; while (top.parent) top = top.parent;
const LO = [-.45, .8, -.6], HI = [.45, 1.75, .35];
const parts = [], a = new V(), b = new V(), c = new V(), mk = new (o.matrixWorld.constructor)();
const isPerson = n => { for (let p = n; p; p = p.parent) if (p.userData?.person || /^Person/.test(p.name || '')) return true; return false; };
top.traverse(m => {
  if (!m.isMesh || m.isSkinnedMesh || !m.visible || isPerson(m) || m.isInstancedMesh) return;
  for (let p = m; p; p = p.parent) if (p.visible === false) return;
  const g = m.geometry; if (!g?.attributes?.position) return;
  m.updateWorldMatrix(true, false); mk.multiplyMatrices(inv, m.matrixWorld);
  if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(mk);
  if (bb.max.x < LO[0] || bb.min.x > HI[0] || bb.max.y < LO[1] || bb.min.y > HI[1] || bb.max.z < LO[2] || bb.min.z > HI[2]) return;
  const pos = g.attributes.position, idx = g.index, n = idx ? idx.count / 3 : pos.count / 3, tris = [];
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
return res;
