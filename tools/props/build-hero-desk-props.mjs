#!/usr/bin/env node
// Chapter 12 hero desk props (polish1124 Stream D; Vico approved the candidates Nov 24 2026): the decoration of the artist,
// architect and office desks of the finale, plus the ErgoFlex mic boom arm on the office desk's accessory port.
// Rebuild: node tools/props/build-hero-desk-props.mjs [--only id,id] [--blender <blender.exe>]
//   1. tools/props/hero-desks/textures.py   textures (photo, oil study, scale print, labels, normal maps) into a temp dir
//   2. tools/props/hero-desks/build_props.py Blender 3.6 builds every prop (real mm, floor origin, front +Z, one mesh per prop)
//   3. gltf-transform optimize (meshopt, webp 512 px) into assets/props/<id>.glb
//   4. assets/props/index.json + tools/props/manifest.json entries (collection 'Hero Desk Decor', heroDesk: <desk>)
// Placement in the film: Director add edits in chapter 12 (desk + the desk's show window); see
// tools/experience/drafts/polish1124-hero-desks/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {NodeIO, getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const root = path.resolve(import.meta.dirname, '../..');
const arg = k => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1]; };
const only = arg('--only');
const blender = arg('--blender') || process.env.BLENDER || 'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe';
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-desk-props-')), tex = path.join(work, 'tex'), raw = path.join(work, 'raw');
const run = (cmd, args) => { const r = spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 26}); if (r.status !== 0) throw Error(`${path.basename(cmd)} failed:\n${r.stdout?.slice(-2000)}\n${r.stderr?.slice(-2000)}`); return r.stdout; };
run(python, [path.join(root, 'tools/props/hero-desks/textures.py'), tex]);
const out = run(blender, ['-b', '--factory-startup', '--python', path.join(root, 'tools/props/hero-desks/build_props.py'), '--', tex, raw, ...(only ? only.split(',') : [])]);
if (!/DONE \d+/.test(out)) throw Error('Blender build did not finish:\n' + out.slice(-3000));
const report = JSON.parse(fs.readFileSync(path.join(raw, 'build-report.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const indexFile = path.join(root, 'assets/props/index.json'), manifestFile = path.join(root, 'tools/props/manifest.json');
const index = JSON.parse(fs.readFileSync(indexFile, 'utf8')), manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const entries = new Map(index.props.map(p => [p.id, p])), jobs = new Map(manifest.props.map(p => [p.id, p]));
const SCENES = {office: ['product', 'office', 'home'], architect: ['product', 'office', 'creative', 'study'], artist: ['product', 'creative', 'gallery']};
const bin = path.join(root, 'node_modules/.bin/gltf-transform' + (process.platform === 'win32' ? '.cmd' : ''));
for (const [id, r] of Object.entries(report)) {
  const file = `assets/props/${id}.glb`, dest = path.join(root, file);
  const opt = spawnSync(bin, ['optimize', r.raw, dest, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '512', '--simplify', 'false', '--instance', 'false', '--join', 'false', '--palette', 'false', '--flatten', id === 'ergoflex-mic-boom-arm' ? 'false' : 'true'], {encoding: 'utf8', shell: process.platform === 'win32'});
  if (opt.status !== 0) throw Error(id + ': ' + opt.stderr + opt.stdout);
  const doc = await io.read(dest), b = getBounds(doc.getRoot().listScenes()[0]);
  let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const mm = v => +(v * 1000).toFixed(2), mic = id === 'ergoflex-mic-boom-arm';
  const spec = {id, name: r.name, category: 'desk', collection: mic ? 'ErgoFlex Hardware' : 'Hero Desk Decor', scenes: SCENES[r.desk] || ['product'],
    anchor: mic ? 'socket' : 'floor', source: 'tools/props/hero-desks/build_props.py', converter: 'hero-desk-props', license: 'project-original',
    attribution: 'Built for the ErgoFlex film, chapter 12 hero desks (polish1124 Stream D)', revision: 'hero-desks-20261124'};
  jobs.set(id, spec);
  entries.set(id, {...spec, file, size: b.max.map((v, i) => mm(v - b.min[i])), min: b.min.map(mm), max: b.max.map(mm), tris: Math.round(tris), bytes: fs.statSync(dest).size,
    heroDesk: {desk: r.desk, ...(mic ? {mount: 'accessory port, right (desk-headphone-hook.mjs socket)', joints: ['J0', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6'], plug: 'copy of ergoflex-headphone-hook plug: shaft dia 28.30 mm, flange dia 37.85 mm'} : {})}});
  console.log(id.padEnd(34), entries.get(id).size.map(v => Math.round(v)).join(' x ') + ' mm', Math.round(tris) + ' tris', Math.round(fs.statSync(dest).size / 1024) + ' KB');
}
index.props = [...entries.values()]; manifest.props = [...jobs.values()];
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1) + '\n'); fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
fs.rmSync(work, {recursive: true, force: true});
