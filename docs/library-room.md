# Library

Preview: `index.html?room=library&view=room&layout=house&v=library-realism-20261011`.

This is a campus-library concept for the student ErgoFlex pilot, not a measured
reconstruction of the Cal Poly Humboldt library. It retains the established oak,
forest green and brass language while giving each scale a believable mix of
collections, individual study, shared research and library services.

## Rooms

| Room | Floor size | Ceiling | Bookcases | Shared reading tables | Quiet carrels | Research computers |
| --- | --- | --- | --- | --- | --- | --- |
| Student pilot study nook | 5.4 × 6.6 m | 3.0 m | 1 | 1 | 0 | Catalog terminal |
| Campus reading room | 7.2 × 9.0 m | 3.1 m | 4 | 1 | 0 | Catalog terminal |
| Learning commons | 10.0 × 12.0 m | 3.4 m | 7 | 2 | 2 | Catalog + 2 research seats |
| University study hall | 13.0 × 16.0 m | 3.8 m | 13 | 3 | 4 | Catalog + 2 research seats |
| Flagship library commons | 18.0 × 20.0 m | 4.4 m | 22 | 4 | 6 | Catalog + 2 research seats |

Every room includes a catalog terminal on the original drawer cabinet, a book
return cart, a face-out current periodical display and consistent shelf-end and
quiet-study signs. Larger rooms add a low research-help / self-checkout counter,
a two-seat research table with keyboards and cable management, and a separate
print/scan cabinet. The two largest rooms add a movable discussion whiteboard.

The learning and flagship commons use subtle woven carpet tiles and acoustic
wall panels. The smaller rooms and university study hall retain herringbone oak.
Seating has muted fabric and dark metal frames rather than bright blue plastic
finishes. Shelves retain their instanced books and gain broad illustrative
Library of Congress subject letters. Signage, journals, databases and screen
content are original preview graphics, not real catalog records or services.

The stack spacing in the reading room and learning commons was adjusted to
improve circulation. Additional seating occupies the previously sparse shared
study area; it is kept away from the research-help counter and window carrels.
This scene design is not a certified building or accessibility plan.

## Dayparts and activity

| Setting | Staging and atmosphere |
| --- | --- |
| Morning | Opening returns, fresh reading materials, daylight, clock 09:15 |
| Afternoon | Catalog/database research, reference notes, neutral task light, clock 14:20 |
| Evening | Open research notes, softer warm reading light, evening quad, clock 18:30 |
| Late study | Tidied reserved reading, dimmed screens, self-service counter display, quiet task light, clock 22:10 |
| Study group | Shared sources and discussion notes, collaborative whiteboard, clock 16:00 |

The visible service-counter materials, terminal displays, discussion board and
clock follow the chosen setting. These are authored scenes, not live occupancy,
opening hours or a functioning checkout system. Existing RoomLife reading kits
and reversible chair staging continue to operate. The campus window includes
masonry, a recessed entrance, outdoor seating, bicycle hoops and daytime
pedestrian silhouettes; its sky and exterior lights follow the setting.

The warm task-light colours are less orange than the earlier version. The
larger rooms devote a practical light to the research/carrel zone. There are
four room point lights in the smaller rooms and five in the larger rooms,
without adding local shadow maps. Detail fittings are merged into geometries;
books remain instanced; display textures redraw only when the daypart changes.

## Editing and compatibility

- Existing fixture IDs and all original native-prop placement indices are
  retained. New chairs and reading props are appended to the original list.
- New floor furnishings are registered for rearranging, collision and project
  saves. Equipment is built into its supporting table/cabinet, so it follows
  the furnishing when moved.
- Acoustic treatment stays attached to architecture and cannot become a floor
  obstacle. Ceiling additions belong to the existing ceiling cutaway group.
- Desk sizes, independent desk selection, object editing and saved Groove
  positions continue to use the shared scene systems. Changing a daypart does
  not reset a user's counter or technology-table placement.
- Room furnishings do not affect the desk purchase price or AR export.

## Design references

Clear, consistent and welcoming signs follow the principles described in
[ALA's library signage and wayfinding guidance](https://www.ala.org/news/2021/10/ux-principles-library-signage-and-wayfinding-design).
The quiet and shared zones, acoustic treatment and separate support equipment
reflect ALA's emphasis on space management, noise and user comfort in its
[Equipment and Facilities resources](https://www.ala.org/tools/atoz/equipandfacilities/equipfacilities).

## Verification

`npm run test:library` checks all 25 layout/daypart combinations, both desk
widths, posture modes, book batching, furniture bounds and surface contact,
interaction registration, clock changes, service activity selection, editing
and project restoration. Original native-prop ordering was also compared with
the previous implementation to check saved-placement compatibility.

Render the complete matrix with:

```sh
node tools/props/daypart-review.mjs --only library \
  --layouts apartment,house,spacious,premium,executive \
  --out /tmp/ef-library-20261011 --ratio .85
```

The renderer reports added-furnishing overlaps, missing assets and shader/page
errors. Use `--layout spacious --focus digital-research-table` for close detail
review. The local update does not publish a site upload.
