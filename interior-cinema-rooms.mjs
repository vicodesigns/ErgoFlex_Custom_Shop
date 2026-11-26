// Interior pass recipes: one per film room and layout (interior-cinema.mjs has the tools and the rules).
// shell(pass, room) runs when the room's shell is built; furnished(pass, room) once its props and life are in.
// steps: what the recipe does, in words (root.userData.interiorPass.steps, docs/interior-pass.md).
// Sizes are room millimetres as the room's builder lays it out: x0/x1 the left and right wall, back/front in z, h the
// ceiling. Levels are [morning, afternoon, evening, night, party]. Windows are the builders' own openings plus the
// casing, so the shade stops at the frame.
//
// Reading the numbers: a wall shade of .3 at the top takes the wall from its lit value to 70 % of it at the ceiling
// line, eased down over most of the wall's height; corners the same toward the room's corners; flat is an even shade
// for a wall that stands against the light (the window wall). A wash level of .2 adds a fifth of full white at its
// brightest point.

const COOL = '#131c2c', WARM = '#19140f';

export const INTERIOR_RECIPES = {
    // Chapter 2, rise: home office, 3.6 x 4.2 m. Window in the back wall, entry wall left, storage and art wall right.
    'home/house': {
        steps: ['envelope: the window wall stands against the light, side walls shade toward the ceiling and the far corners, floor falls off under the walls',
            'washes: window light spreading along both side walls from the window end (day and evening)'],
        shell(pass) {
            const { back, h } = pass;
            pass.envelope({ tint: WARM, cornerWidth: 1500,
                walls: { back: { flat: .12, top: .22, corners: [.12, .12], holes: [[-1565, 225, 805, 2295]] }, left: { top: .3, corners: [.1, .24] }, right: { top: .3, corners: [.24, .1] } },
                floor: { back: .12, left: .24, right: .24, width: 1300 } });
            for (const side of ['left', 'right']) pass.wash({ name: 'window light along the ' + side + ' wall', side, kind: 'rake', from: back, to: back + 3100, bottom: 250, top: h - 150, color: '#ffe6c2', levels: [.2, .15, .28, 0, 0] });
        }
    },
    // Chapter 3, create: artist atelier, 5.2 x 5.8 m. Daylight wall left, brick gallery wall at the back, materials wall right.
    'creative/premium': {
        steps: ['envelope: the brick wall shades toward the ceiling and the materials corner, the daylight wall stands against the light, floor falls off under the back and right walls',
            'washes: the three gallery track heads land on the brick as scallops (low by day, up in the evening)'],
        shell(pass) {
            pass.envelope({ tint: WARM, offset: 60, cornerWidth: 1900,
                walls: { back: { top: .3, corners: [.08, .26] }, left: { flat: .14, top: .22, corners: [.2, .1], holes: [[-645, 1445, 775, 2395]] }, right: { top: .28, corners: [.14, .26] } },
                floor: { back: .2, left: 0, right: .22, width: 1500 } });
            for (const x of [-2160, 0, 2160]) pass.wash({ name: 'gallery track on the brick', side: 'back', kind: 'scallop', from: x - 950, to: x + 950, bottom: 700, top: 2860, off: 66, color: '#fff0da', levels: [.14, .12, .26, .36, .3] });
        }
    },
    // Chapter 4, commons: the Humboldt commons, 13.4 x 35 m, 7.2 m high. The film stays at the pilot bay by the
    // tackboard wall (right, x1) and the back wall's glass; the hall beyond z = 5 m keeps its own architectural light.
    'library/humboldt': {
        steps: ['envelope: the tackboard wall and the back wall shade toward the pilot corner, the carpet falls off under both (the study end of the hall only)'],
        shell(pass) {
            const { back, x0, x1 } = pass;
            pass.envelope({ tint: COOL, offset: 64, cornerWidth: 3200,
                walls: { right: { from: 5000, to: back, height: 4400, flat: .06, top: .3, corners: [0, .3] } },
                floor: { x: [x0, x1], z: [back, 5000], back: .26, left: 0, right: .3, front: 0, width: 2600 } });
        }
    },
    // Chapter 5, coast: OCC multimedia lab, 10.2 x 13 m. Ocean window wall left (its solid end carries the posters),
    // teaching wall with the projection at the back, display wall right.
    'occmedialab/house': {
        steps: ['envelope: the window wall stands against the light, teaching and display walls shade toward the ceiling and the far corners, carpet falls off under them',
            'washes: daylight raking along the teaching wall from the window end'],
        shell(pass) {
            const { x0, h } = pass;
            pass.envelope({ tint: COOL, offset: 72, cornerWidth: 2600,
                walls: { back: { top: .3, corners: [.1, .3] }, left: { flat: .16, top: .26, corners: [.22, 0], holes: [[-480, 5855, 770, 2630]] }, right: { top: .3, corners: [.28, .3] } },
                floor: { back: .3, left: 0, right: .32, front: 0, width: 2600 } });
            pass.wash({ name: 'daylight on the teaching wall', side: 'back', kind: 'rake', from: x0, to: x0 + 6200, bottom: 300, top: h - 200, off: 78, color: '#fff3df', levels: [.22, .18, .22, 0, 0] });
        }
    },
    // Chapter 6, oilers: Huntington Beach classroom, 10 x 12 m. Window wall left, teaching wall at the back, side wall right.
    'highschool/house': {
        steps: ['envelope: the window wall stands against the light, teaching and side walls shade toward the ceiling and the far corners, floor falls off under them',
            'washes: daylight raking along the teaching wall from the window end'],
        shell(pass) {
            const { x0, h } = pass;
            pass.envelope({ tint: COOL, offset: 72, cornerWidth: 2600,
                walls: { back: { top: .28, corners: [.08, .28] }, left: { flat: .15, top: .24, corners: [.2, 0], holes: [[-450, 5410, 770, 2630]] }, right: { top: .3, corners: [.26, .28] } },
                floor: { back: .24, left: 0, right: .3, front: 0, width: 2400 } });
            pass.wash({ name: 'daylight on the teaching wall', side: 'back', kind: 'rake', from: x0, to: x0 + 6000, bottom: 300, top: h - 200, off: 78, color: '#fff3df', levels: [.2, .16, .2, 0, 0] });
        }
    },
    // Chapter 7, wellness: home gym, 4.2 x 5.4 m (black and red in the film). Daylight wall left, slatted performance
    // wall at the back, strength wall right.
    'gym/house': {
        steps: ['envelope: corners and ceiling line go darker, the rubber floor falls off under the walls so the training floor reads as the lit centre',
            'washes: four downlights graze the slatted performance wall'],
        shell(pass) {
            pass.envelope({ tint: '#040507', offset: 60, cornerWidth: 1500,
                walls: { back: { top: .3, corners: [.2, .3], offset: 130 }, left: { flat: .1, top: .2, corners: [.2, .1], holes: [[-520, 1420, 955, 2295]] }, right: { top: .3, corners: [.2, .3] } },
                floor: { back: .3, left: .1, right: .3, width: 1500 } });
            for (const x of [-1560, -520, 520, 1560]) pass.wash({ name: 'downlight on the performance wall', side: 'back', kind: 'scallop', from: x - 600, to: x + 600, bottom: 500, top: 2760, off: 136, color: '#ffe9d2', levels: [.13, .13, .2, .26, .22] });
        }
    },
    // Chapter 9, music: gaming room at night, 3.6 x 4.2 m. The desk's LEDs and the screens light this room: the pass
    // only seats the floor (drawn before the LED floor light, which lands on top at full strength).
    'gaming/house': {
        steps: ['envelope: the floor falls off under the walls; walls untouched (the LED light on them is the show)'],
        shell(pass) { pass.envelope({ tint: '#04050a', walls: {}, floor: { back: .26, left: .22, right: .26, width: 1100 } }); }
    },
    // Chapter 10, media: music studio at night, 3.6 x 4.2 m. As the gaming room.
    'music/house': {
        steps: ['envelope: the floor falls off under the walls; walls untouched (the LED light on them is the show)'],
        shell(pass) { pass.envelope({ tint: '#06050a', walls: {}, floor: { back: .24, left: .2, right: .24, width: 1100 } }); }
    },
    // Chapter 11, storage: garage workshop, 4.8 x 5.6 m plus the loading bay. Daylight wall left, tool wall at the back,
    // machines wall right. The room already carries real cast shadows; the pass only seats the walls and the slab.
    'workshop/house': {
        steps: ['envelope: block walls shade toward the ceiling and the corners, the slab falls off under the back and right walls'],
        shell(pass) {
            const { back, x0, x1 } = pass;
            pass.envelope({ tint: '#0e151a', offset: 60, cornerWidth: 1600,
                walls: { left: { from: back, to: back + 5600, flat: .1, top: .2, corners: [.16, 0], holes: [[-395, 1595, 1005, 2295]] }, right: { from: back + 5600, to: back, top: .26, corners: [0, .22] } },
                floor: { x: [x0, x1], z: [back, back + 5600], back: .22, left: 0, right: .24, front: 0, width: 1500 } });
        }
    },
};
