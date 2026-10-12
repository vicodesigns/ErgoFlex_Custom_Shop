// Preserve the supplied arm's rigid parts instead of joining them into one mesh.
import { NodeIO } from '@gltf-transform/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const io = new NodeIO();
const doc = await io.read(resolve(root, 'models/ergoflex-supplied/singleMonitorArm.glb'));
const nodes = doc.getRoot().listNodes();
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (const node of nodes) for (const primitive of node.getMesh().listPrimitives()) {
    const a = primitive.getAttribute('POSITION');
    for (let i = 0; i < a.getCount(); i++) {
        const p = a.getElement(i, []);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    }
}
const factor = .380 / (hi[1] - lo[1]);
const origin = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
const metal = doc.createMaterial('Dark arm metal').setBaseColorFactor([.035, .044, .052, 1]).setMetallicFactor(.7).setRoughnessFactor(.32).setDoubleSided(true);
nodes.forEach((node, index) => {
    const part = [0, 1, 2, 8].includes(index) ? 'clamp' : index < 9 ? 'lower' : index < 16 ? 'upper' : 'head';
    node.setName(`single-arm-${part}-${index}`);
    for (const primitive of node.getMesh().listPrimitives()) {
        const a = primitive.getAttribute('POSITION');
        const positions = new Float32Array(a.getCount() * 3);
        for (let i = 0; i < a.getCount(); i++) {
            const p = a.getElement(i, []);
            for (let k = 0; k < 3; k++) positions[i * 3 + k] = (p[k] - origin[k]) * factor;
        }
        a.setArray(positions); primitive.setMaterial(metal);
    }
});
const output = resolve(root, 'assets/props/ergoflex-single-monitor-arm.glb');
await io.write(output, doc);
const indexPath = resolve(root, 'assets/props/index.json');
const index = JSON.parse(readFileSync(indexPath));
Object.assign(index.props.find(p => p.id === 'ergoflex-single-monitor-arm'), {
    bytes: readFileSync(output).length, revision: 'rigid-joints-20261012'
});
writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n');
console.log('Single arm exported with separate clamp, links and VESA head.');
