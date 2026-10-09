// Measured public service, education and mobile work settings. Units are mm.
// Scene IDs intentionally contain only letters, matching saved Groove keys.
const definitions = [
    ['security', 'Security operations', 'Public service', 'A mobile command position with a clear view.', 'operations', '#273c4b', '#48aeb0', [5800, 6800], ['Shift briefing', 'Active watch', 'Evening watch', 'Night watch', 'Team handover']],
    ['police', 'Police / PD', 'Public service', 'Brief, review and respond from one workspace.', 'police', '#e0e5e9', '#234e72', [6200, 7200], ['Morning briefing', 'Case review', 'Evening shift', 'Night shift', 'Team briefing']],
    ['government', 'Government office', 'Public service', 'Flexible workspaces for public service.', 'government', '#e8e4da', '#395d60', [5800, 6800], ['Daily planning', 'Public service', 'Review session', 'Quiet work', 'Team workshop']],
    ['kindergarten', 'Kindergarten', 'Education', 'A teacher workspace among little discoveries.', 'early', '#f0e7d6', '#dba55d', [6000, 7200], ['Welcome circle', 'Discovery time', 'Family evening', 'Room reset', 'Shared learning']],
    ['elementary', 'Elementary school', 'Education', 'Make room for curiosity and collaboration.', 'primary', '#e9ecdf', '#5d8b78', [6400, 7600], ['Morning reading', 'Project time', 'Family evening', 'Lesson planning', 'Class workshop']],
    ['middleschool', 'Middle school', 'Education', 'Flexible stations for the next stage of learning.', 'secondary', '#e0e8ea', '#498698', [7200, 8800], ['Morning seminar', 'Team projects', 'After-school study', 'Lesson planning', 'STEM workshop']],
    ['highschool', 'High school', 'Education', 'A classroom ready for independent thinking.', 'secondary', '#e7e4de', '#567081', [8200, 9800], ['Morning class', 'Group research', 'Evening study', 'Lesson planning', 'Project review']],
    ['college', 'College classroom', 'Education', 'Teaching, discussion and practical learning.', 'college', '#e8e4db', '#866653', [9200, 10800], ['Morning lecture', 'Working seminar', 'Evening class', 'Independent study', 'Group presentation']],
    ['university', 'University classroom', 'Education', 'A mobile teaching station for shared discovery.', 'university', '#e6e7dd', '#285c4b', [10200, 11800], ['Morning lecture', 'Research seminar', 'Evening lecture', 'Graduate study', 'Symposium']],
    ['laboratory', 'Science laboratory', 'Clinical & technical', 'Move between analysis, teaching and experiments.', 'lab', '#dde8e4', '#408d89', [6600, 8000], ['Lab preparation', 'Practical session', 'Analysis', 'Instrument watch', 'Research review']],
    ['hospital', 'Hospital workspace', 'Clinical & technical', 'A mobile documentation station beside the care space.', 'hospital', '#e8efeb', '#608e9d', [6200, 7600], ['Morning rounds', 'Care coordination', 'Evening handover', 'Night observation', 'Team review']],
    ['mobileit', 'Mobile IT', 'Clinical & technical', 'Bring diagnostics and support to the equipment.', 'it', '#dce3e8', '#467eaa', [5800, 7200], ['System checks', 'Service session', 'Maintenance', 'Overnight monitoring', 'Team deployment']]
];
const phases = ['morning', 'afternoon', 'evening', 'night', 'party'];
export const EDUCATIONAL_LEVELS = {
    kindergarten: ['apartment'],
    elementary: ['house'],
    middleschool: ['house'],
    highschool: ['house'],
    college: ['house'],
    university: ['house']
};
// Picker groups are aliases only. Physical scene IDs remain the persistence keys.
// publicservice avoids a name collision with the existing government office ID.
export const INSTITUTIONAL_GROUPS = {
    publicservice: { name: 'Government', category: 'Public service', label: 'Government setting', settings: ['government', 'police', 'security'], initial: 'government', storage: 'governmentSetting' },
    educational: { name: 'Educational', category: 'Educational', label: 'School stage', settings: Object.keys(EDUCATIONAL_LEVELS), initial: 'kindergarten', storage: 'educationalLevel' },
    healthcare: { name: 'Healthcare', category: 'Clinical & technical', label: 'Healthcare setting', settings: ['hospital', 'laboratory'], initial: 'hospital', storage: 'healthcareSetting' }
};
export function institutionalGroup(id) {
    return Object.keys(INSTITUTIONAL_GROUPS).find(key => INSTITUTIONAL_GROUPS[key].settings.includes(id));
}
function makeModes(labels, accent, kind) {
    const clinical = ['lab', 'hospital'].includes(kind), operational = ['operations', 'it', 'police'].includes(kind);
    // Separate general room light from local work light. Hospital observation
    // and operations watch keep dim surroundings without dimming the task pool.
    const lighting = {
        early: { practical: [.24,.3,.7,.35,.65], wash: [.2,.18,.35,.16,.4], task: '#ffe6bf', bounce: '#c6d4bb' },
        primary: { practical: [.28,.32,.74,.4,.7], wash: [.2,.18,.36,.18,.4], task: '#ffe9ca', bounce: '#c2d8cb' },
        secondary: { practical: [.3,.38,.8,.45,.76], wash: [.18,.18,.36,.18,.4], task: '#f5ebd8', bounce: '#bdced5' },
        college: { practical: [.28,.34,.8,.46,.78], wash: [.2,.18,.4,.2,.42], task: '#ffe8c9', bounce: '#cfbdab' },
        university: { practical: [.3,.36,.82,.48,.8], wash: [.2,.18,.38,.2,.4], task: '#f4ead3', bounce: '#b6ccbf' },
        government: { practical: [.28,.35,.78,.4,.76], wash: [.22,.2,.4,.18,.4], task: '#ffe9cf', bounce: '#c7d2bc' },
        police: { practical: [.32,.4,.74,.55,.78], wash: [.18,.2,.3,.16,.36], task: '#e7edf0', bounce: '#9db5c2' },
        operations: { practical: [.28,.34,.58,.45,.64], wash: [.14,.14,.22,.1,.28], task: '#d9e8ed', bounce: '#7eabae' },
        lab: { practical: [.42,.5,.88,.62,.84], wash: [.2,.2,.35,.2,.38], task: '#eaf3ed', bounce: '#b7d1cc' },
        hospital: { practical: [.3,.38,.66,.3,.64], wash: [.22,.2,.3,.12,.3], task: '#ffecd5', bounce: '#bfd6d0' },
        it: { practical: [.34,.42,.76,.5,.74], wash: [.16,.18,.28,.14,.32], task: '#deedf0', bounce: '#9bbbc8' }
    }[kind];
    // Daylight still leads by day; night keeps local work surfaces legible.
    const practicalColor = clinical ? '#e4f2ed' : operational ? '#c4e2ed' : '#ffe1b6';
    const ledColors = clinical ? ['#bee8dd', '#d9eee4'] : operational ? ['#66c2d1', '#93d8cf'] : ['#ffe0ae', '#cce4bd'];
    return Object.fromEntries(phases.map((id, i) => [id, {
        label: labels[i], description: [clinical ? 'Balanced daylight and work lighting' : operational ? 'Day shift · clear displays and daylight' : 'Soft daylight and natural materials', 'Daylight working session', clinical ? 'Neutral task lights and evening sky' : 'Warm practical lighting and evening sky', operational ? 'Low ambient watch · screens and local task lights' : clinical ? 'Dim room wash with local observation lights' : 'Quiet planning · warm task lights', 'Shared activity and presentation lighting'][i],
        key: ['#fff0dc', '#f0f7ff', '#ffd6ac', '#c3d7ee', '#e2ebf2'][i],
        fill: ['#dceaf0', '#e1edf2', '#d7deee', '#a9c8e1', '#d5e8e7'][i], accent,
        power: [1.5, 1.55, clinical ? .8 : .65, operational ? .24 : .18, 1.1][i], ambient: [.42, .46, .28, clinical ? .2 : .15, .38][i],
        bounce: [.7, .76, .5, .24, .57][i], exposure: [1.06, 1.04, 1.08, 1.13, 1.07][i],
        sky: [['#bad8e5', '#f5e6ca'], ['#94c5de', '#e4eff1'], ['#ba96a4', '#f0c89e'], ['#172c47', '#3c5265'], ['#a9cdd7', '#ede3cd']][i],
        practical: lighting.practical[i], wash: lighting.wash[i],
        colors: [lighting.task || practicalColor, lighting.bounce], height: [43.5, 28, 35, 28, 43.5][i], tilt: [-5, 0, 8, 0, -5][i],
        offset: [0, 0], yaw: 0, leds: i > 1, color: ledColors[i === 4 ? 1 : 0]
    }]));
}
export const INSTITUTIONAL_ROOMS = Object.fromEntries(definitions.map(([id, name, category, caption, kind, wall, accent, dimensions, labels]) => {
    const layouts = Object.fromEntries(['apartment', 'house', 'spacious'].filter(tier => !EDUCATIONAL_LEVELS[id] || EDUCATIONAL_LEVELS[id].includes(tier)).map(tier => {
        const index = ['apartment', 'house', 'spacious'].indexOf(tier);
        const width = dimensions[0] + index * 1800, depth = dimensions[1] + index * 2200, back = -depth / 3, desk = [-width / 2 + 1250, back + 1900];
        return [tier, { id: tier, index, schoolRows: ({kindergarten:2,elementary:3,middleschool:4,highschool:4,college:5,university:5})[id], desktopSize: index === 0 ? '48x30' : '60x30', name: EDUCATIONAL_LEVELS[id] ? name : ['Small', 'Medium', 'Large'][index] + ' ' + name.toLowerCase(), width, depth,
            height: 3100 + index * 150, back, desk,
            daylight: [-width / 2 + 100, back + depth * .54], activity: [width / 2 - 1000, back + depth - 700], props: [{ id: 'steelcase-leap-v2', at: [desk[0], 0, desk[1] + 1050], turn: 180, replaceFixture: 'mobile-desk-chair' }] }];
    }));
    return [id, { id, name, category: EDUCATIONAL_LEVELS[id] ? 'Educational' : category, caption, kind, wall, accent, layouts, modes: makeModes(labels, accent, kind),
        stories: labels.map((label, i) => `${label} · ${['Prepare the mobile desk', 'Flexible work and shared materials', 'Focused task lighting', 'Quiet workspace', 'A clear route for the mobile desk'][i]}`) }];
}));
export const INSTITUTIONAL_IDS = Object.keys(INSTITUTIONAL_ROOMS);
export function institutionalLayout(id, layout, size = '48x30') {
    const layouts = INSTITUTIONAL_ROOMS[id]?.layouts;
    return layouts?.[layout] || (EDUCATIONAL_LEVELS[id] ? Object.values(layouts)[0] : layouts?.[size === '60x30' ? 'house' : 'apartment']);
}
