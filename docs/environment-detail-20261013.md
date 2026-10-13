# Environment detail pass — 13 October 2026

All 28 room environments share the updated surface and activity finish pass.
Every morning, afternoon, evening, night and group activity retains its authored
layout and lighting identity.

## Room finish and lighting

- Physical surface textures now use 256px maps: finer wood pores, directional
  brushed metal, woven fibres, honed stone variation, rubber grain and restrained
  powder coating. Authored image maps and imported geometry keep their UVs.
- Every room has its own palette for textiles, paper, ceramic and small accents,
  including the institutional rooms and the OCC media lab.
- Afternoon fill is slightly reduced for depth. Evening and night fill/bounce
  retain more detail, with stronger task pools and readable secondary lamps.
  The existing ceiling bounce approximation and single shadow map remain.
- Notebooks have page edges and printed activity pages. Cups and bowls have
  hollow profiles, ceramic sheen and recessed contents. Small brushes have
  ferrules and strands; towels have hems; music accessories have finer details.

## Supplied collection

33 source GLBs are copied into the ignored `models/ergoflex-supplied` folder.
Their normalized, compressed GLBs and thumbnails are tracked in `assets/props`.
Find them in **Editor tools → Prop library → ErgoFlex Collection**, or the
existing **Add from the object library** controls on each desk.

The collection includes notebooks, a calendar, pencil cup, paper tray, printer,
accessory shelves, glasses, laptop, travel cup, picture frames, sofa, drawer
console, three plants, clamp cup holder, mini computer, chairs, mirror, cat
figurine, bin, violin, handbag, handheld console, balloon dog sculpture, watch,
earbuds, camera and phone. The `.glbbak` camera is a backup of the supplied GLB;
it is not a second library entry.

Blender repairs give black CAD placeholders appropriate material classes.
Accessory shelf boards are fitted by width; the mini computer is 197mm wide.
The laptop has a correctly aligned thin display, keyboard and touchpad, with its
screen connected to scene themes and the existing display power controls.
Dimensions are visualization estimates, not manufacturing measurements.

Selected new models are used in daily dressing: reading glasses, notebooks,
travel cups, pencil cups, an OCC camera, handheld gaming, earbuds, watch and
phone. Background foliage/laptops use the supplied models where appropriate.
Replacement room props keep their original editor keys and positions, and
cannot exceed their previous floor/table footprint. Daily objects stay inside
their existing activity owner; saved desk builds, accessories, monitor mounts,
artwork and independent 48/60-inch setups are untouched by this presentation pass.

## Reproduction

`BLENDER=/path/to/blender node tools/convert-props.mjs --only <ids>` uses the
`environment-decor` repair hook. The manifest records all 33 IDs, fits, materials,
source paths and revision. Conversion supports Blender's newer material API.

`npm run test:environment-detail` checks every environment and five time settings,
finite room geometry, physical surface UVs, reversible activity-owner transforms,
non-accumulating lighting, single-shadow lighting budget, screens and independent
width builds. It also checks the 33 model files, dimensions and thumbnails.
Use `--all-layouts` for the exhaustive layout variant; screenshots and the JSON
audit go to ignored `scene-shots/environment-detail`.

## Scale follow-up

The decoded vertex bounds of all 754 GLBs were compared with the library's
millimetre dimensions. No uniform metre/millimetre/inch error remains in the
converted files. Two older entries have minor single-axis metadata differences
(carpet thickness and wireless charger width); these do not indicate mixed units.
The source fits are independent of any GLB's original units. The large/small
accessory shelves use 800/450mm widths, the mini computer uses 197mm, and the
insulated coffee cup is now 90mm wide and approximately 122mm high.

All 33 new entries have a fresh asset revision, and older library models now
have a fallback cache revision. A runtime bounds check corrects only uniform
unit mismatches inside the source hierarchy. It leaves the editable root intact,
so saved sizes, positions and rotations survive normalization. The Artist
executive setup exported from the open tab was restored in an isolated browser;
its scene activity and desk kit are bounded at approximately 325mm and 155mm,
and its edited sketchbook remains at its saved position at a 300mm width.

`npm run test:prop-scale` checks metre, millimetre and inch conversion and excludes
shape differences. The environment regression also checks synthetic raw exports
with saved 150% instance sizing, verifying a 300mm model remains 450mm after
normalization rather than returning to its oversized source units.
