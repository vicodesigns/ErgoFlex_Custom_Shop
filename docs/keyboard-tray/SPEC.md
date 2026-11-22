# Keyboard tray as an articulated part in the Director: specification

Status: design, updated 22 Nov 2026 with Vico's answers (section 0.1, which overrides anything below that disagrees with it). Original base: `438b648b` (branch `ui/keyboard-tray-spec`). Build branch: `ui/keyboard-tray-build`. Author: Claude, 21/22 Nov 2026.
Request (Vico): the keyboard tray becomes an articulated skeleton like the real ergonomic tray (the surface TILTS; other hinges let it SWING and TUCK AWAY). Double-click the tray in the Director to get its own controls (tilt / swing / tuck, inside real limits). Its own animation lane with its own keys, apart from the desk's lift / tilt / wheels lanes, so he can pose it in several positions first and an engineer then works out how it travels between them. It has to look right: real hinge points, nothing through the desk, a believable tucked pose. "As long as they look at our existing framework": every section below starts from what the code does today.

Honesty marks used throughout: **measured** (read from the glb / code), **inferred** (read off the geometry, needs a check), **proposed** (my design choice, number to be confirmed), **unknown** (needs Vico, a photo or the real hardware).

---------------------------------------------------------------------------------------------------

## 0. Summary of the design

1. Keep the tray a catalog accessory riding the desktop frame. Add a second asset, `ergoflex-keyboard-tray-rig.glb` (same geometry cut into hinged parts); the stage loads it **only when a chapter carries tray keys**. No keys = the rigid glb, byte for byte what renders today.
2. Joint chain (section 0.1 and 2.3): fixed track -> **slide** (carriage along the track, 254 mm) -> **swing** (vertical pivot at the track's end, +-180 degrees) -> **tilt** (horizontal hinge at the forks) -> plate. The keyboard and mouse stay on the plate and follow it. A **drop** joint (0..165 mm, the mount height) lowers the whole tray so a keyboard fits under the desktop.
3. Pose = `{slide, swing, tilt, drop}`. Defaults 0/0/0/0 = the glb as authored (extended, level, undropped).
4. Keys live in a new shot field `trayEdits` (not in `motion.clips`), in chapter seconds, with a per-key ease and a per-segment route; sampled by one pure module used by the live stage and the film render.
5. Director: double-click the tray = **Tray mode** (like people Pose mode): panel with three sliders, hinge handles on the stage, a "Tray" lane of key diamonds, jog / copy / paste.
6. Plausibility = per-joint limits + coupling table (swing and tilt shrink as the tray slides in; the drop it needs with a keyboard on it grows as the plate goes under the desk), precomputed from a clearance probe against the real desk geometry, plus a runtime clamp from that table. The tuck with a keyboard on it is a real problem in this CAD (section 6.3).
7. Phases: about 12 working days for one engineer; the Windows machine is needed for the browser, clearance probe and render checks (section 9).

---------------------------------------------------------------------------------------------------

## 0.1 Vico's answers (22 Nov 2026): the decisions this spec now follows

Source: the product Vico has in mind, Amazon "Keyboard Tray Under Desk with Storage Drawer, Height Adjustable, Slide Out 360 Swivel Tilt" (ASIN B0GC643XT7, AX WABER). Screenshots: `/home/ergo/.claude/uploads/1c39807e-d572-43fd-b4a6-3a93f7e8be89/1233fdd6-image.jpg` and `8c5db007-image.jpg`. What they show: "6.5 in ADJUSTABLE HEIGHT" (the mount height, 6.5 in = 165 mm), "10 in Stretching range" (the slide), "Easy Stored When not Use" (the tray pushed in) and "Side Storage" with a 19 in span and a curved arrow (the tray swung round to the side under the desk, keyboard and mouse still on it). Vico: "It can tilt the surface and swivel to be tucked away. Totally."

| Question (old section 11) | Answer | Consequence in the spec |
|---|---|---|
| 1 Which tray | The product above, a similar one, not an identical unit | The CAD is the geometry, the product the behaviour. The CAD has no vertical hinge; the swing pivot is **invented at the track's end** (the carriage front pin line, 2.3) and rides with the slide. |
| 2 Ranges | **Slide** about 254 mm (10 in); **tilt** keep +-15 degrees unless the CAD shows more (it does not: the CAD gives no angle stop); **swing** about a **vertical** pivot at the track's end, the whole tray swings out to the SIDE and is stored along the desk's side ("Side Storage"); limit **+-180 degrees** (the product's "360" is a claim); **height at the mount 0..165 mm** reserved / optional | Joint table 2.3. The old `tuck` joint is called **`slide`**; the old "folds up flat" reading of tuck is dropped. |
| 3 Mounting | Default: the tray stays fixed to the tilting top, as now | No `level` option in v1 (it stays a v1.1 idea in 6.3). |
| 4 Keyboard on the tray | The keyboard and mouse **stay on the tray** when it is tucked: no put-away, options A and C of 6.3 are out | The clearance must be checked **with a keyboard on the tray**. At the CAD's 19.7 mm plate drop a keyboard (30 to 45 mm) cannot go under the desktop, so the reserved **`drop`** joint is **real** (the product mounts the track lower): the sampler raises `drop` to the minimum that clears the desktop whenever the plate is under it (6.3, section 6). |
| 5 Chapters | Tray keys only where Vico adds them | No chapter gets keys by default; epoch untouched. |
| 6 People | Hands leave the keys while the tray moves (v1) | As 6.3 "People". |
| 7 Render policy | The rig glb is used only in chapters with tray keys: **no render-epoch bump** | As 3 and 7.3. |

Decisions taken while building phase 1 (mine, to be confirmed by the probe or Vico):
* **Names and units.** Pose = `{slide, swing, tilt, drop}`: `slide` 0..1 of the travel (0 = as authored = the tray out in front, 1 = pushed all the way in; layout independent), `swing` degrees (+ = plate front to the user's right), `tilt` degrees (+ = front edge up), `drop` **millimetres** 0..165 (a real quantity: a keyboard needs about 28 mm, so it is not normalised). Where the text below still says `tuck`, read `slide`; "tucked" as a pose name still means pushed in and/or swung away.
* **Slide travel** is 254 mm (Vico, the product). The CAD track gives only 239.5 mm between the carriage and the rear stop; the rig either lengthens the track by 15 mm or the travel constant is lowered to 239.5 (`SLIDE_TRAVEL_MM`, phase 2).
* **Drop** is the whole tray moving straight down at the mount. The CAD's sloped links give only about 58 mm; the rig shows the full range by translating the tray body (phase 2 decides the look).
* **Coupling** (starting values, replaced by the probe's table): `swing` is free to +-180 while `slide` <= 0.4 and falls to 0 at `slide` 0.85; `tilt` is +-15 while `slide` <= 0.4 and narrows to -2..0 at 0.85, and also narrows as the swing carries the plate under the desk (|swing| 20 to 60 degrees). Clamp order: slide, then swing, then tilt, then drop.
* **Under the desk** is a pose-only fraction 0..1 (`underDesk`): the larger of the slide ramp (0.45 to 0.75) and the swing ramp (|swing| 20 to 60 degrees). Needed drop = `rider thickness - 19.7 + 3 mm` times that fraction. The authored pose is 0 by construction, so a tray with no keys, or keys at rest, is never lowered.
* **Before the first key** the tray eases from `initial` (an implicit key at 0 s) to the first key, so a first key at 3 s does not make the tray jump; add a key at the rest pose just before to hold it still until then.
* **Storing keys.** Defaults are omitted (`ease` smooth, `route` auto), as people pose keys do; a key's `pose` may name only the joints it changes; keys are held to the joints' hard limits when cleaned and to the coupling table only when sampled.

---------------------------------------------------------------------------------------------------

## 1. What exists now (the tray's data path, end to end)

### 1.1 Catalog, asset and build
| Step | Where | What it does |
|---|---|---|
| Catalog entry | `catalog.mjs:190` | `{id:'keyboard-tray', visual:'tray', propId:'ergoflex-keyboard-tray', finishes:['black','white','steel'], "Follows the desktop as it lifts and tilts"}`. In the presets of `office`, `gaming`, `music`, `library`, `occ`, `hbhs` (`catalog.mjs:226-233`, `preset-defaults.mjs:8-29`). Not in `artist`, `architect`, `compact`, `creative`. |
| Manifest | `tools/props/manifest.json:12531` | source `ergoflex-supplied/KeyboardTray.glb`, `rotateY:90`, `anchor:"ceiling"`, `fit:{axis:x, mm:679}`, `repair:"ergoflex-collection"`. |
| Repair | `tools/props/supplied_model_repairs.py:68-74` | after fitting, turns every root **80 degrees about Blender Z** (glTF Y), keeps the ceiling anchor. |
| Converter | `tools/convert-props.mjs:159` (Blender, `tools/props/blender-convert.py:225-245`) then `:178` (`gltf-transform optimize --compress meshopt`, default flatten + join) | This is why the shipped glb has **2 nodes / 2 meshes**: the optimizer joined the CAD's pieces. |
| Source | `models/ergoflex-supplied/KeyboardTray.glb` (git-ignored, `.gitignore:7`; copy at `~/Manifest-Share/ErgoFlex/KeyboardTray.glb`) | Draco, 7 unnamed meshes, CAD inches. |
| Shipped | `assets/props/ergoflex-keyboard-tray.glb` (90 684 bytes, 11 121 tris), `assets/props/index.json` entry: size `[494, 96.7, 698]` mm, min `[-284.3,-96.7,-343.2]`, max `[209.6,0,354.8]`. `sizeNote`: "CAD coordinates treated as inches; dimensions are visualization estimates, not verified mounting specifications." | |

### 1.2 Placing it
* Store layout `workspace-3d.mjs:898-906` (`layout()`): `place('keyboard-tray', 0, -28, front - 100)`; the keyboard and mouse are **separate accessories** placed on the tray top: `inputY = -28 + surface.top`, `inputZ = front-100 + surface.center.z`.
* `prepareSuppliedTray(root)` `workspace-3d.mjs:766-776` finds the plate by shape (thinner than 15 mm, largest footprint) and stores `userData.traySurface {center, top, width}`. Called from `workspace-3d.mjs:836`. Finishes (steel map, white, black) are applied per mesh by `applyAccessoryFinishes` `workspace-3d.mjs:850-880`; it clones every material under `Prop:<propId>`.
* Presets store the tray as a desktop-slot object (mm from the desktop's centre, plus a quaternion): `'keyboard-tray':['desktop',[15.92,-28,202.12],[0,.0741,0,.9973]]` (office, `preset-defaults.mjs:11`); gaming `[7.12,-28,202.09]` yaw q.y .0698 (`:15`); library/occ `.0610`, hbhs `[13.38,-28,212.5]` `.0610`. **Those yaws are 7.0 to 8.5 degrees: they undo a skew built into the glb** (section 2.2).
* Director / film: `scene-desk-objects.mjs:54-79` `syncAccessories()` turns each purchased accessory into an editable desk object `accessory-<id>` with `{obj, saved:{role, transform{p,q,s}, ...}}` (`register`, `:81-100`). The tray is `accessory-keyboard-tray` on role `desktop`. `stage.mjs:246-252` places the keyboard relative to the tray with the same preset reference; `stage.mjs:591` frames the opening shot on the keyboard or the tray.
* The desktop slot rides the desk's lift and tilt: the mount's anchor is `Desktop_3` which is inside the tilt wrapper (`studio.js:8023-8036` `BAKED_TILT_CONFIGS`, `studio.js:8477-8494` `applyTiltConfig`, tilt display -5..65 deg, `motion-limits.mjs:8-30`). So **the tray leans with the desktop**; at a 25 degree drafting tilt it hangs tilted under the top.

### 1.3 Where the tray is special-cased today
* `experience/desk-build.mjs:122` `slotless()`: `'keyboard-tray'` has no slot to choose.
* `experience/desk-kit.mjs:22,24` `PART.tray = {ids:['keyboard-tray']}`, `HBHS_KIT.tray`; the Desks tab "Same setup as another desk" copies tray + keyboard + mouse placement together (header `desk-kit.mjs:1-12`).
* `experience/prop-stow-window.mjs:9` `FIXED`: the tray keeps its Props-lane bar the whole stretch.
* `desk-auto-stow.mjs:31` `deskItemDisposition`: `'stay'` (never stowed); `desk-shelf-space.mjs:54` `inputStowKind` returns `null` for the tray, while keyboards and mice **are** stowed to the middle shelf above 9 degrees tilt (`desk-auto-stow.mjs:5` `STOW_ANGLE = 9`, `docs/desk-auto-stow.md`). Result today at a drafting tilt: an **empty** tray hangs under a tilted top.
* `room-people.mjs:1929-1952`: the seated person lines up on the keyboard (`featuredKeyboard()`, `studio.js:11152-11165`, which explicitly skips anything labelled "tray"), and hands are posed for the keyboard where the preset puts it (`room-people-motion.mjs:8-33`).
* Layers (`experience/layers-panel.mjs:1-12`, `prop-layers.mjs:1-14`): the tray is one item; hiding it writes an ordinary per-chapter hide edit.

### 1.4 How things move or articulate today (the framework to reuse)
| Pattern | Where | Reuse for the tray |
|---|---|---|
| Desk lift + tilt joints | `studio.js:8048 tiltConfigs`, `applyTiltConfig :8477` (a wrapper group rotated about a pivot, axis x/y/z, limits `minDeg/maxDeg`); `maximumTiltForHeight` `motion-limits.mjs:24-30` (tilt limit depends on lift height) | Same shape: a pivot, an axis, limits, **limits that depend on another joint**. |
| Actuator rigs (two-point linkage) | `studio.js:8496-8505` | Pattern for any later linkage (the tray's parallelogram links, section 2.4). |
| Vertex-baked hinge (laptop lid) | `desk-stow-parts.mjs:28-47` | Precedent for "fold around an authored hinge, keep materials and scale". Not reused: we want a live hinge. |
| Desk clips (lanes lift / tilt / wheels) | `experience/desk-clips.mjs:1-244`, `desk-track.mjs:3-9` | Lane / clip / easing / overlap / insertion vocabulary; **not extended** (section 4.1). |
| Desk editor + lane UI | `experience/desk-editor.mjs:13` (`createDeskEditor`), `:29`, `:224` palette | Timeline row, palette, drag from palette. |
| Per-desk choreography, one shared sampler | `experience/desk-choreo.mjs:1-20,58-80`; used by the stage (`stage.mjs:33,329,417`) and by the film (`tools/experience/film-desk-edits.mjs:64-66,93,116`) | **Template for the tray's runtime**: pure sampling, one module, called by both "live" and "film". |
| Static desk edits in the cut | `experience/desk-edits.mjs:1-61` (shot field `deskEdits`, film field `sceneDeskEdits`, `effectiveDeskEdits` / `mergeDeskEdits`) | Template for the field naming and the "film's own vs the Director's" rule. |
| People pose mode | `experience/scene-pose-editor.mjs:1-24` (header), `:60` factory, `:76-92` dots + `TransformControls` + `enhanceGizmo`, `:268-275` key diamonds, `:444-459` enter / exit, `:491-493` auto-key + jog panel; double-click `experience/scene-people-editor.mjs:100-105`, `pickObject :304-312` | **The model for tray mode**: the double-click, the panel, the dots, auto-key, key diamonds, prev / next key. |
| Pose keys | `people-pose-keys.mjs:1-40` (`{t, pose, ease}`, ease smooth / linear / hold, `KEY_SNAP=1/60`, `MAX_KEYS=200`), kept in the cut by `experience/people-edits.mjs:85` | Key vocabulary and sanitising. |
| Saved poses | `experience/saved-poses.mjs:1-29` (localStorage `ergoflex.peoplePoses.v1`, shared via studio-state.json) | Named tray poses ("Tucked", "Drafting"). |
| Prop double-click | `experience/scene-prop-editor.mjs:532-545`: a double-click on a desk item enters the desk and picks the item; `isPerson` is skipped there (`:184`, `:540`) so the people editor owns the person double-click | The tray needs the same carve-out (section 5.1). |
| Cut cleaning | `experience/cuts.mjs:59-61` (`Object.assign(shot, cleanPropEdits(v), cleanPeopleEdits(v), cleanDeskEdits(v), ...)`) | One line to add. |
| Importer | `tools/experience/build-round8-director.py:1258-1283` (dc['props'], dc['people'], dc['desks'] ...), `:793-844` `apply_desks` -> `sceneDeskEdits`; clips `CLIP_FIELDS :89`, `merge_clips :158-171`; model test `tests/sonar-import-test.py`, `tests/screen-look-import-test.py` | Template for a new field. |
| Per-frame film hooks | `tools/experience/film-fx.mjs:1008-1047` (install order: desk poses, desk edits, build, ... wheel fix), `film-desk-edits.mjs:116 frame(seconds)` | Where the tray rig is sampled in the render. |
| Clipping audit | `tools/experience/clip-audit.cjs:1-15` (drives the same stage, steps chapters through sample fractions, reports AABB overlaps; today it skips desk-vs-accessory) | Basis of the render-side collision check (section 6.4). |
| Render cache | `tools/experience/chapter-keys.py:1-25` (sha256 of the chapter's whole shot + media + epoch), `render-epoch.txt` | Which chapters change (section 7.3). |
| Escape | `experience/escape-rule.mjs` (Esc leaves a field, else closes the Director unless a handler stops it) | Tray mode must stop Escape like pose mode. |

**Gap found:** nothing in the repo today articulates a *desk accessory*. The monitor arm is rigid (`workspace-3d.mjs:635-650 prepareSuppliedArm` rotates and positions a static model). The tray is the first articulated accessory; every runtime piece here is new, but each follows a pattern above.

---------------------------------------------------------------------------------------------------

## 2. Joint model

### 2.1 The glb, as shipped (measured with `@gltf-transform/core`, meshopt decoded)
Frame: glTF, metres in the file, **millimetres at runtime** (the stage scales the prop x1000: `surface.top` -19.7 gives the preset keyboard y -47.7 = -28 + -19.7, `preset-defaults.mjs:11`). Y up, **z toward the user**, y = 0 is the **top of the track** (the "ceiling anchor", it sits at desktop-slot y = -28 mm). Positions are quantised int16 (KHR_mesh_quantization) with node scales; values below are after the node transforms, in mm.

| Node | Mesh | Verts / tris | Bounds min (x,y,z) | Bounds max | Size |
|---|---|---|---|---|---|
| `Mesh_0` | `Mesh_0` | 13 528 / 10 325 | -97.5, -96.6, -343.2 | 105.1, 0, 222.7 | 202.7 x 96.6 x 565.9 |
| `Mesh_3` | `Mesh_3` | 686 / 796 | -284.3, -28.1, 68.9 | 209.6, -19.7, 354.8 | **494 x 8.4 x 286** (the plate) |
One material in the file (`Anodized_Aluminum_Brushed_90_Black_#1`, base ~0.03,0.03,0.04). The two nodes have no hierarchy and no pivots: nothing is articulated in the shipped file. The source has 7 unnamed meshes.

**Connected components inside `Mesh_0` (inferred, welded by position, 23 pieces; mm).** This is the actual mechanism, still visible in the CAD:

| Piece (my name) | Verts | Bounds min -> max (x, y, z) | Role (inferred) |
|---|---|---|---|
| Track plate | 1675 | -67.4,-8.6,-343.2 -> 85.4,0,47.4 | Fixed mounting track under the desk, 153 x 8.6 x 391 |
| Carriage body | 1793 | -56.6,-52.2,-103.7 -> 45.3,-0.5,36.1 | Slider block under the track, near the **front** end of the track (deployed) |
| Guide rails L / R | 569 / 554 | -68.3..-42 and 30.1..56.4, y -4.4..0, z -110..30 | Slider runners, move with the carriage |
| Links L / R | 310 / 310 | x -61.9..-44.8 and 10.3..27.4, y -74.4..-32, z -7.7..118 | Two sloped plates going down and forward (22 degrees): a parallelogram / drop linkage |
| Pins (5) | 726..741 each | 8.3 x 13 x 13 mm; centres: (-56.9,-23.9,1.7), (34.8,-23.9,13.1), (-55.5,-44.6,-8.5), (36.2,-44.6,2.9), (-70.3,-69.7,111.6) | Hinge pins: **short axis is x, so they are horizontal hinges across the tray** |
| Forks L / R | 638 / 813 | x -97.5..-64.2 and 2.3..35, y -80.7..-27, z 99..223 | Platform supports; their top face (y -27) meets the plate underside (y -28.1): **the plate sits on the forks** |
| Cross-bar + rod | 204 / 144 / 132 | bar -68.7..69.7, y -88..-73, z 84..112; rod along x at y ~-80.7, z ~98..107 | Front tilt axis tying the forks together |
| Knob | 252 | 51..105, -96.6..-65.8, 95..126 | Lock / adjust knob at the right end of the rod |
| Misc plates | 562, 72 x3 | small | Block detail / spacers |

Overall: **494 mm wide, 96.7 mm tall, 698 mm deep** (track 391 mm, plate 286 mm, plate z 69..355, track z -343..47).

### 2.2 Two facts the engineer must not miss
1. **The glb is skewed about 7 degrees about the vertical.** The two pin pairs differ by 11.4 mm in z over 91.7 mm in x (atan = 7.1 degrees); the presets compensate with a saved yaw of 7.0 to 8.5 degrees (q.y .0610 / .0698 / .0741). So the hinge axes are **not** along glb x/z. Pivot nodes must carry that rotation, and the existing saved placements must stay valid, so **do not bake the skew out**.
2. **The manifest numbers do not describe the shipped file** (`fit.mm 679` along x vs the glb's 494 x 698; the Blender 80 degree turn and `rotateY 90` stack). The shipped glb is the truth. Treat `manifest.json`'s fit as history.

### 2.3 Chain and limits (updated with Vico's answers, 0.1)
Each joint node's **local axes carry the hinge**: revolute joints turn about the node's local X (tilt) or Y (swing), the slide moves along local Z, the drop along local Y. No sidecar file is needed (the converter drops glTF extras: `blender-convert.py` exports with `export_extras=False`).

| Joint (control) | Type | Pivot (mm, glb frame, **inferred**) | Axis | Range | Rest | Sign |
|---|---|---|---|---|---|---|
| **slide** | translation along the track | carriage; track axis = glb z turned by the 7.1 degree skew | track axis | **254 mm** (Vico) stored as **0..1** (CAD allows 239.5, see 0.1) | 0 (out, as authored) | 1 = pushed in, toward the back (under the desk) |
| **swing** | revolute, **vertical**, rides with the slide | at the **track's end**: the carriage front pin line, x -5.7, z 36 (**invented**: the CAD has no vertical hinge, see 2.4) | node Y | **-180 .. +180 degrees** (Vico; "360" is a claim); the tray swings out to the SIDE for Side Storage | 0 | + = plate front moves to the user's right (+x) |
| **tilt** | revolute, horizontal | the front rod: y ~-75..-81, z ~104..108, x mid -9 (rod from x -70 to 52), axis = rod axis (x turned by the skew) | node X | **-15 .. +15 degrees**, relative to the desktop (Vico: keep unless the CAD shows more; it shows no stop) | 0 = plate level (as authored) | + = front edge UP (negative, front down, is the ergonomic one) |
| **drop** (height at the mount) | translation, vertical | the whole tray below the desktop | node Y (down) | **0 .. 165 mm** (the product's 6.5 in); a CAD-only rig would give about 58 mm via the sloped links | 0 | + = lower. **Real, not reserved**: the keyboard stays on the tray (0.1, 6.3). Not in the v1 panel as a slider: the sampler raises it as needed; the panel shows it read-only until the slider is wanted. |

Coupling (starting values; numbers come from the clearance probe, section 6): `swing` max falls from 180 to 0 as `slide` goes 0.4 -> 0.85; `tilt` narrows from -15..15 to -2..0 over the same range and as the swing takes the plate under the desk; the **minimum drop** with a keyboard on the tray is the rider's thickness minus 19.7 mm plus 3 mm, scaled by how far the plate is under the desk. In words: pull out, swing, tilt; tilt level, swing back, slide in; the tray lowers before the keyboard goes under the desktop.

Derived slide numbers (**measured arithmetic**, office / gaming preset, tray origin z = +202 mm from the desktop centre, desk depth 30 in = 762 mm so front edge z = +381): plate front edge at 202+355 = 557 mm = **176 mm in front of the desk edge**; plate rear edge at 202+69 = 271, 110 mm inside the edge. To slide the plate fully under the desk with 20 mm margin: slide >= **196 mm** (0.77 of the 254 mm travel). hbhs (z = 212.5) needs 206 mm (0.81). So "pushed in" = slide >= 0.85 on every preset layout. The pivot sits 143 mm **inside** the desk edge (z 238 against 381) even with the tray out: swinging the plate about it carries the plate under the desk, which is why a swung tray with a keyboard needs the drop too.

### 2.4 What the CAD does not tell us (unknown)
* There is **no vertical hinge** in the supplied CAD. "Swing" is therefore either a feature of the real tray that was not modelled, or a feature we would be inventing. The pivot above is a placeholder that gives a believable arc; it needs a photo or the real hardware.
* The sloped links and their pins (y -24 / -44.6 up to y -70) look like a **drop / height adjustment**. That would be the real answer to the keyboard-thickness problem in 6.3.
* Whether the tilt really pivots at the front rod, and its true range.
* Real brand / model of the tray; whether it mounts to the tilting desktop or to the fixed frame (today the app mounts it to the tilting desktop, 1.2).

---------------------------------------------------------------------------------------------------

## 3. Splitting the glb into parts

**Tool.** The repo's own pipeline, not a new one: a `rig:'keyboard-tray'` step in `tools/props/supplied_model_repairs.py` `improve()` (same place as the 80 degree turn, `:68-74`), driven by a new manifest entry `ergoflex-keyboard-tray-rig` (same `source`, `fit`, `anchor`, `rotateY`, `repair`), run by `node tools/convert-props.mjs --only ergoflex-keyboard-tray-rig` with `BLENDER=~/blender/blender-4.2.3-linux-x64/blender` (portable Blender, not on PATH). The Blender script already separates loose parts (`supplied_model_repairs.py:55-57`, `bpy.ops.mesh.separate(type='LOOSE')`), so the idea is proven in-house.

Steps in the repair function (after the 80 degree turn, before the second `bake_transforms()`):
1. Separate loose parts of the source meshes; weld-by-position first (my analysis welded to 23 pieces).
2. Assign each piece to a part by its bounds (table 2.1; the lookup is a small table in the script, with a `--dump` that prints the 23 boxes so a change of source is caught).
3. Create pivot empties at the positions of 2.3; orient each empty so its local axes are the hinge axes (measured in Blender from the pin and rod cylinders, 7.1 degree skew included); parent parts under them.
4. Export hierarchy intact: `convert-props.mjs:178` runs `gltf-transform optimize` which **flattens and joins** (that is why the shipped glb has 2 meshes). Add a manifest flag `keepHierarchy:true` that appends `--flatten false --join false` for this prop, as `preserveMaterials` already appends `--palette false`. Keep the meshopt compression.

**Node names (proposed, stable API for code):**
```
Tray                      identity, = today's prop root
 +- Tray_Track            fixed (track plate)
 +- Tray_Slide            pivot at carriage centre, slides on local Z
     +- Tray_Carriage     carriage body, guide rails, pins P1 / P2, links L / R (v1: rigid, "drop" later)
     +- Tray_Swing        pivot S, local Y vertical
         +- Tray_Tilt     pivot T at the front rod, local X
             +- Tray_Fork_L, Tray_Fork_R, Tray_Crossbar, Tray_Knob
             +- Tray_Plate     (the 494 x 286 plate; also the riders' frame)
```
Material names are kept (`Anodized_Aluminum_Brushed_90_Black_#1`) because `applyAccessoryFinishes` (`workspace-3d.mjs:850-880`) clones by role under `Prop:<propId>`; the steel map is applied per mesh, so splitting does not break finishes.

**Who / where.** Blender headless is not a render and runs fine on the desk (`BLENDER=` as in the portable-Blender note); it is one engineer for about 1.5 days including the dump, the pivot measurements and a reviewer's check of every pivot against the glb inventory. All verification that needs a browser (rest-pose parity, hinge look) happens on the Windows machine (section 9).

**How the rigid version keeps working until then, and after.**
* `ergoflex-keyboard-tray.glb` stays untouched and stays the catalog `propId`. The rig is a *second* asset (`rigPropId`, `catalog.mjs:190`).
* The stage uses the rig **only when the chapter has tray keys** (or while Tray mode is open): at `prepare()` (`stage.mjs:~236-335`) or at mode entry, replace the child `Prop:ergoflex-keyboard-tray` by `Prop:ergoflex-keyboard-tray-rig` under the same accessory root (`workspace-3d.mjs:826-840` is where the prop child is attached; finish re-apply and `prepareSuppliedTray` are re-run; plate lookup becomes `getObjectByName('Tray_Plate')`, with the old thin-plate search as fallback).
* Acceptance gate before the swap is allowed: a Windows still of the rest pose of the rig matches the rigid still (pixel diff below noise, same draw order not required). If it matches on every tray chapter, a later clean-up may make the rig the only asset; that step is a render-epoch decision for Vico (7.3).
* Studio (the store viewer) and AR export keep the rigid glb (the AR note: AR exports follow the reference assembly).

---------------------------------------------------------------------------------------------------

## 4. Data model

### 4.1 Decision: keys of their own, not a lane in `motion.clips`
Considered: `lane:'tray'` clips inside `shot.motion.clips`. Rejected for v1:
* `cleanClip` throws on a lane outside `DESK_LANES` (`desk-clips.mjs:13`), every lane loop (`:41,68,120,134`) and `cleanPose` (`desk-track.mjs:7-9`) would need the tray added; adding tray fields to `cleanPose` changes `motion.initial` of **every** chapter on its next Export (bytes change, keys change).
* Other consumers read `motion.clips` assuming lift/tilt/wheels: the importer's `retime_status` / `directions()` (`build-round8-director.py:174-180,221`), `build-cine-score.py:186,413` (SFX per lane), film-status lights, the desk editor palette.
* Vico wants "pose it in several positions first" = **keys** (diamonds, like people poses), and the travel between poses is the engineer's job; clips are "movements with a duration", the wrong unit.

So: a new shot field `trayEdits`, absent by default, modelled on `deskEdits` / `peopleEdits`.

### 4.2 Shape
```jsonc
shot.trayEdits = [
  { "desk": "gaming",                       // optional, like propEdits.desk: only in the sub-shot whose preset is this (hero finale). Absent = every desk of the chapter that has a tray
    "initial": {"tilt": 0, "swing": 0, "slide": 0},   // at 0 s; absent = rigid pose
    "keys": [                                // chapter SECONDS (the clock of people poseKeys and clips); <= 64
      {"id": "k1", "t": 2.0,  "pose": {"tilt": 0,   "swing": 0,  "slide": 0},   "ease": "smooth", "route": "auto", "label": "Out"},
      {"id": "k2", "t": 6.5,  "pose": {"tilt": -12, "swing": 25, "slide": 0},   "ease": "smooth", "route": "auto"},
      {"id": "k3", "t": 11.0, "pose": {"tilt": 0,   "swing": 90, "slide": 0.3, "drop": 30},   "ease": "linear", "route": "direct", "label": "Side storage"}
    ] }
]
```
* `pose` units: tilt and swing in degrees, slide 0..1 (so "fully in" is the same on 48 and 60 in desks and any layout z), `drop` in millimetres 0..165 (optional: absent, the sampler lowers the tray as much as a keyboard on it needs). Missing field in a key = the previous key's value (a key may name only what it changes, as people pose keys do per bone).
* `ease` (smooth / linear / hold): how a key **leaves** toward the next, same meaning as `people-pose-keys.mjs:14-15`.
* `route` (per key, for the segment it leaves): `direct` = every joint eases from key to key independently (joint-space lerp). `auto` = the engineer's planner staggers the joints in a safe order (section 6.5). The planner may later write `route:{...}` windows; until then `auto` resolves to a fixed staging table. This field is the hook for "an engineer works out how it travels between them".
* Before the first key: `initial` (else rigid). After the last key: hold.
* Limits and the coupling table (6.2) are applied **when sampling**, never destructively to the stored keys, so a key outside the allowed set still shows a clamped tray and a warning in the lane (like `deskLimitNote`, `desk-choreo.mjs:34-37`).

### 4.3 Defaults / byte-identical rule
* No `trayEdits` on a shot: nothing is read, nothing loaded (no rig, no code path). `cleanShot` (`cuts.mjs:59`) adds `cleanTrayEdits(v)` which returns `{}` for absent or empty input, exactly like `cleanDeskEdits` (`desk-edits.mjs:36-40`), so an Export of an untouched chapter is byte-identical.
* `motion`, `motion.initial`, `deskEdits`, `cleanPose`, `POSE_FIELDS`, `DESK_LANES`, `CLIP_FIELDS` are **not changed**.
* Importer: absent in the export = keep the earlier import's (`before`), the rule every other field follows (`build-round8-director.py:1270-1283`).

### 4.4 Where the pure code lives
`experience/tray-pose.mjs` (no THREE, no DOM, importable from the Director, `stage.mjs`, `film-fx` and node tests): `TRAY_JOINTS`, `cleanTrayPose`, `cleanTrayEdits`, `limitsFor(pose)` (the coupling), `sampleTray(edit, seconds)`, `routeSegment(a, b)`, `setKey / removeKey / moveKey / setEase / copyKey / pasteKey` (same signatures as `people-pose-keys.mjs`). Limits are constants in `experience/tray-limits.mjs`, generated from the clearance probe (6.2), not in the glb.

---------------------------------------------------------------------------------------------------

## 5. Director UI

### 5.1 Entering Tray mode
* **Double-click the tray** in the view. Today `scene-prop-editor.mjs:532-545` handles a double-click on a desk item (enter the desk, pick the item). Add the carve-out already used for people (`:540 isPerson`): if the hit belongs to `accessory-keyboard-tray`, the prop editor still enters the desk and picks the tray (so Esc / Done returns to the ordinary gizmo), then hands over to the tray editor, the way `scene-people-editor.mjs:100-105` handles a person. Same "first click selects, second enters" timing as `pickObject :304-312`.
* Also: a **Tray** button in the Inspector when the tray is selected, and the Layers row's context action.
* Needs the rig. If the chapter has no tray keys yet, entering Tray mode swaps in the rig (3) and the first adjustment writes the first key. Leaving restores the rigid asset if the chapter ends with no keys (nothing to render with the rig).
* Selection granularity: parts must report the **accessory** (`userData.accessoryId`) when picked, so Layers keys (`prop-layers.mjs` KEY) and the Props lane are unchanged. The hinge handles are the only part-level picking.

### 5.2 New file `experience/scene-tray-editor.mjs` (model: `scene-pose-editor.mjs`)
Factory `createTrayEditor({win, three, tools, stage, shot, commit, status, rerender, time, seek, seconds, editing})`, wired next to `createPoseEditor` in the people / props wiring (`scene-people-editor.mjs:255-256`, `director.mjs:2212` is the desk editor's wiring for comparison). Exposes `enter / exit / active / panel / tick / action / setMode / changed` as the pose editor does.

**Panel (Inspector tab while active, header like `people-pose-bar`):**
* Header "Tray mode · Keyboard tray" + `Done` (Esc also leaves; stop the event as pose mode does, `escape-rule.mjs`).
* Three rows, each: label, slider within the **current** limits (limits shrink with the other joints, shown as a lighter track), number field (typed degrees / percent), a key diamond (not keyed / keyed here / keyed elsewhere, like `scene-pose-editor.mjs:543`):
  * `Tilt` -15..+15 degrees; `Swing` -180..+180 degrees; `Slide` 0..100 percent (with the mm and "plate fully under the desk at 85 percent" note); `Drop` 0..165 mm (read-only follower at first).
* Presets row: `Deployed` (0/0/0/0), `Tilt back`, `Side storage` (swing about 90, tray out), `Pushed in` (slide 1); and "Save pose / saved poses" using `saved-poses.mjs` machinery under a new key `ergoflex.trayPoses.v1`.
* Auto-key toggle (default off, remembered, same as pose editor): on = every change writes a key at the playhead. Off = the change edits the static `initial`.
* Reset joint / Reset all (tray back to rigid pose), Undo steps one change.
* Hint line with the keys, and entries in the visible context shortcut panel (`experience/keys-panel.mjs`, doc generator `tools/experience/director-shortcuts-doc.mjs`, `docs/director-shortcuts.md`): `K` key all, `[` / `]` previous / next key (jog), `Delete` remove key, `Ctrl+C / Ctrl+V` key at playhead (as `copyKey / pasteKey`), `R` reset.

**On-stage handles (v1):** three markers placed at the pivots of 2.3 (the dot style of `scene-pose-editor.mjs:78-85`): a blue dot at the tilt rod, a blue dot at the swing pivot, an orange dot at the plate for the slide. Selecting one attaches a single-axis `TransformControls` (rotate about the hinge axis, or translate along the track axis only) wrapped by `enhanceGizmo` (`experience/gumball.mjs:37`, so typing, snapping with Ctrl and the readout work); `objectChange` writes the joint and calls the shared limit function so the gizmo cannot pass a limit. Each handle shows its limit arc / travel line. The dots live in a group `userData.directorTools=true` so they are ignored by picking and by the film (same flag `scene-prop-editor.mjs:143`).

### 5.3 The timeline lane
* One row **"Tray"** in the "Motion" lane group (`director.mjs:1215` `laneGroupHead('motion')`), under Lift / Tilt / Wheels, drawn with the **key-diamond row** style of people pose keys (`scene-pose-editor.mjs:268-275`, CSS `.pose-key-row`) rather than clip bars. Appears only when the chapter's desk has a tray accessory.
* Diamonds: click = playhead goes there; drag = retime (snap `KEY_SNAP`, never past the neighbours' 1/60 s); shift-drag range; Delete removes; the selected key's ease and route in the panel; segments between keys get a thin bar coloured by `route` (direct / auto) and a warning tick where the clearance check fails.
* Copy / paste a key at the playhead; copy a whole pose to another chapter through the saved poses.
* Jog: `<| Key` / `Key |>` buttons plus the shortcut; the playhead `seek` is the same `seek(t)` the stage already offers (`stage.mjs:436`).
* Locked rows, the eye toggle and the lane group collapse (`director.mjs:1123,1796`) work as for the other rows.
* Undo: every change is one `commit(...)` step (the shape in `layers-panel.mjs:21`: `commit(()=>{shot().trayEdits=...},{render:false})`); merge key for slider drags like `'pose-'+key+joint+axis` (`scene-pose-editor.mjs:287`).
* Autosave / Export cut: `director-autosave.mjs` and the cut writer already serialise the whole shot; the new field rides `cleanShot`.

### 5.4 Interactions with other tabs
* **Desks tab "Same setup as another desk"** (`desk-kit.mjs`): copies the tray's *placement*; it must not copy `trayEdits` (keys are chapter timing). Add to `desk-kit.mjs` header: "tray keys are not part of a kit".
* **Layers**: hiding the tray hides it with its riders' *own* hide state unchanged; riders do not auto-hide (documented, test it).
* **Gumball move of the tray** (the ordinary prop edit) moves the whole rig; joint poses are in the tray's own frame, so they compose with a prop offset.

---------------------------------------------------------------------------------------------------

## 6. Collision and plausibility

### 6.1 What can go wrong (measured / inferred)
1. **The desktop and frame.** The tray hangs under the desktop; the plate top is only **19.7 mm below the track top** (y -19.7), and the track top is the desktop underside (-28 mm in the slot frame). A tray tilted or swung into the top, the legs, the cross rail, the base panels or the actuators intersects them. The desk's geometry is not available to node (the desk glb is multi-part inside `studio.js`'s `partRegistry`), so measure it in the stage (6.2).
2. **Riders.** Keyboards are 30 to 45 mm thick (`assets/props/index.json`: ergo 45, mechanical 41.7, apple 30.3, razer 42.2, rgb 37.9; mouse 22.2). Plate clearance below the desktop underside is 19.7 mm, so **no keyboard can slide under the desktop on the plate**; the top of the keyboard would be 10 to 25 mm inside the desktop. In the deployed pose the keyboard sits in front of the desk edge, so it is fine; the problem begins exactly when the plate passes the edge.
3. **The tilting desktop.** The tray leans with the top (1.2). At 25 degrees drafting tilt the plate leans 25 degrees; at 65 degrees it is nearly vertical. Today the desk's auto-stow packs the keyboard and mouse into the shelf and leaves an empty tray (`desk-auto-stow.mjs:31`).
4. **People.** Hands are posed for the keyboard where the preset puts it (`room-people-motion.mjs:8-33,364`); they do not follow a swung or tucked tray. `featuredKeyboard()` reads the keyboard's live centre every 500 ms (`studio.js:11152-11170`) so the person's body shuffles to a keyboard that has moved.

### 6.2 Limits: probe once, bake a table, clamp at runtime
* A **clearance probe** (Windows, headless puppeteer, no render): load the desk preset with the rig, for each (desk size 48/60) x (lift 28, 36, 43.5, 52.5) x (desk tilt -5, 9, 25, 45, 65, within `maximumTiltForHeight`) x (tuck, swing, tilt grid, step 5 degrees / 0.1), compute the world AABBs of the tray's parts against every non-tray mesh of the desk (AABB first, then triangle test only on a hit; the same item enumeration as `clip-audit.cjs`, which today skips the desk against accessories and would be extended with `--tray`). Output: `experience/tray-limits.mjs` containing per-joint hard limits and the coupling curves (`swingMax(tuck)`, `tiltMax(tuck)`, `tiltMin(tuck)`), plus a human-readable report. The probe is deterministic, a script in `tools/experience/tray-clearance.cjs`.
* Rules the table must encode (proposed starting values, replaced by the probe):
  * `swing`: +-180 while `slide` <= 0.4, then linear to 0 at `slide` = 0.85. Swinging into the leg side must stop before any intersection.
  * `tilt`: -15..+15 while `slide` <= 0.4, then narrows to -2..0 at `slide` >= 0.85 (the plate must be level to fit under the top), and narrows the same way as |swing| goes 20 -> 60 degrees (the plate is then under the desk).
  * `slide` limited to the carriage stop (254 mm).
  * `drop` minimum with a keyboard on the tray: rider thickness - 19.7 + 3 mm, scaled by the under-the-desk fraction (0.1). The probe replaces this with the real minimum per desk and rider.
* Because the desk tilts, the probe runs per desk tilt too: the table is indexed by desk height and tilt, interpolated linearly (the same way `maximumTiltForHeight` interpolates, `motion-limits.mjs:24-30`). Initial version may ignore desk tilt above 9 degrees and rely on "tuck required above 9 degrees" (6.3).

### 6.3 Making the tucked pose plausible (the keyboard problem): decided, 0.1
Vico: the keyboard and mouse **stay on the tray** when it is tucked (the product's "Side Storage" picture shows exactly that). So the old options A (put the riders away) and C (refuse to tuck) are out, and the **drop joint (old option B) is real**: the product mounts the track lower (0..165 mm). Check, with a keyboard on the tray: plate top is 19.7 mm below the desktop underside; keyboards are 30 to 45 mm thick and mice up to 57 mm (`assets/props/index.json`), so at drop 0 they do not fit under the desktop, and the plate needs `thickness - 19.7 + 3 mm` of drop (about 28 mm for the 45 mm ergo keyboard, 40 mm for the 57 mm gaming mouse) before it goes under. That is inside the product's 165 mm and the CAD links' 58 mm. The sampler (`limitsFor` with a rider) raises `drop` to that minimum as the plate goes under; the route planner lowers it first (6.5). The probe (6.2) confirms the minimum per rider against the real desk.
Not built: the `level` flag (the tray counter-rotating the desk's tilt), a v1.1 idea; the default stays "fixed to the tilting top".

Rider mechanics: riders are ordinary desk objects (`accessory-ergo-keyboard`, ...). Record each rider's baseline plate-relative offset when the rig is installed (the keyboard whose centre is inside the plate footprint within 60 mm above `traySurface.top`); each frame set `rider.matrix = plateWorld(pose) * baselineOffset` as a runtime override, keeping the authored transform in `item.saved` and restoring on clear (the same discipline as the desk's storage poses: "Storage poses live only on runtime records ... restore/read the authored transforms", `docs/desk-auto-stow.md`). A rider the desk itself has stowed (`userData.stowHidden`, above 9 degrees of tilt) is skipped; the tray never stows a rider. Nothing is written to `saved`, so a project save or a preset capture is unaffected.

Desk tilt: add an optional pose flag `level` (proposed, v1.1): the tray counter-rotates the desk's tilt up to the tilt limit so it hangs level while the top tilts. Default off (the app's behaviour today); ask Vico (question 3).

People (Vico: hands leave the keys while the tray moves, v1): v1 leaves the poses as built, and chapters that move the tray should have the person's hands off the keys at those times (their act already releases the keys above 9 degrees: `room-people-motion.mjs:33`). Follow-up: feed `featuredKeyboard()` from the rider's live position and let the existing wrist-follows-keyboard code (`room-people-motion.mjs:364`) track it.

### 6.4 Checks
* Runtime clamp from the table (cheap, every frame, pure).
* Lane warning: a segment whose sampled path leaves the allowed set shows a red tick and the inspector says which joint and at what second.
* Render-side: `clip-audit.cjs --tray` (extension of the existing tool) steps each tray chapter through 13+ samples and reports tray-vs-desk overlaps; zero overlaps is a release gate for any chapter with `trayEdits`.

### 6.5 Travel between poses (the engineer's part)
`routeSegment(a, b, {route, riderMm})` (a, b = full poses):
* `direct`: joints ease together (a straight line in joint space).
* `auto` staging (proposed), chosen by the under-the-desk fraction at each end. Leaving a pushed-in or swung-away pose: slide out first (0 .. 55 percent of the segment), swing 35 .. 80, tilt and drop 60 .. 100; going under (pushing in or swinging away): drop and tilt first (0 .. 35), swing 20 .. 65, slide 45 .. 100. The windows of the joints that actually change are stretched to fill the segment. A segment between two deployed poses is `direct`.
* Validation: sample the segment at 25 points, test against the coupling table (and the rider's drop minimum); `auto` takes `direct` if it passes, else the staging if that passes, else it reports the segment and falls back to a single clamp (`clamped`: direct motion, every sample clamped). A forced `direct` is never replaced, only reported.
The planner is pure and unit-tested; the window shapes are its only tunables, and the data field `route` records the choice so a render never depends on the planner's later changes unless the author re-plans.

---------------------------------------------------------------------------------------------------

## 7. Film render path

### 7.1 One sampler, two callers (the "stage is the render" rule)
* New `experience/tray-rig.mjs` (THREE side): `createTrayRig(api)` with `set(edits, shotPreset)`, `apply(seconds)`, `restore()`, `count()`; resolves the rig nodes by name (`Tray_Slide`, `Tray_Swing`, `Tray_Tilt`, `Tray_Plate`), sets node rotation / translation from `sampleTray(edit, seconds)` after the limit clamp, then moves riders.
* Live stage: next to the desk choreography, `stage.mjs:33` (create), `:329` (`deskChoreo.restore(); deskChoreo.set(next.deskEdits)` -> `trayRig.restore(); trayRig.set(next.trayEdits, next.preset)`), `:417` (`if(deskChoreo.count())deskChoreo.apply(t*shot.seconds)` -> add `if(trayRig.count())trayRig.apply(t*shot.seconds)`), the `seek` path `:436` goes through `tick`, so a scrub updates the tray.
* Film render: `tools/experience/film-desk-edits.mjs` `frame(seconds)` (`:116`) already runs every frame by chapter time inside the film page; the render (`render-cut.cjs`) drives the same stage and film-fx. Install the tray from `shot.sceneTray` through `film-fx.mjs` next to `sceneDeskEdits` (`:1010`), calling the same `createTrayRig`. **Trap:** `install()` returns early unless the shot has one of the listed fields (the `wants` gate, `film-fx.mjs:1002`); `shot.sceneTray?.length` must be added there or the tray is silently never installed in the render. Resolution rule `effectiveTrayEdits(film, shot)` / `mergeTrayEdits` identical in spirit to `effectiveDeskEdits / mergeDeskEdits` (`desk-edits.mjs:42-45`): the Director's `trayEdits` replace the film's `sceneTray` when present.
* Order each frame: desk lift / tilt / wheels first, tray rig, riders last, so riders ride the final plate world matrix; film-fx's wheel fix and quality compositors wrap the render after (`film-fx.mjs:1047`).
* Determinism: `sampleTray` is a pure function of chapter seconds, no state; out-of-order seeks (the 4K render seeks frames independently) are safe. Everything is held to the limits table at sample time, so the live clamp and the render clamp are the same function.

### 7.2 Importer and export
* Export: `cuts.mjs:59` gains `cleanTrayEdits(v)`; field travels in `cut.json` shot, like `deskEdits`.
* Import: `tools/experience/build-round8-director.py` new block next to `:1258-1283`: `if isinstance(shot.get('trayEdits'), list): dc['tray'] = clean_tray(shot['trayEdits'])`, `elif 'tray' in before: dc['tray'] = before['tray']`; apply: chapter film shot (`review-cut.json`, chapter shot file, and **every hero sub-shot** in `shots/13-subshots.json`, as the props import already does) gets `sceneTray` (absent = field removed, the way `apply_desks` removes `sceneDeskEdits`, `:834-844`). Docstring entry at the top of the file (`:1-80`) like Sonar / Screen look.
* Keys are in chapter seconds; a chapter-length change from the importer (`new_T`) does not retime them (same as pose keys and clips by id); keys past the new end are reported, not dropped.
* `director-bridge.py` and `CLIP_FIELDS` are untouched (no clips involved).

### 7.3 Render cache and epoch
* `chapter-keys.py` hashes the chapter's whole shot (`:1-25`), so a chapter's key changes only if its shot gains `sceneTray`. **Chapters without tray keys: key unchanged, epoch untouched.** Chapters with a tray today (by preset): awaken, rise, music, awareness, hero (gaming / office desk versions), media, wellness (office); commons, storage (library); coast (occ); oilers (hbhs). `create` uses `artist` (no tray). Only the chapters Vico poses get new keys.
* The dual-asset rule (3) keeps all other chapters on the rigid glb, so **no epoch bump** is needed to ship the feature. A bump (`tools/experience/render-epoch.txt`, Vico's call) is needed only if a later clean-up makes the rig the only asset and the parity still differs; the per-chapter epoch lines (`chapter <id> <n>`) can limit it to the tray chapters.
* `chapter-keys` hashes media files the shot names including `.glb`; the shot does not name the tray glb (it comes from the preset), so swapping the asset would not change any key silently. This is the reason for the parity gate, not a reason to skip it.

---------------------------------------------------------------------------------------------------

## 8. Tests

Pure (node, no browser, run on any machine; model files `tests/desk-choreo-test.mjs`, `tests/people-pose-keys-test.mjs`):
* `tests/tray-pose-test.mjs`: defaults (absent trayEdits -> `cleanTrayEdits` returns `{}`, `cleanShot` of every existing fixture/cut **byte-identical**: run over `exports/cinematic-intro-cut-*/review-cut.json` shots); `cleanTrayPose` limits and units; key ops (`set/move/remove/ease/copy/paste`, snap 1/60, max 64); `sampleTray` (before first key = initial, between = ease smooth / linear / hold, after last = hold, missing fields inherit); coupling (`limitsFor`) monotone and symmetric; `routeSegment` staging windows and the fallback; determinism under out-of-order sampling (sample 1000 random times twice, equal).
* Limits table sanity: every key of `tray-limits.mjs` inside the joint hard limits.
* `tests/tray-cut-test.mjs`: `cleanShot` keeps / drops fields; shot without the field has no `trayEdits` key in JSON.
Importer (python, model `tests/sonar-import-test.py`):
* `tests/tray-import-test.py`: an export with `trayEdits` -> `director-camera-<id>.json 'tray'` -> `sceneTray` in review-cut and shot file and all hero sub-shots; an export without the field keeps the earlier; an empty list removes; running the import twice is a no-op (no file rewritten); a chapter without it is byte-for-byte unchanged (the rule at `build-round8-director.py` docstring).
* `tests/chapter-keys-test.py` extension: key of a chapter changes only with `sceneTray`.
Round trip (model `tests/director-cine-roundtrip-test.mjs`): Director -> export -> import -> film shot -> `sampleTray` at 5 times equals the Director's.
Browser e2e (Windows; names ending `-e2e.mjs` run puppeteer, see the "browser tests named -test" trap):
* `tests/director-tray-mode-e2e.mjs`: double-click the tray enters Tray mode (and a double-click on the monitor / keyboard does not); sliders clamp at limits; auto-key writes a key; diamonds click / drag / delete; prev / next key; copy / paste; undo; Esc leaves tray mode without closing the Director; Layers hide still hides the tray; export then reload restores the keys; the tray lane absent on a desk without a tray.
* `tests/tray-rig-e2e.mjs`: rig loads only when keys exist; rest-pose rig vs rigid same bounding boxes and same plate position (`traySurface`); riders follow at three poses; no desk intersection at a pose grid (the clearance probe's assertions); stage vs film-fx sample equality at 8 times (`__efDemo` style, as `director-desk-choreo-e2e.mjs`).
Render checks (Windows, per the Win render notes): (1) rest-pose parity still, rigid vs rig, three cameras, on office / gaming / hbhs; (2) a 480p preview of one chapter with three tray keys, then a titles-only check; frame grabs at each key (3 per key) reviewed by a fresh reviewer agent; (3) `clip-audit.cjs --tray` zero overlaps; (4) only after Vico's yes, one 4K chapter; say the wait first (the film re-render is about 40 minutes).

---------------------------------------------------------------------------------------------------

## 9. Phase plan

Sizes are working days for one engineer, with a fresh reviewer per phase (the working agreement). "Win" = needs the Windows machine (browser, renders).

| # | Phase | Output | Size | Machine |
|---|---|---|---|---|
| 0 | Decisions | Vico's answers (section 11); photo / dimensions of the real tray | 0.5 d Vico | any |
| 1 | Pure model | `tray-pose.mjs`, `tray-limits.mjs` (starting values), tests, `cleanShot` hook | 1 d | desk ok (node only) |
| 2 | Rig asset | `rig` repair step, manifest entry, `keepHierarchy` flag, pivot measurements, `ergoflex-keyboard-tray-rig.glb`, parts inventory test | 1.5 d | Blender headless: desk ok; **parity still: Win** |
| 3 | Stage runtime | `tray-rig.mjs`, loading on demand, rider following, finishes, selection granularity, `stage.mjs` hooks, `film-fx` install | 2 d | **Win** (browser) |
| 4 | Director UI | `scene-tray-editor.mjs`, panel, handles, lane row, keys, copy/paste, undo, shortcuts, Layers / kit notes | 3 d | **Win** (e2e) |
| 5 | Export / import | `cuts.mjs`, importer block, hero sub-shots, round-trip test, chapter-keys test | 1.5 d | desk ok for python; round trip e2e **Win** |
| 6 | Clearance + route | `tray-clearance.cjs`, `clip-audit --tray`, baked table, planner `routeSegment` and tests | 2 d | **Win** (headless puppeteer, no render) |
| 7 | Render verification | parity stills, one 480p chapter, audit, review; then Vico's 4K call | 1 d + render time | **Win**; cap two agents at once |
| | **Total** | | **~12.5 d** | |
Order: 0 -> 1 -> (2 in parallel with 1) -> 3 -> 4 and 5 in parallel -> 6 -> 7. Phase 1 can start before Vico's answers; phase 2's swing pivot and ranges wait for question 1 and 2. Smallest useful cut (a "tilt-only first release"): phases 1, 2, 3 and 5 with just the tilt joint and a panel in the Inspector, ~6 d, no hinge handles, no coupling.

---------------------------------------------------------------------------------------------------

## 10. Risks

1. **Real hardware unknown**: the CAD has no vertical hinge; the swing pivot is invented at the track's end (0.1, 2.4). Mitigation: the joint table is data, not structure; the product's pictures are the behaviour reference.
2. **Keyboard thickness vs 19.7 mm clearance**: a keyboard on the plate cannot go under the desktop at the CAD's drop (6.3). Decided: the riders stay on, the `drop` joint is real and the sampler enforces its minimum; the probe must confirm the minimum per rider.
3. **7 degree skew**: easy to lose on re-export or when someone "straightens" the model; every saved placement depends on it. Mitigation: pivot nodes carry the rotation; a test asserts the hinge axes in the glb against the measured angle (+-0.5 degrees).
4. **Optimizer flattens the hierarchy** (`gltf-transform optimize`, `convert-props.mjs:178`). Mitigation: `keepHierarchy` flag; test that the shipped rig has the named nodes.
5. **Rest-pose pixel drift** between rigid and rig (quantisation, normals at cut edges, draw order). Mitigation: dual assets and the parity gate; epoch only if Vico accepts a clean-up.
6. **Desk geometry for the probe is only available in the stage** (not a standalone glb): the probe is browser-bound and desk-version dependent; re-run when the desk model changes (record the desk version in the generated table).
7. **Tray leans with the tilting desktop**: a tilted-with-top tray looks wrong in drafting chapters; `level` option and the slide cover it; Vico's answer is that the tray stays fixed to the top (0.1).
8. **People hands and body** do not follow the tray (6.3). Acceptable v1, listed.
9. **Meshopt / quantisation of a split asset**: more nodes, more draw calls (23 parts); 11 k tris, negligible, but check shader-warm-up time in the 4K render (`ctx.warm`).
10. **Hero finale**: each sub-shot is a desk model; `desk` field on `trayEdits` mirrors `propEdits.desk`; some models (compact, creative, artist) have no tray: the lane must be hidden and the data ignored for them.
11. **Room desks (non-featured)**: v1 is the featured desk plus the finale's sub-shot desks; other room desks' trays (like `deskEdits[i].clips`, `desk-choreo.mjs`) are v2.
12. **Selection and Layers keys**: if parts are picked instead of the accessory, saved layer keys and the Props lane break. Mitigation: test in 8.
13. **Stale Director page after merge** (known trap): bump `?v=` query strings on the new modules in `director.mjs`'s imports (`director.mjs:40` style).
14. **Sync with ongoing film streams**: `stage.mjs`, `film-fx.mjs`, `cuts.mjs`, `scene-prop-editor.mjs` and the importer are shared files; tell the owners (chingon, the Director stream) before editing, ask Vico before any merge into the main checkout (reloads his Director), and check the render queue before merging.

---------------------------------------------------------------------------------------------------

## 11. Questions for Vico: answered 22 Nov 2026

All seven are answered in section 0.1 (table at the top). Kept here as an index:
1. Which tray: Amazon B0GC643XT7 (similar to his), screenshots in 0.1.
2. Ranges: slide 254 mm, tilt +-15 degrees, swing +-180 degrees about a vertical pivot at the track's end (Side Storage), height 0..165 mm optional (becomes the `drop` joint).
3. Mounting: stays fixed to the tilting top.
4. Keyboard: stays on the tray; the clearance is checked with a keyboard on it; the `drop` joint is real.
5. Chapters: tray keys only where Vico adds them.
6. People: hands leave the keys while the tray moves (v1).
7. Render policy: rig only in chapters with tray keys, no epoch bump.
