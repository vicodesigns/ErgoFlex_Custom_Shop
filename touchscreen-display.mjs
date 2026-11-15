// Live screen artwork. Drawn at texture resolution, so it remains legible on
// both physical panel sizes without baking a phone's status/navigation bars.
//
// Film screens (state.film, set by a film chapter's `touchscreen.screen` keys: experience/touchscreen-track.mjs,
// studio.js setFilmTouchscreen): { mode, since, ...the mode's fields }. The header bar (ErgoFlex, STOP) stays; the body
// below it is the mode's. The height a mode shows is state.height, the desk's real height at that frame, so a number
// that counts down is the desk moving. Modes:
//   'prompt'   { title, text, button, sub, pressed }   a question and one big button (FILM_BUTTON on the canvas);
//              pressed: true (or 0..1) shows it pushed in and lit, the way the app answers a touch
//   'moving'   { title, target, from, done }            the live height, large, travelling from `from` to `target`
//              (inches; give both: without `from` there is no bar) with a bar; once within 0.05 in of the target,
//              `done` (default 'At height') with a tick
//   'message'  { title, text }                          a title and a line of text
// More modes (the screens stream's): TouchscreenDisplay.modes.<name> = (ui, state, film) => {...}, drawing in
// ui.c (the 2D context; ui.text, ui.box, ui.ink, ui.muted, ui.blue, ui.panel, ui.dark, ui.top: where the body starts).
// A key whose mode is not known shows the app's own screen.
export const FILM_BUTTON = { x: 200, y: 400, w: 880, h: 190 };      // canvas pixels of the prompt's button (1280 x 760)
const filmModes = Object.assign(Object.create(null), {
    prompt(ui, state, f) {
        const { c, text, box, ink, muted, dark } = ui, b = FILM_BUTTON, p = f.pressed === true ? 1 : Math.max(0, Math.min(1, Number(f.pressed) || 0));
        if (f.title) text(String(f.title), 70, 190, 58, ink, '700');
        if (f.text) text(String(f.text), 72, 258, 32, muted, '400');
        text(`Now ${state.height.toFixed(1)} in`, 72, 330, 28, muted, '600');
        // the button: raised, then pushed in (a little smaller, darker) with a ring of light round it
        c.save(); const k = 1 - .025 * p, cx = b.x + b.w / 2, cy = b.y + b.h / 2; c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy);
        if (p > 0) { c.save(); c.shadowColor = '#5aa8ffcc'; c.shadowBlur = 46 * p; c.fillStyle = '#5aa8ff'; c.beginPath(); c.roundRect(b.x - 10, b.y - 10, b.w + 20, b.h + 20, 58); c.globalAlpha = .55 * p; c.fill(); c.restore(); }
        const top = dark ? '#2f7cf0' : '#3a46b8', down = dark ? '#1450b8' : '#1f2a86', mix = (a, z) => { const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const x = h(a), y = h(z); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * p).toString(16).padStart(2, '0')).join(''); };
        box(b.x, b.y, b.w, b.h, 48, mix(top, down), p < .5);
        c.textAlign = 'center'; text(String(f.button || 'OK'), cx, cy + (f.sub ? 4 : 20), 60, '#ffffff', '700');
        if (f.sub) text(String(f.sub), cx, cy + 58, 28, '#d8e2ff', '600');
        c.textAlign = 'left'; c.restore();
    },
    moving(ui, state, f) {
        const { c, text, box, ink, muted, blue, dark } = ui, h = state.height, target = Number(f.target), from = f.from !== undefined && f.from !== null && Number.isFinite(Number(f.from)) ? Number(f.from) : null;
        const there = Number.isFinite(target) && Math.abs(h - target) < .05, down = Number.isFinite(target) && target < (from ?? h);
        text(String(there ? (f.done || 'At height') : (f.title || (down ? 'Lowering' : 'Raising'))), 70, 175, 44, there ? (dark ? '#4fd17a' : '#1f8a45') : ink, '700');
        c.textAlign = 'right'; text(h.toFixed(1), 830, 470, 250, ink, '700'); c.textAlign = 'left';
        text('in', 850, 470, 64, muted, '600');
        if (Number.isFinite(target)) {
            if (there) { c.save(); c.strokeStyle = dark ? '#4fd17a' : '#1f8a45'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(1010, 380); c.lineTo(1060, 430); c.lineTo(1150, 320); c.stroke(); c.restore(); }
            else { c.save(); c.fillStyle = blue; c.beginPath(); const y = down ? 330 : 430, s = down ? 1 : -1; c.moveTo(1030, y); c.lineTo(1150, y); c.lineTo(1090, y + s * 90); c.closePath(); c.fill(); c.restore(); }
            text(`${down ? '↓' : '↑'} ${target.toFixed(1)} in`, 70, 600, 40, muted, '600');
            if (from === null) return;      // (no `from`: no bar)
            const span = Math.abs(target - from) || 1, done = Math.max(0, Math.min(1, Math.abs(h - from) / span));
            box(70, 640, 1140, 34, 17, dark ? '#12181d' : '#dae1e9', false);
            if (done > 0) { c.fillStyle = there ? (dark ? '#4fd17a' : '#1f8a45') : blue; c.beginPath(); c.roundRect(70, 640, Math.max(34, 1140 * done), 34, 17); c.fill(); }
        }
    },
    message(ui, state, f) {
        const { text, ink, muted } = ui;
        if (f.title) text(String(f.title), 70, 260, 64, ink, '700');
        if (f.text) text(String(f.text), 72, 340, 34, muted, '400');
    }
});
export class TouchscreenDisplay {
    static modes = filmModes;
    constructor(){this.canvas=document.createElement('canvas');this.canvas.width=1280;this.canvas.height=760;this.ctx=this.canvas.getContext('2d');this.key='';this.theme='light';}
    update(state){
        const key=JSON.stringify(state);if(key===this.key)return false;this.key=key;this.theme=state.theme;
        const c=this.ctx,dark=state.theme==='dark',ink=dark?'#edf0f2':'#202832',muted=dark?'#a7b1bc':'#626f7b',blue=dark?'#1677ee':'#30277e';
        const panel=dark?'#232b31':'#edf1f5',base=dark?'#191e24':'#e6ebf1';
        c.clearRect(0,0,1280,760);c.fillStyle=base;c.fillRect(0,0,1280,760);
        const text=(label,x,y,size=22,color=ink,weight='400')=>{c.fillStyle=color;c.font=`${weight} ${size}px Arial, sans-serif`;c.fillText(label,x,y);};
        const box=(x,y,w,h,r=18,color=panel,shadow=true)=>{
            c.save();if(shadow){c.shadowColor=dark?'#0008':'#8898ad55';c.shadowBlur=16;c.shadowOffsetY=8;}
            c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();c.restore();
            c.strokeStyle=dark?'#4a535b':'#d1d8e1';c.lineWidth=1.5;c.stroke();
        };
        const sphere=(x,y,r)=>{const g=c.createRadialGradient(x-r*.35,y-r*.4,1,x,y,r);g.addColorStop(0,'#fffef6');g.addColorStop(.5,'#e7e4d7');g.addColorStop(1,'#a7a797');c.save();c.shadowColor='#0006';c.shadowBlur=12;c.shadowOffsetY=8;c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.strokeStyle='#faf9ee';c.lineWidth=2;c.stroke();c.restore();};
        const arrow=(x,y,angle)=>{c.save();c.translate(x,y);c.rotate(angle);c.strokeStyle=muted;c.lineWidth=6;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(-10,6);c.lineTo(0,-5);c.lineTo(10,6);c.stroke();c.restore();};
        const chip=(label,x,y,w=80)=>{box(x,y,w,40,14);text(label,x+15,y+27,18,dark?'#becbf6':'#344c9d','600');};
        c.fillStyle=dark?'#202738':'#dbe4f0';c.fillRect(0,0,1280,83);
        c.fillStyle='#e6a23c';c.beginPath();c.roundRect(602,9,76,5,3);c.fill();
        for(let i=0;i<3;i++){c.fillStyle=muted;c.beginPath();c.roundRect(30,29+i*12,38-i*8,5,3);c.fill();}
        text('ErgoFlex',191,62,57,blue,'700');text('Desk',461,62,27,muted,'600');
        c.fillStyle='#3ab356';c.beginPath();c.arc(699,44,9,0,Math.PI*2);c.fill();text('ⓘ',774,56,30,muted);
        text(state.sound?'♪':'♫',854,57,35,state.sound?blue:muted);
        // Shield silhouette, highlighted only when pre-collision is enabled.
        c.save();c.translate(955,22);c.strokeStyle=state.guard?blue:muted;c.fillStyle=state.guard?(dark?'#164485':'#adc4fa'):panel;c.lineWidth=4;
        c.beginPath();c.moveTo(0,8);c.lineTo(20,0);c.lineTo(40,8);c.lineTo(38,29);c.quadraticCurveTo(32,44,20,50);c.quadraticCurveTo(8,44,2,29);c.closePath();c.fill();c.stroke();c.restore();
        box(1105,20,134,47,24,'#bd2822');text('STOP',1133,53,22,'#fff','700');
        const mode=state.film&&typeof state.film.mode==='string'&&Object.hasOwn(TouchscreenDisplay.modes,state.film.mode)?TouchscreenDisplay.modes[state.film.mode]:null;
        if(mode){mode({c,text,box,ink,muted,blue,panel,base,dark,top:83,width:1280,height:760},state,state.film);return true;}
        box(26,105,310,478,30);box(361,105,548,478,30);box(934,105,320,478,30);
        text('HEIGHT',46,141,17,muted);text('GLIDE',382,141,17,muted);text('TILT',954,141,17,muted);
        chip(state.heightSpeed||'Medium',184,120,115);chip(state.glideSpeed||'Medium',765,120,115);chip(state.tiltSpeed||'Fast',1084,120,115);
        text(state.height.toFixed(1),55,361,65);text('INCHES',55,403,19,muted);
        text(`${Math.round(state.tilt)}°`,960,361,65);text('ANGLE',960,403,19,muted);
        box(260,185,48,315,24,dark?'#12181d':'#dae1e9',false);arrow(284,211,0);arrow(284,474,Math.PI);
        sphere(284,342.5-(state.heightJog||0)*120,22);
        const cx=635,cy=350;
        for(let i=0;i<7;i++){c.beginPath();c.arc(cx,cy,194-i*6,0,Math.PI*2);c.strokeStyle=i===0?(dark?'#535e68':'#cbd3dc'):(dark?'#2c343c':'#dfe5ec');c.lineWidth=i===0?6:2;c.stroke();}
        c.beginPath();c.arc(cx,cy,144,0,Math.PI*2);c.fillStyle=dark?'#161b21':'#dfe5eb';c.fill();
        for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(cx+Math.sin(a)*180,cy+Math.cos(a)*180);c.lineTo(cx+Math.sin(a)*161,cy+Math.cos(a)*161);c.strokeStyle=muted;c.lineWidth=5;c.lineCap='round';c.stroke();}
        arrow(cx,cy-100,0);arrow(cx,cy+100,Math.PI);arrow(cx-100,cy,-Math.PI/2);arrow(cx+100,cy,Math.PI/2);sphere(cx,cy,36);
        c.beginPath();c.moveTo(1140,205);c.bezierCurveTo(1260,260,1260,420,1140,490);c.strokeStyle=dark?'#59636e':'#c1ccd8';c.lineWidth=56;c.lineCap='round';c.stroke();
        c.strokeStyle=dark?'#151b21':'#dce3ea';c.lineWidth=40;c.stroke();arrow(1145,205,-Math.PI/4);arrow(1145,490,Math.PI*1.25);sphere(1214,350,22);
        ['29.3','35.0','42.1'].forEach((v,i)=>chip(v,45+i*91,526));['−5°','+13°','+10°'].forEach((v,i)=>chip(v,951+i*91,526));
        ['Sitting','Stool','Standing'].forEach((v,i)=>{box(32+i*419,605,379,54,23);text(v,147+i*419,641,24,ink,'600');});
        box(185,686,547,57,16);text(state.phase[0].toUpperCase()+state.phase.slice(1),207,722,21);text(state.moving?'Moving':'Ready',549,723,28,blue,'600');
        box(758,686,197,57,16);text('▶  Groove',783,722,20);box(979,686,259,57,16);text(state.leds?'●  LED ON':'○  LED OFF',1046,722,20);
        // Persistent preview safety card uses the same visual hierarchy as the app.
        if(state.alert){const ahead=state.alert.kind==='ahead',accent=ahead?'#c88619':'#c72b27';
            box(66,433,1148,297,25,dark?'#242d38':'#f7f8fb');box(66,433,1148,68,25,accent,false);c.fillStyle=accent;c.fillRect(66,466,1148,35);
            text(ahead?'⚠  OBSTACLE AHEAD':'✖  '+(state.alert.pushable?'COLLISION':'HEAVY COLLISION'),94,476,26,'#fff','700');
            text('Desk stopped · movement held',92,539,24);text('Source: Wheels · '+state.alert.name,92,578,22,dark?'#96d2d6':'#187b87');
            text(ahead?'Shield stopped the desk before contact.':'Check the space around the desk before resuming.',92,617,22);
            box(91,648,1099,57,16,'#127d77',false);text('✓  CLEAR',566,686,27,'#fff','600');
        }
        return true;
    }
}
