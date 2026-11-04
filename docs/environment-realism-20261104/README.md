# Environment materials and child-room pass

## Changes

Specialists reviewed the home, creative and institutional environment families. Their changes refine existing scenes rather than replace their identity:

- Surface-specific wood grain, fabric weave, ceramic glaze, paper, rubber and brushed-metal detail. Painted timber and coated steel remain dielectric; genuine exposed metal retains metallic reflection. Food and candle wax no longer share porcelain finishes.
- Authored roughness is preserved by `roomFinishLocked`; physically authored normal/roughness UVs survive shared refinement through `roomDetailAuthored`.
- Institutional merged details retain batching while grouping geometry by finish. The secondary-desk light updater now handles material arrays.
- More neutral daytime task lighting, warm evening practicals, less self-lit gallery artwork, and correctly scaled Humboldt laminate relief.
- Room-specific additions and contacts: artist cleanup supplies, music storage, gallery guides, media finishing tools, kitchen cookbooks, bedside dishes, bookshelf and furniture clearances.
- Default daily desk kits are fitted to the actual CAD face, including the concave front edge. Crowded desks can rotate a notebook to find a clear patch. Editor-saved arrangements are not rewritten.

## Child’s room

New `childroom` environment is selectable in the Studio and Director catalog. All five room layouts default to the real 48 × 30 inch ErgoFlex desktop, retaining its actual height limits.

| Layout | Room dimensions | Additional character |
| --- | --- | --- |
| Cozy room | 3.8 × 4.4 m | Low house bed, story rack, reading cushion, play mat |
| Storybook bedroom | 4.6 × 5.2 m | Wooden pretend market |
| Little maker | 5.6 × 6.2 m | Shared low drawing table, stools, drawing gallery |
| Story garden | 6.6 × 7.2 m | Soft canvas discovery tunnel |
| Little worlds | 7.8 × 8.2 m | Larger separated discovery and shared play zones |

Five activities: Wake & discover, Make & play, Story time, Sleepy stars, and Family play. Their props and lighting change with the activity. Original procedural illustrations, soft cloth rabbit, wooden blocks and train, woven toy baskets, oak floorboards and linen curtains are authored locally. No external assets or reference project were modified.

## Verification

- `npm run test:environment-finishes`: desktop cutout/edge support, finish grouping/artwork/linear data maps, and all 25 child-room size/activity combinations.
- `node tests/headphone-hook-assets-test.mjs` and `node tests/scene-desk-data-test.mjs`: original hook dimensions, material identity, saved placements, deleted hooks and width changes.
- Specialist geometry harnesses built the existing home, creative and public recipes, checking finite geometry, targeted surface contacts, catalog furniture bounds, mapped UV inputs and owned texture cleanup. Institutional review notes describe the measured scope in detail.
- Browser review uses the isolated local render server, leaving the main Studio's saved arrangements alone. JSON reports and screenshots accompany these notes. A first kindergarten sample used an unavailable layout; it is excluded and followed by a corrected apartment-layout check.

These are targeted geometry and rendered-scene checks. They do not certify arbitrary user-created arrangements or every irregular imported mesh as collision-free.
