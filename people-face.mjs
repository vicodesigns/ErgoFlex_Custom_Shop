// The face poses are indexed by the original skin UVs. Those landmarks survive
// baking a different rest pose for every desk height, wheelchair and action.
import { Float32BufferAttribute, Vector3 } from 'three';

const cast = new Set([
    'mia', 'yara', 'ava', 'sofia', 'lin', 'maya', 'kai', 'noah', 'priya', 'omar', 'andre', 'jo',
    'zoe', 'eli', 'ben', 'grace', 'leo', 'hale', 'fern', 'nia', 'finn',
]);
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
export function prepareFace(root, data, id) {
    if (!data) return;
    const meshes = [], eyes = [];
    root.traverse(mesh => {
        const part = mesh.material?.name?.replace(/^Human\./, '');
        if (mesh.isMesh && (part === 'low-poly' || part === 'eyes_cornea')) eyes.push(mesh);
        if (mesh.isMesh && data.parts.has(part)) meshes.push({ mesh, part });
    });
    const skin = meshes.find(p => p.part === 'body');
    const frame = skin && headFrame(skin.mesh.geometry, data.landmarks);
    if (!frame) return;
    for (const eyeMesh of eyes) {
        // (the eyes' frame as bound, for a glance's aim: eyeAim; `unit` a small step in the geometry's own units)
        eyeMesh.geometry.userData.eyeFrame ||= { mid: frame.mid.toArray(), x: frame.x.toArray(), y: frame.y.toArray(), z: frame.z.toArray(), unit: frame.scale[2] * .5, vertex: 0 };
        if (!eyeMesh.geometry.morphAttributes.position?.length) prepareEyes(eyeMesh, frame);
    }
    const detailedMouth = ['andre', 'maya', 'omar'].includes(character(id));
    const { mid, x, y, z, scale } = frame;
    const coord = new Vector3(), delta = new Vector3();
    for (const { mesh, part } of meshes) {
        const g = mesh.geometry, { uv, position } = g.attributes;
        if (!uv || g.morphAttributes.position?.length) continue;
        const stride = part === 'body' ? 6 : 3, rows = data.parts.get(part);
        const channels = detailedMouth && part === 'body' ? [...names, 'LipPress'] : names;
        const positions = channels.map(() => new Float32Array(3 * uv.count));
        const normals = part === 'body' ? channels.map(() => new Float32Array(3 * uv.count)) : null;
        for (let i = 0; i < uv.count; i++) {
            const key = 2 * uvKey(uv, i);
            const side = Number(coord.fromBufferAttribute(position, i).sub(mid).dot(x) > 0);
            const row = rows.get(key + side) || rows.get(key + 1 - side);
            if (!row) continue;
            for (let k = 0; k < channels.length; k++) {
                const a = 1 + stride * k;
                delta.copy(x).multiplyScalar(scale[0] * row[a]).addScaledVector(y, scale[1] * row[a+1])
                    .addScaledVector(z, scale[2] * row[a+2]).multiplyScalar(.0001).toArray(positions[k], i * 3);
                if (normals) delta.copy(x).multiplyScalar(row[a+3]).addScaledVector(y, row[a+4])
                    .addScaledVector(z, row[a+5]).multiplyScalar(.001).toArray(normals[k], i * 3);
            }
        }
        const attributes = arrays => arrays.map((a, i) => {
            const attr = new Float32BufferAttribute(a, 3); attr.name = channels[i]; return attr;
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

// The eyes lead these gestures. A hold has four edges so a fixation can
// arrive in a fraction of a second while the mouth and cheeks take their time.
function hold(t, start, arrived, release, end) {
    return ease(start, arrived, t) * (1 - ease(release, end, t));
}

function drawExpression({ meshes, eyes }, smile, lids, brow, across, up, lips = 0) {
    // Natural eyelid follow: looking down lowers the upper lid slightly so the eye avoids a staring gap above the iris.
    const lidFollow = up < 0 ? Math.min(.22, -up * .22) : 0;
    const effLids = Math.min(1, lids + (1 - lids) * lidFollow);
    for (const mesh of meshes) {
        const w = mesh.morphTargetInfluences;
        w[0] = smile; w[1] = effLids; w[2] = brow;
        if (mesh.morphTargetDictionary.LipPress !== undefined) w[3] = lips;
    }
    for (const eyeMesh of eyes) {
        eyeMesh.morphTargetInfluences[0] = across;
        eyeMesh.morphTargetInfluences[1] = up;
    }
}

const chapterActors = {
    storage: { who: 'andre', room: 'workshop', blinks: [3.03, 7.42, 11.58, 16.85, 21.4] },
    rise: { who: 'maya', room: 'home', blinks: [2.37, 5.7, 9.32, 12.41, 16.25, 20.76, 25.1] },
    media: { who: 'omar', room: 'music', blinks: [1.73, 4.49, 8.28, 12.92, 16.17] },
};

function drawChapterFace(bound, shot, t, blinks) {
    let blink = 0;
    for (const at of blinks) blink = Math.max(blink, blinkPulse(t - at));
    if (shot.id === 'storage') {
        const shelf = hold(t, .79, 1.68, 2.85, 3.65);
        const seatRobot = hold(t, .42, 1.25, 2.23, 2.97);
        const phone = hold(t, 7.74, 8.37, 11.43, 11.99);
        const tap = hold(t, 9.15, 10.46, 11.36, 11.95);
        const followDesk = hold(t, 11.55, 12.14, 18.4, 22.45);
        const satisfied = hold(t, 11.93, 13.65, 14.69, 17.45);
        drawExpression(bound, .11 + .32 * shelf + .60 * satisfied,
            blink, .08 + .25 * shelf + .23 * followDesk,
            .13 * shelf - .24 * phone + .46 * followDesk,
            -.21 + .72 * shelf - .61 * phone + .42 * followDesk, .44 * seatRobot + .51 * tap);
    } else if (shot.id === 'rise') {
        const wake = hold(t, 1.68, 2.1, 2.91, 3.67);
        const readout = hold(t, 3.6, 4.15, 6.8, 7.56);
        const atHeight = hold(t, 7.18, 8.16, 8.94, 10.04);
        const sit = hold(t, 9.6, 10.32, 11.98, 12.89);
        // The short edit goes straight back to typing. In the long edit the
        // seated stretch occupies the space before the same closing summary.
        const finish = shot.seconds;
        const release = finish > 23 ? hold(t, 14.12, 15.82, 19.45, 22.63) : 0;
        const summary = hold(t, finish - 4.6, finish - 3.14, finish - 1.15, finish + .3);
        drawExpression(bound, .13 + .50 * atHeight + .21 * release + .43 * summary,
            blink + (1 - blink) * .17 * release, .09 + .35 * wake + .26 * atHeight + .14 * summary,
            -.36 * readout + .27 * atHeight - .22 * sit + .17 * summary,
            -.24 + .60 * wake - .38 * readout + .51 * atHeight - .30 * sit + .33 * release + .30 * summary,
            .11 + .27 * readout + .18 * sit - .10 * release);
    } else {
        const approach = hold(t, .36, 1.16, 3.22, 4.47);
        const settle = hold(t, 3.98, 4.68, 5.82, 7.28);
        const scan = hold(t, 7.64, 8.18, 9.12, 9.67);
        const catchDetail = hold(t, 9.25, 9.82, 10.64, 12.03);
        const enjoy = hold(t, 10.10, 12.15, 13.31, 15.73);
        const afterglow = hold(t, 13.92, 14.97, 16.37, 18.08);
        drawExpression(bound, .14 + .16 * settle + .58 * enjoy + .20 * afterglow,
            blink, .10 + .18 * settle + .46 * catchDetail,
            -.29 * approach + .36 * scan - .37 * catchDetail + .14 * afterglow,
            -.13 - .31 * approach + .34 * settle + .44 * catchDetail + .19 * enjoy,
            .28 * approach + .24 * scan);
    }
}

// Glances (opt-in: a cast entry's `glances`, room-people.mjs): authored looks away from what the posture has them doing, in
// chapter seconds: keys [[leave, there, leave there, back], ...]. The eyes go first (EYE_LEAD) and quicker than the head;
// the smile gathers a little after the eyes arrive and stays a little after they have left.
const EYE_LEAD = .1, EYE_TRAVEL = Math.PI / 30, EYE_MAX = 1.5;      // (6 degrees of iris travel at influence 1, prepareEyes)
export function glanceAt(glances, t) {
    const out = { head: 0, eyes: 0, smile: 0, blink: 0 };
    for (const key of Array.isArray(glances?.keys) ? glances.keys : []) {
        if (!Array.isArray(key) || key.length !== 4 || !key.every(Number.isFinite)) continue;
        const [a, b, c, d] = key;
        out.head = Math.max(out.head, hold(t, a, b, c, d));
        out.eyes = Math.max(out.eyes, hold(t, a - EYE_LEAD, a + (b - a) * .45 - EYE_LEAD, c - EYE_LEAD * .5, c + (d - c) * .55));
        out.smile = Math.max(out.smile, hold(t, a + .1, b + .25, c, d + .35));
        out.blink = Math.max(out.blink, blinkPulse(t - (a - EYE_LEAD - .04)));
    }
    return out;
}
// How far the eyes must turn from straight ahead (radians, to their left and up) to be on `target` (the world) from
// where the head has them now: the eyes' own frame as bound (prepareEyes), carried by the head bone.
const eyeP = [new Vector3(), new Vector3(), new Vector3(), new Vector3()], eyeTo = new Vector3();
function eyeAim(eyeMesh, target) {
    const f = eyeMesh.geometry.userData.eyeFrame; if (!f) return null;
    eyeMesh.updateWorldMatrix(true, false); eyeMesh.skeleton?.bones.forEach(bone => bone.name === 'head' && bone.updateWorldMatrix(true, false));
    const [mid, px, py, pz] = eyeP.map((p, k) => {
        p.fromArray(f.mid); if (k) p.addScaledVector(eyeTo.fromArray(f['xyz'[k - 1]]), f.unit);
        if (eyeMesh.isSkinnedMesh) eyeMesh.applyBoneTransform(f.vertex, p);
        return p.applyMatrix4(eyeMesh.matrixWorld);
    });
    px.sub(mid).normalize(); py.sub(mid).normalize(); pz.sub(mid).normalize(); eyeTo.copy(target).sub(mid).normalize();
    const a = eyeTo.dot(px), u = eyeTo.dot(py), n = eyeTo.dot(pz);
    return { across: Math.atan2(a, n), up: Math.atan2(u, Math.hypot(a, n)) };
}

const bindings = new WeakMap();
export function performFace(person, room, seconds, film, live, shot = null) {
    let bound = bindings.get(person);
    if (bound === undefined) {
        const who = character(person.userData.person?.id), meshes = [], eyes = [];
        if (cast.has(who)) person.traverse(mesh => {
            if (mesh.morphTargetDictionary?.LookAcross === 0) eyes.push(mesh);
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
        for (const eyeMesh of eyes) eyeMesh.morphTargetInfluences.fill(0);
        return;
    }
    const time = seconds;
    const cycle = (time + seed * 8) % (9 + seed * 4);
    const quietSmile = ease(1, 2.4, cycle) * (1 - ease(3.3, 5.8, cycle));
    const role = person.userData.person.key || person.userData.person.variant || '';
    const featured = role === who || role.startsWith(who + '-');
    const lead = film && shot && chapterActors[shot.id];
    const seatedMaya = who === 'maya' && person.userData.person.id === 'people-maya-sit-type' && !person.userData.person.station;
    if (lead && lead.who === who && lead.room === room && (featured || seatedMaya)) {
        drawChapterFace(bound, shot, time, lead.blinks);
        return;
    }
    const beat = film && featured && reactions[room]?.[who];
    const reaction = beat ? ease(beat[0], beat[1], time) * (1 - ease(beat[2], beat[3], time)) : 0;
    const smile = .11 + .065 * seed + (beat ? .045 : .25) * quietSmile + (beat ? .64 * beat[4] * reaction : 0);
    const blinkAt = (time + seed * 5) % (8.3 + seed * 1.6);
    const blink = Math.max(blinkPulse(blinkAt - 1.45), blinkPulse(blinkAt - 4.9 - seed));
    let across = 0, up = 0;
    if (eyes) {
        // A brief refocus precedes the smile. Between reactions the gaze
        // rests, with a small change of fixation during an occasional blink.
        const refocus = beat ? ease(beat[0] - .28, beat[0] + .10, time) * (1 - ease(beat[2], beat[3], time)) : 0;
        const glance = ease(1.46, 1.63, blinkAt) * (1 - ease(3.0, 3.27, blinkAt));
        across = (seed < .5 ? -1 : 1) * (.45 * refocus + .23 * glance);
        up = -.16 + .65 * refocus + .13 * glance;
    }
    const brow = .09 + .25 * quietSmile + .53 * reaction * (1 - .6 * reaction);
    let smiling = smile, lid = blink;
    const glances = film ? person.userData.person.glances : null;
    person.userData.glanceProbe = undefined;
    if (glances) {
        const glance = glanceAt(glances, time);
        smiling += (Number.isFinite(glances.smile) ? glances.smile : .3) * glance.smile;
        lid = Math.max(lid, glance.blink);
        const target = person.userData.glanceTarget, aim = glance.eyes > 0 && target && eyes[0] ? eyeAim(eyes[0], target) : null;
        if (aim) {
            const to = v => Math.max(-EYE_MAX, Math.min(EYE_MAX, v / EYE_TRAVEL));
            across += (to(aim.across) - across) * glance.eyes; up += (to(aim.up) - up) * glance.eyes;
            // (read by probes and tests: how far off the target the head, and then the eyes, are, degrees)
            const deg = 180 / Math.PI;
            person.userData.glanceProbe = { weight: glance.head, headAcross: aim.across * deg, headUp: aim.up * deg, eyeAcross: (aim.across - across * EYE_TRAVEL) * deg, eyeUp: (aim.up - up * EYE_TRAVEL) * deg, smile: Math.min(1, smiling), lid };
        }
    }
    const strength = Math.min(1, smiling);
    drawExpression(bound, strength, lid * (1 - .08 * strength), brow, across, up);
}
