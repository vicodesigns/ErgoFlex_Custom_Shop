# Rise (ch02): Maya's fingers into the thighs, 12.2-13.6 s

- Branch: `director/rise-maya-thighs`
- Base: 7148ddde (`origin/video/cinematic-intro-hq`, fetched explicitly; it includes the elbow fix c214fbe3)
- Studio state: the committed `studio-state.json`, rev 9671
- Headless only: no browser and no GPU, so there are no stills
- Scope: 3rd cut only. Only Maya's `people-maya-sit-type` pose keys changed.
- Method, measurement and scripts: the same as `rise-maya-elbow-hand-notes.md`. The scripts for this job are in `rise-maya-thighs/`.

## Cause

As the hands leave the keys for the lap, the motion lays the fingers into the thighs (the wool trousers) in two dips:

- 12.2-12.55 s: up to 14.0 mm (middle_03_l at 12.3 s)
- 12.8-13.6 s: up to 30.0 mm left (middle_03_l at 13.458 s) and 20.5 mm right (middle_03_r at 13.258 s)

Arm keys exist only at 0, 13 and 13.1 s (all three identical), and the fingers are unkeyed before 13.1 s. So the motion alone sets the pose here.

The base motion also has its own snap at 12.217 s: the left elbow moves 24.7 mm in one frame, and the change in per-frame motion is 22.7 mm/frame². That snap is unchanged.

## Change

- 14 new keys: 12.1 (neutral anchor), 12.2, 12.233, 12.267, 12.3, 12.35, 12.4, 12.5, 12.6, 12.7, 12.8, 12.867, 12.933 and 13.033 s.
- The new keys hold copies of the values already in force: the arm values of keys 0 and 13, and neutral fingers. Before 12.1 s nothing changes.
- On those keys and the existing 13.0-13.8 s keys, each side's forearm, hand and 15 finger bones are turned so the hand rests on the thigh: tips within 3 mm, depth under 0.5 mm. The optimizer also checks the in-between frames.
- Turn sizes: forearm up to about 23 deg, hand up to about 30 deg (at 13.23-13.37 s, where the base sinks 30 mm), fingers a few degrees each.
- Keys after 13.85 s are byte-identical to the base, so the elbow fix windows are untouched.
- **Key count: 149 to 163 (MAX_KEYS 200).**

## Numbers (120 fps, LBS skin, nearest-triangle depth)

| | before | after |
|---|---|---|
| left hand into left thigh, 12-14.2 s | 30.0 mm, 138 frames > 2 mm | 4.0 mm (12.217 s), 14 frames > 2 mm |
| right hand into right thigh, 12-14.2 s | 20.5 mm, 86 frames > 2 mm | 6.3 mm (ring_03_r, 12.250 s), 22 frames > 2 mm |
| finger joints inside the thigh | 18.3 mm | 0 |
| 13.0-14 s (inside the requested window) | 30.0 / 20.5 mm | 0 / 1.4 mm, 0 frames > 2 mm |
| elbow windows 14-23.3 s | 1.3 / 1.4 mm | 1.3 / 1.4 mm (unchanged) |
| chair clearance, 12-14.2 s | 18.7 mm | 19.8 mm |
| chair clearance, 13-23.3 s | 15.4 mm | 15.4 mm (middle_03_l at 18.875 s) |

Residuals over 2 mm, all at most 6.3 mm:

- 12.208-12.40 s, around the base's own elbow snap at 12.217 s
- 12.675-12.717 s (left, up to 3.4 mm)
- 12.95-12.975 s (right, 2.5 mm)

Motion (largest per-frame change in movement, mm/frame²): the largest anywhere is 22.66 both before and after (the base snap at 12.217 s). The largest local increases are about +8 at three moments:

- r.tip at 12.275-12.30 s (0.3-1.0 to 7.2-8.7), right after that snap
- l.tip at 13.542 s (1.75 to 8.40)

Neither is visually checked.

## Stores

`sync.py` writes the same keys into four files (byte-identical sync):

- `director-camera-rise.json`
- `director-film/rise.json`
- `review-cut.json`
- `director-import/ErgoFlex-film-ch02-rise-director.json`

After the sync, `cast[0]` is identical in all four.

The 4th cut does not have this change, nor the elbow fix. It lacks both in its `director-camera-rise.json`, `director-film/rise.json`, `review-cut.json` and `director-import/ErgoFlex-film-ch02-rise-director.json`.

## Limits

The limits are the same as in the elbow notes. In addition:

- Nothing here was seen in a render.
- The chair's position before 13 s comes from the headless people code: z from -0.40 to -0.32 in Maya's frame, linear between samples.

## Tests

`people-pose-keys-test`: OK.
