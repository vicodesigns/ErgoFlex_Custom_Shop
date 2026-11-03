# Cinematic camera and movement pass — October 29, 2026

## Applying the pass
Open `/experience/?director=1&cinematic=1` to create and save a separate cinematic copy of the currently selected cut. The URL flag is consumed once so refreshing does not create another copy. Alternatively, use Project → Create cinematic camera & movement pass. The original cut stays in Saved client cuts.

## Direction
- Opening: retains existing movement clips and earlier camera compositions. After the final desk movement, descends through an arc, holds a low upward-looking portrait, and returns to the exact original ending composition. Adds enough duration for a seven-second finale.
- Lift: seated eye level, rising camera, low-angle standing reveal.
- Tilt: overhead workspace, drafting detail, side profile, easel portrait.
- Commons: establish the shared room, track the approach, settle at table height.
- OCC: room context, lateral workstation reveal, studio overview.
- HBHS: classroom context, workstation push-in, classroom pullback.
- Wellness: seated view, rise, pullback for movement.
- Proximity: low base view, crane above the sweep, clearance overview.
- Gaming: frame push-in, low lighting reveal, pullback.
- Media: screen approach, viewing hold, ease back.
- Storage: transformation and route, rising cleared-floor overview.
- Closing: gentle arc, final pullback and hold.

All camera views and movement clips remain individually editable. Movements get a readable establishing interval, smooth acceleration where appropriate, minimum chapter lengths and a closing hold. Existing movement amounts, endpoints and recorded paths are retained. Actual generated camera positions use the loaded desk/room bounds, not assumed dimensions.

## Verification
Passed chapter plan, clip-boundary, endpoint, opening-preservation, upward-view, sampled floor-clearance and save-roundtrip tests. Camera, movement clip and pacing regressions passed. JavaScript syntax checks passed.

Browser automation timed out while binding the existing Director tab. The cinematic copy has not been generated or visually reviewed in that browser; the application generates it when the link or Project action is used. Real scene collision/framing review remains outstanding.
