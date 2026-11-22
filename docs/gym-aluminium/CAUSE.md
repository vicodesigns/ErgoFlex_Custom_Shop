# Gym (Wellness) desk metal reads dull grey: investigation

Branch eng/gym-aluminium (off video/cinematic-intro-hq aaf6bb54). No code or data fix is committed (see "Why no fix").

## Findings (1080p stills, 3rd cut, hq13, college seed; probes = `*-probe-*.json`)

1. The gym desk's metal is NOT mis-assigned or missing a rule. The desk hardware materials in Wellness are
   value-for-value the same as in Rise (shared desk materials with `userData.deskHardware`):
   - aluminium (482 meshes: tilt actuators, connector discs, brackets): #ffffff metalness 1, roughness 0.30, own envMapIntensity 1.35
   - dark metal (177 meshes: Nema motors etc.): #2a2a2a metalness 0.85, roughness 0.30, own 1.2
   - the dumbbell prop (Prop:dumbbell, Material_001): #cbcbcb metalness 1, roughness 0.23; the plates are black.
2. Wellness is actually reflecting MORE than Rise: effective envMapIntensity 0.536 (aluminium) vs 0.261 in Rise
   (scene.environmentIntensity 0.794 in the gym [environmentScale 1.6] vs 0.386 in Rise).
3. Why it reads grey everywhere in rooms (and so in the gym): epoch 5 / commit f3817c12 (2026-11-14, Vico: "like an
   aluminum gray, they're white right now") put the desk's aluminium in rooms on the room-gloss environment at
   `DESK_HARDWARE_GLOSS = .5` (studio.js ~1453) with the satin finish (roughness 0.30, catalog.mjs SURFACE_TREATMENTS.aluminium.satin).
   The room-gloss environment (studio.js createRoomGlossEnvironment) is one flat grey-wall box with four panels, so a
   roughness-0.3 metal shows an almost uniform light grey tube with little tonal range.
4. Numbers (bright low-chroma pixels of the tilt-actuator tube, tools: render/tubestats.cjs):
   Wellness t0.4 luma 144.0 sd 35.9 chroma 4.8; Rise t0.5 luma 166.8 sd 33.6 chroma 7.0 (same flat tube, a little
   warmer/brighter only from Rise's window and sun). So the gym is ~23 luma darker and a touch less tinted, not materially different.
5. In the gym the surroundings make it worse: the desk is a black/red build (deskFinish Black Birch + red trim; the
   lift columns/brackets are the 'base' paint #1c1c1e metalness 0.1, black in the dark room, same material as Rise
   where the room light lifts it to grey), the room is neutral dark grey, and the brackets/columns that read
   "dull grey/black" are painted base, not aluminium.
6. Product-stage chapters (awaken still) show the same dark steel-grey actuator: there is no brighter "aluminium"
   look elsewhere in the film to match; the closest is Rise's sun-warmed one.

## Why no fix
The cause is the global, deliberate DESK_HARDWARE_GLOSS .5 + satin roughness + featureless room-gloss environment
(Vico asked for grey over white on 14 Nov), not a gym defect. Matching "the other rooms" needs no change: values are
already identical. Making the gym metal brighter/crisper would be a new look, not a bug fix.
Tried (not kept): a Wellness-only sceneEdit setting the aluminium to the catalog's own gloss roughness 0.14
(`render/mkcut.py`). It applies (probe roughness 0.14) but the tube is no better (luma 139.5, sd 35.9, unchanged
contrast) and the only filter that matches the shared material (materialColor #ffffff, the desk is outside the
Room:gym path) also catches other white Physical materials (the actor's trousers/shoes changed). Rejected.

## If Vico wants it brighter anyway (his call; none done)
- Global code: raise `DESK_HARDWARE_GLOSS` (studio.js:1453) and/or give createRoomGlossEnvironment more contrast
  (brighter window/ceiling panels, darker floor). Moves every room chapter's metal pixels (rise, create, commons, coast,
  oilers, wellness, music, media, storage: all rooms; not the product-stage awaken/awareness/hero), small area each:
  global epoch bump 13, or per-chapter lines in tools/experience/render-epoch.txt (format `chapter wellness 1`; existing
  lines: commons 6, awaken 2, create 1, awareness 1, storage 3).
- Wellness only as data: needs a sceneEdit that can target the desk's shared hardware material precisely (add a
  materialUserData / metalness filter to film-edits.mjs materialFilter); then a `chapter wellness 1` line.

## Not verified
- I did not see Vico's actual 4K frames; the stills are 1080p and the actuator is a few dozen pixels.
- Which parts Vico means by "all the aluminum" is inferred (actuators, discs, dumbbell chrome ends all reflect fine in stills).
- No before/after non-Wellness diff was needed (no change); the Create still failed in the previous run (img onerror), not investigated.
- An unexplained difference between two Wellness renders: the navy LED shade on the lift column differs (before blue, try black); not investigated.
