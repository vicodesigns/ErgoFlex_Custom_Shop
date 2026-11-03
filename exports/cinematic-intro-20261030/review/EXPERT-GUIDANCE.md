# ErgoFlex intro: expert DP / gaffer / production-design guidance

Reviewed: `final/ErgoFlex-Intro-1080p-hq.mp4` (173.5 s, 1080p30), against `TREATMENT.md`, `edl.json`, `grade.json`, `tools/experience/finish-intro.py`, `shots/NN.json`, `review/NOTES.md`, REVIEW-A/B.
Evidence is in `review/expert/`:
- `sheet-NN-<id>.jpg`: 1 s contact sheets per chapter, stamped with film time and chapter time.
- `sheet-dissolves.jpg`: all 11 dissolve midpoints.
- `still-TTTT.T.jpg`: full-resolution frames, named by film time.
- `crop-*.jpg`: detail crops.
- `wheel-spin-1.8-3.4s.jpg`: wheel frames from the opening macro.

I left the in-progress items alone: monitor content, the ch 9 game montage, the ch 10 LED stripes and the ch 2 clock/time-of-day. Where one of them touches a point below, I say so. I did not re-raise clipping or speed steps; I saw none left.

## Verdict

The bones are good. The camera is disciplined and continuous. The titles are well set and consistently placed. The void chapters (1, 8, 12) have a real product-film attitude, and the score lands every dissolve on a bar line. What stops it feeling Apple/Herman Miller-premium is not the camera. It is **light and story**:
- The product is under-lit exactly where it should shine. **Ch 12, the hero and end card (and the poster frame), is the dimmest chapter in the film:** 99th-percentile luma is 102/255, against 215 in ch 1.
- The signature features don't *read*: the ch 2 lift is pedestal-matched, so the desk never moves in frame; ch 3 shows a blank white board seen from behind; ch 9 is a whole-room colour wash rather than light coming *from* the desk.
- Three daylight rooms look like rendered wallpaper because their windows sit at interior exposure.
- Twelve chapters share one rhythm: medium 3/4 at FOV ~40, the title at 1.6 s, a 1.5 s dissolve, a push-in. That makes the middle (63–96 s) feel metronomic.

Most of the fixes below are camera-plan, grade or edit changes. Only three need real 3D lighting or material work.

### One blocker before ranking (legal, not craft)

**Ch 10 screen content (131.5–145.5 s; see `still-0137.0.jpg`).** The clip on the curved monitor looks like a recognisable commercial music video (white suit and fedora, alley set). It is in a film that plays on the company website. Whatever the screens team lands, the ch 10 clip must be cleared or original footage. I'm flagging it here because "live content in progress" could easily ship this placeholder.

---

## Top 10, ranked by premium-feel gained per hour

### 1. Finish the hero: end card layout, ch 12 exposure and a 3/4 final pose
- **Where:** ch 12, 159.5–173.5 s. End card from 167.9 s. `poster.jpg` is taken from this.
- **Why:** This is the last image before onboarding and the website poster, so it's what people remember. Right now:
  - The desk is dead frontal: final azimuth ~15°, so the side wing and the rim LEDs flatten into a silhouette.
  - The desk front is nearly black. Chapter p99 luma is 102, against 215 in ch 1.
  - The wordmark is 31% of frame width and sits on the floor-grid horizon, right under the casters (`still-0170.5.jpg`).

  The film ends quieter and less sharp than it opens.
- **Exact recommendation:**
  - *Post (finish-intro.py), S:*
    - Wordmark `lw = int(W * .31)` → `int(W * .22)`.
    - Overlay `y=H*0.65-h/2` → `y=H*0.73-h/2`.
    - `CTA_Y = 846` → `904`. Also update the `placement.note` coordinates in titles.json.
    - This opens ~80 px of clear void between the casters and the mark, and makes the mark feel confident rather than shouted.
  - *Post (grade.json), S:*
    - `"hero": {"gamma": 1.15}` → `{"gamma": 1.0, "temp": 0.03, "curves": "0/0 0.08/0.07 0.3/0.40 0.6/0.72 1/1"}`.
    - The curve keeps the void black and lifts the desk's 0.2–0.5 band by about half a stop. Gamma lifts the void too, which is why it reads milky grey now.
  - *Re-render (shots/12.json cameraPlan), M.* Keep the move, but start wider in azimuth so it *ends* on a 3/4 (~32°) instead of frontal. Keep the existing targets and FOV 26:

    | at | position |
    |---:|---|
    | 0 | `[4.5, 2.05, 8.3]` (~60°) |
    | 3.5 | `[6.2, 1.92, 7.2]` |
    | 6.8 | `[7.6, 1.4, 5.9]` (~38°) |
    | 10.6 | `[9.9, 0.60, 6.6]` |
    | 14 | `[10.6, 0.42, 6.9]` (~33°, R ≈ 12.6) |

    Check monitor headroom and the title-safe area with `--stills 16`.
  - Also fade the floor grid and pulse ring to zero by 8.5 s (see #8), so the end card sits on a clean void.
- **Effort:** S (post) + M (one 14 s re-render). Biggest gain in the list per hour.

### 2. Make the ch 2 lift actually visible
- **Where:** ch 2, 32.5–48.5 s. Lifts at 1.6–6.4 and 7.4–10.6 chapter time. See `sheet-02-rise.jpg`, frames 33.5–43.5.
- **Why:** The camera pedestals at exactly the lift's rate (+0.594 u, then +0.345 u), so the desk is locked in frame and only the wall drifts down. On a phone, that reads as a slow tilt-down on a static desk. Height is the core product promise, and it's the first room chapter.
- **Exact recommendation (cameraPlan, shots/02.json).** Let the camera rise at about 55% of the desk, so the desktop climbs ~10–12% of frame height against the fixed chair-back on screen right:

  | at | position y | target y | fov |
  |---:|---|---|---|
  | 6.4 | 2.114 → **1.85** | 1.967 → **1.80** | 33 → **36** (monitor headroom) |
  | 7.4 | 2.134 → **1.87** | 1.965 → **1.82** | 36 |
  | 10.6 | 2.479 → **2.06** | 2.209 → **2.00** | 36 |

  - The later crane-down to the low 3/4 becomes shorter, and the camera stays well below the wall tops, which also retires the open-ceiling risk noted in NOTES.md.
  - Change the low 3/4 end so the frame shows **floor to monitor top**. Right now the base is cropped (`still-0044.8.jpg`), so the 52.5″ height has no scale reference. Pull back to FOV 46 at 13.8–16 s, or drop the camera to y 1.35 with target y 1.75.
  - Ch 7's lift already rises at ~54% (+0.32 camera against +0.59 desk) and reads. Leave it.
- **Effort:** S–M. cameraPlan only, plus one 16 s re-render.

### 3. A global grade pass: bloom, colour-temperature continuity and the ch 3 curve
- **Where:** whole film. Measured per chapter from 2 fps frames:

  | ch | mean luma | p99 | sat | R/B |
  |---|---:|---:|---:|---:|
  | 1 awaken | 19 | 215 | .75 | .62 |
  | 3 create | 125 | 226 | **.27** | 1.02 |
  | 9 music | 34 | **112** | .76 | .85 |
  | 10 media | 56 | 180 | .54 | **1.50** |
  | 11 storage | 58 | 182 | .59 | **.53** |
  | 12 hero | 17 | **102** | .64 | **.48** |

- **Why:**
  - The shared bloom (threshold 0.62, opacity 0.16, sigma 18) is applied to *every* chapter after the dissolves. In the bright daylight rooms (3, 6, 2) it lays a milky veil over white walls and desktops.
  - The ch 3 roll-off curve caps white at 0.88. That's why the studio reads grey and flat at saturation 0.27.
  - The film swings from tungsten orange (ch 10, R/B 1.50) to icy cyan (ch 11 0.53, ch 12 0.48) in 30 s.
  - The shared shadow split-tone (`bs=+0.016`) pushes all three voids teal, where a premium void wants near-neutral cool.
- **Exact recommendation:**
  - *finish-intro.py, shared look:*
    - Bloom threshold `curves=master='0/0 0.62/0 1/0.85'` → `'0/0 0.72/0 1/0.80'`, `all_opacity=0.16` → `0.11`, sigma 18 → 14.
    - Add optional per-chapter extra glow inside the `[c{i}]` chain (split → curves `0/0 0.6/0 1/0.9` → gblur 16 → screen at `g['bloom']`). Set `bloom: 0.10` on awaken, awareness, music, media and hero only, so LEDs and screens glow and daylight walls don't.
    - Split-tone `rs=-0.012:gs=0.004:bs=0.016` → `rs=-0.008:gs=0:bs=0.008`. Keep the warm highlights.
  - *grade.json (temp: + warm / − cool):*
    ```json
    {
     "awaken":   {"gamma": 1.08},
     "rise":     {"contrast": 1.04},
     "create":   {"contrast": 1.05, "saturation": 1.10, "curves": "0/0 0.25/0.22 0.6/0.6 0.88/0.84 1/0.93"},
     "coast":    {"temp": 0.03},
     "oilers":   {"contrast": 1.03},
     "wellness": {"temp": 0.04},
     "awareness":{"gamma": 1.05},
     "music":    {"saturation": 1.0, "contrast": 1.06},
     "media":    {"temp": -0.02, "gamma": 0.94, "contrast": 1.05},
     "storage":  {"temp": 0.05},
     "hero":     {"gamma": 1.0, "temp": 0.03, "curves": "0/0 0.08/0.07 0.3/0.40 0.6/0.72 1/1"}
    }
    ```
    - Set music saturation to 1.0 only once #6 is done. If #6 slips, use 0.80 with contrast 1.08.
    - The real fix for the ch 3 desktop is in #7 (albedo). This curve keeps the white point at 0.93 instead of 0.88, so the room regains contrast.
  - Check on a calibrated display. All of these are deliberately modest (≤ ±0.05 temp).
- **Effort:** S, post only (master + deliverables re-encode, ~1 h machine time).

### 4. Vary the transitions: short dissolves between rooms, long ones only into and out of the void
- **Where:** all 11 transitions. See `sheet-dissolves.jpg`.
- **Why:** Eleven identical 1.5 s cross-dissolves give a metronomic, slideshow cadence. Between two busy, bright interiors, 1.5 s at 50/50 is a muddy double exposure: 4→5 (76.75 s), 5→6 (86.25 s) and 9→10 (132.25 s) are the worst. The two lovely ones, where the desk lands on the desk (8→9 at 119.75 s, 11→12 at 160.25 s), get lost because every other transition is the same.
- **Exact recommendation (finish-intro.py + edl.json, post only).** Give each transition its own duration *centred on the same dissolve centre*, so the score's bar-line sync is untouched:

  | transition | duration (s) | note |
  |---|---:|---|
  | 1→2 | 1.5 | void → room |
  | 2→3 | 0.8 | |
  | 3→4 | 0.8 | |
  | 4→5 | 0.6 | |
  | 5→6 | 0.6 | |
  | 6→7 | 0.8 | |
  | 7→8 | 1.5 | room → void |
  | 8→9 | 1.5 | match |
  | 9→10 | 1.0 | |
  | 10→11 | 0.8 | |
  | 11→12 | 1.5 | match |

  - Implementation: for transition *i* with duration `d`, trim `(1.5-d)/2` off chapter *i*'s tail and chapter *i+1*'s head (well inside the 0.75 s handles), then `xfade duration=d`. Every centre, and so the total of 173.5 s, stays put.
  - Optional: an S-curve on the dissolve (xfade `transition=fade` with eased opacity, or `fadeblack` at 0.25 depth for 7→8) so the midpoint isn't a flat 50/50.
- **Effort:** S–M, post only.

### 5. Fix the opening image: wheel rollers and title A timing
- **Where:** ch 1, 0–7 s. See `still-0001.5.jpg`, `crop-0001.5-wheel.jpg`, `wheel-spin-1.8-3.4s.jpg`.
- **Why:** The very first image of the brand is a macro on the mecanum wheel, and it's the least convincing material in the film. The rollers are flat flesh-pink matte with no specular or sub-surface. The hub reads as flat cut-outs, and there's no contact shadow under the wheels. Title A also arrives at 1.6 s over that macro, before the viewer has seen what the product is. The treatment intended "pull out to reveal the full silhouette for *Level up your every day*."
- **Exact recommendation:**
  - *Material (app, wheel roller):*
    - Dark charcoal polyurethane, roughly `color #2a2a2e`, `roughness 0.45`, `clearcoat 0.3` (or `metalness 0`, `roughness 0.4`) so the rim light draws a highlight line along each roller.
    - Hub: anodised aluminium `roughness 0.3`, `metalness 1`.
    - Add a contact shadow or AO decal under each wheel in the product void.
  - *Titles (post, titles-src.json):* awaken title A `rel_in 1.6` → `3.6`, `rel_out 7.6` → `9.2`. 3.59 s is the bar line where the score's "wake" section begins (CUE-SHEET), so the title still lands on music. The silhouette is forming by then, and the 1.5 s celesta bloom becomes the "awakening" hit with no type over it.
  - The ch 1 lower-left is dark floor from 3.6 to 9.2 s (`sheet-01-awaken.jpg`), so title-safe holds.
- **Effort:** S (titles, post) + S–M (material) + ch 1 re-render (34 s, the longest render).

### 6. Ch 9: make the light come *from the desk*, and put it on the beat
- **Where:** ch 9, 119–133 s. See `still-0123.0.jpg`, `still-0129.5.jpg`, `sheet-09-music.jpg`.
- **Why:**
  - The whole room (walls, plant, rug, chair) turns one flat hue at a time (green, then teal, then blue, then magenta). That reads as a colour filter on the camera, not as LEDs.
  - Worse, the desk's own rim LEDs stay **red** while the room is green. The source and the spill disagree, which kills the "reactive light" claim.
  - The cycle is a slow, continuous hue rotation (`ledPeriod: 12`, `spectrum` mode). Nothing moves with the music, although the score has its densest four-on-the-floor section here (115.2 BPM local).
  - Chapter p99 is only 112, so there are no bright sources and no specular.
- **Exact recommendation:**
  - *Lighting (app: room-led-spill.mjs and the gaming room):*
    - Keep a neutral night base: a cool moonlight/ambient around 7000 K at about 15% of the current level, plus the monitor as a soft key.
    - Make the LED spill local: shrink `efRoomRange` so the falloff dies within ~1–1.5 m of the strips, and raise `efRoomGain` near the source, so you get saturated pools on the floor and wall behind the desk with darkness between.
    - The desk rim and under-glow strips must take the same hue as the spill, and they should be the brightest thing in frame (emissive, plus bloom from #3).
  - *Behaviour (render-cut.cjs music hook, or a new `fx-` effect):*
    - Step the hue once per bar (4 beats = 2.083 s at 115.2 BPM), starting on the chapter's first downbeat at 119.75 s.
    - Pulse gain on each kick: 0.6 → 1.0 with a ~0.18 s exponential decay.
    - `score-analysis.json` already has the section tempo. This is the single change that makes "Light that moves with your music" true on screen.
  - Camera is fine. Once the wash is gone, consider the end key at y 1.25 to catch LED reflections on the desktop.
- **Effort:** M–L (app lighting + effect) + ch 9 re-render. Grade: `music.saturation` back to 1.0.

### 7. Ch 3: give the artist something to make, and frame the 65° payoff from the front
- **Where:** ch 3, 47–65 s. See `still-0050.0.jpg`, `still-0053.5.jpg`, `still-0060.5.jpg`.
- **Why:**
  - "Draft at 25°. Paint at 65°." plays over a **blank, pure-white desktop**. At the payoff, the camera is behind and below the board, so we see its white underside and end panel.
  - The board fills the right half of frame, blown to ~230/255. The 65° easel never reads as an easel, and nothing tells us this person draws or paints.
  - The black keyboard tray is the strongest shape in the top shot.
- **Exact recommendation:**
  - *Dressing (artist room module):*
    - At 25°: a taped A2 sketch sheet (warm off-white, a light pencil drawing), a pencil, a kneaded eraser and a steel rule.
    - At 65°: a canvas or watercolour block on a ledge (the board needs a lip prop), with brushes in a jar on the side shelf. These must be surface-locked props that ride the tilt and are *not* stowed at the 50° easel transition (NOTES.md flags the stow pop).
    - Remove or stow the keyboard tray for this chapter.
  - *Material:* desktop white `#FFFFFF` → warm white around `#E9E5DC` (albedo ~0.80), so the window key models the surface instead of clipping.
  - *Camera (shots/03.json):*
    - Keep the 0–7.8 s top shot and crane.
    - Replace the 14 s and 18 s keys with a front 3/4 from the user (+x) side, looking across the painted face toward the window, so the window backlights the board edge: position ≈ `[1.6, 1.6, -1.4]`, target ≈ `[-1.0, 1.65, 0.4]`, FOV 40, ending on a slow push to FOV 36.
    - Verify clearance from the cabinet with `--stills 16`. If 1.6 x is blocked, use the side profile at 10.6 s but lower to y 1.35 and aim up at the painted face.
  - *Grade:* the curve in #3.
- **Effort:** M (props + material + cameraPlan) + 18 s re-render.

### 8. A real product-void lighting rig for ch 1, 8 and 12
- **Where:** 0–34, 108.5–120.5 and 159.5–173.5 s. See `still-0015.0.jpg`, `still-0019.5.jpg`, `still-0027.5.jpg`, `still-0117.0.jpg`.
- **Why:**
  - The desk is lit almost only from above. The dark side panels merge into the void and read only through their red edge piping (the left upright disappears at 19.5 s).
  - The floor is a full-strength blue "Tron" grid with a hard horizon line (`still-0027.5.jpg`, y ≈ 865). It reads as tech demo, not studio.
  - There's no light pool or contact shadow, so the desk floats.
  - Ch 8's pylons are flat matte-blue primitives, and at FOV 31 top-down they splay outward (`still-0117.0.jpg`).
- **Exact recommendation (stage product setup, app):**
  - *Key:* a large soft area light (2 × 1 m equivalent), 45° camera-left and 35° up, ~5600 K. It models the desktop and the face of the side panels.
  - *Two kickers/rims:* behind the desk at ±135°, narrow, ~7000 K, 1.5× key on the edges, so the black panels get a clean edge line separate from the red LED piping.
  - *Floor:* a soft elliptical light pool under the desk (radius ~1.5 m, about 1 stop over the surround) and a contact shadow.
  - *Grid:* opacity down to ~35%, radially faded to zero by 4–5 m from the desk so there's no horizon line; fade it out entirely by 8.5 s in ch 12 (see #1).
  - *Floor material:* a slight gloss (roughness ~0.35) so the desk throws a soft reflection. This is the single most "Apple" cue.
  - *Ch 8 pylons:* frosted acrylic with an emissive top ring (or thin light columns with fresnel). Narrow the overhead to FOV 24 from a higher camera (scale the 7.4–12 s keys' y by ~1.3) so they stand straighter.
- **Effort:** L (lighting and materials in app) + 3 re-renders. It lifts 60 s of the film, so it's worth it, but schedule it after #1–#7.

### 9. Windows: stop the exteriors reading as wallpaper
- **Where:**
  - ch 2 home office (`still-0044.8.jpg`)
  - ch 3 studio (`still-0060.5.jpg`)
  - ch 6 classroom
  - ch 7 gym
  - ch 10 night office (`still-0142.5.jpg`)
- **Why:** The exteriors are flat vector illustrations (cut-out houses, square yellow night windows) at the *same exposure* as the interior. A camera sees a daylit window 1.5–2.5 stops over the room, softened by depth of field. Matching exposure is the biggest single "this is CG" tell in the room chapters.
- **Exact recommendation (backdrop materials, app):**
  - *Day rooms:* backdrop emissive ×2.5–3 (about +1.5 stops), so it sits near but below clip (target ~225/255 after the grade), with a 4–6 px blur equivalent (or a mip bias) so it reads as out of focus. Add a soft bloom wrap on the mullions (#3's per-chapter glow can do this). Optionally add a sheer curtain prop in ch 2 to diffuse it further.
  - *Ch 10 night:* drop the backdrop to about −1 stop and break the lit windows into 2–3 warm temperatures with a slight blur. Real night city windows aren't uniform squares.
- **Effort:** M (one material change, applied per room) + re-renders. Batch it with #2, #7 and #10 to share render passes.

### 10. Lived-in dressing: make people's absence intentional, not empty
- **Where:** every room chapter; strongest in ch 2, 4, 5, 6, 7 and 11.
- **Why:**
  - Every chair is perfectly tucked, every surface showroom-clean, and no one is present. "Meet your partner in health" plays over rooms nobody uses. A premium film without talent still shows *traces of a person*: the just-left moment.
  - Two specific props hurt. An **empty power wheelchair** sits at the edge of ch 4's group shot (`still-0074.0.jpg`) and alone in the shadows of ch 11 (`crop-0149-wheelchair.jpg`). Parked empty in the dark, it reads as abandoned, which is not the accessibility message intended.
  - Ch 7's laptop shows a dated third-party tiled Start screen (`still-0106.5.jpg`). This is part of the screens work, but flag it.
- **Exact recommendation:**
  - *Ch 2 rise:* the task chair rolled back ~0.4 m and turned 20° as if someone just stood up (motivates the lift). Add a cardigan over the chair back and a steaming mug (subtle steam sprite). An open notebook with handwriting replaces one of the two mugs.
  - *Ch 4 commons:*
    - Two or three bags or jackets on chairs, open laptops at the study tables, and a half-finished group sketch on the project table.
    - The project table's white top (~30% of the end frame, the brightest surface) goes to albedo ~0.75. Move the reading lamp so it doesn't cover the "Humboldt" decal (`still-0074.0.jpg`).
    - Either dock the wheelchair *at* the Humboldt desk, with the desk lowered to its seated height (the accessibility story), or move it out of frame.
  - *Ch 5/6:* a headphone cable to the editing deck, a script with highlighter marks, a backpack against the student desk, and a jacket on the ch 6 task chair. Remove the grey designer chair in front of the ch 6 station (bright, ~15% of the title frame, `still-0093.8.jpg`).
  - *Ch 7 gym:* an unrolled yoga mat on the open floor, a towel over the desk edge, a water bottle with a condensation decal.
  - *Ch 11 storage:* remove the wheelchair from the opening (it sits in the title zone in shadow). The task chair pushed in under the parked desk's original spot sells "the floor is yours."
  - *Signage:* tone down the poster wall in ch 4. OPEN MIC, OPEN HOUSE TODAY and BEACH CLEANUP at full saturation compete with the desk. Use 20–30% less saturation and slightly smaller type. Avoid partial crops of institutional signage at frame edges: ch 5 has "COAS[T] COLLEGE" and "PREP / SH" cut at the top and right edges (`still-0085.0.jpg`). Tilt the ch 5 end key up ~3° or exclude them.
- **Effort:** M (dressing in room modules). Cheap per prop. Re-render the affected chapters in the same batch as #9.

### Next tier (worth doing if time allows)
- **Insert shots for scale variety.** Nine of twelve chapters share a medium 3/4 at FOV 36–42. `camera-spline.mjs` supports `"cut": true` keys, so 1.5–2.5 s macro inserts cost no extra chapter time:
  - ch 2: the lift column telescoping, FOV 22, at 3.5–5.5 s
  - ch 7: the height readout or controller
  - ch 11: a caster rolling across the floor seam, at 8–10 s

  These macro beats are what make Teenage Engineering and Apple films feel crafted. M per chapter.
- **The middle act (ch 5, 6) has no desk performance.** The hero does nothing for 22 s, across two rooms with similar navy palettes (`sheet-05-coast.jpg`, `sheet-06-oilers.jpg`).
  - ch 5: wake the under-glow as the camera lands, plus a 30→36″ perch lift at 5.5–9.5 s.
  - ch 6: a 0→15° reading tilt, or the LEDs warming to the school orange.

  Add these as `motion.clips`.
- **Ch 8 cause and effect.** "Proximity sensing keeps every move clear" needs a visible beat: the desk rolls toward a pylon, the sweep ring turns amber, the desk halts ~30 cm short, then the ring returns to blue.
- **A 60–90 s web cutdown.** 2:53 is long for a website hero and for a first-run onboarding (most premium product films run 60–120 s). This full version can stay as the "watch the film" asset. Suggested cut: ch 1 (trimmed to ~16 s), 2, 3, 7, 9, 11 and 12, built from existing renders. The score generator is EDL-driven (`score-synth.py`), so the music follows.

---

## Per-chapter notes

**1 awaken, 0–34 s** (`sheet-01-awaken.jpg`, `still-0001.5/6.8/15.0/19.5/27.5.jpg`)
- *Camera:* strong arc and low hero. 8–13 s keeps the desk small and centred while the strafe and turn play. It's the one stretch where the move is wider than the action needs. Consider tightening the 9.6 and 12.4 s keys by ~15% in radius (FOV 26.5 → 24).
- At 34 s this is 20% of the film. If any chapter gives up time for the cutdown, it's this one.
- *Light:* the desk side facing camera at 15–28 s is unlit, so the black panels vanish. See #8.
- *Design:* wheel material (#5). The grid horizon line at y ≈ 865 in the wider frames (#8).

**2 rise, 32.5–48.5 s** (`sheet-02-rise.jpg`, `still-0036.5.jpg`, `still-0044.8.jpg`)
- *Camera:* see #2. The chair-back foreground is a good choice; keep it as the fixed reference.
- *Light:* flat, even morning light with no direction. Give the window a raking sun key (warm, ~4500 K) across the desktop and floor, so the lift reveals a sun patch moving up the desk. That gives a free sense of motion. The pendant reflection in the portrait monitor (9.5–16 s) is still there. Rotate the portrait monitor 3–4° or drop the pendant's specular.
- *Design:* well dressed (clock, pinboard, mugs), and it harmonises with the black desk. Window: #9. Chair choreography: #10.

**3 create, 47–65 s** (`sheet-03-create.jpg`, `still-0050.0/53.5/60.5.jpg`)
- See #7. The studio palette (sage wainscot, oak floor, sky-blue wall, terracotta) is the nicest in the film and suits the white desk, once the desk stops clipping.
- The plaster bust and the plants are good art-room cues. Add a paint-splattered rag and a jar of brushes to complete it.

**4 commons, 63.5–77.5 s** (`sheet-04-commons.jpg`, `still-0066.5.jpg`, `still-0074.0.jpg`)
- *Camera:* the tracking overtake is the best room move in the film.
- The end group composition is dominated by the bright foreground table, roughly 30% of the frame and above the 20% foreground guideline in effect. Raise the 12.6 and 14 s keys by 0.25 so the desk reads over the table, or lower the table albedo (#10).
- *Light:* the cyan LED spill on the cork wall is lovely and well motivated. The left side of the frame is dead grey: add a warm practical (a floor lamp in the commons) for colour contrast against the cyan.
- *Graphics:* the Humboldt decal is the hero graphic, so keep the lamp off it. Calm the posters (#10).

**5 coast, 76–87 s** (`sheet-05-coast.jpg`, `still-0080.0.jpg`, `still-0085.0.jpg`)
- *Camera:* the lateral dolly works. The landing frame has ~35% empty carpet at the bottom and crops signage at the top and right. Tilt the final key's target up (target y 1.044 → 1.25) and push to FOV 36, so the hero station and the "COAST COLLEGE" sign both resolve.
- *Light:* the room is uniformly lit navy. The hero station has no light of its own beyond the under-glow. Add a soft overhead "pool" on the hero station (a practical track spot, ~3200 K) so it is visibly *the* station. Warm-on-navy also separates it from ch 6.
- *Design:* the orange and blue desk livery matches the room well, almost too well. It disappears into the wall. The pool light solves this.

**6 oilers, 85.5–96.5 s** (`sheet-06-oilers.jpg`, `still-0088.5.jpg`, `still-0093.8.jpg`)
- *Camera:* the rise-and-reveal over the student table is good.
- *Light:* the navy/black desk sits on a navy wainscot, which gives the lowest figure-ground separation of any room. Use the window: a raking daylight key across the desktop and "OILERS" decal, and a touch of warm bounce on the cream upper wall behind the monitors.
- *Design:* remove the grey designer chair in front of the station. Dress the student table with a backpack and an open textbook (#10). The bell-schedule and lab-safety posters are on-brand and read well; keep them.

**7 wellness, 95–110 s** (`sheet-07-wellness.jpg`, `still-0099.0.jpg`, `still-0106.5.jpg`)
- *Camera:* good; the frontal symmetric landing is the right choice.
- *Light:* the sun patch on the floor is the most photographic light in the film. Make it the key: about +½ stop, and let it climb onto the desk's lower shelf. The rest of the room is a blue-teal monochrome that the dark grey desk sinks into. Warm the cabinet and acoustic wall slightly (grade temp +0.04, in #3) and add a cool rim from the window side on the desk's right upright.
- *Design:* yoga mat and towel (#10). Replace the tiled Start screen on the laptop (screens team). Check the green supplement bag's partial lettering ("Her… Ye…") doesn't resemble a real brand.

**8 awareness, 108.5–120.5 s** (`sheet-08-awareness.jpg`, `still-0111.5.jpg`, `still-0117.0.jpg`)
- *Camera:* the crane to the graphic overhead is strong, and the symmetry is right.
- *Light/design:* pylons (#8), and the missing cause and effect (next tier). The desk top-down shows mostly the monitor back and the arm. Rotate the desk's starting yaw 180° so the overhead sees the lit desktop and the keyboard side.

**9 music, 119–133 s** (`sheet-09-music.jpg`, `still-0123.0.jpg`, `still-0129.5.jpg`)
- See #6. The camera path (high corner → low lateral) is right.
- The acoustic slat wall is a great LED catcher once the light is local: grazing coloured light across the slats will look expensive.

**10 media, 131.5–145.5 s** (`sheet-10-media.jpg`, `still-0137.0.jpg`, `still-0142.5.jpg`)
- **Clear the screen clip** (blocker above).
- *Light:* for "movie night" the room is too bright and too uniformly tungsten. The lamp-lit wall and shelf compete with the screen. Drop the room practicals ~1 stop and let the screen be the key: add a soft area light at the screen face, driven by the clip's average colour (the same data that will drive the LED stripes), so the desktop, keyboard and mugs pick up the picture.
- Grade: `media` gamma 0.94, temp −0.02 (#3). The night window: #9.

**11 storage, 144–161 s** (`sheet-11-storage.jpg`, `still-0149.0.jpg`, `still-0158.5.jpg`)
- *Camera:* the story is told clearly (tilt, roll, rise to the open floor), and the final high reveal is good.
- The dark architectural column occupies the top-left ~15% of the final frame. Shift the 17 s key target x by +0.3, or add 2° of yaw, to clear it.
- *Light:* very cold (R/B 0.53). Warm it slightly in grade (#3) and add a warm practical in the far commons, so the cyan desk glow has a complement.
- *Design:* remove the wheelchair (#10). The "ERGOFLEX / PILOT CONCEPT" floor mat is a nice payoff; make sure it's legible in the final frame by lifting its albedo a touch.

**12 hero, 159.5–173.5 s** (`sheet-12-hero.jpg`, `still-0163.0.jpg`, `still-0170.5.jpg`, `still-0173.0.jpg`)
- See #1 and #8. The orbit's opening (0–6.8 s) is beautiful. It's the ending that lets go.
- Keep the last ~2 s nearly static, as now, but on a 3/4 pose with the rims lit. That frame becomes the poster.

## Film-level notes
- **Rhythm:** every chapter has its title at 1.6 s, a 1.5 s dissolve and a push-in ending.
  - Vary the transitions (#4).
  - Let one or two chapters run their title later, after the move reveals the room: ch 4 at 3.0 s, ch 9 on the 121.8 s downbeat.
  - End at least two chapters on something other than a push-in: ch 5 ends on a lateral settle, and ch 9 could end on a rack or reveal.
- **Palette arc:** home (warm neutral) → studio (bright pastel) → three navy/blue institutional rooms in a row (4, 5, 6) → gym (teal) → void → coloured night → warm night → cyan library → void. The 4–5–6 run is the sag.
  - Warm practicals in ch 4 and 5 (notes above) break up the blue.
  - If the cutdown happens, drop ch 5 or 6.
- **Colour temperature:** after #3, aim for daylight rooms at R/B ≈ 0.85–1.0, night rooms either clearly warm (ch 10, ~1.3) or clearly cool (ch 9 base), and voids neutral-cool (≈ 0.7). Avoid the current 1.50 → 0.53 swing across one dissolve (10→11).
- **Opening and close:** both are strong ideas held back by execution: the wheel material and the dark hero. Fixing #1 and #5 changes the first and last impression for about a day of work.
