# Wood textures

Every wood species is a photograph. Procedural grain is now only a fallback: it
still draws the plywood **edge** laminations, and stands in for a face veneer if
an image fails to load.

## Why photographs

The generated grain was drawn with sine periods that did not divide the 512px
tile, so `RepeatWrapping` put a hard discontinuity at every tile edge — measured
at 6-24x a normal pixel step. Ring spacing was also far too coarse: roughly 30in
of desk per tile holding about 14 rings, so each ring came out about two inches
wide. Together those read as broad bands rather than grain.

## Sources

All files below are **CC0 / public domain**, so redistributing them in this
repository carries no attribution requirement. Attribution is recorded anyway,
because knowing where an asset came from matters when replacing it.

| File | Species | Source | Asset |
| --- | --- | --- | --- |
| `bir.jpg` | Natural Birch, and Black Birch reprocessed | Supplied with the project | — |
| `assets/wood/white-oak.jpg` | White Oak | [ambientCG](https://ambientcg.com/a/Wood049) | `Wood049` |
| `assets/wood/walnut.jpg` | Walnut | [ambientCG](https://ambientcg.com/a/Wood051) | `Wood051` |
| `assets/wood/cherry.jpg` | Cherry | [ambientCG](https://ambientcg.com/a/Wood092) | `Wood092` |
| `assets/wood/maple.jpg` | Maple | [ambientCG](https://ambientcg.com/a/Wood095) | `Wood095` |
| `assets/wood/mahogany.jpg` | Mahogany | [ambientCG](https://ambientcg.com/a/Wood027) | `Wood027` |
| `assets/wood/bamboo.jpg` | Bamboo | [ambientCG](https://ambientcg.com/a/Wood058) | `Wood058` |

Each is the Color/Diffuse map only, at 1K, recompressed to quality 80 — about
670KB for the set. Normal, roughness and displacement maps were not taken; the
material's own roughness and clearcoat come from `SURFACE_TREATMENTS`.

`bir.jpg` is the supplied birch photograph and is the source for both birch finishes.

## How they are applied

`photo` names the image and `tint` multiplies it, which is how one photograph
serves two finishes: **Black Birch is the birch surface pulled down to black**, so
it keeps birch's grain rather than needing its own image. Tints also correct hue
where a generic photograph is close but not exact — the oak reads slightly grey
and the cherry slightly pine-like on their own.

Black Birch needs more than a tint, and `processGrainPhoto` builds it a duplicate:

- **grayscale**, because the photograph's own warmth survives a dark tint and the
  result reads as brown rather than black;
- **contrast stretched**, because multiplying a pale, low-contrast surface toward
  black scales its grain variation away to nothing;
- **relief and gloss**, via `bumpScale` and `grainSheen`, since at that tone the
  grain cannot be carried by colour at all. That is how stained black timber reads.

The source photograph is untouched and still used at full tone by Natural Birch.

`repeatsPerInch` keeps grain scale physical: one tile covers
`1 / repeatsPerInch` inches of desk, and each surface derives its own repeat from
its own measured size, so grain does not stretch with the desk.

Textures are cached per **image path and role**, not per species, so finishes
sharing an image share the upload. The per-role split is required: one `Texture`
carries one `repeat`, so a single shared instance would let each role overwrite
the previous role's grain scale.

## Not confirmed

These are visual approximations chosen to read as the named species. **They are
not scans of the actual material this desk would be built from**, and no finish
here has been confirmed against a manufacturer sample. Species naming is
descriptive of the intended look, not a material specification.
