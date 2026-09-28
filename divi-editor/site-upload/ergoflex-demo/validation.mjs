// Build validation.
//
// ADVISORY BY DEFAULT. Nothing here blocks an order unless a rule is explicitly
// promoted, and a rule may only be promoted when (a) its limit comes from the
// real product specification rather than an estimate, and (b) it has a passing
// test on a known-bad and a known-good configuration. A validator that blocks
// good builds is as damaging as one that passes bad ones.
//
// Pure: it takes a description of the scene, not the scene itself, so it is
// tested directly in Node.

import { ACCESSORIES, accessory, accessoryFits, incompatibleAccessories } from './catalog.mjs';

// Limits that would gate an order. NONE of these are confirmed product
// specifications, so every rule that uses them ships advisory. Fill them in
// from the real spec and set `blocking: true` on the rule to promote it.
export const LIMITS = {
    actuatorStroke: { min: null, max: null, source: 'unconfirmed' },
    minimumClearance: { value: null, source: 'unconfirmed' },
    mountingPoints: { value: null, source: 'unconfirmed' }
};

// Contacts that are meant to happen. Without this list every configuration
// reports as one large collision, because a fastener sits inside its hole and a
// column sits inside a column.
export const INTENDED_CONTACT = [
    ['column', 'column'],
    ['column', 'actuator'],
    ['actuator', 'hardware'],
    ['hardware', 'hardware'],
    ['hardware', 'desktop'],
    ['hardware', 'shelf'],
    ['hardware', 'column'],
    ['wheel', 'column'],
    ['wheel', 'hardware'],
    ['desktop', 'shelf'],
    ['desktop', 'desktop'],
    // Observed on the reference assembly and correct: the desktop is bolted to
    // the lift columns, and the actuator's top clevis mounts beneath it. Both
    // showed up as candidates on a clean build, which is what an exclusion list
    // is for. Deliberately NOT excluded: desktop-to-wheel, which would be real.
    ['desktop', 'column'],
    ['desktop', 'actuator'],
    ['shelf', 'column'],
    ['shelf', 'actuator'],
    ['shelf', 'shelf'],
    ['wheel', 'wheel'],
    ['actuator', 'actuator']
];

const contactAllowed = (a, b) =>
    INTENDED_CONTACT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// Combinations known not to work, independent of geometry.
export const INCOMPATIBLE = [
    { when: { accessory: 'monitor-arm-2', size: '48x30' },
      reason: 'The dual monitor arm needs a 60in or wider top for its mounting spread.' }
];

const finding = (severity, code, message, extra = {}) =>
    ({ severity, code, message, blocking: false, ...extra });

/**
 * @param {object} config   {size, woodFinish, baseFinish, accessories[]}
 * @param {object} scene    optional measurements:
 *   {actuators: [{name, lengths: number[]}], overlaps: [{a, b, aRole, bRole, amount}],
 *    warnings: [{code, message}]}
 * @returns {Array} findings, most severe first
 */
export function validateBuild(config, scene = {}) {
    const findings = [];

    // 1. Actuator travel.
    //
    // Sampling the lift alone measures almost nothing here: the solver offsets
    // the actuator base by the lift and the target is itself a lift member, so
    // both endpoints translate together and the length barely changes. Tilt is
    // what actually changes travel. The caller is expected to sample the lift x
    // tilt grid; this checks whatever it measured.
    for (const rig of scene.actuators || []) {
        const lengths = rig.lengths || [];
        if (lengths.length < 2) continue;
        const min = Math.min(...lengths), max = Math.max(...lengths);
        const required = max - min;
        if (LIMITS.actuatorStroke.max == null) {
            findings.push(finding('info', 'actuator-stroke-unknown',
                `${rig.name} needs ${required.toFixed(3)} units of travel. No confirmed stroke limit to check it against.`,
                { parts: [rig.name], source: 'measured' }));
        } else if (required > LIMITS.actuatorStroke.max) {
            findings.push(finding('warning', 'actuator-stroke',
                `${rig.name} needs ${required.toFixed(3)} of travel, beyond its ${LIMITS.actuatorStroke.max} stroke.`,
                { parts: [rig.name] }));
        }
    }

    // 2. Collision candidates. Coarse boxes produce candidates for review, never
    //    a verdict, and contacts on the intended list are filtered out.
    for (const overlap of scene.overlaps || []) {
        if (contactAllowed(overlap.aRole, overlap.bRole)) continue;
        findings.push(finding('warning', 'collision-candidate',
            `${overlap.a} and ${overlap.b} may overlap by ${overlap.amount?.toFixed?.(3) ?? '?'} units. Worth checking.`,
            { parts: [overlap.a, overlap.b] }));
    }

    // 3. Unsupported combinations, from a declarative table.
    for (const rule of INCOMPATIBLE) {
        const wantsAccessory = !rule.when.accessory || (config.accessories || []).includes(rule.when.accessory);
        const matchesSize = !rule.when.size || config.size === rule.when.size;
        if (wantsAccessory && matchesSize) {
            findings.push(finding('error', 'incompatible', rule.reason,
                { parts: [rule.when.accessory].filter(Boolean) }));
        }
    }

    // 4. An accessory that does not fit the chosen size.
    for (const item of incompatibleAccessories(config)) {
        findings.push(finding('error', 'accessory-size',
            `${item.name} is not available for the ${config.size} desk.`, { parts: [item.id] }));
    }

    // 5. Mounting-point budget.
    const mounted = (config.accessories || []).filter(id => accessory(id)?.node !== undefined).length;
    if (LIMITS.mountingPoints.value != null && mounted > LIMITS.mountingPoints.value) {
        findings.push(finding('warning', 'mounting-budget',
            `${mounted} accessories exceed the ${LIMITS.mountingPoints.value} available mounting points.`));
    }

    // 6. Problems the app already detects and used to log only to the console.
    for (const warning of scene.warnings || []) {
        findings.push(finding('warning', warning.code || 'scene-warning', warning.message, { parts: warning.parts }));
    }

    const rank = { error: 0, warning: 1, info: 2 };
    return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// Errors block only once a rule has been promoted. Until the product spec
// arrives this returns nothing, and the UI stays advisory.
export function blockingFindings(findings) {
    return findings.filter(f => f.severity === 'error' && f.blocking);
}

// A cache key. Size alone is not enough: editing a part's position changes the
// geometry the rules run against while size, rigs and accessories all stay put,
// so the edit revision has to be in here.
export function validationCacheKey({ fingerprint, size, editRevision, rigSignature, accessories, warningRevision }) {
    return [fingerprint || 'no-model', size, editRevision, rigSignature || '',
            [...(accessories || [])].sort().join('+'),
            // A newly detected scene problem changes the answer without touching
            // size, rigs or accessories, so it has to be in the key too.
            warningRevision || 0,
            JSON.stringify(LIMITS)].join('|');
}
