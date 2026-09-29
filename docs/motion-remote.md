# The motion remote

The movement controls are a replica of the ErgoFlex Desk app's **motion
surface**, floating over the 3D viewer and driving the model the way the phone
drives the real desk.

## Why it floats

`syncViewerSize()` used to derive the canvas height by *subtracting* the panel's
height, so the desk was rendered into whatever space was left above it — about
283px of viewer given up to the controls.

That coupling also caused a second, subtler problem. The lift, tilt and glide
panels were different heights (202 / 166 / 283px), so switching between them
resized the canvas and shifted `camera.aspect`, and the desk visibly jumped. The
fix at the time was to reserve the tallest panel's height for all of them —
which stopped the jumping and left the Lift tab showing a large dead area,
because Lift was paying Glide's price.

Both symptoms had one cause. **The canvas is now sized from the viewer alone**
and the panel floats over it, so:

- the desk gets the full height back;
- the reservation and its `--motion-dock-reserve` property are gone, along with
  the `transitionend` listener and the three `syncViewerSize` timeouts that
  existed only to chase the animated height;
- collapse uses `display` rather than an animated `max-height`, so there is no
  transition to wait on and no ceiling to clip a tall panel;
- the tabs are gone, because they only existed to keep the panel short.

The contract is now simply: **nothing the panel does may change the canvas.**
Not switching sections, not collapsing, not dragging. That is asserted directly.

## Where it lives

**In the studio** it floats inside the viewer and can be dragged anywhere, which
suits a tool: you want it over the model, and out of the way on demand.

**On the storefront it floats too, and arrives closed.** It used to drop into
normal flow beneath the viewer, which was the only way to keep it off the
product while the store was a column grid. The store now uses the same
full-viewport shell as the studio, so there is no in-flow space below the viewer
to drop into — and what keeps the panel off the desk is that it *arrives
collapsed*: a bar, not a slab. The header is what you press to open it. Dragging
and resizing work there exactly as they do in the studio.

The docked mode still exists and is still reached: below 760px the shell steps
aside for the stacked mobile layout, and there the viewer is an ordinary block
again with room beneath it.

## Turning the desk in place

The compass is two controls. The dish steers the glide; **the outer ring turns
the desk in place**. The turning target starts halfway out from the center, so
the visible ring is easy to grab. Hold the Left or Right button for a precise turn.

It is a **momentary jog, not a position dial**
(`movement_and_rotation_joystick.dart:361-383, 588-598`): twist past 3° and the
desk turns for as long as you hold it; release and it stops and the ring springs
back to zero.

The desk turns about **`Base_Panels_3`**, its wheel centre, not the model origin
— rotating about the origin swings the whole desk around a point off in the
assembly, so it orbits instead of turning on the spot. Position and yaw are
therefore one transform: rotating about a pivot that is not the origin means the
position has to absorb the difference.

The **mecanum wheels roll while it turns**, each contact point travelling
tangentially about that pivot, so the near and far sides run opposite ways. The
existing spin model already projects a displacement onto the roller axis, so the
turn only has to supply the rotational displacement rather than invent a second
model.

Turning and gliding move the wheels at **the same rate for the same speed word**.
Gliding spins a wheel at `glideSpeed / radius` and turning at
`projection * omega / radius`, so `omega = glideSpeed / projection` — where the
projection is the mecanum term `ax + latSign * az`, not the wheel's distance from
the pivot; those differ by a large factor. Both paths also clamp `dt` to 0.05 per
frame: without that a long frame advances the turn by the whole gap and the desk
jumps, and on a slow machine only one of the two is throttled.

Nothing wrote the model's yaw before this, so the rotation itself is new, not
just the control for it.

## Moving it

Drag the header. Only the bare strip starts a drag — a pointerdown on the stop
button, the collapse toggle, or any other interactive descendant belongs to that
control.

The position is clamped to the **canvas's usable rectangle**, not merely the
outer viewer, and re-clamped whenever that rectangle can change: the viewer's
`ResizeObserver`, window resize, collapsing or expanding, and after
`document.fonts.ready` (web fonts change the panel's measured size).

## Controls

| Control | Behaviour |
|---|---|
| Glide compass | drag the inner half, or focus it and hold an arrow key; twist the outer half or hold Left/Right to turn in place |
| Glide speed | Crawl / Ninja / Slow / Medium / Fast |
| Height | editable readout, a centred jog track, and a speed |
| Tilt | editable readout, a 120° crescent jog track, and a speed |
| Touchscreen | slides out, then rotates to face the user; tap again to stow |
| LEDs | turns the desk, shelf, and base lights on or off |
| Preset banks | **separate** for lift and tilt — tap recalls, press and hold saves |
| Ergo Forms | a combined pose: height *and* tilt. Double-click to rename |
| Stop | freezes everything exactly where it is |

**Stop is not `stopGlide()`.** That function returns the desk to its home
position, which is the opposite of what a stop must do. `haltAllMotion()` holds
glide at its current offset, sets the lift target to the current lift, and drops
the tilt target.

**The Height and Tilt tracks are rate controls, not position sliders.** They rest
at centre, drive the desk while held away from it, and spring back on release —
the app's own behaviour (`centered_control_slider.dart`), with a dead zone around
centre so a nudge does nothing. Because of that the slider no longer reports the
height; the readout is the only thing that does.

Every way of letting go is handled — `pointerup`, `pointercancel`,
`lostpointercapture`, `mouseup`, `touchend`, `touchcancel`, `blur` and `keyup` —
since a single missed path leaves the desk driving itself with nothing holding
it. The test covers losing focus mid-hold specifically, because that is the one a
pointer-only implementation would miss.

**Movement is in units per second**, integrated against real frame time and
clamped to 0.05 per frame like the glide. The lift previously eased by a fixed
`* 0.08` per frame, so it genuinely moved at different speeds on different
displays and stalled under load. `setHeight()` remains immediate — editing,
presets and tests depend on that — and the driven path is separate.

**Not yet calibrated against each other:** tilt travels considerably faster than
lift for the same speed word. The wheel speeds were matched to the glide by
derivation; these two have not been.

**Tilt binds to the rig named `tilting`, never `tiltConfigs[0]`.** Saved rigs are
restored before the baked one, so index 0 is whatever happened to load first and
changes between sessions.

## Storage

Every key is versioned and validated on read; corrupt, truncated or
foreign-versioned data falls back to defaults rather than breaking the panel.

| Key | Holds |
|---|---|
| `ergoflex.dockPosV1` | `{v, x, y}` — clamped to the usable rect on read |
| `ergoflex.liftPresetsV1` | `{v, slots}` — three heights or nulls |
| `ergoflex.tiltPresetsV1` | `{v, slots}` — three angles or nulls |
| `ergoflex.ergoFormsV1` | `{v, forms}` — three `{name, lift, tilt}` |
| `ergoflex.motionDockCollapsed` | unchanged |

## Design source

Values come from the Flutter source rather than from a screenshot; the file map
is at the top of `app-remote.css`. The palette is the blue light family ramp
(`fill #2F55D4`, `ink #1E3FB0`, `wash #E2E7F9`, `ground #E7EAF2`, `hub #F5F6FD`),
the type is Poppins with the app's `letter-spacing: 3px` on headings, and the
glossy sphere shared by all three knobs is
`radial-gradient(circle at 38% 34%, #E1E7F8, #2F55D4 50%, #15265F)` — where
`#15265F` is `mix(#2F55D4, black, 45%)`, not a hand-picked colour.

## The panel is a device

Drag any corner and the panel resizes. It **snaps to real device screens** and a
toast names the one it landed on: the Fold 5 cover screen and unfolded pane in
both orientations, the unfolded device in a split window, an iPhone, and the
Apple foldable. The table is `REMOTE_DEVICES` in `studio.js` and it is the only
place a device size is written.

**It cannot be dragged into a shape no device has.** The minimum and maximum are
the table's own extremes rather than numbers of their own — 344 to 890 on both
axes as the table stands — so adding a device widens the range automatically.
And a release always settles on the *nearest* device, however far off one the
drag finished: magnetic snapping while dragging only catches a size you were
already close to, whereas this is what makes every resting size a real screen.
A size no screen has is one the app's layouts were never drawn for; they do not
degrade into it, they distort. The clamp is inside `applyRemoteSize()` rather
than only in the drag handler, so the test hook and the restore path cannot get
round it either. CSS pixels are the app's dp, so the figures transfer unchanged; the
Fold 5 numbers are quoted from the app's own
`lib/utils/layout_breakpoints.dart`, which measured its portrait weights on the
cover screen (344 × 882) and documents the unfolded device as 810 × 674.

**A device bigger than the viewer is drawn smaller, not made unreachable.** A
cover screen is 882px tall and almost no laptop viewport has that once the
header and the toolbar are out. The panel keeps the device's *layout* size — so
its breakpoints still answer as that device — and is painted at a scale that
fits. Every pointer delta is divided back out, so dragging still tracks the
cursor. The Apple foldable's 626 × 890 is 1878 × 2670 hardware pixels at
430 ppi taken at @3x; **its folded cover screen is unconfirmed**, and the iPhone
entry stands in for it until it is.

Layout used to be a deliberate departure — the blocks ran wide, and fell back to
the phone's order via a container query on **the viewer**. That was right while
the panel was furniture and is wrong now that it is a device: a cover screen
inside a wide viewer would have picked the wide layout. The panel now answers
the question the app asks — *how big is my screen* — through a `data-shape`
attribute set from `main_screen.dart`'s own predicates. It is JS rather than a
container query because CSS cannot ask about `shortestSide`.

| shape | predicate | layout |
|---|---|---|
| `narrow-portrait` | `w < 600` upright | the app's four-block column: Glide 34, Ergo Forms 13, Lift+Tilt 44, Hub 8 |
| `wide-portrait` | `w >= 600` upright | the same blocks on `kWidePortrait*` — 28 / 12 / 50 / 9 |
| `narrow-landscape` | `h < 500` on its side | three columns, Glide over Ergo Forms 2:1 |
| `landscape` | otherwise | three columns, 3:1 |
| `tablet-landscape` | `shortestSide >= 600` | three columns, 59:41, and six Ergo Form slots as two rows of three |

**`wide-portrait` is the shape the replica is tuned against**, measured off the
device at 674 × 810 rather than eyeballed. Headings run along the top of their
block, left, with the info beacon pushed to the far right. The dial sits on the
Glide block's left half with the speed word beside it. Ergo Forms are three
capsules across the full width, each with its chevron in the bottom right. And
Height and Tilt use `base_panel.dart`'s **splitPortrait**: the track goes down
the left of its column and the readout sits top-right with the speed word under
it, which is why the readout has no full-width band of its own here. The track's
inset from the panel edge is a margin on the track, not padding on the column —
as padding it came out of the readout's half as well, and the tilt arc's box is
three times the lift track's width, so the readout there was squeezed off the
panel.

The fixed-px internals are gone with it. The compass, the lift track and the
tilt arc are derived from `--remote-unit`, the panel's own short side over 100,
so a bigger screen gets bigger controls rather than wider margins. The arc keeps
its 120:190 viewBox ratio exactly, because the sphere is placed as a percentage
of that box.

## Scope

This is the app's **motion** surface. The phone's other header controls — menu,
info, microphone, collision shield, sign out — are **drawn but disabled**, with a
tooltip saying they are hardware controls not connected in the preview. Drawing
them keeps the bar recognisable as the app's; disabling them avoids the worse
outcome, a control that looks live and silently does nothing.

The green status dot is decorative for the same reason: it reports that this is a
preview, not a connection to a desk.

The **Wellness Hub bar** along the bottom — the desk, the wellness score and its
ring, the routine timer, save, and the lamp that is red while it is on — is
drawn and disabled on the same terms. It is routines rather than desk movement
and there is nothing behind it here, but the app has it and a replica that omits
it is not a replica.

The Mini Wellness strip and the start-routine buttons were drawn here for a
while and have been removed. They are in the Dart — `responsive_main_screen.dart`
and the landscape branch of `main_screen.dart` — but they are not on the device:
none of the screenshots of the app running on the hardware has either one. **The
hardware wins over the source.** The source says what the app can draw; the
device says what it does.

## Both themes

The app ships a light theme and a dark one, so the panel carries both and the
sun/moon in its header switches between them. The choice persists under
`ergoflex.remoteThemeV1`. **Dark is the default**, because it is what the app is
shown in and what every reference screenshot is.

The dark ramp is sampled off the device rather than guessed — the Fold 5
unfolded upright, 1812 × 2176 at 2.6875 — and every value in it is a colour
actually on that screen: `#000000` page, `#050713` app bar, `#0A183F` hub bar,
`#07080C` readout, `#4788FF` rims, `#8DA5ED` for the speed word, `#C10207` for
the lamp. Surfaces are named (`--sunk`, `--chip`, `--bar`, `--pill-a`) so rules
never have to know which theme they are in.

Two things that are easy to get wrong here, both found by getting them wrong:
the compass is themed entirely from CSS, because **`var()` is not valid in an
SVG presentation attribute** — a `stop-color="var(--dial-b)"` silently paints
nothing, and the dish stayed white on a black panel. And the app-icon SVGs are
the app's own full-colour artwork drawn for its dark UI, so they are never
tinted; inverting them for dark flattened every one into a grey disc.

## The tilt arc

The arc is an angular control, ported from `arc_control_slider.dart`: the finger
is projected onto the crescent by angle (`atan2`, normalised so the ±π wrap
never lands inside the sweep), the value runs ±155 with a ±10 dead zone, and
letting go springs it back to centre over 150ms. The `<input type=range>` behind
it takes no pointer events; it is the keyboard and assistive-technology surface,
and the value every path writes to, so the dead zone, the jog integration and
the sphere all stay on one code path.

It was broken for a while, and the way it broke is worth keeping: `syncTiltUI()`
kept re-authoring the track's `min`/`max` from the rig, as if it were still a
position slider. The old rig ran `-70..0`, so `max` became the string `"0"` —
truthy, so `Number(slider.max || 1)` never fell back — and the normaliser
divided by zero. At rest that was `NaN` and nothing moved; pulled down it was
`-Infinity` and the desk hit its limit inside one frame; and up was unreachable,
because zero had become the maximum. The height track was fine only because
`showHeight()` deliberately does not touch it. Both tracks now normalise against
their own half-span, and `syncTiltUI()` writes the readout and nothing else.

The per-rig tilt sliders that used to float inside the panel are gone from it.
They are an authoring tool, the app has no such control, and the editor panel's
`#tilt-configs-list` already carries one per rig.
