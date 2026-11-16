# Daily desk kit at 7.5-22 m in Studio top-down stills: diagnosis

Cases dumped (Studio state rev 3478, harness s30-td flow, scratch script C:/work/kit-diag/dump.cjs, nothing edited):
library apartment 48x30 (plan idx 0), library premium 48x30, workshop apartment 48x30, occmedialab apartment 48x30. Desk id "main" in all.

## Numbers (library apartment 48x30; the other three are identical except world x/z)
Room root: one only (rootCount 1), scale 0.00147 (premium 0.00151). Room NOT built twice. Desk "main" group scale 0.00147.
Two "Groove tabletop . daily materials" groups exist = the kit is placed twice:

1. Original kit, parent chain Scene > "Scene dressing:desktop" (product mount, world scale 0.0016, parent vis=false). local scale 1, pos (-440,1,150) mm, top y 1.14 m. Harmless (hidden mount).
2. Second kit, chain: kit [local 1000, world 1.59883, pos (520,0,-200), sceneAsset=false] > "Desk dressing:desktop" [local 1, world 0.0016] > "Cinematic demonstration desk" desk group [local 1, world 0.00147, pos -1600,0,-594.63] > "Room:library" [local 0.00147] > Scene [1].
   World scale 1.6 instead of 0.0016, so a 13-14 mm-thick kit stands to top y = 22.06 m (Late study variant 28.46 m). That is the 21.9-22.1 m. Kit world pos y 1.108.

Registry entry (E.sceneDesks.records main.objects): id default-desktop-4, saved.label "Small picture frame", saved.transform.s = 1000, p = (520,0,-200), baseScale [1,1,1], obj.scale 1000, obj.userData.dayKit = true.
Workshop, occmedialab, library premium: same id/label/scale/pos. The 7.5 and 9.1 m values are most likely the same mechanism with a different saved scale/transform (not dumped).

## Explanation
Not a kit-measuring bug in placeDailyDeskKit (kit.position (x,1,z) in mm is fine; first kit is correct). The desk's default objects are keyed by INDEX, id = 'default-'+role+'-'+i (experience/scene-desk-objects.mjs line 31, bind(); the label-aware matchingHighschoolDefault is used only for highschool, line 33). The room state for library/apartment is not in the saved studio state; it is created in-session, and slot 4 of the desktop mount was earlier a "Small picture frame" (GLB in metres, baseScale 1000 saved transform s=1000 at 520,0,-200: the exact transform the highschool/house main desk holds for that frame). Later the desktop mount's child order changed (dress loadDeskProp failures are skipped with `catch -> null`, workspace-3d.mjs ~1043; mount rebuilt/rebound, scene-desks.mjs bind ~line 55-91) so the daily kit landed on index 4 and `saved=previous||...` (line 33-34) applied the frame's stored transform (scale 1000, pos 520,0,-200) to the kit via register -> apply(obj, saved.transform) (line 77+). Parent mount is 0.0016, so 1000 x 0.0016 = 1.6.
Room state seen at runtime had 8 default-desktop slots: 0 Laptop, 1 Calculator, 2 Papers, 3 Insulated mug, 4 "Small picture frame" (now the kit), 5 "Teacher desk notes", 6 "Oiler showcase judging", 7 Groove kit - i.e. contents look like highschool's list leaking into library/apartment (I did not find where that copy is made; worth checking why library/apartment, workshop, occmedialab share it).

## Likely fix (not applied)
- scene-desk-objects.mjs line 31-34: in bind(), when previous saved.label differs from the object's name (for all rooms, not just highschool) or obj.userData.dayKit, discard `previous` and use plain(obj); and never apply a saved scale >= ~100 to an object whose baseScale is 1 (dayKit objects).
- Or in the still driver: after prepare(), force kit.scale to 1 / hide objects whose world top > ceiling (s30 already hides them).
Files: experience/scene-desk-objects.mjs (lines 25-35, 77-90), experience/scene-desks.mjs (bind), experience/workspace-3d.mjs dress() (~1022-1075), experience/room-desk-details.mjs placeDailyDeskKit (not at fault).

## GPU observed at end of run
RX 6900 XT: 3D engine utilisation sum ~10.7 percent, dedicated memory ~2.5 GB (browser runs only). Queue watcher: 62 jobs, new=0, idle; C:/work/gpu.lock absent.

## Follow-up (cine/kit-fix): confirmed and fixed narrowly
- The 7.5 and 9.1 m values are the SAME kit at scale 1000 (world 1.6): mesh tops of the kit parts (cover top 4 mm -> 7.5 m, rod top 5 mm -> 9.1 m, pages 22.06 m). The S30 hidden list shows them for library, occmedialab, workshop, gym, gaming and music apartment 48x30 (same slot-4 record).
- Before (base 148f12cc, no S30 workaround): library premium, executive, humboldt, occmedialab apartment and executive, workshop apartment all have main/default-desktop-4 = kit with saved label "Small picture frame", s=1000, top 28.46 m (visible variants 22.06). After: label = kit name, s=1, top 1.14 m. Stills are fully readable after.
- Fix: scene-desk-objects.mjs bind(): for userData.dayKit only, a saved record whose label differs from the kit name or whose scale is >= 100 is ignored (plain(obj) used). Nothing else changes; the stale record stays in the saved state, it is simply not applied (it is replaced in memory by the kit's own record).
- Where highschool-like slots come from: "Teacher desk notes"/"Oiler showcase judging" are only added by institutional-education.mjs mainDeskDetail (education rooms; Oiler only when sceneId==='highschool'), called from workspace-3d.mjs dress() (~line 1064). So the library/apartment desk state was bound while the desktop mount still held a highschool dress (a dress/bind race at room switch: state is keyed by index under the new room key before the new dress lands). Not fixed; the narrow kit guard covers the visible damage, but other index-keyed records can still mis-apply in the same race.
