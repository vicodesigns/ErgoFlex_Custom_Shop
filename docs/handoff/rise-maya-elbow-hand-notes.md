# Rise (ch02): Maya's hands during the seated overhead triceps stretch

- Branch: `director/rise-maya-elbow-hand`
- Base: 470ab43c (`origin/video/cinematic-intro-hq`, fetched explicitly; the rise files are the same as at 295875cb, which carries the headrest keys from 2173ad76).
- Studio state: the committed `studio-state.json`, rev 9671. The renders used `--storage studio-state.json`.
- Scope: 3rd cut only. Only Maya's `people-maya-sit-type` pose keys changed. The camera, props, chair, other keys, music, score and EDL are untouched. Key count is still 149 (MAX_KEYS 200): no key was added.

## What happens in the base

The stretch is done twice:

- 15.1-17.35 s: the right arm is up and the left hand holds the right elbow.
- 19.1-21.3 s: the left arm is up and the right hand holds the left elbow.

In both, the supporting hand's middle and index fingers sit inside the raised arm's elbow, in the upper-arm and forearm skin around it. Measured at 120 fps against the drawn (linear-blend skinned) body, using the nearest triangle and its normal:

- left hand: 25.1 mm deep (middle_03_l at 15.175 s), 271 frames deeper than 2 mm
- right hand: 24.9 mm deep (middle_03_r at 19.192 s), 266 frames deeper than 2 mm

The finger joints themselves are up to 12.3 mm inside.

The hand down the back does not go into Maya's body by this measure. That hand is the right hand at 15-17 s and the left hand at 19-21 s. Its skin stays 11.9 mm (right) and 13.2 mm (left) off the nearest body surface: the shirt over the upper back, then the ponytail. The measure covers the whole torso skin, shirt, hair and neck, not only bone points.

**This is not visually confirmed.** The close renders of the back were blocked: the GPU was busy with film req-20261128T070608. The user's report may come from:

- the camera angle, with the fingers hidden behind the ponytail or shirt edge, or
- the hand near the chair's backrest, about 15 mm away.

The hand's pose was left as is.

## Change (pose keys only)

At the existing key times from 14.867 to 17.6 s (left) and 18.833 to 21.533 s (right), these bones of the supporting side now carry a local turn on top of the old key (new key = old key × turn, rounded 1e-4):

- `hand_<s>`
- the 15 finger bones
- `lowerarm_<s>`, a forearm turn about the supporting elbow

The raised arm and its elbow are not touched.

How the turns were found:

- At each key time and the in-betweens, an optimizer minimised hand-skin depth below 0.5 mm.
- It kept the index, middle, ring and pinky tips within 3 mm of the elbow surface, so the hand rests on the elbow instead of floating.
- It kept the turns small and smooth from key to key.
- The turns are eased in over 0.3 s before the first deep-contact key and out over 0.3 s after the last (smoothstep across the existing keys), so the hand settles onto the elbow instead of snapping.

Typical sizes: forearm 3-19 deg, hand 5-22 deg, finger bones a few degrees each.

The scripts are in `rise-maya-elbow-hand/`: `design.mjs`, `design2.mjs` and `post.mjs`.

## Per-fix numbers (120 fps, 13.0-23.3 s; logs: `hands-120fps-*.txt`)

| when | hand | before | after |
|---|---|---|---|
| 15.1-17.35 s | left hand on the right elbow (middle/index _02/_03) | 25.1 mm skin, 12.3 mm joint, 271 frames > 2 mm | 1.3 mm (pinky_03_l on the back of the head, 17.300 s), 0 frames > 2 mm |
| 19.1-21.3 s | right hand on the left elbow (middle/index _02/_03) | 24.9 mm skin, 11.7 mm joint, 266 frames > 2 mm | 1.4 mm (index_03_r in the left forearm, 19.342 s), 0 frames > 2 mm |
| 15-17 / 19-21 s | the hand down the back | 0 mm (11.9 / 13.2 mm clear) | unchanged |

Motion, as the largest per-frame change in movement (second difference of the wrist, fingertip, elbow and mid-forearm, mm/frame²):

- The largest anywhere is 7.42 mm both before and after (l.elbow at 14.708 s, from the base motion).
- The largest local increase is +4.1 mm at the ease-ins: 15.175 s l.wrist goes from 1.35 to 5.10, and 19.142 s r.tip from 0.73 to 4.84.

Chair, with the headless 120 fps check of 13.0-23.3 s (`chair-120fps-*.txt`): the minimum clearance from Maya's arms, hands, head and neck to the Steelcase Leap v2 is 15.4 mm both before and after (middle_03_l at 18.875 s, outside the changed keys).

## Remaining

The lap, 13.0-13.6 s, is not fixed. As the hands come off the keys into the lap, the fingers sink into the thighs:

- left: 30.0 mm (middle_03_l at 13.458 s)
- right: 20.5 mm (middle_03_r at 13.258 s)

There is also 4.6 mm at 12.5 s, before the stretch window. This comes from the motion, not the stretch keys. The arm keys at 0, 13 and 13.1 s are identical, and the fingers are unkeyed before 13.1 s.

A fix needs:

- one new key at about 12.8 s, so the hold before 13 s stays as it is, and
- hand/finger turns at 13.0-13.6 s.

A trial optimizer (`design3`, not committed) needed 35-58 deg hand turns, so this was left for review rather than forced.

## Stores (byte-identical sync, as the headrest fix)

`sync.py` writes the same keys into `cast[0].postures.people-maya-sit-type.poseKeys` of four files, each serialized the way it already was:

- `director-camera-rise.json`
- `director-film/rise.json`
- `review-cut.json` (the rise shot)
- `director-import/ErgoFlex-film-ch02-rise-director.json`

Checks:

- A no-op sync with the base keys left all four files byte-identical.
- After the edit, `cast[0]` is identical in all four.
- The only JSON path that changed is that posture.

The 4th cut does not have this change. It lacks it in its `director-camera-rise.json`, `director-film/rise.json`, `review-cut.json` and `director-import/ErgoFlex-film-ch02-rise-director.json`.

## Limits of the measurement

- The skin is the GLB's skin, linear-blend skinned headless from the film's own bone poses (`tests/lib/people-film-run.mjs`). Its bones match the browser's bones exactly (probe at 16.5 s).
- Depth is the distance to the nearest triangle when the point lies behind every equally near face, so concave folds can under-read. Points between the shirt and the body count as inside.
- Cloth does not deform beyond skinning.
- The chair check uses the chair GLB in Maya's frame. Headless, the parked chair sits at identity to Maya from 14 s and rolls in from z -0.317 at 13.0 s. The browser places the real model at the same transform; the base minimum of 15.4 mm agrees with the headrest fix's 15 mm or more.
- No close-up stills were rendered after the change. The GPU was busy, so the strips are pending.

## Pending GPU work (strips)

Run when the watcher shows `new=0`, `C:\work\gpu.lock` is absent and the lock is taken. Run from the worktree, with `S` = this folder's scripts and `P` = a render-probe JSON from `probe-rise.js` (for Maya's matrixWorld):

```
node tools/experience/render-server.cjs 3047   # (3017 is someone else's server)
node S/mkcut.mjs exports/cinematic-intro-cut-vicos-3rd-cut/director-film/rise.json cut-<view>-before.json <view> P keys-base.json   # base keys from 470ab43c
node S/mkcut.mjs exports/cinematic-intro-cut-vicos-3rd-cut/director-film/rise.json cut-<view>-after.json <view> P
node tools/experience/render-probe.cjs --server http://127.0.0.1:3047 --cut cut-<view>-X.json --shots 0 --at <t/28.5,...> --size 960x540 --out out-<view>-X --storage studio-state.json
```

- views: `film`, `elbowL`, `elbowR`, `backL`, `backR`, `lap`
- times: 13.3, 15.2, 15.5, 16.2, 17.0, 17.5, 18.5, 19.2, 19.5, 20.0, 20.5, 21.0, 21.2, 22.0, 23.0

Note: in this build, `probe-rise.js`'s skinned-vertex dump double-applies the transform. Its bones and matrixWorld are right, and the headless LBS is used for all numbers.

## Tests

- `people-pose-keys-test`: OK.
- No .mjs or stage code changed, so no ESLint run was needed.
