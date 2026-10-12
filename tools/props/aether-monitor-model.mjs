// Panel geometry and artwork adapted from the user's AETHER 34UW HTML.
import * as THREE from 'three';
export function createAetherMonitor() {
const SPEC = {
  R      : 1.80,    // curvature radius 1800R
  scrW   : 0.800,   // active area width
  scrH   : 0.336,   // active area height
  bezel  : 0.0055,  // micro-edge bezel
  depth  : 0.024,   // chassis thickness
  chinH  : 0.014,   // bottom chin extra
};
SPEC.bodyW = SPEC.scrW + SPEC.bezel*2;
SPEC.bodyH = SPEC.scrH + SPEC.bezel*2 + SPEC.chinH;

const M = {
  chassis: new THREE.MeshPhysicalMaterial({
    color:0x15171c, metalness:0.55, roughness:0.42,
    clearcoat:0.5, clearcoatRoughness:0.35 }),

  bezel: new THREE.MeshPhysicalMaterial({
    color:0x0a0b0e, metalness:0.2, roughness:0.28,
    clearcoat:1, clearcoatRoughness:0.08 }),

  alu: new THREE.MeshPhysicalMaterial({
    color:0xcdd3da, metalness:1.0, roughness:0.22,
    clearcoat:0.35, clearcoatRoughness:0.25 }),

  aluDark: new THREE.MeshPhysicalMaterial({
    color:0x6b7177, metalness:1.0, roughness:0.38 }),

  rubber: new THREE.MeshStandardMaterial({ color:0x111317, roughness:0.95, metalness:0 }),

  port: new THREE.MeshStandardMaterial({ color:0x05060a, roughness:0.9, metalness:0.1 }),

  led: new THREE.MeshStandardMaterial({
    color:0x000000, emissive:0x2f6bff, emissiveIntensity:5, toneMapped:false }),

  desk: new THREE.MeshPhysicalMaterial({
    color:0x121419, metalness:0.1, roughness:0.35,
    clearcoat:0.6, clearcoatRoughness:0.25 }),

  wall: new THREE.MeshStandardMaterial({ color:0x0b0d12, roughness:1 })
};

/* ══════════════════════════════════════════════════════════════
   5. GEOMETRY HELPERS
   ══════════════════════════════════════════════════════════════ */

// Curved "crescent" slab → the monitor chassis (constant thickness, follows 1800R)
function curvedSlab(w, h, t, R, bevel = 0.0022){
  const a = Math.asin((w/2)/R), seg = 72, s = new THREE.Shape();
  const front = i => { const th = -a + 2*a*(i/seg); return [R*Math.sin(th), R*Math.cos(th)-R]; };
  for (let i=0;i<=seg;i++){ const [x,y]=front(i); i? s.lineTo(x,y) : s.moveTo(x,y); }
  for (let i=seg;i>=0;i--){ const [x,y]=front(i); s.lineTo(x, y + t); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth:h, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel,
    bevelSegments:4, curveSegments:seg });
  g.rotateX(-Math.PI/2);          // extrusion axis → +Y
  g.translate(0, -h/2, 0);        // centre vertically
  g.computeVertexNormals();
  return g;                        // front surface centre sits at z = 0
}

// Curved display surface (we view the concave inside → BackSide)
function curvedScreen(w, h, R, segs = 96){
  const a = Math.asin((w/2)/R);
  const g = new THREE.CylinderGeometry(R, R, h, segs, 1, true, Math.PI - a, 2*a);
  g.translate(0, 0, R);
  // glTF has no BackSide material. Bake the inward-facing screen winding
  // and horizontal UV correction so the front remains visible after export.
  const index = g.index.array, normals = g.attributes.normal, uv = g.attributes.uv;
  for (let i=0;i<index.length;i+=3) [index[i+1],index[i+2]]=[index[i+2],index[i+1]];
  for (let i=0;i<normals.count;i++) normals.setXYZ(i,-normals.getX(i),-normals.getY(i),-normals.getZ(i));
  for (let i=0;i<uv.count;i++) uv.setX(i,1-uv.getX(i));
  return g;
}

function roundedRect(w, h, r){
  const s = new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r, y);
  s.lineTo(x+w-r, y);   s.quadraticCurveTo(x+w, y,     x+w, y+r);
  s.lineTo(x+w,   y+h-r); s.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  s.lineTo(x+r,   y+h);   s.quadraticCurveTo(x,   y+h, x,     y+h-r);
  s.lineTo(x,     y+r);   s.quadraticCurveTo(x,   y,   x+r,   y);
  return s;
}
const extrude = (shape, d, b=0.0015) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth:d, bevelEnabled:true, bevelThickness:b, bevelSize:b, bevelSegments:4, curveSegments:32 });
  g.center(); g.computeVertexNormals(); return g;
};

const mesh = (g, m, cast=true) => {
  const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o;
};

/* ══════════════════════════════════════════════════════════════
   6. SCREEN CONTENT  (live canvas texture)
   ══════════════════════════════════════════════════════════════ */
const CW = 1536, CH = Math.round(CW * SPEC.scrH / SPEC.scrW);
const cvs = Object.assign(document.createElement('canvas'), { width:CW, height:CH });
const ctx = cvs.getContext('2d');
const screenTex = new THREE.CanvasTexture(cvs);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = 4;
screenTex.wrapS = THREE.RepeatWrapping;
// Horizontal UVs are corrected in the exported surface geometry.

let uiMode = 0, powerOn = true;

function drawScreen(t){
  if (!powerOn){ ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH); screenTex.needsUpdate = true; return; }
  // backdrop
  const g = ctx.createLinearGradient(0,0,CW,CH);
  g.addColorStop(0,'#070b16'); g.addColorStop(.55,'#0b1222'); g.addColorStop(1,'#060a12');
  ctx.fillStyle = g; ctx.fillRect(0,0,CW,CH);

  // ambient glows
  const blob = (x,y,r,c)=>{ const rg=ctx.createRadialGradient(x,y,0,x,y,r);
    rg.addColorStop(0,c); rg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=rg; ctx.fillRect(0,0,CW,CH); };
  blob(CW*0.22 + Math.sin(t*0.4)*60, CH*0.35, 520, 'rgba(47,107,255,.30)');
  blob(CW*0.78 + Math.cos(t*0.3)*70, CH*0.68, 480, 'rgba(255,56,140,.18)');
  blob(CW*0.52, CH*0.1, 400, 'rgba(0,224,200,.12)');

  if (uiMode === 1){                              // ── wallpaper mode
    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=2;
    for(let i=0;i<34;i++){ ctx.beginPath();
      for(let x=0;x<=CW;x+=16){
        const y = CH*0.5 + Math.sin(x*0.004 + t*0.9 + i*0.22)*(60+i*3) + (i-17)*7;
        x? ctx.lineTo(x,y) : ctx.moveTo(x,y);
      } ctx.stroke(); }
    screenTex.needsUpdate = true; return;
  }

  // ── dashboard mode
  ctx.fillStyle='rgba(255,255,255,.045)'; ctx.fillRect(0,0,CW,54);          // title bar
  ctx.fillRect(0,54,96,CH-54);                                              // sidebar
  ['#ff5f57','#febc2e','#28c840'].forEach((c,i)=>{ ctx.fillStyle=c;
    ctx.beginPath(); ctx.arc(28+i*22,27,7,0,7); ctx.fill(); });
  ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='600 20px ui-sans-serif,sans-serif';
  ctx.fillText('AETHER WORKSPACE  ·  3440 × 1440  ·  175 Hz  ·  HDR600', 120, 34);

  for(let i=0;i<6;i++){ ctx.fillStyle = i===1?'#2f6bff':'rgba(255,255,255,.14)';
    ctx.beginPath(); ctx.roundRect(28,92+i*58,40,40,11); ctx.fill(); }

  const card=(x,y,w,h)=>{ ctx.fillStyle='rgba(255,255,255,.055)'; ctx.strokeStyle='rgba(255,255,255,.09)';
    ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(x,y,w,h,16); ctx.fill(); ctx.stroke(); };

  // big graph
  card(128, 80, CW*0.52, CH-150);
  ctx.save(); ctx.beginPath(); ctx.rect(128,80,CW*0.52,CH-150); ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,.05)';
  for(let x=128;x<128+CW*0.52;x+=56){ ctx.beginPath(); ctx.moveTo(x,80); ctx.lineTo(x,CH-70); ctx.stroke(); }
  const base = CH-90;
  [['#2f6bff',1,0],['#00e0c8',0.6,1.4],['#ff3d8c',0.35,2.6]].forEach(([c,amp,ph])=>{
    ctx.beginPath();
    for(let x=0;x<=CW*0.52;x+=6){
      const y = base - (70 + Math.sin(x*0.012+t*1.5+ph)*48 + Math.sin(x*0.031+t*0.7+ph)*26)*amp;
      x? ctx.lineTo(128+x,y) : ctx.moveTo(128+x,y);
    }
    ctx.strokeStyle=c; ctx.lineWidth=4; ctx.shadowColor=c; ctx.shadowBlur=22; ctx.stroke(); ctx.shadowBlur=0;
  });
  ctx.restore();

  // right column cards + bars
  const rx = 128 + CW*0.52 + 24, rw = CW - rx - 40;
  card(rx, 80, rw, 150); card(rx, 248, rw, CH-320);
  ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='700 46px ui-sans-serif,sans-serif';
  ctx.fillText((62 + Math.sin(t)*7).toFixed(1)+' fps⁻¹', rx+26, 150);
  ctx.fillStyle='rgba(255,255,255,.35)'; ctx.font='500 16px ui-sans-serif,sans-serif';
  ctx.fillText('GPU · 1 ms response · Adaptive-Sync', rx+26, 186);
  for(let i=0;i<16;i++){
    const h = 20 + Math.abs(Math.sin(t*1.9 + i*0.5))*(CH-430);
    ctx.fillStyle = `hsl(${210+i*7} 95% ${55+i}%)`;
    ctx.beginPath(); ctx.roundRect(rx+26+i*((rw-52)/16), CH-100-h, (rw-52)/16-8, h, 5); ctx.fill();
  }
  screenTex.needsUpdate = true;
}

/* ══════════════════════════════════════════════════════════════
   7. BUILD THE MONITOR
   ══════════════════════════════════════════════════════════════ */
const monitor  = new THREE.Group();            // whole product
const headTilt = new THREE.Group();            // panel pivot (tilt)
const column   = new THREE.Group();            // height-adjust column


/* ---- 7a. Display head ---------------------------------------------------- */
const head = new THREE.Group();

// chassis shell
head.add(mesh(curvedSlab(SPEC.bodyW, SPEC.bodyH, SPEC.depth, SPEC.R), M.chassis));

// glossy black front glass covering full front face
const glass = mesh(curvedScreen(SPEC.bodyW-0.001, SPEC.bodyH-0.001, SPEC.R), M.bezel, false);
glass.material.side = THREE.FrontSide; glass.position.z = 0.0006;
head.add(glass);

// emissive display
const screenMat = new THREE.MeshPhysicalMaterial({
  color:0xffffff, map:screenTex, emissive:0x000000, emissiveIntensity:0,
  roughness:0.14, metalness:0, clearcoat:1, clearcoatRoughness:0.06,
  side:THREE.FrontSide });
const screen = new THREE.Mesh(curvedScreen(SPEC.scrW, SPEC.scrH, SPEC.R), screenMat);
screen.position.set(0, SPEC.chinH/2, 0.0014);
screen.name = "monitor-screen";
head.add(screen);

// rear RGB halo (curved strip) + power LED
const ledStrip = new THREE.Mesh(curvedScreen(SPEC.bodyW-0.05, 0.010, SPEC.R), M.led);
ledStrip.position.set(0, -0.055, -SPEC.depth - 0.0015);
ledStrip.material.side = THREE.DoubleSide;
head.add(ledStrip);

const powerLed = mesh(new THREE.SphereGeometry(0.0035, 16, 12),
  new THREE.MeshStandardMaterial({ color:0x000, emissive:0x66ffcc, emissiveIntensity:6, toneMapped:false }), false);
powerLed.position.set(SPEC.bodyW*0.42, -SPEC.bodyH/2 + 0.006, 0.0032);
head.add(powerLed);

// brand plate on the chin
const logoCvs = Object.assign(document.createElement('canvas'), {width:512, height:128});
const lx = logoCvs.getContext('2d');
lx.fillStyle = '#000'; lx.fillRect(0,0,512,128);
lx.fillStyle = '#9aa3ad'; lx.font = '600 54px ui-sans-serif,sans-serif';
lx.textAlign='center'; lx.letterSpacing = '14px';
lx.fillText('AETHER', 256, 86);
const logoTex = new THREE.CanvasTexture(logoCvs); logoTex.colorSpace = THREE.SRGBColorSpace;
const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.0155),
  new THREE.MeshBasicMaterial({ map:logoTex, transparent:false }));
logo.position.set(0, -SPEC.bodyH/2 + 0.0085, 0.0035);
head.add(logo);

// rear detail: VESA boss, vents, I/O bay
const boss = mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.014, 48), M.chassis);
boss.rotation.x = Math.PI/2; boss.position.set(0, 0.012, -SPEC.depth - 0.007);
boss.name = "display-vesa-mount";
head.add(boss);

for (let i=0;i<22;i++){                                   // ventilation slots
  const v = mesh(new THREE.BoxGeometry(0.004, 0.030, 0.003), M.port, false);
  v.position.set(-0.21 + i*0.02, 0.105, -SPEC.depth - 0.0015);
  head.add(v);
}

const ioBay = mesh(extrude(roundedRect(0.185, 0.034, 0.006), 0.010), M.port, false);
ioBay.position.set(0.02, -0.085, -SPEC.depth - 0.004);
head.add(ioBay);
const portSizes = [[0.021,0.009],[0.021,0.009],[0.011,0.011],[0.011,0.011],[0.014,0.0055],[0.014,0.0055]];
portSizes.reduce((x, [w,h]) => {
  const p = mesh(new THREE.BoxGeometry(w, h, 0.012), M.aluDark, false);
  p.position.set(x + w/2, -0.085, -SPEC.depth - 0.004);
  head.add(p); return x + w + 0.006;
}, -0.075);

drawScreen(0);
ctx.fillStyle = "#060709"; ctx.fillRect(0, 0, cvs.width, cvs.height);
screenTex.needsUpdate = true;
head.position.y = SPEC.bodyH/2 + .0022;
return head;
}
