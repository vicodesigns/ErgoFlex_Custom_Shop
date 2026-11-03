# ErgoFlex intro: final picture-lock review, round 3

Reviewed file: `final/ErgoFlex-Intro-WIP.mp4` (173.5 s, 1080p30, built 10:51 from the current renders; all 12 renders run their full locked length, so the `tpad` clone never shows).
Evidence is in `review/final/`: `frames/` (every 0.5 s), `sheet-NN-*.jpg` (timestamped contact sheets per chapter), `stills/sNNN.NN.jpg` (full-res stills at titles, dissolve midpoints and screens), `frame-analysis.txt`, `screens-freezedetect.txt` and the crops named below.

Method: CPU ffmpeg, one process at a time. I ran a whole-film per-frame decode (black frames, frozen runs, luma/colour jumps), freezedetect on every screen clip, and read 1-frame strips at every suspect moment. Audio is clean: -16.0 LUFS integrated, true peak -1.8 dBFS. There are no black frames mid-film, and the only fully static stretch is the end-card hold (169.4–172.2 s). All 11 dissolves match `edl.json` (1.5/0.8/0.8/0.6/0.6/0.8/1.5/1.5/1.0/0.8/1.5 s, centred on the EDL points; see `dissolve-midpoints.jpg`). No two titles collide, and none starts inside a dissolve (ch 12 starts 0.1 s before its dissolve ends, at about 15% opacity, which no viewer will see).

## Verdicts

| # | chapter | verdict | notes |
|---|---|---|---|
| 1 | awaken | **PASS** | Charcoal wheels, faded grid and new rig all read. The twin screen tracks the desk: 28.0″ "Move forward" ✓ at 5 s; 45.5″, 8° tilt and "Twin synced" at 19.5 s. Title A at 3.6 s clears the leg. |
| 2 | rise | **FIX (post-only)** | The tap on **Standing** (33.5 s) lands inside the 1.5 s ch1→2 dissolve (32.5–34.0), at about 50/50 with the ch 1 desk ghosted over the tablet (`stills/s033.50.jpg`). The app's 3D desk, LED and readout all play correctly. The lift reads, modestly: the readouts track exactly (43.5″ at 39.0 s, 46.0″ at 41 s, 52.5″ at 44 s), the menu-bar widget follows, and morning→evening plus the wall clock both land. |
| 3 | create | **FIX (re-render)** | A one-frame prop pop at **57.53 s**: the drafting sheet and board vanish and the easel sticks and canvas appear between two frames, in clear view (`ch3-pop-57.50-57.53-pair.jpg`). The 25° drafting kit (48–56 s) and the 65° canvas from the front 3/4 (60–64.5 s) are good, and the painting timelapse and "Surface 24°/65°" chip track the tilt. |
| 4 | commons | PASS with notes | The whiteboard plays and notes are added. The detail line runs onto the brighter floor and wall edge at 66 s (see post wins). |
| 5 | coast | PASS | The wall reel, NLE and colour page all play. |
| 6 | oilers | PASS | The orbit sim plays, and the quiz flips to the dashboard on time (~93.7 s). |
| 7 | wellness | PASS | The readout tracks the lift: 28.0″ / 0% at 98 s and 37.9″ / 65% at 101 s, matching the clip. |
| 8 | awareness | **FIX (or waive)** | The void rig, grid and wheels are fine. But the radar screen is **never visible**: the whole chapter looks at the back of the monitor, from the side (108.5–113 s) and then from overhead (`stills/s111.50.jpg`, `s117.00.jpg`). So the "radar tracks the roll" sync can't be seen, and this is the one chapter with no live screen on camera. |
| 9 | music | PASS with notes | The cuts sit on the 3-beat grid (121.3/122.9/124.4/126.0/127.6/129.1/130.7). The 1985→2023, 1992→2017, 1993→2023 and 1993→2021 pairs read as "then vs now". The room follows the picture (green on the kart shots) with eased 4–6-frame ramps. Note: the year badge sits on top of the game's own HUD on the 2023 *Wonder* shot (badge over the "07" lives icon, at 121.3–122.9 s) and touches the item HUD on the 2017 *MK8* shot (`09-montage-src-sheet.jpg`). |
| 10 | media | PASS | The movie plays at the correct aspect, the desktop LED stripes follow the picture, and the spiral lamp is off (`ch10-lamp-crops.jpg`). The fastest room change is 140.1 s, about 0.2 s on a movie cut, which reads as motivated. |
| 11 | storage | PASS | The gauge tracks the fold (63° / 98% at 150 s, then 65° with "Roll 73%" at 155 s), then "Floor is yours". |
| 12 | hero | PASS | Grid gone by the end card, smaller wordmark lower in frame, move ends on a 3/4 (`stills/s170.50.jpg`). The home screen dims into a quiet brand loop. |

## Must fix before shipping (ranked)

1. **Ch 3, 57.53 s: hard 1-frame prop swap.**
   - What's wrong: at the 50° stow threshold (the easel clip runs 7.6 s + 5 s smooth, and 50° falls at t = 10.52 s), the app's auto-stow removes the drafting kit and board and adds the easel with canvas, all in one frame. The camera is not edge-on yet: the edge-on key is at 10.8 s, 0.28 s later, and the board face and sheet fill the lower right (`ch3-swap-56.9-57.7-frames.jpg`). Any viewer will see it.
   - Fix (re-render `shots/03.json`): make the crossing happen while the board top is off-screen.
     - Delay `motion.clips[easel].start` 7.6 → **7.9**, so 50° falls at 10.82 s, on the edge-on key.
     - Pitch the 10.3–11.0 s camera away from the board top so the easel area is out of frame at the crossing. Lower the 10.8 s key's target y from 1.70 to about **1.35**, or move the 10.8 s key 0.3 m further −x so the monitor stack covers the board.
     - Check at 1-frame resolution: `--at 10.4,10.45,…,11.0`.
     - If the harness can fade stow and unstow over about 0.4 s instead of toggling them, that fixes it outright.
   - Stopgap if a re-render is impossible: freeze frame 57.50 and dissolve it into the live picture over 8 frames (57.50–57.77). There will be some ghosting, but no pop.
2. **Ch 2, 33.5 s: the app tap is buried in the dissolve (post-only).**
   - What's wrong: the new opening beat is the tap on Standing, but it plays at about 50% opacity under the ch 1 desk.
   - Fix in the finisher: change transition 1 from `duration=1.5:offset=32.5` to **`duration=0.8:offset=32.5`** (it then ends at 33.3 s, 0.2 s before the tap). Ch 1's last 0.7 s isn't needed, nothing else shifts, and title rise-2 at 34.1 s is unaffected. If the centre must stay at 33.25, `duration=0.5:offset=33.0` also works, but it's tight: the tap lands on the last frame of the dissolve.
3. **Ch 8: no live screen on camera (decide: re-render or waive).**
   - What's wrong: `08-main.mp4` (the proximity radar) is mapped, but the monitor faces away from camera for all 12 s. The brief's "content in every chapter" and "radar tracks the roll" aren't met.
   - Fix if you want it: make the 4.4 s key a front-high 3/4 from the user side (mirror x: about **(+4.3, 3.2, −1.1)**, target unchanged), so the radar is readable as the pylons rise. Then crane to the overhead for the roll as now. The roll (7–9.8 s) happens on the overhead, where the screen can't be read. So the radar will sell the setup ("Path clear", blips lighting), not the roll itself. Re-run the `08-main` capture only if the motion clip is retimed.
   - Waive: drop the screen claim for ch 8. The chapter is visually fine as a pure product-void beat.

## Should fix if ch 9 is re-rendered anyway (not blocking)
- `09-game-montage.mp4`: move the badge for the 2023 *Wonder* and 2017 *MK8* shots away from their HUDs, for example to the bottom-left of the 21:9 centre band, or nudge that shot's crop down 6–8%. The DOOM shot's cover-crop also clips the bottom of its status bar.

## Quick post-only wins (no re-render)
- **Transition 1** (if you're not taking it as must-fix #2): offset 32.5, duration 0.8.
- **Ch 4 scrim:** the title scrim is at `\1a&H90&` while ch 2/3 use `&H38&`. "Roll your workspace into the conversation." runs onto the bright floor/wall edge at 65.5–67 s. Use `&H60&` for commons-4.
- **Ch 2→3 brightness jump:** mean luma goes 81 → 122 across a 0.8 s dissolve, so ch 3 pops bright and flat. On `[2:v]`, set gamma 0.96 and pull the highlight curve point 0.88/0.84 → 0.88/0.81.
- **Ch 11 teal cast:** RGB means are 33/60/63. Raise `colorbalance` rm .025 → **.04** and add gs −0.01 to take the green-cyan off the walls without touching the teal desk.
- **Ch 12 end card** (mean luma 8.7): the desk reads, but it's very dim. A local lift of gamma 1.06 on `[11:v]` from t ≥ 8 s would help (or raise the screen-glow opacity 0.11 → 0.14 for that input only). The 2.8 s fully static hold before the fade is fine for an end card. If you want it alive to the last frame, add a 1% `zoompan` creep from 169 s.

