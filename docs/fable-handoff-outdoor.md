# Outdoor environments through the film's windows: hand-off (November 25, 2026)

Branch `director/fable-outdoor` (from `video/cinematic-intro-hq` 133dd4e8). Only the four scenery modules changed
(`window-scenery.mjs`, `-kit.mjs`, `-scenes.mjs`, `-details.mjs`), their test and docs. No room file, no cut data, no
camera or timing. Details of each technique: `docs/window-scenery-20261113.md`, "The outdoor pass".

## What every chapter shows outside, and what changed

| Chapter (room) | Outside | Changed in this pass |
|---|---|---|
| awaken, awareness, hero (product stage) | no windows | nothing |
| rise (home) | `garden`: planting, lawn, trees, fence, neighbours; morning to evening | crowns no longer show smooth dark bags between the sprays; lawn has blades, tufts and dried patches; roof tiles; sky depth; sun matches the floor's sun patch |
| create (creative) | `studio-garden`: walled garden, pergola, glasshouse | brick coursing on the wall, bark, lawn and path grain, crowns |
| commons (library humboldt) | `humboldt`: Vico's redwoods, marine layer | the boles are modelled (flare, buttresses, bark ridges, fibrous bark) instead of a 12-sided column with triangular root fins; forest floor has grain and runs past the glass at the sides; the trees stand and branch exactly where they did |
| coast (occmedialab) | `socal-campus`: quad, town, beach, pier, sea | swell no longer ruled lines; far palm fans finer; tiles, stucco streaks, lawn; sky depth; sun from the room's key light (it was on the other side) |
| oilers (highschool) | `beach-school`: lawn, houses, palms, sea | same as coast |
| wellness (gym) | `city` high: roof terrace, roofscape, towers | each block has its own facade (brick or render with framed windows and blinds, ribbon windows, curtain wall); the flat teal sash panels are gone; sky depth |
| music (gaming) | `city-neon`, night | facade detail close up; otherwise as it was |
| media (music room) | `city` low, night; the window is hardly in frame | as above |
| storage (workshop) | `yard`: lumber rack, trailer, fence, house | bark, tiles, gravel grit, crowns; the yard's sun follows the workshop's own key angle |

## Checked

- `node tests/window-scenery-test.mjs` passes (new checks: the sun and the room rig held together, a rig direction is
  taken per wall, material kinds, the redwood bole draws nothing from the scene's random stream).
- Every leaf, light and halo of the nine film scenes is in the same position as at 133dd4e8 (compared array by array).
- In the real Studio (headless, the desk's GPU): the gym in the morning builds, every shader compiles, and the
  scenery's sun is 0 degrees off the room's key light.
- Cost: no new pass; with a window filling a 1080p frame 4.2 -> 5.2 ms (city), 5.1 -> 5.5 ms (grove) on the desk.
- `tests/gym-theme-test.mjs` fails on the clean base too (desk finish, unrelated).

## Not done

- The real-Studio probe of the other film rooms (commons with its three glass walls, home, media lab, high school,
  creative, workshop, the two night rooms) was cut short; only the gym was confirmed. `tests/window-scenery-rooms-test.cjs`
  (every room in a browser) was not run.
- No stills from the render PC yet (requested through Orch: rise 8.3 / 20.2, create 8.9, commons 6.1 / 14.8,
  coast 2.3, oilers 2.3, wellness 3.0 / 8.5, music 7.6, storage 13.5). The new GLSL (textureGrad, more fwidth) has
  only compiled on the desk's Vulkan; a black window on the render PC's D3D11 would be a compile failure.
- The module stamp `?v=polish-20261113b` is not bumped (it is in twenty room files); Vico's open Director needs a hard
  reload after a merge to see the new scenery.
- The film needs an epoch bump or `force` for the room chapters (Vico's call); `render-epoch.txt` is untouched.

## Needs Vico's eye

- The daytime sun outside moved to where each room's key light comes from. Evening: 16 degrees up instead of 5, so
  the sky's sun is higher than the sunset look it had. Coast and oilers: lit from the right, the sea's glitter no
  longer in the window. One line reverts it (`RIG_SUN` in `window-scenery.mjs`), at the price of the mismatch.
- The Classic looks of Create and Commons share the scenery modules, so their windows changed too.

## Ideas for the next round

- Fan palms as real fronds (coast, oilers); they are the subject of the coast's window. Keep the scene's random
  stream (the palms draw from it).
- Glass: a faint reflection of the room on the pane at grazing angles, where a room has no glass of its own.
- Haze that warms toward the sun, so far towers silhouette against the bright side of the sky.
- Night: light pollution low in the city sky, clouds lit from below.
- Cars, houses and street furniture are still plain models; no people or traffic outside.
- Towers: a second material per face (stone base, glass shaft), setbacks.
