# Screen edit list: contract (render / capture side)

Status: CONTRACT v1, 2026-11-21. Owner of the render side: eng `screen-edit-list` (branch `eng/screen-edit-list`).
The Director UI (session `ui`) builds the clip track; this file says what the data is, what the render does with it,
what it costs in the render cache, and what the importer / exporter must carry.

Goal (Vico): edit the video shown on a screen of a chapter like in Premiere: cut, trim, reorder, transitions
(cut / dissolve / dip) between clips. First users: chapter 10 `media` (movie night: the movie on the TV, target
`main-landscape`) and chapter 9 `music` (gaming room, the `09-game-montage.mp4` on `main-landscape`).

## 1. Data: the edit list IS `shot.screens` (one source of truth)

No new list. A **track** is the set of `shot.screens` entries with the same Graphics-lane track key
(`experience/graphic-clips.mjs graphicTrack(sc, i)` = `[target ?? i, mesh, material, person, within]`).
A track is an **edit list** when at least one of its entries has a `transitionIn` field (any type, `cut` included).
A track without `transitionIn` anywhere renders exactly as today (one film-fx screen per entry, nothing composed;
proved by the tests in `tests/screen-edit-list.test.mjs`, see section 8).

### Fields (per clip = per `shot.screens` entry)

| field | unit | range / default | status | meaning |
|---|---|---|---|---|
| `target`, `mesh`, `material`, `person`, `within` | | as today | existing | which screen (track identity) |
| `src` | repo path | any file from the source bin (section 5) | existing | the clip's source video |
| `start` | chapter s | `0 <= start < end`, default 0 | existing | timeline in (where the clip comes in) |
| `end` | chapter s | `start + 0.1 <= end <= shot.seconds`, default `shot.seconds` | existing | timeline out (the **cut point** to the next clip) |
| `offset` | source s | `>= 0`, default 0 | existing | **source in**: the source time shown at `start` |
| `rate` | x | `> 0` (0.25..4 sensible), default 1 | existing | playback speed of this clip |
| `loop` | bool | default `true` | existing | source shorter than the clip: wrap (true) or hold the last frame (false, reported) |
| `transitionIn` | object | absent = cut | **new** | the transition from the previous clip of the track INTO this clip |
| `transitionIn.type` | | `'cut' \| 'dissolve' \| 'dip'` | **new** | |
| `transitionIn.dur` | s | `0 < dur <= 4`, ignored for `cut` | **new** | requested length; the composer may clamp it (section 3) |
| `transitionIn.color` | `#rrggbb` | default `#000000` | **new** | dip only: the colour it dips through (`#ffffff` = dip to white) |
| `compose` | object | first clip of the track only, optional | **new** | output overrides `{w, h, fps, audio}` (section 2); normally absent |

Source out is derived, not stored: `sourceOut = offset + (end - start) * rate` (decision (c): offset + length).
Display fields (`fit`, `rotate`, `flipX`, `flipY`, `brightness`, `inset`, `blend`, `res`) describe the SCREEN: on an edit
list track they are taken from the first clip (by `start`); a later clip that differs is reported, not applied.
`fit` is the exception: it is applied per clip when the clip is scaled into the composed frame.

Order: the clips of a track are ordered by `start` (array order does not matter; reorder = move clips on the timeline).
Clips of one track never overlap on the timeline (the Graphics lane's existing `editGraphic` rule stays as it is):
the outgoing clip's `end` is the cut point, the incoming clip's `start` is at or after it. A gap between clips is
allowed: the screen shows what it shows today without a clip (the glass's own picture), not black.

### Transitions (decisions (b) and (d))

Stored on the INCOMING clip. With `cut = previous.end` (= `incoming.start`, butt-joined clips):

* **cut**: hard cut at `cut`.
* **dissolve**, `d = dur`: the blend runs over `[cut - d, cut]` on the timeline, i.e. the incoming picture starts at
  `incoming.start - d` (decision (b): `incoming.start(effective) = previous.end - d`). The outgoing clip plays its own
  last `d` seconds (no tail handle needed); the incoming clip plays its **head handle**, source
  `[offset - d * rate, offset)`, Premiere-like: material from beyond the clip's in point. At `cut` the incoming clip is
  at exactly `offset`, so trimming / the Director preview and the render agree on every frame after the cut.
* **dip**, `d = dur`: the outgoing clip fades to `color` over its last `d/2`, the incoming fades up from `color` over its
  first `d/2` (centred on the cut, no handles). The frame at the cut is full `color` (that is the dip).
* `transitionIn` on the first clip of a track, or after a gap: `dip` fades up from `color`; `dissolve` has nothing to
  dissolve from and becomes a cut (reported).

Example (chapter 10 `media`, the 17 s movie night, the movie on `main-landscape`; fixture
`tests/fixtures/screen-edit-list/media-ch10.json`):

```json
"screens": [
  {"target": "main-landscape", "src": "app-reference/assets/desk_viewer/media/ambient-clip.mp4",
   "start": 0, "end": 6, "offset": 40, "brightness": 0.9},
  {"target": "main-landscape", "src": "app-reference/assets/desk_viewer/media/ambient-clip.mp4",
   "start": 6, "end": 11.5, "offset": 70, "rate": 1,
   "transitionIn": {"type": "dissolve", "dur": 1.0}},
  {"target": "main-landscape", "src": "app-reference/assets/desk_viewer/media/ambient-clip.mp4",
   "start": 11.5, "end": 17, "offset": 12,
   "transitionIn": {"type": "dip", "dur": 0.8, "color": "#000000"}}
]
```

Clip 2 dissolves in over 5.0-6.0 s using source 69.0-70.0 s of the movie as its handle; clip 3 dips through black
11.1-11.9 s. Old data (`"screens": [{"target": "main-landscape", "src": ".../ambient-clip.mp4", "offset": 40,
"brightness": 0.9}]`, no `transitionIn`) is not an edit list and renders as today.

## 2. Composed output: one mp4 per edit-list track

* Path: `exports/<cut>/screens/edl/<chapter>-<track>-<key12>.mp4` plus `<same>.json` (the readable report and the plan).
  `<cut>` = the `exports/` directory the rendered cut file lives in (for a render-queue job that is the freeze dir);
  `<track>` = the target slug (`main-landscape`, `tv`, ...); `<key12>` = first 12 hex of the **compose key** (below).
  The name is content-addressed: an existing file with the right name is reused, from any `exports/*/screens/edl/`.
  Like every capture, these are gitignored (`exports/**/*.mp4`).
* Format: H.264 `yuv420p`, CRF 16, `-g 15`, `+faststart` (seek-friendly, like capture.mjs), constant fps.
  Size = the first clip's source size with the long side capped at 2048 (film-fx's screen canvas cap), even;
  fps = 30 (the film's and every capture's). Each clip is scaled with its own `fit` (cover = scale + centre crop,
  contain = scale + black pad, stretch). `compose: {w, h, fps}` on the first clip overrides.
* Audio: none by default (film-fx plays every screen muted; the film's sound is the score). `compose.audio: true` adds
  AAC audio when every source has an audio stream (atempo for the rate, acrossfade on dissolves, afade on dips).
* Timeline: the file's frame 0 is the track's first `start`; it covers `[first.start, last.end]` (gaps are black in
  the file but never shown).
* When: (a) on demand by the renderer: `render-cut.cjs` / `render-still.cjs` call `applyScreenEdits()` for each shot they
  render; an edit-list track whose composed file is missing is composed then (ffmpeg on that machine, about real time
  at 1280x720, CPU only, no GPU), then reused. (b) by hand / before a freeze:
  `node tools/experience/compose-screen-edit.mjs <cut dir or review-cut.json> <chapter id|index> [--dry]` composes (or
  with `--dry` only plans and prints the report) every edit-list track of that chapter.
* What the render sees: the track's entries are replaced, in memory only, by ONE entry per contiguous run of clips:
  `{...first clip's display fields, src: <composed mp4>, start: run.start, end: run.end, offset: run.start - first.start,
  rate: 1, loop: false}`. film-fx.mjs is unchanged (it already plays `start` / `end` / `offset` entries).

## 3. Clamping and the report (decision (d))

All lengths are whole frames at the output fps. A dissolve of `d` needs, and is clamped to:
`d <= offset / rate` (head handle: source before the incoming clip's in point; handles never wrap a looping source),
`d <= outgoing length - outgoing's own dip-in half`. A dip's halves are clamped to the clip lengths the same way.
A transition clamped below one frame becomes a cut. Every clamp is a line in the report, e.g.
`main-landscape clip 2: dissolve 1.00 s -> 0.40 s (head handle: offset 0.40 s at rate 1)`.
A source shorter than its clip with `loop: false` is reported as `holds last frame` (a frozen picture: Vico decides).
Nothing else can produce black or frozen frames: every frame of a clip is a distinct source frame of a real decode.

## 4. Cache key: which hash changes

* The render queue's **chapter key** (`tools/experience/chapter-keys.py`: sha256 of the chapter's whole shot + the sha256
  of every media file the shot names + seed + epoch) changes for an edit list **with no change to that script's
  hashing of the shot**: the edit list lives in `shot.screens`, so any edit (trim, reorder, transition, rate) changes the
  shot and with it that chapter's key only; every source clip the list names is a media string of the shot, so a
  re-captured / replaced source changes the key through `payload.media`. The composed mp4 is derived and NOT hashed.
* One addition: a chapter whose shot has an edit-list track gets `payload.screenEdit = <composer version>`
  (`tools/experience/screen-edit-version.txt`), so a change to the composer re-renders exactly the chapters with edit
  lists. A chapter without one has no such field: its key is byte-identical to before (tested).
* Unchanged list = same key; edited list = different key; no list = the key of today (tests, section 8).
* The **capture.json `motion` hash** (capture.mjs `motionKey`: sha1 of `{motion, seconds}`, checked by check-screens.py
  for stale captures) does NOT change: editing a screen edit list never asks for a re-capture, and it is not part of the
  render key anyway. Re-capturing a source changes that source's sha256 and so the chapter key (as today).
* The composed file's own **compose key** (its name): sha256 of canonical JSON
  `{version, fps, w, h, audio, clips: [the track's entries, as stored], sources: {src: sha256}}`.
* No render epoch bump. Chapters whose key changes when an edit list is added: only the chapter(s) carrying it
  (10 `media` and/or 9 `music`).

## 5. Source bin

`node tools/experience/compose-screen-edit.mjs --bin [<cut dir>]` prints (and with a cut dir writes
`<cut>/director-film/screen-bin.json`) every usable source: `{src, group, seconds, w, h, fps, audio}`. What exists:

| group | where | in git? | what |
|---|---|---|---|
| movie | `app-reference/assets/desk_viewer/media/ambient-clip.mp4` | no (app-reference, frozen via freeze-lists/untracked-app-reference.txt) | 100 s, 1280x720, 30 fps, no audio: chapter 10's movie today (offset 40) |
| demo | `app-reference/demo_media/*_demo.mp4` | no (frozen, all listed) | 49 wellness exercise demos |
| captures | `exports/*/screens/*.mp4` | no (gitignored; per machine) | the screen captures (cine-*, 09-game-montage.mp4, ...) |
| promo | `divi-editor/upload-to-promo/*.mp4` | yes | ErgoFlex promo clips (hero, LED, voice, vision) |
| game | `assets/led/game/neon-flight.mp4` | yes | the LED game loop |

**Missing**: the full movie (only the 100 s `ambient-clip.mp4` exists anywhere on the render PC or in the repo; Vico has
not said where a longer movie lives) and the game-montage's source reels (`game-montage.py <game-src dir>`:
`smb-nes.mp4, mario.mp4, smk-snes.mp4, kart.mp4, sf2-snes.mp4, sf6.mp4, doom-1993.mp4, fps.mp4`; not in the repo, not on
the render PC). Until they are added, chapter 9 can only re-edit the finished `09-game-montage.mp4` (15 s). A new source
must be added to the repo / app-reference and to `freeze-lists/` so the render PC gets it.

## 6. Director preview

film-fx ignores `transitionIn` / `compose`, so the Director's live stage plays the stored clips butt-joined: at a
dissolve or a dip it shows a **hard cut at the cut point** (exactly the frame the render shows right after the
transition). `ui` draws the transition chip: dissolve over `[cut - dur, cut]`, dip over `[cut - dur/2, cut + dur/2]`
(the requested dur; the clamped one is in the composed report). The real blend is render-side only (Render still /
Render preview).

## 7. Importer / exporter: what carries the new fields, what must change

Carried today, no change: `experience/cuts.mjs cleanShot` (structuredClone of `screens`), `film-lighting.mjs
exportLighting` (passes `screens` through), `build-round8-director.py run_import` (`lighting.screens = shot.screens`,
whole entries) and `apply_lighting` (deep copy into review-cut.json and the chapter's shot file), `chapter-keys.py`
(whole shot). So `transitionIn` and `compose` round-trip Director -> export -> import -> film.

Must change:
1. `experience/graphic-clips.mjs splitGraphic` (ui): the RIGHT piece must drop `transitionIn` (it copies every field
   today: the right piece would dissolve into its own left half). The left piece keeps it.
2. `build-round8-director.py film_list()` (org / whoever owns it): it drops every `screens` entry whose `src` is not on
   the desk (`local_clip` returns None). With an edit list that silently deletes clips from the Director's film shot, and
   the next Export cut writes the shorter list into the film. It must keep the entry (e.g. keep `src`, add
   `missing: true`; film-fx would skip it) instead of dropping it.
3. `editGraphic` / the drag: unchanged (no overlaps are stored). Reordering = moving clips; a clip keeps its
   `transitionIn` when it moves.
4. Validation (ui): `transitionIn.type` in the three values, `dur > 0` and `<= 4`, `color` `#rrggbb`; the UI may show
   the composed report's clamps after a render.
5. Freeze: a source outside the listed bin (section 5) must be added to `freeze-lists/` or the render PC fails the chapter.

## 8. Tests (render side)

`node --test tests/screen-edit-list.test.mjs` (synthetic `testsrc` clips in a temp dir, nothing big in git): lengths,
handle clamping, dissolve frames blend numerically (no black, no frozen frames), dip boundaries, runs/gaps, the no-list
identity (`applyScreenEdits` returns the shot unchanged), and the chapter key (unchanged list = same key, edited =
different, no list = identical to the key before this change).
