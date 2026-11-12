# Director: props on the timeline, props per desk (November 11, 2026)

Vico's request: in the finale he could not work on the props of each desk. The Props lane was empty, a prop had
no start or end, and a change to an item changed every desk that has an item of that name.

## What the Director does now

**Props lane.** The lane at the bottom of the timeline holds one bar per prop over the seconds it is on screen:

- the featured desk's own items (dashed outline: as the film has it),
- every prop that was moved, turned, scaled, hidden or timed (solid),
- every prop added from the library (blue, with a +).

Click a bar to select the prop: the playhead goes into its seconds if it is outside them, the gizmo and the Prop
inspector open. Drag a bar's end to set when the prop appears or leaves (tenths of a second); drag the middle of a
timed bar to move it. The lane grows with its rows and scrolls past nine.

**On screen (Prop inspector).** Appears at, Leaves at, Fade in, Fade out, in chapter seconds, plus "Appear at
playhead", "Leave at playhead" and "Whole time". A prop added with "+ Prop" comes in at the playhead (from the start
when the playhead is within half a second of it).

**The finale: every desk has its own props.** The finale is rendered as sub-shots, one desk each. Under each desk's
stretch of the Desk versions lane the Props lane lists that desk's items. They are read from the stage, so a desk's
bars appear once it has been on stage (until then its stretch shows "click to see its items"; they are kept for the
browser session). An edit made while a desk is on stage belongs to that desk: the Office desk's wide monitor can leave
early or move without the Gaming desk's wide monitor changing. The edit follows the desk when the desks are reordered,
and holds each time that desk appears. While another desk is on stage a selected prop has no gizmo, and its
inspector says which desk it belongs to.

**Shelves.** An added prop can sit on the desktop, the top shelf, the lower shelf or the base shelf ("Put it on" in
its inspector, or "Place on a surface…" and a click on the shelf). It rides that surface through lift and tilt.

## Data

A prop edit (`shot.propEdits`, `experience/prop-edits.mjs`) has two new optional fields:

- `desk: '<preset id>'` — the edit holds only in the sub-shot whose desk is that model. Without it the edit holds
  for every desk of the chapter (edits made before this change keep working that way). The desk is part of the
  prop's key, so layers and selections tell the two apart.
- `show: {from, to, fadeIn?, fadeOut?}` — seconds. Chapter seconds; for an edit with a `desk`, seconds after that
  desk's sub-shot begins (its `renderRange` start), which is what makes the timing travel with the desk. `to: 100000`
  means "until the desk or the chapter ends". A window alone is an edit.

- an added prop's `parent` may be `desk` (the desktop), `shelf`, `lower-shelf`, `base-shelf` or `room`.

## Stage and film

`tools/experience/film-edits.mjs` applies both, on the live stage, in Render still and in the film, with the same
code:

- an edit whose `desk` is not the shot's `preset` is skipped;
- a timed prop is not drawn outside its window (a getter over `visible`, on top of any hide);
- while a fade runs its meshes wear see-through copies of their materials (shared maps, so a playing screen keeps
  playing); outside a fade the original materials are in place, so nothing changes for props that are simply on.

No existing chapter changes: only edits that carry the new fields use the new code.

**The importer** (`tools/experience/build-round8-director.py`) keeps `desk` and `show`, and now
writes the Director's props into every sub-shot of the finale (`shots/13-subshots.json`) as well as the chapter's own
shot. Before this, prop edits made in the finale never reached the rendered sub-shots.

## Tests

- `tests/prop-timing-test.mjs` — cleaning, keys and layers; film-edits in node (another desk's edit skipped, drawn
  only in its window, fade copies, restore); the importer's round trip into every sub-shot.
- `tests/director-finale-props-e2e.mjs` — the finale in a real Director: the lane per desk, a bar's click and drag,
  the prop leaving on the stage, a typed fade, Whole time and Undo, an edit kept to its desk.
- `tests/director-props-e2e.mjs` — the lane assertions follow the bars.

The e2e tests need the film's screen videos under `exports/**/screens/` (git-ignored); in a fresh worktree link them
from the main checkout, otherwise the finale's desks fail with "The desk version could not load".

## Not in this change

- The film render of a timed or per-desk prop has not been rendered end to end; the stage and Render still use the
  same film-edits code as the render.
- Colours or material variants per prop.
- A prop's bars for a desk that has not been on stage in this browser session.
