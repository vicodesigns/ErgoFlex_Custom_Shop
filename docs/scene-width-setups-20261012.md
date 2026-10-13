# Environment desk width setups — October 12, 2026

## Behavior

Each desk in a measured room has independently saved 48″ and 60″ versions. A width switch saves the outgoing version and restores the chosen version’s body finish, frame, trim, purchased peripherals and their finishes, object transforms, height, tilt, lighting, saved positions and Groove recordings. The desk identity and name stay common.

Existing scene saves migrate from `ergoflex.sceneDesksV1` into `ergoflex.sceneDesksBySizeV2`. Older tabs writing the former key cannot overwrite the new width variants. Project exports remain ordinary, self-contained JSON. Browser records pool exact repeated objects and images losslessly; restored objects do not share mutable transforms.

## Placement references and setup choices

`scene-product-reference.mjs` contains the owner’s nine edited Product setups at both widths, captured through the visible project JSON export. Scene bodies keep their environment finishes; purchased accessories use the corresponding measured Product positions and materials. Native monitor arm fitting runs on every scene desk, including desks that are not selected. Legacy generic consumer screens and inputs are hidden when replaced.

| Environment or desk role | Peripheral setup |
| --- | --- |
| Office, home office, co-working, public service, security, mobile IT and lab work | Owner’s Office setup; narrow single screen and extended dual screen |
| Library, study, university and research roles | Library setup with ergonomic inputs and keyboard tray |
| Music studio | Music inputs and tools; single screen at 48″, display pair at 60″ |
| Gaming | Curved screen, single arm, mechanical keyboard, MX Master and tray |
| Digital creative and analysis roles | Drawing tools; fitted single flat screen at 48″ and dual displays at 60″ |
| Painting / easel roles and gallery | Artist canvas, easel rail, wood-matched artist shelf and luminous clamp lamp |
| Workshop, drafting and architectural roles | Drafting board, support rail, task light and organizer |
| Clinical spaces and college stations | OCC peripheral reference with white inputs and steel tray; no college branding copied |
| Lounge, bedroom, kitchen, gym, visitor and student roles | Slim display, single arm and compact inputs |

A newly created width uses its own Product placement reference. Custom purchased additions, removals and accessory finishes seed across widths once. Subsequent edits belong to the width being edited. Library additions and daily activity objects keep their identities; their horizontal placement adapts to the available desktop width without stretching the physical models.

## Editing modes

**Rearrange desks** moves desk assemblies; **Rearrange items** moves their objects and room furnishings. The modes are mutually exclusive. Product view offers item rearranging. Desk objects also provides precise placement, orientation, surface attachment and size controls.

## Verification

The exhaustive audit passed all **27 environments, 99 layouts and 229 desks**, with both widths and all five time scenes covered. It checks every environment/layout and every authored desk at both widths: rendered accessory geometry, Product reference placements, arm connection gaps under 2 mm, isolated object edits, finish and accessory restoration, all five time scenes and reload. Its detailed local report is `scene-shots/scene-size-audit/all-layouts.json`.

Additional tests cover public width buttons, independent lighting and peripheral finishes, accessory add/remove, legacy migration, protection from stale tabs, truthful failed-save status, object dragging, attachment transfer, import, undo/redo and reload. Product artwork isolation and Artist canvas/lamp regressions are checked separately.

Commands:

```sh
node tests/scene-size-layouts-test.cjs
node tests/scene-width-controls-test.cjs
node tests/scene-desk-objects-test.cjs
node tests/scene-desk-data-test.mjs
node tests/browser-design-storage-test.mjs
node tests/preset-artwork-isolation-test.cjs
node tests/artist-canvas-light-test.cjs
node tests/rearrange-targets-test.cjs
```
