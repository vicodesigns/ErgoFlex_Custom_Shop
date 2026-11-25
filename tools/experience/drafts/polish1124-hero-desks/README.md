# polish1124 Stream D: chapter 12 hero desks (scene draft)

The draft is built on Vico's live hero export **(3)**: `Film-chapter-hero-25-95-s- (3).json`, imported 21:48:16, sha 925579f17fcf
(`exports/cinematic-intro-cut-vicos-3rd-cut/director-exports/export-925579f17fcf-Film-chapter-hero-25-95-s-__3_.json`,
checkpoint director/checkpoint-1124h f23c02f4).
**Note:** the watcher's copy `director-import/ErgoFlex-film-ch12-hero-director.json` is NOT byte-identical to (3): sha e92e1973,
and it has no filmTitles. The draft uses the raw (3) export, whose sha matches.

The draft is `ErgoFlex-film-ch12-hero-director-DRAFT-hero-desks.json`, rebuilt with:

    node tools/experience/drafts/polish1124-hero-desks/make-draft.mjs <(3) export> --film exports/cinematic-intro-cut-vicos-3rd-cut/director-film/hero.json

## What the draft changes compared with the (3) export

One field is added: `shots[0].propEdits`. It holds his 47 Director prop edits, copied unchanged from the live
`director-film/hero.json` (his director:true entries), followed by 22 add edits for the `herodesk-*` and `ergoflex-mic-boom-arm` props.
Every add carries its desk and that desk's show window. Every other byte of the export is unchanged, and make-draft.mjs checks this.

## Two variants: pick one

- `ErgoFlex-film-ch12-hero-director-DRAFT-hero-desks.json` is (3) plus propEdits. Importing it also re-imports (3)'s filmTitles.
  That reverts the hero title's typography in titles-src.json to (3)'s values (eyebrow 42 -> 41, detail 44 -> 49 px, the dy offsets
  dropped). His own (3) export would do exactly the same.
- `...-DRAFT-hero-desks-keep-titles.json` is the same without filmTitles, so titles-src.json is left alone. **Recommended.**
  Dry run on checkpoint-1124h: the only changes are the 22 props, the 3 screens, the hero directorEdited timestamp and
  director-camera-hero.json props (47 -> 69). The sub-shot cameras and titles-src.json are byte-identical.

**On Windows, run the importer with `PYTHONUTF8=1`.** Without it the importer reads the cut as cp1252 and garbles labels
('Side shelf Â· large'). This has nothing to do with these files; it happens with any export.

## Screen clips (the render PC needs them; they are gitignored)

The files go into `exports/cinematic-intro-cut-cine/screens/` under these names:

| delivered as | real name |
|---|---|
| polish1124-herodesks-screen-cine-hero-desk-artist-portrait.mp4 | cine-hero-desk-artist-portrait.mp4 |
| polish1124-herodesks-screen-cine-hero-desk-artist-wide.mp4 | cine-hero-desk-artist-wide.mp4 |
| polish1124-herodesks-screen-cine-hero-desk-architect-wide.mp4 | cine-hero-desk-architect-wide.mp4 |

To rebuild them: `node tools/experience/screens/capture.mjs cine-hero-desk-artist-portrait cine-hero-desk-artist-wide cine-hero-desk-architect-wide`

## Order of steps (on the desk; do a dry run on a copy first)

    CUT=exports/cinematic-intro-cut-vicos-3rd-cut
    # 0. dry run: run steps 1-4 with CUT pointing at a scratch copy of the cut folder, and compare the result with a copy
    #    that only had his plain (3) export imported
    # 1. import the scene draft (props go into the chapter and all four hero sub-shots)
    export PYTHONUTF8=1
    python3 tools/experience/build-round8-director.py $CUT --import tools/experience/drafts/polish1124-hero-desks/ErgoFlex-film-ch12-hero-director-DRAFT-hero-desks-keep-titles.json
    # 2. the pass
    python3 tools/experience/build-round8-director.py $CUT
    # 3. the desk screens into the artist and architect sub-shots (adds entries only, safe to run twice; --dry-run reports only)
    python3 tools/experience/drafts/polish1124-hero-desks/add-desk-screens.py $CUT --dry-run
    python3 tools/experience/drafts/polish1124-hero-desks/add-desk-screens.py $CUT
    # 4. (if Director pages are rebuilt) build-round8-director.py $CUT --pages hero, then step 3 again (it changes nothing if the entries are already there)
    # 5. the camera-only draft (polish1124-hero-desks-camera), only if the crop re-check needs it: import it last

Step 3 must run after any step that rewrites `shots/13-subshots.json`, because the import never carries hero screens into
the sub-shots.

## Dry-run result (scratch copy of checkpoint-1124h)

Compared with importing his plain (3) export into the same copy, the only changes are:

- `shots/13-subshots.json`: +22 sceneEdits in each of the four sub-shots (each is skipped outside its own desk), +2 screens in the
  artist sub-shot, +1 screen in the architect sub-shot.
- `review-cut.json`: the hero shot gets +22 sceneEdits, and its directorEdited timestamp changes.
- `director-camera-hero.json`: props 47 -> 69.
- `director-film/hero-subshots.json`: +3 screens (step 3).

Nothing else differs.

A side effect of the importer, which happens with his own (3) export too: re-importing (3) rewrites `titles-src.json`
("1 title of hero no longer in the export: removed"). The checkpoint's titles-src has a hero title that (3) does not.
