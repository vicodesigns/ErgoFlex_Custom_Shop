#!/usr/bin/env node
// polish1124 Stream D: the chapter 12 hero desks decorated (Vico approved the props and placements, Nov 24 2026).
//   node tools/experience/drafts/polish1124-hero-desks/make-draft.mjs <live hero export.json> [out.json]
// Reads Vico's own Director export of the hero and writes the DRAFT: the same file byte for byte except one added field,
//   shots[0].propEdits  = his Director prop edits (the export's own propEdits if it has them, else the director:true entries of
//                          the live film chapter given with --film, director flag off: the import marks them again) followed
//                          by 22 add edits (assets/props herodesk-* and ergoflex-mic-boom-arm), each with its desk and that
//                          desk's show window (artist 0-5.13 fadeOut .3; architect .3-5.15 fadeIn .25 fadeOut .3; office .3-6.33
//                          fadeIn .25 fadeOut .3), placed on HIS side shelves, cubbies and cup holder (their transforms in that
//                          list) or on the office desk's right accessory port. build-round8-director.py --import puts propEdits
//                          into the chapter and every hero sub-shot (apply_props), after the hand-made edits.
// The three desk screens are NOT in the export: the import keeps hero screens out of the sub-shots (each desk keeps its own),
// so they go in with add-desk-screens.py (sub-shots only, idempotent).
// Usage: node make-draft.mjs <live hero export.json> [--film <director-film/hero.json>] [out.json]
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
const HERE = import.meta.dirname;
const MM = 0.0015988292410682552;   // scene units per mm on the product stage (workspaceAccessories.scale, measured)
const SHOW = {artist: {from: 0, to: 5.13, fadeOut: 0.3}, architect: {from: 0.3, to: 5.15, fadeIn: 0.25, fadeOut: 0.3}, office: {from: 0.3, to: 6.33, fadeIn: 0.25, fadeOut: 0.3}};
// host GLB-frame spots (mm): cubby plate top y80, round cup centre (-27.1, z -121.3) floor y3.8, rect cubby (114.2, z -121.3);
// cup holder plate top y68.8, cup (-1.3, z -129.7) floor y3.2; large side shelf top y18; small side shelf top y17.8.
const CUP = [-27.1, 3.8, -121.3], RECT = [114.2, 3.8, -121.3], HCUP = [-1.3, 3.2, -129.7];
// [prop, desk, host: Vico's edit id | 'port-right', host-local mm, yaw: local yaw deg (desk hosts, rides the host) | {parentYaw}]
const PLAN = [
  ['herodesk-office-pen-cup', 'office', '4lq1al8mj', CUP, 0], ['herodesk-office-phone', 'office', '4lq1al8mj', RECT, 90],
  ['herodesk-office-photo-frame', 'office', '4lq1al8mj', [-80, 80, 110], {parentYaw: 20}], ['herodesk-office-sticky-notes', 'office', '4lq1al8mj', [70, 80, 60], 10],
  ['herodesk-office-plant', 'office', 'zq7lk6r1w', CUP, 0],
  ['herodesk-office-files', 'office', '1zr1k8lwb', [0, 18, 15], {parentYaw: 90}], ['herodesk-office-briefcase', 'office', 'mq9mg01h7', [0, 18, 15], {parentYaw: 90}],
  ['ergoflex-mic-boom-arm', 'office', 'port-right', [0, 0, 0], 0],
  ['herodesk-arch-cup-fill', 'architect', 'kwdk8pqfc', CUP, 0], ['herodesk-arch-trace-roll', 'architect', 'kwdk8pqfc', [0, 80, 100], 0],
  ['herodesk-arch-rolls', 'architect', 'evb37kaue', HCUP, 0], ['herodesk-arch-coffee', 'architect', 'evb37kaue', [0, 68.8, 90], 0],
  ['herodesk-arch-model-house', 'architect', 'wd4hxbong', [0, 17.8, -15], {parentYaw: -15}], ['herodesk-arch-scale-ruler', 'architect', 'fi8308l2v', [0, 17.8, -15], {parentYaw: -50}],
  ['herodesk-arch-tube', 'architect', '6fdq03ibv', [100, 18, 50], {parentYaw: 90}],
  ['herodesk-art-brushes', 'artist', 'ubuyk82ct', CUP, 0], ['herodesk-art-tools', 'artist', 'ubuyk82ct', RECT, 0],
  ['herodesk-art-paint-jars', 'artist', 'ty7t6ksvx', [-35, 17.8, -40], {parentYaw: 0}], ['herodesk-art-swatches', 'artist', 'ty7t6ksvx', [20, 17.8, 10], {parentYaw: 25}],
  ['herodesk-art-canvas', 'artist', 'wjdm9pvoq', [0, 17.8, -20], {parentYaw: -10}],
  ['herodesk-art-case', 'artist', 'mys3r28ti', [0, 18, 15], {parentYaw: 180}], ['herodesk-art-sketchbooks', 'artist', 'od9s27p2e', [0, 18, 15], {parentYaw: -10}],
];
// the office desk's right accessory port in the shelf frame (desk-headphone-hook.mjs measureHeadphoneSockets, measured live)
const PORT_RIGHT = [516.8612862876306, -33.769559647414276, 239.00513166923878];
const SCREENS = [
  {target: 'added-prop-ergoflex-portrait-monitor-bvm1mxp20/monitor-screen', src: 'exports/cinematic-intro-cut-cine/screens/cine-hero-desk-artist-portrait.mp4', offset: 0, loop: false, afterEdits: true, desk: 'artist'},
  {target: 'added-prop-ergoflex-wide-monitor-j7rkts842/monitor-screen', src: 'exports/cinematic-intro-cut-cine/screens/cine-hero-desk-artist-wide.mp4', offset: 0, loop: false, afterEdits: true, desk: 'artist'},
  {target: 'added-prop-ergoflex-wide-monitor-gvmdrt6n4/monitor-screen', src: 'exports/cinematic-intro-cut-cine/screens/cine-hero-desk-architect-wide.mp4', offset: -4.8, loop: false, afterEdits: true, desk: 'architect'},
];
const r4 = v => +v.toFixed(4), r2 = v => +v.toFixed(2), d2r = THREE.MathUtils.degToRad, r2d = THREE.MathUtils.radToDeg;
export function draftEdits(shot, names) {
  const byId = new Map(shot.sceneEdits.filter(e => e.id).map(e => [e.id, e]));
  return PLAN.map(([asset, desk, host, local, yaw]) => {
    let parent, position, rotation;
    if (host === 'port-right') { parent = 'shelf'; position = PORT_RIGHT.map(v => r4(v * MM)); rotation = [0, 0, 0]; }
    else {
      const h = byId.get(host); if (!h) throw Error(`host edit ${host} (${desk}) is not in this export: Vico moved or removed it`);
      if (h.desk !== desk) throw Error(`host ${host} is on ${h.desk}, expected ${desk}`);
      parent = h.parent;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(h.rotation || [0, 0, 0]).map(d2r), 'XYZ'));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...(h.position || [0, 0, 0]).map(v => v / MM)), q, new THREE.Vector3(...(h.scale || [1, 1, 1])));
      position = new THREE.Vector3(...local).applyMatrix4(m).toArray().map(v => r4(v * MM));
      if (typeof yaw === 'object') rotation = [0, yaw.parentYaw, 0];
      else { const e = new THREE.Euler().setFromQuaternion(q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d2r(yaw)))); rotation = [e.x, e.y, e.z].map(v => r2(r2d(v))); }
    }
    const id = 'hd' + asset.replace(/^(herodesk|ergoflex)-/, '').replace(/[^a-z]/g, '').slice(0, 8);
    return {add: {asset}, id, match: `^Added prop:${asset}#${id}$`, label: names.get(asset), parent, position, rotation: rotation.map(r2), scale: [1, 1, 1], desk, show: SHOW[desk], director: true};
  });
}
function main() {
  const args = process.argv.slice(2), fi = args.indexOf('--film'), film = fi < 0 ? null : args.splice(fi, 2)[1], ki = args.indexOf('--keep-titles'), keepTitles = ki >= 0 && !!args.splice(ki, 1), [src, outArg] = args;
  if (!src) { console.error('usage: make-draft.mjs <live hero export.json> [--film <director-film/hero.json>] [out.json]'); process.exit(2); }
  const raw = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n'), cut = JSON.parse(raw), shot = cut.shots[0];
  if (shot.id !== 'hero' || Math.abs(shot.seconds - 25.95) > 1e-9) throw Error('not the 25.95 s hero export');
  if (JSON.stringify(cut, null, 2) !== raw.replace(/\n$/, '')) throw Error('the export is not in the Director layout: the byte-for-byte check would not hold');
  let his = shot.propEdits;
  if (!Array.isArray(his)) {
    if (!film) throw Error('the export has no propEdits: give the live chapter with --film <director-film/hero.json>');
    his = JSON.parse(fs.readFileSync(film, 'utf8')).sceneEdits.filter(e => e.director).map(({director, ...e}) => e);
  }
  const root = path.resolve(HERE, '../../../..'), index = JSON.parse(fs.readFileSync(path.join(root, 'assets/props/index.json'), 'utf8'));
  const names = new Map(index.props.map(p => [p.id, String(p.name).replace(/^Hero desk · /, '')]));
  if (his.some(e => /^Added prop:(herodesk-|ergoflex-mic-boom-arm)/.test(e.match || ''))) throw Error('this list already has the hero desk props');
  const adds = draftEdits({sceneEdits: his}, names).map(({director, ...e}) => e), out = JSON.parse(raw);
  out.shots[0].propEdits = [...his, ...adds];
  // --keep-titles: no filmTitles in the draft, so the import keeps the titles imported before (titles-src.json untouched)
  if (keepTitles) delete out.shots[0].filmTitles;
  const text = JSON.stringify(out, null, 2) + (raw.endsWith('\n') ? '\n' : '');
  const back = JSON.parse(text); if (keepTitles && shot.filmTitles) back.shots[0].filmTitles = shot.filmTitles; if (Array.isArray(shot.propEdits)) back.shots[0].propEdits = shot.propEdits; else delete back.shots[0].propEdits;
  if (JSON.stringify(back) !== JSON.stringify(cut)) throw Error('draft differs from the export outside propEdits');
  const dest = outArg || path.join(HERE, 'ErgoFlex-film-ch12-hero-director-DRAFT-hero-desks.json');
  fs.writeFileSync(dest, text);
  console.log(`propEdits: his ${his.length} + ${adds.length} hero desk props -> ${dest}`);
}
export const DESK_SCREENS = SCREENS;
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
