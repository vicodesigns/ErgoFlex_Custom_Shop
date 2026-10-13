import { PRESETS, cleanConfig, validConfig, accessory } from './catalog.mjs?v=preset-size-setups-20261012';
import { cleanSceneDeskData } from './scene-desk-data.mjs';
import { SHARED_BUILD_PRESETS } from './preset-defaults.mjs?v=obsbot-tiny-2-20261012';
import { cleanDeskStyle } from './room-desk-styles.mjs';
import { minimumHeightForTilt } from './motion-limits.mjs';

export const BUILD_PRESETS_KEY = 'ergoflex.buildPresetsV1';
export function cleanStartingView(value) {
    const vector = v => v && ['x','y','z'].every(k => Number.isFinite(v[k]) && Math.abs(v[k]) < 10000);
    if (!vector(value?.position) || !vector(value?.target)) return null;
    if (Math.hypot(...['x','y','z'].map(k => value.position[k] - value.target[k])) < .01) return null;
    const xyz = v => ({x:v.x,y:v.y,z:v.z});
    return { position: xyz(value.position), target: xyz(value.target), fov: Number.isFinite(value.fov) ? Math.max(10, Math.min(100, value.fov)) : 35 };
}
// Rotate a mount-local point without importing the renderer into preset storage.
function rotatedPoint(p, q) {
    const t = {x:2*(q.y*p.z-q.z*p.y),y:2*(q.z*p.x-q.x*p.z),z:2*(q.x*p.y-q.y*p.x)};
    return {x:p.x+q.w*t.x+q.y*t.z-q.z*t.y,y:p.y+q.w*t.y+q.z*t.x-q.x*t.z,z:p.z+q.w*t.z+q.x*t.y-q.y*t.x};
}
const DESK_SIZES = ['48x30','60x30'];
function cleanVariant(preset, draft) {
    if (!validConfig(draft?.config)) return null;
    const room = cleanSceneDeskData({ rooms: { 'product/default': draft.room } }).rooms['product/default'];
    for (const [id, object] of Object.entries(room?.desks.main?.objects || {})) {
        if (object.label === 'Desk object' && id.startsWith('accessory-')) object.label = accessory(id.slice(10))?.name || object.label;
    }
    // Upgrade the Artist starting posture once without replacing any objects.
    if (preset.id === 'artist' && room?.desks.main && draft.startPose !== 'artist-65-v1') {
        room.desks.main.tilt = preset.startTilt;
        room.desks.main.height = Math.max(room.desks.main.height, minimumHeightForTilt(preset.startTilt, room.desks.main.size));
    }
    const config = cleanConfig(draft.config);
    // Recover the reported legacy OCC resize loss once. A saved mount with
    // no main display matches the old 48-inch filtering failure. New size
    // recipes carry a marker, so their intentional removals stay authored.
    if (preset.id === 'occ' && draft.occResizeRecovery !== 'size-setups-v1'
        && config.accessories.some(id=>['monitor-arm','monitor-arm-2'].includes(id))
        && !config.accessories.some(id=>accessory(id)?.visual==='monitor')
        && !Object.values(room?.desks.main?.objects || {}).some(o=>o.added && !o.removed && /monitor/.test(o.propId))) {
        config.accessories.push('wide-monitor');
        if (room?.desks.main && !room.desks.main.objects['accessory-wide-monitor']) {
            room.desks.main.objects['accessory-wide-monitor'] = structuredClone(SHARED_BUILD_PRESETS.occ.room.desks.main.objects['accessory-wide-monitor']);
        }
    }
    // Restore the Architect's drawing support once in each saved width.
    if (preset.id === 'architect' && draft.architectRail !== 'support-rail-v1'
        && config.accessories.includes('drafting-kit') && !config.accessories.includes('easel-rail')) {
        config.accessories.push('easel-rail');
        if (room?.desks.main && !room.desks.main.objects['accessory-easel-rail']) {
            room.desks.main.objects['accessory-easel-rail'] = {role:'desktop',added:false,removed:false,custom:true,
                label:accessory('easel-rail').name,transform:{p:{x:0,y:0,z:300},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}}};
        }
    }
    if (room?.desks.main) {
        room.desks.main.size = config.size;
        room.desks.main.height = Math.max(room.desks.main.height, minimumHeightForTilt(room.desks.main.tilt,config.size));
    }
    // Update OCC's original white tray once, retaining all owner placements.
    if (preset.id === 'occ' && draft.trayFinish !== 'occ-steel-v1') config.accessoryFinishes = {...config.accessoryFinishes, 'keyboard-tray':'steel'};
    if (preset.id === 'artist' && room?.desks.main && draft.singleArm !== 'rigid-landscape-v1') {
        const main = room.desks.main, objects = main.objects;
        const portrait = objects['accessory-portrait-monitor'];
        if (portrait) {
            const t = portrait.transform, q = t.q, h = Math.SQRT1_2;
            // Remove the old 90-degree roll, keeping the visible panel's
            // centre, scale, and any other owner-authored screen angles.
            const nextQ = {x:h*(q.x-q.y),y:h*(q.x+q.y),z:h*(q.z-q.w),w:h*(q.z+q.w)};
            const oldCenter = rotatedPoint({x:-.79185518608*t.s.x,y:350*t.s.y,z:-11.60067870293*t.s.z},q);
            const newCenter = rotatedPoint({x:0,y:209.04977369175*t.s.y,z:-11.60067870293*t.s.z},nextQ);
            objects['accessory-flat-monitor'] = {...portrait,label:accessory('flat-monitor').name,transform:{...t,q:nextQ,p:{x:t.p.x+oldCenter.x-newCenter.x,y:t.p.y+oldCenter.y-newCenter.y,z:t.p.z+oldCenter.z-newCenter.z}}};
            delete objects['accessory-portrait-monitor'];
        }
        config.accessories = [...new Set(config.accessories.map(id=>id==='portrait-monitor'?'flat-monitor':id))];
        if (main.style) main.style.accessories = [...config.accessories];
        const arm = objects['accessory-monitor-arm'];
        if (arm) arm.transform = {p:{x:0,y:0,z:-213.589786},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}};
    }
    const surface = draft.surface || {};
    // A named recipe owns its palette. Its cached live desk style must not
    // revive the previous Product scene's finishes when binding the room.
    if (room?.desks.main) room.desks.main.style = cleanDeskStyle({...config, sheen:surface.finish || 'gloss'});
    return {
        ...(draft.origin === 'shared' ? { origin: 'shared' } : {}),
        revision: Number.isSafeInteger(draft.revision) && draft.revision >= 0 ? draft.revision : 0,
        config, ...(room ? { room } : {}),
        ...(cleanStartingView(draft.initialView) ? {initialView: cleanStartingView(draft.initialView)} : {}),
        ...(preset.id === 'occ' ? {trayFinish:'occ-steel-v1',occResizeRecovery:'size-setups-v1'} : {}),
        ...(preset.id === 'architect' ? {architectRail:'support-rail-v1'} : {}),
        ...(preset.id === 'artist' ? { startPose: 'artist-65-v1' } : {}),
        ...(preset.id === 'artist' ? { singleArm: 'rigid-landscape-v1' } : {}),
        ...(preset.id === 'occ' && ['occ-v1','occ-v2'].includes(draft.collegeArtwork) ? { collegeArtwork: draft.collegeArtwork } : {}),
        ...(draft.startLighting === 'artist-daytime-40-v1' ? { startLighting: draft.startLighting } : {}),
        surface: {
            finish: ['matte', 'satin', 'gloss'].includes(surface.finish) ? surface.finish : 'gloss',
            grain: surface.grain !== false,
            visibility: Number.isFinite(surface.visibility) ? Math.max(0, Math.min(100, surface.visibility)) : 100,
            sheen: Number.isFinite(surface.sheen) ? Math.max(0, Math.min(100, surface.sheen)) : 100
        }
    };
}

// Seed only once. Subsequent edits belong to the selected size's own recipe.
export function seedPresetSize(draft, size) {
    const {sizeSetups, ...source} = draft;
    const copy = structuredClone(source), ratio = Number(size.slice(0,2)) / Number(source.config.size.slice(0,2));
    copy.config.size = size;
    const main = copy.room?.desks.main;
    if (main) {
        main.size = size;
        main.height = Math.max(main.height, minimumHeightForTilt(main.tilt, size));
        for (const object of Object.values(main.objects)) object.transform.p.x *= ratio;
        // Keep screen dimensions real while leaving a gap between the pair.
        // The panel pair can overhang the desk slightly, like physical monitors.
        const objects = main.objects, left = objects['accessory-portrait-monitor'];
        const rightId = ['wide-monitor','flat-monitor','dell-u2724d'].find(id => objects['accessory-'+id]);
        const right = rightId && objects['accessory-'+rightId];
        if (size === '48x30' && left && right && left.role === right.role && left.transform.p.x < right.transform.p.x) {
            const width = (o, dimensions) => {
                const {q,s} = o.transform;
                return Math.abs(1-2*(q.y*q.y+q.z*q.z))*dimensions[0]*s.x
                    + Math.abs(2*(q.x*q.y-q.z*q.w))*dimensions[1]*s.y
                    + Math.abs(2*(q.x*q.z+q.y*q.w))*dimensions[2]*s.z;
            };
            const lw = width(left,[416.5,700,29.1]);
            const rw = width(right,{'wide-monitor':[815.4,365.4,86.7],'flat-monitor':[700,416.5,29.1],'dell-u2724d':[612.24,352.51,32]}[rightId]);
            const gap = 12;
            if (right.transform.p.x-left.transform.p.x < (lw+rw)/2+gap) {
                left.transform.p.x = -(rw+gap)/2;
                right.transform.p.x = (lw+gap)/2;
            }
        }
    }
    return copy;
}

export function cleanBuildPresets(value) {
    const entries = {};
    for (const preset of PRESETS) {
        const draft = value?.entries?.[preset.id] || {...SHARED_BUILD_PRESETS[preset.id],origin:'shared'};
        const entry = cleanVariant(preset,draft);
        if (!entry) continue;
        const otherSize = DESK_SIZES.find(size=>size!==entry.config.size);
        const saved = draft.sizeSetups?.[otherSize];
        const other = cleanVariant(preset,saved?.config?.size===otherSize ? saved : seedPresetSize(entry,otherSize));
        // The top-level fields remain the last selected size for older projects.
        // Store only the inactive size here, avoiding a duplicate active recipe.
        entries[preset.id] = {...entry,sizeSetups:{[otherSize]:other}};
    }
    return { v: 1, active: PRESETS.some(p => p.id === value?.active) ? value.active : null, entries };
}
