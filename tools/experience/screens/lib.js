// Shared canvas UI toolkit for the intro-film monitor screens.
// Everything is a pure function of t (chapter seconds): no timers, no Date.now,
// no Math.random. Design space: landscape scenes are 1080 px tall (W grows with
// aspect), portrait scenes are 1080 px wide (H grows with aspect).
/* eslint-disable no-unused-vars */
const SHOT = window.__SHOT || {seconds: 10, duration: 11, poses: [{height: 28, tilt: 0, x: 0, z: 0, yaw: 0}], rate: 60, clips: [], clip: {w: 1920, h: 1080, scene: 'ch02l', opts: {}}, videos: {}};
const SCENES = {};
let W = 1920, H = 1080, g = null;

const C = {
  bg: '#060a12', bg2: '#0b1220', card: '#0f1828', card2: '#152238', card3: '#1b2b46',
  line: 'rgba(160,190,230,0.10)', line2: 'rgba(160,190,230,0.18)',
  text: '#e8eef7', soft: '#c3cedf', dim: '#8796ad', faint: '#53627a',
  blue: '#1388ec', blue2: '#52b2ff', blueDeep: '#0a4f97', teal: '#1fd1a5', green: '#3ddc84',
  amber: '#ffb22e', orange: '#ff8a3d', coral: '#ff5d73', violet: '#8f6bff', pink: '#ff4fb4', cyan: '#2fd6ff', lime: '#b6f046',
};

// ---------- math ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sm = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const eo = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const ei = x => { x = clamp(x); return x * x * x; };
const eio = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = x => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const elastic = x => { x = clamp(x); if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI / 3)) + 1; };
const fract = x => x - Math.floor(x);
const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
const fbm = x => noise(x) * .55 + noise(x * 2.1 + 7) * .3 + noise(x * 4.3 + 13) * .15;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// visibility window with fades: 0 outside [a,b], 1 inside, eased edges
const win = (t, a, b, f = .4) => Math.min(sm(seg(t, a - f * .5, a + f * .5)), 1 - sm(seg(t, b - f * .5, b + f * .5)));
// sequential (non-overlapping) window: fades in over [a,a+f], out over [b-f,b]
const win2 = (t, a, b, f = .4) => Math.min(sm(seg(t, a, a + f)), 1 - sm(seg(t, b - f, b)));
const pad2 = n => String(Math.floor(n)).padStart(2, '0');
const fmtClock = (min, ampm = true) => { min = ((min % 1440) + 1440) % 1440; let h = Math.floor(min / 60), m = Math.floor(min % 60); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return ampm ? `${h}:${pad2(m)} ${ap}` : `${h}:${pad2(m)}`; };
const fmtMS = s => `${pad2(s / 60)}:${pad2(s % 60)}`;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const mix = (h1, h2, u) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const c = s => Math.round(lerp(a >> s & 255, b >> s & 255, u)); return `rgb(${c(16)},${c(8)},${c(0)})`; };

// ---------- desk pose (from the shot's motion clips) ----------
function pose(t) {
  const P = SHOT.poses, f = clamp(t * SHOT.rate, 0, P.length - 1), i = Math.floor(f), j = Math.min(P.length - 1, i + 1), u = f - i;
  const a = P[i], b = P[j];
  return {height: lerp(a.height, b.height, u), tilt: lerp(a.tilt, b.tilt, u), x: lerp(a.x, b.x, u), z: lerp(a.z, b.z, u), yaw: lerp(a.yaw, b.yaw, u)};
}
function speed(t) { const a = pose(t - 1 / 30), b = pose(t + 1 / 30); return Math.hypot(b.x - a.x, b.z - a.z) * 15; } // in/s
function liftRate(t) { return (pose(t + 1 / 30).height - pose(t - 1 / 30).height) * 15; }
function tiltRate(t) { return (pose(t + 1 / 30).tilt - pose(t - 1 / 30).tilt) * 15; }
function yawRate(t) { return (pose(t + 1 / 30).yaw - pose(t - 1 / 30).yaw) * 15; }
const clipsOf = lane => SHOT.clips.filter(c => c.lane === lane).sort((a, b) => a.start - b.start);
function activeClip(t, lane) { return SHOT.clips.find(c => (!lane || c.lane === lane) && t >= c.start && t <= c.start + c.duration); }

// ---------- drawing primitives ----------
function font(size, weight = 500) { g.font = `${weight} ${size}px Poppins`; }
function T(str, x, y, size, o = {}) {
  g.save();
  font(size, o.w || 500);
  g.fillStyle = o.c || C.text;
  g.textAlign = o.a || 'left';
  g.textBaseline = o.b || 'alphabetic';
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  if (o.ls) g.letterSpacing = o.ls + 'px';
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.glowR || 24; }
  if (o.max) g.fillText(str, x, y, o.max); else g.fillText(str, x, y);
  g.restore();
}
function tw(str, size, weight = 500, ls = 0) { g.save(); font(size, weight); if (ls) g.letterSpacing = ls + 'px'; const w = g.measureText(str).width; g.restore(); return w; }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); }
function fillR(x, y, w, h, r, fill) { rr(x, y, w, h, r); g.fillStyle = fill; g.fill(); }
function strokeR(x, y, w, h, r, col, lw = 2) { rr(x, y, w, h, r); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); }
function circle(x, y, r, fill) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
function ringStroke(x, y, r, col, lw) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); }
function poly(pts, col, lw = 3, close = false) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (close) g.closePath(); g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function polyFill(pts, fill) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = fill; g.fill(); }
function lin(x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function rad(x, y, r, stops) { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function alpha(a, fn) { if (a <= 0.001) return; g.save(); g.globalAlpha *= clamp(a); fn(); g.restore(); }
function at(x, y, s, fn, rot = 0) { g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (s !== 1) g.scale(s, s); fn(); g.restore(); }
function clip(x, y, w, h, r, fn) { g.save(); rr(x, y, w, h, r); g.clip(); fn(); g.restore(); }

function ring(x, y, r, lw, frac, col, o = {}) {
  const st = o.start != null ? o.start : -Math.PI / 2;
  g.save(); g.lineCap = 'round';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.strokeStyle = o.track || hexA(col.startsWith('#') ? col : '#ffffff', .14); g.lineWidth = lw; g.stroke();
  if (frac > 0.001) {
    g.beginPath(); g.arc(x, y, r, st, st + Math.PI * 2 * clamp(frac, 0, 1.999)); g.strokeStyle = col; g.lineWidth = lw;
    if (o.glow) { g.shadowColor = col; g.shadowBlur = o.glow; }
    g.stroke();
  }
  g.restore();
}
function bar(x, y, w, h, frac, col, track = 'rgba(255,255,255,0.09)') { fillR(x, y, w, h, h / 2, track); if (frac > 0.002) fillR(x, y, Math.max(h, w * clamp(frac)), h, h / 2, col); }

// Background: deep gradient + slowly drifting colour blobs so screens never look static.
function backdrop(t, o = {}) {
  const top = o.top || C.bg2, bot = o.bot || C.bg;
  g.fillStyle = lin(0, 0, 0, H, [[0, top], [1, bot]]); g.fillRect(0, 0, W, H);
  const blobs = o.blobs || [[C.blue, .16]];
  blobs.forEach(([col, a], i) => {
    const bx = W * (.2 + .6 * noise(t * .07 + i * 9.1)), by = H * (.15 + .7 * noise(t * .06 + i * 4.7 + 3));
    const r = Math.max(W, H) * (o.blobR || .55);
    g.fillStyle = rad(bx, by, r, [[0, hexA(col, a)], [1, hexA(col, 0)]]); g.fillRect(0, 0, W, H);
  });
}
function vignette(a = .45) { g.fillStyle = rad(W / 2, H / 2, Math.hypot(W, H) * .62, [[0, 'rgba(0,0,0,0)'], [.65, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${a})`]]); g.fillRect(0, 0, W, H); }
function card(x, y, w, h, o = {}) {
  const r = o.r != null ? o.r : 28;
  g.save();
  if (o.shadow !== false) { g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 30; g.shadowOffsetY = 10; }
  fillR(x, y, w, h, r, o.fill || lin(x, y, x, y + h, [[0, o.top || C.card2], [1, o.bot || C.card]]));
  g.restore();
  strokeR(x + .5, y + .5, w - 1, h - 1, r, o.border || C.line, o.bw || 2);
  if (o.accent) { g.save(); rr(x, y, w, h, r); g.clip(); g.fillStyle = rad(x + w * .15, y, Math.max(w, h) * .9, [[0, hexA(o.accent, .22)], [1, hexA(o.accent, 0)]]); g.fillRect(x, y, w, h); g.restore(); }
}
function pill(x, y, label, size, o = {}) {
  const padX = size * .8, h = size * 2, w = (o.w) || tw(label, size, o.wt || 600) + padX * 2 + (o.dot ? size * 1.2 : 0);
  const bx = o.a === 'right' ? x - w : o.a === 'center' ? x - w / 2 : x;
  fillR(bx, y, w, h, h / 2, o.bg || hexA(C.blue, .18));
  if (o.border) strokeR(bx, y, w, h, h / 2, o.border, 2);
  let tx = bx + padX;
  if (o.dot) { circle(tx + size * .3, y + h / 2, size * .3, o.dot); tx += size * 1.2; }
  T(label, tx, y + h / 2 + size * .36, size, {w: o.wt || 600, c: o.c || C.blue2});
  return w;
}
function avatar(x, y, r, col, initials, o = {}) {
  circle(x, y, r, lin(x - r, y - r, x + r, y + r, [[0, col], [1, mix(col, '#000000', .45)]]));
  if (initials) T(initials, x, y + r * .3, r * .82, {w: 600, a: 'center', c: '#ffffff', alpha: .92});
  if (o.ring) ringStroke(x, y, r + (o.ringGap || 6), o.ring, o.ringW || 5);
}
function spark(x, y, w, h, vals, col, o = {}) {
  const n = vals.length, mn = o.min != null ? o.min : Math.min(...vals), mx = o.max != null ? o.max : Math.max(...vals);
  const pts = vals.map((v, i) => [x + w * i / (n - 1), y + h - h * (v - mn) / ((mx - mn) || 1)]);
  if (o.fill) { polyFill([[x, y + h], ...pts, [x + w * (pts.length - 1) / (n - 1), y + h]], lin(0, y, 0, y + h, [[0, hexA(col, o.fill)], [1, hexA(col, 0)]])); }
  poly(pts, col, o.lw || 4);
  return pts;
}

// ---------- icons (stroke style, drawn in a 1-unit box centred at x,y) ----------
function icon(name, x, y, s, col, lw) {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = (lw || s * .09) / s; g.lineCap = 'round'; g.lineJoin = 'round';
  const P = (pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
  const A = (cx, cy, r, a0 = 0, a1 = Math.PI * 2) => { g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke(); };
  switch (name) {
    case 'check': P([[-.32, .02], [-.1, .25], [.34, -.22]]); break;
    case 'play': g.beginPath(); g.moveTo(-.22, -.32); g.lineTo(.34, 0); g.lineTo(-.22, .32); g.closePath(); g.fill(); break;
    case 'pause': g.fillRect(-.26, -.3, .17, .6); g.fillRect(.09, -.3, .17, .6); break;
    case 'up': P([[0, .34], [0, -.32]]); P([[-.26, -.08], [0, -.34], [.26, -.08]]); break;
    case 'down': P([[0, -.34], [0, .32]]); P([[-.26, .08], [0, .34], [.26, .08]]); break;
    case 'heart': g.beginPath(); g.moveTo(0, .34); g.bezierCurveTo(-.55, -.02, -.32, -.48, 0, -.18); g.bezierCurveTo(.32, -.48, .55, -.02, 0, .34); g.fill(); break;
    case 'flame': g.beginPath(); g.moveTo(0, -.42); g.bezierCurveTo(.38, -.08, .34, .38, 0, .4); g.bezierCurveTo(-.34, .38, -.38, -.02, -.1, -.16); g.bezierCurveTo(-.06, 0, 0, .02, .02, -.08); g.closePath(); g.fill(); break;
    case 'steps': g.beginPath(); g.ellipse(-.16, -.1, .1, .2, -.2, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(.16, .12, .1, .2, .2, 0, Math.PI * 2); g.fill(); break;
    case 'bolt': g.beginPath(); g.moveTo(.08, -.42); g.lineTo(-.24, .06); g.lineTo(0, .06); g.lineTo(-.08, .42); g.lineTo(.24, -.06); g.lineTo(0, -.06); g.closePath(); g.fill(); break;
    case 'sun': A(0, 0, .17); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P([[Math.cos(a) * .27, Math.sin(a) * .27], [Math.cos(a) * .38, Math.sin(a) * .38]]); } break;
    case 'moon': g.beginPath(); g.arc(0, 0, .34, Math.PI * .28, Math.PI * 1.72, false); g.arc(.2, -.02, .28, Math.PI * 1.5, Math.PI * .5, true); g.closePath(); g.fill(); break;
    case 'mic': g.beginPath(); g.roundRect(-.12, -.36, .24, .44, .12); g.stroke(); A(0, -.04, .24, 0, Math.PI); P([[0, .2], [0, .36]]); break;
    case 'cam': g.beginPath(); g.roundRect(-.36, -.2, .48, .4, .08); g.stroke(); P([[.14, -.04], [.36, -.18], [.36, .18], [.14, .04]]); break;
    case 'bell': g.beginPath(); g.moveTo(-.28, .18); g.quadraticCurveTo(-.24, -.34, 0, -.34); g.quadraticCurveTo(.24, -.34, .28, .18); g.closePath(); g.stroke(); P([[-.06, .32], [.06, .32]]); break;
    case 'plus': P([[-.3, 0], [.3, 0]]); P([[0, -.3], [0, .3]]); break;
    case 'search': A(-.06, -.06, .22); P([[.1, .1], [.32, .32]]); break;
    case 'lock': g.beginPath(); g.roundRect(-.26, -.04, .52, .38, .06); g.stroke(); A(0, -.06, .16, Math.PI, 0); break;
    case 'wheel': A(0, 0, .3); A(0, 0, .08); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; P([[Math.cos(a) * .12, Math.sin(a) * .12], [Math.cos(a) * .27, Math.sin(a) * .27]]); } break;
    case 'desk': P([[-.4, -.08], [.4, -.08]]); P([[-.28, -.08], [-.28, .32]]); P([[.28, -.08], [.28, .32]]); P([[-.38, .32], [-.18, .32]]); P([[.18, .32], [.38, .32]]); break;
    case 'tilt': P([[-.38, .3], [.38, .3]]); P([[-.3, .3], [.3, -.2]]); A(-.3, .3, .32, -Math.PI * .22, 0); break;
    case 'radar': A(0, 0, .36); A(0, 0, .2); P([[0, 0], [.25, -.25]]); break;
    case 'wifi': A(0, .28, .5, -Math.PI * .75, -Math.PI * .25); A(0, .28, .3, -Math.PI * .75, -Math.PI * .25); g.beginPath(); g.arc(0, .24, .06, 0, Math.PI * 2); g.fill(); break;
    case 'music': P([[-.12, .26], [-.12, -.3], [.3, -.38], [.3, .18]]); g.beginPath(); g.ellipse(-.22, .27, .12, .09, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(.2, .19, .12, .09, 0, 0, Math.PI * 2); g.fill(); break;
    case 'brush': P([[.34, -.34], [-.06, .06]]); g.beginPath(); g.ellipse(-.16, .18, .14, .2, -.8, 0, Math.PI * 2); g.fill(); break;
    case 'layers': P([[0, -.32], [.36, -.12], [0, .08], [-.36, -.12], [0, -.32]]); P([[-.36, .06], [0, .26], [.36, .06]]); break;
    case 'drop': g.beginPath(); g.moveTo(0, -.38); g.bezierCurveTo(.3, -.02, .3, .36, 0, .36); g.bezierCurveTo(-.3, .36, -.3, -.02, 0, -.38); g.fill(); break;
    case 'chat': g.beginPath(); g.roundRect(-.36, -.3, .72, .48, .14); g.stroke(); P([[-.14, .18], [-.22, .34], [.02, .18]]); break;
    case 'user': A(0, -.14, .16); A(0, .4, .32, Math.PI * 1.15, Math.PI * 1.85); break;
    case 'gear': A(0, 0, .14); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P([[Math.cos(a) * .24, Math.sin(a) * .24], [Math.cos(a) * .36, Math.sin(a) * .36]]); } A(0, 0, .26); break;
    case 'home': P([[-.34, -.02], [0, -.34], [.34, -.02]]); P([[-.24, -.1], [-.24, .32], [.24, .32], [.24, -.1]]); break;
    case 'calendar': g.beginPath(); g.roundRect(-.34, -.28, .68, .6, .08); g.stroke(); P([[-.34, -.1], [.34, -.1]]); P([[-.16, -.38], [-.16, -.2]]); P([[.16, -.38], [.16, -.2]]); break;
    case 'clock': A(0, 0, .34); P([[0, -.2], [0, 0], [.14, .1]]); break;
    case 'video': g.beginPath(); g.roundRect(-.36, -.26, .72, .52, .08); g.stroke(); g.beginPath(); g.moveTo(-.08, -.12); g.lineTo(.14, 0); g.lineTo(-.08, .12); g.closePath(); g.fill(); break;
    case 'doc': g.beginPath(); g.moveTo(-.26, -.36); g.lineTo(.12, -.36); g.lineTo(.26, -.22); g.lineTo(.26, .36); g.lineTo(-.26, .36); g.closePath(); g.stroke(); P([[-.12, -.04], [.12, -.04]]); P([[-.12, .12], [.12, .12]]); break;
    case 'atom': for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, 0, .38, .14, i * Math.PI / 3, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.arc(0, 0, .06, 0, Math.PI * 2); g.fill(); break;
    case 'trophy': P([[-.2, -.32], [.2, -.32], [.16, .02], [0, .1], [-.16, .02], [-.2, -.32]]); P([[0, .1], [0, .26]]); P([[-.16, .32], [.16, .32]]); break;
    case 'lungs': g.beginPath(); g.ellipse(-.17, .06, .13, .26, .15, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(.17, .06, .13, .26, -.15, 0, Math.PI * 2); g.stroke(); P([[0, -.36], [0, -.12]]); break;
    case 'park': g.beginPath(); g.roundRect(-.32, -.32, .64, .64, .12); g.stroke(); P([[-.1, .2], [-.1, -.18], [.06, -.18]]); g.beginPath(); g.arc(.06, -.08, .1, -Math.PI / 2, Math.PI / 2); g.stroke(); P([[.06, .02], [-.1, .02]]); break;
    default: A(0, 0, .3);
  }
  g.restore();
}
function iconBadge(name, x, y, r, col, o = {}) {
  circle(x, y, r, o.bg || hexA(col, .18));
  icon(name, x, y, r * 1.15, o.fg || col, o.lw);
}

// ---------- brand ----------
const IMG = {};
function loadImage(key, url) { return new Promise(res => { const im = new Image(); im.onload = () => { IMG[key] = im; res(im); }; im.onerror = () => { console.warn('image failed', url); res(null); }; im.src = url; }); }
function logo(x, y, w, a = 1, o = {}) { // x,y = centre
  const im = IMG.logo; if (!im) { T('ErgoFlex', x, y, w / 5, {w: 700, a: 'center', alpha: a}); return; }
  const h = w * im.height / im.width;
  g.save(); g.globalAlpha *= a; if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.glowR || 40; }
  g.drawImage(im, x - w / 2, y - h / 2, w, h); g.restore();
}
// Brand mark: a rounded "E" tile used as an app icon.
function appIcon(x, y, s, o = {}) {
  g.save();
  if (o.glow) { g.shadowColor = hexA(C.blue, .7); g.shadowBlur = s * .5; }
  fillR(x - s / 2, y - s / 2, s, s, s * .26, lin(x - s / 2, y - s / 2, x + s / 2, y + s / 2, [[0, '#2aa3ff'], [1, '#0b5fc0']]));
  g.restore();
  g.fillStyle = '#ffffff';
  const u = s / 10;
  fillR(x - 2.4 * u, y - 2.9 * u, 4.8 * u, 1.3 * u, .65 * u, '#fff');
  fillR(x - 2.4 * u, y - .65 * u, 3.8 * u, 1.3 * u, .65 * u, '#fff');
  fillR(x - 2.4 * u, y + 1.6 * u, 4.8 * u, 1.3 * u, .65 * u, '#fff');
  fillR(x - 2.4 * u, y - 2.9 * u, 1.3 * u, 5.8 * u, .65 * u, '#fff');
}

// OS-ish status bar (phone/tablet style for portrait, menu bar for landscape)
function statusBar(t, clockMin, o = {}) {
  const y = o.y || 0, h = o.h || 64;
  if (o.bg !== false) { g.fillStyle = o.bg || 'rgba(4,8,14,0.55)'; g.fillRect(0, y, W, h); }
  T(fmtClock(clockMin), o.clockX != null ? o.clockX : 40, y + h * .66, h * .42, {w: 600, c: C.soft});
  const rx = W - 40;
  icon('wifi', rx - 120, y + h * .52, h * .48, C.soft, 3);
  fillR(rx - 78, y + h * .32, 62, h * .36, 7, 'rgba(255,255,255,0.18)'); fillR(rx - 75, y + h * .32 + 3, 46, h * .36 - 6, 5, C.green);
}

// Toast / notification banner sliding down
function toast(t, t0, dur, x, y, w, title, sub, o = {}) {
  const a = win(t, t0, t0 + dur, .5); if (a <= 0) return;
  const k = eo(seg(t, t0 - .25, t0 + .35));
  const h = o.h || 150;
  alpha(a, () => at(0, (1 - k) * -40, 1, () => {
    card(x, y, w, h, {r: o.r || 32, top: o.top || '#1a2a44', bot: o.bot || '#121e33', border: o.border || hexA(o.col || C.blue, .45), accent: o.col || C.blue});
    iconBadge(o.icon || 'check', x + h / 2, y + h / 2, h * .3, o.col || C.blue);
    T(title, x + h * .95, y + h * .45, o.ts || 46, {w: 600, max: w - h * 1.1});
    if (sub) T(sub, x + h * .95, y + h * .78, o.ss || 32, {w: 400, c: C.dim, max: w - h * 1.1});
  }));
}

// Deterministic confetti burst
function confetti(t, t0, cx, cy, n = 80, spread = 700, o = {}) {
  const dt = t - t0; if (dt < 0 || dt > (o.life || 3)) return;
  const cols = o.cols || [C.blue, C.teal, C.amber, C.pink, C.violet, C.green];
  for (let i = 0; i < n; i++) {
    const a = hash(i * 3.1 + 1) * Math.PI * 2, v = (.35 + .65 * hash(i * 7.7 + 2)) * spread;
    const x = cx + Math.cos(a) * v * eo(dt / 1.2), y = cy + Math.sin(a) * v * eo(dt / 1.2) * .8 + 260 * dt * dt;
    const fade = 1 - seg(dt, (o.life || 3) * .55, o.life || 3);
    alpha(fade, () => at(x, y, 1, () => fillR(-9, -5, 18, 10, 3, cols[i % cols.length]), dt * (4 + hash(i) * 6)));
  }
}

// Mouse cursor (macOS-style arrow)
function cursor(x, y, s = 1, col = '#ffffff', label, lcol) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 34); g.lineTo(9, 26); g.lineTo(16, 41); g.lineTo(22, 38); g.lineTo(15, 23); g.lineTo(27, 23); g.closePath();
  g.fillStyle = col; g.fill(); g.shadowBlur = 0; g.strokeStyle = col === '#ffffff' ? '#111' : '#fff'; g.lineWidth = 2.5; g.stroke();
  if (label) { const w = tw(label, 24, 600) + 28; fillR(24, 40, w, 42, 12, lcol || col); T(label, 38, 70, 24, {w: 600, c: '#fff'}); }
  g.restore();
}
// Smooth wandering path for cursors: returns [x,y] at t
function wander(t, seed, x0, y0, w, h, sp = .25) { return [x0 + w * fbm(t * sp + seed * 13.7), y0 + h * fbm(t * sp * 1.13 + seed * 5.3 + 40)]; }

// Typed text helper: returns substring of str visible at time t
function typed(str, t, t0, cps = 18) { const n = Math.floor(clamp((t - t0) * cps, 0, str.length)); return str.slice(0, n); }
function caret(x, y, h, t, col = C.blue2) { if (fract(t * 1.6) < .6) fillR(x + 3, y - h * .82, 4, h, 2, col); }

// Count-up number with easing
const countTo = (t, t0, t1, a, b) => lerp(a, b, eo(seg(t, t0, t1)));

// ---------- video frames (pre-decoded jpg sequences) ----------
const VCACHE = new Map();
function vurl(key, idx) { const v = SHOT.videos[key]; if (!v) return null; const n = ((idx % v.count) + v.count) % v.count; return {url: v.url + 'f' + String(n + 1).padStart(5, '0') + '.jpg', id: key + ':' + n}; }
function needFrame(key, idx) { const u = vurl(key, idx); if (!u) return Promise.resolve(); if (VCACHE.has(u.id)) return VCACHE.get(u.id).p; const im = new Image(); const p = new Promise(r => { im.onload = r; im.onerror = r; }); im.src = u.url; VCACHE.set(u.id, {im, p}); if (VCACHE.size > 24) VCACHE.delete(VCACHE.keys().next().value); return p; }
function frameImg(key, idx) { const u = vurl(key, idx); return u && VCACHE.has(u.id) ? VCACHE.get(u.id).im : null; }
function drawCover(im, x, y, w, h, o = {}) {
  if (!im || !im.width) return;
  const s = Math.max(w / im.width, h / im.height) * (o.zoom || 1), dw = im.width * s, dh = im.height * s;
  g.drawImage(im, x + (w - dw) * (o.ax != null ? o.ax : .5), y + (h - dh) * (o.ay != null ? o.ay : .5), dw, dh);
}

// ---------- score analysis (clips with audio:true) ----------
function aBands(t) { const A = SHOT.audio; if (!A) return null; const i = clamp(Math.round(t * A.fps), 0, A.bands.length - 1); return A.bands[i]; }
function aVal(key, t, smooth = 0) { const A = SHOT.audio; if (!A) return 0; const arr = A[key]; let s = 0, n = 0; for (let k = -smooth; k <= smooth; k++) { const i = clamp(Math.round(t * A.fps) + k, 0, arr.length - 1); s += arr[i]; n++; } return s / n; }

// ---------- procedural "footage" (for editor previews, reels, thumbnails) ----------
// kind: 0 ocean sunset, 1 mountain dusk, 2 night city, 3 bokeh portrait, 4 desert road, 5 aurora
function footage(kind, x, y, w, h, t, o = {}) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const zoom = o.zoom || 1; g.translate(x + w / 2, y + h / 2); g.scale(zoom, zoom); g.translate(-(x + w / 2), -(y + h / 2));
  const hz = y + h * .58;
  if (kind === 0) {
    g.fillStyle = lin(0, y, 0, hz, [[0, '#1d2b6b'], [.5, '#c0508a'], [1, '#ffb066']]); g.fillRect(x, y, w, h);
    circle(x + w * .62, hz - h * .08 + Math.sin(t * .2) * 4, h * .12, '#ffe0a0');
    g.fillStyle = rad(x + w * .62, hz - h * .08, h * .5, [[0, 'rgba(255,200,120,.5)'], [1, 'rgba(255,200,120,0)']]); g.fillRect(x, y, w, h);
    for (let k = 0; k < 7; k++) {
      const yy = hz + k * h * .065;
      g.beginPath(); g.moveTo(x, y + h);
      for (let i = 0; i <= 40; i++) { const xx = x + w * i / 40; g.lineTo(xx, yy + Math.sin(i * .7 + t * (1.2 + k * .25) + k) * h * .012 * (1 + k * .4)); }
      g.lineTo(x + w, y + h); g.closePath(); g.fillStyle = mix('#3a3f8a', '#0b1030', k / 6); g.fill();
    }
    g.fillStyle = 'rgba(255,220,160,0.25)'; for (let i = 0; i < 12; i++) g.fillRect(x + w * .62 - w * .05 + hash(i) * w * .1 + Math.sin(t * 2 + i) * 6, hz + 6 + i * h * .025, w * .03, 3);
  } else if (kind === 1) {
    g.fillStyle = lin(0, y, 0, y + h, [[0, '#0d1b3d'], [.6, '#5b3a7a'], [1, '#e07a5f']]); g.fillRect(x, y, w, h);
    for (let L = 0; L < 4; L++) {
      const off = t * (6 + L * 10), base = y + h * (.45 + L * .13);
      g.beginPath(); g.moveTo(x, y + h);
      for (let i = 0; i <= 50; i++) { const xx = x + w * i / 50; g.lineTo(xx, base - h * .18 * fbm((xx + off) / w * 3 + L * 10)); }
      g.lineTo(x + w, y + h); g.closePath(); g.fillStyle = mix('#3b2d5e', '#07060f', L / 3); g.fill();
    }
  } else if (kind === 2) {
    g.fillStyle = lin(0, y, 0, y + h, [[0, '#05081a'], [1, '#1b1240']]); g.fillRect(x, y, w, h);
    const r = rng(5);
    for (let b = 0; b < 22; b++) {
      const bw = w * (.04 + r() * .05), bx = x + ((((b / 22) * w * 1.1 - t * w * .01) % (w * 1.1)) + w * 1.1) % (w * 1.1) - w * .05, bh = h * (.25 + r() * .45);
      g.fillStyle = '#0a0d22'; g.fillRect(bx, y + h * .8 - bh, bw, bh);
      for (let wy = 0; wy < 10; wy++) for (let wx = 0; wx < 3; wx++) if (hash(b * 100 + wy * 7 + wx + Math.floor(t * .5 + b) * 0) > .45) { g.fillStyle = hash(b + wy + wx * 3) > .5 ? 'rgba(255,200,110,.75)' : 'rgba(120,200,255,.6)'; g.fillRect(bx + bw * (.15 + wx * .28), y + h * .8 - bh + 8 + wy * bh / 11, bw * .14, bh / 22); }
    }
    g.fillStyle = '#05060f'; g.fillRect(x, y + h * .8, w, h * .2);
    for (let i = 0; i < 6; i++) { const u = fract(t * .35 + i / 6); fillR(x + u * w * 1.2 - w * .2, y + h * (.86 + (i % 2) * .05), w * .18, 5, 3, i % 2 ? 'rgba(255,60,80,.9)' : 'rgba(255,240,200,.9)'); }
  } else if (kind === 3) {
    g.fillStyle = lin(x, y, x + w, y + h, [[0, '#2b1236'], [1, '#0d2a3a']]); g.fillRect(x, y, w, h);
    for (let i = 0; i < 18; i++) { const bx = x + w * fract(hash(i) + t * .02 * (1 + hash(i + 3))), by = y + h * hash(i + 9), br = h * (.05 + .12 * hash(i + 4)); circle(bx, by, br, `hsla(${(hash(i + 2) * 80 + 300) % 360},90%,65%,.25)`); }
    // silhouette
    g.fillStyle = '#0a0612'; const cx = x + w * .42, cy = y + h * .5;
    g.beginPath(); g.arc(cx, cy - h * .1, h * .14, 0, Math.PI * 2); g.fill(); fillR(cx - h * .26, cy + h * .08, h * .52, h * .5, h * .2, '#0a0612');
    g.fillStyle = 'rgba(255,140,90,.55)'; g.beginPath(); g.arc(cx, cy - h * .1, h * .14, -Math.PI * .4, Math.PI * .4); g.lineWidth = 6; g.strokeStyle = 'rgba(255,150,100,.8)'; g.stroke();
  } else if (kind === 4) {
    g.fillStyle = lin(0, y, 0, hz, [[0, '#3a8fd8'], [1, '#f3c58a']]); g.fillRect(x, y, w, h);
    g.fillStyle = '#c9814a'; g.fillRect(x, hz, w, h);
    g.beginPath(); g.moveTo(x + w * .46, hz); g.lineTo(x + w * .54, hz); g.lineTo(x + w * .9, y + h); g.lineTo(x + w * .1, y + h); g.closePath(); g.fillStyle = '#3a3238'; g.fill();
    for (let i = 0; i < 6; i++) { const u = Math.pow(fract(i / 6 + t * .4), 2), yy = hz + u * (h * .42); fillR(x + w / 2 - 3 - u * 8, yy, 6 + u * 16, 4 + u * 30, 3, '#f3e2b0'); }
    g.fillStyle = '#8a4f33'; g.beginPath(); g.moveTo(x, hz); for (let i = 0; i <= 20; i++) g.lineTo(x + w * i / 20, hz - h * .1 * fbm(i * .4 + 3)); g.lineTo(x + w, hz); g.fill();
  } else {
    g.fillStyle = lin(0, y, 0, y + h, [[0, '#020617'], [1, '#0b1d2e']]); g.fillRect(x, y, w, h);
    for (let b = 0; b < 3; b++) {
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const xx = x + w * i / 40, yy = y + h * (.3 + b * .08) + Math.sin(i * .3 + t * .8 + b) * h * .06; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
      g.lineWidth = h * .09; g.strokeStyle = b === 1 ? 'rgba(160,90,255,.35)' : 'rgba(60,255,170,.35)'; g.stroke();
    }
    g.fillStyle = '#01030a'; g.beginPath(); g.moveTo(x, y + h); for (let i = 0; i <= 30; i++) g.lineTo(x + w * i / 30, y + h * .82 - h * .1 * fbm(i * .5)); g.lineTo(x + w, y + h); g.fill();
    for (let i = 0; i < 40; i++) circle(x + w * hash(i), y + h * .5 * hash(i + 50), 1.5 + hash(i + 7) * 1.5, `rgba(255,255,255,${.4 + .5 * noise(t * 2 + i)})`);
  }
  g.restore();
}
function waveform(x, y, w, h, seed, col, o = {}) {
  const n = Math.floor(w / (o.step || 5));
  g.fillStyle = col;
  for (let i = 0; i < n; i++) { const v = (.2 + .8 * fbm(i * .09 + seed * 17)) * (.5 + .5 * noise(i * .5 + seed)); const hh = Math.max(2, v * h); g.fillRect(x + i * (o.step || 5), y + (h - hh) / 2, (o.step || 5) - 2, hh); }
}
