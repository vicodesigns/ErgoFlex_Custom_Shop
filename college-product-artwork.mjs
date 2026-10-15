import { cleanArtwork } from './artwork-config.mjs';

// Media stations keep their individual equipment and room arrangements while
// taking college graphics from the owner's matching-width Product build.
export function applyCollegeProductArtwork(state, entry, id = 'occ') {
    const draft = entry?.config?.size === state.size ? entry : entry?.sizeSetups?.[state.size];
    if (!draft?.config || draft.config.size !== state.size) return false;
    const revision = draft.revision || 0, previous = state.productArtwork;
    if (previous?.id === id && previous.size === state.size && previous.revision === revision) return false;
    // Keep previously authored room graphics on the first link. An empty desk
    // is seeded with the saved college design, including its exact placements.
    if (previous || !Object.keys(cleanArtwork(state.artwork).surfaces).length)
        state.artwork = cleanArtwork(draft.config.artwork);
    state.productArtwork = { id, size: state.size, revision };
    return true;
}
