# Intro refinement — HQ4

Baseline: `cinematic-intro-20261030/final/ErgoFlex-Intro-1080p-hq3.mp4`, identical by SHA-256 to the movie in the supplied `godaddy-v7/assets/desk_viewer/media/intro.mp4`.

## Changes

- **Opening:** the first showcase rotation is exactly 360° over five seconds (12.4–17.4). Removed the old compensating 45° turn. Broader framing keeps the rotated desk and final standing pose within the picture.
- **Artist studio:** the monitor’s creative-angle notification now derives its angle from the same movement sample as the desk; it no longer announces a 65° easel angle while the board is at 45°. The chapter caption was also rewritten to describe drafting and digital art without claiming a 65° pose.
- **Proximity:** the 4.4-second camera position was moved outward and widened to give the desk more clearance during the descending camera move.
- **Gaming:** the task chair was moved away from the side table. Inspected world-space bounding boxes show approximately 0.39 units of separation along Z, and the rendered contact sheet was reviewed.
- **Movie night:** modestly raised environment, fill, and practical lighting so furniture remains readable while preserving the dark window and screen focus.
- **Audio:** retained the original score and added 18 quiet movement textures aligned with desk motions. Measured -16.05 LUFS integrated and -1.90 dBTP.

## Scope and preservation

This is a separate film review cut. It does not overwrite the supplied GoDaddy build, the earlier HQ3 movie, or the user's browser-saved Director project. Seven unchanged chapter renders are reused by symlink. Revised source shots and monitor media live in this export directory. The 12-chapter runtime and transition timing remain 173.5 seconds, preserving score and title synchronization.

Verification: all chapter movement schedules fit their duration without same-lane overlap; opening yaw advances exactly 360°; camera samples are finite. Selected updated frames were inspected for composition and clearance. This is a targeted visual pass, not a comprehensive collision solver for every editable room layout.
