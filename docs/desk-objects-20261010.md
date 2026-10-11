# Desk object editor — 10 October 2026

## Using it

1. Open a room scene, expand **Desks**, and select the desk in **Control desk**.
2. Expand **Objects on this desk**. Turn on **Edit desk objects** to click a visible prop and drag it along its desk surface. This works with **Rearrange items** switched off. **Hide tools to see the desk** collapses the panel while keeping object editing active; reopen **Desks** for the fields.
3. Use **Object** to select an existing item. Its controls change left/right and back/front position, height above the part, rotation, scale, or the desk part it is attached to. **Remove object** removes the selected prop. Some authored procedural arrangements are a single grouped prop.
4. Expand **Add from the object library**, choose **Place on**, search or filter the library, and click a thumbnail. Multiple instances of a model are allowed. Available parts are the desktop, top shelf, lower shelf and base shelf.
5. Switch off **Edit desk objects** to return to normal desk selection and camera navigation.

Object edits save automatically in this browser for that desk in the current room layout. They are included in project download/import and support the existing Undo/Redo buttons and Ctrl+Z / Ctrl+Y. Edits apply across that layout's times of day; authored activity props retain their original daypart visibility. Purchased accessories in the cart remain managed through the accessory options.

Items ride their chosen part during desk movement, lifting, tilting and resizing. New large library models begin scaled down to a tabletop size; **Size (%)** can change that. These are visual scene props, with no cart charge. Moving an item to another part places its base at that part's surface; the height field adjusts it further.

## Implementation

- `scene-desk-objects.mjs`: per-desk object identities, surface-local transforms, additions/removals, async restore, pointer editing and undo snapshots.
- `scene-desk-object-ui.mjs`: existing-object editor and searchable library picker, using Store/Studio theme colors.
- `scene-desk-data.mjs`: validated object state nested in `sceneDesks.rooms[scene/layout].desks[id].objects`. Default removals retain tombstones; removed user additions release their slots. Up to 200 object records per desk.
- `WorkspaceAccessories` now supplies CAD surface mounts for both shelves and the base, as well as the desktop. The room desk manager owns editable dressing copies; the original main dressing is hidden in room mode, avoiding duplicates and edits to an invisible source.
- A reload waits for user library props to finish restoring through `workspaceRoom.ready`. Stale loads cannot attach to a replacement room or desk.
- The upload builder includes both new modules. Entry points and controller CSS use `desk-objects-20261010` to refresh existing viewers.

Verification: `npm run test:desk-objects` covers data bounds and browser checks for authored edits/removals, four part mounts, library additions, transforms, desk movement and resize, part transfer, project import, undo/redo, daypart visibility, actual pointer dragging and reload persistence.
