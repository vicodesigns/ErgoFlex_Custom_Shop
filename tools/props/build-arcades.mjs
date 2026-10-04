// Original arcade props, generated locally with embedded original artwork.
// node tools/props/build-arcades.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
const root = path.resolve(import.meta.dirname, '../..');
const variants = [
    ['arcade-orbit-runner', 'Orbit Runner arcade cabinet', '#55dfef', '#134b67', 'ORBIT RUNNER'],
    ['arcade-pixel-garden', 'Pixel Garden arcade cabinet', '#f59bcb', '#64416b', 'PIXEL GARDEN'],
    ['arcade-night-drive', 'Night Drive racing cabinet', '#ffc06e', '#715043', 'NIGHT DRIVE']
];
const linear = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const rgba = hex => [...[1, 3, 5].map(n => linear(parseInt(hex.slice(n, n + 2), 16) / 255)), 1];
const io = new NodeIO();
for (const [id, name, accent, side, title] of variants) {
    const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(name), model = doc.createNode(name); scene.addChild(model);
    const mat = (name, color, metal = 0, roughness = .65) => doc.createMaterial(name).setBaseColorFactor(rgba(color)).setMetallicFactor(metal).setRoughnessFactor(roughness);
    const dark = mat('Graphite chassis', '#17202b'), edge = mat('Original colored side panels', side), trim = mat('Accent trim', accent);
    const chrome = mat('Chrome', '#acbdc7', .8, .25), black = mat('Black rubber', '#070f1b');
    let tris = 0;
    function geometry(name, vertices, faces, material, uvFaces = null) {
        const pos = [], normal = [], uv = [];
        for (let n = 0; n < faces.length; n++) {
            const face = faces[n];
            for (let j = 1; j < face.length - 1; j++) {
                const order = [0, j, j + 1], pts = order.map(k => vertices[face[k]]);
                const a = pts[1].map((v, i) => v - pts[0][i]), b = pts[2].map((v, i) => v - pts[0][i]);
                const v = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], length = Math.hypot(...v);
                if (length < 1e-6) continue;
                for (let k = 0; k < 3; k++) { pos.push(...pts[k].map(x => x / 1000)); normal.push(...v.map(x => x / length)); uv.push(...(uvFaces?.[n]?.[order[k]] || [[0,1],[1,1],[1,0],[0,0]][order[k] % 4])); }
                tris++;
            }
        }
        const primitive = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
            .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normal)).setBuffer(buffer))
            .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer)).setMaterial(material);
        model.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
    }
    function box(name, size, at, material, rx = 0) {
        const [x,y,z] = size.map(v=>v/2);
        const p = [[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]].map(([x,y,z])=>[x+at[0],y*Math.cos(rx)-z*Math.sin(rx)+at[1],y*Math.sin(rx)+z*Math.cos(rx)+at[2]]);
        geometry(name,p,[[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]],material);
    }
    function cylinder(name, radius, height, at, material, steps=20) {
        const p = [[at[0],at[1]-height/2,at[2]],[at[0],at[1]+height/2,at[2]]], faces=[];
        for(let i=0;i<steps;i++){const a=i*Math.PI*2/steps; for(const y of [-height/2,height/2])p.push([at[0]+Math.cos(a)*radius,at[1]+y,at[2]+Math.sin(a)*radius]);}
        for(let i=0;i<steps;i++){const a=2+i*2,b=2+(i+1)%steps*2;faces.push([a,a+1,b+1,b],[0,a,b],[1,b+1,a+1]);}geometry(name,p,faces,material);
    }
    const screenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#11263c"/><stop offset="1" stop-color="${side}"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><circle cx="480" cy="112" r="55" fill="${accent}"/><path d="M0 360L140 230L270 320L390 200L640 360V480H0Z" fill="#142039"/><path d="M240 480L305 340L370 480" fill="#2e405b"/><path d="M320 470V430M320 410V385M320 370V350" stroke="${accent}" stroke-width="6"/>${Array.from({length:22},(_,i)=>`<rect x="${i*79%630}" y="${20+i*37%240}" width="3" height="3" fill="#e2f1ff"/>`).join('')}<text x="32" y="45" fill="#e8f7ff" font-family="sans-serif" font-size="22">${title}</text><text x="320" y="310" fill="${accent}" font-family="sans-serif" font-size="27" font-weight="bold" text-anchor="middle">PRESS START</text><text x="32" y="445" fill="#d9e7eb" font-family="sans-serif" font-size="18">HI 028420</text></svg>`;
    const marqueeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="256"><rect width="1024" height="256" fill="${side}"/><path d="M0 256L170 0H270L100 256ZM820 256L990 0H1024V70L920 256Z" fill="${accent}"/><text x="512" y="147" fill="#f7f5e8" font-family="sans-serif" font-size="66" font-weight="bold" text-anchor="middle">${title}</text><text x="512" y="210" fill="${accent}" font-family="sans-serif" font-size="24" text-anchor="middle">ERGOFLEX / PLAY TOGETHER</text></svg>`;
    const textured = async (name, svg) => { const png = await sharp(Buffer.from(svg)).png().toBuffer(); const t = doc.createTexture(name).setImage(png).setMimeType('image/png'); return doc.createMaterial(name).setBaseColorTexture(t).setEmissiveTexture(t).setEmissiveFactor([.35,.35,.35]).setRoughnessFactor(.45); };
    const screen = await textured('Original game screen',screenSvg), marquee = await textured('Original marquee',marqueeSvg);
    box('Grounded cabinet base',[720,80,800],[0,40,0],black);
    box('Lower chassis',[640,750,760],[0,455,-10],dark);
    // Stepped side profile makes the control deck and tilted monitor recess clear.
    for(const x of [-340,340]){
        box('Lower side panel',[40,820,800],[x,490,0],edge);
        box('Monitor side panel',[40,650,680],[x,1225,-60],edge);
        box('Marquee side panel',[40,340,780],[x,1680,0],edge);
        box('Side stripe',[10,1440,14],[x+(x<0?-25:25),1150,320],trim);
    }
    box('Monitor housing',[640,570,70],[0,1310,285],black,-.15);
    box('Tilted game screen',[575,455,4],[0,1325,328],screen,-.15);
    box('Marquee housing',[640,190,100],[0,1730,325],dark);
    box('Lit marquee',[610,160,4],[0,1730,378],marquee);
    box('Top cap',[720,35,780],[0,1867.5,0],black);
    box('Control deck',[660,55,320],[0,958,300],dark,.12);
    box('Control trim',[660,14,15],[0,956,465],trim);
    if(id.endsWith('night-drive')) {
        // A polygonal steering rim, centred in front of the racing display.
        for(let i=0;i<24;i++){const a=i*Math.PI*2/24,b=(i+1)*Math.PI*2/24; const dx=Math.cos(b)-Math.cos(a),dy=Math.sin(b)-Math.sin(a); const length=Math.hypot(dx,dy)*125; const angle=Math.atan2(dy,dx); const pts=[[-length/2,-12,0],[length/2,-12,0],[length/2,12,0],[-length/2,12,0]].map(([x,y,z])=>[x*Math.cos(angle)-y*Math.sin(angle)+(Math.cos(a)+Math.cos(b))*62.5,x*Math.sin(angle)+y*Math.cos(angle)+1120+(Math.sin(a)+Math.sin(b))*62.5,440]);geometry('Steering rim',pts,[[0,1,2,3]],chrome);}
        box('Steering hub',[210,25,30],[0,1120,425],dark);box('Pedal plate',[280,80,180],[0,120,425],chrome,.35);
    } else {
        cylinder('Joystick',12,75,[-180,1020,335],chrome);cylinder('Joystick grip',30,40,[-180,1070,335],trim);
        for(const x of [70,145,220])for(const z of [285,370])cylinder('Action button',23,17,[x,1010,z],trim,16);
    }
    box('Coin door',[230,270,14],[0,425,379],black);box('Coin slot',[90,12,5],[0,510,389],chrome);box('Return button',[35,35,6],[70,390,389],trim);
    for(let i=0;i<8;i++)box('Speaker grille',[220,5,5],[0,700+i*12,381],black);
    const bounds = getBounds(scene), round = v => Math.round(v*1e5)/100;
    const relative = `assets/props/${id}.glb`, source = `arcade/${id}.glb`;
    fs.mkdirSync(path.join(root,'models/arcade'),{recursive:true});await io.write(path.join(root,relative),doc);fs.copyFileSync(path.join(root,relative),path.join(root,'models',source));
    const metadata = {id,name,category:'gaming',collection:'Original Arcade',scenes:['gaming','lounge'],file:relative,source:'models/'+source,anchor:'floor',size:bounds.max.map((v,i)=>round(v-bounds.min[i])),min:bounds.min.map(round),max:bounds.max.map(round),tris,bytes:fs.statSync(path.join(root,relative)).size,license:'Original workspace asset',attribution:'Original geometry and game artwork authored for ErgoFlex',sizeNote:'Illustrative full-size cabinet; dimensions authored in metres, not a manufacturer specification.'};
    for(const [file,isManifest] of [['assets/props/index.json',false],['tools/props/manifest.json',true]]) { const p=path.join(root,file),data=JSON.parse(fs.readFileSync(p)); const entry=isManifest?{...metadata,source,fit:{axis:'y',mm:metadata.size[1]},textureSize:1024}:metadata; const at=data.props.findIndex(p=>p.id===id);if(at<0)data.props.push(entry);else data.props[at]=entry;fs.writeFileSync(p,JSON.stringify(data,null,1)+'\n'); }
    console.log(id,metadata.size.join(' × ')+' mm',tris+' triangles');
}
