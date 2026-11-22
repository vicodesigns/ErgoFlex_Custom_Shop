// The face poses are indexed by the original skin UVs. Those landmarks survive
// baking a different rest pose for every desk height, wheelchair and action.
import { Float32BufferAttribute, Vector3 } from 'three';

const cast = new Set(['mia', 'yara', 'ava', 'sofia', 'lin', 'maya', 'kai', 'noah', 'priya', 'omar', 'andre', 'jo']);
const names = ['Smile', 'Blink', 'Brow'];
const character = id => id?.startsWith('people-') ? id.split('-')[1] : null;
let atlas;

export function faceData(id) {
    if (!cast.has(character(id))) return null;
    return atlas ||= import('./assets/motion/cast-face-units.mjs').then(({ landmarks, units }) => ({
        landmarks, parts: new Map(Object.entries(units).map(([part, rows]) =>
            [part, new Map(rows.map(row => [row[0], row]))])),
    })).catch(error => { atlas = null; console.warn('[people] Face data unavailable', error); return null; });
}

const uvKey = (uv, i) => Math.round(uv.getX(i) * 4095) * 4096 + Math.round(uv.getY(i) * 4095);
function headFrame(geometry, landmarks) {
    const { uv, position } = geometry.attributes;
    if (!uv || !position) return null;
    const points = new Map();
    for (let i = 0; i < uv.count && points.size < landmarks.length; i++) {
        const key = uvKey(uv, i);
        if (landmarks.includes(key)) points.set(key, new Vector3().fromBufferAttribute(position, i));
    }
    if (points.size !== landmarks.length) return null;
    const [right, left, forehead, chin] = landmarks.map(key => points.get(key));
    const mid = left.clone().lerp(right, .5);
    const x = left.clone().sub(right), vertical = forehead.clone().sub(chin);
    const width = x.length() / .8924, height = vertical.length() / 1.3199;
    if (!width || !height) return null;
    x.normalize();
    const z = new Vector3().crossVectors(x, vertical).normalize();
    const y = new Vector3().crossVectors(z, x);
    // The forehead landmark sits .074 template units ahead of the chin.
    y.addScaledVector(z, -.074 / 1.3178).normalize();
    z.crossVectors(x, y).normalize();
    return { mid, x, y, z, scale: [width, height, (width + height) / 2] };
}

// The compressed GLB stores all primitives of a person in the same quantized
// coordinate system. Build these once on the cached model, before any clones
// are drawn. Three gives every static and rigged instance its own weights.
export function prepareFace(root, data) {
    if (!data) return;
    const meshes = [];
    let eyes;
    root.traverse(mesh => {
        const part = mesh.material?.name?.replace(/^Human\./, '');
        if (mesh.isMesh && part === 'low-poly') eyes = mesh;
        if (mesh.isMesh && data.parts.has(part)) meshes.push({ mesh, part });
    });
    const skin = meshes.find(p => p.part === 'body');
    const frame = skin && headFrame(skin.mesh.geometry, data.landmarks);
    if (!frame) return;
    if (eyes && !eyes.geometry.morphAttributes.position?.length) prepareEyes(eyes, frame);
    const { mid, x, y, z, scale } = frame;
    const coord = new Vector3(), delta = new Vector3();
    for (const { mesh, part } of meshes) {
        const g = mesh.geometry, { uv, position } = g.attributes;
        if (!uv || g.morphAttributes.position?.length) continue;
        const stride = part === 'body' ? 6 : 3, rows = data.parts.get(part);
        const positions = names.map(() => new Float32Array(3 * uv.count));
        const normals = part === 'body' ? names.map(() => new Float32Array(3 * uv.count)) : null;
        for (let i = 0; i < uv.count; i++) {
            const key = 2 * uvKey(uv, i);
            const side = Number(coord.fromBufferAttribute(position, i).sub(mid).dot(x) > 0);
            const row = rows.get(key + side) || rows.get(key + 1 - side);
            if (!row) continue;
            for (let k = 0; k < names.length; k++) {
                const a = 1 + stride * k;
                delta.copy(x).multiplyScalar(scale[0] * row[a]).addScaledVector(y, scale[1] * row[a+1])
                    .addScaledVector(z, scale[2] * row[a+2]).multiplyScalar(.0001).toArray(positions[k], i * 3);
                if (normals) delta.copy(x).multiplyScalar(row[a+3]).addScaledVector(y, row[a+4])
                    .addScaledVector(z, row[a+5]).multiplyScalar(.001).toArray(normals[k], i * 3);
            }
        }
        const attributes = arrays => arrays.map((a, i) => {
            const attr = new Float32BufferAttribute(a, 3); attr.name = names[i]; return attr;
        });
        g.morphTargetsRelative = true;
        g.userData.morphWeightLimit = 1;
        g.morphAttributes.position = attributes(positions);
        if (normals) g.morphAttributes.normal = attributes(normals);
        mesh.updateMorphTargets();
    }
}

// Turn each eyeball about its own centre. Both irises travel together under
// stationary lids. The same rotation takes the corneal normals with the iris.
function prepareEyes(mesh, { mid, x, y, z }) {
    const g = mesh.geometry, { position, normal } = g.attributes;
    const sides = [[], []];
    const point = new Vector3(), relative = new Vector3();
    for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i);
        const side = Number(relative.copy(point).sub(mid).dot(x) > 0);
        sides[side].push(i);
    }
    if (sides.some(side => !side.length)) return;
    const targets = [y, x].map((axis, k) => {
        const pos = new Float32Array(3 * position.count), norm = new Float32Array(pos.length);
        // Six degrees of travel at full influence, positive upward for LookUp.
        const angle = (k ? -1 : 1) * Math.PI / 30;
        for (const side of sides) {
            const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
            for (const i of side) {
                point.fromBufferAttribute(position, i);
                relative.set(point.dot(x), point.dot(y), point.dot(z));
                lo.min(relative); hi.max(relative);
            }
            const centre = lo.lerp(hi, .5);
            const origin = x.clone().multiplyScalar(centre.x).addScaledVector(y, centre.y).addScaledVector(z, centre.z);
            for (const i of side) {
                point.fromBufferAttribute(position, i).sub(origin);
                relative.copy(point).applyAxisAngle(axis, angle).sub(point).toArray(pos, i * 3);
                point.fromBufferAttribute(normal, i);
                relative.copy(point).applyAxisAngle(axis, angle).sub(point).toArray(norm, i * 3);
            }
        }
        const attr = new Float32BufferAttribute(pos, 3);
        attr.name = k ? 'LookUp' : 'LookAcross';
        return { pos: attr, norm: new Float32BufferAttribute(norm, 3) };
    });
    g.morphTargetsRelative = true;
    g.userData.morphWeightLimit = 1;
    g.morphAttributes.position = targets.map(t => t.pos);
    g.morphAttributes.normal = targets.map(t => t.norm);
    mesh.updateMorphTargets();
}

// Seconds in the authored film chapters. A smile gathers after an action and
// eases away more slowly. The same character carries it across posture swaps.
const reactions = {
    library: { yara: [4.9, 6.6, 7.8, 9, .82], mia: [12.3, 14.1, 15.1, 17, .86] },
    occmedialab: { ava: [7.4, 9.8, 12.4, 15.5, .72] },
    creative: { lin: [18.9, 20.7, 22.2, 24, .68] },
    highschool: { kai: [8.6, 11.2, 13.2, 15.8, .88], noah: [9.8, 11.7, 13.4, 15.9, .68] },
    home: { maya: [18.2, 21, 23, 26.4, .63] },
    music: { omar: [9, 10.8, 13.6, 16.8, .68] },
    workshop: { andre: [10.9, 12.5, 14.2, 16, .58] },
};
function ease(start, end, time) {
    const u = Math.max(0, Math.min(1, (time - start) / (end - start)));
    return u * u * (3 - 2 * u);
}

function blinkPulse(t) {
    return ease(0, .085, t) * (1 - ease(.105, .24, t));
}

const bindings = new WeakMap();
export function performFace(person, room, seconds, film, live) {
    let bound = bindings.get(person);
    if (bound === undefined) {
        const who = character(person.userData.person?.id), meshes = [];
        let eyes;
        if (cast.has(who)) person.traverse(mesh => {
            if (mesh.morphTargetDictionary?.LookAcross === 0) eyes = mesh;
            if (mesh.morphTargetDictionary?.Smile === 0 && mesh.morphTargetDictionary?.Brow === 2) meshes.push(mesh);
        });
        const seed = [...(who || '')].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) % 997, 0) / 997;
        bound = meshes.length ? { who, meshes, eyes, seed } : null;
        bindings.set(person, bound);
    }
    if (!bound) return;
    const { who, meshes, eyes, seed } = bound;
    if (!live) {
        for (const mesh of meshes) mesh.morphTargetInfluences.fill(0);
        eyes?.morphTargetInfluences.fill(0);
        return;
    }
    const time = seconds;
    const cycle = (time + seed * 8) % (9 + seed * 4);
    const quietSmile = ease(1, 2.4, cycle) * (1 - ease(3.3, 5.8, cycle));
    const role = person.userData.person.key || person.userData.person.variant || '';
    const featured = role === who || role.startsWith(who + '-');
    const beat = film && featured && reactions[room]?.[who];
    const reaction = beat ? ease(beat[0], beat[1], time) * (1 - ease(beat[2], beat[3], time)) : 0;
    const smile = .11 + .065 * seed + (beat ? .045 : .25) * quietSmile + (beat ? .64 * beat[4] * reaction : 0);
    const blinkAt = (time + seed * 5) % (8.3 + seed * 1.6);
    const blink = Math.max(blinkPulse(blinkAt - 1.45), blinkPulse(blinkAt - 4.9 - seed));
    if (eyes) {
        const gaze = eyes.morphTargetInfluences;
        // A brief refocus precedes the smile. Between reactions the gaze
        // rests, with a small change of fixation during an occasional blink.
        const refocus = beat ? ease(beat[0] - .28, beat[0] + .10, time) * (1 - ease(beat[2], beat[3], time)) : 0;
        const glance = ease(1.46, 1.63, blinkAt) * (1 - ease(3.0, 3.27, blinkAt));
        gaze[0] = (seed < .5 ? -1 : 1) * (.45 * refocus + .23 * glance);
        gaze[1] = -.16 + .65 * refocus + .13 * glance;
    }
    const brow = .09 + .25 * quietSmile + .53 * reaction * (1 - .6 * reaction);
    for (const m of meshes) {
        const w = m.morphTargetInfluences;
        w[0] = Math.min(1, smile); w[1] = blink * (1 - .08 * w[0]); w[2] = brow;
    }
}
