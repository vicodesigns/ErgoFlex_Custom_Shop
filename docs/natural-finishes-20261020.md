# Natural furnishings and daylight — 20 October 2026

## This pass

- Replaced the older spherical `decor-plant2` topiary with the supplied leafy plant wherever that prop appears. The replacement fits within all three original dimensions. Its fit lives beneath the editable root so saved scale, movement, and deletion continue using the original identity.
- Rebuilt the shared small institutional plants with tapered, folded leaves, attached stems, inset soil, small soil granules, and rounded planter rims. These parts remain merged into their parent furnishing; they add no editor selections or floor obstacles.
- Added inset page blocks, spine bands, and small shelf labels to shared book collections.
- Extended instance-owned finishes to unfinished Kenney furnishings, including the previously excluded cushioned benches. Upholstery uses each room's palette and subtle woven relief. Mapped artwork, authored material locks, and cached source materials are preserved.
- Differentiated morning and afternoon daylight: diffuse light in reading, art and clinical rooms; stronger morning sunlight in domestic rooms; restrained work lighting elsewhere. Evening/night palettes and sci-fi lighting retain their authored behaviour.
- Consolidated disposal of replaced fixtures and active room furnishings so shared surface textures are released once when switching environments.

## Verification

- Existing structural suite: **28 environments, 105 layouts, 525 activity checks passed** after the furnishing changes.
- Added checks for replacement-plant dimensions, editable root scale, and source-material isolation: **6 affected environments, 27 layouts, 135 activity checks passed**.
- Lighting regression: **15 environment families × 5 times passed** across the completed runs, including shadow coverage, movement, hidden objects, and texture disposal. The test now accounts for cached screen textures, explicitly owned detail textures, and additional ErgoFlex desks in its shadow count.
- Inspected 12 afternoon/night previews covering lounge, gym, kitchen, library, HBHS, and OCC media lab. No missing assets or reported browser errors. Kitchen, library, HBHS, and OCC previews include the new daylight balance; lounge and gym captures preceded that final lighting adjustment.
- Review artifacts: `scene-shots/natural-finishes-20261020/` and `/tmp/ergoflex-natural-finishes-20261020/`.

The build marker is `natural-finishes-20261020`. This pass changes shared room presentation code; it does not migrate or rewrite saved desk builds or user artwork.
