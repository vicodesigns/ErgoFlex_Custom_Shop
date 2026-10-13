import { PRESETS, cleanConfig, validConfig, accessory } from './catalog.mjs?v=obsbot-tiny-2-20261012';
import { cleanSceneDeskData } from './scene-desk-data.mjs';
import { SHARED_BUILD_PRESETS } from './preset-defaults.mjs?v=obsbot-tiny-2-20261012';
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
export function cleanBuildPresets(value) {
    const entries = {};
    for (const preset of PRESETS) {
        const draft = value?.entries?.[preset.id] || SHARED_BUILD_PRESETS[preset.id];
        if (!validConfig(draft?.config)) continue;
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
        entries[preset.id] = {
            ...(!value?.entries?.[preset.id] || draft.origin === 'shared' ? { origin: 'shared' } : {}),
            config, ...(room ? { room } : {}),
            ...(cleanStartingView(draft.initialView) ? {initialView: cleanStartingView(draft.initialView)} : {}),
            ...(preset.id === 'occ' ? {trayFinish:'occ-steel-v1'} : {}),
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
    return { v: 1, active: PRESETS.some(p => p.id === value?.active) ? value.active : null, entries };
}
