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
| `assets/wood/birch.jpg` | Natural Birch, and Black Ash tinted | [Poly Haven](https://polyhaven.com/a/white_maple_veneer) | `white_maple_veneer` |
| `assets/wood/white-oak.jpg` | White Oak | [ambientCG](https://ambientcg.com/a/Wood049) | `Wood049` |
| `assets/wood/walnut.jpg` | Walnut | [ambientCG](https://ambientcg.com/a/Wood051) | `Wood051` |
| `assets/wood/cherry.jpg` | Cherry | [ambientCG](https://ambientcg.com/a/Wood092) | `Wood092` |
| `assets/wood/maple.jpg` | Maple | [ambientCG](https://ambientcg.com/a/Wood095) | `Wood095` |
| `assets/wood/mahogany.jpg` | Mahogany | [ambientCG](https://ambientcg.com/a/Wood027) | `Wood027` |
| `assets/wood/bamboo.jpg` | Bamboo | [ambientCG](https://ambientcg.com/a/Wood058) | `Wood058` |

Each is the Color/Diffuse map only, at 1K, recompressed to quality 80 — about
670KB for the set. Normal, roughness and displacement maps were not taken; the
material's own roughness and clearcoat come from `SURFACE_TREATMENTS`.

`bir.jpg` is the original birch photograph and is no longer referenced.

## How they are applied

`photo` names the image and `tint` multiplies it, which is how one photograph
serves two finishes: **Black Ash is the birch surface pulled down to a satin
black**, so it keeps birch's grain rather than needing its own image. Tints also
correct hue where a generic photograph is close but not exact — the oak reads
slightly grey and the cherry slightly pine-like on their own.

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
