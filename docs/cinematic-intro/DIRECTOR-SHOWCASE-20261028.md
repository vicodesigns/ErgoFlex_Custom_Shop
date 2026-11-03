# Director showcase — 28 October 2026

A separate editable 218-second cut, available under Project → Director’s showcase · extended. Existing 85-second and 30-second cuts remain available. The template composes camera views against each actual loaded environment and saves the resulting cut locally.

| Chapter | Seconds | Editorial purpose |
|---|---:|---|
| Meet your digital twin | 14 | Wheel detail, roll, strafe, turn, rise, hero landing |
| Your height. Your rhythm | 20 | Seated setup, comfortable standing, full 52.5-inch height |
| From focus to creation | 24 | Separate 25-degree drafting and 65-degree easel holds |
| A place for everyone | 20 | Commons establishing view, group-work route, shared-table result |
| Ideas become stories | 16 | OCC context, featured workstation, lab reveal |
| Make room for discovery | 16 | HBHS setting, desk detail, classroom reveal |
| Make movement part of your day | 20 | Reminder, lift, standing reset |
| Move with awareness | 18 | Simulated obstacles, sweep and movement |
| Feel the room come alive | 18 | Gaming setting and reactive lighting |
| Music. Media. In sync | 18 | Curved-screen video and ambient lighting |
| Make room for what’s next | 22 | Storage tilt, wall route, open-floor result |
| Your space. Reimagined | 12 | Gentle product reveal and final hold |

Camera views and movement blocks remain independently editable. Group/storage routes retain the actual planned route, with two seconds before movement and three seconds after. Feature camera bounds include sampled desk poses; closing views hold the final composition.

## Director improvements carried through this pass

Full-height inspector, stable field focus/scroll, direct Lift/Tilt/Turn/Travel/Hold controls, selected-movement playback and In/Out navigation, camera segment preview, frame desk/room, lens presets and orbit interpolation. Product default framing no longer uses the hidden room bounds. Mobile editing hides the unrelated Skip intro button.

## Findings and verification

- Browser-reviewed all twelve chapter compositions at representative demonstration/landing times.
- Found and fixed a presentation recipe bug that disposed neighbouring desk rigs. Only the featured desk is now rebuilt. Verified OCC and HBHS furnishings visually afterward.
- Offline checks passed for showcase schedules, exact lift/tilt endpoints, camera interpolation, clip timing/overlap, built-in movement conversion, cut persistence and original 85/30-second scores.
- Focused mocked recipe regression confirms neighbouring records and anchors survive.
- Prior Director audit exercised every movement type, recording, camera editing, undo/redo, responsive layouts and a successful 1080p bake.
- The broader scene-desks harness could not start its local test listener in this sandbox (EPERM); direct browser verification and the focused regression were used.
- Download receipt and file-chooser automation remain unverified from the previous audit; no claim of successful import/export delivery is made.
