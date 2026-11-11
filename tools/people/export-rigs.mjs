#!/usr/bin/env node
// The skeleton of every built posture, one small file per character (room-people-motion.mjs moves a person between
// postures with these, without loading every model):
//
//     node tools/people/export-rigs.mjs [character ...]      ->  assets/props/people-rigs/<character>.json
//
// Every model of a character has the same bones with the same offsets; a posture is the bones' rest turns (the pose
// is applied as the rest pose, tools/people/build_people.py) plus where the pelvis and the root sit. The file holds
//   bones: [names], parents: [index | -1], offsets: [x, y, z per bone]   (metres, the bone's place in its parent)
//   postures: { '<model id>': { pose, deskHeight?, root: [x, y, z], pelvis: [x, y, z], q: [x, y, z, w per bone] } }
// Run it after tools/people/build.py has built or rebuilt models (it only reads the GLBs' JSON chunk).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), PROPS = path.join(ROOT, 'assets/props'), OUT = path.join(PROPS, 'people-rigs');
const only = process.argv.slice(2);
const index = JSON.parse(fs.readFileSync(path.join(PROPS, 'index.json'), 'utf8'));
const people = index.props.filter(p => p.category === 'people' && p.person?.character && (!only.length || only.includes(p.person.character)));
const gltf = file => { const d = fs.readFileSync(file), len = d.readUInt32LE(12); return JSON.parse(d.subarray(20, 20 + len).toString('utf8')); };
const r = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

fs.mkdirSync(OUT, { recursive: true });
const by = new Map(); for (const p of people) { if (!by.has(p.person.character)) by.set(p.person.character, []); by.get(p.person.character).push(p); }
let files = 0, bytes = 0;
for (const [who, models] of by) {
    let bones = null, parents = null, offsets = null; const postures = {};
    for (const model of models.sort((a, b) => a.id.localeCompare(b.id))) {
        const file = path.join(ROOT, model.file); if (!fs.existsSync(file)) { console.warn('missing ' + model.file); continue; }
        const g = gltf(file), skin = g.skins?.[0]; if (!skin) { console.warn('no skeleton in ' + model.id); continue; }
        const parentOf = new Map(); g.nodes.forEach((n, i) => (n.children || []).forEach(c => parentOf.set(c, i)));
        const names = skin.joints.map(i => g.nodes[i].name);
        if (!bones) {
            bones = names; parents = skin.joints.map(i => { const p = parentOf.get(i); return p === undefined ? -1 : names.indexOf(g.nodes[p].name); });
            offsets = skin.joints.map(i => (g.nodes[i].translation || [0, 0, 0]).map(v => r(v, 5)));
        } else if (names.join() !== bones.join()) { console.warn(model.id + ': other bones than the rest of ' + who + ', left out'); continue; }
        const node = name => g.nodes[skin.joints[bones.indexOf(name)]];
        // a limb bone whose offset differs from the first model's would make the shared offsets wrong
        skin.joints.forEach((i, at) => { if (['Root', 'pelvis', 'still'].includes(bones[at])) return; const t = g.nodes[i].translation || [0, 0, 0]; if (t.some((v, k) => Math.abs(v - offsets[at][k]) > 2e-4)) throw Error(model.id + ': ' + bones[at] + ' sits elsewhere in its parent than in the other models'); });
        postures[model.id] = {
            pose: model.person.pose, ...(model.person.deskHeight !== undefined ? { deskHeight: model.person.deskHeight } : {}),
            root: (node('Root').translation || [0, 0, 0]).map(v => r(v, 5)), pelvis: (node('pelvis').translation || [0, 0, 0]).map(v => r(v, 5)),
            q: skin.joints.flatMap(i => (g.nodes[i].rotation || [0, 0, 0, 1]).map(v => r(v, 5)))
        };
    }
    if (!bones) continue;
    const text = JSON.stringify({ v: 1, character: who, bones, parents, offsets: offsets.flat(), postures });
    fs.writeFileSync(path.join(OUT, who + '.json'), text); files++; bytes += text.length;
    console.log(`${who}: ${Object.keys(postures).length} postures, ${bones.length} bones, ${Math.round(text.length / 1024)} KB`);
}
console.log(`${files} files, ${Math.round(bytes / 1024)} KB`);
