# Film work board

Snapshot updated 2026-11-21 (late evening; credits low) so work can be resumed if credits run out. A fresh session: read this, then `git log -15`, then the memory index (MEMORY.md).

Fold link: (Director, tailnet only): https://ergoflexdesk02.tailf693b8.ts.net/exports/cinematic-intro-cut-vicos-3rd-cut/director-index.html

## Rules from Vico
- Agents are Sonnet 5.5; Opus 5.5 only after asking him.
- Merge finished, tested branches as they arrive (push video/cinematic-intro-hq and staging/director-merge; confirm HEAD = origin = staging and localhost:3000 = 200).
- Epoch bumps and film renders need his go, except epoch 13 (all-metal look), which he approved.
- Engineering and renders run on the Windows PC (session 3dmodeling, 2 agents at a time); Director UI work on the ui session.

## Needs Vico
- Send to desk: type the code once on the Fold: The code is in chat. Open the Director on the Fold, change something, tap Send to desk, and enter it. After that it remembers. [Fold, 5 min]
- Foot light follows the lift: Vico: the blue goes with the movement, from lift start until it stops. White strips already off (b94525f0). Windows PC changing foot keys (data only): keep ramp-in 7.5-8.5 s, hold through the lift (9.25-16.15 s in previews/awaken-v5-cut.json), ease out to ~17.15 s; review-cut keyed to its own lift. Stills 8/9.5/12/16/17 s + 14/20 s coming. Then merge. [Windows PC, Awaken, Running]
- Next film: say go when the stills look right: Epoch 13 (all metal) moves nine room chapters, so the next 4K is close to a full render. Codex's new faces ride on the same bump. The new score needs only a re-finish. I queue it when you say go. [Render, Your call]
- Score: listen to the new 0-30 s clips and tell me which second: Found it: the build-up before 12 s ran at a slightly slower tempo than everything after, then jumped. It now stays on one tempo, and a soft swell lands when the lift tops out. Before and after clips are on your phone. If the clash is at about 18.6 s (tilt start and chord change), nothing was added there yet. [Windows PC, Audio only, Merged]

## Working now
- Director: status lights locked to the motion: Vico: lights for lift/tilt/wheels should mimic the move so he edits one thing. Brief sent to ui: per-clip Status light switch (link: clipId stored on the ledStatus entry, ignored by renderers; Director rewrites at/dur whenever the clip changes), chain icon + Unlink in the Lighting tab, chapter setting Follow moves / Manual / Off, existing matching entries auto-detected as linked, optional floor glow follows light; no film change until a clip changes. After tray phase 3. [ui, Director]
- All-metal aluminium look, every room: The gym metal matches Rise value for value, so the look itself is changing: brighter, more metallic aluminium everywhere, dumbbell included. Epoch 13 approved. [Windows PC, Epoch 13, eng/desk-aluminium-look]
- Fold touch re-test, all four screen sizes: Titles lane and layout fixes are merged. The Windows PC re-runs the touch test in portrait and landscape; this should be the first run that reaches the title steps. [Windows PC, Fold]
- Keyboard tray: joints only, design untouched: Vico (2026-11-21): the tray and mounting bracket stay exactly as modelled; only add joints. Phases 0-3 merged (b16c99a1 etc.). The 44x70 mm bracket block phase 2/3 added is being REMOVED by ui (rig = original geometry split at the joints, 11121 tris, rest pose identical); drop joint off by default unless it moves original parts with no gap. Then phase 4 Director Tray mode, Windows rest-pose parity. [ui, Keyboard tray, Running]

## Queued (in this order)
- 0. Chapter 2 (Rise): phone flush, charge-pad ring clipping: Maya's phone floats about an inch above the desk and the black ring around the charge pad shares the desktop's plane (clipping triangles in the opening close-up). Nudge the ring up, then lower the phone onto it; before/after stills. Rise data is director-film/rise.json accessories ergoflex-phone y 12.4. [Windows PC, Rise, Next]
- 1. Commons: redwoods in both window views: One large redwood in one window, a mid-sized and a small one in the other, naturally spaced, in the shots during the chapter. No other scenery. [Windows PC, Commons]
- 2. Storage: RC remote on the second shelf: The remote floats and does not lift with the desk. It goes on the second shelf of the top shelf unit and moves with it. [Windows PC, Storage]
- 3. Create: fill and mirror the trade shelves: Painter and drafting shelves get real tools. Each trade also gets a mirrored shelf on the other wing in the same connector slot, with a different arrangement and highlights. Fade in and out stays as is. [Windows PC, Create]
- 4. Music: a natural walk for the gamer: Same end spot, curved path, his heading turning gradually forward as the desk centres. No turning on the spot. [Windows PC, Music]
- 5. Media: better speakers on the side pedestals: Properly modelled speakers that sit flush on the left and right pedestals, in the room’s materials. [Windows PC, Media]

## Done
- Codex: faces for the whole cast: Smiles, blinks and brows for all twelve characters, performed in the rooms and in film time. Committed and pushed; moves every room's people, so it rides on epoch 13 and is in the next film. [Codex, Merged]
- Final 4K film delivered: 240.3 s, 4K, on the desk and on your phone. Includes the hero pass with end card, Commons phone, awareness sonar, Rise exit, Coast hands, Wellness order, Media and Oilers edits, and the new score. [Film]
- Fold layout fixes, rounds 1 and 2: Readable pickers, 44 px tap targets, bigger stage, Titles lane open on a phone, timeline fits its lanes, narrower label column. Merged. [Director, Merged]
- Fold phone mode, titles by touch, Send to desk: Inspector as drawer or bottom sheet, closable demo card, top-bar overflow, move, trim and add titles by touch. Sends are protected by a desk code. Merged; the Director server was restarted. [Director, Merged]
- Diagonal wheel moves: Add a Travel move and pick a diagonal in the Direction list, then the distance in inches, like any other wheel move. Also Approach a landing spot. Merged. [Director, Merged]
- Chapter 1 foot light: Brighter, bluer pool under the base from 7.5 to 9.5 s, only that light. In the cut; shows in the next film. [Awaken, Merged]
- Keyboard tray design spec: Joints (slide, swivel, tilt), Blender split, new data field with its own keys, Director tray mode, phases and risks. Merged as docs; now being built. [Keyboard tray, Merged]
- Movie editor for the media movie chapter: Cut, trim, reorder and add dissolves or dips between clips, with a source bin that holds the full 10-minute movie. Merged. [Director, Merged]
- Screen reflection controls (brightness, saturation, contrast, tint): For the game and movie chapters, in the Lighting tab. Merged. [Director, Merged]
- Sonar rings visible in the Director: Fixed the live view so they show. Your awareness look is in the cut and in the film. [Director, Merged]
- Hero chapter pro pass: Camera, desk and light re-keyed without the whip, the end card moved inside the chapter. Chapter is now 25.5 s. [Hero]
- Commons: phone on the charger: The wheelchair girl sets the phone on the pad, it charges and glows. Yara’s phone no longer leaves a ghost. [Commons]
- Rise: jitter, landing and exit-from-stretch fixes: Arm switch is smooth, the arms come back to the keyboard by the same path they left it. [Rise]
- Wellness: new sequence: Sit, stand, type, notice, stretch and squats, then back to sitting. [Wellness]
- Coast: student hand glitch at 1:52: Fixed where she stands up. [Coast]
- Thumb control and pose-key selection: Curl or stretch the thumb in pose mode. Click a pose-key diamond in the People tab to select it. [Director, Merged]
- Housekeeping: Older full films and finished worktrees deleted. Disk is fine for now. All work committed and pushed with notes. [Repo]

## Resume guide

RESUME GUIDE (written 2026-11-21 ~21:30 PST, main = a352dd00 + later snapshot commits; HEAD = origin/video/cinematic-intro-hq = origin/staging/director-merge)

WHO IS WHO
- org = the Claude Code session on Vico's desk (main checkout /home/ergo/ErgoFlex_Custom_Shop, branch video/cinematic-intro-hq, staging branch staging/director-merge). Coordinates, verifies, merges, keeps this board and docs/work-board/STATUS.md current.
- ui = Director UX session on the desk (makes its own worktrees ~/ErgoFlex_Custom_Shop_<Name>WT). Does Director screens, Fold touch mode, keyboard tray UI/data.
- 3dmodeling = Claude session on the Windows render PC (reached via Remote Control / cross-session message). Runs engineer agents (max 2 at once, GPU only through its lock), all renders, stills, clips and browser e2e. The render watcher renders queued jobs.
- Codex = separate agent on the desk making people/model work (faces etc.). Its files appear uncommitted in the main checkout; commit them with a note that it is Codex's work once quiet 40+ min.

VICO'S STANDING RULES
1. Merge finished, tested branches as they arrive, even when he does not answer (push video/cinematic-intro-hq, then HEAD:staging/director-merge; confirm HEAD = origin = staging and curl localhost:3000 = 200). Run the branch's tests AFTER merging into main, not before.
2. Agents are Sonnet 5.5. Opus 5.5 only after asking Vico first.
3. Render-epoch bumps and queueing a film need his say, EXCEPT epoch 13 (all-metal aluminium look) which he approved; Codex faces ride on it. Epoch 13 is NOT yet written in tools/experience/render-epoch.txt: it arrives with eng/desk-aluminium-look (the epoch line should mention BOTH the all-metal look and Codex's cast faces).
4. Do not delete his data. "Enough space, do not delete anything else for now."
5. Keep this board + STATUS.md updated; show him stills for anything he must look at (SendUserFile to his phone; desk receiver rejects .mp3/.m4a names, use .mp4).
6. Engineering/rendering goes to Windows (3dmodeling); the desk has little RAM/disk: no browser e2e, no long Director loads, people builds --jobs 1.

STATE OF THE FILM
- Final 4K of the seated 3rd cut (exports/cinematic-intro-cut-vicos-3rd-cut, 240.328 s) is delivered and reviewed ("awesome"). A NEXT film is wanted but waits for Vico's go (see below).
- Next film will carry: epoch 13 (all-metal look; moves the nine room chapters, so nearly a full render), Codex faces (all rooms' people), chapter 1 foot light (data), new score (re-finish only), Rise phone/ring fix, Commons redwoods, storage RC remote, Create shelves, music walk, media speakers as they land.
- To queue a film when Vico says go: make a fresh cut handoff branch (temp worktree ~/ErgoFlex_Custom_Shop_CutHandoffWT, rsync excluding score/, *.wav, screens/*.mp4, screens/edl; git add -f; push cut/... branch; remove worktree), then RENDER_REQ_IMPORT_WAIT=0 bash tools/experience/render-request.sh <request.json> (request: {v:1, scope:"film", chapter:"rise", resolution:"4K", cut:"exports/cinematic-intro-cut-vicos-3rd-cut", note, created, signature:"3b554e65fa72a909", exportSha:null, estimateMinutes}). The watcher reuses cached chapters whose keys did not change. Chapter keys: python3 tools/experience/chapter-keys.py <cut> --resolution 4K (the --json flag crashes). Say the wait before queuing; rebuild edl/score (tools/experience/build-cine-score.py <cut> [--edl-only|--check]) if lengths change.
- Score: new score.wav (sha256 55c080fd0d55aae9b78932aa2921f007e42668887cc4e904274929a15d3397be) is installed in the cut's score/ folder on the desk (untracked); the old one is backed up in ~/ErgoFlex-Renders/score-before-join/. Code merged (586e52ad).

IN FLIGHT (who, what, how to verify and merge)
1. 3dmodeling: eng/desk-aluminium-look (all-metal aluminium, every room; epoch 13). On handback: check before/after stills per room, tests, which chapters move; add the epoch 13 line; then ask Vico for the film go.
2. DONE and merged (b94525f0): foot light = ONLY the blue foot light (Vico's choice), white strips off from 7.5 s to the end of chapter 1; waiting on stills and Vico's word on when the white returns. Original brief: The three white floor strips (ledFloorSources center/left/right) go OFF before 7.5 s and stay off through the start of the lift. Data only in previews/awaken-v5-cut.json (+ review-cut.json awaken entry + docs/awaken-foot-light/awaken-foot-light-export.json, CRLF file). Merge when pushed; tests/cinematic-floor-keyed-test.mjs; only awaken's chapter key should change. Open question for Vico: hold the blue until the lift chase at 10.4 s (about 0.9 s grey floor between)? Send him the 9.5 s and 10 s frames. Hot-core control (coreBoost/coreSat) is shelved.
3. 3dmodeling: Commons redwoods (eng/commons-redwoods; one large + mid + small, natural spacing, only Commons).
4. 3dmodeling queue after those (Sonnet 5.5 each): 0) Rise phone flush + charge-pad ring clipping (director-film/rise.json accessories ergoflex-phone y 12.4; find the ring mesh in the GLB; nudge up; phone down; stills; list chapters that use the same GLB; do not commit the convert-props index.json rewrite); 1) storage RC remote on the second shelf of the top shelf unit and lifting with the desk; 2) Create trade shelves filled with tools and mirrored on the other wing; 3) Music gamer's natural curved walk; 4) Media speakers on the pedestals.
5. 3dmodeling (its own runs): foot dimmed-strips P1 sheet (superseded by item 2, may be dropped); Fold e2e re-run at four sizes: node tests/fold-titles-e2e.mjs --shots shots\fold --views 884x1100,1100x884,697x800,837x600; report pass/fail. If failures need fixing, ask ui via org.
6. ui: keyboard tray build. Phases 0-2 are merged (spec, pure joint model experience/tray-pose.mjs + tray-limits.mjs, rig glb assets/props/ergoflex-keyboard-tray-rig.glb, hidden prop index entry). Phase 3 (trayEdits shot field, importer, film field sceneTray, shared sampler in stage + film-fx, early-return gate) is running on ui/keyboard-tray-build. Later: Director Tray mode (double-click the prop). Vico VETOED the added mount bracket in the base model (original stays exactly as is, drop off by default), then asked for it as an OPTIONAL inspector checkbox, off by default (shot flag, not in the base rig). Windows rest-pose pixel parity and clearance probe. Slide is 234.5 mm as measured (Vico's product 254 mm would need a 20 mm longer track; ask him). Swing pivot sits 143 mm inside the desk edge, so a swung tray passes under the desk and needs the drop.
7. ui: Fold polish after the Windows e2e report. Open: Titles second row at 697 px wide may need scroll; auto-reveal reopens a collapsed landscape drawer on every selection (could be limited to title selections); the 837x600 stage is small by arithmetic.
9. ui (queued after tray phase 3): status lights locked to motion clips (see Working now). 3dmodeling: foot floor glow follows the lift (data, awaken source).
8. Codex: faces committed (a2be39cf). More Codex files may appear uncommitted in the main checkout: commit and push them quiet 40+ min with a note.

WAITING ON VICO
- Next film go (epoch 13 + all the above). Which second he hears the score's two tempos colliding (18.65 s tilt/chord change vs the lift top 16.15 s; nothing was added at 18.65 yet). Hold the blue foot light until 10.4 s? Tray slide 234.5 vs 254 mm. Type the Send-to-desk code once on the Fold (code was given in chat; new code: node tools/director-inbox.mjs --new-token).
- Fold Director link (tailnet only): https://ergoflexdesk02.tailf693b8.ts.net/exports/cinematic-intro-cut-vicos-3rd-cut/director-index.html ; the :3000 studio-server (node tools/studio-server.mjs --port 3000 --host ::) must be restarted to pick up new server code.

TRAPS
- chapter-keys.py compare only against the same-method run, not queue entries with other methods. Keys hash chapter data + epoch (+ per-chapter epoch lines), not code.
- CRLF files: preserve line endings (whole-file diffs otherwise). Importer: DIRECTOR_IMPORT_DIRS=<dir> DIRECTOR_IMPORT_STATE=<state.json> PYTHONUTF8=1 python3 tools/experience/director-import-watch.py --once.
- Windows-only test failures (path separators, Pillow/python3 Store stub) are not product failures; tests pass on the desk. pose-thumb-test and editing-camera-test fail on the base (unrelated).
- Check exports/render-queue/queue.json before merges that touch render code (a merge once broke two unfetched 4K jobs).
- Memory notes live in /home/ergo/.claude/projects/-home-ergo-ErgoFlex-Custom-Shop/memory/ (MEMORY.md index); the full previous conversation is in /home/ergo/.claude/projects/-home-ergo-ErgoFlex-Custom-Shop/1c39807e-d572-43fd-b4a6-3a93f7e8be89.jsonl.
