# Vico's 3rd cut, Nov 21 fixes: Create ceiling, Oilers touchscreen, Noah's hair

Base: `origin/cut/vicos-3rd-fixes-20261121` (7ffa208c). Three commits on this branch:

| commit | what | pixels that change |
|---|---|---|
| Create ceiling (`artist-room.mjs`) | a real plaster ceiling deck in the artist studio | chapter 3 Create only (the `creative` room, default look; Classic untouched). Studio: the deck shows when the eye is below the ceiling, like the workshop's |
| Oilers touchscreen (`studio.js` + people data) | the screen comes out its full travel past the 60x30 edge, no clipping | chapter 6 Oilers only (the only chapter with a `touchscreen` field; the code acts only while a film poses the screen on a 60x30 desk) |
| Noah's hair (data only) | one hand sceneEdit on the Oilers chapter | chapter 6 Oilers only (Noah's 10 meshes) |

Nothing under `exports/` is changed on this branch: the docs below are the patch.

## How org applies it

1. Merge the code (the ceiling and touchscreen commits).
2. People (Noah's position and pull), both cuts, through the Director importer:

       python3 tools/experience/build-round8-director.py exports/cinematic-intro-cut-vicos-3rd-cut          --import docs/ceiling-oilers/oilers-seated-export.json
       python3 tools/experience/build-round8-director.py exports/cinematic-intro-cut-vicos-3rd-cut-standing --import docs/ceiling-oilers/oilers-standing-export.json

   Each doc is Vico's latest Oilers export of that cut (`director-exports/export-35ebdf7f41cf-...` seated,
   `export-b733a7f0f8ca-...` standing) with only these five fields changed (`oilers-patch.json`, written by
   `tools/make-docs.mjs`) and `updated`/`note` stamped:
   `noah-steps.walk.path[2]`, `noah-pulls.at`, `noah-taps.at`, `noah-watches.at`: [-3098, -1172] -> [-3098, -1064];
   `noah-pulls.act.by`: [0, 0, 120] -> [0, 0, 142].
3. Noah's hair does NOT travel through the importer (hand-made sceneEdits): after the import, run

       python3 docs/ceiling-oilers/tools/apply_hand.py exports/cinematic-intro-cut-vicos-3rd-cut          docs/ceiling-oilers/oilers-hair-edit.json
       python3 docs/ceiling-oilers/tools/apply_hand.py exports/cinematic-intro-cut-vicos-3rd-cut-standing docs/ceiling-oilers/oilers-hair-edit.json

   It inserts the one entry before the Director's own entries in the oilers chapter of `review-cut.json` (and any
   `shots/NN.json` holding it; none do today). Idempotent (keyed by its label). The pass keeps hand entries.
4. The Create ceiling needs no data. Agent B's new Create camera (branch `cut/vicos-3rd-create-camera-20261121`) is
   independent of it; both were verified together (below).

Verified on scratch copies outside the repo (`verify/`): import + pass + apply_hand on both cuts; the imported oilers
chapter equals the patch field by field, no other field / cast entry / chapter changed, and it equals the data the
renders below used (`oilers-C`), except `directorEdited`. The standing cut's Oilers chapter is the seated one's
(only `directorEdited` differs), so the same renders stand for both.

## 1. Create ceiling

Cause: the film turns the cutaway ceiling plane off for every shot and the artist studio built no ceiling, so from
about 7 to 15.5 s (both the film camera and B's new camera) the top of the frame looked past the wall tops into the
scene beyond: the pale, rafter-lined wedge and dark patterns. A look-up diagnostic camera at 12.7 s showed black void
above the walls (`ceiling2-lookup-diag-BEFORE.png` on the desk).

Fix (the workshop's c403f767 approach): group `Ceiling artist studio plaster deck`: one solid slab (w+160 x d+80 mm,
50 mm thick, underside 10 mm below the wall tops and the cutaway plane, so no coplanar faces) and a 46 mm cornice on
the three walls; two plain materials, no textures; hidden with the other `Ceiling ...` groups above room height.

It neither casts nor RECEIVES shadows. Important finding: the renderer's shadow maps are VSM, and three.js draws every
`receiveShadow` mesh into a VSM map as an occluder too. With the deck receiving, the whole studio went into the key
light's shadow (lower-frame PSNR before/after 27 dB, visibly darker room); with it off, 46.8 dB (min 44.7) over the
whole chapter, both cameras: only the ceiling pixels change. NOTE: the workshop deck (c403f767) sets
`receiveShadow = true`, so by the same mechanism it probably darkens the Storage chapter's key light; not checked here.

## 2. Oilers touchscreen

Cause (measured, `measurements/progress-before.json`, `time-before.jsonl`): the film uses the standard screen (inside
the right wing panel) on the 60x30 desk, but stowed where the 48x30 top keeps it: 3.8 in behind the 60x30 top's front
edge. Its 4.7 in slide ended with the display still under the top (display front 0.57 in past the edge), and the
146 deg turn drove it through the desktop: 464 desktop / 187 logo triangles crossing at progress 1 (354-542 from
6.8 s on, plus the mouse pad and a desktop accessory, Mesh_0), and the stowed parts poked 0.05 in into the underside (679 crossings).

Fix (`studio.js setScreenProgress`, only while a film poses the screen on a 60x30 desk): the stowed screen, rails and
travel stand `filmShift.x` = 3.805 in (measured from the two tops) further forward along the desk's own x, across (z)
still inside the wing panel; 0.04 in lower under the top while stowed/sliding, eased back during the turn; the travel
is 0.85 in longer (`FILM_SCREEN_REACH`), so the opened screen's back clears the 60x30 edge and trim (their edge sits
~0.6 in further over the hinge than the 48x30's; `measurements/open-pose-sweep.json`).

Numbers (after, `measurements/progress-after.json`, 23 progress samples 0..1, triangle-exact crossing test,
clearance = vertex/edge-midpoint to triangle distance, desk inches; 1 in = 25.6 room mm):
- triangle crossings with every desk part: 0 at every sample;
- min clearance: right wing panel (Desktop_2) 0.155 in (4.0 mm), its trim 0.161 in, 60x30 desktop 0.295 in (7.5 mm),
  desktop trim 0.298 in (at progress 1: 0.313 in), desktop logo 0.39 in;
- screen x (desk local, front edge of the moving parts): stowed -139.75 (flush with the 60x30 edge, -139.45), full
  slide -134.22 (5.2 in past the edge; before -138.88, 0.57 in past), opened -134.57.

In the chapter (`measurements/time-after.jsonl`, 28 times 5.0-9.4 s, the real data with Noah): 0 crossings with any
mesh near the screen at every time. Screen vs time: progress 0 to 0.5 over 5.4-6.5 s (slide; display centre world x
-2.378 -> -2.170), 0.5 to 1 over 6.5-7.6 s (turn 0 -> 146.5 deg), then held.

Noah (data): he stands 108 mm further back along the pull (between the stowed edge's 97 mm and the opened screen's
119 mm move) and pulls 142 mm (the 5.55 in travel). His fingertip bone stays 38-55 mm from the screen through the pull
(before 51-66 mm); at the tap press (8.2-8.4 s) 52.9 mm (before 48.6 mm).

## 3. Noah's hair

The afro01 cards' light texels and the cast finish's anisotropic sheen drew grey scratches and a cornrow pattern over a
see-through scalp (`frames/noahhair2-*`). Data only: one Oilers sceneEdit, path `Person:people-noah`, material
`^Human\.afro01$`: colour #7a6052 (multiplies the colour map), roughness .8, sheen .08 (#3b2e28), anisotropy 0,
specularIntensity .35. Variants tried (close-up and film-camera stills): sheen/anisotropy variants brought the card
stripes back; the darker/flat ones read as a full, soft afro. Cast `colors.hair` (the importer-borne knob) only tints
and kept the stripes, so it is a hand sceneEdit.

## What is NOT verified

- 4K: everything here is 480p clips plus 720p/1080p stills; no 4K render.
- The clearance numbers are vertex-to-triangle and edge-midpoint distances (not exact triangle-triangle distance);
  crossings are exact (edge-triangle intersection). Only desk parts and nearby room meshes were tested, not people.
- Noah's hand vs his own body (arm through the torso) was judged by eye on the frames only; the tap fingertip is ~5 cm
  from the glass at the press, as before (the tap was not retuned).
- The hair edit's look in the other Oilers framings was seen at 480p only (and 1080p at 12 s).
- The Studio (non-film) look of the Create ceiling and the 60x30 touchscreen in the Studio app (unchanged code path,
  not rendered).
- Render cache keys: if they hash studio.js / artist-room.mjs, other chapters may be re-rendered (identical pixels).

## Files

- `oilers-*-export.json`, `oilers-patch.json`, `oilers-hair-edit.json`: the patch.
- `tools/`: `make-docs.mjs`, `apply_hand.py`; render helpers (`clip.sh`, `stills.sh`, `sheet.sh`, `push.sh`); probes
  (`probe-time.cjs`, `probe-progress.cjs`, `probe-openpose.cjs`: copies of render-still.cjs with a probe body; copy to
  `tools/experience/` to run, see `probe*.sh`).
- `measurements/`, `verify/`, `frames/`.
