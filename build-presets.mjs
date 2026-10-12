import { PRESETS, cleanConfig, validConfig } from './catalog.mjs?v=editable-presets-20261012';
import { cleanSceneDeskData } from './scene-desk-data.mjs';

export const BUILD_PRESETS_KEY = 'ergoflex.buildPresetsV1';
export function cleanBuildPresets(value) {
    const entries = {};
    for (const preset of PRESETS) {
        const draft = value?.entries?.[preset.id];
        if (!validConfig(draft?.config)) continue;
        const room = cleanSceneDeskData({ rooms: { 'product/default': draft.room } }).rooms['product/default'];
        const surface = draft.surface || {};
        entries[preset.id] = {
            config: cleanConfig(draft.config), ...(room ? { room } : {}),
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
