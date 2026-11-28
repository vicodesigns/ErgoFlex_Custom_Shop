# Handoff for Gemini · Linux desk · November 27, 2026

Start with this file on the Linux desk and [the Windows handoff](handoff-windows-render-20261127.md) on the render PC. Vico directs the film and decides creative changes, merges, and render requests.

## Start here

- Live checkout `/home/ergo/ErgoFlex_Custom_Shop` on `video/cinematic-intro-hq`. The local Director is served from it on port 3000. Use the pushed handoff checkpoint at the tip of that branch. The working cut is `exports/cinematic-intro-cut-vicos-3rd-cut`, shown as **Vicos 3rd cut**.
- **Hero** is chapter 12, 27.45 s. **Oilers** is chapter 6, “Space to discover,” 15 s. Both the Hero finish controls and the final Oilers animation are already on the live branch.
- The two machines exchange status through `/home/ergo/Manifest-Share`. In the current Windows RDP session this is `\\tsclient\_home_ergo_Manifest-Share`. Linux writes `linux-to-windows.md` and reads `windows-to-linux.md`. The shared folder is available on Windows while RDP drive sharing is connected. Git is the durable source for code, cut data, and these handoffs.

## Working rules

- Vico approves each merge and push to the live branch. A change in the main checkout can reload his Director. Do feature work in `~/ErgoFlex_Custom_Shop_<Name>WT`, outside the repo. Leave the existing worktrees and local artifacts in place. The Hero finish branch is checked out at `~/ErgoFlex_Custom_Shop_DeskFinishesWT`.
- Linux is the editing desk, with about 12 GB RAM. Run Git, static checks and CPU-only unit tests here. Inspect tests for Puppeteer, Playwright or rendering before running them. Windows handles browser tests, stills, clips, and video renders.
- Get Vico's approval before queueing any render or changing the render epoch. Give the wait first. A full-film preview can take about 40 minutes and a full 4K job takes longer. Offer a single-chapter preview first. Use the Windows watcher to establish actual queue status.
- Leave music, `score/`, `edl.json`, and `score-pins.json` to Vico's decision. Preserve supplied 3D models and geometry. Use they/them for people unless Vico has specified otherwise.
- Run ESLint `no-use-before-define` on edited Director and stage modules. Compare any existing findings against the base. Bump the query tokens for edited stage modules and hard-refresh Director after a merge. The current finish feature token is `20261127-desk-version-finishes`.

## Hero on the live cut

- `f731e62a` added group editing of desk versions and finish fades, and a blank Pearl White opener. The opener ends at the 1.5 s seam, with overlapping render windows. Desk order is **I · Pearl White, B · Artist, C · Architect, D · Office, H · Gaming**, then Gaming's timed Pearl White finish. The 1.5 s lead-in moved picture events later. The music and score pins were preserved. Pre-lead-in backups are in `exports/state-backups/pre-polish1127-leadin/` on Linux.
- `2ee53657`, `1d9353cf` and `e492ad5a` fix the opener-to-Artist restore. The blank look hides accessories with the objects' `saved.removed` flag, preserving their transforms. Callers wait for `fx.settled()` after clearing and before preparing the next desk. If the easel or screens regress, capture the `[film-fx] featuredBuild was` and `featuredBuild restored` logs. `8e105c7c` keeps the rig dim while the Office desk is still on screen.
- Windows verified the opener and Artist in live Director and Render still at `c778738f` with Studio rev 9627. The Artist was Warm Ivory in that older check, with an upright painting, bottom easel rail, five accessories and two lit screens. Windows also checked blended frames at all five transitions in the existing `req-20261127T222534` render. The latest cut has newer colours. Use the checkpoint's version data for visual checks.
- `2dab30a2` added **Swaps → selected desk → Desk finishes** for Top finish, Frame and custom Trim colour. Changes apply to the selected desk in the live preview and travel through Render still and Export cut. **Timed finish fade** edits the destination look of its own chosen desk. The selected desk's overrides live in `shot.deskVersions[].finish` and become `deskFinish.version` on the film sub-shot. Shared resolution is in `experience/desk-versions-edit.mjs`. Linux passed the desk-version and finish unit tests, ESLint scope checks, and a real Hero export/import against a disposable cut. The dedicated Windows visual check of the feature is still open.
- Vico exported his current selections on this checkpoint. **Artist** uses Deep Navy with `#242249` trim. **Architect** uses its default top and frame with `#fbfbe4` trim. **Office** uses Modern Grey with `#9198a1` trim. **Gaming** retains the timed Pearl White finish. These match in `director-camera-hero.json`, `director-film/hero-subshots.json`, and `shots/13-subshots.json`. The two successful Hero export archives and the active autosave history are included. Use the latest export if a browser restores an older draft. Keep working from Vico's chosen colours.

## Oilers on the live cut

- Linux merged and pushed `44f8badc` after Vico approved the four Windows commits ending at `fbef198a` on `director/oilers-kai-arms-review`. Kai lifts both hands from the rims, clears the tray, settles on the keyboard, glances at the screen at 13.925 s, and starts six alternating typing taps at 14.075 s. The 15 s chapter, camera and desk timings are unchanged. The keys are editable in the Director People lane.
- The merged seven files match the reviewed Windows blobs. Kai's pose keys agree in the Director camera file, Director film shot, `review-cut.json`, Director import and generated Oilers page. The Linux pose-key test passed. Windows reported zero intersections over 361 samples at 120 fps and a reviewed 720p film-camera clip using Studio rev 9627. See the Windows handoff for the evidence location and the known stale wheelchair-test assertion.

## Next shift

1. Ask the Windows agent for the current Hero render status and the dedicated finish-control check. The Linux queue snapshot still labels old jobs queued. `req-20261127T235456` (rev 9654) is delivered at `~/ErgoFlex-Renders/req-20261127T235456-hero-1080p.mp4`. The newest request seen was `req-20261128T000957` (Hero 1080p, rev 9670). Its clip was absent from the Linux delivery folder at handoff. Check that job before considering a new render.
2. Continue Hero polish only from Vico's feedback. Score realignment after the opener remains Vico's decision. Older optional items are Props-lane checks on other chapters and a possible `keepDeskItems` control. The older `director-desk-versions-edit-e2e` is stale around its expected HBHS/A–F lineup.
3. The handoff commit captures the live Hero edits, Director exports and rotated autosaves, Studio state rev 9671, and the queue snapshot. Local render freezes, render blobs, caches, media previews, state backups and old scratch worktrees remain on disk. Use Windows Git and its working tree status to verify any Windows-only drafts when resuming work there.

Background notes from the previous Claude session are in `/home/ergo/.claude/projects/-home-ergo-ErgoFlex-Custom-Shop/memory/MEMORY.md`. The merge, memory pressure, Windows session and preview turnaround notes are the relevant ones.
