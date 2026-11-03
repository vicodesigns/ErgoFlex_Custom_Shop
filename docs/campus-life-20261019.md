# Humboldt, OCC and HBHS activity detail

This pass adds furniture-local work in progress and refines light around occupied
areas. The starting review rendered all five activities in each of the three
settings. Existing school identities, saved Product builds, desk positions,
automatic stow and daily movement routines retain their owners.

## Humboldt-inspired commons

Three bronze task bars sit on the two rear study tables and the inclusive group
table. Two have local lights; all three have soft pools attached to their tables.
They are subtle in daylight, warm for evening reading, nearly off at closing and
more neutral for the workshop. The group table's right-hand ErgoFlex approach
stays clear. A café table carries a field journal, research annotations, reading
notes or workshop map; the journal closes for the night.

## OCC Multimedia Art Lab

The review table uses a matte pale-ash surface and five different working kits:

- Pre-production: illustrated call sheets, notebook and clapper slate.
- Edit & create: rough-cut notes, headphones and a portable drive.
- Sound & colour: cue sheet, audio interface, headphones and reference swatches.
- Screening: individual feedback sheets and pencils.
- Portfolio critique: student sheets and coloured feedback notes.

The production wall board advances through planning, rough cut, finishing,
screening and critique. Print proofs fit the available front-left counter area;
equipment cases have ribs, latches and inventory tape. Screening dims the capture
softboxes and workstation illumination so the projection takes priority. The
recording sign glows most strongly during Sound & colour.

## HBHS classroom

Nine student tables now have independent activity kits. First bell has notebooks
and prediction sheets; Wave Lab has spring-wave experiments, rulers and plotted
observations; after-school work occupies alternate tables. Lesson planning clears
the student tops except for a collected notebook stack, and the showcase adds
project sheets and small awards. The violin's place is reserved. Matte HPL and
softer afternoon light retain detail on the white work surfaces; dusk is warmer
without colouring every surface orange.

## Editing and resources

`campus-lived-in.mjs` creates stable, selectable groups under their furniture.
Deleting or moving their support carries the details with it. Activity switching
only changes the child variant; it does not unhide a deleted wrapper. Papers use
one shared atlas per room, solid parts are merged and the pass adds no shadow maps.
It places nothing on ErgoFlex desktops or in circulation paths.

`tests/campus-lived-in-test.cjs` checks all three settings, both desk widths,
five activities, build retention, furniture attachment and hidden-state retention.
It renders activity overviews and close views to
`/tmp/ergoflex-campus-life-20261019` in an isolated browser.
