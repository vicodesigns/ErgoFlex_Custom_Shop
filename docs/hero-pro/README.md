# Chapter 12 Hero: cinematography, desk-motion and lighting pass on Vico's snappier cut (21 Nov 2026)

Base: Vico's seated 3rd cut with his 16:01 hero edit (`origin/cut/vicos-3rd-hero-snappier-20261121`, f1a64445; his export
`director-exports/export-87fca1fa8a1b-Film-chapter-hero-38-22-s-__2_.json`). Vico: the hero is close but raw (angles, camera
movement, desk movement) and the lighting was not adjusted to his new timing; +/-5 s leeway.

Nothing under `exports/` is changed on this branch. The patch is one importer doc plus one small importer fix:

| what | file |
| --- | --- |
| importer doc (seated cut, `exports/cinematic-intro-cut-vicos-3rd-cut`) | `hero-pro-seated-export.json` |
| importer fix: a hero lighting import reaches the rendered sub-shots | `tools/experience/build-round8-director.py` (`apply_lighting`, 12 lines) |

    python3 tools/experience/build-round8-director.py exports/cinematic-intro-cut-vicos-3rd-cut --import docs/hero-pro/hero-pro-seated-export.json
    python3 tools/experience/build-round8-director.py exports/cinematic-intro-cut-vicos-3rd-cut

The doc is Vico's latest hero export with only these fields changed (`tools/mkdocs-hero.mjs`):
`shots[0].seconds` 23.5 -> 25.5, `shots[0].camera.keys` (36 story keys, `hero-pro-camera-plan.json`), `shots[0].deskVersions`
(H ends at 25.5; his export said 38.22), `shots[0].motion.clips[g-tilt].path` (flat), `shots[0].lights` (new; `hero-pro-lights.json`),
`updated`. Desk versions, their seams, every other desk move, the start pose, props and titles are his.

## Length (exact)

| | chapter | A gaming | B artist | C architect | D office | H gaming | joined sub-shots |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (Vico 16:01, as committed) | 23.5 s | 0-3.53 | 2.93-8.97 | 8.37-13.79 | 13.19-18.71 | 16.71-23.5 | 23.5 s (render 23.533) |
| after | **25.5 s** (+2.0) | 0-3.53 | 2.93-8.97 | 8.37-13.79 | 13.19-18.71 | **16.71-25.5** | 25.5 s |

Dissolves between sub-shots unchanged: 0.6, 0.6, 0.6 and 2.0 s (centres 3.23, 8.67, 13.49, 17.71 s). The storage -> hero
dissolve (1.5 s, edl) is untouched.

For org (not done here, outside the import): edl / score rebuild for 25.5 s (hero 214.828-240.328 in the film, total 240.328),
and the end card in `titles-src.json`: **logo.rel_in 19.87, cta.rel_in 21.29** (today 32.26 / 33.68, left over from the
38.22 s hero: both lie past the 23.5 s chapter, so the edl's end-card beat 247.088 is after the film's end 238.328 and the
score's logo hit has nothing to land on). 19.87 s is 0.35 s after the desk comes to rest and on the hero's bar 9 at the
cue sheet's 113 BPM grid (bar 0 = the storage dissolve centre, 0.75 s); the camera is still settling under the 1.4 s fade-in
and comes to rest at ~23 s; 5.63 s of end card before the cut (the 38.22 s hero had 5.96 s).

Latent bug fixed by the doc: re-running the pass on the committed cut (no import) sets H's renderRange to [16.71, 38.22]
(from Vico's export's deskVersions), i.e. a 38 s joined hero; `verify/import-seated.log` vs the control.

## Checked

- Importer on scratch copies outside the repo (`C:\work\hero4\cut-*`): control = the pass alone; imported = doc + pass.
  `verify/verify-seated.txt`: only `director-camera-hero.json`, `review-cut.json` (hero only; the other 11 chapters
  unchanged) and `shots/13-subshots.json` (each sub-shot: camera, cameraPlan, lights, motion, seconds; H renderRange) differ;
  titles-src and every other file byte-identical; the rendered after-cut equals the imported sub-shots field by field.
  `verify/patched-vs-unpatched-importer.txt`: with today's importer the same doc gives the same data except the sub-shots'
  `lights` (they stay Vico's: the rig would only land in review-cut, which the film does not render for chapter 12).
- Renders through the real path (render-cut.cjs --quality hq13 --storage finale-seed, the 5 sub-shots, join-subshots.py):
  480p before / v1 / v2 / v3 (= final), 1080p before and final. Sheets every 0.5 s, luma / framing / camera / desk measurements.

Files: `frames/hero4-sheet-0N.jpg` (before | after every 0.5 s, 480p; the before column holds its last frame after 23.5 s),
`frames/hero4-endcard-*.png` (end card composite), `frames/hero4-storage-last-frames.jpg` (storage's last frames, for the
dissolve in), `hero4-camera-motion.png`, `hero4-lighting-luma.png`, `measurements/` (CSV per frame), `work/` (iterations
v1-v3), `tools/` (design, bake analysis, docs, import verification, sheets, luma, framing; the shell paths are the render
PC's: C:\work\hero4, F:\eng-hero2).

See `hero4-rationale.txt` for the shot-by-shot reasoning and the numbers, and what is not verified.
