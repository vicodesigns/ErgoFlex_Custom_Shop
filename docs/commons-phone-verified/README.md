# Commons phone on the charger: verified on the seated 3rd cut (base d4cd5fb3)

Base: `origin/cut/vicos-3rd-current-20261121-1545` @ d4cd5fb3. That is Vico's seated 3rd cut as of 15:45, with his Commons exports (14) and (15) (15:07-15:08).
Patch source: `cut/vicos-3rd-commons-phone-20261121` @ 81fd3a8c. Only its IK keys and tools were used. Its export docs were NOT used, because they predate Vico's edits.

## Files
- `export-vicos-3rd-cut-commons-phone.json`: the importer doc. It is Vico's LATEST raw Commons export (15) (`director-exports/export-4438b1869bcf-...__15_.json`) with `peopleEdits` merged by key. Only `mia-waits`, `mia-works` and their `people.when` change. Everything else in the doc is exactly his export: camera, motion, propEdits and the other people. sha256 3b405082...
- `commons-phone-patch.json`: the 3 hand sceneEdits, for `tools/apply_hand.py`.
- `tools/apply_hand.py`: a NEW version. It removes every earlier entry of this patch, including the broken 20 Nov glow entry, and then inserts the patch's entries before the Director's entries. Running it a second time changes nothing.
- `tools/make_fixed.py`: builds both files from the cut, the raw export and the IK keys (the patch branch's `docs/commons-phone/tools/ik-keys-final.json`).
- `logs/`: the import diffs, the probes and the frame-diff table.

## Apply on the desk (Linux importer)
1. Under the cut lock, run `python3 tools/experience/build-round8-director.py exports/cinematic-intro-cut-vicos-3rd-cut --import docs/commons-phone-verified/export-vicos-3rd-cut-commons-phone.json`. Instead of this step, you can drop the file into the watched Downloads folder as `Film-chapter-commons-phone-verified.json`.
2. Run the pass: `python3 tools/experience/build-round8-director.py exports/cinematic-intro-cut-vicos-3rd-cut`. Then run the pages step as usual: `--pages commons`.
3. Run `python3 docs/commons-phone-verified/tools/apply_hand.py exports/cinematic-intro-cut-vicos-3rd-cut docs/commons-phone-verified/commons-phone-patch.json`. It patches `review-cut.json` only.
4. Check the result. `--check` must say "files patched: 0" on a second run. The commons shot must have the 3 entries at sceneEdits[5..7], and `motion.clips[2].target.z` must still be 146.9.

Repeat step 3 after any later Commons import. The pass keeps hand entries, so the step is only needed when someone re-runs a builder that rewrites sceneEdits.
If Vico exports Commons again before this is applied, rebuild the doc from his newest export with `tools/make_fixed.py`. Using this doc as it is would revert his newer export.

## Diff on a scratch copy (logs/import-v2-*.txt)
I ran the importer (`--import` and the pass, no pages) and then apply_hand on a copy of the d4cd5fb3 cut:
- Files changed: `review-cut.json` and `director-camera-commons.json` only.
- All 11 other chapters are byte-identical. The top-level fields are unchanged.
- In the commons chapter, only these changed:
  - `directorEdited.at`
  - 3 added sceneEdits
  - `people.when`: mia-waits end 13.1 -> 13.478, mia-works start 12.6 -> 12.978
  - `mia-waits`: 3 poseKeys (11.6 / 12.15 / 12.7)
  - `mia-works`: `swap` 0.02, `change` {1.1 s, arms [0.15, 1]}, poseKeys [12.7 reach pose, 13.778 = Vico's typing key, exact values]
- Yara: no people changes. Her "take" is the show edit.
- The imported commons shot is identical to the rendered one, apart from `directorEdited`.

## Conflicts found
The ORIGINAL patch export doc (81fd3a8c) applied on d4cd5fb3 would revert Vico's edits (`logs/old-patch-on-d4cd5fb3-chapdiff.txt`):
1. Motion clip `builtin-wheels-0` target z: 146.9 -> 140.9.
2. Mia-works typing key at 13.533 (his hand_l / lowerarm_l / upperarm_l / hand_r ... offsets) replaced by identity.
3. Sofia (`mate-right`): at 6007 -> 6100, and her poseKeys go from his 2 keys back to 1.
4. Kai (`mate-left`): his 2 poseKeys go back to 1.

His exports (14) and (15) changed Sofia, Kai and 3 prop edits (Sofia's chair hidden; a chair and a study kit moved). They did NOT touch Mia, Yara, the charger, the phone or their `when` (`logs/vico-commons-12b571cd-to-d4cd5fb3.txt`).
The new doc keeps all of his edits.

## What the renders showed (render-cut / render-still on this PC)
Stills are 960x540, from the film camera plus review cameras f2f, top, low, side, yara and pad. There are also 1080p pad stills and 540p clips.

**Bugs in the 20 Nov patch, fixed:**
- The charging glow never rendered: the edit matched 0 objects. With `materialName`, film-edits `targets()` needs the MESH name to match, and the match was the group name `^Added prop:ergoflex-phone#mph01$`.
  - Fix: `match ^Supplied_phone_part_\d+$` + `path Added prop:ergoflex-phone#mph01` (now matches 2 meshes).
  - `hUlRcbieVuIiOXG` IS the screen face. I checked this with a colour-coded material test.
- The added phone shares its GLB materials with Yara's charger phone, so the first fixed glow also lit Yara's phone at 0-5.25 s.
  - Fix: `clone: true` on the glow edit. Re-rendered: Yara's phone is dark again, and frames 0-5 s match the base within noise.
- There was a screen pop at the swap (12.667 -> 12.70): the held phone renders lit, about RGB (202,222,246), and the pad phone was dark.
  - Fix: the pad phone starts lit with emissive #cadef6 x0.7, which measures (200,218,242).
  - Glow keys: 12.7-12.95 lit, 13.1 dims (0.25), 13.35 charging flash (1.0) held to 14.2, then a faint charging glow (0.35) from 15.0.
- The fade of Yara's phone (5.1-5.4 s) showed an x-ray ghost: inner parts were visible through the half-transparent phone at 5.25. It also straddled the 5.25 camera cut.
  - Fix: show {from 0, to 5.25}, no fade. The phone is fully there at 5.233 (shot A) and gone at 5.267 (shot B). Yara takes it off-screen.

**Verified OK:**
- The charger puck belongs to the desk, not to the phone asset (18 phone parts, no puck). The puck stays after Yara's phone goes, and it is empty while the desk drives to Mia (9-12 s).
- No double phone and no gap at the swap: at 12.69 the held phone is shown and the pad phone hidden; at 12.70 the reverse.
- The pad phone sits flat and centred on the puck (1080p stills).
- Scale: pad phone footprint 232-235 x 113-126 mm vs the held phone 231 x 113 mm. Both are the film's existing, about 1.6x oversized, phone.
- Mia's held phone in the last held frame (12.69) vs the pad phone at the same instant, in the desk frame:
  - position: dx -7.1 mm, dz +16.2 mm (17.7 mm horizontal), dy +36.5 mm (a 3.7 cm drop)
  - orientation: tilt 1.2 deg, yaw 0.8 deg
- The arm reach (11.6-12.7 s) and the pull-back into her typing pose (12.7-13.8 s) look natural in review cams f2f and top: no broken or twisted arm, and the hand opens and lifts away (12.9-13.0 s).
- Frame diffs vs the current cut in the film camera (`logs/framediff-film-v2-vs-base.txt`):
  - 0-5.0 s: mean 0.11-0.20 grey levels, max <= 39, pixels >16 <= 0.001%. That is render noise.
  - 5.25-11.5 s: only the small charger-phone spot differs, 0.003-0.05% of pixels (the phone is gone).
  - 11.75-13.5 s: the arm.
  - 13.75-15.5 s: the screen glow, about 0.02-0.06% of pixels.

## NOT fixed / NOT verified
- **Hand and desk at release (12.6-12.75 s):** the wrist bone is at about desk-top height (y 1.108). The lowest finger bone is 1.067, about 4 cm below the desk top, so the fingers go into the desktop. This shows in the low review cam. It cannot be seen in the film camera, which is behind her back.
  - It comes from the palm-up grip, with the phone about 6 cm above the wrist. Raising the hand clear would make the 3.7 cm drop about 8 cm. It needs a different held grip, not just pose keys. Not fixed.
- **The 3.7 cm drop at release** is left as is. The desk is still moving at about 1.0 m/s at 12.70; it stops at 13.4, and the phone then rides 0.48 m away from Mia with the desk.
- **Legibility:** in the film camera the placement is hidden by Mia's back and headrest. The charging flash at 13.35-14.2 s is a small light spot on the desk.
- **Yara never touches the phone.** It is removed at the camera cut; there are no Yara pose keys.
- Not checked: the standing 3rd cut and the 2nd cut exports; a 4K or full-quality (blur) render; the desk's Linux importer itself (only the Windows scratch run); the pages step (not run, because of the Windows screens issue). A 3 s whole-chapter review camera was not rendered (only 4-16 s).
- In the review cam f2f, Mia is hidden behind the monitor from 13.5 s. The base shows the same, so this is not caused by the patch.
