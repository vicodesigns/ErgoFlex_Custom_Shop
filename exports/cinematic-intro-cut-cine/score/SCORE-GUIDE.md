# The Cinematographer's cut's score: how it follows the picture

The music has no loop points and no fixed stings to trim by hand. It is generated from this cut by one command. Run
the command again after any change to the picture: a chapter made longer or shorter, a hard cut moved or added, a title
moved, a desk move retimed, or a desk version added to the finale. The music is rebuilt around the new timing.

    python3 tools/experience/build-cine-score.py exports/cinematic-intro-cut-cine

The command takes about 2 minutes on the CPU (numpy and ffmpeg) and needs no GPU. Its last lines print the WAV's
sha256 and `check OK`. Run it on the desk, where the film is frozen: `score/score.wav` is not in git.

## What it reads (everything is in this folder)

| file | what the score takes from it |
|---|---|
| `review-cut.json` | each chapter's length (`seconds`); the hard cuts inside chapters (camera keys with `cut`); the desk's `ledStatus` events and `motion` clips (the movement sounds play only while the motion clip of their lane runs; both are hashed for the four chapters with sounds) |
| `titles-src.json` | title A and title B (the opener's two cards) and the logo (`logo.rel_in`): the bloom, the lift and the logo hit land on them |
| `shots/13-subshots.json` | the finale's desk versions: the chord changes with each version |
| `edl.json` | **generated** from the two files above by the same command (chapter starts, total length, dissolves). Do not edit it by hand. Its dissolve lengths and types (`transitions`) are the one part kept from the file, so change those there and re-run |

## What it writes

- `score/score.wav`: the music, exactly as long as the film.
- `score/tempo-map.json`: every bar and beat, per chapter relative to its start (the gaming room's screens take their beat from this file).
- `score/CUE-SHEET.md`: sections, chords and tempo per chapter, every sync point, and which cuts sit on the beat.
- `score/score-analysis.json` and `score/score-spectrogram.png`.

## How it fits the music to a chapter

- **Chapter starts.** Every chapter starts on a bar line inside its dissolve: within 0.3 s of the dissolve's centre.
- **Whole bars.** Every chapter gets whole 4/4 bars. A chapter that gets longer or shorter gains or loses bars, and its tempo moves by at most 3 %. A 2/4 bar is a last resort (`HALF_BAR_COST`), used only if no whole-bar length fits under the step cap; the cue sheet says so. On today's cut there is none: the whole film runs at about 111-114 BPM, slower than v1's 114-117, which is what lets media take whole bars.
- **Steady tempo (v2).** No tempo step anywhere is larger than 1.5 % (`STEP_CAP`): not between chapters, not at title B, not inside a chapter. A steady groove comes before cutting on the beat.
- **Cuts on the beat.** A hard cut inside a chapter is pulled onto a beat only when that keeps every step under the cap (a knot). The cue sheet's "Picture sync" table lists each cut as on the beat, or how far off it is.
- **Finale (v2.1).** Each desk-version change aims at a bar line; it lands exactly on one (a knot) where the cap allows. The chords move in even 2-bar steps (`HERO_CYCLE`: D/F#, Gmaj9, Em9, Bm9), restarting at every version change, so each version brings a chord change; a version that lasts an odd number of bars ends on a 1-bar chord. The last 4 bars are Gmaj9, Asus4, A into the logo. The logo hit lands within 0.1 s of the wordmark's first frame (`LOGO_SLACK`). The finale's timing comes from `shots/13-subshots.json`, so a reordered finale needs only a re-run.
- **Echo (v2).** The dotted-eighth echo follows the local tempo, so its repeats stay on the beat where the tempo bends.
- **Movement sounds (v2).** They follow the cut's `ledStatus`, and play only while the desk really moves that way (the chapter's motion clip of the same lane):
  - the opener: lift, tilt and wheels;
  - the library and awareness chapters: wheels;
  - the workshop: fold, roll and lift.

  Each sound is re-keyed (resampled) by the shift that puts the most of its pitch energy into the score's key, D major.
- **Mix (v2).** `SFX_DB` (-22 dB lift and tilt, -25 dB wheels) is a gain on the raw sound file, relative to the master's gain: 8 dB lower than v1. Measured at the cues, that puts the sounds about 23-33 dB under the music. The sounds are re-keyed by the shift with the most energy in D major; shifts within `KEY_TIE` of the best count as a tie, and the smallest shift wins.

To change any of these rules, edit the knobs at the top of `tools/experience/build-cine-score.py` and re-run:
`DISSOLVE_SLACK`, `MAX_BEND`, `STEP_CAP`, `CUT_WEIGHT`, `HERO_CYCLE`, `HERO_CADENCE`, `SFX_RULES`, `SFX_DB`, `SCORE_KEY`.

## The check

    python3 tools/experience/build-cine-score.py exports/cinematic-intro-cut-cine --check

This fails, naming the problem, when `edl.json` or the score no longer match the cut. For example:
- a chapter's length, a cut or a title moved;
- the score is missing;
- the score was built from other inputs.

The check compares only what the music uses: chapter lengths and dissolves, the hard cuts, title A, title B and the
logo's time, the movement events of the chapters that have sounds, the finale's desk versions, and the music code
(comments do not count). A title's text, or an LED edit in a chapter without sounds, does not make the score stale.
`--check` only reads; the build writes `score/tempo-map.json`.

A render request for this cut runs the same check and is refused until the command above has been run again. One
failure the command cannot fix: a title that runs past its chapter's end. That is fixed in the Director (the request
says so).

A copy of this cut (`film-cuts.py duplicate`) takes the generated `edl.json` but not `score/`. The duplicate command
prints the one command that builds the copy's score; until it has run, render requests for the copy are refused with
the same command.
`render-request.sh` then lays this folder's `edl.json` and `score/score.wav` over the master's in the freeze.
