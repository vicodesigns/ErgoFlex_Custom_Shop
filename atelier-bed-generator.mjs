// Owner-supplied Atelier bed generator; metres, Y up, headboard toward -Z.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x42454453;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function createProceduralTextures() {
      // 1. Heavy Bouclé / Upholstery Weave
      const boucleCanvas = document.createElement('canvas');
      boucleCanvas.width = 256;
      boucleCanvas.height = 256;
      const bCtx = boucleCanvas.getContext('2d');
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 3) {
        for (let x = 0; x < 256; x += 3) {
          const n = Math.sin(x * 0.45) * Math.cos(y * 0.45) * 28 + (random() * 52 - 26);
          const v = Math.max(24, Math.min(235, Math.floor(128 + n)));
          bCtx.fillStyle = `rgb(${v},${v},${v})`;
          bCtx.beginPath();
          bCtx.arc(x + (y % 2), y, 1.6, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
      const boucleTex = new THREE.CanvasTexture(boucleCanvas);
      boucleTex.wrapS = boucleTex.wrapT = THREE.RepeatWrapping;
      boucleTex.repeat.set(14, 14);

      // 2. Crisp Belgian Linen & Baffle Quilt Bump Map
      const linenCanvas = document.createElement('canvas');
      linenCanvas.width = 512;
      linenCanvas.height = 512;
      const lCtx = linenCanvas.getContext('2d');
      lCtx.fillStyle = '#888888';
      lCtx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 2) {
        for (let x = 0; x < 512; x += 2) {
          const weave = (Math.sin(x * 0.9) + Math.cos(y * 0.9)) * 8 + (random() - 0.5) * 14;
          const v = Math.max(60, Math.min(220, Math.floor(140 + weave)));
          lCtx.fillStyle = `rgb(${v},${v},${v})`;
          lCtx.fillRect(x, y, 2, 2);
        }
      }
      const linenTex = new THREE.CanvasTexture(linenCanvas);
      linenTex.wrapS = linenTex.wrapT = THREE.RepeatWrapping;
      linenTex.repeat.set(12, 12);

      // 3. Waffle Knit Throw Blanket Texture
      const waffleCanvas = document.createElement('canvas');
      waffleCanvas.width = 256;
      waffleCanvas.height = 256;
      const wfCtx = waffleCanvas.getContext('2d');
      wfCtx.fillStyle = '#707070';
      wfCtx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 8) {
        for (let x = 0; x < 256; x += 8) {
          wfCtx.fillStyle = '#b5b5b5';
          wfCtx.fillRect(x + 1, y + 1, 5, 5);
        }
      }
      const waffleTex = new THREE.CanvasTexture(waffleCanvas);
      waffleTex.wrapS = waffleTex.wrapT = THREE.RepeatWrapping;
      waffleTex.repeat.set(18, 10);

      // 4. American Walnut Cathedral Timber Grain
      const woodCanvas = document.createElement('canvas');
      woodCanvas.width = 512;
      woodCanvas.height = 256;
      const wCtx = woodCanvas.getContext('2d');
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 512; x += 2) {
          const wave = Math.sin(y * 0.15 + Math.sin(x * 0.025) * 4.0) * 20 + (random() - 0.5) * 8;
          const v = Math.max(55, Math.min(215, Math.floor(135 + wave)));
          wCtx.fillStyle = `rgb(${v},${v},${v})`;
          wCtx.fillRect(x, y, 2, 1);
        }
      }
      const woodTex = new THREE.CanvasTexture(woodCanvas);
      woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
      woodTex.repeat.set(2, 1);

      return { boucleTex, linenTex, waffleTex, woodTex };
    }

    const textures = createProceduralTextures();

    /**
     * Creates a contoured down duvet comforter with baffle-box quilt channels and side drape
     */
    function createDuvetGeometry(width, thickness, length, puffScale = 1.0) {
      const geom = new RoundedBoxGeometry(width, thickness, length, 6, 0.055);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();

      const hw = width * 0.5;
      const hh = thickness * 0.5;
      const hl = length * 0.5;

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const nx = THREE.MathUtils.clamp(v.x / hw, -1, 1);
        const ny = THREE.MathUtils.clamp(v.y / hh, -1, 1);
        const nz = THREE.MathUtils.clamp(v.z / hl, -1, 1);

        // Soft cosine billow across the top of the comforter
        const billow = Math.cos(nx * Math.PI * 0.47) * Math.cos(nz * Math.PI * 0.47);
        if (ny > 0) {
          // Subtle quilted baffle-box wave + lofty center crown
          const baffleX = Math.abs(Math.sin(nx * Math.PI * 2.5));
          const baffleZ = Math.abs(Math.sin(nz * Math.PI * 2.0));
          const quiltLoft = (0.85 + 0.15 * baffleX * baffleZ);
          v.y += billow * 0.052 * puffScale * quiltLoft;
        }

        // Gentle gravity drape along the left/right outer overhang edges
        if (Math.abs(nx) > 0.78) {
          const edgeFactor = (Math.abs(nx) - 0.78) / 0.22;
          v.y -= Math.pow(edgeFactor, 1.5) * 0.045;
        }

        pos.setXYZ(i, v.x, v.y, v.z);
      }

      geom.computeVertexNormals();
      return geom;
    }

    /**
     * Creates a tailored designer pillow (Euro sham, sleeping pillow, or lumbar cushion)
     */
    function createSculptedPillowGeometry(width, height, depth, puffScale = 1.0, karateChop = true) {
      const geom = new THREE.BoxGeometry(width, height, depth, 8, 8, 4);
      const pos = geom.attributes.position;
      const v = new THREE.Vector3();
      const hw = width * 0.5;
      const hh = height * 0.5;
      const hd = depth * 0.5;

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const nx = v.x / hw;
        const ny = v.y / hh;
        const nz = v.z / hd;

        // Knife-edge cosine crown profile
        const dome = Math.cos(nx * Math.PI * 0.5) * Math.cos(ny * Math.PI * 0.5);
        v.z = nz * hd * (0.18 + 0.96 * dome * puffScale);

        // Optional designer "karate-chop" top crease
        if (karateChop && ny > 0.25) {
          const indent = Math.exp(-Math.pow(nx * 3.4, 2)) * (ny - 0.25) * 0.032;
          v.y -= indent;
        }

        // Gentle forward plump curve
        v.z -= Math.pow(nx, 2) * 0.015;
        pos.setXYZ(i, v.x, v.y, v.z);
      }

      geom.computeVertexNormals();
      return geom;
    }

    function buildBeddingAssembly(cfg, bedDeckY, materials) {
      const beddingGroup = new THREE.Group();
      beddingGroup.name = 'LuxuryBeddingStack';

      const mW = cfg.mattressW;
      const mL = cfg.mattressL;
      const mH = 0.25;
      const mattressCenterY = bedDeckY + mH * 0.5;
      const mattressTopY = bedDeckY + mH;

      // 1. Quilted Pillow-Top Architectural Mattress
      const mattressGeom = new RoundedBoxGeometry(mW, mH, mL, 4, 0.042);
      const mattressMesh = new THREE.Mesh(mattressGeom, materials.sheetMat);
      mattressMesh.position.set(0, mattressCenterY, 0);
      beddingGroup.add(mattressMesh);

      // Upper Pillow-Top Euro Topper Pad
      const topperH = 0.045;
      const topperGeom = createDuvetGeometry(mW - 0.01, topperH, mL - 0.01, cfg.puffScale * 0.45);
      const topperMesh = new THREE.Mesh(topperGeom, materials.sheetMat);
      topperMesh.position.set(0, mattressTopY + topperH * 0.35, 0);
      beddingGroup.add(topperMesh);

      const surfaceTopY = mattressTopY + topperH * 0.65;

      // 2. Plush Baffled Down Duvet Comforter (Covers lower 74% of bed)
      const duvetL = mL * 0.73;
      const duvetW = mW + 0.09; // Drapes slightly over left & right mattress edges
      const duvetH = 0.085;
      const duvetZ = (mL * 0.5) - (duvetL * 0.5) + 0.02;

      const duvetGeom = createDuvetGeometry(duvetW, duvetH, duvetL, cfg.puffScale);
      const duvetMesh = new THREE.Mesh(duvetGeom, materials.duvetMat);
      duvetMesh.position.set(0, surfaceTopY + duvetH * 0.35, duvetZ);
      beddingGroup.add(duvetMesh);

      // 3. Crisp Turned-Down Top Sheet Collar (Folded back over upper edge of duvet)
      const collarL = 0.24;
      const collarZ = duvetZ - duvetL * 0.5 + collarL * 0.42;
      const collarGeom = createDuvetGeometry(duvetW + 0.01, 0.032, collarL, cfg.puffScale * 0.5);
      const collarMesh = new THREE.Mesh(collarGeom, materials.sheetMat);
      collarMesh.position.set(0, surfaceTopY + duvetH * 0.68, collarZ);
      collarMesh.rotation.x = -0.04;
      beddingGroup.add(collarMesh);

      // 4. Draped Waffle-Knit Foot Throw Blanket / Bed Runner
      if (cfg.throwBlanket) {
        const throwL = 0.52;
        const throwW = duvetW + 0.035;
        const throwZ = mL * 0.5 - throwL * 0.48;
        const throwGeom = createDuvetGeometry(throwW, 0.036, throwL, cfg.puffScale * 0.65);
        const throwMesh = new THREE.Mesh(throwGeom, materials.accentMat);
        throwMesh.position.set(0, surfaceTopY + duvetH * 0.72, throwZ);
        beddingGroup.add(throwMesh);
      }

      // 5. Three-Tier Designer Pillow Arrangement (Euro Shams + Sleeping + Lumbar)
      if (cfg.pillows) {
        const headEdgeZ = -mL * 0.5;
        const colCount = mW >= 1.90 ? 3 : 2;
        const euroW = mW >= 1.90 ? 0.58 : 0.64;
        const euroH = 0.54;
        const euroGeom = createSculptedPillowGeometry(euroW, euroH, 0.14, cfg.puffScale, true);

        const spanW = mW - 0.18;
        const startEuroX = -spanW * 0.5 + (spanW / colCount) * 0.5;
        const stepEuroX = spanW / colCount;

        // Tier 1: Back Euro Square Shams (Accent or Frame Fabric)
        for (let i = 0; i < colCount; i++) {
          const px = startEuroX + i * stepEuroX;
          const euroMesh = new THREE.Mesh(euroGeom, materials.secondaryPillowMat);
          euroMesh.position.set(px, surfaceTopY + euroH * 0.42, headEdgeZ + 0.16);
          euroMesh.rotation.x = -0.26;
          euroMesh.rotation.y = (i - (colCount - 1) * 0.5) * -0.05;
          beddingGroup.add(euroMesh);
        }

        // Tier 2: Plush Sleeping Pillows (2 across Queen, 2 wide King pillows)
        const sleepCols = 2;
        const sleepW = (mW - 0.22) / sleepCols;
        const sleepH = 0.42;
        const sleepGeom = createSculptedPillowGeometry(sleepW, sleepH, 0.15, cfg.puffScale, false);

        [-1, 1].forEach((side) => {
          const sx = side * (sleepW * 0.5 + 0.02);
          const sleepMesh = new THREE.Mesh(sleepGeom, materials.duvetMat);
          sleepMesh.position.set(sx, surfaceTopY + sleepH * 0.36, headEdgeZ + 0.34);
          sleepMesh.rotation.x = -0.42;
          sleepMesh.rotation.z = side * 0.02;
          beddingGroup.add(sleepMesh);
        });

        // Tier 3: Front Tailored Contrast Lumbar Cushions
        const lumbarGeom = createSculptedPillowGeometry(0.56, 0.25, 0.12, cfg.puffScale, true);
        if (mW >= 1.90) {
          [-1, 1].forEach((side) => {
            const lum = new THREE.Mesh(lumbarGeom, materials.accentMat);
            lum.position.set(side * (sleepW * 0.5 + 0.02), surfaceTopY + 0.13, headEdgeZ + 0.50);
            lum.rotation.x = -0.52;
            beddingGroup.add(lum);
          });
        } else {
          const lum = new THREE.Mesh(lumbarGeom, materials.accentMat);
          lum.position.set(0, surfaceTopY + 0.13, headEdgeZ + 0.50);
          lum.rotation.x = -0.52;
          beddingGroup.add(lum);
        }
      }

      return beddingGroup;
    }

    function buildBedScene(cfg) {
      const propGroup = new THREE.Group();
      propGroup.name = `AtelierBed_${cfg.archetype}`;

      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'StudioStagingContext';

      const mW = cfg.mattressW;
      const mL = cfg.mattressL;
      const headH = cfg.headHeight;

      // --- Configure PBR Materials ---
      const frameCol = new THREE.Color(cfg.frameColor);
      const frameSheen = frameCol.clone().lerp(new THREE.Color(0xffffff), 0.3);

      let frameMat;
      if (cfg.textile === 'leather') {
        frameMat = new THREE.MeshPhysicalMaterial({
          color: frameCol,
          roughness: 0.35,
          clearcoat: 0.22,
          clearcoatRoughness: 0.4,
          sheen: 0.25,
          bumpMap: textures.boucleTex,
          bumpScale: 0.0016,
          wireframe: cfg.wireframe
        });
      } else if (cfg.textile === 'velvet') {
        frameMat = new THREE.MeshPhysicalMaterial({
          color: frameCol,
          roughness: 0.58,
          sheen: 1.0,
          sheenRoughness: 0.24,
          sheenColor: frameSheen,
          bumpMap: textures.boucleTex,
          bumpScale: 0.0012,
          wireframe: cfg.wireframe
        });
      } else {
        frameMat = new THREE.MeshPhysicalMaterial({
          color: frameCol,
          roughness: 0.82,
          sheen: 0.95,
          sheenRoughness: 0.45,
          sheenColor: frameSheen,
          bumpMap: textures.boucleTex,
          bumpScale: 0.0036,
          wireframe: cfg.wireframe
        });
      }

      const duvetCol = new THREE.Color(cfg.linenColor);
      const duvetMat = new THREE.MeshPhysicalMaterial({
        color: duvetCol,
        roughness: 0.78,
        sheen: 0.75,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(0xffffff),
        bumpMap: textures.linenTex,
        bumpScale: 0.0022,
        wireframe: cfg.wireframe
      });

      const sheetMat = new THREE.MeshPhysicalMaterial({
        color: duvetCol.clone().lerp(new THREE.Color(0xffffff), 0.35),
        roughness: 0.65,
        sheen: 0.5,
        bumpMap: textures.linenTex,
        bumpScale: 0.0012,
        wireframe: cfg.wireframe
      });

      const accentCol = new THREE.Color(cfg.accentColor);
      const accentMat = new THREE.MeshPhysicalMaterial({
        color: accentCol,
        roughness: 0.68,
        sheen: 0.9,
        sheenColor: accentCol.clone().lerp(new THREE.Color(0xffffff), 0.32),
        bumpMap: textures.waffleTex,
        bumpScale: 0.0032,
        wireframe: cfg.wireframe
      });

      const secondaryPillowMat = new THREE.MeshPhysicalMaterial({
        color: frameCol.clone().lerp(duvetCol, 0.35),
        roughness: 0.75,
        sheen: 0.85,
        bumpMap: textures.boucleTex,
        bumpScale: 0.0025,
        wireframe: cfg.wireframe
      });

      const woodMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cfg.woodColor),
        roughness: 0.32,
        metalness: 0.04,
        clearcoat: 0.34,
        clearcoatRoughness: 0.25,
        bumpMap: textures.woodTex,
        bumpScale: 0.0020,
        wireframe: cfg.wireframe
      });

      const metalMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.metalColor),
        roughness: 0.22,
        metalness: 0.92,
        wireframe: cfg.wireframe
      });

      const coveLedMat = new THREE.MeshStandardMaterial({
        name:'Atelier warm cove LED',emissive:0xffcb88,emissiveIntensity:cfg.coveLight?1.2:0,
        color: cfg.coveLight ? 0xffcb88 : 0x3a3a3a,
        wireframe: cfg.wireframe
      });

      for(const [name,mat] of Object.entries({frame:frameMat,duvet:duvetMat,sheet:sheetMat,throw:accentMat,pillows:secondaryPillowMat,timber:woodMat,metal:metalMat}))mat.name='Atelier bed '+name;
      coveLedMat.userData.atelierBedGlow=cfg.coveLight?1.2:0;
      let bedDeckY = 0.26;
      let totalFootprintW = mW + 0.24;
      let totalFootprintL = mL + 0.24;
      let totalElevationH = headH;

      const headWallZ = -mL * .5 - (cfg.headInset ?? .09);

      // =========================================================================
      // ARCHETYPE 1: MILANO CANTILEVER WING-WALL PLATFORM BED
      // =========================================================================
      if (cfg.archetype === 'platform') {
        const plinthH = 0.14;
        const railH = 0.16;
        bedDeckY = plinthH + railH * 0.65;

        // Recessed Shadow-Gap Floating Plinth
        const plinth = new THREE.Mesh(
          new RoundedBoxGeometry(mW - 0.28, plinthH, mL - 0.24, 3, 0.01),
          woodMat
        );
        plinth.position.set(0, plinthH * 0.5, 0.04);
        propGroup.add(plinth);

        // Under-bed Warm Floating LED Perimeter Strip
        const underStrip = new THREE.Mesh(
          new THREE.BoxGeometry(mW - 0.24, 0.012, mL - 0.20),
          coveLedMat
        );
        underStrip.position.set(0, plinthH - 0.01, 0.04);
        propGroup.add(underStrip);

        // Wide Upholstered Cantilever Platform Surround Rails
        const surroundW = mW + 0.22;
        const surroundL = mL + (cfg.lengthExtra ?? .18);
        const surround = new THREE.Mesh(
          new RoundedBoxGeometry(surroundW, railH, surroundL, 5, 0.032),
          frameMat
        );
        surround.position.set(0, plinthH + railH * 0.5, 0.03);
        propGroup.add(surround);

        // Architectural Extended Timber Wing-Wall Headboard + Integrated Cove Light
        const wingSpanW = cfg.wingSpan ?? mW + .96;
        const woodBackboard = new THREE.Mesh(
          new RoundedBoxGeometry(wingSpanW, headH, 0.055, 4, 0.014),
          woodMat
        );
        woodBackboard.position.set(0, headH * 0.5, headWallZ - 0.04);
        propGroup.add(woodBackboard);

        // Glowing Top & Side Architectural LED Cove Reveal Strip
        const coveBar = new THREE.Mesh(
          new THREE.BoxGeometry(wingSpanW - 0.08, 0.016, 0.018),
          coveLedMat
        );
        coveBar.position.set(0, headH - 0.03, headWallZ - 0.008);
        propGroup.add(coveBar);

        // Plush Channel-Tufted Upholstered Headboard Cushions Centered on Wing-Wall
        const panelCols = cfg.tufting ? 6 : 2;
        const totalPanelW = mW + 0.12;
        const colW = totalPanelW / panelCols;
        const panelH = headH - plinthH - 0.10;

        for (let c = 0; c < panelCols; c++) {
          const px = -totalPanelW * 0.5 + colW * 0.5 + c * colW;
          const panel = new THREE.Mesh(
            new RoundedBoxGeometry(colW - 0.008, panelH, 0.095, 5, 0.028),
            frameMat
          );
          panel.position.set(px, plinthH + panelH * 0.5 + 0.02, headWallZ + 0.025);
          propGroup.add(panel);
        }

        // Integrated Floating Cantilever Nightstand Shelves on Wing-Wall
        if(cfg.integratedShelves!==false)[-1, 1].forEach((side) => {
          const shelfX = side * (mW * 0.5 + 0.28);
          const shelf = new THREE.Mesh(
            new RoundedBoxGeometry(0.38, 0.065, 0.34, 4, 0.012),
            woodMat
          );
          shelf.position.set(shelfX, 0.34, headWallZ + 0.15);

          const brassInlay = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.008, 0.01),
            metalMat
          );
          brassInlay.position.set(0, 0, 0.171);
          shelf.add(brassInlay);
          propGroup.add(shelf);
        });

        totalFootprintW = wingSpanW;
        totalFootprintL = surroundL + 0.08;
      }

      // =========================================================================
      // ARCHETYPE 2: ARCHITECTURAL FOUR-POSTER CANOPY SANCTUARY BED
      // =========================================================================
      else if (cfg.archetype === 'canopy') {
        const legH = 0.22;
        const railH = 0.15;
        bedDeckY = legH + railH * 0.65;
        const canopyH = Math.max(2.05, headH + 0.85);
        totalElevationH = canopyH;

        const postSpanX = mW + 0.12;
        const postSpanZ = mL + 0.12;
        const postThick = 0.046;

        // 4 Full-Height Architectural Timber & Brass Corner Posts
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const px = sx * postSpanX * 0.5;
          const pz = sz * postSpanZ * 0.5;

          const post = new THREE.Mesh(
            new RoundedBoxGeometry(postThick, canopyH, postThick, 3, 0.008),
            woodMat
          );
          post.position.set(px, canopyH * 0.5, pz);
          propGroup.add(post);

          // Brass Foot Sabot & Top Finial Collar
          const footCollar = new THREE.Mesh(
            new RoundedBoxGeometry(postThick + 0.004, 0.08, postThick + 0.004, 2, 0.006),
            metalMat
          );
          footCollar.position.set(px, 0.04, pz);

          const topCollar = new THREE.Mesh(
            new RoundedBoxGeometry(postThick + 0.004, 0.045, postThick + 0.004, 2, 0.006),
            metalMat
          );
          topCollar.position.set(px, canopyH - 0.022, pz);
          propGroup.add(footCollar, topCollar);
        });

        // Upper Canopy Perimeter Tie-Beams
        [-1, 1].forEach((sx) => {
          const sideBeam = new THREE.Mesh(
            new RoundedBoxGeometry(postThick * 0.85, postThick * 0.85, postSpanZ, 3, 0.006),
            woodMat
          );
          sideBeam.position.set(sx * postSpanX * 0.5, canopyH - postThick * 0.5, 0);
          propGroup.add(sideBeam);
        });
        [-1, 1].forEach((sz) => {
          const crossBeam = new THREE.Mesh(
            new RoundedBoxGeometry(postSpanX, postThick * 0.85, postThick * 0.85, 3, 0.006),
            woodMat
          );
          crossBeam.position.set(0, canopyH - postThick * 0.5, sz * postSpanZ * 0.5);
          propGroup.add(crossBeam);
        });

        // Lower Timber Surround Frame
        const baseFrame = new THREE.Mesh(
          new RoundedBoxGeometry(postSpanX, railH, postSpanZ, 4, 0.015),
          woodMat
        );
        baseFrame.position.set(0, legH + railH * 0.5, 0);
        propGroup.add(baseFrame);

        // Twin Split Upholstered Headboard Cushions Suspended with Brass Straps
        const hbPanelH = headH - bedDeckY;
        const hbPanelW = (mW - 0.06) * 0.5;
        [-1, 1].forEach((side) => {
          const cx = side * (hbPanelW * 0.5 + 0.018);
          const hbCushion = new THREE.Mesh(
            createSculptedPillowGeometry(hbPanelW, hbPanelH, 0.11, cfg.puffScale * 0.8, false),
            frameMat
          );
          hbCushion.position.set(cx, bedDeckY + hbPanelH * 0.52, -postSpanZ * 0.5 + 0.05);
          propGroup.add(hbCushion);
        });

        totalFootprintW = postSpanX + 0.08;
        totalFootprintL = postSpanZ + 0.08;
      }

      // =========================================================================
      // ARCHETYPE 3: CLOUD BOUCLÉ TUFTED WINGBACK SANCTUARY BED
      // =========================================================================
      else if (cfg.archetype === 'wingback') {
        const footH = 0.06;
        const bolsterRailH = 0.24;
        bedDeckY = footH + bolsterRailH * 0.72;

        // Oversized Padded Cloud Surround Bumper Rails
        const cloudW = mW + 0.28;
        const cloudL = mL + (cfg.lengthExtra ?? .24);
        const bumper = new THREE.Mesh(
          new RoundedBoxGeometry(cloudW, bolsterRailH, cloudL, 8, 0.075),
          frameMat
        );
        bumper.position.set(0, footH + bolsterRailH * 0.5, 0.04);
        propGroup.add(bumper);

        // Biscuit-Tufted / Channel-Puffed Headboard Grid
        const cols = cfg.tufting ? 4 : 2;
        const rows = cfg.tufting ? 2 : 1;
        const hbW = cloudW;
        const hbH = headH - footH;
        const cellW = hbW / cols;
        const cellH = hbH / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const bx = -hbW * 0.5 + cellW * 0.5 + c * cellW;
            const by = footH + cellH * 0.5 + r * cellH;
            const biscuit = new THREE.Mesh(
              new RoundedBoxGeometry(cellW - 0.01, cellH - 0.01, 0.18, 6, 0.048),
              frameMat
            );
            biscuit.position.set(bx, by, headWallZ);
            propGroup.add(biscuit);
          }
        }

        // Wrap-Around Shelter Wingback Ears (Left & Right)
        [-1, 1].forEach((side) => {
          const ear = new THREE.Mesh(
            new RoundedBoxGeometry(0.14, hbH, 0.38, 6, 0.045),
            frameMat
          );
          ear.position.set(side * (hbW * 0.5 + 0.03), footH + hbH * 0.5, headWallZ + 0.14);
          ear.rotation.y = side * -0.18;
          propGroup.add(ear);
        });

        totalFootprintW = cloudW + 0.14;
        totalFootprintL = cloudL + 0.12;
      }

      // =========================================================================
      // ARCHETYPE 4: KYOTO LOW ARCHITECTURAL TATAMI JOINERY BED
      // =========================================================================
      else {
        const legH = 0.10;
        const deckThick = 0.065;
        bedDeckY = legH + deckThick;

        const tatamiW = mW + (cfg.deckOverhang ?? .58);
        const tatamiL = mL + (cfg.lengthExtra ?? .36);

        // Wide Low Timber Joinery Deck Platform
        const timberDeck = new THREE.Mesh(
          new RoundedBoxGeometry(tatamiW, deckThick, tatamiL, 4, 0.014),
          woodMat
        );
        timberDeck.position.set(0, legH + deckThick * 0.5, 0.06);
        propGroup.add(timberDeck);

        // Recessed Cylindrical Timber Support Blocks
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const foot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.045, legH, 24),
            woodMat
          );
          foot.position.set(sx * (mW * 0.45), legH * 0.5, sz * (mL * 0.42));
          propGroup.add(foot);
        });

        // Angled Slatted Timber Headboard Backrest
        const slatGroup = new THREE.Group();
        const slatH = headH - bedDeckY + 0.08;
        slatGroup.position.set(0, bedDeckY, headWallZ + 0.04);
        slatGroup.rotation.x = -0.10;

        // Top & Bottom Horizontal Joinery Rails
        const topRail = new THREE.Mesh(
          new RoundedBoxGeometry(tatamiW, 0.045, 0.045, 3, 0.008),
          woodMat
        );
        topRail.position.set(0, slatH, 0);
        slatGroup.add(topRail);

        const slatCount = 22;
        const slatStep = (tatamiW - 0.16) / (slatCount - 1);
        for (let s = 0; s < slatCount; s++) {
          const sx = -(tatamiW - 0.16) * 0.5 + s * slatStep;
          const slat = new THREE.Mesh(
            new RoundedBoxGeometry(0.032, slatH, 0.022, 2, 0.004),
            woodMat
          );
          slat.position.set(sx, slatH * 0.5, 0);
          slatGroup.add(slat);
        }

        // Twin Hung Upholstered Headrest Bolsters with Brass Buckle Straps
        const bolsterW = (mW - 0.12) * 0.5;
        [-1, 1].forEach((side) => {
          const bx = side * (bolsterW * 0.5 + 0.025);
          const bolster = new THREE.Mesh(
            new RoundedBoxGeometry(bolsterW, slatH * 0.58, 0.095, 5, 0.035),
            frameMat
          );
          bolster.position.set(bx, slatH * 0.56, 0.055);
          slatGroup.add(bolster);
        });

        propGroup.add(slatGroup);
        totalFootprintW = tatamiW;
        totalFootprintL = tatamiL;
      }

      // Add Multi-Layer Mattress, Duvet, Throw & Pillows
      const bedding = buildBeddingAssembly(cfg, bedDeckY, {
        sheetMat,
        duvetMat,
        accentMat,
        secondaryPillowMat
      });
      propGroup.add(bedding);

      // Optional Matching End-of-Bed Architectural Bench
      if (cfg.bench) {
        const benchGroup = new THREE.Group();
        benchGroup.name = 'EndOfBedBenchProp';
        const benchW = mW * 0.76;
        const benchD = 0.44;
        const benchZ = mL * 0.5 + 0.36;
        benchGroup.position.set(0, 0, benchZ);

        // Timber Base Plinth & Brass/Wood Legs
        const benchPlinth = new THREE.Mesh(
          new RoundedBoxGeometry(benchW, 0.038, benchD, 3, 0.008),
          woodMat
        );
        benchPlinth.position.y = 0.28;
        benchGroup.add(benchPlinth);

        const benchCushion = new THREE.Mesh(
          createDuvetGeometry(benchW - 0.01, 0.12, benchD - 0.01, cfg.puffScale * 0.7),
          frameMat
        );
        benchCushion.position.y = 0.355;
        benchGroup.add(benchCushion);

        [-1, 1].forEach((sx) => {
          const sledLeg = new THREE.Mesh(
            new RoundedBoxGeometry(0.032, 0.27, benchD * 0.84, 3, 0.008),
            cfg.archetype === 'tatami' ? woodMat : metalMat
          );
          sledLeg.position.set(sx * (benchW * 0.42), 0.135, 0);
          benchGroup.add(sledLeg);
        });

        propGroup.add(benchGroup);
        totalFootprintL += 0.62;
      }

      // Optional Studio Staging Context (Excluded from standalone .GLB export)
      if (cfg.staging) {
        // 1. Textured Plaster & Fluted Timber Sanctuary Wall
        const wallMesh = new THREE.Mesh(
          new RoundedBoxGeometry(totalFootprintW + 1.4, 2.75, 0.08, 2, 0.01),
          new THREE.MeshStandardMaterial({
            color: 0x171a21,
            roughness: 0.88,
            bumpMap: textures.linenTex,
            bumpScale: 0.0015
          })
        );
        wallMesh.position.set(0, 1.375, headWallZ - 0.12);
        stagingGroup.add(wallMesh);

        // 2. Plush Woven Sanctuary Area Rug Under the Bed
        const rugW = totalFootprintW + 0.95;
        const rugL = totalFootprintL + 0.85;
        const rugMesh = new THREE.Mesh(
          new RoundedBoxGeometry(rugW, 0.012, rugL, 2, 0.005),
          new THREE.MeshStandardMaterial({
            color: 0x22262e,
            roughness: 0.92,
            bumpMap: textures.boucleTex,
            bumpScale: 0.0035
          })
        );
        rugMesh.position.set(0, 0.006, 0.24);
        stagingGroup.add(rugMesh);

        // 3. Twin Architectural Brass & Opal Glass Wall Sconces Flanking the Bed
        [-1, 1].forEach((side) => {
          const sconceX = side * (mW * 0.5 + 0.34);
          const sconceY = 1.12;
          const sconceZ = headWallZ - 0.06;

          const backplate = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, 0.28, 16),
            metalMat
          );
          backplate.position.set(sconceX, sconceY, sconceZ);

          const opalOrb = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 24, 24),
            new THREE.MeshPhysicalMaterial({
              color: 0xfff5e4,
              emissive: 0xffb86c,
              emissiveIntensity: cfg.coveLight ? 1.35 : 0,
              roughness: 0.15,
              transmission: 0.65
            })
          );
          opalOrb.position.set(sconceX, sconceY, sconceZ + 0.055);
          stagingGroup.add(backplate, opalOrb);
        });
      }

      // Enable Shadows across all Prop & Staging Meshes
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
        headWallZ,
        dimensions: {
          width: totalFootprintW,
          length: totalFootprintL,
          height: totalElevationH
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

export function createAtelierBed(config={}){
 const cfg={archetype:'platform',mattressW:1.6,mattressL:2,headHeight:1.18,puffScale:1,textile:'boucle',frameColor:'#dfd7c8',linenColor:'#faf8f5',accentColor:'#8c735b',woodColor:'#78583a',metalColor:'#b69a5e',pillows:true,throwBlanket:true,tufting:true,coveLight:true,...config,bench:false,staging:false,wireframe:false};
 if(!['platform','canopy','wingback','tatami'].includes(cfg.archetype)||cfg.mattressW<1.35||cfg.mattressW>2.2||cfg.mattressL<1.9||cfg.mattressL>2.2||cfg.headHeight<.8||cfg.headHeight>1.5)throw Error('Unsupported Atelier bed dimensions');
 const {propGroup}=buildBedScene(cfg),materials=new Set();
 propGroup.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();for(const m of [].concat(o.material))materials.add(m);}});
 for(const m of materials){if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(m.bumpScale>.003?.4:.25);m.bumpMap=null;}m.userData.roomPaletteLocked=true;}
 propGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(propGroup),center=bounds.getCenter(new THREE.Vector3());propGroup.position.set(-center.x,-bounds.min.y,-center.z);propGroup.updateMatrixWorld(true);
 propGroup.name='Atelier '+cfg.archetype+' bed '+(cfg.family||cfg.textile);propGroup.userData={atelierBed:true,archetype:cfg.archetype,mattress:[cfg.mattressW,cfg.mattressL],headboard:'-Z',family:cfg.family};
 return propGroup;
}
