# High school room: the layout Vico approved (Nov 13 2026)

Vico's own screenshots from his phone (Studio, High school, First bell), which he called "the correct layout" and "perfect
screenshots for the engineers to match": two desks at the back, three along the window on the left, one on the right,
the demonstration desk in front of the teacher, the class in the centre.

| Desk | Room position (x, z mm) | Yaw | Height (in) | Tilt | Size | Who (First bell) |
|---|---|---|---|---|---|---|
| main (featured desk, window, teacher's end) | -3749, -2045 | 0 | 43.5 | 2.6 | 60x30 | nobody at First bell |
| station-window-research (black nook, window) | -4300, 1000 | 0 | 28 | 0 | 48x30 | Mia |
| station-accessible-student (white, window) | -4300, 3800 | 0 | 28 | 0 | 48x30 | Kai, wheelchair |
| station-demonstration-desk (in front of the teacher) | 0, -2600 | 0 | 43.5 | 25.9 | 60x30 | - |
| station-student-standing (right wall) | 4300, 1000 | 0 | 41 | 0 | 48x30 | Zoe |
| station-project-review (back, white, drafting tilt) | -1000, 6700 | 0 | 43.5 | 25 | 60x30 | - |
| station-research-desk (back, black) | 1500, 6600 | 0 | 28 | 0 | 60x30 | Noah |

These are the stations' own positions in `institutional-education.mjs` (house layout) plus the featured desk where Vico
placed it. On Nov 12 a Storage Mode routine had parked and folded all seven and was saved without its Return; on Nov 13
the Return was written into the shared Studio state (`ergoflex.sceneDesksBySizeV2`, entry `highschool/house`) and the
brown bookshelf under the Oilers banner was removed (`ergoflex.sceneAssets.v1`, `removed`).

Open point from the same message: the wall behind the class (seen from the teacher, picture 1) is a blank cream wall and
needs a proper design that fits the room.
