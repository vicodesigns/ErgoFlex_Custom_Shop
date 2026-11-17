# Per-person posture corrections: implementation and verification

Implemented the approved M1–M3 scope. M4 (timed exercise sequences in other rooms) remains separate. Windows Chrome acceptance and pixel diffs are **pending**; Node transform equivalence is not pixel proof. No render epoch change or render captures were made.

## Storage contract

A cast entry retains its stable key and model/placement fields. `postures[exactModelId]` holds `{pose, poseKeys}`. Sitting, standing, and workout models use the same store and chapter-second clock. Height variants never inherit each other's correction automatically. Missing assets and unknown posture metadata remain archived.

`postureRecord()` exposes legacy entry-level corrections without modifying the input. `migratePostures()` copies them, with their full numeric precision, into the entry model's record. Explicit record fields win over legacy fields; migration fills only missing fields. Migration is idempotent. An empty canonical record clears a correction. `null` explicitly overrides a legacy field in mixed-format input.

Reads do not dirty the cut. Editor transactions and Export cut produce the canonical store. Import validation rejects malformed keys while preserving valid key values, quaternion signs, times, and array order. Evaluation and navigation find chronological neighbours without rewriting stored order. Newly authored keys continue to use the existing key-writing helpers.

Pose storage does not choose models. `deskFamily()`, desk-height selection, reach, placement, and membership order retain their existing behavior, including the empty family for Maya's `stand-type-41` model.

## Room-owned people

`RoomPeople.editKeyOf()` provides editing identity separately from rendering's `keyOf()`. The existing unique featured-desk actor links a room-owned sitting model to the film's cast entry, as in Rise. Ambiguous matches are not inferred. Free placements such as `maya-waits` remain separate scripted placements.

An optional `poseBindings: [{key, id, station?}]` records exact room placements owned by a cast entry. A room-only person uses a stable editor entry with `poseSource: {key, id, station?}`. This entry stores corrections and **does not instantiate a model**. Additional room desk postures can bind to that same owner; generated variants follow their source's editing identity. No `only` entries are removed or expanded for pose editing.

`resolved({editable:true})` opts into this projection. Existing `resolved()` callers keep the previous placement keys and Studio behavior. The room-only editor exposes fine-tuning; changing room membership stays with the room's controls. Saved poses for another posture cannot recast a room-only source accidentally.

## Editor and animation behavior

- Pose mode reads/writes the displayed model's record without rewriting `entry.id` or deleting another record.
- Scrubbing rebinds skeleton tools and keys. An unfinished drag is cancelled across a posture switch.
- One character timeline row contains posture-labelled keys and expandable posture/joint rows. Key IDs and operations include exact model identity, so simultaneous sitting/standing keys are independent.
- Keys interpolate within their own record in chapter time. Missing joints use the record's static correction, then identity.
- Migrated single-store cuts keep legacy transition behavior. With multiple records, sit/stand corrections blend using the existing solver's core progress, after solving motion. Endpoints are exact; missing correction channels blend against identity.
- Existing workout models use the same correction path after `solveWorkout`/`solveStill`, through `drawPose`. Solvers, equipment, props, and assets were not rebuilt.
- Undo/removing a room-only store restores an uncorrected skeleton even when no live motion solver redraws it.

## Verification completed

17 Node test files passed: the two cut/export compatibility suites plus 15 affected people suites, including all `people-*-test.mjs`, `room-people*-test.mjs`, and `studio-people-sync-test.mjs` files present at implementation time.

New coverage:

- `tests/people-postures-test.mjs`: exact legacy/mixed-format migration, room bindings and grouping, metadata-only entries, room-only undo, independent timeline edits, JS/Python serialization parity, and all six existing workout types at three times each.
- `tests/people-postures-editor-test.mjs`: actual People/Pose controllers with real skeletons and a minimal DOM adapter; seated Maya selection, read-only Pose entry, static and keyed edits, saved poses, auto-key, scrub rebind, and undo/redo. This is not a browser layout test.
- `tests/people-postures-harness.mjs` and `tests/fixtures/people-postures-*.json`: scratch-derived Rise and Wellness inputs and pre-change placement/bone-transform hashes. Baseline runtime source: commit `a8800cd968b1299493abac70a2236cc11b12a1d6`. Samples: 0, 3.4, 4, 5.2, 6, 7.6, 8, 9.45, 10.2, 11.1, 12.65, and 16.6 seconds. Both legacy and migrated chapters match, including hidden models, actor member order, and visible model selection.

Run the new focused checks:

```sh
node tests/people-postures-test.mjs
node tests/people-postures-editor-test.mjs
```

Existing Windows People edit/sheet tests were updated for canonical records and model-qualified key IDs. A new `tests/director-people-postures-e2e.mjs` exercises seated Maya's dots and keys, standing correction preservation, scrub, undo/redo, export, reload, and re-import. It refuses to launch on Linux and produces no screenshots or renders. It has been syntax-checked, not executed.

## Remaining acceptance

1. Coordinate the shared editor-file merge with `org`. No matching session was exposed through the available session tools, so no notification was sent.
2. Run the new Windows acceptance test through `3dmodeling`, using an isolated test state and the current cut's chapter pages. Example from the repository on Windows PowerShell:

   ```powershell
   $env:CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
   $env:POSTURE_CUT = 'exports/cinematic-intro-cut-vicos-2nd-cut'
   node tests/director-people-postures-e2e.mjs
   ```

3. Vico manually checks typing and transitions in Rise, and workout fine-tuning in the gym.
4. After Vico authorizes captures, compare matching Windows baseline/candidate frames for Rise and Wellness. Keep state, assets, frame times, camera, and rendering settings fixed. Do not bump the epoch automatically if a diff appears.

Frozen `film-fx.mjs`, `film-edits.mjs`, `film-status.mjs`, production chapter data, Vico's original cut, queue/state files, and the render epoch were not edited by this implementation. Existing unrelated local modifications remain untouched. No commits or deployment were performed.
