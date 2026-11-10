# Alternate cut (November 10, 2026)

`review-cut.json` is a second cut of the film, built from Vico's hq14 review cut by
`tools/experience/build-alt-cut.py`. His cut and his Director keys are never written to.

Every chapter here has **his length and his desk moves** (clips, status lights, screens, daypart keys), so any
chapter can replace the same chapter of his cut one for one: titles, score and dissolves stay where they are.
What differs is who is in the room and when, where the camera goes, and a few props. One desk move differs, at his
request: in commons the desk starts centred on the green carpet.

A third cut sits beside this one: `exports/cinematic-intro-20261110-people/`, his cut with the same people and his
own cameras (`--variant people`).

Rebuild after any change to his cut, list the differences, or mix the two:

    python3 tools/experience/build-alt-cut.py exports/cinematic-intro-20261104-hq14/review-cut.json exports/cinematic-intro-20261110-alt/review-cut.json
    python3 tools/experience/build-alt-cut.py exports/cinematic-intro-20261104-hq14/review-cut.json exports/cinematic-intro-20261110-people/review-cut.json --variant people
    python3 tools/experience/pick-chapters.py <his cut> <this cut> --list
    python3 tools/experience/pick-chapters.py <his cut> <this cut> mixed.json --alt create,commons,storage

| Chapter | People | Camera |
| --- | --- | --- |
| awaken (opener) | none | his, unchanged |
| rise (home) | Maya types seated, is on her feet while the desk moves, types standing at midday, sits again in the evening; her chair stays, pushed back while she stands | his, unchanged |
| create (artist studio) | Lin at her easel; after the board tilts into the oil painting, Lin painting on the desk | opens beside Lin instead of through her; his middle; one cut at 19.5 s to Lin at the desk |
| commons (Humboldt) | Mia in the power wheelchair calls the desk from her phone, then works at it; two teammates at the table; students, a white-cane user and a walking-stick user in the hall. The desk starts centred on the green carpet | his route, a little higher over the table; one cut at 12.8 s to Mia's side of the table |
| coast (OCC media lab) | the bays are in use (Maya at the centre bay); the featured suite stays free | his, unchanged |
| oilers (high school) | Kai in his wheelchair at the set-design desk; the class; Noah at the featured desk, seated then standing | his tour to Noah seated; cut at 8.25 s to the desktop rising; cut at 10.7 s to Noah standing, the class behind |
| wellness (gym) | Maya sits, gets up and stretches while the desk rises, then works standing; Priya stretches at the board | his, unchanged |
| awareness | Grace with her walking stick stands where the pylon rose; a warm lamp on her | his; the closing arc aims higher so her head stays in frame |
| music (gaming room) | Kai plays from the sofa, turned to the desk's screen | opens over Kai's shoulder and passes on his right; his front view |
| media (movie night) | Omar watches from his wheelchair, right of the desk | his route; the push goes further in, past Omar's shoulder |
| storage (workshop) | Andre taps the desk app, left of the desk and out of its path; Jo at the bench | opens on Andre's tap, pulls back to his wide; his from there (tracking shot nudged to clear Andre) |
| hero (finale) | none | his, unchanged |

The wheelchair in commons stands 400 mm nearer the table head than in his cut, so Mia is seated in it with her hands
on the keyboard when the desk arrives.

Film fields used (room-people.mjs, experience/stage.mjs): `people: { only, except, place, cast, when, chair }`.
`cast` adds people for one chapter, `when` gives the seconds each is there, `chair` keeps the desk user's chair in
the room while they stand. Camera cuts are `cut: true` keys in `cameraPlan` (camera-spline.mjs).

Not for Director yet: his Director runs on `main`, which has no people, and his import watcher writes whatever
Director exports into the hq14 cut. Opening these chapters in Director needs the branch merged and the watcher
taught to keep the two cuts apart.

Known rough edge: where a person changes pose inside one shot (rise, wellness, and oilers in the cut with people)
the two poses dissolve into each other over about half a second.
