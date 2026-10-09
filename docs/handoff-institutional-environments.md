# Handoff: finish the Mobile IT and Healthcare environments

Status: in progress · Written 9 October 2026 · Repo: `ErgoFlex_Custom_Shop`
Last related commit: `9f502a3` · Cache version: `institutional-sweep-20261009`

## Goal

Bring **Mobile IT** (`mobileit`) and **Healthcare** (`hospital`, `laboratory`)
up to the quality of the environments that are already signed off: Educational
(6 stages) and Government (Government office, Police, Security). The original
furnished rooms (`office`, `coworking`, `library`) set the bar for layout,
decoration, materials, fine detail, and lighting at all five dayparts (morning,
afternoon, evening, night, party).

Every layout must show several ErgoFlex desks in distinct, believable roles,
mixing 48x30 and 60x30. Both groups already do this; keep it so.

## Where each group stands

| Group | Done | Remaining |
| --- | --- | --- |
| Mobile IT, `institutional-it.mjs` (S/M/L) | Layout, desk roles, storytelling. Materials are mostly done; that pass stopped early when the session wrapped up. | Finish materials, lighting, principal sign-off |
| Healthcare, `institutional-healthcare.mjs` (Hospital and Lab, S/M/L) | Layout, desk roles, storytelling | Materials, lighting, principal sign-off |

The remaining work is listed at the end of each group's sections in
`docs/institutional-environments.md` ("Healthcare group …" and "Mobile IT
group …"). In summary:

**Mobile IT**
- **Materials (finish):**
  - The sill laptop sorter is simple.
  - The intake `tablet-pc` library prop shows a tiled start screen; replace it
    with a procedural tablet.
  - Re-check the packing bench HPL top; its speckle was softened at the last
    moment and never rendered.
- **Lighting:**
  - Light modes are the brief's untuned values.
  - Rack fronts read dark through the door mesh by day; light the cold aisle or
    add a soft fill.
  - Rack LED levels (`I.rackLeds`), the cold-aisle, magnifier, imaging, console
    and NOC pools, the shelf work light, window `VIEW_LEVEL`, and the blind drop
    per daypart are all untuned.
  - In Medium at night the door renders saturated red-brown.
  - Desk LEDs at night/party (`#163f46` / `#1d3d3a`) still tint the desktop teal.

**Healthcare**
- **Materials:**
  - Oak-look HPL texture for the headwalls and bay floor inlays.
  - Bed guard rails and coved skirting.
  - Lab: tile splashback, epoxy-fleck worktops, floor re-tone.
  - Curtain and blind fabrics.
  - Window views: a healing garden (hospital) and a research park (lab). The
    shared campus view still shows.
- **Lighting:**
  - `MODES` and the pool and lens levels are the brief's starting values.
  - Tune the night lights, headwall wash, bench strips, fume hood and grow light.
  - The ceiling fixtures are still the shell's defaults.
  - Desk LEDs tint the black desktop in evening, night and party: the lab party
    `#4a1813` reads red, the hospital teal.
- **Hospital night observation** is the signature mood: a dark ward, amber
  floor-level night lights, monitor glow.

## Read first

1. `docs/environment-briefs/TEAM-RULES.md`: concurrency, RAM, craft and
   verification rules. Follow them.
2. `docs/environment-briefs/healthcare.md` and `docs/environment-briefs/mobileit.md`:
   the design lead's briefs (desk roles, layout, decoration, materials, lighting
   for each of the five dayparts, top-10 gaps). `layout-check/hc.mjs` with
   `check.mjs` re-runs the clearance check for healthcare.
3. `docs/institutional-environments.md`, especially:
   - **Team structure**: file map, the stations spec, override hooks
     (`lighting`, `sceneOverrides[id].modes/desk/shelf`, `floor`, `furnish`,
     `decorate`, `atmosphere(phase, gain, kit)`, `extraLamps`, `stationDetail`,
     `mainDeskDetail`, `stageKit`), the review tool, and pitfalls.
   - The Educational and Government sections, including their principal
     reviews: the lessons learned and the techniques to reuse.
4. `institutional-education.mjs` and `institutional-government.mjs` are the
   signed-off reference implementations. Copy their patterns, but do not edit
   them:
   - per-daypart `LIGHT` tables;
   - the separate "Daylight and lamp light pools" layer;
   - material classes split out of the vertex-colour dress material;
   - real-world-size canvas maps;
   - per-scene window views;
   - dithering on large surfaces.

## Pitfalls that cost time before

- **LED wash on the desk.** Desk LEDs tint the black ErgoFlex desktop through
  `room-led-spill`. Keep LEDs off by day and use low values at night/party,
  e.g. `#5a3e2a` warm night, `#4a1813` deep red event. The product must read as
  black/red in every daypart.
- **Light budget.** 5 real lights per room: 3 room PointLights plus at most 2
  local lamps (the test requires 1–2). Everything else is emissive or an
  additive pool.
- **Pools.** Additive pools parented to assets break the asset-bounds test and
  make the Groove planner report "blocked". Put them in the pool layer, copying
  the asset's transform before drawing. A pool that dips below the floor removes
  that station's collider.
- **Collider name filter.** `RoomInteractions` silently drops colliders for
  names matching `/ceiling|window|curtain|door|daylight|…/`. This matters for
  cubicle curtains.
- **Wall groups near the floor.** Any wall-attached group or asset reaching
  within ~120 mm of the floor becomes draggable floor furniture and stays
  standing when the wall is cut away. Use `presentationOnly` for finishes and
  `propAnchor: 'wall'` for wall features.
- **Order of creation.**
  - `kit.lights` is created after `furnish`/`decorate`, so per-room light
    changes belong in `atmosphere`.
  - `kit.dress` is created after `furnish`, so create the material first.
  - Stations are added after the room build, so attach their detail with
    `stationDetail`.
- **Station footprint.** The real station footprint is about ±545 mm deep with
  the shelf and feet, not ±381.
- **Brands.** Avoid library props of real branded products. Use generic or
  procedural content only, with no real logos, people or data.

## Verify

- Render with `node tools/props/institutional-review.mjs --only <ids> --out <scratch dir>`.
  Options: `--tiers`, `--phases`, `--angles wide,hero,reverse`, `--reference`.
  Look at every image: each tier × 5 dayparts × 3 angles, plus close-ups.
- Run one headless browser at a time. RAM is tight, and other sessions'
  long-running puppeteer `harness.cjs` processes can push the load very high;
  render in small batches.
- Run `node tests/institutional-room-test.cjs --only=mobileit` (or
  `--only=hospital,laboratory`). Finish with the full suite, which must pass all
  12 scenes.
- Write a short dated note under the group's section in
  `docs/institutional-environments.md`.

## How to run it (what the user asked for)

The user wants specialist agents, at most 2 running at once:

1. **Domain-expert materials specialist** for each group.
2. **Lighting and time-of-day specialist.**
3. **Principal reviewer** who fixes whatever is still weak and signs off each
   scene and tier.

Run Mobile IT and Healthcare as two parallel lanes: each group owns its own
module file, so they don't collide. Do not touch the signed-off group files,
`portal-ui.*`, or the LED files unless asked.

The orchestrator also checks the contact sheets itself before accepting a
sign-off.

## When done

- Bump `institutional-sweep-20261009` to a new value in every importer (`grep`
  for it: the institutional modules, `room-*.mjs`, `workspace-3d.mjs`,
  `studio.js`, `index.html`, `product-demo.html`, the test, the review tool and
  the doc).
- Commit only environment files. Check `git status`: other sessions may be
  working in this checkout.
- Push once the user agrees.

## Open decisions for the user (not part of this task)

- The LED spill also tints the desktop in the original Office and Library
  evening/event close-ups. The fix would be the reflection strength in
  `room-led-spill.mjs` / `studio.js`, or those rooms' LED colours. Ask before
  touching the existing rooms.
- Low evening sun puts bands across the open-topped walls; this comes from the
  shared light rig.
- The Studio's scene panel covers much of the 3D viewport. A collapsible panel
  or a fullscreen viewer would make exploring the rooms easier.
