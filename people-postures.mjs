// Per-person, per-model corrections. Storage never chooses or adds a rendered model.
// Reading legacy data is a view; only an explicit write migrates it. In particular,
// do not pass existing quaternions/keys through the lossy editor cleaners here.
import {poseAt} from './people-pose-keys.mjs';

const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
export function postureRecord(entry, id = entry?.id) {
    const record = entry?.postures?.[id];
    const legacy = id === entry?.id && !entry?.variant ? entry : null;
    return {
        ...(own(record, 'pose') ? {pose: record.pose} : legacy?.pose !== undefined ? {pose: legacy.pose} : {}),
        ...(own(record, 'poseKeys') ? {poseKeys: record.poseKeys} : legacy?.poseKeys !== undefined ? {poseKeys: legacy.poseKeys} : {})
    };
}
// Validation at import boundaries without the editor cleaner's quantization,
// sorting, merging, or key limits. Existing valid numeric data stays exact.
export function archivedPoseKeys(value) {
    if(!Array.isArray(value))return undefined;
    return structuredClone(value.filter(k=>k&&Number.isFinite(k.t)&&k.t>=0&&k.t<=36000&&k.pose&&typeof k.pose==='object'&&!Array.isArray(k.pose)&&Object.keys(k.pose).length&&Object.values(k.pose).every(q=>Array.isArray(q)&&q.length===4&&q.every(Number.isFinite)&&Math.hypot(...q)>1e-6)));
}
// The same for a pose: only the shape is checked (a bone name, four finite numbers that are not all zero); the numbers
// are kept exactly as they are.
const BONE=/^[A-Za-z][A-Za-z0-9_]{0,39}$/, MODEL=/^people-[a-z0-9][a-z0-9._-]{0,90}$/i;
export function archivedPose(value) {
    if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
    const out={};
    for(const [name,q] of Object.entries(value))if(BONE.test(name)&&Array.isArray(q)&&q.length===4&&q.every(Number.isFinite)&&Math.hypot(...q)>1e-6)out[name]=[...q];
    return Object.keys(out).length?out:undefined;
}
export function validateArchivedKeys(entry) {
    if(entry.postures!==undefined){
        if(entry.postures&&typeof entry.postures==='object'&&!Array.isArray(entry.postures))entry.postures=Object.fromEntries(Object.entries(entry.postures).filter(([id,r])=>MODEL.test(id)&&r&&typeof r==='object'&&!Array.isArray(r)));
        else delete entry.postures;
    }
    for(const record of [entry,...Object.values(entry.postures||{})]) {
        if(!record||typeof record!=='object')continue;
        if(record.pose!==undefined&&record.pose!==null){const pose=archivedPose(record.pose);if(pose)record.pose=pose;else delete record.pose;}
        if(record.poseKeys===undefined||record.poseKeys===null)continue;
        const keys=archivedPoseKeys(record.poseKeys);
        if(keys)record.poseKeys=keys;else delete record.poseKeys;
    }
    return entry;
}
export function migratePostures(entry) {
    const out = structuredClone(entry);
    if (own(entry, 'pose') || own(entry, 'poseKeys')) {
        out.postures ||= {};
        out.postures[entry.id] = {...postureRecord(entry), ...out.postures[entry.id]};
        delete out.pose; delete out.poseKeys;
    }
    return out;
}
export function postureView(entry, id = entry?.id) {
    if (!entry) return null;
    return {...entry, id, pose: undefined, poseKeys: undefined, ...postureRecord(entry, id)};
}
// Mutates the caller's transaction copy only. Keep empty records: they explicitly
// clear a legacy correction, and may later carry solver/sequence metadata.
export function editPosture(entry, id, change) {
    const next = migratePostures(entry);
    next.postures ||= {};
    const record = next.postures[id] ||= {};
    change(record);
    delete entry.pose; delete entry.poseKeys;
    entry.postures = next.postures;
}
export function postureRecords(entry) {
    const ids = new Set(Object.keys(entry?.postures || {}));
    if (entry?.pose !== undefined || entry?.poseKeys !== undefined) ids.add(entry.id);
    return [...ids].map(id => [id, postureRecord(entry, id)]);
}
export const hasPosturePose = entry => postureRecords(entry).some(([, p]) => p.pose && Object.keys(p.pose).length || p.poseKeys?.length);
export const sourceOf = spec => ({key: spec.key || spec.variant || spec.id, id: spec.id, ...(spec.station ? {station: spec.station} : {})});
export const matchesSource = (source, spec) => !!source && source.key === (spec.key || spec.variant || spec.id) && (source.id === spec.id || source.key === spec.variant) && (source.station || '') === (spec.station || '');
export function roomEditKey(source) {
    let hash = 2166136261;
    for (const c of JSON.stringify(source)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
    return `room-${/^people-([a-z]+)-/.exec(source.id)?.[1] || 'person'}-${hash.toString(36)}`;
}

// Only the existing featured-desk actor has a proven cross-provenance identity:
// RoomPeople.cast already groups it by character. Never infer for free placements
// or station crews; ambiguous matches must remain separate editable people.
export function poseOwner(spec, cast, character = id => /^people-([a-z]+)-/.exec(id || '')?.[1]) {
    if (spec.extra) return cast.find(e => !e.poseSource && (e.key || e.id) === (spec.key || spec.variant || spec.id)) || null;
    const bound = cast.filter(e => matchesSource(e.poseSource, spec) || e.poseBindings?.some(s => matchesSource(s, spec)));
    if (bound.length) return bound.length === 1 ? bound[0] : null;
    if (!spec.desk || spec.station || spec.variant) return null;
    const who = character(spec.id);
    const candidates = who ? cast.filter(e => !e.poseSource && e.desk && !e.station && character(e.id) === who) : [];
    return candidates.length === 1 ? candidates[0] : null;
}

// Pure editor projection. Room bindings are persisted only on the next user edit.
export function editablePeople(people, resolved = []) {
    const out = structuredClone(people), cast = out.cast ||= [];
    for (const e of resolved.filter(e => e.poseSource)) {
        const owner = cast.find(x => x.key === e.key);
        if (owner) {
            if (!matchesSource(owner.poseSource,e.poseSource) && !owner.poseBindings?.some(s => matchesSource(s, e.poseSource))) {
                owner.poseBindings ||= [];
                owner.poseBindings.push(structuredClone(e.poseSource));
            }
        } else cast.push(structuredClone(e));
    }
    return out;
}

// Blend corrections only after a person has explicitly acquired multiple stores.
// The caller supplies the SAME progress used by its existing posture solver.
// A migrated single-store cut continues using its displayed-model correction.
export function blendPosturePoses(a, b, w) {
    if (w <= 0) return a; if (w >= 1) return b;
    const out = {}, identity = [0, 0, 0, 1];
    for (const bone of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
        const qa = a?.[bone] || identity, qb = b?.[bone] || identity;
        // poseAt already implements shortest-arc quaternion interpolation.
        out[bone] = poseAt({poseKeys: [{t: 0, pose: {[bone]: qa}, ease: 'linear'}, {t: 1, pose: {[bone]: qb}}]}, w)[bone];
    }
    return Object.keys(out).length ? out : null;
}
