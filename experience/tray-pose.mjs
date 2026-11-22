// Keyboard tray pose model: joints, limits, keys and the one sampler (docs/keyboard-tray/SPEC.md sections 0.1, 2.3, 4, 6.5).
//
// A chapter may carry shot.trayEdits = [ { desk?, initial?, keys: [ { id, t, pose, ease?, route?, label? }, ... ] } ].
//   pose   {slide, swing, tilt, drop}, any subset: a key names only the joints it changes, the rest keep the value they
//          had at the key before (or `initial`, or the rest pose). Units and ranges: tray-limits.mjs.
//   t      chapter seconds (the clock of clips and people pose keys).
//   ease   how the key LEAVES toward the next: 'smooth' (default, smoothstep), 'linear' or 'hold' (stays, then jumps).
//   route  'auto' (default: joints move together if that is allowed, else staged in a safe order) or 'direct'.
// At 0 s the tray is at `initial` (an implicit key at 0 s), so it eases from there to the first key. After the last key it
// holds. NO edit, or an edit whose keys all name the rest pose, is today's rigid tray: sampleTray returns the rest pose.
//
// Stored keys are held to the joints' HARD limits only. The coupling between joints (tray-limits.mjs) is applied when
// sampling, never destructively, so a key outside the allowed set still shows a clamped tray, and trayIssues says where.
//
// Pure: no three.js, no DOM. The Director's panels, the stage, the film (film-fx) and the node tests share it.
import { JOINT_LIMITS, SLIDE_COUPLING, SWING_TILT, UNDER_RAMPS, RIDER_MM, RIDER_UNKNOWN_MM, PLATE_BELOW_TRACK_MM, RIDER_CLEARANCE_MM, DROP_ENABLED } from './tray-limits.mjs';

export const JOINTS = ['slide', 'swing', 'tilt', 'drop'];
const DECIMALS = { slide: 4, swing: 2, tilt: 2, drop: 1 };
const UNITS = { slide: '', swing: 'deg', tilt: 'deg', drop: 'mm' };
const LABELS = { slide: 'Slide', swing: 'Swing', tilt: 'Tilt', drop: 'Drop' };
export const TRAY_JOINTS = Object.freeze(JOINTS.map(id => Object.freeze({ id, label: LABELS[id], unit: UNITS[id], min: JOINT_LIMITS[id][0], max: JOINT_LIMITS[id][1], rest: 0, decimals: DECIMALS[id] })));
export const EASES = ['smooth', 'linear', 'hold'];
export const ROUTES = ['auto', 'direct'];
export const KEY_SNAP = 1 / 60;                 // two keys nearer than this are one key (the people pose keys' rule)
export const MAX_KEYS = 64;
export const MAX_EDITS = 16;
const MAX_T = 3600, EPS = 1e-9, ROUTE_SAMPLES = 25;
export const REST = Object.freeze({ slide: 0, swing: 0, tilt: 0, drop: 0 });
export const restPose = () => ({ ...REST });

const finite = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, n) => { const k = 10 ** n; return Math.round(v * k) / k + 0; };   // (+ 0: no minus zero in the file)
const r3 = v => round(v, 3);
const lerp = (a, b, k) => a + (b - a) * k;
const ramp = (x, [a, b]) => clamp((x - a) / (b - a), 0, 1);
const smooth = k => k * k * (3 - 2 * k);
const DESK_ID = /^[a-z][a-z0-9-]{0,79}$/, KEY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

// ---- poses --------------------------------------------------------------------------------------------------------
// A pose held to the hard limits and rounded. partial: only the joints named (null when none); otherwise every joint,
// the rest value for the ones not named (null or junk = the rest pose).
export function cleanTrayPose(v, { partial = false } = {}) {
    const out = {}, src = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    for (const j of JOINTS) {
        if (finite(src[j])) out[j] = round(clamp(src[j], JOINT_LIMITS[j][0], JOINT_LIMITS[j][1]), DECIMALS[j]);
        else if (!partial) out[j] = REST[j];
    }
    return partial && !Object.keys(out).length ? null : out;
}
// The same without the rounding: what the sampler works in, so a sampled path is not stepped by the storage precision.
const holdPose = v => { const out = {}, src = v && typeof v === 'object' ? v : {}; for (const j of JOINTS) out[j] = finite(src[j]) ? clamp(src[j], JOINT_LIMITS[j][0], JOINT_LIMITS[j][1]) + 0 : REST[j]; return out; };
const isRest = pose => JOINTS.every(j => Math.abs((pose?.[j] ?? 0) - REST[j]) < EPS);
export const isRestPose = isRest;
const samePose = (a, b) => JOINTS.every(j => Math.abs(a[j] - b[j]) < EPS);

// ---- limits and coupling ------------------------------------------------------------------------------------------
function table(rows, key, x, pick) {            // piecewise linear through the rows, held outside them
    if (x <= rows[0][key]) return pick(rows[0]);
    for (let i = 1; i < rows.length; i++) {
        if (x <= rows[i][key]) { const a = rows[i - 1], b = rows[i], k = (x - a[key]) / (b[key] - a[key]); return pick(a).map((v, n) => lerp(v, pick(b)[n], k)); }
    }
    return pick(rows[rows.length - 1]);
}
const slideLimits = slide => { const [swing, lo, hi] = table(SLIDE_COUPLING, 'slide', slide, r => [r.swing, ...r.tilt]); return { swing, tilt: [lo, hi] }; };
const swingTilt = swing => table(SWING_TILT, 'swing', Math.abs(swing), r => r.tilt);
// How far the plate is under the desk, 0..1 (0 for the authored pose).
export const underDesk = pose => Math.max(ramp(pose?.slide ?? 0, UNDER_RAMPS.slide), ramp(Math.abs(pose?.swing ?? 0), UNDER_RAMPS.swing));
// The thickest thing that rides on the plate, mm (0 when nothing does): from prop ids, the unknown ones count as a thick keyboard.
export const riderThicknessMm = ids => (ids || []).reduce((m, id) => Math.max(m, RIDER_MM[id] ?? RIDER_UNKNOWN_MM), 0);
// The drop a rider needs before the plate may go under the desktop: its thickness, less the 19.7 mm the plate already
// hangs, plus a little air; 0 for no rider. (28.3 mm for the 45 mm ergo keyboard, 40.2 mm for the gaming mouse.)
export const dropNeededMm = riderMm => riderMm > 0 ? Math.max(0, riderMm - PLATE_BELOW_TRACK_MM + RIDER_CLEARANCE_MM) : 0;

// Does a rider of this thickness fit under the desktop at the CAD's plate drop (19.7 mm under the track, less a little air)? A thin one
// (under about 17 mm) does; every keyboard and mouse of the library is thicker.
export const riderFitsUnder = riderMm => !(riderMm > PLATE_BELOW_TRACK_MM - RIDER_CLEARANCE_MM);
// The pose after the coupling. Order: drop (hard limit; 0..0 unless the drop joint is on), slide, swing (given the slide), tilt (given slide
// and swing). Returns the pose and the limits each joint was held to.
// opts.riderMm: thickness of what stands on the plate (0 = nothing). opts.dropEnabled (default DROP_ENABLED = false, tray-limits.mjs;
// sampleTray / trayIssues turn it on for an edit with bracket: true).
//   The rider clears the desktop when it fits at the CAD's drop, or when the drop joint (on, and keyed) is at least dropNeededMm. Until
//   then the plate may not go under the desk: slide <= the first value of UNDER_RAMPS.slide, |swing| <= that of UNDER_RAMPS.swing. Nothing
//   lowers the tray by itself: a drop only happens where a key asks for it.
function chain(pose, opts) {
    const riderMm = opts?.riderMm || 0, dropOn = opts?.dropEnabled ?? DROP_ENABLED, p = holdPose(pose), limits = {};
    limits.drop = dropOn ? [...JOINT_LIMITS.drop] : [0, 0]; p.drop = clamp(p.drop, ...limits.drop);
    const blocked = !(riderFitsUnder(riderMm) || p.drop >= dropNeededMm(riderMm) - 1e-9);
    limits.slide = [JOINT_LIMITS.slide[0], blocked ? UNDER_RAMPS.slide[0] : JOINT_LIMITS.slide[1]]; p.slide = clamp(p.slide, ...limits.slide);
    const s = slideLimits(p.slide), swingMax = blocked ? Math.min(s.swing, UNDER_RAMPS.swing[0]) : s.swing;
    limits.swing = [0 - swingMax, swingMax]; p.swing = clamp(p.swing, ...limits.swing);
    const w = swingTilt(p.swing);
    limits.tilt = [Math.max(s.tilt[0], w[0]), Math.min(s.tilt[1], w[1])]; p.tilt = clamp(p.tilt, ...limits.tilt);
    return { pose: p, limits };
}
// What each joint may do given the others: { slide:[lo,hi], swing, tilt, drop }. opts.riderMm: thickness of the keyboard /
// mouse on the plate (0 = none). The limits of a joint depend only on the joints before it in the order above.
export const limitsFor = (pose, opts = {}) => chain(pose, opts).limits;
// A pose held to the hard limits and the coupling (a fresh object). Rest stays rest; a tray with no rider is never lowered.
export const clampTrayPose = (pose, opts = {}) => chain(pose, opts).pose;
// The joints the coupling had to change (for the lane's warning). A drop held to 0 because the joint is off is named too (a keyed drop
// that does nothing is worth saying); with a rider the slide and swing that would take it under the desk are named.
export function clampedJoints(pose, opts = {}) { const raw = holdPose(pose), c = clampTrayPose(raw, opts); return JOINTS.filter(j => Math.abs(raw[j] - c[j]) > 1e-6); }

// ---- keys ---------------------------------------------------------------------------------------------------------
// The keys as they are stored: sorted, keys closer than KEY_SNAP merged (the later key's joints, ease, route and label
// win), at most MAX_KEYS, every key with a unique id. Always an array.
export function cleanTrayKeys(v) {
    if (!Array.isArray(v)) return [];
    const keys = [];
    for (const raw of v) {
        if (!raw || typeof raw !== 'object' || !finite(raw.t) || raw.t < 0 || raw.t > MAX_T) continue;
        const pose = cleanTrayPose(raw.pose, { partial: true }); if (!pose) continue;
        const key = {}; if (typeof raw.id === 'string' && KEY_ID.test(raw.id)) key.id = raw.id;
        key.t = r3(raw.t); key.pose = pose;
        if (EASES.includes(raw.ease) && raw.ease !== 'smooth') key.ease = raw.ease;
        if (ROUTES.includes(raw.route) && raw.route !== 'auto') key.route = raw.route;
        if (typeof raw.label === 'string' && raw.label.trim()) key.label = raw.label.trim().slice(0, 40);
        keys.push(key);
    }
    keys.sort((a, b) => a.t - b.t);
    const out = [];
    for (const key of keys) {
        const last = out[out.length - 1];
        if (last && key.t - last.t < KEY_SNAP - 1e-9) {
            Object.assign(last.pose, key.pose);
            for (const f of ['ease', 'route', 'label']) { if (key[f] !== undefined) last[f] = key[f]; else if (f !== 'label') delete last[f]; }
        } else out.push(key);
    }
    const kept = out.slice(0, MAX_KEYS), used = new Set();
    for (const k of kept) if (k.id && !used.has(k.id)) used.add(k.id); else delete k.id;
    let n = 1; return kept.map(k => { if (!k.id) { while (used.has('k' + n)) n++; used.add('k' + n); } return { id: k.id || 'k' + n, ...Object.fromEntries(Object.entries(k).filter(([f]) => f !== 'id')) }; });
}
// One edit as it is stored, or null when it says nothing: { desk?, initial?, keys? }. `initial` holds only joints off the
// rest pose (a rest joint in it means nothing); absent = the rigid pose.
export function cleanTrayEdit(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    const out = {}; if (typeof e.desk === 'string' && DESK_ID.test(e.desk)) out.desk = e.desk;
    if (e.bracket === true) out.bracket = true;       // setup, not motion: the optional mount bracket (and with it the drop joint) for this edit; absent = off
    const init = cleanTrayPose(e.initial, { partial: true });
    if (init) { for (const j of JOINTS) if (j in init && Math.abs(init[j] - REST[j]) < EPS) delete init[j]; if (Object.keys(init).length) out.initial = init; }
    const keys = cleanTrayKeys(e.keys); if (keys.length) out.keys = keys;
    return out.keys || out.initial || out.bracket ? out : null;
}
// The shot field, as cleanDeskEdits does it: nothing when the shot has none (so an untouched chapter's cut is byte-identical);
// otherwise the cleaned edits, one per desk (the later one wins), at most MAX_EDITS. A present empty list stays (it replaces
// the film's own sceneTray with "none", the rule of deskEdits).
export function cleanTrayEdits(v = {}) {
    if (!Array.isArray(v?.trayEdits)) return {};
    const by = new Map();
    for (const e of v.trayEdits.slice(0, MAX_EDITS * 4).map(cleanTrayEdit)) if (e) by.set(e.desk || '', e);
    return { trayEdits: [...by.values()].slice(0, MAX_EDITS) };
}
// The edit that applies to a desk: the one naming it, else the one naming none, else null.
export const pickTrayEdit = (edits, desk) => { const list = Array.isArray(edits) ? edits : []; return list.find(e => desk && e.desk === desk) || list.find(e => !e.desk) || null; };
// Is the rig needed at all? Only when an edit has a key or starts off the rest pose.
export const trayActive = edit => !!edit && (!!edit.keys?.length || !!edit.initial && !isRest(holdPose(edit.initial)));
export const trayKeyTimes = edit => (Array.isArray(edit?.keys) ? edit.keys : []).map(k => k.t).sort((a, b) => a - b);
export const trayKeyedJoints = edit => { const out = new Set(); for (const k of edit?.keys || []) for (const j of Object.keys(k.pose || {})) out.add(j); return JOINTS.filter(j => out.has(j)); };

// ---- the film's side of the shot field (the rule of experience/desk-edits.mjs) -----------------------------------------
// The film shot's own tray keys (an earlier Export cut, imported by build-round8-director.py as director-camera 'tray') are the
// Director's edits until the chapter has trayEdits of its own; present (even []), those replace them. A chapter with neither has
// no tray motion at all: nothing below returns anything for it, and no rig is ever loaded.
export const filmTrayEdits = film => (Array.isArray(film?.sceneTray) ? film.sceneTray : []).map(cleanTrayEdit).filter(Boolean);
export const effectiveTrayEdits = (film, shot) => Array.isArray(shot?.trayEdits) ? structuredClone(shot.trayEdits) : filmTrayEdits(film);
// The chapter's film fields for Render still and the renderer ({} = the film's as they are).
export const mergeTrayEdits = (film, shot) => Array.isArray(shot?.trayEdits) ? { sceneTray: structuredClone(shot.trayEdits) } : {};
// The one edit that moves the tray of this shot (preset = the desk model of the shot or sub-shot), or null: the only question the
// stage and film-fx ask before they load anything.
export const activeTrayEdit = (edits, preset) => { const e = pickTrayEdit(edits, preset); return trayActive(e) ? e : null; };

// ---- travel between two poses -------------------------------------------------------------------------------------
const FULL = JOINTS.reduce((o, j) => { o[j] = [0, 1]; return o; }, {});
// Staging windows (fractions of the segment, spec 6.5), chosen per joint by the direction it moves: moves that RELAX the
// coupling go first, moves that TIGHTEN it go last. Relaxing: slide out, swing toward the front, tilt toward level, drop down
// being added; tightening: slide in, swing away, tilt away from level, drop taken back. So pushing the tray in goes
// level -> swing back -> slide in; bringing it out goes slide out -> swing -> tilt, as the spec words it.
const WINDOWS = {
    slide: { relax: [0, 0.55], tighten: [0.45, 1] },
    swing: { relax: [0.2, 0.65], tighten: [0.35, 0.8] },
    tilt: { relax: [0, 0.35], tighten: [0.6, 1] },
    drop: { relax: [0, 0.35], tighten: [0.6, 1] },
};
const relaxes = (j, a, b) => j === 'slide' ? b.slide < a.slide : j === 'drop' ? b.drop > a.drop : Math.abs(b[j]) < Math.abs(a[j]);
function stagedWindows(a, b, changing) {
    const out = { ...FULL }, base = {};
    for (const j of changing) base[j] = WINDOWS[j][relaxes(j, a, b) ? 'relax' : 'tighten'];
    if (!changing.length) return out;
    const lo = Math.min(...changing.map(j => base[j][0])), hi = Math.max(...changing.map(j => base[j][1]));
    for (const j of changing) out[j] = [(base[j][0] - lo) / (hi - lo), (base[j][1] - lo) / (hi - lo)];
    return out;
}
const along = (a, b, windows, u) => { const out = {}; for (const j of JOINTS) { const [w0, w1] = windows[j]; out[j] = lerp(a[j], b[j], w1 - w0 > EPS ? clamp((u - w0) / (w1 - w0), 0, 1) : (u >= w1 ? 1 : 0)); } return out; };
// The steps of a path (interior samples) where the coupling would have to change a joint: [{ joint, u }], first per joint.
function pathIssues(a, b, windows, opts) {
    const out = [], seen = new Set();
    for (let n = 1; n <= ROUTE_SAMPLES; n++) {     // 25 interior points of the path; the ends are the keys, checked by trayIssues
        const u = n / (ROUTE_SAMPLES + 1), joints = clampedJoints(along(a, b, windows, u), opts);
        for (const joint of joints) if (!seen.has(joint)) { seen.add(joint); out.push({ joint, u }); }
    }
    return out;
}
// How the tray travels from pose a to pose b (full poses, or any: missing joints are the rest value).
//   route 'direct': every joint eases together; reported if that is not allowed, never replaced.
//   route 'auto'  : direct if it is allowed all the way (25 samples), else the
//                   staged order if that is, else 'clamped'
//                   (direct motion, every sample clamped by the sampler; the issues say which joint and where).
// Returns { mode: 'direct' | 'staged' | 'clamped', windows: { joint: [from, to] }, issues: [{ joint, u }] }.
export function routeSegment(a, b, opts = {}) {
    const route = opts.route ?? 'auto', A = holdPose(a), B = holdPose(b), changing = JOINTS.filter(j => Math.abs(A[j] - B[j]) > EPS), direct = pathIssues(A, B, FULL, opts);
    if (route === 'direct' || !direct.length) return { mode: 'direct', windows: { ...FULL }, issues: direct };
    const windows = stagedWindows(A, B, changing), staged = pathIssues(A, B, windows, opts);
    return staged.length ? { mode: 'clamped', windows: { ...FULL }, issues: direct } : { mode: 'staged', windows, issues: [] };
}

// The edit's setup as sampler options: `bracket: true` is what switches the drop joint on for this edit (the lowered tray needs the added
// mount bracket to look mounted); an explicit opts.dropEnabled wins.
const withSetup = (edit, opts) => opts.dropEnabled === undefined && edit?.bracket === true ? { ...opts, dropEnabled: true } : opts;
export const trayBracket = edit => edit?.bracket === true;
// Sets or clears the edit's setup flag (the Inspector's "Mount bracket (added)"); false removes the field.
export function setBracket(edit, on) { const out = { ...(edit || {}) }; if (on === true) out.bracket = true; else delete out.bracket; return out; }

// ---- the timeline and the sampler ---------------------------------------------------------------------------------
// The edit's keys with every joint filled in: [{ t, pose (full), ease, route, id?, label? }], the first one at 0 s = `initial`.
function frames(edit) {
    let cur = holdPose(edit?.initial);
    const out = [{ t: 0, pose: { ...cur }, ease: 'smooth', route: 'auto' }];
    const keys = Array.isArray(edit?.keys) ? edit.keys : [];
    const ordered = keys.every((k, i) => !i || keys[i - 1].t <= k.t) ? keys : [...keys].sort((a, b) => a.t - b.t);
    for (const k of ordered) {
        cur = { ...cur, ...cleanTrayPose(k.pose, { partial: true }) };
        if (k.t < KEY_SNAP - 1e-9 && out.length === 1) { out[0] = { t: 0, pose: { ...cur }, ease: k.ease || 'smooth', route: k.route || 'auto', id: k.id, label: k.label }; continue; }
        out.push({ t: k.t, pose: { ...cur }, ease: EASES.includes(k.ease) ? k.ease : 'smooth', route: ROUTES.includes(k.route) ? k.route : 'auto', id: k.id, label: k.label });
    }
    return out;
}
function between(a, b, u, opts) {
    if (samePose(a.pose, b.pose)) return a.pose;
    const { windows } = routeSegment(a.pose, b.pose, { ...opts, route: a.route }), out = {};
    for (const j of JOINTS) {
        const [w0, w1] = windows[j], local = w1 - w0 > EPS ? clamp((u - w0) / (w1 - w0), 0, 1) : (u >= w1 ? 1 : 0);
        out[j] = lerp(a.pose[j], b.pose[j], a.ease === 'hold' ? (u >= 1 ? 1 : 0) : a.ease === 'linear' ? local : smooth(local));
    }
    return out;
}
// The tray's pose at chapter second `seconds`: a fresh { slide, swing, tilt, drop } held to the hard limits and the coupling
// (opts.riderMm: thickness of what rides on the plate, 0 = none). Pure and stateless, so out-of-order seeks agree. No edit,
// no keys, or a time that is not a number: the edit's `initial`, else the rest pose = the rigid tray.
export function sampleTray(edit, seconds, options = {}) {
    if (!edit) return restPose();
    const opts = withSetup(edit, options), f = frames(edit);
    if (f.length === 1 || !finite(seconds) || seconds <= 0) return clampTrayPose(f[0].pose, opts);
    let i = 0; while (i + 1 < f.length && f[i + 1].t <= seconds + EPS) i++;
    if (i === f.length - 1) return clampTrayPose(f[i].pose, opts);
    const a = f[i], b = f[i + 1], u = clamp((seconds - a.t) / (b.t - a.t), 0, 1);
    return clampTrayPose(between(a, b, u, opts), opts);
}
// What the lane should flag (spec 6.4): [{ kind: 'key', t, id?, joints }] for a key whose pose the coupling has to change,
// [{ kind: 'segment', t (second), from, to, joint, mode }] for a stretch whose travel does. Empty = all as authored.
export function trayIssues(edit, options = {}) {
    if (!edit) return [];
    const opts = withSetup(edit, options);
    const f = frames(edit), out = [];
    for (const k of f) { const joints = clampedJoints(k.pose, opts); if (joints.length) out.push({ kind: 'key', t: k.t, ...(k.id ? { id: k.id } : {}), joints }); }
    for (let i = 0; i + 1 < f.length; i++) {
        const a = f[i], b = f[i + 1]; if (samePose(a.pose, b.pose)) continue;
        const r = routeSegment(a.pose, b.pose, { ...opts, route: a.route });
        if (r.issues.length) out.push({ kind: 'segment', t: r3(a.t + r.issues[0].u * (b.t - a.t)), from: a.t, to: b.t, joint: r.issues[0].joint, mode: r.mode });
    }
    return out;
}

// ---- editing (each returns a new edit; the one given is not changed; an edit with no keys left may be an empty shell,
// cleanTrayEdit / cleanTrayEdits drop those) -------------------------------------------------------------------------
const withKeys = (edit, keys) => { const out = { ...(edit || {}) }, clean = cleanTrayKeys(keys); if (clean.length) out.keys = clean; else delete out.keys; return out; };
const copyKeys = edit => (Array.isArray(edit?.keys) ? edit.keys : []).map(k => ({ ...k, pose: { ...k.pose } }));
const near = (keys, t) => keys.find(k => Math.abs(k.t - t) < KEY_SNAP - 1e-9) || null;
const setField = (key, field, value, dflt) => { if (value === undefined) return; if (value === dflt || value === null || value === '') delete key[field]; else key[field] = value; };
// Adds a key at t naming these joints (any subset), or changes the one already there (its other joints are kept).
export function setKey(edit, t, pose, { ease, route, label } = {}) {
    if (!finite(t) || t < 0) return edit;
    const named = cleanTrayPose(pose, { partial: true }); if (!named) return edit;
    const keys = copyKeys(edit); let at = near(keys, t);
    if (at) Object.assign(at.pose, named); else { at = { t, pose: named }; keys.push(at); }
    setField(at, 'ease', EASES.includes(ease) ? ease : undefined, 'smooth'); setField(at, 'route', ROUTES.includes(route) ? route : undefined, 'auto'); setField(at, 'label', label, '');
    return withKeys(edit, keys);
}
// Takes a joint out of the key at t, or the whole key (no joint given). A key with no joint left is gone.
export function removeKey(edit, t, joint = null) {
    const keys = copyKeys(edit), at = near(keys, t); if (!at) return edit;
    if (joint) delete at.pose[joint];
    return withKeys(edit, joint && Object.keys(at.pose).length ? keys : keys.filter(k => k !== at));
}
// Retimes the key at tFrom to tTo (it merges with a key that is already there; the moved key's joints win).
export function moveKey(edit, tFrom, tTo) {
    if (!finite(tTo) || tTo < 0) return edit;
    const keys = copyKeys(edit), at = near(keys, tFrom); if (!at) return edit;
    const rest = keys.filter(k => k !== at), there = near(rest, tTo);
    if (there) { Object.assign(there.pose, at.pose); for (const f of ['ease', 'route']) { if (at[f]) there[f] = at[f]; else delete there[f]; } if (at.label) there.label = at.label; return withKeys(edit, rest); }
    at.t = tTo; return withKeys(edit, keys);
}
// The ease / route of the stretch that leaves the key at t.
export function setKeyEase(edit, t, ease) { const keys = copyKeys(edit), at = near(keys, t); if (!at || !EASES.includes(ease)) return edit; setField(at, 'ease', ease, 'smooth'); return withKeys(edit, keys); }
export function setKeyRoute(edit, t, route) { const keys = copyKeys(edit), at = near(keys, t); if (!at || !ROUTES.includes(route)) return edit; setField(at, 'route', route, 'auto'); return withKeys(edit, keys); }
// A copy of the key at t for paste ({ pose, ease?, route?, label? } or null); pasteKey puts it at another time (its id is new).
export function copyKey(edit, t) { const at = near(copyKeys(edit), t); if (!at) return null; const { id: _id, t: _t, ...rest } = at; return rest; }
export const pasteKey = (edit, t, copied) => copied?.pose ? setKey(edit, t, copied.pose, { ease: copied.ease ?? 'smooth', route: copied.route ?? 'auto', label: copied.label ?? '' }) : edit;
// The pose at 0 s (joints off the rest pose only; naming a joint at rest takes it out). `pose: null` clears it.
export function setInitial(edit, pose) {
    const out = { ...(edit || {}) }, init = cleanTrayPose(pose, { partial: true });
    const merged = init ? { ...(out.initial || {}), ...init } : null;
    for (const j of JOINTS) if (merged && j in merged && Math.abs(merged[j] - REST[j]) < EPS) delete merged[j];
    if (merged && Object.keys(merged).length) out.initial = merged; else delete out.initial;
    return out;
}
