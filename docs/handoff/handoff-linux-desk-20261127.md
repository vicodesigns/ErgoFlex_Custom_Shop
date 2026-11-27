# Handoff: Linux desk machine (2026-11-27)

For whoever picks this up (Codex / Gemini / another Claude) while the Claude session is out of credits. Vico (the user) is the owner; he is a designer/video director, not a coder. He will be back in a couple of hours.

## Where things are
- Main checkout: `/home/ergo/ErgoFlex_Custom_Shop`, branch `video/cinematic-intro-hq` (pushed to origin). This is Vico's live checkout: the Director (browser timeline editor) is served from it on :3000, so **any file change here reloads his Director**.
- Cut being polished: `exports/cinematic-intro-cut-vicos-3rd-cut` ("Vico's 3rd cut"). Chapter 12 = `hero` (last chapter, film 224.27 to 250.22 s), chapter 6 = `oilers` (high school, "Space to discover").
- Scratch worktrees (outside the repo on purpose, see rules): `~/ErgoFlex_Custom_Shop_HeroTimelineWT` (branch `director/hero-timeline-1127`, same as main now). Many old `CheckpointWT*`, `Fable*WT`, etc. worktrees exist; leave them.
- Windows render PC is a second machine (see `handoff-windows-render-20261127.md`).

## Hard rules from Vico (do not break)
1. **Ask before merging or pushing into the main checkout's branch** (it reloads his Director). He says "merge" each time. This handoff's own docs/checkpoint commit was explicitly requested by him.
2. **No renders, stills, browser/GPU runs on this machine.** It has ~12 GB RAM. All rendering/browser tests go to the Windows machine. Desk-side: unit tests (`node tests/<x>-test.mjs`, ones that do not launch puppeteer; `grep -L puppeteer` first), ESLint, git.
3. Say the wait time before any full-film re-render (about 40 min); offer a quick single-chapter preview first. Never queue a render or bump the render epoch without his yes.
4. Do not touch the music, `score/`, `edl.json`, `score-pins.json` (the score re-fit is his decision).
5. Worktrees go in `~/ErgoFlex_Custom_Shop_<Name>WT`, never under the repo (the :3000 server watches `.claude/worktrees`).
6. Run ESLint `no-use-before-define` on edited Director/stage `.mjs` files before handing anything over (`node --check` misses TDZ errors). There are ~10 pre-existing errors in `film-fx.mjs`/`player.mjs` (`keyAt`); do not add new ones.
7. Bump the `?v=` cache-busting token when editing stage modules (currently `film-fx.mjs?v=20261127-featured-hide` in `experience/player.mjs`, `experience/film-render.mjs`, asserted by `tests/keep-desk-items-test.mjs`).
8. Never change supplied 3D models or invent geometry; media is internal (never raise copyright). Use they/them for people unless told.

## What was done today (all merged and pushed on `video/cinematic-intro-hq`)
- `8e105c7c` Hero: the keyed light rig no longer ramps at 13.19 to 13.79 s (it was washing out the Office desk). Rig `key/rimLeft/rimRight` keys now stay dim until the Gaming desk takes over.
- `f731e62a` Director: desk versions and finish fades join the group selection (marquee / Shift-click, drag to slide together, chapter grows); new blank Pearl White look (`look:'blank-pearl'`) with "+ Desk at the start" / "+ Pearl White opener"; lead-in patch tool `tools/experience/drafts/polish1127-leadin/apply-leadin.py <cut> [--by 1.5] [--apply]` (idempotent).
- The lead-in is **applied to the live cut**: hero now 27.45 s (was 25.95): a 1.5 s bare Pearl White desk on the music's first beat, then Artist, Architect, Office, black/red Gaming, Pearl White finish. Everything in the hero moved +1.5 s; score/edl/score-pins unchanged so picture events land 1.5 s after their old music beats. Backups of the 6 pre-lead-in files: `exports/state-backups/pre-polish1127-leadin/` (untracked).
- `2ee53657`, `1d9353cf`, `e492ad5a` Film fx (`tools/experience/film-fx.mjs`) fixes for the blank desk -> Artist switch:
  - wait for restored accessories before the next desk installs (was "no screen matches main-landscape");
  - `fx.settled()` awaited after `clear()` and before `prepare()` in `experience/player.mjs`, `experience/film-render.mjs`, `tools/experience/film-session.mjs` (because `applyPreset` first SAVES the current desk as the preset's build);
  - blank look now HIDES accessories with the desk objects' `saved.removed` flag + `objects.phase(r)` instead of toggling them out. Toggling out deletes the record (`scene-desk-objects.mjs syncAccessories`) and toggling back in places the accessory at its natural spot: the Artist's **easel and painting came back upside down** (Vico's screenshot). Only `shot.deskLook==='blank-pearl'` uses the hide path; Storage chapter keeps the toggle path.

## Open items, in priority order
1. **Verify `e492ad5a` in a browser (Windows does this, see its doc).** Expected: blank Pearl White desk for 1.5 s, then the Artist with easel rail at the BOTTOM, painting upright, Warm Ivory, artist-easel, painter-shelf, task-light, monitor-arm, flat-monitor, lit screens. Vico has not yet confirmed it live after reloading his Director. If still wrong, the Windows run logs `[film-fx] featuredBuild was {...}` / `restored {...}`: "was" already blank = the first load is the problem; "restored" blank = restore failing.
2. **Kai arms in the Oilers chapter** (Vico, 13:42): when Kai brings his hands up from the wheelchair to type, arms and hands pass through the keyboard and keyboard tray. Job given to an Opus agent on Windows, branch `director/oilers-kai-arms` (see its notes in the Windows doc and in that branch). Facts: cast entry `kai` (id `people-kai-wheel-type-31`) from 12.75 s has only two pose keys, identity at 12.75 s and a typing pose at 13.5 s; pose keys slerp each bone independently with smoothstep (`people-pose-keys.mjs poseAt`), so hands sweep straight through the tray. Needs 3 to 5 intermediate keys (lift above the tray lip, forward over the keys, lower onto home row), keeping typing from 13.5 s on, cameras/lift/titles/chapter length (15 s) untouched. Data lives in `director-camera-oilers.json` (people), `director-film/oilers.json`, `review-cut.json`, `director-import/ErgoFlex-film-ch06-oilers-director.json` via importer `tools/experience/build-round8-director.py` (`--pages oilers`). Earlier similar fixes: commits 86997631, 013024fd, 2c1b1dd8. **Review the agent's branch on the desk and ask Vico before merging.**
3. A Hero 720p preview render of the new lead-in (shows the real blank -> Artist dissolve) was NOT queued. Offer it to Vico; state the wait first; it runs on Windows.
4. Score/music alignment after the +1.5 s lead-in: Vico decides whether to re-fit the score.
5. Older open items: review other chapters' Props lanes; a possible Director toggle for `keepDeskItems` on other desks/chapters; optional Windows re-render of the Office section; `director-desk-versions-edit-e2e` fails with "HBHS with stickers on the stage" (pre-existing, also fails on 8e105c7c; it expects the old A to F desk list).

## Traps
- Vico's Director must be hard-reloaded after any merge (stale module cache looks like a missing feature).
- `exports/render-queue/queue.json` statuses on the desk are stale (all "queued"); the real state is on Windows. Check the Windows queue before merging code that a queued job might freeze (each job freezes its own copy of the code in `exports/cinematic-intro-20261104-req-*-freeze-*`).
- Windows previews use the committed `studio-state.json`; Vico's live Studio rooms are in the desk's working copy (committed in the checkpoint commit below).
- Director desk-version model: `shot.deskVersions=[{n,preset,name,start,end,look?}]`, `shot.finishFades`, sub-shots in `director-film/hero-subshots.json` (Director copy) and `shots/13-subshots.json` (film). Shared builder `resolveSubshots` in `experience/desk-versions-edit.mjs`.
- Pearl White finish fades render as a smoothstep mix in the film but the live Director preview switches hard.

## Git state at handoff
- Everything above is on `origin/video/cinematic-intro-hq`. A checkpoint commit "Vico's working state" holds his live uncommitted edits (rise import, hero Director pages, `studio-state.json`, `queue.json`, `titles-src.json`, `score/tempo-map.json`, Director exports/autosaves). NOT committed (big, local): `exports/render-blobs` (6.4 GB), `exports/slides`, `exports/score-preview`, `exports/state-backups`, render freeze folders, `Claude outputs/`, `tools/experience/screens/.cache/tricep`.
- Memory notes for Claude sessions live in `/home/ergo/.claude/projects/-home-ergo-ErgoFlex-Custom-Shop/memory/` (index `MEMORY.md`); read the "Ask before merging", "Desk memory pressure", "Windows 3dmodeling session" and "Preview turnaround" ones first.
