# Film-effect fields for `render-cut.cjs` (harness only)

All of this lives in the render harness: `tools/experience/render-cut.cjs` plus the helper
modules it injects into the stage iframe, `tools/experience/film-fx.mjs`, `film-tod.mjs` and
`film-edits.mjs`. No app source is touched. The helpers load only when a shot uses one of the
fields below. A shot without them renders pixel-identically to before. This was verified:
ch 2 rendered alone and after a shot that used every field gave identical stills (max
difference 0), so `clear()` restores the stage completely between shots.

Always render with the seed and the static server:

```
node tools/experience/render-server.cjs 3017          # once
node tools/experience/render-cut.cjs --cut <cut.json> --shots 0 --out <dir> --stills 12 \
     --storage exports/cinematic-intro-20261030/post/college-seed.json
```

The order inside each bake frame is: time-of-day → sceneEdits/lights → screens (seek every
clip, then redraw) → clocks → LED sampling → `ErgoPresentation.bakeFrame` (stage tick + render).

---

## Inventory: `--list-screens`

```
node tools/experience/render-cut.cjs --cut <cut.json> --shots all --out <dir> --list-screens --storage …
```

This prepares each shot and lists every screen-like mesh and every clock: id/alias, aspect,
physical size, world centre, facing yaw and pitch, whether the shot's camera sees it (out of
9 samples), and its largest on-screen size at 1920×1080. It also writes `<dir>/NN-screens.json`.
The current inventory is in `INVENTORY.md`.

## `screens`: live media on any display

```json
"screens": [
  {"target": "main-landscape", "src": "exports/cinematic-intro-20261030/screens/02-landscape.mp4", "offset": 0, "fit": "cover"},
  {"target": "main-portrait",  "src": "exports/cinematic-intro-20261030/screens/02-portrait.mp4"},
  {"target": "tablet",         "src": "exports/cinematic-intro-20261030/screens/02-tablet-app.mp4"}
]
```

| field | default | meaning |
|---|---|---|
| `target` | index | `main-landscape`, `main-portrait` (the featured desk's largest landscape and portrait monitors; `-2`, `-3` for more), `tablet`, `tv`, `arcade`, `marquee`, `occ-display`/`reel`, `media` (ch 10's stage screen; also answers to `main-landscape` there), any id from `--list-screens`, an exact mesh name, or a substring of the object path |
| `src` | — | repo-relative MP4 (H.264) or PNG/JPG |
| `offset` | 0 | seconds into the clip at chapter time 0 |
| `rate` | 1 | clip seconds per chapter second |
| `loop` | true | `false` holds the last frame |
| `fit` | `cover` | `cover` crops to fill, `contain` letterboxes in black, `stretch` |
| `rotate` / `flipX` | 0 / false | for content authored sideways or mirrored |
| `brightness` | 1 | picture gain (unlit, not tone-mapped, like the app's media screen) |
| `inset` | 0 | `[l,t,r,b]` fractions of the glass left clear so a bezel baked into the mesh shows through (not needed for any current screen) |
| `res` | clip size | long side of the texture canvas (512 to 2048) |

How it works:
- **Seeking.** Each bake frame seeks the clip to `chapterSeconds × rate + offset` (looped), waits for `seeked`, draws the frame into a canvas and marks the texture for upload. This is the same seek-and-wait pattern `stage.mjs` uses, so it is frame-accurate. The test clips' burnt-in frame counters read 0240 at 8.00 s.
- **Mapping.** The picture goes on an overlay built from the screen mesh's own front-facing triangles, 0.4 mm proud of the glass. The original mesh and its housing stay. UVs come from the glass itself: front = screenFront, else the averaged normals, else the thinnest principal axis facing the room; up = world up; right = up × front.
- **Curved glass.** Curved screens are parametrised by arc length, so a 2.4:1 clip lands undistorted across the curve.
- **Colour.** The texture is sRGB, with mipmaps and maximum anisotropy. The material is `MeshBasicMaterial` with `toneMapped:false`, which matches the app's MediaScreen.
- **Orientation check.** Verified with orientation test clips (`screens/test/*.mp4`, TOP LEFT / BOTTOM RIGHT markers): wide curved, portrait (the app's own portrait theme is drawn sideways; the film overlay is upright), tablet, arcade (tilted 9°) and marquee all read correctly.
- **Existing paths.** The old `--screen` flag and `screenOffset` still work for ch 10.

## `accessories`: add or remove desk items for a shot

```json
"accessories": {"add": ["tablet-pc"]}
"accessories": {"add": [{"id": "tablet-pc", "x": -330, "z": 230, "rotation": 15, "scale": 100}], "remove": ["office-keyboard"]}
```

- **Catalog accessories** (for example `drafting-kit`, `artist-easel`, `easel-rail`, `ergo-keyboard`) are toggled with the app's `toggleAccessory` **after** prepare, on the installed room desk, and then laid out (`syncAccessories`). Give `x`/`z`/`rotation`/`scale` to place them like desk objects (key `accessory-<id>`). They are toggled back after the shot. Earlier versions toggled them inside `applyPreset`, but the room install rebuilt the desk and dropped them. Verified: ch 3 at t = 0.15 shows the drafting board and tools on the 25° surface (`verify/stills/accessories-ch03-*`).
- **Library props** (for example `tablet-pc`) are added through the desk-object manager after prepare (`sceneDesks.objects.add`, then `change`). They sit in desk-local millimetres on the `desktop` mount (+z = desk front, −x = the seated user's left), ride the lift, and are removed again after the shot.
- **`tablet-pc` default:** x −330, z 230, rotation 15°. That puts it front-left, angled toward the seat, leaning back ~21° on its kickstand. Its glass is the `tablet` screen target. In ch 2 its world centre is ≈ [-0.49, 1.26, 0.81] m at the seated pose, facing yaw 105° / pitch 21°, 405×265 mm (1.525:1, so a 3:2 clip crops 1.6% top and bottom).
- **`remove`** hides existing desk objects by object key or prop id.

## `ledMode: "media"`: the app's picture-driven LED mode

```json
"ledMode": "media", "ledPreset": "full", "ledGlow": 0.8, "ledSource": "main-landscape"
```

- **The app path.** The app's "video/videogame" LED mode is `LedGameMode` (led-game-mode.mjs), driven by a shared screen or the demo. `sampleLive` draws the picture at 160×90 and runs `sampleScreenColours` (led-screen-sampler.mjs): the desktop strips sample successive horizontal bands (6/20/34/48/62/94 % height), and the two wings sample the matching left and right edges. It eases toward that frame with a 150 ms time constant. `updateLedEffectFrame` asks `ledGame.sample()` first and uploads the result as linear per-pixel colours to the desk strips, the under-desk spill shaders and the room spill (`RoomLedSpill`, which reads the same pixel atlas).
- **The harness.** It feeds that exact path. Each frame it runs the app's own `sampleScreenColours` on the source clip's current frame and eases with the same 150 ms constant, but on **bake time**, so the light is deterministic. The eased frame goes in as an instance override of `ledGame.sample` with `active` set for that frame only (both are removed after the frame), and the LED base colour is set to the picture average.
- **Snapping.** Stills and the first frame snap with no easing. Video at the bake rate eases like the app.
- **`ledSource`.** A `screens` target or index. The default is `screens[0]`. In ch 10 without `screens`, a hidden sampler plays the stage's own clip (`--screen` file or `ambient-clip.mp4`) in lockstep with the stage's seeks, at `screenOffset`.
- **`ledPreset`.** The app's Game presets `calm` .25, `normal` .5 (the app default), `intense` .8 and `full` 1. For film, **`full` with `ledGlow` .8–1** reads clearly. `normal` is faithful but subtle.
- **`ledGlow`** (any LED mode). The app's brightness slider as a fraction of full. The stage uses .35.
- **ch 9.** With `ledMode:"media"` the music `spectrum` re-arm is skipped, so the stripes come from what plays on the monitor.
- **How it differs from the old ch 10 look.** The old look was one solid colour taken from the centre pixel, which washed the whole room in a single tint. Media mode gives banded colour along the desktop edge, wings that follow the picture's left and right edges, and a matching floor and curtain spill. It is more localised and less uniform.

## `clock`: animated clocks

```json
"clock": {"from": "08:00", "to": "17:30", "start": 0, "end": 16, "ease": "linear", "second": "real"}
```

- **Rooms with clocks.** Wall clocks are in ch 2 and 10 (home office, canvas face) and ch 6 (HBHS, the same canvas face). The library reading-room clock (separate hour and minute hand meshes) and the atelier split-flap desk clock are also supported, but neither is in the current cuts.
- **Interpolation.** The time runs from `from` to `to` between `start` and `end` chapter seconds (defaults 0 to the chapter length). `ease` is `linear` or `smooth`. Faces are redrawn every frame with the room's own painter (copied into the harness) and real hour and minute angles.
- **Second hand.** `second:"real"` sweeps at real time (6° per chapter second), `"clock"` follows the interpolated time (a blur in a time-lapse), `"hide"` drops it.
- **Verified.** A close-up shows 08:00, then 12:45, then 17:30.

## `timeOfDay`: light moving through the day (ch 2)

```json
"timeOfDay": [{"at": 0.75, "mode": "morning"}, {"at": 8, "mode": "afternoon"}, {"at": 15.25, "mode": "evening", "ease": "smooth"}]
```

- **Finding.** The rooms do have continuous lighting parameters, so a real in-engine interpolation is used. No post crossfade is needed. A daypart switch (`setMeasuredRoomMode` → `applyRoomLighting` → `roomAtmosphere`) only writes continuous values:
  - key, fill, rim and hemisphere colours and intensities, plus the sun's position;
  - practical point-light intensities;
  - `toneMappingExposure` (1.05 → 1.10) and `scene.environmentIntensity` (0.66 → 0.39);
  - the architectural bounce radiance array;
  - emissive levels on the lamp shades, pendant and window glow, and the window glow's opacity;
  - the fairy-bulb colour;
  - the roman-blind drop (object scale + texture repeat);
  - canvas repaints of the window view (sky, sun, lit windows).
- **What the harness does.** It snapshots that state once per keyed mode, returns to the shot's prepared mode, restores every object it moved, and then blends the snapshots each frame:
  - colours and vectors are lerped;
  - sky canvases are cross-dissolved;
  - shadow maps are redrawn because the sun moves.
- **What stays.** Geometry, desk dressing and activity props stay as prepared. A mode switch also swaps desk dressing (for example the evening hides the keyboard and mouse), and that is deliberately not applied. Monitor UIs keep the prepared daypart's content unless `screens` replaces them.
- **Verified.** ch 2 at 16 s with the morning → evening ramp matches a native `mode:"evening"` render in lighting.
- **Fallback, if ever needed.** Render the chapter twice (same camera and motion, `"mode":"morning"` and `"mode":"evening"`) and crossfade in post with a time ramp.

## `sceneEdits`: per-shot material, visibility and transform edits (film-edits.mjs)

```json
"sceneEdits": [
  {"match": "^Wheel_[FR]_[LR]", "materialColor": "#a38c8c", "material": {"color": "#2a2a2e", "roughness": 0.45, "metalness": 0, "clearcoat": 0.3, "clearcoatRoughness": 0.25}},
  {"match": "^Wheel_[FR]_[LR]", "materialColor": "#2a2a2a", "materialType": "Physical", "material": {"metalness": 1, "roughness": 0.3}},
  {"match": "@grid", "opacity": 0.35, "radialFade": [3, 8]},
  {"match": "^Prop:electric-wheelchair$", "hide": true},
  {"match": "@window", "material": {"brightness": 2.75, "mapBlur": 1.5}}
]
```

**Selecting objects**

| field | meaning |
|---|---|
| `match` | Regex on the object name (case-insensitive; `""` matches all). Stage aliases: `@grid`, `@pulse` (expanding ring), `@sweep`, `@pylons`, `@stageLight`, `@floor` (shadow catcher). `@window` is the room's exterior backdrop: home (ch 2/10), creative (ch 3), gym (ch 7) and highschool (ch 6). |
| `path` | Regex on the full `A > B > C` object path |
| `materialName` / `materialColor` / `materialType` | Only those materials, e.g. `"materialColor":"#a38c8c"` selects the mecanum rollers (32 meshes), and `#2a2a2a` + `Physical` the hubs (173) |
| `minArea` | Skip matched meshes smaller than this many m² |

**What can be changed**

| field | meaning |
|---|---|
| `hide` | `true` hides the object |
| `position` / `rotation` / `scale` | Applied once at install: world-metre offset, degree offsets, multiplier |
| `material` | `color`, `emissive`, `roughness`, `metalness`, `clearcoat`, `clearcoatRoughness`, `envMapIntensity`, `emissiveIntensity`, `opacity`. A Standard material gets a Physical copy when clearcoat is asked for. |
| `material.brightness` | Colour gain on unlit backdrops, emissive gain otherwise |
| `material.emissiveScale` / `opacityScale` | Multiply whatever the app or stage writes every frame, so they stack with time-of-day and the stage's own fades |
| `material.colorScale` | Colour gain |
| `material.mapBlur` | Samples the colour map at that mip LOD, ≈ 2^lod texels of blur, for out-of-focus exteriors |
| `opacity` | Multiplier (number or keyframes). A faded opaque surface is kept first in the transparent pass, so the shadow-catcher floor 2 mm above the grid can't hide it. |
| `radialFade` | `[r0,r1]`: lines or meshes fade out between r0 and r1 metres from the object's origin. On the grid this removes the horizon line. |

**Behaviour**
- **Keyframes.** Any number can be keyframed by chapter seconds: `"opacity":[[0,0.35],[8.5,0]]`.
- **Shared materials.** Materials are edited in place, which affects every mesh sharing them (all four wheels, for example), and restored after the shot. Pass `"clone":true` to isolate.

**Recommended uses, from EXPERT-GUIDANCE.md (all verified in stills)**
- **#5, ch 1/8/12 wheels.** The first two edits above: charcoal urethane rollers with a clearcoat highlight, anodised hub.
- **#1/#8 grid.**
  - ch 1 and ch 8: `{"match":"@grid","opacity":0.35,"radialFade":[3,8]}`. The grid stays visible near the desk and no horizon line remains.
  - ch 12: `{"match":"@grid","opacity":[[0,0.35],[8.5,0]],"radialFade":[3,8]}` plus `{"match":"@pulse","opacity":[[0,1],[8.5,0]]}`. Both are gone by 8.5 s.
- **#9 windows.** Day rooms: `{"match":"@window","material":{"brightness":2.75,"mapBlur":1.5}}` (ch 2, 3, 7; 2.5 for ch 6). Night ch 10: `"brightness":0.5`. Brightness stacks with `timeOfDay`, because the sky canvas cross-dissolve is untouched.
- **#10 wheelchair.** `{"match":"^Prop:electric-wheelchair$","hide":true}` (ch 4 and ch 11).

## `lights`: extra lights for the product void (film-edits.mjs)

```json
"lights": [{"preset": "productRig"}]
"lights": [{"preset": "productRig", "scale": 0.5}]
"lights": [{"preset": "productRig", "key": {"intensity": 30}, "rimRight": false, "pool": {"radius": 1.8}}]
"lights": [{"type": "spot", "at": {"az": 180, "el": 40, "dist": 4}, "color": "#eef1ff", "intensity": 150, "angle": 20, "penumbra": 0.6}]
```

**`productRig`** follows #8. Positions are relative to the desk: `az` 0 = desk front (the monitors' facing), positive = the desk's left; `el` = elevation; `dist` in metres. It is fixed in world space, like a studio. It contains:
- `key`: a 2×1 m RectAreaLight, az 45 / el 35, 5600 K, intensity 40.
- `rimLeft` / `rimRight`: narrow spots (22°, penumbra .55) at ±135° behind the desk, el 28, 7000 K, intensity 200. They put a clean edge on the black panels, separate from the red piping.
- `pool`: a soft additive light pool under the desk, radius 1.5 m, strength .3.
- `contact`: a soft contact-shadow decal.

The pool and contact decals follow the desk base across the void (the ch 1 glide). The rig only lights the desk, so the void stays black. `scale` multiplies everything. Set any part to `false` to drop it, or pass an object to override it.

**Suggested scales:** ch 1 and ch 12 `scale 1`. ch 8 `scale 0.5`, because the top-down view looks straight at the lit desktop and goes hot at 1.

**Custom lights:** `type` is `rect`, `spot`, `point` or `directional`, with `position` (or `at`), `target`, `color`, `intensity`, `width`, `height`, `angle`, `penumbra`, `distance`, `decay` and `castShadow` (default false; no extra shadow maps).

**Not done by the harness:** a glossy reflective floor (#8) needs a reflection pass the app doesn't have. The ch 8 pylon material and camera changes are a DP and camera job, though `sceneEdits` on `@pylons` can restyle them, e.g. `{"match":"@pylons","material":{"color":"#9fc3d6","roughness":0.15,"emissiveIntensity":0.25}}` (an untested example).

## Verification artefacts (`screens/verify/`)
- `stills/`: before/after pairs.
  - Screens: `screens-*`.
  - Time of day and clock: `timeofday-*`, `clock-*`.
  - LED media mode: `led-*`.
  - Product void: `void-ch01/08/12-*`.
  - Windows: `window-*`.
  - Wheelchair: `wheelchair-*`.
- **Clips (1280×720, no motion blur, harness checks only):**
  - `01.mkv`: ch 2 with test patterns on the wide, portrait and tablet screens, the tablet added, the clock running 08:00→17:30, and timeOfDay morning→afternoon→evening.
  - `02.mkv`: ch 10 with `ledMode:"media"` (full, glow .8).
  - `03.mkv`: ch 9 with `ledMode:"media"` and screens on the monitor, arcade and marquee.
  - Cut files: `verify-cut.json`, `void-cut.json`, `rooms-cut.json`.
- **Seek accuracy:** a 2 s clip's burnt-in counter runs 0140, 0141 … 0150 with no repeats. The first `01.mkv` had an occasional repeated frame (a seek to an exact n/30 boundary can show frame n−1). That is fixed with a 1.5 ms in-frame offset, and the clips were re-rendered.

## Added for the ch 10 LED look (2026-10-30, late)

- **Dimming lights:** a `sceneEdits` entry with `lightType` (a regex on the light type: `PointLight|SpotLight|HemisphereLight|DirectionalLight`) selects lights instead of meshes. `match` and `path` still filter by name and path.
  - `intensity` multiplies whatever the room or app writes, and can be keyframed.
  - `color` sets the light's colour.
  - Example: `{"lightType":"PointLight","path":"^Room:home","intensity":0}` switches off the home office's four practical lamps.
- **`ledSurfaces`:** `{desktopStrength, floorStrength, baseStrength, shelfStrength, …}` sets the app's LED surface sliders (strengths 0–200) for the shot. They are restored afterwards.
- **`ledGain`:** multiplies the media-mode pixels after the app's sampler. This goes beyond the app's `full` preset. The sampler outputs linear values, so dark film content reads faint, and a gain of 2.5–4 gives stripes as bold as the live app on a dark room.
- **`sceneGlobals`:** `{environmentScale, exposure}` multiplies `scene.environmentIntensity` (the image-based ambient that still lights the walls once the lamps are off) and sets the renderer exposure. Both are restored afterwards.

**ch 10 as now in `shots/10.json`:**
- `ledMode` `media`, `ledPreset` `full`, `ledGlow` 1, `ledGain` 3.
- `ledSurfaces`: desktopStrength 200, floorStrength 200, baseStrength 120.
- `sceneGlobals`: environmentScale 0.25.
- Practical point lights ×0, hemisphere ×0.3, directionals ×0.5.
- Lamp shade, pendant, reading-lamp and modern-lamp glow ×0.15.
- The night window ×0.5 and the clock are kept.

Stills: `verify/stills/led-ch10-tuning-before.jpg` and `led-ch10-tuning-after.jpg` (3 / 7 / 10.5 s). `led-ch10-tuning-alt-softer.jpg` is a softer alternative: lamps at 8%, environment ×0.35, gain 2.5.
