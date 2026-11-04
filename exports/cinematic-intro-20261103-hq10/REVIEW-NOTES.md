# Intro refinement HQ10: Vico's HQ9 notes (round 5)

Baseline: HQ9. Earlier HQ folders untouched. 12 chapters, 3:09.5 (189.5 s), **2560×1440**.
Brief (Vico's words): `/home/ergo/logs/video_round5_brief_2026-11-03.md`. Expert docs (all Opus 5.5, in /home/ergo/logs):
`copy_commons_round5_2026-11-03.md`, `cinematography_opener_round5_2026-11-03.md`, `cinematography_finale_round5_2026-11-03.md`.
Rendered under Polish's memory gate (`renders-new/render-queue-1440.sh`); chapter renders live in `renders-new/1440/<id>/`.

| ch | id | change | builder |
|---|---|---|---|
| 1 | awaken | 41 s (was 34). The safety chapter's status lighting is folded in: asleep 0-11 (clean look), blue lift 11.0-16.6, purple tilt down 17.4-21.0, yellow-green tilt back 21.8-25.4, 90° right turn (mode 6) 26-31, red roll 31-34.4, clean hero to 41. Turn slowed (peak 27°/s vs ~108°/s for HQ9's 360). One camera, no reversals; the desk fills ~0.7-0.8 of frame height from the turn on. "Meet your digital twin" removed; "SAFETY / Safe for everyone around it." at 12.4-18.8. Monitor shows a static wordmark. | build-opener.py |
| 3 | create | tilts are purple again: steepening is tilt DOWN on the real desk (Vico); colour now derived from clip direction | build-round4-lighting.py |
| 4 | commons | sub "Same table. Same project. Same team."; the last move drives forward only (35 in) to the head of the table, square to the wheelchair, 6 in clear of the table (HQ9 slid sideways into it and the app latched the red collision light); red glide light for the whole move; wheelchair moved 0.7 u back; end camera aimed to keep the wheelchair in frame | build-round5-commons.py |
| - | status | chapter cut; EDL re-timed (coast > oilers takes the 1.5 s dissolve) | build-round5-edl.py |
| 12 | hero | v3: one orbit that never reverses (peak 5.5°/s vs 7.8), desk 0.74-0.85 of frame height mid-chapter, HBHS rests at 10°, office reaches standing before its blend, end-card framing; end card "Let's build yours." | build-finale.py v3 |
| all | | score re-synthesized from the new EDL; the desk's wheel sound under the opener's turn and roll and ch 8's roll to the pylon | build-round5-audio.py |

## Owner choices (do not reverse)
Keep the powered wheelchair (ch 4, 11). Ch 3 stays a drafting design below 50°. LED strips match screens left/right as seen.
Tilt angle increasing = purple, back toward flat = yellow-green; lift up blue, lift down red; red while gliding.
"A place for everyone." and "Let's build yours." are Vico's. No fades inside a chapter's movement sequence.
