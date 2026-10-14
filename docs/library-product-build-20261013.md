# Library Product build and free item placement

The Library environment imports the owner's saved Library & study Product
recipe for each desk's 48/60-inch width. It includes finishes, accessories,
accessory materials and exact positions, added library objects, and every
artwork surface. The size-specific Product revision is stored with the desk;
subsequent environment edits remain until a newer Product recipe is saved.
Importing a build preserves room location, posture, lighting and Groove routines.

Additional and inactive desks have their own clipped artwork meshes, using the
same surface mapping and image painting as the Product editor. Graphics follow
lift and tilt, do not affect desk anchors, and own their geometry, material and
texture resources. Asynchronous artwork loads are discarded after disposal or
when superseded. Room artwork editing remains separate from Product presets.

Rearrange items now allows dragging and rotating objects through other items and
desks. Item dragging does not push neighbours. Room bounds and wall attachment
remain. Fixed desk bodies do not block picking editable objects; ordinary desk
motion still uses its existing collision checks.

Verification:
- `npm run test:library-product-build`: five Library layouts, both widths, three
  decal surfaces, Product accessory placement, additional desk graphics, lift/
  tilt attachment, independent room artwork edits, and restoration after reload.
- `npm run test:free-items`: real pointer drag through a cabinet and desk, overlap
  rotation, no neighbour pushing, one edit per drag, room boundary, editing off,
  and normal desk motion collision.
