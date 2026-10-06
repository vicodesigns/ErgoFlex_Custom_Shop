# ErgoFlex Flutter visualizer lighting handoff

Prepared 6 October 2026 for the Flutter app engineer. Reference release: **desktop-tilt-reach-20261006**.

**Follow-up clarification:** [Answers to the five engineer questions](ENGINEER-QA.md) cover Music approximation/byte conversion, firmware palette IDs, live Game interpolation and gamma, demo-only mirroring, and the root Black Birch texture. Read these when integrating live desk telemetry.

## 1 Purpose and implementation decision

Bring the Flutter app's live desk visualization up to the appearance and behavior of the current Explore ErgoFlex in 3D viewer. Keep the app's measured desk pose, connection state, and existing command ownership. Port the rendering layers described here into the app's existing embedded Three.js viewer.

The main improvement is the **spatial reflection system**. Each physical strip has its own pixel colors. Selected receiving surfaces sample those colors locally, with different reach, direction, softness, and occlusion rules. The desktop combines three independent shelf sources into overlapping depth bands. Changing tilt stretches those bands forward from the desktop rear edge. A whole-desk color or a single general glow radius cannot reproduce this appearance.

This handoff contains current source snapshots, a runnable website reference, the tuning contract, images, and regression tests. Browser code is an implementation reference; the app integration described below is proposed work. The Flutter app has not been modified by this handoff.

### Start here

1. Read sections 2–9 for the rendering port.
2. Read sections 10–14 for effects, Music, Auto DJ, Game Mode, and lifecycle.
3. Implement the milestones in section 16 and run the comparisons in section 17.
4. Use `SOURCE_INDEX.json` to locate functions and their exact snapshot lines. `MANIFEST.json` records SHA-256 hashes of the delivered files.

The two reviewed working trees contain local changes. Git HEAD alone does not identify this reference. The snapshots and hashes are the authority for this handoff. Earlier October 3 briefs describe a smaller feature set and must not override the current source.

## 2 Existing Flutter viewer and the differences to close

The inspected app is under `ErgoFlex_Desk_Stack/Polish-Features/ergoflex_app`. It already embeds Three.js in a WebView, serves its assets from loopback for offline use, and moves the model using measured pose messages.

| Area | Inspected app implementation | Current browser reference and port action |
| --- | --- | --- |
| Viewer | `desk_viewer/desk-viewer.js`, `DeskModelView`, WebView transport | Keep this integration. Extract reusable rendering code from `studio.js`; do not load the full editor into the app footer. |
| Strip pixels | Eight strips, reused RGBW atlas, decorative and movement samplers | Retain physical IDs and configurable masks; update bindings and renderer interfaces together. |
| Surface light | `setupGlow` patches nearly every model material using eight line sources, one radius, one gain, and facing | Replace this general term on the mapped desk surfaces with the receiver fields in sections 5–8. Disable the old contribution there to avoid double illumination. |
| Desktop | General distance-to-strip glow | Three independent shelf-source bands, local pixel sampling, finite strip ends, forward fan, and tilt response. |
| Wings and underside | Same general glow rule | Outer and inner wing fields have different sources and gains; crossbar, cage, legs, and actuators have explicit receivers. |
| Floor | World-space line pool with global color | Base-attached foot-strip field with localized pixel colors; move with base glide/yaw, not lift. |
| Color and scene | ACES Filmic; key 1.6, hemisphere 0.7; `RoomEnvironment` | Browser uses Neutral tone mapping and a different light/environment setup. Match a comparison scene before adjusting LED gains. |
| Brightness | `LED_DIM=.75`, `LED_EMISSIVE=1.5`; stale state halves brightness | Browser uses the formulas in section 6. Preserve any deliberate stale-state UX, but compare fresh states first. |
| Media | The inspected render loop samples movement and decorative effects | Add a chosen Music/Game visualization input path and explicit ownership; selected FX alone cannot reconstruct the live audio or capture frame. |
| Refresh | LED-only frames spaced by at least 45 ms | Include Music, Auto DJ, Game, and incoming frame activity in scheduling. Evaluate at actual timestamps even when rendering fewer frames. |
| Message contract | Schema 1 `desk.led`: on, bri, rgb, fx, sx, cues, fresh, wheelDir; 2048-character limit | A complete per-strip recipe, metrics stream, or frame stream needs an explicit validated extension. See section 15. |
| Desktop size | Fixed `60x30` in inspected viewer | Support the app's intended sizes explicitly. Browser already supports Standard and Extended using the same electrical profile provisionally. |

**Interface incompatibility:** the app's `led-pixel-renderer.mjs` exports `samplingGLSL`; the current browser file keeps it private. Copying that file alone would break the app's existing import. Port the receiver calls and renderer as a coherent unit, or deliberately preserve the export during integration.

The app normalizes the whole model using `scale = 2.5 / max(size.x,size.y,size.z)`. The browser reflection constants below belong to the **authored geometry frame**, before that outer display scale. Using them as world-space meters would produce incorrect light reach.

Source snapshots: [app viewer](native-source/desk_viewer/desk-viewer.js), [Dart LED message](native-source/lib/services/desk_viewer/desk_led_message.dart), [asset server](native-source/lib/services/desk_viewer/desk_viewer_asset_server.dart), [widget](native-source/lib/widgets/desk_model_view.dart).

## 3 LED hardware identity and address map

The reviewed firmware configuration identifies **BTF-LIGHTING FCOB WS2814 24 V RGBW strips**, with **56 physical LEDs per addressable cluster**, approximately **71.42 mm per cluster**. This comes from the local Desk 02 configuration; it is not a new measurement or a universal specification for every desk size.

The visualizer models **eight logical strips and 106 addressable clusters**, not 106 individual diodes and not 43 independent LED zones. The standard LED GLB has 43 top-level objects; only the eight mapped objects are the addressable strips. Objects 3–37 are small fixed-red details hidden by current size fitting.

| ID | Physical strip | Desk 02 clusters | GPIO in reviewed config | Standard GLB object index | Path axis | Recorded address zero | Parent rig |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Top Shelf Top | 14 | 27 | 40 | Z | User right / Z maximum | Lift |
| 1 | Top Shelf Bottom Back | 14 | 2 | 41 | Z | User right / Z maximum | Lift |
| 2 | Top Shelf Bottom Front | 15 | 33 | 42 | Z | User right / Z maximum | Lift |
| 3 | Second Shelf | 14 | 12 | 39 | Z | User right / Z maximum | Lift |
| 4 | Desk Top Center | 14 | 5 | 2 | Z | User left / Z minimum | Tilt |
| 5 | Desktop Left | 11 | 25 | 1 | X | Back / X minimum | Tilt |
| 6 | Desktop Right | 11 | 4 | 0 | X | Back / X minimum | Tilt |
| 7 | Foot Rest | 13 | 15 | 38 | Z | User right / Z maximum | Base |

The address-zero evidence is saved operator calibration from 1 October. Current fresh physical checks, sacrificial/dead address masks, and size-specific electrical counts remain open. `visibleAddresses:null` means **all configured addresses are provisionally visible**. Keep original address numbers when supplying a mask; do not renumber the remaining physical addresses.

For the delivered map, IDs 0,1,2,3,7 use `reverse:true`; ID 4 and side strips 5,6 use `reverse:false`. This renderer reversal maps increasing geometry coordinate to physical addresses. A saved recipe's `rev` is a separate artistic direction parameter. Applying either twice changes the effect.

Extended side GLB objects 0 and 1 bind to IDs 6 and 5 respectively. Its cloned center object binds to ID 4. Normalize each variant's own mesh coordinate to 0–1; electrical identity survives a size change.

Do not infer channel order from a preview frame. Browser frame arrays are logical **R,G,B,W**. Firmware comments identify W-R-G-B wire order and separate NeoPixelBus constructor argument mapping. Those belong to the firmware output adapter, not the renderer's logical frame layout. The selected configuration excerpts are in [hardware reference](native-source/hardware-led-reference.txt).

## 4 Rendering pipeline and RGBW handling

```text
Latest base look + pose + selected media input + transient movement owner
   -> select one active frame source
   -> eight logical RGBW byte rows in physical strip ID order
   -> reusable texture atlas with mask and geometry orientation
   -> emissive strip path sampling
   -> local pixel sampling on mapped receiver fields
   -> tone mapping and sRGB output
```

`LedPixelRenderer` allocates one texture, nearest filtered with no mipmaps. Current unmasked width is 15 and height is 8. Each strip geometry gets `efLedT`, its normalized X or Z position. The atlas applies visibility masks and recorded endpoint reversal during upload. Sample pixel is `min(count-1, floor(clamp(t,0,1)*count))`.

Raw RGBW rows are retained. For display, mix `displayRGB = min(255, RGB + W)` independently per channel. This is an approximation; it does not model the measured white-channel spectrum, color temperature, light output, or current consumption.

There are two input encodings:

| Input | Upload flag | Conversion |
| --- | --- | --- |
| Diagnostic, decorative, movement, browser music and saved looks | `linear=false` | Mixed bytes are treated as sRGB, then shader converts to linear. |
| Delivered Game Mode bank | `linear=true` | Mixed linear drive byte is encoded into sRGB atlas bytes; shader then decodes once to linear. |

The shader's sRGB decode is the standard piecewise function: below 0.04045, divide by 12.92; otherwise `((c+0.055)/1.055)^2.4`. Do not add firmware gamma or repeat this conversion over final Game banks. Raw input bytes must remain available for provenance/debugging.

Visible strips use `MeshStandardMaterial` with color/emission hooks. During pixel playback both diffuse color and total emissive radiance sample the atlas. No per-cluster light or extra per-cluster mesh is required.

Ordinary receiver fields average **three neighboring address samples** near their projected strip coordinate. This creates a soft localized pool while preserving dark pixels and traveling color. Multi-source fields mix the designated emitters, not all eight strips. Desktop fields use a different weighted combination described next.

Reference: [pixel renderer](browser-reference/led-pixel-renderer.mjs), [strip map](browser-reference/led-strip-map.mjs), `bindLedPixels` in [Studio](browser-reference/studio.js).

## 5 Emitter to receiver map

| Receiving surface | Emitter IDs | Field and optical behavior |
| --- | --- | --- |
| Standard and Extended desktop top | **3, 2, 1**, independently weighted | Three depth pools; each samples its own strip pixels across width. Shared tilt-dependent reach. |
| Desktop power-module meshes `Power`, `Power_1` etc | **3, 2, 1** | Same desktop coordinates and bands, weaker peak alpha. All eight power meshes in current model are covered. |
| Lower shelf top `Top_Shelf_3` | 1 and 2 | Blended local neighborhoods from the two upper-shelf underside strips. |
| Upper shelf top `Top_Shelf_4` | 0 | Top-facing pool. |
| Base shelf `Base_Panels_3` | 7 | Foot-strip contribution. |
| Floor | 7 | Long finite strip pool, sampled spatially across width. |
| Left wing `Desktop_1` outer face | 5 | Strong X/Y falloff, outward-face gate. |
| Right wing `Desktop_2` outer face | 6 | Same rule using the opposite side. |
| Both wing inner faces | 4 | Weak center-underdesktop bounce, multiplier 0.18. |
| Shelf inside side boards and nearby column faces | 3 below second shelf; 1 below top shelf; 0 above top shelf | Separate compartment bounds and source-facing gates. Current upright receivers use strip 1 for this middle compartment, while the lower horizontal shelf mixes 1 and 2. |
| Underdesktop crossbar `Desktop` | 4 | Strong underside contribution, gain 2.0. |
| Control-box cage `mesh_692` | 4 | Weak underside gain 0.5, lower-edge occlusion and small indirect term. |
| Telescoping/outer leg faces | 4 plus adjacent 5 or 6 | Center-underdesktop contribution plus side-strip gain 0.65. |
| `Linear_Actuators` and numbered actuator meshes | 4 | Source follows tilting desktop; receiving cylinders/rods follow actuator solver, gain 1.5. |

Sources are optical contributors. Receiver groups are rendering controls, not new independently wired electrical zones. Do not illuminate every model surface with every strip to imitate this map. Furniture and arbitrary room props do not automatically receive these fields.

Receiver overlays reuse the actual receiving geometry, so holes, panel boundaries, and cutouts stay intact. Use transparent additive blending, `depthWrite:false`, polygon offset −1/−1, render order 1, and no raycast participation. Horizontal/upright overlays use front faces; wing overlays use both sides with explicit face gates. Keep the underlying wood/metal finish visible.

## 6 Default settings and visual brightness

The values below are the current source defaults. A screenshot may show a saved manual setting, such as desktop reflection 150% or width 4%, instead. Use a cleared/configured test profile when comparing implementations.

| Group | Strength | Reach | Other controls |
| --- | --- | --- | --- |
| Desktop | 157% | 100% | Width 5%, cone 100%, edge fade 46%, sharpness 62% |
| Lower shelf | 176% | 98% | No extra width/cone slider |
| Base | 54% | 20% | Also used by center-underdesktop receivers |
| Top shelf | 143% | 77% | — |
| Floor | 156% | 4% | Width 50%, sharpness 73% |
| Left wing | 111% | 85% | — |
| Right wing | 110% | 87% | — |

Master brightness is a display gain. At UI fraction `b` in 0–1:

```text
ledGlow = 123.25 * b
strip emissive power = 3.6 * ledGlow / 100
receiver strength = ledGlow * receiverStrength / 10000
```

At 100% the strip power is 4.437; at 75% it is 3.32775. The browser product viewer starts LEDs off and uses 75% when enabled. The Flutter live viewer should display the reported desk state rather than force this demo startup choice. For existing app byte brightness use `b=bri/255`; do not also apply the app's earlier `LED_DIM=.75` when matching the browser profile.

Reach maps linearly into each field's own min/max, rather than changing master brightness:

| Receiver | Reach range | Default resulting reach |
| --- | --- | --- |
| Desktop and power modules | 1–14 authored units | 14 |
| Lower shelf | 3–11 | 10.84 |
| Base shelf | 3–11 | 4.6 |
| Top shelf | 2–10 | 8.16 |
| Wing | 5–18 | Left 16.05; right 16.31 |
| Ordinary upright compartments | 5–12 | Depends on desktop/shelf/top control |
| Center underside and actuators | 12–28 | 15.2 using base reach |
| Adjacent wing contribution on legs | 8–18 | Left 16.5; right 16.7 |
| Floor | 0.06–0.35 in UV falloff coordinates | 0.0716 |

Do not apply the floor's UV numbers as world distances. Desktop width maps to `width<=20 ? -3+width/5 : 1+(width-20)/20`; the current 5% gives −2 authored units of base spread. Desktop fan slope is `cone/400` = 0.25, capped at 6 authored units. End feather is `0.2+edgeFade/25` = 2.04. General falloff power is `2+6*sharpness/100`; desktop default is 5.72 and floor default is 6.38.

These strength percentages and emissive powers are appearance parameters. They do not specify PWM, voltage, power limits, lumens, lux, or firmware safety settings.

## 7 Three desktop bands and tilt reach

The depth coordinates are in the authored desktop frame: X increases toward the user/front, Z runs across width. The three centers have already been shifted five authored inches toward the rear; do not shift again.

| Band | Source ID | Center X | Width multiplier | Gain |
| --- | --- | --- | --- | --- |
| Rear | 3 second shelf | −171 | 0.85 | 1.0 |
| Middle | 2 top underside front | −164 | 1.0 | 0.8 |
| Forward | 1 top underside back | −157 | 1.15 | 0.65 |

The finite strip Z bounds are derived from standard LED object 39. Reuse those physical source bounds for both desktop sizes. The Extended surface is wider; stretching the source across its entire width removes the intended dark space near the side plates.

For a fragment, calculate finite-strip end fade using original fragment coordinates and the forward fan. Then calculate each depth weight:

```text
reflectedX = rearX + (fragmentX - rearX) / max(1, depthScale)
distance[i] = abs(reflectedX - center[i]) / (max(0.8, fadeReach*0.24)*width[i])
softness = mix(1.6, 2.4, clamp((falloffPower-2)/6, 0, 1))
weight[i] = exp(-0.5 * distance[i]^softness) * gain[i] * endFade
pool = min(1.25, sum(weight))
topGate = smoothstep(0.55, 0.95, normalizedNormal.y)
alpha = min(0.9, peakAlpha * receiverStrength * pool * topGate)
color = sum(localSourceColor[i] * weight[i]) / max(0.0001, sum(weight))
```

`localSourceColor[i]` averages that source's address and adjacent addresses projected along strip width. Preserve source order **3,2,1** throughout binding and weighting. Peak alpha is **0.52** on the desktop and **0.18** on power modules.

Current tilt calibration uses physical degrees, not the rig Euler rotation:

```js
const rearX = -177.3;
const depthScale = 1
  + 0.25 * smoothstep(-5, 0, physicalTiltDegrees)
  + 0.60 * smoothstep(0, 15, physicalTiltDegrees);
// smoothstep(edge0, edge1, value) = t*t*(3-2*t), t=clamp((value-edge0)/(edge1-edge0),0,1)
```

In Three.js the helper signature is `THREE.MathUtils.smoothstep(value,min,max)`; the pseudocode above uses GLSL order. Do not confuse them when porting.

| Physical tilt | Depth scale | Intended appearance |
| --- | --- | --- |
| −5° | 1.0 | Preserve the owner-approved original field, about 80-ish percent visual reach. |
| 0° | 1.25 | Fade reaches the front edge. |
| +5° | 1.405556 | More of the front becomes lit. |
| +15° and above | 1.85 | Broad front coverage; extension remains bounded. |

This is an owner-observation tuning curve, not measured optical simulation. It changes the footprint rather than multiplying brightness. Manual reach still changes `fadeReach`. Update scale on every accepted/interpolated pose and on material initialization/settings changes. In the app, update from interpolated `view.t` in `applyPose`, so the field moves smoothly during its 350 ms pose blend.

Power modules project their geometry into the reference desktop frame using `inverse(desktop.matrixWorld) * powerMesh.matrixWorld`, plus the corresponding normal matrix. Upright fields similarly use the moving strip-parent frame. Keeping these transforms in `onBeforeRender` avoids stale coordinates after lift, tilt, actuator updates, or outer model normalization.

Reference: `updateDesktopReflectionTilt`, `addLedSurfaceSpill`, `loadLedOverlay`, and `bindReflectionBands`. The full GLSL and all initialization values are delivered; the formulas here are a reading guide.

## 8 Wings compartments underside and floor

**Wings:** use an X/Y Gaussian centered at X −159.8 and Y 48.5; Y radius 7, X radius controlled by reach. Face gate is `smoothstep(.7,.95,normal.z*faceSign)`. Outer peak factor is 0.38 and alpha is capped at 0.75. Inner faces use the opposite face sign and bounce gain 0.18 from source 4. Preserve the two fields rather than dimming the entire wing.

**Uprights:** transform receiver position/normal into strip-parent coordinates. Find nearest point on the finite strip, apply Gaussian distance falloff and surface facing, and average five additional ray samples along its length to keep inside column faces illuminated. The final reflected term is half the sum of nearest-point and line-bounce terms. Source direction gates top/bottom emission; upright gating and compartment bounds prevent spill through shelf boards. Desktop compartment Y is 47.6–51.92; lower-shelf compartment is 52.69–57; top begins at 57.78.

**Underside and actuators:** apply the specific gains in section 5. The cage suppresses upper spill using a receiver-local lower-edge mask and adds only `0.08*pool` indirect bounce. The per-frame source visibility gate must walk ancestor visibility: standard and Extended duplicate sources must not both illuminate the receiver. Actuator fields follow each cylinder/rod's actual solved matrix.

**Floor:** a separate 60×60 authored plane lies just above the floor, attached to the base. The field measures distance to a finite strip in UV coordinates. Half span is `.08 + .003*floorWidth` (0.23 by default); end-radius denominator is .08. Use `exp(-.5*length(vec2(across,pastEnd))^falloffPower)`, outer edge fade, peak factor .34 and alpha cap .6. Pixel projection is `-327.1-(uv.y-.5)*60` along authored Z; sign is important. Keep floor glow separate from the shadow-catcher material.

## 9 Scene finish and comparison conditions

Match color management and general scene lighting before tuning reflections. Current browser setup uses Three.js **0.163.0**, sRGB output, Neutral tone mapping, initial exposure 1.02, a generated softbox environment with PMREM, and initial environment intensity 1.15. Default scene lamps are hemisphere .35, warm key 1.5, cool fill .35, and rim .55. Room/backdrop profiles subsequently override these initial values.

LED studio reduces profile environment bounce to .35, key to .55, fill to .4, rim to .7, and hemisphere to .45 of their normal profile values. Keep a repeatable LED-studio comparison mode in the app; the production wellness footer can use a brighter presentation after parity is established.

Wood uses role-specific face/edge grain, bump and roughness maps, plus finish/clearcoat controls. The app's flat Black Birch material differs from that finish pipeline. A brighter LED overlay cannot replace the underlying wood sheen and grain. Use the delivered finish code/assets when matching the entire visual impression; treat this as a separate rendering milestone from pixel correctness.

General soft shadows come from the directional key, not hundreds of LED shadow lights. Existing added area lights previously leaked onto desktop triangles and created a view-dependent diagonal seam; current desk LED receivers rely on mesh fields. Do not reintroduce those area lights as a parity shortcut.

Native GLB/USDZ exports omit custom shader hooks and effect clocks. Loading the same GLB in a different renderer does not reproduce these reflections. Flutter's live Three.js WebView can port them; a later fully native renderer would need equivalent materials and sampling.

## 10 Decorative effects and saved looks

Base controls are Solid, Breathe, and Color cycle, with 4–30 second period, default 8. Breathe has a cosine gain from 25% to 100%; Color cycle traverses hue from red. The mode key `spectrum` here means **Color cycle**, while numeric FX 28 means the separate **music Spectrum**.

The source also contains 25 decorative numeric effects: 1 Blink; 3 Fade; 4 Chase/Comet; 5 Scanner; 6 Meteor; 7 Meteor Smooth; 8 Running; 9 Larson; 10 Twinkle; 11 Color Twinkles; 12 Sparkle; 13 Twinklefox; 15 Rainbow; 16 Palette Run; 17 Gradient; 18 Fire 2012; 19 Aurora; 20 Pacifica; 21 Candle; 22 Strobe soft preview; 23 Heartbeat; 24 Fireworks; 25 Elevator; 26 Cascade; 27 Height Sync. FX 34–36 are movement, and 41 is native ambient/Game input.

Saved looks carry a master on/brightness plus **all eight strip recipes**: `id,fx,pal,col,bri,sx,ix,on,rev,mi`, with resolved user palette definitions and optional music metadata. Preserve these fields; flattening to one FX/color loses the independent shelf colors that create the desktop bands. The delivered library contains 31 looks and 9 palettes. Import validation requires complete unique IDs 0–7, byte values, supported effects, and required palette definitions.

Palette blend 1 retains hard color sections; blend 0 interpolates. Speed maps to period `30-sx/255*26` for saved decorative playback. A saved palette's spatial placement, segment reversal, and mirroring are distinct from electrical endpoint calibration. Master brightness and segment brightness must be applied once at their respective stages.

Saving settings does not save effect clocks or a live microphone permission. Selecting a look must preserve active music input and pause state when intended. Base edits made while movement owns the frame must appear when that owner clears.

## 11 Music input analyzer and effects

Current browser inputs are bundled demo audio, user-local audio file, explicitly shared desktop browser audio when supported, and explicitly permitted microphone audio. The Fold 5 microphone path was exercised and the owner confirmed the lights respond. Android Chrome on the tested Fold did not expose `getDisplayMedia`; playing Spotify in another phone tab does not create a shared audio stream for the viewer.

That browser finding is not a claim about every native capture API. For Flutter, choose one authoritative source: validated host analyzer metrics, native local analysis, or WebView audio input. Verify native platform and app permissions separately. A live visualization should not label synthetic animation as the desk's actual music response. The inspected bridge currently sends settings, not analyzer metrics or rendered pixel frames.

Browser analyzer reference:

| Parameter | Value or rule |
| --- | --- |
| FFT | 2048; analyser built-in smoothing 0 |
| Bands in Hz | 20–60, 60–150, 150–400, 400–1000, 1000–2500, 2500–5000, 5000–10000, 10000–20000 |
| Magnitude | Convert decibel bins using `10^(dB/20)`, mean each band, normalize against frame maximum |
| Volume | `clamp(RMS * sensitivity * 4,0,1)` |
| Energy | Same as volume in this browser adaptation |
| Bass beat | Volume > .025, bass of first two bands > moving average×1.35, at least 250 ms since last beat |
| Bass average | Approach current bass with factor `min(1,dt*2)` |
| Band smoothing | `1-exp(-dt*rate)`; attack 24, decay 5 |
| Silence | Normalized targets zero when volume≤.005; release smoothing fades them |
| Delta | Music update clamps elapsed delta to .001–.05 seconds |

Metrics passed to `MusicSampler` are normalized floats (`bands[8],volume,energy`) plus beat flags. Native service byte metrics require a deliberate conversion. Its broader beat/structure history is not reproduced by the browser analyzer. Matching FX IDs does not establish firmware-byte parity.

These samplers are independently implemented browser preview adaptations, not literal firmware ports. For live byte metrics divide bands, volume and energy by 255; bypass the local Web Audio analyzer's per-frame maximum normalization and sensitivity scaling. Consume coalesced beat flags once per new packet, not on every render tick. See the follow-up Q&A for timing and parity limits.

| FX | Name | Main browser behavior |
| --- | --- | --- |
| 28 | Spectrum | Per-strip amplitude bars using band `7-stripID` |
| 29 | Pulse | Beat-triggered envelopes with decay |
| 30 | Comet | Bass beat toggles travel direction; slow shared-time travel, current rate constant 6 |
| 31 | Strobe | Soft periodic flash preview, volume-scaled |
| 32 | Fire | Deterministic time/pixel variation in warm hues |
| 33 | Wave | Traveling sine field along strip |
| 37 | Tower | Energy threshold across five vertical layers |
| 38 | Ripple | Traveling layer envelope |
| 39 | Bass Sky | Bass-weighted lower-layer blue/violet field |
| 40 | Drop | Bass-beat envelope and spatial modulation |

Default sensitivity is 1; public slider .5–3. Saved music recipes allow their own validated sensitivity. Use common audio/media time for all eight strips. Music output still drives the same atlas and reflection fields; there is no separate music reflection renderer.

Microphone/capture connects only to the analyser. Speaker gain remains zero for live input to avoid replay/feedback. Local song/demo playback starts muted until Hear music is selected. Stop releases every track; cancellation and a late permission grant must not restart an old source. Handle permission refusal, ended tracks, backgrounding, and disposal explicitly.

## 12 Auto DJ composition and controls

Auto DJ is a conductor over MusicSampler and complete saved recipes. Its browser timing is driven by current audio time and detected beat events.

| Program | Pool including deliberate repeats | Nominal change | Drop hold | Quiet effect |
| --- | --- | --- | --- | --- |
| Chill | 33,32,30,39,33 | 45 s | None | 33 |
| Party | 28,37,38,29,39,33,30,38 | 30 s | 6 s | 33 |
| Rave | 37,38,28,31,32,29,37 | 20 s | 8 s | 39 |
| My rotation | Rated music FX and music-capable saved looks | 30 s | 6 s | 33 |

Weights 0–4 control frequency. Saved look ratings and palette ratings are independent; changing palette frequency must not change look frequency. The shuffled deck avoids an immediate repeat where possible. Two null palette entries retain original colors alongside rated palette choices. Static/daytime looks remain outside DJ's music pool.

Mix Across Shelves can combine up to three effects using groups `[0,1,1,2,2,0,0,2]`; a flash-heavy lead is constrained to one strip during phrase mixing. A selected saved look preserves all its authored strip recipes instead of forcing those groups. Quiet and drop accents are coordinated.

Switch on the beat waits for a stable beat near the due time. Stability uses recent intervals .25–1.5 s with deviation below 22%; a bounded deadline avoids waiting forever when beats disappear. Quiet fallback occurs after volume<.035 for more than 3 s. A drop requires bass beat, energy>.6 and >average×1.7, with an 18 s minimum spacing.

Comfort controls are Standard, Reduced, Minimal. Reduced lowers flash-heavy selection frequency, skips alternating detected drops, and scales flashy strip output by .65. Minimal excludes FX 31/40 and substitutes permitted calmer behavior. These are visual comfort choices, not a certification.

Opt-in remix options cover preset effects, speed/intensity, attack/decay/punch, dynamics Off/Story/Wide, localized bursts, direction/mirror randomization, and burst shape. Defaults are off except beat alignment and shelf mixing. `DJOverlay` clones recipes, applies temporary changes, and preserves saved originals. Bursts/randomization are suppressed outside Standard comfort; reduced-motion suppresses dynamic overlays.

For visualizer parity, use these browser source modules. Changing the app's actual hardware Auto DJ composition is separate work; the older physical DJ handoff addresses that service behavior.

## 13 Game Mode

Current browser Game Mode is **Neon Flight**, an original synthetic 12 s video and optional audio with compiled RGBW banks. It is a repeatable comparison fixture, not a live screen recorder or an ESP32 capture. Manifest provenance records the actual ambient host pipeline, compiled board `Ambient.hpp`, synthetic scheduled audio metrics, raw linear drive output, brightness 255, and configured 8000 mA ceiling. That ceiling describes bank generation, not an instruction to change hardware power settings.

Four presets are Calm, Normal, Intense, Full; content is Colours or Colours + music. Calm/Normal select Colours by default; Intense/Full select Colours + music. The eight combinations are delivered.

Manifest: 60 fps, 720 frames, counts `[14,14,15,14,14,11,11,13]`. Each frame has 424 RGBW bytes; each bank has 305,280 bytes. Byte order is frame → strip ID → physical address → R,G,B,W. Validate manifest, counts, and bank length before playback.

Sampling uses `video.currentTime * fps`, linear interpolation between adjacent bank frames, and end clamping. Pause/seek must hold/update video, pixels, optional music, and the virtual monitor texture together. User master brightness remains outside the bank; optional Game maximum brightness multiplies once before upload.

**Retain the horizontal preview correction for the delivered demo bank:** reverse sampling of lateral rows 0,1,2,3,4,7; exchange source rows 5/6 without reversing their fore/aft order. If side counts differ, map normalized endpoints. The source bank itself, electrical strip map, and movement samplers are not changed. Keep this as a demo playback transform. Live `sent_keys` start without this additional mirror and use the physical address-to-model calibration exactly once; see the Q&A for the asymmetric hardware comparison needed before applying any live correction.

Game frames enter the renderer with `linear=true` as described in section 4. The temporary monitor uses an sRGB `VideoTexture` and un-tone-mapped screen material. Stop removes the temporary screen and restores accessory visibility. A live app Game visualization requires actual native captured/processed frame data or the deliberately labeled fixture; the demo does not supply a native screen-capture implementation.

## 14 Movement ownership audio and reduced motion

Current browser arbitration order is diagnostic → actual movement/completion → Game → Music/Auto DJ → saved look → decorative effect → base. Diagnostic is developer-only. Master LED off removes decorative pixel emission and all receiver strength in this browser.

Movement samplers are FX 34 lift, 35 tilt, 36 wheels. Lift up is blue, down red; toward horizontal/extend yellow; toward vertical/retract violet; wheels red with amber caution; true target completion green for 5 s. Most recently started motion axis wins. Use owner generations/revisions to prevent old stops or completion timers clearing newer motion. Resume media at its current time after an overlay clears.

The app's Dart mapping deliberately translates sticky wheel opcodes into physical drive modes only while wheels are moving. Preserve it. The browser's pose-delta wheel detection is not a replacement for the app's status translation. The browser also reverses rotation-comet travel as a visual correction while leaving physical drive IDs intact.

Keep physical safety arbitration in the native services. The browser fixture does not command the real desk. The inspected app currently lets motion cues display when decorative LED power is off, while this browser master-off policy suppresses them. Make that visualization policy explicit; do not change native safety behavior to obtain a screenshot match.

Movement sounds use bundled real MP3 files, start disabled, default volume .3, gesture unlock, and owner-scoped stop/fade. Some clips are long; do not treat every asset as a short chime. Avoid duplicating sound already played by the native app/desk service.

Reduced-motion behavior is a separate accessibility setting from DJ flash comfort: steady decorative output, static motion reference, paused Game at a static sample, static Music preview, and no dynamic DJ overlays. Backgrounding pauses playback and clears motion; capture disposal releases tracks. Restore current base edits, not a stale saved color snapshot.

## 15 Proposed Flutter integration contract

Keep existing pose schema, session/sequence validation, interpolation, safety envelope, and read-only viewer separation. Add rendering state through a separately versioned contract. The following boundaries are recommended, not existing protocol endpoints:

| Boundary | Required information |
| --- | --- |
| Appearance profile | Named renderer version, desktop variant, receiver settings, display brightness mapping |
| Resolved look | Master on/bri; eight complete recipes; resolved palettes; revision |
| Metrics input | Explicit units, eight bands, volume/energy, beat edge, source timestamp/sequence, source freshness |
| Frame input | Strip-map ID, counts, logical RGBW encoding stage, sequence/time, validated bounded bytes |
| Playback state | Owner/source, active/paused, media time, comfort, reduced motion, transition generation |
| Pose | Existing measured/interpolated height and physical tilt; wheel direction from existing app mapping |

Choose **one frame producer per mode**. For a labeled browser-style preview, reuse these samplers. For a faithful live desk preview, consume authoritative native metrics/configuration or validated native rendered frames and record their pipeline stage. Avoid running two DJ clocks or analyzing the same music twice with different normalizations.

Existing settings endpoints are not animation frames. The reviewed earlier API work did not find a general final RGBW-frame download endpoint. Verify current API capabilities before promising live frame parity; add a bounded developer/visualization stream if necessary rather than treating `/json/state`, `/json/segments`, or blank-event logs as pixels.

The inspected app accepts only schema 1 and at most 2048 message characters. Define/test a new bounded representation for richer recipes/frames; do not silently send oversized JSON. Coalesce outdated visual updates, reject wrong counts/IDs/encoding, and handle stale/disconnected sources with explicit state. Only renderer-local settings should be changed by rendering controls.

Keep all dependencies offline in the app asset bundle. `pubspec.yaml` currently lists viewer/model/led/Three.js directories; add audio/game/texture assets deliberately. The loopback server currently returns specific MIME types only for HTML, JS/MJS and GLB; add JSON/image/audio/video types for selected media. Verify seek/range behavior for video if that WebView needs it. Do not rely on the website's CDN imports for an offline app.

## 16 Recommended implementation sequence

| Milestone | Work | Completion check |
| --- | --- | --- |
| 1 Renderer baseline | Match comparison camera, finish, color space, tone map and fresh brightness; keep measured pose | LEDs off and solid RGB/white have comparable materials and contrast. |
| 2 Spatial fields | Port receiver helpers and defaults; remove old general glow on those receivers; bind pixels; retain source transforms | Separate 3/2/1 colors on desktop, soft ends, weak cage/inner wings, correct actuators and floor. |
| 3 Tilt and variants | Update from interpolated physical tilt; share rear anchor with power modules; validate source visibility and size bindings | −5 baseline, 0 front reach, +15 broad coverage, high tilt bounded, both sizes when supported. |
| 4 Recipes and effects | Complete per-strip config/palette contract, shared time and latest-base restoration | Authored shelf differences and hard palette sections remain; no double reversal or dimming. |
| 5 Music and DJ | Choose metrics source, integrate sampler/conductor/comfort and lifecycle | Silence decays; beats trigger once; audio pause/seek and changes preserve correct owners. |
| 6 Game | Bundle fixture or use validated native stream; encoding, mirror correction, synchronized clock | Video/pixels match at fixed seek positions; linear conversion happens once. |
| 7 Device acceptance | Fold cover/unfolded, small screen, offline, background/resume, context loss, long run | All controls reachable, stable allocations, audio resources released, fresh live state restored. |

Do not copy all of `studio.js` into the Flutter widget: it includes editor UI, room builders, project tools, and browser globals. Extract a small receiver/tuning module from the listed functions and inject pose, model registry, variants, renderer, pixel sampler, and current state.

## 17 Comparison and acceptance matrix

Use Black Birch/Black with red trim, a fixed camera, LEDs on, known fresh brightness, default receiver profile, and a repeatable LED-studio background. Disable movement cues during static optical checks. Record the fixture version, desktop size, pose, and all settings with each screenshot.

| Test | Expected result |
| --- | --- |
| Sequential strips and all 106 configured addresses | Correct section and recorded direction; invalid address rejected; mask retains physical indices. |
| RGB and W-only inputs | Correct logical channels; localized source colors; no duplicate gamma/brightness. |
| IDs 3 red, 2 green, 1 blue; other strips off | Rear/middle/forward bands remain independently colored. Moving an address moves its local reflection. |
| Tilt −5,0,+5,+15,+65 at safe height | Exact −5 baseline; growing front illumination through +15; no extra extension beyond +15. |
| Both desktop variants | Same IDs, correct width paths; unused variant does not double light; power-module field remains aligned. |
| Manual reach 40% | Desktop fadeReach 6.2, still multiplied spatially by current tilt scale. |
| Move camera around desktop | No view-dependent triangular seam, z-fighting, or rectangular cutoff. |
| Lift/glide/yaw/actuators | Receiver/source frames follow motion; floor follows base only; cage and inside wings stay weaker. |
| Stop/master off | All decorative emission/spill disappears; latest base state returns when an owner stops. |
| Music silence/pause/seek/end | No invented beat during silence; no duplicate edge; all strips share media time. |
| DJ comfort/rating/remix | Minimal excludes flash-heavy choices; ratings independent; remix never mutates saved recipes. |
| Game seek and side asymmetry | Video and LEDs stay synchronized; playback-only horizontal correction retained. |
| Permission cancelled or granted after Stop | No late source restart; all rejected or unused tracks released. |
| Fold cover and unfolded settings | One usable vertical scroller reaches all controls. Browser compact pages use an outer scroller and visible page overflow; avoid nested trapped scrollers in Flutter equivalents. |
| Offline/reconnect/dispose | Bundle loads without external services; stale updates cannot replace newer state; no resource leaks. |

### Existing browser evidence

On 6 October the actual latest website ZIP was unpacked and passed `led-tilt-reflection-test.cjs`; `led-pixels-test.cjs` also passed for the source viewer. These checks exercised GPU shader output, both sizes, matching power fields, bounded high-angle reach, manual controls, master off, all eight IDs/106 addresses, and RGBW/texture reuse. They do not validate a future Flutter port or current physical endpoint masks.

`TEST_EVIDENCE.json` preserves the observed front-sample GPU values. They are framebuffer bytes under an isolated test shader, not physical brightness percentages or lux measurements.

The four pure sampler tests listed below also passed directly from the delivered `browser-reference` directory: Game horizontal correction, Auto DJ, Music/decorative effects, and saved presets.

Rendered Extended comparison: [−5 degrees](evidence/tilt-60x30--5.png), [level](evidence/tilt-60x30-0.png), [positive 15 degrees](evidence/tilt-60x30-15.png). Standard equivalents are also included. [Owner supplied Studio view](evidence/owner-studio-surfaces.png) shows the material/field appearance under a lighter room scene; its saved slider values differ from defaults. [Owner supplied Reggae view](evidence/owner-reggae-bands.png) shows separated moving-color pools.

### Test files to reuse

The delivered `browser-reference/tests/` contains pixel/tilt, decorative, movement, Game, Music, DJ, saved-look, mobile-audio, and command-scroll tests plus movement fixtures. Browser harnesses assume the Custom Shop DOM/API. Port their assertions to app tests rather than expecting them to target the Flutter viewer unchanged. `desk_led_test.dart` is included as an app-contract reference.

Runnable tilt check after installing the dependencies specified in `browser-reference/package.json`:

```bash
cd /absolute/path/to/browser-reference
npm install
node tests/led-tilt-reflection-test.cjs
```

From the same directory, pure sampler examples are `node tests/led-game-horizontal-test.mjs`, `node tests/led-auto-dj-test.mjs`, `node tests/led-music-effects-test.mjs`, and `node tests/led-custom-presets-test.mjs`. Some browser tests need additional dependencies/assets documented in their source; the self-contained tilt test targets the included product viewer.

## 18 Delivered files and source navigation

| Path | Contents |
| --- | --- |
| `HANDOFF.md` | This guide |
| `ENGINEER-QA.md` | Five follow-up answers and live integration clarifications |
| `VISUALIZER_CONTRACT.json` | Machine-readable strip/receiver/default/band/tilt/input contract |
| `SOURCE_INDEX.json` | Function/file line anchors for browser and inspected app snapshots |
| `MANIFEST.json` | File hashes, release, repository identities, provenance |
| `TEST_EVIDENCE.json` | Recorded completed tilt/pixel and bundled sampler checks and their limits |
| `browser-reference/` | Exact verified latest website release, current shaders/effects/assets, package metadata |
| `native-source/` | Selected inspected app files and limited hardware configuration excerpts |
| `browser-reference/tests/` | Current source tests and fixture files |
| `evidence/` | Rendered −5/0/+15 comparisons for both sizes and owner-provided visual references |

To inspect the website reference, serve `browser-reference` over HTTP and open `product-demo.html?v=desktop-tilt-reach-20261006`. Its import map currently fetches Three.js 0.163.0 from the CDN; internet is needed for this standalone reference unless those imports are redirected to local modules. Flutter should continue using its own bundled Three.js and matching loader/helper versions.

### Primary browser source map

- [studio.js](browser-reference/studio.js): `LED_SURFACE_DEFAULTS`, `updateLedEffectFrame`, `bindLedPixels`, `setLedsEnabled`, `updateDesktopReflectionTilt`, `addLedSurfaceSpill`, `addLedWingSpill`, `addLedUprightSpill`, `addFootLedFloorGlow`, `loadLedOverlay`, `syncLedSizeGeometry`, `applyTiltConfig`, `createStudioEnvironment`, `applyRoomLighting`, `applySurfaceFinish`.
- [led-pixel-renderer.mjs](browser-reference/led-pixel-renderer.mjs): atlas upload, strip path binding, local spill sampling, three-source band blending.
- [led-strip-map.mjs](browser-reference/led-strip-map.mjs): physical IDs, counts, endpoints, visibility masks and diagnostics.
- [led-effects.mjs](browser-reference/led-effects.mjs) and [led-showcase-effects.mjs](browser-reference/led-showcase-effects.mjs): base/decorative/music samplers and analyzer.
- [led-music-mode.mjs](browser-reference/led-music-mode.mjs): input selection, analyser, media time, source release and DJ integration.
- [led-auto-dj.mjs](browser-reference/led-auto-dj.mjs), [led-dj-overlay.mjs](browser-reference/led-dj-overlay.mjs): conductor, weighted library, mixing, comfort and temporary remix.
- [led-custom-presets.mjs](browser-reference/led-custom-presets.mjs), [led-saved-library.mjs](browser-reference/led-saved-library.mjs): recipe validation/rendering, palette sections and delivered library.
- [led-game-mode.mjs](browser-reference/led-game-mode.mjs), [led-game-frames.mjs](browser-reference/led-game-frames.mjs), [Game manifest](browser-reference/assets/led/game/manifest.json): timeline, bank validation, horizontal correction and provenance.
- [led-movement.mjs](browser-reference/led-movement.mjs), [led-sounds.mjs](browser-reference/led-sounds.mjs): movement owners, samplers, completion and sound cleanup.
- [led-command-center.mjs](browser-reference/led-command-center.mjs), [app-remote.css](browser-reference/app-remote.css): customer controls and compact scroll behavior.

The source snapshots provide exact algorithms. Any change to the app's actual LED firmware, native music analysis, hardware power settings, or safety arbitration should be reviewed and tested in that project's own workflow.
