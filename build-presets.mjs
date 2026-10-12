import { PRESETS, cleanConfig, validConfig } from './catalog.mjs?v=artist-finishes-20261012';
import { cleanSceneDeskData } from './scene-desk-data.mjs';
import { minimumHeightForTilt } from './motion-limits.mjs';

export const BUILD_PRESETS_KEY = 'ergoflex.buildPresetsV1';
export function cleanBuildPresets(value) {
    const entries = {};
    for (const preset of PRESETS) {
        const draft = value?.entries?.[preset.id];
        if (!validConfig(draft?.config)) continue;
        const room = cleanSceneDeskData({ rooms: { 'product/default': draft.room } }).rooms['product/default'];
        // Upgrade the Artist starting posture once without replacing any objects.
        if (preset.id === 'artist' && room?.desks.main && draft.startPose !== 'artist-65-v1') {
            room.desks.main.tilt = preset.startTilt;
            room.desks.main.height = Math.max(room.desks.main.height, minimumHeightForTilt(preset.startTilt, room.desks.main.size));
        }
        const surface = draft.surface || {};
        entries[preset.id] = {
            config: cleanConfig(draft.config), ...(room ? { room } : {}),
            ...(preset.id === 'artist' ? { startPose: 'artist-65-v1' } : {}),
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
