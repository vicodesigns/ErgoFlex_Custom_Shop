# Screen light: data contract (render side)

21 Nov 2026. Vico on the media chapters (ch 9 `music`, the gaming room's TV montage; ch 10 `media`, movie night): the colours
the screens throw onto the surfaces look a bit too bright and washed out. The `ui` session builds the controls in the
Director's Lighting tab (per chapter); this file is what the render reads. Branch with the render side:
`eng/screen-reflection` (based on `video/cinematic-intro-hq` c4a2becb).

## What the "screen light" is

In a chapter with `ledMode: 'media'` the desk's LED light *is* the screen's picture (the app's Game Mode path):
`tools/experience/film-fx.mjs` (`makeLed` / `sampleLed`) samples the screen clip each frame with
`led-screen-sampler.mjs` (desktop strips = successive horizontal bands of the picture, wings = its left / right edges, in
linear light, x the `ledPreset` level: `full` = 1), multiplies by the chapter's `ledGain` and **clips each channel at
255**, then uploads it (`ErgoFlex.ledGameMode.sample`) to the strips, the desk's receivers (desktop underside, floor / foot
glow, base, wings: `ledSurfaces`) and the room LED spill (walls and floor within ~2 m). The picture's mean colour also
becomes the LED colour (`setLedColor(led.avg)`). That coloured light on the desk, the floor and the walls is what Vico
sees as "the screen's reflection". The screens' own pictures are not part of it (that is `screenLook`, the Graphics tab).

Why it is bright and washed out: ch 10 runs `ledGain` 3.15 (`mediaBaseGain` 3.5 x .9) and ch 9 .77 with every receiver
at 160-200 of 200, so most bright picture colours have at least one channel pushed past 255; per-channel clipping turns
them toward white (a red-orange (1, .4, .1) x 3.15 becomes (1, 1, .3)). There is no saturation control on the path.

Only chapters with `ledMode: 'media'` have this light; in the 3rd cut that is ch 9 and ch 10 only. In any other chapter
the field is read and ignored.

## The field

One per chapter, in the chapter's film shot, next to the other Lighting-tab globals (`ledWallGlow`, `ledFloorGlow`,
`ledFloorSources`):

```json
"sceneGlobals": {
  "screenLight": { "gain": 0.7, "saturation": 1.3, "contrast": 1.0, "tint": "#ffffff", "keepHue": true }
}
```

| key | type | range | default (= today) | unit / meaning |
|---|---|---|---|---|
| `gain` | number | 0 … 3 | 1 | Brightness of the screen light: a multiplier on top of the chapter's `ledGain` (1 = as today, .5 = half). Show as %. |
| `saturation` | number | 0 … 3 | 1 | Colour strength of the light, luminance kept (linear Rec.709 weights): 0 = white light, 1 = as sampled. Show as %. |
| `contrast` | number | 0.5 … 2 | 1 | A power on each sample's luminance around linear .18: above 1 the dark parts of the picture throw less light and the bright parts more; below 1 evens them out. Show as %. |
| `tint` | `'#rrggbb'` | any hex | `'#ffffff'` | A colour filter on the light at the same luminance (white = none; a pale colour = a light tint). |
| `keepHue` | boolean | | `false` | Highlights: `false` = as today, a channel pushed past the strip's maximum clips on its own (bright colours wash to white); `true` = the whole colour is scaled down instead, keeping hue and saturation. A checkbox ("Keep colours in highlights"). |

Order the render applies them in, per LED pixel (linear light): contrast -> saturation -> tint -> x `ledGain` x `gain`
-> clip (per channel, or whole colour with `keepHue`) -> upload. The picture's mean colour (the LED colour) takes
contrast, saturation, tint and `gain` (it never took `ledGain`) and is clipped as a whole.

Not keyframed (one value per chapter). If keys are wanted later they would follow the `ledFloorGlow` shape
`[[seconds, value], ...]`; not in this contract.

### Defaults and "unchanged pixels"

- Field absent, `{}`, or every value at its default: film-fx takes exactly today's code path (same arithmetic), so the
  chapter's pixels are identical. Chapters without `ledMode: 'media'` ignore the field.
- Values are kept **only where they differ from the default** (the cleaner drops default values, clamps to the range,
  rounds to .001, lower-cases the hex). `cleanScreenLight(v)` in `experience/screen-light.mjs` is the single cleaner; it
  returns `{}` for "all defaults" and `null` for something that is not an object.
- Ch 9 and ch 10 get a quick improvement as **data** (their film shot's `sceneGlobals.screenLight`, not a code default):
  see `VERIFICATION.md` for the values and the before / after frames. The Director therefore opens those two chapters
  showing those values, not 100 %.

## How it travels (Director -> film)

1. Director opens a chapter: `cleanLighting({..., sceneGlobals: film.sceneGlobals})` (experience/film-lighting.mjs) now
   carries `sceneGlobals.screenLight` through `cleanScreenLight` (already wired on `eng/screen-reflection`). The control
   values = `lightFor(shot.sceneGlobals.screenLight)` (defaults filled in).
2. Live preview: the Director's `shot.sceneGlobals` is spread over the film's (`liveFilmShot` / `filmRenderShot`,
   experience/film-chapters.mjs / film-render.mjs: `{...film.sceneGlobals, ...lit.sceneGlobals}`), so the Director's
   `screenLight` object replaces the film's whole. `sceneGlobals` is a live field: film-fx `update()` applies a
   `screenLight` change in place (no reinstall, takes effect on the next frame).
3. **Reset**: write `sceneGlobals.screenLight = {}` (do not delete the key): `{}` means "today's defaults" both live and
   in the importer, which then **removes** the film's field. A missing key means "the Director did not touch it" and the
   film keeps its value (e.g. the ch 9 / 10 data defaults).
4. Export cut: the shot's `sceneGlobals.screenLight` as above.
5. `tools/experience/build-round8-director.py <hq> --import <export>`: `screenLight` is in `GLOBAL_FIELDS`, so it is kept in
   `director-camera-<id>.json` `lighting.screenLight` (cleaned by `clean_screen_light`, the Python twin of
   `cleanScreenLight`); the pass (`build-round8-director.py <hq>`) writes it into the chapter's film shot
   (`review-cut.json`, the chapter's shot file) as `sceneGlobals.screenLight`, or removes it for `{}`.
6. Render: render-cut / render-still pass `sceneGlobals` whole to film-fx (`sceneGlobals` is already an FX field).
   `chapter-keys.py` hashes the whole shot, so only chapters whose `screenLight` changes get a new render-cache key.

## For the `ui` session

- Import `FIELDS`, `cleanScreenLight`, `lightFor`, `isToday` from `experience/screen-light.mjs` (labels, tips, ranges, steps
  and defaults are in `FIELDS`; `pct: true` = show as %, `color: true` = colour picker, `bool: true` = checkbox).
- Show the section only for chapters whose film shot has `ledMode === 'media'` (ch 9, ch 10 in this cut); elsewhere it has
  no effect.
- Write `shot.sceneGlobals.screenLight = cleanScreenLight(values)` (keep `{}` on reset); nothing else is needed for the
  round trip.
