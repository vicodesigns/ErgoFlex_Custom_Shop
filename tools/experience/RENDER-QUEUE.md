# Render queue: what the render PC ("Win") does

Vico presses **Render preview** in Director (Render tab). Director downloads `Render-request-<chapter|film>-<res>-<stamp>.json`
to `~/Downloads` on the desk (after an Export cut, when the chapter has unexported edits). `tools/experience/render-request.sh`
turns that file into a **job**: it freezes the film's inputs and appends the job to
`exports/render-queue/queue.json`. The desk serves `exports/` and does not watch it, so the queue and the freezes never
reload Vico's tabs. Win cannot write back to the desk; it delivers the MP4 to Vico's phone.

Base URL: `https://ergoflexdesk02.tailf693b8.ts.net` (Tailscale; `:443` is the desk's Custom Shop server, `:3000`). Every path below is
`<base>/<path>`.

## 1. Poll

Every **60 s** `GET <base>/exports/render-queue/queue.json` (`Cache-Control: no-cache`; 404 = nothing queued yet).

```json
{"jobs":[{
  "id": "req-20261107T143012",                 // UTC stamp of the enqueue; ids sort in time order ("-2" suffix if two share a second)
  "created": "2026-11-07T14:30:42Z",           // when the job was queued
  "scope": "chapter",                          // "chapter" | "film"
  "chapter": "rise", "chapterIndex": 1,        // chapter id and its index in review-cut.json (for scope film: the chapter he was in)
  "resolution": "720p", "height": 720,         // 480p | 720p | 1080p | 4K  (480 | 720 | 1080 | 2160)
  "note": "check the lift at 6 s",             // free text from Vico; put it in the caption
  "manifest": "exports/cinematic-intro-20261104-req-20261107T143012-freeze-rev380/manifest.txt",
  "cut": "exports/cinematic-intro-20261104-req-20261107T143012-freeze-rev380/request/cut.json",
  "shots": "0",                                // render-cut.cjs --shots value: "0" (one-shot cut) or "all" (the full review cut)
  "estimateMinutes": 2.9,                      // what Director told Vico
  "chapterKeys": {"awaken": "48155a97…", …},   // chapter id -> cache key (all 12 for scope film, only the chapter for scope chapter); see 3b
  "epoch": "1",                                // render-epoch.txt when the keys were computed (already inside every key)
  "force": false,                              // true = "Re-render every chapter": ignore the cache for this job (still store the renders)
  "warning": "…",                              // only if set: the freeze may lack the export he sent (see 5)
  "status": "queued"
}]}
```

Keep your own **last done id** (a file next to your render folder). Take every job whose `id` is greater than it, oldest first
(string compare works). The file only ever grows; `status` stays `queued` because nothing writes back to it. One job at a time
unless the GPU has room (4K used ~4.7 GB VRAM per process, 3 at once on the RX 6900 XT).

## 2. Fetch the manifest

`GET <base>/<job.manifest>`. Same format as every freeze so far: line 1 is a `#` header; each other line is
`sha256 size path [url-path]`. Fetch `<base>/<url-path>` (default: `path`), write it to `path` inside your clone (overlay on a
clone at `036ccc1` or later, as before), and check sha256 and size. A mismatch means a file changed on the desk after the freeze:
fetch again once, and if it still differs, skip the job and tell Vico's session. `request/cut.json` (the cut) and
`request/request.json` (Vico's original request) are lines of the manifest like any other file. Symlinks were dereferenced.

**Every line has a url-path (since 2026-11-13).** Code and the film's JSON are copied into the freeze's own folder, as before.
Everything else (models, images, sound, clips: about 2.3 GB) is fetched from a store keyed by content,
`exports/render-blobs/<aa>/<sha256><.ext>`, which `freeze-blobs.py` fills at freeze time (a file is copied once; later freezes
find it by its sha). Nothing a manifest lists is read from the live checkout any more, so a merge or a rebuild on the desk
after the freeze cannot fail the sha check. Before this, two 4K film jobs failed every attempt for hours because a merge had
changed four files they listed by path. Nothing changes for the render PC: fetch `<base>/<url-path>`, write to `path`, check.
`python3 tools/experience/freeze-blobs.py prune <repo root> [--days 21]` deletes stored copies no freeze has used for that long
(run by hand; a queued job older than that would lose its files).

## 3. Render

With your existing pipeline, from the clone with the overlay, at the job's resolution:

| resolution | `--size` | notes |
|---|---|---|
| 480p | 854x480 | |
| 720p | 1280x720 | |
| 1080p | 1920x1080 | |
| 4K | 3840x2160 | `--ss 1.5 --blur 4`, as the HQ14t 4K film |

* **scope chapter**: `job.cut` is a one-shot cut (`shots` has one entry, the chapter). Render it with
  `render-cut.cjs --cut <job.cut> --shots 0 --video --size <WxH> --quality hq13 --storage exports/cinematic-intro-20261104-hq14/post/<seed>.json --state-keys ergoflex.sceneAssets.v1`
  (seed: coast `occ-seed`, hero `finale-seed`, every other chapter `college-seed`), then the chapter's usual finishing (grade from
  `grade.json`, titles from `titles-src.json`, its score) to an MP4. Hero keeps its sub-shot handling.
  The number of hero sub-shots is not fixed: `shots/13-subshots.json` lists one per desk version (six in the film as built; the
  Director can add or remove them, 1 to 12). Render every shot of that file (`render-cut.cjs --cut shots/13-subshots.json --shots all`
  writes `01.mkv` .. `NN.mkv`) and join them with `join-subshots.py <that file> <render dir> <out.mkv> --transition fade`, which
  crossfades each overlap for any count (one sub-shot: no crossfade). `join-subshots.py ... --plan` prints the inputs and
  crossfades it expects without rendering. A pipeline that names six files or six windows must read the count from the file.
* **scope film**: `job.cut` is the whole review cut (identical to `hq14/review-cut.json` in the manifest). Render every chapter,
  then assemble with `finish-intro.py` as for HQ14 (`edl.json`, `titles-src.json`, `score/` are in the manifest).

## 3b. Chapter cache (render only what changed)

A chapter's key (`tools/experience/chapter-keys.py`, computed by the desk from the frozen film data at the job's resolution) is a
sha256 over everything that decides its frames: its render shot(s), seed file, media clips, the resolution and `render-epoch.txt`.
Same key = same frames, so an earlier render at that resolution can be reused. Cache dir on the render PC:

    F:\ErgoFlex_Render\cache\<resolution>\<chapter id>-<key>.mkv        e.g.  cache\4K\rise-3efc1943…ac4c.mkv   (the key is the full 64 hex chars)

* **scope film**: for each chapter in `job.chapterKeys` (film order): if `force` is not true and the cache file exists, copy it to
  `renders\NN.mkv` (NN = the chapter's index, `01`..`12`; `finish-intro.py` reads those). Otherwise render it as in 3 and, when it
  succeeded, copy the mkv into the cache (write `<name>.part`, rename when complete) and to `renders\NN.mkv`. Then assemble with
  `finish-intro.py` as before. Put in the caption which chapters were reused and which rendered. Render the missing ones in
  parallel as you do now. A film job with no `chapterKeys` (the desk could not compute them) renders every chapter.
* **scope chapter**: render as in 3, and also store the mkv in the cache under `job.chapterKeys[job.chapter]`. (Chapter jobs
  render the one chapter anyway; a cache hit is a valid shortcut if you want it, but then say so in the caption.)
* A render that failed or was cut short is never cached. Delete a cache file if you doubt it; the next job re-renders that chapter.
* `epoch` in a key changes every key at once: a new epoch = a full re-render, by design. Keys of other resolutions never collide.
* Housekeeping: you may delete cache files not used by the last few jobs when disk is short (about 1 GB per 4K chapter).

**Seeding the cache from the HQ41 4K film.** The 4K chapter mkvs of HQ41 sit in `renders\` on the render PC (`01.mkv`..`12.mkv`).
The desk writes `cache-seed.json` (`{epoch, resolution:"4K", hq41:{chapter:key|null}, current:{…}, unchanged:[…], index:{chapter:NN}}`).
Once, for every chapter whose `hq41` key is not null (and only if `epoch` is the job's epoch): copy `renders\<NN>.mkv` to
`cache\4K\<chapter>-<key>.mkv` with `NN = index[chapter]`. Chapters with a null key changed since HQ41 (or cannot be proven
unchanged) and must be rendered. Do this before the first film job at 4K, and only while `renders\` still holds the HQ41 files.

Do not render from anything outside the manifest: the freeze is the point. Name the MP4 `<job id>-<scope or chapter>-<res>.mp4`.

## 4. Deliver

Send the MP4 to Vico's phone with SendUserFile (**30 MiB cap; stay under 29 MiB**). A chapter at 1080p usually fits; if not, lower the
bitrate (about 1 Mbps for a 208 s 720p film), or split into parts for a film. 4K masters stay on `F:\ErgoFlex_Render` and Vico gets a
1080p or 720p phone copy. Caption: job id, scope and chapter, resolution, his note, render time. Then write the job id to your
last-done file. Failed jobs: tell Vico's session what failed, mark the id done so the queue does not stall, and wait for a new request.

## 5. The desk side

`render-request.sh <request json> [repo root]` waits for the Export cut that came with the request to be imported (the director
watcher backs every export up into `hq14/director-exports/`; the request's `exportSha` is the sha256 of that file) and for the chapter
import lock (`/tmp/claude-1000/hq14-cut.lock`), freezes with `freeze-inputs.sh` and `pin-inputs.py` (the same logic as
the hand-run `freeze.sh` / `pin.py`, parameterised by the repo root; the two file lists they read live in `tools/experience/freeze-lists/`),
and appends the job. If the export never shows up in `director-exports/` within 4 min the job is queued anyway with a `warning`:
the render then lacks his latest edits, so say so in the caption. Tests: `python3 tests/render-request-test.py`.

## 6. Later: a Taildrop return path

Not built yet. When Tailscale file sharing is set up, Win additionally `tailscale file cp <mp4> <desk>:` and the desk side lands it in
`~/ErgoFlex-Renders/` (`tailscale file get --conflict=rename ~/ErgoFlex-Renders` run by a small loop on the desk), named
`<job id>-<scope or chapter>-<res>.mp4`. A later watcher can then set `status` to `done` (with `file`) in `queue.json`, using the
same atomic replace render-request.sh uses, and Director's list can read it. Win's phone delivery in 4 stays as it is.
