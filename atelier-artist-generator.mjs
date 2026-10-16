// Owner-supplied Atelier fine art and illustration studio; metres, Y up.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
let seed=0x41525453;
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

      // 2. Stitched Leather & Felt Texture
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

      // 3. Digital Art / Concept Masterpiece Painting Texture (Cinematic Sci-Fi Concept Art Style)
      const artCanvas = document.createElement('canvas');
      artCanvas.width = 1024;
      artCanvas.height = 768;
      const aCtx = artCanvas.getContext('2d');
      const grad = aCtx.createLinearGradient(0, 0, 1024, 768);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#312e81');
      aCtx.fillStyle = grad;
      aCtx.fillRect(0, 0, 1024, 768);

      // Celestial Horizon & Glowing Nebula Orbs
      aCtx.fillStyle = '#f43f5e';
      aCtx.beginPath();
      aCtx.arc(512, 384, 140, 0, Math.PI * 2);
      aCtx.fill();

      aCtx.fillStyle = '#06b6d4';
      aCtx.beginPath();
      aCtx.arc(320, 260, 60, 0, Math.PI * 2);
      aCtx.fill();

      // Digital Brush Strokes & Splashes
      aCtx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
      aCtx.lineWidth = 8;
      aCtx.beginPath();
      aCtx.moveTo(120, 650);
      aCtx.bezierCurveTo(320, 420, 720, 520, 900, 200);
      aCtx.stroke();

      const artTex = new THREE.CanvasTexture(artCanvas); artTex.colorSpace=THREE.SRGBColorSpace;

      return { woodTex, leatherTex, artTex };
    }

    const textures = createProceduralTextures();

    /**
     * Builds a stitched leather desk mat or canvas blotter pad
     */
    function buildDeskMat(spanW, spanD, materials) {
      const group = new THREE.Group();
      group.name = 'Artist component blotter';

      const mat = new THREE.Mesh(
        new RoundedBoxGeometry(spanW, 0.004, spanD, 4, 0.012),
        materials.leatherMat
      );
      mat.position.y = 0.002;
      group.add(mat);

      return group;
    }

    /**
     * Builds a professional Pro Stylus Pen with ergonomic grip & nib
     */
    function buildStylusPen(materials) {
      const pen = new THREE.Group();
      pen.name = 'Artist component stylus';

      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0055, 0.0048, 0.145, 24),
        materials.obsidianMat
      );
      barrel.rotation.z = Math.PI * 0.5;
      pen.add(barrel);

      // Ergonomic Rubber Grip Ring
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0058, 0.0055, 0.045, 20),
        materials.darkMat
      );
      grip.rotation.z = Math.PI * 0.5;
      grip.position.x = 0.035;
      pen.add(grip);

      // Silver Side Switch & White Ceramic Nib
      const switchBtn = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.003, 0.002, 1, 0.001), materials.metalMat);
      switchBtn.position.set(0.035, 0.006, 0);
      pen.add(switchBtn);

      const nib = new THREE.Mesh(new THREE.ConeGeometry(0.0022, 0.014, 12), materials.obsidianMat);
      nib.rotation.z = -Math.PI * 0.5;
      nib.position.x = 0.078;
      pen.add(nib);

      return pen;
    }

    /**
     * Builds a ceramic jar filled with paintbrushes and pencils
     */
    function buildBrushJar(materials) {
      const group=new THREE.Group();group.name='Artist component brushes';
      const profile=[[0,0],[.028,0],[.031,.004],[.034,.079],[.034,.085],[.029,.085],[.027,.009],[0,.009]].map(([x,y])=>new THREE.Vector2(x,y));
      group.add(new THREE.Mesh(new THREE.LatheGeometry(profile,32),materials.stoneMat));
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.0315,.0025,8,32),materials.stoneMat);rim.rotation.x=Math.PI/2;rim.position.y=.083;group.add(rim);
      for(let i=0;i<7;i++){
        const brush=new THREE.Group(),angle=i/7*Math.PI*2,h=.175+(i%3)*.018;
        brush.position.set(Math.cos(angle)*.014,.018,Math.sin(angle)*.014);brush.rotation.z=(i-3)*.045;brush.rotation.x=(i%2?1:-1)*.045;
        const handle=new THREE.Mesh(new THREE.CylinderGeometry(.0028,.0018,h,10),i%2?materials.obsidianMat:materials.woodMat);handle.position.y=h/2;brush.add(handle);
        const ferrule=new THREE.Mesh(new THREE.CylinderGeometry(.0034,.0028,.021,12),materials.metalMat);ferrule.position.y=h+.007;brush.add(ferrule);
        const color=['#49352a','#c19363','#5b4938','#927554','#42352d','#594333','#b39a75'][i];
        const bristleMat=new THREE.MeshStandardMaterial({name:'Artist natural bristles '+i,color,roughness:.96});bristleMat.userData.roomPaletteLocked=true;
        const tip=new THREE.Mesh(i%3===0?new THREE.BoxGeometry(.009,.021,.004):new THREE.ConeGeometry(.004,.025,10),bristleMat);tip.position.y=h+.028;brush.add(tip);group.add(brush);
      }
      return group;
    }
    function buildPaintPalette(materials){
      const group=new THREE.Group();group.name='Artist component palette';
      const shape=new THREE.Shape();shape.absellipse(0,0,.12,.08,0,Math.PI*2,false,0);
      const hole=new THREE.Path();hole.absellipse(.071,.006,.014,.019,0,Math.PI*2,true,0);shape.holes.push(hole);
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.001,bevelThickness:.001,curveSegments:32});geometry.rotateX(-Math.PI/2);
      const board=new THREE.Mesh(geometry,materials.woodMat);board.position.y=.001;group.add(board);
      ['#eee7cd','#d8ad38','#b84237','#304f88','#48795f','#6e4567'].forEach((color,i)=>{const a=1.1+i*.43,m=new THREE.MeshStandardMaterial({name:'Artist oil pigment '+i,color,roughness:.35});m.userData.roomPaletteLocked=true;const dab=new THREE.Mesh(new THREE.SphereGeometry(.009,12,8),m);dab.scale.set(1,.35,.8);dab.position.set(Math.cos(a)*.092,.011,-Math.sin(a)*.053);group.add(dab);});
      const knife=new THREE.Group();knife.position.set(-.02,.011,.038);knife.rotation.y=-.3;
      const grip=new THREE.Mesh(new RoundedBoxGeometry(.062,.008,.012,2,.003),materials.woodMat);knife.add(grip);
      const blade=new THREE.Mesh(new THREE.ConeGeometry(.012,.06,3),materials.metalMat);blade.rotation.z=-Math.PI/2;blade.scale.x=.12;blade.position.x=.057;knife.add(blade);group.add(knife);return group;
    }

    function buildArtistScene(cfg) {
      const propGroup = new THREE.Group();
      propGroup.name = `AtelierArtist_${cfg.archetype}`;

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

      const canvasCol = new THREE.Color(cfg.canvasColor);
      const canvasMat = new THREE.MeshStandardMaterial({
        color: canvasCol,
        roughness: 0.84,
        wireframe: cfg.wireframe
      });

      const leatherCol = new THREE.Color(cfg.leatherColor);
      const leatherMat = new THREE.MeshPhysicalMaterial({
        color: leatherCol,
        roughness: 0.52,
        sheen: 0.65,
        bumpMap: textures.leatherTex,
        bumpScale: 0.0018,
        wireframe: cfg.wireframe
      });

      const obsidianMat = new THREE.MeshPhysicalMaterial({
        color: 0x161920,
        roughness: 0.22,
        metalness: 0.25,
        clearcoat: 0.7,
        wireframe: cfg.wireframe
      });

      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x11131a,
        roughness: 0.85,
        wireframe: cfg.wireframe
      });

      const stoneMat = new THREE.MeshPhysicalMaterial({
        color: 0xdfd6c5,
        roughness: 0.42,
        clearcoat: 0.2,
        wireframe: cfg.wireframe
      });

      for(const [name,m] of Object.entries({woodMat,metalMat,canvasMat,leatherMat,obsidianMat,darkMat,stoneMat})){m.name='Artist '+name; m.userData.roomPaletteLocked=true;}
      const materials = {
        woodMat,
        metalMat,
        canvasMat,
        leatherMat,
        obsidianMat,
        darkMat,
        stoneMat
      };

      const matTopY = cfg.includeDeskMat ? 0.008 : 0.0;
      if (cfg.includeDeskMat) {
        propGroup.add(buildDeskMat(spanW, spanD, materials));
      }

      let maxElevationH = 0.44;
      let lightAnchor = new THREE.Vector3(0, 0.22, 0.05);

      // =======================================================================
      // ARCHETYPE 1: PROFESSIONAL WACOM CINTIQ PRO PEN TABLET & WORKSTATION RIG
      // =======================================================================
      if (cfg.archetype === 'tablet') {
        const tabGroup = new THREE.Group(); tabGroup.name='Artist component pen-display';
        tabGroup.position.set(0, matTopY, 0.02);

        const tabW=.52,tabH=.018,tabD=.32,angle=.15+cfg.articulation*.25;
        const pivot=new THREE.Group();pivot.rotation.x=angle;pivot.position.y=Math.sin(angle)*tabD/2+.013;tabGroup.add(pivot);
        const body=new THREE.Mesh(new RoundedBoxGeometry(tabW,tabH,tabD,3,.008),obsidianMat);pivot.add(body);
        const screen=new THREE.Mesh(new THREE.PlaneGeometry(tabW-.045,tabD-.04),new THREE.MeshBasicMaterial({name:'Artist pen display pixels',map:textures.artTex}));screen.rotation.x=-Math.PI/2;screen.position.y=tabH/2+.0006;screen.material.userData.sceneDisplay='native';pivot.add(screen);
        const remote=new THREE.Mesh(new RoundedBoxGeometry(.065,.02,.26,2,.005),darkMat);remote.position.set(-.298,0,0);pivot.add(remote);
        for(let i=0;i<5;i++){const key=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.003,12),metalMat);key.position.set(-.298,.012,-.065+i*.032);pivot.add(key);}
        const dial=new THREE.Mesh(new THREE.CylinderGeometry(.019,.019,.005,24),metalMat);dial.position.set(-.298,.015,.105);pivot.add(dial);
        const pen=buildStylusPen(materials);pen.position.set(.06,tabH/2+.008,tabD*.38);pen.rotation.y=-.12;pivot.add(pen);
        const foot=new THREE.Mesh(new RoundedBoxGeometry(.34,.016,.24,2,.004),darkMat);foot.position.set(0,.008,0);tabGroup.add(foot);
        const stand=new THREE.Mesh(new RoundedBoxGeometry(.25,Math.sin(angle)*.23,.14,2,.004),metalMat);stand.position.set(0,Math.sin(angle)*.115+.009,-.035);tabGroup.add(stand);
        propGroup.add(tabGroup);

        // Assorted Brushes & Tool Jar on Right Side
        if (cfg.includeTools) {
          const jar = buildBrushJar(materials);
          jar.position.set(spanW * 0.35, matTopY, -0.04);
          propGroup.add(jar);

          const palette=buildPaintPalette(materials);palette.position.set(spanW*.22,matTopY,spanD*.22);palette.rotation.y=.42;propGroup.add(palette);
        }

        maxElevationH = 0.35;
        lightAnchor.set(0, 0.24, 0.0);
      }

      // =======================================================================
      // ARCHETYPE 2: CLASSICAL WOODEN STUDIO EASEL & STRETCHED CANVAS
      // =======================================================================
      else if (cfg.archetype === 'easel') {
        const easelGroup = new THREE.Group(); easelGroup.name='Artist component table-easel';
        easelGroup.position.set(0, matTopY, -0.05);

        const mastH = 0.55;
        const mast = new THREE.Mesh(
          new RoundedBoxGeometry(0.035, mastH, 0.028, 3, 0.006),
          woodMat
        );
        mast.position.y = mastH * 0.5;
        // Easel tilt angle controlled by Articulation Slider!
        mast.rotation.x = -0.12 - cfg.articulation * 0.22;
        easelGroup.add(mast);

        // Rear A-Frame Support Leg
        const rearLeg = new THREE.Mesh(
          new RoundedBoxGeometry(0.025, mastH * 0.92, 0.022, 2, 0.004),
          woodMat
        );
        rearLeg.position.set(0, mastH * 0.46, -0.16);
        rearLeg.rotation.x = 0.35;
        easelGroup.add(rearLeg);

        // Lower Canvas Shelf & Brass Crank Knob
        const shelfY = 0.14 + cfg.articulation * 0.08;
        const shelf = new THREE.Mesh(
          new RoundedBoxGeometry(0.38, 0.024, 0.085, 3, 0.004),
          woodMat
        );
        shelf.position.set(0, shelfY, 0.035);
        easelGroup.add(shelf);

        const brassCrank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.024, 16),
          metalMat
        );
        brassCrank.rotation.z = Math.PI * 0.5;
        brassCrank.position.set(0, shelfY, 0.08);
        easelGroup.add(brassCrank);

        // Rear-leaning canvas with its bottom edge resting directly on the shelf.
        const canvasW=.36,canvasH=.46,angle=.12+cfg.articulation*.22;
        const pivot=new THREE.Group();pivot.name='Artist canvas support pivot';pivot.rotation.x=-angle;pivot.position.set(0,shelfY+.012+Math.sin(angle)*.011,.05);easelGroup.add(pivot);
        const canvasMesh=new THREE.Mesh(new RoundedBoxGeometry(canvasW,canvasH,.022,3,.004),canvasMat);canvasMesh.name='Artist canvas stretcher';canvasMesh.position.y=canvasH/2;pivot.add(canvasMesh);
        const painting=new THREE.Mesh(new THREE.PlaneGeometry(canvasW-.018,canvasH-.018),new THREE.MeshStandardMaterial({name:'Artist painted canvas',map:textures.artTex,roughness:.88}));painting.position.set(0,canvasH/2,.0115);pivot.add(painting);
        const lip=new THREE.Mesh(new RoundedBoxGeometry(.38,.025,.009,2,.002),woodMat);lip.name='Artist retaining lip';lip.position.set(0,shelfY+.023,.068);easelGroup.add(lip);
        propGroup.add(easelGroup);

        if (cfg.includeTools) {
          const jar = buildBrushJar(materials);
          jar.position.set(-spanW * 0.32, matTopY, 0.05);
          propGroup.add(jar);
        }

        maxElevationH = 0.65;
        lightAnchor.set(0, 0.38, 0.10);
      }

      // =======================================================================
      // ARCHETYPE 3: SCULPTOR'S ARMATURE & CLAY MODELING STAND
      // =======================================================================
      else if (cfg.archetype === 'sculpture') {
        const sculptGroup = new THREE.Group(); sculptGroup.name='Artist component sculpture';
        sculptGroup.position.set(0, matTopY, 0);

        // Cast Iron Weighted Base + Vertical Steel Armature Rod
        const ironBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.15, 0.024, 32),
          obsidianMat
        );
        ironBase.position.y = 0.012;
        sculptGroup.add(ironBase);

        const rodH = 0.27;
        const armatureRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, rodH, 16),
          metalMat
        );
        armatureRod.position.y = 0.024 + rodH * 0.5;
        sculptGroup.add(armatureRod);

        // Sculptural Bust in Progress on Armature (Rotates via Articulation Slider!)
        const bustGroup = new THREE.Group();
        bustGroup.position.set(0, .29, 0);
        bustGroup.rotation.y = cfg.articulation * Math.PI * 2;

        const clayMat = new THREE.MeshPhysicalMaterial({
          color: 0x9a7b5c,
          roughness: 0.88,
          wireframe: cfg.wireframe
        });

        const shoulders = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.12, 0.14, 4, 0.03),
          clayMat
        );
        shoulders.position.y = -0.06;
        bustGroup.add(shoulders);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 24, 20),
          clayMat
        );
        head.scale.set(0.85, 1.15, 1.0);
        head.position.y = 0.06;
        bustGroup.add(head);
        const neck=new THREE.Mesh(new THREE.CylinderGeometry(.026,.034,.07,16),clayMat);neck.position.y=-.025;bustGroup.add(neck);
        const nose=new THREE.Mesh(new THREE.ConeGeometry(.013,.04,12),clayMat);nose.rotation.x=Math.PI/2;nose.position.set(0,.065,.072);bustGroup.add(nose);
        const chin=new THREE.Mesh(new THREE.SphereGeometry(.027,16,12),clayMat);chin.scale.set(1,.5,.8);chin.position.set(0,.006,.055);bustGroup.add(chin);
        for(const x of [-.063,.063]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.016,12,10),clayMat);ear.scale.set(.5,1.2,.75);ear.position.set(x,.065,0);bustGroup.add(ear);}
        clayMat.color.set(cfg.clayColor||'#ae8062');clayMat.name='Artist modeling clay';clayMat.userData.roomPaletteLocked=true;

        sculptGroup.add(bustGroup);

        // Sculpting Modeling Tools (Loop tool, wire cutter, rib) strewn on base
        if (cfg.includeTools) {
          const tool = new THREE.Mesh(
            new RoundedBoxGeometry(0.14, 0.004, 0.012, 2, 0.002),
            woodMat
          );
          tool.position.set(0.12, 0.026, 0.08);
          tool.rotation.y = 0.55;
          sculptGroup.add(tool);
        }

        propGroup.add(sculptGroup);
        maxElevationH = 0.52;
        lightAnchor.set(0, 0.32, 0.0);
      }

      // =======================================================================
      // ARCHETYPE 4: IPAD PRO DIGITAL ILLUSTRATION & TOUCH STYLUS STATION
      // =======================================================================
      else {
        const ipadGroup = new THREE.Group(); ipadGroup.name='Artist component slate';
        ipadGroup.position.set(0, matTopY, 0.04);

        const ipW=.28,ipH=.008,ipD=.20,angle=.22+cfg.articulation*.25;
        const pivot=new THREE.Group();pivot.rotation.x=angle;pivot.position.y=Math.sin(angle)*ipD/2+.008;ipadGroup.add(pivot);
        const body=new THREE.Mesh(new RoundedBoxGeometry(ipW,ipH,ipD,3,.004),metalMat);pivot.add(body);
        const screen=new THREE.Mesh(new THREE.PlaneGeometry(ipW-.022,ipD-.022),new THREE.MeshBasicMaterial({name:'Artist illustration tablet pixels',map:textures.artTex}));screen.rotation.x=-Math.PI/2;screen.position.y=ipH/2+.0005;screen.material.userData.sceneDisplay='native';pivot.add(screen);
        const pencil=buildStylusPen(materials);pencil.position.set(0,ipH/2+.006,-ipD/2+.012);pivot.add(pencil);
        const foot=new THREE.Mesh(new RoundedBoxGeometry(.17,.01,.14,2,.003),darkMat);foot.position.y=.005;ipadGroup.add(foot);
        const stand=new THREE.Mesh(new RoundedBoxGeometry(.12,.045,.06,2,.004),obsidianMat);stand.position.set(0,.027,-.025);ipadGroup.add(stand);
        propGroup.add(ipadGroup);

        if (cfg.includeTools) {
          const jar = buildBrushJar(materials);
          jar.position.set(spanW * 0.34, matTopY, -0.05);
          propGroup.add(jar);
        }

        maxElevationH = 0.28;
        lightAnchor.set(0, 0.18, 0.05);
      }

      // Apply Scale
      propGroup.scale.setScalar(cfg.scale);

      // =======================================================================
      // STUDIO STAGING CONTEXT (Hardwood Desktop Slab & Wall Backdrop)
      // =======================================================================
      if (cfg.staging) {
        const deskSlabW = spanW * cfg.scale + 0.58;
        const deskSlabD = spanD * cfg.scale + 0.42;

        const deskSlab = new THREE.Mesh(
          new RoundedBoxGeometry(deskSlabW, 0.042, deskSlabD, 4, 0.012),
          woodMat
        );
        deskSlab.position.set(0, -0.021, 0);
        stagingGroup.add(deskSlab);

        const wallZ = -deskSlabD * 0.5 - 0.08;
        const backdropWall = new THREE.Mesh(
          new RoundedBoxGeometry(deskSlabW + 0.75, 1.35, 0.04, 2, 0.008),
          new THREE.MeshStandardMaterial({ color: 0x12151e, roughness: 0.88 })
        );
        backdropWall.position.set(0, 0.52, wallZ);
        stagingGroup.add(backdropWall);
      }

      // Enable Shadows
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
        lightAnchor: lightAnchor.multiplyScalar(cfg.scale),
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


export function createArtistGear(config={}){
 const cfg={archetype:'tablet',component:'complete',spread:.92,depth:.52,articulation:.32,woodColor:'#b99467',metalColor:'#b89b65',canvasColor:'#f1eadd',leatherColor:'#6f5744',includeDeskMat:true,includePeripherals:true,includeTools:true,...config,scale:1,staging:false,wireframe:false};
 if(!['tablet','easel','sculpture','ipad'].includes(cfg.archetype)||cfg.spread<.7||cfg.spread>1.1||cfg.depth<.35||cfg.depth>.65)throw Error('Unsupported artist loadout dimensions');
 let {propGroup}=buildArtistScene(cfg);
 if(cfg.component!=='complete'){
  const child=propGroup.getObjectByName('Artist component '+cfg.component);if(!child)throw Error('Missing artist component '+cfg.component);
  child.removeFromParent();child.position.set(0,0,0);child.rotation.y=0;propGroup=new THREE.Group();propGroup.add(child);
 }
 const mats=new Set();propGroup.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();[].concat(o.material).forEach(m=>mats.add(m));}});
 for(const m of mats){if(m.bumpMap){m.normalMap=normalTexture(m.bumpMap);m.normalScale.setScalar(.22);m.bumpMap=null;}m.userData.roomPaletteLocked=true;}
 propGroup.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(propGroup,true),c=b.getCenter(new THREE.Vector3());propGroup.position.set(-c.x,-b.min.y,-c.z);propGroup.updateMatrixWorld(true);
 propGroup.name='Atelier artist '+cfg.archetype+' '+cfg.component;propGroup.userData={atelierArtist:true,archetype:cfg.archetype,component:cfg.component,family:cfg.family};return propGroup;
}
