// The Director's Tray mode, the parts that are plain data (no DOM, no three.js; tests/tray-mode-test.mjs): what the sliders show at the
// playhead (the keyed value next to the value the tray really takes, with the reason when they differ), the limits as text, the presets,
// the lane's keys and segments with their warnings, and the saved poses. scene-tray-editor.mjs draws and wires it.
import { JOINTS, TRAY_JOINTS, sampleTray, limitsFor, clampTrayPose, clampedJoints, trayIssues, dropNeededMm, riderFitsUnder, trayBracket, KEY_SNAP } from './tray-pose.mjs';
import { SLIDE_TRAVEL_MM, UNDER_RAMPS, DROP_ENABLED } from './tray-limits.mjs';

export const fmtT = t => (Math.round(t * 100) / 100).toFixed(2);
const r1 = v => Math.round(v * 10) / 10;
export const BRACKET_LABEL = 'Mount bracket (added)';
export const BRACKET_HINT = 'A plain block from the desktop to the track, built only for this chapter. It also turns on the Drop slider: lower the tray, and keys can take a keyboard under the desk. Off, the tray is the original model and the drop is off.';
// The sampler's options for this edit: the rider's thickness, and the drop joint on only for an edit with the bracket.
export const optionsFor = (edit, riderMm = 0) => ({ riderMm, dropEnabled: trayBracket(edit) || DROP_ENABLED });
export const dropOn = edit => optionsFor(edit).dropEnabled;
// Slide is typed and shown as a percent of its travel; the others in their own units.
export const toDisplay = (joint, v) => joint === 'slide' ? Math.round(v * 1000) / 10 : joint === 'drop' ? r1(v) : Math.round(v * 10) / 10;
export const fromDisplay = (joint, v) => joint === 'slide' ? v / 100 : v;
export const unitOf = joint => joint === 'slide' ? '%' : joint === 'drop' ? 'mm' : '°';
export const labelOf = joint => TRAY_JOINTS.find(j => j.id === joint)?.label || joint;
export const stepOf = joint => joint === 'slide' ? 1 : joint === 'drop' ? 1 : 1;
const range = (joint, [lo, hi]) => joint === 'slide' ? `${toDisplay(joint, lo)}–${toDisplay(joint, hi)} %` : joint === 'drop' ? `${r1(lo)}–${r1(hi)} mm` : `${r1(lo)}–${r1(hi)}°`;

// The presets of the panel (poses to key at the playhead). `drop` is added only where the bracket is on.
export const PRESETS = Object.freeze([
    { id: 'out', label: 'Out (as built)', pose: { slide: 0, swing: 0, tilt: 0 } },
    { id: 'tilt', label: 'Tilted down', pose: { tilt: -12 } },
    { id: 'side', label: 'Side storage', pose: { slide: 0, swing: 90, tilt: 0 } },
    { id: 'in', label: 'Pushed in', pose: { slide: 1, swing: 0, tilt: 0 } },
]);

// Why a joint is not where it was keyed, in words for the panel ('' when it is).
export function limitReason(joint, raw, edit, riderMm = 0, riders = []) {
    const opts = optionsFor(edit, riderMm), got = clampTrayPose(raw, opts);
    if (Math.abs(got[joint] - raw[joint]) < 1e-6) return '';
    if (joint === 'drop') return `The drop is off. Switch on "${BRACKET_LABEL}" to lower the tray.`;
    // the joints before this one in the clamp order (drop, slide, swing, tilt) are already as the tray has them: would this one have been
    // allowed without the rider? Then the rider is the reason.
    const order = ['drop', 'slide', 'swing', 'tilt'], pre = { ...raw }; for (const j of order.slice(0, order.indexOf(joint))) pre[j] = got[j];
    const bare = clampTrayPose(pre, { ...opts, riderMm: 0 }), byRider = Math.abs(bare[joint] - raw[joint]) < 1e-6 && riderMm > 0 && !riderFitsUnder(riderMm);
    if (byRider) {
        const what = riders.length ? riders.join(' and ') : 'keyboard or mouse', need = Math.ceil(dropNeededMm(riderMm) * 10) / 10;
        const where = joint === 'slide' ? `the tray stops at ${toDisplay('slide', UNDER_RAMPS.slide[0])} % of its slide (${Math.round(UNDER_RAMPS.slide[0] * SLIDE_TRAVEL_MM)} of ${SLIDE_TRAVEL_MM} mm)` : joint === 'swing' ? `it swings no further than ${UNDER_RAMPS.swing[0]}°` : 'the plate stays level';
        const fix = dropOn(edit) ? `Key a drop of ${need} mm or more (it is ${r1(raw.drop)} mm here).` : `Switch on "${BRACKET_LABEL}" and key a drop of ${need} mm to go further.`;
        return `A ${what} (${r1(riderMm)} mm) does not fit under the desk, so ${where}. ${fix}`;
    }
    const L = limitsFor(got, opts)[joint];
    return joint === 'swing' ? `Swing stops at ±${r1(L[1])}° at this slide: it narrows as the tray slides in.` : joint === 'tilt' ? `Tilt is held to ${range('tilt', L)} here: the plate is under the desk or going there.` : `${labelOf(joint)} is held to ${range(joint, L)}.`;
}

// What the panel shows at second `t`: the keyed values (raw), the values the tray takes (shown), each joint's live limits and reasons.
export function panelModel(edit, t, { riderMm = 0, riders = [] } = {}) {
    const opts = optionsFor(edit, riderMm), raw = sampleTray(edit, t, { ...opts, raw: true }), shown = sampleTray(edit, t, opts), limits = limitsFor(shown, opts);
    const bracket = trayBracket(edit), clamped = clampedJoints(raw, opts), rows = JOINTS.filter(j => j !== 'drop' || bracket).map(joint => {
        const reason = limitReason(joint, raw, edit, riderMm, riders);
        return { joint, label: labelOf(joint), unit: unitOf(joint), min: toDisplay(joint, joint === 'slide' ? 0 : TRAY_JOINTS.find(x => x.id === joint).min), max: toDisplay(joint, TRAY_JOINTS.find(x => x.id === joint).max),
            lo: toDisplay(joint, limits[joint][0]), hi: toDisplay(joint, limits[joint][1]), value: toDisplay(joint, raw[joint]), shown: toDisplay(joint, shown[joint]), limitText: range(joint, limits[joint]), reason, clamped: !!reason || clamped.includes(joint) };
    });
    return { raw, shown, limits, bracket, rows, clamped };
}

// The lane: a key per tray key (selected / warned) and a segment between neighbours (route, warned), in % of the chapter.
export function laneModel(edit, seconds, { riderMm = 0, selected = [] } = {}) {
    const keys = Array.isArray(edit?.keys) ? edit.keys : [], T = seconds > 0 ? seconds : 1, issues = trayIssues(edit, optionsFor(edit, riderMm));
    const sel = new Set(selected.map(x => Math.round(x * 1000)));
    const out = { keys: [], segments: [], warnings: issues.length };
    keys.forEach((k, i) => {
        const bad = issues.filter(x => x.kind === 'key' && Math.abs(x.t - k.t) < KEY_SNAP - 1e-9);
        out.keys.push({ id: k.id, t: k.t, left: k.t / T * 100, selected: sel.has(Math.round(k.t * 1000)), ease: k.ease || 'smooth', route: k.route || 'auto', label: k.label || '', joints: Object.keys(k.pose), warn: bad.length > 0, why: bad.length ? `${bad.flatMap(x => x.joints).map(labelOf).join(', ')} held to the limits here` : '' });
        const n = keys[i + 1]; if (!n) return;
        const seg = issues.filter(x => x.kind === 'segment' && Math.abs(x.from - k.t) < KEY_SNAP - 1e-9);
        out.segments.push({ from: k.t, to: n.t, left: k.t / T * 100, width: (n.t - k.t) / T * 100, route: k.route || 'auto', ease: k.ease || 'smooth', warn: seg.length > 0, why: seg.length ? `${labelOf(seg[0].joint)} is held at about ${fmtT(seg[0].t)} s: the way between these keys is not allowed` : '' });
    });
    return out;
}
export const keyTitle = k => `Tray key at ${fmtT(k.t)} s${k.label ? ' · ' + k.label : ''} · ${k.joints.map(labelOf).join(', ')} · eases ${k.ease === 'hold' ? 'by holding' : k.ease}${k.route === 'direct' ? ' · direct' : ''}${k.warn ? ' · ' + k.why : ''} · click: go there · Shift: add · drag: retime · Delete: remove`;

// Saved poses (this browser: localStorage ergoflex.trayPoses.v1): [{ name, pose }], at most 24.
export const SAVED_KEY = 'ergoflex.trayPoses.v1';
export function cleanSaved(v) {
    if (!Array.isArray(v)) return [];
    const out = [];
    for (const e of v) {
        if (!e || typeof e.name !== 'string' || !e.name.trim() || !e.pose || typeof e.pose !== 'object') continue;
        const pose = {}; for (const j of JOINTS) if (Number.isFinite(e.pose[j])) pose[j] = e.pose[j];
        if (Object.keys(pose).length) out.push({ name: e.name.trim().slice(0, 40), pose });
    }
    return out.slice(0, 24);
}
export const addSaved = (list, name, pose) => cleanSaved([{ name, pose }, ...cleanSaved(list).filter(e => e.name !== String(name).trim().slice(0, 40))]);
