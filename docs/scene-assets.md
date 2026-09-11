# Scene assets: the prop library

`models/` holds the 3D files supplied for this project. `assets/props/` holds the
web-ready conversions the studio actually loads. Nothing in `models/` is served
to the browser — the sources are USDZ and Rhino files, which browsers cannot
open, and they total 53 MB against 17 MB for the whole converted library.

`models/` is in `.gitignore`, so the sources are local to the machine that has
them and only the converted library is committed. A fresh clone can run the app
but cannot re-run the conversion, and a prop deleted from `assets/props/`
cannot be rebuilt without the original file. Keep `models/` backed up
somewhere, or the library becomes the only copy.

## Licensing is unconfirmed, and that matters before this ships

**Every USDZ source is a Sketchfab export**, confirmed by the `Sketchfab_model`
prim each one carries. Sketchfab distributes models
under per-model terms: CC-BY (attribution required), CC-BY-NC (no commercial
use), and the paid Sketchfab Standard and Editorial licences. Those terms are
not recorded in the files, so this repository cannot tell you which applies to
which model.

Separately, a number of props depict trademarked products, brands or
characters: Apple hardware, Razer and Samsung devices, LEGO models including a
Spider-Man figure, a Sonic statue, mouse-ear hat, NASA mug, a Pepsi can and a
Tesla-branded bottle. Depicting those in a commercial storefront is a
trademark question independent of the model licence.

Every entry in `assets/props/index.json` therefore carries
`"license": "unconfirmed"` and `"attribution": null`. Fill those in per prop in
`tools/props/manifest.json` as terms are verified, and re-run the converter.
Until then, treat this library as an internal design tool. Shipping it publicly
needs the per-model licence checked, attribution rendered where CC-BY applies,
and non-commercial or brand-encumbered props removed.

This also contradicts the older claim in
[workspace-previews.md](workspace-previews.md) that no third-party model files
are redistributed. That claim held for the procedural accessory geometry and
still does; it does not cover this library.

## What the library contains

| | |
| --- | --- |
| Props | 339 in 15 categories |
| Sources | 368 USDZ, 7 Rhino `.3dm`, totalling 2.9 GB |
| Library on disk | 116 MB, of which 101 MB is models and 15 MB thumbnails |
| Median prop | 197 KB |
| Largest three | `hangar` 3.1 MB, `room-gallery` 1.9 MB, `kitchen-run` 1.8 MB |
| Triangles | 6.9 million, decimated from 26.5 million |
| Screen wallpapers | 5, copied through unconverted |

Sixteen source files are unused. Fifteen duplicate another entry byte for byte,
including three copies of one office set and two each of several rooms,
guitars and figures. Two more were dropped as unusable and are listed under
`_dropped` in the manifest with the reason: one is a skinned figure whose
meshes collapse to nothing at rest, and one is a figure fused into an 8.6 m
ground plane as a single mesh, so the plane cannot be removed.

## The conversion pipeline

`node tools/convert-props.mjs` reads `tools/props/manifest.json` and writes
`assets/props/*.glb` plus `assets/props/index.json`. Flags: `--only id,id`
converts a subset, `--no-optimize` skips compression, `--keep-raw` keeps the
uncompressed intermediates.

It needs two things that are not npm dependencies, both pointed at by
environment variables:

```sh
BLENDER=/path/to/blender PYTHON=/path/to/python-with-rhino3dm node tools/convert-props.mjs
```

- **Blender** (headless, 4.5 LTS was used) runs `tools/props/blender-convert.py`
  for the import, scaling and export. USDZ import, real-world scaling and GLB
  export all happen in one process for the whole batch.
- **Python with `rhino3dm`** runs `tools/props/rhino-to-obj.py` first for `.3dm`
  sources. `rhino3dm` cannot mesh a NURBS surface, so the exporter walks the
  render meshes Rhino cached in the file. A Rhino file saved without them
  exports nothing and says so rather than writing an empty model.
- **`@gltf-transform/cli`** is an npm dev dependency and needs no setup.

Three stages, in order:

1. **Import and normalise.** Anything that is not a mesh is dropped, along with
   objects matching the manifest's `exclude` patterns — Sketchfab exports
   frequently ship a ground disc or floor slab with the model, and two props
   needed one removed. Image-free materials take the manifest's `material`
   override, which is how the untextured Rhino geometry stops rendering black.
2. **Scale and anchor.** Each model is scaled so its bounding box measures
   `fit.mm` millimetres along `fit.axis`, rotated by `rotateY`/`rotateX`, then
   moved so its origin sits on its anchor. Transforms are baked and the result
   is exported as a Y-up GLB in metres.
3. **Decimate to budget.** Each prop carries a `budget` triangle count, and
   anything above it goes through Blender's collapse decimator. This happens in
   Blender rather than after export on purpose: glTF splits a vertex for every
   unique normal and UV, so a post-export simplifier sees a photogrammetry mesh
   as almost entirely unshared vertices and barely reduces it. One games console
   went 179,078 → 164,425 triangles through `gltf-transform simplify` at any
   error tolerance, and 179,078 → 30,562 through Blender, which took the file
   from 1.9 MB to 420 KB. Blender keeps normals and UVs as loop data over shared
   vertices, so it collapses the real topology.
4. **Optimise.** `gltf-transform optimize` applies meshopt compression, resizes
   textures and re-encodes them as WebP. The desk lamp went from 1.49 MB to
   172 KB this way. Texture size is 1024 px by default, 512 for small props
   where the difference never reaches the screen.

Budgets default by category — 12,000 triangles for desk, food and tool props,
20,000 for decor and electronics, 40,000 for furniture and figures, 100,000 for
environments — and any prop can override it. Of 341 props, 159 needed
decimating; the library holds 7.0 million triangles against 26.8 million in the
sources.

The studio loads these through `GLTFLoader` with `MeshoptDecoder` attached.
Loaded models are cached and cloned, and the clones share geometry and
materials, so placing the same prop in a scene twenty times costs one download
and one GPU upload.

### Why the sizes are estimates

USDZ carries no reliable real-world scale. Every source here declares 0.01
metres per unit and Y-up, and the resulting sizes were nonsense — a cat 0.35 m
long next to a desk lamp 8.5 m across. Rather than trust the file, the manifest
states the intended real-world size of each prop and the pipeline scales to it.

**Those numbers are design estimates, not manufacturer data.** They are chosen
so props read correctly beside a desk. Where a figure is deliberately off life
size, the manifest records a `sizeNote` that is carried into `index.json` —
the LEGO minifigure is shown at 100 mm, larger than a real one, so it reads at
desk scale.

The Rhino files are the exception: those carry genuine units, and
`rhino-to-obj.py` converts inches or millimetres to millimetres honestly. The
manifest's `fit` for them matches their real dimensions.

### Anchors

`anchor` decides where a prop's origin sits, so a placement only needs a
position:

| Anchor | Origin | Count |
| --- | --- | --- |
| `floor` | Base at y = 0, centred in x and z | 93 |
| `ceiling` | Top at y = 0, so the prop hangs from the placement height | 4 |
| `wall` | Back face at z = 0, facing +z, centred vertically | 6 |
| `wall-floor` | Back face at z = 0 and base at y = 0 | 2 |

Blender works Z-up while glTF and the manifest are Y-up. The converter maps
between them in one place and reports final bounds in Y-up, so the manifest
never has to think in Blender's axes.

## Thumbnails

`node tools/props/thumbnails.mjs` renders every prop with the same Three.js
build the studio uses and writes `assets/props/thumbs/<id>.png`. The studio's
prop library grid uses these directly. `--sheet out.png` also writes a labelled
contact sheet with each prop's measured size and triangle count, which is the
fastest way to review scale and orientation across the whole library.

Reviewing the sheet is not optional, and it has earned its place. Two bugs in
the pipeline itself only showed up there:

- **Sizes landed short.** Blender's `object.bound_box` goes stale once a
  modifier is applied and a view-layer update does not refresh it, so every
  decimated prop was measured against its pre-decimation box. A statue asked for
  2020 mm exported at 1683 mm, and floor anchors left those props hanging in the
  air. The converter now measures bounds from vertex positions, which cannot go
  stale, and decimates before it measures.
- **Props rendered as black silhouettes.** Several sources ship a diffuse map
  the USD importer leaves unconnected — a specular/glossiness workflow Blender
  does not read, or a PBR material whose constant `diffuseColor` is black while
  the real colour sits in a texture. The converter now wires a colour-looking
  image into an unlinked, near-black Base Color.

Ground discs and floor slabs that ship with a model, mislabelled files, and
sizes wrong by a factor of ten all surface the same way. The contact sheet is
the review step; treat a conversion as unfinished until you have looked at it.

## Reviewing rooms

`node tools/props/scene-shots.mjs` screenshots every room scene from the real
app. `--only id,id` limits the scenes, `--views hero,front,top` picks cameras,
`--out dir` sets the destination. It starts its own server and loads the actual
desk model, so it needs network access like the smoke test does.

## Adding a prop

1. Put the source in `models/`.
2. Add an entry to `tools/props/manifest.json` with an `id`, `name`,
   `category`, `scenes`, and the real-world `fit`. Add `anchor` unless it stands
   on the floor.
3. `node tools/convert-props.mjs --only your-id`, then
   `node tools/props/thumbnails.mjs --only your-id`.
4. Check the reported size and the thumbnail. Fix `fit`, `rotateY`, `exclude` or
   `material` and re-run until it looks right.
5. To place it in a room, add it to that scene's `props`, `desk` or `shelf` list
   in `workspace-3d.mjs`. To make it available for hand-placing in the studio,
   nothing further is needed — the library grid lists everything in
   `index.json`.
