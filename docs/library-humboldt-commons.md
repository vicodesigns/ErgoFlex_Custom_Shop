# Humboldt-inspired Library commons — 15 October 2026

A sixth Library layout, **Humboldt-inspired commons** (`?room=library&layout=humboldt`),
recreates the ground-floor commons of Cal Poly Humboldt Library from the owner's
reference photos. The owner's ErgoFlex desk stands at the spot they marked:
against the right wall, just left of the long tackboard, where the red armchair
was. It is inspired by the space, not a survey. It has no names, logos or signage.

Built from three expert specs (architecture, lighting design, materials), then
reviewed by an independent expert. Code: `library-humboldt-commons.mjs`.

## Space (mm, room-local)

- 18 000 × 21 000 × 7 200 double-height commons. Back wall at z −7 000, open
  front at z +14 000. The real space is about 30 m deep; depth is compressed to
  about 0.7, while furniture keeps real sizes.
- **Back wall:** white, a full-height glass bay between two grey columns, and
  wall-washer scallops.
- **Right wall:**
  - a glass slot with an olive column;
  - the **desk bay**;
  - a 3.6 m tackboard (four panels, aluminium trim);
  - an olive pilaster.
  - A 3.6 m soffit band with recessed downlights runs above it. A clerestory
    wall with grilles and a linear grazer faces the commons.
- **Left wall:** plain wall, a mezzanine balcony at 4.2 m with a bronze guard
  and an oak cap, then the olive gallery wall with two generic landscape
  prints and a blank placard.
- **Front:** a café strip under a 3 m soffit along a glass curtain wall.
- **Floors:** charcoal carpet-tile planks in an ashlar pattern across the
  commons, and a beige broadloom band, with a dark reducer strip between them.
- **Furniture:**
  - seven study tables (pale maple tops, honey-oak legs; one light laminate
    project table), with 32 seats;
  - six round oak café tables, with 18 seats;
  - lounge chairs (charcoal, and raspberry red), rolling whiteboards, bins
    and plants;
  - a carved redwood canoe on a long white plinth, and three abstract white
    figures on plinths. All are generic, with no motifs or text.

## The desk

- `desk: [8240, -1850]`, `deskTurn: -90`.
- The desk's long side runs along the wall. The user sits on the room side,
  facing the wall, with a task chair.
- Both 48×30 and 60×30 fit between the glass slot and the tackboard, with
  300 mm to each and a 2.5 m aisle in front.
- `positionHomeDesk` now adds `layout.deskTurn` to the desk yaw. Other layouts
  default to 0, so they are unchanged.
- Groove poses come from `layout.groovePoses`, relative to the desk; every
  routine steps back into the room (−x) and never into the wall.
  `grooveDestination` uses them before its generic rules.

## Lighting (five dayparts, `HUMBOLDT_MODES`)

- North Coast overcast by day: a soft key and a higher ambient share.
- **Evening** matches the reference photo: all frames and washers on, at
  3500 K.
- **Late study:** the second frame circuit is off, the glass is a dark mirror,
  and the desk's own wall scallop and pool stay up.
- **Commons event:** full frames, with the canoe and the figures lit.

Fixtures:
- Three suspended black frames (a 2×2 grid plus two rectangles), on two
  circuits.
- 41 recessed downlights, as two instanced draws.
- Washers and the tackboard wash are additive light pools, merged per level.
- **Exactly five PointLights, none casting shadows:** desk task (within
  1.4 m of the desk), the commons frame grid, the back tables, the canoe
  and figures, and the long table run (dimmed at late study).

**VSM note.** With VSM shadows, three.js also draws shadow *receivers* into the
shadow map. So the frames, soffits, glass and trim are set to neither cast nor
receive. The shell walls are kept out of the shadow pass as well, so daylight
reads as entering through the glass rather than the 7.2 m back wall shading the
whole commons. Furniture, plinths and the canoe still cast.

## Integration

- `library-room.mjs` appends the layout to `LIBRARY_LAYOUTS` and hands
  `layout.humboldt` to `buildHumboldtCommons`. The five existing layouts are
  unchanged.
- `studio.js` uses `layout.modes` when present, so the commons has its own
  dayparts.
- `room-life.mjs` maps `layout.tier` (`'executive'`) for daily-life detail.
- **Chairs:** placements use `kenney-furniture-chair-modern-cushion`, so the
  Library's seating replacement applies. `decorateProp` gives them honey-oak
  frames and dark aubergine-charcoal pads. Conference chairs are tinted by
  `conferencePart`.

## Test

`node tests/library-humboldt-commons-test.cjs`

## Independent review pass (same day)

An independent reviewer rated the first build about 6/10 against the photos.
Every fix below was applied, except pinning the graphite side-chair family,
which lives in another session's seating module.

- **Ceiling:** a sloped white plaster ceiling (4.8 m at the back wall, rising
  to 7.2 m by z 5 000) with frame uplight on it. The glass bay is lowered to
  4.6 m to meet it.
- **Brighter dusk:** evening exposure 1.22, a lighter olive (`#7d7e68`) and
  lighter bay columns, a neutral grey floor tint (`layout.finish`), and a
  night backdrop at the commons event.
- **Canoe:** moved beside the gallery wall (x −5 000). It is deeper, with
  rounded ends, two cradles that meet the hull, a warm matte redwood finish
  and grain along the hull. The photo-match camera is eye [−6600, 1500, 11300]
  → target [1025, 1000, −442], fov 45.
- **Window view:** the campus photograph is replaced by a drawn North Coast
  view (marine-layer sky and conifers). Each pane samples it at its own
  aspect.
- **Dayparts:**
  - real daylight pools by day;
  - darker late study;
  - brighter event, with the canoe and figure light (L4) moved to reach them;
  - a gallery track with four heads.
- **Frames:** matte black, with only a narrow, dim down lens.
- **Figures:** angular abstract figures (standing and seated) on taller
  plinths.
- **Desk:**
  - nudged to z −1 850, under the red dot;
  - task light moved back from the wall, with a softer wall scallop;
  - `room-life.mjs` turns the chair's routine offsets by `deskTurn`, so the
    chair pulls back from the desk instead of sliding along the wall.
- **Finishes and safety:**
  - tackboard: evenly lit tan, raised 150 mm, honey-oak trim;
  - neutral warm-grey carpet tile;
  - uniform broadloom;
  - dark upholstered chair backs;
  - mezzanine guard infill at 100 mm.
