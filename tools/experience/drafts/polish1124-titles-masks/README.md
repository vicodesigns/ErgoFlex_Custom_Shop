# polish1124-titles: Vico's hand-made title shadow masks (DRAFT, nothing applied)

What happened: between `titles-src.pre-typography-polish-20261124-2150.json` (still has the masks) and
`titles-src.pre-director-awaken-20261124-215457.json` (none) a rewrite of `titles-src.json` dropped `shadow` from the 8 titles that
had a hand-edited mask and, in the same step, replaced every title's typography with one uniform set. The Director import
(`build-round8-director.py --import`) did not do it (the 12 director-import exports carry no filmTitles).

`restore-masks.py` (dry run by default; never edits in place) puts the masks back on the CURRENT layout, keeping each hand edit as its
difference from the auto box. `titles-src.restored-masks.DRAFT.json` is its output against the 2026-11-24 23:01 copy of the cut
(the newest file with the new copy); run it again against the live file for a current result:

    python tools/experience/drafts/polish1124-titles-masks/restore-masks.py       --old <cut>/titles-src.pre-typography-polish-20261124-2150.json --current <cut>/titles-src.json --out <new file>

Recoverable: rise, create, commons, coast, oilers, wellness, music, storage (3 quads each: eyebrow, headline, supporting text).
Not recoverable (never had a mask): awaken x3, awareness, media, hero. 'Reset to fitted' in the Director gives auto back per title.

## Typography before -> after the 21:50 rewrite (ask Vico whether the uniform set was intended; NOT restored here)

| title | eyebrow | headline | supporting text | |
|---|---|---|---|---|
| awaken | size45 spacing4.2 dy18 -> size42 spacing3.2 dy16 | size88 spacing1.1 dy3 -> film default | spacing0.9 dy-17 -> size44 spacing1 dy-16 |  |
| awaken | size34 spacing4.2 dy13 -> size42 spacing3.2 dy16 | size85 spacing0.1 -> film default | size42 spacing0.4 dy-15 -> size44 spacing1 dy-16 |  |
| awaken | size45 spacing4.5 dy10 -> size42 spacing3.2 dy16 | size87 -> film default | size46 spacing1.1 dy-9 -> size44 spacing1 dy-16 |  |
| rise | size56 spacing4.2 dy21 -> size42 spacing3.2 dy16 | size83 -> film default | size49 spacing1.3 dy-15 -> size44 spacing1 dy-16 | had a hand mask |
| create | size35 spacing3.9 dy21 -> size42 spacing3.2 dy16 | dy-5 -> film default | spacing1 dy-27 -> size44 spacing1 dy-16 | had a hand mask |
| commons | size57 spacing2.5 dy26 -> size42 spacing3.2 dy16 | size88 -> film default | size46 spacing1.8 dy-22 -> size44 spacing1 dy-16 | had a hand mask |
| coast | size53 spacing3.1 dy23 -> size42 spacing3.2 dy16 | film default -> film default | dy-29 -> size44 spacing1 dy-16 | had a hand mask |
| oilers | size50 spacing2.7 dy27 -> size42 spacing3.2 dy16 | film default -> film default | size46 spacing1.3 dy-20 -> size44 spacing1 dy-16 | had a hand mask |
| wellness | size52 spacing3.2 dy16 -> size42 spacing3.2 dy16 | film default -> film default | size53 dy-12 -> size44 spacing1 dy-16 | had a hand mask |
| awareness | size57 spacing3.8 dy23 -> size42 spacing3.2 dy16 | film default -> film default | size44 spacing0.8 dy-17 -> size44 spacing1 dy-16 |  |
| music | size55 spacing2.6 dy28 -> size42 spacing3.2 dy16 | film default -> film default | size46 spacing1.3 dy-17 -> size44 spacing1 dy-16 | had a hand mask |
| media | size54 spacing3 dy20 -> size42 spacing3.2 dy16 | film default -> film default | spacing2 dy-21 -> size44 spacing1 dy-16 |  |
| storage | size63 spacing3 dy20 -> size42 spacing3.2 dy16 | film default -> film default | size46 spacing2 dy-19 -> size44 spacing1 dy-16 | had a hand mask |
| hero | size41 spacing3 -> size42 spacing3.2 dy16 | film default -> film default | size49 spacing2 -> size44 spacing1 dy-16 |  |
