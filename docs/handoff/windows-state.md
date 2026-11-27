# Windows session state, 2026-11-27 about 14:30

Written by the Claude "Windows" session. Read together with `handoff-windows-render-20261127.md`.

## Hero re-check of 8420a9cc: NOT RUN
Neither `2ca5015b` nor `8420a9cc` has been run in a browser. At the time of writing, render `req-20261127T222534` holds the GPU.
Job 1 in the Windows handoff is still open, with its pass criteria.

To run it: a worktree at `8420a9cc` (`C:\Users\Vico\polish-wt\herotl` is one, now detached at `8e105c7c`, with node_modules and app-reference junctions; never delete a junction recursively), then
`CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe' HQ=exports/cinematic-intro-cut-vicos-3rd-cut node <path>/hero-leadin-recheck.mjs C:/Users/Vico/polish-wt/herotl <output dir>`
The script (in `windows-1127/`) does the live round trips 0.4, 1.65, 2.2, 4, 0.4, 2.2 and stills 0.4, 1.35, 1.5, 1.5. It does NOT yet:
- capture the `[film-fx] featuredBuild was/restored` lines (add `featuredBuild` to its console filter);
- check the later Artist -> Architect -> Office -> Gaming -> Pearl White dissolves, or hidden task-light glow;
- list meshes that its name filter does not match (judge the images too: on 6c6fbe66 the filter alone did not name the visible brush shelf).
Screen videos missing from a fresh worktree: `cp -n` from `F:\ErgoFlex_Render\ErgoFlex_Custom_Shop\exports\...\screens` (and from other worktrees for `cinematic-intro-cut-cine`).
Browser runs rewrite `exports/director-autosaves/`: restore that, do not commit it.

## Earlier results (images in `windows-1127/`)
| Commit | Check | Result |
|---|---|---|
| b5c8581f | finish-fades, prop-stow-window, director-finish-lane e2e | pass |
| b5c8581f | props-away, desk-versions, stow-window e2e (3rd cut) | fail |
| 4786e814 | props-away (3rd cut) | fail, 0 put-away stretches; sceneDesks.active.objects listed only 7 accessory-* entries. A later commit (e851d0bc) changed the Office desk to keep its items; not re-run |
| 4786e814 | desk-versions e2e, default HQ | fail, 22 ok; Render still at 24 s: no screen matches "main-portrait" |
| 4786e814 | stow-window e2e, default HQ | fail, 5 ok; TypeError reading 'x' of null |
| f731e62a | group-versions and finish-lane e2e | pass |
| f731e62a and 8e105c7c | desk-versions-edit e2e | same first failure on both (lane list, then timeout), so it already failed at 8e105c7c |
| 9d4c3002 | lead-in | bare 0.4 s OK, badge OK; live Artist failed ("no screen matches main-landscape"); Artist stills complete; no dissolve seen in stills (1.35 bare, 1.5/1.65 full Artist) |
| 6c6fbe66 | lead-in | timeline 27.45, bare OK, error gone; Artist INCOMPLETE live and still (Pearl White, accessories [], no easel/painting/right shelf, blank screens) |
| b5c8581f | white flash near 13 s | not seen in settled stills 12.0-13.8 s; this cannot rule out a transient during playback. 8e105c7c later changed the light rig there; not re-checked |

The good Artist reference is `windows-1127/artist-good-reference-9d4c3002-2.2s.jpg`.

## Kai arms
Branch `director/oilers-kai-arms` at `8e91ec36` (pushed), base f731e62a. WIP: only `docs/handoff/` is committed. **The fix is NOT applied to the film.**
A draft key set passed a headless 60 fps clearance check but has small hitches at each key. No "after" stills. See `docs/handoff/kai-arms-notes.md` on that branch.

## GPU, agents, locks
- Rise render `req-20261127T213557`: DONE 13:54, push ok. `req-20261127T214644` also DONE (14:04).
- Running: hero chapter 1080p `req-20261127T222534` (3rd cut), started 14:27. Not started by this session. Do not stop it.
- Open agents from this session: none (the Kai agent has finished).
- Locks: `C:\Users\Vico\polish-wt\_stills-render.lock` (the one this session used) is absent. `C:\work\gpu.lock` (named in the Windows handoff) is also absent.
  The two names differ: this session never took `C:\work\gpu.lock`. Check both and the last line of `F:\ErgoFlex_Render\queue\watcher.log` (`new=0` = idle) before GPU work.
- `render-server.cjs 3017` (running since 11-22) is not from this session's jobs. An earlier part of this session stopped a leftover `render-server.cjs 3691`.

## Git and local uncommitted work
- Local branches: a comparison with all 297 origin branches found no local branch tip, and no detached worktree head, missing from origin.
- Pushed from this machine today: `director/oilers-kai-arms` and this branch.
- **Uncommitted files remain in older worktrees and were NOT committed**: their contents were not inspected, many are tracked cut files that could be stale or generated, and committing them blind could publish bad data. They are still on this PC's disk. Review before using or removing any of these worktrees. (Untracked count is `git status` entries, so a folder counts once.)
- The main checkout's untracked `scratch/` holds three scripts dated 11-15; not committed.
- Per an earlier part of this session: the "Hero ending" and "Storage robot feet" helpers stopped on 11-26 on errors; the robot job was not finished (`polish-wt\robot` has an untracked probe script).

| Worktree | Branch / head | Modified tracked | Untracked |
|---|---|---|---|
| `C:/Users/Vico/OneDrive/Art Projects/Standing Desk/ErgoFlex_Custom_Shop` | main a5bb91e3 | 0 | 1 |
| `C:/Users/Vico/polish-wt/alu` | director/polish-1126-alu 86578b6d | 0 | 1 |
| `C:/Users/Vico/polish-wt/commons` | director/polish-1124-commons b9c51151 | 34 | 2 |
| `C:/Users/Vico/polish-wt/commons4` | director/polish-1124-commons4 617dde5e | 0 | 1 |
| `C:/Users/Vico/polish-wt/createprops` | director/polish-1126-createprops 7c9824b1 | 0 | 1 |
| `C:/Users/Vico/polish-wt/endcard` | director/polish-1124-endcard 0dcb268f | 34 | 32 |
| `C:/Users/Vico/polish-wt/hair` | director/polish-1124-hair 4a75c942 | 0 | 1 |
| `C:/Users/Vico/polish-wt/hero-camera` | director/polish-1124-hero-camera eaa897a8 | 35 | 36 |
| `C:/Users/Vico/polish-wt/hero-desks` | director/polish-1124-hero-desks 62bc1138 | 35 | 54 |
| `C:/Users/Vico/polish-wt/hero-end` | director/polish-1124-hero-end 2c31e71d | 34 | 3 |
| `C:/Users/Vico/polish-wt/heroend` | director/polish-1126-heroend 3a9293eb | 0 | 1 |
| `C:/Users/Vico/polish-wt/herofade` | director/polish-1126-heroprops ef221e5c | 0 | 1 |
| `C:/Users/Vico/polish-wt/kai` | director/polish-1124-kai aa4465a0 | 34 | 36 |
| `C:/Users/Vico/polish-wt/media-omar` | director/polish-1124-media-omar 1bd91a2b | 34 | 32 |
| `C:/Users/Vico/polish-wt/miaphone` | director/polish-1126-miaphone dd099c58 | 0 | 1 |
| `C:/Users/Vico/polish-wt/oilers-type` | director/polish-1124-oilers-type 8922adee | 0 | 1 |
| `C:/Users/Vico/polish-wt/omar3` | director/polish-1124-omar3 26cc9960 | 34 | 36 |
| `C:/Users/Vico/polish-wt/people-sweep` | director/polish-1124-people-sweep 75853d21 | 0 | 1 |
| `C:/Users/Vico/polish-wt/robot` | director/polish-1126-robot 7c01b93c | 0 | 2 |
| `C:/Users/Vico/polish-wt/stills-base` | HEAD 133dd4e8 | 0 | 1 |
| `C:/Users/Vico/polish-wt/stills-interior` | HEAD 29607a26 | 0 | 2 |
| `C:/Users/Vico/polish-wt/stills-interior-base` | HEAD 133dd4e8 | 0 | 2 |
| `C:/Users/Vico/polish-wt/stills-outdoor` | HEAD 841b9ff3 | 0 | 1 |
| `C:/Users/Vico/polish-wt/stills-people-after` | HEAD f00c270d | 1 | 3 |
| `C:/Users/Vico/polish-wt/stills-people-base` | HEAD 133dd4e8 | 1 | 3 |
| `C:/Users/Vico/polish-wt/stills-tip` | HEAD de09c11d | 0 | 1 |
| `C:/Users/Vico/polish-wt/tray` | director/polish-1124-tray 586191a9 | 0 | 2 |
| `C:/Users/Vico/polish-wt/wellness` | director/polish-1124-wellness-stretch f6e5555f | 0 | 1 |
| `C:/Users/Vico/polish-wt/workshop` | director/polish-1124-workshop 2afc89c8 | 34 | 36 |
| `C:/work/andre-wrist-wt` | fix/andre-phone-wrist ccace0cf | 0 | 3 |
| `C:/work/awaken-webcam-wt` | cine/awaken-webcam 14397a53 | 0 | 1 |
| `C:/work/chk-int` | HEAD 77d2a05d | 1 | 0 |
| `C:/work/ergoflex-cine-int` | cine/integration 77d2a05d | 0 | 1 |
| `C:/work/ergoflex-cine-s33c` | cine/s33c 9ad8434b | 0 | 1 |
| `C:/work/ergoflex-cine-s33c-fade` | cine/s33c-fade 986cfca7 | 0 | 1 |
| `C:/work/kit-diag-base` | HEAD 148f12cc | 1 | 0 |
| `C:/work/kit-diag-wt` | cine/kit-fix 7b5ce1eb | 1 | 0 |
| `C:/work/lab-wt` | HEAD fdbeadd2 | 0 | 1 |
| `C:/work/lab2-wt` | HEAD d945320e | 0 | 3 |
| `C:/work/prelab-wt` | HEAD cf9c9cc8 | 0 | 1 |
| `C:/work/rev-s17r2` | HEAD 28efc85c | 0 | 2 |
| `C:/work/rev-s19` | HEAD a148fa61 | 0 | 9 |
| `C:/work/rev-s19-base` | HEAD 581ab498 | 0 | 6 |
| `C:/work/rev-s19-merge` | HEAD 090b42f6 | 0 | 4 |
| `C:/work/verify-ec3b4b79` | HEAD ec3b4b79 | 20 | 2 |
