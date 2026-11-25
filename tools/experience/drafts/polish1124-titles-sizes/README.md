# polish1124-titles-sizes: Vico's type sizes from before the 2026-11-24 ~21:50 rewrite (DRAFT, NOT applied)

`restore-sizes.py` is a field-by-field three-way merge (before the rewrite / right after it / now). It puts back size, letter
spacing and line offsets; it keeps today's words, timing, positions he set since, the auto shadow, align and the new text options.
Dry run by default; writes only to a new `--out` file. `titles-src.restored-sizes.DRAFT.json` was made from
`origin/director/checkpoint-1125` (titles-src.json of 2026-11-25 13:34); against that file only `typography` changes.
Run it again against the live file before using a result.

Note: the new words were already in the pre-rewrite backup (they arrived with the Director imports that evening, before 21:50).
The rewrite itself only touched capitals / punctuation in a few lines, which this keeps as they are today.

## Dry run (old = before the rewrite, now = current; every title)

```
awaken #1  "Meet the workstation / that moves with you."
  eyebrow size       old 45                         now 42                         -> restore
  eyebrow spacing    old 4.2                        now 3.2                        -> restore
  eyebrow dy         old 18                         now 16                         -> restore
  headline size      old 88                         now film default               -> restore
  headline spacing   old 1.1                        now film default               -> restore
  headline dy        old 3                          now film default               -> restore
  supporting size    old film default               now 44                         -> restore
  supporting spacing old 0.9                        now 1                          -> restore
  supporting dy      old -17                        now -16                        -> restore
  fit with the old type: outside the 5 % safe area (letters x 75-765, y 495-736) (right-most letter x = 765; now 835; now: outside the 5 % safe area (letters x 75-835, y 497-737))
awaken #2  "Make room for what’s next."
  eyebrow size       old 34                         now 42                         -> restore
  eyebrow spacing    old 4.2                        now 3.2                        -> restore
  eyebrow dy         old 13                         now 16                         -> restore
  headline size      old 85                         now film default               -> restore
  headline spacing   old 0.1                        now film default               -> restore
  supporting size    old 42                         now 44                         -> restore
  supporting spacing old 0.4                        now 1                          -> restore
  supporting dy      old -15                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 840; now 846)
awaken #3  "Groove through your day."
  eyebrow size       old 45                         now 42                         -> restore
  eyebrow spacing    old 4.5                        now 3.2                        -> restore
  eyebrow dy         old 10                         now 16                         -> restore
  headline size      old 87                         now film default               -> restore
  supporting size    old 46                         now 44                         -> restore
  supporting spacing old 1.1                        now 1                          -> restore
  supporting dy      old -9                         now -16                        -> restore
  fit with the old type: fits (right-most letter x = 1765; now 1731)
rise #1  "Your day. Your rhythm."
  eyebrow size       old 56                         now 42                         -> restore
  eyebrow spacing    old 4.2                        now 3.2                        -> restore
  eyebrow dy         old 21                         now 16                         -> restore
  headline size      old 83                         now film default               -> restore
  supporting size    old 49                         now 44                         -> restore
  supporting spacing old 1.3                        now 1                          -> restore
  supporting dy      old -15                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 628; now 646)
create #1  "One surface. Zero friction."
  eyebrow size       old 35                         now 42                         -> restore
  eyebrow spacing    old 3.9                        now 3.2                        -> restore
  eyebrow dy         old 21                         now 16                         -> restore
  headline dy        old -5                         now film default               -> restore
  supporting size    old film default               now 44                         -> restore
  supporting dy      old -27                        now -16                        -> restore
  fit with the old type: outside the 5 % safe area (letters x 81-775, y 716-845) (right-most letter x = 775; now 838; now: outside the 5 % safe area (letters x 81-838, y 706-855))
commons #1  "The only desk that comes to you."
  eyebrow size       old 57                         now 42                         -> restore
  eyebrow spacing    old 2.5                        now 3.2                        -> restore
  eyebrow dy         old 26                         now 16                         -> restore
  headline size      old 88                         now film default               -> restore
  supporting size    old 46                         now 44                         -> restore
  supporting spacing old 1.8                        now 1                          -> restore
  supporting dy      old -22                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 941; now 922)
coast #1  "Ideas become stories."
  eyebrow size       old 53                         now 42                         -> restore
  eyebrow spacing    old 3.1                        now 3.2                        -> restore
  eyebrow dy         old 23                         now 16                         -> restore
  supporting size    old film default               now 44                         -> restore
  supporting spacing old film default               now 1                          -> restore
  supporting dy      old -29                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 747; now 850)
oilers #1  "Room to discover."
  eyebrow size       old 50                         now 42                         -> restore
  eyebrow spacing    old 2.7                        now 3.2                        -> restore
  eyebrow dy         old 27                         now 16                         -> restore
  supporting size    old 46                         now 44                         -> restore
  supporting spacing old 1.3                        now 1                          -> restore
  supporting dy      old -20                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 751; now 716; now: outside the 5 % safe area (letters x 176-716, y 878-1028))
wellness #1  "Movement built / into your day."
  eyebrow size       old 52                         now 42                         -> restore
  supporting size    old 53                         now 44                         -> restore
  supporting spacing old film default               now 1                          -> restore
  supporting dy      old -12                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 655; now 604)
awareness #1  "It senses what’s in the way."
  eyebrow size       old 57                         now 42                         -> restore
  eyebrow spacing    old 3.8                        now 3.2                        -> restore
  eyebrow dy         old 23                         now 16                         -> restore
  supporting spacing old 0.8                        now 1                          -> restore
  supporting dy      old -17                        now -16                        -> restore
  fit with the old type: outside the 5 % safe area (letters x 75-770, y 816-967) (right-most letter x = 770; now 781; now: outside the 5 % safe area (letters x 75-781, y 820-968))
music #1  "Feel the room come alive."
  eyebrow size       old 55                         now 42                         -> restore
  eyebrow spacing    old 2.6                        now 3.2                        -> restore
  eyebrow dy         old 28                         now 16                         -> restore
  supporting size    old 46                         now 44                         -> restore
  supporting spacing old 1.3                        now 1                          -> restore
  supporting dy      old -17                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 1003; now 950)
media #1  "Movie night, upgraded."
  eyebrow size       old 54                         now 42                         -> restore
  eyebrow spacing    old 3                          now 3.2                        -> restore
  eyebrow dy         old 20                         now 16                         -> restore
  supporting size    old film default               now 44                         -> restore
  supporting spacing old 2                          now 1                          -> restore
  supporting dy      old -21                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 918; now 925)
storage #1  "Transform the room on cue."
  eyebrow size       old 63                         now 42                         -> restore
  eyebrow spacing    old 3                          now 3.2                        -> restore
  eyebrow dy         old 20                         now 16                         -> restore
  supporting size    old 46                         now 44                         -> restore
  supporting spacing old 2                          now 1                          -> restore
  supporting dy      old -19                        now -16                        -> restore
  fit with the old type: fits (right-most letter x = 1006; now 914)
hero #1  "Built for every part of your day."
  eyebrow size       old 41                         now 42                         -> restore
  eyebrow spacing    old 3                          now 3.2                        -> restore
  eyebrow dy         old film default               now 16                         -> restore
  supporting size    old 49                         now 44                         -> restore
  supporting spacing old 2                          now 1                          -> restore
  supporting dy      old film default               now -16                        -> restore
  fit with the old type: fits (right-most letter x = 743; now 743)
14 title(s) would change.
```
