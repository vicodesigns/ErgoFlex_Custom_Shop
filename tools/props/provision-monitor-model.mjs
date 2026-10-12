// Geometry and screen artwork adapted from the user's supplied ProVision panel HTML.
// The source proportions are retained; diagonal is scaled to an illustrative 32 inches.
import * as THREE from 'three';
export function createProVisionMonitor({portrait=false}={}) {
  // Materials
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x181a1f, roughness: 0.35, metalness: 0.8
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x22252a, roughness: 0.25, metalness: 0.95
  });
  const bezelMat = new THREE.MeshBasicMaterial({ color: 0x07080a });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9, metalness: 0.0 });

  // Canvas Screen Texture
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 1920;
  sCanvas.height = 1080;
  const ctx = sCanvas.getContext('2d');

  function drawScreen(timeSec) {
    const g = ctx.createLinearGradient(0, 0, 1920, 1080);
    g.addColorStop(0, '#0a1628');
    g.addColorStop(0.55, '#0f2040');
    g.addColorStop(1, '#060a14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1920, 1080);

    // Landscape graphic
    ctx.beginPath();
    ctx.moveTo(0, 680);
    ctx.lineTo(220, 480); ctx.lineTo(380, 560); ctx.lineTo(540, 380);
    ctx.lineTo(760, 520); ctx.lineTo(950, 340); ctx.lineTo(1180, 490);
    ctx.lineTo(1380, 410); ctx.lineTo(1580, 530); ctx.lineTo(1780, 430);
    ctx.lineTo(1920, 510); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080);
    ctx.closePath();
    const mg = ctx.createLinearGradient(0, 340, 0, 1080);
    mg.addColorStop(0, '#1c3e66');
    mg.addColorStop(1, '#081422');
    ctx.fillStyle = mg;
    ctx.fill();

    // Moon
    const rg = ctx.createRadialGradient(1550, 180, 0, 1550, 180, 80);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.4, '#ffe4a0');
    rg.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(1550, 180, 80, 0, Math.PI * 2);
    ctx.fill();

    // Taskbar
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 1030, 1920, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('❖', 24, 1064);
    ['📁', '🌐', '⚙️', '✉️', '🎵', '📊'].forEach((ic, i) => ctx.fillText(ic, 75 + i * 46, 1064));
    ctx.font = '16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('10:42 PM', 1890, 1062);
    ctx.textAlign = 'left';

    // Terminal
    ctx.fillStyle = 'rgba(4, 9, 15, 0.85)';
    ctx.fillRect(60, 60, 540, 310);
    ctx.strokeStyle = '#00ff99';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, 540, 310);
    ctx.fillStyle = '#00ff99';
    ctx.font = '16px monospace';
    const lines = [
      '$ systemctl status display-engine',
      '> ProVision Ultra 32" OLED: ACTIVE',
      '> Resolution: 3840 x 2160',
      '> Refresh Rate: 144 Hz G-Sync',
      '> HDR Profile: 1000 nits Peak',
      '> Color Gamut: 99% DCI-P3',
      '$ ready_'
    ];
    lines.forEach((l, i) => ctx.fillText(l, 82, 104 + i * 36));

    if (Math.floor(timeSec * 2) % 2 === 0) {
      ctx.fillRect(150, 104 + 6 * 36 - 13, 10, 16);
    }
  }
  drawScreen(0);
  ctx.fillStyle = "#060709"; ctx.fillRect(0, 0, sCanvas.width, sCanvas.height);

  const screenTex = new THREE.CanvasTexture(sCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenOnMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const screenOffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: screenTex, roughness: 0.2, metalness: 0.1 });

  // Monitor Display Assembly (Origin at Center)
  const monitorHead = new THREE.Group();


  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.12), bodyMat);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  monitorHead.add(chassis);

  // Active Screen Surface
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.32, 2.52), screenOffMat);
  screenMesh.position.z = 0.062;
  screenMesh.name = "monitor-screen";
  monitorHead.add(screenMesh);

  // Bezels
  const bw = 0.04, bd = 0.02;
  const tB = new THREE.Mesh(new THREE.BoxGeometry(4.4, bw, bd), bezelMat);
  tB.position.set(0, 1.29, 0.062);
  const bB = new THREE.Mesh(new THREE.BoxGeometry(4.4, bw + 0.02, bd), bezelMat);
  bB.position.set(0, -1.29, 0.062);
  const lB = new THREE.Mesh(new THREE.BoxGeometry(bw, 2.6, bd), bezelMat);
  lB.position.set(-2.19, 0, 0.062);
  const rB = new THREE.Mesh(new THREE.BoxGeometry(bw, 2.6, bd), bezelMat);
  rB.position.set(2.19, 0, 0.062);
  monitorHead.add(tB, bB, lB, rB);

  // Standard 100mm VESA Mount Pattern (Rear)
  const vesa = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 32), darkMetal);
  vesa.rotation.x = Math.PI / 2;
  vesa.position.set(0, 0, -0.075);
  monitorHead.add(vesa);

  for (let i = 0; i < 4; i++) {
    const ang = (Math.PI / 2) * i + Math.PI / 4;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.035, 16), rubberMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(Math.cos(ang) * 0.24, Math.sin(ang) * 0.24, -0.076);
    monitorHead.add(hole);
  }

  // IO Inset Bay
  const ioBay = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.04), rubberMat);
  ioBay.position.set(0, -0.95, -0.07);
  monitorHead.add(ioBay);

  // Power LED
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x00c8ff });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 16), ledMat);
  led.position.set(0, -1.29, 0.075);
  monitorHead.add(led);

  // RGB Ambient Backlight Array
  const rgbDots = [];
  for (let i = 0; i < 30; i++) {
    const dMat = new THREE.MeshBasicMaterial({ color: 0x00c8ff });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), dMat);
    dot.position.set(-1.9 + (3.8 / 29) * i, 1.15, -0.068);
    monitorHead.add(dot);
    rgbDots.push({ mesh: dot, offset: i });
  }

  const scale = .8128 / Math.hypot(4.4, 2.6);
  monitorHead.scale.setScalar(scale);
  monitorHead.position.y = 1.32 * scale;
  vesa.name = 'display-vesa-mount';
  if (portrait) {
    // Keep the flat panel, mounting hardware and bezels; turn the assembly
    // upright and keep the desktop artwork oriented toward the viewer.
    monitorHead.rotation.z = Math.PI/2;
    const uv=screenMesh.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,v,1-u);}
    uv.needsUpdate=true;
  }
  return monitorHead;
}
