// Headless: the rise film's people (RoomPeople as filmFrames runs it) at given times; dump the task chair's triangles in Maya's
// model frame (the frame filmFrames' bones are in). node chairhl.mjs out.json 13,15.5,17,19.5,21,23.3
import fs from 'node:fs';
const W = 'file:///C:/Users/Vico/polish-wt/rise-maya-thighs/';
const THREE = await import(W + 'node_modules/three/build/three.module.js');
const lib = await import(W + 'tests/lib/people-film-run.mjs');
const [outF, tA = '13,15.5,17,19.5,21,23.3'] = process.argv.slice(2);
const times = tA.split(',').map(Number);
// patch: wrap RoomPeople.update to capture chair triangles after each update
const RP = await import(W + 'room-people.mjs');
const proto = RP.RoomPeople.prototype, upd = proto.update; const dumps = [];
proto.update = function (state) { const r = upd.call(this, state);
  try { const t = state.time; if (!times.some(x => Math.abs(x - t) < 1e-6)) return r;
    const maya = this.people.find(o => o.visible && o.userData.personRig && /maya/.test(this.keyOf(o.userData.person)) && (o.userData.personAmount ?? 1) > .02);
    if (!maya) return r; maya.updateMatrixWorld(true); const inv = maya.matrixWorld.clone().invert();
    let top = maya; while (top.parent) top = top.parent; top.updateMatrixWorld(true);
    const parts = []; const a = new THREE.Vector3();
    top.traverse(m => { if (!m.isMesh || m.isSkinnedMesh) return; let chair = false, vis = true; for (let p = m; p; p = p.parent) { if (p.visible === false) vis = false; if (p.userData?.personChair || /chair|leap/i.test(p.name || '')) chair = true; } if (!chair || !vis) return;
      const g = m.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count / 3 : pos.count / 3, mk = inv.clone().multiply(m.matrixWorld), tris = [];
      for (let k = 0; k < n * 3; k++) { a.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(mk); tris.push(+a.x.toFixed(4), +a.y.toFixed(4), +a.z.toFixed(4)); }
      const chain = []; for (let p = m; p && chain.length < 4; p = p.parent) chain.push(p.name || p.type); parts.push({ name: chain.join(' < '), mat: m.material?.name || '', n, tris }); });
    const ch = this.people.map(o => o.userData.personChair).find(c => c && c.visible) || maya.userData.personChair; ch?.updateMatrixWorld(true); dumps.push({ t, parts, chairM: ch ? inv.clone().multiply(ch.matrixWorld).elements : null, chairVisible: ch?.visible });
  } catch (e) { console.error('dump', e.message); }
  return r; };
const shot = lib.chapterShot('rise');
await lib.filmFrames({ shot, key: /maya/, times });
fs.writeFileSync(outF, JSON.stringify(dumps));
for (const d of dumps) console.log(d.t, d.parts.length, d.parts.map(p => p.name.split(' < ').slice(0, 2).join('<') + '[' + p.n + ']').join(', ').slice(0, 300));
