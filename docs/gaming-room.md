# Gaming in Studio

Open `index.html?room=gaming&view=room&layout=house&tour=1&v=gaming-sessions-20261022` or choose **Gaming** in the scene bar.

Gaming uses the measured Home Office framework, with independent architecture, lighting, furnishings and saved edits. Evening is the initial activity; subsequent choices are remembered locally.

| Room | Interior floor | Ceiling |
| --- | --- | --- |
| Apartment gaming nook | 2.8 × 3.2 m | 2.6 m |
| Dedicated gaming room | 3.6 × 4.2 m | 2.7 m |
| Gaming & streaming room | 4.2 × 4.8 m | 2.8 m |
| Gaming lounge | 5.2 × 5.8 m | 3.0 m |
| Entertainment suite | 6.5 × 7.0 m | 3.2 m |

## Activity pass — 22 October 2026

| Activity | Room and tabletop cues | Desk posture |
| --- | --- | --- |
| Morning reset | OFFLINE sign, charging cable and folded cleaning cloth, quieter RGB and morning daylight | 43.5″ / −5° |
| Practice & stream | ON AIR sign, stream run sheet and pen, balanced key light | 28″ / 0° |
| Co-op adventure | CO-OP sign, save notes and spare coasters, warmer lounge lighting | 28″ / 0° |
| Solo exploration | QUIET sign, small charging tray and earbuds case, reduced RGB and key-light intensity | 28″ / 0° |
| Local game night | GAME NIGHT sign, four player colours and a score sheet, brighter shared areas | 43.5″ / −5° |

Wall graphics and the status light update from the same activity state as the player valet. Their canvases are reused. The sign describes the illustrative room activity; it does not indicate an actual broadcast. Existing monitor/TV themes and the **Screens** controls continue to operate independently.

Selecting an activity stages the room and prepares its movement routine. **Start Groove** moves the desk and changes its posture. The compact room uses smaller authored movements that fit both desktop widths; saved custom Groove destinations retain priority.

## Layout and materials

- Smoked wood floor, walnut acoustic slats, neutral graphite walls, brushed metal, fabric trays and upholstered seats.
- Softer evening and night RGB preserves material contrast and reduces glare from wall panels and practical lights.
- The apartment PC cabinet is narrow enough for the 60-inch desk. Its floor lamp has moved away from the side entry.
- Larger layouts use the open front as their entrance, with a visible threshold and clear approach. The old side doorway no longer sits behind the sofa.
- Desk and lounge rugs maintain a gap instead of overlapping.
- The two largest rooms have a pair of padded stools at the game table. The table moves back from the entrance, and its existing controller follows it.
- The activity poster is raised above the arcade cabinets in larger rooms.
- Four practical lights and the shared sun shadow map remain the lighting budget.

## Desk sizes, editing and restoration

The 48- and 60-inch desk choices are independent of room size. Furniture retains its physical dimensions. Each room layout and desktop size keeps the existing separate build state.

Room calibration stays tied to the layout's reference desk width, so importing a saved smaller desk does not change the room's physical scale. Project restoration checks both the desk anchor and the physical base position.

The new player valet is an editable child of the coffee table or ottoman, so it follows that furnishing when moved, rotated or scaled. Its hidden parent stays hidden when activities change. Old uniquely named fixture edits and deletions are recovered when a procedural list index changes. Only exact untouched legacy positions of the moved lamp, game table, controller, rugs and raised artwork migrate; custom positions, rotations and scales are preserved. Product builds are not changed.

## Verification

- `node tests/gaming-room-test.cjs`: five layouts, both desktop widths, physical bounds, five postures, independent edits and project restoration.
- `node tests/gaming-groove-test.cjs`: 50 route combinations, including segment clearance for both widths.
- `node tests/gaming-sessions-test.cjs`: 25 layout/activity combinations; entrance and seating clearance, rug separation, changing graphics, stable lighting, hidden objects, attached decor and legacy-placement migration.
- `LIGHTING_SCENES=gaming node tests/room-lighting-test.cjs`: physical material UVs, light/shadow coverage, grounding and resource disposal.
- `REALISM_SCENES=gaming node tests/environment-realism-test.cjs`: physical materials, activity supports and edit stability.
- Visual review: `scene-shots/gaming-sessions-20261022/`.

This is a local update; the website has not been published.
