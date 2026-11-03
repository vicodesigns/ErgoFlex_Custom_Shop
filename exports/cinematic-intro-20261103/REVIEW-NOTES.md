# Intro refinement HQ5

Baseline: HQ4 (`cinematic-intro-20261102/final/ErgoFlex-Intro-1080p-HQ4.mp4`). HQ3 and HQ4 are untouched.

## Changes since HQ4
- **Chapter 2 (rise, home office):** the Surface Pro (`tablet-pc`, film-fx default x -330 / z 230) sat on the notebook ("Groove tabletop · daily materials") and against the portrait-monitor base. Moved to x 10 / z 230 (+34 cm), so there is a visible gap. Re-rendered.
- **Chapter 11 (storage):** the task chair's box overlapped the desk by 14 cm while the desk stowed. Moved 0.3 m away (`sceneEdits` +0.3 on z). Re-rendered with the college decal seed, so the desk still reads "Cal Poly Humboldt."
- Other chapters are reused from HQ4/HQ3 renders by symlink.

## Movie night (chapter 10)
Vico's review described HQ3 as "warm pink, correct" and HQ4 as "dark, blue". The real files say the opposite. At 2:16 HQ3 is the dark blue one and HQ4 is the warm pink one, and the player buttons in the screenshots agree (pink = "Latest refinement · HQ4"). HQ5 keeps HQ4's chapter 10 render and shot file unchanged.

## Clipping audit
Tool: `tools/experience/clip-audit.cjs` (world bounding boxes at 13 times per chapter, then contact sheets of the flagged chapters). Boxes are axis aligned and conservative: chairs pushed under tables, monitors on arms and items resting on surfaces always overlap, so flags were checked by eye.
- Clean: 1, 8, 12.
- Fixed: 2 (Surface Pro vs notebook), 11 (chair vs desk).
- Looked at, left: 5 (neighbouring-station chair in the foreground of the lateral dolly: parallax, no contact), 4 (books vs monitor arm: no visible contact), 3 (bust against the drafting board edge), 7 (Surface Pro vs monitors: no visible clip), 9 (floor lamp vs sofa box: not visible), 10 (kept as HQ4).
- Not covered: fine-grained mesh intersections; the audit is boxes plus eyes, like the HQ4 pass.

## Build
`finish-intro.py exports/cinematic-intro-20261103 --wip`, then the WIP mp4 copied to `ErgoFlex-Intro-1080p-HQ5.mp4`. Score and titles as in HQ4. Poster copied from HQ4.
