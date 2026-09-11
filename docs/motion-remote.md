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

**On the storefront it drops down instead.** A panel sitting on top of the desk
is just covering the product, so there it lives in normal flow *beneath* the
viewer and takes no space at all until you open it — the page loads with it
closed, and the header bar is what you press to drop it down. Dragging is
disabled in that mode; there is nothing to drag out of the way.

## Turning the desk in place

The compass is two controls. The dish steers the glide; **the outer ring turns
the desk in place**. The band is the app's own — `0.62` to `1.02` of the outer
radius — wide enough to catch the visible capsules without swallowing the dish.

It is a **momentary jog, not a position dial**
(`movement_and_rotation_joystick.dart:361-383, 588-598`): twist past 5° and the
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
| Glide compass | drag the dish, or focus it and hold an arrow key; twist the outer ring to turn in place |
| Glide speed | Crawl / Ninja / Slow / Medium / Fast |
| Height | editable readout, a centred jog track, and a speed |
| Tilt | editable readout, a 120° crescent jog track, and a speed |
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

Layout is the one deliberate departure. The phone stacks Glide, Ergo Forms, then
Height and Tilt vertically because it owns a whole screen; transcribing that here
would make the panel taller, which is the opposite of the point. The same blocks
run **wide** instead, and fall back to the phone's order only when the viewer is
genuinely narrow — via a **container query on the viewer**, not a window
breakpoint, because in setup mode the viewer is far narrower than the window.

## Scope

This is the app's **motion** surface. The phone's other header controls — menu,
info, microphone, collision shield, sign out — are **drawn but disabled**, with a
tooltip saying they are hardware controls not connected in the preview. Drawing
them keeps the bar recognisable as the app's; disabling them avoids the worse
outcome, a control that looks live and silently does nothing.

The green status dot is decorative for the same reason: it reports that this is a
preview, not a connection to a desk.

Not built: the wellness bar along the bottom of the phone (routine, timer, save,
lamp). That is a routines feature rather than a desk control.
