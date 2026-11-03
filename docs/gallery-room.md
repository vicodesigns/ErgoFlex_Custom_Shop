# Gallery

Preview: `index.html?room=gallery&view=room&layout=spacious`.

| Room | Floor size | Ceiling |
| --- | --- | --- |
| Apartment art collection | 4.0 × 4.6 m | 2.8 m |
| Home collector gallery | 4.8 × 5.8 m | 3.0 m |
| Art gallery & curator studio | 6.2 × 7.2 m | 3.2 m |
| Private collection & exhibition salon | 8.0 × 9.2 m | 3.5 m |
| Grand gallery & sculpture hall | 10.0 × 11.8 m | 4.0 m |

Pale stone floors, ivory walls, slim black frames, brass picture lights and oak
benches form a contemporary collection space. Original canvas art includes a
landscape, orbital line study and colour-field composition, with individual
editable frames and collection labels. A daylight corner supports the main
ErgoFlex desk and a Steelcase chair.

Library sculptures retain their native physical dimensions: The Thinker sits
on an 850 mm plinth, the antique vase on a 1 m plinth, and the larger rooms add
Aphrodite and Mercury on 120 mm bases. Larger tiers add collector seating,
a glass exhibition case and sofa salon. The largest adds an original bronze
ribbon sculpture and freestanding exhibition panel.

Morning, Afternoon, Evening, Night and Opening night adjust room light, desk
placement, lift, tilt and LEDs. Evening angles the desk for sketching; Night
turns desk LEDs off while keeping artwork illuminated. Four practical lights
and ceiling track fixtures complement daylight without adding shadow maps.

Room size and desktop width can be selected independently. Layout edits and
modes are stored per room and preserved through project export/import.
Full-floor Glide respects room boundaries; furniture collision avoidance is
not simulated. Inspiration props do not affect pricing or AR export.

Verification: `npm run test:gallery`. The screenshot helper supports
`--gallery-layout` and `--gallery-mode`. The website package file list includes
the module. This local update does not publish it.

## Curator and visitor detail — 25 October 2026

Every layout now has a shallow oak curator ledge beneath the main exhibition
hang. Its five editable daily settings show condition notes and colour proofs,
a collection audio guide, a sketching roll, closed archival storage, or an
opening-night guestbook and invitations. The wall programme changes with the
activity. Objects remain children of the ledge/setting when moved or hidden.

Sculpture plinths have printed collection labels. The daylight blind lowers
through the day; after-hours lighting keeps the displays readable with softer
neutral illumination and a lower desk task light. No additional light sources
or floor furniture were added. Existing artwork and saved furniture identities
are retained.

Checks: `node tests/gallery-bedroom-sessions-test.cjs` and
`node tests/gallery-bedroom-groove-test.cjs`. Together these cover every layout,
all five activities, tabletop/fold bounds, independent light states, hidden
settings, attached contents and both desk widths (100 planned routes across
Gallery and Bedroom). Visual review: `scene-shots/gallery-bedroom-20261025/`.

Verified 25 October: all detail/contact checks and all 100 combined movement
route checks passed. Fifty layout/activity states rendered without browser
errors or missing props; final printed-detail and cloth-drape close-ups included.
