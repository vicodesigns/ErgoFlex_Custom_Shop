# Vicos 4th cut: film-audit polish (branch `film/4th-cut`, from dd78e005)

A duplicate of **Vicos 3rd cut** (`exports/cinematic-intro-cut-vicos-4th-cut`, made with `film-cuts.py duplicate`). Only `titles-src.json` and `finish-intro.py` differ. Cameras, timing, desks, people, score data are the 3rd cut's. NOT merged into `video/cinematic-intro-hq`; Vico decides. Source of the list: Gemini's film audit in `~/Manifest-Share/film-audit-20261127/` (Stage 1 reports). Checked against the real data and contact sheets before applying.

## Changes (all in `exports/cinematic-intro-cut-vicos-4th-cut/titles-src.json`)
| Card | Change | Why |
|---|---|---|
| Rise, Create, Commons, Oilers, Storage | eyebrow colour `#6cbcff` (lighter blue; others keep `#1388ec`); fitted box opacity 0.5 (Oilers 0.55, default 0.31) | blue eyebrow fades on bright wood/floor (Oilers contact sheet confirms) |
| Oilers | card up: position y 995 -> 935 (of 1080) | it sat on the bottom edge |
| Rise | scale 0.90 -> 1.0 | scale drift (Awaken 1.12, Awareness 0.99, Hero 0.82) |
| Hero | scale 0.82 -> 1.0 | headline/detail too small |
| Awaken card 2 | `TILT. LIFT. ROLL.` / `One desk. Every position.` / `Sit, stand, tilt and glide, all in one motion.` | old copy was generic |
| Create | headline `One surface. Zero friction.` | inconsistent Title Case |
| Commons | detail `Reaches out. Adjusts to you. Works for everyone.` | was jargon |
| Oilers | detail `Every learner. Every lesson. Every angle.` | repeats "designed" and Commons' message |
| Storage | detail `Save a setup. Replay it with one tap.` | `&` in the old line |
| End card | `cta.sub = {text: "ergoflexdesk.com", size 30, gap 6, delay 0.5}` | the end card had no destination |

`tools/experience/finish-intro.py`: new optional `cta.sub` (a small line under the CTA, only in the `gap` layout the hero uses; absent = byte for byte as before). The Director's end-card editor does not show it; the film does.

## Left alone on purpose
- Everything that moves picture or music: Chapter 1 dwell trim, black pre-rolls (Ch 8, 9), seam lengths, Ch 4 / 11 trims, moving Ch 11 earlier (EDL/score are Vico's).
- Wellness card (readable in the contact sheet), Music cyan-on-cyan eyebrow, Coast, Awareness (need a still at the title time before moving).
- Oilers camera push-in / bridging shot (Director camera work; the Kai glance and typing it would follow now exist, commit 44f8badc).
- Many cards are Vico's hand edits (`director_timing`, custom sizes, custom shadow paths in Create and Storage). The scale and position changes above are the first thing to revert if he prefers his own.

## To check (Windows, stills only, no film render needed)
`python tools/experience/finish-intro.py <cut dir> --title-still <chapter>:<s> --bg <frame.png> --out out.png [--with-logo] [--draft]` over a frame from an existing chapter render, 3rd cut titles vs 4th cut titles, for: rise 3.6-9.4 s, create 3.6-9.2, commons 3.4-8.65, oilers 9.4-13.2, storage 8.55-14.75, hero 5.2-9.6, and the end card (`hero:25.5 --with-logo`: check the address line sits clear of the CTA and the wordmark). Adjust `cta.sub.gap` / `size` if it collides.
Before a render request for this cut: `python3 tools/experience/build-cine-score.py exports/cinematic-intro-cut-vicos-4th-cut`.
