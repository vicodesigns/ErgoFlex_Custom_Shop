# Early-years rooms: lived-in play and daily routines

This pass focuses exclusively on the early-years stage, across all five sizes and daily activities. Older stages retain their existing furnishings and activity recipes.

## Room progression

- Every size gains a bedside book/water cabinet, a short linen sleeping canopy, filled and labelled toy baskets, and a gallery of current drawings.
- House and larger layouts add a second soft seat for shared stories and a striped canopy/picture menu for the existing pretend market.
- Spacious and larger layouts add a complete pretend kitchen with low worktop, fridge, oven, sink/tap, picture recipe and changing play materials. A shaded pendant lights the making zone.
- Premium and larger layouts add a small-world house, wooden characters and a separate kneeling mat.
- The largest discovery room adds a wooden-sound and nature-shape bench, with a xylophone, drum and leaf tray.

The larger floor plans therefore acquire distinct zones rather than simply expanding the empty space around the same bedroom furniture. Stable per-layout editor IDs allow the new furnishings to be rearranged; existing owner transforms are not reset.

## Daily activities

Morning presents building/sorting and breakfast play. Afternoon shows active drawing, a bridge in progress, a wooden delivery truck, cooking and small-world play. Family play adds a railway village and shared stories. Evening returns play materials to their places and emphasizes the reading corner. At bedtime the making pendant is off, the play mat is clear, supplies are packed and the wooden characters are put to bed. Existing nightlight/reading-light behavior remains intact.

## Validation

`npm run test:environment-finishes` now uses the actual RoundedBox geometry helper used by the visualizer. It covers all25 stage/size recipes and five phases, including the five early-years layouts. Checks include new furniture ground contact, actual geometry enclosed by registered floor footprints, room boundaries, furniture separation, direct desk routes between authored activity poses, phase state and bedtime lamp behavior.

Scene-desk persistence and child-screen tests also pass. The authored pearl-white desk and editable owner arrangements remain available.

A new **Check early years** button in `tools/child-growth-review.html` provides a25-case browser review with captured stills and a report. Browser verification for this pass was blocked: automatic approval review rejected opening the local review origin because the browser tool reached its usage limit. No rendered screenshot is claimed for this pass. Local geometry/code checks were completed; visual review remains outstanding.

Follow-up: the later [five-interest specialist pass](../early-years-portraits-20261104/README.md) completed all25 browser review cases after the browser limit cleared. Its report and rendered evidence cover the current early-years room code.
