# ErgoFlex desk LEDs — 3D system and engineering handoff

Prepared October 3, 2026 from the local Custom Shop source.

## Update after firmware handoff

The shared reference now supplies eight-strip identities, Desk 02 counts, saved
operator endpoints, 56 movement frames, Game Mode algorithms and sound paths.
Read [PC2's current integration status](led-pc2-integration-status.md),
[the firmware handoff](LED_VIEWER_FIRMWARE_HANDOFF.md) and
[the pixel diagnostic](led-pixel-mapping.md). Current visibility masks, fresh
hardware geometry checks and size-specific electrical counts remain open.

## 1. Purpose and status

We want animated lighting that looks consistent in the 3D configurator, Studio,
Android AR and, eventually, on the physical desk. This brief describes the
implemented preview and identifies the hardware information needed to connect it.

**Implemented locally:** Solid, Breathe and Color cycle; eight-strip per-address
RGBW rendering; actual lift/tilt/wheel cues; optional real movement sounds; and
Neon Flight Game Mode with four presets, video-synchronized LED banks and optional
synthesized music. See the linked status for tested scope and frame provenance.
**Not implemented:** physical desk LED commands, live capture/audio input,
standalone music effects, independent customer zone controls or browser pixel
animations in native Apple AR.
These changes have not been uploaded to the website.

The 3D application's LED controls currently change materials and shader uniforms.
This repository's viewer has no LED device connection, command transport or
physical LED feedback. A preview working on screen does not establish that the
installed strips or controller can reproduce it.

## 2. System outline

```text
Desk GLB geometry + motion rigs + finish/texture configuration
    │
    ├─ LED overlay geometry → glowing MeshStandardMaterial strips
    ├─ Receiver geometry → custom additive GLSL light spill
    └─ Base rig → transparent floor light pool
              ▲
UI / saved configuration → color, brightness, on/off, effect, cycle duration
              │
      Base clock / actual-motion owner / shared video timeline
              │
      RGBW atlas + local spill / master brightness
              ▼
Three.js WebGL renderer → Studio / product viewer / live Android WebXR AR

Native AR export → GLB/USDZ textured surfaces + emissive strips at export time
                  Browser light-spill shaders and effect clock are omitted

Physical desk integration → proposed adapter; hardware/protocol still to confirm
```

### Geometry, motion and scale

- Shared Three.js **0.163.0** engine in `studio.js`, used by `index.html` and
  `product-demo.html`. `catalog.mjs` selects `assets/model/desk-public.glb`.
- Desktop variants are **48 × 30 inches** and **60 × 30 inches**. The larger
  desktop has its own surface, trim and side LED geometry.
- Lift, telescoping columns, tilt, actuators, wheels and the screen assembly
  are controlled by the shared motion rig. Current combined presets are Sitting
  **28 inches / 0°**, Standing **43.5 inches / −5°**, Easel **52 inches / 65°**.
- LED overlays follow the appropriate base, lift or tilt assembly. Reflection
  overlays follow the receiving mesh and account for relevant moving strip frames.
- Source geometry is normalized for the product display; a Three.js scene unit
  is not automatically one physical meter. AR derives meters per scene unit from
  measured desktop geometry and the selected nominal or calibrated width.
  Room builders use millimeter dimensions with a separate conversion.

### Lighting layers

| Layer | Current implementation | Meaning |
| --- | --- | --- |
| Visible LED strip | Colored, emissive `MeshStandardMaterial` | The glowing strip itself |
| Desk light spill | Transparent additive `ShaderMaterial` on receiver geometry | A designed approximation of colored illumination |
| Floor glow | Additive shader plane attached to the base | A soft pool moving with the desk |
| Product lighting | Hemisphere plus key, fill and rim directional lights; environment map | General illumination of wood, metal and other materials |
| Room lighting | Day moods, room light rig, task fixtures and emissive decor | Ambient scene lighting, separate from desk LED effects |

Product lighting starts with hemisphere intensity 0.35, key 1.5, fill 0.35 and rim
0.55. Backdrops and room moods adjust lighting/exposure. The renderer uses sRGB
output, Neutral tone mapping and initial exposure 1.02. The key directional light
provides the shadow map; the mobile product demo uses a 1024 map, otherwise 2048.

The desk LEDs do **not** currently add one real scene light per diode. Their spill
is shader-based: distance/facing falloff, strip span, compartment boundaries and
hand-tuned occlusion. It follows panel outlines and cutouts. It is not a measured
photometric simulation or arbitrary-object shadow solution. Room objects do not
automatically receive desk LED spill. Wood color, texture, exposure and backdrop
all affect its apparent brightness.

## 3. LED asset and receiver map

`assets/motion/LEDS.glb` must currently have 43 top-level nodes;
`assets/motion/LEDSforWideDesktop.glb` must have two. The loader checks these counts.
Assignments currently depend on export order, so a revised GLB needs a checked map.

| Standard export indices, zero-based | Attachment / use |
| --- | --- |
| 0–2 | Three Standard desktop underside strip objects, following tilt |
| 3–37 | Small fixed-red desktop details, currently hidden by the size-fit code |
| 38 | Base LED assembly |
| 39–42 | Shelf/lift LED assembly; 39 drives desktop spill, 40 top spill, 41 lower-shelf spill |
| Wide export 0–1 | Replacement wide desktop side strips; shared center strip completes the wide set |

**43 means exported objects, not 43 physical LEDs, pixels or channels.** The two
wide side strips reuse the corresponding Standard strip materials. The rendering
map above does not establish wiring direction, pixel addresses or controller ports.
The eight-strip geometry/electrical map and recorded endpoints are documented in
led-pixel-mapping.md; current physical visibility still needs confirmation.

Receiver tuning groups are desktop, lower shelf, base shelf, top shelf, floor,
left wing and right wing. Inside shelf side plates and column faces also receive
spill. Under the desktop, the crossbar receives stronger illumination; the
control-box cage receives weaker lower-edge bounce with upper occlusion. The legs
receive both underside and adjacent-wing contributions.

These groups identify **illuminated surfaces**, not necessarily independent
electrical zones. One strip can illuminate several receiver groups.

## 4. Controls, state and current animations

### Existing controls

- Master on/off; one global selected RGB hex color; eight color presets.
- User brightness 0–100%, normally starting at 75% in the product demo.
- Studio receiver adjustments: strength, reach and, where relevant, spread,
  cone, edge softness and falloff sharpness.
- The product demo's first LED on/off cycle switches to LED studio and then back
  to Slate. This is a saved browser preference, not a physical desk command.
- Color/brightness/receiver settings can be saved locally. Project files include
  the presentation settings. Room moods and Groove arrivals may change the base
  color and master on/off.

**Brightness is visual tuning, not electrical output.** Public 100% maps to
internal `ledGlow = 123.25`; strip emissive intensity is `3.6 × ledGlow / 100`.
Spill strength is `ledGlow × receiverStrength / 10000`. Receiver strength sliders
can exceed 100% because they are rendering gains. Neither value specifies PWM
duty cycle, LED current, watts, lumens, lux or a safe controller power limit.
The “white” colors are RGB selections; they do not prove RGBW hardware or calibrated
color temperatures.

### Added software previews

| Effect | Behavior |
| --- | --- |
| Solid | Selected color at selected brightness |
| Breathe | Smooth cosine fade between 25% and 100% of selected brightness |
| Color cycle | Whole desk traverses the color wheel, starting at red, at selected brightness |
| Movement | Per-address lift, tilt and wheel cues derived from actual motion; optional real MP3 sounds |
| Game Mode | Original video and optional synthesized music share a timeline with compiled RGBW banks; four presets |

The three base effects use a 4–30 second cycle, default 8. Movement and Game Mode
use per-address RGBW output instead. Color cycle and transient pixel owners leave
the chosen base color and brightness intact; stopping restores the latest base look.

The same animation color/gain updates visible strips and all desk receiver fields.
One reused RGBW atlas and video texture provide the additional pixel/video paths;
there are no per-pixel meshes or extra shadow lights. Base effect
timing uses elapsed seconds, independent of display refresh rate. Per-frame updates
do not write local storage, change the brightness slider or emit LED on/off events.
The master off overrides animation immediately. Browsers requesting reduced motion
show the selected base color and brightness steadily. Movement cues hold a static
reference phase; Game Mode pauses on a static frame.

Studio saves effect parameters locally and in project presentation data. The
product demo starts with Solid rather than inheriting a visitor's Studio effect.
The effect clock is not serialized. Loading an old project restores Solid.

## 5. AR and platform behavior in this implementation

| Path | Current behavior |
| --- | --- |
| Product viewer / Studio | Shared live effect clock, materials and spill shaders |
| Android live WebXR AR | Same desk is reparented into the AR scene; effect clock remains live. Demo effect controls move into the existing LED settings panel |
| Native GLB / USDZ handoff | Current strip material state is exported. The new browser effects are not authored into exported animations; custom spill shaders are removed |
| Apple interactive tap export | Existing authored lift/tilt tap states remain separate; the new LED effect clock is not exported |

The live AR renderer disables shadows and uses a 0.75 framebuffer scale. AR lighting
uses cloned scene lights/environment rather than measured LED photometry in the room.
The new effect controls were tested in the desktop browser; they still need a
physical Android session test. No new native Apple lighting behavior is promised.

## 6. Proposed next effects and integration

1. **Confirm the hardware capability map.** Global RGB dimming supports a different
   effect set from independently addressable pixels or independently wired zones.
2. **Define named emitter zones:** desktop-left, desktop-center, desktop-right,
   shelf-to-desktop, shelf-interior, shelf-top and base. Treat these as proposed
   names until the wiring diagram confirms the actual circuits.
3. **Add per-zone fades and transitions** if ports permit them. Give each emitter
   a stable identifier and map its color to all affected receiver fields.
4. **Add chase, traveling gradient and coordinated waves** if addressable pixels
   are confirmed. Each strip needs a physical path, pixel count, start/end
   direction and normalized distance along the path. A uniformly colored strip
   mesh is insufficient for a visible traveling effect; the strip material and
   spill need spatial color sampling.
5. **Agree on a hardware adapter.** Prefer sending effect parameters for firmware
   to run locally, if supported. Define capability discovery, acknowledgments,
   state reporting and reconnect behavior before choosing a transport. This
   avoids tying physical playback to browser frame timing.
6. **Calibrate against the real build.** Match strip location, diffusion,
   brightness curve and representative colors using photos and measured output.
   Tune rendering separately from firmware current/thermal limits.

Possible later scenes: quiet work breathing, warm evening transitions, shelf-to-base
waves, party gradients and task-specific lighting. Audio-reactive effects require
an agreed audio source and processing location; neither is present today.

## 7. Questions for the engineer

### Essential answers for the first implementation

1. **What is installed now?** Strip/LED part numbers, analog versus addressable,
   RGB/RGBW/tunable white, operating voltage, controller/MCU and firmware version.
2. **Which sections can change independently?** Please label every strip and
   controller port on the desk. Which are wired together? Are there any fixed
   status indicators that must be excluded from decorative effects?
3. **What is the address map?** Strip lengths, pixel/segment counts, pitch, data
   direction, daisy-chain order and start/end location for both 48 and 60 inches.
4. **How do we control it?** Existing command API and transport, working sample
   messages, brightness/color ranges, channel order, acknowledgments and state
   feedback. Is there already an effects library in firmware?
5. **What are the power limits?** PSU ratings, worst-case white current, power
   injection and controller limits per section and total. What limits does firmware
   enforce under load or temperature changes?
6. **What timing is reliable?** Supported update rate, dimming resolution, smooth
   fade support and simultaneous-zone behavior. Can firmware run an effect
   autonomously and share an agreed time/phase between outputs?
7. **What happens on startup and disconnect?** Default state, retained settings,
   reconnect/resume behavior and user override priority. How should off, Stop,
   fault/status signals and normal decorative effects interact?
8. **Where are the strips mounted?** Photos/drawings showing orientation,
   diffuser/recess, opaque blockers and cable routing through lift/tilt motion.
   Do these locations match the current LED GLBs?

### Useful calibration and product decisions

- Is brightness perceptually corrected in firmware? How are RGBW white mixing,
  channel balance and color temperature handled?
- Are low-light camera flicker, thermal derating or cable strain known issues?
- Should effects synchronize with Groove posture routines, or remain independent?
- Does the engineer prefer firmware-owned effects or streamed pixel/zone values?
  Which can the current board support without changing hardware?
- What pairing/access rules apply when a browser or app controls a real desk?
- Can we get one annotated unit and a repeatable camera/exposure setup for
  comparing preview colors and fades with physical output?

### Please include in the engineering document

- Annotated wiring/placement diagram for both desktop sizes, with stable zone IDs.
- Strip/controller/PSU BOM and relevant datasheets.
- A zone table: ID, port, length, count, direction, channel type, rated current and
  enforced brightness/current limit.
- Current command examples and supported effect/capability list.
- Boot, reconnect, override and fault behavior.
- Photos of strips, recesses, diffusers, crossbar/cage and moving cable paths.

## 8. Source map and verification

| Source | Responsibility |
| --- | --- |
| `studio.js` | LED loading/rig attachment, emitters, spill shaders, state/API, effect frame integration, project save/load and AR export |
| `led-effects.mjs` | Effect IDs, parameter validation and elapsed-time sampling |
| `product-demo.js` | Public LED controls and first-use backdrop cycle |
| `ar-workspace.mjs` | Shared live AR renderer/model and DOM control panel |
| `apple-ar-interactions.mjs` | Existing native Apple tap behavior authoring |
| `workspace-3d.mjs`, `room-refinement.mjs`, room modules | Room dimensions, environment lighting and accessories |
| `docs/room-lighting.md`, `docs/motion-remote.md`, `docs/apple-ar-tap-controls.md` | Existing subsystem notes |
| `divi-editor/build-site-upload.py` | Website bundle builder; now includes `led-effects.mjs` |

`node tests/led-effects-test.cjs` checks breathing endpoints/bounds, invalid settings,
reduced motion and master off, then loads the actual product demo to verify strip
and floor animation, matching animated colors, unchanged base settings, saved
effect parameters and restoration to Solid. It checks browser exceptions and
saves a visual review screenshot. This does not validate physical firmware,
electrical performance or animation inside a native AR viewer.
