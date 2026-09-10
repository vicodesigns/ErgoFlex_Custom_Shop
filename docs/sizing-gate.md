# Sizing feasibility gate — findings

Status: **blocked on product input. Do not start the sizing implementation.**

The roadmap made real width/depth customization conditional on measuring the
asset first rather than assuming its shape. The measurements are in, and they
contradict three assumptions the sizing plan rested on. Reproduce with:

```sh
node tools/measure-asset.cjs
```

## 1. The width axis is Z, not X

Every load-bearing assembly is symmetric about Z and asymmetric about X:

| Assembly | Spread along Z (in) | Spread along X (in) |
|---|---|---|
| Lift columns | −17.4 … +17.5 | −14.7 … −4.4 |
| Linear actuators | −18.0 … +18.1 | (one side) |
| Wheels | −21.9 … +21.9, two clusters at ±20 | −16.1 … +7.0 |
| Plates/screws/joinery | −20.6 … +20.7 | concentrated at −12 to −15 |

So the desk's **width runs along Z** and its **depth along X**. The leg clusters
do partition cleanly into two groups, which is what the segment-and-rescale
approach needs — but on the opposite axis from the one the plan named.

This is the same root cause as two bugs already fixed in this branch: the Front
and Side camera presets had their direction vectors swapped, and the glide
sliders labelled X as "sideways" when X is forward/back. Anything that assumes
X is width in this model is wrong.

## 2. The desktop is a fabricated assembly, not a slab

`Desktop*` is four meshes, and only one of them is the work surface:

| Mesh | W × D × T (in) | Vertices | What it is |
|---|---|---|---|
| `Desktop_3` | 32.0 × 44.1 × 3.5 | 3,654 | the top slab |
| `Desktop` | 0.9 × 42.6 × 2.4 | 3,202 | an edge / fascia strip |
| `Desktop_1` | 35.1 × 0.7 × 18.4 | 4,616 | a vertical side panel |
| `Desktop_2` | 35.1 × 0.7 × 18.4 | 4,619 | the opposing side panel |

**The vertex counts are the finding that matters.** A featureless rectangular
slab is 8–24 vertices. Three to four thousand per mesh means rounded corners,
fillets, cutouts, or holes. Non-uniformly scaling these meshes would scale those
features with them: a 1.5× stretch turns round grommets into ovals and thickens
the edge profile on one axis only. It would read as wrong under any close orbit,
which is exactly the presentation Phase 3 is about to make easier to reach.

The plan permitted a stretch only "across spans verified to be feature-free".
That verification has now failed.

## 3. The asset matches no catalog SKU

Overall bounding box: **36.4 in (X, depth) × 44.6 in (Z, width) × 61.6 in (H)**,
with the top slab at 32.0 × 44.1.

The catalog offers 48×30, 60×30 and 72×30 (`PRODUCT_CONFIG.sizes`). The
reference assembly is roughly **44 × 32**, which is neither. Before any size can
be made "real", someone has to say which SKU this asset actually is — otherwise
the sizing code would be interpolating from a baseline that does not correspond
to a product.

## What is still needed before implementation

These are product questions, not engineering ones:

1. **Which SKU is this GLB?** Its 44 × 32 does not match 48×30, 60×30 or 72×30.
2. **How does the real desk change with width?** Do the legs move outward, does
   the top overhang fixed legs, or is the frame different per size? The
   measurements show the legs *could* move (they partition cleanly on Z), but
   whether they *do* is a manufacturing fact.
3. **Is the desktop authored parametrically upstream?** If the CAD source can
   export per-size variants, three authored GLBs sidestep the feature-distortion
   problem entirely — at the cost of per-GLB baked rig constants, since
   `editorId`s are traversal-order dependent.
4. **Depth is not currently a product axis at all.** All three SKUs are 30" deep.
   Real depth customization needs depth SKUs to exist first.

## Recommendation

Given the vertex counts, **segment-and-rescale is off the table for the
desktop**. Two paths remain:

- **Authored size variants** — cleanest visually, no feature distortion, and it
  answers question 2 by construction. Cost is CAD export time plus one set of
  baked rig constants per GLB.
- **Parametric desktop geometry** — replace `Desktop_3` and its edge pieces with
  generated geometry driven by width and depth, keeping the authored frame and
  translating the leg clusters along Z. Honest at any width, but it means
  authoring the desktop's profile in code, including its edge treatment.

Translating the leg clusters along Z is viable under either path and is the one
piece of the original plan that survives the measurements intact.

Until questions 1–3 are answered, the storefront should keep saying what it says
now: the size selector updates the estimate, and the 3D view shows the reference
assembly.
