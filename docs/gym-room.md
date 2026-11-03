# Home Gym

Preview: `index.html?room=gym&view=room&layout=house&tour=1&v=gym-sessions-20261022`.

| Room | Floor size | Ceiling |
| --- | --- | --- |
| Apartment training nook | 3.2 × 4.2 m | 2.6 m |
| Dedicated home gym | 4.2 × 5.4 m | 2.8 m |
| Strength & cardio studio | 5.2 × 6.4 m | 3.0 m |
| Performance gym & recovery | 6.4 × 7.8 m | 3.2 m |
| Private wellness suite | 8.0 × 9.0 m | 3.4 m |

## Activity pass — 22 October 2026

| Activity | Floor equipment and displays | Lighting and ErgoFlex posture |
| --- | --- | --- |
| Morning mobility | Mat, cork blocks, strap and folded towel; MOBILITY board / READY timer | Soft morning light; standing coach station |
| Afternoon strength | Training rig and paired dumbbells; STRENGTH board / WORK timer | Bright neutral daylight; standing workout log |
| Evening recovery | Mat, ribbed foam roller, massage balls and towel; RECOVERY board / EASE timer | Warmer lamps and softer accents; lowered desk for notes |
| Night reset | Loose training equipment stowed; RESET board / REST timer | Subdued lighting; 65° storage posture at 43.5 inches to clear both desk widths |
| Power circuit | Training rig, free weights and six lane cones; CIRCUIT board / ROUND timer | Brighter training light with muted accents; standing desk facing the training bay |

The board and timer are scene dressing, not a running workout timer or prescribed exercise programme. Textures update in place when an activity changes. Training equipment changes with the selected activity; select **Start Groove** to drive the desk through its prepared route and posture.

## Placement and finishes

- Charcoal rubber flooring, timber wall slats, powder-coated equipment, brushed grips, fabric towels and cork blocks.
- Weight labels, wipe-down supplies, recovery towels and movement-study artwork add signs of daily use.
- Recovery seating leaves the entry approach clear. A narrower apartment hydration cabinet also clears the 60-inch desk. The spacious training bay clears the rack; the premium equipment shelf clears the treadmill.
- Exercise machines and recovery seating stay in their measured bays across activities. Small desk movements remain within the coach area.
- Larger tiers add an indoor bike and incline bench, Olympic rack, treadmill and freestanding boxing station.
- Four practical lights supplement the shared directional lighting; no additional shadow maps.

## Editing and persistence

Room choice, activity and asset edits save independently and survive project export/import. Both 48- and 60-inch desks retain their physical scale; architecture and furnishings do not resize with the desk.

The session equipment is an editable child of the training bay. Moving the bay carries it along. Hiding or deleting its parent remains respected when activities change. Original editor identities are retained. Only saved transforms that exactly match obsolete default positions migrate to the corrected bays; custom positions, rotations and scales remain intact. Product presets are not modified.

## Verification

- `node tests/gym-room-test.cjs`: five room sizes, both desk widths, all postures, bounds, editing, project restore and mobile controls.
- `node tests/gym-sessions-test.cjs`: 25 layout/activity combinations; equipment and entry clearance, changing displays, repeatable lighting and saved-transform migration.
- `node tests/gym-groove-test.cjs`: both desk widths, all five layouts and five activities; route planning and segment clearance.
- `REALISM_SCENES=gym node tests/environment-realism-test.cjs`: materials, surface contact and activity stability.
- `LIGHTING_SCENES=gym node tests/room-lighting-test.cjs`: physical texture UVs, lighting, shadows and resource disposal.
- Review captures: `scene-shots/gym-sessions-20261022/`.

This local update does not publish the website.
