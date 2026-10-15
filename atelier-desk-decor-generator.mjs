// Owner-supplied Atelier desk accessories generator; metres, Y up.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x4445434f;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function createProceduralTextures() {
      // 1. Fine Hardwood Timber Grain
      const woodCanvas = document.createElement('canvas');
      woodCanvas.width = 512;
      woodCanvas.height = 256;
      const wCtx = woodCanvas.getContext('2d');
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x += 2) {
          const wave = Math.sin(y * 0.16 + Math.sin(x * 0.025) * 4.0) * 18 + (random() - 0.5) * 8;
          const v = Math.max(55, Math.min(215, Math.floor(138 + wave)));
          wCtx.fillStyle = `rgb(${v},${v},${v})`;
          wCtx.fillRect(x, y, 2, 1);
        }
      }
      const woodTex = new THREE.CanvasTexture(woodCanvas);
      woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;

      // 2. Travertine / Veined Stone Texture
      const stoneCanvas = document.createElement('canvas');
      stoneCanvas.width = 512;
      stoneCanvas.height = 512;
      const sCtx = stoneCanvas.getContext('2d');
      sCtx.fillStyle = '#888888';
      sCtx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 1200; i++) {
        const x = random() * 512;
        const y = random() * 512;
        const r = 4 + random() * 18;
        const a = 0.03 + random() * 0.05;
        sCtx.fillStyle = random() > 0.45 ? `rgba(255,255,255,${a})` : `rgba(30,30,30,${a})`;
        sCtx.beginPath();
        sCtx.arc(x, y, r, 0, Math.PI * 2);
        sCtx.fill();
      }
      const stoneTex = new THREE.CanvasTexture(stoneCanvas);
      stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;

      // 3. Pebble Leather & Merino Felt Weave
      const leatherCanvas = document.createElement('canvas');
      leatherCanvas.width = 256;
      leatherCanvas.height = 256;
      const lCtx = leatherCanvas.getContext('2d');
      lCtx.fillStyle = '#808080';
      lCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4800; i++) {
        const x = random() * 256;
        const y = random() * 256;
        const v = 100 + Math.floor(random() * 65);
        lCtx.fillStyle = `rgb(${v},${v},${v})`;
        lCtx.fillRect(x, y, 2, 2);
      }
      const leatherTex = new THREE.CanvasTexture(leatherCanvas);
      leatherTex.wrapS = leatherTex.wrapT = THREE.RepeatWrapping;
      leatherTex.repeat.set(8, 8);

      // 4. Fountain Pen Dot-Grid Journal Spread Texture
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = 512;
      pageCanvas.height = 512;
      const pCtx = pageCanvas.getContext('2d');
      pCtx.fillStyle = '#faf6ee';
      pCtx.fillRect(0, 0, 512, 512);

      // Dot grid
      pCtx.fillStyle = '#cbd5e1';
      for (let x = 24; x < 490; x += 20) {
        for (let y = 24; y < 490; y += 20) {
          pCtx.fillRect(x, y, 2, 2);
        }
      }
      // Architectural sketch lines & handwritten calligraphy simulation
      pCtx.strokeStyle = '#1e293b';
      pCtx.lineWidth = 2.5;
      pCtx.strokeRect(44, 48, 190, 140);
      pCtx.beginPath();
      pCtx.arc(139, 118, 46, 0, Math.PI * 2);
      pCtx.stroke();

      pCtx.strokeStyle = '#b45309';
      pCtx.lineWidth = 2;
      for (let y = 230; y < 440; y += 26) {
        pCtx.beginPath();
        pCtx.moveTo(44, y);
        pCtx.bezierCurveTo(140, y - 8, 260, y + 8, 440, y - 3);
        pCtx.stroke();
      }
      const pageTex = new THREE.CanvasTexture(pageCanvas);pageTex.colorSpace=THREE.SRGBColorSpace;

      // 5. Retro Split-Flap Mechanical Clock Face Texture
      const clockCanvas = document.createElement('canvas');
      clockCanvas.width = 512;
      clockCanvas.height = 256;
      const cCtx = clockCanvas.getContext('2d');
      cCtx.fillStyle = '#14161b';
      cCtx.fillRect(0, 0, 512, 256);

      // Left & Right Flap Cards
      cCtx.fillStyle = '#20242c';
      cCtx.roundRect(28, 28, 210, 200, 16);
      cCtx.roundRect(274, 28, 210, 200, 16);
      cCtx.fill();

      cCtx.fillStyle = '#f8fafc';
      cCtx.font = '700 128px "JetBrains Mono", monospace';
      cCtx.textAlign = 'center';
      cCtx.textBaseline = 'middle';
      cCtx.fillText('10', 133, 132);
      cCtx.fillText('42', 379, 132);

      // Horizontal split-flap gap line
      cCtx.fillStyle = '#0b0d11';
      cCtx.fillRect(20, 125, 472, 6);
      const clockTex = new THREE.CanvasTexture(clockCanvas);clockTex.colorSpace=THREE.SRGBColorSpace;

      return { woodTex, stoneTex, leatherTex, pageTex, clockTex };
    }

    const textures = createProceduralTextures();

    /**
     * Builds a two-layer Merino Wool Felt + Saddle-Stitched Leather Desk Mat
     */
    function buildDeskMat(spanW, spanD, materials) {
      const matGroup = new THREE.Group();
      matGroup.name = 'DualLayerDeskMat';

      // Lower Charcoal Merino Felt Base Pad
      const feltBase = new THREE.Mesh(
        new RoundedBoxGeometry(spanW, 0.004, spanD, 4, 0.012),
        materials.darkFeltMat
      );
      feltBase.position.y = 0.002;
      matGroup.add(feltBase);

      // Upper Full-Grain Leather Blotter Pad with Perimeter Stitching
      const leatherW = spanW - 0.032;
      const leatherD = spanD - 0.028;
      const leatherTop = new THREE.Mesh(
        new RoundedBoxGeometry(leatherW, 0.004, leatherD, 4, 0.010),
        materials.leatherMat
      );
      leatherTop.position.y = 0.0055;
      matGroup.add(leatherTop);

      // Subtle Brushed Brass Corner Badge on Bottom-Right of Desk Mat
      const badge = new THREE.Mesh(
        new RoundedBoxGeometry(0.038, 0.005, 0.014, 2, 0.002),
        materials.metalMat
      );
      badge.position.set(leatherW * 0.5 - 0.035, 0.006, leatherD * 0.5 - 0.022);
      matGroup.add(badge);

      return matGroup;
    }

    /**
     * Builds a detailed 3D Fountain Pen with 18k Gold Nib, Ink Feed & Pocket Clip
     */
    function buildFountainPen(materials) {
      const pen = new THREE.Group();
      pen.name = 'ArtisanalFountainPen';

      // Lacquered / Resin Barrel
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0065, 0.0052, 0.115, 24),
        materials.obsidianMat
      );
      barrel.rotation.z = Math.PI * 0.5;
      pen.add(barrel);

      // Brushed Brass Center Band Ring & Cap Lip
      [-0.015, 0.038].forEach((xPos) => {
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0068, 0.0068, 0.005, 24),
          materials.metalMat
        );
        ring.rotation.z = Math.PI * 0.5;
        ring.position.x = xPos;
        pen.add(ring);
      });

      // Pocket Clip
      const clip = new THREE.Mesh(
        new RoundedBoxGeometry(0.038, 0.002, 0.003, 1, 0.001),
        materials.metalMat
      );
      clip.position.set(-0.032, 0.0072, 0);
      pen.add(clip);

      // Tapered Grip Section + Sculpted Gold Fountain Nib
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0055, 0.0042, 0.022, 20),
        materials.obsidianMat
      );
      grip.rotation.z = Math.PI * 0.5;
      grip.position.x = 0.068;
      pen.add(grip);

      const nib = new THREE.Mesh(
        new THREE.ConeGeometry(0.0042, 0.018, 4),
        materials.metalMat
      );
      nib.rotation.z = -Math.PI * 0.5;
      nib.rotation.x = Math.PI * 0.25;
      nib.scale.set(1, 1, 0.35);
      nib.position.x = 0.086;
      pen.add(nib);

      return pen;
    }

    /**
     * Builds an Amber Apothecary Glass Scented Candle with Glowing Flame
     */
    function buildArtisanCandle(materials, isLit) {
      const candle = new THREE.Group();
      candle.name = 'AmberGlassCandle';

      const jarR = 0.038;
      const jarH = 0.082;

      // Amber Glass Vessel
      const vessel = new THREE.Mesh(
        new THREE.CylinderGeometry(jarR, jarR * 0.95, jarH, 28),
        materials.amberGlassMat
      );
      vessel.position.y = jarH * 0.5;
      candle.add(vessel);

      // Cream Soy Wax Fill
      const wax = new THREE.Mesh(
        new THREE.CylinderGeometry(jarR * 0.88, jarR * 0.86, jarH * 0.76, 24),
        new THREE.MeshStandardMaterial({ color: 0xf7f2e7, roughness: 0.45 })
      );
      wax.position.y = (jarH * 0.76) * 0.5 + 0.004;
      candle.add(wax);

      // Minimalist Parchment Label on Front of Jar
      const label = new THREE.Mesh(
        new THREE.CylinderGeometry(jarR + 0.0005, jarR * 0.97 + 0.0005, jarH * 0.42, 24, 1, true, -0.6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xf5efe2, roughness: 0.7 })
      );
      label.position.y = jarH * 0.48;
      candle.add(label);

      // Cotton Wick & Glowing Flame Drop
      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0012, 0.0012, 0.012, 8),
        materials.obsidianMat
      );
      wick.position.y = jarH * 0.76 + 0.006;
      candle.add(wick);

      if (isLit) {
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.0055, 0.018, 14),
          new THREE.MeshStandardMaterial({name:'Decor candle flame',color:0xffb84d,emissive:0xffb84d,emissiveIntensity:1.6})
        );
        flame.position.y = jarH * 0.76 + 0.018;
        candle.add(flame);
      }

      return candle;
    }

    /**
     * Builds a Ceramic Planter with a Sculptural Haworthia / Succulent Rosette
     */
    function buildSucculentVessel(materials) {
      const plantGroup = new THREE.Group();
      plantGroup.name = 'CeramicSucculentVessel';

      const potR = 0.046;
      const potH = 0.068;

      // Ribbed Ceramic Pot on Turned Wood Foot
      const woodFoot = new THREE.Mesh(
        new THREE.CylinderGeometry(potR * 0.88, potR * 0.82, 0.016, 24),
        materials.woodMat
      );
      woodFoot.position.y = 0.008;
      plantGroup.add(woodFoot);

      const ceramicPot = new THREE.Mesh(
        new THREE.CylinderGeometry(potR, potR * 0.90, potH, 28),
        materials.stoneMat
      );
      ceramicPot.position.y = 0.016 + potH * 0.5;
      plantGroup.add(ceramicPot);

      // Soil Bed
      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(potR * 0.92, potR * 0.92, 0.008, 20),
        materials.obsidianMat
      );
      soil.position.y = 0.016 + potH - 0.006;
      plantGroup.add(soil);

      // Layered Fibonacci Succulent Rosette Leaves
      const leafMat = new THREE.MeshPhysicalMaterial({
        color: 0x3b6e52,
        roughness: 0.42,
        clearcoat: 0.28,
        wireframe: materials.woodMat.wireframe
      });

      const baseTopY = 0.016 + potH;
      for (let ring = 0; ring < 3; ring++) {
        const count = 6 + ring * 3;
        const radius = 0.012 + ring * 0.011;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + ring * 0.5;
          const leaf = new THREE.Mesh(
            new RoundedBoxGeometry(0.014, 0.032 - ring * 0.004, 0.007, 2, 0.003),
            leafMat
          );
          leaf.position.set(
            Math.cos(angle) * radius,
            baseTopY + 0.014 - ring * 0.002,
            Math.sin(angle) * radius
          );
          leaf.rotation.y = -angle + Math.PI * 0.5;
          leaf.rotation.x = 0.35 + ring * 0.24;
          plantGroup.add(leaf);
        }
      }

      return plantGroup;
    }

    function buildAccessoryScene(cfg) {
      const propGroup = new THREE.Group();
      propGroup.name = `AtelierDeskAccessories_${cfg.archetype}`;

      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'StudioStagingContext';

      const spanW = cfg.spread;
      const spanD = cfg.depth;

      // --- Shared PBR Materials ---
      const woodMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.woodColor),
        roughness: 0.30,
        metalness: 0.04,
        clearcoat: 0.35,
        clearcoatRoughness: 0.22,
        bumpMap: textures.woodTex,
        bumpScale: 0.0015,
        wireframe: cfg.wireframe
      });

      const metalMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.metalColor),
        roughness: 0.20,
        metalness: 0.92,
        wireframe: cfg.wireframe
      });

      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.16,
        metalness: 0.94,
        wireframe: cfg.wireframe
      });

      const stoneMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.stoneColor),
        roughness: 0.28,
        clearcoat: 0.25,
        bumpMap: textures.stoneTex,
        bumpScale: 0.0014,
        wireframe: cfg.wireframe
      });

      const leatherCol = new THREE.Color(cfg.leatherColor);
      const leatherMat = new THREE.MeshPhysicalMaterial({
        color: leatherCol,
        roughness: 0.52,
        sheen: 0.65,
        sheenColor: leatherCol.clone().lerp(new THREE.Color(0xffffff), 0.25),
        bumpMap: textures.leatherTex,
        bumpScale: 0.0018,
        wireframe: cfg.wireframe
      });

      const darkFeltMat = new THREE.MeshPhysicalMaterial({
        color: 0x22262e,
        roughness: 0.88,
        sheen: 0.8,
        bumpMap: textures.leatherTex,
        bumpScale: 0.0025,
        wireframe: cfg.wireframe
      });

      const obsidianMat = new THREE.MeshPhysicalMaterial({
        color: 0x161920,
        roughness: 0.24,
        metalness: 0.15,
        clearcoat: 0.6,
        wireframe: cfg.wireframe
      });

      const clearGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        roughness: 0.06,
        transmission: 0.88,
        transparent: true,
        opacity: 0.45,
        ior: 1.5,
        wireframe: cfg.wireframe
      });

      const amberGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xd97706,
        roughness: 0.12,
        transmission: 0.72,
        transparent: true,
        opacity: 0.78,
        ior: 1.52,
        wireframe: cfg.wireframe
      });

      const materials = {
        woodMat,
        metalMat,
        chromeMat,
        stoneMat,
        leatherMat,
        darkFeltMat,
        obsidianMat,
        clearGlassMat,
        amberGlassMat
      };

      for(const [name,mat] of Object.entries(materials))mat.name='Atelier decor '+name;
      // Base Elevation (sits on top of Desk Mat if enabled)
      const matTopY = cfg.includeDeskMat ? 0.008 : 0.0;
      if (cfg.includeDeskMat) {
        propGroup.add(buildDeskMat(spanW, spanD, materials));
      }

      let maxElevationH = 0.24;
      let warmLightAnchor = new THREE.Vector3(0.22, 0.12, 0.08);

      // =======================================================================
      // ARCHETYPE 1: ARTISANAL STATIONERY & FOUNTAIN PEN VALET SET
      // =======================================================================
      if (cfg.archetype === 'stationery') {
        // 1. Multi-Groove Hardwood & Brass Valet Organizer Box + Articulated Drawer
        const valetGroup = new THREE.Group();valetGroup.name="Decor component valet";
        valetGroup.position.set(-spanW * 0.26, matTopY, -spanD * 0.18);

        const vW = 0.26, vH = 0.044, vD = 0.14;
        const valetCarcass = new THREE.Mesh(
          new RoundedBoxGeometry(vW, vH, vD, 4, 0.008),
          woodMat
        );
        valetCarcass.position.y = vH * 0.5;
        valetGroup.add(valetCarcass);

        // Leather-lined Catchall Tray Cavity on Top of Valet
        const trayLiner = new THREE.Mesh(
          new RoundedBoxGeometry(vW * 0.52, 0.004, vD - 0.024, 2, 0.004),
          leatherMat
        );
        trayLiner.position.set(-vW * 0.20, vH + 0.001, 0);
        valetGroup.add(trayLiner);

        // Sliding Brass-Front Valet Drawer (Controlled by Articulation Slider!)
        const drawerSlideZ = cfg.articulation * 0.068;
        const drawer = new THREE.Group();
        drawer.position.set(vW * 0.22, vH * 0.45, drawerSlideZ);

        const drawerBox = new THREE.Mesh(
          new RoundedBoxGeometry(vW * 0.44, vH * 0.68, vD - 0.02, 3, 0.004),
          stoneMat
        );
        drawer.add(drawerBox);

        const brassPull = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.004, 0.028, 16),
          metalMat
        );
        brassPull.rotation.z = Math.PI * 0.5;
        brassPull.position.set(0, 0, (vD - 0.02) * 0.5 + 0.006);
        drawer.add(brassPull);

        // Wax Seal Stamp & Brass Paperclips inside Drawer
        const sealStamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.010, 0.012, 0.024, 18),
          metalMat
        );
        sealStamp.position.set(0, 0.012, 0.015);
        drawer.add(sealStamp);

        valetGroup.add(drawer);

        // Faceted Crystal Inkwell Bottle with Knurled Brass Cap on Right of Valet
        const inkwell = new THREE.Mesh(
          new RoundedBoxGeometry(0.044, 0.046, 0.044, 3, 0.006),
          clearGlassMat
        );
        inkwell.position.set(vW * 0.24, vH + 0.023, -0.01);
        valetGroup.add(inkwell);

        const inkCore = new THREE.Mesh(
          new RoundedBoxGeometry(0.034, 0.028, 0.034, 2, 0.004),
          new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.2 })
        );
        inkCore.position.set(vW * 0.24, vH + 0.018, -0.01);
        valetGroup.add(inkCore);

        const inkCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.014, 0.016, 20),
          metalMat
        );
        inkCap.position.set(vW * 0.24, vH + 0.052, -0.01);
        valetGroup.add(inkCap);

        propGroup.add(valetGroup);

        // 2. Open Lay-Flat Leather Notebook Journal with Brass Bookmark & Fountain Pen
        const journalGroup = new THREE.Group();journalGroup.name="Decor component journal";
        journalGroup.position.set(0.02, matTopY, spanD * 0.08);
        journalGroup.rotation.y = -0.06;

        const jW = 0.29, jD = 0.21, jH = 0.018;
        const leatherCover = new THREE.Mesh(
          new RoundedBoxGeometry(jW + 0.012, 0.005, jD + 0.012, 2, 0.002),
          leatherMat
        );
        leatherCover.position.y = 0.0025;
        journalGroup.add(leatherCover);

        // Left & Right Curved Open Cream Paper Page Blocks
        [-1, 1].forEach((side) => {
          const pageBlock = new THREE.Mesh(
            new RoundedBoxGeometry(jW * 0.49, jH, jD, 4, 0.004),
            new THREE.MeshStandardMaterial({
              map: textures.pageTex,
              roughness: 0.72,
              wireframe: cfg.wireframe
            })
          );
          pageBlock.position.set(side * (jW * 0.245), 0.005 + jH * 0.5, 0);
          pageBlock.rotation.z = side * -0.03;
          journalGroup.add(pageBlock);
        });

        // Fountain Pen Resting Diagonally Across the Open Journal
        const pen = buildFountainPen(materials);
        pen.position.set(0.03, 0.005 + jH + 0.006, 0.02);
        pen.rotation.y = 0.48 + cfg.articulation * 0.35;
        journalGroup.add(pen);

        propGroup.add(journalGroup);

        // 3. Retro Mechanical Split-Flap Desk Clock (Top Center-Right)
        if (cfg.includeClock) {
          const clockGroup = new THREE.Group();clockGroup.name="Decor component clock";
          clockGroup.position.set(spanW * 0.14, matTopY, -spanD * 0.22);
          clockGroup.rotation.y = -0.18;

          const cW = 0.16, cH = 0.088, cD = 0.068;
          const clockShell = new THREE.Mesh(
            new RoundedBoxGeometry(cW, cH, cD, 4, 0.012),
            woodMat
          );
          clockShell.position.y = cH * 0.5 + 0.014;
          clockGroup.add(clockShell);

          // Brass Pedestal Feet
          [-0.055, 0.055].forEach((fx) => {
            const foot = new THREE.Mesh(
              new RoundedBoxGeometry(0.016, 0.016, cD * 0.78, 2, 0.004),
              metalMat
            );
            foot.position.set(fx, 0.008, 0);
            clockGroup.add(foot);
          });

          // Split-Flap Faceplate
          const clockFace = new THREE.Mesh(
            new THREE.PlaneGeometry(cW - 0.02, cH - 0.02),
            new THREE.MeshBasicMaterial({ map: textures.clockTex, wireframe: cfg.wireframe })
          );
          clockFace.position.set(0, cH * 0.5 + 0.014, cD * 0.5 + 0.001);
          clockGroup.add(clockFace);

          propGroup.add(clockGroup);
        }

        // 4. Biophilic Ceramic Succulent Vessel & Amber Scented Candle
        if (cfg.includeBotanical) {
          const plant = buildSucculentVessel(materials);
          plant.position.set(spanW * 0.34, matTopY, -spanD * 0.12);
          propGroup.add(plant);
        }

        if (cfg.includeCurios) {
          const candle = buildArtisanCandle(materials, cfg.accentLight);
          candle.position.set(spanW * 0.30, matTopY, spanD * 0.20);
          propGroup.add(candle);
          warmLightAnchor.set(spanW * 0.30, matTopY + 0.11, spanD * 0.20);

          // Brass Magnifying Loupe & Solid Brass Ruler
          const ruler = new THREE.Mesh(
            new RoundedBoxGeometry(0.22, 0.004, 0.026, 2, 0.001),
            metalMat
          );
          ruler.position.set(-spanW * 0.25, matTopY + 0.002, spanD * 0.22);
          ruler.rotation.y = 0.12;
          propGroup.add(ruler);
        }
      }

      // =======================================================================
      // ARCHETYPE 2: SCULPTURAL BOOKENDS, ART MONOGRAPHS & KINETIC ORRERY
      // =======================================================================
      else if (cfg.archetype === 'curiosities') {
        // 1. Vertical Stack of Hardcover Design Monographs Flanked by Marble & Brass Bookends
        const bookHub = new THREE.Group();bookHub.name="Decor component bookends";
        bookHub.position.set(-spanW * 0.18, matTopY, -0.02);

        const bookColors = [0x1e293b, 0x9a3412, 0x3f4f44, 0xd6d3d1];
        const bookWidths = [0.034, 0.042, 0.028, 0.038];
        let curX = -0.075;

        bookWidths.forEach((bw, idx) => {
          const bH = 0.21 + (idx % 2) * 0.022;
          const bD = 0.165 + (idx % 2) * 0.012;
          const bookMat = new THREE.MeshPhysicalMaterial({
            color: bookColors[idx],
            roughness: 0.65,
            sheen: 0.5,
            bumpMap: textures.leatherTex,
            bumpScale: 0.0015,
            wireframe: cfg.wireframe
          });

          const spine = new THREE.Mesh(
            new RoundedBoxGeometry(bw, bH, bD, 3, 0.005),
            bookMat
          );
          spine.position.set(curX + bw * 0.5, bH * 0.5, 0);
          bookHub.add(spine);
          curX += bw + 0.002;
        });

        // Left & Right Architectural Travertine Arch & Brass Orb Bookends
        [[-0.075 - 0.042, -1], [curX + 0.042, 1]].forEach(([bx, side]) => {
          const archColumn = new THREE.Mesh(
            new RoundedBoxGeometry(0.072, 0.155, 0.145, 5, 0.016),
            stoneMat
          );
          archColumn.position.set(bx, 0.155 * 0.5, 0);
          bookHub.add(archColumn);

          const brassSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.034, 28, 24),
            metalMat
          );
          brassSphere.position.set(bx + side * 0.015, 0.034, 0.035);
          bookHub.add(brassSphere);
        });

        propGroup.add(bookHub);
        maxElevationH = 0.28;

        // 2. Kinetic Brass Armillary Sphere / Orbital Orrery Sculpture
        if (cfg.includeClock) {
          const orreryGroup = new THREE.Group();orreryGroup.name="Decor component orrery";
          orreryGroup.position.set(spanW * 0.20, matTopY, -0.02);

          // Stepped Walnut & Brass Pedestal
          const pedWood = new THREE.Mesh(
            new THREE.CylinderGeometry(0.068, 0.076, 0.028, 32),
            woodMat
          );
          pedWood.position.y = 0.014;
          orreryGroup.add(pedWood);

          const pedBrass = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.024, 0.055, 24),
            metalMat
          );
          pedBrass.position.y = 0.028 + 0.0275;
          orreryGroup.add(pedBrass);

          // Gimbal Rings (Rotated by Articulation Slider!)
          const centerY = 0.165;
          const ring1 = new THREE.Mesh(
            new THREE.TorusGeometry(0.088, 0.0045, 14, 48),
            metalMat
          );
          ring1.position.y = centerY;
          ring1.rotation.y = cfg.articulation * Math.PI * 1.5;
          ring1.rotation.z = 0.28;
          orreryGroup.add(ring1);

          const ring2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.068, 0.0038, 12, 42),
            chromeMat
          );
          ring2.position.y = centerY;
          ring2.rotation.x = 0.65 + cfg.articulation * Math.PI;
          ring2.rotation.y = -cfg.articulation * Math.PI;
          orreryGroup.add(ring2);

          // Central Radiant Sun Core + Orbiting Travertine Planet Moon
          const sunOrb = new THREE.Mesh(
            new THREE.SphereGeometry(0.024, 24, 24),
            metalMat
          );
          sunOrb.position.y = centerY;
          orreryGroup.add(sunOrb);

          const moonAngle = cfg.articulation * Math.PI * 2;
          const moonOrb = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 20, 20),
            stoneMat
          );
          moonOrb.position.set(
            Math.cos(moonAngle) * 0.068,
            centerY + Math.sin(moonAngle) * 0.025,
            Math.sin(moonAngle) * 0.068
          );
          orreryGroup.add(moonOrb);

          propGroup.add(orreryGroup);
        }

        // 3. Sculptural Ikebana Bud Vase & Botanical Stem
        if (cfg.includeBotanical) {
          const vaseGroup = new THREE.Group();
          vaseGroup.position.set(spanW * 0.35, matTopY, -spanD * 0.22);

          const vaseBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.022, 0.044, 0.135, 28),
            stoneMat
          );
          vaseBody.position.y = 0.135 * 0.5;
          vaseGroup.add(vaseBody);

          const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0025, 0.003, 0.18, 12),
            woodMat
          );
          stem.position.set(0.008, 0.16, 0);
          stem.rotation.z = -0.22;
          vaseGroup.add(stem);

          propGroup.add(vaseGroup);
        }

        // 4. Tortoiseshell Reading Glasses & Brass Sand Hourglass in Foreground
        if (cfg.includeCurios) {
          const candle = buildArtisanCandle(materials, cfg.accentLight);
          candle.position.set(0.02, matTopY, spanD * 0.22);
          propGroup.add(candle);
          warmLightAnchor.set(0.02, matTopY + 0.11, spanD * 0.22);
        }
      }

      // =======================================================================
      // ARCHETYPE 3: CUSTOM 65% MECHANICAL KEYBOARD, AVIATOR CABLE & TUBE DAC
      // =======================================================================
      else if (cfg.archetype === 'mechanical') {
        // 1. Custom 65% Gasket-Mount Mechanical Keyboard + Sculpted Keycap Matrix
        const kbGroup = new THREE.Group();
        kbGroup.position.set(-spanW * 0.08, matTopY, spanD * 0.05);

        const kbW = 0.325, kbD = 0.118, kbH = 0.026;
        const kbCase = new THREE.Mesh(
          new RoundedBoxGeometry(kbW, kbH, kbD, 4, 0.006),
          woodMat
        );
        kbCase.position.y = kbH * 0.5 + 0.004;
        kbCase.rotation.x = 0.085; // 5-degree typing angle
        kbGroup.add(kbCase);

        // Brushed Brass Bottom Weight Bar Visible Along Front Lip
        const brassWeight = new THREE.Mesh(
          new RoundedBoxGeometry(kbW - 0.02, 0.006, kbD - 0.01, 2, 0.002),
          metalMat
        );
        brassWeight.position.y = 0.003;
        kbGroup.add(brassWeight);

        // Sculpted 5-Row × 15-Column Keycap Matrix + Artisan Esc & Enter Keycaps
        const rows = 5, cols = 15;
        const startX = -kbW * 0.45;
        const startZ = -kbD * 0.38;
        const stepX = (kbW * 0.84) / cols;
        const stepZ = (kbD * 0.78) / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            // Skip bottom middle slots to place a 6.25u Spacebar
            if (r === 4 && c >= 4 && c <= 9) {
              if (c === 4) {
                const spacebar = new THREE.Mesh(
                  new RoundedBoxGeometry(stepX * 5.8, 0.011, stepZ * 0.86, 2, 0.002),
                  leatherMat
                );
                spacebar.position.set(
                  startX + 6.5 * stepX,
                  kbH + 0.008 - r * 0.0018,
                  startZ + r * stepZ
                );
                spacebar.rotation.x = 0.085;
                kbGroup.add(spacebar);
              }
              continue;
            }

            // Skip top-right corner for the Knurled Brass Rotary Encoder Knob
            if (r === 0 && c === 14) continue;

            const isAccentKey = (r === 0 && c === 0) || (r === 2 && c === 13);
            const isModifier = c === 0 || c >= 13;
            const keyMat = isAccentKey ? leatherMat : (isModifier ? darkFeltMat : stoneMat);

            const keycap = new THREE.Mesh(
              new RoundedBoxGeometry(stepX * 0.86, 0.011, stepZ * 0.86, 2, 0.002),
              keyMat
            );
            keycap.position.set(
              startX + c * stepX,
              kbH + 0.008 - r * 0.0018,
              startZ + r * stepZ
            );
            keycap.rotation.x = 0.085;
            kbGroup.add(keycap);
          }
        }

        // Top-Right Knurled Brass Rotary Volume Knob (Rotates via Articulation Slider)
        const rotaryKnob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.011, 0.016, 24),
          metalMat
        );
        rotaryKnob.position.set(startX + 14 * stepX, kbH + 0.012, startZ);
        rotaryKnob.rotation.y = cfg.articulation * Math.PI * 2;
        kbGroup.add(rotaryKnob);

        // Detached Hardwood Ergonomic Wrist Rest in Front of Keyboard
        const wristRest = new THREE.Mesh(
          new RoundedBoxGeometry(kbW, 0.016, 0.076, 4, 0.005),
          woodMat
        );
        wristRest.position.set(0, 0.008 + cfg.articulation * 0.0, kbD * 0.5 + 0.052 + cfg.articulation * 0.025);
         wristRest.rotation.x = 0.06;
        kbGroup.add(wristRest);

        // Coiled Braided Aviator Cable Behind Keyboard + GX16 Brass Connector
        const coilGroup = new THREE.Group();
        coilGroup.position.set(-0.06, 0.012, -kbD * 0.5 - 0.042);
        for (let i = 0; i < 18; i++) {
          const loop = new THREE.Mesh(
            new THREE.TorusGeometry(0.010, 0.0032, 10, 20),
            leatherMat
          );
          loop.rotation.y = Math.PI * 0.5;
          loop.position.x = i * 0.0062;
          coilGroup.add(loop);
        }
        const aviatorPlug = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0075, 0.0075, 0.042, 20),
          chromeMat
        );
        aviatorPlug.rotation.z = Math.PI * 0.5;
        aviatorPlug.position.x = 18 * 0.0062 + 0.024;
        coilGroup.add(aviatorPlug);
        kbGroup.add(coilGroup);

        propGroup.add(kbGroup);

        // 2. Audiophile Vacuum Tube Headphone DAC/Amp with Glowing Glass Tubes
        if (cfg.includeClock) {
          const dacGroup = new THREE.Group();dacGroup.name="Decor component dac";
          dacGroup.position.set(spanW * 0.28, matTopY, -spanD * 0.14);
          dacGroup.rotation.y = -0.22;

          const dacChassis = new THREE.Mesh(
            new RoundedBoxGeometry(0.145, 0.046, 0.135, 4, 0.006),
            obsidianMat
          );
          dacChassis.position.y = 0.023;
          dacGroup.add(dacChassis);

          // Front Brushed Brass Volume Wheel
          const volWheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.016, 24),
            metalMat
          );
          volWheel.rotation.x = Math.PI * 0.5;
          volWheel.position.set(0.036, 0.023, 0.135 * 0.5 + 0.006);
          dacGroup.add(volWheel);

          // Twin Glowing Glass Vacuum Tubes on Top of DAC
          [-0.032, 0.032].forEach((tx) => {
            const socketRing = new THREE.Mesh(
              new THREE.CylinderGeometry(0.016, 0.018, 0.008, 20),
              metalMat
            );
            socketRing.position.set(tx, 0.046 + 0.004, -0.01);
            dacGroup.add(socketRing);

            const glassTube = new THREE.Mesh(
              new THREE.CylinderGeometry(0.012, 0.012, 0.046, 20),
              clearGlassMat
            );
            glassTube.position.set(tx, 0.046 + 0.026, -0.01);
            dacGroup.add(glassTube);

            // Glowing Amber Cathode Heater Core Inside Vacuum Tube
            const filament = new THREE.Mesh(
              new THREE.CylinderGeometry(0.0045, 0.0045, 0.028, 12),
              new THREE.MeshStandardMaterial({
                name:'Decor tube heater',emissive:0xff9933,emissiveIntensity:1.1,
                color: cfg.accentLight ? 0xff9933 : 0x333333
              })
            );
            filament.position.set(tx, 0.046 + 0.024, -0.01);
            dacGroup.add(filament);
          });

          propGroup.add(dacGroup);
          warmLightAnchor.set(spanW * 0.28, matTopY + 0.10, -spanD * 0.14);
        }

        // 3. Ergonomic Sculpted Wireless Mouse & Succulent
        if (cfg.includeCurios) {
          const mouse = new THREE.Mesh(
            new RoundedBoxGeometry(0.064, 0.038, 0.112, 6, 0.018),
            obsidianMat
          );
          mouse.position.set(spanW * 0.26, matTopY + 0.019, spanD * 0.14);
          mouse.rotation.y = -0.08;
          propGroup.add(mouse);
        }

        if (cfg.includeBotanical) {
          const plant = buildSucculentVessel(materials);
          plant.position.set(-spanW * 0.34, matTopY, -spanD * 0.20);
          propGroup.add(plant);
        }
      }

      // =======================================================================
      // ARCHETYPE 4: BIOPHILIC ZEN GARDEN, BONSAI TERRARIUM & POUR-OVER COFFEE
      // =======================================================================
      else {
        // 1. Hand-Blown Glass Terrarium Globe with Moss & Sculptural Bonsai Tree
        const terrariumGroup = new THREE.Group();terrariumGroup.name="Decor component terrarium";
        terrariumGroup.position.set(-spanW * 0.22, matTopY, -0.04);

        const globeR = 0.105;
        const woodPedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(globeR * 0.78, globeR * 0.72, 0.024, 32),
          woodMat
        );
        woodPedestal.position.y = 0.012;
        terrariumGroup.add(woodPedestal);

        // Interior Moss Mound & Sculptural Bonsai Trunk + Canopy Clouds
        const mossBed = new THREE.Mesh(
          new THREE.SphereGeometry(globeR * 0.88, 28, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
          new THREE.MeshStandardMaterial({ color: 0x2d5a3c, roughness: 0.9 })
        );
        mossBed.position.y = globeR + 0.014;
        terrariumGroup.add(mossBed);

        if (cfg.includeBotanical) {
          const trunkCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.04, 0),
            new THREE.Vector3(-0.018, 0.085, 0.01),
            new THREE.Vector3(0.015, 0.125, -0.008),
            new THREE.Vector3(0.005, 0.155, 0)
          ]);
          const trunk = new THREE.Mesh(
            new THREE.TubeGeometry(trunkCurve, 20, 0.007, 10, false),
            woodMat
          );
          terrariumGroup.add(trunk);

          const foliageMat = new THREE.MeshStandardMaterial({ color: 0x3b7a57, roughness: 0.75 });
          [
            [-0.022, 0.13, 0.01, 0.032],
            [0.024, 0.145, -0.01, 0.028],
            [0.0, 0.168, 0.0, 0.036]
          ].forEach(([fx, fy, fz, fr]) => {
            const canopy = new THREE.Mesh(new THREE.SphereGeometry(fr, 20, 16), foliageMat);
            canopy.scale.set(1.3, 0.65, 1.1);
            canopy.position.set(fx, fy, fz);
            terrariumGroup.add(canopy);
          });
        }

        // Outer Blown-Glass Terrarium Sphere + Brass Top Vent Ring
        const glassSphere = new THREE.Mesh(
          new THREE.SphereGeometry(globeR, 36, 28),
          clearGlassMat
        );
        glassSphere.position.y = globeR + 0.016;
        terrariumGroup.add(glassSphere);

        const topBrassRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.028, 0.004, 12, 28),
          metalMat
        );
        topBrassRing.rotation.x = Math.PI * 0.5;
        topBrassRing.position.y = globeR * 2 + 0.012;
        terrariumGroup.add(topBrassRing);

        propGroup.add(terrariumGroup);
        maxElevationH = 0.25;

        // 2. Tabletop Raked Karesansui Zen Sand Tray, River Stones & Bamboo Rake
        const zenTray = new THREE.Group();zenTray.name="Decor component zen";
        zenTray.position.set(0.04, matTopY, spanD * 0.12);

        const zW = 0.23, zD = 0.15, zH = 0.022;
        const trayFrame = new THREE.Mesh(
          new RoundedBoxGeometry(zW, zH, zD, 4, 0.005),
          woodMat
        );
        trayFrame.position.y = zH * 0.5;
        zenTray.add(trayFrame);

        const sandBed = new THREE.Mesh(
          new RoundedBoxGeometry(zW - 0.018, 0.006, zD - 0.018, 2, 0.002),
          stoneMat
        );
        sandBed.position.y = zH - 0.002;
        zenTray.add(sandBed);

        // Stacked River Stones Inside Zen Garden
        [
          [-0.045, 0.024, -0.015, 0.024],
          [-0.022, 0.021, 0.018, 0.018],
          [-0.035, 0.036, -0.008, 0.014]
        ].forEach(([sx, sy, sz, sr]) => {
          const pebble = new THREE.Mesh(new THREE.SphereGeometry(sr, 20, 16), obsidianMat);
          pebble.scale.set(1.2, 0.65, 0.95);
          pebble.position.set(sx, sy, sz);
          zenTray.add(pebble);
        });

        // Miniature Brass & Timber Zen Rake (Moves Across Sand via Articulation Slider!)
        const rakeX = 0.01 + (cfg.articulation - 0.4) * 0.08;
        const rakeHandle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0025, 0.0025, 0.13, 12),
          metalMat
        );
        rakeHandle.rotation.x = Math.PI * 0.5;
        rakeHandle.rotation.z = 0.25;
        rakeHandle.position.set(rakeX, zH + 0.005, 0.01);
        zenTray.add(rakeHandle);

        propGroup.add(zenTray);

        // 3. Brass Pour-Over Coffee Dripper Stand, Glass Carafe & Stoneware Mug
        if (cfg.includeClock) {
          const coffeeStand = new THREE.Group();
          coffeeStand.position.set(spanW * 0.28, matTopY, -spanD * 0.10);

          const baseBoard = new THREE.Mesh(
            new RoundedBoxGeometry(0.14, 0.016, 0.15, 3, 0.004),
            woodMat
          );
          baseBoard.position.y = 0.008;
          coffeeStand.add(baseBoard);

          // Brass L-Arm Stand + Ring Holder
          const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.005, 0.005, 0.195, 16),
            metalMat
          );
          pillar.position.set(0, 0.105, -0.052);
          coffeeStand.add(pillar);

          const ringArm = new THREE.Mesh(
            new THREE.TorusGeometry(0.038, 0.0045, 12, 32),
            metalMat
          );
          ringArm.rotation.x = Math.PI * 0.5;
          ringArm.position.set(0, 0.165, 0);
          coffeeStand.add(ringArm);

          // Ceramic V60 Cone Dripper Resting in Brass Ring
          const dripper = new THREE.Mesh(
            new THREE.ConeGeometry(0.048, 0.068, 28, 1, true),
            stoneMat
          );
          dripper.rotation.x = Math.PI;
          dripper.position.set(0, 0.175, 0);
          coffeeStand.add(dripper);

          // Borosilicate Glass Server Carafe + Dark Espresso Core Below Dripper
          const carafe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.034, 0.048, 0.095, 28),
            clearGlassMat
          );
          carafe.position.set(0, 0.016 + 0.0475, 0);
          coffeeStand.add(carafe);

          const coffeeLiquid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.039, 0.044, 0.046, 24),
            new THREE.MeshStandardMaterial({ color: 0x29150a, roughness: 0.15 })
          );
          coffeeLiquid.position.set(0, 0.016 + 0.025, 0);
          coffeeStand.add(coffeeLiquid);

          propGroup.add(coffeeStand);
        }

        // 4. Brass Incense Holder & Scented Candle
        if (cfg.includeCurios) {
          const candle = buildArtisanCandle(materials, cfg.accentLight);
          candle.position.set(0.05, matTopY, -spanD * 0.22);
          propGroup.add(candle);
          warmLightAnchor.set(0.05, matTopY + 0.11, -spanD * 0.22);
        }
      }

      // Apply Global Scale Factor to Prop Group
      propGroup.scale.setScalar(cfg.scale);

      // =======================================================================
      // STUDIO STAGING CONTEXT (Architectural Desktop Surface Slab & Wall)
      // =======================================================================
      if (cfg.staging) {
        // Thick Chamfered Desktop Slab Supporting the Accessories
        const deskSlabW = spanW * cfg.scale + 0.65;
        const deskSlabD = spanD * cfg.scale + 0.45;
        const deskSlab = new THREE.Mesh(
          new RoundedBoxGeometry(deskSlabW, 0.045, deskSlabD, 4, 0.012),
          new THREE.MeshPhysicalMaterial({
            color: 0x1a1d24,
            roughness: 0.48,
            clearcoat: 0.18,
            bumpMap: textures.woodTex,
            bumpScale: 0.0012
          })
        );
        deskSlab.position.set(0, -0.0225, 0);
        stagingGroup.add(deskSlab);

        // Textured Architectural Fluted Wall Backdrop Behind the Desk
        const wallZ = -deskSlabD * 0.5 - 0.08;
        const backdropWall = new THREE.Mesh(
          new RoundedBoxGeometry(deskSlabW + 0.8, 1.4, 0.04, 2, 0.008),
          new THREE.MeshStandardMaterial({
            color: 0x12151c,
            roughness: 0.88
          })
        );
        backdropWall.position.set(0, 0.55, wallZ);
        stagingGroup.add(backdropWall);
      }

      // Enable Shadows across all Meshes
      const enableShadows = (grp) => {
        grp.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      };
      enableShadows(propGroup);
      enableShadows(stagingGroup);

      return {
        propGroup,
        stagingGroup,
        warmLightAnchor: warmLightAnchor.multiplyScalar(cfg.scale),
        dimensions: {
          width: spanW * cfg.scale,
          depth: spanD * cfg.scale,
          height: maxElevationH * cfg.scale
        }
      };
    }

// glTF uses normal maps; its bump extension is not supported by the viewer.
const normals=new Map();
function normalTexture(heightMap){
 if(normals.has(heightMap))return normals.get(heightMap);
 const source=heightMap.image,w=source.width,h=source.height,data=source.getContext('2d').getImageData(0,0,w,h).data;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(w,h),sample=(x,y)=>data[(((y+h)%h)*w+(x+w)%w)*4]/255;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const n=new THREE.Vector3((sample(x-1,y)-sample(x+1,y))*1.5,(sample(x,y-1)-sample(x,y+1))*1.5,1).normalize(),i=(y*w+x)*4;
  image.data[i]=(n.x*.5+.5)*255;image.data[i+1]=(n.y*.5+.5)*255;image.data[i+2]=(n.z*.5+.5)*255;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.copy(heightMap.repeat);normals.set(heightMap,map);return map;
}

export function createDeskDecor(config={}){
 const cfg={archetype:'stationery',component:'complete',spread:.78,depth:.42,articulation:.4,woodColor:'#4a2c18',metalColor:'#b69a5e',stoneColor:'#e4ded3',leatherColor:'#8c4a27',includeDeskMat:true,includeClock:true,includeBotanical:true,includeCurios:true,...config,accentLight:true,scale:1,staging:false,wireframe:false};
 if(!['stationery','curiosities','mechanical','botanical'].includes(cfg.archetype)||cfg.spread<.6||cfg.spread>1.1||cfg.depth<.3||cfg.depth>.6)throw Error('Unsupported desk decor dimensions');
 let {propGroup}=buildAccessoryScene(cfg);
 if(cfg.component!=='complete'){const component=propGroup.getObjectByName('Decor component '+cfg.component);if(!component)throw Error('Missing decor component '+cfg.component);propGroup.remove(component);propGroup=new THREE.Group();propGroup.add(component);}
 const materials=new Set();propGroup.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();for(const m of [].concat(o.material))materials.add(m);}});
 for(const m of materials){if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(.28);m.bumpMap=null;}m.userData.roomPaletteLocked=true;if(m.name==='Decor candle flame'||m.name==='Decor tube heater')m.userData.decorGlow=m.emissiveIntensity;}
 propGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(propGroup),center=bounds.getCenter(new THREE.Vector3());propGroup.position.set(-center.x,-bounds.min.y,-center.z);propGroup.updateMatrixWorld(true);
 propGroup.name='Atelier decor '+cfg.archetype+' '+cfg.component;propGroup.userData={atelierDecor:true,archetype:cfg.archetype,component:cfg.component,family:cfg.family};return propGroup;
}
