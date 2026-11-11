# A room that grows with its owner

Three specialist agents reviewed child development and spatial layout, interiors/materials, and lighting/activity storytelling. Their feedback informed a growing bedroom with five independent life stages: early years, elementary school, preteen, high school and college. Each stage supports the existing five room sizes and five daily activities.

## Life-stage progression

- Early years: low house bed, picture-book browsing, soft reading nook, reachable choice board, sorting/building invitations, low drawing and shared railway play.
- Elementary: upholstered timber bed, nature/space books, magnifier and globe, homework/craft table, low stool, chapter reading and shared projects.
- Preteen: denim/clay palette, personal prints and project board, camera/sketchbook, study desk with one screen and ergonomic inputs.
- High school: slate/olive textiles, portfolio and music interests, study chair, 60-inch desk with a single display, revision and shared planning scenes.
- College: walnut/petrol/linen palette, coursework, reference books and plant, 60-inch workspace, research, editing and collaborative projects.

Age and room size are separate choices. The Life stage selector appears in the room controls; the fullscreen tour also has an Age button. Stage/size combinations own separate saved arrangements. Stage desk widths and accessories are editable starting recipes; changing widths retains owner additions and finishes.

## Applied review feedback

- Moved the untouched default story rack 300 mm toward the rear. Its actual geometry has approximately 395 mm of browsing approach before the reading cushion. Only exact old defaults migrate; manually moved/rotated/scaled racks remain untouched.
- Compact and house early-years layouts gain a portable low drawing tray during Make & play. Larger rooms use their low table. Desk Grooves use modest inward targets within the work bay.
- Warmer oak contrasts with the pale matte floor. Folded linen curtains, woven textiles, padded quilt folds, piping, crowned pillows, original prints and personal project boards vary across stages.
- Activities change supported objects and their location: morning invitations, afternoon projects, books in the reading nook, clear floors and closed supplies at bedtime, and shared play/project scenes.
- Actual sky gradients change with the phase. The blind closes in evening/night. Reading and moon/practical lights operate independently: the reading lamp is off at bedtime while the low warm practical remains on.
- Study screens default to dark at bedtime; explicit owner screen preferences still take priority. Daytime content has a reading/project theme rather than a generic office dashboard.
- Younger stages begin monitor-free. Preteen and older stages add a study screen and ergonomic inputs; older desk dressing uses the existing original headphones and shared aluminum hook/socket system.

## Verification

`npm run test:environment-finishes` covers all 25 stage/size combinations × five activities (125 states): authored furniture bounds, grounded furniture, train/track contact, rack approach, bounded desk destinations, bedtime clear-floor/light states, low drawing surfaces, finish ownership and preservation of edited rack transforms.

`node tests/scene-desk-data-test.mjs` covers stage recipe persistence, independent width variants, custom accessories/finishes and existing headphone socket revisions. The headphone asset tests also pass.

`node tests/child-screens-test.mjs` checks the bedtime screen default, explicit owner overrides and persistence.

The isolated browser review on port 3017 checks 45 rendered cases: all 25 stage/size combinations plus the remaining house-layout activities for each stage. Selected rendered views and a DOM-derived report are retained with these notes. The owner-facing Studio runs on port 3000.

Checks cover the authored recipes, rather than arbitrary later user arrangements. The early room keeps the real 48-inch desk and its actual motion limits; low drawing furniture serves the child activity zone. These scene recipes are not physical fit prescriptions or safety certifications.
