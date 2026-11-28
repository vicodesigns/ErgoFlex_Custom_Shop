# Hero seam props: Architect plans and the Artist -> Architect dissolve (3rd cut)

28 Nov 2026, branch `director/hero-seam-props` (off `origin/video/cinematic-intro-hq` b2f57a3c). Data only, no code change.

## Problem
In the hero chapter, the B -> C desk-version crossfade (Artist -> Architect, chapter 6.54-7.14 s) has a problem: the yellow
tracing-paper roll and its pulled-out sheet on the left of the Architect desk top (`hdarchtrac`) read solid at about 7.07 s
while the rest of the desk is still dissolving (1080p render req-20261128T043341).

## Cause (verified headless from that render's own sub-shot clips, F:\ErgoFlex_Render\queue\req-20261128T043341\finale)
- The prop is not leaking into the B render. `02.mkv` (B, Artist) never shows it, and `forThisDesk` skips `desk:'architect'` edits there.
- No duplicate, accessory, follow, stow or keepDeskItems path shows it either. In `03.mkv` (C, Architect) the roll first appears at
  C-time 0.37 s, i.e. chapter 6.91 s = 6.54 + `show.from`. `showFactor` works as written.
- That render did NOT use `from .96`: the render checkout's 3rd-cut stores (F:\ErgoFlex_Render\ErgoFlex_Custom_Shop, files
  of 27 Nov 20:36, provenance studio-state rev 9987) all carry `show {from .36, to 5.41, fadeIn .7, fadeOut .3}` for the
  Architect props. So the roll was mid-fade at 7.07 s (factor 0.24), on top of the B/C crossfade.
- It reads denser than the other props at the same factor for two reasons. Its "Paper · yellow trace" material is already
  translucent (alpha .9, BLEND), and the roll is two paper faces over an opaque card core, so at 24 % opacity it looks about
  half solid. Meanwhile the cubby, shelves and so on are barely visible.
- The real mismatch: the desk dissolve IS the crossfade of the B and C renders (in C the desk is solid from its first frame). A
  desk-scoped show fade-in comes on top of that crossfade, so props on their own clock never share the dissolve's timing:
  `from .96` makes them late, and `from .36` gives the uneven partial fade seen here. A `from 0, fadeIn .6` window would multiply
  the two (w^2) and still lag.

## Change: hand back as data (`tools/experience/drafts/polish1128-hero-seam-props/apply-seam-props.py`)
For `hdarchtrac` (desk architect): set `show.from` to 0 and remove `fadeIn`. `to` and `fadeOut` stay exactly as the user set them. The prop is
then solid in C from frame one, so on screen it fades in exactly with the desk, inside 6.54-7.14 s. The other Architect props keep
their own timing (they still come in after the dissolve, as the user set them).

```
python3 tools/experience/drafts/polish1128-hero-seam-props/apply-seam-props.py exports/cinematic-intro-cut-vicos-3rd-cut          # dry run
python3 tools/experience/drafts/polish1128-hero-seam-props/apply-seam-props.py --apply exports/cinematic-intro-cut-vicos-3rd-cut  # write
```
The script covers every hero store in the cut folder: shots/13-subshots.json (shots[1..4]), director-film/hero.json, director-film/hero-subshots.json
(shots[1..4]), director-camera-hero.json (props[]) and review-cut.json (shots[11]), plus cut.json if present (11 entries on b2f57a3c).
It edits only the text of each `show {...}`; every other byte stays, and it checks that the text edit equals the structural change
before writing. It is idempotent. Tested on copies of the b2f57a3c files, and on a copy with the live `from .96`.
Exact JSON paths (b2f57a3c indices; the script finds entries by id): hero.json `$.sceneEdits[44].show`;
13-subshots / hero-subshots `$.shots[1].sceneEdits[47]`, `[2]...[45]`, `[3]...[43]`, `[4]...[44]` `.show`;
director-camera-hero.json `$.props[38].show`; review-cut.json `$.shots[11].sceneEdits[44].show`.
Target: `{"from": 0, "to": <unchanged>, "fadeOut": <unchanged>}`.

`--with-rolls` also moves `hdarchroll` (rolled drawings) and `evb37kaue` (the side cup holder they stand in). Those sit on the
desk's RIGHT side (x +1.08..1.29), the cup/tray side the brief said to leave alone, so they are off by default. If the rolls are
wanted, the holder must go with them, or the rolls would float.

## Verified / not
- Verified (headless, ffmpeg on the existing render): the cause above, and the script's dry run, apply and idempotence on copies.
  Before strip: 6.4-8.6 s at 12 fps, desk crop, tiles in row-major order from 6.40 s in 1/12 s steps (scratchpad,
  `before-strip-req043341.jpg`).
- NOT verified: an after render. The GPU was busy with a 4K film (watcher not at `new=0`), so no browser was opened.

## Pending GPU commands (when watcher.log ends "queue: N jobs, ... new=0", no C:\work\gpu.lock, holding _stills-render.lock)
```
cd C:/Users/Vico/polish-wt/hero-seam-props
mkdir C:/Users/Vico/polish-wt/_stills-render.lock
D=exports/cinematic-intro-cut-vicos-3rd-cut; cp $D/shots/13-subshots.json $D/shots/13-subshots.after.json
python tools/experience/drafts/polish1128-hero-seam-props/apply-seam-props.py --apply $D/shots/13-subshots.after.json
node tools/experience/render-server.cjs &   # (if not already serving this worktree)
CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe' node tools/experience/render-cut.cjs --cut $D/shots/13-subshots.after.json --shots 1,2 --video --out <scratch>/after
ffmpeg -i <scratch>/after/01.mkv -i <scratch>/after/02.mkv -filter_complex "[0][1]xfade=transition=fade:duration=0.6:offset=5.59" -c:v libx264 -crf 12 <scratch>/after/BC.mkv
ffmpeg -ss 5.45 -i <scratch>/after/BC.mkv -t 2.2 -vf "fps=12,crop=1000:640:620:420,scale=500:-2,tile=9x3" -frames:v 1 <scratch>/after-strip.jpg
rmdir C:/Users/Vico/polish-wt/_stills-render.lock; git checkout -- exports/director-autosaves; rm $D/shots/13-subshots.after.json
```
(BC.mkv starts at chapter 0.95 s, so -ss 5.45 = chapter 6.40 s. Match the crop to the before strip, taken from chapter.mkv.)
Expected: the roll and sheet are at the crossfade weight, like the desk (none of it at 6.54 s, all of it at 7.14 s), and the other props keep their own later fade.

## 4th cut
exports/cinematic-intro-cut-vicos-4th-cut has the same entry with `show {from .96, to 5.41, fadeIn .4, fadeOut .3}`, so it has the
same seam issue and lacks this fix. The script would apply there too (pass that folder), but per brief it was not touched.
