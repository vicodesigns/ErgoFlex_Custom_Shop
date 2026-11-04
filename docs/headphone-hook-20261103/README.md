# Plug-mounted headphone hook

The owner's 116.6 mm hook and non-threaded plug are imported at their original dimensions. The supplied print STL is the tessellation of the matching STEP design. Its local axes are converted to a metre-based GLB with the plug face at the origin, the arm pointing outward along +X, and the retaining lip upward along +Y. The original source files remain untouched; copied source files are in `models/supplied/headphone-hook`.

The circular accessory hole is measured in the CAD side panel. Its radius is approximately 14.404 mm; the plug shaft radius is 14.148 mm. The plug uses polished aluminum to match the desk connectors; the hook remains charcoal. The shaft passes through the approximately 18.1 mm panel and the flange remains inside. These are visualization measurements, not a manufacturing tolerance validation.

Headphones use the existing, intact `assets/props/headphones.glb` model, without a conversion or geometry replacement. The hook is a separate selectable Desk object. Main desks use black cushions and shells with silver hinges and trim. Secondary media desks use black, white or silver finishes on the same geometry. Material instances are cloned so other scene objects are unaffected.

Two manually rotated OCC placements were recovered from the 2026-11-04 05:17:29 UTC project autosave. Reparenting these headphones to the non-tilting shelf preserves their original world position and orientation. Unedited headphones receive a 90-degree hanging pose. The one-time migration marker is serialized, so subsequent user adjustments survive reloads; deleted objects stay deleted. Hook positions are not stretched when changing desktop width.

Validated seven environments at both 48- and 60-inch widths (14 combinations), including all eight headphone-equipped desks in the tested OCC production lab. Every hook matched a measured socket. The original headphones and hook were visually checked with the desktop flat and at 45 degrees. The generated report is `environment-checks.json` and the screenshot is `original-headphones-hook.png`.

Checks: `node tests/headphone-hook-assets-test.mjs` and `node tests/scene-desk-data-test.mjs`.
