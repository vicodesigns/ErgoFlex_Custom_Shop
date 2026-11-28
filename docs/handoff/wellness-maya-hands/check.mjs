// Kai's hand-over (oilers 12-14.6 s), headless: hands/fingers/forearms vs his own body (skin normals) and vs desk triangles (if given).
// node check.mjs [--keys keys.json] [--desk desk.json] [--fps 120] [--t0 12] [--t1 14.6] [--csv out.csv]
const W = 'file:///C:/Users/Vico/polish-wt/wellness-maya-hands/';
const THREE = await import(W + 'node_modules/three/build/three.module.js');
const { filmFrames, chapterShot } = await import(W + 'tests/lib/people-film-run.mjs');
const { motionOf, worstOf } = await import(W + 'tests/lib/people-film-run.mjs');
const { bodyPoints, posed, intoSkin, facingOut } = await import(W + 'tests/lib/people-surface.mjs');
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fps = +arg('fps', 120), t0 = +arg('t0', 8.8), t1 = +arg('t1', 10.5);
const keysFile = arg('keys', null), deskFile = arg('desk', null);
const shot = chapterShot('wellness');
const edit = filter => {
  if (keysFile) { const P = filter.cast[0].postures['people-maya-stand-type-41']; if (keysFile === 'none') delete P.poseKeys; else P.poseKeys = JSON.parse(fs.readFileSync(keysFile, 'utf8')); }
  return filter;
};
const times = []; for (let f = Math.round(t0 * fps); f <= Math.round(t1 * fps); f++) times.push(f / fps);
const rows = await filmFrames({ shot, key: /^maya/, times, edit });
const skins = {}; const skinOf = async id => skins[id] ||= await bodyPoints(id);
const FING = /^(thumb|index|middle|ring|pinky)_0\d_/;
let desk = null;
if (deskFile) { const D = JSON.parse(fs.readFileSync(deskFile, 'utf8')); desk = D.parts.filter(p => !process.env.PARTS || new RegExp(process.env.PARTS, 'i').test(p.name + ' ' + p.mat)); }  // parts: [{name, tris:[x9...]}] model frame metres
// point vs triangle soup, binned on the floor plane (2 cm cells): inside = odd number of faces straight above; depth = vertical
// distance to the nearest face (up or down) when inside; clearance = vertical gap down to the nearest face below when outside
function binPart(part) {
  const T = part.tris, n = T.length / 9, cell = .02, g = new Map();
  for (let i = 0; i < n; i++) { const o = i * 9; const x0 = Math.min(T[o], T[o + 3], T[o + 6]), x1 = Math.max(T[o], T[o + 3], T[o + 6]), z0 = Math.min(T[o + 2], T[o + 5], T[o + 8]), z1 = Math.max(T[o + 2], T[o + 5], T[o + 8]);
    for (let a = Math.floor(x0 / cell); a <= Math.floor(x1 / cell); a++) for (let b = Math.floor(z0 / cell); b <= Math.floor(z1 / cell); b++) { const k = a + ',' + b; (g.get(k) || g.set(k, []).get(k)).push(o); } }
  part.grid = g; part.cell = cell;
}
function partStats(part, pts) {
  if (!part.grid) binPart(part);
  let inside = 0, deepest = 0, nearest = Infinity; const T = part.tris, bb = part.bb;
  for (const p of pts) {
    if (p[0] < bb[0] || p[0] > bb[3] || p[2] < bb[2] || p[2] > bb[5] || p[1] < bb[1] - .1 || p[1] > bb[4] + .1) continue;
    const list = part.grid.get(Math.floor(p[0] / part.cell) + ',' + Math.floor(p[2] / part.cell)); if (!list) continue;
    let cross = 0, up = Infinity, dn = Infinity;
    for (const o of list) {
      const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-14) continue;
      const l1 = ((bz - cz) * (p[0] - cx) + (cx - bx) * (p[2] - cz)) / d, l2 = ((cz - az) * (p[0] - cx) + (ax - cx) * (p[2] - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const h = l1 * ay + l2 * by + l3 * cy; if (h > p[1]) { cross++; up = Math.min(up, h - p[1]); } else dn = Math.min(dn, p[1] - h);
    }
    if (cross % 2 === 1) { inside++; deepest = Math.max(deepest, Math.min(up, dn)); } else if (dn < nearest) nearest = dn;
  }
  return { inside, deepest, nearest };
}
// depth below the keyboard's top surface: for each hand/finger skin point over the keyboard's footprint, the highest face
// straight above or below it (2 cm bins) minus the point's height; >0 = the point is below the key tops there
function topDepth(part, pts) {
  if (!part.grid) binPart(part); const T = part.tris, bb = part.bb; let worst = -Infinity, n3 = 0;
  for (const p of pts) { if (p[0] < bb[0] || p[0] > bb[3] || p[2] < bb[2] || p[2] > bb[5]) continue;
    const list = part.grid.get(Math.floor(p[0] / part.cell) + ',' + Math.floor(p[2] / part.cell)); if (!list) continue; let top = -Infinity;
    for (const o of list) { const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-14) continue;
      const l1 = ((bz - cz) * (p[0] - cx) + (cx - bx) * (p[2] - cz)) / d, l2 = ((cz - az) * (p[0] - cx) + (ax - cx) * (p[2] - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue; top = Math.max(top, l1 * ay + l2 * by + l3 * cy); }
    if (top > -Infinity) { const dd = top - p[1]; worst = Math.max(worst, dd); if (dd > .003) n3++; } }
  return { worst, n3 };
}
const kbTop = []; const out = [];
let worstBody = { d: 0 }, worstDesk = {};
for (const r of rows) {
  if (!r.bones) { out.push({ t: r.t, none: true }); continue; }
  const id = r.shown[0].split(':')[1], skin = await skinOf(id);
  const names = Object.keys(r.bones), rig = { index: new Map(names.map((n, i) => [n, i])), wp: names.map(n => new THREE.Vector3().fromArray(r.bones[n])), wq: names.map(n => new THREE.Quaternion().fromArray(r.bones[n], 3)) };
  const body = facingOut(rig, posed(rig, skin, ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r']));
  const row = { t: r.t, id };
  let bd = 0;
  const armPts = {};
  for (const s of ['l', 'r']) {
    const hand = posed(rig, skin, ['hand_' + s, ...names.filter(n => FING.test(n) && n.endsWith('_' + s))]).map(p => p.slice(0, 3));
    const fore = posed(rig, skin, ['lowerarm_' + s, ...names.filter(n => /^lowerarm_twist/.test(n) && n.endsWith('_' + s))]).map(p => p.slice(0, 3));
    const upper = posed(rig, skin, ['upperarm_' + s]).map(p => p.slice(0, 3));
    armPts[s] = { hand, fore, upper };
    bd = Math.max(bd, intoSkin(body, hand.filter((_, i) => i % 2 === 0)).depth, intoSkin(body, fore.filter((_, i) => i % 2 === 0)).depth);
  }
  if (desk) { const kb = desk.find(p => /apple-keyboard/.test(p.name)); if (kb) for (const s of ['l', 'r']) { const r = topDepth(kb, armPts[s].hand); kbTop.push([r.t === undefined ? (r.t = row.t, r) : r, s]); row['kb.' + s] = r; } }
  row.body = bd; if (bd > worstBody.d) worstBody = { d: bd, t: r.t };
  if (desk) for (const part of desk) {
    for (const s of ['l', 'r']) for (const seg of ['hand', 'fore', 'upper']) {
      const st = partStats(part, armPts[s][seg].filter((_, i) => i % 2 === 0)), k = part.name + ':' + s + '.' + seg;
      row[k] = st; const w = worstDesk[k] ||= { inside: 0, deepest: 0, at: null, nearest: Infinity, nearAt: null };
      if (st.inside > w.inside || (st.inside && st.deepest > w.deepest)) { w.inside = Math.max(w.inside, st.inside); w.deepest = Math.max(w.deepest, st.deepest); w.at = r.t; }
      if (st.nearest < w.nearest) { w.nearest = st.nearest; w.nearAt = r.t; }
    }
  }
  out.push(row);
}
if (kbTop.length) { for (const s of ['l', 'r']) { const L = out.filter(r => r['kb.' + s]); const w = L.reduce((a, r) => r['kb.' + s].worst > a.v ? { v: r['kb.' + s].worst, t: r.t } : a, { v: -Infinity });
  const n = L.reduce((a, r) => Math.max(a, r['kb.' + s].n3), 0), nAt = L.find(r => r['kb.' + s].n3 === n)?.t;
  console.log('keyboard top, ' + s + ' hand+fingers: deepest below key tops', (w.v * 1000).toFixed(1), 'mm at', w.t?.toFixed(3), '| most points >3 mm below', n, 'at', nAt?.toFixed(3)); }
  const per = out.filter((_, i) => i % 6 === 0).map(r => r.t.toFixed(2) + ' ' + ((r['kb.l']?.worst ?? NaN) * 1000).toFixed(1) + '/' + ((r['kb.r']?.worst ?? NaN) * 1000).toFixed(1)); console.log('per 0.05 s (L/R mm below key tops):', per.join(' | ')); }
const csv = arg('csv', null);
if (csv) fs.writeFileSync(csv, JSON.stringify(out));
const bad = out.filter(r => r.body > .004);
console.log('frames', out.length, 'fps', fps, 'body-depth worst', (worstBody.d * 1000).toFixed(1), 'mm at', worstBody.t?.toFixed(3), 'frames >4mm:', bad.length, bad.length ? `${bad[0].t.toFixed(3)}-${bad.at(-1).t.toFixed(3)}` : '');
for (const [k, w] of Object.entries(worstDesk)) console.log(k.padEnd(28), 'inside pts max', String(w.inside).padStart(4), 'deepest', (w.deepest * 1000).toFixed(1), 'mm at', w.at?.toFixed(3), '| nearest outside', (w.nearest * 1000).toFixed(1), 'mm at', w.nearAt?.toFixed(3));
if (desk) { // per-frame summary of any inside
  const hits = out.filter(r => Object.entries(r).some(([k, v]) => v && v.inside > 0));
  console.log('frames with any desk intersection:', hits.length, hits.length ? `${hits[0].t.toFixed(3)}-${hits.at(-1).t.toFixed(3)}` : '');
}

{ const rr = rows.filter(r => r.bones); const m = motionOf(rr.map(r => ({ ...r, room: Object.fromEntries(Object.entries(r.bones).map(([k, v]) => [k, v.slice(0, 3).map(x => x * 1000)])) })));
  console.log('motion @' + fps + 'fps', ['step', 'dstep', 'jump', 'turn'].map(f => { const w = worstOf(m, f); return f + ' ' + w.value.toFixed(2) + ' (' + w.point + ' ' + w.at?.toFixed(3) + ')'; }).join('  ')); }
