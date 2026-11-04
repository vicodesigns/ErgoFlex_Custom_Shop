# Institutional and library material pass

The common furnishing batch used one highlight response for paper, cloth, ceramic, steel and glass. Added optional finish hints to the existing `detailKit` API. It preserves vertex colours, original artwork maps, geometry, fixture IDs and transforms, while grouping geometry by finish within the same mesh.

- Paper: matte fibres and fine roughness variation.
- Fabric: woven microrelief with a broad, subdued highlight.
- Rubber: shallow grain and low sheen.
- Ceramic: a restrained glazed highlight.
- Metal: fine directional marks and stronger reflections.
- Glass and liquid: transparent dielectric surfaces, with zero metalness.

These finishes now distinguish shared books/notebooks, campus activity kits, clinical glassware, printed sheets and handover cups. Existing government and IT material families retain their authored responses through `roomFinishLocked`.

Education furniture gained shallow linear relief for wood/HPL, fabric and leather. Healthcare linen and wood gained relief at submillimetre scale. Library wood, flooring, wool rugs and linen drapes now have distinct surface response. Humboldt bags and coats sample woven atlas tiles without increasing their draw count. Corrected a Humboldt laminate bump scale from 0.12 world units to 0.12 mm, preventing exaggerated normals.

The existing room-specific lighting and daypart profiles remain compatible. These edits do not add lights or change lamp placements.

Verification: `node tests/institutional-material-finishes-test.mjs` passes finish grouping, preserved artwork, contact geometry, linear map data and disposal. All eleven edited modules pass syntax checks. Repeated geometry checks pass for 60 institutional daypart kits (526 parts), static educational props versus daypart kits, the OCC printer counter and all 592 café reading-kit vertices. Browser appearance/shader verification is handled by the parent task.
