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
| `review-cut.json` | each chapter's length (`seconds`); the hard cuts inside chapters (camera keys with `cut`); the desk's `ledStatus` events (the movement sounds) |
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
- **Whole bars.** Every chapter gets whole 4/4 bars. A chapter that gets longer or shorter gains or loses bars, and its tempo moves by at most 3 %. When nothing else fits, a chapter ends on one 2/4 bar (the cue sheet says so).
- **Steady tempo.** A tempo step between neighbouring chapters is costed (`JUMP_WEIGHT`), not forbidden: today the largest step is 2.4 %, and the cue sheet's section map shows each chapter's tempo.
- **Cuts on the beat.** A hard cut inside a chapter is pulled onto a beat where the tempo allows it. The cue sheet's "Picture sync" table lists each cut as on the beat, or how far off it is.
- **Finale.** Each desk version gets its own chord. The last version goes IV, Vsus, V into the logo.
- **Movement sounds.** They follow the cut's `ledStatus`:
  - the opener: lift, tilt and wheels;
  - the library and awareness chapters: wheels;
  - the workshop: fold, roll and lift.
- **Mix.** The movement sounds sit 14 dB (lift, tilt) and 17 dB (wheels) under the music.

To change any of these rules, edit the knobs at the top of `tools/experience/build-cine-score.py` and re-run:
`DISSOLVE_SLACK`, `MAX_BEND`, `CUT_WEIGHT`, `LOOK_CHORDS`, `SFX_RULES`, `SFX_DB`.

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
