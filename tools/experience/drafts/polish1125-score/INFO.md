# polish1125 score: chapter 1 at 48.3 s, the film and its score in step (Nov 25 2026)

Vico exported chapter 1 (awaken) at 48.3 s at 13:00 and 13:14 (was 44.85 s, +3.45 s to show the tray). His import reached
review-cut.json and director-camera.json. The EDL, the score and the chapter's render source did not, and
`build-cine-score.py --check` failed with 16 problems.

**New film length: 250.22 s** (was 246.77 s). Rise starts at 46.8 s (was 43.35), the hero at 224.27 s (was 220.82), the end card
(wordmark) at 244.64 s (was 241.19), cut to black at 250.22 s.

## How Orch runs it

```
python tools/experience/drafts/polish1125-score/run-all.py exports/cinematic-intro-cut-vicos-3rd-cut --dry-run   # writes nothing
python tools/experience/drafts/polish1125-score/run-all.py exports/cinematic-intro-cut-vicos-3rd-cut             # after Vico says go
```

Run it with PYTHONUTF8=1 and a `python3` on PATH (the pages step calls `python3`), and not while the director-import watcher
is importing. Running it again is safe: the pass and pages step rewrite nothing, the pins step sees its own pins, and the
score is rebuilt with the same result. It needs this branch's importer fix (commit 1, below). Without that fix it stops and
says so. The dry run does every step on a temporary copy of the cut, using the score's `--plan` instead of building the WAV,
and lists what would change in each file.

## Steps

1. **The pass** (`build-round8-director.py <cut>`). The film renders awaken from `previews/awaken-v5-cut.json` (see
   chapter-keys.py, render-request.sh and docs/awaken-foot-light/README.md), and the Director's film shot is made from that
   file. Until now the pass wrote an awaken import into review-cut.json only, so the render and the Director both still had
   the 44.85 s chapter.
   - Importer fix (build-round8-director.py `apply`): the pass now also writes awaken's seconds, cameraPlan, camera, motion
     and ledStatus into that file.
   - Its own look fields (sceneEdits, sceneGlobals, screens) are left as they are.
   - The lighting, props and tray steps already wrote that file before this fix: that is how Vico's 13:00 lighting and tray
     keys already got there.
2. **The pages step** (`--pages awaken --downloads <cut>/director-import`). This rewrites director-film/awaken.json (now
   48.3 s), so a reopened chapter 1 shows Vico's cut.
3. **score-pins.json** (backed up first). Pins go on every dissolve bar line from rise->create to storage->hero, at the old
   score's times +3.45 s. The awaken->rise line is pinned where the fit puts it with those fixed: 46.9 s.
4. **`build-cine-score.py <cut>`**, then `--check`.
5. **looks.py**, for information only. The hero's desk-version fades already sit on its bar lines (B->C 5.04 s, C->D
   9.34 s, D->H 15.08 s), and the hero's bars are unchanged relative to the hero. So: no hero edit, and the hero does not
   re-render.

## Music: options and choice

+3.45 s is 1.64 bars at awaken's old 114.29 BPM, so awaken cannot keep its tempo in whole bars. The anchors are fixed by the
picture: title B is at 12.4 s (+-0.05 s), and the awaken->rise dissolve centre is at 47.2 s (+-0.3 s).

| option | awaken (twin section) | rise | create .. hero | Vico's 48.3 s picture |
|---|---|---|---|---|
| **chosen: whole bars, tempo nudge** | 15 -> **16 bars**, 114.29 -> **111.47 BPM** | 13 bars, 113.25 -> **111.63 BPM** | identical, +3.45 s | kept exactly |
| A: old 3 pins +3.45 s | 66 beats = 16 bars + **a 2/4 bar**, 113.31 BPM | identical | identical | kept |
| B: awaken 46.95 s | 16 bars at 114.29 | identical | identical | **-1.35 s** cut from his tray shot |
| C: awaken 49.05 s | 17 bars at 114.29 | identical | identical | **+0.75 s** added to his chapter |
| D: 16 or 17 bars, rise pinned | 109.9 or 116.7 BPM average | steps of 3 % at the dissolve | | over the 3 % bend and 1 % step caps |

Why the chosen option:
- No 2/4 bar anywhere in the film.
- The twin section becomes 4 whole 4-chord cycles (it used to stop one bar short).
- Awaken's tempo now matches the rest of the film (111-112 BPM).
- The largest tempo step in the film drops from 0.97 % to 0.72 %.

What it costs:
- The opening plays 2.5 % slower. The wake before title B follows it (same 2 bars), and its bar line on title B moves from
  12.35 s to 12.45 s.
- Rise plays 1.4 % slower with the same 13 bars. Its first bar line comes 0.1 s after rise starts instead of 0.5 s: inside
  the 0.8 s dissolve, 0.3 s before its centre, which is the edge the score allows.

What does not change:
- Create, commons, coast, oilers, wellness, awareness, music, media, storage and hero keep the same tempo, bars, chords and
  picture-sync offsets. Every bar line moves exactly +3.45 s.
- The logo hit lands on the wordmark at 244.64 s.
- Title A bloom stays at 3.1 s, the lift-top swell at 16.15 s, and the wake is still 2 bars.
- The movement sounds follow Vico's new status lights (20.45, 27.35, 33.35, 35.6 and 39.7 s in awaken).

## Before / after, every file run-all changes in the cut

| file | before | after |
|---|---|---|
| previews/awaken-v5-cut.json (render source) | 44.85 s, 23 camera keys (to 44.85), camera 671 samples, 9 desk moves | 48.3 s, Vico's 21 keys (to 48.3), camera re-baked (723), his 10 moves; ledStatus, sceneTray, sceneGlobals as the live file already has them (Vico's 13:00 import) |
| director-film/awaken.json | 44.85 s, the same old camera and moves | 48.3 s, the same as above |
| director-chapters.json, director-ch01.html | (pages step; no change in content expected on the live cut) | |
| edl.json | awaken 44.85; rise 43.35-71.85 ... hero 220.82-246.77; total 246.77; end card 241.19 | awaken 48.3; rise 46.8-75.3 ... hero 224.27-250.22; total 250.22; end card 244.64 (title A 3.1 / B 12.4 unchanged) |
| score-pins.json | 43.85, 71.4, 92.8 | 46.9, 74.85, 96.25, 115.65, 128.625, 141.55, 162.95, 173.65, 184.425, 199.55, 225.32 (+ backup score-pins.pre-polish1125-score-*.json) |
| score/tempo-map.json | 113.25 BPM nominal, anchors 12.35, 43.85, 71.4 ... 221.87, 241.19; beats [60, 52, 40, ...] | 111.5 nominal, anchors 12.45, 46.9, 74.85 ... 225.32, 244.64; beats [64, 52, 40, ...] (rest identical) |
| score/score.wav (gitignored) | 246.77 s | 250.22 s (12 010 560 samples), -16.0 LUFS, -1.9 dBTP, LRA 5.1 |
| score/CUE-SHEET.md, score-analysis.json, score-spectrogram.png | | rebuilt |

Unchanged: review-cut.json, titles-src.json, director-camera*.json, shots/13-subshots.json and every other chapter's data.

Section tempos and bars (film seconds):

| section | before | after |
|---|---|---|
| wake | 8.15-12.35, 114.29 | 8.14-12.45, 111.47 |
| twin (awaken) | 12.35-43.85, 114.29, 15 bars | 12.45-46.9, 111.47, 16 bars |
| rise | 43.85-71.4, 113.25, 13 bars | 46.9-74.85, 111.63, 13 bars |
| create .. hero | 71.4 .. 241.19 | 74.85 .. 244.64, same tempo and bars |
| tail | 241.19-246.77 | 244.64-250.22 |

## Anything keyed to film time

- titles-src.json is in chapter seconds and is not changed. Chapter 1's titles stay exactly where Vico put them: "Meet the
  workstation" 3.1-8.8 s, "Make room for what's next." 12.4-17.0 s, "Groove through your day." 22.6-27.6 s. These are the
  same values as titles-src.pre-director-awaken-20261125-124029.json.
- The titles after chapter 1, the CTA and the end card move +3.45 s through edl.json alone (finish-intro.py).
  Film times: rise 50.4, create 77.4, commons 99.2, coast 117.25, oilers 137.0, wellness 146.9, awareness 165.7,
  music 175.25, media 186.35, storage 207.65, hero 227.97; wordmark 244.64, CTA 245.7.
- The commons phone cue, every ledStatus and motion clip, and the hero's version fades are all in chapter seconds: none of
  them change.

## Render

The 4K60 chapter keys (chapter-keys.py) change for **awaken only**. The other 11 chapters stay cached.

Estimate, from the last full 4K60 job:
- awaken: 48.3 s x 4-5 s wall per film second = about 3-4 min.
- Master + H.264: 95 min x 250.22 / 242 = about 98 min.
- 10-bit HEVC: 43 min x 250.22 / 242 = about 44 min.
- **Total: about 2 h 25 min.**

Tray carry (0f9cc1dc) and other chapters:
- Only awaken has tray keys, and it re-renders anyway, so it picks up the new carry.
- The keyboard and mouse carry (rider-handoff.mjs) applies to every chapter whose desk tilts past 9 deg: create (to
  55 deg), storage (65 deg) and all four hero versions (start at 65 deg). The presets put a keyboard and mouse on the
  desktop, so these chapters' pixels may change around those tilt crossings (a 0.4 s carry instead of the pop).
- Code changes do not change cache keys, so these three keep their cached frames unless they get chapter epoch bumps. No
  bump is made here; that is Vico's call.
- If bumped: +76.1 s of picture x 4-5 s/s = +5-6.5 min, about 2 h 31 min in all.

## Notes for Vico / Orch

- **Lights at the end of chapter 1.** The environment and stage-light ramps that brighten the room before the rise dissolve
  are still keyed at 43.4 -> 44.8 s. That was the old chapter end. In the 48.3 s chapter the room is fully lit about 3.5 s
  before the dissolve. They are Vico's data (sceneGlobals.environmentScale; sceneEdits @stageLight / @pulse / directional
  light intensities). Not changed: his call if they should move to 46.85 -> 48.25 s.
- **Foot light.** Vico's 13:00 export carries the foot-light curve at 7.5-9.5 s (the Nov 21 values), not the 10.4-17.15 s
  lift-following light of e393e0b7. It is already in review-cut.json and, by the lighting step, in the live render source.
  This job does not touch it; worth asking him if that was meant.
- **The checkpoint's previews/awaken-v5-cut.json is older than the live one.** e9f0b637 did not capture previews/. The live
  file is reconstructed here from director-film/awaken.json, which the watcher's pages step makes from it. run-all works
  on whatever the live file holds.
  - Check in the dry run: on the live cut, director-film/awaken.json and previews/awaken-v5-cut.json should show only
    seconds, cameraPlan, camera and motion (plus ledStatus for previews if the live file lacks it).
  - If director-film/awaken.json also shows sceneGlobals (the foot light 7.5 -> 10.4), the live render source does not have
    Vico's 13:00 lighting. Ask him which foot light he wants before the real run.
  - Run against the checkpoint copy, the dry run shows exactly that, because that copy is older than the live one.
- **The render source had other drift.** Before 13:00 (hq 0f9cc1dc), the render source's awaken camera already differed
  from review-cut's (23 vs 19 keys at the same 44.85 s). The importer fix ends that: the next pass gives the render source
  review-cut's camera.
