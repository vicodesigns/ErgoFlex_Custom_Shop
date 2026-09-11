#!/usr/bin/env node
// Convert the source models in models/ into web-ready GLB props in assets/props/.
//
//   node tools/convert-props.mjs [--only id,id] [--no-optimize] [--keep-raw]
//
// Reads tools/props/manifest.json, runs Blender once over every job
// (tools/props/blender-convert.py), then gltf-transform to compress meshes
// (meshopt), resize and WebP-encode textures, and writes assets/props/index.json
// with the measured size and triangle count of each prop. Rhino .3dm sources go
// through tools/props/rhino-to-obj.py first (needs a Python with rhino3dm).
//
// Environment: BLENDER (path to the blender binary, default `blender` on PATH),
// PYTHON (interpreter with rhino3dm, default `python3`).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : null; };
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const BLENDER = process.env.BLENDER || 'blender';
const PYTHON = process.env.PYTHON || 'python3';

const manifest = JSON.parse(readFileSync(join(root, 'tools/props/manifest.json'), 'utf8'));
const outDir = join(root, 'assets/props');
const rawDir = join(outDir, 'raw');
const work = join(tmpdir(), 'ergoflex-props');
mkdirSync(outDir, { recursive: true }); mkdirSync(rawDir, { recursive: true }); mkdirSync(work, { recursive: true });

function run(cmd, cmdArgs, label) {
    const res = spawnSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (res.error) throw new Error(`${label}: ${res.error.message}`);
    return res;
}

const ids = new Set(manifest.props.map(p => p.id));
if (ids.size !== manifest.props.length) throw new Error('duplicate prop ids in manifest');
const selected = manifest.props.filter(p => !only || only.includes(p.id));
if (only) for (const id of only) if (!ids.has(id)) throw new Error(`unknown prop id ${id}`);

// 1. Rhino files -> OBJ.
const jobs = [];
for (const prop of selected) {
    let source = join(root, 'models', prop.source);
    if (!existsSync(source)) throw new Error(`${prop.id}: missing source ${prop.source}`);
    if (extname(source).toLowerCase() === '.3dm') {
        const obj = join(work, `${prop.id}.obj`);
        const res = run(PYTHON, [join(root, 'tools/props/rhino-to-obj.py'), source, obj], prop.id);
        if (res.status !== 0) throw new Error(`${prop.id}: rhino export failed\n${res.stderr}`);
        process.stdout.write(res.stdout);
        source = obj;
    }
    jobs.push({ id: prop.id, source, fit: prop.fit, anchor: prop.anchor || 'floor', rotateY: prop.rotateY || 0,
                rotateX: prop.rotateX || 0, exclude: prop.exclude || [], material: prop.material || null,
                budget: prop.budget || 0, out: join(rawDir, `${prop.id}.glb`) });
}

// 2. Blender: import, scale to real-world size, anchor, export raw GLB.
const jobsFile = join(work, 'jobs.json');
writeFileSync(jobsFile, JSON.stringify(jobs));
console.log(`Converting ${jobs.length} props with ${BLENDER}…`);
const blender = run(BLENDER, ['-b', '--python-exit-code', '1', '-P', join(root, 'tools/props/blender-convert.py'), '--', jobsFile], 'blender');
const results = new Map();
for (const line of blender.stdout.split('\n')) if (line.startsWith('RESULT ')) { const r = JSON.parse(line.slice(7)); results.set(r.id, r); }
if (blender.status !== 0 && results.size === 0) throw new Error(`Blender failed:\n${blender.stderr}\n${blender.stdout.slice(-2000)}`);

// 3. Optimise and index.
const indexFile = join(outDir, 'index.json');
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : { props: [], screens: [] };
const byId = new Map(index.props.map(p => [p.id, p]));
const gltfTransform = join(root, 'node_modules/.bin/gltf-transform');
let failures = 0;
for (const prop of selected) {
    const r = results.get(prop.id);
    if (!r?.ok) { failures++; console.error(`✗ ${prop.id}: ${r?.error || 'no result from Blender'}`); continue; }
    const raw = join(rawDir, `${prop.id}.glb`), out = join(outDir, `${prop.id}.glb`);
    if (flag('--no-optimize')) copyFileSync(raw, out);
    else {
        const size = String(prop.textureSize || manifest.textureSize || 1024);
        const res = run(gltfTransform, ['optimize', raw, out, '--compress', 'meshopt', '--texture-compress', 'webp',
                                        '--texture-size', size, '--simplify', 'false'], prop.id);
        if (res.status !== 0) { failures++; console.error(`✗ ${prop.id}: optimize failed\n${res.stderr}`); continue; }
    }
    if (!flag('--keep-raw')) rmSync(raw);
    // `license` and `attribution` travel with every entry because the sources
    // are third-party downloads: an unconfirmed licence has to be visible in the
    // data, not just assumed from the fact that the file converted cleanly.
    const entry = { id: prop.id, name: prop.name, category: prop.category, scenes: prop.scenes || [], file: `assets/props/${prop.id}.glb`,
                    anchor: prop.anchor || 'floor', size: r.size, min: r.min, max: r.max, tris: r.tris, bytes: statSync(out).size,
                    ...(prop.budget && r.sourceTris && r.sourceTris > r.tris ? { sourceTris: r.sourceTris } : {}),
                    source: `models/${prop.source}`, license: prop.license || 'unconfirmed', attribution: prop.attribution || null,
                    ...(prop.sizeNote ? { sizeNote: prop.sizeNote } : {}) };
    byId.set(prop.id, entry);
    const reduced = entry.sourceTris ? ` (from ${entry.sourceTris})` : '';
    console.log(`✓ ${prop.id.padEnd(24)} ${String(r.tris).padStart(7)} tris${reduced.padEnd(12)} ${(entry.bytes / 1024).toFixed(0).padStart(5)} KB  ${r.size.map(v => Math.round(v)).join(' × ')} mm`);
}
if (!flag('--keep-raw')) rmSync(rawDir, { recursive: true, force: true });

// 4. Screen wallpapers: copy through as-is (the studio sizes them on the monitor).
const screens = [];
mkdirSync(join(outDir, 'screens'), { recursive: true });
for (const s of manifest.screens || []) {
    const src = join(root, 'models', s.source), dst = join(outDir, 'screens', `${s.id}${extname(s.source).toLowerCase()}`);
    if (!existsSync(src)) { console.error(`✗ screen ${s.id}: missing ${s.source}`); continue; }
    copyFileSync(src, dst);
    screens.push({ id: s.id, file: `assets/props/screens/${s.id}${extname(s.source).toLowerCase()}`, scenes: s.scenes || [] });
}

const order = new Map(manifest.props.map((p, i) => [p.id, i]));
index.props = [...byId.values()].filter(p => order.has(p.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
index.screens = screens;
index.generated = new Date().toISOString();
writeFileSync(indexFile, JSON.stringify(index, null, 1) + '\n');
console.log(`${index.props.length} props indexed, ${failures} failed → ${indexFile}`);
process.exit(failures ? 1 : 0);
