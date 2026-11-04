import * as THREE from 'three';

// Decorative layers stay with their original furnishings. They neither add
// floor obstacles nor alter the saved room/desk transforms.
export function enhanceChildInteriors({ room, root, layout, helpers, materials, groups }) {
    const { box, mesh, material, markSceneAsset } = helpers;
    const { oak, linen, green, ink } = materials;
    const { bed, nook, rug, rear, left, floor } = groups;
    root.ownedTextures ||= [];
    const own = texture => { root.ownedTextures.push(texture); return texture; };
    const texture = (draw, width = 512, height = 512) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        draw(canvas.getContext('2d'), width, height);
        const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4; map.needsUpdate = true; return own(map);
    };
    const clone = (source, color, roughness) => {
        const copy = source.clone(); copy.color.set(color);
        if (roughness !== undefined) copy.roughness = roughness;
        copy.userData.roomFinishLocked = true; copy.needsUpdate = true; return copy;
    };
    const fixture = (parent, id, name, at, turn = 0) => {
        const group = new THREE.Group(); group.name = name; group.position.set(...at); group.rotation.y = turn;
        group.userData.propId = id; group.userData.sceneAssetName = name;
        group.userData.wallDecoration = true; group.userData.dropSurface = false;
        parent.add(group); markSceneAsset(group, { key: `childroom:${layout.id}:fixture:${id}` }); return group;
    };

    // The whole room does not need to be the same oak. The floor is pale and
    // matte, while hand-sized timber pieces retain a warmer oiled finish.
    oak.color.set('#c9aa7d'); oak.roughness = .56;
    floor?.traverse(obj => {
        if (!obj.isMesh || !obj.material?.isMeshStandardMaterial) return;
        obj.material.color.set('#dbc5a4'); obj.material.roughness = .65;
        obj.material.userData.roomFinishLocked = true;
    });
    const blueCloth = clone(green, '#86a0ab', .96);
    nook?.traverse(obj => { if (obj.isMesh && obj.material === green) obj.material = blueCloth; });
    const rabbitPink = clone(linen, '#be9589', .96);
    nook?.traverse(obj => {
        if (obj.isMesh && obj.parent?.userData.propId === 'cloth-rabbit' && obj.material === materials.coral) obj.material = rabbitPink;
    });

    // A shallow padded quilt: the underside still meets the 345 mm mattress
    // surface, while a gentle crown, compressed edges and a folded turn-down
    // catch the light. This replaces the original slab within the bed group.
    const quiltMesh = bed?.children.find(obj => obj.isMesh && obj.material === green && Math.abs(obj.position.y - 361) < .1);
    const quiltTop = (x, z) => 377 + 4 * Math.sin(x * .009) * Math.sin((z + 230) * .009)
        - 5 * Math.pow(Math.abs(x) / 555, 10) - 3 * Math.pow(Math.abs(z - 300) / 660, 10);
    const cloth = clone(green, '#97aa91', .96);
    const seamMat = clone(linen, '#d5d6bd', .98);
    const detailGroup = new THREE.Group(); detailGroup.name = 'Soft quilt · padded crown and stitched edge'; bed?.add(detailGroup);
    if (quiltMesh) {
        const previous = quiltMesh.geometry;
        const geometry = new THREE.BoxGeometry(1110, 32, 1320, 28, 2, 32), p = geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), localY = p.getY(i), z = p.getZ(i) + 300;
            const fraction = (localY + 16) / 32;
            p.setY(i, localY + fraction * (quiltTop(x, z) - 377));
        }
        geometry.computeVertexNormals(); quiltMesh.geometry = geometry; quiltMesh.material = cloth;
        let inUse = false; root.traverse(obj => { if (obj.geometry === previous) inUse = true; });
        if (!inUse) previous.dispose();
        // The former straight white seam bars would cut through the new crown.
        for (const obj of [...bed.children]) if (obj.isMesh && obj !== quiltMesh && obj.material === linen
            && Math.abs(obj.position.y - 378) < .1 && Math.abs(obj.position.x) < .1) {
            obj.removeFromParent(); obj.geometry.dispose();
        }
        const edge = [];
        const add = (x, z) => edge.push(new THREE.Vector3(x, quiltTop(x, z) + .9, z));
        for (let n = 0; n <= 30; n++) add(-533 + n * 1066 / 30, -335);
        for (let n = 1; n <= 32; n++) add(533, -335 + n * 1270 / 32);
        for (let n = 1; n <= 30; n++) add(533 - n * 1066 / 30, 935);
        for (let n = 1; n <= 32; n++) add(-533, 935 - n * 1270 / 32);
        const path = new THREE.CatmullRomCurve3(edge, true, 'centripetal');
        mesh(detailGroup, new THREE.TubeGeometry(path, 160, 1.35, 5, true), seamMat);
        const foldGeo = new THREE.BoxGeometry(1060, 18, 140, 28, 2, 8), positions = foldGeo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i) - 282;
            const fraction = (y + 9) / 18;
            positions.setXYZ(i, x, quiltTop(x, z) + .2 + fraction * (18 + 2.5 * Math.sin(x * .015)), z);
        }
        foldGeo.computeVertexNormals(); mesh(detailGroup, foldGeo, clone(linen, '#dcdac2', .96));
    }
    // Keep the lower pillow faces on the mattress while softly crowning the
    // top; original positions and asymmetry remain recognisable.
    for (const pillow of bed?.children || []) if (pillow.isMesh && pillow.material === linen
        && Math.abs(pillow.position.z + 760) < .1 && Math.abs(pillow.position.y - 390) < .1) {
        const original = pillow.geometry, g = original.clone(), positions = g.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
            const crown = 6 * Math.max(0, 1 - (x / 220) ** 2) * Math.max(0, 1 - (z / 150) ** 2);
            positions.setY(i, y + Math.max(0, (y + 45) / 90) * crown);
        }
        g.computeVertexNormals(); pillow.geometry = g; pillow.material = clone(linen, pillow.position.x < 0 ? '#e6ddc8' : '#ddd6bf', .97);
        let inUse = false; root.traverse(obj => { if (obj.geometry === original) inUse = true; });
        if (!inUse) original.dispose();
    }

    // Soft river, path and stepping stones printed into the rug. Transparent
    // colour leaves its linen base and micro-weave visible; nothing projects
    // into the blocks or the train. The existing rug borders remain intact.
    const rugMap = texture((c, w, h) => {
        c.clearRect(0, 0, w, h);
        c.lineCap = 'round'; c.lineJoin = 'round';
        const river = (offset = 0) => {
            c.beginPath(); c.moveTo(-60, h * .29 + offset);
            c.bezierCurveTo(w * .23, h * .02 + offset, w * .28, h * .78 + offset, w * .54, h * .55 + offset);
            c.bezierCurveTo(w * .79, h * .32 + offset, w * .82, h * .88 + offset, w + 80, h * .64 + offset);
        };
        c.strokeStyle = 'rgba(128,160,170,.31)'; c.lineWidth = h * .11; river(); c.stroke();
        c.strokeStyle = 'rgba(213,193,151,.35)'; c.lineWidth = h * .045; river(h * .16); c.stroke();
        c.strokeStyle = 'rgba(114,145,150,.17)'; c.lineWidth = 2; river(-h * .018); c.stroke();
        for (const [x, y, rx, ry, angle] of [[.22,.56,.026,.018,-.35],[.27,.59,.025,.019,.2],[.32,.62,.024,.017,-.2],[.72,.25,.029,.019,.3],[.77,.3,.026,.017,-.3]]) {
            c.fillStyle = 'rgba(170,162,133,.32)'; c.beginPath(); c.ellipse(w*x,h*y,w*rx,h*ry,angle,0,Math.PI*2); c.fill();
        }
        for (const [x,y] of [[.12,.15],[.87,.18],[.82,.83]]) {
            c.fillStyle='rgba(135,157,124,.25)';c.beginPath();c.ellipse(w*x,h*y,w*.016,h*.028,-.5,0,Math.PI*2);c.fill();
            c.beginPath();c.ellipse(w*(x+.025),h*(y+.015),w*.014,h*.024,.6,0,Math.PI*2);c.fill();
        }
    }, 1024, 768);
    const rugMat = material('#ffffff', { map: rugMap, transparent: true, depthWrite: false, roughness: .99,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    rugMat.userData.roomFinishLocked = true;
    const rw = layout.tier ? 2200 : 1750, rd = layout.tier ? 1700 : 1300;
    const river = mesh(rug, new THREE.PlaneGeometry(rw - 180, rd - 180), rugMat, [0, 9.1, 0]);
    river.rotation.x = -Math.PI / 2; river.castShadow = false; river.receiveShadow = true;
    river.userData.presentationOnly = true; river.userData.dropSurface = false;
    river.name = 'Woven story river · flat rug print';

    // Paint, rather than another framed object, gives the sleeping bay a
    // gentle focus. Its surface is on the plaster above the chair rail.
    const paintedArch = fixture(rear, 'sleeping-arch', 'Soft sage sleeping arch', [layout.bed[0], 0, layout.back + .45]);
    const shape = new THREE.Shape(); shape.moveTo(-635, 930); shape.lineTo(635, 930); shape.lineTo(635, 1485);
    shape.absarc(0, 1485, 635, 0, Math.PI, false); shape.lineTo(-635, 930); shape.closePath();
    const paint = clone(materials.plaster, '#c4cbb4', .97);
    const arch = mesh(paintedArch, new THREE.ShapeGeometry(shape, 40), paint); arch.castShadow = false; arch.receiveShadow = true;
    arch.userData.presentationOnly = true; arch.userData.dropSurface = false;

    // One wall-supported, low felt choice board. In the compact room its
    // 340 mm width stays in the gap after the bed and before the story rack.
    const board = fixture(left, 'felt-choice-board', 'Felt board · make, read, rest', [-layout.width / 2 + 10, 1050, 880], Math.PI / 2);
    box(board, [340,460,20], [0,0,0], oak, 7);
    const felt = clone(linen, '#dfdcc6', .98); box(board,[310,430,2],[0,0,11],felt,5);
    const titleMap = texture((c,w,h) => {
        c.clearRect(0,0,w,h);c.fillStyle='#526d65';c.textAlign='center';c.font='34px sans-serif';c.fillText('Today I choose',w/2,h*.68);
    },512,96);
    const title = mesh(board,new THREE.PlaneGeometry(280,52),material('#ffffff',{map:titleMap,transparent:true,depthWrite:false,roughness:1}),[0,177,12.2]);
    title.castShadow=false;title.userData.presentationOnly=true;
    const rows = [77,-35,-147];
    const labels = ['make','read','rest'];
    const cardMats = [clone(linen,'#d4b1a0',.98),clone(linen,'#b4c3bc',.98),clone(linen,'#b3bec9',.98)];
    for (let i=0;i<3;i++) {
        box(board,[264,82,4],[0,rows[i],14],cardMats[i],5);
        const map=texture((c,w,h)=>{
            c.clearRect(0,0,w,h);c.fillStyle='#435c55';c.strokeStyle='#435c55';c.lineWidth=7;c.lineJoin='round';
            if(i===0){c.strokeRect(27,44,35,35);c.strokeRect(69,44,35,35);c.strokeRect(48,3,35,35);}
            else if(i===1){c.beginPath();c.moveTo(22,15);c.quadraticCurveTo(49,5,65,20);c.quadraticCurveTo(84,5,111,15);c.lineTo(111,76);c.quadraticCurveTo(83,68,65,82);c.quadraticCurveTo(49,68,22,76);c.closePath();c.stroke();c.beginPath();c.moveTo(65,20);c.lineTo(65,82);c.stroke();}
            else {c.beginPath();c.arc(65,42,33,Math.PI*.3,Math.PI*1.7);c.quadraticCurveTo(32,42,65+33*Math.cos(Math.PI*.3),42+33*Math.sin(Math.PI*.3));c.fill();}
            c.font='36px sans-serif';c.textAlign='left';c.fillText(labels[i],148,57);
        },384,96);
        const face=mesh(board,new THREE.PlaneGeometry(250,67),material('#ffffff',{map,transparent:true,depthWrite:false,roughness:1}),[0,rows[i],16.15]);
        face.castShadow=false;face.userData.presentationOnly=true;
    }
    const indicator=mesh(board,new THREE.CircleGeometry(7,20),clone(materials.mustard,'#b9964d',.85),[-145,rows[0],13.2]);
    indicator.castShadow=false;indicator.userData.presentationOnly=true;
    root.userData.childInterior={palette:'sage / dusty blue / pale oak',rug:'woven story river',quilt:'padded and folded',choiceBoard:true};
    return { update(mode) { indicator.position.y = rows[mode === 'night' ? 2 : mode === 'evening' ? 1 : 0]; } };
}
