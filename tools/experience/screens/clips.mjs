// Clip manifest: one entry per output MP4 (exports/cinematic-intro-20261030/screens/<id>.mp4).
// w/h are the output pixels; scenes lay out in a 1080-px design space (see boot.js).
// Sizes follow screens/INVENTORY.md when available, else standard aspects.
const DEMO = '/home/ergo/ErgoFlex_Custom_Shop/app-reference/demo_media/';
const SCREENS = '/home/ergo/ErgoFlex_Custom_Shop/exports/cinematic-intro-20261030/screens/';
// target = the harness screen target from INVENTORY.md
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
];
