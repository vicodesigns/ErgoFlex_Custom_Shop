# People pass, round 1 (November 25, 2026): handoff

Branch `director/fable-people`, from `133dd4e8`. Everything is in the cast finishes; no model was rebuilt and no pose,
key, path, camera or timing was touched. The frozen Classic casts (Create, Commons) are unchanged.

## What changed

All in `media-cast-finishes.mjs` (plus two lines in `workspace-3d.mjs`), judged on 4K frames of the 25 Nov film and
with `tools/people/finish-preview.mjs`:

| What looked wrong | Fix | Constant |
|---|---|---|
| Hairlines were the rim of a cap: a one-pixel cut at the nape, temples and forehead (Maya, Ava, everyone with cut-out hair) | the hair's painted fringe is drawn as coverage, dithered on the hair itself (`softHairEdge`: alphaTest + alphaToCoverage + alphaHash, two patched shader chunks) | `HAIR_FRINGE.width` (.56 of alpha; smaller = harder edge), `.dither` |
| Cropped and sculpted coils ended in a hard rim (Andre, Noah, Zoe, Nia, Tess, Jack) | a taper map thins the last centimetre to the hairline (`coilTaper`) | `COIL_TAPER` (`from`, `to`: fraction of hairline to crown) |
| Brushed roots were a solid shell out of the skin (Ava, Mia, Yara) | rings in from the rim become vertex alpha where a people model loads (`rootsTaper`), roots are a soft cut-out | `ROOTS_RINGS` |
| Brown eyes were maroon, red in a lit close-up | the eyeball shader turns the iris brown at the same brightness (`irisTone`); whites, veins, other iris colours untouched | `IRIS_TONE` (`hue`, `gain`) |
| Lashes went pale grey-blue at a glancing angle | matt, no environment reflection | in `mediaPersonMaterial` |
| Jersey read as embossed chevrons, jeans as a rubber mat (stitches were 9 to 12 mm) | weave maps at 1.7 mm (jersey), 4 mm (sweaters), 2 mm (woven) | `FABRIC_SCALE` (repeats), `FABRIC_DEPTH` |
| Lacquered shine on forearms, necks, noses | rougher skin at skin's index of refraction, a trace of clear coat | `SKIN_GLOSS` |
| Silvery film on dark hair at the crown | less sheen, warm tone | `HAIR_SHEEN` |
| Dark pin-holes where part-covered hair left the canvas alpha below 1 | hair keeps the canvas opaque (custom blend) | in `softHairEdge` |

Also: a fading desk person's hair now fades with them (it used to stay solid and pop).

`tools/people/finish-preview.mjs --ids <models> --out sheet.png [--before <dir with another media-cast-finishes.mjs>]`
renders close-ups of one model with the finishes on a small software-GL page (a few seconds, little memory).

## Rendering

Chapter cache keys do not hash code: a film job must be forced (or the epoch bumped, Vico's call) for these to show.
Every chapter with people is affected. The soft hair edge is multisample coverage: judge it at the film's real size.
Before/after stills were requested from the render PC (11 frames, listed in the session's message to the orchestrator);
none had come back when this was written, so the film-light result is unverified.

## Tests

`tests/room-people-cast-detail-test.mjs` section 4c pins all of the above. The pure-node people and pose tests pass
except `people-postures-test.mjs` and `pose-thumb-test.mjs`, which fail on the clean base too. Browser (e2e) tests
were not run on the desk (memory).

## Not done (needs a model rebuild or a decision)

- Hems, collars and sleeve edges are single sheets with ragged tabs; arm skin pokes through a sleeve edge at the
  armpit (Maya), Andre's collar flap stands off in the shelf reach. Garment geometry: `tools/people/tailoring.py`,
  rebuild with `build.py --jobs 1`.
- Clothes are skin-tight (jeans read as leggings on Maya and Ava). Loosening changes silhouettes in keyed frames: Vico's call.
- Ava's ponytail cap pokes through her roots shell (pale patches on the crown in hard light).
- Yara's fringe is still a straight band; Kai's and Omar's short cuts keep grey highlights.
- The white of the eye is a dull grey (baked lid shading); the iris fix did not touch it.
- Walks: Yara carries her arms away from the body with open hands. The walk's rest pose and `solveWalk` are shared by
  every walker, including keyed ones, so it was left alone.
- Andre's arms lock straight in the shelf reach (his keys: not touched).
- Seat direction was checked on the 25 Nov film frames (every seated person faces their desk, table or screen);
  nothing in this pass moves anyone.

## Ideas for the next round

- A streak map in the roots' own UVs so their taper breaks into strands, not a soft band.
- Macro fold normal maps for the plain T-shirts and trousers (they have none; only the fine weave now).
- Eye textures rebuilt with a brown iris and a cleaner sclera (`build_people.py` `eye_image`), then drop `irisTone`.
- Hair cards for the nape and temples of ponytail01 (baby hairs) instead of the texture fringe alone.
