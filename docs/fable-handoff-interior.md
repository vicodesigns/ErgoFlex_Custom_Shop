# Interior pass: hand-over (Fable, 25 Nov 2026 night)

Branch `director/fable-interior`, from `133dd4e8`. Wound up early on Orch's word (credits), so this is a first layer
plus the tooling, not the full round.

## State: merged or not, no frame changes

The pass is **off by default** (`DEFAULT_ON = false` in `interior-cinema.mjs`). With no switch on the address the film,
the Director and the Studio draw exactly what they drew at `133dd4e8`: `applyInteriorPass` returns before it adds
anything. Switch it on with `?interior=1` (Director or stage address) or `--interior 1` (render-still.cjs,
render-cut.cjs). It never runs in the Studio or for a Classic look.

Why off: only the coast room was looked at in a still with the pass on, and that was before the last two changes (wall
quads now run from `from` to `to`; screens and lit signs are cut out of the shade). The other eight recipes are written
from the rooms' measured layouts and have **not been seen**. They should not reach a film unseen.

## What is in the branch

* `interior-cinema.mjs`: the tools. Envelope (wall shade toward ceiling and corners, an even shade for the wall that
  stands against the light, window and screen cut-outs, floor falloff toward the walls), wall washes (rake, scallop, up,
  band, round), floor pools, architectural finishes, plain built dressing. Overlays only: no lights, no scene assets,
  no depth write; the shade draws before all additive light, so the desk LED floor light is untouched.
* `interior-cinema-rooms.mjs`: one recipe per film room and layout.
* `workspace-3d.mjs`: two calls (after the shell is built, after props and life are in) and one field reset.
* `tools/experience/render-still.cjs`, `render-cut.cjs`: `--interior <value>` on the stage address.
* `tools/experience/interior-probe.cjs`: prints what a chapter's room is made of (layout, walls, lights, surfaces,
  furnishings with boxes in room millimetres), with `--match` and `--eval`.
* `tests/interior-pass-test.mjs`, `docs/interior-pass.md`.

## Per room (all behind the switch)

| chapter | room / layout | recipe | seen in a still |
|---|---|---|---|
| 2 rise | home/house | window wall against the light, side walls toward ceiling and far corners, floor under walls; window light raking along both side walls | no |
| 3 create | creative/premium | brick wall toward ceiling and materials corner, daylight wall against the light; three track scallops on the brick | no |
| 4 commons | library/humboldt | study end only: tackboard wall toward the pilot corner, carpet under back and tackboard walls | no |
| 5 coast | occmedialab/house | window wall against the light, teaching and display walls, carpet; daylight rake on the teaching wall | yes, earlier version: reads well at 7 s (the monitor separates from the wall); the window cut-out was mirrored then and is fixed since, unseen |
| 6 oilers | highschool/house | as coast | no |
| 7 wellness | gym/house | corners, ceiling line, rubber floor under walls; four downlights grazing the slat wall | no |
| 9 music | gaming/house | floor falloff only (walls are lit by the desk LEDs: left alone) | no |
| 10 media | music/house | floor falloff only | no |
| 11 storage | workshop/house | block walls toward ceiling and corners, slab under back and right walls | no |

Chapters 1, 8, 12 are the black product stage: nothing to do.

## Audit findings (from frames of req-20261125T155816-film-4K.mp4), ranked by need

1. **Commons** (ch 4): flattest room. White walls and tackboard one value, grey carpet without a lit centre. Its own
   architectural light layer exists but its daytime levels are .05 to .08.
2. **Coast** (ch 5): large even off-white walls, even carpet; the window wall is as bright as the wall facing it.
3. **Wellness** (ch 7): charcoal on charcoal; the slat wall behind the desk does not read.
4. **Rise** (ch 2): well dressed; plain beige walls with no falloff, lamp only reads in the evening.
5. **Create** (ch 3): good cast shadows on the brick already; brick is one value top to bottom, picture lights do not land.
6. **Oilers** (ch 6): busy and believable; walls even.
7. **Storage** (ch 11), **music** (ch 9), **media** (ch 10): already the strongest rooms (real cast shadows, night mood).

## Not done

* Looking at eight of nine recipes, and tuning any of them. Strengths are first guesses.
* Set dressing, material and texture work, palette: nothing changed. The `pools`, `finishes` and `dressing` tools exist
  and no recipe uses them.
* Browser tests (Director e2e, room lighting, room tests) were not run: the desk was short of memory and another
  agent held the stills lock. Node tests only (below).
* The 1080p before/after stills were never requested.

## Traps found

* Film frames top out near 2.5 m of wall: a narrow shade at the ceiling line is out of frame. The shade has to ease
  over most of the wall height to be seen.
* film-quality.mjs draws straight to the canvas (display-encoded) and multiplies ambient occlusion on afterwards; it
  is not a linear composer, whatever its header says. Overlay alphas mean the same live and in the film.
* Wall cladding is deep (coast wainscot 54 mm, poster frames 63 mm, gym slats): an overlay must stand clear of it or
  it stripes. Screens on walls are 65 to 70 mm proud and sit behind such an overlay, hence the cut-outs
  (`litOnWall`). Check every wall screen in a still before switching a room on.
* Vico moves wall art in the Director (create has two paintings where the room builds three). Do not put light at a
  painting's built position; parent it to the painting.
* A worktree lacks the gitignored media: rise failed to render here on `screens/cine3b-rise-curved.mp4`.
* `pgrep -f` / `pkill -f` with a pattern that is in your own command line matches your own shell.

## Next round

1. Stills, pass off and on, per room (1080p on Windows, `--interior 1`): rise 6.8 s and 17.7 s, create 1.9 s and 9.9 s,
   commons 6 s and 15 s, coast 0.7 s and 7.3 s, oilers 1.5 s and 12 s, wellness 2.3 s and 13.5 s, music 6.3 s,
   media 1.7 s, storage 6.7 s and 17.3 s. Look for: a shaded screen, a hard edge at a window, striping on slats or
   wainscot, a dark band where a wall is cut away.
2. Tune, then switch rooms on one at a time (a `verified` flag per recipe would do), and only then `DEFAULT_ON`.
3. Then the layers this round did not reach: lamp and fixture landing parented to the fixtures, commons carpet and
   wall values, gym slat wall, dressing for the coast room's long blank wall.
