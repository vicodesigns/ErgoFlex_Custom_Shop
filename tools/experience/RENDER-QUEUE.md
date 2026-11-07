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
* **scope film**: `job.cut` is the whole review cut (identical to `hq14/review-cut.json` in the manifest). Render every chapter,
  then assemble with `finish-intro.py` as for HQ14 (`edl.json`, `titles-src.json`, `score/` are in the manifest).

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
