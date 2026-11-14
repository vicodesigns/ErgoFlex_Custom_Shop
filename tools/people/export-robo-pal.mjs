// The workshop's Robo-Pal figure (tools/experience/workshop-toy-story.mjs, the seated "stowed" version on the desk's top
// shelf) as plain triangles, so a person can hold the very same robot (tools/people/held.py `robot`).
//
//     node tools/people/export-robo-pal.mjs        writes tools/people/robo-pal.json
//
// Millimetres in the figure root's own frame (y up, the robot faces +z; its root sits on the shelf's mount point),
// one entry per material: colour, emission, roughness, metalness and the triangles. The toy story builds the figure
// from three.js primitives; this runs the toy story's own builder (taken from its source) in node and bakes each mesh.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'tools/experience/workshop-toy-story.mjs'), 'utf8');
const take = name => { const i = src.indexOf(`function ${name}(`); if (i < 0) throw Error('no ' + name); let depth = 0, j = src.indexOf(') {', i) + 2; for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && !--depth) break; } return src.slice(i, j + 1); };
const code = ['markAsset', 'prepareFadeableRoot', 'buildGimbalCradle', 'buildSmartRobotFigure'].map(n => n === 'markAsset' ? src.slice(src.indexOf('const markAsset'), src.indexOf('};', src.indexOf('const markAsset')) + 2) : take(n)).join('\n');
const build = new Function('THREE', code + '\nreturn buildSmartRobotFigure;')(THREE);
const root = build([], { stowed: true }); root.updateMatrixWorld(true);
const groups = new Map(), r = v => Math.round(v * 100) / 100;
root.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material, key = [m.color.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.roughness, m.metalness].join('|');
    if (!groups.has(key)) groups.set(key, { color: '#' + m.color.getHexString(), emissive: m.emissive && m.emissive.getHex() ? '#' + m.emissive.getHexString() : null, emissiveIntensity: m.emissive?.getHex() ? m.emissiveIntensity : 0, roughness: m.roughness, metalness: m.metalness, positions: [] });
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, p = g.attributes.position, v = new THREE.Vector3(), out = groups.get(key).positions;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); out.push(r(v.x), r(v.y), r(v.z)); }
});
const box = new THREE.Box3().setFromObject(root);
const doc = { source: 'tools/experience/workshop-toy-story.mjs buildSmartRobotFigure({ stowed: true })', units: 'mm', up: 'y', faces: '+z', bounds: { min: box.min.toArray().map(r), max: box.max.toArray().map(r) }, materials: [...groups.values()] };
fs.writeFileSync(path.join(HERE, 'robo-pal.json'), JSON.stringify(doc) + '\n');
console.log('robo-pal.json', doc.materials.length, 'materials', doc.materials.reduce((s, m) => s + m.positions.length / 9, 0), 'triangles', doc.bounds);
