import { cleanBuildPresets } from './build-presets.mjs';
import { validArtwork, cleanArtwork } from './artwork-config.mjs';
import { cleanDeskStyle } from './room-desk-styles.mjs';

// Recovery is deliberately limited to college graphics and their saved palette.
// Every object's transform, accessory selection, initial view and other preset
// comes from the current build, never from an older whole-project snapshot.
export function recoverCollegeArtwork(current, recovery) {
    const next = cleanBuildPresets(current);
    for (const id of ['library', 'occ']) {
        const entry = next.entries[id];
        for (const draft of [entry, ...Object.values(entry.sizeSetups)]) {
            const source = recovery?.entries?.[id]?.[draft.config.size];
            if (!validArtwork(source?.artwork) || !cleanDeskStyle(source?.palette))
                throw new Error('The college artwork recovery is incomplete.');
            draft.config.artwork = cleanArtwork(source.artwork);
            Object.assign(draft.config, source.palette);
            if (draft.room?.desks.main) {
                draft.room.desks.main.artwork = cleanArtwork(source.artwork);
                draft.room.desks.main.style = cleanDeskStyle({ ...draft.config, sheen: draft.surface.finish });
            }
            draft.revision = (draft.revision || 0) + 1;
        }
    }
    return next;
}
