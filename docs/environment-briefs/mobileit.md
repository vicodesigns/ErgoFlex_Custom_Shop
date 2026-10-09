# Design brief: Mobile IT (`mobileit`, kind it)

Owner module: `institutional-it.mjs`. Small/Medium/Large = `apartment/house/spacious`.

## 0. Conventions

- Units mm. x across, centred at 0. **−x = window wall** (opening centred at `bz+0.54d`, 48 % of depth, sill 800). **+x = door wall** (door centred at `front−1600`). z runs from `bz=−d/3` (back wall) to `front` (open, camera). The camera looks from the front-left, so the back wall and +x wall are the hero surfaces.
- `turn` 0: user faces the back wall, chair at +z 1050. 180: faces the front. 90: faces −x. 270: faces +x, chair or stand zone at −x. Desk tops 1219 (48) / 1524 (60) × 762. Desktop props: local x across, **+z toward the user**; shelf = rear monitor shelf.
- All layouts were checked with an overlap and gap script mirroring `tests/institutional-room-test.cjs`. Results: no overlaps; ≥ 900 between independent items; ≥ 800 to wall shelving; door clear zone `x ≥ w/2−1100, z front−2200…front−1000` free; **a 1200 mm cold aisle in front of the racks**.
- Test-required names: `IT equipment rack`, `Daily planning table` (`activity-table`).
- **Remove** the existing `service-bench` (in S it sits inside the door zone). `options().lampSupport` currently points at `service-bench`. Re-point it to `{ id: 'storage', height: 1800 }` (parts shelving top: an under-shelf work light) or set it to `null`. Station lamps come from the `stationDetail` hook (below).
- MAIN gets IT-specific dressing in place of the generic `journal + laptop + paper-holder`.
- Light budget: 3 room lights + ≤ 2 lamps. Rack LEDs, screen glows, the tech-bar sign and the ESD-bench magnifier ring are emissive plus **pools**.

- **Procedural station props and station lights.** Stations are added after the room build (`WorkspaceRoom.addOfficeStations`), so `kit.byId`/`kit.taskLamp` can't reach them. Library props go in each station's `desktop`/`shelf` arrays. Anything marked *procedural* here (scanners, microscope, lightbox, ESD mat, sharps bin, document camera, pools on the desktop) needs a new optional group hook, e.g. `stationDetail(spec, mount, THREE)`. Call it beside the existing `this.decorateStation?.(mount, spec)` in `addOfficeStations`, so the detail travels with the movable desk. Station "task light" = emissive panel + additive pool built in that hook; no real PointLights.

| tier | w × d, h | bz / front | MAIN at | door zone |
|---|---|---|---|---|
| Small | 5800×7200, 3100 | −2400 / 4800 | [−1650, −500] | x≥1800, z 2600…3800 |
| Medium | 7600×9400, 3250 | −3133 / 6267 | [−2550, −1233] | x≥2700, z 4067…5267 |
| Large | 9400×11600, 3400 | −3867 / 7733 | [−3450, −1967] | x≥3600, z 5533…6733 |

**Lens (IT field-service lead + workplace designer):** a **field-service depot and tech bar**. A network/server rack row stands at the back with a proper cold aisle. Laptop imaging and deployment stations stage devices onto carts, which roll out to sites. An ESD repair bench, a walk-up tech bar at the door for user drop-offs, and (L) a small NOC position and an asset-intake desk. The story: **devices flow from intake → repair/imaging → staging carts → deployment**. Floor tape and signage show that flow.

## 1. ErgoFlex desks

| id | role | size | S at | M at | L at | turn | pose | chair | desktop | shelf |
|---|---|---|---|---|---|---|---|---|---|---|
| MAIN | Field tech diagnostic desk | user | [−1650, −500] | [−2550, −1233] | [−3450, −1967] | 0 | daypart | Leap | kenney-furniture-laptop [−260,0,0]; multi-tool [300,0,130] t20; procedural **USB-C dock** (120×20×60) [80,0,−60]; procedural **cable coil** (torus r60, `#2b3640`) [560,0,60]; headphones [−580,0,−100] | kenney-furniture-computer-screen [0,0,0] |
| imaging-deployment | Laptop imaging and deployment station (standing) | 60 | [800, 1300] | [2500, 600] | [2000, 0] | 0 | 43.5 / 0 | none | kenney-furniture-laptop ×3 at [−500,0,−20], [0,0,−20], [500,0,−20] (lids open, imaging-progress screens); procedural **8-port network switch** (440×44×200, 8 green LEDs) [0,0,150]; airtag ×3 as asset tags [−560,0,160], [−480,0,170], [−400,0,160] | kenney-furniture-computer-screen [0,0,0] (imaging dashboard) |
| tech-bar-walkup | Tech bar (walk-up help, faces the door) | 48 | [1000, 3800] | [2100, 5167] | [3000, 6633] | 270 | 43.5 / 0 | none | tablet-pc [−250,0,60] (check-in, turned to the visitor t180); kenney-furniture-laptop [200,0,−10]; wireless-charger [470,0,120]; earbuds-case [430,0,−130] | kenney-furniture-computer-screen [0,0,0] (queue "NOW SERVING 12") |
| rack-console | Rack-side console (crash cart) facing the racks | 48 | – | [200, 348] | [−400, −386] | 0 | 40 / 0 | none | kenney-furniture-computer-keyboard [−40,0,120]; kenney-furniture-computer-mouse [300,0,110]; procedural **KVM box** + **console cable** (bezier tube) [−480,0,−60]; clipboard [450,1,40] t10 (rack checklist) | kenney-furniture-computer-screen [0,0,0] |
| repair-bench | ESD repair bench | 60 | – | [−2550, 2000] | [−3450, 4500] | 0 | 28 / 0 | Leap (ESD chair) | procedural **ESD mat** 1300×600 `#3d6f8e` with a coiled wrist strap [0,1,40]; graphics-card [−200,0,−20] (open component); multi-tool-open [150,0,140]; caliper [380,0,150] t15; oscilloscope [−560,0,−120]; procedural parts tray (6 compartments) [450,0,−60] | desk-lamp [−500,0,0] (magnifier lamp stand-in) + kenney-furniture-computer-screen [300,0,0] |
| noc-monitoring | NOC monitoring | 60 | – | – | [−3450, 1500] | 0 | 28 / 0 | Leap | office-keyboard [−80,0,110]; magic-mouse [330,0,100] t90; headphones [−560,0,−90]; insulated-mug [600,0,60] | curved-monitor [0,0,0] (network map) |
| asset-intake | Asset intake and returns | 48 | – | – | [1000, 3500] | 0 | 28 / 0 | Leap | tablet-pc [−280,0,60] (scanner app); papers-envelopes [250,0,110] (return labels); airtag [480,0,−60]; procedural **label printer** (160×120×200) [−480,0,−90] | – (cardboard-boxes floor prop beside it at [1900, 3500]) |

Desk count: S 3, M 5, L 7; 48 and 60 mixed in every tier.

MAIN pose: System checks 43.5/0; Service session 28/0; Maintenance 35/0; Overnight monitoring 28/−5; Team deployment 43.5/0, yaw +30° toward the staging carts. LED `#66c2d1` at night, `#93d8cf` for deployment.

## 2. Layout and furniture

| item | S | M | L | notes |
|---|---|---|---|---|
| `IT equipment rack` ×(2+index): 600 W × 1000 D × 2000 H (42U), **bayed side by side**, back to the back wall | x 200…1400 (centres 500, 1100); z bz…bz+1000 | x −700…1100 | x −1600…800 | Replace the 800×900 racks. Add perforated front doors (hex mesh canvas, 60 % alpha), blanking panels, a 1U patch panel with coloured patch cords looping to a vertical manager, a PDU strip with blue LEDs, and a top-of-rack cable ladder |
| Cold aisle (keep clear, flat decal) | z bz+1000…bz+2200 | same | same | Floor tape: yellow/black 50 mm border + "COLD AISLE" stencil |
| **Overhead cable ladder** (ceiling, y h−350, 300 wide) from the rack tops to the +x wall | | | | Ceiling group (cutaway hides it) |
| storage → **Parts shelving** (wire shelving 500×1500×1800, 5 tiers, labelled bins in 3 colours, boxed SSDs and cables) | +x wall [2650, −1200] | [3550, −1933] | [4450, −2667] | wall |
| **Staging carts** (existing `diagnostic-cart-n`, pushable; laptops in slots on top) | 2: [−2350, 2000], [−2350, 2700] | 3: [0, 3000], [800, 3000], [1600, 3000] | 4: 2×2 at x 3300/4100, z 2400/3200 | Floor decal "DEPLOYMENT BAY" (flat) under the carts |
| **Laptop charging locker** (wall, 900×450×1200, 16 slots with green/amber LEDs) | – | back wall right of the racks [2300, bz+225] | back wall [2200, bz+225] | wall item, emissive slot LEDs |
| Secure **parts cage** (mesh partition panel, wall-hugging, 1800 long × 50 × 2000) | – | – | +x wall z 300…2100 behind the carts | wall |
| `activity-table` → **Deployment briefing table** (site map, device checklist) | [−1700, 4050] | [−2000, 5517] | [−1500, 6983] | |
| Boxed devices (cardboard-boxes prop, 2 stacks) | – | – (no clear slot in M: by the tech bar is the door zone, and by the briefing table is < 900) | [1900, 3500] next to asset intake | collider; L position verified (290 from the intake desk's +x edge, which is the intake's own working side) |
| Rugs | Anti-fatigue mat 1500×700 (flat, `#2d3439`) under each standing station | | | |
| Planter | Delete from the floor. Put one pothos on top of the parts shelving. | | | |

Flow arrows: flat 4 mm floor decals in blue `#467eaa` from the tech bar → asset intake/repair → imaging → staging carts → door (simple chevrons every 600 mm).

## 3. Decoration and storytelling

- Back wall (above and beside the racks): a **network topology mural** (existing screen drawing, scaled up to a 2600×900 wall graphic: core → 2 distribution → 6 access nodes, generic names "CORE / DIST-A / DIST-B / SITE 01…06"); a **rack elevation diagram** poster (42U column with coloured blocks); the clock; the room sign "FIELD SERVICES · DEPOT".
- +x wall: the **tech bar sign** "TECH BAR · DROP-OFF & HELP" (backlit, emissive `#e8f1f7` on `#467eaa`, 1400×300) above the tech bar position; a **ticket queue screen** (1000 wide: "NOW SERVING 12 · NEXT 13"); a **deployment schedule board** (columns SITE / DEVICES / STATUS with coloured chips); the wall service tools panel (existing `diagnostic-wall`, keep: pegboard with tools); a fire extinguisher (CO2, black band) by the racks.
- Window wall: low-glare **roller blinds** (50 % by day). Sill: a row of returned devices with tags (3 laptops, closed).
- Desk and room life: a label printer, cable spools on the shelving, anti-static bags (silver `#c9cfd3` flat boxes), a coffee mug on the NOC desk only, a backpack-daypack on the floor by MAIN (field tech kit), a tool-cart (prop, pushable) in L by the repair bench at [−1800, 5000].

## 4. Materials

| surface | colour | rough | pattern |
|---|---|---|---|
| Walls | `#dce3e8` (keep) | .9 | – |
| Rack wall zone (back wall behind the racks) | dark `#26323b` paint, 3000 wide, full height | .85 | Makes the racks pop and hides the shadow void |
| Wainscot | 1200 **perforated metal panel** look `#8c99a2` (canvas: 3 mm dots at 12 mm pitch) + aluminium cap `#b7c0c6` | .45 / .3 | Dot grid |
| Floor | **ESD/anti-static vinyl tile** 600×600 `#8a959c` / `#7f8a91` (alternating), 1 px conductive-grid lines `#6c767d`; cold aisle zone `#9aa5ac` | .6 | New 'tile' floor style for `institutionalFloor` |
| Racks | `#1d252b` powder, door mesh `#2d373f`, handles `#9aa7ad` | .45 | Hex mesh |
| Shelving | chrome wire `#c3c9cd` metal .7 | .3 | – |
| Bins | `#467eaa`, `#e0b45e`, `#6aa56a` | .5 | – |
| Bench tops | light grey HPL `#d8dcdc`; ESD mat `#3d6f8e` | .55 / .8 | – |
| Accent | `#467eaa` IT blue + safety yellow `#f2c230` (tape only) | | |

## 5. Lighting by daypart

Fixtures: 4000K linear lights in a grid; **rack LED field** (status dots green `#58d68d` / amber `#f5b041` / blue PDU `#5dade2`, emissive with a cool pool on the cold-aisle floor); the tech-bar sign (backlit); the imaging station's laptop glows (3 small pools); a magnifier ring at the repair bench (emissive + pool via `stationDetail`; real lamps: activity table + parts-shelving work light); a NOC screen spill (pool on the wall).

| phase / label | key | fill | sky | power | ambient | exposure | practical / wash | staging |
|---|---|---|---|---|---|---|---|---|
| morning · System checks (09:00) | `#f5f2ea` | `#dce8ef` | `#bad8e5` / `#f5e6ca` | 1.45 | .42 | 1.06 | .34 / .18 | Rack console out with the checklist; topology screen all green; carts half loaded |
| afternoon · Service session (14:00) | `#f0f7ff` | `#e1edf2` | `#94c5de` / `#e4eff1` | 1.5 | .45 | 1.04 | .42 / .18 | Tech bar busy (queue 12/13); a laptop open on the ESD mat; asset intake with a box |
| evening · Maintenance (18:00) | `#ffd6ac` | `#d0d9ea` | `#ba96a4` / `#f0c89e` | .65 | .26 | 1.09 | .76 / .28 | One rack door open with a cable tester hanging; amber LED on rack 2; tech-bar sign "CLOSED" |
| night · Overnight monitoring (22:00) | `#a9c0dd` | `#93aec9` | `#0f2034` / `#2f4864` | .18 | .12 | 1.15 | .50 / .12 | Room dark: rack LED field (full), NOC screen spill, imaging laptops on progress bars, charging-locker LEDs; one amber alert on the topology map. Window: an office tower with 30 % lit windows, a car park |
| party · Team deployment (16:00) | `#e2ebf2` | `#d5e8e7` | `#a9cdd7` / `#ede3cd` | 1.1 | .38 | 1.07 | .74 / .36 | Carts fully loaded with laptops; the briefing table has a site map and checklist; 2 backpacks by the door; the deployment board's chips all "READY" |

Window view: a service yard with 2 generic white vans (no livery), a loading dock with a roller shutter, and a business-park block behind.

## 6. Top 10 gaps vs the reference rooms

1. Single ErgoFlex. The flow of intake, repair, imaging, tech bar, rack console and NOC needs 5–7 desks.
2. Racks are oversized boxes with no aisle logic. Use 600×1000 bayed 42U racks, a 1200 cold aisle, patching and a cable ladder.
3. The service bench and carts block the door route in S. Remove the bench, park the carts in a decal-marked deployment bay.
4. No walk-up story: add the tech-bar sign, queue screen and check-in tablet.
5. The night mood should be the hero (LED field, NOC glow). Today it is uniform dimming.
6. Walls lack layering: add the dark rack wall, perforated wainscot, topology mural and schedule board.
7. The floor is the same carpet as government. Use ESD vinyl tile, tape lines and flow chevrons.
8. Desks lack technical props: ESD mat, switch, KVM, label printer, tagged laptops.
9. No storage credibility: add wire shelving with labelled bins, a charging locker and the parts cage.
10. The palette is generic grey-blue. Add rack black, IT blue and safety yellow in disciplined doses.
