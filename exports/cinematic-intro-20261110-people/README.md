# Vico's cut with people (November 10, 2026)

`review-cut.json` is Vico's hq14 review cut with people in the rooms, built by
`tools/experience/build-alt-cut.py --variant people`. His cut and his Director keys are never written to.

His cameras, his props, his timing, his desk moves. What is added is the cast of each chapter, and only the changes a
person in the room makes necessary:

| Chapter | People | What else changed |
| --- | --- | --- |
| awaken (opener), hero (finale) | none | nothing |
| rise (home) | Maya types seated, is on her feet while the desk moves, types standing at midday, sits again in the evening; her chair stays | nothing |
| create (artist studio) | Lin paints at her easel, at the canvas's left edge so his opening passes beside her | nothing |
| commons (Humboldt) | (Nov 13 story, `build-commons-story.py`) Yara works standing at the desk as the night runs out; her booking ends at 8:00 (the desk's screen: `screens/04-reservation.mp4`), she takes her bag and walks off; the desk lowers to Mia's 32 in and drives itself to her at the project table, where she waits in her red power wheelchair and types when it arrives; two teammates at the table; the hall | a new bird's-eye opening and swoop (0-6.6 s), his camera from 8.6 s; the drive re-timed (6.8-13.4 s); the wheelchair moved under Mia, facing the desk |
| coast (OCC media lab) | the other bays are in use | nothing |
| oilers (high school) | Kai in his wheelchair at the set-design desk; the class; Noah at the featured desk: seated, on his feet as it rises, typing standing | nothing |
| wellness (gym) | Maya sits, stretches while the desk rises, works standing; Priya at the mobility board | nothing |
| awareness | a Labrador stands where the pylon rose (Vico: a pet or the pylon, not a person) | a warm lamp on the dog; the last two camera keys look a little lower and wider so the dog is whole; the floor rings travel with the desk |
| music (gaming room) | Kai plays from the sofa; his opening looks over Kai's shoulder | nothing |
| media (movie night) | Omar watches from his wheelchair at the right; his closing push leaves him behind | nothing |
| storage (workshop) | Andre with the desk app (he steps in a second after the opening frame), Jo at the bench | the tracking shot at 13.2 s looks a little further right so Andre is not half in it |

Rebuild after any change to his cut, and mix chapters with `tools/experience/pick-chapters.py` (see the alternate
cut's README beside this folder).

`build-commons-story.py` writes the commons chapter in place; run it again after `build-alt-cut.py --variant people`.
