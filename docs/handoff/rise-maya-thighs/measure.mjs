// Rise (ch02) Maya seated stretch: hand / finger penetration into her own body and arms, headless, per frame.
// node measure.mjs [--keys keys.json|base] [--fps 120] [--t0 13] [--t1 23.3] [--out rows.json] [--every 12]
import fs from 'node:fs';
const W = 'file:///C:/Users/Vico/polish-wt/rise-maya-thighs/';
const THREE = await import(W + 'node_modules/three/build/three.module.js');
const { filmFrames, chapterShot, motionOf, worstOf } = await import(W + 'tests/lib/people-film-run.mjs');
const { bodyPoints, posed, intoSkin } = await import(W + 'tests/lib/people-surface.mjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fps = +arg('fps', 120), t0 = +arg('t0', 13), t1 = +arg('t1', 23.3), keysFile = arg('keys', 'base'), every = +arg('every', 12);
const ID = 'people-maya-sit-type';
const shot = chapterShot('rise');
const edit = f => { if (keysFile !== 'base') f.cast[0].postures[ID].poseKeys = JSON.parse(fs.readFileSync(keysFile, 'utf8')); return f; };
const times = []; for (let n = Math.round(t0 * fps); n <= Math.round(t1 * fps); n++) times.push(n / fps);
const rows = await filmFrames({ shot, key: /maya/, times, edit });
const skins = {}; const skinOf = async id => skins[id] ||= await bodyPoints(id);
const FING = /^(thumb|index|middle|ring|pinky)_0[123]_([lr])$/;
const TRUNK = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'clavicle_l', 'clavicle_r'];
const V = () => new THREE.Vector3();
const out = [];
for (const r of rows) {
  if (!r.bones) { out.push({ t: r.t, none: true }); continue; }
  const id = r.shown[0].split(':')[1], skin = await skinOf(id);
  const names = Object.keys(r.bones);
  const rig = { index: new Map(names.map((n, i) => [n, i])), wp: names.map(n => V().fromArray(r.bones[n])), wq: names.map(n => new THREE.Quaternion().fromArray(r.bones[n], 3)) };
  const P = n => rig.wp[rig.index.get(n)];
  const row = { t: r.t, id };
  for (const s of ['l', 'r']) {
    const o = s === 'l' ? 'r' : 'l';
    // joint probes: finger joints + extrapolated tips (last bone length on)
    const joints = [];
    for (const n of names) { const m = FING.exec(n); if (!m || m[2] !== s) continue; joints.push([...P(n).toArray(), n]);
      if (n.includes('_03_')) { const prev = n.replace('_03_', '_02_'); const tip = P(n).clone().add(P(n).clone().sub(P(prev)).multiplyScalar(.9)); joints.push([...tip.toArray(), n.replace('_03_', '_tip_')]); } }
    joints.push([...P('hand_' + s).toArray(), 'hand_' + s]);
    const fingerBones = names.filter(n => FING.test(n) && n.endsWith('_' + s));
    const handSkin = posed(rig, skin, ['hand_' + s, ...fingerBones]).map(p => [p[0], p[1], p[2], p[3]]);
    const targets = {
      trunk: posed(rig, skin, TRUNK),
      upper: posed(rig, skin, ['upperarm_' + o, ...names.filter(n => /^upperarm_twist/.test(n) && n.endsWith('_' + o))]),
      fore: posed(rig, skin, ['lowerarm_' + o, ...names.filter(n => /^lowerarm_twist/.test(n) && n.endsWith('_' + o))]),
    };
    for (const [tn, tg] of Object.entries(targets)) {
      const j = intoSkin(tg, joints), k = intoSkin(tg, handSkin);
      row[s + '.' + tn] = { jd: j.depth, jn: j.at?.[3] || null, sd: k.depth, sn: k.at?.[3] || null };
    }
  }
  out.push(row);
}
const fmt = x => (x * 1000).toFixed(1);
for (const s of ['l', 'r']) for (const tn of ['trunk', 'upper', 'fore']) {
  const k = s + '.' + tn; let wj = { d: 0 }, ws = { d: 0 }; let nj = 0, ns = 0;
  for (const r of out) { const v = r[k]; if (!v) continue; if (v.jd > wj.d) wj = { d: v.jd, t: r.t, n: v.jn }; if (v.sd > ws.d) ws = { d: v.sd, t: r.t, n: v.sn }; if (v.jd > .002) nj++; if (v.sd > .002) ns++; }
  console.log(`hand_${s} vs ${tn.padEnd(5)} joints worst ${fmt(wj.d)} mm ${wj.n} @${wj.t?.toFixed(3)} (frames>2mm ${nj}) | skin worst ${fmt(ws.d)} mm ${ws.n} @${ws.t?.toFixed(3)} (frames>2mm ${ns})`);
}
console.log('per', (every / fps).toFixed(2), 's: t  Ltr/Lup/Lfo  Rtr/Rup/Rfo  (joint mm; skin mm)');
for (const r of out.filter((_, i) => i % every === 0)) { if (r.none) { console.log(r.t.toFixed(2), 'none'); continue; }
  const c = k => fmt(r[k].jd) + '/' + fmt(r[k].sd);
  console.log(r.t.toFixed(2), r.id.replace('people-', ''), 'L', ['trunk', 'upper', 'fore'].map(x => c('l.' + x)).join(' '), ' R', ['trunk', 'upper', 'fore'].map(x => c('r.' + x)).join(' ')); }
const m = motionOf(rows.filter(r => r.room));
console.log('motion @' + fps, ['step', 'dstep', 'jump', 'turn'].map(f => { const w = worstOf(m, f); return f + ' ' + w.value.toFixed(2) + ' (' + w.point + ' ' + w.at?.toFixed(3) + ')'; }).join('  '));
const of = arg('out', null); if (of) fs.writeFileSync(of, JSON.stringify({ out, rows: rows.map(r => ({ t: r.t, shown: r.shown, bones: r.bones, room: r.room })) }));
