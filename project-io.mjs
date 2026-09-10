// Project file schema and validation.
//
// Pure: no DOM, no Three.js, no scene access. Everything here is a decision
// about whether a file is safe to apply, made before anything is mutated, so
// that a bad import can be refused with the scene untouched. studio.js owns the
// applying; this module owns the answering of "should we".

export const PROJECT_FORMAT_VERSION = 1;

// A hard problem means the file cannot be applied at all. A soft one means it
// probably can, but the user should be told what they are about to lose.
const hard = (code, message) => ({ severity: 'hard', code, message });
const soft = (code, message) => ({ severity: 'soft', code, message });

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTRS(value) {
    return isPlainObject(value)
        && ['p', 'q', 's'].every(key => isPlainObject(value[key]))
        && Number.isFinite(value.p.x) && Number.isFinite(value.p.y) && Number.isFinite(value.p.z)
        && Number.isFinite(value.q.x) && Number.isFinite(value.q.y) && Number.isFinite(value.q.z) && Number.isFinite(value.q.w)
        && Number.isFinite(value.s.x) && Number.isFinite(value.s.y) && Number.isFinite(value.s.z);
}

/**
 * Decide whether a parsed project file can be applied.
 *
 * The staged registry is the crux. Validating references against the live scene
 * would reject a project's own clones, which do not exist yet — and because the
 * live registry also holds the CURRENT project's clones, re-importing the same
 * file would collide with itself while a reference to some unrelated current
 * clone would wrongly resolve. An import replaces project state, so the current
 * clones are about to cease existing: stage against pristine asset parts only.
 *
 * @param {unknown} project        parsed JSON, untrusted
 * @param {object}  scene
 * @param {Set<string>} scene.assetIds    editorIds of parts that came from the GLB
 * @param {string}  scene.modelUrl
 * @param {string|null} scene.modelFingerprint
 * @returns {{ok: boolean, problems: Array, stagedIds: Set<string>, cloneOrder: Array}}
 */
export function validateProjectFile(project, { assetIds, modelUrl, modelFingerprint }) {
    const problems = [];
    const fail = () => ({ ok: false, problems, stagedIds: new Set(), cloneOrder: [] });

    if (!isPlainObject(project)) {
        problems.push(hard('not-an-object', 'This file is not an ErgoFlex project.'));
        return fail();
    }
    if (project.formatVersion !== PROJECT_FORMAT_VERSION) {
        problems.push(hard('format-version',
            `Project format ${project.formatVersion ?? 'unknown'} cannot be read by this version (expected ${PROJECT_FORMAT_VERSION}).`));
        return fail();
    }
    if (!isPlainObject(project.model) || typeof project.model.url !== 'string') {
        problems.push(hard('no-model', 'The project does not say which model it was built from.'));
        return fail();
    }
    if (project.model.url !== modelUrl) {
        problems.push(hard('model-url',
            `Built from a different model (${project.model.url}). Part identities would not line up.`));
        return fail();
    }

    const parts = isPlainObject(project.parts) ? project.parts : {};
    const clones = Array.isArray(parts.clones) ? parts.clones : [];

    // --- staged registry: pristine asset parts plus this project's clones ---
    const stagedIds = new Set(assetIds);
    const cloneIds = new Set();
    for (const clone of clones) {
        if (!isPlainObject(clone) || typeof clone.editorId !== 'string' || !clone.editorId) {
            problems.push(hard('clone-shape', 'A clone entry is missing its editorId.'));
            return fail();
        }
        if (assetIds.has(clone.editorId)) {
            problems.push(hard('clone-shadows-asset',
                `Clone "${clone.editorId}" would shadow a part that came from the model.`));
            return fail();
        }
        if (cloneIds.has(clone.editorId)) {
            problems.push(hard('duplicate-clone', `Clone "${clone.editorId}" appears more than once.`));
            return fail();
        }
        cloneIds.add(clone.editorId);
        stagedIds.add(clone.editorId);
        if (clone.transform !== undefined && !isTRS(clone.transform)) {
            problems.push(hard('clone-transform', `Clone "${clone.editorId}" has an unreadable transform.`));
            return fail();
        }
    }

    // Sources and parents must resolve, and clones may derive from other clones,
    // so the graph has to be orderable before any of them can be created.
    for (const clone of clones) {
        if (!stagedIds.has(clone.sourceEditorId)) {
            problems.push(hard('clone-source',
                `Clone "${clone.editorId}" derives from "${clone.sourceEditorId}", which is not in this project.`));
            return fail();
        }
        if (clone.parentEditorId && clone.parentEditorId !== 'model' && !stagedIds.has(clone.parentEditorId)) {
            problems.push(hard('clone-parent',
                `Clone "${clone.editorId}" is parented to "${clone.parentEditorId}", which is not in this project.`));
            return fail();
        }
    }

    const cloneOrder = topologicalCloneOrder(clones, cloneIds);
    if (!cloneOrder) {
        problems.push(hard('clone-cycle', 'Clones in this project derive from each other in a loop.'));
        return fail();
    }

    // --- every other reference must resolve in the staged set ---
    const unresolved = new Set();
    const check = ids => { for (const id of ids || []) if (!stagedIds.has(id)) unresolved.add(id); };

    check(parts.liftMembers);
    check(parts.locked);
    check((parts.transforms || []).map(t => t?.editorId));
    check((parts.labels || []).map(entry => Array.isArray(entry) ? entry[0] : null).filter(Boolean));
    for (const ids of Object.values(isPlainObject(parts.groups) ? parts.groups : {})) check(ids);

    const rigs = isPlainObject(project.rigs) ? project.rigs : {};
    for (const config of rigs.tilt || []) check(config?.groupEditorIds);
    for (const rig of rigs.actuator || []) {
        check(rig?.cylinderEditorIds);
        check(rig?.rodEditorIds);
        if (rig?.targetEditorId) check([rig.targetEditorId]);
    }

    for (const transform of parts.transforms || []) {
        if (!isTRS(transform?.delta)) {
            problems.push(hard('transform-shape',
                `The saved edit for "${transform?.editorId}" is unreadable.`));
            return fail();
        }
    }

    // Unresolved references are soft: the project is structurally sound and most
    // of it will apply. Say exactly how much will not.
    if (unresolved.size) {
        problems.push(soft('unresolved-parts',
            `${unresolved.size} referenced part${unresolved.size === 1 ? '' : 's'} ` +
            `${unresolved.size === 1 ? 'is' : 'are'} not in the current model and will be skipped.`));
    }

    // Fingerprint mismatch is soft by design. The asset changed, but the project
    // may still be largely valid, so report and let the user decide.
    const saved = project.model.contentFingerprint;
    if (saved && modelFingerprint && saved !== modelFingerprint) {
        problems.push(soft('fingerprint',
            'The 3D model has changed since this project was saved. Positions and rig pivots may no longer line up.'));
    } else if (saved && !modelFingerprint) {
        problems.push(soft('fingerprint-unavailable',
            'The model could not be fingerprinted, so it was not checked against the project.'));
    }

    return { ok: true, problems, stagedIds, cloneOrder };
}

// Kahn's algorithm over clone -> {source, parent} edges, restricted to edges
// between clones (asset parts are already present, so they are not constraints).
// Returns null on a cycle.
function topologicalCloneOrder(clones, cloneIds) {
    const byId = new Map(clones.map(clone => [clone.editorId, clone]));
    const pending = new Map();
    const dependents = new Map();

    for (const clone of clones) {
        const deps = [clone.sourceEditorId, clone.parentEditorId].filter(id => cloneIds.has(id));
        pending.set(clone.editorId, new Set(deps));
        for (const dep of deps) {
            if (!dependents.has(dep)) dependents.set(dep, []);
            dependents.get(dep).push(clone.editorId);
        }
    }

    const ready = clones.filter(clone => pending.get(clone.editorId).size === 0).map(clone => clone.editorId);
    const order = [];
    while (ready.length) {
        const id = ready.shift();
        order.push(byId.get(id));
        for (const dependent of dependents.get(id) || []) {
            const deps = pending.get(dependent);
            deps.delete(id);
            if (deps.size === 0) ready.push(dependent);
        }
    }
    return order.length === clones.length ? order : null;
}

export function hardProblems(problems) { return problems.filter(p => p.severity === 'hard'); }
export function softProblems(problems) { return problems.filter(p => p.severity === 'soft'); }
