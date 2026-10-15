import { cleanArtwork } from './artwork-config.mjs';
import { cleanDeskObjects } from './scene-desk-data.mjs';
import { cleanDeskStyle } from './room-desk-styles.mjs';

export const LIBRARY_PHONE_ID = 'default-library-iphone';
export function seedLibraryChargerPhone(state, at) {
    state.objects ||= {};
    if (state.objects[LIBRARY_PHONE_ID] || !at?.every(Number.isFinite)) return false;
    state.objects[LIBRARY_PHONE_ID] = { role: 'desktop', added: true, removed: false,
        propId: 'ergoflex-phone', label: 'iPhone · Wireless charger',
        transform: { p: { x: at[0], y: at[1], z: at[2] }, q: { x: 0, y: 0, z: 0, w: 1 }, s: { x: 1000, y: 1000, z: 1000 } } };
    return true;
}

// A width owns its own Product recipe. Room circulation and Groove recordings
// belong to the environment and survive importing that recipe.
export function applyLibraryProductBuild(state, entry) {
    const draft = entry?.config?.size === state.size ? entry : entry?.sizeSetups?.[state.size];
    if (!draft?.config || draft.config.size !== state.size) return false;
    const revision = draft.revision || 0, previous = state.productBuild;
    if (previous?.id === 'library' && previous.size === state.size && previous.revision === revision) return false;
    const config = draft.config;
    state.style = cleanDeskStyle({ ...config, sheen: draft.surface?.finish || 'satin' });
    state.accessories = config.accessories.filter(id=>state.shelfStation!=='shelf-first-v1'||!(/monitor|^obsbot-tiny-2$/.test(id)));
    if(state.shelfStation==='shelf-first-v1'&&!state.accessories.includes('shelf-organizer'))state.accessories.push('shelf-organizer');
    state.accessoryFinishes = { ...config.accessoryFinishes };
    state.artwork = cleanArtwork(config.artwork);
    const objects = cleanDeskObjects(draft.room?.desks.main?.objects);
    state.objects = {
        ...Object.fromEntries(Object.entries(state.objects || {}).filter(([id]) => !id.startsWith('accessory-'))),
        ...Object.fromEntries(Object.entries(objects).filter(([id, o]) => id.startsWith('accessory-') || o.added))
    };
    state.peripheralRecipe = 'library'; state.peripheralSetup = 'product-reference-v1';
    state.productBuild = { id: 'library', size: state.size, revision };
    return true;
}
