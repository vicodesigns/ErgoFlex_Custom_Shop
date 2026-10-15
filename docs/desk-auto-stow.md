# Automatic desktop storage

The same controller runs on Product, the selected live room desk, inactive desks,
added desks, and desk Groove playback. It operates on the desk's registered
objects, including catalogue accessories and objects added through Desk objects.

## Angles and activities

- At 9° or below, the authored arrangement is shown.
- Above 9°, loose desktop items pack into the top shelving, then the lower bay.
  Large equipment can use the base shelf. Objects retain their original scale;
  flat supplies may stand in a file bay and bulky lamps may lie on their side.
- Drafting boards and drafting tools stay at drafting angles (10–49°).
- Artist canvases and the painter's tool shelf show at easel angles (50°+).
  Existing plan/review stations can use their art surface as a drawing board.
- Clamp lamps, easel rails, keyboard trays, cables, counter structures and other
  mounted hardware remain attached. Light pools are effects, never stored props.
- Rearrange items pauses automatic storage for the selected desk. Other desks
  continue to respond to their tilt. Turning editing off resumes storage.

Storage poses live only on runtime records. Capture, preset saves, size changes,
undo/project rebuilds and disposal restore/read the authored transforms. Lowering
restores the same parent, position, rotation and scale. Daypart visibility and
user removals are respected. Old procedural kits are temporarily separated into
connected pieces so paper, books and tools can pack neatly; their original mesh
and authored layout are kept. Broad paper sheets and flexible ESD mats roll for
storage; cables do not join separate devices into a single oversized object. Touching covers/pages and tool parts stay together.

Packing uses visible geometry in surface-local millimetres, not a guessed unit
conversion. Shelf occupants and mounted displays reserve space. The broad empty
span of a monitor arm is not treated as a solid box. The base shelf permits at
most 24 mm of overhang, allowing a large lamp to rest on its side. A genuinely
oversized user-added object that cannot fit is hidden temporarily and reported
as put away; lowering/editing restores it without changing its saved layout.

## Monitor-free workstations

Rooms with more than three ErgoFlex units initially assign about one third
(`round(count / 3)`) to shelf-first stations. Drafting, project, reading and
practical roles are preferred; the main, accessible and specialist editing roles
are deprioritized. The conversion removes external monitor/arm/webcam selections,
keeps finishes, graphics, desk poses and object edits, and adds individually
editable reference books, a paper tray and a clear tool cup plus an organizer.

The assignment is a one-time migration, persisted per desk and width. An unseen
width does not reintroduce a different monitor or arm model. Existing width
setups are migrated together. Later owner additions and shelf edits remain
editable and survive reload. Library Product recipe refreshes preserve the
shelf-first role while importing the owner's finishes and graphics.

## Verification

Run `npm run test:desk-auto-stow`. It uses an isolated local browser/server. It
checks the 9° boundary, Product recipes, every registered environment at both
widths, active and inactive desks, shelf bounds and overlap, exact authored
placement restoration, monitor-free proportions and width switches, owner edits,
removals, and reloading while tilted. Tests never modify the user's browser data.

Verified on 2026-10-14: ten Product recipe/width combinations and 56 room/width
combinations across 28 environments passed without default-item storage overflow
or authored-placement changes. Inactive rigs, monitor-free width changes and
owner shelf edits/removals were checked. The final tilted save/reload check passed
separately after the long combined browser run reached its execution limit.
