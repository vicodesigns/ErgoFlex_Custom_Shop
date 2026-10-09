# Handoff: port desk Color Bursts tuning into main's Auto DJ

Status: not started · Written 9 October 2026 · Repo: `ErgoFlex_Custom_Shop`

## Goal

The web Studio's LED music mode should render Color Bursts the way the real desk
does. That means adding Burst Depth, Burst Tail, Calm Sections and Drop Aware,
plus the per-phrase burst recipes, to the Auto DJ that is on `main` today.
Everything the Studio does now must keep working: computer-audio and microphone
capture, saved looks and palettes, DJ extras and comfort modes.

The app and firmware side is done. Desk_Stack `feature/burst-tuning` is merged
into `polish-features`. Only the web mirror is missing.

## Why this isn't a plain merge

`feature/burst-tuning` is on GitHub, not merged. It has 2 commits, `a91cc9a` and
`4b7dfff`, branched from `865277c` on 4 October. It was written against the old
Auto DJ.

On 6 October, `main` replaced that Auto DJ (commit `dba24eb`). It added:

- `led-dj-overlay.mjs`, a `DJOverlay` with `prepare()` / `paint()` that mixes up
  to three effects per strip, plays saved looks and palettes, and handles DJ
  extras;
- live computer-audio and microphone capture in `led-music-mode.mjs`;
- a simpler Color Bursts: `burstsOn` / `remixBursts` in `normalizeDJSettings`,
  `burstAt` / `burstGain` / `burst.width` / `burst.every` in `DJOverlay`. It has no
  depth, tail, section or drop awareness.

A trial `git merge --no-ff feature/burst-tuning` on 9 October conflicted in
`led-auto-dj.mjs`, `led-music-mode.mjs`, `studio.js`, `index.html`,
`product-demo.html`, `divi-editor/build-site-upload.py` and the generated
`divi-editor/site-upload/ergoflex-demo/*`. Either side of every conflict loses
features. The merge was aborted. **Do not merge the branch. Port it.**

## What to take from the branch

Inspect it with `git show feature/burst-tuning:<path>` or
`git diff 865277c feature/burst-tuning -- <path>`.

1. **`led-music-bursts.mjs`** (new; 122 lines). Take it nearly as-is. It mirrors
   the firmware's `EffectEngine.h` burst code with integer maths:
   - `BURST_DEFAULTS` and `normalizeBurst()`: rate, spectrum, zone, depth, tail,
     section, dropAware; all values are bytes 0–255.
   - `BURST_RECIPES`: `burst_base`, `burst_sparse`, `burst_dense`,
     `burst_focused`.
   - Helpers: `burstStripWeight`, `burstPeriodMs`, `burstHueStep`, `tailFactor`,
     `hsvToRgb`.
   - `BurstOverlay`: `configure`, `reset`, `update(nowMs, dt, metrics, flags)`,
     `apply(frame)`. It adds onto the LED frame after effects render.
   - `BuildDropDetector`: a browser approximation of the API's build and drop
     flags. Commit `4b7dfff` notes that it is an approximation.
2. **`tests/led-music-bursts-test.mjs`** (new; 123 lines). It includes a drift
   guard that reads the desk source:
   - `$DESK_STACK/ergoflex_api/services/music_auto_dj_variation.go`
   - `$DESK_STACK/Firmware/ergoled_firmware/src/EffectEngine.h`
   - `DESK_STACK` defaults to `/home/ergo/ErgoFlex_Desk_Stack/Polish-Features`.
     Both files exist there.
   - Keep the guard, and keep its existing behaviour when those files are absent.
3. **The Auto DJ recipe rule.** From `led-auto-dj.mjs` on the branch:
   - `DJ_BURST_POOLS` gives `custom` the 4 recipes; chill, party and rave are
     empty.
   - `nextBurst()` advances one recipe per phrase, and only when bursts and Remix
     Bursts are both on (`4b7dfff`: "only My rotation + Remix Bursts rotates
     them", matching the desk API).
4. **Applying the overlay.** From `led-music-mode.mjs` on the branch:
   `burstConfig()`, `applyBursts(now, dt)`, `setBurst(patch)`, the comfort rules
   (Minimal caps depth at 128; any non-standard comfort is passed to the
   overlay), and the manual Color Bursts controls in the Command Center UI.
5. Ignore the branch's `?v=` cache strings and its site-upload zips. They are
   stale.

## How to fit it into main

- **One burst system.** Replace `DJOverlay`'s simple burst
  (`burstAt` / `burstGain` / `burst.width` / `burst.every` in
  `led-dj-overlay.mjs`) with `BurstOverlay`, or drive `BurstOverlay` from it. Do
  not stack two burst layers.
- **Frame order in `LedMusicMode`.** Effects sample → `renderRecipe` →
  `djOverlay.paint` → `applyBursts`, or bursts inside `paint()` if that is
  cleaner. Bursts must also work with the DJ off, through the manual controls.
- **Settings and migration.**
  - `normalizeDJSettings` already has `burstsOn` and `remixBursts`, both default
    true. Keep those names.
  - Do not bring back the branch's `bursts` boolean. If a saved
    `ergoflex.browserAutoDJ.v1` payload contains it, map it onto `burstsOn`.
  - Store the manual tunables (rate, spectrum, zone, depth, tail, section,
    dropAware) under their own key, or inside the existing settings with
    validation.
- **Comfort.** Main suppresses bursts unless comfort is `standard`. The desk uses
  a longer minimum period in comfort modes (`burstPeriodMs(rate, comfort)`).
  Decide which applies, keep Reduced and Minimal safe (no strobing), and write
  the decision in `docs/` next to the LED music docs.
- **UI.** Put the depth, tail, calm-sections and drop-aware controls in the
  existing "DJ extras" fieldset or a Color Bursts subsection of the LED Command
  Center. Dependent controls dim while Color Bursts is off, as in the app (Desk
  commit `89873a68e`). Keep keyboard access and the portal light/dark tokens
  (`docs/portal-ui.md`).
- **Live audio.** Bursts must work with computer-audio and microphone capture.
  Main's playback time comes from `this.playbackTime`, not `audio.currentTime`.

## Files likely touched

`led-music-bursts.mjs` (new), `led-dj-overlay.mjs`, `led-auto-dj.mjs`,
`led-music-mode.mjs`, possibly `led-command-center.mjs`,
`tests/led-music-bursts-test.mjs` (new), `tests/led-dj-overlay-test.mjs`,
`tests/led-auto-dj-test.mjs`, `package.json` (add the new test to
`test:led-music` and `test:led-presets-dj`), `divi-editor/build-site-upload.py`
(add `led-music-bursts.mjs` to the module list). Bump the `?v=` strings of every
changed module in all of its importers: `studio.js`, `index.html`,
`product-demo.html`.

## Verify

1. `npm run test:led-music` and `npm run test:led-presets-dj`, plus the new
   bursts test. The drift guard must pass against
   `/home/ergo/ErgoFlex_Desk_Stack/Polish-Features`.
2. `node tests/led-computer-audio-test.cjs`, `node tests/led-mobile-audio-test.cjs`
   and `node tests/led-command-scroll-test.cjs` still pass.
3. `npm test` (`studio-smoke`). Two failures existed before this work: an
   out-of-date `widthMm` check in the office and coworking room tests, and
   possibly the Studio lighting-slider fit check. Don't attribute them to this
   port without checking `git stash` / `HEAD`.
4. Manual check in a browser: `npm run dev`, then
   http://localhost:3000/?view=room. Open the LED Command Center, then Music,
   then the demo soundtrack. Try Color Bursts on and off, the depth and tail
   extremes, Calm Sections, Drop Aware, the Auto DJ with My rotation and Remix
   Bursts (recipes rotate per phrase), and the Reduced and Minimal comfort modes.
   Use local headless puppeteer for screenshots; the remote Chrome has no WebGL.

## Rules

- Work on a branch from current `main`, e.g. `feature/burst-port`, and merge
  `--no-ff` after the tests pass. Leave `feature/burst-tuning` as the reference;
  delete it only when the user agrees.
- Don't regenerate or commit the `divi-editor/site-upload/*.zip` bundles unless
  the user asks for a site deploy.
- Never touch the Desk_Stack repo (Polish-Features or any app/API branch). It is
  read-only reference here.
- Other Claude sessions may be working in this checkout. Check `git status`
  before starting, and don't revert files you didn't change.
- Commit messages end with the attribution lines the session provides.
