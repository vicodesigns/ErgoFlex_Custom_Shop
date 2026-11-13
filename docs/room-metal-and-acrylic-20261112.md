# Metal and clear acrylic in the rooms and the film (November 12, 2026)

Vico: in the artist chapter "the aluminium and brushed aluminium in the easel bar accessory, the plexi / plastic for
the easel brush holder accessory and the aluminium tilt actuators" look wrong; "check every other scene for these
issues as well".

## What was wrong

- **In the film** every metal went black. The high-quality profile (`tools/experience/film-quality.mjs`,
  `reflections`) photographs the room into a cube map from the middle of the desk and gives it to every material
  with metalness of 0.6 or more as its environment. The room it photographs has its ceiling and near walls cut away
  for the camera, so the capture is mostly black: the artist chapter measured 0.002, 0, 0, 0, 0, 0 on its six
  sides (`reflectionLevel`, now printed with the `[film-quality]` line). A metal with a black environment is black.
- **In the Studio** the same materials reflected the product stage's environment, a dark studio with softboxes
  (`createStudioEnvironment`): silver where a softbox is mirrored, near black where the backdrop is.
- **Clear acrylic** (the painter's shelf holders) is a transmissive material; what shows through it is whatever the
  transmission pass has behind it, in a room mostly darkness. The cuts worked round it with a scene edit that made
  the acrylic opaque white.

## What changed

- `studio.js` `roomGlossPass` (run from `scene.onBeforeRender`): in a room, a material with metalness of 0.45 or
  more, or named acrylic / plexi, gets its own environment, a room (`createRoomGlossEnvironment`: bright ceiling,
  light walls, a window, a darker floor), at `scene.environmentIntensity` times `ROOM_GLOSS`, so a dark room, the
  hour and a film's `environmentScale` dim it with everything else. The product stage keeps the studio; switching
  back restores the materials. New objects are found within 20 renders, every frame while a film bakes; a film's
  material copies (fades, edits) are recognised by the environment they carry (`userData.roomGlossBase`).
  Nothing else in a room changes: its light and its other reflections still come from `scene.environment`.
- `film-quality.mjs` calls `ErgoFlex.applyRoomGloss()` before its own swap, so the metals keep the room
  environment and the capture only reaches what is left (glass). The capture's brightness is logged.
- `workspace-3d.mjs`: the painter's shelf acrylic is plain transparency (opacity 0.34, no transmission).
- The three cuts lose the scene edit that made that acrylic opaque (create chapter).
- `tools/experience/render-cut.cjs --list-materials '<regex>'`: prints the materials (type, colour, metalness,
  environment and its level, opacity, film copy or not) of matching meshes, after each still or with
  `--list-screens`. This is how the black bar was traced.

## Checked

Film frames of all nine room chapters before and after (three moments each): the easel bar, the drafting bar, the
tilt actuators and desk hardware, the workshop's tools read as metal; nothing else moved. The Studio's artist room
and workshop.

Every room chapter's pixels change where metal is in shot, so cached chapters are stale until rendered again.

## Calmer window views (same night)

Vico: "the windows and the content out of them are too much, they are too bright and compete with the room".

`window-vista.mjs` `CALM` is laid over every window grade: gain 0.82, saturation 0.95, contrast 0.92, a softer focus
(`soften` 1.5: a camera focused on the room leaves the view a little out of focus) and a thin veil of haze by day.
One place sets every window in the Studio and the film; `{ gain: 1, saturation: 1, contrast: 1, soften: .6, haze: 0 }`
is the look before. A first, greyer setting (gain 0.74, saturation 0.78, haze 0.17) was calm but dull; keeping the
colour and taking only light and sharpness away reads better.

Open with Vico: he also liked the painted views that were there before the photographs, and is open to modelled
scenery outside the windows (foreground planting, a balcony rail, a neighbouring facade) for real depth.

`tools/dev/restamp.py <stamp> [base]` gives every changed root module a new cache stamp wherever it is imported,
up to index.html (the scratch script that did this was lost twice with /tmp).

