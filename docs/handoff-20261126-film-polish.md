# Handoff: film polish pass, 26 Nov 2026 (written ~11:30 PST)

Owner: Vico. Branch: `video/cinematic-intro-hq` (main checkout `/home/ergo/ErgoFlex_Custom_Shop`, his live Director on :3000). Live cut: `exports/cinematic-intro-cut-vicos-3rd-cut` (NOT in git for most files: it is his working copy; back it up before any import).
Deadline Vico gave: a finished film by about 4:30 pm PST on 26 Nov. A full forced 4K 60 fps 10-bit takes about 5 h 10 (chapters 3 h 20 + assembly 1 h 49), so 4:30 is no longer reachable for 4K with everything in; see "Render plan".

## Rules Vico has set (keep them)
- Agents are Sonnet 5.5 only, max 2 agents at once on the render PC (GPU/memory). Desk (Linux box) has about 12 GB: one heavy process at a time, no rendering on the desk.
- All 3D/render work is done on the Windows render PC by the Claude session named "Windows" (peer messaging; ask it to run stills, clips, jobs). Its outputs land in `~/ErgoFlex-Renders` (names `polish1124-*`).
- Do not delete or touch the 4K renders/caches (`cache\4K` on the render PC, `~/ErgoFlex-Renders/*-4K*`): he may do timing adjustments on them. A backup of last night's chapter caches is in `cache\4K\_before-fable-20261125T234119` on the render PC.
- Never publish his photos (they carry home GPS data). Never push private photos to GitHub.
- He reviews stills/clips on his phone (SendUserFile); he approves in chat. Merges into the main checkout reload his Director: tell him.
- Speed over proof: he wants 480p stills/clips in minutes, not hour-long proofs.

## What is merged on `video/cinematic-intro-hq` (tip `fbe22648`, pushed also as `origin/director/hq-tip-1126d` and later tips)
| Commit | What |
|---|---|
| 6adef523 / 48a265ca / de09c11d | Fable people finishes (hair/eyes/fabric/skin), outdoor window scenery pass, interior pass (OFF by default: `?interior=1` or `--interior 1`; NOT ready: hard window edges, see `docs/fable-handoff-interior.md`) |
| 58fb53ec | Create aluminium no longer renders black (cause: c8d1477e room-reflection capture; fix in `tools/experience/film-quality.mjs`) |
| ff28fd6c | Hero chapter keyboard/mouse cross-fade (same fade as Chapter 1; `experience/rider-fade.mjs`) |
| 7c01b93c | Chapter 1 end logo: dashboard fades fully out, bigger tagline. The re-captured screen clip is INSTALLED on the desk at `exports/cinematic-intro-cut-cine/screens/cine-awaken-main.mp4` (sha256 f725947b...; old one backed up as `.pre-logo-*.mp4`) |
| 64cd0da1 / be28ff97 / fbe22648 | Commons: Mia's phone flipped 180, looks up twice at the arriving desk, desk brakes softer (engine `glances` field + `tools/experience/drafts/polish1126-miaphone/build.py`) |
Earlier today also merged: tray rig v3 from Vico's own Rhino model, Yara typing, Noah wrist, title sizes, Chapter 1 fade (133dd4e8).

DATA already imported into the live cut: Mia/Commons (verified: glances keys [9.5,10,11.15,11.65] and [12.62,13.05,13.62,14.1], phone rotation [0,180,0] in `director-camera-commons.json` props, chapter 20.3 s).

## NOT done / pending (by priority Vico gave: alu fix [done], final chapter, Mia [done])
1. HERO (chapter 12) props + ending, branch `origin/director/polish-1126-heroprops` (ef221e5c; data-only script `tools/experience/drafts/polish1126-heroprops/apply-heroprops.py`, 108 changes, written for the cut.json shape): Vico approved the props. It must be turned into an IMPORTABLE Director export (like Mia's `build.py`), then imported. Windows' engineer was asked for that. Known issues Windows listed: wide monitor hides the Office plant from the front camera; empty 3-slot tray on the left shelf; black drawing tube cuts the right lower shelf; light clamp half off the desktop.
   HERO ENDING (branch `director/polish-1126-heroend`, in progress): at the very end the peripherals disappear, the desk fades smoothly to pearl white with white trim on the music accent just BEFORE the logo, a beat to read it, then the logo. Also: Office props should be in from the start (office section comes in level, option A; Vico had not answered A/B).
2. STORAGE (ch 11), branch `director/polish-1126-robot` (in progress): robot feet z-fighting, a jerk when Andre lifts the robot to the shelf (his hand), and (lowest priority) fill the empty 4-slot side tray with tools.
3. RISE (ch 2) evening moment (job 10, not started): after the existing 'Great job, Maya' notification, a pop-up on her wellness screen like 'Winding down: lights to warm white' timed with the lights shifting warm; make the warm shift a bit stronger.
4. CREATE (ch 3) props, parked: commit 7c9824b1 on `origin/director/polish-1126-createprops` (set square hidden = triangle fix, plant on a new right shelf, tea cup in the right holder; needs the code in `film-edits.mjs` too; NOT verified; brushes/base-shelf items deliberately left out; wide monitor may hide the plant).
5. Director UI pass: `origin/director/fable-ui` @ 8f3caa06, CSS only (`experience/director-ui.css`), NOT merged; Vico must see screenshots in `docs/fable-ui-20261125/` first. Decisions listed in `docs/fable-handoff-ui.md`.
6. V cuts (session "v", branch `film/v-cuts`): `exports/cinematic-intro-cut-v-polish` (3rd cut + own grade/score) and `-v-directors` (221.92 s, different chapter order; requests need `"keysBySlot"`, see `tools/experience/render-request.sh` in `~/ErgoFlex_Custom_Shop_VCutsWT`). Two 720p films exist (`~/ErgoFlex-Renders/req-20261126T165704-film-720p.mp4`, `req-20261126T173842-film-720p.mp4`). 4K versions NOT queued: Vico wants them to include all the improvements.

## How to import data into the live cut (the Director round trip)
From the main checkout: `python3 tools/experience/build-round8-director.py <cut> --import <draft.json>` (a Director export, schema ergoflex.client-cut), then `python3 tools/experience/build-round8-director.py <cut>` (the pass), then `python3 tools/experience/build-round8-director.py <cut> --pages <chapter> --downloads <cut>/director-import`. Back up the cut folder first (133 MB). A later import from an older Director page can revert it: re-run. Vico also exports from his own Director; ask which chapters he touched. Do not edit chapters he is editing.

## Render plan (nothing is queued)
- Render queue: drop `Render-request-*.json` in `~/Downloads` (bridge accepts after about 1 to 2 min), fields: v 1, scope film, chapter "hero" (needed even for film), resolution 4K, fps 60, format hevc, cut `exports/cinematic-intro-cut-vicos-3rd-cut`, created ISO, 16-hex signature, force true/false. Jobs run one at a time on the render PC (watcher `queue-watcher.ps1`); a film job renders 3 chapters in parallel. A chapter-scope job is slower (one at a time).
- Chapter cache keys hash data/media/epochs, NOT code or models: code-only changes (Fable, aluminium, logo clip) need `force true` or the changed chapters' cache files moved aside by the Windows session. Every chapter shows the Fable pass, so for Vico's decision "Fable stays in" ALL 12 chapters must re-render (force true).
- Timings measured: full forced 4K 60 hevc about 5 h 10; Awaken alone about 40 min; hevc-only assembly about 1 h 49; 720p full film about 40 min; two 720p films were 38 and 15 min.
- Fastest realistic plans for Vico's deadline: (a) 1080p 60 fps film with everything, started by about 1:30 pm (estimate 1.5 to 2 h), (b) staged 4K: one film job force false rendering chapters whose fixes are final, stop it at assembly, then a second film job with the changed chapters + assembly (about 5:30 to 6:15 pm start-to-finish if started about 1 pm).
- Old 4K film (before today's changes): `~/ErgoFlex-Renders/req-20261126T062755-film-4K-10bit-hevc.mp4` (250.2 s).

## Traps
- Only Windows can render; Gemini or any other agent without peer messaging must use files: request JSONs in `~/Downloads`, results in `~/ErgoFlex-Renders`.
- Watcher edge: if a film fails and a newer job is queued, the older one is not retried.
- Directors-cut chapter order breaks the fixed chapter list in the watcher: use `keysBySlot`.
- Known failing tests on the clean base: people-place-test (camera keys 11 vs 12), cine-score-end, desk-auto-stow, people-postures, pose-thumb, screen-look.
- Memory notes for Claude sessions are in `/home/ergo/.claude/projects/-home-ergo-ErgoFlex-Custom-Shop/memory/` (see `fable-wrapup-nov26-handoff.md`, `film-render-traps-nov24.md`).
