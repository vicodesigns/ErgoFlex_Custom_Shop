// Clip manifest: one entry per output MP4 (exports/cinematic-intro-20261030/screens/<id>.mp4).
// w/h are the output pixels; scenes lay out in a 1080-px design space (see boot.js).
// Sizes follow screens/INVENTORY.md when available, else standard aspects.
const DEMO = '/home/ergo/ErgoFlex_Custom_Shop/app-reference/demo_media/';
const SCREENS = '/home/ergo/ErgoFlex_Custom_Shop/exports/cinematic-intro-20261030/screens/';
// target = the harness screen target from INVENTORY.md

// ---- The cine cut (exports/cinematic-intro-cut-cine, the working cut since Nov 14 2026): each clip samples its chapter
// of review-cut.json by id (shot), is chapter seconds + 1 s long (create: 23.5 s exactly, S3's wiring contract), plays at offset 0 (loop:false) and is written to
// exports/cinematic-intro-cut-cine/screens/<id>.mp4. Proposal: docs/cine-screens-20261114/SCREENS-PROPOSAL.md.
// CREATE_ACTS: create's three ranges (S3, Nov 14): digital painting 0..A, architecture A..B, natural landscapes B..end
// (the drafting kit fades in 7.0-7.4 s, the board tilts to 55 deg for the oil painting from 16.9 s).
export const CREATE_ACTS = {A: 7.0, B: 16.9};
// WELLNESS_BEATS (S16's stretch, Nov 14; the S16 reviewer's spans): the desk rises 6.0-11.0 s to 41 in as Maya gets up
// (the cut's lift clip); she is up by 8.9 s, changes into the stretch 9.0-10.4 s, holds it to 11.6 s, types again at 13 s.
// 'Time to move' + 3-2-1 from nudge to the lift, the desk rising (no demo) to stretch, the shoulder squeeze
// stretch..stretchEnd, the report back after it, the breathing coach to breatheEnd, 'Reset done' at reset.
export const WELLNESS_BEATS = {nudge: 3.0, stretch: 8.9, stretchEnd: 12.0, breatheEnd: 12.4, reset: 13.0};
// OILERS_BEATS (S9's 15 s oilers, Nov 14): Noah taps the desk's touchscreen at 8.2 s, the desk lowers 43.5 -> 31 in over
// 8.5-11.5 s (the cut's lift clip: the readout follows it), Kai docks by 11.8 s and types from 12.75 s. On the screens:
// his answer pad wakes when he has docked, he taps A at `tap`, the reveal 'Mercury ✓ · Kai +100' at `reveal` (at least
// 1 s after the lift lands, so 31.0 in reads on its own first; it stays up), the class dashboard at `dash`.
export const OILERS_BEATS = {dock: 11.8, tap: 12.8, reveal: 13.1, dash: 14.2};
// COAST_PERSON: who uses coast's featured suite (Ava: S4's decision, Nov 14)
export const COAST_PERSON = 'Ava';
// Overhead Triceps Stretch beats (chapter seconds; scenes/stretch.js): B seated after the desk lowers at 9.45, A standing before it lowers at 14.95
// (Nov 21 2026, the calm stretch: chapter 23.5 -> 28.5 s. B: raise 13.1-15.1, right arm held to 17.2, the switch to 19.4, left arm held to 21.5, arms down 23.4;
// A: raise 9.6-11.6, held to 13.7, the switch to 15.9, held to 18.0, arms down 19.9. docs/rise-wellness/)
export const RISE_STRETCH_B = {start: 13.1, rightEnd: 18.3, leftEnd: 23.2, good: 23.2, goodEnd: 25.0, seated: true};
export const RISE_STRETCH_A = {start: 9.6, rightEnd: 14.8, leftEnd: 19.7, good: 19.7, goodEnd: 21.4, seated: false};
// Wellness in the new order (Vico's 3rd cut, seated; Nov 21 2026, docs/wellness-order/): chapter 22.5 s, the desk rises 3.5-8.5 s,
// she types standing from ~8.3 s, the reminder at 9.05 s (she glances at the tablet 9.1-10.1 s), the squats (the film's act)
// 11.5 s for 4.5 s, 3 reps (the demo clip over stretch .. stretchEnd), the desk lowers 14.55-19.55 s, she sits 17.4-20.2 s,
// the routine highlighted from 20.25 s (her hands back on the keys).
export const WELLNESS_ORDER_B = {name: 'Maya', notice: {nudge: 9.05, routine: 20.25}, stretch: 11.0, stretchEnd: 16.2, squats: {at: 11.5, dur: 4.5, reps: 3}};
const CINE_OUT = 'exports/cinematic-intro-cut-cine/screens';
const cine = (shot, chapter, rest) => ({chapter, shot, out: CINE_OUT, ...rest});
const CINE = [
  cine('awaken', 1, {id: 'cine-awaken-main', target: 'main-landscape', role: 'digital twin + first-start self-test', w: 2560, h: 1072, scene: 'ch01', opts: {checklist: true}}),
  cine('rise', 2, {id: 'cine-rise-portrait', target: 'main-portrait', role: 'Maya: wellness height app', w: 1080, h: 1856, scene: 'ch02p',
    opts: {name: 'Maya', initials: 'M', evening: true, ck: [[0, 480], [4, 512], [8, 655], [12, 840], [15, 1000], [18, 1050]]}}),
  cine('rise', 2, {id: 'cine-rise-curved', target: 'main-landscape', role: 'Maya: the workday, the evening summary', w: 2560, h: 1072, scene: 'ch02l',
    opts: {name: 'Maya', colleague: 'Rosa Kim', ck: [[0, 480], [4, 512], [8, 655], [12, 840], [15, 1000], [18, 1050]], toast: [14.6, 99, '3h 10m standing · 9 stand breaks']}}),
  // the phone on the desk's charger (the film's own 'phone' target; a whole-glass clip like 02-phone, 720x1516): charge ring, Maya's lock screen, then the dim always-on clock of her workday
  cine('rise', 2, {id: 'cine-rise-phone', target: 'phone', role: 'Maya: the phone on the charger, charged overnight, the workday clock', w: 720, h: 1516, scene: 'ch02ph',
    opts: {name: 'Maya', ck: [[0, 480], [4, 512], [8, 655], [12, 840], [15, 1000], [18, 1050]]}}),
  // Nov 20 2026, Vico's 3rd cuts (chapter 2, 23.5 s; 28.5 s since Nov 21): the Overhead Triceps Stretch (opts.stretch, scenes/stretch.js; B seated, A standing).
  ...[['b', RISE_STRETCH_B, 'exports/cinematic-intro-cut-vicos-3rd-cut/screens'], ['a', RISE_STRETCH_A, 'exports/cinematic-intro-cut-vicos-3rd-cut-standing/screens']].flatMap(([v, st, out]) => {
    const ck = [[0, 480], [4, 512], [8, 655], [12, 840], [22, 1000], [28.5, 1050]], videos = [{key: 'tricep', src: 'app-reference/demo_media/overhead_triceps_stretch_01_demo.mp4', t: 10, scale: '1280:-2'}];
    return [
      {chapter: 2, shot: 'rise', out, id: 'cine3' + v + '-rise-portrait', target: 'main-portrait', role: 'Maya: wellness height app + the overhead triceps stretch', w: 1080, h: 1856, scene: 'ch02p', videos,
        opts: {name: 'Maya', initials: 'M', evening: true, ck, stretch: st}},
      {chapter: 2, shot: 'rise', out, id: 'cine3' + v + '-rise-curved', target: 'main-landscape', role: 'Maya: the workday, the evening summary', w: 2560, h: 1072, scene: 'ch02l',
        opts: {name: 'Maya', colleague: 'Rosa Kim', ck, toast: [25.1, 99, '3h 10m standing · 9 stand breaks']}},
      {chapter: 2, shot: 'rise', out, id: 'cine3' + v + '-rise-phone', target: 'phone', role: 'Maya: the phone on the charger; the stretch push', w: 720, h: 1516, scene: 'ch02ph', videos, opts: {name: 'Maya', ck, stretch: st}}];
  }),
  cine('create', 3, {id: 'cine-create-landscape', target: 'main-landscape', role: 'Lin: painting -> house model -> meadow reference', w: 1920, h: 1120, scene: 'c03l', frames: 705, opts: {...CREATE_ACTS, name: 'Lin'}}),
  cine('create', 3, {id: 'cine-create-portrait', target: 'main-portrait', role: 'Lin: references -> floor plan -> creek reference', w: 1082, h: 1856, scene: 'c03p', frames: 705, opts: {...CREATE_ACTS, name: 'Lin'}}),
  cine('create', 3, {id: 'cine-create-floor-plan', target: 'texture:Architect floor plan', role: 'the drafting paper relabelled as a home (PNG)', w: 1600, h: 1000, scene: 'cplan', still: true}),
  cine('commons', 4, {id: 'cine-commons-reservation', target: 'main-landscape', role: 'the booking ends (Yara), the next turn (Mia), the team notes', w: 1920, h: 800, scene: 'c04r',
    opts: {prev: 'Yara', next: 'Mia', team: ['Mia', 'Kai', 'Sofia']}}),
  cine('oilers', 6, {id: 'cine-oilers-curved', target: 'main-landscape', role: 'orbit lesson with the teacher cursor', w: 1920, h: 800, scene: 'ch06l', opts: {teacher: 'Hale · teacher'}}),
  cine('oilers', 6, {id: 'cine-oilers-portrait', target: 'main-portrait', role: 'quiz -> lowering to Kai -> Kai +100 -> class', w: 1080, h: 1856, scene: 'c06p', opts: {...OILERS_BEATS, name: 'Kai', class: ['Fern', 'Noah', 'Nia', 'Finn', 'Zoe', 'Mia', 'Leo', 'Sofia']}}),
  cine('oilers', 6, {id: 'cine-oilers-laptop', target: 'main-landscape-2', role: 'the answer pad (Kai)', w: 1280, h: 776, scene: 'c06k', opts: {...OILERS_BEATS, name: 'Kai'}}),
  cine('wellness', 7, {id: 'cine-wellness-main', target: 'main-landscape', role: 'Maya: report -> time to move -> the stretch + height -> standing', w: 1920, h: 1080, scene: 'c07l',
    opts: {...WELLNESS_BEATS, name: 'Maya'}, videos: [{key: 'shoulder', src: 'app-reference/demo_media/seated_scapular_squeeze_01_demo.mp4', t: 17, scale: '1280:-2'}]}),
  cine('wellness', 7, {id: 'cine-wellness-tablet', target: 'tablet', role: 'focus -> breathing with the stretch -> nice reset', w: 1620, h: 1080, scene: 'c07t', opts: {...WELLNESS_BEATS, name: 'Maya'}}),
  // Nov 20 2026, Vico's 3rd cuts (chapter 7, 19.5 s): Desk Squats instead of the shoulder squeeze (opts.squats; the film's act: at 10.2 s, 5.2 s, 3 reps)
  // Nov 21 2026, the seated cut ('b') in the new order (docs/wellness-order/): the desk rises with her at the keys, she types
  // standing, the reminder at notice.nudge (she glances at it), the squats (the film's act), the desk lowers, she sits and
  // types with the routine highlighted from notice.routine (scenes/cine-wellness.js noticeMain / noticeTablet). 'a' as it was.
  ...[['b', 'exports/cinematic-intro-cut-vicos-3rd-cut/screens', WELLNESS_ORDER_B], ['a', 'exports/cinematic-intro-cut-vicos-3rd-cut-standing/screens', null]].flatMap(([v, out, order]) => {
    const opts = order || {nudge: 3.0, stretch: 9.7, stretchEnd: 15.6, breatheEnd: 15.9, reset: 16.5, name: 'Maya', squats: {at: 10.2, dur: 5.2, reps: 3}}, videos = [{key: 'squat', src: 'app-reference/demo_media/desk_squats_01_demo.mp4', t: 17, scale: '1280:-2'}];
    return [
      {chapter: 7, shot: 'wellness', out, id: 'cine3' + v + '-wellness-main', target: 'main-landscape', role: 'Maya: report -> time to move -> Desk Squats + height -> standing', w: 1920, h: 1080, scene: 'c07l', opts, videos},
      {chapter: 7, shot: 'wellness', out, id: 'cine3' + v + '-wellness-tablet', target: 'tablet', role: 'focus -> Desk Squats card -> great job', w: 1620, h: 1080, scene: 'c07t', opts, videos}];
  }),
  cine('awareness', 8, {id: 'cine-awareness-main', target: 'main-landscape', role: 'radar on the roll of the cut: the pet, stopped short', w: 1920, h: 800, scene: 'c08', opts: {gap: 16, label: 'Pet'}}),
  // coast (written LAST: COAST_PERSON is S4's decision of who uses the featured suite; Maya is at the centre bay)
  cine('coast', 5, {id: 'cine-coast-main', target: 'main-landscape', role: 'the featured suite: sign-in, height, colour, export', w: 1920, h: 1120, scene: 'c05m', opts: {name: COAST_PERSON, sign: -1}}),
  cine('coast', 5, {id: 'cine-coast-curved', target: 'ergoflex-wide-monitor/monitor-screen', role: 'centre bay (Maya): NLE', w: 1920, h: 800, scene: 'ch05l', opts: {who: 'Maya', credit: COAST_PERSON}}),
  cine('coast', 5, {id: 'cine-coast-portrait', target: 'ergoflex-portrait-monitor/monitor-screen', role: 'centre bay (Maya): colour + export', w: 1080, h: 1856, scene: 'ch05p'}),
  cine('coast', 5, {id: 'cine-coast-wall', target: 'occ-display', role: 'screening wall: the reel opens on COAST', w: 3840, h: 1520, scene: 'ch05w', opts: {credit: COAST_PERSON}}),
  // music: the beat follows the new score's tempo map once S7 publishes it (CINE_TEMPO=<file>, CINE_SCORE + CINE_SCORE_START)
  ...[['arcade', 'arcade', 1360, 1080, 'ch09a'], ['marquee', 'marquee', 1920, 504, 'ch09m'], ['streamdeck', 'atelier-gaming-streamdeck-cyber/gaming-macro-key-display', 960, 616, 'ch09k'],
    ['tv', 'tv', 1920, 1080, 'ch09c']].map(([n, target, w, h, scene]) => cine('music', 9, {id: 'cine-music-' + n, target, role: 'gaming room ' + n + ' on the score', w, h, scene, audio: true,
    opts: {handle: 'neonrunner', rename: {nova_kai: 'novaflux'}, burst: [6.3, ['desk lights synced', 'the desk moves with the game??', 'LEDs on the beat']]},
    ...(n === 'tv' ? {videos: [{key: 'montage', src: 'exports/cinematic-intro-20261030/screens/09-game-montage.mp4', t: 16, scale: '854:-2'}]} : {})})),
  cine('storage', 11, {id: 'cine-storage-phone', target: 'texture:Held.phone screen (andre)', role: 'the phone in the hand of Andre: the saved Groove: a big play button and the word Groove, upright (flipX on the texture); the tap lights it, pause and a progress ring', w: 540, h: 1160, scene: 'c11p', opts: {tap: 11.14}}),
  // hero, the office version (financial analyst): its window is 12.5-21.9 s and the shot plays these at offset -13.1, so 10 s
  // (300 frames) reach past its end (the hq12 clips were 8 s: their last frame held 0.8 s into the dissolve)
  cine('hero', 12, {id: 'cine-hero-office-wide', target: 'main-landscape', role: 'finale office version: markets, DCF model', w: 2560, h: 1072, scene: 'ch13w', frames: 300}),
  cine('hero', 12, {id: 'cine-hero-office-portrait', target: 'main-portrait', role: 'finale office version: portfolio', w: 1080, h: 1856, scene: 'ch13p', frames: 300}),
  // hero: one 48 s home per desk version (shots/13-subshots.json), greeting that version's chapter person
  // gaming: no name (chingon, Nov 14: Kai's identity across the rooms is open with Vico)
  ...[['gaming', '', 'Game night', [['Lights', 'Sync', '', 'pink', .8, 'LEDs on the game'], ['Height', '47.0', 'in', 'blue2', .7, 'Play height'], ['Tonight', '2h 10m', '', 'violet', .6, 'Session'], ['Tilt', '5°', '', 'cyan', .3, 'Screen angle']]],
    ['artist', 'Lin', 'Studio day', [['Canvas', 'Saved', '', 'pink', .9, 'Lakeside dusk'], ['Surface', '55°', '', 'violet', .6, 'Easel'], ['Model', 'House A', '', 'cyan', .7, 'A-101 synced'], ['Studio', '4h 30m', '', 'amber', .75, 'Today']]],
    ['hbhs', 'Kai', 'Period 2 done', [['Quiz', '+100', '', 'green', 1, 'Mercury ✓'], ['Height', '31.0', 'in', 'blue2', .25, 'His preset'], ['Class', '68%', '', 'teal', .68, 'got it right'], ['Next', 'Lab', '', 'amber', .4, 'Period 3']]],
    ['occ', COAST_PERSON, 'Edit suite', [['Export', '100%', '', 'green', 1, 'COAST_final_4K'], ['Suite', '39.0', 'in', 'blue2', .4, 'Standing edit'], ['Review', '5', 'films', 'coral', .8, 'Portfolio'], ['Grade', 'Teal', '', 'amber', .6, '& Amber']]],
    ['home', '', 'Your desk is ready', null],
  ].map(([v, name, sub, tiles]) => cine('hero', 12, {id: 'cine-hero-' + v, target: 'main-landscape', role: `finale ${v} version home`, w: 1920, h: 800, scene: 'ch12', opts: {homeUntil: 1e3, name, sub, ...(tiles ? {tiles} : {})}})),
];
export const CLIPS = [
  {id: '01-main', chapter: 1, target: 'main-landscape', role: 'curved main: digital-twin control', w: 2560, h: 1072, scene: 'ch01'},
  // Round 8 alternative for the same monitor (Vico: wellness / how the desk helps, no twin): same size, same shot timing.
  {id: '01-wellness', chapter: 1, target: 'main-landscape', role: 'curved main: wellness routine + focus, no twin', w: 2560, h: 1072, scene: 'ch01w'},
  {id: '02-portrait', chapter: 2, target: 'main-portrait', role: 'portrait: wellness app height + stand', w: 1080, h: 1856, scene: 'ch02p'},
  {id: '02-curved', chapter: 2, target: 'main-landscape', role: 'curved: the workday', w: 2560, h: 1072, scene: 'ch02l'},
  // HQ37 (Vico, 2026-11-06): the phone on the desk's charger opens the chapter: charge ring to 100 %, then the lock screen
  // (charged overnight, the Daily notes card), then an always-on dim as the desk wakes. The phone's whole front glass.
  {id: '02-phone', chapter: 2, target: 'phone', role: 'phone on the charger: 100 % charge, lock screen, Daily notes', w: 720, h: 1516, scene: 'ch02ph'},
  {id: '02-tablet', chapter: 2, target: 'tablet', role: 'tablet: desk remote', w: 1620, h: 1080, scene: 'ch02t'},
  {id: '03-landscape', chapter: 3, target: 'main-landscape', role: 'flat: painting app timelapse', w: 1920, h: 1120, scene: 'ch03l'},
  {id: '03-portrait', chapter: 3, target: 'main-portrait', role: 'portrait: reference board + palette', w: 1080, h: 1856, scene: 'ch03p'},
  {id: '04-curved', chapter: 4, target: 'main-landscape', role: 'curved: shared whiteboard + notes', w: 1920, h: 800, scene: 'ch04'},
  {id: '05-main', chapter: 5, target: 'main-landscape', role: 'hero station flat: review playback', w: 1920, h: 1120, scene: 'ch05m'},
  {id: '05-curved', chapter: 5, target: 'ergoflex-wide-monitor/monitor-screen', role: 'Film editing 1 curved: NLE editor', w: 1920, h: 800, scene: 'ch05l'},
  {id: '05-portrait', chapter: 5, target: 'ergoflex-portrait-monitor/monitor-screen', role: 'Film editing 1 portrait: colour + export', w: 1080, h: 1856, scene: 'ch05p'},
  {id: '05-wall', chapter: 5, target: 'occ-display', role: 'screening wall: portfolio review reel', w: 3840, h: 1520, scene: 'ch05w'},
  {id: '06-curved', chapter: 6, target: 'main-landscape', role: 'curved: orbit simulation lesson', w: 1920, h: 800, scene: 'ch06l'},
  {id: '06-portrait', chapter: 6, target: 'main-portrait', role: 'portrait: live quiz + class dashboard', w: 1080, h: 1856, scene: 'ch06p'},
  {id: '06-laptop', chapter: 6, target: 'main-landscape-2', role: 'laptop: quiz answer pad', w: 1280, h: 776, scene: 'ch06k'},
  {id: '07-main', chapter: 7, target: 'main-landscape', role: 'Dell 16:9: guided workout coach', w: 1920, h: 1080, scene: 'ch07l',
    // demo clips decoded whole; the scene skips their 'incorrect form' segment (~4.8-8.1 s)
    videos: [{key: 'squats', src: DEMO + 'desk_squats_01_demo.mp4', t: 17, scale: '1280:-2'},
      {key: 'shoulder', src: DEMO + 'seated_scapular_squeeze_01_demo.mp4', t: 17, scale: '1280:-2'}]},
  {id: '07-tablet', chapter: 7, target: 'tablet', role: 'tablet: breathing coach + heart rate', w: 1620, h: 1080, scene: 'ch07t'},
  {id: '08-main', chapter: 8, target: 'main-landscape', role: 'curved main: proximity radar', w: 1920, h: 800, scene: 'ch08'},
  {id: '09-arcade', chapter: 9, target: 'arcade', role: 'arcade cabinet: Orbit Runner gameplay', w: 1360, h: 1080, scene: 'ch09a', audio: true},
  {id: '09-marquee', chapter: 9, target: 'marquee', role: 'arcade marquee: Orbit Runner logo', w: 1920, h: 504, scene: 'ch09m', audio: true},
  {id: '09-streamdeck', chapter: 9, target: 'atelier-gaming-streamdeck-cyber/gaming-macro-key-display', role: 'macro key display: beat keys', w: 960, h: 616, scene: 'ch09k', audio: true},
  {id: '09-tv', chapter: 9, target: 'tv', role: 'TV: stream dashboard + chat', w: 1920, h: 1080, scene: 'ch09c', audio: true,
    videos: [{key: 'montage', src: SCREENS + '09-game-montage.mp4', t: 16, scale: '854:-2'}]},
  {id: '11-main', chapter: 11, target: 'main-landscape', role: 'curved: storage mode', w: 1920, h: 800, scene: 'ch11'},
  {id: '12-main', chapter: 12, target: 'main-landscape', role: 'curved: app home / brand loop', w: 1920, h: 800, scene: 'ch12'},
  // HQ12 finale (shots/13.json, CAPTURE_SHOT + CAPTURE_OUT): the ch12 home/brand loop for the whole 48 s chapter, and the
  // office look as a financial analyst (local clip time, rendered with --frames 240; the shot plays them with offset -E start).
  {id: '13-main', chapter: 13, target: 'main-landscape', role: 'curved: app home for the whole finale (Vico: no logo-only monitors)', w: 1920, h: 800, scene: 'ch12', opts: {homeUntil: 1e3}},
  {id: '13-fin-portrait', chapter: 13, target: 'main-portrait', role: 'portrait: portfolio (financial analyst)', w: 1080, h: 1856, scene: 'ch13p'},
  {id: '13-fin-wide', chapter: 13, target: 'main-landscape', role: 'curved: markets, DCF model, watchlist', w: 2560, h: 1072, scene: 'ch13w'},
  ...CINE,
];
