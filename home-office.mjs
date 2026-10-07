import * as THREE from 'three';

// Architectural dimensions and prop positions are millimetres, never resized
// to make the larger desk fit. The open front is a viewing cutaway.
export const HOME_LAYOUTS = {
    apartment: { id: 'apartment', name: 'Apartment office', width: 2800, depth: 3200, height: 2600, back: -1050, desk: [0, -310],
        props: [
            { id: 'steelcase-leap-v2', at: [0, 0, 680], turn: 180 },
            { id: 'armchair-poppi', at: [690, 0, 1450], turn: -140 },
            { id: 'journal', at: [80, 451, 1870], turn: 15 },
            { id: 'ficus', at: [-1110, 0, -710] },
            { id: 'modern-lamp', at: [990, 741, -850] }
        ] },
    house: { id: 'house', name: 'Dedicated home office', width: 3600, depth: 4200, height: 2700, back: -1450, desk: [-160, -540],
        props: [
            { id: 'steelcase-leap-v2', at: [-160, 0, 460], turn: 180 },
            { id: 'armchair-poppi', at: [-1150, 0, 1820], turn: 145 },
            { id: 'journal', at: [-475, 451, 2100], turn: -12 },
            { id: 'monstera', at: [1300, 0, 2090] },
            { id: 'ficus', at: [-1470, 0, -1090] },
            { id: 'modern-lamp', at: [1260, 741, -1250] }
        ] }
};
// Room choice is independent of desktop size. Furnishings keep their real size.
Object.assign(HOME_LAYOUTS, {
    spacious: { id: 'spacious', name: 'Spacious home office', width: 4200, depth: 4800, height: 2800, back: -1600, desk: [-300, -600], table: [-650, 2260],
        props: [
            { id: 'steelcase-leap-v2', at: [-300, 0, 450], turn: 180 },
            { id: 'armchair-poppi', at: [-1420, 0, 1970], turn: 145 },
            { id: 'journal', at: [-650, 451, 2260], turn: -12 },
            { id: 'monstera', at: [1600, 0, 2560] },
            { id: 'ficus', at: [-1750, 0, -1210] },
            { id: 'modern-lamp', at: [1560, 741, -1400] }
        ] },
    premium: { id: 'premium', name: 'Premium home office', width: 5200, depth: 5800, height: 3000, back: -1850, desk: [-450, -700], table: [-1100, 2550],
        props: [
            { id: 'steelcase-leap-v2', at: [-450, 0, 350], turn: 180 },
            { id: 'armchair-poppi', at: [-1900, 0, 2190], turn: 145 },
            { id: 'journal', at: [-1100, 451, 2550], turn: -12 },
            { id: 'sofa-fabric', at: [650, 0, 3130], turn: 180 },
            { id: 'monstera', at: [2070, 0, 3100] },
            { id: 'ficus', at: [-2160, 0, -1450] },
            { id: 'modern-lamp', at: [2060, 741, -1650] }
        ] },
    executive: { id: 'executive', name: 'Executive office suite', width: 6500, depth: 7000, height: 3200, back: -2200, desk: [-650, -850], table: [-1630, 3000],
        props: [
            { id: 'steelcase-leap-v2', at: [-650, 0, 250], turn: 180 },
            { id: 'armchair-poppi', at: [-2460, 0, 2590], turn: 145 },
            { id: 'armchair-poppi', at: [-2410, 0, 3880], turn: 35 },
            { id: 'journal', at: [-1630, 451, 3000], turn: -12 },
            { id: 'sofa-fabric', at: [850, 0, 3820], turn: 180 },
            { id: 'monstera', at: [2630, 0, 3980] },
            { id: 'ficus', at: [-2720, 0, -1750] },
            { id: 'modern-lamp', at: [2650, 741, -2000] }
        ] }
});
// New library accents keep their physical dimensions in every room. Append
// defaults so existing scene-asset keys and saved edits keep their identities.
for (const layout of Object.values(HOME_LAYOUTS)) {
    const apartment = layout.id === 'apartment';
    const cx = apartment ? 995 : layout.width / 2 - 570;
    const chair = layout.props.find(p => p.id === 'armchair-poppi');
    layout.readingLight = apartment ? [-430, 1870] : [-layout.width / 2 + 220, chair.at[2] + 680];
    layout.props.push(
        { id: 'kenney-furniture-books', at: [cx - 80, 1384, layout.back + 110] },
        { id: 'kenney-furniture-plant-small1', at: [cx + 40, 1784, layout.back + 110] },
        { id: 'kenney-furniture-lamp-round-floor', at: [layout.readingLight[0], 0, layout.readingLight[1]] }
    );
    if (!apartment) {
        layout.props.find(p => p.id === 'modern-lamp').at[0] = cx + 200;
        layout.props.push(
            { id: 'kenney-furniture-kitchen-coffee-machine', at: [cx - 220, 741, layout.back + 190] },
            { id: 'quaternius-guitar', at: [-layout.width / 2 + 85, 650, 150], turn: 90, on: 'wall' }
        );
    }
}
export const homeLayoutForSize = size => HOME_LAYOUTS[size === '60x30' ? 'house' : 'apartment'];
export const homeLayoutById = id => HOME_LAYOUTS[id] || HOME_LAYOUTS.apartment;

export const HOME_MODES = {
    morning: { label: 'Morning', description: 'Fresh daylight · standing work', key: '#ffe8c4', fill: '#d9e8ff', accent: '#ffd6a4', power: 1.85, ambient: .4, bounce: .66, exposure: 1.05, sky: ['#8dbfe2', '#fde4c2'], practical: .12, height: 43.5, tilt: -5, offset: [0, 0], yaw: 0, leds: false },
    afternoon: { label: 'Afternoon', description: 'Soft daylight · seated focus', key: '#fff3dd', fill: '#e4edf6', accent: '#ffd1a1', power: 1.35, ambient: .42, bounce: .65, exposure: 1.08, sky: ['#8cb9d8', '#f4ecdc'], practical: .3, height: 28, tilt: 0, offset: [0, 0], yaw: 0, leds: false },
    evening: { label: 'Evening', description: 'Golden hour · reading and planning', key: '#ffaa66', fill: '#bdc5e6', accent: '#ffbd80', power: .82, ambient: .24, bounce: .4, exposure: 1.1, sky: ['#5a6795', '#f6a066'], practical: 1.05, height: 28, tilt: 12, offset: [0, 80], yaw: -4, leds: true, color: '#ffd29b' },
    night: { label: 'Night', description: 'Warm task lamps · quiet late work', key: '#a7bde8', fill: '#a3b7de', accent: '#ffc883', power: .18, ambient: .15, bounce: .22, exposure: 1.15, sky: ['#0d1630', '#2a3d62'], practical: 1.35, height: 28, tilt: 0, offset: [0, 120], yaw: 0, leds: true, color: '#ffe1ad' },
    party: { label: 'Party', description: 'Color accents · desk turned toward the room', key: '#b7caff', fill: '#a99cf0', accent: '#f08bcd', power: .3, ambient: .18, bounce: .25, exposure: 1.1, sky: ['#191a44', '#4a3570'], practical: .75, height: 43.5, tilt: 0, offset: [50, 200], yaw: -12, leds: true, color: '#bb70ff' }
};
// Window view, practical fixtures and textiles per daypart. Emissive and
// canvas changes only: no extra real-time lights or shadow maps.
const HOME_LOOKS = {
    morning: { sun: [.18, .5, '#fff0cc', 1], hills: '#a9bec8', trees: '#7c9a87', walls: '#dccdb8', roofs: '#9d7b66', lit: 0, shade: .2, fairy: 0, strip: 0, time: [7, 50] },
    afternoon: { sun: [.82, .12, '#fffaf0', .7], hills: '#a2b9c0', trees: '#6f8e78', walls: '#ddd0bb', roofs: '#9b7662', lit: 0, shade: .1, fairy: 0, strip: 0, time: [14, 35] },
    evening: { sun: [.7, .64, '#ffab62', 1.25], hills: '#8f7790', trees: '#585163', walls: '#a5857b', roofs: '#6a4e50', lit: .3, shade: .32, fairy: .85, strip: .75, time: [18, 40] },
    night: { moon: [.76, .2], hills: '#1c2843', trees: '#111a2d', walls: '#1c2638', roofs: '#121927', lit: .55, shade: .58, fairy: 1, strip: 1, time: [23, 20] },
    party: { moon: [.22, .18], hills: '#29254f', trees: '#181632', walls: '#242346', roofs: '#16152d', lit: .75, shade: .48, fairy: 1, strip: 1.2, time: [21, 15], party: true }
};

// Deterministic original surface patterns: stable across room switches and
// downloadable projects, with no network textures or additional asset loads.
function texture(draw, width = 512, height = 512) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function random(seed = 19) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
// Wide-plank oak: individual boards, staggered butt joints, cathedral grain
// and the occasional knot, so the floor never reads as a printed stripe.
function oakTexture() {
    return texture((ctx, w, h) => {
        const r = random(), tones = ['#c09a70', '#c9a77f', '#b88f68', '#ceac85', '#bd9871', '#c4a079'], pw = w / 4;
        for (let p = 0; p < 4; p++) {
            const x = p * pw, joints = [0, (.15 + p * .23 + r() * .1) % .5 * h + h * .05, h * (.55 + r() * .35), h];
            for (let s = 0; s < 3; s++) {
                const y0 = joints[s], y1 = joints[s + 1];
                ctx.save(); ctx.beginPath(); ctx.rect(x, y0, pw, y1 - y0); ctx.clip();
                ctx.fillStyle = tones[Math.floor(r() * tones.length)]; ctx.fillRect(x, y0, pw, y1 - y0);
                const sheen = ctx.createLinearGradient(x, 0, x + pw, 0);
                sheen.addColorStop(0, 'rgba(70,45,22,.08)'); sheen.addColorStop(.5, 'rgba(255,240,215,.06)'); sheen.addColorStop(1, 'rgba(70,45,22,.1)');
                ctx.fillStyle = sheen; ctx.fillRect(x, y0, pw, y1 - y0);
                for (let n = 0; n < 70; n++) {
                    const gx = x + r() * pw;
                    ctx.strokeStyle = `rgba(76,48,25,${.02 + r() * .07})`; ctx.lineWidth = .5 + r(); ctx.beginPath();
                    ctx.moveTo(gx, y0); ctx.bezierCurveTo(gx + 6, y0 + (y1 - y0) / 3, gx - 9, y0 + (y1 - y0) * .7, gx + 3, y1); ctx.stroke();
                }
                if (r() > .35) {
                    const cx = x + pw * (.35 + r() * .3), tip = y0 + (y1 - y0) * (.25 + r() * .4);
                    for (let k = 0; k < 7; k++) {
                        ctx.strokeStyle = `rgba(92,58,30,${.08 + k * .012})`; ctx.lineWidth = 1.2; ctx.beginPath();
                        ctx.moveTo(cx - 8 - k * 7, y1); ctx.quadraticCurveTo(cx, tip + k * 26 - 60, cx + 8 + k * 7, y1); ctx.stroke();
                    }
                }
                if (r() > .7) {
                    const kx = x + pw * (.2 + r() * .6), ky = y0 + (y1 - y0) * r();
                    ctx.fillStyle = 'rgba(80,50,26,.45)'; ctx.beginPath(); ctx.ellipse(kx, ky, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'rgba(80,50,26,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(kx, ky, 9, 16, 0, 0, Math.PI * 2); ctx.stroke();
                }
                ctx.restore();
                ctx.fillStyle = 'rgba(52,36,20,.32)'; ctx.fillRect(x, y0 - 1, pw, 2);
            }
            ctx.fillStyle = 'rgba(52,36,20,.34)'; ctx.fillRect(x, 0, 2, h);
            ctx.fillStyle = 'rgba(255,238,210,.12)'; ctx.fillRect(x + 2, 0, 1, h);
        }
    }, 512, 1024);
}
// Hand-finished limewash: soft mottling that keeps large walls from reading flat.
function limewashTexture() {
    return texture((c, w, h) => {
        c.fillStyle = '#e9e0d0'; c.fillRect(0, 0, w, h);
        const r = random(41);
        for (let i = 0; i < 150; i++) {
            const x = r() * w, y = r() * h, rad = 30 + r() * 110, g = c.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, r() > .5 ? 'rgba(255,251,242,.14)' : 'rgba(150,120,90,.06)'); g.addColorStop(1, 'rgba(150,120,90,0)');
            c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
    });
}
// Hand-knotted wool rug: cream field, wobbly charcoal lattice, clay border.
function rugTexture() {
    return texture((c, w, h) => {
        const r = random(7);
        c.fillStyle = '#e3d9c4'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 14000; i++) { c.fillStyle = `rgba(${r() > .5 ? '255,250,240' : '120,100,76'},${.05 + r() * .08})`; c.fillRect(r() * w, r() * h, 2, 2); }
        c.strokeStyle = '#7d5f48'; c.lineWidth = 16; c.strokeRect(34, 34, w - 68, h - 68);
        c.strokeStyle = '#b8724f'; c.lineWidth = 6; c.strokeRect(66, 66, w - 132, h - 132);
        c.save(); c.beginPath(); c.rect(84, 84, w - 168, h - 168); c.clip();
        c.strokeStyle = 'rgba(58,48,40,.5)'; c.lineWidth = 5; c.lineJoin = 'round';
        const wobble = (x0, y0, x1, y1) => {
            c.beginPath(); c.moveTo(x0, y0);
            for (let s = 1; s <= 24; s++) { const t = s / 24; c.lineTo(x0 + (x1 - x0) * t + (r() - .5) * 7, y0 + (y1 - y0) * t + (r() - .5) * 7); }
            c.stroke();
        };
        for (let i = -h; i < w + h; i += 150) { wobble(i, 0, i + h, h); wobble(i, h, i + h, 0); }
        c.fillStyle = 'rgba(184,114,79,.75)';
        for (let i = -h; i < w + h; i += 150) for (let y = 75; y < h; y += 150) {
            const x = i + y; if (x < 0 || x > w) continue;
            c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 10, y); c.lineTo(x, y + 14); c.lineTo(x - 10, y); c.fill();
        }
        c.restore();
    }, 1024, 1024);
}
function juteTexture() {
    return texture((c, w, h) => {
        c.fillStyle = '#c3a87f'; c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
            const on = ((x + y) / 8) % 2;
            c.fillStyle = on ? 'rgba(255,240,205,.16)' : 'rgba(95,70,40,.18)';
            c.fillRect(x + (on ? 0 : 1), y + (on ? 1 : 0), on ? 8 : 6, on ? 6 : 8);
        }
    }, 256, 256);
}
// Shaker profile painted into the door face: a recessed panel, lit from above.
function panelTexture(base, panels = [[.11, .07, .89, .93]], width = 256, height = 512) {
    return texture((c, w, h) => {
        c.fillStyle = base; c.fillRect(0, 0, w, h);
        for (const [x0, y0, x1, y1] of panels) {
            const x = x0 * w, y = y0 * h, pw = (x1 - x0) * w, ph = (y1 - y0) * h;
            c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(x, y, pw, ph);
            c.fillStyle = 'rgba(30,24,18,.32)'; c.fillRect(x, y, pw, 4); c.fillRect(x, y, 4, ph);
            c.fillStyle = 'rgba(255,250,235,.26)'; c.fillRect(x, y + ph - 4, pw, 4); c.fillRect(x + pw - 4, y, 4, ph);
            c.fillStyle = 'rgba(255,250,235,.12)'; c.fillRect(x + 12, y + 12, pw - 24, 3);
        }
    }, width, height);
}
function artTexture() {
    return texture((c, w, h) => {
        c.fillStyle = '#eee6d8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#b47d5f'; c.beginPath(); c.arc(w * .65, h * .35, w * .22, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#607768'; c.beginPath(); c.moveTo(0, h * .63); c.bezierCurveTo(w * .45, h * .25, w * .6, h * .92, w, h * .53); c.lineTo(w, h); c.lineTo(0, h); c.fill();
        c.strokeStyle = '#dbcaaf'; c.lineWidth = 6;
        for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(w * .34, h * .82, 80 + i * 18, Math.PI, Math.PI * 2); c.stroke(); }
    }, 512, 640);
}
function botanicalTexture() {
    return texture((c, w, h) => {
        c.fillStyle = '#efe8d8'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#5f7562'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * .5, h * .9); c.bezierCurveTo(w * .42, h * .6, w * .6, h * .35, w * .5, h * .1); c.stroke();
        for (let i = 0; i < 9; i++) {
            const t = .15 + i * .085, side = i % 2 ? 1 : -1, x = w * (.5 + Math.sin(t * 6) * .04), y = h * (.9 - t * .85);
            c.save(); c.translate(x, y); c.rotate(side * (.9 - t * .3)); c.fillStyle = i % 3 ? '#6f8a6c' : '#879d7f';
            c.beginPath(); c.ellipse(0, -30 + t * 8, 13 - t * 4, 34 - t * 10, 0, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(239,232,216,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -58); c.stroke(); c.restore();
        }
        c.fillStyle = '#7d6a55'; c.font = 'italic 15px serif'; c.textAlign = 'center'; c.fillText('Olea europaea', w / 2, h * .965);
    }, 256, 320);
}
function photoTexture() {
    return texture((c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h * .62); g.addColorStop(0, '#9fb8cc'); g.addColorStop(1, '#f2c08e');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = '#fbe3b8'; c.beginPath(); c.arc(w * .62, h * .55, 26, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7d8f8a'; c.beginPath(); c.moveTo(0, h * .6); c.quadraticCurveTo(w * .3, h * .46, w * .55, h * .6); c.fill();
        c.fillStyle = '#4f6f80'; c.fillRect(0, h * .6, w, h * .4);
        c.fillStyle = 'rgba(251,227,184,.55)'; for (let i = 0; i < 9; i++) c.fillRect(w * .5 + (i % 3) * 14 - 10, h * (.63 + i * .035), 30 - i * 2, 3);
        c.fillStyle = '#e6d6b8'; c.fillRect(0, h * .88, w, h * .12);
        c.fillStyle = '#3b3b3a'; c.fillRect(w * .26, h * .74, 8, 40); c.fillRect(w * .31, h * .76, 7, 36);
    }, 256, 320);
}
// Personal work board: calendar, photos and notes pinned to cork.
function pinboardTexture() {
    return texture((c, w, h) => {
        const r = random(5);
        c.fillStyle = '#b98d5f'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 9000; i++) { c.fillStyle = r() > .5 ? `rgba(90,58,30,${.1 + r() * .25})` : `rgba(235,200,150,${.1 + r() * .2})`; c.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
        const card = (x, y, cw, ch, angle, fill, draw, pin = '#c4493d') => {
            c.save(); c.translate(x, y); c.rotate(angle);
            c.shadowColor = 'rgba(40,24,10,.38)'; c.shadowBlur = 10; c.shadowOffsetX = 3; c.shadowOffsetY = 5;
            c.fillStyle = fill; c.fillRect(-cw / 2, -ch / 2, cw, ch); c.shadowColor = 'transparent';
            draw?.(cw, ch);
            c.fillStyle = pin; c.beginPath(); c.arc(0, -ch / 2 + 14, 9, 0, Math.PI * 2); c.fill();
            c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(-3, -ch / 2 + 11, 3, 0, Math.PI * 2); c.fill();
            c.restore();
        };
        const lines = (cw, ch, color, top, n, gap = 22) => { c.strokeStyle = color; c.lineWidth = 3; for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(-cw / 2 + 16, -ch / 2 + top + i * gap); c.lineTo(cw / 2 - 16 - (i * 37 % 50), -ch / 2 + top + i * gap); c.stroke(); } };
        card(200, 330, 300, 380, -.02, '#f7f3ea', (cw, ch) => {
            c.fillStyle = '#b8724f'; c.fillRect(-cw / 2, -ch / 2, cw, 70);
            c.fillStyle = '#fff6ea'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('OCTOBER', 0, -ch / 2 + 50);
            c.strokeStyle = 'rgba(60,60,60,.35)'; c.lineWidth = 1.5;
            for (let i = 0; i <= 7; i++) { c.beginPath(); c.moveTo(-cw / 2 + 15 + i * 38.5, -ch / 2 + 90); c.lineTo(-cw / 2 + 15 + i * 38.5, ch / 2 - 15); c.stroke(); }
            for (let j = 0; j <= 5; j++) { c.beginPath(); c.moveTo(-cw / 2 + 15, -ch / 2 + 90 + j * 55); c.lineTo(cw / 2 - 15, -ch / 2 + 90 + j * 55); c.stroke(); }
            c.strokeStyle = '#c4493d'; c.lineWidth = 3;
            for (const [i, j] of [[2, 1], [5, 2], [1, 3]]) { c.beginPath(); c.arc(-cw / 2 + 34 + i * 38.5, -ch / 2 + 117 + j * 55, 16, 0, Math.PI * 2); c.stroke(); }
        }, '#3f6fb0');
        const polaroid = (x, y, angle, sky, ground, pin) => card(x, y, 150, 180, angle, '#fbfaf6', (cw, ch) => {
            const g = c.createLinearGradient(0, -ch / 2 + 12, 0, ch / 2 - 40); g.addColorStop(0, sky); g.addColorStop(1, ground);
            c.fillStyle = g; c.fillRect(-cw / 2 + 12, -ch / 2 + 12, cw - 24, cw - 24);
            c.fillStyle = ground; c.beginPath(); c.moveTo(-cw / 2 + 12, 10); c.quadraticCurveTo(0, -20, cw / 2 - 12, 15); c.lineTo(cw / 2 - 12, ch / 2 - 42); c.lineTo(-cw / 2 + 12, ch / 2 - 42); c.fill();
        }, pin);
        polaroid(470, 180, .08, '#9cc0d8', '#6f8f6c', '#e0b33a');
        polaroid(640, 210, -.06, '#f2b886', '#5c6f84', '#3f6fb0');
        polaroid(860, 520, .05, '#d5e3ea', '#c79a74', '#c4493d');
        card(560, 470, 125, 125, -.07, '#f3d468', (cw, ch) => lines(cw, ch, 'rgba(60,55,40,.6)', 40, 4));
        card(710, 470, 125, 125, .09, '#f2a99f', (cw, ch) => lines(cw, ch, 'rgba(70,40,40,.55)', 40, 3));
        card(870, 190, 160, 125, .04, '#a9d6bb', (cw, ch) => { lines(cw, ch, 'rgba(30,60,45,.55)', 38, 3); }, '#e0b33a');
        card(470, 590, 230, 150, .03, '#ece2cf', (cw, ch) => {
            c.fillStyle = '#7d9fb4'; c.fillRect(cw / 2 - 58, -ch / 2 + 14, 42, 50);
            lines(cw, ch, 'rgba(70,60,50,.5)', 60, 3, 24);
        }, '#3f6fb0');
    }, 1024, 704);
}
function shadeTexture() {
    return texture((c, w, h) => {
        c.fillStyle = '#e8dfcf'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 2000; i++) { c.fillStyle = 'rgba(120,100,80,.05)'; c.fillRect((i * 37) % w, (i * 53) % h, 2, 1); }
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(90,70,50,.0)'); g.addColorStop(.78, 'rgba(90,70,50,.08)'); g.addColorStop(.94, 'rgba(90,70,50,.28)'); g.addColorStop(1, 'rgba(255,250,240,.2)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 128, 128);
}
function wovenTexture() {
    return texture((c, w, h) => {
        c.fillStyle = '#9e7a4c'; c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
            const on = ((x + y) / 16) % 2, g = c.createLinearGradient(x, y, on ? x + 16 : x, on ? y : y + 16);
            g.addColorStop(0, '#a7824f'); g.addColorStop(.5, '#d0ad78'); g.addColorStop(1, '#a07a48');
            c.fillStyle = g; c.fillRect(x + 1, y + 1, 14, 14);
        }
    }, 128, 128);
}
function knitTexture(base) {
    return texture((c, w, h) => {
        c.fillStyle = base; c.fillRect(0, 0, w, h);
        c.lineWidth = 4;
        for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
            c.strokeStyle = 'rgba(255,240,225,.22)'; c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + 8, y + 14); c.lineTo(x + 14, y + 2); c.stroke();
            c.strokeStyle = 'rgba(60,25,15,.2)'; c.beginPath(); c.moveTo(x + 8, y + 15); c.lineTo(x + 8, y + 16); c.stroke();
        }
    }, 128, 128);
}
// A soft vertical light fall-off for under-shelf strips, blended additively.
function washTexture() {
    const t = texture((c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        const edge = c.createLinearGradient(0, 0, w, 0); edge.addColorStop(0, 'rgba(0,0,0,1)'); edge.addColorStop(.18, 'rgba(0,0,0,0)'); edge.addColorStop(.82, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,1)');
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = edge; c.fillRect(0, 0, w, h);
    }, 128, 128);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
// Garden and rooftops outside the window, repainted for each daypart.
function paintView(c, W, H, mode, look) {
    const r = random(73);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mode.sky[0]); g.addColorStop(.7, mode.sky[1]); g.addColorStop(1, mode.sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (look.sun) {
        const [sx, sy, col, power] = look.sun, x = sx * W, y = sy * H, halo = c.createRadialGradient(x, y, 0, x, y, H * .55 * power);
        halo.addColorStop(0, `rgba(${rgb(col)},.9)`); halo.addColorStop(.12, `rgba(${rgb(col)},.45)`); halo.addColorStop(1, `rgba(${rgb(col)},0)`);
        c.fillStyle = halo; c.fillRect(0, 0, W, H);
        c.fillStyle = `rgba(${rgb(col)},1)`; c.beginPath(); c.arc(x, y, H * .035 * power, 0, Math.PI * 2); c.fill();
        const tint = look.sun[1] > .4 ? '255,214,190' : '255,255,255';
        for (let i = 0; i < 6; i++) {
            const cx = r() * W, cy = H * (.1 + r() * .32), s = 18 + r() * 26;
            c.fillStyle = `rgba(${tint},${.35 + r() * .25})`;
            for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(cx + (k - 2.5) * s * .7, cy + Math.sin(k * 1.7) * s * .25, s * (.7 + (k % 3) * .2), s * .45, 0, 0, Math.PI * 2); c.fill(); }
        }
    } else {
        for (let i = 0; i < 110; i++) { c.fillStyle = `rgba(255,248,230,${.25 + r() * .7})`; const s = r() > .9 ? 2.4 : 1.4; c.fillRect(r() * W, r() * H * .58, s, s); }
        const [mx, my] = look.moon, glow = c.createRadialGradient(mx * W, my * H, 0, mx * W, my * H, H * .2);
        glow.addColorStop(0, 'rgba(230,236,255,.35)'); glow.addColorStop(1, 'rgba(230,236,255,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
        c.fillStyle = '#f2eedc'; c.beginPath(); c.arc(mx * W, my * H, H * .04, 0, Math.PI * 2); c.fill();
        c.fillStyle = mode.sky[0]; c.beginPath(); c.arc(mx * W + H * .018, my * H - H * .01, H * .036, 0, Math.PI * 2); c.fill();
    }
    const ridge = (base, amp, color, f) => {
        c.fillStyle = color; c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) c.lineTo(x, H * (base + amp * Math.sin(x * f + 1.3) + amp * .5 * Math.sin(x * f * 3.1)));
        c.lineTo(W, H); c.fill();
    };
    ridge(.64, .025, look.hills, .011);
    c.fillStyle = look.trees;
    for (let x = -10; x < W + 20; x += 9 + r() * 10) { const s = 12 + r() * 20; c.beginPath(); c.arc(x, H * .74 - r() * 14 - s * .4, s, 0, Math.PI * 2); c.fill(); }
    c.fillRect(0, H * .72, W, H * .28);
    let x = -20 + r() * 20;
    while (x < W) {
        const bw = 60 + r() * 50, bh = 45 + r() * 45, base = H * (.9 + r() * .03);
        c.fillStyle = look.walls; c.fillRect(x, base - bh, bw, bh + H * .1);
        c.fillStyle = look.roofs; c.beginPath(); c.moveTo(x - 6, base - bh); c.lineTo(x + bw / 2, base - bh - 26 - r() * 14); c.lineTo(x + bw + 6, base - bh); c.fill();
        for (let k = 0; k < 2 + (bw > 85); k++) {
            const on = r() < look.lit;
            c.fillStyle = on ? (look.party ? ['#ff9bd6', '#9ad6ff', '#ffd27f'][k % 3] : '#ffd58a') : `rgba(40,52,64,${look.lit ? .7 : .45})`;
            c.fillRect(x + 10 + k * 26, base - bh * .62, 14, 18);
        }
        x += bw + 14 + r() * 36;
    }
    c.fillStyle = look.trees; c.fillRect(0, H * .95, W, H * .05);
}
function paintClock(c, S, [hours, minutes]) {
    c.fillStyle = '#f1ead9'; c.fillRect(0, 0, S, S);
    c.save(); c.translate(S / 2, S / 2);
    for (let i = 0; i < 60; i++) {
        const a = i / 60 * Math.PI * 2, major = i % 5 === 0;
        c.strokeStyle = major ? '#2c3732' : 'rgba(44,55,50,.55)'; c.lineWidth = major ? 6 : 2;
        c.beginPath(); c.moveTo(Math.sin(a) * S * (major ? .36 : .41), -Math.cos(a) * S * (major ? .36 : .41)); c.lineTo(Math.sin(a) * S * .45, -Math.cos(a) * S * .45); c.stroke();
    }
    c.lineCap = 'round';
    const hand = (angle, length, width, color) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(-Math.sin(angle) * S * .05, Math.cos(angle) * S * .05); c.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length); c.stroke(); };
    hand(((hours % 12) + minutes / 60) / 12 * Math.PI * 2, S * .24, 9, '#2c3732');
    hand(minutes / 60 * Math.PI * 2, S * .36, 6, '#2c3732');
    hand((minutes * 7 % 60) / 60 * Math.PI * 2, S * .4, 2, '#b8573e');
    c.fillStyle = '#a88a55'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
    c.restore();
}

export function buildHomeOffice(room, root, layout, helpers) {
    const { material, mesh, box, rod, sphere } = helpers;
    const { width: w, depth: d, height: h, back: bz } = layout;
    const front = bz + d, house = layout.id !== 'apartment', premium = ['premium', 'executive'].includes(layout.id);
    // Small dressing keeps its contact shadow but skips the shadow-map pass.
    const deco = obj => { obj.castShadow = false; return obj; };
    const wallMap = limewashTexture();
    const wallMat = material('#ffffff', { map: wallMap, roughness: .95 }), trim = material('#ece6da', { roughness: .6 }), oakMap = oakTexture();
    oakMap.repeat.set(w / 800, d / 1600);
    const oak = material('#ffffff', { map: oakMap, roughness: .72 });
    const joinery = material('#b89971', { roughness: .7 }), sage = material('#647769', { roughness: .72 }), brass = material('#b49561', { metalness: .75, roughness: .32 });
    const paint = material('#c8b396', { roughness: .82 }), clay = material('#b46e4e', { roughness: .85 }), ceramic = material('#ece5d8', { roughness: .35 });
    const lampGlow = material('#efe3cb', { emissive: '#ffcf8f', emissiveIntensity: 0, roughness: .95, side: THREE.DoubleSide });
    const leaf = material('#ffffff', { roughness: .6 }), ink = material('#2c3430', { metalness: .4, roughness: .5 });
    box(root, [w, 30, d], [0, -15, bz + d / 2], oak);
    const rugMap = rugTexture(), juteMap = juteTexture(); juteMap.repeat.set(5, 5);
    const rugMat = material('#ffffff', { map: rugMap, roughness: 1 }), jute = material('#ffffff', { map: juteMap, roughness: 1 });
    box(root, [house ? 2250 : 1800, 5, house ? 2250 : 1900], [layout.desk[0], 2.5, house ? 270 : 480], rugMat, 6);
    if (house) box(root, [1550, 5, 1350], [-970, 2.5, 1910], jute, 8);
    const tableAt = layout.table || (house ? [-475, 2100] : [80, 1870]);
    const table = new THREE.Group(); table.name = 'Reading side table'; root.add(table);
    mesh(table, new THREE.CylinderGeometry(230, 230, 25, 40), joinery, [tableAt[0], 437.5, tableAt[1]]);
    mesh(table, new THREE.CylinderGeometry(75, 95, 415, 32), joinery, [tableAt[0], 217.5, tableAt[1]]);
    mesh(table, new THREE.CylinderGeometry(150, 150, 10, 32), joinery, [tableAt[0], 5, tableAt[1]]);

    // Painted board-and-batten wainscot with a continuous rail, built per wall
    // so it disappears with its cutaway. Battens are one instanced batch.
    const runs = (from, to, gaps) => {
        const out = []; let start = from;
        for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) { if (a > start) out.push([start, Math.min(a, to)]); start = Math.max(start, b); }
        if (start < to) out.push([start, to]); return out;
    };
    const wainscot = (wall, from, to, along, at, gaps = [], skip = [], corner = 0) => {
        const size = (len, depth, height) => along === 'x' ? [len, height, depth] : [depth, height, len];
        const battens = [], m = new THREE.Matrix4();
        for (const [a, b] of runs(from, to, gaps)) {
            const len = b - a, mid = (a + b) / 2;
            deco(box(wall, size(len, 10, 690), [...at(mid, 5, 430)], paint));
            deco(box(wall, size(len, 30, 34 - corner), [...at(mid, 15, 785)], trim));
            const count = Math.max(1, Math.round(len / 430));
            for (let i = 1; i < count; i++) { const u = a + len * i / count; if (!skip.some(([p, q]) => u > p - 40 && u < q + 40)) battens.push(u); }
        }
        if (!battens.length) return;
        const geo = new THREE.BoxGeometry(...size(55, 14, 680)), inst = new THREE.InstancedMesh(geo, paint, battens.length);
        battens.forEach((u, i) => inst.setMatrixAt(i, m.makeTranslation(...at(u, 17, 425))));
        inst.receiveShadow = true; inst.computeBoundingSphere(); inst.name = 'Wainscot battens'; wall.add(inst);
    };
    const crown = (wall, size, position) => deco(box(wall, size, position, trim));

    // Four wall sections frame a genuine opening, rather than a luminous pane
    // placed on an opaque wall. Window orientation stays tied to the room.
    const back = new THREE.Group(); back.name = 'Window wall'; root.add(back);
    const ww = premium ? 2400 : house ? 1700 : 1250, wx = premium ? -900 : house ? -670 : -520, bottom = 850, wh = premium ? 1750 : 1400;
    const left = wx - ww / 2, right = wx + ww / 2;
    box(back, [left + w / 2, h, 80], [(left - w / 2) / 2, h / 2, bz - 40], wallMat);
    box(back, [w / 2 - right, h, 80], [(right + w / 2) / 2, h / 2, bz - 40], wallMat);
    box(back, [ww, bottom, 80], [wx, bottom / 2, bz - 40], wallMat);
    box(back, [ww, h - bottom - wh, 80], [wx, (h + bottom + wh) / 2, bz - 40], wallMat);
    box(back, [w, 85, 18], [0, 42.5, bz + 9], trim);
    crown(back, [w, 60, 55], [0, h - 30, bz + 27.5]);
    const cx = house ? w / 2 - 570 : 995, cw = house ? 920 : 550;
    wainscot(back, -w / 2 + 10, w / 2 - 10, 'x', (u, inset, y) => [u, y, bz + inset], [], [[cx - cw / 2, cx + cw / 2]]);
    const skyCanvas = document.createElement('canvas'); skyCanvas.width = Math.min(1024, Math.round(512 * ww / wh)); skyCanvas.height = 512;
    const skyMap = new THREE.CanvasTexture(skyCanvas); skyMap.colorSpace = THREE.SRGBColorSpace;
    const sky = box(back, [ww, wh, 8], [wx, bottom + wh / 2, bz - 65], new THREE.MeshBasicMaterial({ map: skyMap }));
    sky.castShadow = false; sky.receiveShadow = false;
    for (const x of [left, wx, right]) box(back, [35, wh + 65, 65], [x, bottom + wh / 2, bz + 8], trim);
    for (const y of [bottom, bottom + wh / 2, bottom + wh]) box(back, [ww + 65, 35, 65], [wx, y, bz + 8], trim);
    box(back, [ww + 120, 35, 150], [wx, bottom - 25, bz + 50], joinery, 3);
    // Linen roman shade inside the reveal; it is lowered as the day ends.
    const shadeMap = shadeTexture(), romanShade = new THREE.Group(); romanShade.name = 'Window roman shade'; back.add(romanShade);
    deco(box(romanShade, [ww - 40, 30, 26], [wx, bottom + wh - 32, bz - 48], joinery));
    const blind = deco(mesh(romanShade, new THREE.BoxGeometry(ww - 50, 1, 8).translate(0, -.5, 0), material('#ffffff', { map: shadeMap, roughness: 1 }), [wx, bottom + wh - 46, bz - 48]));
    rod(back, [left - 190, bottom + wh + 120, bz + 105], [right + 190, bottom + wh + 120, bz + 105], 12, brass);
    for (const x of [left - 190, right + 190]) deco(sphere(back, [22, 22, 22], [x, bottom + wh + 120, bz + 105], brass));
    const linen = material('#ece5d6', { side: THREE.DoubleSide, roughness: 1 });
    for (const end of [left - 120, right + 120]) {
        const geo = new THREE.PlaneGeometry(310, bottom + wh - 200, 30, 1), p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 155) / 310 * Math.PI * 10) * 18);
        geo.computeVertexNormals(); mesh(back, geo, linen, [end, (bottom + wh - 200) / 2 + 285, bz + 120]);
    }
    // Fairy lights swag beneath the curtain rod: one wire, one bulb batch.
    const fairy = new THREE.Group(); fairy.name = 'Window fairy lights'; back.add(fairy);
    const swags = premium ? 4 : 3, fx0 = left - 150, fx1 = right + 150, rodY = bottom + wh + 105, points = [];
    for (let i = 0; i <= swags * 12; i++) {
        const t = i / (swags * 12), local = (t * swags) % 1;
        points.push(new THREE.Vector3(fx0 + (fx1 - fx0) * t, rodY - 10 - Math.sin(local * Math.PI) * 150, bz + 152));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    deco(mesh(fairy, new THREE.TubeGeometry(curve, swags * 40, 1.6, 4), ink));
    const bulbPoints = curve.getSpacedPoints(Math.round((fx1 - fx0) / 95)), bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), bulbMat, bulbPoints.length), bm = new THREE.Matrix4();
    bulbPoints.forEach((p, i) => bulbs.setMatrixAt(i, bm.compose(p.clone().setY(p.y - 14), new THREE.Quaternion(), new THREE.Vector3(14, 19, 14))));
    bulbs.setColorAt(0, new THREE.Color()); bulbs.castShadow = false; bulbs.computeBoundingSphere(); bulbs.name = 'Fairy light bulbs'; fairy.add(bulbs);
    // Windowsill succulents in the gap between the plant and the desk.
    const ficus = layout.props.find(p => p.id === 'ficus').at, sillY = bottom - 7.5;
    const potX = Math.max(ficus[0] + 330, left + 80);
    deco(mesh(back, new THREE.CylinderGeometry(48, 36, 85, 20), clay, [potX, sillY + 42.5, bz + 55]));
    deco(sphere(back, [42, 30, 42], [potX, sillY + 95, bz + 55], material('#7f9e8b', { roughness: .7 })));
    deco(mesh(back, new THREE.CylinderGeometry(38, 38, 70, 20), ceramic, [potX + 115, sillY + 35, bz + 60]));
    deco(mesh(back, new THREE.CapsuleGeometry(20, 70, 4, 10), material('#5f7d55', { roughness: .7 }), [potX + 115, sillY + 125, bz + 60]));
    room.walls.push({ obj: back, axis: 'x', limit: bz * root.scale.x });

    const side = new THREE.Group(); side.name = 'Storage and art wall'; root.add(side);
    box(side, [80, h, d], [w / 2 + 40, h / 2, bz + d / 2], wallMat);
    box(side, [18, 85, d], [w / 2 - 9, 42.5, bz + d / 2], trim);
    crown(side, [55, 59, d - 55], [w / 2 - 27.5, h - 30, bz + 55 + (d - 55) / 2]);
    const boardZ = premium ? [0, 900] : [100, 1400], libraryZ = [1030, 2530];
    wainscot(side, bz + 10, front, 'z', (u, inset, y) => [w / 2 - inset, y, u], premium ? [libraryZ] : [], house ? [boardZ] : [], 2);
    room.walls.push({ obj: side, axis: 'z', limit: -w / 2 * root.scale.x });
    // Entry wall is also a cutaway, with an 820 mm door and continuous trim.
    const entry = new THREE.Group(); entry.name = 'Entry wall'; root.add(entry);
    box(entry, [80, h, d], [-w / 2 - 40, h / 2, bz + d / 2], wallMat);
    box(entry, [18, 85, d], [-w / 2 + 9, 42.5, bz + d / 2], trim);
    crown(entry, [55, 59, d - 55], [-w / 2 + 27.5, h - 30, bz + 55 + (d - 55) / 2]);
    const doorZ = front - 650;
    wainscot(entry, bz + 10, front, 'z', (u, inset, y) => [-w / 2 + inset, y, u], [[doorZ - 455, doorZ + 455]], [], 2);
    box(entry, [24, 2120, 900], [-w / 2 + 14, 1060, doorZ], trim);
    const doorMat = material('#ffffff', { map: panelTexture('#cdbfa8', [[.12, .06, .88, .45], [.12, .52, .88, .94]]), roughness: .6 });
    box(entry, [28, 2030, 820], [-w / 2 + 30, 1020, doorZ], doorMat, 4);
    rod(entry, [-w / 2 + 52, 1000, doorZ - 310], [-w / 2 + 52, 1000, doorZ - 240], 9, brass);
    deco(mesh(entry, new THREE.CylinderGeometry(26, 26, 14, 20), brass, [-w / 2 + 50, 1000, doorZ - 275])).rotation.z = Math.PI / 2;
    room.walls.push({ obj: entry, axis: 'z', limit: w / 2 * root.scale.x, sign: -1 });

    const cabinet = new THREE.Group(); cabinet.name = 'Oak storage'; root.add(cabinet);
    const doorFace = material('#ffffff', { map: panelTexture('#647769'), roughness: .62 });
    box(cabinet, [cw, 660, 350], [cx, 400, bz + 190], sage, 5);
    box(cabinet, [cw + 25, 30, 375], [cx, 725, bz + 190], joinery, 4);
    for (const x of [cx - cw / 2 + 55, cx + cw / 2 - 55]) for (const z of [bz + 75, bz + 315]) rod(cabinet, [x, 0, z], [x, 85, z], 14, brass);
    for (const x of [cx - cw / 4, cx + cw / 4]) {
        box(cabinet, [cw / 2 - 8, 620, 12], [x, 395, bz + 371], doorFace, 2);
        rod(cabinet, [x + 70, 570, bz + 386], [x + 70, 640, bz + 386], 5, brass);
    }
    // Stoneware vase with dried grasses: two instanced batches, not ten meshes.
    // Set in from the desk-side edge so the grasses' spread stays over the cabinet:
    // Groove measures instanced batches by their full extent, at desktop height.
    const vaseX = cx - cw / 2 + 107, vaseZ = bz + 250;
    deco(mesh(cabinet, new THREE.LatheGeometry([[0, 0], [52, 4], [62, 60], [56, 140], [34, 190], [30, 220], [36, 228]].map(([x, y]) => new THREE.Vector2(x, y)), 24), ceramic, [vaseX, 740, vaseZ]));
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), material('#b49a72'), 7), plumes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), material('#e6d6b6', { roughness: 1 }), 7);
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 7; i++) {
        const a = i * 2.4, lean = .07 + (i % 3) * .06, len = 330 + (i * 47 % 120), dir = new THREE.Vector3(Math.cos(a) * lean, 1, Math.sin(a) * lean).normalize();
        q.setFromUnitVectors(up, dir); v.set(0, 0, 0).addScaledVector(dir, len / 2 - 20);
        stems.setMatrixAt(i, new THREE.Matrix4().compose(v.clone(), q, new THREE.Vector3(3, len, 3)));
        v.set(0, 0, 0).addScaledVector(dir, len - 10);
        plumes.setMatrixAt(i, new THREE.Matrix4().compose(v.clone(), q, new THREE.Vector3(26, 95, 26)));
    }
    // Instanced batches are anchored at the vase neck.
    for (const inst of [stems, plumes]) { inst.position.set(vaseX, 950, vaseZ); inst.castShadow = false; inst.receiveShadow = true; inst.computeBoundingSphere(); cabinet.add(inst); }
    // Compact display shelves above storage, clear of the lifting desk.
    const stripMat = material('#e9dcc4', { emissive: '#ffc27a', emissiveIntensity: 0, roughness: .4 });
    const washMat = new THREE.MeshBasicMaterial({ map: washTexture(), color: '#ffc27a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const y of [1370, 1770]) {
        box(back, [cw + 35, 28, 210], [cx, y, bz + 110], joinery, 2);
        if (y === 1770) for (let i = 0; i < 5; i++) box(back, [25 + i % 2 * 8, 155 + i % 3 * 20, 100], [cx - cw / 2 + 60 + i * 36, y + 95, bz + 100], material(['#d7c8a8', '#7c8972', '#aa735c'][i % 3]), 1);
        sphere(back, [45, 65, 45], [cx + cw / 2 - 70, y + 78, bz + 100], material('#c4b5a2'));
        deco(box(back, [cw - 20, 5, 12], [cx, y - 16.5, bz + 180], stripMat));
        const wash = deco(mesh(back, new THREE.PlaneGeometry(cw + 160, 420), washMat, [cx, y - 14 - 210, bz + 3])); wash.receiveShadow = false; wash.renderOrder = 2;
    }
    // Trailing pothos spilling from the lower shelf; leaves share one batch.
    const potX2 = cx - cw / 2 + 62, shelfTop = 1384;
    deco(mesh(back, new THREE.CylinderGeometry(55, 42, 105, 20), clay, [potX2, shelfTop + 52.5, bz + 110]));
    const leafPositions = [], lr = random(29);
    for (let i = 0; i < 14; i++) { const a = i * 2.4; leafPositions.push([potX2 + Math.cos(a) * (25 + lr() * 35), shelfTop + 115 + lr() * 55, bz + 110 + Math.sin(a) * (25 + lr() * 30), a]); }
    for (const [dx, drop, dz] of [[-10, house ? 300 : 420, 0], [30, house ? 220 : 330, -40], [-45, house ? 180 : 250, 30]]) {
        for (let s = 0; s <= 9; s++) {
            const t = s / 9, overEdge = Math.min(1, t * 2.5), y = shelfTop + 100 - overEdge * 90 - Math.max(0, t - .4) / .6 * drop;
            leafPositions.push([potX2 + dx + Math.sin(t * 5 + dx) * 25, y, bz + 150 + overEdge * 78 + dz * t * .3, t * 7 + dx]);
        }
    }
    const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), leaf, leafPositions.length), lc = new THREE.Color();
    leafPositions.forEach(([x, y, z, a], i) => {
        leaves.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(.9 + (i % 3) * .2, a, .4)), new THREE.Vector3(30, 5, 38)));
        leaves.setColorAt(i, lc.set(['#4f7a45', '#6b9a52', '#5d8a4a', '#8fb36a'][i % 4]));
    });
    leaves.castShadow = false; leaves.receiveShadow = true; leaves.computeBoundingSphere(); leaves.name = 'Trailing pothos'; back.add(leaves);
    if (house) {
        // A small wall hanger supports the guitar without filling floor space.
        const hanger = new THREE.Group(); hanger.name = 'Guitar wall hanger'; hanger.position.set(-w / 2, 1515, 150); entry.add(hanger);
        room.propSupports.push({obj:hanger,id:'quaternius-guitar',at:[-w/2+85,650,150]});
        const black = material('#282b2c', { metalness: .35, roughness: .65 });
        box(hanger, [15, 120, 70], [12, 35, 0], black, 3);
        for (const z of [-25, 25]) rod(hanger, [20, 0, z], [100, 0, z], 7, black);
    }
    const frame = new THREE.Group();frame.name='Framed abstract artwork'; frame.position.set(w / 2 - 36, 1610, house ? 550 : 610); frame.rotation.y = -Math.PI / 2; side.add(frame);
    box(frame, [660, 810, 28], [0, 0, 0], joinery, 3);
    box(frame, [615, 765, 5], [0, 0, 17], trim);
    box(frame, [560, 700, 3], [0, 0, 21], material('#ffffff', { map: artTexture(), roughness: .9 }));
    // Two smaller prints extend the art into a gallery pairing.
    const prints = new THREE.Group(); prints.name = 'Framed gallery prints'; side.add(prints);
    prints.position.set(w / 2 - 30, 1610, frame.position.z + (premium ? -560 : 560)); prints.rotation.y = -Math.PI / 2;
    const oakFrame = material('#7a5a3d', { roughness: .6 });
    for (const [y, map] of [[230, botanicalTexture()], [-225, photoTexture()]]) {
        deco(box(prints, [300, 370, 24], [0, y, 0], oakFrame, 3));
        deco(box(prints, [268, 338, 4], [0, y, 13], trim));
        deco(box(prints, [200, 250, 2], [0, y, 16], material('#ffffff', { map, roughness: .85 })));
    }
    // Personal work board and clock on the wall beside the desk.
    const board = new THREE.Group(); board.name = 'Cork pinboard'; side.add(board);
    board.position.set(w / 2 - 12, 1380, bz + 650); board.rotation.y = -Math.PI / 2;
    deco(box(board, [820, 560, 22], [0, 0, 0], joinery, 4));
    deco(box(board, [776, 516, 4], [0, 0, 11], material('#ffffff', { map: pinboardTexture(), roughness: .95 })));
    const clock = new THREE.Group(); clock.name = 'Wall clock'; side.add(clock);
    clock.position.set(w / 2 - 6, 1960, bz + 650); clock.rotation.y = -Math.PI / 2;
    const clockCanvas = document.createElement('canvas'); clockCanvas.width = clockCanvas.height = 256;
    const clockMap = new THREE.CanvasTexture(clockCanvas); clockMap.colorSpace = THREE.SRGBColorSpace;
    deco(mesh(clock, new THREE.CylinderGeometry(165, 165, 34, 48), oakFrame, [0, 0, 17])).rotation.x = Math.PI / 2;
    deco(mesh(clock, new THREE.TorusGeometry(160, 9, 8, 48), brass, [0, 0, 36]));
    deco(mesh(clock, new THREE.CircleGeometry(152, 48), material('#ffffff', { map: clockMap, roughness: .3 }), [0, 0, 35]));
    // A woven basket with a rolled throw stands against the side wall, clear of the desk.
    const basket = new THREE.Group(); basket.name = 'Woven throw basket'; root.add(basket);
    basket.position.set(w / 2 - 215, 0, house ? boardZ[0] - 240 : -250);
    const wovenMap = wovenTexture(); wovenMap.repeat.set(10, 3);
    const woven = material('#ffffff', { map: wovenMap, roughness: .95 }), knitMap = knitTexture('#b8694a'); knitMap.repeat.set(4, 2);
    mesh(basket, new THREE.CylinderGeometry(170, 140, 360, 28), woven, [0, 180, 0]);
    deco(mesh(basket, new THREE.TorusGeometry(166, 13, 8, 28), woven, [0, 360, 0])).rotation.x = Math.PI / 2;
    const throwRoll = mesh(basket, new THREE.CylinderGeometry(78, 78, 380, 20), material('#ffffff', { map: knitMap, roughness: 1 }), [-25, 420, 10]);
    throwRoll.rotation.set(.18, 0, .32);
    const roll2 = deco(mesh(basket, new THREE.CylinderGeometry(62, 62, 330, 20), material('#e7dcc6', { roughness: 1 }), [45, 395, -40])); roll2.rotation.set(-.2, 0, -.3);
    // A lumbar cushion on the armchair travels with the chair's own transform.
    const cushion = material('#c79245', { roughness: 1 });
    room.decorateProp = (object, placement) => {
        if (placement.id !== 'armchair-poppi') return;
        const pillow = box(object, [.42, .27, .13], [0, .5, -.16], cushion, .05); pillow.rotation.x = -.28; pillow.name = 'Lumbar cushion';
    };
    if (house) {
        // Low storage along the side leaves a full route from entry to desk.
        const storage=new THREE.Group();storage.name='Low sideboard';root.add(storage);
        box(storage,[260,15,premium?850:1250],[w/2-165,7.5,premium?450:750],sage,3);
        box(storage, [310, 650, premium ? 900 : 1300], [w / 2 - 165, 340, premium ? 450 : 750], sage, 6);
        box(storage, [335, 25, premium ? 930 : 1330], [w / 2 - 168, 678, premium ? 450 : 750], joinery, 3);
        for (const z of (premium ? [160, 450, 740] : [310, 750, 1190])) box(storage, [12, 590, premium ? 275 : 410], [w / 2 - 327, 350, z], sage, 2);
        // Sideboard dressing: a ceramic lamp and a short stack of books.
        const top = 690.5, sx = w / 2 - 175, lampZ = boardZ[0] + 170;
        deco(sphere(storage, [80, 115, 80], [sx, top + 110, lampZ], clay));
        rod(storage, [sx, top + 200, lampZ], [sx, top + 330, lampZ], 6, brass);
        const lampShade = deco(mesh(storage, new THREE.CylinderGeometry(105, 135, 170, 28, 1, true), lampGlow, [sx, top + 385, lampZ]));
        lampShade.name = 'Sideboard lamp shade';
        for (const [i, color] of ['#5f7468', '#b98b5a', '#e4d9c3'].entries()) deco(box(storage, [230 - i * 18, 38, 160 - i * 8], [sx + 10, top + 19 + i * 38, lampZ + 300], material(color, { roughness: .85 }), 3));
    }
    if (premium) {
        // Extra floor area becomes a lounge and a library, not scaled furniture.
        const loungeZ = layout.id === 'executive' ? 3190 : 2510;
        box(root, [3000, 5, 2080], [550, 2.5, loungeZ + 390], jute, 8);
        const coffee = new THREE.Group(); coffee.name = 'Lounge coffee table'; root.add(coffee);
        box(coffee, [1050, 35, 520], [700, 380, loungeZ], joinery, 16);
        for (const x of [290,1110]) for (const z of [loungeZ-180,loungeZ+180]) rod(coffee,[x,0,z],[x,365,z],14,brass);
        deco(box(coffee, [380, 14, 240], [520, 404.5, loungeZ - 40], material('#3d3a36', { roughness: .4 }), 5));
        deco(mesh(coffee, new THREE.CylinderGeometry(95, 55, 70, 24), ceramic, [520, 446, loungeZ - 40]));
        for (const [i, color] of ['#b8724f', '#e2d7c3'].entries()) deco(box(coffee, [260 - i * 20, 30, 190 - i * 10], [930, 412.5 + i * 30, loungeZ + 60], material(color, { roughness: .85 }), 3));
        const bookcase = new THREE.Group(); bookcase.name = 'Built-in library'; side.add(bookcase);
        const z = 1780;
        box(bookcase, [24, 2140, 1500], [w / 2 - 12, 1090, z], sage, 3);
        for (const end of [z - 738, z + 738]) box(bookcase, [310, 2140, 24], [w / 2 - 165, 1090, end], sage, 3);
        box(bookcase, [310, 60, 1500], [w / 2 - 165, 30, z], sage, 3);
        for (const y of [470,870,1270,1670,2070]) {
            box(bookcase,[320,25,1460],[w/2-180,y,z],joinery,2);
            for (let n=0;n<14;n++) box(bookcase,[140,170+(n%3)*22,35],[w/2-200,y+105,z-650+n*85],material(['#d7c8a8','#61786d','#ad785e'][n%3]),1);
        }
        if (layout.id === 'executive') {
            const gallery = new THREE.Group(); gallery.name = 'Gallery art'; gallery.position.set(-w/2+35,1650,1000); gallery.rotation.y=Math.PI/2; entry.add(gallery);
            box(gallery,[1100,1100,30],[0,0,0],joinery,3);
            box(gallery,[1040,1040,5],[0,0,18],material('#ffffff',{map:artTexture(),roughness:.9}));
        }
    }
    // Ceiling is omitted for sight lines, but light fittings use its true height.
    const shade = material('#eee3cc', { roughness: .95, side: THREE.DoubleSide });
    const ceilingFixture = new THREE.Group(); ceilingFixture.name = 'Ceiling pendant'; root.add(ceilingFixture); room.ceilingFixture = ceilingFixture;
    mesh(ceilingFixture, new THREE.CylinderGeometry(70, 70, 25, 24), brass, [0, h - 12.5, 370]);
    rod(ceilingFixture, [0, h, 370], [0, h - 170, 370], 5, brass);
    mesh(ceilingFixture, new THREE.CylinderGeometry(240, 280, 140, 40, 1, true), shade, [0, h - 230, 370]);
    const glow = material('#fff0d5', { emissive: '#ffd89d', emissiveIntensity: .6 });
    const diffuser = mesh(ceilingFixture, new THREE.CylinderGeometry(268, 268, 6, 40), glow, [0, h - 300, 370]); diffuser.castShadow = false;
    const makeLight = (position, color, power, range) => {
        const light = new THREE.PointLight(color, 0, range * root.scale.x, 2); light.position.set(...position); root.add(light);
        return { light, power: power * (root.scale.x * 1000) ** 2 };
    };
    const lights = [
        makeLight([cx, 1080, bz + 450], '#ffcd8f', 3.5, 3500),
        makeLight([0, h - 340, 370], '#ffdfb0', 5, 4200),
        makeLight([w / 2 - 500, 150, front - 600], '#b18bdf', 1.5, 2300),
        makeLight([layout.readingLight[0], 1520, layout.readingLight[1]], '#ffdcaa', 2.5, 2600)
    ];
    // Light sources are owned by this room and disappear on scene replacement.
    room.homeAtmosphere = (modeId, accent = 1) => {
        const mode = HOME_MODES[modeId] || HOME_MODES.afternoon, look = HOME_LOOKS[modeId] || HOME_LOOKS.afternoon;
        paintView(skyCanvas.getContext('2d'), skyCanvas.width, skyCanvas.height, mode, look);
        skyMap.needsUpdate = true;
        paintClock(clockCanvas.getContext('2d'), 256, look.time); clockMap.needsUpdate = true;
        const drop = Math.max(60, look.shade * wh); blind.scale.y = drop; shadeMap.repeat.set(1, Math.max(1, drop / 210));
        lights.forEach(({ light, power }, i) => { light.intensity = power * mode.practical * accent * (i === 2 && modeId !== 'party' ? .12 : 1); });
        lights[2].light.color.set(look.party ? '#b880ff' : '#ffcf99'); glow.emissiveIntensity = .3 + mode.practical;
        lights[0].light.color.set(modeId === 'night' ? '#ffc47e' : '#ffcd8f');
        const strip = Math.min(1.4, look.strip * accent), color = look.party ? '#d06bff' : '#ffc27a';
        stripMat.emissive.set(color); stripMat.emissiveIntensity = strip * 2.2;
        washMat.color.set(color); washMat.opacity = Math.min(1, strip * .42); washMat.visible = strip > 0;
        lampGlow.emissiveIntensity = mode.practical * .9;
        bulbMat.color.set(look.fairy ? '#ffffff' : '#8f897d').multiplyScalar(look.fairy ? Math.min(1, .55 + .45 * look.fairy * accent) : 1);
        const party = ['#ff6fcf', '#7fd0ff', '#ffd27f', '#b48cff'];
        for (let i = 0; i < bulbs.count; i++) bulbs.setColorAt(i, lc.set(look.party ? party[i % 4] : look.fairy ? '#ffcf86' : '#f2ede2'));
        bulbs.instanceColor.needsUpdate = true;
    };
    room.homeAtmosphere('afternoon');
    // Explicit surface roles keep detail off artwork and imported models.
    for (const [mat, surface] of [[wallMat, 'plaster'], [oak, 'wood'], [joinery, 'wood'], [oakFrame, 'wood'], [sage, 'powder'], [doorFace, 'powder'], [paint, 'powder'], [trim, 'powder'], [doorMat, 'powder'], [brass, 'metal'], [linen, 'fabric'], [shade, 'fabric'], [rugMat, 'fabric'], [jute, 'fabric'], [woven, 'fabric'], [clay, 'stone'], [ceramic, 'stone']]) mat.userData.roomSurface = surface;
    root.userData.dimensionsMm = { width: w, depth: d, height: h };
}
