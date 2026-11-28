# Ch 11 Storage: Andre's near hand stays ON the Robo-Pal (branch `director/storage-hand-contact`)

Base `origin/video/cinematic-intro-hq` 499a58ef9 (storage stores = b2f57a3c restore + 2524eec7 vanish fix). 3rd cut only.
**NOT VISUALLY VERIFIED: do not merge before the still strip below is looked at.**

## Why H2 (3f33f101/4c8e7713) let the near hand leave
- The near hand in the film camera is Andre's LEFT hand (the robot is skinned to his right hand, the far one).
- The fallback's left palm is ON the robot from 1.0 to 2.2 s (palm skin 0-2.6 mm from the robot surface, partly 1-7 mm
  inside) and 35 mm off at 0-0.8 s (his fingers do the adjusting), leaving again from 2.3 s for the release (headless, 30 fps).
- H2's solver was free to turn upperarm_l / lowerarm_l / hand_l, and its "contact" term was the nearest vertex of the
  WHOLE hand (palm + all fingers). Pulling the palm out of the robot satisfied the penetration term, and a single thumb
  tip within 2.5 mm satisfied "contact", so the palm hovered 3-22 mm below the robot (H2's own log: nearest left skin
  2.7-22 mm through the lift). That is what film 2 shows from 0.85 s to 2.1 s.

## This pass
- Only finger curls (index/middle/ring/pinky, one bend per finger, all three joints) and thumb bases + thumb bend turn.
  Limits: finger curls 25 deg or less, thumb base 20 deg or less. Never the upper arm, forearm or hand, so **both palms are exactly where the
  fallback holds the robot** (palm contact unchanged by construction).
- A finger that touched or was inside the robot at a key is kept touching (its nearest skin 3 mm or less from the surface);
  the rest stay at least 0.5 mm outside. Palm skin may still overlap the robot (allowed: up to the fallback's 6-10 mm).
- Keys every 0.1 s on the three robot postures; the 1.0 and 2.0 s keys equal the last key before the swap; the shelf's
  last turns are carried into `andre-lets-go` at 2.548 s and eased out by 3.22 s. The 1.983 s solve went onto the existing
  1.967 s key (keys nearer than 1/60 s merge in the Director; H2 had such a pair).
- Same people block in `director-film/storage.json`, the `review-cut.json` storage shot and
  `director-camera-storage.json` (re-synced: it held the stale pre-restore people again).
- Tools: `docs/handoff/storage-robot-jitter/tune-hands.mjs --fingers-only` (per-finger contact, turn limits),
  `robot-motion-headless.mjs` (now also reports palm-to-robot distance per frame), `merge_keys.py`.

## Headless numbers
(filled in below)

## Still strip to look at before merging (GPU)
Preconditions: watcher.log last line `queue: N jobs, ... new=0`, `C:\work\gpu.lock` absent, `mkdir C:/Users/Vico/polish-wt/_stills-render.lock`.
```
cd C:/Users/Vico/polish-wt/storage-robot-jitter      # branch director/storage-hand-contact
python -c "import json;d=json.load(open('exports/cinematic-intro-cut-vicos-3rd-cut/review-cut.json',encoding='utf8'));json.dump({'name':'hc','shots':[d['shots'][10]]},open('scratch-hc-cut.json','w'))"
node tools/experience/render-server.cjs 3017 &
for f in 0.00375 0.01875 0.03187 0.03750 0.04499 0.05624 0.06749 0.07499 0.07874 0.08999 0.09749 0.11249; do
  node tools/experience/render-still.cjs --cut scratch-hc-cut.json --shots 0 --at $f --size 3840x2160 --ss 1 --out scratch-hc-stills/$f
done   # = 0.10 0.50 0.85 1.00 1.20 1.50 1.80 2.00 2.10 2.40 2.60 3.00 s
# compare with film 2 (F:\ErgoFlex_Render\queue\req-20261128T121225\renders\storage\11.mkv, the H2 keys) and the
# fallback frames in scratchpad\film2\storage-old-vs-new.png, same crop as that strip
rmdir C:/Users/Vico/polish-wt/_stills-render.lock
```
