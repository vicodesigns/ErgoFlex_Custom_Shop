// Quick Look executes the behaviors in the asset, independently of webpage JS.
// Apple documents the same tap/transform schemas for USDZ as for .reality:
// https://developer.apple.com/documentation/usd/actions-and-triggers
// This module is loaded only when preparing the Apple AR export.
import { Matrix4 } from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'three/addons/libs/fflate.module.js';
import { minimumHeightForTilt } from './motion-limits.mjs';

const SCENE = '/Root/Scenes/Scene';
const IDENTITY = new Matrix4();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

// Enumerate a finite set of reachable poses. Keep the user's launch pose and
// height for tilt taps; only raise to the clearance limit if 65° requires it.
export function appleTapStates(height, tilt, size) {
    const states = [];
    const find = (h, t) => {
        const existing = states.findIndex(s => Math.abs(s.height - h) < 1e-6 && Math.abs(s.tilt - t) < 1e-6);
        if (existing >= 0) return existing;
        states.push({ height: h, tilt: t });
        return states.length - 1;
    };
    find(height, tilt);
    for (let i = 0; i < states.length; i++) {
        const state = states[i];
        state.leg = state.height < 35 ? find(43.5, -5) : find(28, 0);
        const nextTilt = state.tilt < 20 ? 39 : state.tilt < 50 ? 65 : -5;
        state.wing = find(Math.max(state.height, minimumHeightForTilt(nextTilt, size)), nextTilt);
        if (states.length > 20) throw new Error('Apple tap pose graph did not converge.');
    }
    return states;
}

export function appleTapPart(name) {
    if (name === 'Desktop_1' || name === 'Desktop_2' || /^(Left|Right) wing trim$/.test(name)) return 'wing';
    if (/^Base_Panels(?:_1)?$/.test(name) || /^(Left|Right) leg profile trim$/.test(name) ||
        /^Lift_Column_(?:Center(?:_1)?|Bottom_[23]|Top_1[67])$/.test(name)) return 'leg';
    return null;
}

function matrixText(matrix) {
    const e = matrix.elements;
    if (!e.every(Number.isFinite)) throw new Error('Non-finite Apple AR transform.');
    return '(' + [0, 4, 8, 12].map(offset => '(' + e.slice(offset, offset + 4).map(n =>
        Math.abs(n) < 1e-12 ? '0' : String(n)).join(', ') + ')').join(', ') + ')';
}

function xform(name, matrix, contents = '') {
    return `def Xform "${name}"\n{\n` +
        `matrix4d xformOp:transform = ${matrixText(matrix)}\n` +
        'uniform token[] xformOpOrder = ["xformOp:transform"]\n' + contents + '\n}\n';
}

function relation(paths) {
    return '[' + paths.map(path => `<${path}>`).join(', ') + ']';
}

function transformAction(name, affected, target, duration = 1.2) {
    return `def Preliminary_Action "${name}"\n{\n` +
        'uniform token info:id = "Transform"\n' +
        'uniform token type = "absolute"\n' +
        'uniform token multiplePerformOperation = "ignore"\n' +
        `rel affectedObjects = ${relation(affected)}\nrel xformTarget = <${target}>\n` +
        `uniform double duration = ${duration}\nuniform token easeType = "inout"\n}\n`;
}

function groupAction(name, actions, type) {
    return `def Preliminary_Action "${name}"\n{\n` +
        'uniform token info:id = "Group"\nuniform token multiplePerformOperation = "ignore"\n' +
        `uniform token type = "${type}"\nuniform bool loops = false\nuniform uint performCount = 1\n` +
        `rel actions = ${relation(actions)}\n}\n`;
}

// Parts with identical motion share one animated parent, keeping Quick Look's
// behavior graph small. Linkage cylinders/rods retain their own sampled motion.
export function appleMotionGroups(meshes, samples) {
    const groups = new Map();
    for (const mesh of meshes) {
        const matrices = samples.get(mesh.id);
        if (!matrices?.length) throw new Error(`No Apple AR poses for ${mesh.name}.`);
        const inverse = matrices[0].clone().invert();
        if (Math.abs(matrices[0].determinant()) < 1e-12) throw new Error(`Singular Apple AR surface: ${mesh.name}.`);
        const deltas = matrices.map(matrix => matrix.clone().multiply(inverse));
        deltas[0].identity();
        const key = deltas.map(delta => delta.elements.map(n => Math.round(n * 1e5)).join(',')).join(';');
        if (!groups.has(key)) groups.set(key, { name: `Motion_${groups.size}`, deltas, meshes: [] });
        groups.get(key).meshes.push(mesh);
    }
    const result = [...groups.values()];
    for (const group of result) {
        for (const mesh of group.meshes) {
            const matrices = samples.get(mesh.id);
            group.deltas.forEach((delta, i) => {
                const endpoint = delta.clone().multiply(matrices[0]);
                if (endpoint.elements.some((n, k) => Math.abs(n - matrices[i].elements[k]) > 1e-4)) {
                    throw new Error(`Apple motion grouping changed ${mesh.name} at pose ${i}.`);
                }
            });
        }
    }
    return result;
}

function packAligned(files) {
    // USDZ must be ZIP_STORED, with every file's data starting at a 64-byte
    // boundary. Count the complete local header, including the extra field.
    let offset = 0;
    const aligned = {};
    for (const [name, bytes] of Object.entries(files)) {
        const header = 30 + strToU8(name).length;
        const padding = (64 - ((offset + header + 4) % 64)) % 64;
        aligned[name] = [bytes, { extra: { 12345: new Uint8Array(padding) } }];
        offset += header + 4 + padding + bytes.length;
    }
    return zipSync(aligned, { level: 0 });
}

export async function exportAppleTapUSDZ(scene, { states, samples }) {
    const meshes = [];
    scene.traverseVisible(object => { if (object.isMesh) meshes.push(object); });
    const groups = appleMotionGroups(meshes, samples);
    const files = unzipSync(await new USDZExporter().parse(scene, { quickLookCompatible: true, maxTextureSize: 1024 }));
    let stage = strFromU8(files['model.usda']);
    const blocks = new Map();
    stage = stage.replace(/def Xform "Object_(\d+)" \([\s\S]*?\n}\n/g, (block, id) => {
        blocks.set(Number(id), block);
        return '';
    });
    if (blocks.size !== meshes.length) throw new Error('Apple export omitted desk surfaces.');

    const stateWrappers = states.map(() => []);
    const taps = states.map(() => ({ leg: [], wing: [] }));
    const rig = [];
    const handleGroups = [];
    for (const group of groups) {
        const plain = [], handles = [];
        for (const mesh of group.meshes) {
            if (appleTapPart(mesh.name)) handles.push(mesh);
            else plain.push(blocks.get(mesh.id));
        }
        const copies = [];
        for (let i = 0; handles.length && i < states.length; i++) {
            const wrapperPath = `${SCENE}/Rig/Handles_${group.name}/State_${i}`;
            stateWrappers[i].push(wrapperPath);
            const contents = handles.map(mesh => {
                // Only the currently active state's leg/wing surfaces have
                // nonzero scale. The next tap therefore selects one transition.
                const part = appleTapPart(mesh.name);
                taps[i][part].push(`${wrapperPath}/Object_${mesh.id}/Geometry`);
                return blocks.get(mesh.id);
            }).join('\n');
            copies.push(xform(`State_${i}`, i === 0 ? group.deltas[i] : HIDDEN, contents));
        }
        if (plain.length) rig.push(xform(group.name, IDENTITY, plain.join('\n')));
        if (copies.length) {
            // Never animate both a parent and its tap-state children. Quick
            // Look can overwrite inherited motion when a child's absolute
            // transform is activated at the end of the parent animation.
            rig.push(xform(`Handles_${group.name}`, IDENTITY, copies.join('\n')));
            handleGroups.push(group);
        }
        group.hasPlain = plain.length > 0;
    }
    if (!taps[0].leg.length || !taps[0].wing.length) throw new Error('Apple tap areas could not be identified.');

    const targets = [xform('HandleOff', HIDDEN)];
    const actions = [], behaviors = [];
    for (let i = 0; i < states.length; i++) {
        for (const group of groups) {
            const name = `Pose_${i}_${group.name}`;
            targets.push(xform(name, group.deltas[i]));
        }
        const off = `HandlesOff_${i}`;
        const inactive = stateWrappers.flatMap((paths, index) => index === i ? [] : paths);
        actions.push(transformAction(off, inactive, `${SCENE}/Targets/HandleOff`, 0));
        const selections = [`${SCENE}/Actions/${off}`];
        for (const group of handleGroups) {
            const on = `HandlesOn_${i}_${group.name}`;
            // The destination copy receives its FULL pose, not identity. Its
            // wrapper is a sibling of the animated plain parts, so both local
            // and world-space action interpretations preserve the endpoint.
            actions.push(transformAction(on, [`${SCENE}/Rig/Handles_${group.name}/State_${i}`],
                `${SCENE}/Targets/Pose_${i}_${group.name}`, 0));
            selections.push(`${SCENE}/Actions/${on}`);
        }
        actions.push(groupAction(`Select_${i}`, selections, 'parallel'));
    }
    for (let i = 0; i < states.length; i++) {
        for (const part of ['leg', 'wing']) {
            const destination = states[i][part];
            const transition = `${i}_${part}_${destination}`;
            const moves = [];
            for (const group of groups) {
                const affected = [];
                const moving = group.deltas.some(delta => delta.elements.some((n, k) => Math.abs(n - IDENTITY.elements[k]) >= 1e-6));
                if (group.hasPlain && moving) affected.push(`${SCENE}/Rig/${group.name}`);
                if (handleGroups.includes(group)) affected.push(`${SCENE}/Rig/Handles_${group.name}/State_${i}`);
                if (!affected.length) continue;
                const name = `Move_${transition}_${group.name}`;
                actions.push(transformAction(name, affected, `${SCENE}/Targets/Pose_${destination}_${group.name}`));
                moves.push(`${SCENE}/Actions/${name}`);
            }
            actions.push(groupAction(`Move_${transition}`, moves, 'parallel'));
            actions.push(groupAction(`Enter_${transition}`, [`${SCENE}/Actions/Move_${transition}`,
                `${SCENE}/Actions/Select_${destination}`], 'serial'));
            behaviors.push(`def Preliminary_Behavior "Tap_${part}_${i}"\n{\n` +
                'uniform bool exclusive = true\nrel triggers = [<Tap>]\n' +
                `rel actions = [<${SCENE}/Actions/Enter_${transition}>]\n` +
                'def Preliminary_Trigger "Tap"\n{\nuniform token info:id = "TapGesture"\n' +
                `rel affectedObjects = ${relation(taps[i][part])}\n}\n}\n`);
        }
    }
    const insertion = xform('Rig', IDENTITY, rig.join('\n')) +
        `def Scope "Targets"\n{\n${targets.join('\n')}\n}\n` +
        `def Scope "Actions"\n{\n${actions.join('\n')}\n}\n` +
        `def Scope "Behaviors"\n{\n${behaviors.join('\n')}\n}\n`;
    const anchorLine = 'token preliminary:planeAnchoring:alignment = "horizontal"';
    if (!stage.includes(anchorLine)) throw new Error('Apple export anchor was not found.');
    stage = stage.replace(anchorLine, anchorLine + '\n' + insertion);
    stage = stage.replace('upAxis = "Y"', 'upAxis = "Y"\n\tautoPlay = false');
    files['model.usda'] = strToU8(stage);
    // Trim is an open surface: allow either face to appear while tilting.
    const patchedGeometry = new Set();
    for (const mesh of meshes) {
        const name = `geometries/Geometry_${mesh.geometry.id}.usda`;
        if (mesh.material.side === 2 && files[name] && !patchedGeometry.has(name)) {
            files[name] = strToU8(strFromU8(files[name]).replace('uniform token subdivisionScheme', 'uniform bool doubleSided = true\n\t\tuniform token subdivisionScheme'));
            patchedGeometry.add(name);
        }
    }
    return { bytes: packAligned(files), stats: { states, groups: groups.length, meshes: meshes.length,
        legSurfaces: taps[0].leg.length, wingSurfaces: taps[0].wing.length, behaviors: behaviors.length } };
}
