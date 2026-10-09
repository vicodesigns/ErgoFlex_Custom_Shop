# Design brief: Healthcare group (Hospital workspace · Science laboratory)

Owner module: `institutional-healthcare.mjs`. Each scene has Small/Medium/Large (`apartment/house/spacious`; each step +1800 w, +2200 d, +150 h).

## 0. Shared conventions

- Units mm. x across, centred at 0. **−x = window wall** (opening centred at `bz+0.54d`, 48 % of depth, sill 800, head 2600). **+x = door wall** (door centred at `front−1600`). z runs from `bz = −d/3` (back wall) to `front` (open, camera). The camera looks from the front-left, so the back wall and +x wall are the hero surfaces. Keep the front-left low.
- `turn` 0: user faces the back wall, chair at +z 1050. 180: faces the front. 90: faces −x, chair at +x. 270: faces +x, chair at −x. Desk tops are 1219 (48) / 1524 (60) × 762.
- Desktop props: local x across, **+z toward the user**; shelf = rear monitor shelf. Tilted desks (`plan: true`) take flat props only.
- Every layout was run through an overlap and gap script that mirrors `tests/institutional-room-test.cjs`. Results: no overlaps; ≥ 900 between independent items; ≥ 800 to wall cabinets; door clear zone `x ≥ w/2−1100, z front−2200…front−1000` free. Clinical extra: **≥ 900 on the working side of each bed, 1000 at the foot**.
- Test-required names: `Hospital care bed`, `Laboratory bench`, plus `Daily planning table` (`activity-table`; relocate via `layout.activity`).
- MAIN (the live desk at `[−w/2+1250, bz+1900]`) gets a role and its own `desk`/`shelf` dressing, replacing the generic `journal + laptop + paper-holder` (`workspace-3d.mjs:548`).
- **Clinical prop rule:** no food or drink on any clinical or lab surface. Mugs appear only in the hospital staff huddle zone and the lab's write-up/office desk (MAIN in the lab's dry zone stays drink-free; show a water bottle on a shelf outside the bench zone instead).
- Light budget: 3 room lights + ≤ 2 local lamps (hospital: one is already on bed 0). Everything else is emissive plus **additive pools** (`coworking-room.mjs:111`).

| scene | Small | Medium | Large |
|---|---|---|---|
| hospital | 6200×7600, h3100; bz −2533, front 5067; MAIN [−1850, −633] | 8000×9800, h3250; −3267 / 6533; MAIN [−2750, −1367] | 9800×12000, h3400; −4000 / 8000; MAIN [−3650, −2100] |
| laboratory | 6600×8000; −2667 / 5333; MAIN [−2050, −767] | 8400×10200; −3400 / 6800; MAIN [−2950, −1500] | 10200×12400; −4133 / 8267; MAIN [−3850, −2233] |

- **Procedural station props and station lights.** Stations are added after the room build (`WorkspaceRoom.addOfficeStations`), so `kit.byId`/`kit.taskLamp` can't reach them. Library props go in each station's `desktop`/`shelf` arrays. Anything marked *procedural* here (scanners, microscope, lightbox, ESD mat, sharps bin, document camera, pools on the desktop) needs a new optional group hook, e.g. `stationDetail(spec, mount, THREE)`. Call it beside the existing `this.decorateStation?.(mount, spec)` in `addOfficeStations`, so the detail travels with the movable desk. Station "task light" = emissive panel + additive pool built in that hook; no real PointLights.

---

## A. HOSPITAL WORKSPACE (`hospital`, kind hospital)

**Lens (clinical planner + nurse informaticist):** an inpatient **ward bay** with beds headed to the back-wall **headwall** (medical gases, suction, nurse call, reading light, monitor arm). Documentation happens at the point of care: the ErgoFlex is literally a **workstation on wheels (WOW)**. Medication administration is barcode-scanned. A staff zone sits on the door side with a huddle/handover table. Patient dignity comes from cubicle curtains. There is daylight and a garden view for patients.

### A1. ErgoFlex desks

| id | role | size | S at | M at | L at | turn | pose | chair | desktop | shelf |
|---|---|---|---|---|---|---|---|---|---|---|
| MAIN | Nurse bedside documentation (WOW at bed 0) | user | [−1850, −633] | [−2750, −1367] | [−3650, −2100] | 0 | daypart | Leap | office-keyboard [−60,0,110]; magic-mouse [300,0,100] t90; procedural **barcode scanner** (grip 40×130 + head 70×50, `#2a3237`, red window) [−470,0,60]; clipboard [500,1,80] t−8 | kenney-furniture-computer-screen [0,0,0] |
| medication-station | Medication administration (eMAR + locked drawers) | 48 | [1100, 1200] | [2100, 1600] | [1000, 3300] | 0 | 40 / 0 | none | tablet-pc [−320,0,60]; procedural **unit-dose drawer module** 420×140×300 `#e9eef0` with 3 drawer fronts `#608e9d` [250,0,−60]; procedural med-cup stack (6 white Ø40 cyl) [480,0,120]; barcode scanner [−520,0,−90] | procedural **sharps bin** 260×280×150 `#f2c230`, red lid `#c8433a` [−280,0,0]; glove box `#e8eef0` [280,0,0] |
| physician-charting | Physician charting (standing, rounds) | 60 | [−1300, 2200] | [−700, 1600] | [−1700, 600] | 0 | 43.5 / 0 | none | office-keyboard [−80,0,110]; magic-mouse [330,0,100] t90; glasses [−520,0,−110]; procedural **stethoscope** (torus r60 + tube, `#2b3a42`) [520,0,60]; tablet-folder [−470,0,110] | curved-monitor [0,0,0] |
| charge-nurse | Charge nurse / unit coordination | 60 | – | [−2750, 3833] | [−3650, 3300] | 0 | 28 / 0 | Leap | office-keyboard [−80,0,110]; office-phone [560,0,−60]; headphones [−560,0,−100] (call headset); letter-tray [−470,0,80]; papers [300,0,130] | curved-monitor [0,0,0] |
| telehealth-consult | Telehealth / specialist consult | 48 | – | [−300, 4133] | [−1300, 3300] | 0 | 28 / 0 | Leap | kenney-furniture-laptop [−80,0,0] (video consult); headphones [430,0,−90]; journal [−450,0,110] | procedural webcam bar on the shelf + kenney-furniture-plant-small3 [380,0,0] |
| pharmacist-verify | Pharmacist verification | 60 | – | – | [1000, 600] | 0 | 43.5 / 0 | none | office-keyboard [−80,0,110]; magic-mouse [330,0,100] t90; calculator [−540,0,80]; papers [520,0,130] t−8; glasses [450,0,−130] | curved-monitor [0,0,0] |
| discharge-planning | Discharge planning / case management | 48 | – | – | [−1300, 6000] | 0 | 28 / 0 | Leap + visitor chair at its +x side | kenney-furniture-laptop [−150,0,0]; papers-envelopes [380,0,90] (discharge packs); office-phone [−480,0,−60] | paper-holder [0,0,0] |

Desk count: S 3, M 5, L 7; sizes mixed in every tier.

MAIN pose: Morning rounds 43.5/0 (standing WOW, yaw +35° toward bed 0); Care coordination 28/0; Evening handover 43.5/0, yaw toward the handover table (−20°); Night observation 35/0 (perched, screen dimmed); Team review 43.5/0. LEDs: `#bee8dd` at handover, very low `#d9eee4` at night (no bright LEDs near sleeping patients).

### A2. Layout and furniture

| item | S | M | L | notes |
|---|---|---|---|---|
| `Hospital care bed` (existing detailed bed, 1000×2100) **head to the back wall** | bed0 [900, −1383] | bed0 [−500, −2117]; bed1 [2300, −2117] | bed0 [−1450, −2850]; bed1 [1350, −2850]; bed2 **head to the +x wall** [3850, 600] (rotate −90°) | Bed z = bz+1150 (headboard 50 off the wall). Working-side clearance to MAIN = 988–1488. |
| Bay set per bed (one asset per bed so it moves with it): patient monitor on a stand + recliner (800×900) + IV pole + overbed table | bed.x+900, bed.z−250 (700×1500 box) | same | bed2: along +z side | Move the existing `patient-monitor-n` into this box; the recliner uses `armchair-poppi` (scaled ~0.9) or the procedural chair. |
| **Headwall** per bed (wall, back wall; bed2 on the +x wall): 1600×220×60 rail at y 1500 | at bed.x | | | Existing `care-services` → one per bed. Add outlets (O2 `#2e8b57`, air `#e8e8e0`, vacuum `#f2f2f2` with a yellow ring), a suction canister (Ø110×200 clear + white lid), nurse-call handset, a reading light (bed0 keeps the real lamp), monitor arm and 4 sockets |
| **Cubicle curtains** on a ceiling track (track at y h−100 around 3 sides of each bay; curtain bottom at y 350, so they classify as wall/overhead, not floor colliders) | stacked open to the headwall by day; drawn on 2 sides at night | | | Replace the floor-standing `privacy-screen-n` with these (floor screens ate the bed clearances). Fabric: canvas print of soft leaves on `#cfe1db` with a 300 mm mesh top band. |
| Supply cabinet (storage) | +x wall [2890, 1300] rotated 90° | +x wall [3790, 1500] | back wall right [4225, −3790] | Glass upper doors showing labelled bins; S/M move it off the back wall (beds need the headwall) |
| Clinical cart (existing, pushable) | [700, 3500] | [1400, 3400] | [−3000, 5800] | Keep pushable; parked clear of desk envelopes |
| `activity-table` → **Handover / huddle table** (huddle board on the wall behind it in M/L) | [−1300, 4417] | [2300, 6000] | [2000, 7300] | Mugs allowed here only |
| Hand-hygiene station (existing wall unit) | 1 per bed entry + 1 at the door | | | Alcohol-rub dispensers at y 1100 |
| Linen trolley (pushable, 600×450×1000, fabric bag `#a8c0d0`) | – | – | [3400, 3600] | L only (1490 from the med station, 1575 from bay 2) |
| Rug | none (clinical) | | | |
| Planter | delete from the floor. Put a **window-sill planter** of 3 herbs/succulents behind bed 0 (biophilic, non-floor) | | | |

### A3. Decoration and storytelling

- **Patient care boards** above each bed's headwall (y 2050, 900×600 whiteboard): "TODAY'S CARE TEAM", 4 grey placeholder lines, a pain-scale strip (6 coloured faces), "GOALS" with 2 lines. Nothing real.
- Back wall between beds: framed **calming nature prints** (existing gallery → one per bay, landscape mode).
- +x wall: **unit huddle board** behind the handover table (columns: SAFETY / FLOW / STAFFING / WINS; magnet chips); the clock; "WARD 4B" style generic room plate → use "CARE BAY"; glove-box dispenser trio (S/M/L sizes, `#7ea4c9` `#9fc49b` `#c8a6d0`); sharps bin on a bracket; PPE caddy on the door.
- Window wall: patient-facing **wood-look headwall** in the bed bays; **blackout + sheer** double roller blinds; a sill planter.
- Bed details (some exist): folded blanket at the foot, a pillow, a call-bell cord, a urinal bottle hanger (just a plastic shape), a personal item on the bedside cabinet (a book and a small photo frame), a get-well card on the cabinet.
- Staff zone: a stethoscope hung on the physician desk shelf, colour-coded lanyards, a portable vitals monitor on the clinical cart, a laminated "handover SBAR" card (4 bands of grey lines).

### A4. Materials

| surface | colour | rough | pattern |
|---|---|---|---|
| Walls | `#e8efeb` (keep) | .9 | – |
| Headwall panels (bays) | wood-look HPL `#c9a77c` with 3 mm reveals, 1200×2200 | .55 | Oak generator, lighter |
| Wainscot / bed guard | **bed-guard rail** at 700–900: `#9fbdc4` HPL 200 high + stainless crash rail 40 | .45 / .3 | – |
| Floor | seamless sheet vinyl `#cdd9d3` with a soft terrazzo chip (existing 'clinical') **+ bay inlays** in wood-look vinyl `#b89a74` 2600×2600 under each bed | .43 / .5 | Coved 100 mm skirting `#97aca8` |
| Ceiling | 600×600 tile `#f2f3ef` (cutaway) | .9 | – |
| Bed / clinical metal | `#d9dfe0` powder, rails `#9aa7ad` | .4 | – |
| Bed linen | sheet `#f4f6f2`, blanket `#a9c5d0`, pillow `#ffffff` | .95 | – |
| Recliner | vinyl `#4f7d8a` | .5 | – |
| Accent | `#608e9d` + soft coral `#e3a28c` (only on art and blanket stripe) | | |

### A5. Lighting by daypart

Fixtures: indirect linear "wall-wash" over the headwalls (emissive strip + pools on the wall); bed-0 reading light (real lamp); **night-lights** at floor level (2 amber recessed rectangles `#ffb86b` per bed, emissive + floor pools); a 4000K `#f1f3ee` task light at the medication station (emissive + pool via `stationDetail`, so drugs are read under neutral light; the 2 real lamps stay on the activity table and bed 0); monitor screen glow.

| phase / label | key | fill | sky | power | ambient | exposure | practical / wash | curtains & staging |
|---|---|---|---|---|---|---|---|---|
| morning · Morning rounds | `#fff3e2` | `#e2eef0` | `#bad8e5` / `#f5e6ca` | 1.55 | .45 | 1.05 | .30 / .22 | Curtains open; MAIN standing at bed 0; physician desk with tablet-folder out; a water jug and cup on the overbed table |
| afternoon · Care coordination | `#f2f7fb` | `#e1edf2` | `#94c5de` / `#e4eff1` | 1.55 | .46 | 1.04 | .38 / .20 | Visitor in the recliner implied (a coat over its arm); charge nurse on the phone |
| evening · Evening handover | `#ffd9b0` | `#d6e0ec` | `#ba96a4` / `#f0c89e` | .75 | .30 | 1.08 | .66 / .30 | Handover table with 2 mugs and the SBAR card; headwall wash warm `#ffe6c8`; sheers drawn |
| night · Night observation | `#9fb4cf` | `#8ea6c0` | `#0f2238` / `#2c4560` | .14 | .10 | 1.15 | .30 / .08 | **Ward dark**: only night-lights (amber pools), the med-station task light at 50 %, monitor glows (green traces), MAIN screen at 40 %; curtains drawn around beds; blackout blinds down. Window: the garden with 3 bollard lights `#f4d7a1` |
| party · Team review | `#e8eef2` | `#d5e8e7` | `#a9cdd7` / `#ede3cd` | 1.1 | .38 | 1.07 | .64 / .30 | Huddle board updated; all staff desks occupied (chairs angled to the table) |

Window view: a **healing garden courtyard** (curving paths, benches, flowering shrubs `#c99ab5` / `#e8c46e`, a low wall); a distant clinic wing; no ambulance or sirens.

### A6. Top 10 gaps

1. One ErgoFlex. The WOW story (nurse, physician, med station, charge, telehealth) is the core of the scene.
2. Beds float mid-room with no headwall. Put their heads to the back-wall headwall with gases, nurse call and lights.
3. Floor privacy screens block bed clearances and look like room dividers. Use ceiling-track cubicle curtains (drawn at night).
4. Medication safety isn't shown. Add the scanner, sharps bin, drawers, glove dispensers and hand rub.
5. Night observation should be the hero mood: dark ward, amber night-lights, monitor glows. Today it is just dim.
6. No patient-centred detail: add care boards, a personal photo, card, recliner and garden view.
7. Floor is one sheet colour. Add wood-look bay inlays, coved skirting and the bed-guard rail.
8. No staff zone story: add the huddle board, handover table and SBAR card.
9. The palette is all teal-mint. Add warm wood headwalls and a coral art accent for healing-environment warmth.
10. Clinical cart and supplies are generic boxes. Use labelled bins, a glass cabinet and a vitals monitor on the cart.

---

## B. SCIENCE LABORATORY (`laboratory`, kind lab)

**Lens (lab manager + lab planner):** a teaching and research **wet lab with a separated dry (write-up) zone**. The dry zone runs along the window: ErgoFlex analysis, instrument and microscopy desks. Island benches with reagent shelving and a service spine fill the middle. The fume hood sits on the back wall. Wash, eyewash and safety shower are by the exit. A PPE station at entry. Signage is generic hazard pictograms (no regulatory logos), and there are **no drinks on any lab surface**.

### B1. ErgoFlex desks

| id | role | size | S at | M at | L at | turn | pose | chair | desktop | shelf |
|---|---|---|---|---|---|---|---|---|---|---|
| MAIN | Analysis and write-up (dry zone) | user | [−2050, −767] | [−2950, −1500] | [−3850, −2233] | 0 | daypart | Leap | office-keyboard [−60,0,110]; magic-mouse [300,0,100] t90; journal [−500,0,80] t8 (lab notebook); calculator [520,0,90]; procedural **safety glasses** (2 lenses on a frame, `#d9e8ee` / `#3a4a52`) [480,0,−130] | curved-monitor [0,0,0] |
| instrument-control | Instrument control (spectrophotometer + PC) | 60 | [−2000, 1933] | [−2950, 1200] | [−3850, 467] | 0 | 28 / 0 | Leap | procedural **benchtop spectrophotometer** (480×230×380 `#e8ece9`, sloped lid, 120×80 screen emissive `#7fd1c0`, cuvette slot) [−380,0,−90]; kenney-furniture-computer-keyboard [250,0,120]; kenney-furniture-computer-mouse [520,0,110]; procedural cuvette rack (6 tiny clear boxes) [−80,0,120] | kenney-furniture-computer-screen [0,0,0] |
| microscopy | Microscopy and imaging | 48 | [400, 3900] | [−2950, 3900] | [−3850, 3167] | 0 | 28 / 0 | Leap | procedural **compound microscope** (base 200×50×280, C-arm, stage 140×12×140, 3-objective turret, binocular head at 45°, `#eef0ee` / `#2f3a40`) [−200,0,−40]; procedural slide box (110×30×80) [180,0,110]; tablet-pc [430,0,60] (camera feed) | – |
| sample-prep | Sample preparation (standing) | 60 | – | [3100, −1500] | [3400, −2233] | 0 | 38 / 0 | none | procedural **pipette stand** (5 pipettes) [−520,0,−80]; **tube racks** ×2 (12 tubes with colour caps `#d9534f` `#4f8fc0` `#f0c24b`) [−150,0,40], [150,0,40]; **vortex mixer** (Ø120) [420,0,60]; **mini centrifuge** (Ø220 drum) [520,0,−120] | glove box [−300,0,0]; procedural waste beaker [300,0,0] |
| teaching-demo | Teaching demonstration (faces the class) | 48 | – | [3200, 1200] | [4000, 1000] | 90 | 43.5 / 0 | none | kenney-furniture-laptop [−200,0,0]; procedural **molecular model** (6 balls `#d9534f`/`#e8e8e8`/`#2f3a40` + sticks) [300,0,60]; procedural doc camera [−480,0,−60] | – |
| data-review | Data review (standing, printouts) | 48 | – | – | [−3850, 6567] | 0 | 43.5 / 15, `plan: true` | none | flat: papers [−150,1,40] (chromatogram/plot canvas), tablet-folder [330,1,60], pen [80,1,150] t70 | paper-holder [0,0,0] |
| pi-review | PI / research review | 60 | – | – | [3100, 6300] | 0 | 28 / 0 | Leap | office-keyboard [−80,0,110]; magic-mouse [330,0,100] t90; journal [−530,0,60]; glasses [470,0,−130]; kenney-furniture-plant-small2 [−600,0,−120] | curved-monitor [0,0,0] |

Desk count: S 3, M 5, L 7.

MAIN pose: Lab preparation 43.5/0; Practical session 43.5/0 yaw +30° toward the benches; Analysis 28/0; Instrument watch 35/0; Research review 28/10.

### B2. Layout and furniture

| item | S | M | L | notes |
|---|---|---|---|---|
| `Laboratory bench` island 1800×850×900 (epoxy top, white base cabinets with drawers, **centre reagent shelf** 2 tiers at +300/+600 with a service spine: 2 gas taps, 4 sockets), 2 lab stools per long side | 1: [900, 633] | 2: [500, −100], [500, 3200] | 3: [500, −1033], [500, 2117], [500, 5267] | Box incl. stool zones 1800×2250. Existing microscope rods move to the microscopy ErgoFlex; keep 1 microscope per bench as a teaching scope. |
| Fume hood *(existing)* | back wall [300, bz+325] | [600, bz+325] | [600, bz+325] | Add an airflow monitor (green LED panel), sash label, 3 bottles inside, a hood light (emissive) |
| storage → **Reagent cabinet** (ventilated, 1250×420×1900, glass upper) | [2540, −2237] | [3440, −2970] | [4340, −3703] | Brown and amber bottles visible |
| **Flammables cabinet** (yellow `#e1b12c`, 1100×500×1650, red pictogram diamond) | back wall left, behind MAIN: [−2200, bz+250] | [−3100, bz+250] | [−4000, bz+250] | Wall item, 1019 behind the MAIN envelope |
| Wash station + **eyewash** + **safety shower** (pull handle, green `#2e8b57` sign) | +x wall [3000, 2033] | +x wall [3900, 3300] | +x wall [4800, 4767] | Existing `wash-station` + a shower head on a 2100 drop pipe |
| **PPE station** (wall): 4 lab coats on hooks, goggle cabinet, glove dispensers | +x wall right after the door zone, z front−900 | | | wall |
| Lab fridge (600×650×1800, "NO FOOD" pictogram) | – | back wall [2200, bz+325], between hood and reagent cabinet | same [2200, bz+325] | 869 from the sample-prep envelope; the +x wall is taken by sample-prep and demo |
| Sample cart (existing, pushable) | [2900, 900] (+x wall bay) | [2400, 4700] | [−2000, 7600] | Pushable; parked in wall bays |
| `activity-table` → **Lab prep / results table** | [2600, 4733] | [1300, 6100] | [0, 7650] | |
| Floor markings: yellow hazard tape 50 mm around the hood zone (flat decal) | | | | |

### B3. Decoration and storytelling

- Back wall: the board on the +x wall (existing `boardOnSideWall`). The back wall gets a **periodic table** poster (18×7 coloured cells, no text needed), a **hazard pictogram row** (5 diamonds: flame, exclamation, corrosion, health, environment as simple shapes), the hood, the clock and the room sign "LAB 2.04 · TEACHING & RESEARCH".
- +x wall: the experiment board "QUESTION → EXPERIMENT → EVIDENCE" (existing curve) plus a **sample log sheet** clipboard; a **safety information board** (evacuation map, spill procedure, first-aid icon); the eyewash and shower sign; PPE.
- Window wall: the dry-zone desks; a **plant-growth experiment** on the sill (6 pots under a grow light, labelled A–F).
- Bench life: reagent bottles (amber `#8a5a2b`, clear `#d8e6e6`, blue caps `#3b6fa5`), wash bottles, Erlenmeyer flasks with coloured liquid (`#79c2b3`, `#e3c46a`, `#c97a8f` at 40 % opacity), a Bunsen burner, a timer, a pipette tip box, a sharps/glass bin under each bench end.

### B4. Materials

| surface | colour | rough | pattern |
|---|---|---|---|
| Walls | `#dde8e4` (keep) | .9 | – |
| Splashback / wall bench zone | white glazed tile 300×150 `#f2f4f1`, grout `#c9d3cf` | .3 | Canvas tile grid |
| Floor | seamless **chemical-resistant sheet vinyl** `#c4d3ce` with fine fleck; coved skirting `#7c9a97`; dry zone in a warmer `#d6d2c4` | .4 | Existing clinical generator re-toned; dry-zone tint |
| Bench tops | **black epoxy resin** `#22282b` | .3 | 1 % fleck |
| Bench bases | white laminate `#eef1ee`, handles `#7f8a8f`, drawer reveals | .5 | – |
| Hood | white `#eff2ef`, sash glass `#94c1c9` at .22 | .3 | – |
| Flammables cabinet | `#e1b12c` | .45 | – |
| Accent | `#408d89` teal | | |

### B5. Lighting by daypart

Fixtures: 5000K high-CRI linear lights over the benches (emissive `#eef4fb` + pools); under-shelf task strips on each reagent shelf (emissive); the hood's interior light (emissive); instrument screen glows; the grow light on the sill (magenta `#e6b8ff` at night).

| phase / label | key | fill | sky | power | ambient | exposure | practical / wash | staging |
|---|---|---|---|---|---|---|---|---|
| Lab preparation | `#f3f6f8` | `#dce9ee` | `#bad8e5` / `#f5e6ca` | 1.5 | .44 | 1.05 | .42 / .20 | Reagents set out on the benches; prep table with checklists; hood sash closed |
| Practical session | `#f0f7ff` | `#e1edf2` | `#94c5de` / `#e4eff1` | 1.55 | .46 | 1.04 | .50 / .20 | Flasks with liquid, burners, all stools out; hood sash half-open, hood light on |
| Analysis | `#ffe2c2` | `#d7deee` | `#ba96a4` / `#f0c89e` | .8 | .30 | 1.08 | .88 / .35 | Spectro screen with a curve; printouts at data review; benches cleared |
| Instrument watch | `#b9cde4` | `#a4bed6` | `#172c47` / `#3c5265` | .22 | .18 | 1.13 | .62 / .18 | Room dim; instrument screens and the hood monitor glow; grow light magenta; one tube rack in the centrifuge |
| Research review | `#e8eef2` | `#d5e8e7` | `#a9cdd7` / `#ede3cd` | 1.1 | .38 | 1.07 | .84 / .38 | Posters on the review table; PI desk active; molecular model on the demo desk |

Window view: a research park (a glass lab block, greenhouse, solar panels on a roof, landscaped swales). At night: a lit greenhouse glow `#f2d9ff` and lab windows.

### B6. Top 10 gaps

1. One ErgoFlex. Add the dry-zone analysis, instrument, microscopy, prep, demo and review desks.
2. No wet/dry separation: move documentation to the window zone and shift the floor tint.
3. Benches are flat black tables. Add reagent shelving, a service spine, base cabinets, glassware and coloured liquids.
4. Safety story missing: add the eyewash, shower, PPE station, flammables cabinet, pictograms and hazard tape.
5. The hood is impressive but static. Add the sash, light and airflow monitor per daypart.
6. Walls are almost empty. Add the periodic table, safety board and splashback tile.
7. Lighting is generic. Add 5000K bench strips, under-shelf task lights and instrument glows; Instrument watch should read as a night lab.
8. Microscopes are abstract rods. Use a proper procedural microscope on the microscopy desk.
9. The floor is one mint field. Add the dry-zone tint, coved skirting and hazard tape.
10. No experiment narrative. Add the sill growth experiment with labels and the sample log.
