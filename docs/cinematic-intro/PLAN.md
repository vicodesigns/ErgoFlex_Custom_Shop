# ErgoFlex cinematic intro and unified app experience

Status: playable intro implemented, 26 October 2026. See [IMPLEMENTED.md](./IMPLEMENTED.md)
for delivered features, verification, and the current Flutter integration boundary.
The architecture below records the original direction and future consolidation work.

## Creative direction

An 85-second first-visit introduction: **one desk, a day of possibilities**.
Keep the user's obsidian/blue-neon opening and cyan finale, then use actual
ErgoFlex environments to explain features through situations. Hold each key
movement long enough to understand it. Use match cuts around the same desk
silhouette, with a few continuous camera moves; avoid a rapid room slideshow.

| Time | Setting and action | Overlay / sound |
|---|---|---|
| 0–8 s | Obsidian stage. Blue floor pulse reveals four mecanum wheels, then the desk. Low camera follows a short lateral glide and turn. | “Meet your digital twin.” Sub-bass sweep, restrained mechanical roll, arrival chime. |
| 8–19 s | Match cut to Home Office morning. Seated-height desk rises to standing; chair clears its movement. Overhead task lighting comes up. | “Your height. Your rhythm.” Lift hum, soft pulse, sparse motion trace. |
| 19–28 s | Artist Studio. Tilt passes 9° and loose desktop items stow on the shelving. Drafting setup becomes an easel composition near full tilt. | “From focus to creation.” Small mechanical accents and warm texture. |
| 28–39 s | Humboldt Commons: the desk joins a shared table with an unobstructed approach. Match cuts to OCC media collaboration and HBHS mixed black/orange and white/orange desks. | “A place for everyone.” Music opens up; clear personal-to-shared-space story. |
| 39–49 s | Home Gym / Home Office. Coach prompt: “Ready for a movement break?” A clearly staged acceptance leads to a short exercise demonstration and a return to work. | “Make movement part of your day.” Prompt chime; narration, if enabled, briefly ducks music. |
| 49–61 s | Clean proximity demonstration stage. Three simulated pylons rise, sweep resolves around the desk, then a short strafe shows changing clearance and a stop before contact. | “Move with awareness.” Radar sweep and gentle stop tone. Small “Demo” label for simulated status. |
| 61–75 s | Gaming / music room. Actual audio drives the LED effects, then an OCC or home media setup shows video on a curved monitor. Screen colours spill onto the desk and room. | “Music. Media. In sync.” Beat drop, RGB cascade, then a deliberate pause to read the video-and-light connection. |
| 75–81 s | Library or classroom closes for the day. Desktop supplies stow, desks fold to 65° and park along clear wall bays, opening the room. | “Make room for what’s next.” Rhythm resolves; floor space becomes the visual payoff. |
| 81–85 s | Cyan-lit hero shot. Camera settles and the real app controls begin to appear in their final location. | **Enter Interactive Experience**. Resolution chord into quiet ambience. |

The wellness prompt is a scripted demonstration during the reel. Actual onboarding
and interactive movement use the app's existing user action and consent flow.
Voice/biometric badges show demo capability, not a fabricated live connection.

### Two deliverables from one shot library

- **Main intro:** 85 seconds; first-visit playback, always skippable, replay from
  Help/Explore. Immediate muted playback once ready; explicit sound control.
- **Social reel:** 30 seconds: 4 s reveal, 5 s lift/tilt, 5 s inclusive spaces,
  4 s proximity, 7 s music/media, 3 s storage, 2 s hero/CTA.
- Compose shots for both 16:9 and 9:16. Reframe subjects and UI for vertical;
  do not simply crop the desktop capture. Support Fold 5 folded/unfolded resizing.
- Use a cleared bundled track or an original score, with separate music,
  mechanical sound, and optional narration buses. A silent version must still
  explain the story through movement and captions.

## Reference build inspected

URL: http://localhost:4190/

Serving process directory:
`/home/ergo/ErgoFlex_Desk_Stack/CoachTours_Worktree/ergoflex_app`

Published directory: `build/web_live`.

The live page was opened and its demo entry/onboarding inspected. The onboarding
requires a body profile before reaching the main controls; no personal profile
was entered. Full UI parity has therefore **not** been visually certified yet.
The feature findings below are grounded in source inspection. Three relevant
viewer files were byte-matched to the served build:

| File | Served SHA-256 prefix | Source matches |
|---|---|---|
| desk_viewer/desk-viewer.js | 804757f01248f8b5 | Yes |
| desk_viewer/env/media-screen.mjs | 9f9f4ad3d82ff582 | Yes |
| desk_viewer/led/music-input.mjs | 80d19ef72131ab76 | Yes |

### Feature map

| Area | Reference implementation | Custom Shop integration work |
|---|---|---|
| Real app controls | `lib/screens/main_screen.dart`, `responsive_main_screen.dart`, appbar and Glide/Lift/Tilt panels | Use these widgets/behaviours as the reference. Current `studio.js:buildMotionRemote` is a separate web remote, with some disabled features; it is not parity-complete. |
| Music | `lib/demo/demo_media.dart`, `demo_music_player.dart`, `desk_viewer/led/music-input.mjs` | Reuse player semantics, tuning and analyser behaviour. Shop already has `led-music-mode.mjs`; compare effect IDs, input packets and output before consolidating. |
| Media | `desk_viewer/env/media-screen.mjs`, `DeskSceneMessage.musicVideo` | Bring curved 34-inch/21:9, 1500R display, centred fill, seat camera, room dimming and picture-driven LED behaviour into the richer environments. |
| Proximity | `lib/demo/demo_scan_show.dart`, `desk_obstacles_message.dart` | Preserve staged rise, readable sweep, movement and recede. Convert bearing/coordinate frames explicitly. Shop already has geometry collision/Shield logic; reuse its clear-route checks. |
| Rooms and activities | App `DeskSceneMessage` currently names home/none; Shop has the full room catalogue | Extend the versioned room contract for room ID, layout, time/activity, size and preset. Keep the Shop environments and saved school builds authoritative. |
| Wellness and onboarding | `clinical_onboarding_screen.dart`, `post_onboarding_intent.dart`, `welcome_tour_coordinator.dart` | Intro ends at the existing onboarding entry. Incomplete profiles proceed normally; returning users enter the app. Let the existing coordinator start `coach.welcome` once, after readiness. |

## Integration architecture

### One maintained UI and one viewer connection

Use the Flutter app as the controls/onboarding host. Add a presentation-only
entry to the Custom Shop viewer so it can run within the app's existing iframe
(web) / WebView (native) model. Expose the same Flutter control widgets in the
compact and expanded presentation, with consistent labels, values, units,
icons, modal behaviour, and STOP handling.

Keep the standalone Shop entry functional. Its store/design controls are still
useful; the new app presentation mode supplies the polished app interface.
Avoid running two WebGL scenes merely to place the Flutter controls over the
Shop. The viewer should remain a display recipient; demo orchestration uses
virtual state and must not issue real desk movement or hardware commands.

Build a versioned adapter around the existing `desk.*` and `scene.*` message
families. Normalize lengths, angles and poses at the adapter boundary. The app
viewer uses an authored inches frame with +X toward the seated user; Shop room
geometry uses millimetres before world scaling. Verify forward/left bearings,
wheel directions, lift, shelf attachment and tilt pivots with shared fixtures.
Use explicit source/origin checks for web messages and a capabilities handshake.

### Cinematic player

A data-driven timeline owns the camera, room changes, virtual desk poses,
captions, transient effects and audio for the duration of the intro. Chapters
are reusable for the short cut. The timeline waits for assets/pose readiness;
it does not start an arbitrary timer while the desk is still loading.

- One clock coordinates camera, movement, audio and LEDs. Pause on a hidden
  tab; resume cleanly without a large motion jump. Seeking must restore state.
- Load the current and next chapter's heavy assets, with a bounded cache for
  phones. Use a fade through black when switching full environments is too
  expensive for a smooth camera match cut.
- Keep the 4190 music/video assets and interfaces behind the adapter. Resolve
  media paths per host; do not hard-code localhost ports into the final build.
- Intro runs against a disposable demonstration state. Disable autosaving for
  its temporary configurations. On skip, error or finish, stop motion/audio,
  remove transient pylons/trails, and restore the user's selected build,
  artwork, size-specific edits, scene and camera before the normal handoff.
- Skip, mute, replay, keyboard access, reduced-motion option and touch-safe
  captions are part of the first implementation. Autoplay audio starts only
  after a user gesture; no permission dialogs for microphone/camera capture.
- Intro completion has a versioned flag separate from clinical onboarding and
  tutorial progress. Replaying a reel must not reset tutorials or wellness data.

## Implementation order and acceptance

1. **Reference parity capture.** Review the fully loaded reference controls with
   a disposable demo profile. Inventory compact/expanded views, themes, panels,
   states and responsive sizes. Compare web and Flutter event semantics.
2. **First playable slice.** Build the reveal → lift → tilt → skip/restore → CTA
   path in a separate preview entry. Test that existing saved desk graphics and
   both size setups remain byte-for-byte unchanged after playing/skipping.
3. **Reference feature adapter.** Connect media/music, staged proximity scan and
   overhead lighting; verify the result against the served 4190 build. Keep
   simulated telemetry distinct from actual hardware status.
4. **Full story.** Add the environment match cuts, wellness demonstration,
   inclusive shared-table moment and 65° wall parking. Use the current authored
   room layouts and validated movement routes.
5. **App handoff and polish.** Match the reference controls visually and
   behaviourally, integrate the existing onboarding coordinator, finish audio
   and typography, test Fold 5 portrait/landscape and folded/unfolded modes.
6. **Reel output.** Capture deterministic 16:9 and 9:16 cuts from the same shot
   definitions. Verify video aspect/fill, audio sync and text-safe framing.

Completion gates: all skip/pause/replay/finish paths stop motion and audio;
no demo writes to saved designs; no duplicate tutorial launch; correct media
frame sampling and LED sync; no floor/furniture intersections; valid room
asset readiness and mobile fallback; reference UI parity checklist completed.

## Scope of this planning pass

Completed: local-build identification, onboarding inspection, source/served
viewer comparison, feature map, 85-second storyboard, 30-second cut and staged
integration/verification plan. No live app controls, presets or room source were
changed during this planning pass. The full cinematic and 1:1 control migration
remain implementation work, not completed features.
