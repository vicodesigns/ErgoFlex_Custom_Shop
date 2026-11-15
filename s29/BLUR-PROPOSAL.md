# S29: a smoother shutter for the final film (report only)

Nothing in the pipeline was changed: no render-cut, watcher, queue, epoch or F: edits. The A/B was rendered from a
detached worktree at 581ab498 (`C:\work\ergoflex-cine-s29`), one render at a time, behind `/c/work/gpu.lock`.

## 0. What `--blur N` does today (render-cut.cjs lines 149-163)

* `sub = N` sub-frames are baked for every output frame, and every one is a full page render (`grab()` -> `bakeFrame` ->
  `toDataURL` JPEG). Bakes per shot = `(outFrames-1)*N + 1`, so the cost is linear in N.
* ffmpeg: `tmix=frames=round(N/2)` then `select=not(mod(n,N))`, input rate `fps*N`. The output frame at time t averages
  the sub-frames at t, t-1/(30N), ... (a trailing 180-degree shutter).
* `--blur 4` (the watcher's fixed value, queue-watcher.ps1 line 45, every resolution): 4 bakes, **2 used**, 8.3 ms
  apart. That gives the two sharp copies on a fast head.
* `--blur 8`: 8 bakes, **4 used**, 4.2 ms apart over 12.5 ms. That is twice the cost, and the shutter grows from 8.3 to 12.5 ms
  (closer to a true 180-degree shutter at 30 fps, which would be 16.7 ms).
* **Half of every render is thrown away**: the sub-frames in the closed half of the shutter are baked, piped and then
  dropped by `select`. See option C.

## 1. Cost

Measured: the A/B window (storage 2.2-5.6 s, 102 frames at 480p, GPU shared with the running 4K job):

| run | bakes | wall |
|---|---|---|
| --blur 4 | 405 | 33 s |
| --blur 8 | 809 | 49 s |
| taps-only blur 8 (option C, scratch patch) | 408 | 32 s |

This works out to about 17 s of fixed start-up plus about 0.040 s per bake at 480p. The bake part doubles exactly (16 s to 32 s). For full chapters the
start-up share is small, so **blur 8 costs about 2x the blur-4 time per chapter** (about 1.9x at 480p, about 2.0x at 4K).
The figures below are **the measured blur-4 times x 2 (estimated, not rendered)**.

Per chapter, in seconds of render process time from the watcher's `.out` files. Chapters run 3 at a time at 1080p and 4K
and 4 at a time at 480p, so these are contended times:

| chapter | 4K blur 4 (req-20261114T165233) | 4K blur 8 est. | 1080p blur 4 (req-20261114T065117) | 1080p blur 8 est. | 480p blur 4 (req-20261115T053621) | 480p blur 8 est. |
|---|---|---|---|---|---|---|
| awaken | 1601 | 3200 | 817 | 1630 | 664 | 1330 |
| rise | 1039 | 2080 | 577 | 1150 | 538 | 1080 |
| create | 1639 | 3280 | 1253 | 2510 | 601 | 1200 |
| commons | 896 | 1790 | 507 | 1010 | 346 | 690 |
| coast | 1094 | 2190 | 743 | 1490 | 690 | 1380 |
| oilers | 1031 | 2060 | 587 | 1170 | 583 | 1170 |
| wellness | 866 | 1730 | 432 | 860 | 429 | 860 |
| awareness | 422 | 840 | 195 | 390 | 183 | 370 |
| music | 864 | 1730 | 515 | 1030 | 652 | 1300 |
| media | 850 | 1700 | 406 | 810 | 411 | 820 |
| storage | 1210 | 2420 | 462 | 920 | 372 | 740 |
| hero (6 sub-shots) | 1768 | 3540 | 806 | 1610 | 631 | 1260 |
| **sum** | 13280 | 26560 | 7300 | 14600 | 6100 | 12200 |

Whole film, from the watcher.log timestamps. Post is finish-intro, phone copy and push, and it does not depend on blur:

| | render phase blur 4 (measured) | blur 8 (est.) | post | film wall blur 4 (measured) | film wall blur 8 (est.) |
|---|---|---|---|---|---|
| 4K | 4620 s (08:54 to 10:11) | ~9240 s | 3388 s | 8008 s (2 h 13 min) | **~12600 s (3 h 30 min)** |
| 1080p | 2683 s | ~5370 s | 851 s | 3534 s (59 min) | ~6200 s (1 h 43 min) |
| 480p | 1804 s | ~3600 s | 232 s | 2036 s (34 min) | ~3850 s (64 min) |

Storage alone at blur 8 adds about 1210 s of process time at 4K. With 3 chapters running in parallel, and storage the 11th to
start, that is an estimated +7 to +20 min of film wall time (not measured).

The 4K job running now (req-20261115T143622, 581ab498) is slower per chapter than the job above: create 1662 s, rise 1278 s.
Other sessions are using the GPU too.

## 2. Can it be limited to some chapters? Yes: the chapter is the cache unit, and the shot is in its key

* The cache unit is the **chapter**: `F:\ErgoFlex_Render\cache\<res>\<chapter>-<key>.mkv` (queue-watcher.ps1 lines 59-64,
  106-124). A film job reuses every chapter whose key file exists, unless `force` is set.
* The key (chapter-keys.py `chapter_keys()`, the payload at line 176) contains: epoch, resolution, chapter id, source,
  cut fields, **the full shot object(s)**, seed sha, media shas, studioAssets slice, and the per-chapter epoch.
  **Blur is not in it.** The watcher passes a constant `--blur 4`. If the watcher alone changed to 8, every cached chapter
  would still hit, and the film would mix blur-4 and blur-8 chapters without any warning. A blur-4 and a blur-8 render of the same
  chapter would collide on one key.
* Because the whole shot is hashed, a **shot field `blur`** read by render-cut changes only that chapter's key. Nothing else
  in the cache moves, and no epoch bump is needed. The hero's sub-shots (shots/13-subshots.json) can carry it per sub-shot.
* A time window inside a chapter (blur 8 only for 2.5-3.4 s) is not possible with the current single ffmpeg pipe (a fixed
  `sub`). It would need a variable-cadence feed. I would not do it: option C makes it unnecessary.

**Chapters with close, fast motion.** I ran my own head turn-rate audit of every chapter on S20's headless audit harness
(581ab498 people code, 1/120 s samples, head bone rotation rate). The file is `s29/turn-audit-581ab498.txt`, and the script is
`s29/s29-turn-audit.mjs.txt`. Intervals at 120 deg/s or more that last longer than one sample (single-sample spikes of
1000+ deg/s are posture pops, which are S20's subject, not a shutter problem):

| chapter | who | s | peak | in frame (from 480p frames) | needs blur 8? |
|---|---|---|---|---|---|
| **storage** | andre | 2.60-3.28 | **216 deg/s @2.95** | close: head about 70 px at 480p, hands in foreground | **yes** (the case in question) |
| storage | andre | 6.13-6.78 | 182 deg/s @6.63 | medium-far, walking | marginal |
| commons | yara | 4.83-5.38 | 163 deg/s @5.10 | medium, back of head | no |
| oilers | kai | 4.95-5.28 | rolling, spikes to 4069 (pop) | wheelchair at the right edge, close in the 320530d4 render | check (pop first) |
| oilers | noah | 4.35-4.46, 4.98-5.06 | 136 / 123 deg/s | far | no |
| rise, create, coast, wellness, music, media | (all) | - | under 70 deg/s | - | no |

Verdict: **storage is the only chapter that clearly needs it**. Oilers 4.95-5.3 needs a look after S20's pop fixes.
Per chapter, the cost is storage only: about +1210 s at 4K.

## 3. What would have to change (exact places, minimal patch plan, nothing applied)

**Option A: per chapter, smallest change.**
1. `tools/experience/render-cut.cjs` line 149: `sub=blur` becomes `sub=Math.max(1,Number(shot.blur)|0||blur)`. Add one line
   in the header's field list (around line 54) documenting the `blur` shot field.
2. `exports/cinematic-intro-cut-cine/review-cut.json`: add `"blur": 8` to the storage shot.
3. chapter-keys.py: **no change**. The shot is hashed, so the storage key changes and the others stay. No epoch bump.
4. Freeze: **no change**. render-cut.cjs is frozen through `git diff --name-only 650da42 HEAD -- '*.cjs'`
   (freeze-inputs.sh, the MUT list). I checked that F:\ErgoFlex_Render\ErgoFlex_Custom_Shop\tools\experience\render-cut.cjs, fetched at
   06:38 for the running job, is byte-identical (ignoring CRLF) to 581ab498's. review-cut.json is frozen as a film JSON.
5. render-request.sh and queue-watcher.ps1: **no change** (the shot field overrides the watcher's `--blur 4`).

Not verified: whether a Director export/import round trip, or `build-cine-cut.py --only storage`, keeps an unknown top-level
`blur` field on the shot. The import edits named fields in place, so it probably keeps it.

**Option B: whole film at blur 8 from the queue.**
1. `F:\ErgoFlex_Render\queue-watcher.ps1` line 45: `'--blur','4'` becomes `'--blur',"$blur"`, with `$blur` taken from `$j.blur`
   (default 4) and passed into `RenderCut` (its signature at line 44, and the calls at lines 93, 95, 114 and 117).
2. `tools/experience/render-request.sh`: the META validator (the python heredoc after "validate the request") accepts
   `blur` in (1, 2, 4, 8). The job dict (`job = {...}`) gets `'blur'`. The chapter-keys call gets `--blur`.
3. `tools/experience/chapter-keys.py`: add an argument `--blur` (default 4) and put `'blur'` in the payload (line 176) **only when
   it is not 4**, so today's keys stay valid. Without this, the cache serves blur-4 mkvs to a blur-8 job.
   An alternative is to bump `render-epoch.txt`, but that re-renders everything every time blur changes.
4. `tools/experience/RENDER-QUEUE.md` line 66 (the `--blur 4` row) and the job schema at line 28: document `blur`.

**Option C (recommended): render only the shutter's open sub-frames.** The cost of blur 8 then becomes the cost of blur 4.
* A scratch patch of about 6 lines in render-cut.cjs (`s29/s29-render-cut-taps.cjs.txt`, flag `--taps 1`). It bakes only the
  `round(N/2)` sub-frames that `tmix` keeps, feeds ffmpeg at `fps*open`, and selects the last of each group. The sample times
  are exactly the ones blur N uses.
* Measured: taps-only blur 8 took **32 s against 49 s** for blur 8, and 33 s for blur 4. The output against blur 8 is **PSNR 46.9 dB**. The
  difference image (x8, `s29/diff-x8-...png`, top) is flat noise with no edge of the figure. Blur 4 against blur 8 (bottom) shows Andre's
  outline. Visually it is the same picture (see `s29/hands-2.933-...png`, right two panels).
* Plan: make taps-only the default in render-cut.cjs. Blur-4 output keeps the same sample times, but bake noise is not
  bit-identical, so a cautious path bumps the epoch once. Then set the watcher to `--blur 8` with an epoch bump.
  The result is the **whole film at 4 taps for today's render time**. Option C makes option A unnecessary.

## 4. The A/B (storage, 581ab498, 480p, hq13 quality as the film)

In `s29/` on pics/cine-20261114:
* `storage-2.6-5.6-blur4-vs-blur8-480p.mp4`: 3 s side by side, left blur 4, right blur 8, with chapter time in the label.
* `face-2.900 / 2.933 / 2.967 / 3.000-blur4-vs-blur8-x3.png`: face crops at the turn's peak (216 deg/s at 2.95 s), 3x
  nearest-neighbour. Blur 4 shows a hard doubled hairline and cheek edge. Blur 8 shows a continuous short smear: the
  double image is gone.
* `hands-2.933-blur4-blur8-taps8-x2.png`: **the hands are not fixed by blur 8.** Andre's hand sweep (about 2-3 m/s) shows
  2 copies at blur 4 and **4 distinct copies** at blur 8 (strobing with smaller gaps). Smoothing that needs about 8 taps:
  blur 16 is 4x today's cost, or taps-only blur 16 is 2x.
* `storage-2.2-5.6-{blur4,blur8,taps8}-480p.mkv`: the raw renders. Frame k is storage 2.2 + k/30 s. Frames before 2.6 are warm-up.

Render command (the watcher's arguments, plus a `renderRange` of [2.2, 5.6] on the storage shot of the cut-cine review-cut.json):
`render-cut.cjs --cut cut-storage-win.json --shots 0 --video --size 854x480 --ss 1 --blur 4|8 --quality hq13 --storage exports/cinematic-intro-20261030/post/college-seed.json --state-keys ergoflex.sceneAssets.v1`.
The screen clips came from the render PC's copy (F: is read-only, so I copied them out; cine-storage-phone.mp4 sha da572020a504).

## Not verified

* The 4K and 1080p blur-8 times are estimates (blur-4 measured x 2). Only the 480p window was rendered.
* The turn audit runs in S20's headless room. Props are stand-ins, so walker path geometry, and with it the walk turn
  rates, can differ from the real room. It covers heads only (not hands, and not camera pans), so a fast camera move is not in the table.
* "Close" was judged by eye from frames of the 320530d4 480p film, not the 581ab498 film. That matters for oilers, where the
  scene changed in 581ab498.
* S17's b48de7e8 storage, with the turn at 3.7-4.2 s and a peak of 255 deg/s, was not rendered or audited.
* Whether option C's blur-4 output is close enough to skip an epoch bump; and whether a Director round trip keeps a `blur` shot field.
