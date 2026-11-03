import { cleanArtwork } from './artwork-config.mjs';

export const LIBRARY_ARTWORK_REPAIR = 'humboldt-product-decals-v1';
export let libraryArtworkRecovery = null;
let loading;
export function loadLibraryArtworkRecovery() {
    return loading ||= fetch('./assets/artwork/saved-college-graphics-20261014.json')
        .then(response => { if (!response.ok) throw new Error('Saved Library graphics unavailable'); return response.json(); })
        .then(data => (libraryArtworkRecovery = data.entries?.library || null))
        .catch(error => { loading = null; console.warn('[Library graphics]', error.message); return null; });
}

// Repair the old empty commons link once, independently of the full Product
// revision. Existing room graphics, finishes, object edits and other widths
// remain authored. A later deliberate deletion is not repaired again.
export function repairLibraryArtwork(state, entry, recovery) {
    if (state.productBuild?.artworkRepair === LIBRARY_ARTWORK_REPAIR) return false;
    const current = cleanArtwork(state.artwork);
    if (Object.keys(current.surfaces).length) {
        if (state.productBuild) state.productBuild.artworkRepair = LIBRARY_ARTWORK_REPAIR;
        return false;
    }
    const draft = entry?.config?.size === state.size ? entry : entry?.sizeSetups?.[state.size];
    const saved = cleanArtwork(draft?.config?.artwork);
    const artwork = Object.keys(saved.surfaces).length ? saved : cleanArtwork(recovery?.[state.size]?.artwork);
    if (!Object.keys(artwork.surfaces).length) return false;
    state.artwork = artwork;
    state.productBuild = { id: 'library', size: state.size, revision: draft?.revision || 0,
        ...state.productBuild, artworkRepair: LIBRARY_ARTWORK_REPAIR };
    return true;
}
