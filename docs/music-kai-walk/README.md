# Chapter 9 'music': Kai walks into the room, the camera becomes his point of view

`patch.json` is the change as data. Apply it to Vico's chapter; do not copy the stand-in's shot.

## What the patch sets

- `set.statusLight: false`. The chapter's status-indicator light is off, so the gaming LED look (`ledMode` 'media', `ledPreset` 'full') stays on while the desk turns. See `tools/experience/film-status-light.mjs`.
- `people.cast['kai-gets-up'].walk`. The walk is merged into his cast entry, key by key. Only `path`, `start`, `pace` and `turn` change. `then`, `at`, `turn` (151), `change` (2.2 s) and everything `held` / `postures` stay as they are.
  - The path in people mm is [-1079, 1348] (his walking placement's spot, as Vico has it) -> [-890, 890] -> [-370, 705], 1.05 m in all. With Kai's rig that is 2 strides plus 2 steps to stand, so 4 steps at pace 2 (2.0 s from 8.4 s).
  - As he stands up he turns 7 deg to his left (151 -> 158, the short way) and steps forward. He then bends right to 110 deg, which keeps his path at least 23 cm from the coffee table (as the film moved it). As he arrives he turns left to 180 deg, facing the desk square on.
  - The end spot is about 0.37 m from the room centre, on the desk's centre line within 10 cm, and 1.2 m in front of the desk centre.
- `people.when['kai-gets-up']`: [[7.2, 9.58, 0.5, 0.13]]. He still comes in at 7.2 s with the default 0.5 s fade. He fades out over 0.13 s as the camera enters his head. From inside, the model shows its eyes and mouth from within, which the first test still showed.
- `camera` from 8.4 s:
  - Every camera key after 8.4 s is replaced.
  - A key at 8.4 s is the chapter's own camera at that moment, sampled from its bake, so the move before is Vico's.
  - At 9.2 s the camera is over Kai's right shoulder, close to his head.
  - At 9.6 s it is in the middle of his head as he fades.
  - At 9.9 s it is just in front of his eyes (eye height 1.30 m), looking straight at the desk at 47 in.
  - When the chapter runs longer, the last view holds to the end.

## Applying it

- Director autosave (the desk): `node tools/studio-state/autosave-patch.mjs --autosave exports/director-autosaves/cinematic-intro-cut-vicos-2nd-cut/music --patch docs/music-kai-walk/patch.json --dry-run`
  - Then run it again without `--dry-run`. It copies the folder to `music-backup-<stamp>` first. It patches a copy of the newest entry and writes it as a new `<stamp>-restore.json.gz` through `writeAutosave`. Existing entries are never changed.
  - It refuses if writing would prune old entries, unless you add `--allow-prune`.
  - Vico then opens it with File > Autosaves... > Restore.
  - It refuses when the chapter has no `peopleEdits`, or when 'kai-gets-up' is not `people-kai-walk` at [-1079, 1348] (within 3 cm).
- A film cut or shot file, always written to a new file: `node tools/studio-state/autosave-patch.mjs --film-cut <review-cut.json | director-film/music.json> --patch docs/music-kai-walk/patch.json --out <new file>`
