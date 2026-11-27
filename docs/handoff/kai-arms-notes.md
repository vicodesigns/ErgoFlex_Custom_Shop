# Kai's arms through the keyboard tray (oilers, chapter 6): WIP handoff

Status: work in progress. **No film data has been changed yet.** Nothing has been imported or regenerated, and there are no "after" stills.

## Where things are

- Branch: `director/oilers-kai-arms`
- Base: f731e62a (origin/video/cinematic-intro-hq). The local origin ref was stale at cd63e31a, so I fetched the branch explicitly.
- Studio-state: the committed `studio-state.json`, rev 9544 (commit 21267e4b). Renders used `--storage studio-state.json`.
- Desk height: the browser probe read 31 in at 12.4 s and at 13.6 s.
- Kai's bones are the same in the browser and in the headless runner (`tests/lib/people-film-run.mjs`): hand_l is (0.170, 0.8137, 0.2725) m in Kai's frame at 13.6 s in both.

## Cause

`kai-docks` (wheel-roll) and `kai` (wheel-type-31) have `when` windows that meet at 12.75. That makes a 1.4 s change of posture from 12.05 to 13.45 (room-people.mjs `pairUp` / `solveChange`, not a lap change).

- The arms are blended in joint space from about 12.36 s, from the rims to the posture as built.
- The `kai` pose keys sit on top: identity at 12.75, then Vico's typing pose at 13.5.
- So the fingertips travel forward low (y 0.48-0.62 m) and then rise almost straight up into the keys at (0.150, 0.758, 0.371). They pass through the tray plate and the keyboard from about 13.0 to 13.37 s.
- From 12.80 to 13.07 s they are also up to 50 mm inside his own thighs and knees (skin-normal check).

Geometry in Kai's frame, metres (+x his left, +y up, +z ahead), from the render probe:

| Part | x | y | z |
|---|---|---|---|
| Keyboard | ±0.243 | 0.711-0.758 | 0.229-0.485 |
| Tray plate | -0.244 to 0.259 | 0.702-0.711 | 0.251-0.502 |
| Desktop (cut-out front edge) | | 0.747-0.767 | 0.55 at x 0, about 0.43 at x ±0.2, about 0.30 at x ±0.3 |
| Touchscreen | -0.53 to -0.33 | 0.70-0.78 | 0.17-0.28 |

`kai-arms/desk.json.gz` holds every triangle of these parts.

## Planned fix (data only, Director pose keys)

Per-entry pose keys, all linear:

- `kai-docks`: postures `people-kai-wheel-roll`, with an identity key at 12.36.
- `kai`: postures `people-kai-wheel-type-31`. The existing 13.5 key stays unchanged.
- The key at 12.75 is identical on both entries, so the model swap at 12.75 stays continuous.

The keys come from one smooth wrist path (Catmull-Rom by arc length, smoothstep progress from 12.36 to 13.5) through these points (left side; the right is mirrored):

1. the rims;
2. (0.28, 0.68, 0.04);
3. (0.235, 0.80, 0.13), over the thighs;
4. (0.195, 0.835, 0.215), over the tray lip and the keyboard's front edge;
5. the 13.5 typing pose.

The elbow direction is blended from the motion's at the start to the 13.5 pose's at the end. The hand turn and a fingers-up pitch of up to 16 degrees are eased in. See `kai-arms/plan-try.json` and `kai-arms/design2.mjs`. The last generated keys are in `kai-arms/keys-try.json`: docks 12.48, 12.6, 12.75; kai 12.75, 12.85, 12.95, 13.05, 13.15, 13.25, 13.35, then 13.5.

## Verified vs not verified

Verified, headless only, 60 fps from 12.0 to 14.6 s, with `keys-try.json`:

- 0 frames of hands, fingers or forearms inside the keyboard, tray, desktop, touchscreen or mouse.
- 0 mm into the thighs or trunk.
- Everything from 13.5 s on is unchanged.

Open problems:

- **Small hitches at the keys.** Linear key interpolation on top of the moving change leaves velocity steps at the keys: about 5-7 mm per frame change at 60 fps (dstep), against 0.9 for the current motion. Keying every frame gives dstep 1.9, so the planned path itself is smooth.
- Halving the key spacing only brings it to about 4.9. Options:
  - more keys;
  - a small opt-in "spline" ease in people-pose-keys.mjs, which would also need the Director's ease menus;
  - a gentler path.

Not done:

- No "after" still strips or browser check; no film-camera check after the fix.
- No Director import, pass or `--pages oilers`.
- `tests/people-omar-lap-test.mjs` section 4 freezes Kai's oilers frames from 9.2 to 14.2 s (`tests/fixtures/people-lap-kai-mia.json`). Its Kai part must be regenerated once the keys are applied.
- That test already fails on the base at section 6 (stale `?v=` tags), before any change of mine.

## Still strips (before only)

Each is 15 stills from 12.4 to 14.5 s, every 0.15 s:

- `docs/handoff/kai-arms/before-back-left-sheet.jpg`: close, from behind on his left
- `docs/handoff/kai-arms/before-side-low-sheet.jpg`: from his left side, near tray height
- `docs/handoff/kai-arms/before-film-sheet.jpg`: the film's own camera, one shot from 9 to 15 s, so no camera cut falls in the hand-over

The full PNGs were in the session temp folder (`...scratchpad\kai-arms\before-*`) and may be gone.

## Next steps

1. Fix the hitches: more keys, or the spline ease.
2. Write a Director export with `peopleEdits`, the way `tools/experience/drafts/polish1124-noah/build.py` does.
3. Run `build-round8-director.py <cut> --import <it>`, then the pass, then `--pages oilers --downloads <cut>/director-import`.
4. Revert any files the pass touches outside oilers; do not touch hero or rise.
5. Regenerate Kai's part of the fixture.
6. Render the "after" strips with `mkcut.mjs` plus the patch, and take the GPU lock for it.

## Scripts (`docs/handoff/kai-arms/`)

The paths inside them point at `C:/Users/Vico/polish-wt/kai-arms`.

- `check.mjs [--keys k.json] [--desk desk.json] [--fps 60]`: checks body depth and desk intersection per frame, plus motion metrics.
- `design2.mjs plan.json`: turns a plan into keys.
- `traj.mjs keys.json t0 t1 fps`: prints the bone paths.
- `dsteps.mjs keys.json`: lists where the hitches are.
- `rigtools.mjs`: rebuilds a key from motion. It reproduces the existing 13.5 key exactly.
- `probe-kai.js`: the `render-probe.cjs --probe` script that dumps Kai's matrix, arm vertices and desk triangles.
- `mkcut.mjs <oilers.json> <out> <film|back-left|side-low> <probe.json> [keys.json]`: builds the cuts for still strips.
- `sheet.sh`: makes a contact sheet.
