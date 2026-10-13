# OCC Multimedia Art Lab — October 13, 2026

A proposed lab environment for Orange Coast College film and media work. This is a configurable concept, not a model of an existing OCC room.

## Where to find it

Choose **Scenes → OCC Multimedia Art Lab** in the Educational category. The room selector offers five arrangements:

| Room | Dimensions | Editable desks |
| --- | --- | --- |
| Project suite | 8.4 × 10.8 m | 4 |
| Teaching lab | 10.2 × 13 m | 6 |
| Production lab | 12 × 15.2 m | 8 |
| Collaborative studio | 13.8 × 17.4 m | 10 |
| Flagship media lab | 15.6 × 19.6 m | 12 |

The small suite has two pairs of workstations. Teaching and production labs use three-column arrangements; larger studios use four-column arrangements with an opposing final row for team work and wider shared production areas. Each version reserves a front capture and review zone and keeps equipment outside the right-hand entry path.

## Workstations and decoration

- Coast Navy surfaces, white or silver frames, Coast Orange trim and supplied OCC artwork.
- Film editing, sound mixing, digital illustration, colour grading, animation and open access editing roles.
- Single and dual monitor arms, keyboards, mice, trays and drawing tablets use the owner's saved Product placements. Each desk keeps independent 48″ and 60″ variants.
- Simulated project displays show editing timelines, colour views, coastal footage, audio tracks and portfolio review. A captured tab/screen video takes priority over the simulated display.
- A capture stage with a green backdrop, tripod camera, softboxes and floor marks.
- A student-reel screening display, review speakers and ceiling projector.
- Print/scan counter, colour proof swatches, hard-case equipment checkout and camera bag storage.
- Production storyboard board, student work, film posters, navy acoustic panels and sound diffusers.
- Voice/Foley corner in the four larger labs.
- Storyboard and critique table, seating, project slates, card readers, audio interfaces and nearfield speakers.

Five activities: **Pre-production**, **Edit & create**, **Sound & colour**, **Screening**, and **Portfolio critique**. These change simulated project content, practical light and staging. Ceiling preview and simulated bounced lighting work through the existing room controls.

**Hide lab controls** gives a clear presentation view; **Show lab controls** restores the room, time, size and desk tools. Separate desk/item rearranging and individual/group Grooves use the existing editing system.

## References

The workflow mix is informed by OCC's published [Film & Television facilities](https://orangecoastcollege.edu/academics/vpa/film-television/facilities-equipment.html) and [Digital Media Arts & Design facilities](https://orangecoastcollege.edu/academics/vpa/dmad/facilities.html). The layouts, furniture quantities and decorative project content are original concept choices.

## Verification

`tests/occ-media-lab-test.cjs` checks all five layouts, equipment and artwork, floor bounds, entry routes, workstation/furniture spacing and all five activities. Each workstation's own chair can tuck under its working surface. It also captures room and interior previews in the ignored local folder `scene-shots/occ-media-lab`.

The existing exhaustive width audit, run with `--scenes=occmedialab`, checks all 40 desks at both widths, reference accessory positions, monitor arm fit, separate edits, all five time scenes and reload.

```sh
node tests/occ-media-lab-test.cjs
node tests/scene-size-layouts-test.cjs --scenes=occmedialab
```
