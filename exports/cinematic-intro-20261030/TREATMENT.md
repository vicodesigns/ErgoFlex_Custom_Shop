# ErgoFlex intro — final cut treatment (2026-10-30)

The first thing a new user sees: "New user" → **this film** → onboarding. It plays
in the Flutter app and on the website (16:9, letterboxed on phones/folds/panels).
Source: the 2026-10-29 Director cut (`../cinematic-intro-20261029/cut.json`), 12
chapters, 4:16. This pass re-shoots every chapter and finishes the film at ~3:00.

## The bar
A premium product film, like Apple, Herman Miller and Teenage Engineering spots.
Every frame is composed and every move is motivated. The camera is never
accidental, never jerky, never inside geometry, and the film never rests on
dead air. The desk is the hero, and each environment is a world that desk lives in.

## Problems in the 10-29 cut (fix all of them)
- The camera passes through walls, floor slabs and ceilings, leaving large white or grey wedges and visible slab cross-sections:
  ch 2 end, 3 start, 5 end, 6 end, 11 end.
- ch 10: a floor-lamp shade fills a third of the frame for most of the chapter.
- The "dollhouse in a black void" establishing shots (ch 4, 5, 6, 11) leave the room tiny in black for ~3 s and read as unfinished.
- Stop-start camera: every key decelerates to a stop because the stage eases per segment. Use `camera-spline.mjs`.
- Chapters run long with idle holds. ch 1 is 52 s. The film is 4:16.

## Locked timeline (render exactly these durations)
Each chapter renders with **0.75 s handles at head and tail**. Those handles
dissolve into the neighbouring chapters, so nothing important happens in them,
but the camera keeps moving through them (no frozen frames). Durations below
include handles. Need more time for a believable desk movement? You may add up
to +2 s. Report the final number.

| # | id | room | dur s | Title | Supporting line |
|---|----|------|------:|-------|-----------------|
| 1 | awaken | product void | 34 | **Level up your every day.** (beat A, ~1.5–8 s) | Better health. Clearer focus. More joy in how you work. |
|   |        |              |    | **Meet your partner in health.** (beat B, ~16–23 s) | ErgoFlex moves with you. Sit better, move more, feel your best. |
| 2 | rise | home office | 16 | **Your height. Your rhythm.** | Sit to focus. Rise to 52.5″ to recharge. |
| 3 | create | artist studio | 18 | **From focus to creation.** | Draft at 25°. Paint at 65°. Everything within reach. |
| 4 | commons | library | 14 | **A place for everyone.** | Roll your workspace into the conversation. |
| 5 | coast | OCC media lab | 11 | **Ideas become stories.** | Your own station inside a shared media lab. |
| 6 | oilers | HBHS classroom | 11 | **Room to discover.** | A classroom built for every way of learning. |
| 7 | wellness | gym | 15 | **Make movement part of your day.** | Pause. Stand. Breathe. Reset. |
| 8 | awareness | product void | 12 | **Move with awareness.** | Proximity sensing keeps every move clear. |
| 9 | music | gaming room | 14 | **Feel the room come alive.** | Light that moves with your music. |
| 10 | media | home office, night | 14 | **Movie night, upgraded.** | Ambient color that follows every scene. |
| 11 | storage | library | 17 | **Make room for what’s next.** | Fold to 65°. Roll to the wall. The floor is yours. |
| 12 | hero | product void | 14 | **Your space. Reimagined.** (~1.5–6 s) | One desk. A day of possibilities. |
|    | end card | (over 12) | last ~6 s | ErgoFlex wordmark | **Let’s build yours.** → onboarding |

Titles sit lower-left inside the 90% safe area (x ≥ 96 px, bottom margin ≥ 108 px
at 1080p). For the **first 7 s of every chapter**, keep the lower-left third of
the frame calm: no hero action and no busy high-contrast detail there. ch 1 beat B
and the ch 12 end card follow the timings in the table.

## Camera language (every chapter)
- **2–3 motivated moves per chapter**, each with a reason: reveal, follow the desk's motion, or land on the payoff. Camera speed changes only where you mean it to. Build continuous moves with `cameraPlan` + `camera-spline.mjs`.
- **Always alive.** The longest fully static stretch is ~1.5 s, and only on a payoff. Otherwise keep a slow drift (push, crane, arc or slide) even during holds.
- **Lens.** Product void: telephoto feel, FOV 22–32. Interiors: FOV 34–48. Avoid FOV > 55 (distortion) except for a deliberate low hero.
- **Composition.** Rule of thirds. The desk is the clear subject in every desk chapter. Lead room in the direction of motion. Horizon level unless a tilt is the move. Real foreground parallax (plant, chair back, shelf edge) is welcome only while it occupies < 20% of the frame and stays soft at the edge.
- **Hard rules.** The camera stays inside the room volume: above the floor, below the ceiling, at least ~0.3 m from walls and furniture. It never passes through geometry, slabs or ceilings. No "room in a black void": if a shot shows exterior walls, the room fills ≥ 85% of the frame and the camera is already craning in. Nothing may cover > 20% of the frame for more than 0.5 s.
- **Shot-to-shot flow.** Note the direction of the chapter's final move (e.g. "push in, screen-right"). The next chapter opens with a compatible move so the dissolve feels like one gesture. Alternate scale: a wide or establishing beat, then intimate desk detail, then the payoff.
- **Desk performance.** You may retime and re-ease the motion clips (`motion.clips[].start/duration/easing`) so the action lands on the beat. Keep movements physically believable: at most about 1.5× faster than the 10-29 cut. Don't remove a chapter's signature movement (lift, tilt, storage park, proximity sweep, the opening roll-in/rise/turn).

### Chapter direction notes
1. **awaken.** Open from black on an extreme low, slow push across a wheel and the lit underside rim (FOV ~24). The desk rolls in toward camera. Pull out to reveal the full silhouette for **"Level up your every day."** Follow the rise, strafe and turn with a long arcing move. Then a low-angle hero on the full lift with the tilt, then settle on a 3/4 portrait for **"Meet your digital twin."** End with a slow push in. Compress the idle gaps from the 10-29 version.
2. **rise.** Start seated at eye level, close, through a soft foreground (plant or chair back). Pedestal up *with* the lift as it rises, so the camera matches its speed. Land on a low 3/4 at full height with the window light behind. Stay inside the room.
3. **create.** Overhead "top shot" of the drafting surface at 25°, crane down and arc to a side profile as it tilts to 65°, then land on an easel portrait with the window/studio behind. No wall clipping at the start.
4. **commons.** Start *inside* the commons at table height, sliding past chairs. The Humboldt desk rolls through the space, and the camera tracks alongside. End on a group composition. No void establishing shot.
5. **coast.** Lateral dolly along the row of media stations at ~1.3 m height, past the green screen and the big display, landing on the hero ErgoFlex station. Stay below the ceiling.
6. **oilers.** Rise up from behind a student desk to reveal the classroom and the ErgoFlex station, then push gently toward it. Stay below the ceiling.
7. **wellness.** Seated working view, then the lift to standing (camera rises with it). Slow arc to reveal the gym, with the window light. Leave room for "Pause. Stand. Breathe."
8. **awareness.** Low, close on the base, then crane up overhead as the proximity sweep and pylons rise. Hold a graphic top-down composition (symmetry) while the desk moves. Keep the product void dark and premium.
9. **music.** Dark, moody gaming room. Slow push through the room toward the glowing desk, with a low lateral move that catches the reactive light on the surfaces. No black wall slabs at the edges.
10. **media.** Night home office. A slow dolly toward the curved screen from behind or beside the chair, then a hold on the picture and the ambient spill. **Remove the lamp occlusion entirely.**
11. **storage.** The working library desk tilts to 65° and rolls to park at the wall. Track the route at human height, then rise (still below the ceiling) to reveal the open floor. No ceiling-wedge ending.
12. **hero.** Slow, reverent orbit on the hero desk in the void, telephoto (FOV ~26). Then a very slow push-out with the desk centered in the upper-middle third, leaving the lower half clean for the end card from ~8 s. The last 2 s may be nearly static.

## Tools and workflow
- Shot files: `shots/NN.json` (one chapter each). **Edit only the chapters you own.**
- Continuous camera: add `cameraPlan` (see the header of `tools/experience/camera-spline.mjs`), then run `node tools/experience/camera-spline.mjs shots/NN.json`. That rewrites `camera.keys`. Positions/targets are world units (≈ metres). The old keys in each file are a good reference for room scale and coordinates.
- Check stills fast (~5 s per chapter): wrap the shot in a cut and run
  `node tools/experience/render-cut.cjs --cut <cut.json> --shots 0 --out <dir> --stills 16` (or `--at 0,0.1,…`). Read the contact sheet. Iterate until every frame is clean.
- Explore coordinates: the stage runs in an iframe page (see `stage()` in render-cut.cjs). `window.ErgoPresentation.captureCamera()`, `cameraKeys()` and Three.js scene objects are available there if you script your own probe.
- Final render (one GPU job at a time per agent; at most 2 machine-wide):
  `--video --blur 4 --ss 1.5` → `renders/NN.mkv` (about 0.5 s per output frame).
- After the final render, write `review/NN-sheet.jpg` (24 stills, `--stills 24` from the final shot JSON) and append notes to `review/NOTES.md`: final duration, final-move direction, title-safe confirmation and any compromises.
- **Do not edit app code** (`experience/`, scene and room modules, `studio.js`, …). If a scene problem can't be avoided by camera work, report it.
